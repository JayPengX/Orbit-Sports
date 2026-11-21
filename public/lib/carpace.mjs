// A car's place round the track between the feed's reads, so it never
// stands still on the map: it runs at its own pace (its last lap, else its
// best, else the field's), slower behind the safety car or in the pit lane,
// and is eased onto each new reading without stopping or going backwards.
// Places are in laps (a share of a lap, unbounded: 3.25 is a quarter into
// the fourth); the map draws the part after the point.

// How far one car goes in a millisecond, in laps. Its last lap while it is a
// racing lap (an in-lap or a lap behind the safety car isn't), else its best,
// else the field's best; the safety car (status 4), the virtual one (6, 7)
// and the pit lane slow it; a red flag (5) stops it (the cars wait in the
// pit lane: they went on round the map before, Jay 2026-11-03).
export function lapRate({ lastMs = 0, bestMs = 0, inPit = false } = {}, fieldMs = 95_000, status = '') {
  const best = bestMs || fieldMs;
  const lap = lastMs && lastMs <= best * 1.08 ? lastMs : best * 1.02;
  const slow = status === '4' ? 0.62 : status === '6' || status === '7' ? 0.7 : status === '5' ? 0 : 1;
  return (slow * (inPit ? 0.45 : 1)) / lap;
}

// The read share of a lap (0–1) as a place by the car's drawn one: ahead of
// it, or a little behind (the feed's lag), never most of a lap back.
export const unwrap = (frac, near) => frac + Math.ceil(near - 0.15 - frac);

// A new reading for a car: F1's feed says only which mini-sector it is in,
// so a reading is a stretch of the lap, [lo, hi) (shares of a lap), true at
// the time `at` (now, unless it was placed from where the leader was read).
// The car is drawn running at its own pace and left alone while it's in
// that stretch; outside it, it's eased back over a few seconds (stepCar).
// (It was put at the stretch's start as if just crossed: read late, every
// car slowed to a fifth of its pace, then raced at 1.8 times it, and one
// more than five seconds off was snapped back: Jay 2026-11-21, "driver
// going forward then back … sometimes super fast and sometimes super slow".)
// The same stretch read again is the car still in it now; a car more than a
// tenth of a lap from it (the page opened on an old reading, a car back
// from the garage) is put in it at once.
export function readCar(s, lo, hi, v, now, at = now) {
  const w = (((hi - lo) % 1) + 1) % 1 || 0.04;
  if (!s || s.d == null) return { d: lo + w / 2 + v * (now - at), lo, hi: lo + w, at, v, read: lo };
  if (s.read === lo && s.at === at) return { ...s, v };
  const L = unwrap(lo, s.d - v * (now - at));
  const H = L + w;
  const off = s.d - Math.min(Math.max(s.d, L + v * (now - at)), H + v * (now - at));
  const d = Math.abs(off) > 0.1 ? L + w / 2 + v * (now - at) : s.d;
  return { d, lo: L, hi: H, at, v, read: lo, sp: s.sp };
}

// A race: each car's place from the leader's, its gap to the leader (in
// seconds) taken off at the leader's pace, so the order on the map is the
// race's (each car read at its own timing points drifted out of order: the
// leader drawn behind the second, 1.8 s back). A share of a lap.
export const behindLeader = (leaderFrac, gapS, leaderRate) => ((((leaderFrac - gapS * 1000 * leaderRate) % 1) + 1) % 1);

// The car a frame on (`dt` ms, at `now`): at its own pace while it's where
// its last reading and pace since say it can be; behind or ahead of that, a
// little faster or slower till it's back (the gap made up over 2.5 s, its
// speed kept between 0.6 and 1.4 times its pace, as a real car's swings
// round a lap), the speed itself eased over half a second (never a lurch);
// never backwards; slowing to a stop three mini-sectors past its reading
// if no other comes (about fifteen seconds: a car that stopped stops there).
// Moves `s.sp` (the speed drawn) on; returns the new place.
export function stepCar(s, now, dt) {
  const w = s.hi - s.lo;
  const run = s.v * Math.max(0, now - s.at);
  const end = s.hi + w * 3;
  const hi = Math.min(s.hi + run, end);
  const lo = Math.min(s.lo + run, hi);
  const off = Math.min(Math.max(s.d, lo), hi) - s.d;
  const want = Math.min(s.v * 1.4, Math.max(s.v * 0.6, s.v + off / 2500), Math.max(0, (end - s.d) / 3000));
  s.sp = s.sp == null ? want : s.sp + (want - s.sp) * Math.min(1, dt / 500);
  return Math.max(s.d, s.d + Math.max(0, s.sp) * dt);
}

// Cars drawn as a train where one would sit on another: by place round the
// lap, the car behind kept `sep(f)` (a share of the lap) back from the one
// ahead, however long the train (a whole pack behind the safety car runs
// back along the track). Every car stays on the track line: a cap of six
// before heaped a pack, pushed off the line on the screen with a dot left
// where each belonged (Jay 2026-11-03: "the cars are not on the track and
// under the circles there's even small dots").
// [share of the lap, …] → where each is drawn.
export function spread(fracs, sep) {
  const order = fracs.map((f, i) => [f, i]).sort((a, b) => b[0] - a[0]);
  const out = [...fracs];
  let ahead = null;
  for (const [f, i] of order) {
    const at = ahead != null && ahead - f < sep(f) ? ahead - sep(f) : f;
    out[i] = at;
    ahead = at;
  }
  return out;
}

// Where each tag goes (in order: the first picks first): right of its dot,
// left, above or below, whichever covers fewest other dots and tags placed
// and stays inside `view` ([x0, y0, x1, y1]); where it was (`was`), unless
// another is clearly better (a tag flicking side to side as cars pass).
// [{ at: [x, y], w, off, was }] (w, off in the tag's own units, z the zoom)
// → [[side, x, y, anchor]…] in those units.
export function placeTags(tags, dots, view, z = 1) {
  const R = 11.5 / z;
  const h = 14 / z;
  const boxes = [];
  return tags.map(({ at: [x, y], w: w0, off, was }) => {
    const [w, o] = [w0 / z, off / z];
    const spots = [
      ['r', [x + o, y - h / 2, x + o + w, y + h / 2], off, 4, 'start'],
      ['l', [x - o - w, y - h / 2, x - o, y + h / 2], -off, 4, 'end'],
      ['u', [x - w / 2, y - o - h, x + w / 2, y - o], 0, -off - 3, 'middle'],
      ['d', [x - w / 2, y + o, x + w / 2, y + o + h], 0, off + 11, 'middle']
    ];
    const cost = ([side, b]) =>
      dots.filter(([u, v]) => (u !== x || v !== y) && u + R > b[0] && u - R < b[2] && v + R > b[1] && v - R < b[3]).length +
      boxes.filter(q => q[0] < b[2] && q[2] > b[0] && q[1] < b[3] && q[3] > b[1]).length * 2 +
      (b[0] < view[0] || b[2] > view[2] || b[1] < view[1] || b[3] > view[3] ? 3 : 0) +
      (side === 'r' ? 0 : 0.2) -
      (side === was ? 0.6 : 0);
    const best = spots.reduce((a, b) => (cost(b) < cost(a) ? b : a));
    boxes.push(best[1]);
    return [best[0], best[2], best[3], best[4]];
  });
}
