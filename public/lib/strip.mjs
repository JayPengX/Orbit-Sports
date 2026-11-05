import { addDays as plus } from '#kit/format.mjs';

// The days a date strip shows: `only` (a league's or a sport's game days,
// the whole season's) as they are, else every day of `range` around `base`
// (days from it); the day picked always among them. Dates 'YYYY-MM-DD'.
export function stripDays(current, { only = null, range = { from: -30, to: 45 }, base }) {
  const list = only ? [...only] : Array.from({ length: range.to - range.from + 1 }, (_, i) => plus(base, range.from + i));
  if (current && !list.includes(current)) list.push(current);
  return [...new Set(list)].sort();
}

// 賽事's chosen day: the one the person picked (on 全部's strip, a league's,
// or 全部's 還有 N 場 into a league) goes with them across 賽事's switches,
// 全部 ↔ a league and a league ↔ another (Jay 2026-11-04: 全部 went back to
// today whatever day he had opened the league on). null: today, whichever
// day that is now.
export const chosenOf = (d, today) => (d && d !== today ? d : null);

// 首頁's way back from a sport (Jay 2026-11-05): a sport's chip may move the
// day to one it plays, so the day and the scroll it left from are kept, and
// 全部 or 我的比賽 goes back to them. A sport to another keeps the first
// place; a day picked meanwhile (the strip, a swipe) drops it, so the
// person stays on the day they chose. `from`, `to`: whether each is a sport.
// Gives the place kept now, and where to go back to (or null).
export function sportBack(kept, { from, to, date, y }) {
  if (!from && to) return { kept: { date, y }, back: null };
  if (from && !to) return { kept: null, back: kept };
  return { kept, back: null };
}
