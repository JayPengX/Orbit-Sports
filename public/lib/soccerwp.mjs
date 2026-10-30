// A soccer game's win probability, worked out here from the game itself:
// each side's goals as a Poisson count over the time left, at the rate its
// strength says, from the score as it stands and the men on the pitch.
// Every game on or over gets the line (a market's price on a thin game
// stood still: Lech–Sunderland 1–1 at 85' read Sunderland 77%, a draw 16%;
// the Conference League had no line at all). A late level game is a draw's
// to lose; a goal, a red card and every minute move it. A side behind
// pushes and scores more, one ahead sits deeper and lets in a little more,
// so the line is walked minute by minute on the goal difference. Tuned on
// 2,473 finished league and European games of 2025–26 with their closing
// odds (scripts/backtest-soccerwp.mjs): a side given 75% won 76% of the
// time (67% before), at 89' the line's error a seventh smaller. No imports.
//
//   strengths(prior)  → [home goals, away goals] per game a prior's chances
//                       ({ home, draw }) point to; none: a home side's usual edge
//   chances(state)    → { home, draw } from { lh, la, home, away, minute, reds }
//   soccerLine({ prior, timeline, events, status, homeId, start, now })
//                     → { source: 'model', points: [{ t, home, draw }] } | null

// The usual game: 2.6 goals, the home side a little more of them.
const USUAL = [1.45, 1.15];
const MAX_GOALS = 12;

function poisson(l) {
  const p = [Math.exp(-l)];
  for (let k = 1; k <= MAX_GOALS; k++) p.push((p[k - 1] * l) / k);
  return p;
}

// From each side's goals still to come (means lh, la) and the goals so far:
// the chance the home side ends ahead, and of a draw.
export function outcome(lh, la, home = 0, away = 0) {
  const [ph, pa] = [poisson(Math.max(0, lh)), poisson(Math.max(0, la))];
  let [win, draw] = [0, 0];
  for (let i = 0; i <= MAX_GOALS; i++)
    for (let j = 0; j <= MAX_GOALS; j++) {
      const d = home + i - (away + j);
      if (d > 0) win += ph[i] * pa[j];
      else if (d === 0) draw += ph[i] * pa[j];
    }
  const sum = win + draw + Math.max(0, 1 - win - draw);
  return { home: win / sum, draw: draw / sum };
}

// Each side's goals in a whole game that its chances before the start
// imply: the pair whose full-game result matches them best (a coarse look
// with plain goal counts, then a fine one with the model itself).
export function strengths(prior) {
  if (!(prior?.home > 0 && prior.home < 1)) return USUAL;
  const draw = prior.draw > 0 && prior.draw < 1 ? prior.draw : null;
  const errOf = f => (h, a) => {
    const o = f(h, a);
    return (o.home - prior.home) ** 2 + (draw == null ? 0 : (o.draw - draw) ** 2) + (draw == null ? 0.01 * (h + a - 2.6) ** 2 : 0);
  };
  let best = USUAL;
  let least = Infinity;
  const look = (err, h0, h1, a0, a1, step) => {
    for (let h = h0; h <= h1 + 1e-9; h += step)
      for (let a = a0; a <= a1 + 1e-9; a += step) {
        const x = err(h, a);
        if (x < least) [least, best] = [x, [h, a]];
      }
  };
  look(errOf(outcome), 0.2, 4.2, 0.2, 4.2, 0.1);
  const model = errOf((h, a) => walk(h, a, 0, 0, 0, 1));
  least = model(...best);
  for (const [step, w] of [[0.1, 4], [0.04, 2], [0.01, 2]]) look(model, Math.max(0.05, best[0] - w * step), best[0] + w * step, Math.max(0.05, best[1] - w * step), best[1] + w * step, step);
  return best;
}

// Each period's length and the minutes usually played on after it (3 and
// 7 in 2025–26's games), and its share of a whole game's goals: 45% in the
// first half, 55% in the second; extra time 80% of a half hour's.
const LEN = [0, 45, 45, 15, 15];
const ADDED = [0, 3, 7, 1, 2];
const FROM = [0, 0, 45, 90, 105];
const rateIn = n => (n === 1 ? 0.45 : n === 2 ? 0.55 : 0.4) / (LEN[n] + ADDED[n]);
// The minutes left in period n from a minute (the broadcast's: 90+2 is 92).
const leftIn = (minute, n) => Math.max(0, FROM[n] + LEN[n] - minute) + Math.max(0.5, ADDED[n] - Math.max(0, minute - FROM[n] - LEN[n]));
// A side behind scores more, one ahead lets in a little more (fitted).
const BEHIND = 1.2;
const AHEAD = 1.05;
// A man down: a side scores less and lets in more (per red card more than the other side's).
const SHORT = 0.6;
const LONG = 1.3;
const SPAN = 8;

// From each side's goals in a whole game (lh, la) and the game as it stands:
// the rest walked a minute at a time on the goal difference, each side's
// chance to score that minute by its rate, the score and the men on the
// pitch. → the chance the home side ends ahead, and of a draw.
function walk(lh, la, home, away, minute, period, reds = [0, 0], last = 2) {
  let pr = new Float64Array(2 * SPAN + 1);
  pr[Math.max(-SPAN, Math.min(SPAN, home - away)) + SPAN] = 1;
  const down = Math.max(-3, Math.min(3, (reds[0] || 0) - (reds[1] || 0)));
  const [mh, ma] = down > 0 ? [SHORT ** down, LONG ** down] : [LONG ** -down, SHORT ** -down];
  for (let n = period; n <= last; n++) {
    const left = n === period ? leftIn(minute, n) : LEN[n] + ADDED[n];
    const r = rateIn(n);
    for (let s = 0; s < left; s++) {
      const dt = Math.min(1, left - s);
      const nx = new Float64Array(2 * SPAN + 1);
      for (let i = 0; i <= 2 * SPAN; i++) {
        const q = pr[i];
        if (!q) continue;
        const d = i - SPAN;
        const gh = 1 - Math.exp(-lh * mh * r * dt * (d < 0 ? BEHIND : d > 0 ? AHEAD : 1));
        const ga = 1 - Math.exp(-la * ma * r * dt * (d > 0 ? BEHIND : d < 0 ? AHEAD : 1));
        const up = gh * (1 - ga);
        const dn = ga * (1 - gh);
        nx[i] += q * (1 - up - dn);
        nx[Math.min(2 * SPAN, i + 1)] += q * up;
        nx[Math.max(0, i - 1)] += q * dn;
      }
      pr = nx;
    }
  }
  let win = 0;
  for (let i = SPAN + 1; i <= 2 * SPAN; i++) win += pr[i];
  return { home: win, draw: pr[SPAN] };
}

export function chances({ lh, la, home = 0, away = 0, minute = 0, period = 1, reds = [0, 0] }) {
  if (period >= 5) return outcome(0, 0, home, away);
  return walk(lh, la, home, away, minute, period, reds, period >= 3 ? 4 : 2);
}

// The broadcast's minute ("67'", "90'+3'") as a number.
export function minuteOf(clock) {
  const m = /^(\d+)'?(?:\s*\+\s*(\d+))?/.exec(String(clock || '').trim());
  return m ? Number(m[1]) + Number(m[2] || 0) : NaN;
}

// Each half's start, its first moment (a play from a later one never comes before it).
function halfStarts(timeline) {
  const at = new Map();
  let top = 0;
  for (const x of timeline)
    if (x.n > top && x.n <= 4) {
      top = x.n;
      at.set(x.n, x.t);
    }
  return at;
}
const HALF_FROM = [0, 0, 45, 90, 105];
const HALF_TO = [0, 45, 90, 105, 120];
const END = new Set(['end-regular-time', 'end-extra-time', 'end-of-game', 'final']);

// The line, a point a minute through each half played (half time left
// out), from the timeline's moments (parseSummary's: [{ t, n, type }]) and
// its goals and red cards (events: [{ t, kind, play: { team, home, away } }]).
// A game on runs to now, at the minute and score its status says. A game
// with no moments by the clock: from its kickoff, the halves as they're
// usually played (a quarter of an hour between them).
export function soccerLine({ prior, timeline = [], events = [], status, homeId, start, score, now = Date.now() / 1000 }) {
  const [lh, la] = strengths(prior);
  const state = status?.state;
  if (state !== 'in' && state !== 'post') return null;
  const period = Math.min(status.period || 1, 5);
  const clockMin = minuteOf(status.clock || status.short);
  let starts = halfStarts(timeline);
  if (!starts.size) {
    const k = Date.parse(start) / 1000;
    if (!Number.isFinite(k)) return null;
    starts = new Map([[1, k], [2, k + 62 * 60]].filter(([n]) => n <= Math.max(1, Math.min(period, 2))));
  }
  const over = timeline.find(x => END.has(x.type))?.t;
  const goals = events.filter(x => x.kind === 'score').sort((a, b) => a.t - b.t);
  const reds = events.filter(x => x.kind === 'red');
  const isHome = x => String(x.play?.team) === String(homeId);
  const scoreBy = t => {
    const by = goals.filter(x => x.t <= t);
    const told = [...by].reverse().find(x => Number.isFinite(Number(x.play?.home)) && Number.isFinite(Number(x.play?.away)) && x.play.home !== null && x.play.away !== null);
    if (told) return [Number(told.play.home), Number(told.play.away)];
    const h = by.filter(isHome).length;
    return [h, by.length - h];
  };
  const redsBy = t => {
    const by = reds.filter(x => x.t <= t);
    const h = by.filter(isHome).length;
    return [h, by.length - h];
  };
  const point = (t, minute, n, [home, away], r) => ({ t, ...round(chances({ lh, la, home, away, minute, period: n, reds: r })) });
  const halves = [...starts.keys()].sort((a, b) => a - b);
  const points = [];
  halves.forEach((n, k) => {
    const s = starts.get(n);
    const next = starts.get(halves[k + 1]);
    // Where the half ended: the last moment in it, its end once a later one has begun; the one on now, now.
    const last = next != null ? Math.max(s, ...timeline.filter(x => x.n === n && x.t < next).map(x => x.t)) : state === 'post' ? (over ?? Math.max(s, ...timeline.map(x => x.t))) : now;
    const to = Math.min(last, s + (HALF_TO[n] - HALF_FROM[n] + 20) * 60);
    for (let t = s; t <= to; t += 60) points.push(point(t, HALF_FROM[n] + (t - s) / 60, n, scoreBy(t), redsBy(t)));
    if (points.at(-1)?.t < to) points.push(point(to, HALF_FROM[n] + (to - s) / 60, n, scoreBy(to), redsBy(to)));
  });
  if (!points.length) return null;
  // On now: the latest point at the status's own minute and score (the moments can trail them).
  if (state === 'in' && period <= 4) {
    const t = points.at(-1).t;
    const minute = Number.isFinite(clockMin) ? clockMin : HALF_FROM[period] + (t - (starts.get(period) ?? t)) / 60;
    const sc = scoreOf(score) || scoreBy(t);
    points[points.length - 1] = point(t, minute, period, sc, redsBy(t));
  }
  // Over: the result at the end.
  if (state === 'post') {
    const t = points.at(-1).t;
    const sc = scoreOf(score) || scoreBy(t);
    points[points.length - 1] = { t, home: sc[0] > sc[1] ? 1 : 0, draw: sc[0] === sc[1] ? 1 : 0 };
  }
  return points.length > 3 ? { source: 'model', points } : null;
}

// The status's score, [home, away], or null where it says none.
const scoreOf = s => (s && s.home !== '' && s.away !== '' && s.home != null && s.away != null && Number.isFinite(Number(s.home)) && Number.isFinite(Number(s.away)) ? [Number(s.home), Number(s.away)] : null);
const round = p => ({ home: Math.round(p.home * 1000) / 1000, draw: Math.round(p.draw * 1000) / 1000 });
