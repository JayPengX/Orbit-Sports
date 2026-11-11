// 賽前看點's points (lib/preview.mjs previewFrom): read from the family's
// file in the reader's language, two at most; a game looked at with nothing
// to tell is known (the code's line stays), a file of another shape is never read.
import test from 'node:test';
import assert from 'node:assert/strict';
import { previewFrom, previewDays } from '../public/lib/preview.mjs';

const e = { league: 'nba', id: '9', start: '2026-11-13T01:00:00Z' };
const doc = { v: 1, games: { 'nba:9': { points: [{ k: 'out', zh: '{t:16}少了{p:1}', en: '{t:16} without {p:1}' }, { k: 'odd', zh: '{p:2}上一場攻下43分', en: '{p:2} scored 43 last time' }, { k: 'run', zh: '第三點不該出現', en: 'x' }], who: { 1: { short: 'A. Edwards' } } }, 'nba:10': null } };

test('the points in the reader language, an unknown kind drawn as a star, two at most', () => {
  const got = previewFrom(doc, e);
  assert.deepEqual(got.points, [{ k: 'out', text: '{t:16}少了{p:1}' }, { k: 'star', text: '{p:2}上一場攻下43分' }]);
  assert.equal(previewFrom(doc, e, true).points[0].text, '{t:16} without {p:1}');
  assert.equal(got.who[1].short, 'A. Edwards');
});

test('nothing to tell, not made yet, another shape', () => {
  assert.deepEqual(previewFrom(doc, { ...e, id: '10' }), { points: [], who: {}, known: true });
  assert.equal(previewFrom(doc, { ...e, id: '11' }).known, false);
  assert.equal(previewFrom({ games: doc.games }, e).points.length, 0);
});

test("a game's file: the Taiwan day before it starts (the scoreboard's US day), then its own", () => {
  assert.deepEqual(previewDays(e), ['2026-11-12', '2026-11-13']);
  assert.deepEqual(previewDays({ start: '2026-11-12T17:00:00Z' }), ['2026-11-12', '2026-11-13']);
});
