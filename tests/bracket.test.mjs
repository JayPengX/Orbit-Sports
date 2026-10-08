import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBracket } from '../public/lib/bracket.mjs';

const side = (id, score, winner = false) => ({ id, name: id, short: id, score: String(score), winner });
const game = (id, round, start, home, away, extra = {}) => ({ id, league: 'x', kind: 'match', start, status: { state: 'post' }, home, away, round, ...extra });

test('MLB: series by their wins, the rounds in the league shape, places for the ties to come', () => {
  const wc = { key: 'RD16', title: 'NLWC', leg: 0, through: [] };
  const ds = { key: 'QTR', title: 'NLDS', leg: 0, through: [] };
  const events = [
    game('1', wc, '2026-09-29T18:00Z', side('ATL', 3), side('PHI', 1), { series: { completed: false, wins: { ATL: 1, PHI: 0 } } }),
    game('2', wc, '2026-09-30T18:00Z', side('ATL', 2), side('PHI', 5), { series: { completed: false, wins: { ATL: 1, PHI: 1 } } }),
    game('3', wc, '2026-10-01T18:00Z', side('ATL', 4), side('PHI', 2), { series: { completed: true, wins: { ATL: 2, PHI: 1 } } }),
    game('4', ds, '2026-10-03T22:00Z', side('LAD', 0), side('ATL', 0), { status: { state: 'pre' }, series: { completed: false, wins: { LAD: 0, ATL: 0 } } })
  ];
  const b = buildBracket(events, 'mlb');
  assert.deepEqual(b.map(r => [r.key, r.title.zh, r.ties.length]), [['RD16', '外卡賽', 4], ['QTR', '分區系列賽', 4], ['SEMI', '聯盟冠軍賽', 2], ['FINAL', '世界大賽', 1]]);
  const wcTie = b[0].ties[0];
  assert.equal(wcTie.kind, 'series');
  assert.deepEqual(wcTie.score, { ATL: 2, PHI: 1 });
  assert.equal(wcTie.winner, 'ATL');
  assert.deepEqual(wcTie.sides.map(s => s.id), ['ATL', 'PHI']);
  const dsTie = b[1].ties[0];
  assert.equal(dsTie.winner, null);
  assert.equal(dsTie.next.id, '4');
  assert.equal(b[2].ties[0], null);
});

test('A cup: two legs on aggregate, who went through, the rounds after the last drawn', () => {
  const qf = { key: 'quarterfinals', title: 'Quarterfinals', leg: 1, through: [] };
  const qf2 = { ...qf, leg: 2, through: ['A'] };
  const events = [
    game('1', qf, '2026-04-07T19:00Z', side('B', 2), side('A', 1)),
    game('2', qf2, '2026-04-14T19:00Z', side('A', 2), side('B', 1)),
    game('3', qf, '2026-04-08T19:00Z', side('C', 0), side('D', 0)),
    game('4', { ...qf, leg: 2 }, '2026-04-15T19:00Z', side('D', 1), side('C', 3), { status: { state: 'in' } })
  ];
  const b = buildBracket(events, 'ucl');
  assert.deepEqual(b.map(r => [r.title.zh, r.ties.length]), [['八強', 2], ['決賽', 1]]);
  const [ab, cd] = b[0].ties;
  assert.equal(ab.kind, 'agg');
  assert.deepEqual(ab.score, { B: 3, A: 3 });
  assert.equal(ab.winner, 'A');
  assert.equal(cd.live, true);
  assert.equal(cd.winner, null);
  assert.deepEqual(cd.score, { C: 3, D: 1 });
});

test('MLB: a series won goes on to the next round at once, against both sides still playing for the other place', () => {
  const ds = (h, a, game, wins, completed = false, state = 'post') => ({ id: `${h}${a}${game}`, league: 'mlb', kind: 'match', start: `2026-10-0${game + 2}T22:00Z`, status: { state }, note: `NLDS - Game ${game}`, home: { ...side(h, 0), abbr: h }, away: { ...side(a, 0), abbr: a }, round: { key: 'QTR', title: 'Playoff Series', leg: 0, through: [] }, series: { completed, wins } });
  const tbd = (abbr, id) => ({ id: String(id), name: abbr, short: abbr, abbr });
  const cs = (id, start, note, home, away) => ({ id, league: 'mlb', kind: 'match', start, status: { state: 'pre' }, note, home, away, round: { key: 'SEMI', title: note.replace(/ - .*/, ''), leg: 0, through: [] } });
  const events = [
    ds('LAD', 'ATL', 1, { LAD: 1, ATL: 0 }),
    ds('ATL', 'LAD', 4, { LAD: 3, ATL: 1 }, true),
    ds('MIL', 'SD', 1, { MIL: 1, SD: 0 }),
    ds('SD', 'MIL', 4, { MIL: 2, SD: 1 }, false, 'in'),
    { ...ds('TB', 'NYY', 3, { TB: 3, NYY: 0 }, true), note: 'ALDS - Game 3' },
    { ...ds('CLE', 'CHW', 3, { CHW: 2, CLE: 1 }), note: 'ALDS - Game 3' },
    // ESPN's: the NLCS between two TBDs; the ALCS, TB against "CLE/CHW" (its id changing game to game).
    cs('n1', '2026-10-11T04:00Z', 'NLCS - Game 1', tbd('TBD', -1), tbd('TBD', -2)),
    cs('n2', '2026-10-12T04:00Z', 'NLCS - Game 2', tbd('TBD', -1), tbd('TBD', -2)),
    cs('a1', '2026-10-12T04:00Z', 'ALCS - Game 1', { ...side('TB', 0), abbr: 'TB' }, tbd('CLE/CHW', -2)),
    cs('a3', '2026-10-15T04:00Z', 'ALCS - Game 3', tbd('CLE/CHW', -1), { ...side('TB', 0), abbr: 'TB' })
  ];
  const semi = buildBracket(events, 'mlb')[2];
  const show = t => t.sides.map((s, i) => s?.id || t.options[i].map(x => x.id).join('/'));
  assert.equal(semi.ties.length, 2);
  assert.ok(semi.ties.every(t => t.pending && !t.winner));
  const nl = semi.ties.find(t => t.next.id === 'n1');
  const al = semi.ties.find(t => t.next.id === 'a1');
  assert.deepEqual(show(nl), ['LAD', 'MIL/SD']);
  assert.deepEqual(show(al), ['TB', 'CLE/CHW']);
});

test('A round with no games yet: the two winners of a half meet; one undecided feeder is not a tie yet', () => {
  const g = (id, h, a, note, wins, completed) => ({ id, league: 'mlb', kind: 'match', start: '2026-10-05T22:00Z', status: { state: 'post' }, note, home: { ...side(h, 0), abbr: h }, away: { ...side(a, 0), abbr: a }, round: { key: 'QTR', title: 'Playoff Series', leg: 0, through: [] }, series: { completed, wins } });
  const both = buildBracket([g('1', 'LAD', 'ATL', 'NLDS - Game 4', { LAD: 3, ATL: 1 }, true), g('2', 'MIL', 'SD', 'NLDS - Game 4', { MIL: 3, SD: 1 }, true), g('3', 'TB', 'NYY', 'ALDS - Game 3', { TB: 3 }, true), g('4', 'CLE', 'CHW', 'ALDS - Game 3', { CHW: 2, CLE: 1 }, false)], 'mlb')[2];
  assert.deepEqual(both.ties.filter(Boolean).map(t => t.sides.map((s, i) => s?.id || t.options[i].map(x => x.id).join('/'))), [['LAD', 'MIL'], ['TB', 'CLE/CHW']]);
  const one = buildBracket([g('1', 'LAD', 'ATL', 'NLDS - Game 4', { LAD: 3, ATL: 1 }, true)], 'mlb')[2];
  assert.ok(one.ties.every(t => t === null));
});

test('A tie’s games from a nightly copy ("TBD v TBD") and the live list ("TB v CLE/CHW"): one place, from its first game', () => {
  const ds = (h, a, wins, completed) => ({ id: h + a, league: 'mlb', kind: 'match', start: '2026-10-07T22:00Z', status: { state: 'post' }, note: 'ALDS - Game 3', home: { ...side(h, 0), abbr: h }, away: { ...side(a, 0), abbr: a }, round: { key: 'QTR', title: 'Playoff Series', leg: 0, through: [] }, series: { completed, wins } });
  const ph = (abbr, id) => ({ id: String(id), name: abbr, short: abbr, abbr });
  const cs = (id, start, home, away) => ({ id, league: 'mlb', kind: 'match', start, status: { state: 'pre' }, note: `ALCS - Game ${id}`, home, away, round: { key: 'SEMI', title: 'ALCS', leg: 0, through: [] } });
  const tb = { ...side('TB', 0), abbr: 'TB' };
  const semi = buildBracket([ds('NYY', 'TB', { TB: 3, NYY: 0 }, true), ds('CHW', 'CLE', { CHW: 2, CLE: 1 }, false), cs('1', '2026-10-12T04:00Z', ph('TBD', -1), ph('TBD', -2)), cs('3', '2026-10-15T04:00Z', ph('CLE/CHW', -1), tb), cs('4', '2026-10-16T04:00Z', ph('CLE/CHW', -1), tb)], 'mlb')[2];
  const real = semi.ties.filter(Boolean);
  assert.equal(real.length, 1);
  assert.deepEqual(real[0].sides.map((s, i) => s?.id || real[0].options[i].map(x => x.id).join('/')), ['TB', 'CHW/CLE']);
  assert.equal(real[0].next.id, '1');
});
