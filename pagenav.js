/* Easy moving about on the long learning pages (rotations, robots, rules guide, manual): a thin reading-progress bar, a button that opens
   the list of lessons (with the one being read marked), previous / next lesson and back to the top, always in reach. On a wide screen
   the list stays beside the page. It reads the page's own headings (h2 with an id) that are showing, so it follows the language. */
(function () {
  'use strict';
  var root = document.documentElement, BN = root.getAttribute('data-lang') === 'bn';
  function T(en, bn) { return BN ? bn : en; }
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else if (attrs[k] != null) e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function start() {
    var main = document.querySelector('main') || document.body, items = [], part = '';
    Array.prototype.forEach.call(document.querySelectorAll('main h2, body > h2, .bn h2, .en h2'), function (h) {
      if (!h.offsetParent) return; // the other language, or folded away
      if (h.classList.contains('part')) { part = h.textContent.trim(); return; }
      if (!h.id) return;
      if (items.some(function (i) { return i.h === h; })) return;
      items.push({ h: h, id: h.id, text: h.textContent.trim(), part: part });
    });
    if (items.length < 4) return; // a short page needs no help
    var by = {};
    items.forEach(function (it, i) { it.i = i; by[it.id] = it; });

    // ----- the pieces
    var bar = el('div', { class: 'pn-bar', 'aria-hidden': 'true' }, [el('i')]);
    var icon = function (d) { var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); var p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '2.4'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); s.appendChild(p); return s; };
    var prev = el('button', { type: 'button', 'aria-label': T('Previous lesson', 'আগের পাঠ'), title: T('Previous lesson', 'আগের পাঠ') }, [icon('M15 5l-7 7 7 7')]);
    var next = el('button', { type: 'button', 'aria-label': T('Next lesson', 'পরের পাঠ'), title: T('Next lesson', 'পরের পাঠ') }, [icon('M9 5l7 7-7 7')]);
    var pos = el('span', { class: 'pn-pos' });
    var menu = el('button', { type: 'button', class: 'pn-menu', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, [icon('M4 7h16M4 12h16M4 17h10'), el('span', { text: T('Contents', 'সূচি') }), pos]);
    var top = el('button', { type: 'button', 'aria-label': T('Back to the top', 'একদম ওপরে যাও'), title: T('Back to the top', 'একদম ওপরে যাও') }, [icon('M6 15l6-6 6 6')]);
    var fab = el('div', { class: 'pn-fab', role: 'group', 'aria-label': T('Moving about this page', 'এই পাতায় চলাফেরা') }, [prev, menu, next, top]);
    var back = el('div', { class: 'pn-back', hidden: '' });
    var closeBtn = el('button', { type: 'button', 'aria-label': T('Close', 'বন্ধ করো'), text: '×' });
    var list = el('ol'), rail = el('nav', { class: 'pn-rail', 'aria-label': T('Lessons on this page', 'এই পাতার পাঠগুলো') }), railList = el('ol');
    var panel = el('div', { class: 'pn-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': T('Lessons on this page', 'এই পাতার পাঠগুলো'), hidden: '' }, [el('header', {}, [el('b', { text: T('Lessons on this page', 'এই পাতার পাঠগুলো') }), closeBtn]), list]);
    rail.appendChild(el('b', { text: T('On this page', 'এই পাতায়') })); rail.appendChild(railList);

    var links = [], lastPart = null;
    function row(ul, it, close) {
      if (it.part !== lastPart && it.part) { ul.appendChild(el('li', { class: 'pn-part', text: it.part })); }
      var a = el('a', { href: '#' + it.id, text: it.text });
      a.addEventListener('click', function (e) { e.preventDefault(); go(it.i, true); if (close) closePanel(false); });
      ul.appendChild(el('li', {}, [a])); links.push([it.i, a]);
    }
    items.forEach(function (it) { row(list, it, true); }); lastPart = null;
    items.forEach(function (it) { row(railList, it, false); });
    document.body.appendChild(bar); document.body.appendChild(rail); document.body.appendChild(fab); document.body.appendChild(back); document.body.appendChild(panel);

    // ----- where the reader is: the last heading that has reached the upper part of the screen
    var cur = 0, ticking = false, inIntro = true;
    function whereNow() {
      var line = Math.min(160, window.innerHeight * 0.3), at = 0;
      for (var i = 0; i < items.length; i++) { if (items[i].h.getBoundingClientRect().top <= line) at = i; else break; }
      var doc = document.documentElement, max = doc.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY >= max - 4) at = items.length - 1; // the very end counts as the last lesson
      return at;
    }
    function paint() {
      ticking = false;
      var doc = document.documentElement, max = Math.max(1, doc.scrollHeight - window.innerHeight);
      bar.firstChild.style.width = Math.min(100, Math.max(0, window.scrollY / max * 100)) + '%';
      var at = whereNow();
      // Above the first lesson (the page's intro) nothing is marked yet.
      var intro = items[0].h.getBoundingClientRect().top > window.innerHeight * 0.3 && window.scrollY < 40;
      cur = at; inIntro = intro;
      pos.textContent = (intro ? 0 : at + 1) + '/' + items.length;
      prev.disabled = intro; next.disabled = at >= items.length - 1;
      links.forEach(function (l) { if (l[0] === at && !intro) l[1].setAttribute('aria-current', 'true'); else l[1].removeAttribute('aria-current'); });
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    function go(i, mark) {
      i = Math.max(0, Math.min(items.length - 1, i));
      var h = items[i].h;
      h.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      if (mark && history.replaceState) { try { history.replaceState(null, '', '#' + items[i].id); } catch (e) { /* ignore */ } }
      try { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
    prev.addEventListener('click', function () {
      var atTop = items[cur].h.getBoundingClientRect().top < -40; // part-way down a lesson: first back to its start
      go(atTop ? cur : cur - 1, true);
    });
    next.addEventListener('click', function () { go(inIntro ? 0 : cur + 1, true); }); // from the intro: the first lesson
    top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });

    // ----- the list
    var opener = null;
    function openPanel() {
      opener = document.activeElement; panel.hidden = false; back.hidden = false; menu.setAttribute('aria-expanded', 'true');
      var a = panel.querySelector('a[aria-current]') || panel.querySelector('a');
      if (a) { a.scrollIntoView({ block: 'center' }); try { a.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }
    function closePanel(refocus) {
      panel.hidden = true; back.hidden = true; menu.setAttribute('aria-expanded', 'false');
      if (refocus && opener && opener.focus) opener.focus();
    }
    menu.addEventListener('click', function () { if (panel.hidden) openPanel(); else closePanel(true); });
    closeBtn.addEventListener('click', function () { closePanel(true); });
    back.addEventListener('click', function () { closePanel(true); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) { e.preventDefault(); closePanel(true); return; }
      if (panel.hidden) return;
      if (e.key === 'Tab') { // keep the focus inside the open list
        var f = Array.prototype.slice.call(panel.querySelectorAll('a,button')); if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    // Opening the page at a lesson (a link with #...): the list follows.
    window.addEventListener('hashchange', function () { var id = decodeURIComponent(location.hash.slice(1)); if (by[id]) onScroll(); });
    paint();
    root.setAttribute('data-pagenav', String(items.length));
    window.__pagenav = { items: items.map(function (i) { return i.id; }), current: function () { return cur; } };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
