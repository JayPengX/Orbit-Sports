// A competition's name in the app's words: a club's cup or a friendly in a
// schedule (otherName), a row of a player's numbers (splitName: 例行賽, 英超,
// 英格蘭聯賽盃), short enough for one line.
import { LEAGUES, leagueName } from './leagues.mjs';

// The cups Orbit Sports doesn't follow, in Chinese.
const OTHER_ZH = [
  [/carabao|efl cup|league cup/i, '英格蘭聯賽盃'],
  [/community shield/i, '社區盾'],
  [/efl trophy/i, 'EFL 錦標'],
  [/copa del rey/i, '國王盃'],
  [/supercopa/i, '西班牙超級盃'],
  [/coppa italia/i, '義大利盃'],
  [/supercoppa/i, '義大利超級盃'],
  [/dfb.?pokal/i, '德國盃'],
  [/supercup|super cup/i, '超級盃'],
  [/coupe de france/i, '法國盃'],
  [/club world cup/i, '世俱盃'],
  [/world cup qualif/i, '世界盃資格賽'],
  [/world cup/i, '世界盃'],
  [/nations league/i, '歐國聯'],
  [/euro(pean championship)?\b/i, '歐洲盃'],
  [/copa am[eé]rica/i, '美洲盃'],
  [/friendly|friendlies/i, '友誼賽']
];
export const otherName = (name, en) => (en ? name : OTHER_ZH.find(([re]) => re.test(name))?.[1] || name);

// A league the app has (the longest English name in it: "English Premier League" → 英超), else a cup it knows; else null.
const BY_EN = Object.entries(LEAGUES)
  .filter(([, l]) => l.en)
  .sort(([, a], [, b]) => b.en.length - a.en.length);
export function compName(name, en) {
  const plain = String(name || '').toLowerCase();
  const lg = BY_EN.find(([, l]) => plain.includes(l.en.toLowerCase()));
  if (lg) return leagueName(lg[0], en ? 'en' : 'zh');
  return en ? null : OTHER_ZH.find(([re]) => re.test(plain))?.[1] || null;
}

const SPLIT_ZH = { Career: '生涯', 'Regular Season': '例行賽', Postseason: '季後賽', Playoffs: '季後賽' };
const SEASON = /^(\d{4})(?:[-–/](\d{2,4}))?\s*(年\s*)?/;
const yearOf = name => String(name).match(SEASON)?.[0].replace(/年/, '').trim() || '';
// One row of a player's numbers: its season said only when the rows' differ ("26-27 英超"); null when it has no name of ours.
export function splitName(name, rows = [], en) {
  const rest = String(name).replace(SEASON, '');
  const comp = (en ? null : SPLIT_ZH[name] || SPLIT_ZH[rest]) || compName(rest, en) || (en ? rest : null);
  if (!comp) return null;
  const year = yearOf(name);
  const same = new Set(rows.map(r => yearOf(r.name))).size <= 1;
  return same || !year ? comp : `${year.replace(/^20(\d\d)/, '$1')} ${comp}`;
}
