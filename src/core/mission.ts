/* ---------- mission feedback (tells students what is wrong, never where to go) ---------- */
import { captureCheck } from './camera.js';
import { checkpointGoal, checkpointRun, scoreRun } from './checkpoints.js';
import { cameraDir, qAngleDeg } from './quat.js';
import { analyzeRoute } from './route.js';
import { inShrunk, pointStatus, whyText } from './space.js';
import { dist, fmt, vecFmt } from './vec.js';
import { findCheckpoint, findPose, findTarget } from './world.js';
import type { Analysis, Box, CaptureCheck, Goal, MissionStatus, Vec3, Waypoint, World } from './types.js';
import { L } from '../i18n.js';

function dirText(d: Vec3): string {
  const n = ['x', 'y', 'z'];

  for (let k = 0; k < 3; k++) {
    if (Math.abs(d[k]) > 0.985) return (d[k] > 0 ? '+' : '-') + n[k] + (k === 2 ? (d[k] > 0 ? L(' (toward the deck)', ' (মেঝের দিকে)') : L(' (overhead)', ' (ছাদের দিকে)')) : '');
  }

  return '(' + d.map(function (v) { return fmt(v, 2); }).join(', ') + ')';
}

function rangeText(lo: number, hi: number): string { return fmt(lo, 2) + L(' to ', ' থেকে ') + fmt(hi, 2); }
function shrunkBox(b: Box, c: number): Box { return { name: b.name, min: b.min.map(function (v) { return v + c; }), max: b.max.map(function (v) { return v - c; }) }; }

function missionStatus(world: World, route: Waypoint[], analysis?: Analysis): MissionStatus {
  analysis = analysis || analyzeRoute(world, route);
  let s = world.settings, ok = true;
  const reach = analysis.legs.map(function (l) { ok = ok && l.clear; return ok; });
  let lastPose = -1;
  world.mission.forEach(function (id, k) { if (findPose(world, id)) lastPose = k; });
  const run = world.checkpoints.length ? checkpointRun(world, route, analysis, reach) : null;

  const goals = world.mission.map(function (id, k) {
    const c = /^cp/.test(id) && findCheckpoint(world, id);
    if (c) return checkpointGoal(world, c, run!);
    let t = findTarget(world, id), g: Goal;

    if (t) {
      let done = null as { i: number; ck: CaptureCheck } | null, best = null as { i: number; ck: CaptureCheck; score: number } | null;

      route.forEach(function (w, i) {
        const ck = captureCheck(world, t!, analysis.poses[i]);
        if (!ck.front) return;
        if (!done && ck.inRange && ck.aimed && reach[i]) done = { i: i, ck: ck };

        const score = Math.max(0, ck.aim - s.aimTolerance) / Math.max(1, s.aimTolerance) +
          (ck.inRange ? 0 : Math.min(Math.abs(ck.dist - ck.lo), Math.abs(ck.dist - ck.hi)) / Math.max(0.05, s.rangeTolerance)) +
          (reach[i] ? 0 : 0.5);

        if (!best || score < best.score) best = { i: i, ck: ck, score: score };
      });

      g = { id: id, name: t.name, kind: 'target', done: !!done, index: done ? done.i : best ? best.i : -1 };

      if (done) {
        g.message = L('Waypoint ' + (done.i + 1) + ' captures it: ' + fmt(done.ck.dist, 2) + ' m away, camera ' + Math.round(done.ck.aim) + '° off centre.',
          'ওয়েপয়েন্ট ' + (done.i + 1) + ' এটা ধরতে পারে: ' + fmt(done.ck.dist, 2) + ' মি দূর থেকে, ক্যামেরা কেন্দ্র থেকে ' + Math.round(done.ck.aim) + '° সরে।');
      } else if (!best || best.ck.aim > 60) {
        g.message = L('No waypoint looks at it yet. The panel faces ' + dirText(t.normal) + '; stand in front of it and point the camera (+X) at it.',
          'এখনো কোনো ওয়েপয়েন্ট এটার দিকে তাকায়নি। প্যানেলটা ' + dirText(t.normal) + ' দিকে মুখ করা; এর সামনে দাঁড়িয়ে ক্যামেরা (+X) এর দিকে তাক করো।');
      } else {
        const ck = best.ck, wp = L('Waypoint ', 'ওয়েপয়েন্ট ') + (best.i + 1), out: string[] = [];
        const range = L(' (aim for ' + rangeText(ck.lo, ck.hi) + ' m).', ' (' + rangeText(ck.lo, ck.hi) + ' মি রাখার চেষ্টা করো)।');

        if (ck.dist > ck.hi) out.push(wp + L(' is ' + fmt(ck.dist, 2) + ' m away, too far', ' ' + fmt(ck.dist, 2) + ' মি দূরে, বেশি দূরে') + range);
        else if (ck.dist < ck.lo) out.push(wp + L(' is only ' + fmt(ck.dist, 2) + ' m away, too close', ' মাত্র ' + fmt(ck.dist, 2) + ' মি দূরে, বেশি কাছে') + range);

        if (!ck.aimed) out.push(L((out.length ? 'Its' : wp + '\'s') + ' camera is ' + Math.round(ck.aim) + '° off centre (allowed ' + fmt(s.aimTolerance, 1) + '°).',
          (out.length ? 'এর' : wp + '-এর') + ' ক্যামেরা কেন্দ্র থেকে ' + Math.round(ck.aim) + '° সরে আছে (চলবে ' + fmt(s.aimTolerance, 1) + '° পর্যন্ত)।'));
        if (!reach[best.i]) out.push(out.length ? L('Also, a move before it is blocked.', 'তাছাড়া, এর আগের একটা পথ আটকে আছে।') : wp + L(' would work, but a move before it is blocked.', ' দিয়ে হতো, কিন্তু এর আগের একটা পথ আটকে আছে।'));
        g.message = out.join(' ');
      }

      return g;
    }

    const p = findPose(world, id);
    if (!p) return null;
    let mustFinish = k === lastPose, want = cameraDir(p.q), hit = null as { i: number; d: number; turn: number } | null, near = null as { i: number; d: number; turn: number } | null;

    route.forEach(function (w, i) {
      if (mustFinish && i !== route.length - 1) return;
      const pose = analysis.poses[i], d = dist(pose.pos, p!.pos), turn = qAngleDeg(pose.q, p!.q);
      if (!hit && d <= s.poseTolerance + 1e-9 && turn <= s.aimTolerance + 1e-9 && reach[i]) hit = { i: i, d: d, turn: turn };
      if (!near || d < near.d) near = { i: i, d: d, turn: turn };
    });

    g = { id: id, name: p.name, kind: 'pose', done: !!hit, index: hit ? hit.i : near ? near.i : -1 };
    const where = L((mustFinish ? 'Finish at ' : 'Visit ') + vecFmt(p.pos) + ', camera facing ' + dirText(want) + '.', vecFmt(p.pos) + (mustFinish ? '-এ গিয়ে শেষ করো' : '-এ যাও') + ', ক্যামেরা ' + dirText(want) + ' দিকে মুখ করে।');

    if (hit) g.message = L('Waypoint ' + (hit.i + 1) + ' reaches it (' + Math.round(hit.d * 100) + ' cm, ' + Math.round(hit.turn) + '° off).', 'ওয়েপয়েন্ট ' + (hit.i + 1) + ' সেখানে পৌঁছায় (' + Math.round(hit.d * 100) + ' সেমি, ' + Math.round(hit.turn) + '° সরে)।');
    else if (!near) g.message = where;
    else if (near.d > s.poseTolerance) g.message = where + ' ' + L((mustFinish ? 'Your last waypoint' : 'The closest waypoint') + ' is ' + fmt(near.d, 2) + ' m from it.', (mustFinish ? 'তোমার শেষ ওয়েপয়েন্ট' : 'সবচেয়ে কাছের ওয়েপয়েন্ট') + ' সেখান থেকে ' + fmt(near.d, 2) + ' মি দূরে।');
    else if (near.turn > s.aimTolerance) g.message = L('Waypoint ' + (near.i + 1) + ' is in the right spot. Turn the camera to face ' + dirText(want) + ' (now ' + Math.round(near.turn) + '° off).', 'ওয়েপয়েন্ট ' + (near.i + 1) + ' ঠিক জায়গায় আছে। ক্যামেরা ঘুরিয়ে ' + dirText(want) + ' দিকে মুখ করাও (এখন ' + Math.round(near.turn) + '° সরে আছে)।');
    else g.message = L('Waypoint ' + (near.i + 1) + ' is right, but a move before it is blocked.', 'ওয়েপয়েন্ট ' + (near.i + 1) + ' ঠিক আছে, কিন্তু এর আগের একটা পথ আটকে আছে।');

    return g;
  }).filter(Boolean) as Goal[];

  const score = run ? scoreRun(world, goals, run) : null;
  const n = goals.filter(function (g) { return g.done; }).length;

  return {
    goals: goals, done: n, total: goals.length, score: score,
    complete: goals.length > 0 && n === goals.length && analysis.blocked === 0 && (!score || score.inTime)
  };
}

// Explain why leg i is blocked, without fixing it.
function blockHint(world: World, route: Waypoint[], i: number, analysis?: Analysis): string {
  analysis = analysis || analyzeRoute(world, route);
  const leg = analysis.legs[i];
  if (!leg || leg.clear) return '';
  const c = world.settings.clearance, from = i === 0 ? world.start.name : L('waypoint ', 'ওয়েপয়েন্ট ') + i, to = L('waypoint ', 'ওয়েপয়েন্ট ') + (i + 1);

  if (leg.why === 'koz') {
    return L('The straight line from ' + from + ' to ' + to + ' cuts through ' + leg.zone + ' (plus ' + Math.round(c * 100) + ' cm clearance). Add a waypoint beside it so the robot goes around it.',
      from + ' থেকে ' + to + ' পর্যন্ত সোজা রেখাটা ' + leg.zone + '-এর ভেতর দিয়ে যায় (সঙ্গে ' + Math.round(c * 100) + ' সেমি ফাঁক ধরে)। পাশে একটা ওয়েপয়েন্ট বসাও, যাতে রোবট ওটা ঘুরে যায়।');
  }

  const fs = pointStatus(world, leg.from), ts = pointStatus(world, leg.to);
  if (!fs.free) return from.charAt(0).toUpperCase() + from.slice(1) + L(' itself is ' + whyText(fs) + '. Fix that point first.', ' নিজেই ' + whyText(fs) + '। আগে ওই পয়েন্টটা ঠিক করো।');
  if (!ts.free) return outsideText(world, leg.to, to.charAt(0).toUpperCase() + to.slice(1)) + L(' Move it back inside.', ' এটাকে আবার ভেতরে আনো।');
  const boxes = world.kiz.map(function (b) { return shrunkBox(b, c); });
  let ka = -1, kb = -1;
  boxes.forEach(function (b, k) { if (ka < 0 && inShrunk(leg.from, b, 0)) ka = k; if (kb < 0 && inShrunk(leg.to, b, 0)) kb = k; });

  if (ka >= 0 && kb >= 0 && ka !== kb) {
    let A = boxes[ka], B = boxes[kb], lo: number[] = [], hi: number[] = [], gap = false;
    for (let k = 0; k < 3; k++) { lo.push(Math.max(A.min[k], B.min[k])); hi.push(Math.min(A.max[k], B.max[k])); if (lo[k] > hi[k] + 1e-9) gap = true; }
    if (gap) return L(A.name + ' and ' + B.name + ' do not overlap enough for the robot to pass with ' + Math.round(c * 100) + ' cm clearance.', A.name + ' আর ' + B.name + ' এতটা জুড়ে নেই যে ' + Math.round(c * 100) + ' সেমি ফাঁক রেখে রোবট পার হতে পারবে।');

    const over = ['x', 'y', 'z'].map(function (n, k) { return n + ' ' + rangeText(lo[k], hi[k]); }).join(', ');
    return L('This move goes from ' + A.name + ' into ' + B.name + ', and the robot can only cross where they overlap: ' + over + '. The straight line misses that overlap. Put a waypoint in it.',
      'এই পথ ' + A.name + ' থেকে ' + B.name + '-এ যায়, আর রোবট শুধু দুটো যেখানে জুড়েছে সেখান দিয়েই পার হতে পারে: ' + over + '। সোজা রেখাটা ওই জোড়ের জায়গা দিয়ে যায় না। সেখানে একটা ওয়েপয়েন্ট বসাও।');
  }

  return outsideText(world, leg.hit!, L('At the X the line', 'X চিহ্নের জায়গায় রেখাটা')) + L(' Add a waypoint so the path bends around the corner.', ' একটা ওয়েপয়েন্ট বসাও, যাতে পথটা কোণ ঘুরে যায়।');
}

// Which limits a point breaks, measured against the nearest Keep-In Zone (minus clearance).
function outsideText(world: World, p: Vec3, subject: string): string {
  let c = world.settings.clearance, best = null as Box | null, bd = Infinity;

  world.kiz.forEach(function (b) {
    let sb = shrunkBox(b, c), d = 0;
    for (let k = 0; k < 3; k++) d += Math.pow(Math.max(0, sb.min[k] - p[k], p[k] - sb.max[k]), 2);
    if (d < bd) { bd = d; best = sb; }
  });

  if (!best) return subject + L(' is outside the Keep-In Zones.', ' কিপ-ইন জোনের বাইরে।');
  const parts: string[] = [];

  ['x', 'y', 'z'].forEach(function (n, k) {
    if (p[k] < best!.min[k] - 1e-9) parts.push(L(n + ' is ' + fmt(p[k], 3) + ' but ' + best!.name + ' needs at least ' + fmt(best!.min[k], 3), n + ' হলো ' + fmt(p[k], 3) + ', কিন্তু ' + best!.name + '-এ কমপক্ষে ' + fmt(best!.min[k], 3) + ' লাগবে'));
    else if (p[k] > best!.max[k] + 1e-9) parts.push(L(n + ' is ' + fmt(p[k], 3) + ' but ' + best!.name + ' allows at most ' + fmt(best!.max[k], 3), n + ' হলো ' + fmt(p[k], 3) + ', কিন্তু ' + best!.name + '-এ সর্বোচ্চ ' + fmt(best!.max[k], 3) + ' চলে'));
  });

  return subject + L(' leaves the Keep-In Zone: ' + (parts.join('; ') || 'it is too close to the edge') + ' (limits include the ' + Math.round(c * 100) + ' cm clearance).',
    ' কিপ-ইন জোন থেকে বেরিয়ে যায়: ' + (parts.join('; ') || 'কিনারার খুব কাছে চলে গেছে') + ' (সীমার হিসাবে ' + Math.round(c * 100) + ' সেমি ফাঁক ধরা আছে)।');
}

export { blockHint, dirText, missionStatus };
