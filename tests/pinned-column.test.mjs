// The pinned name column of a table on a game's sheet (a team's season
// averages): the sheet's card colour, not the page card's darker graphite,
// and its row lines drawn by its own cells, so they meet the rest's
// (Jay 2026-11-04: "why the stats table colored weirdly").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const look = readFileSync(new URL('../public/look.css', import.meta.url), 'utf8');
const kit = readFileSync(new URL('../.kit/orbit.css', import.meta.url), 'utf8');

test('on a sheet, the pin is the lifted card\'s own colour', () => {
  const up = kit.match(/--nv-card-up:\s*linear-gradient\(180deg,\s*(#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/i);
  assert.ok(up, 'the kit draws a sheet\'s card as a gradient');
  const pins = [...look.matchAll(/:is\(\.q-sheet, \.q-raised\)\)\s*\{\s*--sp-pin:\s*(#[0-9a-f]{6})/gi)].map(m => m[1]);
  assert.equal(pins.length, 2, 'both dark rules (the system\'s and the chosen theme) set the pin on a sheet');
  const level = h => parseInt(h.slice(1, 3), 16);
  for (const p of pins) assert.ok(level(p) <= level(up[1]) && level(p) >= level(up[2]), `${p} sits inside the card's ${up[1]}…${up[2]}`);
});

test('every row line is the cell\'s own (no collapsed border under the pin)', () => {
  assert.match(look, /\.table-wrap > table \{\s*border-collapse: separate;\s*border-spacing: 0;/);
});
