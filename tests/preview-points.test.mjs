// 賽前看點's points (lib/preview.mjs previewFrom): read from the family's
// file in the reader's language, two at most; a game looked at with nothing
// to tell is known (the code's line stays), a file of another shape is never read.
import test from 'node:test';
import assert from 'node:assert/strict';
import { previewFrom, previewDays, restatesTable } from '../public/lib/preview.mjs';

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

test('a point that only says the places or the gap (兩隊比較 shows them) is left out; what a result changes stays', () => {
  assert.ok(restatesTable({ zh: '排名第 2 對第 3，只差 2 分', en: '2nd v 3rd in the table, 2 points apart' }));
  assert.ok(restatesTable({ zh: '{t:1}與{t:2}勝差僅 1 場', en: '{t:1} and {t:2} one game apart' }));
  assert.ok(!restatesTable({ zh: '{t:1}贏球就升上第 4', en: 'A win lifts {t:1} to 4th' }));
  assert.ok(!restatesTable({ zh: '{t:3}缺陣至 12/21', en: '{t:3} out until Dec 21' }));
  const doc = { v: 1, games: { 'nba:9': { points: [{ k: 'table', zh: '排名第 2 對第 3，只差 2 分', en: '2nd v 3rd, 2 points apart' }, { k: 'out', zh: '{p:1}缺陣', en: '{p:1} out' }] } } };
  assert.deepEqual(previewFrom(doc, { league: 'nba', id: '9' }).points.map(p => p.k), ['out']);
});

test("outside football, a point saying the streak the card's 連勝敗 row shows is left out (馬刺 10連勝 over W10)", () => {
  const doc = { v: 1, games: { 'nba:9': { points: [{ k: 'run', zh: '{t:24}豪取10連勝，近10場全數獲勝', en: '{t:24} have won 10 straight' }, { k: 'run', zh: '{t:23}本季主場尚未取勝', en: '{t:23} winless at home' }] } } };
  assert.deepEqual(previewFrom(doc, { league: 'nba', id: '9' }, false, { sport: 'basketball' }).points.map(p => p.text), ['{t:23}本季主場尚未取勝']);
  assert.equal(previewFrom(doc, { league: 'nba', id: '9' }, false, { sport: 'soccer' }).points.length, 2);
});
