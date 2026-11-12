// What an injury report's note says, as short facts read by code, never a
// machine translation (Jay 2026-11-12: Google read Curry's "won't return to
// Wednesday's game against the Rockets" as 不會參加, put the reporter's name
// first and kept the box score's 1-3 投籃). ESPN's notes (RotoWire's) say the
// same things the same few ways: out for a day's game against a team, left
// a game, surgery, re-evaluated in so long, out so long, on the injured
// list, throwing again. Each sentence that says one of those is one fact;
// the rest (who reported it, his points, who plays more, contracts) is left
// out in both languages.
//
// injuryFacts(note, { date, lang, team, today }) → [{ day, text }]
//   date   the report's time (ESPN's ISO): its weekdays are America's
//   lang   'zh' | 'en'
//   team   word => the team's Chinese short name ("the Rockets", "Houston" → 火箭), or null
//   today  Taiwan's date (YYYY-MM-DD): a game gone by is said as gone by, a
//          question about it (questionable) left out
// `what`: a diagnosis's words alone (the card's title when it says more).
// `day`: the game's date in Taiwan (a night game in America is the next
// morning here), or null when the fact is no game's.

import { injuryWhatZh } from './statnames.mjs';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, several: 'several', few: 'few', couple: 2 };
const ABBR = /\b(?:Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec|Fla|St|Jr|Sr|vs|No|Dr|Mt|Ft|Calif|Ariz|Mass|Penn|U\.S|D\.C|Ph\.D|[A-Z])\.$/;

const addDays = (date, n) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
// The report's date where it was written (America's east).
function usDate(iso) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);
  } catch {
    return new Date(ms - 5 * 3_600_000).toISOString().slice(0, 10);
  }
}
const weekday = date => new Date(`${date}T12:00:00Z`).getUTCDay();

// When he's due back, as Taiwan's date: ESPN's return date is America's day
// ("2026-11-13", or its midnight in UTC as a player's card writes it), and
// the game that night is the next morning here (Curry's 11/13 read 明天 回歸
// on the 12th: his Friday game is our Saturday). Another time: its date here
// (`local(ms)`). '' when there's none.
export function backDay(at, local = ms => new Date(ms + 8 * 3_600_000).toISOString().slice(0, 10)) {
  if (!at) return '';
  if (/^\d{4}-\d{2}-\d{2}(?:T00:00(?::00(?:\.0+)?)?(?:Z|\+00:?00)?)?$/.test(at)) return addDays(at.slice(0, 10), 1);
  const ms = Date.parse(at);
  return Number.isFinite(ms) ? local(ms) : '';
}

// The note in sentences, each without who reported it.
export function sentences(note) {
  const parts = [];
  let cur = '';
  for (const piece of String(note || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=[A-Z"“])/)) {
    cur = cur ? `${cur} ${piece}` : piece;
    if (!ABBR.test(cur)) {
      parts.push(cur);
      cur = '';
    }
  }
  if (cur) parts.push(cur);
  return parts.map(clean).filter(Boolean);
}
function clean(s) {
  return s
    .replace(/[.!]+$/, '')
    // ", Anthony Slater of ESPN.com reports", ", per X of Y", ", MLB.com reports", ", the Hawks announced Monday"
    .replace(/,\s*(?:per|according to|via)\s+[^,]+$/i, '')
    .replace(/,\s*[^,]*\breport(?:s|ed)?$/i, '')
    .replace(/,\s*the [\w. ]+ (?:announced|said|confirmed)(?: \w+)?$/i, '')
    // "Head coach Ime Udoka said Monday that …", "The Astros announced Friday that …"
    .replace(/^(?:[\w.'’ -]{0,60}? )?(?:said|says|stated|noted|told reporters|announced|confirmed|revealed|indicated)(?: on)?(?: \w+day| \w+\.? \d+)? that /i, '')
    .trim();
}

// Not about his health: a box score, who plays instead, money, moves.
const NOT_HEALTH = /\b\d+-\d+ (?:FG|3Pt|FT)\b|\bpoints?\b|\brebounds?\b|\bassists?\b|\bwent \d+-for-\d+|\bRBI\b|\bERA\b|\baverag|\bslash line|\bstrikeouts?\b|\bfantasy\b|playing time|\bcandidates?\b|\bin line to\b|starting lineup|\bminutes\b|\bcontract\b|\bplayer option\b|\bwaivers\b|\bsigned\b|\btraded?\b|\bsocial media\b|\bstepping away\b/i;
const TEAM = "(?:the\\s+)?((?:[A-Z][\\w.'’]*|76ers)(?:\\s+(?:[A-Z][\\w.'’]*|76ers)){0,2})";
const DAY = '(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)';
// "Wednesday's game against the Rockets", "Tuesday's 107-100 loss to the Magic", "Monday against the Wizards".
const GAME_NOUN = new RegExp(`\\b${DAY}(?:'s|’s)\\s+(?:(?:\\d+-\\d+|[\\w-]+)\\s+){0,2}?(?:game|contest|matchup|tilt|clash|doubleheader|opener|win|loss|victory|defeat)\\b(?:\\s+(?:against|versus|vs\\.?|at|in|over|to|with)\\s+${TEAM})?`);
const GAME_VS = new RegExp(`\\b${DAY}\\s+(?:against|versus|vs\\.?|at|in)\\s+${TEAM}`);
const gameIn = s => GAME_NOUN.exec(s) || GAME_VS.exec(s);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const W = {
  left: ['因傷退場', 'Left the game'],
  out: ['不出賽', 'Out'],
  missed: ['未出賽', 'Sat out'],
  q: ['出賽存疑', 'Questionable'],
  doubtful: ['可能缺陣', 'Doubtful'],
  probable: ['可望出賽', 'Probable'],
  back: ['回歸', 'Back'],
  soonest: ['最快回歸', 'Could return'],
  played: ['已回歸', 'Played']
};
function gameKind(s) {
  if (/\b(?:won't|will not|didn't|did not|wouldn't) return(?: to)?\b|\bexited\b|\bleft\b[^.]*\b(?:early|game)\b|\bforced out\b/i.test(s)) return 'left';
  if (/\bquestionable\b|game-time decision/i.test(s)) return 'q';
  if (/\bdoubtful\b/i.test(s)) return 'doubtful';
  if (/\bprobable\b/i.test(s)) return 'probable';
  if (/\bas soon as\b|\bcould (?:return|be cleared|make his return)\b/i.test(s)) return 'soonest';
  if (/\b(?:ruled out|won't play|will not play|won't suit up|will sit out|sat out|will miss|missed|is out|be out|listed as out|remains? out|won't be available|unavailable|inactive|won't travel|did not play|didn't play)\b/i.test(s)) return /\b(?:sat out|missed|did not play|didn't play)\b/i.test(s) ? 'missed' : 'out';
  if (/\b(?:will return|expected to return|set to return|returns?|cleared to (?:play|return)|will play|available|will start|in the lineup|is active|was activated)\b/i.test(s)) return /\b(?:returned|played|was activated)\b/i.test(s) ? 'played' : 'back';
  return null;
}
const PAST = new Set(['left', 'missed', 'played']);

const num = w => {
  const x = String(w).toLowerCase();
  if (/^\d+$/.test(x)) return +x;
  return NUM[x] ?? null;
};
// "four-to-six", "3-to-4", "two" → [4, 6] / [3, 4] / [2]
function amount(text) {
  const m = /^(\w+)(?:(?:-to-|\s+to\s+|-|\s+or\s+)(\w+))?$/i.exec(text.trim());
  if (!m) return null;
  const a = num(m[1]);
  const b = m[2] ? num(m[2]) : null;
  if (a == null || (m[2] && b == null)) return null;
  return b == null ? [a] : [a, b];
}
const UNIT = { day: ['天', 'day'], week: ['週', 'week'], month: ['個月', 'month'], game: ['場', 'game'] };
function span(n, unit, zh) {
  const u = UNIT[unit.toLowerCase().replace(/s$/, '')];
  if (!u || !n) return null;
  if (n[0] === 'several' || n[0] === 'few') return zh ? `數${u[0] === '個月' ? '月' : u[0]}` : `${n[0] === 'few' ? 'a few' : n[0]} ${u[1]}s`;
  const many = (n[1] ?? n[0]) !== 1;
  if (zh) return `${n.join(' 到 ')} ${u[0]}`.replace(/^1 個月$/, '一個月');
  return `${n.join('–')} ${u[1]}${many ? 's' : ''}`;
}

// The facts in one sentence (none, one or two).
// The facts' order on the card: the games, then what it is, the surgery, how long, the rest.
const rankOf = en => (/^Diagnosis/.test(en) ? 1 : /surgery/i.test(en) ? 2 : /^(Out|Re-evaluated|Back|About)/.test(en) ? 3 : 4);
function factsOf(s, { zh, report, team, today }) {
  const out = [];
  // ("a couple weeks" is a few; "approximately three weeks" three.)
  s = s.replace(/\ba couple(?: of)?\b/gi, 'few').replace(/\b(?:about|approximately|roughly|around)\s+(?=\w+(?:-to-\w+)?\s+(?:days?|weeks?|months?)\b)/gi, '');
  const say = (zhText, enText, day = null, what = null) => out.push({ day, text: zh ? zhText : enText, rank: day ? 0 : rankOf(enText), ...(what ? { what } : {}) });
  const g = gameIn(s);
  const kind = g ? gameKind(s) : null;
  if (g && kind && report) {
    // The game's day: the next such weekday from the report (one gone by when it's said in the past), in America, then here.
    // (A game five or six days ahead is the note's old one: the week's games come every day or two,
    // and ESPN dates a note when it last touched the player, so Tuesday's said on a Wednesday is the one gone by.)
    const diff = (DAYS.indexOf(g[1].toLowerCase()) - weekday(report) + 7) % 7;
    const past = PAST.has(kind) || (diff >= 5 && /^(out|q|doubtful|probable)$/.test(kind));
    const us = addDays(report, past ? -((7 - diff) % 7) : diff);
    const day = addDays(us, 1);
    const gone = today && day < today;
    let k = kind;
    if (gone && k === 'out') k = 'missed';
    if (gone && k === 'back') k = 'played';
    if (!(gone && /^(q|doubtful|probable|soonest)$/.test(k))) {
      const vs = g[2] || null;
      const vsZh = vs ? team?.(vs) : null;
      const word = W[k];
      say(`${vsZh ? `對${vsZh} ` : ''}${word[0]}`, `${word[1]}${vs ? ` vs ${vs}` : ''}`, day);
    }
  } else if (!g && /\bexited\b|\bleft\b[^.]*\b(?:early|game)\b/i.test(s) && /\b(?:did not|didn't|won't|will not) return\b/i.test(s)) say('比賽中因傷退場', 'Left a game hurt');
  // Out with no day said ("remains out indefinitely", "will miss an extended period").
  if (/\bindefinitely\b/i.test(s)) say('無限期缺陣', 'Out indefinitely');
  else if (/\bextended (?:period|stretch|absence)\b|\blong-term\b/i.test(s)) say('將長期缺陣', 'Out for an extended period');
  // How long.
  const long = /\b(?:miss|be sidelined(?: for)?|sidelined for|be out for|out for|remain out for|be out|is out|sit out|be shelved for)\s+(?:at least\s+|roughly\s+|about\s+|approximately\s+|around\s+|another\s+|the next\s+|an additional\s+)?(\w+(?:(?:-to-|\s+to\s+|-)\w+)?)\s+(?:more\s+|additional\s+)?(days?|weeks?|months?|games?)\b/i.exec(s);
  const away = /\b(?:about|roughly|around)?\s*(a|one|two|three|four|five|six|\w+-to-\w+)\s+(weeks?|months?)\s+away from (?:a )?return/i.exec(s);
  if (long) {
    const t = span(amount(long[1]), long[2], zh);
    const least = /\bat least\b/i.test(long[0]);
    if (t) say(`${least ? '至少' : '預計'}缺陣${/^\d/.test(t) ? ' ' : ''}${t}`, `${least ? 'Out at least' : /^\d/.test(t) ? 'Out about' : 'Out'} ${t}`);
  } else if (away) {
    const t = span(amount(away[1]), away[2], zh);
    if (t) say(`約 ${t}後回歸`, `About ${t} from returning`);
  }
  // Surgery, done or to come.
  if (/\bsurgery\b|\bsurgical\b|\bprocedure\b|\bUCL repair\b|\binternal brace\b/i.test(s)) {
    const tj = /tommy john|\bUCL\b/i.test(s);
    const zhWhat = tj ? '韌帶重建手術' : '手術';
    const enWhat = tj ? 'Tommy John surgery' : 'surgery';
    if (/\b(?:will|to|set to|scheduled to|expected to|plans to|is set for|needs?)\s+(?:undergo|have)\b|\bwill require\b/i.test(s)) say(`將動${zhWhat}`, `To have ${enWhat}`);
    else if (/\bunderwent\b|\bundergone\b|\bundergoing\b|\bhad\b|\bunder the knife\b|\bsuccessful\b|\bfollowing\b|\bafter\b|\bfrom\b/i.test(s)) say(`已動${zhWhat}`, `Had ${enWhat}`);
  }
  // Seen again in so long.
  const re = /\bre-?evaluated\s+(?:again\s+)?in\s+(\w+(?:(?:-to-|\s+to\s+|-)\w+)?)\s+(days?|weeks?|months?)\b/i.exec(s);
  if (re) {
    const t = span(amount(re[1]), re[2], zh);
    if (t) say(`${t}後再評估`, `Re-evaluated in ${t}`);
  } else if (/\bre-?evaluated before the end of the regular season\b/i.test(s)) say('例行賽結束前再評估', 'Re-evaluated before the regular season ends');
  // Baseball's injured list.
  const il = /\b(\d+)-day (?:injured list|IL)\b/gi;
  const ils = [...s.matchAll(il)].map(m => m[1]);
  if (ils.length) {
    const n = ils.at(-1);
    if (/\btransferred\b|\bmoved\b/i.test(s)) say(`移至 ${n} 天傷兵名單`, `Moved to the ${n}-day IL`);
    else if (/\bactivated\b|\breinstated\b/i.test(s)) say('自傷兵名單歸隊', 'Back from the IL');
    else if (/\bplaced\b|\blanded\b|\bwent on\b|\bput on\b/i.test(s)) say(`進入 ${n} 天傷兵名單`, `On the ${n}-day IL`);
  }
  if (/\bshut down\b/i.test(s)) say('暫停復健', 'Shut down');
  else if (/\brehab assignment\b/i.test(s)) say('下放小聯盟復健', 'On a rehab assignment');
  // Working back.
  if (/\bthrowing (?:program|progression)\b|\b(?:began|begun|resumed|started) throwing\b|\bplaying catch\b|\bthrew (?:a |his first )?(?:live )?bullpen\b/i.test(s) && !/\bscheduled\b|\bshut down\b/i.test(s)) say('已開始投球', 'Throwing again');
  else if (/\bhitting progression\b|\bbatting practice\b|\b(?:began|resumed) hitting\b/i.test(s)) say('已開始打擊練習', 'Hitting again');
  else if (/\bon-court (?:work|activities)\b|\b(?:is|was|been) practicing\b|\bpracticed\b|\bfull participant\b|\b(?:returned|return) to practice\b|\bfull-contact\b/i.test(s)) say('已恢復練習', 'Practising again');
  if (/\b(?:ready|full participant|available)\b[^.]{0,40}\bspring training\b/i.test(s)) say('預計春訓歸隊', 'Expected for spring training');
  if (/\bnot be ready for the start of the (?:regular )?season\b|\bmiss the start of the season\b|\bmiss opening night\b/i.test(s)) say('趕不上開季', 'Will miss the start of the season');
  if (/\brest of the postseason\b|\bmiss the postseason\b/i.test(s)) say('季後賽報銷', 'Out for the postseason');
  // Out for the season (the card's 回歸 line says it already when ESPN's words are the ones it reads: the sheet leaves one of them).
  if (/\b(?:rest|remainder) of the (?:\d{4} )?(?:regular )?season\b|\bseason-ending\b|\b(?:done|out) for the season\b|\bmiss the (?:full |entire )?\d{4}(?:-\d{2})? season\b/i.test(s)) say('本季報銷', 'Out for the season');
  // When, by months ("a return between December and January").
  const months = new RegExp(`\\breturn\\b[^.]{0,30}?\\b(?:between|in|by)\\s+(?:early\\s+|mid-|late\\s+)?(${MONTHS.join('|')})(?:\\s+(?:and|or|to)\\s+(?:early\\s+|mid-|late\\s+)?(${MONTHS.join('|')}))?`).exec(s);
  if (months) {
    const [a, b] = [months[1], months[2]].map(m => (m ? MONTHS.indexOf(m) + 1 : 0));
    say(`預計 ${a} 月${b ? `到 ${b} 月` : ''}回歸`, `Back around ${months[1]}${b ? `–${months[2]}` : ''}`);
  }
  // What the doctors found ("diagnosed with a torn right ACL", "suffered a non-displaced fracture in his right hand").
  const found = /\b(?:diagnosed with|suffered|sustained)\s+(?:an?\s+)?(?:(?:mild|minor|moderate|severe|significant|slight|small|partial|partially|full|complete|season-ending|career-threatening|non-displaced|displaced|apparent|low-grade|high-grade|grade-?\w+|Grade \w+)\s+)*([A-Za-z' -]+?)(?=\s+(?:and|that|after|during|which|while|on|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b|[,.;]|$)/.exec(s);
  if (found) {
    // "fracture in his right hand" → "right hand fracture"; "torn right ACL" → "right ACL torn": the place first, as Chinese says it.
    const [, head, place = ''] = /^(.+?)(?:\s+(?:in|of|to)\s+(?:his|the)\s+(.+))?$/i.exec(found[1].trim());
    const what = `${place} ${head.replace(/^(torn|fractured|broken|sprained|strained|ruptured|dislocated|bruised|hyperextended)\s+(.+)$/i, '$2 $1')}`.trim();
    const zhWhat = injuryWhatZh(what);
    const HURT = /撕裂|骨折|扭傷|拉傷|斷裂|脫臼|挫傷|發炎|腦震盪|疲勞性反應|疲勞性骨折|痙攣|肌腱炎|傷勢|割傷|積液|夾擠|感染|疝氣|痠痛|緊繃/g;
    // (Said only when it names where, not a bare "右傷勢" from words the list hasn't.)
    if (zhWhat && HURT.test(zhWhat) && zhWhat.replace(HURT, '').replace(/[左右、]/g, '')) {
      const enWhat = found[1].replace(/\bhis\b/gi, 'the').replace(/\s+/g, ' ').trim();
      say(`診斷：${zhWhat}`, `Diagnosis: ${enWhat}`, null, zh ? zhWhat : enWhat);
    }
  }
  if (/\bconcussion protocol\b/i.test(s)) say('進入腦震盪觀察程序', 'In the concussion protocol');
  if (/\bMRI\b/.test(s) && /\b(?:will|to|scheduled|set|slated)\b[^.]{0,20}\bMRI\b|\bundergo an MRI\b/i.test(s)) say('將做核磁共振檢查', 'To have an MRI');
  return out;
}

export function injuryFacts(note, { date = '', lang = 'zh', team = null, today = '' } = {}) {
  if (!note || /^no\.?$/i.test(String(note).trim())) return [];
  const zh = lang !== 'en';
  const report = date ? usDate(date) : null;
  const seen = new Set();
  const out = [];
  for (const s of sentences(note)) {
    if (NOT_HEALTH.test(s) && !gameIn(s) && !/\bsurgery\b|\bre-?evaluated\b|\binjured list\b/i.test(s)) continue;
    for (const f of factsOf(s, { zh, report, team, today })) {
      const key = `${f.day}|${f.text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(f);
    }
  }
  return out
    .map((f, i) => [f, i])
    .sort(([a, i], [b, j]) => a.rank - b.rank || i - j)
    .slice(0, 4)
    .map(([{ day, text, what }]) => ({ day, text, ...(what ? { what } : {}) }));
}
