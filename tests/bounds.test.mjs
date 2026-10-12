import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boundsOf, unionBounds, within, clampDay } from '../public/lib/bounds.mjs';

const all = { mlb: { from: '2026-02-21', to: '2026-11-12' }, nba: { from: '2026-10-04', to: '2027-06-26' }, mls: { from: '2026-02-22', to: '2026-12-31' }, f1: { from: '2026-03-06' } };

test("the days that can be asked for: a league's, and home's across every league", () => {
  assert.deepEqual(boundsOf(all, 'nba'), { from: '2026-10-04', to: '2027-06-26' });
  assert.equal(boundsOf(all, 'f1'), null, 'half known: nothing locked');
  assert.equal(boundsOf(null, 'nba'), null);
  assert.deepEqual(unionBounds(all, ['mlb', 'nba', 'mls', 'f1', 'cpbl']), { from: '2026-02-21', to: '2027-06-26' });
  assert.equal(unionBounds(null, ['mlb']), null);
  assert.equal(within('2026-02-20', boundsOf(all, 'mlb')), false);
  assert.equal(within('2026-11-12', boundsOf(all, 'mlb')), true);
  assert.equal(within('2030-01-01', null), true, 'not read: any day');
  assert.equal(clampDay('2027-03-01', boundsOf(all, 'mlb')), '2026-11-12');
  assert.equal(clampDay('2025-03-01', boundsOf(all, 'mlb')), '2026-02-21');
  assert.equal(clampDay('2026-05-01', null), '2026-05-01');
});
