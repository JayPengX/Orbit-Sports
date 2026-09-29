// Search in 賽事: leagues by name (in either language), and teams and players
// from ESPN's search (site.api.espn.com/apis/search/v2), each placed in the
// league Fixtures knows it by (ESPN's league id in the result's uid,
// "s:20~l:28~t:21" = the NFL's team 21).
import { LEAGUES } from './leagues.mjs';

// ESPN's league ids, by Fixtures' league key's (from each scoreboard's league id).
export const ESPN_LEAGUE_ID = {"mlb": "10", "nba": "46", "ncaam": "41", "ncaaw": "54", "nfl": "28", "ncaaf": "23", "nhl": "90", "epl": "700", "laliga": "740", "seriea": "730", "bundesliga": "720", "ligue1": "710", "ucl": "775", "uel": "776", "uecl": "20296", "eredivisie": "725", "primeira": "715", "championship": "3914", "league1": "3915", "scotland": "735", "bundesliga2": "3927", "laliga2": "3921", "serieb": "3931", "ligue2": "3926", "belgium": "3901", "austria": "3907", "swiss": "3944", "denmark": "3913", "norway": "3960", "sweden": "3945", "greece": "3955", "superlig": "3946", "saudi": "21231", "mls": "770", "usl": "4002", "nwsl": "8301", "ligamx": "760", "brasileirao": "630", "argentina": "745", "colombia": "650", "chile": "640", "libertadores": "783", "sudamericana": "5454", "jleague": "750", "csl": "8376", "aleague": "3906", "facup": "3918", "leaguecup": "3920", "copadelrey": "3951", "nationsleague": "2395", "wcqeurope": "786", "atp": "851", "wta": "900", "f1": "2030", "indycar": "2040", "nascar": "2021", "pga": "1106", "lpga": "1107", "ufc": "3321", "nrl": "8370", "afl": "35", "wnba": "59"};
const BY_ID = Object.fromEntries(Object.entries(ESPN_LEAGUE_ID).map(([k, id]) => [id, k]));

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
      const uid = /l:(\d+)~[at]:(\d+)/.exec(c.uid || '');
      const league = uid && BY_ID[uid[1]];
      if (!league) continue;
      list.push({ league, id: uid[2], name: c.displayName || '', sub: c.subtitle || c.description || '', logo: c.image?.default || c.image?.defaultDark || null });
    }
  }
  return out;
}
