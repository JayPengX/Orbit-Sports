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
  [/caught stealing/i, '盜壘失敗'],
  [/picked off|pickoff/i, '牽制出局'],
  [/defensive indifference/i, '無防守盜壘'],
  [/stolen base|stole/i, '盜壘'],
  [/balk/i, '投手犯規'],
  [/catcher'?s interference/i, '捕手妨礙'],
  [/strike|struck out/i, '被三振'],
  [/ground/i, '滾地出局'],
  // (Only a line drive: "Lineup Change" read as one.)
  [/\blined\b|line ?out|line drive/i, '平飛出局'],
  [/pop|foul out/i, '內野飛球出局'],
  [/fly|flied/i, '高飛出局'],
  // A runner moving up on no batted ball ("to second on a throw").
  [/ to (second|third|home)\b| advanced/i, '推進']
];
const MLB_EN = [
  [/grand slam/i, 'grand slam'], [/home run|homered/i, 'homers'], [/triple/i, 'triples'], [/double play/i, 'double play'], [/double/i, 'doubles'],
  [/single/i, 'singles'], [/sac(rifice)? fly/i, 'sac fly'], [/sac(rifice)? bunt/i, 'sac bunt'], [/intentional walk/i, 'walked on purpose'],
  [/walk|base on balls/i, 'walks'], [/hit by pitch/i, 'hit by pitch'], [/wild pitch/i, 'wild pitch'], [/passed ball/i, 'passed ball'],
  [/error/i, 'reaches on error'], [/fielder'?s choice/i, "fielder's choice"], [/caught stealing/i, 'caught stealing'], [/stolen base|stole/i, 'steals'],
  [/strike|struck out/i, 'strikes out'], [/ground/i, 'grounds out'], [/\blined\b|line ?out|line drive/i, 'lines out'], [/pop|foul out/i, 'pops out'], [/fly|flied/i, 'flies out']
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

const ICON = { baseball: '⚾', basketball: '🏀', soccer: '⚽' };
const firstOf = (list, ...texts) => list.find(([re]) => texts.some(t => re.test(t || '')))?.[1];
// The doer from the play's words where ESPN names nobody ("Rice homered to right").
const named = text => /^(?:\([^)]*\)\s*)?([A-Z][\w.'’-]*(?:\s+[A-Z][\w.'’-]*){0,2})/.exec(text || '')?.[1] || '';
// The first sentence, never cut at an initial ("E. Hernández homered").
const sentence = text => String(text || '').replace(/^\([^)]*\)\s*/, '').split(/(?<=(?<!\b[A-Z])\.)\s/)[0].slice(0, 90);

// Baseball's lineup changes (ESPN's "Lineup Change"): a pitcher replaced, a
// pinch-hitter or -runner, a fielder moved; '' for any other play.
const FIELD_ZH = { 'left field': '左外野', 'center field': '中外野', 'right field': '右外野', 'first base': '一壘', 'second base': '二壘', 'third base': '三壘', shortstop: '游擊', catching: '捕手', pitching: '投手', 'designated hitter': '指定打擊' };
export function lineupZh(play) {
  const t = String(play.text || '').trim().replace(/\.$/, '');
  if (!/lineup change/i.test(play.alt || '') && !/ (relieved|hit for|ran for) /.test(t)) return '';
  let m;
  if ((m = /^(.+?) relieved (.+)$/.exec(t))) return `換投：${m[1]} 接替 ${m[2]}`;
  if ((m = /^(.+?) hit for (.+)$/.exec(t))) return `代打：${m[1]} 替 ${m[2]}`;
  if ((m = /^(.+?) ran for (.+)$/.exec(t))) return `代跑：${m[1]} 替 ${m[2]}`;
  if ((m = /^(.+?) (?:in |to |at |playing )?(left field|center field|right field|first base|second base|third base|shortstop|catching|pitching|designated hitter)$/.exec(t))) return `守備調整：${m[1]} ${m[2] === 'catching' || m[2] === 'pitching' ? '擔任' : '改守'}${FIELD_ZH[m[2]]}`;
  return '陣容調整';
}
// A basket in English as short as the Chinese: who, then what (ESPN's
// "Dillon Jones makes running layup (Labaron Philon Jr. assists)" ran past its row).
export function basketEn(p) {
  const t = String(p.text || '');
  const ft = /free throw[^0-9]*(\d) of (\d)/i.exec(t);
  const what = ft ? `free throw ${ft[1]}/${ft[2]}` : /three point/i.test(t) ? 'three' : /dunk/i.test(t) ? 'dunk' : /alley oop/i.test(t) ? 'alley-oop' : /layup/i.test(t) ? 'layup' : /hook/i.test(t) ? 'hook shot' : /tip/i.test(t) ? 'tip-in' : 'jumper';
  return `${p.who} ${what}`;
}
export function playText(sport, play, en, team) {
  const who = play.who || named(play.text);
  // Baseball in English, as short as the Chinese: who, what, the RBIs (ESPN's
  // sentence ran on: "DeLauter singled to right, Kwan scored, DeLauter out…").
  if (en && sport === 'baseball' && !lineupZh(play)) {
    const what = firstOf(MLB_EN, play.alt, play.text);
    if (what) return [who, what].filter(Boolean).join(' ') + (play.scoring && play.value ? ` · ${play.value} RBI` : '');
  }
  if (en && sport === 'basketball' && who && /\bmakes\b|\bmade\b/i.test(play.text || '')) return basketEn({ ...play, who });
  if (en) return sentence(play.text) || play.type;
  if (sport === 'baseball') {
    // A lineup change before any at-bat's words ("Kelly relieved Sulser" read
    // as a lineout: "Lineup" has "line" in it).
    const change = lineupZh(play);
    if (change) return change;
    const what = firstOf(MLB_ZH, play.alt, play.text) || '關鍵打擊';
    return [who, what].filter(Boolean).join(' ') + (play.scoring && play.value ? ` · ${play.value} 分打點` : '');
  }
  // A team's own (a team rebound, a shot clock violation): the side's name, never ESPN's English.
  if (sport === 'basketball') return [play.who || team || who, basketballZh(play)].filter(Boolean).join(' ');
  if (sport === 'soccer') return [who, play.kind === 'red' ? '紅牌' : '進球'].filter(Boolean).join(' ');
  return [who, play.type].filter(Boolean).join(' ');
}

// The swing's side: the home side's chance up, theirs; down, the away side's.
const sideOf = (delta, side) => (delta >= 0 ? side.home : side.away);
const teamName = (id, side) => (String(id) === String(side.home.id) ? side.home.name : String(id) === String(side.away.id) ? side.away.name : '');

// Basketball, a high-scoring game where one three is just a possession (and ESPN's line jumps on one, then jumps back): before the
// last two minutes only the runs (told by the points each side scored);
// a possession is a moment only at the end (clutchMoments), where one
// can decide it.
const RUN_PLAYS = 48;
// Basketball: a drift of this much is a stretch (a run), RUNS at most.
const STRETCH = 0.2;
const RUNS = 4;
// The first point after `from`, up to `to`, whose play has `mine` ahead
// (`ahead`) or level with the other side; null if none says so.
function leadAt(points, from, to, mine, ahead) {
  const other = mine === 'home' ? 'away' : 'home';
  for (let k = from + 1; k <= to; k++) {
    const p = points[k]?.play;
    if (p?.home == null || p?.away == null) continue;
    const m = (Number(p[mine]) || 0) - (Number(p[other]) || 0);
    if (ahead ? m > 0 : m === 0) return k;
  }
  return null;
}
// The score at point `k` as { home, away }: scoreAt's (its play's, else the
// last before it with one: a timeout's play has none, read 0-0 it made a run "-5--12").
const lastScore = (points, k) => {
  const [away, home] = scoreAt(points, k) || [0, 0];
  return { home, away };
};
function swingMoments(points, sport, side) {
  const vals = points.map(value);
  const home = d => (d >= 0 ? 'home' : 'away');
  // The stretches it drifted over (a slow slide over a quarter or two): each told by the points each side scored over it.
  const stretches = swings(vals, STRETCH)
    .map(s => tighten(vals, s))
    .map(({ from, to }) => {
      const delta = vals[to] - vals[from];
      const who = sideOf(delta, side);
      const [pa, pb] = [lastScore(points, from), lastScore(points, to)];
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
      // A run that took the lead (or tied it): the play where the score did,
      // by the play-by-play (`lead`), for 過程's row. The price lags the plays,
      // so its peak (`i`, the chart's dot) can be a few plays on (the owner, 2026-10-23).
      const flip = did[0] === '超前' || did[0] === '追平' ? leadAt(points, from, to, delta >= 0 ? 'home' : 'away', did[0] === '超前') : null;
      return { i: to, from, delta, side: home(delta), icon: ICON.basketball, text, team: who.id, periods: [points[from].n, points[to].n], ...(flip != null ? { lead: flip } : {}) };
    });
  // The biggest few (RUNS), in the game's order.
  return [...stretches]
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
    .slice(0, RUNS)
    .sort((x, y) => x.i - y.i);
}

// Who did an inning's scoring: its one big hit (3 of 4 runs: that hit, its
// RBIs); else back-to-back homers named together (1 run each: no one of them
// is the story); a string of small ones (no one hit much: the owner,
// 2026-10-18) as that, its batters named; else its two hits, each said.
const HOMER = /home run|homered|grand slam/i;
const whoOf = p => p.who || named(p.text);
// (`said` gets the hitters the words name, for their faces.)
function rallyHits(points, hits, key, runs, en, team, said = []) {
  const top = points[key].play;
  if (hits.length === 1 || (Number(top.value) || 0) * 2 > runs) return said.push(key), playText('baseball', top, en, team);
  const homers = hits.filter(k => HOMER.test(`${points[k].play.alt} ${points[k].play.text}`));
  // Back to back: two (or more) homers with no scoring play between them.
  const run = [];
  for (const k of homers) if (!run.length || hits.indexOf(k) === hits.indexOf(run.at(-1)) + 1) run.push(k);
  else if (run.length < 2) run.splice(0, run.length, k);
  if (run.length >= 2) {
    said.push(...run.slice(0, 3));
    const names = run.slice(0, 3).map(k => whoOf(points[k].play));
    return en ? `${names.join(', ')} back-to-back homers` : `${names.join('、')} 背靠背全壘打`;
  }
  if (hits.length >= 3) {
    // Two named on the line (it fits a phone), how many drove runs in under it.
    said.push(...hits.slice(0, 2));
    const names = hits.slice(0, 2).map(k => whoOf(points[k].play));
    return en ? `${names.join(', ')} and more · ${hits.length} RBI plays` : `${names.join('、')} 等串聯 · ${hits.length} 次打點`;
  }
  const two = [...hits].sort((x, y) => (Number(points[y].play.value) || 0) - (Number(points[x].play.value) || 0)).slice(0, 2).sort((x, y) => x - y);
  // The names on the line, what each did under it (both on one line overran its chip).
  said.push(...two);
  const did = k => firstOf(en ? MLB_EN : MLB_ZH, points[k].play.alt, points[k].play.text) || (en ? 'scores' : '安打');
  return `${two.map(k => whoOf(points[k].play)).join(en ? ', ' : '、')} · ${two.map(did).join(en ? ', ' : '、')}`;
}

// Baseball, a low-scoring game (the owner, 2026-10-18): its scoring, every
// half-inning with runs one moment (its hitters named, the dot on the last
// run), and the pitching that held it: the few outs that moved it most,
// the pitcher's (a strikeout with the bases loaded). PITCHES at most, each
// a swing of PITCH or more, so the list stays short.
const PITCH = 0.1;
const PITCHES = 3;
function baseballMoments(points, side) {
  const vals = points.map(value);
  const out = [];
  const score = k => lastScore(points, k);
  let a = 1;
  for (let i = 1; i <= points.length; i++) {
    if (i < points.length && points[i].n === points[a].n && points[i].half === points[a].half) continue;
    const b = i - 1;
    const [s0, s1] = [score(a - 1), score(b)];
    const got = k => (Number(s1?.[k]) || 0) - (Number(s0?.[k]) || 0);
    // The side at bat (top: the away side), else whichever scored (a line with no halves).
    const bats = points[a].half ? (points[a].half === 'top' ? 'away' : 'home') : got('home') > 0 ? 'home' : 'away';
    const runs = got(bats);
    const scored = [...Array(b - a + 1).keys()].map(k => a + k).filter(k => points[k].play?.scoring);
    if (runs > 0 && scored.length) {
      const last = scored.at(-1);
      const team = side[bats];
      const when = side.en ? `${points[a].half === 'top' ? 'Top' : 'Bottom'} ${points[a].n}` : `${points[a].n}局${points[a].half === 'top' ? '上' : '下'}`;
      const hits = scored.filter(k => whoOf(points[k].play));
      const key = [...hits].sort((x, y) => (Number(points[y].play.value) || 0) - (Number(points[x].play.value) || 0) || Math.abs(vals[y] - vals[y - 1]) - Math.abs(vals[x] - vals[x - 1]))[0];
      const named = [];
      const told = key != null ? rallyHits(points, hits, key, runs, side.en, team.name, named) : '';
      // Two (or three) players named: each one's face (the owner, 2026-10-18).
      const faces = [...new Map(named.map(k => points[k].play.pic).filter(Boolean).map(p => [p.id || p.name || p, p])).values()];
      // The inning's runs when the words don't already say them all.
      const total = key != null && hits.length === 1 && (Number(points[key].play.value) || 0) >= runs ? '' : side.en ? ` · ${runs}-run inning` : ` · 這局共 ${runs} 分`;
      const [l0, l1] = [lead(s0), lead(s1)];
      const turned = l0 != null && l1 != null && l1 !== l0 ? (l1 === 0 ? 'tie' : 'lead') : '';
      const said = turned ? (side.en ? (turned === 'tie' ? ' · ties it' : ' · takes the lead') : turned === 'tie' ? ' · 追平' : ' · 超前') : '';
      const delta = vals[b] - vals[a - 1];
      const text = told ? told + total + said : (side.en ? `${team.name} score ${runs} · ${when}` : `${team.name} ${when}攻下 ${runs} 分`) + said;
      out.push({ i: last, from: a, delta, side: delta >= 0 ? 'home' : 'away', icon: ICON.baseball, text, pic: key != null ? points[key].play.pic : null, pics: faces.length > 1 ? faces.slice(0, 2) : null, team: team.id, src: points[key ?? last].play, rally: true, always: true, turned });
    }
    a = i;
  }
  // The pitching: outs (no run on them) that moved it most towards the side in the field.
  const outs = [];
  for (let k = 1; k < points.length; k++) {
    const play = points[k].play;
    if (!play || play.scoring || !play.pitcher?.who) continue;
    const field = points[k].half === 'bottom' ? 'away' : 'home';
    const delta = vals[k] - vals[k - 1];
    if ((field === 'home' ? delta : -delta) < PITCH) continue;
    if (!/strike|struck out|out|double play|ground|fly|flied|pop|line/i.test(`${play.alt} ${play.text} ${play.type}`)) continue;
    const batter = whoOf(play);
    const text = side.en
      ? /strike|struck out/i.test(`${play.alt} ${play.text}`)
        ? `${play.pitcher.who} strikes out ${batter}`.trim()
        : `${play.pitcher.who} retires ${batter} · ${firstOf(MLB_EN, play.alt, play.text) || 'out'}`
      : /strike|struck out/i.test(`${play.alt} ${play.text}`)
        ? `${play.pitcher.who} 三振 ${batter}`.trim()
        : `${play.pitcher.who} 讓 ${batter} ${firstOf(MLB_ZH, play.alt, play.text) || '出局'}`;
    outs.push({ i: k, delta, side: delta >= 0 ? 'home' : 'away', icon: ICON.baseball, text, pic: play.pitcher.pic, team: side[field].id, src: play, pitch: true, always: true });
  }
  const pitches = outs.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)).slice(0, PITCHES);
  return [...out, ...pitches].sort((x, y) => x.i - y.i);
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
  if (sport === 'baseball') return baseballMoments(points, side);
  const found = swingMoments(points, sport, side);
  // The game's end, whole: every play there that moved it, tied it or put a side ahead.
  for (const m of clutchMoments(points, sport, side)) {
    // One play once (ESPN's score and the kickoff after it are the same play): its biggest swing, and whether it tied it or put a side ahead.
    // (A stretch ending on it is not the same: it's told by the points over it, and the play stays its own.)
    const same = found.find(f => !f.periods && (f.i === m.i || f.src === m.src));
    if (!same) found.push(m);
    else if (m.turned && !same.turned) Object.assign(same, { turned: m.turned, text: m.text, delta: Math.abs(m.delta) > Math.abs(same.delta) ? m.delta : same.delta, side: Math.abs(m.delta) > Math.abs(same.delta) ? m.side : same.side });
  }
  return found.sort((x, y) => x.i - y.i);
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
    out.push({ i: g.key, delta, side: delta >= 0 ? 'home' : 'away', icon: ICON[sport] || '•', text, pic: play.pic, team: play.team || sideOf(delta, side).id, clutch: true, src: play, turned: turned ? (tied ? 'tie' : 'lead') : '' });
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
  // A VAR check that ends in a card, a goal or a penalty is that one moment:
  // the result told (紅牌), not the process (VAR 推翻裁判判決), its swing from
  // the check on (Yarmoliuk's red at 45+10' and the VAR before it were two
  // rows, one with no dot of its own). A goal ruled out is its own result.
  const result = v => events.find(o => o !== v && ['red', 'score', 'miss'].includes(o.kind) && o.t >= v.t && o.t - v.t <= 360 && (!v.play.who || !o.play?.who || o.play.who === v.play.who || String(o.play.team) === String(v.play.team)));
  const merged = [];
  const from = new Map();
  for (const ev of events) {
    const r = ev.kind === 'var' && ev.play.kind !== 'deleted-after-review' ? result(ev) : null;
    if (r) from.set(r, Math.min(from.get(r) ?? Infinity, ev.t));
    else merged.push(ev);
  }
  events = merged;
  // A goal's, a card's own swing: from a minute before it to five after, but
  // not into another's (Foden's 1–0 at 19' and Maeda's 1–1 at 21': each took
  // the other's in, Ipswich +1% on both, and neither was dotted). Another
  // just before: from this one's own moment (its prices move a minute or
  // two after); another just after: up to that one's moment.
  const told = o => ['score', 'red', 'miss'].includes(o.kind) || (o.kind === 'var' && o.play.kind === 'deleted-after-review');
  const span = ev => {
    const t0 = Math.min(ev.t, from.get(ev) ?? Infinity);
    const prev = events.filter(o => o !== ev && told(o) && o.t < t0 && t0 - o.t < 300).at(-1);
    const next = events.find(o => o !== ev && told(o) && o.t > ev.t && o.t - ev.t < 300);
    return [at(prev ? t0 : t0 - 60), at(next ? next.t : ev.t + 300)];
  };
  const found = events
    .filter(ev => ev.t >= times[0] && ev.t <= times.at(-1) + 300)
    .map(ev => {
      const [i0, i1] = ev.kind === 'stop' || ev.kind === 'var' ? [at(Math.min(ev.t, from.get(ev) ?? Infinity) - 60), at(ev.t + 300)] : span(ev);
      // Play stopped: what the prices did meanwhile, their furthest from
      // before (a check waved off comes back: a spike, not a step), there.
      // A VAR decision too: the goal's swing, then back when it's ruled out.
      if (ev.kind === 'stop' || ev.kind === 'var') {
        // A stop's own move only: not a goal's, a card's or another
        // decision's next to it (Liverpool's 1–1 at 64' and an injury stop
        // the same minute: the stop took the goal's +27% as its own, +28%).
        // Measured after the swing of any before it, up to any after it.
        // (A VAR check the same: "No Penalty Liverpool" at 41' took
        // Lewis-Potter's goal at 44' as its own, Brentford +16%.)
        let [a, z] = [i0, i1];
        for (const o of events) {
            if (o === ev || o.kind === 'stop' || o.kind === 'var') continue;
            if (o.t <= ev.t && o.t + 300 > ev.t - 60) a = Math.max(a, at(o.t + 300));
            if (o.t > ev.t && o.t - 60 < ev.t + 300) z = Math.min(z, at(o.t - 60));
        }
        if (a >= z) return { i: i0, delta: 0, side: 'home', icon: ev.kind === 'var' ? '📺' : '⏸', text: '', always: false };
        let k = a;
        for (let j = a; j <= z; j++) if (Math.abs(value(points[j]) - value(points[a])) > Math.abs(value(points[k]) - value(points[a]))) k = j;
        const delta = value(points[k]) - value(points[a]);
        const mover = ev.play.team ? (String(ev.play.team) === String(side.home.id) ? 'home' : 'away') : delta >= 0 ? 'home' : 'away';
        // A check: who it helped, by where the prices settled (a penalty
        // taken from Liverpool helps Brentford, whoever ESPN names on it);
        // a goal ruled out, its spike (the goal's swing, then back).
        // A check that undid what the referee gave (a penalty to Liverpool,
        // its spike, then "No Penalty"): the decision's own move, from the
        // spike's top back down (the net was nothing, and the spike went
        // unexplained, the owner 2026-10-18). One that gave: up to the top.
        if (ev.kind === 'var') {
          const ruledOut = ev.play.kind === 'deleted-after-review';
          const [rise, back] = [value(points[k]) - value(points[a]), value(points[z]) - value(points[k])];
          const net = ruledOut ? delta : Math.abs(back) >= Math.abs(rise) / 2 ? back : rise;
          return { i: k, t: ev.t, delta: net, side: net >= 0 ? 'home' : 'away', icon: '📺', text: varText(ev.play, side.en), always: ruledOut, pic: ev.play.pic, team: ev.play.team };
        }
        const text = /injury/i.test(ev.play.text || '') ? (side.en ? 'Play stopped for an injury' : '球員受傷，比賽暫停') : side.en ? 'Play stopped' : '比賽暫停';
        return { i: k, delta, side: mover, icon: '⏸', text, always: false };
      }
      const delta = value(points[i1]) - value(points[i0]);
      // On the line's step: the first point after it with half the swing
      // made (the prices move a minute or two after the goal), so the dot
      // sits where the line jumps, not before it (the owner, 2026-10-16).
      let i = Math.max(i0, Math.min(points.length - 1, at(ev.t) + 1, i1));
      for (let k = i; k <= i1; k++) {
        if (Math.abs(value(points[k]) - value(points[i0])) >= Math.abs(delta) / 2) {
          i = k;
          break;
        }
      }
      const mover = ev.play.team ? (String(ev.play.team) === String(side.home.id) ? 'home' : 'away') : delta >= 0 ? 'home' : 'away';
      const icon = ev.kind === 'red' ? '🟥' : ev.kind === 'miss' ? '❌' : ICON[sport] || '•';
      const text = ev.kind === 'miss' ? (side.en ? `${ev.play.who || ''} misses a penalty`.trim() : `${ev.play.who || ''} 12 碼罰球未進`.trim()) : playText(sport, { ...ev.play, kind: ev.kind }, side.en, teamName(ev.play.team, side));
      return { i, t: ev.t, delta, side: mover, icon, text, always: sport === 'soccer' && ev.kind !== 'miss', pic: ev.play.pic, team: ev.play.team };
    })
    .filter(m => m.always || Math.abs(m.delta) >= 0.08);
  return biggest(found);
}

// A VAR decision in words: a goal ruled out by its scorer; else what was
// decided (ESPN's type: "VAR - Referee decision cancelled", "VAR - Penalty…").
function varText(play, en) {
  const who = play.who || '';
  if (play.kind === 'deleted-after-review') return en ? `${who}'s goal ruled out by VAR`.trim() : `${who} 進球不算（VAR）`.trim();
  if (en) return `VAR: ${String(play.text || play.type || 'check').replace(/^.*VAR Decision:\s*/i, '').replace(/\.$/, '')}`;
  return varDecision(`${play.text || ''} ${play.type || ''}`, '');
}
// What a VAR check decided, said plainly (ESPN files most under "Referee
// decision cancelled"; its words say which: "VAR Decision: No Penalty
// Liverpool", "Penalty Augsburg", "No Goal …", "Goal … (Ante Budimir)",
// "Card upgraded Yehor Yarmoliuk (Brentford)", "Card Changed"). 12 碼罰球 in
// full (12 碼 alone said nothing, the owner 2026-10-18). `long`: 過程's row,
// with the team.
export function varDecision(text, team = '', { long = false } = {}) {
  const d = String(text || '').replace(/^.*VAR Decision:\s*/i, '').trim();
  const side = long && team ? team : '';
  if (/^No Penalty/i.test(d)) return side ? `VAR：取消${side}的 12 碼罰球` : 'VAR：取消 12 碼罰球';
  if (/^Penalty/i.test(d)) return side ? `VAR：改判${side}得到 12 碼罰球` : 'VAR：改判 12 碼罰球';
  if (/^No Goal/i.test(d) || /goal overturned|ruled out|no-goal/i.test(d)) return 'VAR：進球不算';
  if (/^Goal/i.test(d)) {
    const by = /\(([^)]+)\)\s*\.?$/.exec(d)?.[1];
    return `VAR：進球有效${long && by ? `（${shortName(by)}）` : ''}`;
  }
  if (/card upgraded/i.test(d)) {
    const by = /upgraded ([^(]+?)\s*\(/i.exec(d)?.[1];
    return `VAR：${long && by ? `${shortName(by)} ` : ''}改判紅牌`;
  }
  if (/card/i.test(d)) return 'VAR：改判出牌';
  if (/penalty/i.test(d)) return /cancel|no penalty/i.test(d) ? 'VAR：取消 12 碼罰球' : 'VAR：改判 12 碼罰球';
  if (/red/i.test(d)) return 'VAR：改判紅牌';
  return /cancel/i.test(d) ? 'VAR：推翻原判' : 'VAR 檢視';
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
const LAST = { basketball: 4 };
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
  // An own goal is the team's that it counts for (ESPN files it there): its goal, the defender aside (often given to an attacker minutes later).
  [/own-goal/, (w, team) => `${team || w} 進球（${w && w !== team ? `${w} ` : ''}烏龍）`],
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
// A football commentary line (Opta's set phrases, ESPN's 過程) in Chinese,
// its details kept: the foot or the head, where from, how it ended, who set
// it up. -> '' for a line these don't know (the kind's words say it then).
const FOOT = [[/right footed/, '右腳'], [/left footed/, '左腳'], [/header/, '頭球']];
const FROM = [
  [/from very close range/, '近距離'], [/from the six yard box|from the centre of the six yard box/, '小禁區內'], [/from the (left|right) side of the six yard box/, m => `小禁區${m[1] === 'left' ? '左' : '右'}側`],
  [/from the centre of the box/, '禁區中路'], [/from the (left|right) side of the box/, m => `禁區${m[1] === 'left' ? '左' : '右'}側`], [/from outside the box/, '禁區外'],
  [/from more than (\d+) yards/, '遠射'], [/from a difficult angle/, '小角度'], [/from a direct free kick/, '直接自由球'], [/from the penalty spot/, '12 碼']
];
const ENDS = [
  [/hits the (left|right) post/, '中柱'], [/hits the bar/, '中楣'], [/is too high/, '偏高'], [/is high and wide to the (left|right)/, '偏高偏出'], [/misses to the (left|right)/, '偏出'],
  [/is saved in the (?:bottom|top|centre|center)/, '被撲出'], [/is saved/, '被撲出'], [/is blocked/, '被封阻'], [/is close, but misses/, '稍稍偏出']
];
const SET_UP = [[/with a cross/, '傳中'], [/with a through ball/, '直塞'], [/with a headed pass/, '頭球擺渡'], [/following a corner/, '角球'], [/following a set piece situation/, '定位球'], [/following a fast break/, '快速反擊']];
const pick = (list, t) => {
  for (const [re, to] of list) {
    const m = re.exec(t);
    if (m) return typeof to === 'function' ? to(m) : to;
  }
  return '';
};
const shortName = n => {
  const parts = String(n || '').trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : n;
};
// The line is short (who, and what: 射門偏出, 破門, 犯規), its details in
// brackets (playParts puts them on the small line under it: where from,
// which foot, who set it up), so neither runs out of its row.
export function soccerLineZh(play, team = '') {
  const t = String(play.text || '');
  const kind = String(play.kind || '');
  const who = shortName(play.who || '');
  const lower = t.toLowerCase();
  const from = pick(FROM, lower);
  const foot = pick(FOOT, lower);
  const assist = /Assisted by ([^.]+?)(?: with| following|\.|$)/.exec(t)?.[1];
  const setUp = pick(SET_UP, lower);
  const helped = assist ? `${shortName(assist)} 助攻` : setUp ? `${setUp}後` : '';
  const line = (main, details) => {
    const d = details.filter(Boolean);
    return d.length ? `${main}（${d.join(' · ')}）` : main;
  };
  if (/^shot-(off-target|on-target|blocked)$|^shot/.test(kind)) {
    const end = pick(ENDS, lower) || { 'shot-off-target': '偏出', 'shot-on-target': '射正', 'shot-blocked': '被封阻' }[kind] || '';
    const what = { 中柱: '射中門柱', 中楣: '射中橫樑', 被撲出: '射正被撲出', 射正: '射正' }[end] || `${foot === '頭球' ? '頭球' : '射門'}${end}`;
    return line(`${who} ${what}`, [`${from}${foot === '頭球' && what.startsWith('頭球') ? '' : foot}`, helped]);
  }
  if (/^goal/.test(kind)) {
    const spot = /penalty/.test(kind) || /penalty/.test(lower);
    return line(`${who} ${spot ? '12 碼破門' : foot === '頭球' ? '頭球破門' : '破門'}`, [spot ? '' : `${from}${foot === '頭球' ? '' : foot}`, helped]);
  }
  // A foul and the free kick it gave, one line (the commentary's two): who fouled whom.
  if (kind === 'foul' || /wins a free kick/.test(t)) {
    const won = /^(.+?) \([^)]*\) wins a free kick/.exec(t)?.[1] || play.fouled;
    const by = /^Foul by (.+?) \(/.exec(t)?.[1] || play.foulBy;
    const where = /attacking half/.test(t) ? '前場' : /defensive half/.test(t) ? '後場' : /on the (left|right) wing/.test(t) ? '邊路' : '';
    if (by) return line(`${who || shortName(by)} 犯規`, [play.fouled || won ? `${play.fouled || shortName(won)} 被犯` : '']);
    if (won) return line(`${shortName(won)} 製造自由球`, [where]);
    return '';
  }
  if (kind === 'corner-awarded') {
    const by = /Conceded by ([^.]+)\./.exec(t)?.[1];
    return line(`${team ? `${team} ` : ''}角球`, [by ? `${shortName(by)} 送出` : '']);
  }
  if (kind === 'handball') return `${who} 手球`;
  if (kind === 'offside') {
    const caught = /but ([^.]+?) is caught offside/.exec(t)?.[1];
    return `${caught ? shortName(caught) : who} 越位`;
  }
  if (kind === 'start-delay') {
    const hurt = /injury ([^(]+?) \(/.exec(t)?.[1];
    return line('比賽暫停', [hurt ? `${shortName(hurt)} 受傷` : '']);
  }
  if (kind === 'end-delay') return '比賽繼續';
  if (/yellow-card|red-card/.test(kind)) {
    const why = /for a bad foul/.test(t) ? '危險犯規' : /for hand ball/.test(t) ? '手球' : /for dissent/.test(t) ? '抗議判決' : /time wasting/.test(t) ? '拖延時間' : '';
    return line(`${who} ${/second yellow|yellow-red/.test(kind + lower) ? '兩黃變一紅' : /red/.test(kind) ? '紅牌' : '黃牌'}`, [why]);
  }
  if (/VAR Decision/i.test(t)) return varDecision(t, team, { long: true });
  if (kind === 'halftime') return '上半場結束';
  if (/^(end|full)/.test(kind) || /^Match ends/.test(t)) return '全場結束';
  if (/^Second Half begins/.test(t)) return '下半場開始';
  if (/^First Half begins/.test(t)) return '上半場開始';
  return '';
}
// How a goal went in, from its commentary line, short (the owner,
// 2026-10-18: as baseball names each hit): the foot or the head, where from,
// the corner, who set it up. 'L. Messi' left footed, centre of the box,
// assisted: 禁區中路左腳 · 右下角 · L. Suárez 助攻 / left foot, centre of the box
// · bottom right · assist L. Suárez (left foot, centre of the box first in
// English). '' when the line says none of it.
const FOOT_EN = [[/right footed/, 'right foot'], [/left footed/, 'left foot'], [/header/, 'header']];
const FROM_EN = [
  [/from very close range/, 'close range'], [/from the six yard box|from the centre of the six yard box/, 'six-yard box'], [/from the (left|right) side of the six yard box/, m => `six-yard box ${m[1]}`],
  [/from the centre of the box/, 'box centre'], [/from the (left|right) side of the box/, m => `box ${m[1]}`], [/from outside the box/, 'outside the box'],
  [/from more than (\d+) yards/, m => `${m[1]}+ yards`], [/from a difficult angle/, 'tight angle'], [/from a direct free kick/, 'free kick']
];
const CORNER = [[/to the (top|bottom) (left|right) corner/, (m, en) => (en ? `${m[1]} ${m[2]}` : `${m[2] === 'left' ? '左' : '右'}${m[1] === 'top' ? '上' : '下'}角`)], [/to the (?:high )?centre of the goal/, (m, en) => (en ? 'middle' : '球門中路')]];
const SET_UP_EN = [[/with a cross/, 'cross'], [/with a through ball/, 'through ball'], [/with a headed pass/, 'headed pass'], [/following a corner/, 'from a corner'], [/following a set piece situation/, 'set piece'], [/following a fast break/, 'fast break']];
export function goalHowParts(text, kind = '', en = false) {
  const t = String(text || '');
  const lower = t.toLowerCase();
  const spot = /penalty/.test(kind) || /converts the penalty/.test(lower);
  if (/own-goal|own goal/.test(kind + lower)) return { shot: '', help: '' };
  const foot = pick(en ? FOOT_EN : FOOT, lower);
  const from = spot ? '' : pick(en ? FROM_EN : FROM, lower);
  let corner = '';
  for (const [re, to] of CORNER) {
    const m = re.exec(lower);
    if (m) {
      corner = to(m, en);
      break;
    }
  }
  const assist = /Assisted by ([^.]+?)(?: with| following|\.|$)/.exec(t)?.[1];
  const setUp = pick(en ? SET_UP_EN : SET_UP, lower);
  const where = en ? [foot, from].filter(Boolean).join(', ') : `${from}${foot === '頭球' && from ? '頭球' : foot}`;
  const help = assist ? (en ? `assist ${shortName(assist)}` : `${shortName(assist)} 助攻`) : setUp ? (en ? setUp : `${setUp}後`) : '';
  return { shot: [spot ? (en ? `penalty${foot ? `, ${foot}` : ''}` : `12 碼${foot}`) : where, corner].filter(Boolean).join(' · '), help };
}
export function feedText(sport, play, en, team = '') {
  // A league's own words (CPBL's, Chinese already).
  if (play.zh) return play.zh;
  if (en) return play.text || play.type || '';
  const who = play.who || named(play.text) || team;
  if (sport === 'soccer') {
    const kind = String(play.kind || play.type || '').toLowerCase();
    // A commentary line: its own details, where these know them (own goals and substitutions as below).
    if (play.commentary && !/own-goal|substitution/.test(kind)) {
      const said = soccerLineZh(play, team);
      if (said) return said;
    }
    if (/substitution/.test(kind)) return play.who ? (play.other ? `${play.who} 替換 ${play.other}` : `${play.who} 上場`) : `${team} 換人`;
    const hit = SOCCER_KIND.find(([re]) => re.test(kind));
    return hit ? hit[1](who, team).trim() : [team, '比賽事件'].filter(Boolean).join(' ');
  }
  if (sport === 'basketball') return basketballFeed(play, team);
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
