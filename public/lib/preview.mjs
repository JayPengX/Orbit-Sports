// 賽前看點 (Jay 11-10, the family's AI plan: code, no AI): why a game to
// come matters, over 兩隊比較, saying only what the page doesn't: the code's
// line a football run of six or more (beyond the last five shown); the AI's
// points (previewFrom) never the places or the gap between them. Nothing
// notable: no line (never filler). `forms` each side's last games
// ({ result: 'W' | 'L' | 'D' }), `names` their short names.

import { twDay, addDays } from '#kit/format.mjs';

export function runOf(games) {
  const list = (games || []).map(g => g.result).filter(Boolean);
  const last = list.at(-1);
  if (!last || last === 'D') return null;
  let n = 0;
  for (let i = list.length - 1; i >= 0 && list[i] === last; i--) n++;
  return n >= 3 ? { won: last === 'W', n } : null;
}

// The code's line, till the AI's points come: only what 兩隊比較 doesn't
// show. Not the places or the gap between them (Jay 2026-11-14, 「排名第 2 對
// 第 3，只差 2 分」: "unhelpful shit I can read": the table under it says
// both), only a football run longer than the last five.
export function previewLine({ sport = '', forms = [], names = [], en = false } = {}) {
  const parts = [];
  // (A run: baseball's and basketball's 連勝敗 row and the last five already say up to five; only a longer one in football, where neither does.)
  forms.forEach((f, i) => {
    const r = sport === 'soccer' ? runOf(f) : null;
    if (r && r.n < 6) return;
    if (r && names[i]) parts.push(en ? `${names[i]} ${r.won ? 'won' : 'lost'} ${r.n} straight` : `${names[i]} ${r.n} 連${r.won ? '勝' : '敗'}`);
  });
  return parts.length ? parts.slice(0, 3).join(' · ') : '';
}

// 賽前看點 made by the family's AI (Jay 11-11: the code's line only said the
// table): up to two points a game, made once by Orbit-Core's builder
// (builders/previews.js) from a digest of ESPN's summary (AP's preview,
// who's out, rest, what a win does in the table, a long run), never what the
// card shows; kept at /data/sports/previews/<Taiwan's day it starts>.json:
// { v: 1, games: { '<league>:<id>': { points: [{ k, zh, en }], who } | null } }.
// Teams and players are tokens ({t:<id>}, {p:<id>}), drawn as chips.
export const previewPath = day => `sports/previews/${day}.json`;
// The days a game's points may be under: the builder files a game by the
// scoreboard day that lists it (ESPN's, a US evening's game the Taiwan day
// before it starts), so the Taiwan day before first, then its own.
export function previewDays(e) {
  const d = twDay(e?.start);
  return d ? [addDays(d, -1), d] : [];
}
const KINDS = new Set(['out', 'table', 'star', 'rest', 'run', 'series']);
// A point that only says what 兩隊比較 shows (its places, the gap between
// them, 龍頭之爭), with nothing a result would change: never shown, made
// before the builder's own check or slipping past it (Jay 2026-11-14).
const PLACES = /排名第\s*\d|第\s*\d+\s*(名\s*)?對\s*第\s*\d+|龍頭之爭|只差|相差|勝差|\b\d+(st|nd|rd|th) v \d+(st|nd|rd|th)\b|\bapart\b|\bgames? (back|behind)\b/i;
const STAKES = /若|如果|一旦|贏球|勝則|獲勝|擊敗|輸球|落敗|即可|就能|就會|升上|升至|跌至|超越|追平|晉級|淘汰|降級|季後賽|\bif\b|\bwith a (win|loss)\b|\bwould\b|\bclinch|\bmove (up|into)\b/i;
export const restatesTable = p => [p?.zh, p?.en].some(t => PLACES.test(String(t || ''))) && ![p?.zh, p?.en].some(t => STAKES.test(String(t || '')));
// The points in the reader's language ([] when none or not made yet), and
// `known`: the game was looked at (null: not yet, the code's line stands in).
// (`sport`: outside football, the card's 連勝敗 row shows the streak: a point
// saying it again, made before the builder learnt not to (馬刺 10連勝 over W10,
// 公牛 8連敗 over L8), left out here too.)
const STREAK = /\d+\s*連[勝敗贏輸]|連[勝敗贏輸]\s*\d+|\b(straight|in a row)\b|-game (winning|losing) streak/i;
export const restatesStreak = (p, sport) => sport !== 'soccer' && [p?.zh, p?.en].some(t => STREAK.test(String(t || '').replace(/\{[pt]:[^}]+\}/g, '')));
export function previewFrom(doc, e, en = false, { sport = '' } = {}) {
  if (!doc || doc.v !== 1) return { points: [], who: {}, known: false };
  const key = `${e?.league}:${e?.id}`;
  const r = doc.games?.[key];
  const known = key in (doc.games || {});
  if (!r || !Array.isArray(r.points)) return { points: [], who: {}, known };
  const points = r.points
    .filter(p => !restatesTable(p) && !restatesStreak(p, sport))
    .map(p => ({ k: KINDS.has(p?.k) ? p.k : 'star', text: String((en ? p?.en : p?.zh) || p?.zh || p?.en || '').trim() }))
    .filter(p => p.text.length > 3)
    .slice(0, 2);
  return { points, who: r.who && typeof r.who === 'object' ? r.who : {}, known };
}
