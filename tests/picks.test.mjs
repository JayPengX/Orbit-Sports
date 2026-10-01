import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreMatch, dayPlan, clash, tableIndex, bigGame } from '../public/lib/picks.mjs';

const at = h => new Date(Date.UTC(2026, 9, 3, h)).toISOString();
const side = (id, name) => ({ id, name, short: name });
const match = (league, id, h, away, home, extra = {}) => ({ id, league, kind: 'match', start: at(h), status: { state: 'pre' }, away, home, ...extra });
const NOW = Date.UTC(2026, 9, 3, 0);

test('a followed team outweighs everything; the first sport counts more', () => {
  const ctx = { sports: ['baseball', 'soccer'], leagues: ['mlb', 'epl'], follows: [{ league: 'epl', id: '1', name: 'Arsenal' }], now: NOW };
  const ars = scoreMatch(match('epl', 'a', 11, side('1', 'Arsenal'), side('2', 'Fulham')), ctx);
  const mlb = scoreMatch(match('mlb', 'b', 11, side('3', 'Mets'), side('4', 'Braves')), ctx);
  const epl = scoreMatch(match('epl', 'c', 11, side('5', 'Brentford'), side('6', 'Everton')), ctx);
  assert.ok(ars.score > mlb.score);
  assert.equal(ars.reasons[0], 'team');
  assert.ok(mlb.score > epl.score, 'baseball comes first for this person');
  assert.ok(mlb.reasons.includes('priority'));
});

test('the table: a meeting at the top beats the bottom', () => {
  const tables = { epl: tableIndex([{ rows: Array.from({ length: 20 }, (_, i) => ({ id: String(i + 1) })) }]) };
  const ctx = { sports: ['soccer'], tables, now: NOW };
  const top = scoreMatch(match('epl', 'a', 11, side('1', 'A'), side('2', 'B')), ctx);
  const low = scoreMatch(match('epl', 'b', 11, side('19', 'S'), side('20', 'T')), ctx);
  assert.ok(top.score > low.score);
  assert.ok(top.reasons.includes('topClash'));
  assert.ok(low.reasons.includes('close'));
});

test('the plan never clashes, and runs in time order', () => {
  const ctx = { sports: ['soccer', 'basketball'], now: NOW };
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

test('games bet on are in the plan on top of the picks, never pushing one out', () => {
  const ctx = { sports: ['soccer'], now: NOW };
  const events = [
    match('epl', 'a', 11, side('1', 'A'), side('2', 'B')),
    match('epl', 'c', 14, side('5', 'E'), side('6', 'F')),
    // Bet on, and at the same time as the first pick: in anyway.
    match('mlb', 'bet', 11, side('7', 'Phillies'), side('8', 'Braves'))
  ];
  const plain = dayPlan(events, ctx, { n: 2 });
  const { plan } = dayPlan(events, ctx, { n: 2, keep: new Set(['mlb:bet']) });
  assert.deepEqual(plan.filter(p => !p.bet).map(p => p.event.id), plain.plan.map(p => p.event.id));
  const bet = plan.find(p => p.event.id === 'bet');
  assert.equal(bet.bet, true);
  assert.equal(bet.reasons[0], 'bet');
  assert.equal(plan.length, 3);
});

test('a play-off or series game is worth staying up for', () => {
  assert.ok(bigGame({ note: 'NLWC - Game 3', stage: { key: 'post' } }));
  assert.ok(!bigGame({ note: '', stage: { key: 'regular' } }));
});

test('a bet finds its game: by Play id, or (bet in play, no id) by league and start, the pick telling two apart', async () => {
  const { legEvent, betsByEvent, legLeagues } = await import('../public/lib/bets.mjs');
  const { playGameId } = await import('../public/lib/espn.mjs');
  const nyy = match('mlb', 'g1', 0, side('1', 'Boston Red Sox'), side('2', 'New York Yankees'));
  const sd = match('mlb', 'g2', 0, side('3', 'Chicago Cubs'), side('4', 'San Diego Padres'));
  const late = match('mlb', 'g3', 2, side('5', 'Philadelphia Phillies'), side('6', 'Atlanta Braves'));
  const events = [nyy, sd, late];
  assert.equal(legEvent({ g: playGameId(late), s: late.start, sp: 'mlb', p: 'x' }, events), late);
  // In play: no id. Two games at that hour: the pick's name decides.
  assert.equal(legEvent({ g: 'live', s: at(0), sp: 'mlb', p: 'San Diego Padres' }, events), sd);
  assert.equal(legEvent({ g: 'live', s: at(2), sp: 'mlb', p: '費城人' }, events), late);
  assert.equal(legEvent({ g: 'live', s: at(5), sp: 'mlb', p: 'x' }, events), null);
  const { found, missing } = betsByEvent([{ g: 'live', s: at(2), sp: 'mlb', p: 'a' }, { g: 'live', s: at(1), sp: 'wnba', p: 'b' }], events);
  assert.deepEqual([...found.keys()], [late]);
  assert.equal(missing.length, 1);
  assert.ok(legLeagues(missing).includes('wnba'));
});
