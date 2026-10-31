/* ---------- zero-gravity flight (Drive's Zero-g and the Free flight page) ---------- */
import { add, dot, len, norm, scale, sub } from './vec.js';
import { cameraDir, qFromAxisAngle, qMul, qNorm, qRotate, topDir } from './quat.js';
import type { Quat, Vec3 } from './types.js';

// Accelerations in m/s² and °/s², fine = with Shift / Fine; drag per second.
// As on the station, drift is never lost (`drag` 0): the robot keeps moving until it thrusts the other way,
// halts (X) or hits a wall. Spin is held to `maxSpin` and settles over a few seconds; thrusting against the
// motion brakes `counter` times harder. The default for Core.zeroGStep.
const ZERO_G = { accel: 0.15, fineAccel: 0.04, spinAccel: 60, fineSpinAccel: 15, spinDrag: 0.2, counter: 1.2, maxSpeed: 0.5, maxSpin: 30, restSpeed: 0.003, restSpin: 0.3, drag: 0 };

// A little more forgiving, for flying by hand (the sandbox's Drive and the Free flight game): turning settles in
// about 2 s, thrusting backward brakes a bit harder, and the drift fades very slowly (half of it in about 20 s).
// Thrust is quicker, up to 1 m/s, since the station is about 60 m from end to end.
const ZERO_G_GAME = { accel: 0.32, fineAccel: 0.07, spinAccel: 90, fineSpinAccel: 22, spinDrag: 1.5, counter: 1.6, maxSpeed: 1, maxSpin: 40, restSpeed: 0.006, restSpin: 1, drag: 0.035 };

// The Free flight game's feel: ZERO_G_GAME with help to stay in control, so stopping a drift never ends in a
// string of bumps. While thrusting, drift across the thrust fades (the robot goes where it is pushed); thrusting
// against the drift brakes harder; drifting toward a wall slows to a touch before it, unless thrusting that way on
// purpose (as Int-Ball2's own controller keeps it off the walls); and turning is quicker (held, it reaches 45°/s,
// gentle 10°/s, as with Zero-g off) and settles faster. Letting go still drifts.
const ZERO_G_FLY = Object.assign({}, ZERO_G_GAME, { counter: 2.5, spinAccel: 135, fineSpinAccel: 30, spinDrag: 3, maxSpin: 60, steerAssist: 1.5, wallReach: 0.6, wallBrake: 2.5 });
// On a touch screen turning is quicker: a thumb on a stick has little travel and no feel for a slow spin.
const ZERO_G_TOUCH = Object.assign({}, ZERO_G_FLY, { spinAccel: 210, fineSpinAccel: 45, maxSpin: 100 });
// Out of energy (Free flight): the robot barely crawls. Thrust is weaker than gentle, and any faster drift fades to
// 0.12 m/s (from full speed in about a second and a half).
const ZERO_G_TIRED = Object.assign({}, ZERO_G_FLY, { fineAccel: 0.03, slowTo: 0.12, slowDrag: 1.5 });

/** How zero-gravity flight feels. The last three are help (ZERO_G_FLY): see zeroGStep. */
export interface ZeroGSettings {
  accel: number; fineAccel: number; spinAccel: number; fineSpinAccel: number; spinDrag: number; counter: number;
  maxSpeed: number; maxSpin: number; restSpeed: number; restSpin: number; drag: number;
  /** While thrusting, how fast (1/s) drift across the thrust fades. */
  steerAssist?: number;
  /** Drifting toward a wall closer than `wallReach` (m), slowing at up to `wallBrake` (m/s²) to arrive at a touch. */
  wallReach?: number;
  wallBrake?: number;
  /** Faster than `slowTo` (m/s), the drift fades at `slowDrag` (1/s): out of energy (ZERO_G_TIRED). */
  slowTo?: number;
  slowDrag?: number;
}

/** Flying by hand without zero gravity (Drive and Free flight): moves in m/s and turns in °/s while held. */
const STEER = { speed: 0.6, fineSpeed: 0.1, tiredSpeed: 0.04, turn: 45, fineTurn: 10, touchTurn: 75 };

/** A robot flying in zero gravity: `vel` (m/s, world frame) and `spin` (rad/s about body x, y, z) carry on. */
export interface Flyer { pos: Vec3; q: Quat; vel: Vec3; spin: Vec3 }

// One frame of zero-gravity flight. `move` is [forward, right, up] and `turn` is [roll, pitch, yaw] about
// the body axes, each -1..1: they accelerate the robot instead of moving it, and it keeps drifting and
// spinning afterwards (the spin settles; the drift does not, unless `zg` has drag). `step(pos, delta)` moves
// through the allowed space (sliding along walls); the motion into a wall stops. `brake` fires against the
// motion. `zg` is the feel (ZERO_G, the default, or ZERO_G_GAME).
// Updates `b` and returns whether it moved, and `impact`: the speed (m/s) the walls took away this frame.
function zeroGStep(b: Flyer, dt: number, fine: boolean, move: number[], turn: number[], brake: boolean, step: (p: Vec3, delta: Vec3) => Vec3, zg?: ZeroGSettings) {
  const ZG: ZeroGSettings = zg || ZERO_G, accel = fine ? ZG.fineAccel : ZG.accel, spinAccel = (fine ? ZG.fineSpinAccel : ZG.spinAccel) * Math.PI / 180;
  let vel = b.vel, spin = b.spin, impact = 0, push: Vec3 | null = null;

  if (move[0] || move[1] || move[2]) {
    // Thrust follows the camera picture, like normal driving: forward, the picture's right, the robot's top.
    const f = cameraDir(b.q), r = qRotate(b.q, [0, -1, 0]), u = topDir(b.q);
    const dir = add(add(scale(f, move[0]), scale(r, move[1])), scale(u, move[2]));
    const dv = scale(dir, accel * dt), sv = len(vel), vh = sv > 0 ? scale(vel, 1 / sv) : null;
    vel = add(vel, dv);

    // Thrust against the drift brakes harder, down to a stop (never past it).
    const along = vh ? dot(dv, vh) : 0;
    if (vh && along < 0) vel = add(vel, scale(vh, Math.min(0, Math.max(-(sv + along), (ZG.counter - 1) * along))));

    // Help: drift across the thrust fades, so the robot goes where it is pushed.
    if (len(dir) > 1e-9) {
      push = norm(dir);
      if (ZG.steerAssist) { const across = sub(vel, scale(push, dot(vel, push))); vel = sub(vel, scale(across, Math.min(1, ZG.steerAssist * dt))); }
    }
  }

  spin = spin.map(function (w, i) {
    const dw = turn[i] * spinAccel * dt;
    if (w * dw >= 0) return w + dw;
    const s = w + dw * ZG.counter; // turning against the spin: harder, down to a stop
    return s * w >= 0 ? s : Math.abs(dw) > Math.abs(w) ? w + dw : 0;
  });

  if (brake) {
    const sv = len(vel), sw = len(spin);
    vel = sv <= accel * dt ? [0, 0, 0] : scale(vel, 1 - accel * dt / sv);
    spin = sw <= spinAccel * dt ? [0, 0, 0] : scale(spin, 1 - spinAccel * dt / sw);
  }

  // The spin settles (the drift is kept, or fades with `drag`), the speed limits, and rest below a crawl.
  const maxSpin = ZG.maxSpin * Math.PI / 180;
  spin = scale(spin, Math.exp(-ZG.spinDrag * dt));
  if (ZG.drag) vel = scale(vel, Math.exp(-ZG.drag * dt));
  if (ZG.slowTo && len(vel) > ZG.slowTo) vel = scale(vel, Math.max(ZG.slowTo / len(vel), Math.exp(-(ZG.slowDrag || 1) * dt)));
  if (len(vel) > ZG.maxSpeed) vel = scale(norm(vel), ZG.maxSpeed);
  if (len(spin) > maxSpin) spin = scale(norm(spin), maxSpin);
  const thrusting = move.some(Boolean) || turn.some(Boolean);
  if (!thrusting && len(vel) < ZG.restSpeed) vel = [0, 0, 0];

  // Help: drifting toward a wall (not thrusting that way), slow down to arrive at a touch: an even braking (0.8 m/s²)
  // that ends at 0.08 m/s on the wall, about a second from half a metre away.
  const sp = len(vel);
  if (ZG.wallBrake && sp > 0.05 && !(push && dot(push, vel) > 0.3 * sp)) {
    const reach = ZG.wallReach || 0.5, vh = scale(vel, 1 / sp), pos = b.pos;
    // How far a step straight on gets (step() takes a move that ends in a wall only along the axes it can).
    const gets = function (s: number) { return dot(sub(step(pos, scale(vh, s)), pos), vh) >= s - 1e-6; };
    if (!gets(reach)) {
      let free = 0, hi = reach; // clear straight on, to about a centimetre
      for (let k = 0; k < 6; k++) { const m = (free + hi) / 2; if (gets(m)) free = m; else hi = m; }
      const allowed = Math.sqrt(0.0064 + 1.6 * free);
      if (sp > allowed) vel = scale(vh, Math.max(allowed, sp - ZG.wallBrake * dt));
    }
  }
  if (!thrusting && len(spin) < ZG.restSpin * Math.PI / 180) spin = [0, 0, 0];
  let changed = false;

  if (len(vel) > 0) {
    const delta = scale(vel, dt), np = step(b.pos, delta), moved = [np[0] - b.pos[0], np[1] - b.pos[1], np[2] - b.pos[2]];
    // A wall stopped part of the move: that part of the motion stops too (sliding along it carries on).
    const kept = vel.map(function (v, i) { return Math.abs(moved[i] - delta[i]) > 1e-9 ? 0 : v; });
    impact = len([vel[0] - kept[0], vel[1] - kept[1], vel[2] - kept[2]]);
    vel = kept;
    if (len(moved) > 1e-9) { b.pos = np; changed = true; }
  }

  if (len(spin) > 0) {
    let q = b.q;
    if (spin[0]) q = qMul(q, qFromAxisAngle([1, 0, 0], spin[0] * dt));
    if (spin[1]) q = qMul(q, qFromAxisAngle([0, 1, 0], spin[1] * dt));
    if (spin[2]) q = qMul(q, qFromAxisAngle([0, 0, 1], spin[2] * dt));
    b.q = qNorm(q);
    changed = true;
  }

  b.vel = vel; b.spin = spin;
  return { changed: changed, impact: impact };
}

/** The Free flight game's energy, as stamina in Dark Souls. Full thrust is sprinting: it drains the bar while held
 * (a full bar lasts 15 s) and holds the refill back. Gentle thrust (Fine) is walking and turning is looking about:
 * free, and the bar refills meanwhile. Halt is a roll: a fixed cost, allowed with any energy left. A second after
 * the last use the bar refills at a steady rate (full in 4 s), moving or not. Run dry while thrusting, the
 * robot is tired: it barely crawls (ZERO_G_TIRED), and no refill, until the thrust is let go. */
export interface Energy { level: number; rest: number; tired: boolean }
const ENERGY = { use: 100 / 15, delay: 1, refill: 30, halt: 25 };

// One frame of energy: `use` is the full thrust held (0 to 1; gentle thrust is 0).
function energyStep(e: Energy, dt: number, use: number): Energy {
  let level = e.level, rest = e.rest, tired = e.tired;
  if (use > 0) {
    rest = 0;
    if (!tired) { level = Math.max(0, level - ENERGY.use * use * dt); if (level <= 0) tired = true; }
  } else {
    tired = false;
    rest += dt;
    if (rest >= ENERGY.delay) level = Math.min(100, level + ENERGY.refill * dt);
  }
  return { level: level, rest: rest, tired: tired };
}

// Halt (a roll): with any energy left it stops the robot at once and costs ENERGY.halt, down to empty at worst;
// with none, it can't. Returns the energy after, and whether it halted.
function energyHalt(e: Energy): { energy: Energy; ok: boolean } {
  if (e.level <= 0) return { energy: e, ok: false };
  return { energy: { level: Math.max(0, e.level - ENERGY.halt), rest: 0, tired: e.tired }, ok: true };
}

export { ENERGY, STEER, ZERO_G, ZERO_G_FLY, ZERO_G_GAME, ZERO_G_TIRED, ZERO_G_TOUCH, energyHalt, energyStep, zeroGStep };
