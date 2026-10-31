// Builds site/: the whole tool as plain static files, ready to upload to any web server, in any folder of it (every address inside is
// relative). Nothing is loaded from another website: three.js, its OrbitControls and the Bangla font are copied in. Run after
// `npm run bundle` (npm run build does both).
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname, out = join(root, 'site');
const at = (...p) => join(root, ...p);
const fail = (m) => { console.error('build-site: ' + m); process.exit(1); };

if (!existsSync(at('dist/kibo-nav-sandbox.js'))) fail('dist/kibo-nav-sandbox.js is missing: run `npm run bundle` first');
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'vendor/fonts'), { recursive: true });
mkdirSync(join(out, 'dist'), { recursive: true });

for (const f of readdirSync(at('pages'))) cpSync(at('pages', f), join(out, f));
cpSync(at('lang.js'), join(out, 'lang.js'));
cpSync(at('world.json'), join(out, 'world.json'));
cpSync(at('LICENSE'), join(out, 'LICENSE.txt'));
cpSync(at('docs/help'), join(out, 'docs/help'), { recursive: true });
cpSync(at('examples'), join(out, 'examples'), { recursive: true });
cpSync(at('dist/kibo-nav-sandbox.js'), join(out, 'dist/kibo-nav-sandbox.js'));
writeFileSync(join(out, '.nojekyll'), ''); // (GitHub Pages: serve the files as they are)

// three.js r128 and OrbitControls: the versions the tool was written for.
cpSync(at('node_modules/three/build/three.min.js'), join(out, 'vendor/three.min.js'));
cpSync(at('node_modules/three/examples/js/controls/OrbitControls.js'), join(out, 'vendor/OrbitControls.js'));

// The font: only the Bangla and Latin parts of Noto Sans Bengali, at the weights the pages use.
const fontDir = at('node_modules/@fontsource/noto-sans-bengali');
let fontCss = '';
for (const w of [400, 500, 600, 700]) {
  const css = readFileSync(join(fontDir, w + '.css'), 'utf8');
  for (const block of css.match(/@font-face\s*{[^}]*}/g) || []) {
    const m = /url\(\.\/files\/(noto-sans-bengali-(bengali|latin)-\d+-normal\.woff2)\)/.exec(block);
    if (!m) continue;
    cpSync(join(fontDir, 'files', m[1]), join(out, 'vendor/fonts', m[1]));
    fontCss += block.replace(/src:[^;]*;/, 'src: url(fonts/' + m[1] + ") format('woff2');") + '\n';
  }
}
if (!/bengali-400/.test(fontCss) || !/latin-700/.test(fontCss)) fail('the font files were not found in @fontsource/noto-sans-bengali');
writeFileSync(join(out, 'vendor/fonts.css'), fontCss);

// Nothing may reach another website to load: this is what makes it safe behind a strict content policy.
for (const f of readdirSync(out).filter((n) => n.endsWith('.html'))) {
  const h = readFileSync(join(out, f), 'utf8');
  if (/<(script|link|img|iframe)\b[^>]*(src|href)="https?:/.test(h.replace(/<link[^>]*rel="(?:canonical|alternate)"[^>]*>/g, ''))) {
    const bad = h.match(/<(script|link|img|iframe)\b[^>]*(src|href)="https?:[^"]*"/);
    if (bad && !/<link[^>]*rel="?preconnect/.test(bad[0]) && !/^<a /.test(bad[0])) fail(f + ' still loads something from another website: ' + bad[0].slice(0, 120));
  }
}
const js = readFileSync(join(out, 'dist/kibo-nav-sandbox.js'), 'utf8');
if (/fonts\.g(oogleapis|static)\.com/.test(js)) fail('the script still refers to Google Fonts');
console.log('site/ built: ' + readdirSync(out).filter((n) => n.endsWith('.html')).length + ' pages, three.js, the font');
