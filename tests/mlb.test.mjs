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
  assert.ok(g.live.pitcherWho.headshot.includes('mlbstatic.com'));
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
