import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = process.env.ORBIT_SRC || new URL('../public/', import.meta.url).pathname;
const app = readFileSync(`${root}/app.js`, 'utf8');
const css = readFileSync(`${root}/styles.css`, 'utf8');
const body = name => {
  const i = app.indexOf(`\nfunction ${name}(`);
  return app.slice(i, app.indexOf('\n}\n', i));
};

// Jay 2026-11-21: 賽事's rows came in, then their 推薦 a moment later (the
// day read for its picks after the list was drawn). "Everything should be
// ready when you show it": the rows wait in their shape until it's known.
test("賽事 shows a day's games once its 推薦 is known, never the pills after", () => {
  const ready = body('picksReady');
  assert.match(ready, /loadDay\(d\)/);
  assert.match(ready, /renderScores\(\)/);
  // (A failed read is waited on no more: never a list held in its shape for good.)
  assert.match(ready, /pickAsked\.set\(d, 'done'\)/);
  assert.match(body('renderScores'), /if \(card && !picksReady\(sc\.date\)\) kitUI\.waiting\(card\)/);
  assert.match(body('isPickEvent'), /picksReady\(d\)/);
});

test('賽事 lights no row: every 推薦 one pill, as 轉播', () => {
  assert.match(css, /:is\(\.tv-day, #panel-matches\) \.event-row\.picked \{ background: none; \}/);
  assert.match(css, /:is\(\.tv-day, #panel-matches\) \.row-mark\.fill \{/);
});
