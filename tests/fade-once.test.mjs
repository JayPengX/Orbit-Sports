import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// A live game's panel blinked three or four times as its page opened: its top
// was moved each time the sections were laid out, and a node moved with
// .fade-in still on plays it again (Jay 11-21). The class goes once played or cut short.
test('a fade-in plays once: the class is taken off when it ends or is cut short, for every node', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const line = app.split('\n').find(l => /document\.addEventListener\(k, e => e\.animationName === 'fade-in'/.test(l));
  assert.ok(line, 'one listener on the document takes .fade-in off');
  assert.match(line, /'animationend', 'animationcancel'/);
  assert.match(line, /classList\?\.remove\('fade-in'\)/);
});
