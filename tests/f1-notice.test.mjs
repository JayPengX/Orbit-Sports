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

// Jay 2026-11-22: the 拉斯維加斯站 race's start came twice (the race weekend's
// and 今日推薦's): one start notice a game, whichever loop put it on first.
test('a pick that a followed start already says is never a second notice', () => {
  const at = app.indexOf('\nconst oneStart = ');
  assert.ok(at > 0);
  const oneStart = new Function(`${app.slice(at, app.indexOf('};', at) + 2)}; return oneStart;`)();
  const items = [
    { tag: 'pick:f1:600060990~Race', kind: 'pick', at: 1 },
    { tag: 'start:f1:600060990~Race', kind: 'start', at: 1 },
    { tag: 'pick:nba:401', kind: 'pick', at: 2 },
    { tag: 'end:f1:600060990~Race', kind: 'end', at: 3 }
  ];
  assert.deepEqual(oneStart(items).map(x => x.tag), ['start:f1:600060990~Race', 'pick:nba:401', 'end:f1:600060990~Race']);
  const sync = app.slice(app.indexOf('\nfunction syncPush('), app.indexOf('\n}\n', app.indexOf('\nfunction syncPush(')));
  assert.match(sync, /schedulePush\(q, (quieted\()?oneStart\(items\)/);
});
