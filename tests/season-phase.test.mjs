import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seasonPhase } from '../public/lib/espn.mjs';

const board = (type, events) => ({ leagues: [{ season: { type: { type, name: type === 2 ? 'Regular Season' : 'Postseason' } } }], events: events.map(t => ({ season: { type: t } })) });

test("a season ESPN leaves at 'Regular Season' after its playoffs is in its postseason (MLB 11-12: the World Series its latest game, its bracket drawn as a prediction)", () => {
  assert.equal(seasonPhase(board(2, [3])), 'post');
  // The regular season's own games, or none: as ESPN says.
  assert.equal(seasonPhase(board(2, [2, 2])), 'regular');
  assert.equal(seasonPhase(board(2, [])), 'regular');
  assert.equal(seasonPhase(board(2, [2, 3])), 'regular');
  assert.equal(seasonPhase(board(3, [])), 'post');
});
