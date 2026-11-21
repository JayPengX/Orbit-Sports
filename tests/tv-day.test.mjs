// 轉播's tab badge said 1 (F1's FP3 live on MAX5台) while its list left the
// session out: the list dropped every practice, the badge counted every live
// showing on TV (Jay 2026-11-21). One list now, read by both.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const body = name => {
  const at = Math.max(src.indexOf(`\nfunction ${name}(`), src.indexOf(`async function ${name}(`));
  assert.ok(at > 0, `${name} is there`);
  return src.slice(at, src.indexOf('\n}\n', at));
};

test("轉播's day lists every showing on TV, F1 practice included", () => {
  const day = body('tvDay');
  assert.doesNotMatch(day, /practice\(/, 'no practice dropped: ELTA airs every F1 session');
  assert.match(day, /onTv\(e\)/);
});

test('the list and the tab badge read the same day', () => {
  assert.match(body('renderLive'), /const list = tvDay\(d\);/);
  assert.match(body('renderTabs'), /tabNav\.badge\('live', tvDay\(today\(\)\)\.filter\(/);
});

test("their own game is the one row that stands out on 轉播 (Jay 2026-11-21: the followed NBA game lost among the rows)", () => {
  assert.match(body('renderLive'), /eventRow\(e, \{ day: false, mine: isFollowedEvent\(e, \{ chosen: false \}\) \}\)/);
  const ui = readFileSync(new URL('../public/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /const markCls = mine \? ' mine'/, 'the row lit');
  assert.match(ui, /mine \? mineMark\(\) : rowMark\(picked\)/, 'its ★ 追蹤中 pill in the 推薦 pill\'s place');
});

test("games over go under 已結束 at the foot of 轉播's list, never first (Jay 2026-11-21)", () => {
  const live = body('renderLive');
  assert.match(live, /const items = up\.length && done\.length \? \[\.\.\.up\.map\(row\), el\('p', \{ class: 'day-head tv-ended'/);
  assert.match(live, /const done = rest\.filter\(e => e\.status\.state === 'post'\);/);
});

test("an F1 session on 轉播 takes its state by the one rule (F1's feed first), never a copy's from before it ended (Jay 2026-11-21: FP3 正在進行 and the badge 1 after it ended)", () => {
  assert.match(body('tvDay'), /e\.sessionKey \? .*sessionStatus\(\{ abbr: e\.sessionKey, start: e\.official \|\| e\.start, status: e\.status \}\)/);
});

test("the F1 feed is read for a session 轉播 lists, not only the day's main lists' (FP3's board empty, never ended, 2026-11-21)", () => {
  assert.match(body('pollF1Live'), /\.\.\.tvDay\(today\(\)\)\]\.filter\(e => e\.league === 'f1' && e\.sessionKey/);
});
