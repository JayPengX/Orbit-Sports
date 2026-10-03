// Where a game is on in Taiwan, game by game: ELTA's schedule (read through
// the proxy, kept half an hour) and, for the NBA, NBA.com's Taiwan schedule
// (kept six hours), matched to the game (lib/broadcast.mjs). The page is told
// to draw again when a schedule comes in (`onTvChange`).
import { proxyJson } from './quadra.mjs';
import { ELTA_LIST, parseElta, eltaDays, nbaEltaGames, broadcastsFor } from './broadcast.mjs';
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
// NBA.com's ELTA games, the season: the deploy's copy on this site (scripts/nba-elta.mjs).
const nbaSchedule = schedule(
  () =>
    fetch('./nba-elta.json').then(r => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    }),
  nbaEltaGames,
  6 * 3_600_000
);
// NBA.com's ELTA games after ELTA's own list ends, for its guide: the game
// known, its channel not yet ({ league, start, end, teams, title, day, channels: [] }).
const NBA_NAME = Object.fromEntries(Object.entries(NBA_ID).map(([name, id]) => [1610612700 + id, name]));
const taipeiDay = ms => new Date(ms + 8 * 3_600_000).toISOString().slice(0, 10);
export function nbaAfterList() {
  const programs = eltaSchedule();
  const games = nbaSchedule();
  const last = programs?.length ? eltaDays(programs).to : '';
  if (!games?.length) return [];
  const zh = id => teamNameZh('nba', NBA_NAME[id])?.short || NBA_NAME[id] || '';
  return games.filter(g => taipeiDay(g.start) > last).map(g => ({ league: 'nba', start: g.start, end: g.start + 150 * 60_000, teams: [zh(g.away), zh(g.home)], title: '', day: taipeiDay(g.start), channels: [] }));
}
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
// Only those of this very game (a schedule's, or Apple TV's every MLS game): for a row's 📺 line.
export const channelsOf = e => tvOf(e).filter(b => b.exact);
// On TV in Taiwan, this very game: the only ones recommended.
export const onTv = e => channelsOf(e).length > 0;
// The way to watch a game now: its best channel with a link, or null.
export const watchOf = e => tvOf(e).find(b => b.url && b.exact) || null;
// Whether the lists that say what's on are in (ELTA's, NBA.com's): before
// that no game can be said to be on, so nothing is recommended yet.
export const tvReady = () => eltaSchedule() !== null && nbaSchedule() !== null;
// The last day ELTA's list covers ('YYYY-MM-DD', Taiwan's), or null: past it
// only the NBA's (NBA.com) and MLS's games can be known to be on.
export const tvUntil = () => eltaDays(eltaSchedule() || [])?.to || null;
// Whether it's known if a game is on TV: MLS and F1 always (Apple TV's
// every game, ELTA's every session), the NBA once NBA.com's list is in, the
// rest within ELTA's list.
export const tvKnown = e =>
  e.league === 'mls' ||
  e.league === 'f1' || (e.league === 'nba' && Boolean(nbaSchedule()?.length)) || Boolean(tvUntil() && new Date(Date.parse(e.start) + 8 * 3_600_000).toISOString().slice(0, 10) <= tvUntil());
