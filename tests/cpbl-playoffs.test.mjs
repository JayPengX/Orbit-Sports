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
  assert.equal(cpblBoxUrl({ id: 'cpbl-2026-E2-2026-10-10' }), 'https://asia-baseball.quadra/cpbl/box/2026-E2.json');
  assert.equal(cpblBoxUrl({ id: 'cpbl-2026-290-2026-08-26' }), 'https://asia-baseball.quadra/cpbl/box/2026-290.json');
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
