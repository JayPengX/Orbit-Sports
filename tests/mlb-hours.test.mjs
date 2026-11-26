import test from 'node:test';
import assert from 'node:assert/strict';
import { mlbHours } from '../public/lib/espn.mjs';

// Jay 11-26: "every single future MLB day has a lot of 待定": ESPN hadn't set the hours MLB had.
test("an MLB game ESPN has no hour for takes MLB's own", () => {
  const e = { league: 'mlb', start: '2027-03-27T00:00:00Z', timeTbd: true, status: { state: 'pre' }, home: { en: 'Pittsburgh Pirates' }, away: { en: 'Athletics' } };
  const days = new Map([['2027-03-26', [{ gamePk: 1, gameDate: '2027-03-26T22:40:00Z', status: { startTimeTBD: false }, teams: { home: { team: { name: 'Pittsburgh Pirates' } }, away: { team: { name: 'Athletics' } } } }]]]);
  const [out] = mlbHours([e], days);
  assert.equal(out.start, '2027-03-26T22:40:00Z');
  assert.equal(out.timeTbd, undefined);
  const unset = new Map([['2027-03-26', [{ gamePk: 1, gameDate: '2027-03-26T10:33:00Z', status: { startTimeTBD: true }, teams: { home: { team: { name: 'Pittsburgh Pirates' } }, away: { team: { name: 'Athletics' } } } }]]]);
  assert.equal(mlbHours([e], unset)[0].timeTbd, true);
});
