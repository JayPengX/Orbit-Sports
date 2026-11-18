// An opening asks the Pass once: the Pass turning live as Sports opens is
// that opening, its copy the start's own reply (a second read of the
// account on every opening, 11-18). The follows aren't written again when
// they're the Pass's already and this phone has learned nothing to send.
// Behind the loading screen, 首頁 is drawn at most every 200 ms (13 drawings
// before it was up on a slow link).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

test("the 'active' check waits for the opening's own start", () => {
  assert.match(app, /q\.on\('active', live => live && !passStarting && /);
  assert.match(app, /passStarting = true;\n\s*const starting = q\.start\(\)\.finally\(\(\) => \(passStarting = false\)\);/);
});

test('the follows are sent only with something new', () => {
  assert.match(app, /if \(same && \(sessionStorage\.getItem\('fx\.followsSynced'\) \|\| !Object\.keys\(affinityPatch\('match'\)\.settings\['aff:match'\]\.value\)\.length\)\) return;/);
});

test('首頁 behind the loading screen is drawn once for reads landing together', () => {
  assert.match(app, /function renderHome\(\) \{\n\s*if \(homeHeld\(\)\) return;/);
  assert.match(app, /const wait = \$\('loading'\)\.hidden \? 0 : homeDrawnAt \+ HOME_GAP - performance\.now\(\);/);
});
