/* ---------- the language of the apps: English (the site's default) or Bangla ---------- */
// The page decides: lang.js sets <html data-lang> before the apps load (a page without it is English, so the
// bundle works as before when embedded elsewhere). Text in the code is written in both languages side by side,
// English first: L('Start flying', 'ওড়া শুরু করো'). Switching language reloads the page, so the text is built once.
export type Lang = 'bn' | 'en';

export function lang(): Lang {
  if (typeof document === 'undefined') return 'en'; // Node (the tests)
  const d = document.documentElement, v = d.getAttribute('data-lang') || d.lang || '';
  return /^bn/i.test(v) ? 'bn' : 'en';
}

/** The text in the page's language. */
export function L(en: string, bn: string): string { return lang() === 'bn' ? bn : en; }

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

/** A number (or text with numbers) in the page's digits: Bangla digits in Bangla. Codes, coordinates and other
 * technical values stay as they are; this is for counts, times and distances people read. */
export function N(v: string | number): string {
  const s = String(v);
  return lang() === 'bn' ? s.replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; }) : s;
}

// Fonts: the system's own for Latin letters, then Noto Sans Bengali (Google's, loaded by the pages) for Bangla, in
// every font stack (CSS and canvas).

/** In Bangla, once the Bangla font has loaded (or after 2.5 s without it), so text drawn into canvases uses it. */
export function fontReady(): Promise<unknown> {
  if (lang() !== 'bn' || typeof document === 'undefined' || !document.fonts || !document.fonts.load) return Promise.resolve();
  const wait = Promise.all([document.fonts.load('400 16px "Noto Sans Bengali"', 'অ'), document.fonts.load('700 16px "Noto Sans Bengali"', 'অ')]).catch(function () { return null; });
  return Promise.race([wait, new Promise(function (r) { setTimeout(r, 2500); })]);
}
