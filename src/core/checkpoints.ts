/* ---------- checkpoints (7th Kibo-RPC) ---------- */
import { angleDeg, cameraDir, rollErrorDeg } from './quat.js';
import { dist, fmt, sub, vecFmt } from './vec.js';
import { markerNumber } from './world.js';
import type { Analysis, Checkpoint, CheckpointCheck, Goal, Pose, Score, Waypoint, World } from './types.js';
import { L } from '../i18n.js';

type Bands<K extends string> = Array<{ level: number } & Record<K, number>>;

// Highest level whose margin covers `v`; 0 = outside every band.
function bandLevel<K extends string>(v: number, bands: Bands<K>, key: K): number {
  let lv = 0;
  bands.forEach(function (b) { if (v <= b[key] + 1e-9 && b.level > lv) lv = b.level; });
  return lv;
}

function outerBand<K extends string>(bands: Bands<K>, key: K): number { return bands.reduce(function (m, b) { return Math.max(m, b[key]); }, 0); }
function bandFor<K extends string>(bands: Bands<K>, key: K, level: number): number | null { for (let i = 0; i < bands.length; i++) if (bands[i].level === level) return bands[i][key]; return null; }
function topLevel(c: Checkpoint): number { return c.scoreBands.reduce(function (m, b) { return Math.max(m, b.level); }, 0); }

// How the judge rates `pose` at checkpoint c. Position, camera centring on the marker and roll about
// the line of sight each get a level from their bands; the lowest one counts (0 = not passed).
function checkpointCheck(world: World, c: Checkpoint, pose: Pose): CheckpointCheck {
  const max = topLevel(c), d = dist(pose.pos, c.pos);
  const centering = c.marker ? angleDeg(cameraDir(pose.q), sub(c.marker, pose.pos)) : 0;
  const roll = c.q ? rollErrorDeg(pose.q, c.q) : 0;

  const lv = {
    pos: bandLevel(d, c.scoreBands, 'radius'),
    centering: c.centeringBands.length ? bandLevel(centering, c.centeringBands, 'angle') : max,
    roll: c.rollBands.length ? bandLevel(Math.abs(roll), c.rollBands, 'angle') : max
  };

  const level = Math.min(lv.pos, lv.centering, lv.roll);
  return { dist: d, centering: centering, roll: roll, levels: lv, level: level, passed: level > 0 };
}

// For each checkpoint: the waypoint that passes it best on a clear route (highest level, earliest on a
// tie), else the closest waypoint; and when the robot gets there, holding still `checkTime` seconds at
// each checkpoint it passes. The mission completion report goes out after the last waypoint.
interface RunHit { i: number; ck: CheckpointCheck; at?: number; inTime?: boolean }
/** Per checkpoint key: the waypoint that passes it best, the nearest one, and one that would pass but can't be reached. */
export interface Run { per: Record<string, { best: RunHit | null; near: (RunHit & { cost: number }) | null; blocked: RunHit | null }>; arrive: number[]; finish: number; limit: number }

function checkpointRun(world: World, route: Waypoint[], analysis: Analysis, reach: boolean[]): Run {
  const sc = world.scoring, per: Run['per'] = {}, holds: Record<number, number> = {};

  world.checkpoints.forEach(function (c) {
    // Assigned in the callback below, so typed with `as` (a plain annotation would narrow them to null).
    let best = null as RunHit | null, near = null as (RunHit & { cost: number }) | null, blocked = null as RunHit | null;

    route.forEach(function (w, i) {
      const ck = checkpointCheck(world, c, analysis.poses[i]);
      if (ck.passed && reach[i] && (!best || ck.level > best.ck.level)) best = { i: i, ck: ck };
      if (ck.passed && !reach[i] && !blocked) blocked = { i: i, ck: ck };

      // The waypoint to give advice about: close to the checkpoint and looking roughly at its marker.
      const cost = ck.dist / outerBand(c.scoreBands, 'radius') + (c.centeringBands.length ? ck.centering / outerBand(c.centeringBands, 'angle') : 0);
      if (!near || cost < near.cost) near = { i: i, ck: ck, cost: cost };
    });

    per[c.key] = { best: best, near: near, blocked: blocked };
    if (best) holds[best.i] = (holds[best.i] || 0) + 1;
  });

  let t = 0, arrive: number[] = [];
  analysis.legs.forEach(function (l, i) { t += l.time; arrive.push(t); t += (holds[i] || 0) * sc.checkTime; });

  Object.keys(per).forEach(function (k) {
    const b = per[k].best;
    if (b) { b.at = arrive[b.i] + sc.checkTime; b.inTime = b.at <= sc.timeLimit + 1e-9; }
  });

  return { per: per, arrive: arrive, finish: t, limit: sc.timeLimit };
}

function markerName(world: World, c: Checkpoint): string | null {
  const t = world.targets.filter(function (x) { return markerNumber(x) === c.id; })[0];
  return t && c.marker && dist(t.pos!, c.marker) < 0.05 ? t.name : null;
}

function levelsText(ck: CheckpointCheck): string {
  return L('position ', 'অবস্থান ') + fmt(ck.dist, 2) + L(' m (Lv', ' মি (Lv') + ck.levels.pos + L('), centring ', '), কেন্দ্রে রাখা ') + Math.round(ck.centering) + '° (Lv' + ck.levels.centering +
    L('), roll ', '), রোল ') + Math.round(Math.abs(ck.roll)) + '° (Lv' + ck.levels.roll + ')';
}

// + roll error = the robot must turn clockwise (seen from behind the camera), so the camera picture turns
// anticlockwise: that is the ⟲ button (Q) in Drive.
function rollWay(roll: number): string {
  const n = Math.round(Math.abs(roll));
  return roll > 0 ? L('roll it ' + n + '° with ⟲ (Q): the camera picture turns anticlockwise', '⟲ (Q) দিয়ে ' + n + '° রোল করো: ক্যামেরার ছবি ঘড়ির কাঁটার উল্টো দিকে ঘুরবে')
    : L('roll it ' + n + '° with ⟳ (E): the camera picture turns clockwise', '⟳ (E) দিয়ে ' + n + '° রোল করো: ক্যামেরার ছবি ঘড়ির কাঁটার দিকে ঘুরবে');
}

// Metres, with a third decimal when two would hide which side of `limit` it is on.
function mText(v: number, limit: number): string { return fmt(v, Math.abs(v - limit) < 0.01 ? 3 : 2); }

// What stands between `ck` and `level`, e.g. "For Lv3: get within 0.1 m and centre the marker within 10°."
function improveText(c: Checkpoint, ck: CheckpointCheck, level: number): string {
  const out: string[] = [], r = bandFor(c.scoreBands, 'radius', level), a = bandFor(c.centeringBands, 'angle', level), ro = bandFor(c.rollBands, 'angle', level);
  if (r != null && ck.levels.pos < level) out.push(L('get within ' + fmt(r, 2) + ' m of its centre', 'কেন্দ্রের ' + fmt(r, 2) + ' মি-র মধ্যে যাও'));
  if (a != null && ck.levels.centering < level) out.push(L('centre the marker within ' + fmt(a, 1) + '°', 'মার্কারটা ' + fmt(a, 1) + '°-এর মধ্যে মাঝখানে আনো'));
  if (ro != null && ck.levels.roll < level) out.push(rollWay(ck.roll) + L(' (within ' + fmt(ro, 1) + '°)', ' (' + fmt(ro, 1) + '°-এর মধ্যে)'));
  return out.length ? L('For Lv' + level + ': ' + out.join('; ') + '.', 'Lv' + level + '-এর জন্য: ' + out.join('; ') + '।') : '';
}

function checkpointGoal(world: World, c: Checkpoint, run: Run): Goal {
  const r = run.per[c.key], b = r.best, sc = world.scoring, counted = !!(b && b.inTime), isGoal = c.id === world.goal;
  const r1 = outerBand(c.scoreBands, 'radius');

  const g: Goal = {
    id: c.key, number: c.id, name: c.name + (isGoal ? L(' (goal)', ' (গোল)') : ''), kind: 'checkpoint', goal: isGoal, done: counted,
    level: counted ? b!.ck.level : 0, points: counted ? (sc.points[b!.ck.level] || 0) : 0,
    index: b ? b.i : r.near ? r.near.i : -1,
    // Where an exported program would ask the judge about this checkpoint.
    notify: b ? b.i : r.near && r.near.ck.dist <= 2 * r1 ? r.near.i : -1
  };

  if (counted) {
    g.message = L('Waypoint ' + (b!.i + 1) + ' passes it at Lv' + b!.ck.level + ' (' + fmt(g.points!, 1) + ' pt): ' + levelsText(b!.ck) + '.', 'ওয়েপয়েন্ট ' + (b!.i + 1) + ' এটা Lv' + b!.ck.level + '-এ পার হয় (' + fmt(g.points!, 1) + ' পয়েন্ট): ' + levelsText(b!.ck) + '।');
    if (b!.ck.level < topLevel(c)) g.message += ' ' + improveText(c, b!.ck, b!.ck.level + 1);
  } else if (b) {
    g.message = L('Waypoint ' + (b.i + 1) + ' would pass it at Lv' + b.ck.level + ', but only after the ' + fmt(sc.timeLimit / 60, 1) + ' min limit. Save time earlier in the route.', 'ওয়েপয়েন্ট ' + (b.i + 1) + ' এটা Lv' + b.ck.level + '-এ পার হতো, কিন্তু ' + fmt(sc.timeLimit / 60, 1) + ' মিনিটের সময়সীমা পেরিয়ে যাওয়ার পরে। রুটের আগের অংশে সময় বাঁচাও।');
  } else if (r.blocked) {
    g.message = L('Waypoint ' + (r.blocked.i + 1) + ' would pass it, but a move before it is blocked.', 'ওয়েপয়েন্ট ' + (r.blocked.i + 1) + ' এটা পার হতো, কিন্তু এর আগের একটা পথ আটকে আছে।');
  } else if (!r.near || r.near.ck.dist > 1) {
    const mk = markerName(world, c);
    g.message = L('No waypoint near it yet. It is at ' + vecFmt(c.pos) + (mk ? ', in front of ' + mk : '') + '. Stand inside its sphere, look at the marker and match its roll.',
      'এখনো এর কাছে কোনো ওয়েপয়েন্ট নেই। এটা আছে ' + vecFmt(c.pos) + '-এ' + (mk ? ', ' + mk + '-এর সামনে' : '') + '। এর গোলকের ভেতরে দাঁড়াও, মার্কারের দিকে তাকাও আর রোল মেলাও।');
  } else {
    const ck = r.near.ck, wp = L('Waypoint ', 'ওয়েপয়েন্ট ') + (r.near.i + 1), out: string[] = [];
    const aMax = fmt(outerBand(c.centeringBands, 'angle'), 1), rMax = fmt(outerBand(c.rollBands, 'angle'), 1);
    if (!ck.levels.pos) out.push(L(wp + ' is ' + mText(ck.dist, r1) + ' m from its centre (Lv1 needs ' + fmt(r1, 2) + ' m or less).', wp + ' কেন্দ্র থেকে ' + mText(ck.dist, r1) + ' মি দূরে (Lv1-এর জন্য ' + fmt(r1, 2) + ' মি বা তার কম লাগবে)।'));
    if (!ck.levels.centering) out.push(L((out.length ? 'Its' : wp + '\'s') + ' camera is ' + Math.round(ck.centering) + '° off the marker (Lv1 needs ' + aMax + '° or less).', (out.length ? 'এর' : wp + '-এর') + ' ক্যামেরা মার্কার থেকে ' + Math.round(ck.centering) + '° সরে আছে (Lv1-এর জন্য ' + aMax + '° বা তার কম লাগবে)।'));
    if (!ck.levels.roll) out.push(L((out.length ? 'And its' : wp + '\'s') + ' roll is off: ' + rollWay(ck.roll) + ' (Lv1 needs ' + rMax + '° or less).', (out.length ? 'আর এর' : wp + '-এর') + ' রোল মিলছে না: ' + rollWay(ck.roll) + ' (Lv1-এর জন্য ' + rMax + '° বা তার কম লাগবে)।'));
    g.message = out.join(' ');
  }

  return g;
}

// The goal checkpoint must be the last one passed; the goal points also need every checkpoint.
function scoreRun(world: World, goals: Goal[], run: Run): Score {
  const sc = world.scoring, cps = goals.filter(function (g) { return g.kind === 'checkpoint'; });
  const goal = cps.filter(function (g) { return g.goal; })[0];

  if (goal && goal.done) {
    const later = cps.filter(function (g) { return !g.goal && g.done && g.index > goal.index; });
    if (later.length) {
      goal.done = false;
      const names = later.map(function (g) { return g.name; }).join(', ');
      goal.message = L('Waypoint ' + (goal.index + 1) + ' passes it at Lv' + goal.level + ', but the goal must be the last checkpoint: ' + names + (later.length > 1 ? ' come' : ' comes') + ' after it.',
        'ওয়েপয়েন্ট ' + (goal.index + 1) + ' এটা Lv' + goal.level + '-এ পার হয়, কিন্তু গোলকে সবশেষ চেকপয়েন্ট হতে হবে: ' + names + ' এর পরে আসে।');
    }
  }

  const inTime = run.finish <= run.limit + 1e-9;
  const cpPts = cps.reduce(function (s, g) { return s + g.points!; }, 0);
  const goalPts = goal && goal.done && inTime && cps.every(function (g) { return g.done; }) ? sc.goalPoints : 0;
  if (goal && goal.done && !goalPts) goal.message += L(' The goal points (' + fmt(sc.goalPoints, 1) + ') also need ' + (inTime ? 'every other checkpoint.' : 'the mission to end within the time limit.'),
    ' গোলের পয়েন্ট (' + fmt(sc.goalPoints, 1) + ') পেতে ' + (inTime ? 'বাকি সব চেকপয়েন্টও পার হতে হবে।' : 'মিশনটাও সময়সীমার মধ্যে শেষ হতে হবে।'));
  const bonus = inTime ? Math.min(2, 1 + (run.limit - run.finish) / run.limit) : 1;
  return { checkpoints: cpPts, goal: goalPts, bonus: bonus, total: (cpPts + goalPts) * bonus, time: run.finish, limit: run.limit, inTime: inTime };
}

export { checkpointCheck, checkpointGoal, checkpointRun, scoreRun };
