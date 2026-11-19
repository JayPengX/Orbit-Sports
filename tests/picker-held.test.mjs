// The first run's picker stays up while a picked sport's day is read (11-19:
// a sport tapped read its day, and the home's loading shape replaced the
// picker for half a second, the whole page grey under the finger).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test("the home's loading shape keeps the picker on a first run", () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const at = app.indexOf('function renderHome()');
  const branch = app.slice(at, app.indexOf('centerChosen(box);', at));
  assert.match(branch, /const picking = h\.picking \|\| \(state\.prefsLoaded && !state\.prefs\.leagues\.length\);/);
  assert.match(branch, /put\(box, homeBar\(\), homeFilters\(\), picking \? sportPicker\(\) : null,/);
});
