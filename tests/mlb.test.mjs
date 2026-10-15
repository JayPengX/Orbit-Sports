import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mlbLiveGames, mlbGameOf, mlbBoxTables, mlbSeasonTables, mlbSquad, pitcherRole, emptyBox, mlbDate } from '../public/lib/mlb.mjs';

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

test('A game to come: each lineup with its season numbers, no game columns or totals waiting to fill', () => {
  const t = mlbSeasonTables(fixture('mlbapi-boxscore.json'), 'home');
  assert.deepEqual(t.batting.labels, ['AVG', 'HR', 'RBI', 'OBP', 'SLG']);
  assert.equal(t.batting.rows.length, 9);
  assert.ok(t.batting.rows.every(r => r.stats.length === 5 && /^\.\d{3}$|^\d\.\d{3}$/.test(r.stats[0])));
  // The starting pitcher alone, his record as 勝-敗.
  assert.equal(t.pitching.rows.length, 1);
  assert.match(t.pitching.rows[0].stats[1], /^\d+-\d+$/);
  assert.equal(mlbSeasonTables({ teams: {} }, 'home'), null);
});

test("陣容: a side's whole active roster from MLB's box score, each in his role", () => {
  const sq = mlbSquad(fixture('mlbapi-boxscore.json'), 'home');
  // The nine in order (a substitute under his spot), the starter first among the pitchers.
  assert.deepEqual(sq.order.filter(p => !p.sub).map(p => p.slot), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.ok(sq.pitched[0].starter && sq.pitched.slice(1).every(p => !p.starter));
  // Everyone once: the order, the pitchers, the bullpen and the bench within the whole roster.
  const all = new Set(sq.all.map(p => p.mlbId));
  assert.ok([...sq.order, ...sq.pitched, ...sq.bullpen, ...sq.bench].every(p => all.has(p.mlbId)));
  assert.ok(sq.all.length >= 26 - 1 && sq.all.every(p => p.name && p.pos));
  assert.equal(mlbSquad({ teams: {} }, 'home'), null);
});

test("pitcherRole: a pitcher's role from his last games, not ESPN's season position", () => {
  const log = gs => ({ labels: ['GS', 'IP'], games: gs.map(n => ({ stats: [String(n), '1.0'] })) });
  // Sasaki, October 2026: "Starting Pitcher", five games out of the bullpen.
  assert.equal(pitcherRole('Starting Pitcher', log([0, 0, 0, 0, 0])), 'Relief Pitcher');
  assert.equal(pitcherRole('Relief Pitcher', log([0, 1, 0])), 'Starting Pitcher');
  assert.equal(pitcherRole('Starting Pitcher', log([1])), 'Starting Pitcher');
  // No log, or a batter's: as ESPN has it; a batter is never touched.
  assert.equal(pitcherRole('Starting Pitcher', null), 'Starting Pitcher');
  assert.equal(pitcherRole('Starting Pitcher', { labels: ['AB'], games: [{ stats: ['4'] }] }), 'Starting Pitcher');
  assert.equal(pitcherRole('Shortstop', log([0])), 'Shortstop');
});

test('between halves, the field is the next half: its side, inning and none out', () => {
  const ls = { currentInning: 8, isTopInning: false, inningState: 'End', outs: 3, defense: { pitcher: { fullName: 'Justin Wrobleski' } }, offense: { batter: { fullName: 'Garrett Mitchell' }, battingOrder: 1 } };
  const f = fieldOf(ls);
  assert.deepEqual([f.fielding, f.inning, f.top, f.outs], ['home', 9, true, 0]);
  const mid = fieldOf({ ...ls, isTopInning: true, inningState: 'Middle' });
  assert.deepEqual([mid.fielding, mid.inning, mid.top, mid.outs], ['away', 8, false, 0]);
});

import { withPitchingChange } from '../public/lib/mlb.mjs';
test("a pitcher MLB has on the mound before ESPN's plays name him: the change at the end of 過程, once", () => {
  const play = (text, half, n = 8) => ({ text, periodType: half, periodNum: n, period: `${n}th Inning`, home: 2, away: 5, kind: 'play-result' });
  const feed = [play('Blake Snell pitches to Andrew Vaughn', 'Top', 7), play('Phillips relieved Snell', 'Top', 7), play('DL Hall pitches to Kyle Tucker', 'Bottom'), play('Will Smith flied out to right.', 'Bottom')];
  const field = { fielding: 'home', inning: 9, top: true, defense: { P: 'Roki Sasaki' } };
  const out = withPitchingChange(feed, field, { home: '19', away: '8' });
  assert.equal(out.length, 5);
  assert.deepEqual([out[4].text, out[4].team, out[4].periodNum, out[4].periodType, out[4].period, out[4].alt], ['Sasaki relieved Phillips', '19', 9, 'Top', '9th Inning', 'Lineup Change']);
  // ESPN names him (or he's the one already pitching): left as it is.
  assert.equal(withPitchingChange([...feed, play('Sasaki relieved Phillips', 'Top', 9)], field, { home: '19', away: '8' }).length, 5);
  assert.equal(withPitchingChange(feed, { ...field, defense: { P: 'Tanner Phillips' } }, { home: '19', away: '8' }), feed);
  // A batter of the same name isn't him.
  assert.equal(withPitchingChange([...feed, play('Logan Webb pitches to Roki Sasaki', 'Top', 9)], field, { home: '19', away: '8' }).length, 6);
});
