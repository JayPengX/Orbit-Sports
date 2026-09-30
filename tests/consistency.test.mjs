// What Fixtures and Play must agree on: a delay isn't a postponement, players
// show their nation's flag, bouts and draw matches link to Play's own games.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStatus, parseKambi, playPairId, playGameId } from '../public/lib/espn.mjs';
import { liveLabel } from '../public/lib/live.mjs';
import { LEAGUES } from '../public/lib/leagues.mjs';

test('a delayed or suspended game is still on (Play keeps it live); a postponed one is called off', () => {
  const delayed = parseStatus({ type: { name: 'STATUS_DELAYED', state: 'in', shortDetail: 'Delayed' } });
  assert.equal(delayed.void, false);
  assert.equal(delayed.delayed, true);
  assert.equal(parseStatus({ type: { name: 'STATUS_RAIN_DELAY', state: 'in', shortDetail: 'Rain Delay, Top 5th' } }).void, false);
  assert.equal(parseStatus({ type: { name: 'STATUS_POSTPONED', state: 'post' } }).void, true);
  assert.equal(parseStatus({ type: { name: 'STATUS_IN_PROGRESS', state: 'in', shortDetail: 'Top 5th' } }).delayed, false);
});

test("Kambi's players carry their nation's flag (the kit's table, else where the match is filed)", () => {
  const data = {
    events: [
      { event: { id: 1, name: 'Radek Bartunek - Marek Placek', homeName: 'Radek Bartunek', awayName: 'Marek Placek', start: '2026-09-30T06:00:00Z', state: 'NOT_STARTED', group: 'Czech Open', path: ['badminton', 'czech_republic', 'czech_open'] } },
      { event: { id: 2, name: 'Fan Zhendong - Lin Yun-Ju', homeName: 'Fan Zhendong', awayName: 'Lin Yun-Ju', start: '2026-09-30T08:00:00Z', state: 'NOT_STARTED', group: 'WTT Champions', path: [{ termKey: 'table_tennis' }, { termKey: 'wtt_champions' }] } },
      { event: { id: 3, name: 'Radek Bartunek - Marek Placek', homeName: 'Radek Bartunek', awayName: 'Marek Placek', start: '2026-09-30T06:30:00Z', state: 'NOT_STARTED', group: 'Czech Liga Pro', path: ['table_tennis', 'czech_republic', 'czech_liga_pro'] } }
    ]
  };
  const [czech] = parseKambi({ events: data.events.slice(0, 1) }, 'badminton');
  assert.match(czech.home.logo, /flags\/cz\.svg$/);
  // Table tennis: the pro tour only, not Kambi's betting leagues (Czech Liga Pro).
  const tt = parseKambi({ events: data.events.slice(1) }, 'tabletennis');
  assert.deepEqual(tt.map(e => e.id), ['k2']);
  const [wtt] = tt;
  assert.match(wtt.home.logo, /flags\/cn\.svg$/);
  assert.match(wtt.away.logo, /flags\/tw\.svg$/);
  // Clubs keep their badges.
  assert.ok(LEAGUES.euroleague && !LEAGUES.euroleague.players);
});

test("a UFC bout and a tennis match link to Play's game by the two names; UFC is a Play league now", () => {
  assert.equal(LEAGUES.ufc.play, 'ufc');
  assert.equal(LEAGUES.rugbyunion.play, 'rugbyunion');
  assert.equal(LEAGUES.acl.play, 'acl');
  for (const key of ['nrl', 'afl', 'nascar', 'indycar', 'nwsl']) assert.equal(LEAGUES[key], undefined, key);
  assert.equal(LEAGUES.facup.play, 'facup');
  assert.equal(playPairId('ufc', '2026-10-03T20:00:00Z', { name: 'Marvin Vettori' }, { name: 'Ismail Naurdiev' }), 'ufc_2026-10-03T20_marvinvettori_ismailnaurdiev');
  assert.equal(playPairId('pga', '2026-10-03T20:00:00Z', { name: 'A' }, { name: 'B' }), null);
  assert.equal(playGameId({ league: 'cpbl', kind: 'match', start: '2026-09-30T10:35:00Z', away: { en: 'Wei Chuan Dragons' }, home: { en: 'Rakuten Monkeys' } }), 'cpbl_2026-09-30T10_weichuandragons_rakutenmonkeys');
});

test('table tennis, badminton and volleyball play games (局), tennis sets (盤)', () => {
  const e = set => ({ status: { state: 'in', period: set }, live: { set } });
  assert.equal(liveLabel(e(3), 'tabletennis', 'zh'), '第3局');
  assert.equal(liveLabel(e(2), 'badminton', 'zh'), '第2局');
  assert.equal(liveLabel(e(2), 'tennis', 'zh'), '第2盤');
  assert.equal(liveLabel(e(2), 'volleyball', 'en'), 'Set 2');
  assert.equal(liveLabel(e(2), 'tabletennis', 'en'), 'Game 2');
});
