import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onCourt, onPitch } from '../public/lib/onfield.mjs';

test('basketball: the five marked on the court, with their points, rebounds, assists and fouls', () => {
  const labels = ['MIN', 'PTS', 'FG', '3PT', 'FT', 'REB', 'AST', 'TO', 'STL', 'BLK', 'OREB', 'DREB', 'PF', '+/-'];
  const row = (id, on, pts) => ({ id, name: id, on, stats: ['20', pts, '', '', '', '4', '3', '', '', '', '', '', '2', ''] });
  const got = onCourt([{ team: '1', tables: [{ labels, rows: [row('a', true, '12'), row('b', false, '8'), row('c', true, '3')] }] }, { team: '2', tables: [{ labels, rows: [row('d', false, '0')] }] }]);
  assert.equal(got.length, 1);
  assert.deepEqual(got[0].players.map(p => p.id), ['a', 'c']);
  assert.deepEqual(got[0].players[0].line, { pts: '12', reb: '4', ast: '3', pf: '2', min: '20' });
});

test('soccer: starters and subs on, less those off or sent off; a sub in the slot of the one he replaced', () => {
  const p = (id, o) => ({ id, name: id, place: 0, ...o });
  const got = onPitch([
    {
      team: '1',
      formation: '4-4-2',
      players: [
        p('gk', { starter: true, place: 1 }),
        p('lb', { starter: true, place: 3 }),
        p('st', { starter: true, place: 11, subbedOut: true }),
        p('mf', { starter: true, place: 7, sentOff: true }),
        p('sub', { subbedIn: true, inFor: 'st' }),
        p('sub2', { subbedIn: true, inFor: 'lb2' }),
        p('lb2', { starter: true, place: 2, subbedOut: true }),
        p('unused', {})
      ]
    }
  ]);
  assert.deepEqual(got[0].on.map(x => x.id), ['gk', 'sub2', 'lb', 'sub']);
  assert.deepEqual(got[0].off.map(x => x.id).sort(), ['lb2', 'mf', 'st']);
  assert.deepEqual(got[0].bench.map(x => x.id), ['unused']);
});

test("soccer: a sub on the pitch takes the position of the one he replaced, not ESPN's SUB", () => {
  const got = onPitch([{ team: '1', formation: '', players: [{ id: 'cb', pos: 'CD-L', place: 6, starter: true, subbedOut: true }, { id: 'sub', pos: 'SUB', place: 0, subbedIn: true, inFor: 'cb' }] }]);
  assert.equal(got[0].on[0].pos, 'CD-L');
});

import { pitchSpots } from '../public/lib/onfield.mjs';
test("the pitch: a 4-2-3-1 as ESPN marks it (its holding pair as LM and RM) in the formation's rows, each from left to right", () => {
  const xi = [['G', 1], ['RB', 2], ['LB', 3], ['LM', 4], ['CD-R', 5], ['CD-L', 6], ['AM-R', 7], ['RM', 8], ['F', 9], ['AM', 10], ['AM-L', 11]].map(([pos, place]) => ({ id: pos, pos, place }));
  const spots = pitchSpots(xi, '4-2-3-1');
  const row = y => spots.filter(s => s.y === y).sort((a, b) => a.x - b.x).map(s => s.p.pos);
  const ys = [...new Set(spots.map(s => s.y))].sort((a, b) => a - b);
  assert.deepEqual(ys.map(row), [['G'], ['LB', 'CD-L', 'CD-R', 'RB'], ['LM', 'RM'], ['AM-L', 'AM', 'AM-R'], ['F']]);
});
test('the pitch: a 3-5-2 with wing-backs, and a formation that no longer adds up (a man sent off taken out) in rows by depth', () => {
  const xi = [['G', 1], ['CD-L', 2], ['CD', 3], ['CD-R', 4], ['LWB', 5], ['CM-L', 6], ['DM', 7], ['CM-R', 8], ['RWB', 9], ['CF-L', 10], ['CF-R', 11]].map(([pos, place]) => ({ id: pos, pos, place }));
  const rows = s => [...new Set(s.map(x => x.y))].sort((a, b) => a - b).map(y => s.filter(x => x.y === y).sort((a, b) => a.x - b.x).map(x => x.p.pos));
  assert.deepEqual(rows(pitchSpots(xi, '3-5-2')), [['G'], ['CD-L', 'CD', 'CD-R'], ['LWB', 'CM-L', 'DM', 'CM-R', 'RWB'], ['CF-L', 'CF-R']]);
  assert.equal(pitchSpots(xi.slice(0, 10), '3-5-2').length, 10);
});

test('basketball: the starters sitting now, so all five are said', () => {
  const rows = [{ id: 'a', on: true, starter: true, stats: [] }, { id: 'b', on: false, starter: true, stats: [] }, { id: 'c', on: true, starter: false, stats: [] }, { id: 'd', on: false, starter: false, stats: [] }];
  const got = onCourt([{ team: '1', tables: [{ labels: [], rows }] }])[0];
  assert.deepEqual(got.players.map(p => p.id), ['a', 'c']);
  assert.deepEqual(got.resting.map(p => p.id), ['b']);
});

// The green ↑ for every one who came on (the owner, 2026-10-16): a starter back from a rest too.
test('parseSummary: a player whose last substitution brought him on came on, a starter too', async () => {
  const { parseSummary } = await import('../public/lib/espn.mjs');
  const a = (id, starter, active) => ({ athlete: { id, displayName: id }, starter, active, stats: [] });
  const sub = (inn, out) => ({ type: { text: 'Substitution' }, participants: [{ athlete: { id: inn } }, { athlete: { id: out } }] });
  const data = {
    boxscore: { players: [{ team: { id: '25' }, statistics: [{ labels: [], athletes: [a('sga', true, true), a('mara', false, true), a('hart', true, true), a('caruso', true, false)] }] }] },
    plays: [sub('mara', 'caruso'), sub('dort', 'sga'), sub('sga', 'dort')]
  };
  const rows = parseSummary(data, 'nba').players[0].tables[0].rows;
  assert.deepEqual(rows.map(r => [r.id, r.cameOn]), [['sga', true], ['mara', true], ['hart', false], ['caruso', false]]);
});

// ESPN's injury list catches up late (Durant listed day-to-day, a rest, and on the court): who has played is left off.
test('withoutPlayed: the injured who have played this game are left off; the rest kept', async () => {
  const { withoutPlayed } = await import('../public/lib/espn.mjs');
  const injuries = [{ team: '10', list: [{ id: 'kd', name: 'Durant' }, { id: 'adams', name: 'Adams' }, { id: 'x', name: 'Benched' }] }];
  const data = { players: [{ team: '10', tables: [{ rows: [{ id: 'kd', on: false, stats: ['14', '3-7'] }, { id: 'x', on: false, stats: ['0', '0-0'] }, { id: 'adams', dnp: true, stats: [] }] }] }], rosters: [] };
  assert.deepEqual(withoutPlayed(injuries, data)[0].list.map(x => x.id), ['adams', 'x']);
  assert.equal(withoutPlayed(injuries, { players: [], rosters: [] }), injuries);
});
