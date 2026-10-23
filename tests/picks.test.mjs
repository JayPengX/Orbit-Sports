import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreMatch, dayPlan, clash, tableIndex, tableStarted, bigGame, watchedLeagues, leagueChoices } from '../public/lib/picks.mjs';

const at = h => new Date(Date.UTC(2026, 9, 3, h)).toISOString();
const side = (id, name) => ({ id, name, short: name });
const match = (league, id, h, away, home, extra = {}) => ({ id, league, kind: 'match', start: at(h), status: { state: 'pre' }, away, home, ...extra });
const NOW = Date.UTC(2026, 9, 3, 0);

test('a followed team outweighs everything; the first league counts more', () => {
  const ctx = { leagues: ['mlb', 'epl'], follows: [{ league: 'epl', id: '1', name: 'Arsenal' }], now: NOW };
  const ars = scoreMatch(match('epl', 'a', 11, side('1', 'Arsenal'), side('2', 'Fulham')), ctx);
  const mlb = scoreMatch(match('mlb', 'b', 11, side('3', 'Mets'), side('4', 'Braves')), ctx);
  const epl = scoreMatch(match('epl', 'c', 11, side('5', 'Brentford'), side('6', 'Everton')), ctx);
  assert.ok(ars.score > mlb.score);
  assert.equal(ars.reasons[0], 'team');
  assert.ok(mlb.score > epl.score, 'MLB comes first for this person');
  assert.ok(mlb.reasons.includes('priority'));
});

test('the table: a meeting at the top beats the bottom', () => {
  const tables = { epl: tableIndex([{ rows: Array.from({ length: 20 }, (_, i) => ({ id: String(i + 1) })) }]) };
  const ctx = { leagues: ['epl'], tables, now: NOW };
  const top = scoreMatch(match('epl', 'a', 11, side('1', 'A'), side('2', 'B')), ctx);
  const low = scoreMatch(match('epl', 'b', 11, side('19', 'S'), side('20', 'T')), ctx);
  assert.ok(top.score > low.score);
  assert.ok(top.reasons.includes('topClash'));
  assert.ok(low.reasons.includes('close'));
});

test('the plan never clashes, and runs in time order', () => {
  const ctx = { leagues: ['epl', 'nba'], now: NOW };
  const events = [
    match('epl', 'a', 11, side('1', 'A'), side('2', 'B')),
    match('epl', 'b', 11, side('3', 'C'), side('4', 'D')),
    match('epl', 'c', 14, side('5', 'E'), side('6', 'F')),
    match('nba', 'd', 23, side('7', 'G'), side('8', 'H')),
    match('epl', 'x', 9, side('9', 'I'), side('10', 'J'), { status: { state: 'post' } })
  ];
  const { plan, also } = dayPlan(events, ctx);
  for (let i = 0; i < plan.length; i++) for (let j = i + 1; j < plan.length; j++) assert.equal(clash(plan[i].event, plan[j].event), false);
  assert.deepEqual(plan.map(p => p.event.start), [...plan.map(p => p.event.start)].sort());
  assert.equal(plan.length, 3);
  assert.equal(also.length, 1);
  assert.ok(!plan.concat(also).some(p => p.event.id === 'x'), 'finished games are not picks');
});

test('a play-off or series game is worth staying up for', () => {
  assert.ok(bigGame({ note: 'NLWC - Game 3', stage: { key: 'post' } }));
  assert.ok(!bigGame({ note: '', stage: { key: 'regular' } }));
});


test('live: a close game late on is the one to switch to, a rout drops; evenings beat working hours', () => {
  const ctx = { leagues: ['nba', 'mlb'], now: NOW };
  const live = (league, id, period, hs, as) => match(league, id, 0, { ...side('1', 'A'), score: String(as) }, { ...side('2', 'B'), score: String(hs) }, { status: { state: 'in', period } });
  const tight = scoreMatch(live('mlb', 'a', 8, 3, 2), ctx);
  const rout = scoreMatch(live('mlb', 'b', 8, 10, 1), ctx);
  const early = scoreMatch(live('mlb', 'c', 2, 1, 0), ctx);
  assert.ok(tight.score > early.score && early.score > rout.score);
  assert.deepEqual(tight.reasons.slice(0, 2), ['live', 'tight']);
  // Friday 3 Oct 2026, Taiwan time: 20:00 against 11:00.
  const evening = scoreMatch(match('mlb', 'd', 12, side('1', 'A'), side('2', 'B')), ctx);
  const office = scoreMatch(match('mlb', 'e', 3, side('1', 'A'), side('2', 'B')), ctx);
  assert.ok(evening.score > office.score);
});

test('a table before its first game gives no places (a preseason: every row 0-0)', () => {
  const zero = [{ name: 'East', rows: [{ id: 'atl', stats: { W: '0', L: '0', GB: '-' } }, { id: 'bos', stats: { W: '0', L: '0', GB: '-' } }] }];
  assert.equal(tableStarted(zero[0]), false);
  assert.deepEqual(tableIndex(zero), {});
  const begun = [{ name: 'East', rows: [{ id: 'bos', stats: { W: '1', L: '0' } }, { id: 'atl', stats: { W: '0', L: '1' } }] }];
  assert.equal(tableIndex(begun).atl.pos, 2);
  // A table without counts (a driver's points) is never held back.
  assert.equal(tableStarted({ rows: [{ id: 'x', stats: { PTS: '0' } }] }), true);
});

test('a match followed on its own comes first, with its reason', () => {
  const a = match('nba', 'g1', 12, side('1', 'Hawks'), side('2', 'Celtics'));
  const b = match('nba', 'g2', 12, side('3', 'Lakers'), side('4', 'Warriors'));
  const ctx = { leagues: ['nba'], games: ['nba:g1'], now: NOW };
  assert.ok(scoreMatch(a, ctx).score > scoreMatch(b, ctx).score + 1);
  assert.ok(scoreMatch(a, ctx).reasons.includes('game'));
  assert.ok(!scoreMatch(b, ctx).reasons.includes('game'));
});

test("a followed race weekend counts for each of its sessions", () => {
  const race = { id: '600~Race', weekend: '600', league: 'f1', kind: 'field', start: at(12), status: { state: 'pre' } };
  const other = { ...race, id: '601~Race', weekend: '601' };
  const ctx = { leagues: ['f1'], games: ['f1:600'], now: NOW };
  assert.ok(scoreMatch(race, ctx).reasons.includes('game'));
  assert.ok(!scoreMatch(other, ctx).reasons.includes('game'));
});

test('an F1 session takes its own length: qualifying (an hour) runs into no 22:00 kick-off', async () => {
  const { clash } = await import('../public/lib/picks.mjs');
  const quali = { league: 'f1', kind: 'field', sessionKey: 'Qual', start: '2026-10-10T13:00:00Z' };
  const epl = { league: 'epl', kind: 'match', start: '2026-10-10T14:00:00Z' };
  assert.equal(clash(quali, epl), false);
  // Two sports clash only when they start together.
  assert.equal(clash({ ...quali, sessionKey: 'Race' }, { ...epl, start: '2026-10-10T13:15:00Z' }), true);
});

test('a World Series game at 08:00 and an NBA one at 09:30 are both picks; two NBA games an hour apart are not', () => {
  const mlb = { id: 'ws1', league: 'mlb', kind: 'match', start: '2026-10-24T00:00:00Z', status: { state: 'pre' }, note: 'World Series - Game 1', away: { id: '1', name: 'A' }, home: { id: '2', name: 'B' } };
  const nba = { id: 'n1', league: 'nba', kind: 'match', start: '2026-10-24T01:30:00Z', status: { state: 'pre' }, away: { id: '3', name: 'C' }, home: { id: '4', name: 'D' } };
  assert.equal(clash(mlb, nba), false);
  assert.equal(clash(nba, { ...nba, id: 'n2', start: '2026-10-24T02:30:00Z' }), true);
  const { plan } = dayPlan([mlb, nba], { leagues: ['nba', 'mlb'], now: Date.parse('2026-10-23T12:00:00Z') });
  assert.deepEqual(plan.map(p => p.event.id), ['ws1', 'n1']);
});

test("seven games in, the table counts for a share; the broadcaster's pick of the games then counts more", () => {
  const side = id => ({ id, name: id });
  const game = (id, away, home) => ({ id, league: 'epl', kind: 'match', start: '2026-10-10T14:00:00Z', status: { state: 'pre' }, away: side(away), home: side(home) });
  const row = (pos, gp) => ({ pos, n: 20, gp });
  const early = { epl: { BHA: row(3, 7), SUN: row(14, 7), CHE: row(10, 7), BOU: row(17, 7) } };
  const ctx = { leagues: ['epl'], tables: early, now: Date.parse('2026-10-08T12:00:00Z') };
  const bha = game('1', 'BHA', 'SUN');
  const che = game('2', 'BOU', 'CHE');
  const gap = (c, t) => scoreMatch(bha, { ...ctx, tables: t, featured: c }).score - scoreMatch(che, { ...ctx, tables: t, featured: c }).score;
  // The table alone still prefers Brighton's game, by less than a full season's table would.
  const late = { epl: Object.fromEntries(Object.entries(early.epl).map(([k, r]) => [k, { ...r, gp: 30 }])) };
  assert.ok(gap(null, early) > 0 && gap(null, early) < gap(null, late));
  // ELTA's main channel for Chelsea's: that one first.
  const elta = e => e.id === '2';
  assert.ok(gap(elta, early) < 0);
  assert.ok(scoreMatch(che, { ...ctx, featured: elta }).reasons.includes('featured'));
  // No "前段班對決" from a table seven games old.
  const top = { epl: { BHA: row(3, 7), SUN: row(2, 7) } };
  assert.ok(!scoreMatch(bha, { ...ctx, tables: top }).reasons.includes('topClash'));
});

// The bookmakers' prices say how open a game is (the owner, 2026-10-16): ESPN's 2026-10-17 odds.
test('favChance: the favourite’s chance from both moneylines and the draw, else soccer’s line', async () => {
  const { favChance } = await import('../public/lib/espn.mjs');
  const ml = (h, a) => ({ home: { close: { odds: h } }, away: { close: { odds: a } } });
  assert.equal(favChance({ odds: [{ details: 'MNC -425', moneyline: ml('-425', '+1000'), drawOdds: { moneyLine: 600 } }] }), 0.776);
  assert.equal(favChance({ odds: [{ details: 'BRE +140' }] }), 0.417);
  assert.equal(favChance({ odds: [{ details: 'ORL -2.5', moneyline: ml('-130', '+110') }] }), 0.543);
  assert.equal(favChance({ odds: [{ details: 'ORL -2.5' }] }), null, 'a spread is no price');
  assert.equal(favChance({}), null);
});

test('scoreMatch: an open game over a walkover at the same time, though the broadcaster put the walkover on its main channel', () => {
  const tables = { 'epl': Object.fromEntries(Object.entries({ mci: 1, brn: 4, liv: 9, ips: 10 }).map(([k, pos]) => [k, { pos, n: 20, gp: 6 }])) };
  const g = (id, home, away, fav) => ({ id, league: 'epl', kind: 'match', status: { state: 'pre' }, start: '2026-10-17T14:00:00Z', home: { id: home, name: home }, away: { id: away, name: away }, fav });
  const city = scoreMatch(g('1', 'mci', 'ips', 0.773), { leagues: ['epl'], tables, featured: () => true });
  const pool = scoreMatch(g('2', 'brn', 'liv', 0.399), { leagues: ['epl'], tables, featured: () => false });
  assert.ok(pool.score > city.score, `${pool.score} > ${city.score}`);
  assert.ok(pool.reasons.includes('close'));
});

test('clash: a baseball game at 08:00 and a basketball game at 10:30 are both watchable (2026-10-17, ALCS G4 then Nuggets v Lakers)', () => {
  const g = (league, start) => ({ id: league, league, kind: 'match', start, status: { state: 'pre' } });
  assert.equal(clash(g('mlb', '2026-10-17T00:00:00Z'), g('nba', '2026-10-17T02:30:00Z')), false);
  // An hour and a half apart is fine too across sports (the owner, 2026-10-21); together is not.
  assert.equal(clash(g('mlb', '2026-10-17T00:00:00Z'), g('nba', '2026-10-17T01:30:00Z')), false);
  assert.equal(clash(g('mlb', '2026-10-17T00:00:00Z'), g('nba', '2026-10-17T00:15:00Z')), true);
});

test('the day as it stood keeps a postponed pick and an ended one (they don’t vanish from 已結束的推薦)', () => {
  const ctx = { leagues: ['mlb'], now: NOW };
  const events = [
    match('mlb', 'pp', 0, side('1', 'Rays'), side('2', 'Guardians'), { status: { state: 'post', void: true, name: 'STATUS_POSTPONED' } }),
    match('mlb', 'f', 4, side('3', 'Mets'), side('4', 'Braves'), { status: { state: 'post', completed: true } })
  ];
  assert.equal(dayPlan(events, ctx).plan.length, 0, 'ahead: neither is a pick');
  const { plan } = dayPlan(events, ctx, { asStood: true });
  assert.deepEqual(plan.map(p => p.event.id), ['pp', 'f']);
  assert.equal(plan[0].event.status.void, true, 'shown as it is now: postponed');
});

test('a league followed as a league: the game of each hour it would be chosen, as strong as a followed team', () => {
  assert.deepEqual(watchedLeagues(['epl', 'nba', 'mlb'], [{ league: 'nba', id: '7', name: 'Lakers' }]), ['epl', 'mlb'], 'a league with a team followed goes by the team');
  const tables = { epl: tableIndex([{ rows: Array.from({ length: 20 }, (_, i) => ({ id: String(i + 1) })) }]) };
  // Saturday 22:00: three games; the bottom two on ELTA's main channel, the top two on MAX, one not on TV. Then 00:30: two on TV.
  const main = match('epl', 'm', 14, side('15', 'O'), side('16', 'P'));
  const max = match('epl', 'x', 14, side('1', 'A'), side('2', 'B'));
  const none = match('epl', 'n', 14, side('3', 'C'), side('4', 'D'));
  const late1 = match('epl', 'l1', 16, side('19', 'S'), side('20', 'T'), { start: new Date(Date.UTC(2026, 9, 3, 16, 30)).toISOString() });
  const late2 = match('epl', 'l2', 16, side('5', 'E'), side('6', 'F'), { start: new Date(Date.UTC(2026, 9, 3, 16, 30)).toISOString() });
  const nba = match('nba', 'k', 14, side('7', 'Lakers'), side('8', 'Suns'));
  const onTv = e => e.id !== 'n';
  const ctx = { leagues: ['epl', 'nba'], follows: [{ league: 'nba', id: '7', name: 'Lakers' }], tables, now: NOW, featured: e => e.id === 'm' };
  const chosen = leagueChoices([main, max, none, late1, late2, nba], { watched: ['epl'], onTv, ctx });
  assert.deepEqual([...chosen].sort(), ['epl:l2', 'epl:x'], 'the better matchup on TV (the main channel only a near tie’s decider); never the NBA (a team followed there)');
  // Live, a chosen game holds (scored as it stood before the start).
  const again = leagueChoices([main, max, { ...late1, status: { state: 'in', period: 2 }, home: { ...late1.home, score: '1' }, away: { ...late1.away, score: '1' } }, late2], { watched: ['epl'], onTv, ctx });
  assert.ok(again.has('epl:l2'));
  // A slot with nothing on TV: no choice. TV not known yet: the best anyway.
  assert.equal(leagueChoices([none], { watched: ['epl'], onTv, ctx }).size, 0);
  assert.equal(leagueChoices([none], { watched: ['epl'], onTv: () => false, tvKnown: () => false, ctx }).size, 1);
  // The small hours: never a choice.
  assert.equal(leagueChoices([main, max], { watched: ['epl'], onTv, awake: () => false, ctx }).size, 0);
  // The chosen game scores as a followed team's.
  const s = scoreMatch(max, { ...ctx, chosen: new Set(['epl:x']) });
  const t = scoreMatch(max, ctx);
  assert.equal(s.reasons[0], 'leagueGame');
  assert.ok(s.score - t.score >= 0.99);
});

test('the 22:00 game: Liverpool (5th) v Brighton (3rd) on MAX over Man United (13th) v Bournemouth (15th) on ELTA 2, whatever the habit', () => {
  const ids = ['382', '359', '331', '363', '364', '337', '357', '368', '306', '373', '361', '362', '360', '384', '349', '367', '388', '370', '393', '366'];
  const tables = { epl: tableIndex([{ rows: ids.map(id => ({ id, stats: { GP: '7' } })) }]) };
  const liv = match('epl', 'liv', 14, side('331', 'Brighton & Hove Albion'), side('364', 'Liverpool'), { fav: 0.465 });
  const mun = match('epl', 'mun', 14, side('360', 'AFC Bournemouth'), side('349', 'Manchester United'), { fav: 0.476 });
  const pal = match('epl', 'pal', 14, side('384', 'Newcastle United'), side('361', 'Crystal Palace'), { fav: 0.43 });
  const ctx = { leagues: ['epl'], tables, now: NOW, featured: e => e.id === 'mun', aff: { 'team:epl:manchester united': 5 } };
  assert.deepEqual([...leagueChoices([liv, mun, pal], { watched: ['epl'], ctx })], ['epl:liv']);
});

test("a holiday or a typhoon day off where the person works isn't working hours: its morning game counts as any day off's", async () => {
  const { keepDayOff, setPlace } = await import('#kit/dayoff.mjs');
  const ctx = { leagues: ['mlb'], now: Date.UTC(2026, 9, 9, 0) };
  const at11 = day => ({ id: day, league: 'mlb', kind: 'match', start: `${day}T03:00:00Z`, status: { state: 'pre' }, away: side('1', 'A'), home: side('2', 'B') });
  // Friday 9 Oct 2026 (國慶日補假), Saturday 10th, Thursday 8th (a workday).
  const holiday = scoreMatch(at11('2026-10-09'), ctx).score;
  assert.equal(holiday, scoreMatch(at11('2026-10-10'), ctx).score);
  assert.ok(scoreMatch(at11('2026-10-08'), ctx).score < holiday);
  // Thursday 22 Oct: 新竹 off for the typhoon.
  const place = { county: '新竹市', town: '東區' };
  keepDayOff(place, { '2026-10-22': { work: { off: true, from: null } } });
  const before = scoreMatch(at11('2026-10-22'), ctx).score;
  const mem = new Map();
  globalThis.localStorage ??= { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
  setPlace('work', place);
  assert.ok(scoreMatch(at11('2026-10-22'), ctx).score > before, 'a typhoon day off where they work');
});
