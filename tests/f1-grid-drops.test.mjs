import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { projectGrid, dropLabel } from '../public/lib/f1.mjs';

// Jay 2026-11-21: "get the Grid Penalty info, so we can display them live in
// qualifying or the grid of pre-race … in theory give our grid result immediately".
test('the projected grid: a car N places back starts behind the one that qualified N behind it', () => {
  // Las Vegas 2026: Antonelli first, five places back: sixth, every car he passed up one (as the stewards' grid had it).
  const order = ['12', '1', '63', '4', '6', '43', '81', '30'];
  const g = projectGrid(order, [{ no: '12', kind: 'places', n: 5 }]);
  assert.deepEqual(g.map(r => r.no), ['1', '63', '4', '6', '43', '12', '81', '30']);
  assert.deepEqual(g.find(r => r.no === '12'), { no: '12', quali: 1, drop: { places: 5, back: false, pitlane: false }, pos: 6 });
  // Two drops: their sum.
  assert.equal(projectGrid(order, [{ no: '12', kind: 'places', n: 3 }, { no: '12', kind: 'places', n: 2 }]).find(r => r.no === '12').pos, 6);
  // The back of the grid after every other, then the pit lane, each in qualifying order.
  const h = projectGrid(order, [{ no: '81', kind: 'pitlane' }, { no: '1', kind: 'back' }, { no: '4', kind: 'back' }]);
  assert.deepEqual(h.map(r => r.no), ['12', '63', '6', '43', '30', '1', '4', '81']);
  // No drops: the qualifying order.
  assert.deepEqual(projectGrid(order, []).map(r => r.no), order);
});

test('a drop said short', () => {
  assert.equal(dropLabel({ places: 5 }), '罰退 5 位');
  assert.equal(dropLabel({ back: true }), '末位發車');
  assert.equal(dropLabel({ pitlane: true }), '維修區起步');
  assert.equal(dropLabel({ places: 3 }, true), '3-place drop');
});

test('drops on every session of the weekend: each board row, a qualifying\'s projected grid, the race\'s grid to come', () => {
  const sheets = readFileSync(new URL('../public/sheets.js', import.meta.url), 'utf8');
  assert.match(sheets, /weekendDrops\(sessions\)/);
  assert.match(sheets, /function projectedGrid\(cars = \[\], drops = \[\], ss\)/);
  assert.match(sheets, /const gridCard = projectedGrid\(b\.cars, drops, ss\);/);
  assert.match(sheets, /const grid = rows\?\.length && board \? projectedGrid\(board\.cars/);
  assert.match(sheets, /if \(official\.length \|\| !espnAsQualified \|\| !ss\.drops\?\.length\) return official;/);
});

// The stewards' own documents (the FIA's), read days before the race: a car
// with one, those; race control's word only for a car with none yet. The
// race's and the last race's names from the phone's schedule (Jolpica turns
// the Workers away).
test("the weekend's drops: the FIA's documents first, race control for the rest; a card before the grid is set", () => {
  const f1 = readFileSync(new URL('../public/lib/f1.mjs', import.meta.url), 'utf8');
  assert.match(f1, /getJson\(`https:\/\/f1-live\.orbit\/drops\.json\?\$\{q\}`/);
  assert.match(f1, /new URLSearchParams\(\{ start: new Date\(at\)\.toISOString\(\), name: races\[i\]\.name, prev: races\[i - 1\]\?\.name \|\| '' \}\)/);
  assert.match(f1, /\.filter\(d => !told\.has\(String\(d\.no\)\)\)/);
  const sheets = readFileSync(new URL('../public/sheets.js', import.meta.url), 'utf8');
  assert.match(sheets, /function dropsCard\(drops, sessions\)/);
  assert.match(sheets, /put\(dropsBox, dropsCard\(list, sessions\)\);/);
});

// Las Vegas 2026, as it was: qualifying, the five drops the stewards'
// documents decided days before (Antonelli 5, Piastri, Sainz and Stroll 10,
// Bearman 35), and the official grid. A dropped car takes its qualifying
// place plus N as a slot (Piastri 7th, 17th: never moved up by the others
// dropped around him); those sent past the end, at the back by how far.
test('the projected grid is the official one: Las Vegas 2026', () => {
  const quali = ['12', '3', '63', '1', '6', '41', '81', '30', '10', '43', '16', '44', '27', '55', '5', '23', '51', '11', '14', '18', '77', '87'];
  const drops = [['87', 35], ['18', 10], ['55', 10], ['12', 5], ['81', 10]].map(([no, n]) => ({ no, kind: 'places', n }));
  const official = ['3', '63', '1', '6', '41', '12', '30', '10', '43', '16', '44', '27', '5', '23', '51', '11', '81', '14', '77', '55', '18', '87'];
  assert.deepEqual(projectGrid(quali, drops).map(r => r.no), official);
});
