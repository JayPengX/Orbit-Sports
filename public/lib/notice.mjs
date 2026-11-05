// What a game's change of state is, for a notice on this device: 'start'
// when it goes on, 'end' when it is truly over, else null. A game called off
// (postponed, canceled) or suspended is "post" in ESPN's state but has no
// result: it is never a final, so no score is announced for it.
export const isFinal = s => s?.state === 'post' && !s.void && !/SUSPENDED/.test(s.name || '');
export function transition(was, status) {
  if (!was || was === status?.state) return null;
  if (status?.state === 'in') return 'start';
  return isFinal(status) ? 'end' : null;
}

// Which of the picks' finals (今日推薦賽果) go on the Worker's list. The
// Worker can only tell a final it holds before the game ends, and an app
// sends its list only while it's open. So:
// - the picks of today and of tomorrow (Taiwan's days) go on it ahead: a
//   phone not opened on the morning of an NBA day still hears its picks'
//   finals the moment they end (Jay 2026-11-05: the final came at 12:43,
//   twenty minutes after the game, once he'd opened the app and seen it);
// - a game already over that was never on the list isn't put on it: the
//   person is looking at its result in the app, and a notice minutes later
//   says what they already know. One that was on it stays till the Worker
//   has told it (an app opened at the final, 2026-10-21).
// `events`: [{ e, picked }] the games to weigh; `sent`: { key: ms } the
// picks' finals put on the list before (kept 2 days). Gives the games whose
// final goes on the list and `sent` as it is now.
const SENT_MS = 2 * 86_400_000;
export function pickFinals(events, sent = {}, now = Date.now()) {
  const kept = Object.fromEntries(Object.entries(sent || {}).filter(([, at]) => at > now - SENT_MS));
  const out = [];
  const seen = new Set();
  for (const { e, picked } of events) {
    const key = `${e.league}:${e.id}`;
    if (!picked || seen.has(key)) continue;
    seen.add(key);
    const over = e.status?.state === 'post' || e.status?.void;
    if (over && !kept[key]) continue;
    out.push(e);
    if (!kept[key]) kept[key] = now;
  }
  return { games: out, sent: kept };
}
