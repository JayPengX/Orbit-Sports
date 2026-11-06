// A driver's name whole where it fits, else short (sheets.js fitNameList):
// every name measured in one go. Written then measured one name at a time,
// each name laid the whole sheet out again: an F1 session's order and its
// 數據 hold a few hundred names, and a tap on 一練 / 二練 froze an iPad for
// a second (Jay 2026-11-06: "switching between is laggy").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sheets = readFileSync(new URL('../public/sheets.js', import.meta.url), 'utf8');
const body = (src, head) => {
  const at = src.indexOf(head);
  assert.ok(at >= 0, `${head} is there`);
  return src.slice(at, src.indexOf('\n}\n', at) + 2);
};

// A page whose layout is dirtied by any write and laid out again by the first measure after it.
function page(box) {
  const state = { dirty: false, layouts: 0 };
  const overflows = n => {
    if (state.dirty) (state.layouts++, (state.dirty = false));
    return n.text.length > box;
  };
  const name = (full, short) => ({
    dataset: { full, short },
    text: 'x',
    get textContent() { return this.text; },
    set textContent(v) { this.text = v; state.dirty = true; }
  });
  return { state, overflows, name };
}

test('three hundred names are fitted in three layouts, each the right length', () => {
  const { state, overflows, name } = page(12);
  const fit = new Function('overflows', `${body(sheets, 'function fitNameList(names) {')}; return fitNameList;`)(overflows);
  const names = [];
  for (let i = 0; i < 100; i++) names.push(name('Max Verstappen', 'M. Verstappen'), name('Lando Norris', 'L. Norris'), name('Shai Gilgeous-Alexander', 'S. Gilgeous-Alexander'));
  fit(names);
  assert.ok(state.layouts <= 3, `${state.layouts} layouts`);
  assert.deepEqual([...new Set(names.map(n => n.textContent))], ['Verstappen', 'Lando Norris', 'Gilgeous-Alexander']);
});

test('the watcher hands the names over together, never measures one by one', () => {
  const at = sheets.indexOf('const fitWatch = ');
  const watch = sheets.slice(at, sheets.indexOf('\n  : null;', at));
  assert.match(watch, /fitNameList\(names\)/);
  assert.doesNotMatch(watch, /overflows\(/);
});
