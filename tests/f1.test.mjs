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
  assert.deepEqual(finishOf({ position: '19', positionText: 'R', status: 'Engine' }, false), { pos: 0, text: '退賽', code: 'DNF', out: true, why: '引擎' });
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

test('a qualifying between its parts is not over: only its last part ends it', async () => {
  const { feedOver, feedBreak } = await import('../public/lib/f1.mjs');
  const q = (part, status, message, left = 0, running = false) => ({ session: { type: 'Qualifying', name: 'Qualifying', status }, part, entries: [22, 16, 10], clock: { left, running }, message: { text: message } });
  assert.equal(feedOver(q(1, 'Finished', 'CHEQUERED FLAG')), false);
  assert.equal(feedBreak(q(1, 'Finished', 'CHEQUERED FLAG')), true);
  // Q2 set up, not begun: a break still.
  assert.equal(feedBreak(q(2, 'Inactive', 'CHEQUERED FLAG', 900)), true);
  assert.equal(feedBreak(q(2, 'Started', 'GREEN LIGHT - PIT EXIT OPEN', 880, true)), false);
  assert.equal(feedOver(q(3, 'Finished', 'CHEQUERED FLAG')), true);
  assert.equal(feedOver(q(2, 'Finalised', '')), true);
  // A practice or a race: the flag is the end.
  assert.equal(feedOver({ session: { type: 'Practice', name: 'Practice 1', status: 'Finished' }, part: 0, message: { text: '' } }), true);
});

test('practicePace: runs between trips to the pits, cool-down laps dropped; the best lap on each compound', async () => {
  const { practicePace } = await import('../public/lib/f1.mjs');
  const L = (lap, s, pit = 0) => [lap, Math.round(s * 1000), null, 1, pit];
  // Run 1 (softs): out-lap, a push lap, a cool-down; the in-lap has no time.
  // Run 2 (mediums): out-lap with the garage time, then 8 laps with a cool-down among them.
  const laps = [L(1, 99, 1), L(2, 92.4), L(3, 110), L(5, 600, 1), L(6, 95.0), L(7, 95.2), L(8, 95.4), L(9, 104), L(10, 95.6), L(11, 95.8), L(12, 96.0), L(13, 96.2)];
  const stints = [{ c: 'SOFT', laps: 4, new: true }, { c: 'MEDIUM', laps: 9, new: false }];
  const p = practicePace(laps, stints);
  assert.equal(p.best.SOFT.ms, 92400);
  assert.equal(p.best.MEDIUM.ms, 95000);
  assert.equal(p.long.c, 'MEDIUM');
  assert.equal(p.long.laps, 7);
  assert.equal(Math.round(p.long.avg), Math.round(((95 + 95.2 + 95.4 + 95.6 + 95.8 + 96 + 96.2) / 7) * 1000));
  assert.ok(p.long.fade > 0);
  // No stints: the pace still, no tyre named.
  assert.equal(practicePace(laps, []).long.c, null);
  // A run of cool-down laps (all over 108% of the best) is no long run.
  assert.equal(practicePace([L(1, 99, 1), L(2, 90), L(4, 300, 1), ...[5, 6, 7, 8, 9, 10].map(n => L(n, 99 + n / 10))], []).long, null);
  // Too short a run: no long run.
  assert.equal(practicePace(laps.slice(0, 3), stints.slice(0, 1)).long, null);
});

test('two cars\' gap at every line, counted back from the gap now by the lap times (live), as read once over', async () => {
  const { gapsBetween, closingRate, pitLaps, recentPace, neutralLaps } = await import('../public/lib/f1.mjs');
  const a = [[1, 0, 0], [2, 90000, 0], [3, 91000, 0]];
  // c's gaps read mid-lap (2.5, 2.0): off; its lap times are exact.
  const c = [[1, 0, 1.0], [2, 90500, 2.5], [3, 90000, 2.0]];
  assert.deepEqual(gapsBetween(a, c, { now: 0.9, live: true }), [[1, 1.4], [2, 1.9], [3, 0.9]]);
  assert.deepEqual(gapsBetween(a, c, { now: 0.9, live: false }), [[1, 1], [2, 2.5], [3, 2]]);
  // No gap now (a lapped car): as read.
  assert.deepEqual(gapsBetween(a, c, { now: null, live: true }), [[1, 1], [2, 2.5], [3, 2]]);
  assert.equal(closingRate([[1, 3], [2, 2.5], [3, 2], [4, 1.5]]), 0.5);
  assert.equal(closingRate([[1, 3], [2, 2.5], [3, 30], [4, 29.5]], new Set([3])), null);
  assert.equal(closingRate([[1, 3], [2, 3]]), null);
  assert.deepEqual([...pitLaps([[5, 1, 0, 1, 1]], [[12, 2.4, 24]])], [12, 5]);
  assert.equal(recentPace([[1, 90000], [2, 91000], [3, 120000], [4, 92000]], new Set([4])), 90500);
  assert.deepEqual(neutralLaps([{ lap: 8, message: 'VSC DEPLOYED' }, { lap: 10, message: 'VSC ENDING' }, { lap: 20, message: 'SAFETY CAR DEPLOYED' }], 25), [{ from: 8, kind: 'vsc', to: 10 }, { from: 20, kind: 'sc', to: 25 }]);
  assert.deepEqual(neutralLaps([{ lap: 20, message: 'SAFETY CAR DEPLOYED' }, { lap: 23, message: 'SAFETY CAR IN THIS LAP' }]), [{ from: 20, kind: 'sc', to: 23 }]);
});
