/* ---------- route actions ---------- */
import { Core } from '../core/index.js';
import type { KiboNavSandbox } from './sandbox.js';
import { L } from '../i18n.js';
import type { Target, Vec3 } from '../core/types.js';

export class RouteActions {
  _snap(this: KiboNavSandbox, v: number) {
    const s = this._config.settings.snap;
    return s > 0 ? Core.round(Math.round(v / s) * s, 4) : Core.round(v, 4);
  }

  // Short labels keep the views readable: a marker that has a checkpoint is already labelled by it.
  _targetLabel(this: KiboNavSandbox, t: Target) {
    const cfg = this._config;
    if (!t.pos || cfg.mission.indexOf(t.id) >= 0) return t.name;
    if (cfg.checkpoints.some(function (cp) { return cp.marker && Core.dist(cp.marker, t.pos!) < 0.05; })) return '';
    return t.name.split(' ')[0];
  }

  _nearestTarget(this: KiboNavSandbox, p: Vec3) {
    let best = '', bd = Infinity;
    this._config.targets.forEach(function (t) { const d = Core.dist(p, Core.targetCenter(t)); if (d < bd) { bd = d; best = t.id; } });
    return best;
  }

  _select(this: KiboNavSandbox, i: number, scroll?: boolean) {
    this._clearStop();
    this._sel = i;
    if (this._drive && this._analysis.poses[i]) this._driveTo(this._analysis.poses[i]);
    this.$$('.wp').forEach(function (c) { c.classList.toggle('sel', +c.getAttribute('data-i')! === i); });

    if (scroll) {
      const card = this.$('.wp[data-i="' + i + '"]'), list = this.$('.list'), pane = this.$('.pane[data-pane=route]');
      const box = list && list.scrollHeight > list.clientHeight + 1 ? list : pane; // two columns: the list scrolls

      if (card && box) {
        const cr = card.getBoundingClientRect(), br = box.getBoundingClientRect();
        if (cr.top < br.top || cr.bottom > br.bottom) box.scrollTop += cr.top - br.top - 40;
      }
    }

    this._drawAll();
    if (this._T) this._build3dDynamic();
  }

  _addWaypoint(this: KiboNavSandbox, at?: Vec3) {
    const self = this, cfg = this._config;
    const idx = this._sel >= 0 ? this._sel + 1 : this._route.length;
    const basePos = this._sel >= 0 ? this._route[this._sel].pos : (this._route.length ? this._route[this._route.length - 1].pos : cfg.start.pos);
    let p = at || Core.nearestFree(cfg, Core.add(basePos, [0, 0.3, 0])) || basePos;
    p = p.map(function (v) { return self._snap(v); });
    const n = this._route.filter(function (w) { return !w.via; }).length + 1;

    this._edit(function () {
      self._route.splice(idx, 0, { name: L('Waypoint ', 'ওয়েপয়েন্ট ') + n, pos: p, mode: 'keep' });
      self._sel = idx;
    });

    this._select(idx, true);
  }

  _move(this: KiboNavSandbox, i: number, d: number) {
    const j = i + d, self = this;
    if (j < 0 || j >= this._route.length) return;
    this._edit(function () { const r = self._route, tmp = r[i]; r[i] = r[j]; r[j] = tmp; self._sel = j; });
  }

  _goTo(this: KiboNavSandbox, id: string) {
    const self = this, res = Core.appendGoTo(this._config, this._route, id);
    const wp = res.route[res.route.length - 1];
    this._edit(function () { self._route = res.route; self._sel = res.route.length - 1; }, { reason: res.routed ? 'fixed' : 'edit' });
    this._select(this._route.length - 1, true);
    const what = L('a rough pose for ' + wp.name, wp.name + '-এর জন্য একটা কাঁচা পোজ'), fix = L(' It is close but not right: use the Mission list to see what to fix.', ' এটা কাছাকাছি, তবে ঠিক নয়: কী ঠিক করতে হবে, মিশনের তালিকায় দেখো।');

    if (!res.ok) this._toast(L('Added ' + what + ', but the move is blocked: ', what + ' যোগ হয়েছে, কিন্তু পথটা আটকে আছে: ') + res.message);
    else if (res.routed) this._toast(L('Added ' + what + ', with ' + res.added + ' via point' + (res.added === 1 ? '' : 's') + ' around a blocked move.', what + ' যোগ হয়েছে; আটকে থাকা পথ এড়াতে মাঝপথে আরও ' + res.added + 'টা পয়েন্ট বসেছে।') + fix);
    else this._toast(L('Added ' + what + '.', what + ' যোগ হয়েছে।') + fix);
  }

  _routeAround(this: KiboNavSandbox, i: number) {
    const self = this, res = Core.routeAround(this._config, this._route, i);
    if (!res.ok) { this._toast(L('Could not route around it: ', 'ঘুরে যাওয়ার পথ পাওয়া গেল না: ') + res.message); return; }
    this._edit(function () { self._route = res.route; }, { reason: 'fixed' });
    this._toast(L('Added ' + res.added + ' via point' + (res.added === 1 ? '' : 's') + ' to go around it.', 'ঘুরে যেতে মাঝপথে ' + res.added + 'টা পয়েন্ট বসানো হয়েছে।'));
  }

  _fixAll(this: KiboNavSandbox) {
    if (!this._analysis.blocked && this._analysis.legs.every(function (l) { return l.endStatus.free; })) { this._toast(L('Nothing to fix: every move is clear.', 'ঠিক করার কিছু নেই: সব পথই খোলা।')); return; }
    const self = this, res = Core.fixRoute(this._config, this._route);
    this._edit(function () { self._route = res.route; }, { reason: res.fixed ? 'fixed' : 'edit' });
    const left = this._analysis.blocked;
    const msg = (res.fixed ? L('Routed around ' + res.fixed + ' blocked move' + (res.fixed === 1 ? '' : 's') + '. ', 'আটকে থাকা ' + res.fixed + 'টা পথ ঘুরিয়ে দেওয়া হয়েছে। ') : '') + res.messages.join(' ');
    this._toast((msg || L('Done.', 'হয়ে গেছে।')) + (left ? L(' ' + left + ' still blocked.', ' এখনো ' + left + 'টা আটকে আছে।') : ''));
  }

  _doUndo(this: KiboNavSandbox) {
    if (!this._undo.length) { this._toast(L('Nothing to undo.', 'ফেরানোর মতো কিছু নেই।')); return; }
    this._route = JSON.parse(this._undo.pop()!);
    this._sel = Math.min(this._sel, this._route.length - 1);
    this._commit({ reason: 'undo' });
  }
}
