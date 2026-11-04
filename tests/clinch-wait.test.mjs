// The clinch card's day ("第一最快 1/28 才會確定") comes from the leader's own
// schedule, read after the table. Jay 2026-11-04: the card showed "最快第 8 場"
// first, then jumped to "1/28". While that read is out the line is drawn
// waiting (kit waiting, in its shape), and the words appear once, final.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../public/sheets.js', import.meta.url), 'utf8');
const part = src.slice(src.indexOf('const clinchGames = new Map();'), src.indexOf('// `asIs`'));

function load(teamSchedule) {
  return new Function('teamSchedule', `${part}; return { clinchGame, clinchPending };`)(teamSchedule);
}
const tick = () => new Promise(r => setTimeout(r, 0));

test('a clinch day is pending while its schedule is read, then final', async () => {
  let done;
  const { clinchGame, clinchPending } = load(() => new Promise(r => (done = r)));
  let told = 0;
  assert.equal(clinchGame('nba', '20', 3, () => told++), null);
  assert.equal(clinchPending('nba', '20', 3), true, 'drawn waiting, not as 第 N 場');
  done([{ id: 'a', start: '2027-01-28T00:00Z' }, { id: 'b', start: '2027-01-29T00:00Z' }, { id: 'c', start: '2027-01-30T00:00Z' }]);
  await tick();
  assert.equal(told, 1);
  assert.equal(clinchPending('nba', '20', 3), false);
  assert.equal(clinchGame('nba', '20', 3, () => {}).id, 'c');
});

test('a failed read tells the waiting card once, then it is never held again', async () => {
  let fail;
  const { clinchGame, clinchPending } = load(() => new Promise((_, r) => (fail = r)));
  let told = 0;
  clinchGame('nba', '20', 3, () => told++);
  fail(new Error('down'));
  await tick();
  assert.equal(told, 1, 'drawn without the day');
  assert.equal(clinchPending('nba', '20', 3), false);
  clinchGame('nba', '20', 3, () => told++);
  assert.equal(clinchPending('nba', '20', 3), false, 'a retry keeps the words, no shimmer back');
  fail(new Error('down'));
  await tick();
  assert.equal(told, 1, 'the same words not drawn again');
});

test('the clock line goes through the waiting draw, first and on redo', () => {
  const block = src.slice(src.indexOf('const chase = (t, k = 0) =>'), src.indexOf('if (t.done) {', src.indexOf('const chase = (t, k = 0) =>')));
  assert.match(block, /let shown = drawn\(t, k\)/);
  assert.match(block, /const fresh = drawn\(t, k\)/);
  assert.match(src, /clinchPending\(league, t\.leader\.id, t\.soonest\)[\s\S]{0,200}kitUI\.waiting\(l/);
});
