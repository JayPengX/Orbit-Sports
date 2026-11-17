// A competition's name in the app's words: a club's cup or a friendly in a
// schedule (otherName), a row of a player's numbers (splitName: 例行賽, 英超,
// 英格蘭聯賽盃), a club's league (compName), short enough for one line.
// Taiwan's names, never a machine's: ESPN's "UEFA Conference League
// Qualifying" is 歐協聯資格賽 (a translation read 歐洲足總會議聯賽預選賽, Jay 11-17).
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
  [/uefa super ?cup/i, '歐洲超級盃'],
  [/supercup|super cup/i, '超級盃'],
  [/coupe de france/i, '法國盃'],
  [/club world cup/i, '世俱盃'],
  [/afc champions league/i, '亞冠'],
  [/intercontinental cup/i, '洲際盃'],
  [/world cup/i, '世界盃'],
  // (A national side's games on a player's page, every confederation's: Jay 11-12.)
  [/concacaf nations league/i, '中北美國家聯賽'],
  [/nations league/i, '歐國聯'],
  [/gold cup/i, '金盃賽'],
  [/euro(pean championship)?\b/i, '歐洲盃'],
  [/asian cup/i, '亞洲盃'],
  [/africa cup of nations|afcon/i, '非洲國家盃'],
  [/copa am[eé]rica/i, '美洲盃'],
  [/friendly|friendlies/i, '友誼賽']
];
export const otherName = (name, en) => (en ? name : compName(name, false) || name);

// A league the app has (the longest English name in it: "English Premier League" → 英超), else a cup it knows; else null.
// Its own name only, nothing before it but its country's word or UEFA's:
// never another's (Austrian Bundesliga, 2. Bundesliga, Brazilian Serie A,
// CONCACAF Nations League, AFC Champions League, Women's FA Cup).
const BY_EN = Object.entries(LEAGUES)
  .filter(([, l]) => l.en)
  .sort(([, a], [, b]) => b.en.length - a.en.length);
const OWN_WORDS = /^((english|german|italian|french|scottish|uefa|europa)\s+)*$/;
// ESPN's short names for them (a game log's "UECL Qualifying").
const BY_ABBR = { ucl: 'ucl', uel: 'uel', uecl: 'uecl', unl: 'nationsleague', epl: 'epl' };
// Its qualifying (UEFA's, FIFA's, every confederation's: "FIFA World Cup Qualifying - UEFA"): the competition's name and 資格賽.
const QUALIF = /\s*\b(qualifying|qualification|qualifiers?)\b.*$/i;
export function compName(name, en) {
  const text = String(name || '').trim();
  const q = QUALIF.exec(text);
  if (q?.index > 0) {
    const base = compName(text.slice(0, q.index), en);
    return base ? (en ? `${base} qualifying` : `${base}資格賽`) : null;
  }
  const plain = text.toLowerCase();
  const abbr = BY_ABBR[plain];
  if (abbr) return leagueName(abbr, en ? 'en' : 'zh');
  const lg = BY_EN.find(([, l]) => {
    const at = plain.indexOf(l.en.toLowerCase());
    return at >= 0 && OWN_WORDS.test(plain.slice(0, at));
  });
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
