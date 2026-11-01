import test from 'node:test';
import assert from 'node:assert/strict';
import { tieNotes, tableKey } from '../public/lib/tiebreak.mjs';

const row = (id, stats, color = '') => ({ id, name: id, short: id, stats, color });
test('a points table (a tie on a zone edge only): the first step it holds that parts two level sides, said', () => {
  const g = { rows: [row('ARS', { GP: '9', P: '21', GD: '+10', F: '20' }, 'green'), row('MCI', { GP: '9', P: '21', GD: '+8', F: '22' }), row('LIV', { GP: '9', P: '18', GD: '+8', F: '18' })] };
  const n = tieNotes(g, 'epl', 'zh');
  assert.equal(n.lines.length, 1);
  assert.deepEqual(n.lines[0], { a: 'ARS', b: 'MCI', why: '淨勝球 +10/+8' });
  assert.equal(n.rule, '積分 › 淨勝球 › 進球 › 對戰');
  // Serie A: head-to-head before goal difference.
  assert.equal(tieNotes(g, 'seriea', 'zh').lines[0].why, '對戰等');
  // MLS: wins first.
  const m = { rows: [row('A', { GP: '9', P: '15', W: '5', GD: '+1' }, 'green'), row('B', { GP: '9', P: '15', W: '4', GD: '+9' })] };
  assert.equal(tieNotes(m, 'mls', 'en').lines[0].why, 'Wins 5/4');
  assert.equal(tieNotes({ rows: g.rows.slice(1) }, 'epl'), null);
  // Level inside one zone: nothing said.
  assert.equal(tieNotes({ rows: g.rows.map(r => ({ ...r, color: '' })) }, 'epl'), null);
});

test('a record table: level sides said, the league’s order named', () => {
  const g = { rows: [row('MIA', { W: '3', L: '1' }), row('PHI', { W: '3', L: '1' }, 'grey'), row('NY', { W: '0', L: '0' }, 'grey'), row('BOS', { W: '0', L: '0' }, 'grey')] };
  const n = tieNotes(g, 'nba', 'zh');
  // (0-0 sides aren't level on anything yet.)
  assert.deepEqual(n.lines, [{ a: 'MIA', b: 'PHI', why: '對戰等' }]);
  assert.match(n.rule, /對戰 › 分區冠軍/);
});

test('fresh finals re-sort by the league’s own steps, ESPN’s order kept past them (Serie A: points alone)', () => {
  assert.deepEqual(tableKey('epl', 'soccer')({ stats: { P: '3', GD: '+1', F: '2' } }), [3, 1, 2]);
  assert.deepEqual(tableKey('seriea', 'soccer')({ stats: { P: '3', GD: '+1', F: '2' } }), [3]);
});
