// Sports data for Orbit Sports: ESPN's public site API (CPBL from its
// own site), through the Quadra data proxy, which caches every
// answer for every viewer and answers signed-in apps only.
//
// Everything is normalized into a few shapes the page draws:
//
//   event   { id, league, kind, name, short, start, status, venue, tv,
//             home, away (kind 'match'), sessions and country (kind
//             'field'), note }
//   side    { id, name, short, abbr, logo, color, score, winner, record,
//             lines (each period's score) }
//   status  { state: 'pre' | 'in' | 'post', detail, short, completed, void }
import { teamBadge, teamLogo, raceName, countryName, countryCode, f1Driver, f1Constructor } from '#kit/logos.mjs';
import { detectLocale } from './i18n.mjs';
import { liveOf } from './live.mjs';
import { LEAGUES } from './leagues.mjs';
import { asiaMonth, asiaMonthOf, CATALOG } from '#kit/catalog.mjs';
import { proxyJson } from '#kit/quadra.mjs';
import { stageFrom } from './stage.mjs';
import { teamNameZh } from '#kit/names.mjs';
import { groupZh } from './statnames.mjs';

export const SITE = 'https://site.api.espn.com/apis/site/v2/sports';
export const STANDINGS = 'https://site.api.espn.com/apis/v2/sports';
export const COMMON = 'https://site.api.espn.com/apis/common/v3/sports';

// ---- Fetching ------------------------------------------------------------------

// The kit's proxyJson: requests made together go as one batch, answers are
// remembered in memory and on the device (a list younger than `ttl` is
// never asked for again, even after the app was closed).
export const getJson = (url, { ttl = 60_000, trim = '' } = {}) => proxyJson(url, { ttl, trim });
// How long a live answer (scores, a game's summary) is kept before asking again.
export const LIVE_TTL = 10_000;

export const yyyymmdd = date => date.toISOString().slice(0, 10).replaceAll('-', '');
// ESPN files a game under the US date; a Taiwan day spans two of them.
export function espnDatesFor(taipeiDate) {
  const d = new Date(`${taipeiDate}T00:00:00+08:00`);
  return [...new Set([yyyymmdd(new Date(d.getTime() - 12 * 3_600_000)), yyyymmdd(new Date(d.getTime() + 11 * 3_600_000))])];
}
export const taipeiDate = t => new Date(new Date(t).getTime() + 8 * 3_600_000).toISOString().slice(0, 10);

// ---- Parsing: statuses and sides --------------------------------------------------

// Called off. A delay (rain, a late start) or a suspension isn't: the game
// is still on, only waiting (Play keeps it live too).
const VOID = /POSTPONED|CANCELED|CANCELLED|FORFEIT|ABANDONED/;
const WAITING = /DELAYED|SUSPENDED|RAIN_DELAY/;
export function parseStatus(s) {
  const type = s?.type || {};
  return {
    state: type.state || 'pre',
    detail: type.detail || type.description || '',
    short: type.shortDetail || type.detail || '',
    completed: Boolean(type.completed),
    void: VOID.test(type.name || ''),
    delayed: WAITING.test(type.name || '') || /\bdelay/i.test(type.shortDetail || type.detail || ''),
    name: type.name || '',
    clock: s?.displayClock || '',
    period: s?.period || 0
  };
}

const logoOf = team => team?.logo || team?.logos?.[0]?.href || null;
// ESPN's F1 headshots (headshots/f1/) stopped in 2021 (a newer driver has
// none); its racing ones (headshots/rpm/) are this season's, every driver.
export const freshHeadshot = url => (typeof url === 'string' ? url.replace('/i/headshots/f1/players/', '/i/headshots/rpm/players/') : url);
function parseSide(c) {
  if (!c) return null;
  const team = c.team || {};
  const athlete = c.athlete || {};
  const who = c.team ? team : athlete;
  const record = Array.isArray(c.records) ? c.records.find(r => r.type === 'total' || r.name === 'overall')?.summary || c.records[0]?.summary : Array.isArray(c.record) ? c.record[0]?.displayValue : '';
  return {
    id: String(who.id ?? c.id ?? ''),
    athlete: !c.team && Boolean(c.athlete),
    name: who.displayName || who.fullName || who.name || '',
    short: who.shortDisplayName || who.shortName || who.displayName || '',
    abbr: who.abbreviation || (who.shortName || '').slice(0, 3).toUpperCase(),
    logo: logoOf(team) || athlete.flag?.href || freshHeadshot(athlete.headshot?.href) || null,
    color: team.color ? `#${team.color}` : null,
    score: c.score?.displayValue ?? (typeof c.score === 'string' || typeof c.score === 'number' ? String(c.score) : ''),
    winner: Boolean(c.winner),
    record: record || '',
    lines: (c.linescores || []).map(l => l.displayValue ?? String(l.value ?? '')),
    homeAway: c.homeAway || null,
    order: c.order ?? null
  };
}

// ---- Scoreboards -------------------------------------------------------------------

// A logo where the feed left one out: ESPN's CDN by the team's (or the
// athlete's) id or abbreviation. A guess, so the picture falls back to the
// initial when it isn't there.
const CDN = 'https://a.espncdn.com/i';
const HEADSHOTS = { racing: 'rpm' };
export function fallbackLogo(league, side) {
  if (!side || side.logo) return side?.logo || null;
  // The shared kit's (Quadra Play's) logo for the club.
  const kit = teamLogo(LEAGUES[league]?.play || league, side.name);
  // A side not decided yet (ESPN's "TBD", ids -1 and -2) has no logo.
  if (kit || !/^\d+$/.test(String(side.id ?? '')) || league === 'nba') return kit;
  const [sport] = (LEAGUES[league]?.espn || '').split('/');
  if (side.athlete) return HEADSHOTS[sport] ? `${CDN}/headshots/${HEADSHOTS[sport]}/players/full/${side.id}.png` : null;
  if (sport === 'soccer') return `${CDN}/teamlogos/soccer/500/${side.id}.png`;
  return null;
}
// An NBA team's logo is always NBA.com's primary mark (the kit's): ESPN's
// files are some clubs' alternates (the Celtics' shamrock). A club from
// outside the league (a preseason guest: the London Lions) has none, so it
// shows its initial.
const nbaLogo = (league, side) => (league === 'nba' && side && !side.athlete ? { ...side, logo: teamLogo('nba', side.en || side.name) } : side);
// A team as shown: its logo (an NBA team's, above), and its name in the
// reader's language: Chinese from the kit's names (lib/names.mjs) when it has
// the team, the English kept as `en` (Play's ids and the matching use it).
// People (players, drivers) keep their names.
export function localSide(league, raw, lang = detectLocale()) {
  const side = nbaLogo(league, raw);
  if (!side || lang === 'en' || side.athlete) return side;
  const en = side.en || side.name;
  const zh = teamNameZh(LEAGUES[league]?.play || league, en, LEAGUES[league]?.sport);
  if (zh) return { ...side, en, name: zh.full, short: zh.short };
  // A national side (England, Czechia): its country's name.
  const nation = countryName(en, lang);
  return nation && nation !== en ? { ...side, en, name: nation, short: nation } : side;
}
const withLogo = (league, side) => localSide(league, side && !side.logo ? { ...side, logo: fallbackLogo(league, side) } : side);

// A race weekend or a tournament, as of `now`: over once its last session
// has had its time (the feed can keep a weekend "in progress" for days), and
// `at` the session that's on or next (the weekend's own date is its first
// day). Other events unchanged.
const SESSION_MS = 4 * 3_600_000;
export function settleField(e, now = Date.now()) {
  if (!e?.sessions || e.sessionKey) return e;
  const sessions = e.sessions.filter(x => x.start).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const live = sessions.find(x => x.status.state === 'in' && Date.parse(x.start) + SESSION_MS > now);
  const next = sessions.find(x => x.status.state === 'pre' && Date.parse(x.start) + SESSION_MS > now);
  const last = sessions.at(-1);
  const endAt = Math.max(last ? Date.parse(last.start) + SESSION_MS : 0, e.end ? Date.parse(e.end) + 24 * 3_600_000 : 0);
  const over = (sessions.length && sessions.every(x => x.status.state === 'post')) || (!live && !next && endAt && endAt < now);
  if (over) return { ...e, at: last?.start || e.start, status: { ...e.status, state: 'post', completed: true } };
  const on = live || next;
  return { ...e, at: on?.start || e.start, session: on?.name || '', status: live ? { ...e.status, state: 'in' } : e.status.state === 'in' ? { ...e.status, state: 'pre' } : e.status };
}

// A race weekend's sessions by their feed code, each listed as an event of
// its own (practice too: ELTA carries every F1 session live).
export const SESSION_NAMES = {
  FP1: { zh: '第一次練習', en: 'Practice 1', short: { zh: '一練', en: 'FP1' } },
  FP2: { zh: '第二次練習', en: 'Practice 2', short: { zh: '二練', en: 'FP2' } },
  FP3: { zh: '第三次練習', en: 'Practice 3', short: { zh: '三練', en: 'FP3' } },
  SS: { zh: '衝刺排位賽', en: 'Sprint qualifying', short: { zh: '衝刺排位', en: 'SQ' } },
  SQ: { zh: '衝刺排位賽', en: 'Sprint qualifying', short: { zh: '衝刺排位', en: 'SQ' } },
  SR: { zh: '衝刺賽', en: 'Sprint', short: { zh: '衝刺賽', en: 'Sprint' } },
  Qual: { zh: '排位賽', en: 'Qualifying', short: { zh: '排位', en: 'Quali' } },
  Race: { zh: '正賽', en: 'Race', short: { zh: '正賽', en: 'Race' } }
};
const MAIN_SESSIONS = ['FP1', 'FP2', 'FP3', 'SS', 'SQ', 'SR', 'Qual', 'Race'];
// F1 on TV here (ELTA, from Sky's coverage of F1's international feed)
// opens with the title sequence, F1's theme, a few minutes before the
// session's official time: the time shown is the titles', so they're never
// missed. Minutes before; estimates (F1 publishes none: the race's come after
// the anthem, the others just before the session), tuned here.
export const TITLES_BEFORE = { Race: 10, SR: 5, Qual: 4, SS: 4, SQ: 4, FP1: 4, FP2: 4, FP3: 4 };
export const titlesAt = (league, abbr, start) => (league === 'f1' && TITLES_BEFORE[abbr] && start ? new Date(Date.parse(start) - TITLES_BEFORE[abbr] * 60_000).toISOString().replace(':00.000Z', 'Z') : start);
export const sessionName = (x, lang = 'zh', short = false) => {
  const n = SESSION_NAMES[x?.abbr];
  if (!n) return x?.name || x?.abbr || '';
  return short ? n.short[lang === 'en' ? 'en' : 'zh'] : n[lang === 'en' ? 'en' : 'zh'];
};
// A race weekend as its sessions, each an event (the weekend's other
// fields kept, so its sheet opens on that session). Anything else as it is.
export function splitWeekend(e, now = Date.now(), lang = 'zh') {
  if (e?.kind !== 'field' || LEAGUES[e.league]?.sport !== 'racing' || e.sessionKey) return [e];
  const main = (e.sessions || []).filter(x => x.start && MAIN_SESSIONS.includes(x.abbr));
  if (main.length < 2) return [settleField(e, now)];
  return main.map(x => {
    // The feed can leave a session "on" (or "to come") long after it ended.
    const done = Date.parse(x.start) + SESSION_MS < now;
    const status = done && x.status.state !== 'post' ? { ...x.status, state: 'post', completed: true } : x.status;
    const shown = titlesAt(e.league, x.abbr, x.start);
    return { ...e, id: `${e.id}~${x.abbr}`, weekend: e.id, start: shown, at: shown, official: x.start, end: null, session: sessionName(x, lang), sessionKey: x.abbr, status };
  });
}

// A playoff series: its summary ("LAL lead series 2-1") and each side's wins.
export function parseSeries(s) {
  if (!s || s.type !== 'playoff') return null;
  return { summary: s.summary || '', completed: Boolean(s.completed), games: s.totalCompetitions || 0, wins: Object.fromEntries((s.competitors || []).map(c => [String(c.id), c.wins ?? 0])) };
}

// A playoff or knockout game's round, for the bracket: `key` the round
// (ESPN's RD16 / QTR / SEMI / FINAL for the US leagues' playoffs, the
// season's stage for a cup: round-of-16, quarterfinals…), its name, the leg
// and the sides the tie's over for (a cup's second leg says who went
// through). Null for any other game (a cup's league phase or groups too).
export function knockoutRound(e, comp, league) {
  const slug = String(e?.season?.slug || '');
  const note = comp?.notes?.[0]?.headline || '';
  const cup = Boolean(LEAGUES[league]?.cup);
  if (/play-?in/i.test(`${slug} ${note}`)) return null;
  const post = e?.season?.type === 3 || /post-?season/i.test(slug);
  if (!post && !(cup && slug && !/league-phase|group|regular|qualif|preliminary/i.test(slug))) return null;
  const key = cup ? slug : comp?.type?.abbreviation || slug;
  if (!key) return null;
  const title = comp?.series?.title || (cup ? slug.replace(/-/g, ' ') : note.replace(/\s*-\s*(Game|Leg)\b.*$/i, '')) || key;
  return { key, title, leg: Number(comp?.leg?.value) || 0, through: (comp?.series?.competitors || []).filter(c => c.winner).map(c => String(c.id)) };
}
export function parseScoreboard(data, league) {
  const kind = LEAGUES[league]?.kind || 'match';
  const out = [];
  for (const e of data?.events || []) {
    const comp = e.competitions?.[0];
    const base = {
      id: String(e.id),
      league,
      kind,
      // An F1 race by its short name ("新加坡站"), not the sponsor's.
      name: league === 'f1' ? raceName(e.name, detectLocale()) : e.name || '',
      enName: e.name || '',
      short: e.shortName || '',
      start: e.date,
      end: e.endDate || null,
      status: parseStatus(e.status || comp?.status),
      venue: comp?.venue?.fullName || e.venue?.fullName || e.circuit?.fullName || '',
      tv: [...new Set((comp?.broadcasts || []).flatMap(b => b.names || []))].join(' · '),
      note: comp?.notes?.[0]?.headline || '',
      series: parseSeries(comp?.series),
      round: knockoutRound(e, comp, league),
      stage: stageFrom({ seasonType: e.season?.type, seasonSlug: e.season?.slug, typeAbbr: comp?.type?.abbreviation, note: comp?.notes?.[0]?.headline || '', name: e.name, cup: LEAGUES[league]?.cup })
    };
    if (kind === 'match' && comp) {
      const home = parseSide(comp.competitors?.find(c => c.homeAway === 'home') || comp.competitors?.[0]);
      const away = parseSide(comp.competitors?.find(c => c.homeAway === 'away') || comp.competitors?.[1]);
      if (!home || !away) continue;
      out.push({ ...base, home: withLogo(league, home), away: withLogo(league, away), neutral: Boolean(comp.neutralSite), situation: comp.situation?.lastPlay?.text || '', live: base.status.state === 'in' ? liveOf(comp, e.status || comp.status, LEAGUES[league]?.sport) : null });
    } else if (kind === 'field') {
      // A race weekend: its sessions, each one's field in finishing order.
      const sessions = (e.competitions || []).map(m => ({
        id: String(m.id),
        name: m.type?.text || m.type?.abbreviation || '',
        abbr: m.type?.abbreviation || '',
        start: m.date,
        status: parseStatus(m.status),
        field: [...(m.competitors || [])].sort((a, b) => (a.order ?? 999) - (b.order ?? 999)).map(c => withLogo(league, parseSide(c)))
      }));
      // Where it's raced: the circuit's country ('SG'), for its flag.
      out.push({ ...base, sessions, country: countryCode(e.circuit?.address?.country) });
    }
  }
  return out;
}

// The newest copy of each game read from a live list (a scoreboard, a
// match's summary): a team's schedule is kept for minutes (the proxy longer),
// and its copy of a game on now, or just over, is behind. freshGame(e) is
// `e` with the newest state and score known.
const latest = new Map();
export const noteLatest = list => {
  const at = Date.now();
  for (const e of list) if (e?.kind === 'match' && e.status) latest.set(`${e.league}:${e.id}`, { at, e });
  if (latest.size > 3000) for (const k of [...latest.keys()].slice(0, 1000)) latest.delete(k);
  return list;
};
const STATE_ORDER = { pre: 0, in: 1, post: 2 };
export function freshGame(e) {
  const got = e && latest.get(`${e.league}:${e.id}`);
  if (!got || got.e === e) return e;
  const f = got.e;
  // Never backwards (a list cached longer saying 'on' after one said 'over').
  if ((STATE_ORDER[f.status.state] ?? 0) < (STATE_ORDER[e.status?.state] ?? 0)) return e;
  const side = (mine, theirs) => (mine && theirs && String(mine.id) === String(theirs.id) ? { ...mine, score: theirs.score, winner: theirs.winner } : mine);
  return { ...e, status: f.status, series: f.series || e.series, live: f.live ?? e.live, home: side(e.home, f.home), away: side(e.away, f.away) };
}

export async function scoreboard(league, dates) {
  const l = LEAGUES[league];
  if (l?.asia) return asiaEvents(league);
  const list = [].concat(dates || []);
  // Scores on now: read again after 10 seconds (the proxy's live copy).
  // A day two or more back is over: kept on the phone 6 hours, not asked again every 10 seconds.
  const pages = list.length ? await Promise.all(list.map(d => getJson(`${SITE}/${l.espn}/scoreboard?dates=${d}&limit=200`, { ttl: /^\d{8}$/.test(d) && d < yyyymmdd(new Date(Date.now() - 2 * 86_400_000)) ? 6 * 3_600_000 : LIVE_TTL }).catch(() => null))) : [await getJson(`${SITE}/${l.espn}/scoreboard`, { ttl: LIVE_TTL })];
  // Not one page read: a failure, never "no games" (a day saved without the
  // league, or the league taken for out of season).
  if (!pages.some(Boolean)) throw new Error(`${league}: unread`);
  const seen = new Set();
  return noteLatest(
    pages
      .filter(Boolean)
      .flatMap(p => parseScoreboard(p, league))
      .filter(e => !seen.has(e.id) && seen.add(e.id))
  );
}

// A whole season of a race series (ESPN answers
// `dates=<year>` with every event of that year): past results and every
// future event, not only the current one. Late in the year, next year's too.
export async function seasonEvents(league, now = Date.now()) {
  const l = LEAGUES[league];
  if (l?.asia) return asiaEvents(league);
  const d = new Date(now);
  const years = [d.getUTCFullYear(), ...(d.getUTCMonth() >= 10 ? [d.getUTCFullYear() + 1] : [])];
  const pages = await Promise.all(years.map(y => getJson(`${SITE}/${l.espn}/scoreboard?dates=${y}&limit=400`, { ttl: 5 * 60_000 }).catch(() => null)));
  const seen = new Set();
  const events = pages
    .filter(Boolean)
    .flatMap(p => parseScoreboard(p, league))
    .filter(e => !seen.has(e.id) && seen.add(e.id))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  return events.length ? events : scoreboard(league);
}

// ---- A football league's matchweek (第 N 輪) ----------------------------------------
//
// ESPN gives none: a match's week is one more than the most league games
// either side had played before it this season (a game put back is counted
// where it's played). The season from July (Europe's) or the year's start;
// both years' lists, kept 6 hours.
export function weeksFrom(events, from) {
  const played = new Map();
  const out = new Map();
  for (const e of [...events].filter(x => x.kind === 'match' && !x.status?.void && Date.parse(x.start) >= from).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))) {
    const [h, a] = [played.get(e.home?.id) || 0, played.get(e.away?.id) || 0];
    out.set(e.id, Math.max(h, a) + 1);
    played.set(e.home?.id, h + 1);
    played.set(e.away?.id, a + 1);
  }
  return out;
}
const weekMemo = new Map();
// The matchweek of a football league's match, once its season's been read
// (null until then; `onLoad` runs when it has).
export function weekOf(e, onLoad) {
  const l = LEAGUES[e?.league];
  if (!l?.espn || l.sport !== 'soccer' || l.cup || e.kind !== 'match') return null;
  const memo = weekMemo.get(e.league);
  if (memo instanceof Map) return memo.get(e.id) ?? null;
  if (!memo) {
    const d = new Date(Date.parse(e.start) || Date.now());
    const y = d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
    const july = Date.UTC(y, 6, 1);
    const load = Promise.all([y, y + 1].map(yr => getJson(`${SITE}/${l.espn}/scoreboard?dates=${yr}&limit=500`, { ttl: 6 * 3_600_000 }).catch(() => null)))
      .then(pages => {
        const events = pages.filter(Boolean).flatMap(p => parseScoreboard(p, e.league));
        // A league that starts in the year's spring (MLS) counts from its first game.
        const from = events.some(x => Date.parse(x.start) >= july && Date.parse(x.start) < july + 60 * 86_400_000) ? july : Date.UTC(d.getUTCFullYear(), 0, 1);
        weekMemo.set(e.league, weeksFrom(events, from));
      })
      .catch(() => weekMemo.set(e.league, new Map()));
    weekMemo.set(e.league, load);
  }
  if (onLoad) weekMemo.get(e.league).then?.(() => onLoad());
  return null;
}

// ---- The season's calendar: which days a league plays -------------------------------
//
// ESPN's scoreboard carries the season's calendar: for most leagues the US
// dates with games (a whitelist), for MLB the days without (a blacklist
// between the season's start and end). { days: ['YYYYMMDD'…] }, { months:
// true } (a cup's), or null when there's none.
export function parseCalendar(data) {
  const l = data?.leagues?.[0];
  const cal = l?.calendar;
  if (!Array.isArray(cal) || !cal.length) return null;
  const us = iso => String(iso).slice(0, 10).replaceAll('-', '');
  // A cup's or the national teams' calendar: its stages ("League Phase",
  // "Round of 16"), not days; its games come from month pages (the default
  // page can be a round long past).
  if (typeof cal[0] === 'object') return { months: true };
  if (l.calendarIsWhitelist !== false) return { days: cal.map(us) };
  // A blacklist: every day from the start to the end but those.
  const off = new Set(cal.map(us));
  const days = [];
  const end = Date.parse(l.calendarEndDate);
  for (let t = Date.parse(l.calendarStartDate); t <= end && days.length < 400; t += 86_400_000) {
    const d = us(new Date(t).toISOString());
    if (!off.has(d)) days.push(d);
  }
  return { days };
}
// The months (ESPN's `dates=YYYYMM`) from one time to another.
export function monthsBetween(fromMs, toMs) {
  const out = [];
  const d = new Date(fromMs);
  for (let y = d.getUTCFullYear(), m = d.getUTCMonth(); Date.UTC(y, m, 1) <= toMs && out.length < 24; m === 11 ? ((m = 0), y++) : m++) out.push(`${y}${String(m + 1).padStart(2, '0')}`);
  return out;
}
// A league's season as its scoreboard says, on a day (today without one):
// { season: { year, name, start, end, phase: 'pre' | 'regular' | 'post' | 'off' | '' },
//   days: ['YYYYMMDD'…] (its game days), stages: [{ label, start, end }] (a cup's rounds) }.
export async function seasonInfo(league, date = null) {
  const l = LEAGUES[league];
  if (!l?.espn) return null;
  const data = await getJson(`${SITE}/${l.espn}/scoreboard${date ? `?dates=${date}` : ''}`, { ttl: date ? 6 * 3_600_000 : 10 * 60_000 });
  const L = data?.leagues?.[0] || {};
  const t = L.season?.type || {};
  const name = `${t.name || ''} ${t.abbreviation || ''}`;
  const phase = t.type === 3 || /post|playoff|final|knockout/i.test(name) ? 'post' : t.type === 2 || /regular|league phase|group/i.test(name) ? 'regular' : t.type === 1 || /^\s*pre/i.test(name) ? 'pre' : t.type === 4 || /off/i.test(name) ? 'off' : '';
  const cal = parseCalendar(data);
  return {
    season: { year: L.season?.year || 0, name: L.season?.displayName || '', start: L.season?.startDate || '', end: L.season?.endDate || '', phase },
    days: cal?.days || [],
    stages: (L.calendar || []).flatMap(c => (c && typeof c === 'object' ? c.entries || [] : [])).map(x => ({ label: x.label || '', start: x.startDate || '', end: x.endDate || '' }))
  };
}
export async function seasonCalendar(league) {
  const l = LEAGUES[league];
  if (!l?.espn) return null;
  return parseCalendar(await getJson(`${SITE}/${l.espn}/scoreboard`, { ttl: 20_000 }));
}

// ---- CPBL (its own site, through the proxy) ---------------------------------------------

// The shared catalogue's month lists (see catalog.mjs, asiaMonth) as events.
export function parseAsia(games, league, lang = detectLocale()) {
  const play = LEAGUES[league]?.play || league;
  return (games || []).map(g => {
    const done = g.state === 'post';
    const side = (x, key, score, other) => ({
      id: x.en,
      name: lang === 'en' ? x.en : x.zh,
      short: lang === 'en' ? x.en : teamNameZh(play, x.en)?.short || x.zh,
      en: x.en,
      abbr: x.en.slice(0, 3).toUpperCase(),
      logo: teamBadge(play, x.en),
      color: null,
      score: score ?? '',
      winner: done && score != null && other != null && score > other,
      record: '',
      rank: null,
      lines: [],
      homeAway: key
    });
    return {
      id: g.id,
      league,
      kind: 'match',
      name: `${g.away.en} @ ${g.home.en}`,
      short: `${g.away.zh} @ ${g.home.zh}`,
      start: g.start,
      status: { state: g.state === 'void' ? 'pre' : g.state, detail: '', short: '', completed: done, void: g.state === 'void' },
      venue: g.venue || '',
      tv: '',
      note: '',
      home: side(g.home, 'home', g.homeScore, g.awayScore),
      away: side(g.away, 'away', g.awayScore, g.homeScore),
      live: null,
      asia: true
    };
  });
}
// The months around now (and `extra` more either side): a whole stretch of
// the season, past games and the next ones.
export async function asiaEvents(league, extra = 0, now = Date.now()) {
  const [y, m] = asiaMonthOf(now).split('-').map(Number);
  const months = [];
  for (let d = -1 - extra; d <= 1 + extra; d++) months.push(new Date(Date.UTC(y, m - 1 + d, 1)).toISOString().slice(0, 7));
  const lists = await Promise.all(months.map(m => asiaMonth(url => getJson(url, { ttl: 60_000 }), LEAGUES[league].asia, m).catch(() => [])));
  const seen = new Set();
  const events = parseAsia(lists.flat(), league)
    .filter(e => !seen.has(e.id) && seen.add(e.id))
    .sort((a, b) => a.start.localeCompare(b.start));
  return events.some(e => e.status.state === 'in') ? withKambiLive(events, league) : events;
}

// ---- A CPBL game on now: Kambi's live feed (the bookmaker's, through the
// proxy) has its inning and the score as it happens; the league's own lists
// only say it's on. Matched by the clubs' nicknames (Kambi writes "Uni-
// President 7-Eleven Lions", the league "Uni-President Lions").
const KAMBI = 'https://eu-offering-api.kambicdn.com/offering/v2018/ub/listView';
// Kambi writes "Uni-Lions" too: the last word, hyphens splitting as well.
const nickname = name => String(name || '').trim().split(/[\s-]+/).at(-1).toLowerCase();
// A STARTED game: its inning (one period a run line has begun), the score
// (none yet is 0-0) and each inning's runs ("3-0 | 0-1", home first) as the
// sides' line score. `path`: only that league's games (the all-baseball list).
export function kambiInnings(data, path = '') {
  return (data?.events || [])
    .filter(x => x.event?.state === 'STARTED')
    .filter(x => !path || !Array.isArray(x.event.path) || x.event.path.map(p => p?.termKey ?? p).join('/') === path)
    .map(x => {
      const periods = String(x.liveData?.score?.info || '').split('|').map(p => /(\d+)\s*-\s*(\d+)/.exec(p)).filter(Boolean);
      return {
        home: nickname(x.event.homeName),
        away: nickname(x.event.awayName),
        inning: periods.length || null,
        homeScore: Number(x.liveData?.score?.home ?? 0),
        awayScore: Number(x.liveData?.score?.away ?? 0),
        homeLines: periods.map(m => m[1]),
        awayLines: periods.map(m => m[2])
      };
    });
}
export function applyKambiLive(events, live) {
  return events.map(e => {
    const [h, a] = [nickname(e.home.en), nickname(e.away.en)];
    const k = e.status.state === 'in' && live.find(x => (x.home === h && x.away === a) || (x.home === a && x.away === h));
    if (!k) return e;
    // Kambi may list the clubs the other way round.
    const same = k.home === h;
    const [hs, as] = same ? [k.homeScore, k.awayScore] : [k.awayScore, k.homeScore];
    const [hl, al] = same ? [k.homeLines, k.awayLines] : [k.awayLines, k.homeLines];
    const side = (x, v, lines) => ({ ...x, ...(Number.isFinite(v) ? { score: v } : {}), ...(lines?.length ? { lines } : {}) });
    return { ...e, status: { ...e.status, period: k.inning || 0 }, live: { inning: k.inning }, home: side(e.home, hs, hl), away: side(e.away, as, al) };
  });
}
// Kambi's list for one league answers 404 (CPBL's, since October 2026);
// the list of all baseball on now works, and is one ask for NPB, KBO and
// CPBL alike.
async function withKambiLive(events, league) {
  const path = CATALOG[league]?.kambi;
  if (!path) return events;
  const data = await getJson(`${KAMBI}/baseball/all/all/all/in-play.json?lang=en_GB&market=GB&useCombined=true`, { ttl: LIVE_TTL, trim: 'kambi-events' }).catch(() => null);
  return applyKambiLive(events, kambiInnings(data, path));
}

// ---- A match's summary --------------------------------------------------------------

export function parseSummary(data, league) {
  const header = data?.header?.competitions?.[0];
  const sides = (header?.competitors || []).map(c => localSide(league, parseSide(c)));
  const byId = Object.fromEntries(sides.map(s => [s.id, s]));
  const box = data?.boxscore || {};
  // Team stats, paired: [{ label, home, away }].
  const teamStats = [];
  const home = box.teams?.find(t => t.homeAway === 'home') || box.teams?.[1];
  const away = box.teams?.find(t => t.homeAway === 'away') || box.teams?.[0];
  const flat = t => {
    const out = new Map();
    for (const s of t?.statistics || []) {
      // Grouped (baseball's batting, pitching, fielding): the same name means a different thing in each.
      if (Array.isArray(s.stats)) for (const x of s.stats) out.set(`${s.name}.${x.name}`, { label: x.displayName || x.label || x.name, value: x.displayValue, group: s.name });
      else out.set(s.name, { label: s.label || s.displayName || s.name, value: s.displayValue });
    }
    return out;
  };
  const hs = flat(home);
  const as = flat(away);
  for (const [key, h] of hs) if (as.has(key) && h.value !== undefined) teamStats.push({ key, label: h.label, group: h.group || '', home: h.value, away: as.get(key).value });
  // Player tables per team: [{ team, tables: [{ name, labels, rows: [{ id, name, stats }] }] }].
  const players = (box.players || []).map(p => ({
    team: String(p.team?.id ?? ''),
    tables: (p.statistics || []).map(st => ({
      name: st.name || st.type || st.text || '',
      labels: st.labels || st.names || [],
      rows: (st.athletes || []).map(a => ({ id: String(a.athlete?.id ?? ''), name: a.athlete?.shortName || a.athlete?.displayName || '', pos: a.position?.abbreviation || '', starter: Boolean(a.starter), stats: a.stats || [] })),
      totals: st.totals || []
    }))
  }));
  // Scoring and key moments.
  const plays = (data?.scoringPlays || data?.plays?.filter(p => p.scoringPlay) || [])
    .slice(-60)
    .map(p => ({ text: p.text || p.type?.text || '', period: p.period?.displayValue || (p.period?.number ? `${p.period.number}` : ''), clock: p.clock?.displayValue || '', team: String(p.team?.id ?? ''), home: p.homeScore, away: p.awayScore }));
  const keyEvents = (data?.keyEvents || [])
    .filter(k => k.type?.type !== 'kickoff' && k.type?.type !== 'halftime' && k.type?.type !== 'end-regular-time')
    .map(k => ({ text: k.text || k.type?.text || '', type: k.type?.type || '', clock: k.clock?.displayValue || '', team: String(k.team?.id ?? ''), scoring: Boolean(k.scoringPlay) }));
  const rosters = (data?.rosters || []).map(r => ({
    team: String(r.team?.id ?? ''),
    formation: r.formation || '',
    players: (r.roster || []).map(x => ({ id: String(x.athlete?.id ?? ''), name: x.athlete?.displayName || '', short: x.athlete?.shortName || '', headshot: freshHeadshot(x.athlete?.headshot?.href) || null, jersey: x.jersey || '', pos: x.position?.abbreviation || '', starter: Boolean(x.starter), played: Boolean(x.starter || x.subbedIn), stats: Object.fromEntries((x.stats || []).map(s => [s.name, s.displayValue])) }))
  }));
  const leaders = (data?.leaders || []).flatMap(t =>
    (t.leaders || []).map(l => ({ team: String(t.team?.id ?? ''), stat: l.displayName || l.name, id: String(l.leaders?.[0]?.athlete?.id ?? ''), name: l.leaders?.[0]?.athlete?.shortName || l.leaders?.[0]?.athlete?.displayName || '', full: l.leaders?.[0]?.athlete?.displayName || '', headshot: freshHeadshot(l.leaders?.[0]?.athlete?.headshot?.href) || null, value: l.leaders?.[0]?.displayValue || '' }))
  );
  const injuries = (data?.injuries || []).map(t => ({ team: String(t.team?.id ?? ''), list: (t.injuries || []).map(i => ({ id: String(i.athlete?.id ?? ''), headshot: freshHeadshot(i.athlete?.headshot?.href) || null, name: i.athlete?.displayName || '', status: i.status || i.type?.description || '', detail: i.details?.type || '' })) }));
  const winProb = (data?.winprobability || []).map(w => w.homeWinPercentage).filter(x => Number.isFinite(x));
  // The season series (a playoff or a season's meetings), or soccer's
  // head-to-head (the last meetings, any competition): `h2h` with each
  // side's wins and the draws, by team id.
  const series = (data?.seasonseries || []).map(s => {
    const events = (s.events || []).map(ev => ({ id: String(ev.id), date: ev.date, score: (ev.competitors || []).map(c => `${c.team?.abbreviation || ''} ${c.score ?? ''}`).join(' · ') }));
    if (s.type !== 'head-to-head') return { summary: s.summary || s.description || '', events };
    const wins = {};
    let draws = 0;
    const done = (s.events || []).filter(ev => ev.statusType?.completed || ev.status === 'post');
    for (const ev of done) {
      const winner = (ev.competitors || []).find(c => c.winner);
      if (winner) wins[String(winner.team?.id)] = (wins[String(winner.team?.id)] || 0) + 1;
      else draws++;
    }
    return { summary: '', events, h2h: { n: done.length, wins, draws } };
  });
  const form = (data?.lastFiveGames || []).map(t => ({ team: String(t.team?.id ?? ''), games: (t.events || []).map(ev => ({ result: ev.gameResult || '', score: ev.score || '', opp: ev.opponent?.abbreviation || ev.opponent?.displayName || '', date: ev.gameDate })) }));
  const table = (data?.standings?.groups || []).flatMap(g =>
    (g.standings?.entries || []).map(en => ({ team: en.team, id: String(en.id ?? ''), stats: Object.fromEntries((en.stats || []).map(s => [s.name || s.abbreviation, s.displayValue])) }))
  );
  // Soccer has no box score: each side's players who played, from the
  // lineups' own numbers (goals, assists, shots, cards, a keeper's saves).
  if (!players.length && rosters.some(r => r.players.some(p => p.played && Object.keys(p.stats).length))) {
    const en = detectLocale() === 'en';
    const cols = [['totalGoals', '進球', 'G'], ['goalAssists', '助攻', 'A'], ['totalShots', '射門', 'SH'], ['shotsOnTarget', '射正', 'SOT'], ['foulsCommitted', '犯規', 'FC'], ['yellowCards', '黃牌', 'YC'], ['redCards', '紅牌', 'RC'], ['saves', '撲救', 'SV']];
    for (const r of rosters) {
      const rows = r.players.filter(p => p.played).map(p => ({ id: p.id, name: p.short || p.name, pos: p.pos, starter: p.starter, stats: cols.map(([k]) => p.stats[k] ?? '0') }));
      if (rows.length) players.push({ team: r.team, tables: [{ name: en ? 'Players' : '球員', labels: cols.map(c => (en ? c[2] : c[1])), rows, totals: [] }] });
    }
  }
  // Every play, the latest 80 (basketball's live feed and play-by-play).
  const feed = (data?.plays || []).slice(-80).map(p => ({ text: p.text || p.type?.text || '', period: p.period?.displayValue || (p.period?.number ? `${p.period.number}` : ''), clock: p.clock?.displayValue || '', team: String(p.team?.id ?? ''), home: p.homeScore, away: p.awayScore, scoring: Boolean(p.scoringPlay) }));
  const info = data?.gameInfo || {};
  return {
    league,
    status: parseStatus(header?.status),
    sides,
    home: sides.find(s => s.homeAway === 'home') || sides[0] || null,
    away: sides.find(s => s.homeAway === 'away') || sides[1] || null,
    byId,
    teamStats,
    players,
    plays,
    feed,
    keyEvents,
    rosters,
    leaders,
    injuries,
    winProb,
    series,
    form,
    table,
    venue: info.venue?.fullName || '',
    city: [info.venue?.address?.city, info.venue?.address?.state || info.venue?.address?.country].filter(Boolean).join(', '),
    attendance: info.attendance || null,
    officials: (info.officials || []).map(o => o.displayName || o.fullName).filter(Boolean),
    weather: info.weather ? `${info.weather.temperature ?? ''}° ${info.weather.displayValue || ''}`.trim() : ''
  };
}
export async function summary(league, id) {
  const l = LEAGUES[league];
  return parseSummary(await getJson(`${SITE}/${l.espn}/summary?event=${encodeURIComponent(id)}`, { ttl: LIVE_TTL }), league);
}

// ---- Standings ------------------------------------------------------------------------

// Groups (a league table, conferences, divisions): [{ name, rows: [{ id, name,
// logo, rank, stats: { key: value } }], columns: [key…] }].
export function parseStandings(data, league = null) {
  const groups = [];
  const walk = node => {
    if (node?.standings?.entries?.length) {
      const rows = node.standings.entries.map(en => {
        const stats = Object.fromEntries((en.stats || []).map(s => [s.abbreviation || s.name, s.displayValue]));
        // A championship of drivers (F1) has athletes where a league has teams.
        if (!en.team && en.athlete) {
          const a = en.athlete;
          // F1's drivers by their Chinese names (the lottery's), as on the race board.
          const zh = league === 'f1' && detectLocale() !== 'en' ? f1Driver(a.displayName || a.name).zh : null;
          const f1zh = zh && zh !== (a.displayName || a.name) ? zh : null;
          return { id: String(a.id ?? ''), name: f1zh || a.displayName || a.name || '', short: f1zh || a.shortName || a.displayName || '', en: a.displayName || a.name || '', logo: a.flag?.href || '', note: '', color: '', stats, athlete: true };
        }
        const row = { id: String(en.team?.id ?? ''), name: en.team?.displayName || en.team?.name || '', short: en.team?.shortDisplayName || en.team?.abbreviation || '', logo: logoOf(en.team), note: en.note?.description || '', color: en.note?.color || (en.team?.color && !en.team?.logos ? `#${en.team.color}` : ''), stats };
        // F1's constructors in Chinese (麥拉倫, 法拉利), the English kept for matching.
        if (league === 'f1' && detectLocale() !== 'en') {
          const zh = f1Constructor(row.name).zh;
          if (zh && zh !== row.name) return { ...row, en: row.name, name: zh, short: zh };
        }
        return league ? localSide(league, row) : row;
      });
      // ESPN's list can be out of order (MLB's first seed last): by its playoff seed when every team has one.
      const seeds = node.standings.entries.map(en => Number((en.stats || []).find(x => x.name === 'playoffSeed')?.value));
      const ordered = seeds.every(n => n > 0) ? rows.map((r, i) => [r, seeds[i]]).sort((x, y) => x[1] - y[1]).map(([r]) => r) : rows;
      // A championship's rounds (F1's: a column a weekend, its points, blank until counted).
      const rounds = (node.standings.entries[0]?.stats || []).filter(x => /^[A-Z]{3}$/.test(x.abbreviation || '') && /grand prix/i.test(x.displayName || '')).map(x => ({ key: x.abbreviation, name: x.displayName }));
      groups.push({ name: groupZh(node.name || node.displayName || '', detectLocale()), en: node.name || node.displayName || '', rows: ordered, ...(rounds.length ? { rounds } : {}) });
    }
    for (const child of node?.children || []) walk(child);
  };
  walk(data);
  return groups;
}
// A league's tables this season. The array carries the season's year.
export async function standings(league) {
  const l = LEAGUES[league];
  // The regular season's table: ESPN's default counts pre-season games in
  // (the NBA's in October: Toronto 0-1 before a real game).
  const regular = ['baseball', 'basketball', 'football', 'hockey'].includes(l.sport) ? '?seasontype=2' : '';
  const data = await getJson(`${STANDINGS}/${l.espn}/standings${regular}`, { ttl: 10 * 60_000 });
  const groups = withGaps(parseStandings(data, league), l.sport);
  groups.year = data?.season?.year ?? data?.children?.[0]?.standings?.season?.year ?? null;
  return groups;
}
// Which columns a table shows, by sport (only those present).
export const STANDING_COLUMNS = {
  soccer: ['GP', 'W', 'D', 'L', 'GD', 'P', 'GAP'],
  baseball: ['W', 'L', 'PCT', 'GB', 'STRK'],
  basketball: ['W', 'L', 'PCT', 'GB', 'STRK'],
  racing: ['W', 'POD', 'PTS', 'GAP']
};
// The columns that matter most on a narrow screen.
export const COMPACT_COLUMNS = {
  soccer: ['GP', 'GD', 'P', 'GAP'],
  baseball: ['W', 'L', 'PCT', 'GB'],
  basketball: ['W', 'L', 'PCT', 'GB'],
  racing: ['PTS', 'GAP']
};

// The gap to the top of each table: points behind the leader (soccer,
// racing) as GAP, and games behind (GB) where the feed leaves it out for a
// win-loss table. The leader shows "-".
const num = v => {
  const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
export function withGaps(groups, sport) {
  const pointsKey = { soccer: 'P', racing: 'PTS' }[sport];
  return (groups || []).map(g => {
    const rows = g.rows;
    if (!rows.length) return g;
    if (pointsKey) {
      const top = num(rows[0].stats[pointsKey]);
      if (top == null) return g;
      return { ...g, rows: rows.map((r, i) => ({ ...r, stats: { ...r.stats, GAP: i === 0 ? '-' : num(r.stats[pointsKey]) == null ? '' : String(Math.round((top - num(r.stats[pointsKey])) * 10) / 10) } })) };
    }
    if (['baseball', 'basketball'].includes(sport) && rows.some(r => r.stats.GB == null || r.stats.GB === '')) {
      const w0 = num(rows[0].stats.W);
      const l0 = num(rows[0].stats.L);
      if (w0 == null || l0 == null) return g;
      return {
        ...g,
        rows: rows.map((r, i) => {
          const gb = ((w0 - num(r.stats.W)) + (num(r.stats.L) - l0)) / 2;
          return { ...r, stats: { ...r.stats, GB: i === 0 || !(gb > 0) ? '-' : String(gb) } };
        })
      };
    }
    return g;
  });
}

// ---- Teams, schedules, rosters, players -------------------------------------------

export function parseTeam(data) {
  const t = data?.team || {};
  return {
    id: String(t.id ?? ''),
    name: t.displayName || '',
    short: t.shortDisplayName || t.abbreviation || '',
    abbr: t.abbreviation || '',
    logo: logoOf(t),
    color: t.color ? `#${t.color}` : null,
    record: t.record?.items?.[0]?.summary || '',
    standing: t.standingSummary || '',
    // A club's own league (a soccer club opened from a cup plays in it): its roster is that league's.
    home: t.defaultLeague?.slug || '',
    next: (t.nextEvent || []).map(e => ({ id: String(e.id), name: e.name, short: e.shortName, start: e.date }))
  };
}
// A soccer club is read across all its competitions (ESPN's "all"): its
// record and place in its own league, whichever cup it was opened from.
const clubPath = league => (LEAGUES[league].espn.startsWith('soccer/') ? 'soccer/all' : LEAGUES[league].espn);
export async function team(league, id) {
  return localSide(league, parseTeam(await getJson(`${SITE}/${clubPath(league)}/teams/${encodeURIComponent(id)}`, { ttl: 10 * 60_000 })));
}
// Orbit Sports' league for an ESPN path ("soccer/eng.1" → epl).
const BY_PATH = Object.fromEntries(Object.entries(LEAGUES).filter(([, l]) => l.espn).map(([k, l]) => [l.espn, k]));
export function parseSchedule(data, league) {
  const sport = (LEAGUES[league]?.espn || '').split('/')[0];
  return (data?.events || []).map(e => {
    const comp = e.competitions?.[0];
    // Each game in its own competition (a club's cup and European games too);
    // one Orbit Sports doesn't have (a friendly) stays under the club's league, named, never sold.
    const own = e.league?.slug ? BY_PATH[`${sport}/${e.league.slug}`] : league;
    const lg = own || league;
    const home = withLogo(lg, parseSide(comp?.competitors?.find(c => c.homeAway === 'home')));
    const away = withLogo(lg, parseSide(comp?.competitors?.find(c => c.homeAway === 'away')));
    return { id: String(e.id), league: lg, kind: 'match', name: e.name, short: e.shortName, start: e.date, status: parseStatus(comp?.status), home, away, venue: comp?.venue?.fullName || '', ...(own ? {} : { other: e.league?.name || e.league?.abbreviation || '' }) };
  });
}
// A team's season: its results and the games to come. A soccer club's across
// all its competitions: ESPN gives the results, and the fixtures on their own.
// A team's playoff games this season (ESPN's schedule in the playoffs has
// only those), or null when the league isn't in its playoffs.
export async function playoffRun(league, id) {
  if (clubPath(league) === 'soccer/all') return null;
  const data = await getJson(`${SITE}/${clubPath(league)}/teams/${encodeURIComponent(id)}/schedule`, { ttl: 10 * 60_000 });
  return data?.requestedSeason?.type === 3 ? parseSchedule(data, league).map(freshGame) : null;
}
// Out of the playoffs: its last playoff game lost and none to come.
export function knockedOut(games, id) {
  if (!games?.length) return false;
  if (games.some(g => g.status?.state !== 'post')) return false;
  const last = [...games].sort((a, b) => a.start.localeCompare(b.start)).at(-1);
  const us = [last.home, last.away].find(x => String(x?.id) === String(id));
  const them = [last.home, last.away].find(x => x && x !== us);
  return Boolean(us && them?.winner && !us.winner);
}
export async function teamSchedule(league, id) {
  const base = `${SITE}/${clubPath(league)}/teams/${encodeURIComponent(id)}/schedule`;
  if (clubPath(league) !== 'soccer/all') {
    // In the playoffs ESPN gives only the playoff games: the regular season before them too.
    const data = await getJson(base, { ttl: 10 * 60_000 });
    const earlier = data?.requestedSeason?.type === 3 ? await getJson(`${base}?seasontype=2`, { ttl: 60 * 60_000 }).catch(() => null) : null;
    const seen = new Set();
    return [...parseSchedule(earlier, league), ...parseSchedule(data, league)].filter(e => !seen.has(e.id) && seen.add(e.id)).map(freshGame).sort((a, b) => a.start.localeCompare(b.start));
  }
  const [done, next] = await Promise.all([getJson(base, { ttl: 10 * 60_000 }), getJson(`${base}?fixture=true`, { ttl: 10 * 60_000 }).catch(() => null)]);
  const seen = new Set();
  return [...parseSchedule(done, league), ...parseSchedule(next, league)].filter(e => !seen.has(e.id) && seen.add(e.id)).map(freshGame).sort((a, b) => a.start.localeCompare(b.start));
}
export function parseRoster(data) {
  const groups = Array.isArray(data?.athletes?.[0]?.items) ? data.athletes : [{ position: '', items: data?.athletes || [] }];
  return groups.map(g => ({
    name: g.position || '',
    players: (g.items || []).map(a => ({ id: String(a.id), name: a.displayName || a.fullName, jersey: a.jersey || '', pos: a.position?.abbreviation || '', age: a.age || null, headshot: freshHeadshot(a.headshot?.href) || null, injured: Boolean(a.injuries?.length) }))
  }));
}
// The squad: a soccer club's from its own league (`home`, the team's
// defaultLeague: a cup's list can be last season's).
export async function roster(league, id, home = '') {
  const path = home && LEAGUES[league].espn.startsWith('soccer/') ? `soccer/${home}` : LEAGUES[league].espn;
  return parseRoster(await getJson(`${SITE}/${path}/teams/${encodeURIComponent(id)}/roster`, { ttl: 60 * 60_000 }));
}
export function parseAthlete(data) {
  const a = data?.athlete || {};
  return {
    id: String(a.id ?? ''),
    name: a.displayName || '',
    headshot: freshHeadshot(a.headshot?.href) || null,
    jersey: a.jersey || '',
    position: a.position?.displayName || '',
    team: a.team?.displayName || '',
    teamId: String(a.team?.id ?? ''),
    teamColor: a.team?.color ? `#${a.team.color}` : '',
    age: a.age || null,
    born: a.displayDOB || '',
    dob: a.dateOfBirth || '',
    birthPlace: a.displayBirthPlace || '',
    height: a.displayHeight || '',
    weight: a.displayWeight || '',
    status: a.status?.name || '',
    injuries: (a.injuries || []).map(i => i.status || i.type?.description).filter(Boolean),
    stats: { title: a.statsSummary?.displayName || '', list: (a.statsSummary?.statistics || []).map(s => ({ label: s.shortDisplayName || s.abbreviation, name: s.displayName, value: s.displayValue, rank: s.rankDisplayValue || '' })) },
    // A driver's country.
    country: a.flag?.alt || a.citizenship || a.citizenshipCountry?.abbreviation || '',
    flag: a.flag?.href || ''
  };
}
export async function athlete(league, id) {
  return parseAthlete(await getJson(`${COMMON}/${LEAGUES[league].espn}/athletes/${encodeURIComponent(id)}`, { ttl: 60 * 60_000 }));
}
// A driver's championship this season, from the drivers' table: place,
// points, the gap, and each race's points in order ([code, points]; a race
// still to come is left out).
export function driverSeason(groups, id) {
  for (const g of groups || []) {
    const i = g.rows.findIndex(r => r.athlete && r.id === String(id));
    if (i < 0) continue;
    const r = g.rows[i];
    const races = Object.entries(r.stats)
      .filter(([k, v]) => /^[A-Z]{3}$/.test(k) && !['RK', 'PTS', 'GAP'].includes(k) && String(v ?? '').trim() !== '')
      .map(([k, v]) => [k, String(v).trim()]);
    return { pos: i + 1, points: r.stats.PTS ?? '', gap: r.stats.GAP ?? '', races, of: g.rows.length };
  }
  return null;
}
// A player's season and form: season numbers and rankings, the latest word
// on them, honours and their last games.
export function parseOverview(data) {
  const st = data?.statistics;
  const season = st?.labels?.length && st.splits?.length ? { title: st.displayName || '', rows: st.splits.map(sp => ({ name: sp.displayName, cells: (sp.stats || []).map((v, i) => ({ label: st.labels[i], value: v })) })) } : null;
  const rankings = (data?.seasonRankings?.categories || []).slice(0, 8).map(c => ({ label: c.shortDisplayName || c.displayName, value: c.displayValue, rank: c.rankDisplayValue || '' }));
  // The latest word on them (an injury, a lineup), their honours, their last
  // games with each one's numbers, and ESPN's stories about them.
  const note = data?.rotowire?.headline ? { headline: data.rotowire.headline, story: data.rotowire.story || '', date: usDate(data.rotowire.published) } : null;
  const awards = (data?.awards || []).slice(0, 8).map(w => ({ name: w.name || '', count: w.displayCount || '', seasons: w.seasons || [] })).filter(w => w.name);
  return { season, rankings, note, awards, log: parseGameLog(data?.gameLog) };
}
// "Tue Sep 29 07:02:00 PDT 2026" (RotoWire's time) as ISO, or ''.
const US_ZONES = { EDT: '-04:00', EST: '-05:00', CDT: '-05:00', CST: '-06:00', MDT: '-06:00', MST: '-07:00', PDT: '-07:00', PST: '-08:00', UTC: 'Z', GMT: 'Z' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function usDate(text) {
  const m = /^\w{3} (\w{3}) (\d{1,2}) (\d\d:\d\d:\d\d) (\w{3}) (\d{4})$/.exec(String(text || '').trim());
  if (!m || !US_ZONES[m[4]] || MONTHS.indexOf(m[1]) < 0) return '';
  const iso = `${m[5]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}T${m[3]}${US_ZONES[m[4]]}`;
  return Number.isNaN(Date.parse(iso)) ? '' : new Date(iso).toISOString();
}
// The last games (newest first): the date, the other side, the result and
// the player's numbers. ESPN repeats a soccer player's labels (one set per
// competition): only the first set.
export function parseGameLog(log) {
  const block = log?.statistics?.[0];
  if (!block?.labels?.length || !block.events?.length) return null;
  const end = block.labels.findIndex((l, i) => block.labels.indexOf(l) !== i);
  const n = end > 0 ? end : block.labels.length;
  const seen = new Set();
  const games = block.events
    .filter(x => !seen.has(x.eventId) && seen.add(x.eventId))
    .map(x => {
      const g = log.events?.[x.eventId];
      if (!g) return null;
      return { id: String(x.eventId), date: g.gameDate || '', at: g.atVs || 'vs', opp: { id: String(g.opponent?.id ?? ''), name: g.opponent?.displayName || '', abbr: g.opponent?.abbreviation || '', logo: logoOf(g.opponent) }, result: g.gameResult || '', score: g.score || '', stats: (x.stats || []).slice(0, n) };
    })
    .filter(Boolean)
    .slice(0, 5);
  return games.length ? { title: block.displayName || '', labels: block.labels.slice(0, n), games } : null;
}
export async function athleteOverview(league, id) {
  const ov = parseOverview(await getJson(`${COMMON}/${LEAGUES[league].espn}/athletes/${encodeURIComponent(id)}/overview`, { ttl: 60 * 60_000 }));
  if (ov.log) ov.log.games = ov.log.games.map(g => ({ ...g, opp: nbaLogo(league, g.opp) }));
  return ov;
}

// ---- Names, compared ---------------------------------------------------------------------

export function normalizeTeamName(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' ')
    .replace(/\b(fc|afc|cf|sc|and)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
