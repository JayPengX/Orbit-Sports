// Where a win probability line's points fall in the game: the period marks
// under the chart (Q1 Q2…, innings, halves; a clock's hours where the game
// has no plays to go by, as CPBL's) and the period a finger on it is at
// (第3節, 5局下, 上半場; never the game clock).
//
// ESPN's line is its plays in order, each point with its play's period
// ({ n, half }): spaced evenly, never by the plays' wall clocks, which ESPN
// sometimes logs late (a first quarter play stamped twenty minutes on).
// Polymarket's is by its prices' times (t, in seconds), read against the
// plays' (parseSummary's timeline: [{ t, n, half, type }]).
//
//   lineXs(points)                           → each point's place across, 0…1
//   periodMarks(timeline, sport, points, en)  → [{ x, label }]
//   pointStamp(timeline, sport, point, en)    → the period the point is in

const REGULAR = { basketball: 4, football: 4, hockey: 3, soccer: 2, baseball: 9 };

const byPlay = points => points.length > 0 && points.every(p => p.n);
const byTime = points => points.length > 1 && points.every((p, i) => Number.isFinite(p.t) && (!i || p.t >= points[i - 1].t)) && points.at(-1).t > points[0].t;

// The game's own time from the clock's: the breaks between periods (half
// time, between quarters) taken out, and nothing after the final whistle
// (a market can take a while to settle), so the halves sit side by side.
const END = new Set(['end-regular-time', 'end-extra-time', 'end-of-game', 'final']);
export function gameTime(timeline = []) {
  const at = starts(timeline);
  const breaks = [];
  for (const [n, s] of at) {
    const before = timeline.filter(e => e.n === n - 1 && e.t <= s).at(-1);
    if (before && s - before.t > 5 * 60) breaks.push([before.t, s]);
  }
  const end = timeline.find(e => END.has(e.type))?.t;
  return t => {
    const c = end != null ? Math.min(t, end + 120) : t;
    return breaks.reduce((x, [a, b]) => x - Math.max(0, Math.min(c, b) - a), c);
  };
}

// A market's line that stopped before the final whistle (no one trades a
// game that's decided: Arsenal 3–0 up, its last price at 49'): its last
// price held to the end, so the chart spans the whole game and the second
// half isn't squeezed into its last few pixels.
export function holdToEnd(points, timeline = []) {
  if (byPlay(points) || !byTime(points)) return points;
  const end = timeline.find(e => END.has(e.type))?.t;
  return end != null && end > points.at(-1).t + 60 ? [...points, { ...points.at(-1), t: end, held: true }] : points;
}

// Each side's colour on the chart, readable on the card it's drawn on
// (`bg`, the card's colour) and told apart from the other side's. Each side
// tries its colours readable as they are (its own, then its second), then
// one made readable: too close to the card (the Padres' brown, the Brewers'
// navy on a dark card), lightened (on a dark card) or darkened (on a light
// one) in its own hue until it stands out. The first pair, in that order, far enough apart wins (two
// yellows aren't; brown and navy, made readable, are). Colours as
// '#rrggbb'; null where a side has none.
const rgb = c => (/^#?[0-9a-f]{6}$/i.test(c || '') ? [0, 2, 4].map(i => parseInt(c.replace('#', '').slice(i, i + 2), 16)) : null);
const hex = c => `#${c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
// WCAG's relative luminance and contrast.
const lin = v => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const apart = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// A line and its shading need 3:1 against the card (WCAG's for graphics).
const READABLE = 3;
// HSL, to lighten or darken a colour and keep its hue (mixing in white greys it).
function toHsl([r, g, b]) {
  [r, g, b] = [r / 255, g / 255, b / 255];
  const [max, min] = [Math.max(r, g, b), Math.min(r, g, b)];
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, l > 0.5 ? d / (2 - max - min) : d / (max + min), l];
}
function fromHsl([h, s, l]) {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = t => ((t = (t + 1) % 1), t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p);
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => v * 255);
}
export function readableOn(c, bg = '#ffffff') {
  const [col, back] = [rgb(c), rgb(bg) || [255, 255, 255]];
  if (!col) return null;
  const [h, sat, l] = toHsl(col);
  const step = lum(back) < 0.18 ? 0.025 : -0.025;
  for (let x = l; x >= 0 && x <= 1; x += step) {
    const c2 = fromHsl([h, sat, x]);
    if (contrast(c2, back) >= READABLE) return hex(c2);
  }
  return null;
}
export function sideColors(home, away, bg = '#ffffff') {
  // A colour readable as it is first (Newcastle's light blue before its black lightened), then made readable.
  const ok = c => rgb(c) && contrast(rgb(c), rgb(bg) || [255, 255, 255]) >= READABLE;
  const tries = s => [...new Set([...[s?.color, s?.alt].filter(ok), ...[s?.color, s?.alt].map(c => readableOn(c, bg))].filter(Boolean).map(c => c.toLowerCase()))];
  const [hs, as] = [tries(home), tries(away)];
  for (const h of hs) for (const a of as) if (apart(rgb(h), rgb(a)) >= 90) return { home: h, away: a };
  return { home: hs[0] || null, away: hs.length ? null : as[0] || null };
}

export function lineXs(points, timeline = []) {
  if (!byPlay(points) && byTime(points)) {
    const g = gameTime(timeline);
    const [g0, g1] = [g(points[0].t), g(points.at(-1).t)];
    if (g1 > g0) return points.map(p => (g(p.t) - g0) / (g1 - g0));
  }
  return points.map((_, i) => i / Math.max(1, points.length - 1));
}

export function periodName(sport, n, en) {
  const reg = REGULAR[sport] || 4;
  if (sport === 'baseball') return en ? `${n}` : `${n}局`;
  if (sport === 'soccer') return en ? ['', '1H', '2H', 'ET', 'ET', 'Pens'][n] || 'ET' : ['', '上半', '下半', '延長', '延長', 'PK'][n] || '延長';
  if (n > reg) return en ? (n - reg > 1 ? `${n - reg}OT` : 'OT') : n - reg > 1 ? `延長${n - reg}` : '延長';
  return en ? `${sport === 'hockey' ? 'P' : 'Q'}${n}` : `第${n}節`;
}

const pad = n => String(n).padStart(2, '0');
const hhmm = t => {
  const d = new Date(t * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Never two marks on top of each other.
function spaced(marks) {
  const kept = [];
  for (const m of marks.filter(m => m.x >= 0 && m.x <= 1)) if (!kept.length || m.x - kept.at(-1).x >= 0.08) kept.push(m);
  return kept;
}

// A period's first moment: its first play once no play is from a later one (one logged late doesn't count).
function starts(timeline) {
  const at = new Map();
  let top = 0;
  for (const e of timeline)
    if (e.n > top) {
      top = e.n;
      at.set(e.n, e.t);
    }
  return at;
}

export function periodMarks(timeline, sport, points, en) {
  const xs = lineXs(points, timeline);
  if (byPlay(points)) {
    const marks = [];
    let top = 0;
    points.forEach((p, i) => {
      if (p.n > top) marks.push({ x: xs[i], label: periodName(sport, (top = p.n), en) });
    });
    return spaced(marks);
  }
  if (!byTime(points)) return [];
  const [t0, t1] = [points[0].t, points.at(-1).t];
  const g = gameTime(timeline);
  const x = t => (g(t) - g(t0)) / (g(t1) - g(t0) || 1);
  if (timeline?.length) return spaced([...starts(timeline)].map(([n, t]) => ({ x: Math.max(0, x(t)), label: periodName(sport, n, en) })));
  // No plays: the clock's hours.
  const marks = [];
  for (let h = Math.ceil(t0 / 3600) * 3600; h <= t1; h += 3600) marks.push({ x: x(h), label: hhmm(h) });
  return spaced(marks);
}

function label(sport, { n, half, type }, en) {
  if (sport === 'soccer') {
    if (type === 'halftime') return en ? 'Half time' : '中場休息';
    if (type === 'end-regular-time' || type === 'end-extra-time') return en ? 'Full time' : '全場結束';
    return en ? ['', '1st half', '2nd half', 'Extra time', 'Extra time', 'Penalties'][n] || 'Extra time' : ['', '上半場', '下半場', '延長賽', '延長賽', 'PK 大戰'][n] || '延長賽';
  }
  if (sport === 'baseball' && half) return en ? `${half === 'top' ? 'Top' : 'Bot'} ${n}` : `${n}局${half === 'top' ? '上' : '下'}`;
  return periodName(sport, n, en);
}

// Where the game had got to at t: the furthest period (half inning) of any play by then.
const rank = e => e.n * 2 + (e.half === 'bottom' ? 1 : 0);
export function stampAt(timeline, sport, t, en) {
  if (!Number.isFinite(t)) return '';
  if (!timeline?.length) return hhmm(t);
  let at = null;
  for (const e of timeline) {
    if (e.t > t) break;
    if (!at || rank(e) >= rank(at)) at = e;
  }
  return at ? label(sport, at, en) : en ? 'Before the start' : '開賽前';
}

export const pointStamp = (timeline, sport, p, en) => (p.n ? label(sport, p, en) : stampAt(timeline, sport, p.t, en));

// A market that stopped trading (a thin one, or Polymarket's own history
// standing still while the game ran on): runs of the same price for half an
// hour or more, by the clock ([[first, last] point index…]). Drawn as a gap,
// never as a game that stood still.
export function quietRuns(points, least = 30 * 60) {
  if (byPlay(points) || !byTime(points)) return [];
  const same = (p, q) => p.home === q.home && p.draw === q.draw;
  const runs = [];
  for (let i = 0, j; i < points.length - 1; i = j) {
    for (j = i + 1; j < points.length && same(points[j], points[i]); j++);
    if (points[j - 1].t - points[i].t >= least) runs.push([i, j - 1]);
  }
  return runs;
}

// The key moment closest to a finger at point j (within `within` of the
// chart's width), never just the first one near it: in a close game's last
// minute the moments sit side by side.
export function nearestMoment(moments, xs, j, within = 0.025) {
  let best = null;
  for (const m of moments) {
    const d = Math.abs(xs[m.i] - xs[j]);
    if (d < within && (!best || d < Math.abs(xs[best.i] - xs[j]))) best = m;
  }
  return best;
}
