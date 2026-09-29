import test from 'node:test';
import assert from 'node:assert/strict';
import { liveOf, liveLabel, liveNote, possessionOf, kambiLive } from '../public/lib/live.mjs';
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

test('American football: quarter and clock, down and distance, possession, red zone', () => {
  const [e] = parseScoreboard(board('football', status('STATUS_IN_PROGRESS', '5:32 - 3rd', 3, '5:32'), { situation: { down: 3, distance: 4, shortDownDistanceText: '3rd & 4', possessionText: 'PHI 12', possession: '20', isRedZone: true } }), 'nfl');
  assert.equal(liveLabel(e, 'football'), '第3節 5:32');
  assert.equal(liveLabel(e, 'football', 'en'), 'Q3 5:32');
  assert.equal(liveNote(e, 'football'), '3rd & 4 · PHI 12');
  assert.equal(possessionOf(e), 'away');
  assert.equal(e.live.redZone, true);
  const [ot] = parseScoreboard(board('football', status('STATUS_IN_PROGRESS', '8:00 - OT', 5, '8:00'), {}), 'nfl');
  assert.equal(liveLabel(ot, 'football'), '延長賽 8:00');
  const [half] = parseScoreboard(board('football', status('STATUS_HALFTIME', 'Halftime', 2), {}), 'nfl');
  assert.equal(liveLabel(half, 'football'), '中場休息');
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

test('basketball, college halves, hockey periods, breaks', () => {
  const [nba] = parseScoreboard(board('basketball', status('STATUS_IN_PROGRESS', '2:10 - 4th', 4, '2:10'), {}), 'nba');
  assert.equal(liveLabel(nba, 'basketball'), '第4節 2:10');
  const [ncaa] = parseScoreboard(board('basketball', status('STATUS_IN_PROGRESS', '11:02 - 2nd Half', 2, '11:02'), {}), 'ncaam');
  assert.equal(liveLabel(ncaa, 'basketball'), '下半場 11:02');
  const [nhl] = parseScoreboard(board('hockey', status('STATUS_END_PERIOD', 'End of 2nd', 2), {}), 'nhl');
  assert.equal(liveLabel(nhl, 'hockey'), '第2節結束');
  const [so] = parseScoreboard(board('hockey', status('STATUS_SHOOTOUT', 'SO', 5), {}), 'nhl');
  assert.equal(liveLabel(so, 'hockey'), '射門大戰');
});

test('Kambi: the inning from the line score, the set', () => {
  assert.equal(kambiLive({ score: { info: '1-0 | 0-2 | 0-0' } }, 'baseball').inning, 3);
  assert.equal(kambiLive({ statistics: { sets: { home: [21, 15, -1], away: [18, 12, -1] } } }, 'racket').set, 2);
  const e = { league: 'cpbl', status: { state: 'in' }, live: kambiLive({ score: { info: '1-0 | 0-2' } }, 'baseball') };
  assert.equal(liveLabel(e, 'baseball'), '2局上');
  assert.equal(liveOf({}, {}, 'baseball').half, '');
});
