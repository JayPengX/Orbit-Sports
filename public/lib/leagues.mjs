// Every league Quadra Fixtures covers, from the shared catalogue (catalog.mjs,
// the kit's leagues.mjs, which Play reads too): its sport, where its data
// comes from and, when Quadra Play sells it, Play's key for it (the "bet on
// this" link).
//
//   espn    ESPN's site API path (scoreboards, match summaries, teams,
//           rosters, standings, players)
//   kambi   Kambi's list view path (schedules and live scores only)
//   asia    NPB, KBO, CPBL from the leagues' own sites (through the proxy)
//   play    Quadra Play's league key
//   kind    'match' two sides; 'field' a race or tournament; 'card' a fight card;
//           'draw' a tennis draw
import { leagueLogo as kitLeagueLogo } from './logos.mjs';
import { SPORTS as ALL_SPORTS, CATALOG } from './catalog.mjs';

// Only what Taiwan can watch (the catalogue's `off` leagues left out).
export const LEAGUES = Object.fromEntries(
  Object.entries(CATALOG)
    .filter(([, l]) => !l.off)
    .map(([key, l]) => {
    const league = { sport: l.sport, zh: l.zh, en: l.en, play: l.bet ?? null, kind: l.kind };
    if (l.data === 'espn') league.espn = l.espn;
    if (l.data === 'kambi') league.kambi = l.kambi;
    if (l.data === 'asia') league.asia = l.asia;
    if (l.data === 'tsdb') league.tsdb = l.tsdb;
    if (l.data === 'motogp') league.motogp = true;
    for (const k of ['top', 'cup', 'standings', 'players']) if (l[k]) league[k] = l[k];
    return [key, league];
  })
);
// The sports with a league left.
export const SPORTS = Object.fromEntries(Object.entries(ALL_SPORTS).filter(([k]) => Object.values(LEAGUES).some(l => l.sport === k)));

export const leagueName = (key, lang = 'zh') => LEAGUES[key]?.[lang === 'en' ? 'en' : 'zh'] || key;
export const leaguesOf = sport => Object.keys(LEAGUES).filter(k => LEAGUES[k].sport === sport);
export const TOP_LEAGUES = Object.keys(LEAGUES).filter(k => LEAGUES[k].top);
// Kinds of data each source has.
// Tables: every match league (not cups), and the drivers' and constructors' championship of F1.
export const hasStandings = key => Boolean(LEAGUES[key]?.espn) && ((LEAGUES[key].kind === 'match' && !LEAGUES[key].cup) || Boolean(LEAGUES[key].standings));
export const hasTeams = key => Boolean(LEAGUES[key]?.espn) && LEAGUES[key].kind === 'match';
// The league's logo, from the shared kit (by Quadra Play's key), or null.
export const leagueLogo = key => (LEAGUES[key] ? kitLeagueLogo(LEAGUES[key].play || key) : null);
