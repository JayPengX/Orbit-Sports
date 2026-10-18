// Reads that failed, tried again (the screen says 稍後會自動再試): one rule
// for every read that says so (the day's, 轉播's, 排名's, 追蹤's teams).
// Backed off (4, 8, 16, 30 s, then every minute, never given up), never
// while the app is out of sight, and at once when it's back on screen or
// back online. A retry nobody's looking at (`wanted` false) waits, due,
// until it is (kick) instead of reading for nothing.
const STEPS = [4000, 8000, 16000, 30000];
export const retryWait = n => STEPS[n - 1] ?? 60_000;

const shownNow = () => globalThis.document?.visibilityState !== 'hidden';
const listenNow = (ev, fn) => {
  if (ev === 'visible') globalThis.document?.addEventListener?.('visibilitychange', () => shownNow() && fn());
  else globalThis.addEventListener?.(ev, fn);
};

export function retrier({ visible = shownNow, listen = listenNow, setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = t => clearTimeout(t) } = {}) {
  // key → { n: tries so far, again, wanted, timer, due }
  const jobs = new Map();
  const stop = job => (job.timer && clearTimer(job.timer), (job.timer = 0));
  const run = job => {
    stop(job);
    if (!visible() || !job.wanted()) return void (job.due = true);
    job.due = false;
    job.again();
  };
  const later = (key, again, wanted = () => true) => {
    const job = jobs.get(key) || { n: 0 };
    stop(job);
    Object.assign(job, { n: job.n + 1, again, wanted, due: false });
    job.timer = setTimer(() => run(job), retryWait(job.n));
    jobs.set(key, job);
  };
  const done = key => {
    const job = jobs.get(key);
    if (job) stop(job), jobs.delete(key);
  };
  // Every retry at once (back online, back on screen); only the due ones (kick).
  const now = () => [...jobs.values()].forEach(run);
  const kick = () => [...jobs.values()].filter(j => j.due).forEach(run);
  listen('online', now);
  listen('visible', now);
  return { later, done, now, kick, waiting: key => !!(jobs.get(key)?.timer || jobs.get(key)?.due) };
}
