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
//   tieNotes(group, league, lang) -> { rule, lines: [{ a, b, why }] } | null: only pairs level across a zone's edge

const num = v => {
  const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
// The steps a table can show (stat, label): anything else ('h2h', 'div', …) said by name only.
const SHOWN = {
  GD: { zh: '淨勝球', en: 'GD', signed: true },
  F: { zh: '進球', en: 'Goals' },
  W: { zh: '勝場', en: 'Wins' }
};
const SOCCER_GD = ['GD', 'F', 'h2h'];
// (Short chains: one line at 320. The full order is the league's; a step past the fourth rarely decides.)
const SOCCER = { zh: '積分 › 淨勝球 › 進球 › 對戰', en: 'Pts › GD › Goals › H2H' };
const UEFA = { zh: '積分 › 淨勝球 › 進球 › 客場進球', en: 'Pts › GD › Goals › Away goals' };
export const TIEBREAKS = {
  epl: { steps: SOCCER_GD, ...SOCCER },
  bundesliga: { steps: SOCCER_GD, ...SOCCER },
  scotland: { steps: SOCCER_GD, ...SOCCER },
  ligue1: { steps: ['GD', 'h2h'], zh: '積分 › 淨勝球 › 對戰 › 進球', en: 'Pts › GD › H2H › Goals' },
  seriea: { steps: ['h2h'], zh: '積分 › 對戰 › 淨勝球 › 進球', en: 'Pts › H2H › GD › Goals' },
  nationsleague: { steps: ['h2h'], zh: '積分 › 對戰 › 淨勝球 › 進球', en: 'Pts › H2H › GD › Goals' },
  mls: { steps: ['W', 'GD', 'F'], zh: '積分 › 勝場 › 淨勝球 › 進球', en: 'Pts › Wins › GD › Goals' },
  ucl: { steps: ['GD', 'F', 'away'], ...UEFA },
  uel: { steps: ['GD', 'F', 'away'], ...UEFA },
  uecl: { steps: ['GD', 'F', 'away'], ...UEFA },
  nba: { steps: ['h2h'], zh: '勝率 › 對戰 › 分區冠軍 › 分區戰績', en: 'Win % › H2H › Div. leader › Div. record' },
  mlb: { steps: ['h2h'], zh: '勝率 › 對戰 › 分區內 › 聯盟內戰績', en: 'Win % › H2H › In division › In league' },
  cpbl: { steps: ['h2h'], zh: '勝率 › 對戰 › 得失分差', en: 'Win % › H2H › Run diff.' },
  f1: { steps: ['wins'], zh: '積分 › 冠軍數 › 亞軍數', en: 'Pts › Wins › 2nds' }
};
const SAID = {
  // (Not in the table: the step ESPN's order applied first, and the ones after it if they'd met level or not at all.)
  h2h: { zh: '對戰等', en: 'H2H on' },
  away: { zh: '客場進球', en: 'Away goals' },
  wins: { zh: '名次數', en: 'Finishes' }
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
    // Only where it decides a line (a zone's edge: top 8, the playoffs, the drop), never every level pair (Jay, 2026-11-01).
    if (!same(a, b) || (a.color || '') === (b.color || '')) continue;
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
      why = `${en ? shown.en : shown.zh} ${v(x)}/${v(y)}`;
      break;
    }
    lines.push({ a: name(a), b: name(b), why: why || (en ? 'League rules' : '聯盟規則') });
  }
  if (!lines.length) return null;
  return { rule: en ? rule.en : rule.zh, lines };
}
