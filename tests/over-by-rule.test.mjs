// A game over by the rules before ESPN's copy says so (lib/espn.mjs overByRule).
import test from 'node:test';
import assert from 'node:assert/strict';
import { overByRule } from '../public/lib/espn.mjs';

const st = (name, period, short = '', detail = '') => ({ state: 'in', name, period, short, detail, completed: false, void: false });
const sides = (a, h) => [{ score: String(a) }, { score: String(h) }];

test('basketball: the 4th (or an overtime) over with the scores apart is final; tied, or earlier, it is not', () => {
  assert.equal(overByRule(st('STATUS_END_PERIOD', 4, 'End of 4th'), ...sides(101, 99), 'nba').state, 'post');
  assert.equal(overByRule(st('STATUS_END_PERIOD', 5, 'End of OT'), ...sides(110, 112), 'nba').state, 'post');
  assert.equal(overByRule(st('STATUS_END_PERIOD', 4, 'End of 4th'), ...sides(100, 100), 'nba').state, 'in');
  assert.equal(overByRule(st('STATUS_END_PERIOD', 3, 'End of 3rd'), ...sides(80, 70), 'nba').state, 'in');
  assert.equal(overByRule(st('STATUS_IN_PROGRESS', 4, '0:12 - 4th'), ...sides(101, 99), 'nba').state, 'in');
});

test('MLB from the 9th: only what the rules settle', () => {
  // The home side ahead in the middle of the 9th: it doesn't bat.
  assert.equal(overByRule(st('STATUS_IN_PROGRESS', 9, 'Mid 9th'), ...sides(2, 4), 'mlb').state, 'post');
  // The visitors ahead: the home side still bats.
  assert.equal(overByRule(st('STATUS_IN_PROGRESS', 9, 'Mid 9th'), ...sides(4, 2), 'mlb').state, 'in');
  assert.equal(overByRule(st('STATUS_IN_PROGRESS', 9, 'End 9th'), ...sides(4, 2), 'mlb').state, 'post');
  assert.equal(overByRule(st('STATUS_IN_PROGRESS', 8, 'End 8th'), ...sides(4, 2), 'mlb').state, 'in');
  // A walk-off: the home side ahead in the bottom of the 9th or later ends it there.
  assert.equal(overByRule(st('STATUS_IN_PROGRESS', 10, 'Bot 10th'), ...sides(3, 4), 'mlb').state, 'post');
  assert.equal(overByRule(st('STATUS_IN_PROGRESS', 9, 'Bot 9th'), ...sides(4, 3), 'mlb').state, 'in');
  assert.equal(overByRule(st('STATUS_IN_PROGRESS', 8, 'Bot 8th'), ...sides(3, 4), 'mlb').state, 'in');
});

// ESPN's summary gives the status without a period (76人 v 尼克, 2026-10-21:
// "End of 4th" read 第0節結束 with a countdown): the last play's period, and over by the rules.
test('a summary at the end of the 4th, scores apart, is over', async () => {
  const { parseSummary } = await import('../public/lib/espn.mjs');
  const side = (id, homeAway, score) => ({ id, homeAway, score, team: { id, displayName: id, abbreviation: id } });
  const data = {
    header: { competitions: [{ status: { type: { name: 'STATUS_END_PERIOD', state: 'in', completed: false, detail: 'End of 4th Quarter', shortDetail: 'End of 4th' } }, competitors: [side('18', 'home', '100'), side('20', 'away', '106')] }] },
    plays: [{ id: '1', text: 'End of the 4th Quarter', period: { number: 4 }, clock: { displayValue: '0.0' } }]
  };
  const s = parseSummary(data, 'nba');
  assert.equal(s.status.state, 'post');
  assert.equal(s.status.period, 4);
});
