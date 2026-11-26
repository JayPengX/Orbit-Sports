import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');

// Jay 2026-11-26: "be consistent" — grey to find the one or two picks among a day's games (賽事: many NBA games, the ELTA
// one grey), never where every game is a pick or the list is chosen for them already (a series' three games).
test("a pick's row is grey among all the games, never in a series' games or a list of picks only", () => {
  assert.match(css, /\n\.event-row\.picked \{ background: var\(--q-fill-4\); \}/);
  const none = /:is\(([^)]*)\) \.event-row\.picked \{ background: none; \}/.exec(css)?.[1] || '';
  for (const list of ['.tie-games', '.pick-list', '.live-now', '.mine-list', '.tv-day']) assert.ok(none.includes(list), list);
  // 賽事 and a 填滿空檔 pick lit as any other: no exception left for them.
  assert.doesNotMatch(css, /#panel-matches\) \.event-row\.picked|\.event-row\.picked\.fill-pick \{ background: none/);
});
