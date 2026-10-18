// One rule for a result and a score, wherever it's shown (a form pill, a
// team's or player's last game, a final's notice, the win chance's end):
// lib/espn.mjs outcome / sideScore / resultFor, and never a made-up 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { outcome, sideScore, hasScore, resultFor, sidesFor, leagueForm } from '../public/lib/espn.mjs';

const side = (id, score, winner = false) => ({ id, score, winner });
const game = (h, a, extra = {}) => ({ id: 'g', league: 'epl', kind: 'match', start: '2026-10-04T14:00Z', status: { state: 'post' }, home: h, away: a, ...extra });

test('a score is a number to say; an empty one is no score (a dash), never a 0', () => {
  for (const v of ['0', 0, '3', 12, ' 2 ']) assert.equal(hasScore(v), true, String(v));
  for (const v of ['', ' ', null, undefined, '-', '--', 'TBD']) assert.equal(hasScore(v), false, String(v));
});

test('outcome: the feed’s winner first, else the scores; no scores, no result', () => {
  assert.equal(outcome(side('A', '2'), side('B', '1')), 'W');
  assert.equal(outcome(side('A', '1'), side('B', '2')), 'L');
  assert.equal(outcome(side('A', '1'), side('B', '1')), 'D');
  assert.equal(outcome(side('A', '0'), side('B', '0')), 'D');
  // Level after 120 minutes, through on penalties: the feed says who won.
  assert.equal(outcome(side('A', '1', true), side('B', '1')), 'W');
  assert.equal(outcome(side('A', '1'), side('B', '1', true)), 'L');
  // Scores not in (a list that has the state only): nothing, not 平手 (Number('') is 0) and not a loss.
  assert.equal(outcome(side('A', ''), side('B', '')), '');
  assert.equal(outcome(side('A', '2'), side('B', '')), '');
  assert.equal(outcome(null, side('B', '1')), '');
  // Numbers compared as numbers ("10" beats "9").
  assert.equal(outcome(side('A', '10'), side('B', '9')), 'W');
});

test('the score from a side’s own view (1-2 lost), as a player’s game log has it; none without both', () => {
  assert.equal(sideScore(side('A', '1'), side('B', '2')), '1-2');
  assert.equal(sideScore(side('A', 104), side('B', 113)), '104-113');
  assert.equal(sideScore(side('A', ''), side('B', '2')), '');
  assert.equal(sideScore(side('A', '3'), undefined), '');
});

test('resultFor and sidesFor: a game from either side, ids as text or numbers', () => {
  const g = game(side('10', '3'), side('20', '1'));
  assert.equal(resultFor(g, '10'), 'W');
  assert.equal(resultFor(g, 20), 'L');
  assert.deepEqual(sidesFor(g, 20), { home: false, us: g.away, them: g.home });
  // A final with no score in it: no result (it was 'L', a guess).
  assert.equal(resultFor(game(side('10', ''), side('20', '')), '10'), '');
});

test('a team’s form in one competition: its finals there, the last five, none under three; a called-off game left out', () => {
  const g = (i, league, state = 'post', extra = {}) => ({ id: String(i), league, kind: 'match', start: `2026-09-${String(10 + i).padStart(2, '0')}T14:00Z`, status: { state, ...extra }, home: side('1', '2'), away: side('2', '1') });
  const list = [g(1, 'epl'), g(2, 'ucl'), g(3, 'epl'), g(4, 'epl', 'post', { void: true }), g(5, 'epl'), g(6, 'epl', 'pre'), g(7, 'epl'), g(8, 'epl'), g(9, 'epl')];
  const form = leagueForm(list, '1', 'epl');
  assert.deepEqual(form.map(x => x.id), ['3', '5', '7', '8', '9']);
  assert.equal(leagueForm(list, '1', 'ucl'), null, 'one game there: the caller’s every-competition form');
  // Before a game: only what came before it.
  assert.deepEqual(leagueForm(list, '1', 'epl', Date.parse('2026-09-16T00:00Z')).map(x => x.id), ['1', '3', '5']);
});
