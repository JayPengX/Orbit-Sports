import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { liveOrder, endsBy } from '../public/lib/picks.mjs';

// Jay 2026-11-21: the Rockets led 首頁 while F1 qualifying was on too, with
// F1 above the NBA in his order; and qualifying ends first. Two of theirs on
// at once: the league put higher leads, then, in one league, the one ending sooner.
const qual = { league: 'f1', sessionKey: 'Qual', start: '2026-11-21T03:56Z', official: '2026-11-21T04:00Z' };
const rockets = { league: 'nba', start: '2026-11-21T03:00Z' };
const race = { league: 'f1', sessionKey: 'Race', start: '2026-11-21T03:30Z', official: '2026-11-21T03:30Z' };

test('the league put higher leads, whichever ends first', () => {
  assert.deepEqual([rockets, qual].sort(liveOrder(['f1', 'nba'])), [qual, rockets]);
  assert.deepEqual([qual, rockets].sort(liveOrder(['nba', 'f1'])), [rockets, qual]);
});

test('in one league (or none ranked), the one ending sooner leads', () => {
  // (Qualifying an hour from 04:00 is over before a race two hours from 03:30.)
  assert.ok(endsBy(qual) < endsBy(race));
  assert.deepEqual([race, qual].sort(liveOrder(['f1'])), [qual, race]);
  assert.deepEqual([rockets, qual].sort(liveOrder([])), [qual, rockets]);
});

test('首頁 and 轉播 both lead with it among theirs', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /y\.mine - x\.mine \|\| \(x\.mine && order\(x\.event, y\.event\)\)/);
  assert.match(app, /y\.mine - x\.mine \|\| \(x\.on && x\.mine && order\(x\.e, y\.e\)\)/);
});
