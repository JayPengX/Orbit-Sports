import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAsia, cpblPlayoffs, cpblSeeds, cpblTable } from '../public/lib/espn.mjs';
import { playoffModel } from '../public/lib/playoffs.mjs';

const row = (en, zh, w, l, gp = 60) => ({ en, zh, w, l, t: 0, gp });
// 2026: 味全 the first half, 兄弟 the second; 味全 better over the year, so it waits;
// 兄弟 a win given against the year's next best, 統一.
const pack = {
  year: 2026,
  half: 'second',
  tables: [
    { key: 'second', rows: [row('CTBC Brothers', '中信兄弟', 36, 24), row('Uni-President Lions', '統一獅', 34, 26), row('Rakuten Monkeys', '樂天桃猿', 33, 27), row('Wei Chuan Dragons', '味全龍', 28, 32), row('Fubon Guardians', '富邦悍將', 25, 35), row('TSG Hawks', '台鋼雄鷹', 24, 36)] },
    { key: 'first', rows: [row('Wei Chuan Dragons', '味全龍', 39, 21), row('Fubon Guardians', '富邦悍將', 34, 26), row('Uni-President Lions', '統一獅', 30, 29), row('TSG Hawks', '台鋼雄鷹', 30, 29), row('Rakuten Monkeys', '樂天桃猿', 27, 33), row('CTBC Brothers', '中信兄弟', 26, 34)] }
  ]
};
const club = (en, zh) => ({ en, zh });
const B = club('CTBC Brothers', '中信兄弟');
const U = club('Uni-President Lions', '統一7-ELEVEn獅');
const game = (id, start, home, away, hs, as, state = 'post') => ({ id, start, home, away, homeScore: hs, awayScore: as, state, playoff: 'challenge' });

test('CPBL seeds: the better half champion waits, the other is given a win against the year’s next best', () => {
  const s = cpblSeeds(pack);
  assert.equal(s.direct, 'Wei Chuan Dragons');
  assert.equal(s.given, 'CTBC Brothers');
  assert.equal(s.rival, 'Uni-President Lions');
  assert.equal(s.sure, true);
});

test('CPBL challenge: the given win counts in the series, and the Taiwan Series waits for its winner', () => {
  const events = cpblPlayoffs(parseAsia([game('g1', '2026-10-09T10:35:00.000Z', B, U, 4, 1), game('g2', '2026-10-10T09:05:00.000Z', U, B, 1, 0), game('g3', '2026-10-11T09:05:00.000Z', B, U, null, null, 'pre')], 'cpbl', 'zh'), cpblSeeds(pack));
  const g3 = events.find(e => e.id === 'g3');
  assert.equal(g3.round.key, 'challenge');
  assert.deepEqual(g3.series.wins, { 'CTBC Brothers': 2, 'Uni-President Lions': 1 });
  assert.equal(g3.series.summary, 'CTB lead series 2-1');
  assert.equal(g3.series.games, 5);
  const model = playoffModel({ league: 'cpbl', mode: 'live', events, groups: cpblTable(pack, [], 'zh'), seeds: cpblSeeds(pack), now: Date.parse('2026-10-10T14:00:00Z') });
  const [ch, fin] = model.rounds;
  assert.equal(ch.ties[0].kind, 'series');
  assert.equal(ch.ties[0].winner, null);
  assert.equal(fin.ties[0].pending, true);
  assert.equal(fin.ties[0].sides[0].id, 'Wei Chuan Dragons');
  assert.equal(fin.ties[0].options[1].length, 2);
});

test('CPBL challenge won: its winner goes on to meet the club waiting', () => {
  const events = cpblPlayoffs(parseAsia([game('g1', '2026-10-09T10:35:00.000Z', B, U, 4, 1), game('g2', '2026-10-10T09:05:00.000Z', U, B, 0, 3)], 'cpbl', 'zh'), cpblSeeds(pack));
  assert.equal(events[1].series.completed, true);
  assert.equal(events[1].series.summary, 'CTB win series 3-0');
  const model = playoffModel({ league: 'cpbl', mode: 'live', events, groups: cpblTable(pack, [], 'zh'), seeds: cpblSeeds(pack) });
  assert.equal(model.rounds[0].ties[0].winner, 'CTBC Brothers');
  assert.equal(model.rounds[1].ties[0].sides[1].id, 'CTBC Brothers');
});

test('CPBL before the play-offs: predicted from the table', () => {
  const model = playoffModel({ league: 'cpbl', mode: 'projected', groups: cpblTable(pack, [], 'zh'), seeds: cpblSeeds(pack) });
  assert.equal(model.rounds[0].ties[0].sides[0].id, 'CTBC Brothers');
  assert.equal(model.rounds[0].ties[0].labels[0], '一勝優勢');
  assert.equal(model.rounds[1].ties[0].sides[0].id, 'Wei Chuan Dragons');
});
