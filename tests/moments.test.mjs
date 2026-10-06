import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSummary } from '../public/lib/espn.mjs';
import { playMoments, eventMoments, swings } from '../public/lib/moments.mjs';

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
  assert.match(top.text, /射門得分$/);
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
      { category: 'SafetyCar', message: 'VIRTUAL SAFETY CAR ENDING', lap: 29 }
    ],
    m => m.lap,
    53
  );
  assert.deepEqual(bands.map(b => b.slice(0, 3)), [[3, 3, 'sc'], [3, 4, 'red'], [28, 29, 'vsc']]);
});
