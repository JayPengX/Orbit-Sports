// F1 drivers and teams as the official app shows them: formula1.com's own
// figures (the season's Grand Prix and Sprint numbers, the career's, the
// biography or the team's profile; through the proxy, trimmed to its grids)
// and each weekend's results from Jolpica (the grid, the finish, a retirement
// and the sprint).
import { getJson, feedEnded, feedStarted, feedOnAt } from './espn.mjs';
import { f1Driver } from '#kit/logos.mjs';
import { fold, surname } from './text.mjs';
import { POINTS } from './title.mjs';
import { F1_LIVE as LIVE, sameSession, feedParts, feedOver } from '#kit/f1live.mjs';

const F1 = 'https://www.formula1.com/en';
const JOLPICA = 'https://api.jolpi.ca/ergast/f1';
const CORE = 'https://sports.core.api.espn.com/v2/sports/racing/leagues/f1';
const HOUR = 3_600_000;

// The page's grids by their first label (the page's order can change).
const GRID_OF = { 'Season Position': 'season', 'Grand Prix Races': 'gp', 'Sprint Races': 'sprint', 'Grands Prix Entered': 'career', 'Date of Birth': 'bio', 'Full Team Name': 'profile' };
export const F1_LABELS = {
  'Season Position': '排名',
  'Season Points': '積分',
  'Grand Prix Races': '出賽',
  'Grand Prix Points': '積分',
  'Grand Prix Wins': '冠軍',
  'Grand Prix Podiums': '頒獎台',
  'Grand Prix Poles': '竿位',
  'Grand Prix Top 10s': '前十名',
  'DHL Fastest Laps': '最快圈',
  DNFs: '未完賽',
  'Sprint Races': '出賽',
  'Sprint Points': '積分',
  'Sprint Wins': '冠軍',
  'Sprint Podiums': '頒獎台',
  'Sprint Poles': '竿位',
  'Sprint Top 10s': '前十名',
  'Grands Prix Entered': '參賽站數',
  'Career Points': '生涯積分',
  'Team Points': '歷年積分',
  'Highest Race Finish': '最佳完賽',
  Podiums: '頒獎台',
  'Highest Grid Position': '最佳發車位',
  'Pole Positions': '竿位',
  'World Championships': '世界冠軍',
  'Date of Birth': '出生日期',
  'Place of Birth': '出生地',
  'Full Team Name': '車隊全名',
  Base: '基地',
  'Team Chief': '領隊',
  'Technical Chief': '技術總監',
  Chassis: '底盤',
  'Power Unit': '動力單元',
  'Reserve Driver': '後備車手',
  'First Team Entry': '首次參賽'
};
// English labels shortened the way the app's tiles read inside a titled card.
const SHORT_EN = { 'Grand Prix ': '', 'Sprint ': '', 'DHL ': '', 'Season ': '' };
export function f1Label(label, en) {
  if (!en) return F1_LABELS[label] || label;
  let out = label;
  for (const [k, v] of Object.entries(SHORT_EN)) if (/^(Grand Prix|Sprint|DHL|Season) /.test(out) && out.startsWith(k)) out = out.replace(k, v);
  return out.replace(/^./, c => c.toUpperCase());
}
// "1 (x8)" → "1（8 次）", "1st" → "第 1", "25/08/2006" → "2006/08/25".
export function f1Value(value, en) {
  const v = String(value ?? '');
  const times = v.match(/^(\d+) \(x(\d+)\)$/);
  if (times) return en ? `P${times[1]} (×${times[2]})` : `P${times[1]}（${times[2]} 次）`;
  const nth = v.match(/^(\d+)(st|nd|rd|th)$/);
  if (nth) return en ? v : `第 ${nth[1]}`;
  const dmy = v.match(/^(\d\d)\/(\d\d)\/(\d{4})$/);
  if (dmy) return `${dmy[3]}/${dmy[2]}/${dmy[1]}`;
  return v;
}

// { season, gp, sprint, career, bio | profile }: each [[label, value], …].
export function f1Grids(grids) {
  const out = {};
  for (const g of grids || []) {
    const key = GRID_OF[g[0]?.[0]];
    if (key && !out[key]) out[key] = g;
  }
  return out;
}
export async function f1Page(kind, slug) {
  if (!slug) return {};
  const d = await getJson(`${F1}/${kind}/${slug}`, { ttl: 6 * HOUR });
  return f1Grids(d?.grids);
}

// A retirement in words (Jolpica's positionText and status).
const OUT = { R: ['退賽', 'DNF'], D: ['取消資格', 'DSQ'], E: ['除名', 'EXC'], W: ['未出賽', 'DNS'], F: ['未晉級', 'DNQ'], N: ['未列名次', 'NC'] };
const WHY_ZH = { Accident: '事故', Collision: '碰撞', 'Collision damage': '碰撞車損', Engine: '引擎', Gearbox: '變速箱', Transmission: '傳動系統', Hydraulics: '液壓', Brakes: '煞車', 'Power Unit': '動力單元', 'Power loss': '失去動力', 'Spun off': '打滑', Disqualified: '取消資格', Withdrew: '退出', Suspension: '懸吊', Electrical: '電子系統', Electronics: '電子系統', Overheating: '過熱', Puncture: '爆胎', Damage: '車損', Mechanical: '機械故障', 'Fuel pressure': '油壓', 'Water leak': '漏水', 'Oil leak': '漏油', Wheel: '車輪', 'Wheel nut': '輪轂螺帽', Illness: '身體不適', Driveshaft: '傳動軸', Battery: '電池', Cooling: '冷卻系統' };
export function finishOf(r, en) {
  if (!r) return null;
  const out = OUT[r.positionText];
  const pos = Number(r.position);
  return out
    ? { pos: 0, text: out[en ? 1 : 0], code: out[1], out: true, why: r.status && !/^(Retired|Did not start|Lapped|Finished)$/i.test(r.status) ? (en ? r.status : WHY_ZH[r.status] || r.status) : '' }
    : { pos, text: `P${pos}`, out: false, why: '' };
}
const mapRaces = (races, key) => new Map((races || []).map(r => [r.round, r[key] || []]));

// Jolpica's id for a driver by their name (its season's list, family name).
export async function jolpicaDriverId(name, year = new Date().getFullYear()) {
  const d = await getJson(`${JOLPICA}/${year}/drivers.json?limit=60`, { ttl: 12 * HOUR });
  const list = d?.MRData?.DriverTable?.Drivers || [];
  const n = fold(name);
  return (list.find(x => n.endsWith(fold(x.familyName)) && n.includes(fold(x.givenName).split(' ')[0])) || list.find(x => n.endsWith(fold(x.familyName))))?.driverId || '';
}
export const jolpicaConstructorId = name =>
  ({ 'Red Bull': 'red_bull', 'Racing Bulls': 'rb', RB: 'rb', 'Aston Martin': 'aston_martin', 'Kick Sauber': 'sauber', Sauber: 'sauber', Audi: 'audi', Haas: 'haas', Alpine: 'alpine', Williams: 'williams', McLaren: 'mclaren', Ferrari: 'ferrari', Mercedes: 'mercedes', Cadillac: 'cadillac' })[name] || String(name || '').toLowerCase().replace(/\s+/g, '_');

// Each weekend this season, latest first: { round, name, date, grid, finish,
// sprint, points } for a driver, or { …, cars: [{ driverId, grid, finish }],
// points } for a team (its points from the race and the sprint).
export async function seasonResults(kind, id, year = new Date().getFullYear()) {
  if (!id) return [];
  const base = `${JOLPICA}/${year}/${kind}/${id}`;
  const [race, sprint] = await Promise.all([getJson(`${base}/results.json?limit=100`, { ttl: HOUR }), getJson(`${base}/sprint.json?limit=100`, { ttl: HOUR }).catch(() => null)]);
  const sprints = mapRaces(sprint?.MRData?.RaceTable?.Races, 'SprintResults');
  return (race?.MRData?.RaceTable?.Races || [])
    .map(r => {
      const res = r.Results || [];
      const spr = sprints.get(r.round) || [];
      const points = [...res, ...spr].reduce((n, x) => n + Number(x.points || 0), 0);
      return {
        round: Number(r.round),
        name: r.raceName,
        circuit: r.Circuit?.circuitName || '',
        date: r.date,
        points,
        rows: res.map(x => ({ driverId: x.Driver?.driverId, code: x.Driver?.code, grid: Number(x.grid) || 0, result: x, sprint: spr.find(s => s.Driver?.driverId === x.Driver?.driverId) || null }))
      };
    })
    .sort((a, b) => b.round - a.round);
}

// The weekend in the app's own events (by the race's date), to open it.
export function eventOfRace(races, date) {
  const t = Date.parse(date);
  return (races || []).find(e => Math.abs(Date.parse(e.end || e.start) - t) < 3 * 86_400_000 || Math.abs(Date.parse(e.start) - t) < 3 * 86_400_000) || null;
}

// A driver's or team's official figures and this season's weekends together
// (either may be missing: the sheet falls back to ESPN's).
export async function f1Official(kind, { page, name }) {
  const id = kind === 'drivers' ? await jolpicaDriverId(name).catch(() => '') : jolpicaConstructorId(name);
  const [grids, weekends] = await Promise.all([f1Page(kind === 'drivers' ? 'drivers' : 'teams', page).catch(() => ({})), seasonResults(kind, id).catch(() => [])]);
  return { grids, weekends, id };
}

// A race's (or sprint's) full result by the session's date: [{ pos, text,
// out, why, driver: { givenName, familyName, code }, team, grid, time,
// points, laps }], empty until it's in.
// The season's round a session belongs to (Jolpica's schedule), or null.
async function roundOf(start) {
  const year = new Date(start).getFullYear();
  const sched = await getJson(`${JOLPICA}/${year}.json?limit=40`, { ttl: 12 * HOUR });
  const t = Date.parse(start);
  return (sched?.MRData?.RaceTable?.Races || []).find(r => Math.abs(Date.parse(r.date) - t) < 3 * 86_400_000) || null;
}
export async function raceResult(start, sprint = false, en = false) {
  const year = new Date(start).getFullYear();
  const race = await roundOf(start);
  if (!race) return [];
  const d = await getJson(`${JOLPICA}/${year}/${race.round}/${sprint ? 'sprint' : 'results'}.json?limit=40`, { ttl: HOUR });
  const r = d?.MRData?.RaceTable?.Races?.[0];
  const list = r?.[sprint ? 'SprintResults' : 'Results'] || [];
  // A car laps down said so (+1 圈), from its laps and the winner's: Jolpica's
  // 2026 rows say "Lapped" with a time that's no gap (Gasly "+2.171", a lap down).
  const lead = Math.max(0, ...list.map(x => Number(x.laps) || 0));
  const down = x => (/^(Finished|Lapped|\+\d+ Laps?)$/.test(x.status || '') ? lead - (Number(x.laps) || 0) : 0);
  return list.map(x => ({
    ...finishOf(x, en),
    // (Out but classified, 90% run: Albon P18 in Singapore 2026, its place kept, drawn as out.)
    ...(x.status === 'Retired' ? { out: true, text: OUT.R[en ? 1 : 0], code: 'DNF' } : {}),
    driver: x.Driver || {},
    team: x.Constructor?.name || '',
    grid: Number(x.grid) || 0,
    // (Where a car out was put, and the laps it ran: drawn as the live board draws it.)
    place: Number(x.position) || 0,
    laps: Number(x.laps) || 0,
    time: down(x) > 0 ? (en ? `+${down(x)} lap${down(x) > 1 ? 's' : ''}` : `+${down(x)} 圈`) : x.Time?.time || '',
    status: x.status || '',
    points: Number(x.points || 0),
    fastest: x.FastestLap?.rank === '1'
  }));
}

// A lap time as written ("1:11.608", "58.112") in ms; 0 for none ("", "0.000").
export function lapMs(t) {
  const m = /^(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(String(t || '').trim());
  return m ? Math.round((Number(m[1] || 0) * 60 + Number(m[2])) * 1000) : 0;
}
// A qualifying's rows ({ pos, driver, team, q: its Q1, Q2, Q3 laps as
// written }) with each car's best lap (`time`, the last part it set one in),
// the gap to pole for the cars in the last part (a Q1 lap against a Q3 one
// says nothing), and the part the others went out in (`outIn`: Q1, Q2; SQ1,
// SQ2 for the sprint's).
export function qualiRows(rows, prefix = 'Q') {
  const withBest = rows.map(r => {
    const part = [2, 1, 0].find(i => lapMs(r.q[i])) ?? -1;
    return { ...r, part, time: part >= 0 ? r.q[part] : '' };
  });
  const top = Math.max(-1, ...withBest.map(r => r.part));
  const pole = lapMs(withBest.find(r => r.part === top)?.time);
  return withBest.map(r => ({
    pos: r.pos,
    driver: r.driver,
    team: r.team,
    time: r.time,
    gap: r.part === top && r.pos > 1 && pole && lapMs(r.time) ? `+${((lapMs(r.time) - pole) / 1000).toFixed(3)}` : '',
    outIn: r.part >= 0 && r.part < top ? `${prefix}${r.part + 1}` : '',
    out: false
  }));
}
// Qualifying's numbers from Jolpica (one call), [] until they're in.
export async function qualifyingResult(start) {
  const race = await roundOf(start);
  if (!race) return [];
  const d = await getJson(`${JOLPICA}/${race.season}/${race.round}/qualifying.json?limit=40`, { ttl: HOUR });
  const list = d?.MRData?.RaceTable?.Races?.[0]?.QualifyingResults || [];
  return qualiRows(list.map(x => ({ pos: Number(x.position), driver: x.Driver || {}, team: x.Constructor?.name || '', q: [x.Q1 || '', x.Q2 || '', x.Q3 || ''] })));
}
// A qualifying's numbers from ESPN, car by car (Jolpica has no sprint
// qualifying, and its qualifying comes in later): `field` the session's
// order (ESPN's), each car's laps from its own statistics.
export async function espnQualifying(eventId, sessionId, field, prefix = 'Q') {
  const stats = await Promise.all(field.map(c => getJson(`${CORE}/events/${eventId}/competitions/${sessionId}/competitors/${c.id}/statistics`, { ttl: 6 * HOUR }).catch(() => null)));
  const rows = field.map((c, i) => {
    const s = Object.fromEntries((stats[i]?.splits?.categories || []).flatMap(k => k.stats || []).map(x => [x.name, x.displayValue]));
    const [given, ...family] = String(c.name || '').split(' ');
    return { pos: i + 1, driver: { givenName: given, familyName: family.join(' ') }, team: f1Driver(c.name).team, q: [s.qual1TimeMS, s.qual2TimeMS, s.qual3TimeMS].map(v => v || '') };
  });
  return rows.some(r => r.q.some(lapMs)) ? qualiRows(rows, prefix) : [];
}

// A session on now, from F1's own live timing (the sports proxy's
// f1-live.js: ESPN's copy is minutes behind and its gaps stand still): the
// part and the clock, the flag, the race's lap, race control's latest, and
// each car. Null when the feed's session isn't this one (`abbr`, `start`).
// Which session a reading is, and whether it's over, are the kit's
// (the kit's f1live.mjs).
export { sameSession, feedParts, feedOver };

// The last reading, kept on the device (a reload, a reopen or a sheet opened
// from a card draws it at once, not after the read; a session just over
// shows its last reading until the official numbers are in).
const KEPT = 'fx.f1live.v2';
let last = null;
try {
  last = JSON.parse(localStorage.getItem(KEPT) || 'null');
} catch {}

// Between a qualifying's parts: the last one over, the next not begun (its clock full and standing).
export const feedBreak = feed => {
  if (feedParts(feed) < 2 || feedOver(feed) || feed?.clock?.running) return false;
  const status = feed?.session?.status || '';
  const full = [0, 1080, 900, 720][feed?.part || 0] || 0;
  return /^(Finished|Inactive)$/i.test(status) || /CHEQUERED FLAG/i.test(feed?.message?.text || '') || (full > 0 && feed?.clock?.left >= full - 2);
};
export async function liveTiming(abbr, start) {
  const feed = await getJson(LIVE, { ttl: 4_000 });
  if (!feed?.cars?.length) return null;
  last = feed;
  try {
    localStorage.setItem(KEPT, JSON.stringify(feed));
  } catch {}
  if (!sameSession(feed, abbr, start)) return null;
  const k = `${abbr}|${start}`;
  if (feedOver(feed)) feedEnded.add(k), finishOrders.set(k, orderOf(feed));
  else if (/^(Started|Aborted)$/i.test(feed.session?.status || '') || feed.clock?.running || feedBreak(feed)) feedStarted.add(k), feedOnAt.set(k, Date.now());
  return feed;
}
// A sprint's or race's finishing order the moment F1's feed calls it over
// (its last word, kept on the device too): each car's name, out or not, by
// place. ESPN's scoreboard has the race "to come", its field in the grid's
// order, for an hour or more after the flag (Singapore 2026).
const finishOrders = new Map();
const orderOf = feed => [...feed.cars].sort((a, b) => a.pos - b.pos).map(c => ({ name: c.name, out: Boolean(c.retired || c.stopped) }));
export const finishOrder = (abbr, start) => finishOrders.get(`${abbr}|${start}`) || (last?.cars?.length && feedOver(last) && sameSession(last, abbr, start) ? orderOf(last) : null);
// The league's recent weekends with each sprint and race F1's feed has
// called over, over, its field in that order (a car out takes no points:
// its place is left empty): what the championship counts at once
// (title.mjs liveTable), before ESPN's scoreboard and table have it.
export function settleScoring(events = []) {
  return events.map(e => {
    if (!e?.sessions?.some(x => POINTS[x.abbr])) return e;
    return {
      ...e,
      sessions: e.sessions.map(x => {
        if (!POINTS[x.abbr] || x.status?.state === 'post') return x;
        const order = finishOrder(x.abbr, x.start);
        if (!order?.length) return x;
        const sideOf = name => (x.field || []).find(f => fold(f.en || f.name) === fold(name)) || (x.field || []).find(f => surname(f.en || f.name) === surname(name));
        return { ...x, status: { ...x.status, state: 'post', completed: true }, field: order.map(o => (o.out ? { id: '', name: '', en: '' } : sideOf(o.name) || { id: '', name: o.name, en: o.name })) };
      })
    };
  });
}
// The sprints and races the feed may have called over that ESPN hasn't yet
// (their start up to a day ago, no order kept): each asked of the feed once
// a minute, `then` called when one comes in.
const asked = new Map();
export function askFinishes(events = [], then = () => {}) {
  const now = Date.now();
  for (const e of events)
    for (const x of e?.sessions || []) {
      const k = `${x.abbr}|${x.start}`;
      const at = Date.parse(x.start);
      if (!POINTS[x.abbr] || x.status?.state === 'post' || finishOrder(x.abbr, x.start) || !(at < now && now - at < 86_400_000) || now - (asked.get(k) || 0) < 60_000) continue;
      asked.set(k, now);
      liveTiming(x.abbr, x.start).then(() => finishOrder(x.abbr, x.start) && then()).catch(() => {});
    }
}

// A session that's over, from F1's archive (f1-live.js /session.json): each
// car's best lap and gap (a practice: ESPN keeps only the order), in the live
// board's shape. Null when it isn't there (yet).
// (v=4: the copies kept before had a retired car with no place ("99" on the
// board), a practice's best a lap deleted for track limits (P2 quicker than
// P1), no deleted laps said; asked no more. Shared-Proxy builders/f1kept.js
// keeps the same addresses.)
const ARCHIVE = start => `https://f1-live.orbit/session.json?start=${encodeURIComponent(new Date(start).toISOString())}&v=4`;
// Every car's laps in a session ({ cars: { no: [[lap, ms, gap, place, pit]…] } },
// f1-live.js /laps.json): again each 15 seconds while it runs, kept once over.
// Over but not in F1's archive yet (it comes an hour or more after the
// flag): the proxy's own log of it, read again each minute until it is
// (`live` says which).
// (Over: v=2, phones kept the log's part a day as the whole, Austin 2026's
// laps 42–56; now 10 minutes, the proxy's whole copy kept for good anyway.)
const lapsUrl = (start, final) => `https://f1-live.orbit/laps.json?start=${encodeURIComponent(new Date(start).toISOString())}${final ? '&final=1&v=2' : ''}`;
export const sessionLaps = async (start, over) => {
  const got = await getJson(lapsUrl(start, over), { ttl: over ? 10 * 60_000 : 2_000 }).catch(() => null);
  if (got?.cars || !over) return got?.cars ? got : null;
  const kept = await getJson(lapsUrl(start, false), { ttl: 60_000 });
  return kept?.cars ? { ...kept, live: true } : null;
};
// A circuit's outline, corners and the time a stop costs there (f1-live.js /circuit.json).
export const circuitMap = (key, year) => getJson(`https://f1-live.orbit/circuit.json?key=${Number(key)}&year=${Number(year)}`, { ttl: 7 * 24 * 3_600_000 }).then(c => (c?.x?.length ? c : null));
export const sessionTiming = start => getJson(ARCHIVE(start), { ttl: 24 * 3_600_000 }).then(b => (b?.cars?.length ? b : null));
// The last reading of this session if it's recent (10 minutes), or its last
// word (the session over: it stands until the official numbers come), else null.
export const keptTiming = (abbr, start) => (last && sameSession(last, abbr, start) && (Date.now() - last.at < 10 * 60_000 || (feedOver(last) && Date.now() - last.at < 2 * 86_400_000)) ? last : null);
// Where a qualifying part cuts (NoEntries: [22, 16, 10]): the last place through, or 0.
export const qualiCut = (part, entries = []) => (part >= 1 && part < entries.length ? entries[part] : 0);

// A practice's two readings, as the teams' own are read: each car's long
// run (its race simulation: the most laps run in a row on one set of tyres,
// cool-down laps dropped, as an average) and its best lap on each compound
// (the short run). `laps`: [[lap, ms, gap, place, pit]…] (sessionLaps);
// `stints`: [{ c: 'SOFT', laps, new }…] in order (TimingStats).
// A run is the laps between two trips to the pits: a lap with the pit flag
// is the out-lap (and the time in the garage), the in-lap has no time. Its
// tyre is the stint in the same place when the runs and stints agree in
// number (a used set's stint counts the laps it had before, so laps can't be
// matched by counting). A long run needs MIN_RUN clean laps; laps over 104%
// of the run's median are cool-down or traffic, not pace.
export const MIN_RUN = 5;
export function practicePace(laps = [], stints = []) {
  const timed = laps.filter(x => x[1] > 0).sort((a, b) => a[0] - b[0]);
  const runs = [];
  let cur = null;
  let prev = -1;
  for (const x of timed) {
    // An out-lap opens a run (and isn't in it); a lap missing (an in-lap) ends one.
    if (x[4]) runs.push((cur = []));
    else {
      if (!cur || x[0] !== prev + 1) runs.push((cur = []));
      cur.push(x);
    }
    prev = x[0];
  }
  const list = runs.filter(r => r.length);
  // Each stint's laps here, counted from the first (the feed's own count).
  const spans = [];
  let from = 1;
  for (const st of stints) spans.push([from, (from += st.laps || 0) - 1, st.c]);
  const tyreAt = lap => spans.find(([a, b]) => lap >= a && lap <= b)?.[2] || null;
  // Pace is within 8% of the driver's own best: slower is a cool-down,
  // traffic or a flag, whatever the run's median.
  const own = Math.min(...list.flat().map(x => x[1]));
  const best = {};
  const long = [];
  list.forEach(run => {
    const c = tyreAt(run[Math.floor(run.length / 2)][0]);
    for (const x of run) if (c && (!best[c] || x[1] < best[c].ms)) best[c] = { ms: x[1], lap: x[0] };
    if (run.length < MIN_RUN) return;
    const sorted = run.map(x => x[1]).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const clean = run.filter(x => x[1] <= median * 1.04 && x[1] <= own * 1.08);
    if (clean.length < MIN_RUN) return;
    const avg = clean.reduce((n, x) => n + x[1], 0) / clean.length;
    // Falling off: the last third against the first (ms a lap, + slower).
    const third = Math.max(1, Math.floor(clean.length / 3));
    const head = clean.slice(0, third).reduce((n, x) => n + x[1], 0) / third;
    const tail = clean.slice(-third).reduce((n, x) => n + x[1], 0) / third;
    long.push({ c, laps: clean.length, avg, fade: (tail - head) / Math.max(1, clean.length - third), from: clean[0][0], to: clean.at(-1)[0] });
  });
  // The run that says most: the longest, then the quickest.
  return { long: long.sort((a, b) => b.laps - a.laps || a.avg - b.avg)[0] || null, best };
}

// ---- Two cars side by side (Orbit Sports' 車手比較) ---------------------------

// The laps a car came into the pits on: its stops (PitStopSeries' laps), and
// the laps flagged in or out of the pits.
// A qualifying's or a practice's timed laps, in order: each lap not into
// or out of the pits (`pits`, pitLaps), within `within` of the car's best
// (a cool-down, a lap sat in the garage, out of it; a qualifying's 105%, a
// run given up under a flag out too: Antonelli's 1:39 at Austin 2026 set
// the chart's range; a practice's 107%, its long runs in). Their laps by
// number line nobody up: one car's eighth a flying lap, another's in the garage.
// `gone`: its times taken away for track limits (f1-live.js deletedOf), out.
export function pushLaps(laps = [], pits = new Set(), within = 1.07, gone = []) {
  const run = laps.filter(x => x[1] > 0 && !pits.has(x[0]) && !gone.includes(x[1]));
  const best = Math.min(...run.map(x => x[1]));
  return run.filter(x => x[1] <= best * within);
}
export function pitLaps(laps = [], stops = [], stints = []) {
  return new Set([...stops.map(s => s[0]), ...laps.filter(x => x[4]).map(x => x[0]), ...stintStops(stints)]);
}
// How far `c` was behind `a` at the line, lap by lap ([[lap, s]…]). Live,
// the laps are a minute's looks (f1-live.js sampleLive), each gap read some
// time into the lap: the gap is the lap times' own, counted back from the
// gap now (`now`: c's gap to a on the board) one lap at a time (c's lap less
// a's), exact at every line; where a lap is missing, or there's no gap now
// (a lapped car), the gaps as read. Over (F1's archive: each gap at the line):
// as read.
export function gapsBetween(a = [], c = [], { now = null, live = false } = {}) {
  const ta = new Map(a.map(x => [x[0], x]));
  const read = c.map(x => [x[0], x[2] != null && ta.get(x[0])?.[2] != null ? x[2] - ta.get(x[0])[2] : null]).filter(x => x[1] != null);
  if (!live || now == null) return read;
  const tc = new Map(c.map(x => [x[0], x]));
  const last = Math.min(a.at(-1)?.[0] ?? 0, c.at(-1)?.[0] ?? 0);
  const out = new Map(read);
  let g = now;
  for (let lap = last; lap >= 1; lap--) {
    out.set(lap, Math.round(g * 1000) / 1000);
    const x = tc.get(lap)?.[1];
    const y = ta.get(lap)?.[1];
    if (!x || !y) break;
    g -= (x - y) / 1000;
  }
  return [...out].sort((p, q) => p[0] - q[0]);
}
// Closing or not: the gap's change a lap (s a lap, + closing), over the
// last `n` laps since either car last stopped (a stop isn't pace: Singapore
// 2026, Verstappen's stop four laps back read as Leclerc closing 4.16s a
// lap) and off the safety car (`neutral`: laps). Null with under 3 such
// laps, or a change no racing lap makes (over 2s a lap).
export function closingRate(gaps = [], pits = new Set(), n = 5, neutral = new Set()) {
  const last = gaps.at(-1)?.[0] ?? 0;
  const stop = Math.max(0, ...[...pits].filter(l => l <= last));
  const clean = gaps.filter(([lap]) => (!stop || lap > stop + 1) && !neutral.has(lap)).slice(-n);
  if (clean.length < 3) return null;
  const rate = (clean[0][1] - clean.at(-1)[1]) / (clean.at(-1)[0] - clean[0][0]);
  return Math.abs(rate) > 2 ? null : rate;
}
// The laps a car stopped on, from its tyres (each stint's laps, counted
// from the start: the lap a set came off): the feed's stops come late or
// not at all while a race runs.
export function stintStops(stints = []) {
  const out = [];
  let lap = 0;
  for (const st of stints.slice(0, -1)) out.push((lap += st.laps || 0));
  return out.filter(l => l > 0);
}
// The average of a car's last `n` racing laps (no pit laps, none over 107%
// of its best: a safety car), ms, or null.
export function recentPace(laps = [], pits = new Set(), n = 5) {
  const timed = laps.filter(x => x[1] > 0 && !pits.has(x[0]));
  if (!timed.length) return null;
  const best = Math.min(...timed.map(x => x[1]));
  const clean = timed.filter(x => x[1] <= best * 1.07).slice(-n);
  return clean.length >= 2 ? clean.reduce((s, x) => s + x[1], 0) / clean.length : null;
}
// The safety car and the virtual one, by lap ([{ from, to, kind: 'sc'|'vsc' }…]),
// from race control's words (the board's `control`). One still out runs to `lapNow`.
export function neutralLaps(control = [], lapNow = 0) {
  const out = [];
  let open = null;
  for (const m of control) {
    const t = String(m.message || '').toUpperCase();
    const lap = Number(m.lap) || 0;
    if (/VIRTUAL SAFETY CAR DEPLOYED|VSC DEPLOYED/.test(t)) open = { from: lap, kind: 'vsc' };
    else if (/SAFETY CAR DEPLOYED/.test(t)) open = { from: lap, kind: 'sc' };
    else if (open && (/(VIRTUAL SAFETY CAR|VSC) ENDING/.test(t) || /SAFETY CAR IN THIS LAP/.test(t) || (/RED FLAG/.test(t) && open.kind === 'vsc'))) {
      out.push({ ...open, to: Math.max(open.from, lap) });
      open = null;
    }
  }
  if (open) out.push({ ...open, to: Math.max(open.from, lapNow) });
  return out.filter(p => p.from > 0);
}

// ---- The championship as things stand (Orbit Sports' 數據, a race or a sprint on) ----

// The points for each place (2026: no point for the fastest lap).
// (title.mjs's, the championship's one table of them.)
export { POINTS };
// The points a car would take if the flag fell now: its place, or none out of it.
export const pointsFor = (abbr, pos, out = false) => (out ? 0 : POINTS[abbr]?.[pos - 1] || 0);
// The table as it stands: each row ({ key, pts, rank, … }) with the points
// it takes now (`gains`: key → points) added, in the new order (the points,
// then the order it stood in), each with where it was and is.
// The championship just after one weekend (its column `roundKey` in ESPN's
// table, a column a weekend in the season's order): each row's points before
// it (`before`, the columns ahead of it), its place then (`rank`) and that
// weekend's (`add`); null when the table has no such column.
export function standingAfter(group, roundKey) {
  const keys = (group?.rounds || []).map(r => r.key);
  const i = keys.indexOf(roundKey);
  if (i < 0) return null;
  const n = v => Number(String(v ?? '').replace(/[^\d.]/g, '')) || 0;
  return (group.rows || [])
    .map(r => ({ ...r, before: keys.slice(0, i).reduce((sum, k) => sum + n(r.stats?.[k]), 0), add: n(r.stats?.[keys[i]]) }))
    .sort((a, b) => b.before - a.before)
    .map((r, j) => ({ ...r, rank: j + 1 }));
}
export function asItStands(rows = [], gains = new Map()) {
  return rows
    .map((r, i) => ({ ...r, was: Number(r.rank) || i + 1, add: gains.get(r.key) || 0, total: (Number(r.pts) || 0) + (gains.get(r.key) || 0) }))
    .sort((a, b) => b.total - a.total || a.was - b.was)
    .map((r, i) => ({ ...r, now: i + 1 }));
}

// Each lap's end on the clock while a race runs ([{ lap, t }], t in
// seconds, lap 0 the lights going out), for the win chance by lap: counted
// back from the feed's latest reading (`feed.at`, ms) by the leader's own
// lap times (`laps`: sessionLaps' cars), less what it has run of the lap
// it's on. F1's feed puts no clock to its laps, and OpenF1, which does, is
// closed to all while a race runs. A lap the log missed takes the leader's
// usual lap. Null before the second lap is done.
export function liveLapEnds(feed, laps) {
  const lead = feed?.cars?.find(c => c.pos === 1);
  const done = lead?.laps || 0;
  if (!lead || done < 2 || !feed.at) return null;
  const ms = new Map((laps?.[lead.no] || []).filter(x => x[1] > 0).map(x => [x[0], x[1]]));
  const sorted = [...ms.values()].sort((a, b) => a - b);
  const usual = sorted[sorted.length >> 1] || lapMs(lead.best) || 95_000;
  const into = lead.seg?.[1] ? (lead.seg[0] / lead.seg[1]) * (lapMs(lead.last) || usual) : 0;
  let t = (feed.at - into) / 1000;
  const out = [{ lap: done, t }];
  for (let k = done; k >= 1; k--) out.push({ lap: k - 1, t: (t -= (ms.get(k) || usual) / 1000) });
  return out.reverse();
}

// What turned a race so far, from F1's live feed, as raceEvents has it once
// it's over (OpenF1 is closed while it runs): the drawn drivers' stops and
// retirements ([lap, 'pit' | 'out', k]) and who led at each lap's end ([lap,
// 'lead', k, or the name of one not drawn], lap 0 the grid). `names`: the
// drawn drivers (the market's names), k a place among them.
export function liveRaceEvents(feed, names) {
  const flat = x => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const sur = name => flat(String(name).split(' ').filter(w => !/^(jr|sr)\.?$/i.test(w)).at(-1));
  const cars = feed?.cars || [];
  const kOf = no => {
    const car = cars.find(c => String(c.no) === String(no));
    const k = car ? names.findIndex(n => flat(n).endsWith(sur(car.name))) : -1;
    return k >= 0 ? k : car?.name || null;
  };
  const ev = [];
  for (const [no, stops] of Object.entries(feed?.stops || {})) {
    const k = kOf(no);
    if (typeof k === 'number') for (const [lap] of stops) if (lap) ev.push([lap, 'pit', k]);
  }
  for (const c of cars) {
    const k = kOf(c.no);
    if (typeof k === 'number' && (c.retired || c.stopped)) ev.push([Math.max(1, c.laps || 0), 'out', k]);
  }
  const places = Object.entries(feed?.places || {});
  const laps = Math.max(0, ...places.map(([, p]) => p.length - 1));
  let leader = null;
  for (let lap = 0; lap <= laps; lap++) {
    const now = places.find(([, p]) => p[lap] === 1)?.[0];
    if (now == null || now === leader) continue;
    leader = now;
    const k = kOf(now);
    if (k != null) ev.push([lap, 'lead', k]);
  }
  return ev.sort((a, b) => a[0] - b[0]);
}
