// A soccer game's win probability, worked out here from the game itself:
// each side's goals as a Poisson count over the time left, at the rate its
// strength says, from the score as it stands and the men on the pitch.
// Every game on or over gets the line (a market's price on a thin game
// stood still: Lech–Sunderland 1–1 at 85' read Sunderland 77%, a draw 16%;
// the Conference League had no line at all). A late level game is a draw's
// to lose; a goal, a red card and every minute move it. No imports.
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
// imply: the pair whose full-game result matches them best (a coarse look,
// then a fine one around it).
export function strengths(prior) {
  if (!(prior?.home > 0 && prior.home < 1)) return USUAL;
  const draw = prior.draw > 0 && prior.draw < 1 ? prior.draw : null;
  const err = (h, a) => {
    const o = outcome(h, a);
    return (o.home - prior.home) ** 2 + (draw == null ? 0 : (o.draw - draw) ** 2) + (draw == null ? 0.01 * (h + a - 2.6) ** 2 : 0);
  };
  let best = USUAL;
  let least = Infinity;
  const look = (h0, h1, a0, a1, step) => {
    for (let h = h0; h <= h1; h += step)
      for (let a = a0; a <= a1; a += step) {
        const x = err(h, a);
        if (x < least) [least, best] = [x, [h, a]];
      }
  };
  look(0.2, 4.2, 0.2, 4.2, 0.1);
  look(Math.max(0.05, best[0] - 0.1), best[0] + 0.1, Math.max(0.05, best[1] - 0.1), best[1] + 0.1, 0.01);
  return best;
}

// The minutes still to play from a minute (the broadcast's: 90+2 is 92) in
// a period, and how much of a whole game's goals they hold. Each half runs
// a few minutes on (2 and 4 on average), and more goals come in the second
// (55% of them). Extra time: 30 minutes more, played a little slower.
const ADDED = [0, 2, 4, 1, 1];
function share(minute, period) {
  const left = (end, n) => Math.max(0, end - minute) + Math.max(0.5, ADDED[n] - Math.max(0, minute - end));
  if (period >= 5) return 0;
  if (period >= 3) {
    const rate = (0.8 * 30) / 90 / 32;
    return period === 3 ? (left(105, 3) + 16) * rate : left(120, 4) * rate;
  }
  const [first, second] = [0.45 / 47, 0.55 / 49];
  return period === 1 ? left(45, 1) * first + 49 * second : left(90, 2) * second;
}

// A man down: a side scores less and lets in more (per red card more than the other side's).
const SHORT = 0.7;
const LONG = 1.2;

export function chances({ lh, la, home = 0, away = 0, minute = 0, period = 1, reds = [0, 0] }) {
  const f = share(minute, period);
  const down = Math.max(-3, Math.min(3, (reds[0] || 0) - (reds[1] || 0)));
  const [mh, ma] = down > 0 ? [SHORT ** down, LONG ** down] : [LONG ** -down, SHORT ** -down];
  return outcome(lh * f * mh, la * f * ma, home, away);
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
