// What the data must get right: a delay isn't a postponement, and only the
// leagues Taiwan can watch on ELTA.tv or Apple TV are here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStatus } from '../public/lib/espn.mjs';
import { LEAGUES, SPORTS } from '../public/lib/leagues.mjs';
import { BROADCAST } from '../public/lib/broadcast.mjs';

test('a delayed or suspended game is still on; a postponed one is called off', () => {
  const delayed = parseStatus({ type: { name: 'STATUS_DELAYED', state: 'in', shortDetail: 'Delayed' } });
  assert.equal(delayed.void, false);
  assert.equal(delayed.delayed, true);
  assert.equal(parseStatus({ type: { name: 'STATUS_RAIN_DELAY', state: 'in', shortDetail: 'Rain Delay, Top 5th' } }).void, false);
  assert.equal(parseStatus({ type: { name: 'STATUS_POSTPONED', state: 'post' } }).void, true);
  assert.equal(parseStatus({ type: { name: 'STATUS_IN_PROGRESS', state: 'in', shortDetail: 'Top 5th' } }).delayed, false);
});

test("the leagues on ELTA.tv, Apple TV or (Taiwan's own) YouTube, and those Jay added with no TV here (11-26)", () => {
  assert.deepEqual(Object.keys(LEAGUES).sort(), ['bundesliga', 'cpbl', 'epl', 'f1', 'facup', 'laliga', 'ligue1', 'mlb', 'mls', 'nationsleague', 'nba', 'nfl', 'scotland', 'seriea', 'tpbl', 'ucl', 'uecl', 'uel']);
  assert.deepEqual(Object.keys(BROADCAST).sort(), Object.keys(LEAGUES).sort());
  for (const [k, list] of Object.entries(BROADCAST)) for (const b of list) assert.ok(['elta', 'appletv', 'youtube'].includes(b.svc), `${k} ${b.svc}`);
  assert.deepEqual(BROADCAST.mls.map(b => b.svc), ['appletv']);
  assert.deepEqual(BROADCAST.tpbl.map(b => b.svc), ['youtube']);
  // (No other streaming service yet: no TV here is none listed.)
  assert.deepEqual([BROADCAST.laliga, BROADCAST.nfl], [[], []]);
  for (const key of ['npb', 'kbo', 'wnba', 'euroleague', 'nhl', 'jleague', 'kleague', 'formulae', 'worldcup', 'atp', 'motogp', 'badminton']) assert.equal(LEAGUES[key], undefined, key);
  assert.deepEqual(Object.keys(SPORTS).sort(), ['baseball', 'basketball', 'football', 'racing', 'soccer']);
});
