// An on-screen joystick (Drive's sticks): `j` is the stick (a circle with a .knob),
// `zone` an optional bigger touch area around it. `set([x, y])` gets the stick's position, each -1..1 (right and
// down are +), [0, 0] when let go; `down()` runs when a thumb lands on it.
function setupStick(j: HTMLElement, zone: HTMLElement | null, set: (v: number[]) => void, down?: () => void) {
  let knob = j.querySelector<HTMLElement>('.knob')!, id = null as number | null, org = [0, 0, 1];

  // Measured from the circle's centre, or from where the thumb landed when it landed in the halo
  // around the circle (so a touch there starts still instead of at full speed).
  // Measured on the screen from where the stick started (`org`: x, y, radius), not from where the stick is
  // now, so the page scrolling under a held thumb does not move the robot.
  function place(e: PointerEvent) {
    const R = org[2];
    let x = (e.clientX - org[0]) / R, y = (e.clientY - org[1]) / R, m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; m = 1; }
    knob.style.transform = 'translate(' + (x * R * 0.6) + 'px,' + (y * R * 0.6) + 'px)';
    set(m < 0.12 ? [0, 0] : [x, y]);
  }

  function end(e: PointerEvent) {
    if (e.pointerId !== id) return;
    id = null; knob.style.transform = '';
    set([0, 0]);
  }

  function start(e: PointerEvent, el: HTMLElement) {
    if (id !== null) return; // one thumb per stick
    id = e.pointerId;
    try { el.setPointerCapture(id); } catch (err) { /* ignore */ }
    const r = j.getBoundingClientRect(), R = r.width / 2, dx = e.clientX - r.left - R, dy = e.clientY - r.top - R;
    // From the circle's centre, or from where the thumb landed when it landed in the halo around it.
    org = Math.hypot(dx, dy) > R ? [e.clientX, e.clientY, R] : [r.left + R, r.top + R, R];
    place(e); e.preventDefault();
    if (down) down();
  }

  function move(e: PointerEvent) { if (e.pointerId === id) place(e); }

  // The stick itself, and the touch zone around it.
  [j, zone].forEach(function (el) {
    if (!el) return;
    el.addEventListener('pointerdown', function (e) { start(e, el); });
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  });
}

// Whether the main input is a touch screen on a phone or tablet, so the page should show sticks. Phones and
// tablets are known by their browser, since some also report a fine pointer (a stylus, mouse support); any
// other touch screen counts only without a mouse or touchpad (a touch-screen laptop gets the keys).
function touchFirst(): boolean {
  const mm = function (q: string) { return !!(window.matchMedia && window.matchMedia(q).matches); };
  const points = navigator.maxTouchPoints || 0, ua = navigator.userAgent || '';
  if (!mm('(pointer:coarse)') && !mm('(any-pointer:coarse)') && !points) return false;
  const mobile = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua) || (/Macintosh/.test(ua) && points > 1); // iPadOS says Macintosh
  return mobile || (mm('(pointer:coarse)') && !mm('(any-pointer:fine)'));
}

export { setupStick, touchFirst };
