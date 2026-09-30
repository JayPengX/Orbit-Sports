import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseScoreboard, parseSummary, parseStandings, parseTeam, parseSchedule, parseRoster, parseAthlete, parseCalendar, playGameId, espnDatesFor, parseKambi } from '../public/lib/espn.mjs';
import { LEAGUES, SPORTS } from '../public/lib/leagues.mjs';

const fx = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)));

test('every league has a sport, a source and names', () => {
  for (const [key, l] of Object.entries(LEAGUES)) {
    assert.ok(SPORTS[l.sport], key);
    assert.ok(l.espn || l.kambi || l.asia, key);
    assert.ok(l.zh && l.en, key);
  }
  assert.ok(Object.keys(LEAGUES).length >= 60);
});

test('team scoreboards: both sides, scores, status', () => {
  const games = parseScoreboard(fx('mlb-scoreboard'), 'mlb');
  assert.equal(games.length, 3);
  for (const g of games) {
    assert.ok(g.home.name && g.away.name);
    assert.ok(['pre', 'in', 'post'].includes(g.status.state));
  }
  const epl = parseScoreboard(fx('epl-scoreboard'), 'epl');
  assert.ok(epl.length > 0);
  assert.ok(epl[0].home.logo?.startsWith('https://'));
});

test('tennis draws, race sessions and fight cards', () => {
  const [tour] = parseScoreboard(fx('atp-scoreboard'), 'atp');
  assert.ok(tour.draws.length > 0);
  const m = tour.draws[0].matches[0];
  assert.ok(m.a.name && m.b.name);
  const [race] = parseScoreboard(fx('f1-scoreboard'), 'f1');
  assert.ok(race.sessions.length >= 1);
  assert.ok(race.sessions.at(-1).field.length >= 10);
  const [card] = parseScoreboard(fx('ufc-scoreboard'), 'ufc');
  assert.ok(card.bouts.length > 0 && card.bouts[0].a.name);
});

test('a match summary: box score, players, plays, rosters', () => {
  const s = parseSummary(fx('mlb-summary'), 'mlb');
  assert.ok(s.home && s.away);
  assert.equal(s.status.state, 'post');
  assert.ok(s.teamStats.length > 10);
  assert.ok(s.players[0].tables[0].rows.length > 5);
  assert.ok(s.plays.length > 0);
  assert.ok(s.winProb.length > 10);
  const e = parseSummary(fx('epl-summary'), 'epl');
  assert.ok(e.teamStats.some(x => x.key === 'possessionPct'));
  assert.equal(e.rosters.length, 2);
  assert.ok(e.rosters[0].players.some(p => p.starter));
  assert.ok(e.keyEvents.length > 0);
});

test('standings: soccer table and baseball leagues', () => {
  const epl = parseStandings(fx('epl-standings'));
  assert.equal(epl.length, 1);
  assert.equal(epl[0].rows.length, 20);
  assert.ok(epl[0].rows[0].stats.P);
  const mlb = parseStandings(fx('mlb-standings'));
  assert.equal(mlb.length, 2);
  assert.ok(mlb[0].rows[0].stats.PCT);
});

test('team, schedule, roster and player', () => {
  const t = parseTeam(fx('mlb-team'));
  assert.ok(t.name && t.record && t.logo);
  const sched = parseSchedule(fx('mlb-team-schedule'), 'mlb');
  assert.ok(sched.length > 0 && sched[0].home);
  const r = parseRoster(fx('mlb-roster'));
  assert.ok(r.length >= 3 && r[0].players.length > 3);
  const a = parseAthlete(fx('mlb-athlete'));
  assert.equal(a.name, 'Aaron Judge');
  assert.ok(a.stats.list.length > 0);
});

test('a season calendar: game days, days off, or weeks', () => {
  const white = parseCalendar({ leagues: [{ calendarIsWhitelist: true, calendar: ['2026-10-03T07:00Z', '2026-10-04T07:00Z'] }] });
  assert.deepEqual(white.days, ['20261003', '20261004']);
  const black = parseCalendar({ leagues: [{ calendarIsWhitelist: false, calendarStartDate: '2026-09-28T07:00Z', calendarEndDate: '2026-10-02T06:59Z', calendar: ['2026-09-29T07:00Z'] }] });
  assert.deepEqual(black.days, ['20260928', '20260930', '20261001']);
  const weeks = parseCalendar({ leagues: [{ calendar: [{ value: '2', entries: [{ label: 'Week 4', value: '4', startDate: 'a', endDate: 'b' }] }] }] });
  assert.deepEqual(weeks.weeks[0], { label: 'Week 4', detail: '', seasontype: '2', week: '4', start: 'a', end: 'b' });
  assert.equal(parseCalendar({ leagues: [{}] }), null);
});

test('Quadra Play ids for the "bet on this" link, and Taiwan days', () => {
  const [g] = parseScoreboard(fx('epl-scoreboard'), 'epl');
  const id = playGameId(g);
  assert.match(id, /^epl_\d{4}-\d{2}-\d{2}T\d{2}_[a-z0-9]+_[a-z0-9]+$/);
  assert.equal(playGameId({ ...g, league: 'nope' }), null);
  assert.deepEqual(espnDatesFor('2026-09-28'), ['20260927', '20260928']);
});

test('Kambi leagues: schedule and live score', () => {
  const data = { events: [{ event: { id: 1, homeName: 'Rakuten', awayName: 'Seibu', start: '2026-09-28T09:00:00Z', state: 'STARTED', group: 'NPB' }, liveData: { score: { home: '3', away: '1' } } }] };
  const [e] = parseKambi(data, 'npb');
  assert.equal(e.status.state, 'in');
  assert.equal(e.home.score, '3');
});

test('a race weekend is over once its last session has had its time, and counts on its next session', async () => {
  const { settleField } = await import('../public/lib/espn.mjs');
  const h = 3_600_000;
  const now = Date.parse('2026-09-28T04:00:00Z');
  const s = (name, start, state) => ({ name, start, status: { state } });
  const old = { kind: 'field', start: '2026-09-25T08:00:00Z', end: '2026-09-26T13:00:00Z', status: { state: 'in' }, sessions: [s('FP1', '2026-09-25T08:00:00Z', 'post'), s('Race', '2026-09-26T11:00:00Z', 'in')] };
  assert.equal(settleField(old, now).status.state, 'post');
  const next = { kind: 'field', start: '2026-10-09T02:30:00Z', status: { state: 'pre' }, sessions: [s('FP1', '2026-10-09T02:30:00Z', 'pre'), s('Race', '2026-10-11T05:00:00Z', 'pre')] };
  const n = settleField(next, Date.parse('2026-10-10T00:00:00Z'));
  assert.equal(n.at, '2026-10-11T05:00:00Z');
  assert.equal(n.session, 'Race');
  assert.equal(n.status.state, 'pre');
  assert.equal(settleField(next, now - h).at, '2026-10-09T02:30:00Z');
});

test('a missing logo falls back to ESPN\'s CDN', async () => {
  const { fallbackLogo } = await import('../public/lib/espn.mjs');
  assert.match(fallbackLogo('f1', { id: '5503', athlete: true }), /headshots\/rpm\/players\/full\/5503\.png$/);
  assert.equal(fallbackLogo('f1', { id: '1', logo: 'x' }), 'x');
});

test('NPB, KBO and CPBL from the proxy\'s month lists', async () => {
  const { parseAsia } = await import('../public/lib/espn.mjs');
  const games = [
    { id: 'cpbl-2026-255', start: '2026-09-30T10:35:00.000Z', home: { en: 'Fubon Guardians', zh: '富邦悍將' }, away: { en: 'Uni-President Lions', zh: '統一7-ELEVEn獅' }, homeScore: 3, awayScore: 5, state: 'post', venue: '新莊' },
    { id: 'cpbl-2026-14', start: '2026-04-04T09:05:00.000Z', home: { en: 'CTBC Brothers', zh: '中信兄弟' }, away: { en: 'Rakuten Monkeys', zh: '樂天桃猿' }, homeScore: null, awayScore: null, state: 'void', venue: '' }
  ];
  const [done, off] = parseAsia(games, 'cpbl', 'zh');
  assert.equal(done.home.name, '富邦悍將');
  assert.equal(done.away.winner, true);
  assert.equal(done.status.state, 'post');
  assert.ok(done.home.logo);
  assert.equal(off.status.void, true);
  // Play's link uses the English names.
  assert.equal(playGameId({ ...done, status: { state: 'pre' } }), 'cpbl_2026-09-30T10_unipresidentlions_fubonguardians');
});

test('F1 headshots: the racing ones (this season), not the 2021 F1 set', async () => {
  const { freshHeadshot } = await import('../public/lib/espn.mjs');
  assert.equal(freshHeadshot('https://a.espncdn.com/i/headshots/f1/players/full/5579.png'), 'https://a.espncdn.com/i/headshots/rpm/players/full/5579.png');
  assert.equal(freshHeadshot('https://a.espncdn.com/i/headshots/mlb/players/full/33192.png'), 'https://a.espncdn.com/i/headshots/mlb/players/full/33192.png');
  assert.equal(freshHeadshot(null), null);
  assert.equal(parseAthlete({ athlete: { id: 5579, displayName: 'Lando Norris', headshot: { href: 'https://a.espncdn.com/i/headshots/f1/players/full/5579.png' } } }).headshot, 'https://a.espncdn.com/i/headshots/rpm/players/full/5579.png');
});

test('a player overview: the latest note, awards, the last games, news', async () => {
  const { parseOverview, usDate } = await import('../public/lib/espn.mjs');
  assert.equal(usDate('Tue Sep 29 07:02:00 PDT 2026'), '2026-09-29T14:02:00.000Z');
  assert.equal(usDate('soon'), '');
  const ov = parseOverview({
    rotowire: { headline: 'Judge (calf) out', story: 'Moderate strain.', published: 'Tue Sep 29 07:02:00 PDT 2026' },
    awards: [{ name: 'MVP', displayCount: '3x', seasons: ['2025', '2024', '2022'] }],
    gameLog: {
      statistics: [{ displayName: 'Batting', labels: ['AB', 'H', 'HR', 'AB', 'H', 'HR'], events: [{ eventId: '1', stats: ['4', '1', '1', '0', '0', '0'] }, { eventId: 'gone', stats: [] }] }],
      events: { 1: { gameDate: '2026-09-11T23:05:00Z', atVs: '@', score: '6-4', gameResult: 'W', opponent: { id: 21, displayName: 'New York Mets', abbreviation: 'NYM', logo: 'x.png' } } }
    },
    news: [{ headline: 'A story', links: { web: { href: 'https://espn.com/s' } }, images: [{ url: 'p.jpg' }], published: '2026-09-29T00:00:00Z' }, { headline: 'No page' }]
  });
  assert.deepEqual(ov.note, { headline: 'Judge (calf) out', story: 'Moderate strain.', date: '2026-09-29T14:02:00.000Z' });
  assert.deepEqual(ov.awards, [{ name: 'MVP', count: '3x', seasons: ['2025', '2024', '2022'] }]);
  assert.deepEqual(ov.log.labels, ['AB', 'H', 'HR']);
  assert.equal(ov.log.games.length, 1);
  assert.deepEqual(ov.log.games[0], { id: '1', date: '2026-09-11T23:05:00Z', at: '@', opp: { id: '21', name: 'New York Mets', abbr: 'NYM', logo: 'x.png' }, result: 'W', score: '6-4', stats: ['4', '1', '1'] });
  assert.deepEqual(ov.news, [{ headline: 'A story', description: '', image: 'p.jpg', url: 'https://espn.com/s', date: '2026-09-29T00:00:00Z' }]);
  assert.equal(parseOverview({}).log, null);
});
