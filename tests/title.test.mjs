import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveTable, titleRace } from '../public/lib/title.mjs';

const row = (id, stats) => ({ id, name: id, stats });
const soccerTable = () => [{ name: '', rows: [row('A', { GP: '30', W: '22', D: '4', L: '4', F: '60', A: '20', GD: '+40', P: '70' }), row('B', { GP: '30', W: '20', D: '6', L: '4', F: '55', A: '25', GD: '+30', P: '66' }), row('C', { GP: '30', W: '10', D: '5', L: '15', F: '30', A: '45', GD: '-15', P: '35' })] }];
const game = (id, state, home, away, hs, as, hrec, arec, start = '2026-10-04T10:00Z') => ({ id, kind: 'match', start, status: { state }, home: { id: home, score: String(hs), record: hrec }, away: { id: away, score: String(as), record: arec } });

test('a final the table hasn’t counted is added, once; when the table catches up, nothing more', () => {
  // B beat C: B's record says 31 games now (21-6-4), C's 31; the table still has 30.
  const g = game('1', 'post', 'B', 'C', 2, 0, '21-6-4', '10-5-16');
  const t = liveTable(soccerTable(), [g], 'soccer');
  const b = t[0].rows.find(r => r.id === 'B');
  assert.deepEqual([b.stats.GP, b.stats.P, b.stats.GD, b.fresh], ['31', '69', '+32', 'post']);
  assert.equal(t.fresh, 1);
  // ESPN's table now has it: the same game adds nothing.
  const caught = soccerTable();
  Object.assign(caught[0].rows[1].stats, { GP: '31', W: '21', P: '69', GD: '+32' });
  Object.assign(caught[0].rows[2].stats, { GP: '31', L: '16', P: '35', GD: '-17' });
  const again = liveTable(caught, [g], 'soccer');
  assert.equal(again.fresh, 0);
  assert.equal(again[0].rows[1].stats.P, '69', 'not 72');
});

test('a game on now counts as it stands (provisional); the record not caught up yet adds nothing', () => {
  const live = game('2', 'in', 'B', 'A', 1, 0, '20-6-4', '22-4-4');
  const t = liveTable(soccerTable(), [live], 'soccer');
  assert.deepEqual(t[0].rows.map(r => r.id), ['A', 'B', 'C'], '70 v 69');
  assert.equal(t[0].rows[1].stats.P, '69');
  assert.equal(t[0].rows[1].fresh, 'in');
  // A final whose record still reads 30 games (ESPN not caught up): left alone.
  assert.equal(liveTable(soccerTable(), [game('3', 'post', 'B', 'C', 2, 0, '20-6-4', '10-5-15')], 'soccer').fresh, 0);
});

test('two games a side in the window (yesterday’s final, today’s on now) both count, in order', () => {
  const t = [{ name: '', rows: [row('X', { W: '90', L: '70', PCT: '.563' }), row('Y', { W: '88', L: '72', PCT: '.550' })] }];
  // Yesterday X beat Y (table hasn't it); today Y leads X. Records: X 91-70, Y 88-73 (finals in).
  const y1 = game('a', 'post', 'X', 'Y', 5, 3, '91-70', '88-73', '2026-10-03T10:00Z');
  const y2 = game('b', 'in', 'Y', 'X', 4, 1, '88-73', '91-70', '2026-10-04T10:00Z');
  const out = liveTable(t, [y2, y1], 'baseball');
  const [x, y] = ['X', 'Y'].map(id => out[0].rows.find(r => r.id === id));
  assert.deepEqual([x.stats.W, x.stats.L, y.stats.W, y.stats.L], ['91', '71', '89', '73']);
  assert.equal(out.fresh, 2);
});

test('the title race: won, the magic number and the soonest round', () => {
  // 38 rounds (20 sides). A 80 from 34, B 70 from 34: B can reach 82 → A needs 3 more.
  const rows = [row('A', { GP: '34', P: '80' }), row('B', { GP: '34', P: '70' }), ...Array.from({ length: 18 }, (_, i) => row(`z${i}`, { GP: '34', P: String(40 - i) }))];
  const r = titleRace({ rows }, 'soccer');
  assert.deepEqual([r.done, r.magic, r.soonest, r.round], [false, 3, 1, 35]);
  assert.ok(r.out.includes('z0'), 'too far back to catch up');
  const won = titleRace({ rows: [row('A', { GP: '36', P: '85' }), row('B', { GP: '36', P: '78' }), row('C', { GP: '36', P: '50' }), row('D', { GP: '36', P: '40' })] }, 'soccer', { total: 38 });
  assert.equal(won.done, true);
  // Baseball: 162 games. X 95-60, the nearest Y 90-65: magic 162+1-95-65 = 3.
  const mlb = titleRace({ rows: [row('X', { W: '95', L: '60' }), row('Y', { W: '90', L: '65' })] }, 'baseball', { total: 162 });
  assert.deepEqual([mlb.magic, mlb.soonest, mlb.done], [3, 2, false]);
  // F1: 3 races (one sprint) left, worth 83 at most. Leader 350, next 300: 300+83-350+1 = 34.
  const f1 = titleRace({ rows: [row('V', { PTS: '350' }), row('N', { PTS: '300' })] }, 'racing', { left: { races: 3, sprints: 1 } });
  assert.deepEqual([f1.magic, f1.soonest, f1.done], [34, 1, false]);
});
