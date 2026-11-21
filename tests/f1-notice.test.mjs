import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL(`${process.env.ORBIT_SRC || '../public'}/app.js`, import.meta.url), 'utf8');

// Jay 2026-11-21: qualifying's start notice came at :56 (its titles' estimate,
// 4 minutes before); "at 55". Every F1 start notice, 5 minutes before the official start.
test("an F1 session's start notice goes 5 minutes before its official start", () => {
  assert.match(app, /const F1_NOTICE_MIN = 5;/);
  assert.match(app, /const noticeAt = e => \(e\.league === 'f1' && e\.official \? Date\.parse\(e\.official\) - F1_NOTICE_MIN \* 60_000 : Date\.parse\(e\.start\)\);/);
  const sync = app.slice(app.indexOf('\nfunction syncPush('), app.indexOf('\n}\n', app.indexOf('\nfunction syncPush(')));
  // The race weekend's sessions and today's picks both: never the titles' time.
  assert.equal((sync.match(/const start = noticeAt\(e\);/g) || []).length, 2);
});
