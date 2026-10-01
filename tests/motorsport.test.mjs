// Formula E (TheSportsDB's calendar): race weekends with their sessions, like F1's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTsdbRaces, parseTsdbResults } from '../public/lib/espn.mjs';
import { LEAGUES } from '../public/lib/leagues.mjs';
import { broadcastsOf, BROADCAST } from '../public/lib/broadcast.mjs';

const fe = JSON.parse(readFileSync(new URL('./fixtures/formulae-2026-27.json', import.meta.url), 'utf8'));

test('Formula E: a round per weekend, qualifying and the race, the time marked when not yet known', () => {
  const rounds = parseTsdbRaces(fe.events, 'formulae');
  assert.ok(rounds.length >= 2);
  const first = rounds[0];
  assert.match(first.name, /Jeddah/);
  assert.ok(first.sessions.every(x => ['Qual', 'Race'].includes(x.abbr)));
  assert.ok(first.sessions.some(x => x.tbc));
});

test('only ELTA.tv and Apple TV are offered as Taiwan broadcast services', () => {
  for (const [league, services] of Object.entries(BROADCAST)) {
    assert.ok(LEAGUES[league], league);
    assert.ok(services.every(b => ['elta', 'appletv'].includes(b.svc)), league);
  }
  assert.ok(broadcastsOf('formulae').length === 0);
  assert.ok(broadcastsOf('jleague').length === 0);
});

test('Formula E results: the order by position, the winner’s time and the gaps', () => {
  const field = parseTsdbResults({ results: [
    { idPlayer: '2', strPlayer: 'Oliver Rowland', intPosition: '2', strDetail: '+ 0:01:349\t' },
    { idPlayer: '1', strPlayer: 'Jake Dennis', intPosition: '1', strDetail: '59:23:013' },
    { idPlayer: '9', strPlayer: 'No Finish', intPosition: null }
  ] });
  assert.deepEqual(field.map(r => [r.id, r.name, r.score]), [['tsdb1', 'Jake Dennis', '59:23:013'], ['tsdb2', 'Oliver Rowland', '+ 0:01:349']]);
  assert.deepEqual(parseTsdbResults(null), []);
});
