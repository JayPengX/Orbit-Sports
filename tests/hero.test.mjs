// A driver's last five races were cut to three: the row sat in the head's
// narrow text column (beside the photo and 追蹤) with its overflow hidden.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
const js = readFileSync(new URL('../public/sheets.js', import.meta.url), 'utf8');
const rule = sel => css.match(new RegExp(`(?:^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] || '';

test("a driver's last races span the whole head and never clip", () => {
  const races = rule('.hero-races');
  assert.match(races, /grid-column:\s*1\s*\/\s*-1/);
  assert.doesNotMatch(races, /overflow:\s*hidden/);
  // A row of the head itself, after the follow button, not inside its text column.
  assert.match(js, /followBtn,\s*\n\s*lastFive\.length\s*\n\s*\?\s*el\('div', \{ class: 'hero-races' \}/);
});
