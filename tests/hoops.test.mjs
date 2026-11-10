import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hoopsSeason, parseSplits, fig } from '../public/lib/hoops.mjs';
import { logSeasonLine } from '../public/lib/espn.mjs';

// A season's log as ESPN's gamelog has it (newest first), in its columns.
const labels = ['MIN', 'FG', 'FG%', '3PT', '3P%', 'FT', 'FT%', 'REB', 'AST', 'BLK', 'STL', 'PF', 'TO', 'PTS'];
let n = 0;
const g = (min, fg, tp, ft, reb, ast, blk, stl, to, pts, result = 'W', extra = {}) => ({ id: String(++n), date: `2026-11-${String(20 - n).padStart(2, '0')}T00:00:00Z`, at: 'vs', result, score: '110-100', opp: { abbr: 'DET', name: 'Detroit Pistons' }, stats: [min, fg, '', tp, '', ft, '', reb, ast, blk, stl, '3', to, pts], ...extra });
const games = [
  g('37', '14-27', '4-6', '11-11', '5', '4', '0', '0', '1', '43'),
  g('36', '7-12', '4-5', '11-13', '12', '10', '2', '1', '3', '29', 'L'),
  g('34', '10-15', '4-5', '3-4', '2', '5', '0', '0', '5', '27'),
  g('39', '6-16', '2-7', '5-6', '3', '4', '0', '0', '3', '19'),
  g('38', '8-17', '2-8', '7-7', '6', '11', '0', '4', '1', '25'),
  g('35', '5-10', '1-3', '2-2', '4', '6', '1', '1', '2', '13', 'L'),
  g('33', '9-14', '3-4', '0-0', '3', '3', '0', '2', '2', '21'),
  g('36', '8-15', '2-6', '4-4', '11', '8', '0', '1', '4', '22'),
  g('30', '1-4', '0-1', '2-2', '2', '1', '0', '0', '1', '4', 'W', { pre: true })
];
const log = { labels, games };

test('a basketball season beyond the four: shooting, per 36, his games, highs, form', () => {
  const h = hoopsSeason(log);
  assert.equal(h.games, 8);
  // FG 67-126, 3PT 22-44, FT 43-47, 199 points: TS = 199 / (2 × (126 + 0.44 × 47)).
  assert.equal(fig(h.shooting.ts), fig((100 * 199) / (2 * (126 + 0.44 * 47))));
  assert.equal(fig(h.shooting.efg), fig((100 * (67 + 11)) / 126));
  assert.deepEqual(h.shooting.twoMade, [45, 82]);
  assert.deepEqual([h.shooting.threeMade, h.shooting.ftMade], [[22, 44], [43, 47]]);
  assert.equal(fig(h.per36.pts), fig((36 * 199) / 288));
  assert.equal(fig(h.astTo, 2), fig(51 / 21, 2));
  // 29/12/10 is a triple-double (and a double-double); 25 and 11 assists, 22 and 11 rebounds double-doubles (the preseason's never counted).
  assert.deepEqual(h.counts, { dd: 3, td: 1, p20: 6, p30: 1, p40: 1 });
  const high = Object.fromEntries(h.highs.map(x => [x.key, [x.value, x.game.id]]));
  // (Done twice, the newer game: four threes in games 1, 2 and 3.)
  assert.deepEqual([high.PTS, high.AST, high['3PM'], high.STL], [[43, '1'], [11, '5'], [4, '1'], [4, '5']]);
  // The last five against the season, from eight games.
  assert.equal(h.form.n, 5);
  assert.equal(fig(h.form.last.pts), fig((43 + 29 + 27 + 19 + 25) / 5));
  assert.equal(fig(h.form.season.pts), fig(199 / 8));
  // Points game by game, oldest first.
  assert.deepEqual(h.points.map(p => p.pts), [22, 21, 13, 25, 19, 27, 29, 43]);
  assert.equal(h.points[2].result, 'L');
});

test("a game he sat out, a game on now and a short season: none of them counted wrong", () => {
  // (A game newer than ESPN's log he missed reads DNP and '': never a game of 0 points.)
  const dnp = { id: 'x', date: '2026-11-21', result: 'W', opp: {}, stats: ['DNP', ...labels.slice(1).map(() => '')] };
  const live = { ...games[0], id: 'y', live: true };
  const h = hoopsSeason({ labels, games: [live, dnp, ...games] });
  assert.equal(h.games, 8);
  assert.equal(logSeasonLine({ labels, games: [dnp, ...games] }, 2027).stats.list[0].value, fig(199 / 8));
  // Three games: no form yet (the five would be the season).
  assert.equal(hoopsSeason({ labels, games: games.slice(0, 3) }).form, null);
  // A log without made and tried (the overview's): nothing made up.
  assert.equal(hoopsSeason({ labels: ['MIN', 'FG%', 'PTS'], games }), null);
});

test("ESPN's splits: home and road, wins and losses, each month, in that order", () => {
  const row = (displayName, gp, pts) => ({ displayName, stats: [gp, '36.0', '8.0-16.0', '50.0', pts] });
  const sp = parseSplits({
    displayName: '2026-27 Splits',
    labels: ['GP', 'MIN', 'FG', 'FG%', 'PTS'],
    splitCategories: [
      { name: 'split', splits: [row('All Splits', '11', '25.3'), row('Home', '6', '24.7'), row('Road', '5', '26.0'), row('vs. Division', '5', '21.8')] },
      { name: 'byMonth', splits: [row('October', '6', '23.8'), row('November', '5', '27.0'), row('Pre All-Star', '11', '25.3')] },
      { name: 'byResult', splits: [row('Wins', '9', '25.7'), row('Losses', '2', '23.5')] },
      { name: 'byDay', splits: [row('Monday', '1', '27.0')] }
    ]
  });
  assert.deepEqual(sp.rows.map(r => [r.kind, r.month, r.stats.GP, r.stats.PTS]), [
    ['home', 0, '6', '24.7'],
    ['road', 0, '5', '26.0'],
    ['wins', 0, '9', '25.7'],
    ['losses', 0, '2', '23.5'],
    ['month', 10, '6', '23.8'],
    ['month', 11, '5', '27.0']
  ]);
  assert.equal(parseSplits({ labels: [] }), null);
});
