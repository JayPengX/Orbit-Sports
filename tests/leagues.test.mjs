import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEAGUES, SPORTS, hasStandings, TOP_LEAGUES } from '../public/lib/leagues.mjs';
import { eventKeys, rankEvents, teamKey } from '../public/lib/foryou.mjs';
import { STRINGS } from '../public/lib/i18n.mjs';

test('every league has a sport, a source and a kind', () => {
  for (const [key, l] of Object.entries(LEAGUES)) {
    assert.ok(SPORTS[l.sport], key);
    assert.ok(l.espn || l.kambi, key);
    assert.ok(['match', 'field', 'card', 'draw'].includes(l.kind), key);
    assert.ok(l.zh && l.en, key);
  }
  assert.ok(TOP_LEAGUES.length >= 5);
  assert.equal(hasStandings('epl'), true);
  assert.equal(hasStandings('ucl'), false);
  assert.equal(hasStandings('cpbl'), false);
});

test('both languages have the same strings', () => {
  assert.deepEqual(Object.keys(STRINGS.en).sort(), Object.keys(STRINGS.zh).sort());
});

const ev = (id, league, state, start, home, away) => ({ id, league, kind: 'match', start, status: { state }, home: { name: home }, away: { name: away } });

test('match keys match Quadra Play keys', () => {
  const keys = eventKeys(ev('1', 'epl', 'pre', '2026-09-28T12:00:00Z', 'Arsenal', 'Chelsea'));
  assert.ok(keys.includes('league:epl'));
  assert.ok(keys.includes('sport:soccer'));
  assert.ok(keys.includes(teamKey('epl', 'Arsenal')));
});

test('for you puts live and followed games first, skips postponed ones', () => {
  const now = Date.parse('2026-09-28T12:00:00Z');
  const list = [
    ev('a', 'seriea', 'pre', '2026-09-29T20:00:00Z', 'Lazio', 'Roma'),
    ev('b', 'nba', 'in', '2026-09-28T11:00:00Z', 'Lakers', 'Celtics'),
    ev('c', 'bundesliga', 'pre', '2026-09-29T18:00:00Z', 'Mainz', 'Freiburg'),
    { ...ev('d', 'epl', 'pre', '2026-09-28T13:00:00Z', 'Leeds', 'Spurs'), status: { state: 'pre', void: true } }
  ];
  const out = rankEvents(list, { now, follows: [{ league: 'bundesliga', name: 'Mainz' }], aff: {} });
  const ids = out.map(x => x.event.id);
  assert.ok(!ids.includes('d'));
  assert.ok(ids.indexOf('b') < ids.indexOf('a'));
  assert.ok(ids.indexOf('c') < ids.indexOf('a'));
});
