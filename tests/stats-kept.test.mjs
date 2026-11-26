import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sheets = readFileSync(new URL('../public/sheets.js', import.meta.url), 'utf8');

// Jay 2026-11-26, Costinha's 本場 (2 shots, 2 fouls, fouled once, a red): "quite empty". ESPN gave seven numbers;
// the grid kept its first full row of four and cut the rest. A grid of figures keeps every one (kit .q-rows-keep).
test('every stat grid keeps all its numbers, never cut to full rows', () => {
  assert.ok(sheets.includes('stat-grid'));
  assert.doesNotMatch(sheets, /q-rows-full (?!q-rows-keep)[^'"`]*stat-grid/);
  assert.doesNotMatch(sheets, /class: [`'"](?![^`'"]*q-rows-keep)[^`'"]*q-rows-full[^`'"]*stat-grid/);
});

test("a footballer's minutes in a game: from the start or coming on, to going off, a red, or the whistle", async () => {
  const { minutesPlayed } = await import('../public/lib/onfield.mjs');
  const over = { state: 'post', period: 2 };
  assert.equal(minutesPlayed({ played: true, starter: true }, over), 90);
  assert.equal(minutesPlayed({ played: true, starter: true, sentOff: true, sentAt: "58'" }, over), 58);
  assert.equal(minutesPlayed({ played: true, subbedIn: true, subAt: "71'" }, over), 19);
  assert.equal(minutesPlayed({ played: true, starter: true, subbedOut: true, subAt: "45'+2'" }, over), 47);
  assert.equal(minutesPlayed({ played: true, starter: true }, { state: 'in', clock: "67'" }), 67);
  assert.equal(minutesPlayed({ played: true, subbedIn: true, subbedOut: true, subAt: "60'" }, over), null);
});
