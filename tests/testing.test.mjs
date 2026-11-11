// 測試工具's switches (public/testing.mjs): with none on, today's games as read;
// each switch turns one game, the same one at every read.
import test from 'node:test';
import assert from 'node:assert/strict';
import { testDay, dayTested } from '../public/testing.mjs';
import { flagNow } from '../public/lib/f1.mjs';

const side = (id, score = '') => ({ id, score, winner: false });
const game = (id, state, start) => ({ id, league: 'nba', kind: 'match', start, home: side(`h${id}`, state === 'post' ? '101' : ''), away: side(`a${id}`, state === 'post' ? '99' : ''), status: { state, completed: state === 'post', detail: '', short: '' } });
const day = () => [game('1', 'pre', '2026-11-11T12:00:00Z'), game('2', 'post', '2026-11-11T01:00:00Z'), game('3', 'pre', '2026-11-11T14:00:00Z')];
const on = flags => (globalThis.ORBIT_TEST = { on: 1, flags });

test('no switch on: the same list, nothing held back', () => {
  delete globalThis.ORBIT_TEST;
  const list = day();
  assert.equal(testDay(list, true), list);
  assert.equal(dayTested(), false);
  assert.equal(flagNow({ track: { status: '1' } })?.kind, 'green');
});

test('each switch turns one of today’s games, the same one each read', () => {
  const now = Date.parse('2026-11-11T11:00:00Z');
  on({ liveGame: 1, startSoon: 'in10', gameOff: 'void' });
  assert.equal(dayTested(), true);
  const out = testDay(day(), true, now);
  assert.equal(out.find(e => e.id === '2').status.state, 'in');
  assert.equal(out.find(e => e.id === '1').start, '2026-11-11T11:10:00.000Z');
  assert.equal(out.find(e => e.id === '3').status.void, true);
  // Another read: the same games, and a past day's left as it was.
  assert.equal(testDay(day(), true, now).find(e => e.id === '2').status.state, 'in');
  assert.deepEqual(testDay(day(), false, now), day());
  on({ emptyDay: 1 });
  assert.deepEqual(testDay(day(), false, now), []);
  on({ f1Flag: 'red' });
  assert.equal(flagNow({ track: { status: '1' } })?.kind, 'red');
  delete globalThis.ORBIT_TEST;
});
