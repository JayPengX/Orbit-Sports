// What's happening in a game on now, by sport, from the feed's live fields:
//
//   ESPN   status (period, clock, its name: halftime, extra time, shootout…),
//          the competition's situation (baseball: count, outs, runners,
//          batter and pitcher; American football: down, distance, ball on,
//          possession, red zone; last play) and details (soccer: goals and
//          red cards, with the minute)
//   Kambi  the score's innings or sets, and the match clock
//
// liveOf() reads them into one shape; liveLabel() is the short status a row
// shows ("5局上", "第3節 5:32", "67'"); liveNote() the line under a game
// ("1壞2好 2出局", "1st & 10 · PHI 25", "⚽ 67' Saka").

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
  if (sport === 'football' && s.down != null) {
    Object.assign(live, {
      down: s.down,
      distance: s.distance,
      downText: s.shortDownDistanceText || '',
      ballOn: s.possessionText || '',
      possession: s.possession ? String(s.possession) : '',
      redZone: Boolean(s.isRedZone)
    });
  }
  if (sport === 'soccer' || sport === 'rugby') {
    live.events = (comp?.details || [])
      .filter(d => d.scoringPlay || d.redCard)
      .map(d => ({ kind: d.redCard ? 'red' : d.ownGoal ? 'own' : d.penaltyKick ? 'pen' : 'goal', minute: d.clock?.displayValue || '', team: String(d.team?.id ?? ''), who: d.athletesInvolved?.[0]?.shortName || d.athletesInvolved?.[0]?.displayName || '' }));
  }
  const prefix = /^(top|bot|bottom|mid|middle|end)\b/i.exec(status?.type?.shortDetail || status?.type?.detail || '')?.[1]?.toLowerCase() || '';
  live.half = prefix.startsWith('top') ? 'top' : prefix.startsWith('bot') ? 'bot' : prefix.startsWith('mid') ? 'mid' : prefix === 'end' ? 'end' : '';
  return live;
}

// Kambi's live data: innings (baseball's "1-0 | 0-2 | …") or sets, the clock.
export function kambiLive(liveData, sport) {
  const info = String(liveData?.score?.info || '').split('|').map(x => x.trim()).filter(Boolean);
  const sets = liveData?.statistics?.sets;
  return {
    inning: sport === 'baseball' && info.length ? info.length : 0,
    set: sets ? Math.max(sets.home?.filter(x => x >= 0).length || 0, 1) : 0,
    minute: liveData?.matchClock?.minute ?? null
  };
}

const ord = n => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);
const QUARTERS = { basketball: 4, football: 4, hockey: 3 };

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
  if (/SHOOTOUT/.test(code)) return en ? (sport === 'hockey' ? 'Shootout' : 'Penalties') : sport === 'hockey' ? '射門大戰' : 'PK 大戰';
  if (/END_PERIOD|END_OF_PERIOD/.test(code) || /^end of/i.test(s.short || '')) {
    if (sport === 'baseball') return en ? `End ${ord(n)}` : `${n}局結束`;
    return en ? `End of ${ord(n)}` : `第${n}節結束`;
  }
  if (sport === 'baseball') {
    const inning = n || lv.inning;
    if (!inning) return s.short || (en ? 'Live' : '進行中');
    const half = lv.half;
    if (en) return `${half === 'bot' ? 'Bot' : half === 'mid' ? 'Mid' : half === 'end' ? 'End' : 'Top'} ${ord(inning)}`;
    return `${inning}局${half === 'bot' ? '下' : half === 'mid' ? '中場' : half === 'end' ? '結束' : '上'}`;
  }
  if (sport === 'soccer') {
    if (lv.minute != null && !s.clock) return `${lv.minute}'`;
    const m = s.clock || s.short || '';
    if (/EXTRA/.test(code)) return en ? `ET ${m}` : `延長 ${m}`;
    return m || (en ? 'Live' : '進行中');
  }
  if (['tennis', 'badminton', 'tabletennis', 'volleyball'].includes(sport)) {
    const set = lv.set || n;
    // Tennis plays sets (盤); badminton, table tennis and volleyball games (局).
    return set ? (en ? `${sport === 'tennis' || sport === 'volleyball' ? 'Set' : 'Game'} ${set}` : `第${set}${sport === 'tennis' ? '盤' : '局'}`) : en ? 'Live' : '進行中';
  }
  if (sport === 'rugby') {
    const m = s.clock || '';
    return en ? `${n === 2 ? '2nd' : '1st'} half ${m}`.trim() : `${n === 2 ? '下' : '上'}半場 ${m}`.trim();
  }
  const quarters = QUARTERS[sport];
  if (quarters && n) {
    // College men's basketball plays halves.
    const halves = e.league === 'ncaam';
    const regular = halves ? 2 : quarters;
    if (n > regular) {
      const ot = n - regular;
      return `${en ? (ot > 1 ? `${ot}OT` : 'OT') : ot > 1 ? `延長${ot}` : '延長賽'} ${clock}`.trim();
    }
    if (halves) return en ? `${ord(n)} half ${clock}`.trim() : `${n === 1 ? '上' : '下'}半場 ${clock}`.trim();
    return en ? `${sport === 'hockey' ? 'P' : 'Q'}${n} ${clock}`.trim() : `第${n}節 ${clock}`.trim();
  }
  return s.short || s.detail || (en ? 'Live' : '進行中');
}

// The line under a game on now: the count and outs, the down and the ball,
// the latest goal. Empty when there's nothing to add.
export function liveNote(e, sport, lang = 'zh') {
  const lv = e.live;
  if (!lv) return '';
  const en = lang === 'en';
  if (sport === 'baseball' && lv.outs != null) {
    const count = en ? `${lv.balls}-${lv.strikes}, ${lv.outs} out` : `${lv.balls}壞${lv.strikes}好 ${lv.outs}出局`;
    return [count, lv.batter && lv.pitcher ? `${lv.batter} vs ${lv.pitcher}` : lv.batter].filter(Boolean).join(' · ');
  }
  if (sport === 'football' && lv.downText) return [lv.downText, lv.ballOn].filter(Boolean).join(' · ');
  if (lv.events?.length) {
    const last = lv.events.filter(x => x.kind !== 'red').at(-1);
    if (last) return `⚽ ${last.minute} ${last.who}${last.kind === 'pen' ? (en ? ' (pen)' : '（PK）') : last.kind === 'own' ? (en ? ' (OG)' : '（烏龍）') : ''}`.trim();
  }
  return '';
}

// Which side has the ball (American football): 'home', 'away' or ''.
export function possessionOf(e) {
  const p = e.live?.possession;
  if (!p) return '';
  return p === e.home?.id ? 'home' : p === e.away?.id ? 'away' : '';
}
