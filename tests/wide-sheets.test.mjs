// A team's and a player's sheet on an iPad or a computer (Jay 2026-11-06,
// "What the fuck", "Unbelievable", "Unbelievable again"): 本場 a sliver in
// the middle with its tiles stacked, 賽程 half empty or a narrow column,
// 排名 narrow, 陣容 opened on 中場 with the keeper in it, the Brewers' W5
// beside chips that end 敗勝.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { streakOf, squadFixed } from '../public/lib/espn.mjs';

const sheets = readFileSync(new URL('../public/sheets.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');

test('a lone card on a team or player tab is never centred by auto margins (a grid item shrinks to its content)', () => {
  assert.doesNotMatch(css, /\.team-tab > :only-child \{[^}]*margin-inline: auto/);
});

test("a team's and a player's tabs are laid out by tabLayout: glance tabs dealt by flowColumns, never CSS columns", () => {
  assert.match(sheets, /tabLayout\(body, view, TEAM_FLOW\)/);
  assert.match(sheets, /tabLayout\(tabBody, view, PLAYER_FLOW\)/);
  assert.match(sheets, /q-flow q-flow-2/);
  assert.doesNotMatch(css, /\.team-tab:has\(> :nth-child\(2\)\) \{[^}]*columns: 2/);
  for (const t of ['tt-games', 'tt-roster', 'tt-table', 'tt-game']) assert.match(css, new RegExp(`\\.team-tab\\.${t}`), t);
});

test("a player's tabs are one full-width row, as a team's", () => {
  assert.match(sheets, /segmented\(views\.map\(\(\[k, label\]\) => \[k, label\]\), view, v => \(\(view = v\), paintTab\(\)\), '', \{ seg: true \}\)/);
});

test("a footballer's log shows each game's shots (ESPN's log says SHOT and SOG)", () => {
  assert.match(sheets, /soccer: \[\['G', 'A'\], \[[^\]]*'SHOT'[^\]]*'SOG'/);
  assert.match(sheets, /SHOT: \['射門'/);
  assert.match(sheets, /SOG: \['射正'/);
});

test('a season row names its competition as text, never [object Text]', () => {
  assert.doesNotMatch(sheets, /glog-split', text: name/);
});

test('連勝敗 is the run at the end of the games the form chips are from', () => {
  assert.equal(streakOf(['W', 'W', 'W', 'L', 'W']), 'W1');
  assert.equal(streakOf(['L', 'W', 'W', 'W', 'W', 'W']), 'W5');
  assert.equal(streakOf(['W', 'L', 'L']), 'L2');
  assert.equal(streakOf(['W', 'D']), 'D1');
  assert.equal(streakOf([]), '');
  assert.match(sheets, /const statOf = k => \(k === 'STRK' && streak \? streak/);
});

test("陣容 in the sport's order, a keeper's group first", () => {
  assert.match(sheets, /\.sort\(\(a, b\) => rank\(a\.players\) - rank\(b\.players\)\)/);
});

test("a footballer's role and age from FotMob's squad where ESPN's is wrong (Nashville's Joe Willis)", () => {
  const groups = [{ name: '', players: [
    { id: '156217', name: 'Joe Willis', jersey: '1', pos: 'M', age: 25 },
    { id: '1', name: 'Andy Nájar', jersey: '31', pos: 'D', age: 33 },
    { id: '2', name: 'Famara Camara', jersey: '26', pos: 'M', age: null },
    { id: '3', name: 'Nobody Here', jersey: '77', pos: 'F', age: 20 }
  ] }];
  const squad = [
    { name: 'Joe Willis', shirt: 1, role: 'G', age: 38 },
    { name: 'Andy Najar', shirt: 31, role: 'D', age: 33 },
    { name: 'F. Camara', shirt: 26, role: 'M', age: 22 }
  ];
  const [g] = squadFixed(groups, squad);
  assert.deepEqual(g.players.map(p => [p.name, p.pos, p.age]), [
    ['Joe Willis', 'G', 38],
    ['Andy Nájar', 'D', 33],
    ['Famara Camara', 'M', 22],
    ['Nobody Here', 'F', 20]
  ]);
  assert.equal(squadFixed(groups, null), groups);
  // The accents ESPN left off as FotMob spells them, never taken off one ESPN has (Andy Nájar stays).
  const [u] = squadFixed([{ name: '', players: [{ id: '9', name: 'Benjamin Sesko', jersey: '30', pos: 'F', age: 23 }, { id: '8', name: 'Kobbie Mainoo', jersey: '37', pos: 'M', age: 21 }] }], [{ name: 'Benjamin Šeško', shirt: 30, role: 'F', age: 23 }, { name: 'Kobbie Mainoo', shirt: 37 }]);
  assert.deepEqual(u.players.map(p => p.name), ['Benjamin Šeško', 'Kobbie Mainoo']);
  assert.match(sheets, /squadFixed\(list, squad\)/);
});
