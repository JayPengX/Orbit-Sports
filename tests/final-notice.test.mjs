// Sports' own final notice (the app open as the game ends) in the Worker's
// words, kit finalWords: who won in the title, the score in the body (Jay
// 2026-11-11: "塞爾提克 123 : 101 76 人" was hard to read). An older kit on
// the phone (no finalWords): the old line, never no notice.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

test("the app's final notice takes the kit's words, read with a fallback", () => {
  assert.match(src, /import \* as kitEspn from '#kit\/sports-espn\.mjs'/, 'a namespace import (a phone may run an older kit)');
  assert.match(src, /kitEspn\.finalWords\?\.\(/);
  assert.match(src, /title: fin \? fin\.title : matchLine\(e, true\), body: \[fin \? fin\.result : resultLine\(e\)/);
});
