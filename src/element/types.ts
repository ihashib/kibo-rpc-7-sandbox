// The element's state shapes. Types only: nothing here exists at run time.
import type * as THREE_NS from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import type { Leg, Pose, Px, Quat, Vec3, Waypoint, World } from '../core/types.js';

/** three.js r128 as loaded from the CDN: the THREE global, with examples/js OrbitControls attached. */
export type Three = typeof THREE_NS & { OrbitControls: typeof OrbitControls };
export type { OrbitControls };
export type { THREE_NS as THREE };

declare global {
  interface Window { THREE?: Three }
  interface Document { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void }
  interface HTMLElement { webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void> | undefined }
  // Not in TypeScript's DOM types any more; phones that support it lock to landscape in full screen.
  interface ScreenOrientation { lock?: (orientation: string) => Promise<void> }
}

/** Which axes a 2D view draws: `h` right, `v` down, `d` depth; `from` is the side it looks from. */
export interface ViewDef { name: string; h: number; v: number; d: number; from: string }

/** A 2D view (Top, Side, End): its canvas, scale (`s` px per metre) and centre, and the gesture in progress. */
export interface View2D {
  key: string;
  def: ViewDef;
  cell: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  dpr?: number;
  cx: number;
  cy: number;
  s: number;
  fitted: boolean;
  touched?: boolean;
  pointers: Map<number, Px>;
  hover: Px | null;
  pan?: { sx: number; sy: number; cx: number; cy: number; moved: boolean } | null;
  drag?: { i: number; moved: boolean; before: string; off: number[]; start: number[] } | null;
  pinch?: { d: number; s: number; mid: number[]; c: number[] } | null;
  lastTap?: { t: number; x: number; y: number } | null;
}

/** The Camera view's canvas. */
export interface Cam2D { w: number; h: number; dpr: number; ctx: CanvasRenderingContext2D }

/** Drive mode: where the robot is, and what the keys, sticks and hold buttons are doing. */
export interface DriveState {
  pos: Vec3;
  q: Quat;
  start: Pose;
  keys: Record<string, boolean>;
  joy: { move: number[]; turn: number[] };
  hold: Record<string, boolean>;
  fine: boolean;
  /** The last frame's timestamp (ms), 0 after a pause. */
  last: number;
  hudAt: number;
  raf?: number;
  /** The markers the camera read last frame, and the last checkpoint level logged ("cp3:2"). */
  lastIds?: (number | null)[];
  lastLv?: string;
}

/** One step of Play: a move (`dur` seconds at 1×) or a hold to read the markers (real seconds). */
export interface PlayStep { l: Leg; dur: number; hold?: boolean }
export type BootLine = ['ok' | 'warn' | 'run', string];

export interface PlayState {
  legs: PlayStep[];
  /** When the robot starts moving (ms, performance.now()); before that it is Initializing. */
  t0: number;
  info: string;
  said: Record<number, number>;
  bootLines: BootLine[];
  boot: number;
  mult: number;
  k: number;
  t: number;
  last: number;
  paused: boolean;
  pausedAt?: number;
  raf?: number;
}

export interface UiState { tab: string; view: string | null; playSpeed: number; lang: string; pip?: boolean }

/** A named save in the Saves panel. */
export interface SavedRoute { name: string; savedAt: string; route: Waypoint[]; config: World }

/** A label's texture, with the text's width / height kept for sizing the sprite. */
export type LabelTexture = THREE_NS.Texture & { userData: { aspect: number } };
/** Any object in the 3D scene, as _clearGroup and the label pass look at it. */
export type SceneObject = THREE_NS.Object3D & { geometry?: { dispose(): void }; material?: { dispose(): void }; isSprite?: boolean };

export interface Geometries {
  box: THREE_NS.BoxGeometry;
  sphere: THREE_NS.SphereGeometry;
  plane: THREE_NS.PlaneGeometry;
  cyl: THREE_NS.CylinderGeometry;
  cone: THREE_NS.ConeGeometry;
}

/** How a route change is recorded: `reason` goes to the progress check, `keepList` skips re-rendering the list. */
export interface CommitOptions { reason?: string; keepList?: boolean }
