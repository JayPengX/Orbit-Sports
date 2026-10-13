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
