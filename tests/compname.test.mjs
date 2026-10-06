import { test } from 'node:test';
import assert from 'node:assert/strict';
import { otherName, compName, splitName } from '../public/lib/compname.mjs';

test("a club's cup in Chinese, English left as it is", () => {
  assert.equal(otherName('English Carabao Cup'), '英格蘭聯賽盃');
  assert.equal(otherName('Club Friendly'), '友誼賽');
  assert.equal(otherName('English Carabao Cup', true), 'English Carabao Cup');
  assert.equal(otherName('Some Unknown Cup'), 'Some Unknown Cup');
});

test("a league the app has by the longest English name in it", () => {
  assert.equal(compName('English Premier League'), '英超');
  assert.equal(compName('UEFA Champions League'), '歐冠');
  assert.equal(compName('Nowhere League'), null);
});

test("a player's rows: short names, one line, the season only when they differ", () => {
  const rows = ['2026-27 UEFA Champions League', '2026 English FA Community Shield', '2026-27 English Premier League', '2026-27 Carabao Cup', '2026 International Friendly', '2026 FIFA World Cup'].map(name => ({ name }));
  assert.deepEqual(rows.map(r => splitName(r.name, rows)), ['26-27 歐冠', '26 社區盾', '26-27 英超', '26-27 英格蘭聯賽盃', '26 友誼賽', '26 世界盃']);
  const one = ['2026-27 English Premier League', '2026-27 Carabao Cup'].map(name => ({ name }));
  assert.deepEqual(one.map(r => splitName(r.name, one)), ['英超', '英格蘭聯賽盃']);
  const nba = ['Regular Season', 'Postseason', 'Career'].map(name => ({ name }));
  assert.deepEqual(nba.map(r => splitName(r.name, nba)), ['例行賽', '季後賽', '生涯']);
  assert.equal(splitName('Regular Season', nba, true), 'Regular Season');
  assert.equal(splitName('2026 Mystery Trophy', []), null);
});
