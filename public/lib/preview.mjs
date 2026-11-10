// 賽前看點 (Jay 11-10, the family's AI plan: code, no AI): why a game to
// come matters, in one line over 兩隊比較: two sides close in the same
// table (the top two: 龍頭之爭), how near they are to each other (games or
// points: the table shows each against the leader, never against the other),
// and in football a run of six or more (beyond the last five shown). Nothing notable: no line (never
// filler). `places`: each side's place (sheets.js placeOf), `forms` each
// side's last games ({ result: 'W' | 'L' | 'D' }), `names` their short names.

const behind = (a, b) => {
  const [wa, la, wb, lb] = [a.W, a.L, b.W, b.L].map(Number);
  return [wa, la, wb, lb].every(Number.isFinite) ? Math.abs(wa - wb + (lb - la)) / 2 : null;
};
const pts = s => {
  const n = Number(s?.P ?? s?.PTS);
  return Number.isFinite(n) ? n : null;
};

export function runOf(games) {
  const list = (games || []).map(g => g.result).filter(Boolean);
  const last = list.at(-1);
  if (!last || last === 'D') return null;
  let n = 0;
  for (let i = list.length - 1; i >= 0 && list[i] === last; i--) n++;
  return n >= 3 ? { won: last === 'W', n } : null;
}

export function previewLine({ sport = '', places = [], forms = [], names = [], en = false } = {}) {
  const parts = [];
  const [a, b] = places;
  if (a && b && a.group === b.group && Math.abs(a.pos - b.pos) <= 6 && Math.min(a.pos, b.pos) <= Math.ceil(a.n / 2)) {
    const [hi, lo] = a.pos < b.pos ? [a, b] : [b, a];
    const top = hi.pos === 1 && lo.pos === 2;
    const gap = sport === 'soccer' ? (pts(hi.row.stats) != null && pts(lo.row.stats) != null ? Math.abs(pts(hi.row.stats) - pts(lo.row.stats)) : null) : behind(hi.row.stats, lo.row.stats);
    const unit = sport === 'soccer' ? (en ? 'pt' : '分') : en ? 'game' : '場';
    const gapText = gap == null ? '' : gap === 0 ? (en ? 'level' : sport === 'soccer' ? '同分' : '勝差 0') : en ? `${gap} ${unit}${gap === 1 ? '' : 's'} apart` : `只差 ${gap} ${unit}`;
    const head = top ? (en ? '1st v 2nd' : '第 1 對第 2 的龍頭之爭') : en ? `${hi.pos}${ord(hi.pos)} v ${lo.pos}${ord(lo.pos)} in the table` : `排名第 ${hi.pos} 對第 ${lo.pos}`;
    // (Neighbours far apart in wins or points are no race: said only when close, or the top two.)
    const near = gap != null && (sport === 'soccer' ? gap <= 3 : gap <= 2);
    if (near) parts.push(`${head}${en ? ', ' : '，'}${gapText}`);
    else if (top) parts.push(head);
  }
  // (A run: baseball's and basketball's 連勝敗 row and the last five already say up to five; only a longer one in football, where neither does.)
  forms.forEach((f, i) => {
    const r = sport === 'soccer' ? runOf(f) : null;
    if (r && r.n < 6) return;
    if (r && names[i]) parts.push(en ? `${names[i]} ${r.won ? 'won' : 'lost'} ${r.n} straight` : `${names[i]} ${r.n} 連${r.won ? '勝' : '敗'}`);
  });
  return parts.length ? parts.slice(0, 3).join(' · ') : '';
}
const ord = n => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
