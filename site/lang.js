/* The site's language: Bangla, unless English was chosen in this tab or the address asks for one (?lang=en, ?lang=bn).
   The choice lasts until the tab is closed (sessionStorage), so every new visit starts in Bangla. Loaded in each page's head, before the content shows: it sets <html lang> and data-lang,
   which the pages' CSS (.bn and .en blocks) and the apps (L() in src/i18n.ts) follow.

   - The language buttons ([data-setlang]) switch. A page with an app on it reloads (the apps build their text once);
     the others switch at once.
   - The title follows: <title> is Bangla, <meta name="title-en"> gives the English one.
   - aria-label and title follow: an element with data-aria-bn and data-aria-en (data-title-bn and data-title-en) gets
     the one for the language.
   - Anchors: an English heading's id is the Bangla one's with "en-" in front, so a link to either language's heading
     opens the one shown. A link into a folded <details> opens it. */
(function () {
  var KEY = 'kibo-nav-sandbox:lang', root = document.documentElement, bnTitle = null, lang = 'bn';
  try { if (sessionStorage.getItem(KEY) === 'en') lang = 'en'; } catch (e) { /* storage blocked: Bangla */ }
  try { localStorage.removeItem(KEY); } catch (e) { /* storage blocked */ } // a choice kept for good by older versions
  var asked = /[?&]lang=(bn|en)(?=&|$)/.exec(location.search);
  if (asked) { lang = asked[1]; save(lang); }
  set(lang);

  function save(l) { try { sessionStorage.setItem(KEY, l); } catch (e) { /* storage blocked */ } }

  function set(l) {
    root.lang = l;
    root.setAttribute('data-lang', l);
    if (!document.head) return;
    var t = document.querySelector('meta[name="title-en"]');
    if (bnTitle === null && document.title) bnTitle = document.title;
    if (t && bnTitle !== null) document.title = l === 'en' ? t.getAttribute('content') : bnTitle;
    var els = document.querySelectorAll('[data-aria-bn]'), i;
    for (i = 0; i < els.length; i++) els[i].setAttribute('aria-label', els[i].getAttribute('data-aria-' + l));
    els = document.querySelectorAll('[data-title-bn]');
    for (i = 0; i < els.length; i++) els[i].setAttribute('title', els[i].getAttribute('data-title-' + l));
  }

  function fixHash() {
    var h = location.hash.slice(1);
    if (!h) return;
    var want = root.getAttribute('data-lang') === 'en' ? (h.indexOf('en-') === 0 ? h : 'en-' + h) : h.replace(/^en-/, '');
    var el = document.getElementById(want);
    if (!el) return;
    if (want !== h) history.replaceState(null, '', '#' + want);
    if (unfold(el) || want !== h) el.scrollIntoView();
  }

  // A link can point into a folded <details> (a page's intro bar): open it, and say so, so the target gets shown.
  function unfold(el) {
    var opened = false;
    for (var d = el; d; d = d.parentElement) if (d.tagName === 'DETAILS' && !d.open) { d.open = true; opened = true; }
    return opened;
  }

  document.addEventListener('DOMContentLoaded', function () { set(root.getAttribute('data-lang')); fixHash(); });
  window.addEventListener('hashchange', fixHash);

  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-setlang]') : null;
    if (!b) return;
    e.preventDefault();
    var l = b.getAttribute('data-setlang');
    save(l);
    // Drop a ?lang= in the address: it would win over the choice on the next load.
    var q = location.search.replace(/([?&])lang=(bn|en)(&|$)/, '$1').replace(/[?&]$/, '');
    if (document.querySelector('kibo-nav-sandbox') || root.hasAttribute('data-lang-reload')) {
      location.replace(location.pathname + q + location.hash); // reload in the new language
      return;
    }
    if (q !== location.search) history.replaceState(null, '', location.pathname + q + location.hash);
    set(l);
    fixHash();
  });
})();
