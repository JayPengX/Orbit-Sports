// A league's playoffs or a cup's knockout rounds as a bracket, from its
// games (each with `round`, espn.mjs knockoutRound): the games grouped into
// ties (a round, the same two sides), each tie's series wins, aggregate
// (two legs) or score, who went through, and the rounds in order, each
// tie beside the one it feeds. Rounds not drawn yet are empty places.
//
//   buildBracket(events, league) -> [{ key, title: { zh, en }, ties: [tie | null] }]
//   tie: { id, round, sides: [a, b], score: { [id]: n }, kind: 'series' | 'agg' | 'single',
//          winner: id | null, live, next: event | null, games: [event] }
//   or, a tie of sides still being decided: see pendingTies.
import { roundName } from './stage.mjs';

// The leagues whose rounds are known ahead: each round's key, names and number of ties.
const SHAPES = {
  mlb: [['RD16', '外卡賽', 'Wild Card', 4], ['QTR', '分區系列賽', 'Division Series', 4], ['SEMI', '聯盟冠軍賽', 'LCS', 2], ['FINAL', '世界大賽', 'World Series', 1]],
  nba: [['PLAYIN', '附加賽', 'Play-In', 6], ['RD16', '首輪', 'First Round', 8], ['QTR', '分區準決賽', 'Conf. Semifinals', 4], ['SEMI', '分區冠軍賽', 'Conf. Finals', 2], ['FINAL', '總冠軍賽', 'NBA Finals', 1]]
};
// A round by how many ties it has (the rounds after the last one drawn).
const BY_COUNT = { 1: ['決賽', 'Final'], 2: ['準決賽', 'Semifinals'], 4: ['八強', 'Quarterfinals'], 8: ['16 強', 'Round of 16'] };
// A round's name without the league it's in (美聯 / 國聯, 東區 / 西區): one column holds both.
const plainRound = text => roundName(text, 'zh').replace(/^(美聯|國聯|東區|西區)/, '').replace(/\s*G\d+.*$/, '');

function finish(t) {
  const games = t.games.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  // The side at home in the first game (the better seed in a series) on top.
  const first = games[0];
  t.sides = [first.home, first.away].map(s => ({ ...s, score: undefined, winner: undefined }));
  const ids = t.sides.map(s => String(s.id));
  const played = games.filter(g => g.status?.state === 'post' || g.status?.state === 'in');
  const last = [...games].reverse().find(g => g.series?.wins) || null;
  t.live = games.some(g => g.status?.state === 'in');
  t.next = games.find(g => g.status?.state === 'pre' && !g.status?.void) || null;
  if (last) {
    t.kind = 'series';
    // Wins once a game's been played (a series not begun shows none, not 0-0).
    t.score = played.length ? Object.fromEntries(ids.map(id => [id, Number(last.series.wins[id]) || 0])) : {};
    const wins = id => Number(last.series.wins[id]) || 0;
    t.winner = last.series.completed && wins(ids[0]) !== wins(ids[1]) ? (wins(ids[0]) > wins(ids[1]) ? ids[0] : ids[1]) : null;
    return t;
  }
  t.kind = games.length > 1 ? 'agg' : 'single';
  const goals = id => played.reduce((n, g) => n + Number([g.home, g.away].find(s => String(s.id) === id)?.score || 0), 0);
  t.score = played.length ? Object.fromEntries(ids.map(id => [id, goals(id)])) : {};
  const through = games.flatMap(g => g.round?.through || []).find(id => ids.includes(id));
  const done = games.every(g => g.status?.state === 'post');
  const flagged = done ? ids.find(id => games.at(-1)[String(games.at(-1).home.id) === id ? 'home' : 'away']?.winner) : null;
  t.winner = through || flagged || (done && t.score[ids[0]] !== t.score[ids[1]] ? (t.score[ids[0]] > t.score[ids[1]] ? ids[0] : ids[1]) : null);
  return t;
}

const unknown = x => /^tbd$/i.test(String(x.en || x.abbr || x.name || x.short || '').trim()) || /^tbd$/i.test(String(x.short || '').trim()) || Number(x.id) <= 0;
// A game's half of the draw (美聯 / 國聯, 東區 / 西區), '' when it has none:
// from its note ("NLDS - Game 4"), ESPN's series title being "Playoff Series".
const halfOf = e => /^(美聯|國聯|東區|西區)/.exec(roundName(e?.note || '', 'zh'))?.[1] || /^(美聯|國聯|東區|西區)/.exec(roundName(e?.round?.title || '', 'zh'))?.[1] || '';
const startOf = t => (t.games[0] || t.next)?.start || t.start || '';

// The ties of a round not drawn yet, from the ties that feed it (a league
// with its shape: MLB, the NBA, MLS…): a side through, or both sides still
// playing for the place (`options`), as soon as either is known. ESPN's own
// games for the round, where it has them, say who meets whom ("TB v
// CLE/CHW", "TBD v TBD") and when; else two feeders left in a half meet.
//   a pending tie: { pending: true, kind: 'pending', sides: [side | null, side | null], options: [[a, b] | null, …], next: event | null, games: [] }
function pendingTies(rounds, slots) {
  const halves = new Set(rounds.flatMap(r => r.ties.map(t => t.half)));
  const count = Math.max(1, [...halves].filter(Boolean).length);
  const sideIds = t => t.sides.map(s => String(s.id));
  for (let i = 1; i < rounds.length; i++) {
    const r = rounds[i];
    // Only ties of two known sides feed the next (not one still being decided).
    const prev = rounds[i - 1].ties.filter(t => !t.pending);
    if (!prev.length || r.ties.length >= r.n) continue;
    const ratio = rounds[i - 1].n / r.n;
    // A round of fewer ties than halves (the World Series, the Finals): one draw.
    const half = h => (r.n >= count ? h : '');
    const drawn = new Set(r.ties.flatMap(sideIds));
    const free = prev.filter(t => !sideIds(t).some(id => drawn.has(id)));
    const entry = t => (t.winner ? { side: t.sides.find(s => String(s.id) === t.winner) } : { options: t.sides });
    const made = [];
    for (const h of new Set([...free.map(t => half(t.half)), ...slots.filter(x => x.round === r.key).map(x => half(x.half))])) {
      const left = free.filter(t => half(t.half) === h);
      const take = t => (left.splice(left.indexOf(t), 1), entry(t));
      const ties = [];
      // The games that say the most first (a nightly copy's "TBD v TBD" can
      // sit beside the live "TB v CLE/CHW" of the same tie).
      const known = x => [x.home, x.away].filter(y => !unknown(y) || String(y.abbr || '').includes('/')).length;
      let mine = slots.filter(x => x.round === r.key && half(x.half) === h).sort((a, b) => known(b) - known(a));
      // A half with one tie in this round: its games are all that tie's, from the first.
      if (mine.length > 1 && (left.length || 1) <= ratio) {
        const first = mine.map(x => x.next).filter(Boolean).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0] || null;
        mine = [{ ...mine[0], next: first }];
      }
      for (const slot of mine) {
        const pair = [slot.home, slot.away].map(x => {
          if (!unknown(x)) {
            const fed = left.find(t => t.winner === String(x.id));
            return fed ? take(fed) : { side: x };
          }
          // "CLE/CHW": the tie between those two.
          const abbrs = String(x.abbr || '').split('/').filter(Boolean);
          const fed = abbrs.length > 1 && left.find(t => t.sides.every(s => abbrs.includes(s.abbr)));
          return fed ? take(fed) : null;
        });
        ties.push({ pair, next: slot.next });
      }
      // "TBD": the feeders left, when there's no doubt which (as many as the places).
      const holes = ties.flatMap(t => t.pair.map((x, j) => (x ? null : [t, j]))).filter(Boolean);
      if (holes.length && holes.length === left.length) holes.forEach(([t, j]) => (t.pair[j] = take(left[0])));
      // No game of the round yet: two feeders left in a half meet.
      if (!ties.length && ratio === 2 && left.length === 2) ties.push({ pair: [take(left[0]), take(left[0])], next: null });
      // The side through (or the bye) on top, the one still being decided under it.
      for (const t of ties) if (t.pair.some(Boolean)) made.push(t.pair[0]?.side || !t.pair[1]?.side ? t : { ...t, pair: [t.pair[1], t.pair[0]] });
    }
    for (const { pair, next } of made.slice(0, r.n - r.ties.length))
      r.ties.push({
        id: `${r.key}|pending|${r.ties.length}`,
        round: r.key,
        title: '',
        pending: true,
        kind: 'pending',
        sides: pair.map(x => x?.side || null),
        options: pair.map(x => x?.options || null),
        score: {},
        winner: null,
        live: false,
        next,
        games: []
      });
  }
}

export function buildBracket(events, league, { shape: given = null } = {}) {
  const ties = new Map();
  // Games of a round between sides not all known yet ("TBD", "CLE/CHW"):
  // its places, filled from the ties that feed it. One place a pairing (a
  // placeholder known by its name: ESPN's ids for it change game to game).
  const slots = new Map();
  for (const e of events || []) {
    if (!e?.round || e.kind !== 'match' || !e.home?.id || !e.away?.id || e.status?.void) continue;
    if ([e.home, e.away].some(unknown)) {
      const key = `${e.round.key}|${halfOf(e)}|${[e.home, e.away].map(x => (unknown(x) ? `?${x.abbr || ''}` : String(x.id))).sort().join('|')}`;
      const had = slots.get(key);
      const pre = e.status?.state === 'pre' ? e : null;
      if (!had) slots.set(key, { round: e.round.key, half: halfOf(e), home: e.home, away: e.away, next: pre });
      else if (pre && (!had.next || Date.parse(pre.start) < Date.parse(had.next.start))) had.next = pre;
      continue;
    }
    const key = `${e.round.key}|${[String(e.home.id), String(e.away.id)].sort().join('|')}`;
    if (!ties.has(key)) ties.set(key, { id: key, round: e.round.key, title: e.round.title, half: halfOf(e), games: [] });
    const t = ties.get(key);
    if (!t.games.some(g => g.id === e.id)) t.games.push(e);
  }
  if (!ties.size) return [];
  const all = [...ties.values()].map(finish);
  // The rounds: the league's own shape, else the order they were played in
  // and halving after the last one drawn.
  const byRound = new Map();
  for (const t of all) (byRound.get(t.round) || byRound.set(t.round, []).get(t.round)).push(t);
  const firstGame = list => Math.min(...list.map(t => Date.parse(t.games[0].start)));
  let rounds;
  const shape = given || SHAPES[league];
  if (shape && [...byRound.keys()].every(k => shape.some(r => r[0] === k))) {
    rounds = shape.map(([key, zh, en, n]) => ({ key, title: { zh, en }, n, ties: byRound.get(key) || [] }));
    pendingTies(rounds, [...slots.values()]);
  } else {
    rounds = [...byRound.entries()].sort((a, b) => firstGame(a[1]) - firstGame(b[1])).map(([key, list]) => ({ key, title: { zh: plainRound(list[0].title), en: list[0].title.replace(/\b\w/g, c => c.toUpperCase()) }, n: list.length, ties: list }));
    for (let n = Math.ceil(rounds.at(-1).n / 2); rounds.at(-1).n > 1; n = Math.ceil(n / 2)) {
      const [zh, en] = BY_COUNT[n] || [`${n * 2} 強`, `Last ${n * 2}`];
      rounds.push({ key: `next-${n}`, title: { zh, en }, n, ties: [] });
    }
  }
  // Each round's ties beside the one they feed (from the last round back),
  // the rest by when they start; empty places for ties not drawn yet.
  const sideIds = t => (t ? [...t.sides, ...(t.options || []).flat()].filter(Boolean).map(s => String(s.id)) : []);
  for (let i = rounds.length - 1; i >= 0; i--) {
    const r = rounds[i];
    const later = rounds[i + 1]?.ties || [];
    const direct = t => {
      const j = later.findIndex(x => x && sideIds(x).some(id => sideIds(t).includes(id)));
      return j < 0 ? 999 : j;
    };
    // A tie feeding none directly (the play-in's 9 v 10, whose winner plays
    // again in it): beside the tie of its round it fed.
    const feeds = t => {
      const own = direct(t);
      if (own < 999) return own;
      const near = r.ties.filter(x => x !== t && sideIds(x).some(id => sideIds(t).includes(id))).map(direct).filter(j => j < 999);
      return near.length ? Math.min(...near) + 0.5 : 999;
    };
    r.ties = [...r.ties].sort((a, b) => feeds(a) - feeds(b) || (Date.parse(startOf(a)) || 8.64e15) - (Date.parse(startOf(b)) || 8.64e15));
    while (r.ties.length < r.n) r.ties.push(null);
  }
  return rounds.map(({ key, title, ties: list }) => ({ key, title, ties: list }));
}
