// The 2D views (Top, Side, End) and the default 3D angle.
import type { Vec3, World } from '../core/types.js';
import type { ViewDef } from './types.js';
import { L, lang } from '../i18n.js';

const AX = ['x', 'y', 'z'];

// h / v: the world axis drawn to the right / downward; from: the side the view looks from.
// The default 3D angle (ISS frame, toward the camera): the long side from the EPS2 wall (+y), a little
// toward the dock end and from overhead, so the dock is on the left, the airlock on the right.
const VIEW3D_DIR: Vec3 = [-0.3, 1, -0.55];
function wrapAngle(a: number): number { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

const VIEWS: Record<string, ViewDef> = {
  top: { name: L('Top', 'ওপর'), h: 0, v: 1, d: 2, from: '-z' },
  side: { name: L('Side', 'পাশ'), h: 0, v: 2, d: 1, from: '+y' },
  end: { name: L('End', 'মাথা'), h: 1, v: 2, d: 0, from: '-x' }
};

// In Bangla the usual side names read as directions ("Overhead" is the ceiling); the world keeps its own names.
const SIDE_BN: Record<string, string> = { 'dock end': 'ডকের দিক', 'airlock end': 'এয়ারলকের দিক', overhead: 'ছাদ', deck: 'মেঝে' };

function sideName(cfg: World, key: string): string {
  const n = cfg.sides && cfg.sides[key];
  if (lang() !== 'bn') return n || (key + ' side');
  if (!n) return key + ' দিক';
  return SIDE_BN[n.toLowerCase()] || n.replace(/ wall$/i, ' দেয়াল').replace(/ end$/i, ' প্রান্ত');
}

// "seen from overhead", "seen from the dock end", "seen from the EPS2 wall"
function viewLook(cfg: World, def: ViewDef): string {
  const n = sideName(cfg, def.from);
  if (lang() === 'bn') return n + ' থেকে দেখা';
  if (def.from === '-z' && /^overhead$/i.test(n)) return 'seen from overhead';
  return 'seen from the ' + (/^[A-Z][a-z]/.test(n) ? n.charAt(0).toLowerCase() + n.slice(1) : n);
}

export { AX, VIEW3D_DIR, VIEWS, sideName, viewLook, wrapAngle };
