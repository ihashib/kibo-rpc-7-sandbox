// The two robots of the robots page and the sandbox's 3D view, modelled for this project after the real ones from NASA's public photos:
// Int-Ball2, a white ball with a black face and two blue ring eyes, and Astrobee, a white front plate between black fan modules with
// blue fabric covers and foam corners. Their surfaces are painted here, in code, onto canvases: there are no image files, and no logos.
import type { Three, THREE } from './types.js';
import { L } from '../i18n.js';

const BLACK = '#121317', FOAM = '#141518', STEEL = '#8d949e', LED_BLUE = '#4f78ff';

type Tex = THREE.CanvasTexture;

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')!];
}

function texture(T: Three, c: HTMLCanvasElement): Tex {
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8; return t;
}

// A colour as written here: the page renders in sRGB, and three.js r128 otherwise takes the numbers as linear, which washes dark colours out.
function col(T: Three, hex: string) { return new T.Color(hex).convertSRGBToLinear(); }

function std(T: Three, color: string, o?: THREE.MeshStandardMaterialParameters) {
  const m = new T.MeshStandardMaterial(Object.assign({ roughness: 0.5, metalness: 0.05 }, o || {}));
  m.color = col(T, color);
  if (o && o.emissive) m.emissive = col(T, o.emissive as string);
  return m;
}

function aim(T: Three, mesh: THREE.Object3D, p: number[], n: number[]) {
  mesh.position.set(p[0], p[1], p[2]); mesh.lookAt(new T.Vector3(p[0] + n[0], p[1] + n[1], p[2] + n[2])); return mesh;
}

function disc(T: Three, r: number, depth: number, mat: THREE.Material) {
  const g = new T.CylinderGeometry(r, r, depth, 32); g.rotateX(Math.PI / 2); return new T.Mesh(g, mat);
}

function dome(T: Three, r: number, height: number, mat: THREE.Material) {
  const g = new T.SphereGeometry(r, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2); g.rotateX(Math.PI / 2); g.scale(1, 1, height / r); return new T.Mesh(g, mat);
}

function unit(v: number[]) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }

function clamp01(v: number) { return v < 0 ? 0 : v > 1 ? 1 : v; }

function smooth(a: number, b: number, v: number) { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); }

/* ---------- Int-Ball2 ---------- */

let ballCanvas: HTMLCanvasElement | null = null, ballSkin: Tex | null = null;

// The ball's skin, worked out point by point on the sphere (front +z, up +y, the robot's left +x): white, a black mask across the face with
// a stem up the middle, a grilled panel over each of the eight fans, slits round the bottom, the panel at the back.
function paintBall(): HTMLCanvasElement {
  if (ballCanvas) return ballCanvas;
  const W = 1280, H = 640, [cv, x] = canvas(W, H), img = x.createImageData(W, H), out = img.data;
  const ducts: { n: number[]; e1: number[]; e2: number[] }[] = [];
  for (let i = 0; i < 8; i++) {
    const n = unit([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1]), e1 = unit([n[2], 0, -n[0]]);
    ducts.push({ n: n, e1: e1, e2: [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]] });
  }
  const edge = 0.0075, cover = function (f: number) { return clamp01(f / edge + 0.5); };
  for (let j = 0; j < H; j++) {
    const th = (j + 0.5) / H * Math.PI, st = Math.sin(th), dy = Math.cos(th);
    for (let i = 0; i < W; i++) {
      const ph = (i + 0.5) / W * Math.PI * 2, dx = -Math.cos(ph) * st, dz = Math.sin(ph) * st;
      let r = 238, g = 240, b = 243;
      const mix = function (cr: number, cg: number, cb: number, k: number) { r += (cr - r) * k; g += (cg - g) * k; b += (cb - b) * k; };
      // Seams between the shell's halves.
      mix(176, 182, 192, cover(0.0035 - Math.abs(dz)));
      // The fans' panels, with their rows of slits.
      for (let d = 0; d < 8; d++) {
        const D = ducts[d], c = dx * D.n[0] + dy * D.n[1] + dz * D.n[2];
        if (c < 0.6) continue;
        const u = dx * D.e1[0] + dy * D.e1[1] + dz * D.e1[2], v = dx * D.e2[0] + dy * D.e2[1] + dz * D.e2[2];
        const q = Math.hypot(Math.max(Math.abs(u) - 0.19, 0), Math.max(Math.abs(v) - 0.19, 0)) - 0.1, k = cover(-q);
        if (k <= 0) continue;
        mix(16, 17, 20, k);
        if (q < -0.035) mix(58, 62, 70, 0.75 * smooth(0.25, 0.75, Math.sin(u * 86)));
      }
      // Slits round the bottom.
      if (dy < -0.74 && dy > -0.95) {
        const az = Math.atan2(dx, dz);
        if (Math.abs(az) < 1.25) mix(30, 32, 37, cover(Math.sin(az * 52) * 0.01 - 0.003) * cover(0.95 + dy) * cover(-0.74 - dy));
      }
      // The black face, with a white line round it.
      if (dz > 0) {
        const ax = Math.abs(dx), hi = 0.86 - 0.5 * smooth(0.13, 0.75, ax), lo = -0.2 + 0.3 * dx * dx, f = Math.min(dy - lo, hi - dy, 0.93 - ax);
        if (f > -0.04) { mix(238, 240, 243, cover(f + 0.028)); mix(14, 15, 18, cover(f)); }
      } else {
        mix(26, 28, 32, cover(0.42 - Math.hypot(dx, dy + 0.1))); // the back panel, round the docking plug
      }
      // The stereo pair's strip on the left, the velcro on the right.
      if (dx > 0) mix(14, 15, 18, cover(0.08 - Math.hypot(Math.max(Math.abs(dz) - 0.31, 0), Math.max(Math.abs(dy) - 0.06, 0))));
      else if (Math.abs(dz - 0.12) < 0.1 && Math.abs(dy) < 0.18) mix(141, 145, 152, 1);
      const o = (j * W + i) * 4;
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  ballCanvas = cv;
  return cv;
}

// A blue ring eye: dark glass, a lit ring with a white-hot core, and a soft glow.
function ballEye(T: Three, g: THREE.Object3D, side: number) {
  const n = unit([side * 0.47, 0.22, 0.85]);
  const at = function (d: number) { return [n[0] * d, n[1] * d, n[2] * d]; };
  g.add(aim(T, dome(T, 0.2, 0.05, std(T, '#050608', { roughness: 0.08, metalness: 0.4 })), at(0.985), n));
  g.add(aim(T, new T.Mesh(new T.TorusGeometry(0.228, 0.034, 14, 64), new T.MeshBasicMaterial({ color: col(T, LED_BLUE) })), at(0.995), n));
  g.add(aim(T, new T.Mesh(new T.TorusGeometry(0.228, 0.012, 8, 64), new T.MeshBasicMaterial({ color: col(T, '#d6e2ff') })), at(1.026), n));
  g.add(aim(T, new T.Mesh(new T.TorusGeometry(0.228, 0.07, 10, 64), new T.MeshBasicMaterial({ color: col(T, '#2f55d8'), transparent: true, opacity: 0.32, blending: T.AdditiveBlending, depthWrite: false })), at(0.99), n));
}

// The ball on the sandbox's robot, radius R (body frame: +X the camera, +Y left, +Z the top): the same skin, turned from the model's axes.
function addBallDetails(T: Three, group: THREE.Object3D, R: number, mat: (color: string) => THREE.Material) {
  const skin = new T.Mesh(new T.SphereGeometry(R * 1.006, 40, 28), new T.MeshLambertMaterial({ map: ballSkin || (ballSkin = texture(T, paintBall())) }));
  skin.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(0, 1, 0), new T.Vector3(0, 0, 1), new T.Vector3(1, 0, 0)));
  skin.userData.ownGeo = true; group.add(skin);
  [-1, 1].forEach(function (s) {
    const d = new T.Vector3(0.85, s * 0.47, 0.22).normalize(), ring = new T.Mesh(new T.TorusGeometry(R * 0.228, R * 0.04, 8, 28), mat(LED_BLUE));
    ring.position.copy(d).multiplyScalar(R * 1.0);
    ring.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), d);
    ring.userData.ownGeo = true; group.add(ring);
  });
}

// Int-Ball2 for the robots page: radius 1 (about 10 cm), front +z, up +y, the robot's left +x. `shells` are the outer materials (the page makes
// them see-through to show the inside). Its fans are behind grilles, as on the real one, so nothing turns.
function buildBall(T: Three) {
  const shells: THREE.MeshStandardMaterial[] = [], spinners: THREE.Object3D[] = [], g = new T.Group();
  const shell = new T.MeshStandardMaterial({ map: texture(T, paintBall()), roughness: 0.3, metalness: 0, transparent: true });
  shells.push(shell);
  g.add(new T.Mesh(new T.SphereGeometry(1, 96, 64), shell));
  ballEye(T, g, -1); ballEye(T, g, 1);
  // The main camera, between the eyes.
  const main = unit([0, 0.12, 1]);
  g.add(aim(T, new T.Mesh(new T.TorusGeometry(0.085, 0.013, 10, 36), std(T, '#3a3f49', { metalness: 0.5, roughness: 0.3 })), [main[0] * 1.0, main[1] * 1.0, main[2] * 1.0], main));
  g.add(aim(T, dome(T, 0.075, 0.03, std(T, '#0a0c10', { roughness: 0.06, metalness: 0.5 })), [main[0] * 0.995, main[1] * 0.995, main[2] * 0.995], main));
  g.add(aim(T, disc(T, 0.03, 0.02, std(T, '#111318')), [0, 0.62, 0.785], [0, 0.62, 0.78]));
  // The stereo pair on the left, the docking plug at the back.
  [-0.26, 0.26].forEach(function (z) {
    const n = unit([1, 0, z]);
    g.add(aim(T, dome(T, 0.06, 0.025, std(T, '#0a0c10', { roughness: 0.06, metalness: 0.5 })), [n[0], n[1], n[2]], n));
  });
  g.add(aim(T, new T.Mesh(new T.TorusGeometry(0.14, 0.02, 10, 40), std(T, STEEL, { metalness: 0.6, roughness: 0.3 })), [0, -0.1, -0.985], [0, 0, -1]));
  g.add(aim(T, disc(T, 0.07, 0.05, std(T, '#c9b37a', { metalness: 0.6, roughness: 0.3 })), [0, -0.1, -0.99], [0, 0, -1]));

  const inside = new T.Group(); inside.name = 'inside';
  const board = new T.Mesh(new T.BoxGeometry(0.75, 0.07, 0.55), std(T, '#2e7d4f')); inside.add(board);
  const chip = new T.Mesh(new T.BoxGeometry(0.2, 0.06, 0.2), std(T, '#23262d')); chip.position.set(0.12, 0.07, 0.02); inside.add(chip);
  const imu = new T.Mesh(new T.BoxGeometry(0.14, 0.08, 0.14), std(T, '#d4a017')); imu.position.set(-0.2, 0.08, -0.1); inside.add(imu);
  const cell = new T.Mesh(new T.BoxGeometry(0.5, 0.18, 0.3), std(T, '#5b6475')); cell.position.set(0, -0.22, 0); inside.add(cell);
  g.add(inside);
  return { group: g, shells: shells, spinners: spinners };
}

/* ---------- Astrobee ---------- */

// The front plate, 1.16 by 1.38 in the model, as the real one is laid out. `glow` gets what lights up: the screen and the status lights.
function paintPlate(): { base: HTMLCanvasElement; glow: HTMLCanvasElement } {
  const W = 812, H = 966, [cv, x] = canvas(W, H), [gv, gl] = canvas(W, H);
  gl.fillStyle = '#000'; gl.fillRect(0, 0, W, H);
  const U = function (u: number) { return u * W; }, V = function (v: number) { return v * H; };
  const grad = x.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, '#f2f3f5'); grad.addColorStop(1, '#e2e4e8');
  x.fillStyle = grad; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#c3c7ce'; x.lineWidth = 4; x.strokeRect(2, 2, W - 4, H - 4);
  const rect = function (u0: number, v0: number, u1: number, v1: number, c: string) { x.fillStyle = c; x.fillRect(U(u0), V(v0), U(u1 - u0), V(v1 - v0)); };
  const dot = function (u: number, v: number, r: number, c: string) { x.fillStyle = c; x.beginPath(); x.arc(U(u), V(v), r, 0, Math.PI * 2); x.fill(); };
  const text = function (s: string, u: number, v: number, size: number, align?: CanvasTextAlign) {
    x.fillStyle = '#2b2e35'; x.font = '600 ' + size + 'px system-ui, sans-serif'; x.textAlign = align || 'center'; x.textBaseline = 'middle'; x.fillText(s, U(u), V(v));
  };
  // Screws.
  [[0.05, 0.035], [0.95, 0.075], [0.05, 0.925], [0.95, 0.965]].forEach(function (p) { dot(p[0], p[1], 13, '#b9a26b'); dot(p[0], p[1], 7, '#6e6243'); });
  // Laser: its warning label and lens, and the three slits.
  x.fillStyle = '#f2c230'; x.beginPath(); x.moveTo(U(0.045), V(0.15)); x.lineTo(U(0.1), V(0.15)); x.lineTo(U(0.0725), V(0.105)); x.fill();
  x.fillStyle = '#f2c230'; x.beginPath(); x.moveTo(U(0.045), V(0.215)); x.lineTo(U(0.1), V(0.215)); x.lineTo(U(0.0725), V(0.17)); x.fill();
  text('Laser', 0.17, 0.095, 21); dot(0.165, 0.15, 17, '#23262d'); dot(0.165, 0.15, 8, '#5a6170');
  [0.15, 0.185, 0.22].forEach(function (v) { rect(0.25, v, 0.36, v + 0.009, '#2b2e35'); });
  // SciCam, HazCam, NavCam.
  text('SciCam', 0.49, 0.085, 21); rect(0.385, 0.115, 0.6, 0.285, '#0d0e11'); rect(0.44, 0.115, 0.56, 0.21, '#16181d');
  text('HazCam', 0.2, 0.262, 19); rect(0.03, 0.285, 0.62, 0.4, '#0d0e11'); rect(0.1, 0.315, 0.3, 0.37, '#1d2026');
  text('NavCam', 0.78, 0.235, 19); rect(0.645, 0.26, 0.9, 0.435, '#101115');
  // The name label.
  rect(0.62, 0.095, 0.96, 0.205, '#fbfbfb'); text('Astrobee', 0.79, 0.125, 25);
  for (let i = 0; i < 44; i++) rect(0.66 + i * 0.0062, 0.15, 0.66 + i * 0.0062 + (i % 3 === 0 ? 0.005 : 0.0026), 0.185, '#1d1f24');
  // The speaker grille.
  rect(0.21, 0.455, 0.74, 0.555, '#3a3d44');
  for (let j = 0; j < 8; j++) for (let i = 0; i < 44; i++) dot(0.222 + i * 0.0118, 0.466 + j * 0.0115, 3, '#16171b');
  // SpeedCam, beside it.
  dot(0.84, 0.505, 21, '#16181d'); dot(0.84, 0.505, 10, '#39404c');
  // The screen, with its two eyes.
  rect(0.19, 0.585, 0.79, 0.85, '#0c1c33');
  const sc = gl.createRadialGradient(U(0.49), V(0.715), 10, U(0.49), V(0.715), U(0.33)); sc.addColorStop(0, '#0f4f8c'); sc.addColorStop(0.75, '#0a3056'); sc.addColorStop(1, '#071c36');
  gl.fillStyle = sc; gl.fillRect(U(0.19), V(0.585), U(0.6), V(0.265));
  x.fillStyle = sc; x.fillRect(U(0.19), V(0.585), U(0.6), V(0.265));
  [0.385, 0.6].forEach(function (u) {
    [x, gl].forEach(function (c) {
      const e = c.createRadialGradient(U(u), V(0.715), 6, U(u), V(0.715), 74); e.addColorStop(0, '#f2fbff'); e.addColorStop(0.42, '#7fe0ff'); e.addColorStop(1, 'rgba(60,170,240,0)');
      c.fillStyle = e; c.beginPath(); c.arc(U(u), V(0.715), 74, 0, Math.PI * 2); c.fill();
    });
  });
  // Home, the status lights, Pwr, the microphone, Wake.
  text('Home', 0.095, 0.655, 19); dot(0.13, 0.715, 18, '#1a1c20'); dot(0.13, 0.715, 12, '#21a35a');
  [['Vid', 0.655], ['Aud', 0.7], ['Live', 0.745]].forEach(function (l) {
    text(l[0] as string, 0.875, l[1] as number, 18);
    gl.fillStyle = '#39e27a'; gl.fillRect(U(0.93), V(l[1] as number) - 5, 20, 10); dot(0.94, l[1] as number, 5, '#39e27a');
  });
  rect(0.83, 0.775, 0.965, 0.865, '#f9f9fa'); text('A', 0.85, 0.79, 15); text('B', 0.85, 0.82, 15); text('C', 0.85, 0.85, 15);
  [0.79, 0.82, 0.85].forEach(function (v) { [0.895, 0.935].forEach(function (u) { dot(u, v, 6, '#2fbf68'); gl.fillStyle = '#39e27a'; gl.beginPath(); gl.arc(U(u), V(v), 6, 0, Math.PI * 2); gl.fill(); }); });
  text('Pwr', 0.135, 0.895, 19); dot(0.3, 0.9, 26, '#17181c');
  dot(0.485, 0.9, 20, '#d7d9de'); dot(0.485, 0.9, 7, '#55595f');
  dot(0.67, 0.91, 26, '#14161a'); dot(0.67, 0.91, 16, '#1f9a57'); text('Wake', 0.82, 0.91, 19);
  return { base: cv, glow: gv };
}

// One fabric side cover, 2 by 2 in the model: blue, as on the robot called Bumble, with a black X across it, slatted vents on two of its
// arms, an alignment square near each corner, and stitching round the edge.
function paintCover(): HTMLCanvasElement {
  const S = 1024, [cv, x] = canvas(S, S), c = S / 2;
  const img = x.createImageData(S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 14; d[i] = 112 + n; d[i + 1] = 156 + n; d[i + 2] = 214 + n; d[i + 3] = 255; }
  x.putImageData(img, 0, 0);
  x.save(); x.translate(c, c);
  x.fillStyle = '#121317';
  [Math.PI / 4, -Math.PI / 4].forEach(function (a) { x.save(); x.rotate(a); x.fillRect(-S, -118, S * 2, 236); x.restore(); });
  x.beginPath(); x.arc(0, 0, 268, 0, Math.PI * 2); x.fill();
  // Vents on two arms.
  [Math.PI / 4, Math.PI * 1.25].forEach(function (a) {
    x.save(); x.rotate(a); x.fillStyle = '#34373e';
    for (let i = 0; i < 16; i++) x.fillRect(282 + i * 10, -84, 5, 168);
    x.restore();
  });
  // The alignment squares, on the arms' ends.
  [Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.25, Math.PI * 1.25].forEach(function (a, k) {
    x.save(); x.rotate(a); x.translate(k < 2 ? 470 : 520, 0); x.rotate(Math.PI / 4);
    x.fillStyle = '#f4f5f7'; x.fillRect(-58, -58, 116, 116); x.fillStyle = '#101114'; x.fillRect(-44, -44, 88, 88); x.fillStyle = '#f4f5f7';
    [[0, 0], [1, 2], [2, 1], [3, 3], [0, 3], [2, 2]].forEach(function (p) { x.fillRect(-44 + p[0] * 22, -44 + p[1] * 22, 22, 22); });
    x.restore();
  });
  x.restore();
  x.strokeStyle = '#d8dee8'; x.lineWidth = 3; x.setLineDash([12, 10]); x.strokeRect(22, 22, S - 44, S - 44); x.setLineDash([]);
  x.save(); x.translate(S - 72, 330); x.rotate(Math.PI / 2); x.fillStyle = '#10131a'; x.font = '600 34px system-ui, sans-serif'; x.textAlign = 'center'; x.fillText('Bumble', 0, 0); x.restore();
  return cv;
}

// A front or back face of a fan module: black, a tall vent of fine slats, a few screws.
function paintVent(): HTMLCanvasElement {
  const W = 256, H = 1000, [cv, x] = canvas(W, H);
  x.fillStyle = '#16171b'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#08090b'; x.fillRect(46, 200, 164, 400);
  x.fillStyle = '#3a3d45';
  for (let j = 0; j < 40; j++) for (let i = 0; i < 9; i++) x.fillRect(54 + i * 17, 208 + j * 9.6, 12, 4);
  x.fillStyle = '#4b4f58'; [[40, 120], [216, 120], [40, 680], [216, 680]].forEach(function (p) { x.beginPath(); x.arc(p[0], p[1], 7, 0, Math.PI * 2); x.fill(); });
  x.fillStyle = '#25272d'; x.fillRect(0, 760, W, 6);
  return cv;
}

// The top: dark, with the three payload bays' outlines and a band of vents.
function paintTop(): HTMLCanvasElement {
  const S = 512, [cv, x] = canvas(S, S);
  x.fillStyle = '#1b1c21'; x.fillRect(0, 0, S, S);
  x.strokeStyle = '#3f434c'; x.lineWidth = 4;
  [[70, 60, 170, 180], [272, 60, 170, 180], [150, 290, 212, 170]].forEach(function (r) { x.strokeRect(r[0], r[1], r[2], r[3]); });
  x.fillStyle = '#34373f'; for (let i = 0; i < 26; i++) x.fillRect(84 + i * 13.4, 256, 7, 20);
  return cv;
}

// A round mesh of fine holes, for the fan's grille: grey wires, see-through between them.
function paintMesh(): HTMLCanvasElement {
  const S = 512, [cv, x] = canvas(S, S);
  x.fillStyle = '#6f7379'; x.fillRect(0, 0, S, S);
  x.globalCompositeOperation = 'destination-out';
  for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) { x.beginPath(); x.arc((i + (j % 2 ? 0.5 : 0)) * 8, j * 7, 3, 0, Math.PI * 2); x.fill(); }
  return cv;
}

// Soft fuzz for the foam corners.
function paintFoam(): HTMLCanvasElement {
  const S = 128, [cv, x] = canvas(S, S), img = x.createImageData(S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = 90 + Math.random() * 120; d[i] = d[i + 1] = d[i + 2] = n; d[i + 3] = 255; }
  x.putImageData(img, 0, 0);
  return cv;
}

// Astrobee for the robots page: half the cube's width is 1 (16 cm). Front +z, up +y, the robot's left +x. `shells` are the outer materials and
// `spinners` the two fans, turning behind their mesh grilles.
function buildCube(T: Three) {
  const shells: THREE.MeshStandardMaterial[] = [], spinners: THREE.Object3D[] = [], g = new T.Group();
  const shelled = function (o: THREE.MeshStandardMaterialParameters) { const m = new T.MeshStandardMaterial(Object.assign({ roughness: 0.6, metalness: 0.05, transparent: true }, o)); if (typeof o.color === 'string') m.color = col(T, o.color); shells.push(m); return m; };
  const cover = texture(T, paintCover()), vent = texture(T, paintVent()), top = texture(T, paintTop()), plate = paintPlate();
  const dark = shelled({ color: '#17181c', roughness: 0.65 }), ventMat = shelled({ map: vent }), topMat = shelled({ map: top }), coverMat = shelled({ map: cover, roughness: 0.85 });

  // The core between the fan modules, and the white front plate on it.
  const core = new T.Mesh(new T.BoxGeometry(1.16, 1.84, 1.72), [dark, dark, topMat, dark, dark, dark]); g.add(core);
  const face = new T.Mesh(new T.PlaneGeometry(1.16, 1.38), shelled({ map: texture(T, plate.base), emissive: '#ffffff', emissiveMap: texture(T, plate.glow), emissiveIntensity: 0.8, roughness: 0.45 }));
  face.position.set(0, 0.23, 0.875); g.add(face);
  const stow = new T.Mesh(new T.BoxGeometry(0.46, 0.3, 0.05), std(T, '#7c828c', { metalness: 0.4 })); stow.position.set(0.04, -0.68, 0.86); g.add(stow);

  // A fan module on each side.
  const mesh = new T.CanvasTexture(paintMesh());
  [-1, 1].forEach(function (s, k) {
    const faces = s > 0 ? [coverMat, dark, topMat, dark, ventMat, ventMat] : [dark, coverMat, topMat, dark, ventMat, ventMat];
    const mod = new T.Mesh(new T.BoxGeometry(0.42, 1.9, 1.9), faces); mod.position.set(s * 0.79, 0, 0); g.add(mod);
    // The fan, its grille and collar, and the lights that curve round it.
    const rotor = new T.Group(); aim(T, rotor, [s * 1.004, 0, 0], [s, 0, 0]);
    rotor.add(disc(T, 0.4, 0.002, std(T, '#0b0c0e')));
    for (let b = 0; b < 7; b++) {
      const a = b * Math.PI * 2 / 7, bl = new T.Mesh(new T.BoxGeometry(0.3, 0.1, 0.004), std(T, '#31343b', { metalness: 0.3 }));
      bl.position.set(Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.004); bl.rotation.z = a; bl.rotateX(0.5); rotor.add(bl);
    }
    rotor.userData.dir = k ? 1 : -1; g.add(rotor); spinners.push(rotor);
    const grille = new T.Mesh(new T.CircleGeometry(0.405, 72), new T.MeshStandardMaterial({ map: mesh, transparent: true, roughness: 0.5, metalness: 0.5 }));
    aim(T, grille, [s * 1.012, 0, 0], [s, 0, 0]); g.add(grille);
    g.add(aim(T, new T.Mesh(new T.TorusGeometry(0.42, 0.028, 12, 72), std(T, '#1a1b1f', { roughness: 0.5 })), [s * 1.01, 0, 0], [s, 0, 0]));
    [0.35, Math.PI + 0.35].forEach(function (a) {
      const arc = new T.Mesh(new T.TorusGeometry(0.49, 0.016, 8, 40, 1.5), new T.MeshBasicMaterial({ color: col(T, '#e6efff') }));
      aim(T, arc, [s * 1.006, 0, 0], [s, 0, 0]); arc.rotateZ(a); g.add(arc);
    });
    // The small lights where the cover meets the front and back.
    [0.955, -0.955].forEach(function (z) { const l = new T.Mesh(new T.BoxGeometry(0.03, 0.14, 0.02), new T.MeshBasicMaterial({ color: col(T, '#dbe7ff') })); l.position.set(s * 0.985, 0, z); g.add(l); });
  });

  // The soft foam corners.
  const foam = new T.CanvasTexture(paintFoam()); foam.wrapS = foam.wrapT = T.RepeatWrapping; foam.repeat.set(5, 3);
  const foamMat = new T.MeshStandardMaterial({ roughness: 1, bumpMap: foam, bumpScale: 0.02 }); foamMat.color = col(T, FOAM);
  const pad = new T.SphereGeometry(1, 36, 24);
  for (let i = 0; i < 8; i++) {
    const b = new T.Mesh(pad, foamMat);
    b.scale.set(0.23, 0.17, 0.23); b.position.set(i & 1 ? 0.8 : -0.8, i & 2 ? 0.95 : -0.95, i & 4 ? 0.84 : -0.84); g.add(b);
    const c = new T.Mesh(pad, foamMat); c.scale.set(0.17, 0.23, 0.17); c.position.set(i & 1 ? 0.87 : -0.87, i & 2 ? 0.86 : -0.86, i & 4 ? 0.93 : -0.93); g.add(c);
  }

  // The back: a dark plate with DockCam, PerchCam and the AR flashlight; the perching arm folded along the bottom.
  const back = new T.Mesh(new T.BoxGeometry(1.16, 1.0, 0.03), std(T, '#23252b', { roughness: 0.6 })); back.position.set(0, 0.4, -0.875); g.add(back);
  [[-0.3, 0.45], [0.3, 0.45]].forEach(function (p) {
    const c = [p[0], p[1], -0.895], n = [0, 0, -1];
    g.add(aim(T, new T.Mesh(new T.BoxGeometry(0.24, 0.24, 0.03), std(T, '#0e0f13')), c, n));
    g.add(aim(T, dome(T, 0.08, 0.03, std(T, '#07080b', { roughness: 0.06, metalness: 0.5 })), [p[0], p[1], -0.91], n));
  });
  g.add(aim(T, disc(T, 0.05, 0.03, std(T, '#fff4c2', { emissive: '#fff4c2', emissiveIntensity: 0.4 })), [0, 0.45, -0.9], [0, 0, -1]));
  const arm = std(T, '#aeb4bd', { metalness: 0.35, roughness: 0.4 }), joint = std(T, '#5d636e', { metalness: 0.5 });
  const armBase = new T.Mesh(new T.BoxGeometry(0.28, 0.24, 0.16), arm); armBase.position.set(-0.42, -0.6, -0.92); g.add(armBase);
  const link = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, 0.8, 20), arm); link.rotation.z = Math.PI / 2; link.position.set(0.02, -0.6, -0.97); g.add(link);
  [-0.38, 0.42].forEach(function (x) { const j = new T.Mesh(new T.SphereGeometry(0.095, 20, 14), joint); j.position.set(x, -0.6, -0.97); g.add(j); });
  [-1, 1].forEach(function (s) { const f = new T.Mesh(new T.BoxGeometry(0.2, 0.045, 0.05), arm); f.position.set(0.53, -0.6 + s * 0.06, -0.97); g.add(f); });

  const inside = new T.Group(); inside.name = 'inside';
  ['#2e7d4f', '#2e6f7d', '#4f2e7d'].forEach(function (col, k) { const bd = new T.Mesh(new T.BoxGeometry(0.8, 0.06, 0.9), std(T, col)); bd.position.set(0, 0.35 - k * 0.28, 0); inside.add(bd); });
  const imu = new T.Mesh(new T.BoxGeometry(0.16, 0.08, 0.16), std(T, '#d4a017')); imu.position.set(0.2, 0.42, 0.2); inside.add(imu);
  [-0.25, 0.25].forEach(function (x) { [-0.25, 0.25].forEach(function (z) { const bt = new T.Mesh(new T.BoxGeometry(0.2, 0.3, 0.2), std(T, '#5b6475')); bt.position.set(x, -0.55, z); inside.add(bt); }); });
  g.add(inside);
  return { group: g, shells: shells, spinners: spinners };
}

/** One part of the ball to point out (the robots page): where its number sits (model units: radius 1 is about 10 cm; front +z, up
 * +y, the robot's left +x), which way that spot faces (`inside`: no facing check, the shell goes see-through), what kind of part
 * it is, and what it does. In the page's language. */
export interface BallPart { id: string; kind: 'cam' | 'sense' | 'move' | 'body'; name: string; text: string; pos: number[]; n: number[]; inside?: boolean }

export { addBallDetails, buildBall, buildCube };

export function ballParts(): BallPart[] {
  return [
    { id: 'main', kind: 'cam', name: L('Main camera', 'মূল ক্যামেরা'), pos: [0, 0.12, 1.02], n: [0, 0.12, 1],
      text: L('Takes the photos and video for the crew and the ground. In Kibo-RPC this is the camera that reads the AR markers (/camera_main). It sits 0.14 m in front of the centre and looks straight ahead.',
        'ক্রু আর মাটির মানুষদের জন্য ছবি আর ভিডিও তোলে। Kibo-RPC-তে এই ক্যামেরাই AR মার্কার পড়ে (/camera_main)। কেন্দ্র থেকে ০.১৪ মি সামনে বসানো, সোজা সামনে তাকায়।') },
    { id: 'stereo', kind: 'cam', name: L('Stereo camera', 'স্টেরিও ক্যামেরা'), pos: [1.02, 0, 0], n: [1, 0, 0],
      text: L('Two navigation cameras side by side, like a pair of eyes, on the robot\'s left side. Int-Ball2 uses them for Visual SLAM: it builds a map of the module and finds itself in it.',
        'পথ চেনার জন্য পাশাপাশি দুটো ক্যামেরা, একজোড়া চোখের মতো, রোবটের বাঁ পাশে। Int-Ball2 এগুলো দিয়ে ভিজ্যুয়াল SLAM করে: মডিউলের ম্যাপ বানায় আর সেই ম্যাপে নিজেকে খুঁজে নেয়।') },
    { id: 'fans', kind: 'move', name: L('Propeller fans ×8', 'প্রপেলার পাখা ×৮'), pos: [0.6, 0.6, 0.6], n: [1, 1, 1],
      text: L('Eight ducted propellers pointing out at angles, half spinning clockwise and half anticlockwise. Running different ones pushes and turns the ball any way. The strongest push is 155 mN, about the weight of a 16 g object on Earth.',
        'নালির ভেতরে বসানো আটটা প্রপেলার, কোণাকুণি বাইরের দিকে মুখ করা; অর্ধেক ঘোরে ঘড়ির কাঁটার দিকে, অর্ধেক উল্টো দিকে। আলাদা আলাদা পাখা চালিয়ে বলটাকে যেকোনো দিকে ঠেলা আর ঘোরানো যায়। সবচেয়ে জোরালো ঠেলা ১৫৫ mN, পৃথিবীতে ১৬ গ্রামের কোনো জিনিসের ওজনের মতো।') },
    { id: 'leds', kind: 'body', name: L('LED rings ×2', 'LED রিং ×২'), pos: [0.47, 0.22, 0.87], n: [0.47, 0.22, 0.85],
      text: L('Two light rings (its "eyes") that show the crew what Int-Ball2 is doing. Their colours can be changed.',
        'দুটো আলোর রিং (এর “চোখ”), Int-Ball2 কী করছে তা ক্রুদের দেখায়। এদের রং বদলানো যায়।') },
    { id: 'mic', kind: 'body', name: L('Microphone', 'মাইক্রোফোন'), pos: [0, 0.62, 0.8], n: [0, 0.62, 0.78],
      text: L('Records sound along with the video.',
        'ভিডিওর সঙ্গে শব্দ রেকর্ড করে।') },
    { id: 'dock', kind: 'move', name: L('Docking plug', 'ডকিং প্লাগ'), pos: [0, -0.1, -1.02], n: [0, 0, -1],
      text: L('Connects to the docking station, where Int-Ball2 parks itself to recharge its battery without help from the crew.',
        'ডকিং স্টেশনের সঙ্গে জোড়া লাগে; ক্রুদের সাহায্য ছাড়াই Int-Ball2 সেখানে গিয়ে বসে ব্যাটারি চার্জ নেয়।') },
    { id: 'usb', kind: 'body', name: L('Velcro and USB', 'ভেলক্রো আর USB'), pos: [-1.0, 0, 0.12], n: [-1, 0, 0],
      text: L('A Velcro patch so the crew can stick it to a wall, and a micro USB connector.',
        'ক্রুরা যাতে দেয়ালে আটকে রাখতে পারেন, সেজন্য একটুকরো ভেলক্রো, আর একটা মাইক্রো USB সংযোগ।') },
    { id: 'inside', kind: 'sense', name: L('Inside: IMU and computer', 'ভেতরে: IMU আর কম্পিউটার'), pos: [-0.35, 0.35, 0], n: [0.2, 0.45, 1], inside: true,
      text: L('An Epson IMU (gyroscopes and accelerometers) feels it turn and speed up, and an NVIDIA Jetson TX2 computer runs ROS, the flight software and user programs (in Docker containers).',
        'Epson-এর একটা IMU (জাইরোস্কোপ আর অ্যাক্সেলেরোমিটার) টের পায় রোবট কতটা ঘুরছে আর গতি বাড়াচ্ছে, আর একটা NVIDIA Jetson TX2 কম্পিউটারে চলে ROS, ওড়ার সফটওয়্যার আর ইউজারদের প্রোগ্রাম (Docker কন্টেইনারে)।') }
  ];
}

