// A game's page draws once and nothing on it moves as the rest is read (Jay
// 2026-11-03: "預計先發 still jump me after you show all other data"; it
// came in last and pushed the page down). Every read past the game's own
// page goes through openMatch's one door, later(key, read), and its part is
// held in the shape that's coming (the kit's waiting) until it lands. A new
// section that draws from a read of its own and skips that door fails here;
// Orbit-Core's tools/live-scroll.mjs watches the real page load ("late").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { asksLineups, pregameLineups } from '../public/lib/espn.mjs';

const src = readFileSync(new URL('../public/sheets.js', import.meta.url), 'utf8');
const open = src.slice(src.indexOf('export async function openMatch('), src.indexOf('\n}\n', src.indexOf('export async function openMatch(')));
// Each call's own text: from its opening parenthesis to the one that closes it.
const calls = (text, re) => {
  const out = [];
  for (const m of text.matchAll(re)) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    for (; i < text.length; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')' && --depth === 0) break;
    }
    out.push({ at: m.index, text: text.slice(m.index, i + 1) });
  }
  return out;
};

test('every read that draws the game page when it lands goes through later() (or changes only what is already there)', () => {
  const doors = calls(open, /\blater\(/g).filter(c => !c.text.startsWith('later = '));
  assert.ok(doors.length >= 5, 'the late reads go through later()');
  const inDoor = at => doors.some(d => at >= d.at && at < d.at + d.text.length);
  const bad = calls(open, /\.(then|finally)\(/g).filter(c => /\bpaint\(\)/.test(c.text) && !/coming\.delete\(key\)/.test(c.text) && !inDoor(c.at) && !/in place/.test(open.slice(Math.max(0, c.at - 400), c.at + c.text.length)));
  assert.deepEqual(
    bad.map(c => c.text.slice(0, 120)),
    [],
    'a read that draws when it lands: later(key, read), its part held in overview while still(key)'
  );
  // (The door itself draws: no read through it draws on its own.)
  for (const d of doors) assert.doesNotMatch(d.text, /\bpaint\(\)/, d.text.slice(0, 80));
});

test("each late read's part is held while it's coming", () => {
  const keys = [...new Set([...open.matchAll(/\blater\(\s*'([a-z]+)'/g)].map(m => m[1]))];
  assert.deepEqual(keys.sort(), ['form', 'injuries', 'lineups', 'season', 'squads', 'table']);
  for (const k of keys) assert.ok(src.includes(`still('${k}')`) || src.includes(`coming.has('${k}')`), `${k}: held in its shape while it's read`);
});

test('the held shapes go through the kit (an older kit without it: nothing held, as before)', () => {
  assert.match(src, /kitUI\.waiting \? kitUI\.waiting\(shape/);
  assert.doesNotMatch(src, /import \{[^}]*\bwaiting\b[^}]*\} from '#kit\/ui\.mjs'/);
});

test('先發陣容 is held only where a read for it is coming', async () => {
  const at = Date.parse('2026-11-04T12:00:00Z');
  const game = (league, hours, extra = {}) => ({ kind: 'match', league, start: new Date(at + hours * 3_600_000).toISOString(), status: { state: 'pre' }, home: { id: '1' }, away: { id: '2' }, ...extra });
  assert.equal(asksLineups(game('nba', 20), at), true);
  assert.equal(asksLineups(game('nba', 12 * 24), at), true);
  assert.equal(asksLineups(game('mlb', 2 * 24), at), true);
  assert.equal(asksLineups(game('mlb', 4 * 24), at), false);
  assert.equal(asksLineups(game('epl', 24), at), true);
  assert.equal(asksLineups(game('epl', 12 * 24), at), true);
  assert.equal(asksLineups(game('nhl', 5), at), false);
  assert.equal(asksLineups(game('nba', 5, { status: { state: 'in' } }), at), false);
  // (Not asked: the read itself answers nothing, without a request.)
  assert.equal(await pregameLineups(game('nhl', 5), at), null);
});
