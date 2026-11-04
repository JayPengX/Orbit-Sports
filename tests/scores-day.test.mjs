import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chosenOf } from '../public/lib/strip.mjs';

// Jay 2026-11-04: 全部 on a day, 還有 4 場 into the league, then 全部 again
// went back to today whatever day he had picked. The day chosen in 賽事
// goes with every switch (全部 ↔ a league, a league ↔ another).
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const fn = name => {
  const at = app.indexOf(`function ${name}(`);
  assert.ok(at >= 0, name);
  return app.slice(at, app.indexOf('\n}\n', at));
};

test('a chosen day is kept; today is null (today, whichever day that is now)', () => {
  assert.equal(chosenOf('2026-11-06', '2026-11-04'), '2026-11-06');
  assert.equal(chosenOf('2026-11-04', '2026-11-04'), null);
  assert.equal(chosenOf(null, '2026-11-04'), null);
});

test("賽事 keeps the chosen day across 全部 and a league", () => {
  // Back to 全部 (its chip, a swipe past the first league): on the chosen day, never today by force.
  assert.doesNotMatch(app, /openAll\(today\(\)\)/);
  assert.match(fn('leagueRail'), /openAll\(state\.scores\.chosen \|\| today\(\)\)/);
  assert.match(fn('stepLeague'), /openAll\(state\.scores\.chosen \|\| today\(\)\)/);
  // Each way a day is chosen notes it.
  for (const name of ['openAll', 'pickAllDay', 'openScores', 'pickScoresDay']) assert.match(fn(name), /chosen/, name);
  // Another league opens on the chosen day when it plays then (loadScores falls back to its own day when not).
  assert.match(fn('pickLeague'), /date: sc\.chosen \|\| null/);
});
