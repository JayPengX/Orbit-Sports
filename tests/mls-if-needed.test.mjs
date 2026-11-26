import test from 'node:test';
import assert from 'node:assert/strict';
import { settleSeries, noteSeriesGames } from '../public/lib/espn.mjs';

// Jay 2026-11-26: MLS's best of three had no 如需 on its game 3, as MLB's have. ESPN's notes say only
// "CLB leads series 1-0" on every game: the games are numbered from a list that holds all three.
const game = (id, day, state, wins) => ({
  id, kind: 'match', league: 'mls', start: `2026-${day}T01:00Z`, status: { state }, note: 'CLB leads series 1-0',
  home: { id: '183', abbr: 'MIA' }, away: { id: '20232', abbr: 'CLB' },
  round: { key: 'round-one', title: 'Eastern Conference Round One', leg: 0, through: [] },
  series: { summary: 'CLB leads series 1-0', completed: false, games: 3, wins },
  stage: { key: 'post', zh: '季後賽', en: 'Playoffs', round: { zh: '東區首輪', en: 'Eastern Conference Round One' }, special: true }
});
test("an MLS series' games are G1 G2 G3, the third （如需） until it's sure", () => {
  const g1 = game('1', '11-22', 'post', { 183: 0, 20232: 1 });
  const g2 = game('2', '11-28', 'pre', { 183: 0, 20232: 1 });
  const g3 = game('3', '12-03', 'pre', { 183: 0, 20232: 1 });
  // One day's list alone numbers nothing (game 3 by itself would read G1).
  assert.equal(settleSeries([g3])[0].stage.round.zh, '東區首輪');
  noteSeriesGames([g3, g1, g2]);
  assert.deepEqual(settleSeries([g1, g2, g3]).map(e => e.stage.round.zh), ['東區首輪 G1', '東區首輪 G2', '東區首輪 G3（如需）']);
  // 1-1 after game 2: game 3 will be played.
  const level = { 183: 1, 20232: 1 };
  assert.equal(settleSeries([{ ...g3, series: { ...g3.series, wins: level } }])[0].stage.round.zh, '東區首輪 G3');
});
