import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSummary } from '../public/lib/espn.mjs';
import { lineXs, periodMarks, stampAt, pointStamp, periodName, holdToEnd, sideColors } from '../public/lib/wpline.mjs';

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

test('soccer: halves marked and read, never the minute', () => {
  const s = parseSummary(fixture('epl-summary.json'), 'epl');
  const kick = Date.parse('2026-09-20T13:00:41Z') / 1000;
  const second = Date.parse('2026-09-20T14:01:14Z') / 1000;
  assert.equal(stampAt(s.timeline, 'soccer', kick - 60, false), '開賽前');
  assert.equal(stampAt(s.timeline, 'soccer', kick + 10 * 60, false), '上半場');
  assert.equal(stampAt(s.timeline, 'soccer', kick + 45 * 60, true), '1st half');
  assert.equal(stampAt(s.timeline, 'soccer', kick + 50 * 60, false), '中場休息');
  assert.equal(stampAt(s.timeline, 'soccer', second + 22 * 60, true), '2nd half');
  assert.equal(stampAt(s.timeline, 'soccer', second + 60 * 60, true), 'Full time');
  const pts = Array.from({ length: 60 }, (_, i) => ({
    t: kick + i * 120,
    home: 0.5
  }));
  assert.deepEqual(
    periodMarks(s.timeline, 'soccer', pts, false).map(m => m.label),
    ['上半', '下半']
  );
});

test('baseball: ESPN points by the clock, innings marked, the half inning read', () => {
  const s = parseSummary(fixture('mlb-summary.json'), 'mlb');
  assert.ok(s.timeline.length && s.timeline.every((e, i) => !i || e.t >= s.timeline[i - 1].t));
  const top = s.timeline.find(e => e.half === 'top');
  assert.equal(stampAt(s.timeline, 'baseball', top.t, false), `${top.n}局上`);
  assert.equal(stampAt(s.timeline, 'baseball', top.t, true), `Top ${top.n}`);
});

test('other sports: the period alone; overtime', () => {
  const tl = [
    { t: 100, n: 1, half: '', type: '' },
    { t: 200, n: 3, half: '', type: '' }
  ];
  assert.equal(stampAt(tl, 'basketball', 250, false), '第3節');
  assert.equal(stampAt(tl, 'basketball', 250, true), 'Q3');
  assert.equal(stampAt(tl, 'hockey', 250, true), 'P3');
  assert.equal(periodName('basketball', 5, true), 'OT');
  assert.equal(periodName('basketball', 6, false), '延長2');
});

test('no plays (CPBL): the clock, marked by the hour', () => {
  const t0 = Date.UTC(2026, 9, 1, 10, 30) / 1000;
  const pts = Array.from({ length: 100 }, (_, i) => ({
    t: t0 + i * 120,
    home: 0.5
  }));
  const marks = periodMarks([], 'baseball', pts, false);
  assert.ok(marks.length >= 3 && marks.every(m => /^\d\d:00$/.test(m.label)));
  assert.match(stampAt([], 'baseball', t0, false), /^\d\d:\d\d$/);
});

test('points across: by time when all have one, else evenly', () => {
  assert.deepEqual(lineXs([{ t: 0 }, { t: 10 }, { t: 40 }]), [0, 0.25, 1]);
  assert.deepEqual(lineXs([{}, { t: 10 }, {}]), [0, 0.5, 1]);
});

test("ESPN's line in play order, never by its wall clocks (a play logged late)", () => {
  // Knicks at 76ers, 2026-10-05: 98 of 538 points' plays logged out of time order.
  const s = parseSummary(fixture('nba-summary-winprob.json'), 'nba');
  const xs = lineXs(s.winProb);
  assert.ok(xs.every((x, i) => !i || x > xs[i - 1]));
  assert.deepEqual(periodMarks(s.timeline, 'basketball', s.winProb, false).map(m => m.label), ['第1節', '第2節', '第3節', '第4節']);
  assert.equal(pointStamp(s.timeline, 'basketball', s.winProb[10], false), '第1節');
  assert.equal(pointStamp(s.timeline, 'basketball', s.winProb.at(-1), true), 'Q4');
  // By the clock, a late-logged first quarter play never takes the game back to it.
  const q2 = s.timeline.find(e => e.n === 2).t;
  assert.equal(stampAt(s.timeline, 'basketball', q2 + 600, false), '第2節');
});

test('a game to come: ESPN prediction first, else the sportsbook, its margin out', () => {
  const espn = parseSummary({ predictor: { homeTeam: { gameProjection: '53.2' }, awayTeam: { gameProjection: '46.8' } }, pickcenter: [{ homeTeamOdds: { moneyLine: -185 }, awayTeamOdds: { moneyLine: 154 } }] }, 'cfb');
  assert.deepEqual(espn.predict, { source: 'espn', home: 0.532 });
  // Arsenal v Leeds, 2026-10-10: DraftKings -275 / 400 draw / +700.
  const book = parseSummary({ pickcenter: [{ provider: { name: 'DraftKings' }, homeTeamOdds: { moneyLine: -275 }, awayTeamOdds: { moneyLine: 700 }, drawOdds: { moneyLine: 400 } }] }, 'epl').predict;
  assert.equal(book.source, 'DraftKings');
  assert.equal(Math.round(book.home * 100), 69);
  assert.equal(Math.round(book.draw * 100), 19);
  assert.equal(parseSummary({}, 'nba').predict, null);
});

test('a market standing still: its stretch read as no price, never a quiet game', async () => {
  const { quietRuns } = await import('../public/lib/wpline.mjs');
  // Forest v Coventry, 2026-09-19: Polymarket's history at 51.5% from the 40th minute to the end.
  const pts = [...Array.from({ length: 20 }, (_, i) => ({ t: i * 120, home: 0.6 - i * 0.004 })), ...Array.from({ length: 40 }, (_, i) => ({ t: 2400 + i * 120, home: 0.515 })), { t: 7300, home: 0.05 }];
  assert.deepEqual(quietRuns(pts), [[20, 59]]);
  assert.deepEqual(quietRuns(pts.slice(0, 20)), []);
  // ESPN's line (by play) is never read so.
  assert.deepEqual(quietRuns(pts.map(p => ({ ...p, n: 1 }))), []);
});

test('by game time: half time taken out, nothing after the final whistle, the halves side by side', () => {
  const s = parseSummary(fixture('epl-summary.json'), 'epl');
  const kick = Date.parse('2026-09-20T13:00:41Z') / 1000;
  // Every two minutes from kickoff to an hour after the whistle (the market settling).
  const pts = Array.from({ length: 150 }, (_, i) => ({ t: kick + i * 120, home: 0.5 }));
  const marks = periodMarks(s.timeline, 'soccer', pts, false);
  assert.equal(marks[0].x, 0);
  assert.ok(Math.abs(marks[1].x - 0.48) < 0.03, `下半 at ${marks[1].x}`);
  const xs = lineXs(pts, s.timeline);
  assert.equal(xs.at(-1), 1);
  assert.ok(xs.every((x, i) => !i || x >= xs[i - 1]));
});

test('a finger snaps to the closest key moment, not the first one near it', async () => {
  const { nearestMoment } = await import('../public/lib/wpline.mjs');
  const xs = [0, 0.5, 0.97, 0.98, 0.99, 1];
  const moments = [{ i: 2 }, { i: 3 }, { i: 4 }];
  assert.equal(nearestMoment(moments, xs, 4).i, 4);
  assert.equal(nearestMoment(moments, xs, 3).i, 3);
  assert.equal(nearestMoment(moments, xs, 5).i, 4);
  assert.equal(nearestMoment(moments, xs, 1), null);
});

test("a market that stopped trading early (Coventry 0–3 Arsenal, its last price at 49'): held to the whistle, so 下半 sits near the middle", () => {
  const k = 1787338812;
  const timeline = [
    { t: k, n: 1, type: 'kickoff' },
    { t: k + 1600, n: 1, type: 'goal' },
    { t: k + 47 * 60 + 13, n: 1, type: 'halftime' },
    { t: k + 62 * 60 + 16, n: 2, type: 'start-2nd-half' },
    { t: k + 65 * 60 + 36, n: 2, type: 'goal' },
    { t: k + 111 * 60 + 57, n: 2, type: 'end-regular-time' }
  ];
  const points = Array.from({ length: 30 }, (_, i) => ({ t: k + 5 + i * 136, home: 0.6 + i / 100 }));
  const before = periodMarks(timeline, 'soccer', points, false).find(m => m.label === '下半').x;
  const held = holdToEnd(points, timeline);
  assert.equal(held.length, points.length + 1);
  assert.equal(held.at(-1).home, points.at(-1).home);
  const after = periodMarks(timeline, 'soccer', held, false).find(m => m.label === '下半').x;
  assert.ok(before > 0.9, `before: ${before}`);
  assert.ok(after > 0.4 && after < 0.6, `after: ${after}`);
  // A line by plays (ESPN's) is left as it is.
  const plays = [{ n: 1, home: 0.5 }, { n: 2, home: 0.6 }];
  assert.equal(holdToEnd(plays, timeline), plays);
});

test("each side in its colour, readable on the card and told apart from the other's", () => {
  assert.deepEqual(sideColors({ color: '#ef0107' }, { color: '#1c64b4' }), { home: '#ef0107', away: '#1c64b4' });
  // Arsenal against Liverpool: two reds, so Liverpool's second (darkened a little to read on white).
  assert.deepEqual(sideColors({ color: '#ef0107', alt: '#ffffff' }, { color: '#d00027', alt: '#00b2a9' }), { home: '#ef0107', away: '#00a59d' });
  // Newcastle's black on a dark card: its light blue, as it is.
  assert.equal(sideColors({ color: '#000000', alt: '#41b6e6' }, {}, '#1c1c1e').home, '#41b6e6');
  // Padres against Brewers on a dark card: brown and navy vanish, two golds can't be told apart, so gold and a lightened navy.
  const [sd, mil] = [{ color: '#2f241d', alt: '#ffc425' }, { color: '#13294b', alt: '#ffc72c' }];
  assert.deepEqual(sideColors(sd, mil, '#1c1c1e'), { home: '#ffc425', away: '#2f66bb' });
  // On a light card the Padres' brown reads as it is.
  assert.equal(sideColors(sd, mil, '#ffffff').home, '#2f241d');
  // Inter on a dark card: its blue lightened, never its white second colour; Genoa's navy and Fiorentina's purple both kept.
  assert.equal(sideColors({ color: '#00239c', alt: '#ffffff' }, { color: '#19161d', alt: '#ffdd30' }, '#1c1c1e').home, '#2959ff');
  assert.deepEqual(sideColors({ color: '#08305d', alt: '#ffffff' }, { color: '#4c1d84', alt: '#ffffff' }), { home: '#08305d', away: '#4c1d84' });
  assert.deepEqual(sideColors({}, {}), { home: null, away: null });
});
