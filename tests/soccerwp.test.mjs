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
