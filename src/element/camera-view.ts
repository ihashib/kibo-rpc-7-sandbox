/* ---------- Camera view: what the robot camera sees and what ArUco reads ---------- */
import { Core } from '../core/index.js';
import { esc, f2, vecText } from './format.js';
import { L } from '../i18n.js';
import { AX, sideName, viewLook } from './views.js';
import type { KiboNavSandbox } from './sandbox.js';
import type { Box, CameraFrame, Marker, Pose, Readings, Vec3 } from '../core/types.js';
import type { View2D } from './types.js';

export class CameraView {
  _resizeCam(this: KiboNavSandbox) {
    const cell = this.$('.cell[data-cell=cam]'), cv = cell.querySelector('canvas')!, r = cell.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (r.width < 2 || r.height < 2) return;
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    this._cam2d = { w: r.width, h: r.height, dpr: dpr, ctx: cv.getContext('2d')! };
    this._drawCam();
  }

  _camWho(this: KiboNavSandbox) {
    if (this._drive) return L('the robot (Drive)', 'রোবট (ড্রাইভ)');
    if (this._robotPose) return L('the robot (Play)', 'রোবট (চালানোর সময়)');
    if (this._sel >= 0 && this._analysis.poses[this._sel]) return L('waypoint ', 'ওয়েপয়েন্ট ') + (this._sel + 1);
    return L('the robot at the ' + this._config.start.name.toLowerCase(), this._config.start.name + '-এ রোবট');
  }

  _drawCam(this: KiboNavSandbox) {
    const cv = this._cam2d, cfg = this._config;
    if (!cv || (this._ui.view !== 'cam' && this._ui.view !== 'split') || !this._c) return;
    const ctx = cv.ctx, c = this._c, cam = cfg.camera, pose = this._robotNow(), rd = Core.readMarkers(cfg, pose);
    this._renderCamInfo(pose, rd);
    const info = this.$('.caminfo'), infoH = info ? info.offsetHeight + 16 : 0;
    ctx.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
    ctx.fillStyle = c['view-bg']; ctx.fillRect(0, 0, cv.w, cv.h);
    let top = 28, bottom = cv.h - infoH - 6;

    if (this._drive) { // keep the picture between the HUD and the drive controls
      const cr = this.$('.cell[data-cell=cam]').getBoundingClientRect(), hr = this.$('.hud').getBoundingClientRect(), dr = this.$('.dpad').getBoundingClientRect();
      if (hr.height) top = Math.max(top, hr.bottom - cr.top + 6);
      if (dr.height && !this._short) bottom = Math.min(bottom, dr.top - cr.top - 6);

      // On a narrow screen the picture is as wide as the cell: keep it clear of the Expand button.
      const mb = this.$('.cell[data-cell=cam] .maxbtn');
      if (this._narrow && mb && mb.offsetParent) bottom = Math.min(bottom, mb.getBoundingClientRect().top - cr.top - 4);
    }

    const availH = Math.max(40, bottom - top), k = Math.min((cv.w - 16) / cam.width, availH / cam.height);
    const ox = (cv.w - cam.width * k) / 2, oy = top + (availH - cam.height * k) / 2;
    this._paintCamera(ctx, ox, oy, k, pose, rd, {});
    ctx.font = '600 12px system-ui,"Noto Sans Bengali",sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = c.fg;
    if (!this._drive) ctx.fillText(L('Camera · what ' + this._camWho() + ' sees', 'ক্যামেরা · ' + this._camWho() + ' কী দেখছে') + ' (' + cam.width + ' × ' + cam.height + ')', 9, 8); // the HUD sits there while driving
    if (rd.seen.length && (this._drive || this._sel >= 0)) this._mark('readMarker');
  }

  // The inside of the module as the robot camera sees it: wall, deck and overhead panels in rack-wide bays
  // (alternating tones, farther ones dimmer), ceiling lights, a handrail along each side wall and a hatch at
  // each end. P projects camera coordinates to canvas pixels, W turns world points into camera coordinates;
  // anything behind `near` is cut off. Viewed from inside a box the faces never overlap, so no sorting is needed.
  _paintModule(this: KiboNavSandbox, ctx: CanvasRenderingContext2D, P: (pc: Vec3) => number[], W: (p: Vec3) => Vec3, near: number) {
    const kb = Core.kizBounds(this._config), lo = kb.min, hi = kb.max;
    const RACK = 1.05; // an ISS rack is about 1.05 m wide

    // A point on the face where axis `a` is `w`, at `u` and `v` along the next two axes.
    function at(a: number, w: number, u: number, v: number): Vec3 {
      const p = [0, 0, 0]; p[a] = w; p[(a + 1) % 3] = u; p[(a + 2) % 3] = v;
      return p;
    }

    // Fill a polygon (world points), cut at the near plane. Returns its mean distance, or -1 if hidden.
    function poly(pts: Vec3[], fill: string) {
      const pc: Vec3[] = [], cam = pts.map(W);
      for (let i = 0; i < cam.length; i++) {
        const a = cam[i], b = cam[(i + 1) % cam.length], ina = a[2] >= near, inb = b[2] >= near;
        if (ina) pc.push(a);
        if (ina !== inb) pc.push(Core.lerp(a, b, (near - a[2]) / (b[2] - a[2])));
      }
      if (pc.length < 3) return -1;
      ctx.fillStyle = fill; ctx.beginPath();
      pc.forEach(function (q, i) { const s = P(q); if (i) ctx.lineTo(s[0], s[1]); else ctx.moveTo(s[0], s[1]); });
      ctx.closePath(); ctx.fill();
      return pc.reduce(function (m, q) { return m + q[2]; }, 0) / pc.length;
    }

    // A wall colour, dimmer with distance.
    function shade(rgb: number[], dist: number, alt: boolean) {
      const f = Math.max(0.5, Math.min(1.15, 1.2 - 0.08 * dist)) * (alt ? 0.93 : 1);
      return 'rgb(' + rgb.map(function (c) { return Math.round(c * f); }).join(',') + ')';
    }

    // Base colours: deck (+z) darkest, overhead (-z) lightest, side walls (±y) and the end walls (±x) between.
    const COLOR: Record<string, number[]> = { '2,1': [44, 52, 66], '2,0': [86, 98, 116], '1,0': [62, 74, 90], '1,1': [58, 70, 86], '0,0': [52, 62, 78], '0,1': [52, 62, 78] };
    const xs: number[] = [];
    for (let x = lo[0]; x < hi[0] - 1e-6; x += RACK) xs.push(x);

    for (let a = 0; a < 3; a++) for (let s = 0; s < 2; s++) {
      const w = s ? hi[a] : lo[a], rgb = COLOR[a + ',' + s];

      if (a === 0) {
        // An end wall, with a hatch in the middle.
        const mid = poly([at(0, w, lo[1], lo[2]), at(0, w, hi[1], lo[2]), at(0, w, hi[1], hi[2]), at(0, w, lo[1], hi[2])], 'rgb(' + rgb.join(',') + ')');
        if (mid < 0) continue;
        const cy = (lo[1] + hi[1]) / 2, cz = (lo[2] + hi[2]) / 2, r1 = Math.min(hi[1] - lo[1], hi[2] - lo[2]) * 0.32, r2 = r1 * 0.78;
        poly([at(0, w, cy - r1, cz - r1), at(0, w, cy + r1, cz - r1), at(0, w, cy + r1, cz + r1), at(0, w, cy - r1, cz + r1)], shade([120, 132, 150], mid, false));
        poly([at(0, w, cy - r2, cz - r2), at(0, w, cy + r2, cz - r2), at(0, w, cy + r2, cz + r2), at(0, w, cy - r2, cz + r2)], shade([30, 36, 46], mid, false));
        continue;
      }

      // Deck, overhead and side walls: one bay per rack along x.
      xs.forEach(function (x0, n) {
        const x1 = Math.min(hi[0], x0 + RACK), other = a === 1 ? 2 : 1, oLo = lo[other], oHi = hi[other];
        const q = function (x: number, o: number) { const p = [0, 0, 0]; p[0] = x; p[a] = w; p[other] = o; return p; };
        const d = poly([q(x0, oLo), q(x1, oLo), q(x1, oHi), q(x0, oHi)], 'rgb(' + rgb.join(',') + ')');
        if (d < 0) return;
        poly([q(x0, oLo), q(x1, oLo), q(x1, oHi), q(x0, oHi)], shade(rgb, d, n % 2 === 1));
        const inset = Math.min(0.12, (x1 - x0) / 6);

        if (a === 2 && s === 0) {
          // Ceiling light down the middle of each bay.
          const c = (oLo + oHi) / 2, hw = Math.min(0.16, (oHi - oLo) / 6);
          poly([q(x0 + 0.28, c - hw), q(x1 - 0.28, c - hw), q(x1 - 0.28, c + hw), q(x0 + 0.28, c + hw)], 'rgba(255,246,222,' + Math.max(0.35, 0.9 - 0.06 * d).toFixed(2) + ')');
        } else if (a === 1) {
          // A rack front: a slightly darker panel with a lighter strip, and a handrail near the deck.
          const z0 = oLo + (oHi - oLo) * 0.18, z1 = oHi - (oHi - oLo) * 0.2;
          poly([q(x0 + inset, z0), q(x1 - inset, z0), q(x1 - inset, z1), q(x0 + inset, z1)], shade([rgb[0] - 8, rgb[1] - 8, rgb[2] - 6], d, n % 2 === 0));
          poly([q(x0 + inset, z0), q(x1 - inset, z0), q(x1 - inset, z0 + 0.04), q(x0 + inset, z0 + 0.04)], 'rgba(170,190,215,0.35)');
          const rz = oHi - (oHi - oLo) * 0.1;
          poly([q(x0 + 0.05, rz - 0.012), q(x1 - 0.05, rz - 0.012), q(x1 - 0.05, rz + 0.012), q(x0 + 0.05, rz + 0.012)], 'rgba(222,178,74,' + Math.max(0.35, 0.85 - 0.05 * d).toFixed(2) + ')');
        } else {
          // Deck panels.
          poly([q(x0 + inset, oLo + 0.1), q(x1 - inset, oLo + 0.1), q(x1 - inset, oHi - 0.1), q(x0 + inset, oHi - 0.1)], shade([rgb[0] + 6, rgb[1] + 6, rgb[2] + 8], d, n % 2 === 0));
        }
      });
    }

    // A soft vignette, as from a small lens.
    const cam = this._config.camera, tl = P([-cam.cx / cam.fx, -cam.cy / cam.fy, 1]), br = P([(cam.width - cam.cx) / cam.fx, (cam.height - cam.cy) / cam.fy, 1]);
    const cx = (tl[0] + br[0]) / 2, cy = (tl[1] + br[1]) / 2, rad = Math.hypot(br[0] - tl[0], br[1] - tl[1]) / 2;
    const g = ctx.createRadialGradient(cx, cy, rad * 0.45, cx, cy, rad);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = g; ctx.fillRect(tl[0], tl[1], br[0] - tl[0], br[1] - tl[1]);
  }

  // Paint the camera picture with its top-left at (ox, oy), k canvas px per image px. opts.clean draws
  // only the markers on grey (for checking the drawing with a real ArUco detector).
  _paintCamera(this: KiboNavSandbox, ctx: CanvasRenderingContext2D, ox: number, oy: number, k: number, pose: Pose, rd: Readings, opts: { clean?: boolean; small?: boolean }) {
    const cfg = this._config, cam = cfg.camera, cf = Core.cameraFrame(cfg, pose), c = this._c || {}, near = 0.03;
    function P(pc: Vec3) { const p = Core.projectPx(cam, pc); return [ox + p[0] * k, oy + p[1] * k]; }
    function W(p: Vec3) { return Core.toCamera(cf, p); }
    ctx.save();
    ctx.fillStyle = opts.clean ? '#8c8c8c' : '#3a404c'; ctx.fillRect(ox, oy, cam.width * k, cam.height * k);
    ctx.beginPath(); ctx.rect(ox, oy, cam.width * k, cam.height * k); ctx.clip();

    // A 3D line, clipped at the near plane.
    function line(a: Vec3, b: Vec3) {
      let pa = W(a), pb = W(b);
      if (pa[2] < near && pb[2] < near) return;

      if (pa[2] < near) pa = Core.lerp(pa, pb, (near - pa[2]) / (pb[2] - pa[2]));
      else if (pb[2] < near) pb = Core.lerp(pb, pa, (near - pb[2]) / (pa[2] - pb[2]));

      const s0 = P(pa), s1 = P(pb);
      ctx.beginPath(); ctx.moveTo(s0[0], s0[1]); ctx.lineTo(s1[0], s1[1]); ctx.stroke();
    }

    if (!opts.clean) {
      this._paintModule(ctx, P, W, near);

      // The module's walls (keep-in box edges) for a sense of where the camera looks.
      const kb = Core.kizBounds(cfg), B = [kb.min, kb.max];
      const v = function (i: number) { return [B[i & 1][0], B[(i >> 1) & 1][1], B[(i >> 2) & 1][2]]; };
      ctx.strokeStyle = 'rgba(200,210,230,0.35)'; ctx.lineWidth = 1.2;
      [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(function (e) { line(v(e[0]), v(e[1])); });
    }

    if (!opts.clean) {

      // Checkpoints: a small dot where the camera sees each one.
      cfg.checkpoints.forEach(function (cp) {
        const pc = W(cp.pos);
        if (pc[2] < 0.1) return;
        const s = P(pc), r = opts.small ? 2.5 : 4;
        ctx.fillStyle = c.cp || '#b4359c';
        ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, Math.PI * 2); ctx.fill();
        if (opts.small) return;
        ctx.font = '600 11px system-ui,"Noto Sans Bengali",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(cp.name, s[0], s[1] - r - 2);
      });
    }

    // The AR markers: a one-cell white margin, the black border, then the 4 x 4 bits (1 = white).
    cfg.targets.forEach(function (t) {
      const bits = Core.markerBits(t);
      if (!bits) return;
      const f = Core.markerFrame(t as Marker), h = t.size! / 2, cell = t.size! / 6;
      const back = Core.dot(t.normal, Core.sub(cf.pos, t.pos!)) <= 0;

      function quad(x0: number, y0: number, x1: number, y1: number, color: string) {
        const pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(function (m) { return W(Core.add(t.pos!, Core.add(Core.scale(f.x, m[0]), Core.scale(f.y, m[1])))); });
        if (pts.some(function (q) { return q[2] < near; })) return;
        ctx.fillStyle = color; ctx.beginPath();
        pts.forEach(function (q, i) { const s = P(q); if (i) ctx.lineTo(s[0], s[1]); else ctx.moveTo(s[0], s[1]); });
        ctx.closePath(); ctx.fill();
      }

      if (back) { quad(-h - cell, -h - cell, h + cell, h + cell, '#8a909c'); return; }
      quad(-h - cell, -h - cell, h + cell, h + cell, '#ffffff');
      quad(-h, -h, h, h, '#000000');

      for (let r = 0; r < 4; r++) for (let col = 0; col < 4; col++) {
        if (bits.charAt(r * 4 + col) !== '1') continue;
        const x0 = -h + (col + 1) * cell, y1 = h - (r + 1) * cell;
        quad(x0, y1 - cell, x0 + cell, y1, '#ffffff');
      }
    });

    if (!opts.clean) {
      // Image centre and the centring margins (10 / 20 / 30 degrees off the optical axis).
      const cx = ox + cam.cx * k, cy = oy + cam.cy * k, bands = cfg.checkpoints.length && cfg.checkpoints[0].centeringBands.length ? cfg.checkpoints[0].centeringBands : [];
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy); ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10); ctx.stroke();

      bands.forEach(function (b) {
        const r = cam.fx * k * Math.tan(b.angle * Math.PI / 180);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        if (opts.small) return;
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '10.5px system-ui,"Noto Sans Bengali",sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(Core.fmt(b.angle, 0) + '° (Lv' + b.level + ')', cx + r * 0.71 + 3, cy - r * 0.71 - 1);
      });

      // What the detector reads: outline, first corner (top-left) in red, ID, and the marker axes.
      rd.seen.forEach(function (m) {
        const t = Core.findTarget(cfg, m.target) as Marker, f = Core.markerFrame(t), axLen = t.size * 1.2;
        const pts = m.corners.map(function (p) { return [ox + p[0] * k, oy + p[1] * k]; });
        ctx.strokeStyle = '#2bd65a'; ctx.lineWidth = 2; ctx.beginPath();
        pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
        ctx.closePath(); ctx.stroke();
        ctx.fillStyle = '#ff3b3b'; ctx.fillRect(pts[0][0] - 3, pts[0][1] - 3, 6, 6);
        ([[f.x, '#ff3b3b'], [f.y, '#2bd65a'], [f.z, '#4f7bff']] as [Vec3, string][]).forEach(function (a) { ctx.strokeStyle = a[1]; ctx.lineWidth = 2; line(t.pos, Core.add(t.pos, Core.scale(a[0], axLen))); });
        ctx.font = '700 12px system-ui,"Noto Sans Bengali",sans-serif'; ctx.fillStyle = '#2bd65a'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText('id=' + m.id, Math.max.apply(null, pts.map(function (p) { return p[0]; })) + 4, Math.min.apply(null, pts.map(function (p) { return p[1]; })));
      });

      rd.missed.forEach(function (m) {
        const pts = m.corners.map(function (p) { return [ox + p[0] * k, oy + p[1] * k]; });
        ctx.strokeStyle = '#ffb02e'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.beginPath();
        pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
        ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
      });
    }

    ctx.restore();
  }

  _renderCamInfo(this: KiboNavSandbox, pose: Pose, rd: Readings) {
    const el = this.$('.caminfo'), cfg = this._config, cam = cfg.camera;
    if (!el) return;
    const v3 = function (a: number[], d: number) { return '[' + a.map(function (n) { return Core.fmt(n, d); }).join(', ') + ']'; };

    let html = '<div class="ch"><b>' + L('Read: ' + (rd.seen.length ? rd.seen.length + ' marker' + (rd.seen.length > 1 ? 's' : '') : 'no marker'), rd.seen.length ? 'পড়া গেছে: ' + rd.seen.length + 'টা মার্কার' : 'কোনো মার্কার পড়া যায়নি') + '</b>' +
      '<button class="btn small" data-act="copyread"' + (rd.seen.length ? '' : ' disabled') + '>' + L('Copy reading', 'রিডিং কপি করো') + '</button></div>';

    rd.seen.forEach(function (m) {
      const est = Core.markerFromTvec(cfg, pose, m.tvec).world, t = Core.findTarget(cfg, m.target), err = Core.dist(est, t!.pos!);
      const turned = Math.round(Math.abs(m.imageRoll)) + '°', still = Math.abs(m.imageRoll) < 0.5;
      html += '<div class="m"><b class="ok">ID ' + m.id + '</b> ' + esc(m.name) + ' · ' + f2(m.distance) + L(' m · ', ' মি · কেন্দ্র থেকে ') + Math.round(m.offCentre) + L('° off centre · looks turned ' + turned + ' ' + (still ? '' : m.imageRoll > 0 ? 'clockwise' : 'anticlockwise') + ' in the picture',
        '° সরে · ছবিতে ' + (still ? '' : m.imageRoll > 0 ? 'ঘড়ির কাঁটার দিকে ' : 'ঘড়ির কাঁটার উল্টো দিকে ') + turned + ' ঘোরানো দেখায়') + '<br>' +
        '<code>tvec ' + v3(m.tvec, 3) + ' m · rvec ' + v3(m.rvec!, 3) + '</code><br>' +
        '<code>→ marker at ' + v3(est, 3) + ' in iss_body</code> <span class="' + (err < 0.005 ? 'ok">' + L('matches its known position ✓', 'জানা অবস্থানের সঙ্গে মিলে গেছে ✓') : 'bad">' + L(f2(err) + ' m from its known position', 'জানা অবস্থান থেকে ' + f2(err) + ' মি দূরে')) + '</span></div>';
    });

    rd.missed.forEach(function (m) { html += '<div class="m"><span class="bad">' + esc(m.name.split(' ')[0]) + L(' not read:', ' পড়া যায়নি:') + '</span> ' + esc(m.why) + L('.', '।') + '</div>'; });
    if (!rd.seen.length && !rd.missed.length) html += '<div class="m">' + L('No marker in the picture. Turn the camera toward one (blue squares in the other views).', 'ছবিতে কোনো মার্কার নেই। ক্যামেরা কোনো একটার দিকে ঘোরাও (অন্য ভিউগুলোতে নীল চৌকো ঘরগুলো)।') + '</div>';
    const lens = cam.width + ' × ' + cam.height + ', fx ' + Core.fmt(cam.fx, 1) + ', fy ' + Core.fmt(cam.fy, 1), ahead = Core.fmt(cam.offset[0], 2);
    html += '<p class="note">' + L('Pinhole camera ' + lens + ', camera ' + ahead + ' m in front of the centre. The intrinsics are assumed: on the robot, use <code>/camera_main/camera_info</code>.',
      'পিনহোল ক্যামেরা ' + lens + ', ক্যামেরাটা কেন্দ্র থেকে ' + ahead + ' মি সামনে। ইন্ট্রিনসিকগুলো এখানে ধরে নেওয়া মান: আসল রোবটে <code>/camera_main/camera_info</code> থেকে নিও।') + '</p>';
    if (html === this._camInfoKey) return; // nothing changed (Drive redraws every frame)
    this._camInfoKey = html;
    el.innerHTML = html;
  }

  // The reading in OpenCV's shape, for copying.
  _readingJson(this: KiboNavSandbox) {
    const pose = this._robotNow(), rd = Core.readMarkers(this._config, pose), r = function (a: number[], d: number) { return a.map(function (n) { return Core.round(n, d); }); };
    return {
      robot: { position: r(pose.pos, 4), orientation: r(pose.q, 4) },
      ids: rd.seen.map(function (m) { return m.id; }),
      corners: rd.seen.map(function (m) { return m.corners.map(function (p) { return r(p, 1); }); }),
      rvecs: rd.seen.map(function (m) { return r(m.rvec!, 4); }),
      tvecs: rd.seen.map(function (m) { return r(m.tvec, 4); })
    };
  }

  _drawView(this: KiboNavSandbox, v: View2D) {
    if (!v.w || !this._c) return;
    const ctx = v.ctx, c = this._c, cfg = this._config, d = v.def, self = this, a = this._analysis;
    const S = function (p: Vec3) { return self._toS(v, p); };
    ctx.setTransform(v.dpr!, 0, 0, v.dpr!, 0, 0);
    ctx.fillStyle = c['view-bg']; ctx.fillRect(0, 0, v.w, v.h);

    // grid every 0.5 m (and 0.1 m when zoomed in)
    const w0 = this._toW(v, 0, 0), w1 = this._toW(v, v.w, v.h);
    ctx.font = '10.5px system-ui,"Noto Sans Bengali",sans-serif';

    [[0.1, 0.35], [0.5, 1]].forEach(function (g) {
      if (g[0] === 0.1 && v.s < 350) return;
      ctx.strokeStyle = c.grid; ctx.globalAlpha = g[1]; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = Math.ceil(w0[0] / g[0]) * g[0]; x <= w1[0]; x += g[0]) { const sx = Math.round(v.w / 2 + (x - v.cx) * v.s) + 0.5; ctx.moveTo(sx, 0); ctx.lineTo(sx, v.h); }
      for (let y = Math.ceil(w0[1] / g[0]) * g[0]; y <= w1[1]; y += g[0]) { const sy = Math.round(v.h / 2 + (y - v.cy) * v.s) + 0.5; ctx.moveTo(0, sy); ctx.lineTo(v.w, sy); }
      ctx.stroke();
    });

    ctx.globalAlpha = 1;
    ctx.fillStyle = c.muted;
    ctx.textBaseline = 'bottom'; ctx.textAlign = 'center';
    const stepL = v.s < 60 ? 1 : 0.5;
    for (let gx = Math.ceil(w0[0] / stepL) * stepL; gx <= w1[0]; gx += stepL) ctx.fillText(Core.fmt(gx, 1), v.w / 2 + (gx - v.cx) * v.s, v.h - 2);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (let gy = Math.ceil(w0[1] / stepL) * stepL; gy <= w1[1]; gy += stepL) ctx.fillText(Core.fmt(gy, 1), 3, v.h / 2 + (gy - v.cy) * v.s);

    function rect(b: Box, pad: number) {
      const p0 = S(b.min), p1 = S(b.max);
      const x = Math.min(p0[0], p1[0]) - pad * v.s, y = Math.min(p0[1], p1[1]) - pad * v.s;
      const w = Math.abs(p1[0] - p0[0]) + 2 * pad * v.s, h = Math.abs(p1[1] - p0[1]) + 2 * pad * v.s;
      return [x, y, w, h];
    }

    function box(b: Box, color: string, fillA: number, lw: number, dash?: number[], pad?: number) {
      const r = rect(b, pad || 0);
      if (r[2] <= 0 || r[3] <= 0) return r;
      if (r[2] < 3) { r[0] -= (3 - r[2]) / 2; r[2] = 3; }
      if (r[3] < 3) { r[1] -= (3 - r[3]) / 2; r[3] = 3; }
      if (fillA) { ctx.globalAlpha = fillA; ctx.fillStyle = color; ctx.fillRect(r[0], r[1], r[2], r[3]); ctx.globalAlpha = 1; }
      if (lw) { ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.setLineDash(dash || []); ctx.strokeRect(r[0] + 0.5, r[1] + 0.5, r[2], r[3]); ctx.setLineDash([]); }
      return r;
    }

    function label(text: string, x: number, y: number, color: string, align?: CanvasTextAlign) {
      ctx.font = '600 11px system-ui,"Noto Sans Bengali",sans-serif'; ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = 'top';
      ctx.fillText(text, x, y);
    }

    const cl = cfg.settings.clearance;

    cfg.kiz.forEach(function (b) {
      const r = box(b, c.kiz, 0.07, 1.5);
      box(b, c.kiz, 0, 1, [4, 4], -cl);
      if (cfg.kiz.length > 1) label(b.name, r[0] + 4, r[1] + 3, c.kiz);
    });

    // Plain names for the sides of the module, just outside the keep-in box.
    const kb = Core.kizBounds(cfg), k0 = S(kb.min), k1 = S(kb.max);
    ctx.font = '600 11.5px system-ui,"Noto Sans Bengali",sans-serif'; ctx.fillStyle = c.muted; ctx.globalAlpha = 0.9;
    const midX = (k0[0] + k1[0]) / 2, midY = (k0[1] + k1[1]) / 2, clampX = function (x: number) { return Math.max(46, Math.min(v.w - 46, x)); }, clampY = function (y: number) { return Math.max(30, Math.min(v.h - 22, y)); };
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('↑ ' + sideName(cfg, '-' + AX[d.v]), clampX(midX), clampY(k0[1] - 18)); // clear of marker labels on the wall
    ctx.textBaseline = 'top'; ctx.fillText('↓ ' + sideName(cfg, '+' + AX[d.v]), clampX(midX), clampY(k1[1] + 16));
    ctx.save(); ctx.translate(Math.max(14, k0[0] - 16), clampY(midY)); ctx.rotate(-Math.PI / 2); ctx.textBaseline = 'bottom'; ctx.fillText('← ' + sideName(cfg, '-' + AX[d.h]), 0, 0); ctx.restore();
    ctx.save(); ctx.translate(Math.min(v.w - 14, k1[0] + 16), clampY(midY)); ctx.rotate(Math.PI / 2); ctx.textBaseline = 'bottom'; ctx.fillText(sideName(cfg, '+' + AX[d.h]) + ' →', 0, 0); ctx.restore();
    ctx.globalAlpha = 1;
    cfg.oasis.forEach(function (b) { box(b, c.oasis, 0.14, 1, [2, 3]); });

    cfg.koz.forEach(function (b) {
      const r = box(b, c.koz, 0.28, 1.5);
      box(b, c.koz, 0, 1, [4, 3], cl);
      label(b.name, r[0] + 3, r[1] + 3, c.koz);
    });

    const captured: Record<string, number> = {};
    this._mission.goals.forEach(function (g) { if (g.done) captured[g.id] = 1; });

    cfg.targets.forEach(function (t) {
      const col = captured[t.id] ? c.ok : c.target, cc = S(Core.targetCenter(t)), text = self._targetLabel(t);

      if (t.pos) { // an AR marker: a small square on its wall
        ctx.fillStyle = col; ctx.fillRect(cc[0] - 3.5, cc[1] - 3.5, 7, 7);
        if (text) label(text + (captured[t.id] ? ' ✓' : ''), cc[0] + 6, cc[1] - 13, col);
        return;
      }

      const r = box(t, col, 0.55, 2), horiz = r[2] >= r[3];
      label(text + (captured[t.id] ? ' ✓' : ''), horiz ? cc[0] : r[0] + r[2] + 4, horiz ? r[1] + r[3] + 3 : cc[1] - 6, col, horiz ? 'center' : 'left');
    });

    // checkpoints: a solid dot (green once passed) and a dashed line of sight to the marker
    cfg.checkpoints.forEach(function (cp) {
      const s0 = S(cp.pos), ok = captured[cp.key], col = ok ? c.ok : c.cp;
      ctx.strokeStyle = col; ctx.lineWidth = 1.2;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(s0[0], s0[1], 4.5, 0, Math.PI * 2); ctx.fill();

      if (cp.marker) {
        const m0 = S(cp.marker);
        ctx.globalAlpha = 0.6; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(s0[0], s0[1]); ctx.lineTo(m0[0], m0[1]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      }

      label(cp.name + (cp.id === cfg.goal ? L(' (goal)', ' (গোল)') : '') + (ok ? ' ✓' : ''), s0[0] + 6, s0[1] + 4, col);
    });

    // start and preset poses
    const sp = S(cfg.start.pos);
    ctx.fillStyle = c.robot; ctx.fillRect(sp[0] - 5, sp[1] - 5, 10, 10);
    label(cfg.start.name, sp[0] + 8, sp[1] - 6, c.muted);

    cfg.poses.forEach(function (p) {
      const s = S(p.pos);
      ctx.save(); ctx.translate(s[0], s[1]); ctx.rotate(Math.PI / 4); ctx.strokeStyle = c.sel; ctx.lineWidth = 2; ctx.strokeRect(-5, -5, 10, 10); ctx.restore();
      self._arrow2d(v, p.pos, Core.cameraDir(p.q), 20, c.sel, 1.5);
      label(p.name, s[0] + 9, s[1] + 4, c.sel);
    });

    // moves
    a.legs.forEach(function (l) {
      const p0 = S(l.from), p1 = S(l.to);
      ctx.strokeStyle = l.clear ? c.route : c.bad; ctx.lineWidth = l.clear ? 2.5 : 3; ctx.setLineDash(l.clear ? [] : [7, 4]);
      ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke(); ctx.setLineDash([]);

      if (!l.clear) {
        const h = S(l.hit!);
        ctx.strokeStyle = c.bad; ctx.lineWidth = 2.5; ctx.beginPath();
        ctx.arc(h[0], h[1], 7, 0, Math.PI * 2);
        ctx.moveTo(h[0] - 4, h[1] - 4); ctx.lineTo(h[0] + 4, h[1] + 4); ctx.moveTo(h[0] + 4, h[1] - 4); ctx.lineTo(h[0] - 4, h[1] + 4);
        ctx.stroke();
      }
    });

    // line from the selected waypoint to the target it faces
    let sw = this._route[this._sel], tt;

    if (sw && sw.mode === 'target' && (tt = Core.findTarget(cfg, sw.target))) {
      const a0 = S(sw.pos), a1 = S(Core.targetCenter(tt));
      ctx.strokeStyle = c.cam; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.stroke(); ctx.setLineDash([]);
    }

    // waypoints
    this._route.forEach(function (w, i) {
      const s = S(w.pos), sel = i === self._sel, r = w.via ? 5 : 9;
      const pose = a.poses[i];
      if (!w.via || sel) self._arrow2d(v, w.pos, Core.cameraDir(pose.q), sel ? 30 : 20, sel ? c.sel : c.wp, sel ? 2 : 1.5);
      ctx.beginPath(); ctx.arc(s[0], s[1], r + (sel ? 1 : 0), 0, Math.PI * 2);
      ctx.fillStyle = sel ? c.sel : (w.via ? c.robot : c.wp); ctx.fill();
      if (!a.legs[i].endStatus.free) { ctx.strokeStyle = c.bad; ctx.lineWidth = 2.5; ctx.stroke(); }
      if (sel) { ctx.beginPath(); ctx.arc(s[0], s[1], r + 5, 0, Math.PI * 2); ctx.strokeStyle = c.sel; ctx.lineWidth = 1.5; ctx.stroke(); }
      if (!w.via) { ctx.fillStyle = '#fff'; ctx.font = '700 10.5px system-ui,"Noto Sans Bengali",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), s[0], s[1] + 0.5); }
    });

    // while driving: the straight move a new waypoint here would make
    if (this._drive) {
      const dfrom = this._driveFrom(), dok = Core.checkSegment(cfg, dfrom.pos, this._drive.pos).clear, q0 = S(dfrom.pos), q1 = S(this._drive.pos);
      ctx.strokeStyle = dok ? c.route : c.bad; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); ctx.stroke(); ctx.setLineDash([]);
    }

    // robot
    const rp = this._robotNow(), rs = S(rp.pos), half = cfg.robot.size / 2 * v.s;
    ctx.strokeStyle = c.robot; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2]);

    if (cfg.robot.shape === 'sphere') { ctx.beginPath(); ctx.arc(rs[0], rs[1], half, 0, Math.PI * 2); ctx.stroke(); }
    else ctx.strokeRect(rs[0] - half, rs[1] - half, half * 2, half * 2);

    ctx.setLineDash([]);
    this._arrow2d(v, rp.pos, Core.cameraDir(rp.q), Math.max(26, half * 1.6), c.cam, 2.5);

    // caption and pointer readout
    const cap = d.name + ' · ' + viewLook(cfg, d);
    ctx.font = '600 12px system-ui,"Noto Sans Bengali",sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const tw = ctx.measureText(cap).width;
    ctx.globalAlpha = 0.85; ctx.fillStyle = c['view-bg']; ctx.fillRect(4, 4, tw + 10, 18); ctx.globalAlpha = 1;
    ctx.fillStyle = c.fg; ctx.fillText(cap, 9, 7);

    // Axis gizmo (bottom right): which way the coordinates grow in this view.
    const gx = v.w - 54, gy = v.h - 58, gl = 26;
    ctx.globalAlpha = 0.85; ctx.fillStyle = c['view-bg']; ctx.fillRect(gx - 8, gy - 8, 52, 50); ctx.globalAlpha = 1;

    ([[1, 0, AX[d.h], ['#e5484d', '#30a46c', '#3e63dd'][d.h]], [0, 1, AX[d.v], ['#e5484d', '#30a46c', '#3e63dd'][d.v]]] as [number, number, string, string][]).forEach(function (a) {
      const ex = gx + a[0] * gl, ey = gy + a[1] * gl;
      ctx.strokeStyle = a[3]; ctx.fillStyle = a[3]; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex + a[0] * 5, ey + a[1] * 5); ctx.lineTo(ex - a[1] * 4, ey - a[0] * 4); ctx.lineTo(ex + a[1] * 4, ey + a[0] * 4); ctx.closePath(); ctx.fill();
      ctx.font = '700 11px system-ui,"Noto Sans Bengali",sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('+' + a[2], a[0] ? ex - 6 : ex + 6, a[0] ? ey + 11 : ey);
    });

    if (v.hover) {
      let hw = this._toW(v, v.hover[0], v.hover[1]), ref = this._depthRef(), p = ref.pos.slice();
      const dragging = v.drag && v.drag.moved;

      if (dragging) p = this._route[v.drag!.i].pos.slice();
      else { p[d.h] = hw[0]; p[d.v] = hw[1]; }

      const st = Core.pointStatus(cfg, p);

      const txt = dragging
        ? L('waypoint ', 'ওয়েপয়েন্ট ') + (v.drag!.i + 1) + ' ' + vecText(p, 3) + ' · ' + (st.free ? L('allowed', 'যাওয়া যায়') : Core.whyText(st))
        : vecText(p, 2) + ' · ' + (st.free ? L('allowed', 'যাওয়া যায়') : L('not allowed', 'যাওয়া যায় না')) + L(' (' + AX[d.d] + ' from ' + ref.label + ')', ' (' + AX[d.d] + ' নেওয়া ' + ref.label + ' থেকে)');

      ctx.font = '12px ui-monospace,Menlo,Consolas,"Noto Sans Bengali",monospace';
      const w2 = ctx.measureText(txt).width;
      const bx = Math.min(v.w - w2 - 14, Math.max(4, v.hover[0] + 14)), by = Math.min(v.h - 40, v.hover[1] + 18);
      ctx.globalAlpha = 0.92; ctx.fillStyle = c.panel; ctx.fillRect(bx, by, w2 + 10, 19); ctx.globalAlpha = 1;
      ctx.strokeStyle = st.free ? c.border : c.bad; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, w2 + 9, 18);
      ctx.fillStyle = st.free ? c.fg : c.bad; ctx.textBaseline = 'middle'; ctx.fillText(txt, bx + 5, by + 10);
    }
  }

  _arrow2d(this: KiboNavSandbox, v: View2D, pos: Vec3, dir: Vec3, lenPx: number, color: string, lw: number) {
    const d = v.def, ctx = v.ctx, s = this._toS(v, pos);
    const dx = dir[d.h], dy = dir[d.v], m = Math.hypot(dx, dy);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw;

    if (m < 0.15) {
      // pointing into or out of the screen
      ctx.beginPath(); ctx.arc(s[0], s[1], 4, 0, Math.PI * 2); ctx.stroke();

      if (dir[d.d] > 0) { ctx.beginPath(); ctx.moveTo(s[0] - 3, s[1] - 3); ctx.lineTo(s[0] + 3, s[1] + 3); ctx.moveTo(s[0] + 3, s[1] - 3); ctx.lineTo(s[0] - 3, s[1] + 3); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(s[0], s[1], 1.5, 0, Math.PI * 2); ctx.fill(); }

      return;
    }

    const len = lenPx * m, ux = dx / m, uy = dy / m, ex = s[0] + ux * len, ey = s[1] + uy * len;
    ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - ux * 7 - uy * 4, ey - uy * 7 + ux * 4); ctx.lineTo(ex - ux * 7 + uy * 4, ey - uy * 7 - ux * 4); ctx.closePath(); ctx.fill();
  }
}
