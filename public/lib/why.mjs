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

// F1 賽後故事 (Jay 11-10): how a race or sprint was won, made once by
// Orbit-Core's builder (builders/f1story.js) from F1's own timing (the
// result with grids, stops and tyres, who led which laps, climbs,
// retirements, safety cars), kept at /data/sports/f1/stories/<year>.json:
// { races: { '<session start>': { zh, en } | null } }.
export const f1StoryPath = start => `sports/f1/stories/${new Date(start).getUTCFullYear()}.json`;
export function f1StoryFrom(doc, start, en = false) {
  const t = Date.parse(start);
  const key = Object.keys(doc?.races || {}).find(k => Date.parse(k) === t);
  const r = key ? doc.races[key] : null;
  if (!r || typeof r !== 'object') return '';
  const line = String((en ? r.en : r.zh) || r.zh || r.en || '').trim();
  return line.length > 3 ? line : '';
}
