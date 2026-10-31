// The two robots of the robots page and the sandbox's 3D view, designed for this project: a navy orb with a teal glow, and a coral
// pod with twin fan nacelles. Smooth, glossy and built from basic shapes only. They are our own designs for the parts the real robots
// have (cameras, fans, arm, bays...), so the page's numbered pins sit on the matching parts of these models.
import type { Three, THREE } from './types.js';
import { L } from '../i18n.js';

const NAVY = '#16233f', NAVY_DARK = '#0b1426', TEAL = '#2ee6c5', SILVER = '#c9d3df', CORAL = '#e4573d', CREAM = '#f0dfc2', GRAPHITE = '#2b3440', AMBER = '#ffb347', GLASS = '#0e1a2b';

function lit(T: Three, color: string, o?: THREE.MeshStandardMaterialParameters) {
  return new T.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.38, metalness: 0.15 }, o || {}));
}

function glow(T: Three, color: string, k?: number) { return lit(T, color, { emissive: color, emissiveIntensity: k || 0.8, roughness: 0.3 }); }

function aim(T: Three, mesh: THREE.Object3D, p: number[], n: number[]) {
  mesh.position.set(p[0], p[1], p[2]); mesh.lookAt(new T.Vector3(p[0] + n[0], p[1] + n[1], p[2] + n[2])); return mesh;
}

function disc(T: Three, r: number, depth: number, mat: THREE.Material, sides?: number) {
  const g = new T.CylinderGeometry(r, r, depth, sides || 32); g.rotateX(Math.PI / 2); return new T.Mesh(g, mat);
}

function ring(T: Three, r: number, tube: number, mat: THREE.Material) { return new T.Mesh(new T.TorusGeometry(r, tube, 12, 48), mat); }

function unit(v: number[]) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }

// A ball of radius R (body frame: +X the camera, +Y left, +Z the top) for the sandbox's 3D view: a teal stripe round the middle, a
// lens and eight fan sockets on the diagonals. `mat(color)` gives a lit material.
function addBallDetails(T: Three, group: THREE.Object3D, R: number, mat: (color: string) => THREE.Material) {
  function place(m: THREE.Mesh, dir: number[], d: number, axis: number[]) {
    const n = new T.Vector3(dir[0], dir[1], dir[2]).normalize();
    m.position.copy(n).multiplyScalar(d * R);
    m.quaternion.setFromUnitVectors(new T.Vector3(axis[0], axis[1], axis[2]), n);
    m.userData.ownGeo = true;
    group.add(m);
  }
  const band = new T.Mesh(new T.TorusGeometry(R * 1.004, R * 0.03, 10, 56), mat(TEAL));
  band.userData.ownGeo = true; group.add(band);
  place(new T.Mesh(new T.CylinderGeometry(R * 0.2, R * 0.2, R * 0.06, 28), mat(NAVY_DARK)), [1, 0, 0], 1.01, [0, 1, 0]);
  place(new T.Mesh(new T.CylinderGeometry(R * 0.09, R * 0.09, R * 0.07, 20), mat(TEAL)), [1, 0, 0], 1.035, [0, 1, 0]);
  for (let i = 0; i < 8; i++) {
    const dir = [i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1];
    place(new T.Mesh(new T.CylinderGeometry(R * 0.23, R * 0.23, R * 0.03, 24), mat(NAVY_DARK)), dir, 1.004, [0, 1, 0]);
  }
}

// The orb of the robots page: radius 1 (about 10 cm), front +z, up +y, the robot's left +x. `shells` are the outer materials (the page
// makes them see-through to show the inside) and `spinners` the propellers (turn each about its z by userData.dir).
function buildBall(T: Three) {
  const shells: THREE.MeshStandardMaterial[] = [], spinners: THREE.Object3D[] = [], g = new T.Group();
  const shell = lit(T, NAVY, { transparent: true, roughness: 0.28, metalness: 0.25 }), belt = glow(T, TEAL, 0.7);
  belt.transparent = true; shells.push(shell, belt);
  g.add(new T.Mesh(new T.SphereGeometry(1, 72, 48), shell));
  const stripe = new T.Mesh(new T.TorusGeometry(1.004, 0.028, 12, 96), belt); stripe.rotation.x = Math.PI / 2; stripe.rotation.y = 0.0; g.add(stripe);

  // The main camera: a silver bezel, a dark glass eye and a teal iris, just below the middle of the front.
  const eye = [0, -0.18, 0.99], en = [0, -0.1, 1];
  g.add(aim(T, ring(T, 0.15, 0.025, lit(T, SILVER, { metalness: 0.5, roughness: 0.25 })), [0, -0.18, 0.985], en));
  g.add(aim(T, disc(T, 0.14, 0.05, lit(T, GLASS, { roughness: 0.1, metalness: 0.5 })), eye, en));
  g.add(aim(T, disc(T, 0.05, 0.06, glow(T, TEAL, 0.9)), [0, -0.18, 1.0], en));
  // Two glowing LED rings above it, and the microphone.
  [-1, 1].forEach(function (s) {
    const n = unit([s * 0.42, 0.3, 0.85]);
    g.add(aim(T, ring(T, 0.12, 0.026, glow(T, TEAL, 1.0)), [n[0] * 0.995, n[1] * 0.995, n[2] * 0.995], n));
  });
  g.add(aim(T, disc(T, 0.035, 0.03, lit(T, GRAPHITE)), [0, 0.62, 0.785], [0, 0.62, 0.78]));
  // The stereo pair on the left, the docking plug at the back, a grip pad on the right.
  [-0.26, 0.26].forEach(function (z) {
    g.add(aim(T, ring(T, 0.085, 0.015, lit(T, SILVER, { metalness: 0.5 })), [0.98, 0, z], [1, 0, 0]));
    g.add(aim(T, disc(T, 0.075, 0.05, lit(T, GLASS, { roughness: 0.1, metalness: 0.5 })), [0.985, 0, z], [1, 0, 0]));
  });
  g.add(aim(T, ring(T, 0.15, 0.025, lit(T, SILVER, { metalness: 0.5 })), [0, -0.1, -0.985], [0, 0, -1]));
  g.add(aim(T, disc(T, 0.11, 0.05, lit(T, AMBER, { metalness: 0.5, roughness: 0.25 })), [0, -0.1, -0.99], [0, 0, -1]));
  const pad = new T.Mesh(new T.BoxGeometry(0.035, 0.34, 0.16), lit(T, GRAPHITE, { roughness: 0.8 })); pad.position.set(-0.985, 0, 0.12); g.add(pad);
  for (let i = -2; i <= 2; i++) { const slit = new T.Mesh(new T.BoxGeometry(0.04, 0.012, 0.13), lit(T, NAVY_DARK)); slit.position.set(-0.99, i * 0.06, 0.12); g.add(slit); }

  // Eight fans on the diagonals, half turning each way: a dark socket, a silver rim, three curved blades.
  const rimMat = lit(T, SILVER, { metalness: 0.5, roughness: 0.3 }), socket = lit(T, NAVY_DARK, { roughness: 0.6 }), blade = lit(T, TEAL, { metalness: 0.2 });
  for (let i = 0; i < 8; i++) {
    const n = unit([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1]), dir = ((i ^ (i >> 1) ^ (i >> 2)) & 1) ? 1 : -1;
    const dishGeo = new T.SphereGeometry(1.004, 28, 8, 0, Math.PI * 2, 0, 0.26); dishGeo.rotateX(Math.PI / 2);
    g.add(aim(T, new T.Mesh(dishGeo, socket), [0, 0, 0], n));
    g.add(aim(T, ring(T, 0.262, 0.028, rimMat), [n[0] * 0.966, n[1] * 0.966, n[2] * 0.966], n));
    const rotor = new T.Group(); aim(T, rotor, [n[0] * 1.03, n[1] * 1.03, n[2] * 1.03], n);
    for (let b = 0; b < 3; b++) {
      const bl = new T.Mesh(new T.BoxGeometry(0.15, 0.06, 0.008), blade), a = b * Math.PI * 2 / 3;
      bl.position.set(Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0); bl.rotation.set(0, 0, a); bl.rotateX(dir * 0.45); rotor.add(bl);
    }
    rotor.add(disc(T, 0.045, 0.045, rimMat, 20));
    rotor.userData.dir = dir; g.add(rotor); spinners.push(rotor);
  }

  const inside = new T.Group(); inside.name = 'inside';
  const board = new T.Mesh(new T.BoxGeometry(0.75, 0.07, 0.55), lit(T, '#1f8f7a')); inside.add(board);
  const chip = new T.Mesh(new T.BoxGeometry(0.2, 0.06, 0.2), lit(T, NAVY_DARK)); chip.position.set(0.12, 0.07, 0.02); inside.add(chip);
  const imu = new T.Mesh(new T.BoxGeometry(0.14, 0.08, 0.14), lit(T, AMBER)); imu.position.set(-0.2, 0.08, -0.1); inside.add(imu);
  const cell = new T.Mesh(new T.BoxGeometry(0.5, 0.18, 0.3), lit(T, SILVER)); cell.position.set(0, -0.22, 0); inside.add(cell);
  g.add(inside);
  return { group: g, shells: shells, spinners: spinners };
}

// The pod's body is an ellipsoid with these half-sizes; a point of its surface at (x, y) is at this z (front), and faces this way.
const PX = 1.0, PY = 0.75, PZ = 1.35;
function podZ(x: number, y: number, side: number) { return side * PZ * Math.sqrt(Math.max(0, 1 - (x / PX) * (x / PX) - (y / PY) * (y / PY))); }
function podFace(x: number, y: number, side: number) { const z = podZ(x, y, side); return { p: [x, y, z * 1.012 + side * 0.012], n: unit([x / (PX * PX), y / (PY * PY), z / (PZ * PZ)]) }; }

// The pod of the robots page: a coral egg with a dark visor, two fan nacelles on pylons, an arm folded under the belly. Front +z, up +y, the
// robot's left +x; the body is 2 wide, 1.5 tall and 2.7 long.
function buildPod(T: Three) {
  const shells: THREE.MeshStandardMaterial[] = [], spinners: THREE.Object3D[] = [], g = new T.Group();
  const body = lit(T, CORAL, { transparent: true, roughness: 0.3, metalness: 0.1 }), strap = lit(T, CREAM, { transparent: true, roughness: 0.4 });
  shells.push(body, strap);
  const egg = new T.Mesh(new T.SphereGeometry(1, 72, 48), body); egg.scale.set(PX, PY, PZ); g.add(egg);
  // A cream strap round the middle.
  const z0 = -0.2, s0 = Math.sqrt(1 - (z0 / PZ) * (z0 / PZ));
  const band = new T.Mesh(new T.TorusGeometry(s0 * 1.004, 0.05, 10, 72), strap); band.scale.set(PX, PY, 1); band.position.z = z0; g.add(band);

  // The dark visor over the front and a smaller one at the back.
  const glass = lit(T, GLASS, { roughness: 0.12, metalness: 0.5 });
  [[1, 0.78], [-1, 0.55]].forEach(function (v) {
    const geo = new T.SphereGeometry(1, 56, 28, 0, Math.PI * 2, 0, v[1]); geo.rotateX(v[0] > 0 ? Math.PI / 2 : -Math.PI / 2);
    const cap = new T.Mesh(geo, glass); cap.scale.set(PX * 1.012, PY * 1.012, PZ * 1.012); g.add(cap);
  });
  const lens = function (x: number, y: number, side: number, r: number) {
    const f = podFace(x, y, side);
    g.add(aim(T, ring(T, r * 1.15, r * 0.18, lit(T, SILVER, { metalness: 0.5, roughness: 0.25 })), f.p, f.n));
    g.add(aim(T, disc(T, r, 0.05, lit(T, '#05080d', { roughness: 0.08, metalness: 0.6 })), f.p, f.n));
    g.add(aim(T, disc(T, r * 0.4, 0.055, glow(T, '#7aa8ff', 0.6)), f.p, f.n));
  };
  // Front: the three cameras in a row, the speed camera, a screen with a light bar, the laser and the flashlight.
  lens(-0.38, 0.2, 1, 0.085); lens(0, 0.2, 1, 0.11); lens(0.38, 0.2, 1, 0.085); lens(0.5, -0.15, 1, 0.05);
  const sc = podFace(-0.12, -0.32, 1); g.add(aim(T, new T.Mesh(new T.BoxGeometry(0.46, 0.26, 0.03), glow(T, '#2a9df4', 0.7)), sc.p, sc.n));
  const bar = podFace(-0.12, -0.5, 1); g.add(aim(T, new T.Mesh(new T.BoxGeometry(0.46, 0.04, 0.03), glow(T, TEAL, 1.0)), bar.p, bar.n));
  const ls = podFace(-0.55, -0.12, 1); g.add(aim(T, disc(T, 0.025, 0.04, glow(T, '#ff5a3c', 1.0)), ls.p, ls.n));
  const fl = podFace(-0.55, 0.0, 1); g.add(aim(T, disc(T, 0.05, 0.04, glow(T, '#fff4c2', 0.7)), fl.p, fl.n));
  // Back: the two rear cameras.
  lens(-0.3, 0.2, -1, 0.085); lens(0.3, 0.2, -1, 0.085);

  // The nacelles: a cream pod on a pylon on each side, a dark mouth with a turning five-blade fan, a glowing nozzle, a rubber tip.
  const shellN = lit(T, CREAM, { roughness: 0.35 }), mouth = lit(T, '#0a0f17', { roughness: 0.7 }), fan = lit(T, TEAL, { metalness: 0.2, emissive: TEAL, emissiveIntensity: 0.25 });
  [-1, 1].forEach(function (s, k) {
    const pylon = new T.Mesh(new T.BoxGeometry(0.5, 0.09, 0.5), lit(T, GRAPHITE)); pylon.position.set(s * 1.05, 0, -0.1); g.add(pylon);
    const pod = new T.Mesh(new T.CylinderGeometry(0.33, 0.33, 1.1, 40), shellN); pod.rotation.x = Math.PI / 2; pod.position.set(s * 1.3, 0, 0); g.add(pod);
    const nose = new T.Mesh(new T.SphereGeometry(0.33, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), shellN); nose.rotation.x = -Math.PI / 2; nose.position.set(s * 1.3, 0, -0.55); g.add(nose);
    g.add(aim(T, disc(T, 0.29, 0.03, mouth), [s * 1.3, 0, 0.545], [0, 0, 1]));
    g.add(aim(T, ring(T, 0.3, 0.025, lit(T, SILVER, { metalness: 0.5 })), [s * 1.3, 0, 0.55], [0, 0, 1]));
    const accent = ring(T, 0.335, 0.022, glow(T, TEAL, 0.9)); accent.position.set(s * 1.3, 0, 0.3); g.add(accent);
    const band2 = ring(T, 0.335, 0.04, lit(T, GRAPHITE, { metalness: 0.4 })); band2.position.set(s * 1.3, 0, -0.25); g.add(band2);
    const rotor = new T.Group(); rotor.position.set(s * 1.3, 0, 0.53);
    for (let b = 0; b < 5; b++) {
      const a = b * Math.PI * 2 / 5, bl = new T.Mesh(new T.BoxGeometry(0.3, 0.09, 0.01), fan);
      bl.position.set(Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0); bl.rotation.set(0, 0, a); bl.rotateX(0.5); rotor.add(bl);
    }
    rotor.add(disc(T, 0.06, 0.05, lit(T, SILVER, { metalness: 0.5 }), 20));
    rotor.userData.dir = k ? 1 : -1; g.add(rotor); spinners.push(rotor);
    const tip = new T.Mesh(new T.SphereGeometry(0.15, 24, 16), lit(T, GRAPHITE, { roughness: 0.9 })); tip.scale.set(1, 1, 0.8); tip.position.set(s * 1.3, 0, -0.66); g.add(tip);
    g.add(aim(T, ring(T, 0.22, 0.02, glow(T, '#ff9a5a', 0.9)), [s * 1.3, 0, -0.58], [0, 0, -1]));
  });

  // The arm, folded under the belly: a base, two links with an amber joint between, and a two-finger gripper.
  const armM = lit(T, GRAPHITE, { metalness: 0.4 });
  const base = new T.Mesh(new T.BoxGeometry(0.4, 0.16, 0.3), armM); base.position.set(0, -0.69, 0.1); g.add(base);
  const l1 = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.9, 16), armM); l1.rotation.x = Math.PI / 2; l1.position.set(0, -0.8, -0.35); g.add(l1);
  const j1 = new T.Mesh(new T.SphereGeometry(0.09, 20, 14), lit(T, AMBER, { metalness: 0.4 })); j1.position.set(0, -0.8, -0.82); g.add(j1);
  const l2 = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.45, 16), armM); l2.rotation.x = Math.PI / 2; l2.position.set(0, -0.8, -1.05); g.add(l2);
  [-1, 1].forEach(function (s) { const f = new T.Mesh(new T.BoxGeometry(0.04, 0.05, 0.2), armM); f.position.set(s * 0.06, -0.8, -1.35); g.add(f); });

  // Three payload hatches on top: slabs sunk into the body so only a lid shows, a shade darker than it, with a graphite outline.
  [-0.55, 0, 0.55].forEach(function (z) {
    const y = PY * Math.sqrt(1 - (z / PZ) * (z / PZ)) - 0.035;
    const hatch = new T.Mesh(new T.BoxGeometry(0.5, 0.08, 0.34), lit(T, '#c4442c', { roughness: 0.4 })); hatch.position.set(0, y, z); g.add(hatch);
    const edge = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(0.5, 0.08, 0.34)), new T.LineBasicMaterial({ color: GRAPHITE })); edge.position.set(0, y, z); g.add(edge);
  });

  const inside = new T.Group(); inside.name = 'inside';
  ['#1f8f7a', '#3d5a80', '#7a4e8c'].forEach(function (col, k) { const bd = new T.Mesh(new T.BoxGeometry(0.8, 0.05, 1.0), lit(T, col)); bd.position.set(0, 0.3 - k * 0.24, 0); inside.add(bd); });
  const imu = new T.Mesh(new T.BoxGeometry(0.16, 0.08, 0.16), lit(T, AMBER)); imu.position.set(0.2, 0.38, 0.2); inside.add(imu);
  [-0.25, 0.25].forEach(function (x) { [-0.35, 0.35].forEach(function (z) { const bt = new T.Mesh(new T.BoxGeometry(0.2, 0.22, 0.28), lit(T, SILVER)); bt.position.set(x, -0.38, z); inside.add(bt); }); });
  g.add(inside);
  return { group: g, shells: shells, spinners: spinners };
}

// Where the pod's numbered pins sit and which way they face (computed from the same surface as the model), for the robots page.
function podPins() {
  const f = function (x: number, y: number, side: number) { const r = podFace(x, y, side); return { pos: r.p, n: r.n }; };
  return {
    navcam: f(-0.38, 0.2, 1), scicam: f(0, 0.2, 1), hazcam: f(0.38, 0.2, 1), speedcam: f(0.5, -0.15, 1), people: f(-0.12, -0.32, 1),
    dockcam: f(-0.3, 0.2, -1), perchcam: f(0.3, 0.2, -1)
  };
}

/** One part of the ball to point out (the robots page): where its number sits (model units: radius 1 is about 10 cm; front +z, up
 * +y, the robot's left +x), which way that spot faces (`inside`: no facing check, the shell goes see-through), what kind of part
 * it is, and what it does. In the page's language. */
export interface BallPart { id: string; kind: 'cam' | 'sense' | 'move' | 'body'; name: string; text: string; pos: number[]; n: number[]; inside?: boolean }

export { addBallDetails, buildBall, buildPod, podPins };

export function ballParts(): BallPart[] {
  return [
    { id: 'main', kind: 'cam', name: L('Main camera', 'মূল ক্যামেরা'), pos: [0, -0.18, 1.0], n: [0, -0.1, 1],
      text: L('Takes the photos and video for the crew and the ground. In Kibo-RPC this is the camera that reads the AR markers (/camera_main). It sits 0.14 m in front of the centre and looks straight ahead.',
        'ক্রু আর মাটির মানুষদের জন্য ছবি আর ভিডিও তোলে। Kibo-RPC-তে এই ক্যামেরাই AR মার্কার পড়ে (/camera_main)। কেন্দ্র থেকে ০.১৪ মি সামনে বসানো, সোজা সামনে তাকায়।') },
    { id: 'stereo', kind: 'cam', name: L('Stereo camera', 'স্টেরিও ক্যামেরা'), pos: [1.02, 0, 0], n: [1, 0, 0],
      text: L('Two navigation cameras side by side, like a pair of eyes, on the robot\'s left side. Int-Ball2 uses them for Visual SLAM: it builds a map of the module and finds itself in it.',
        'পথ চেনার জন্য পাশাপাশি দুটো ক্যামেরা, একজোড়া চোখের মতো, রোবটের বাঁ পাশে। Int-Ball2 এগুলো দিয়ে ভিজ্যুয়াল SLAM করে: মডিউলের ম্যাপ বানায় আর সেই ম্যাপে নিজেকে খুঁজে নেয়।') },
    { id: 'fans', kind: 'move', name: L('Propeller fans ×8', 'প্রপেলার পাখা ×৮'), pos: [0.6, 0.6, 0.6], n: [1, 1, 1],
      text: L('Eight ducted propellers pointing out at angles, half spinning clockwise and half anticlockwise. Running different ones pushes and turns the ball any way. The strongest push is 155 mN, about the weight of a 16 g object on Earth.',
        'নালির ভেতরে বসানো আটটা প্রপেলার, কোণাকুণি বাইরের দিকে মুখ করা; অর্ধেক ঘোরে ঘড়ির কাঁটার দিকে, অর্ধেক উল্টো দিকে। আলাদা আলাদা পাখা চালিয়ে বলটাকে যেকোনো দিকে ঠেলা আর ঘোরানো যায়। সবচেয়ে জোরালো ঠেলা ১৫৫ mN, পৃথিবীতে ১৬ গ্রামের কোনো জিনিসের ওজনের মতো।') },
    { id: 'leds', kind: 'body', name: L('LED rings ×2', 'LED রিং ×২'), pos: [0.42, 0.3, 0.86], n: [0.42, 0.3, 0.85],
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

