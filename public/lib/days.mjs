// Days on the viewer's own clock, shared by the page and the tests; and
// Taiwan's own date of a moment (UTC+8, no summer time), whatever the clock.
export const taipeiDate = t => new Date(new Date(t).getTime() + 8 * 3_600_000).toISOString().slice(0, 10);

// A day's leagues as read (app.js readDay): each league's list, or null when
// none of it could be read. A list with pages unread (scoreboard's `unread`)
// counts as failed (the day isn't kept, it's read again shortly) but what
// came is shown; only when no league came at all is the whole read a failure.
export function dayReads(keys, lists) {
  const read = new Set();
  let failed = 0;
  let none = 0;
  keys.forEach((k, i) => {
    const list = lists[i];
    if (!list) (failed++, none++);
    else if (list.unread?.length) failed++;
    else read.add(k);
  });
  return { read, failed, unread: keys.length > 0 && none === keys.length };
}

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
