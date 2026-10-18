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
// "Gianluigi Donnarumma" → "G. Donnarumma", as ESPN shortens its names (one name stays whole: Florentino).
const shortName = n => {
  const w = String(n || '').trim().split(/\s+/);
  return w.length > 1 ? `${w[0][0]}. ${w.slice(1).join(' ')}` : w[0] || '';
};
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
// One stat's whole list (trimmed: its top ten).
export function parseFotmobStat(raw, key) {
  const t = raw?.TopLists?.[0];
  const data = t ? { decimals: t.StatDecimals, list: (t.StatList || []).slice(0, 10).map(x => ({ id: x.ParticiantId ?? x.ParticipantId, name: x.ParticipantName, teamId: x.TeamId, teamName: x.TeamName, value: x.StatValue, games: x.MatchesPlayed })) } : raw;
  return (data?.list || []).filter(x => x?.name).map(x => fotmobPerson(x, key, data.decimals));
}
// FotMob's club for an ESPN one (`words`: the kit's ways of naming a side):
// the same name, else the one its names say most of.
const fold = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ø/g, 'o').replace(/ß/g, 'ss');
export function fotmobTeamOf(teams, side, words = []) {
  const names = [side?.en, side?.name, side?.short].filter(Boolean).map(fold);
  const exact = teams.find(t => [t.name, t.shortName].map(fold).some(n => names.includes(n)));
  if (exact) return exact;
  const score = t => words.filter(w => w && !/[㐀-鿿]/.test(w) && [t.name, t.shortName].map(fold).some(n => n.includes(w))).length;
  const best = teams.map(t => ({ t, n: score(t) })).sort((a, b) => b.n - a.n);
  return best[0]?.n > 0 && best[0].n > (best[1]?.n || 0) ? best[0].t : null;
}
