// What's happening in a game on now, by sport, from the feed's live fields:
//
//   status     period, clock, its name: halftime, extra time, shootout…
//   situation  baseball: count, outs, runners, batter and pitcher; the last play
//   details    soccer: goals and red cards, with the minute
//
// liveOf() reads ESPN's into one shape; liveLabel() is the short status a row
// shows ("5局上", "第3節 5:32", "67'"); liveNote() the line under a game
// ("1壞2好 2出局", "⚽ 67' Saka").

const name = a => a?.athlete?.shortName || a?.athlete?.displayName || a?.shortName || a?.displayName || '';

// comp: ESPN's competition; status: its status; sport: Fixtures' sport key.
export function liveOf(comp, status, sport) {
  const s = comp?.situation || {};
  const live = { lastPlay: s.lastPlay?.text || '' };
  if (sport === 'baseball' && (s.balls != null || s.outs != null)) {
    Object.assign(live, {
      balls: s.balls ?? 0,
      strikes: s.strikes ?? 0,
      outs: s.outs ?? 0,
      bases: [Boolean(s.onFirst), Boolean(s.onSecond), Boolean(s.onThird)],
      batter: name(s.batter),
      pitcher: name(s.pitcher)
    });
  }
  if (sport === 'soccer') {
    live.events = (comp?.details || [])
      .filter(d => d.scoringPlay || d.redCard)
      .map(d => ({ kind: d.redCard ? 'red' : d.ownGoal ? 'own' : d.penaltyKick ? 'pen' : 'goal', minute: d.clock?.displayValue || '', team: String(d.team?.id ?? ''), who: d.athletesInvolved?.[0]?.shortName || d.athletesInvolved?.[0]?.displayName || '' }));
  }
  const prefix = /^(top|bot|bottom|mid|middle|end)\b/i.exec(status?.type?.shortDetail || status?.type?.detail || '')?.[1]?.toLowerCase() || '';
  live.half = prefix.startsWith('top') ? 'top' : prefix.startsWith('bot') ? 'bot' : prefix.startsWith('mid') ? 'mid' : prefix === 'end' ? 'end' : '';
  return live;
}

const ord = n => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);
const QUARTERS = 4;

// The short status of a game on now (or at a break): the period and clock,
// in the viewer's language. e: a Fixtures match event.
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
    return en ? `End of ${ord(n)}` : `第${n}節結束`;
  }
  if (sport === 'baseball') {
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
    if (n > QUARTERS) {
      const ot = n - QUARTERS;
      return `${en ? (ot > 1 ? `${ot}OT` : 'OT') : ot > 1 ? `延長${ot}` : '延長賽'} ${clock}`.trim();
    }
    return en ? `Q${n} ${clock}`.trim() : `第${n}節 ${clock}`.trim();
  }
  return s.short || s.detail || (en ? 'Live' : '進行中');
}

// The line under a game on now: the count and outs, the latest goal. Empty
// when there's nothing to add.
export function liveNote(e, sport, lang = 'zh') {
  const lv = e.live;
  if (!lv) return '';
  const en = lang === 'en';
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
