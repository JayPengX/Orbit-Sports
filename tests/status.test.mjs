// A game's or a session's state: one rule for every view of it
// (lib/espn.mjs onAir, dueToStart, sessionStatus, feedStatus, settleField),
// and the days and hours a game is filed under.
import test from 'node:test';
import assert from 'node:assert/strict';
import { onAir, dueToStart, sessionStatus, feedStatus, feedEnded, feedOnAt, settleField, splitWeekend, titlesAt, usDayOf, pastPage, startOf, parseStatus, overByRule, seriesWinner, decidedSide, settleSeries, favChance } from '../public/lib/espn.mjs';

const now = Date.parse('2026-10-11T10:05:00Z');
const g = (state, start, extra = {}) => ({ kind: 'match', start, status: { state, ...(extra.status || {}) }, ...extra });

test('on air: under way, or its start come and not three hours gone; never called off', () => {
  assert.equal(onAir(g('in', '2026-10-11T02:00Z'), now), true, 'ESPN says on: on, however long');
  assert.equal(onAir(g('pre', '2026-10-11T10:00Z'), now), true);
  assert.equal(onAir(g('pre', '2026-10-11T07:05:01Z'), now), true);
  assert.equal(onAir(g('pre', '2026-10-11T07:05Z'), now), false, 'three hours past its start and never begun');
  assert.equal(onAir(g('pre', '2026-10-11T10:06Z'), now), false);
  assert.equal(onAir(g('post', '2026-10-11T09:00Z'), now), false, 'a game over is never on');
  assert.equal(onAir(g('in', '2026-10-11T10:00Z', { status: { void: true } }), now), false);
  assert.equal(onAir(null, now), false);
});

test('a game whose hour isn’t set is never on air nor due on a stand-in’s clock; ELTA’s slot is a time', () => {
  // A playoff game dated before its hour: ESPN's midnight in New York, placed at 20:00 there (08:00 here), 待定.
  const tbd = g('pre', '2026-10-11T10:00Z', { timeTbd: true });
  assert.equal(onAir(tbd, now), false);
  assert.equal(dueToStart(tbd, now), false);
  // ESPN says it's on: on.
  assert.equal(onAir({ ...tbd, status: { state: 'in' } }, now), true);
  // Its time from ELTA's list (timeFrom): a real slot.
  assert.equal(onAir({ ...tbd, timeFrom: 'elta' }, now), true);
  assert.equal(dueToStart({ ...tbd, timeFrom: 'elta' }, now), true);
});

test('due to start: a minute away or passed (up to 3 h), still said to come', () => {
  assert.equal(dueToStart(g('pre', '2026-10-11T10:05:30Z'), now), true);
  assert.equal(dueToStart(g('pre', '2026-10-11T10:07Z'), now), false);
  assert.equal(dueToStart(g('in', '2026-10-11T10:00Z'), now), false);
  assert.equal(dueToStart(g('pre', '2026-10-11T06:00Z'), now), false);
});

test('a session’s state: F1’s feed over ESPN’s, and a session long past its start over', () => {
  const x = (abbr, start, state) => ({ abbr, start, status: { state, detail: '', short: '' } });
  // ESPN still "on" four hours after the start: over.
  assert.equal(sessionStatus(x('FP1', '2026-10-11T05:00Z', 'in'), now).state, 'post');
  assert.equal(sessionStatus(x('FP1', '2026-10-11T05:00Z', 'pre'), now).state, 'post');
  assert.equal(sessionStatus(x('Race', '2026-10-11T09:00Z', 'in'), now).state, 'in');
  // F1's feed called it over: over at once, whatever ESPN says.
  feedEnded.add('Qual|2026-10-11T09:30Z');
  assert.equal(sessionStatus(x('Qual', '2026-10-11T09:30Z', 'in'), now).state, 'post');
  assert.equal(sessionStatus(x('Qual', '2026-10-11T09:30Z', 'in'), now).detail, 'Final');
  // Between a qualifying's parts, ESPN calling it over: on while the feed said so lately.
  feedOnAt.set('SQ|2026-10-11T09:45Z', Date.now());
  assert.equal(feedStatus('SQ', '2026-10-11T09:45Z', { state: 'post' }).state, 'in');
  feedOnAt.set('SQ|2026-10-11T09:45Z', Date.now() - 5 * 60_000);
  assert.equal(feedStatus('SQ', '2026-10-11T09:45Z', { state: 'post' }).state, 'post');
  // A session without a start: as ESPN has it.
  assert.equal(sessionStatus({ abbr: 'FP2', start: undefined, status: { state: 'pre' } }, now).state, 'pre');
});

test('a race weekend over once its last session has had its time; the session on or next is `at`', () => {
  const s = (abbr, start, state) => ({ abbr, name: abbr, start, status: { state } });
  const e = { id: 'w', league: 'f1', kind: 'field', start: '2026-10-09T08:30Z', status: { state: 'in' }, sessions: [s('FP1', '2026-10-09T08:30Z', 'post'), s('Qual', '2026-10-10T13:00Z', 'pre'), s('Race', '2026-10-11T12:00Z', 'pre')] };
  const sat = settleField(e, Date.parse('2026-10-10T12:00Z'));
  assert.deepEqual([sat.status.state, sat.at, sat.session], ['pre', '2026-10-10T13:00Z', 'Qual'], 'between sessions: not on');
  const over = settleField(e, Date.parse('2026-10-11T17:00Z'));
  assert.equal(over.status.state, 'post', 'ESPN still says to come; its last session is long past');
  // A session on: the weekend's on.
  assert.equal(settleField({ ...e, sessions: [s('Race', '2026-10-11T12:00Z', 'in')] }, Date.parse('2026-10-11T12:30Z')).status.state, 'in');
  // Not a weekend: as it is.
  const m = g('pre', '2026-10-11T12:00Z');
  assert.equal(settleField(m), m);
});

test('a sprint weekend’s sessions each an event, at the titles’ time, schedules on the official one', () => {
  const s = (abbr, start, state = 'pre') => ({ abbr, name: abbr, start, status: { state }, field: [] });
  const e = { id: '9', league: 'f1', kind: 'field', name: 'United States Grand Prix', start: '2026-10-16T17:30Z', status: { state: 'pre' }, sessions: [s('FP1', '2026-10-16T17:30Z'), s('SQ', '2026-10-16T21:30Z'), s('SR', '2026-10-17T18:00Z'), s('Qual', '2026-10-17T22:00Z'), s('Race', '2026-10-18T20:00Z')] };
  const list = splitWeekend(e, Date.parse('2026-10-16T00:00Z'));
  assert.deepEqual(list.map(x => x.sessionKey), ['FP1', 'SQ', 'SR', 'Qual', 'Race']);
  assert.deepEqual(list.map(x => x.official), e.sessions.map(x => x.start));
  assert.deepEqual(list.map(x => Date.parse(x.official) - Date.parse(x.start)), [4, 4, 5, 4, 5].map(m => m * 60_000));
  assert.ok(list.every(x => x.weekend === '9' && x.id === `9~${x.sessionKey}`));
  assert.equal(titlesAt('nba', 'Race', '2026-10-18T20:00Z'), '2026-10-18T20:00Z', 'only F1 has titles');
  assert.equal(titlesAt('f1', 'XYZ', '2026-10-18T20:00Z'), '2026-10-18T20:00Z');
});

test('the ESPN day page a game is on: New York’s date, summer time and winter time alike', () => {
  // 22:30 EDT on the 4th is 02:30Z on the 5th: the 4th's page.
  assert.equal(usDayOf('2026-10-05T02:30Z'), '20261004');
  // 22:30 EST on 1 Dec is 03:30Z on the 2nd.
  assert.equal(usDayOf('2026-12-02T03:30Z'), '20261201');
  assert.equal(usDayOf('2026-12-02T05:00Z'), '20261202');
  // The night the clocks go back (1 Nov 2026, 02:00 EDT → 01:00 EST).
  assert.equal(usDayOf('2026-11-01T04:30Z'), '20261101');
  assert.equal(usDayOf('2026-11-01T03:59Z'), '20261031');
  assert.equal(usDayOf('not a date'), '');
});

test('a play-off game dated before its hour: placed at 20:00 New York, its time 待定, in summer and winter', () => {
  assert.deepEqual(startOf('2026-10-14T04:00Z', { timeValid: false }), { start: '2026-10-15T00:00:00.000Z', timeTbd: true });
  assert.deepEqual(startOf('2026-12-14T05:00Z', { timeValid: false }), { start: '2026-12-15T01:00:00.000Z', timeTbd: true });
  // Any other hour stays as given (still 待定).
  assert.deepEqual(startOf('2026-10-14T18:00Z', { timeValid: false }), { start: '2026-10-14T18:00Z', timeTbd: true });
  assert.deepEqual(startOf('2026-10-14T18:00Z', {}), { start: '2026-10-14T18:00Z' });
  assert.deepEqual(startOf('', { timeValid: false }), { start: '' });
});

test('a page over for good: a day two or more back, or a month before that day’s', () => {
  const at = Date.parse('2026-10-11T12:00Z');
  assert.equal(pastPage('20261008', at), true);
  assert.equal(pastPage('20261009', at), false);
  assert.equal(pastPage('20261011', at), false);
  assert.equal(pastPage('202609', at), true);
  assert.equal(pastPage('202610', at), false);
  assert.equal(pastPage('', at), false);
});

test('statuses: called off is void; a final by the rules only when the rules settle it', () => {
  assert.equal(parseStatus({ type: { name: 'STATUS_CANCELED', state: 'post' } }).void, true);
  assert.equal(parseStatus({ type: { name: 'STATUS_ABANDONED', state: 'post' } }).void, true);
  assert.equal(parseStatus({ type: { name: 'STATUS_FORFEIT', state: 'post' } }).void, true);
  assert.deepEqual([parseStatus(undefined).state, parseStatus(undefined).void], ['pre', false]);
  const st = (short, period, name = 'STATUS_IN_PROGRESS') => ({ state: 'in', name, period, short, detail: short, void: false });
  // No score in yet: never over (Number('') would read 0-0).
  assert.equal(overByRule(st('End of 4th', 4, 'STATUS_END_PERIOD'), { score: '' }, { score: '' }, 'nba').state, 'in');
  // Extra innings: the home side ahead in the middle of the 11th can't be (it's only batting then), the end of the 11th apart is.
  assert.equal(overByRule(st('End 11th', 11), { score: '3' }, { score: '2' }, 'mlb').state, 'post');
  assert.equal(overByRule(st('Top 9th', 9), { score: '3' }, { score: '2' }, 'mlb').state, 'in');
  // Called off: as it is.
  const off = { ...st('End of 4th', 4, 'STATUS_END_PERIOD'), void: true };
  assert.equal(overByRule(off, { score: '1' }, { score: '2' }, 'nba'), off);
  // Soccer and CPBL: never by rule.
  assert.equal(overByRule(st("90'+4'", 2), { score: '1' }, { score: '2' }, 'epl').state, 'in');
  assert.equal(overByRule(st('End 9th', 9), { score: '1' }, { score: '2' }, 'cpbl').state, 'in');
  // Basketball's halves (two of them): over at the end of the 2nd.
  assert.equal(overByRule(st('End of 2nd Half', 2, 'STATUS_END_PERIOD'), { score: '60' }, { score: '58' }, 'nba').state, 'post');
  assert.equal(overByRule(st('End of 1st Half', 1, 'STATUS_END_PERIOD'), { score: '30' }, { score: '28' }, 'nba').state, 'in');
});

test('a series: its winner once won; a placeholder ("CLE/CHW") becomes the winner; nothing guessed before', () => {
  const e = (id, state, wins, completed, home = { id: '1', abbr: 'CLE' }, away = { id: '2', abbr: 'CHW' }, extra = {}) => ({ id, league: 'mlb', kind: 'match', start: '2026-10-01T00:00Z', note: '', status: { state }, round: { key: 'RD16' }, series: { completed, games: 3, wins }, home, away, ...extra });
  assert.equal(seriesWinner(e('a', 'post', { 1: 1, 2: 1 }, false)), null, 'not won yet');
  assert.equal(seriesWinner(e('a', 'in', { 1: 2, 2: 0 }, true)), null, 'the game itself not over');
  assert.equal(seriesWinner(e('a', 'post', { 1: 0, 2: 2 }, true)).id, '2');
  const tbd = { id: '-2', abbr: 'CLE/CHW', name: 'TBD', homeAway: 'away', order: 1 };
  assert.equal(decidedSide('mlb', tbd), tbd, 'before the series is settled: as it is');
  settleSeries([e('b', 'post', { 1: 0, 2: 2 }, true)]);
  const w = decidedSide('mlb', tbd);
  assert.deepEqual([w.id, w.abbr, w.score, w.homeAway], ['2', 'CHW', '', 'away']);
  assert.equal(decidedSide('mlb', { id: '7', abbr: 'NYY' }).id, '7', 'a real side stays');
});

test('the favourite’s chance from the prices ESPN shows; none without them', () => {
  assert.equal(favChance({}), null);
  assert.equal(favChance({ odds: [{ details: 'MNC -425' }] }), 0.81);
  assert.equal(favChance({ odds: [{ details: 'EVEN' }] }), null);
  assert.equal(favChance({ odds: [{ homeTeamOdds: { moneyLine: -150 }, awayTeamOdds: { moneyLine: 130 } }] }), 0.58);
  // A three-way price: the draw takes its share.
  assert.ok(favChance({ odds: [{ homeTeamOdds: { moneyLine: 140 }, awayTeamOdds: { moneyLine: 190 }, drawOdds: { moneyLine: 230 } }] }) < 0.45);
});

test('a weekend’s state by its sessions’ one rule: F1’s feed calling the race over ends the weekend at once', () => {
  const s = (abbr, start, state) => ({ abbr, name: abbr, start, status: { state } });
  const e = { id: 'w2', league: 'f1', kind: 'field', start: '2026-10-23T18:30Z', status: { state: 'in' }, sessions: [s('Qual', '2026-10-24T22:00Z', 'post'), s('Race', '2026-10-25T20:00Z', 'in')] };
  const at = Date.parse('2026-10-25T21:50Z');
  assert.equal(settleField(e, at).status.state, 'in', 'ESPN says on, the feed hasn’t said');
  feedEnded.add('Race|2026-10-25T20:00Z');
  assert.equal(settleField(e, at).status.state, 'post');
  assert.equal(sessionStatus(e.sessions[1], at).state, 'post', 'the same as the session’s own card');
});
