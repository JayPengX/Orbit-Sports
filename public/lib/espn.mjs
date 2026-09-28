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
import { LEAGUES } from './leagues.mjs';

export const PROXY = 'https://sports-proxy.pengzjay.workers.dev/sports-proxy';
export const SITE = 'https://site.api.espn.com/apis/site/v2/sports';
export const STANDINGS = 'https://site.api.espn.com/apis/v2/sports';
export const COMMON = 'https://site.api.espn.com/apis/common/v3/sports';
const KAMBI = 'https://eu-offering-api.kambicdn.com/offering/v2018/ub';

let session = null;
export const useSession = s => (session = s);

// ---- Fetching ------------------------------------------------------------------

const MAX = 6;
let running = 0;
const waiting = [];
async function slot(task) {
  if (running >= MAX) await new Promise(resolve => waiting.push(resolve));
  running++;
  try {
    return await task();
  } finally {
    running--;
    waiting.shift()?.();
  }
}
const memo = new Map();
// A short memory on top of the proxy's cache: a sheet opened twice doesn't
// fetch twice (live data is kept only 20 seconds).
export async function getJson(url, { ttl = 60_000, trim = '' } = {}) {
  const hit = memo.get(url);
  if (hit && Date.now() - hit.at < ttl) return hit.promise;
  const promise = slot(async () => {
    const token = session ? await session.ensureToken().catch(() => session.token) : '';
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(`${PROXY}?url=${encodeURIComponent(url)}${trim ? `&trim=${trim}` : ''}${token ? `&qt=${encodeURIComponent(token)}` : ''}`, { signal: AbortSignal.timeout(20_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (error) {
        if (attempt >= 1) throw error;
        await new Promise(r => setTimeout(r, 700));
      }
    }
  });
  memo.set(url, { at: Date.now(), promise });
  promise.catch(() => memo.delete(url));
  if (memo.size > 400) memo.delete(memo.keys().next().value);
  return promise;
}

export const yyyymmdd = date => date.toISOString().slice(0, 10).replaceAll('-', '');
// ESPN files a game under the US date; a Taiwan day spans two of them.
export function espnDatesFor(taipeiDate) {
  const d = new Date(`${taipeiDate}T00:00:00+08:00`);
  return [...new Set([yyyymmdd(new Date(d.getTime() - 12 * 3_600_000)), yyyymmdd(new Date(d.getTime() + 11 * 3_600_000))])];
}
export const taipeiDate = t => new Date(new Date(t).getTime() + 8 * 3_600_000).toISOString().slice(0, 10);

// ---- Parsing: statuses and sides --------------------------------------------------

const VOID = /POSTPONED|CANCELED|CANCELLED|SUSPENDED|FORFEIT|ABANDONED|DELAYED/;
export function parseStatus(s) {
  const type = s?.type || {};
  return {
    state: type.state || 'pre',
    detail: type.detail || type.description || '',
    short: type.shortDetail || type.detail || '',
    completed: Boolean(type.completed),
    void: VOID.test(type.name || ''),
    clock: s?.displayClock || '',
    period: s?.period || 0
  };
}

const logoOf = team => team?.logo || team?.logos?.[0]?.href || null;
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
    logo: logoOf(team) || athlete.flag?.href || athlete.headshot?.href || null,
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

export function parseScoreboard(data, league) {
  const kind = LEAGUES[league]?.kind || 'match';
  const out = [];
  for (const e of data?.events || []) {
    const comp = e.competitions?.[0];
    const base = {
      id: String(e.id),
      league,
      kind,
      name: e.name || '',
      short: e.shortName || '',
      start: e.date,
      end: e.endDate || null,
      status: parseStatus(e.status || comp?.status),
      venue: comp?.venue?.fullName || e.venue?.fullName || e.circuit?.fullName || '',
      tv: [...new Set((comp?.broadcasts || []).flatMap(b => b.names || []))].join(' · '),
      note: comp?.notes?.[0]?.headline || e.competitions?.[0]?.series?.summary || ''
    };
    if (kind === 'match' && comp) {
      const home = parseSide(comp.competitors?.find(c => c.homeAway === 'home') || comp.competitors?.[0]);
      const away = parseSide(comp.competitors?.find(c => c.homeAway === 'away') || comp.competitors?.[1]);
      if (!home || !away) continue;
      out.push({ ...base, home, away, neutral: Boolean(comp.neutralSite), situation: comp.situation?.lastPlay?.text || '' });
    } else if (kind === 'draw') {
      // A tennis tournament: its singles draws' matches.
      const draws = (e.groupings || []).map(g => ({
        name: g.grouping?.displayName || '',
        matches: (g.competitions || []).map(m => ({
          id: String(m.id),
          round: m.round?.displayName || m.type?.text || '',
          start: m.date || m.startDate,
          status: parseStatus(m.status),
          a: parseSide(m.competitors?.[0]),
          b: parseSide(m.competitors?.[1])
        }))
      }));
      out.push({ ...base, draws });
    } else if (kind === 'card') {
      const bouts = (e.competitions || []).map(m => ({
        id: String(m.id),
        weight: m.type?.text || m.note || '',
        start: m.date,
        status: parseStatus(m.status),
        a: parseSide(m.competitors?.[0]),
        b: parseSide(m.competitors?.[1])
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
        field: [...(m.competitors || [])].sort((a, b) => (a.order ?? 999) - (b.order ?? 999)).map(parseSide)
      }));
      out.push({ ...base, sessions });
    }
  }
  return out;
}

export async function scoreboard(league, dates) {
  const l = LEAGUES[league];
  if (l?.kambi) return kambiEvents(league);
  const list = [].concat(dates || []);
  const pages = list.length ? await Promise.all(list.map(d => getJson(`${SITE}/${l.espn}/scoreboard?dates=${d}&limit=200`, { ttl: 20_000 }).catch(() => null))) : [await getJson(`${SITE}/${l.espn}/scoreboard`, { ttl: 20_000 })];
  const seen = new Set();
  return pages
    .filter(Boolean)
    .flatMap(p => parseScoreboard(p, league))
    .filter(e => !seen.has(e.id) && seen.add(e.id));
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

// ---- Kambi (NPB, KBO, CPBL, EuroLeague, B.League, racket sports) --------------------

export function parseKambi(data, league) {
  const out = [];
  for (const item of data?.events || []) {
    const e = item.event;
    if (!e?.homeName || !e?.awayName) continue;
    const live = item.liveData;
    const state = e.state === 'STARTED' ? 'in' : e.state === 'FINISHED' ? 'post' : 'pre';
    // Set scores (tennis, volleyball…) or, for baseball, the innings in the score's info ("1-0 | 0-2 | …").
    const info = String(live?.score?.info || '').split('|').map(x => x.trim().split('-'));
    const innings = info.length > 1 && info.every(x => x.length === 2) ? { home: info.map(x => x[0]), away: info.map(x => x[1]) } : null;
    const sets = live?.statistics?.sets;
    const side = (name, key) => ({
      id: name,
      name,
      short: name,
      abbr: name.slice(0, 3).toUpperCase(),
      logo: null,
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
      home: side(e.homeName, 'home'),
      away: side(e.awayName, 'away'),
      kambi: true
    });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}
export async function kambiEvents(league) {
  const parts = LEAGUES[league].kambi.split('/');
  while (parts.length < 4) parts.push('all');
  const data = await getJson(`${KAMBI}/listView/${parts.join('/')}/matches.json?lang=en_GB&market=GB&useCombined=true`, { ttl: 60_000, trim: 'kambi-events' });
  return parseKambi(data, league);
}

// ---- A match's summary --------------------------------------------------------------

export function parseSummary(data, league) {
  const header = data?.header?.competitions?.[0];
  const sides = (header?.competitors || []).map(parseSide);
  const byId = Object.fromEntries(sides.map(s => [s.id, s]));
  const box = data?.boxscore || {};
  // Team stats, paired: [{ label, home, away }].
  const teamStats = [];
  const home = box.teams?.find(t => t.homeAway === 'home') || box.teams?.[1];
  const away = box.teams?.find(t => t.homeAway === 'away') || box.teams?.[0];
  const flat = t => {
    const out = new Map();
    for (const s of t?.statistics || []) {
      if (Array.isArray(s.stats)) for (const x of s.stats) out.set(x.name, { label: x.displayName || x.label || x.name, value: x.displayValue });
      else out.set(s.name, { label: s.label || s.displayName || s.name, value: s.displayValue });
    }
    return out;
  };
  const hs = flat(home);
  const as = flat(away);
  for (const [key, h] of hs) if (as.has(key) && h.value !== undefined) teamStats.push({ key, label: h.label, home: h.value, away: as.get(key).value });
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
    players: (r.roster || []).map(x => ({ id: String(x.athlete?.id ?? ''), name: x.athlete?.displayName || '', jersey: x.jersey || '', pos: x.position?.abbreviation || '', starter: Boolean(x.starter) }))
  }));
  const leaders = (data?.leaders || []).flatMap(t =>
    (t.leaders || []).map(l => ({ team: String(t.team?.id ?? ''), stat: l.displayName || l.name, name: l.leaders?.[0]?.athlete?.shortName || l.leaders?.[0]?.athlete?.displayName || '', value: l.leaders?.[0]?.displayValue || '' }))
  );
  const injuries = (data?.injuries || []).map(t => ({ team: String(t.team?.id ?? ''), list: (t.injuries || []).map(i => ({ name: i.athlete?.displayName || '', status: i.status || i.type?.description || '', detail: i.details?.type || '' })) }));
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
export function parseStandings(data) {
  const groups = [];
  const walk = node => {
    if (node?.standings?.entries?.length) {
      const rows = node.standings.entries.map(en => {
        const stats = Object.fromEntries((en.stats || []).map(s => [s.abbreviation || s.name, s.displayValue]));
        // A championship of drivers (F1) has athletes where a league has teams.
        if (!en.team && en.athlete) {
          const a = en.athlete;
          return { id: String(a.id ?? ''), name: a.displayName || a.name || '', short: a.shortName || a.displayName || '', logo: a.flag?.href || '', note: '', color: '', stats, athlete: true };
        }
        return { id: String(en.team?.id ?? ''), name: en.team?.displayName || en.team?.name || '', short: en.team?.shortDisplayName || en.team?.abbreviation || '', logo: logoOf(en.team), note: en.note?.description || '', color: en.note?.color || (en.team?.color && !en.team?.logos ? `#${en.team.color}` : ''), stats };
      });
      groups.push({ name: node.name || node.displayName || '', rows });
    }
    for (const child of node?.children || []) walk(child);
  };
  walk(data);
  return groups;
}
export async function standings(league) {
  const l = LEAGUES[league];
  return parseStandings(await getJson(`${STANDINGS}/${l.espn}/standings`, { ttl: 10 * 60_000 }));
}
// Which columns a table shows, by sport (only those present).
export const STANDING_COLUMNS = {
  soccer: ['GP', 'W', 'D', 'L', 'GD', 'P'],
  baseball: ['W', 'L', 'PCT', 'GB', 'STRK'],
  basketball: ['W', 'L', 'PCT', 'GB', 'STRK'],
  football: ['W', 'L', 'T', 'PCT', 'STRK'],
  hockey: ['GP', 'W', 'L', 'OTL', 'PTS'],
  rugby: ['GP', 'W', 'L', 'PTS'],
  aussie: ['GP', 'W', 'L', 'PTS'],
  racing: ['PTS']
};

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
    next: (t.nextEvent || []).map(e => ({ id: String(e.id), name: e.name, short: e.shortName, start: e.date }))
  };
}
export async function team(league, id) {
  return parseTeam(await getJson(`${SITE}/${LEAGUES[league].espn}/teams/${encodeURIComponent(id)}`, { ttl: 10 * 60_000 }));
}
export function parseSchedule(data, league) {
  return (data?.events || []).map(e => {
    const comp = e.competitions?.[0];
    const home = parseSide(comp?.competitors?.find(c => c.homeAway === 'home'));
    const away = parseSide(comp?.competitors?.find(c => c.homeAway === 'away'));
    return { id: String(e.id), league, kind: 'match', name: e.name, short: e.shortName, start: e.date, status: parseStatus(comp?.status), home, away, venue: comp?.venue?.fullName || '' };
  });
}
export async function teamSchedule(league, id) {
  return parseSchedule(await getJson(`${SITE}/${LEAGUES[league].espn}/teams/${encodeURIComponent(id)}/schedule`, { ttl: 10 * 60_000 }), league);
}
export function parseRoster(data) {
  const groups = Array.isArray(data?.athletes?.[0]?.items) ? data.athletes : [{ position: '', items: data?.athletes || [] }];
  return groups.map(g => ({
    name: g.position || '',
    players: (g.items || []).map(a => ({ id: String(a.id), name: a.displayName || a.fullName, jersey: a.jersey || '', pos: a.position?.abbreviation || '', age: a.age || null, headshot: a.headshot?.href || null, injured: Boolean(a.injuries?.length) }))
  }));
}
export async function roster(league, id) {
  return parseRoster(await getJson(`${SITE}/${LEAGUES[league].espn}/teams/${encodeURIComponent(id)}/roster`, { ttl: 60 * 60_000 }));
}
export function parseAthlete(data) {
  const a = data?.athlete || {};
  return {
    id: String(a.id ?? ''),
    name: a.displayName || '',
    headshot: a.headshot?.href || null,
    jersey: a.jersey || '',
    position: a.position?.displayName || '',
    team: a.team?.displayName || '',
    teamId: String(a.team?.id ?? ''),
    teamLogo: logoOf(a.team),
    age: a.age || null,
    born: a.displayDOB || '',
    birthPlace: a.displayBirthPlace || '',
    height: a.displayHeight || '',
    weight: a.displayWeight || '',
    status: a.status?.name || '',
    injuries: (a.injuries || []).map(i => i.status || i.type?.description).filter(Boolean),
    stats: { title: a.statsSummary?.displayName || '', list: (a.statsSummary?.statistics || []).map(s => ({ label: s.shortDisplayName || s.abbreviation, name: s.displayName, value: s.displayValue, rank: s.rankDisplayValue || '' })) }
  };
}
export async function athlete(league, id) {
  return parseAthlete(await getJson(`${COMMON}/${LEAGUES[league].espn}/athletes/${encodeURIComponent(id)}`, { ttl: 60 * 60_000 }));
}
export async function teamsOf(league) {
  const data = await getJson(`${SITE}/${LEAGUES[league].espn}/teams`, { ttl: 24 * 3_600_000 });
  return (data?.sports?.[0]?.leagues?.[0]?.teams || []).map(x => ({ id: String(x.team.id), name: x.team.displayName, short: x.team.shortDisplayName, logo: logoOf(x.team), league }));
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
export function playGameId(event) {
  const key = LEAGUES[event.league]?.play;
  if (!key || event.kind !== 'match' || !event.home || !event.away) return null;
  return `${key}_${new Date(event.start).toISOString().slice(0, 13)}_${normalizeTeamName(event.away.name)}_${normalizeTeamName(event.home.name)}`.replaceAll(' ', '');
}
