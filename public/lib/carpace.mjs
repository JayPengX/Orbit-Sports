// A car's place round the track between the feed's reads, so it never
// stands still on the map: it runs at its own pace (its last lap, else its
// best, else the field's), slower behind the safety car or in the pit lane,
// and is eased onto each new reading without stopping or going backwards.
// Places are in laps (a share of a lap, unbounded: 3.25 is a quarter into
// the fourth); the map draws the part after the point.

// How far one car goes in a millisecond, in laps. Its last lap while it is a
// racing lap (an in-lap or a lap behind the safety car isn't), else its best,
// else the field's best; the safety car (status 4), the virtual one (6, 7), a
// red flag (5) and the pit lane slow it.
export function lapRate({ lastMs = 0, bestMs = 0, inPit = false } = {}, fieldMs = 95_000, status = '') {
  const best = bestMs || fieldMs;
  const lap = lastMs && lastMs <= best * 1.08 ? lastMs : best * 1.02;
  const slow = status === '4' ? 0.62 : status === '6' || status === '7' ? 0.7 : status === '5' ? 0.3 : 1;
  return (slow * (inPit ? 0.45 : 1)) / lap;
}

// The read share of a lap (0–1) as a place by the car's drawn one: ahead of
// it, or a little behind (the feed's lag), never most of a lap back.
export const unwrap = (frac, near) => frac + Math.ceil(near - 0.15 - frac);

// A new reading for a car: `frac` the share of the lap it was at, at the
// time `at` (now, unless it was placed from where the leader was read),
// `seg` the share one mini-sector is (it won't be drawn more than two and a
// half past where it was read: a car that stopped stops there). The same
// place read again keeps the time it was first read (the car goes on from
// there, not back to it). A car more than a twentieth of a lap (about five
// seconds) from where it's drawn is put there: the page opened on the
// phone's older reading, a car back from the garage.
export function readCar(s, frac, v, now, seg = 0.05, at = now) {
  if (!s || s.d == null) return { d: frac + v * (now - at), t: frac, frac, at, v, cap: frac + seg * 2.5 };
  if (s.frac === frac && (at === now || s.at === at)) return { ...s, v };
  const t = unwrap(frac, s.d - v * (now - at));
  const p = t + v * (now - at);
  const d = Math.abs(p - s.d) > 0.05 ? p : s.d;
  return { d, t, frac, at, v, cap: t + seg * 2.5 };
}

// A race: each car's place from the leader's, its gap to the leader (in
// seconds) taken off at the leader's pace, so the order on the map is the
// race's (each car read at its own timing points drifted out of order: the
// leader drawn behind the second, 1.8 s back). A share of a lap.
export const behindLeader = (leaderFrac, gapS, leaderRate) => ((((leaderFrac - gapS * 1000 * leaderRate) % 1) + 1) % 1);

// The car a frame on (`dt` ms, at `now`): toward where its pace says it is
// since it was read, by its own speed plus what it's behind or ahead (made
// up over a second and a half), never under a fifth of its speed nor over
// 1.8 times it, and never past its cap.
export function stepCar(s, now, dt) {
  const p = Math.min(s.cap, s.t + s.v * (now - s.at));
  const speed = Math.min(s.v * 1.8, Math.max(s.v * 0.2, s.v + (p - s.d) / 1500));
  return Math.max(s.d, Math.min(s.cap, s.d + speed * dt));
}

// Cars drawn as a train where one would sit on another: by place round the
// lap, the car behind kept a dot's width (`sep(f)`, a share of a lap) back
// from the one ahead, set back six widths at most (a whole pack touches).
// [share of the lap, …] → where each is drawn.
export function spread(fracs, sep) {
  const order = fracs.map((f, i) => [f, i]).sort((a, b) => b[0] - a[0]);
  const out = [...fracs];
  let ahead = null;
  for (const [f, i] of order) {
    const w = sep(f);
    const at = ahead != null && ahead - f < w ? Math.max(f - w * 6, ahead - w) : f;
    out[i] = at;
    ahead = at;
  }
  return out;
}
