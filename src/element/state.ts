/* ---------- state changes ---------- */
import { Core } from '../core/index.js';
import { storeSet } from './storage.js';
import type { KiboNavSandbox } from './sandbox.js';
import type { CommitOptions } from './types.js';

export class StateChanges {
  _pushUndo(this: KiboNavSandbox, snapshot: string) {
    if (this._undo[this._undo.length - 1] === snapshot) return;
    this._undo.push(snapshot);
    if (this._undo.length > 60) this._undo.shift();
  }

  // Change the route through fn(), with undo, save and events.
  _edit(this: KiboNavSandbox, fn: () => void, opts?: CommitOptions) {
    opts = opts || {};
    const before = JSON.stringify(this._route);
    fn();
    if (JSON.stringify(this._route) === before) { if (opts.keepList !== true) this._renderList(); return false; }
    this._pushUndo(before);
    this._userActed = true;
    this._commit(opts);
    return true;
  }

  _clearStop(this: KiboNavSandbox) {
    if (!this._playNote) return;
    this._playNote = '';
    this._robotPose = null;
  }

  _commit(this: KiboNavSandbox, opts: CommitOptions) {
    opts = opts || {};
    this._clearStop();
    this._routeEdited = true;
    if (this._hintLen !== this._route.length) { this._hints = {}; this._hintLen = this._route.length; }
    this._refresh();
    if (!opts.keepList) this._renderList();
    this._save();
    this._emitRoute();
    this._checkProgress(opts.reason || 'edit');
  }

  _emitRoute(this: KiboNavSandbox) {
    this.dispatchEvent(new CustomEvent('routechange', { detail: { route: this.getRoute(), summary: { blocked: this._analysis.blocked, distance: this._analysis.distance, time: this._analysis.time, oasis: this._analysis.oasis } }, bubbles: true, composed: true }));
  }

  _afterConfig(this: KiboNavSandbox, opts?: { silent?: boolean; world?: boolean }) {
    opts = opts || {};
    this._analysis = Core.analyzeRoute(this._config, this._route);
    this._mission = Core.missionStatus(this._config, this._route, this._analysis);
    Object.keys(this._views).forEach(function (this: KiboNavSandbox, k) { this._views[k].fitted = false; this._views[k].touched = false; }, this);
    Object.keys(this._views).forEach(function (this: KiboNavSandbox, k) { this._resizeView(this._views[k]); }, this);
    if (this._T) { this._build3dStatic(); this._fit3d(); }
    if (this._built) this._renderLegend();
    this._refresh();
    this._renderList();
    if (opts.world !== false) this._renderWorld();

    // Loading a world or a save is not an achievement: remember what is already done.
    this._lastBlocked = this._analysis.blocked;
    this._lastDone = {};
    this._mission.goals.forEach(function (this: KiboNavSandbox, g) { if (g.done) this._lastDone[g.id] = 1; }, this);

    if (!opts.silent) {
      this._save();
      this.dispatchEvent(new CustomEvent('configchange', { detail: { config: this.getConfig() }, bubbles: true, composed: true }));
    }
  }

  _refresh(this: KiboNavSandbox) {
    this._analysis = Core.analyzeRoute(this._config, this._route);
    this._mission = Core.missionStatus(this._config, this._route, this._analysis);
    if (this._analysis.legs.some(function (l) { return !l.clear && l.why === 'koz'; })) this._sawKozBlock = true;
    if (this._sel >= this._route.length) this._sel = this._route.length - 1;
    if (!this._built) return;
    this._renderStatus();
    this._renderMission();
    if (this._drive) this._driveHud();
    this.$('pre.code').textContent = this.getCode(this._ui.lang);
    this._updateListLive();
    this._drawAll();
    if (this._T) this._build3dDynamic();
  }

  _save(this: KiboNavSandbox) {
    const self = this;
    clearTimeout(this._saveTimer);

    this._saveTimer = setTimeout(function () {
      const sameAsBase = JSON.stringify(self._config) === JSON.stringify(self._base);

      self._storageOk = storeSet(self._key, {
        v: 4, app: 'kibo-nav-sandbox', route: self._route, edited: !!self._routeEdited, config: sameAsBase ? null : self._config,
        saves: self._saves, progress: self._progress, ui: self._ui
      });

      if (self._overlayOpen) self._renderSaves();
    }, 250);
  }
}
