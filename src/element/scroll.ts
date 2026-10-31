// Opt-in (the page sets the element's center-on-load attribute), on a phone held upright: once the page has
// loaded, scroll it so the box `part()` gives (in screen coordinates) sits in the middle of the screen (one a
// little taller than the screen loses the same at both ends), and keep it there for 1.5 s while the page settles:
// the address bar sliding away changes the screen's height, and the layout can still move. The browser does not
// put back an earlier scroll position on these pages. A touch, click, scroll or key before then wins. Used by the
// sandbox .
function centerOnLoad(el: Element, part: () => { top: number; height: number }) {
  if (!el.hasAttribute('center-on-load') || window.innerHeight <= window.innerWidth) return;
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) { /* not allowed */ }
  let user = false;
  const stop = function () { user = true; };
  ['touchstart', 'pointerdown', 'wheel', 'keydown'].forEach(function (ev) { window.addEventListener(ev, stop, { once: true, passive: true }); });

  const center = function () {
    const r = part(), y = Math.max(0, Math.round(window.scrollY + r.top - (window.innerHeight - r.height) / 2));
    if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
  };

  const settle = function (t0: number) {
    if (user) return;
    center();
    if (performance.now() - t0 < 1500) requestAnimationFrame(function () { settle(t0); });
  };

  const go = function () { settle(performance.now()); };
  if (document.readyState === 'complete') requestAnimationFrame(go); else window.addEventListener('load', go, { once: true });
}

export { centerOnLoad };
