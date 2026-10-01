// What the data must get right: a delay isn't a postponement, and only the
// leagues Taiwan can watch on ELTA.tv or Apple TV are here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStatus } from '../public/lib/espn.mjs';
import { LEAGUES, SPORTS } from '../public/lib/leagues.mjs';
import { BROADCAST, broadcastsOf } from '../public/lib/broadcast.mjs';

test('a delayed or suspended game is still on; a postponed one is called off', () => {
  const delayed = parseStatus({ type: { name: 'STATUS_DELAYED', state: 'in', shortDetail: 'Delayed' } });
  assert.equal(delayed.void, false);
  assert.equal(delayed.delayed, true);
  assert.equal(parseStatus({ type: { name: 'STATUS_RAIN_DELAY', state: 'in', shortDetail: 'Rain Delay, Top 5th' } }).void, false);
  assert.equal(parseStatus({ type: { name: 'STATUS_POSTPONED', state: 'post' } }).void, true);
  assert.equal(parseStatus({ type: { name: 'STATUS_IN_PROGRESS', state: 'in', shortDetail: 'Top 5th' } }).delayed, false);
});

test('only the leagues on ELTA.tv or Apple TV in Taiwan, nothing else, and only those two services', () => {
  assert.deepEqual(Object.keys(LEAGUES).filter(k => !LEAGUES[k].elta).sort(), ['bundesliga', 'cpbl', 'epl', 'f1', 'f2', 'f3', 'facup', 'ligue1', 'mlb', 'mls', 'nationsleague', 'nba', 'scotland', 'seriea', 'ucl', 'uecl', 'uel']);
  assert.deepEqual(Object.keys(BROADCAST).sort(), Object.keys(LEAGUES).filter(k => !LEAGUES[k].elta).sort());
  // Everything else ELTA carries: from its own list, on ELTA.
  assert.deepEqual(Object.keys(LEAGUES).filter(k => LEAGUES[k].elta).sort(), ['elta-asiangames', 'elta-bwf', 'elta-cev', 'elta-friendly', 'elta-other', 'elta-pool', 'elta-u15', 'elta-uyl', 'elta-wtcs', 'elta-wtt']);
  for (const k of Object.keys(LEAGUES).filter(k => LEAGUES[k].elta)) assert.deepEqual(broadcastsOf(k).map(b => b.svc), ['elta'], k);
  for (const [k, list] of Object.entries(BROADCAST)) for (const b of list) assert.ok(['elta', 'appletv'].includes(b.svc), `${k} ${b.svc}`);
  assert.deepEqual(BROADCAST.mls.map(b => b.svc), ['appletv']);
  // Gone, not hidden: not on either service in Taiwan.
  for (const key of ['npb', 'kbo', 'wnba', 'euroleague', 'nfl', 'nhl', 'laliga', 'jleague', 'kleague', 'formulae', 'worldcup', 'atp', 'motogp']) assert.equal(LEAGUES[key], undefined, key);
  assert.deepEqual(Object.keys(SPORTS).sort(), ['badminton', 'baseball', 'basketball', 'billiards', 'multi', 'other', 'racing', 'soccer', 'tabletennis', 'triathlon', 'volleyball']);
});
