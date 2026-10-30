// 數據 球隊: every team's own numbers ranked in its league, one shape for
// ESPN's (basketball, baseball) and FotMob's (football).
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTeamStats, parseFotmobTeamStats, parseFotmobTeamList, teamRanks, ranked } from '../public/lib/teamstats.mjs';

const nbaTeam = (id, name, pts, opp) => ({
  team: { id, abbreviation: name.slice(0, 3).toUpperCase(), displayName: name, shortDisplayName: name, logo: `${id}.png` },
  categories: [
    { name: 'offensive', splitId: '0', values: [pts, 45], totals: [pts.toFixed(1), '45.0'] },
    { name: 'offensive', splitId: '900', values: [opp, 44], totals: [opp.toFixed(1), '44.0'] }
  ]
});

test("ESPN's teams: each stat ranked here, lower-is-better ones the right way, ties level", () => {
  const raw = {
    requestedSeason: { year: 2027, displayName: '2026-27' },
    categories: [{ name: 'offensive', names: ['avgPoints', 'fieldGoalPct'] }],
    teams: [nbaTeam('9', 'Warriors', 117.6, 119.4), nbaTeam('13', 'Lakers', 121.2, 110.1), nbaTeam('2', 'Celtics', 117.6, 111.75)]
  };
  const d = parseTeamStats(raw, 'basketball');
  assert.equal(d.season.name, '2026-27');
  const pts = d.stats.find(s => s.zh === '得分');
  assert.deepEqual(pts.list.map(x => [x.id, x.value, x.rank]), [['13', '121.2', 1], ['9', '117.6', 2], ['2', '117.6', 2]]);
  const against = d.stats.find(s => s.zh === '失分');
  assert.equal(against.low, true);
  assert.deepEqual(against.list.map(x => x.id), ['13', '2', '9']);
  const mine = teamRanks(d, x => x.id === '9');
  assert.deepEqual(mine.map(r => [r.stat.zh, r.rank, r.of]), [['得分', 2, 3], ['失分', 3, 3], ['投籃命中率', 1, 3], ['對手命中率', 1, 3]]);
  assert.equal(parseTeamStats({ teams: [] }, 'basketball'), null);
  assert.equal(parseTeamStats(raw, 'racing'), null);
});

test("FotMob's clubs: the page's top three, then a stat's whole list ranking every club", () => {
  const page = { season: '2026/2027', teamStats: [{ name: 'goals_conceded_team_match', fractions: 1, url: 'u', top: [{ id: 9825, name: 'Arsenal', value: 0.6 }, { id: 8463, name: 'Leeds United', value: 0.8 }] }, { name: 'possession_percentage_team', fractions: 1, url: 'p', top: [{ id: 8456, name: 'Manchester City', value: 64.2 }] }, { name: 'not_ours', top: [{ id: 1, name: 'X', value: 1 }] }] };
  const d = parseFotmobTeamStats(page);
  assert.equal(d.season.name, '2026-27');
  assert.deepEqual(d.stats.map(s => s.zh), ['場均失球', '控球率']);
  assert.equal(d.stats[1].list[0].value, '64.2%');
  assert.equal(d.stats[0].list[0].logo, 'https://images.fotmob.com/image_resources/logo/teamlogo/9825.png');
  const list = parseFotmobTeamList({ decimals: 1, list: [{ id: 0, teamId: 1, name: 'A', value: 1.2 }, { id: 2, name: 'B', value: 0.9 }, { id: 3, name: 'C', value: 0.9 }] }, 'goals_conceded_team_match');
  assert.deepEqual(list.map(x => [x.fotmob, x.rank]), [['2', 1], ['3', 1], ['1', 3]]);
  assert.equal(parseFotmobTeamStats({ teamStats: [] }), null);
});

test('ranked: level on the number, level in the list', () => {
  assert.deepEqual(ranked([{ n: 5 }, { n: 5 }, { n: 3 }]).map(x => x.rank), [1, 1, 3]);
});
