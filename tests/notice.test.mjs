import test from 'node:test';
import assert from 'node:assert/strict';
import { transition } from '../public/lib/notice.mjs';
import { freshGame, noteLatest, parseStatus } from '../public/lib/espn.mjs';

const st = (state, name = '', extra = {}) => parseStatus({ type: { state, name, completed: state === 'post', ...extra } });

test('delayed, then in progress, then final: one start, one end', () => {
  assert.equal(transition('pre', st('pre', 'STATUS_DELAYED')), null);
  assert.equal(transition('pre', st('in', 'STATUS_IN_PROGRESS')), 'start');
  assert.equal(transition('in', st('in', 'STATUS_RAIN_DELAY')), null);
  assert.equal(transition('in', st('post', 'STATUS_FINAL')), 'end');
});

test('a postponed, canceled or suspended game is never announced as a final', () => {
  assert.equal(transition('pre', st('post', 'STATUS_POSTPONED')), null);
  assert.equal(transition('pre', st('post', 'STATUS_CANCELED')), null);
  assert.equal(transition('in', st('post', 'STATUS_SUSPENDED')), null);
});

test('a postponed game moved to a new day is no longer postponed', () => {
  const base = { kind: 'match', league: 'mlb', id: '9001', home: { id: '1' }, away: { id: '2' } };
  const old = { ...base, start: '2026-10-10T00:00Z', status: st('post', 'STATUS_POSTPONED') };
  const moved = { ...base, start: '2026-10-12T00:00Z', status: st('pre', 'STATUS_SCHEDULED') };
  noteLatest([moved]);
  assert.equal(freshGame(old).status.void, false);
});

// A game's notice opens that game (Jay 2026-11-06): its address round-trips.
import { gameHash, readGameHash } from '../public/lib/notice.mjs';
test('a game notice points at the game', () => {
  const h = gameHash({ league: 'eng.1', id: '740/9' }, '2026-11-06');
  assert.equal(h, 'game=eng.1/740%2F9/2026-11-06');
  assert.deepEqual(readGameHash(`#${h}`), { league: 'eng.1', id: '740/9', day: '2026-11-06' });
  assert.deepEqual(readGameHash('game=nba/401'), { league: 'nba', id: '401', day: null });
  assert.equal(readGameHash('#live'), null);
  assert.equal(gameHash({ league: 'nba', id: '1' }, 'bad'), 'game=nba/1');
});
