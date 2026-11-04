import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeGames } from '../public/lib/home-shown.mjs';

const g = (id, h, league = 'ucl') => ({ id, league, start: `2026-11-04T${String(h).padStart(2, '0')}:00:00+08:00`, status: { state: 'post' } });

test('首頁 never lists a game that is neither theirs nor filled, an ended small-hours one included (Jay 2026-11-04)', () => {
  const day = [g('a', 1), g('b', 4), g('mine', 10, 'nba'), g('fill', 20, 'epl')];
  const off = homeGames(day, { followed: e => e.id === 'mine' });
  assert.deepEqual(off.own.map(e => e.id), ['mine']);
  assert.deepEqual(off.filled, []);
  const on = homeGames(day, { followed: e => e.id === 'mine', filled: new Set(['epl:fill']) });
  assert.deepEqual(on.filled.map(e => e.id), ['fill']);
  assert.ok(![...on.own, ...on.filled].some(e => e.id === 'a' || e.id === 'b'));
});
