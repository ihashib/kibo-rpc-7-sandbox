/* ---------- rendering: panel ---------- */
import { Core } from '../core/index.js';
import { axisName, esc, f2, listText, timeText, vecText } from './format.js';
import { MILESTONES, MODE_LABELS } from './labels.js';
import { AX } from './views.js';
import type { KiboNavSandbox } from './sandbox.js';
import type { Leg, Settings } from '../core/types.js';
import { L, lang } from '../i18n.js';

export class Panel {
  _setLang(this: KiboNavSandbox, lang: string) {
    if (lang !== 'cpp') lang = 'python'; // older saves may say "java" or "ar"
    this._ui.lang = lang;
    this.$$('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang)); });
    this.$$('[data-lang-note]').forEach(function (n) { n.hidden = n.getAttribute('data-lang-note') !== lang; });
    this.$('[data-act=copycode]').textContent = lang === 'cpp' ? L('Copy C++', 'C++ কপি করো') : L('Copy Python', 'Python কপি করো');
    this.$('pre.code').textContent = this.getCode(lang);
  }

  _setTab(this: KiboNavSandbox, tab: string) {
    if (tab === 'java') tab = 'code'; // older saves
    if (['route', 'code', 'world'].indexOf(tab) < 0) tab = 'route';
    this._ui.tab = tab;
    this.$$('.tabs button').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === tab)); });
    this.$$('.pane').forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== tab; });
  }

  // 'split' (used while driving): the Camera view on the left and 3D on the right (stacked on a phone held upright).
  _setView(this: KiboNavSandbox, v: string | null) {
    if (['quad', '3d', 'top', 'side', 'end', 'cam', 'split'].indexOf(v!) < 0) v = 'quad';
    if (v === '3d' && this._no3d) v = 'top';
    if (v === 'split' && this._no3d) v = 'cam';
    this._ui.view = v;
    const vp = this.$('.viewport'), shows = function (k: string | null) { return k === v || (v === 'split' && (k === 'cam' || k === '3d')); };
    vp.classList.toggle('quad', v === 'quad');
    vp.classList.toggle('split', v === 'split');
    this.$$('.cell').forEach(function (c) { c.classList.toggle('on', shows(c.getAttribute('data-cell'))); });
    this.$$('.views button').forEach(function (b) { b.setAttribute('aria-pressed', String(shows(b.getAttribute('data-view')))); });
    // The view button on a phone held upright names the current view.
    this.$('.viewsbtn .vlbl').textContent = ({ quad: L('All', 'সব'), '3d': '3D', top: L('Top', 'ওপর'), side: L('Side', 'পাশ'), end: L('End', 'মাথা'), cam: L('Camera', 'ক্যামেরা'), split: L('Camera + 3D', 'ক্যামেরা + 3D') } as Record<string, string>)[v!];
    if (shows('cam')) { this._camInfoKey = ''; this._resizeCam(); }
    if (shows('3d')) this._resize3d();
    this._updatePaused();
    this._drawInsets();
  }

  // One view fills the view area: the camera from Play (small camera window) or either view while driving.
  // Driving only works in the split view, so this pauses it; the Back button returns.
  _expandView(this: KiboNavSandbox, which: string) {
    if (this._expandFrom == null) this._expandFrom = this._ui.view;
    this._setView(which);
  }

  _viewBack(this: KiboNavSandbox) {
    const to = this._drive ? 'split' : (this._expandFrom || '3d');
    this._expandFrom = null;
    this._setView(to);
  }

  _updatePaused(this: KiboNavSandbox) {
    const paused = !!this._drive && this._ui.view !== 'split';
    if (paused && this._drive) { this._drive.keys = {}; this._drive.joy = { move: [0, 0], turn: [0, 0] }; this._drive.hold = {}; }
    this._root.classList.toggle('drive-paused', paused);

    // An expanded camera is just the picture (the reading is in the readout, or the normal Camera view).
    this._root.classList.toggle('cam-max', this._ui.view === 'cam' && (paused || this._expandFrom != null));
    const b = this.$('.backbtn');

    if (b) {
      b.hidden = !(paused || this._expandFrom != null);
      b.textContent = paused ? L('⤡ Back to driving', '⤡ আবার ড্রাইভে') : L('⤡ Back', '⤡ ফিরে যাও');
    }

    this._layoutDrive();
    if (this._drive) this._driveKeysUi();
  }

  _toggleMenu(this: KiboNavSandbox, name: string) {
    const m = this.$('[data-menu=' + name + ']'), open = m.hidden;
    this._closeMenus();
    if (!open) return;

    if (name === 'goto') {
      let cfg = this._config, html = '', inMission: Record<string, number> = {};
      cfg.mission.forEach(function (id) { inMission[id] = 1; });

      cfg.mission.forEach(function (id) {
        const c = /^cp/.test(id) && Core.findCheckpoint(cfg, id);
        if (c) html += '<button data-goto="' + esc(id) + '">' + esc(c.name) + (c.id === cfg.goal ? L(' (goal)', ' (গোল)') : '') + '<small>' + L('Adds a rough pose near it for you to fix', 'এর কাছে একটা কাঁচা পোজ বসাবে, তুমি ঠিক করে নেবে') + '</small></button>';
      });

      // Markers only when the mission asks to capture them (older worlds).
      cfg.targets.forEach(function (t) {
        if (!inMission[t.id] && cfg.checkpoints.length) return;
        html += '<button data-goto="' + esc(t.id) + '">' + esc(t.name) + '<small>' + L('Adds a rough pose in front of it for you to fix', 'এর সামনে একটা কাঁচা পোজ বসাবে, তুমি ঠিক করে নেবে') + '</small></button>';
      });

      if (cfg.poses.length) html += '<div class="sep"></div>';
      cfg.poses.forEach(function (p) { html += '<button data-goto="' + esc(p.id) + '">' + esc(p.name) + '<small>' + L('Adds a rough pose near it for you to fix', 'এর কাছে একটা কাঁচা পোজ বসাবে, তুমি ঠিক করে নেবে') + '</small></button>'; });
      html += '<div class="sep"></div><button data-goto="start">' + esc(cfg.start.name) + '<small>' + L('Back to the start', 'শুরুর জায়গায় ফেরো') + '</small></button>';
      m.innerHTML = html;
    }

    m.hidden = false;
  }

  _closeMenus(this: KiboNavSandbox) {
    this.$$('.menu').forEach(function (m) { m.hidden = true; });
    this._showViews(false);
  }

  // Phone held upright: the view buttons fold into one button, and open as a dropdown under the header.
  _showViews(this: KiboNavSandbox, open: boolean) {
    if (!this._root) return;
    this._root.classList.toggle('views-open', open);
    this.$('.viewsbtn').setAttribute('aria-expanded', String(open));
  }

  _legHtml(this: KiboNavSandbox, l: Leg) {
    const from = l.index === 0 ? this._config.start.name : String(l.index);
    const info = from + ' → ' + (l.index + 1) + ': ' + f2(l.dist) + L(' m', ' মি') + (l.turn > 0.5 ? L(', turn ', ', ঘোরা ') + Math.round(l.turn) + '°' : '') + ', ' + timeText(l.time);
    if (l.clear) return '<div class="leg" data-leg="' + l.index + '"><span>' + info + '</span><span class="st">' + L('clear', 'খোলা') + '</span></div>';
    const open = !!this._hints[l.index];

    return '<div class="leg bad" data-leg="' + l.index + '"><span>' + info + '</span><span class="st">' + L('blocked', 'আটকে আছে') + '</span>' +
      '<span>' + L('at the X ', 'X চিহ্নে ') + vecText(l.hit!, 2) + ', ' + esc(Core.whyText({ why: l.why, zone: l.zone })) + '</span>' +
      '<button class="btn small" data-act="hint" data-i="' + l.index + '" aria-expanded="' + open + '">' + (open ? L('Hide hint', 'ইঙ্গিত লুকাও') : L('Hint', 'ইঙ্গিত')) + '</button>' +
      '<button class="btn small" data-act="around" data-i="' + l.index + '" data-guided>' + L('Route around it', 'ঘুরে যাওয়ার পথ বানাও') + '</button>' +
      (open ? '<div class="hint">' + esc(Core.blockHint(this._config, this._route, l.index, this._analysis)) + '</div>' : '') + '</div>';
  }

  _qresText(this: KiboNavSandbox, i: number) {
    let p = this._analysis.poses[i], w = this._route[i], d = Core.cameraDir(p.q), t;
    const yp = Core.yawPitchFromQ(p.q);

    let s = 'q [' + p.q.map(function (n) { return Core.fmt(n, 4); }).join(', ') + ']' + L(' · camera ', ' · ক্যামেরা ') + axisName(d) +
      L(' · heading ', ' · হেডিং ') + Math.round(yp.yaw) + L('°, pitch ', '°, পিচ ') + Math.round(yp.pitch) + L('°, roll ', '°, রোল ') + Math.round(yp.roll) + '°';

    if (w.mode === 'target' && (t = Core.findTarget(this._config, w.target))) s += ' · ' + L(f2(Core.dist(p.pos, Core.targetCenter(t))) + ' m from ' + t.name, t.name + ' থেকে ' + f2(Core.dist(p.pos, Core.targetCenter(t))) + ' মি');
    return esc(s);
  }

  _renderList(this: KiboNavSandbox) {
    if (!this._built) return;
    const list = this.$('.list'), r = this._route, a = this._analysis, cfg = this._config, self = this, snap = cfg.settings.snap || 0.01;

    if (!r.length) {
      list.innerHTML = '<div class="empty">' + L('The robot starts at the ' + esc(cfg.start.name) + '. Press <b>Drive</b> to fly the robot and drop waypoints, or <b>+ Waypoint</b> (or double-click in the Top, Side or End view) and drag it. Use the mission list above to check each goal.',
        'রোবট শুরু করে ' + esc(cfg.start.name) + ' থেকে। রোবট নিজে চালিয়ে ওয়েপয়েন্ট বসাতে <b>ড্রাইভ</b> চাপো, নয়তো <b>+ ওয়েপয়েন্ট</b> চাপো (বা ওপর, পাশ কিংবা মাথার ভিউতে ডাবল-ক্লিক করো), তারপর টেনে জায়গামতো নাও। প্রতিটা লক্ষ্য মিলছে কি না, ওপরের মিশনের তালিকায় দেখে নাও।') + '</div>';
      return;
    }

    let html = '';

    r.forEach(function (w, i) {
      html += self._legHtml(a.legs[i]);
      const st = a.legs[i].endStatus;

      html += '<div class="wp' + (w.via ? ' via' : '') + (i === self._sel ? ' sel' : '') + '" data-i="' + i + '">' +
        '<div class="wph"><span class="num">' + (i + 1) + '</span><input type="text" data-f="name" value="' + esc(w.name) + '" aria-label="' + L('Waypoint name', 'ওয়েপয়েন্টের নাম') + '">' +
        '<button class="icon" data-act="up" aria-label="' + L('Move up', 'ওপরে সরাও') + '" title="' + L('Move up', 'ওপরে সরাও') + '">↑</button><button class="icon" data-act="down" aria-label="' + L('Move down', 'নিচে সরাও') + '" title="' + L('Move down', 'নিচে সরাও') + '">↓</button><button class="icon" data-act="del" aria-label="' + L('Delete', 'মুছে ফেলো') + '" title="' + L('Delete', 'মুছে ফেলো') + '">✕</button></div>' +
        '<div class="xyz">' + AX.map(function (k, j) {
          return '<label>' + k + '<input type="number" step="' + snap + '" data-f="' + k + '" value="' + Core.round(w.pos[j], 4) + '"></label>';
        }).join('') + '</div>' +
        '<div class="ori"><select data-f="mode" aria-label="' + L('Orientation', 'দিক') + '">' + Object.keys(MODE_LABELS).map(function (m) {
          return '<option value="' + m + '"' + (w.mode === m ? ' selected' : '') + '>' + MODE_LABELS[m as keyof typeof MODE_LABELS] + '</option>';
        }).join('') + '</select>' +
        (w.mode === 'target' ? '<select data-f="target" aria-label="' + L('Target', 'টার্গেট') + '">' + cfg.targets.map(function (t) {
          return '<option value="' + esc(t.id) + '"' + (w.target === t.id ? ' selected' : '') + '>' + esc(t.name) + '</option>';
        }).join('') + '</select>' : '') + '</div>' +
        (w.mode === 'custom' ? '<div class="qin">' + ['qx', 'qy', 'qz', 'qw'].map(function (k, j) {
          return '<label>' + k + '<input type="number" step="0.01" data-f="q' + j + '" value="' + Core.round((w.q || [0, 0, 0, 1])[j], 4) + '"></label>';
        }).join('') + '</div>' : '') +
        '<div class="qres">' + self._qresText(i) + '</div>' +
        (st.free ? '' : '<div class="warnpt">' + L('This point is ' + esc(Core.whyText(st)) + '.', 'এই পয়েন্টটা ' + esc(Core.whyText(st)) + '।') + '</div>') +
        '</div>';
    });

    list.innerHTML = html;
  }

  // Update leg lines and orientation text without rebuilding inputs (keeps focus while typing).
  _updateListLive(this: KiboNavSandbox) {
    const self = this, a = this._analysis;

    this.$$('.leg[data-leg]').forEach(function (el) {
      const l = a.legs[+el.getAttribute('data-leg')!];
      if (l) el.outerHTML = self._legHtml(l);
    });

    this.$$('.wp[data-i]').forEach(function (card) {
      const i = +card.getAttribute('data-i')!;
      if (!self._route[i]) return;
      const q = card.querySelector('.qres');
      if (q) q.innerHTML = self._qresText(i);
      let st = a.legs[i].endStatus, warn = card.querySelector('.warnpt');

      if (st.free && warn) warn.remove();
      else if (!st.free) {
        if (!warn) { warn = document.createElement('div'); warn.className = 'warnpt'; card.appendChild(warn); }
        warn.textContent = L('This point is ' + Core.whyText(st) + '.', 'এই পয়েন্টটা ' + Core.whyText(st) + '।');
      }
    });
  }

  _renderMission(this: KiboNavSandbox) {
    const m = this._mission, s = this._config.settings, el = this.$('.mission');
    if (!el) return;
    el.hidden = !m.total;
    const c = this.$('.mcount');
    c.textContent = L(m.done + ' of ' + m.total + ' done', m.total + 'টার মধ্যে ' + m.done + 'টা হয়েছে');
    c.classList.toggle('all', m.complete);
    const cfg = this._config, cp0 = cfg.checkpoints[0];

    // Difficulty level, and which markers have no checkpoint in this layout (the real game picks 6 to 12 a run).
    const lvEl = this.$('.mlevel');
    lvEl.hidden = !cp0;

    if (cp0) {
      const lv = Core.levelFor(cfg.checkpoints.length), sel = this.$<HTMLSelectElement>('[data-f=level]'), other = sel.querySelector('[value=other]')!;
      other.textContent = L('Other · ', 'অন্য · ') + cfg.checkpoints.length;
      sel.value = lv ? lv.key : 'other';
      const has: Record<number, number> = {}, none: number[] = [];
      cfg.checkpoints.forEach(function (k) { has[k.id] = 1; });
      cfg.targets.forEach(function (t) { const n = Core.markerNumber(t); if (n != null && t.pos && !has[n]) none.push(n); });
      none.sort(function (a, b) { return a - b; });
      this.$('.mgap').textContent = L(cfg.checkpoints.length + ' checkpoints this run' + (none.length ? '; marker' + (none.length === 1 ? ' ' : 's ') + listText(none) + (none.length === 1 ? ' has' : ' have') + ' none' : '') + '.',
        'এই রানে ' + cfg.checkpoints.length + 'টা চেকপয়েন্ট' + (none.length ? '; ' + listText(none) + ' নম্বর মার্কারের কোনো চেকপয়েন্ট নেই' : '') + '।');
    }

    const tail = (this._guided ? L('The starter route has one worked example and three rough waypoints to fix (press Play to see what the camera reads at each); add the rest yourself (Go to… also gives rough drafts).', 'শুরুর রুটে একটা করে দেখানো উদাহরণ আর ঠিক করার জন্য তিনটা কাঁচা ওয়েপয়েন্ট আছে (প্রতিটায় ক্যামেরা কী পড়ে, দেখতে ‘চালাও’ চাপো); বাকিগুলো নিজে যোগ করো (‘যাও…’ থেকেও কাঁচা খসড়া পাবে)।')
      : L('Work out the waypoints yourself.', 'ওয়েপয়েন্টগুলো নিজেই বের করো।')) + L(' This list says what is still wrong.', ' কোথায় কী এখনো ভুল, এই তালিকা বলে দেবে।');

    if (cp0) {
      const bands = function <K extends string>(list: Array<{ level: number } & Record<K, number>>, key: K, unit: string) { return list.map(function (b) { return 'Lv' + b.level + ' ' + Core.fmt(b[key], 2) + unit; }).join(', '); }, M = L(' m', ' মি');
      const goal = Core.findCheckpoint(cfg, cfg.goal);

      const b1 = bands(cp0.scoreBands, 'radius', M), b2 = bands(cp0.centeringBands, 'angle', '°'), b3 = bands(cp0.rollBands, 'angle', '°'), tl = timeText(cfg.scoring.timeLimit);
      this.$('.mrule').textContent = L('Pass each checkpoint: stand in its sphere (' + b1 + '), keep its AR marker centred in the camera (' + b2 + ') and match its roll about the camera axis (' + b3 + '). The lowest of the three is the level. ' +
        (goal ? 'Finish at ' + goal.name + ', the goal, ' : 'Finish ') + 'within ' + tl + '. ',
        'প্রতিটা চেকপয়েন্ট পার হতে: তার গোলকের ভেতরে দাঁড়াও (' + b1 + '), AR মার্কারটা ক্যামেরার মাঝখানে রাখো (' + b2 + ') আর ক্যামেরার অক্ষ বরাবর তার রোল মেলাও (' + b3 + ')। তিনটার মধ্যে যেটা সবচেয়ে কম, সেটাই লেভেল। ' +
        'শেষ করতে হবে ' + (goal ? 'গোল ' + goal.name + '-এ, ' : '') + tl + 'ের মধ্যে। ') + tail;
    } else {
      const a = Core.fmt(s.aimTolerance, 1), lo = Core.fmt(Math.max(0, s.standoff - s.rangeTolerance), 2), hi = Core.fmt(s.standoff + s.rangeTolerance, 2);
      this.$('.mrule').textContent = L('Capture each target with the camera (+X) within ' + a + '° of its centre, ' + lo + ' to ' + hi + ' m away, on a clear route. ',
        'প্রতিটা টার্গেট ক্যামেরা (+X) দিয়ে ধরো: কেন্দ্র থেকে ' + a + '°-এর মধ্যে, ' + lo + ' থেকে ' + hi + ' মি দূর থেকে, বাধাহীন রুটে। ') + tail;
    }

    const sc = m.score, ms = this.$('.mscore');
    ms.hidden = !sc;

    if (sc) {
      const over = sc.inTime ? '' : ' <b class="bad">' + L('(over the limit)', '(সীমা পেরিয়ে গেছে)') + '</b>', ct = Core.fmt(cfg.scoring.checkTime, 1);
      ms.innerHTML = L('Estimated score <b>' + Core.fmt(sc.total, 1) + ' pt</b> = (' + Core.fmt(sc.checkpoints, 1) + ' checkpoints + ' + Core.fmt(sc.goal, 1) + ' goal) × ' +
        Core.fmt(sc.bonus, 2) + ' time bonus. Mission time about ' + timeText(sc.time) + ' of ' + timeText(sc.limit) + over + ', counting ' + ct + ' s at each checkpoint. A rough guide: the simulator\'s timing and disturbances differ.',
        'আনুমানিক স্কোর <b>' + Core.fmt(sc.total, 1) + ' পয়েন্ট</b> = (' + Core.fmt(sc.checkpoints, 1) + ' চেকপয়েন্ট + ' + Core.fmt(sc.goal, 1) + ' গোল) × ' + Core.fmt(sc.bonus, 2) +
        ' সময়ের বোনাস। মিশনের সময় মোটামুটি ' + timeText(sc.time) + ', সীমা ' + timeText(sc.limit) + over + '; প্রতিটা চেকপয়েন্টে ' + ct + ' সেকেন্ড ধরে। এটা মোটামুটি হিসাব: সিমুলেটরের সময় আর বাধাবিঘ্ন আলাদা হয়।');
    }

    // Full advice for goals the student has started and for the next one; the rest stay short.
    const next = m.goals.filter(function (g) { return !g.done; })[0];

    this.$('ul.goals').innerHTML = m.goals.map(function (g) {
      const msg = g.done || g === next || (g.index >= 0 && g.kind !== 'pose' && !/^(No waypoint|এখনো (এর কাছে )?কোনো ওয়েপয়েন্ট)/.test(g.message!)) ? g.message : L('Not started yet.', 'এখনো শুরু হয়নি।');
      return '<li class="' + (g.done ? 'done' : '') + '" data-goal="' + g.index + '"><span>' + (g.done ? '✓' : '○') + '</span><div><b>' + esc(g.name) + '</b><small>' + esc(msg) + '</small></div></li>';
    }).join('');
  }

  _renderStatus(this: KiboNavSandbox) {
    let a = this._analysis, html;

    if (!this._route.length) html = '<span class="chip ok">' + L('No moves yet', 'এখনো কোনো পথ নেই') + '</span>';
    else if (a.blocked) html = '<span class="chip bad">✕ ' + L(a.blocked + ' move' + (a.blocked === 1 ? '' : 's') + ' blocked', a.blocked + 'টা পথ আটকে আছে') + '</span>';
    else html = '<span class="chip ok">✓ ' + L('Route clear', 'রুট বাধাহীন') + '</span>';

    if (this._mission.total) html += '<span>' + L('Mission', 'মিশন') + ' <b>' + this._mission.done + '/' + this._mission.total + '</b></span>';
    html += '<span>' + L('Distance', 'দূরত্ব') + ' <b>' + f2(a.distance) + L(' m', ' মি') + '</b></span>';
    const sc = this._mission.score;

    if (sc) {
      html += '<span>' + L('Est. time', 'আনু. সময়') + ' <b' + (sc.inTime ? '' : ' class="chip bad"') + '>' + timeText(sc.time) + '</b>' + L(' of ', ' / ') + timeText(sc.limit) + '</span>';
      html += '<span>' + L('Est. score', 'আনু. স্কোর') + ' <b>' + Core.fmt(sc.total, 1) + L(' pt', ' পয়েন্ট') + '</b></span>';
    } else html += '<span>' + L('Est. time', 'আনু. সময়') + ' <b>' + timeText(a.time) + '</b></span>';

    if (this._config.oasis.length) html += '<span>' + L('In Oasis Zones', 'ওয়েসিস জোনে') + ' <b>' + f2(a.oasis) + L(' m', ' মি') + '</b>' + (a.distance > 0 ? ' (' + Math.round(100 * a.oasis / a.distance) + '%)' : '') + '</span>';

    if (this._play) html += '<span data-playinfo>' + esc((this._play.paused ? L('Paused · ', 'থেমে আছে · ') : '') + (this._play.info || '')) + '</span>';
    else if (this._playNote && this._robotPose) html += '<span class="chip ' + (this._playEnded === true ? 'ok' : 'bad') + '">' + esc(this._playNote) + '</span>';

    this.$('footer').innerHTML = html;
  }

  _renderWorld(this: KiboNavSandbox) {
    if (!this._built) return;
    const s = this._config.settings;
    this.$$<HTMLInputElement>('input[data-s]').forEach(function (inp) { inp.value = s[inp.getAttribute('data-s') as keyof Settings] as unknown as string; });
    let html = '';

    this._config.koz.forEach(function (z, k) {
      const c = Core.boxCenter(z), sz = Core.boxSize(z);
      html += '<div class="koz"><div class="wph"><input type="text" data-kf="name" data-k="' + k + '" value="' + esc(z.name) + '" aria-label="' + L('KOZ name', 'KOZ-এর নাম') + '">' +
        '<button class="icon" data-act="delkoz" data-k="' + k + '" aria-label="' + L('Delete KOZ', 'KOZ মুছে ফেলো') + '">✕</button></div>' +
        '<div class="r"><span>' + L('centre', 'কেন্দ্র') + '</span>' + [0, 1, 2].map(function (j) { return '<input type="number" step="0.05" data-kf="c' + j + '" data-k="' + k + '" value="' + Core.round(c[j], 4) + '" aria-label="' + L('centre ', 'কেন্দ্র ') + AX[j] + '">'; }).join('') + '</div>' +
        '<div class="r"><span>' + L('size', 'আকার') + '</span>' + [0, 1, 2].map(function (j) { return '<input type="number" step="0.05" min="0.01" data-kf="s' + j + '" data-k="' + k + '" value="' + Core.round(sz[j], 4) + '" aria-label="' + L('size ', 'আকার ') + AX[j] + '">'; }).join('') + '</div></div>';
    });

    this.$('.kozlist').innerHTML = html || '<p class="note">' + L('None. Add one to practise routing around an obstacle.', 'একটাও নেই। বাধা ঘুরে রুট বানানো অনুশীলন করতে একটা যোগ করো।') + '</p>';
    this._renderJson();
  }

  _renderJson(this: KiboNavSandbox) {
    const ta = this.$<HTMLTextAreaElement>('textarea.json');
    if (this.shadowRoot!.activeElement !== ta) ta.value = JSON.stringify(this._config, null, 2);
  }

  _renderSaves(this: KiboNavSandbox) {
    if (!this._built) return;
    const self = this;

    this.$('[data-autosave]').textContent = this._storageOk === false
      ? L('This browser is blocking storage, so nothing is saved automatically. Use "Download backup" to keep your work.', 'এই ব্রাউজার স্টোরেজ আটকে রেখেছে, তাই কিছুই নিজে থেকে সেভ হবে না। কাজ রেখে দিতে ‘ব্যাকআপ ডাউনলোড করো’ ব্যবহার করো।')
      : L('Your route, world and progress save automatically in this browser', 'তোমার রুট, ওয়ার্ল্ড আর অগ্রগতি এই ব্রাউজারে নিজে থেকেই সেভ হয়') + (this.id ? ' (key "' + this._key + '")' : '') + L('.', '।');

    this.$('.savelist').innerHTML = this._saves.length ? this._saves.map(function (s, k) {
      let when = '';
      // In Bangla: "21 অক্টোবর 2026, 13:50" (the sandbox's digits and a 24-hour clock; the locale's own format adds AM/PM in English)
      try {
        const d = new Date(s.savedAt), two = function (n: number) { return (n < 10 ? '0' : '') + n; };
        when = lang() === 'bn' ? d.getDate() + ' ' + d.toLocaleDateString('bn-BD', { month: 'long' }) + ' ' + d.getFullYear() + ', ' + two(d.getHours()) + ':' + two(d.getMinutes()) : d.toLocaleString();
      } catch (e) { /* keep empty */ }
      const n = Array.isArray(s.route) ? s.route.length : 0;

      return '<div class="saveitem"><div><b>' + esc(s.name) + '</b><small>' + L(n + ' waypoint' + (n === 1 ? '' : 's'), n + 'টা ওয়েপয়েন্ট') + (when ? ' · ' + esc(when) : '') + '</small></div>' +
        '<button class="btn small" data-act="loadsave" data-k="' + k + '">' + L('Load', 'লোড করো') + '</button><button class="icon" data-act="delsave" data-k="' + k + '" aria-label="' + L('Delete save', 'সেভ মুছে ফেলো') + '">✕</button></div>';
    }).join('') : '<p class="note">' + L('No saved routes yet.', 'এখনো কোনো রুট সেভ করা হয়নি।') + '</p>';

    this.$('ul.progress').innerHTML = MILESTONES.map(function (m) {
      const done = !!self._progress[m[0]];
      return '<li class="' + (done ? 'done' : '') + '"><span>' + (done ? '✓' : '○') + '</span>' + esc(m[1]) + '</li>';
    }).join('');
  }

  _toast(this: KiboNavSandbox, msg: string) {
    const t = this.$('.toast');
    if (!t) return;
    t.querySelector('.tmsg')!.textContent = msg;
    t.classList.add('on');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(function () { t.classList.remove('on'); }, Math.min(9000, 2500 + msg.length * 45));
  }

  _copy(this: KiboNavSandbox, text: string) {
    const self = this;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { self._toast(L('Copied.', 'কপি হয়েছে।')); }, function () { self._copyFallback(text); });
    } else this._copyFallback(text);
  }

  _copyFallback(this: KiboNavSandbox, text: string) {
    let ta = document.createElement('textarea'), ok = false;
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    this.shadowRoot!.appendChild(ta);
    ta.select();
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    this._toast(ok ? L('Copied.', 'কপি হয়েছে।') : L('Copy failed. Select the text and copy it yourself.', 'কপি করা গেল না। লেখাটা সিলেক্ট করে নিজে কপি করো।'));
  }
}
