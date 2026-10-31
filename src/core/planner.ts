/* ---------- voxel grid + A* ---------- */
import { checkSegment, isFree, pointStatus, whyText } from './space.js';
import { L } from '../i18n.js';
import { dist, roundVec } from './vec.js';
import { fail, kizBounds } from './world.js';
import type { Vec3, World } from './types.js';

// The voxel grid of allowed space, kept for the last world (the key says which).
interface Grid { key: string; res: number; min: Vec3; nx: number; ny: number; nz: number; n: number; free: Uint8Array }
let gridCache: Grid | null = null;

function getGrid(world: World): Grid {
  const s = world.settings;
  const key = JSON.stringify([world.kiz, world.koz, s.clearance, s.gridRes]);
  if (gridCache && gridCache.key === key) return gridCache;
  const res = s.gridRes, bb = kizBounds(world);
  const nx = Math.floor((bb.max[0] - bb.min[0]) / res + 1e-6) + 1;
  const ny = Math.floor((bb.max[1] - bb.min[1]) / res + 1e-6) + 1;
  const nz = Math.floor((bb.max[2] - bb.min[2]) / res + 1e-6) + 1;
  const n = nx * ny * nz;
  if (n > 4e6) fail(L('The grid is too fine for a world this big. Raise settings.gridRes.', 'এত বড় ওয়ার্ল্ডের জন্য গ্রিড খুব সূক্ষ্ম। settings.gridRes বাড়াও।'));
  const free = new Uint8Array(n);
  const g = { key: key, res: res, min: bb.min, nx: nx, ny: ny, nz: nz, n: n, free: free };
  for (let i = 0; i < n; i++) free[i] = isFree(world, gridPos(g, i)) ? 1 : 0;
  gridCache = g;
  return g;
}

function gridPos(g: Grid, i: number): Vec3 {
  const ix = i % g.nx, iy = Math.floor(i / g.nx) % g.ny, iz = Math.floor(i / (g.nx * g.ny));
  return [g.min[0] + ix * g.res, g.min[1] + iy * g.res, g.min[2] + iz * g.res];
}

function gridIdx(g: Grid, ix: number, iy: number, iz: number): number {
  if (ix < 0 || iy < 0 || iz < 0 || ix >= g.nx || iy >= g.ny || iz >= g.nz) return -1;
  return ix + g.nx * (iy + g.ny * iz);
}

// Free grid nodes near p that p can reach in a straight, clear line.
function nearNodes(world: World, g: Grid, p: Vec3): { idx: number; d: number }[] {
  const c = [0, 1, 2].map(function (k) { return Math.round((p[k] - g.min[k]) / g.res); });

  for (let R = 1; R <= 4; R++) {
    const out: { idx: number; d: number }[] = [];

    for (let dz = -R; dz <= R; dz++) for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const idx = gridIdx(g, c[0] + dx, c[1] + dy, c[2] + dz);
      if (idx < 0 || !g.free[idx]) continue;
      const q = gridPos(g, idx);
      if (checkSegment(world, p, q).clear) out.push({ idx: idx, d: dist(p, q) });
    }

    if (out.length) return out;
  }

  return [];
}

// A binary min-heap of (key, value) pairs: the A* open set.
interface Heap { k: number[]; v: number[]; push(key: number, val: number): void; pop(): number; size(): number }
function Heap(this: Heap) { this.k = []; this.v = []; }

Heap.prototype.push = function (this: Heap, key: number, val: number) {
  let k = this.k, v = this.v, i = k.length;
  k.push(key); v.push(val);

  while (i > 0) {
    const p = (i - 1) >> 1;
    if (k[p] <= key) break;
    k[i] = k[p]; v[i] = v[p]; i = p;
  }

  k[i] = key; v[i] = val;
};

Heap.prototype.pop = function (this: Heap) {
  const k = this.k, v = this.v, top = v[0], lk = k.pop()!, lv = v.pop()!, n = k.length;

  if (n) {
    let i = 0;

    for (;;) {
      let l = 2 * i + 1, r = l + 1, m = i, mk = lk;
      if (l < n && k[l] < mk) { m = l; mk = k[l]; }
      if (r < n && k[r] < mk) { m = r; mk = k[r]; }
      if (m === i) break;
      k[i] = k[m]; v[i] = v[m]; i = m;
    }

    k[i] = lk; v[i] = lv;
  }

  return top;
};

Heap.prototype.size = function (this: Heap) { return this.k.length; };

const NEIGHBOURS = (function () {
  const out: number[][] = [];

  for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (dx || dy || dz) out.push([dx, dy, dz, Math.sqrt(dx * dx + dy * dy + dz * dz)]);
  }

  return out;
})();

// Plan a clear path from a to b. Returns { ok, points: [a, ...via, b] } or { ok: false, reason }.
function planPath(world: World, a: Vec3, b: Vec3): { ok: true; points: Vec3[] } | { ok: false; reason: string } {
  const sa = pointStatus(world, a), sb = pointStatus(world, b);
  if (!sa.free) return { ok: false, reason: L('The start of this move is ' + whyText(sa) + '.', 'এই পথের শুরুটা ' + whyText(sa) + '।') };
  if (!sb.free) return { ok: false, reason: L('The end of this move is ' + whyText(sb) + '.', 'এই পথের শেষটা ' + whyText(sb) + '।') };
  if (checkSegment(world, a, b).clear) return { ok: true, points: [a.slice(), b.slice()] };
  const g = getGrid(world);
  const seeds = nearNodes(world, g, a), goals = nearNodes(world, g, b);
  if (!seeds.length || !goals.length) return { ok: false, reason: L('No grid point is reachable here. Try a smaller grid size.', 'এখানে গ্রিডের কোনো বিন্দুতে পৌঁছানো যাচ্ছে না। গ্রিড আরও ছোট করে দেখো।') };
  const goalD = new Map<number, number>();
  goals.forEach(function (o) { goalD.set(o.idx, o.d); });
  const gScore = new Float64Array(g.n).fill(Infinity), came = new Int32Array(g.n).fill(-1), closed = new Uint8Array(g.n);
  const heap: Heap = new (Heap as unknown as new () => Heap)();

  seeds.forEach(function (o) {
    if (o.d < gScore[o.idx]) { gScore[o.idx] = o.d; came[o.idx] = -2; heap.push(o.d + dist(gridPos(g, o.idx), b), o.idx); }
  });

  let found = -1, nxy = g.nx * g.ny;

  while (heap.size()) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (goalD.has(cur)) { found = cur; break; }
    const cx = cur % g.nx, cy = Math.floor(cur / g.nx) % g.ny, cz = Math.floor(cur / nxy), cp = gridPos(g, cur);

    for (let i = 0; i < NEIGHBOURS.length; i++) {
      const o = NEIGHBOURS[i], ni = gridIdx(g, cx + o[0], cy + o[1], cz + o[2]);
      if (ni < 0 || closed[ni] || !g.free[ni]) continue;
      const ng = gScore[cur] + o[3] * g.res;
      if (ng >= gScore[ni]) continue;
      const np = gridPos(g, ni);
      if (!checkSegment(world, cp, np).clear) continue;
      gScore[ni] = ng; came[ni] = cur;
      heap.push(ng + dist(np, b), ni);
    }
  }

  if (found < 0) return { ok: false, reason: L('No clear route exists between these points.', 'এই দুই বিন্দুর মাঝে বাধাহীন কোনো রুট নেই।') };
  const nodes: Vec3[] = [];
  for (let at = found; at >= 0; at = came[at]) nodes.push(gridPos(g, at));
  nodes.reverse();
  const pts = [a.slice()].concat(nodes, [b.slice()]);
  return { ok: true, points: shortcut(world, pts) };
}

// Greedy line-of-sight shortcutting: from each point jump to the farthest point it can see.
function shortcut(world: World, pts: Vec3[]): Vec3[] {
  let out = [pts[0]], i = 0;

  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !checkSegment(world, pts[i], pts[j]).clear) j--;
    out.push(pts[j]);
    i = j;
  }

  // Tidy via points to the millimetre when that keeps every move clear.
  const tidy = out.map(function (p, k) { return k === 0 || k === out.length - 1 ? p : roundVec(p, 3); });
  for (let k = 1; k < tidy.length; k++) if (!checkSegment(world, tidy[k - 1], tidy[k]).clear) return out;
  return tidy;
}

// Closest allowed point to p (p itself when it is already allowed), or null.
function nearestFree(world: World, p: Vec3): Vec3 | null {
  if (isFree(world, p)) return p.slice();
  let c = world.settings.clearance, best = null as Vec3 | null, bd = Infinity;

  world.kiz.forEach(function (b) {
    const q: number[] = [];

    for (let k = 0; k < 3; k++) {
      const lo = b.min[k] + c, hi = b.max[k] - c;
      if (lo > hi) return;
      q.push(Math.min(hi, Math.max(lo, p[k])));
    }

    const d = dist(p, q);
    if (d < bd && isFree(world, q)) { bd = d; best = q; }
  });

  if (best) return best;
  const g = getGrid(world);

  for (let i = 0; i < g.n; i++) {
    if (!g.free[i]) continue;
    const q = gridPos(g, i), d = dist(p, q);
    if (d < bd) { bd = d; best = q; }
  }

  return best;
}

export { nearestFree, planPath };
