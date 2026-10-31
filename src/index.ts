// Entry point. The build (rollup.config.mjs) bundles src/ into dist/kibo-nav-sandbox.js, one file that works
// as a plain <script>, as an import in a bundler, and from Node (require() returns Core, for the tests).
import { Core } from './core/index.js';
import { VERSION } from './version.js';
import { defineElement } from './element/sandbox.js';
import { buildBall, buildCube, ballParts } from './element/robots.js';

// CommonJS's `module` when Node loads the bundle (the tests); not defined in browsers.
declare const module: { exports: unknown } | undefined;
/** window.KiboNavSandbox: Core, the version, the element class, and the two robot models of the robots page with the parts of the ball. */
export interface KiboNavSandboxNamespace { Core: typeof Core; version: string; Element?: ReturnType<typeof defineElement>; buildBall: typeof buildBall; buildCube: typeof buildCube; ballParts: typeof ballParts }
declare global { interface Window { KiboNavSandbox?: KiboNavSandboxNamespace } }

if (typeof module === 'object' && module.exports) module.exports = Core;

if (typeof window !== 'undefined' && typeof HTMLElement !== 'undefined' && typeof customElements !== 'undefined') {
  // Namespace for scripts; never overwrite something the host page already named KiboNavSandbox.
  const ns: KiboNavSandboxNamespace = { Core: Core, version: VERSION, buildBall: buildBall, buildCube: buildCube, ballParts: ballParts };
  if (window.KiboNavSandbox === undefined) window.KiboNavSandbox = ns;
  ns.Element = defineElement();
}
