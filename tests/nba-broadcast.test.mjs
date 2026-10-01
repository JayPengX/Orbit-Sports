import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { broadcastsFor } from '../public/lib/broadcast.mjs';
import { nbaTaiwanGame, parseNbaTaiwanSchedule } from '../public/lib/nba-broadcast.mjs';

const raw = JSON.parse(readFileSync(new URL('./fixtures/nba-taiwan-schedule-2026-27.json', import.meta.url), 'utf8'));
const schedule = parseNbaTaiwanSchedule(raw);
const nba = (start, away, home) => ({
  league: 'nba',
  kind: 'match',
  start,
  status: { state: 'pre' },
  away: { name: away },
  home: { name: home }
});
const eltaGamesOnTaiwanDay = day => schedule.games.filter(g => g.elta && new Date(Date.parse(g.start) + 8 * 3_600_000).toISOString().slice(0, 10) === day);

test("NBA.com's Taiwan schedule selects ELTA games, including doubleheaders", () => {
  assert.equal(schedule.seasonYear, '2026-27');
  assert.equal(eltaGamesOnTaiwanDay('2026-10-21').length, 2);
  assert.equal(eltaGamesOnTaiwanDay('2026-10-22').length, 2);

  const sixers = nba('2026-10-20T23:00:00Z', 'Philadelphia 76ers', 'New York Knicks');
  const thunder = nba('2026-10-21T01:30:00Z', 'Oklahoma City Thunder', 'San Antonio Spurs');
  const celtics = nba('2026-10-20T19:00:00Z', 'Boston Celtics', 'Detroit Pistons');
  assert.equal(nbaTaiwanGame(sixers, schedule)?.elta, true);
  assert.equal(nbaTaiwanGame(thunder, schedule)?.elta, true);
  assert.equal(nbaTaiwanGame(celtics, schedule)?.elta, false);

  const watch = event => broadcastsFor(event, [], [], [], 'en', schedule).find(b => b.svc === 'elta');
  assert.equal(watch(sixers).ch, 101);
  assert.equal(watch(sixers).url, 'https://eltaott.tv/channel/play/101/1');
  assert.equal(watch(sixers).app, 'eltatv://live/101');
  assert.equal(watch(thunder).ch, 101);
  assert.equal(watch(celtics), undefined);
});
