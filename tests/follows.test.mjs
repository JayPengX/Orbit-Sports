import test from 'node:test';
import assert from 'node:assert/strict';
import { matchOnly, endedFollows, WAIT } from '../public/lib/follows.mjs';

// Jay 2026-11-03: New England v Miami followed, nothing else of MLS; 首頁 led with Atlanta v Toronto.
test("a followed match's league brings only that match", () => {
  const games = [{ league: 'mls', id: 'ne-mia' }];
  const own = new Set(['epl', 'nba']);
  assert.equal(matchOnly({ league: 'mls', id: 'atl-tor' }, own, games), true);
  assert.equal(matchOnly({ league: 'mls', id: 'ne-mia' }, own, games), false);
  assert.equal(matchOnly({ league: 'epl', id: 'liv-mci' }, own, games), false, 'a league of theirs');
  assert.equal(matchOnly({ league: 'mls', id: 'atl-tor' }, new Set(['mls']), games), false, 'MLS followed too');
  assert.equal(matchOnly({ league: 'laliga', id: 'x' }, own, games), false, "another league: the others'");
});

test('a followed match over is let go once its final has surely been told', () => {
  const t0 = Date.parse('2026-11-02T02:00:00Z');
  const start = '2026-11-02T00:00:00Z';
  const games = [{ league: 'mls', id: '1', start }, { league: 'mls', id: '2', start }, { league: 'mls', id: '3', start }, { league: 'mls', id: '4', start }];
  const state = { '1': 'post', '2': 'in', '3': 'pre', '4': 'post' };
  const fresh = g => ({ ...g, status: { state: state[g.id], ...(g.id === '4' ? { void: true } : {}) } });
  const seen = new Map();
  // Just over: kept till the Worker has had its look.
  assert.deepEqual([...endedFollows(games, { fresh, seen, now: t0 })], []);
  assert.deepEqual([...endedFollows(games, { fresh, seen, now: t0 + WAIT })], ['mls:1']);
  // The app told it itself: at once.
  assert.deepEqual([...endedFollows(games, { fresh, told: new Set(['mls:1']), seen: new Map(), now: t0 })], ['mls:1']);
  // Opened long after (the Worker stopped asking 8 hours after the start): at once.
  assert.deepEqual([...endedFollows(games, { fresh, seen: new Map(), now: Date.parse(start) + 8 * 3_600_000 })], ['mls:1']);
  // Called off: kept.
  assert.ok(![...endedFollows(games, { fresh, seen: new Map(), now: t0 + 9 * 3_600_000 })].includes('mls:4'));
});
