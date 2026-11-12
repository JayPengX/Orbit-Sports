import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// A capped footballer's country's games in his page's 下一場 (Jay 11-12:
// Haaland's Norway in the Nations League while City wait).
test("a national side found by FotMob's name in ESPN's list, its other spellings too", async () => {
  const teams = [['464', 'Norway'], ['660', 'United States'], ['451', 'South Korea'], ['476', 'Republic of Ireland'], ['452', 'Bosnia-Herzegovina'], ['4789', 'Ivory Coast'], ['465', 'Türkiye']];
  globalThis.fetch = async () => new Response(JSON.stringify({ sports: [{ leagues: [{ teams: teams.map(([id, displayName]) => ({ team: { id, displayName } })) }] }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  const { nationalSideId } = await import('../public/lib/espn.mjs');
  const want = { Norway: '464', USA: '660', 'Korea Republic': '451', Ireland: '476', 'Bosnia and Herzegovina': '452', "Côte d'Ivoire": '4789', Turkey: '465', Türkiye: '465', Atlantis: null };
  for (const [name, id] of Object.entries(want)) assert.equal(await nationalSideId(name), id, name);
});

test("the player page's next games: his country's before his club's, only for a side he's still in", () => {
  const sheets = readFileSync(new URL('../public/sheets.js', import.meta.url), 'utf8');
  assert.match(sheets, /side && side\.to == null \? nationalGames\(side\.team\.name\) : \[\]/);
  assert.match(sheets, /soon\(country\)\.filter\(x => !club \|\| Date\.parse\(x\.start\) < Date\.parse\(club\.start\)\)/);
  // (careerOnce is set before the next box reads it: no temporal dead zone.)
  assert.ok(sheets.indexOf('const careerOnce = ') < sheets.indexOf('careerOnce()'));
});
