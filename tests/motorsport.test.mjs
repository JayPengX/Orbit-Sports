// MotoGP (its own results API) and Formula E (TheSportsDB's calendar): race
// weekends with their sessions, like F1's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMotoGpEvents, parseMotoGpSessions, parseMotoGpOrder, parseTsdbRaces } from '../public/lib/espn.mjs';
import { LEAGUES } from '../public/lib/leagues.mjs';
import { broadcastsOf } from '../public/lib/broadcast.mjs';

const mgp = JSON.parse(readFileSync(new URL('./fixtures/motogp-2026.json', import.meta.url), 'utf8'));
const fe = JSON.parse(readFileSync(new URL('./fixtures/formulae-2026-27.json', import.meta.url), 'utf8'));

test('MotoGP: the Grands Prix (tests left out), the sessions that count, the order', () => {
  const events = parseMotoGpEvents(mgp.events);
  assert.ok(events.length >= 20);
  const jpn = events.find(e => e.short === 'JPN');
  assert.equal(jpn.kind, 'field');
  assert.equal(jpn.league, 'motogp');
  assert.ok(events.find(e => e.short === 'AUT').status.state === 'post');
  const sessions = parseMotoGpSessions(mgp.sessions);
  assert.deepEqual(sessions.map(x => x.abbr), ['Qual', 'SR', 'Race']);
  const order = parseMotoGpOrder(mgp.order);
  assert.equal(order[0].name, 'Pedro Acosta');
  assert.match(order[0].flag, /flags\/es\.svg$/);
  assert.equal(order[0].athlete, true);
});

test('Formula E: a round per weekend, qualifying and the race, the time marked when not yet known', () => {
  const rounds = parseTsdbRaces(fe.events, 'formulae');
  assert.ok(rounds.length >= 2);
  const first = rounds[0];
  assert.match(first.name, /Jeddah/);
  assert.ok(first.sessions.every(x => ['Qual', 'Race'].includes(x.abbr)));
  assert.ok(first.sessions.some(x => x.tbc));
});

test('every league in Fixtures can be watched in Taiwan', () => {
  for (const k of Object.keys(LEAGUES)) assert.ok(broadcastsOf(k).length, k);
  assert.ok(broadcastsOf('formulae').some(b => b.svc === 'disney'));
  assert.ok(broadcastsOf('motogp').some(b => b.svc === 'videoland'));
  assert.ok(broadcastsOf('tabletennis').some(b => b.svc === 'youtube' && b.url));
});
