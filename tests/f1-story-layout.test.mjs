// 過程's card is the box `.f1-story`; the AI's old one-line story was drawn
// as `p.lp-why.f1-story` with a flex rule on the bare class, which squeezed
// 過程 to half width, a character a line (Jay 11-11). Its rules stay scoped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');

test('過程 (.f1-story) is never laid out as a row: no bare .f1-story rule sets display', () => {
  const bare = [...css.matchAll(/(^|[},]\s*)\.f1-story\s*\{([^}]*)\}/gm)].map(m => m[2]);
  assert.ok(!bare.some(b => /display\s*:\s*(inline-)?(flex|grid)/.test(b)), 'a bare .f1-story rule with display');
});
