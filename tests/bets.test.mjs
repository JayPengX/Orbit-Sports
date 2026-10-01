// Bets on Fixtures' picks (lib/bets.mjs): every kind found on its event;
// championships on the games that decide them; settled bets drop; one
// game, one entry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legEvent, betsByEvent, legLeagues, seriesStakes, pointsStakes, tableStakes, f1Stakes, titleStakes } from '../public/lib/bets.mjs';
import { playGameId } from '../public/lib/espn.mjs';

const at = (d, h) => new Date(Date.UTC(2026, 9, d, h)).toISOString();
const side = (id, name, extra = {}) => ({ id, name, en: name, ...extra });
const game = (id, d, h, away, home, extra = {}) => ({ id, league: 'mlb', kind: 'match', start: at(d, h), status: { state: 'pre' }, away, home, ...extra });
const LAD = side('19', 'Los Angeles Dodgers');
const SD = side('25', 'San Diego Padres');
// An NLDS, best of five, with the series as it stands.
const nlds = (n, wins, extra = {}) => game(`g${n}`, 3 + n, 0, SD, LAD, { note: `NLDS - Game ${n}`, stage: { key: 'post' }, series: { games: 5, wins }, ...extra });
const ws = { fk: 'ws', sp: 'mlb', k: 'future', tm: 'Los Angeles Dodgers', p: '洛杉磯道奇', slip: { id: 's1', m: 'single', l: [] } };

test('every kind of bet finds its event: a game by id, in play by time, F1 by its session, a tournament by its dates', () => {
  const nyy = game('a', 1, 0, side('2', 'Boston Red Sox'), side('10', 'New York Yankees'));
  const sdg = game('b', 1, 0, side('16', 'Chicago Cubs'), SD);
  const race = { id: '600~Race', weekend: '600', sessionKey: 'Race', league: 'f1', kind: 'field', start: at(4, 7), status: { state: 'pre' } };
  const qual = { ...race, id: '600~Qual', sessionKey: 'Qual', start: at(3, 8) };
  const open = { id: 'cn', league: 'atp', kind: 'draw', start: at(1, 0), end: at(10, 0), status: { state: 'in' } };
  const events = [nyy, sdg, race, qual, open];
  assert.equal(legEvent({ g: playGameId(nyy), sp: 'mlb', s: nyy.start }, events), nyy);
  assert.equal(legEvent({ g: 'live', sp: 'mlb', s: at(1, 0), p: 'San Diego Padres' }, events), sdg);
  // In Chinese, and with a team's short name on the event ("道奇" in "洛杉磯道奇").
  const lad = game('c', 2, 4, side('19', '道奇', { en: 'Los Angeles Dodgers' }), side('-1', 'Phillies/Braves'));
  const mil = game('d', 2, 4, side('8', '釀酒人', { en: 'Milwaukee Brewers' }), side('-2', 'Padres/Cubs'));
  assert.equal(legEvent({ g: 'live', sp: 'mlb', s: at(2, 4), p: '洛杉磯道奇' }, [mil, lad]), lad);
  // Can't tell: no guess.
  assert.equal(legEvent({ g: 'live', sp: 'mlb', s: at(2, 4), p: '大 8.5' }, [mil, lad]), null);
  assert.equal(legEvent({ g: 'f1', k: 'f1', sp: 'f1', s: at(4, 7) }, events), race);
  // Play's time a little off ESPN's: the nearest session.
  assert.equal(legEvent({ g: 'f1pole', k: 'f1pole', sp: 'f1', s: new Date(Date.parse(at(3, 8)) + 20 * 60_000).toISOString() }, events), qual);
  assert.equal(legEvent({ g: 'tennis_x', sp: 'tennis', s: at(5, 6), p: 'Sinner' }, events), open);
  assert.ok(['atp', 'f1'].every(k => legLeagues([{ sp: 'f1' }, { sp: 'tennis' }]).includes(k)));
});

test('a series game counts when it could decide it, from the series as it stands', () => {
  // Before a game is played, 0-0: games 3, 4 and 5 can decide it.
  assert.deepEqual([1, 2, 3, 4, 5].map(n => seriesStakes(nlds(n, { 19: 0, 25: 0 }), 'home')), [null, null, 'decides', 'decides', 'decides']);
  // 2-0 up: game 3 goes through with a win (exact: it's next).
  assert.equal(seriesStakes(nlds(3, { 19: 2, 25: 0 }), 'home'), 'advance');
  // 1-1: game 3 can't settle it; 4 and 5 can.
  assert.deepEqual([3, 4, 5].map(n => seriesStakes(nlds(n, { 19: 1, 25: 1 }), 'home')), [null, 'decides', 'decides']);
  // 1-2 down: game 4 is win or go home; 2-2: game 5 is everything.
  assert.equal(seriesStakes(nlds(4, { 19: 1, 25: 2 }), 'home'), 'out');
  assert.equal(seriesStakes(nlds(5, { 19: 2, 25: 2 }), 'home'), 'decider');
  // Over: nothing.
  assert.equal(seriesStakes(nlds(5, { 19: 3, 25: 1 }), 'home'), null);
  // A game played is judged as it stood before it (won 2-1 → it was 1-1 before game 3).
  assert.equal(seriesStakes(nlds(3, { 19: 2, 25: 1 }, { status: { state: 'post' }, home: { ...LAD, winner: true } }), 'home'), null);
  // Next round before its series is attached (the opponent TBD): from the
  // round's name, a best of five from 0-0.
  const tbd = n => game(`t${n}`, 6 + n, 0, side('-1', 'TBD'), LAD, { note: `NLDS - Game ${n}`, stage: { key: 'post' } });
  assert.deepEqual([1, 2, 3, 4, 5].map(n => seriesStakes(tbd(n), 'home')), [null, null, 'decides', 'decides', 'decides']);
  // The World Series: what can win it is 'title'; a one-game knockout is a decider.
  assert.equal(seriesStakes(game('w', 30, 0, side('5', 'Cleveland'), LAD, { note: 'World Series - Game 5', stage: { key: 'final' }, series: { games: 7, wins: { 19: 3, 5: 1 } } }), 'home', { title: /world series/i }), 'title');
  assert.equal(seriesStakes(game('wc', 1, 0, side('5', 'Cleveland'), LAD, { note: 'Wild Card', stage: { key: 'post' } }), 'home'), 'decider');
});

test('a points race: the round that could put them out, or settle it', () => {
  assert.equal(pointsStakes({ pts: 80, after: 3 }, [{ pts: 70, after: 3 }], 3), 'title');
  assert.equal(pointsStakes({ pts: 70, after: 3 }, [{ pts: 74, after: 3 }], 3), 'out');
  assert.equal(pointsStakes({ pts: 60, after: 30 }, [{ pts: 62, after: 30 }], 3), null);
  assert.equal(pointsStakes({ pts: 50, after: 3 }, [{ pts: 80, after: 3 }], 3), null, 'already out');
  // A league table: 20 teams, 38 games; two to play.
  const rows = [{ id: '1', pts: 85, gp: 36 }, { id: '2', pts: 80, gp: 36 }, ...Array.from({ length: 18 }, (_, i) => ({ id: String(i + 3), pts: 40, gp: 36 }))];
  const e = { league: 'epl', kind: 'match', status: { state: 'pre' }, home: side('1', 'Man City'), away: side('9', 'Fulham') };
  assert.equal(tableStakes(e, 'home', rows), 'title');
  assert.equal(tableStakes({ ...e, home: side('2', 'Arsenal') }, 'home', rows), 'out');
  // F1: a driver's lead with the weekends left (25 each, +8 with a sprint).
  const drivers = [{ name: 'Kimi Antonelli', en: 'Kimi Antonelli', pts: 302 }, { name: 'George Russell', en: 'George Russell', pts: 236 }];
  // (Three weekends left: Russell needs Antonelli to slip; with two he's already out of reach.)
  const three = [{ sprint: false }, { sprint: true }, { sprint: false }];
  assert.equal(f1Stakes('Andrea Kimi Antonelli', drivers, three), 'title');
  assert.equal(f1Stakes('George Russell', drivers, three), 'out');
  assert.equal(f1Stakes('George Russell', drivers, three.slice(1)), null);
  assert.equal(f1Stakes('Kimi Antonelli', drivers, Array.from({ length: 8 }, () => ({ sprint: false }))), null);
});

test('a championship bet shows on its deciding games; settled, it shows on nothing more', () => {
  const g3 = nlds(3, { 19: 2, 25: 0 });
  const g1 = nlds(1, { 19: 0, 25: 0 });
  assert.equal(titleStakes(ws, g3), 'advance');
  const { found } = betsByEvent([ws], [g1, g3]);
  assert.deepEqual([...found.keys()].map(e => e.id), ['g3']);
  assert.equal(found.get(g3)[0].stake, 'advance');
  // Settled (the team out, or champion): nothing.
  assert.equal(betsByEvent([{ ...ws, r: 'lost' }], [g3]).found.size, 0);
  assert.equal(betsByEvent([{ ...ws, slip: { ...ws.slip, st: 'won' } }], [g3]).found.size, 0);
});

test('one game, one entry: read twice and bet twice (a pick and a championship), and a settled slip keeps only what was played', () => {
  const g5 = nlds(5, { 19: 2, 25: 2 });
  const copy = { ...g5 };
  const pick = { g: playGameId(g5), sp: 'mlb', s: g5.start, p: 'Dodgers', k: 'ml', slip: { id: 's2', m: 'single', l: [] } };
  const { found } = betsByEvent([pick, pick, ws], [g5, copy]);
  assert.equal(found.size, 1);
  const [legs] = [...found.values()];
  assert.deepEqual(legs.map(l => l.k), ['ml', 'future']);
  // A parlay lost on its first leg: its later games drop, the one played stays.
  const done = { ...game('d1', 1, 0, side('2', 'Boston Red Sox'), side('10', 'New York Yankees')), status: { state: 'post' } };
  const later = game('d2', 6, 0, side('16', 'Chicago Cubs'), SD);
  const slip = { id: 's3', m: 'parlay', l: [{ r: 'lost' }, {}] };
  const r = betsByEvent([{ g: playGameId(done), sp: 'mlb', s: done.start, k: 'ml', r: 'lost', slip }, { g: playGameId(later), sp: 'mlb', s: later.start, k: 'ml', slip }], [done, later]);
  assert.deepEqual([...r.found.keys()].map(e => e.id), ['d1']);
  assert.equal(r.missing.length, 0);
});

test('a later round counts as if the team gets there: its side of the bracket, the games that could decide it', async () => {
  const { titleStake, bracketOf } = await import('../public/lib/bets.mjs');
  const { knockedOut } = await import('../public/lib/espn.mjs');
  const tbd = (id, d, note) => game(id, d, 0, side('-1', 'TBD'), side('-2', 'TBD'), { note, stage: { key: 'post' } });
  const data = { sides: { mlb: [{ name: '道奇', en: 'Los Angeles Dodgers', side: 'NL' }, { en: 'New York Yankees', side: 'AL' }] } };
  // NLCS (best of seven): games 4 to 7 could send them on; the ALCS isn't theirs.
  assert.deepEqual([1, 3, 4, 7].map(n => titleStake(ws, tbd(`n${n}`, 12 + n, `NLCS - Game ${n}`), data)), [null, null, { stake: 'decides', maybe: true }, { stake: 'decides', maybe: true }]);
  assert.equal(titleStake(ws, tbd('a4', 16, 'ALCS - Game 4'), data), null);
  // The World Series: games 4 to 7 could win it.
  assert.deepEqual(titleStake(ws, tbd('w4', 27, 'World Series - Game 4'), data), { stake: 'title', maybe: true });
  assert.equal(titleStake(ws, tbd('w2', 25, 'World Series - Game 2'), data), null);
  // A pennant bet: its championship series wins it; the World Series is past it.
  const nl = { ...ws, fk: 'nl' };
  assert.deepEqual(titleStake(nl, tbd('n5', 17, 'NLCS - Game 5'), data), { stake: 'title', maybe: true });
  assert.equal(titleStake(nl, tbd('w6', 30, 'World Series - Game 6'), data), null);
  // A slot naming its candidates: only theirs.
  const dsg = game('x', 6, 0, side('8', 'Milwaukee Brewers'), side('-2', 'Padres/Cubs'), { note: 'NLDS - Game 3', stage: { key: 'post' } });
  assert.equal(titleStake(ws, dsg, data), null);
  // Knocked out: no more "if they get there".
  assert.equal(titleStake(ws, tbd('w5', 28, 'World Series - Game 5'), { ...data, out: { 'ws:Los Angeles Dodgers': true } }), null);
  assert.deepEqual(['NLCS - Game 1', 'ALDS - Game 2', 'AFC Divisional', 'East Finals', 'NBA Finals'].map(bracketOf), ['NL', 'AL', 'AFC', 'E', '']);
  // Out: the last playoff game lost, none to come; a series won, or lost mid-way, isn't.
  const g = (d, w, state = 'post') => ({ start: at(d, 0), status: { state }, home: { id: '19', winner: w }, away: { id: '1', winner: state === 'post' && !w } });
  assert.equal(knockedOut([g(3, true), g(4, false)], '19'), true);
  assert.equal(knockedOut([g(3, false), g(4, true)], '19'), false);
  assert.equal(knockedOut([g(3, false), g(5, false, 'pre')], '19'), false);
});
