import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Jay 2026-11-05: "愛爾達節目表 can't swipe", and its height changed day to
// day. 轉播's swipe stops under a sheet, so the guide swipes its own days, and
// it opens full height (a short day and a long day the same sheet).
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const at = app.indexOf('function openGuide(');
const guide = app.slice(at, app.indexOf('\n}\n', at));

test('the TV guide swipes a day either way', () => {
  assert.ok(at >= 0);
  assert.match(guide, /daySwipe\(s\.body/);
});

test('the TV guide never changes height between days', () => {
  assert.match(guide, /sheet\([^)]*\), \{ full: true \}\)/);
});

// Jay 2026-11-18: its blank area didn't swipe, and a day of one NBA game left the sheet mostly empty.
const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
test('the guide body fills the sheet, so its empty space swipes', () => {
  assert.match(guide, /classList\.add\('tv-guide-sheet'\)/);
  assert.match(css, /dialog\.tv-guide-sheet\[open\] > \.sheet-body \{ flex-grow: 1; \}/);
});
test('a short day goes on into the next days', () => {
  assert.match(guide, /n < FILL/);
});
