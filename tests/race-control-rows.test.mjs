import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sheets = readFileSync(new URL(`${process.env.ORBIT_SRC || '../public'}/sheets.js`, import.meta.url), 'utf8');
const css = readFileSync(new URL(`${process.env.ORBIT_SRC || '../public'}/styles.css`, import.meta.url), 'utf8');

// Jay 2026-11-21, 賽會訊息 opened: "ugly and simple" (a line of text after
// another, a pill in the middle of each, an empty column on the left).
test('race control: a row a word, its kind an icon, the drivers it opens with over it, the time at the right', () => {
  assert.match(sheets, /el\('li', \{ class: `rc-row rc-\$\{kind\.k\}` \}/);
  assert.match(sheets, /const RC_ICON = \{/);
  assert.match(css, /\.lb-msgs li\.rc-row \{ display: grid; grid-template-columns: 30px minmax\(0, 1fr\);/);
  // (Chequered isn't red: "CHEQUERED" has "RED" in it.)
  assert.match(sheets, /\/CHEQUERED\/\.test\(flag\) \? 'var\(--q-text\)' : \/\\bRED\\b\/\.test\(flag\)/);
});
