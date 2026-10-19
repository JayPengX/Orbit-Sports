// What's happening in a game on now, by sport, from the feed's live fields:
//
//   status     period, clock, its name: halftime, extra time, shootout…
//   situation  baseball: count, outs, runners, batter and pitcher; the last play
//   details    soccer: goals and red cards, with the minute
//
// liveOf() reads ESPN's into one shape; liveLabel() is the short status a row
// shows ("5局上", "第3節 5:32", "67'"); liveNote() the line under a game
// ("1壞2好 2出局", "⚽ 67' Saka").

import { closeGame } from './close.mjs';
import { liveOf } from '#kit/sports-espn.mjs';
export { liveOf };

const name = a => a?.athlete?.shortName || a?.athlete?.displayName || a?.shortName || a?.displayName || '';

const ord = n => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);
const QUARTERS = 4;
// A basketball overtime by its period: OT, 2OT…; 延長賽, 延長2…
const otName = (n, en) => {
  const ot = n - QUARTERS;
  return en ? (ot > 1 ? `${ot}OT` : 'OT') : ot > 1 ? `延長${ot}` : '延長賽';
};

// The short status of a game on now (or at a break): the period and clock,
// in the viewer's language. e: a Orbit Sports match event.
export function liveLabel(e, sport, lang = 'zh') {
  const s = e.status || {};
  const en = lang === 'en';
  const n = s.period || 0;
  const clock = s.clock && s.clock !== '0:00' && s.clock !== '0.0' ? s.clock : '';
  const code = s.name || '';
  const lv = e.live || {};
  if (/HALFTIME/.test(code)) return en ? 'Half-time' : '中場休息';
  if (/SHOOTOUT/.test(code)) return en ? 'Penalties' : 'PK 大戰';
  if (/END_PERIOD|END_OF_PERIOD/.test(code) || /^end of/i.test(s.short || '')) {
    if (sport === 'baseball') return en ? `End ${ord(n)}` : `${n}局結束`;
    // An overtime over, still level: 延長賽結束, never 第5節結束 (the same words as while it's played).
    if (sport === 'basketball' && n > QUARTERS) return en ? `End of ${otName(n, en)}` : `${otName(n, en)}結束`;
    return en ? `End of ${ord(n)}` : `第${n}節結束`;
  }
  if (sport === 'baseball') {
    // On by the clock, no score in any feed: say so, never a bare 進行中 over "–" and "–".
    if (s.noScore) return en ? 'Live · score unavailable' : '比賽中・比分讀不到';
    if (!n) return s.short || (en ? 'Live' : '進行中');
    const half = lv.half;
    // The inning alone when the feed doesn't say which half (CPBL's).
    if (!half && lv.inning) return en ? `${ord(n)} inning` : `${n}局`;
    if (en) return `${half === 'bot' ? 'Bot' : half === 'mid' ? 'Mid' : half === 'end' ? 'End' : 'Top'} ${ord(n)}`;
    return `${n}局${half === 'bot' ? '下' : half === 'mid' ? '中場' : half === 'end' ? '結束' : '上'}`;
  }
  if (sport === 'soccer') {
    const m = s.clock || s.short || '';
    if (/EXTRA/.test(code)) return en ? `ET ${m}` : `延長 ${m}`;
    return m || (en ? 'Live' : '進行中');
  }
  if (sport === 'basketball' && n) {
    if (n > QUARTERS) return `${otName(n, en)} ${clock}`.trim();
    return en ? `Q${n} ${clock}`.trim() : `第${n}節 ${clock}`.trim();
  }
  return s.short || s.detail || (en ? 'Live' : '進行中');
}

// The line under a game on now: the count and outs, the latest goal. Empty
// when there's nothing to add.
export function liveNote(e, sport, lang = 'zh') {
  return [closeLabel(e, sport, lang), plainNote(e, sport, lang === 'en')].filter(Boolean).join(' · ');
}
// "Close" while a game on now is in its last stretch and the score is near (lib/close.mjs); else ''.
export const closeLabel = (e, sport, lang = 'zh') => (closeGame(e, sport) ? (lang === 'en' ? 'Close' : '拉鋸') : '');
// A soccer game's goal line head: the close tag first when it applies (so a goal never hides it), then the label.
export const goalHead = (e, lang = 'zh') => [closeLabel(e, 'soccer', lang), lang === 'en' ? 'Latest goal' : '最新進球'].filter(Boolean);
function plainNote(e, sport, en) {
  const lv = e.live;
  if (!lv) return '';
  if (sport === 'baseball' && lv.outs != null) {
    const count = en ? `${lv.balls}-${lv.strikes}, ${lv.outs} out` : `${lv.balls}壞${lv.strikes}好 ${lv.outs}出局`;
    return [count, lv.batter && lv.pitcher ? `${lv.batter} vs ${lv.pitcher}` : lv.batter].filter(Boolean).join(' · ');
  }
  if (lv.events?.length) {
    const last = lv.events.filter(x => x.kind !== 'red').at(-1);
    if (last) return `⚽ ${last.minute} ${last.who}${last.kind === 'pen' ? (en ? ' (pen)' : '（PK）') : last.kind === 'own' ? (en ? ' (OG)' : '（烏龍）') : ''}`.trim();
  }
  return '';
}

// A play's period, short enough for the plays list's time column ("第1節",
// "3局下", "OT"), never ESPN's "1st Quarter" running into the play. p: a
// parsed play ({ period, periodNum, periodType }).
export function playPeriod(p, sport, lang = 'zh') {
  const en = lang === 'en';
  const n = p?.periodNum || 0;
  const dv = p?.period || '';
  if (!n) return /^\d+$/.test(dv) ? '' : dv;
  if (sport === 'soccer') return '';
  if (sport === 'baseball') {
    const t = String(p.periodType || '').toLowerCase();
    const half = t.startsWith('top') ? 'top' : t.startsWith('bot') ? 'bot' : '';
    return en ? `${half === 'top' ? 'Top ' : half === 'bot' ? 'Bot ' : ''}${ord(n)}` : `${n}局${half === 'top' ? '上' : half === 'bot' ? '下' : ''}`;
  }
  const halves = /half/i.test(dv);
  const regular = halves ? 2 : QUARTERS;
  if (n > regular) {
    const ot = n - regular;
    return en ? (ot > 1 ? `${ot}OT` : 'OT') : ot > 1 ? `延長${ot}` : '延長';
  }
  if (halves) return en ? `H${n}` : n === 1 ? '上半場' : '下半場';
  return en ? `Q${n}` : `第${n}節`;
}
