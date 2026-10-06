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
      if (v > values[hi]) hi = i;
      if (v < values[lo]) lo = i;
      if (values[hi] - values[lo] >= least) [dir, start, ext] = hi > lo ? [1, lo, hi] : [-1, hi, lo];
    } else if (dir * (v - values[ext]) >= 0) ext = i;
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
  if (sport === 'basketball') return [who, firstOf(NBA_ZH, play.type, play.text) || '得分'].filter(Boolean).join(' ') + (play.scoring && play.value ? ` · ${play.value} 分` : '');
  // A flag's team isn't the drive's: the call alone.
  if (sport === 'football') return /penalty/i.test(`${play.type} ${play.text}`) && !/touchdown|field goal good/i.test(play.type) ? '關鍵判罰' : [team, firstOf(NFL_ZH, play.type, play.text) || '關鍵進攻'].filter(Boolean).join(' ');
  if (sport === 'soccer') return [who, play.kind === 'red' ? '紅牌' : '進球'].filter(Boolean).join(' ');
  return [who, play.type].filter(Boolean).join(' ');
}

// The swing's side: the home side's chance up, theirs; down, the away side's.
const sideOf = (delta, side) => (delta >= 0 ? side.home : side.away);
const teamName = (id, side) => (String(id) === String(side.home.id) ? side.home.name : String(id) === String(side.away.id) ? side.away.name : '');

// Where one play decides it (baseball, football, hockey): the biggest
// single plays. Basketball: the runs, each the steepest stretch (some five
// minutes of plays) of a swing, told by the points each side scored.
const SINGLE = 0.07;
const RUN_PLAYS = 48;
export function playMoments(points, sport, side) {
  if (!points.length || !points.every(p => p.n)) return [];
  const vals = points.map(value);
  const home = d => (d >= 0 ? 'home' : 'away');
  if (sport !== 'basketball') {
    const found = [];
    for (let i = 1; i < points.length; i++) {
      const delta = vals[i] - vals[i - 1];
      // ESPN puts a score's swing on the kickoff after it: the score's.
      let play = points[i].play;
      if (/kickoff|kicks/i.test(`${play?.type} ${play?.text}`)) play = points.slice(Math.max(0, i - 3), i).reverse().find(p => p.play?.scoring)?.play || play;
      if (Math.abs(delta) >= SINGLE && play) found.push({ i, delta, side: home(delta), icon: ICON[sport] || '•', text: playText(sport, play, side.en, teamName(play.team, side) || sideOf(delta, side).name), pic: sport === 'football' ? null : play.pic, team: play.team || sideOf(delta, side).id });
    }
    return biggest(found);
  }
  const found = swings(vals).map(({ from, to }) => {
    const dir = Math.sign(vals[to] - vals[from]);
    // The steepest stretch: the most it moved within RUN_PLAYS plays, then the shortest stretch with nine tenths of that.
    let most = 0;
    for (let i = from; i < to; i++) for (let j = i + 1; j <= Math.min(to, i + RUN_PLAYS); j++) most = Math.max(most, dir * (vals[j] - vals[i]));
    let [a, b] = [from, to];
    for (let i = from; i < to; i++)
      for (let j = i + 1; j <= Math.min(to, i + RUN_PLAYS); j++)
        if (dir * (vals[j] - vals[i]) >= 0.9 * most && j - i < b - a) {
          [a, b] = [i, j];
          break;
        }
    const delta = vals[b] - vals[a];
    const who = sideOf(delta, side);
    const [pa, pb] = [points[a].play, points[b].play];
    const scored = k => (Number(pb?.[k]) || 0) - (Number(pa?.[k]) || 0);
    const [mine, theirs] = delta >= 0 ? [scored('home'), scored('away')] : [scored('away'), scored('home')];
    const text = mine + theirs > 0 ? (side.en ? `${who.name} ${mine}-${theirs} run` : `${who.name} ${mine}-${theirs} 攻勢`) : side.en ? `${who.name} take control` : `${who.name} 掌握局勢`;
    return { i: b, delta, side: home(delta), icon: ICON.basketball, text, team: who.id };
  });
  return biggest(found.filter(m => Math.abs(m.delta) >= 0.1));
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
// cause (b.why, b.who: family names, nameOf turns into the shown name), the
// drawn drivers who stopped under it and who gained most (its laps, `laps`); a lead taken, a
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
    const stopped = [...new Set(events.filter(ev => ev.kind === 'pit' && ev.i >= b.i0 && ev.i <= b.i1).map(ev => names[ev.k]))];
    const who = (b.who || []).map(n => (nameOf ? nameOf(n) : n)).join(en ? ' and ' : '、');
    const cause = !who ? '' : en ? ` · ${b.why === 'crash' ? `${who} collided` : b.why === 'stopped' ? `${who} stopped` : `${who} out`}` : ` · 起因：${who} ${b.why === 'crash' ? '碰撞' : b.why === 'stopped' ? '停車' : '退賽'}`;
    const text = `${bandName(b.kind, en)}${cause}${stopped.length ? (en ? ` · ${stopped.join(', ')} pitted` : ` · ${stopped.join('、')} 進站`) : ''}`;
    // At its first lap (the shading starts at the lap before's end).
    found.push({ i: Math.min(b.i1, b.i0 + 1), k, delta: gains[k], icon: b.kind === 'red' ? '🟥' : '🚨', text, band: true, driver: b.who?.[0] || null, laps: b.from != null ? [b.from, b.to] : null });
  }
  for (const ev of events) {
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
