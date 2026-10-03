import test from 'node:test';
import assert from 'node:assert/strict';
import { splitWeekend, sessionName } from '../public/lib/espn.mjs';
import { teamBadge, leagueLogo } from '#kit/logos.mjs';

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

test('a race weekend lists every session, practice too', () => {
  const now = Date.parse('2026-10-10T10:00Z');
  const list = splitWeekend(weekend, now);
  assert.deepEqual(list.map(e => e.sessionKey), ['FP1', 'SS', 'SR', 'Qual', 'Race']);
  assert.deepEqual(list.map(e => e.session), ['第一次練習', '衝刺排位賽', '衝刺賽', '排位賽', '正賽']);
  // Shown at the title sequence's time (4 minutes before practice, 10 before the race), the official one kept.
  assert.equal(list[0].start, '2026-10-09T08:26Z');
  assert.equal(list[0].official, '2026-10-09T08:30Z');
  assert.equal(list[2].status.state, 'in');
  assert.equal(list[4].start, '2026-10-11T11:50Z');
  assert.equal(new Set(list.map(e => e.id)).size, 5);
  // A session the feed leaves "on" for hours is over.
  assert.equal(splitWeekend(weekend, Date.parse('2026-10-10T20:00Z'))[2].status.state, 'post');
  assert.equal(sessionName({ abbr: 'SS' }, 'en'), 'Sprint qualifying');
  // Not a race: as it is.
  const game = { id: '9', league: 'nba', kind: 'match' };
  assert.deepEqual(splitWeekend(game), [game]);
});

test('logos for the leagues and teams the feeds leave bare', () => {
  assert.match(teamBadge('cpbl', 'Rakuten Monkeys'), /^https:/);
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
