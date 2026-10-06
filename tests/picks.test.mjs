import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreMatch, dayPlan, clash, tableIndex, tableStarted, bigGame } from '../public/lib/picks.mjs';

const at = h => new Date(Date.UTC(2026, 9, 3, h)).toISOString();
const side = (id, name) => ({ id, name, short: name });
const match = (league, id, h, away, home, extra = {}) => ({ id, league, kind: 'match', start: at(h), status: { state: 'pre' }, away, home, ...extra });
const NOW = Date.UTC(2026, 9, 3, 0);

test('a followed team outweighs everything; the first league counts more', () => {
  const ctx = { leagues: ['mlb', 'epl'], follows: [{ league: 'epl', id: '1', name: 'Arsenal' }], now: NOW };
  const ars = scoreMatch(match('epl', 'a', 11, side('1', 'Arsenal'), side('2', 'Fulham')), ctx);
  const mlb = scoreMatch(match('mlb', 'b', 11, side('3', 'Mets'), side('4', 'Braves')), ctx);
  const epl = scoreMatch(match('epl', 'c', 11, side('5', 'Brentford'), side('6', 'Everton')), ctx);
  assert.ok(ars.score > mlb.score);
  assert.equal(ars.reasons[0], 'team');
  assert.ok(mlb.score > epl.score, 'MLB comes first for this person');
  assert.ok(mlb.reasons.includes('priority'));
});

test('the table: a meeting at the top beats the bottom', () => {
  const tables = { epl: tableIndex([{ rows: Array.from({ length: 20 }, (_, i) => ({ id: String(i + 1) })) }]) };
  const ctx = { leagues: ['epl'], tables, now: NOW };
  const top = scoreMatch(match('epl', 'a', 11, side('1', 'A'), side('2', 'B')), ctx);
  const low = scoreMatch(match('epl', 'b', 11, side('19', 'S'), side('20', 'T')), ctx);
  assert.ok(top.score > low.score);
  assert.ok(top.reasons.includes('topClash'));
  assert.ok(low.reasons.includes('close'));
});

test('the plan never clashes, and runs in time order', () => {
  const ctx = { leagues: ['epl', 'nba'], now: NOW };
  const events = [
    match('epl', 'a', 11, side('1', 'A'), side('2', 'B')),
    match('epl', 'b', 11, side('3', 'C'), side('4', 'D')),
    match('epl', 'c', 14, side('5', 'E'), side('6', 'F')),
    match('nba', 'd', 23, side('7', 'G'), side('8', 'H')),
    match('epl', 'x', 9, side('9', 'I'), side('10', 'J'), { status: { state: 'post' } })
  ];
  const { plan, also } = dayPlan(events, ctx);
  for (let i = 0; i < plan.length; i++) for (let j = i + 1; j < plan.length; j++) assert.equal(clash(plan[i].event, plan[j].event), false);
  assert.deepEqual(plan.map(p => p.event.start), [...plan.map(p => p.event.start)].sort());
  assert.equal(plan.length, 3);
  assert.equal(also.length, 1);
  assert.ok(!plan.concat(also).some(p => p.event.id === 'x'), 'finished games are not picks');
});

test('a play-off or series game is worth staying up for', () => {
  assert.ok(bigGame({ note: 'NLWC - Game 3', stage: { key: 'post' } }));
  assert.ok(!bigGame({ note: '', stage: { key: 'regular' } }));
});


test('live: a close game late on is the one to switch to, a rout drops; evenings beat working hours', () => {
  const ctx = { leagues: ['nba', 'mlb'], now: NOW };
  const live = (league, id, period, hs, as) => match(league, id, 0, { ...side('1', 'A'), score: String(as) }, { ...side('2', 'B'), score: String(hs) }, { status: { state: 'in', period } });
  const tight = scoreMatch(live('mlb', 'a', 8, 3, 2), ctx);
  const rout = scoreMatch(live('mlb', 'b', 8, 10, 1), ctx);
  const early = scoreMatch(live('mlb', 'c', 2, 1, 0), ctx);
  assert.ok(tight.score > early.score && early.score > rout.score);
  assert.deepEqual(tight.reasons.slice(0, 2), ['live', 'tight']);
  // Friday 3 Oct 2026, Taiwan time: 20:00 against 11:00.
  const evening = scoreMatch(match('mlb', 'd', 12, side('1', 'A'), side('2', 'B')), ctx);
  const office = scoreMatch(match('mlb', 'e', 3, side('1', 'A'), side('2', 'B')), ctx);
  assert.ok(evening.score > office.score);
});

test('a table before its first game gives no places (a preseason: every row 0-0)', () => {
  const zero = [{ name: 'East', rows: [{ id: 'atl', stats: { W: '0', L: '0', GB: '-' } }, { id: 'bos', stats: { W: '0', L: '0', GB: '-' } }] }];
  assert.equal(tableStarted(zero[0]), false);
  assert.deepEqual(tableIndex(zero), {});
  const begun = [{ name: 'East', rows: [{ id: 'bos', stats: { W: '1', L: '0' } }, { id: 'atl', stats: { W: '0', L: '1' } }] }];
  assert.equal(tableIndex(begun).atl.pos, 2);
  // A table without counts (a driver's points) is never held back.
  assert.equal(tableStarted({ rows: [{ id: 'x', stats: { PTS: '0' } }] }), true);
});
