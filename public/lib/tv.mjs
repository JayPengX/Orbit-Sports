// Where a game is on in Taiwan, game by game: ELTA's schedule (read through
// the proxy, kept half an hour) and, for the NBA, NBA.com's Taiwan schedule
// (kept six hours), matched to the game (lib/broadcast.mjs). The page is told
// to draw again when a schedule comes in (`onTvChange`).
import { proxyJson } from './quadra.mjs';
import { ELTA_LIST, NBA_TW_SCHEDULE, parseElta, nbaEltaGames, broadcastsFor } from './broadcast.mjs';
import { teamNameZh } from './names.mjs';
import { NBA_ID } from './logos.mjs';
import { LEAGUES } from './leagues.mjs';

let changed = () => {};
export const onTvChange = fn => (changed = fn);
// A schedule read now and again: null until read, then what `parse` makes of
// it (an empty list when it can't be read).
function schedule(read, parse, ttl) {
  let value = null;
  let at = 0;
  let loading = false;
  return () => {
    if (!loading && Date.now() - at > ttl) {
      loading = true;
      read()
        .then(data => (value = parse(data)))
        .catch(() => (value = value || []))
        .finally(() => {
          loading = false;
          at = Date.now();
          changed();
        });
    }
    return value;
  };
}
// ELTA's programs.
export const eltaSchedule = schedule(() => proxyJson(ELTA_LIST, { ttl: 30 * 60_000 }), parseElta, 30 * 60_000);
// NBA.com's ELTA games: from the proxy (only those, a few KB), else NBA.com's
// whole file straight from the device (its CDN lets any site read it).
const nbaSchedule = schedule(
  () =>
    proxyJson(NBA_TW_SCHEDULE, { ttl: 6 * 3_600_000 }).catch(() =>
      fetch(NBA_TW_SCHEDULE).then(r => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
    ),
  nbaEltaGames,
  6 * 3_600_000
);
// An NBA team's NBA.com id (the kit's NBA_ID: 38 → 1610612738), or null (a guest club).
const nbaId = side => (NBA_ID[side?.en || side?.name] ? 1610612700 + NBA_ID[side.en || side.name] : null);

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
// The commentary the person likes ('en' 原音, 'zh' 中文): their channels sort by it.
let prefer = () => 'en';
export const audioPref = fn => (prefer = fn);
// Everything a game is on: { zh, en, short, svc, url, app?, ch?, at?, audio?,
// adFree?, exact?, note? }, the channels that suit the person best first.
export const tvOf = e => {
  if (!e) return [];
  const nba = e.league === 'nba' ? { games: nbaSchedule(), ids: { home: nbaId(e.home), away: nbaId(e.away) } } : null;
  return broadcastsFor(e, eltaSchedule(), { sides: zhSides(e), others: known(), prefer: prefer(), nba });
};
// Only those of this very game (a schedule's): for a row's 📺 line.
export const channelsOf = e => tvOf(e).filter(b => b.exact);
// The way to watch a game now: its best channel with a link, or null.
export const watchOf = e => tvOf(e).find(b => b.url && (b.exact || b.svc !== 'elta')) || null;
