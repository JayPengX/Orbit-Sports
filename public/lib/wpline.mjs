// Where a win probability line's points fall in the game: the period marks
// under the chart (Q1 Q2…, innings, halves; a clock's hours where the game
// has no plays to go by, as CPBL's) and the period a finger on it is at
// (第3節, 5局下, 上半場; never the game clock), from the plays' wall clocks
// (parseSummary's timeline: [{ t, n, half, type }], t in seconds).
//
//   lineXs(points)                           → each point's place across, 0…1
//   periodMarks(timeline, sport, points, en)  → [{ x, label }]
//   stampAt(timeline, sport, t, en)           → what the game was at then

const REGULAR = { basketball: 4, football: 4, hockey: 3, soccer: 2, baseball: 9 };

// By time where every point has one (a stretch with no plays, as a break, takes its time), else evenly.
export function lineXs(points) {
  const t0 = points[0]?.t;
  const span = points.at(-1)?.t - t0;
  if (points.every(p => Number.isFinite(p.t)) && span > 0) return points.map(p => (p.t - t0) / span);
  return points.map((_, i) => i / Math.max(1, points.length - 1));
}

export function periodName(sport, n, en) {
  const reg = REGULAR[sport] || 4;
  if (sport === 'baseball') return en ? `${n}` : `${n}局`;
  if (sport === 'soccer') return en ? ['', '1H', '2H', 'ET', 'ET', 'Pens'][n] || 'ET' : ['', '上半', '下半', '延長', '延長', 'PK'][n] || '延長';
  if (n > reg) return en ? (n - reg > 1 ? `${n - reg}OT` : 'OT') : n - reg > 1 ? `延長${n - reg}` : '延長';
  return en ? `${sport === 'hockey' ? 'P' : 'Q'}${n}` : `第${n}節`;
}

// Each period's first moment.
function starts(timeline) {
  const at = new Map();
  for (const e of timeline) if (!at.has(e.n)) at.set(e.n, e.t);
  return at;
}

const pad = n => String(n).padStart(2, '0');
const hhmm = t => {
  const d = new Date(t * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function periodMarks(timeline, sport, points, en) {
  if (!points.every(p => Number.isFinite(p.t))) return [];
  const [t0, t1] = [points[0].t, points.at(-1).t];
  if (!(t1 > t0)) return [];
  const x = t => (t - t0) / (t1 - t0);
  let marks;
  if (timeline?.length)
    marks = [...starts(timeline)].map(([n, t]) => ({
      x: Math.max(0, x(t)),
      label: periodName(sport, n, en)
    }));
  else {
    // No plays: the clock's hours.
    marks = [];
    for (let h = Math.ceil(t0 / 3600) * 3600; h <= t1; h += 3600) marks.push({ x: x(h), label: hhmm(h) });
  }
  // Inside the line, never two on top of each other.
  const kept = [];
  for (const m of marks.filter(m => m.x <= 1)) if (!kept.length || m.x - kept.at(-1).x >= 0.08) kept.push(m);
  return kept;
}

export function stampAt(timeline, sport, t, en) {
  if (!Number.isFinite(t)) return '';
  if (!timeline?.length) return hhmm(t);
  let i = -1;
  while (i + 1 < timeline.length && timeline[i + 1].t <= t) i++;
  if (i < 0) return en ? 'Before the start' : '開賽前';
  const e = timeline[i];
  if (sport === 'soccer') {
    if (e.type === 'halftime') return en ? 'Half time' : '中場休息';
    if (e.type === 'end-regular-time' || e.type === 'end-extra-time') return en ? 'Full time' : '全場結束';
    return en ? ['', '1st half', '2nd half', 'Extra time', 'Extra time', 'Penalties'][e.n] || 'Extra time' : ['', '上半場', '下半場', '延長賽', '延長賽', 'PK 大戰'][e.n] || '延長賽';
  }
  if (sport === 'baseball') {
    if (!e.half) return periodName(sport, e.n, en);
    const top = e.half === 'top';
    return en ? `${top ? 'Top' : 'Bot'} ${e.n}` : `${e.n}局${top ? '上' : '下'}`;
  }
  return periodName(sport, e.n, en);
}
