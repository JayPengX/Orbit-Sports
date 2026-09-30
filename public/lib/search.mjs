// Search in 賽事: leagues by name (in either language), and teams and players
// from ESPN's search (site.api.espn.com/apis/search/v2), each placed in the
// league Fixtures knows it by (ESPN's league id in the result's uid,
// "s:20~l:28~t:21" = the NFL's team 21).
import { LEAGUES } from './leagues.mjs';

// ESPN's league ids, by Fixtures' league key's (from each scoreboard's league id).
export const ESPN_LEAGUE_ID = {"mlb": "10", "nba": "46", "nfl": "28", "ncaaf": "23", "nhl": "90", "epl": "700", "laliga": "740", "seriea": "730", "bundesliga": "720", "ligue1": "710", "ucl": "775", "uel": "776", "uecl": "20296", "eredivisie": "725", "primeira": "715", "scotland": "735", "belgium": "3901", "superlig": "3946", "saudi": "21231", "mls": "770", "ligamx": "760", "brasileirao": "630", "argentina": "745", "libertadores": "783", "sudamericana": "5454", "jleague": "750", "facup": "3918", "leaguecup": "3920", "copadelrey": "3951", "nationsleague": "2395", "wcqeurope": "786", "acl": "3902", "asiancup": "20219", "friendly": "3922", "atp": "851", "wta": "900", "f1": "2030", "pga": "1106", "lpga": "1107", "ufc": "3321", "wnba": "59"};
const BY_ID = Object.fromEntries(Object.entries(ESPN_LEAGUE_ID).map(([k, id]) => [id, k]));
// Soccer's clubs and players carry no league id ("s:600~t:382"): their
// default league's slug ("eng.1", sport "soccer") says which one.
const BY_PATH = Object.fromEntries(Object.entries(LEAGUES).filter(([, l]) => l.espn).map(([k, l]) => [l.espn, k]));

const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

// Leagues whose name (Chinese or English) or key has the words typed.
export function findLeagues(query) {
  const q = norm(query);
  if (!q) return [];
  return Object.keys(LEAGUES).filter(k => [k, LEAGUES[k].zh, LEAGUES[k].en].some(x => norm(x).includes(q)));
}

// ESPN's answer: { teams: [{ league, id, name, logo }], players: [...] }, only
// those of leagues Fixtures has.
export function parseSearch(data) {
  const out = { teams: [], players: [] };
  for (const r of data?.results || []) {
    const list = r.type === 'team' ? out.teams : r.type === 'player' ? out.players : null;
    if (!list) continue;
    for (const c of r.contents || []) {
      const id = /~[at]:(\d+)/.exec(c.uid || '')?.[1];
      const lid = /l:(\d+)~/.exec(c.uid || '')?.[1];
      const league = (lid && BY_ID[lid]) || (c.sport && c.defaultLeagueSlug && BY_PATH[`${c.sport}/${c.defaultLeagueSlug}`]);
      if (!id || !league || !LEAGUES[league]) continue;
      list.push({ league, id, name: c.displayName || '', sub: c.subtitle || c.description || '', logo: c.image?.default || c.image?.defaultDark || null });
    }
  }
  return out;
}
