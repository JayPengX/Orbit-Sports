import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mlbLiveGames, mlbGameOf, mlbBoxTables, emptyBox, mlbDate } from '../public/lib/mlb.mjs';

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

test("MLB's own live state: count, runners, batter, pitcher, the last play", () => {
  const games = mlbLiveGames(fixture('mlbapi-schedule-live.json'));
  assert.equal(games.length, 1);
  const g = mlbGameOf(games, { home: { en: 'Tampa Bay Rays', name: '光芒' }, away: { en: 'New York Yankees', name: '洋基' } });
  assert.ok(g);
  assert.equal(g.live.bases.length, 3);
  assert.ok(Number.isInteger(g.live.outs));
  assert.match(g.live.batter, /^[A-Z]\. /);
  // No MLB picture (its big cropped headshot): the app's face by name, as the box score's.
  assert.equal(g.live.pitcherWho.headshot, null);
  assert.equal(mlbGameOf(games, { home: { name: 'Cleveland Guardians' }, away: { name: 'Chicago White Sox' } }), null);
});

test("MLB's box score in ESPN's columns, the batting order kept", () => {
  const box = mlbBoxTables(fixture('mlbapi-boxscore.json'), 'home');
  assert.equal(box.batting.labels.length, box.batting.rows[0].stats.length);
  assert.equal(box.pitching.labels.length, box.pitching.rows[0].stats.length);
  assert.equal(box.batting.rows.filter(r => r.starter).length, 9);
  assert.match(box.batting.rows[0].stats[0], /^\d+-\d+$/);
  assert.ok(box.pitching.rows[0].starter);
});

test("ESPN's box score of dashes is empty; a date is MLB's (US Eastern)", () => {
  const dashes = [{ team: '30', tables: [{ rows: [{ stats: ['-----', '--', '--'] }] }] }];
  assert.ok(emptyBox(dashes));
  assert.ok(!emptyBox([{ team: '30', tables: [{ rows: [{ stats: ['1-4', '4'] }] }] }]));
  assert.equal(mlbDate('2026-10-06T03:00:00Z'), '2026-10-05');
});

import { fieldOf } from '../public/lib/mlb.mjs';
test("the field: the side in it (the home side in a top half), its nine by position, the batter, who's on base", () => {
  const ls = { currentInning: 6, isTopInning: true, outs: 1, defense: { pitcher: { fullName: 'Drew Rasmussen' }, catcher: { fullName: 'Nick Fortes' }, first: { fullName: 'Jonathan Aranda' }, shortstop: { fullName: 'Taylor Walls' } }, offense: { batter: { fullName: 'Chase DeLauter' }, battingOrder: 3, second: { fullName: 'Jo Adell' } } };
  const f = fieldOf(ls);
  assert.equal(f.fielding, 'home');
  assert.equal(f.defense.P, 'Drew Rasmussen');
  assert.equal(f.defense['1B'], 'Jonathan Aranda');
  assert.equal(f.defense.CF, '');
  assert.deepEqual(f.runners, ['', 'Jo Adell', '']);
  assert.equal(f.batter, 'Chase DeLauter');
  assert.equal(fieldOf({ ...ls, isTopInning: false }).fielding, 'away');
  assert.equal(fieldOf(null), null);
});

import { mlbLogLine, mlbGameAt } from '../public/lib/mlb.mjs';
test("a player's game in his log's columns from MLB's own box score: a batter's 2B, 3B and SO, a pitcher's GS, CG, SHO", () => {
  const ramirez = { person: { fullName: 'José Ramírez' }, stats: { batting: { atBats: 5, runs: 2, hits: 3, doubles: 1, triples: 0, homeRuns: 0, rbi: 1, baseOnBalls: 0, strikeOuts: 1 }, pitching: {} } };
  const kelly = { person: { fullName: 'Kevin Kelly' }, stats: { batting: {}, pitching: { gamesStarted: 0, completeGames: 0, shutouts: 0, inningsPitched: '1.0', hits: 2, runs: 2, earnedRuns: 2, homeRuns: 0, baseOnBalls: 1, strikeOuts: 1 } } };
  const box = { teams: { away: { players: { ID1: ramirez } }, home: { players: { ID2: kelly } } } };
  assert.deepEqual(mlbLogLine(box, 'Jose Ramirez', ['AB', 'R', 'H', '2B', '3B', 'HR', 'RBI', 'BB', 'SO']), ['5', '2', '3', '1', '0', '0', '1', '0', '1']);
  assert.deepEqual(mlbLogLine(box, 'Kevin Kelly', ['GS', 'CG', 'SHO', 'IP', 'H', 'R', 'ER', 'HR', 'BB', 'K']), ['0', '0', '0', '1.0', '2', '2', '2', '0', '1', '1']);
  assert.equal(mlbLogLine(box, 'Nobody', ['AB']), null);
  const games = [{ pk: 1, away: 'cleveland guardians', home: 'tampa bay rays', at: Date.parse('2026-10-12T17:00Z') }, { pk: 2, away: 'cleveland guardians', home: 'tampa bay rays', at: Date.parse('2026-10-12T23:00Z') }];
  assert.equal(mlbGameAt(games, { start: '2026-10-12T23:05Z', away: { en: 'Cleveland Guardians' }, home: { en: 'Tampa Bay Rays' } }).pk, 2);
});

test("A person's name as MLB's and ESPN's are compared: accents, case and a one-sided suffix aside", async () => {
  const { personKey } = await import('../public/lib/mlb.mjs');
  assert.equal(personKey('Bobby Witt'), personKey('Bobby Witt Jr.'));
  assert.equal(personKey('Ronald Acuña Jr.'), personKey('Ronald Acuna'));
  assert.notEqual(personKey('Vladimir Guerrero'), personKey('Vladimir Gutierrez'));
});
