import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSchedule } from '../public/lib/espn.mjs';
import { stageTag } from '../public/lib/stage.mjs';

// Jay 11-26: a team's 賽程 didn't mark NBA Cup games as 賽事 does, nor the game opened from it.
test("a team's schedule marks a cup game as a day's board does", () => {
  const side = (id, homeAway) => ({ id, homeAway, team: { id, abbreviation: id === '13' ? 'LAL' : 'SA', displayName: id } });
  const ev = notes => ({ id: '1', date: '2026-11-28T02:30Z', name: 'LAL at SA', shortName: 'LAL @ SA', seasonType: { id: '2', type: 2 }, season: { year: 2027, displayName: '2026-27' }, competitions: [{ type: { abbreviation: 'STD' }, notes, status: { type: { state: 'pre' } }, competitors: [side('24', 'home'), side('13', 'away')] }] });
  const [cup] = parseSchedule({ events: [ev([{ type: 'event', headline: 'NBA Cup - Group Play' }])] }, 'nba');
  assert.equal(stageTag(cup, 'zh'), 'NBA 盃 · 小組賽');
  const [plain] = parseSchedule({ events: [ev([])] }, 'nba');
  assert.equal(stageTag(plain, 'zh'), '');
});
