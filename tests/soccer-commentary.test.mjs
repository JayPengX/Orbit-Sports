import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSummary } from '../public/lib/espn.mjs';
import { feedText, playParts } from '../public/lib/moments.mjs';

const data = JSON.parse(readFileSync(new URL('./fixtures/epl-commentary.json', import.meta.url)));

test("a football game's 過程 is its whole commentary: shots, corners, fouls, each player's face and the score after a goal", () => {
  const s = parseSummary(data, 'epl');
  assert.ok(s.commentary.length > s.keyEvents.length * 2);
  const goal = s.commentary.find(p => p.kind === 'goal');
  assert.equal(goal.who, 'R. Lavia');
  assert.ok(goal.pic?.id);
  assert.equal(goal.home, 1);
  assert.equal(goal.away, 0);
  const own = s.commentary.find(p => p.kind === 'own-goal');
  assert.deepEqual([own.home, own.away], [3, 2]);
  // Its words in Chinese, from the commentary's own details.
  const blocked = s.commentary.find(p => p.kind === 'shot-blocked');
  assert.match(feedText('soccer', blocked, false, '切爾西'), /頭球.*封阻/);
});
