/* ---------- small helpers ---------- */
import { EPS } from './defaults.js';
import type { Vec3 } from './types.js';

function copy<T>(o: T): T { return JSON.parse(JSON.stringify(o)); }
function add(a: Vec3, b: Vec3): Vec3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function sub(a: Vec3, b: Vec3): Vec3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale(a: Vec3, s: number): Vec3 { return [a[0] * s, a[1] * s, a[2] * s]; }
function dot(a: Vec3, b: Vec3): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a: Vec3, b: Vec3): Vec3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function len(a: Vec3): number { return Math.sqrt(dot(a, a)); }
function dist(a: Vec3, b: Vec3): number { return len(sub(a, b)); }
function norm(a: Vec3): Vec3 { const l = len(a); return l < EPS ? [0, 0, 0] : scale(a, 1 / l); }
function lerp(a: Vec3, b: Vec3, t: number): Vec3 { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function round(n: number, d: number): number { const f = Math.pow(10, d); const v = Math.round(n * f) / f; return v === 0 ? 0 : v; }
function roundVec(v: number[], d: number): number[] { return v.map(function (n) { return round(n, d); }); }

function fmt(n: number, d?: number): string {
  const v = round(n, d == null ? 4 : d);
  return String(v);
}

function isNum(n: unknown): n is number { return typeof n === 'number' && isFinite(n); }

function isVec(v: unknown, n?: number): v is number[] {
  if (!Array.isArray(v) || v.length !== (n || 3)) return false;
  for (let i = 0; i < v.length; i++) if (!isNum(v[i])) return false;
  return true;
}

function vecFmt(p: Vec3): string { return '(' + p.map(function (v) { return fmt(v, 4); }).join(', ') + ')'; }

export { add, copy, cross, dist, dot, fmt, isNum, isVec, len, lerp, norm, round, roundVec, scale, sub, vecFmt };
