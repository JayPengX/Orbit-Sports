// Where a game is on in Taiwan, game by game: ELTA's schedule (read through
// the proxy, kept half an hour) matched to the game (lib/broadcast.mjs), the
// other services by league. The page is told to draw again when the schedule
// comes in (`onTvChange`).
import { proxyJson } from './quadra.mjs';
import { ELTA_LIST, parseElta, broadcastsFor, ytVideoFor } from './broadcast.mjs';
import { teamNameZh } from './names.mjs';
import { LEAGUES } from './leagues.mjs';

let programs = null;
let at = 0;
let loading = false;
let changed = () => {};
export const onTvChange = fn => (changed = fn);
// ELTA's programs (null until read; read again after half an hour).
export function eltaSchedule() {
  if (!loading && Date.now() - at > 30 * 60_000) {
    loading = true;
    proxyJson(ELTA_LIST, { ttl: 30 * 60_000 })
      .then(data => (programs = parseElta(data)))
      .catch(() => (programs = programs || []))
      .finally(() => {
        loading = false;
        at = Date.now();
        changed();
      });
  }
  return programs;
}
// The games known to the page (a program without the sides' names is only
// given to a game with no other of its league starting near it).
let known = () => [];
export const knownEvents = fn => (known = fn);
// A game's sides in Chinese, every way they're written (ELTA writes "海盜", "統一").
function zhSides(e) {
  const l = LEAGUES[e.league];
  return [e.home, e.away].flatMap(s => {
    const zh = teamNameZh(l?.play || e.league, s?.en || s?.name, l?.sport);
    return [s?.name, s?.short, zh?.full, zh?.short].filter(Boolean);
  });
}
// The commentary the person likes ('en' 原音, 'zh' 中文): their channels sort by it.
let prefer = () => 'en';
export const audioPref = fn => (prefer = fn);
// A league's YouTube channel's latest videos (its feed, trimmed by the proxy;
// null until read; read again after half an hour).
const feeds = new Map();
function ytFeed(channel) {
  const f = feeds.get(channel);
  if (f && (f.loading || Date.now() - f.at < 30 * 60_000)) return f.videos;
  feeds.set(channel, { at: Date.now(), videos: f?.videos || null, loading: true });
  proxyJson(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel}`, { ttl: 30 * 60_000 })
    .then(d => feeds.set(channel, { at: Date.now(), videos: Array.isArray(d?.videos) ? d.videos : [], loading: false }))
    .catch(() => feeds.set(channel, { at: Date.now(), videos: f?.videos || [], loading: false }))
    .finally(() => changed());
  return f?.videos || null;
}
// Everything a game is on: { zh, en, kind, svc, ch?, url?, app?, audio?, adFree?, note? },
// the channels that suit the person best first. YouTube only with the very
// game's video on the league's channel (a link to it), never "some games".
export const tvOf = e => {
  if (!e) return [];
  return broadcastsFor(e, eltaSchedule(), zhSides(e), known(), prefer()).flatMap(b => {
    if (b.svc !== 'youtube' || !b.channel) return [b];
    const v = ytVideoFor(e, ytFeed(b.channel));
    if (!v) return [];
    const done = e.status?.state === 'post';
    return [{ ...b, url: `https://www.youtube.com/watch?v=${v.id}`, title: v.t, note: done ? { zh: '這場完整比賽', en: 'the full game' } : { zh: '這場直播', en: 'this game, live' } }];
  });
};
// Only the exact channels (from ELTA's schedule): for a row's 📺 line.
export const channelsOf = e => tvOf(e).filter(b => b.ch);
