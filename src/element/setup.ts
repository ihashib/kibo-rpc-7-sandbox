/* ---------- setup ---------- */
import { Core } from '../core/index.js';
import { centerOnLoad } from './scroll.js';
import { storeDel, storeGet, storeSet } from './storage.js';
import { CSS } from './styles.js';
import { template } from './template.js';
import { VIEWS } from './views.js';
import { L } from '../i18n.js';
import type { KiboNavSandbox } from './sandbox.js';

export class Setup {
  // The first / every element in the Shadow DOM matching `sel` (the template guarantees the parts the code asks for).
  $<T extends Element = HTMLElement>(this: KiboNavSandbox, sel: string): T { return this.shadowRoot!.querySelector(sel) as T; }
  $$<T extends Element = HTMLElement>(this: KiboNavSandbox, sel: string): T[] { return Array.prototype.slice.call(this.shadowRoot!.querySelectorAll(sel)); }

  _build(this: KiboNavSandbox) {
    this._built = true;
    const sr = this.shadowRoot || this.attachShadow({ mode: 'open' });
    sr.innerHTML = '<style>' + CSS + '</style>' + template();
    this._root = this.$('.root');
    const self = this;
    this._root.addEventListener('click', function (e) { self._onClick(e); });
    this._root.addEventListener('input', function (e) { self._onInput(e); });
    this._root.addEventListener('change', function (e) { self._onChange(e); });
    this._root.addEventListener('focusin', function (e) { self._onFocusIn(e); });
    this._root.addEventListener('keydown', function (e) { self._onKey(e); });
    this._root.addEventListener('keyup', function (e) { self._driveKeyUp(e); });
    this._setupDriveInputs();
    this.$('input[type=file]').addEventListener('change', function (e) { self._importFile((e.target as HTMLInputElement).files && (e.target as HTMLInputElement).files![0]); (e.target as HTMLInputElement).value = ''; });
    Object.keys(VIEWS).forEach(function (k) { self._setupView(k); });
    this._setTab(this._ui.tab);
    this._renderLegend();
    this._setTermMin(true); // the log starts as one line; ▴ expands it
  }

  _boot(this: KiboNavSandbox) {
    const stored = storeGet(this._key);
    this._storageOk = storeSet(this._key + ':probe', 1);
    storeDel(this._key + ':probe');

    if (stored && typeof stored === 'object') {
      this._saves = Array.isArray(stored.saves) ? stored.saves : [];
      this._progress = stored.progress && typeof stored.progress === 'object' ? stored.progress : {};
      if (stored.ui) Object.assign(this._ui, stored.ui);
      const current = stored.v >= 3;

      if (!this._configByApi && stored.config && current) {
        try { this._config = Core.normalizeWorld(stored.config); this._configFromStore = true; } catch (e) { /* ignore a bad saved world */ }
      }

      // Only restore a route the student actually changed. Older saves (v1) also stored the untouched
      // default route, which would hide later changes to the default, so they are not restored.
      // v3 is the 7th Kibo-RPC world; routes saved for the older world would be in the wrong place.
      // v4: the 4-point demo route. Routes saved before it (v3 and older) are not restored, so every
      // browser starts once on the demo; named saves and progress are kept.
      const ownRoute = stored.v >= 4 && stored.edited && Array.isArray(stored.route);

      if (!this._routeByApi && ownRoute) {
        try { this._route = Core.normalizeRoute(stored.route); this._route.forEach(function (w) { w.name = w.name.replace(/ \(rough\)$/, ''); }); } catch (e) { this._route = this._defaultRoute(); }
      } else if (!this._routeByApi) this._route = this._defaultRoute();

      this._routeFromStore = ownRoute;
      this._routeEdited = ownRoute;
    } else if (!this._routeByApi) {
      this._route = this._defaultRoute();
    }

    this._ui.playSpeed = 2; // Play always opens at 2× (a speed picked last time, like 10×, is not restored)
    this.$<HTMLSelectElement>('select[data-f=speed]').value = '2';
    this._setTab(this._ui.tab || 'route');
    this._onRootResize();
    this._setView('3d'); // always open on the 3D view (it falls back to Top if 3D cannot start)
    this._afterConfig({ silent: true });
    this._setLang(this._ui.lang);
    const url = this.getAttribute('config-url');
    if (url) this._loadConfigUrl(url, false);
    this._init3d();
    this._toggleDrive(true, true); // the sandbox opens in Drive

    // A phone held upright: the name row and the views in the middle of the screen once the page has loaded.
    const self = this;
    if (this._narrow) centerOnLoad(this, function () { const h = self.$('header').getBoundingClientRect(), v = self.$('.viewport').getBoundingClientRect(); return { top: h.top, height: v.bottom - h.top }; });
  }

  _loadConfigUrl(this: KiboNavSandbox, url: string, force?: boolean) {
    const self = this;
    if (typeof fetch !== 'function') return;

    fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (json) {
      const cfg = Core.normalizeWorld(json);
      self._base = cfg;

      // A world the student edited (saved in this browser) or one set from JS wins over the file.
      if (!force && (self._configByApi || self._configFromStore)) { self._renderWorld(); return; }
      self._config = Core.copy(cfg);
      if (!self._routeFromStore && !self._routeByApi) self._route = self._defaultRoute();
      self._afterConfig({ silent: true });
    }).catch(function (err) {
      self._toast(L('Could not load the world from ' + url + ' (' + err.message + '). Using the built-in world.', url + ' থেকে ওয়ার্ল্ড লোড করা গেল না (' + err.message + ')। ভেতরের নিজস্ব ওয়ার্ল্ডটাই ব্যবহার হচ্ছে।'));
    });
  }

  _observe(this: KiboNavSandbox) {
    const self = this;

    if (typeof ResizeObserver === 'function') {
      if (!this._ro) {
        this._ro = new ResizeObserver(function (entries) {
          entries.forEach(function (en) {
            if (en.target === self._root) self._onRootResize();
            else self._onCellResize(en.target);
          });
        });
      }

      this._ro.observe(this._root);
      this.$$('.cell').forEach(function (c) { self._ro.observe(c); });
    }

    if (window.matchMedia && !this._mq) {
      this._mq = window.matchMedia('(prefers-color-scheme: dark)');
      this._mqFn = function () { self._applyTheme(); };
    }

    if (this._mq) { try { this._mq.addEventListener('change', this._mqFn); } catch (e) { /* old Safari */ } }
  }

  _onRootResize(this: KiboNavSandbox) {
    const narrow = this._root.clientWidth < 720;
    this._root.classList.toggle('tiny', this._root.clientWidth < 380); // small phones: tighter header buttons

    if (narrow !== this._narrow) {
      this._narrow = narrow;
      this._root.classList.toggle('narrow', narrow);
      if (!narrow && this._drawer && !this._fs) this._setDrawer(false);
    }

    if (this._drive) this._layoutDrive();

    // A full-screen phone in landscape is wide but short: compact header and overlays.
    const short = !!this._fs && this._root.clientHeight < 560;
    if (short !== this._short) { this._short = short; this._root.classList.toggle('short', short); this._layoutDrive(); }
    this._applyTouchMode();
    if (this._drive) this._driveHud(); // button labels depend on the layout
  }
}
