// 轉播's tab badge said 1 (F1's FP3 live on MAX5台) while its list left the
// session out: the list dropped every practice, the badge counted every live
// showing on TV (Jay 2026-11-21). One list now, read by both.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const body = name => {
  const at = src.indexOf(`function ${name}(`);
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
