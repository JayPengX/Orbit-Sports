import { test } from 'node:test';
import assert from 'node:assert/strict';
import { f1Grids, f1Label, f1Value, finishOf, eventOfRace } from '../public/lib/f1.mjs';

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
