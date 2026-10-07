import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSummary } from '../public/lib/espn.mjs';
import { playMoments, eventMoments, swings, playParts } from '../public/lib/moments.mjs';

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
const sideOf = s => ({ home: { id: s.home.id, name: 'H' }, away: { id: s.away.id, name: 'A' } });

test('swings: moves of 12 points or more, each told once', () => {
  assert.deepEqual(swings([0.5, 0.52, 0.7, 0.68, 0.4, 0.45]), [{ from: 0, to: 2 }, { from: 2, to: 4 }]);
  assert.deepEqual(swings([0.5, 0.55, 0.5]), []);
});

test("baseball: the plays that turned it (Yankees at Rays, 2026-10-05: Rice's home run)", () => {
  const s = parseSummary(fixture('mlb-summary-moments.json'), 'mlb');
  const zh = playMoments(s.winProb, 'baseball', { ...sideOf(s), en: false });
  assert.ok(zh.length >= 3 && zh.length <= 5);
  assert.ok(zh.some(m => m.text === 'B. Rice 全壘打 · 1 分打點' && m.side === 'away'));
  assert.ok(zh.every((m, i) => !i || m.i > zh[i - 1].i));
  const en = playMoments(s.winProb, 'baseball', { ...sideOf(s), en: true });
  assert.ok(en.some(m => m.text === 'Rice homered to right (372 feet).'));
});

test('football: the walk-off field goal its biggest moment; a flag told as a call', () => {
  const s = parseSummary(fixture('nfl-summary-moments.json'), 'nfl');
  assert.ok(s.winProb.every(p => p.n));
  const list = playMoments(s.winProb, 'football', { ...sideOf(s), en: false });
  const top = [...list].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
  assert.match(top.text, /射門得分 · 超前$/);
  assert.equal(top.side, 'home');
  assert.ok(list.filter(m => /判罰/.test(m.text)).every(m => m.text === '關鍵判罰'));
});

test('basketball: the runs, by the points each side scored', () => {
  const pts = [];
  let [h, a] = [0, 0];
  const add = (v, dh, da) => pts.push({ home: v, n: 1, play: { home: (h += dh), away: (a += da) } });
  for (let i = 0; i < 10; i++) add(0.5, 1, 1);
  for (let i = 0; i < 6; i++) add(0.5 + (i + 1) * 0.04, 2, 0);
  for (let i = 0; i < 5; i++) add(0.74, 1, 1);
  const [m] = playMoments(pts, 'basketball', { home: { id: '1', name: '76人' }, away: { id: '2', name: '尼克' }, en: false });
  assert.equal(m.text, '76人 12-0 攻勢');
  assert.equal(m.side, 'home');
});

test("soccer on Polymarket's line: a goal always told, with the move around it", () => {
  const s = parseSummary(fixture('epl-summary.json'), 'epl');
  const goal = s.events.find(ev => ev.kind === 'score');
  assert.equal(goal.play.who && goal.play.team, '364');
  const pts = Array.from({ length: 60 }, (_, i) => ({ t: goal.t - 3600 + i * 120, home: goal.t - 3600 + i * 120 > goal.t + 60 ? 0.2 : 0.45 }));
  const [m] = eventMoments(pts, s.events, 'soccer', { home: { id: s.home.id, name: 'H' }, away: { id: s.away.id, name: 'A' }, en: false }, pts.map(p => p.t));
  assert.equal(m.icon, '⚽');
  assert.match(m.text, /進球$/);
  assert.equal(m.side, String(s.home.id) === '364' ? 'home' : 'away');
  assert.ok(m.delta < -0.2);
});

test("F1: the safety car told with who stopped under it and who gained; a lead taken (Bahrain GP, 2026-10-04)", async () => {
  const { raceMoments } = await import('../public/lib/moments.mjs');
  const { controlBands } = await import('../public/lib/winprob.mjs');
  const bands = controlBands(
    [
      { message: 'SAFETY CAR LIGHTS ON', category: 'Other', lap: 1 },
      { message: 'SAFETY CAR DEPLOYED', category: 'SafetyCar', lap: 9 },
      { message: 'SAFETY CAR IN THIS LAP', category: 'SafetyCar', lap: 12 },
      { message: 'VSC DEPLOYED', category: 'SafetyCar', lap: 30 },
      { message: 'SAFETY CAR DEPLOYED', category: 'SafetyCar', lap: 32 },
      { message: 'SAFETY CAR IN THIS LAP', category: 'SafetyCar', lap: 35 },
      { message: 'RED FLAG', flag: 'RED', lap: 40 }
    ],
    m => m.lap,
    55
  );
  // The virtual safety car turned into the real one.
  assert.deepEqual(bands.map(b => b.slice(0, 3)), [[9, 12, 'sc'], [30, 32, 'vsc'], [32, 35, 'sc'], [40, 55, 'red']]);
  // Verstappen 34% before the safety car, 65% after it; Antonelli the other way.
  const points = Array.from({ length: 21 }, (_, lap) => ({ lap, c: lap < 9 ? [0.34, 0.57] : lap < 14 ? [0.65, 0.31] : [0.8, 0.15] }));
  const list = raceMoments(points, ['維斯塔潘', '安東內利'], [{ i0: 8, i1: 12, kind: 'sc', from: 9, to: 12, why: 'out', who: ['Bottas'] }], [{ i: 3, kind: 'lead', k: 1 }, { i: 9, kind: 'pit', k: 0 }, { i: 13, kind: 'lead', k: 0 }], false);
  assert.deepEqual(list.map(m => m.text), ['安東內利 取得領先', '安全車 · Bottas 退賽', '維斯塔潘 取得領先']);
  assert.equal(list[1].k, 0);
  assert.deepEqual(list[1].laps, [9, 12]);
  assert.ok(list[1].delta > 0.3);
});

test('F1: why the safety car came out: a car out just before, else one stopped, else a collision', async () => {
  const { causeOf } = await import('../public/lib/winprob.mjs');
  const msgs = [
    { t: 100, message: 'TURN 9 INCIDENT INVOLVING CARS 16 (LEC) AND 27 (HUL) NOTED - CAUSING A COLLISION' },
    { t: 290, message: 'CAR 77 (BOT) STOPPED AT TURN 14' }
  ];
  const names = { 16: 'Leclerc', 27: 'Hulkenberg', 77: 'Bottas' };
  assert.deepEqual(causeOf(msgs, 300, ['Albon'], n => names[n]), { kind: 'out', who: ['Albon'] });
  assert.deepEqual(causeOf(msgs, 300, [], n => names[n]), { kind: 'stopped', who: ['Bottas'] });
  assert.deepEqual(causeOf(msgs.slice(0, 1), 150, [], n => names[n]), { kind: 'crash', who: ['Leclerc', 'Hulkenberg'] });
  // A collision noted long before isn't the cause.
  assert.equal(causeOf(msgs.slice(0, 1), 400, [], n => names[n]), null);
});

test('the score at a moment: the play\'s, the last scoring play\'s, or the goals so far', async () => {
  const { scoreAt } = await import('../public/lib/moments.mjs');
  const s = parseSummary(fixture('mlb-summary-moments.json'), 'mlb');
  const hr = s.winProb.findIndex(p => /homered/.test(p.play?.text || ''));
  const [a, h] = scoreAt(s.winProb, hr);
  assert.equal(a, s.winProb[hr].play.away);
  assert.equal(h, s.winProb[hr].play.home);
  assert.deepEqual(scoreAt(s.winProb, 0), [0, 0]);
  // Soccer on Polymarket's line: Isak's goal for Liverpool (away at Bournemouth).
  const epl = parseSummary(fixture('epl-summary.json'), 'epl');
  const goal = epl.events.find(ev => ev.kind === 'score');
  const pts = [{ t: goal.t - 60, home: 0.4 }, { t: goal.t + 60, home: 0.2 }];
  assert.deepEqual(scoreAt(pts, 0, epl.events, epl.home.id), [0, 0]);
  assert.deepEqual(scoreAt(pts, 1, epl.events, epl.home.id), String(goal.play.team) === String(epl.home.id) ? [0, 1] : [1, 0]);
  assert.equal(scoreAt(pts, 1, [], ''), null);
});

test('F1: a red flag only said ends the safety car; it ends when the track is clear (Italian GP, 2026-09-06)', async () => {
  const { controlBands } = await import('../public/lib/winprob.mjs');
  const bands = controlBands(
    [
      { category: 'SafetyCar', message: 'SAFETY CAR DEPLOYED', lap: 3 },
      { category: 'Other', message: 'RED FLAG - RACE SUSPENDED', lap: 3 },
      { category: 'Flag', flag: 'CLEAR', message: 'TRACK CLEAR', lap: 4 },
      { category: 'Other', message: 'RACE WILL RESUME AT 15:39', lap: 4 },
      { category: 'SafetyCar', message: 'VIRTUAL SAFETY CAR DEPLOYED', lap: 28 },
      { category: 'SafetyCar', message: 'VIRTUAL SAFETY CAR ENDING', lap: 29 },
      // The chequered flag isn't a red one.
      { category: 'Flag', flag: 'CHEQUERED', message: 'CHEQUERED FLAG', lap: 53 }
    ],
    m => m.lap,
    53
  );
  assert.deepEqual(bands.map(b => b.slice(0, 3)), [[3, 3, 'sc'], [3, 4, 'red'], [28, 29, 'vsc']]);
});

test('basketball: the stretch it drifted over and the possessions that decided it (Knicks at Spurs, Finals game 2, 105-104)', async () => {
  const { lateClock } = await import('../public/lib/moments.mjs');
  const s = parseSummary(fixture('nba-finals-g2.json'), 'nba');
  const list = playMoments(s.winProb, 'basketball', { home: { id: s.home.id, name: '馬刺' }, away: { id: s.away.id, name: '尼克' }, en: false });
  // The slow slide: one stretch over two quarters, told by the points.
  const stretch = list.find(m => m.periods && m.periods[1] > m.periods[0]);
  assert.match(stretch.text, /^尼克 \d+-\d+ 拉開$/);
  // The last possessions, who did what.
  const texts = list.map(m => m.text);
  assert.ok(texts.includes('V. Wembanyama 跳投不進'));
  assert.ok(texts.includes('J. Brunson 罰球命中 · 超前'));
  assert.ok(!texts.some(t => /掌握局勢|\\b2-0 攻勢/.test(t)));
  // The clock where it tells: the final seconds.
  const last = list.at(-1);
  assert.equal(lateClock('basketball', s.winProb[last.i]), '2.0');
  assert.equal(lateClock('basketball', s.winProb[10]), '');
});

test("the game's end: the stops that decided it, five at most, a lead taken or tied always among them (Finals game 2)", () => {
  const s = parseSummary(fixture('nba-finals-g2.json'), 'nba');
  const list = playMoments(s.winProb, 'basketball', { home: { id: s.home.id, name: '馬刺' }, away: { id: s.away.id, name: '尼克' }, en: false });
  const texts = list.map(m => m.text);
  // Brunson's fadeaway tying it at 104 with 39 seconds left, and his free throw ahead: never left out.
  assert.ok(texts.includes('J. Brunson 跳投命中 · 追平'));
  assert.ok(texts.includes('J. Brunson 罰球命中 · 超前'));
  // Few enough to read: five from the closing stretch, ten in all.
  assert.ok(list.filter(m => m.clutch).length <= 5);
  assert.ok(list.length <= 10, `${list.length} moments`);
  // A team's own play by the side's name, one play once.
  assert.ok(!texts.some(t => /Knicks|Spurs/.test(t)));
  assert.equal(new Set(list.map(m => m.i)).size, list.length);
});

test("a play ESPN filed late sits where it happened, never as a spike (Suns at Pistons, preseason)", () => {
  const s = parseSummary(fixture('nba-preseason-late-plays.json'), 'nba');
  // Each period's clock only runs down along the line, and nothing comes after the final buzzer.
  const secs = c => (c.includes(':') ? c.split(':').reduce((m, x) => m * 60 + Number(x), 0) : Number(c));
  s.winProb.forEach((p, i) => {
    const q = s.winProb[i - 1];
    if (q?.play?.clock && p.play?.clock && q.n === p.n) assert.ok(secs(p.play.clock) <= secs(q.play.clock) + 1, `point ${i}: ${q.play.clock} then ${p.play.clock}`);
  });
  assert.match(s.winProb.at(-1).play.text, /End of Game/);
  const list = playMoments(s.winProb, 'basketball', { home: { id: s.home.id, name: '活塞' }, away: { id: s.away.id, name: '太陽' }, en: false });
  const texts = list.map(m => m.text);
  // The turnover at 11:41 of the first quarter, filed at 3:41, isn't a swing at 0–0.
  assert.ok(!texts.some(t => /D\. Booker 失誤/.test(t)));
  assert.ok(texts.includes('K. Peat 灌籃命中 · 追平'));
  assert.ok(texts.includes('E. Okorie 上籃命中 · 超前'));
  // A thief by family name; a free throw made and one missed on the same clock count as one stop.
  assert.ok(texts.includes('C. Lanier 失誤（Chandler 抄截）'));
  assert.ok(!texts.some(t => /罰球不進/.test(t)) || !texts.some(t => /罰球命中$/.test(t)));
  assert.ok(list.length <= 10, `${list.length} moments`);
});

// Lakers at Kings, 2026-10-05: the Lakers' run was over by the 2nd quarter,
// but the Kings' 1% kept drifting to 0% until the buzzer, and the run (its
// dot, 第1–4節 · 0.0) was put at the end of the game.
test('basketball: a stretch ends where it got there, not where its last drift ended', () => {
  const pts = [];
  let [h, a] = [0, 0];
  const add = (v, n, dh, da) => pts.push({ home: v, n, play: { home: (h += dh), away: (a += da), clock: '' } });
  for (let i = 0; i < 10; i++) add(0.6, 1, 1, 1);
  for (let i = 0; i < 20; i++) add(0.6 - (i + 1) * 0.029, 2, 0, 2); // the run: 0.6 → 0.02
  for (let i = 0; i < 60; i++) add(0.02 - (i + 1) * 0.0003, i < 30 ? 3 : 4, 1, 1); // the drift: 0.02 → 0.002
  const list = playMoments(pts, 'basketball', { home: { id: 'h', name: 'H' }, away: { id: 'a', name: 'A' }, en: false });
  const run = list.find(m => m.periods);
  assert.ok(run, 'the run is a moment');
  assert.ok(run.i <= 30, `the run ends in the 2nd period, not at ${run.i}`);
  assert.equal(run.periods[1], 2);
});

// 過程 showed ESPN's English for every play, and no one's face: each play now
// said in Chinese with its player (a substitution's both), the words checked
// on real games: an NBA game's every play (Lakers at Kings, 2026-10-05, its last 80), a Premier League game's events, MLB's runs.
test('過程: every play in Chinese, with its player', async () => {
  const { feedText } = await import('../public/lib/moments.mjs');
  const said = (file, league, sport) => {
    const s = parseSummary(fixture(file), league);
    const list = sport === 'basketball' ? s.feed : s.keyEvents.length ? s.keyEvents : s.plays;
    return list.map(p => ({ p, zh: feedText(sport, p, false, String(p.team) === String(s.home?.id) ? 'H' : 'A'), en: feedText(sport, p, true) }));
  };
  for (const [file, league, sport] of [['nba-summary-feed.json', 'nba', 'basketball'], ['epl-summary.json', 'epl', 'soccer'], ['mlb-summary.json', 'mlb', 'baseball']]) {
    const rows = said(file, league, sport);
    assert.ok(rows.length > 5, file);
    // No English words left in Chinese but players' names (a capital and a full stop, "J. Hardy").
    for (const { p, zh } of rows) assert.doesNotMatch(zh.replace(p.who || '', '').replace(p.other || '', '').replace(/（[^）]*）/, ''), /[a-z]{3,}/, `${file}: ${zh} (${p.text})`);
    assert.ok(rows.filter(r => r.p.pic).length > rows.length / 2, `${file}: most plays have their player`);
    assert.ok(rows.every(r => r.en === (r.p.text || r.p.type)), `${file}: English is ESPN's own`);
  }
  const epl = said('epl-summary.json', 'epl', 'soccer').map(r => r.zh);
  assert.ok(epl.includes('A. Isak 進球') && epl.includes('D. Szoboszlai 黃牌') && epl.includes('T. Nyoni 替換 F. Wirtz'));
  const mlb = said('mlb-summary.json', 'mlb', 'baseball').map(r => r.zh);
  assert.ok(mlb.some(t => /^F\. Lindor 全壘打 · \d 分打點$/.test(t)), mlb.join(' / '));
  const nba = said('nba-summary-feed.json', 'nba', 'basketball').map(r => r.zh);
  assert.ok(nba.some(t => /三分命中/.test(t)) && nba.some(t => /罰進 \d\/\d/.test(t)));
  assert.ok(!nba.some(t => /跳投/.test(t) && /(charge|review)/i.test(t)));
});

test("過程's row: the play on one line, the team and who helped small beneath (no bracket left to wrap)", () => {
  assert.deepEqual(playParts('J. Akins 三分命中（McCullar Jr. 助攻）', '尼克'), { main: 'J. Akins 三分命中', sub: '尼克 · McCullar Jr. 助攻' });
  assert.deepEqual(playParts('K. McCullar Jr. 失誤（Nelson Jr. 抄截）', '尼克'), { main: 'K. McCullar Jr. 失誤', sub: '尼克 · Nelson Jr. 抄截' });
  // A team's own play: the team isn't said twice.
  assert.deepEqual(playParts('76人 失誤', '76人'), { main: '76人 失誤', sub: '' });
  assert.deepEqual(playParts('D. Jones 罰進 2/2', '76人'), { main: 'D. Jones 罰進 2/2', sub: '76人' });
});

// Lakers at Warriors, 2026-10-06: the Warriors at 83% midway through the
// first quarter, drifting to 98% by half time; the run's dot was at half time.
test('basketball: a run that did its work early ends there, not where the drift after it peaked', () => {
  const pts = [];
  let [h, a] = [0, 0];
  const add = (v, n, dh, da) => pts.push({ home: v, n, play: { home: (h += dh), away: (a += da), clock: '' } });
  for (let i = 0; i < 5; i++) add(0.5, 1, 1, 1);
  for (let i = 0; i < 15; i++) add(0.5 + (i + 1) * 0.026, 1, 2, 0); // the run: 0.5 → 0.89
  for (let i = 0; i < 80; i++) add(0.89 + (i + 1) * 0.0011 + (i % 4 === 0 ? -0.01 : 0), i < 40 ? 1 : 2, 1, 1); // the drift: → 0.98
  const run = playMoments(pts, 'basketball', { home: { id: 'h', name: 'H' }, away: { id: 'a', name: 'A' }, en: false }).find(m => m.periods);
  assert.ok(run && run.i <= 22, `the run ends with the run, not at ${run?.i}`);
  assert.equal(run.text, 'H 30-0 攻勢');
});

// Brewers at Padres, 2026-10-06: three 9th-inning plays at +9% were kept
// (every late play was) over the Padres' 3rd-inning rally (+19% from five
// small plays, none over 9%), which wasn't a moment at all.
test("baseball: an inning's rally of small plays is one moment; late plays compete with earlier ones", () => {
  const pts = [];
  const add = (v, n, half, play = {}) => pts.push({ home: v, n, half, play: { text: 'x', type: 'Play Result', ...play } });
  add(0.5, 1, 'top', { home: 0, away: 0 });
  add(0.6, 3, 'top', { home: 0, away: 0 });
  // The rally: 0.6 → 0.8 over five plays, two runs (the home side from 0-0 to 2-0: a lead).
  [0.64, 0.66, 0.69, 0.71, 0.8].forEach((v, k) => add(v, 3, 'bottom', { home: k >= 2 ? (k === 4 ? 2 : 1) : 0, away: 0, scoring: k === 2 || k === 4, value: 1 }));
  add(0.8, 4, 'top', { home: 2, away: 0 });
  // The 9th: walks at 8-9% each, then the game's last play.
  [0.71, 0.63, 0.55].forEach(v => add(v, 9, 'top', { home: 2, away: 0 }));
  add(1, 9, 'top', { home: 2, away: 0 });
  const list = playMoments(pts, 'baseball', { home: { id: 'h', name: '教士' }, away: { id: 'a', name: '釀酒人' }, en: false });
  const rally = list.find(m => m.rally);
  assert.equal(rally?.text, '教士 3局下攻下 2 分 · 超前');
  assert.ok(list.length <= 6);
  // Its five plays aren't moments of their own.
  assert.equal(list.filter(m => pts[m.i].n === 3 && pts[m.i].half === 'bottom').length, 1);
});
