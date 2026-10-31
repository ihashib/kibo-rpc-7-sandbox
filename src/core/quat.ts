/* ---------- quaternions [x, y, z, w] ---------- */
import { EPS, X_AXIS, Z_AXIS } from './defaults.js';
import { add, cross, dot, len, norm, scale, sub } from './vec.js';
import type { Quat, Vec3 } from './types.js';

function qNorm(q: Quat): Quat {
  const l = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
  return l < EPS ? [0, 0, 0, 1] : [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

function qDot(a: Quat, b: Quat): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; }

function qMul(a: Quat, b: Quat): Quat {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
  ];
}

function qFromAxisAngle(axis: Vec3, rad: number): Quat {
  const a = norm(axis), s = Math.sin(rad / 2);
  return [a[0] * s, a[1] * s, a[2] * s, Math.cos(rad / 2)];
}

// Shortest rotation that turns direction u into direction v.
function qFromTo(u: Vec3, v: Vec3): Quat {
  u = norm(u); v = norm(v);
  const d = dot(u, v);
  if (d >= 1 - 1e-12) return [0, 0, 0, 1];

  if (d <= -1 + 1e-9) {
    // Half turn. Prefer spinning about the deck axis (z) so the robot stays upright.
    let axis = sub([0, 0, 1], scale(u, u[2]));
    if (len(axis) < 1e-6) axis = sub([0, 1, 0], scale(u, u[1]));
    axis = norm(axis);
    return [axis[0], axis[1], axis[2], 0];
  }

  const c = cross(u, v);
  return qNorm([c[0], c[1], c[2], 1 + d]);
}

function qRotate(q: Quat, v: Vec3): Vec3 {
  const u = [q[0], q[1], q[2]], w = q[3];
  const t = scale(cross(u, v), 2);
  return add(add(v, scale(t, w)), cross(u, t));
}

function qSlerp(a: Quat, b: Quat, t: number): Quat {
  a = qNorm(a); b = qNorm(b);
  let d = qDot(a, b);
  if (d < 0) { b = [-b[0], -b[1], -b[2], -b[3]]; d = -d; }
  if (d > 0.9995) return qNorm([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]);
  const th = Math.acos(d), s = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
  return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb, a[3] * wa + b[3] * wb];
}

// Angle in degrees between two orientations.
function qAngleDeg(a: Quat, b: Quat): number {
  const d = Math.abs(qDot(qNorm(a), qNorm(b)));
  return 2 * Math.acos(Math.min(1, d)) * 180 / Math.PI;
}

function qConj(q: Quat): Quat { return [-q[0], -q[1], -q[2], q[3]]; }

// Angle in degrees between two directions.
function angleDeg(a: Vec3, b: Vec3): number {
  const la = len(a), lb = len(b);
  if (la < EPS || lb < EPS) return 180;
  return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (la * lb)))) * 180 / Math.PI;
}

function wrapDeg(a: number): number { return ((a % 360) + 540) % 360 - 180; }

// Orientation from heading (yaw, about +z, 0 = facing +x, 90 = facing +y), pitch (about the body y
// axis, +90 = camera looking overhead at -z) and roll (about the camera axis, + = clockwise seen
// from behind the camera). Roll 0 is upright: the robot's top (body +Z) toward overhead (-z), so the
// camera picture is the right way up. (The dock pose, q = identity, is roll 180 by this measure.)
function qFromYawPitch(yawDeg: number, pitchDeg: number, rollDeg?: number): Quat {
  const r = Math.PI / 180;
  const q = qMul(qFromAxisAngle(Z_AXIS, yawDeg * r), qFromAxisAngle([0, 1, 0], pitchDeg * r));
  return qNorm(qMul(q, qFromAxisAngle(X_AXIS, (180 + (rollDeg || 0)) * r)));
}

function yawPitchFromQ(q: Quat): { yaw: number; pitch: number; roll: number } {
  const d = cameraDir(q), r = 180 / Math.PI;
  const yaw = Math.hypot(d[0], d[1]) > 1e-6 ? Math.atan2(d[1], d[0]) * r : 0;
  const pitch = Math.asin(Math.max(-1, Math.min(1, -d[2]))) * r;
  const rel = qMul(qConj(qFromYawPitch(yaw, pitch)), qNorm(q)); // what is left is a turn about +X
  return { yaw: yaw, pitch: pitch, roll: wrapDeg(2 * Math.atan2(rel[0], rel[3]) * r) };
}

// Orientation whose camera (+X) points from `from` toward `to`.
function faceQuat(from: Vec3, to: Vec3): Quat { return qFromTo(X_AXIS, sub(to, from)); }
function cameraDir(q: Quat): Vec3 { return qRotate(qNorm(q), X_AXIS); }
function topDir(q: Quat): Vec3 { return qRotate(qNorm(q), Z_AXIS); }

// Roll error about the line of sight, in degrees: how far `q` must turn about its own camera axis
// (+ = clockwise seen from behind the camera) for its top (+Z) to line up with the top of `want`.
function rollErrorDeg(q: Quat, want: Quat): number {
  let d = cameraDir(q), up = topDir(q), wu = topDir(want);
  let p = sub(wu, scale(d, dot(wu, d)));

  if (len(p) < 1e-6) { // the wanted top lies along our line of sight: compare the y axes instead
    up = qRotate(qNorm(q), [0, 1, 0]);
    const wy = qRotate(qNorm(want), [0, 1, 0]);
    p = sub(wy, scale(d, dot(wy, d)));
  }

  p = norm(p);
  return Math.atan2(dot(d, cross(up, p)), dot(up, p)) * 180 / Math.PI;
}

// Keep q's roll but turn the camera to look along `dir` (the smallest swing).
function aimQuat(q: Quat, dir: Vec3): Quat { return qNorm(qMul(qFromTo(cameraDir(q), dir), qNorm(q))); }

export { aimQuat, angleDeg, cameraDir, faceQuat, qAngleDeg, qConj, qFromAxisAngle, qFromTo, qFromYawPitch, qMul, qNorm, qRotate, qSlerp, rollErrorDeg, topDir, yawPitchFromQ };
