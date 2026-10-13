// Who starts a game, before it starts (the owner, 2026-10-11: an NBA side's
// five is announced half an hour before tip-off, and Orbit Sports didn't
// say it). Each league from where it's said first:
//   - the NBA, WNBA and NHL: ESPN's own competitor rosters (the core API),
//     where each starter is marked as the team announces it (none marked
//     until then); names and faces from the team's roster;
//   - MLB: MLB's own schedule, each side's probable pitcher days ahead and
//     its batting order once the manager posts it (hours before).
// Pure parsing here; the reads in espn.mjs (pregameLineups).
import { personKey } from './mlb.mjs';


// The leagues whose starters ESPN marks before a game, and how far ahead
// it's worth asking (an NBA five comes 30 minutes before, an NHL goalie
// in the morning skate's hours).
export const CORE_LINEUPS = { nba: 2 * 3_600_000, wnba: 2 * 3_600_000, nhl: 6 * 3_600_000 };
export const coreRosterUrl = (espnPath, eventId, teamId) => {
  const [sport, league] = String(espnPath).split('/');
  return `https://sports.core.api.espn.com/v2/sports/${sport}/leagues/${league}/events/${eventId}/competitions/${eventId}/competitors/${teamId}/roster?lang=en&region=us`;
};
// One side's starters from its competitor roster: [{ id, jersey, name }] (ESPN's surname), or [].
export function coreStarters(data) {
  return (data?.entries || []).filter(x => x?.starter && !x.didNotPlay).map(x => ({ id: String(x.playerId ?? ''), jersey: String(x.jersey ?? ''), name: x.displayName || '' }));
}
// The starters with their roster's full names, faces and positions (roster: parseRoster's groups or list).
export function withRoster(starters, roster) {
  const people = (Array.isArray(roster) ? roster : []).flatMap(g => (Array.isArray(g?.players) ? g.players : [g])).filter(Boolean);
  return starters.map(s => {
    const p = people.find(x => String(x.id) === s.id);
    return p ? { ...s, name: p.name || s.name, headshot: p.headshot || null, pos: p.pos || '', jersey: s.jersey || p.jersey || '' } : s;
  });
}

// MLB: a day's games with lineups and probable pitchers.
export const mlbLineupsUrl = date => `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=lineups,probablePitcher`;
const plain = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
// (No MLB picture: MLB's own is a big cropped headshot; the kit finds the same face the box score shows, by name.)
const mlbPerson = p => (p?.id ? { id: '', mlb: String(p.id), name: p.fullName || '', headshot: null, pos: p.primaryPosition?.abbreviation || '' } : null);
// MLB's people as ESPN's, by name (MLB names no ESPN id): each one's id
// and face from the team's ESPN roster, so the row opens the player's page.
export function byRosterName(people, roster) {
  const espn = new Map((Array.isArray(roster) ? roster : []).flatMap(g => (Array.isArray(g?.players) ? g.players : [g])).filter(Boolean).map(x => [personKey(x.name), x]));
  return people.map(p => {
    const x = p && espn.get(personKey(p.name));
    return x ? { ...p, id: String(x.id || ''), headshot: x.headshot || p.headshot, pos: p.pos || x.pos || '' } : p;
  });
}
// The game of an event (each side's English name): { pitchers: { away, home }, order: { away: [...], home: [...] } }, or null.
export function mlbLineups(data, e) {
  const home = plain(e?.home?.en || e?.home?.name);
  const away = plain(e?.away?.en || e?.away?.name);
  const g = (data?.dates || []).flatMap(d => d.games || []).find(x => plain(x.teams?.home?.team?.name) === home && plain(x.teams?.away?.team?.name) === away);
  if (!g) return null;
  return {
    pitchers: { away: mlbPerson(g.teams.away.probablePitcher), home: mlbPerson(g.teams.home.probablePitcher) },
    order: { away: (g.lineups?.awayPlayers || []).map(mlbPerson).filter(Boolean), home: (g.lineups?.homePlayers || []).map(mlbPerson).filter(Boolean) }
  };
}
