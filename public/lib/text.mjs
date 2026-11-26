// Text helpers every part of the app shares (pure: the tests import them).

import { fold } from '#kit/names.mjs';

// A name as it's compared: accents off, lower case, trimmed ("Pérez" and
// "PEREZ " are one man). Every match by name goes through it: the kit's
// (which also reads ø, æ, ß…).
export { fold };

// Feed text put into HTML (a line drawn with <b> in it): shown as written,
// never read as markup ("Brighton & Hove Albion" keeps its &).
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// A person's family name as it's compared ("Carlos Sainz Jr." → "sainz").
export const surname = s =>
  fold(s)
    .split(/\s+/)
    .filter(w => !/^(jr|sr)\.?$/.test(w))
    .at(-1) || '';

// A game's score table's names (sheets.js linescore): both sides by their Chinese names when both have them
// and they fit beside `cols` columns (a football game's two halves leave room for 新英格蘭革命), else both
// by their letters, never one of each (Jay 11-26: "NE" beside 費城聯合).
export function scoreName(sides, cols, lang = 'zh') {
  const room = cols <= 2 ? 8 : 5;
  const zh = lang !== 'en' && sides.every(x => x?.en && x.short && x.short.length <= room);
  return x => (zh ? x.short : x.abbr || x.short);
}
