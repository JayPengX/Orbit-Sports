// A league's playoffs or a cup's knockout rounds as a bracket, from its
// games (each with `round`, espn.mjs knockoutRound): the games grouped into
// ties (a round, the same two sides), each tie's series wins, aggregate
// (two legs) or score, who went through, and the rounds in order, each
// tie beside the one it feeds. Rounds not drawn yet are empty places.
//
//   buildBracket(events, league) -> [{ key, title: { zh, en }, ties: [tie | null] }]
//   tie: { id, round, sides: [a, b], score: { [id]: n }, kind: 'series' | 'agg' | 'single',
//          winner: id | null, live, next: event | null, games: [event] }
import { roundName } from './stage.mjs';

// The leagues whose rounds are known ahead: each round's key, names and number of ties.
const SHAPES = {
  mlb: [['RD16', '外卡賽', 'Wild Card', 4], ['QTR', '分區系列賽', 'Division Series', 4], ['SEMI', '聯盟冠軍賽', 'LCS', 2], ['FINAL', '世界大賽', 'World Series', 1]],
  nba: [['RD16', '首輪', 'First Round', 8], ['QTR', '分區準決賽', 'Conf. Semifinals', 4], ['SEMI', '分區冠軍賽', 'Conf. Finals', 2], ['FINAL', '總冠軍賽', 'NBA Finals', 1]]
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

export function buildBracket(events, league) {
  const ties = new Map();
  for (const e of events || []) {
    if (!e?.round || e.kind !== 'match' || !e.home?.id || !e.away?.id || e.status?.void) continue;
    // ESPN's games between sides not known yet ("TBD"): the place stays empty.
    if ([e.home, e.away].some(x => /^tbd$/i.test(String(x.en || x.abbr || x.name || x.short || '').trim()) || /^tbd$/i.test(String(x.short || '').trim()) || Number(x.id) <= 0)) continue;
    const key = `${e.round.key}|${[String(e.home.id), String(e.away.id)].sort().join('|')}`;
    if (!ties.has(key)) ties.set(key, { id: key, round: e.round.key, title: e.round.title, games: [] });
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
  const shape = SHAPES[league];
  if (shape && [...byRound.keys()].every(k => shape.some(r => r[0] === k))) {
    rounds = shape.map(([key, zh, en, n]) => ({ key, title: { zh, en }, n, ties: byRound.get(key) || [] }));
  } else {
    rounds = [...byRound.entries()].sort((a, b) => firstGame(a[1]) - firstGame(b[1])).map(([key, list]) => ({ key, title: { zh: plainRound(list[0].title), en: list[0].title.replace(/\b\w/g, c => c.toUpperCase()) }, n: list.length, ties: list }));
    for (let n = Math.ceil(rounds.at(-1).n / 2); rounds.at(-1).n > 1; n = Math.ceil(n / 2)) {
      const [zh, en] = BY_COUNT[n] || [`${n * 2} 強`, `Last ${n * 2}`];
      rounds.push({ key: `next-${n}`, title: { zh, en }, n, ties: [] });
    }
  }
  // Each round's ties beside the one they feed (from the last round back),
  // the rest by when they start; empty places for ties not drawn yet.
  const sideIds = t => (t ? t.sides.map(s => String(s.id)) : []);
  for (let i = rounds.length - 1; i >= 0; i--) {
    const r = rounds[i];
    const later = rounds[i + 1]?.ties || [];
    const feeds = t => {
      const j = later.findIndex(x => x && sideIds(x).some(id => sideIds(t).includes(id)));
      return j < 0 ? 999 : j;
    };
    r.ties = [...r.ties].sort((a, b) => feeds(a) - feeds(b) || Date.parse(a.games[0].start) - Date.parse(b.games[0].start));
    while (r.ties.length < r.n) r.ties.push(null);
  }
  return rounds.map(({ key, title, ties: list }) => ({ key, title, ties: list }));
}
