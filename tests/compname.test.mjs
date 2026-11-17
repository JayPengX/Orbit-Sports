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

test("a national side's competitions named for its confederation (CONCACAF's Nations League is no 歐國聯)", () => {
  assert.equal(otherName('CONCACAF Nations League', false), '中北美國家聯賽');
  assert.equal(otherName('UEFA Nations League', false), '歐國聯');
  assert.equal(otherName('UEFA European Championship Qualifying', false), '歐洲盃資格賽');
  assert.equal(otherName('AFC Asian Cup', false), '亞洲盃');
  assert.equal(otherName('International Friendly', false), '友誼賽');
});

// Jay 11-17: a CSKA 1948 Sofia defender's club line read 歐洲足總會議聯賽預選賽 (ESPN's "UEFA Conference League Qualifying" machine-translated).
test("a competition's qualifying in Taiwan's words, every confederation's: the competition's name and 資格賽", () => {
  assert.equal(compName('UEFA Conference League Qualifying'), '歐協聯資格賽');
  assert.equal(compName('UECL Qualifying'), '歐協聯資格賽');
  assert.equal(compName('UEFA Champions League Qualifying'), '歐冠資格賽');
  assert.equal(compName('UEFA Europa League Qualifying'), '歐霸資格賽');
  assert.equal(compName('FIFA World Cup Qualifying - UEFA'), '世界盃資格賽');
  assert.equal(compName('UEFA European Championship Qualifying'), '歐洲盃資格賽');
  assert.equal(compName('Africa Cup of Nations Qualifying'), '非洲國家盃資格賽');
  assert.equal(compName('UEFA Conference League Qualifying', true), 'Conference League qualifying');
  assert.equal(otherName('UEFA Champions League Qualifying', false), '歐冠資格賽');
  assert.equal(compName('Some Cup Qualifying'), null);
});

test("a league's name inside another's is never it (Austrian Bundesliga is no 德甲, CONCACAF's Nations League no 歐國聯)", () => {
  assert.equal(compName('German Bundesliga'), '德甲');
  assert.equal(compName('Austrian Bundesliga'), null);
  assert.equal(compName('2. Bundesliga'), null);
  assert.equal(compName('Brazilian Serie A'), null);
  assert.equal(compName('CONCACAF Nations League'), '中北美國家聯賽');
  assert.equal(compName('AFC Champions League'), '亞冠');
  assert.equal(compName('UEFA Europa Conference League'), '歐協聯');
  assert.equal(compName('UEFA Super Cup'), '歐洲超級盃');
});
