import test from 'node:test';
import assert from 'node:assert/strict';
import { playoffModel, openRound, stageKey } from '../public/lib/playoffs.mjs';
import { nbaCupRound } from '../public/lib/nbacup.mjs';

const rows = (p, n) => Array.from({ length: n }, (_, i) => ({ id: `${p}${i + 1}`, name: `${p}${i + 1}`, short: `${p}${i + 1}`, logo: '', stats: { GP: '20' } }));
const seeds = t => t.sides.map((s, i) => (s ? `${s.id}` : `(${t.labels[i]})`)).join(' v ');

test('MLB predicted from the table: 3 v 6 and 4 v 5 a league, 1 and 2 waiting', () => {
  const m = playoffModel({ league: 'mlb', mode: 'projected', groups: [{ en: 'American League', rows: rows('A', 15) }, { en: 'National League', rows: rows('N', 15) }] });
  assert.deepEqual(m.rounds.map(r => r.key), ['RD16', 'QTR', 'SEMI', 'FINAL']);
  assert.deepEqual(m.rounds[0].ties.map(seeds), ['A4 v A5', 'A3 v A6', 'N4 v N5', 'N3 v N6']);
  assert.deepEqual(m.rounds[1].ties.map(seeds), ['A1 v (4/5 勝者)', 'A2 v (3/6 勝者)', 'N1 v (4/5 勝者)', 'N2 v (3/6 勝者)']);
  assert.equal(m.rounds[2].ties[0], null);
});

test('NBA and MLS: each conference by seed', () => {
  const g = [{ en: 'Eastern Conference', rows: rows('E', 15) }, { en: 'Western Conference', rows: rows('W', 15) }];
  const nba = playoffModel({ league: 'nba', mode: 'projected', groups: g });
  // The play-in in the bracket (Jay, 2026-10-23): one column before the first round, each game beside where it goes.
  assert.deepEqual(nba.rounds.map(r => r.key), ['PLAYIN', 'RD16', 'QTR', 'SEMI', 'FINAL']);
  const tie = t => (t.gap ? '—' : seeds(t));
  assert.deepEqual(nba.rounds[0].ties.map(tie), ['—', 'E7 v E8', '(7/8 敗者) v (9/10 勝者)', 'E9 v E10', '—', 'W7 v W8', '(7/8 敗者) v (9/10 勝者)', 'W9 v W10']);
  // The 8th seed game by the teams that could play it (logos: 7 v 8's loser, 9 v 10's winner), and what each game means.
  assert.deepEqual(nba.rounds[0].ties[2].options.map(o => o.map(x => x.id).join('/')), ['E7/E8', 'E9/E10']);
  assert.equal(nba.rounds[0].ties[1].outcome.zh, '勝者 7 種子・敗者再戰');
  assert.deepEqual(nba.rounds[1].ties.slice(0, 4).map(seeds), ['E3 v E6', 'E2 v (7/8 勝者)', 'E1 v (附加賽)', 'E4 v E5']);
  // 7 v 8: its winner to 2 v 7, its loser up to the 8th seed game; 9 v 10 down to it; that to 1 v 8.
  assert.deepEqual(nba.rounds[0].ties[1].feeds, [{ to: [1, 1] }, { to: [0, 2] }]);
  assert.deepEqual(nba.rounds[0].ties[3].feeds, [{ to: [0, 2] }]);
  assert.deepEqual(nba.rounds[0].ties[6].feeds, [{ to: [1, 6] }]);
  const mls = playoffModel({ league: 'mls', mode: 'projected', groups: g });
    assert.equal(seeds(mls.rounds[1].ties[0]), 'E1 v (8/9 勝者)');
  // The wild card beside the place it plays for, the rows between empty.
  assert.deepEqual(mls.rounds[0].ties.map(t => (t.gap ? '—' : seeds(t))), ['E8 v E9', '—', '—', '—', 'W8 v W9', '—', '—', '—']);
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

test('NBA: the play-in in the bracket, each conference its 9 v 10, 8th seed game and 7 v 8', async () => {
  const { parseScoreboard } = await import('../public/lib/espn.mjs');
  const game = (id, date, note, home, away, homeWon) => ({ id, date, season: { year: 2026, type: 5, slug: 'play-in-season' }, status: { type: { state: 'post', completed: true } }, competitions: [{ type: { abbreviation: 'STD' }, notes: [{ headline: note }], competitors: [{ homeAway: 'home', winner: homeWon, score: homeWon ? '110' : '100', team: { id: home, abbreviation: home, displayName: home, shortDisplayName: home } }, { homeAway: 'away', winner: !homeWon, score: homeWon ? '100' : '110', team: { id: away, abbreviation: away, displayName: away, shortDisplayName: away } }] }] });
  const events = parseScoreboard({ events: [
    game('1', '2026-04-14T23:00Z', 'NBA Play-In - East - 9th Place vs 10th Place', 'CHA', 'MIA', true),
    game('2', '2026-04-15T23:00Z', 'NBA Play-In - East - 7th Place vs 8th Place', 'PHI', 'ORL', true),
    game('3', '2026-04-17T23:00Z', 'NBA Play-In - East - 8th Seed Game', 'ORL', 'CHA', true)
  ] }, 'nba');
  assert.deepEqual(events.map(e => e.round?.key), ['PLAYIN', 'PLAYIN', 'PLAYIN2']);
  const m = playoffModel({ league: 'nba', events });
  const pi = m.rounds[0];
  assert.equal(pi.title.zh, '附加賽');
  assert.deepEqual(pi.ties.slice(0, 4).map(t => (t.gap ? '—' : t.winner)), ['—', 'PHI', 'ORL', 'CHA']);
  assert.equal(pi.ties[2].roundTitle.zh, '第八種子戰');
  assert.equal(pi.state, 'on');
});

test('the NBA Cup knockout: its rounds from the notes, each conference its own side of the draw', () => {
  const T = { MIA: 14, ORL: 19, NY: 18, TOR: 28, PHX: 21, OKC: 25, SA: 24, LAL: 13 };
  const side = (abbr, score, winner) => ({ id: String(T[abbr]), abbr, name: abbr, short: abbr, score: String(score), winner });
  let n = 0;
  // Last season's (2025-26), as ESPN has them: regular-season games, the round only in the note.
  const game = (note, start, [a, as], [h, hs]) => ({ id: String(++n), league: 'nba', kind: 'match', note, start, status: { state: 'post' }, away: side(a, as, as > hs), home: side(h, hs, hs > as) });
  const games = [
    game('NBA Cup - Quarterfinals', '2025-12-10T00:00Z', ['MIA', 108], ['ORL', 117]),
    game('NBA Cup - Quarterfinals', '2025-12-10T02:30Z', ['NY', 117], ['TOR', 101]),
    game('NBA Cup - Quarterfinals', '2025-12-11T00:00Z', ['PHX', 89], ['OKC', 138]),
    game('NBA Cup - Quarterfinals', '2025-12-11T02:30Z', ['SA', 132], ['LAL', 119]),
    game('NBA Cup - Semifinals', '2025-12-13T22:00Z', ['NY', 132], ['ORL', 120]),
    game('NBA Cup - Semifinals', '2025-12-14T01:30Z', ['SA', 111], ['OKC', 109]),
    game('NBA Cup Championship', '2025-12-17T01:30Z', ['SA', 113], ['NY', 124]),
    game('NBA Cup - Group Play', '2025-11-15T00:00Z', ['MIA', 140], ['NY', 132])
  ];
  assert.equal(nbaCupRound(games[7]), null);
  assert.deepEqual([0, 4, 6].map(i => nbaCupRound(games[i]).key), ['QF', 'SF', 'F']);
  assert.equal(nbaCupRound(games[2]).title, 'West Quarterfinals');
  const events = games.flatMap(e => (nbaCupRound(e) ? [{ ...e, round: nbaCupRound(e) }] : []));
  const m = playoffModel({ league: 'nbacup', mode: 'last', events, now: Date.parse('2026-10-24T00:00Z') });
  assert.deepEqual(m.rounds.map(r => [r.key, r.ties.length, r.state]), [['QF', 4, 'done'], ['SF', 2, 'done'], ['F', 1, 'done']]);
  // Each semifinal beside the two quarterfinals that fed it.
  const ids = t => t.sides.map(s => s.abbr).sort().join('/');
  const [qf, sf] = m.rounds;
  for (const [i, t] of sf.ties.entries()) {
    const fed = qf.ties.slice(i * 2, i * 2 + 2).map(x => x.sides.find(s => s.id === x.winner).abbr).sort().join('/');
    assert.equal(fed, ids(t));
  }
  assert.equal(m.rounds[2].ties[0].winner, String(T.NY));
});

test('A predicted tie the table has settled is sure (Nashville first in the East, 3 to go)', () => {
  // MLS East on 2026-10-26: 31 of 34 played.
  const pts = [70, 55, 55, 51, 47, 46, 42, 42, 39, 38, 36, 35, 33, 30, 25];
  const east = pts.map((p, i) => ({ id: `E${i + 1}`, name: `E${i + 1}`, short: `E${i + 1}`, logo: '', stats: { GP: '31', P: String(p) } }));
  const m = playoffModel({ league: 'mls', mode: 'projected', groups: [{ en: 'Eastern Conference', rows: east }, { en: 'Western Conference', rows: rows('W', 15) }] });
  const [first, ...rest] = m.rounds[1].ties.filter(t => t && !t.gap && t.sides[0].id.startsWith('E'));
  // 1 v the wild card's winner: 1st is clinched, the other place is whoever wins 8 v 9.
  assert.equal(first.sure, true);
  // Each side marked: Nashville clinched, the 4 v 5's both still a guess.
  assert.equal(first.sides[0].sure, true);
  assert.ok(rest[0].sides.every(x => !x.sure));
  assert.ok(rest.every(t => !t.sure));
  assert.ok(!m.rounds[0].ties[0].sure);
  // Nothing settled yet: still a prediction.
  assert.ok(!m.rounds[1].ties.some(t => t?.sure && t.sides[0].id.startsWith('W')));
});
