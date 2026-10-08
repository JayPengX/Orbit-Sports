import test from 'node:test';
import assert from 'node:assert/strict';
import { playoffModel, openRound, stageKey } from '../public/lib/playoffs.mjs';

const rows = (p, n) => Array.from({ length: n }, (_, i) => ({ id: `${p}${i + 1}`, name: `${p}${i + 1}`, short: `${p}${i + 1}`, logo: '', stats: { GP: '20' } }));
const seeds = t => t.sides.map((s, i) => (s ? `${s.id}` : `(${t.labels[i]})`)).join(' v ');

test('MLB predicted from the table: 3 v 6 and 4 v 5 a league, 1 and 2 waiting', () => {
  const m = playoffModel({ league: 'mlb', mode: 'projected', groups: [{ en: 'American League', rows: rows('A', 15) }, { en: 'National League', rows: rows('N', 15) }] });
  assert.deepEqual(m.rounds.map(r => r.key), ['RD16', 'QTR', 'SEMI', 'FINAL']);
  assert.deepEqual(m.rounds[0].ties.map(seeds), ['A3 v A6', 'A4 v A5', 'N3 v N6', 'N4 v N5']);
  assert.deepEqual(m.rounds[1].ties.map(seeds), ['A1 v (4/5 勝者)', 'A2 v (3/6 勝者)', 'N1 v (4/5 勝者)', 'N2 v (3/6 勝者)']);
  assert.equal(m.rounds[2].ties[0], null);
});

test('NBA and MLS: each conference by seed', () => {
  const g = [{ en: 'Eastern Conference', rows: rows('E', 15) }, { en: 'Western Conference', rows: rows('W', 15) }];
  const nba = playoffModel({ league: 'nba', mode: 'projected', groups: g });
  assert.deepEqual(nba.rounds.map(r => r.key), ['PLAYIN', 'RD16', 'QTR', 'SEMI', 'FINAL']);
  assert.deepEqual(nba.rounds[0].ties.map(seeds), ['E7 v E8', 'E9 v E10', '(7/8 敗者) v (9/10 勝者)', 'W7 v W8', 'W9 v W10', '(7/8 敗者) v (9/10 勝者)']);
  assert.deepEqual(nba.rounds[1].ties.slice(0, 4).map(seeds), ['E1 v E8', 'E4 v E5', 'E3 v E6', 'E2 v E7']);
  const mls = playoffModel({ league: 'mls', mode: 'projected', groups: g });
  assert.deepEqual(mls.rounds[0].ties.map(seeds), ['E8 v E9', 'W8 v W9']);
  assert.equal(seeds(mls.rounds[1].ties[0]), 'E1 v (8/9 勝者)');
});

test("A cup's league phase: 9-24 play off, 1-8 wait; its rounds dated from the calendar", () => {
  const stages = [{ label: 'League Phase', start: '2026-08-27T07:00Z', end: '2027-02-15T07:59Z' }, { label: 'Knockout Round Playoffs', start: '2027-02-15T08:00Z', end: '2027-03-08T07:59Z' }, { label: 'Rd of 16', start: '2027-03-08T08:00Z', end: '2027-04-05T06:59Z' }];
  const m = playoffModel({ league: 'ucl', mode: 'projected', groups: [{ en: 'League Phase', rows: rows('T', 36) }], stages, now: Date.parse('2026-10-03T00:00Z') });
  assert.deepEqual(m.rounds[0].ties.slice(0, 2).map(seeds), ['T9 v T24', 'T10 v T23']);
  assert.equal(seeds(m.rounds[1].ties[0]), 'T1 v (附加賽勝者)');
  assert.equal(m.rounds[1].dates.from, Date.parse('2027-03-08T08:00Z'));
  assert.equal(m.rounds[0].state, 'later');
  assert.equal(openRound(m), 1);
  assert.equal(stageKey('Rd of 16'), 'round-of-16');
});

test("The Nations League: League A's winners v another group's runners-up", () => {
  const g = ['A1', 'A2', 'A3', 'A4', 'B1'].map(n => ({ en: `Group ${n}`, rows: rows(n, 4) }));
  const m = playoffModel({ league: 'nationsleague', mode: 'projected', groups: g });
  assert.deepEqual(m.rounds[0].ties.map(seeds), ['A11 v A22', 'A21 v A12', 'A31 v A42', 'A41 v A32']);
  assert.deepEqual(m.rounds[0].ties[0].labels, ['A1 組', 'A2 組']);
});

test('NBA: the play-in its own column before the first round, each game a tie of its own', async () => {
  const { parseScoreboard } = await import('../public/lib/espn.mjs');
  const game = (id, date, note, home, away, homeWon) => ({ id, date, season: { year: 2026, type: 5, slug: 'play-in-season' }, status: { type: { state: 'post', completed: true } }, competitions: [{ type: { abbreviation: 'STD' }, notes: [{ headline: note }], competitors: [{ homeAway: 'home', winner: homeWon, score: homeWon ? '110' : '100', team: { id: home, abbreviation: home, displayName: home, shortDisplayName: home } }, { homeAway: 'away', winner: !homeWon, score: homeWon ? '100' : '110', team: { id: away, abbreviation: away, displayName: away, shortDisplayName: away } }] }] });
  const events = parseScoreboard({ events: [
    game('1', '2026-04-14T23:00Z', 'NBA Play-In - East - 9th Place vs 10th Place', 'CHA', 'MIA', true),
    game('2', '2026-04-15T23:00Z', 'NBA Play-In - East - 7th Place vs 8th Place', 'PHI', 'ORL', true),
    game('3', '2026-04-17T23:00Z', 'NBA Play-In - East - 8th Seed Game', 'ORL', 'CHA', true)
  ] }, 'nba');
  assert.deepEqual(events.map(e => e.round?.key), ['PLAYIN', 'PLAYIN', 'PLAYIN']);
  const m = playoffModel({ league: 'nba', events });
  assert.equal(m.rounds[0].title.zh, '附加賽');
  const ties = m.rounds[0].ties.filter(Boolean);
  assert.equal(ties.length, 3);
  assert.deepEqual(ties.map(t => t.winner).sort(), ['CHA', 'ORL', 'PHI']);
  assert.equal(m.rounds[0].state, 'on');
});
