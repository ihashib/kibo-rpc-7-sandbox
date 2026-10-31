/* ---------- playback ---------- */
import { Core } from '../core/index.js';
import { esc, f2, timeText } from './format.js';
import { L } from '../i18n.js';
import type { KiboNavSandbox } from './sandbox.js';
import type { Leg } from '../core/types.js';
import type { BootLine, PlayStep } from './types.js';

export class Playback {
  _togglePlay(this: KiboNavSandbox) { if (this._play) this._stopPlay(); else if (this._playEnded) this._exitPlay(); else this._startPlay(); }

  _startPlay(this: KiboNavSandbox) {
    if (this._drive) this._toggleDrive(false);
    this._clearStop();
    const a = this._analysis;
    if (!a.legs.length) { this._toast(L('Add some waypoints first.', 'আগে কয়েকটা ওয়েপয়েন্ট যোগ করো।')); return; }
    const self = this, mult = +this.$<HTMLSelectElement>('select[data-f=speed]').value || 2;

    // Fly the clear moves in order. The robot never starts a blocked move: it waits at the
    // waypoint before it, and later moves are not flown.
    // After each move into a named waypoint the robot holds for a moment and reads the AR markers,
    // as a demo of what a program sees there.
    let legs: PlayStep[] = [], blocked = null as Leg | null, HOLD = 2.4;

    for (let i = 0; i < a.legs.length; i++) {
      if (!a.legs[i].clear) { blocked = a.legs[i]; break; }
      legs.push({ l: a.legs[i], dur: Math.max(0.05, a.legs[i].time) }); // flown at the current speed (it can change mid-play)
      if (!this._route[i].via) legs.push({ l: a.legs[i], dur: HOLD, hold: true });
    }

    // Watch through the robot camera (left) and the 3D view (right); the previous view comes back after.
    if (this._ui.view !== 'split' && !this._no3d) { this._playViewBefore = this._ui.view; this._setView('split'); }

    // 3 s of "Initializing" (a boot log made from the real world and route) with the robot at the start,
    // then it flies (t0 is when it starts moving).
    // k / t: the leg being flown and how far into it (seconds at 1×; holds always take HOLD real seconds).
    this._play = { legs: legs, t0: performance.now() + 3000, info: '', said: {}, bootLines: this._bootLog(legs.length, blocked, mult), boot: 0, mult: mult, k: 0, t: 0, last: 0, paused: false };
    this._robotPose = { pos: a.legs[0].from, q: a.legs[0].qFrom };
    const nwp = this._route.filter(function (w) { return !w.via; }).length;
    this._log(L('▶ Play at ' + mult + '× · ' + nwp + ' waypoints', '▶ ' + mult + '× গতিতে চালানো · ' + nwp + 'টা ওয়েপয়েন্ট'), 'head');
    this.$('[data-act=play]').textContent = L('■ Stop', '■ বন্ধ করো');
    this._playBtns();

    const step = function (now: number) {
      const pl = self._play;
      if (!pl) return;
      if (pl.paused) { pl.raf = requestAnimationFrame(step); return; }
      let t = (now - pl.t0) / 1000;

      if (t < 0) {
        // One more boot line about every 0.4 s, the first straight away.
        const n = Math.min(pl.bootLines.length, 1 + Math.floor((3 + t) / (2.8 / pl.bootLines.length)));

        if (n !== pl.boot) {
          if (!pl.boot) {
            pl.info = L('Initializing…', 'চালু হচ্ছে…'); const ce = self.$('[data-playinfo]'); if (ce) ce.textContent = pl.info; else self._renderStatus();
            self._drawAll(); self._place3dRobot();
          }

          pl.boot = n; self._bootScreen(pl.bootLines.slice(0, n));
        }

        pl.raf = requestAnimationFrame(step);
        return;
      }

      if (pl.boot) { pl.boot = 0; pl.last = pl.t0; self._bootScreen(null); }
      let dt = Math.min(0.25, (now - pl.last) / 1000); // a hidden tab pauses the frames; don't jump ahead
      pl.last = now;

      while (dt > 0 && pl.k < legs.length) {
        const rate = legs[pl.k].hold ? 1 : pl.mult, need = (legs[pl.k].dur - pl.t) / rate;
        if (dt >= need) { dt -= need; pl.k++; pl.t = 0; } else { pl.t += dt * rate; dt = 0; }
      }

      const k = pl.k;
      t = pl.t;

      // Log every step reached since the last frame, in order: at high speed a short move can start and
      // end between two frames, and it still gets its line (before "Route done" when it was the last one).
      for (let j = 0; j <= Math.min(k, legs.length - 1); j++) {
        if (pl.said[j]) continue;
        pl.said[j] = 1;
        const S = legs[j];

        if (S.hold) self._logReading(S.l.index);
        else if (!self._route[S.l.index].via) self._log(L('→ waypoint ', '→ ওয়েপয়েন্ট ') + (S.l.index + 1) + ' · ' + self._route[S.l.index].name);
      }

      if (k >= legs.length) {
        if (!blocked) {
          const last = legs[legs.length - 1].l, m = self._mission;
          self._robotPose = { pos: last.to, q: last.qTo };
          self._log(L('■ Route done · mission ', '■ রুট শেষ · মিশন ') + m.done + '/' + m.total + (m.score ? L(' · est. ', ' · আনু. ') + Core.fmt(m.score.total, 1) + L(' pt', ' পয়েন্ট') : ''), 'ok');
          self._stopPlay(true);
          return;
        }

        const n = blocked.index + 1, at = blocked.index === 0 ? self._config.start.name : L('waypoint ', 'ওয়েপয়েন্ট ') + blocked.index, why = Core.whyText({ why: blocked.why, zone: blocked.zone });
        self._robotPose = { pos: blocked.from, q: blocked.qFrom };
        self._stopPlay('blocked', L('Waiting at ' + at + ': move ' + n + ' is blocked', at + '-এ অপেক্ষা করছে: ' + n + ' নম্বর পথ আটকে আছে'));
        self._log(L('■ Stopped at ' + at + ': move ' + n + ' is blocked (' + why + ')', '■ ' + at + '-এ থেমেছে: ' + n + ' নম্বর পথ আটকে আছে (' + why + ')'), 'bad');
        self._toast(L('Move ' + n + ' is blocked. See the log.', n + ' নম্বর পথ আটকে আছে। লগ দেখো।'));
        return;
      }

      const P = legs[k], lg = P.l, f = P.hold ? 1 : Math.min(1, t / P.dur);
      self._robotPose = { pos: Core.lerp(lg.from, lg.to, f), q: Core.qSlerp(lg.qFrom, lg.qTo, f) };
      const info = P.hold ? L('Reading markers at waypoint ' + (lg.index + 1), 'ওয়েপয়েন্ট ' + (lg.index + 1) + '-এ মার্কার পড়ছে') : L('Playing move ' + (lg.index + 1) + '/' + a.legs.length, 'পথ ' + (lg.index + 1) + '/' + a.legs.length + ' চলছে');
      if (info !== self._play!.info) { self._play!.info = info; const el = self.$('[data-playinfo]'); if (el) el.textContent = info; else self._renderStatus(); }
      self._drawAll();
      self._place3dRobot();
      self._play!.raf = requestAnimationFrame(step);
    };

    this._renderStatus();
    this._play.raf = requestAnimationFrame(step);
  }

  // finished: true (route done) or 'blocked' (stopped before a blocker): the Play view and the robot's
  // last pose stay until the student presses Exit play (the robot pose also clears when the route
  // changes or something is selected). Falsy: stopped by the user, so it exits straight away.
  _stopPlay(this: KiboNavSandbox, finished?: true | 'blocked', note?: string) {
    if (!this._play) return;
    if (!finished) this._log(L('■ Play stopped', '■ চালানো বন্ধ'));
    cancelAnimationFrame(this._play.raf!);
    this._play = null;
    this._bootScreen(null);
    this._playEnded = finished || 'stopped';
    if (!finished) { this._exitPlay(); return; }
    this._playBtns();
    this._playNote = finished === 'blocked' ? note! : L('Route done', 'রুট শেষ');
    const b = this.$('[data-act=play]');
    if (b) b.textContent = L('✕ Exit play', '✕ বের হও');
    if (this._built) { this._renderStatus(); this._drawAll(); this._place3dRobot(); }
  }

  // Leave a finished Play: back to the view from before it, with the robot at the route's start.
  _exitPlay(this: KiboNavSandbox) {
    if (!this._playEnded) return;
    this._playEnded = null;
    this._playNote = '';
    this._robotPose = null;
    this._playBtns();
    const b = this.$('[data-act=play]');
    if (b) b.textContent = L('▶ Play', '▶ চালাও');
    const v = this._playViewBefore;
    this._playViewBefore = null;
    if (v && this._ui.view === 'split' && !this._drive) this._setView(v);
    if (this._built) { this._renderStatus(); this._drawAll(); this._place3dRobot(); }
  }

  // Pause or resume Play (Initializing too); its clocks move on by the time spent paused.
  _pausePlay(this: KiboNavSandbox, on: boolean) {
    const pl = this._play;
    if (!pl || pl.paused === on) return;
    const now = performance.now();

    if (on) pl.pausedAt = now;
    else { const d = now - pl.pausedAt!; pl.t0 += d; pl.last += d; }

    pl.paused = on;
    this._log(on ? L('❚❚ Paused', '❚❚ থামানো হলো') : L('▶ Resumed', '▶ আবার চলছে'));
    this._playBtns();
    const el = this.$('[data-playinfo]');
    if (el) el.textContent = (on ? L('Paused · ', 'থেমে আছে · ') : '') + pl.info;
  }

  // Fly the route again from the start, keeping the view to return to on Exit play.
  _replay(this: KiboNavSandbox) {
    if (!this._playEnded) return;
    this._playEnded = null;
    this._playNote = '';
    this._robotPose = null;
    this._startPlay();
    this._playBtns();
  }

  // Pause while playing; Play again next to Exit play once it has ended.
  _playBtns(this: KiboNavSandbox) {
    const b = this.$('[data-act=pause]'), pl = this._play, again = this.$('[data-act=replay]');
    const ended = this._playEnded === true || this._playEnded === 'blocked';
    if (again) again.hidden = !ended;
    this._root.classList.toggle('playing', !!pl || ended);
    if (!b) return;
    const paused = !!(pl && pl.paused);
    b.hidden = !pl;
    const lbl = paused ? L('Resume', 'চালিয়ে যাও') : L('Pause', 'থামাও');
    b.innerHTML = (paused ? '▶' : '❚❚') + '<span class="plbl"> ' + lbl + '</span>';
    b.setAttribute('aria-label', lbl);
    b.setAttribute('aria-pressed', String(paused));
  }

  // The "Initializing" log shown before Play flies: real numbers from the world and route, dressed up
  // as a robot boot. Each line is [status, text]; status is ok, warn or run.
  _bootLog(this: KiboNavSandbox, clear: number, blocked: Leg | null, mult: number) {
    const cfg = this._config, a = this._analysis, m = this._mission, p = cfg.start.pos;
    const wps = this._route.filter(function (w) { return !w.via; }).length;

    const lines: BootLine[] = [
      ['ok', 'world ' + cfg.name],
      ['ok', 'robot ' + cfg.robot.name + ' · Ø ' + f2(cfg.robot.size) + ' m · clearance ' + f2(cfg.settings.clearance) + ' m'],
      ['ok', '/camera_main ' + cfg.camera.width + '×' + cfg.camera.height + ' · ' + cfg.targets.length + ' AR markers indexed'],
      ['ok', 'localization locked at ' + cfg.start.name + ' (' + p.map(f2).join(', ') + ')'],
      ['ok', 'mission ' + m.total + ' goals · route ' + wps + ' waypoints · ' + f2(a.distance) + ' m · est. ' + timeText(a.time)]
    ];

    lines.push(blocked ? ['warn', 'path check: move ' + (blocked.index + 1) + ' blocked, flying ' + clear + ' of ' + a.legs.length]
      : ['ok', 'path check: ' + a.legs.length + '/' + a.legs.length + ' moves clear']);

    lines.push(['run', 'starting flight from ' + cfg.start.name + ' at ' + mult + '×']);
    return lines;
  }

  _bootScreen(this: KiboNavSandbox, lines: BootLine[] | null) {
    const el = this.$('.boot');
    if (!el) return;
    el.classList.toggle('on', !!lines);
    if (!lines) { el.innerHTML = ''; return; }

    // Only add the new lines: rebuilding the panel would replay every line's slide-in (a flicker).
    const tag = { ok: '<span class="ok">[  OK  ]</span> ', warn: '<span class="warn">[ WARN ]</span> ', run: '<span class="mut">[  ..  ]</span> ' };
    let bp = el.querySelector('.bp');
    if (!bp) { el.innerHTML = '<div class="bp"><div class="bt"><i></i>INITIALIZING</div></div>'; bp = el.querySelector('.bp'); }
    const shown = bp!.querySelectorAll('.bl'), cur = bp!.querySelector('.cur');
    if (shown.length >= lines.length) return;
    if (cur) cur.classList.remove('cur');

    for (let i = shown.length; i < lines.length; i++) {
      const d = document.createElement('div');
      d.className = 'bl' + (i === lines.length - 1 ? ' cur' : '');
      d.innerHTML = tag[lines[i][0]] + esc(lines[i][1]);
      bp!.appendChild(d);
    }
  }

  // Log what the robot camera reads at waypoint i and whether its checkpoint passes (Play, at each stop).
  _logReading(this: KiboNavSandbox, i: number) {
    const cfg = this._config, rd = Core.readMarkers(cfg, this._analysis.poses[i]), self = this;
    if (!rd.seen.length) this._log(L('[AR] no marker', '[AR] কোনো মার্কার নেই') + (rd.missed.length ? ' · ' + rd.missed[0].name.split(' ')[0] + ' ' + rd.missed[0].why : ''), 'warn');
    rd.seen.forEach(function (m) { self._log('[AR] ID ' + m.id + ' · ' + f2(m.distance) + L(' m · ', ' মি · কেন্দ্র থেকে ') + Math.round(m.offCentre) + L('° off centre', '° সরে'), 'ar'); });
    const g = this._mission.goals.filter(function (x) { return x.kind === 'checkpoint' && x.index === i; })[0];
    if (!g) return;
    if (g.done) { this._log(g.name + L(' passes at Lv' + g.level, ' Lv' + g.level + '-এ পার হয়'), 'ok'); return; }

    // Say what is off, by how much, so the student knows what to fix (rough drafts fail on purpose).
    const cp = Core.findCheckpoint(cfg, g.id), ck = cp && Core.checkpointCheck(cfg, cp, this._analysis.poses[i]), why = [];
    const outer = function <K extends string>(bands: Array<Record<K, number>>, key: K) { return bands.length ? bands[bands.length - 1][key] : null; };
    const r1 = outer(cp!.scoreBands, 'radius'), m = function (v: number) { return Core.fmt(v, Math.abs(v - r1!) < 0.01 ? 3 : 2); };
    if (ck && !ck.levels.pos) why.push(L(m(ck.dist) + ' m from centre (Lv1 ≤ ' + m(r1!) + ' m)', 'কেন্দ্র থেকে ' + m(ck.dist) + ' মি (Lv1 ≤ ' + m(r1!) + ' মি)'));
    if (ck && !ck.levels.centering) why.push(L('marker ' + Math.round(ck.centering) + '° off centre (Lv1 ≤ ', 'মার্কার কেন্দ্র থেকে ' + Math.round(ck.centering) + '° সরে (Lv1 ≤ ') + outer(cp!.centeringBands, 'angle') + '°)');
    if (ck && !ck.levels.roll) why.push(L('roll ' + Math.round(Math.abs(ck.roll)) + '° off (Lv1 ≤ ' + outer(cp!.rollBands, 'angle') + '°), press ' + (ck.roll > 0 ? '⟲' : '⟳'), 'রোল ' + Math.round(Math.abs(ck.roll)) + '° সরে আছে (Lv1 ≤ ' + outer(cp!.rollBands, 'angle') + '°), ' + (ck.roll > 0 ? '⟲' : '⟳') + ' চাপো'));
    this._log(g.name + L(' not passed', ' পার হয়নি') + (why.length ? ' · ' + why.join(' · ') : ''), 'warn');
  }

  // What the robot camera reads at waypoint i, in one line (Play shows it at each stop).
  _readingText(this: KiboNavSandbox, i: number) {
    const cfg = this._config, pose = this._analysis.poses[i], w = this._route[i], rd = Core.readMarkers(cfg, pose);
    let s = L('Waypoint ', 'ওয়েপয়েন্ট ') + (i + 1) + ' (' + w.name + '): ';
    const dot = L('.', '।');
    if (!rd.seen.length) return s + L('the camera reads no marker', 'ক্যামেরা কোনো মার্কার পড়ছে না') + (rd.missed.length ? ' (' + rd.missed[0].name.split(' ')[0] + ' ' + rd.missed[0].why + ')' : '') + dot;
    s += L('camera reads ', 'ক্যামেরা পড়ছে ') + rd.seen.map(function (m) { return L('ID ' + m.id + ' at ' + f2(m.distance) + ' m, ' + Math.round(m.offCentre) + '° off centre', 'ID ' + m.id + ', ' + f2(m.distance) + ' মি দূরে, কেন্দ্র থেকে ' + Math.round(m.offCentre) + '° সরে'); }).join('; ');
    const g = this._mission.goals.filter(function (x) { return x.kind === 'checkpoint' && x.index === i; })[0];
    if (g) s += ' · ' + g.name + (g.done ? L(' passes at Lv' + g.level, ' Lv' + g.level + '-এ পার হয়') : L(' not passed yet', ' এখনো পার হয়নি'));
    return s + dot;
  }

  // Where to draw the robot: playback pose, else the selected waypoint, else the start.
  _robotNow(this: KiboNavSandbox) {
    if (this._drive) return this._drivePose();
    if (this._robotPose) return this._robotPose;
    if (this._sel >= 0 && this._analysis.poses[this._sel]) return this._analysis.poses[this._sel];
    return { pos: this._config.start.pos, q: Core.qNorm(this._config.start.q) };
  }
}
