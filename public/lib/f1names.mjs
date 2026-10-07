import { F1_NAMES_ZH, F1_PAGE, F1_TEAMS } from '#kit/logos.mjs';

// F1's drivers and teams by the app's own Chinese names, put in before
// translating ("George Russell" and "Russell" both 羅素, Mercedes 賓士, not the
// translator's 拉塞爾 and 梅賽德斯): every driver on the grid, not only the
// ones a story is tagged with. A possessive's "'s" becomes 的.
const F1_FIRST_ALSO = { Albon: ['Alex'], Bearman: ['Ollie'], Antonelli: ['Andrea Kimi', 'Andrea'], Perez: ['Checo'] };
const escapeRe = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let f1Names = null;
function f1NameSwaps() {
  if (f1Names) return f1Names;
  const swaps = [];
  for (const [surname, zh] of Object.entries(F1_NAMES_ZH)) {
    const first = [F1_PAGE[surname] ? F1_PAGE[surname].split('-').slice(0, -1).map(w => w[0].toUpperCase() + w.slice(1)).join(' ') : '', ...(F1_FIRST_ALSO[surname] || [])].filter(Boolean);
    const lead = first.length ? `(?:(?:${first.map(escapeRe).join('|')})\\s+)?` : '';
    swaps.push([new RegExp(`\\b${lead}${escapeRe(surname)}(?:\\s+Jr(?:\\.|\\b))?('s|’s)?(?!\\w)`, 'g'), zh]);
  }
  // Teams, the longest names first ("Red Bull Racing" before "Red Bull").
  const teams = Object.values(F1_TEAMS).flatMap(t => (t.zh && /[\u3400-\u9fff]/.test(t.zh) ? [t.name, ...(t.aka || [])].map(n => [n, t.zh]) : []));
  if (!teams.some(([n]) => n === 'Red Bull Racing')) teams.push(['Red Bull Racing', F1_TEAMS.redbull.zh]);
  for (const [n, zh] of teams.sort((a, b) => b[0].length - a[0].length)) swaps.push([new RegExp(`\\b${escapeRe(n)}(?:\\s+F1\\s+Team)?('s|’s)?\\b`, 'g'), zh]);
  return (f1Names = swaps);
}
export function namedZh(text) {
  let out = String(text || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  for (const [re, zh] of f1NameSwaps()) out = out.replace(re, (m, own) => `${zh}${own ? '的' : ''}`);
  return out;
}
