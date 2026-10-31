/* ---------- allowed space ---------- */
import { EPS } from './defaults.js';
import { L } from '../i18n.js';
import { add, dist, lerp } from './vec.js';
import type { Box, PointStatus, SegmentCheck, Vec3, World } from './types.js';

// Inside a box shrunk by `pad` (boundary counts as inside).
function inShrunk(p: Vec3, b: Box, pad: number): boolean {
  return p[0] >= b.min[0] + pad - EPS && p[0] <= b.max[0] - pad + EPS &&
    p[1] >= b.min[1] + pad - EPS && p[1] <= b.max[1] - pad + EPS &&
    p[2] >= b.min[2] + pad - EPS && p[2] <= b.max[2] - pad + EPS;
}

// Strictly inside a box grown by `pad` (boundary counts as outside).
function inGrown(p: Vec3, b: Box, pad: number): boolean {
  return p[0] > b.min[0] - pad + EPS && p[0] < b.max[0] + pad - EPS &&
    p[1] > b.min[1] - pad + EPS && p[1] < b.max[1] + pad - EPS &&
    p[2] > b.min[2] - pad + EPS && p[2] < b.max[2] + pad - EPS;
}

function inBox(p: Vec3, b: Box): boolean { return inShrunk(p, b, 0); }

function pointStatus(world: World, p: Vec3): PointStatus {
  let c = world.settings.clearance, i;

  for (i = 0; i < world.koz.length; i++) {
    if (inGrown(p, world.koz[i], c)) return { free: false, why: 'koz', zone: world.koz[i].name };
  }

  for (i = 0; i < world.kiz.length; i++) if (inShrunk(p, world.kiz[i], c)) return { free: true, zone: world.kiz[i].name };
  return { free: false, why: 'outside' };
}

function isFree(world: World, p: Vec3): boolean { return pointStatus(world, p).free; }

// One step of manual driving: never enter disallowed space; when the full step is blocked,
// slide along the wall by keeping the axis moves that stay allowed.
function driveStep(world: World, p: Vec3, delta: Vec3): Vec3 {
  return slideStep(function (q) { return isFree(world, q); }, p, delta);
}

// The same for any allowed space, given by `free(point)`.
function slideStep(free: (p: Vec3) => boolean, p: Vec3, delta: Vec3): Vec3 {
  const full = add(p, delta);
  if (!free(p)) return full; // already outside: let the student drive back in
  if (free(full)) return full;
  let q = p.slice();

  for (let k = 0; k < 3; k++) {
    if (!delta[k]) continue;
    const t = q.slice();
    t[k] += delta[k];
    if (free(t)) q = t;
  }

  return q;
}

function whyText(st: { free?: boolean; why?: PointStatus['why']; zone?: string } | null | undefined): string {
  if (!st || st.free) return L('allowed', 'ঠিক জায়গায়');
  if (st.why === 'koz') return L('inside ' + st.zone + ' (plus clearance)', st.zone + '-এর ভেতরে (চারপাশের ফাঁকসহ)');
  return L('outside the Keep-In Zones (minus clearance)', 'কিপ-ইন জোনের বাইরে (দেয়াল থেকে ফাঁক ধরে)');
}

// Sample the straight move every `step` metres (1 cm by default).
function checkSegment(world: World, a: Vec3, b: Vec3, step?: number): SegmentCheck {
  step = step || 0.01;
  const L = dist(a, b), n = Math.max(1, Math.ceil(L / step - 1e-9));

  for (let i = 0; i <= n; i++) {
    const t = i / n, p = lerp(a, b, t), st = pointStatus(world, p);
    if (!st.free) return { clear: false, hit: p, t: t, why: st.why, zone: st.zone };
  }

  return { clear: true };
}

function oasisLength(world: World, a: Vec3, b: Vec3): number {
  if (!world.oasis.length) return 0;
  let L = dist(a, b), n = Math.max(1, Math.ceil(L / 0.01 - 1e-9)), inside = 0;

  for (let i = 0; i < n; i++) {
    const p = lerp(a, b, (i + 0.5) / n);
    for (let k = 0; k < world.oasis.length; k++) { if (inBox(p, world.oasis[k])) { inside++; break; } }
  }

  return L * inside / n;
}

export { checkSegment, driveStep, inBox, inShrunk, isFree, oasisLength, pointStatus, slideStep, whyText };
