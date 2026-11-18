// A first opening waits for every module app.js imports before it asks for a
// single game (on a slow link, 15 s for 560 KB of code, 11-18). The game
// sheets and the tables (sheets.js and what only it uses, 240 KB of it) are
// read when first wanted: never imported by 首頁's code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = f => readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8');
const imports = src => [...src.matchAll(/^\s*import\s[^'"]*?from\s+['"](\.[^'"]+)['"]/gm)].map(m => m[1].replace(/^\.\//, ''));

test('首頁 code never imports the sheets: they are read when first wanted', () => {
  const seen = new Set();
  const walk = f => {
    if (seen.has(f)) return;
    seen.add(f);
    for (const g of imports(read(f))) walk(new URL(g, new URL(`file:///x/${f}`)).pathname.slice(3));
  };
  walk('app.js');
  assert.ok(!seen.has('sheets.js'), [...seen].filter(f => f.includes('sheet')).join(', '));
  assert.match(read('app.js'), /import\('\.\/sheets\.js'\)/);
});
