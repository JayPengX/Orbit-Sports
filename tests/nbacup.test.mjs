import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nbaCupGroups, isGroupPlay, cupQuarters } from '../public/lib/nbacup.mjs';

// Last season's (2025-26) group play as ESPN listed it: 60 games, the note alone saying which.
const raw = JSON.parse(readFileSync(new URL('./fixtures/nbacup-2025.json', import.meta.url), 'utf8'));
const games = raw.map(g => ({ id: g.id, league: 'nba', kind: 'match', note: g.note, start: g.start, status: { state: g.state }, home: { ...g.home, name: g.home.abbr }, away: { ...g.away, name: g.away.abbr } }));

test('the NBA Cup groups from who meets whom, ranked by its rules', () => {
  assert.ok(games.every(isGroupPlay));
  const groups = nbaCupGroups(games);
  assert.equal(groups.length, 6);
  assert.deepEqual(groups.map(g => [g.conf, g.rows.length]), [['East', 5], ['East', 5], ['East', 5], ['West', 5], ['West', 5], ['West', 5]]);
  // Four games each, all played.
  assert.ok(groups.every(g => g.rows.every(r => r.w + r.l === 4 && r.left === 0)));
  // Its firsts and wild cards are the eight who played the quarterfinals (Magic–Heat, Raptors–Knicks, Thunder–Suns, Lakers–Spurs).
  const through = groups.flatMap(g => g.rows.filter(r => r.zone).map(r => r.abbr)).sort();
  assert.deepEqual(through, ['LAL', 'MIA', 'NY', 'OKC', 'ORL', 'PHX', 'SA', 'TOR']);
  assert.equal(groups.flatMap(g => g.rows).filter(r => r.zone === 'card').length, 2);
});

test('before the first night: the draw, every record 0-0', () => {
  const groups = nbaCupGroups(games.map(e => ({ ...e, status: { state: 'pre' }, home: { ...e.home, score: '' }, away: { ...e.away, score: '' } })));
  assert.equal(groups.length, 6);
  assert.ok(groups.every(g => g.rows.every(r => r.w === 0 && r.l === 0 && r.left === 4)));
  // No one marked through on the draw's order.
  assert.ok(groups.every(g => g.rows.every(r => !r.zone)));
});

test('The quarterfinals as the groups stand: the winners 1-3 by record, the wild card 4th; 1 v 4, 2 v 3', () => {
  const r = (id, w, l, zone = '') => ({ id, name: id, short: id, abbr: id, logo: '', w, l, pd: 0, pf: 0, zone });
  const east = [
    { conf: 'East', rows: [r('A1', 3, 0, 'lead'), r('A2', 2, 1, 'card'), r('A3', 1, 2)] },
    { conf: 'East', rows: [r('B1', 4, 0, 'lead'), r('B2', 1, 2)] },
    { conf: 'East', rows: [r('C1', 2, 1, 'lead'), r('C2', 1, 2)] }
  ];
  const [one, two, w1] = cupQuarters([...east, ...east.map(g => ({ ...g, conf: 'West' }))]);
  assert.deepEqual(one.sides.map(s => [s.id, s.seed]), [['B1', 1], ['A2', 4]]);
  assert.deepEqual(two.sides.map(s => s.id), ['A1', 'C1']);
  assert.equal(w1.labels[1], '西區外卡');
  // Before a group's first game: the places, no team.
  const [none] = cupQuarters(east.map(g => ({ ...g, rows: g.rows.map(x => ({ ...x, zone: '' })) })));
  assert.deepEqual([none.sides, none.labels], [[null, null], ['東區分組第一', '東區外卡']]);
});
