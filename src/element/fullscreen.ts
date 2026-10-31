/* ---------- full screen (landscape on phones) ---------- */
import type { KiboNavSandbox } from './sandbox.js';
import { L } from '../i18n.js';

export class Fullscreen {
  // Real full screen where the browser allows it (and a landscape lock on phones that support it);
  // otherwise (iPhone Safari) the tool covers the page and asks to turn the phone sideways.
  _enterFullscreen(this: KiboNavSandbox) {
    const el = this._root, self = this, req = el.requestFullscreen || el.webkitRequestFullscreen;
    const touch = !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches);

    function done(real: boolean) {
      self._fs = real ? 'real' : 'pseudo';
      if (touch && !self._termMin) { self._setTermMin(true); self._termAuto = true; }
      self._applyFs();
      const o = window.screen && window.screen.orientation;

      if (real && touch && o && o.lock) o.lock('landscape').catch(function () { self._fsRotateHint(); });
      else if (touch) self._fsRotateHint();
    }

    if (!req) { done(false); return; }

    try {
      const p = req.call(el, { navigationUI: 'hide' });
      if (p && typeof p.then === 'function') p.then(function () { done(true); }, function () { done(false); });
      else done(true);
    } catch (e) { done(false); }
  }

  _fsRotateHint(this: KiboNavSandbox) {
    const self = this;
    setTimeout(function () { if (self._fs && window.innerHeight > window.innerWidth) self._toast(L('Turn your phone sideways for a bigger view. Tap Exit to leave full screen.', 'বড় করে দেখতে ফোনটা আড়াআড়ি ধরো। ফুল স্ক্রিন থেকে বেরোতে ‘বের হও’ চাপো।')); }, 300);
  }

  _exitFullscreen(this: KiboNavSandbox) {
    const real = this._fs === 'real';
    if (this._termAuto) { this._termAuto = false; this._setTermMin(false); } // collapsed only because of full screen
    this._fs = null;
    this._applyFs();
    try { const o = window.screen && window.screen.orientation; if (o && o.unlock) o.unlock(); } catch (e) { /* not locked */ }
    const d = document;

    if (real && (d.fullscreenElement || d.webkitFullscreenElement)) {
      try { const p = (d.exitFullscreen || d.webkitExitFullscreen).call(d); if (p && p.catch) p.catch(function () {}); } catch (e) { /* already out */ }
    }
  }

  // Full screen hides the panel; the Waypoints button slides it in over the views (still fully editable).
  // Also on a phone held upright (not full screen): then it covers the views, where the student is looking.
  _setDrawer(this: KiboNavSandbox, open: boolean) {
    this._drawer = !!open && (!!this._fs || !!this._narrow);
    if (this._drawer && !this._fs) this._root.style.setProperty('--dvh', Math.round(this.$('.viewport').getBoundingClientRect().height) + 'px');
    this._root.classList.toggle('drawer', this._drawer);
    const self = this;
    this.$$('[data-act=drawer]').forEach(function (b) { if (!b.classList.contains('drawerclose')) b.setAttribute('aria-pressed', String(self._drawer)); });

    if (this._drawer) {
      this._setTab('route'); this._renderList();

      // Open at the waypoint list (on one column the mission text comes first and fills the screen).
      const pane = this.$('.pane[data-pane=route]'), tb = this.$('.pane[data-pane=route] .toolbar');
      if (pane && tb && pane.scrollHeight > pane.clientHeight) pane.scrollTop += tb.getBoundingClientRect().top - pane.getBoundingClientRect().top - 6;
    }
  }

  _applyFs(this: KiboNavSandbox) {
    const on = !!this._fs, de = document.documentElement;
    this._root.classList.toggle('fs', on);
    this._root.classList.toggle('fs-pseudo', this._fs === 'pseudo');
    if (on) this.setAttribute('data-fs', ''); else this.removeAttribute('data-fs');

    // Covering the page by hand: stop it scrolling behind the tool.
    if (this._fs === 'pseudo' && this._pageOverflow == null) { this._pageOverflow = de.style.overflow; de.style.overflow = 'hidden'; }
    if (this._fs !== 'pseudo' && this._pageOverflow != null) { de.style.overflow = this._pageOverflow; this._pageOverflow = null; }
    const b = this.$('[data-act=fullscreen]');
    b.setAttribute('aria-pressed', String(on));
    b.title = on ? L('Leave full screen', 'ফুল স্ক্রিন থেকে বের হও') : L('Full screen (turns phones to landscape)', 'ফুল স্ক্রিন (ফোন আড়াআড়ি হয়ে যাবে)');
    b.querySelector('.lbl')!.textContent = on ? L('Exit full screen', 'বের হও') : L('Full screen', 'ফুল স্ক্রিন');
    if (!on) this._setDrawer(false);
    b.querySelector('path')!.setAttribute('d', on ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5');
    this._onRootResize();

    // Entering or leaving full screen starts from the framed side view again (_resize3d refits once the size settles).
    this._touched3d = false;
    const self = this;
    setTimeout(function () { self._resize3d(); }, 60);
  }

  _onCellResize(this: KiboNavSandbox, cell: Element) {
    const key = cell.getAttribute('data-cell')!;
    if (key === '3d') this._resize3d();
    else if (key === 'cam') this._resizeCam();
    else if (this._views[key]) this._resizeView(this._views[key]);
  }

  // `height` sets the views; the status bar and the panel (tabs) sit below them.
  _applyHeight(this: KiboNavSandbox) {
    let h = this.getAttribute('height');
    if (h && /^\d+(\.\d+)?$/.test(h)) h += 'px';
    if (h) this._root.style.setProperty('--vh', h); else this._root.style.removeProperty('--vh');
  }

  _applyTheme(this: KiboNavSandbox) {
    const t = (this.getAttribute('theme') || '').toLowerCase();
    const dark = t === 'dark' || (t !== 'light' && !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches));
    this._root.classList.toggle('dark', dark);
    const cs = getComputedStyle(this._root), c: Record<string, string> = {};

    ['bg', 'panel', 'fg', 'muted', 'border', 'view-bg', 'grid', 'kiz', 'oasis', 'koz', 'target', 'route', 'bad', 'wp', 'sel', 'robot', 'cam', 'ok', 'cp', 'top']
      .forEach(function (k) { c[k] = cs.getPropertyValue('--' + k).trim() || '#888'; });

    this._c = c;
    this._dark = dark;
    if (this._T) { this._build3dStatic(); this._build3dDynamic(); }
    this._drawAll();
  }

  _renderLegend(this: KiboNavSandbox) {
    const cfg = this._config;
    this.$('.legend').innerHTML = [
      ['kiz', L('Keep-In', 'কিপ-ইন')], cfg.oasis.length ? ['oasis', L('Oasis', 'ওয়েসিস')] : null, ['koz', L('Keep-Out', 'কিপ-আউট')], ['target', cfg.checkpoints.length ? L('AR marker', 'AR মার্কার') : L('Target', 'টার্গেট')],
      cfg.checkpoints.length ? ['cp', L('Checkpoint', 'চেকপয়েন্ট')] : null, cfg.checkpoints.length ? ['top', L('Robot top (+Z)', 'রোবটের ওপরের দিক (+Z)')] : null,
      ['route', L('Clear move', 'খোলা পথ')], ['bad', L('Blocked', 'আটকানো পথ')], ['wp', L('Waypoint', 'ওয়েপয়েন্ট')]
    ].filter(Boolean).map(function (p) { return '<span><i style="background:var(--' + p![0] + ')"></i>' + p![1] + '</span>'; }).join('');
  }
}
