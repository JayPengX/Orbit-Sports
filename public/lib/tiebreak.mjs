// How each league orders sides level on its table (Jay, 2026-11-01: "make
// sure it knows how same-win teams are decided, not just a random team").
// ESPN's tables come in the league's own order, its tiebreaks applied; this
// says which ones, and, where the deciding number is in the table (goal
// difference, goals, MLS's wins, F1's points), which one settled each pair.
// A step the table doesn't hold (the games between them) said by name.
//
//   TIEBREAKS[league] -> { steps: [step key], zh, en } (the official order, in words)
//   tableKey(league)  -> the numbers a table re-sorts by (title.mjs liveTable): the
//                        steps the table holds, up to the first it doesn't
//   tieNotes(group, league, lang) -> { rule, lines: [text] } | null (no side level with the one above)

const num = v => {
  const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
// The steps a table can show (stat, label): anything else ('h2h', 'div', …) said by name only.
const SHOWN = {
  GD: { zh: '淨勝球', en: 'goal difference', signed: true },
  F: { zh: '進球', en: 'goals scored' },
  W: { zh: '勝場', en: 'wins' }
};
const SOCCER_GD = ['GD', 'F', 'h2h'];
export const TIEBREAKS = {
  epl: { steps: SOCCER_GD, zh: '積分 → 淨勝球 → 進球 → 對戰成績', en: 'points, goal difference, goals scored, head-to-head' },
  bundesliga: { steps: SOCCER_GD, zh: '積分 → 淨勝球 → 進球 → 對戰成績', en: 'points, goal difference, goals scored, head-to-head' },
  scotland: { steps: SOCCER_GD, zh: '積分 → 淨勝球 → 進球 → 對戰成績', en: 'points, goal difference, goals scored, head-to-head' },
  ligue1: { steps: ['GD', 'h2h'], zh: '積分 → 淨勝球 → 對戰積分 → 對戰淨勝球 → 進球', en: 'points, goal difference, head-to-head points, head-to-head goal difference, goals scored' },
  seriea: { steps: ['h2h'], zh: '積分 → 對戰積分 → 對戰淨勝球 → 淨勝球 → 進球', en: 'points, head-to-head points, head-to-head goal difference, goal difference, goals scored' },
  nationsleague: { steps: ['h2h'], zh: '積分 → 對戰積分 → 對戰淨勝球 → 對戰進球 → 淨勝球 → 進球', en: 'points, head-to-head points, goal difference and goals, then overall goal difference, goals' },
  mls: { steps: ['W', 'GD', 'F'], zh: '積分 → 勝場 → 淨勝球 → 進球 → 失球少', en: 'points, wins, goal difference, goals scored, fewest conceded' },
  ucl: { steps: ['GD', 'F', 'away'], zh: '積分 → 淨勝球 → 進球 → 客場進球 → 勝場', en: 'points, goal difference, goals scored, away goals, wins' },
  uel: { steps: ['GD', 'F', 'away'], zh: '積分 → 淨勝球 → 進球 → 客場進球 → 勝場', en: 'points, goal difference, goals scored, away goals, wins' },
  uecl: { steps: ['GD', 'F', 'away'], zh: '積分 → 淨勝球 → 進球 → 客場進球 → 勝場', en: 'points, goal difference, goals scored, away goals, wins' },
  nba: { steps: ['h2h'], zh: '勝率 → 對戰成績 → 分區冠軍 → 同分區戰績 → 同區戰績 → 對季後賽球隊戰績 → 淨勝分', en: 'win %, head-to-head, division leader, division record, conference record, record v playoff teams, point differential' },
  mlb: { steps: ['h2h'], zh: '勝率 → 對戰成績 → 分區內戰績 → 聯盟內戰績 → 下半季聯盟內戰績', en: 'win %, head-to-head, intradivision record, intraleague record, second-half intraleague record' },
  cpbl: { steps: ['h2h'], zh: '勝率 → 對戰成績 → 得失分差', en: 'win %, head-to-head, run differential' },
  f1: { steps: ['wins'], zh: '積分 → 分站冠軍數 → 分站亞軍數 → 依此類推', en: 'points, most wins, then most second places, and so on' }
};
const SAID = {
  // (Not in the table: the step ESPN's order applied first, and the ones after it if they'd met level or not at all.)
  h2h: { zh: '對戰成績等規則', en: 'head-to-head and on' },
  away: { zh: '客場進球', en: 'away goals' },
  wins: { zh: '分站名次', en: 'race finishes' }
};
// The numbers a table re-sorts by after finals it hasn't counted (the
// first measure, then each step it holds up to one it doesn't: past that,
// the order ESPN gave kept).
export function tableKey(league, sport) {
  if (sport !== 'soccer') return r => [num(r.stats.PCT), num(r.stats.W)];
  const steps = TIEBREAKS[league]?.steps || SOCCER_GD;
  const held = [];
  for (const s of steps) {
    if (!SHOWN[s]) break;
    held.push(s);
  }
  return r => [num(r.stats.P), ...held.map(s => num(r.stats[s]))];
}
// The first measure of a table: points (soccer, F1), else the record.
const first = (r, sport) => (sport === 'soccer' || sport === 'racing' ? [num(r.stats.P ?? r.stats.PTS)] : [num(r.stats.W), num(r.stats.L)]);
const playedOf = (r, sport) => (sport === 'soccer' ? num(r.stats.GP) : sport === 'racing' ? 1 : num(r.stats.W) + num(r.stats.L));
export function tieNotes(group, league, lang = 'zh') {
  const rule = TIEBREAKS[league];
  const sport = { f1: 'racing', nba: 'basketball', mlb: 'baseball', cpbl: 'baseball' }[league] || 'soccer';
  const rows = group?.rows || [];
  if (!rule || rows.length < 2) return null;
  const en = lang === 'en';
  const name = r => r.short || r.name;
  const same = (a, b) => first(a, sport).every((v, i) => v === first(b, sport)[i]) && playedOf(a, sport) > 0 && playedOf(b, sport) > 0;
  const lines = [];
  for (let i = 1; i < rows.length; i++) {
    const [a, b] = [rows[i - 1], rows[i]];
    if (!same(a, b)) continue;
    // The first step the table holds that parts them, if it's ahead of any it doesn't.
    let why = null;
    for (const s of rule.steps) {
      const shown = SHOWN[s];
      if (!shown) {
        why = SAID[s] ? (en ? SAID[s].en : SAID[s].zh) : null;
        break;
      }
      const [x, y] = [num(a.stats[s]), num(b.stats[s])];
      if (x === y) continue;
      const v = z => (shown.signed && z > 0 ? `+${z}` : String(z));
      why = en ? `${shown.en} ${v(x)} v ${v(y)}` : `${shown.zh} ${v(x)} 比 ${v(y)}`;
      break;
    }
    const level = sport === 'soccer' || sport === 'racing' ? (en ? `level on ${num(a.stats.P ?? a.stats.PTS)} pts` : `同為 ${num(a.stats.P ?? a.stats.PTS)} 分`) : en ? `both ${a.stats.W}-${a.stats.L}` : `同為 ${a.stats.W}-${a.stats.L}`;
    lines.push(en ? `${name(a)} above ${name(b)} (${level}): ${why || 'league rules'}` : `${name(a)} 排在 ${name(b)} 前（${level}）：${why || '聯盟規則'}`);
  }
  if (!lines.length) return null;
  return { rule: en ? `Level sides: ${rule.en}` : `同分時：${rule.zh}`, lines };
}
