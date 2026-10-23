// Today's picks: the day's best matches for this person, as a plan to watch.
//
// Every match gets a score from what's known about it and about the person:
//
//   priority   the leagues they follow, in their order (the first counts most)
//   teams      a followed team playing (the strongest single signal)
//   chosen     in a league followed as a league (no team or player of it
//              followed), the game of its hour the person would choose
//              (leagueChoices): counts as much as a followed team's
//   quality    how good the two sides are (their places in the table)
//   closeness  how evenly matched they are (places close together)
//   stakes     a top-of-the-table meeting, a final, a play-off, a series
//   fame       a headline league, a final
//   habit      what they open, follow and bet on in every Orbit app (the
//              shared affinity map)
//   featured   the broadcaster's own pick: of a league's games at one time,
//              the one ELTA puts on a main channel with its commentators
//              (the rest on MAX's English feed)
//   now        live now, or starting soon
//
// Then a plan: the best match first, then the best one that doesn't clash
// with those already in (a match takes its sport's usual length), so the
// list is a day you can actually watch. The rest are "also today".

import { LEAGUES, TOP_LEAGUES } from './leagues.mjs';
import { eventKeys, teamKey } from './foryou.mjs';

// Minutes a match usually takes, by sport.
// A game's length in minutes. Baseball's with the pitch clock (2023 on):
// about 2 h 40, a playoff game nearer 3 h (the owner, 2026-10-16: 185 had
// ALCS G4 at 08:00 clash with an NBA game at 10:30).
export const DURATION = { soccer: 115, baseball: 170, basketball: 145, racing: 120 };
// The soonest a game can be over, in minutes: when the Worker starts asking
// for its final (asked each 2 minutes from then, told the moment it ends,
// push.js; the owner: results at once, 2026-10-22). A quick game is under
// its usual length (a 2 h 20 baseball game, a blowout), so never that.
export const SHORTEST = { soccer: 105, baseball: 110, basketball: 110, football: 160, hockey: 115 };
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

// Whether a table has a game in it. Before the season's first (a preseason,
// the new table all zeros) its order is only the feed's: no places from it.
const COUNTED = ['GP', 'W', 'L', 'D', 'T', 'OTL'];
export function tableStarted(g) {
  const rows = g?.rows || [];
  const has = rows.some(r => COUNTED.some(k => r.stats?.[k] != null && r.stats[k] !== ''));
  return !has || rows.some(r => COUNTED.some(k => Number(r.stats?.[k]) > 0));
}

// The tables a set of standings groups gives (each group ranked on its own; none before a game's played).
// `gp`: the games a side has played (how much its place says).
export function tableIndex(groups) {
  const out = {};
  for (const g of (groups || []).filter(tableStarted)) g.rows.forEach((r, i) => r.id && (out[r.id] = { pos: i + 1, n: g.rows.length, group: g.name, gp: Number(r.stats?.GP) || null }));
  return out;
}
// How much a table says yet: a few games in, places are mostly luck (Brighton
// 3rd and Chelsea 10th seven games in), so they count for a share, all of
// it from TABLE_GAMES games on. A table without games played counts whole.
const TABLE_GAMES = 15;
const tableWeight = (...rows) => {
  const gp = rows.map(r => r?.gp).filter(Number.isFinite);
  return gp.length ? Math.min(1, Math.min(...gp) / TABLE_GAMES) : 1;
};

export function scoreMatch(e, { leagues = [], follows = [], games = [], tables = {}, aff = {}, now = Date.now(), featured = null, chosen = null } = {}) {
  const reasons = [];
  let score = 0.2;
  // A match followed on its own: the person asked for this one.
  if (games.includes(`${e.league}:${e.weekend || e.id}`)) {
    score += 2;
    reasons.push('game');
  }
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
  } else if (chosen?.has(`${e.league}:${e.id}`)) {
    score += 1;
    reasons.unshift('leagueGame');
  }
  // The table: quality, closeness, a meeting at the top.
  const a = strength(tables, e.league, e.away);
  const h = strength(tables, e.league, e.home);
  if (a != null && h != null) {
    const w = tableWeight(tables[e.league][e.away.id], tables[e.league][e.home.id]);
    score += w * (0.35 * ((a + h) / 2) + 0.15 * (1 - Math.abs(a - h)));
    const ra = tables[e.league][e.away.id].pos;
    const rh = tables[e.league][e.home.id].pos;
    if (ra <= 4 && rh <= 4) {
      score += 0.25 * w;
      if (w >= 0.5) reasons.push('topClash');
    } else if (Math.abs(a - h) < 0.12 && w >= 0.5) reasons.push('close');
  }
  // How open it is, by the bookmakers' prices (e.fav: the favourite's
  // chance): a game either side can win before one side's walkover, however
  // high it stands (Brentford +140 v Liverpool over Man City -425 v Ipswich).
  // A soccer game is open from about 40% (the draw takes its share), a game
  // with no draw from about 50%.
  if (Number.isFinite(e.fav) && e.fav > 0) {
    const [even, sure] = LEAGUES[e.league]?.sport === 'soccer' ? [0.4, 0.8] : [0.5, 0.85];
    const open = Math.min(1, Math.max(0, (sure - e.fav) / (sure - even)));
    score += 0.3 * open;
    if (open >= 0.75 && !reasons.includes('close') && !reasons.includes('topClash')) reasons.push('close');
  }
  // The broadcaster's pick of the games then (its main channel, its commentators).
  // Only a near tie's decider (the owner, 2026-10-16: 愛爾達1台 isn't
  // always the better game; Man City v Ipswich there, Brentford v Liverpool
  // on 2台).
  if (featured?.(e)) {
    score += 0.1;
    reasons.push('featured');
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

// Leagues followed as a league: no team or player of them followed. Jay
// (2026-10-23) watches a league as ELTA airs it and picks a game, not a
// team; such a league's chosen games count as a followed team's do. A league
// with a team or player of it followed goes by those instead.
export function watchedLeagues(leagues = [], follows = []) {
  const own = new Set(follows.map(f => f.league));
  return leagues.filter(k => !own.has(k));
}
// The games a person who watches these leagues would choose: of each
// league's games starting within the hour of one another (one slot: a
// Saturday's 22:00 Premier League games), one on TV here, the best matchup
// as the picks rank it before the start (so the choice holds once the games
// are on; ELTA's main-channel pick only a near tie's decider, as there:
// 愛爾達1台 isn't always the better game). A slot none of
// whose games is on TV here has no choice, unless TV isn't known for it yet.
// Returns a Set of 'league:id'.
const SLOT = 3_600_000;
export function leagueChoices(events, { watched = [], onTv = () => true, tvKnown = () => true, ctx = {} } = {}) {
  const out = new Set();
  const w = new Set(watched);
  const byLeague = new Map();
  const seen = new Set();
  for (const e of events || []) {
    const key = `${e.league}:${e.id}`;
    if (!w.has(e.league) || e.kind !== 'match' || e.status?.void || e.other || e.abroad || seen.has(key) || !Number.isFinite(Date.parse(e.start))) continue;
    seen.add(key);
    if (!byLeague.has(e.league)) byLeague.set(e.league, []);
    byLeague.get(e.league).push(e);
  }
  const sctx = { ...ctx, games: [], chosen: null };
  const before = e => ({ ...e, status: { ...e.status, state: 'pre' } });
  const choose = slot => {
    let pool = slot.filter(onTv);
    if (!pool.length) pool = slot.some(tvKnown) ? [] : slot;
    const best = pool
      .map(e => ({ e, score: scoreMatch(before(e), sctx).score }))
      .sort((x, y) => y.score - x.score || String(x.e.id).localeCompare(String(y.e.id)))[0];
    if (best) out.add(`${best.e.league}:${best.e.id}`);
  };
  for (const list of byLeague.values()) {
    list.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    let slot = [];
    for (const e of list) {
      if (slot.length && Date.parse(e.start) - Date.parse(slot[0].start) >= SLOT) (choose(slot), (slot = []));
      slot.push(e);
    }
    if (slot.length) choose(slot);
  }
  return out;
}

// A live game, by sport: when it's late (the period), a close one (the
// gap) and a rout.
const GAME = { soccer: { late: 2, tight: 1, rout: 3 }, baseball: { late: 7, tight: 2, rout: 6 }, basketball: { late: 4, tight: 6, rout: 20 } };

// A race weekend's session by its own length (qualifying an hour, not a race's two).
export const SESSION_MINUTES = { FP1: 60, FP2: 60, FP3: 60, Qual: 60, SS: 45, SQ: 45, SR: 35, Race: 120 };
const minutes = e => SESSION_MINUTES[e.sessionKey] || DURATION[LEAGUES[e.league]?.sport] || 150;
const window = e => {
  const start = Date.parse(e.start);
  return [start, start + minutes(e) * 60_000];
};
// Two matches of one sport clash when more than half an hour (or half the shorter one) overlaps.
// Two sports clash only when they start within half an hour of each other: a
// World Series game at 08:00 and an NBA one at 09:30 are both picks, his to
// choose between on the night (the owner, 2026-10-21).
// A game whose hour isn't set yet (timeTbd) clashes with nothing: its place in the day is a guess.
const sportOf = e => LEAGUES[e.league]?.sport || e.league;
export function clash(x, y) {
  if (x.timeTbd || y.timeTbd) return false;
  const [a1, a2] = window(x);
  const [b1, b2] = window(y);
  if (sportOf(x) !== sportOf(y)) return Math.abs(a1 - b1) < 30 * 60_000;
  const overlap = Math.min(a2, b2) - Math.max(a1, b1);
  return overlap > Math.min(30 * 60_000, (Math.min(a2 - a1, b2 - b1) / 2));
}

// events: the day's (any league); returns { plan: [...by start], also: [...by score] },
// each { event, score, reasons }. asStood: the day ranked as it stood before
// any of it was played, each game as it is now: an ended one and a postponed
// one too (a pick called off stays among the picks that ended, never gone).
export function dayPlan(events, ctx = {}, { n = 6, also = 6, asStood = false } = {}) {
  const now = ctx.now ?? Date.now();
  const seen = new Set();
  const before = e => ({ ...e, status: { ...e.status, state: 'pre', void: false } });
  const scored = events
    .filter(e => (asStood || (!e.status?.void && e.status?.state !== 'post')) && !seen.has(`${e.league}:${e.id}`) && seen.add(`${e.league}:${e.id}`))
    // A live one only while it still has time to go.
    .filter(e => asStood || e.status?.state !== 'in' || window(e)[1] > now - 30 * 60_000)
    .map(e => ({ event: e, ...scoreMatch(asStood ? before(e) : e, ctx) }))
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
