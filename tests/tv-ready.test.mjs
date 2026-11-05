// The TV lists the picks wait on (lib/tv.mjs tvReady): ELTA's and NBA.com's,
// both asked for at the first ask. (2026-11-05, a first open on a phone's
// link: NBA.com's list was asked only once ELTA's had come in, at the next
// drawing after it, 5 s later, and the picks and the move to the next day
// they play waited on it.)
import test from 'node:test';
import assert from 'node:assert/strict';

test("both TV lists are asked for at the first ask: NBA.com's isn't left waiting for ELTA's", async () => {
  const asked = [];
  globalThis.fetch = async url => {
    asked.push(String(url?.url || url));
    return new Promise(() => {});
  };
  const { tvReady } = await import('../public/lib/tv.mjs');
  assert.equal(tvReady(), false, 'neither list is in yet');
  await new Promise(done => setTimeout(done, 50));
  assert.ok(asked.some(u => u.endsWith('nba-elta.json')), `NBA.com's list asked for with ELTA's still out (asked: ${asked.join(', ') || 'nothing'})`);
});
