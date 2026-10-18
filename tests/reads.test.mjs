// Reads that fail (TRUTH §7: a failed read is never "nothing there"): the
// proxy is stood in for by a fetch that answers ESPN's pages from here, a
// page asked for in `down` failing.
import test from 'node:test';
import assert from 'node:assert/strict';

const down = new Set();
const pages = new Map();
const asked = [];
const answer = target => {
  asked.push(target);
  for (const d of down) if (target.includes(d)) return null;
  for (const [k, v] of pages) if (target.includes(k)) return JSON.stringify(v);
  return JSON.stringify({ events: [] });
};
globalThis.fetch = async url => {
  const u = new URL(url);
  if (u.searchParams.get('batch')) {
    const lines = u.searchParams.getAll('u').map((t, i) => {
      const b = answer(t);
      return JSON.stringify(b == null ? { i, s: 502 } : { i, s: 200, b });
    });
    return new Response(`${lines.join('\n')}\n`, { status: 200 });
  }
  const target = u.searchParams.get('url') || u.pathname;
  const b = answer(target);
  return b == null ? new Response('down', { status: 502 }) : new Response(b, { status: 200 });
};
const { scoreboard, weekOf } = await import('../public/lib/espn.mjs');

const game = (id, date, h, a) => ({ id, date, name: `${a} at ${h}`, season: { type: 2 }, competitions: [{ competitors: [{ homeAway: 'home', team: { id: h, displayName: h } }, { homeAway: 'away', team: { id: a, displayName: a } }], status: { type: { state: 'pre' } } }], status: { type: { state: 'pre' } } });

test('a day with one of its pages unread says so (`unread`): never kept as the whole day', async () => {
  pages.set('dates=20261001', { events: [game('1', '2026-10-01T23:00Z', '10', '20')] });
  pages.set('dates=20261003', { events: [game('3', '2026-10-03T23:00Z', '10', '20')] });
  down.add('dates=20261002');
  const got = await scoreboard('nba', ['20261001', '20261002', '20261003']);
  assert.deepEqual(got.map(e => e.id), ['1', '3']);
  assert.deepEqual(got.unread, ['20261002']);
  // Every page read: nothing said.
  const whole = await scoreboard('nba', ['20261001', '20261003']);
  assert.equal(whole.unread, undefined);
  // None read: a failure, never "no games".
  down.add('dates=20261005');
  await assert.rejects(scoreboard('nba', ['20261005']));
});

test('a season’s rounds unread are asked again later, never kept as "no rounds"', async () => {
  down.add('sports/epl/2026.json');
  down.add('sports/epl/2027.json');
  down.add('eng.1/scoreboard?dates=2026');
  down.add('eng.1/scoreboard?dates=2027');
  const e = { id: '9', league: 'epl', kind: 'match', start: '2026-10-04T14:00Z' };
  let loaded = 0;
  assert.equal(weekOf(e, () => loaded++), null);
  for (let i = 0; i < 100 && !loaded; i++) await new Promise(r => setTimeout(r, 100));
  assert.equal(loaded, 1, 'told once when the read is done');
  const before = asked.length;
  // Asked again at once (a redraw): not read again within the minute (the kit's failure hold), nothing kept either.
  assert.equal(weekOf(e, () => loaded++), null);
  await new Promise(r => setTimeout(r, 100));
  assert.equal(asked.length, before, 'no read on every draw');
  // A minute on, the season's there: read again, and the round comes.
  for (const k of [...down]) if (/epl|eng\.1/.test(k)) down.delete(k);
  pages.set('sports/epl/2026.json', { leagues: [{ season: { startDate: '2026-08-01T04:00Z', endDate: '2027-06-01T03:59Z' } }], events: [game('8', '2026-08-22T14:00Z', '1', '2'), game('9', '2026-10-04T14:00Z', '2', '1')] });
  const realNow = Date.now;
  Date.now = () => realNow() + 61_000;
  try {
    loaded = 0;
    weekOf(e, () => loaded++);
    for (let i = 0; i < 100 && !loaded; i++) await new Promise(r => setTimeout(r, 100));
    assert.equal(weekOf(e), 2);
  } finally {
    Date.now = realNow;
  }
});

test('a day’s leagues: one with a page unread is shown and read again, never the whole day lost', async () => {
  const { dayReads } = await import('../public/lib/days.mjs');
  const part = Object.assign([{ id: '1' }], { unread: ['20261002'] });
  // The one league followed, a page of it unread: what came is shown (not a failed read), the day not kept.
  assert.deepEqual(dayReads(['mlb'], [part]), { read: new Set(), failed: 1, unread: false });
  // Nothing of any league: the whole read failed.
  assert.equal(dayReads(['mlb', 'nba'], [null, null]).unread, true);
  // One unread, one partly, one whole.
  const r = dayReads(['mlb', 'nba', 'epl'], [null, part, []]);
  assert.deepEqual([[...r.read], r.failed, r.unread], [['epl'], 2, false]);
  assert.equal(dayReads([], []).unread, false);
});

test('a day whose reads failed is never said to have nothing on', async () => {
  const { dayUnknown } = await import('../public/lib/days.mjs');
  // Offline, nothing followed: the day's own read had no league to fail
  // (partial 0), but the others' and ELTA's list did.
  assert.equal(dayUnknown([{ partial: 0, othersFailed: 24 }], true), 'leagues');
  // Every league read, ELTA's list not: which games are on isn't known.
  assert.equal(dayUnknown([{ partial: 0, othersFailed: 0 }], true), 'tv');
  // A followed league unread.
  assert.equal(dayUnknown([{ partial: 2 }], false), 'leagues');
  // Everything read: only now can a day have nothing on.
  assert.equal(dayUnknown([{ partial: 0, othersFailed: 0, restFailed: 3 }], false), null);
  // 轉播 counts the rest's (every league on now) and tomorrow's too; a day not held yet is still reading, not a gap.
  assert.equal(dayUnknown([{ partial: 0, othersFailed: 0, restFailed: 3 }], false, { rest: true }), 'leagues');
  assert.equal(dayUnknown([{ partial: 0 }, { partial: 1 }], false), 'leagues');
  assert.equal(dayUnknown([{ partial: 0 }, undefined], false), null);
});

test('a league’s table unread is said so, never "this league has no table"', async () => {
  const { tableSays } = await import('../public/lib/days.mjs');
  assert.equal(tableSays(null), 'wait');
  assert.equal(tableSays(undefined), 'wait');
  assert.equal(tableSays(Object.assign([], { failed: true })), 'failed');
  assert.equal(tableSays([]), 'none');
  assert.equal(tableSays([{ rows: [] }]), 'table');
});
