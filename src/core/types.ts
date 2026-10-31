// The shapes Core works with. Types only: nothing here exists at run time.

/** [x, y, z] in metres (iss_body frame unless a comment says otherwise). */
export type Vec3 = number[];
/** [x, y, z, w], unit length after qNorm. */
export type Quat = number[];
/** [u, v] in camera pixels. */
export type Px = number[];

export interface Pose { pos: Vec3; q: Quat }

/** An axis-aligned box: a Keep-In, Keep-Out or Oasis zone. */
export interface Box { name: string; id?: string; min: Vec3; max: Vec3 }

/** A target: a panel given by its box, or an AR marker given by its pose (pos, q and size). */
export interface Target extends Box {
  id: string;
  normal: Vec3;
  pos?: Vec3;
  q?: Quat;
  size?: number;
}

/** A target that is an AR marker (it has a pose). */
export interface Marker extends Target { pos: Vec3; q: Quat; size: number }

export interface ScoreBand { radius: number; level: number }
export interface AngleBand { angle: number; level: number }

export interface Checkpoint {
  id: number;
  /** "cp" + id: the checkpoint's id among goals and targets. */
  key: string;
  name: string;
  pos: Vec3;
  q: Quat | null;
  marker: Vec3 | null;
  scoreBands: ScoreBand[];
  centeringBands: AngleBand[];
  rollBands: AngleBand[];
}

export interface NamedPose extends Pose { name: string }
export interface WorldPose extends NamedPose { id: string }

export interface Settings {
  clearance: number;
  standoff: number;
  speed: number;
  turnRate: number;
  gridRes: number;
  snap: number;
  aimTolerance: number;
  rangeTolerance: number;
  poseTolerance: number;
}

export interface Robot { name: string; size: number; shape: string }

/** The robot camera, OpenCV pinhole model. */
export interface CameraModel {
  width: number;
  height: number;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  D: number[];
  /** The camera's position in the body frame. */
  offset: Vec3;
  dictionary: string;
  minPerimeterRate: number;
  maxViewAngle: number;
  /** Metres; 0 = no limit. */
  maxDistance: number;
}

export interface Scoring { timeLimit: number; points: number[]; goalPoints: number; checkTime: number }

/** A code template; placeholders are {x} {y} {z} {qx} {qy} {qz} {qw} {name} {i}, plus {cp} in `pass`. */
export interface ExportTemplate { prefix: string; header: string; comment: string; line: string; pass: string; footer: string }

/** A world after normalizeWorld: every field filled in and checked. */
export interface World {
  name: string;
  robot: Robot;
  settings: Settings;
  kiz: Box[];
  koz: Box[];
  oasis: Box[];
  targets: Target[];
  checkpoints: Checkpoint[];
  /** The goal checkpoint's id, or null. */
  goal: number | null;
  camera: CameraModel;
  scoring: Scoring;
  start: NamedPose;
  /** Plain names for the six sides, keyed "-x", "+x", "-y", "+y", "-z", "+z". */
  sides: Record<string, string>;
  poses: WorldPose[];
  /** Goal ids in order: checkpoint keys, target ids or pose ids. */
  mission: string[];
  export: ExportTemplate;
  exportPython: ExportTemplate;
}

export type WaypointMode = 'keep' | 'travel' | 'target' | 'custom';

export interface Waypoint {
  name: string;
  pos: Vec3;
  mode: WaypointMode;
  /** With mode "target": the target to face. */
  target?: string;
  /** With mode "custom": the orientation. */
  q?: Quat;
  /** Added by the planner to go around something. */
  via?: boolean;
}

export interface PointStatus { free: boolean; why?: 'koz' | 'outside'; zone?: string }
export interface SegmentCheck { clear: boolean; hit?: Vec3; t?: number; why?: 'koz' | 'outside'; zone?: string }

/** The move into waypoint `index`. */
export interface Leg {
  index: number;
  from: Vec3;
  to: Vec3;
  qFrom: Quat;
  qTo: Quat;
  dist: number;
  /** Degrees turned on the way. */
  turn: number;
  /** Seconds. */
  time: number;
  clear: boolean;
  /** Metres of the move inside Oasis zones. */
  oasis: number;
  endStatus: PointStatus;
  hit?: Vec3;
  why?: 'koz' | 'outside';
  zone?: string;
}

export interface Analysis {
  poses: Pose[];
  legs: Leg[];
  blocked: number;
  distance: number;
  time: number;
  oasis: number;
  startStatus: PointStatus;
}

export interface CaptureCheck { dist: number; aim: number; lo: number; hi: number; front: boolean; inRange: boolean; aimed: boolean }
export interface CheckpointLevels { pos: number; centering: number; roll: number }
export interface CheckpointCheck { dist: number; centering: number; roll: number; levels: CheckpointLevels; level: number; passed: boolean }

/** One mission goal and what the route does about it. */
export interface Goal {
  id: string;
  name: string;
  kind: 'checkpoint' | 'target' | 'pose';
  done: boolean;
  /** The waypoint that completes it (or comes closest), or -1. */
  index: number;
  message?: string;
  /** Checkpoints only: */
  number?: number;
  goal?: boolean;
  level?: number;
  points?: number;
  /** The waypoint after which an exported program asks the judge about it, or -1. */
  notify?: number;
}

export interface Score { checkpoints: number; goal: number; bonus: number; total: number; time: number; limit: number; inTime: boolean }
export interface MissionStatus { goals: Goal[]; done: number; total: number; score: Score | null; complete: boolean }

/** The robot camera in the world, OpenCV axes: x right, y down, z forward. */
export interface CameraFrame { pos: Vec3; x: Vec3; y: Vec3; z: Vec3 }

/** One marker in the picture (see readMarkers). */
export interface MarkerReading {
  id: number | null;
  target: string;
  name: string;
  corners: Px[];
  center: Px;
  tvec: Vec3;
  distance: number;
  perimeter: number;
  viewAngle: number;
  offCentre: number;
  imageRoll: number;
  rvec?: Vec3;
  /** Why a detector would miss it (missed markers only). */
  why?: string;
}

export interface Readings { seen: MarkerReading[]; missed: MarkerReading[]; camera: CameraFrame }
