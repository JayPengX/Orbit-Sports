import test from 'node:test';
import assert from 'node:assert/strict';
import { fomDates, parseFomRound } from '../public/lib/espn.mjs';

test('an F2 weekend from its calendar card and its session times', () => {
  assert.deepEqual(fomDates('27 - 29 NOV', 2026), { from: Date.UTC(2026, 10, 27, 12), to: Date.UTC(2026, 10, 29, 12) });
  assert.deepEqual(fomDates('29 MAY - 01 JUN', 2026), { from: Date.UTC(2026, 4, 29, 12), to: Date.UTC(2026, 5, 1, 12) });
  const meeting = { url: '/en/racing/2026/lusail', place: 'Lusail', round: 13, dates: '27 - 29 NOV', status: 'upcoming' };
  const sessions = [
    { name: 'Practice', short: 'Practice', type: 'Practice', start: '2026-11-27T09:00:00.000Z', state: 'upcoming' },
    { name: 'Qualifying', short: 'Qualifying', type: 'Qualifying', start: '2026-11-27T13:00:00.000Z', state: 'upcoming' },
    { name: 'Race', short: 'Sprint Race', type: 'Race', start: '2026-11-28T10:00:00.000Z', state: 'upcoming' },
    { name: 'Race', short: 'Feature Race', type: 'Race', start: '2026-11-29T09:00:00.000Z', state: 'upcoming' }
  ];
  const e = parseFomRound(meeting, sessions, 'f2', 2026, 'zh');
  assert.equal(e.name, 'Lusail');
  assert.deepEqual(e.sessions.map(x => x.abbr), ['FP', 'Qual', 'SR', 'Race']);
  assert.equal(e.sessions.at(-1).name, '正賽');
  assert.equal(e.status.state, 'pre');
  // No times yet: the weekend by its dates, marked to come.
  const later = parseFomRound({ ...meeting, round: 14, place: 'Yas Marina', dates: '04 - 06 DEC' }, [], 'f2', 2026, 'zh');
  assert.equal(later.tbc, true);
  assert.equal(later.start, new Date(Date.UTC(2026, 11, 4, 12)).toISOString());
});
