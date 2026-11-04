import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 轉播's 我的比賽 lists only their own games, so no row is lit grey there
// (Jay 2026-11-05: "this area is always your followings"). 首頁 and 賽事 keep
// the grey on a picked row among all games.
const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

test('轉播 我的比賽 is drawn as .mine-list', () => {
  assert.match(app, /section\(t\('myGames'\), el\('div', \{ class: 'by-day mine-list' \}/);
});

test('a picked row in .mine-list has no grey fill', () => {
  assert.match(css, /\n\.mine-list \.event-row\.picked \{ background: none; \}/);
});

test('a picked row elsewhere keeps its grey', () => {
  assert.match(css, /\n\.event-row\.picked \{ background: var\(--q-fill-4\); \}/);
});
