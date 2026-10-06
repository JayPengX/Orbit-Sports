import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripDays } from '../public/lib/strip.mjs';

test("a league's strip is its season's game days, whole: it ends where the season ends (nothing to scroll into after the last game)", () => {
  const only = new Set(['2026-10-22', '2026-10-21', '2027-04-12']);
  assert.deepEqual(stripDays('2026-10-21', { only }), ['2026-10-21', '2026-10-22', '2027-04-12']);
  // A day picked from 📅 outside them is still there to be shown.
  assert.deepEqual(stripDays('2026-11-01', { only }).length, 4);
});

test("home's strip: a fixed stretch around today, across a month's and a year's end", () => {
  const days = stripDays('2026-12-31', { range: { from: -1, to: 2 }, base: '2026-12-31' });
  assert.deepEqual(days, ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
});
