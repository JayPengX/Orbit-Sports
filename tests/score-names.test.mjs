import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreName } from '../public/lib/text.mjs';

// Jay 11-26: "NE" beside 費城聯合 in a football game's score table, "why English short name when there's such a space".
test("a score table names both sides in Chinese when they fit, else both by letters", () => {
  const ne = { en: 'New England', short: '新英格蘭革命', abbr: 'NE' };
  const phi = { en: 'Philadelphia', short: '費城聯合', abbr: 'PHI' };
  const tag = scoreName([ne, phi], 2);
  assert.deepEqual([tag(ne), tag(phi)], ['新英格蘭革命', '費城聯合']);
  // Nine innings: no room, both by letters.
  const nine = scoreName([ne, phi], 9);
  assert.deepEqual([nine(ne), nine(phi)], ['NE', 'PHI']);
  assert.equal(scoreName([ne, phi], 2, 'en')(phi), 'PHI');
});
