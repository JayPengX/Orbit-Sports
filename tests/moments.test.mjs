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
