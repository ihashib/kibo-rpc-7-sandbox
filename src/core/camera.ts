/* ---------- AR markers and the robot camera (OpenCV conventions) ---------- */
import { X_AXIS, Z_AXIS } from './defaults.js';
import { L } from '../i18n.js';
import { angleDeg, cameraDir, qNorm, qRotate } from './quat.js';
import { add, dot, fmt, len, lerp, norm, scale, sub } from './vec.js';
import { markerNumber, targetCenter } from './world.js';
import type { CameraFrame, CameraModel, CaptureCheck, Marker, MarkerReading, Pose, Px, Quat, Readings, Target, Vec3, World } from './types.js';

// OpenCV aruco DICT_4X4_50, IDs 0-12 (the 7th Kibo-RPC uses IDs 1-12): the 4x4 inner bits, row by
// row from the marker's top, 1 = white. Generated with cv.generateImageMarker. Inside the 2 cm marker
// the bits sit in a one-cell black border, so the marker is 6 x 6 cells.
const ARUCO_4X4: string[] = [
  '1011010100110010',
  '0000111110011010',
  '0011001100101101',
  '1001100101000110',
  '0101010010011110',
  '0111100111001101',
  '1001111000101110',
  '1100010011110010',
  '1111111011011010',
  '1100111101010110',
  '1111100110010001',
  '0001000110100111',
  '0000111010110111'
];

function markerBits(t: Target | null | undefined): string | null {
  const n = t && t.pos && t.q ? markerNumber(t) : null;
  return n != null && n < ARUCO_4X4.length ? ARUCO_4X4[n] : null;
}

// Marker axes in the world: x to the right and y up in the marker picture, z out of its face.
function markerFrame(t: Marker): { x: Vec3; y: Vec3; z: Vec3 } { return { x: qRotate(t.q, X_AXIS), y: qRotate(t.q, [0, 1, 0]), z: qRotate(t.q, Z_AXIS) }; }
function markerPoint(t: Marker, mx: number, my: number): Vec3 { const f = markerFrame(t); return add(t.pos, add(scale(f.x, mx), scale(f.y, my))); }

// The four corners in OpenCV's order: top-left, top-right, bottom-right, bottom-left.
function markerCorners(t: Marker): Vec3[] {
  const h = t.size / 2;
  return [[-h, h], [h, h], [h, -h], [-h, -h]].map(function (c) { return markerPoint(t, c[0], c[1]); });
}

// The camera in the world, as OpenCV sees it: x right, y down, z forward (the optical axis).
// Body frame: +X front (the camera), +Y left, +Z top, so x = -Y, y = -Z, z = +X.
function cameraFrame(world: World, pose: Pose): CameraFrame {
  const q = qNorm(pose.q);
  return { pos: add(pose.pos, qRotate(q, world.camera.offset)), x: qRotate(q, [0, -1, 0]), y: qRotate(q, [0, 0, -1]), z: qRotate(q, X_AXIS) };
}

function camDir(cf: CameraFrame, v: Vec3): Vec3 { return [dot(v, cf.x), dot(v, cf.y), dot(v, cf.z)]; }
function toCamera(cf: CameraFrame, p: Vec3): Vec3 { return camDir(cf, sub(p, cf.pos)); }

// Pinhole projection to pixels (no lens distortion in the sandbox).
function projectPx(cam: CameraModel, pc: Vec3): Px { return [cam.fx * pc[0] / pc[2] + cam.cx, cam.fy * pc[1] / pc[2] + cam.cy]; }

// Rotation (columns = the marker's x, y, z axes in camera coordinates) as an OpenCV rvec (axis * angle).
function rvecFromAxes(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  let m00 = a[0], m11 = b[1], m22 = c[2], tr = m00 + m11 + m22, q: Quat;

  if (tr > 0) { const s0 = Math.sqrt(tr + 1) * 2; q = [(b[2] - c[1]) / s0, (c[0] - a[2]) / s0, (a[1] - b[0]) / s0, 0.25 * s0]; }
  else if (m00 > m11 && m00 > m22) { const s1 = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [0.25 * s1, (b[0] + a[1]) / s1, (c[0] + a[2]) / s1, (b[2] - c[1]) / s1]; }
  else if (m11 > m22) { const s2 = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(b[0] + a[1]) / s2, 0.25 * s2, (c[1] + b[2]) / s2, (c[0] - a[2]) / s2]; }
  else { const s3 = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(c[0] + a[2]) / s3, (c[1] + b[2]) / s3, 0.25 * s3, (a[1] - b[0]) / s3]; }

  q = qNorm(q);
  if (q[3] < 0) q = q.map(function (v) { return -v; });
  const sv = Math.hypot(q[0], q[1], q[2]), ang = 2 * Math.atan2(sv, q[3]);
  return sv < 1e-12 ? [0, 0, 0] : [q[0] / sv * ang, q[1] / sv * ang, q[2] / sv * ang];
}

// What the robot camera reads at `pose`, like cv2.aruco.detectMarkers + estimatePoseSingleMarkers:
// seen: [{ id, name, corners (px, TL TR BR BL), center (px), rvec, tvec (m, camera frame), distance,
// perimeter (px), viewAngle (0 = head on), offCentre (deg from the optical axis), imageRoll (deg the
// marker looks turned in the picture, + = clockwise) }], sorted nearest first.
// missed: markers in the picture that a detector would miss, each with `why`.
function readMarkers(world: World, pose: Pose): Readings {
  const cam = world.camera, cf = cameraFrame(world, pose), seen: MarkerReading[] = [], missed: MarkerReading[] = [];
  const minPerim = cam.minPerimeterRate * Math.max(cam.width, cam.height);
  function inside(p: Px) { return p[0] >= 0 && p[0] <= cam.width && p[1] >= 0 && p[1] <= cam.height; }

  world.targets.forEach(function (t) {
    if (!markerBits(t)) return;
    const cc = markerCorners(t as Marker).map(function (c) { return toCamera(cf, c); });
    if (cc.some(function (c) { return c[2] < 0.02; })) return; // not in front of the camera
    const px = cc.map(function (c) { return projectPx(cam, c); });
    if (!px.some(inside)) return; // not in the picture
    let pc = toCamera(cf, t.pos!), perim = 0;
    for (let k = 0; k < 4; k++) perim += Math.hypot(px[(k + 1) % 4][0] - px[k][0], px[(k + 1) % 4][1] - px[k][1]);
    const view = angleDeg(t.normal, sub(cf.pos, t.pos!));
    const up = sub(lerp(px[0], px[1], 0.5).concat(0), lerp(px[3], px[2], 0.5).concat(0));

    const rec: MarkerReading = {
      id: markerNumber(t), target: t.id, name: t.name, corners: px, center: projectPx(cam, pc), tvec: pc, distance: len(pc),
      perimeter: perim, viewAngle: view, offCentre: angleDeg([0, 0, 1], pc), imageRoll: Math.atan2(up[0], -up[1]) * 180 / Math.PI
    };

    if (view >= 90) rec.why = L('seen from behind', 'পেছন দিক থেকে দেখা যাচ্ছে');
    else if (cam.maxDistance && rec.distance > cam.maxDistance) rec.why = L('too far away (' + fmt(rec.distance, 2) + ' m, read within ' + fmt(cam.maxDistance, 2) + ' m)', 'বেশি দূরে (' + fmt(rec.distance, 2) + ' মি; পড়া যায় ' + fmt(cam.maxDistance, 2) + ' মি-র মধ্যে)');
    else if (!px.every(inside)) rec.why = L('partly outside the picture', 'কিছুটা ছবির বাইরে');
    else if (view > cam.maxViewAngle) rec.why = L('seen too edge-on (' + Math.round(view) + '°, needs under ' + fmt(cam.maxViewAngle, 0) + '°)', 'খুব কাত হয়ে দেখা যাচ্ছে (' + Math.round(view) + '°; লাগবে ' + fmt(cam.maxViewAngle, 0) + '°-এর কম)');
    else if (perim < minPerim) rec.why = L('too small in the picture (' + Math.round(perim) + ' px around, needs ' + Math.round(minPerim) + ')', 'ছবিতে খুব ছোট (চারপাশ মিলিয়ে ' + Math.round(perim) + ' px; লাগবে ' + Math.round(minPerim) + ')');

    if (rec.why) { missed.push(rec); return; }
    const f = markerFrame(t as Marker);
    rec.rvec = rvecFromAxes(camDir(cf, f.x), camDir(cf, f.y), camDir(cf, f.z));
    seen.push(rec);
  });

  seen.sort(function (a, b) { return a.distance - b.distance; });
  return { seen: seen, missed: missed, camera: cf };
}

// What a program works out from a tvec: the marker centre in the body frame, then in the world.
function markerFromTvec(world: World, pose: Pose, tvec: Vec3): { body: Vec3; world: Vec3 } {
  const o = world.camera.offset, body = [o[0] + tvec[2], o[1] - tvec[0], o[2] - tvec[1]];
  return { body: body, world: add(pose.pos, qRotate(qNorm(pose.q), body)) };
}

// How well a pose can photograph target t.
function captureCheck(world: World, t: Target, pose: Pose): CaptureCheck {
  const s = world.settings, c = targetCenter(t), toT = sub(c, pose.pos), d = len(toT);
  const aim = d > 1e-9 ? Math.acos(Math.max(-1, Math.min(1, dot(cameraDir(pose.q), norm(toT))))) * 180 / Math.PI : 180;
  const lo = Math.max(0, s.standoff - s.rangeTolerance), hi = s.standoff + s.rangeTolerance;

  return {
    dist: d, aim: aim, lo: lo, hi: hi,
    front: dot(sub(pose.pos, c), t.normal) > 0,
    inRange: d >= lo - 1e-9 && d <= hi + 1e-9,
    aimed: aim <= s.aimTolerance + 1e-9
  };
}

export { ARUCO_4X4, cameraFrame, captureCheck, markerBits, markerCorners, markerFrame, markerFromTvec, projectPx, readMarkers, toCamera };
