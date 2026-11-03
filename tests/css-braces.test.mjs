// Every stylesheet's braces pair up. A stray "}" drops the rule after it
// without a word (2026-11-03: .wp-chart was lost, so every chance chart drew
// 320 wide and a finger on it read past the lines' end, into nothing).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../public/', import.meta.url);
for (const f of readdirSync(dir).filter(f => f.endsWith('.css'))) {
  test(`${f}: every { has its }`, () => {
    const css = readFileSync(new URL(f, dir), 'utf8').replace(/\/\*[\s\S]*?\*\//g, c => c.replace(/[^\n]/g, '')).replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""');
    let depth = 0;
    css.split('\n').forEach((line, i) => {
      for (const ch of line) {
        if (ch === '{') depth++;
        else if (ch === '}' && --depth < 0) assert.fail(`${f}:${i + 1}: a } with no { (the rule after it is dropped)`);
      }
    });
    assert.equal(depth, 0, `${f}: ${depth} { never closed`);
  });
}
