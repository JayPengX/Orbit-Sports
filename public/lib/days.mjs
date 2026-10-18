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

// What a day's reads leave unknown, before it's said to have nothing on
// (a failed read is never "nothing there"): 'leagues' when a league's games
// couldn't be read (the followed ones', `partial`; the others',
// `othersFailed`; with `rest`, every other league's, `restFailed`), 'tv'
// when ELTA's list couldn't (which games are on isn't known), else null:
// only then can a day have nothing on. (A day not held yet is still reading.)
export function dayUnknown(slots, tvFailed = false, { rest = false } = {}) {
  const missed = s => s && (s.partial > 0 || s.othersFailed > 0 || (rest && s.restFailed > 0));
  if (slots.some(missed)) return 'leagues';
  return tvFailed ? 'tv' : null;
}

// A league's table as held (app.js tables): null while it's read, a list
// marked `failed` when it couldn't be (said so, never "no table"), an empty
// one when the league has none.
export const tableSays = groups => (!groups ? 'wait' : groups.length ? 'table' : groups.failed ? 'failed' : 'none');

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
