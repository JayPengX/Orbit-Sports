// MotoGP (its own results API) and Formula E (TheSportsDB's calendar): race
// weekends with their sessions, like F1's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMotoGpEvents, parseMotoGpSessions, parseMotoGpOrder, parseTsdbRaces, parseMotoGpStandings, parseMotoGpRider, parseTsdbResults } from '../public/lib/espn.mjs';
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

test('MotoGP standings: riders with wins, podiums and points', () => {
  const data = { classification: [
    { position: 1, rider: { full_name: 'Jorge Martin', country: { iso: 'ES' }, legacy_id: 8146, number: 89, riders_api_uuid: 'r1' }, team: { name: 'Aprilia Racing' }, points: 306, race_wins: 1, podiums: 7 },
    { position: 2, rider: { full_name: 'Marc Marquez', country: { iso: 'ES' }, legacy_id: 7409, number: 93, riders_api_uuid: 'r2' }, team: { name: 'Ducati Lenovo Team' }, points: 290, race_wins: 5, podiums: 9 }
  ] };
  const [g] = parseMotoGpStandings(data, 'zh');
  assert.equal(g.name, '車手積分');
  assert.deepEqual(g.rows.map(r => [r.id, r.name, r.stats.PTS, r.stats.W, r.stats.POD, r.athlete]), [['r1', 'Jorge Martin', '306', '1', '7', true], ['r2', 'Marc Marquez', '290', '5', '9', true]]);
  assert.equal(parseMotoGpStandings({}).length, 0);
});

test('a MotoGP rider: the profile, career totals in the class, season by season', () => {
  const rider = { id: 'r1', legacy_id: 8146, name: 'Jorge', surname: 'Martin', birth_date: '1998-01-29', birth_city: 'Madrid', country: { iso: 'ES', name: 'Spain' }, physical_attributes: { height: 168, weight: 63 },
    career: [{ season: 2026, number: 89, sponsored_team: 'Aprilia Racing', current: true, team: { color: '#5f259f', constructor: { name: 'Aprilia' } }, pictures: { profile: { main: 'https://x/p.png' } } }] };
  const cat = n => ({ category: { name: 'MotoGP™' }, count: n });
  const totals = { all_races: { categories: [cat(96)] }, grand_prix_victories: { categories: [cat(9), { category: { name: 'Moto2™' }, count: 2 }] }, podiums: { categories: [cat(39)] }, poles: { categories: [cat(23)] }, world_championship_wins: { categories: [cat(1)] }, sprint_victories: [cat(20)] };
  const seasons = [{ season: '2025', category: 'MotoGP™', constructor: 'Aprilia', starts: 10, first_position: 0, podiums: 1, poles: 0, points: 50, position: 15 }, { season: '2026', category: 'MotoGP™', constructor: 'Aprilia', starts: 15, first_position: 1, podiums: 7, poles: 3, points: 306, position: 1 }];
  const r = parseMotoGpRider(rider, seasons, totals);
  assert.equal(r.name, 'Jorge Martin');
  assert.equal(r.photo, 'https://x/p.png');
  assert.equal(r.teamColor, '#5f259f');
  assert.equal(r.birthplace, 'Madrid, Spain');
  assert.deepEqual(r.career, { starts: 96, wins: 9, podiums: 39, poles: 23, titles: 1, sprintWins: 20 });
  assert.deepEqual(r.seasons.map(x => [x.season, x.category, x.position, x.wins]), [[2026, 'MotoGP', 1, 1], [2025, 'MotoGP', 15, 0]]);
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
