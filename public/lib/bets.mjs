// The games a person's open Quadra Play slips are on (the wallet's snap:
// each leg { g, p, o, s, sp, k, r }), found among a day's events, so 首頁
// shows them as the picks they are.
//
// A leg bet before the game has Play's id for it (`g`, espn.mjs
// playGameId). One bet in play has none (`g` 'live'): it's the game of
// Play's league (`sp`, LEAGUES' `play`) starting at the leg's `s`, the
// picked name telling two such games apart.
import { LEAGUES } from './leagues.mjs';
import { playGameId, normalizeTeamName } from './espn.mjs';

const MINUTE = 60_000;
const squash = text => normalizeTeamName(String(text || '')).replace(/\s/g, '');
const sideNames = side => [side?.name, side?.en, side?.short, side?.zh, side?.abbr].filter(Boolean).map(squash);

// The leagues a set of legs is in (for reading their games).
export const legLeagues = legs => Object.keys(LEAGUES).filter(k => LEAGUES[k].kind === 'match' && legs.some(b => b.sp && LEAGUES[k].play === b.sp));

// The event a leg is on, or null.
export function legEvent(leg, events) {
  const byId = leg.g && leg.g !== 'live' ? events.find(e => e.kind === 'match' && playGameId(e) === leg.g) : null;
  if (byId) return byId;
  const at = Date.parse(leg.s);
  if (!leg.sp || !Number.isFinite(at)) return null;
  const same = events.filter(e => e.kind === 'match' && LEAGUES[e.league]?.play === leg.sp && Math.abs(Date.parse(e.start) - at) <= MINUTE);
  if (same.length <= 1) return same[0] ?? null;
  const pick = squash(leg.p);
  return same.find(e => [...sideNames(e.home), ...sideNames(e.away)].some(n => n && (pick.includes(n) || n.includes(pick)))) ?? same[0];
}

// Legs grouped by the event they're on: Map(event → legs), and the legs
// whose game isn't among the events.
export function betsByEvent(legs, events) {
  const found = new Map();
  const missing = [];
  for (const leg of legs) {
    const e = legEvent(leg, events);
    if (e) (found.get(e) || found.set(e, []).get(e)).push(leg);
    else missing.push(leg);
  }
  return { found, missing };
}
