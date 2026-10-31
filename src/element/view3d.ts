/* ---------- 3D view (three.js r128) ---------- */
import { Core } from '../core/index.js';
import { esc } from './format.js';
import { addBallDetails } from './robots.js';
import { touchFirst } from './sticks.js';
import { ensureThree } from './three.js';
import { VIEW3D_DIR, sideName } from './views.js';
import { L, fontReady } from '../i18n.js';
import type { KiboNavSandbox } from './sandbox.js';
import type { Vec3 } from '../core/types.js';
import type { LabelTexture, SceneObject, Three, THREE } from './types.js';

/** How far one drag along the whole roll wheel rolls the module (radians). */
const ROLL_PER_WHEEL = 1.5 * Math.PI;

export class View3D {
  _init3d(this: KiboNavSandbox) {
    const self = this, msg = this.$('.msg3d');
    msg.style.display = 'flex';
    msg.textContent = L('Loading the 3D view…', '3D ভিউ লোড হচ্ছে…');

    // In Bangla the labels (drawn once into textures) wait for the Bangla font.
    Promise.all([ensureThree(), fontReady()]).then(function (res) {
      const T = res[0];
      if (!T || !T.OrbitControls) throw new Error('three.js loaded without OrbitControls');
      self._setup3d(T);
      msg.style.display = 'none';
    }).catch(function (err) {
      self._no3d = true;
      msg.style.display = 'flex';
      msg.textContent = L('The 3D view could not start (' + err.message + '). The Top, Side and End views still work.', '3D ভিউ চালু করা গেল না (' + err.message + ')। ওপর, পাশ আর মাথার ভিউ ঠিকই কাজ করবে।');
      if (self._ui.view === '3d') self._setView('top');
    });
  }

  _setup3d(this: KiboNavSandbox, T: Three) {
    const holder = this.$('.three'), self = this;
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    holder.appendChild(renderer.domElement);
    this._T = T;
    this._renderer = renderer;
    this._scene = new T.Scene();
    this._camera = new T.PerspectiveCamera(45, 1, 0.02, 200);
    this._controls = new T.OrbitControls(this._camera, renderer.domElement);

    // Touch: one finger turns around the module (a tap still picks a waypoint); two fingers are ours
    // (_setupMapTouch): pinch to zoom, drag to slide the view.
    this._controls.touches = { ONE: T.TOUCH.ROTATE, TWO: -1 };
    this._applyTouchMode();
    this._controls.screenSpacePanning = true;
    this._setupMapTouch(renderer.domElement);
    this._setupRollWheel();
    this._controls.addEventListener('change', function () { self._render3d(); });

    // Once the student moves the view, stop reframing it when the panel changes size.
    this._controls.addEventListener('start', function () { self._touched3d = true; });

    // r128 OrbitControls only zooms toward its target. Take the wheel first (capture phase on the
    // holder) and zoom toward the point under the cursor instead; pinch still goes to OrbitControls.
    holder.addEventListener('wheel', function (e) { e.preventDefault(); e.stopPropagation(); self._zoom3dAt(e); }, { capture: true, passive: false });
    this._scene.add(new T.AmbientLight(0xffffff, 0.75));
    const dl = new T.DirectionalLight(0xffffff, 0.55); dl.position.set(3, 6, 4); this._scene.add(dl);

    // three.js is y-up. Rotating +90° about x maps ISS (x, y, z) to (x, -z, y), so +z (deck) points down.
    // Rolling the module about its long (airlock - dock) axis turns this group (the roll wheel, _setupRollWheel).
    const issRoot = new T.Group(); issRoot.rotation.x = Math.PI / 2; this._scene.add(issRoot);
    this._issRoot = issRoot;
    this._iss = new T.Group(); issRoot.add(this._iss);
    this._static = new T.Group(); this._dynamic = new T.Group(); this._robot3 = new T.Group();
    this._iss.add(this._static, this._dynamic, this._robot3);

    this._geo = {
      box: new T.BoxGeometry(1, 1, 1), sphere: new T.SphereGeometry(1, 20, 14), plane: new T.PlaneGeometry(1, 1),
      cyl: new T.CylinderGeometry(1, 1, 1, 10), cone: new T.ConeGeometry(1, 1, 14)
    };

    this._mats = {};
    this._labels = {};
    this._raycaster = new T.Raycaster();
    this._camera.layers.enable(1); // the robot's own meshes sit on layer 1
    const lg = new T.BufferGeometry();
    lg.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3));
    this._driveLine3 = new T.Line(lg, new T.LineDashedMaterial({ dashSize: 0.05, gapSize: 0.04 }));
    this._driveLine3.visible = false;
    this._driveLine3.frustumCulled = false;
    this._iss.add(this._driveLine3);
    let down = null as number[] | null;
    renderer.domElement.addEventListener('pointerdown', function (e) { down = [e.clientX, e.clientY]; });

    let lastTap = null as { t: number; x: number; y: number } | null;

    renderer.domElement.addEventListener('pointerup', function (e) {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      down = null;
      self._pick3d(e);

      // Touch: a double tap puts the 3D view back to its starting angle.
      if (e.pointerType !== 'touch') return;
      const now = performance.now();
      if (lastTap && now - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
        lastTap = null;
        self._touched3d = false;
        if (self._drive) self._driveView3d(); else self._fit3d();
        self._render3d();
      } else lastTap = { t: now, x: e.clientX, y: e.clientY };
    });

    this._build3dStatic();
    this._build3dDynamic();
    this._resize3d();
    this._fit3d();
    this._drawAll(); // the camera picture can now be rendered as the station
  }

  _mat(this: KiboNavSandbox, color: string, opacity: number, kind?: string) {
    const key = color + '|' + opacity + '|' + (kind || 'basic');
    if (this._mats[key]) return this._mats[key];
    let T = this._T, m;

    if (kind === 'line') m = new T.LineBasicMaterial({ color: color, transparent: opacity < 1, opacity: opacity });
    else if (kind === 'dash') m = new T.LineDashedMaterial({ color: color, dashSize: 0.04, gapSize: 0.03 });
    else if (kind === 'lambert') m = new T.MeshLambertMaterial({ color: color, transparent: opacity < 1, opacity: opacity });
    else m = new T.MeshBasicMaterial({ color: color, transparent: opacity < 1, opacity: opacity, depthWrite: opacity >= 1, side: T.DoubleSide });

    this._mats[key] = m;
    return m;
  }

  _label3d(this: KiboNavSandbox, text: string, color: string, h: number) {
    const key = text + '|' + color;
    let T = this._T, tex = this._labels[key] as LabelTexture;

    if (!tex) {
      const cv = document.createElement('canvas'), ctx = cv.getContext('2d')!, px = 48;
      ctx.font = '600 ' + px + 'px system-ui,"Noto Sans Bengali",sans-serif';
      const w = Math.ceil(ctx.measureText(text).width) + 16;
      cv.width = w; cv.height = px + 16;
      ctx.font = '600 ' + px + 'px system-ui,"Noto Sans Bengali",sans-serif';
      ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.fillText(text, 8, cv.height / 2 + 2);
      tex = new T.CanvasTexture(cv) as unknown as LabelTexture;
      tex.userData = { aspect: w / cv.height };
      this._labels[key] = tex;
    }

    const mat = new T.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    const sp = new T.Sprite(mat);
    h = h || 0.1;
    sp.scale.set(h * tex.userData.aspect, h, 1);
    sp.userData.lh = h; sp.userData.aspect = tex.userData.aspect; // shrunk near the camera in _renderNow
    sp.renderOrder = 10;
    return sp;
  }

  // An ArUco pattern as a texture: 8 x 8 cells (white margin, black border, 4 x 4 bits), sharp pixels.
  _markerTex(this: KiboNavSandbox, bits: string) {
    const key = 'aruco:' + bits, T = this._T;
    if (this._labels[key]) return this._labels[key];
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d')!, u = 8;
    cv.width = cv.height = 8 * u;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 8 * u, 8 * u);
    ctx.fillStyle = '#000'; ctx.fillRect(u, u, 6 * u, 6 * u);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 16; i++) if (bits.charAt(i) === '1') ctx.fillRect((2 + i % 4) * u, (2 + Math.floor(i / 4)) * u, u, u);
    const tex = new T.CanvasTexture(cv);
    tex.magFilter = T.NearestFilter; tex.minFilter = T.LinearFilter; tex.generateMipmaps = false;
    this._labels[key] = tex;
    return tex;
  }

  _boxMesh(this: KiboNavSandbox, b: { min: Vec3; max: Vec3 }, color: string, opacity: number, group: THREE.Object3D) {
    const T = this._T, size = Core.boxSize(b).map(function (s) { return Math.max(s, 0.012); }), c = Core.boxCenter(b);
    const m = new T.Mesh(this._geo.box, this._mat(color, opacity));
    m.scale.set(size[0], size[1], size[2]); m.position.set(c[0], c[1], c[2]);
    group.add(m);
    const eg = new T.EdgesGeometry(new T.BoxGeometry(size[0], size[1], size[2]));
    const e = new T.LineSegments(eg, this._mat(color, 0.9, 'line'));
    e.position.copy(m.position); e.userData.ownGeo = true;
    group.add(e);
    return m;
  }

  _rod(this: KiboNavSandbox, a: Vec3, b: Vec3, r: number, mat: THREE.Material, group: THREE.Object3D) {
    const T = this._T, d = Core.sub(b, a), L = Core.len(d);
    if (L < 1e-6) return null;
    const m = new T.Mesh(this._geo.cyl, mat), mid = Core.lerp(a, b, 0.5);
    m.scale.set(r, L, r); m.position.set(mid[0], mid[1], mid[2]);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(d[0] / L, d[1] / L, d[2] / L));
    group.add(m);
    return m;
  }

  _arrow3d(this: KiboNavSandbox, from: Vec3, dir: Vec3, L: number, r: number, mat: THREE.Material, group: THREE.Object3D) {
    const T = this._T, head = Math.min(L * 0.35, 0.08), u = Core.norm(dir);
    const tip = Core.add(from, Core.scale(u, L)), neck = Core.add(from, Core.scale(u, L - head));
    this._rod(from, neck, r, mat, group);
    const cone = new T.Mesh(this._geo.cone, mat), mid = Core.lerp(neck, tip, 0.5);
    cone.scale.set(r * 2.6, head, r * 2.6); cone.position.set(mid[0], mid[1], mid[2]);
    cone.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(u[0], u[1], u[2]));
    group.add(cone);
  }

  _clearGroup(this: KiboNavSandbox, g: THREE.Object3D) {
    while (g.children.length) {
      const o = g.children.pop()!;
      o.traverse(function (x) {
        if (x.userData && x.userData.ownGeo && (x as SceneObject).geometry) (x as SceneObject).geometry!.dispose();
        if (((x as SceneObject).isSprite || (x.userData && x.userData.ownMat)) && (x as SceneObject).material) (x as SceneObject).material!.dispose();
      });
    }
  }

  _build3dStatic(this: KiboNavSandbox) {
    if (!this._T) return;
    const T = this._T, c = this._c, cfg = this._config, g = this._static, self = this;
    this._clearGroup(g);
    Object.keys(this._mats).forEach(function (k) { self._mats[k].dispose(); });
    this._mats = {};
    Object.keys(this._labels).forEach(function (k) { self._labels[k].dispose(); });
    this._labels = {};
    this._scene.background = new T.Color(c['view-bg']);
    const wb = Core.worldBounds(cfg), center = Core.lerp(wb.min, wb.max, 0.5);
    this._iss.position.set(-center[0], -center[1], -center[2]);
    this._center = center;

    cfg.kiz.forEach(function (b) {
      self._boxMesh(b, c.kiz, 0.05, g);
      if (cfg.kiz.length < 2) return;
      const l = self._label3d(b.name, c.kiz, 0.09); l.position.set(b.min[0] + 0.15, b.min[1] + 0.1, b.min[2] - 0.05); g.add(l);
    });

    // Side names at the ends, overhead and deck of the keep-in box.
    const kb = Core.kizBounds(cfg), kc = Core.lerp(kb.min, kb.max, 0.5);

    ([['-x', [kb.min[0] - 0.25, kc[1], kc[2]]], ['+x', [kb.max[0] + 0.25, kc[1], kc[2]]], ['-z', [kc[0], kc[1], kb.min[2] - 0.15]], ['+z', [kc[0], kb.max[1] + 0.2, kb.max[2]]]] as [string, Vec3][]).forEach(function (sd) {
      if (!cfg.sides[sd[0]]) return;
      const l = self._label3d(sideName(cfg, sd[0]), c.muted, 0.13); l.position.set(sd[1][0], sd[1][1], sd[1][2]); g.add(l);
    });

    cfg.oasis.forEach(function (b) { self._boxMesh(b, c.oasis, 0.12, g); });

    cfg.koz.forEach(function (b) {
      self._boxMesh(b, c.koz, 0.3, g);
      const l = self._label3d(b.name, c.koz, 0.09), cc = Core.boxCenter(b); l.position.set(cc[0], cc[1], b.min[2] - 0.06); g.add(l);
    });

    cfg.targets.forEach(function (t) {
      // A 2 cm marker is invisible at this scale, so draw its real pattern 3x larger (6 cm plus margin).
      const bits = Core.markerBits(t);

      if (bits) {
        const plate = new T.Mesh(self._geo.plane, new T.MeshBasicMaterial({ map: self._markerTex(bits), side: T.FrontSide }));
        const pp = Core.add(t.pos!, Core.scale(t.normal, 0.003)), ps = t.size! * 3 * 8 / 6;
        plate.scale.set(ps, ps, 1); plate.position.set(pp[0], pp[1], pp[2]); plate.quaternion.set(t.q![0], t.q![1], t.q![2], t.q![3]);
        plate.userData.ownMat = true; g.add(plate);
      } else {
        const shown = t.pos ? { min: t.min.map(function (v, k) { return t.max[k] - v > 1e-6 ? t.pos![k] - 0.03 : v; }), max: t.max.map(function (v, k) { return v - t.min[k] > 1e-6 ? t.pos![k] + 0.03 : v; }) } : t;
        self._boxMesh(shown, c.target, 0.8, g);
      }

      const text = self._targetLabel(t);
      if (!text) return;
      const cc = Core.add(Core.targetCenter(t), Core.scale(t.normal, 0.1)), l = self._label3d(text, c.target, 0.09);
      l.position.set(cc[0], cc[1], cc[2]); g.add(l);
    });

    // checkpoints: a solid point, the line of sight and the top (+Z) to match
    cfg.checkpoints.forEach(function (cp) {
      const p = cp.pos, m = new T.Mesh(self._geo.sphere, self._mat(c.cp, 1, 'lambert'));
      m.scale.set(0.025, 0.025, 0.025); m.position.set(p[0], p[1], p[2]); g.add(m);

      if (cp.marker) {
        const ln = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(p[0], p[1], p[2]), new T.Vector3(cp.marker[0], cp.marker[1], cp.marker[2])]), self._mat(c.cp, 1, 'dash'));
        ln.computeLineDistances(); ln.userData.ownGeo = true; g.add(ln);
      }

      if (cp.q) self._rod(p, Core.add(p, Core.scale(Core.topDir(cp.q), 0.14)), 0.006, self._mat(c.top, 1), g);
      const l = self._label3d(cp.name + (cp.id === cfg.goal ? L(' (goal)', ' (গোল)') : ''), c.cp, 0.09); l.position.set(p[0], p[1], p[2] - 0.08); g.add(l);
    });

    // start (dock) and preset poses
    const dock = new T.Mesh(this._geo.box, this._mat(c.robot, 0.8, 'lambert')), sp = cfg.start.pos;
    dock.scale.set(0.08, 0.08, 0.08); dock.position.set(sp[0], sp[1], sp[2]); g.add(dock);
    const dl = this._label3d(cfg.start.name, c.muted, 0.09); dl.position.set(sp[0], sp[1], sp[2] + 0.12); g.add(dl);

    cfg.poses.forEach(function (p) {
      const m = new T.Mesh(self._geo.sphere, self._mat(c.sel, 1, 'lambert'));
      m.scale.set(0.03, 0.03, 0.03); m.position.set(p.pos[0], p.pos[1], p.pos[2]); g.add(m);
      self._arrow3d(p.pos, Core.cameraDir(p.q), 0.25, 0.007, self._mat(c.sel, 1), g);
      const l = self._label3d(p.name, c.sel, 0.09); l.position.set(p.pos[0], p.pos[1], p.pos[2] - 0.1); g.add(l);
    });

    // 0.5 m grid on the deck plane (largest z)
    const zDeck = wb.max[2] + 0.01, pts = [], step = 0.5;
    const x0 = Math.floor(wb.min[0] / step) * step, x1 = Math.ceil(wb.max[0] / step) * step;
    const y0 = Math.floor(wb.min[1] / step) * step, y1 = Math.ceil(wb.max[1] / step) * step;
    for (let x = x0; x <= x1 + 1e-9; x += step) pts.push(new T.Vector3(x, y0, zDeck), new T.Vector3(x, y1, zDeck));
    for (let y = y0; y <= y1 + 1e-9; y += step) pts.push(new T.Vector3(x0, y, zDeck), new T.Vector3(x1, y, zDeck));
    const grid = new T.LineSegments(new T.BufferGeometry().setFromPoints(pts), this._mat(c.grid, 1, 'line'));
    grid.userData.ownGeo = true; g.add(grid);

    // axes gizmo
    const o = [x0, y0, zDeck], len = 0.5;

    ([[[1, 0, 0], '#e5484d', '+x'], [[0, 1, 0], '#30a46c', '+y'], [[0, 0, 1], '#3e63dd', L('+z (deck)', '+z (মেঝে)')]] as [Vec3, string, string][]).forEach(function (ax) {
      self._arrow3d(o, ax[0], len, 0.009, self._mat(ax[1], 1), g);
      const l = self._label3d(ax[2], ax[1], 0.09), tip = Core.add(o, Core.scale(ax[0], len + 0.1));
      l.position.set(tip[0], tip[1], tip[2]); g.add(l);
    });

    // robot
    this._clearGroup(this._robot3);
    let rs = cfg.robot.size, body;

    // A solid, near-white body (like Int-Ball2) with a thin dark outline (its back faces drawn a little larger),
    // so it stands out against the walls, the grid and the deck in either theme.
    const sphere = cfg.robot.shape === 'sphere', geo = sphere ? this._geo.sphere : this._geo.box, half = sphere ? rs / 2 : rs;
    body = new T.Mesh(geo, this._mat('#eef1f6', 1, 'lambert')); body.scale.set(half, half, half);
    const edge = new T.Mesh(geo, new T.MeshBasicMaterial({ color: '#0d1118', side: T.BackSide }));
    edge.scale.set(half * 1.12, half * 1.12, half * 1.12); edge.userData.ownMat = true;

    this._robot3.add(body, edge);

    if (sphere) this._robotDetails(rs / 2);
    else {
      const lens = new T.Mesh(this._geo.box, this._mat(c.cam, 1, 'lambert'));
      lens.scale.set(0.02, rs * 0.35, rs * 0.35); lens.position.set(rs / 2 + 0.01, 0, 0);
      this._robot3.add(lens);
    }

    this._arrow3d([0, 0, 0], [1, 0, 0], rs / 2 + 0.25, 0.008, this._mat(c.cam, 1), this._robot3);

    // The robot's top (body +Z), to compare with each checkpoint's: that is the roll to match.
    this._rod([0, 0, rs / 2 - 0.01], [0, 0, rs / 2 + 0.1], 0.006, this._mat(c.top, 1), this._robot3);
    this._robot3.traverse(function (o) { o.layers.set(1); });
    this._place3dRobot();
  }

  _build3dDynamic(this: KiboNavSandbox) {
    if (!this._T) return;
    const T = this._T, c = this._c, g = this._dynamic, a = this._analysis, self = this, cfg = this._config;
    this._clearGroup(g);
    this._wpMeshes = [];
    const okMat = this._mat(c.route, 1), badMat = this._mat(c.bad, 1);

    a.legs.forEach(function (l) {
      self._rod(l.from, l.to, l.clear ? 0.006 : 0.008, l.clear ? okMat : badMat, g);
      if (!l.clear) {
        const h = new T.Mesh(self._geo.sphere, badMat);
        h.scale.set(0.03, 0.03, 0.03); h.position.set(l.hit![0], l.hit![1], l.hit![2]); g.add(h);
      }
    });

    this._route.forEach(function (w, i) {
      const sel = i === self._sel, r = w.via ? 0.022 : 0.035;
      const m = new T.Mesh(self._geo.sphere, self._mat(sel ? c.sel : (w.via ? c.robot : c.wp), 1, 'lambert'));
      m.scale.set(r, r, r); m.position.set(w.pos[0], w.pos[1], w.pos[2]); m.userData.wp = i;
      g.add(m); self._wpMeshes.push(m);
      if (!w.via || sel) self._arrow3d(w.pos, Core.cameraDir(a.poses[i].q), sel ? 0.3 : 0.2, sel ? 0.007 : 0.005, self._mat(sel ? c.sel : c.wp, 1), g);
      if (!w.via) { const l = self._label3d(String(i + 1), sel ? c.sel : c.wp, 0.1); l.position.set(w.pos[0], w.pos[1], w.pos[2] - 0.08); g.add(l); }
    });

    this._mission.goals.forEach(function (gl) {
      const cpd = gl.done && gl.kind === 'checkpoint' && Core.findCheckpoint(cfg, gl.id);

      if (cpd) {
        const ms = new T.Mesh(self._geo.sphere, self._mat(c.ok, 1, 'lambert'));
        ms.scale.set(0.03, 0.03, 0.03); ms.position.set(cpd.pos[0], cpd.pos[1], cpd.pos[2]); g.add(ms);
        return;
      }

      const tg = gl.done && Core.findTarget(cfg, gl.id);
      if (!tg) return;
      const grow = { min: Core.sub(tg.min, [0.02, 0.02, 0.02]), max: Core.add(tg.max, [0.02, 0.02, 0.02]) };
      self._boxMesh(grow, c.ok, 0.35, g);
    });

    let sw = this._route[this._sel], tt;

    if (sw && sw.mode === 'target' && (tt = Core.findTarget(cfg, sw.target))) {
      const tc = Core.targetCenter(tt);
      const line = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(sw.pos[0], sw.pos[1], sw.pos[2]), new T.Vector3(tc[0], tc[1], tc[2])]), this._mat(c.cam, 1, 'dash'));
      line.computeLineDistances(); line.userData.ownGeo = true; g.add(line);
    }

    this._place3dRobot();
  }

  // The ball's stripe, lens and fan sockets on a ball of radius R (robots.ts).
  _robotDetails(this: KiboNavSandbox, R: number) {
    const self = this;
    addBallDetails(this._T, this._robot3, R, function (color) { return self._mat(color, 1, 'lambert'); });
  }

  _place3dRobot(this: KiboNavSandbox) {
    if (!this._T || !this._robot3) return;
    const p = this._robotNow();
    this._robot3.position.set(p.pos[0], p.pos[1], p.pos[2]);
    this._robot3.quaternion.set(p.q[0], p.q[1], p.q[2], p.q[3]);
    this._update3dDriveLine();
    this._render3d();
  }

  _update3dDriveLine(this: KiboNavSandbox) {
    const L = this._driveLine3;
    if (!L) return;
    L.visible = !!this._drive;
    if (!this._drive) return;
    const a = this._driveFrom().pos, b = this._drive.pos, arr = L.geometry.attributes.position.array as Float32Array;
    arr[0] = a[0]; arr[1] = a[1]; arr[2] = a[2]; arr[3] = b[0]; arr[4] = b[1]; arr[5] = b[2];
    L.geometry.attributes.position.needsUpdate = true;
    L.computeLineDistances();
    (L.material as THREE.LineDashedMaterial).color.set(Core.checkSegment(this._config, a, b).clear ? this._c.route : this._c.bad);
  }

  _pick3d(this: KiboNavSandbox, e: PointerEvent) {
    if (!this._wpMeshes || !this._wpMeshes.length) return;
    const T = this._T, r = this._renderer.domElement.getBoundingClientRect();
    const ndc = new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this._raycaster.setFromCamera(ndc, this._camera);
    const hit = this._raycaster.intersectObjects(this._wpMeshes, false)[0];
    if (hit) this._select(hit.object.userData.wp, true);
  }

  // Zoom so the point under the cursor (on the plane through the orbit target, facing the camera)
  // stays under the cursor: scale the camera and the target about that point.
  _zoom3dAt(this: KiboNavSandbox, e: WheelEvent) {
    this._touched3d = true;
    const T = this._T, cam = this._camera, ctl = this._controls, r = this._renderer.domElement.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this._raycaster.setFromCamera(new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), cam);
    const n = new T.Vector3(), p = new T.Vector3();
    cam.getWorldDirection(n);
    if (!this._raycaster.ray.intersectPlane(new T.Plane().setFromNormalAndCoplanarPoint(n, ctl.target), p)) return;
    const dy = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
    let dist = cam.position.distanceTo(ctl.target), k = Math.exp(Math.max(-300, Math.min(300, dy)) * 0.0015);
    k = Math.min(Math.max(k, 0.15 / dist), 80 / dist); // stay between 15 cm and 80 m from the target
    cam.position.sub(p).multiplyScalar(k).add(p);
    ctl.target.sub(p).multiplyScalar(k).add(p);
    ctl.update();
    this._render3d();
  }

  // Touch, the usual way for a 3D view: one finger turns around the module (orbit), two fingers pinch to zoom
  // toward them and drag to slide the view, both at once. On a phone held upright in a page (_scroll3d) one
  // finger up or down still scrolls the page and sideways turns the view, so the 3D view never traps the page.
  _setupMapTouch(this: KiboNavSandbox, el: HTMLElement) {
    let self = this, g = null as { last: ReturnType<typeof read> } | null;

    function read(e: TouchEvent) {
      const a = e.touches[0], b = e.touches[1];
      return { dist: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY), mx: (a.clientX + b.clientX) / 2, my: (a.clientY + b.clientY) / 2 };
    }

    el.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 2) { g = null; return; }
      g = { last: read(e) };
      self._touched3d = true;
      e.preventDefault();
    }, { passive: false });

    el.addEventListener('touchmove', function (e) {
      if (!g || e.touches.length !== 2) return;
      e.preventDefault(); e.stopPropagation();
      const r = read(e), p = g.last, T = self._T, cam = self._camera, ctl = self._controls;

      // Pinch: zoom toward the point between the fingers.
      if (Math.abs(Math.log(r.dist / p.dist)) > 1e-4) self._zoom3dAt({ clientX: r.mx, clientY: r.my, deltaY: Math.log(p.dist / r.dist) / 0.0015, deltaMode: 0 } as WheelEvent);

      // Drag: slide the view with the fingers (the point under them follows them).
      const h = el.getBoundingClientRect().height || 1, d = cam.position.distanceTo(ctl.target);
      const k = 2 * d * Math.tan(cam.fov * Math.PI / 360) / h;
      const right = new T.Vector3().setFromMatrixColumn(cam.matrix, 0), up = new T.Vector3().setFromMatrixColumn(cam.matrix, 1);
      const mv = right.multiplyScalar(-(r.mx - p.mx) * k).add(up.multiplyScalar((r.my - p.my) * k));
      cam.position.add(mv); ctl.target.add(mv);

      g.last = r;
      ctl.update();
      self._render3d();
    }, { passive: false });

    el.addEventListener('touchend', function (e) { if (e.touches.length < 2) g = null; });
    el.addEventListener('touchcancel', function () { g = null; });

    // Upright in a page: OrbitControls would block the page scroll (it cancels every touch), so single touches
    // are stopped on the way down (capture phase on the canvas's parent) and handled here: sideways turns the
    // view; up / down is left to the browser, which scrolls the page (touch-action: pan-y). Rolling the
    // module needs the roll wheel (_setupRollWheel): a phone scrolls as soon as a vertical drag starts.
    let one = null as { x: number; y: number; turning: boolean } | null;
    const holder = el.parentNode as HTMLElement;

    holder.addEventListener('touchstart', function (e) {
      one = e.touches.length === 1 && self._scroll3d ? { x: e.touches[0].clientX, y: e.touches[0].clientY, turning: false } : null;
      if (one) e.stopPropagation();
    }, { capture: true, passive: true });

    holder.addEventListener('touchmove', function (e) {
      if (!one || e.touches.length !== 1) return;
      e.stopPropagation();
      const x = e.touches[0].clientX, y = e.touches[0].clientY;
      if (!one.turning && Math.abs(x - one.x) > 8 && Math.abs(x - one.x) > Math.abs(y - one.y)) one.turning = true;
      if (!one.turning) return;
      const T = self._T, cam = self._camera, ctl = self._controls, h = el.getBoundingClientRect().height || 1;
      cam.position.sub(ctl.target).applyAxisAngle(new T.Vector3(0, 1, 0), -2 * Math.PI * (x - one.x) / h).add(ctl.target);
      one.x = x; one.y = y;
      self._touched3d = true;
      ctl.update();
      self._render3d();
    }, { capture: true, passive: true });
  }

  // The roll wheel on the upright 3D view's left edge: drag it up / down to roll the module about its long
  // (airlock - dock) axis. It takes the touch itself (touch-action: none), so the page never scrolls from it.
  _setupRollWheel(this: KiboNavSandbox) {
    const self = this, wheel = this.$('.rollwheel');
    let drag = null as { id: number; y: number; sgn: number } | null;

    wheel.addEventListener('pointerdown', function (e) {
      if (drag) return;
      e.preventDefault(); e.stopPropagation();
      try { wheel.setPointerCapture(e.pointerId); } catch (err) { /* already gone */ }

      // Which way to roll so the near side of the module follows the finger: from the side, the near wall
      // moves with it; looking down the axis (from an end) there is no near side, so keep the default.
      const T = self._T, cam = self._camera, c = new T.Vector3(0, cam.position.y, cam.position.z);
      const up = new T.Vector3().setFromMatrixColumn(cam.matrix, 1), v = new T.Vector3(1, 0, 0).cross(c);
      drag = { id: e.pointerId, y: e.clientY, sgn: c.length() > 0.2 * cam.position.length() && v.dot(up) < 0 ? -1 : 1 };
      wheel.classList.add('on');
    });

    wheel.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      e.preventDefault();
      const dy = e.clientY - drag.y, h = wheel.getBoundingClientRect().height || 1;
      drag.y = e.clientY;
      self._issRoot.rotation.x -= drag.sgn * ROLL_PER_WHEEL * dy / h;
      self._rollWheelUi();
      self._touched3d = true;
      self._render3d();
    });

    const end = function (e: PointerEvent) { if (drag && e.pointerId === drag.id) { drag = null; wheel.classList.remove('on'); } };
    wheel.addEventListener('pointerup', end);
    wheel.addEventListener('pointercancel', end);
    wheel.addEventListener('lostpointercapture', end);
  }

  // The wheel's ridges move with the roll, like a real thumbwheel.
  _rollWheelUi(this: KiboNavSandbox) {
    const wheel = this.$('.rollwheel');
    if (wheel && this._issRoot) wheel.style.backgroundPositionY = Math.round((this._issRoot.rotation.x - Math.PI / 2) * 40) + 'px';
  }

  // Reset view: every view back to its starting framing (3D angle, Top / Side / End fit, the camera
  // picture and the small camera window).
  _resetViews(this: KiboNavSandbox) {
    this._touched3d = false;
    if (this._drive) this._driveView3d(); else this._fit3d();
    const self = this;
    Object.keys(this._views).forEach(function (k) { const v = self._views[k]; v.fitted = false; v.touched = false; self._resizeView(v); });
    this._ui.pip = true;
    this._camInfoKey = '';
    this._resizeCam();
    this._drawAll();
    this._save();
  }

  // The small log (terminal) shown with the camera + 3D views: short lines from Play and Drive.
  _log(this: KiboNavSandbox, msg: string, kind?: string) {
    const box = this.$('.term .tlines');
    if (!box) return;
    const t = this._logT0 || (this._logT0 = Date.now()), sec = Math.floor((Date.now() - t) / 1000);
    const line = document.createElement('div');
    line.className = kind ? 't-' + kind : '';
    line.innerHTML = '<span class="t-time">' + Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2) + '</span>' + esc(msg);
    box.appendChild(line);
    while (box.childNodes.length > 80) box.removeChild(box.firstChild!);
    box.scrollTop = box.scrollHeight;
  }

  // Collapsed: one line (the latest message); expanded: the usual three lines.
  _setTermMin(this: KiboNavSandbox, min: boolean) {
    this._termMin = !!min;
    this._root.classList.toggle('term-min', this._termMin);
    const b = this.$('.termbtn');

    if (b) {
      b.textContent = this._termMin ? '▴' : '▾';
      b.setAttribute('aria-expanded', String(!this._termMin));
      b.title = this._termMin ? L('Expand the log', 'লগ বড় করো') : L('Collapse the log', 'লগ গুটিয়ে রাখো');
      b.setAttribute('aria-label', b.title);
    }

    const box = this.$('.term .tlines');
    if (box) box.scrollTop = box.scrollHeight;
  }

  // On a phone held upright (outside full screen) the page must scroll past the tall 3D view: one finger up or
  // down scrolls the page, sideways it turns the view. Elsewhere one finger turns (orbits) the view.
  _applyTouchMode(this: KiboNavSandbox) {
    const coarse = !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches), on = !!this._narrow && !this._fs && coarse;

    // Drive sticks are for phones and tablets (a narrow layout or full screen). A computer gets the keys: the
    // desktop layout, a mouse or touchpad beside a touch screen, or once a Drive key is pressed.
    this._sticks = touchFirst() && !this._keyboard && (!!this._narrow || !!this._fs);
    this._root.classList.toggle('sticks', this._sticks);
    this._scroll3d = on;
    this._root.classList.toggle('scroll3d', on);
    if (!this._controls || !this._renderer) return;
    this._controls.touches.ONE = on ? -1 : this._T.TOUCH.ROTATE;
    this._renderer.domElement.style.touchAction = on ? 'pan-y' : 'none';
  }

  _resize3d(this: KiboNavSandbox) {
    if (!this._renderer) return;
    const r = this.$('.cell[data-cell="3d"]').getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    this._renderer.setSize(r.width, r.height);
    this._camera.aspect = r.width / r.height;
    this._camera.updateProjectionMatrix();

    // Until the student moves the view, keep the whole module framed (full screen, turning the phone).
    if (!this._touched3d) this._fit3d();
    this._drawInsets();
    this._render3d(true);
  }

  // Look at the whole world from direction `dirIss` (ISS frame; default VIEW3D_DIR, the side view),
  // backing off until every corner of the world fills `fill` of the view (default 0.85).
  _fit3d(this: KiboNavSandbox, dirIss?: Vec3, fill?: number) {
    if (!this._camera) return;
    const T = this._T, cam = this._camera, wb = Core.worldBounds(this._config), center = Core.lerp(wb.min, wb.max, 0.5);
    const dir = Core.norm(dirIss || VIEW3D_DIR), dv = new T.Vector3(dir[0], -dir[2], dir[1]); // ISS -> three.js (x, -z, y)
    let corners = [], d = Core.dist(wb.min, wb.max), want = fill || 0.85, v = new T.Vector3();

    for (let i = 0; i < 8; i++) {
      const p = Core.sub([[wb.min[0], wb.max[0]][i & 1], [wb.min[1], wb.max[1]][(i >> 1) & 1], [wb.min[2], wb.max[2]][(i >> 2) & 1]], center);
      corners.push(new T.Vector3(p[0], -p[2], p[1]));
    }

    cam.up.set(0, 1, 0);
    this._controls.target.set(0, 0, 0);
    this._issRoot.rotation.x = Math.PI / 2; // the module upright again (deck down)
    this._rollWheelUi();

    for (let it = 0; it < 4; it++) { // the projected size goes roughly as 1 / distance
      cam.position.copy(dv).multiplyScalar(d);
      cam.lookAt(0, 0, 0);
      cam.updateMatrixWorld(true);
      let m = 0;
      corners.forEach(function (c) { v.copy(c).project(cam); m = Math.max(m, Math.abs(v.x), Math.abs(v.y)); });
      if (!isFinite(m) || m <= 0) break;
      d *= m / want;
    }

    cam.position.copy(dv).multiplyScalar(d);
    this._controls.update();
    this._render3d();
  }

  _render3d(this: KiboNavSandbox, now?: boolean) {
    if (!this._renderer) return;
    const self = this;
    if (now) { this._renderNow(); return; }
    if (this._raf3d) return;
    this._raf3d = requestAnimationFrame(function () { self._raf3d = 0; self._renderNow(); });
  }

  _renderNow(this: KiboNavSandbox) {
    // Labels have a size in metres, so close up (Drive, zoomed in) they would fill the view: shrink the
    // ones nearer than 2.5 m, down to 30 %. Far labels keep their size.
    const cam = this._camera.position, v = this._tmpV || (this._tmpV = new this._T.Vector3());

    this._scene.traverse(function (o) {
      if (!(o as SceneObject).isSprite || !o.userData.lh) return;
      o.getWorldPosition(v);
      const k = Math.min(1, Math.max(0.3, v.distanceTo(cam) / 2.5));
      o.scale.set(o.userData.lh * o.userData.aspect * k, o.userData.lh * k, 1);
    });

    // The robot keeps its true size up close, and is drawn larger further away (up to 2.5x) so it never
    // looks smaller than about 13 px in radius: it stays easy to find in the whole-module view.
    if (this._robot3) {
      this._robot3.getWorldPosition(v);
      const r = this._config.robot.size / 2, h = this._renderer.domElement.clientHeight || 1;
      const px = r * (h / 2) / (v.distanceTo(cam) * Math.tan(this._camera.fov * Math.PI / 360));
      const k = Math.min(2.5, Math.max(1, 13 / px));
      this._robot3.scale.set(k, k, k);
    }

    this._renderer.render(this._scene, this._camera);
  }
}
