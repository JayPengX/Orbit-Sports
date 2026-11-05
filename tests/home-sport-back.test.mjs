import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sportBack } from '../public/lib/strip.mjs';

// Jay 2026-11-05: a sport's chip on 首頁 moves to a day it plays; 全部 or
// 我的比賽 after it goes back to the day (and the place) he was on.
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const fn = name => {
  const at = app.search(new RegExp(`(async )?function ${name}\\(`));
  assert.ok(at >= 0, name);
  return app.slice(at, app.indexOf('\n}\n', at));
};

test('全部 → a sport keeps the place; back to 全部 or 我的比賽 returns to it', () => {
  const out = sportBack(null, { from: false, to: true, date: '2026-11-05', y: 420 });
  assert.deepEqual(out, { kept: { date: '2026-11-05', y: 420 }, back: null });
  // A sport to another: still the first place.
  const next = sportBack(out.kept, { from: true, to: true, date: '2026-11-08', y: 0 });
  assert.deepEqual(next.kept, { date: '2026-11-05', y: 420 });
  const home = sportBack(next.kept, { from: true, to: false, date: '2026-11-08', y: 0 });
  assert.deepEqual(home, { kept: null, back: { date: '2026-11-05', y: 420 } });
});

test('a day picked on a sport stays: nothing to go back to', () => {
  assert.deepEqual(sportBack(null, { from: true, to: false, date: '2026-11-09', y: 0 }), { kept: null, back: null });
  // 全部 ↔ 我的比賽 moves nothing.
  assert.deepEqual(sportBack(null, { from: false, to: false, date: '2026-11-05', y: 300 }), { kept: null, back: null });
});

test('首頁 wires it: the chip goes back, a day picked drops it, the scroll comes back once drawn', () => {
  assert.match(fn('pickFilter'), /sportBack\(h\.kept/);
  assert.match(fn('pickFilter'), /h\.date = way\.back\.date/);
  assert.match(fn('pickHomeDay'), /h\.kept = null/);
  assert.match(fn('renderHome'), /h\.backY != null && slot\.drawn/);
});
