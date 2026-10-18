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

test('a penalty scored is a goal in 過程 (Picault, Atlanta–Inter Miami 89\', 2026-10-17): marked, with the score after it', () => {
  const pen = { sequence: 1, text: 'Goal! Atlanta United 1, Inter Miami CF 3. Fafà Picault (Atlanta United) converts the penalty with a right footed shot.', time: { displayValue: "89'" }, play: { id: '9', type: { type: 'penalty---scored', text: 'Penalty - Scored' }, period: { number: 2 }, team: { displayName: 'Atlanta United' } } };
  const s = parseSummary({ ...data, commentary: [...(data.commentary || []), pen] }, 'epl');
  const row = s.commentary.find(p => p.kind === 'penalty---scored');
  assert.equal(row.scoring, true);
});

test('how a goal went in, as baseball names each hit (Atlanta–Inter Miami, 2026-10-17)', async () => {
  const { goalHow } = await import('../public/lib/moments.mjs');
  const messi = 'Goal! Atlanta United 0, Inter Miami CF 3. Lionel Messi (Inter Miami CF) left footed shot from the centre of the box to the bottom right corner. Assisted by Luis Suárez following a fast break.';
  assert.equal(goalHow(messi, 'goal'), '禁區中路左腳 · 右下角 · L. Suárez 助攻');
  assert.equal(goalHow(messi, 'goal', true), 'left foot, box centre · bottom right · assist L. Suárez');
  const head = 'Goal! Atlanta United 0, Inter Miami CF 1. Germán Berterame (Inter Miami CF) header from very close range to the bottom right corner. Assisted by Luis Suárez.';
  assert.equal(goalHow(head, 'goal---header'), '近距離頭球 · 右下角 · L. Suárez 助攻');
  const pen = 'Goal! Atlanta United 1, Inter Miami CF 3. Fafà Picault (Atlanta United) converts the penalty with a right footed shot to the bottom right corner.';
  assert.equal(goalHow(pen, 'penalty---scored'), '12 碼右腳 · 右下角');
  assert.equal(goalHow('Own Goal by X, Chelsea. Arsenal 1, Chelsea 0.', 'own-goal'), '');
});
