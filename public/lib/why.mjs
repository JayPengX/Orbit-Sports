// 賽後三句話's "why" line (Jay 11-10, the family's AI): a finished game's
// one line on why it went that way, made once by Orbit-Core's builder
// (builders/recaps.js) from a lean digest of ESPN's summary (the score by
// period, the leaders, the plays that swung it), kept at
// /data/sports/recaps/<Taiwan's day>.json: { games: { '<league>:<id>': { zh, en } | null } }.
// The score lines stay the app's own; this adds only what the page can't say.
import { twDay, addDays } from '#kit/format.mjs';

export const recapPath = day => `sports/recaps/${day}.json`;
// The days a game's line may be under: the Taiwan day it started, then the next.
export function recapDays(e) {
  const d = twDay(e?.start);
  return d ? [d, addDays(d, 1)] : [];
}
// The line in the reader's language ('' when there's none, or it was let go).
export function whyFrom(doc, e, en = false) {
  const r = doc?.games?.[`${e?.league}:${e?.id}`];
  if (!r || typeof r !== 'object') return '';
  const line = String((en ? r.en : r.zh) || r.zh || r.en || '').trim();
  return line.length > 3 ? line : '';
}
