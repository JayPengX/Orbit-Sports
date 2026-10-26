// Where a game is on in Taiwan, game by game: ELTA's schedule (read through
// the proxy, kept half an hour) and, for the NBA, NBA.com's Taiwan schedule
// (kept six hours), matched to the game (lib/broadcast.mjs). The page is told
// to draw again when a schedule comes in (`onTvChange`).
import { proxyJson, packJson, taipeiDay } from '#kit/orbit.mjs';
import { ELTA_LIST, parseElta, eltaDays, eltaListed, nbaEltaGames, broadcastsFor, eltaStart, inReplay, replayState, eltaVodsOf, useEltaPages, eltaVodUrl, eltaVodApp, eltaEpisode, eltaSessionEpisode, episodeLabel, episodeEnglish, hasAudio, camPlayer, withEltaNames } from './broadcast.mjs';
import { teamNameZh } from '#kit/names.mjs';
import { watchOf as packOf, loadWatchMonth } from './highlights.mjs';
import { NBA_ID } from '#kit/logos.mjs';
import { LEAGUES } from './leagues.mjs';

let changed = () => {};
export const onTvChange = fn => (changed = fn);
// A schedule read now and again: null until read, then what `parse` makes of
// it (an empty list when it can't be read). `keep`: the last copy kept on
// the device (12 hours at most) is the answer from the first call, the
// fresh one read behind it and drawn only if it's changed: the picks are
// the games on TV, so opening waited on both lists every time.
const KEEP_MS = 12 * 3_600_000;
function schedule(read, parse, ttl, keep = '') {
  let value = null;
  let at = 0;
  let loading = false;
  let text = '';
  // An older copy (past 12 hours): not shown first, but the answer when the
  // read fails (an empty list hid every game of ELTA's leagues, EPL's whole
  // day, until the app was opened again).
  let old = null;
  let fails = 0;
  if (keep)
    try {
      const saved = JSON.parse(globalThis.localStorage?.getItem(keep) || 'null');
      if (saved?.data && Date.now() - saved.at < KEEP_MS) {
        value = parse(saved.data);
        text = JSON.stringify(saved.data);
      } else if (saved?.data) old = saved.data;
    } catch {}
  const get = () => {
    // A failed read is tried again soon (20 s, then 40 s, … up to ttl), not after ttl.
    const wait = fails ? Math.min(ttl, 20_000 * 2 ** (fails - 1)) : ttl;
    if (!loading && Date.now() - at > wait) {
      loading = true;
      let moved = true;
      read()
        .then(data => {
          const fresh = JSON.stringify(data);
          moved = fresh !== text || value === null || get.failed;
          if (moved) value = parse(data);
          text = fresh;
          fails = 0;
          get.failed = false;
          if (keep)
            try {
              globalThis.localStorage?.setItem(keep, JSON.stringify({ at: Date.now(), data }));
            } catch {}
        })
        .catch(() => {
          fails += 1;
          if (value === null && old) value = parse(old);
          // Not read and nothing kept: known as not known (tvKnown false
          // for every game), never as "nothing on".
          get.failed = value === null || !value.length;
          value = value || [];
        })
        .finally(() => {
          loading = false;
          at = Date.now();
          if (moved) changed();
        });
    }
    return value;
  };
  get.failed = false;
  return get;
}
// ELTA.tv's season pages, found each night by their titles (Shared-Data's
// sports/elta-pages.json): read once a session (a new season is a new page;
// unread, the ones known in code).
let pagesRead = null;
const eltaPagesReady = () =>
  (pagesRead ||= packJson('sports/elta-pages.json', { ttl: 12 * 3_600_000 })
    .then(d => useEltaPages(d?.pages))
    .catch(() => (pagesRead = null)));
// ELTA's programs.
export const eltaSchedule = schedule(() => proxyJson(ELTA_LIST, { ttl: 30 * 60_000 }), parseElta, 30 * 60_000, 'fx.tv.elta');
// NBA.com's ELTA games, the season: the deploy's copy on this site (scripts/nba-elta.mjs).
const nbaSchedule = schedule(
  () =>
    fetch('./nba-elta.json').then(r => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    }),
  nbaEltaGames,
  6 * 3_600_000,
  'fx.tv.nba'
);
// NBA.com's ELTA games after ELTA's own list ends, for its guide: the game
// known, its channel not yet ({ league, start, end, teams, title, day, channels: [] }).
const NBA_NAME = Object.fromEntries(Object.entries(NBA_ID).map(([name, id]) => [1610612700 + id, name]));
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
// (Worked out once a moment: a page drawn at once asks each game's channels
// three or four times, and every ask gathered all the known games again;
// half a league switch's freeze. Forgotten as soon as the drawing is done.)
let tick = null;
const now = () => {
  if (!tick) {
    tick = { tv: new WeakMap(), known: null };
    queueMicrotask(() => (tick = null));
  }
  return tick;
};
const knownNow = () => (now().known ??= known());
// A game's sides in Chinese, every way they're written (ELTA writes "海盜",
// "統一", its own for some clubs: ELTA_AS): [home's names, away's names].
function zhSides(e) {
  const l = LEAGUES[e.league];
  return [e.home, e.away].map(s => {
    const zh = teamNameZh(l?.play || e.league, s?.en || s?.name, l?.sport);
    return withEltaNames([s?.name, s?.short, zh?.full, zh?.short].filter(Boolean));
  });
}
// The commentary the person likes ('en' 原音, 'zh' 中文): their channels sort by it.
let prefer = () => 'en';
export const audioPref = fn => (prefer = fn);
// Everything a game is on: { zh, en, short, svc, url, app?, ch?, at?, audio?,
// adFree?, exact?, note? }, the channels that suit the person best first.
export const tvOf = e => {
  if (!e) return [];
  // (Asked again only if what it's worked from changed in between.)
  const memo = now().tv;
  const from = [eltaSchedule(), nbaSchedule(), prefer(), packOf(e)?.apple];
  const had = memo.get(e);
  if (had && had.from.every((x, i) => x === from[i])) return had.found;
  const found = tvOfNow(e);
  memo.set(e, { from, found });
  return found;
};
const tvOfNow = e => {
  const nba = e.league === 'nba' ? { games: nbaSchedule(), ids: { home: nbaId(e.home), away: nbaId(e.away) } } : null;
  const list = broadcastsFor(e, eltaSchedule(), { sides: zhSides(e), others: knownNow(), prefer: prefer(), nba, sidesOf: zhSides });
  // Apple TV's page of this very game (Shared-Data's pack, watch.mjs): the
  // TV app opens at the game, live and after (the channel's page left the
  // person to find it).
  const apple = packOf(e)?.apple;
  return apple ? list.map(b => (b.svc === 'appletv' ? { ...b, url: apple, game: true } : b)) : list;
};
// A game whose hour isn't set yet, placed at ELTA's (its program of the game,
// once listed): ELTA's slot is its own booking, not the league's time, so
// the game still says 待定 (`timeFrom: 'elta'`: the slot shown beside it).
// Else the game as it is.
// (`list`: the games read with it, the day's others.)
export const eltaTime = (e, list = []) => {
  const at = e?.timeTbd ? eltaStart(eltaSchedule(), e, zhSides(e), [...list, ...knownNow()].filter((o, i, all) => all.findIndex(x => x.league === o.league && x.id === o.id) === i)) : null;
  return at ? { ...e, start: new Date(at).toISOString(), timeFrom: 'elta' } : e;
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
// ELTA's list couldn't be read (and none kept): which games are on isn't
// known, so none is left out for not being on.
export const tvUnread = () => eltaSchedule.failed;
// The last day ELTA's list covers ('YYYY-MM-DD', Taiwan's), or null: past it
// only the NBA's (NBA.com) and MLS's games can be known to be on.
export const tvUntil = () => eltaDays(eltaSchedule() || [])?.to || null;
// Whether it's known if a game is on TV: MLS and F1 always (Apple TV's
// every game, ELTA's every session), the NBA once NBA.com's list is in, the
// rest within ELTA's list.
export const tvKnown = e =>
  e.league === 'mls' ||
  e.league === 'f1' || (e.league === 'nba' && Boolean(nbaSchedule()?.length)) || eltaListed(eltaSchedule() || [], e);

// Who a game's 球員視角 follows (`b`: its channel): ELTA's listing when it
// names him, else its video of that view on ELTA.tv once up ("…(Joao Pedro
// 球員特寫視角)"); '' while neither says (asked again after half an hour).
const camKnown = new Map();
export const camKnownOf = (e, b) => camPlayer(b?.title) || camKnown.get(`${e.league}:${e.id}`)?.name || '';
export async function camPlayerOf(e, b, now = Date.now()) {
  const said = camKnownOf(e, b);
  if (said) return said;
  const key = `${e.league}:${e.id}`;
  const had = camKnown.get(key);
  if (had && now - had.at < 30 * 60_000) return had.name;
  camKnown.set(key, { name: '', at: now });
  await eltaPagesReady();
  const sides = zhSides(e);
  let name = '';
  for (const v of eltaVodsOf(e, sides[0])) {
    const episodes = await proxyJson(eltaVodUrl(v), { ttl: 30 * 60_000 })
      .then(d => d?.episodes || [])
      .catch(() => []);
    name = camPlayer(eltaEpisode(episodes, e, sides, { cam: true })?.title);
    if (name) break;
  }
  camKnown.set(key, { name, at: now });
  return name;
}

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
  // Apple TV keeps every MLS game whole.
  if (channelsOf(e).some(b => b.svc === 'appletv')) return { video: true, apple: true };
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
  // (Shared-Data's archive first: a game it found on ELTA.tv is never said
  // to be missing because the list didn't name it.)
  if (!channels.length && programs.some(p => p.start <= Date.parse(e.start) - 3 * 3_600_000) && eltaListed(programs, e)) {
    await loadWatchMonth(e, packJson, now);
    if (!packOf(e)?.elta) return null;
  }
  const sides = zhSides(e);
  // Shared-Data's: the game's episodes on ELTA.tv, found for its season
  // (its month's file read for a game the recent pack has let go); else
  // the season's page, its newest 120, read here.
  await Promise.all([replay ? null : loadWatchMonth(e, packJson, now), eltaPagesReady()]);
  const kept = packOf(e)?.elta;
  // Its season's page (CPBL's: its home club's, then the playoffs' and warm-ups'), the first with its episode.
  const vods = kept?.v ? [kept.v] : eltaVodsOf(e, sides[0]);
  if (!vods.length) return replay ? { channels } : null;
  let vod = vods[0];
  let episode = null;
  for (const v of vods) {
    const episodes = kept?.eps?.length
      ? kept.eps.map(([id, title]) => ({ id: String(id), title }))
      : await proxyJson(eltaVodUrl(v), { ttl: 30 * 60_000 })
          .then(d => d?.episodes || [])
          .catch(() => []);
    episode = e.kind === 'match' ? eltaEpisode(episodes, e, sides, { prefer: prefer() }) : eltaSessionEpisode(episodes, e, { prefer: prefer() });
    if (episode) {
      vod = v;
      break;
    }
  }
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
