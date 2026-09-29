// Today's picks: the day's best matches for this person, as a plan to watch.
//
// Every match gets a score from what's known about it and about the person:
//
//   priority   the sports they follow, in their order (the first counts most),
//              and the leagues they follow
//   teams      a followed team playing (the strongest single signal)
//   quality    how good the two sides are (their places in the table)
//   closeness  how evenly matched they are (places close together)
//   stakes     a top-of-the-table meeting, a final, a play-off, a series
//   fame       a headline league, national TV, ranked college sides
//   habit      what they open, follow and bet on in every Quadra app (the
//              shared affinity map)
//   now        live now, or starting soon
//
// Then a plan: the best match first, then the best one that doesn't clash
// with those already in (a match takes its sport's usual length), so the
// list is a day you can actually watch. The rest are "also today".

import { LEAGUES, TOP_LEAGUES } from './leagues.mjs';
import { eventKeys, teamKey } from './foryou.mjs';
import { broadcastsOf } from './broadcast.mjs';

// Minutes a match usually takes, by sport.
export const DURATION = { soccer: 115, baseball: 185, basketball: 145, football: 195, hockey: 155, tennis: 120, badminton: 60, tabletennis: 40, volleyball: 110, snooker: 180, racing: 120, golf: 300, mma: 240, rugby: 110, aussie: 140 };
// On a Taiwan channel or streaming service (lib/broadcast.mjs), not a league pass only.
const onTaiwanTv = league => broadcastsOf(league).some(b => b.kind !== 'pass');
const BIG_GAME = /final|semi|play-?off|postseason|wild ?card|series|championship|derby|決賽|季後/i;

// A side's strength, 0 (last) to 1 (first), from the league's tables.
// tables: { [league]: { [teamId]: { pos, n } } }
export function strength(tables, league, side) {
  const row = tables?.[league]?.[side?.id];
  if (!row || row.n < 2) return null;
  return 1 - (row.pos - 1) / (row.n - 1);
}

// The tables a set of standings groups gives (each group ranked on its own).
export function tableIndex(groups) {
  const out = {};
  for (const g of groups || []) g.rows.forEach((r, i) => r.id && (out[r.id] = { pos: i + 1, n: g.rows.length }));
  return out;
}

export function scoreMatch(e, { sports = [], leagues = [], follows = [], tables = {}, aff = {}, now = Date.now() } = {}) {
  const reasons = [];
  let score = 0.2;
  const sport = LEAGUES[e.league]?.sport;
  const idx = sports.indexOf(sport);
  if (idx >= 0) {
    score += 0.55 * (1 - idx / Math.max(3, sports.length));
    if (idx === 0) reasons.push('priority');
  }
  // A league you follow counts nearly as much as your first sport: it's
  // what you asked to see (a league of a followed sport you didn't pick
  // only gets the sport's part).
  if (leagues.includes(e.league)) {
    score += 0.6;
    if (!reasons.length) reasons.push('league');
  }
  const followed = new Set(follows.map(f => teamKey(f.league, f.name)));
  const keys = eventKeys(e);
  if (keys.some(k => followed.has(k)) || follows.some(f => f.league === e.league && (f.id === e.home?.id || f.id === e.away?.id))) {
    score += 1;
    reasons.unshift('team');
  }
  // The table: quality, closeness, a meeting at the top.
  const a = strength(tables, e.league, e.away);
  const h = strength(tables, e.league, e.home);
  if (a != null && h != null) {
    score += 0.35 * ((a + h) / 2) + 0.15 * (1 - Math.abs(a - h));
    const ra = tables[e.league][e.away.id].pos;
    const rh = tables[e.league][e.home.id].pos;
    if (ra <= 4 && rh <= 4) {
      score += 0.25;
      reasons.push('topClash');
    } else if (Math.abs(a - h) < 0.12) reasons.push('close');
  }
  if (['post', 'final', 'playin'].includes(e.stage?.key) || BIG_GAME.test(`${e.note || ''} ${e.name || ''}`)) {
    score += 0.3;
    reasons.push('stakes');
  }
  // Fame.
  if (TOP_LEAGUES.includes(e.league)) score += 0.12;
  if (e.stage?.key === 'final') score += 0.25;
  if (onTaiwanTv(e.league)) {
    score += 0.08;
    reasons.push('tv');
  }
  if (e.home?.rank || e.away?.rank) score += 0.08;
  // Kambi's badminton, table tennis, volleyball and snooker lists are mostly
  // minor events (juniors, lower tours): below the rest unless the person follows them.
  if (LEAGUES[e.league]?.kambi && ['badminton', 'tabletennis', 'volleyball', 'snooker'].includes(sport) && idx < 0 && !leagues.includes(e.league)) score -= 0.35;
  // Habit: the strongest thing the person is into that this match touches.
  const max = Math.max(1, ...Object.values(aff));
  const habit = Math.max(0, ...keys.map(k => (aff[k] || 0) / max));
  score += 0.4 * habit;
  if (habit > 0.35 && !reasons.includes('team')) reasons.push('habit');
  // Now.
  if (e.status?.state === 'in') {
    score += 0.2;
    reasons.unshift('live');
  } else {
    const hours = (Date.parse(e.start) - now) / 3_600_000;
    if (hours >= 0 && hours < 2) score += 0.08;
  }
  if (TOP_LEAGUES.includes(e.league) && !reasons.length) reasons.push('top');
  return { score: Math.round(score * 1000) / 1000, reasons };
}

const minutes = e => DURATION[LEAGUES[e.league]?.sport] || 150;
const window = e => {
  const start = Date.parse(e.start);
  return [start, start + minutes(e) * 60_000];
};
// Two matches clash when more than half an hour (or half the shorter one) overlaps.
export function clash(x, y) {
  const [a1, a2] = window(x);
  const [b1, b2] = window(y);
  const overlap = Math.min(a2, b2) - Math.max(a1, b1);
  return overlap > Math.min(30 * 60_000, (Math.min(a2 - a1, b2 - b1) / 2));
}

// events: the day's (any league); returns { plan: [...by start], also: [...by score] },
// each { event, score, reasons }.
export function dayPlan(events, ctx = {}, { n = 6, also = 6 } = {}) {
  const now = ctx.now ?? Date.now();
  const seen = new Set();
  const scored = events
    .filter(e => !e.status?.void && e.status?.state !== 'post' && !seen.has(`${e.league}:${e.id}`) && seen.add(`${e.league}:${e.id}`))
    // A live one only while it still has time to go.
    .filter(e => e.status?.state !== 'in' || window(e)[1] > now - 30 * 60_000)
    .map(e => ({ event: e, ...scoreMatch(e, ctx) }))
    .sort((x, y) => y.score - x.score);
  const plan = [];
  const rest = [];
  for (const item of scored) {
    if (plan.length < n && !plan.some(p => clash(p.event, item.event))) plan.push(item);
    else rest.push(item);
  }
  plan.sort((x, y) => Date.parse(x.event.start) - Date.parse(y.event.start));
  return { plan, also: rest.slice(0, also) };
}
