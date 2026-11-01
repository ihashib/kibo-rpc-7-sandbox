/* Interactive pictures for the learning pages. A placeholder <div class="viz" data-viz="name"></div> in the page becomes a small
   picture you can drag, turn or press, with the numbers it stands for beside it. They sit next to the text that explains the same
   thing; the text stays as it is. Every picture works with a finger, a mouse or the arrow keys, in Bangla and in English.
   The numbers (Kibo's size, the markers, the camera) are the sandbox's own (world.json). */
(function () {
  'use strict';
  var root = document.documentElement, BN = root.getAttribute('data-lang') === 'bn';
  function T(en, bn) { return BN ? bn : en; }
  var NS = 'http://www.w3.org/2000/svg', SVGT = /^(svg|g|path|circle|line|rect|text|polygon|polyline)$/, D = Math.PI / 180;

  function el(tag, a, kids) {
    var e = SVGT.test(tag) ? document.createElementNS(NS, tag) : document.createElement(tag);
    Object.keys(a || {}).forEach(function (k) {
      var v = a[k]; if (v == null) return;
      if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function f(n, d) { var s = n.toFixed(d); if (/^-0(\.0*)?$/.test(s)) s = s.slice(1); return s.replace('-', '−'); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a || 1; }
  function wrap180(a) { return ((a + 180) % 360 + 360) % 360 - 180; }

  // The frame of the picture: a badge, a title, a hint, and the place for the rest.
  function card(host, title, hint) {
    host.classList.add('viz'); host.textContent = '';
    host.appendChild(el('div', { class: 'vh' }, [el('span', { class: 'vb', text: T('Interactive', 'নিজে করে দেখো') }), el('b', { text: title })]));
    if (hint) host.appendChild(el('p', { class: 'vhint', text: hint }));
    var body = el('div', { class: 'vbody' }); host.appendChild(body); return body;
  }
  function chip(label, cls) { var v = el('b'), c = el('span', { class: 'vc' }, [label ? el('span', { class: cls || '', text: label }) : null, v]); return { box: c, val: v }; }
  function slider(label, min, max, step, value, on, cls) {
    var inp = el('input', { type: 'range', min: min, max: max, step: step, value: value, 'aria-label': label });
    inp.addEventListener('input', function () { on(+inp.value); });
    return { box: el('label', {}, [el('span', { text: label, class: cls || '' }), inp]), input: inp };
  }
  function button(text, on) { var b = el('button', { type: 'button', class: 'btn', text: text }); b.addEventListener('click', on); return b; }

  function toSvg(svg, e) {
    var m = svg.getScreenCTM(); if (!m) return { x: 0, y: 0 };
    var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; p = p.matrixTransform(m.inverse()); return { x: p.x, y: p.y };
  }
  // Dragging `target` (a piece of `svg`): fn(x, y) in the picture's own units. A finger on the piece moves it; the page still scrolls elsewhere.
  function drag(svg, target, fn) {
    target.classList.add('grab');
    var on = false;
    target.addEventListener('pointerdown', function (e) {
      if (e.button) return; on = true; try { target.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      target.classList.add('on'); var p = toSvg(svg, e); fn(p.x, p.y); e.preventDefault();
    });
    target.addEventListener('pointermove', function (e) { if (on) { var p = toSvg(svg, e); fn(p.x, p.y); } });
    function end() { on = false; target.classList.remove('on'); }
    target.addEventListener('pointerup', end); target.addEventListener('pointercancel', end);
    // A finger that lands on the piece moves it instead of scrolling the page (touch-action does not reach shapes inside an svg).
    target.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
  }
  function arrows(target, fn) {
    target.setAttribute('tabindex', '0');
    target.addEventListener('keydown', function (e) {
      var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!d) return;
      e.preventDefault(); var k = e.shiftKey ? 5 : 1; fn(d[0] * k, d[1] * k);
    });
  }
  function handle(r, label) { return el('g', { role: 'slider', 'aria-label': label }, [el('circle', { class: 'hit', r: r + 12 }), el('circle', { class: 'ring', r: r })]); }
  function tri(x, y, ang, size, cls) { // the same, built plainly
    var c = Math.cos(ang), s = Math.sin(ang), L = size, W = size * 0.55;
    var p = [[x + c * L, y + s * L], [x - c * L * 0.1 - s * W, y - s * L * 0.1 + c * W], [x - c * L * 0.1 + s * W, y - s * L * 0.1 - c * W]];
    return el('polygon', { class: cls, points: p.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ') });
  }

  // ---------- Kibo, from the sandbox's world ----------
  var BOX = { x: [0, 7.195], y: [-1.001, 1.046], z: [-0.208, 1.884] };
  var MARKS = [[1, 1.451, -1.001, 0.681], [2, 2.973, -1.001, 0.718], [3, 3.313, -1.001, 0.523], [4, 4.181, -1.001, 0.523], [5, 5.754, -1.001, 0.838], [6, 1.895, -0.282, -0.208],
    [7, 1.451, -1.001, 0.372], [8, 4.779, 0.112, 1.884], [9, 2.066, 1.046, -0.014], [10, 5.851, 0.01, 1.884], [11, 7.195, 0.363, 1.23], [12, 0, -0.059, -0.102]];
  var NAMES = {
    airlock: T('the airlock end', 'এয়ারলকের দিকে'), dock: T('the dock end', 'ডকের দিকে'),
    eps2: T('the EPS2 wall', 'EPS2 দেয়ালের দিকে'), saibo: T('the SAIBO wall', 'SAIBO দেয়ালের দিকে')
  };
  function whichWay(vx, vy) {
    var nx = vx >= 0 ? NAMES.airlock : NAMES.dock, ny = vy >= 0 ? NAMES.eps2 : NAMES.saibo;
    if (Math.abs(vx) > 0.97) return nx; if (Math.abs(vy) > 0.97) return ny;
    return T('between ' + nx + ' and ' + ny, nx + ' আর ' + ny + ' মাঝামাঝি');
  }

  // A picture of Kibo from above (kind 'top': x across, y down) or from the side ('side': x across, z down), `sc` pixels to the metre.
  function kiboView(kind, sc, ml, mt, mb, x0, x1) {
    var v = kind === 'top' ? 'y' : 'z', R = BOX[v], H = (R[1] - R[0]) * sc, W = ml * 2 + (x1 - x0) * sc;
    var svg = el('svg', { class: 'wide', viewBox: '0 0 ' + W + ' ' + (mt + H + mb), role: 'img', 'aria-label': kind === 'top' ? T('Kibo seen from above', 'ওপর থেকে দেখা Kibo') : T('Kibo seen from the side', 'পাশ থেকে দেখা Kibo') });
    var X = function (x) { return ml + (x - x0) * sc; }, Y = function (a) { return mt + (a - R[0]) * sc; };
    svg.appendChild(el('rect', { class: 'box', x: X(Math.max(x0, BOX.x[0])), y: Y(R[0]), width: (Math.min(x1, BOX.x[1]) - Math.max(x0, BOX.x[0])) * sc, height: H, rx: 6 }));
    for (var t = Math.ceil(x0); t <= x1 + 1e-9; t++) {
      svg.appendChild(el('line', { class: 'gl', x1: X(t), x2: X(t), y1: Y(R[0]), y2: Y(R[1]) }));
      svg.appendChild(el('text', { class: 'm', x: X(t), y: mt + H + 20, 'text-anchor': 'middle', text: String(t) }));
    }
    svg.appendChild(el('line', { class: 'gl dash', x1: X(Math.max(x0, 0)), x2: X(Math.min(x1, BOX.x[1])), y1: Y(0), y2: Y(0), style: 'stroke:var(--muted)' }));
    return { svg: svg, X: X, Y: Y, W: W, H: H, v: v, R: R };
  }
  function marks(view, kind, ids, ax) {
    MARKS.forEach(function (m) {
      var a = kind === 'top' ? m[2] : m[3], x = m[1];
      if (ids && ids.indexOf(m[0]) < 0) return;
      var s = 11, g = el('rect', { class: 'mk', x: view.X(x) - s / 2, y: view.Y(a) - s / 2, width: s, height: s, rx: 1.5, 'data-id': m[0] }); view.svg.appendChild(g);
    });
  }

  // ================= where is the robot: drag it, read x, y, z =================
  function kibo(host) {
    var S = 84, p = { x: 0.2, y: 0, z: 0 };
    var body = card(host, T('Where is the robot? Drag it, then read x, y and z', 'রোবট কোথায়? টেনে সরাও, তারপর x, y, z পড়ো'),
      T('Drag the round robot in either picture (or select it and use the arrow keys). The two pictures are the same room seen from two sides.', 'যেকোনো ছবিতে গোল রোবটটাকে টানো (অথবা বেছে নিয়ে অ্যারো কি চাপো)। দুটো ছবিই একই ঘর, দুই দিক থেকে দেখা।'));
    var top = kiboView('top', S, 38, 38, 30, 0, BOX.x[1]), side = kiboView('side', S, 38, 38, 30, 0, BOX.x[1]);
    function labels(v, kind) {
      var s = v.svg, L = v.X(0), Rr = v.X(BOX.x[1]);
      s.appendChild(el('text', { x: L, y: 24, text: T('Dock end', 'ডকের দিক') + ' (x = 0)', 'text-anchor': 'start' }));
      s.appendChild(el('text', { x: Rr, y: 24, text: T('Airlock end', 'এয়ারলকের দিক'), 'text-anchor': 'end' }));
      s.appendChild(el('text', { class: 'm', x: Rr + 6, y: 38 + v.H + 20, text: 'x', 'text-anchor': 'start', style: 'fill:var(--ax)' }));
      var a = kind === 'top' ? [T('SAIBO wall (−y)', 'SAIBO দেয়াল (−y)'), T('EPS2 wall (+y)', 'EPS2 দেয়াল (+y)')] : [T('Overhead (−z)', 'ছাদ (−z)'), T('Deck, the floor (+z)', 'মেঝে (+z)')];
      s.appendChild(el('text', { class: 'm', x: v.X(BOX.x[1] / 2), y: 24, 'text-anchor': 'middle', text: a[0] }));
      s.appendChild(el('text', { class: 'm', x: v.X(BOX.x[1] / 2), y: v.Y(v.R[1]) - 9, 'text-anchor': 'middle', text: a[1] }));
      s.appendChild(el('text', { class: 'm', x: 6, y: v.Y(0) + 5, text: '0' }));
    }
    labels(top, 'top'); labels(side, 'side');
    marks(top, 'top'); marks(side, 'side');
    var cap = function (svg, txt, dy) { return el('p', { class: 'vhint', style: 'margin:10px 0 2px', text: txt }); };
    // the lines from the origin to the robot, one colour for each axis
    function parts(v, kind) {
      var o = { lx: el('line', { class: 'lx dash' }), lv: el('line', { class: kind === 'top' ? 'ly dash' : 'lz dash' }), dot: handle(11, T('The robot: drag me', 'রোবট: আমাকে টানো')) };
      v.svg.appendChild(o.lx); v.svg.appendChild(o.lv); v.svg.appendChild(o.dot);
      v.svg.appendChild(el('circle', { cx: v.X(0), cy: v.Y(0), r: 4, style: 'fill:none;stroke:var(--fg);stroke-width:2' }));
      return o;
    }
    var pt = parts(top, 'top'), ps = parts(side, 'side');
    body.appendChild(cap(null, T('From above', 'ওপর থেকে')));
    body.appendChild(top.svg);
    body.appendChild(cap(null, T('From the side (+z points down to the deck)', 'পাশ থেকে (+z নিচের দিকে, মেঝের দিকে)')));
    body.appendChild(side.svg);
    var cx = chip('x', 'x'), cy = chip('y', 'y'), cz = chip('z', 'z'), note = el('p', { class: 'vnote', 'aria-live': 'polite' });
    [cx, cy, cz].forEach(function (c) { c.val.parentNode.appendChild(el('small', { text: T('m', 'মি') })); });
    body.appendChild(el('div', { class: 'vread' }, [cx.box, cy.box, cz.box]));
    body.appendChild(note);
    var presets = el('div', { class: 'vctl' }, [
      button(T('Dock', 'ডক'), function () { set(0.2, 0, 0); }),
      button(T('Next to AR marker 4', 'AR মার্কার ৪-এর পাশে'), function () { set(4.181, -0.8, 0.523); }),
      button(T('Near the ceiling', 'ছাদের কাছে'), function () { set(3.6, 0, -0.2); }),
      button(T('Near the deck', 'মেঝের কাছে'), function () { set(3.6, 0.5, 1.8); })
    ]);
    body.appendChild(presets);
    function set(x, y, z) { p.x = clamp(x, BOX.x[0], BOX.x[1]); p.y = clamp(y, BOX.y[0], BOX.y[1]); p.z = clamp(z, BOX.z[0], BOX.z[1]); draw(); }
    function draw() {
      pt.dot.setAttribute('transform', 'translate(' + top.X(p.x) + ',' + top.Y(p.y) + ')');
      ps.dot.setAttribute('transform', 'translate(' + side.X(p.x) + ',' + side.Y(p.z) + ')');
      var seg = function (l, a, b, c, d) { l.setAttribute('x1', a); l.setAttribute('y1', b); l.setAttribute('x2', c); l.setAttribute('y2', d); };
      seg(pt.lx, top.X(0), top.Y(p.y), top.X(p.x), top.Y(p.y)); seg(pt.lv, top.X(p.x), top.Y(0), top.X(p.x), top.Y(p.y));
      seg(ps.lx, side.X(0), side.Y(p.z), side.X(p.x), side.Y(p.z)); seg(ps.lv, side.X(p.x), side.Y(0), side.X(p.x), side.Y(p.z));
      cx.val.textContent = f(p.x, 2); cy.val.textContent = f(p.y, 2); cz.val.textContent = f(p.z, 2);
      var sx = f(p.x, 2) + T(' m toward the airlock', ' মিটার এয়ারলকের দিকে');
      var sy = p.y < 0 ? T(f(-p.y, 2) + ' m toward the SAIBO wall (y is minus)', f(-p.y, 2) + ' মিটার SAIBO দেয়ালের দিকে (y মাইনাস)') : T(f(p.y, 2) + ' m toward the EPS2 wall', f(p.y, 2) + ' মিটার EPS2 দেয়ালের দিকে');
      var sz = p.z < 0 ? T(f(-p.z, 2) + ' m toward the overhead (z is minus: up!)', f(-p.z, 2) + ' মিটার ছাদের দিকে (z মাইনাস: ওপরে!)') : T(f(p.z, 2) + ' m toward the deck (z is plus: down)', f(p.z, 2) + ' মিটার মেঝের দিকে (z প্লাস: নিচে)');
      note.textContent = T('From the origin: ', 'শুরুর বিন্দু থেকে: ') + sx + ', ' + sy + ', ' + sz + '.';
      pt.dot.setAttribute('aria-valuetext', 'x ' + f(p.x, 2) + ', y ' + f(p.y, 2)); ps.dot.setAttribute('aria-valuetext', 'x ' + f(p.x, 2) + ', z ' + f(p.z, 2));
    }
    drag(top.svg, pt.dot, function (px, py) { set((px - 38) / S, (py - 38) / S + BOX.y[0], p.z); });
    drag(side.svg, ps.dot, function (px, py) { set((px - 38) / S, p.y, (py - 38) / S + BOX.z[0]); });
    arrows(pt.dot, function (dx, dy) { set(p.x + dx * 0.05, p.y + dy * 0.05, p.z); });
    arrows(ps.dot, function (dx, dy) { set(p.x + dx * 0.05, p.y, p.z + dy * 0.05); });
    set(0.2, 0, 0);
    host.__viz = { state: p, set: set, read: function () { return { x: cx.val.textContent, y: cy.val.textContent, z: cz.val.textContent, note: note.textContent }; } };
  }

  // ================= angles: a dial, degrees, radians and turns =================
  function dial(host) {
    var a = 90, cxp = 150, cyp = 128, r = 96;
    var body = card(host, T('Turn the dial: degrees, radians and turns', 'ডায়াল ঘোরাও: ডিগ্রি, রেডিয়ান আর পাক'),
      T('Drag the round handle around the circle, as many times as you like. Positive is anticlockwise (the way the sandbox turns).', 'গোল হাতলটাকে বৃত্তের চারপাশে টানো, যতবার খুশি। ঘড়ির কাঁটার উল্টো দিক হলো প্লাস (স্যান্ডবক্স যেদিকে ঘোরে)।'));
    var svg = el('svg', { viewBox: '0 0 300 262', role: 'img', 'aria-label': T('A dial: the handle sets an angle', 'একটা ডায়াল: হাতলটা একটা কোণ ঠিক করে') });
    var P = function (deg, rr) { return [cxp + rr * Math.cos(deg * D), cyp - rr * Math.sin(deg * D)]; };
    var sector = el('path', { style: 'fill:var(--accent);opacity:.25' }), full = el('circle', { cx: cxp, cy: cyp, r: r, style: 'fill:var(--accent);opacity:.25', visibility: 'hidden' });
    svg.appendChild(full); svg.appendChild(sector);
    svg.appendChild(el('circle', { cx: cxp, cy: cyp, r: r, style: 'fill:none;stroke:var(--border);stroke-width:2' }));
    for (var d = 0; d < 360; d += 15) {
      var big = d % 90 === 0, p1 = P(d, r), p2 = P(d, r - (big ? 14 : d % 45 === 0 ? 9 : 5));
      svg.appendChild(el('line', { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], style: 'stroke:' + (big ? 'var(--fg)' : 'var(--muted)') + ';stroke-width:' + (big ? 2.2 : 1.2) }));
    }
    [[0, '0°', 'start'], [90, '90°', 'middle'], [180, '180°', 'end'], [270, '270°', 'middle']].forEach(function (l) {
      var q = P(l[0], r + 15); svg.appendChild(el('text', { class: 'm', x: q[0] + (l[0] === 0 ? 2 : l[0] === 180 ? -2 : 0), y: q[1] + (l[0] === 90 ? -2 : l[0] === 270 ? 12 : 5), 'text-anchor': l[2], text: l[1] }));
    });
    svg.appendChild(el('line', { x1: cxp, y1: cyp, x2: cxp + r, y2: cyp, style: 'stroke:var(--muted);stroke-width:2;stroke-dasharray:5 4' }));
    var hand = el('line', { class: 'lt', x1: cxp, y1: cyp }), arc = el('path', { class: 'lt', style: 'stroke-width:3' }), lab = el('text', { 'text-anchor': 'middle', style: 'fill:var(--turn);--fs:17px' });
    var band = el('circle', { cx: cxp, cy: cyp, r: r, style: 'fill:none;stroke:transparent;stroke-width:44' }), hd = handle(11, T('The angle: drag me', 'কোণ: আমাকে টানো'));
    svg.appendChild(hand); svg.appendChild(arc); svg.appendChild(lab); svg.appendChild(band); svg.appendChild(hd); svg.appendChild(el('circle', { cx: cxp, cy: cyp, r: 4, style: 'fill:var(--fg)' }));
    body.appendChild(svg);
    var cd = chip(T('degrees', 'ডিগ্রি')), cr = chip(T('radians', 'রেডিয়ান')), ct = chip(T('turns', 'পাক'));
    var note = el('p', { class: 'vnote', 'aria-live': 'polite' }), rng = slider(T('Angle', 'কোণ'), -720, 720, 1, a, function (v) { set(v); });
    body.appendChild(el('div', { class: 'vread' }, [cd.box, cr.box, ct.box])); body.appendChild(note);
    var presets = el('div', { class: 'vctl' }, [rng.box, button('45°', function () { set(45); }), button('90°', function () { set(90); }), button('180°', function () { set(180); }), button('270°', function () { set(270); }), button('360°', function () { set(360); }), button('−90°', function () { set(-90); })]);
    body.appendChild(presets);
    function piOf(deg) { // 90 → "π/2"
      if (deg % 15) return ''; var n = deg / 15, g = gcd(n, 12), num = n / g, den = 12 / g, sg = num < 0 ? '−' : '';
      num = Math.abs(num); return num === 0 ? '0' : sg + (num === 1 ? '' : num) + 'π' + (den === 1 ? '' : '/' + den);
    }
    function set(v) {
      a = clamp(Math.round(v), -720, 720);
      var m = a % 360, q = P(m, r);
      hand.setAttribute('x2', q[0]); hand.setAttribute('y2', q[1]);
      var e = P(m, r), big = Math.abs(m) > 180 ? 1 : 0, sw = m >= 0 ? 0 : 1;
      sector.setAttribute('d', m === 0 ? '' : 'M' + cxp + ' ' + cyp + ' L' + (cxp + r) + ' ' + cyp + ' A' + r + ' ' + r + ' 0 ' + big + ' ' + sw + ' ' + e[0] + ' ' + e[1] + ' Z');
      full.setAttribute('visibility', m === 0 && Math.abs(a) >= 360 ? 'visible' : 'hidden');
      var ar = 34, s = P(0, ar), t = P(m, ar);
      arc.setAttribute('d', m === 0 ? '' : 'M' + s[0] + ' ' + s[1] + ' A' + ar + ' ' + ar + ' 0 ' + big + ' ' + sw + ' ' + t[0] + ' ' + t[1]);
      var lp = P(m / 2, 58); lab.setAttribute('x', lp[0]); lab.setAttribute('y', lp[1] + 6); lab.textContent = m === 0 ? '' : f(m, 0) + '°';
      hd.setAttribute('transform', 'translate(' + q[0] + ',' + q[1] + ')'); hd.setAttribute('aria-valuetext', f(a, 0) + '°');
      rng.input.value = a;
      var rad = a * D, pi = piOf(a);
      cd.val.textContent = f(a, 0) + '°'; cr.val.textContent = f(rad, 3) + (pi ? '  = ' + pi : ''); ct.val.textContent = f(a / 360, 3).replace(/\.?0+$/, '') || '0';
      var s180 = wrap180(a), turns = Math.abs(a) / 360, name;
      if (a === 0) name = T('No turn at all.', 'একদমই ঘোরা নেই।');
      else if (Math.abs(a) % 360 === 0) name = T(Math.abs(a) / 360 + ' whole turn' + (Math.abs(a) > 360 ? 's' : '') + ': the robot faces the same way as before.', Math.abs(a) / 360 + ' পুরো পাক: রোবট আগের মতোই একই দিকে মুখ করে আছে।');
      else if (Math.abs(a) === 90) name = T('A quarter turn.', 'সিকি পাক।');
      else if (Math.abs(a) === 180) name = T('Half a turn: the robot faces backwards.', 'আধা পাক: রোবট উল্টো দিকে মুখ করে আছে।');
      else if (Math.abs(a) === 45) name = T('An eighth of a turn.', 'এক-অষ্টমাংশ পাক।');
      else name = T('That is ' + f(turns * 100, 1).replace(/\.0$/, '') + '% of a whole turn.', 'এটা পুরো পাকের ' + f(turns * 100, 1).replace(/\.0$/, '') + '%।');
      if (s180 !== a && Math.abs(a) % 360 !== 0) name += ' ' + T('It ends up facing the same way as ' + f(s180, 0) + '°.', 'শেষে রোবট ' + f(s180, 0) + '°-এর মতোই একই দিকে মুখ করে থাকে।');
      if (a < 0) name += ' ' + T('A minus sign turns the other way (clockwise).', 'মাইনাস মানে উল্টো দিকে ঘোরা (ঘড়ির কাঁটার দিকে)।');
      note.textContent = name;
    }
    drag(svg, band, function (px, py) {
      var raw = Math.atan2(cyp - py, px - cxp) / D; raw = (raw + 360) % 360;
      var best = null; for (var k = 2; k >= -2; k--) { var c = raw + 360 * k; if (c < -720 || c > 720) continue; if (best === null || Math.abs(c - a) < Math.abs(best - a)) best = c; }
      var sn = Math.round(best / 15) * 15; set(Math.abs(best - sn) <= 3 ? sn : best);
    });
    drag(svg, hd, function (px, py) {
      var raw = Math.atan2(cyp - py, px - cxp) / D; raw = (raw + 360) % 360;
      var best = null; for (var k = 2; k >= -2; k--) { var c = raw + 360 * k; if (c < -720 || c > 720) continue; if (best === null || Math.abs(c - a) < Math.abs(best - a)) best = c; }
      var sn = Math.round(best / 15) * 15; set(Math.abs(best - sn) <= 3 ? sn : best);
    });
    arrows(hd, function (dx, dy) { set(a + (dx - dy) * (Math.abs(dx) > 1 || Math.abs(dy) > 1 ? 3 : 1)); }); // 1° a press, 15° with Shift
    set(90);
    host.__viz = { set: set, read: function () { return { deg: cd.val.textContent, rad: cr.val.textContent, turns: ct.val.textContent, note: note.textContent }; } };
  }

  // ================= the robot's own front: which way is "forward"? =================
  function facing(host) {
    var S = 84, ML = 38, MT = 40, MB = 30, st = { x: 3.6, y: 0, yaw: 0 }, trail = [[3.6, 0]], last = '', busy = null;
    var body = card(host, T('Whose "forward"? Turn the robot, then send it 1 m', '"সামনে" মানে কার? রোবট ঘুরিয়ে ১ মিটার পাঠাও'),
      T('Drag the red handle to turn the robot (or use the slider). Then press a move button: the robot moves in its OWN directions, and the numbers show where that is in Kibo.', 'লাল হাতলটা টেনে রোবট ঘোরাও (বা স্লাইডার ব্যবহার করো)। তারপর একটা বোতাম চাপো: রোবট চলে তার নিজের দিকে, আর সংখ্যায় দেখা যায় Kibo-তে সেটা কোন দিক।'));
    var v = kiboView('top', S, ML, MT, MB, 0, BOX.x[1]), svg = v.svg;
    svg.appendChild(el('text', { x: v.X(0), y: 26, text: T('Dock end', 'ডকের দিক') }));
    svg.appendChild(el('text', { x: v.X(BOX.x[1]), y: 26, 'text-anchor': 'end', text: T('Airlock end', 'এয়ারলকের দিক') }));
    svg.appendChild(el('text', { class: 'm', x: v.X(BOX.x[1] / 2), y: 26, 'text-anchor': 'middle', text: T('SAIBO wall (−y)', 'SAIBO দেয়াল (−y)') }));
    svg.appendChild(el('text', { class: 'm', x: v.X(BOX.x[1] / 2), y: v.Y(BOX.y[1]) - 9, 'text-anchor': 'middle', text: T('EPS2 wall (+y)', 'EPS2 দেয়াল (+y)') }));
    // Kibo's own axes, in a corner
    var ox = v.X(0.35), oy = v.Y(BOX.y[0]) + 46;
    svg.appendChild(el('line', { class: 'lx', x1: ox, y1: oy, x2: ox + 50, y2: oy })); svg.appendChild(tri(ox + 52, oy, 0, 10, 'fx')); svg.appendChild(el('text', { x: ox + 62, y: oy + 5, text: '+x', style: 'fill:var(--ax)' }));
    svg.appendChild(el('line', { class: 'ly', x1: ox, y1: oy, x2: ox, y2: oy + 38 })); svg.appendChild(tri(ox, oy + 40, Math.PI / 2, 10, 'fy')); svg.appendChild(el('text', { x: ox + 8, y: oy + 52, text: '+y', style: 'fill:var(--ay)' }));
    var trailL = el('polyline', { points: '', style: 'fill:none;stroke:var(--muted);stroke-width:2;stroke-dasharray:3 5' });
    svg.appendChild(trailL);
    // the robot: drawn bigger than it is (20 cm would be 17 px), turning as one
    var rg = el('g'), spin = el('g');
    spin.appendChild(el('circle', { class: 'rb', r: 17 }));
    spin.appendChild(el('line', { class: 'lx', x1: 0, y1: 0, x2: 50, y2: 0, style: 'stroke-width:3.4' })); spin.appendChild(tri(52, 0, 0, 12, 'fx')); spin.appendChild(el('text', { x: 36, y: -9, text: 'X', style: 'fill:var(--ax)' }));
    spin.appendChild(el('line', { class: 'ly', x1: 0, y1: 0, x2: 0, y2: 38, style: 'stroke-width:3.4' })); spin.appendChild(tri(0, 40, Math.PI / 2, 12, 'fy')); spin.appendChild(el('text', { x: 9, y: 48, text: 'Y', style: 'fill:var(--ay)' }));
    spin.appendChild(el('circle', { r: 6, style: 'fill:none;stroke:var(--az);stroke-width:2.4' })); spin.appendChild(el('path', { d: 'M-3.6 -3.6 L3.6 3.6 M3.6 -3.6 L-3.6 3.6', style: 'stroke:var(--az);stroke-width:2.2' }));
    var hd = handle(8, T('The robot\'s heading: drag me', 'রোবটের মুখের দিক: আমাকে টানো')); hd.setAttribute('transform', 'translate(66,0)'); hd.firstChild.nextSibling.setAttribute('style', 'fill:var(--ax)');
    spin.appendChild(hd); rg.appendChild(spin); svg.appendChild(rg);
    body.appendChild(svg);
    body.appendChild(el('p', { class: 'vhint', style: 'margin:2px 0 0', html: T('<span class="x">X</span> front (where the camera looks) · <span class="y">Y</span> left · <span class="z">Z</span> top: it points away from you, down to the deck, so this robot is "upside down" as you look from above. (The robot is drawn bigger than it is.)', '<span class="x">X</span> সামনে (যেদিকে ক্যামেরা তাকায়) · <span class="y">Y</span> বাঁ · <span class="z">Z</span> ওপর: ওপর থেকে তাকালে এটা তোমার থেকে দূরে, মেঝের দিকে, তাই রোবটটা “উল্টো” দেখায়। (রোবটটা আসলের চেয়ে বড় করে আঁকা।)') }));
    var cy = chip(T('yaw', 'ইয়')), cf = chip(T('front X points', 'সামনে X')), cl = chip(T('left Y points', 'বাঁ Y')), note = el('p', { class: 'vnote', 'aria-live': 'polite' });
    body.appendChild(el('div', { class: 'vread' }, [cy.box, cf.box, cl.box])); body.appendChild(note);
    var sl = slider(T('Yaw', 'ইয়'), -180, 180, 1, 0, function (a) { setYaw(a); });
    var go = function (kind) { move(kind); };
    body.appendChild(el('div', { class: 'vctl' }, [sl.box, button(T('Go 1 m forward (X)', '১ মিটার সামনে (X)'), function () { go('f'); }), button(T('Go 1 m left (Y)', '১ মিটার বাঁয়ে (Y)'), function () { go('l'); }),
      button(T('Face the EPS2 wall', 'EPS2 দেয়ালের দিকে ঘোরো'), function () { setYaw(90); }), button(T('Start over', 'আবার শুরু'), function () { st.x = 3.6; st.y = 0; trail = [[3.6, 0]]; last = ''; setYaw(0); })]));
    function dirs() { var c = Math.cos(st.yaw * D), s = Math.sin(st.yaw * D); return { f: [c, s], l: [-s, c] }; }
    function draw() {
      rg.setAttribute('transform', 'translate(' + v.X(st.x) + ',' + v.Y(st.y) + ')'); spin.setAttribute('transform', 'rotate(' + st.yaw + ')');
      trailL.setAttribute('points', trail.map(function (q) { return v.X(q[0]) + ',' + v.Y(q[1]); }).join(' '));
      var d = dirs();
      cy.val.textContent = f(st.yaw, 0) + '°'; cf.val.textContent = '(' + f(d.f[0], 2) + ', ' + f(d.f[1], 2) + ', 0)'; cl.val.textContent = '(' + f(d.l[0], 2) + ', ' + f(d.l[1], 2) + ', 0)';
      note.textContent = T('In Kibo, the robot\'s front points toward ' + whichWay(d.f[0], d.f[1]) + '. ', 'Kibo-তে রোবটের সামনেটা ' + whichWay(d.f[0], d.f[1]) + ' তাকিয়ে আছে। ') + last;
      sl.input.value = st.yaw; hd.setAttribute('aria-valuetext', f(st.yaw, 0) + '°');
    }
    function setYaw(a) { st.yaw = wrap180(Math.round(a)); draw(); }
    function move(kind) {
      var d = dirs()[kind], nx = clamp(st.x + d[0], 0.15, BOX.x[1] - 0.15), ny = clamp(st.y + d[1], BOX.y[0] + 0.15, BOX.y[1] - 0.15);
      var dx = nx - st.x, dy = ny - st.y, hit = Math.abs(dx - d[0]) > 1e-6 || Math.abs(dy - d[1]) > 1e-6;
      last = T('Command: 1 m ' + (kind === 'f' ? 'forward' : 'left') + ' in the robot\'s frame → in Kibo the robot moved (' + f(dx, 2) + ', ' + f(dy, 2) + ', 0)' + (hit ? ' (it stopped at the wall)' : '') + '.',
        'কমান্ড: রোবটের নিজের হিসাবে ১ মিটার ' + (kind === 'f' ? 'সামনে' : 'বাঁয়ে') + ' → Kibo-তে রোবট সরেছে (' + f(dx, 2) + ', ' + f(dy, 2) + ', 0)' + (hit ? ' (দেয়ালে আটকে গেছে)' : '') + '।');
      var x0 = st.x, y0 = st.y, t0 = performance.now(), dur = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 450;
      st.x = nx; st.y = ny; trail.push([nx, ny]); if (trail.length > 8) trail.shift();
      if (busy) cancelAnimationFrame(busy);
      (function step(now) {
        var k = clamp((now - t0) / dur, 0, 1), e = k * k * (3 - 2 * k);
        rg.setAttribute('transform', 'translate(' + v.X(x0 + (nx - x0) * e) + ',' + v.Y(y0 + (ny - y0) * e) + ')');
        if (k < 1) busy = requestAnimationFrame(step); else { busy = null; draw(); }
      })(t0);
      draw();
    }
    drag(svg, hd, function (px, py) { setYaw(Math.atan2(py - v.Y(st.y), px - v.X(st.x)) / D); });
    arrows(hd, function (dx, dy) { setYaw(st.yaw + (dx + dy) * 5); });
    draw();
    host.__viz = { state: st, setYaw: setYaw, move: move, read: function () { return { yaw: cy.val.textContent, front: cf.val.textContent, left: cl.val.textContent, note: note.textContent }; } };
  }

  // ---------- rotation matrices (ROS: roll about x, then pitch about y, then yaw about z, all about the fixed axes) ----------
  function mul(a, b) { var r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) for (var k = 0; k < 3; k++) r[i][j] += a[i][k] * b[k][j]; return r; }
  function Rx(a) { var c = Math.cos(a * D), s = Math.sin(a * D); return [[1, 0, 0], [0, c, -s], [0, s, c]]; }
  function Ry(a) { var c = Math.cos(a * D), s = Math.sin(a * D); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; }
  function Rz(a) { var c = Math.cos(a * D), s = Math.sin(a * D); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; }
  function euler(roll, pitch, yaw) { return mul(Rz(yaw), mul(Ry(pitch), Rx(roll))); }

  // A robot's three axes (X front, Y left, Z top) seen from the side, a little from the front (oblique), for a rotation matrix R.
  function triad(R, label) {
    var svg = el('svg', { viewBox: '0 0 230 200', role: 'img', 'aria-label': label });
    var cx = 102, cy = 96, L = 74;
    var P = function (v) { return [cx + L * (v[0] + 0.42 * v[1]), cy + L * (v[2] + 0.3 * v[1])]; };
    svg.appendChild(el('circle', { cx: cx, cy: cy, r: 17, class: 'rb' }));
    [['X', 'lx', 'fx', 0, 'var(--ax)'], ['Y', 'ly', 'fy', 1, 'var(--ay)'], ['Z', 'lz', 'fz', 2, 'var(--az)']].forEach(function (a) {
      var v = [R[0][a[3]], R[1][a[3]], R[2][a[3]]], q = P(v), dx = q[0] - cx, dy = q[1] - cy, ang = Math.atan2(dy, dx);
      svg.appendChild(el('line', { class: a[1], x1: cx, y1: cy, x2: q[0] - Math.cos(ang) * 6, y2: q[1] - Math.sin(ang) * 6, style: 'stroke-width:3.4' }));
      svg.appendChild(tri(q[0], q[1], ang, 12, a[2]));
      svg.appendChild(el('text', { x: q[0] + Math.cos(ang) * 14 - 5, y: q[1] + Math.sin(ang) * 14 + 5, text: a[0], style: 'fill:' + a[4] + ';--fs:17px' }));
    });
    return svg;
  }

  // ================= gimbal lock: two different turns that stop being different =================
  function gimbal(host) {
    var pitch = 0, amt = 40;
    var body = card(host, T('Gimbal lock: when two different turns become the same', 'গিম্বল লক: যখন দুটো আলাদা ঘোরা একই হয়ে যায়'),
      T('Both robots turn by the same amount, but in a different way. Slide the pitch to 90° and watch.', 'দুটো রোবটই একই পরিমাণ ঘোরে, কিন্তু আলাদা ভাবে। পিচটা ৯০°-তে নিয়ে যাও আর দেখো।'));
    var pair = el('div', { class: 'vpair' }), fa = el('figure'), fb = el('figure'), ca = el('figcaption'), cb = el('figcaption'), note = el('p', { class: 'vnote', 'aria-live': 'polite' });
    pair.appendChild(fa); pair.appendChild(fb); body.appendChild(pair); body.appendChild(note);
    var sp = slider(T('Pitch', 'পিচ'), -90, 90, 1, 0, function (v) { pitch = v; draw(); }, 'y'), sa = slider(T('Amount', 'পরিমাণ'), 10, 90, 1, amt, function (v) { amt = v; draw(); });
    body.appendChild(el('div', { class: 'vctl' }, [sp.box, sa.box, button(T('Pitch 90°', 'পিচ ৯০°'), function () { pitch = 90; sp.input.value = 90; draw(); }), button(T('Pitch 0°', 'পিচ ০°'), function () { pitch = 0; sp.input.value = 0; draw(); })]));
    var same = false;
    function draw() {
      var sg = pitch < 0 ? -1 : 1, A = euler(amt, pitch, 0), B = euler(0, pitch, -amt * sg), diff = 0;
      for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) diff = Math.max(diff, Math.abs(A[i][j] - B[i][j]));
      same = diff < 0.02;
      fa.textContent = ''; fb.textContent = '';
      fa.appendChild(triad(A, T('Robot A', 'রোবট A'))); fb.appendChild(triad(B, T('Robot B', 'রোবট B')));
      fa.appendChild(ca); fb.appendChild(cb);
      ca.innerHTML = T('<b>A</b>: roll <span class="x">' + amt + '°</span>, pitch ' + pitch + '°, yaw 0°', '<b>A</b>: রোল <span class="x">' + amt + '°</span>, পিচ ' + pitch + '°, ইয় 0°');
      cb.innerHTML = T('<b>B</b>: roll 0°, pitch ' + pitch + '°, yaw <span class="z">' + (sg > 0 ? '−' : '+') + amt + '°</span>', '<b>B</b>: রোল 0°, পিচ ' + pitch + '°, ইয় <span class="z">' + (sg > 0 ? '−' : '+') + amt + '°</span>');
      note.style.borderLeftColor = same ? 'var(--warn)' : 'var(--ok)';
      note.textContent = same
        ? T('Same pose! At pitch ' + pitch + '° the roll axis lines up with the yaw axis, so roll and yaw now turn the robot the same way. One of the three turns is gone. This is gimbal lock.', 'একই পোজ! পিচ ' + pitch + '°-তে রোলের অক্ষ আর ইয়ের অক্ষ এক লাইনে চলে আসে, তাই রোল আর ইয় এখন রোবটকে একই ভাবে ঘোরায়। তিনটা ঘোরার একটা হারিয়ে গেছে। একেই বলে গিম্বল লক।')
        : T('Different poses: roll and yaw do different things here. Now push the pitch toward 90°.', 'আলাদা পোজ: এখানে রোল আর ইয় আলাদা কাজ করে। এবার পিচটা ৯০°-র দিকে নাও।');
    }
    draw();
    host.__viz = { set: function (p, a) { pitch = p; amt = a; sp.input.value = p; sa.input.value = a; draw(); }, same: function () { return same; }, note: function () { return note.textContent; } };
  }

  // ================= a quaternion from an axis and an angle: why the half angle? =================
  function halfangle(host) {
    var axes = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1], d: [Math.SQRT1_2, Math.SQRT1_2, 0] }, ax = 'z', th = 90;
    var body = card(host, T('Axis and angle in, four numbers out', 'অক্ষ আর কোণ দিলে চারটা সংখ্যা পাওয়া যায়'),
      T('Pick the axis the robot turns about, then slide the angle. Watch where the half angle (θ/2) appears.', 'রোবট কোন অক্ষ বরাবর ঘুরবে তা বেছে নাও, তারপর কোণটা স্লাইড করো। দেখো অর্ধেক কোণ (θ/2) কোথায় আসে।'));
    var pair = el('div', { class: 'vpair' }), fa = el('figure'), fb = el('figure');
    var A = el('svg', { viewBox: '0 0 240 232', role: 'img', 'aria-label': T('The turn, seen from the tip of the axis', 'ঘোরাটা, অক্ষের ডগা থেকে দেখা') }), B = el('svg', { viewBox: '0 0 240 232', role: 'img', 'aria-label': T('The half angle on a circle of length 1', '১ দৈর্ঘ্যের বৃত্তে অর্ধেক কোণ') });
    fa.appendChild(A); fa.appendChild(el('figcaption', { text: T('The turn θ (seen from the tip of the axis)', 'ঘোরা θ (অক্ষের ডগা থেকে দেখা)') }));
    fb.appendChild(B); fb.appendChild(el('figcaption', { text: T('The same turn as a point on a circle of length 1: it goes only half as far', 'একই ঘোরা, ১ দৈর্ঘ্যের বৃত্তে একটা বিন্দু: সে যায় অর্ধেক পথ') }));
    pair.appendChild(fa); pair.appendChild(fb); body.appendChild(pair);
    var nums = el('div', { class: 'vread' }), cs = [chip('x', 'x'), chip('y', 'y'), chip('z', 'z'), chip('w', 't'), chip(T('length', 'দৈর্ঘ্য'))];
    cs.forEach(function (c) { nums.appendChild(c.box); });
    var note = el('p', { class: 'vnote', 'aria-live': 'polite' }), formula = el('p', { class: 'vhint', style: 'margin:8px 0 0' });
    body.appendChild(nums); body.appendChild(formula); body.appendChild(note);
    var btns = {}, bar = el('div', { class: 'vctl' });
    [['x', 'X'], ['y', 'Y'], ['z', 'Z'], ['d', '(1, 1, 0)']].forEach(function (a) { btns[a[0]] = button(T('Axis ', 'অক্ষ ') + a[1], function () { ax = a[0]; draw(); }); bar.appendChild(btns[a[0]]); });
    var sl = slider('θ', 0, 360, 1, th, function (v) { th = v; draw(); }, 't'); bar.appendChild(sl.box);
    [90, 180, 360].forEach(function (a) { bar.appendChild(button(a + '°', function () { th = a; sl.input.value = a; draw(); })); });
    body.appendChild(bar);
    function draw() {
      var v = axes[ax], h = th / 2, s = Math.sin(h * D), w = Math.cos(h * D), q = [v[0] * s, v[1] * s, v[2] * s, w];
      Object.keys(btns).forEach(function (k) { btns[k].classList.toggle('on', k === ax); });
      // A: the turn
      A.textContent = '';
      var cx = 120, cy = 104, r = 76, P = function (deg, rr) { return [cx + rr * Math.cos(deg * D), cy - rr * Math.sin(deg * D)]; }, e = P(th, r);
      A.appendChild(el('circle', { cx: cx, cy: cy, r: r, style: 'fill:none;stroke:var(--border);stroke-width:2' }));
      if (th >= 359.5) A.appendChild(el('circle', { cx: cx, cy: cy, r: r, style: 'fill:var(--accent);opacity:.22' }));
      else if (th > 0) A.appendChild(el('path', { d: 'M' + cx + ' ' + cy + ' L' + (cx + r) + ' ' + cy + ' A' + r + ' ' + r + ' 0 ' + (th > 180 ? 1 : 0) + ' 0 ' + e[0] + ' ' + e[1] + ' Z', style: 'fill:var(--accent);opacity:.25' }));
      A.appendChild(el('line', { x1: cx, y1: cy, x2: cx + r, y2: cy, style: 'stroke:var(--muted);stroke-width:2.6;stroke-dasharray:5 4' }));
      A.appendChild(el('line', { class: 'la', x1: cx, y1: cy, x2: e[0], y2: e[1], style: 'stroke-width:3.4' }));
      A.appendChild(el('circle', { cx: cx, cy: cy, r: 5, style: 'fill:var(--fg)' }));
      A.appendChild(el('text', { x: cx, y: cy + r + 26, 'text-anchor': 'middle', text: 'θ = ' + th + '°', style: 'fill:var(--accent);--fs:17px' }));
      A.appendChild(el('text', { class: 'm', x: cx + r + 4, y: cy + 20, text: T('before', 'আগে'), 'text-anchor': 'end', style: '--fs:13px' }));
      // B: the half angle
      B.textContent = '';
      var bx = 110, by = 112, br = 84, bp = [bx + br * Math.cos(h * D), by - br * Math.sin(h * D)];
      B.appendChild(el('circle', { cx: bx, cy: by, r: br, style: 'fill:none;stroke:var(--border);stroke-width:2' }));
      B.appendChild(el('line', { class: 'gl', x1: bx - br - 6, y1: by, x2: bx + br + 6, y2: by })); B.appendChild(el('line', { class: 'gl', x1: bx, y1: by - br - 6, x2: bx, y2: by + br + 6 }));
      B.appendChild(el('line', { class: 'lt', x1: bx, y1: by, x2: bp[0], y2: by, style: 'stroke-width:4' }));
      B.appendChild(el('line', { class: 'la', x1: bp[0], y1: by, x2: bp[0], y2: bp[1], style: 'stroke-width:4' }));
      B.appendChild(el('line', { x1: bx, y1: by, x2: bp[0], y2: bp[1], style: 'stroke:var(--fg);stroke-width:2.2' }));
      B.appendChild(el('circle', { cx: bp[0], cy: bp[1], r: 7, class: 'ring' }));
      if (h > 0.5) B.appendChild(el('path', { d: 'M' + (bx + 26) + ' ' + by + ' A26 26 0 0 0 ' + (bx + 26 * Math.cos(h * D)) + ' ' + (by - 26 * Math.sin(h * D)), style: 'fill:none;stroke:var(--fg);stroke-width:2' }));
      B.appendChild(el('text', { x: bx + 30, y: by - 8, text: 'θ/2', style: '--fs:14px' }));
      B.appendChild(el('text', { x: (bx + bp[0]) / 2, y: by + (Math.abs(bp[0] - bx) < 28 ? 38 : 20), 'text-anchor': 'middle', text: 'w', style: 'fill:var(--turn);--fs:17px' }));
      B.appendChild(el('text', { x: bp[0] + (bp[0] >= bx ? 10 : -10), y: (by + bp[1]) / 2 + 5, 'text-anchor': bp[0] >= bx ? 'start' : 'end', text: 'sin', style: 'fill:var(--accent);--fs:15px' }));
      B.appendChild(el('text', { class: 'm', x: bx - br, y: by + br + 30, text: '1', style: '--fs:13px', visibility: 'hidden' }));
      var vals = [q[0], q[1], q[2], q[3]];
      vals.forEach(function (n, i) { cs[i].val.textContent = f(n, 4); }); cs[4].val.textContent = f(Math.hypot(q[0], q[1], q[2], q[3]), 4);
      var vv = v.map(function (n) { return f(n, 3); });
      formula.innerHTML = T('x, y, z = axis (' + vv.join(', ') + ') × sin(θ/2) = ' + vv.join(', ') + ' × ' + f(s, 4) + '<br>w = cos(θ/2) = cos(' + f(h, 1) + '°) = ' + f(w, 4), 'x, y, z = অক্ষ (' + vv.join(', ') + ') × sin(θ/2) = ' + vv.join(', ') + ' × ' + f(s, 4) + '<br>w = cos(θ/2) = cos(' + f(h, 1) + '°) = ' + f(w, 4));
      note.textContent = th === 0 ? T('No turn: w = 1 and x, y, z are all 0. This is the "do nothing" quaternion (0, 0, 0, 1).', 'ঘোরা নেই: w = ১ আর x, y, z সব ০। এটা “কিছু না করা” কোয়াটারনিয়ন (0, 0, 0, 1)।')
        : th === 180 ? T('Half a turn: w = 0, so all the length is in x, y, z.', 'আধা পাক: w = ০, তাই পুরো দৈর্ঘ্যটাই x, y, z-তে।')
        : th === 360 ? T('A whole turn: the robot is back where it started, yet w = −1. A quaternion and its negative (q and −q) are the same pose.', 'পুরো এক পাক: রোবট আগের জায়গাতেই ফিরেছে, তবু w = −১। একটা কোয়াটারনিয়ন আর তার উল্টো চিহ্নেরটা (q আর −q) একই পোজ।')
        : T('The length stays 1 whatever the angle: sin² + cos² = 1. That is why the angle is halved: θ/2 on the little circle covers the whole turn θ.', 'কোণ যা-ই হোক, দৈর্ঘ্য ১-ই থাকে: sin² + cos² = ১। তাই কোণকে অর্ধেক করা হয়: ছোট বৃত্তে θ/2 দিয়েই পুরো ঘোরা θ ধরা যায়।');
      host.__viz.q = q;
    }
    host.__viz = { q: [0, 0, 0, 1], set: function (a, t) { ax = a; th = t; sl.input.value = t; draw(); }, read: function () { return { x: cs[0].val.textContent, y: cs[1].val.textContent, z: cs[2].val.textContent, w: cs[3].val.textContent, len: cs[4].val.textContent, note: note.textContent }; } };
    draw();
  }

  // ================= floating: a push, and nothing slows it down =================
  function thrust(host) {
    var S = 52, X0 = 34, W = host.clientWidth && host.clientWidth < 520 ? 400 : 680, st = { x: 1.2, v: 0, t: 0, strobe: 0 }, ghosts = [], puffs = [], mode = 'space', running = false, raf = 0, msg = '';
    var body = card(host, T('Push it, then let go: what does the robot do?', 'একটা ধাক্কা দাও, তারপর ছেড়ে দাও: রোবট কী করে?'),
      T('Each push sends air one way and the robot the other. The faint circles are the robot every 0.4 seconds: far apart means fast, evenly spaced means a steady speed.', 'প্রতিটা ধাক্কায় বাতাস যায় এক দিকে, রোবট অন্য দিকে। ফিকে বৃত্তগুলো প্রতি ০.৪ সেকেন্ডে রোবটটা কোথায় ছিল: দূরে দূরে মানে দ্রুত, সমান ফাঁক মানে একই গতি।'));
    var svg = el('svg', { class: W > 500 ? 'wide' : '', viewBox: '0 0 ' + W + ' 190', role: 'img', 'aria-label': T('A robot moving along a rail', 'একটা রেলে চলা রোবট') });
    var floor = el('g'), gh = el('g'), pf = el('g'), rob = el('g'), arrow = el('line', { class: 'la', style: 'stroke-width:3.4' }), head = el('polygon', { class: 'fa' }), spd = el('text', { 'text-anchor': 'middle', style: 'fill:var(--accent);--fs:16px' });
    svg.appendChild(floor); svg.appendChild(gh); svg.appendChild(pf); svg.appendChild(arrow); svg.appendChild(head); svg.appendChild(spd); svg.appendChild(rob);
    rob.appendChild(el('circle', { class: 'rb', r: 22 })); rob.appendChild(el('circle', { cx: 12, cy: 0, r: 6, style: 'fill:var(--accent)' }));
    [[-12, -12], [-12, 12], [3, -15], [3, 15]].forEach(function (p) { rob.appendChild(el('rect', { x: p[0] - 3, y: p[1] - 3, width: 6, height: 6, rx: 1, style: 'fill:var(--muted)' })); });
    var xs = function (m) { return X0 + m * S; }, RY = 104;
    function ground() {
      floor.textContent = '';
      if (mode === 'floor') {
        floor.appendChild(el('line', { x1: 10, x2: W - 10, y1: RY + 22, y2: RY + 22, style: 'stroke:var(--fg);stroke-width:3' }));
        for (var i = 10; i < W - 10; i += 14) floor.appendChild(el('line', { x1: i, y1: RY + 22, x2: i - 8, y2: RY + 32, style: 'stroke:var(--muted);stroke-width:1.5' }));
        floor.appendChild(el('text', { class: 'm', x: W - 14, y: RY + 52, 'text-anchor': 'end', text: T('floor: rubs against the robot (friction)', 'মেঝে: রোবটের গায়ে ঘষা লাগে (ঘর্ষণ)') }));
      } else {
        for (var j = 0; j < 40; j++) floor.appendChild(el('circle', { cx: (j * 97) % (W - 20) + 10, cy: (j * 53) % 170 + 8, r: 1.3, style: 'fill:var(--muted);opacity:.6' }));
        floor.appendChild(el('text', { class: 'm', x: W - 14, y: RY + 52, 'text-anchor': 'end', text: T('no floor, no air: nothing rubs against the robot', 'মেঝে নেই, বাতাস নেই: কিছুই রোবটকে ঘষে না') }));
      }
      for (var m = 0; m * S + X0 < W - 10; m++) { floor.appendChild(el('line', { x1: xs(m), x2: xs(m), y1: 168, y2: 178, style: 'stroke:var(--muted);stroke-width:1.5' })); floor.appendChild(el('text', { class: 'm', x: xs(m), y: 188, 'text-anchor': 'middle', text: m + (m === 0 ? ' m' : ''), style: 'font-size:12.5px' })); }
    }
    function draw() {
      rob.setAttribute('transform', 'translate(' + xs(st.x) + ',' + RY + ')');
      gh.textContent = ''; ghosts.forEach(function (g, i) { gh.appendChild(el('circle', { cx: xs(g), cy: RY, r: 22, style: 'fill:none;stroke:var(--fg);stroke-width:1.5;stroke-dasharray:3 4;opacity:' + (0.25 + 0.5 * i / Math.max(1, ghosts.length)).toFixed(2) })); });
      pf.textContent = ''; puffs.forEach(function (p) { pf.appendChild(el('circle', { cx: p.x, cy: p.y, r: 3 + 2 * p.life, style: 'fill:var(--fg);opacity:' + (p.life * 0.7).toFixed(2) })); });
      var len = clamp(Math.abs(st.v) * 90, 0, 150), sg = st.v >= 0 ? 1 : -1, ax = xs(st.x), ay = RY - 42;
      if (Math.abs(st.v) < 0.005) { arrow.setAttribute('visibility', 'hidden'); head.setAttribute('visibility', 'hidden'); spd.textContent = T('not moving', 'স্থির'); spd.setAttribute('x', ax); spd.setAttribute('y', ay - 4); }
      else {
        arrow.setAttribute('visibility', 'visible'); head.setAttribute('visibility', 'visible');
        arrow.setAttribute('x1', ax); arrow.setAttribute('y1', ay); arrow.setAttribute('x2', ax + sg * len); arrow.setAttribute('y2', ay);
        head.setAttribute('points', (ax + sg * (len + 11)) + ',' + ay + ' ' + (ax + sg * len) + ',' + (ay - 6) + ' ' + (ax + sg * len) + ',' + (ay + 6));
        spd.textContent = f(Math.abs(st.v), 2) + ' ' + T('m/s', 'মি/সে'); spd.setAttribute('x', ax + sg * len / 2); spd.setAttribute('y', ay - 10);
      }
      cs.val.textContent = f(st.v, 2); cp.val.textContent = f(st.x, 2);
      note.textContent = msg || (Math.abs(st.v) < 0.005 ? T('Not moving. Give it a push!', 'স্থির আছে। একটা ধাক্কা দাও!')
        : mode === 'space' ? T('Moving at ' + f(Math.abs(st.v), 2) + ' m/s, and nothing slows it down. To stop, push the other way.', 'চলছে ' + f(Math.abs(st.v), 2) + ' মি/সে বেগে, আর কিছুই এটাকে থামাচ্ছে না। থামাতে হলে উল্টো দিকে ঠেলতে হবে।')
        : T('Friction rubs the speed away: it stops all by itself.', 'ঘর্ষণ গতি কমিয়ে দেয়: নিজে থেকেই থেমে যায়।'));
    }
    function push(dir) {
      st.v = clamp(st.v + dir * 0.5, -1.5, 1.5); msg = '';
      for (var i = 0; i < 7; i++) puffs.push({ x: xs(st.x) - dir * (26 + i * 3), y: RY + (i - 3) * 5, vx: -dir * (140 + i * 18), life: 1 });
      draw(); go();
    }
    function step(dt) {
      st.t += dt;
      if (mode === 'floor') st.v *= Math.exp(-2.4 * dt); if (Math.abs(st.v) < 0.012 && mode === 'floor') st.v = 0;
      var nx = st.x + st.v * dt, lim = (W - 40 - X0) / S;
      if (nx < 0.3 || nx > lim) { nx = clamp(nx, 0.3, lim); st.v = 0; msg = T('It hit the end of the rail and stopped.', 'রেলের শেষ মাথায় লেগে থেমে গেছে।'); }
      st.x = nx;
      st.strobe += dt; if (st.strobe >= 0.4) { st.strobe -= 0.4; if (Math.abs(st.v) > 0.01) { ghosts.push(st.x); if (ghosts.length > 40) ghosts.shift(); } }
      puffs.forEach(function (p) { p.x += p.vx * dt; p.life -= dt * 2.2; }); puffs = puffs.filter(function (p) { return p.life > 0; });
      draw();
    }
    function go() {
      if (running) return; running = true; var last = performance.now();
      (function loop(now) {
        var dt = Math.min(0.05, (now - last) / 1000); last = now; step(dt);
        if (Math.abs(st.v) > 0.005 || puffs.length) raf = requestAnimationFrame(loop); else { running = false; if (mode === 'floor') { st.v = 0; draw(); } }
      })(last);
    }
    function reset() { st.x = 1.2; st.v = 0; st.strobe = 0; ghosts = []; puffs = []; msg = ''; draw(); }
    body.appendChild(svg);
    var cs = chip(T('speed', 'গতি')), cp = chip(T('position', 'জায়গা')), note = el('p', { class: 'vnote', 'aria-live': 'polite' });
    cs.val.parentNode.appendChild(el('small', { text: T('m/s', 'মি/সে') })); cp.val.parentNode.appendChild(el('small', { text: T('m', 'মি') }));
    body.appendChild(el('div', { class: 'vread' }, [cs.box, cp.box])); body.appendChild(note);
    var bs = button(T('In space', 'মহাকাশে'), function () { setMode('space'); }), bf = button(T('On a floor (friction)', 'মেঝেতে (ঘর্ষণ)'), function () { setMode('floor'); });
    function setMode(m) { mode = m; bs.classList.toggle('on', m === 'space'); bf.classList.toggle('on', m === 'floor'); reset(); ground(); draw(); }
    body.appendChild(el('div', { class: 'vctl' }, [button('◀ ' + T('Push left', 'বাঁয়ে ঠেলো'), function () { push(-1); }), button(T('Push right', 'ডানে ঠেলো') + ' ▶', function () { push(1); }), button(T('Start over', 'আবার শুরু'), reset), bs, bf]));
    setMode('space');
    host.__viz = { state: st, push: push, step: step, setMode: setMode, reset: reset, note: function () { return note.textContent; }, ghosts: function () { return ghosts.slice(); } };
  }

  // ================= how the camera sees a marker =================
  function sight(host) {
    var S = 120, ML = 24, MT = 38, MB = 30, X0 = 1.0, X1 = 6.4, CAM = { fov: 2 * Math.atan(640 / 900) / D, vfov: 2 * Math.atan(360 / 900) / D, range: 1, tilt: 75, off: 0.14 };
    var st = { x: 4.18, y: -0.55, z: 0.52, yaw: -90 };
    var body = card(host, T('What can the camera read? Move the robot and turn it', 'ক্যামেরা কী পড়তে পারে? রোবট সরাও আর ঘোরাও'),
      T('Drag the robot (drawn to scale) and the round handle at the end of the camera\'s view. A marker is read only when it is inside the view, close enough, and not seen too edge-on.', 'রোবটটাকে (আসল মাপে আঁকা) আর ক্যামেরার দৃষ্টির শেষের গোল হাতলটা টানো। মার্কার পড়া যায় শুধু যখন সেটা দৃষ্টির ভেতরে, যথেষ্ট কাছে, আর বেশি কাত হয়ে নেই।'));
    var v = kiboView('top', S, ML, MT, MB, X0, X1), svg = v.svg;
    svg.appendChild(el('text', { class: 'm', x: v.X((X0 + X1) / 2), y: 26, 'text-anchor': 'middle', text: T('SAIBO wall (−y), seen from above', 'ওপর থেকে দেখা SAIBO দেয়াল (−y)') }));
    svg.appendChild(el('text', { class: 'm', x: v.X((X0 + X1) / 2), y: v.Y(BOX.y[1]) - 9, 'text-anchor': 'middle', text: T('EPS2 wall (+y)', 'EPS2 দেয়াল (+y)') }));
    var wallMarks = MARKS.filter(function (m) { return Math.abs(Math.abs(m[2]) - 1.0235) < 0.03 && m[1] >= X0 && m[1] <= X1; }), mk = {};
    wallMarks.forEach(function (m) {
      var g = el('g'), r = el('rect', { class: 'mk', x: -8, y: -8, width: 16, height: 16, rx: 2 }), t = el('text', { x: 0, y: m[2] < 0 ? 26 : -14, 'text-anchor': 'middle', text: String(m[0]), style: '--fs:14px' });
      g.setAttribute('transform', 'translate(' + v.X(m[1]) + ',' + v.Y(m[2]) + ')'); g.appendChild(r); g.appendChild(t); svg.appendChild(g); mk[m[0]] = r;
    });
    var coneL = el('path', { style: 'fill:var(--accent);opacity:.2;stroke:var(--accent);stroke-width:1.5' }), rays = el('g'), robot = el('g'), tip = handle(9, T('Where the camera points: drag me', 'ক্যামেরা কোন দিকে: আমাকে টানো'));
    svg.appendChild(coneL); svg.appendChild(rays);
    robot.appendChild(el('circle', { class: 'rb', r: 0.1 * S })); robot.appendChild(el('rect', { x: 0.1 * S - 3, y: -4, width: 8, height: 8, rx: 2, style: 'fill:var(--accent)' }));
    var rh = el('circle', { class: 'hit', r: 24 }); robot.insertBefore(rh, robot.firstChild); robot.setAttribute('tabindex', '0'); robot.setAttribute('role', 'slider'); robot.setAttribute('aria-label', T('The robot: drag me', 'রোবট: আমাকে টানো'));
    svg.appendChild(robot); svg.appendChild(tip);
    body.appendChild(svg);
    var seen = el('p', { class: 'vnote', 'aria-live': 'polite' }), cz = chip('z', 'z');
    cz.val.parentNode.appendChild(el('small', { text: T('m (height)', 'মি (উচ্চতা)') })); var cd = chip(T('camera sees', 'ক্যামেরা দেখছে'));
    body.appendChild(el('div', { class: 'vread' }, [cd.box, cz.box])); body.appendChild(seen);
    var sy = slider(T('Turn', 'ঘোরা'), -180, 180, 1, st.yaw, function (a) { st.yaw = a; draw(); }), sz = slider(T('Height z', 'উচ্চতা z'), -0.2, 1.9, 0.01, st.z, function (a) { st.z = a; draw(); }, 'z');
    body.appendChild(el('div', { class: 'vctl' }, [sy.box, sz.box, button(T('Face the SAIBO wall', 'SAIBO দেয়ালের দিকে'), function () { st.yaw = -90; draw(); }), button(T('Face the airlock', 'এয়ারলকের দিকে'), function () { st.yaw = 0; draw(); }), button(T('Face the EPS2 wall', 'EPS2 দেয়ালের দিকে'), function () { st.yaw = 90; draw(); })]));
    function normal(m) { if (Math.abs(m[2] + 1.001) < 0.01) return [0, 1, 0]; if (Math.abs(m[2] - 1.046) < 0.01) return [0, -1, 0]; return [0, 0, 1]; }
    function reads() {
      var c = [st.x + CAM.off * Math.cos(st.yaw * D), st.y + CAM.off * Math.sin(st.yaw * D), st.z], out = [];
      wallMarks.forEach(function (m) {
        var vx = m[1] - c[0], vy = m[2] - c[1], vz = m[3] - c[2], dist = Math.hypot(vx, vy, vz), n = normal(m);
        var yawErr = Math.abs(wrap180(Math.atan2(vy, vx) / D - st.yaw)), elev = Math.abs(Math.atan2(vz, Math.hypot(vx, vy)) / D), tilt = Math.acos(clamp((-(vx * n[0] + vy * n[1] + vz * n[2])) / (dist || 1), -1, 1)) / D;
        var ok = dist <= CAM.range && yawErr <= CAM.fov / 2 && elev <= CAM.vfov / 2 && tilt <= CAM.tilt;
        out.push({ id: m[0], ok: ok, dist: dist, off: yawErr, why: dist > CAM.range ? 'far' : yawErr > CAM.fov / 2 ? 'side' : elev > CAM.vfov / 2 ? 'vert' : tilt > CAM.tilt ? 'tilt' : '' });
      });
      return out;
    }
    function draw() {
      var px = v.X(st.x), py = v.Y(st.y), c = [st.x + CAM.off * Math.cos(st.yaw * D), st.y + CAM.off * Math.sin(st.yaw * D)], L = CAM.range * S, a1 = (st.yaw - CAM.fov / 2) * D, a2 = (st.yaw + CAM.fov / 2) * D;
      var cx = v.X(c[0]), cy = v.Y(c[1]);
      coneL.setAttribute('d', 'M' + cx + ' ' + cy + ' L' + (cx + L * Math.cos(a1)) + ' ' + (cy + L * Math.sin(a1)) + ' A' + L + ' ' + L + ' 0 0 1 ' + (cx + L * Math.cos(a2)) + ' ' + (cy + L * Math.sin(a2)) + ' Z');
      robot.setAttribute('transform', 'translate(' + px + ',' + py + ') rotate(' + st.yaw + ')');
      tip.setAttribute('transform', 'translate(' + (cx + (L + 16) * Math.cos(st.yaw * D)) + ',' + (cy + (L + 16) * Math.sin(st.yaw * D)) + ')');
      var rs = reads(), ok = rs.filter(function (r) { return r.ok; });
      rays.textContent = '';
      rs.forEach(function (r) { var m = MARKS.filter(function (q) { return q[0] === r.id; })[0]; mk[r.id].setAttribute('class', 'mk' + (r.ok ? ' on' : '')); if (r.ok) rays.appendChild(el('line', { x1: cx, y1: cy, x2: v.X(m[1]), y2: v.Y(m[2]), style: 'stroke:var(--ok);stroke-width:2;stroke-dasharray:4 3' })); });
      cd.val.textContent = ok.length ? ok.map(function (r) { return 'AR ' + r.id; }).join(', ') : T('nothing', 'কিছুই না'); cz.val.textContent = f(st.z, 2); sy.input.value = st.yaw; sz.input.value = st.z;
      var near = rs.slice().sort(function (a, b) { return a.dist - b.dist; })[0];
      seen.textContent = ok.length ? ok.map(function (r) { return T('AR ' + r.id + ' is read: ' + f(r.dist, 2) + ' m away, ' + f(r.off, 0) + '° off the middle.', 'AR ' + r.id + ' পড়া যাচ্ছে: ' + f(r.dist, 2) + ' মি দূরে, মাঝ থেকে ' + f(r.off, 0) + '° সরে।'); }).join(' ')
        : near.why === 'far' ? T('No marker is read: the nearest (AR ' + near.id + ') is ' + f(near.dist, 2) + ' m away, and the camera reads only up to ' + CAM.range + ' m.', 'কোনো মার্কার পড়া যাচ্ছে না: সবচেয়ে কাছেরটা (AR ' + near.id + ') ' + f(near.dist, 2) + ' মি দূরে, আর ক্যামেরা ' + CAM.range + ' মিটার পর্যন্তই পড়ে।')
        : near.why === 'tilt' ? T('AR ' + near.id + ' is seen too edge-on (over ' + CAM.tilt + '°): the camera cannot read it.', 'AR ' + near.id + ' বেশি কাত হয়ে দেখা যাচ্ছে (' + CAM.tilt + '°-র বেশি): ক্যামেরা পড়তে পারে না।')
        : near.why === 'vert' ? T('AR ' + near.id + ' is above or below what the camera sees. Change the height z.', 'AR ' + near.id + ' ক্যামেরার দৃষ্টির ওপরে বা নিচে। উচ্চতা z বদলাও।')
        : T('No marker is inside the camera\'s view: turn the robot toward one.', 'ক্যামেরার দৃষ্টির ভেতরে কোনো মার্কার নেই: রোবটকে একটার দিকে ঘোরাও।');
      host.__viz.reads = rs;
    }
    host.__viz = { state: st, reads: [], set: function (x, y, z, yaw) { st.x = clamp(x, X0, X1); st.y = clamp(y, BOX.y[0] + 0.1, BOX.y[1] - 0.1); st.z = z; st.yaw = wrap180(yaw); draw(); }, read: function () { return { sees: cd.val.textContent, note: seen.textContent }; } };
    drag(svg, robot, function (px, py) { st.x = clamp((px - ML) / S + X0, X0, X1); st.y = clamp((py - MT) / S + BOX.y[0], BOX.y[0] + 0.1, BOX.y[1] - 0.1); draw(); });
    drag(svg, tip, function (px, py) { st.yaw = wrap180(Math.round(Math.atan2(py - v.Y(st.y), px - v.X(st.x)) / D)); draw(); });
    arrows(robot, function (dx, dy) { st.x = clamp(st.x + dx * 0.05, X0, X1); st.y = clamp(st.y + dy * 0.05, BOX.y[0] + 0.1, BOX.y[1] - 0.1); draw(); });
    arrows(tip, function (dx, dy) { st.yaw = wrap180(st.yaw + (dx + dy) * 5); draw(); });
    draw();
  }

  var W = { kibo: kibo, dial: dial, facing: facing, gimbal: gimbal, halfangle: halfangle, thrust: thrust, sight: sight };
  function start() {
    var lang = BN ? 'bn' : 'en';
    Array.prototype.forEach.call(document.querySelectorAll('[data-viz]'), function (h) {
      var box = h.closest('.bn,.en'); if (box && !box.classList.contains(lang)) return; // the other language's copy
      var fn = W[h.getAttribute('data-viz')]; if (!fn) return;
      try { fn(h); } catch (e) { h.textContent = ''; if (window.console) console.error('viz', h.getAttribute('data-viz'), e); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
