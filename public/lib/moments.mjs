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
// A thief by family name ("Ronald Holland II" → "Holland II"): the row stays one line.
const initial = name => (name ? name.replace(/^\S+\s+(?=\S)/, '') : name);
// A basketball play in a few words: made or missed and what, a free throw,
// a turnover (and who stole it), a foul, a rebound, a block.
function basketballZh(play) {
  const t = `${play.type} ${play.text}`;
  const made = play.scoring || /\bmakes\b/i.test(play.text);
  if (/turnover|bad pass|traveling|lost ball|offensive foul/i.test(t)) {
    const thief = initial(/\(([^)]+?) steals?\)/i.exec(play.text)?.[1]);
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
// The first sentence, never cut at an initial ("E. Hernández homered").
const sentence = text => String(text || '').replace(/^\([^)]*\)\s*/, '').split(/(?<=(?<!\b[A-Z])\.)\s/)[0].slice(0, 90);

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
// single plays. Basketball, a high-scoring game where one three is just a
// possession (and ESPN's line jumps on one, then jumps back): before the
// last two minutes only the runs (told by the points each side scored);
// a possession is a moment only at the end (clutchMoments), where one
// can decide it.
const SINGLE = 0.07;
// Baseball, football, hockey: a swing of BIG, and a SHARE of the game's
// biggest, is a moment (a lead taken or a tie from SINGLE); MOST at most.
// (Football's chance moves in smaller steps over more plays: its bar is lower.)
const BIG = { football: 0.08 };
const SHARE = 0.35;
const MOST = 10;
const RUN_PLAYS = 48;
// Basketball: a drift of this much is a stretch (a run), RUNS at most.
const STRETCH = 0.2;
const RUNS = 4;
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
      // Not a play (a player reported eligible, a timeout, a quarter's end): the line just moved under it.
      if (/reported in as eligible|timeout|two-minute warning|end (of )?(quarter|half|game|period)/i.test(`${play?.type} ${play?.text}`)) continue;
      if (!(Math.abs(delta) >= SINGLE && play)) continue;
      // A score that tied it or put a side ahead (anywhere in the game, not only at its end), said.
      const was = lead(points.slice(0, i).reverse().find(q => lead(q.play) != null)?.play);
      const now = lead(play);
      const turned = play.scoring && was != null && now != null && now !== was ? (now === 0 ? 'tie' : 'lead') : '';
      const said = turned ? (side.en ? (turned === 'tie' ? ' · ties it' : ' · takes the lead') : turned === 'tie' ? ' · 追平' : ' · 超前') : '';
      found.push({ i, delta, side: home(delta), icon: ICON[sport] || '•', text: playText(sport, play, side.en, teamName(play.team, side) || sideOf(delta, side).name) + said, pic: sport === 'football' ? null : play.pic, team: play.team || sideOf(delta, side).id, src: play, turned });
    }
    if (sport !== 'baseball') return found;
    // An inning's rally of small plays (a single, a bunt, a groundout, a
    // single: no one play big enough) is one moment; its plays aren't.
    const rallies = halfInnings(points, vals, side);
    return [...rallies, ...found.filter(f => !rallies.some(r => f.i >= r.from && f.i <= r.i))];
  }
  // The stretches it drifted over (a slow slide over a quarter or two): each told by the points each side scored over it.
  const stretches = swings(vals, STRETCH)
    .map(s => tighten(vals, s))
    .map(({ from, to }) => {
      const delta = vals[to] - vals[from];
      const who = sideOf(delta, side);
      const [pa, pb] = [points[from].play, points[to].play];
      const scored = k => (Number(pb?.[k]) || 0) - (Number(pa?.[k]) || 0);
      const [mine, theirs] = delta >= 0 ? [scored('home'), scored('away')] : [scored('away'), scored('home')];
      // What it did to the score: from behind to level (追平), to ahead
      // (超前), still behind but closer (追近); else a lead made (攻勢), a
      // long one stretched (拉開).
      const side0 = k => Number((delta >= 0 ? pa : pa && { home: pa.away, away: pa.home })?.[k]) || 0;
      const side1 = k => Number((delta >= 0 ? pb : pb && { home: pb.away, away: pb.home })?.[k]) || 0;
      const [m0, m1] = [side0('home') - side0('away'), side1('home') - side1('away')];
      const did = m0 < 0 && m1 === 0 ? ['追平', ' · ties it'] : m0 < 0 && m1 > 0 ? ['超前', ' · takes the lead'] : m1 < 0 ? ['追近', ''] : [to - from > RUN_PLAYS ? '拉開' : '攻勢', ''];
      const text = side.en ? `${who.name} ${mine}-${theirs}${did[1]}` : `${who.name} ${mine}-${theirs} ${did[0]}`;
      return { i: to, from, delta, side: home(delta), icon: ICON.basketball, text, team: who.id, periods: [points[from].n, points[to].n] };
    });
  // The biggest few (RUNS), in the game's order.
  return [...stretches]
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
    .slice(0, RUNS)
    .sort((x, y) => x.i - y.i);
}

// Baseball: each half-inning that moved it a lot (RALLY) with no one play
// doing most of it (two thirds), told by the runs scored in it: 教士 3局下
// 攻下 2 分 (its dot on the last run).
const RALLY = 0.12;
function halfInnings(points, vals, side) {
  const out = [];
  let a = 1;
  for (let i = 1; i <= points.length; i++) {
    const p = points[i];
    if (i < points.length && p.n === points[a].n && p.half === points[a].half) continue;
    const b = i - 1;
    const delta = vals[b] - vals[a - 1];
    let most = 0;
    for (let k = a; k <= b; k++) most = Math.max(most, Math.abs(vals[k] - vals[k - 1]));
    const score = k => points.slice(0, k + 1).reverse().find(q => q.play?.home != null && q.play?.away != null)?.play;
    const [s0, s1] = [score(a - 1), score(b)];
    const who = delta >= 0 ? 'home' : 'away';
    const runs = (Number(s1?.[who]) || 0) - (Number(s0?.[who]) || 0);
    const last = [...Array(b - a + 1).keys()].map(k => a + k).reverse().find(k => points[k].play?.scoring);
    if (Math.abs(delta) >= RALLY && most < (2 / 3) * Math.abs(delta) && runs > 0 && last != null) {
      const team = sideOf(delta, side);
      const when = side.en ? `${points[a].half === 'top' ? 'Top' : 'Bottom'} ${points[a].n}` : `${points[a].n}局${points[a].half === 'top' ? '上' : '下'}`;
      // A tie or a lead taken by it, said (as the late plays' are).
      const [l0, l1] = [lead(s0), lead(s1)];
      const turned = l0 != null && l1 != null && l1 !== l0 ? (l1 === 0 ? 'tie' : 'lead') : '';
      const said = turned ? (side.en ? (turned === 'tie' ? ' · ties it' : ' · takes the lead') : turned === 'tie' ? ' · 追平' : ' · 超前') : '';
      out.push({ i: last, from: a, delta, side: who, icon: ICON.baseball, text: (side.en ? `${team.name} score ${runs} · ${when}` : `${team.name} ${when}攻下 ${runs} 分`) + said, team: team.id, src: points[last].play, rally: true, turned });
    }
    a = i;
  }
  return out;
}

// A stretch where it really moved: from the last point still near its start
// to the first that got most of the way (80%), and on while each play still
// moves it the same way at the run's pace (a run counted whole). A line's extreme can come long
// after the game was decided: the Warriors at 83% midway through the first
// quarter drifted to 98% by half time, and a dot at 98% puts the run at the
// end of the half, long after it had done its work. (A 1% chance drifting to
// 0% until the buzzer, the same.)
const ARRIVED = 0.8;
const STARTED = 0.05;
export function tighten(values, { from, to }) {
  const move = values[to] - values[from];
  const dir = Math.sign(move);
  if (!dir) return { from, to };
  let end = from;
  while (end < to && dir * (values[end] - values[from]) < ARRIVED * Math.abs(move)) end++;
  // A run still going (each play still moving it the same way, at a quarter
  // of its pace so far or more) is counted to its end; a slow drift isn't.
  const pace = () => Math.abs(values[end] - values[from]) / Math.max(1, end - from);
  while (end < to && dir * (values[end + 1] - values[end]) >= 0.25 * pace()) end++;
  let start = end;
  while (start > from && dir * (values[start] - values[from]) > STARTED * Math.abs(move)) start--;
  return { from: start, to: end };
}

export function playMoments(points, sport, side) {
  if (!points.length || !points.every(p => p.n)) return [];
  const found = swingMoments(points, sport, side);
  // The game's end, whole: every play there that moved it, tied it or put a side ahead.
  for (const m of clutchMoments(points, sport, side)) {
    // One play once (ESPN's score and the kickoff after it are the same play): its biggest swing, and whether it tied it or put a side ahead.
    // (A stretch ending on it is not the same: it's told by the points over it, and the play stays its own.)
    const same = found.find(f => !f.periods && (f.i === m.i || f.src === m.src));
    if (!same) found.push(m);
    else if (m.turned && !same.turned) Object.assign(same, { turned: m.turned, text: m.text, delta: Math.abs(m.delta) > Math.abs(same.delta) ? m.delta : same.delta, side: Math.abs(m.delta) > Math.abs(same.delta) ? m.side : same.side });
  }
  if (sport === 'basketball') return found.sort((x, y) => x.i - y.i);
  // The rest: no set number, a bar by the game. Every score that tied it or
  // put a side ahead; and every other swing of 10% or more that's at least a
  // third of the game's biggest (a blowout's small wobbles out, a seesaw's
  // every turn in). Late plays meet the same bar as early ones (a walk in
  // the 9th at +9% isn't kept over a +19% rally in the 3rd). MOST only so
  // the list can't become a wall: the biggest kept, in the game's order.
  const top = Math.max(0, ...found.map(m => Math.abs(m.delta)));
  const bar = Math.max(BIG[sport] ?? 0.1, top * SHARE);
  const weight = m => Math.abs(m.delta) + (m.turned ? 0.08 : 0);
  return found
    .filter(m => (m.turned && Math.abs(m.delta) >= SINGLE) || Math.abs(m.delta) >= bar)
    .sort((x, y) => weight(y) - weight(x))
    .slice(0, MOST)
    .sort((x, y) => x.i - y.i);
}

// One stop in play: the plays on the same clock (a foul and its free
// throws, a miss and its rebound), told by the one that moved it most and
// counted by what they did together (a free throw made and one missed can
// cancel out). { from, to, key } as points' indexes. Baseball has no clock:
// each play its own.
function stops(points) {
  const out = [];
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const clock = p.play?.clock;
    const last = out.at(-1);
    if (last && clock && points[last.to].n === p.n && points[last.to].play?.clock === clock) last.to = i;
    else out.push({ from: i, to: i });
  }
  const vals = points.map(value);
  for (const g of out) {
    let key = g.from;
    for (let i = g.from; i <= g.to; i++) if (points[i].play && !/end (period|of|game)|timeout/i.test(`${points[i].play.type} ${points[i].play.text}`) && (!points[key].play || Math.abs(vals[i] - vals[i - 1]) > Math.abs(vals[key] - vals[key - 1]))) key = i;
    // A score that changed who's ahead tells it (the dunk, not the foul before it).
    for (let i = g.from; i <= g.to; i++) if (points[i].play?.scoring && lead(points[i].play) !== lead(points[g.from - 1]?.play)) key = i;
    g.key = key;
  }
  return out;
}

// The closing stretch (the last two minutes of the last period or overtime; a
// baseball game's 9th inning on): the stops that decided it, five at most: each
// that tied the game or changed who's ahead first, then the biggest swings
// (8 points or more), in the game's order. Every play there is still on the
// line for a finger.
const CLUTCH = 0.08;
const CLOSE_MAX = 5;
const lead = p => (p && p.home != null && p.away != null ? Math.sign(Number(p.home) - Number(p.away)) : null);
function clutchMoments(points, sport, side) {
  const vals = points.map(value);
  const out = [];
  let before = null;
  for (const g of stops(points)) {
    const was = before;
    for (let i = g.from; i <= g.to; i++) if (lead(points[i].play) != null) before = lead(points[i].play);
    const p = points[g.key];
    let play = p.play;
    if (!play || /end (period|of|game)|timeout/i.test(`${play.type} ${play.text}`)) continue;
    if (!(sport === 'baseball' ? p.n >= 9 : lateClock(sport, p))) continue;
    // ESPN puts a score's swing on the kickoff after it: the score's.
    if (/kickoff|kicks/i.test(`${play.type} ${play.text}`)) play = points.slice(Math.max(0, g.key - 3), g.key).reverse().find(q => q.play?.scoring)?.play || play;
    const delta = vals[g.to] - vals[g.from - 1];
    const turned = was != null && before != null && before !== was && points.slice(g.from, g.to + 1).some(q => q.play?.scoring);
    if (Math.abs(delta) < CLUTCH && !turned) continue;
    const tied = turned && before === 0;
    const text = playText(sport, play, side.en, teamName(play.team, side) || sideOf(delta, side).name) + (turned ? (side.en ? (tied ? ' · ties it' : ' · takes the lead') : tied ? ' · 追平' : ' · 超前') : '');
    out.push({ i: g.key, delta, side: delta >= 0 ? 'home' : 'away', icon: ICON[sport] || '•', text, pic: sport === 'football' ? null : play.pic, team: play.team || sideOf(delta, side).id, clutch: true, src: play, turned: turned ? (tied ? 'tie' : 'lead') : '' });
  }
  return [...out]
    .sort((a, b) => Number(Boolean(b.turned)) - Number(Boolean(a.turned)) || Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, CLOSE_MAX)
    .sort((a, b) => a.i - b.i);
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

// ---- 過程: every play, said in Chinese (English: ESPN's own words) ----
// The key moments' words where they fit (a shot made or missed, a hit, a
// touchdown), and what a whole game's list holds beyond them: a timeout, a
// period's end, a substitution, a card. Never ESPN's English in Chinese:
// a play with nothing known said by its team's name and the kind of play.
const SOCCER_KIND = [
  [/own-goal/, () => '烏龍球'],
  [/penalty---scored|goal---penalty/, w => `${w} 12 碼進球`],
  [/penalty---missed/, w => `${w} 12 碼罰球未進`],
  [/penalty---saved/, w => `${w} 12 碼罰球被撲出`],
  [/^goal/, w => `${w} 進球`],
  [/yellow-red|second-yellow/, w => `${w} 兩黃變一紅`],
  [/yellow-card/, w => `${w} 黃牌`],
  [/red-card/, w => `${w} 紅牌`],
  [/^kickoff$/, () => '開賽'],
  [/^halftime$/, () => '上半場結束'],
  [/start-2nd-half/, () => '下半場開始'],
  [/start-extra-time|start-overtime/, () => '延長賽開始'],
  [/end-regular-time/, () => '常規時間結束'],
  [/start-delay/, () => '比賽暫停'],
  [/end-delay/, () => '比賽繼續'],
  [/var|video/, () => 'VAR 檢視'],
  [/offside/, w => `${w} 越位`],
  [/foul/, w => `${w} 犯規`],
  [/corner/, () => '角球'],
  [/shot|attempt/, w => `${w} 射門`]
];
const HOCKEY_ZH = [
  [/^goal/i, '進球'],
  [/penalty/i, '判罰'],
  [/blocked/i, '封阻'],
  [/missed/i, '射偏'],
  [/shot/i, '射門'],
  [/faceoff/i, '爭球'],
  [/hit/i, '衝撞'],
  [/giveaway/i, '失誤'],
  [/takeaway/i, '抄截'],
  [/period start/i, '本節開始'],
  [/period end|end of period/i, '本節結束'],
  [/stoppage/i, '比賽中斷']
];
function basketballFeed(play, team) {
  const t = `${play.type} ${play.text}`;
  if (/end (of )?game/i.test(t)) return '比賽結束';
  if (/end (of )?(period|quarter|\d)/i.test(t)) return '本節結束';
  if (/timeout/i.test(t)) return `${team ? `${team} ` : ''}暫停`;
  if (/jump ?ball/i.test(t)) return '跳球';
  if (/enters the game|substitution/i.test(t)) return play.other ? `${play.who} 替換 ${play.other}` : `${play.who} 上場`;
  if (/ejected|ejection/i.test(t)) return `${play.who} 被驅逐出場`;
  if (/technical/i.test(t)) return `${play.who || team} 技術犯規`;
  if (/violation|delay|kicked ball|lane|goaltending/i.test(t)) return `${play.who || team} 違例`;
  if (/review|replay|challenge/i.test(t)) return `${team ? `${team} ` : ''}重播檢視`;
  if (/charge/i.test(t) && !/turnover/i.test(t)) return `${play.who || team} 進攻犯規`;
  // Anything else that isn't a shot, a free throw, a foul, a rebound, a block or a turnover: said as a play, never as a missed jumper.
  if (!/shot|jumper|layup|dunk|hook|tip|three|free throw|foul|rebound|block|turnover|bad pass|traveling|lost ball|steal|\bmakes\b|\bmisses\b/i.test(t)) return [play.who || team, '比賽事件'].filter(Boolean).join(' ');
  const said = basketballZh(play);
  const free = /free throw/i.test(t) && /(\d) of (\d)/i.exec(play.text);
  // A free throw, short (the row stays one line): 罰進 2/2, 沒罰進 1/2.
  const what = free ? `${play.scoring || /\bmakes\b/i.test(play.text) ? '罰進' : '沒罰進'} ${free[1]}/${free[2]}` : said;
  // A made shot's assist: "(LeBron James assists)".
  const helper = /\(([^)]+?) assists?\)/i.exec(play.text)?.[1];
  return [play.who || team, what].filter(Boolean).join(' ') + (helper && !free ? `（${initial(helper)} 助攻）` : '');
}
export function feedText(sport, play, en, team = '') {
  if (en) return play.text || play.type || '';
  const who = play.who || named(play.text) || team;
  if (sport === 'soccer') {
    const kind = String(play.kind || play.type || '').toLowerCase();
    if (/substitution/.test(kind)) return play.who ? (play.other ? `${play.who} 替換 ${play.other}` : `${play.who} 上場`) : `${team} 換人`;
    const hit = SOCCER_KIND.find(([re]) => re.test(kind));
    return hit ? hit[1](who).trim() : [team, '比賽事件'].filter(Boolean).join(' ');
  }
  if (sport === 'basketball') return basketballFeed(play, team);
  if (sport === 'hockey') return [who, firstOf(HOCKEY_ZH, play.type, play.text) || '比賽事件'].filter(Boolean).join(' ');
  // A scoring play's runs (a list of the scoring plays doesn't mark them scoring).
  return playText(sport, { ...play, scoring: play.scoring || play.value > 0 }, false, team);
}

// A play's words split for its row: the play itself (one line) and, small
// beneath, the team (unless the play already starts with it) and who helped
// (an assist, a steal, said in brackets).
export function playParts(text, team) {
  const aside = /^(.*?)\s*[（(]([^（）()]+)[）)]$/.exec(text);
  const main = aside ? aside[1] : text;
  const own = Boolean(team) && main.startsWith(team);
  return { main, sub: [own ? '' : team, aside?.[2] || ''].filter(Boolean).join(' · ') };
}
