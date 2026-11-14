// 相關新聞 (the family's links, Jay 2026-11-13: "do that cross app thing for
// sports's that's news related, for example injury"): Orbit News' sports
// stories about a player, a team or a game, found by code (the kit's
// news-sport.mjs: names as the outlets write them, English or Chinese, a bare
// nickname only where the story is plainly of its sport; the family's AI only
// read a Chinese story's names, 柯瑞 as Stephen Curry, in Orbit-Core's
// builder). A row opens the story in Orbit News (in place in Orbit).
//
// news/sport.json (Orbit-Core builders/news.js): read once the app is up,
// painted from the phone's own copy at once, again every 10 minutes.
// An older kit without news-sport.mjs: no news, nothing else changes.
import { packJson, peekPack } from '#kit/orbit.mjs';
import { LEAGUES } from './leagues.mjs';

export const NEWS_TTL = 10 * 60_000;
// The days around a game its news is from: three before it, one after.
export const GAME_BEFORE = 3 * 86_400_000;
export const GAME_AFTER = 86_400_000;

let kit = null;
let pack = null;
let reading = null;
// What's been read (null until then): { kit, pack }.
export const newsNow = () => (kit && pack ? { kit, pack } : null);
// Read (the phone's copy first, then the edge's): resolves { kit, pack } or null.
export function readNews() {
  reading ||= Promise.all([import('#kit/news-sport.mjs'), import('#kit/news-outlets.mjs')])
    .then(async ([k, o]) => {
      if (!k?.cleanSport || !k?.newsAbout) return null;
      kit = { ...k, outletOf: o.outletOf, outletIcon: o.outletIcon };
      if (!pack) {
        const kept = await Promise.resolve(peekPack?.(k.SPORT_PATH)).catch(() => null);
        if (kept?.data) pack = k.cleanSport(kept.data);
      }
      const raw = await packJson(k.SPORT_PATH, { ttl: NEWS_TTL, timeout: 20_000 }).catch(() => null);
      if (raw) pack = k.cleanSport(raw);
      return newsNow();
    })
    .catch(() => newsNow())
    .finally(() => (reading = null));
  return reading;
}

// A team as the kit's matcher takes it, from Sports' league and ESPN's names.
export function teamFor(league, { name = '', short = '' } = {}) {
  const l = LEAGUES[league];
  return name ? { league: l?.play || league, name, short, sport: l?.sport || '' } : null;
}

// A player's stories (his own name; his surname beside his team's): his
// injury's first. `zh` his own Chinese name where his league writes one (the CPBL's).
export function playerNews(n, league, { name, zh = '', team = null }, most = 4) {
  if (!n || !(name || zh)) return [];
  return n.kit.newsAbout(n.pack, { players: [{ name, zh, team: team && teamFor(league, team) }], most });
}
// A team's stories: its injuries, bans, coaches and moves first, then its games.
export function teamNews(n, league, team, most = 4) {
  const t = n && teamFor(league, team);
  return t ? n.kit.newsAbout(n.pack, { teams: [t], most }) : [];
}
// A game's: those naming both sides from three days before it to a day
// after; then either side's injuries and bans before it (who's out tonight).
export function gameNews(n, e, most = 4) {
  if (!n || !e?.home?.name || !e?.away?.name) return [];
  // (Its English names; a Chinese `short` the kit leaves out.)
  const sides = [e.away, e.home].map(x => teamFor(e.league, { name: x.en || x.name, short: x.enShort || x.short || '' })).filter(Boolean);
  if (sides.length < 2) return [];
  const at = Date.parse(e.start) || Date.now();
  const both = n.kit.newsAbout(n.pack, { teams: sides, both: true, from: at - GAME_BEFORE, to: at + GAME_AFTER, most });
  const hurt = n.kit.newsAbout(n.pack, { teams: sides, kinds: ['injury', 'ban'], from: at - GAME_BEFORE, to: at, most });
  const seen = new Set();
  const all = [...hurt, ...both].filter(s => !seen.has(s.id) && seen.add(s.id));
  // The world's sports outlets first (ESPN, The Athletic, Yahoo Sports…),
  // Taiwan's only filling in: one at most where the world's have the game
  // (Jay 11-14: "all Taiwan news … the worst you can find about sport").
  const world = all.filter(s => s.region !== 'tw');
  const local = all.filter(s => s.region === 'tw');
  return [...world, ...local.slice(0, world.length ? 1 : most)].slice(0, most);
}

// The outlet a story's row is marked with: a sports outlet that carried it
// (ESPN, The Athletic…) before the one it's filed under (USA Today's blue
// dot over a game the sports desks all told: Jay 11-14).
const DESKS = ['espn', 'athletic', 'skysports', 'cbssports', 'yahoosports', 'si'];
export function markOf(s) {
  const by = new Set((s?.items || []).map(it => it?.[0]));
  return DESKS.find(o => o === s?.by || by.has(o)) || s?.by || '';
}
