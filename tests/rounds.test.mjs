import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarRounds, phaseRounds, roundLabel, cpblTable, seasonFrom } from '../public/lib/espn.mjs';
import { parseSearch, placeInCups, placeTeams, placePlayers } from '../public/lib/search.mjs';

const m = (id, start, h, a, extra = {}) => ({ id, kind: 'match', start, status: {}, home: { id: h }, away: { id: a }, ...extra });

test("MLS's matchdays by its calendar: each weekend or midweek one, a window of a few put-back games none", () => {
  // 16 sides (8 games a full round). Two weekends (Sat-Sun), a midweek, a lone put-back game, a weekend.
  const sides = 'ABCDEFGHIJKLMNOP'.split('');
  const round = (day, tag, n = 8) => Array.from({ length: n }, (_, i) => m(`${tag}${i}`, `${day}T23:30Z`, sides[i * 2], sides[i * 2 + 1]));
  const events = [...round('2026-02-21', 'a', 5), ...round('2026-02-22', 'b', 3), ...round('2026-02-28', 'c'), ...round('2026-03-04', 'd', 6), m('late', '2026-03-10T23:30Z', 'A', 'B'), ...round('2026-03-14', 'e')];
  const w = calendarRounds(events, Date.UTC(2026, 0, 1));
  assert.deepEqual(['a0', 'b0', 'c0', 'd0', 'e0'].map(id => w.get(id)), [1, 1, 2, 3, 4]);
  assert.equal(w.get('late'), undefined, 'a put-back game: none of its own');
});

test("a cup's league phase: one matchday a side's game; the day's as most of its games say; knockouts none", () => {
  // A group of three (C rests) and one of four, two matchdays on two days in a row.
  const events = [m('1', '2026-09-24T18:45Z', 'A', 'B'), m('2', '2026-09-24T18:45Z', 'D', 'E'), m('3', '2026-09-24T18:45Z', 'F', 'G'), m('4', '2026-09-27T18:45Z', 'C', 'A'), m('5', '2026-09-27T18:45Z', 'D', 'F'), m('6', '2026-09-27T18:45Z', 'E', 'G'), m('7', '2026-10-01T18:45Z', 'B', 'C'), m('8', '2026-10-01T18:45Z', 'D', 'G'), m('9', '2026-10-01T18:45Z', 'E', 'F'), m('ko', '2027-03-20T19:45Z', 'A', 'D', { round: { key: 'quarterfinals' } })];
  const w = phaseRounds(events, Date.UTC(2026, 6, 1));
  // B-C counts as 2 by its sides (C rested), but its day is matchday 3.
  assert.deepEqual(['1', '4', '7', '8'].map(id => w.get(id)), [1, 2, 3, 3]);
  assert.equal(w.get('ko'), undefined);
});

test("a round in the reader's words: a league's matchweek (第 N 輪), a cup's and MLS's matchday (第 N 比賽日)", () => {
  assert.equal(roundLabel('epl', 6, 7), '第 6–7 輪');
  assert.equal(roundLabel('epl', 6, 6, 'en'), 'Matchweek 6');
  assert.equal(roundLabel('ucl', 2), '第 2 比賽日');
  assert.equal(roundLabel('nationsleague', 3, 3, 'en'), 'Matchday 3');
  assert.equal(roundLabel('mls', 31, 31, 'en'), 'Matchday 31');
  assert.equal(roundLabel('mls', 31), '第 31 比賽日');
});

test("CPBL's tables: the league's own, the games since it was built put in the half on now, re-ranked", () => {
  const pack = {
    built: '2026-10-06T16:23:00Z',
    year: 2026,
    half: 'second',
    tables: [
      { key: 'first', rows: [{ en: 'Wei Chuan Dragons', zh: '味全龍', gp: 60, w: 39, t: 0, l: 21 }, { en: 'CTBC Brothers', zh: '中信兄弟', gp: 60, w: 20, t: 2, l: 38 }] },
      { key: 'second', rows: [
      { rank: 1, en: 'CTBC Brothers', zh: '中信兄弟', gp: 58, w: 35, t: 0, l: 23, pct: '0.603', gb: '-', streak: '勝1', last10: '6-0-4' },
      { rank: 2, en: 'Uni-President Lions', zh: '統一7-ELEVEn獅', gp: 58, w: 34, t: 0, l: 24, pct: '0.586', gb: '1', streak: '勝5', last10: '8-0-2' }
      ] }
    ]
  };
  const game = (start, home, away, hs, as, state = 'post') => ({ kind: 'match', start, status: { state }, home: { id: home, score: String(hs) }, away: { id: away, score: String(as) } });
  const events = [game('2026-10-06T10:35Z', 'CTBC Brothers', 'Uni-President Lions', 9, 1), game('2026-10-07T10:35Z', 'CTBC Brothers', 'Uni-President Lions', 1, 4), game('2026-10-07T10:35Z', 'Uni-President Lions', 'CTBC Brothers', 3, 3, 'in')];
  const [first, g] = cpblTable(pack, events, 'zh');
  assert.equal(g.name, '2026 下半季');
  assert.deepEqual(g.rows.map(r => [r.id, r.stats.W, r.stats.L, r.stats.PCT, r.stats.GB]), [['CTBC Brothers', '35', '24', '.593', '-'], ['Uni-President Lions', '35', '24', '.593', '-']]);
  assert.deepEqual(first.rows.map(r => [r.stats.W, r.stats.L, r.stats.T]), [['39', '21', undefined], ['20', '38', '2']], 'the half over: as it was');
  assert.equal(cpblTable(pack, [], 'en')[1].rows[0].stats.STRK, '勝1');
  assert.equal(cpblTable(pack, [], 'en')[1].name, 'Second half 2026');
  assert.deepEqual(cpblTable(null, events), []);
});

test("search: a club or player of a league we don't have, placed in its European cup, else left out", async () => {
  const data = {
    results: [
      { type: 'team', contents: [{ uid: 's:600~t:1929', displayName: 'Benfica', sport: 'soccer', defaultLeagueSlug: 'por.1' }, { uid: 's:600~t:20830', displayName: 'Benfica', sport: 'soccer', defaultLeagueSlug: 'uefa.wchampions' }, { uid: 's:600~t:9999', displayName: 'Omonia Aradippou', sport: 'soccer', defaultLeagueSlug: 'cyp.1' }] },
      { type: 'player', contents: [{ uid: 's:600~a:220819', displayName: 'Vangelis Pavlidis', sport: 'soccer', defaultLeagueSlug: 'por.1' }, { uid: 's:600~a:1', displayName: 'Someone', sport: 'soccer', defaultLeagueSlug: 'cyp.1' }] }
    ]
  };
  const found = parseSearch(data);
  assert.deepEqual(found.teams.map(x => [x.id, x.league, x.slug]), [['1929', null, 'por.1'], ['9999', null, 'cyp.1']], "the women's side isn't kept");
  const cups = new Map([['1929', 'uel']]);
  const placed = await placeInCups(found, cups, async (slug, id) => (id === '220819' ? '1929' : '42'));
  assert.deepEqual(placed.teams.map(x => [x.name, x.league]), [['Benfica', 'uel']]);
  assert.deepEqual(placed.players.map(x => [x.name, x.league]), [['Vangelis Pavlidis', 'uel']]);
});

test("a season counted from when ESPN says it began: MLS's from January (back from a World Cup break in July), Europe's from summer", () => {
  const page = (start, end) => ({ leagues: [{ season: { startDate: start, endDate: end } }], events: [{ date: '2026-07-16T23:30Z' }] });
  const july = Date.UTC(2026, 6, 1);
  assert.equal(seasonFrom([page('2026-01-01T10:00Z', '2026-12-31T04:59Z')], Date.parse('2026-10-11T00:00Z'), july), Date.parse('2026-01-01T10:00Z'));
  assert.equal(seasonFrom([page('2026-06-01T04:00Z', '2027-06-01T03:59Z'), page('2027-06-01T04:00Z', '2028-06-01T03:59Z')], Date.parse('2027-01-11T00:00Z'), july), Date.parse('2026-06-01T04:00Z'));
  assert.equal(seasonFrom([{ events: [{ date: '2026-08-15T14:00Z' }] }], Date.parse('2026-10-11T00:00Z'), july), july);
});

test('search "madrid": Real Madrid placed at once, whatever its many footballers of other leagues take', async () => {
  const found = parseSearch({ results: [{ type: 'team', contents: [{ uid: 's:600~t:86', displayName: 'Real Madrid', sport: 'soccer', defaultLeagueSlug: 'esp.1' }, { uid: 's:600~t:21128', displayName: 'Real Madrid', sport: 'soccer', defaultLeagueSlug: 'esp.w.1' }] }] });
  assert.deepEqual(placeTeams(found.teams, new Map([['86', 'ucl']])).map(x => [x.id, x.league]), [['86', 'ucl']]);
  // Only the first few unplaced players are looked up.
  let asked = 0;
  const players = Array.from({ length: 9 }, (_, i) => ({ league: null, slug: 'col.copa', id: String(i), name: `P${i}` }));
  await placePlayers(players, new Map(), async () => (asked++, null));
  assert.equal(asked, 6);
});

test("Nations League tables: rows in ESPN's rank (France first), each tier's own zones from group A1's notes", async () => {
  const { parseStandings } = await import('../public/lib/espn.mjs');
  const entry = (id, name, rank, pts, note) => ({ team: { id, displayName: name }, note, stats: [{ name: 'rank', abbreviation: 'R', value: rank, displayValue: String(rank) }, { name: 'points', abbreviation: 'P', value: pts, displayValue: String(pts) }] });
  const N = { 1: { color: '#81D6AC', description: 'A: Qualifies for QFs; B-D: Promotion' }, 2: { color: '#B5E7CE', description: 'A: Qualifies for QFs; B-D: Promotion playoffs' }, 3: { color: '#FEB4B5', description: 'A, B: Relegation playoffs' }, 4: { color: '#FF7F84', description: 'A, B: Relegation; C: Relegation or playoffs' } };
  const data = {
    children: [
      { name: 'Group A1', standings: { entries: [entry('1', 'Italy', 2, 7, N[2]), entry('2', 'Belgium', 3, 6, N[3]), entry('3', 'Türkiye', 4, 0, N[4]), entry('4', 'France', 1, 10, N[1])] } },
      { name: 'Group C2', standings: { entries: [entry('5', 'X', 3, 3), entry('6', 'Y', 1, 9), entry('7', 'Z', 2, 6), entry('8', 'W', 4, 0)] } }
    ]
  };
  const [a, c] = parseStandings(data);
  assert.deepEqual(a.rows.map(r => r.name), ['France', 'Italy', 'Belgium', 'Türkiye']);
  assert.deepEqual(a.rows.map(r => r.note), ['Qualifies for QFs', 'Qualifies for QFs', 'Relegation playoffs', 'Relegation']);
  assert.deepEqual(c.rows.map(r => r.note), ['Promotion', 'Promotion playoffs', '', 'Relegation or playoffs']);
  assert.equal(c.rows[2].color, '');
});

test("a table's zones each read their own name (MLS's round one and wild card, a cup's seeded and unseeded playoffs)", async () => {
  const { zoneName } = await import('../public/sheets.js');
  const leagues = [
    ['Champions League', 'Champions League qualifying', 'Europa League', 'Conference League qualifying', 'Relegation playoff', 'Relegation'],
    ['Qualifies for MLS Cup Playoffs - Round One Best-of-3 series', 'Qualifies for MLS Cup Playoffs - Wild Card Matches'],
    ['Qualifies for round of 16', 'Knockout phase playoffs - seeded', 'Knockout phase playoffs - unseeded', 'Eliminated'],
    ['Qualifies for QFs', 'Promotion', 'Promotion playoffs', 'Relegation playoffs', 'Relegation or playoffs']
  ];
  for (const notes of leagues) {
    const names = notes.map(zoneName);
    assert.equal(new Set(names).size, names.length, names.join(' '));
    assert.ok(names.every(n => /[㐀-鿿]/.test(n)), names.join(' '));
  }
  assert.equal(zoneName('Qualifies for MLS Cup Playoffs - Wild Card Matches'), '季後賽外卡');
});
