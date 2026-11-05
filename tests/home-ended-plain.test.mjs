import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 首頁's 已結束 is all their own games: never lit grey or marked ★ 推薦 row by
// row (Jay 2026-11-05, 10/31's four games: "only this page is marked all grey weird").
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../public/ui.js', import.meta.url), 'utf8');

test('eventRow takes mark: false and then never lights or marks a row', () => {
  assert.match(ui, /export function eventRow\(e, \{[^}]*mark = true[^}]*\}/);
  assert.match(ui, /pickKind\(mark && \(/);
});

test('every 已結束 list on 首頁 draws its rows unmarked', () => {
  assert.match(app, /const endedRow = \{ \.\.\.rowDay, mark: false \}/);
  const body = app.slice(app.indexOf('const endedRow'), app.indexOf('function recapList'));
  assert.doesNotMatch(body, /recapList\(g, rowDay\)/);
  assert.doesNotMatch(body, /eventRow\(e, rowDay\)\) : null, games\.length > h\.shown/);
  assert.equal((body.match(/recapList\(g, endedRow\)/g) || []).length, 2);
  assert.match(body, /games\.slice\(0, h\.shown\)\.map\(e => eventRow\(e, endedRow\)\)/);
});
