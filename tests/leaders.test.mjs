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
