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

// The order 賽事's leagues come in after the ones followed (Jay, 2026-10-26):
// what's at stake first, how far through its season a league is (its last
// quarter: a title or the play-offs being settled, 中華職棒's 台灣大賽,
// MLS's run-in; past half: getting there), then, stakes alike, how watchable
// it is in Taiwan (every league here is on ELTA or Apple TV: how much it's
// followed here and at what hour), then its level.
export const TAIWAN_WATCH = ['cpbl', 'mlb', 'nba', 'epl', 'f1', 'ucl', 'bundesliga', 'seriea', 'ligue1', 'uel', 'mls', 'facup', 'nationsleague', 'uecl', 'scotland'];
// `bounds`: a league's season ({ from, to } days, lib/bounds.mjs) or null; `day` today.
export function stakesOf(bounds, day) {
  if (!bounds) return 0;
  const [from, to, now] = [bounds.from, bounds.to, day].map(d => Date.parse(`${d}T00:00:00Z`));
  const gone = to > from ? (now - from) / (to - from) : 0;
  return gone >= 0.75 ? 2 : gone >= 0.5 ? 1 : 0;
}
export function byStakes(keys, boundsOf, day) {
  const watch = k => (TAIWAN_WATCH.indexOf(k) + 1 || TAIWAN_WATCH.length + 1);
  // (A cup's only at its end, the late rounds: its days span its rounds months apart, the FA Cup's two seasons.)
  const stakes = new Map(keys.map(k => [k, stakesOf(boundsOf(k), day)]).map(([k, x]) => [k, LEAGUES[k]?.cup && x < 2 ? 0 : x]));
  return [...keys].sort((a, b) => stakes.get(b) - stakes.get(a) || watch(a) - watch(b));
}
