// 過程 on a wide sheet (an iPad, a computer; 2026-11-06): the plays were a
// 720px column in the middle of a 1080px sheet with the filter and the period
// chips over them. Now the ways around are a column down the left and the
// plays take the rest, by the sheet's own width (never the screen's); a phone
// keeps the bar on top.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sheets = readFileSync(new URL('../public/sheets.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');

test('a long 過程 marks itself so a wide sheet can lay its bar beside the plays', () => {
  const nav = sheets.slice(sheets.indexOf('function playsNav('), sheets.indexOf('function bringIn('));
  assert.match(nav, /wrap\.classList\.toggle\('with-nav', long\)/);
  assert.match(nav, /--plays-top/, 'kept in view under the sheet head, not behind it');
});

test('by the sheet’s width, not the screen’s; no narrow centred column left', () => {
  assert.match(css, /@container q-sheet \(min-width: 760px\) \{\n {2}\.plays-wrap\.with-nav \{ display: grid;/);
  assert.doesNotMatch(css, /\.plays-wrap \{ max-width: 720px; margin-inline: auto; \}/);
});
