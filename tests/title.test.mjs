import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveTable, titleRace, standingsRace } from '../public/lib/title.mjs';

const row = (id, stats) => ({ id, name: id, stats });
const soccerTable = () => [{ name: '', rows: [row('A', { GP: '30', W: '22', D: '4', L: '4', F: '60', A: '20', GD: '+40', P: '70' }), row('B', { GP: '30', W: '20', D: '6', L: '4', F: '55', A: '25', GD: '+30', P: '66' }), row('C', { GP: '30', W: '10', D: '5', L: '15', F: '30', A: '45', GD: '-15', P: '35' })] }];
const game = (id, state, home, away, hs, as, hrec, arec, start = '2026-10-04T10:00Z') => ({ id, kind: 'match', start, status: { state }, home: { id: home, score: String(hs), record: hrec }, away: { id: away, score: String(as), record: arec } });

test('a final the table hasn’t counted is added, once; when the table catches up, nothing more', () => {
  // B beat C: B's record says 31 games now (21-6-4), C's 31; the table still has 30.
  const g = game('1', 'post', 'B', 'C', 2, 0, '21-6-4', '10-5-16');
  const t = liveTable(soccerTable(), [g], 'soccer');
  const b = t[0].rows.find(r => r.id === 'B');
  assert.deepEqual([b.stats.GP, b.stats.P, b.stats.GD, b.fresh], ['31', '69', '+32', 'post']);
  assert.equal(t.fresh, 1);
  // ESPN's table now has it: the same game adds nothing.
  const caught = soccerTable();
  Object.assign(caught[0].rows[1].stats, { GP: '31', W: '21', P: '69', GD: '+32' });
  Object.assign(caught[0].rows[2].stats, { GP: '31', L: '16', P: '35', GD: '-17' });
  const again = liveTable(caught, [g], 'soccer');
  assert.equal(again.fresh, 0);
  assert.equal(again[0].rows[1].stats.P, '69', 'not 72');
});

test('a game on now counts as it stands (provisional); the record not caught up yet adds nothing', () => {
  const live = game('2', 'in', 'B', 'A', 1, 0, '20-6-4', '22-4-4');
  const t = liveTable(soccerTable(), [live], 'soccer');
  assert.deepEqual(t[0].rows.map(r => r.id), ['A', 'B', 'C'], '70 v 69');
  assert.equal(t[0].rows[1].stats.P, '69');
  assert.equal(t[0].rows[1].fresh, 'in');
  // A final whose record still reads 30 games (ESPN not caught up): left alone.
  assert.equal(liveTable(soccerTable(), [game('3', 'post', 'B', 'C', 2, 0, '20-6-4', '10-5-15')], 'soccer').fresh, 0);
});

test('two games a side in the window (yesterday’s final, today’s on now) both count, in order', () => {
  const t = [{ name: '', rows: [row('X', { W: '90', L: '70', PCT: '.563' }), row('Y', { W: '88', L: '72', PCT: '.550' })] }];
  // Yesterday X beat Y (table hasn't it); today Y leads X. Records: X 91-70, Y 88-73 (finals in).
  const y1 = game('a', 'post', 'X', 'Y', 5, 3, '91-70', '88-73', '2026-10-03T10:00Z');
  const y2 = game('b', 'in', 'Y', 'X', 4, 1, '88-73', '91-70', '2026-10-04T10:00Z');
  const out = liveTable(t, [y2, y1], 'baseball');
  const [x, y] = ['X', 'Y'].map(id => out[0].rows.find(r => r.id === id));
  assert.deepEqual([x.stats.W, x.stats.L, y.stats.W, y.stats.L], ['91', '71', '89', '73']);
  assert.equal(out.fresh, 2);
});

test('the title race: won, the magic number and the soonest round', () => {
  // 38 rounds (20 sides). A 80 from 34, B 70 from 34: B can reach 82 → A needs 3 more.
  const rows = [row('A', { GP: '34', P: '80' }), row('B', { GP: '34', P: '70' }), ...Array.from({ length: 18 }, (_, i) => row(`z${i}`, { GP: '34', P: String(40 - i) }))];
  const r = titleRace({ rows }, 'soccer');
  assert.deepEqual([r.done, r.magic, r.soonest, r.round], [false, 3, 1, 35]);
  assert.ok(r.out.includes('z0'), 'too far back to catch up');
  const won = titleRace({ rows: [row('A', { GP: '36', P: '85' }), row('B', { GP: '36', P: '78' }), row('C', { GP: '36', P: '50' }), row('D', { GP: '36', P: '40' })] }, 'soccer', { total: 38 });
  assert.equal(won.done, true);
  // Baseball: 162 games. X 95-60, the nearest Y 90-65: magic 162+1-95-65 = 3.
  const mlb = titleRace({ rows: [row('X', { W: '95', L: '60' }), row('Y', { W: '90', L: '65' })] }, 'baseball', { total: 162 });
  assert.deepEqual([mlb.magic, mlb.soonest, mlb.done], [3, 2, false]);
  // F1: 3 races (one sprint) left, worth 83 at most. Leader 350, next 300: 300+83-350+1 = 34.
  const f1 = titleRace({ rows: [row('V', { PTS: '350' }), row('N', { PTS: '300' })] }, 'racing', { left: { races: 3, sprints: 1 } });
  assert.deepEqual([f1.magic, f1.soonest, f1.done], [34, 1, false]);
  // The calendar's own weekends: the sprint is the last one, so 54 can't come in one (50), but in the 2nd, by its name.
  const list = [{ name: '美國站', sprint: false }, { name: '墨西哥站', sprint: false }, { name: '巴西站', sprint: true }];
  const f1b = titleRace({ rows: [row('V', { PTS: '330' }), row('N', { PTS: '300' })] }, 'racing', { left: { races: 3, sprints: 1, list } });
  assert.deepEqual([f1b.magic, f1b.soonest, f1b.at], [54, 2, '墨西哥站']);
});

test('every place: settled ones, the places still open, the zones', () => {
  // 4 sides, 6 games each, 1 to go: A 15, B 12, C 7, D 1.
  const rows = [row('A', { GP: '5', P: '15' }), row('B', { GP: '5', P: '12' }), row('C', { GP: '5', P: '7' }), row('D', { GP: '5', P: '1' })];
  rows[0].note = rows[1].note = 'Champions League';
  rows[3].note = 'Relegation';
  const r = standingsRace({ rows }, 'soccer');
  assert.equal(r.title.done, false, 'B can reach 15');
  assert.deepEqual(r.rows.map(x => [x.best, x.worst]), [[1, 2], [1, 2], [3, 3], [4, 4]]);
  assert.deepEqual(r.places, [], 'the title not settled: none');
  const won = standingsRace({ rows: [row('A', { GP: '5', P: '15' }), row('B', { GP: '5', P: '9' }), row('C', { GP: '5', P: '8' }), row('D', { GP: '5', P: '1' })] }, 'soccer');
  assert.deepEqual([won.title.done, won.places], [true, []], "a team sport's places inside a zone: no fights (its zones say what's at stake)");
  assert.deepEqual(r.zones.map(z => [z.note, z.sure]), [['Champions League', ['A', 'B']], ['Relegation', ['D']]]);
});

test('F1: a race counts once it’s over (not while it runs) until its column has numbers; constructors by their drivers', () => {
  const drivers = { name: '車手', rows: [row('1', { PTS: '300', MYS: '-' }), row('2', { PTS: '290', MYS: '-' })].map(r => ({ ...r, athlete: true })), rounds: [{ key: 'MYS', name: 'Malaysia GP' }] };
  const teams = { name: '車隊', rows: [{ ...row('m', { PTS: '500', MYS: ' ' }), en: 'Mercedes' }, { ...row('r', { PTS: '480', MYS: ' ' }), en: 'Red Bull' }], rounds: [{ key: 'MYS', name: 'Malaysia GP' }] };
  const race = { abbr: 'Race', status: { state: 'post' }, field: [{ id: '2', en: 'Max Verstappen' }, { id: '1', en: 'Kimi Antonelli' }] };
  const ev = { id: 'w', name: 'Malaysia GP', kind: 'field', start: new Date().toISOString(), sessions: [race] };
  const teamOf = s => ({ 'Max Verstappen': 'Red Bull Racing', 'Kimi Antonelli': 'Mercedes' })[s.en];
  // On now: the table as it stands, nothing added by the running order.
  const running = { ...ev, sessions: [{ ...race, status: { state: 'in' } }] };
  assert.equal(liveTable([drivers, teams], [running], 'racing', { teamOf }).fresh, 0);
  const out = liveTable([drivers, teams], [ev], 'racing', { teamOf });
  assert.deepEqual(out[0].rows.map(r => [r.id, r.stats.PTS, r.fresh]), [['2', '315', 'post'], ['1', '318', 'post']].sort((a, b) => b[1] - a[1]));
  assert.deepEqual(out[1].rows.map(r => [r.id, r.stats.PTS]), [['m', '518'], ['r', '505']]);
  // Counted (numbers in the column): nothing more.
  const done = { ...drivers, rows: [row('1', { PTS: '318', MYS: '18' }), row('2', { PTS: '315', MYS: '25' })].map(r => ({ ...r, athlete: true })) };
  assert.equal(liveTable([done], [ev], 'racing', { teamOf }).fresh, 0);
});

test('a football matchweek: one more than either side’s league games before it; pre-season out of the NBA table', async () => {
  const { weeksFrom } = await import('../public/lib/espn.mjs');
  const m = (id, d, h, a) => ({ id, kind: 'match', start: `2026-08-${d}T14:00Z`, status: {}, home: { id: h }, away: { id: a } });
  // Week 1: A-B, C-D; week 2: A-C, then B-D put back to after week 3; week 3: A-D, B-C.
  const w = weeksFrom([m('1', '15', 'A', 'B'), m('2', '15', 'C', 'D'), m('3', '22', 'A', 'C'), m('5', '29', 'A', 'D'), m('6', '29', 'B', 'C'), m('4', '30', 'B', 'D')], Date.UTC(2026, 6, 1));
  assert.deepEqual(['1', '2', '3', '5', '6'].map(id => w.get(id)), [1, 1, 2, 3, 3]);
  const t = [{ rows: [row('T', { W: '0', L: '0' }), row('U', { W: '0', L: '0' })] }];
  const pre = { ...game('p', 'post', 'T', 'U', 100, 90, '1-0', '0-1'), stage: { key: 'pre' } };
  assert.equal(liveTable(t, [pre], 'basketball').fresh, 0);
});

test("F1's close fights once the champion's decided: runs of places still open within a weekend's points, the closest two", () => {
  const t = (id, pts) => row(id, { PTS: String(pts) });
  // 2 races, no sprints left: a team's weekend is 43. Champion decided (600 vs 400 + 86).
  const g = { rows: [t('mc', 600), t('fe', 400), t('rb', 390), t('me', 300), t('am', 120), t('al', 110), t('wi', 100), t('ha', 20)] };
  const r = standingsRace(g, 'racing', { left: { races: 2, sprints: 0 }, team: true });
  assert.equal(r.title.done, true);
  assert.deepEqual(r.places.map(p => [p.pos, p.to, p.spread]), [[2, 3, 10], [5, 7, 20]]);
  const open = standingsRace({ rows: [t('mc', 420), t('fe', 400), t('rb', 390)] }, 'racing', { left: { races: 2, sprints: 0 }, team: true });
  assert.deepEqual(open.places, [], 'the champion not decided: the title race alone');
});

test("a zone's fight: at its edge, the sides that can finish either side of it, close to it", () => {
  // 6 sides, 10 games each, 2 to go (6 points left).
  const t = (id, pts, note) => ({ ...row(id, { GP: '8', P: String(pts) }), note });
  const g = { rows: [t('A', 24, 'Champions League'), t('B', 18, 'Champions League'), t('C', 16, ''), t('D', 15, ''), t('E', 5, 'Relegation'), t('F', 4, 'Relegation')] };
  const r = standingsRace(g, 'soccer', { total: 10 });
  const cl = r.zones.find(z => z.note === 'Champions League');
  assert.deepEqual(cl.fight.rows.map(x => x.id), ['B', 'C', 'D']);
  assert.equal(cl.fight.spread, 3);
  assert.equal(r.zones.find(z => z.note === 'Relegation').fight, undefined, 'E and F are 10 points from safety: no fight');
  const early = standingsRace({ rows: g.rows.map(x => ({ ...x, stats: { GP: '8', P: x.stats.P } })) }, 'soccer', { total: 30 });
  assert.deepEqual(early.zones.find(z => z.note === 'Champions League').fight.rows.map(x => x.id), ['A', 'B', 'C', 'D', 'E'], '22 games to go: close is a fifth of the 66 points left (13), F one past it');
});

test("F1's close fights are the constructors' only", () => {
  const t = (id, pts) => ({ ...row(id, { PTS: String(pts) }), athlete: true });
  const r = standingsRace({ rows: [t('a', 400), t('b', 200), t('c', 195)] }, 'racing', { left: { races: 2, sprints: 0 }, team: false });
  assert.equal(r.title.done, true);
  assert.deepEqual(r.places, []);
});

test("a zone's fight is two to eight sides: none where half the table's bunched", () => {
  const t = (id, gp, pts, note) => ({ ...row(id, { GP: String(gp), P: String(pts) }), note });
  // The Champions League after four matchdays: everyone around 24th within a few points.
  const ucl = { rows: Array.from({ length: 36 }, (_, i) => t(`T${i}`, 4, 12 - Math.floor(i / 3), i < 8 ? 'R16' : i < 24 ? 'Playoffs' : 'Out')) };
  assert.ok(standingsRace(ucl, 'soccer', { total: 8 }).zones.every(z => !z.fight));
  const apart = { rows: [t('A', 4, 12, 'R16'), t('B', 4, 9, 'R16'), t('C', 4, 8, ''), t('D', 4, 1, 'Out'), t('E', 4, 0, 'Out')] };
  assert.deepEqual(standingsRace(apart, 'soccer', { total: 8 }).zones[0].fight.rows.map(x => x.id), ['B', 'C'], 'A is four clear of the first side out');
});
