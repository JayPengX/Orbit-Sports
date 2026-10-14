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
});
