// Days on the viewer's own clock, shared by the page and the tests.

// The game day nearest to now (a day's noon against now; on a tie, the one
// still to come). days: 'YYYY-MM-DD' strings.
export function nearestDay(days, now = Date.now()) {
  let best = null;
  let bestD = Infinity;
  for (const d of days) {
    const mid = Date.parse(`${d}T12:00:00`);
    const dist = Math.abs(mid - now) - (mid >= now ? 1 : 0);
    if (dist < bestD) {
      best = d;
      bestD = dist;
    }
  }
  return best;
}
