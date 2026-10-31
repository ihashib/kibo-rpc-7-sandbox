/* ---------- saves, backup, progress ---------- */
import { Core } from '../core/index.js';
import { MILESTONES, VERB } from './labels.js';
import { L } from '../i18n.js';
import { storeDel } from './storage.js';
import { VERSION } from '../version.js';
import type { KiboNavSandbox } from './sandbox.js';
import type { SavedRoute } from './types.js';

export class Saves {
  _openSaves(this: KiboNavSandbox) {
    this._overlayOpen = true;
    this.$('.overlay').hidden = false;
    this._renderSaves();

    // The tool is taller than the screen: put the dialog in the part of it that is on screen.
    const r = this._root.getBoundingClientRect(), d = this.$('.dialog'), vh = window.innerHeight || 800;
    d.style.maxHeight = Math.max(240, Math.min(vh, r.height) - 24) + 'px';
    d.style.marginTop = Math.max(0, Math.min(r.height - d.offsetHeight - 24, -r.top)) + 'px';
    try { d.scrollIntoView({ block: 'nearest' }); } catch (e) { /* old browsers */ }
    const n = this.$('input[data-f=savename]');
    if (n && !this._narrow) n.focus();
  }

  _closeSaves(this: KiboNavSandbox) { this._overlayOpen = false; this.$('.overlay').hidden = true; }

  _saveNamed(this: KiboNavSandbox) {
    const inp = this.$<HTMLInputElement>('input[data-f=savename]'), name = inp.value.trim() || (L('Save ', 'সেভ ') + (this._saves.length + 1));
    this._saves.unshift({ name: name, savedAt: new Date().toISOString(), route: Core.copy(this._route), config: Core.copy(this._config) });
    if (this._saves.length > 30) this._saves.length = 30;
    inp.value = '';
    this._save();
    this._renderSaves();
    this._toast(L('Saved "' + name + '".', '“' + name + '” সেভ হয়েছে।'));
  }

  _loadNamed(this: KiboNavSandbox, k: number) {
    const s = this._saves[k];
    if (!s) return;

    try {
      const cfg = s.config ? Core.normalizeWorld(s.config) : this._config, route = Core.normalizeRoute(s.route);
      this._pushUndo(JSON.stringify(this._route));
      this._config = cfg; this._route = route; this._sel = -1; this._routeEdited = true;
      this._afterConfig();
      this._emitRoute();
      this._closeSaves();
      this._toast(L('Loaded "' + s.name + '".', '“' + s.name + '” লোড হয়েছে।'));
    } catch (ex) { this._toast(L('That save is damaged: ', 'এই সেভটা নষ্ট হয়ে গেছে: ') + (ex as Error).message); }
  }

  _exportFile(this: KiboNavSandbox) {
    const data = { app: 'kibo-nav-sandbox', version: VERSION, exportedAt: new Date().toISOString(), route: this._route, config: this._config, saves: this._saves, progress: this._progress };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kibo-nav-sandbox-' + new Date().toISOString().slice(0, 10) + '.json';
    this.shadowRoot!.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  _importFile(this: KiboNavSandbox, file: File | null | undefined) {
    if (!file) return;
    const self = this, rd = new FileReader();

    rd.onload = function () {
      try {
        let d = JSON.parse(rd.result as string), cfg = self._config, route = null;

        if (Array.isArray(d)) route = Core.normalizeRoute(d);
        else if (d && d.kiz) cfg = Core.normalizeWorld(d);
        else if (d && typeof d === 'object') {
          if (d.config) cfg = Core.normalizeWorld(d.config);
          if (d.route) route = Core.normalizeRoute(d.route);

          if (Array.isArray(d.saves)) {
            const have: Record<string, number> = {};
            self._saves.forEach(function (s) { have[s.name + s.savedAt] = 1; });
            d.saves.forEach(function (s: SavedRoute) { if (s && s.route && !have[s.name + s.savedAt]) self._saves.push(s); });
          }

          if (d.progress && typeof d.progress === 'object') Object.keys(d.progress).forEach(function (k) { if (!self._progress[k]) self._progress[k] = d.progress[k]; });
        } else throw new Error(L('Not a KIBO RPC 7 Nav Sandbox file', 'এটা KIBO RPC 7 Nav Sandbox-এর ফাইল নয়'));

        self._pushUndo(JSON.stringify(self._route));
        self._config = cfg;
        if (route) { self._route = route; self._routeEdited = true; }
        self._sel = -1;
        self._afterConfig();
        self._emitRoute();
        self._renderSaves();
        self._toast(L('Loaded ' + file.name + '.', file.name + ' লোড হয়েছে।'));
      } catch (ex) { self._toast(L('Could not load that file: ', 'ফাইলটা লোড করা গেল না: ') + (ex as Error).message); }
    };

    rd.readAsText(file);
  }

  _wipe(this: KiboNavSandbox, btn: HTMLElement) {
    if (!btn.dataset.armed) {
      btn.dataset.armed = '1';
      btn.textContent = L('Click again to delete everything', 'সব মুছতে আবার চাপো');
      setTimeout(function () { delete btn.dataset.armed; btn.textContent = L('Delete all saved data', 'জমা থাকা সব ডেটা মুছে ফেলো'); }, 4000);
      return;
    }

    clearTimeout(this._saveTimer);
    storeDel(this._key);
    this._saves = []; this._progress = {}; this._undo = [];
    this._config = Core.copy(this._base); this._route = this._defaultRoute(); this._sel = -1;
    this._configFromStore = false;
    this._routeEdited = false;
    this._afterConfig({ silent: true });
    this._emitRoute();
    this._renderSaves();
    delete btn.dataset.armed; btn.textContent = L('Delete all saved data', 'জমা থাকা সব ডেটা মুছে ফেলো');
    this._toast(L('Deleted all saved data in this browser.', 'এই ব্রাউজারে জমা থাকা সব ডেটা মুছে ফেলা হয়েছে।'));
  }

  _mark(this: KiboNavSandbox, k: string) {
    if (this._progress[k]) return;
    this._progress[k] = new Date().toISOString();
    const m = MILESTONES.filter(function (x) { return x[0] === k; })[0];
    this._toast(L('Milestone: ', 'মাইলফলক: ') + (m ? m[1] : k) + ' ✓');
    this._save();
    if (this._overlayOpen) this._renderSaves();
  }

  _checkProgress(this: KiboNavSandbox, reason: string) {
    const a = this._analysis, r = this._route, cfg = this._config, m = this._mission, self = this;
    const prevBlocked = this._lastBlocked, prevDone = this._lastDone || {};
    this._lastBlocked = a.blocked;
    this._lastDone = {};
    m.goals.forEach(function (g) { if (g.done) self._lastDone[g.id] = 1; });
    if (!this._userActed || reason === 'example' || reason === 'undo') return;
    const fresh = m.goals.filter(function (g) { return g.done && !prevDone[g.id]; });

    if (m.complete && fresh.length) this._toast(L('Mission complete: every goal is done on a clear route' + (m.score ? ', estimated ' + Core.fmt(m.score.total, 1) + ' pt' : '') + '. Copy the code and try it in the simulator.',
      'মিশন শেষ: বাধাহীন রুটে সব লক্ষ্য পূরণ হয়েছে' + (m.score ? ', আনুমানিক ' + Core.fmt(m.score.total, 1) + ' পয়েন্ট' : '') + '। এবার কোড কপি করে সিমুলেটরে চালিয়ে দেখো।'));
    else if (fresh.length) this._toast(fresh.map(function (g) { return g.name + (g.kind === 'checkpoint' ? ' Lv' + g.level : ''); }).join(', ') + ' ' + VERB[fresh[0].kind] + ' ✓  (' + L(m.done + ' of ' + m.total, m.total + 'টার মধ্যে ' + m.done + 'টা') + ')');

    if (r.length) this._mark('firstWaypoint');
    if (r.some(function (w) { return w.mode === 'target' && Core.findTarget(cfg, w.target); })) this._mark('facedTarget');
    if (reason === 'fixed' || (prevBlocked > 0 && a.blocked < prevBlocked)) this._mark('fixedBlock');
    const targets = m.goals.filter(function (g) { return g.kind === 'target' || g.kind === 'checkpoint'; });
    if (targets.some(function (g) { return g.done; })) this._mark('firstCapture');
    if (a.blocked) return;
    if (targets.length && targets.every(function (g) { return g.done; })) this._mark('allAreas');
    if (m.complete) this._mark('astronaut');
    if (cfg.koz.length && this._sawKozBlock && targets.some(function (g) { return g.done; })) this._mark('kozPractice');
  }

  _toggleHint(this: KiboNavSandbox, i: number) {
    if (this._hints[i]) delete this._hints[i]; else this._hints[i] = 1;
    const el = this.$('.leg[data-leg="' + i + '"]'), l = this._analysis.legs[i];
    if (el && l) el.outerHTML = this._legHtml(l);
  }
}
