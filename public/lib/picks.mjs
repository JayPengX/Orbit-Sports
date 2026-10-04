// Today's picks: the day's best matches for this person, as a plan to watch.
//
// Every match gets a score from what's known about it and about the person:
//
//   priority   the leagues they follow, in their order (the first counts most)
//   teams      a followed team playing (the strongest single signal)
//   quality    how good the two sides are (their places in the table)
//   closeness  how evenly matched they are (places close together)
//   stakes     a top-of-the-table meeting, a final, a play-off, a series
//   fame       a headline league, a final
//   habit      what they open, follow and bet on in every Quadra app (the
//              shared affinity map)
//   now        live now, or starting soon
//
// Then a plan: the best match first, then the best one that doesn't clash
// with those already in (a match takes its sport's usual length), so the
// list is a day you can actually watch. The rest are "also today".

import { LEAGUES, TOP_LEAGUES } from './leagues.mjs';
import { eventKeys, teamKey } from './foryou.mjs';

// Minutes a match usually takes, by sport.
export const DURATION = { soccer: 115, baseball: 185, basketball: 145, racing: 120 };
const BIG_GAME = /final|semi|play-?off|postseason|wild ?card|series|championship|derby|決賽|季後/i;
// A final, a play-off, a postseason or series game: worth staying up for.
export const bigGame = e => ['post', 'final', 'playin'].includes(e?.stage?.key) || BIG_GAME.test(`${e?.note || ''} ${e?.name || ''}`);

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
  for (const g of groups || []) g.rows.forEach((r, i) => r.id && (out[r.id] = { pos: i + 1, n: g.rows.length, group: g.name }));
  return out;
}

export function scoreMatch(e, { leagues = [], follows = [], tables = {}, aff = {}, now = Date.now() } = {}) {
  const reasons = [];
  let score = 0.2;
  const idx = leagues.indexOf(e.league);
  if (idx >= 0) {
    score += 0.6 + 0.55 * (1 - idx / Math.max(3, leagues.length));
    reasons.push(idx === 0 ? 'priority' : 'league');
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
  if (bigGame(e)) {
    score += 0.3;
    reasons.push('stakes');
  }
  // Fame.
  if (TOP_LEAGUES.includes(e.league)) score += 0.12;
  if (e.stage?.key === 'final') score += 0.25;
  // Habit: the strongest thing the person is into that this match touches.
  const max = Math.max(1, ...Object.values(aff));
  const habit = Math.max(0, ...keys.map(k => (aff[k] || 0) / max));
  score += 0.4 * habit;
  if (habit > 0.35 && !reasons.includes('team')) reasons.push('habit');
  // Now.
  if (e.status?.state === 'in') {
    score += 0.2;
    // How it's going: a close game late on is the one to switch to; a rout
    // isn't worth turning on.
    const sport = LEAGUES[e.league]?.sport;
    const [hs, as] = [Number(e.home?.score), Number(e.away?.score)];
    if (GAME[sport] && Number.isFinite(hs) && Number.isFinite(as) && e.home.score !== '' && e.away.score !== '') {
      const { late, tight, rout } = GAME[sport];
      const gap = Math.abs(hs - as);
      const isLate = (e.status.period || 0) >= late;
      if (gap <= tight && isLate) {
        score += 0.3;
        reasons.unshift('tight');
      } else if (gap >= rout) score -= isLate ? 0.35 : 0.15;
    }
    reasons.unshift('live');
  } else {
    const hours = (Date.parse(e.start) - now) / 3_600_000;
    if (hours >= 0 && hours < 2) score += 0.08;
    // When it's on in Taiwan: an evening game is easy to watch, one in a
    // weekday's working hours isn't.
    const tw = new Date(Date.parse(e.start) + 8 * 3_600_000);
    const hr = tw.getUTCHours();
    const weekday = tw.getUTCDay() > 0 && tw.getUTCDay() < 6;
    if (hr >= 18 && hr <= 23) score += 0.08;
    else if (weekday && hr >= 9 && hr < 17) score -= 0.06;
  }
  if (TOP_LEAGUES.includes(e.league) && !reasons.length) reasons.push('top');
  return { score: Math.round(score * 1000) / 1000, reasons };
}

// A live game, by sport: when it's late (the period), a close one (the
// gap) and a rout.
const GAME = { soccer: { late: 2, tight: 1, rout: 3 }, baseball: { late: 7, tight: 2, rout: 6 }, basketball: { late: 4, tight: 6, rout: 20 } };

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
