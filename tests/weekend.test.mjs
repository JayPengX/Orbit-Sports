import test from 'node:test';
import assert from 'node:assert/strict';
import { splitWeekend, sessionName } from '../public/lib/espn.mjs';
import { watchable, leaguesOn, SERVICES, BROADCAST } from '../public/lib/broadcast.mjs';
import { teamBadge, leagueLogo } from '../public/lib/logos.mjs';

const st = state => ({ state, detail: '', short: '', completed: state === 'post', void: false });
const weekend = {
  id: '1',
  league: 'f1',
  kind: 'field',
  name: 'Singapore Grand Prix',
  start: '2026-10-09T08:30Z',
  end: '2026-10-11T14:00Z',
  status: st('pre'),
  sessions: [
    { id: 'a', abbr: 'FP1', name: 'Practice 1', start: '2026-10-09T08:30Z', status: st('post'), field: [] },
    { id: 'b', abbr: 'SS', name: 'Sprint Shootout', start: '2026-10-09T12:30Z', status: st('post'), field: [{ name: 'L. Norris' }] },
    { id: 'c', abbr: 'SR', name: 'Sprint', start: '2026-10-10T09:00Z', status: st('in'), field: [] },
    { id: 'd', abbr: 'Qual', name: 'Qualifying', start: '2026-10-10T13:00Z', status: st('pre'), field: [] },
    { id: 'e', abbr: 'Race', name: 'Race', start: '2026-10-11T12:00Z', status: st('pre'), field: [] }
  ]
};

test('a race weekend lists sprint qualifying, sprint, qualifying and race, not practice', () => {
  const now = Date.parse('2026-10-10T10:00Z');
  const list = splitWeekend(weekend, now);
  assert.deepEqual(list.map(e => e.sessionKey), ['SS', 'SR', 'Qual', 'Race']);
  assert.deepEqual(list.map(e => e.session), ['衝刺排位賽', '衝刺賽', '排位賽', '正賽']);
  assert.equal(list[1].status.state, 'in');
  assert.equal(list[3].start, '2026-10-11T12:00Z');
  assert.equal(new Set(list.map(e => e.id)).size, 4);
  // A session the feed leaves "on" for hours is over.
  assert.equal(splitWeekend(weekend, Date.parse('2026-10-10T20:00Z'))[1].status.state, 'post');
  assert.equal(sessionName({ abbr: 'SS' }, 'en'), 'Sprint qualifying');
  // Not a race: as it is.
  const game = { id: '9', league: 'nba', kind: 'match' };
  assert.deepEqual(splitWeekend(game), [game]);
});

test('broadcast services: what they carry', () => {
  assert.ok(Object.values(BROADCAST).flat().every(b => SERVICES.some(x => x.id === b.svc)));
  assert.ok(watchable('laliga', ['dazn']));
  assert.ok(!watchable('epl', ['dazn']));
  assert.ok(watchable('epl', []));
  // KBO: free on SOOP; Formula E on Disney+, its practice on YouTube.
  assert.ok(watchable('kbo', ['soop']));
  assert.ok(watchable('formulae', ['disney']) && watchable('formulae', ['youtube']));
  assert.ok(leaguesOn(['elta']).includes('nba'));
  assert.ok(!leaguesOn(['elta']).includes('laliga'));
});

test('logos for the leagues and teams the feeds leave bare', () => {
  assert.match(teamBadge('cpbl', 'Rakuten Monkeys'), /^https:/);
  assert.match(teamBadge('npb', 'Yomiuri Giants'), /^https:/);
  assert.notEqual(teamBadge('npb', 'Yomiuri Giants'), teamBadge('kbo', 'Lotte Giants'));
  assert.equal(teamBadge('cpbl', 'Nobody FC'), null);
  assert.match(leagueLogo('epl'), /^https:/);
  assert.match(leagueLogo('cpbl'), /^https:/);
});

test('search: leagues by name, ESPN teams in the leagues Fixtures has', async () => {
  const { findLeagues, parseSearch } = await import('../public/lib/search.mjs');
  const { readFileSync } = await import('node:fs');
  assert.ok(findLeagues('英超').includes('epl'));
  assert.ok(findLeagues('premier').includes('epl'));
  const found = parseSearch(JSON.parse(readFileSync(new URL('./fixtures/espn-search-yankees.json', import.meta.url))));
  assert.deepEqual(found.teams[0], { league: 'mlb', id: '10', name: 'New York Yankees', sub: 'MLB', logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png' });
});
