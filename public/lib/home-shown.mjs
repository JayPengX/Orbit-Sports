// What 首頁 lists of a day, an ended game too: only the person's own games
// (followed: a team, a player, a game, a league's chosen game) and, with
// 填滿空檔 on, the games the day's plan filled a free waking hour with.
// Never another game because it's on or over (Jay 2026-11-04: "Why is my
// homepage full of quiet time matches I didn't follow?": six small-hours
// Champions League results under 已結束). Returns both, each once, by the clock.
export function homeGames(events, { followed = () => false, filled = new Set() } = {}) {
  const seen = new Set();
  const own = [];
  const fill = [];
  const key = e => `${e.league}:${e.id}:${e.sessionKey || ''}`;
  for (const e of events || []) {
    if (seen.has(key(e))) continue;
    if (followed(e)) own.push(e);
    else if (filled.has(`${e.league}:${e.id}`)) fill.push(e);
    else continue;
    seen.add(key(e));
  }
  const byStart = (x, y) => Date.parse(x.start) - Date.parse(y.start);
  return { own: own.sort(byStart), filled: fill.sort(byStart) };
}
