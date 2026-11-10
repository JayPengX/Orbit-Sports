import test from 'node:test';
import assert from 'node:assert/strict';
import { strengths, chances, soccerLine, minuteOf } from '../public/lib/soccerwp.mjs';

// Lech–Sunderland, 2026-10-22: Lech +310, Sunderland -120, a draw +285.
const prior = { home: 0.232, draw: 0.248 };
const [lh, la] = strengths(prior);

test('strengths: the odds before the start come back out at kickoff', () => {
  const o = chances({ lh, la, minute: 0, period: 1 });
  assert.ok(Math.abs(o.home - prior.home) < 0.01 && Math.abs(o.draw - prior.draw) < 0.01);
  const [h, a] = strengths(null);
  assert.ok(h > a, 'no odds: a home side\'s usual edge');
});

test('a late level game is a draw\'s, more so each minute', () => {
  const at = m => chances({ lh, la, home: 1, away: 1, minute: m, period: 2 }).draw;
  assert.ok(at(70) > 0.45);
  assert.ok(at(85) > 0.65, `85': ${at(85)}`);
  assert.ok(at(92) > at(85) && at(85) > at(70));
});

test('a goal late all but settles it; a red card helps the other side', () => {
  const ahead = chances({ lh, la, home: 0, away: 1, minute: 88, period: 2 });
  assert.ok(1 - ahead.home - ahead.draw > 0.85);
  const even = chances({ lh, la, home: 0, away: 0, minute: 30, period: 1 });
  const homeDown = chances({ lh, la, home: 0, away: 0, minute: 30, period: 1, reds: [1, 0] });
  assert.ok(homeDown.home < even.home);
});

test('minuteOf reads the broadcast minute', () => {
  assert.equal(minuteOf("67'"), 67);
  assert.equal(minuteOf("90'+3'"), 93);
  assert.ok(Number.isNaN(minuteOf('HT')));
});

test('soccerLine: a point a minute, the equaliser moving it, ending at the status minute', () => {
  const k = 1_800_000_000;
  const timeline = [{ t: k, n: 1, type: 'kickoff' }, { t: k + 47 * 60, n: 1, type: 'halftime' }, { t: k + 62 * 60, n: 2, type: 'kickoff' }];
  const events = [{ t: k + 2 * 60, kind: 'score', play: { team: 'A' } }, { t: k + 62 * 60 + 25 * 60, kind: 'score', play: { team: 'H' } }];
  const now = k + 62 * 60 + 40 * 60;
  const line = soccerLine({ prior, timeline, events, status: { state: 'in', period: 2, clock: "85'" }, homeId: 'H', score: { home: '1', away: '1' }, now });
  assert.equal(line.source, 'model');
  const pts = line.points;
  assert.ok(pts.every((p, i) => !i || p.t > pts[i - 1].t));
  assert.ok(!pts.some(p => p.t > k + 47 * 60 && p.t < k + 62 * 60), 'nothing at half time');
  const before = pts.findLast(p => p.t < k + 87 * 60);
  const after = pts.find(p => p.t > k + 88 * 60);
  assert.ok(after.draw - before.draw > 0.2, 'the equaliser lifts the draw');
  assert.ok(pts.at(-1).draw > 0.65, `the end: ${JSON.stringify(pts.at(-1))}`);
});

test('soccerLine: no moments by the clock, still drawn from kickoff', () => {
  const start = new Date(1_800_000_000_000).toISOString();
  const line = soccerLine({ prior: null, status: { state: 'in', period: 1, clock: "20'" }, homeId: 'H', start, score: { home: '0', away: '0' }, now: 1_800_000_000 + 20 * 60 });
  assert.ok(line.points.length >= 20);
});

// Jay 2026-11-09: "should update during matches, not only after goals". Each
// side's shots (the commentary's words, as rough expected goals) move its
// rate for the rest: a side in the box again and again gains with no goal.
test('soccerLine: the shots move it between goals', async () => {
  const { shotXg, shotsOf, shownRates } = await import('../public/lib/soccerwp.mjs');
  assert.equal(shotXg('penalty---saved', 'Penalty saved. Cade Cowell (New York Red Bulls) right footed shot saved'), 0.76);
  assert.equal(shotXg('shot-on-target', 'Attempt saved. X (Y) left footed shot from the centre of the box is saved'), 0.12);
  assert.ok(Math.abs(shotXg('shot-off-target', 'Attempt missed. X (Y) header from the centre of the box is too high') - 0.078) < 1e-9);
  assert.equal(shotXg('shot-blocked', 'Attempt blocked. X (Y) right footed shot from outside the box is blocked.'), 0.03);
  assert.equal(shotXg('corner-awarded', 'Corner, Chelsea.'), 0);
  assert.equal(shotXg('own-goal', 'Own Goal by X'), 0);
  const shots = shotsOf([{ kind: 'shot-on-target', text: 'from very close range', clock: "20'", periodNum: 1, team: 'H' }, { kind: 'shot-blocked', text: 'from the centre of the box', clock: "45'+2'", periodNum: 1, team: 'A' }, { kind: 'foul', text: 'Foul by X', clock: "30'", periodNum: 1, team: 'A' }], 'H');
  assert.deepEqual(shots, [{ n: 1, minute: 20, home: true, xg: 0.4 }, { n: 1, minute: 47, home: false, xg: 0.12 }]);
  // What a side showed only counts once it happened; as much as expected leaves its rate as it was.
  assert.deepEqual(shownRates(1.5, 1.2, shots, 1, 19), [1.5 / (1 + 19 / 90), 1.2 / (1 + 19 / 90)]);
  assert.ok(shownRates(1.5, 1.2, shots, 1, 20)[0] > shownRates(1.5, 1.2, shots, 1, 19)[0]);
  // A 0–0 where the home side keeps shooting: its chance rises minute by minute, no goal.
  const k = 1_800_000_000;
  const timeline = [{ t: k, n: 1, type: 'kickoff' }];
  const many = Array.from({ length: 8 }, (_, i) => ({ n: 1, minute: 5 + i * 4, home: true, xg: 0.15 }));
  const at = s => soccerLine({ prior, timeline, events: [], shots: s, status: { state: 'in', period: 1, clock: "40'" }, homeId: 'H', score: { home: '0', away: '0' }, now: k + 40 * 60 });
  const [quiet, busy] = [at([]), at(many)];
  assert.ok(busy.points.at(-1).home - quiet.points.at(-1).home > 0.05, `${busy.points.at(-1).home} vs ${quiet.points.at(-1).home}`);
  const moves = busy.points.slice(1).filter((p, i) => p.home !== busy.points[i].home).length;
  assert.ok(moves > 30, `it moved ${moves} times`);
});
