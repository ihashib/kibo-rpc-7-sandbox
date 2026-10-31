// The two robots of the robots page and the sandbox's 3D view, drawn for this project: a simplified, flat-shaded look with its own
// palette (graphite and mint for the ball, sand and teal for the cube), built only from basic shapes. The parts sit where the real
// robots have them, so the page's numbered pins and texts fit.
import type { Three, THREE } from './types.js';
import { L } from '../i18n.js';

const INK = '#1f2933', GRAPHITE = '#3b4856', SLATE = '#5d6b7a', MINT = '#4fd1b5', AMBER = '#f2b84b', SAND = '#ecd9b4', TEAL = '#2a9d8f';

function lit(T: Three, color: string, o?: THREE.MeshStandardMaterialParameters) {
  return new T.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.6, metalness: 0.05, flatShading: true }, o || {}));
}

function aim(T: Three, mesh: THREE.Object3D, p: number[], n: number[]) {
  mesh.position.set(p[0], p[1], p[2]); mesh.lookAt(new T.Vector3(p[0] + n[0], p[1] + n[1], p[2] + n[2])); return mesh;
}

function disc(T: Three, r: number, depth: number, mat: THREE.Material, sides?: number) {
  const g = new T.CylinderGeometry(r, r, depth, sides || 20); g.rotateX(Math.PI / 2); return new T.Mesh(g, mat);
}

function unit(v: number[]) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }

// A ball of radius R (body frame: +X the camera, +Y left, +Z the top) for the sandbox's 3D view: a mint stripe round the middle, a dark
// lens and eight sockets on the diagonals. `mat(color)` gives a lit material.
function addBallDetails(T: Three, group: THREE.Object3D, R: number, mat: (color: string) => THREE.Material) {
  function place(m: THREE.Mesh, dir: number[], d: number, axis: number[]) {
    const n = new T.Vector3(dir[0], dir[1], dir[2]).normalize();
    m.position.copy(n).multiplyScalar(d * R);
    m.quaternion.setFromUnitVectors(new T.Vector3(axis[0], axis[1], axis[2]), n);
    m.userData.ownGeo = true;
    group.add(m);
  }
  const band = new T.Mesh(new T.TorusGeometry(R * 1.004, R * 0.035, 8, 40), mat(MINT));
  band.userData.ownGeo = true; group.add(band);
  place(new T.Mesh(new T.CylinderGeometry(R * 0.2, R * 0.2, R * 0.06, 20), mat(INK)), [1, 0, 0], 1.01, [0, 1, 0]);
  place(new T.Mesh(new T.CylinderGeometry(R * 0.09, R * 0.09, R * 0.07, 16), mat(AMBER)), [1, 0, 0], 1.035, [0, 1, 0]);
  for (let i = 0; i < 8; i++) {
    const dir = [i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1];
    place(new T.Mesh(new T.CylinderGeometry(R * 0.23, R * 0.23, R * 0.03, 16), mat(INK)), dir, 1.004, [0, 1, 0]);
  }
}

// The ball of the robots page: radius 1 (about 10 cm), front +z, up +y, the robot's left +x. `shells` are the outer materials (the
// page makes them see-through to show the inside) and `spinners` the propellers (turn each about its z by userData.dir).
function buildBall(T: Three) {
  const shells: THREE.MeshStandardMaterial[] = [], spinners: THREE.Object3D[] = [], g = new T.Group();
  const shell = lit(T, GRAPHITE, { transparent: true }), trim = lit(T, MINT, { transparent: true });
  shells.push(shell, trim);
  g.add(new T.Mesh(new T.IcosahedronGeometry(1, 3), shell));
  const stripe = new T.Mesh(new T.TorusGeometry(1.003, 0.04, 8, 56), trim); stripe.rotation.x = Math.PI / 2; g.add(stripe);

  // The main camera (front, a little below the middle), the two LED rings above it, the microphone.
  g.add(aim(T, disc(T, 0.13, 0.06, lit(T, INK, { roughness: 0.2 })), [0, -0.18, 0.99], [0, -0.1, 1]));
  g.add(aim(T, disc(T, 0.055, 0.07, lit(T, AMBER, { roughness: 0.2, emissive: AMBER, emissiveIntensity: 0.35 })), [0, -0.18, 1.0], [0, -0.1, 1]));
  [-1, 1].forEach(function (s) {
    const n = unit([s * 0.42, 0.1, 0.9]);
    g.add(aim(T, new T.Mesh(new T.TorusGeometry(0.17, 0.04, 8, 28), lit(T, MINT, { emissive: MINT, emissiveIntensity: 0.6 })), n, n));
  });
  g.add(aim(T, disc(T, 0.035, 0.03, lit(T, INK)), [0, 0.62, 0.785], [0, 0.62, 0.78]));
  // The stereo pair on the left, the docking plug at the back, the velcro patch on the right.
  [-0.26, 0.26].forEach(function (z) { g.add(aim(T, disc(T, 0.08, 0.05, lit(T, INK, { roughness: 0.2 })), [0.985, 0, z], [1, 0, 0])); });
  g.add(aim(T, disc(T, 0.15, 0.05, lit(T, SLATE)), [0, -0.1, -0.99], [0, 0, -1]));
  g.add(aim(T, disc(T, 0.065, 0.07, lit(T, AMBER, { metalness: 0.5 })), [0, -0.1, -1.0], [0, 0, -1]));
  const patch = new T.Mesh(new T.BoxGeometry(0.04, 0.3, 0.14), lit(T, SAND)); patch.position.set(-0.99, 0, 0.12); g.add(patch);

  // Eight fans on the diagonals, half turning each way: a dark socket, a rim, three blades.
  const rim = lit(T, SLATE), socket = lit(T, INK), blade = lit(T, SAND, { metalness: 0.2 });
  for (let i = 0; i < 8; i++) {
    const n = unit([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1]), dir = ((i ^ (i >> 1) ^ (i >> 2)) & 1) ? 1 : -1;
    g.add(aim(T, disc(T, 0.25, 0.04, socket, 18), [n[0] * 0.955, n[1] * 0.955, n[2] * 0.955], n));
    g.add(aim(T, new T.Mesh(new T.TorusGeometry(0.26, 0.03, 6, 20), rim), [n[0] * 0.965, n[1] * 0.965, n[2] * 0.965], n));
    const rotor = new T.Group(); aim(T, rotor, [n[0] * 0.95, n[1] * 0.95, n[2] * 0.95], n);
    for (let b = 0; b < 3; b++) {
      const bl = new T.Mesh(new T.BoxGeometry(0.2, 0.06, 0.01), blade), a = b * Math.PI * 2 / 3;
      bl.position.set(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0); bl.rotation.set(0, 0, a); bl.rotateX(dir * 0.4); rotor.add(bl);
    }
    rotor.add(disc(T, 0.045, 0.04, lit(T, GRAPHITE)));
    rotor.userData.dir = dir; g.add(rotor); spinners.push(rotor);
  }

  const inside = new T.Group(); inside.name = 'inside';
  const board = new T.Mesh(new T.BoxGeometry(0.75, 0.07, 0.55), lit(T, TEAL)); inside.add(board);
  const chip = new T.Mesh(new T.BoxGeometry(0.2, 0.06, 0.2), lit(T, INK)); chip.position.set(0.12, 0.07, 0.02); inside.add(chip);
  const imu = new T.Mesh(new T.BoxGeometry(0.14, 0.08, 0.14), lit(T, AMBER)); imu.position.set(-0.2, 0.08, -0.1); inside.add(imu);
  const cell = new T.Mesh(new T.BoxGeometry(0.5, 0.18, 0.3), lit(T, SLATE)); cell.position.set(0, -0.22, 0); inside.add(cell);
  g.add(inside);
  return { group: g, shells: shells, spinners: spinners };
}

// The cube of the robots page: half the cube's width is 1 (16 cm). Front +z, up +y, the robot's left +x.
function buildCube(T: Three) {
  const shells: THREE.MeshStandardMaterial[] = [], spinners: THREE.Object3D[] = [], g = new T.Group();
  const body = lit(T, SAND, { transparent: true }), side = lit(T, '#d9c291', { transparent: true }), corner = lit(T, GRAPHITE);
  shells.push(body, side);
  const box = function (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
  box(1.2, 1.86, 1.86, body, 0, 0, 0);
  [-1, 1].forEach(function (s, k) {
    box(0.4, 1.86, 1.86, side, s * 0.79, 0, 0);
    // A round fan opening on each side, with a rim, three spokes and the turning impeller behind.
    g.add(aim(T, disc(T, 0.5, 0.03, lit(T, INK), 24), [s * 0.995, 0, 0], [s, 0, 0]));
    g.add(aim(T, new T.Mesh(new T.TorusGeometry(0.5, 0.04, 6, 28), lit(T, SLATE)), [s * 1.0, 0, 0], [s, 0, 0]));
    for (let b = 0; b < 3; b++) { const sp = box(0.02, 0.96, 0.03, lit(T, GRAPHITE), s * 1.012, 0, 0); sp.rotation.x = b * Math.PI / 3; }
    const rotor = new T.Group(); aim(T, rotor, [s * 0.985, 0, 0], [s, 0, 0]);
    for (let b = 0; b < 5; b++) {
      const a = b * Math.PI * 2 / 5, bl = new T.Mesh(new T.BoxGeometry(0.3, 0.1, 0.012), lit(T, MINT, { metalness: 0.2 }));
      bl.position.set(Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0); bl.rotation.set(0, 0, a); bl.rotateX(0.5); rotor.add(bl);
    }
    rotor.userData.dir = k ? 1 : -1; g.add(rotor); spinners.push(rotor);
    // Nozzle slots, front and back.
    [0.5, -0.5].forEach(function (y) { [0.94, -0.94].forEach(function (z) { box(0.26, 0.07, 0.02, lit(T, INK), s * 0.79, y, z); }); });
  });
  // Round corner bumpers.
  for (let i = 0; i < 8; i++) {
    const b = new T.Mesh(new T.IcosahedronGeometry(0.2, 1), corner);
    b.position.set(i & 1 ? 0.9 : -0.9, i & 2 ? 0.85 : -0.85, i & 4 ? 0.85 : -0.85); g.add(b);
  }
  const F = 0.935, A = -0.935;
  // Front: the three cameras in a row, the speed camera, a screen with its light bar, the laser and flashlight.
  box(1.0, 0.34, 0.03, lit(T, GRAPHITE), 0, 0.48, F - 0.012);
  [-0.32, 0, 0.32].forEach(function (x, i) { g.add(aim(T, disc(T, i === 1 ? 0.13 : 0.1, 0.06, lit(T, INK, { roughness: 0.2 })), [x, 0.48, F], [0, 0, 1])); });
  g.add(aim(T, disc(T, 0.06, 0.05, lit(T, INK)), [0.3, -0.05, F], [0, 0, 1]));
  box(0.62, 0.36, 0.03, lit(T, '#134e5e', { emissive: '#134e5e', emissiveIntensity: 0.5 }), 0, -0.42, F);
  box(0.8, 0.05, 0.03, lit(T, MINT, { emissive: MINT, emissiveIntensity: 0.8 }), 0, -0.76, F);
  g.add(aim(T, disc(T, 0.03, 0.05, lit(T, '#e4572e', { emissive: '#e4572e', emissiveIntensity: 0.6 })), [-0.36, 0.14, F], [0, 0, 1]));
  g.add(aim(T, disc(T, 0.06, 0.05, lit(T, '#fff4c2', { emissive: '#fff4c2', emissiveIntensity: 0.4 })), [-0.36, -0.05, F], [0, 0, 1]));
  // Back: the two rear cameras and the arm folded along the bottom.
  [-0.3, 0.3].forEach(function (x) { g.add(aim(T, disc(T, 0.1, 0.05, lit(T, INK, { roughness: 0.2 })), [x, 0.45, A], [0, 0, -1])); });
  const arm = lit(T, SLATE, { metalness: 0.3 });
  box(0.28, 0.24, 0.14, arm, -0.45, -0.62, -0.99);
  const link = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.8, 10), arm); link.rotation.z = Math.PI / 2; link.position.set(0.05, -0.62, -1.03); g.add(link);
  [-0.4, 0.5].forEach(function (x) { const j = new T.Mesh(new T.IcosahedronGeometry(0.1, 1), lit(T, AMBER)); j.position.set(x, -0.62, -1.03); g.add(j); });
  [-1, 1].forEach(function (s) { box(0.05, 0.22, 0.05, arm, 0.62, -0.62 + s * 0.07, -1.03); });
  // Payload bays on top, as outlines.
  [[-0.3, 0.45], [0.3, 0.45], [0, -0.45]].forEach(function (p) {
    const e = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(0.5, 0.01, 0.6)), new T.LineBasicMaterial({ color: GRAPHITE }));
    e.position.set(p[0] * 0.9, 0.935, p[1]); g.add(e);
  });
  const inside = new T.Group(); inside.name = 'inside';
  [TEAL, '#3d5a80', '#7a4e8c'].forEach(function (col, k) { const bd = new T.Mesh(new T.BoxGeometry(0.8, 0.06, 0.9), lit(T, col)); bd.position.set(0, 0.35 - k * 0.28, 0); inside.add(bd); });
  const imu = new T.Mesh(new T.BoxGeometry(0.16, 0.08, 0.16), lit(T, AMBER)); imu.position.set(0.2, 0.42, 0.2); inside.add(imu);
  [-0.25, 0.25].forEach(function (x) { [-0.25, 0.25].forEach(function (z) { const bt = new T.Mesh(new T.BoxGeometry(0.2, 0.3, 0.2), lit(T, SLATE)); bt.position.set(x, -0.55, z); inside.add(bt); }); });
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
    { id: 'main', kind: 'cam', name: L('Main camera', 'মূল ক্যামেরা'), pos: [0, -0.18, 1.0], n: [0, -0.1, 1],
      text: L('Takes the photos and video for the crew and the ground. In Kibo-RPC this is the camera that reads the AR markers (/camera_main). It sits 0.14 m in front of the centre and looks straight ahead.',
        'ক্রু আর মাটির মানুষদের জন্য ছবি আর ভিডিও তোলে। Kibo-RPC-তে এই ক্যামেরাই AR মার্কার পড়ে (/camera_main)। কেন্দ্র থেকে ০.১৪ মি সামনে বসানো, সোজা সামনে তাকায়।') },
    { id: 'stereo', kind: 'cam', name: L('Stereo camera', 'স্টেরিও ক্যামেরা'), pos: [1.02, 0, 0], n: [1, 0, 0],
      text: L('Two navigation cameras side by side, like a pair of eyes, on the robot\'s left side. Int-Ball2 uses them for Visual SLAM: it builds a map of the module and finds itself in it.',
        'পথ চেনার জন্য পাশাপাশি দুটো ক্যামেরা, একজোড়া চোখের মতো, রোবটের বাঁ পাশে। Int-Ball2 এগুলো দিয়ে ভিজ্যুয়াল SLAM করে: মডিউলের ম্যাপ বানায় আর সেই ম্যাপে নিজেকে খুঁজে নেয়।') },
    { id: 'fans', kind: 'move', name: L('Propeller fans ×8', 'প্রপেলার পাখা ×৮'), pos: [0.6, 0.6, 0.6], n: [1, 1, 1],
      text: L('Eight ducted propellers pointing out at angles, half spinning clockwise and half anticlockwise. Running different ones pushes and turns the ball any way. The strongest push is 155 mN, about the weight of a 16 g object on Earth.',
        'নালির ভেতরে বসানো আটটা প্রপেলার, কোণাকুণি বাইরের দিকে মুখ করা; অর্ধেক ঘোরে ঘড়ির কাঁটার দিকে, অর্ধেক উল্টো দিকে। আলাদা আলাদা পাখা চালিয়ে বলটাকে যেকোনো দিকে ঠেলা আর ঘোরানো যায়। সবচেয়ে জোরালো ঠেলা ১৫৫ mN, পৃথিবীতে ১৬ গ্রামের কোনো জিনিসের ওজনের মতো।') },
    { id: 'leds', kind: 'body', name: L('LED rings ×2', 'LED রিং ×২'), pos: [0.42, 0.1, 0.94], n: [0.42, 0.1, 0.9],
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

