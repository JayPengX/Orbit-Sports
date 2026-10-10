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
import { cpblBoxUrl, cpblSummary } from './cpblbox.mjs';
import { teamBadge, teamLogo, raceName, countryName, countryCode, f1Constructor, NBA_ID } from '#kit/logos.mjs';
import { detectLocale } from './i18n.mjs';
import { liveOf } from './live.mjs';
import { polymarketLine, polymarketNow, monthPack, gameKey, unpackLine, PM_LEAGUE, raceLine, raceLaps, raceEvents, raceNow, raceKey, unpackRace } from './winprob.mjs';
import { mlbDate, mlbScheduleUrl, mlbBoxUrl, mlbLiveGames, mlbGameOf, mlbBoxTables, emptyBox } from './mlb.mjs';
import { LEAGUES } from './leagues.mjs';
import { asiaMonth, asiaMonthOf, CATALOG } from '#kit/catalog.mjs';
import * as kit from '#kit/quadra.mjs';
const { proxyJson } = kit;
import { stageFrom, roundName } from './stage.mjs';
import { teamNameZh } from '#kit/names.mjs';
import { groupZh } from './statnames.mjs';

export const SITE = 'https://site.api.espn.com/apis/site/v2/sports';
export const STANDINGS = 'https://site.api.espn.com/apis/v2/sports';
export const COMMON = 'https://site.api.espn.com/apis/common/v3/sports';

// ---- Fetching ------------------------------------------------------------------

// The kit's proxyJson: requests made together go as one batch, answers are
// remembered in memory and on the device (a list younger than `ttl` is
// never asked for again, even after the app was closed).
export const getJson = (url, { ttl = 60_000, trim = '', mirror = true } = {}) => proxyJson(url, { ttl, trim, mirror });
// How long a live answer (scores, a game's summary) is kept before asking again.
export const LIVE_TTL = 10_000;

export const yyyymmdd = date => date.toISOString().slice(0, 10).replaceAll('-', '');
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
    alt: team.alternateColor ? `#${team.alternateColor}` : null,
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
// outside the league (a preseason guest: the London Lions) has the kit's
// own (NBA_GUESTS), else its initial.
// A guest (no NBA.com mark) is marked so: no team page, nothing to follow.
const nbaLogo = (league, side) => (league === 'nba' && side && !side.athlete ? { ...side, logo: teamLogo('nba', side.en || side.name), ...(NBA_ID[side.en || side.name] ? {} : { guest: true }) } : side);
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
// session's official time. Schedules show the official time (what every
// schedule says, 16:30 not 16:26); reminders use the titles' time (`at`),
// so they're never missed, without a second time on screen. The race's
// titles follow the anthem about 5 minutes before (the owner's watching). Minutes before; estimates (F1 publishes none: the race's come after
// the anthem, the others just before the session), tuned here.
export const TITLES_BEFORE = { Race: 5, SR: 5, Qual: 4, SS: 4, SQ: 4, FP1: 4, FP2: 4, FP3: 4 };
export const titlesAt = (league, abbr, start) => (league === 'f1' && TITLES_BEFORE[abbr] && start ? new Date(Date.parse(start) - TITLES_BEFORE[abbr] * 60_000).toISOString().replace(':00.000Z', 'Z') : start);
export const sessionName = (x, lang = 'zh', short = false) => {
  const n = SESSION_NAMES[x?.abbr];
  if (!n) return x?.name || x?.abbr || '';
  return short ? n.short[lang === 'en' ? 'en' : 'zh'] : n[lang === 'en' ? 'en' : 'zh'];
};
// A race weekend as its sessions, each an event (the weekend's other
// fields kept, so its sheet opens on that session). Anything else as it is.
// Sessions F1's own feed has said are over ('FP1|<start>'): ESPN's copy says
// so minutes later (a sprint qualifying stayed "on" well after its end).
export const feedEnded = new Set();
// …and the ones it has said are running ('Started'): live at once, not when
// ESPN's copy says so minutes later.
export const feedStarted = new Set();
// …and when it last said one was still on (a qualifying between its parts,
// which ESPN's copy can call over): on, while that's fresh (2 minutes).
export const feedOnAt = new Map();
// A session's status as F1's feed has it, over ESPN's ('FP1', its official start).
export function feedStatus(abbr, start, status) {
  const k = `${abbr}|${start}`;
  if (feedEnded.has(k) && status?.state !== 'post') return { ...status, state: 'post', completed: true };
  if (!feedEnded.has(k) && status?.state === 'post' && Date.now() - (feedOnAt.get(k) || 0) < 120_000) return { ...status, state: 'in', completed: false };
  if (feedStarted.has(k) && status?.state === 'pre') return { ...status, state: 'in' };
  return status;
}
// Due to start: its start a minute away or passed (up to 3 h), not yet said to be on.
export const dueToStart = (x, now = Date.now()) => x?.status?.state === 'pre' && Date.parse(x.start) - now < 60_000 && now - Date.parse(x.start) < 3 * 3_600_000;
export function splitWeekend(e, now = Date.now(), lang = 'zh') {
  if (e?.kind !== 'field' || LEAGUES[e.league]?.sport !== 'racing' || e.sessionKey) return [e];
  const main = (e.sessions || []).filter(x => x.start && MAIN_SESSIONS.includes(x.abbr));
  if (main.length < 2) return [settleField(e, now)];
  return main.map(x => {
    // The feed can leave a session "on" (or "to come") long after it ended.
    const done = Date.parse(x.start) + SESSION_MS < now || feedEnded.has(`${x.abbr}|${x.start}`);
    const status = feedStatus(x.abbr, x.start, done && x.status.state !== 'post' ? { ...x.status, state: 'post', completed: true } : x.status);
    const shown = titlesAt(e.league, x.abbr, x.start);
    return { ...e, id: `${e.id}~${x.abbr}`, weekend: e.id, start: shown, at: shown, official: x.start, titles: shown, end: null, session: sessionName(x, lang), sessionKey: x.abbr, status };
  });
}

// A playoff series: its summary ("LAL lead series 2-1") and each side's wins.
export function parseSeries(s) {
  if (!s || s.type !== 'playoff') return null;
  return { summary: s.summary || '', completed: Boolean(s.completed), games: s.totalCompetitions || 0, wins: Object.fromEntries((s.competitors || []).map(c => [String(c.id), c.wins ?? 0])) };
}

// A playoff or knockout game's round, for the bracket: `key` the round
// (ESPN's RD16 / QTR / SEMI / FINAL for the US leagues' playoffs, PLAYIN
// and PLAYIN2 for the NBA's play-in (its own season type, 5), the
// season's stage for a cup: round-of-16, quarterfinals…), its name, the leg
// and the sides the tie's over for (a cup's second leg says who went
// through). Null for any other game (a cup's league phase or groups too).
export function knockoutRound(e, comp, league) {
  const slug = String(e?.season?.slug || '');
  const note = comp?.notes?.[0]?.headline || '';
  const cup = Boolean(LEAGUES[league]?.cup);
  // The play-in's two steps: 7 v 8 and 9 v 10, then the 8th seed game.
  if (/play-?in/i.test(`${slug} ${note}`)) return cup ? null : { key: /8th seed/i.test(note) ? 'PLAYIN2' : 'PLAYIN', title: note || 'Play-In', leg: 0, through: [] };
  const post = e?.season?.type === 3 || /post-?season/i.test(slug);
  if (!post && !(cup && slug && !/league-phase|group|regular|qualif|preliminary/i.test(slug))) return null;
  const key = cup ? slug : comp?.type?.abbreviation || slug;
  if (!key) return null;
  const title = comp?.series?.title || (cup ? slug.replace(/-/g, ' ') : note.replace(/\s*-\s*(Game|Leg)\b.*$/i, '')) || key;
  return { key, title, leg: Number(comp?.leg?.value) || 0, through: (comp?.series?.competitors || []).filter(c => c.winner).map(c => String(c.id)) };
}
// A game's start, and whether its time is set: a play-off's next game is
// dated before its hour is (ESPN's timeValid false, the day's 00:00 in New
// York, 12:00 in Taiwan). An American game of that day is played in
// Taiwan's next morning: placed there (20:00 New York, 08:00 here, the usual
// hour) with its time shown as 待定 until ESPN or ELTA's list sets it.
const ET_MIDNIGHT = /T0[45]:00(:00)?(\.000)?Z$/;
export function startOf(date, comp) {
  if (comp?.timeValid !== false || !date) return { start: date };
  return { start: ET_MIDNIGHT.test(date) ? new Date(Date.parse(date) + 20 * 3_600_000).toISOString() : date, timeTbd: true };
}
// A game's time from another list (ELTA's, the app's): set from outside, ESPN's own stands once it has one.
let timeFix = e => e;
export const fixTimes = fn => (timeFix = fn);
export const fixTime = (e, _, list = []) => (e?.timeTbd && !e.timeFrom ? timeFix(e, list) : e);
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
      ...startOf(e.date, comp),
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

// Each playoff series as the newest game over in it has it. The days to come
// are the nightly copies (Shared-Data's mirror, built before tonight's games):
// built on top of with what's been played since, a series won drops its
// "If Necessary" games, and a game that's now sure to be played loses its
// （如需）. settleSeries(list) -> the list so.
const seriesNow = new Map();
// Each league's latest playoff game over (its start): a day's "TBD" or
// "If Necessary" from before it may have changed.
const playoffDone = new Map();
const seriesKey = e => `${e.league}|${e.round?.key}|${[e.home?.id, e.away?.id].map(String).sort().join('|')}`;
const playedOf = s => Object.values(s?.wins || {}).reduce((n, w) => n + (Number(w) || 0), 0);
export function settleSeries(list) {
  for (const e of list) {
    if (e?.kind !== 'match' || !e.series || !e.round || e.status?.state !== 'post') continue;
    const k = seriesKey(e);
    if (playedOf(e.series) >= playedOf(seriesNow.get(k))) seriesNow.set(k, e.series);
    playoffDone.set(e.league, Math.max(playoffDone.get(e.league) || 0, Date.parse(e.start) || 0));
  }
  const out = [];
  for (const e of list) {
    const s = e?.kind === 'match' && e.round && e.status?.state === 'pre' ? seriesNow.get(seriesKey(e)) : null;
    // Nothing newer than what the game itself says.
    if (!s || playedOf(s) <= playedOf(e.series)) {
      out.push(e);
      continue;
    }
    if (s.completed) continue;
    const game = Number(/\bgame (\d+)/i.exec(e.note)?.[1]) || 0;
    const need = Math.ceil((s.games || 0) / 2);
    const lead = Math.max(0, ...Object.values(s.wins).map(Number));
    // Sure to be played: neither side can have won it before, whatever happens until then.
    const sure = /if necessary/i.test(e.note) && game && need && lead + (game - 1 - playedOf(s)) < need;
    const note = sure ? e.note.replace(/\s*-?\s*if necessary/i, '') : e.note;
    out.push({ ...e, series: s, note, ...(sure && e.stage?.round ? { stage: { ...e.stage, round: { zh: roundName(note, 'zh'), en: note } } } : {}) });
  }
  return out;
}

// `keep`: how long a past day is kept on the phone (6 hours unless said).
export async function scoreboard(league, dates, keep = 6 * 3_600_000) {
  const l = LEAGUES[league];
  if (l?.asia) return asiaEvents(league);
  const list = [].concat(dates || []);
  // Scores on now: read again after 10 seconds (the proxy's live copy).
  // A day two or more back is over: kept on the phone 6 hours, not asked again every 10 seconds.
  const urlOf = d => `${SITE}/${l.espn}/scoreboard?dates=${d}&limit=200`;
  const pages = list.length ? await Promise.all(list.map(d => getJson(urlOf(d), { ttl: /^\d{8}$/.test(d) && d < yyyymmdd(new Date(Date.now() - 2 * 86_400_000)) ? keep : LIVE_TTL }).catch(() => null))) : [await getJson(`${SITE}/${l.espn}/scoreboard`, { ttl: LIVE_TTL })];
  // Not one page read: a failure, never "no games" (a day saved without the
  // league, or the league taken for out of season).
  if (!pages.some(Boolean)) throw new Error(`${league}: unread`);
  const parsed = pages.map(p => (p ? parseScoreboard(p, league) : []));
  settleSeries(parsed.flat());
  // A playoff day still waiting on results (the next round's "TBD", a game
  // "If Necessary") as the nightly copy has it, with a playoff game over
  // since that copy was built: that day read live, once, and the live copy
  // kept (no more reads) until another playoff game is over. ESPN names the
  // sides, drops or confirms a game and sets its time (ALDS G4 moved 05:00 to
  // 08:00 once the Rays were through) as soon as a game ends; the copy only
  // the next night. Every other read stays the nightly copy's; once a game of
  // that day starts (the copy's own end), the day is read as any other.
  const built = kit.mirrorBuilt ? await kit.mirrorBuilt().catch(() => 0) : 0;
  const done = playoffDone.get(league) || 0;
  await Promise.all(
    list.map(async (d, i) => {
      if (!/^\d{8}$/.test(d)) return;
      const url = urlOf(d);
      const kept = liveDays.get(url);
      if (kept && Date.now() >= kept.first) return void liveDays.delete(url);
      if (!copyBehind({ copy: parsed[i], kept, built, done })) {
        if (kept) parsed[i] = parseScoreboard(kept.page, league);
        return;
      }
      const page = await getJson(url, { ttl: 0, mirror: false }).catch(() => null);
      if (!page) return;
      parsed[i] = parseScoreboard(page, league);
      const starts = parsed[i].map(e => Date.parse(e.start)).filter(Number.isFinite);
      liveDays.set(url, { page, done, at: Date.now(), waiting: parsed[i].some(waiting), gap: parsed[i].some(gapped), first: starts.length ? Math.min(...starts) : Infinity });
    })
  );
  const seen = new Set();
  const events = parsed.flat().filter(e => !seen.has(e.id) && seen.add(e.id));
  if (league !== 'mlb') return noteLatest(settleSeries(events)).map(fixTime);
  const [live] = await Promise.all([withMlbLive(events), loadPostseason(events)]);
  return noteLatest(byMlbPostseason(settleSeries(live))).map(fixTime);
}

// ---- MLB's postseason over the copies ------------------------------------------------
//
// The days come from the nightly copy (and a day read live when it's behind,
// above), each read at its own moment, so one series could show G4 待定, G5
// timed and G6 待定. MLB's own list of the games still to come
// (kit/postseason.mjs: one small read for all of October, minutes fresh) is
// one moment for all of them: every playoff game to come takes its time,
// 待定 and 如需 from it, and one MLB no longer lists (its series over) goes.
// An older kit without it: as before.
const postKit = import('#kit/postseason.mjs').catch(() => null);
let postNow = null;
// (A team's schedule has no round: its note says it, "ALCS - Game 3".)
const waitingPost = e => e?.league === 'mlb' && (e.round || /\bgame \d/i.test(e.note || '')) && e.status?.state === 'pre';
export async function loadPostseason(events) {
  if (!events.some(waitingPost)) return postNow;
  const k = await postKit;
  if (!k?.mlbPostseason) return postNow;
  // Only games from yesterday's US date on are taken off (one of last night's not started yet is still listed).
  const from = mlbDate(Date.now() - 86_400_000);
  const data = await getJson(k.mlbPostseasonUrl(from.slice(0, 4)), { ttl: 5 * 60_000, mirror: false }).catch(() => null);
  if (data?.dates) postNow = { k, from, list: k.mlbPostseason(data) };
  return postNow;
}
export function byMlbPostseason(list, post = postNow) {
  if (!post?.list) return list;
  const out = [];
  for (const e of list) {
    if (!waitingPost(e) || !e.note) {
      out.push(e);
      continue;
    }
    const g = post.k.mlbGameFor(post.list, e);
    if (!g) {
      // Not on MLB's list, its series over: it won't be played.
      if (!post.k.mlbGone?.(post.list, e, mlbDate(e.start), post.from)) out.push(e);
      continue;
    }
    const plainNote = e.note.replace(/\s*-?\s*if necessary/i, '');
    const note = g.maybe ? `${plainNote} If Necessary` : plainNote;
    // Timed by MLB: its hour. Not yet: 待定 on MLB's day (ELTA's slot put back on after, fixTime).
    const when = g.timeTbd ? { start: e.timeTbd && mlbDate(e.start) === g.day ? e.start : g.start, timeTbd: true, timeFrom: undefined } : { start: g.start, timeTbd: undefined, timeFrom: undefined };
    out.push({ ...e, ...when, note, ...(e.stage ? { stage: { ...e.stage, round: { zh: roundName(note, 'zh'), en: note } } } : {}) });
  }
  return out;
}
// A playoff game to come between sides not known yet ("TBD", "CLE/CHW").
const placeholder = x => /^tbd$/i.test(String(x?.abbr || x?.short || '').trim()) || String(x?.abbr || '').includes('/') || Number(x?.id) <= 0;
const waiting = e => e.round && e.status?.state === 'pre' && (e.timeTbd || placeholder(e.home) || placeholder(e.away) || /if necessary/i.test(e.note || ''));
// A waiting game whose series, as the copy has it, still had an earlier game
// to play ("Game 4 If Necessary" at 2-0: Game 3 not over when it was made).
const gapped = e => waiting(e) && (Number(/\bgame (\d+)/i.exec(e.note || '')?.[1]) || 0) - 1 > playedOf(e.series);
// The days read live (above): url -> { page, done: the last playoff game over then, at, waiting, gap, first: its first start }.
const liveDays = new Map();
// A game's start this long before the copy was built could have ended after it.
const GAME_MS = 5 * 3_600_000;
// A day read live again after this while its earlier game was still to be played.
const GAP_MS = 30 * 60_000;
// Whether a day's copy may be behind (read it live): a playoff game over
// after it was made, as far as this session has seen (`done`: the league's
// latest over). The game that decided it is often on a day not read at all
// (after midnight, last night's Game 3 is yesterday's), so with nothing seen
// a waiting game is read live once too, and so is one whose series still had
// an earlier game to play when the copy was made (then again every half hour
// while that game is still to come in the live copy).
export function copyBehind({ copy, kept, built, done, now = Date.now() }) {
  // Our live copy: a game over since (one that started before it, when none had been seen then), or its gap's half hour up.
  if (kept) return (kept.waiting && done > (kept.done || kept.at - GAME_MS)) || (kept.gap && now - kept.at >= GAP_MS);
  if (!built || !copy.some(waiting)) return false;
  return !done || done > built - GAME_MS || copy.some(gapped);
}

// An MLB game on now without ESPN's count (its feed can go innings with the
// score alone): the count, runners, batter, pitcher and last play from MLB's own.
const blankLive = e => e.status.state === 'in' && e.live?.outs == null;
const mlbGames = async date => mlbLiveGames(await getJson(mlbScheduleUrl(date), { ttl: LIVE_TTL }));
async function withMlbLive(events) {
  const days = [...new Set(events.filter(blankLive).map(e => mlbDate(e.start)))];
  if (!days.length) return events;
  const games = (await Promise.all(days.map(d => mlbGames(d).catch(() => [])))).flat();
  return events.map(e => {
    const g = blankLive(e) && mlbGameOf(games, e);
    return g ? { ...e, live: { ...e.live, ...g.live } } : e;
  });
}

// A league's whole year of games: the nightly pack (Shared-Data, built
// at midnight), never ESPN's 6 MB year page through the proxy (a few at once
// ran the proxy out of memory, and parsing them froze the phone). Only an
// older kit, or a pack not built yet, reads the page itself.
export function yearPage(league, year) {
  const l = LEAGUES[league];
  const direct = () => getJson(`${SITE}/${l.espn}/scoreboard?dates=${year}&limit=500`, { ttl: 6 * 3_600_000 });
  return kit.packJson ? kit.packJson(`sports/${league}/${year}.json`).catch(direct) : direct();
}

// A whole season of a race series (ESPN answers
// `dates=<year>` with every event of that year): past results and every
// future event, not only the current one. Late in the year, next year's too.
export async function seasonEvents(league, now = Date.now()) {
  const l = LEAGUES[league];
  if (l?.asia) return asiaEvents(league);
  const d = new Date(now);
  const years = [d.getUTCFullYear(), ...(d.getUTCMonth() >= 10 ? [d.getUTCFullYear() + 1] : [])];
  // The year from last night's pack; this week's state (a race just run, its
  // results) from the current scoreboard over it.
  const [now0, ...pages] = await Promise.all([getJson(`${SITE}/${l.espn}/scoreboard`, { ttl: 5 * 60_000 }).catch(() => null), ...years.map(y => yearPage(league, y).catch(() => null))]);
  const seen = new Set();
  const events = [now0, ...pages]
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
// A league whose sides don't all play each round (MLS: 35 matchdays, 34
// games each, a bye or two each) numbers its rounds by its calendar, as it
// publishes them: each window of days in a row with games (a weekend, a
// midweek; US Eastern days) one matchday, a window of a few put-back games
// none of its own (those games have none). Checked against MLS's own
// 2026 numbers: Matchday 1 (2/21), 6 (4/4), 11 (5/2), 16 (7/16), 31
// (10/18), 32 (10/25), 35 (11/7).
const CALENDAR_ROUNDS = new Set(['mls']);
export function calendarRounds(events, from) {
  const list = [...events].filter(x => x.kind === 'match' && !x.status?.void && !x.round && x.stage?.key !== 'pre' && Date.parse(x.start) >= from);
  const sides = new Set(list.flatMap(x => [x.home?.id, x.away?.id]));
  const day = x => new Date(Date.parse(x.start) - 5 * 3_600_000).toISOString().slice(0, 10);
  const byDay = new Map();
  for (const x of list) byDay.set(day(x), [...(byDay.get(day(x)) || []), x]);
  const out = new Map();
  let n = 0;
  let window = [];
  const close = () => {
    // A round: an eighth of the sides playing at least (MLS's 7/16 had 10 of 30).
    if (window.length && window.length * 2 >= Math.max(4, sides.size / 4)) {
      n++;
      for (const x of window) out.set(x.id, n);
    }
    window = [];
  };
  let prev = null;
  for (const d of [...byDay.keys()].sort()) {
    if (prev && Date.parse(d) - Date.parse(prev) > 86_400_000) close();
    window.push(...byDay.get(d));
    prev = d;
  }
  close();
  return out;
}
// A cup's league phase (the Champions League's, the Nations League's): each
// side plays once a matchday, so a game's is one more than either side's
// games before it; a matchday's day is said as most of that day's games
// have it (a side resting in a group of three would read a matchday early).
// Its knockout games have none (their round's name says it).
export function phaseRounds(events, from) {
  const counts = weeksFrom([...events].filter(x => !x.round && x.stage?.key !== 'pre'), from);
  const day = x => String(x.start).slice(0, 10);
  const votes = new Map();
  for (const x of events) {
    const n = counts.get(x.id);
    if (!n) continue;
    const v = votes.get(day(x)) || new Map();
    v.set(n, (v.get(n) || 0) + 1);
    votes.set(day(x), v);
  }
  const out = new Map();
  for (const x of events) {
    const v = counts.has(x.id) && votes.get(day(x));
    if (v) out.set(x.id, [...v].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]);
  }
  return out;
}
const weekMemo = new Map();
// When the season a moment is in began: ESPN's own dates for it (MLS's
// season is the calendar year, Europe's from June or July); else, from a
// league's games in July and August, July (MLS's came back from a World
// Cup break then: its season is the year's), the year's start otherwise.
export function seasonFrom(pages, at, july) {
  for (const p of pages || []) {
    const s = p?.leagues?.[0]?.season;
    const [from, to] = [Date.parse(s?.startDate), Date.parse(s?.endDate)];
    if (from <= at && at < to) return from;
  }
  const events = (pages || []).filter(Boolean).flatMap(p => p.events || []);
  return events.some(x => Date.parse(x.date) >= july && Date.parse(x.date) < july + 60 * 86_400_000) ? july : Date.UTC(new Date(at).getUTCFullYear(), 0, 1);
}
// The round of a football match, once its season's been read (null until
// then; `onLoad` runs when it has): a league's matchweek (第 N 輪), a cup's
// league-phase matchday (第 N 比賽日). A cup without a table (the FA Cup)
// has its rounds by name.
export function weekOf(e, onLoad) {
  const l = LEAGUES[e?.league];
  if (!l?.espn || l.sport !== 'soccer' || (l.cup && !l.standings) || e.kind !== 'match' || e.round) return null;
  const memo = weekMemo.get(e.league);
  if (memo instanceof Map) return memo.get(e.id) ?? null;
  if (!memo) {
    const d = new Date(Date.parse(e.start) || Date.now());
    const y = d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
    const july = Date.UTC(y, 6, 1);
    const load = Promise.all([y, y + 1].map(yr => yearPage(e.league, yr).catch(() => null)))
      .then(pages => {
        const from = seasonFrom(pages, d.getTime(), july);
        const events = pages.filter(Boolean).flatMap(p => parseScoreboard(p, e.league));
        weekMemo.set(e.league, l.cup ? phaseRounds(events, from) : CALENDAR_ROUNDS.has(e.league) ? calendarRounds(events, from) : weeksFrom(events, from));
      })
      .catch(() => weekMemo.set(e.league, new Map()));
    weekMemo.set(e.league, load);
  }
  if (onLoad) weekMemo.get(e.league).then?.(() => onLoad());
  return null;
}
// How a league counts its rounds: 'matchday' (第 N 比賽日: a cup's league
// phase; MLS's calendar, where a side can sit one out), 'matchweek' (第 N 輪:
// a league where every side plays every round), or null.
export function roundKind(league) {
  const l = LEAGUES[league];
  if (!l || l.sport !== 'soccer') return null;
  return l.cup || CALENDAR_ROUNDS.has(league) ? 'matchday' : 'matchweek';
}
// A round said in the reader's words, or a span of them ("第 6–7 輪").
export function roundLabel(league, from, to = from, lang = 'zh') {
  if (!from) return '';
  const n = to && to !== from ? `${from}–${to}` : `${from}`;
  const day = roundKind(league) === 'matchday';
  if (lang === 'en') return `${day ? 'Matchday' : 'Matchweek'} ${n}`;
  return day ? `第 ${n} 比賽日` : `第 ${n} 輪`;
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
  // The play-in (the NBA's season type 5) is the postseason's start: its bracket, not last season's.
  const phase = t.type === 3 || t.type === 5 || /post|playoff|play-?in|final|knockout/i.test(name) ? 'post' : t.type === 2 || /regular|league phase|group/i.test(name) ? 'regular' : t.type === 1 || /^\s*pre/i.test(name) ? 'pre' : t.type === 4 || /off/i.test(name) ? 'off' : '';
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
    // One side scored and the other empty: the other was held to 0 (an older list's copy).
    if (g.homeScore != null || g.awayScore != null) g = { ...g, homeScore: g.homeScore ?? 0, awayScore: g.awayScore ?? 0 };
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
    // Its start passed since the list was read (kept two minutes): on, as the
    // list itself would say (a game past its start and not over is on), at once.
    const t = Date.parse(g.start);
    const state = g.state === 'pre' && Date.now() >= t && Date.now() - t < 5 * 3_600_000 ? 'in' : g.state;
    return {
      id: g.id,
      league,
      kind: 'match',
      name: `${g.away.en} @ ${g.home.en}`,
      short: `${g.away.zh} @ ${g.home.zh}`,
      start: g.start,
      status: { state: state === 'void' ? 'pre' : state, detail: '', short: '', completed: done, void: state === 'void' },
      venue: g.venue || '',
      tv: '',
      note: '',
      home: side(g.home, 'home', g.homeScore, g.awayScore),
      away: side(g.away, 'away', g.awayScore, g.homeScore),
      live: null,
      asia: true,
      ...(g.playoff ? { playoff: g.playoff } : {})
    };
  });
}
const CPBL_SERIES = {
  challenge: { key: 'post', zh: '季後挑戰賽', en: 'Playoff Challenge' },
  final: { key: 'final', zh: '台灣大賽', en: 'Taiwan Series' }
};
// The play-offs' seeds from the table pack (2024 on): the two half
// champions, the better by the year's record straight to the Taiwan Series,
// the other a win given in the challenge (best of five) against the year's
// best of the rest. One club winning both halves waits; the year's next two
// play, the better given the win. Before a half is over its leader stands
// in (`sure` false). -> { direct, given, rival, sure } (clubs' English names) | null
export function cpblSeeds(pack) {
  const tables = pack?.tables || [];
  const half = k => tables.find(t => t.key === k);
  const [first, second] = [half('first'), half('second')];
  if (!first?.rows?.length) return null;
  const year = new Map();
  const yearTable = half('year');
  for (const t of yearTable ? [yearTable] : [first, second].filter(Boolean))
    for (const r of t.rows) {
      const y = year.get(r.en) || { w: 0, l: 0 };
      year.set(r.en, { w: y.w + r.w, l: y.l + r.l });
    }
  const p = en => {
    const y = year.get(en);
    return y && y.w + y.l ? y.w / (y.w + y.l) : 0;
  };
  const order = [...year.keys()].sort((a, b) => p(b) - p(a));
  const champs = [...new Set([first.rows[0]?.en, second?.rows?.[0]?.en].filter(Boolean))];
  const over = t => t?.rows?.length && t.rows.every(r => r.gp >= 60);
  const sure = Boolean(over(first) && over(second));
  if (champs.length === 2) {
    const [direct, given] = [...champs].sort((a, b) => p(b) - p(a));
    return { direct, given, rival: order.find(en => !champs.includes(en)) || null, sure, year: pack.year || null };
  }
  const rest = order.filter(en => en !== champs[0]);
  return { direct: champs[0], given: rest[0] || null, rival: rest[1] || null, sure, year: pack.year || null };
}
// CPBL's play-offs (its own lists say which kind, TheSportsDB only that it's
// one): the games by pairing, in order, each its series' name and number
// (季後挑戰賽 G2), the first pairing the challenge (季後挑戰賽), the next the
// Taiwan Series (台灣大賽), each with its round (the 季後賽 bracket) and how
// its series stands (the challenge's given win in it, from `seeds`). The
// regular season's games are said to be so once there are play-offs (the
// scores' 例行賽 / 季後賽 filter).
const CPBL_BEST = { challenge: 5, final: 7 };
export function cpblPlayoffs(events, seeds = null) {
  const post = events.filter(e => e.playoff && !e.status.void).sort((a, b) => a.start.localeCompare(b.start));
  if (!post.length) return events;
  const pair = e => [e.home.en, e.away.en].sort().join('|');
  const tagged = new Map();
  const list = [];
  let series = null;
  let count = 0;
  for (const e of post) {
    if (!series || series.pair !== pair(e)) {
      count += 1;
      const kind = typeof e.playoff === 'string' ? e.playoff : count === 1 ? 'challenge' : 'final';
      const wins = { [e.home.id]: 0, [e.away.id]: 0 };
      // (Only the pack's own year: last year's challenge had seeds of its own.)
      const sameYear = !seeds?.year || Number(e.start.slice(0, 4)) === Number(seeds.year);
      if (kind === 'challenge' && sameYear && seeds?.given && seeds.given in wins) wins[seeds.given] = 1;
      series = { pair: pair(e), kind, n: 0, wins, games: [] };
      list.push(series);
    }
    series.n += 1;
    series.games.push(e);
    if (e.status.state === 'post') {
      const [h, a] = [Number(e.home.score), Number(e.away.score)];
      if (h !== a) series.wins[h > a ? e.home.id : e.away.id] += 1;
    }
    const s = CPBL_SERIES[series.kind];
    tagged.set(e.id, { series, stage: { key: s.key, zh: s.key === 'final' ? '總冠軍賽' : '季後賽', en: s.key === 'final' ? 'Finals' : 'Playoffs', round: { zh: `${s.zh} G${series.n}`, en: `${s.en} - Game ${series.n}` }, special: true } });
  }
  // How each series stands now, on every one of its games (as ESPN's do).
  const standing = new Map(
    list.map(x => {
      const need = (CPBL_BEST[x.kind] + 1) / 2;
      const [a, b] = Object.keys(x.wins);
      const [wa, wb] = [x.wins[a], x.wins[b]];
      const ab = id => x.games[0][x.games[0].home.id === id ? 'home' : 'away'].abbr;
      const lead = wa === wb ? null : wa > wb ? a : b;
      const done = Math.max(wa, wb) >= need;
      const score = `${Math.max(wa, wb)}-${Math.min(wa, wb)}`;
      const summary = !lead ? `Series tied ${score}` : `${ab(lead)} ${done ? 'win' : 'lead'} series ${score}`;
      return [x, { summary, completed: done, games: CPBL_BEST[x.kind], wins: { ...x.wins } }];
    })
  );
  const regular = { key: 'regular', zh: '例行賽', en: 'Regular season', round: null, special: false };
  return events.map(e => {
    const t = tagged.get(e.id);
    if (!t) return { ...e, stage: e.playoff ? e.stage : regular };
    const s = CPBL_SERIES[t.series.kind];
    return { ...e, stage: t.stage, round: { key: t.series.kind, title: s.en, leg: 0, through: standing.get(t.series).completed ? Object.keys(t.series.wins).filter(id => t.series.wins[id] >= (CPBL_BEST[t.series.kind] + 1) / 2) : [] }, series: standing.get(t.series) };
  });
}
// The months around now (and `extra` more either side): a whole stretch of
// the season, past games and the next ones.
export async function asiaEvents(league, extra = 0, now = Date.now()) {
  const [y, m] = asiaMonthOf(now).split('-').map(Number);
  const months = [];
  for (let d = -1 - extra; d <= 1 + extra; d++) months.push(new Date(Date.UTC(y, m - 1 + d, 1)).toISOString().slice(0, 7));
  // This month unread is a failure, never "no games" (the others only fill out the stretch).
  const now0 = asiaMonthOf(now);
  const lists = await Promise.all(months.map(m => asiaMonth(url => getJson(url, { ttl: m < now0 ? 6 * 3_600_000 : 2 * 60_000 }), LEAGUES[league].asia, m).catch(error => (m === now0 ? Promise.reject(error) : []))));
  const seen = new Set();
  const events = parseAsia(lists.flat(), league)
    .filter(e => !seen.has(e.id) && seen.add(e.id))
    .sort((a, b) => a.start.localeCompare(b.start));
  const shown = league === 'cpbl' ? cpblPlayoffs(events, cpblSeeds(await cpblPack().catch(() => null))) : events;
  return shown.some(e => e.status.state === 'in') ? withKambiLive(shown, league) : shown;
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
  // A game's notes per team (baseball's: 2B, HR, RBI, team LOB, SB, DP,
  // HBP… as the league's own box score lists them under its tables):
  // [{ team, groups: [{ name, items: [{ key, abbr, label, text }] }] }].
  const details = (box.teams || [])
    .map(t => ({ team: String(t.team?.id ?? ''), groups: (t.details || []).map(g => ({ name: g.name || '', items: (g.stats || []).filter(x => x.displayValue).map(x => ({ key: x.name || '', abbr: x.abbreviation || x.shortDisplayName || '', label: x.displayName || '', text: x.displayValue })) })).filter(g => g.items.length) }))
    .filter(t => t.groups.length);
  // Player tables per team: [{ team, tables: [{ name, labels, rows: [{ id, name, stats }] }] }].
  const players = (box.players || []).map(p => ({
    team: String(p.team?.id ?? ''),
    tables: (p.statistics || []).map(st => ({
      name: st.name || st.type || st.text || '',
      labels: st.labels || st.names || [],
      rows: (st.athletes || []).map(a => ({ id: String(a.athlete?.id ?? ''), name: a.athlete?.shortName || a.athlete?.displayName || '', full: a.athlete?.displayName || '', headshot: freshHeadshot(a.athlete?.headshot?.href) || null, pos: a.position?.abbreviation || '', starter: Boolean(a.starter), stats: a.stats || [] })),
      totals: st.totals || []
    }))
  }));
  // Scoring and key moments.
  // What each play was, for the chart's key moments (lib/moments.mjs): who (the batter, the shooter, the scorer), what, the score after it.
  // Each player by id: { short, name, headshot } (the box score's, the soccer rosters').
  const people = new Map();
  const know = a => a?.id && people.set(String(a.id), { short: a.shortName || a.displayName, name: a.displayName || a.shortName, headshot: freshHeadshot(a.headshot?.href) || null });
  for (const t of data?.boxscore?.players || []) for (const st of t.statistics || []) for (const a of st.athletes || []) know(a.athlete);
  for (const r of data?.rosters || []) for (const x of r.roster || []) know(x.athlete);
  const whoOf = p => {
    // The batter; with none (a steal, a wild pitch) the runner, never the pitcher ESPN lists first.
    const ps = p.participants || [];
    const a = (ps.find(q => q.type === 'batter') || ps.find(q => /^on(first|second|third)$/i.test(q.type || '')) || ps.find(q => q.type !== 'pitcher') || ps[0])?.athlete;
    const known = people.get(String(a?.id ?? ''));
    const b = p.participants?.[1]?.athlete;
    const other = b ? people.get(String(b.id ?? ''))?.short || b.shortName || b.displayName || '' : '';
    return { who: known?.short || a?.shortName || a?.displayName || '', pic: a?.id ? { id: String(a.id), name: known?.name || a.displayName || '', headshot: known?.headshot || null } : null, ...(other ? { other } : {}) };
  };
  // A play's what and who, for 過程 (lib/moments.mjs's feedText says it in Chinese; the player's face beside it).
  const detailOf = p => ({ kind: p.type?.type || '', type: p.type?.text || '', alt: p.alternativeType?.text || '', value: Number(p.scoreValue) || 0, ...whoOf(p) });
  const plays = (data?.scoringPlays || data?.plays?.filter(p => p.scoringPlay) || [])
    .slice(-60)
    .map(p => ({ text: p.text || p.type?.text || '', period: p.period?.displayValue || (p.period?.number ? `${p.period.number}` : ''), periodNum: p.period?.number || 0, periodType: p.period?.type || '', clock: p.clock?.displayValue || '', team: String(p.team?.id ?? ''), home: p.homeScore, away: p.awayScore, ...detailOf(p) }));
  const keyEvents = (data?.keyEvents || [])
    .filter(k => k.type?.type !== 'kickoff' && k.type?.type !== 'halftime' && k.type?.type !== 'end-regular-time')
    .map(k => ({ text: k.text || k.type?.text || '', type: k.type?.type || '', clock: k.clock?.displayValue || '', team: String(k.team?.id ?? ''), scoring: Boolean(k.scoringPlay), ...detailOf(k), type: k.type?.type || '' }));
  const rosters = (data?.rosters || []).map(r => ({
    team: String(r.team?.id ?? ''),
    formation: r.formation || '',
    players: (r.roster || []).map(x => ({ id: String(x.athlete?.id ?? ''), name: x.athlete?.displayName || '', short: x.athlete?.shortName || '', headshot: freshHeadshot(x.athlete?.headshot?.href) || null, jersey: x.jersey || '', pos: x.position?.abbreviation || '', starter: Boolean(x.starter), played: Boolean(x.starter || x.subbedIn), stats: Object.fromEntries((x.stats || []).map(s => [s.name, s.displayValue])) }))
  }));
  const leaders = (data?.leaders || []).flatMap(t =>
    (t.leaders || []).map(l => ({ team: String(t.team?.id ?? ''), stat: l.displayName || l.name, id: String(l.leaders?.[0]?.athlete?.id ?? ''), name: l.leaders?.[0]?.athlete?.shortName || l.leaders?.[0]?.athlete?.displayName || '', full: l.leaders?.[0]?.athlete?.displayName || '', headshot: freshHeadshot(l.leaders?.[0]?.athlete?.headshot?.href) || null, value: l.leaders?.[0]?.displayValue || '' }))
  );
  const injuries = (data?.injuries || []).map(t => ({ team: String(t.team?.id ?? ''), list: (t.injuries || []).map(i => ({ id: String(i.athlete?.id ?? ''), headshot: freshHeadshot(i.athlete?.headshot?.href) || null, name: i.athlete?.displayName || '', status: i.status || i.type?.description || '', detail: i.details?.type || '' })) }));
  // ESPN's win probability, play by play: the home side's chance (and a draw's, where there can be one).
  // The game's plays by the wall clock (t in seconds): what the chart's marks and a finger on it go by.
  const wall = p => Date.parse(p?.wallclock || '') / 1000;
  // A drive's plays (football) carry its team.
  const drivePlays = d => (d?.plays || []).map(p => (p.team ? p : { ...p, team: d.team }));
  const timed = [...(data?.plays || []), ...(data?.drives?.previous || []).flatMap(drivePlays), ...drivePlays(data?.drives?.current), ...(data?.keyEvents || [])].filter(p => Number.isFinite(wall(p)) && p.period?.number);
  const playOf = p => ({ id: String(p.id ?? ''), text: p.text || '', type: p.type?.text || '', kind: p.type?.type || '', alt: p.alternativeType?.text || '', scoring: Boolean(p.scoringPlay), value: Number(p.scoreValue) || 0, team: String(p.team?.id ?? ''), ...whoOf(p), home: p.homeScore, away: p.awayScore, clock: p.clock?.displayValue || '' });
  // The plays that move a market (a game drawn from Polymarket's): the scores, a red card, a penalty missed.
  const events = timed
    .filter(p => p.scoringPlay || /red-card|penalty---(missed|saved)/.test(p.type?.type || ''))
    .map(p => ({ t: wall(p), n: p.period.number, ...(/^(top|bottom)$/i.test(p.period.type || '') ? { half: p.period.type.toLowerCase() } : {}), kind: /red-card/.test(p.type?.type || '') ? 'red' : /penalty---/.test(p.type?.type || '') && !p.scoringPlay ? 'miss' : 'score', play: playOf(p) }))
    .sort((a, b) => a.t - b.t);
  const timeline = timed.map(p => ({ t: wall(p), n: p.period.number, half: /^(top|bottom)$/i.test(p.period.type || '') ? p.period.type.toLowerCase() : '', type: p.type?.type || '' })).sort((a, b) => a.t - b.t);
  // Each of ESPN's points takes its play's period (its wall clock can be off: a play logged late).
  const playAt = new Map(timed.map(p => [String(p.id), { n: p.period.number, ...(/^(top|bottom)$/i.test(p.period.type || '') ? { half: p.period.type.toLowerCase() } : {}), play: playOf(p) }]));
  // In the plays' own order: ESPN's list sometimes files a play late (a first quarter turnover among the plays at 3:41, one after the final
  // buzzer), with its chance from when it happened, a spike on the line. A point with no play keeps its place after the one before it.
  const seq = new Map(timed.map((p, i) => [String(p.id), i]));
  let at = -1;
  const winProb = (data?.winprobability || [])
    .filter(w => Number.isFinite(w.homeWinPercentage))
    .map((w, k) => ({ w, k, at: (at = seq.get(String(w.playId)) ?? at + 1e-6 * (k + 1)) }))
    .sort((a, b) => a.at - b.at || a.k - b.k)
    .map(({ w }) => ({ home: w.homeWinPercentage, ...(w.tiePercentage > 0 ? { draw: w.tiePercentage } : {}), ...playAt.get(String(w.playId)) }))
    // A point whose play ESPN left out: the period of the one before it (the first, of the first that has one).
    .map((p, i, all) => (p.n ? p : ((p.n = i ? all[i - 1].n : all.find(q => q.n)?.n), i && all[i - 1].half && (p.half = all[i - 1].half), p)));
  // A game to come: each side's chance, ESPN's own prediction, else the
  // sportsbook's moneylines (its margin taken out): { home, draw?, source }.
  const predictor = data?.predictor;
  const chance = v => (Number.isFinite(parseFloat(v)) ? parseFloat(v) / 100 : null);
  const implied = ml => (!Number.isFinite(ml) || !ml ? null : ml < 0 ? -ml / (100 - ml) : 100 / (ml + 100));
  let predict = null;
  if (chance(predictor?.homeTeam?.gameProjection) != null && chance(predictor?.awayTeam?.gameProjection) != null) {
    const [h, a, d] = [chance(predictor.homeTeam.gameProjection), chance(predictor.awayTeam.gameProjection), chance(predictor.homeTeam.teamChanceTie) || 0];
    predict = { source: 'espn', home: h / (h + a + d), ...(d ? { draw: d / (h + a + d) } : {}) };
  } else {
    const book = (data?.pickcenter || []).find(x => implied(x.homeTeamOdds?.moneyLine) && implied(x.awayTeamOdds?.moneyLine));
    if (book) {
      const [h, a, d] = [implied(book.homeTeamOdds.moneyLine), implied(book.awayTeamOdds.moneyLine), implied(book.drawOdds?.moneyLine) || 0];
      predict = { source: book.provider?.name || 'book', home: h / (h + a + d), ...(d ? { draw: d / (h + a + d) } : {}) };
    }
  }
  // The season series (a playoff or a season's meetings), or soccer's
  // head-to-head (the last meetings, any competition): `h2h` with each
  // side's wins and the draws, by team id.
  // ESPN lists a baseball pair's preseason, regular season and playoff
  // series (preseason first: a playoff that hadn't started read "1-1" from
  // two March games). Never the preseason; the playoff once a game of it is
  // played, the regular season before.
  const played = s => (s.events || []).some(ev => ev.statusType?.completed || ev.status === 'post');
  const rank = s => (s.type === 'playoff' && played(s) ? 0 : s.type === 'season' ? 1 : s.type === 'playoff' ? 2 : 3);
  const listed = data?.seasonseries || [];
  const shown = listed.length > 1 ? listed.filter(s => s.type !== 'preseason').sort((x, y) => rank(x) - rank(y)) : listed;
  const series = shown.map(s => {
    const events = (s.events || []).map(ev => ({ id: String(ev.id), date: ev.date, score: (ev.competitors || []).map(c => `${c.team?.abbreviation || ''} ${c.score ?? ''}`).join(' · ') }));
    if (s.type !== 'head-to-head') return { summary: s.summary || s.description || '', kind: s.type || '', events };
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
    const cols = [['totalGoals', '進球', 'G'], ['goalAssists', '助攻', 'A'], ['totalShots', '射門', 'SH'], ['shotsOnTarget', '射正', 'SOT'], ['foulsCommitted', '犯規', 'FC'], ['foulsSuffered', '被犯規', 'FS'], ['offsides', '越位', 'OFF'], ['yellowCards', '黃牌', 'YC'], ['redCards', '紅牌', 'RC'], ['saves', '撲救', 'SV'], ['goalsConceded', '失球', 'GA']];
    for (const r of rosters) {
      const rows = r.players.filter(p => p.played).map(p => ({ id: p.id, name: p.short || p.name, full: p.name, headshot: p.headshot, pos: p.pos, starter: p.starter, stats: cols.map(([k]) => (/^(saves|goalsConceded)$/.test(k) && p.pos !== 'G' ? '' : p.stats[k] ?? '0')) }));
      if (rows.length) players.push({ team: r.team, tables: [{ name: en ? 'Players' : '球員', labels: cols.map(c => (en ? c[2] : c[1])), rows, totals: [] }] });
    }
  }
  // Every play of the game (過程 shows it whole; the live strip its last few).
  const feed = (data?.plays || []).map(p => ({ id: String(p.id ?? ''), text: p.text || p.type?.text || '', period: p.period?.displayValue || (p.period?.number ? `${p.period.number}` : ''), periodNum: p.period?.number || 0, periodType: p.period?.type || '', clock: p.clock?.displayValue || '', team: String(p.team?.id ?? ''), home: p.homeScore, away: p.awayScore, scoring: Boolean(p.scoringPlay), ...detailOf(p) }));
  // American football's drives, the whole game a line each: who, how it ended, its plays, yards and time.
  const drives = ((data?.drives?.previous || []).concat(data?.drives?.current ? [data.drives.current] : []))
    .filter(x => x && (x.displayResult || x.result))
    .map(x => ({ team: String(x.team?.id ?? ''), result: x.displayResult || x.result || '', desc: x.description || '', scoring: Boolean(x.isScore), periodNum: x.start?.period?.number || 0, period: x.start?.period?.number ? `${x.start.period.number}` : '', clock: x.start?.clock?.displayValue || '', home: x.plays?.at(-1)?.homeScore ?? null, away: x.plays?.at(-1)?.awayScore ?? null }));
  const info = data?.gameInfo || {};
  return {
    league,
    status: parseStatus(header?.status),
    sides,
    home: sides.find(s => s.homeAway === 'home') || sides[0] || null,
    away: sides.find(s => s.homeAway === 'away') || sides[1] || null,
    byId,
    teamStats,
    details,
    players,
    plays,
    feed,
    drives,
    keyEvents,
    rosters,
    leaders,
    injuries,
    winProb,
    timeline,
    events,
    predict,
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
// A CPBL game's box score (the league's own, lib/cpblbox.mjs), as a summary; null without one.
export async function cpblGame(e) {
  const url = cpblBoxUrl(e);
  if (!url) return null;
  const box = await getJson(url, { ttl: e.status?.state === 'post' ? 10 * 60_000 : LIVE_TTL });
  return cpblSummary(box, e, detectLocale() === 'en');
}
export async function summary(league, id) {
  const l = LEAGUES[league];
  const data = await getJson(`${SITE}/${l.espn}/summary?event=${encodeURIComponent(id)}`, { ttl: LIVE_TTL });
  const sm = parseSummary(data, league);
  return league === 'mlb' && sm.status.state === 'in' && emptyBox(sm.players) ? withMlbBox(sm, data?.header?.competitions?.[0]?.date).catch(() => sm) : sm;
}
// ESPN's box score of a game on now with no numbers in it: MLB's own, each
// player kept as ESPN's (their page, their picture) where ESPN lists them.
async function withMlbBox(sm, start) {
  if (!start || !sm.home || !sm.away) return sm;
  const g = mlbGameOf(await mlbGames(mlbDate(start)), sm);
  if (!g) return sm;
  const box = await getJson(mlbBoxUrl(g.pk), { ttl: LIVE_TTL });
  const plain = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const players = [];
  for (const side of [sm.away, sm.home]) {
    const tables = mlbBoxTables(box, side === sm.home ? 'home' : 'away');
    if (!tables) continue;
    const espn = new Map(sm.players.filter(p => p.team === side.id).flatMap(p => p.tables.flatMap(tb => tb.rows)).map(r => [plain(r.full || r.name), r]));
    const rows = list => list.map(r => {
      const mine = espn.get(plain(r.full));
      return { id: mine?.id || '', name: r.name, full: r.full, headshot: mine?.headshot || r.headshot, pos: r.pos || mine?.pos || '', starter: r.starter, stats: r.stats };
    });
    players.push({ team: side.id, tables: ['batting', 'pitching'].map(k => ({ name: k, labels: tables[k].labels, rows: rows(tables[k].rows), totals: [] })) });
  }
  return players.length ? { ...sm, players } : sm;
}

// ---- Win probability where ESPN draws none ----------------------------------------------

// Polymarket's line for a game on or over (lib/winprob.mjs): a finished
// one's from Shared-Data's month of them (one read covers the month's games),
// else read through the proxy (a game just over, or one too old to be kept).
// Null where there's no market.
const PM_TTL = { game: 6 * 3_600_000, now: 5 * 60_000 };
// A game to come: Polymarket's chance for each side now, null where there's no market.
export async function winNow(e) {
  if (!PM_LEAGUE[e.league] || e.kind !== 'match' || e.status.state !== 'pre') return null;
  return polymarketNow(e.league, { start: e.start, home: e.home.en || e.home.name, away: e.away.en || e.away.name }, (url, { trim = '', kind }) => getJson(url, { trim, ttl: PM_TTL[kind] }));
}
export async function winLine(e) {
  if (!PM_LEAGUE[e.league] || e.kind !== 'match' || (e.status.state !== 'in' && e.status.state !== 'post')) return null;
  if (e.status.state === 'post' && kit.packJson) {
    const month = await kit.packJson(monthPack(e.league, e.start), { ttl: 6 * 3_600_000 }).catch(() => null);
    const kept = month?.games?.[gameKey(e.league, e)];
    if (kept?.none) return null;
    if (kept) return unpackLine(kept);
  }
  return polymarketLine(e.league, { start: e.start, home: e.home.en || e.home.name, away: e.away.en || e.away.name }, (url, { trim = '', kind }) =>
    getJson(url, { trim, ttl: PM_TTL[kind] ?? (e.status.state === 'in' ? 60_000 : 6 * 3_600_000) })
  );
}

// An F1 race's chance for each driver (Polymarket's winner market): a race
// over, kept in Shared-Data (winprob/f1, by lap), else read by lap from
// OpenF1's laps; a race on, by the clock (OpenF1 is closed while it runs);
// a race to come, each driver's chance now. Null where there's no market.
export async function raceWinLine(ss) {
  const state = ss.status.state;
  if (state === 'pre') return raceNow(ss.start, (url, { trim = '', kind }) => getJson(url, { trim, ttl: PM_TTL[kind] ?? 5 * 60_000 }));
  if (state === 'post' && kit.packJson) {
    const month = await kit.packJson(monthPack('f1', ss.start), { ttl: 6 * 3_600_000 }).catch(() => null);
    const kept = month?.games?.[raceKey(ss.start)];
    if (kept?.none) return null;
    if (kept) return unpackRace(kept);
  }
  const get = (url, { trim = '', kind }) => getJson(url, { trim, ttl: PM_TTL[kind] ?? (state === 'in' ? 60_000 : 6 * 3_600_000) });
  const laps = state === 'post' ? await raceLaps(ss.start, get).catch(() => null) : null;
  const line = await raceLine(ss.start, get, laps);
  // What turned it (the safety car, the drawn drivers' stops and leads), once the laps are in.
  if (line && laps) Object.assign(line, (await raceEvents(ss.start, get, laps, line.drivers).catch(() => null)) || {});
  return line;
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
          // A driver by their full name, on a phone too (G. Russell is George
          // Russell everywhere else in the app; an F1 table has room for it).
          const full = a.displayName || a.name || '';
          return { id: String(a.id ?? ''), name: full, short: full || a.shortName || '', en: full, logo: a.flag?.href || '', note: '', color: '', stats, athlete: true };
        }
        // ESPN's clinch mark (MLB's, the NBA's: x, y, z clinched; e eliminated, its own math, divisions in).
        const clincher = String((en.stats || []).find(x => x.name === 'clincher')?.displayValue || '').trim();
        const row = { id: String(en.team?.id ?? ''), name: en.team?.displayName || en.team?.name || '', short: en.team?.shortDisplayName || en.team?.abbreviation || '', logo: logoOf(en.team), note: en.note?.description || '', color: en.note ? zoneColor(en.note.description, en.note.color) : en.team?.color && !en.team?.logos ? `#${en.team.color}` : '', stats, ...(clincher ? { clincher } : {}) };
        // F1's constructors in Chinese (麥拉倫, 法拉利), the English kept for matching.
        if (league === 'f1' && detectLocale() !== 'en') {
          const zh = f1Constructor(row.name).zh;
          if (zh && zh !== row.name) return { ...row, en: row.name, name: zh, short: zh };
        }
        return league ? localSide(league, row) : row;
      });
      // ESPN's list can be out of order (MLB's first seed last, a Nations
      // League group's leader last): by its playoff seed when every team has
      // one, else by the rank it gives each.
      const stat = name => node.standings.entries.map(en => Number((en.stats || []).find(x => x.name === name)?.value));
      const seeds = stat('playoffSeed');
      const ranks = stat('rank');
      const by = seeds.every(n => n > 0) ? seeds : ranks.every(n => n > 0) ? ranks : null;
      const ordered = by ? rows.map((r, i) => [r, by[i], i]).sort((x, y) => x[1] - y[1] || x[2] - y[2]).map(([r]) => r) : rows;
      // A championship's rounds (F1's: a column a weekend, its points, blank until counted).
      const rounds = (node.standings.entries[0]?.stats || []).filter(x => /^[A-Z]{3}$/.test(x.abbreviation || '') && /grand prix/i.test(x.displayName || '')).map(x => ({ key: x.abbreviation, name: x.displayName }));
      groups.push({ name: groupZh(node.name || node.displayName || '', detectLocale()), en: node.name || node.displayName || '', rows: ordered, ...(rounds.length ? { rounds } : {}) });
    }
    for (const child of node?.children || []) walk(child);
  };
  walk(data);
  return tierZones(groups);
}
// A zone's bar colour, by what it is: ESPN's own run together (Europa
// League and the Conference League both #B2BFD0) and are sometimes broken
// ("##B5E7CE"). Each of Europe's three cups its own colour (green, blue,
// purple; a qualifying round of one a paler shade), a way out red.
const ZONE_COLORS = [
  [/round of 16|\bqfs?\b|quarter-?final/i, '#81D6AC'],
  [/play-?offs?.*\bunseeded/i, '#6CA6F0'],
  [/play-?offs?.*\bseeded/i, '#B5E7CE'],
  [/champions league qualif/i, '#B5E7CE'],
  [/champions league/i, '#81D6AC'],
  [/europa league qualif/i, '#A9C8F5'],
  [/europa league/i, '#6CA6F0'],
  [/conference league qualif/i, '#C9B5F2'],
  [/conference league/i, '#A88BEB'],
  [/relegation or|relegation play/i, '#FEB4B5'],
  [/relegat|eliminat/i, '#FF7F84'],
  [/promotion play/i, '#B5E7CE'],
  [/promotion/i, '#81D6AC']
];
export function zoneColor(note, color) {
  const own = ZONE_COLORS.find(([re]) => re.test(note || ''))?.[1];
  if (own) return own;
  const c = String(color || '').replace(/^#+/, '');
  return /^[0-9a-f]{3,8}$/i.test(c) ? `#${c}` : '';
}
// A competition's zones said once for all its tiers (the Nations League's:
// only group A1's rows carry them, each place's for every tier at once, "A:
// Qualifies for QFs; B-D: Promotion"): each group's place gets the part for
// its own tier (Group B3's first: Promotion), the colour with it; a place
// with no part for its tier, none.
export function tierZones(groups) {
  const tier = g => /^Group ([A-D])\d/i.exec(g.en || '')?.[1]?.toUpperCase() || '';
  if (!groups.length || !groups.every(tier)) return groups;
  const byPlace = [];
  for (const g of groups) g.rows.forEach((r, i) => r.note && !byPlace[i] && (byPlace[i] = { note: r.note, color: r.color }));
  if (!byPlace.some(x => x && /\b[A-D](\s*[-,]\s*[A-D])*\s*:/.test(x.note))) return groups;
  const partFor = (note, t) => {
    for (const part of note.split(';')) {
      const m = /^\s*([A-D](?:\s*[-,]\s*[A-D])*)\s*:\s*(.+?)\s*$/i.exec(part);
      if (!m) continue;
      const letters = m[1].toUpperCase();
      const range = /([A-D])\s*-\s*([A-D])/.exec(letters);
      const has = range ? t >= range[1] && t <= range[2] : letters.split(/\s*,\s*/).includes(t);
      if (has) return m[2];
    }
    return '';
  };
  return Object.assign(
    groups.map(g => ({
      ...g,
      rows: g.rows.map((r, i) => {
        const z = byPlace[i];
        const note = z ? partFor(z.note, tier(g)) : '';
        return { ...r, note, color: note ? zoneColor(note, z.color) : '' };
      })
    })),
    { year: groups.year }
  );
}
// A league's tables this season. The array carries the season's year.
// `season`: a past season's (its year as ESPN numbers it), kept a day.
export async function standings(league, { season = null } = {}) {
  const l = LEAGUES[league];
  if (l.asia) return asiaStandings(league, season);
  // The regular season's table: ESPN's default counts pre-season games in
  // (the NBA's in October: Toronto 0-1 before a real game).
  const query = [['baseball', 'basketball', 'football', 'hockey'].includes(l.sport) ? 'seasontype=2' : '', season ? `season=${season}` : ''].filter(Boolean).join('&');
  const data = await getJson(`${STANDINGS}/${l.espn}/standings${query ? `?${query}` : ''}`, { ttl: season ? 86_400_000 : 10 * 60_000 });
  const groups = withGaps(parseStandings(data, league), l.sport);
  groups.year = data?.season?.year ?? data?.children?.[0]?.standings?.season?.year ?? null;
  return groups;
}
// CPBL's tables: the league's own (Shared-Data's nightly copy: the half on
// now, the other half, the year), with the games finished since it was
// built put in (a night's games before midnight). Only this season's.
export const cpblPack = async () => kit.packJson('sports/cpbl/standings.json', { ttl: 30 * 60_000 });
export async function asiaStandings(league, season = null) {
  if (league !== 'cpbl') return [];
  const [pack, events] = await Promise.all([cpblPack(), asiaEvents(league).catch(() => [])]);
  if (season && pack?.year && season !== pack.year) return [];
  return cpblTable(pack, events, detectLocale());
}
const pct = (w, l) => (w + l ? (w / (w + l)).toFixed(3).replace(/^0/, '') : '.000');
const HALF = { first: ['上半季', 'First half'], second: ['下半季', 'Second half'], year: ['全年', 'Full season'] };
export function cpblTable(pack, events = [], lang = 'zh') {
  const tables = pack?.tables?.length ? pack.tables : [];
  if (!tables.length) return [];
  const play = LEAGUES.cpbl?.play || 'cpbl';
  const built = Date.parse(pack.built) || 0;
  // The games since it was built, in the half on now and the year: none
  // once each side's 60 of the half are in.
  const now = tables.find(t => t.key === pack.half) || tables[0];
  const halfOver = now.rows.every(r => r.gp >= 60);
  // (Never a play-off game: the season's table is the regular season's.)
  const later = halfOver ? [] : events.filter(e => e.status?.state === 'post' && !e.status.void && !e.playoff && Date.parse(e.start) + 3 * 3_600_000 > built);
  const groups = tables.map(t => {
    const rows = t.rows.map(r => ({ ...r }));
    if (t === now || t.key === 'year') {
      const byId = new Map(rows.map(r => [r.en, r]));
      for (const e of later) {
        const [h, a] = [Number(e.home?.score), Number(e.away?.score)];
        const [hr, ar] = [byId.get(e.home?.id), byId.get(e.away?.id)];
        if (!hr || !ar || !Number.isFinite(h) || !Number.isFinite(a)) continue;
        for (const [r, mine, theirs] of [[hr, h, a], [ar, a, h]]) {
          r.gp++;
          if (mine === theirs) r.t++;
          else r[mine > theirs ? 'w' : 'l']++;
          r.streak = '';
          r.last10 = '';
        }
      }
      if (later.length) rows.sort((x, y) => y.w / (y.w + y.l || 1) - x.w / (x.w + x.l || 1) || y.w - x.w);
    }
    const top = rows[0];
    const [zhName, enName] = HALF[t.key] || [t.title, t.title];
    return {
      name: lang === 'en' ? `${enName} ${pack.year || ''}`.trim() : `${pack.year ? `${pack.year} ` : ''}${zhName}`,
      rows: rows.map(r => {
        const gb = (top.w - r.w + r.l - top.l) / 2;
        const zh = teamNameZh(play, r.en, 'baseball');
        return {
          id: r.en,
          name: lang === 'en' ? r.en : zh?.full || r.zh,
          short: lang === 'en' ? r.en : zh?.short || r.zh,
          en: r.en,
          logo: teamBadge(play, r.en),
          note: '',
          color: '',
          stats: { GP: String(r.gp), W: String(r.w), L: String(r.l), ...(r.t ? { T: String(r.t) } : {}), PCT: pct(r.w, r.l), GB: gb === 0 ? '-' : String(gb), STRK: r.streak || '', L10: r.last10 || '' }
        };
      })
    };
  });
  groups.year = pack.year || null;
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
    // ESPN's English short name ("Man City"), kept once the Chinese one is in (a story's headline names it).
    enShort: t.shortDisplayName || '',
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
// A club's home league: { key, name }: key when it's one of ours (a Nations
// League player at Arsenal: epl), else null with the league's own name
// (Omonia Aradippou: "Cypriot First Division", not ours). A league's own
// clubs are its own; a cup's (a national side's player's club) asked of
// ESPN (the team's defaultLeague).
export async function homeLeague(league, id) {
  if (!LEAGUES[league]?.cup) return { key: league, name: '' };
  const sport = (LEAGUES[league].espn || '').split('/')[0];
  const data = await getJson(`${SITE}/${clubPath(league)}/teams/${encodeURIComponent(id)}`, { ttl: 24 * 3_600_000 }).catch(() => null);
  const home = data?.team?.defaultLeague;
  return { key: home?.slug ? BY_PATH[`${sport}/${home.slug}`] || null : null, name: home?.name || '' };
}
// A footballer's own league: ESPN's search places a player by the last
// competition they played in (a Nations League in an international break,
// Haaland "of" it), so one found in a cup is placed in their club's league
// when that's one of ours; a player whose club isn't ours stays where found.
export async function playerHome(league, id) {
  if (!LEAGUES[league]?.cup || !LEAGUES[league].espn?.startsWith('soccer/')) return league;
  const a = await athlete(league, id);
  if (!a.teamId) return league;
  const { key } = await homeLeague(league, a.teamId);
  if (key && key !== league) return key;
  // A club of another league (Pavlidis at Benfica, found in the Nations
  // League): its European cup, when it has one this season.
  if (!key) {
    const cup = (await europeanClubs().catch(() => new Map())).get(String(a.teamId));
    if (cup && cup !== league) return cup;
  }
  return league;
}
// The clubs in each European cup this season: a club's id → 'ucl' | 'uel'
// | 'uecl' (the highest it plays in). Kept a day: a cup's clubs are set
// before its league phase.
const EURO_CUPS = ['uecl', 'uel', 'ucl'];
export async function europeanClubs() {
  const lists = await Promise.all(EURO_CUPS.map(k => getJson(`${SITE}/${LEAGUES[k].espn}/teams`, { ttl: 24 * 3_600_000 }).then(d => [k, d], () => [k, null])));
  if (lists.every(([, d]) => !d)) throw new Error('European cups unread');
  const out = new Map();
  for (const [k, d] of lists) for (const t of d?.sports?.[0]?.leagues?.[0]?.teams || []) if (t.team?.id) out.set(String(t.team.id), k);
  return out;
}
// A footballer's club id, from any soccer league's path (their own league's slug).
export async function clubOfPlayer(slug, id) {
  const data = await getJson(`${COMMON}/soccer/${slug}/athletes/${encodeURIComponent(id)}`, { ttl: 60 * 60_000 });
  return parseAthlete(data).teamId || null;
}
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
    return { id: String(e.id), league: lg, kind: 'match', name: e.name, short: e.shortName, ...startOf(e.date, comp), status: parseStatus(comp?.status), home, away, venue: comp?.venue?.fullName || '', note: comp?.notes?.[0]?.headline || '', ...(own ? {} : { other: e.league?.name || e.league?.abbreviation || '' }) };
  });
}
// A team's season: its results and the games to come. A soccer club's across
// all its competitions: ESPN gives the results, and the fixtures on their own.
export async function teamSchedule(league, id) {
  const base = `${SITE}/${clubPath(league)}/teams/${encodeURIComponent(id)}/schedule`;
  if (clubPath(league) !== 'soccer/all') {
    // In the playoffs ESPN gives only the playoff games: the regular season before them too.
    const data = await getJson(base, { ttl: 3 * 60_000 });
    const earlier = data?.requestedSeason?.type === 3 ? await getJson(`${base}?seasontype=2`, { ttl: 60 * 60_000 }).catch(() => null) : null;
    const seen = new Set();
    const games = [...parseSchedule(earlier, league), ...parseSchedule(data, league)].filter(e => !seen.has(e.id) && seen.add(e.id)).map(freshGame);
    if (league === 'mlb') await loadPostseason(games);
    return (league === 'mlb' ? byMlbPostseason(games) : games).sort((a, b) => a.start.localeCompare(b.start));
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
// A team's players hurt now, from its roster: ESPN's game page leaves some
// out (LeBron James, out for rest, missing from a game's list while his own
// page says day-to-day). Read through the proxy, never the nightly copy
// (`enable=injuries` keeps it off the mirror): injuries change on game day.
export function parseRosterInjuries(data) {
  return (data?.athletes || [])
    .flatMap(x => (Array.isArray(x?.items) ? x.items : [x]))
    .filter(a => a?.injuries?.length)
    .map(a => ({ id: String(a.id ?? ''), headshot: freshHeadshot(a.headshot?.href) || null, name: a.displayName || a.fullName || '', status: a.injuries[0].status || a.injuries[0].type?.description || '', detail: '' }));
}
export async function teamInjuries(league, id) {
  return parseRosterInjuries(await getJson(`${SITE}/${LEAGUES[league].espn}/teams/${encodeURIComponent(id)}/roster?enable=injuries`, { ttl: 10 * 60_000, trim: 'espn-roster' }));
}
// A game's injuries ([{ team, list }]) with each team's own (byTeam: { id:
// list }) added: everyone on either, the game page's word first.
export function mergeInjuries(injuries = [], byTeam = {}) {
  const out = injuries.map(t => ({ ...t, list: [...t.list] }));
  for (const [team, list] of Object.entries(byTeam)) {
    let t = out.find(x => x.team === team);
    if (!t) out.push((t = { team, list: [] }));
    for (const x of list || []) if (!t.list.some(y => (x.id && y.id === x.id) || y.name === x.name)) t.list.push(x);
  }
  return out;
}
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
    teamLogo: a.team?.logos?.[0]?.href || a.team?.logo || '',
    age: a.age || null,
    born: a.displayDOB || '',
    dob: a.dateOfBirth || '',
    birthPlace: a.displayBirthPlace || '',
    height: a.displayHeight || '',
    weight: a.displayWeight || '',
    status: a.status?.name || '',
    injuries: (a.injuries || []).map(i => i.status || i.type?.description).filter(Boolean),
    // The latest injury report: its status, what and where, when they're due back, ESPN's word on it.
    injury: a.injuries?.[0] ? { status: a.injuries[0].status || a.injuries[0].type?.description || '', date: a.injuries[0].date || '', what: [a.injuries[0].details?.type, a.injuries[0].details?.location].filter(x => x && x !== 'Other').join(' '), back: a.injuries[0].details?.returnDate || '', comment: a.injuries[0].longComment || a.injuries[0].shortComment || '' } : null,
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
// Our league for ESPN's full name of a competition ("English Premier League",
// "UEFA Nations League"): ours with its country or body's word in front (the
// saved copies of a player's page carry no links to read the slug from).
// Another country's "Premier League" keeps its own word, so it's no match.
const FRONT = /^(english|scottish|spanish|italian|german|french|uefa|fifa)\s+/;
const plainName = x => String(x || '').toLowerCase().replace(FRONT, '').trim();
export function leagueByName(name) {
  const n = String(name || '').toLowerCase().trim();
  if (!n) return '';
  return Object.keys(LEAGUES).find(k => LEAGUES[k].espn?.startsWith('soccer/') && [n, plainName(n)].includes(plainName(LEAGUES[k].en))) || '';
}
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
      // Its competition (a Nations League game among a club's), ours by the
      // slug in ESPN's app link, else only its name; and the score from the
      // player's side (1-2 lost, not ESPN's winner-first 2-1).
      const slug = /[?&]leagueAbbrev=([^&]+)/.exec((g.links || []).map(l => l.href).join(' '))?.[1] || '';
      const sport = /[?&]sportName=([^&]+)/.exec((g.links || []).map(l => l.href).join(' '))?.[1] || '';
      const own = (sport && slug ? BY_PATH[`${sport}/${decodeURIComponent(slug)}`] : '') || leagueByName(g.leagueName) || '';
      const mine = String(g.team?.id ?? '');
      const home = mine && String(g.homeTeamId) === mine;
      const [us, them] = home ? [g.homeTeamScore, g.awayTeamScore] : [g.awayTeamScore, g.homeTeamScore];
      const score = us != null && them != null && us !== '' && them !== '' ? `${us}-${them}` : g.score || '';
      return { id: String(x.eventId), date: g.gameDate || '', at: g.atVs || 'vs', league: own, leagueName: g.leagueShortName || g.leagueName || '', team: { id: mine, abbr: g.team?.abbreviation || '', logo: logoOf(g.team) }, home: mine ? home : null, opp: { id: String(g.opponent?.id ?? ''), name: g.opponent?.displayName || '', abbr: g.opponent?.abbreviation || '', logo: logoOf(g.opponent) }, result: g.gameResult || '', score, stats: (x.stats || []).slice(0, n) };
    })
    .filter(Boolean);
  return games.length ? { title: block.displayName || '', labels: block.labels.slice(0, n), games } : null;
}
export async function athleteOverview(league, id) {
  const ov = parseOverview(await getJson(`${COMMON}/${LEAGUES[league].espn}/athletes/${encodeURIComponent(id)}/overview`, { ttl: 60 * 60_000 }));
  // A game's league: the one it names, else (one league to a sport: the NBA's, MLB's) the player's own.
  // Only the competitions Orbit Sports has (a friendly, another country's
  // cup: nothing of theirs to open or name), the last five of them.
  if (ov.log) {
    ov.log.games = ov.log.games.map(g => ({ ...g, league: g.league || (LEAGUES[league].espn.startsWith('soccer/') ? '' : league), opp: nbaLogo(league, g.opp) })).filter(g => LEAGUES[g.league]).slice(0, 5);
    if (!ov.log.games.length) ov.log = null;
  }
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

// ---- Injury report (ESPN's) ----------------------------------------------------------------
//
// A league's whole injury report in one read ({ teamId: [player] }): NBA,
// WNBA, NFL, NHL and MLB have one; the rest answer none. Live (ten minutes):
// statuses change on game day.
export function parseLeagueInjuries(data) {
  const out = {};
  for (const t of data?.injuries || []) {
    const list = (t.injuries || [])
      .filter(i => i.athlete?.displayName)
      .map(i => ({
        id: String(i.athlete.links?.find(l => l.rel?.includes('playercard'))?.href?.match(/\/id\/(\d+)/)?.[1] ?? ''),
        name: i.athlete.displayName,
        headshot: freshHeadshot(i.athlete.headshot?.href) || null,
        status: i.status || i.type?.description || '',
        what: [i.details?.type, i.details?.detail].filter(x => x && x !== 'Other' && x !== 'Not Specified').join(' '),
        back: i.details?.returnDate || '',
        date: i.date || '',
        comment: i.shortComment || i.longComment || ''
      }));
    if (list.length) out[String(t.id)] = list;
  }
  return out;
}
export async function leagueInjuries(league) {
  const l = LEAGUES[league];
  if (!l?.espn || l.espn.startsWith('soccer/')) return {};
  return parseLeagueInjuries(await getJson(`${SITE}/${l.espn}/injuries`, { ttl: 10 * 60_000 }));
}
