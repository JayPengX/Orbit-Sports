// What part of the season a match is: preseason, regular season, a cup
// inside the season (the NBA Cup), the All-Star game, play-in, playoffs and
// their rounds, from ESPN's season type, competition type and notes.
//
//   stageOf(event) -> { key, zh, en, round: { zh, en } | null, special }
//
// key: 'pre' | 'regular' | 'cup' | 'allstar' | 'playin' | 'post' | 'final' | 'off' | ''
// special: true when it isn't an ordinary regular-season game (worth a tag).

const STAGES = {
  pre: { zh: '季前賽', en: 'Preseason' },
  regular: { zh: '例行賽', en: 'Regular season' },
  cup: { zh: '盃賽', en: 'Cup' },
  allstar: { zh: '明星賽', en: 'All-Star' },
  playin: { zh: '附加賽', en: 'Play-In' },
  post: { zh: '季後賽', en: 'Playoffs' },
  final: { zh: '總冠軍賽', en: 'Finals' },
  off: { zh: '休賽季', en: 'Off-season' }
};

// Round names, English as ESPN writes them -> Chinese.
const ROUNDS = [
  [/world series/i, '世界大賽'],
  [/\b(nba|wnba|stanley cup) finals?\b/i, '總冠軍賽'],
  [/super bowl/i, '超級盃'],
  [/\b[an]lcs\b|league championship/i, '聯盟冠軍賽'],
  [/\b[an]lds\b|division series/i, '分區系列賽'],
  [/\b[an]lwc\b|wild ?card/i, '外卡賽'],
  [/conf(erence)?\.? finals|east finals|west finals|eastern finals|western finals/i, '分區冠軍賽'],
  [/conf(erence)?\.? semi|east semifinals|west semifinals|2nd round|second round/i, '分區準決賽'],
  [/1st round|first round/i, '首輪'],
  [/divisional/i, '分區賽'],
  [/play-?in/i, '附加賽'],
  [/quarter-?finals?/i, '八強'],
  [/semi-?finals?/i, '準決賽'],
  [/round of 16/i, '16 強'],
  [/round of 32/i, '32 強'],
  [/knockout round play-?offs?/i, '淘汰附加賽'],
  [/group stage|league phase|group [a-z]\b/i, '小組賽'],
  [/\bfinal\b/i, '決賽'],
  [/all-?star/i, '明星賽'],
  [/nba cup|in-season tournament|emirates cup/i, 'NBA 盃'],
  [/friendly|exhibition/i, '友誼賽']
];

export function roundName(text, lang = 'zh') {
  const s = String(text || '').trim();
  if (!s) return '';
  if (lang === 'en') return s;
  const game = /game (\d+)/i.exec(s)?.[1];
  const maybe = /if necessary/i.test(s);
  const hit = ROUNDS.find(([re]) => re.test(s));
  if (!hit) return s;
  // "NLDS - Game 3": the league (AL/NL, East/West) and the game.
  const side = /\bAL|American/.test(s) ? '美聯' : /\bNL|National/.test(s) ? '國聯' : /\bEast/i.test(s) ? '東區' : /\bWest/i.test(s) ? '西區' : '';
  return `${side}${hit[1]}${game ? ` G${game}` : ''}${maybe ? '（如需）' : ''}`;
}

export function stageFrom({ seasonType, seasonSlug = '', typeAbbr = '', note = '', name = '', cup = false } = {}) {
  const text = `${note} ${name}`;
  let key = '';
  if (/ALLSTAR/i.test(typeAbbr) || /all-?star/i.test(text)) key = 'allstar';
  else if (/play-?in/i.test(text)) key = 'playin';
  else if (seasonType === 1 || /preseason/i.test(seasonSlug)) key = 'pre';
  else if (seasonType === 3 || /post-?season/i.test(seasonSlug)) key = /world series|n?ba finals|stanley cup final|super bowl|^finals?\b/i.test(note) ? 'final' : 'post';
  else if (seasonType === 4 || /off-?season/i.test(seasonSlug)) key = 'off';
  else if (/nba cup|in-season tournament/i.test(text)) key = 'cup';
  else if (seasonType === 2 || /regular/i.test(seasonSlug)) key = 'regular';
  const round = note && key !== 'regular' ? { zh: roundName(note, 'zh'), en: note } : cup && note ? { zh: roundName(note, 'zh'), en: note } : null;
  return { key, ...(STAGES[key] || { zh: '', en: '' }), round, special: Boolean(key && key !== 'regular') || Boolean(round) };
}

export const stageOf = e => e?.stage || { key: '', zh: '', en: '', round: null, special: false };
// The short tag for a row: the round when there is one, else the stage.
export function stageTag(e, lang = 'zh') {
  const s = stageOf(e);
  if (!s.special) return '';
  const round = s.round?.[lang === 'en' ? 'en' : 'zh'];
  const stage = s[lang === 'en' ? 'en' : 'zh'];
  if (round && s.key === 'cup') return `${lang === 'en' ? 'NBA Cup' : 'NBA 盃'} · ${round.replace(/^NBA Cup - /i, '')}`;
  return round || stage;
}
