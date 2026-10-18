// Reads that failed are tried again (the screen says 稍後會自動再試): never
// given up on, never hammered (4, 8, 16, 30 s, then every minute), never
// while the app is out of sight, and at once when it's back on screen or
// back online.
import test from 'node:test';
import assert from 'node:assert/strict';
import { retryWait, retrier } from '../public/lib/retry.mjs';

// A clock and an app of our own: timers run when `tick` passes them.
function world() {
  let now = 0;
  let id = 0;
  const timers = new Map();
  const on = {};
  const w = {
    shown: true,
    runs: [],
    timers,
    tick(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].fn();
      }
      now = end;
    },
    fire: ev => on[ev]?.(),
  };
  w.r = retrier({
    visible: () => w.shown,
    listen: (ev, fn) => (on[ev] = fn),
    setTimer: (fn, ms) => (timers.set(++id, { fn, at: now + ms }), id),
    clearTimer: t => timers.delete(t),
  });
  w.at = () => now;
  return w;
}

test('the waits back off to a minute and stay there: never given up', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 50].map(retryWait), [4000, 8000, 16000, 30000, 60000, 60000, 60000]);
});

test('a read that keeps failing is tried again for as long as it fails', () => {
  const w = world();
  const again = () => (w.runs.push(w.at()), w.r.later('day', again));
  w.r.later('day', again);
  w.tick(10 * 60_000);
  assert.deepEqual(w.runs.slice(0, 6), [4000, 12000, 28000, 58000, 118000, 178000]);
  assert.ok(w.runs.length >= 12, 'still trying after ten minutes');
});

test('a read that worked stops the retries and starts the back-off over', () => {
  const w = world();
  w.r.later('day', () => w.runs.push(w.at()));
  w.r.done('day');
  w.tick(120_000);
  assert.deepEqual(w.runs, []);
  w.r.later('day', () => w.runs.push(w.at()));
  w.tick(5000);
  assert.deepEqual(w.runs, [124000]);
});

test('out of sight: nothing is read; back on screen: read at once', () => {
  const w = world();
  w.shown = false;
  w.r.later('table', () => w.runs.push(w.at()));
  w.tick(10 * 60_000);
  assert.deepEqual(w.runs, []);
  w.shown = true;
  w.fire('visible');
  assert.deepEqual(w.runs, [600000]);
});

test('back online: tried at once, not at the end of its wait', () => {
  const w = world();
  w.r.later('a', () => w.runs.push('a'));
  w.r.later('a', () => w.runs.push('a'));
  w.r.later('a', () => w.runs.push('a'));
  w.tick(1000);
  w.fire('online');
  assert.deepEqual(w.runs, ['a']);
  assert.equal(w.timers.size, 0, 'its timer is gone (no second read when it ends)');
});

test('a read nobody is looking at waits, and runs once it is wanted again', () => {
  const w = world();
  let wanted = false;
  w.r.later('table', () => w.runs.push(w.at()), () => wanted);
  w.tick(60_000);
  assert.deepEqual(w.runs, []);
  assert.equal(w.r.waiting('table'), true);
  wanted = true;
  w.r.kick();
  assert.deepEqual(w.runs, [60000]);
  // kick only runs what's due: one waiting its turn isn't read early.
  w.r.later('table', () => w.runs.push(w.at()));
  w.r.kick();
  assert.deepEqual(w.runs, [60000]);
});

test('waiting: true while a retry is pending, false while it runs and once done', () => {
  const w = world();
  let seen = null;
  w.r.later('t', () => (seen = w.r.waiting('t')));
  assert.equal(w.r.waiting('t'), true);
  w.tick(4000);
  assert.equal(seen, false);
  w.r.done('t');
  assert.equal(w.r.waiting('t'), false);
});
