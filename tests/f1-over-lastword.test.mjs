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
