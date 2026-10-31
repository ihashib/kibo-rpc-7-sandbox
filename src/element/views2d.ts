/* ---------- 2D orthographic views ---------- */
import { Core } from '../core/index.js';
import { AX, VIEWS } from './views.js';
import { L } from '../i18n.js';
import type { KiboNavSandbox } from './sandbox.js';
import type { Vec3 } from '../core/types.js';
import type { View2D } from './types.js';

export class Views2D {
  _setupView(this: KiboNavSandbox, key: string) {
    const cell = this.$('.cell[data-cell=' + key + ']'), canvas = cell.querySelector('canvas')!;
    const v: View2D = { key: key, def: VIEWS[key], cell: cell, canvas: canvas, ctx: canvas.getContext('2d')!, w: 0, h: 0, cx: 0, cy: 0, s: 100, fitted: false, pointers: new Map(), hover: null };
    this._views[key] = v;
    const self = this;
    canvas.addEventListener('pointerdown', function (e) { self._vDown(v, e); });
    canvas.addEventListener('pointermove', function (e) { self._vMove(v, e); });
    canvas.addEventListener('pointerup', function (e) { self._vUp(v, e); });
    canvas.addEventListener('pointercancel', function (e) { self._vUp(v, e); });
    canvas.addEventListener('pointerleave', function () { if (!v.pointers.size) { v.hover = null; self._drawView(v); } });

    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      self._zoomAt(v, e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)));
    }, { passive: false });

    canvas.addEventListener('dblclick', function (e) {
      const r = canvas.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
      if (self._hitWp(v, sx, sy, 12) < 0) self._addAt(v, sx, sy);
    });
  }

  _resizeView(this: KiboNavSandbox, v: View2D) {
    const r = v.cell.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (r.width < 2 || r.height < 2) return;
    v.w = r.width; v.h = r.height;
    v.canvas.width = Math.round(r.width * dpr); v.canvas.height = Math.round(r.height * dpr);
    v.dpr = dpr;
    if (!v.fitted || !v.touched) this._fitView(v); // follow the panel size until the student pans or zooms
    this._drawView(v);
  }

  _fitView(this: KiboNavSandbox, v: View2D) {
    const b = Core.worldBounds(this._config), d = v.def;
    const rh = Math.max(0.5, b.max[d.h] - b.min[d.h]), rv = Math.max(0.5, b.max[d.v] - b.min[d.v]);

    // Margins: caption on top, side names around the box, axis numbers along the edges.
    v.s = Math.min((v.w - 70) / (rh * 1.08), (v.h - 96) / (rv * 1.08));
    v.cx = (b.min[d.h] + b.max[d.h]) / 2;
    v.cy = (b.min[d.v] + b.max[d.v]) / 2 - 4 / v.s;
    v.fitted = true;
  }

  _toS(this: KiboNavSandbox, v: View2D, p: Vec3) { return [v.w / 2 + (p[v.def.h] - v.cx) * v.s, v.h / 2 + (p[v.def.v] - v.cy) * v.s]; }
  _toW(this: KiboNavSandbox, v: View2D, sx: number, sy: number) { return [v.cx + (sx - v.w / 2) / v.s, v.cy + (sy - v.h / 2) / v.s]; }

  _zoomAt(this: KiboNavSandbox, v: View2D, sx: number, sy: number, f: number) {
    v.touched = true;
    const before = this._toW(v, sx, sy);
    v.s = Math.max(20, Math.min(4000, v.s * f));
    const after = this._toW(v, sx, sy);
    v.cx += before[0] - after[0]; v.cy += before[1] - after[1];
    this._drawView(v);
  }

  _hitWp(this: KiboNavSandbox, v: View2D, sx: number, sy: number, r: number) {
    let best = -1, bd = r * r, self = this;

    this._route.forEach(function (w, i) {
      const s = self._toS(v, w.pos), dx = s[0] - sx, dy = s[1] - sy, d = dx * dx + dy * dy;
      if (d <= bd || (d <= bd * 1.0001 && i === self._sel)) { bd = d; best = i; }
    });

    return best;
  }

  _depthRef(this: KiboNavSandbox) {
    if (this._sel >= 0 && this._route[this._sel]) return { pos: this._route[this._sel].pos, label: L('waypoint ', 'ওয়েপয়েন্ট ') + (this._sel + 1) };
    if (this._route.length) return { pos: this._route[this._route.length - 1].pos, label: L('waypoint ', 'ওয়েপয়েন্ট ') + this._route.length };
    return { pos: this._config.start.pos, label: this._config.start.name };
  }

  _addAt(this: KiboNavSandbox, v: View2D, sx: number, sy: number) {
    const wv = this._toW(v, sx, sy), p = this._depthRef().pos.slice(), self = this;
    p[v.def.h] = wv[0]; p[v.def.v] = wv[1];
    this._addWaypoint(p.map(function (n) { return self._snap(n); }));
  }

  _vDown(this: KiboNavSandbox, v: View2D, e: PointerEvent) {
    const r = v.canvas.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    try { v.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    v.pointers.set(e.pointerId, [sx, sy]);
    this._closeMenus();

    if (v.pointers.size === 2) {
      const pts = Array.from(v.pointers.values());
      if (v.drag && v.drag.moved) this._endDrag(v);
      v.drag = null;
      v.pinch = { d: Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]), s: v.s, mid: [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2], c: [v.cx, v.cy] };
      v.pan = null;
      return;
    }

    const hit = this._hitWp(v, sx, sy, e.pointerType === 'touch' ? 22 : 12);

    if (hit >= 0) {
      if (this._play) this._stopPlay();
      this._select(hit, true);
      const p = this._route[hit].pos, s = this._toS(v, p);
      v.drag = { i: hit, moved: false, before: JSON.stringify(this._route), off: [s[0] - sx, s[1] - sy], start: [sx, sy] };
    } else {
      v.pan = { sx: sx, sy: sy, cx: v.cx, cy: v.cy, moved: false };
    }
  }

  _vMove(this: KiboNavSandbox, v: View2D, e: PointerEvent) {
    const r = v.canvas.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    if (v.pointers.has(e.pointerId)) v.pointers.set(e.pointerId, [sx, sy]);
    v.hover = [sx, sy];

    if (v.pinch && v.pointers.size === 2) {
      const pts = Array.from(v.pointers.values());
      const d = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
      const mid = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
      v.s = Math.max(20, Math.min(4000, v.pinch.s * d / Math.max(1, v.pinch.d)));
      v.touched = true;

      // keep the world point under the starting midpoint under the current midpoint
      const wx = v.pinch.c[0] + (v.pinch.mid[0] - v.w / 2) / v.pinch.s, wy = v.pinch.c[1] + (v.pinch.mid[1] - v.h / 2) / v.pinch.s;
      v.cx = wx - (mid[0] - v.w / 2) / v.s; v.cy = wy - (mid[1] - v.h / 2) / v.s;
      this._drawView(v);
      return;
    }

    if (v.drag) {
      if (!v.drag.moved && Math.hypot(sx - v.drag.start[0], sy - v.drag.start[1]) < 3) return;
      v.drag.moved = true;
      const wv = this._toW(v, sx + v.drag.off[0], sy + v.drag.off[1]), w = this._route[v.drag.i];
      w.pos[v.def.h] = this._snap(wv[0]);
      w.pos[v.def.v] = this._snap(wv[1]);
      const card = this.$('.wp[data-i="' + v.drag.i + '"]');
      if (card) AX.forEach(function (k, j) { const inp = card.querySelector<HTMLInputElement>('input[data-f=' + k + ']'); if (inp) inp.value = Core.round(w.pos[j], 4) as unknown as string; });
      this._refresh();
      return;
    }

    if (v.pan) {
      if (Math.hypot(sx - v.pan.sx, sy - v.pan.sy) > 3) { v.pan.moved = true; v.touched = true; }
      v.cx = v.pan.cx - (sx - v.pan.sx) / v.s;
      v.cy = v.pan.cy - (sy - v.pan.sy) / v.s;
    }

    this._drawView(v);
  }

  _vUp(this: KiboNavSandbox, v: View2D, e: PointerEvent) {
    v.pointers.delete(e.pointerId);
    if (v.pinch) { if (v.pointers.size < 2) v.pinch = null; v.pan = null; return; }
    if (v.drag) { if (v.drag.moved) this._endDrag(v); v.drag = null; }

    if (v.pan) {
      if (!v.pan.moved && e.pointerType === 'touch') {
        // double tap on empty space adds a waypoint
        const now = Date.now(), last = v.lastTap;
        if (last && now - last.t < 350 && Math.hypot(last.x - v.pan.sx, last.y - v.pan.sy) < 24) { this._addAt(v, v.pan.sx, v.pan.sy); v.lastTap = null; }
        else v.lastTap = { t: now, x: v.pan.sx, y: v.pan.sy };
      }
      v.pan = null;
    }

    if (e.pointerType === 'touch') { v.hover = null; this._drawView(v); }
  }

  _endDrag(this: KiboNavSandbox, v: View2D) {
    this._pushUndo(v.drag!.before);
    this._userActed = true;
    this._commit({});
  }

  _drawAll(this: KiboNavSandbox) {
    if (!this._built) return;

    for (const k in this._views) {
      const v = this._views[k];
      if (v.w && (this._ui.view === 'quad' || this._ui.view === k)) this._drawView(v);
    }

    if (this._ui.view === 'cam' || this._ui.view === 'split') this._drawCam();
    this._drawInsets();
  }
}
