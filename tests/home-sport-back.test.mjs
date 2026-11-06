import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sportBack, sportDay } from '../public/lib/strip.mjs';

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

// Jay 2026-11-06: 足球 moved to tomorrow, then 籃球 stayed on tomorrow
// though today had a basketball game; 賽車 then 全部 didn't come back.
test('a sport opens on the day left from, not the day another sport moved to', () => {
  const basket = new Set(['2026-11-06', '2026-11-07']);
  // 足球 moved 11-06 → 11-07; the place kept is 11-06: 籃球 opens there.
  assert.equal(sportDay(basket, { from: '2026-11-06', today: '2026-11-06' }), '2026-11-06');
  // Not playing then: its next day on, else its latest.
  assert.equal(sportDay(new Set(['2026-11-21']), { from: '2026-11-06', today: '2026-11-06' }), '2026-11-21');
  assert.equal(sportDay(new Set(['2026-11-01']), { from: '2026-11-06', today: '2026-11-06' }), '2026-11-01');
  // A past day left from: its next from today.
  assert.equal(sportDay(new Set(['2026-11-05', '2026-11-08']), { from: '2026-11-04', today: '2026-11-06' }), '2026-11-08');
  assert.equal(sportDay(new Set(), { from: '2026-11-06', today: '2026-11-06' }), '2026-11-06');
});

test('足球 → 籃球 → 賽車 → 全部 comes back to the first day', () => {
  let kept = null;
  let date = '2026-11-06';
  const go = (from, to, moved) => {
    const way = sportBack(kept, { from, to, date, y: 300 });
    kept = way.kept;
    if (way.back) date = way.back.date;
    if (to) date = moved ? sportDay(moved, { from: kept?.date || date, today: '2026-11-06' }) : date;
  };
  go(false, true, new Set(['2026-11-07']));
  assert.equal(date, '2026-11-07');
  go(true, true, new Set(['2026-11-06', '2026-11-07']));
  assert.equal(date, '2026-11-06');
  go(true, true, new Set(['2026-11-21']));
  assert.equal(date, '2026-11-21');
  go(true, false);
  assert.equal(date, '2026-11-06');
});

test('the way back holds: the chip row never swipes the day, the jump uses the place kept, today over never moves it on', () => {
  assert.match(fn('homeFilters'), /day-filters[^']*', 'data-noswipe'/);
  assert.match(fn('pickFilter'), /sportDay\(days, \{ from: h\.kept\?\.date \|\| h\.date/);
  assert.match(fn('pickFilter'), /h\.backY = way\.back\.y;\s*\n(\s*\/\/.*\n)*\s*h\.autoDay = false/);
});
