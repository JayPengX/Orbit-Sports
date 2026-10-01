// Sports data for Quadra Fixtures: ESPN's public site API (and Kambi's feed
// for the leagues ESPN doesn't carry), through the Quadra data proxy, which
// caches every answer for every viewer and answers signed-in apps only.
//
// Everything is normalized into a few shapes the page draws:
//
//   event   { id, league, kind, name, short, start, status, venue, tv,
//             home, away (kind 'match'), field (kind 'field'),
//             bouts (kind 'card'), draws (kind 'draw'), note }
//   side    { id, name, short, abbr, logo, color, score, winner, record,
//             lines (each period's score), rank }
//   status  { state: 'pre' | 'in' | 'post', detail, short, completed, void }
import { teamBadge, teamLogo, raceName, playerFlag, countryName, countryCode, flagUrl, f1Driver, f1Constructor } from './logos.mjs';
import { detectLocale } from './i18n.mjs';
import { liveOf, kambiLive } from './live.mjs';
import { LEAGUES } from './leagues.mjs';
import { asiaMonth, asiaMonthOf, kambiKept, CATALOG, tsdbBoxingDays, notableFight, learnFighterNations } from './catalog.mjs';
import { proxyJson } from './quadra.mjs';
import { stageFrom } from './stage.mjs';
import { teamNameZh } from './names.mjs';
import { groupZh } from './statnames.mjs';

export const SITE = 'https://site.api.espn.com/apis/site/v2/sports';
export const STANDINGS = 'https://site.api.espn.com/apis/v2/sports';
export const COMMON = 'https://site.api.espn.com/apis/common/v3/sports';
const KAMBI = 'https://eu-offering-api.kambicdn.com/offering/v2018/ub';


// ---- Fetching ------------------------------------------------------------------

// The kit's proxyJson: requests made together go as one batch, answers are
// remembered in memory and on the device (a list younger than `ttl` is
// never asked for again, even after the app was closed).
export const getJson = (url, { ttl = 60_000, trim = '' } = {}) => proxyJson(url, { ttl, trim });

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
    rank: c.curatedRank?.current && c.curatedRank.current < 99 ? c.curatedRank.current : null,
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
const HEADSHOTS = { racing: 'rpm', tennis: 'tennis', golf: 'golf', mma: 'mma' };
export function fallbackLogo(league, side) {
  if (!side || side.logo) return side?.logo || null;
  // The shared kit's (Quadra Play's) logo for the club.
  const kit = teamLogo(LEAGUES[league]?.play || league, side.name);
  if (kit || !side.id) return kit;
  const path = LEAGUES[league]?.espn || '';
  const [sport, code] = path.split('/');
  if (side.athlete) return HEADSHOTS[sport] ? `${CDN}/headshots/${HEADSHOTS[sport]}/players/full/${side.id}.png` : null;
  if (sport === 'soccer') return `${CDN}/teamlogos/soccer/500/${side.id}.png`;
  if (/college/.test(code || '')) return `${CDN}/teamlogos/ncaa/500/${side.id}.png`;
  if (['nba', 'wnba', 'nfl', 'mlb', 'nhl'].includes(code) && side.abbr) return `${CDN}/teamlogos/${code}/500/${side.abbr.toLowerCase()}.png`;
  return null;
}
// A team's name in the reader's language: Chinese from the kit's names
// (lib/names.mjs) when it has the team, the English kept as `en` (Play's ids
// and the matching use it). People (players, drivers) keep their names.
export function localSide(league, side, lang = detectLocale()) {
  if (!side || lang === 'en' || side.athlete || LEAGUES[league]?.players) return side;
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

// A race weekend's sessions by their feed code. The ones that count
// (qualifying, the sprint's qualifying, the sprint, the race) are listed as
// events of their own; practice stays inside the weekend.
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
const MAIN_SESSIONS = ['SS', 'SQ', 'SR', 'Qual', 'Race'];
export const sessionName = (x, lang = 'zh', short = false) => {
  const n = SESSION_NAMES[x?.abbr];
  if (!n) return x?.name || x?.abbr || '';
  return short ? n.short[lang === 'en' ? 'en' : 'zh'] : n[lang === 'en' ? 'en' : 'zh'];
};
// A race weekend as its main sessions, each an event (the weekend's other
// fields kept, so its sheet opens on that session). Anything else as it is.
export function splitWeekend(e, now = Date.now(), lang = 'zh') {
  if (e?.kind !== 'field' || LEAGUES[e.league]?.sport !== 'racing' || e.sessionKey) return [e];
  const main = (e.sessions || []).filter(x => x.start && MAIN_SESSIONS.includes(x.abbr));
  if (main.length < 2) return [settleField(e, now)];
  return main.map(x => {
    // The feed can leave a session "on" (or "to come") long after it ended.
    const done = Date.parse(x.start) + SESSION_MS < now;
    const status = done && x.status.state !== 'post' ? { ...x.status, state: 'post', completed: true } : x.status;
    return { ...e, id: `${e.id}~${x.abbr}`, weekend: e.id, start: x.start, at: x.start, end: null, session: sessionName(x, lang), sessionKey: x.abbr, status };
  });
}

// A playoff series: its summary ("LAL lead series 2-1") and each side's wins.
export function parseSeries(s) {
  if (!s || s.type !== 'playoff') return null;
  return { summary: s.summary || '', completed: Boolean(s.completed), games: s.totalCompetitions || 0, wins: Object.fromEntries((s.competitors || []).map(c => [String(c.id), c.wins ?? 0])) };
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
      stage: stageFrom({ seasonType: e.season?.type, seasonSlug: e.season?.slug, typeAbbr: comp?.type?.abbreviation, note: comp?.notes?.[0]?.headline || '', name: e.name, cup: LEAGUES[league]?.cup })
    };
    if (kind === 'match' && comp) {
      const home = parseSide(comp.competitors?.find(c => c.homeAway === 'home') || comp.competitors?.[0]);
      const away = parseSide(comp.competitors?.find(c => c.homeAway === 'away') || comp.competitors?.[1]);
      if (!home || !away) continue;
      out.push({ ...base, home: withLogo(league, home), away: withLogo(league, away), neutral: Boolean(comp.neutralSite), situation: comp.situation?.lastPlay?.text || '', live: base.status.state === 'in' ? liveOf(comp, e.status || comp.status, LEAGUES[league]?.sport) : null });
    } else if (kind === 'draw') {
      // A tennis tournament: its singles draws' matches.
      const draws = (e.groupings || []).map(g => ({
        name: g.grouping?.displayName || '',
        matches: (g.competitions || []).map(m => ({
          id: String(m.id),
          round: m.round?.displayName || m.type?.text || '',
          start: m.date || m.startDate,
          status: parseStatus(m.status),
          a: withLogo(league, parseSide(m.competitors?.[0])),
          b: withLogo(league, parseSide(m.competitors?.[1]))
        }))
      }));
      out.push({ ...base, draws });
    } else if (kind === 'card') {
      const bouts = (e.competitions || []).map(m => ({
        id: String(m.id),
        weight: m.type?.text || m.note || '',
        start: m.date,
        status: parseStatus(m.status),
        a: withLogo(league, parseSide(m.competitors?.[0])),
        b: withLogo(league, parseSide(m.competitors?.[1]))
      }));
      out.push({ ...base, bouts });
    } else {
      // A race weekend (its sessions) or a tournament: each competition's
      // field in finishing order.
      const sessions = (e.competitions || []).map(m => ({
        id: String(m.id),
        name: m.type?.text || m.type?.abbreviation || '',
        abbr: m.type?.abbreviation || '',
        start: m.date,
        status: parseStatus(m.status),
        field: [...(m.competitors || [])].sort((a, b) => (a.order ?? 999) - (b.order ?? 999)).map(c => withLogo(league, parseSide(c)))
      }));
      out.push({ ...base, sessions });
    }
  }
  return out;
}

export async function scoreboard(league, dates) {
  const l = LEAGUES[league];
  if (l?.kambi) return kambiEvents(league);
  if (l?.asia) return asiaEvents(league);
  if (l?.motogp) return motogpEvents();
  if (l?.tsdb) return tsdbRaceEvents(league);
  if (l?.fom) return fomRaceEvents(league);
  const list = [].concat(dates || []);
  const pages = list.length ? await Promise.all(list.map(d => getJson(`${SITE}/${l.espn}/scoreboard?dates=${d}&limit=200`, { ttl: 20_000 }).catch(() => null))) : [await getJson(`${SITE}/${l.espn}/scoreboard`, { ttl: 20_000 })];
  const seen = new Set();
  return pages
    .filter(Boolean)
    .flatMap(p => parseScoreboard(p, league))
    .filter(e => !seen.has(e.id) && seen.add(e.id));
}

// A whole season of a race series, tour or fight promotion (ESPN answers
// `dates=<year>` with every event of that year): past results and every
// future event, not only the current one. Late in the year, next year's too.
export async function seasonEvents(league, now = Date.now()) {
  const l = LEAGUES[league];
  if (l?.kambi) return kambiEvents(league);
  if (l?.asia) return asiaEvents(league);
  if (l?.motogp) return motogpEvents(now);
  if (l?.tsdb) return tsdbRaceEvents(league, now);
  if (l?.fom) return fomRaceEvents(league, now);
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

// ---- The season's calendar: which days (or weeks) a league plays -------------------
//
// ESPN's scoreboard carries the season's calendar: for most leagues the US
// dates with games (a whitelist), for MLB the days without (a blacklist
// between the season's start and end), for American football its weeks.
// { days: ['YYYYMMDD'…] } or { weeks: [{ label, seasontype, week, start, end }] }, or
// null when there's none.
export function parseCalendar(data) {
  const l = data?.leagues?.[0];
  const cal = l?.calendar;
  if (!Array.isArray(cal) || !cal.length) return null;
  const us = iso => String(iso).slice(0, 10).replaceAll('-', '');
  // A cup's or the national teams' calendar: its stages ("League Phase",
  // "Round of 16"), neither days nor weeks; its games come from month pages
  // (the default page can be a round long past).
  if (typeof cal[0] === 'object' && cal[0].value == null) return { months: true };
  if (typeof cal[0] === 'object') {
    const weeks = cal.flatMap(type =>
      (type.entries || []).map(w => ({ label: w.label || w.alternateLabel || '', detail: w.detail || '', seasontype: String(type.value), week: String(w.value), start: w.startDate, end: w.endDate }))
    );
    return weeks.length ? { weeks } : null;
  }
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
export async function seasonCalendar(league) {
  const l = LEAGUES[league];
  if (!l?.espn) return null;
  return parseCalendar(await getJson(`${SITE}/${l.espn}/scoreboard`, { ttl: 20_000 }));
}
export async function weekScoreboard(league, seasontype, week) {
  const l = LEAGUES[league];
  const data = await getJson(`${SITE}/${l.espn}/scoreboard?seasontype=${seasontype}&week=${week}&limit=300`, { ttl: 20_000 });
  return parseScoreboard(data, league);
}

// ---- Kambi (EuroLeague, B.League, badminton, table tennis, volleyball, snooker) --------

export function parseKambi(data, league) {
  const out = [];
  for (const item of data?.events || []) {
    const e = item.event;
    if (!e?.homeName || !e?.awayName || !kambiKept(league, e)) continue;
    const live = item.liveData;
    const state = e.state === 'STARTED' ? 'in' : e.state === 'FINISHED' ? 'post' : 'pre';
    // Set scores (tennis, volleyball…) or, for baseball, the innings in the score's info ("1-0 | 0-2 | …").
    const info = String(live?.score?.info || '').split('|').map(x => x.trim().split('-'));
    const innings = info.length > 1 && info.every(x => x.length === 2) ? { home: info.map(x => x[0]), away: info.map(x => x[1]) } : null;
    const sets = live?.statistics?.sets;
    // Players: their nation's flag (the kit's table, else the country the event is filed under).
    const where = [e.group, ...(e.path || []).map(p => (typeof p === 'string' ? p : p?.termKey))].filter(Boolean);
    const side = (name, key) => ({
      id: name,
      name,
      short: name,
      abbr: name.slice(0, 3).toUpperCase(),
      // Players their nation's flag; clubs their badge; a national side (rugby) its flag.
      logo: LEAGUES[league]?.players ? playerFlag(name, where) || teamBadge(LEAGUES[league]?.play || league, name) : teamBadge(LEAGUES[league]?.play || league, name) || flagUrl(countryCode(name)),
      color: null,
      score: live?.score?.[key] ?? '',
      winner: false,
      record: '',
      rank: null,
      lines: sets ? sets[key].filter(x => x >= 0).map(String) : innings ? innings[key] : [],
      homeAway: key
    });
    out.push({
      id: `k${e.id}`,
      league,
      kind: 'match',
      name: `${e.awayName} @ ${e.homeName}`,
      short: e.name,
      start: e.start,
      status: { state, detail: state === 'in' ? live?.matchClock?.minute != null ? `${live.matchClock.minute}'` : '' : '', short: '', completed: state === 'post', void: false },
      venue: '',
      tv: '',
      note: e.group || '',
      home: localSide(league, side(e.homeName, 'home')),
      away: localSide(league, side(e.awayName, 'away')),
      live: state === 'in' ? kambiLive(live, LEAGUES[league]?.sport) : null,
      kambi: true
    });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}
export async function kambiEvents(league) {
  const parts = LEAGUES[league].kambi.split('/');
  while (parts.length < 4) parts.push('all');
  const data = await getJson(`${KAMBI}/listView/${parts.join('/')}/matches.json?lang=en_GB&market=GB&useCombined=true`, { ttl: 60_000, trim: 'kambi-events' });
  const events = parseKambi(data, league);
  return CATALOG[league]?.notable ? notableOnly(events) : events;
}
// Boxing: only the bouts on a card TheSportsDB lists (the main events), by
// the fight's day and the day before (Taiwan's dates; a night card runs past midnight).
async function notableOnly(events) {
  const day = ms => new Date(ms + 8 * 3_600_000).toISOString().slice(0, 10);
  const dayOf = e => [day(Date.parse(e.start)), day(Date.parse(e.start) - 86_400_000)];
  const cards = await tsdbBoxingDays([...new Set(events.flatMap(dayOf))].slice(0, 16)).catch(() => ({}));
  const kept = events.filter(e => dayOf(e).some(d => notableFight(e.home.id, e.away.id, cards[d])));
  // The fighters' flags: their nations looked up (once a month), then the pictures again.
  await Promise.race([learnFighterNations(kept.flatMap(e => [e.home.id, e.away.id])), new Promise(r => setTimeout(r, 2_500))]);
  for (const e of kept) for (const side of [e.home, e.away]) side.logo ||= playerFlag(side.id);
  return kept;
}

// ---- MotoGP (the series' own results API, through the proxy) -------------------------
//
// The season's Grands Prix (one call), each a race weekend; the ones within
// ten days get their sessions (practice, qualifying, the sprint, the race)
// and, once run, the order. The session codes as F1's: Q2 is the
// qualifying that sets the grid, SPR the sprint, RAC the race.
const MOTOGP = 'https://api.motogp.pulselive.com/motogp/v1';
const MOTOGP_CLASS = 'e8c110ad-64aa-4e8e-8a86-f2f152f6a942';
const MOTOGP_SESSION = { RAC: 'Race', SPR: 'SR', Q2: 'Qual' };
const MOTOGP_ZH = { CAT: '加泰隆尼亞', ARA: '亞拉岡', RSM: '聖馬利諾', VAL: '瓦倫西亞', AME: '美洲', EMI: '艾米利亞' };
const stateOf = st => (/FINISHED|COMPLETED/i.test(st || '') ? 'post' : /STARTED|RUNNING|LIVE|IN.?PROGRESS/i.test(st || '') && !/NOT/i.test(st || '') ? 'in' : 'pre');
const plainStatus = state => ({ state, detail: '', short: '', completed: state === 'post', void: false, delayed: false, name: '', clock: '', period: 0 });
const titleCase = t => String(t || '').toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
export function parseMotoGpEvents(list) {
  return (list || [])
    .filter(x => !x.test && x.date_start)
    .map(x => ({
      id: `mgp${x.id}`,
      uuid: x.id,
      league: 'motogp',
      kind: 'field',
      // "日本站", "Japanese GP": the country (San Marino's and Aragon's by their own names).
      name: detectLocale() === 'en' ? `${titleCase(x.name).replace(/^Grand Prix (Of|De) (The )?/, '')} GP` : `${MOTOGP_ZH[x.short_name] || countryName(x.country?.name, 'zh')}站`,
      enName: titleCase(x.sponsored_name || x.name),
      short: x.short_name || '',
      start: `${x.date_start}T00:00:00Z`,
      end: x.date_end ? `${x.date_end}T23:59:00Z` : null,
      status: plainStatus(stateOf(x.status)),
      venue: x.circuit?.name || '',
      tv: '',
      note: '',
      series: null,
      stage: null,
      sessions: []
    }))
    .sort((a, b) => a.start.localeCompare(b.start));
}
export function parseMotoGpSessions(list) {
  return (list || [])
    .filter(x => MOTOGP_SESSION[x.type + (x.number || '')] || MOTOGP_SESSION[x.type])
    .map(x => {
      const code = x.type === 'Q' ? `Q${x.number}` : x.type;
      return { id: x.id, abbr: MOTOGP_SESSION[code] || code, name: code, start: x.date, status: plainStatus(stateOf(x.status)), field: [] };
    })
    .filter(x => ['Race', 'SR', 'Qual'].includes(x.abbr));
}
export const parseMotoGpOrder = data =>
  (data?.classification || []).map(c => ({ id: c.rider?.riders_api_uuid || c.rider?.id || '', name: c.rider?.full_name || '', short: c.rider?.full_name || '', athlete: true, flag: c.rider?.country?.iso ? flagUrl(c.rider.country.iso) : '', logo: '', score: c.points ? `${c.points} 分` : c.time || c.gap?.first || '', team: c.team?.name || '' }));
async function motogpEvents(now = Date.now()) {
  const seasons = await getJson(`${MOTOGP}/results/seasons`, { ttl: 24 * 3_600_000 });
  const season = (seasons || []).find(x => x.current) || seasons?.[0];
  if (!season) return [];
  const events = parseMotoGpEvents(await getJson(`${MOTOGP}/results/events?seasonUuid=${season.id}`, { ttl: 30 * 60_000 }));
  const near = events.filter(e => Math.abs(Date.parse(e.start) - now) < 10 * 86_400_000);
  await Promise.all(
    near.map(async e => {
      e.sessions = parseMotoGpSessions(await getJson(`${MOTOGP}/results/sessions?eventUuid=${e.uuid}&categoryUuid=${MOTOGP_CLASS}`, { ttl: 5 * 60_000 }).catch(() => []));
      await Promise.all(e.sessions.filter(x => x.status.state !== 'pre').map(async x => (x.field = parseMotoGpOrder(await getJson(`${MOTOGP}/results/session/${x.id}/classification?test=false`, { ttl: 60_000 }).catch(() => null)))));
      if (e.sessions.length) e.start = e.sessions[0].start;
    })
  );
  return events;
}

// ---- Formula E (TheSportsDB's calendar, open to browsers) ------------------------------
//
// One entry per session ("Jeddah ePrix Qualifying"), grouped by round into
// race weekends; a time of exactly midnight is TheSportsDB's "not known yet".
const TSDB = 'https://www.thesportsdb.com/api/v1/json/3';
const FE_SESSION = [
  [/qualifying/i, 'Qual'],
  [/race|e-?prix$/i, 'Race']
];
export function parseTsdbRaces(list, league) {
  const rounds = new Map();
  for (const x of list || []) {
    const abbr = /practice/i.test(x.strEvent) ? null : FE_SESSION.find(([re]) => re.test(x.strEvent))?.[1];
    if (!abbr) continue;
    const key = `${x.strSeason}-${x.intRound}-${String(x.strEvent).replace(/\s+(qualifying|race).*$/i, '')}`;
    if (!rounds.has(key)) rounds.set(key, { round: x.intRound, name: String(x.strEvent).replace(/\s+(qualifying|race).*$/i, ''), venue: x.strVenue || '', sessions: [] });
    const at = x.strTimestamp ? `${x.strTimestamp.replace(/\+00:00$/, '')}Z` : `${x.dateEvent}T00:00:00Z`;
    const state = /finished|FT|match finished/i.test(x.strStatus || '') || x.intHomeScore != null ? 'post' : 'pre';
    rounds.get(key).sessions.push({ id: String(x.idEvent), abbr, name: abbr, start: at, status: plainStatus(state), field: [], tbc: /T00:00:00/.test(at) });
  }
  return [...rounds.values()]
    .map(r => {
      const sessions = r.sessions.sort((a, b) => a.start.localeCompare(b.start));
      const done = sessions.length && sessions.every(x => x.status.state === 'post');
      return { id: `fe${sessions[0].id}`, tbc: sessions.every(x => x.tbc), league, kind: 'field', name: r.name, enName: r.name, short: '', start: sessions[0].start, end: sessions.at(-1).start, status: plainStatus(done ? 'post' : 'pre'), venue: r.venue, tv: '', note: '', series: null, stage: null, sessions };
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}
async function tsdbRaceEvents(league, now = Date.now()) {
  const y = new Date(now).getUTCFullYear();
  const seasons = [`${y - 1}-${y}`, `${y}-${y + 1}`];
  const lists = await Promise.all(seasons.map(sn => fetch(`${TSDB}/eventsseason.php?id=${LEAGUES[league].tsdb}&s=${sn}`).then(r => (r.ok ? r.json() : null)).catch(() => null)));
  return parseTsdbRaces(lists.flatMap(d => d?.events || []), league);
}

// ---- F2, F3 (their own sites, through the proxy: trimFom) ------------------------------
//
// The season's rounds from the calendar page; each weekend's session times
// from its own page, read for the rounds from ten days back to six weeks on
// (the others show by their dates, times to come).
const FOM_SESSION = [
  [/feature/i, 'Race', { zh: '正賽', en: 'Feature race' }],
  [/sprint/i, 'SR', { zh: '衝刺賽', en: 'Sprint race' }],
  [/qualif/i, 'Qual', { zh: '排位賽', en: 'Qualifying' }],
  [/practice/i, 'FP', { zh: '練習賽', en: 'Practice' }]
];
const FOM_MONTHS = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
// "06 - 08 MAR", "29 MAY - 01 JUN": the first and last day (UTC noon).
export function fomDates(text, year) {
  const m = /(\d{1,2})\s*([A-Z]{3})?\s*-\s*(\d{1,2})\s*([A-Z]{3})/i.exec(String(text || ''));
  if (!m) return null;
  const endMonth = FOM_MONTHS[m[4].toUpperCase()];
  const startMonth = m[2] ? FOM_MONTHS[m[2].toUpperCase()] : endMonth;
  if (startMonth == null || endMonth == null) return null;
  return { from: Date.UTC(year, startMonth, Number(m[1]), 12), to: Date.UTC(year, endMonth, Number(m[3]), 12) };
}
export function parseFomRound(meeting, sessions, league, year, lang = detectLocale()) {
  const dates = fomDates(meeting.dates, year);
  const list = (sessions || [])
    .map((x, i) => {
      const kind = FOM_SESSION.find(([re]) => re.test(`${x.short} ${x.name}`));
      if (!kind || !x.start) return null;
      const state = /complete|finished|ended/i.test(x.state) ? 'post' : /live|started|running/i.test(x.state) ? 'in' : 'pre';
      return { id: `${league}-${year}-${meeting.round}-${i}`, abbr: kind[1], name: kind[2][lang === 'en' ? 'en' : 'zh'], start: x.start, status: plainStatus(state), field: [], tbc: false };
    })
    .filter(Boolean)
    .sort((a, b) => a.start.localeCompare(b.start));
  const start = list[0]?.start || (dates ? new Date(dates.from).toISOString() : null);
  if (!start) return null;
  const end = list.at(-1)?.start || (dates ? new Date(dates.to).toISOString() : start);
  const done = meeting.status === 'completed' || (list.length > 0 && list.every(x => x.status.state === 'post')) || (dates && dates.to < Date.now() - 86_400_000);
  const name = meeting.place || meeting.name;
  return { id: `${league}-${year}-${meeting.round}`, tbc: !list.length, league, kind: 'field', name, enName: name, short: meeting.round ? `R${meeting.round}` : '', start, end, status: plainStatus(done ? 'post' : list.some(x => x.status.state === 'in') ? 'in' : 'pre'), venue: meeting.place || '', tv: '', note: '', series: null, stage: null, sessions: list };
}
async function fomRaceEvents(league, now = Date.now()) {
  const host = LEAGUES[league].fom;
  const year = new Date(now).getUTCFullYear();
  const cal = await getJson(`https://${host}/en/racing/${year}`, { ttl: 6 * 3_600_000 }).catch(() => null);
  const meetings = cal?.meetings || [];
  const near = meetings.filter(m => {
    const d = fomDates(m.dates, year);
    return d && d.to > now - 10 * 86_400_000 && d.from < now + 42 * 86_400_000;
  });
  const sessions = new Map(await Promise.all(near.map(async m => [m.url, (await getJson(`https://${host}${m.url}`, { ttl: 3_600_000 }).catch(() => null))?.sessions || []])));
  return meetings
    .map(m => parseFomRound(m, sessions.get(m.url), league, year))
    .filter(Boolean)
    .sort((a, b) => a.start.localeCompare(b.start));
}

// ---- NPB, KBO, CPBL (the leagues' own sites, through the proxy) -----------------------

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
// The months around now (and `extra` more either side): a whole round of the
// season, past games and the next ones.
export async function asiaEvents(league, extra = 0, now = Date.now()) {
  const [y, m] = asiaMonthOf(now).split('-').map(Number);
  const months = [];
  for (let d = -1 - extra; d <= 1 + extra; d++) months.push(new Date(Date.UTC(y, m - 1 + d, 1)).toISOString().slice(0, 7));
  const lists = await Promise.all(months.map(m => asiaMonth(url => getJson(url, { ttl: 60_000 }), LEAGUES[league].asia, m).catch(() => [])));
  const seen = new Set();
  return parseAsia(lists.flat(), league)
    .filter(e => !seen.has(e.id) && seen.add(e.id))
    .sort((a, b) => a.start.localeCompare(b.start));
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
    players: (r.roster || []).map(x => ({ id: String(x.athlete?.id ?? ''), name: x.athlete?.displayName || '', headshot: freshHeadshot(x.athlete?.headshot?.href) || null, jersey: x.jersey || '', pos: x.position?.abbreviation || '', starter: Boolean(x.starter) }))
  }));
  const leaders = (data?.leaders || []).flatMap(t =>
    (t.leaders || []).map(l => ({ team: String(t.team?.id ?? ''), stat: l.displayName || l.name, id: String(l.leaders?.[0]?.athlete?.id ?? ''), name: l.leaders?.[0]?.athlete?.shortName || l.leaders?.[0]?.athlete?.displayName || '', full: l.leaders?.[0]?.athlete?.displayName || '', headshot: freshHeadshot(l.leaders?.[0]?.athlete?.headshot?.href) || null, value: l.leaders?.[0]?.displayValue || '' }))
  );
  const injuries = (data?.injuries || []).map(t => ({ team: String(t.team?.id ?? ''), list: (t.injuries || []).map(i => ({ id: String(i.athlete?.id ?? ''), headshot: freshHeadshot(i.athlete?.headshot?.href) || null, name: i.athlete?.displayName || '', status: i.status || i.type?.description || '', detail: i.details?.type || '' })) }));
  const winProb = (data?.winprobability || []).map(w => w.homeWinPercentage).filter(x => Number.isFinite(x));
  const series = (data?.seasonseries || []).map(s => ({ summary: s.summary || s.description || '', events: (s.events || []).map(ev => ({ id: String(ev.id), date: ev.date, score: (ev.competitors || []).map(c => `${c.team?.abbreviation || ''} ${c.score ?? ''}`).join(' · ') })) }));
  const form = (data?.lastFiveGames || []).map(t => ({ team: String(t.team?.id ?? ''), games: (t.events || []).map(ev => ({ result: ev.gameResult || '', score: ev.score || '', opp: ev.opponent?.abbreviation || ev.opponent?.displayName || '', date: ev.gameDate })) }));
  const table = (data?.standings?.groups || []).flatMap(g =>
    (g.standings?.entries || []).map(en => ({ team: en.team, id: String(en.id ?? ''), stats: Object.fromEntries((en.stats || []).map(s => [s.name || s.abbreviation, s.displayValue])) }))
  );
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
  return parseSummary(await getJson(`${SITE}/${l.espn}/summary?event=${encodeURIComponent(id)}`, { ttl: 20_000 }), league);
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
      groups.push({ name: groupZh(node.name || node.displayName || '', detectLocale()), en: node.name || node.displayName || '', rows });
    }
    for (const child of node?.children || []) walk(child);
  };
  walk(data);
  return groups;
}
export async function standings(league) {
  const l = LEAGUES[league];
  return withGaps(parseStandings(await getJson(`${STANDINGS}/${l.espn}/standings`, { ttl: 10 * 60_000 }), league), l.sport);
}
// Which columns a table shows, by sport (only those present).
export const STANDING_COLUMNS = {
  soccer: ['GP', 'W', 'D', 'L', 'GD', 'P', 'GAP'],
  baseball: ['W', 'L', 'PCT', 'GB', 'STRK'],
  basketball: ['W', 'L', 'PCT', 'GB', 'STRK'],
  football: ['W', 'L', 'T', 'PCT', 'GB', 'STRK'],
  hockey: ['GP', 'W', 'L', 'OTL', 'PTS', 'GAP'],
  rugby: ['GP', 'W', 'L', 'PTS', 'GAP'],
  racing: ['PTS', 'GAP']
};
// The columns that matter most on a narrow screen.
export const COMPACT_COLUMNS = {
  soccer: ['GP', 'GD', 'P', 'GAP'],
  baseball: ['W', 'L', 'PCT', 'GB'],
  basketball: ['W', 'L', 'PCT', 'GB'],
  football: ['W', 'L', 'PCT', 'GB'],
  hockey: ['GP', 'PTS', 'GAP'],
  rugby: ['GP', 'PTS', 'GAP'],
  racing: ['PTS', 'GAP']
};

// The gap to the top of each table: points behind the leader (soccer,
// hockey, rugby, racing…) as GAP, and games behind (GB) where the feed
// leaves it out for a win-loss table (American football). The leader shows
// "-".
const num = v => {
  const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
export function withGaps(groups, sport) {
  const pointsKey = { soccer: 'P', hockey: 'PTS', rugby: 'PTS', racing: 'PTS' }[sport];
  return (groups || []).map(g => {
    const rows = g.rows;
    if (!rows.length) return g;
    if (pointsKey) {
      const top = num(rows[0].stats[pointsKey]);
      if (top == null) return g;
      return { ...g, rows: rows.map((r, i) => ({ ...r, stats: { ...r.stats, GAP: i === 0 ? '-' : num(r.stats[pointsKey]) == null ? '' : String(Math.round((top - num(r.stats[pointsKey])) * 10) / 10) } })) };
    }
    if (['baseball', 'basketball', 'football'].includes(sport) && rows.some(r => r.stats.GB == null || r.stats.GB === '')) {
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
// Fixtures' league for an ESPN path ("soccer/eng.1" → epl).
const BY_PATH = Object.fromEntries(Object.entries(LEAGUES).filter(([, l]) => l.espn).map(([k, l]) => [l.espn, k]));
export function parseSchedule(data, league) {
  const sport = (LEAGUES[league]?.espn || '').split('/')[0];
  return (data?.events || []).map(e => {
    const comp = e.competitions?.[0];
    // Each game in its own competition (a club's cup and European games too);
    // one Fixtures doesn't have (a friendly) stays under the club's league, named, never sold.
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
  return data?.requestedSeason?.type === 3 ? parseSchedule(data, league) : null;
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
    return [...parseSchedule(earlier, league), ...parseSchedule(data, league)].filter(e => !seen.has(e.id) && seen.add(e.id)).sort((a, b) => a.start.localeCompare(b.start));
  }
  const [done, next] = await Promise.all([getJson(base, { ttl: 10 * 60_000 }), getJson(`${base}?fixture=true`, { ttl: 10 * 60_000 }).catch(() => null)]);
  const seen = new Set();
  return [...parseSchedule(done, league), ...parseSchedule(next, league)].filter(e => !seen.has(e.id) && seen.add(e.id)).sort((a, b) => a.start.localeCompare(b.start));
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
    teamLogo: logoOf(a.team),
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
    // Individual sports: the country, and what each sport adds.
    country: a.flag?.alt || a.citizenship || a.citizenshipCountry?.abbreviation || '',
    flag: a.flag?.href || '',
    hand: a.hand?.displayValue || '',
    turnedPro: a.turnedPro || a.debutYear || '',
    weightClass: a.weightClass?.text || '',
    stance: a.stance?.text || '',
    record: (a.statsSummary?.statistics || []).find(s => /wins-losses/i.test(s.displayName || ''))?.displayValue || ''
  };
}
export async function athlete(league, id) {
  return parseAthlete(await getJson(`${COMMON}/${LEAGUES[league].espn}/athletes/${encodeURIComponent(id)}`, { ttl: 60 * 60_000 }));
}
// A tour's world ranking (tennis): [{ id, rank, previous, points, name }].
export function parseRankings(data) {
  return (data?.rankings?.[0]?.ranks || []).map(r => ({ id: String(r.athlete?.id ?? ''), name: r.athlete?.displayName || '', rank: r.current, previous: r.previous, points: r.points }));
}
export async function rankings(league) {
  return parseRankings(await getJson(`${SITE}/${LEAGUES[league].espn}/rankings`, { ttl: 6 * 60 * 60_000 }));
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
// A player's matches this season (tennis draws, fight cards): the latest
// first, with the round, the other side, won or lost, and the score.
export function playerMatches(events, id) {
  const out = [];
  for (const e of events || []) {
    const pairs = e.kind === 'draw' ? (e.draws || []).flatMap(d => d.matches.map(m => ({ ...m, draw: d.name }))) : e.kind === 'card' ? (e.bouts || []).map(b => ({ ...b, round: b.weight })) : [];
    for (const m of pairs) {
      const [me, them] = m.a?.id === String(id) ? [m.a, m.b] : m.b?.id === String(id) ? [m.b, m.a] : [];
      if (!me) continue;
      out.push({ event: e.name, eventId: e.id, start: m.start || e.start, round: m.round || '', draw: m.draw || '', status: m.status, opp: them, won: m.status?.state === 'post' ? Boolean(me.winner) : null, score: (me.lines || []).map((x, i) => `${x}-${them?.lines?.[i] ?? ''}`).join(' ') });
    }
  }
  return out.sort((a, b) => String(b.start).localeCompare(String(a.start)));
}
// An individual's season and form (golf, tennis, racing, fighting): season
// numbers, rankings, the next and last events.
export function parseOverview(data) {
  const st = data?.statistics;
  const season = st?.labels?.length && st.splits?.length ? { title: st.displayName || '', rows: st.splits.map(sp => ({ name: sp.displayName, cells: (sp.stats || []).map((v, i) => ({ label: st.labels[i], value: v })) })) } : null;
  const rankings = (data?.seasonRankings?.categories || []).slice(0, 8).map(c => ({ label: c.shortDisplayName || c.displayName, value: c.displayValue, rank: c.rankDisplayValue || '' }));
  const fight = data?.upcomingFight?.league?.events?.[0];
  const recent = (data?.recentTournaments?.[0]?.eventsStats || []).slice(0, 6).map(ev => ({ id: String(ev.id), name: ev.name, date: ev.date, score: ev.competitions?.[0]?.competitors?.[0]?.score?.displayValue || '', place: ev.competitions?.[0]?.competitors?.[0]?.status?.position?.displayName || '' }));
  // The latest word on them (an injury, a lineup), their honours, their last
  // games with each one's numbers, and ESPN's stories about them.
  const note = data?.rotowire?.headline ? { headline: data.rotowire.headline, story: data.rotowire.story || '', date: usDate(data.rotowire.published) } : null;
  const awards = (data?.awards || []).slice(0, 8).map(w => ({ name: w.name || '', count: w.displayCount || '', seasons: w.seasons || [] })).filter(w => w.name);
  return { season, rankings, fight: fight ? { title: data.upcomingFight.displayName || '', name: fight.name, date: fight.date, where: fight.location || '' } : null, recent, note, awards, log: parseGameLog(data?.gameLog) };
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
// A player's photo from TheSportsDB (ESPN has none for footballers): the
// cut-out, else the portrait, when the name and the sport match. Open to
// browsers (CORS), so not through the proxy.
const SPORTSDB_SPORT = { soccer: 'Soccer', basketball: 'Basketball', baseball: 'Baseball', football: 'American Football', hockey: 'Ice Hockey', racing: 'Motorsport', tennis: 'Tennis', golf: 'Golf', mma: 'Fighting' };
const photos = new Map();
export function pickPhoto(data, name, sport) {
  const want = normalizeTeamName(name);
  const p = (data?.player || []).find(x => normalizeTeamName(x.strPlayer) === want && (!SPORTSDB_SPORT[sport] || x.strSport === SPORTSDB_SPORT[sport]));
  return p?.strCutout || p?.strThumb || null;
}
export function playerPhoto(name, sport) {
  if (!name) return Promise.resolve(null);
  const key = `${sport}|${name}`;
  if (!photos.has(key))
    photos.set(
      key,
      fetch(`https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(name)}`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => pickPhoto(d, name, sport))
        .catch(() => null)
    );
  return photos.get(key);
}
export async function athleteOverview(league, id) {
  return parseOverview(await getJson(`${COMMON}/${LEAGUES[league].espn}/athletes/${encodeURIComponent(id)}/overview`, { ttl: 60 * 60_000 }));
}

// ---- Quadra Play's id for a match (its "bet on this" link) ---------------------------------

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
// Play's own id for the same match: league, the start's UTC hour, the two sides.
// A bout or a draw's match in Play (players, in either order there): its id from the two names.
export function playPairId(league, start, a, b) {
  const key = LEAGUES[league]?.play;
  if (!key || !start || !a?.name || !b?.name) return null;
  return `${key}_${new Date(start).toISOString().slice(0, 13)}_${normalizeTeamName(a.en || a.name)}_${normalizeTeamName(b.en || b.name)}`.replaceAll(' ', '');
}
export function playGameId(event) {
  const key = LEAGUES[event.league]?.play;
  if (!key || event.kind !== 'match' || !event.home || !event.away) return null;
  return `${key}_${new Date(event.start).toISOString().slice(0, 13)}_${normalizeTeamName(event.away.en || event.away.name)}_${normalizeTeamName(event.home.en || event.home.name)}`.replaceAll(' ', '');
}
