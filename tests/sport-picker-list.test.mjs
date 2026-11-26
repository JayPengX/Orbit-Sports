import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const cards = readFileSync(new URL('../public/cards.js', import.meta.url), 'utf8');

// Jay 2026-11-26: the first open's three big colour cards and an empty screen, "badly looking": one list,
// each sport its leagues by name, a picked one's leagues as chips to switch.
test("first run's sports: one list, each its leagues named, a picked one's leagues as chips", () => {
  assert.match(app, /el\('div', \{ class: 'q-card list sport-list' \}, rows\)/);
  assert.match(app, /onclick: \(\) => toggleLeague\(x\)/);
  assert.match(cards, /export function sportRow\(\{ key, name, line, marks, order, onclick, leagues \}\)/);
  assert.doesNotMatch(cards, /sport-card/);
});
