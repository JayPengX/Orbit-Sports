// 首頁 draws a day once and no game comes in after it (Jay 2026-11-04: "the
// games often jump in, and some of them load slow"; "don't jump in this
// section", a finished game's top players). What a day's list is made of is
// read before its first drawing, the day held in its shape meanwhile; the
// loading screen stays up until the move to their next day is made; a part
// read later (a finished game's top players) is held in its shape from the
// first drawing. Orbit-Core's tools/live-scroll.mjs watches the real page
// ("a game came in", on a phone's link with one league slow).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const sheets = readFileSync(new URL('../public/sheets.js', import.meta.url), 'utf8');
const body = (src, head) => {
  const at = src.indexOf(head);
  assert.ok(at >= 0, `${head} is there`);
  return src.slice(at, src.indexOf('\n}\n', at));
};
const home = body(app, 'function renderHome() {');

test('a day is held in its shape until its own leagues and 填滿空檔’s games are read, before its list is ranked', () => {
  const hold = home.indexOf('if (dayWaits(slot) && !h.picking && !holdDay(box,');
  assert.ok(hold > 0, 'renderHome holds the day while dayWaits');
  assert.ok(hold < home.indexOf('let [planList, more] = rank('), 'the hold comes before the list is made');
  const waits = app.slice(app.indexOf('const dayWaits = '), app.indexOf('\n', app.indexOf('const dayWaits = ')));
  for (const part of ['!slot?.drawn', 'slot?.partial > 0', 'state.prefs.fill', '!slot?.othersAt']) assert.ok(waits.includes(part), `dayWaits checks ${part}`);
  assert.match(home, /if \(!slot\.stale\) slot\.drawn = true;/, 'a day drawn is never dropped back to its shape');
});

test('the loading screen waits for the move to their next day, and the move waits only on their own leagues', () => {
  assert.match(home, /h\.settled = [^;]*!mayJump/, 'not settled while today may still move to their next day');
  const jump = home.slice(home.indexOf('if ((nothingToday || todayOver)'), home.indexOf('{', home.indexOf('if ((nothingToday || todayOver)')));
  assert.ok(!/\bgap\b/.test(jump), 'an other league unread (gap) never holds the move');
  assert.ok(jump.includes('slot.partial > 0') && jump.includes('tvUnread()'), 'their own leagues and ELTA’s list do');
});

test('a finished game’s top players are held in their shape while read, and the loading screen waits for them', () => {
  const recap = body(sheets, 'export function gameRecap(e, d) {');
  assert.match(recap, /if \(d === null && kitUI\.waiting\)/, 'gameRecap draws its lines’ shape while d is null (being read)');
  assert.match(home, /querySelector\('\.recap-best\.q-wait'\)\) h\.settled = false/);
});

test('a card’s top-player lines use the same stat words (9 籃板 · 3 助攻 beside 7 板 · 4 助 never)', () => {
  const recap = body(sheets, 'export function gameRecap(e, d) {');
  assert.match(recap, /'data-same': 'recap'/);
  assert.match(sheets, /group\.some\(x => x\.__pick\?\.tight\)/, 'one line short means every line short');
});

test('a game of theirs on TV is lit in every list at once, not once 首頁 has drawn its day', () => {
  const pick = body(app, 'function isPickEvent(e) {');
  const lit = pick.indexOf('if (ownGame(e) && !practice(e) && (isFollowedGame(e) || onTv(e))');
  assert.ok(lit > 0 && lit < pick.indexOf('if (!slot?.events?.length) return false;'), 'lit before the day is read');
});
