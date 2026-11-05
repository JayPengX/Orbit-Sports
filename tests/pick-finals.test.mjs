import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pickFinals } from '../public/lib/notice.mjs';

const game = (id, state) => ({ league: 'nba', id, status: { state } });
const NOW = Date.parse('2026-11-05T04:41:00Z');

test('a pick already over that was never on the list is not put on it late (Jay 2026-11-05: final at 12:43, after he saw it)', () => {
  const { games } = pickFinals([{ e: game('1', 'post'), picked: true }], {}, NOW);
  assert.deepEqual(games, []);
});

test('a pick put on the list before it ended stays on it till the Worker tells it', () => {
  const first = pickFinals([{ e: game('1', 'in'), picked: true }], {}, NOW - 3_600_000);
  assert.equal(first.games.length, 1);
  const later = pickFinals([{ e: game('1', 'post'), picked: true }], first.sent, NOW);
  assert.deepEqual(later.games.map(e => e.id), ['1']);
});

test('games still to come or on go on the list; not picks never; each once; old marks dropped', () => {
  const { games, sent } = pickFinals([{ e: game('1', 'pre'), picked: true }, { e: game('1', 'pre'), picked: true }, { e: game('2', 'pre'), picked: false }], { 'nba:9': NOW - 3 * 86_400_000 }, NOW);
  assert.deepEqual(games.map(e => e.id), ['1']);
  assert.deepEqual(Object.keys(sent), ['nba:1']);
});

test("the app puts today's and tomorrow's picks' finals on ahead, and reads tomorrow's day for it", () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const sync = app.slice(app.indexOf('function syncPush()'), app.indexOf('function resultItem('));
  assert.match(sync, /\[today\(\), addDays\(today\(\), 1\)\]/);
  assert.match(sync, /pickFinals\(/);
  assert.match(app, /if \(isToday \|\| date === addDays\(today\(\), 1\)\) \{\s*clearTimeout\(pushTimer\);\s*pushTimer = setTimeout\(syncPush/);
});
