import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLeagueLeaders, parseTeamLeaders, teamFromLeague, statText, leagueLeadersUrl } from '../public/lib/leaders.mjs';

const a = (id, name) => ({ id, displayName: name, shortName: name.replace(/^(\w)\w+ /, '$1. '), headshot: { href: `${id}.png` } });

test("a league's leaders: baseball's numbers as the stat writes them (.316, 1.80), its regular season; the proxy's trim reads the same", () => {
  const raw = { requestedSeason: { year: 2026, displayName: '2026' }, leaders: { categories: [{ name: 'avg', leaders: [{ value: 0.3157, displayValue: '179-567, 42 HR', athlete: a('1', 'Yordan Alvarez'), team: { id: '18' } }] }, { name: 'ERA', leaders: [{ value: 1.8034, displayValue: '174.2 IP', athlete: a('2', 'Jacob Misiorowski'), team: { id: '8' } }] }] } };
  const d = parseLeagueLeaders(raw, 'baseball');
  assert.deepEqual(d.season, { name: '2026' });
  assert.deepEqual(d.stats.map(s => [s.zh, s.list[0].name, s.list[0].team, s.list[0].value]), [['打擊率', 'Y. Alvarez', '18', '.316'], ['防禦率', 'J. Misiorowski', '8', '1.80']]);
  const trimmed = { season: { year: 2026, displayName: '2026' }, categories: [{ name: 'avg', leaders: [{ value: 0.3157, team: { id: '18' }, athlete: { id: '1', displayName: 'Yordan Alvarez', shortName: 'Y. Alvarez', headshot: '1.png' } }] }] };
  assert.equal(parseLeagueLeaders(trimmed, 'baseball').stats[0].list[0].headshot, '1.png');
  assert.match(leagueLeadersUrl('baseball', 'baseball/mlb'), /v3\/sports\/baseball\/mlb\/leaders\?.*seasontype=2/);
});

test("football's scorers: the club from the player, the season by its years, the games played", () => {
  const raw = { season: { year: 2026, displayName: '2026-27 English Premier League' }, stats: [{ name: 'goalsLeaders', leaders: [{ value: 6, displayValue: 'Matches: 6, Goals: 6', athlete: { ...a('9', 'Erling Haaland'), team: { id: '382' } } }, { value: 4, displayValue: 'Matches: 6, Goals: 4', athlete: { ...a('8', 'Rayan Cherki'), team: { id: '382' } } }, { value: 4, displayValue: 'Matches: 5, Goals: 4', athlete: { ...a('7', 'Igor Thiago'), team: { id: '337' } } }] }] };
  const d = parseLeagueLeaders(raw, 'soccer');
  assert.deepEqual(d.season, { name: '2026-27' });
  assert.deepEqual(d.stats[0].list.map(x => [x.name, x.team, x.value, x.games]), [['E. Haaland', '382', '6', 6], ['R. Cherki', '382', '4', 6], ['I. Thiago', '337', '4', 5]]);
  assert.deepEqual(teamFromLeague(d, '382').stats[0].list.map(x => x.name), ['E. Haaland', 'R. Cherki']);
  assert.equal(teamFromLeague(d, '1'), null);
});

test("a team's leaders: each stat's best who qualifies (ESPN's mark for an average or ERA), a pitcher's numbers from his pitching", () => {
  const row = (who, by) => ({ athlete: who, statistics: [{ name: 'x', stats: Object.entries(by).map(([name, displayValue]) => ({ name, displayValue })) }] });
  const data = {
    requestedSeason: { year: 2026, displayName: '2026' },
    results: [
      { name: 'batting', leaders: [row(a('1', 'Freddie Freeman'), { teamGamesPlayed: '162', avg: '.288', homeRuns: '16', RBIs: '70', stolenBases: '7', isQualified: '1' }), row(a('2', 'Shohei Ohtani'), { avg: '.275', homeRuns: '30', RBIs: '81', stolenBases: '11', isQualified: '1' }), row(a('3', 'Hot Callup'), { avg: '.400', homeRuns: '2', RBIs: '5', stolenBases: '0', isQualified: '0' })] },
      { name: 'pitching', leaders: [row(a('4', 'Yoshinobu Yamamoto'), { ERA: '2.53', wins: '14', strikeouts: '182', saves: '0', isQualified: '1' }), row(a('2', 'Shohei Ohtani'), { ERA: '2.10', wins: '8', strikeouts: '120', saves: '0', isQualified: '0' }), row(a('5', 'Tanner Scott'), { ERA: '3.10', wins: '2', strikeouts: '60', saves: '25', isQualified: '0' })] }
    ]
  };
  const d = parseTeamLeaders(data, 'baseball');
  const by = Object.fromEntries(d.stats.map(s => [s.zh, s.list.map(x => `${x.name} ${x.value}`)]));
  assert.deepEqual(by['打擊率'], ['F. Freeman .288', 'S. Ohtani .275'], 'the callup has too few at-bats');
  assert.deepEqual(by['全壘打'][0], 'S. Ohtani 30');
  assert.deepEqual(by['防禦率'], ['Y. Yamamoto 2.53']);
  assert.deepEqual(by['救援'], ['T. Scott 25'], "nobody's 0 is no leader");
  assert.equal(statText('pointsPerGame', 33.48, 'basketball'), '33.5');
});

test("football from FotMob: its stats in our order (per 90 said), short names in a team's grid, its page whole or trimmed alike; clubs matched to ESPN's by name", async () => {
  const { parseFotmobPage, parseFotmobStat, fotmobTeamOf, SOCCER_STATS } = await import('../public/lib/leaders.mjs');
  const top = (id, name, value, teamId = 8456, teamName = 'Manchester City') => ({ id, name, teamId, teamName, value });
  const raw = {
    details: { selectedSeason: '2026/2027' },
    table: [{ data: { table: { all: [{ id: 8456, name: 'Manchester City', shortName: 'Man City' }, { id: 8586, name: 'Tottenham Hotspur', shortName: 'Tottenham' }] } } }],
    stats: { players: { a: { header: 'Tackles per 90', participant: { stat: { name: 'total_tackle', fractions: 1 } }, fetchAllUrl: 'u2', topThree: [top(966027, 'Conor Gallagher', 4.3, 8586, 'Tottenham Hotspur')] }, b: { header: 'Top scorer', participant: { stat: { name: 'goals', fractions: 0 } }, fetchAllUrl: 'u1', topThree: [top(737066, 'Erling Haaland', 8)] }, c: { header: 'Save percentage', participant: { stat: { name: '_save_percentage', fractions: 1 } }, fetchAllUrl: 'u3', topThree: [top(1, 'James Trafford', 82.8)] } } }
  };
  const d = parseFotmobPage(raw);
  assert.deepEqual(d.season, { name: '2026-27' });
  assert.deepEqual(d.stats.map(s => [s.key, s.per90, s.list[0].name, s.list[0].full, s.list[0].value]), [['goals', false, 'E. Haaland', 'Erling Haaland', '8'], ['total_tackle', true, 'C. Gallagher', 'Conor Gallagher', '4.3'], ['_save_percentage', false, 'J. Trafford', 'James Trafford', '82.8%']]);
  assert.match(d.stats[0].list[0].headshot, /playerimages\/737066\.png$/);
  assert.ok(SOCCER_STATS.length >= 20, 'far more than goals and assists');
  assert.equal(parseFotmobPage(raw, { team: true }).stats.some(s => s.key === '_save_percentage'), false, "a team's grid: its main ones");
  const list = parseFotmobStat({ TopLists: [{ StatDecimals: 1, StatList: [{ ParticipantName: 'Conor Gallagher', ParticiantId: 966027, TeamName: 'Tottenham Hotspur', TeamId: 8586, StatValue: 4.3, MatchesPlayed: 4 }] }] }, 'total_tackle');
  assert.deepEqual([list[0].full, list[0].teamName, list[0].value], ['Conor Gallagher', 'Tottenham Hotspur', '4.3']);
  assert.equal(fotmobTeamOf(d.teams, { name: 'Tottenham Hotspur', short: 'Spurs' }).id, 8586);
  assert.equal(fotmobTeamOf(d.teams, { name: 'Wolverhampton Wanderers' }, ['wolverhampton', 'wolves']), null, 'not in the league: none, never a guess');
});
