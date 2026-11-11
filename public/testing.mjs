// Orbit Sports' own switches in the kit's 測試工具 (hidden until unlocked:
// Orbit Pass › seven taps on 除錯紀錄). Each is read where it acts as
// globalThis.ORBIT_TEST?.flags?.<name>; the kit's clock, place and network
// switches work here as everywhere. They change only what is shown: today's
// games as read (app.js readDay → testDay), never the Pass, and the
// Worker's notice list isn't sent while one is on (syncPush).
//   liveGame: one of today's games (a final if any) shown as on now
//   startSoon: one of today's games starting in 10 minutes, or due and not started (即將開賽)
//   gameOff: one of today's games postponed, or delayed
//   emptyDay: every day read has no games
//   f1Flag: an F1 session on now under a red flag, safety car or VSC (lib/f1.mjs flagNow)
//   aiCap: 問比賽 answers as if today's AI is used up (ask.js)
const T = (zh, en) => (/^en/i.test(globalThis.document?.documentElement?.lang || 'zh') ? en : zh);
const APP = 'match';
(globalThis.ORBIT_TEST_TOOLS ||= []).push(
  { app: APP, title: T('比賽進行中', 'A game on now'), sub: T('今天的一場比賽（有完賽的就用完賽的）顯示成正在進行', 'One of today’s games (a final if any) shown as in progress'), flag: 'liveGame' },
  {
    app: APP,
    title: T('即將開賽', 'About to start'),
    sub: T('今天的一場比賽 10 分鐘後開打，或時間已到還沒開打', 'One of today’s games starts in 10 minutes, or is due and not yet on'),
    flag: 'startSoon',
    options: [
      { id: 'in10', label: T('10 分鐘後', 'In 10 min') },
      { id: 'due', label: T('時間已到', 'Due now') }
    ]
  },
  {
    app: APP,
    title: T('延賽 / 延後', 'Postponed / delayed'),
    sub: T('今天的一場比賽延賽，或延後開打', 'One of today’s games postponed, or held up'),
    flag: 'gameOff',
    options: [
      { id: 'void', label: T('延賽', 'Postponed') },
      { id: 'delayed', label: T('延後', 'Delayed') }
    ]
  },
  { app: APP, title: T('沒有比賽的一天', 'A day with no games'), sub: T('每一天讀到的賽事都是空的', 'Every day read has no games'), flag: 'emptyDay' },
  {
    app: APP,
    title: T('F1 旗號', 'F1 flag'),
    sub: T('F1 正在進行的場次（要有真的在跑的）顯示紅旗、安全車或虛擬安全車', 'A session on now (a real one) under a red flag, safety car or VSC'),
    flag: 'f1Flag',
    options: [
      { id: 'red', label: T('紅旗', 'Red flag') },
      { id: 'sc', label: T('安全車', 'Safety car') },
      { id: 'vsc', label: T('VSC', 'VSC') }
    ]
  },
  { app: APP, title: T('AI 次數用完', 'AI used up'), sub: T('問比賽回答「今天的次數用完了」', '問比賽 says today’s AI is used up'), flag: 'aiCap' }
);

const flags = () => globalThis.ORBIT_TEST?.flags || {};
// A switch on that changes today's games (nothing of them is sent on then).
export const dayTested = () => Boolean(flags().liveGame || flags().startSoon || flags().gameOff || flags().emptyDay);

// The one game each switch took, kept: every read (mine, the others, a live
// page's) turns the same game, never a second one.
const chosen = new Map();
const keyOf = e => `${e.league}:${e.id}:${e.sessionKey || ''}`;
function pick(name, list, rank) {
  const held = chosen.get(name);
  if (held) return list.find(e => keyOf(e) === held) || null;
  const games = list.filter(e => e.kind === 'match' && !e.other && rank(e) >= 0).sort((a, b) => rank(a) - rank(b) || (keyOf(a) < keyOf(b) ? -1 : 1));
  if (!games[0]) return null;
  chosen.set(name, keyOf(games[0]));
  return games[0];
}
const ISO = ms => new Date(ms).toISOString();
const unscored = side => side && { ...side, score: '', winner: false };

// A day's games as read, as the switches on say. `isToday`: the day is today
// (the game switches act on today's only). With none on: the same list.
export function testDay(list, isToday, now = Date.now()) {
  const f = flags();
  if (!f.liveGame && !f.startSoon && !f.gameOff && !f.emptyDay) return list;
  if (f.emptyDay) return [];
  if (!isToday) return list;
  const turn = new Map();
  if (f.liveGame) {
    const e = pick('liveGame', list, x => ({ post: 0, pre: 1 })[x.status?.state] ?? -1);
    if (e) {
      const pre = e.status.state === 'pre';
      turn.set(keyOf(e), {
        ...e,
        start: pre ? ISO(now - 40 * 60_000) : e.start,
        home: pre ? { ...e.home, score: '1', winner: false } : { ...e.home, winner: false },
        away: pre ? { ...e.away, score: '0', winner: false } : { ...e.away, winner: false },
        status: { ...e.status, state: 'in', completed: false, void: false, delayed: false, period: 2, clock: '5:12', name: 'STATUS_IN_PROGRESS', detail: '', short: '' }
      });
    }
  }
  if (f.startSoon) {
    const e = pick('startSoon', list, x => (turn.has(keyOf(x)) ? -1 : ({ pre: 0, post: 1 })[x.status?.state] ?? -1));
    if (e) turn.set(keyOf(e), { ...e, start: ISO(f.startSoon === 'due' ? now - 2 * 60_000 : now + 10 * 60_000), timeTbd: false, home: unscored(e.home), away: unscored(e.away), status: { ...e.status, state: 'pre', completed: false, void: false, delayed: false, detail: '', short: '' } });
  }
  if (f.gameOff) {
    const e = pick('gameOff', list, x => (turn.has(keyOf(x)) ? -1 : ({ pre: 0, post: 1 })[x.status?.state] ?? -1));
    if (e) {
      const status = f.gameOff === 'void' ? { state: 'pre', completed: false, void: true, detail: 'Postponed', short: 'Postponed' } : { state: 'pre', completed: false, void: false, delayed: true, detail: 'Delayed', short: 'Delayed' };
      turn.set(keyOf(e), { ...e, start: f.gameOff === 'delayed' ? ISO(now - 5 * 60_000) : e.start, home: unscored(e.home), away: unscored(e.away), status: { ...e.status, ...status } });
    }
  }
  return turn.size ? list.map(e => turn.get(keyOf(e)) || e) : list;
}

