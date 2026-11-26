import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');

// Jay 2026-11-26, a series' three picks: "sometimes it greys it out, sometimes it doesn't, be consistent".
test('a pick is its 推薦 pill alone: no list greys its row', () => {
  assert.doesNotMatch(css, /\.picked[^{,]*\{[^}]*background(-image)?: (var\(--q-fill|linear-gradient)/);
  assert.doesNotMatch(css, /:has\([^)]*\.picked[^)]*\)\s*\{[^}]*background/);
});
