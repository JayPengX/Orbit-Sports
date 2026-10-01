// The events a person's Quadra Play bets are on (the wallet's snap: open
// slips in `slips`, those settled lately in `done`, each leg
// { g, p, o, s, sp, k, r, fk, tm }), found among a day's events, so 首頁
// shows them as the picks they are.
//
// Every kind of bet:
//   a game's markets      Play's id for it (`g`, espn.mjs playGameId); one bet
//                         in play has none (`g` 'live'): the game of Play's
//                         league (`sp`, LEAGUES' `play`) starting at `s`
//   F1 (winner, places, head to head, team, pole, safety car, flags)
//                         the session starting at `s` (qualifying for pole)
//   a tournament's match, a fight card's bout
//                         the tournament or card running at `s`
//   a championship (k 'future': market `fk`, team or driver `tm`)
//                         no game of its own: the games where its fate is on
//                         the line (titleStakes): in a play-off the games that
//                         decide whether the team goes through (or wins it);
//                         in a points race (a football league, F1) the one
//                         that could put it out of contention or settle it.
import { LEAGUES } from './leagues.mjs';
import { playGameId } from './espn.mjs';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
// A name to compare: letters and digits in any script (Chinese kept), no
// accents, spaces or punctuation.
const squash = text =>
  String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
const sideNames = side => [side?.name, side?.en, side?.short, side?.zh, side?.abbr].filter(Boolean).map(squash);
const playOf = e => LEAGUES[e.league]?.play;
const isTitle = leg => leg.k === 'future';

// Every leg of the snap: [{ ...leg, slip }] (a settled slip's `st` on it).
export function betLegs(snap) {
  return [...(snap?.slips || []), ...(snap?.done || [])].flatMap(slip => (slip.l || []).map(leg => ({ ...leg, slip })));
}

// The leagues a set of legs is in (for reading their events).
export const legLeagues = legs => Object.keys(LEAGUES).filter(k => legs.some(b => b.sp && LEAGUES[k].play === b.sp));

// Two names for the same side ("洛杉磯道奇" / "Los Angeles Dodgers" / "Dodgers").
export function sameName(a, b) {
  const x = squash(a);
  const y = squash(b);
  if (x.length < 3 || y.length < 3) return x === y && x !== '';
  return x === y || x.includes(y) || y.includes(x);
}

// The event a (non-championship) leg is on, or null.
export function legEvent(leg, events) {
  if (isTitle(leg)) return null;
  const byId = leg.g && leg.g !== 'live' ? events.find(e => e.kind === 'match' && playGameId(e) === leg.g) : null;
  if (byId) return byId;
  const at = Date.parse(leg.s);
  if (!leg.sp || !Number.isFinite(at)) return null;
  const mine = events.filter(e => playOf(e) === leg.sp);
  const gap = e => Math.abs(Date.parse(e.start) - at);
  // A game (or an F1 session) at that time.
  const same = mine.filter(e => gap(e) <= MINUTE);
  // Two games at that hour: the picked name decides (never a guess).
  if (same.length > 1) return same.find(e => [e.home, e.away].some(x => sideNames(x).some(n => sameName(n, leg.p) || squash(leg.p).includes(n)))) ?? null;
  if (same.length) return same[0];
  // A race or a fight card a little off Play's time: the nearest session.
  const near = mine.filter(e => e.kind !== 'match' && gap(e) <= 3 * HOUR).sort((a, b) => gap(a) - gap(b))[0];
  if (near) return near;
  // A tournament's match, a card's bout: the event running then.
  return mine.find(e => e.kind !== 'match' && Date.parse(e.start) <= at && at <= (e.end ? Date.parse(e.end) + 24 * HOUR : Date.parse(e.start) + 12 * HOUR)) ?? null;
}

// ---- Championships -----------------------------------------------------------------
//
// What each market is: a play-off (the games that decide whether the team
// goes through), a knockout cup (the ties' deciding games), or a points race
// (a league table, F1's standings).
export const TITLE_MARKETS = {
  ws: { type: 'playoff', title: /world series/i },
  // A pennant is won in its championship series: the World Series is past it.
  al: { type: 'playoff', title: /\bALCS\b|american league championship/i, past: /world series/i },
  nl: { type: 'playoff', title: /\bNLCS\b|national league championship/i, past: /world series/i },
  nba: { type: 'playoff', title: /\bnba finals\b/i },
  wnba: { type: 'playoff', title: /\bwnba finals\b/i },
  nhl: { type: 'playoff', title: /stanley cup final/i },
  nfl: { type: 'playoff', title: /super bowl/i },
  ncaaf: { type: 'playoff', title: /national championship/i },
  mls: { type: 'playoff', title: /mls cup final|^mls cup$/i },
  ucl: { type: 'knockout', title: /^final$/i },
  uel: { type: 'knockout', title: /^final$/i },
  epl: { type: 'table' },
  laliga: { type: 'table' },
  seriea: { type: 'table' },
  bundesliga: { type: 'table' },
  ligue1: { type: 'table' },
  f1drivers: { type: 'f1', who: 'drivers' },
  f1constructors: { type: 'f1', who: 'constructors' }
};

// A play-off game for one side: what it could settle for that team.
// Known from the schedule before a ball is thrown: in a series of n games
// (ESPN's totalCompetitions) the first to `need` wins goes through, so game
// k can decide it when someone can have `need` wins by then (in a best of
// five, game 3 on); as games are played it narrows (a game that can't
// decide anything any more is dropped). The next game is exact: 'advance'
// (a win goes through), 'out' (a loss goes out), 'decider' (both); a later
// one 'decides' (it may). In the round that wins the championship (the
// market's title round) any of these is 'title'. A one-game knockout is
// 'decider' (or 'title'). Null: not a play-off game, or nothing hangs on it.
export function seriesStakes(e, side, market) {
  const us = e[side];
  const them = e[side === 'home' ? 'away' : 'home'];
  const note = `${e.note || ''} ${e.name || ''}`;
  const playoff = ['post', 'final', 'playin'].includes(e.stage?.key) || Boolean(e.series);
  if (!playoff || !us || market?.past?.test(note)) return null;
  const titleRound = market?.title ? market.title.test(note) : e.stage?.key === 'final';
  const gameNo = Number(/\bgame (\d+)/i.exec(note)?.[1]) || null;
  // Next round's games come before their series does (an opponent still
  // to be decided): its length from the round's name, nothing won yet.
  const s = e.series?.games >= 2 ? e.series : gameNo ? { games: roundLength(note), wins: {} } : null;
  if (!s) return titleRound ? 'title' : 'decider';
  if (!s.games) return null;
  const need = Math.floor(s.games / 2) + 1;
  let a = s.wins?.[us.id] ?? 0;
  let b = s.wins?.[them?.id] ?? 0;
  // A game played: the series as it stood before it.
  if (e.status?.state === 'post') {
    if (us.winner) a--;
    else if (them?.winner) b--;
  }
  if (a < 0 || b < 0 || a >= need || b >= need) return null;
  const played = a + b;
  const k = gameNo || played + 1;
  if (k <= played || k > s.games || k - played < need - Math.max(a, b)) return null;
  if (titleRound) return 'title';
  if (k > played + 1) return 'decides';
  return a === need - 1 ? (b === need - 1 ? 'decider' : 'advance') : 'out';
}

// A series' length by its round's name (MLB's wild card, division and
// championship series and World Series; the leagues' Finals and the
// Stanley Cup), or 0 when the name doesn't say.
export function roundLength(note) {
  if (/\bWC\b|wild ?card/i.test(note)) return 3;
  if (/\b[AN]LDS\b|division series/i.test(note)) return 5;
  if (/\b[AN]LCS\b|championship series|world series|finals?\b|stanley cup|conference|first round|second round|semifinal/i.test(note)) return 7;
  return 0;
}

// A knockout cup's game: the second leg or a one-off tie decides; the final wins it.
export function knockoutStakes(e, market) {
  const note = `${e.note || ''} ${e.stage?.round?.en || ''}`;
  if ([e.note, e.stage?.round?.en].some(x => x && market?.title?.test(x.trim()))) return 'title';
  if (/1st leg|first leg/i.test(note)) return null;
  return e.stage?.key === 'post' || /round of|quarter|semi|final|play-?off|knockout/i.test(note) ? 'decider' : null;
}

// A points race: `me` and the others as { pts, after } (points now, the most
// still to be won after this round), `round` the most this round gives.
// 'title' when winning this round could settle it, 'out' when the worst
// here (nothing for us, the most for a rival) puts it out of reach; null
// otherwise (or already out).
export function pointsStakes(me, others, round) {
  if (!me || !others.length) return null;
  const top = Math.max(...others.map(o => o.pts));
  if (me.pts + round + me.after < top) return null;
  if (others.every(o => me.pts + round > o.pts + o.after)) return 'title';
  if (me.pts + me.after < Math.max(...others.map(o => o.pts + round))) return 'out';
  return null;
}

// A football league's table as { id, pts, gp } rows (the standings' P and
// GP) and a match: what it means for `side` (each plays 2·(n−1) games).
export function tableStakes(e, side, rows) {
  const us = e[side];
  if (!us || !rows?.length) return null;
  const games = 2 * (rows.length - 1);
  const played = { ...Object.fromEntries(rows.map(r => [r.id, { ...r }])) };
  // A match played: the table as it stood before it.
  if (e.status?.state === 'post') {
    const them = e[side === 'home' ? 'away' : 'home'];
    const sa = Number(us.score);
    const sb = Number(them?.score);
    for (const [s, o, x] of [[us, them, sa - sb], [them, us, sb - sa]]) {
      const r = played[s?.id];
      if (!r || !Number.isFinite(x)) continue;
      r.pts -= x > 0 ? 3 : x === 0 ? 1 : 0;
      r.gp -= 1;
    }
  }
  const me = played[us.id];
  if (!me) return null;
  const left = r => Math.max(0, games - r.gp);
  return pointsStakes({ pts: me.pts, after: 3 * Math.max(0, left(me) - 1) }, Object.values(played).filter(r => r.id !== us.id).map(r => ({ pts: r.pts, after: 3 * Math.max(0, left(r) - 1) })), 3);
}

// F1: a race, the standings ({ name, pts } rows of drivers or constructors)
// and the weekends still to run from this one ([{ sprint }], this first).
// The most a weekend gives: a driver 25 (+8 with a sprint), a team 43 (+15).
export function f1Stakes(name, rows, weekends, who = 'drivers') {
  if (!rows?.length || !weekends?.length) return null;
  const most = w => (who === 'drivers' ? 25 + (w.sprint ? 8 : 0) : 43 + (w.sprint ? 15 : 0));
  const round = most(weekends[0]);
  const after = weekends.slice(1).reduce((sum, w) => sum + most(w), 0);
  const me = rows.find(r => sameName(r.name, name) || sameName(r.en, name) || sameName(String(r.en || '').split(' ').at(-1), String(name).split(' ').at(-1)));
  if (!me) return null;
  return pointsStakes({ pts: me.pts, after }, rows.filter(r => r !== me).map(r => ({ pts: r.pts, after })), round);
}

// A playoff bracket's side from a round's or a standings group's name:
// MLB's AL / NL, the NFL's AFC / NFC, a conference's East / West; '' when
// it doesn't say (a final, a league with one bracket).
export function bracketOf(text = '') {
  if (/\bAL(WC|DS|CS)\b|american league/i.test(text)) return 'AL';
  if (/\bNL(WC|DS|CS)\b|national league/i.test(text)) return 'NL';
  if (/\bAFC\b|american football/i.test(text)) return 'AFC';
  if (/\bNFC\b|national football/i.test(text)) return 'NFC';
  if (/\beast(ern)?\b/i.test(text)) return 'E';
  if (/\bwest(ern)?\b/i.test(text)) return 'W';
  return '';
}
// A slot still to be filled (ESPN's negative ids: "TBD", or the teams that
// could fill it, "Phillies/Braves").
export const placeholder = side => !side || String(side.id ?? '').startsWith('-') || /^tbd$/i.test(side.en || side.name || '');
// Could the pick's team fill that slot? One naming its candidates only if
// the team is one of them; a plain TBD if it's on the team's side.
function couldFill(side, leg, note, sides) {
  const names = String(side?.en || side?.name || '').split('/').map(x => x.trim()).filter(Boolean);
  if (names.length > 1 || (names.length === 1 && !/^tbd$/i.test(names[0]))) return names.some(n => [leg.tm, leg.p].some(x => x && sameName(n, x)));
  const round = bracketOf(note);
  const mine = (sides || []).find(r => [r.name, r.en, r.short].some(n => n && [leg.tm, leg.p].some(x => x && sameName(n, x))))?.side;
  return !round || !mine || round === mine;
}

// Which side of a game a championship pick's team is (or null).
export function titleSide(leg, e) {
  for (const side of ['home', 'away']) if (e[side] && [leg.tm, leg.p].some(n => n && sideNames(e[side]).some(x => sameName(x, n)))) return side;
  return null;
}

// What an event means for a championship pick: { stake, maybe } or null.
// stake: 'title', 'advance', 'out', 'decider', 'decides'; maybe: a game of a
// round the team hasn't reached yet (a slot still to be filled), counted as
// if it gets there. `data`: { tables: { [league]: rows }, sides: { [league]:
// [{ name, en, short, side }] }, out: { ['fk:team']: true } (knocked out),
// f1: { drivers, constructors, weekends: { [weekendId]: [{ sprint }…] } } }.
export function titleStake(leg, e, data = {}) {
  const market = TITLE_MARKETS[leg.fk];
  if (!market || playOf(e) !== leg.sp) return null;
  const one = stake => (stake ? { stake, maybe: false } : null);
  if (market.type === 'f1') {
    if (e.kind !== 'field' || e.sessionKey !== 'Race' || e.status?.state === 'post') return null;
    return one(f1Stakes(leg.tm || leg.p, data.f1?.[market.who], data.f1?.weekends?.[e.weekend], market.who));
  }
  if (e.kind !== 'match') return null;
  const side = titleSide(leg, e);
  if (side) {
    if (market.type === 'playoff') return one(seriesStakes(e, side, market));
    if (market.type === 'knockout') return one(knockoutStakes(e, market));
    return one(tableStakes(e, side, data.tables?.[e.league]));
  }
  // A later round's game, its slot still open: if the team could get there.
  if (market.type !== 'playoff' || e.status?.state !== 'pre' || data.out?.[`${leg.fk}:${leg.tm || leg.p}`]) return null;
  const note = `${e.note || ''} ${e.name || ''}`;
  const slot = ['home', 'away'].find(x => placeholder(e[x]) && couldFill(e[x], leg, note, data.sides?.[e.league]));
  if (!slot) return null;
  const stake = seriesStakes({ ...e, series: e.series?.games >= 2 ? { ...e.series, wins: {} } : undefined }, slot, market);
  return stake ? { stake, maybe: true } : null;
}
export const titleStakes = (leg, e, data = {}) => titleStake(leg, e, data)?.stake ?? null;

// The day's bets, by game: Map(event → legs, a championship one with its
// `stake`), and the legs whose event isn't among the events. One game read
// twice (a followed league's and a bet's own read) is one entry, holding
// every bet on it (a game's pick and a championship's alike).
export function betsByEvent(legs, events, data = {}) {
  const byKey = new Map();
  const found = new Map();
  const missing = [];
  const key = e => `${e.league}:${e.id}`;
  const add = (e, leg) => {
    const k = key(e);
    if (!byKey.has(k)) byKey.set(k, e);
    const one = byKey.get(k);
    const list = found.get(one) || found.set(one, []).get(one);
    if (!list.some(x => x.slip?.id === leg.slip?.id && x.g === leg.g && x.p === leg.p && x.k === leg.k)) list.push(leg);
  };
  const unique = [...new Map(events.map(e => [key(e), e])).values()];
  for (const leg of legs) {
    // A bet that's settled says no more about what's to come: a
    // championship one nothing at all; a slip only the games already played.
    const settled = Boolean(leg.slip?.st) || (leg.slip?.m === 'parlay' && (leg.slip.l || []).some(x => x.r === 'lost'));
    if (isTitle(leg)) {
      if (settled || leg.r) continue;
      for (const e of unique) {
        const hit = titleStake(leg, e, data);
        if (hit) add(e, { ...leg, ...hit });
      }
      continue;
    }
    const e = legEvent(leg, unique);
    if (e && settled && e.status?.state === 'pre') continue;
    if (e) add(e, leg);
    else if (!settled) missing.push(leg);
  }
  return { found, missing };
}
