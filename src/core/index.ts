/* =====================================================================
 * Core: pure maths, no DOM. Also loaded by the Node tests.
 * Frame: metres. The 7th Kibo-RPC uses iss_body (origin near Int-Ball2's dock, x along Kibo
 * toward the airlock). +z points toward the deck ("down" in the 3D view).
 * Quaternions are [x, y, z, w]. The camera looks along body +X; body +Z is the robot's top.
 * ===================================================================== */
import { ARUCO_4X4, cameraFrame, captureCheck, markerBits, markerCorners, markerFrame, markerFromTvec, projectPx, readMarkers, toCamera } from './camera.js';
import { checkpointCheck } from './checkpoints.js';
import { DEFAULT_WORLD, LEVELS, X_AXIS, levelFor } from './defaults.js';
import { toCode, toCpp, toJava, toPython } from './export.js';
import { blockHint, dirText, missionStatus } from './mission.js';
import { nearestFree, planPath } from './planner.js';
import { aimQuat, angleDeg, cameraDir, faceQuat, qAngleDeg, qConj, qFromAxisAngle, qFromTo, qFromYawPitch, qMul, qNorm, qRotate, qSlerp, rollErrorDeg, topDir, yawPitchFromQ } from './quat.js';
import { analyzeRoute, appendGoTo, appendWaypoint, exampleRoute, exampleWaypoint, fixRoute, goToWaypoint, makeCheckpoints, normalizeRoute, normalizeWaypoint, resolveRoute, routeAround, standoffPose, starterRoute } from './route.js';
import { checkSegment, driveStep, inBox, isFree, oasisLength, pointStatus, slideStep, whyText } from './space.js';
import { ENERGY, STEER, ZERO_G, ZERO_G_FLY, ZERO_G_GAME, ZERO_G_TIRED, ZERO_G_TOUCH, energyHalt, energyStep, zeroGStep } from './flight.js';
import { add, copy, cross, dist, dot, fmt, isVec, len, lerp, norm, round, roundVec, scale, sub } from './vec.js';
import { boxCenter, boxSize, findCheckpoint, findPose, findTarget, kizBounds, markerNumber, normalizeWorld, targetCenter, worldBounds } from './world.js';
import { VERSION } from '../version.js';

const Core = {
  VERSION: VERSION, DEFAULT_WORLD: DEFAULT_WORLD, X_AXIS: X_AXIS,
  copy: copy, add: add, sub: sub, scale: scale, dot: dot, cross: cross, len: len, dist: dist, norm: norm, lerp: lerp,
  round: round, roundVec: roundVec, fmt: fmt, isVec: isVec,
  qNorm: qNorm, qMul: qMul, qFromAxisAngle: qFromAxisAngle, qFromTo: qFromTo, qRotate: qRotate, qSlerp: qSlerp,
  qAngleDeg: qAngleDeg, faceQuat: faceQuat, cameraDir: cameraDir, qFromYawPitch: qFromYawPitch, yawPitchFromQ: yawPitchFromQ, driveStep: driveStep,
  qConj: qConj, angleDeg: angleDeg, topDir: topDir, rollErrorDeg: rollErrorDeg, aimQuat: aimQuat,
  findCheckpoint: findCheckpoint, checkpointCheck: checkpointCheck, makeCheckpoints: makeCheckpoints, LEVELS: LEVELS, levelFor: levelFor, markerNumber: markerNumber,
  ARUCO_4X4: ARUCO_4X4, markerBits: markerBits, markerFrame: markerFrame, markerCorners: markerCorners, cameraFrame: cameraFrame,
  toCamera: toCamera, projectPx: projectPx, readMarkers: readMarkers, markerFromTvec: markerFromTvec,
  starterRoute: starterRoute, exampleWaypoint: exampleWaypoint, appendWaypoint: appendWaypoint,
  normalizeWorld: normalizeWorld, boxCenter: boxCenter, boxSize: boxSize, findTarget: findTarget, findPose: findPose,
  kizBounds: kizBounds, worldBounds: worldBounds, inBox: inBox, pointStatus: pointStatus, isFree: isFree, whyText: whyText,
  checkSegment: checkSegment, oasisLength: oasisLength, planPath: planPath, nearestFree: nearestFree,
  targetCenter: targetCenter, standoffPose: standoffPose, normalizeWaypoint: normalizeWaypoint, normalizeRoute: normalizeRoute,
  resolveRoute: resolveRoute, analyzeRoute: analyzeRoute, routeAround: routeAround, fixRoute: fixRoute,
  goToWaypoint: goToWaypoint, appendGoTo: appendGoTo, exampleRoute: exampleRoute, toJava: toJava, toCpp: toCpp, toPython: toPython, toCode: toCode,
  captureCheck: captureCheck, missionStatus: missionStatus, blockHint: blockHint, dirText: dirText,
  slideStep: slideStep, ZERO_G: ZERO_G, ZERO_G_GAME: ZERO_G_GAME, ZERO_G_FLY: ZERO_G_FLY, ZERO_G_TIRED: ZERO_G_TIRED, ZERO_G_TOUCH: ZERO_G_TOUCH, STEER: STEER, zeroGStep: zeroGStep, ENERGY: ENERGY, energyStep: energyStep, energyHalt: energyHalt, 
  
};

export { Core };
