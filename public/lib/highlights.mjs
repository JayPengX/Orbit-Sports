// A finished game's highlights on YouTube: the official video itself, found
// by YouTube's search (read through the proxy, trimmed to each video's id,
// title, channel, age and length), else the search.
//
// Official, in order: the league's own channel; either side's own (a club's,
// a federation's: verified, named like the side); an English rights holder's.
// Only those whose game videos play in Taiwan (checked 2026-10 on each
// video's list of countries: the proxy can't, YouTube asks a Worker to sign
// in): the leagues' and the clubs' play everywhere; the NBA's own play in 24
// countries, not Taiwan (緯來 has the rights there, in Chinese), so an NBA
// game's are the English full-game channels' that play everywhere; the US
// rights holders' (CBS Sports Golazo and its Europe channel, NBC Sports,
// beIN SPORTS USA, ESPN FC's) play only there and aren't taken.
import { LEAGUES } from './leagues.mjs';

export const YT = 'https://www.youtube.com';
export const LEAGUE_CHANNELS = {
  mlb: ['UCoLrcjPV5PbUrUyXq5mjc_A'],
  epl: ['UCG5qGWdu8nIRZqJ_GgDwQ-w'],
  seriea: ['UCBJeMCIeLQos7wacox4hmLQ'],
  bundesliga: ['UC6UL29enLNe4mqwTfAyeNuw'],
  ligue1: ['UCQsH5XtIc9hONE1BQjucM0g'],
  scotland: ['UCakRszbIjjGYtFrDPeg5Ieg'],
  facup: ['UCChcWqwYXCEs657MQ00qVWA'],
  ucl: ['UCyGa1YEx9ST66rYrJTGIKOw'],
  uel: ['UCyGa1YEx9ST66rYrJTGIKOw'],
  uecl: ['UCyGa1YEx9ST66rYrJTGIKOw'],
  nationsleague: ['UCyGa1YEx9ST66rYrJTGIKOw'],
  mls: ['UCSZbXT5TLLW_i-5W8FZpFsg'],
  f1: ['UCB_qr75-ydFVKSF9Dmo6izg'],
  // CPBL's own, then 緯來's (its rights holder): both in Chinese, the only ones there are.
  cpbl: ['UCDt9GAqyRzc2e5BNxPrwZrw', 'UC3P83RUWwKbZ4bkhNti4ZuQ']
};
// English rights holders' channels whose game videos play in Taiwan:
// Sportsnet (MLB), Premier Sports (Scottish football).
const BROADCASTERS = new Set(['UCVhibwHk4WKw4leUt6JfRLg', 'UCTj2CVogkBMbPejYWPh9GmA']);
// An NBA game in English, playable in Taiwan: FreeDawkins, Ximo Pierto, GAMETIME HIGHLIGHTS.
const NBA_ENGLISH = ['UCEjOSbbaOfgnfRODEEMYlCw', 'UCS7kvhJx431xCKuSgkBaUWw', 'UC0LrZO9wORIqn_aRJtKdgfA'];
// Channels whose game highlights don't play in Taiwan: the NBA's own, CBS
// Sports Golazo's two, NBC Sports, beIN SPORTS USA.
const NOT_IN_TW = new Set(['UCWJ2lWNubArHWmf3FIHbfcQ', 'UCET00YnetHT7tOpu12v8jxg', 'UCf8YPuOWXlpTS7RibaJlP4g', 'UCqZQlzSHbVJrwrn5XvzrzcA', 'UC0YatYmg5JRYzXJPxIdRd8g']);

const SESSION_EN = { FP1: 'FP1', FP2: 'FP2', FP3: 'FP3', Race: 'Race', Qual: 'Qualifying', SR: 'Sprint', SS: 'Sprint Qualifying', SQ: 'Sprint Qualifying' };
// "Gulf Air Bahrain Grand Prix in Malaysia" → "Bahrain Grand Prix": the place
// before "Grand Prix" (two words for those that have two), no sponsor.
const TWO_WORD_GP = ['United States', 'Mexico City', 'Abu Dhabi', 'Las Vegas', 'Saudi Arabian', 'Emilia Romagna', 'São Paulo', 'Sao Paulo', 'Great Britain'];
// A name in its country's language: Gran Premio de la Ciudad de México,
// Grande Prêmio de São Paulo, Gran Premio d'Italia, Grand Prix de Monaco.
const LOCAL_GP = [[/Ciudad de M[ée]xico/i, 'Mexico City'], [/S[ãa]o Paulo/i, 'São Paulo'], [/Italia/i, 'Italian'], [/Espa[ñn]a/i, 'Spanish'], [/Emilia.Romagna/i, 'Emilia Romagna'], [/Monaco/i, 'Monaco']];
export function grandPrix(name) {
  const local = /Gran(?:de)?\s+Pr[eêé]mio|Grand Prix de/i.test(name || '') && LOCAL_GP.find(([re]) => re.test(name));
  if (local) return `${local[1]} Grand Prix`;
  const m = /([\p{L}'.-]+(?:\s+[\p{L}'.-]+)?)\s+Grand Prix/u.exec(String(name || ''));
  if (!m) return String(name || '').trim();
  const two = TWO_WORD_GP.find(x => m[1].endsWith(x));
  return `${two || m[1].split(/\s+/).at(-1)} Grand Prix`;
}

const nm = x => x?.en || x?.name || '';
const football = e => LEAGUES[e?.league]?.sport === 'soccer';
// A playoff game's number and its round's short name, from ESPN's note
// ("NLDS - Game 3", "East Semifinals - Game 5"): { round, game } or null.
export function gameNumber(e) {
  const m = /^(.*?)\s*-\s*Game\s+(\d+)\b/i.exec(String(e?.note || ''));
  return m ? { round: m[1].trim(), game: Number(m[2]) } : null;
}
// What to search for. A playoff game by its round and number (the leagues
// name their videos so: "BREWERS vs. PADRES: NLDS Full Game 3 Highlights"),
// any other by its day; football's home side first, as it's written there;
// CPBL's in Chinese; a race weekend's session the way F1 names its videos
// ("FP1 Highlights | 2026 Bahrain Grand Prix").
export function highlightsQuery(e) {
  const d = new Date(e.start);
  const year = d.getUTCFullYear();
  if (e.kind === 'match') {
    if (e.league === 'cpbl') {
      const tw = new Date(Date.parse(e.start) + 8 * 3_600_000);
      return `${e.away?.name || nm(e.away)} VS ${e.home?.name || nm(e.home)} 精華 ${tw.getUTCMonth() + 1}/${String(tw.getUTCDate()).padStart(2, '0')} ${tw.getUTCFullYear()}`;
    }
    const pair = football(e) ? `${nm(e.home)} vs ${nm(e.away)}` : `${nm(e.away)} vs ${nm(e.home)}`;
    const g = gameNumber(e);
    if (g) return `${pair} ${g.round} Game ${g.game} highlights ${year}`;
    const day = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: football(e) ? 'Europe/London' : 'America/New_York' });
    return `${pair} highlights ${day}`;
  }
  const lg = LEAGUES[e.league]?.en || '';
  return e.league === 'f1' ? `F1 ${year} ${grandPrix(e.enName || e.name)} ${SESSION_EN[e.sessionKey] || ''} Highlights` : `${e.enName || e.name} ${SESSION_EN[e.sessionKey] || ''} ${lg} highlights ${year}`;
}
export const searchUrl = e => `${YT}/results?search_query=${encodeURIComponent(highlightsQuery(e).replace(/\s+/g, ' ').trim())}`;
export const videoUrl = id => `${YT}/watch?v=${id}`;

// ---- Which video is the game's --------------------------------------------------------

const fold = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ø/g, 'o').replace(/ß/g, 'ss');
// Words of a club's name that say nothing on their own.
const GENERIC = new Set(['fc', 'cf', 'ac', 'as', 'sc', 'afc', 'cfc', 'ssc', 'us', 'rc', 'sv', 'vfb', 'vfl', 'tsg', 'fk', 'sk', 'club', 'de', 'la', 'le', 'the', 'and', 'of', 'united', 'city', 'real', 'sporting', 'athletic', 'football', 'calcio', 'olympique', 'stade', 'borussia', 'hotspur', 'albion', 'wanderers', 'county', 'town', 'rovers']);
// How a side is often written in titles that its name doesn't say.
const ALIASES = [[/manchester united/, ['man utd', 'man united']], [/manchester city/, ['man city']], [/czechia/, ['czech']], [/turkiye|turkey/, ['turkey', 'turkiye']], [/internazionale/, ['inter']], [/paris saint-germain/, ['psg']], [/bayern munich/, ['bayern']], [/wolverhampton/, ['wolves']], [/tottenham/, ['spurs']], [/nottingham forest/, ['forest']], [/brighton/, ['brighton']], [/bosnia/, ['bosnia']], [/republic of ireland/, ['ireland']]];
// The ways a side can be named in a title: its distinctive words (Brewers,
// Torino), the whole name, the ways it's shortened, its Chinese names.
export function sideWords(side, other = null) {
  const names = [side?.en, side?.name, side?.short].filter(Boolean).map(fold);
  const otherWords = new Set([other?.en, other?.name, other?.short].filter(Boolean).flatMap(n => fold(n).split(/[^\p{L}\p{N}]+/u)));
  const words = new Set();
  for (const n of names) {
    // A Chinese name whole (中信兄弟, 兄弟): two characters at least.
    if (/[\u3400-\u9fff]/.test(n)) {
      if (n.length >= 2) words.add(n);
      continue;
    }
    words.add(n);
    const parts = n.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    const own = parts.filter(w => w.length >= 3 && !otherWords.has(w));
    for (const w of own.filter(w => !GENERIC.has(w))) words.add(w);
    // Only generic words of its own left (Manchester City against United): those.
    if (!own.some(w => !GENERIC.has(w))) for (const w of own) words.add(w);
    for (const [re, alias] of ALIASES) if (re.test(n)) alias.forEach(a => words.add(a));
  }
  return [...words];
}
const named = (title, side, other) => sideWords(side, other).some(w => title.includes(w));
// The scores a title gives ("TORINO-ROMA 0-2", "(2-1)"), never a season (2026/27).
const scoresIn = title => [...title.matchAll(/(?<![\d/.:])(\d{1,2})\s*[-–:x]\s*(\d{1,2})(?![\d/.:])/g)].map(m => [Number(m[1]), Number(m[2])]);
// A video's age ("10h ago", "3 days ago", "Streamed 2 weeks ago") as a span in ms, or null.
const UNIT = { s: 1e3, sec: 1e3, second: 1e3, m: 6e4, min: 6e4, minute: 6e4, h: 3.6e6, hr: 3.6e6, hour: 3.6e6, d: 8.64e7, day: 8.64e7, w: 6.048e8, wk: 6.048e8, week: 6.048e8, mo: 2.592e9, month: 2.592e9, y: 3.1536e10, yr: 3.1536e10, year: 3.1536e10 };
export function ageSpan(text) {
  const m = /(\d+)\s*([a-z]+?)s?\s+ago/i.exec(String(text || ''));
  const unit = m && UNIT[m[2].toLowerCase()];
  if (!unit) return null;
  const n = Number(m[1]);
  return { min: n * unit, max: (n + 1) * unit };
}
// Words of a video that isn't the game's highlights.
const NOT_HIGHLIGHTS = /every play|reaction|preview|press conference|post-?match|interview|\bwomen'?s?\b|\bwfc\b|u-?\d{2}\b|sixes|simulation|recreation|efootball|\bfc ?2\d\b|\bpes\b|fantasy|top \d+|predict|best of|all goals from|\bmatchday \d+ \|/i;
// How official a channel is for a game: 0 the league's, 1 a side's, 2 an
// English rights holder's, 3 an NBA game's English full-game channel (4 an
// NBA side's own that isn't the full game's);
// null for anyone else.
function tier(v, e) {
  if (NOT_IN_TW.has(v.channelId)) return null;
  if ((LEAGUE_CHANNELS[e.league] || []).includes(v.channelId)) return 0;
  // A side's own (a club's, a federation's: Germany's is German Football):
  // one side's story, so an NBA team's counts first only when
  // it's the whole game's (its full-game cut), after the neutral ones otherwise.
  if (e.kind === 'match' && v.verified && [e.home, e.away].some(s => sideWords(s).some(w => !/[\u3400-\u9fff]/.test(w) && w.length >= 4 && fold(v.channel).includes(w.length >= 7 ? w.slice(0, 6) : w)))) return e.league === 'nba' && !/full game/i.test(v.title) ? 4 : 1;
  if (BROADCASTERS.has(v.channelId)) return 2;
  if (e.league === 'nba' && NBA_ENGLISH.includes(v.channelId)) return 3;
  return null;
}
// The game's highlights among a search's videos ({ id, title, channel,
// channelId, verified, age, length }), or null: an official channel's (see
// tier), playable in Taiwan, its title saying highlights and both sides (or
// the race and its session), the game's number and score when it gives them,
// its year, and put up after the game (by its age). English first but for CPBL.
export function pickHighlights(videos, e, now = Date.now()) {
  if (!videos?.length || !e) return null;
  const start = Date.parse(e.official || e.start);
  const year = new Date(start).getUTCFullYear();
  const g = e.kind === 'match' ? gameNumber(e) : null;
  const scores = e.kind === 'match' ? [Number(e.home?.score), Number(e.away?.score)] : null;
  const fits = videos
    .map((v, i) => ({ v, i, tier: tier(v, e), title: fold(v.title).replace(/#/g, '') }))
    .filter(x => x.tier != null)
    .filter(({ v, title, tier }) => {
      if (NOT_HIGHLIGHTS.test(v.title) || /maxi sintesi/.test(title)) return false;
      // Said to be highlights (résumé: in French); the league's own video of
      // the game (Ligue 1's "HAVRE AC - ANGERS SCO (0-0) | Week 4") by its sides and score.
      const called = /highlight|精華|resume/.test(title);
      if (!called && !(tier === 0 && e.kind === 'match' && scoresIn(title).length)) return false;
      // Put up after the game, within two weeks of it.
      const age = ageSpan(v.age);
      if (age && (age.min > now - start + 3_600_000 || age.max < now - start - 14 * 86_400_000)) return false;
      // Its year (a season's, 2026/27, counts both).
      const years = [...title.matchAll(/\b(20\d\d)(?:\s*[/-]\s*(\d\d))?\b/g)].flatMap(m => [Number(m[1]), ...(m[2] ? [Number(m[1].slice(0, 2) + m[2])] : [])]);
      if (years.length && !years.includes(year)) return false;
      if (e.kind !== 'match') {
        const place = fold(grandPrix(e.enName || e.name).replace(/\s*Grand Prix$/i, ''));
        const word = fold(SESSION_EN[e.sessionKey] || '');
        if (!place || !title.includes(place)) return false;
        if (!word) return true;
        if (!title.includes(word)) return false;
        // Sprint isn't Sprint Qualifying; qualifying and the race aren't the sprint's.
        if (e.sessionKey === 'SR' && /sprint (qualifying|shootout)/.test(title)) return false;
        if ((e.sessionKey === 'Qual' || e.sessionKey === 'Race') && /sprint/.test(title)) return false;
        return true;
      }
      if (!named(title, e.home, e.away) || !named(title, e.away, e.home)) return false;
      // The game's number: a title naming another game is another game's.
      const n = [...title.matchAll(/\b(?:game|g)\s*(\d+)\b/g)].map(m => Number(m[1]));
      if (g && n.length && !n.includes(g.game)) return false;
      if (!g && n.length && e.series) return false;
      // Its score, either way round, when the title gives one.
      const said = scoresIn(title);
      if (said.length && scores.every(Number.isFinite) && !said.some(([a, b]) => (a === scores[0] && b === scores[1]) || (a === scores[1] && b === scores[0]))) return false;
      return true;
    })
    // In English first (but for CPBL's): not Chinese, not French.
    .map(x => ({ ...x, zh: e.league !== 'cpbl' && (/[\u3400-\u9fff]/.test(x.v.title) || !/highlight/.test(x.title)) ? 1 : 0 }))
    .sort((a, b) => a.tier - b.tier || a.zh - b.zh || (a.tier === 3 ? NBA_ENGLISH.indexOf(a.v.channelId) - NBA_ENGLISH.indexOf(b.v.channelId) : 0) || a.i - b.i);
  return fits[0]?.v || null;
}

// ---- Finding it ------------------------------------------------------------------------

// Found ones kept on the device (a video found stays the game's): { key: { id, channel, length } }.
const KEPT = 'fx.highlights.v1';
const keyOf = e => `${e.league}:${e.id}:${e.sessionKey || ''}`;
function kept() {
  try {
    return JSON.parse(localStorage.getItem(KEPT) || '{}') || {};
  } catch {
    return {};
  }
}
export const knownHighlights = e => (e ? kept()[keyOf(e)] || null : null);
function keep(e, v) {
  try {
    const all = kept();
    all[keyOf(e)] = { id: v.id, channel: v.channel, length: v.length, at: Date.now() };
    // The newest 300.
    const list = Object.entries(all).sort((a, b) => (b[1].at || 0) - (a[1].at || 0)).slice(0, 300);
    localStorage.setItem(KEPT, JSON.stringify(Object.fromEntries(list)));
  } catch {}
}
// The game's video ({ id, channel, length }), or null while there's none
// (a search read again after 20 minutes, a day for a game a week old). A
// failed read throws: never "none".
export async function findHighlights(e, read, now = Date.now()) {
  if (e?.status?.state !== 'post' || e.status.void) return null;
  const known = knownHighlights(e);
  if (known) return known;
  const old = now - Date.parse(e.start) > 7 * 86_400_000;
  const data = await read(searchUrl(e), { ttl: old ? 86_400_000 : 20 * 60_000 });
  const v = pickHighlights(data?.videos, e, now);
  if (v) keep(e, v);
  return v ? { id: v.id, channel: v.channel, length: v.length } : null;
}
