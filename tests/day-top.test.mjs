import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Jay 2026-11-10: a long day scrolled down, then a shorter day picked on 賽事 (a league's 賽程)
// kept the scroll and showed a screen of black. Every day strip starts its new day at the top.
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const body = name => app.slice(app.indexOf(`function ${name}(`), app.indexOf('\n}\n', app.indexOf(`function ${name}(`)));

test('a new day on 首頁, 轉播, 全部 and a league\'s 賽程 starts at the top of the page', () => {
  for (const f of ['pickAllDay', 'pickLiveDay', 'pickScoresDay']) assert.match(body(f), /toPageTop\(\)/, f);
  assert.match(body('pickScoresDay'), /if \(sc\.date !== d\) toPageTop\(\)/, 'only when the day changes (a render reading the same day never scrolls)');
});
