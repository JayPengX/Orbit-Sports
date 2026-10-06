import test from 'node:test';
import assert from 'node:assert/strict';
import { nameScore, findMarket, mergeHistories, polymarketLine, gameKey, packPath, historyUrl } from '../public/lib/winprob.mjs';

const events = [
  { slug: 'mlb-nyy-tb-2026-10-05', startTime: '2026-10-06T00:00:00Z', series: '3', markets: [{ outcomes: '["New York Yankees", "Tampa Bay Rays"]', clobTokenIds: '["Y", "R"]' }] },
  { slug: 'mlb-bos-tor-2026-10-05', startTime: '2026-10-06T00:00:00Z', series: '3', markets: [{ outcomes: '["Boston Red Sox", "Toronto Blue Jays"]', clobTokenIds: '["B", "T"]' }] },
  {
    slug: 'bun-hsv-koe-2026-09-19',
    startTime: '2026-09-19T13:30:00Z',
    series: '10194',
    markets: [
      { groupItemTitle: 'Hamburger SV', clobTokenIds: '["F", "f"]' },
      { groupItemTitle: 'Draw (Hamburger SV vs. 1. FC Köln)', clobTokenIds: '["D", "d"]' },
      { groupItemTitle: '1. FC Köln', clobTokenIds: '["M", "m"]' }
    ]
  }
];
const asked = [];
const getJson = async url => {
  asked.push(url);
  const u = new URL(url);
  if (u.pathname === '/events') {
    const [from, to] = ['start_time_min', 'start_time_max'].map(k => Date.parse(u.searchParams.get(k)));
    return events.filter(ev => ev.series === u.searchParams.get('series_id') && Date.parse(ev.startTime) >= from && Date.parse(ev.startTime) <= to);
  }
  const token = u.searchParams.get('market');
  const t0 = Number(u.searchParams.get('startTs'));
  const p = { R: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1, 1], F: [0.3, 0.2, 0.1, 0, 0], D: [0.3, 0.5, 0.8, 1, 1], M: [0.4, 0.3, 0.1, 0, 0] }[token];
  return { history: p.map((v, i) => ({ t: t0 + i * 120, p: v })) };
};

test('teams by name: "AFC Bournemouth" is "Bournemouth", "Hamburg SV" "Hamburger SV", United more like United than City', () => {
  assert.ok(nameScore('AFC Bournemouth', 'Bournemouth') > 0);
  assert.ok(nameScore('CTBC Brothers', 'Chinatrust Brothers') > 0);
  assert.ok(nameScore('Red Bull New York', 'New York Red Bulls') > 0);
  assert.ok(nameScore('Hamburg SV', 'Hamburger SV') > 0);
  assert.equal(nameScore('FC Cologne', '1. FC Köln'), 0);
  assert.ok(nameScore('Manchester United', 'Manchester United FC') > nameScore('Manchester United', 'Manchester City FC'));
});

test("an MLB game's market: the game at its start most like it, the home side's token", async () => {
  assert.deepEqual(await findMarket('mlb', { start: '2026-10-06T00:00Z', home: 'Tampa Bay Rays', away: 'New York Yankees' }, getJson), { slug: 'mlb-nyy-tb-2026-10-05', home: 'R', away: 'Y' });
  const line = await polymarketLine('mlb', { start: '2026-10-06T00:00Z', home: 'Tampa Bay Rays', away: 'New York Yankees' }, getJson);
  assert.equal(line.source, 'polymarket');
  // Settled at 100%: the first such point kept, the rest left out.
  assert.deepEqual(line.points.map(p => p.home), [0.5, 0.6, 0.7, 0.8, 0.9, 1]);
  assert.ok(asked.includes(historyUrl('R', '2026-10-06T00:00Z')));
});

test("soccer's three ways: home, draw and away as shares of one; one side's name enough (Köln is not Cologne)", async () => {
  const line = await polymarketLine('bundesliga', { start: '2026-09-19T13:30Z', home: 'Hamburg SV', away: 'FC Cologne' }, getJson);
  assert.equal(line.points[0].home, 0.3);
  assert.equal(line.points[0].draw, 0.3);
  assert.equal(line.points.at(-1).draw, 1);
});

test('no market, no line; a league Polymarket lacks, nothing asked', async () => {
  assert.equal(await polymarketLine('epl', { start: '2026-09-21T15:30Z', home: 'Fulham', away: 'Manchester United' }, getJson), null);
  assert.equal(await polymarketLine('mlb', { start: '2026-10-06T00:00Z', home: 'Chicago Cubs', away: 'St. Louis Cardinals' }, getJson), null);
  const before = asked.length;
  assert.equal(await polymarketLine('f1', { start: '2026-09-21T15:30Z', home: 'A', away: 'B' }, getJson), null);
  assert.equal(asked.length, before);
});

test("a finished game's kept line: ESPN's games by id, CPBL's by the day and the home side", () => {
  assert.equal(packPath('epl', { id: '740780', start: '2026-01-01T17:30Z', home: { name: 'Crystal Palace' } }), 'winprob/epl/740780.json');
  assert.equal(gameKey('cpbl', { id: 'cpbl-tsdb-1', start: '2026-09-27T07:05:00Z', home: { en: 'Uni-President Lions', name: '統一獅' } }), '2026-09-27-lions');
  assert.equal(mergeHistories({ home: [] }).length, 0);
});
