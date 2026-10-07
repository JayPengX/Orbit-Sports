// Every league Orbit Sports covers: the shared catalogue's (catalog.mjs,
// the kit's leagues.mjs, which Play reads too) that are on ELTA.tv or Apple
// TV in Taiwan (lib/broadcast.mjs), with its sport, where its data comes from
// and, when Quadra Play sells it, Play's key for it.
//
//   espn    ESPN's site API path (scoreboards, match summaries, teams,
//           rosters, standings, players)
//   asia    CPBL from its own site (through the proxy)
//   play    the catalogue's key for the league's logos and names
//   kind    'match' two sides; 'field' a race weekend
import { leagueLogo as kitLeagueLogo } from '#kit/logos.mjs';
import { SPORTS as ALL_SPORTS, CATALOG } from '#kit/catalog.mjs';
import { BROADCAST } from './broadcast.mjs';

export const LEAGUES = Object.fromEntries(
  Object.entries(CATALOG)
    .filter(([key]) => BROADCAST[key])
    .map(([key, l]) => {
      const league = { sport: l.sport, zh: l.zh, en: l.en, play: l.bet ?? null, kind: l.kind };
      if (l.data === 'espn') league.espn = l.espn;
      if (l.data === 'asia') league.asia = l.asia;
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
// Tables: every match league (not cups), and the drivers' and constructors'
// championship of F1; CPBL's from the league's own (Shared-Data's nightly copy).
export const hasStandings = key => (Boolean(LEAGUES[key]?.espn) && ((LEAGUES[key].kind === 'match' && !LEAGUES[key].cup) || Boolean(LEAGUES[key].standings))) || key === 'cpbl';
export const hasTeams = key => Boolean(LEAGUES[key]?.espn) && LEAGUES[key].kind === 'match';
// A team page: ESPN's leagues, and CPBL's built from its own schedule.
export const hasTeamPage = key => LEAGUES[key]?.kind === 'match';
// The league's logo, from the shared kit (by Quadra Play's key), or null.
export const leagueLogo = key => (LEAGUES[key] ? kitLeagueLogo(LEAGUES[key].play || key) : null);
