// Text helpers every part of the app shares (pure: the tests import them).

// A name as it's compared: accents off, lower case, trimmed ("Pérez" and
// "PEREZ " are one man). Every match by name goes through it.
export const fold = s =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

// Feed text put into HTML (a line drawn with <b> in it): shown as written,
// never read as markup ("Brighton & Hove Albion" keeps its &).
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// A person's family name as it's compared ("Carlos Sainz Jr." → "sainz").
export const surname = s =>
  fold(s)
    .split(/\s+/)
    .filter(w => !/^(jr|sr)\.?$/.test(w))
    .at(-1) || '';
