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
  // Singapore 2026: the leader stopped 4 laps back; only the laps since count, and a stop's swing never reads as pace.
  assert.equal(closingRate([[30, 25], [31, 21], [32, 5.6], [33, 5.5], [34, 5.5], [35, 5.5]], new Set([31])), 0);
  assert.equal(closingRate([[30, 25], [31, 21], [32, 17], [33, 13]]), null);
  assert.equal(closingRate([[1, 3], [2, 2.5], [3, 2], [4, 1.5], [5, 1]], new Set(), 5, new Set([4, 5])), 0.5);
  const { stintStops } = await import('../public/lib/f1.mjs');
  assert.deepEqual(stintStops([{ c: 'SOFT', laps: 32 }, { c: 'MEDIUM', laps: 4 }]), [32]);
  assert.deepEqual([...pitLaps([], [], [{ laps: 20 }, { laps: 10 }, { laps: 3 }])], [20, 30]);
  assert.equal(closingRate([[1, 3], [2, 3]]), null);
  assert.deepEqual([...pitLaps([[5, 1, 0, 1, 1]], [[12, 2.4, 24]])], [12, 5]);
  assert.equal(recentPace([[1, 90000], [2, 91000], [3, 120000], [4, 92000]], new Set([4])), 90500);
  assert.deepEqual(neutralLaps([{ lap: 8, message: 'VSC DEPLOYED' }, { lap: 10, message: 'VSC ENDING' }, { lap: 20, message: 'SAFETY CAR DEPLOYED' }], 25), [{ from: 8, kind: 'vsc', to: 10 }, { from: 20, kind: 'sc', to: 25 }]);
  assert.deepEqual(neutralLaps([{ lap: 20, message: 'SAFETY CAR DEPLOYED' }, { lap: 23, message: 'SAFETY CAR IN THIS LAP' }]), [{ from: 20, kind: 'sc', to: 23 }]);
});

test('the championship as it stands: the table before the race with the points each place takes now', async () => {
  const { asItStands, pointsFor } = await import('../public/lib/f1.mjs');
  assert.equal(pointsFor('Race', 1), 25);
  assert.equal(pointsFor('Race', 11), 0);
  assert.equal(pointsFor('SR', 8), 1);
  assert.equal(pointsFor('Race', 2, true), 0);
  const t = asItStands([{ key: 'a', pts: '325', rank: '1' }, { key: 'b', pts: '236', rank: '2' }, { key: 'c', pts: '221', rank: '3' }], new Map([['a', 4], ['c', 25]]));
  assert.deepEqual(t.map(r => [r.key, r.total, r.was, r.now]), [['a', 329, 1, 1], ['c', 246, 3, 2], ['b', 236, 2, 3]]);
});

test('a race on: each lap’s end counted back from now by the leader’s lap times, the lap it is on taken off', async () => {
  const { liveLapEnds } = await import('../public/lib/f1.mjs');
  const at = Date.UTC(2026, 9, 25, 21, 0, 0);
  const feed = { at, cars: [{ no: '12', pos: 1, laps: 3, seg: [11, 22], last: '1:40.000' }, { no: '16', pos: 2, laps: 3 }] };
  const laps = { 12: [[1, 110_000], [3, 100_000]] };
  const ends = liveLapEnds(feed, laps);
  const s = at / 1000;
  // Halfway round lap 4: lap 3 ended 50 s ago; lap 2 missed by the log, the usual (the median of what's there) lap.
  assert.deepEqual(ends.map(x => x.lap), [0, 1, 2, 3]);
  assert.equal(ends[3].t, s - 50);
  assert.equal(ends[2].t, s - 150);
  assert.equal(ends[1].t, s - 150 - 110);
  assert.equal(ends[0].t, s - 150 - 110 - 110);
  assert.equal(liveLapEnds({ at, cars: [{ no: '12', pos: 1, laps: 1 }] }, laps), null);
});

test('a race on: who led each lap, the drawn drivers’ stops and retirements, from F1’s feed', async () => {
  const { liveRaceEvents } = await import('../public/lib/f1.mjs');
  const feed = {
    cars: [{ no: '12', name: 'Kimi Antonelli', laps: 40 }, { no: '1', name: 'Lando Norris', laps: 40 }, { no: '16', name: 'Charles Leclerc', laps: 33, retired: true }, { no: '3', name: 'Max Verstappen', laps: 40 }],
    // Antonelli from pole, Leclerc ahead on laps 18–19 (Antonelli stopped on 17), Antonelli again.
    places: { 12: [1, 1, 1, 2, 2, 1], 16: [2, 2, 2, 1, 1, 2], 1: [3, 3, 3, 3, 3, 3] },
    stops: { 12: [[3, 2.4, 22]], 1: [[4, 2.6, 23]] }
  };
  const ev = liveRaceEvents(feed, ['Kimi Antonelli', 'Max Verstappen', 'Charles Leclerc']);
  assert.deepEqual(ev, [[0, 'lead', 0], [3, 'pit', 0], [3, 'lead', 2], [5, 'lead', 0], [33, 'out', 2]]);
});

test('the championship just after a past weekend: its points before, its place then, and that weekend’s', async () => {
  const { standingAfter, asItStands } = await import('../public/lib/f1.mjs');
  const group = { rounds: [{ key: 'AUS' }, { key: 'CHN' }, { key: 'JPN' }], rows: [{ id: 'a', stats: { AUS: '25', CHN: '0', JPN: '18' } }, { id: 'b', stats: { AUS: '18', CHN: '25', JPN: '25' } }, { id: 'c', stats: { AUS: '-', CHN: '18', JPN: '' } }] };
  const s = standingAfter(group, 'CHN');
  assert.deepEqual(s.map(r => [r.id, r.before, r.rank, r.add]), [['a', 25, 1, 0], ['b', 18, 2, 25], ['c', 0, 3, 18]]);
  const t = asItStands(s.map(r => ({ ...r, key: r.id, pts: r.before })), new Map(s.map(r => [r.id, r.add])));
  assert.deepEqual(t.map(r => [r.id, r.total, r.was, r.now]), [['b', 43, 2, 1], ['a', 25, 1, 2], ['c', 18, 3, 3]]);
  assert.equal(standingAfter(group, 'USA'), null);
});
