// Where a car is drawn between the feed's reads: it keeps going at its pace,
// never backwards, never piled on the car ahead.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lapRate, unwrap, readCar, stepCar, spread, behindLeader } from '../public/lib/carpace.mjs';

test('pace: the last lap while it is a racing lap, else the best; slower behind the safety car and in the pits', () => {
  assert.equal(lapRate({ lastMs: 100_000, bestMs: 99_000 }), 1 / 100_000);
  // A pit or safety-car lap (12% over the best) isn't the pace.
  assert.equal(lapRate({ lastMs: 111_000, bestMs: 99_000 }), 1 / (99_000 * 1.02));
  assert.equal(lapRate({}, 90_000), 1 / (90_000 * 1.02));
  assert.ok(lapRate({ lastMs: 100_000, bestMs: 99_000 }, 0, '4') < lapRate({ lastMs: 100_000, bestMs: 99_000 }, 0, '6'));
  assert.ok(lapRate({ lastMs: 100_000, bestMs: 99_000, inPit: true }) < lapRate({ lastMs: 100_000, bestMs: 99_000 }) / 2);
});

test('a reading across the line is the next lap, not back to the start', () => {
  assert.equal(unwrap(0.02, 4.97), 5.02);
  assert.equal(unwrap(0.95, 5.01), 4.95);
  assert.equal(unwrap(0.5, 2.48), 2.5);
});

test('a car keeps moving between reads and is never drawn going backwards', () => {
  const v = 1 / 100_000;
  let s = readCar(null, 0.3, v, 0);
  let last = s.d;
  // Fifteen seconds of frames, a new timing point every 3.5 s.
  for (let t = 16; t <= 15_000; t += 16) {
    if (t % 3_504 < 16) s = readCar(s, 0.3 + (t / 100_000), v, t);
    s.d = stepCar(s, t, 16);
    assert.ok(s.d > last, `moving at ${t} ms`);
    last = s.d;
  }
  // About where its pace puts it: 15 s of a 100 s lap.
  assert.ok(Math.abs(last - 0.45) < 0.03, String(last));
});

test('the same timing point read again does not pull the car back', () => {
  const v = 1 / 100_000;
  let s = readCar(null, 0.3, v, 0);
  for (let t = 16; t <= 4_000; t += 16) s.d = stepCar(s, t, 16);
  const before = s.d;
  s = readCar(s, 0.3, v, 4_000);
  assert.equal(s.at, 0);
  s.d = stepCar(s, 4_016, 16);
  assert.ok(s.d > before);
});

test('a car read behind where it is drawn slows (never stops) until it is back with it', () => {
  const v = 1 / 100_000;
  const s = { ...readCar(null, 0.5, v, 0), d: 0.52 };
  const d = stepCar(s, 16, 16);
  assert.ok(d > 0.52 && d - 0.52 < v * 16);
});

test('a car the feed has stopped hearing from stops two and a half mini-sectors on', () => {
  const v = 1 / 100_000;
  const s = readCar(null, 0.2, v, 0, 1 / 22);
  for (let t = 16; t <= 60_000; t += 16) s.d = stepCar(s, t, 16);
  assert.equal(s.d, 0.2 + (2.5 / 22));
});

test('a far jump (a car back from the garage) is put there at once', () => {
  const s = readCar(readCar(null, 0.1, 1e-5, 0), 0.7, 1e-5, 4_000);
  assert.equal(s.d, 0.7);
});

test('cars on one another drawn as a train, the one ahead where it is', () => {
  const out = spread([0.5, 0.499, 0.2, 0.4985], () => 0.01);
  assert.equal(out[0], 0.5);
  assert.equal(out[1], 0.49);
  assert.equal(out[2], 0.2);
  assert.ok(Math.abs(out[3] - 0.48) < 1e-9);
  // Six widths back at most.
  const pack = spread(Array.from({ length: 10 }, () => 0.5), () => 0.01);
  assert.ok(Math.min(...pack) >= 0.5 - 0.06 - 1e-9);
});

test('a race: each car placed from the leader by its gap, so the order is the race’s', () => {
  const v = 1 / 100_000;
  assert.ok(Math.abs(behindLeader(0.5, 1.8, v) - 0.482) < 1e-9);
  // Across the line: the leader just over it, the second just before.
  assert.ok(Math.abs(behindLeader(0.01, 2, v) - 0.99) < 1e-9);
  // Placed from the leader's read 2 s ago: the car is drawn where it is now.
  const s = readCar(null, 0.482, v, 2_000, 0.05, 0);
  assert.ok(Math.abs(s.d - 0.502) < 1e-9);
  // The leader read again at the same place and time: the follower keeps going.
  assert.equal(readCar(s, 0.482, v, 6_000, 0.05, 0).at, 0);
});
