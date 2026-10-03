import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBracket } from '../public/lib/bracket.mjs';

const side = (id, score, winner = false) => ({ id, name: id, short: id, score: String(score), winner });
const game = (id, round, start, home, away, extra = {}) => ({ id, league: 'x', kind: 'match', start, status: { state: 'post' }, home, away, round, ...extra });

test('MLB: series by their wins, the rounds in the league shape, places for the ties to come', () => {
  const wc = { key: 'RD16', title: 'NLWC', leg: 0, through: [] };
  const ds = { key: 'QTR', title: 'NLDS', leg: 0, through: [] };
  const events = [
    game('1', wc, '2026-09-29T18:00Z', side('ATL', 3), side('PHI', 1), { series: { completed: false, wins: { ATL: 1, PHI: 0 } } }),
    game('2', wc, '2026-09-30T18:00Z', side('ATL', 2), side('PHI', 5), { series: { completed: false, wins: { ATL: 1, PHI: 1 } } }),
    game('3', wc, '2026-10-01T18:00Z', side('ATL', 4), side('PHI', 2), { series: { completed: true, wins: { ATL: 2, PHI: 1 } } }),
    game('4', ds, '2026-10-03T22:00Z', side('LAD', 0), side('ATL', 0), { status: { state: 'pre' }, series: { completed: false, wins: { LAD: 0, ATL: 0 } } })
  ];
  const b = buildBracket(events, 'mlb');
  assert.deepEqual(b.map(r => [r.key, r.title.zh, r.ties.length]), [['RD16', '外卡賽', 4], ['QTR', '分區系列賽', 4], ['SEMI', '聯盟冠軍賽', 2], ['FINAL', '世界大賽', 1]]);
  const wcTie = b[0].ties[0];
  assert.equal(wcTie.kind, 'series');
  assert.deepEqual(wcTie.score, { ATL: 2, PHI: 1 });
  assert.equal(wcTie.winner, 'ATL');
  assert.deepEqual(wcTie.sides.map(s => s.id), ['ATL', 'PHI']);
  const dsTie = b[1].ties[0];
  assert.equal(dsTie.winner, null);
  assert.equal(dsTie.next.id, '4');
  assert.equal(b[2].ties[0], null);
});

test('A cup: two legs on aggregate, who went through, the rounds after the last drawn', () => {
  const qf = { key: 'quarterfinals', title: 'Quarterfinals', leg: 1, through: [] };
  const qf2 = { ...qf, leg: 2, through: ['A'] };
  const events = [
    game('1', qf, '2026-04-07T19:00Z', side('B', 2), side('A', 1)),
    game('2', qf2, '2026-04-14T19:00Z', side('A', 2), side('B', 1)),
    game('3', qf, '2026-04-08T19:00Z', side('C', 0), side('D', 0)),
    game('4', { ...qf, leg: 2 }, '2026-04-15T19:00Z', side('D', 1), side('C', 3), { status: { state: 'in' } })
  ];
  const b = buildBracket(events, 'ucl');
  assert.deepEqual(b.map(r => [r.title.zh, r.ties.length]), [['八強', 2], ['決賽', 1]]);
  const [ab, cd] = b[0].ties;
  assert.equal(ab.kind, 'agg');
  assert.deepEqual(ab.score, { B: 3, A: 3 });
  assert.equal(ab.winner, 'A');
  assert.equal(cd.live, true);
  assert.equal(cd.winner, null);
  assert.deepEqual(cd.score, { C: 3, D: 1 });
});
