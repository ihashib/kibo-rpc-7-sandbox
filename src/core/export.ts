/* ---------- code export ---------- */
import { missionStatus } from './mission.js';
import { analyzeRoute } from './route.js';
import { fmt } from './vec.js';
import type { Analysis, Waypoint, World } from './types.js';

function fill(tpl: string, vars: Record<string, string | number>): string {
  // Numbers come back as text (String.replace converts them).
  return tpl.replace(/\{(\w+)\}/g, function (m, k) { return (vars[k] != null ? vars[k] : m) as string; });
}

// "cpp" and "python" are the 7th Kibo-RPC languages; "java" is the old name of the `export` slot.
const LANGS: Record<string, 'export' | 'exportPython'> = { cpp: 'export', java: 'export', python: 'exportPython' };

// Code for the route in `lang` ("python" or "cpp"), from that language's template in the world.
// After a waypoint meant for a checkpoint, the `pass` template asks the judge about it ({cp}).
function toCode(world: World, route: Waypoint[], analysis?: Analysis | null, lang?: string): string {
  const a = analysis && analysis.poses.length === route.length ? analysis : analyzeRoute(world, route);
  const ex = world[LANGS[lang as string] || 'export'], lines: string[] = [], passAt: Record<number, number[]> = {};

  if (ex.pass && world.checkpoints && world.checkpoints.length) {
    missionStatus(world, route, a).goals.forEach(function (g) {
      if (g.kind === 'checkpoint' && g.notify! >= 0) (passAt[g.notify!] = passAt[g.notify!] || []).push(g.number!);
    });
  }

  const base = { world: world.name, start: world.start.name, count: route.length };
  if (ex.header) lines.push(fill(ex.header, base));
  if (a.blocked) lines.push((ex.prefix || '//') + ' WARNING: ' + a.blocked + ' move' + (a.blocked > 1 ? 's are' : ' is') + ' blocked in the sandbox. Fix ' + (a.blocked > 1 ? 'them' : 'it') + ' first.');
  if (lines.length) lines.push('');

  route.forEach(function (w, i) {
    const p = a.poses[i].pos, q = a.poses[i].q;

    const vars = Object.assign({}, base, {
      i: i + 1, name: String(w.name).replace(/[\r\n]+/g, ' '), x: fmt(p[0]), y: fmt(p[1]), z: fmt(p[2]),
      qx: fmt(q[0]), qy: fmt(q[1]), qz: fmt(q[2]), qw: fmt(q[3])
    });

    if (ex.comment) lines.push(fill(ex.comment, vars));
    lines.push(fill(ex.line, vars));
    (passAt[i] || []).forEach(function (n) { lines.push(fill(ex.pass, Object.assign({ cp: n }, vars))); });
  });

  if (ex.footer) lines.push('', fill(ex.footer, base));
  return lines.join('\n') + '\n';
}

// Kept for older pages: the code from the `export` slot (C++ in the default world).
function toJava(world: World, route: Waypoint[], analysis?: Analysis | null): string { return toCode(world, route, analysis, 'java'); }
function toCpp(world: World, route: Waypoint[], analysis?: Analysis | null): string { return toCode(world, route, analysis, 'cpp'); }
function toPython(world: World, route: Waypoint[], analysis?: Analysis | null): string { return toCode(world, route, analysis, 'python'); }

export { toCode, toCpp, toJava, toPython };
