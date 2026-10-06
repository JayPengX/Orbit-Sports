import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSummary } from '../public/lib/espn.mjs';
import { lineXs, periodMarks, stampAt, periodName } from '../public/lib/wpline.mjs';

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

test('soccer: halves marked and read, never the minute', () => {
  const s = parseSummary(fixture('epl-summary.json'), 'epl');
  const kick = Date.parse('2026-09-20T13:00:41Z') / 1000;
  const second = Date.parse('2026-09-20T14:01:14Z') / 1000;
  assert.equal(stampAt(s.timeline, 'soccer', kick - 60, false), '開賽前');
  assert.equal(stampAt(s.timeline, 'soccer', kick + 10 * 60, false), '上半場');
  assert.equal(stampAt(s.timeline, 'soccer', kick + 45 * 60, true), '1st half');
  assert.equal(stampAt(s.timeline, 'soccer', kick + 50 * 60, false), '中場休息');
  assert.equal(stampAt(s.timeline, 'soccer', second + 22 * 60, true), '2nd half');
  assert.equal(stampAt(s.timeline, 'soccer', second + 60 * 60, true), 'Full time');
  const pts = Array.from({ length: 60 }, (_, i) => ({
    t: kick + i * 120,
    home: 0.5
  }));
  assert.deepEqual(
    periodMarks(s.timeline, 'soccer', pts, false).map(m => m.label),
    ['上半', '下半']
  );
});

test('baseball: ESPN points by the clock, innings marked, the half inning read', () => {
  const s = parseSummary(fixture('mlb-summary.json'), 'mlb');
  assert.ok(s.timeline.length && s.timeline.every((e, i) => !i || e.t >= s.timeline[i - 1].t));
  const top = s.timeline.find(e => e.half === 'top');
  assert.equal(stampAt(s.timeline, 'baseball', top.t, false), `${top.n}局上`);
  assert.equal(stampAt(s.timeline, 'baseball', top.t, true), `Top ${top.n}`);
});

test('other sports: the period alone; overtime', () => {
  const tl = [
    { t: 100, n: 1, half: '', type: '' },
    { t: 200, n: 3, half: '', type: '' }
  ];
  assert.equal(stampAt(tl, 'basketball', 250, false), '第3節');
  assert.equal(stampAt(tl, 'basketball', 250, true), 'Q3');
  assert.equal(stampAt(tl, 'hockey', 250, true), 'P3');
  assert.equal(periodName('basketball', 5, true), 'OT');
  assert.equal(periodName('basketball', 6, false), '延長2');
});

test('no plays (CPBL): the clock, marked by the hour', () => {
  const t0 = Date.UTC(2026, 9, 1, 10, 30) / 1000;
  const pts = Array.from({ length: 100 }, (_, i) => ({
    t: t0 + i * 120,
    home: 0.5
  }));
  const marks = periodMarks([], 'baseball', pts, false);
  assert.ok(marks.length >= 3 && marks.every(m => /^\d\d:00$/.test(m.label)));
  assert.match(stampAt([], 'baseball', t0, false), /^\d\d:\d\d$/);
});

test('points across: by time when all have one, else evenly', () => {
  assert.deepEqual(lineXs([{ t: 0 }, { t: 10 }, { t: 40 }]), [0, 0.25, 1]);
  assert.deepEqual(lineXs([{}, { t: 10 }, {}]), [0, 0.5, 1]);
});
