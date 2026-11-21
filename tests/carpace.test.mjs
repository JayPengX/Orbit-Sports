// Where a car is drawn between the feed's reads: it keeps going at its pace,
// never backwards, never piled on the car ahead.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lapRate, unwrap, readCar, stepCar, spread, behindLeader, placeTags } from '../public/lib/carpace.mjs';

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

// (A stretch: the mini-sector the feed says the car is in, 25 a lap here.)
const W = 1 / 25;
const read = (s, f, v, now, at) => readCar(s, f, f + W, v, now, at);

test('a car keeps moving between reads and is never drawn going backwards', () => {
  const v = 1 / 100_000;
  let s = read(null, 0.3, v, 0);
  let last = s.d;
  // Fifteen seconds of frames, a new reading every 3.5 s.
  for (let t = 16; t <= 15_000; t += 16) {
    if (t % 3_504 < 16) s = read(s, Math.floor((0.3 + t / 100_000) / W) * W, v, t);
    s.d = stepCar(s, t, 16);
    assert.ok(s.d > last, `moving at ${t} ms`);
    last = s.d;
  }
  // About where its pace puts it: 15 s of a 100 s lap.
  assert.ok(Math.abs(last - 0.47) < 0.03, String(last));
});

// Jay 2026-11-21 (Las Vegas FP3): "driver going forward then back … sometimes
// super fast and sometimes super slow". A reading was taken as the car just
// crossing into its mini-sector, so a late one slowed it to a fifth of its
// pace, the next sent it at 1.8 times, and one five seconds off snapped it back.
test('a real lap (speed swinging round it, read late every 5 s): never back, never a lurch, at a real car\'s speeds', () => {
  const LAP = 95_000;
  const v = 1 / LAP;
  const truth = [];
  for (let t = 0, f = 0; t <= 200_000; t += 4) truth.push(f), (f += v * 4 * (1 + 0.35 * Math.sin(6 * Math.PI * (f % 1))));
  const at = t => truth[Math.max(0, Math.round(t / 4))];
  let s = null;
  let was = null;
  let sp = null;
  for (let t = 0; t <= 190_000; t += 16) {
    if (t % 5_000 < 16) s = read(s, Math.floor((at(t - 1_500) % 1) / W) * W, v, t);
    const d = stepCar(s, t, 16);
    if (was != null) {
      const now = (d - was) / (v * 16);
      assert.ok(now >= 0, `backwards at ${t} ms`);
      if (t > 10_000) assert.ok(now >= 0.59 && now <= 1.41, `${now.toFixed(2)} times its pace at ${t} ms`);
      if (sp != null && t > 10_000) assert.ok(Math.abs(now - sp) < 0.1, `a lurch at ${t} ms: ${sp.toFixed(2)} → ${now.toFixed(2)}`);
      sp = now;
    }
    s.d = was = d;
  }
  // Still where the car is: within three seconds.
  assert.ok(Math.abs(s.d - at(190_000)) * LAP < 3_000);
});

test('the same mini-sector read again does not pull the car back', () => {
  const v = 1 / 100_000;
  let s = read(null, 0.3, v, 0);
  for (let t = 16; t <= 4_000; t += 16) s.d = stepCar(s, t, 16);
  const before = s.d;
  s = read(s, 0.3, v, 4_000);
  s.d = stepCar(s, 4_016, 16);
  assert.ok(s.d > before);
});

test('a car read behind where it is drawn slows (never stops) until it is back with it', () => {
  const v = 1 / 100_000;
  const s = { ...read(null, 0.5, v, 0), d: 0.56 };
  let d = s.d;
  for (let t = 16; t <= 1_000; t += 16) d = s.d = stepCar(s, t, 16);
  assert.ok(d > 0.56 && (d - 0.56) / (v * 1_000) < 0.75);
});

test('a car the feed has stopped hearing from stops three mini-sectors past its reading', () => {
  const v = 1 / 100_000;
  const s = read(null, 0.2, v, 0);
  for (let t = 16; t <= 90_000; t += 16) s.d = stepCar(s, t, 16);
  assert.ok(Math.abs(s.d - (0.2 + 4 * W)) < 0.002, String(s.d));
});

test('a far jump (a car back from the garage) is put there at once', () => {
  const s = read(read(null, 0.1, 1e-5, 0), 0.7, 1e-5, 4_000);
  assert.ok(s.d >= 0.7 && s.d < 0.7 + W);
});

test('cars on one another drawn as a train, the one ahead where it is', () => {
  const out = spread([0.5, 0.499, 0.2, 0.4985], () => 0.01);
  assert.equal(out[0], 0.5);
  assert.equal(out[1], 0.49);
  assert.equal(out[2], 0.2);
  assert.ok(Math.abs(out[3] - 0.48) < 1e-9);
  // A whole pack: a train back along the line, each a width behind the next, none on another (a cap of six heaped it, then pushed it off the track).
  const pack = spread(Array.from({ length: 10 }, () => 0.5), () => 0.01).sort((a, b) => b - a);
  pack.forEach((f, i) => assert.ok(Math.abs(f - (0.5 - i * 0.01)) < 1e-9));
});

test('a race: each car placed from the leader by its gap, so the order is the race’s', () => {
  const v = 1 / 100_000;
  assert.ok(Math.abs(behindLeader(0.5, 1.8, v) - 0.482) < 1e-9);
  // Across the line: the leader just over it, the second just before.
  assert.ok(Math.abs(behindLeader(0.01, 2, v) - 0.99) < 1e-9);
  // Placed from the leader's stretch read 2 s ago: the car is drawn in it as it is now.
  const s = readCar(null, 0.482, 0.522, v, 2_000, 0);
  assert.ok(Math.abs(s.d - 0.522) < 1e-9);
  // The leader read again at the same place and time: the follower keeps going.
  assert.equal(readCar(s, 0.482, 0.522, v, 6_000, 0).d, s.d);
});

test('a tag goes where it covers nothing: right, else left, above or below; kept where it was unless clearly better', () => {
  const view = [0, 0, 300, 300];
  // Free all round: right.
  assert.equal(placeTags([{ at: [100, 100], w: 50, off: 15 }], [[100, 100]], view)[0][0], 'r');
  // A dot to the right: left.
  assert.equal(placeTags([{ at: [100, 100], w: 50, off: 15 }], [[100, 100], [130, 100]], view)[0][0], 'l');
  // By the right edge of the map: not off it.
  assert.notEqual(placeTags([{ at: [280, 100], w: 50, off: 15 }], [[280, 100]], view)[0][0], 'r');
  // Two cars side by side: their tags apart, not on one another.
  const two = placeTags([{ at: [100, 100], w: 50, off: 15 }, { at: [100, 112], w: 50, off: 15 }], [[100, 100], [100, 112]], view).map(x => x[0]);
  assert.notDeepEqual(two[0], two[1]);
  // Left last time, right free too: stays left (no flicking).
  assert.equal(placeTags([{ at: [100, 100], w: 50, off: 15, was: 'l' }], [[100, 100]], view)[0][0], 'l');
});
