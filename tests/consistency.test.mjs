// What the data must get right: a delay isn't a postponement, clubs and
// national sides get their pictures, and the purged sports are gone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStatus, parseKambi } from '../public/lib/espn.mjs';
import { LEAGUES, SPORTS } from '../public/lib/leagues.mjs';
import { BROADCAST, SERVICES } from '../public/lib/broadcast.mjs';

test('a delayed or suspended game is still on; a postponed one is called off', () => {
  const delayed = parseStatus({ type: { name: 'STATUS_DELAYED', state: 'in', shortDetail: 'Delayed' } });
  assert.equal(delayed.void, false);
  assert.equal(delayed.delayed, true);
  assert.equal(parseStatus({ type: { name: 'STATUS_RAIN_DELAY', state: 'in', shortDetail: 'Rain Delay, Top 5th' } }).void, false);
  assert.equal(parseStatus({ type: { name: 'STATUS_POSTPONED', state: 'post' } }).void, true);
  assert.equal(parseStatus({ type: { name: 'STATUS_IN_PROGRESS', state: 'in', shortDetail: 'Top 5th' } }).delayed, false);
});

test("Kambi's clubs carry their badges; a national side its flag", () => {
  const [g] = parseKambi({ events: [{ event: { id: 1, name: 'Ulsan HD - Japan', homeName: 'Ulsan HD', awayName: 'Japan', start: '2026-09-30T06:00:00Z', state: 'NOT_STARTED' } }] }, 'kleague');
  assert.match(g.home.logo, /thesportsdb/);
  assert.match(g.away.logo, /flags\/jp\.svg$/);
});

test('the purged sports, leagues and services are gone, not hidden', () => {
  for (const key of ['atp', 'wta', 'pga', 'lpga', 'ufc', 'boxing', 'volleyball', 'tabletennis', 'motogp', 'f1academy', 'gtwc', 'wcqeurope', 'rugbyunion', 'acl', 'ncaaf', 'snooker', 'cricket', 'badminton']) {
    assert.equal(LEAGUES[key], undefined, key);
    assert.equal(BROADCAST[key], undefined, key);
  }
  for (const sport of ['tennis', 'golf', 'mma', 'boxing', 'volleyball', 'tabletennis', 'snooker', 'cricket', 'rugby', 'badminton']) assert.equal(SPORTS[sport], undefined, sport);
  for (const id of ['ufcpass', 'tennistv', 'vbtv', 'motogppass', 'f1tv', 'mlbtv', 'cpbltv', 'kleaguetv', 'sportcast']) assert.ok(!SERVICES.some(x => x.id === id), id);
  assert.deepEqual(SERVICES.map(x => x.id), ['elta', 'appletv']);
  assert.equal(BROADCAST.wnba, undefined);
  assert.equal(BROADCAST.euroleague, undefined);
  // Every broadcast entry is one of the two services that are supported here.
  for (const list of Object.values(BROADCAST)) for (const b of list) assert.ok(SERVICES.some(x => x.id === b.svc), b.svc);
  // Both selectable services carry at least one league.
  for (const x of SERVICES) assert.ok(Object.values(BROADCAST).some(list => list.some(b => b.svc === x.id)), x.id);
  for (const l of Object.values(LEAGUES)) assert.equal(l.off, undefined);
});
