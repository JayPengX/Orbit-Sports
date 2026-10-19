// What part of the season a match is: preseason, regular season, a cup
// inside the season (the NBA Cup), the All-Star game, play-in, playoffs and
// their rounds, from ESPN's season type, competition type and notes.
//
//   stageOf(event) -> { key, zh, en, round: { zh, en } | null, special }
//
// key: 'pre' | 'regular' | 'cup' | 'allstar' | 'playin' | 'post' | 'final' | 'off' | ''
// special: true when it isn't an ordinary regular-season game (worth a tag).

import { roundName, stageFrom } from '#kit/sports-espn.mjs';
export { roundName, stageFrom };
export const stageOf = e => e?.stage || { key: '', zh: '', en: '', round: null, special: false };
// The short tag for a row: the round when there is one, else the stage.
// A cup's group (set from its table: e.group, "Group C2", "Group A"), said
// in the reader's words: C 級第 2 組 (the Nations League's tiers), A 組.
export function groupName(name, lang = 'zh') {
  const n = String(name || '').trim();
  const tier = /^Group ([A-D])(\d)$/i.exec(n);
  if (tier) return lang === 'en' ? `League ${tier[1].toUpperCase()} · Group ${tier[2]}` : `${tier[1].toUpperCase()} 級第 ${tier[2]} 組`;
  const one = /^Group ([A-Z])$/i.exec(n);
  if (one) return lang === 'en' ? `Group ${one[1].toUpperCase()}` : `${one[1].toUpperCase()} 組`;
  // Already in the reader's words (the table's names are said as they're read).
  return n;
}
export function stageTag(e, lang = 'zh') {
  const s = stageOf(e);
  // An ordinary game of a cup with groups: its group.
  if (!s.special) return e?.group ? groupName(e.group, lang) : '';
  const round = s.round?.[lang === 'en' ? 'en' : 'zh'];
  const stage = s[lang === 'en' ? 'en' : 'zh'];
  if (round && s.key === 'cup') return `${lang === 'en' ? 'NBA Cup' : 'NBA 盃'} · ${round.replace(/^NBA Cup - /i, '')}`;
  return round || stage;
}
