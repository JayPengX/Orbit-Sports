import { F1_NAMES_ZH, F1_PAGE, F1_TEAMS } from '#kit/logos.mjs';

// An F1 story made ready for the translator: its teams by the app's own
// Chinese names (Mercedes 賓士, not the translator's 梅賽德斯), its drivers
// kept in English as the app names them (the translator would make George
// Russell 喬治·拉塞爾): each held as ⟦0⟧, ⟦1⟧… (which comes through
// untouched, its "'s" as 的) and put back by `back`. Every driver on the
// grid, not only the ones a story is tagged with.
const F1_FIRST_ALSO = { Albon: ['Alex'], Bearman: ['Ollie'], Antonelli: ['Andrea Kimi', 'Andrea'], Perez: ['Checo'] };
const escapeRe = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let f1Names = null;
function f1NameSwaps() {
  if (f1Names) return f1Names;
  const drivers = [];
  for (const surname of Object.keys(F1_NAMES_ZH)) {
    const first = [F1_PAGE[surname] ? F1_PAGE[surname].split('-').slice(0, -1).map(w => w[0].toUpperCase() + w.slice(1)).join(' ') : '', ...(F1_FIRST_ALSO[surname] || [])].filter(Boolean);
    const lead = first.length ? `(?:(?:${first.map(escapeRe).join('|')})\\s+)?` : '';
    drivers.push(new RegExp(`\\b${lead}${escapeRe(surname)}(?:\\s+Jr(?:\\.|\\b))?(?=('s|’s)?(?!\\w))`, 'g'));
  }
  // Teams, the longest names first ("Red Bull Racing" before "Red Bull").
  const teams = [];
  const names = Object.values(F1_TEAMS).flatMap(t => (t.zh && /[\u3400-\u9fff]/.test(t.zh) ? [t.name, ...(t.aka || [])].map(n => [n, t.zh]) : []));
  if (!names.some(([n]) => n === 'Red Bull Racing')) names.push(['Red Bull Racing', F1_TEAMS.redbull.zh]);
  for (const [n, zh] of names.sort((a, b) => b[0].length - a[0].length)) teams.push([new RegExp(`\\b${escapeRe(n)}(?:\\s+F1\\s+Team)?('s|’s)?\\b`, 'g'), zh]);
  return (f1Names = { drivers, teams });
}
export function namedZh(text) {
  const { drivers, teams } = f1NameSwaps();
  let out = String(text || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const held = [];
  for (const re of drivers) out = out.replace(re, m => `⟦${held.push(m) - 1}⟧`);
  for (const [re, zh] of teams) out = out.replace(re, (m, own) => `${zh}${own ? '的' : ''}`);
  // Back in English, a space between it and Chinese on either side.
  const cjk = c => /[\u3400-\u9fff]/.test(c || '');
  const back = s =>
    String(s).replace(/\s*⟦(\d+)⟧\s*/g, (m, i, at, all) => {
      const before = all[at - 1];
      const after = all[at + m.length];
      return `${before && (cjk(before) || /\s/.test(m[0])) && !/[，。、；：！？（「]/.test(before) ? ' ' : ''}${held[i] ?? m.trim()}${after && (cjk(after) || /\s$/.test(m)) && !/[，。、；：！？）」]/.test(after) ? ' ' : ''}`;
    });
  return { text: out, back };
}
