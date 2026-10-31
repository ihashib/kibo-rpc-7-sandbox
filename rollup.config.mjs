// Bundles src/ (TypeScript) into dist/kibo-nav-sandbox.js: the one file sites copy and the pages and tests load.
// Run `npm run build` after changing anything in src/ (or `npm run watch` while working).
import { readFileSync } from 'node:fs';
import typescript from '@rollup/plugin-typescript';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default {
  input: 'src/index.ts',
  // Ship src/ as written: tree-shaking would quietly drop unused code (even unused local variables).
  treeshake: false,
  // Type errors stop the build (tsconfig.json has the settings; its noEmit is for `npm run typecheck`).
  plugins: [typescript({ noEmitOnError: true, compilerOptions: { noEmit: false } })],
  output: {
    file: 'dist/kibo-nav-sandbox.js',
    format: 'iife',
    banner: '/*! KIBO RPC 7 Nav Sandbox v' + pkg.version + ' | by ihashib (https://ihashib.github.io) | PolyForm Noncommercial License 1.0.0: no commercial use without permission | Inspired by Kibo-RPC. Not affiliated with JAXA or UNOOSA; contains no JAXA assets. */'
  }
};
