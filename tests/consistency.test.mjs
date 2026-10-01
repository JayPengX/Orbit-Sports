// What the data must get right: a delay isn't a postponement, badminton
// players show their nation's flag, and the purged sports are gone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStatus, parseKambi } from '../public/lib/espn.mjs';
import { liveLabel } from '../public/lib/live.mjs';
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

test("Kambi's badminton players carry their nation's flag (the kit's table, else where the match is filed)", () => {
  const events = [
    { event: { id: 1, name: 'Radek Bartunek - Marek Placek', homeName: 'Radek Bartunek', awayName: 'Marek Placek', start: '2026-09-30T06:00:00Z', state: 'NOT_STARTED', group: 'Czech Open', path: ['badminton', 'czech_republic', 'czech_open'] } },
    { event: { id: 2, name: 'Tai Tzu-Ying - Chen Yufei', homeName: 'Tai Tzu-Ying', awayName: 'Chen Yufei', start: '2026-09-30T08:00:00Z', state: 'NOT_STARTED', group: 'China Open', path: ['badminton', 'china_open'] } }
  ];
  const [czech, open] = parseKambi({ events }, 'badminton');
  assert.match(czech.home.logo, /flags\/cz\.svg$/);
  assert.match(open.home.logo, /flags\/tw\.svg$/);
  assert.match(open.away.logo, /flags\/cn\.svg$/);
  // Clubs keep their badges.
  assert.ok(LEAGUES.euroleague && !LEAGUES.euroleague.players);
});

test('the purged sports, leagues and services are gone, not hidden', () => {
  for (const key of ['atp', 'wta', 'pga', 'lpga', 'ufc', 'boxing', 'volleyball', 'tabletennis', 'motogp', 'f1academy', 'gtwc', 'wcqeurope', 'rugbyunion', 'acl', 'ncaaf', 'snooker', 'cricket']) {
    assert.equal(LEAGUES[key], undefined, key);
    assert.equal(BROADCAST[key], undefined, key);
  }
  for (const sport of ['tennis', 'golf', 'mma', 'boxing', 'volleyball', 'tabletennis', 'snooker', 'cricket', 'rugby']) assert.equal(SPORTS[sport], undefined, sport);
  for (const id of ['ufcpass', 'tennistv', 'vbtv', 'motogppass', 'f1tv', 'mlbtv', 'cpbltv', 'kleaguetv']) assert.ok(!SERVICES.some(x => x.id === id), id);
  // Kept: WNBA and EuroLeague, on their own passes.
  assert.equal(BROADCAST.wnba[0].kind, 'pass');
  assert.equal(BROADCAST.euroleague[0].kind, 'pass');
  // Every service listed carries a league.
  for (const x of SERVICES) assert.ok(Object.values(BROADCAST).some(list => list.some(b => b.svc === x.id)), x.id);
  for (const l of Object.values(LEAGUES)) assert.equal(l.off, undefined);
});

test('badminton plays games (局)', () => {
  const e = set => ({ status: { state: 'in', period: set }, live: { set } });
  assert.equal(liveLabel(e(2), 'badminton', 'zh'), '第2局');
  assert.equal(liveLabel(e(2), 'badminton', 'en'), 'Game 2');
});
