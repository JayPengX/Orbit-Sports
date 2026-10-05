import test from 'node:test';
import assert from 'node:assert/strict';
import { liveOf, liveLabel, liveNote } from '../public/lib/live.mjs';
import { parseScoreboard } from '../public/lib/espn.mjs';

const status = (name, shortDetail, period, displayClock = '0:00') => ({ period, displayClock, type: { name, state: 'in', shortDetail, detail: shortDetail } });
const side = (id, homeAway, score) => ({ id, homeAway, score, team: { id, displayName: `Team ${id}`, shortDisplayName: `T${id}`, abbreviation: `T${id}` } });
const board = (sport, st, comp) => ({ events: [{ id: '1', date: '2026-09-29T00:00Z', name: 'A at B', status: st, competitions: [{ competitors: [side('10', 'home', '3'), side('20', 'away', '2')], status: st, ...comp }] }] });

test('baseball: the half inning, the count, outs, runners, batter and pitcher', () => {
  const [e] = parseScoreboard(board('baseball', status('STATUS_IN_PROGRESS', 'Bot 7th', 7), { situation: { balls: 2, strikes: 1, outs: 2, onFirst: true, onThird: true, batter: { athlete: { shortName: 'S. Ohtani' } }, pitcher: { athlete: { shortName: 'Z. Wheeler' } } } }), 'mlb');
  assert.deepEqual(e.live.bases, [true, false, true]);
  assert.equal(liveLabel(e, 'baseball'), '7局下');
  assert.equal(liveLabel(e, 'baseball', 'en'), 'Bot 7th');
  assert.equal(liveNote(e, 'baseball'), '2壞1好 2出局 · S. Ohtani vs Z. Wheeler');
});

test('soccer: the minute, extra time, the latest goal', () => {
  const details = [
    { scoringPlay: true, clock: { displayValue: "23'" }, team: { id: '10' }, athletesInvolved: [{ shortName: 'Saka' }] },
    { redCard: true, clock: { displayValue: "40'" }, team: { id: '20' }, athletesInvolved: [{ shortName: 'Rice' }] },
    { scoringPlay: true, penaltyKick: true, clock: { displayValue: "67'" }, team: { id: '20' }, athletesInvolved: [{ shortName: 'Palmer' }] }
  ];
  const [e] = parseScoreboard(board('soccer', status('STATUS_SECOND_HALF', "67'", 2, "67'"), { details }), 'epl');
  assert.equal(liveLabel(e, 'soccer'), "67'");
  assert.equal(liveNote(e, 'soccer'), "⚽ 67' Palmer（PK）");
  assert.equal(e.live.events.length, 3);
  const [et] = parseScoreboard(board('soccer', status('STATUS_EXTRA_TIME', "105'", 3, "105'"), {}), 'ucl');
  assert.equal(liveLabel(et, 'soccer'), "延長 105'");
});

test('basketball quarters, overtime, breaks', () => {
  const [nba] = parseScoreboard(board('basketball', status('STATUS_IN_PROGRESS', '2:10 - 4th', 4, '2:10'), {}), 'nba');
  assert.equal(liveLabel(nba, 'basketball'), '第4節 2:10');
  assert.equal(liveLabel(nba, 'basketball', 'en'), 'Q4 2:10');
  const [ot] = parseScoreboard(board('basketball', status('STATUS_IN_PROGRESS', '1:05 - OT', 5, '1:05'), {}), 'nba');
  assert.equal(liveLabel(ot, 'basketball'), '延長賽 1:05');
  const [end] = parseScoreboard(board('basketball', status('STATUS_END_PERIOD', 'End of 2nd', 2), {}), 'nba');
  assert.equal(liveLabel(end, 'basketball'), '第2節結束');
  const [half] = parseScoreboard(board('basketball', status('STATUS_HALFTIME', 'Halftime', 2), {}), 'nba');
  assert.equal(liveLabel(half, 'basketball'), '中場休息');
  assert.equal(liveOf({}, {}, 'baseball').half, '');
});

test("CPBL on now: the inning and score from Kambi's live feed, matched by nickname either way round", async () => {
  const { kambiInnings, applyKambiLive } = await import('../public/lib/espn.mjs');
  const { liveLabel } = await import('../public/lib/live.mjs');
  const live = kambiInnings({ events: [{ event: { state: 'STARTED', homeName: 'Uni-President 7-Eleven Lions', awayName: 'CTBC Brothers' }, liveData: { score: { home: '3', away: '1', info: '0-0|2-1|1-0|0-0|0-0' } } }] });
  const side = (en, score) => ({ en, name: en, score });
  const game = { kind: 'match', league: 'cpbl', status: { state: 'in' }, home: side('CTBC Brothers', 0), away: side('Uni-President Lions', 0) };
  const [e] = applyKambiLive([game], live);
  assert.deepEqual([e.home.score, e.away.score, e.status.period], [1, 3, 5]);
  assert.equal(liveLabel(e, 'baseball', 'zh'), '5局');
  assert.deepEqual([e.home.lines, e.away.lines], [['0', '1', '0', '0', '0'], ['0', '2', '1', '0', '0']], 'each inning’s runs, the right way round');
  // The all-baseball list (the league's own answers 404): that league's only; "Uni-Lions" is the Lions.
  const all = { events: [
    { event: { state: 'STARTED', homeName: 'Fubon Guardians', awayName: 'Uni-Lions', path: ['baseball', 'taiwan', 'chinese_professional_baseball'] }, liveData: { score: { home: '0', away: '1', info: '0-1 | 0-0' } } },
    { event: { state: 'STARTED', homeName: 'Yokohama Bay Stars', awayName: 'Hanshin Tigers', path: ['baseball', 'japan', 'npb'] }, liveData: { score: { home: '1', away: '0', info: '1-0' } } }
  ] };
  const cpbl = kambiInnings(all, 'baseball/taiwan/chinese_professional_baseball');
  assert.equal(cpbl.length, 1);
  const [f] = applyKambiLive([{ ...game, home: side('Fubon Guardians', ''), away: side('Uni-President Lions', '') }], cpbl);
  assert.deepEqual([f.home.score, f.away.score, f.status.period], [0, 1, 2]);
  // 0-0 in the first: Kambi sends no score yet; it's 0, not blank.
  const [z] = kambiInnings({ events: [{ event: { state: 'STARTED', homeName: 'Uni-President 7-Eleven Lions', awayName: 'CTBC Brothers' }, liveData: {} }] });
  assert.deepEqual([z.homeScore, z.awayScore], [0, 0]);
  const [g] = applyKambiLive([{ ...game, home: side('CTBC Brothers', ''), away: side('Uni-President Lions', '') }], [z]);
  assert.deepEqual([g.home.score, g.away.score], [0, 0]);
});

test("a play's period fits the plays list's time column, in the viewer's words", async () => {
  const { playPeriod } = await import('../public/lib/live.mjs');
  const q = n => ({ period: n > 4 ? 'OT' : '1st Quarter', periodNum: n });
  assert.equal(playPeriod(q(1), 'basketball'), '第1節');
  assert.equal(playPeriod(q(1), 'basketball', 'en'), 'Q1');
  assert.equal(playPeriod(q(5), 'basketball'), '延長');
  assert.equal(playPeriod(q(6), 'basketball', 'en'), '2OT');
  assert.equal(playPeriod({ period: '2nd Half', periodNum: 2 }, 'basketball'), '下半場');
  assert.equal(playPeriod({ period: '7th Inning', periodNum: 7, periodType: 'Bottom' }, 'baseball'), '7局下');
  assert.equal(playPeriod({ period: '7th Inning', periodNum: 7, periodType: 'Top' }, 'baseball', 'en'), 'Top 7th');
  assert.equal(playPeriod({ period: '', periodNum: 0 }, 'soccer'), '');
  // Never ESPN's long words, whatever the sport.
  for (const n of [1, 2, 3, 4, 5]) assert.ok(playPeriod(q(n), 'basketball').length <= 3);
});
