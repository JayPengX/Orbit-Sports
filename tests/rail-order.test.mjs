import test from 'node:test';
import assert from 'node:assert/strict';
import { byStakes, stakesOf, bySeason, seasonState } from '../public/lib/leagues.mjs';

test("賽事's leagues after the followed ones: what's at stake, then how watchable in Taiwan", () => {
  // sports/bounds.json on 2026-10-25, 中華職棒's 台灣大賽 its last week.
  const bounds = { mlb: { from: '2026-02-21', to: '2026-11-12' }, cpbl: { from: '2026-03-28', to: '2026-11-08' }, nba: { from: '2026-10-04', to: '2027-06-26' }, epl: { from: '2026-08-22', to: '2027-05-30' }, seriea: { from: '2026-08-23', to: '2027-05-31' }, ucl: { from: '2026-09-09', to: '2027-06-01' }, mls: { from: '2026-02-22', to: '2026-12-31' } };
  const order = byStakes(['seriea', 'mls', 'nba', 'ucl', 'epl', 'mlb', 'cpbl'], k => bounds[k] || null, '2026-10-26');
  assert.deepEqual(order, ['cpbl', 'mlb', 'mls', 'nba', 'epl', 'ucl', 'seriea']);
  assert.equal(stakesOf(null, '2026-10-26'), 0);
  // A cup: only its last rounds count (the FA Cup's days, two seasons long, read as past half).
  assert.deepEqual(byStakes(['facup', 'epl'], k => ({ facup: { from: '2025-11-01', to: '2027-05-16' }, epl: bounds.epl })[k], '2026-10-26'), ['epl', 'facup']);
});

test('leagues in season first, on a break next, finished last (Jay 2026-10-28: 中華職棒 over, still on top)', () => {
  const day = '2026-10-28';
  const days = {
    cpbl: ['2026-10-20', '2026-10-25'],
    mlb: ['2026-10-27', '2026-10-28', '2026-10-29'],
    nationsleague: ['2026-11-13', '2026-11-14'],
    epl: ['2026-10-31', '2026-11-01'],
    ucl: ['2026-11-04']
  };
  const stateOf = k => seasonState(days[k] || null, day);
  assert.equal(stateOf('cpbl'), 'over');
  assert.equal(stateOf('mlb'), 'on');
  assert.equal(stateOf('nationsleague'), 'break');
  assert.equal(stateOf('nba'), 'on'); // not read yet: left where it is
  // Followed first (cpbl, nationsleague, epl), then by stakes; season beats both, order kept inside.
  assert.deepEqual(bySeason(['cpbl', 'nationsleague', 'epl', 'mlb', 'nba', 'ucl'], stateOf), ['epl', 'mlb', 'nba', 'ucl', 'nationsleague', 'cpbl']);
  // Past its last possible day a league has nothing at stake.
  assert.equal(stakesOf({ from: '2026-03-01', to: '2026-10-25' }, day), 0);
});
