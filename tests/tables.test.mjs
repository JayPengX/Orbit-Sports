// Tables as every page shows them (title.mjs liveTable, espn.mjs withGaps,
// cpblTable, tierZones, driverSeason) and a season's rounds (seasonRounds).
import test from 'node:test';
import assert from 'node:assert/strict';
import { liveTable, standingsRace, roundOf, roundCounted, COUNTS, pctText, gbText } from '../public/lib/title.mjs';
import { withGaps, cpblTable, driverSeason, seasonRounds, seasonTo, parseCalendar, monthsBetween, roundKind, roundLabel, zoneColor } from '../public/lib/espn.mjs';

const row = (id, stats, extra = {}) => ({ id, name: id, stats, ...extra });
const match = (id, state, home, away, hs, as, hrec, arec, extra = {}) => ({ id, kind: 'match', start: '2026-10-04T10:00Z', status: { state, completed: state === 'post' }, home: { id: home, score: String(hs), record: hrec }, away: { id: away, score: String(as), record: arec }, ...extra });

test('a table with the results in keeps its season’s year (the page asks for last season’s by it)', () => {
  const groups = Object.assign([{ name: '', rows: [row('A', { W: '10', L: '5', PCT: '.667' }), row('B', { W: '8', L: '7', PCT: '.533' })] }], { year: 2026 });
  const out = liveTable(groups, [match('1', 'post', 'B', 'A', 5, 3, '9-7', '10-6')], 'basketball');
  assert.equal(out.fresh, 1);
  assert.equal(out.year, 2026);
  // Nothing to add: the same table, its year with it.
  assert.equal(liveTable(groups, [], 'basketball').year, 2026);
});

test('liveTable leaves out what the table doesn’t count: called off, preseason, play-offs, no score yet', () => {
  const t = () => [{ name: '', rows: [row('A', { GP: '5', W: '3', D: '1', L: '1', GD: '+4', P: '10' }), row('B', { GP: '5', W: '2', D: '1', L: '2', GD: '0', P: '7' })] }];
  const games = [
    match('void', 'post', 'B', 'A', 3, 0, '3-1-2', '3-1-2', { status: { state: 'post', void: true } }),
    match('pre', 'post', 'B', 'A', 3, 0, '3-1-2', '3-1-2', { stage: { key: 'pre' } }),
    match('po', 'post', 'B', 'A', 3, 0, '3-1-2', '3-1-2', { stage: { key: 'post' } }),
    match('blank', 'in', 'B', 'A', '', '', '2-1-2', '3-1-1')
  ];
  for (const g of games) assert.equal(liveTable(t(), [g], 'soccer').fresh, 0, g.id);
  assert.equal(COUNTS({ stage: { key: 'regular' } }), true);
  assert.equal(COUNTS({}), true);
  assert.equal(COUNTS({ stage: { key: 'playin' } }), false);
  // A sport with no table rule (or no table): as given.
  const g0 = t();
  assert.equal(liveTable(g0, games, 'tennis'), g0);
  assert.deepEqual(liveTable([], games, 'soccer'), []);
});

test('liveTable: a soccer draw is a point each, a goal difference keeps its sign; a basketball game on adds nothing', () => {
  const t = [{ name: '', rows: [row('A', { GP: '5', W: '3', D: '1', L: '1', F: '9', A: '5', GD: '+4', P: '10' }), row('B', { GP: '5', W: '0', D: '1', L: '4', F: '2', A: '8', GD: '-6', P: '1' })] }];
  const out = liveTable(t, [match('d', 'post', 'B', 'A', 1, 1, '0-2-4', '3-2-1')], 'soccer');
  const [a, b] = ['A', 'B'].map(id => out[0].rows.find(r => r.id === id));
  assert.deepEqual([a.stats.GP, a.stats.D, a.stats.P, a.stats.GD, a.stats.F], ['6', '2', '11', '+4', '10']);
  assert.deepEqual([b.stats.P, b.stats.GD, b.stats.A], ['2', '-6', '9']);
  const bb = [{ name: '', rows: [row('X', { W: '1', L: '0', PCT: '1.000' }), row('Y', { W: '0', L: '1', PCT: '.000' })] }];
  const on = liveTable(bb, [match('l', 'in', 'X', 'Y', 50, 50, '1-0', '0-1')], 'basketball');
  assert.deepEqual([on[0].rows[0].stats.W, on[0].rows[0].stats.L, on[0].rows[0].fresh, on.fresh], ['1', '0', undefined, 0]);
});

test('games behind and points behind: the leader "-", a missing number left blank', () => {
  const [g] = withGaps([{ rows: [row('A', { W: '50', L: '20' }), row('B', { W: '45', L: '25' }), row('C', { W: '52', L: '30' }), row('D', { W: '60', L: '25' })] }], 'basketball');
  assert.deepEqual(g.rows.map(r => r.stats.GB), ['-', '5', '4', '-'], 'a side with more wins and losses than the leader, behind it on percentage: "-", never -2.5');
  const [p] = withGaps([{ rows: [row('A', { P: '30' }), row('B', { P: '28' }), row('C', { P: '' })] }], 'soccer');
  assert.deepEqual(p.rows.map(r => r.stats.GAP), ['-', '2', '']);
  // A table that has GB already: as given.
  const given = [{ rows: [row('A', { W: '1', L: '0', GB: '-' }), row('B', { W: '0', L: '1', GB: '1' })] }];
  assert.deepEqual(withGaps(given, 'baseball')[0].rows.map(r => r.stats.GB), ['-', '1']);
});

test('CPBL’s table: games behind never below the leader’s (a side ahead of it on wins, behind on percentage)', () => {
  const pack = { built: '2026-10-06T00:00:00Z', year: 2026, half: 'second', tables: [{ key: 'second', rows: [{ en: 'Rakuten Monkeys', zh: '樂天桃猿', gp: 12, w: 10, l: 2, t: 0 }, { en: 'CTBC Brothers', zh: '中信兄弟', gp: 40, w: 30, l: 10, t: 0 }] }] };
  const [half] = cpblTable(pack, [], 'zh');
  assert.deepEqual(half.rows.map(r => [r.en, r.stats.PCT, r.stats.GB]), [['Rakuten Monkeys', '.833', '-'], ['CTBC Brothers', '.750', '-']], 'not -6');
  assert.deepEqual(cpblTable(null), []);
  assert.deepEqual(cpblTable({ tables: [] }), []);
});

test('a driver’s season from the table: place, points, gap and each weekend’s points (none to come)', () => {
  const groups = [{ rows: [row('1', { PTS: '300', GAP: '-', RK: '1', BHR: '25', SAU: '18', MIA: '' }, { athlete: true }), row('2', { PTS: '280', GAP: '20', RK: '2', BHR: '18', SAU: '25', MIA: ' ' }, { athlete: true })] }];
  assert.deepEqual(driverSeason(groups, 2), { pos: 2, points: '280', gap: '20', races: [['BHR', '18'], ['SAU', '25']], of: 2 });
  assert.equal(driverSeason(groups, 9), null);
  assert.equal(driverSeason(null, 1), null);
});

test('F1: a weekend’s column by name; a race in only past a sprint’s 36 points', () => {
  const g = { rounds: [{ key: 'USA', name: 'Pirelli United States Grand Prix' }], rows: [row('1', { USA: '8' }), row('2', { USA: '7' })] };
  assert.equal(roundOf(g, 'United States Grand Prix').key, 'USA');
  assert.equal(roundOf(g, ''), null);
  assert.equal(roundOf({}, 'United States Grand Prix'), null);
  assert.equal(roundCounted(g, 'United States Grand Prix', 'SR', true), true);
  assert.equal(roundCounted(g, 'United States Grand Prix', 'Race', true), false, '15 points: the sprint alone');
  // No column found: taken as in (never counted twice).
  assert.equal(roundCounted(g, 'Mexico City Grand Prix', 'Race'), true);
});

test('the title race before a game is played, and a table of one: nothing to say', () => {
  assert.equal(standingsRace({ rows: [row('A', { GP: '0', P: '0' }), row('B', { GP: '0', P: '0' }), row('C', { GP: '0', P: '0' }), row('D', { GP: '0', P: '0' })] }, 'soccer'), null);
  assert.equal(standingsRace({ rows: [row('A', { GP: '3', P: '9' })] }, 'soccer'), null);
  assert.equal(standingsRace({ rows: [row('A', { W: '1', L: '0' }), row('B', { W: '0', L: '1' })] }, 'baseball'), null, 'no season length known');
  assert.equal(standingsRace({ rows: [row('A', { PTS: '25' }), row('B', { PTS: '18' })] }, 'racing'), null, 'no races left known');
});

test('a season’s rounds count that season only (next season’s games on the same year page are its own)', () => {
  const ev = (id, date, h, a) => ({ id, date, name: `${a} at ${h}`, season: { type: 2 }, competitions: [{ competitors: [{ homeAway: 'home', team: { id: h, displayName: h } }, { homeAway: 'away', team: { id: a, displayName: a } }], status: { type: { state: 'post' } } }], status: { type: { state: 'post' } } });
  const season = (start, end) => ({ leagues: [{ season: { startDate: start, endDate: end } }] });
  const y2025 = { ...season('2025-08-01T04:00Z', '2026-06-01T03:59Z'), events: [ev('a1', '2025-08-16T14:00Z', '1', '2'), ev('a2', '2025-08-23T14:00Z', '2', '1')] };
  // The 2026 page: last season's spring, then the new season's August.
  const y2026 = { ...season('2026-08-01T04:00Z', '2027-06-01T03:59Z'), events: [ev('a3', '2026-04-04T14:00Z', '1', '2'), ev('b1', '2026-08-15T14:00Z', '1', '2')] };
  const july = Date.UTC(2025, 6, 1);
  const last = seasonRounds([y2025, y2026], 'epl', Date.parse('2025-08-16T14:00Z'), july);
  assert.deepEqual(['a1', 'a2', 'a3'].map(id => last.get(id)), [1, 2, 3]);
  assert.equal(last.get('b1'), undefined, 'not matchweek 4 of last season');
  const now = seasonRounds([y2026, null], 'epl', Date.parse('2026-08-15T14:00Z'), Date.UTC(2026, 6, 1));
  assert.equal(now.get('b1'), 1);
  // Without ESPN's dates: a year from the start.
  assert.equal(seasonTo([], Date.parse('2026-08-15T14:00Z'), Date.UTC(2026, 6, 1)), Date.UTC(2027, 6, 1));
});

test('a league’s calendar: its game days (a whitelist), the days between less a blacklist, or a cup’s months', () => {
  assert.deepEqual(parseCalendar({ leagues: [{ calendar: ['2026-10-01T07:00Z', '2026-10-03T07:00Z'] }] }), { days: ['20261001', '20261003'] });
  assert.deepEqual(parseCalendar({ leagues: [{ calendarIsWhitelist: false, calendarStartDate: '2026-09-28T07:00Z', calendarEndDate: '2026-10-02T07:00Z', calendar: ['2026-09-30T07:00Z'] }] }), { days: ['20260928', '20260929', '20261001', '20261002'] });
  assert.deepEqual(parseCalendar({ leagues: [{ calendar: [{ label: 'League Phase', entries: [] }] }] }), { months: true });
  assert.equal(parseCalendar({ leagues: [{ calendar: [] }] }), null);
  assert.equal(parseCalendar(null), null);
  // Across the new year.
  assert.deepEqual(monthsBetween(Date.UTC(2026, 10, 20), Date.UTC(2027, 1, 2)), ['202611', '202612', '202701', '202702']);
  assert.ok(monthsBetween(0, Date.UTC(2030, 0, 1)).length <= 24);
  assert.equal(roundKind('nba'), null);
  assert.equal(roundLabel('epl', 0), '');
  assert.equal(zoneColor('', ''), '');
  assert.equal(zoneColor('', 'zz'), '');
  assert.equal(zoneColor('', '#abc'), '#abc');
});

test('a win percentage and games behind, written one way in every table', () => {
  assert.deepEqual([pctText(0, 0), pctText(1, 0), pctText(2, 1), pctText(0, 3), pctText(81, 81)], ['.000', '1.000', '.667', '.000', '.500']);
  assert.equal(gbText({ w: 10, l: 2 }, { w: 10, l: 2 }), '-');
  assert.equal(gbText({ w: 10, l: 2 }, { w: 9, l: 4 }), '1.5');
  assert.equal(gbText({ w: 10, l: 2 }, { w: 30, l: 10 }), '-');
});
