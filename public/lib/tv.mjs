// Where a game is on in Taiwan, game by game: ELTA's schedule (read through
// the proxy, kept half an hour) and, for the NBA, NBA.com's Taiwan schedule
// (kept six hours), matched to the game (lib/broadcast.mjs). The page is told
// to draw again when a schedule comes in (`onTvChange`).
import { proxyJson } from '#kit/quadra.mjs';
import { ELTA_LIST, parseElta, eltaDays, eltaListed, nbaEltaGames, broadcastsFor, eltaStart, inReplay, replayState, eltaVodOf, eltaVodUrl, eltaVodApp, eltaEpisode, eltaSessionEpisode, episodeLabel, episodeEnglish, hasAudio } from './broadcast.mjs';
import { teamNameZh } from '#kit/names.mjs';
import { watchOf as packOf } from './highlights.mjs';
import { NBA_ID } from '#kit/logos.mjs';
import { LEAGUES } from './leagues.mjs';

let changed = () => {};
export const onTvChange = fn => (changed = fn);
// A schedule read now and again: null until read, then what `parse` makes of
// it (an empty list when it can't be read).
function schedule(read, parse, ttl) {
  let value = null;
  let at = 0;
  let loading = false;
  return () => {
    if (!loading && Date.now() - at > ttl) {
      loading = true;
      read()
        .then(data => (value = parse(data)))
        .catch(() => (value = value || []))
        .finally(() => {
          loading = false;
          at = Date.now();
          changed();
        });
    }
    return value;
  };
}
// ELTA's programs.
export const eltaSchedule = schedule(() => proxyJson(ELTA_LIST, { ttl: 30 * 60_000 }), parseElta, 30 * 60_000);
// NBA.com's ELTA games, the season: the deploy's copy on this site (scripts/nba-elta.mjs).
const nbaSchedule = schedule(
  () =>
    fetch('./nba-elta.json').then(r => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    }),
  nbaEltaGames,
  6 * 3_600_000
);
// NBA.com's ELTA games after ELTA's own list ends, for its guide: the game
// known, its channel not yet ({ league, start, end, teams, title, day, channels: [] }).
const NBA_NAME = Object.fromEntries(Object.entries(NBA_ID).map(([name, id]) => [1610612700 + id, name]));
const taipeiDay = ms => new Date(ms + 8 * 3_600_000).toISOString().slice(0, 10);
export function nbaAfterList() {
  const programs = eltaSchedule();
  const games = nbaSchedule();
  const last = programs?.length ? eltaDays(programs).to : '';
  if (!games?.length) return [];
  const zh = id => teamNameZh('nba', NBA_NAME[id])?.short || NBA_NAME[id] || '';
  return games.filter(g => taipeiDay(g.start) > last).map(g => ({ league: 'nba', start: g.start, end: g.start + 150 * 60_000, teams: [zh(g.away), zh(g.home)], title: '', day: taipeiDay(g.start), channels: [] }));
}
// An NBA team's NBA.com id (the kit's NBA_ID: 38 → 1610612738), or null (a guest club).
const nbaId = side => (NBA_ID[side?.en || side?.name] ? 1610612700 + NBA_ID[side.en || side.name] : null);

// The games known to the page (a program without the sides' names is only
// given to a game with no other of its league starting near it).
let known = () => [];
export const knownEvents = fn => (known = fn);
// A game's sides in Chinese, every way they're written (ELTA writes "海盜",
// "統一"): [home's names, away's names].
function zhSides(e) {
  const l = LEAGUES[e.league];
  return [e.home, e.away].map(s => {
    const zh = teamNameZh(l?.play || e.league, s?.en || s?.name, l?.sport);
    return [s?.name, s?.short, zh?.full, zh?.short].filter(Boolean);
  });
}
// The commentary the person likes ('en' 原音, 'zh' 中文): their channels sort by it.
let prefer = () => 'en';
export const audioPref = fn => (prefer = fn);
// Everything a game is on: { zh, en, short, svc, url, app?, ch?, at?, audio?,
// adFree?, exact?, note? }, the channels that suit the person best first.
export const tvOf = e => {
  if (!e) return [];
  const nba = e.league === 'nba' ? { games: nbaSchedule(), ids: { home: nbaId(e.home), away: nbaId(e.away) } } : null;
  return broadcastsFor(e, eltaSchedule(), { sides: zhSides(e), others: known(), prefer: prefer(), nba, sidesOf: zhSides });
};
// A game whose hour isn't set yet, with ELTA's (its program of the game, once
// listed): the same game at that hour. Else the game as it is.
// (`list`: the games read with it, the day's others.)
export const eltaTime = (e, list = []) => {
  const at = e?.timeTbd ? eltaStart(eltaSchedule(), e, zhSides(e), [...list, ...known()].filter((o, i, all) => all.findIndex(x => x.league === o.league && x.id === o.id) === i)) : null;
  return at ? { ...e, start: new Date(at).toISOString(), timeTbd: false, timeFrom: 'elta' } : e;
};
// Only those of this very game (a schedule's, or Apple TV's every MLS game): for a row's 📺 line.
export const channelsOf = e => tvOf(e).filter(b => b.exact);
// On TV in Taiwan, this very game: the only ones recommended.
export const onTv = e => channelsOf(e).length > 0;
// The way to watch a game now: its best channel with a link, or null.
export const watchOf = e => tvOf(e).find(b => b.url && b.exact) || null;
// Whether the lists that say what's on are in (ELTA's, NBA.com's): before
// that no game can be said to be on, so nothing is recommended yet.
export const tvReady = () => eltaSchedule() !== null && nbaSchedule() !== null;
// The last day ELTA's list covers ('YYYY-MM-DD', Taiwan's), or null: past it
// only the NBA's (NBA.com) and MLS's games can be known to be on.
export const tvUntil = () => eltaDays(eltaSchedule() || [])?.to || null;
// Whether it's known if a game is on TV: MLS and F1 always (Apple TV's
// every game, ELTA's every session), the NBA once NBA.com's list is in, the
// rest within ELTA's list.
export const tvKnown = e =>
  e.league === 'mls' ||
  e.league === 'f1' || (e.league === 'nba' && Boolean(nbaSchedule()?.length)) || eltaListed(eltaSchedule() || [], e);

// Games whose whole video was found on ELTA.tv, kept on the device (the
// newest 500): a row says so without reading ELTA's lists for it.
const REPLAYS = 'fx.replays.v1';
const replayKey = e => `${e.league}:${e.id}:${e.sessionKey || ''}`;
function keptReplays() {
  try {
    return JSON.parse(localStorage.getItem(REPLAYS) || '[]') || [];
  } catch {
    return [];
  }
}
let replaySet = null;
function keepReplay(e) {
  const key = replayKey(e);
  replaySet ??= new Set(keptReplays());
  if (replaySet.has(key)) return;
  replaySet.add(key);
  try {
    localStorage.setItem(REPLAYS, JSON.stringify([...replaySet].slice(-500)));
  } catch {}
}
// A finished game that can be watched again on ELTA (replayState), as far
// as is known without reading anything.
export function replayHint(e, now = Date.now()) {
  if (e?.status?.state !== 'post' || e.status.void) return null;
  replaySet ??= new Set(keptReplays());
  // Its video found: on this device, or in Shared-Data's pack of recent games.
  return replayState(e, channelsOf(e), replaySet.has(replayKey(e)) || Boolean(packOf(e)?.elta), now);
}

// A finished game again on ELTA.tv: { video, episode, alsoChannels? } (the game's video in
// its league's season), else for 48 hours from its start { channels } (the
// channels it was on, for their 回看: no link starts a past program, ELTA
// plays it from the channel's guide), then the season's page while it isn't
// up, or null: not on ELTA (its list says so), or a league ELTA keeps no season of.
export async function replayOf(e, now = Date.now()) {
  // A race weekend opened whole: its race, else the last session it's had.
  if (e?.kind === 'field' && !e.sessionKey && e.sessions?.length) {
    const done = e.sessions.filter(x => x.start && (x.status?.state === 'post' || Date.parse(x.start) + 4 * 3_600_000 < now));
    const x = done.find(y => y.abbr === 'Race') || done.at(-1);
    if (!x) return null;
    e = { ...e, sessionKey: x.abbr, start: x.start, official: x.start, status: { ...x.status, state: 'post' } };
  }
  if (!e || e.status?.state !== 'post' || e.status?.void) return null;
  const channels = channelsOf(e).filter(b => b.svc === 'elta' && b.ch && !b.mod);
  const replay = channels.length && inReplay(e, now);
  // A time ELTA's list covers (programs from before it: the list keeps only
  // part of its first day; its league's after it) and no program of it: ELTA didn't show it.
  const programs = eltaSchedule() || [];
  if (!channels.length && programs.some(p => p.start <= Date.parse(e.start) - 3 * 3_600_000) && eltaListed(programs, e)) return null;
  const sides = zhSides(e);
  const vod = eltaVodOf(e, sides[0]);
  if (!vod) return replay ? { channels } : null;
  const episodes = await proxyJson(eltaVodUrl(vod), { ttl: 30 * 60_000 })
    .then(d => d?.episodes || [])
    .catch(() => []);
  const episode = e.kind === 'match' ? eltaEpisode(episodes, e, sides, { prefer: prefer() }) : eltaSessionEpisode(episodes, e, { prefer: prefer() });
  // Its video already up (the NBA's, 歐國聯's, the next day) plays the game
  // at once; else its channels' 回看 while they have it.
  if (!episode && replay) return { channels };
  const video = { svc: 'elta', zh: '愛爾達 ELTA.tv', en: 'ELTA.tv', short: { zh: '愛爾達', en: 'ELTA' }, url: eltaVodUrl(vod, episode?.id), app: eltaVodApp(vod, episode?.id) };
  // A video without the commentary the person likes (Chinese only, the 原音
  // not up) while a channel's 回看 has it (a 體育台's English on the second
  // track): that too.
  const english = episode && episodeEnglish(episode.title);
  const also = replay && episode && prefer() !== 'zh' && !english ? channels.filter(b => hasAudio(b, 'en')) : [];
  if (episode) keepReplay(e);
  return { video, episode: episode && { ...episode, label: episodeLabel(episode.title), english }, ...(also.length ? { alsoChannels: also } : {}) };
}
