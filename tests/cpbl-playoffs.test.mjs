import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAsia, cpblPlayoffs, splitWeekend, feedStarted, feedEnded, feedStatus, dueToStart } from '../public/lib/espn.mjs';
import { cpblBoxUrl } from '../public/lib/cpblbox.mjs';

const club = (en, zh) => ({ en, zh });
const lions = club('Uni-President Lions', '統一7-ELEVEn獅');
const brothers = club('CTBC Brothers', '中信兄弟');
const monkeys = club('Rakuten Monkeys', '樂天桃猿');
const game = (id, start, home, away, extra = {}) => ({ id, start, home, away, homeScore: null, awayScore: null, state: 'pre', venue: '', ...extra });

test("CPBL's play-offs: each game its series and number, the first pairing the challenge, the next the Taiwan Series; the rest the regular season", () => {
  const list = parseAsia(
    [
      game('r1', '2026-10-05T10:35:00.000Z', brothers, lions, { state: 'post', homeScore: 1, awayScore: 2 }),
      // TheSportsDB's (only that they're play-offs), one called off and played again.
      game('p1', '2026-10-09T09:05:00.000Z', brothers, lions, { playoff: true, state: 'post', homeScore: 4, awayScore: 1 }),
      game('p2x', '2026-10-10T09:05:00.000Z', lions, brothers, { playoff: true, state: 'void' }),
      game('p2', '2026-10-11T09:05:00.000Z', lions, brothers, { playoff: true }),
      game('f1', '2026-10-18T09:05:00.000Z', monkeys, brothers, { playoff: true })
    ],
    'cpbl',
    'zh'
  );
  const tagged = cpblPlayoffs(list);
  assert.deepEqual(
    tagged.map(e => [e.id, e.stage?.key, e.stage?.round?.zh || '', e.stage?.special]),
    [
      ['r1', 'regular', '', false],
      ['p1', 'post', '季後挑戰賽 G1', true],
      ['p2x', undefined, '', undefined],
      ['p2', 'post', '季後挑戰賽 G2', true],
      ['f1', 'final', '台灣大賽 G1', true]
    ].map(([id, key, round, special]) => [id, key, round, special])
  );
  // CPBL's own list names the kind: the Taiwan Series even as the only pairing seen.
  assert.equal(cpblPlayoffs(parseAsia([game('c1', '2026-10-20T10:35:00.000Z', monkeys, lions, { playoff: 'final' })], 'cpbl', 'en'))[0].stage.round.en, 'Taiwan Series - Game 1');
  // None yet: as they were.
  assert.equal(cpblPlayoffs(list.slice(0, 1))[0].stage, undefined);
});

test("a CPBL play-off game's box score is read by its kind", () => {
  assert.equal(cpblBoxUrl({ id: 'cpbl-2026-E2-2026-10-10' }), 'https://asia-baseball.orbit/cpbl/box/2026-E2.json');
  assert.equal(cpblBoxUrl({ id: 'cpbl-2026-290-2026-08-26' }), 'https://asia-baseball.orbit/cpbl/box/2026-290.json');
  assert.equal(cpblBoxUrl({ id: 'cpbl-tsdb-2615589' }), null);
});

test("F1: a session F1's feed says has started is on at once (ESPN says so minutes later), one it says is over is over", () => {
  const now = Date.parse('2026-10-10T09:01:00Z');
  const pre = { state: 'pre', completed: false };
  assert.ok(dueToStart({ start: '2026-10-10T09:00:00Z', status: pre }, now));
  assert.ok(dueToStart({ start: '2026-10-10T09:00:30Z', status: pre }, now));
  assert.ok(!dueToStart({ start: '2026-10-10T09:05:00Z', status: pre }, now));
  assert.ok(!dueToStart({ start: '2026-10-10T09:00:00Z', status: { state: 'in' } }, now));
  assert.equal(feedStatus('SR', '2026-10-10T09:00Z', pre), pre);
  feedStarted.add('SR|2026-10-10T09:00Z');
  assert.equal(feedStatus('SR', '2026-10-10T09:00Z', pre).state, 'in');
  // ESPN's word that it's over stands.
  assert.equal(feedStatus('SR', '2026-10-10T09:00Z', { state: 'post' }).state, 'post');
  feedEnded.add('SR|2026-10-10T09:00Z');
  assert.equal(feedStatus('SR', '2026-10-10T09:00Z', { state: 'in' }).state, 'post');
  const weekend = {
    id: 'w',
    league: 'f1',
    kind: 'field',
    sessions: [
      { abbr: 'SQ', start: '2026-10-09T12:30Z', status: { state: 'post' } },
      { abbr: 'SR', start: '2026-10-10T08:00Z', status: pre },
      { abbr: 'Qual', start: '2026-10-10T13:00Z', status: pre }
    ]
  };
  feedEnded.clear();
  feedStarted.clear();
  feedStarted.add('SR|2026-10-10T08:00Z');
  const split = splitWeekend(weekend, Date.parse('2026-10-10T08:02:00Z'));
  assert.deepEqual(split.map(x => x.status.state), ['post', 'in', 'pre']);
});

test('a side held scoreless shows 0, not an empty score', () => {
  const t = { en: 'CTBC Brothers', zh: '中信兄弟' };
  const l = { en: 'Uni-President Lions', zh: '統一7-ELEVEn獅' };
  const [e] = parseAsia([{ id: 'x', start: '2026-10-10T09:05:00.000Z', home: l, away: t, homeScore: 1, awayScore: null, state: 'post' }], 'cpbl', 'zh');
  assert.equal(e.away.score, 0);
  assert.equal(e.home.winner, true);
});

test('a CPBL play-off game that may not be played says 如需, as MLB’s do; a series won drops the rest', () => {
  const post = (id, start, home, away, h, a) => game(id, start, home, away, { playoff: 'final', state: 'post', homeScore: h, awayScore: a });
  const pre = (id, start, home, away) => game(id, start, home, away, { playoff: 'final' });
  // Brothers lead 3-2 after five: G6 is sure, G7 only if needed.
  const five = [
    post('t1', '2026-10-18T09:05:00.000Z', monkeys, brothers, 1, 2),
    post('t2', '2026-10-19T09:05:00.000Z', monkeys, brothers, 3, 2),
    post('t3', '2026-10-21T10:35:00.000Z', brothers, monkeys, 5, 0),
    post('t4', '2026-10-22T10:35:00.000Z', brothers, monkeys, 1, 4),
    post('t5', '2026-10-23T10:35:00.000Z', brothers, monkeys, 6, 2)
  ];
  const rounds = list => cpblPlayoffs(parseAsia(list, 'cpbl', 'zh')).map(e => e.stage.round.zh);
  const later = [pre('t6', '2026-10-25T09:05:00.000Z', monkeys, brothers), pre('t7', '2026-10-26T09:05:00.000Z', monkeys, brothers)];
  assert.deepEqual(rounds([...five, ...later]).slice(5), ['台灣大賽 G6', '台灣大賽 G7（如需）']);
  assert.equal(cpblPlayoffs(parseAsia([...five, ...later], 'cpbl', 'en'))[6].stage.round.en, 'Taiwan Series - Game 7 If Necessary');
  // Before any game: G5 to G7 may not be played.
  assert.deepEqual(rounds(['t1', 't2', 't3', 't4', 't5', 't6', 't7'].map((id, i) => pre(id, `2026-10-${18 + i}T09:05:00.000Z`, monkeys, brothers))), ['台灣大賽 G1', '台灣大賽 G2', '台灣大賽 G3', '台灣大賽 G4', '台灣大賽 G5（如需）', '台灣大賽 G6（如需）', '台灣大賽 G7（如需）']);
  // 3-3: G7 is sure; Brothers win G6 (4-2): G7 goes.
  assert.deepEqual(rounds([...five, post('t6', '2026-10-25T09:05:00.000Z', monkeys, brothers, 3, 1), later[1]]).at(-1), '台灣大賽 G7');
  assert.equal(rounds([...five, post('t6', '2026-10-25T09:05:00.000Z', monkeys, brothers, 1, 3), later[1]]).length, 6);
});
