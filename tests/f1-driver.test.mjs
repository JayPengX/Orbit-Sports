// An F1 driver's page and a race weekend on a wide sheet (Jay 2026-11-06, an
// iPad: the driver's page "legacy looking", "Big empty" beside a race's order).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seasonRuns, seasonSums, mateDuel } from '../public/lib/f1driver.mjs';
import { finishOf } from '../public/lib/f1.mjs';

const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
const js = readFileSync(new URL('../public/sheets.js', import.meta.url), 'utf8');

const res = (position, points = 0, positionText = String(position), status = 'Finished') => ({ position: String(position), positionText, points: String(points), status });

test("a driver's season reads oldest first from formula1.com's weekends (latest first), a retirement kept out of the sums", () => {
  const weekends = [
    { round: 3, e: { name: '墨西哥站' }, me: { result: res(0, 0, 'R', 'Engine'), grid: 5 } },
    { round: 2, e: { name: '美國站' }, me: { result: res(1, 25), grid: 2, sprint: res(3, 6) } },
    { round: 1, e: { name: '新加坡站' }, me: { result: res(4, 12), grid: 4 } }
  ];
  const runs = seasonRuns(weekends, [], r => finishOf(r, false));
  assert.deepEqual(runs.map(r => r.round), [1, 2, 3]);
  assert.equal(runs[1].points, 31);
  assert.equal(runs[1].sprint, 3);
  assert.equal(runs[2].out, true);
  assert.equal(runs[2].why, '引擎');
  const sums = seasonSums(runs);
  assert.deepEqual([sums.races, sums.wins, sums.podiums, sums.best, sums.outs], [3, 1, 1, 1, 1]);
  assert.equal(sums.average, 2.5);
});

test("ESPN's finishes when formula1.com's aren't in, their points counted", () => {
  const rows = [{ name: 'B', pos: 2, sprint: 0, e: { round: 2 } }, { name: 'A', pos: 1, sprint: 1, e: { round: 1 } }];
  const runs = seasonRuns([], rows, r => finishOf(r, false), (p, sp) => [25, 18][p - 1] + (sp ? 8 : 0));
  assert.deepEqual(runs.map(r => [r.round, r.points]), [[1, 33], [2, 18]]);
});

test("a classified retirement is a DNF on the driver's page, not a place (Leclerc P15 'Retired', Barcelona 2026)", () => {
  const w = (round, position, positionText, status) => ({ round, e: { name: `R${round}` }, me: { result: { position, positionText, status, points: '0' }, grid: 10 } });
  const runs = seasonRuns([w(7, '15', '15', 'Retired'), w(6, '4', '4', 'Finished')], [], r => finishOf(r, false));
  assert.equal(runs[1].out, true);
  assert.equal(runs[1].pos, 0);
  assert.equal(runs[1].text, '退賽');
  const sums = seasonSums(runs);
  assert.equal(sums.outs, 1);
  assert.equal(sums.average, 4);
});

test('against his teammate: races and qualifying both drove, ahead and behind', () => {
  const ev = (race, qual) => ({ sessions: [{ abbr: 'Race', status: { state: 'post' }, field: race.map(id => ({ id })) }, { abbr: 'Qual', status: { state: 'post' }, field: qual.map(id => ({ id })) }] });
  const duel = mateDuel([ev(['a', 'b'], ['b', 'a']), ev(['b', 'x'], ['a', 'b']), ev(['a', 'b'], ['a', 'b'])], 'a', 'b');
  assert.deepEqual(duel.race, [2, 0]);
  assert.deepEqual(duel.quali, [2, 1]);
});

test("the driver's page is built from the new pieces, never the old pills and table", () => {
  assert.doesNotMatch(js, /hero-races|nextRaceCard|mate-grid/);
  assert.match(js, /f1FormCard\(runs/);
  assert.match(js, /f1MateCard\(/);
  assert.match(js, /ctx\.weekendCard\(splitWeekend\(nextRace/);
  assert.match(js, /f1RunRows\(runs, en\)/);
});

test('本季走勢: the line joins the races either side of a retirement, never cut (Jay 2026-11-06)', () => {
  const body = js.slice(js.indexOf('function f1FormCard('), js.indexOf('function f1MateCard('));
  assert.match(body, /d \+= `\$\{d \? 'L' : 'M'\}/);
  assert.doesNotMatch(body, /prev\.out/);
});

test("a race weekend on a wide sheet: two set columns, never CSS columns (Safari left the right half empty)", () => {
  assert.doesNotMatch(css, /\.sheet-body:has\(> \.wk-hero\)\s*\{\s*columns/);
  assert.match(css, /\.wk-cols:has\(> \.wk-side > :not\(:empty\)\)\s*\{[^}]*grid-template-columns:\s*repeat\(2/);
  assert.match(js, /el\('div', \{ class: 'stack wk-cols' \}, \[box, side\]\)/);
});
