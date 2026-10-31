import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fairChances, parseSummary } from '../public/lib/espn.mjs';

const pct = xs => xs.map(x => Math.round(x * 100));

test("a book's margin comes off the long shots most (Jay 2026-10-31: NE v Miami, Polymarket 35/23.5/42.5)", () => {
  const imp = ml => (ml < 0 ? -ml / (100 - ml) : 100 / (ml + 100));
  const [h, d, a] = fairChances([imp(165), imp(290), imp(125)]);
  assert.ok(Math.abs(h + d + a - 1) < 1e-9);
  assert.deepEqual(pct([h, d, a]), [35, 23, 42]);
  // Two-way: a heavy favourite keeps more than an even share gives it (90.9/13.3 → 87/13 evenly).
  const [f, u] = fairChances([imp(-1000), imp(650)]);
  assert.ok(f > 0.89 && Math.abs(f + u - 1) < 1e-9);
  // Prices already fair are left as they are.
  assert.deepEqual(pct(fairChances([0.6, 0.4])), [60, 40]);
});

test("a game to come: the sportsbook's 3-way prices on the card", () => {
  const team = id => ({ id });
  const s = parseSummary({ header: { competitions: [{ competitors: [{ homeAway: 'home', team: team('1') }, { homeAway: 'away', team: team('2') }] }] }, pickcenter: [{ provider: { name: 'DraftKings' }, homeTeamOdds: { moneyLine: 165 }, awayTeamOdds: { moneyLine: 125 }, drawOdds: { moneyLine: 290 } }] }, 'mls');
  assert.deepEqual(pct([s.predict.home, s.predict.draw]), [35, 23]);
});
