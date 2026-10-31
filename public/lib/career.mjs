// A player's or driver's career (his page's 資料 and 數據, Jay 2026-10-31):
// every team he has played for and when, each season's numbers, how he came
// into the league (draft, debut, years in it) and what he has won.
// - NBA and MLB: ESPN's seasons (athletes/<id>/stats, the proxy's
//   espn-career trim), each with its team.
// - Football: FotMob's career (found by his name and club, checked by his
//   birthday): clubs with dates, loans, national side, seasons, trophies.
// - F1: Jolpica's teams for him and the years with each.
import { getJson, COMMON, standings } from './espn.mjs';
import { LEAGUES } from './leagues.mjs';
import { jolpicaDriverId } from './f1.mjs';
import { fold } from './text.mjs';

const DAY = 86_400_000;
const JOLPICA = 'https://api.jolpi.ca/ergast/f1';
const FOTMOB = 'https://www.fotmob.com/api/data';
const fotmobLogo = id => (id != null ? `https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png` : '');

// "2017: Rd 1, Pk 13 (DEN)" → { year, round, pick, abbr }, or null (undrafted, or not said).
export function draftOf(text) {
  const m = /^(\d{4}):\s*Rd\s*(\d+),\s*Pk\s*(\d+)\s*\(([A-Za-z0-9]+)\)/.exec(String(text || '').trim());
  return m ? { year: Number(m[1]), round: Number(m[2]), pick: Number(m[3]), abbr: m[4] } : null;
}
// "10th Season" → 10, or null.
export const seasonsIn = text => Number(/^(\d+)(st|nd|rd|th)\s+season/i.exec(String(text || '').trim())?.[1]) || null;

// One team's run of seasons: consecutive seasons with the same team, the
// newest first. `rows` oldest first ({ year, team: { id }, games }).
export function stintsOf(rows, sameTeam = (a, b) => a.team.id === b.team.id) {
  const out = [];
  for (const r of rows) {
    const last = out.at(-1);
    if (last && sameTeam(last, r) && r.year - last.to <= 1) Object.assign(last, { to: r.year, seasons: last.seasons + 1, games: last.games + (r.games || 0) });
    else out.push({ team: r.team, from: r.year, to: r.year, seasons: 1, games: r.games || 0 });
  }
  return out.reverse();
}

// ESPN's seasons (the regular season's category): { labels, longs, seasons
// (newest first: { season, year, team, cells }), teams (stints) }, or null.
// A season split by a trade is a row a team (ESPN's total of it left out).
export function parseEspnCareer(data, sport) {
  const c = data?.categories?.[0];
  if (!c?.labels?.length || !c.statistics?.length) return null;
  const byKey = new Map();
  for (const [slug, t] of Object.entries(data.teams || {})) {
    byKey.set(slug, t);
    if (t?.id != null) byKey.set(String(t.id), t);
  }
  const gp = c.labels.indexOf('GP');
  const rows = c.statistics
    .filter(x => x?.teamId && x.season?.year)
    .map(x => {
      const t = byKey.get(x.teamSlug) || byKey.get(String(x.teamId)) || {};
      // (The NBA's season by its second year: 2017-18 is 2018.)
      return {
        season: x.season.displayName || String(x.season.year),
        year: Number(x.season.year),
        team: { id: String(x.teamId), name: t.displayName || '', short: t.shortDisplayName || '', abbr: t.abbreviation || '', logo: t.logo || t.logos?.[0]?.href || '' },
        games: Number(x.stats?.[gp]) || 0,
        cells: c.labels.map((label, i) => ({ label, long: c.displayNames?.[i] || '', value: x.stats?.[i] ?? '' }))
      };
    })
    .sort((a, b) => a.year - b.year);
  if (!rows.length) return null;
  const split = sport === 'basketball';
  return {
    labels: c.labels,
    longs: c.displayNames || [],
    pitching: c.labels.includes('ERA'),
    seasons: [...rows].reverse(),
    // A stint's years as the seasons began and ended (the NBA's 2017-18 to 2021-22: 2017–2022).
    teams: stintsOf(rows).map(s => ({ ...s, from: split ? s.from - 1 : s.from }))
  };
}

// The league's team for a draft's abbreviation (its table's rows), or null.
async function teamByAbbr(league, abbr) {
  const groups = await standings(league).catch(() => null);
  return (groups || []).flatMap(g => g.rows || []).find(r => r.abbr === abbr) || null;
}

async function espnCareer(league, id, a) {
  const l = LEAGUES[league];
  const [data, draft] = await Promise.all([
    getJson(`${COMMON}/${l.espn}/athletes/${encodeURIComponent(id)}/stats`, { ttl: 12 * 3_600_000, trim: 'espn-career' }).catch(() => null),
    draftOf(a.draft) ? teamByAbbr(league, draftOf(a.draft).abbr) : null
  ]);
  const career = parseEspnCareer(data, l.sport);
  return { ...(career || {}), draftTeam: draft };
}

// FotMob's player for ESPN's: the same name (folded; a given name may be
// cut to its initial) at the same club, else the only one by that name;
// his birthday must match ESPN's (a day either way: time zones).
const nameKey = n => fold(n).replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
export function samePerson(espnName, fotmobName) {
  const a = nameKey(espnName);
  const b = nameKey(fotmobName);
  if (!a || !b) return false;
  if (a === b) return true;
  const [as, bs] = [a.split(' '), b.split(' ')];
  return as.at(-1) === bs.at(-1) && as[0][0] === bs[0][0];
}
const clubKey = n => nameKey(n).replace(/\b(fc|afc|cf|sc|ac|club|de|the)\b/g, '').replace(/\s+/g, ' ').trim();
export function pickFotmob(list, a) {
  const named = (list || []).filter(x => samePerson(a.name, x.name));
  const ids = [...new Set(named.map(x => String(x.id)))];
  if (ids.length <= 1) return ids[0] || null;
  const club = clubKey(a.team);
  const at = named.filter(x => club && (clubKey(x.teamName) === club || clubKey(x.teamName).includes(club) || club.includes(clubKey(x.teamName))));
  return new Set(at.map(x => String(x.id))).size === 1 ? String(at[0].id) : null;
}
export const sameDay = (x, y) => Boolean(x && y) && Math.abs(Date.parse(String(x).slice(0, 10)) - Date.parse(String(y).slice(0, 10))) <= DAY;

// A senior national side (England, not England U21 or its Olympic team).
const SENIOR_SIDE = n => !/\bU-?\d{2}\b|olympic|\bB$/i.test(n || '');
// FotMob's (trimmed) career in the page's shape.
export function parseFotmobCareer(p) {
  if (!p?.clubs) return null;
  const stint = x => ({ team: { id: '', fotmob: String(x.teamId ?? ''), name: x.team, logo: fotmobLogo(x.teamId) }, from: Number(x.from.slice(0, 4)) || null, to: x.active || !x.to ? null : Number(x.to.slice(0, 4)) || null, loan: x.loan, games: x.apps, goals: x.goals, assists: x.assists });
  // (A few weeks back at his club between loans, not one game played: no row.)
  // (A loan the club then bought him from, side by side: one spell, said so.)
  const teams = p.clubs
    .filter(x => x.apps || x.active)
    .map(stint)
    .reduce((out, x) => {
      const later = out.at(-1);
      if (later && x.loan && !later.loan && later.team.fotmob === x.team.fotmob) Object.assign(later, { from: x.from, bought: true, games: (later.games || 0) + (x.games || 0), goals: (later.goals || 0) + (x.goals || 0), assists: (later.assists || 0) + (x.assists || 0) });
      else out.push(x);
      return out;
    }, []);
  const national = p.national.filter(x => SENIOR_SIDE(x.team) && x.apps).map(stint).slice(0, 1);
  const seasons = p.seasons
    .filter(x => x.apps)
    .map(x => ({
      season: x.season.replace(/^(\d{4})\/\d\d(\d\d)$/, '$1-$2'),
      year: Number(x.season.slice(-4)) || 0,
      team: { id: '', fotmob: String(x.teamId ?? ''), name: x.team, logo: fotmobLogo(x.teamId) },
      loan: x.loan,
      games: x.apps,
      cells: [
        { label: 'APP', long: 'Appearances', value: String(x.apps ?? '') },
        { label: 'G', long: 'Goals', value: String(x.goals ?? 0) },
        { label: 'A', long: 'Assists', value: String(x.assists ?? 0) },
        { label: 'RAT', long: 'Rating', value: x.rating ? x.rating.toFixed(2) : '–' }
      ]
    }));
  // Each competition he won (a friendly's tournament, FotMob's id -1, left out), most first.
  const won = new Map();
  for (const t of p.trophies || []) {
    if (!(t.leagueId > 0) || !t.won.length) continue;
    const w = won.get(t.league) || { name: t.league, seasons: [], teams: [] };
    w.seasons.push(...t.won);
    // (The club he won it with, or his country.)
    if (t.team && !w.teams.includes(t.team)) w.teams.push(t.team);
    won.set(t.league, w);
  }
  const awards = [...won.values()].map(w => ({ ...w, seasons: [...new Set(w.seasons)].sort().reverse(), count: w.seasons.length > 1 ? `${w.seasons.length}x` : '' })).sort((x, y) => y.seasons.length - x.seasons.length);
  return { teams, national, seasons, awards, labels: ['APP', 'G', 'A', 'RAT'] };
}

async function fotmobCareer(a) {
  if (!a.name) return null;
  const list = await getJson(`${FOTMOB}/search/suggest?term=${encodeURIComponent(a.name)}`, { ttl: 7 * DAY });
  const id = pickFotmob(list, a);
  if (!id) return null;
  const p = await getJson(`${FOTMOB}/playerData?id=${id}`, { ttl: 12 * 3_600_000 });
  if (a.dob && !sameDay(p?.born, a.dob)) return null;
  return parseFotmobCareer(p);
}

// A driver's teams (Jolpica: each team he drove for, the seasons with it).
async function f1Career(a) {
  const id = await jolpicaDriverId(a.name);
  if (!id) return null;
  const opts = { ttl: 12 * 3_600_000 };
  const teams = (await getJson(`${JOLPICA}/drivers/${id}/constructors.json?limit=30`, opts))?.MRData?.ConstructorTable?.Constructors || [];
  // (One after another: Jolpica turns away more than a few at once, and a team missing would make a wrong timeline.)
  const runs = [];
  for (const c of teams) runs.push(await getJson(`${JOLPICA}/drivers/${id}/constructors/${c.constructorId}/seasons.json?limit=40`, opts).then(d => ({ c, years: (d?.MRData?.SeasonTable?.Seasons || []).map(s => Number(s.season)) })));
  const rows = runs.flatMap(({ c, years }) => years.map(year => ({ year, team: { id: c.constructorId, name: c.name }, games: 0 }))).sort((x, y) => x.year - y.year || x.team.id.localeCompare(y.team.id));
  return rows.length ? { teams: stintsOf(rows) } : null;
}

// The whole career for a player's page, or null (nothing found: no cards).
export async function playerCareer(league, id, a) {
  const sport = LEAGUES[league]?.sport;
  if (sport === 'racing') return league === 'f1' ? f1Career(a) : null;
  if (sport === 'soccer') return fotmobCareer(a);
  if (sport === 'basketball' || sport === 'baseball') return LEAGUES[league].espn ? espnCareer(league, id, a) : null;
  return null;
}
