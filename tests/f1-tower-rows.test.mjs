import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sheets = readFileSync(new URL('../public/sheets.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');

// Jay 2026-11-21, a qualifying board: "Ugly". The tyre column sized itself
// row by row (a tyre with no laps, the icon shifted right), and 進站 under a
// name made that row taller than the rest. Now every row the same.
test("the live board's rows: one tyre column width, its laps slot always there, a tag beside the name", () => {
  assert.match(css, /\.f1-field li\.tower \{ grid-template-columns: 22px 24px minmax\(0, 1fr\) var\(--tw-tyre, 44px\) 76px;/);
  assert.match(css, /\.f1-field li\.tower \.f1-who \{ display: flex; align-items: center;/);
  assert.match(sheets, /tyreIcon\(c\.tyre\), el\('small', \{ class: 'num', text: c\.tyreLaps \? String\(c\.tyreLaps\) : '' \}\)/);
});
