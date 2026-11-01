/* ---------- events ---------- */
import { Core } from '../core/index.js';
import { AX } from './views.js';
import type { KiboNavSandbox } from './sandbox.js';
import { L } from '../i18n.js';
import type { WaypointMode } from '../core/types.js';

export class Events {
  // Scroll the page so the views sit in the middle of the screen (after the layout settles: Drive changes it).
  _centerViews(this: KiboNavSandbox) {
    if (this._fs) return;
    const vp = this.$('.viewport');
    const smooth = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    requestAnimationFrame(function () {
      try { vp.scrollIntoView({ block: 'center', inline: 'center', behavior: smooth ? 'smooth' : 'auto' }); } catch (e) { vp.scrollIntoView(); }
    });
  }

  _onClick(this: KiboNavSandbox, e: MouseEvent) {
    const t = (e.target as Element).closest<HTMLInputElement>('[data-act],[data-view],[data-tab],[data-lang],[data-goto],[data-goal],.wp');
    if (!t || !this._root.contains(t)) { this._closeMenus(); return; }
    if (!t.closest('.menuwrap')) this._closeMenus();
    if (t.hasAttribute('data-view')) { this._expandFrom = null; this._exitPlay(); this._setView(t.getAttribute('data-view')!); this._centerViews(); return; }
    if (t.hasAttribute('data-tab')) { this._setTab(t.getAttribute('data-tab')!); this._save(); return; }
    if (t.hasAttribute('data-lang')) { this._setLang(t.getAttribute('data-lang')!); this._save(); return; }
    if (t.hasAttribute('data-goto')) { this._closeMenus(); this._goTo(t.getAttribute('data-goto')!); return; }
    if (t.hasAttribute('data-goal')) { const gi = +t.getAttribute('data-goal')!; if (gi >= 0) this._select(gi, true); return; }
    const act = t.getAttribute('data-act');
    const card = t.closest('.wp'), i = card ? +card.getAttribute('data-i')! : -1;
    if (!act) { if (card && !(e.target as Element).closest('input,select,button')) this._select(i, false); return; }
    const self = this;

    switch (act) {
      case 'play': this._togglePlay(); this._centerViews(); break;
      case 'pause': this._pausePlay(!(this._play && this._play.paused)); break;
      case 'replay': this._replay(); this._centerViews(); break;
      // Drive only starts Drive (Play leaves it); while driving it brings a paused Drive back.
      case 'drive': if (!this._drive) this._toggleDrive(true); else if (this._ui.view !== 'split') this._viewBack(); this._centerViews(); break;
      case 'driveadd': this._driveAdd(); break;
      case 'driveupdate': this._driveUpdate(); break;
      case 'drivereset': this._driveReset(); this._centerViews(); break;
      case 'viewsmenu': this._showViews(!this._root.classList.contains('views-open')); break;
      case 'drivefine': if (this._drive) { this._drive.fine = !this._drive.fine; t.setAttribute('aria-pressed', String(this._drive.fine)); } break;
      case 'saves': this._openSaves(); break;
      case 'fullscreen': if (this._fs) this._exitFullscreen(); else this._enterFullscreen(); break;
      case 'toastclose': clearTimeout(this._toastTimer); this.$('.toast').classList.remove('on'); break;
      case 'drawer': this._setDrawer(!this._drawer); break;
      case 'closesaves': this._closeSaves(); break;
      case 'fit': { const fv = this._views[t.getAttribute('data-v')!]; fv.fitted = false; fv.touched = false; this._resizeView(fv); break; }
      case 'fit3d': this._resetViews(); this._centerViews(); break;
      case 'termtoggle': this._termAuto = false; this._setTermMin(!this._termMin); break;
      case 'goto': this._toggleMenu('goto'); break;
      case 'more': this._toggleMenu('more'); break;
      case 'add': this._addWaypoint(); break;
      case 'fixall': this._fixAll(); break;
      case 'undo': this._doUndo(); break;
      case 'example': this._edit(function () { self._route = Core.starterRoute(self._config); self._sel = -1; }, { reason: 'example' }); this._toast(L('Loaded the starter route: waypoint 1 is a worked example that passes its goal; the next three are rough on purpose. Press Play to see what the camera reads at each, fix them with the Mission list, then add the rest yourself.', 'শুরুর রুট আনা হয়েছে: ওয়েপয়েন্ট 1 একটা করে দেখানো উদাহরণ, যেটা নিজের লক্ষ্য পূরণ করে; পরের তিনটা ইচ্ছে করেই কাঁচা রাখা। প্রতিটায় ক্যামেরা কী পড়ে, দেখতে ‘চালাও’ চাপো; মিশনের তালিকা দেখে সেগুলো ঠিক করো, তারপর বাকিগুলো নিজে যোগ করো।')); break;
      case 'copyread': this._copy(JSON.stringify(this._readingJson(), null, 2)); break;
      case 'pipopen': this._expandView('cam'); break;
      case 'maxview': this._expandView(t.getAttribute('data-v')!); break;
      case 'viewback': this._viewBack(); break;
      case 'mapopen': this._setView('top'); break;
      case 'piphide': this._ui.pip = false; this._save(); this._drawInsets(); break;
      case 'pipshow': this._ui.pip = true; this._save(); this._drawInsets(); break;
      case 'clear': this._edit(function () { self._route = []; self._sel = -1; }); break;
      case 'up': this._move(i, -1); break;
      case 'down': this._move(i, 1); break;
      case 'del': this._edit(function () { self._route.splice(i, 1); self._sel = Math.min(i, self._route.length - 1); }); break;
      case 'around': this._routeAround(+t.getAttribute('data-i')!); break;
      case 'hint': this._toggleHint(+t.getAttribute('data-i')!); break;
      case 'copycode': this._copy(this.$('pre.code').textContent); this._mark('exportedJava'); break;
      case 'newcps': this._newCheckpoints(); break;
      case 'samplecps': this._sampleCheckpoints(); break;
      case 'copyjson': this._copy(JSON.stringify(this._route, null, 2)); break;
      case 'copyworld': this._copy(JSON.stringify(this._config, null, 2)); break;
      case 'applyjson': this._applyJson(); break;
      case 'resetworld': this._config = Core.copy(this._base); this._configFromStore = false; this._afterConfig(); this._toast(L('World reset to defaults.', 'ওয়ার্ল্ড শুরুর মানে ফেরানো হয়েছে।')); break;
      case 'addkoz': this._addKoz(); break;
      case 'delkoz': this._config.koz.splice(+t.getAttribute('data-k')!, 1); this._afterConfig(); break;
      case 'savenew': this._saveNamed(); break;
      case 'loadsave': this._loadNamed(+t.getAttribute('data-k')!); break;
      case 'delsave': this._saves.splice(+t.getAttribute('data-k')!, 1); this._save(); this._renderSaves(); break;
      case 'exportfile': this._exportFile(); break;
      case 'importfile': this.$('input[type=file]').click(); break;
      case 'wipe': this._wipe(t); break;
    }
  }

  _onFocusIn(this: KiboNavSandbox, e: FocusEvent) {
    const card = (e.target as Element).closest && (e.target as Element).closest('.wp');
    if (card && (e.target as Element).matches('input,select')) {
      const i = +card.getAttribute('data-i')!;
      if (i !== this._sel) this._select(i, false);
      this._pendingUndo = JSON.stringify(this._route);
    }
  }

  _onInput(this: KiboNavSandbox, e: Event) {
    const t = e.target as HTMLInputElement, card = t.closest('.wp');
    if (!card || !t.hasAttribute('data-f')) return;
    const i = +card.getAttribute('data-i')!, w = this._route[i], f = t.getAttribute('data-f')!;
    if (!w) return;
    if (f === 'name') { w.name = t.value; return; }
    const m = /^(x|y|z|q0|q1|q2|q3)$/.exec(f);
    if (!m) return;
    const v = parseFloat(t.value);
    if (!isFinite(v)) return;

    if (f.charAt(0) === 'q') { w.q = w.q || [0, 0, 0, 1]; w.q[+f.charAt(1)] = v; }
    else w.pos[AX.indexOf(f)] = v;

    this._userActed = true;
    this._refresh();
  }

  _onChange(this: KiboNavSandbox, e: Event) {
    const t = e.target as HTMLInputElement;

    if (t.getAttribute('data-f') === 'speed') {
      this._ui.playSpeed = +t.value; this._save();
      if (this._play) { this._play.mult = +t.value; this._log(L('Play speed ', 'চালানোর গতি ') + t.value + '×'); } // takes effect from the next frame
      return;
    }

    if (t.getAttribute('data-f') === 'level') { if (Core.levelFor(t.value)) this._newCheckpoints(t.value); return; }
    if (t.hasAttribute('data-s')) { this._changeSetting(t); return; }
    if (t.hasAttribute('data-kf')) { this._changeKoz(t); return; }
    const card = t.closest('.wp');
    if (!card) return;
    const i = +card.getAttribute('data-i')!, w = this._route[i], f = t.getAttribute('data-f')!;
    if (!w) return;

    if (f === 'mode') {
      const before = JSON.stringify(this._route), mode = t.value as WaypointMode;
      if (mode === 'custom' && !w.q) w.q = Core.roundVec(this._analysis.poses[i].q, 4);
      if (mode === 'target' && !Core.findTarget(this._config, w.target)) w.target = this._nearestTarget(w.pos);
      w.mode = mode;
      this._pushUndo(before);
      this._userActed = true;
      this._commit({});
      return;
    }

    if (f === 'target') { const b2 = JSON.stringify(this._route); w.target = t.value; this._pushUndo(b2); this._userActed = true; this._commit({}); return; }

    // Text and number fields were applied live; record undo and tidy up now.
    if (this._pendingUndo && this._pendingUndo !== JSON.stringify(this._route)) this._pushUndo(this._pendingUndo);
    this._pendingUndo = JSON.stringify(this._route);
    this._userActed = true;
    this._commit({ keepList: true });
  }

  _onKey(this: KiboNavSandbox, e: KeyboardEvent) {
    const inField = e.target && (e.target as Element).matches && (e.target as Element).matches('input,select,textarea');
    if (this._drive && !inField && this._driveKey(e, !this.$('.viewport').contains(e.target as Node))) return;
    if (e.key === 'Escape') { this._closeMenus(); this._closeSaves(); return; }
    if (inField) return;
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); this._doUndo(); return; }

    if ((e.key === 'Delete' || e.key === 'Backspace') && this._sel >= 0 && (e.target as Element).closest('.cell,.list')) {
      e.preventDefault();
      const self = this, i = this._sel;
      this._edit(function () { self._route.splice(i, 1); self._sel = Math.min(i, self._route.length - 1); });
    }
  }
}
