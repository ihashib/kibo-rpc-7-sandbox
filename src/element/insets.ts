/* ---------- small views on top of 3D: the camera picture, and in Drive the robot's position ---------- */
import { Core } from '../core/index.js';
import { f2 } from './format.js';
import { L } from '../i18n.js';
import type { KiboNavSandbox } from './sandbox.js';
import type { Pose, Vec3 } from '../core/types.js';

export class Insets {
  _sizeCanvas(this: KiboNavSandbox, cv: HTMLCanvasElement, w: number, h: number) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    cv.style.height = h + 'px';
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  _drawInsets(this: KiboNavSandbox) {
    const wrap = this.$('.insets');
    if (!wrap || !this._c) return;

    // Over 3D: the camera picture (and the position map while driving). Over the Camera view while
    // driving: just the position map.
    const view = this._ui.view, camDrive = view === 'cam' && !!this._drive;
    const cell = this.$('.cell[data-cell="' + (camDrive ? 'cam' : '3d') + '"]');
    if (wrap.parentNode !== cell) cell.appendChild(wrap);
    const r = cell.getBoundingClientRect(), quad = view === 'quad';

    // Camera and 3D side by side: both are already on screen, so no small views.
    const fits = view === 'split' ? false : camDrive ? r.width >= 300 && r.height >= 220 : (view === '3d' || quad) && !this._no3d && r.width >= 300 && r.height >= 220;
    const on = fits && this._ui.pip !== false;
    this.$('[data-inset=cam]').hidden = camDrive;
    wrap.style.display = on ? '' : 'none';
    this.$('[data-act=pipshow]').hidden = !fits || on;
    this._root.classList.toggle('insets-on', on);
    if (!on) return;
    const cfg = this._config, cam = cfg.camera, pose = this._robotNow(), rd = Core.readMarkers(cfg, pose);
    let w = this._narrow ? Math.round(Math.max(120, Math.min(170, r.width * 0.4))) : Math.round(Math.max(170, Math.min(340, r.width * (quad ? 0.46 : 0.28))));
    if (this._short) w = Math.round(Math.min(w, Math.max(110, (r.height * 0.42 - 24) * cam.width / cam.height)));
    const ch = Math.round(w * cam.height / cam.width);
    this._root.style.setProperty('--iw', w + 'px');
    const camEl = this.$('[data-inset=cam]');

    if (camDrive) {
      const mw = this._narrow ? Math.round(Math.max(120, Math.min(170, r.width * 0.4))) : Math.round(Math.max(170, Math.min(300, r.width * 0.24)));
      this._root.style.setProperty('--iw', mw + 'px');
      const me = this.$('[data-inset=map]');
      me.hidden = false;
      this._drawMiniMap(me, mw, pose);
      return;
    }

    this._paintCamera(this._sizeCanvas(camEl.querySelector('canvas')!, w, ch), 0, 0, w / cam.width, pose, rd, { small: true });
    camEl.querySelector('.ih span')!.textContent = L('Camera · ', 'ক্যামেরা · ') + (rd.seen.length ? L('reads ', 'পড়ছে ') + rd.seen.map(function (m) { return 'ID ' + m.id + ' (' + f2(m.distance) + L(' m)', ' মি)'); }).join(', ') : L('no marker read', 'কোনো মার্কার পড়ছে না'));
    const mapEl = this.$('[data-inset=map]'), showMap = !!this._drive && r.height >= ch + (this._narrow ? 200 : 260);
    mapEl.hidden = !showMap;
    if (showMap) this._drawMiniMap(mapEl, w, pose);
  }

  // The robot's position from overhead (like the Top view), with a gauge for overhead / deck.
  _drawMiniMap(this: KiboNavSandbox, el: HTMLElement, w: number, pose: Pose) {
    const cfg = this._config, c = this._c, kb = Core.kizBounds(cfg), a = this._analysis;
    const pad = 8, gw = 14, mw = w - pad * 3 - gw, sy = Math.max(0.1, kb.max[1] - kb.min[1]), k = mw / Math.max(0.1, kb.max[0] - kb.min[0]);
    const ky = k, h = Math.round(sy * ky + pad * 2); // true proportions (ky could stretch it across)
    const ctx = this._sizeCanvas(el.querySelector('canvas')!, w, h);
    const X = function (p: Vec3) { return pad + (p[0] - kb.min[0]) * k; }, Y = function (p: Vec3) { return pad + (p[1] - kb.min[1]) * ky; };
    ctx.fillStyle = c['view-bg']; ctx.fillRect(0, 0, w, h);
    cfg.kiz.forEach(function (b) { ctx.fillStyle = c.kiz; ctx.globalAlpha = 0.1; ctx.fillRect(X(b.min), Y(b.min), (b.max[0] - b.min[0]) * k, (b.max[1] - b.min[1]) * ky); ctx.globalAlpha = 1; ctx.strokeStyle = c.kiz; ctx.lineWidth = 1; ctx.strokeRect(X(b.min) + 0.5, Y(b.min) + 0.5, (b.max[0] - b.min[0]) * k, (b.max[1] - b.min[1]) * ky); });
    cfg.koz.forEach(function (b) { ctx.fillStyle = c.koz; ctx.globalAlpha = 0.45; ctx.fillRect(X(b.min), Y(b.min), (b.max[0] - b.min[0]) * k, (b.max[1] - b.min[1]) * ky); ctx.globalAlpha = 1; });
    const done: Record<string, number> = {};
    this._mission.goals.forEach(function (g) { if (g.done) done[g.id] = 1; });

    cfg.checkpoints.forEach(function (cp) {
      ctx.fillStyle = done[cp.key] ? c.ok : c.cp;
      ctx.beginPath(); ctx.arc(X(cp.pos), Y(cp.pos), 3, 0, Math.PI * 2); ctx.fill();
    });

    cfg.targets.forEach(function (t) { if (!t.pos) return; ctx.fillStyle = c.target; ctx.fillRect(X(t.pos) - 2, Y(t.pos) - 2, 4, 4); });
    ctx.strokeStyle = c.route; ctx.lineWidth = 1.5;
    a.legs.forEach(function (l) { ctx.strokeStyle = l.clear ? c.route : c.bad; ctx.beginPath(); ctx.moveTo(X(l.from), Y(l.from)); ctx.lineTo(X(l.to), Y(l.to)); ctx.stroke(); });
    this._route.forEach(function (wp) { ctx.fillStyle = wp.via ? c.robot : c.wp; ctx.beginPath(); ctx.arc(X(wp.pos), Y(wp.pos), 2.5, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = c.robot; ctx.fillRect(X(cfg.start.pos) - 3, Y(cfg.start.pos) - 3, 6, 6);

    // the robot: a dot with its camera direction
    const rx = X(pose.pos), ry = Y(pose.pos), d = Core.cameraDir(pose.q), hx = d[0] * k, hy = d[1] * ky, m = Math.hypot(hx, hy);
    if (Math.hypot(d[0], d[1]) > 0.1) { ctx.strokeStyle = c.cam; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + hx / m * 16, ry + hy / m * 16); ctx.stroke(); }
    ctx.fillStyle = c.sel; ctx.beginPath(); ctx.arc(rx, ry, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();

    // height gauge: overhead at the top, deck at the bottom
    const gx = w - pad - gw, z0 = kb.min[2], z1 = kb.max[2], t = Math.max(0, Math.min(1, (pose.pos[2] - z0) / Math.max(0.01, z1 - z0)));
    ctx.fillStyle = c.border; ctx.fillRect(gx + gw / 2 - 2, pad, 4, h - pad * 2);
    ctx.fillStyle = c.sel; ctx.fillRect(gx, pad + t * (h - pad * 2) - 2.5, gw, 5);
    ctx.fillStyle = c.muted; ctx.font = '9px system-ui,"Noto Sans Bengali",sans-serif'; ctx.textAlign = 'center';
    ctx.textBaseline = 'top'; ctx.fillText('▲', gx + gw / 2, 0);
    ctx.textBaseline = 'bottom'; ctx.fillText('▼', gx + gw / 2, h);
    el.querySelector('.ih span')!.textContent = L('Position · x ', 'অবস্থান · x ') + f2(pose.pos[0]) + '  y ' + f2(pose.pos[1]) + '  z ' + f2(pose.pos[2]) + L(' (side bar: overhead at the top, deck at the bottom)', ' (পাশের দাগ: ওপরে ছাদ, নিচে মেঝে)');
  }
}
