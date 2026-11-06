// How each league orders sides level on its table (Jay, 2026-11-01: "make
// sure it knows how same-win teams are decided, not just a random team").
// ESPN's tables come in the league's own order, its tiebreaks applied; a
// table re-sorted after fresh finals keeps to the same steps. Never said
// under a table (Jay 2026-11-06: the 同分 line made the cards uneven).
//
//   TIEBREAKS[league] -> { steps: [step key], zh, en } (the official order, in words)
//   tableKey(league)  -> the numbers a table re-sorts by (title.mjs liveTable): the
//                        steps the table holds, up to the first it doesn't

const num = v => {
  const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
// The steps a table holds (stat, label): anything else ('h2h', 'div', …) is ESPN's order.
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
