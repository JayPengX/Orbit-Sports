// Every league Orbit Sports covers: the shared catalogue's (catalog.mjs,
// the kit's) that are on ELTA.tv or Apple TV in Taiwan (lib/broadcast.mjs),
// with its sport, where its data comes from and its catalogue key (`bet`).
//
//   espn    ESPN's site API path (scoreboards, match summaries, teams,
//           rosters, standings, players)
//   asia    CPBL from its own site (through the proxy)
//   play    the catalogue's key for the league's logos and names
//   kind    'match' two sides; 'field' a race weekend
import { leagueLogo as kitLeagueLogo } from '#kit/logos.mjs';
import { SPORTS as ALL_SPORTS } from '#kit/catalog.mjs';
import { LEAGUES } from '#kit/sports-espn.mjs';

// The leagues themselves are the kit's (kit/sports-espn.mjs, which the proxy's builders read too).
export { LEAGUES };
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
// The league's logo, from the shared kit (by its catalogue key), or null.
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
  // (The original or the kit's small one through ESPN's resizer: its path inside.)
  return /^https:\/\/a\.espncdn\.com\/(i|combiner)\b/.test(light || '') && light.includes('/500/') ? light.replace('/500/', '/500-dark/') : null;
}
