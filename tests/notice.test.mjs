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
