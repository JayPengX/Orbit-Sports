// 賽事 comes back as it was left (Jay 2026-11-06, an iPad: "switching back
// to tab like 賽程 has shuffle which should not have"). Drawn anew on the way
// back, a league's day came eight games first and the rest six at a time,
// and the wide page's columns (CSS columns, filled down each in turn) dealt
// the cards again with every few: they hopped from column to column.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const body = (src, head) => {
  const at = src.indexOf(head);
  assert.ok(at >= 0, `${head} is there`);
  return src.slice(at, src.indexOf('\n}\n', at));
};

test('back on 賽事, the page is changed in place (quiet), never drawn anew', () => {
  const show = body(app, 'function showTab(tab) {');
  const matches = show.slice(show.indexOf("if (tab === 'matches')"), show.indexOf("if (tab === 'live')"));
  assert.match(matches, /state\.scores\.byDay \? quietScores\(\) : loadScores\(\)/);
  assert.doesNotMatch(matches, /\? renderScores\(\)/, 'a plain renderScores() draws the games anew, a few at a time');
  const quiet = body(app, 'function quietScores() {');
  assert.match(quiet, /scoresQuiet = true;[\s\S]*renderScores\(\);[\s\S]*finally \{\s*scoresQuiet = false;/);
});

test('a league day on a wide page draws every game at once (its columns are dealt once)', () => {
  const render = body(app, 'function renderScores() {');
  assert.match(render, /const whole = scoresQuiet \|\| document\.documentElement\.classList\.contains\('q-wide'\);/);
  assert.match(render, /\(whole \? shown : shown\.slice\(0, FIRST_ROWS\)\)/);
  assert.match(render, /if \(card && !whole\) moreRows\(/, 'more rows later only where the list is one column');
});
