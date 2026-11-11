// A game past its hour, its broadcast on and ESPN still 'pre' (an NBA game
// tips ten minutes after its listed time): the home card said 轉播中 ·
// 即將開賽 while the game's own page said 09:00 今天 as if it were hours off
// (Jay 2026-11-11, Celtics at 76ers). The page's head takes the same one rule
// as the card and every row (onAir), and reads on every beat until the tip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onAir } from '../public/lib/espn.mjs';

const src = readFileSync(new URL('../public/sheets.js', import.meta.url), 'utf8');
const open = src.slice(src.indexOf('export async function openMatch('), src.indexOf('\n}\n', src.indexOf('export async function openMatch(')));
const head = open.slice(open.indexOf('const paintHeader = sm =>'), open.indexOf('paintHeader(null);'));

const START = Date.parse('2026-11-11T01:00:00Z');
const game = (state, extra = {}) => ({ league: 'nba', id: '401909961', start: '2026-11-11T01:00Z', status: { state }, ...extra });

test('a game past its hour and not begun is on air; hours before, or long after, it is not', () => {
  assert.equal(onAir(game('pre'), START + 10 * 60_000), true, 'ten minutes past 09:00, ESPN still pre');
  assert.equal(onAir(game('pre'), START - 60 * 60_000), false, 'an hour to go');
  assert.equal(onAir(game('pre'), START + 4 * 3_600_000), false, 'a game never begun hours on (postponed, ESPN behind)');
  assert.equal(onAir(game('pre', { timeTbd: true }), START + 10 * 60_000), false, 'a stand-in hour');
  assert.equal(onAir(game('in'), START + 15 * 60_000), true);
});

test("the game page's head says 即將開賽 on the live colour by onAir, as the home card does", () => {
  assert.match(head, /const starting = st\.state === 'pre' && onAir\(\{ \.\.\.e, status: st \}\)/, 'the head decides it from the status it draws (the beat\'s newest)');
  assert.match(head, /starting \? el\('span', \{ class: 'mh-status in starting', text: [^}]*'即將開賽' \}\)/, 'its status pill on the live colour, the card\'s word');
  assert.match(open, /e\.status\.state === 'pre' && Date\.parse\(e\.start\) - Date\.now\(\) < 15 \* 60_000/, 'a game about to start (or past its hour) is read on every beat');
  assert.match(open, /for \(const draw of \[\(\) => paintHeader\(data\), paint, loadLine\]\)/, 'each beat draws the head again: the tip turns it to the score and clock');
});
