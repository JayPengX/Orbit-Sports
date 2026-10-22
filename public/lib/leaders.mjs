// 數據領先 beyond a game: a league's leaders (each stat's top hundred) and a
// team's (each stat's best of its own), the regular season's (MLB's
// postseason numbers are a handful of games).
//   - basketball and baseball: ESPN's list of every player's season
//     (common v3 statistics/byathlete, a thousand a page, trimmed by the
//     proxy: espn-athletes; the same address Play reads, so one copy in the
//     proxy's cache), MLB's batters and pitchers two lists. Each stat ranked
//     here, a rate only among those who qualify as the league counts it (an
//     NBA shooter's makes, a batter's plate appearances, a pitcher's innings);
//     a team's the same list, its own players;
//   - football: FotMob's (below); ESPN's top scorers and assists (site v2
//     statistics, its clubs named) when FotMob can't be read.
import { espnHeadshot } from '#kit/photo-urls.mjs';
import { f1Constructor } from '#kit/logos.mjs';
import { fold } from './text.mjs';

// Each stat: [its key, ESPN's table, ESPN's name, zh, en, how it's written, who qualifies, lower is better].
//   how: 'pg' per game (one place; 場均 said), 'pct' a percentage, 'n' a count,
//        'avg' .316, 'era' 1.80, 'one' one place;
//   who: 'games' (a fair share of the games), 'fg' | '3p' | 'ft' (the shots
//        made the NBA asks, its 300, 82 and 125 a season), 'pa' (3.1 plate
//        appearances a team game), 'ip' (an inning a team game), none: all.
export const ATHLETE_STATS = {
  basketball: [
    ['pts', 'offensive', 'avgPoints', '得分', 'Points', 'pg', 'games'],
    ['reb', 'general', 'avgRebounds', '籃板', 'Rebounds', 'pg', 'games'],
    ['ast', 'offensive', 'avgAssists', '助攻', 'Assists', 'pg', 'games'],
    ['stl', 'defensive', 'avgSteals', '抄截', 'Steals', 'pg', 'games'],
    ['blk', 'defensive', 'avgBlocks', '阻攻', 'Blocks', 'pg', 'games'],
    ['3pm', 'offensive', 'avgThreePointFieldGoalsMade', '三分球', '3-pointers', 'pg', 'games'],
    ['fg', 'offensive', 'fieldGoalPct', '投籃命中率', 'FG%', 'pct', 'fg'],
    ['3p', 'offensive', 'threePointFieldGoalPct', '三分命中率', '3P%', 'pct', '3p'],
    ['ft', 'offensive', 'freeThrowPct', '罰球命中率', 'FT%', 'pct', 'ft'],
    ['min', 'general', 'avgMinutes', '上場時間', 'Minutes', 'pg', 'games'],
    ['dd', 'general', 'doubleDouble', '雙十', 'Double-doubles', 'n'],
    ['td', 'general', 'tripleDouble', '大三元', 'Triple-doubles', 'n']
  ],
  baseball: [
    ['avg', 'batting', 'avg', '打擊率', 'Average', 'avg', 'pa'],
    ['hr', 'batting', 'homeRuns', '全壘打', 'Home runs', 'n'],
    ['rbi', 'batting', 'RBIs', '打點', 'RBI', 'n'],
    ['ops', 'batting', 'OPS', 'OPS', 'OPS', 'avg', 'pa'],
    ['h', 'batting', 'hits', '安打', 'Hits', 'n'],
    ['r', 'batting', 'runs', '得分', 'Runs', 'n'],
    ['sb', 'batting', 'stolenBases', '盜壘', 'Stolen bases', 'n'],
    ['obp', 'batting', 'onBasePct', '上壘率', 'On-base %', 'avg', 'pa'],
    ['slg', 'batting', 'slugAvg', '長打率', 'Slugging', 'avg', 'pa'],
    ['2b', 'batting', 'doubles', '二壘安打', 'Doubles', 'n'],
    ['3b', 'batting', 'triples', '三壘安打', 'Triples', 'n'],
    ['bb', 'batting', 'walks', '保送', 'Walks', 'n'],
    ['war', 'batting', 'WARBR', '野手 WAR', 'WAR (batting)', 'one'],
    ['era', 'pitching', 'ERA', '防禦率', 'ERA', 'era', 'ip', true],
    ['w', 'pitching', 'wins', '勝投', 'Wins', 'n'],
    ['k', 'pitching', 'strikeouts', '三振', 'Strikeouts', 'n'],
    ['sv', 'pitching', 'saves', '救援', 'Saves', 'n'],
    ['whip', 'pitching', 'WHIP', 'WHIP', 'WHIP', 'era', 'ip', true],
    ['k9', 'pitching', 'strikeoutsPerNineInnings', '每九局三振', 'K/9', 'one', 'ip'],
    ['ip', 'pitching', 'innings', '投球局數', 'Innings', 'one'],
    ['qs', 'pitching', 'qualityStarts', '優質先發', 'Quality starts', 'n'],
    ['hld', 'pitching', 'holds', '中繼成功', 'Holds', 'n'],
    ['pwar', 'pitching', 'WARBR', '投手 WAR', 'WAR (pitching)', 'one']
  ]
};
// Football's from ESPN (FotMob can't be read): [key, zh, en].
const ESPN_SOCCER = [
  ['goalsLeaders', '進球', 'Goals'],
  ['assistsLeaders', '助攻', 'Assists']
];
export const LEADER_STATS = { basketball: ATHLETE_STATS.basketball, baseball: ATHLETE_STATS.baseball, soccer: ESPN_SOCCER };
// How many a league's list ranks.
export const LEAGUE_TOP = 100;
// (Racing's from Jolpica: F1 alone.)
export const hasLeaders = (sport, espn) => Boolean(espn && LEADER_STATS[sport] && (sport !== 'racing' || espn === 'racing/f1'));

const SITE = 'https://site.api.espn.com/apis/site';
const COMMON = 'https://site.api.espn.com/apis/common/v3/sports';
// (Play's address exactly: the proxy's one cached copy serves both.)
export const athletesUrls = (sport, espn) => {
  const all = `${COMMON}/${espn}/statistics/byathlete?limit=1000&isqualified=false&seasontype=2`;
  return sport === 'baseball' ? [all, `${all}&category=pitching`] : [all];
};
export const leagueLeadersUrl = (sport, espn) => (sport === 'soccer' ? `${SITE}/v2/sports/${espn}/statistics` : athletesUrls(sport, espn)[0]);

const shot = h => (typeof h === 'string' ? h : h?.href) || null;
const person = a => ({ id: String(a?.id ?? ''), name: a?.shortName || a?.displayName || '', full: a?.displayName || a?.shortName || '', headshot: shot(a?.headshot) });
// The season by its years alone ("2026-27 English Premier League" → 2026-27).
const seasonOf = data => {
  const s = data?.requestedSeason || data?.season;
  const name = /\d{4}(?:-\d{2})?/.exec(s?.displayName || '')?.[0] || (s?.year ? String(s.year) : '');
  return name ? { name } : null;
};
// A number as its stat writes it.
export function statText(how, value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '');
  if (how === 'avg') return n.toFixed(3).replace(/^0\./, '.');
  if (how === 'era') return n.toFixed(2);
  if (how === 'pct') return `${n.toFixed(1)}%`;
  if (how === 'pg' || how === 'one') return n.toFixed(1);
  return String(Math.round(n));
}
// "Luka Doncic" → "L. Doncic", as ESPN shortens its names (one name stays whole).
const shortName = n => {
  const w = String(n || '').trim().split(/\s+/);
  return w.length > 1 ? `${w[0][0]}. ${w.slice(1).join(' ')}` : w[0] || '';
};
// Innings as baseball writes them (180.1 is 180⅓).
const innings = v => {
  const n = Number(v) || 0;
  const whole = Math.trunc(n);
  return whole + Math.round((n - whole) * 10) / 3;
};

// ESPN's lists (each the whole, or the proxy's trim) as players: { id, name,
// full, team, by: { batting: { avg: … }, … } }, and the season.
function playersOf(pages) {
  const players = new Map();
  let season = null;
  for (const data of pages) {
    if (!data?.athletes) continue;
    season ||= seasonOf(data);
    const names = Object.fromEntries((data.categories || []).map(c => [c.name, c.names || []]));
    for (const x of data.athletes) {
      const a = x.athlete || {};
      const id = String(a.id ?? '');
      if (!id) continue;
      const p = players.get(id) || { id, name: a.shortName || shortName(a.displayName), full: a.displayName || '', team: String(a.teamId ?? ''), by: {} };
      for (const c of x.categories || []) {
        if (p.by[c.name] || !(c.values || []).some(v => v != null)) continue;
        p.by[c.name] = Object.fromEntries((names[c.name] || []).map((k, i) => [k, c.values[i]]));
      }
      players.set(id, p);
    }
  }
  return { season, players: [...players.values()] };
}
// Each player's per-game minutes, points, rebounds and assists from the
// league's list (basketball): id -> ['32.1', '25.4', '7.2', '6.0'].
export function athleteAverages(pages) {
  const out = new Map();
  const f = v => (v == null || !Number.isFinite(Number(v)) ? '' : Number(v).toFixed(1));
  for (const p of playersOf(pages).players) out.set(p.id, [f(p.by.general?.avgMinutes), f(p.by.offensive?.avgPoints), f(p.by.general?.avgRebounds), f(p.by.offensive?.avgAssists)]);
  return out;
}
// Who counts for a rate, as the league counts it (`share`: of what it asks,
// a team's page asking less of a squad's few).
function qualifier(players, share = 1) {
  const most = cat => Math.max(1, ...players.map(p => Number(p.by[cat]?.gamesPlayed) || 0));
  const games = { general: most('general'), batting: most('batting'), pitching: most('batting') };
  // (A season's 82 games: the NBA's makes asked over the games so far.)
  const nba = n => (n / 82) * games.general * share;
  return (p, who) => {
    const g = p.by.general || {};
    const o = p.by.offensive || {};
    const b = p.by.batting || {};
    const pi = p.by.pitching || {};
    if (who === 'games') return (Number(g.gamesPlayed) || 0) >= games.general * 0.7 * share;
    if (who === 'fg') return (Number(o.fieldGoalsMade) || 0) >= nba(300);
    if (who === '3p') return (Number(o.threePointFieldGoalsMade) || 0) >= nba(82);
    if (who === 'ft') return (Number(o.freeThrowsMade) || 0) >= nba(125);
    if (who === 'pa') return (Number(b.atBats) || 0) + (Number(b.walks) || 0) >= games.batting * 3.1 * share;
    if (who === 'ip') return innings(pi.innings) >= games.pitching * share;
    return true;
  };
}
// Each stat's list, best first ({ id, name, full, headshot, team, value }),
// `top` of them; `team`: one team's own.
function rank(pages, sport, league, { top = LEAGUE_TOP, team = null } = {}) {
  const want = ATHLETE_STATS[sport];
  if (!want) return null;
  const { season, players } = playersOf(pages);
  if (!players.length) return null;
  const counts = qualifier(players, team ? 0.6 : 1);
  const mine = team ? players.filter(p => p.team === String(team)) : players;
  const stats = want
    .map(([key, cat, name, zh, en, how, who, low]) => {
      const list = mine
        .map(p => ({ p, n: p.by[cat]?.[name] }))
        .filter(({ p, n }) => n != null && Number.isFinite(Number(n)) && counts(p, who))
        // (Nothing at all is no leader: a team's 0 saves; a rate needs its qualifier, not a count.)
        .filter(({ n }) => low || Number(n) > 0)
        .sort((x, y) => (low ? x.n - y.n : y.n - x.n))
        .slice(0, top)
        .map(({ p, n }) => ({ id: p.id, name: p.name, full: p.full, headshot: espnHeadshot(league, p.id), team: p.team, value: statText(how, n) }));
      return list.length ? { key, zh, en, perGame: how === 'pg', list } : null;
    })
    .filter(Boolean);
  return stats.length ? { season, stats } : null;
}
export const parseAthleteLeaders = (pages, sport, league) => rank(pages, sport, league);

// A new NBA season's first days: ESPN's list still answers with last
// season's (it fills in the new one days later), so this season's is
// added up here from its games' box scores (summaries), in the list's own
// shape: each player's games, per-game numbers, shooting and double-doubles.
// `season`: ESPN's currentSeason ({ year, displayName }).
export function boxSeasonPage(summaries, season) {
  const players = new Map();
  for (const data of summaries) {
    if (data?.header?.competitions?.[0]?.status?.type?.state !== 'post') continue;
    for (const side of data?.boxscore?.players || []) {
      const st = side.statistics?.[0];
      const at = k => (st?.keys || []).indexOf(k);
      const ix = { min: at('minutes'), pts: at('points'), fg: at('fieldGoalsMade-fieldGoalsAttempted'), tp: at('threePointFieldGoalsMade-threePointFieldGoalsAttempted'), ft: at('freeThrowsMade-freeThrowsAttempted'), reb: at('rebounds'), ast: at('assists'), stl: at('steals'), blk: at('blocks') };
      if (ix.pts < 0) continue;
      for (const x of st.athletes || []) {
        const a = x.athlete || {};
        const id = String(a.id ?? '');
        if (!id || x.didNotPlay || !x.stats?.length) continue;
        const n = i => (i < 0 ? 0 : Number(x.stats[i]) || 0);
        const pair = i => (i < 0 ? [0, 0] : String(x.stats[i]).split('-').map(v => Number(v) || 0));
        const p = players.get(id) || { a: { id, displayName: a.displayName || '', shortName: a.shortName || '', teamId: String(side.team?.id ?? '') }, g: 0, min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, dd: 0, td: 0 };
        const [fgm, fga] = pair(ix.fg);
        const [tpm, tpa] = pair(ix.tp);
        const [ftm, fta] = pair(ix.ft);
        const line = { min: n(ix.min), pts: n(ix.pts), reb: n(ix.reb), ast: n(ix.ast), stl: n(ix.stl), blk: n(ix.blk) };
        const tens = ['pts', 'reb', 'ast', 'stl', 'blk'].filter(k => line[k] >= 10).length;
        Object.assign(p, { g: p.g + 1, min: p.min + line.min, pts: p.pts + line.pts, reb: p.reb + line.reb, ast: p.ast + line.ast, stl: p.stl + line.stl, blk: p.blk + line.blk, fgm: p.fgm + fgm, fga: p.fga + fga, tpm: p.tpm + tpm, tpa: p.tpa + tpa, ftm: p.ftm + ftm, fta: p.fta + fta, dd: p.dd + (tens >= 2), td: p.td + (tens >= 3) });
        players.set(id, p);
      }
    }
  }
  if (!players.size) return null;
  const per = (v, g) => Math.round((v / g) * 10) / 10;
  const pct = (m, a) => (a ? Math.round((m / a) * 1000) / 10 : null);
  const names = { general: ['gamesPlayed', 'avgMinutes', 'avgRebounds', 'doubleDouble', 'tripleDouble'], offensive: ['avgPoints', 'avgAssists', 'avgThreePointFieldGoalsMade', 'fieldGoalsMade', 'threePointFieldGoalsMade', 'freeThrowsMade', 'fieldGoalPct', 'threePointFieldGoalPct', 'freeThrowPct'], defensive: ['avgSteals', 'avgBlocks'] };
  return {
    requestedSeason: { year: season?.year, displayName: season?.displayName || '' },
    categories: Object.entries(names).map(([name, list]) => ({ name, names: list })),
    athletes: [...players.values()].map(p => ({
      athlete: p.a,
      categories: [
        { name: 'general', values: [p.g, per(p.min, p.g), per(p.reb, p.g), p.dd, p.td] },
        { name: 'offensive', values: [per(p.pts, p.g), per(p.ast, p.g), per(p.tpm, p.g), p.fgm, p.tpm, p.ftm, pct(p.fgm, p.fga), pct(p.tpm, p.tpa), pct(p.ftm, p.fta)] },
        { name: 'defensive', values: [per(p.stl, p.g), per(p.blk, p.g)] }
      ]
    }))
  };
}
// (A team's: its own fifteen a stat, the leader on its card, the rest in 隊內排行.)
export const parseTeamAthletes = (pages, sport, league, team) => rank(pages, sport, league, { top: 15, team });

// Where one player stands in a league's lists: [{ stat, rank, value, of }],
// best place first (level on the number, level in the place). A footballer
// from FotMob (no ESPN id) by his name.
export function playerRanks(data, id, name = '') {
  const out = [];
  for (const st of data?.stats || []) {
    const i = st.list.findIndex(x => (x.id && String(x.id) === String(id)) || (!x.id && name && fold(x.full || x.name) === fold(name)));
    if (i < 0) continue;
    out.push({ stat: st, rank: st.list.findIndex(y => y.value === st.list[i].value) + 1, value: st.list[i].value, of: st.list.length });
  }
  return out.sort((a, b) => a.rank - b.rank);
}

// Football's from ESPN (site v2 statistics, or the proxy's trim: espn-leaders):
// { season, stats: [{ key, zh, en, list: [{ id, name, full, headshot, team, value, games }] }] }, or null.
export function parseLeagueLeaders(data, sport = 'soccer') {
  if (sport !== 'soccer' || !data) return null;
  const cats = data.leaders?.categories || data.categories || data.stats || [];
  const stats = ESPN_SOCCER.map(([key, zh, en]) => {
    const c = cats.find(x => x?.name === key);
    const list = (c?.leaders || [])
      .map(l => {
        const a = l.athlete || {};
        // ESPN says "Matches: 6, Goals: 6": its number, and the games.
        const games = /Matches:\s*(\d+)/.exec(l.displayValue || '')?.[1];
        return { ...person(a), team: String(l.team?.id ?? a.team?.id ?? a.teamId ?? ''), value: l.value != null ? statText('n', l.value) : '', games: games ? Number(games) : null };
      })
      .filter(x => x.id && x.name && x.value !== '');
    return list.length ? { key, zh, en, list } : null;
  }).filter(Boolean);
  return stats.length ? { season: seasonOf(data), stats } : null;
}

// A football team's from its league's lists: its own players, the top three of each.
export function teamFromLeague(league, teamId) {
  if (!league) return null;
  const stats = league.stats.map(s => ({ ...s, list: s.list.filter(x => x.team === String(teamId)).slice(0, 3) })).filter(s => s.list.length);
  return stats.length ? { season: league.season, stats } : null;
}

// ---- F1: the season's races counted (Jolpica) -------------------------------------
//
// ESPN's table has each round's points alone; Jolpica has every result (a
// hundred a page, the proxy's trim: jolpica-results) and each pole sitter.
// Each stat: [key, zh, en, how, lower is better].
// (No points: 排名 has them.)
export const F1_STATS = [
  ['wins', '分站冠軍', 'Wins', 'n'],
  ['pod', '頒獎台', 'Podiums', 'n'],
  ['pole', '竿位', 'Poles', 'n'],
  ['top10', '前十完賽', 'Top-10 finishes', 'n'],
  ['fl', '最快圈速', 'Fastest laps', 'n'],
  ['avg', '平均完賽名次', 'Average finish', 'one', true],
  ['grid', '平均起跑位置', 'Average grid', 'one', true],
  ['gain', '名次推進', 'Places gained', 'n'],
  ['dnf', '退賽', 'Retirements', 'n']
];
LEADER_STATS.racing = F1_STATS;
const JOLPICA = 'https://api.jolpi.ca/ergast/f1';
export const f1ResultsUrl = (offset = 0) => `${JOLPICA}/current/results.json?limit=100${offset ? `&offset=${offset}` : ''}`;
export const f1PolesUrl = () => `${JOLPICA}/current/qualifying/1.json?limit=100`;
// `pages`: the results' pages; `poles`: the pole sitters'; `drivers`: ESPN's
// table's rows (each driver's id, to open him, and his face).
export function parseF1Leaders(pages, poles, drivers = []) {
  const by = new Map();
  let season = '';
  const races = new Set();
  const one = d => {
    const id = d?.driverId;
    if (!id) return null;
    if (!by.has(id)) {
      const full = `${d.givenName || ''} ${d.familyName || ''}`.trim();
      const row = drivers.find(r => fold(r.en || r.name) === fold(full)) || drivers.find(r => fold(r.en || r.name).endsWith(` ${fold(d.familyName)}`));
      // (By ESPN's name for him where the table has him: Kimi Antonelli, not
      // Jolpica's Andrea Kimi Antonelli, the same name and so the same photo as his page.)
      const own = row ? row.en || row.name : full;
      by.set(id, { id: row?.id || '', name: shortName(own), full: own, team: '', teamName: '', headshot: null, n: { wins: 0, pod: 0, pole: 0, top10: 0, fl: 0, gain: 0, dnf: 0 }, finishes: [], grids: [] });
    }
    return by.get(id);
  };
  for (const page of pages) {
    const t = page?.MRData?.RaceTable;
    season ||= t?.season || '';
    for (const race of t?.Races || []) {
      races.add(race.round);
      for (const x of race.Results || []) {
        const p = one(x.Driver);
        if (!p) continue;
        if (x.Constructor?.name) p.teamName = x.Constructor.name;
        const pos = /^\d+$/.test(x.positionText || '') ? Number(x.positionText) : null;
        if (Number(x.grid) > 0) p.grids.push(Number(x.grid));
        if (pos === 1) p.n.wins++;
        if (pos && pos <= 3) p.n.pod++;
        if (pos && pos <= 10) p.n.top10++;
        if (x.FastestLap?.rank === '1') p.n.fl++;
        if (pos) {
          p.finishes.push(pos);
          const grid = Number(x.grid) || 0;
          if (grid > 0) p.n.gain += grid - pos;
        } else if (x.positionText === 'R') p.n.dnf++;
      }
    }
  }
  for (const race of poles?.MRData?.RaceTable?.Races || []) {
    const p = one((race.Results || race.QualifyingResults || [])[0]?.Driver);
    if (p) p.n.pole++;
  }
  const all = [...by.values()];
  if (!all.length) return null;
  // An average finish counts those classified in half the races at least.
  const enough = Math.max(1, races.size / 2);
  const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
  for (const p of all) {
    p.n.avg = p.finishes.length >= enough ? mean(p.finishes) : null;
    p.n.grid = p.grids.length >= enough ? mean(p.grids) : null;
  }
  const stats = F1_STATS.map(([key, zh, en, how, low]) => {
    const list = all
      .filter(p => p.n[key] != null && (low || p.n[key] > 0))
      .sort((a, b) => (low ? a.n[key] - b.n[key] : b.n[key] - a.n[key]))
      .map(p => ({ id: p.id, name: p.name, full: p.full, headshot: p.headshot, team: '', teamName: p.teamName, teamZh: p.teamName ? f1Constructor(p.teamName).zh : '', value: statText(how, p.n[key]) }));
    return list.length ? { key, zh, en, list } : null;
  }).filter(Boolean);
  return stats.length ? { season: season ? { name: season } : null, stats } : null;
}

// ---- Football: FotMob's forty stats, as the leagues' own sites show them ----------------
//
// ESPN has two (goals, assists); FotMob's league page lists each stat's top
// three and where its whole list is (data.fotmob.com, one file a stat), its
// team page each stat's top three of the club's own. Both through the proxy,
// trimmed (fotmob-page, fotmob-stat). ESPN's two lists are what's left when
// FotMob can't be read.
export const FOTMOB_LEAGUE = { epl: 47, bundesliga: 54, seriea: 55, ligue1: 53, mls: 130, ucl: 42, uel: 73, uecl: 10216, facup: 132, scotland: 64, nationsleague: 9806 };
export const fotmobLeagueUrl = league => (FOTMOB_LEAGUE[league] ? `https://www.fotmob.com/api/data/leagues?id=${FOTMOB_LEAGUE[league]}` : null);
export const fotmobTeamUrl = id => `https://www.fotmob.com/api/data/teams?id=${encodeURIComponent(id)}`;
// A club's own league that Orbit Sports doesn't follow (one opened from a
// European cup or the FA Cup: Lech Poznań's Ekstraklasa), FotMob's id →
// [zh, en]; one not listed: FotMob's own name, translated.
export const FOTMOB_HOME = {
  87: ['西甲', 'LaLiga'], 140: ['西乙', 'LaLiga 2'], 61: ['葡超', 'Liga Portugal'], 57: ['荷甲', 'Eredivisie'], 40: ['比甲', 'Belgian Pro League'], 71: ['土超', 'Süper Lig'], 135: ['希超', 'Greek Super League'], 38: ['奧甲', 'Austrian Bundesliga'], 69: ['瑞士超', 'Swiss Super League'],
  196: ['波蘭超', 'Ekstraklasa'], 122: ['捷甲', 'Czech First League'], 252: ['克羅埃西亞甲', 'HNL'], 182: ['塞爾維亞超', 'Serbian SuperLiga'], 46: ['丹超', 'Danish Superliga'], 59: ['挪超', 'Eliteserien'], 67: ['瑞典超', 'Allsvenskan'], 189: ['羅甲', 'Liga I'], 212: ['匈甲', 'NB I'],
  136: ['賽普勒斯甲', 'Cypriot First Division'], 127: ['以超', "Ligat ha'Al"], 441: ['烏超', 'Ukrainian Premier League'], 270: ['保甲', 'Bulgarian First League'], 173: ['斯洛維尼亞甲', 'PrvaLiga'], 176: ['斯洛伐克甲', 'Slovak First League'], 262: ['亞塞拜然超', 'Azerbaijan Premier League'], 225: ['哈薩克超', 'Kazakhstan Premier League'],
  48: ['英冠', 'Championship'], 108: ['英甲', 'League One'], 109: ['英乙', 'League Two'], 146: ['德乙', '2. Bundesliga'], 86: ['義乙', 'Serie B'], 110: ['法乙', 'Ligue 2']
};
export const fotmobLeagueLogo = (id, dark = false) => `https://images.fotmob.com/image_resources/logo/leaguelogo/${dark ? 'dark/' : ''}${id}.png`;
export const fotmobTeamLogo = id => `https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png`;
export const fotmobFace = id => `https://images.fotmob.com/image_resources/playerimages/${id}.png`;
// The stats shown, in order: [FotMob's name, zh, en, on a team's page too].
// (Per 90 minutes where FotMob counts it so: said under the stat's name.)
export const SOCCER_STATS = [
  ['goals', '進球', 'Goals', true],
  ['goal_assist', '助攻', 'Assists', true],
  ['rating', '評分', 'Rating', true],
  ['expected_goals', '預期進球', 'xG', true],
  ['expected_assists', '預期助攻', 'xA'],
  ['total_scoring_att', '射門', 'Shots', true],
  ['ontarget_scoring_att', '射正', 'Shots on target'],
  ['big_chance_created', '製造絕佳機會', 'Big chances created'],
  ['total_att_assist', '創造機會', 'Chances created', true],
  ['accurate_pass', '傳球成功', 'Accurate passes', true],
  ['accurate_long_balls', '長傳成功', 'Accurate long balls'],
  ['won_contest', '過人成功', 'Dribbles', true],
  ['total_tackle', '搶斷', 'Tackles', true],
  ['interception', '攔截', 'Interceptions', true],
  ['effective_clearance', '解圍', 'Clearances'],
  ['ball_recovery', '奪回球權', 'Recoveries'],
  ['clean_sheet', '零封', 'Clean sheets', true],
  ['saves', '撲救', 'Saves', true],
  ['_save_percentage', '撲救率', 'Save %'],
  ['_goals_prevented', '阻止失球', 'Goals prevented'],
  ['mins_played', '出場時間', 'Minutes'],
  ['yellow_card', '黃牌', 'Yellow cards'],
  ['red_card', '紅牌', 'Red cards']
];
const fotmobValue = (v, name, fractions) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? '');
  const d = name === 'rating' ? 2 : Number.isInteger(n) ? 0 : Math.max(1, Math.min(2, fractions || 1));
  return `${n.toFixed(d)}${/percentage/.test(name) ? '%' : ''}`;
};
// FotMob's per-90 stats (its header says so).
const per90 = header => /per 90/i.test(header || '');
const fotmobPerson = (x, name, fractions) => ({ id: '', fotmob: String(x.id ?? ''), name: shortName(x.name), full: x.name || '', headshot: x.id ? fotmobFace(x.id) : null, team: '', teamName: x.teamName || '', fotmobTeam: String(x.teamId ?? ''), value: fotmobValue(x.value, name, fractions), games: x.games ?? null });
// FotMob's page as the proxy trims it (fotmob-page), from the page whole too.
function fotmobTrimmed(data) {
  if (!data || Array.isArray(data.stats)) return data;
  const st = data.stats || {};
  const list = Array.isArray(st.players) ? st.players : Object.values(st.players || {});
  const tables = (data.table || []).flatMap(t => [t?.data?.table, ...(t?.data?.tables || []).map(x => x?.table)]).filter(Boolean);
  const teams = new Map();
  for (const t of tables) for (const r of t.all || []) if (r?.id != null) teams.set(r.id, { id: r.id, name: r.name, shortName: r.shortName });
  return {
    season: data.details?.selectedSeason || '',
    teamId: st.teamId,
    stats: list.map(x => ({ header: x.header, name: x.participant?.stat?.name || '', fractions: x.participant?.stat?.fractions ?? 0, url: x.fetchAllUrl || '', top: x.topThree || [] })),
    teams: [...teams.values()]
  };
}
// A league's or team's page: { season, teams, teamId, stats: [{ key, zh, en, per90, url, list }] }, or null.
export function parseFotmobPage(raw, { team = false } = {}) {
  const data = fotmobTrimmed(raw);
  if (!data?.stats?.length) return null;
  const by = new Map(data.stats.map(s => [s.name, s]));
  const stats = SOCCER_STATS.filter(([, , , onTeam]) => !team || onTeam)
    .map(([key, zh, en]) => {
      const s = by.get(key);
      const list = (s?.top || []).filter(x => x?.name && x.value != null).map(x => fotmobPerson(x, key, s.fractions));
      return list.length ? { key, zh, en, per90: per90(s.header), url: s.url, list } : null;
    })
    .filter(Boolean);
  const season = String(data.season || '').replace(/^(\d{4})\/(\d{2})(\d{2})$/, '$1-$3');
  return stats.length ? { season: season ? { name: season } : null, teams: data.teams || [], teamId: data.teamId ?? null, stats } : null;
}
// One stat's whole list (trimmed: its top hundred).
export function parseFotmobStat(raw, key) {
  const t = raw?.TopLists?.[0];
  const data = t ? { decimals: t.StatDecimals, list: (t.StatList || []).slice(0, LEAGUE_TOP).map(x => ({ id: x.ParticiantId ?? x.ParticipantId, name: x.ParticipantName, teamId: x.TeamId, teamName: x.TeamName, value: x.StatValue, games: x.MatchesPlayed })) } : raw;
  return (data?.list || []).filter(x => x?.name).map(x => fotmobPerson(x, key, data.decimals));
}
// FotMob's club for an ESPN one (`words`: the kit's ways of naming a side):
// the same name, else the one its names say most of.
// (Brighton & Hove Albion is FotMob's Brighton and Hove Albion; marks and dots dropped.)
const clubKey = s => fold(String(s || '').replace(/&/g, ' and ')).replace(/[^a-z0-9]+/g, ' ').trim();
export function fotmobTeamOf(teams, side, words = []) {
  const names = [side?.en, side?.name, side?.short].filter(Boolean).map(clubKey);
  const exact = teams.find(t => [t.name, t.shortName].map(clubKey).some(n => names.includes(n)));
  if (exact) return exact;
  const score = t => words.filter(w => w && !/[㐀-鿿]/.test(w) && [t.name, t.shortName].map(clubKey).some(n => n.includes(w))).length;
  const best = teams.map(t => ({ t, n: score(t) })).sort((a, b) => b.n - a.n);
  return best[0]?.n > 0 && best[0].n > (best[1]?.n || 0) ? best[0].t : null;
}
// The league table's row for each of FotMob's clubs (its id → the row), so a
// leader's club is named and badged as everywhere else in the app.
export function fotmobClubRows(teams = [], rows = [], wordsOf = () => []) {
  const out = new Map();
  for (const r of rows) {
    const t = fotmobTeamOf(teams, { name: r.en || r.name, en: r.en, short: r.short }, wordsOf(r));
    if (t && !out.has(String(t.id))) out.set(String(t.id), r);
  }
  return out;
}
