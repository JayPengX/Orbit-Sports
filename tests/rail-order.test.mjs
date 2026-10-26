import test from 'node:test';
import assert from 'node:assert/strict';
import { byStakes, stakesOf } from '../public/lib/leagues.mjs';

test("賽事's leagues after the followed ones: what's at stake, then how watchable in Taiwan", () => {
  // sports/bounds.json on 2026-10-25, 中華職棒's 台灣大賽 its last week.
  const bounds = { mlb: { from: '2026-02-21', to: '2026-11-12' }, cpbl: { from: '2026-03-28', to: '2026-11-08' }, nba: { from: '2026-10-04', to: '2027-06-26' }, epl: { from: '2026-08-22', to: '2027-05-30' }, seriea: { from: '2026-08-23', to: '2027-05-31' }, ucl: { from: '2026-09-09', to: '2027-06-01' }, mls: { from: '2026-02-22', to: '2026-12-31' } };
  const order = byStakes(['seriea', 'mls', 'nba', 'ucl', 'epl', 'mlb', 'cpbl'], k => bounds[k] || null, '2026-10-26');
  assert.deepEqual(order, ['cpbl', 'mlb', 'mls', 'nba', 'epl', 'ucl', 'seriea']);
  assert.equal(stakesOf(null, '2026-10-26'), 0);
  // A cup: only its last rounds count (the FA Cup's days, two seasons long, read as past half).
  assert.deepEqual(byStakes(['facup', 'epl'], k => ({ facup: { from: '2025-11-01', to: '2027-05-16' }, epl: bounds.epl })[k], '2026-10-26'), ['epl', 'facup']);
});
