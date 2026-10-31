/* ---------- poses and routes ---------- */
import { captureCheck, readMarkers } from './camera.js';
import { L } from '../i18n.js';
import { checkpointCheck } from './checkpoints.js';
import { ANGLE_BANDS, SCORE_BANDS, X_AXIS } from './defaults.js';
import { nearestFree, planPath } from './planner.js';
import { aimQuat, cameraDir, faceQuat, qAngleDeg, qFromAxisAngle, qFromTo, qMul, qNorm, qRotate } from './quat.js';
import { checkSegment, isFree, oasisLength, pointStatus, whyText } from './space.js';
import { add, copy, cross, dist, isNum, isVec, len, norm, roundVec, scale, sub } from './vec.js';
import { fail, findCheckpoint, findPose, findTarget, markerNumber, targetCenter } from './world.js';
import type { Analysis, Checkpoint, Leg, Marker, Pose, Quat, Target, Vec3, Waypoint, WaypointMode, World, WorldPose } from './types.js';

// A pose `standoff` metres in front of the target (clamped into allowed space), camera facing it.
function standoffPose(world: World, target: Target | string | null, standoff?: number): { pos: Vec3; q: Quat; desired: Vec3; clamped: boolean } | null {
  if (typeof target === 'string') target = findTarget(world, target);
  if (!target) return null;
  const c = targetCenter(target);
  const desired = add(c, scale(target.normal, standoff == null ? world.settings.standoff : standoff));
  const pos = nearestFree(world, desired) || desired;
  return { pos: pos, q: faceQuat(pos, c), desired: desired, clamped: dist(pos, desired) > 1e-6 };
}

const MODES: WaypointMode[] = ['keep', 'travel', 'target', 'custom'];

// `w` / `route`: raw JSON from a save, a file or the page, checked here.
function normalizeWaypoint(w: any, i: number): Waypoint {
  if (!w || typeof w !== 'object') fail(L('Waypoint ' + (i + 1) + ' must be an object', 'ওয়েপয়েন্ট ' + (i + 1) + ' একটা অবজেক্ট হতে হবে'));
  const pos = isVec(w.pos) ? w.pos.slice() : (isNum(w.x) && isNum(w.y) && isNum(w.z) ? [w.x, w.y, w.z] : null);
  if (!pos) fail(L('Waypoint ' + (i + 1) + ' needs "pos": [x, y, z]', 'ওয়েপয়েন্ট ' + (i + 1) + '-এ "pos": [x, y, z] লাগবে'));
  const o: Waypoint = { name: w.name ? String(w.name) : L('Waypoint ', 'ওয়েপয়েন্ট ') + (i + 1), pos: pos, mode: MODES.indexOf(w.mode) >= 0 ? w.mode : 'keep' };
  if (w.mode === 'target' || w.target != null) o.target = w.target != null ? String(w.target) : '';

  if (o.mode === 'custom' || w.q != null) {
    if (w.q != null && !isVec(w.q, 4)) fail(L('Waypoint ' + (i + 1) + ' "q" must be [x, y, z, w]', 'ওয়েপয়েন্ট ' + (i + 1) + '-এর "q" হতে হবে [x, y, z, w]'));
    o.q = (w.q || [0, 0, 0, 1]).slice();
  }

  if (w.via) o.via = true;
  return o;
}

function normalizeRoute(route: any): Waypoint[] {
  if (!Array.isArray(route)) fail(L('A route must be a list of waypoints', 'রুট হতে হবে ওয়েপয়েন্টের একটা তালিকা'));
  return route.map(normalizeWaypoint);
}

// Work out the orientation of every waypoint.
function resolveRoute(world: World, route: Waypoint[]): Pose[] {
  let prevPos = world.start.pos, prevQ = qNorm(world.start.q);
  return route.map(function (w) {
    let q = prevQ, t: Target | null;

    if (w.mode === 'travel') {
      const d = sub(w.pos, prevPos);
      if (len(d) > 1e-6) q = qFromTo(X_AXIS, d);
    } else if (w.mode === 'target' && (t = findTarget(world, w.target))) {
      if (dist(w.pos, targetCenter(t)) > 1e-6) q = faceQuat(w.pos, targetCenter(t));
    } else if (w.mode === 'custom' && w.q) {
      q = qNorm(w.q);
    }

    prevPos = w.pos; prevQ = q;
    return { pos: w.pos, q: q };
  });
}

function analyzeRoute(world: World, route: Waypoint[]): Analysis {
  const poses = resolveRoute(world, route), s = world.settings;
  let prevPos = world.start.pos, prevQ = qNorm(world.start.q);
  const out: Analysis = { poses: poses, legs: [], blocked: 0, distance: 0, time: 0, oasis: 0, startStatus: pointStatus(world, world.start.pos) };

  poses.forEach(function (p, i) {
    const seg = checkSegment(world, prevPos, p.pos), d = dist(prevPos, p.pos), turn = qAngleDeg(prevQ, p.q);

    const leg: Leg = {
      index: i, from: prevPos, to: p.pos, qFrom: prevQ, qTo: p.q, dist: d, turn: turn,
      time: Math.max(d / s.speed, turn / s.turnRate), clear: seg.clear, oasis: oasisLength(world, prevPos, p.pos),
      endStatus: pointStatus(world, p.pos)
    };

    if (!seg.clear) { leg.hit = seg.hit; leg.why = seg.why; leg.zone = seg.zone; out.blocked++; }
    out.legs.push(leg);
    out.distance += d; out.time += leg.time; out.oasis += leg.oasis;
    prevPos = p.pos; prevQ = p.q;
  });

  return out;
}

function legEnds(world: World, route: Waypoint[], i: number): { from: Vec3; to: Vec3 } {
  return { from: i === 0 ? world.start.pos : route[i - 1].pos, to: route[i].pos };
}

// Insert via points so leg i (into waypoint i) goes around whatever blocks it.
function routeAround(world: World, route: Waypoint[], i: number): { ok: true; route: Waypoint[]; added: number } | { ok: false; route: Waypoint[]; message: string } {
  const e = legEnds(world, route, i), r = planPath(world, e.from, e.to);
  if (!r.ok) return { ok: false, route: route, message: r.reason };
  const vias = r.points.slice(1, -1).map(function (p): Waypoint { return { name: 'via', pos: p, mode: 'keep', via: true }; });
  return { ok: true, route: route.slice(0, i).concat(vias, route.slice(i)), added: vias.length };
}

function fixRoute(world: World, route: Waypoint[]): { route: Waypoint[]; fixed: number; messages: string[] } {
  let r = copy(route), messages: string[] = [], fixed = 0, i: number;
  const ss = pointStatus(world, world.start.pos);
  if (!ss.free) messages.push(world.start.name + L(' is ' + whyText(ss) + ', so moves from it cannot be fixed.', ' ' + whyText(ss) + ', তাই সেখান থেকে যাওয়ার পথ ঠিক করা যাবে না।'));

  for (i = 0; i < r.length; i++) {
    const st = pointStatus(world, r[i].pos);
    if (st.free) continue;
    const np = nearestFree(world, r[i].pos);
    if (!np) { messages.push(L('Waypoint ' + (i + 1) + ' has no allowed point nearby.', 'ওয়েপয়েন্ট ' + (i + 1) + '-এর কাছে চলার মতো কোনো জায়গা নেই।')); continue; }
    messages.push(L('Moved waypoint ' + (i + 1) + ' ' + Math.round(dist(np, r[i].pos) * 100) + ' cm: it was ' + whyText(st) + '.', 'ওয়েপয়েন্ট ' + (i + 1) + '-কে ' + Math.round(dist(np, r[i].pos) * 100) + ' সেমি সরানো হলো: এটা ' + whyText(st) + ' ছিল।'));
    r[i].pos = roundVec(np, 4);
    if (!isFree(world, r[i].pos)) r[i].pos = np;
  }

  for (i = r.length - 1; i >= 0; i--) {
    const e = legEnds(world, r, i);
    if (checkSegment(world, e.from, e.to).clear) continue;
    const res = routeAround(world, r, i);
    if (res.ok) { r = res.route; fixed++; } else messages.push(L('Move into waypoint ' + (i + 1) + ': ', 'ওয়েপয়েন্ট ' + (i + 1) + '-এ যাওয়ার পথ: ') + res.message);
  }

  return { route: r, fixed: fixed, messages: messages };
}

// A waypoint for a "Go to..." choice: a target id (standoff pose) or a preset pose id.
// "Go to..." is a starting point, never the answer: target and pose goals get a deliberately rough
// pose (too far, too close and/or aimed off centre) that the mission check rejects, so students
// still have to work out the real pose. `salt` varies the mistake between calls.
function hashStr(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

function perpTo(d: Vec3): Vec3 { return norm(cross(d, Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0])); }

// Turn orientation q so the camera swings `deg` degrees sideways.
function swing(q: Quat, deg: number, sign: number): Quat {
  const axis = perpTo(cameraDir(q));
  return qNorm(qMul(qFromAxisAngle(axis, sign * deg * Math.PI / 180), q));
}

function roughTargetPose(world: World, t: Target, salt?: number): Pose {
  const s = world.settings, c = targetCenter(t), h = hashStr(t.id + ':' + (salt || 0));
  const kind = ['far', 'near', 'aim', 'far+aim'][h % 4], sign = (h >> 3) % 2 ? 1 : -1;
  const lo = Math.max(0, s.standoff - s.rangeTolerance), hi = s.standoff + s.rangeTolerance;
  const d = kind === 'near' ? Math.max(0.15, lo - 0.15) : kind === 'aim' ? s.standoff : hi + 0.15 + ((h >> 5) % 10) / 100;
  const want = add(add(c, scale(t.normal, d)), scale(perpTo(t.normal), sign * 0.08));
  let pos = roundVec(nearestFree(world, want) || want, 3);
  if (!isFree(world, pos)) pos = nearestFree(world, want) || want;
  const aimErr = kind.indexOf('aim') >= 0 ? s.aimTolerance + 6 + ((h >> 7) % 9) : 0;
  let q = faceQuat(pos, c);
  if (aimErr) q = swing(q, aimErr, sign);
  const ck = captureCheck(world, t, { pos: pos, q: q });

  // Clamping into the KIZ can pull the distance (nearly) back into range; then spoil the aim instead.
  if (ck.aimed && Math.max(ck.lo - ck.dist, ck.dist - ck.hi, 0) < 0.05) q = swing(faceQuat(pos, c), s.aimTolerance + 8, sign);
  return { pos: pos, q: roundVec(q, 4) };
}

function roughPose(world: World, p: WorldPose, salt?: number): Pose {
  const s = world.settings, h = hashStr(p.id + ':' + (salt || 0)), sign = (h >> 3) % 2 ? 1 : -1;
  const dirs = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], off = scale(dirs[h % 3], sign * (s.poseTolerance + 0.08 + ((h >> 5) % 8) / 100));
  let want = add(p.pos, off), pos = nearestFree(world, want) || want;
  if (dist(pos, p.pos) <= s.poseTolerance) pos = nearestFree(world, sub(p.pos, off)) || pos;
  return { pos: roundVec(pos, 3), q: roundVec(swing(p.q, s.aimTolerance + 10, sign), 4) };
}

function maxBand<K extends string>(bands: Array<Record<K, number>>, key: K): number { return bands.length ? bands[bands.length - 1][key] : Infinity; }

// A checkpoint pose that is close but fails: outside the largest position band, rolled past the
// largest roll band, and/or aimed past the largest centring band.
function roughCheckpointPose(world: World, cp: Checkpoint, salt?: number): Pose {
  const h = hashStr(cp.key + ':' + (salt || 0)), sign = (h >> 3) % 2 ? 1 : -1;

  const kinds = ['far', 'roll', 'aim', 'far+roll'].filter(function (k) {
    return (k.indexOf('roll') < 0 || cp.rollBands.length) && (k !== 'aim' || cp.centeringBands.length);
  });

  const kind = kinds[h % kinds.length], r1 = maxBand(cp.scoreBands, 'radius');
  const look = cp.marker || (cp.q ? add(cp.pos, cameraDir(cp.q)) : add(cp.pos, X_AXIS));
  const away = norm(sub(cp.pos, look)), side = perpTo(away);

  const want = kind.indexOf('far') >= 0
    ? add(add(cp.pos, scale(away, r1 + 0.06 + ((h >> 5) % 8) / 100)), scale(side, sign * 0.03))
    : add(cp.pos, scale(side, sign * 0.04));

  let pos = roundVec(nearestFree(world, want) || want, 3);
  if (!isFree(world, pos)) pos = nearestFree(world, want) || want;
  let base = cp.q || faceQuat(pos, look), q = aimQuat(base, sub(look, pos));
  const rollErr = maxBand(cp.rollBands, 'angle') + 12 + ((h >> 7) % 15), aimErr = maxBand(cp.centeringBands, 'angle') + 8 + ((h >> 7) % 8);
  function roll(qq: Quat, deg: number): Quat { return qNorm(qMul(qFromAxisAngle(cameraDir(qq), deg * Math.PI / 180), qq)); }
  if (kind.indexOf('roll') >= 0) q = roll(q, sign * rollErr);
  if (kind === 'aim') q = swing(q, aimErr, sign);

  // Clamping into the keep-in zone can pull the position back into a band; then spoil the attitude too.
  if (checkpointCheck(world, cp, { pos: pos, q: q }).passed) q = cp.rollBands.length ? roll(q, sign * rollErr) : swing(q, aimErr, sign);
  return { pos: pos, q: roundVec(q, 4) };
}

// A random checkpoint layout in the style of the 7th Kibo-RPC: each checkpoint sits `distance`
// metres from its AR marker, up to `angle` degrees off the marker's normal, camera on the marker
// and a random roll. opts: { seed, count (8), goal (12), distance ([0.45, 0.6]), angle (20) }.
function makeCheckpoints(world: World, opts?: { seed?: number; count?: number; goal?: number; distance?: number[]; angle?: number }) {
  opts = opts || {};
  let seed = (opts.seed == null ? Date.now() : opts.seed) >>> 0;

  function rnd() { // mulberry32
    seed = (seed + 0x6D2B79F5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const markers = world.targets.filter(function (t) { return t.pos && markerNumber(t) != null; }) as Marker[];
  if (!markers.length) fail(L('makeCheckpoints needs AR markers: targets with "pos", "q" and a number at the end of the id', 'চেকপয়েন্ট বানাতে AR মার্কার লাগবে: "pos", "q" আর id-র শেষে একটা নম্বরসহ টার্গেট'));
  const goalN = opts.goal == null ? 12 : opts.goal, dRange = opts.distance || [0.45, 0.6], maxAng = opts.angle == null ? 20 : opts.angle;
  const goalM = markers.filter(function (t) { return markerNumber(t) === goalN; })[0] || markers[markers.length - 1];
  const rest = markers.filter(function (t) { return t !== goalM; });
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)), tmp = rest[i]; rest[i] = rest[j]; rest[j] = tmp; }
  const count = Math.max(1, Math.min(markers.length, opts.count || 8));
  const picked = rest.slice(0, count - 1).concat([goalM]).sort(function (a, b) { return markerNumber(a)! - markerNumber(b)!; });

  const cps = picked.map(function (t) {
    const n = t.normal, tilt = maxAng * Math.sqrt(rnd()) * Math.PI / 180, spin = rnd() * 2 * Math.PI;
    const axis = qRotate(qFromAxisAngle(n, spin), perpTo(n));
    const dir = qRotate(qFromAxisAngle(axis, tilt), n), d = dRange[0] + rnd() * (dRange[1] - dRange[0]);
    const want = add(t.pos, scale(dir, d)), pos = nearestFree(world, want) || want;
    let q = faceQuat(pos, t.pos), roll = (rnd() * 2 - 1) * Math.PI;
    q = qNorm(qMul(qFromAxisAngle(cameraDir(q), roll), q));

    return {
      id: markerNumber(t), name: 'CP ' + markerNumber(t), pos: roundVec(pos, 4), q: roundVec(q, 6), marker: t.pos.slice(),
      scoreBands: copy(SCORE_BANDS), centeringBands: copy(ANGLE_BANDS), rollBands: copy(ANGLE_BANDS)
    };
  });

  return { checkpoints: cps, goal: markerNumber(goalM) };
}

function goToWaypoint(world: World, id: string, salt?: number): Waypoint | null {
  const cp = findCheckpoint(world, id);

  if (cp && typeof id === 'string' && /^cp/.test(id)) {
    const rc = roughCheckpointPose(world, cp, salt);
    return { name: cp.name, pos: rc.pos, mode: 'custom', q: rc.q };
  }

  const t = findTarget(world, id);

  if (t) {
    const rt = roughTargetPose(world, t, salt);
    return { name: t.name, pos: rt.pos, mode: 'custom', q: rt.q, target: t.id };
  }

  if (id === 'start') return { name: world.start.name, pos: world.start.pos.slice(), mode: 'custom', q: world.start.q.slice() };
  const p = findPose(world, id);

  if (p) {
    const rp = roughPose(world, p, salt);
    return { name: p.name, pos: rp.pos, mode: 'custom', q: rp.q };
  }

  return null;
}

function appendGoTo(world: World, route: Waypoint[], id: string): AppendResult {
  const wp = goToWaypoint(world, id, route.length);
  if (!wp) return { ok: false, route: route, message: L('Unknown target "' + id + '"', 'অজানা টার্গেট "' + id + '"') };
  return appendWaypoint(world, route, wp);
}

// Add a waypoint at the end, with via points around anything that blocks the move into it.
interface AppendResult { ok: boolean; route: Waypoint[]; routed?: boolean; added?: number; message?: string }

function appendWaypoint(world: World, route: Waypoint[], wp: Waypoint): AppendResult {
  const r = route.concat([wp]), i = r.length - 1, e = legEnds(world, r, i);
  if (checkSegment(world, e.from, e.to).clear) return { ok: true, route: r, routed: false };
  const res = routeAround(world, r, i);

  return res.ok ? { ok: true, route: res.route, routed: true, added: res.added }
    : { ok: false, route: r, routed: false, message: res.message };
}

// An example route: a rough pose for every mission goal, auto-routed. It shows the shape of a
// solution but completes no goal; students fix each pose using the mission feedback.
function exampleRoute(world: World): Waypoint[] {
  return world.mission.reduce(function (r: Waypoint[], id: string) { return appendGoTo(world, r, id).route; }, []);
}

// A worked example for one goal: a pose that solves it, named "Example: ...".
function exampleWaypoint(world: World, id: string): Waypoint | null {
  const c = /^cp/.test(id) && findCheckpoint(world, id);
  if (c && c.q) return { name: L('Example: ', 'উদাহরণ: ') + c.name, pos: c.pos.slice(), mode: 'custom', q: roundVec(c.q, 4) };
  const t = findTarget(world, id);
  if (t) return { name: L('Example: ', 'উদাহরণ: ') + t.name, pos: roundVec(standoffPose(world, t)!.pos, 3), mode: 'target', target: t.id };
  const p = findPose(world, id);
  if (p) return { name: L('Example: ', 'উদাহরণ: ') + p.name, pos: p.pos.slice(), mode: 'custom', q: roundVec(p.q, 4) };
  return null;
}

// The guided starting route: a worked example for the first goal, then rough drafts for the next
// `rough` goals (2 by default). The other goals are left for the student; nothing more is handed over.
// 4 points by default. Each rough draft is picked so the robot camera can still read its checkpoint's
// AR marker there (Play shows the reading as a demo), while the judge still rejects the pose.
function starterRoute(world: World, opts?: { rough?: number }): Waypoint[] {
  let nRough = opts && opts.rough != null ? opts.rough : 3, ids = world.mission, route: Waypoint[] = [];
  if (!ids.length) return route;
  const ex = exampleWaypoint(world, ids[0]);
  if (ex) route = appendWaypoint(world, route, ex).route;

  ids.slice(ex ? 1 : 0, (ex ? 1 : 0) + nRough).forEach(function (id) {
    let cp = /^cp/.test(id) && findCheckpoint(world, id), wp: Waypoint | null = null;

    for (let salt = route.length; cp && !wp && salt < route.length + 24; salt++) {
      const w = goToWaypoint(world, id, salt);
      if (w && readMarkers(world, { pos: w.pos, q: w.q! }).seen.some(function (m) { return m.id === (cp as Checkpoint).id; })) wp = w;
    }

    route = wp ? appendWaypoint(world, route, wp).route : appendGoTo(world, route, id).route;
  });

  return route;
}

export { analyzeRoute, appendGoTo, appendWaypoint, exampleRoute, exampleWaypoint, fixRoute, goToWaypoint, makeCheckpoints, normalizeRoute, normalizeWaypoint, resolveRoute, routeAround, standoffPose, starterRoute };
