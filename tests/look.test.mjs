// Orbit's own look (Jay 2026-11-03, RULEBOOK §3): on for every page, and the
// lead game's rules kept. The Rockets' red mark vanished on their red row when
// a logo sat see-through on its club's colour; the league's name was white on
// the graphite card in light.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = f => readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8');
const html = read('index.html');
const look = read('look.css');
const app = read('app.js');
const rule = sel => look.match(new RegExp(`(?:^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] || '';

test("the look is the page's own: data-look on <html>, look.css after styles.css, no switch", () => {
  assert.match(html, /<html [^>]*data-look="native"/);
  assert.ok(html.indexOf('href="./styles.css"') < html.indexOf('href="./look.css"'), 'look.css after styles.css');
  assert.doesNotMatch(app, /orbit\.look/, 'no localStorage switch left');
});

test("the lead game: each club's logo on the solid logo tile, never see-through on its colour", () => {
  assert.match(rule("html[data-look='native'][data-look='native'] .hero-game .hc-logo"), /background:\s*var\(--q-logo-bg/);
  assert.match(app, /look\.paintHero\(heroGame\(/, 'each row on its own club colour');
});

test("the lead game's words read on the graphite card in light (no white left from the old card)", () => {
  for (const sel of ['.hero-game .hc-comp b', '.hero-game .hc-mark', '.hero-game .hc-event .sess-tag'])
    assert.match(rule(`html[data-look='native'][data-look='native'] ${sel}`), /color:\s*var\(--q-label\)/, sel);
});
