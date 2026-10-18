// 數據領先 beyond a game: a league's leaders (each stat's top five) and a
// team's (each stat's best of its own), from ESPN's season numbers, the
// regular season's (MLB's postseason numbers are a handful of games).
//   - a league's: basketball's and baseball's leaders list (site v3, top 10
//     each, trimmed by the proxy: espn-leaders), football's top scorers and
//     assists (site v2 statistics, 50 each, its clubs named);
//   - a team's: basketball's and baseball's players with their season numbers
//     (teams/<id>/athletes/statistics), each stat's best who qualifies;
//     football's from the league's lists, its own players.
// Each stat: [key in the league's list, key in a team's, zh, en, lower is better].
export const LEADER_STATS = {
  basketball: [
    ['pointsPerGame', 'avgPoints', '得分', 'Points'],
    ['reboundsPerGame', 'avgRebounds', '籃板', 'Rebounds'],
    ['assistsPerGame', 'avgAssists', '助攻', 'Assists'],
    ['stealsPerGame', 'avgSteals', '抄截', 'Steals'],
    ['blocksPerGame', 'avgBlocks', '阻攻', 'Blocks'],
    ['3PointsMadePerGame', 'avgThreePointFieldGoalsMade', '三分球', '3-pointers']
  ],
  baseball: [
    ['avg', 'avg', '打擊率', 'Average'],
    ['homeRuns', 'homeRuns', '全壘打', 'Home runs'],
    ['RBIs', 'RBIs', '打點', 'RBI'],
    ['stolenBases', 'stolenBases', '盜壘', 'Stolen bases'],
    ['ERA', 'ERA', '防禦率', 'ERA', true],
    ['wins', 'wins', '勝投', 'Wins'],
    ['strikeouts', 'strikeouts', '三振', 'Strikeouts'],
    ['saves', 'saves', '救援', 'Saves']
  ],
  soccer: [
    ['goalsLeaders', 'goalsLeaders', '進球', 'Goals'],
    ['assistsLeaders', 'assistsLeaders', '助攻', 'Assists']
  ]
};
// (Per game, said once under the stat's name.)
export const PER_GAME = new Set(['basketball']);
export const hasLeaders = (sport, espn) => Boolean(espn && LEADER_STATS[sport]);

const SITE = 'https://site.api.espn.com/apis/site';
export const leagueLeadersUrl = (sport, espn) => (sport === 'soccer' ? `${SITE}/v2/sports/${espn}/statistics` : `${SITE}/v3/sports/${espn}/leaders?limit=10&seasontype=2`);
export const teamLeadersUrl = (espn, id) => `${SITE}/v2/sports/${espn}/teams/${encodeURIComponent(id)}/athletes/statistics?seasontype=2`;

const shot = h => (typeof h === 'string' ? h : h?.href) || null;
const person = a => ({ id: String(a?.id ?? ''), name: a?.shortName || a?.displayName || '', full: a?.displayName || a?.shortName || '', headshot: shot(a?.headshot) });
// The season by its years alone ("2026-27 English Premier League" → 2026-27).
const seasonOf = data => {
  const s = data?.requestedSeason || data?.season;
  const name = /\d{4}(?:-\d{2})?/.exec(s?.displayName || '')?.[0] || (s?.year ? String(s.year) : '');
  return name ? { name } : null;
};
// A number as the stat writes it: an average .316 (no leading 0), ERA 1.80,
// a count whole, basketball's per game to one place.
const RATE3 = new Set(['avg', 'OPS', 'onBasePct', 'slugAvg']);
export function statText(key, value, sport) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '');
  if (RATE3.has(key)) return n.toFixed(3).replace(/^0\./, '.');
  if (key === 'ERA' || key === 'WHIP') return n.toFixed(2);
  if (sport === 'basketball') return n.toFixed(1);
  return String(Math.round(n));
}

// A league's list (ESPN's whole, or the proxy's trim of it): { season,
// stats: [{ key, zh, en, list: [{ id, name, full, headshot, team, value, games }] }] }, or null.
export function parseLeagueLeaders(data, sport) {
  const want = LEADER_STATS[sport];
  if (!want || !data) return null;
  const cats = data.leaders?.categories || data.categories || data.stats || [];
  const stats = want
    .map(([key, , zh, en]) => {
      const c = cats.find(x => x?.name === key);
      const list = (c?.leaders || [])
        .map(l => {
          const a = l.athlete || {};
          // Football's says "Matches: 6, Goals: 6": its number, and the games.
          const games = /Matches:\s*(\d+)/.exec(l.displayValue || '')?.[1];
          return { ...person(a), team: String(l.team?.id ?? a.team?.id ?? a.teamId ?? ''), value: l.value != null ? statText(key, l.value, sport) : '', games: games ? Number(games) : null };
        })
        .filter(x => x.id && x.name && x.value !== '');
      return list.length ? { key, zh, en, list } : null;
    })
    .filter(Boolean);
  return stats.length ? { season: seasonOf(data), stats } : null;
}

// A team's players' season numbers: each stat's best who qualifies (a
// batter with his plate appearances, a pitcher with his innings, as ESPN
// marks them; else a fair share of the team's games), the top three.
const num = v => {
  const n = Number(String(v ?? '').replace(/^\./, '0.'));
  return Number.isFinite(n) ? n : null;
};
export function parseTeamLeaders(data, sport) {
  const want = LEADER_STATS[sport];
  if (!want || sport === 'soccer' || !data?.results?.length) return null;
  const players = new Map();
  for (const r of data.results) {
    for (const l of r.leaders || []) {
      const p = person(l.athlete);
      if (!p.id) continue;
      const st = Object.fromEntries((l.statistics || []).flatMap(c => c?.stats || []).map(x => [x.name, x.displayValue ?? String(x.value ?? '')]));
      const had = players.get(p.id);
      players.set(p.id, { ...p, by: { ...(had?.by || {}), [r.name]: st } });
    }
  }
  const all = [...players.values()];
  const teamGames = Math.max(0, ...all.flatMap(p => Object.values(p.by).map(st => num(st.teamGamesPlayed) || num(st.gamesPlayed) || 0)));
  // Which of a player's tables a stat is in (a two-way player's ERA is his pitching's).
  const PITCHING = new Set(['ERA', 'wins', 'strikeouts', 'saves']);
  const tableOf = (p, key) => (sport === 'baseball' ? p.by[PITCHING.has(key) ? 'pitching' : 'batting'] : Object.values(p.by)[0]);
  const rate = new Set(['avg', 'ERA']);
  const qualifies = (st, key) => {
    if (!st) return false;
    if (sport === 'basketball') return (num(st.gamesPlayed) || 0) >= Math.max(1, teamGames * 0.4);
    if (!rate.has(key)) return true;
    if (st.isQualified != null) return st.isQualified === '1' || st.isQualified === 'true';
    return key === 'avg' ? (num(st.atBats) || 0) >= teamGames * 2.5 : (num(st.innings) || 0) >= teamGames * 0.8;
  };
  const stats = want
    .map(([, key, zh, en, low]) => {
      const list = all
        .map(p => ({ p, st: tableOf(p, key) }))
        .filter(({ st }) => qualifies(st, key) && num(st[key]) != null)
        .map(({ p, st }) => ({ id: p.id, name: p.name, full: p.full, headshot: p.headshot, value: st[key], n: num(st[key]) }))
        // (Nothing at all is no leader: a team's 0 saves.)
        .filter(x => low || x.n > 0)
        .sort((a, b) => (low ? a.n - b.n : b.n - a.n))
        .slice(0, 3)
        .map(({ n, ...x }) => x);
      return list.length ? { key, zh, en, list } : null;
    })
    .filter(Boolean);
  return stats.length ? { season: seasonOf(data), stats } : null;
}

// A football team's from its league's lists: its own players, the top three of each.
export function teamFromLeague(league, teamId) {
  if (!league) return null;
  const stats = league.stats.map(s => ({ ...s, list: s.list.filter(x => x.team === String(teamId)).slice(0, 3) })).filter(s => s.list.length);
  return stats.length ? { season: league.season, stats } : null;
}
