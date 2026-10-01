// Every league Quadra Fixtures covers, from the shared catalogue (catalog.mjs,
// the kit's leagues.mjs, which Play reads too): its sport, where its data
// comes from and, when Quadra Play sells it, Play's key for it (the "bet on
// this" link).
//
//   espn    ESPN's site API path (scoreboards, match summaries, teams,
//           rosters, standings, players)
//   kambi   Kambi's list view path (schedules and live scores only)
//   asia    NPB, KBO, CPBL from the leagues' own sites (through the proxy)
//   tsdb    Formula E from TheSportsDB; fom F2 and F3 from their own sites
//   play    the catalogue's key for the league's logos and names
//   kind    'match' two sides; 'field' a race weekend
import { leagueLogo as kitLeagueLogo } from './logos.mjs';
import { SPORTS as ALL_SPORTS, CATALOG } from './catalog.mjs';

export const LEAGUES = Object.fromEntries(
  Object.entries(CATALOG).map(([key, l]) => {
    const league = { sport: l.sport, zh: l.zh, en: l.en, play: l.bet ?? null, kind: l.kind };
    if (l.data === 'espn') league.espn = l.espn;
    if (l.data === 'kambi') league.kambi = l.kambi;
    if (l.data === 'asia') league.asia = l.asia;
    if (l.data === 'tsdb') league.tsdb = l.tsdb;
    if (l.data === 'fom') league.fom = l.fom;
    for (const k of ['top', 'cup', 'standings']) if (l[k]) league[k] = l[k];
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
export const hasStandings = key => (Boolean(LEAGUES[key]?.espn) && ((LEAGUES[key].kind === 'match' && !LEAGUES[key].cup) || Boolean(LEAGUES[key].standings)));
export const hasTeams = key => Boolean(LEAGUES[key]?.espn) && LEAGUES[key].kind === 'match';
// A team page: ESPN's leagues, and the others built from their own schedules.
export const hasTeamPage = key => LEAGUES[key]?.kind === 'match';
// The league's logo, from the shared kit (by Quadra Play's key), or null.
export const leagueLogo = key => (LEAGUES[key] ? kitLeagueLogo(LEAGUES[key].play || key) : null);
