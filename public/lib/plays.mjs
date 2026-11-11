// Basketball's play-by-play as a person reads it, not as ESPN logs it. ESPN
// writes every free throw, the foul that gave them, the dead-ball team
// rebound between them and each substitution on its own row, so a close
// game's last 30 seconds ran to forty rows of fouls and free throws (Jay
// 2026-11-09). Within one stoppage (the same period and clock):
//   - a free-throw trip is one row, its result said once (兩罰一中), the
//     foul that sent the shooter there said under it;
//   - an and-one is its basket's row (上籃，加罰命中);
//   - each side's substitutions are one row (換人 with who came on).
// A folded play keeps every id it stands for (`ids`: the chart's key moments
// are marked by play id) and the score after its last part.

const FT = /free throw[^0-9]*?(\d) of (\d)/i;
const SUB = /enters the game|substitution/i;
const MADE = /\bmakes\b|\bmade\b/i;
export const ftOf = p => {
  const m = FT.exec(String(p?.text || ''));
  return m ? { k: Number(m[1]), of: Number(m[2]), tech: /technical/i.test(String(p.text || '')) } : null;
};
export const isSub = p => SUB.test(`${p?.type || ''} ${p?.text || ''}`);
const madeFt = p => Boolean(p.scoring) || MADE.test(String(p.text || ''));
const who = p => String(p?.pic?.id || p?.who || '') || String(p?.text || '').split(/ (?:makes|misses) /)[0];
const isFoul = p => /foul/i.test(`${p?.type || ''} ${p?.text || ''}`) && !/offensive|charge|turnover/i.test(`${p?.type || ''} ${p?.text || ''}`) && !ftOf(p);
const isTeamRebound = p => /rebound/i.test(`${p?.type || ''} ${p?.text || ''}`) && /team rebound/i.test(String(p?.text || ''));
const isShot = p => p.scoring && !ftOf(p);
const foulKind = p => (/flagrant/i.test(`${p.type} ${p.text}`) ? 'flagrant' : /technical/i.test(`${p.type} ${p.text}`) ? 'technical' : 'foul');

// The feed folded (a new list; the plays themselves untouched).
export function foldPlays(feed) {
  const out = [];
  for (let i = 0; i < (feed || []).length; ) {
    let j = i + 1;
    const p = feed[i];
    if (p.clock) while (j < feed.length && feed[j].clock === p.clock && feed[j].periodNum === p.periodNum) j++;
    out.push(...foldStop(feed.slice(i, j)));
    i = j;
  }
  return out;
}

function foldStop(block) {
  if (block.length < 2) return block;
  const gone = new Set();
  const put = new Map();
  // Free-throw trips: one shooter's 1 of n, 2 of n… in this stoppage.
  block.forEach((p, i) => {
    const f = ftOf(p);
    if (!f || gone.has(i) || put.has(i)) return;
    const trip = [i];
    let k = f.k;
    for (let n = i + 1; n < block.length && k < f.of; n++) {
      const g = ftOf(block[n]);
      if (g && g.of === f.of && g.k === k + 1 && g.tech === f.tech && who(block[n]) === who(p)) trip.push(n), (k = g.k);
    }
    const shots = trip.map(n => block[n]);
    const last = shots.at(-1);
    // (A dead ball's team rebound between two of them: the shooter's own side, nothing to read.)
    for (let n = trip[0] + 1; n < trip.at(-1); n++) if (isTeamRebound(block[n])) gone.add(n);
    // The foul that sent them there: the nearest before, by the other side.
    let fi = -1;
    for (let n = trip[0] - 1; n >= 0; n--) {
      const q = block[n];
      if (gone.has(n) || !isFoul(q) || (q.team && p.team && q.team === p.team)) continue;
      if (f.tech !== /technical/i.test(`${q.type} ${q.text}`)) continue;
      fi = n;
      break;
    }
    const foul = fi >= 0 ? block[fi] : null;
    const made = shots.filter(madeFt).length;
    const ft = { made, tries: shots.length, of: f.of, ...(f.tech ? { tech: true } : {}) };
    const fouled = foul ? { foul: { who: foul.who || '', kind: foulKind(foul), team: foul.team || '', ...(foul.pic ? { pic: foul.pic } : {}) } } : {};
    // An and-one: the basket just before it by the same player, on its row.
    const shot = f.of === 1 && !f.tech ? block.findLastIndex((q, n) => n < trip[0] && !gone.has(n) && !put.has(n) && isShot(q) && who(q) === who(p)) : -1;
    if (shot >= 0) {
      const basket = block[shot];
      gone.add(shot);
      if (fi >= 0) gone.add(fi);
      trip.forEach(n => gone.add(n));
      put.set(trip.at(-1), { ...basket, ids: [basket.id, foul?.id, ...shots.map(q => q.id)].filter(Boolean), andOne: { made: made > 0 }, ...fouled, home: last.home, away: last.away, value: (Number(basket.value) || 0) + made, scoring: true });
      return;
    }
    // (A lone free throw with no foul to say: as ESPN has it.)
    if (shots.length < 2 && !foul) return;
    if (fi >= 0) gone.add(fi);
    trip.forEach(n => gone.add(n));
    put.set(trip.at(-1), { ...last, ids: [foul?.id, ...shots.map(q => q.id)].filter(Boolean), ft, ...fouled, scoring: made > 0, value: made });
  });
  // The stoppage's changes, both sides': one row, where the first was.
  const subs = block.map((p, i) => i).filter(i => !gone.has(i) && isSub(block[i]));
  if (subs.length > 1) {
    const ps = subs.map(n => block[n]);
    subs.forEach(n => gone.add(n));
    const one = ps.every(q => q.team === ps[0].team);
    put.set(subs[0], { ...ps[0], team: one ? ps[0].team : '', pic: null, who: '', other: '', ids: ps.map(q => q.id), subs: ps.map(q => ({ who: q.who || '', out: q.other || '', team: q.team || '', ...(q.pic ? { pic: q.pic } : {}) })) });
  }
  // A coach's challenge is charged a timeout: ESPN logs the timeout too, said once.
  block.forEach((p, i) => {
    if (gone.has(i) || !/challenge/i.test(`${p.type} ${p.text}`)) return;
    const t = block.findIndex((q, n) => !gone.has(n) && n !== i && /timeout/i.test(`${q.type} ${q.text}`) && !/challenge/i.test(`${q.type} ${q.text}`) && q.team === p.team);
    if (t >= 0) gone.add(t);
  });
  // The fourth's end and the game's: the game's.
  if (block.some(p => /end (of )?game/i.test(`${p.type} ${p.text}`))) block.forEach((p, i) => /end (of )?(period|the \d)/i.test(`${p.type} ${p.text}`) && !/game/i.test(`${p.type} ${p.text}`) && gone.add(i));
  return block.flatMap((p, i) => (put.has(i) ? [put.get(i)] : gone.has(i) ? [] : [p]));
}

const NUM = ['零', '一', '兩', '三'];
const FOUL_ZH = { foul: '犯規', flagrant: '惡意犯規', technical: '技術犯規' };
const FOUL_EN = { foul: 'foul', flagrant: 'flagrant foul', technical: 'technical' };
// A trip's result: 兩罰全中, 三罰兩中, 罰球命中 (one of one); a trip still
// going, where it is (第一罰命中).
export function tripZh({ made, tries, of, tech }) {
  const pre = tech ? '技術' : '';
  if (tries < of) return `${NUM[of] || of}罰 已${NUM[tries] || tries}罰${made === tries ? (tries === 1 ? '命中' : '全中') : made === 0 ? '不中' : `${NUM[made] || made}中`}`;
  if (of === 1) return `${pre}罰球${made ? '命中' : '不中'}`;
  return `${pre}${NUM[of] || of}罰${made === of ? '全中' : made === 0 ? '不中' : `${NUM[made] || made}中`}`;
}
export function tripEn({ made, tries, of, tech }) {
  const pre = tech ? 'technical ' : '';
  if (of === 1) return `${pre}free throw ${made ? 'good' : 'missed'}`;
  return `${pre}free throws ${made}/${tries}${tries < of ? ` of ${of}` : ''}`;
}
// The foul under a trip or an and-one: "R. Jenkins 犯規" / "Jenkins foul".
export const foulZh = f => (f ? [f.who, FOUL_ZH[f.kind] || '犯規'].filter(Boolean).join(' ') : '');
export const foulEn = f => (f ? [f.who, FOUL_EN[f.kind] || 'foul'].filter(Boolean).join(' ') : '');
// A stoppage's changes: who came on (three named, then how many more).
const names = (subs, sep, more) => {
  const all = subs.map(s => s.who).filter(Boolean);
  return all.length > 3 ? `${all.slice(0, 3).join(sep)}${more(all.length)}` : all.join(sep);
};
export const subsZh = subs => `${new Set(subs.map(s => s.team)).size > 1 ? '雙方' : ''}換人（${names(subs, '、', n => ` 等 ${n} 人`)} 上場）`;
export const subsEn = subs => `Substitutions (${names(subs, ', ', n => ` +${n - 3}`)} in)`;

// ---- A basketball game on now, at a glance ----
// Jay 2026-11-09: "Show meaningful real-time game states, such as NBA scoring
// runs, momentum shifts, and key developments". From the feed alone:
//   - the run on now: one side's points against few by the other since a
//     point, ending at the latest score (7-0 is three scores in a row; a
//     "double-digit run" is NBA.com's 10-0; broadcasts say 12-2 too): shown
//     from 7 points and 6 clear, the other side at most 4 and a third of it;
//   - a side without a field goal for three minutes of play and more;
//   - how often the lead changed hands.
// The NBA's periods: 12 minutes, an overtime 5.
const PERIOD_SECS = n => (n <= 4 ? 720 : 300);
export const clockSecs = c => {
  const [m, x] = String(c || '').split(':');
  return x == null ? Number(m) || 0 : Number(m) * 60 + (Number(x) || 0);
};
// Seconds of play from the tip to a play.
export const playedAt = p => {
  let s = 0;
  for (let n = 1; n < (p.periodNum || 1); n++) s += PERIOD_SECS(n);
  return s + PERIOD_SECS(p.periodNum || 1) - clockSecs(p.clock);
};
export const RUN_MIN = 7;
export const DROUGHT_SECS = 180;
export function liveState(feed, homeId, awayId) {
  const plays = (feed || []).filter(p => p.home != null && p.away != null && p.home !== '' && p.away !== '');
  // Each score: who, how many (by the score's move, so a trip's two free throws are each theirs).
  const scores = [];
  let [h, a] = [0, 0];
  for (const p of plays) {
    const [nh, na] = [Number(p.home) || 0, Number(p.away) || 0];
    if (nh > h) scores.push({ team: String(homeId), pts: nh - h, p });
    if (na > a) scores.push({ team: String(awayId), pts: na - a, p });
    [h, a] = [Math.max(h, nh), Math.max(a, na)];
  }
  // (The side that scored last: a run the other side just answered is over.)
  const runOf = team => {
    let [mine, theirs, best] = [0, 0, null];
    for (let k = scores.length - 1; k >= 0; k--) {
      if (scores[k].team === team) mine += scores[k].pts;
      else if ((theirs += scores[k].pts) > 4) break;
      if (mine >= RUN_MIN && mine - theirs >= 6 && theirs * 3 <= mine) best = { team, mine, theirs, from: scores[k].p };
    }
    return best;
  };
  const run = scores.length ? runOf(scores.at(-1).team) : null;
  // Field goals: a score that isn't a free throw.
  const last = plays.at(-1) || (feed || []).at(-1);
  const now = last ? playedAt(last) : 0;
  const drought = [String(homeId), String(awayId)]
    .map(team => {
      const fg = [...plays].reverse().find(p => p.scoring && String(p.team) === team && !/free throw/i.test(`${p.type} ${p.text}`));
      return { team, secs: now - (fg ? playedAt(fg) : 0) };
    })
    .filter(d => d.secs >= DROUGHT_SECS)
    .sort((x, y) => y.secs - x.secs)[0] || null;
  // The lead from one side to the other (a tie between them counts it once).
  let [changes, was] = [0, 0];
  for (const p of plays) {
    const sign = Math.sign(Number(p.home) - Number(p.away));
    if (sign && was && sign !== was) changes++;
    if (sign) was = sign;
  }
  return { run, drought, changes };
}

// An NBA side's timeouts left, counted from the game's own plays where ESPN's
// header says none (Celtics–76ers 2026-11-11: 0 left and 0 used for both at
// halftime, two each taken in the plays; the header's line held no bars, Jay).
// The NBA's rule: seven a game, at most four in the 4th and two after its
// 3:00 mark; each overtime two of its own. `feed`: the summary's plays
// ({ type, text, team, periodNum, clock }); `period`, `clock`: the game's now.
// { left, used } with used + left the slots the line draws (7, an overtime 2).
const TIMEOUT = /timeout/i;
const NOT_THEIRS = /official|end of|tv timeout/i;
export function nbaTimeouts(feed, teamId, { period = 0, clock = '' } = {}) {
  const id = String(teamId ?? '');
  const taken = (feed || []).filter(p => String(p.team ?? '') === id && TIMEOUT.test(p.type || '') && !NOT_THEIRS.test(`${p.type || ''} ${p.text || ''}`));
  const now = Math.max(1, Number(period) || 0, ...taken.map(p => p.periodNum || 0));
  if (now > 4) {
    const left = Math.max(0, 2 - taken.filter(p => p.periodNum === now).length);
    return { left, used: 2 - left };
  }
  const inFourth = taken.filter(p => p.periodNum === 4);
  let left = 7 - taken.filter(p => (p.periodNum || 0) <= 4).length;
  if (now === 4) {
    left = Math.min(left, 4 - inFourth.length);
    if (clock !== '' && clockSecs(clock) <= 180) left = Math.min(left, 2 - inFourth.filter(p => clockSecs(p.clock) <= 180).length);
  }
  left = Math.max(0, left);
  return { left, used: 7 - left };
}
