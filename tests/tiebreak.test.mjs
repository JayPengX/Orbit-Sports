import test from 'node:test';
import assert from 'node:assert/strict';
import { tieNotes, tableKey } from '../public/lib/tiebreak.mjs';

const row = (id, stats) => ({ id, name: id, short: id, stats });
test('a points table: the first step it holds that parts two level sides, said', () => {
  const g = { rows: [row('ARS', { GP: '9', P: '21', GD: '+10', F: '20' }), row('MCI', { GP: '9', P: '21', GD: '+8', F: '22' }), row('LIV', { GP: '9', P: '18', GD: '+8', F: '18' })] };
  const n = tieNotes(g, 'epl', 'zh');
  assert.equal(n.lines.length, 1);
  assert.match(n.lines[0], /ARS 排在 MCI 前（同為 21 分）：淨勝球 \+10 比 \+8/);
  assert.match(n.rule, /積分 → 淨勝球 → 進球 → 對戰成績/);
  // Serie A: head-to-head before goal difference.
  assert.match(tieNotes(g, 'seriea', 'zh').lines[0], /對戰成績等規則$/);
  // MLS: wins first.
  const m = { rows: [row('A', { GP: '9', P: '15', W: '5', GD: '+1' }), row('B', { GP: '9', P: '15', W: '4', GD: '+9' })] };
  assert.match(tieNotes(m, 'mls', 'en').lines[0], /wins 5 v 4/);
  assert.equal(tieNotes({ rows: g.rows.slice(1) }, 'epl'), null);
});

test('a record table: level sides said, the league’s order named', () => {
  const g = { rows: [row('MIA', { W: '3', L: '1' }), row('PHI', { W: '3', L: '1' }), row('NY', { W: '0', L: '0' }), row('BOS', { W: '0', L: '0' })] };
  const n = tieNotes(g, 'nba', 'zh');
  // (0-0 sides aren't level on anything yet.)
  assert.deepEqual(n.lines, ['MIA 排在 PHI 前（同為 3-1）：對戰成績等規則']);
  assert.match(n.rule, /對戰成績 → 分區冠軍/);
});

test('fresh finals re-sort by the league’s own steps, ESPN’s order kept past them (Serie A: points alone)', () => {
  assert.deepEqual(tableKey('epl', 'soccer')({ stats: { P: '3', GD: '+1', F: '2' } }), [3, 1, 2]);
  assert.deepEqual(tableKey('seriea', 'soccer')({ stats: { P: '3', GD: '+1', F: '2' } }), [3]);
});
