// A league's teams by their own numbers this season (數據 球隊 on a league's
// page, 數據 on a team's): each stat's whole list, every team ranked in it.
// Basketball's and baseball's from ESPN (common v3 statistics/byteam, the
// proxy's espn-teams trim: each team's own numbers and its opponents');
// football's from FotMob (its league page's club lists, each with its whole
// list's file). A rank is counted here (ESPN's own ranks are mostly "-"):
// level on the number, level in the list.

const COMMON = 'https://site.api.espn.com/apis/common/v3/sports';
export const teamStatsUrl = espn => `${COMMON}/${espn}/statistics/byteam?limit=50&seasontype=2`;

// [category, own or opponents' (900), ESPN's name, zh, en, lower is better].
const ESPN_TEAM_STATS = {
  basketball: [
    ['offensive', '0', 'avgPoints', '得分', 'Points'],
    ['offensive', '900', 'avgPoints', '失分', 'Points allowed', true],
    ['differential', '0', 'avgPointsDifferential', '淨勝分', 'Point margin'],
    ['general', '0', 'avgRebounds', '籃板', 'Rebounds'],
    ['offensive', '0', 'avgAssists', '助攻', 'Assists'],
    ['defensive', '0', 'avgSteals', '抄截', 'Steals'],
    ['defensive', '0', 'avgBlocks', '阻攻', 'Blocks'],
    ['offensive', '0', 'avgTurnovers', '失誤', 'Turnovers', true],
    ['offensive', '0', 'fieldGoalPct', '投籃命中率', 'FG%'],
    ['offensive', '0', 'threePointFieldGoalPct', '三分命中率', '3P%'],
    ['offensive', '0', 'avgThreePointFieldGoalsMade', '三分進球', '3PM'],
    ['offensive', '0', 'freeThrowPct', '罰球命中率', 'FT%'],
    ['offensive', '900', 'fieldGoalPct', '對手命中率', 'Opp. FG%', true]
  ],
  baseball: [
    ['batting', '0', 'runs', '得分', 'Runs'],
    ['batting', '0', 'avg', '打擊率', 'AVG'],
    ['batting', '0', 'OPS', '整體攻擊指數', 'OPS'],
    ['batting', '0', 'homeRuns', '全壘打', 'Home runs'],
    ['batting', '0', 'hits', '安打', 'Hits'],
    ['batting', '0', 'stolenBases', '盜壘', 'Stolen bases'],
    ['pitching', '0', 'ERA', '防禦率', 'ERA', true],
    ['pitching', '0', 'WHIP', '每局被上壘', 'WHIP', true],
    ['pitching', '0', 'strikeouts', '三振', 'Strikeouts'],
    ['pitching', '0', 'opponentAvg', '被打擊率', 'Opp. AVG', true],
    ['pitching', '0', 'saves', '救援成功', 'Saves'],
    ['pitching', '0', 'qualityStarts', '優質先發', 'Quality starts'],
    ['fielding', '0', 'errors', '失誤', 'Errors', true],
    ['fielding', '0', 'fieldingPct', '守備率', 'Fielding %']
  ]
};
// Football's, in order: [FotMob's name, zh, en, lower is better].
export const SOCCER_TEAM_STATS = [
  ['rating_team', '評分', 'Rating'],
  ['goals_team_match', '場均進球', 'Goals per game'],
  ['goals_conceded_team_match', '場均失球', 'Conceded per game', true],
  ['possession_percentage_team', '控球率', 'Possession'],
  ['expected_goals_team', '預期進球', 'xG'],
  ['expected_goals_conceded_team', '預期失球', 'xG against', true],
  ['_xg_diff_team', '預期進球差', 'xG difference'],
  ['ontarget_scoring_att_team', '場均射正', 'Shots on target per game'],
  ['big_chance_team', '絕佳機會', 'Big chances'],
  ['touches_in_opp_box_team', '禁區內觸球', 'Touches in the box'],
  ['accurate_pass_team', '場均傳球', 'Accurate passes per game'],
  ['clean_sheet_team', '零封', 'Clean sheets'],
  ['total_tackle_team', '場均搶斷', 'Tackles per game'],
  ['interception_team', '場均攔截', 'Interceptions per game'],
  ['saves_team', '場均撲救', 'Saves per game'],
  ['corner_taken_team', '角球', 'Corners'],
  ['_set_piece_goals_team', '定位球進球', 'Set-piece goals']
];

// Ranks for a list already in order (best first): level on the number, level in the list.
export function ranked(list) {
  return list.map((x, i) => ({ ...x, rank: list.findIndex(y => y.n === x.n) + 1 || i + 1 }));
}
const order = (list, low) => ranked([...list].filter(x => Number.isFinite(x.n)).sort((a, b) => (low ? a.n - b.n : b.n - a.n)));
const shown = (n, dp) => (Number.isInteger(n) ? String(n) : n.toFixed(dp));

// ESPN's answer: { season, stats: [{ key, zh, en, low, list: [{ id, name, short, abbr, logo, value, n, rank }] }] }, or null.
export function parseTeamStats(raw, sport) {
  const want = ESPN_TEAM_STATS[sport];
  if (!want || !Array.isArray(raw?.teams) || !raw.teams.length) return null;
  const names = new Map((raw.categories || []).filter(c => c.names?.length).map(c => [c.name, c.names]));
  const stats = want
    .map(([cat, split, name, zh, en, low]) => {
      const at = (names.get(cat) || []).indexOf(name);
      if (at < 0) return null;
      const list = raw.teams.map(t => {
        const c = (t.categories || []).find(x => x.name === cat && String(x.splitId ?? '0') === split);
        const n = Number(c?.values?.[at]);
        // (ESPN's own writing where it has one: 117.1, .254; a rate it writes 46.5.)
        const text = c?.totals?.[at];
        return { id: String(t.team?.id ?? ''), name: t.team?.displayName || '', short: t.team?.shortDisplayName || '', abbr: t.team?.abbreviation || '', logo: t.team?.logo || '', n, value: text != null && text !== '' ? String(text) : Number.isFinite(n) ? shown(n, 1) : '' };
      });
      const listed = order(list, low);
      return listed.length > 1 ? { key: `${cat}.${split}.${name}`, zh, en, low: Boolean(low), list: listed } : null;
    })
    .filter(Boolean);
  if (!stats.length) return null;
  const s = raw.requestedSeason;
  return { season: s?.displayName ? { name: s.displayName } : null, stats };
}

// FotMob's league page (the proxy's fotmob-page trim keeps teamStats): each
// stat with its top three and where its whole list is; { season, stats }, or null.
export function parseFotmobTeamStats(page) {
  const by = new Map((page?.teamStats || []).map(s => [s.name, s]));
  const stats = SOCCER_TEAM_STATS.map(([key, zh, en, low]) => {
    const s = by.get(key);
    if (!s) return null;
    const list = order((s.top || []).filter(x => x?.name).map(x => fotmobClub(x, key, s.fractions)), low);
    return list.length ? { key, zh, en, low: Boolean(low), url: s.url || '', list } : null;
  }).filter(Boolean);
  if (!stats.length) return null;
  const season = String(page?.season || '').replace(/^(\d{4})\/(\d{2})(\d{2})$/, '$1-$3');
  return { season: season ? { name: season } : null, stats };
}
const fotmobClub = (x, key, fractions) => {
  // (A club list's file names the club by TeamId, its ParticiantId 0.)
  x = { ...x, id: x.id || x.teamId || x.id };
  const n = Number(x.value);
  const dp = key === 'rating_team' ? 2 : Math.max(1, Math.min(2, Number(fractions) || 1));
  const value = !Number.isFinite(n) ? String(x.value ?? '') : key === 'possession_percentage_team' ? `${shown(n, 1)}%` : shown(n, dp);
  return { id: '', fotmob: String(x.id ?? ''), name: x.name || '', short: x.name || '', abbr: '', logo: x.id != null ? `https://images.fotmob.com/image_resources/logo/teamlogo/${x.id}.png` : '', n, value };
};
// One football stat's whole list (data.fotmob.com, the proxy's fotmob-stat trim), ranked.
export function parseFotmobTeamList(raw, key) {
  const low = SOCCER_TEAM_STATS.find(s => s[0] === key)?.[3];
  return order((raw?.list || []).filter(x => x?.name).map(x => fotmobClub(x, key, raw.decimals)), low);
}

// Where a team stands in each stat: [{ stat, value, rank, of }], the stat's order kept.
export function teamRanks(data, match) {
  return (data?.stats || [])
    .map(st => {
      const x = st.list.find(match);
      return x ? { stat: st, value: x.value, rank: x.rank, of: st.list.length } : null;
    })
    .filter(Boolean);
}
