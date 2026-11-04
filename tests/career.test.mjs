import test from 'node:test';
import assert from 'node:assert/strict';

test("a player's draft and years in the league, as ESPN says them", async () => {
  const { draftOf, seasonsIn } = await import('../public/lib/career.mjs');
  assert.deepEqual(draftOf('2017: Rd 1, Pk 13 (DEN)'), { year: 2017, round: 1, pick: 13, abbr: 'DEN' });
  assert.equal(draftOf(''), null);
  assert.equal(draftOf('Undrafted'), null);
  assert.equal(seasonsIn('10th Season'), 10);
  assert.equal(seasonsIn('Rookie'), null);
});

test("ESPN's seasons: a row a team (a traded season's total left out), the teams as runs, the NBA's years as its seasons began and ended", async () => {
  const { parseEspnCareer } = await import('../public/lib/career.mjs');
  const row = (year, name, teamId, teamSlug, gp) => ({ season: { year, displayName: `${year - 1}-${String(year).slice(2)}` }, teamId, teamSlug, stats: [String(gp), '25.0'] });
  const c = parseEspnCareer(
    {
      teams: { 'dallas-mavericks': { id: '6', abbreviation: 'DAL', displayName: 'Dallas Mavericks', logo: 'dal.png' }, 'los-angeles-lakers': { id: '13', abbreviation: 'LAL', displayName: 'Los Angeles Lakers', logo: 'lal.png' } },
      categories: [{ labels: ['GP', 'PTS'], displayNames: ['Games Played', 'Points'], statistics: [row(2019, '', '6', 'dallas-mavericks', 72), row(2020, '', '6', 'dallas-mavericks', 61), row(2025, '', '6', 'dallas-mavericks', 22), row(2025, '', '13', 'los-angeles-lakers', 28), row(2025, '', undefined, '2024-25 Totals', 50), row(2026, '', '13', 'los-angeles-lakers', 64)] }]
    },
    'basketball'
  );
  assert.deepEqual(c.seasons.map(r => [r.season, r.team.abbr, r.games]), [['2025-26', 'LAL', 64], ['2024-25', 'LAL', 28], ['2024-25', 'DAL', 22], ['2019-20', 'DAL', 61], ['2018-19', 'DAL', 72]]);
  // Dallas's two runs (2018–2020, then 2024–25 after a gap), then the Lakers.
  assert.deepEqual(c.teams.map(t => [t.team.abbr, t.from, t.to, t.seasons, t.games]), [['LAL', 2024, 2026, 2, 92], ['DAL', 2024, 2025, 1, 22], ['DAL', 2018, 2020, 2, 133]]);
});

test("MLB's seasons are their own years; a pitcher's are said to be", async () => {
  const { parseEspnCareer } = await import('../public/lib/career.mjs');
  const c = parseEspnCareer({ teams: { 'new-york-yankees': { id: '10', abbreviation: 'NYY', displayName: 'New York Yankees' } }, categories: [{ labels: ['GP', 'W', 'ERA'], statistics: [2016, 2017].map(year => ({ season: { year, displayName: String(year) }, teamId: '10', teamSlug: 'new-york-yankees', stats: ['30', '10', '3.10'] })) }] }, 'baseball');
  assert.deepEqual(c.teams.map(t => [t.from, t.to, t.seasons]), [[2016, 2017, 2]]);
  assert.equal(c.pitching, true);
  assert.equal(parseEspnCareer({ categories: [] }, 'baseball'), null);
});

test('FotMob: the one player by that name, else the one at his club; a cut given name still him', async () => {
  const { pickFotmob, samePerson, sameDay } = await import('../public/lib/career.mjs');
  const saka = { id: '961995', name: 'Bukayo Saka', teamId: 9825, teamName: 'Arsenal' };
  assert.equal(pickFotmob([saka, saka, { id: '1', name: 'Tatsuhiro Sakamoto', teamName: 'Coventry City' }], { name: 'Bukayo Saka', team: 'Arsenal' }), '961995');
  const two = [{ id: '1', name: 'Danilo', teamName: 'Flamengo' }, { id: '2', name: 'Danilo', teamName: 'Nottingham Forest' }];
  assert.equal(pickFotmob(two, { name: 'Danilo', team: 'Nottingham Forest FC' }), '2');
  assert.equal(pickFotmob(two, { name: 'Danilo', team: 'Juventus' }), null);
  assert.equal(samePerson('Vinícius Júnior', 'Vinicius Junior'), true);
  assert.equal(samePerson('M. Ødegaard', 'Martin Ødegaard'), true);
  assert.equal(samePerson('Martin Odegaard', 'Martin Braithwaite'), false);
  assert.equal(sameDay('2001-09-05T00:00:00.000Z', '2001-09-05T07:00Z'), true);
  assert.equal(sameDay('2001-09-05T00:00:00.000Z', '2001-09-08T07:00Z'), false);
});

test("FotMob's career: clubs he played for (a weeks-long return between loans left out), his country's senior side, seasons, trophies won in real competitions", async () => {
  const { parseFotmobCareer } = await import('../public/lib/career.mjs');
  const stint = (teamId, team, from, to, apps, loan = false) => ({ teamId, team, from, to, active: !to, loan, apps, goals: 1, assists: 0 });
  const c = parseFotmobCareer({
    clubs: [stint(8586, 'Tottenham Hotspur', '2026-01-14T00:00:00', '', 25), stint(9826, 'Crystal Palace', '2021-07-30T00:00:00', '2022-06-30T00:00:00', 39, true), stint(8455, 'Chelsea', '2021-07-01T00:00:00', '2021-07-30T00:00:00', null)],
    national: [stint(8491, 'England', '2021-11-14T00:00:00', '', 22), stint(5846, 'England U21', '2019-10-07T00:00:00', '2023-03-17T00:00:00', 15)],
    seasons: [{ season: '2021/2022', teamId: 9826, team: 'Crystal Palace', loan: true, apps: 39, goals: 8, assists: 5, rating: 7.25 }, { season: '2019/2020', teamId: 8455, team: 'Chelsea', apps: null }],
    trophies: [{ leagueId: 73, league: 'Europa League', won: ['2018/2019'] }, { leagueId: -1, league: 'Florida Cup', won: ['2023'] }, { leagueId: 47, league: 'Premier League', won: [] }]
  });
  assert.deepEqual(c.teams.map(t => [t.team.name, t.from, t.to, t.loan]), [['Tottenham Hotspur', 2026, null, false], ['Crystal Palace', 2021, 2022, true]]);
  assert.deepEqual(c.national.map(t => t.team.name), ['England']);
  assert.deepEqual(c.seasons.map(r => [r.season, r.cells.map(x => x.value)]), [['2021-22', ['39', '8', '5', '7.25']]]);
  assert.deepEqual(c.awards, [{ name: 'Europa League', seasons: ['2018/2019'], teams: [], count: '' }]);
});

test('a team run: the same team in seasons next to each other, the newest first', async () => {
  const { stintsOf } = await import('../public/lib/career.mjs');
  const r = (year, id) => ({ year, team: { id } });
  assert.deepEqual(stintsOf([r(2007, 'mclaren'), r(2008, 'mclaren'), r(2013, 'mercedes'), r(2014, 'mercedes'), r(2025, 'ferrari')]).map(s => [s.team.id, s.from, s.to, s.seasons]), [['ferrari', 2025, 2025, 1], ['mercedes', 2013, 2014, 2], ['mclaren', 2007, 2008, 2]]);
});

test('a loan the club then bought him from is one spell (Cunha at Wolves)', async () => {
  const { parseFotmobCareer } = await import('../public/lib/career.mjs');
  const s = (team, from, to, apps, loan) => ({ teamId: 8602, team, from, to, active: false, loan, apps, goals: 1, assists: 0 });
  const c = parseFotmobCareer({ clubs: [s('Wolverhampton Wanderers', '2023-07-01T00:00:00', '2025-06-30T00:00:00', 72, false), s('Wolverhampton Wanderers', '2023-01-01T00:00:00', '2023-06-30T00:00:00', 20, true)], national: [], seasons: [], trophies: [] });
  assert.deepEqual(c.teams.map(t => [t.from, t.to, t.games, t.goals, Boolean(t.bought), t.loan]), [[2023, 2025, 92, 2, true, false]]);
});

// Jay 2026-11-04 (Durant's 生涯球隊: "SuperSonics", a tiny OKC mark, 2007–2016 as one).
test('a franchise that moved is two teams, each by its own name, its own badge or a trimmed logo; one renamed but the same in Chinese stays one', async () => {
  const { parseEspnCareer } = await import('../public/lib/career.mjs');
  const pad = g => `https://a.espncdn.com/guid/${g}/logos/default.png`;
  const row = (year, teamId, teamSlug) => ({ season: { year, displayName: `${year - 1}-${String(year).slice(2)}` }, teamId, teamSlug, stats: ['80', '25.0'] });
  const kd = parseEspnCareer(
    {
      teams: {
        'oklahoma-city-thunder': { id: '25', abbreviation: 'OKC', displayName: 'Oklahoma City Thunder', shortDisplayName: 'Thunder', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png' },
        'seattle-supersonics': { id: '25', abbreviation: 'SEA', displayName: 'Seattle SuperSonics', shortDisplayName: 'SuperSonics', logo: pad('bd458c44') },
        'golden-state-warriors': { id: '9', abbreviation: 'GS', displayName: 'Golden State Warriors', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png' }
      },
      categories: [{ labels: ['GP', 'PTS'], statistics: [row(2008, '25', 'seattle-supersonics'), ...[2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016].map(y => row(y, '25', 'oklahoma-city-thunder')), row(2017, '9', 'golden-state-warriors')] }]
    },
    'basketball',
    'nba'
  );
  assert.deepEqual(kd.teams.map(t => [t.team.name, t.from, t.to]), [['Golden State Warriors', 2016, 2017], ['Oklahoma City Thunder', 2008, 2016], ['Seattle SuperSonics', 2007, 2008]]);
  const sonics = kd.teams.at(-1).team.logo;
  assert.ok(!/guid/.test(sonics) && /thesportsdb/.test(sonics), sonics);
  const { teamNameZh } = await import('#kit/names.mjs');
  assert.equal(teamNameZh('nba', 'Seattle SuperSonics', 'basketball')?.short, '超音速');
  assert.equal(teamNameZh('mlb', 'Cleveland Indians', 'baseball')?.short, '印地安人');
  // New Jersey, then Brooklyn: 籃網 once, by its newest name and logo; ESPN's line breaks in a name gone.
  const lopez = parseEspnCareer(
    {
      teams: { 'new-jersey-nets': { id: '17', displayName: 'New Jersey\r\n Nets', logo: pad('x1') }, 'brooklyn-nets': { id: '17', displayName: 'Brooklyn Nets', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png' } },
      categories: [{ labels: ['GP'], statistics: [row(2011, '17', 'new-jersey-nets'), row(2012, '17', 'new-jersey-nets'), row(2013, '17', 'brooklyn-nets')] }]
    },
    'basketball',
    'nba'
  );
  assert.deepEqual(lopez.teams.map(t => [t.team.name, t.from, t.to, t.seasons]), [['Brooklyn Nets', 2010, 2013, 3]]);
  assert.equal(lopez.seasons.at(-1).team.name, 'New Jersey Nets');
  assert.equal(lopez.seasons.at(-1).team.logo, 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png');
});

test("the WNBA's seasons are their own years (no NBA-style 2016–17)", async () => {
  const { parseEspnCareer } = await import('../public/lib/career.mjs');
  const c = parseEspnCareer({ teams: { 'las-vegas-aces': { id: '17', displayName: 'Las Vegas Aces' } }, categories: [{ labels: ['GP'], statistics: [2018, 2019].map(year => ({ season: { year, displayName: String(year) }, teamId: '17', teamSlug: 'las-vegas-aces', stats: ['30'] })) }] }, 'basketball', 'wnba');
  assert.deepEqual(c.teams.map(t => [t.from, t.to]), [[2018, 2019]]);
});
