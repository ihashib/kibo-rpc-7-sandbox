// Text formatting for the panel, the log and the HUD.
import { Core } from '../core/index.js';
import type { Vec3 } from '../core/types.js';
import { L } from '../i18n.js';

function esc(s: unknown): string {
  return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]; });
}

function f2(n: number): string { return Core.fmt(n, 2); }
function f3(n: number): string { return Core.fmt(n, 3); }
function vecText(p: number[], d?: number): string { return '(' + p.map(function (n) { return Core.fmt(n, d == null ? 3 : d); }).join(', ') + ')'; }
function listText(a: Array<string | number>): string { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + L(' and ', ' আর ') + a[a.length - 1]; }

function timeText(s: number): string {
  if (s < 60) return Math.round(s) + L(' s', ' সেকেন্ড');
  let m = Math.floor(s / 60), r = Math.round(s - m * 60);
  if (r === 60) { m++; r = 0; }
  return r ? m + L(' min ', ' মিনিট ') + (r < 10 ? '0' : '') + r + L(' s', ' সেকেন্ড') : m + L(' min', ' মিনিট');
}

function axisName(d: Vec3): string {
  const names = ['x', 'y', 'z'];
  for (let k = 0; k < 3; k++) if (Math.abs(d[k]) > 0.985) return (d[k] > 0 ? '+' : '−') + names[k];
  return '(' + d.map(function (n) { return Core.fmt(n, 2); }).join(', ') + ')';
}

export { axisName, esc, f2, f3, listText, timeText, vecText };
