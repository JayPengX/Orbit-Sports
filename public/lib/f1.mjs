// F1 drivers and teams as the official app shows them: formula1.com's own
// figures (the season's Grand Prix and Sprint numbers, the career's, the
// biography or the team's profile; through the proxy, trimmed to its grids)
// and each weekend's results from Jolpica (the grid, the finish, a retirement
// and the sprint).
import { getJson, feedEnded } from './espn.mjs';
import { f1Driver } from '#kit/logos.mjs';

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
  const plain = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const n = plain(name);
  return (list.find(x => n.endsWith(plain(x.familyName)) && n.includes(plain(x.givenName).split(' ')[0])) || list.find(x => n.endsWith(plain(x.familyName))))?.driverId || '';
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
  return (r?.[sprint ? 'SprintResults' : 'Results'] || []).map(x => ({
    ...finishOf(x, en),
    driver: x.Driver || {},
    team: x.Constructor?.name || '',
    grid: Number(x.grid) || 0,
    time: x.Time?.time || (/^\+\d+ Laps?$/.test(x.status) ? x.status : ''),
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
const LIVE = 'https://f1-live.quadra/now.json';
const FEED_KIND = { FP1: 'Practice', FP2: 'Practice', FP3: 'Practice', Qual: 'Qualifying', SS: 'Sprint Qualifying', SQ: 'Sprint Qualifying', SR: 'Sprint', Race: 'Race' };
export function sameSession(feed, abbr, start) {
  const s = feed?.session;
  if (!s?.start) return false;
  const [h, m] = String(s.gmt || '0:0').split(':').map(Number);
  const at = Date.parse(`${s.start}Z`) - ((h || 0) * 60 + (m || 0)) * 60_000;
  const kind = FEED_KIND[abbr];
  const named = kind === 'Sprint' ? s.name === 'Sprint' : kind === 'Race' ? s.type === 'Race' && s.name !== 'Sprint' : kind === 'Sprint Qualifying' ? /sprint/i.test(s.name) && /qualifying|shootout/i.test(`${s.name} ${s.type}`) : s.type === kind && !/sprint/i.test(s.name);
  return named && Math.abs(at - Date.parse(start)) < 3 * 3_600_000;
}
// The last reading, kept for the session (sessionStorage too, so a reload
// or a sheet opened from a card draws it at once, not after the read).
const KEPT = 'fx.f1live';
let last = null;
try {
  last = JSON.parse(sessionStorage.getItem(KEPT) || 'null');
} catch {}
// The feed's word that a session is over (its status, or race control's "END OF SESSION" / the chequered flag).
export const feedOver = feed => /^(Finished|Finalised|Ends)$/i.test(feed?.session?.status || '') || /CHEQUERED FLAG|END OF SESSION/i.test(feed?.message?.text || '');
export async function liveTiming(abbr, start) {
  const feed = await getJson(LIVE, { ttl: 4_000 });
  if (!feed?.cars?.length) return null;
  last = feed;
  try {
    sessionStorage.setItem(KEPT, JSON.stringify(feed));
  } catch {}
  if (!sameSession(feed, abbr, start)) return null;
  if (feedOver(feed)) feedEnded.add(`${abbr}|${start}`);
  return feed;
}
// A session that's over, from F1's archive (f1-live.js /session.json): each
// car's best lap and gap (a practice: ESPN keeps only the order), in the live
// board's shape. Null when it isn't there (yet).
const ARCHIVE = start => `https://f1-live.quadra/session.json?start=${encodeURIComponent(new Date(start).toISOString())}`;
export const sessionTiming = start => getJson(ARCHIVE(start), { ttl: 24 * 3_600_000 }).then(b => (b?.cars?.length ? b : null));
// The last reading of this session if it's recent (10 minutes), else null.
export const keptTiming = (abbr, start) => (last && Date.now() - last.at < 10 * 60_000 && sameSession(last, abbr, start) ? last : null);
// Where a qualifying part cuts (NoEntries: [22, 16, 10]): the last place through, or 0.
export const qualiCut = (part, entries = []) => (part >= 1 && part < entries.length ? entries[part] : 0);
