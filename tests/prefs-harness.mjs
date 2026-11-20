// app.js's real Pass-sync code (applyPrefs, gotPrefs, savePrefs, takeBackPrefs,
// keptGames, quietOf) taken from the file, run against a stand-in Pass and device.
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8').split('\n');
const lines = (a, b) => src.slice(a - 1, b).join('\n');
const find = re => src.findIndex(l => re.test(l)) + 1;
const endOf = start => { // end of a top-level function starting at `start`
  for (let i = start; i < src.length; i++) if (src[i] === '}') return i + 1;
};
const A = find(/^const LOCAL_PREFS = 'fx.prefs';/), B = find(/^const followsPatch = /);
const K = find(/^const GAME_KEEP/), K2 = K + 1;
const Q = find(/^const QUIET = /), Q2 = endOf(Q + 1);
const T = find(/^async function takeBackPrefs/), T2 = endOf(T);
export const code = [lines(A, B), lines(K, K2), lines(Q, Q2), 'const quietHours = () => state.prefs.quiet || QUIET;', lines(T, T2)].join('\n');

export function device(name, pass, { account = 'acct1' } = {}) {
  const store = new Map();
  const localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  const LEAGUES = { nba: { sport: 'basketball' }, epl: { sport: 'soccer' }, mlb: { sport: 'baseball' } };
  const q = {
    pass: account,
    active: false,
    async write({ payload }) {
      if (!q.active) { const e = new Error('not live'); e.code = 'ECO_SESSION_MOVED'; throw e; }
      pass.payload = payload; pass.writes.push({ by: name, payload: JSON.parse(payload) });
      return {};
    },
    async read() { return { payload: pass.payload }; }
  };
  const env = {
    localStorage, LEAGUES, q,
    state: { tab: 'home', prefs: { leagues: [], follows: [], games: [], audio: 'en', fill: false, quiet: null }, prefsLoaded: false, wallet: null, days: new Map(), home: {} },
    setting: () => null, teamNameZh: () => null, settingPatch: () => ({ settings: {} }), affinityPatch: () => ({ settings: {} }),
    teamLogo: () => 'logo', showTab: () => {}, sessionStorage: { getItem: () => null, setItem() {} },
    // (Each day's 推薦 on the Pass: its own record, tested apart.)
    pickRecord: { merge: () => false, all: () => ({}) }, picksMoved: () => {}
  };
  const names = Object.keys(env);
  const fn = new Function(...names, `${code}
    booted = true;
    return { applyPrefs, savePrefs, takeBackPrefs, localPrefs, get savePending() { return savePending; } };`);
  const api = fn(...names.map(n => env[n]));
  return Object.assign(api, { env, q, state: env.state, store });
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));
