// A live NBA game's head: each side's timeouts left as bars under its record
// (Jay 2026-11-11, Celtics–76ers at halftime: ESPN's header said 0 left and 0
// used for both, so the line drew no bars at all, only 加罰). Counted from
// the game's plays where the header has none. And 賽前看點 (why the game
// matters: the table) stays while the game is on (Jay, the same day).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSummary } from '../public/lib/espn.mjs';
import { nbaTimeouts } from '../public/lib/plays.mjs';

const raw = JSON.parse(readFileSync(new URL('./fixtures/nba-halftime-no-timeouts.json', import.meta.url), 'utf8'));

test("ESPN's header with no timeouts: each side's counted from its plays (two taken each, five left of seven)", () => {
  const sm = parseSummary(raw, 'nba');
  assert.equal(sm.status.state, 'in');
  for (const side of [sm.home, sm.away]) assert.deepEqual([side.timeouts, side.timeoutsUsed], [5, 2], side.name);
});

test("a header with real counts is ESPN's own", () => {
  const ok = structuredClone(raw);
  for (const c of ok.header.competitions[0].competitors) Object.assign(c, { timeoutsRemaining: 4, timeoutsUsed: 3 });
  const sm = parseSummary(ok, 'nba');
  assert.deepEqual([sm.home.timeouts, sm.away.timeouts], [4, 4]);
});

test("the NBA's rule: seven, at most four in the 4th and two after its 3:00 mark; an overtime two", () => {
  const t = (periodNum, clock, team = '2') => ({ type: 'Full Timeout', text: 'Celtics Full timeout', team, periodNum, clock });
  assert.deepEqual(nbaTimeouts([], '2', { period: 1, clock: '12:00' }), { left: 7, used: 0 });
  assert.deepEqual(nbaTimeouts([t(1, '7:00'), t(2, '3:00'), t(2, '1:00', '20')], '2', { period: 3, clock: '5:00' }), { left: 5, used: 2 });
  assert.equal(nbaTimeouts([t(1, '7:00')], '2', { period: 4, clock: '9:00' }).left, 4, 'six left, four at most in the 4th');
  assert.equal(nbaTimeouts([t(4, '8:00')], '2', { period: 4, clock: '2:40' }).left, 2, 'two at most after 3:00');
  assert.equal(nbaTimeouts([t(4, '2:50'), t(4, '1:10')], '2', { period: 4, clock: '0:40' }).left, 0);
  assert.deepEqual(nbaTimeouts([t(4, '1:00'), t(5, '3:00')], '2', { period: 5, clock: '2:00' }), { left: 1, used: 1 });
  assert.equal(nbaTimeouts([{ type: 'Official Timeout', text: 'Official timeout', team: '2', periodNum: 1, clock: '6:00' }], '2', { period: 1 }).left, 7, "an official timeout is no side's");
});

test('賽前看點 is drawn before the game and while it is on, not once it is over', () => {
  const src = readFileSync(new URL('../public/sheets.js', import.meta.url), 'utf8');
  assert.match(src, /const why = \(d\?\.status \|\| e\.status\)\.state !== 'post' \? previewLine\(/);
});
