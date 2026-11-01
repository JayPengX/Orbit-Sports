import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nbaCupGroups, isGroupPlay, cupQuarters, cupGroupColumn, cupNote } from '../public/lib/nbacup.mjs';

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

test("The groups as the bracket's first column: each card beside the quarterfinal place it fills", () => {
  const r = (id, w, l, zone = '') => ({ id, name: id, short: id, abbr: id, logo: '', w, l, pd: 0, pf: 0, zone });
  // (East ids: 1 Hawks, 2 Celtics, 4 Bulls, 5 Cavaliers, 8 Pistons, 11 Pacers…)
  const groups = [
    { conf: 'East', rows: [r('1', 3, 0, 'lead'), r('2', 2, 1, 'card')] },
    { conf: 'East', rows: [r('5', 4, 0, 'lead'), r('11', 1, 2)] },
    { conf: 'East', rows: [r('8', 2, 1, 'lead'), r('4', 1, 2)] }
  ];
  const col = cupGroupColumn(groups, cupQuarters(groups));
  // 1 v 4: the 4-0 group, the wild card; 2 v 3: the 3-0 group, the 2-1 one (no West groups here: its places empty).
  assert.deepEqual(col.map(c => c && `${c.group.kind}:${c.group.rows[0].id}`), ['group:5', 'card:2', 'group:1', 'group:8', null, null, null, null]);
});

// Jay, 2026-11-01: teams level on record settled by the cup's own steps, the reason said.
const g = (id, home, away, hs, as, lines = null) => ({ id, league: 'nba', note: 'NBA Cup - Group Play', start: '2026-11-01T00:00Z', status: { state: hs == null ? 'pre' : 'post' }, home: { id: home, name: home, score: hs == null ? '' : String(hs), ...(lines ? { lines: lines[0] } : {}) }, away: { id: away, name: away, score: as == null ? '' : String(as), ...(lines ? { lines: lines[1] } : {}) } });
// One East group of five (ids 1, 2, 4, 5, 8), the rest of its games to come.
const rest = (played, all = [['1', '2'], ['1', '4'], ['1', '5'], ['1', '8'], ['2', '4'], ['2', '5'], ['2', '8'], ['4', '5'], ['4', '8'], ['5', '8']]) => [...played, ...all.filter(([a, b]) => !played.some(e => [e.home.id, e.away.id].sort().join() === [a, b].sort().join())).map(([a, b], i) => g(`x${i}`, a, b))];

test('level on record: head-to-head first', () => {
  // 2 beat 1; both 1-1 after 1 beat 4 by 30 and 2 lost to 5 by 1.
  const [grp] = nbaCupGroups(rest([g('a', '2', '1', 100, 99), g('b', '1', '4', 130, 100), g('c', '5', '2', 101, 100)]));
  const order = grp.rows.map(r => r.id);
  assert.ok(order.indexOf('2') < order.indexOf('1'));
  // (2 v 1 is for second, not first: no reason said. Only first place's.)
  assert.ok(grp.notes.every(x => x.ahead === grp.rows[0].id));
});

test('level, never met: point differential, then total points, overtime not counted', () => {
  // 1 and 2 both 1-0, not met: 1 by 10, 2 by 4 in regulation (by 20 after overtime).
  const ot = [['25', '25', '25', '25', '20'], ['25', '25', '25', '25', '4']];
  const [grp] = nbaCupGroups(rest([g('a', '1', '4', 110, 100), g('b', '2', '5', 120, 104, ot)]));
  assert.deepEqual(grp.rows.slice(0, 2).map(r => r.id), ['1', '2']);
  assert.equal(grp.rows.find(r => r.id === '2').pd, 0);
  const n = grp.notes.find(x => x.ahead === '1' && x.behind === '2');
  assert.deepEqual([n.by, n.values], ['pd', [10, 0]]);
  assert.deepEqual(cupNote(n, id => `T${id}`), { a: 'T1', b: 'T2', why: '分差 +10/0', seed: false });
  // Same margin: more points.
  const [same] = nbaCupGroups(rest([g('a', '1', '4', 110, 100), g('b', '2', '5', 120, 110)]));
  assert.deepEqual([same.rows[0].id, same.notes.find(x => x.ahead === '2').by], ['2', 'pf']);
});

test("level on all of it: last season's record, else the league's draw", () => {
  const games = rest([g('a', '1', '4', 110, 100), g('b', '2', '5', 110, 100)]);
  const [grp] = nbaCupGroups(games, { prev: { 1: { w: 40, l: 42 }, 2: { w: 60, l: 22 }, 4: { w: 30, l: 52 }, 5: { w: 30, l: 52 }, 8: { w: 30, l: 52 } } });
  assert.equal(grp.rows[0].id, '2');
  assert.deepEqual(grp.notes.find(x => x.ahead === '2' && x.behind === '1').values, ['60-22', '40-42']);
  const [none] = nbaCupGroups(games);
  assert.equal(none.notes.find(x => x.behind === '2' || x.ahead === '2').by, 'draw');
});

test('the wild card and the seeds: no head-to-head, point differential first', () => {
  const r = (id, w, l, pd, zone) => ({ id, name: id, short: id, w, l, pd, pf: 100, zone });
  const east = [
    { conf: 'East', rows: [r('1', 1, 0, 3, 'lead'), r('2', 1, 0, 9, '')] },
    { conf: 'East', rows: [r('5', 1, 0, 12, 'lead'), r('11', 1, 0, 20, '')] },
    { conf: 'East', rows: [r('8', 1, 0, 7, 'lead'), r('4', 1, 0, 1, '')] }
  ];
  east[0].rows[1].zone = '';
  east[1].rows[1].zone = 'card';
  const [one, two] = cupQuarters(east);
  assert.deepEqual(one.sides.map(s => s.id), ['5', '11']);
  assert.deepEqual(two.sides.map(s => s.id), ['8', '1']);
  assert.equal(one.notes[0].by, 'pd');
  const col = cupGroupColumn(east, [one, two]);
  const card = col.find(c => c?.group.kind === 'card').group;
  assert.deepEqual(card.rows.map(x => x.id), ['11', '2', '4']);
  assert.ok(card.notes.every(n => n.by === 'pd'));
});

test("a group's card in the bracket carries its reasons", () => {
  const groups = nbaCupGroups(rest([g('a', '1', '4', 110, 100), g('b', '2', '5', 120, 104)]));
  const col = cupGroupColumn(groups, cupQuarters(groups));
  assert.equal(col.find(c => c?.group.kind === 'group').group.notes[0].by, 'pd');
});

test('only the same record is level: a 0-0 above a 0-1, no reason given', () => {
  const [grp] = nbaCupGroups(rest([g('a', '1', '4', 110, 100)]));
  assert.deepEqual(grp.rows.map(r => r.id), ['1', '2', '5', '8', '4']);
  assert.ok(!grp.notes.some(n => n.ahead === '8' && n.behind === '4'));
});
