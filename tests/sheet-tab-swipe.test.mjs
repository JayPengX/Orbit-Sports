// Jay 2026-11-17 ("allow swipe between section in sheet"): a sideways swipe
// on a game's page goes to the tab beside (概況 數據 陣容 排名), as on a team's
// and a player's. The head and the tabs stay put while the rest slides; a
// chart scrubbed by a finger sideways keeps its finger (data-noswipe).
// The real gesture: Orbit-Core tools/shots pages `game-swipe`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../public/sheets.js', import.meta.url), 'utf8');
const body = name => {
  const at = src.indexOf(name);
  assert.ok(at >= 0, name);
  return src.slice(at, src.indexOf('\n}\n', at));
};

test("a game's page swipes between its tabs", () => {
  const open = body('export async function openMatch(');
  assert.match(open, /swipeTabs\(s\.body, \(\) => \(\{ list: tabKeys, now: view,/);
  assert.match(open, /tabKeys = tabs\.length > 1 \? tabs\.map/);
  assert.match(open, /header\.classList\.add\('q-day-still'\)/);
  assert.match(open, /sections\.classList\.add\('q-day-still'\)/);
});

test("a team's and a player's pages swipe between theirs", () => {
  assert.equal((src.match(/\bswipeTabs\(/g) || []).length, 4, 'the helper and its three pages');
});

test('swipeTabs goes through the kit daySwipe', () => {
  assert.match(body('function swipeTabs('), /kitUI\.daySwipe\(node,/);
});

test('charts a finger scrubs sideways keep the finger', () => {
  for (const cls of ["class: 'wp-plot',", "class: 'wp-plot f1f-plot',", 'class: `hp-plot']) {
    const at = src.indexOf(cls);
    assert.ok(at >= 0, cls);
    assert.match(src.slice(at, at + 200), /'data-noswipe': ''/, cls);
  }
  assert.match(src, /svg\.toggleAttribute\('data-noswipe', m\.z > 1\.01\)/);
});
