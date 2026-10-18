import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSummary } from '../public/lib/espn.mjs';
import { lineXs, periodMarks, stampAt, pointStamp, periodName, holdToEnd, sideColors } from '../public/lib/wpline.mjs';

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

test('soccer: halves marked and read with the minute as the broadcast counts it (the owner, 2026-10-16)', () => {
  const s = parseSummary(fixture('epl-summary.json'), 'epl');
  const kick = Date.parse('2026-09-20T13:00:41Z') / 1000;
  const second = Date.parse('2026-09-20T14:01:14Z') / 1000;
  assert.equal(stampAt(s.timeline, 'soccer', kick - 60, false), '開賽前');
  assert.equal(stampAt(s.timeline, 'soccer', kick + 10 * 60, false), "上半場 11'");
  assert.equal(stampAt(s.timeline, 'soccer', kick + 45 * 60, true), "1st half 45+1'");
  assert.equal(stampAt(s.timeline, 'soccer', kick + 50 * 60, false), '中場休息');
  assert.equal(stampAt(s.timeline, 'soccer', second + 22 * 60, true), "2nd half 68'");
  assert.equal(stampAt(s.timeline, 'soccer', second + 60 * 60, true), 'Full time');
  // After a stoppage (ESPN's end-delay), the minute still told, added time too (the owner, 2026-10-17).
  assert.equal(stampAt(s.timeline, 'soccer', second + 25 * 60, true), "2nd half 71'");
  assert.equal(stampAt(s.timeline, 'soccer', second + 47 * 60, true), "2nd half 90+3'");
  const pts = Array.from({ length: 60 }, (_, i) => ({
    t: kick + i * 120,
    home: 0.5
  }));
  assert.deepEqual(
    periodMarks(s.timeline, 'soccer', pts, false).map(m => m.label),
    ['上半', "15'", "30'", '下半', "60'", "75'"]
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
  const second = marks.find(m => m.label === '下半');
  assert.ok(Math.abs(second.x - 0.48) < 0.03, `下半 at ${second.x}`);
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
  // Over, and the last price already on the side that won (0.89 → decided enough? no: held, greyed as quiet)…
  assert.equal(holdToEnd(points, timeline, { home: 1, draw: 0 }).at(-1).held, true);
  // …and 93% (Inter Miami 3–0 up at 60'): runs on to the result.
  const decided = points.map(p => ({ ...p, home: 0.93, draw: 0.05 }));
  const run = holdToEnd(decided, timeline, { home: 1, draw: 0 });
  assert.deepEqual([run.at(-1).home, run.at(-1).draw, run.at(-1).settled], [1, 0, true]);
  // (The side that won as the away side: its chance is what's left.)
  const away = points.map(p => ({ ...p, home: 0.04, draw: 0.03 }));
  assert.equal(holdToEnd(away, timeline, { home: 0, draw: 0 }).at(-1).settled, true);
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

test("a goal ruled out by VAR is told so, from the commentary (Leeds v Palace 52', Mitchell's), never the stoppage beside it", async () => {
  const { eventMoments } = await import('../public/lib/moments.mjs');
  const s = parseSummary(fixture('epl-var-summary.json'), 'epl');
  const v = s.events.find(e => e.kind === 'var');
  assert.equal(v.play.kind, 'deleted-after-review');
  assert.match(v.play.who, /Mitchell/);
  assert.ok(!s.events.some(e => e.kind === 'stop' && Math.abs(e.t - v.t) < 300), 'no stoppage beside it');
  // The prices: Palace's goal lifts them, VAR takes it back.
  const t0 = v.t - 600;
  const pts = [0.6, 0.6, 0.6, 0.6, 0.6, 0.35, 0.45, 0.58, 0.6, 0.6].map((home, k) => ({ t: t0 + k * 120, home, draw: 0.25 }));
  const [m] = eventMoments(pts, [v], 'soccer', { home: { id: '357', name: 'Leeds' }, away: { id: '384', name: 'Palace' }, en: false }, pts.map(p => p.t));
  assert.match(m.text, /Mitchell 進球不算（VAR）/);
  assert.equal(m.i, 5, 'on the spike');
});

test("a stoppage the minute of a goal isn't given the goal's swing (Brentford v Liverpool 64': Muñoz's 1–1, then an injury)", async () => {
  const { eventMoments } = await import('../public/lib/moments.mjs');
  // Every minute; the goal at minute 10 moves Liverpool (away) from 30% to 57%, the stop 20 s after it.
  const t0 = 0;
  const pts = Array.from({ length: 30 }, (_, k) => ({ t: t0 + k * 60, home: k < 11 ? 0.4 : 0.2, draw: k < 11 ? 0.3 : 0.25 }));
  const goal = { t: 600, kind: 'goal', play: { team: '364', who: 'V. Muñoz', kind: 'goal' } };
  const stop = { t: 620, kind: 'stop', play: { text: 'Delay in match because of an injury' } };
  const side = { home: { id: '337', name: '布倫特福德' }, away: { id: '364', name: '利物浦' }, en: false };
  const found = eventMoments(pts, [goal, stop], 'soccer', side, pts.map(p => p.t));
  assert.equal(found.length, 1, 'the goal only');
  assert.match(found[0].text, /Muñoz/);
  // A stop on its own still tells what it did.
  const moved = pts.map((p, k) => (k >= 22 ? { ...p, home: 0.05 } : p));
  const alone = eventMoments(moved, [goal, { ...stop, t: 1260 }], 'soccer', side, moved.map(p => p.t));
  assert.ok(alone.some(m => m.text === '球員受傷，比賽暫停'));
});

test("a VAR check that ends in a red card is one moment, the red card, its swing from the check on (Yarmoliuk, 45+8' and 45+10')", async () => {
  const { eventMoments } = await import('../public/lib/moments.mjs');
  // Every minute; the check at minute 10 starts Liverpool's (away) rise, the red at minute 12 finishes it.
  const pts = Array.from({ length: 30 }, (_, k) => ({ t: k * 60, home: k < 11 ? 0.45 : k < 13 ? 0.3 : 0.2, draw: 0.28 }));
  const check = { t: 600, kind: 'var', play: { kind: 'var---referee-decision-cancelled', type: 'VAR - Referee decision cancelled', team: '337', who: 'Y. Yarmoliuk' } };
  const red = { t: 720, kind: 'red', play: { kind: 'red', team: '337', who: 'Y. Yarmoliuk' } };
  const side = { home: { id: '337', name: '布倫特福德' }, away: { id: '364', name: '利物浦' }, en: false };
  const found = eventMoments(pts, [check, red], 'soccer', side, pts.map(p => p.t));
  assert.equal(found.length, 1);
  assert.equal(found[0].icon, '🟥');
  assert.match(found[0].text, /Yarmoliuk 紅牌/);
  assert.ok(found[0].delta < -0.2, 'the whole swing, from the check');
  // A goal ruled out by VAR stays (it is the result).
  const out = { ...check, play: { ...check.play, kind: 'deleted-after-review' } };
  assert.equal(eventMoments(pts, [out], 'soccer', side, pts.map(p => p.t)).length, 1);
});

test("a VAR check keeps to its own move, and says what it decided (Mac Allister's penalty taken away at 41', Brentford's goal at 44')", async () => {
  const { eventMoments } = await import('../public/lib/moments.mjs');
  // Every minute: the penalty taken away nudges Brentford up 4 points at minute 10, the goal at minute 13 lifts them 20 more.
  const pts = Array.from({ length: 30 }, (_, k) => ({ t: k * 60, home: k < 11 ? 0.3 : k < 14 ? 0.34 : 0.54, draw: 0.3 }));
  const check = { t: 600, kind: 'var', play: { kind: 'var---referee-decision-cancelled', type: 'VAR - Referee decision cancelled', text: 'VAR Decision: No Penalty Liverpool.', team: '364', who: 'A. Mac Allister' } };
  const goal = { t: 780, kind: 'score', play: { kind: 'goal---header', team: '337', who: 'K. Lewis-Potter' } };
  const side = { home: { id: '337', name: '布倫特福德' }, away: { id: '364', name: '利物浦' }, en: false };
  const found = eventMoments(pts, [check, goal], 'soccer', side, pts.map(p => p.t));
  assert.equal(found.length, 1, 'the goal; the check moved it too little to tell');
  assert.match(found[0].text, /Lewis-Potter/);
  const big = pts.map((p, k) => (k >= 11 && k < 14 ? { ...p, home: 0.45 } : p));
  const both = eventMoments(big, [check, goal], 'soccer', side, big.map(p => p.t));
  const v = both.find(m => m.icon === '📺');
  assert.equal(v.text, "VAR：取消 12 碼罰球");
  assert.equal(v.side, "home", "it helped Brentford, not Liverpool");
  assert.ok(Math.abs(v.delta - 0.15) < 1e-9, 'its own move (30% to 45%), not the goal\'s');
});

test("a penalty given then taken away by VAR: the check is the spike's way back, Brentford's (Liverpool, 41')", async () => {
  const { eventMoments } = await import('../public/lib/moments.mjs');
  // Every minute: the penalty to Liverpool (away) drops Brentford from 30% to 12% at minute 9, VAR takes it away at minute 11 (back to 30%), Brentford score at minute 15.
  const pts = Array.from({ length: 30 }, (_, k) => ({ t: k * 60, home: k >= 9 && k < 11 ? 0.12 : k < 16 ? 0.3 : 0.5, draw: 0.3 }));
  const check = { t: 600, kind: 'var', play: { kind: 'var---referee-decision-cancelled', type: 'VAR - Referee decision cancelled', text: 'VAR Decision: No Penalty Liverpool.', team: '364', who: 'A. Mac Allister' } };
  const goal = { t: 900, kind: 'score', play: { kind: 'goal---header', team: '337', who: 'K. Lewis-Potter' } };
  const side = { home: { id: '337', name: '布倫特福德' }, away: { id: '364', name: '利物浦' }, en: false };
  const v = eventMoments(pts, [check, goal], 'soccer', side, pts.map(p => p.t)).find(m => m.icon === '📺');
  assert.ok(v, 'the spike explained');
  assert.equal(v.side, 'home');
  assert.ok(Math.abs(v.delta - 0.18) < 1e-9, 'from the top of the spike back down');
});

test("two goals two minutes apart: each its own swing, never the other's (Foden 19', Maeda 21')", async () => {
  const { eventMoments } = await import('../public/lib/moments.mjs');
  // Every minute: City (home) 70%; Foden at 19' (88% from 20'), Maeda at 21' (72% from 22').
  const pts = Array.from({ length: 40 }, (_, k) => ({ t: k * 60, home: k < 20 ? 0.7 : k < 22 ? 0.88 : 0.72, draw: 0.18 }));
  const foden = { t: 19 * 60 + 10, kind: 'score', play: { kind: 'goal', team: '382', who: 'P. Foden', home: 1, away: 0 } };
  const maeda = { t: 21 * 60 + 45, kind: 'score', play: { kind: 'goal', team: '373', who: 'D. Maeda', home: 1, away: 1 } };
  const side = { home: { id: '382', name: '曼城' }, away: { id: '373', name: '伊普斯維奇' }, en: false };
  const [f, m] = eventMoments(pts, [foden, maeda], 'soccer', side, pts.map(p => p.t));
  assert.ok(Math.abs(f.delta - 0.18) < 1e-9, "Foden's: City +18%");
  assert.ok(Math.abs(m.delta + 0.16) < 1e-9, "Maeda's: Ipswich +16%");
  assert.ok(f.i < m.i, 'each dot on its own step');
  assert.equal(f.t, foden.t, 'said at its own minute');
});

test("過程 and the key moments say what VAR decided, in plain words (every phrasing ESPN used, 2026-10)", async () => {
  const { varDecision, soccerLineZh } = await import('../public/lib/moments.mjs');
  assert.equal(varDecision('VAR Decision: No Penalty Liverpool.', '利物浦', { long: true }), 'VAR：取消利物浦的 12 碼罰球');
  assert.equal(varDecision('VAR Decision: No Penalty Liverpool.'), 'VAR：取消 12 碼罰球');
  assert.equal(varDecision('VAR Decision: Penalty Augsburg.', '奧格斯堡', { long: true }), 'VAR：改判奧格斯堡得到 12 碼罰球');
  assert.equal(varDecision('VAR Decision: No Goal Manchester City 3-1 Ipswich Town.'), 'VAR：進球不算');
  assert.equal(varDecision('VAR Decision: Goal Real Betis 3-1 Osasuna (Ante Budimir).', '', { long: true }), 'VAR：進球有效（A. Budimir）');
  assert.equal(varDecision('VAR Decision: Card upgraded Yehor Yarmoliuk (Brentford).', '', { long: true }), 'VAR：Y. Yarmoliuk 改判紅牌');
  assert.equal(varDecision('VAR Decision: Card Changed.'), 'VAR：改判出牌');
  assert.equal(soccerLineZh({ text: 'VAR Decision: No Penalty Liverpool.', kind: 'var---referee-decision-cancelled' }, '利物浦'), 'VAR：取消利物浦的 12 碼罰球');
});
