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
//   stakes     a top-of-the-table meeting, a final, a play-off, a series;
//              in a season's last games, what each side still plays for (a
//              title, a play-off place, a seed), and a side with nothing
//              left to play for (its place settled) counts against it
//   stars      the players people here turn a game on for (Messi's Miami)
//   fame       a headline league, a final
//   theirs     what they open and pass over among the picks, and open
//              anywhere in the app, learnt as they go (the kit's feedback.mjs:
//              a weight per team, league and sport, kept on the Pass): a
//              league they never open sinks under the ones they do, however
//              it's followed; a club they keep opening rises
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
import { standingsRace, SEASON_GAMES, COUNTS } from './title.mjs';
import * as dayoff from '#kit/dayoff.mjs';

// Minutes a match usually takes, by sport.
// A game's length in minutes. Baseball's with the pitch clock (2023 on):
// about 2 h 40, a playoff game nearer 3 h (the owner, 2026-10-16: 185 had
// ALCS G4 at 08:00 clash with an NBA game at 10:30).
export const DURATION = { soccer: 115, baseball: 170, basketball: 145, racing: 120 };
// The soonest a game can be over, in minutes: when the Worker starts asking
// for its final (asked each 2 minutes from then, told the moment it ends,
// push.js; the owner: results at once, 2026-10-22). A quick game is under
// its usual length (a 2 h 20 baseball game, a blowout), so never that.
export const SHORTEST = { soccer: 105, baseball: 110, basketball: 110 };
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
// `league`: with it, each side's stake in a season's last games (raceOf).
export function tableIndex(groups, league = null) {
  const out = {};
  for (const g of (groups || []).filter(tableStarted)) {
    const race = league ? raceOf(g, league) : null;
    g.rows.forEach((r, i) => r.id && (out[r.id] = { pos: i + 1, n: g.rows.length, group: g.name, gp: Number(r.stats?.GP) || null, ...race?.[r.id] }));
  }
  return out;
}
// What a side still plays for in its season's last games (LATE: the last
// eighth, three games at least): `stake` 1 when the places it can still end
// in cross a line of the table (the title, a play-off place, a wild card,
// Europe, the drop), 0.5 when they're seeds of one play-off zone (MLS's 2nd
// to 4th: who's at home in round one), 0 for none; `idle` when nothing's
// left to play for (its place settled, or only places with no line between
// them), a side that may rest its best (Jay 2026-11-04: Nashville, first
// whatever happens, v Cincinnati was picked over Messi's Miami, both sides
// still playing for their seeds, on Decision Day). Earlier in a season: none.
const LATE = total => Math.max(3, Math.floor(total / 8));
const SEEDED = /play-?off|play-?in|wild ?card|round one|季後/i;
function raceOf(g, league) {
  const sport = LEAGUES[league]?.sport;
  const rows = g.rows || [];
  const total = SEASON_GAMES[league] || (sport === 'soccer' && rows.length > 3 ? 2 * (rows.length - 1) : null);
  if (!total || !['soccer', 'baseball', 'basketball'].includes(sport)) return null;
  const race = standingsRace(g, sport, { total });
  if (!race) return null;
  const n = (r, k) => Number(r.stats?.[k]) || 0;
  const played = r => (sport === 'soccer' ? n(r, 'GP') : n(r, 'W') + n(r, 'L') + n(r, 'T'));
  const notes = rows.map(r => String(r.note || ''));
  const out = {};
  race.rows.forEach((x, i) => {
    if (!x.id || total - played(rows[i]) > LATE(total)) return;
    const can = notes.slice(x.best - 1, x.worst);
    const line = x.best === 1 || new Set(can).size > 1;
    const stake = x.settled ? 0 : line ? 1 : SEEDED.test(can[0]) ? 0.5 : 0;
    out[x.id] = { stake, idle: stake === 0 };
  });
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

export function scoreMatch(e, { leagues = [], follows = [], games = [], tables = {}, now = Date.now(), featured = null, chosen = null, personal = null, why = null } = {}) {
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
  // A season's last games: what each side still plays for (raceOf).
  let idle = 0;
  if (!bigGame(e) && COUNTS(e)) {
    const rows = [tables?.[e.league]?.[e.away?.id], tables?.[e.league]?.[e.home?.id]].filter(r => r?.stake != null);
    idle = rows.filter(r => r.idle).length;
    score += 0.2 * rows.reduce((s, r) => s + r.stake, 0) - 0.15 * idle;
    if (rows.some(r => r.stake === 1)) reasons.push('stakes');
  }
  // How open it is, by the bookmakers' prices (e.fav: the favourite's
  // chance): a game either side can win before one side's walkover, however
  // high it stands (Brentford +140 v Liverpool over Man City -425 v Ipswich).
  // A soccer game is open from about 40% (the draw takes its share), a game
  // with no draw from about 50%.
  if (Number.isFinite(e.fav) && e.fav > 0) {
    const [even, sure] = LEAGUES[e.league]?.sport === 'soccer' ? [0.4, 0.8] : [0.5, 0.85];
    // (Even odds against a side with nothing to play for say it may rest
    // its best, not that it's a contest: half.)
    const open = Math.min(1, Math.max(0, (sure - e.fav) / (sure - even))) * (idle ? 0.5 : 1);
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
    if (!reasons.includes('stakes')) reasons.push('stakes');
  }
  // Fame.
  if (TOP_LEAGUES.includes(e.league)) score += 0.12;
  score += 0.1 * [e.home, e.away].filter(x => bigClub(e.league, x)).length;
  const star = [e.home, e.away].reduce((s, x) => s + starOf(e.league, x), 0);
  if (star) {
    score += star;
    if (star >= 0.3) reasons.push('star');
  }
  if (e.stage?.key === 'final') score += 0.25;
  // Theirs: what the person opens and passes over (log-odds, about -2 to
  // +2 once known), and a 常看 only where their own opens say so strongly.
  const item = { id: `${e.league}:${e.id}`, keys };
  if (personal) score += PERSONAL * personal(item);
  if (why?.(item) && !reasons.includes('team')) reasons.push('habit');
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
    // working day's hours isn't (a holiday or a typhoon day off where the
    // person works is a day off: the kit's dayOffAt; an older kit, Mon–Fri).
    const tw = new Date(Date.parse(e.start) + 8 * 3_600_000);
    const hr = tw.getUTCHours();
    const weekday = dayoff.dayOffAt ? !dayoff.dayOffAt(Date.parse(e.start), dayoff.myPlace?.('work'), 'work') : tw.getUTCDay() > 0 && tw.getUTCDay() < 6;
    if (hr >= 18 && hr <= 23) score += 0.08;
    else if (weekday && hr >= 9 && hr < 17) score -= 0.06;
  }
  if (TOP_LEAGUES.includes(e.league) && !reasons.length) reasons.push('top');
  return { score: Math.round(score * 1000) / 1000, reasons };
}

// How much the person's own doing counts against the rest (a weight of +2,
// a club opened far more than the usual pick, is about a followed team's +1).
export const PERSONAL = 1;
// A 常看: a team opened far more than the usual pick, over enough looks to
// be sure (a few lucky opens aren't a habit). Never a league or a sport:
// those the person follows by name (我的聯賽), and one followed game, its page
// opened again and again, isn't its league (the owner, 2026-11-01: every MLS
// game came up as 常看).
export const HABIT = { min: 1, evidence: k => (k.startsWith('team:') ? 1.5 : Infinity) };

// The clubs people here tune in for, whatever the table says this week (the
// table is luck seven games in; Jay 2026-10-23 had Liverpool v Brighton as
// the 22:00 game, over Man United v Bournemouth on 愛爾達2台).
const BIG = {
  soccer: /^(manchester city|man city|arsenal|liverpool|chelsea|manchester united|man united|tottenham( hotspur)?|real madrid|barcelona|bayern munich|bayern|borussia dortmund|dortmund|paris saint-germain|psg|juventus|internazionale|inter milan|inter|ac milan|milan|napoli|celtic|rangers)$/i,
  basketball: /^(los angeles lakers|lakers|golden state warriors|warriors|boston celtics|celtics)$/i,
  baseball: /^(los angeles dodgers|dodgers|new york yankees|yankees)$/i
};
// The players people here turn a game on for, by the club they play for
// (as of 2026-11: a star who moves, or stops, is moved here; checked on the
// club's ESPN roster). Messi above all: the one MLS game a Taiwan fan
// looks for is Miami's (Jay 2026-11-04: Miami v Charlotte over Cincinnati v
// Nashville). Beyond a big club's 0.1, a side.
const STARS = [
  { league: 'mls', club: /^inter miami( cf)?$/i, who: 'Messi', w: 0.45 },
  { league: 'mls', club: /^chicago fire( fc)?$/i, who: 'Lewandowski', w: 0.2 },
  { league: 'mls', club: /^(lafc|los angeles fc)$/i, who: 'Son Heung-min', w: 0.2 }
];
export const starOf = (league, side) => (side ? STARS.find(s => s.league === league && s.club.test(String(side.en || side.name || '').trim()))?.w || 0 : 0);
export const bigClub = (league, side) => Boolean(side && BIG[LEAGUES[league]?.sport]?.test(String(side.en || side.name || '').trim()));

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
// are on): the table, the odds, the stakes, the clubs. Not the channel (only
// an even tie's decider: 愛爾達1台 isn't always the better game) nor habit
// (the person picks the game, not a team). A slot none of
// whose games is on TV here has no choice, unless TV isn't known for it yet.
// `awake`: the hours a choice can be (Jay 2026-10-23: a 03:00 game is never
// his, it's among 更多賽事).
// `kept` ({ get(key), set(key, chosen) }): the choice as it stood before the slot began. Each
// slot's choice is kept for its games while none has started, and once one has, the kept one
// is the choice (one begun with none kept: its first choice, kept): the table moves with the results and a game's odds go with its end, so a
// choice worked out again after it named another game (Jay 2026-11-10: 11/7's 23:00 was
// 富勒姆 v 紐卡索 before it, 兵工廠 v 赫爾城 after).
// Returns a Set of 'league:id'.
const SLOT = 3_600_000;
export function leagueChoices(events, { watched = [], onTv = () => true, tvKnown = () => true, awake = () => true, ctx = {}, kept = null } = {}) {
  const out = new Set();
  const w = new Set(watched);
  const byLeague = new Map();
  const seen = new Set();
  for (const e of events || []) {
    const key = `${e.league}:${e.id}`;
    if (!w.has(e.league) || !awake(e) || e.kind !== 'match' || e.status?.void || e.other || e.abroad || seen.has(key) || !Number.isFinite(Date.parse(e.start))) continue;
    seen.add(key);
    if (!byLeague.has(e.league)) byLeague.set(e.league, []);
    byLeague.get(e.league).push(e);
  }
  const sctx = { ...ctx, games: [], chosen: null, featured: null, why: null, personal: null };
  const featured = ctx.featured || (() => false);
  const before = e => ({ ...e, status: { ...e.status, state: 'pre' } });
  const keyOf = e => `${e.league}:${e.id}`;
  const choose = slot => {
    const begun = slot.some(e => e.status?.state && e.status.state !== 'pre');
    if (begun && kept) {
      const had = slot.map(e => kept.get(keyOf(e))).find(k => k && slot.some(e => keyOf(e) === k));
      if (had) return void out.add(had);
    }
    let pool = slot.filter(onTv);
    if (!pool.length) pool = slot.some(tvKnown) ? [] : slot;
    const best = pool
      .map(e => ({ e, score: scoreMatch(before(e), sctx).score, main: featured(e) ? 1 : 0 }))
      .sort((x, y) => y.score - x.score || y.main - x.main || String(x.e.id).localeCompare(String(y.e.id)))[0];
    if (best) out.add(keyOf(best.e));
    // (Begun with none kept, a slot before this was kept: its first choice with the league's table in
    // is kept, so 首頁 and 賽事 name the same game from then on, whatever loads after.)
    const table = ctx.tables?.[slot[0].league];
    if (best && kept && (!begun || (table && Object.keys(table).length))) for (const e of slot) kept.set(keyOf(e), keyOf(best.e));
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
// What a game is worth on its own, across sports, for filling the free hours
// (填滿空檔): not the person's leagues or teams, but what the game means. How
// much its league is watched here (PRESTIGE: the Champions League, the
// Premier League, the NBA, MLB, and CPBL at home over a mid-table French
// game), what's at stake (a final, a play-off, a series, a derby), how good
// and how even the sides are (the table where it's known, the bookmakers'
// prices), the clubs people tune in for, when it's on in Taiwan, and how
// it's going if it's on. What the person opens still counts (their own
// taste across sports), a little.
export const PRESTIGE = { ucl: 0.5, epl: 0.45, nba: 0.45, mlb: 0.4, f1: 0.4, cpbl: 0.35, bundesliga: 0.3, seriea: 0.3, ligue1: 0.22, uel: 0.25, facup: 0.25, nationsleague: 0.2, mls: 0.12, uecl: 0.12, scotland: 0.08 };
// Filling takes every free hour: the best game there is in it, however
// small (Jay 2026-11-03: "when I mean fill it should literally fill it").
export const FILL_MIN = -Infinity;
export function worth(e, ctx = {}) {
  const { score, reasons } = scoreMatch(e, { ...ctx, leagues: [], follows: [], games: [], chosen: null, featured: null, why: null });
  let s = score + (PRESTIGE[e.league] ?? 0.1);
  // A final or a decider means more than a mere play-off game.
  if (bigGame(e)) s += 0.3;
  // An F1 race over its practice.
  if (e.sessionKey && e.sessionKey !== 'Race') s -= e.sessionKey === 'Qual' || e.sessionKey === 'SR' ? 0.15 : 0.5;
  return { score: Math.round(s * 1000) / 1000, reasons: reasons.filter(r => r !== 'top') };
}

// keep: the games the person follows (a team, a player, a game): always in
// the plan, first; the others fill only the hours they leave free (one game
// a slot: you can't watch two at once, Jay 2026-11-03).
// only: the games that may be in the plan at all (theirs: 我的比賽 is their
// own games, Jay 2026-11-03, "it's filling in my schedule"); the rest are
// "also". fill: with 填滿空檔 on, a scorer of what any game is worth on its
// own (worth()): every free hour left is filled from the rest, the game that
// means most first, past the cap of n.
export function dayPlan(events, ctx = {}, { n = 6, also = 6, asStood = false, keep = null, only = null, fill = null } = {}) {
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
  const kept = keep ? scored.filter(x => keep(x.event)) : [];
  plan.push(...kept);
  for (const item of scored) {
    if (kept.includes(item)) continue;
    if ((!only || only(item.event)) && plan.length < n && !plan.some(p => clash(p.event, item.event))) plan.push(item);
    else rest.push(item);
  }
  if (fill) {
    const extra = rest
      .filter(x => !only?.(x.event))
      .map(x => ({ ...x, ...fill(asStood ? before(x.event) : x.event), filled: true }))
      .filter(x => x.score >= FILL_MIN)
      .sort((x, y) => y.score - x.score);
    for (const item of extra) {
      if (plan.some(p => clash(p.event, item.event))) continue;
      plan.push(item);
      rest.splice(rest.findIndex(x => x.event === item.event), 1);
    }
  }
  plan.sort((x, y) => Date.parse(x.event.start) - Date.parse(y.event.start));
  return { plan, also: rest.slice(0, also) };
}
