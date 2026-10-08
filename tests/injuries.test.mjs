// ESPN's league injury report: each team's players, their status, what, when back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLeagueInjuries } from '../public/lib/espn.mjs';

test("a league's report by team", () => {
  const data = { injuries: [
    { id: '1', injuries: [{ status: 'Day-To-Day', date: '2026-10-06T00:29Z', shortComment: 'Cut lip.', athlete: { displayName: 'Aaron Wiggins', links: [{ rel: ['playercard', 'desktop'], href: 'https://www.espn.com/nba/player/_/id/4397183/aaron-wiggins' }] }, details: { type: 'Lips', detail: 'Laceration', returnDate: '2026-10-08' } }] },
    { id: '2', injuries: [] }
  ] };
  assert.deepEqual(parseLeagueInjuries(data), { 1: [{ id: '4397183', name: 'Aaron Wiggins', headshot: null, status: 'Day-To-Day', what: 'Lips Laceration', back: '2026-10-08', date: '2026-10-06T00:29Z', comment: 'Cut lip.' }] });
  assert.deepEqual(parseLeagueInjuries(null), {});
});
