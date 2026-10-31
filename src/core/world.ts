/* ---------- world ---------- */
import { DEFAULT_WORLD, SCORE_BANDS, X_AXIS } from './defaults.js';
import { L } from '../i18n.js';
import { qNorm, qRotate, topDir } from './quat.js';
import { add, copy, isNum, isVec, len, lerp, norm, scale, sub } from './vec.js';
import type { Box, Checkpoint, NamedPose, Target, Vec3, World, WorldPose } from './types.js';

function fail(msg: string): never { throw new Error(msg); }

// `b`, `p`, `input` and `c` below are raw JSON from a world file or the page: checked here by hand.
function normBox(b: any, path: string, defName: string): Box {
  if (!b || typeof b !== 'object') fail(L(path + ' must be an object with min and max', path + ' এমন একটা অবজেক্ট হতে হবে, যাতে min আর max আছে'));
  if (!isVec(b.min) || !isVec(b.max)) fail(L(path + ' needs "min" and "max" as [x, y, z] numbers', path + '-এ "min" আর "max" লাগবে, [x, y, z] সংখ্যা হিসেবে'));
  const min: number[] = [], max: number[] = [];
  for (let k = 0; k < 3; k++) { min.push(Math.min(b.min[k], b.max[k])); max.push(Math.max(b.min[k], b.max[k])); }
  const out: Box = { name: b.name ? String(b.name) : defName, min: min, max: max };
  if (b.id != null) out.id = String(b.id);
  return out;
}

function normPose(p: any, path: string, defName: string): NamedPose {
  if (!p || !isVec(p.pos)) fail(L(path + ' needs "pos" as [x, y, z] numbers', path + '-এ "pos" লাগবে, [x, y, z] সংখ্যা হিসেবে'));
  if (p.q != null && !isVec(p.q, 4)) fail(L(path + '.q must be [x, y, z, w] numbers', path + '.q হতে হবে [x, y, z, w] সংখ্যা'));
  return { name: p.name ? String(p.name) : defName, pos: p.pos.slice(), q: qNorm(p.q || [0, 0, 0, 1]) };
}

function normalizeWorld(input: any): World {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(L('The world config must be a JSON object', 'ওয়ার্ল্ড কনফিগ একটা JSON অবজেক্ট হতে হবে'));
  const d = copy(DEFAULT_WORLD);
  const w = {} as World;
  w.name = input.name != null ? String(input.name) : (input.kiz ? 'Custom world' : d.name);
  w.robot = Object.assign({}, d.robot, input.robot || {});
  if (!isNum(w.robot.size) || w.robot.size <= 0) w.robot.size = d.robot.size;
  w.settings = Object.assign({}, d.settings, input.settings || {});
  const s = w.settings;

  (['clearance', 'standoff', 'speed', 'turnRate', 'gridRes', 'snap', 'aimTolerance', 'rangeTolerance', 'poseTolerance'] as const).forEach(function (k) {
    if (!isNum(s[k])) fail(L('settings.' + k + ' must be a number', 'settings.' + k + ' একটা সংখ্যা হতে হবে'));
    if (s[k] < 0) fail(L('settings.' + k + ' cannot be negative', 'settings.' + k + ' ঋণাত্মক হতে পারবে না'));
  });

  if (s.clearance < 0) fail(L('settings.clearance cannot be negative', 'settings.clearance ঋণাত্মক হতে পারবে না'));
  if (s.speed <= 0) fail(L('settings.speed must be above 0', 'settings.speed 0-এর বেশি হতে হবে'));
  if (s.turnRate <= 0) fail(L('settings.turnRate must be above 0', 'settings.turnRate 0-এর বেশি হতে হবে'));
  if (s.gridRes < 0.01) fail(L('settings.gridRes must be at least 0.01', 'settings.gridRes কমপক্ষে 0.01 হতে হবে'));
  if (s.snap < 0) fail(L('settings.snap cannot be negative', 'settings.snap ঋণাত্মক হতে পারবে না'));

  const kiz = input.kiz != null ? input.kiz : d.kiz;
  if (!Array.isArray(kiz) || !kiz.length) fail(L('"kiz" must be a list with at least one Keep-In Zone', '"kiz" একটা তালিকা হতে হবে, যাতে অন্তত একটা কিপ-ইন জোন আছে'));
  w.kiz = kiz.map(function (b: any, i: number) { return normBox(b, 'kiz[' + i + ']', 'KIZ ' + (i + 1)); });

  ([['koz', 'KOZ '], ['oasis', 'Oasis ']] as const).forEach(function (kv) {
    const key = kv[0], list = input[key] != null ? input[key] : d[key];
    if (!Array.isArray(list)) fail(L('"' + key + '" must be a list', '"' + key + '" একটা তালিকা হতে হবে'));
    w[key] = list.map(function (b: any, i: number) { return normBox(b, key + '[' + i + ']', kv[1] + (i + 1)); });
  });

  const targets = input.targets != null ? input.targets : d.targets;
  if (!Array.isArray(targets)) fail(L('"targets" must be a list', '"targets" একটা তালিকা হতে হবে'));
  const ids: Record<string, number> = {};

  w.targets = targets.map(function (t: any, i: number) {
    let path = 'targets[' + i + ']', b: Target;

    if (t && isVec(t.pos)) {
      // A marker given by its pose: it faces along its own +z, `size` is the side length.
      if (!isVec(t.q, 4)) fail(L(path + ' needs "q" as [x, y, z, w] numbers next to "pos"', path + '-এ "pos"-এর সঙ্গে "q" লাগবে, [x, y, z, w] সংখ্যা হিসেবে'));
      const q = qNorm(t.q), size = isNum(t.size) && t.size > 0 ? t.size : 0.02;
      const ext = add(scale(map3(qRotate(q, X_AXIS), Math.abs), size / 2), scale(map3(qRotate(q, [0, 1, 0]), Math.abs), size / 2));
      b = { name: t.name ? String(t.name) : 'Target ' + (i + 1), min: sub(t.pos, ext), max: add(t.pos, ext), pos: t.pos.slice(), q: q, size: size } as Target;
      b.normal = topDir(q);
    } else {
      b = normBox(t, path, 'Target ' + (i + 1)) as Target;
      if (t.normal != null && !isVec(t.normal)) fail(L(path + '.normal must be [x, y, z] numbers', path + '.normal হতে হবে [x, y, z] সংখ্যা'));
      b.normal = norm(t.normal || [0, 0, 1]);
      if (len(b.normal) < 0.5) fail(L(path + '.normal cannot be [0, 0, 0]', path + '.normal [0, 0, 0] হতে পারবে না'));
    }

    b.id = t.id != null ? String(t.id) : 'target' + (i + 1);
    if (ids[b.id]) fail(L('Two items share the id "' + b.id + '"', 'দুটো জিনিসের id একই: "' + b.id + '"'));
    ids[b.id] = 1;
    return b;
  });

  // Checkpoints: the sandbox's own form, or entries straight from /mission/get_checkpoints
  // (or that whole response). Worlds that bring their own zones or targets don't inherit the default ones.
  let cps = input.checkpoints != null ? input.checkpoints : (input.kiz || input.targets ? [] : d.checkpoints);
  let goalIn = input.goal != null ? input.goal : input.goalpoint_id != null ? input.goalpoint_id : null;

  if (cps && !Array.isArray(cps) && Array.isArray(cps.checkpoints)) {
    if (goalIn == null) goalIn = cps.goalpoint_id;
    cps = cps.checkpoints;
  }

  if (!Array.isArray(cps)) fail(L('"checkpoints" must be a list', '"checkpoints" একটা তালিকা হতে হবে'));
  if (goalIn == null && input.checkpoints == null && !(input.kiz || input.targets)) goalIn = d.goal;
  w.checkpoints = cps.map(function (c: any, i: number) { return normCheckpoint(c, i, w.targets); });

  w.checkpoints.forEach(function (c) {
    if (ids[c.key]) fail(L('Two items share the id "' + c.key + '"', 'দুটো জিনিসের id একই: "' + c.key + '"'));
    ids[c.key] = 1;
  });

  w.goal = null;

  if (goalIn != null && goalIn !== '') {
    const gcp = findCheckpoint(w, goalIn);
    if (!gcp) fail(L('"goal" is ' + JSON.stringify(goalIn) + ', but no checkpoint has that id', '"goal" হলো ' + JSON.stringify(goalIn) + ', কিন্তু এই id-র কোনো চেকপয়েন্ট নেই'));
    w.goal = gcp.id;
  }

  w.camera = Object.assign({}, d.camera, input.camera || {});
  const cm = w.camera;

  (['width', 'height', 'fx', 'fy', 'cx', 'cy', 'minPerimeterRate', 'maxViewAngle', 'maxDistance'] as const).forEach(function (k) {
    if (!isNum(cm[k]) || cm[k] < 0) fail(L('camera.' + k + ' must be a number, 0 or more', 'camera.' + k + ' একটা সংখ্যা হতে হবে, 0 বা তার বেশি'));
  });

  if (!cm.width || !cm.height || !cm.fx || !cm.fy) fail(L('camera width, height, fx and fy must be above 0', 'camera-র width, height, fx আর fy 0-এর বেশি হতে হবে'));
  if (!isVec(cm.offset)) fail(L('camera.offset must be [x, y, z] in the body frame', 'camera.offset হতে হবে বডি ফ্রেমে [x, y, z]'));
  w.scoring = Object.assign({}, d.scoring, input.scoring || {});
  const sc = w.scoring;

  (['timeLimit', 'goalPoints', 'checkTime'] as const).forEach(function (k) {
    if (!isNum(sc[k]) || sc[k] < 0) fail(L('scoring.' + k + ' must be a number, 0 or more', 'scoring.' + k + ' একটা সংখ্যা হতে হবে, 0 বা তার বেশি'));
  });

  if (sc.timeLimit <= 0) fail(L('scoring.timeLimit must be above 0', 'scoring.timeLimit 0-এর বেশি হতে হবে'));
  if (!Array.isArray(sc.points) || !sc.points.every(isNum)) fail(L('scoring.points must be a list of numbers (points per level, from level 0)', 'scoring.points সংখ্যার একটা তালিকা হতে হবে (প্রতি লেভেলের পয়েন্ট, লেভেল 0 থেকে)'));
  w.start = normPose(input.start || d.start, 'start', 'Start');

  // Overhead and deck hold in every world; the other names only come with the default world.
  w.sides = Object.assign({ '-z': 'Overhead', '+z': 'Deck' }, input.sides || (input.kiz ? {} : d.sides));

  Object.keys(w.sides).forEach(function (k) {
    if (!/^[+-][xyz]$/.test(k)) fail(L('sides keys are "-x", "+x", "-y", "+y", "-z" and "+z"', 'sides-এর key শুধু "-x", "+x", "-y", "+y", "-z" আর "+z" হতে পারে'));
    w.sides[k] = String(w.sides[k]);
  });

  const poses = input.poses != null ? input.poses : d.poses;
  if (!Array.isArray(poses)) fail(L('"poses" must be a list', '"poses" একটা তালিকা হতে হবে'));

  w.poses = poses.map(function (p: any, i: number) {
    const o = normPose(p, 'poses[' + i + ']', 'Pose ' + (i + 1)) as WorldPose;
    o.id = p.id != null ? String(p.id) : 'pose' + (i + 1);
    if (ids[o.id]) fail(L('Two items share the id "' + o.id + '"', 'দুটো জিনিসের id একই: "' + o.id + '"'));
    ids[o.id] = 1;
    return o;
  });

  // "example" is the old name for "mission". An empty mission means: every checkpoint, goal last.
  let ex = input.mission != null ? input.mission : input.example != null ? input.example : (input.targets || input.poses ? null : d.mission);
  if (Array.isArray(ex) && !ex.length && w.checkpoints.length) ex = null;

  w.mission = Array.isArray(ex) ? ex.map(String).filter(function (id) { return ids[id]; })
    : w.checkpoints.length ? w.checkpoints.filter(function (c) { return c.id !== w.goal; }).concat(w.checkpoints.filter(function (c) { return c.id === w.goal; })).map(function (c) { return c.key; })
      : w.targets.map(function (t) { return t.id; }).concat(w.poses.map(function (p) { return p.id; }));

  (['export', 'exportPython'] as const).forEach(function (key) {
    // A world's own template does not inherit the default `pass` and `footer` (it may be another language).
    const own = input[key] || {}, ex = w[key] = Object.assign({}, d[key], input[key] ? { pass: '', footer: '' } : {}, own);
    (['prefix', 'header', 'comment', 'line', 'pass', 'footer'] as const).forEach(function (k) { ex[k] = ex[k] == null ? '' : String(ex[k]); });
  });

  return w;
}

function map3(v: Vec3, f: (n: number) => number): Vec3 { return [f(v[0]), f(v[1]), f(v[2])]; }

// The AR marker number in a target id such as "ar12", or null.
function markerNumber(t: { id: string }): number | null { const m = /(\d+)$/.exec(t.id); return m ? +m[1] : null; }

function normBands<K extends 'radius' | 'angle'>(list: any, key: K, path: string): Array<{ level: number } & Record<K, number>> {
  if (list == null) return [];
  if (!Array.isArray(list)) fail(L(path + ' must be a list of { ' + key + ', level }', path + ' হতে হবে { ' + key + ', level }-এর তালিকা'));

  return list.map(function (b: any, i: number) {
    if (!b || !isNum(b[key]) || !isNum(b.level)) fail(L(path + '[' + i + '] needs "' + key + '" and "level" numbers', path + '[' + i + ']-এ "' + key + '" আর "level" সংখ্যা লাগবে'));
    const o = { level: b.level } as { level: number } & Record<K, number>;
    (o as Record<K, number>)[key] = b[key];
    return o;
  }).sort(function (a: Record<K, number>, b: Record<K, number>) { return a[key] - b[key]; });
}

// One checkpoint, in the sandbox form { id, name, pos, q, marker, scoreBands, centeringBands, rollBands }
// or the /mission/get_checkpoints form { checkpoint_id, position, marker_pose, score_bands, attitude }.
function normCheckpoint(c: any, i: number, targets: Target[]): Checkpoint {
  const path = 'checkpoints[' + i + ']';
  if (!c || typeof c !== 'object') fail(L(path + ' must be an object', path + ' একটা অবজেক্ট হতে হবে'));
  const att = c.attitude || {};
  const id = c.id != null ? c.id : c.checkpoint_id;
  if (!isNum(id)) fail(L(path + ' needs a number "id" (the checkpoint_id)', path + '-এ একটা সংখ্যা "id" লাগবে (checkpoint_id)'));
  const pos = c.pos || c.position, q = c.q || att.quaternion;
  if (!isVec(pos)) fail(L(path + ' needs "pos" as [x, y, z] numbers', path + '-এ "pos" লাগবে, [x, y, z] সংখ্যা হিসেবে'));
  if (q != null && !isVec(q, 4)) fail(L(path + '.q must be [x, y, z, w] numbers', path + '.q হতে হবে [x, y, z, w] সংখ্যা'));
  let marker = c.marker != null ? c.marker : c.marker_pose && c.marker_pose.position;

  if (marker == null) {
    // Fall back to the AR marker with the same number.
    targets.forEach(function (t) { if (marker == null && t.pos && markerNumber(t) === id) marker = t.pos; });
  }

  if (marker != null && !isVec(marker)) fail(L(path + '.marker must be [x, y, z] numbers', path + '.marker হতে হবে [x, y, z] সংখ্যা'));

  const o: Checkpoint = {
    id: id, key: 'cp' + id, name: c.name ? String(c.name) : 'CP ' + id, pos: pos.slice(),
    q: q ? qNorm(q) : null, marker: marker ? marker.slice() : null,
    scoreBands: normBands(c.scoreBands || c.score_bands || SCORE_BANDS, 'radius', path + '.scoreBands'),
    centeringBands: normBands(c.centeringBands || att.centering_bands, 'angle', path + '.centeringBands'),
    rollBands: normBands(c.rollBands || att.roll_bands, 'angle', path + '.rollBands')
  };

  if (!o.scoreBands.length) fail(L(path + '.scoreBands needs at least one band', path + '.scoreBands-এ অন্তত একটা band লাগবে'));
  if (o.rollBands.length && !o.q) fail(L(path + ' has rollBands, so it needs "q" (the attitude to match)', path + '-এ rollBands আছে, তাই "q" লাগবে (যে দিক মেলাতে হবে)'));
  if (o.centeringBands.length && !o.marker) fail(L(path + ' has centeringBands, so it needs "marker" (the AR marker position)', path + '-এ centeringBands আছে, তাই "marker" লাগবে (AR মার্কারের অবস্থান)'));
  return o;
}

// A checkpoint by number (12), sandbox key ("cp12") or numeric string ("12").
function findCheckpoint(world: World, id: unknown): Checkpoint | null {
  const list = world.checkpoints || [];

  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c.key === id || c.id === id || String(c.id) === String(id)) return c;
  }

  return null;
}

function boxCenter(b: { min: Vec3; max: Vec3 }): Vec3 { return lerp(b.min, b.max, 0.5); }
function boxSize(b: { min: Vec3; max: Vec3 }): Vec3 { return sub(b.max, b.min); }

function findTarget(world: World, id: unknown): Target | null {
  for (let i = 0; i < world.targets.length; i++) if (world.targets[i].id === id) return world.targets[i];
  return null;
}

function findPose(world: World, id: unknown): WorldPose | null {
  for (let i = 0; i < world.poses.length; i++) if (world.poses[i].id === id) return world.poses[i];
  return null;
}

function kizBounds(world: World): { min: Vec3; max: Vec3 } {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];

  world.kiz.forEach(function (b) {
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], b.min[k]); max[k] = Math.max(max[k], b.max[k]); }
  });

  return { min: min, max: max };
}

// Everything worth showing: zones, targets, start and poses.
function worldBounds(world: World): { min: Vec3; max: Vec3 } {
  const bb = kizBounds(world), min = bb.min.slice(), max = bb.max.slice();
  function grow(p: Vec3) { for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); } }
  (world.targets as Box[]).concat(world.koz).forEach(function (b) { grow(b.min); grow(b.max); });
  (world.checkpoints || []).forEach(function (c) { grow(c.pos); });
  grow(world.start.pos);
  (world.poses as { pos: Vec3 }[]).concat(world.checkpoints || []).forEach(function (p) { grow(p.pos); });
  return { min: min, max: max };
}

function targetCenter(t: Box): Vec3 { return boxCenter(t); }

export { boxCenter, boxSize, fail, findCheckpoint, findPose, findTarget, kizBounds, markerNumber, normalizeWorld, targetCenter, worldBounds };
