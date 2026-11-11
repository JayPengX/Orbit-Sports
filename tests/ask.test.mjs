// 問比賽 (lib/ask.mjs): what the phone has read laid out as tables, and the facts the AI is told.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askTables, askFacts } from '../public/lib/ask.mjs';

const now = Date.parse('2026-11-11T04:00:00Z');
const game = (id, start, state, home, away) => ({ id, league: 'nba', start, status: { state }, home, away });
const LAL = { id: '13', name: 'Los Angeles Lakers', short: 'Lakers', logo: 'lal.png' };
const PHX = { id: '21', name: 'Phoenix Suns', short: 'Suns', logo: 'phx.png' };
const teams = [
  {
    league: 'nba', id: '13', name: '湖人', logo: 'lal.png', pos: 3, n: 15, group: '西區', leagueName: 'NBA',
    games: [game('1', '2026-11-09T02:00Z', 'post', { ...LAL, score: '112' }, { ...PHX, score: '104' }), game('2', '2026-11-12T11:30Z', 'pre', PHX, LAL)]
  }
];
const nameOf = (l, s) => ({ 13: '湖人', 21: '太陽' })[s?.id] || s?.short || '';

test('my teams: their place, next game (Taiwan time) and last result', () => {
  const t = askTables({ teams, now, nameOf });
  assert.deepEqual(t.mine.rows[0].value, '第 3 名');
  assert.equal(t.next.rows[0].label, '湖人 @ 太陽');
  assert.match(t.next.rows[0].sub, /^11\/12（四）19:30$/);
  assert.equal(t.last.rows[0].label, '湖人 vs 太陽');
  assert.equal(t.last.rows[0].value, '112–104 勝');
});

test("a league's table: its first eight and mine below them, the facts a line a table", () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({ id: String(100 + i), name: `T${i}`, short: `T${i}`, record: `${10 - i}-${i}` }));
  rows[10] = { ...LAL, record: '1-10' };
  const t = askTables({ teams, standings: { nba: { league: 'nba', name: 'NBA', title: 'NBA 西區', rows } }, now, nameOf });
  assert.equal(t['table.nba'].rows.length, 9);
  assert.deepEqual(t['table.nba'].rows.at(-1), { key: 'nba:13', label: '湖人', logo: 'lal.png', sub: '1-10', value: '第 11 名', pos: 11, mine: true });
  const f = askFacts(t, { now });
  assert.match(f, /^\[mine\] 我的球隊排名: 湖人, NBA · 西區, 第 3 名$/m);
  assert.match(f, /^\[table\.nba\] NBA 西區: /m);
});

test('nothing followed: no tables', () => {
  assert.deepEqual(askTables({ now }), {});
});
