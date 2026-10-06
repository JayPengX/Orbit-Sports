// A game's win probability from Polymarket's market on it, where ESPN draws
// none (soccer, MLB while it's on, CPBL): its moneyline's price, every two
// minutes from the start. The app reads it for a game on now; a finished
// game's is read once by Shared-Data (winprob.mjs there) and kept there for
// good. No imports: Shared-Data loads this file alone.
//
//   polymarketLine(league, { start, home, away }, getJson)   (English names)
//     → { source: 'polymarket', points: [{ t, home, draw? }] } | null
//
// getJson(url, { trim, kind }) reads through the data proxy; kind ('game',
// 'history') says how long its answer can be kept.

export const GAMMA = 'https://gamma-api.polymarket.com';
export const CLOB = 'https://clob.polymarket.com/prices-history';
export const GAMES_TRIM = 'polymarket-games';
// Each league's Polymarket series (its games' list).
export const PM_LEAGUE = { mlb: 3, nba: 10345, cpbl: 11972, epl: 10188, seriea: 10203, bundesliga: 10194, ligue1: 10195, ucl: 10204, uel: 10209, scotland: 10674, mls: 10189, facup: 10314, nationsleague: 11446 };

// Names compared plainly (accents, "FC" and the like aside).
const plain = s =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(fc|afc|cf|sc|ac|sk|club|calcio)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
// Words too common to tell two sides apart.
const COMMON = new Set(['united', 'city', 'real', 'sporting', 'athletic', 'new', 'saint', 'san', 'the', 'and', 'de', 'del', 'la']);
const words = s => plain(s).split(' ').filter(w => w.length >= 3 && !COMMON.has(w));
// How alike two names are: the same, one inside the other, words in common
// ("Hamburg SV" and "Hamburger SV", "Red Bull New York" and "New York Red Bulls").
export function nameScore(a, b) {
  const [x, y] = [plain(a), plain(b)];
  if (!x || !y) return 0;
  if (x === y) return 10;
  if (x.includes(y) || y.includes(x)) return 6;
  let n = 0;
  for (const w of words(a)) for (const v of words(b)) if (w === v || (w.length >= 5 && v.length >= 5 && (w.startsWith(v) || v.startsWith(w)))) n += 2;
  return n;
}
// Which of two labels is the home side's: the one more like it than like the away side.
const homeFirst = (x, y, home, away) => nameScore(home, x) - nameScore(away, x) >= nameScore(home, y) - nameScore(away, y);

const json = s => {
  try {
    return typeof s === 'string' ? JSON.parse(s) : s || [];
  } catch {
    return [];
  }
};

// The game's market: the league's games at its kickoff (a few at most), the
// one most like it by the sides' names (one side's is enough: "FC Cologne"
// is Polymarket's "1. FC Köln"), and the token whose price is each outcome's
// chance: { slug, home, away } or { slug, home, draw, away }.
export async function findMarket(league, { start, home, away }, getJson) {
  const series = PM_LEAGUE[league];
  const at = Date.parse(start);
  if (!series || !at) return null;
  const iso = ms => new Date(Math.floor(ms / 60_000) * 60_000).toISOString().replace('.000Z', 'Z');
  const events = (await getJson(`${GAMMA}/events?series_id=${series}&start_time_min=${iso(at - 15 * 60_000)}&start_time_max=${iso(at + 15 * 60_000)}&limit=100`, { trim: GAMES_TRIM, kind: 'game' })) || [];
  const labels = ev => [...(ev.teams || []).flatMap(t => [t.name, t.alias]), ...(ev.markets || []).flatMap(m => [...json(m.outcomes), m.groupItemTitle])].filter(Boolean);
  const fit = ev => Math.max(0, ...labels(ev).map(l => nameScore(home, l))) + Math.max(0, ...labels(ev).map(l => nameScore(away, l)));
  const event = events
    .filter(ev => ev.markets?.length)
    .map(ev => [ev, fit(ev)])
    .sort((x, y) => y[1] - x[1])
    .find(([, f]) => f > 0)?.[0];
  const markets = event?.markets || [];
  if (markets.length === 1) {
    // Two ways: one market, each side an outcome.
    const [o0, o1] = json(markets[0].outcomes);
    const tokens = json(markets[0].clobTokenIds);
    if (!o0 || !o1 || tokens.length !== 2) return null;
    return homeFirst(o0, o1, home, away) ? { slug: event.slug, home: tokens[0], away: tokens[1] } : { slug: event.slug, home: tokens[1], away: tokens[0] };
  }
  // Three ways (soccer): a yes-or-no market each for either side's win and the draw.
  const yes = m => json(m?.clobTokenIds)[0];
  const draw = markets.find(m => /^draw\b/i.test(m.groupItemTitle || ''));
  const [m0, m1] = markets.filter(m => m !== draw);
  if (!draw || !m0 || !m1) return null;
  const [h, a] = homeFirst(m0.groupItemTitle, m1.groupItemTitle, home, away) ? [m0, m1] : [m1, m0];
  return { slug: event.slug, home: yes(h), draw: yes(draw), away: yes(a) };
}

// One token's price, every 2 minutes for the 6 hours from the start (a game,
// even one in extra innings; never a market left open for days after it).
const LONGEST = 6 * 3600;
export const historyUrl = (token, start) => {
  const from = Math.floor(Date.parse(start) / 60_000) * 60;
  return `${CLOB}?market=${token}&startTs=${from}&endTs=${from + LONGEST}&fidelity=2`;
};

// The prices as one line of points; after the market has settled (a side at
// 99%+ to the end), only the first such point.
export function mergeHistories(series) {
  const keys = Object.keys(series).filter(k => series[k]?.length);
  if (!keys.includes('home')) return [];
  const times = [...new Set(keys.flatMap(k => series[k].map(p => p.t)))].sort((x, y) => x - y);
  const idx = Object.fromEntries(keys.map(k => [k, 0]));
  const last = {};
  const points = [];
  for (const t of times) {
    for (const k of keys) {
      const s = series[k];
      while (idx[k] < s.length && s[idx[k]].t <= t) last[k] = s[idx[k]++].p;
    }
    // From the first moment every outcome has a price.
    if (keys.some(k => last[k] == null)) continue;
    if ('draw' in series) {
      const [hh, dd, aa] = [last.home ?? 0, last.draw ?? 0, last.away ?? Math.max(0, 1 - (last.home ?? 0) - (last.draw ?? 0))];
      const sum = hh + dd + aa || 1;
      points.push({ t, home: hh / sum, draw: dd / sum });
    } else points.push({ t, home: last.home });
  }
  const settled = p => p.home >= 0.99 || p.home <= 0.01 || (p.draw ?? 0) >= 0.99;
  let end = points.length;
  while (end > 1 && settled(points[end - 1]) && settled(points[end - 2])) end--;
  return points.slice(0, end).map(p => ({ t: p.t, home: Math.round(p.home * 1000) / 1000, ...(p.draw != null ? { draw: Math.round(p.draw * 1000) / 1000 } : {}) }));
}

// A finished game's line is kept for good in Shared-Data (winprob.mjs there),
// at winprob/<league>/<gameKey>.json: { source, points } or { none } (ESPN
// draws its own, or Polymarket had no market). ESPN's games by their id;
// CPBL's (whose ids change with the source) by the day and the home side.
export const PM_PACK = 'winprob';
export const gameKey = (league, { id, start, home }) => (league === 'cpbl' ? `${new Date(start).toISOString().slice(0, 10)}-${plain(home?.en || home?.name).split(' ').at(-1)}` : String(id));
export const packPath = (league, game) => `${PM_PACK}/${league}/${gameKey(league, game)}.json`;

export async function polymarketLine(league, game, getJson) {
  const market = await findMarket(league, game, getJson);
  if (!market) return null;
  // Two ways: the home side's price is the line (the away side's is its rest).
  const read = 'draw' in market ? ['home', 'draw', 'away'] : ['home'];
  const got = await Promise.all(read.map(k => getJson(historyUrl(market[k], game.start), { kind: 'history' }).then(x => (x?.history || []).map(p => ({ t: p.t, p: Number(p.p) })).filter(p => Number.isFinite(p.p)))));
  const series = Object.fromEntries(read.map((k, i) => [k, got[i]]));
  if ('draw' in market) series.draw ||= [];
  const points = mergeHistories(series);
  return points.length > 3 ? { source: 'polymarket', market: market.slug, points } : null;
}
