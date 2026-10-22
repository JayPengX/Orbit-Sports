// The keys a match is about ('league:<key>', 'team:<key>:<name>',
// 'sport:<family>', the catalogue's keys), so a team followed here lifts its
// games.
import { LEAGUES } from './leagues.mjs';
import { familyOfSport } from '#kit/catalog.mjs';
import { normalizeTeamName } from './espn.mjs';

export const leagueKey = league => LEAGUES[league]?.play || league;
// The kind of sport, as every Orbit app keys it.
export const familyOf = league => familyOfSport(LEAGUES[league]?.sport);
export function eventKeys(e) {
  const key = leagueKey(e.league);
  const keys = [`league:${key}`, `sport:${familyOf(e.league)}`];
  // By the English name (the catalogue's keys), whatever the page shows.
  for (const side of [e.home, e.away]) if (side?.en || side?.name) keys.push(`team:${key}:${normalizeTeamName(side.en || side.name)}`);
  return keys;
}
export const teamKey = (league, name) => `team:${leagueKey(league)}:${normalizeTeamName(name)}`;
