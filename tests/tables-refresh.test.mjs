// The followed leagues' tables (追蹤's places, the picks' stakes) are read
// again: one that failed to read is read at the next refresh, never held as an
// empty table for the session, and one read once is read again once it's
// 10 minutes old, the one held shown meanwhile (11-17: a blip at the open
// left 追蹤 without places; an app kept open all evening said a team was 3rd
// after it went top). Runs app.js's own loadTables with the reads stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const from = app.indexOf('const TABLES_MS');
const to = app.indexOf('\n}\n', app.indexOf('function loadTables(')) + 3;
assert.ok(from > 0 && to > from, 'loadTables is there');

function harness(read, drawn = () => {}) {
  const state = { tab: 'following', home: { tables: {}, tablesPending: 0, date: 'd' }, days: new Map() };
  const T0 = Date.parse("2026-11-17T12:00:00Z");
  let now = T0;
  const env = {
    state, followedLeagues: () => ['epl'], hasStandings: () => true, tableIndex: g => g,
    standings: read, renderHome() {}, renderFollowing: drawn,
    Date: { now: () => now },
  };
  const run = new Function(...Object.keys(env), `${app.slice(from, to)}; return loadTables;`)(...Object.values(env));
  return { state, run, at: t => { now = T0 + t; } };
}
const tick = () => new Promise(r => setTimeout(r, 0));

test('a table that failed to read is read again 30 seconds on, not held empty, and never asked again at once', async () => {
  let n = 0;
  const h = harness(() => (++n === 1 ? Promise.reject(new Error('blip')) : Promise.resolve({ ars: { pos: 1 } })));
  h.run();
  await tick();
  assert.equal(h.state.home.tables.epl, undefined, 'the failed read leaves no empty table');
  assert.equal(h.state.home.tablesPending, 0);
  // (追蹤 asks each time it's drawn, and draws when a read ends: a failure at once asked again at once froze the page.)
  h.run();
  assert.equal(n, 1, 'not asked again at once');
  h.at(31_000);
  h.run();
  await tick();
  assert.deepEqual(h.state.home.tables.epl, { ars: { pos: 1 } });
  assert.equal(n, 2);
});

test('追蹤 drawn again on each failed read never asks in a loop', async () => {
  let n = 0;
  let run;
  const h = harness(() => (++n, Promise.reject(new Error('an error page'))), () => run());
  run = h.run;
  h.run();
  for (let i = 0; i < 5; i++) await tick();
  assert.equal(n, 1);
});

test('a table is read again once 10 minutes old, the one held shown meanwhile, and only once at a time', async () => {
  let n = 0, release;
  const h = harness(() => (++n === 1 ? Promise.resolve({ ars: { pos: 3 } }) : new Promise(r => { release = () => r({ ars: { pos: 1 } }); })));
  h.run();
  await tick();
  h.at(5 * 60_000);
  h.run();
  assert.equal(n, 1, 'not read again while fresh');
  h.at(11 * 60_000);
  h.run();
  h.run();
  assert.equal(n, 2, 'read again once old, one read at a time');
  assert.deepEqual(h.state.home.tables.epl, { ars: { pos: 3 } }, 'the one held stays shown while it is read');
  release();
  await tick();
  assert.deepEqual(h.state.home.tables.epl, { ars: { pos: 1 } });
});
