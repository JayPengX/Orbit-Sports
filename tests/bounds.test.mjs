import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boundsOf, unionBounds, within, clampDay, playsWithin } from '../public/lib/bounds.mjs';

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

test("a league in season by its game days: in the window or not, and no list never hides it", () => {
  const days = ['2026-10-24', '2026-10-25', '2026-11-01'];
  assert.equal(playsWithin(days, '2026-10-22', '2027-01-04'), true);
  assert.equal(playsWithin(days, '2026-11-02', '2027-01-15'), false, 'the World Series over: out of season');
  assert.equal(playsWithin(days, '2026-11-01', '2026-11-01'), true, 'both ends count');
  assert.equal(playsWithin([], '2026-10-22', '2027-01-04'), null, 'an empty list says nothing');
  assert.equal(playsWithin(undefined, '2026-10-22', '2027-01-04'), null, 'unread: asked another way');
});

// (2026-11-05, a first open on a phone's link: each league's scoreboard and the
// UEFA cups' month pages, 280 KB, were read to say which leagues are in season,
// in with the first screen's own reads; the days packs are a few hundred bytes.)
test("which leagues are in season is read from their days packs before any ESPN page", () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const at = app.indexOf('async function leagueHasGames(');
  const fn = app.slice(at, app.indexOf('\n}\n', at));
  const pack = fn.indexOf('packJson(`sports/${k}/days.json`');
  assert.ok(pack > 0, 'the days pack is read');
  assert.ok(pack < fn.indexOf('seasonCalendar('), 'before the calendar page');
  assert.ok(pack < fn.indexOf('monthsBetween('), "before a cup's month pages");
  assert.ok(pack < fn.indexOf('seasonEvents('), 'before the season');
  assert.match(fn, /if \(known != null\) return known;/, 'an answer from the pack is the answer; none, the pages as before');
});
