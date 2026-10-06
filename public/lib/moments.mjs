// A win probability line's key moments: where the game turned, and why.
// A swing is a move of the home side's chance (a draw counting half) of 12
// points or more without turning back as far; its cause, ESPN's play that
// made most of it (a home run, a touchdown), else a run of points (an NBA
// game turns on runs, not one shot). A line from Polymarket's market has no
// plays of its own: the game's scores, red cards and missed penalties, each
// with how far the price moved around it. No imports: plain data in, plain
// data out.
//
//   playMoments(points, sport, side)            ESPN's line (each point's play)
//   eventMoments(points, events, xs, side)      Polymarket's (events by the clock)
//     side: { home: { id, name }, away: { id, name }, en }
//     → [{ i, delta, side: 'home' | 'away', icon, text }] by time, the five biggest at most

const SWING = 0.12;
const KEEP = 5;
const value = p => p.home + (p.draw ?? 0) / 2;

// The line's swings: [{ from, to }] index pairs, each a move of `least` or more.
export function swings(values, least = SWING) {
  const segs = [];
  let [lo, hi, dir, start, ext] = [0, 0, 0, 0, 0];
  for (let i = 1; i < values.length; i++) {
    const v = values[i];
    if (!dir) {
      // From the last point of a level start (what came before it moved nothing).
      if (v >= values[hi]) hi = i;
      if (v <= values[lo]) lo = i;
      if (values[hi] - values[lo] >= least) [dir, start, ext] = hi > lo ? [1, lo, hi] : [-1, hi, lo];
    } else if (dir * (v - values[ext]) > 0) ext = i;
    else if (dir * (values[ext] - v) >= least) {
      segs.push({ from: start, to: ext });
      [start, ext, dir] = [ext, i, -dir];
    }
  }
  if (dir && Math.abs(values[ext] - values[start]) >= least) segs.push({ from: start, to: ext });
  return segs;
}

// ---- What a play was, in a few words ----
const MLB_ZH = [
  [/grand slam/i, '滿貫全壘打'],
  [/home run|homered/i, '全壘打'],
  [/triple/i, '三壘安打'],
  [/double play/i, '雙殺'],
  [/double/i, '二壘安打'],
  [/single/i, '一壘安打'],
  [/sac(rifice)? fly/i, '高飛犧牲打'],
  [/sac(rifice)? bunt/i, '犧牲觸擊'],
  [/intentional walk/i, '故意四壞'],
  [/walk|base on balls/i, '保送'],
  [/hit by pitch/i, '觸身球'],
  [/wild pitch/i, '暴投'],
  [/passed ball/i, '捕逸'],
  [/error/i, '失誤'],
  [/fielder'?s choice/i, '野手選擇'],
  [/stolen base|stole/i, '盜壘'],
  [/strike|struck out/i, '被三振'],
  [/ground/i, '滾地出局'],
  [/line/i, '平飛出局'],
  [/pop|foul out/i, '內野飛球出局'],
  [/fly|flied/i, '高飛出局']
];
const NBA_ZH = [
  [/three point|3-pt|three pointer/i, '三分球'],
  [/free throw/i, '罰球'],
  [/dunk/i, '灌籃'],
  [/layup|finger roll/i, '上籃'],
  [/hook/i, '勾射'],
  [/tip/i, '補籃'],
  [/turnover|traveling|bad pass/i, '失誤'],
  [/steal/i, '抄截'],
  [/block/i, '火鍋'],
  [/foul/i, '犯規'],
  [/shot|jumper/i, '跳投']
];
const NFL_ZH = [
  [/interception.*touchdown|pick six/i, '攔截回攻達陣'],
  [/fumble.*touchdown/i, '掉球回攻達陣'],
  [/punt return.*touchdown|kickoff return.*touchdown/i, '回攻達陣'],
  [/passing touchdown/i, '傳球達陣'],
  [/rushing touchdown/i, '跑球達陣'],
  [/touchdown/i, '達陣'],
  [/interception/i, '攔截'],
  [/fumble/i, '掉球'],
  [/field goal good/i, '射門得分'],
  [/field goal (missed|blocked)/i, '射門未進'],
  [/safety/i, '安全分'],
  [/two-point|2pt/i, '兩分轉換'],
  [/sack/i, '被擒殺'],
  [/kickoff|kicks/i, '開球回攻'],
  [/punt/i, '棄踢'],
  [/incomplet/i, '傳球未成'],
  [/pass/i, '傳球推進'],
  [/rush/i, '跑球推進']
];
// A basketball play in a few words: made or missed and what, a free throw,
// a turnover (and who stole it), a foul, a rebound, a block.
function basketballZh(play) {
  const t = `${play.type} ${play.text}`;
  const made = play.scoring || /\bmakes\b/i.test(play.text);
  if (/turnover|bad pass|traveling|lost ball|offensive foul/i.test(t)) {
    const thief = /\(([^)]+?) steals?\)/i.exec(play.text)?.[1];
    return `失誤${thief ? `（${thief} 抄截）` : ''}`;
  }
  if (/free throw/i.test(t)) return made ? '罰球命中' : '罰球不進';
  if (/shooting foul/i.test(t)) return '投籃犯規';
  if (/foul/i.test(t)) return '犯規';
  if (/offensive rebound/i.test(t)) return '進攻籃板';
  if (/rebound/i.test(t)) return '防守籃板';
  if (/block/i.test(t)) return '火鍋';
  const shot = /three point|3-pt/i.test(t) ? '三分' : /dunk/i.test(t) ? '灌籃' : /layup|finger roll/i.test(t) ? '上籃' : /hook/i.test(t) ? '勾射' : /tip/i.test(t) ? '補籃' : '跳投';
  return `${shot}${made ? '命中' : '不進'}`;
}

const ICON = { baseball: '⚾', basketball: '🏀', football: '🏈', hockey: '🏒', soccer: '⚽' };
const firstOf = (list, ...texts) => list.find(([re]) => texts.some(t => re.test(t || '')))?.[1];
// The doer from the play's words where ESPN names nobody ("Rice homered to right").
const named = text => /^(?:\([^)]*\)\s*)?([A-Z][\w.'’-]*(?:\s+[A-Z][\w.'’-]*){0,2})/.exec(text || '')?.[1] || '';
const sentence = text => String(text || '').replace(/^\([^)]*\)\s*/, '').split(/(?<=\.)\s/)[0].slice(0, 90);

export function playText(sport, play, en, team) {
  const who = play.who || named(play.text);
  if (en) return sentence(play.text) || play.type;
  if (sport === 'baseball') {
    const what = firstOf(MLB_ZH, play.alt, play.text) || '關鍵打擊';
    return [who, what].filter(Boolean).join(' ') + (play.scoring && play.value ? ` · ${play.value} 分打點` : '');
  }
  // A team's own (a team rebound, a shot clock violation): the side's name, never ESPN's English.
  if (sport === 'basketball') return [play.who || team || who, basketballZh(play)].filter(Boolean).join(' ');
  // A flag's team isn't the drive's: the call alone.
  if (sport === 'football') return /penalty/i.test(`${play.type} ${play.text}`) && !/touchdown|field goal good/i.test(play.type) ? '關鍵判罰' : [team, firstOf(NFL_ZH, play.type, play.text) || '關鍵進攻'].filter(Boolean).join(' ');
  if (sport === 'soccer') return [who, play.kind === 'red' ? '紅牌' : '進球'].filter(Boolean).join(' ');
  return [who, play.type].filter(Boolean).join(' ');
}

// The swing's side: the home side's chance up, theirs; down, the away side's.
const sideOf = (delta, side) => (delta >= 0 ? side.home : side.away);
const teamName = (id, side) => (String(id) === String(side.home.id) ? side.home.name : String(id) === String(side.away.id) ? side.away.name : '');

// Where one play decides it (baseball, football, hockey): the biggest
// single plays. Basketball: the possessions that swung it (who did what:
// made or missed, a free throw, a turnover, a foul) and the stretches it
// drifted over (told by the points each side scored), never a possession
// told as a run.
const SINGLE = 0.07;
const RUN_PLAYS = 48;
// Basketball: a possession that moves it this much is a moment; a drift of this much, a stretch.
const PLAY_SWING = 0.12;
const STRETCH = 0.2;
function swingMoments(points, sport, side) {
  const vals = points.map(value);
  const home = d => (d >= 0 ? 'home' : 'away');
  if (sport !== 'basketball') {
    const found = [];
    for (let i = 1; i < points.length; i++) {
      const delta = vals[i] - vals[i - 1];
      // ESPN puts a score's swing on the kickoff after it: the score's.
      let play = points[i].play;
      if (/kickoff|kicks/i.test(`${play?.type} ${play?.text}`)) play = points.slice(Math.max(0, i - 3), i).reverse().find(p => p.play?.scoring)?.play || play;
      if (Math.abs(delta) >= SINGLE && play) found.push({ i, delta, side: home(delta), icon: ICON[sport] || '•', text: playText(sport, play, side.en, teamName(play.team, side) || sideOf(delta, side).name), pic: sport === 'football' ? null : play.pic, team: play.team || sideOf(delta, side).id, src: play });
    }
    return biggest(found);
  }
  // The possessions that swung it (a game's last minutes), each by who did what.
  const plays = [];
  for (let i = 1; i < points.length; i++) {
    const delta = vals[i] - vals[i - 1];
    const play = points[i].play;
    if (Math.abs(delta) >= PLAY_SWING && play && !/end (period|of|game)/i.test(`${play.type} ${play.text}`))
      plays.push({ i, delta, side: home(delta), icon: ICON.basketball, text: playText(sport, play, side.en, teamName(play.team, side)), pic: play.pic, team: play.team || sideOf(delta, side).id, play: true, src: play });
  }
  // The stretches it drifted over (a slow slide over a quarter or two): each told by the points each side scored over it.
  const stretches = swings(vals, STRETCH)
    .filter(({ from, to }) => !plays.some(m => m.i > from && m.i <= to && Math.abs(m.delta) >= 0.4 * Math.abs(vals[to] - vals[from])))
    .map(({ from, to }) => {
      const delta = vals[to] - vals[from];
      const who = sideOf(delta, side);
      const [pa, pb] = [points[from].play, points[to].play];
      const scored = k => (Number(pb?.[k]) || 0) - (Number(pa?.[k]) || 0);
      const [mine, theirs] = delta >= 0 ? [scored('home'), scored('away')] : [scored('away'), scored('home')];
      const text = side.en ? `${who.name} ${mine}-${theirs}` : `${who.name} ${mine}-${theirs} ${to - from > RUN_PLAYS ? '拉開' : '攻勢'}`;
      return { i: to, from, delta, side: home(delta), icon: ICON.basketball, text, team: who.id, periods: [points[from].n, points[to].n] };
    });
  // The two biggest stretches and the six biggest possessions, in the game's order.
  const top = (list, n) => [...list].sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)).slice(0, n);
  return [...top(stretches, 2), ...top(plays, 6)].sort((x, y) => x.i - y.i);
}

export function playMoments(points, sport, side) {
  if (!points.length || !points.every(p => p.n)) return [];
  const found = swingMoments(points, sport, side);
  // The game's end, whole: every play there that moved it, tied it or put a side ahead.
  for (const m of clutchMoments(points, sport, side)) {
    // One play once (ESPN's score and the kickoff after it are the same play): its biggest swing, and whether it tied it or put a side ahead.
    const same = found.find(f => f.i === m.i || f.src === m.src);
    if (!same) found.push(m);
    else if (m.turned && !same.turned) Object.assign(same, { turned: m.turned, text: m.text, delta: Math.abs(m.delta) > Math.abs(same.delta) ? m.delta : same.delta, side: Math.abs(m.delta) > Math.abs(same.delta) ? m.side : same.side });
  }
  return found.sort((x, y) => x.i - y.i);
}

// The closing stretch (the last two minutes of the last period or overtime; a
// baseball game's 9th inning on): each play that moved the chance 5 points
// or more, and each that tied the game or changed who's ahead, however
// little the chance moved.
const CLUTCH = 0.05;
const lead = p => (p && p.home != null && p.away != null ? Math.sign(Number(p.home) - Number(p.away)) : null);
function clutchMoments(points, sport, side) {
  const vals = points.map(value);
  const out = [];
  let before = null;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    let play = p.play;
    const was = before;
    if (lead(play) != null) before = lead(play);
    if (!play || /end (period|of|game)|timeout/i.test(`${play.type} ${play.text}`)) continue;
    if (!(sport === 'baseball' ? p.n >= 9 : lateClock(sport, p))) continue;
    // ESPN puts a score's swing on the kickoff after it: the score's.
    if (/kickoff|kicks/i.test(`${play.type} ${play.text}`)) play = points.slice(Math.max(0, i - 3), i).reverse().find(q => q.play?.scoring)?.play || play;
    const delta = vals[i] - vals[i - 1];
    const turned = play.scoring && was != null && lead(play) != null && lead(play) !== was;
    if (Math.abs(delta) < CLUTCH && !turned) continue;
    const tied = turned && lead(play) === 0;
    const text = playText(sport, play, side.en, teamName(play.team, side) || sideOf(delta, side).name) + (turned ? (side.en ? (tied ? ' · ties it' : ' · takes the lead') : tied ? ' · 追平' : ' · 超前') : '');
    out.push({ i, delta, side: delta >= 0 ? 'home' : 'away', icon: ICON[sport] || '•', text, pic: sport === 'football' ? null : play.pic, team: play.team || sideOf(delta, side).id, clutch: true, src: play, turned: turned ? (tied ? 'tie' : 'lead') : '' });
  }
  return out;
}

// A Polymarket line: each event the market moved on (its price a minute
// before against five after); the scores and red cards always, as they're
// the story of a soccer game.
export function eventMoments(points, events, sport, side, times) {
  if (!points.length || !events?.length) return [];
  const at = t => {
    let k = 0;
    while (k + 1 < points.length && times[k + 1] <= t) k++;
    return k;
  };
  const found = events
    .filter(ev => ev.t >= times[0] && ev.t <= times.at(-1) + 300)
    .map(ev => {
      const [i0, i1] = [at(ev.t - 60), at(ev.t + 300)];
      const delta = value(points[i1]) - value(points[i0]);
      const i = Math.min(points.length - 1, at(ev.t) + 1);
      const mover = ev.play.team ? (String(ev.play.team) === String(side.home.id) ? 'home' : 'away') : delta >= 0 ? 'home' : 'away';
      const icon = ev.kind === 'red' ? '🟥' : ev.kind === 'miss' ? '❌' : ICON[sport] || '•';
      const text = ev.kind === 'miss' ? (side.en ? `${ev.play.who || ''} misses a penalty`.trim() : `${ev.play.who || ''} 12 碼罰球未進`.trim()) : playText(sport, { ...ev.play, kind: ev.kind }, side.en, teamName(ev.play.team, side));
      return { i, delta, side: mover, icon, text, always: sport === 'soccer' && ev.kind !== 'miss', pic: ev.play.pic, team: ev.play.team };
    })
    .filter(m => m.always || Math.abs(m.delta) >= 0.08);
  return biggest(found);
}

// The biggest few (a soccer game's goals and red cards first), in the game's order.
function biggest(list) {
  return [...list]
    .sort((a, b) => Number(Boolean(b.always)) - Number(Boolean(a.always)) || Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, KEEP)
    .sort((a, b) => a.i - b.i);
}

// ---- An F1 race: what turned it ----
// bands: [{ i0, i1, kind: 'sc' | 'vsc' | 'red', from, to }] (points' indexes,
// and laps); events: [{ i, kind: 'pit' | 'lead' | 'out', k }] (k: the
// driver's place in names, each its short name). Each band told with its
// cause (b.why, b.who: names, nameOf turns into the shown name) and who
// gained most (its laps, `laps`); a lead taken, a
// retirement, a stop that moved a chance 8 points: the five biggest, by lap.
const BAND = { sc: ['安全車', 'Safety car'], vsc: ['虛擬安全車', 'Virtual safety car'], red: ['紅旗', 'Red flag'] };
export const bandName = (kind, en) => BAND[kind]?.[en ? 1 : 0] || kind;
export function raceMoments(points, names, bands, events, en, nameOf = null) {
  const last = points.length - 1;
  const c = (i, k) => points[Math.max(0, Math.min(last, i))].c[k];
  const found = [];
  for (const b of bands) {
    const gains = names.map((_, k) => c(b.i1 + 2, k) - c(b.i0 - 1, k));
    const k = gains.reduce((m, g, j) => (Math.abs(g) > Math.abs(gains[m]) ? j : m), 0);
    const who = (b.who || []).map(n => (nameOf ? nameOf(n) : n)).join(en ? ' and ' : '、');
    // What sent it out, in a few words (the drivers who stopped under it show on the chart).
    const cause = !who ? '' : en ? ` · ${who} ${b.why === 'crash' ? 'collided' : b.why === 'stopped' ? 'stopped' : 'out'}` : ` · ${who} ${b.why === 'crash' ? '碰撞' : b.why === 'stopped' ? '停車' : '退賽'}`;
    const text = `${bandName(b.kind, en)}${cause}`;
    // At its first lap (the shading starts at the lap before's end).
    found.push({ i: Math.min(b.i1, b.i0 + 1), k, delta: gains[k], icon: b.kind === 'red' ? '🟥' : '🚨', text, band: true, driver: b.who?.[0] || null, laps: b.from != null ? [b.from, b.to] : null });
  }
  for (const ev of events) {
    // Leading away isn't a moment (the chart says who leads), nor a lead by one not drawn (no line of theirs).
    if (!ev.i || typeof ev.k !== 'number') continue;
    if (ev.kind === 'pit' && bands.some(b => ev.i >= b.i0 && ev.i <= b.i1)) continue;
    const delta = ev.kind === 'out' ? c(ev.i + 1, ev.k) - c(ev.i - 2, ev.k) : c(ev.i + (ev.kind === 'pit' ? 3 : 1), ev.k) - c(ev.i - 1, ev.k);
    if (ev.kind === 'pit' && Math.abs(delta) < 0.08) continue;
    const name = names[ev.k];
    const text = ev.kind === 'lead' ? (en ? `${name} takes the lead` : `${name} 取得領先`) : ev.kind === 'out' ? (en ? `${name} retires` : `${name} 退賽`) : en ? `${name} pits` : `${name} 進站`;
    found.push({ i: ev.i, k: ev.k, delta, icon: ev.kind === 'lead' ? '🏁' : ev.kind === 'out' ? '❌' : '🔧', text });
  }
  return [...found]
    .sort((a, b) => Number(Boolean(b.band)) - Number(Boolean(a.band)) || Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, KEEP)
    .sort((a, b) => a.i - b.i);
}

// The score at a point: ESPN's line, its play's (after it); Polymarket's, the
// last scoring play's by then (baseball's carry it), else the goals so far by
// each side (soccer's don't). [away, home] or null where there's nothing to go by.
export function scoreAt(points, i, events = [], homeId = '') {
  if (points[0]?.n) {
    for (let k = i; k >= 0; k--) {
      const p = points[k].play;
      if (Number.isFinite(Number(p?.home)) && Number.isFinite(Number(p?.away)) && p.home !== null && p.away !== null) return [Number(p.away), Number(p.home)];
    }
    return [0, 0];
  }
  const t = points[i]?.t;
  if (!Number.isFinite(t) || !events.length) return null;
  const by = events.filter(ev => ev.kind === 'score' && ev.t <= t);
  const told = [...by].reverse().find(ev => ev.play?.home != null && ev.play?.away != null);
  if (told) return [Number(told.play.away), Number(told.play.home)];
  const home = by.filter(ev => String(ev.play?.team) === String(homeId)).length;
  return [by.length - home, home];
}

// The game clock where it tells: the last two minutes of the last period (or overtime) of a game with a clock.
const LAST = { basketball: 4, football: 4, hockey: 3 };
export function lateClock(sport, point) {
  const clock = point?.play?.clock;
  if (!LAST[sport] || !clock || !(point.n >= LAST[sport])) return '';
  const [m, sec] = clock.includes(':') ? clock.split(':').map(Number) : [0, Number(clock)];
  return m * 60 + sec <= 120 ? clock : '';
}
