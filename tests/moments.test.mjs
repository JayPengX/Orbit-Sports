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
  // No set number: what cleared the game's bar (the tying home run, the 4-run 5th).
  assert.ok(zh.length >= 2 && zh.length <= 10);
  assert.ok(zh.some(m => m.text === 'B. Rice 全壘打 · 1 分打點 · 追平' && m.side === 'away'));
  assert.ok(zh.every((m, i) => !i || m.i > zh[i - 1].i));
  const en = playMoments(s.winProb, 'baseball', { ...sideOf(s), en: true });
  assert.ok(en.some(m => m.text === 'B. Rice homers · 1 RBI · ties it'));
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

test('basketball: a run ending on a play with no score (a timeout) counts from the last score, never 0-0', () => {
  const pts = [];
  let [h, a] = [0, 0];
  const add = (v, dh, da) => pts.push({ home: v, n: 1, play: { home: (h += dh), away: (a += da) } });
  for (let i = 0; i < 6; i++) add(0.5, 1, 2);
  for (let i = 0; i < 6; i++) add(0.5 + (i + 1) * 0.04, 2, 0);
  // The run's last point: the timeout called after it, no score on it (Rockets 12-5, read "-5--12").
  pts.push({ home: 0.78, n: 1, play: { text: 'Spurs Full timeout' } });
  const [m] = playMoments(pts, 'basketball', { home: { id: '1', name: '火箭' }, away: { id: '2', name: '馬刺' }, en: false });
  assert.match(m.text, /^火箭 \d+-\d+ /);
  assert.equal(m.text, '火箭 12-0 超前');
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

test('F1: a red flag only said ends the safety car; it ends when the session starts again, not when the track is clear or the restart is set (Italian GP, 2026-09-06)', async () => {
  const { controlBands } = await import('../public/lib/winprob.mjs');
  const bands = controlBands(
    [
      { category: 'SafetyCar', message: 'SAFETY CAR DEPLOYED', lap: 3 },
      { category: 'Other', message: 'RED FLAG - RACE SUSPENDED', lap: 3 },
      { category: 'Flag', flag: 'CLEAR', message: 'TRACK CLEAR', lap: 4 },
      { category: 'Other', message: 'RESUMPTION ORDER: 63, 10, 3', lap: 4 },
      { category: 'Other', message: 'RACE WILL RESUME AT 15:39', lap: 4 },
      // A steward's word on a red flag broken isn't one.
      { category: 'Other', message: 'INCIDENT INVOLVING CAR 6 (HAD) NOTED - RED FLAG INFRINGEMENT', lap: 4 },
      { category: 'SessionStatus', message: 'SESSION STARTED', lap: 4 },
      { category: 'Other', message: 'STANDING START', lap: 4 },
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
  assert.match(stretch.text, /^尼克 \d+-\d+ 超前$/, "from behind to ahead");
  // The last possessions, who did what.
  const texts = list.map(m => m.text);
  assert.ok(texts.includes('V. Wembanyama 跳投不進'));
  assert.ok(texts.includes('J. Brunson 罰球命中 · 超前，此後未再落後'));
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
  assert.ok(texts.includes('J. Brunson 罰球命中 · 超前，此後未再落後'));
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
  // The go-ahead the winner never gave back, said so (Jay 2026-10-31); the loser's small late flickers left out.
  assert.ok(texts.includes('E. Okorie 上籃命中 · 超前，此後未再落後'));
  assert.ok(list.every(m => m.side === 'home' || Math.abs(m.delta) >= 0.25));
  // A free throw made and one missed on the same clock count as one stop.
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

// Cavaliers at 76ers, 2026-10-22: down 89-95, a 16-3 run; Embiid's jumper
// at 6:54 made it 96-95, but the (lagging) price peaked two baskets on, at
// 100-95, and 過程's 超前 row sat there. The row is on the play that took
// the lead; the chart's dot stays on the peak.
test('basketball: a run that takes the lead is placed on the play that took it, the dot on the price high', () => {
  const pts = [];
  let [h, a] = [0, 0];
  const add = (v, dh, da, id) => pts.push({ home: v, n: 4, play: { id, home: (h += dh), away: (a += da), clock: '' } });
  add(0.5, 84, 84, 'p0');
  for (let i = 0; i < 6; i++) add(0.5 - (i + 1) * 0.04, 0, 2, `c${i}`); // the Cavaliers to 84-96: 0.26
  add(0.24, 3, 0, 'r0'); // 87-96
  add(0.3, 2, 0, 'r1'); // 89-96
  add(0.36, 0, 0, 'm0');
  add(0.44, 2, 0, 'r2'); // 91-96
  add(0.5, 2, 0, 'r3'); // 93-96
  add(0.55, 2, 0, 'r4'); // 95-96
  add(0.6, 2, 0, 'flip'); // 97-96: the lead
  add(0.72, 2, 0, 'r6'); // 99-96
  add(0.86, 2, 0, 'peak'); // 101-96, the price's high
  for (let i = 0; i < 4; i++) add(0.85, 1, 1, `t${i}`);
  const run = playMoments(pts, 'basketball', { home: { id: 'h', name: '76人' }, away: { id: 'a', name: '騎士' }, en: false }).find(m => m.periods && m.side === 'home');
  assert.ok(run, 'the run');
  assert.match(run.text, /超前$/);
  assert.equal(pts[run.i].play.id, 'peak', 'the dot on the price high');
  assert.equal(pts[run.lead].play.id, 'flip', 'the row on the play that took the lead');
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

test('baseball: no set number of moments; a seesaw keeps every lead change, a blowout only its big swings', () => {
  const pts = [];
  const add = (v, n, play = {}, half = 'bottom') => pts.push({ home: v, n, half, play: { text: 'x', type: 'Play Result', ...play } });
  add(0.42, 1, { home: 0, away: 0 });
  // Eight lead changes, each a run worth 8-9%: all kept, more than the old six.
  let [h, a] = [0, 0];
  for (let k = 0; k < 8; k++) {
    k % 2 ? (a += 2) : (h += 2);
    add(k % 2 ? 0.42 : 0.51, k + 1, { home: h, away: a, scoring: true, value: 2 }, k % 2 ? 'top' : 'bottom');
  }
  const seesaw = playMoments(pts, 'baseball', { home: { id: 'h', name: 'H' }, away: { id: 'a', name: 'A' }, en: false });
  assert.equal(seesaw.filter(m => m.turned).length, 8);
  // A blowout's wobbles (4-6% each next to a 40% swing) are no moments.
  const blow = [{ home: 0.5, n: 1, play: { text: 'x', home: 0, away: 0 } }, { home: 0.9, n: 1, play: { text: 'x', home: 5, away: 0, scoring: true } }];
  for (let k = 0; k < 10; k++) blow.push({ home: k % 2 ? 0.95 : 0.89, n: 2 + k, play: { text: 'x', home: 5, away: 0 } });
  assert.equal(playMoments(blow, 'baseball', { home: { id: 'h', name: 'H' }, away: { id: 'a', name: 'A' }, en: false }).length, 1);
});

// Nuggets at Jazz, 2026-10-06: a three at +15% and a missed one at +19%
// in the 3rd quarter (ESPN's line jumping and back) were key moments.
test('basketball: a single possession in mid-game is never a moment, only the runs', () => {
  const pts = [];
  let [h, a] = [0, 0];
  const add = (v, n, dh, da, clock = '6:00') => pts.push({ home: v, n, play: { home: (h += dh), away: (a += da), clock, text: 'x', type: 'Jump Shot' } });
  for (let i = 0; i < 20; i++) add(0.5, 1, 1, 1, `${11 - (i % 10)}:00`);
  add(0.65, 2, 3, 0, '9:55'); // a three: +15%
  add(0.5, 2, 0, 0, '9:40'); // and back
  for (let i = 0; i < 15; i++) add(0.5 - (i + 1) * 0.025, 3, 0, 2, `${10 - (i % 10)}:30`); // the run: 0.5 → 0.125
  const list = playMoments(pts, 'basketball', { home: { id: 'h', name: 'H' }, away: { id: 'a', name: 'A' }, en: false });
  assert.ok(list.length >= 1 && list.every(m => m.periods), list.map(m => m.text).join(' / '));
});

// Trail Blazers at Warriors, 2026-10-08: the Warriors' 19-10 from 22-31 to
// 41-41 was told as 拉開 (a long stretch) when it levelled the game.
test('basketball: a run says what it did to the score: levelled, went ahead, closed in, or built a lead', () => {
  const run = (h0, a0, dh, da) => {
    const pts = [];
    let [h, a] = [h0, a0];
    const add = (v, dH, dA) => pts.push({ home: v, n: 1, play: { home: (h += dH), away: (a += dA), clock: '' } });
    for (let i = 0; i < 3; i++) add(0.3, 0, 0);
    for (let i = 0; i < 15; i++) add(0.3 + (i + 1) * 0.02, i < dh ? 1 : 0, i < da ? 1 : 0);
    for (let i = 0; i < 3; i++) add(0.6, 0, 0);
    return playMoments(pts, 'basketball', { home: { id: 'h', name: 'H' }, away: { id: 'a', name: 'A' }, en: false }).find(m => m.periods)?.text;
  };
  assert.match(run(22, 31, 12, 3), /追平$/);
  assert.match(run(22, 31, 15, 2), /超前$/);
  assert.match(run(10, 30, 12, 2), /追近$/);
  assert.match(run(30, 20, 12, 2), /攻勢$/);
});

import { lineupZh, playText } from '../public/lib/moments.mjs';
test("baseball's lineup changes said as such, never an at-bat's words (Kelly relieved Sulser read as a lineout)", () => {
  const lc = text => ({ text, alt: 'Lineup Change', type: 'Play Result', who: 'K. Kelly' });
  assert.equal(playText('baseball', lc('Kelly relieved Sulser'), false), '換投：Kelly 接替 Sulser');
  assert.equal(lineupZh(lc('Martínez hit for Halpin')), '代打：Martínez 替 Halpin');
  assert.equal(lineupZh(lc('Mullins ran for Vilade')), '代跑：Mullins 替 Vilade');
  assert.equal(lineupZh(lc('Mullins in center field.')), '守備調整：Mullins 改守中外野');
  assert.equal(lineupZh(lc('Hicks catching.')), '守備調整：Hicks 擔任捕手');
  assert.equal(lineupZh(lc('Genao at second base.')), '守備調整：Genao 改守二壘');
  assert.equal(lineupZh({ text: 'Lowe flied out to left.', alt: '' }), '');
});

test("baseball: a balk, a pickoff, caught stealing in Chinese; a lineup's word never a line drive", () => {
  const at = text => playText('baseball', { text, alt: '', type: 'Play Result', who: 'A. Martinez' }, false);
  assert.equal(at('Martínez to second on a balk.'), 'A. Martinez 投手犯規');
  assert.equal(at('Martínez caught stealing second.'), 'A. Martinez 盜壘失敗');
  assert.equal(at('Martínez picked off first.'), 'A. Martinez 牽制出局');
  assert.equal(at('Martínez lined out to center.'), 'A. Martinez 平飛出局');
});

// Brewers at Dodgers, 2026-10-18: a 4-run 2nd read 道奇 2局下攻下 4 分, never
// saying Ohtani's homer drove in 3 of them.
test("baseball: an inning's rally names its biggest hit, the inning's runs under it", () => {
  const pts = [];
  const add = (v, n, half, play = {}) => pts.push({ home: v, n, half, play: { text: 'x', type: 'Play Result', ...play } });
  add(0.5, 1, 'top', { home: 0, away: 0 });
  add(0.5, 2, 'top', { home: 0, away: 0 });
  add(0.56, 2, 'bottom', { home: 1, away: 0, scoring: true, value: 1, who: 'M. Rojas', alt: 'Single' });
  add(0.6, 2, 'bottom', { home: 1, away: 0 });
  add(0.69, 2, 'bottom', { home: 4, away: 0, scoring: true, value: 3, who: 'S. Ohtani', alt: 'Home Run', pic: 'ohtani' });
  add(0.74, 2, 'bottom', { home: 4, away: 0 });
  add(0.74, 3, 'top', { home: 4, away: 0 });
  const side = { home: { id: 'h', name: '道奇' }, away: { id: 'a', name: '釀酒人' }, en: false };
  const rally = playMoments(pts, 'baseball', side).find(m => m.rally);
  assert.equal(rally?.text, 'S. Ohtani 全壘打 · 3 分打點 · 這局共 4 分 · 超前');
  assert.equal(rally.pic, 'ohtani');
  assert.equal(rally.pics, null);
  const en = playMoments(pts, 'baseball', { ...side, en: true }).find(m => m.rally);
  assert.match(en.text, /4-run inning/);
});

test("baseball: back-to-back homers are named together, not one as if it were the inning", () => {
  const pts = [];
  const add = (v, n, half, play = {}) => pts.push({ home: v, n, half, play: { text: 'x', type: 'Play Result', ...play } });
  add(0.5, 1, 'top', { home: 0, away: 0 });
  add(0.5, 2, 'top', { home: 0, away: 0 });
  add(0.58, 2, 'bottom', { home: 1, away: 0, scoring: true, value: 1, who: 'S. Ohtani', alt: 'Home Run', pic: 'ohtani' });
  add(0.66, 2, 'bottom', { home: 2, away: 0, scoring: true, value: 1, who: 'M. Betts', alt: 'Home Run', pic: 'betts' });
  add(0.7, 2, 'bottom', { home: 2, away: 0 });
  add(0.7, 3, 'top', { home: 2, away: 0 });
  const side = { home: { id: 'h', name: '道奇' }, away: { id: 'a', name: '釀酒人' }, en: false };
  const rally = playMoments(pts, 'baseball', side).find(m => m.rally);
  assert.equal(rally?.text, 'S. Ohtani、M. Betts 背靠背全壘打 · 這局共 2 分 · 超前');
  // Two named, two faces.
  assert.deepEqual(rally.pics, ['ohtani', 'betts']);
});

test("baseball: an inning of small hits, none big, reads as the string of them", () => {
  const pts = [];
  const add = (v, n, half, play = {}) => pts.push({ home: v, n, half, play: { text: 'x', type: 'Play Result', ...play } });
  add(0.5, 1, 'top', { home: 0, away: 0 });
  add(0.5, 2, 'top', { home: 0, away: 0 });
  [['F. Freeman', 'Single'], ['T. Hernández', 'Double'], ['W. Smith', 'Single'], ['M. Muncy', 'Single']].forEach(([who, alt], k) => add(0.55 + k * 0.05, 2, 'bottom', { home: k + 1, away: 0, scoring: true, value: 1, who, alt }));
  add(0.72, 2, 'bottom', { home: 4, away: 0 });
  add(0.72, 3, 'top', { home: 4, away: 0 });
  const side = { home: { id: 'h', name: '道奇' }, away: { id: 'a', name: '釀酒人' }, en: false };
  const rally = playMoments(pts, 'baseball', side).find(m => m.rally);
  assert.equal(rally?.text, 'F. Freeman、T. Hernández 等串聯 · 4 次打點 · 這局共 4 分 · 超前');
});

test('baseball: the pitching that held it, the pitcher credited, a few at most', () => {
  const pts = [];
  const add = (v, n, half, play = {}) => pts.push({ home: v, n, half, play: { text: 'x', type: 'Play Result', home: 0, away: 0, ...play } });
  add(0.5, 1, 'top');
  // Bases loaded in the 7th: the strikeout that ended it, Brewers (home) up 16%.
  add(0.4, 7, 'top');
  add(0.56, 7, 'top', { alt: 'Strikeout Swinging', who: 'S. Ohtani', pitcher: { who: 'J. Misiorowski', pic: 'miz' } });
  // Small outs aren't moments.
  for (let k = 0; k < 6; k++) add(0.56 + k * 0.01, 8, 'top', { alt: 'Groundout', who: 'X', pitcher: { who: 'A. Uribe' } });
  const side = { home: { id: 'h', name: '釀酒人' }, away: { id: 'a', name: '道奇' }, en: false };
  const list = playMoments(pts, 'baseball', side);
  assert.equal(list.length, 1);
  assert.equal(list[0].text, 'J. Misiorowski 三振 S. Ohtani');
  assert.equal(list[0].pic, 'miz');
  assert.equal(list[0].team, 'h');
  assert.equal(playMoments(pts, 'baseball', { ...side, en: true })[0].text, 'J. Misiorowski strikes out S. Ohtani');
});

test('F1: the start told as itself, not by the short virtual safety car on lap 2 (US GP, 2026-10-25)', async () => {
  const { raceMoments } = await import('../public/lib/moments.mjs');
  // Antonelli from pole 45% to 64% over the first lap, steady through a 14-second VSC on lap 2, then on.
  const points = Array.from({ length: 12 }, (_, lap) => ({ lap, c: [lap === 0 ? 0.45 : lap === 1 ? 0.64 : 0.64 + (lap - 2) * 0.01, lap === 0 ? 0.48 : 0.3] }));
  const list = raceMoments(points, ['安東內利', '維斯塔潘'], [{ i0: 1, i1: 2, kind: 'vsc', from: 2, to: 2 }], [], false, null, 1);
  assert.deepEqual(list.map(m => m.text), ['起跑', '虛擬安全車']);
  assert.ok(Math.abs(list[0].delta - 0.19) < 1e-9);
  assert.equal(list[0].k, 0);
  // (Read to two laps after it: the steady 1% a lap, under the 3 points a chip is shown for.)
  assert.ok(Math.abs(list[1].delta) < 0.03);
});

test('F1: a safety car turned red flag is one moment with its cause; a climb through the field is a moment; a lead on the first lap is the start\'s (Mexico 2026)', async () => {
  const { raceMoments } = await import('../public/lib/moments.mjs');
  // Laps 0–50: Verstappen up from 50% to 75%, Hamilton level at 10%, Leclerc down.
  const points = Array.from({ length: 51 }, (_, lap) => ({ lap, c: [0.5 + Math.max(0, lap - 28) * 0.012, 0.1, Math.max(0.05, 0.4 - lap * 0.008)] }));
  const bands = [
    { i0: 6, i1: 8, kind: 'vsc', from: 7, to: 8 },
    { i0: 43, i1: 45, kind: 'sc', from: 44, to: 45, why: 'out', who: ['Valtteri Bottas'] },
    { i0: 44, i1: 46, kind: 'red', from: 45, to: 46 }
  ];
  const events = [{ i: 1, kind: 'lead', k: 2 }, { i: 44, kind: 'climb', k: 0, from: 5, to: 1, i0: 29, lap0: 29, lap1: 44 }, { i: 44, kind: 'lead', k: 0 }, { i: 44, kind: 'climb', k: 2, from: 6, to: 2, i0: 29, lap0: 29, lap1: 44 }];
  const list = raceMoments(points, ['Verstappen', 'Hamilton', 'Leclerc'], bands, events, false, n => n.split(' ').at(-1), 1);
  const texts = list.map(m => m.text);
  assert.ok(texts.includes('起跑 · Leclerc 領先'), texts.join(' / '));
  assert.ok(texts.includes('安全車轉紅旗 · Bottas 退賽'), texts.join(' / '));
  assert.ok(texts.includes('Verstappen 升到領先 · 從第 5'), texts.join(' / '));
  // (The lead at the climb's end is the climb's, not said twice.)
  assert.ok(!texts.includes('Verstappen 取得領先'));
  assert.deepEqual(list.find(m => m.climb).laps, [29, 44]);
  // Leclerc's places back as the others stopped, his chance down: no climb.
  assert.ok(!texts.some(t => t.startsWith('Leclerc 從')));
});

test('F1: a lead the market doubts (its chance down) is told by who gained over it', async () => {
  const { raceMoments } = await import('../public/lib/moments.mjs');
  const pts = [[0.6, 0.35], [0.6, 0.35], [0.66, 0.3], [0.66, 0.3]].map(c => ({ c }));
  const [m] = raceMoments(pts, ['Antonelli', 'Verstappen'], [], [{ i: 1, kind: 'lead', k: 1 }], false);
  assert.equal(m.text, 'Verstappen 取得領先');
  assert.equal(m.gain.k, 0);
  assert.ok(Math.abs(m.gain.delta - 0.06) < 1e-9);
});

// Warriors at Timberwolves, 2026-10-28: a stretch over the 1st and 2nd
// quarters, Warriors 47-29 超前, went ahead at 19-17 early in the 1st; the
// chart's label and 關鍵時刻 read "第1–2節 · 19–17" under 47-29. A lead taken
// in an earlier quarter than the stretch ended is no `lead`: told at its end.
test('basketball: a stretch over two quarters that went ahead early is told at its end, not at the lead', () => {
  const pts = [];
  let [h, a] = [0, 0];
  const add = (v, dh, da, n, id) => pts.push({ home: v, n, play: { id, home: (h += dh), away: (a += da), clock: '' } });
  add(0.5, 0, 0, 1, 'p0');
  add(0.45, 0, 3, 1, 'a0'); // 0-3
  add(0.5, 3, 0, 1, 'b0'); // 3-3
  add(0.55, 2, 0, 1, 'flip'); // 5-3: ahead, in the 1st
  for (let i = 0; i < 20; i++) add(0.55 + (i + 1) * 0.018, i % 2 ? 2 : 3, i % 3 ? 1 : 0, i < 10 ? 1 : 2, `s${i}`);
  for (let i = 0; i < 4; i++) add(0.91, 1, 1, 2, `t${i}`);
  const run = playMoments(pts, 'basketball', { home: { id: 'h', name: '勇士' }, away: { id: 'a', name: '灰狼' }, en: false }).find(m => m.periods && m.side === 'home');
  assert.ok(run, 'the stretch');
  assert.deepEqual(run.periods, [1, 2]);
  assert.match(run.text, /超前$/);
  assert.equal(run.lead, undefined, 'no lead from the 1st for a stretch that ended in the 2nd');
});

// Raptors at Lakers, 2026-11-02: the Lakers' 28-8 run went ahead at 9-6 and
// went on to 31-14; told at 6-9 it read "28-8" in a 6-9 score (Jay 2026-11-03).
test('basketball: a run never counts more points than the score its row shows', () => {
  const pts = [];
  let [h, a] = [0, 0];
  const add = (v, dh, da) => pts.push({ home: v, n: 1, play: { home: (h += dh), away: (a += da), clock: '' } });
  add(0.5, 3, 6); // 3-6 (Raptors away)
  for (let i = 0; i < 4; i++) add(0.5, 0, 0);
  add(0.52, 3, 0); // 6-6
  add(0.56, 3, 0); // 9-6: ahead
  for (let i = 0; i < 11; i++) add(0.58 + i * 0.027, 2, i % 3 === 0 ? 2 : 0); // on to 31-14
  for (let i = 0; i < 6; i++) add(0.86, 1, 1);
  const side = { home: { id: 'h', name: '湖人' }, away: { id: 'a', name: '暴龍' }, en: false };
  const runs = playMoments(pts, 'basketball', side).filter(m => m.periods);
  assert.ok(runs.length, 'the run');
  for (const m of runs) {
    const [us, them] = m.text.match(/(\d+)-(\d+)/).slice(1).map(Number);
    const at = pts[m.lead ?? m.i].play;
    const [mine, theirs] = m.side === 'home' ? [at.home, at.away] : [at.away, at.home];
    assert.ok(us <= mine && them <= theirs, `${m.text} told at ${at.away}-${at.home}`);
  }
  // Told where it ended, whole.
  const run = runs.find(m => m.side === 'home');
  assert.equal(run.lead, undefined);
  assert.match(run.text, /^湖人 2\d-\d+ 超前/);
});

// Own goals (Nashville 3–2 Red Bulls, MLS 2026-11-01: Parker's at 45' and
// Bazán's at 78', both Red Bulls defenders, both Nashville's goals). ESPN files
// an own goal under the side it counts for and names the defender who put it in,
// as the rules credit it, in every soccer league (EPL, Bundesliga, Serie A,
// Scotland, the Champions League checked the same, 2026-11-06). Told as one
// everywhere: never "T. Parker 進球" with his face beside 納什維爾 +19% (Jay 2026-11-06).
test('soccer: an own goal is told as one, its face the side it counted for', async () => {
  const { soccerLine } = await import('../public/lib/soccerwp.mjs');
  const { ownGoal, feedText } = await import('../public/lib/moments.mjs');
  const s = parseSummary(fixture('mls-own-goals-summary.json'), 'mls');
  const own = s.events.filter(ev => ev.kind === 'score' && ownGoal(ev.play));
  assert.deepEqual(own.map(ev => [ev.play.who, ev.play.team]), [['T. Parker', String(s.home.id)], ['J. Bazán', String(s.home.id)]]);
  const line = soccerLine({ prior: null, timeline: s.timeline, events: s.events, status: { state: 'post', period: 2 }, homeId: s.home.id, score: { home: '3', away: '2' } });
  const pts = line.points;
  const side = en => ({ home: { id: s.home.id, name: '納什維爾' }, away: { id: s.away.id, name: '紐約紅牛' }, en });
  const zh = eventMoments(pts, s.events, 'soccer', side(false), pts.map(p => p.t));
  const ogs = zh.filter(m => m.own);
  assert.deepEqual(ogs.map(m => m.text), ['T. Parker 烏龍球', 'J. Bazán 烏龍球']);
  // The side it counted for: its badge for a face (no defender's photo), its gain.
  for (const m of ogs) {
    assert.equal(m.pic, null);
    // The defender kept, for a small head under the badge (a tap to his page).
    assert.ok(m.by?.id);
    assert.equal(String(m.team), String(s.home.id));
    assert.equal(m.side, 'home');
    assert.ok(m.delta > 0);
  }
  // A goal of their own stays a goal, with its scorer's face.
  const goals = zh.filter(m => !m.own && m.icon === '⚽');
  assert.ok(goals.length === 3 && goals.every(m => /進球$/.test(m.text) && m.pic));
  const en = eventMoments(pts, s.events, 'soccer', side(true), pts.map(p => p.t)).filter(m => m.own);
  assert.deepEqual(en.map(m => m.text), ['T. Parker own goal', 'J. Bazán own goal']);
  // 過程: the side's goal, the defender's own goal in brackets.
  assert.equal(feedText('soccer', own[0].play, false, '納什維爾'), '納什維爾 進球（T. Parker 烏龍球）');
});

test('sheets: an own goal is a goal\'s dot on the chart (Jay 2026-11-06), the defender\'s small head under the badge, named 烏龍球', () => {
  const src = readFileSync(new URL('../public/sheets.js', import.meta.url), 'utf8');
  // The chart's dots: one kind for every goal, an own goal's too.
  const pins = src.slice(src.indexOf('const pins = dotted.map'), src.indexOf('\n', src.indexOf('const pins = dotted.map')));
  assert.doesNotMatch(pins, /own|og/);
  assert.doesNotMatch(readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8'), /\.wp-moment\.og/);
  assert.match(src, /x\.kind === 'own' \? \(en \? 'own goal' : '烏龍球'\)/);
  // The defender's small head under the badge, his row a tap to his page.
  assert.match(src, /m\.own \? el\('span', \{ class: 'wp-pair og' \}/);
  assert.match(src, /const can = p\.id && LEAGUES/);
});

// World Series game 5, Brewers at Rays, 2026-10-28 (Jay 2026-11-06): Simpson's
// RBI double, the Rays down 4-0 with two out in the 9th, read 釀酒人 +2%. The
// half was measured whole, to the last out, which took the Rays to 0%. A run
// only ever helps the side that scored, in every sport's 勝率走勢.
test("a score helps only the side that scored (Simpson's 9th-inning double for the Rays, down 4-0)", () => {
  const s = parseSummary(fixture('mlb-ws5-2026-summary.json'), 'mlb');
  const side = { home: { id: s.home.id, name: '光芒' }, away: { id: s.away.id, name: '釀酒人' }, en: false };
  const list = playMoments(s.winProb, 'baseball', side);
  const simpson = list.find(m => /Simpson/.test(m.text));
  assert.equal(simpson.side, 'home');
  assert.ok(simpson.delta > 0, `the Rays' gain, not the Brewers' (${simpson.delta})`);
  // The line itself moves up (towards the Rays) on the double.
  assert.ok(s.winProb[simpson.i].home > s.winProb[simpson.i - 1].home);
  // Every rally: the batting side's, its number in that side's favour.
  for (const m of list.filter(m => m.rally)) {
    const bats = s.winProb[m.i].half === 'top' ? 'away' : 'home';
    assert.equal(m.side, bats, m.text);
    assert.ok(bats === 'home' ? m.delta >= 0 : m.delta <= 0, m.text);
  }
});

test('a late goal for the side behind, the final whistle inside its five minutes: the scorer\'s lift, not the settling', () => {
  // Home 2-0 up; the away side scores at 90' (their chance 2% → 5%), the whistle at 93' (→ 0%).
  const times = [5280, 5340, 5400, 5430, 5460, 5520, 5580];
  const pts = [0.98, 0.98, 0.98, 0.95, 0.95, 0.97, 1].map((home, k) => ({ home, t: times[k] }));
  const events = [{ t: 5400, kind: 'score', play: { team: 'a', who: 'X', kind: 'goal' } }];
  const [m] = eventMoments(pts, events, 'soccer', { home: { id: 'h', name: 'H' }, away: { id: 'a', name: 'A' }, en: false }, times);
  assert.equal(m.side, 'away');
  assert.ok(m.delta < 0, `the away side's lift (${m.delta})`);
});

// Lakers at Pistons, 2026-11-08: Reaves' three at 45.6 (112-104, the Pistons
// 14% → 2%), Huerter's three straight back (112-107): the three was marked as
// the end's key play, though it moved nothing that lasted (Jay 2026-11-09).
test('basketball: a late basket the other side answered at once with as much is not a key moment', () => {
  const side = { home: { id: 'det', name: 'DET' }, away: { id: 'lal', name: 'LAL' }, en: false };
  const line = answer => {
    const pts = [];
    const add = (v, n, clock, home, away, extra = {}) => pts.push({ home: v, n, play: { home, away, clock, type: '', text: '', ...extra } });
    for (let i = 0; i < 40; i++) add(0.3, i < 30 ? 1 : 4, i < 30 ? '5:00' : `${3 - i / 40}:00`.replace('.', ''), 50 + i, 52 + i);
    add(0.14, 4, '1:06', 104, 109, { scoring: true, team: 'det', text: 'Paul Reed makes tip shot' });
    add(0.02, 4, '45.6', 104, 112, { scoring: true, team: 'lal', text: 'Austin Reaves makes 27-foot three pointer', who: 'A. Reaves' });
    add(0.016, 4, '36.6', 104, 112, { team: 'det', text: 'Cade Cunningham offensive rebound' });
    if (answer) add(0.053, 4, '32.4', 107, 112, { scoring: true, team: 'det', text: 'Kevin Huerter makes 27-foot three point jumper' });
    else add(0.004, 4, '32.4', 104, 112, { team: 'det', text: 'Kevin Huerter misses 27-foot three point jumper' });
    add(0.0, 4, '0.0', answer ? 116 : 113, 121, { type: 'End Game', text: 'End of Game' });
    return playMoments(pts, 'basketball', side);
  };
  assert.ok(!line(true).some(m => m.clutch && /Reaves/.test(m.text)), 'answered: not key');
  assert.ok(line(false).some(m => m.clutch && /Reaves/.test(m.text)), 'not answered: key');
});

// A game over said by what it meant, not the winner at 100% (Jay 2026-11-09).
test("a finished game's line: each side's chance before it, an upset, the winner's lowest", async () => {
  const { gameArc } = await import('../public/lib/wpline.mjs');
  // Lakers (away) at Pistons, the book's 72% for Detroit: the Lakers won from 28%, as low as 8% on the way.
  const pts = [{ home: 0.7 }, { home: 0.92 }, { home: 0.4 }, { home: 0.0, settled: true }];
  const arc = gameArc(pts, { home: 0.718 }, 'L');
  assert.equal(arc.side, 'away');
  assert.ok(Math.abs(arc.pre - 0.282) < 1e-9 && arc.upset);
  assert.ok(Math.abs(arc.low - 0.08) < 1e-9, 'the settled end is not a low');
  // No book: the line's first point; a draw's own chance.
  const draw = gameArc([{ home: 0.45, draw: 0.27 }, { home: 0.2, draw: 0.6 }], null, 'D');
  assert.deepEqual([draw.side, draw.pre, draw.upset, draw.start.away.toFixed(2)], ['draw', 0.27, false, '0.28']);
  assert.equal(gameArc([], null, 'W'), null);
  assert.equal(gameArc(pts, null, ''), null);
});
