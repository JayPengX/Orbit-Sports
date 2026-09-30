// Whether Quadra Play sells a game now, so 投注 shows only where Play has it:
// every game of every league Play sells, starting within Play's reach (the
// kit's SOLD_DAYS), the same for all of them. Play prices a game no bookmaker
// has yet itself (Play's house.mjs), from ESPN's schedules, Asian baseball's
// own lists and Kambi's, the same lists this page shows.
import { CATALOG, SOLD_DAYS } from './catalog.mjs';

const DAY = 86_400_000;

// How far ahead Play's board reaches: one reach for every league.
export const REACH = SOLD_DAYS * DAY;

// A two-sided game (a match, a bout, a draw's match): whether Play has it. A
// game on now keeps its link (Play's live board has it, or says why not).
export function playablePair(key, start, a, b, state = 'pre', now = Date.now()) {
  if (!CATALOG[key]?.bet || !start || !a || !b) return false;
  const t = Date.parse(start);
  return !(state === 'pre' && (t - now > REACH || t < now - 5 * 60_000));
}
export function playable(e, now = Date.now()) {
  if (!e || e.other || e.kind !== 'match' || e.status?.void) return false;
  const a = e.away?.en || e.away?.name;
  const b = e.home?.en || e.home?.name;
  return playablePair(e.league, e.start, a, b, e.status?.state, now);
}
// A league board in Play (a fight card, a tennis draw): every league Play sells.
export const leagueOnSale = key => Boolean(CATALOG[key]?.bet);
