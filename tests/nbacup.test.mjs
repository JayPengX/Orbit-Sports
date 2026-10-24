import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nbaCupGroups, isGroupPlay } from '../public/lib/nbacup.mjs';

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
