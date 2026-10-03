import { test } from 'node:test';
import assert from 'node:assert/strict';
import { f1Grids, f1Label, f1Value, finishOf, eventOfRace, lapMs, qualiRows, sameSession, qualiCut } from '../public/lib/f1.mjs';

test("formula1.com's grids are found by their first label, in the app's words", () => {
  const g = f1Grids([[['Season Position', '1st'], ['Season Points', '302']], [['Grands Prix Entered', '39'], ['Highest Race Finish', '1 (x8)']], [['Date of Birth', '25/08/2006']]]);
  assert.deepEqual(Object.keys(g), ['season', 'career', 'bio']);
  assert.equal(f1Label('Grand Prix Wins', false), '冠軍');
  assert.equal(f1Label('Grand Prix Wins', true), 'Wins');
  assert.equal(f1Value('1 (x8)', false), 'P1（8 次）');
  assert.equal(f1Value('1st', false), '第 1');
  assert.equal(f1Value('25/08/2006', true), '2006/08/25');
});

test('a finish reads as a place or a retirement, with its reason', () => {
  assert.deepEqual(finishOf({ position: '3', positionText: '3', status: 'Finished' }, false), { pos: 3, text: 'P3', out: false, why: '' });
  assert.deepEqual(finishOf({ position: '19', positionText: 'R', status: 'Engine' }, false), { pos: 0, text: '退賽', out: true, why: '引擎' });
  assert.equal(finishOf({ position: '20', positionText: 'R', status: 'Retired' }, true).why, '');
  assert.equal(finishOf({ position: '20', positionText: 'W', status: 'Did not start' }, true).text, 'DNS');
});

test("a Jolpica race is matched to the app's weekend by date", () => {
  const races = [{ id: 'a', start: '2026-08-21T10:00Z', end: '2026-08-23T15:00Z' }, { id: 'b', start: '2026-09-04T10:00Z', end: '2026-09-06T15:00Z' }];
  assert.equal(eventOfRace(races, '2026-09-06').id, 'b');
  assert.equal(eventOfRace(races, '2026-10-20'), null);
});

test("qualifying's numbers: the best lap, the gap to pole in the last part, the part the others went out in", () => {
  assert.equal(lapMs('1:11.608'), 71608);
  assert.equal(lapMs('58.112'), 58112);
  assert.equal(lapMs('0.000'), 0);
  assert.equal(lapMs(''), 0);
  // Zandvoort 2026: Norris on pole, Russell 0.102 behind; one out in Q2, one in Q1, one without a time.
  const d = n => ({ givenName: '', familyName: n });
  const rows = qualiRows([
    { pos: 1, driver: d('Norris'), team: 'McLaren', q: ['1:12.695', '1:11.628', '1:11.163'] },
    { pos: 2, driver: d('Russell'), team: 'Mercedes', q: ['1:12.924', '1:11.959', '1:11.265'] },
    { pos: 12, driver: d('Albon'), team: 'Williams', q: ['1:13.001', '1:12.400', ''] },
    { pos: 18, driver: d('Bearman'), team: 'Haas', q: ['1:13.500', '', ''] },
    { pos: 22, driver: d('Perez'), team: 'Cadillac', q: ['', '', ''] }
  ], 'SQ');
  assert.deepEqual(rows.map(r => [r.time, r.gap, r.outIn]), [
    ['1:11.163', '', ''],
    ['1:11.265', '+0.102', ''],
    ['1:12.400', '', 'SQ2'],
    ['1:13.500', '', 'SQ1'],
    ['', '', '']
  ]);
});

test("F1's live feed is this session's only when its kind and time agree", () => {
  const feed = (type, name, start) => ({ session: { type, name, start, gmt: '08:00:00' }, cars: [{}] });
  // Bahrain (at Sepang) 2026: qualifying 16:00 local = 08:00Z.
  const q = feed('Qualifying', 'Qualifying', '2026-10-03T16:00:00');
  assert.ok(sameSession(q, 'Qual', '2026-10-03T08:00Z'));
  assert.ok(!sameSession(q, 'Race', '2026-10-04T07:00Z'));
  assert.ok(!sameSession(q, 'Qual', '2026-10-10T13:00Z'));
  assert.ok(sameSession(feed('Race', 'Race', '2026-10-04T15:00:00'), 'Race', '2026-10-04T07:00Z'));
  assert.ok(sameSession(feed('Race', 'Sprint', '2026-10-10T17:00:00'), 'SR', '2026-10-10T09:00Z'));
  assert.ok(!sameSession(feed('Race', 'Sprint', '2026-10-10T17:00:00'), 'Race', '2026-10-10T09:00Z'));
  assert.ok(sameSession(feed('Qualifying', 'Sprint Qualifying', '2026-10-09T20:30:00'), 'SS', '2026-10-09T12:30Z'));
  assert.ok(!sameSession(feed('Qualifying', 'Sprint Qualifying', '2026-10-09T20:30:00'), 'Qual', '2026-10-09T12:30Z'));
  // The cut: 16 through Q1, 10 through Q2, none in Q3.
  assert.equal(qualiCut(1, [22, 16, 10]), 16);
  assert.equal(qualiCut(2, [22, 16, 10]), 10);
  assert.equal(qualiCut(3, [22, 16, 10]), 0);
});
