import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLeagueLeaders, parseAthleteLeaders, parseTeamAthletes, teamFromLeague, statText, leagueLeadersUrl, athletesUrls, ATHLETE_STATS, LEAGUE_TOP } from '../public/lib/leaders.mjs';

const a = (id, name) => ({ id, displayName: name, shortName: name.replace(/^(\w)\w+ /, '$1. '), headshot: { href: `${id}.png` } });

// ESPN's every-player list (statistics/byathlete), as the proxy trims it.
const page = (season, cats, rows) => ({
  requestedSeason: { year: 2026, displayName: season },
  categories: Object.entries(cats).map(([name, names]) => ({ name, names })),
  athletes: rows.map(([id, name, team, by]) => ({ athlete: { id, displayName: name, teamId: team }, categories: Object.entries(cats).map(([c, names]) => ({ name: c, values: names.map(k => by[c]?.[k] ?? null) })) }))
});
const NBA = { general: ['gamesPlayed', 'avgMinutes', 'doubleDouble', 'tripleDouble', 'rebounds', 'avgRebounds'], offensive: ['avgPoints', 'fieldGoalPct', 'fieldGoalsMade', 'threePointFieldGoalPct', 'threePointFieldGoalsMade', 'avgThreePointFieldGoalsMade', 'freeThrowPct', 'freeThrowsMade', 'avgFreeThrowsMade', 'avgAssists', 'points', 'assists'], defensive: ['avgSteals', 'avgBlocks'] };

test("basketball's leaders: far more than five stats, each ranked from every player's season, a rate only among those who qualify", () => {
  const d = parseAthleteLeaders(
    [
      page('2025-26', NBA, [
        ['1', 'Luka Doncic', '13', { general: { gamesPlayed: 64, avgMinutes: 35.8, doubleDouble: 34, avgRebounds: 7.7 }, offensive: { avgPoints: 33.48, fieldGoalPct: 47.56, fieldGoalsMade: 693, avgAssists: 8.3, freeThrowPct: 78, freeThrowsMade: 503 } }],
        ['2', 'Rudy Gobert', '16', { general: { gamesPlayed: 80, avgRebounds: 11.5 }, offensive: { avgPoints: 11, fieldGoalPct: 68.1, fieldGoalsMade: 400 } }],
        ['3', 'Ten Day', '1', { general: { gamesPlayed: 4, avgRebounds: 2 }, offensive: { avgPoints: 40, fieldGoalPct: 90, fieldGoalsMade: 9 } }]
      ])
    ],
    'basketball',
    'nba'
  );
  assert.ok(ATHLETE_STATS.basketball.length >= 12 && LEAGUE_TOP === 100);
  assert.deepEqual(d.season, { name: '2025-26' });
  const by = Object.fromEntries(d.stats.map(s => [s.zh, s.list.map(x => `${x.name} ${x.value}`)]));
  assert.deepEqual(by['得分'], ['L. Doncic 33.5', 'R. Gobert 11.0'], 'four games is too few');
  assert.deepEqual(by['投籃命中率'], ['R. Gobert 68.1%', 'L. Doncic 47.6%']);
  assert.deepEqual(by['雙十'], ['L. Doncic 34']);
  assert.equal(d.stats.find(s => s.zh === '得分').perGame, true);
  assert.match(d.stats[0].list[0].headshot, /headshots\/nba\/players\/full\/1\.png/);
  assert.equal(parseTeamAthletes([page('2025-26', NBA, [['1', 'Luka Doncic', '13', { general: { gamesPlayed: 64 }, offensive: { avgPoints: 33.48 } }], ['2', 'Rudy Gobert', '16', { general: { gamesPlayed: 80 }, offensive: { avgPoints: 11 } }]])], 'basketball', 'nba', '16').stats[0].list[0].name, 'R. Gobert');
  assert.match(athletesUrls('basketball', 'basketball/nba')[0], /common\/v3\/sports\/basketball\/nba\/statistics\/byathlete\?limit=1000&isqualified=false&seasontype=2$/);
});

test("baseball's: batters and pitchers from their two lists (.316, 1.80), a rate by plate appearances or innings, nobody's 0 no leader", () => {
  const MLB = { batting: ['gamesPlayed', 'atBats', 'walks', 'avg', 'homeRuns'], pitching: ['gamesPlayed', 'innings', 'ERA', 'saves'] };
  const bat = page('2026', MLB, [
    ['1', 'Yordan Alvarez', '18', { batting: { gamesPlayed: 162, atBats: 567, walks: 60, avg: 0.3157, homeRuns: 30 } }],
    ['2', 'Hot Callup', '18', { batting: { gamesPlayed: 20, atBats: 50, walks: 2, avg: 0.4, homeRuns: 5 } }]
  ]);
  const pit = page('2026', MLB, [
    ['3', 'Jacob Misiorowski', '8', { pitching: { gamesPlayed: 30, innings: 174.2, ERA: 1.8034, saves: 0 } }],
    ['4', 'Closer Guy', '8', { pitching: { gamesPlayed: 60, innings: 60.1, ERA: 1.2, saves: 35 } }]
  ]);
  const d = parseAthleteLeaders([bat, pit], 'baseball', 'mlb');
  const by = Object.fromEntries(d.stats.map(s => [s.zh, s.list.map(x => `${x.name} ${x.value}`)]));
  assert.deepEqual(by['打擊率'], ['Y. Alvarez .316']);
  assert.deepEqual(by['全壘打'], ['Y. Alvarez 30', 'H. Callup 5']);
  assert.deepEqual(by['防禦率'], ['J. Misiorowski 1.80'], 'a reliever has too few innings');
  assert.deepEqual(by['救援'], ['C. Guy 35']);
  assert.equal(athletesUrls('baseball', 'baseball/mlb').length, 2);
  assert.equal(statText('avg', 0.3), '.300');
});

test("football's scorers: the club from the player, the season by its years, the games played", () => {
  const raw = { season: { year: 2026, displayName: '2026-27 English Premier League' }, stats: [{ name: 'goalsLeaders', leaders: [{ value: 6, displayValue: 'Matches: 6, Goals: 6', athlete: { ...a('9', 'Erling Haaland'), team: { id: '382' } } }, { value: 4, displayValue: 'Matches: 6, Goals: 4', athlete: { ...a('8', 'Rayan Cherki'), team: { id: '382' } } }, { value: 4, displayValue: 'Matches: 5, Goals: 4', athlete: { ...a('7', 'Igor Thiago'), team: { id: '337' } } }] }] };
  const d = parseLeagueLeaders(raw, 'soccer');
  assert.deepEqual(d.season, { name: '2026-27' });
  assert.deepEqual(d.stats[0].list.map(x => [x.name, x.team, x.value, x.games]), [['E. Haaland', '382', '6', 6], ['R. Cherki', '382', '4', 6], ['I. Thiago', '337', '4', 5]]);
  assert.deepEqual(teamFromLeague(d, '382').stats[0].list.map(x => x.name), ['E. Haaland', 'R. Cherki']);
  assert.equal(teamFromLeague(d, '1'), null);
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

test("F1's leaders from the season's results: wins, podiums, poles, top tens, fastest laps, an average finish over enough races, each driver ESPN's", async () => {
  const { parseF1Leaders, F1_STATS, hasLeaders } = await import('../public/lib/leaders.mjs');
  const res = (round, rows) => ({ season: '2026', round, Results: rows.map(([driverId, givenName, familyName, positionText, grid, points, fl]) => ({ positionText, grid, points, laps: '50', FastestLap: { rank: fl ? '1' : '5' }, Driver: { driverId, givenName, familyName }, Constructor: { name: 'Mercedes' } })) });
  const pages = [{ MRData: { total: '6', RaceTable: { season: '2026', Races: [res('1', [['russell', 'George', 'Russell', '1', '3', '25', true], ['antonelli', 'Kimi', 'Antonelli', '2', '1', '18'], ['max', 'Max', 'Verstappen', 'R', '2', '0']]), res('2', [['antonelli', 'Kimi', 'Antonelli', '1', '1', '25', true], ['russell', 'George', 'Russell', '3', '2', '15'], ['max', 'Max', 'Verstappen', '2', '9', '18']])] } } }];
  const poles = { MRData: { RaceTable: { Races: [{ QualifyingResults: [{ Driver: { driverId: 'antonelli', givenName: 'Kimi', familyName: 'Antonelli' } }] }, { QualifyingResults: [{ Driver: { driverId: 'antonelli' } }] }] } } };
  const d = parseF1Leaders(pages, poles, [{ id: '5503', en: 'George Russell', athlete: true }]);
  const by = Object.fromEntries(d.stats.map(s => [s.key, s.list.map(x => `${x.name} ${x.value}`)]));
  assert.equal(by.pts, undefined, '排名 has the points');
  assert.deepEqual(by.grid, ['K. Antonelli 1.0', 'G. Russell 2.5', 'M. Verstappen 5.5']);
  assert.deepEqual(by.pod, ['G. Russell 2', 'K. Antonelli 2', 'M. Verstappen 1']);
  assert.deepEqual(by.pole, ['K. Antonelli 2']);
  assert.deepEqual(by.avg, ['K. Antonelli 1.5', 'G. Russell 2.0', 'M. Verstappen 2.0']);
  assert.deepEqual(by.gain, ['M. Verstappen 7', 'G. Russell 1']);
  assert.deepEqual(by.dnf, ['M. Verstappen 1']);
  assert.equal(d.stats.find(s => s.key === 'pod').list.find(x => x.full === 'George Russell').id, '5503');
  assert.equal(d.season.name, '2026');
  assert.ok(F1_STATS.length >= 8 && hasLeaders('racing', 'racing/f1') && !hasLeaders('racing', 'racing/irl'));
});

test("FotMob's clubs matched to the table's rows, Brighton and Hove Albion is Brighton & Hove Albion", async () => {
  const { fotmobClubRows } = await import('../public/lib/leaders.mjs');
  const rows = [{ id: '331', name: '布萊頓', en: 'Brighton & Hove Albion', short: 'Brighton' }, { id: '382', name: '曼城', en: 'Manchester City', short: 'Man City' }, { id: '380', name: '狼隊', en: 'Wolverhampton Wanderers', short: 'Wolves' }];
  const teams = [{ id: 10204, name: 'Brighton and Hove Albion', shortName: 'Brighton' }, { id: 8456, name: 'Manchester City', shortName: 'Man City' }, { id: 8602, name: 'Wolverhampton Wanderers', shortName: 'Wolves' }];
  const m = fotmobClubRows(teams, rows);
  assert.deepEqual([m.get('10204')?.name, m.get('8456')?.name, m.get('8602')?.name], ['布萊頓', '曼城', '狼隊']);
});
