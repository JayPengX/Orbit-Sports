import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sheets = readFileSync(new URL(`${process.env.ORBIT_SRC || '../public'}/sheets.js`, import.meta.url), 'utf8');

// Jay 2026-11-21: a qualifying over, its 排名 empty (Q3 nowhere) until an
// archive answered, an hour on. Opened after the flag with nothing kept on
// the phone: F1's feed read at once, its last word drawn over the shape.
test("a session just over, nothing of it kept: F1's feed read and its order shown until the official one", () => {
  assert.match(sheets, /if \(numbers && !lastWord && e\.league === 'f1' && Date\.now\(\) - Date\.parse\(ss\.start\) < 86_400_000\) \{/);
  assert.match(sheets, /liveTiming\(ss\.abbr, ss\.start\)\s*\.then\(feed => \{\s*if \(!feed \|\| !feedOver\(feed\)/);
  assert.match(sheets, /if \(holder\.querySelector\(':scope > ol\.waiting'\)\) put\(holder, f1Final\(null, \{ \.\.\.feed, final: true \}, ss\)\);/);
});

// Jay 2026-11-21: "F1 should have the countdown between sessions like other sport".
test("a qualifying break counts down to the next part's start as race control announced it", async () => {
  const { nextStartAt } = await import('../public/lib/f1.mjs');
  // Las Vegas: the circuit 8 hours behind UTC; said at 20:20 there, Q2 at 20:27 there.
  const feed = { session: { gmt: '-08:00:00' }, messages: [{ text: 'Q2 WILL START AT 20:27', at: '2026-11-21T04:20:05' }, { text: 'CHEQUERED FLAG', at: '2026-11-21T04:19:00' }] };
  assert.equal(nextStartAt(feed, Date.parse('2026-11-21T04:21:00Z')), Date.parse('2026-11-21T04:27:00Z'));
  // Passed: none.
  assert.equal(nextStartAt(feed, Date.parse('2026-11-21T04:30:00Z')), 0);
  // None said, or no offset: none.
  assert.equal(nextStartAt({ session: { gmt: '-08:00:00' }, messages: [{ text: 'GREEN LIGHT - PIT EXIT OPEN', at: '2026-11-21T04:00:00' }] }), 0);
  assert.equal(nextStartAt({ session: {}, messages: feed.messages }), 0);
  // A circuit ahead of UTC (Qatar, +3): said 18:40 there, Q3 at 18:52.
  assert.equal(nextStartAt({ session: { gmt: '03:00:00' }, messages: [{ text: 'Q3 WILL START AT 18:52', at: '2026-11-28T15:40:00' }] }, Date.parse('2026-11-28T15:41:00Z')), Date.parse('2026-11-28T15:52:00Z'));
  const sheets = readFileSync(new URL('../public/sheets.js', import.meta.url), 'utf8');
  assert.match(sheets, /const resume = !over && pause \? nextStartAt\(b\) : 0;/);
});
