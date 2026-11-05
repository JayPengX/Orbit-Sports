import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickKind } from '../public/lib/follows.mjs';

// A list's mark says why a game is there (Jay 2026-11-05): a followed
// league's pick is theirs, a game only 填滿空檔 put in is a fill.
test('a pick of their own (a followed league\'s chosen game) is a pick', () => {
  assert.equal(pickKind(true, true), 'pick');
});
test('a pick only 填滿空檔 put in is a fill', () => {
  assert.equal(pickKind(true, false), 'fill');
});
test('a game not picked carries no mark, followed or not', () => {
  assert.equal(pickKind(false, true), null);
  assert.equal(pickKind(false, false), null);
});
