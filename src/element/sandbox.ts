/* =====================================================================
 * Web component: <kibo-nav-sandbox>
 * ===================================================================== */
import { Core } from '../core/index.js';
import type { Analysis, MissionStatus, Pose, Vec3, Waypoint, World } from '../core/types.js';
import { CameraView } from './camera-view.js';
import { Drive } from './drive.js';
import { Events } from './events.js';
import { Fullscreen } from './fullscreen.js';
import { Insets } from './insets.js';
import { mixin } from './mixin.js';
import { Panel } from './panel.js';
import { Playback } from './playback.js';
import { RouteActions } from './route-actions.js';
import { Saves } from './saves.js';
import { Setup } from './setup.js';
import { StateChanges } from './state.js';
import { STORE_PREFIX } from './storage.js';
import type { Cam2D, DriveState, Geometries, OrbitControls, PlayState, SavedRoute, THREE, Three, UiState, View2D } from './types.js';
import { View3D } from './view3d.js';
import { Views2D } from './views2d.js';
import { WorldActions } from './world-actions.js';

// HTMLElement only exists in browsers. Node (the tests) loads this module too, but never uses the class.
const HTMLElementBase = (typeof HTMLElement !== 'undefined' ? HTMLElement : Object) as typeof HTMLElement;

export class KiboNavSandbox extends HTMLElementBase {
  // The element's state. `declare` only tells TypeScript about the fields (no code): the constructor sets
  // the first group, _build and the views set the rest as the element is used.
  declare _base: World;
  declare _config: World;
  declare _route: Waypoint[];
  declare _analysis: Analysis;
  declare _mission: MissionStatus;
  /** Moves whose "why is it blocked?" hint is open, by leg index. */
  declare _hints: Record<number, number>;
  declare _sel: number;
  /** Earlier routes (JSON), newest last. */
  declare _undo: string[];
  declare _saves: SavedRoute[];
  /** Milestone key -> when it was first done (ISO time). */
  declare _progress: Record<string, string>;
  declare _ui: UiState;
  declare _views: Record<string, View2D>;
  declare _built: boolean;
  declare _userActed: boolean;
  declare _configByApi: boolean;
  declare _routeByApi: boolean;
  declare _play: PlayState | null;

  // Set by _build and the theme.
  declare _root: HTMLElement;
  declare _c: Record<string, string>;
  declare _dark: boolean;
  declare _booted: boolean;
  declare _storageOk: boolean;
  declare _configFromStore: boolean;
  declare _routeFromStore: boolean;
  declare _routeEdited: boolean;
  declare _narrow: boolean;
  declare _short: boolean;
  declare _sticks: boolean;
  declare _keyboard: boolean;
  declare _scroll3d: boolean;
  declare _ro: ResizeObserver;
  declare _mq: MediaQueryList;
  declare _mqFn: () => void;
  declare _fs: 'real' | 'pseudo' | null;
  declare _fsFn: () => void;
  declare _pageOverflow: string | null;
  declare _drawer: boolean;
  declare _overlayOpen: boolean;
  declare _termMin: boolean;
  declare _termAuto: boolean;
  declare _logT0: number;
  declare _toastTimer: number;
  declare _saveTimer: number;
  declare _pendingUndo: string | null;
  declare _hintLen: number;
  declare _lastBlocked: number;
  declare _lastDone: Record<string, number>;
  declare _sawKozBlock: boolean;
  declare _expandFrom: string | null;

  // Play and Drive.
  declare _robotPose: Pose | null;
  declare _playEnded: true | 'blocked' | 'stopped' | null;
  declare _playNote: string;
  declare _playViewBefore: string | null;
  declare _drive: DriveState | null;
  declare _uiViewBeforeDrive: string | null;
  declare _viewBeforeDrive: { pos: THREE.Vector3; target: THREE.Vector3; roll: number } | null;
  declare _winBlur: () => void;
  declare _winKeyDown: (e: KeyboardEvent) => void;
  declare _winKeyUp: (e: KeyboardEvent) => void;

  // The Camera view.
  declare _cam2d: Cam2D;
  declare _camInfoKey: string;

  // The 3D view (three.js), set up once three.js has loaded.
  declare _T: Three;
  declare _no3d: boolean;
  declare _renderer: THREE.WebGLRenderer;
  declare _scene: THREE.Scene;
  declare _camera: THREE.PerspectiveCamera;
  declare _controls: OrbitControls;
  declare _raycaster: THREE.Raycaster;
  declare _iss: THREE.Group;
  declare _issRoot: THREE.Group;
  declare _static: THREE.Group;
  declare _dynamic: THREE.Group;
  declare _robot3: THREE.Group;
  declare _driveLine3: THREE.Line;
  declare _geo: Geometries;
  declare _mats: Record<string, THREE.Material>;
  declare _labels: Record<string, THREE.Texture>;
  declare _wpMeshes: THREE.Object3D[];
  declare _tmpV: THREE.Vector3;
  declare _center: Vec3;
  declare _touched3d: boolean;
  declare _raf3d: number;

  static get observedAttributes() { return ['theme', 'height', 'config-url', 'mode']; }

  constructor() {
    super();
    this._base = Core.normalizeWorld(Core.DEFAULT_WORLD);
    this._config = Core.copy(this._base);
    this._route = [];
    this._analysis = Core.analyzeRoute(this._config, this._route);
    this._mission = Core.missionStatus(this._config, this._route, this._analysis);
    this._hints = {};
    this._sel = -1;
    this._undo = [];
    this._saves = [];
    this._progress = {};
    this._ui = { tab: 'route', view: null, playSpeed: 2, lang: 'python' };
    this._views = {};
    this._built = false;
    this._userActed = false;
    this._configByApi = false;
    this._routeByApi = false;
    this._play = null;
  }

  /* ---------- lifecycle ---------- */
  connectedCallback() {
    if (!this._built) this._build();
    this._applyMode();
    this._applyHeight();
    this._applyTheme();
    this._observe();
    this._refresh();
    this._renderList();
    this._renderWorld();
    this._renderSaves();
    if (!this._booted) { this._booted = true; this._boot(); }
    const self = this;
    if (!this._fsFn) this._fsFn = function () { if (self._fs === 'real' && !(document.fullscreenElement || document.webkitFullscreenElement)) self._exitFullscreen(); };
    document.addEventListener('fullscreenchange', this._fsFn);
    document.addEventListener('webkitfullscreenchange', this._fsFn);
  }

  disconnectedCallback() {
    if (this._fs) this._exitFullscreen();
    document.removeEventListener('fullscreenchange', this._fsFn);
    document.removeEventListener('webkitfullscreenchange', this._fsFn);
    this._stopPlay();
    if (this._drive) this._toggleDrive(false); // also drops the page-wide key listeners
    if (this._ro) this._ro.disconnect();
    if (this._mq && this._mqFn) { try { this._mq.removeEventListener('change', this._mqFn); } catch (e) { /* old Safari */ } }
  }

  attributeChangedCallback(name: string, oldV: string | null, newV: string | null) {
    if (!this._built || oldV === newV) return;
    if (name === 'theme') this._applyTheme();
    if (name === 'height') this._applyHeight();
    if (name === 'config-url' && newV) this._loadConfigUrl(newV, true);
    if (name === 'mode') { this._applyMode(); this._renderList(); }
  }

  // Guided (default): helpers give rough drafts students must fix. Practice: no helpers at all.
  get _guided() { return (this.getAttribute('mode') || '').toLowerCase() !== 'practice'; }
  get _key() { return STORE_PREFIX + (this.id || 'default'); }
  _applyMode() { if (this._root) this._root.classList.toggle('practice', !this._guided); }
  _defaultRoute() { return this._guided ? Core.starterRoute(this._config) : []; }

  /* ---------- public API ---------- */
  setConfig(obj: unknown) {
    const cfg = Core.normalizeWorld(obj);
    this._configByApi = true;
    this._config = cfg;
    this._afterConfig();
  }

  getConfig() { return Core.copy(this._config); }

  setRoute(arr: unknown) {
    const r = Core.normalizeRoute(arr);
    this._routeByApi = true;
    this._pushUndo(JSON.stringify(this._route));
    this._route = r;
    this._sel = -1;
    this._commit({});
  }

  getRoute() { return Core.copy(this._route); }

  getSummary() {
    const a = this._analysis;
    return { blocked: a.blocked, distance: a.distance, time: a.time, oasis: a.oasis, poses: Core.copy(a.poses), mission: Core.copy(this._mission), score: Core.copy(this._mission.score) };
  }

  getCpp() { return Core.toCpp(this._config, this._route, this._analysis); }

  // Older name: the code from the world's "export" template (C++ in the 7th world).
  getJava() { return Core.toJava(this._config, this._route, this._analysis); }
  getPython() { return Core.toPython(this._config, this._route, this._analysis); }
  getCode(lang?: string) { return Core.toCode(this._config, this._route, this._analysis, lang); }

  // What the robot camera reads now (selected waypoint, Drive or Play pose, else the start).
  readMarkers() { return Core.readMarkers(this._config, this._robotNow()); }
}

// The rest of the methods live in one file per area (see ./*.ts). This tells TypeScript the element has
// them; defineElement copies them onto the class.
export interface KiboNavSandbox extends Setup, Fullscreen, StateChanges, Events, RouteActions, WorldActions, Saves, Panel, Playback, Views2D, CameraView, View3D, Insets, Drive {}

export function defineElement() {
  [Setup, Fullscreen, StateChanges, Events, RouteActions, WorldActions, Saves, Panel, Playback, Views2D, CameraView, View3D, Insets, Drive].forEach(function (part) { mixin(KiboNavSandbox, part); });
  if (!customElements.get('kibo-nav-sandbox')) customElements.define('kibo-nav-sandbox', KiboNavSandbox);
  return KiboNavSandbox;
}
