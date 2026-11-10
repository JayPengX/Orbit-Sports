// 賽後三句話's why line (lib/why.mjs): where it's kept and which one is read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recapDays, whyFrom, recapPath } from '../public/lib/why.mjs';

test('a game’s why line: its Taiwan day, then the next; the reader’s language', () => {
  assert.deepEqual(recapDays({ start: '2026-11-10T02:30Z' }), ['2026-11-10', '2026-11-11']);
  assert.deepEqual(recapDays({ start: '2026-11-10T17:00Z' }), ['2026-11-11', '2026-11-12'], 'past 16:00 UTC is Taiwan’s next day');
  assert.equal(recapPath('2026-11-10'), 'sports/recaps/2026-11-10.json');
  const doc = { games: { 'nba:9': { zh: '詹姆斯最後 1 分鐘的三分球逆轉戰局。', en: 'James’s late three turned it.' }, 'nba:8': null } };
  const e = { league: 'nba', id: '9' };
  assert.equal(whyFrom(doc, e), '詹姆斯最後 1 分鐘的三分球逆轉戰局。');
  assert.equal(whyFrom(doc, e, true), 'James’s late three turned it.');
  assert.equal(whyFrom(doc, { league: 'nba', id: '8' }), '', 'let go: none');
  assert.equal(whyFrom(null, e), '');
});
