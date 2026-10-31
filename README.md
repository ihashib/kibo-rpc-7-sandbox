# Kibo-RPC sandbox

Practice pages for the Kibo Robot Programming Challenge (Kibo-RPC), in Bangla and English (English by default; a button switches):

- **Sandbox** (`index.html`): plan a route for the robot in Kibo's module, drive it by hand, see it from the top, side, end, in 3D and through its camera, and check it against the 7th Kibo-RPC's rules.
- **The robots**: the Int-Ball2 ball and the Astrobee cube, part by part, in 3D.
- **Coordinates and rotations**, the **rules guide** and **how to use** the sandbox.

Static files only: no server, no accounts, no database, no analytics. Nothing is loaded from another website (three.js and the font are copied in), and what students do stays in their own browser.

## Putting it on stemx365.org

`site/` is the finished tool. Every address inside it is relative, so it works in any folder.

**1. As pages of their own** (simplest): upload the contents of `site/` to a folder of the website, say `/kibo-rpc/`, and link to `/kibo-rpc/index.html`. The pages' tabs link to each other inside the folder.

**2. Inside an existing page**, with an iframe (nothing of the page's own styles can disturb it):

```html
<iframe src="/kibo-rpc/embed.html?theme=light" title="Kibo-RPC sandbox"
        style="width:100%;height:1200px;border:0" allow="clipboard-write" loading="lazy"></iframe>
```

`embed.html` options: `theme=light|dark`, `mode=practice` (no helpers), `config=world.json` (another world), `id=name` (use a different one for each iframe on a page).

**3. As an element in their own page**: upload `site/` as in 1, then in the page:

```html
<script src="/kibo-rpc/dist/kibo-nav-sandbox.js"></script>
<kibo-nav-sandbox height="680px"></kibo-nav-sandbox>
```

The script finds three.js at `../vendor/` from where it sits, so keep `dist/` and `vendor/` together. `examples/` has a plain page and a React wrapper.

**Content policy**: if the website sends a Content-Security-Policy, the pages need `script-src 'self' 'unsafe-inline'`, `style-src 'self' 'unsafe-inline'`, `font-src 'self'`, `img-src 'self' data: blob:`, `worker-src 'self' blob:`, and `frame-ancestors` to include the website if it frames `embed.html`.

## Working on it

Needs Node 20 or newer.

```
npm install
npm run build       # bundles src/ and builds site/ (also run before uploading a change)
npm test            # the maths of the sandbox
npm run serve       # site/ at http://127.0.0.1:8080
```

- `src/core/`: the maths, with no screen: routes, markers, camera, world.
- `src/element/`: the `<kibo-nav-sandbox>` element (`robots.ts` draws the two robots).
- `pages/`: the HTML pages. `docs/help/`: the pictures in the manual. `world.json`: the 7th Kibo-RPC world.
- `site/` is generated: do not edit it by hand.

## Licence

`LICENSE` (PolyForm Noncommercial 1.0.0) came with the code. Whoever owns the project decides the licence it is used under, and should replace the file before it is published.

Inspired by Kibo-RPC. Not affiliated with JAXA, NASA or UNOOSA.
