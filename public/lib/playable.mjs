// Whether Quadra Play sells a game now, so 投注 shows only where Play has it:
// the same prices Play's board is made of (Play's lib/sources.mjs), read the
// same way.
//
//   ESPN-priced leagues   the game's DraftKings line on ESPN's scoreboard
//                         (`priced`, set by parseScoreboard), within the days
//                         Play's board reaches
//   Kambi-priced leagues  the game (the two sides, near its start) with a
//                         winner price in Kambi's list for the league
//
// A league's Kambi list is read once a row asks (cached a few minutes), and
// the page is told to draw again when it comes in (`onPlayableChange`).
import { CATALOG } from './catalog.mjs';
import { proxyJson } from './quadra.mjs';

const KAMBI = 'https://eu-offering-api.kambicdn.com/offering/v2018/ub';
const DAY = 86_400_000;

// Ids of ESPN games seen with a DraftKings line (a team's schedule doesn't
// carry the line; the day's scoreboard does).
export const pricedIds = new Set();

// How far ahead Play's board reaches for a league (MLB 8 days, soccer three
// weeks, the NFL's week, the rest a week).
export function horizon(key) {
  const l = CATALOG[key];
  if (key === 'mlb') return 8 * DAY;
  if (l?.sport === 'soccer') return 21 * DAY;
  return 7.5 * DAY;
}

const norm = s =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' ')
    .replace(/\b(fc|afc|cf|sc|and|the)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
// The same side under two spellings: equal, one inside the other, or a
// shared long word ("Rakuten Monkeys" / "Rakuten", "J. Sinner" / "Jannik Sinner").
export function sameSide(a, b) {
  const [x, y] = [norm(a), norm(b)];
  if (!x || !y) return false;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  const words = new Set(x.split(' ').filter(w => w.length >= 4));
  return y.split(' ').some(w => w.length >= 4 && words.has(w));
}

// Kambi's priced games of a league: [{ start, home, away, live }].
export function parseKambiPriced(data) {
  const out = [];
  for (const item of data?.events || []) {
    const e = item.event;
    if (!e?.homeName || !e?.awayName) continue;
    const win = (item.betOffers || []).some(o => o.betOfferType?.englishName === 'Match' || /match odds|moneyline/i.test(o.criterion?.englishLabel || ''));
    if (!win && e.state !== 'STARTED') continue;
    out.push({ start: Date.parse(e.start), home: e.homeName, away: e.awayName, live: e.state === 'STARTED' });
  }
  return out;
}
const lists = new Map();
let changed = () => {};
export const onPlayableChange = fn => (changed = fn);
function kambiList(key) {
  const slot = lists.get(key);
  if (slot && (slot.loading || Date.now() - slot.at < 5 * 60_000)) return slot.games;
  const next = { games: slot?.games || null, at: slot?.at || 0, loading: true };
  lists.set(key, next);
  const parts = CATALOG[key].kambi.split('/');
  while (parts.length < 4) parts.push('all');
  proxyJson(`${KAMBI}/listView/${parts.join('/')}/matches.json?lang=en_GB&market=GB&useCombined=true`, { ttl: 60_000, trim: 'kambi-events' })
    .then(data => (next.games = parseKambiPriced(data)))
    .catch(() => (next.games = next.games || []))
    .finally(() => {
      next.loading = false;
      next.at = Date.now();
      changed();
    });
  return next.games;
}
// A pair of sides in a league's Kambi list, near `start` (either order).
function inKambi(key, start, a, b) {
  const games = kambiList(key);
  if (!games) return false;
  const t = Date.parse(start);
  return games.some(g => Math.abs(g.start - t) < 12 * 3_600_000 && ((sameSide(g.home, a) && sameSide(g.away, b)) || (sameSide(g.home, b) && sameSide(g.away, a))));
}

// A two-sided game (a match, a bout, a draw's match): whether Play has it.
export function playablePair(key, start, a, b, state = 'pre', id = null, priced = undefined, now = Date.now()) {
  const l = CATALOG[key];
  if (!l?.bet || !start || !a || !b) return false;
  const t = Date.parse(start);
  if (state === 'pre' && (t - now > horizon(key) || t < now - 5 * 60_000)) return false;
  if (l.odds === 'kambi') return inKambi(key, start, a, b);
  // ESPN's line: on the event, else seen on a scoreboard. A game on now keeps
  // its link (Play's live board has it, or says why not).
  if (state === 'in') return true;
  return priced ?? (id != null && pricedIds.has(String(id)));
}
export function playable(e, now = Date.now()) {
  if (!e || e.other || e.kind !== 'match' || e.status?.void) return false;
  const a = e.away?.en || e.away?.name;
  const b = e.home?.en || e.home?.name;
  return playablePair(e.league, e.start, a, b, e.status?.state, e.id, e.priced, now);
}
// A league board in Play (a fight card, a tennis draw): any priced match in it.
export function leagueOnSale(key) {
  const l = CATALOG[key];
  if (!l?.bet) return false;
  if (l.odds !== 'kambi') return true;
  const games = kambiList(key);
  return Boolean(games?.length);
}
