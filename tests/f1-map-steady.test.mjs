import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sheets = readFileSync(new URL(`${process.env.ORBIT_SRC || '../public'}/sheets.js`, import.meta.url), 'utf8');

// Jay 2026-11-21: "the track map reset my scroll and jump the UI".
test("車手比較 (the track map's card) is one box and one card a session, kept from read to read", () => {
  assert.match(sheets, /const f1CompareBoxes = new Map\(\);/);
  assert.match(sheets, /const box = f1CompareBoxes\.get\(ss\.start\) \|\| el\('div', \{ 'data-laps': ss\.start \}\);/);
  assert.match(sheets, /const keptCard = \(title, body, sub\) =>/);
  assert.doesNotMatch(sheets, /put\(box, card\(en \? 'Compare' : '車手比較'/);
});

test('the map zooms on two taps, never on two swipes scrolling over it', () => {
  const zoom = sheets.slice(sheets.indexOf('\nfunction tmZoom('), sheets.indexOf('\nfunction trackFit('));
  // (A tap: let go where it began, within a quarter second; only then counted.)
  assert.match(zoom, /Date\.now\(\) - touch\.t < 250 && Math\.hypot\(a\.clientX - touch\.x, a\.clientY - touch\.y\) < 10/);
  assert.doesNotMatch(zoom.slice(zoom.indexOf("addEventListener('touchstart'"), zoom.indexOf("addEventListener('touchmove'")), /tapAt/);
});
