// Where a game is on in Taiwan, game by game: ELTA's schedule (read through
// the proxy, kept half an hour) matched to the game (lib/broadcast.mjs), the
// other services by league. The page is told to draw again when the schedule
// comes in (`onTvChange`).
import { proxyJson } from './quadra.mjs';
import { ELTA_LIST, parseElta, broadcastsFor } from './broadcast.mjs';
import { teamNameZh } from './names.mjs';
import { LEAGUES } from './leagues.mjs';

let programs = null;
let at = 0;
let loading = false;
let changed = () => {};
export const onTvChange = fn => (changed = fn);
// ELTA's programs (null until read; read again after half an hour).
export function eltaSchedule() {
  if (!loading && Date.now() - at > 30 * 60_000) {
    loading = true;
    proxyJson(ELTA_LIST, { ttl: 30 * 60_000 })
      .then(data => (programs = parseElta(data)))
      .catch(() => (programs = programs || []))
      .finally(() => {
        loading = false;
        at = Date.now();
        changed();
      });
  }
  return programs;
}
// The games known to the page (a program without the sides' names is only
// given to a game with no other of its league starting near it).
let known = () => [];
export const knownEvents = fn => (known = fn);
// A game's sides in Chinese, every way they're written (ELTA writes "海盜", "統一").
function zhSides(e) {
  const l = LEAGUES[e.league];
  return [e.home, e.away].flatMap(s => {
    const zh = teamNameZh(l?.play || e.league, s?.en || s?.name, l?.sport);
    return [s?.name, s?.short, zh?.full, zh?.short].filter(Boolean);
  });
}
// Everything a game is on: { zh, en, kind, svc, ch?, url?, note? }, exact channels first.
export const tvOf = e => (e ? broadcastsFor(e, eltaSchedule(), zhSides(e), known()) : []);
// Only the exact channels (from ELTA's schedule): for a row's 📺 line.
export const channelsOf = e => tvOf(e).filter(b => b.ch);
