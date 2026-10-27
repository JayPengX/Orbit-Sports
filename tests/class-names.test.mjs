// One class name, one part of the page. The F1 weekend sheet's 冠軍之爭 once
// took .tf-row and .tf-name, the 追蹤 cards' names, and its rules (no card,
// a 16 px first column) laid every followed team and player out wrong.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
const sheets = readFileSync(new URL('../public/sheets.js', import.meta.url), 'utf8');

test("追蹤's tf- classes are its own", () => {
  assert.equal(css.match(/^\.tf-row \{/gm)?.length, 1, '.tf-row is defined once, for 追蹤');
  assert.equal(css.match(/^\.tf-name \{/gm)?.length, 1, '.tf-name is defined once, for 追蹤');
  assert.doesNotMatch(sheets, /class: 'tf-/, 'the sheets use their own prefix (冠軍之爭 is fight-)');
});
