// Matches followed on their own (a game between two teams the person
// doesn't follow): what of a day they bring in, and when they're let go.

// A race weekend's sessions all share its key (the weekend's id).
export const gameKey = e => `${e.league}:${e.weekend || e.id}`;

// A game of a league read only for a followed match in it (none of its teams
// or players followed, the league not followed): not the person's, and not
// one of the others' either (those are the leagues not read for them). One
// New England v Miami followed is that game, never MLS (Jay 2026-11-01, and
// 2026-11-03: Atlanta v Toronto on top of 首頁 while it wasn't on).
// `own`: the leagues followed and the followed teams' and players'.
export function matchOnly(e, own, games) {
  if (own.has(e.league)) return false;
  const key = gameKey(e);
  return !games.some(g => gameKey(g) === key) && games.some(g => g.league === e.league);
}

// A followed match over is let go (Jay 2026-11-03: "Finished match should
// auto remove from followed list"), once its final has surely been told: the
// app said it itself (`told`), or this phone has seen it over for WAIT (the
// Worker checks finals every 2 minutes, from the list the app sent; sent
// without it before the Worker's check, the result never came, 2026-10-21),
// or the Worker has stopped asking (8 hours after the start). Called off
// (延期) is kept: it can be played later.
// `fresh`: the match's newest copy (a race weekend's: its race). `seen`: key
// → when this phone first saw it over (kept up to date here).
export const WAIT = 10 * 60_000;
const ASKED = 8 * 3_600_000;
export function endedFollows(games, { fresh, told = new Set(), seen = new Map(), now = Date.now() }) {
  const out = new Set();
  for (const g of games) {
    const e = fresh(g) || g;
    const key = gameKey(g);
    if (e.status?.state !== 'post' || e.status?.void) {
      seen.delete(key);
      continue;
    }
    if (!seen.has(key)) seen.set(key, now);
    if (told.has(`${e.league}:${e.id}`) || now - seen.get(key) >= WAIT || now - Date.parse(e.start) >= ASKED) out.add(key);
  }
  return out;
}

// Why a game is marked in a list: 'pick' when it's in their day for their
// own sake (a followed team's, player's or match's, or their followed
// league's chosen game), 'fill' when only 填滿空檔 put it there (Jay
// 2026-11-05: the EPL is there because he follows it, MLS because fill is
// on), null when it isn't marked at all.
export const pickKind = (picked, followed) => (!picked ? null : followed ? 'pick' : 'fill');
