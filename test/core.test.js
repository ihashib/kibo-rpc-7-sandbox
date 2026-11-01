'use strict';
// Run with: node --test   (Node 18+)
const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../dist/kibo-nav-sandbox.js'); // built by `npm run build` (npm test builds first)

// The planner and legacy goal tests use the 6th Kibo-RPC world (two keep-in zones, target panels, a
// finish pose). The 7th world (Int-Ball2, checkpoints) has its own tests further down.
const WORLD6 = require('./fixtures/world-6th.json');
const world = K.normalizeWorld(WORLD6);
const close = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);

test('quaternions use [x, y, z, w] and the camera looks along body +X', () => {
  // Facing +y is a 90 degree yaw, same as the astronaut report pose.
  const q = K.qFromTo([1, 0, 0], [0, 1, 0]);
  [0, 0, Math.SQRT1_2, Math.SQRT1_2].forEach((v, i) => close(q[i], v, 1e-9));
  const astro = K.findPose(world, 'astronaut');
  assert.ok(K.dot(K.cameraDir(astro.q), [0, 1, 0]) > 0.9999);
  // Facing straight back (-X) turns about the deck axis, so the robot stays upright.
  assert.deepEqual(K.qFromTo([1, 0, 0], [-1, 0, 0]), [0, 0, 1, 0]);
  // Slerp halfway between identity and a 90 degree yaw is a 45 degree yaw.
  close(K.qAngleDeg([0, 0, 0, 1], K.qSlerp([0, 0, 0, 1], q, 0.5)), 45, 1e-6);
});

test('the default start, astronaut pose and standoff poses are in allowed space', () => {
  assert.ok(K.isFree(world, world.start.pos), 'dock');
  assert.ok(K.isFree(world, K.findPose(world, 'astronaut').pos), 'astronaut');
  for (const t of world.targets) {
    const sp = K.standoffPose(world, t);
    assert.ok(K.isFree(world, sp.pos), `${t.name} standoff ${sp.pos}`);
    const c = world.settings.clearance;
    const inKiz = world.kiz.some((b) => [0, 1, 2].every((k) => sp.pos[k] >= b.min[k] + c - 1e-9 && sp.pos[k] <= b.max[k] - c + 1e-9));
    assert.ok(inKiz, `${t.name} standoff is inside a KIZ shrunk by the clearance`);
  }
});

test('standoff poses are clamped inside the KIZ when the standoff is too long', () => {
  const sp = K.standoffPose(world, 'area4', 3); // 3 m in front of Area 4 would leave KIZ 1
  assert.ok(sp.clamped);
  assert.ok(K.isFree(world, sp.pos));
});

test('the camera faces the target from every standoff pose', () => {
  for (const t of world.targets) {
    const sp = K.standoffPose(world, t);
    const want = K.norm(K.sub(K.targetCenter(t), sp.pos));
    assert.ok(K.dot(K.cameraDir(sp.q), want) > 0.9999, t.name);
    // ...and it looks against the panel normal (at the face of the panel).
    assert.ok(K.dot(K.cameraDir(sp.q), t.normal) < -0.99, t.name);
  }
  // "Face a target" waypoints resolve to the same orientation.
  const route = [{ name: 'a', pos: K.standoffPose(world, 'area2').pos, mode: 'target', target: 'area2' }];
  const [pose] = K.resolveRoute(world, route);
  assert.ok(K.dot(K.cameraDir(pose.q), [0, 0, -1]) > 0.9999, 'Area 2 is overhead (-z)');
});

test('a move leaving the KIZ is blocked and the hit point is reported', () => {
  const r = K.checkSegment(world, world.start.pos, [11, -9.9, 5.4]);
  assert.equal(r.clear, false);
  assert.equal(r.why, 'outside');
  assert.ok(!K.isFree(world, r.hit));
});

test('the planner routes around a Keep-Out Zone that blocks a move', () => {
  const a = [10.9, -9.8, 4.9];
  const b = [10.9, -7.0, 4.9];
  const w = K.normalizeWorld(Object.assign(K.copy(WORLD6), {
    koz: [{ name: 'Wall', min: [10.3, -8.5, 4.32], max: [11.2, -8.3, 5.57] }]
  }));
  assert.ok(K.checkSegment(world, a, b).clear, 'clear without the KOZ');
  const blocked = K.checkSegment(w, a, b);
  assert.equal(blocked.clear, false);
  assert.equal(blocked.why, 'koz');

  const plan = K.planPath(w, a, b);
  assert.ok(plan.ok, plan.reason);
  assert.deepEqual(plan.points[0], a);
  assert.deepEqual(plan.points[plan.points.length - 1], b);
  assert.ok(plan.points.length >= 3, 'needs at least one via point');
  for (let i = 1; i < plan.points.length; i++) {
    assert.ok(K.checkSegment(w, plan.points[i - 1], plan.points[i]).clear, `leg ${i} is clear`);
  }
  // Every via point must keep the clearance from the wall, which leaves a gap at x > 11.25.
  plan.points.slice(1, -1).forEach((p) => assert.ok(K.isFree(w, p)));
});

test('the planner says why when no route exists', () => {
  const w = K.normalizeWorld(Object.assign(K.copy(WORLD6), {
    koz: [{ name: 'Wall', min: [10.2, -8.5, 4.2], max: [11.7, -8.3, 5.7] }]
  }));
  const plan = K.planPath(w, [10.9, -9.8, 4.9], [10.9, -7.0, 4.9]);
  assert.equal(plan.ok, false);
  assert.match(plan.reason, /No clear route/);
});

test('the example route visits every goal on clear moves, but solves none of them', () => {
  const route = K.exampleRoute(world);
  const a = K.analyzeRoute(world, route);
  assert.equal(a.blocked, 0);
  const named = route.filter((w) => !w.via).map((w) => w.name);
  assert.deepEqual(named, ['Area 1', 'Area 2', 'Area 3', 'Area 4', 'Astronaut report']);
  assert.equal(K.missionStatus(world, route, a).done, 0);
  assert.ok(a.distance > 3 && a.time > a.distance / world.settings.speed - 1e-9);
  assert.ok(a.oasis > 0 && a.oasis < a.distance);
});

test('fixRoute pulls stray waypoints into allowed space and clears every move', () => {
  const route = [
    { name: 'outside', pos: [12.5, -8, 5], mode: 'keep' },
    { name: 'far', pos: [10.6, -6.5, 4.5], mode: 'travel' }
  ];
  const w = K.normalizeWorld(Object.assign(K.copy(WORLD6), {
    koz: [{ min: [10.3, -7.6, 4.32], max: [11.3, -7.3, 5.57] }]
  }));
  const res = K.fixRoute(w, route);
  assert.equal(K.analyzeRoute(w, res.route).blocked, 0);
  assert.ok(res.messages.some((m) => /Moved waypoint 1/.test(m)));
});

test('Java export writes one moveTo per waypoint', () => {
  const route = K.exampleRoute(world);
  const java = K.toJava(world, route);
  const calls = java.split('\n').filter((l) => l.startsWith('api.moveTo('));
  assert.equal(calls.length, route.length);
  assert.match(calls[calls.length - 1], /^api\.moveTo\(new Point\(-?\d+(\.\d+)?d, .*\), new Quaternion\(.*f\), false\);$/);
  const exact = K.toJava(world, [{ name: 'Astronaut', pos: [11.143, -6.7607, 4.9654], mode: 'custom', q: [0, 0, 0.707, 0.707] }]);
  assert.match(exact, /api\.moveTo\(new Point\(11\.143d, -6\.7607d, 4\.9654d\), new Quaternion\(0f, 0f, 0\.7071f, 0\.7071f\), false\);/);
  assert.doesNotMatch(java, /WARNING/);
});

test('the export template can be swapped', () => {
  const w = K.normalizeWorld(Object.assign(K.copy(WORLD6), {
    export: { header: '', comment: '', line: 'go({x}, {y}, {z}, {qw});' }
  }));
  assert.equal(K.toJava(w, [{ name: 'a', pos: [10, -10, 4.5], mode: 'keep' }]), 'go(10, -10, 4.5, 0);\n');
});

test('bad world JSON gives a helpful error', () => {
  assert.throws(() => K.normalizeWorld({ kiz: [] }), /at least one Keep-In Zone/);
  assert.throws(() => K.normalizeWorld({ kiz: [{ min: [0, 0], max: [1, 1, 1] }] }), /kiz\[0\]/);
  assert.throws(() => K.normalizeWorld({ settings: { speed: 0 } }), /speed/);
});

test('mission feedback says what is wrong without giving the answer', () => {
  const empty = K.missionStatus(world, []);
  assert.equal(empty.done, 0);
  assert.equal(empty.total, 5);
  assert.match(empty.goals[0].message, /No waypoint looks at it yet/);
  // The finish pose is given (as in the rulebook), but no target standoff coordinates are.
  assert.match(empty.goals[4].message, /Finish at \(11\.143, -6\.7607, 4\.9654\)/);
  empty.goals.slice(0, 4).forEach((g) => assert.doesNotMatch(g.message, /\d+\.\d+, -\d/));

  // Too far from Area 1, but facing it.
  const far = [{ name: 'a', pos: [10.9, -8.8, 5.2], mode: 'target', target: 'area1' }];
  const g = K.missionStatus(world, far).goals[0];
  assert.equal(g.done, false);
  assert.match(g.message, /Waypoint 1 is 1\.78 m away, too far/);

  // A correct solution (exact standoff poses, ending at the astronaut) completes the mission.
  const solution = ['area1', 'area2', 'area3', 'area4'].map((id) => ({ name: id, pos: K.standoffPose(world, id).pos, mode: 'target', target: id }))
    .concat([{ name: 'end', pos: [11.143, -6.7607, 4.9654], mode: 'custom', q: [0, 0, 0.707, 0.707] }]);
  assert.equal(K.missionStatus(world, solution).complete, true);
});

test('a capture only counts when the route up to it is clear', () => {
  // Straight from the dock to in front of Area 1 at z 5.3 misses the KIZ overlap.
  const route = [{ name: 'a', pos: [10.9, -9.8, 5.3], mode: 'target', target: 'area1' }];
  const m = K.missionStatus(world, route);
  assert.equal(m.goals[0].done, false);
  assert.match(m.goals[0].message, /move before it is blocked/);
  const hint = K.blockHint(world, route, 0);
  assert.match(hint, /from KIZ 2 into KIZ 1/);
  assert.match(hint, /x 10\.35 to 10\.45, y -10\.15 to -9\.65, z 4\.37 to 4\.75/);
  // Following the hint (a waypoint in the overlap) clears it.
  const fixed = [{ name: 'gap', pos: [10.4, -9.9, 4.6], mode: 'keep' }].concat(route);
  assert.equal(K.missionStatus(world, fixed).goals[0].done, true);
});

test('"Go to" gives a rough pose: allowed, near the goal, but never good enough', () => {
  for (let salt = 0; salt < 12; salt++) {
    for (const id of ['area1', 'area2', 'area3', 'area4', 'astronaut']) {
      const wp = K.goToWaypoint(world, id, salt);
      assert.ok(K.isFree(world, wp.pos), `${id}/${salt} is in allowed space`);
      const goal = K.missionStatus(world, [wp]).goals.find((g) => g.id === id);
      assert.equal(goal.done, false, `${id}/${salt} must not solve the goal`);
      const target = K.findTarget(world, id);
      if (target) assert.ok(K.dist(wp.pos, K.targetCenter(target)) < 1.6, `${id}/${salt} is near the target`);
      else assert.ok(K.dist(wp.pos, K.findPose(world, id).pos) < 0.4, `${id}/${salt} is near the pose`);
    }
  }
});

test('Python export writes one move_to per waypoint and runs as-is', () => {
  const route = [
    { name: 'Area 1', pos: K.standoffPose(world, 'area1').pos, mode: 'target', target: 'area1' },
    { name: 'Astronaut\nreport', pos: [11.143, -6.7607, 4.9654], mode: 'custom', q: [0, 0, 0.707, 0.707] }
  ];
  const py = K.toPython(world, route);
  assert.match(py, /Not an official Kibo-RPC API/);
  const calls = py.split('\n').filter((l) => l.startsWith('move_to('));
  assert.equal(calls.length, 2);
  assert.equal(calls[1], 'move_to(Point(11.143, -6.7607, 4.9654), Quaternion(0, 0, 0.7071, 0.7071))');
  assert.match(py, /^# 2\. Astronaut report$/m, 'newlines in names cannot break out of a comment');

  const { spawnSync } = require('node:child_process');
  const run = spawnSync('python3', ['-I', '-c', py], { encoding: 'utf8' });
  if (run.error) return; // no python3 on this machine
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /move_to \(11\.143, -6\.7607, 4\.9654\) \(0, 0, 0\.7071, 0\.7071\)/);
});


test('driving uses heading and pitch, so students never type a quaternion', () => {
  // Heading 90 = facing +y; roll 0 is upright: the robot's top (+Z) toward overhead (-z).
  assert.ok(K.dot(K.cameraDir(K.qFromYawPitch(90, 0)), [0, 1, 0]) > 0.9999);
  assert.ok(K.dot(K.topDir(K.qFromYawPitch(90, 0)), [0, 0, -1]) > 0.9999);
  // The dock pose (identity) has its top toward the deck: roll 180 by this measure.
  close(Math.abs(K.yawPitchFromQ([0, 0, 0, 1]).roll), 180, 1e-6);
  // Pitch +90 looks overhead (-z), where Areas 2 and 3 are.
  assert.ok(K.dot(K.cameraDir(K.qFromYawPitch(0, 90)), [0, 0, -1]) > 0.9999);
  // Round trip.
  for (const [y, p] of [[0, 0], [-90, 0], [180, 0], [37, -20], [-120, 65]]) {
    const yp = K.yawPitchFromQ(K.qFromYawPitch(y, p));
    close(yp.pitch, p, 1e-6);
    close(((yp.yaw - y) % 360 + 540) % 360 - 180, 0, 1e-6);
  }
  // Driving to each standoff spot and steering by heading/pitch captures every target.
  const steer = { area1: [-90, 0], area2: [0, 90], area3: [0, 90], area4: [180, 0] };
  const route = Object.entries(steer).map(([id, [y, p]]) => ({ name: id, pos: K.standoffPose(world, id).pos, mode: 'custom', q: K.qFromYawPitch(y, p) }));
  const m = K.missionStatus(world, route);
  assert.equal(m.goals.filter((g) => g.kind === 'target' && g.done).length, 4);
});

test('driving never enters disallowed space and slides along walls', () => {
  const c = world.settings.clearance;
  const nearWall = [11.55 - c - 0.005, -8, 5]; // 5 mm inside KIZ 1's +x limit
  // Straight into the wall: stops.
  const into = K.driveStep(world, nearWall, [0.02, 0, 0]);
  assert.ok(K.isFree(world, into));
  assert.ok(into[0] <= 11.55 - c + 1e-9);
  // Diagonally into the wall: keeps the sideways part.
  const slide = K.driveStep(world, nearWall, [0.02, 0.02, 0]);
  assert.ok(K.isFree(world, slide));
  close(slide[1], -7.98, 1e-9);
  // From outside, the student can drive back in.
  assert.deepEqual(K.driveStep(world, [12, -8, 5], [-0.02, 0, 0]), [11.98, -8, 5]);
});

/* ---------- 7th Kibo-RPC: Int-Ball2, AR markers, checkpoints ---------- */
const world7 = K.normalizeWorld(K.DEFAULT_WORLD);
const solution7 = () => world7.mission.map((id) => {
  const c = K.findCheckpoint(world7, id);
  return { name: c.name, pos: c.pos.slice(), mode: 'custom', q: c.q.slice() };
});

test('the 7th world: dock, 12 AR markers facing into Kibo, checkpoints in allowed space', () => {
  assert.equal(world7.robot.name, 'Int-Ball2');
  assert.deepEqual(world7.start.pos, [0.2, 0, 0]);
  assert.ok(K.isFree(world7, world7.start.pos), 'dock');
  assert.equal(world7.targets.length, 12);
  const mid = K.boxCenter(world7.kiz[0]);
  for (const t of world7.targets) {
    // Each marker's +z points into the module, and it sits on a wall of the keep-in box.
    assert.ok(K.dot(t.normal, K.sub(mid, t.pos)) > 0, `${t.name} faces inward`);
    close(K.dist(K.boxCenter(t), t.pos), 0, 1e-9);
  }
  assert.equal(world7.goal, 12);
  assert.deepEqual(world7.mission, ['cp1', 'cp4', 'cp5', 'cp6', 'cp8', 'cp10', 'cp11', 'cp12'], 'every checkpoint, goal last');
  for (const c of world7.checkpoints) {
    assert.ok(K.isFree(world7, c.pos), `${c.name} is in allowed space`);
    assert.equal(K.checkpointCheck(world7, c, { pos: c.pos, q: c.q }).level, 3, `${c.name} own pose is Lv3`);
  }
  // CP 1 is the manual's example: 0.5 m in front of AR1, camera on the marker.
  const cp1 = K.findCheckpoint(world7, 'cp1');
  close(K.dist(cp1.pos, cp1.marker), 0.5, 1e-3);
  assert.ok(K.dot(K.cameraDir(cp1.q), K.norm(K.sub(cp1.marker, cp1.pos))) > 0.99999);
});

test('a checkpoint level is the lowest of position, centring and roll', () => {
  const c = K.findCheckpoint(world7, 'cp4');
  const away = K.norm(K.sub(c.pos, c.marker)), side = K.norm(K.cross(away, [0, 0, 1]));
  const at = (dPos, rollDeg, aimDeg) => {
    const pos = K.add(c.pos, K.scale(side, dPos));
    let q = K.aimQuat(c.q, K.sub(c.marker, pos)); // look at the marker, keep the roll
    if (rollDeg) q = K.qNorm(K.qMul(K.qFromAxisAngle(K.cameraDir(q), rollDeg * Math.PI / 180), q));
    if (aimDeg) q = K.qNorm(K.qMul(K.qFromAxisAngle(K.topDir(q), aimDeg * Math.PI / 180), q));
    return K.checkpointCheck(world7, c, { pos, q });
  };
  assert.equal(at(0.05).level, 3);
  assert.equal(at(0.15).levels.pos, 2);
  assert.equal(at(0.25).levels.pos, 1);
  assert.equal(at(0.35).passed, false);
  const r = at(0.02, 15);
  assert.deepEqual([r.levels.pos, r.levels.roll, r.level], [3, 2, 2]);
  close(Math.abs(r.roll), 15, 0.5);
  const a = at(0.02, 0, 25);
  assert.deepEqual([a.levels.centering, a.level], [1, 1]);
  assert.equal(at(0.02, 40).passed, false);
});

test('roll: yaw/pitch/roll round trip, and the roll error says which way to turn', () => {
  for (const [y, p, r] of [[0, 0, 0], [30, 10, 25], [-120, 40, -150], [170, -60, 90]]) {
    const ypr = K.yawPitchFromQ(K.qFromYawPitch(y, p, r));
    close(ypr.pitch, p, 1e-6);
    close(((ypr.yaw - y) % 360 + 540) % 360 - 180, 0, 1e-6);
    close(((ypr.roll - r) % 360 + 540) % 360 - 180, 0, 1e-6);
  }
  // From level, a +25° roll target means "turn 25° clockwise" (+); the reverse is -25°.
  close(K.rollErrorDeg(K.qFromYawPitch(30, 10), K.qFromYawPitch(30, 10, 25)), 25, 1e-6);
  close(K.rollErrorDeg(K.qFromYawPitch(30, 10, 25), K.qFromYawPitch(30, 10)), -25, 1e-6);
});

test('the world accepts a /mission/get_checkpoints response as-is', () => {
  const response = {
    checkpoint_count: 1,
    checkpoints: [{
      checkpoint_id: 7,
      position: [1.45, -0.5, 0.4],
      marker_pose: { position: [1.451, -1.001, 0.372], quaternion: [-0.707106781187, 0, 0, 0.707106781187] },
      score_bands: [{ radius: 0.1, level: 3 }, { radius: 0.2, level: 2 }, { radius: 0.3, level: 1 }],
      attitude: {
        quaternion: [0, 0, -0.7071, 0.7071],
        centering_bands: [{ angle: 10, level: 3 }, { angle: 20, level: 2 }, { angle: 30, level: 1 }],
        roll_bands: [{ angle: 10, level: 3 }, { angle: 20, level: 2 }, { angle: 30, level: 1 }]
      }
    }],
    goalpoint_id: 7
  };
  const w = K.normalizeWorld(Object.assign(K.copy(K.DEFAULT_WORLD), { checkpoints: response, goal: undefined }));
  assert.equal(w.checkpoints.length, 1);
  assert.equal(w.goal, 7);
  assert.deepEqual(w.mission, ['cp7']);
  assert.deepEqual(w.checkpoints[0].marker, [1.451, -1.001, 0.372]);
  // The normalized world round-trips.
  assert.deepEqual(K.normalizeWorld(K.copy(w)).checkpoints, w.checkpoints);
  assert.throws(() => K.normalizeWorld(Object.assign(K.copy(K.DEFAULT_WORLD), { goal: 99 })), /no checkpoint has that id/);
});

test('scoring: points per level, goal last, time bonus and the 5 minute limit', () => {
  const sol = solution7();
  const m = K.missionStatus(world7, sol);
  assert.equal(m.complete, true);
  assert.equal(m.score.checkpoints, 80);
  assert.equal(m.score.goal, 30);
  assert.ok(m.score.inTime && m.score.bonus > 1 && m.score.bonus <= 2);
  close(m.score.total, 110 * m.score.bonus, 1e-9);
  close(m.score.bonus, 1 + (300 - m.score.time) / 300, 1e-9);

  // Goal first: its checkpoint still scores, but the goal is not reached.
  const goalFirst = [sol[sol.length - 1]].concat(sol.slice(0, -1));
  const g = K.missionStatus(world7, goalFirst);
  const goal = g.goals.find((x) => x.goal);
  assert.equal(goal.done, false);
  assert.match(goal.message, /must be the last checkpoint/);
  assert.equal(g.score.goal, 0);
  assert.equal(g.score.checkpoints, 80);
  assert.equal(g.complete, false);

  // Too slow: checkpoints after the limit do not count and there is no time bonus.
  const slow = K.normalizeWorld(Object.assign(K.copy(K.DEFAULT_WORLD), { settings: Object.assign({}, K.DEFAULT_WORLD.settings, { speed: 0.03 }) }));
  const s = K.missionStatus(slow, sol);
  assert.equal(s.score.inTime, false);
  assert.equal(s.score.bonus, 1);
  assert.ok(s.done < s.total);
  assert.ok(s.goals.some((x) => /after the 5 min limit/.test(x.message)));
  assert.equal(s.complete, false);
});

test('"Go to" a checkpoint gives a rough pose: allowed, near, but never passing', () => {
  for (let salt = 0; salt < 12; salt++) {
    for (const c of world7.checkpoints) {
      const wp = K.goToWaypoint(world7, c.key, salt);
      assert.equal(wp.name, c.name);
      assert.ok(K.isFree(world7, wp.pos), `${c.key}/${salt} is in allowed space`);
      assert.ok(K.dist(wp.pos, c.pos) < 0.5, `${c.key}/${salt} is near the checkpoint`);
      assert.equal(K.checkpointCheck(world7, c, wp).passed, false, `${c.key}/${salt} must not pass`);
    }
  }
  const ex = K.exampleRoute(world7);
  assert.equal(K.analyzeRoute(world7, ex).blocked, 0);
  assert.equal(K.missionStatus(world7, ex).done, 0);
  // Advice is about the waypoint meant for the checkpoint, not a neighbour that happens to be close.
  K.missionStatus(world7, ex).goals.forEach((g, i) => assert.match(g.message, new RegExp('^Waypoint ' + (i + 1) + '\\b'), g.message));
});

test('makeCheckpoints draws a seeded random layout that always ends at the goal', () => {
  const a = K.makeCheckpoints(world7, { seed: 42 }), b = K.makeCheckpoints(world7, { seed: 42 });
  assert.deepEqual(a, b, 'same seed, same layout');
  assert.notDeepEqual(K.makeCheckpoints(world7, { seed: 43 }), a);
  assert.equal(a.checkpoints.length, 8);
  assert.equal(a.goal, 12);
  assert.ok(a.checkpoints.some((c) => c.id === 12));
  const w = K.normalizeWorld(Object.assign(K.copy(K.DEFAULT_WORLD), a));
  for (const c of w.checkpoints) {
    assert.ok(K.isFree(w, c.pos), c.name);
    assert.equal(K.checkpointCheck(w, c, { pos: c.pos, q: c.q }).level, 3, c.name);
    const d = K.dist(c.pos, c.marker);
    assert.ok(d > 0.3 && d < 0.65, `${c.name} is ${d} m from its marker`);
  }
});

test('Python export pastes into the template and drives /ctl/command, then checkpoint_passed', () => {
  const sol = solution7();
  const py = K.toPython(world7, sol);
  assert.equal(py.split('\n').filter((l) => /^ {12}if not move_to\(/.test(l)).length, sol.length);
  assert.equal(py.split('\n').filter((l) => /^ {12}self\.__notify_checkpoint_passed\(\d+\)$/.test(l)).length, 8);
  assert.doesNotMatch(py, /Not an official/);

  // Run it inside a stand-in for the template class, with ROS stubbed out.
  const harness = [
    'import types',
    'class _Any:',
    '    def __init__(self, **kw): self.__dict__.update(kw)',
    '    def __getattr__(self, k): v = _Any(); setattr(self, k, v); return v',
    'class _Dur:',
    '    def __init__(self, s): self.s = s',
    'rospy = types.SimpleNamespace(Duration=_Dur, Time=types.SimpleNamespace(now=lambda: 0), sleep=lambda s: None, logwarn=print)',
    'PoseStamped = _Any',
    'CtlCommandGoal = _Any',
    'class CtlStatusType(_Any): MOVE_TO_ABSOLUTE_TARGET = 40',
    'class CtlCommandResult: TERMINATE_SUCCESS = 0',
    'class _Client:',
    '    def __init__(self): self.goals = []',
    '    def wait_for_server(self, t): return True',
    '    def send_goal(self, g): self.goals.append(g)',
    '    def wait_for_result(self, t): return True',
    '    def get_result(self): return types.SimpleNamespace(type=0)',
    '    def cancel_goal(self): pass',
    'class UserTemplate:',
    '    def __init__(self): self.__command = _Client(); self.__action_active = False; self.passed = []',
    '    def __notify_checkpoint_passed(self, cp): self.passed.append(cp); return True',
    '    def run(self): self.__run_user_flow(None)',
    '    def __run_user_flow(self, msg):',
    '        try:',
    py.replace(/\n+$/, ''),
    '        except Exception as exc:',
    '            raise',
    'u = UserTemplate(); u.run()',
    'g = u._UserTemplate__command.goals',
    'p = g[0].target.pose.position; o = g[0].target.pose.orientation',
    'print(len(g), u.passed, g[0].target.header.frame_id, g[0].type.type, p.x, p.y, p.z, o.w, u._UserTemplate__action_active)'
  ].join('\n');
  const { spawnSync } = require('node:child_process');
  const run = spawnSync('python3', ['-I', '-c', harness], { encoding: 'utf8' });
  if (run.error) return; // no python3 on this machine
  assert.equal(run.status, 0, run.stderr);
  const c1 = sol[0];
  assert.equal(run.stdout.trim(), `8 [1, 4, 5, 6, 8, 10, 11, 12] iss_body 40 ${K.fmt(c1.pos[0])} ${K.fmt(c1.pos[1])} ${K.fmt(c1.pos[2])} ${K.fmt(c1.q[3])} False`);
});

test('C++ export: one move_to per waypoint, pass_checkpoint after the ones that pass', () => {
  const sol = solution7();
  sol.splice(1, 0, { name: 'via', pos: [2.5, 0, 0.8], mode: 'keep', via: true });
  const cpp = K.toCpp(world7, sol);
  assert.equal(K.toJava(world7, sol), cpp, 'getJava() is kept as an alias of the export slot');
  const lines = cpp.split('\n');
  assert.equal(lines.filter((l) => l.startsWith('if (!move_to(')).length, sol.length);
  const passes = lines.filter((l) => /^pass_checkpoint\(\d+\);$/.test(l));
  assert.deepEqual(passes.map((l) => +/\d+/.exec(l)[0]), [1, 4, 5, 6, 8, 10, 11, 12]);
  assert.equal(lines[lines.indexOf('// 2. via') + 2], '// 3. CP 4', 'no pass after a via point');
  assert.match(cpp, /goal\.target\.header\.frame_id = "iss_body";/);
  assert.match(cpp, /MOVE_TO_ABSOLUTE_TARGET/);
  const count = (re) => (cpp.match(re) || []).length;
  assert.equal(count(/\{/g), count(/\}/g));
  assert.equal(count(/\(/g), count(/\)/g));
});

test('the AR markers carry the real DICT_4X4_50 patterns', () => {
  // ID 0 of OpenCV's 4x4 dictionary, and the 7th world's markers 1-12 all have a pattern.
  assert.equal(K.ARUCO_4X4[0], '1011010100110010');
  assert.equal(K.ARUCO_4X4.length, 13);
  K.ARUCO_4X4.forEach((b) => assert.match(b, /^[01]{16}$/));
  assert.equal(new Set(K.ARUCO_4X4).size, 13, 'all different');
  for (const t of world7.targets) assert.equal(K.markerBits(t), K.ARUCO_4X4[K.markerNumber(t)], t.name);
  assert.equal(K.markerBits(world.targets[0]), null, 'panels without a pose have no pattern');
});

test('reading markers: each checkpoint pose reads its own marker, and the tvec leads back to it', () => {
  for (const c of world7.checkpoints) {
    const pose = { pos: c.pos, q: c.q };
    const rd = K.readMarkers(world7, pose);
    const m = rd.seen.find((x) => x.id === c.id);
    assert.ok(m, `${c.name} reads AR${c.id}`);
    // The camera is 0.14 m in front of the centre, so the marker is about 0.14 m closer than the checkpoint.
    close(m.distance, K.dist(K.add(c.pos, K.scale(K.cameraDir(c.q), 0.14)), m.target && K.findTarget(world7, m.target).pos), 1e-9);
    assert.ok(m.offCentre < 0.5, `${c.name}: the marker is in the middle of the picture`);
    close(m.center[0], world7.camera.cx, 10); close(m.center[1], world7.camera.cy, 10);
    // Corners are TL, TR, BR, BL: a clockwise loop in image coordinates (y down), so the signed area is positive.
    let area = 0;
    for (let k = 0; k < 4; k++) { const a = m.corners[k], b = m.corners[(k + 1) % 4]; area += a[0] * b[1] - b[0] * a[1]; }
    assert.ok(area > 0, `${c.name}: corners go clockwise`);
    const back = K.markerFromTvec(world7, pose, m.tvec).world;
    close(K.dist(back, K.findTarget(world7, m.target).pos), 0, 1e-9);
    // rvec is a rotation vector of at most 180 degrees.
    assert.ok(K.len(m.rvec) <= Math.PI + 1e-9);
  }
  // The manual's CP 1 sees AR1 almost upright (about 18 degrees turned).
  const cp1 = K.findCheckpoint(world7, 'cp1');
  close(Math.abs(K.readMarkers(world7, { pos: cp1.pos, q: cp1.q }).seen[0].imageRoll), 18, 2);
});

test('reading markers: too far, edge-on, behind or out of the picture are not read', () => {
  const t = K.findTarget(world7, 'ar4');
  const lookFrom = (d, sideDeg) => {
    const dir = K.qRotate(K.qFromAxisAngle([0, 0, 1], sideDeg * Math.PI / 180), t.normal);
    const pos = K.add(t.pos, K.scale(dir, d));
    return { pos, q: K.faceQuat(pos, t.pos) };
  };
  const read = (pose) => K.readMarkers(world7, pose);
  assert.ok(read(lookFrom(0.6, 0)).seen.some((m) => m.id === 4));
  const far = read(lookFrom(2.5, 0));
  assert.ok(!far.seen.some((m) => m.id === 4));
  assert.match(far.missed.find((m) => m.id === 4).why, /too far away/);
  // The robot must be close: past camera.maxDistance (1 m) a marker is not read, even when big enough.
  assert.ok(read(lookFrom(0.95, 0)).seen.some((m) => m.id === 4));
  assert.match(read(lookFrom(1.3, 0)).missed.find((m) => m.id === 4).why, /too far away \(1\.16 m, read within 1 m\)/); // 1.3 m minus the 0.14 m camera offset
  const noLimit = K.normalizeWorld(Object.assign({}, world7, { camera: Object.assign({}, world7.camera, { maxDistance: 0 }) }));
  assert.ok(K.readMarkers(noLimit, lookFrom(1.3, 0)).seen.some((m) => m.id === 4));
  assert.match(K.readMarkers(noLimit, lookFrom(2.5, 0)).missed.find((m) => m.id === 4).why, /too small/);
  assert.match(read(lookFrom(0.6, 80)).missed.find((m) => m.id === 4).why, /edge-on/);
  // From behind the wall, looking at the marker's back.
  const behind = K.add(t.pos, K.scale(t.normal, -0.5));
  const rb = read({ pos: behind, q: K.faceQuat(behind, t.pos) });
  assert.ok(!rb.seen.some((m) => m.id === 4));
  // Looking away: not in the picture at all.
  const away = lookFrom(0.6, 0);
  assert.ok(!read({ pos: away.pos, q: K.faceQuat(away.pos, K.sub(away.pos, K.sub(t.pos, away.pos))) }).seen.some((m) => m.id === 4));
});

test('the starter route gives one worked example and three rough drafts, not the whole answer', () => {
  const r = K.starterRoute(world7);
  const named = r.filter((w) => !w.via);
  assert.deepEqual(named.map((w) => w.name), ['Example: CP 1', 'CP 4', 'CP 5', 'CP 6']);
  // Every stop reads its checkpoint's AR marker (Play shows it as a demo).
  const poses = K.resolveRoute(world7, r);
  r.forEach((w, i) => {
    if (w.via) return;
    const id = +/CP (\d+)/.exec(w.name)[1];
    assert.ok(K.readMarkers(world7, poses[i]).seen.some((m) => m.id === id), `${w.name} reads AR${id}`);
  });
  assert.equal(K.analyzeRoute(world7, r).blocked, 0);
  const m = K.missionStatus(world7, r);
  assert.equal(m.done, 1, 'only the example passes');
  assert.ok(m.goals.find((g) => g.id === 'cp1').done);
  assert.ok(m.total - m.done >= 7, 'most of the mission is left to the student');
  assert.equal(m.goals.filter((g) => g.done).length, 1, 'the rough drafts still fail');
  // Older worlds: the example solves the first goal the same way.
  const r6 = K.starterRoute(world);
  assert.equal(K.missionStatus(world, r6).done, 1);
  assert.deepEqual(K.starterRoute(world7, { rough: 0 }).map((w) => w.name), ['Example: CP 1']);
});

