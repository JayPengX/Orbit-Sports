import test from 'node:test';
import assert from 'node:assert/strict';
import { quieted } from '../public/lib/notice.mjs';

// Jay 11-26: a followed team's notices went at any hour; an option lets them through (off by default).
test("in the quiet hours a follow's start isn't said and its final waits, unless let through", () => {
  const at = h => Date.parse(`2026-11-27T${String(h).padStart(2, '0')}:00:00+08:00`);
  const items = [{ at: at(3), kind: 'start', tag: 's' }, { at: at(3), kind: 'end', tag: 'e' }, { at: at(20), kind: 'start', tag: 's2' }];
  const out = quieted(items, { hours: { from: 0, to: 7 }, tz: 480 });
  assert.deepEqual(out.map(x => x.tag), ['e', 's2']);
  assert.deepEqual(out[0].quiet, { from: 0, to: 7, tz: 480 });
  assert.equal(quieted(items, { loud: true, hours: { from: 0, to: 7 }, tz: 480 }).length, 3);
});

// Jay 11-26: 追蹤's 熱門球隊 followed a team on a tap of its row; the row opens the team, + alone follows.
test("熱門球隊: the row opens the team, + follows", async () => {
  const { readFileSync } = await import('node:fs');
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /class: `q-ritem suggest\$\{on \? ' on' : ''\}`, role: 'button', tabindex: '0', onclick: \(\) => openTeam\(s\.league, s\.id, side\)/);
  assert.match(app, /onclick: ev => \(ev\.stopPropagation\(\), toggleFollow\(s\.league, side\)\)/);
});
