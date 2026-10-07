// Search in 賽事: leagues by name (in either language), and teams and players
// from ESPN's search (site.api.espn.com/apis/search/v2), each placed in the
// league Orbit Sports knows it by (ESPN's league id in the result's uid,
// "s:40~l:46~t:2" = the NBA's team 2).
import { LEAGUES } from './leagues.mjs';
import { teamLogo } from '#kit/logos.mjs';

// ESPN's league ids, by Orbit Sports' league key's (from each scoreboard's league id).
export const ESPN_LEAGUE_ID = { mlb: '10', nba: '46', epl: '700', seriea: '730', bundesliga: '720', ligue1: '710', ucl: '775', uel: '776', uecl: '20296', scotland: '735', mls: '770', facup: '3918', nationsleague: '2395', f1: '2030' };
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
// those of leagues Orbit Sports has, and footballers of other leagues
// unplaced ({ league: null, slug }: a European cup may have them).
export function parseSearch(data) {
  const out = { teams: [], players: [] };
  for (const r of data?.results || []) {
    const list = r.type === 'team' ? out.teams : r.type === 'player' ? out.players : null;
    if (!list) continue;
    for (const c of r.contents || []) {
      const id = /~[at]:(\d+)/.exec(c.uid || '')?.[1];
      const lid = /l:(\d+)~/.exec(c.uid || '')?.[1];
      const league = (lid && BY_ID[lid]) || (c.sport && c.defaultLeagueSlug && BY_PATH[`${c.sport}/${c.defaultLeagueSlug}`]);
      // A men's club (or its player) in a league Orbit Sports doesn't have
      // (Benfica's Portuguese Liga): kept unplaced (league null, its
      // league's slug), for its European cup to place it (placeInCups).
      const unplaced = !league && c.sport === 'soccer' && c.defaultLeagueSlug && !/(^|\.)w|women|youth|u\d{2}|friendly/i.test(c.defaultLeagueSlug);
      if (!id || (!unplaced && (!league || !LEAGUES[league]))) continue;
      if (unplaced) {
        list.push({ league: null, slug: c.defaultLeagueSlug, id, name: c.displayName || '', sub: c.subtitle || c.description || '', logo: c.image?.default || c.image?.defaultDark || null });
        continue;
      }
      // An NBA team's logo is NBA.com's (the kit's), as everywhere.
      const logo = league === 'nba' && r.type === 'team' ? teamLogo('nba', c.displayName) : c.image?.default || c.image?.defaultDark || null;
      list.push({ league, id, name: c.displayName || '', sub: c.subtitle || c.description || '', logo });
    }
  }
  return out;
}

// The unplaced ones placed in the European cup their club plays in this
// season (`cups`: a club's id → 'ucl' | 'uel' | 'uecl'; `clubOf`: a player's
// club id, from their league's slug and id), the rest left out.
export async function placeInCups(found, cups, clubOf) {
  const players = await Promise.all(
    found.players.map(async x => {
      if (x.league) return x;
      const club = await clubOf(x.slug, x.id).catch(() => null);
      return club && cups.get(String(club)) ? { ...x, league: cups.get(String(club)) } : null;
    })
  );
  return {
    ...found,
    teams: found.teams.map(x => (x.league ? x : cups.get(String(x.id)) ? { ...x, league: cups.get(String(x.id)) } : null)).filter(Boolean),
    players: players.filter(Boolean)
  };
}
