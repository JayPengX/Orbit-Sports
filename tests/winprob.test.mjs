import test from 'node:test';
import assert from 'node:assert/strict';
import { nameScore, findMarket, mergeHistories, polymarketLine, gameKey, monthPath, packLine, unpackLine, historyUrl } from '../public/lib/winprob.mjs';

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

test("a finished game's kept line: in its month's file, a fifth the size, the same line back", async () => {
  assert.equal(monthPath('epl', '2026-01-01T17:30Z'), 'winprob/epl/2026-01.json');
  assert.equal(gameKey('epl', { id: '740780', start: '2026-01-01T17:30Z', home: { name: 'Crystal Palace' } }), '740780');
  assert.equal(gameKey('cpbl', { id: 'cpbl-tsdb-1', start: '2026-09-27T07:05:00Z', home: { en: 'Uni-President Lions', name: '統一獅' } }), '2026-09-27-lions');
  const line = await polymarketLine('bundesliga', { start: '2026-09-19T13:30Z', home: 'Hamburg SV', away: 'FC Cologne' }, getJson);
  const kept = packLine(line);
  assert.deepEqual(kept.p[0], [0, 300, 300]);
  assert.deepEqual(unpackLine(JSON.parse(JSON.stringify(kept))).points, line.points);
  assert.ok(JSON.stringify(kept).length < JSON.stringify(line).length / 2);
  assert.equal(unpackLine({ none: 'espn' }), null);
  assert.equal(mergeHistories({ home: [] }).length, 0);
});

test("a game to come: Polymarket's chance now, the three ways adding to one", async () => {
  const { polymarketNow } = await import('../public/lib/winprob.mjs');
  const markets = [
    { groupItemTitle: 'Arsenal', clobTokenIds: '["h","x"]' },
    { groupItemTitle: 'Draw (Arsenal vs. Leeds)', clobTokenIds: '["d","x"]' },
    { groupItemTitle: 'Leeds United', clobTokenIds: '["a","x"]' }
  ];
  const price = { h: 0.715, d: 0.185, a: 0.105 };
  const getJson = async url => (url.includes('gamma') ? [{ slug: 'epl-ars-lee-2026-10-10', markets }] : { history: [{ t: 1, p: 0.5 }, { t: 2, p: price[new URL(url).searchParams.get('market')] }] });
  const now = await polymarketNow('epl', { start: '2026-10-10T11:30Z', home: 'Arsenal', away: 'Leeds United' }, getJson);
  assert.equal(now.source, 'polymarket');
  assert.equal(Math.round(now.home * 1000), 711);
  assert.equal(Math.round(now.draw * 1000), 184);
});

test("F1: a race's chances by lap, the laps as they really ran (OpenF1), kept a fraction the size", async () => {
  const { raceLine, raceLaps, packRace, unpackRace, raceKey } = await import('../public/lib/winprob.mjs');
  // Bahrain GP in Malaysia, 2026-10-04: set for 07:00, held for rain; lap 1 at 08:33.
  const start = '2026-10-04T07:00:00Z';
  const s = iso => Date.parse(iso) / 1000;
  const lapStarts = ['08:33:00', '08:35:42', '08:39:34', '08:41:54', '08:43:40'].map(x => `2026-10-04T${x}Z`);
  const drivers = [
    ['Max Verstappen', 'max', 229815],
    ['Kimi Antonelli', 'kimi', 86981],
    ['Lance Stroll', 'lance', 10]
  ];
  const prices = {
    max: [[s('2026-10-04T06:40:00Z'), 0.55], [s('2026-10-04T08:38:00Z'), 0.34], [s('2026-10-04T08:44:00Z'), 0.8]],
    kimi: [[s('2026-10-04T06:40:00Z'), 0.23], [s('2026-10-04T08:38:00Z'), 0.57], [s('2026-10-04T08:44:00Z'), 0.15]],
    lance: [[s('2026-10-04T06:40:00Z'), 0.001]]
  };
  const getJson = async url => {
    const u = new URL(url);
    if (u.host.startsWith('gamma')) return [{ slug: 'f1-bahrain-grand-prix-driver-podium-2026-10-04', markets: [] }, { slug: 'f1-bahrain-grand-prix-winner-2026-10-04', markets: drivers.map(([n, t, v]) => ({ groupItemTitle: n, clobTokenIds: `["${t}","x"]`, volume: v })) }];
    if (u.pathname.endsWith('/sessions')) return [{ session_key: 11731, date_start: '2026-10-04T07:00:00+00:00' }];
    if (u.pathname.endsWith('/session_result')) return [{ driver_number: 3 }];
    if (u.pathname.endsWith('/laps')) return lapStarts.map((d, i) => ({ lap_number: i + 1, date_start: d, lap_duration: 100 }));
    return { history: prices[u.searchParams.get('market')].map(([t, p]) => ({ t, p })) };
  };
  const laps = await raceLaps(start, getJson);
  assert.equal(laps.length, 6);
  assert.equal(laps[0].t, s(lapStarts[0]));
  assert.equal(laps.at(-1).t, s(lapStarts[4]) + 100);
  const line = await raceLine(start, getJson, laps);
  assert.equal(line.market, 'f1-bahrain-grand-prix-winner-2026-10-04');
  // Stroll never had a chance: not drawn.
  assert.deepEqual(line.drivers, ['Max Verstappen', 'Kimi Antonelli']);
  assert.equal(line.by, 'lap');
  assert.deepEqual(line.points.map(p => p.lap), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(line.points[0].c, [0.55, 0.23]);
  assert.deepEqual(line.points[2].c, [0.34, 0.57]);
  assert.deepEqual(line.points[5].c, [0.8, 0.15]);
  const kept = packRace(line);
  assert.deepEqual(kept.p[2], [2, 340, 570]);
  assert.deepEqual(unpackRace(kept), line);
  assert.equal(raceKey(start), '2026-10-04');
});
