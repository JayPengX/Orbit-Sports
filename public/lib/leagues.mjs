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

// Soccer in the order a Taiwan viewer would watch it (the owner's calls,
// 2026-10-15): the kick-off in Taiwan's day first, then the level, a kind
// kept together. The leagues: 英超 (elite, 20:00–00:00 on a weekend), 德甲
// (21:30), 義甲 (18:30 to 02:45), 法甲 (mostly 03:00), 美職足 (Taiwan's
// weekend breakfast, on Apple TV: forward of the 03:00 cups); then UEFA's
// cups, 歐冠 (elite but 03:00 midweek), 歐霸 and 歐協聯 (Thursdays); then
// 英足總盃 (ELTA's from the third round in January, a weekend evening),
// 蘇超 (22:00, a level down) and 歐國聯 (internationals, 02:45). A league
// not named keeps the catalogue's place after them.
const SOCCER_WATCH = ['epl', 'bundesliga', 'seriea', 'ligue1', 'laliga', 'mls', 'ucl', 'uel', 'uecl', 'facup', 'scotland', 'worldcup', 'nationsleague'];
const watchRank = k => (SOCCER_WATCH.includes(k) ? SOCCER_WATCH.indexOf(k) : SOCCER_WATCH.length);
// The catalogue's order, soccer's own places filled in the watching order.
const inOrder = entries => {
  const soccer = entries.filter(([, l]) => l.sport === 'soccer').sort(([a], [b]) => watchRank(a) - watchRank(b));
  return entries.map(x => (x[1].sport === 'soccer' ? soccer.shift() : x));
};

export const LEAGUES = Object.fromEntries(
  inOrder(Object.entries(CATALOG))
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
// The Premier League's is its lion, cut whole from ESPN's logo (the kit's
// crop of it leaves the lion small).
const isEpl = key => (LEAGUES[key]?.play || key) === 'epl';
export const leagueLogo = key => (!LEAGUES[key] ? null : isEpl(key) ? new URL('../img/epl.png', import.meta.url).href : kitLeagueLogo(LEAGUES[key].play || key));
// Its dark-screen version, for the kit's logo tile (dark grey in dark mode,
// where the purple lion, Ligue 1 or the UEFA marks all but vanish): ESPN's
// 500-dark logo, and for the Premier League the white lion (cut from ESPN's
// dark logo, clear of its wordmark). Null where there's none.
export function leagueLogoDark(key) {
  if (isEpl(key)) return new URL('../img/epl-dark.png', import.meta.url).href;
  const light = leagueLogo(key);
  return light?.startsWith('https://a.espncdn.com/i/') ? light.replace('/500/', '/500-dark/') : null;
}
