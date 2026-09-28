// For you: which matches to put first, ranked by the shared engine
// (quadra.mjs's rank). The keys a match is about are the same ones Quadra
// Play and every other app use ('league:<Play key>', 'team:<Play key>:<name>',
// 'sport:<family>'), so a team bet on in Play or followed here lifts its
// games in both.
//
// A match's own quality: live now weighs most, then starting soon, a top
// league, ranked or leading sides (standings), and a followed team (the
// strongest signal, added to its affinity by following it).
import { LEAGUES, TOP_LEAGUES } from './leagues.mjs';
import { normalizeTeamName } from './espn.mjs';
import { rank } from './quadra.mjs';

export const leagueKey = league => LEAGUES[league]?.play || league;
export const familyOf = league => {
  const s = LEAGUES[league]?.sport;
  return s === 'tennis' || s === 'racket' ? 'sets' : s;
};
export function eventKeys(e) {
  const key = leagueKey(e.league);
  const keys = [`league:${key}`, `sport:${familyOf(e.league)}`];
  for (const side of [e.home, e.away]) if (side?.name) keys.push(`team:${key}:${normalizeTeamName(side.name)}`);
  return keys;
}
export const teamKey = (league, name) => `team:${leagueKey(league)}:${normalizeTeamName(name)}`;

export function rankEvents(events, { wallet, follows = [], n = 12, now = Date.now(), aff } = {}) {
  const followed = new Set(follows.map(f => teamKey(f.league, f.name)));
  const items = events
    .filter(e => !e.status.void)
    .map(e => {
      const keys = eventKeys(e);
      const hours = (Date.parse(e.start) - now) / 3_600_000;
      let quality = 0.25;
      if (e.status.state === 'in') quality += 0.4;
      else if (e.status.state === 'pre') quality += hours < 3 ? 0.25 : hours < 12 ? 0.15 : hours < 36 ? 0.08 : 0;
      else quality -= hours < -6 ? 0.2 : 0.05;
      if (TOP_LEAGUES.includes(e.league)) quality += 0.1;
      if (e.home?.rank || e.away?.rank) quality += 0.05;
      if (keys.some(k => followed.has(k))) quality += 0.3;
      return { id: `match:${e.league}:${e.id}`, event: e, keys, quality, group: e.league };
    });
  return rank(items, { wallet, n, now, diversity: 0.3, ...(aff ? { aff } : {}) });
}
