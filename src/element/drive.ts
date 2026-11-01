/* ---------- drive mode: fly the robot by hand, drop waypoints ---------- */
import { Core } from '../core/index.js';
import { esc, f2, f3, vecText } from './format.js';
import { L } from '../i18n.js';
import { setupStick } from './sticks.js';
import type { KiboNavSandbox } from './sandbox.js';
import type { CaptureCheck, Checkpoint, CheckpointCheck, Pose, Target } from '../core/types.js';

export class Drive {
  _setupDriveInputs(this: KiboNavSandbox) {
    const self = this, vp = this.$('.viewport');

    vp.addEventListener('pointerdown', function (e) {
      if (!(e.target as Element).closest('button,input,select')) { try { vp.focus({ preventScroll: true }); } catch (err) { vp.focus(); } }
    });

    vp.addEventListener('focusout', function (e) { if (self._drive && !vp.contains(e.relatedTarget as Node | null)) self._drive.keys = {}; });

    // Each stick, with a big touch zone around its corner of the view (touch screens only). A thumb landing on
    // one brings the views to the middle of the window (see _centerGameView).
    this.$$<HTMLElement>('.joy').forEach(function (j) {
      const name = j.getAttribute('data-joy') as 'move' | 'turn';
      setupStick(j, self.$<HTMLElement>('.jzone[data-zone="' + name + '"]'), function (v) { if (self._drive) self._drive.joy[name] = v; }, function () { self._centerGameView(); });
    });

    this.$$('[data-hold]').forEach(function (b) {
      const name = b.getAttribute('data-hold')!;
      function on(v: boolean) { return function (e: Event) { if (self._drive) self._drive.hold[name] = v; if (v) e.preventDefault(); }; }
      b.addEventListener('pointerdown', on(true));
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { b.addEventListener(ev, on(false)); });
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });

    // On-screen keys: hold with the mouse (or a pen) like the real key.
    this.$$('.kpad [data-key]').forEach(function (b) {
      const code = b.getAttribute('data-key')!;

      b.addEventListener('pointerdown', function (e) {
        if (!self._drive) return;
        e.preventDefault();
        try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        self._drive.keys[code] = true; self._driveKeysUi();
      });

      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) {
        b.addEventListener(ev, function () { if (self._drive && self._drive.keys[code]) { delete self._drive.keys[code]; self._driveKeysUi(); } });
      });
    });

    this._winBlur = function () { if (self._drive) { self._drive.keys = {}; self._drive.hold = {}; self._driveKeysUi(); } };

    // While driving, keys pressed anywhere on the page drive the robot (not while typing in a field).
    function typing(el: HTMLElement | null) { return el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)); }

    this._winKeyDown = function (e) {
      if (!self._drive || e.defaultPrevented) return;
      const path = e.composedPath ? e.composedPath() : [e.target];
      if (path.indexOf(self) >= 0 || typing(path[0] as HTMLElement | null)) return; // inside the sandbox its own handler runs
      self._driveKey(e, true);
    };

    this._winKeyUp = function (e) { self._driveKeyUp(e); };
  }

  // `onLoad`: Drive started by itself when the page opened (see _boot). Then the keys work page-wide only after
  // the first tap or click inside the sandbox, so the page still scrolls with Space and the arrows until then.
  _toggleDrive(this: KiboNavSandbox, on?: boolean, onLoad?: boolean) {
    if (on === undefined) on = !this._drive;
    if (!!on === !!this._drive) return;
    const self = this, vp = this.$('.viewport');

    if (on) {
      this._stopPlay();
      this._exitPlay();
      this._clearStop();
      const p = this._robotNow();

      // Start upright: if the robot's top points at the deck (the dock pose does), roll it 180° about the
      // camera axis so the camera picture is the right way up. Reset returns here.
      let q0 = Core.qNorm(p.q);
      if (Core.dot(Core.topDir(q0), [0, 0, -1]) < 0) q0 = Core.qNorm(Core.qMul(q0, Core.qFromAxisAngle([1, 0, 0], Math.PI)));
      this._drive = { pos: p.pos.slice(), q: q0, start: { pos: p.pos.slice(), q: q0 }, keys: {}, joy: { move: [0, 0], turn: [0, 0] }, hold: {}, fine: false, last: 0, hudAt: 0 };
      this.$('[data-act=drivefine]').setAttribute('aria-pressed', 'false');
      window.addEventListener('blur', this._winBlur);
      const pageKeys = function () {
        self._root.removeEventListener('pointerdown', pageKeys); self._root.removeEventListener('focusin', pageKeys);
        if (!self._drive) return;
        window.addEventListener('keydown', self._winKeyDown);
        window.addEventListener('keyup', self._winKeyUp);
      };
      if (onLoad) { this._root.addEventListener('pointerdown', pageKeys); this._root.addEventListener('focusin', pageKeys); }
      else {
        pageKeys();
        try { vp.focus({ preventScroll: true }); } catch (e) { vp.focus(); }
      }
      const touch = this._sticks;
      this._toast(touch ? L('Left stick moves, right stick turns. Add waypoint drops one.', 'বাঁ স্টিকে চলবে, ডান স্টিকে ঘুরবে। ‘ওয়েপয়েন্ট বসাও’ চাপলে একটা বসে যাবে।')
        : L('W A S D move, R / F up and down, arrows turn, Q / E roll, Enter adds a waypoint.', 'W A S D দিয়ে চলো, R / F দিয়ে ওপর-নিচ, অ্যারো কি দিয়ে ঘোরো, Q / E দিয়ে রোল। Enter চাপলে ওয়েপয়েন্ট বসবে।'));
      this._log(L('● Drive · ', '● ড্রাইভ · ') + (touch ? L('left stick moves, right stick turns', 'বাঁ স্টিকে চলা, ডান স্টিকে ঘোরা') : L('W A S D move, R / F up / down, arrows turn, Q / E roll', 'W A S D চলা, R / F ওপর / নিচ, অ্যারো ঘোরা, Q / E রোল')), 'head');

      // A fixed side view of the whole module while driving; the previous view comes back afterwards.
      if (this._camera) this._viewBeforeDrive = { pos: this._camera.position.clone(), target: this._controls.target.clone(), roll: this._issRoot.rotation.x };
      this._driveView3d();

      // The robot camera (left) and 3D (right) side by side while driving; the other views stay one tap away.
      this._uiViewBeforeDrive = this._ui.view;
      this._setView('split');
      requestAnimationFrame(function () { if (self._drive) { self._resize3d(); self._driveView3d(); } });
      const loop = function (now: number) { if (!self._drive) return; self._driveTick(now); self._drive.raf = requestAnimationFrame(loop); };
      this._drive.raf = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(this._drive!.raf!);
      window.removeEventListener('blur', this._winBlur);
      window.removeEventListener('keydown', this._winKeyDown);
      window.removeEventListener('keyup', this._winKeyUp);
      this._drive = null;
      this._log(L('■ Drive stopped', '■ ড্রাইভ বন্ধ'));
      const vb = this._viewBeforeDrive;
      if (vb && this._camera) { this._camera.position.copy(vb.pos); this._controls.target.copy(vb.target); this._issRoot.rotation.x = vb.roll; this._rollWheelUi(); this._controls.update(); this._render3d(); }
      this._viewBeforeDrive = null;
      this._expandFrom = null;
      if (this._uiViewBeforeDrive && ['split', 'cam', '3d'].indexOf(this._ui.view!) >= 0) this._setView(this._uiViewBeforeDrive);
      this._uiViewBeforeDrive = null;
    }

    this._root.classList.toggle('driving', !!on);
    this.$('.drive').hidden = !on;
    this._updatePaused();
    this.$('[data-act=drive]').setAttribute('aria-pressed', String(!!on));
    this._driveHud();
    this._drawAll();
    this._place3dRobot();
  }

  // While driving, keep the views above the controls: reserve the controls' height at the bottom.
  _layoutDrive(this: KiboNavSandbox) {
    // On a short screen (a phone in landscape) the controls sit in the corners and along the bottom edge,
    // so the views keep the full height and the controls float over them.
    const dp = this._drive && this._ui.view === 'split' && !this._short && this.$('.dpad');
    this._root.style.setProperty('--dpadh', (dp ? Math.round(dp.offsetHeight) : 0) + 'px');
    const self = this;
    requestAnimationFrame(function () { self._placeJzones(); });
  }

  // The touch zone of each stick: a circle around it, 44 px wider than the stick on every side (a bit more
  // than its visible ring), so a thumb that lands near the stick still steers but the rest of the views
  // (3D twist, pinch and pan) stay free.
  _placeJzones(this: KiboNavSandbox) {
    const drive = this.$('.drive');
    if (!this._drive || !drive) return;
    const dr = drive.getBoundingClientRect(), self = this, m = 44;

    ['move', 'turn'].forEach(function (n) {
      const j = self.$('.joy[data-joy="' + n + '"]'), z = self.$('.jzone[data-zone="' + n + '"]');
      if (!j || !z) return;
      const r = j.getBoundingClientRect();
      if (!r.width) { z.style.width = z.style.height = '0px'; return; }
      z.style.left = Math.round(r.left - dr.left - m) + 'px';
      z.style.top = Math.round(r.top - dr.top - m) + 'px';
      z.style.width = z.style.height = Math.round(r.width + 2 * m) + 'px';
    });
  }

  // Back to where Drive started (upright), with the 3D view reset too.
  _driveReset(this: KiboNavSandbox) {
    const d = this._drive;
    if (!d || !d.start) return;
    d.pos = d.start.pos.slice(); d.q = d.start.q.slice();
    d.keys = {}; d.joy = { move: [0, 0], turn: [0, 0] }; d.hold = {};
    this._touched3d = false;
    this._driveView3d();
    this._driveKeysUi();
    this._driveHud();
    this._drawAll();
    this._place3dRobot();
    this._log(L('↺ Reset to where Drive started', '↺ ড্রাইভ যেখান থেকে শুরু হয়েছিল, সেখানে ফেরা হলো'));
  }

  _drivePose(this: KiboNavSandbox) { return { pos: this._drive!.pos, q: this._drive!.q }; }

  _driveTo(this: KiboNavSandbox, pose: Pose) {
    this._drive!.pos = pose.pos.slice(); this._drive!.q = Core.qNorm(pose.q);
    this._driveHud();
  }

  // The waypoint a new one would follow: the selected one, else the last one, else the start.
  _driveFrom(this: KiboNavSandbox) {
    const r = this._route;
    if (this._sel >= 0 && r[this._sel]) return { pos: r[this._sel].pos, label: L('waypoint ', 'ওয়েপয়েন্ট ') + (this._sel + 1) };
    if (r.length) return { pos: r[r.length - 1].pos, label: L('waypoint ', 'ওয়েপয়েন্ট ') + r.length };
    return { pos: this._config.start.pos, label: this._config.start.name };
  }

  // outside: the key was pressed with focus outside the 3D/2D views (a button, the page...). Then
  // Enter and Space keep their usual job on buttons and links.
  _driveKey(this: KiboNavSandbox, e: KeyboardEvent, outside: boolean) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const code = e.code, d = this._drive!;
    // Esc goes back to driving from another view; it never leaves Drive (Play does). Otherwise it closes menus.
    if (e.key === 'Escape') { if (this._ui.view === 'split') return false; this._viewBack(); return true; }
    if (this._ui.view !== 'split') return false; // paused: an expanded view, or another view picked from the header

    if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') {
      const t = (e.composedPath ? e.composedPath()[0] : e.target) as Element | null;
      if (outside && t && t.closest && t.closest('button,a,summary,[role=button]')) return false;
      e.preventDefault(); if (!e.repeat) this._driveAdd(); return true;
    }

    if (code === 'KeyU') { if (!e.repeat) this._driveUpdate(); return true; }
    if (code === 'KeyH') { if (!e.repeat) this._driveReset(); return true; }
    const held = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyF', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'];
    if (held.indexOf(code) < 0) return false;
    e.preventDefault();
    if (this._sticks) { this._keyboard = true; this._applyTouchMode(); this._layoutDrive(); } // a real keyboard: show its keys, not the sticks
    if (!e.repeat && !d.keys[code]) this._centerGameView();
    d.keys[code] = true;
    this._driveKeysUi();
    return true;
  }

  _driveKeyUp(this: KiboNavSandbox, e: KeyboardEvent) {
    if (!this._drive || !this._drive.keys[e.code]) return;
    delete this._drive.keys[e.code];
    this._driveKeysUi();
  }

  // Light up the on-screen keys that are held (keyboard or mouse).
  _driveKeysUi(this: KiboNavSandbox) {
    const k = this._drive ? this._drive.keys : {};
    this.$$('.kpad [data-key]').forEach(function (b) { b.classList.toggle('on', !!k[b.getAttribute('data-key')!]); });
  }

  _driveTick(this: KiboNavSandbox, now: number) {
    if (this._ui.view !== 'split') { this._drive!.last = 0; return; } // paused (see _updatePaused)
    const d = this._drive!, cfg = this._config, k = d.keys;
    const dt = d.last ? Math.min(0.1, (now - d.last) / 1000) : 0;
    d.last = now;
    if (!dt) return;
    const S = Core.STEER, fine = d.fine || k.ShiftLeft || k.ShiftRight, v = fine ? S.fineSpeed : S.speed, w = fine ? S.fineTurn : S.turn;
    const fwd = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0) - d.joy.move[1];
    const side = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + d.joy.move[0];
    const vert = (k.KeyR ? 1 : 0) - (k.KeyF ? 1 : 0) + (d.hold.up ? 1 : 0) - (d.hold.down ? 1 : 0); // up in the camera picture
    const yawIn = (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0) + d.joy.turn[0];
    const pitchIn = (k.ArrowUp ? 1 : 0) - (k.ArrowDown ? 1 : 0) - d.joy.turn[1];

    // ⟲ / Q turn the camera picture anticlockwise (the robot rolls clockwise), ⟳ / E the other way.
    const rollIn = (k.KeyQ ? 1 : 0) - (k.KeyE ? 1 : 0) + (d.hold.rollL ? 1 : 0) - (d.hold.rollR ? 1 : 0);
    let changed = false;

    if (fwd || side || vert) {
      // Every move follows the camera picture, whichever way up the robot is: forward along the camera,
      // right = the picture's right (body -Y), up = the picture's up (the robot's top, body +Z).
      const f = Core.cameraDir(d.q), r = Core.qRotate(d.q, [0, -1, 0]), u = Core.topDir(d.q);
      const delta = Core.scale(Core.add(Core.add(Core.scale(f, fwd), Core.scale(r, side)), Core.scale(u, vert)), v * dt);
      const np = Core.driveStep(cfg, d.pos, delta), moved = Core.sub(np, d.pos);
      if (Core.len(moved) > 1e-9) { d.pos = np; changed = true; }
    }

    if (yawIn || pitchIn || rollIn) {
      // Turn about the robot's own axes, as the camera sees them: left / right about its top (+Z),
      // look up / down about its left (+Y), roll about the camera axis (+X, + = robot clockwise).
      let rad = w * dt * Math.PI / 180, q = d.q;
      if (yawIn) q = Core.qMul(q, Core.qFromAxisAngle([0, 0, 1], -yawIn * rad));
      if (pitchIn) q = Core.qMul(q, Core.qFromAxisAngle([0, 1, 0], -pitchIn * rad));
      if (rollIn) q = Core.qMul(q, Core.qFromAxisAngle([1, 0, 0], rollIn * rad));
      d.q = Core.qNorm(q);
      changed = true;
    }

    if (!changed) return;
    this._drawAll();
    this._place3dRobot();
    if (now - d.hudAt > 70) { d.hudAt = now; this._driveHud(); }
  }

  // Keep the robot in the 3D view: move the orbit camera along with it.
  // Drive: the whole module from the long side (EPS2 wall, +y), a little toward the dock end and from
  // overhead, so the dock is on the left, the airlock on the right and overhead at the top. The camera
  // stays put while the robot flies (the student can still orbit or zoom).
  _driveView3d(this: KiboNavSandbox) { this._fit3d(); }

  // Steering (a stick on a phone held upright, a Drive key on a desktop) brings the game view, the camera and
  // 3D views with their controls, to the middle of the window when it is noticeably off. Full screen has no
  // page to scroll.
  _centerGameView(this: KiboNavSandbox) {
    if (this._fs) return;
    const r = this.$('.viewport').getBoundingClientRect();
    if (Math.abs(r.top + r.height / 2 - innerHeight / 2) > 40) this._centerViews();
  }

  _driveHud(this: KiboNavSandbox) {
    if (!this._drive) return;
    const d = this._drive, cfg = this._config, pose = this._drivePose(), st = Core.pointStatus(cfg, d.pos);
    const ypr = Core.yawPitchFromQ(d.q);

    // The pose first: on a computer a long line is cut short from the end, so the additions go last.
    const l1 = '<span class="hpose">x ' + f3(d.pos[0]) + '  y ' + f3(d.pos[1]) + '  z ' + f3(d.pos[2]) + '  <span class="mut">' + L('heading', 'হেডিং') + '</span> ' + Math.round(ypr.yaw) + '°  <span class="mut">' + L('pitch', 'পিচ') + '</span> ' + Math.round(ypr.pitch) + '°  <span class="mut">' + L('roll', 'রোল') + '</span> ' + Math.round(ypr.roll) + '°</span>' +
      (st.free ? '' : '  <span class="bad">' + esc(Core.whyText(st)) + '</span>');

    // What the camera is looking at.
    let best = null as { t: Target; ck: CaptureCheck } | null;

    cfg.targets.forEach(function (t) {
      const ck = Core.captureCheck(cfg, t, pose);
      if (ck.front && ck.aim < 45 && (!best || ck.aim < best.ck.aim)) best = { t: t, ck: ck };
    });

    let l2: string, near = null as { cp: Checkpoint; ck: CheckpointCheck } | null;

    cfg.checkpoints.forEach(function (cp) {
      const ck = Core.checkpointCheck(cfg, cp, pose);
      if (ck.dist < 2 * cp.scoreBands[cp.scoreBands.length - 1].radius && (!near || ck.dist < near.ck.dist)) near = { cp: cp, ck: ck };
    });

    const lvSpan = function (lv: number, text: string) { return '<span class="' + (lv ? 'ok' : 'bad') + '">' + text + ' ' + (lv ? 'Lv' + lv : '✕') + '</span>'; };

    if (near) {
      const nk = near.ck;
      l2 = '<span class="' + (nk.passed ? 'ok' : 'mut') + '">' + esc(near.cp.name) + ':</span> ' + lvSpan(nk.levels.pos, f2(nk.dist) + L(' m', ' মি')) + ' · ' +
        lvSpan(nk.levels.centering, L('centre ', 'কেন্দ্র ') + Math.round(nk.centering) + '°') + ' · ' + lvSpan(nk.levels.roll, L('roll ', 'রোল ') + Math.round(Math.abs(nk.roll)) + '° ' + (Math.abs(nk.roll) < 1 ? '' : nk.roll > 0 ? '(⟲ Q)' : '(⟳ E)')) +
        (nk.passed ? ' <span class="ok">' + L('passes at Lv' + nk.level, 'Lv' + nk.level + '-এ পার হচ্ছে') + '</span>' : '');
    } else if (best && cfg.mission.indexOf(best.t.id) < 0) {
      l2 = '<span class="mut">' + L('Camera on ' + esc(best.t.name) + ': ' + f2(best.ck.dist) + ' m, ' + Math.round(best.ck.aim) + '° off centre.', 'ক্যামেরা ' + esc(best.t.name) + '-এর দিকে: ' + f2(best.ck.dist) + ' মি, কেন্দ্র থেকে ' + Math.round(best.ck.aim) + '° সরে।') + '</span>';
    } else if (best) {
      const ck = best.ck, good = ck.inRange && ck.aimed;
      l2 = '<span class="' + (good ? 'ok' : 'mut') + '">' + L('Camera on ' + esc(best.t.name), 'ক্যামেরা ' + esc(best.t.name) + '-এর দিকে') + ':</span> ' +
        '<span class="' + (ck.inRange ? 'ok' : 'bad') + '">' + f2(ck.dist) + L(' m ', ' মি ') + (ck.inRange ? '✓' : ck.dist > ck.hi ? L('too far', 'বেশি দূরে') : L('too close', 'বেশি কাছে')) + '</span> · ' +
        '<span class="' + (ck.aimed ? 'ok' : 'bad') + '">' + Math.round(ck.aim) + L('° off ', '° সরে ') + (ck.aimed ? '✓' : '') + '</span>' + (good ? ' <span class="ok">' + L('ready to capture', 'ধরার জন্য তৈরি') + '</span>' : '');
    } else l2 = '<span class="mut">' + L('Camera is not pointing at a target.', 'ক্যামেরা কোনো টার্গেটের দিকে তাক করা নেই।') + '</span>';

    cfg.mission.forEach(function (id) {
      const p = Core.findPose(cfg, id);
      if (!p) return;
      const dd = Core.dist(d.pos, p.pos);

      if (dd < 0.5) {
        const turn = Core.qAngleDeg(pose.q, p.q), ok = dd <= cfg.settings.poseTolerance && turn <= cfg.settings.aimTolerance;
        l2 += ' · <span class="' + (ok ? 'ok' : 'mut') + '">' + esc(p.name) + ': ' + Math.round(dd * 100) + L(' cm, ', ' সেমি, ') + Math.round(turn) + L('° off', '° সরে') + (ok ? ' ✓' : '') + '</span>';
      }
    });

    const from = this._driveFrom(), clear = Core.checkSegment(cfg, from.pos, d.pos).clear;
    const l3 = L('Straight move from ' + esc(from.label), esc(from.label) + ' থেকে সোজা পথ') + ': ' + (clear ? '<span class="ok">' + L('clear', 'খোলা') + '</span>' : '<span class="bad">' + L('blocked, add a waypoint at the corner first', 'আটকে আছে, আগে কোণায় একটা ওয়েপয়েন্ট বসাও') + '</span>');
    this.$('[data-h="1"]').innerHTML = l1;
    this.$('[data-h="2"]').innerHTML = l2;
    this.$('[data-h="3"]').innerHTML = l3;
    const rd = Core.readMarkers(cfg, pose);

    // Log what changes: markers coming into or out of the camera's reading, and the nearby checkpoint's level.
    const ids = rd.seen.map(function (m) { return m.id; }), prev = d.lastIds || [], self = this;
    ids.forEach(function (id) { if (prev.indexOf(id) < 0) { const m = rd.seen.filter(function (x) { return x.id === id; })[0]; self._log(L('[AR] reads ID ' + id + ' · ' + f2(m.distance) + ' m · ' + Math.round(m.offCentre) + '° off centre', '[AR] ID ' + id + ' পড়ছে · ' + f2(m.distance) + ' মি · কেন্দ্র থেকে ' + Math.round(m.offCentre) + '° সরে'), 'ar'); } });
    prev.forEach(function (id: number | null) { if (ids.indexOf(id) < 0) self._log(L('[AR] lost ID ' + id, '[AR] ID ' + id + ' আর পড়ছে না'), 'warn'); });
    d.lastIds = ids;
    const lvKey = near ? near.cp.key + ':' + near.ck.level : '';

    if (lvKey !== (d.lastLv || '')) {
      if (near && near.ck.passed) this._log(near.cp.name + L(' · passes at Lv' + near.ck.level, ' · Lv' + near.ck.level + '-এ পার হচ্ছে'), 'ok');
      else if (near && d.lastLv && d.lastLv.split(':')[0] === near.cp.key) this._log(near.cp.name + L(' · not passing', ' · পার হচ্ছে না'), 'warn');
      d.lastLv = lvKey;
    }

    this.$('[data-h="4"]').innerHTML = rd.seen.length
      ? '<span class="ok">' + L('Camera reads', 'ক্যামেরা পড়ছে') + '</span> ' + rd.seen.map(function (m) { return 'ID ' + m.id + ' (' + f2(m.distance) + L(' m)', ' মি)'); }).join(', ')
      : '<span class="mut">' + L('Camera reads no marker', 'ক্যামেরা কোনো মার্কার পড়ছে না') + (rd.missed.length ? ': ' + esc(rd.missed[0].name.split(' ')[0] + ' ' + rd.missed[0].why) : '') + '</span>';

    // The HUD keeps to two lines on a computer, cutting long lines short; hovering shows them in full.
    const hud = this.$('.hud'), full = ['1', '3', '2', '4'].map(function (k) { return self.$('[data-h="' + k + '"]').textContent; }).filter(Boolean).join('\n');
    if (hud.title !== full) hud.title = full;

    const up = this.$<HTMLButtonElement>('[data-act=driveupdate]');
    const has = this._sel >= 0 && this._route[this._sel];
    up.disabled = !has;
    // One row of buttons in full screen and on narrower desktops (the 1100px container rules in styles).
    const compact = this._narrow || !!this._fs || this.$('.viewport').clientWidth <= 1100;
    const narrow = this._narrow, moveLabel = function (n: string) { return narrow ? L('Move #' + n, '#' + n + ' আনো') : compact ? L('Move #' + n + ' here', '#' + n + ' এখানে আনো') : L('Move waypoint ' + n + ' here', 'ওয়েপয়েন্ট ' + n + ' এখানে আনো'); };
    const none = compact ? L('Move here', 'এখানে আনো') : L('Move selected here', 'বাছাই করাটা এখানে আনো'), label = has ? moveLabel(String(this._sel + 1)) : none;

    // The longest labels sit invisibly under the real one, so the button keeps its width (and the buttons
    // beside it stay put) when a waypoint is added, selected or deselected.
    up.innerHTML = '<span class="mvl"><span>' + label + '</span><span aria-hidden="true">' + moveLabel('88') + '</span><span aria-hidden="true">' + none + '</span></span><kbd>U</kbd>';
    this.$('[data-act=driveadd]').innerHTML = (compact ? L('Add waypoint', 'ওয়েপয়েন্ট বসাও') : L('Add waypoint here', 'এখানে ওয়েপয়েন্ট বসাও')) + '<kbd>Enter</kbd>';
  }

  _driveName(this: KiboNavSandbox, pose: Pose) {
    let cfg = this._config, name = null as string | null;
    cfg.checkpoints.forEach(function (cp) { if (!name && Core.checkpointCheck(cfg, cp, pose).passed) name = cp.name; });
    cfg.targets.forEach(function (t) { const ck = Core.captureCheck(cfg, t, pose); if (!name && cfg.mission.indexOf(t.id) >= 0 && ck.front && ck.inRange && ck.aimed) name = t.name + L(' capture', ' ধরা'); });

    cfg.poses.forEach(function (p) {
      if (!name && Core.dist(pose.pos, p.pos) <= cfg.settings.poseTolerance && Core.qAngleDeg(pose.q, p.q) <= cfg.settings.aimTolerance) name = p.name;
    });

    return name || L('Waypoint ', 'ওয়েপয়েন্ট ') + (this._route.filter(function (w) { return !w.via; }).length + 1);
  }

  _drivePoint(this: KiboNavSandbox) {
    let d = this._drive!, pos = Core.roundVec(d.pos, 3);
    if (!Core.isFree(this._config, pos)) pos = d.pos.slice();
    return { pos: pos, q: Core.roundVec(d.q, 4) };
  }

  _driveAdd(this: KiboNavSandbox) {
    if (!this._drive) return;
    const self = this, pt = this._drivePoint(), idx = this._sel >= 0 ? this._sel + 1 : this._route.length;
    const name = this._driveName(pt);
    this._edit(function () { self._route.splice(idx, 0, { name: name, pos: pt.pos, mode: 'custom', q: pt.q }); self._sel = idx; });
    this._select(idx, true);
    this._toast(L('Added waypoint ' + (idx + 1) + '.', 'ওয়েপয়েন্ট ' + (idx + 1) + ' বসানো হলো।'));
    this._log(L('+ waypoint ' + (idx + 1) + ' · ' + name + ' at ' + vecText(pt.pos, 2), '+ ওয়েপয়েন্ট ' + (idx + 1) + ' · ' + name + ', ' + vecText(pt.pos, 2) + '-এ'), 'ok');
    this._mark('droveWaypoint');
    this._driveHud();
  }

  _driveUpdate(this: KiboNavSandbox) {
    if (!this._drive) return;
    const i = this._sel, self = this;
    if (i < 0 || !this._route[i]) {
      const tap = !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
      this._toast(L('Select a waypoint first (' + (tap ? 'tap' : 'click') + ' it in a view or in the list).', 'আগে একটা ওয়েপয়েন্ট বাছাই করো (কোনো ভিউতে বা তালিকায় ' + (tap ? 'ট্যাপ' : 'ক্লিক') + ' করে)।'));
      return;
    }
    const pt = this._drivePoint();
    this._edit(function () { const w = self._route[i]; w.pos = pt.pos; w.q = pt.q; w.mode = 'custom'; });
    this._toast(L('Moved waypoint ' + (i + 1) + ' to ' + vecText(pt.pos) + '.', 'ওয়েপয়েন্ট ' + (i + 1) + ' সরিয়ে ' + vecText(pt.pos) + '-এ আনা হলো।'));
    this._driveHud();
  }
}
