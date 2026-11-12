// Orbit Sports (was Orbit Sports): an Orbit app, one of the everyday
// tools, signed in with the Orbit Pass. Every supported sport's scores, schedules, match details (box
// scores, plays, line-ups, win probability), standings, teams and players,
// and a day planned around what the person follows, for the leagues on
// ELTA.tv and Apple TV in Taiwan, with a tap to watch them there. The data is
// ESPN's (CPBL's own site for its games), read through the
// Orbit data proxy (lib/espn.mjs).
//
// What the person follows lives on the pass (this app's payload): leagues in
// their order of priority, teams and F1's drivers and teams. Nothing of it goes to the other
// apps; their activity doesn't steer the picks here either.
import { onScreen, screenFit, orbitSession, tabBar, topActions, installGate, watchUpdates, recordAffinity, affinity, affinityPatch, settingPatch, setting, watchFit, notify, cachedPayload, cachedWallet, readJson, writeJson, writeStore, restorePlace, schedulePush, translate, proxyJson, packJson, dev, everyDev, keepOffline, onlineOnly, netState } from '#kit/orbit.mjs';
import { stripDays, chosenOf, sportBack, sportDay, tvDayHas } from './lib/strip.mjs';
import { fold } from './lib/text.mjs';
import { boundsOf, unionBounds, within, clampDay, playsWithin } from './lib/bounds.mjs';
import * as kitUI from '#kit/ui.mjs';
// (A namespace: a phone on an older kit has no finalWords, its notice then the old words.)
import * as kitEspn from '#kit/sports-espn.mjs';
import { transition, pickFinals, gameHash, readGameHash } from './lib/notice.mjs';
import { gameKey, matchOnly, endedFollows } from './lib/follows.mjs';
import { freshGame, sessionStatus, settleSeries, fixTime, fixTimes, summary, finalBox, sessionName, weekOf, localSide, fallbackLogo, scoreboard, standings, savedStandings, teamSchedule, seasonCalendar, seasonInfo, monthsBetween, yyyymmdd, settleField, seasonEvents, splitWeekend, feedStatus, dueToStart, usDayOf, onAir, asiaEvents, cpblPack, cpblSeeds, leagueForm, outcome, sideScore, sidesFor, athlete, athleteOverview, driverSeason, playerHome, europeanClubs, clubOfPlayer, roundLabel, leagueLeaders, leaderList, cupBadges, leagueTeamStats, fotmobTeamList, SESSION_NAMES } from './lib/espn.mjs';
import { hasLeaders, fotmobClubRows } from './lib/leaders.mjs';
import { sideWords } from '#kit/sports-highlights.mjs';
import { statName, injuryZh } from './lib/statnames.mjs';
import { eltaChannel, hasAudio, channelRank } from './lib/broadcast.mjs';
import { findLeagues, parseSearch, placeTeams, placePlayers } from './lib/search.mjs';
import { setWatchPack, prefetchHighlights, watchMonthWanted, watchMonthPath, loadWatchMonth } from './lib/highlights.mjs';
import { LEAGUES, SPORTS, leagueName, leaguesOf, hasStandings, hasTeams, byStakes, bySeason, seasonState } from './lib/leagues.mjs';
import { familyOfSport } from '#kit/catalog.mjs';
import { detectLocale, makeT } from './lib/i18n.mjs';
import { eventKeys, teamKey, leagueKey } from './lib/foryou.mjs';
import { standingsRace, SEASON_GAMES, COUNTS } from './lib/title.mjs';
import { homeGames } from './lib/home-shown.mjs';
import { dayPlan, worth, tableIndex, SHORTEST, scoreMatch, bigGame, tableStarted, watchedLeagues, leagueChoices, HABIT } from './lib/picks.mjs';
import { liveTiming, settleScoring, askFinishes, weekendCircuit } from './lib/f1.mjs';
import { playoffModel, openRound, FORMATS, seedPicture, PICTURE_COLOR, unlGroupColumn } from './lib/playoffs.mjs';
import { nbaCupRound, nbaCupGroups, isGroupPlay, cupQuarters, cupGroupColumn, cupNote } from './lib/nbacup.mjs';
import { stageOf } from './lib/stage.mjs';
import { undecided } from './lib/bracket.mjs';
import { nearestDay, dayReads, dayUnknown, tableSays } from './lib/days.mjs';
import { retrier } from './lib/retry.mjs';
import { onTvChange, tvOf, knownEvents, eltaSchedule, audioPref, onTv, tvReady, tvUntil, tvKnown, tvUnread, channelsOf, nbaAfterList, replayHint, eltaTime } from './lib/tv.mjs';
import { cols, homeBoard, balanced, ctx, sidesOf, el, shownStart, timeText, bestOf, put, spinner, skeleton, empty, $, localDate, today, addDays, clock, dayLabel, whenOf, eventRow, sheet, section, moreButton, goBar, moreToggle, logo, leagueMark, segmented, sideLogo, fillF1Brief, f1Live, watchLink, withWatch, watchButton, scoreText, statusText, breakTick, raceFlag, audioName, guessTag, personPic, refreshBadges } from './ui.js';
import { followButton, gameRecap, openMatch, openFieldEvent, openTie, openTeam, openPlayer, openConstructor, constructorBadge, standingsTables, zhLater, leagueLeadersView, teamStatsView, tableNow } from './sheets.js';
import { f1Driver, f1Constructor, teamLogo } from '#kit/logos.mjs';
import { teamsByZh, teamNameZh } from '#kit/names.mjs';
import { icon, pageHead, heroGame, scoreCard, sportTile, leagueTile } from './cards.js';
// Orbit's own look (Jay 2026-11-03, RULEBOOK §3; index.html's data-look and look.css): the lead game's clubs on their own colours, 我的球隊.
import * as look from './look.js';
import { testDay, dayTested } from './testing.mjs';

// Shared-Data's pack of recent games (set as the app starts, below), and the
// background look-ups of what it hasn't got, after it's in.
let watchPack = null;
const prefetchVideos = events => void (watchPack || Promise.resolve()).then(() => prefetchHighlights(events, proxyJson));

// ---- What's on: leagues with games from two weeks back to two months on ---------------
//
// A league out of season (or a tournament not being played, the Nations
// League between editions) is hidden, and a sport with none left with it. Checked
// once and kept on the device for 12 hours.
const ACTIVE_KEY = 'fx.active.v2';
let activeSet = (() => {
  try {
    const x = JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null');
    return x && Date.now() - x.at < 12 * 3_600_000 && Array.isArray(x.keys) ? new Set(x.keys) : null;
  } catch {
    return null;
  }
})();
const isActive = k => !activeSet || activeSet.has(k);
const isActiveSport = sp => shownLeaguesOf(sp).length > 0;
const shownLeaguesOf = sport => leaguesOf(sport).filter(isActive);
const shownSports = () => Object.keys(SPORTS).filter(sp => shownLeaguesOf(sp).length);
async function leagueHasGames(k, from, to) {
  const l = LEAGUES[k];
  // Shared-Data's game days first (sports/<league>/days.json, a few hundred
  // bytes, the same read 首頁 and 賽事 make): ESPN's pages only for a league
  // without them. (Each league's scoreboard and a cup's four month pages
  // were read for this: 280 KB of a first open on a phone's link, the UEFA
  // cups' months in with the first screen's reads, 2026-11-05.)
  if (l.espn) {
    const days = await packJson(`sports/${k}/days.json`, { ttl: 12 * 3_600_000 }).then(d => d?.days, () => null);
    const known = playsWithin(days, localDate(from), localDate(to));
    if (known != null) return known;
  }
  const near = list => list.some(e => {
    const t = Date.parse(e.start);
    return t >= from && t <= to;
  });
  if (l.espn && l.kind === 'match') {
    const cal = await seasonCalendar(k).catch(() => null);
    const us = d => Date.parse(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T12:00:00Z`);
    if (cal?.days) return cal.days.some(d => us(d) >= from && us(d) <= to);
    return near(await scoreboard(k, monthsBetween(from, to)));
  }
  return near(await seasonEvents(k));
}
async function checkActive() {
  if (activeSet) return;
  const now = Date.now();
  const from = now - 14 * 86_400_000;
  const to = now + 60 * 86_400_000;
  const keys = Object.keys(LEAGUES);
  // A league that couldn't be read is shown (never hidden for a failed read),
  // and only a check with every league read is kept on the device.
  let unread = 0;
  const on = await Promise.all(keys.map(k => leagueHasGames(k, from, to).catch(() => (unread++, true))));
  activeSet = new Set(keys.filter((k, i) => on[i]));
  try {
    if (!unread) localStorage.setItem(ACTIVE_KEY, JSON.stringify({ at: now, keys: [...activeSet] }));
  } catch {}
  if (state.tab === 'matches') renderScores();
  if (state.tab === 'home') renderHome();
}

const locale = detectLocale();
const t = makeT(locale);
const L = obj => (locale === 'en' ? obj.en : obj.zh);
document.documentElement.lang = locale === 'zh' ? 'zh-Hant' : 'en';
const TABS = ['home', 'matches', 'live', 'following'];

const state = {
  tab: 'home',
  prefs: { leagues: [], follows: [], games: [], audio: 'en', fill: false, quiet: null },
  prefsLoaded: false,
  wallet: null,
  // The days read so far: date -> { events, at, loading }.
  days: new Map(),
  live: { date: null },
  home: { date: today(), filter: 'all', shown: 20, teams: new Map(), tables: {}, sportDays: new Map(), autoDay: true, tablesPending: 0, settled: false },
  // 賽事 opens on 全部 (every league's games of a day), the leagues after it.
  scores: { sport: null, league: 'all', date: null, byDay: null, days: [], extra: 0, loading: false, mode: 'days', stage: 'all', view: 'games' },
};

const q = orbitSession('match', { lang: locale });
Object.assign(ctx, { t, locale, state, q, openEvent, openTeam, openPlayer, openLeague, isFollowed, toggleFollow, track, isFollowedEvent, isFollowedGame, toggleFollowGame, weekendCard });

// ---- What the person follows (on the pass) ---------------------------------------------

// `leagues`: the person's leagues, in their order (the first counts most).
// `payload`: the saved string, null when the pass read says nothing is saved
// (a newcomer), undefined when nothing was read (offline, the Worker down, a
// sign-in handed over): then what's on screen stays and prefsLoaded doesn't
// turn on, so nobody is welcomed as new because a read failed.
// A copy is kept on the device too (with its time), and the pass's
// follows:match has the leagues: when the pass's own copy comes back with
// none, or older than the device's (a save that never reached it), the
// device's (else follows:match's leagues) stands and is saved again. Someone
// who has picked their sports isn't welcomed as new because a save was lost.
const LOCAL_PREFS = 'fx.prefs';
// (Its account's only: another pass signed in here starts from its own.)
const localPrefs = () => {
  try {
    const kept = JSON.parse(localStorage.getItem(LOCAL_PREFS) || 'null');
    return kept && q.pass && kept.a === q.pass ? JSON.parse(kept.p) : null;
  } catch {
    return null;
  }
};
const keepLocalPrefs = payload => {
  try {
    if (q.pass) localStorage.setItem(LOCAL_PREFS, JSON.stringify({ a: q.pass, p: payload }));
  } catch {}
};
function applyPrefs(payload) {
  if (payload === undefined) return;
  let p = null;
  try {
    p = payload ? JSON.parse(payload) : null;
  } catch {
    return;
  }
  const local = localPrefs();
  const passed = setting(state.wallet, 'follows:match', null)?.leagues?.filter(k => LEAGUES[k]) || [];
  let restored = false;
  if (local?.leagues?.some(k => LEAGUES[k]) && (!p || (local.t || 0) > (p.t || 0))) {
    p = local;
    restored = true;
  } else if (!p?.leagues?.some(k => LEAGUES[k]) && passed.length) {
    p = { ...(p || {}), leagues: passed };
    restored = true;
  } else if (payload) keepLocalPrefs(payload);
  if (p) state.prefs = { leagues: (p.leagues || []).filter(k => LEAGUES[k]), follows: p.follows || [], games: p.games || [], audio: p.audio === 'zh' ? 'zh' : 'en', fill: p.fill === true, quiet: quietOf(p.quiet) };
  // Only the leagues Orbit Sports has; an NBA team with NBA.com's logo, as everywhere.
  state.prefs.games = keptGames(state.prefs.games);
  state.prefs.follows = state.prefs.follows.filter(f => LEAGUES[f.league]).map(f => (f.league === 'nba' && !f.athlete ? { ...f, logo: teamLogo('nba', f.name) } : f));
  state.prefsLoaded = true;
  // Leagues in: not a newcomer, whatever was shown before they came.
  if (state.prefs.leagues.length) state.home.picking = false;
  if (restored) savePrefs();
  tellFollows();
}
// The follows from the pass when they couldn't be read at the start: the
// start's reply when it has them, else a read of its own. Changes made in
// the meantime are laid over what the pass has (not written over it).
let prefsReading = null;
function readPrefs(first) {
  if (state.prefsLoaded) return Promise.resolve();
  if (typeof first?.payload === 'string') return Promise.resolve(gotPrefs(first.payload));
  if (!first?.offline && !q.pass) return Promise.resolve();
  return (prefsReading ||= q
    .read({ data: true })
    .then(r => gotPrefs(typeof r?.payload === 'string' ? r.payload : undefined))
    .catch(() => {})
    .finally(() => (prefsReading = null)));
}
function gotPrefs(payload) {
  if (state.prefsLoaded) return;
  const local = state.prefs;
  applyPrefs(payload);
  if (!state.prefsLoaded) return;
  if (prefsEdited) {
    const p = state.prefs;
    const key = f => `${f.league}:${f.id}`;
    p.leagues = [...new Set([...p.leagues, ...local.leagues])];
    p.follows = [...p.follows, ...local.follows.filter(f => !p.follows.some(g => key(g) === key(f)))];
    p.games = keptGames([...p.games, ...local.games.filter(g => !p.games.some(h => key(h) === key(g)))]);
    prefsEdited = false;
    savePrefs();
  }
  state.home.picking = false;
  if (!booted) return;
  state.days.clear();
  showTab(state.tab);
}
let booted = false;
let prefsEdited = false;
// The sports of the person's leagues, in the leagues' order.
const followedSports = () => [...new Set(state.prefs.leagues.map(k => LEAGUES[k].sport))];
let saveTimer = 0;
function savePrefs() {
  // Not read yet: kept here, and laid over the pass's copy once it's read.
  if (!state.prefsLoaded) {
    prefsEdited = true;
    readPrefs({ offline: true });
    return;
  }
  clearTimeout(saveTimer);
  const { leagues, follows, games, audio, fill, quiet } = state.prefs;
  saveTimer = setTimeout(() => {
    const payload = JSON.stringify({ v: 4, leagues, follows, games: keptGames(games), audio, ...(fill ? { fill: true } : {}), ...(quiet ? { quiet } : {}), t: Date.now() });
    keepLocalPrefs(payload);
    tellFollows();
    // Not saved (another app live on the pass, offline): again when this one is live.
    savePending = true;
    q.write({ payload, wallet: followsPatch() })
      .then(() => (savePending = false))
      .catch(() => {});
  }, 800);
}
let savePending = false;
// The family's notebook (kit family.mjs): the teams and players followed,
// in English and Chinese, for Orbit News' 你關心的先看. Names only.
let toldFollows = '';
function tellFollows() {
  const follows = state.prefs.follows.slice(0, 60).map(f => {
    const zh = f.athlete ? null : teamNameZh(f.league, f.name, LEAGUES[f.league]?.sport || '');
    return { league: f.league, id: f.id, name: f.name, ...(zh ? { zh: zh.full, short: zh.short } : {}), ...(f.athlete ? { athlete: true } : {}) };
  });
  const key = JSON.stringify(follows);
  if (key === toldFollows) return;
  toldFollows = key;
  import('#kit/family.mjs').then(f => f.tell?.('sports', 'follows', follows)).catch(() => {});
}
// What the person follows and opens, on the pass too (`follows:match`,
// `aff:match`): apps on a phone's home screen don't share storage. Leagues in order; teams as [league, name].
const followsValue = () => ({
  leagues: state.prefs.leagues.slice(0, 30),
  teams: state.prefs.follows
    .filter(f => f.f1team !== true)
    .map(f => [f.league, f.athlete ? f.team?.name || '' : f.name])
    .filter(x => x[1])
    .slice(0, 60)
});
const followsPatch = () => ({ settings: { ...settingPatch('follows:match', followsValue()).settings, ...affinityPatch('match').settings } });
// Once a session (and whenever the follows differ from the pass's copy).
function syncFollows() {
  if (!state.prefsLoaded) return;
  const had = setting(state.wallet, 'follows:match', null);
  if (JSON.stringify(had) === JSON.stringify(followsValue()) && sessionStorage.getItem('fx.followsSynced')) return;
  q.write({ wallet: followsPatch() })
    .then(() => sessionStorage.setItem('fx.followsSynced', '1'))
    .catch(() => {});
}
// A followed team's name as shown (kept in English on the pass).
// A followed player's name in English, as he's known.
const personName = f => shownName(f);
const shownName = f => (f.athlete ? f.name : f.f1team === true ? (locale === 'en' ? f.name : f1Constructor(f.name).zh || f.name) : localSide(f.league, { name: f.name }).name);
function isFollowed(league, id) {
  return state.prefs.follows.some(f => f.league === league && f.id === id);
}
// The teams whose games the person follows: the followed teams, and a
// followed player's team.
const followedTeams = () => state.prefs.follows.flatMap(f => (f.f1team === true ? [] : !f.athlete ? [f] : f.team ? [{ league: f.league, id: f.team.id, name: f.team.name }] : []));
// Single matches followed on their own (a game between two teams the person
// doesn't follow): kept as they were when followed, the live copy laid over
// them (freshGame), and let go once over (dropEnded), at most two days after the start.
const GAME_KEEP = 2 * 86_400_000;
const keptGames = list => (list || []).filter(g => g && LEAGUES[g.league] && g.id && Date.parse(g.start) > Date.now() - GAME_KEEP);
const slimSide = x => (x ? { id: String(x.id ?? ''), name: x.name, short: x.short, en: x.en, abbr: x.abbr, logo: x.logo, color: x.color, alt: x.alt } : x);
function isFollowedGame(e) {
  return Boolean(e) && state.prefs.games.some(g => gameKey(g) === gameKey(e));
}
function toggleFollowGame(e) {
  const p = state.prefs;
  if (isFollowedGame(e)) p.games = p.games.filter(g => gameKey(g) !== gameKey(e));
  else {
    // A race weekend: kept until two days after its last session.
    const last = e.kind === 'field' ? [...(e.sessions || [])].map(x => x.start).filter(Boolean).sort().at(-1) || e.end || e.start : e.start;
    p.games = [
      ...keptGames(p.games),
      e.kind === 'field'
        ? { league: e.league, id: e.weekend || e.id, kind: 'field', name: e.name, start: last, venue: e.venue, country: e.country, status: { state: 'pre' } }
        : { league: e.league, id: e.id, kind: e.kind, name: e.name, start: e.start, status: { state: 'pre' }, away: slimSide(e.away), home: slimSide(e.home), ...(e.other ? { other: e.other } : {}) }
    ];
    // Its sides count; its league only a little (one game followed isn't
    // the league).
    recordAffinity('match', [e.away, e.home].filter(Boolean).map(x => teamKey(e.league, x.en || x.name)), 2);
    recordAffinity('match', [`league:${leagueKey(e.league)}`], 0.5);
  }
  changed();
  // Its notices now (a race weekend's sessions read from the season first).
  if (e.kind === 'field') f1Races();
  clearTimeout(pushTimer);
  pushTimer = setTimeout(syncPush, 1500);
}
// The followed matches, each its newest copy (today's board, else the one read for 追蹤).
// What 追蹤的比賽 says it'll tell: a match's start and final; a race weekend's qualifying, sprint and race.
function gamesNote(list) {
  const races = list.some(e => e.kind === 'field');
  const matches = list.some(e => e.kind !== 'field');
  if (races && matches) return L({ zh: '比賽開始和結果都會通知你（賽車：排位、衝刺、正賽）', en: 'Told when each starts and ends (races: qualifying, sprint, race)' });
  if (races) return L({ zh: '排位賽、衝刺賽、正賽開始和結果都會通知你', en: 'Told when qualifying, the sprint and the race start, and the results' });
  return L({ zh: '開賽和終場比分都會通知你', en: 'Told when it starts and the final score' });
}
// A followed race weekend: its sessions still to come (all of them over: the race).
const followedGames = () => {
  const day = new Map(dayAll(state.days.get(today())).filter(e => e.kind === 'match').map(e => [gameKey(e), e]));
  const now = Date.now();
  return keptGames(state.prefs.games).flatMap(g => {
    if (g.kind !== 'field') return [freshGame(day.get(gameKey(g)) || gameSeen.get(gameKey(g)) || g)];
    const w = f1Races().find(x => x.league === g.league && x.id === g.id);
    if (!w) return [];
    const sessions = splitWeekend(w, now, locale).filter(x => x.sessionKey);
    // The next session and the race (one row when they're the same), not the whole weekend.
    const left = sessions.filter(x => x.status.state !== 'post');
    const race = sessions.filter(x => x.sessionKey === 'Race');
    return left.length ? [...new Set([left[0], ...race])] : race;
  });
};
// Each followed match's own day read once (its score when it's over or on).
const gameSeen = new Map();
const gameDaysRead = new Set();
function loadFollowedGames() {
  const want = new Map();
  for (const g of keptGames(state.prefs.games)) {
    if (g.kind === 'field') continue;
    if (Date.parse(g.start) > Date.now() + 3_600_000 || gameSeen.get(gameKey(g))?.status?.state === 'post') continue;
    // ESPN's day is the US one: the start's UTC date, and five hours earlier's.
    for (const h of [0, 5]) {
      const d = new Date(Date.parse(g.start) - h * 3_600_000).toISOString().slice(0, 10).replaceAll('-', '');
      want.set(`${g.league}:${d}`, [g.league, d]);
    }
  }
  const asks = [...want].filter(([k]) => !gameDaysRead.has(k));
  if (!asks.length) return;
  for (const [k] of asks) gameDaysRead.add(k);
  Promise.all(asks.map(([k, [league, d]]) => scoreboard(league, [d]).catch(() => (gameDaysRead.delete(k), []))))
    .then(lists => {
      let got = false;
      for (const e of lists.flat()) if (isFollowedGame(e)) (gameSeen.set(gameKey(e), e), (got = true));
      if (got && state.tab === 'following') renderFollowing();
    })
    .catch(() => {});
}
// A game that's on again (live, or about to be): its day read again next time.
setInterval(() => {
  for (const g of followedGames()) if (g.status.state === 'in' || (g.status.state === 'pre' && Date.parse(g.start) < Date.now())) gameDaysRead.clear();
  dropEnded();
}, 60_000);
// A followed match over is let go once its final's been told (follows.mjs
// endedFollows), saved without reading the day again: its league's other
// games, read for it, stay in the day but are no one's (matchOnly).
const endSeen = new Map();
function dropEnded() {
  const p = state.prefs;
  if (!state.prefsLoaded || !p.games.length) return;
  const day = new Map(dayAll(state.days.get(today())).filter(e => e.kind === 'match').map(e => [gameKey(e), e]));
  const fresh = g => {
    if (g.kind !== 'field') return freshGame(day.get(gameKey(g)) || gameSeen.get(gameKey(g)) || g);
    // A race weekend: over with its race.
    const w = f1Races().find(x => x.league === g.league && x.id === g.id);
    return w ? splitWeekend(w, Date.now(), locale).find(x => x.sessionKey === 'Race') || null : null;
  };
  const gone = endedFollows(keptGames(p.games), { fresh, told: bannered, seen: endSeen });
  if (!gone.size) return;
  p.games = p.games.filter(g => !gone.has(gameKey(g)));
  savePrefs();
  // (The days stay as read: a superset of what's needed now, not a reason to read them again.)
  for (const slot of state.days.values()) if (slot.at) slot.leagues = leaguesKey();
  if (state.tab === 'following') renderFollowing();
  else if (state.tab === 'home') renderHome();
  clearTimeout(pushTimer);
  pushTimer = setTimeout(syncPush, 1500);
}
// Leagues followed as a league (no team or player of them followed): each
// slot's chosen game is the person's as a followed team's is (picks.mjs
// leagueChoices; Jay 2026-10-23), and a race weekend's qualifying, sprint
// and race.
const watched = () => watchedLeagues(state.prefs.leagues, state.prefs.follows);
let tvGen = 0;
const chosenMemo = { key: '', set: new Set() };
// Each slot's choice as it stood before its games began (picks.mjs leagueChoices `kept`), kept
// on the device three weeks: { 'league:id': ['league:id' chosen, ms of its start] }.
const CHOSEN_KEY = 'fx.chosen.v1';
const keptChoices = (() => {
  let map = null;
  let timer = 0;
  const load = () => {
    if (map) return map;
    const old = Date.now() - 21 * 86_400_000;
    map = new Map(Object.entries(readJson(CHOSEN_KEY, {}) || {}).filter(([, v]) => Array.isArray(v) && v[1] > old));
    return map;
  };
  const save = () => {
    clearTimeout(timer);
    timer = setTimeout(() => writeJson(CHOSEN_KEY, Object.fromEntries(map)), 500);
  };
  return {
    get: k => load().get(k)?.[0] || null,
    set: (k, chosen, at = Date.now()) => {
      const had = load().get(k);
      if (had?.[0] === chosen) return;
      map.set(k, [chosen, at]);
      save();
    }
  };
})();
// Each league's playoff map read (季後賽, a series sheet): every playoff game in it.
const brackets = new Map();
function chosenGames() {
  const w = watched();
  if (!w.length) return new Set();
  const slots = [...state.days.values()];
  const key = `${w.join()}|${tvGen}|${tvReady()}|${slots.map(x => `${x.at}:${x.events?.length}`).join()}|${[...brackets.values()].map(b => b.at).join()}|${Object.keys(state.home.tables || {}).join()}`;
  if (chosenMemo.key === key) return chosenMemo.set;
  // The days read, and the playoff games of any map read: a series' games
  // are marked on days not visited yet (all of a playoff day's games are in it).
  const all = [...slots.flatMap(x => x.events || []), ...[...brackets.values()].flatMap(b => b.model?.rounds?.flatMap(r => r.ties.flatMap(t => t?.games || [])) || [])];
  const ctx = { leagues: state.prefs.leagues, follows: state.prefs.follows, tables: state.home.tables, featured: featuredIn(all), ...theirs(Date.now()) };
  chosenMemo.key = key;
  const byKey = new Map(all.map(e => [`${e.league}:${e.id}`, e]));
  const kept = { get: keptChoices.get, set: (k, chosen) => keptChoices.set(k, chosen, Date.parse(byKey.get(k)?.start) || Date.now()) };
  chosenMemo.set = leagueChoices(all, { watched: w, onTv, tvKnown, awake: e => !asleep(officialMs(e)), ctx, kept });
  return chosenMemo.set;
}
const isChosenGame = e => e.kind === 'match' && chosenGames().has(`${e.league}:${e.id}`);
// (`chosen` false: a followed team's, player's or match's only.)
function isFollowedEvent(e, { chosen = true } = {}) {
  if (isFollowedGame(e)) return true;
  if (e.kind === 'match') return followedTeams().some(f => f.league === e.league && (f.id === e.home?.id || f.id === e.away?.id)) || (chosen && isChosenGame(e));
  // (Not one in the small hours: a 04:00 race is among 更多賽事, as a match is.)
  if (chosen && e.sessionKey && ['Qual', 'SR', 'Race'].includes(e.sessionKey) && watched().includes(e.league) && !asleep(officialMs(e))) return true;
  // A race with a followed driver in it.
  const people = (e.sessions || []).flatMap(x => x.field || []);
  if (people.some(p => p && isFollowed(e.league, p.id))) return true;
  // An F1 race with a followed team's car in it.
  const crews = state.prefs.follows.filter(f => f.f1team === true && f.league === e.league).map(f => f.name);
  return crews.length > 0 && people.some(p => p?.name && crews.includes(f1Driver(p.name).team));
}
function toggleFollow(league, side) {
  const p = state.prefs;
  if (isFollowed(league, side.id)) p.follows = p.follows.filter(f => !(f.league === league && f.id === side.id));
  else {
    p.follows = [...p.follows, { league, id: side.id, name: side.en || side.name, logo: side.logo, ...(side.athlete ? { athlete: true } : {}), ...(side.team ? { team: side.team } : {}), ...(side.f1team === true ? { f1team: true } : {}) }];
    // Following a team follows its league too.
    if (!p.leagues.includes(league)) p.leagues = [...p.leagues, league];
    recordAffinity('match', [teamKey(league, side.en || side.name), `league:${leagueKey(league)}`], 4);
  }
  changed();
}
function toggleSport(sport) {
  const p = state.prefs;
  if (p.leagues.some(k => LEAGUES[k].sport === sport)) p.leagues = p.leagues.filter(k => LEAGUES[k].sport !== sport);
  else {
    // Its headline leagues (or its first) to start with.
    const tops = leaguesOf(sport).filter(k => LEAGUES[k].top);
    p.leagues = [...new Set([...p.leagues, ...(tops.length ? tops : leaguesOf(sport).slice(0, 1))])];
    recordAffinity('match', [`sport:${familyOfSport(sport)}`], 3);
  }
  changed();
}
function toggleLeague(league) {
  const p = state.prefs;
  p.leagues = p.leagues.includes(league) ? p.leagues.filter(k => k !== league) : [...p.leagues, league];
  if (p.leagues.includes(league)) recordAffinity('match', [`league:${leagueKey(league)}`], 2);
  changed();
}
// One end of the quiet hours: its hour, and the phone's own picker over it.
function quietHour(end) {
  const v = quietHours()[end];
  const hh = n => `${String(n).padStart(2, '0')}:00`;
  const label = L(end === 'from' ? { zh: '安靜時段開始', en: 'Quiet from' } : { zh: '安靜時段結束', en: 'Quiet until' });
  const pick = el('select', { 'aria-label': label, onchange: () => {
    state.prefs.quiet = quietOf({ ...quietHours(), [end]: Number(pick.value) });
    shown.textContent = hh(Number(pick.value));
    pickMemo.clear();
    chosenMemo.key = '';
    changed();
  } }, Array.from({ length: 24 }, (_, n) => el('option', { value: n, selected: n === v, text: hh(n) })));
  const shown = el('span', { text: hh(v) });
  return el('label', { class: 'quiet-hour' }, [shown, pick]);
}
function changed() {
  savePrefs();
  state.home.sportDays.clear();
  state.days.clear();
  if (state.tab === 'home' || state.tab === 'live') loadDay(state.tab === 'live' ? today() : state.home.date);
  if (state.tab === 'following') renderFollowing();
}
const OPENED_KEY = 'fx.openedToday';
function firstOpenToday(e) {
  const day = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
  const id = `${e.league}:${e.id}`;
  let had = null;
  try {
    had = JSON.parse(localStorage.getItem(OPENED_KEY) || 'null');
  } catch {}
  const ids = had?.day === day ? had.ids || [] : [];
  if (ids.includes(id)) return false;
  try {
    localStorage.setItem(OPENED_KEY, JSON.stringify({ day, ids: [...ids, id].slice(-200) }));
  } catch {}
  return true;
}
function track(keys = [], weight = 1) {
  if (keys.length) recordAffinity('match', keys, weight);
}
// The leagues the person follows, in their order.
const followedLeagues = () => [...state.prefs.leagues];

// 我的設定 (追蹤's 設定): everything the person picks, in one sheet: a hero
// saying what's followed; their leagues as rows in their order, put in order
// by each row's grip (the kit's reorder, Jay 2026-11-03: no more tap then
// 往後) and let go with its ✕ (復原 in the toast); the rest of the leagues by
// sport, a tap to add; the teams and players followed as rows the same way
// (a tap opens the page); the commentary they like.
function openFollowEditor() {
  const s = sheet(L({ zh: '我的設定', en: 'My settings' }));
  // A one-tap let-go, with 復原 (kit toast) putting it back where it was.
  const letGo = (name, undo) => kitUI.toast(L({ zh: `已取消追蹤${name}`, en: `Unfollowed ${name}` }), { action: { label: L({ zh: '復原', en: 'Undo' }), onTap: () => (undo(), changed(), paint()) } });
  const remove = (label, onTap) => el('button', { class: 'set-x', type: 'button', 'aria-label': label, html: kitUI.icons.x, onclick: onTap });
  const ordered = (rows, onKeys) => {
    const box = el('div', { class: 'q-list set-order' }, rows);
    kitUI.reorder(box, { onChange: keys => (onKeys(keys), changed(), paint()) });
    return box;
  };
  const paint = () => {
    const p = state.prefs;
    const n = p.leagues.length;
    const tile = k => {
      const box = leagueTile(k, () => {});
      box.classList.add('set-league');
      box.prepend(el('span', { class: 'set-badge add', 'aria-hidden': 'true', text: '+' }));
      box.setAttribute('aria-label', L({ zh: `加入${leagueName(k, locale)}`, en: `Add ${leagueName(k, locale)}` }));
      box.onclick = () => (toggleLeague(k), paint());
      return box;
    };
    const leagueRow = k => {
      const name = leagueName(k, locale);
      return el('div', { class: 'q-cell set-row', 'data-q-key': k }, [
        leagueMark(k, 'big'),
        el('span', { class: 'q-cell-text' }, [el('span', { text: name })]),
        remove(L({ zh: `取消追蹤${name}`, en: `Unfollow ${name}` }), () => {
          const at = state.prefs.leagues.indexOf(k);
          toggleLeague(k);
          paint();
          letGo(name, () => !state.prefs.leagues.includes(k) && state.prefs.leagues.splice(at, 0, k));
        }),
        kitUI.grip(L({ zh: `拖曳排序：${name}`, en: `Reorder ${name}` }))
      ]);
    };
    const toAdd = shownSports()
      .map(sp => [sp, shownLeaguesOf(sp).filter(k => !p.leagues.includes(k))])
      .filter(([, ks]) => ks.length);
    const openOne = f => (f.athlete ? openPlayer(f.league, f.id, f) : f.f1team === true ? openConstructor({ id: '', name: f.name, en: f.name }) : openTeam(f.league, f.id, f));
    const followKey = f => `${f.league}:${f.id}`;
    const followRow = f => {
      const name = shownName(f);
      return el('div', { class: 'q-cell set-row', 'data-q-key': followKey(f) }, [
        el('button', { class: 'q-row-open', type: 'button', onclick: () => openOne(f) }, [
          el('span', { class: 'suggest-tile' }, [f.athlete ? personPic(f, f.league, 'sm round') : f.f1team === true ? constructorBadge(f.name, 'sm') : logo(f.logo, f.name, 'sm')]),
          el('span', { class: 'q-cell-text' }, [el('span', { text: name }), el('small', { text: leagueName(f.league, locale) })])
        ]),
        remove(L({ zh: `取消追蹤${name}`, en: `Unfollow ${name}` }), () => {
          const at = state.prefs.follows.findIndex(x => followKey(x) === followKey(f));
          toggleFollow(f.league, f);
          paint();
          letGo(name, () => !isFollowed(f.league, f.id) && state.prefs.follows.splice(at, 0, f));
        }),
        kitUI.grip(L({ zh: `拖曳排序：${name}`, en: `Reorder ${name}` }))
      ]);
    };
    const hint = L({ zh: '按住 ≡ 拖曳排序', en: 'Hold ≡ and drag to reorder' });
    const teams = p.follows.length;
    put(
      s.body,
      el('div', { class: 'q-focus' }, [
        el('div', { class: 'q-focus-label', text: L({ zh: '我的追蹤', en: 'Following' }) }),
        el('div', { class: 'q-focus-value', text: L({ zh: `${n} 個聯賽`, en: `${n} league${n === 1 ? '' : 's'}` }) }),
        teams ? el('div', { class: 'q-focus-sub', text: L({ zh: `${teams} 支球隊與選手`, en: `${teams} teams and players` }) }) : null
      ]),
      section(t('yourLeagues'), n ? ordered(p.leagues.map(leagueRow), keys => (state.prefs.leagues = keys)) : el('p', { class: 'muted small set-empty', text: t('noLeaguesYet') }), { sub: n > 1 ? hint : '' }),
      toAdd.length ? section(L({ zh: '加入聯賽', en: 'Add a league' }), el('div', { class: 'q-card pad set-add' }, toAdd.flatMap(([sp, ks]) => [el('p', { class: 'mini-h', text: L(SPORTS[sp]) }), el('div', { class: 'set-grid' }, ks.map(tile))]))) : null,
      section(
        L({ zh: '球隊與選手', en: 'Teams and players' }),
        teams ? ordered(p.follows.map(followRow), keys => (state.prefs.follows = keys.map(k => state.prefs.follows.find(f => followKey(f) === k)).filter(Boolean))) : el('p', { class: 'muted small set-empty', text: t('teamsHint') }),
        { sub: teams > 1 ? hint : '' }
      ),
      section(
        t('tvAudio'),
        segmented(
          [
            ['en', t('tvAudioEn')],
            ['zh', t('tvAudioZh')]
          ],
          state.prefs.audio || 'en',
          v => {
            state.prefs.audio = v;
            savePrefs();
            if (state.tab === 'home') renderHome();
            paint();
          }
        ),
        { sub: t('tvAudioHint') }
      ),
      // 填滿空檔 (Jay 2026-11-03): off, 我的比賽 is only their own games; on,
      // the hours they leave free are filled with the game of any sport that
      // means most then (picks.mjs worth).
      kitUI.list([
        kitUI.cell({
          title: L({ zh: '填滿空檔', en: 'Fill free time' }),
          sub: L({ zh: '空檔排入各運動好比賽', en: 'Best game of any sport' }),
          trailing: kitUI.toggle({ checked: state.prefs.fill === true, label: L({ zh: '填滿空檔', en: 'Fill free time' }), onChange: on => ((state.prefs.fill = on), savePrefs(), pickMemo.clear(), state.tab === 'home' && renderHome()) })
        }),
        // 安靜時段 (Jay 2026-11-04): their own hours; in them only the teams they follow.
        kitUI.cell({
          title: L({ zh: '安靜時段', en: 'Quiet hours' }),
          sub: L({ zh: '只排追蹤', en: 'Follows only' }),
          trailing: el('span', { class: 'quiet-pick num' }, [quietHour('from'), el('span', { class: 'quiet-dash', text: '–' }), quietHour('to')])
        })
      ])
    );
  };
  paint();
}

// ---- Opening things ------------------------------------------------------------------------

// A game called off (延期, 取消) opens nothing: its page has only a 0-0 and
// the numbers from before (the owner, 2026-10-17: block it); its card and row
// say 延期 and aren't buttons.
function openEvent(e) {
  if (e?.status?.void) return;
  // Counted once a day: one game opened again and again is one game.
  if (firstOpenToday(e)) track(eventKeys(e), 1);
  // What the picks learn from (kit feedback.mjs): opened from 今日推薦, or anywhere else.
  const fromPicks = state.todayPicks?.some(p => p.league === e.league && p.id === e.id);
  feedback?.picked('match', pickItem(e), Date.now(), { from: fromPicks ? 'list' : 'elsewhere' });
  if (e.kind === 'match') return openMatch(e);
  return openFieldEvent(e);
}

// ---- A day's matches, for 推薦 and 直播 --------------------------------------------------

// The leagues the picks come from: the ones followed and the followed
// teams'. Only when none of them plays (or the person follows nothing yet)
// are the others read, the headline ones first.
function pickLeagues() {
  // A followed match's league too, while it's kept: its day is read with the person's own.
  return [...new Set([...followedLeagues(), ...state.prefs.follows.map(f => f.league), ...keptGames(state.prefs.games).map(g => g.league)])].filter(k => LEAGUES[k]);
}
// Which leagues a day was read for: a day read before the follows came in
// (the pass answers after the first read) is read again, never taken for "nothing on".
const leaguesKey = () => pickLeagues().join();
function otherLeagues() {
  const mine = new Set(pickLeagues());
  return Object.keys(LEAGUES)
    .filter(k => !mine.has(k))
    .sort((a, b) => Boolean(LEAGUES[b].top) - Boolean(LEAGUES[a].top));
}
const espnDaysOf = date => {
  const start = new Date(`${date}T00:00:00`).getTime();
  return [...new Set([yyyymmdd(new Date(start - 11 * 3_600_000)), yyyymmdd(new Date(start + 12 * 3_600_000)), yyyymmdd(new Date(start + 23 * 3_600_000))])];
};

// The last day read is kept on the device, so the app opens on it at once.
const DAY_KEY = 'fx.day.v4';
function saveDay(date, slot) {
  try {
    localStorage.setItem(DAY_KEY, JSON.stringify({ date, at: slot.at, events: slot.events.slice(0, 300), leagues: pickLeagues().join() }));
  } catch {}
}
function restoreDay() {
  try {
    const saved = JSON.parse(localStorage.getItem(DAY_KEY) || 'null');
    if (saved?.date === today() && saved.leagues === leaguesKey() && Date.now() - saved.at < 6 * 3_600_000) state.days.set(saved.date, { events: (saved.events || []).filter(e => LEAGUES[e.league]), at: saved.at, loading: false, stale: true, leagues: saved.leagues });
  } catch {}
}

// A day of picks is the hours the person is awake (00:00–05:00 asleep unless they set their own): a game
// starting in their quiet hours (Europe's evenings, America's afternoons)
// is while everyone sleeps, and is never 今日推薦 (nightOnly), only among
// 其他推薦, on its own day at its hour. Every one of the person's own
// leagues is there; of the others, only one worth staying up for
// (nightWorthy: a play-off, a final or a series game, an MLB wild-card
// decider at 02:00). A followed team's or match's can be 今日推薦 (a league
// followed as a league: its small hours' games stay there, or every night's
// 03:00 game would lead the day).
// The quiet hours are the person's own (我的設定 安靜時段, Jay 2026-11-04):
// [from, to) by the hour, over midnight if from > to, none if equal; 00–05 unset.
const QUIET = { from: 0, to: 5 };
function quietOf(q) {
  const ok = n => Number.isInteger(n) && n >= 0 && n < 24;
  return q && ok(q.from) && ok(q.to) && !(q.from === QUIET.from && q.to === QUIET.to) ? { from: q.from, to: q.to } : null;
}
const quietHours = () => state.prefs.quiet || QUIET;
function asleep(ms) {
  const { from, to } = quietHours();
  const h = new Date(ms).getHours();
  return from < to ? h >= from && h < to : from > to ? h >= from || h < to : false;
}
const nightWorthy = e => bigGame(e) || isFollowedEvent(e, { chosen: false });
// A race weekend's practice: in 賽事 and the race's sheet, never among 首頁's picks or days.
const practice = e => /^FP\d$/.test(e.sessionKey || '');
// (A race session by its official start, not its broadcast's titles a few
// minutes before: a 05:00 qualifying titled at 04:56 is a morning pick, not the small hours.)
const officialMs = e => Date.parse(e.official || e.start);
const nightOnly = e => asleep(officialMs(e)) && !isFollowedEvent(e, { chosen: false });
const inDay = (ms, date) => ms >= Date.parse(`${date}T00:00:00`) && ms < Date.parse(`${addDays(date, 1)}T00:00:00`);
const inPickDay = (ms, date) => inDay(ms, date) && !asleep(ms);

// A day's events of these leagues (races split into their sessions).
// `current`: each league's current scoreboard (what's on now) instead of the day's dates.
const rawDays = new Map();
// `night`: every game of the small hours kept (the person's own leagues), not only the big ones.
// `pages`: a live refresh's (livePages): only those leagues, and of a league
// by its ESPN day pages only the pages its games on now are on.
async function readDay(leagues, date, { current = false, night = false, pages = null } = {}) {
  // Only the leagues whose own kept days hold it (home's reach is every
  // league's together: a day of UECL's last season isn't asked of NBA).
  leagues = leagues.filter(k => within(date, leagueBounds(k)) && (!pages || pages.has(k)));
  const dates = espnDaysOf(date);
  const isToday = date === today();
  // A league that couldn't be read is counted, never taken for "no games";
  // one with a page unread too, its games shown (days.mjs dayReads).
  const miss = () => null;
  const results = await Promise.all(
    leagues.map(k => {
      const l = LEAGUES[k];
      const only = pages?.get(k);
      // A race weekend: what's on that day (ESPN's dated page lists the
      // events running then); the other sources' lists are the season's anyway.
      if (l.kind !== 'match') return (isToday ? scoreboard(k) : l.espn ? scoreboard(k, dates) : seasonEvents(k)).catch(miss);
      if (only && l.espn && !only.has('*')) return scoreboard(k, [...only]).catch(miss);
      // Soccer by its dated pages even for what's on now: a cup's current page can be a round long past.
      return scoreboard(k, l.espn && (!current || l.sport === 'soccer') ? dates : undefined).catch(miss);
    })
  );
  const { read, failed, unread } = dayReads(leagues, results);
  if (unread) throw new Error('unread');
  const lists = results.map(list => list || []);
  const now = Date.now();
  const raw = lists
    .flat()
    .flatMap(e => (e.sessions ? splitWeekend(e, now, locale) : [e]))
    .map(e => (e.sessions ? settleField(e, now) : e))
    .map(e => (e.at ? { ...e, start: e.at } : e));
  // Everything read, by the clock (直播 wants the small hours too).
  const kept = rawDays.get(date) || new Map();
  for (const e of raw) kept.set(dayKey(e), e);
  rawDays.set(date, kept);
  // Results are the whole day's: a game in the small hours that's over (or
  // any of a past day's) counts for its day, it just wasn't one to wake up for.
  const past = date < today();
  const out = testDay(raw.filter(e => (isToday && e.status.state === 'in') || inPickDay(officialMs(e), date) || (inDay(Date.parse(e.start), date) && (night || nightWorthy(e))) || ((past || e.status.state === 'post') && inDay(Date.parse(e.start), date)) || (!e.sessionKey && e.kind !== 'match' && e.status.state !== 'post' && e.end && Date.parse(e.start) <= Date.parse(`${date}T23:59:59`) && Date.parse(e.end) >= Date.parse(`${date}T00:00:00`))), isToday);
  out.failed = failed;
  out.read = read;
  return out;
}
// What a live refresh reads of a day held: each league with a game on or due
// to start, and the ESPN day pages those games are on ('*': the league's
// whole read, as for a race series, an Asian league, or a game kept from
// before its page was known).
function livePages(events) {
  const pages = new Map();
  for (const e of events || []) {
    if (!(e.status?.state === 'in' || dueToStart(e))) continue;
    if (!pages.has(e.league)) pages.set(e.league, new Set());
    pages.get(e.league).add(e.kind === 'match' && LEAGUES[e.league]?.espn && e.usDay ? e.usDay : '*');
  }
  return pages;
}
// A live refresh's games over the ones held: a game read takes its place; a
// game on a page read and no longer there goes (as a whole read would drop
// it); everything else (another league's, another page's, a league that
// failed this time) stays as it was.
const dayKey = e => `${e.league}:${e.id}:${e.sessionKey || ''}`;
function overHeld(held, fresh, pages) {
  const byKey = new Map(fresh.map(e => [dayKey(e), e]));
  const reread = e => fresh.read?.has(e.league) && (pages.get(e.league)?.has('*') || pages.get(e.league)?.has(e.usDay));
  const out = [];
  for (const e of held || []) {
    const k = dayKey(e);
    if (byKey.has(k)) out.push(byKey.get(k)), byKey.delete(k);
    else if (!reread(e)) out.push(e);
  }
  return Object.assign([...out, ...byKey.values()], { failed: fresh.failed, read: fresh.read });
}
// A full-height sheet open (a game's, a team's, a player's): what's under it
// isn't read or drawn again every few seconds (nobody sees it); the day is
// drawn and read again once the sheet closes.
const sheetOver = () => document.querySelector('dialog.q-full[open]');
const heldDays = new Set();
document.addEventListener(
  'close',
  ev => {
    if (!ev.target?.classList?.contains('q-full')) return;
    setTimeout(() => {
      if (sheetOver()) return;
      const days = [...heldDays];
      heldDays.clear();
      days.forEach(repaintDay);
      liveTick();
    }, 0);
  },
  true
);
function repaintDay(date) {
  renderTabs();
  if (sheetOver()) return void heldDays.add(date);
  if (state.tab === 'home' && state.home.date === date) renderHome();
  if (state.tab === 'live' && (date === today() || date === addDays(today(), 1) || date === state.live.date)) renderLive();
  if (allShown(date)) renderScores();
}
// `live`: only the pages of the games on now or due to start (livePages),
// over the day held; a whole read (fullAt) every two minutes in any case.
async function loadDay(date, { live = false } = {}) {
  const slot = state.days.get(date) || { events: [], at: 0, loading: false };
  if (slot.loading) return;
  if (live && !slot.fullAt) live = false;
  // Marked as being read at once, before anything's awaited: a second ask in
  // the same moment doesn't read it twice, and 全部 and 轉播 ask the other
  // leagues alongside it (they waited for it before: a day there was two reads long).
  slot.loading = true;
  state.days.set(date, slot);
  // A day outside every league's (nothing kept, or next season's before its
  // schedule's in): nothing asked of the proxy.
  await boundsRead;
  if (!within(date, homeBounds())) {
    Object.assign(slot, { events: [], at: Date.now(), stale: false, leagues: leaguesKey(), partial: 0, loading: false });
    return repaintDay(date);
  }
  const isToday = date === today();
  loadTables();
  const key = leaguesKey();
  let retry = false;
  try {
    const pages = live ? livePages(slot.events) : null;
    const events = live ? (pages.size ? overHeld(slot.events, await readDay(pickLeagues(), date, { night: true, pages }), pages) : Object.assign([...slot.events], { failed: 0 })) : await readDay(pickLeagues(), date, { night: true });
    // Some leagues unread: what came is shown (with what was there of the
    // others), and the day is read again shortly.
    const kept = events.failed && !live ? [...events, ...slot.events.filter(e => !events.some(x => x.league === e.league))] : events;
    if (isToday) noticeChanges(kept);
    if (isToday) notePlayoffGames(kept);
    noteCupBadges(kept);
    // The other days held (the nightly copies of the days to come): today's results on top.
    if (isToday) for (const [d, other] of state.days) if (d !== date && other.events?.length) other.events = settleSeries(other.events);
    Object.assign(slot, { events: kept, at: Date.now(), stale: false, leagues: key, partial: events.failed || 0 }, live ? {} : { fullAt: Date.now() });
    if (isToday && !events.failed && !dayTested()) saveDay(date, slot);
    retry = events.failed > 0;
  } catch {
    // Nothing read: the last copy stays, and it's tried again shortly
    // (counted as unread, never as none: at least one).
    Object.assign(slot, { at: slot.at || Date.now(), stale: false, leagues: key, partial: Math.max(1, pickLeagues().length) });
    retry = true;
  } finally {
    slot.loading = false;
  }
  // (A quick read of the live pages that worked says nothing of the whole day's.)
  if (retry || !live) retryLater(`day:${date}`, retry, () => loadDay(date), () => dayWanted(date));
  // The follows changed while reading: read again for them.
  if (key !== leaguesKey()) return loadDay(date);
  // The others (and the rest) again too, once they've been read for this day;
  // today's rest in any case (every league's games on now, for 直播's badge
  // and 首頁's live games), a moment after the first read.
  if (slot.othersAt) loadOthers(date, live);
  if (slot.restAt && (state.tab === 'live' || allShown(date) || Date.now() - slot.restAt > 120_000)) loadRest(date, live && Date.now() - slot.restAt <= 120_000);
  else if (!slot.restAt && isToday && !slot.restLoading) setTimeout(() => !slot.restAt && loadRest(date), 2500);
  loadFollowedTeams();
  repaintDay(date);
  // (Tomorrow's too: its picks' finals go on the Worker's list ahead, pickFinals.)
  if (isToday || date === addDays(today(), 1)) {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(syncPush, 1500);
  }
}
// (`live`: only the pages of their games on now, over the ones held.)
async function loadOthers(date, live = false) {
  const slot = state.days.get(date);
  if (!slot || slot.othersLoading) return;
  const pages = live ? livePages(slot.others) : null;
  if (live && !pages.size) return;
  slot.othersLoading = true;
  try {
    const got = live ? overHeld(slot.others, await readDay(otherLeagues().slice(0, 24), date, { pages }), pages) : await readDay(otherLeagues().slice(0, 24), date);
    slot.others = got;
    if (!live) slot.othersFailed = got.failed || 0;
    if (!live && state.prefs.fill) loadTables(got.map(e => e.league));
  } catch {
    slot.others = slot.others || [];
    // None of them read: unread, never "nothing else on" (dayUnknown).
    if (!live) slot.othersFailed = Math.max(1, otherLeagues().slice(0, 24).length);
  } finally {
    slot.othersLoading = false;
    if (!live) slot.othersAt = Date.now();
  }
  // Some unread: read again shortly (a day of no follows has no day's read to retry with).
  if (!live) retryLater(`others:${date}`, slot.othersFailed > 0, () => loadOthers(date), () => dayWanted(date));
  repaintDay(date);
}
// Every other league, for 直播: what's on now anywhere, not only in the
// followed and televised leagues (the others above). Each one's current
// scoreboard, read once 直播 is open.
function restLeagues() {
  const have = new Set([...pickLeagues(), ...otherLeagues().slice(0, 24)]);
  return Object.keys(LEAGUES).filter(k => !have.has(k));
}
async function loadRest(date, live = false) {
  const slot = state.days.get(date);
  if (!slot || slot.restLoading) return;
  const pages = live ? livePages(slot.rest) : null;
  if (live && !pages.size) return;
  slot.restLoading = true;
  try {
    const got = live ? overHeld(slot.rest, await readDay(restLeagues(), date, { current: true, pages }), pages) : await readDay(restLeagues(), date, { current: true });
    slot.rest = got;
    if (!live) slot.restFailed = got.failed || 0;
  } catch {
    slot.rest = slot.rest || [];
    if (!live) slot.restFailed = Math.max(1, restLeagues().length);
  } finally {
    slot.restLoading = false;
    if (!live) slot.restAt = Date.now();
  }
  if (!live) retryLater(`rest:${date}`, slot.restFailed > 0, () => loadRest(date), () => dayWanted(date));
  repaintDay(date);
}
// A read with something unread, tried again (lib/retry.mjs: backed off to
// once a minute, for as long as it fails; not while the app is out of sight;
// at once back on screen or online), or its retries ended once it's read.
const retries = retrier();
function retryLater(key, failed, again, wanted) {
  if (failed) retries.later(key, again, wanted);
  else retries.done(key);
}
// A day's retries run while it's on screen (首頁's day; 直播's today and tomorrow).
const dayWanted = date => date === today() || date === addDays(today(), 1) || (state.tab === 'home' && state.home.date === date) || (state.tab === 'live' && liveDay() === date) || allShown(date);
let pushTimer = 0;
// The followed leagues' tables, for the picks and 追蹤's places (they come in on their own).
// `also`: more leagues' (填滿空檔's games: what each side still plays for, picks.mjs raceOf).
function loadTables(also = []) {
  [...new Set([...followedLeagues(), ...also])]
    .filter(hasStandings)
    .filter(k => !state.home.tables[k])
    .slice(0, 8)
    .forEach(k => {
      state.home.tables[k] = {};
      state.home.tablesPending++;
      // (Counted in before the repaint: the last table's repaint is the one that settles the picks.)
      standings(k)
        .then(g => {
          state.home.tables[k] = tableIndex(g, k);
          state.home.tablesPending--;
          if (state.tab === 'home' && state.days.get(state.home.date)?.at) renderHome();
          if (state.tab === 'following') renderFollowing();
        })
        .catch(() => state.home.tablesPending--);
    });
}
// Followed teams' schedules (their next and last games).
// Read again while the app stays open (an iPhone keeps it for hours in the
// background): every 10 minutes, a game on or not: its state and score come
// from the live scoreboards read every few seconds (freshGame), so a game
// over is never left 'on' (read every 2 minutes while one was on, each MLB
// team's 0.3 to 2.8 MB, for nothing the scoreboards hadn't said).
const teamsAt = new Map();
// The ones whose read failed: their card says so (none held), never a team
// with no games; read again by retryLater's rule, not at every repaint.
const teamsUnread = new Set();
const TEAM_MS = 10 * 60_000;
async function loadFollowedTeams() {
  for (const f of followedTeams().slice(0, 12)) {
    const key = `${f.league}:${f.id}`;
    if (LEAGUES[f.league]?.kind !== 'match') continue;
    const had = state.home.teams.get(key);
    if (retries.waiting(`team:${key}`)) continue;
    if (state.home.teams.has(key) && (had === null || teamsAt.get(key) === 'loading' || Date.now() - (teamsAt.get(key) || 0) < TEAM_MS)) continue;
    if (!had) state.home.teams.set(key, null);
    teamsAt.set(key, 'loading');
    // ESPN's team schedule; the other leagues' own season, the team's games.
    (hasTeams(f.league) ? teamSchedule(f.league, f.id) : seasonEvents(f.league).then(list => list.filter(e => e.home?.id === String(f.id) || e.away?.id === String(f.id)).sort((a, b) => a.start.localeCompare(b.start))))
      .then(list => {
        teamsAt.set(key, Date.now());
        teamsUnread.delete(key);
        retries.done(`team:${key}`);
        // Followed from one of our cups (Benfica in 歐霸): its games in our
        // competitions only, not its league's that ELTA doesn't show.
        // (Only the competitions Orbit Sports has: a friendly isn't one.)
        state.home.teams.set(key, list.filter(e => !e.other && LEAGUES[e.league]));
        if (state.tab === 'home') renderHome();
        if (state.tab === 'following') renderFollowing();
        if (state.tab === 'live') renderLive();
        clearTimeout(pushTimer);
        pushTimer = setTimeout(syncPush, 1500);
      })
      .catch(() => {
        teamsAt.delete(key);
        if (!had) state.home.teams.delete(key);
        // Said so on 追蹤 now, and read again shortly.
        teamsUnread.add(key);
        retryLater(`team:${key}`, true, loadFollowedTeams);
        if (state.tab === 'following') renderFollowing();
      });
  }
}
// Followed teams' coming games, for notices while the app is closed: the
// start, and the final score (the Worker asks ESPN each 2 minutes from the
// soonest the game can end, and tells it the moment it's over).
// Finals this app showed as a banner itself (open at the time): not sent again as a phone notice.
const bannered = new Set();
function syncPush() {
  // (A 測試工具 switch turning today's games: nothing of them goes to the Worker.)
  if (dayTested()) return;
  const now = Date.now();
  const items = [];
  const seen = new Set();
  // The live scoreboards' copy of a game first (the schedules are minutes older).
  const games = [...(state.days.get(today())?.events || []).filter(isFollowedEvent), ...followedGames(), ...followedTeams().flatMap(f => state.home.teams.get(`${f.league}:${f.id}`) || [])].map(freshGame);
  for (const e of games) {
    const key = `${e.league}:${e.id}`;
    // (A game just over stays on the list till the Worker has told it: an app
    // opened at the final sent its list without it, and the result never
    // came, Jay 2026-10-21. The Worker sends each once; one this app showed
    // as a banner itself is left off.)
    if (e.kind !== 'match' || e.other || seen.has(key) || e.status?.void || (e.status?.state === 'post' && bannered.has(key))) continue;
    seen.add(key);
    const start = Date.parse(e.start);
    if (!(start > now - 4 * 3_600_000 && start < now + 8 * 86_400_000)) continue;
    // Its start only when it's on TV here; its final score in any case.
    // (Kept on the list for 10 minutes after the start: an open app sending its list again at the start
    // took it off before the Worker's run, and the notice never came. The Worker sends each once.)
    if (e.status?.state !== 'post' && start > now - GRACE && !e.timeTbd && (onTv(e) || isFollowedGame(e))) items.push({ at: start, title: startTitle(e), body: startLine(e), tag: `start:${key}`, hash: noticeHash(e), kind: 'start' });
    const end = resultItem(e, now);
    if (end) items.push(end);
  }
  // Today's picks, each starting (its own kind of notice, 今日推薦開賽): one
  // a followed team's start notice already covers isn't said twice.
  for (const e of (state.todayPicks || []).map(freshGame)) {
    const start = Date.parse(e.start); // (an F1 session's: its title time, the owner's call, 2026-10-18)
    if (e.status?.state === 'post' || e.status?.void || e.timeTbd || !(start > now - GRACE) || start > now + 86_400_000) continue;
    const key = `${e.league}:${e.id}`;
    if (items.some(x => x.tag === `start:${key}`)) continue;
    items.push({ at: start, title: startTitle(e), body: startLine(e, true), tag: `pick:${key}`, hash: noticeHash(e), kind: 'pick' });
  }
  // Today's picks, each ending (今日推薦賽果): every pick of the day, the ones
  // on now too (they've left 今日推薦 for 正在進行); one a followed team's or
  // race weekend's final already covers isn't said twice.
  // (Today's and tomorrow's picks put on ahead, and a game already over never
  // put on late: lib/notice.mjs pickFinals.)
  const picked = pickedToday();
  const pickDays = [today(), addDays(today(), 1)].map(d => (state.days.get(d)?.events || []).map(freshGame).map(e => ({ e, picked: picked.has(`${e.league}:${e.id}`) || (e.status?.state !== 'post' && !e.status?.void && !e.other && isPickEvent(e)) })));
  const finals = pickFinals(pickDays.flat(), readJson(PICK_SENT_KEY, {}), now);
  writeJson(PICK_SENT_KEY, finals.sent);
  for (const e of finals.games) {
    if (e.other || e.status?.void || (e.status?.state === 'post' && bannered.has(`${e.league}:${e.id}`)) || items.some(x => x.tag === `end:${e.league}:${e.id}`)) continue;
    const end = resultItem(e, now, true);
    if (end) items.push(end);
  }
  // A followed race weekend: each qualifying, sprint and race starting, and
  // the sprint's and the race's result (the Worker reads the podium off ESPN's day).
  // (And a league followed as a league: its weekends' sessions today.)
  for (const e of [...followedGames(), ...(state.days.get(today())?.events || []).filter(e => e.kind === 'field' && isFollowedEvent(e))]) {
    if (e.kind !== 'field' || !['Qual', 'SR', 'Race'].includes(e.sessionKey) || e.status.state === 'post' || items.some(x => x.tag === `start:${e.league}:${e.id}`)) continue;
    // (The start notice at the title time, a few minutes before the official start: the owner's call, 2026-10-18.)
    const start = Date.parse(e.start);
    if (!(start > now - 4 * 3_600_000 && start < now + 8 * 86_400_000)) continue;
    if (start > now - GRACE) items.push({ at: start, title: startTitle(e), body: startLine(e), tag: `start:${e.league}:${e.id}`, hash: noticeHash(e), kind: 'start' });
    const end = resultItem(e, now);
    if (end) items.push(end);
  }
  schedulePush(q, items);
  tellNext(items, now);
}
// The family's notebook (kit family.mjs sports.next): the followed games and
// sessions starting within a day, as their start notices say them, for the
// Orbit Pass's 今天 (a tap opens the game here: `hash`).
let toldNext = '';
function tellNext(items, now) {
  const next = items
    .filter(x => x.kind === 'start' && x.at > now - 3 * 3_600_000 && x.at < now + 86_400_000)
    .sort((a, b) => a.at - b.at)
    .slice(0, 4)
    .map(x => ({ at: x.at, title: x.title.replace(/ (開賽|開始|is on)$/, ''), hash: x.hash }));
  // (And sports.games: the next 8 days' for Class's 加到行事曆, one calendar.)
  const games = items
    .filter(x => x.kind === 'start' && x.at > now - 3 * 3_600_000 && x.at < now + 8 * 86_400_000)
    .sort((a, b) => a.at - b.at)
    .slice(0, 40)
    .map(x => ({ id: x.tag.slice(6), at: x.at, mins: gameMins(x.tag.split(':')[1]), title: x.title.replace(/ (開賽|開始|is on)$/, ''), hash: x.hash }));
  const key = JSON.stringify([next, games]);
  if (key === toldNext) return;
  toldNext = key;
  import('#kit/family.mjs')
    .then(f => (f.tell?.('sports', 'next', next), f.tell?.('sports', 'games', games)))
    .catch(() => {});
}
// About how long a game lasts, for a calendar: by its sport.
const GAME_MINS = { baseball: 180, basketball: 150, soccer: 120, racing: 120 };
const gameMins = league => GAME_MINS[LEAGUES[league]?.sport] || 150;
// A game's or a sprint's or race's final, for the Worker to send the moment
// it's over (it fills in the score or the podium, and who won: {result}); a
// pick's says so (今日推薦賽果, its own switch). Asked from the soonest it can
// end (SHORTEST) at every Worker run until 8 hours after the start (`until`):
// fixed times, so the list sent stays the same from one refresh to the next,
// and an app opened mid-game hands over a check that's due at once.
// A game's notice opens the game's own page (Jay 2026-11-06: "open that game").
const noticeHash = e => gameHash(e, localDate(Date.parse(e.start)));
const HOLD = 8 * 3_600_000;
function resultItem(e, now, pick = false) {
  const espn = LEAGUES[e.league].espn;
  const start = Date.parse(e.official || e.start);
  if (e.timeTbd || !(start > now - 4 * 3_600_000 && start < now + 8 * 86_400_000)) return null;
  const base = { body: [`{result}`, leagueName(e.league, locale), pick ? L(PICKED) : ''].filter(Boolean).join(' · '), tag: `end:${e.league}:${e.id}`, hash: noticeHash(e), kind: pick ? 'pickend' : 'end' };
  if (espn && e.kind === 'match' && /^\d+$/.test(e.id))
    return { ...base, at: Date.parse(e.start) + (SHORTEST[LEAGUES[e.league].sport] || 100) * 60_000, until: Date.parse(e.start) + HOLD, title: matchLine(e), check: { espn, event: e.id, names: [e.away.short || e.away.name, e.home.short || e.home.name] } };
  // CPBL (no ESPN): its game in TheSportsDB's day list, the one this app reads CPBL from.
  const tsdb = /^cpbl-tsdb-(\d+)$/.exec(String(e.id));
  if (e.league === 'cpbl' && tsdb)
    return { ...base, at: start + SHORTEST.baseball * 60_000, until: start + HOLD, title: matchLine(e), check: { tsdb: tsdb[1], day: new Date(start).toISOString().slice(0, 10), names: [e.away.short || e.away.name, e.home.short || e.home.name] } };
  if (espn && e.kind === 'field' && ['SR', 'Race'].includes(e.sessionKey) && /^\d+$/.test(String(e.weekend)))
    return { ...base, at: start + (e.sessionKey === 'Race' ? 80 : 25) * 60_000, until: start + HOLD, title: `${e.name} ${e.session}`, check: { espn, event: String(e.weekend), session: e.sessionKey, day: new Date(start).toISOString().slice(0, 10).replaceAll('-', '') } };
  return null;
}
// Every one of today's picks (今日推薦), kept on the device for the day: a
// pick leaves the list once it's on, and its final is still said, even by an
// app opened mid-game.
const PICKED_KEY = 'fx.picked.v1';
// The picks' finals put on the Worker's list, and when (lib/notice.mjs pickFinals).
const PICK_SENT_KEY = 'fx.pickends.v1';
function pickedToday() {
  try {
    const kept = JSON.parse(localStorage.getItem(PICKED_KEY) || 'null');
    if (kept?.date === today()) return new Set(kept.keys);
  } catch {}
  return new Set();
}
// Games on now in one order, every tab that lists them (首頁's 正在進行 and
// its top card, 轉播's): a followed team's first, then today's picks, then
// the picks' own score (picks.mjs scoreMatch). 轉播 had its own (the
// headline leagues, then followed), and led with the Rockets while 首頁 led
// with the World Series. `also`: picks of the day not yet noted.
function rankOnNow(list, ctx, also = new Set()) {
  const picked = new Set([...pickedToday(), ...also]);
  const k = x => `${x.event.league}:${x.event.id}`;
  return list.map(e => ({ event: e, ...scoreMatch(e, ctx) })).sort((x, y) => isFollowedEvent(y.event) - isFollowedEvent(x.event) || picked.has(k(y)) - picked.has(k(x)) || y.score - x.score);
}
// The picks' context for a day held (what rankOnNow and the plan weigh).
// What the picks showed, what was opened from them and anywhere in the app,
// and what was followed (the kit's feedback.mjs, the family's one engine,
// kept on the Pass): a team or league passed over day after day sinks, one
// opened rises, and a team opened far more than the rest is a 常看.
// (Loaded on the side: an older kit without it ranks without them.)
let feedback = null;
import('#kit/feedback.mjs')
  .then(m => {
    feedback = m;
    feedback.keep?.(q, 'match');
  })
  .catch(() => {});
const pickItem = e => ({ id: `${e.league}:${e.id}`, keys: eventKeys(e) });
const theirs = now => ({ personal: feedback?.scorer?.('match', now) || null, why: feedback?.whyOf?.('match', now, HABIT) || null });
const pickContext = (slot, now = Date.now()) => ({ leagues: state.prefs.leagues, follows: state.prefs.follows, games: state.prefs.games.map(gameKey), tables: state.home.tables, now, featured: featuredIn(dayAll(slot)), chosen: chosenGames(), ...theirs(now) });
function notePicked(events) {
  const keys = pickedToday();
  const had = keys.size;
  for (const e of events) keys.add(`${e.league}:${e.id}`);
  if (keys.size === had) return;
  try {
    localStorage.setItem(PICKED_KEY, JSON.stringify({ date: today(), keys: [...keys] }));
  } catch {}
}

// A notice's words, read at a glance on the lock screen: the title says what
// happened ("道奇 vs 費城人 開賽", "新加坡站 排位賽 開始", the final score),
// the line under it the league and why it came ("MLB 美國職棒 · 今日推薦"; no
// channel: ELTA's isn't said in a notice). Never a line that repeats the title.
const GRACE = 10 * 60_000;
const startTitle = e => (e.kind === 'match' ? `${matchLine(e)} ${L({ zh: '開賽', en: 'is on' })}` : `${e.name}${e.session ? ` ${e.session}` : ''} ${L({ zh: '開始', en: 'is on' })}`);
const PICKED = { zh: '今日推薦', en: 'Today’s pick' };
const startLine = (e, pick = false) => [leagueName(e.league, locale), pick ? L(PICKED) : ''].filter(Boolean).join(' · ');
// Who won, for the final's notice: "Yankees 贏了", or a draw.
function resultLine(e) {
  if (e.status?.void) return /POSTPONED/.test(e.status.name || '') ? L({ zh: '比賽延期', en: 'Postponed' }) : L({ zh: '比賽取消', en: 'Canceled' });
  const r = outcome(e.home, e.away);
  if (!r) return L({ zh: '比賽結束', en: 'Final' });
  if (r === 'D') return L({ zh: '平手', en: 'Draw' });
  const w = r === 'W' ? e.home : e.away;
  return locale === 'en' ? `${w.short || w.name} win` : `${w.short || w.name} 贏了`;
}
// A final's notice (Jay 2026-11-11: "塞爾提克 123 : 101 76 人" was hard to
// read): who won in the title, the score alone in the body, as the Worker's
// own final (kit finalWords): 塞爾提克 擊敗 76 人 / 123–101 · NBA.
function finalNotice(e) {
  if (e.status?.void) return null;
  const r = outcome(e.home, e.away);
  const side = x => ({ name: x.short || x.name, score: x.score });
  return kitEspn.finalWords?.({ away: side(e.away), home: side(e.home), winner: r === 'W' ? 'home' : r === 'L' ? 'away' : null }, locale) || null;
}
const matchLine = (e, score = false) => {
  const [a, b] = sidesOf(e);
  return score ? `${a.short || a.name} ${scoreText(a.score)} : ${scoreText(b.score)} ${b.short || b.name}` : `${a.short || a.name} vs ${b.short || b.name}`;
};

// A followed team's game starting or ending, or one of today's picks
// ending: a notice.
const lastState = new Map();
function noticeChanges(events) {
  const picked = pickedToday();
  for (const e of events) {
    const followed = isFollowedEvent(e);
    const key = `${e.league}:${e.id}`;
    if (e.kind !== 'match' || !(followed || picked.has(key))) continue;
    const was = lastState.get(key);
    lastState.set(key, e.status.state);
    const change = transition(was, e.status);
    if (!change) continue;
    const league = leagueName(e.league, locale);
    if (followed && change === 'start' && (onTv(e) || isFollowedGame(e))) notify(q, { title: startTitle(e), body: startLine(e), tag: `start:${key}`, hash: noticeHash(e), kind: 'start' });
    if (change === 'end' && document.visibilityState === 'visible') bannered.add(key);
    const fin = change === 'end' ? finalNotice(e) : null;
    if (change === 'end') notify(q, { title: fin ? fin.title : matchLine(e, true), body: [fin ? fin.result : resultLine(e), league, followed ? '' : L(PICKED)].filter(Boolean).join(' · '), tag: `end:${key}`, hash: noticeHash(e), kind: followed ? 'end' : 'pickend' });
  }
}

// A sideways row of chips the first time it's shown: scrolled so the chosen
// one sits in the middle (the row only, never the page). After that a new
// pick never moves the row (Jay 2026-11-03: 數據's pills "jumped when you
// click further"): it stays where the person had it (the kit's keepStrips
// puts a redrawn row back), only nudged, gently, when the chosen chip is
// partly out of view (one chosen by a swipe).
// A redraw with the same chip chosen (the games coming in, a live refresh)
// leaves the row where the person scrolled it, never pulls it back to the chip.
const centered = new Map();
function centerChosen(box) {
  const rows = [...box.querySelectorAll('.q-chips')];
  // (Asked of the layout only for a newly chosen chip, every one read before any is scrolled:
  // a read after a scroll lays the page out again, a second a switch on a phone.)
  const moves = [];
  for (const chip of box.querySelectorAll('.q-chips [aria-pressed="true"]')) {
    const row = chip.parentElement;
    // A date strip places itself (dateStrip).
    if (row.classList.contains('day-strip')) continue;
    const key = `${box.id || ''}|${row.className}|${rows.indexOf(row)}`;
    const chosen = chip.textContent;
    if (centered.get(key) === chosen) continue;
    // Not laid out yet (under the loading screen): nothing to centre, and not
    // counted as done (it was, and every redraw after left the date strip on
    // its first day, a month back).
    if (!row.clientWidth) continue;
    const seen = centered.has(key);
    centered.set(key, chosen);
    if (row.scrollWidth <= row.clientWidth) continue;
    // (Seen: after keepStrips has put the row back, before it's painted.)
    if (seen) requestAnimationFrame(() => chipInView(row, chip));
    else moves.push([row, chip.offsetLeft - row.offsetLeft - row.clientWidth / 2 + chip.clientWidth / 2]);
  }
  for (const [row, left] of moves) row.scrollLeft = left;
}
function chipInView(row, chip) {
  if (!row.isConnected || !chip.isConnected) return;
  const r = row.getBoundingClientRect();
  const c = chip.getBoundingClientRect();
  const by = c.left < r.left + 12 ? c.left - r.left - 12 : c.right > r.right - 12 ? c.right - r.right + 12 : 0;
  if (by) row.scrollBy({ left: by, behavior: 'smooth' });
}

// ---- 推薦: every match of the chosen day, ranked for this person ---------------------------

const REASON = r => t(`why_${r}`);
const PLAIN_WHY = new Set(['team', 'game', 'leagueGame', 'priority', 'league', 'featured']);
// A pick on 稍後: its game's row, and why it was picked as tags under it.
function planRow(item, opts = {}) {
  const row = eventRow(item.event, opts);
  // A game 填滿空檔 put in: a quieter, smaller row with ★ 推薦, so their own stand out.
  if (item.filled) row.classList.add('filled', 'picked');
  // (Over: its score at the line's end, where the star was.)
  if (item.filled && item.event.kind === 'match' && item.event.status.state === 'post' && !item.event.status.void) row.append(el('b', { class: 'filled-score num', text: sidesOf(item.event).map(x => scoreText(x.score)).join('–') }));
  // Only what makes the game worth it (a top clash, a close one), grey like
  // the row's other facts: in 我的比賽, 我的球隊 / 我的聯賽 / 愛爾達主頻道 say
  // nothing and pushed its channel off the line (Jay 2026-11-03); a game of
  // their own team's needs no reason at all.
  const why = (ownGame(item.event) || item.filled ? [] : item.reasons).filter(r => !PLAIN_WHY.has(r)).slice(0, 1).map(r => el('span', { class: 'q-tag', text: REASON(r) }));
  // (After the 推薦 pill, hidden in 我的比賽's list: put before it, the pill's
  // no-dot rule took the dot off the league after the reason, 「關鍵戰美職足」.)
  const tags = row.querySelector('.ev-tags') || row.querySelector('.event-sides, .event-title')?.appendChild(el('div', { class: 'ev-tags' }));
  const pill = tags?.querySelector(':scope > .row-mark');
  if (why.length && tags) pill ? pill.after(...why) : tags.prepend(...why);
  return row;
}

// What the filter keeps: everything, only the followed teams' games, or one sport.
function filtered(events) {
  const f = state.home.filter;
  if (f === 'all') return events;
  if (f === 'teams') return events.filter(isFollowedEvent);
  return events.filter(e => LEAGUES[e.league]?.sport === f);
}

// The date strip: a fixed row of days, drawn once and never rebuilt while
// it's scrolled (rebuilding it under a finger was what made it jump and
// stop on iPhone). Home: a month back and six weeks ahead; a league (or a
// sport on home): its season's game days, so it ends where the season does.
// 📅 reaches any day (the strip widens to it).
const STRIP = { from: -30, to: 45 };
const stripRange = { from: STRIP.from, to: STRIP.to };
const dayOffset = d => Math.round((Date.parse(`${d}T12:00:00`) - Date.parse(`${today()}T12:00:00`)) / 86_400_000);
function reach(date, range = stripRange) {
  const n = dayOffset(date);
  if (n < range.from) range.from = n - 3;
  if (n > range.to) range.to = n + 3;
}
// The kit's strip of days (ui.mjs dayStrip). `range`:
// the stretch of days shown (home's own by default; 賽事 keeps one per
// league); it also holds the strip's record (`range.strip`), so the strip
// is made once and changed in place. `range.recenter`: the next draw brings
// the day to the middle. `bounds`: the days that can be asked for
// (lib/bounds.mjs): the strip and 📅 stop there. `follow`: 首頁's and 轉播's
// bar, every new day to the middle, a swipe's too.
function dateStrip(current, onPick, { only = null, range = stripRange, bounds = null, follow = false } = {}) {
  if (current && !only) reach(current, range);
  const days = stripDays(current, { only, range, base: today() }).filter(d => d === current || within(d, bounds));
  const s = (range.strip ??= {});
  if (range.recenter) (range.recenter = false), kitUI.dayRecenter(s);
  return kitUI.dayStrip(s, {
    days,
    current,
    today: today(),
    // (📅's day: the strip reaches it first.)
    onPick: d => (reach(d, range), onPick(d)),
    // (Each chip's two lines, 今天 or the weekday over the date, the kit's: every app's the same.)
    clamp: v => clampDay(v, bounds),
    bounds,
    follow
  });
}
// The days each league can be asked for (Shared-Data's nightly
// sports/bounds.json): read once a session; null until read (nothing locked).
let allBounds = null;
const boundsRead = packJson('sports/bounds.json', { ttl: 12 * 3_600_000 })
  .then(d => {
    allBounds = d?.leagues || null;
    // The strips drawn before it: their ends now.
    if (state.tab === 'home') renderHome();
    else if (state.tab === 'matches') renderScores();
  })
  .catch(() => null);
// Home's: every league the app has, the earliest kept day to the latest last one.
const homeBounds = () => unionBounds(allBounds, Object.keys(LEAGUES));
const leagueBounds = league => boundsOf(allBounds, league);
// A league's game days this season (Taipei dates): Shared-Data's nightly
// sports/<league>/days.json (small; the season across both year packs), a
// league without one (CPBL) from its own season. Read once a session; null
// until read (the days read so far stand in), a failed read asked again later.
const seasonDays = new Map();
function leagueDays(league, then) {
  if (!seasonDays.has(league)) {
    seasonDays.set(league, null);
    const own = () => seasonEvents(league).then(list => list.filter(e => !e.status?.void).map(e => localDate(Date.parse(e.start))));
    const read = LEAGUES[league].espn ? packJson(`sports/${league}/days.json`, { ttl: 12 * 3_600_000 }).then(d => d?.days || []) : own();
    read
      .then(list => {
        if (!list.length) return seasonDays.delete(league);
        seasonDays.set(league, new Set(list));
        then?.();
      })
      .catch(() => seasonDays.delete(league));
  }
  return seasonDays.get(league);
}

// Leagues in season first, on a break next, over last, each kept in the
// order given (leagues.mjs bySeason); a league's days not read yet are read
// now, and the page drawn again once they're in.
let seasonRedraw = 0;
const redrawForSeason = () => {
  clearTimeout(seasonRedraw);
  seasonRedraw = setTimeout(() => {
    if (state.tab === 'home') renderHome();
    else if (state.tab === 'matches') renderScores();
  }, 300);
};
// (Each league's last answer kept on the device for the day, so the order
// stands from the first draw instead of moving once the days are read.)
const SEASON_KEY = 'fx.season.v1';
const seasonKept = (() => {
  try {
    const x = JSON.parse(localStorage.getItem(SEASON_KEY) || 'null');
    return x?.day === today() && x.s ? x.s : {};
  } catch {
    return {};
  }
})();
function seasonOf(k) {
  const days = leagueDays(k, redrawForSeason);
  if (!days) return seasonKept[k] || 'on';
  const s = seasonState(days, today());
  if (seasonKept[k] !== s) {
    seasonKept[k] = s;
    try {
      localStorage.setItem(SEASON_KEY, JSON.stringify({ day: today(), s: seasonKept }));
    } catch {}
  }
  return s;
}
const inSeasonFirst = keys => bySeason(keys, seasonOf);
// 首頁's sport chips: the sports of their leagues, those in season first.
const homeSports = () => [...new Set(inSeasonFirst(state.prefs.leagues).map(k => LEAGUES[k].sport))];

// ---- 賽事's 全部: every league's games of a day ----------------------------------------------
//
// What 賽事 opens on (it used to open on the first league followed: F1,
// every time; Jay 2026-10-21): a day's games of every league, grouped by
// league (theirs first, in the rail's order), under a strip of days like
// 首頁's (swiped too). A league's head opens its own page on that day.
// The games are everything read for the day (rawDays: the followed leagues,
// the others, the rest), small hours too.
// 賽事's (全部's and a league's): the same bar, pinned the same way.
const allBarEl = el('div', { class: 'q-day-bar day-bar' });
const scoresBarEl = el('div', { class: 'q-day-bar day-bar' });
const ALL = 'all';
const allRange = { from: STRIP.from, to: STRIP.to };
// (null: today, whichever day that is now.)
const allDay = () => state.scores.date || today();
const allShown = date => state.tab === 'matches' && state.scores.league === ALL && allDay() === date;
function openAll(date) {
  state.scores = { ...state.scores, sport: null, league: ALL, date: chosenOf(date, today()), chosen: chosenOf(date, today()), picked: false, byDay: null, days: [], extra: 0, stage: 'all', touched: true, q: '' };
  allRange.recenter = true;
  clearSearch();
  if (state.tab === 'matches') renderScores();
  else showTab('matches');
}
function pickAllDay(d) {
  if (d === allDay()) return;
  state.scores.date = state.scores.chosen = chosenOf(d, today());
  toPageTop();
  renderScores();
}
// Another day's rest of the leagues (首頁 reads the followed ones and 24
// others; today's rest is 直播's, loadRest): read once for 全部.
const restDays = new Map();
async function loadRestDay(date) {
  const r = restDays.get(date) || { at: 0, failed: 0 };
  if (r.loading) return;
  r.loading = true;
  restDays.set(date, r);
  try {
    r.failed = (await readDay(restLeagues(), date, { night: true })).failed || 0;
  } catch {
    r.failed = Math.max(1, restLeagues().length);
  } finally {
    r.loading = false;
    r.at = Date.now();
  }
  retryLater(`restday:${date}`, r.failed > 0, () => loadRestDay(date), () => allShown(date));
  if (allShown(date)) renderScores();
}
// A day's games, every league's read (by the clock: the small hours too),
// each as its newest copy; a tournament running across the day too.
function allGames(date) {
  const from = Date.parse(`${date}T00:00:00`);
  const to = Date.parse(`${addDays(date, 1)}T00:00:00`);
  const isToday = date === today();
  return [...(rawDays.get(date)?.values() || [])]
    .map(freshGame)
    .filter(e => LEAGUES[e.league] && (inDay(Date.parse(e.start), date) || (isToday && e.status.state === 'in') || (!e.sessionKey && e.kind !== 'match' && e.end && Date.parse(e.start) < to && Date.parse(e.end) >= from)));
}
const ALL_ROWS = 5;
function renderAll() {
  const box = $('panel-matches');
  const date = allDay();
  const isToday = date === today();
  // The day's reads, all at once: theirs, the others', the rest's.
  let slot = state.days.get(date);
  if (!slot?.at || (slot.stale && !slot.loading)) {
    if (!slot?.loading) loadDay(date);
    slot = state.days.get(date);
  }
  if (slot && !slot.othersAt && !slot.othersLoading) loadOthers(date);
  if (slot && isToday && !slot.restAt && !slot.restLoading) loadRest(date);
  const rest = restDays.get(date);
  if (!isToday && !rest?.at && !rest?.loading) loadRestDay(date);
  const ready = slot?.at && !slot.stale && slot.othersAt && (isToday ? slot.restAt : restDays.get(date)?.at);
  const head = pageHead(L({ zh: '全部賽事', en: 'All games' }));
  head.dataset.all = date;
  put(allBarEl, dateStrip(date, pickAllDay, { range: allRange, bounds: homeBounds() }));
  const strip = allBarEl;
  let list;
  // (The day's shape while its three reads come in, never the page dropped to a spinner.)
  if (!ready) list = box.querySelector('.live-shape') || liveShape();
  else {
    const games = allGames(date);
    const unread = (slot.partial || 0) + (slot.othersFailed || 0) + ((isToday ? slot.restFailed : restDays.get(date)?.failed) || 0);
    const place = new Map(scoresRail().map((k, i) => [k, i]));
    const byLeague = new Map();
    for (const e of games) byLeague.set(e.league, [...(byLeague.get(e.league) || []), e]);
    const order = { in: 0, pre: 1, post: 2 };
    const groups = [...byLeague].sort(([a], [b]) => (place.get(a) ?? 999) - (place.get(b) ?? 999));
    const group = ([k, rows]) => {
      rows.sort((a, b) => order[a.status.state] - order[b.status.state] || a.start.localeCompare(b.start));
      // The league's head: its mark and name, and how many, a tap to its page that day.
      const sh = kitUI.sectionHead(leagueName(k, locale), { more: t('gamesN', { n: rows.length }), onMore: () => openScores(k, date) });
      sh.prepend(leagueMark(k));
      return el('section', { class: 'q-section all-league', 'data-league': k }, [sh, el('div', { class: 'q-card list' }, rows.slice(0, ALL_ROWS).map(e => eventRow(e, { league: false, day: false }))), rows.length > ALL_ROWS ? goBar(L({ zh: `還有 ${rows.length - ALL_ROWS} 場`, en: `${rows.length - ALL_ROWS} more` }), () => openScores(k, date), 'show-more') : null]);
    };
    list = el('div', { class: 'all-day' }, [
      el('p', { class: 'day-head', text: [dayLabel(date, { long: true }), t('gamesN', { n: games.length })].join(' · ') }),
      // (A wide screen: the leagues side by side, each a card of its games.)
      games.length ? balanced(groups.map(group), g => 1.6 + g.querySelectorAll('.event-row').length + (g.querySelector('.show-more') ? 0.5 : 0)) : empty(unread ? t('someUnread') : t('noGames'))
    ]);
  }
  const parts = [head, leagueRail(scoresRail()), strip, list];
  // The same day drawn again (a score changed, another league read): in place.
  if (box.firstChild?.dataset?.all === date && box.childNodes.length === parts.length) return parts.forEach((n, i) => morph(box.childNodes[i], n));
  put(box, ...parts);
  centerChosen(box);
}

// ELTA's four 體育台; MAX's channels carry the English feed. Its pick is a
// game there with its own commentators: a 體育台 can carry a game in 原音
// too, not its pick (Brighton v Palace on 愛爾達2台 in 原音 while Leeds v
// Man United had ELTA's commentary on 愛爾達1台, 2026-10-18).
const MAIN_CHANNELS = new Set([101, 105, 110, 115]);
// (A channel guessed past ELTA's list is no pick of ELTA's.)
const onMain = e => channelsOf(e).some(c => !c.guess && MAIN_CHANNELS.has(c.ch) && !['en', 'data', 'cam'].includes(c.audio));
// The broadcaster's pick: a game on a main channel while another of its
// league, starting within the hour, is on TV only on MAX. (One game on
// alone isn't a pick: there was nothing to choose from.)
const featuredIn = list => e => onMain(e) && list.some(o => o !== e && o.id !== e.id && o.league === e.league && Math.abs(Date.parse(o.start) - Date.parse(e.start)) < 3_600_000 && onTv(o) && !onMain(o));
// The day's shape kept up while the open day is still being made out, for
// up to `ms` from when it was first drawn (then what there is): false while
// it holds (the shape drawn, a redraw set for the end of the wait).
function holdDay(box, ms) {
  const h = state.home;
  const now = Date.now();
  if (h.gate?.day !== h.date) h.gate = { day: h.date, since: now };
  const left = h.gate.since + ms - now;
  if (left <= 0) return true;
  clearTimeout(h.gate.timer);
  h.gate.timer = setTimeout(() => state.tab === 'home' && state.home.date === h.gate.day && renderHome(), left);
  put(box, homeBar(), homeFilters(), box.querySelector(':scope > .live-shape') || liveShape());
  centerChosen(box);
  return false;
}
// The days either side of the open one read while it's looked at (theirs
// and the other leagues'), so a swipe lands on a day already in (Jay
// 2026-11-03: a day with nothing on kept loading; NBA's later days slow).
let aroundTimer = 0;
function readAround(date) {
  clearTimeout(aroundTimer);
  aroundTimer = setTimeout(() => {
    if (state.tab !== 'home' || state.home.date !== date || netState() !== 'online' || document.hidden) return;
    for (const d of [addDays(date, 1), addDays(date, -1)]) {
      const slot = state.days.get(d);
      // (A light day's games over: their box scores too, for its cards, once the day is read.)
      if (!slot?.at && !slot?.loading) Promise.resolve(loadDay(d)).then(() => readDayBoxes(d)).catch(() => {});
      else readDayBoxes(d);
      const read = state.days.get(d);
      if (read && !read.othersAt && !read.othersLoading) loadOthers(d);
    }
  }, 800);
}
// 推薦 in every list: a game is a pick when 首頁 picked it for its day (a
// day 首頁 hasn't drawn: the same plan worked out from the day's games of
// theirs on TV). Not "followed": every game of a followed league is theirs.
const homePicks = new Map();
const pickMemo = new Map();
const pickAsked = new Set();
function isPickEvent(e) {
  const d = localDate(e.start);
  const key = `${e.league}:${e.id}`;
  if (homePicks.has(d)) return homePicks.get(d).has(key);
  const slot = state.days.get(d);
  // (A day not read yet, 賽事 opened first: read as 首頁 would, then the list drawn again with its picks.)
  if (!slot?.at && !pickAsked.has(d) && d >= today() && d <= addDays(today(), 14)) {
    pickAsked.add(d);
    Promise.resolve(loadDay(d))
      .then(() => state.tab === 'matches' && state.days.get(d)?.events?.length && renderScores())
      .catch(() => {});
  }
  // A game of theirs (a team, a player, the game itself) on TV here is
  // always in the day's plan (dayPlan's keep): lit at once, before that day
  // is read or 首頁 has drawn it (Jay 2026-11-04: 勇士 v 火箭 in 賽事 went
  // grey only after its day was opened on 首頁, or came in grey later).
  // (Today and on, as the plan has them: one still to come or on, not over or called off.)
  if (ownGame(e) && !practice(e) && (isFollowedGame(e) || onTv(e)) && (d < today() || (e.status?.state !== 'post' && !e.status?.void))) return true;
  if (!slot?.events?.length) return false;
  const memo = `${d}|${slot.at}|${slot.events.length}|${state.prefs.fill ? `f${slot.others?.length || 0}` : ''}|${Object.values(state.home.tables).filter(x => Object.keys(x).length).length}`;
  if (!pickMemo.has(memo)) {
    const own = new Set([...followedLeagues(), ...state.prefs.follows.map(f => f.league)]);
    const mine = filtered(slot.events.filter(x => !practice(x) && (own.has(x.league) || isFollowedGame(x)) && (isFollowedGame(x) || onTv(x))));
    const past = d < today();
    const pool = state.prefs.fill ? [...mine, ...(slot.others || []).filter(x => !practice(x) && onTv(x))] : mine;
    const pctx = pickContext(slot);
    pickMemo.set(memo, new Set(dayPlan(pool.filter(e => !nightOnly(e)), pctx, { n: 6, also: 0, asStood: past, keep: ownGame, only: isFollowedEvent, fill: state.prefs.fill ? e => worth(e, pctx) : null }).plan.map(x => `${x.event.league}:${x.event.id}`)));
  }
  return pickMemo.get(memo).has(key);
}
ctx.isPickEvent = isPickEvent;
ctx.isFollowedEvent = e => isFollowedEvent(e);
// What a day not drawn yet still waits for: a league of theirs unread, or
// 填滿空檔's games (every other league's) still being read. (One of the
// others unread doesn't hold it: it held the whole page 6 s for a league
// whose games are seldom a filled one.) Once drawn, a day never drops back
// to its shape (a live read that misses a league).
const dayWaits = slot => !slot?.drawn && (slot?.partial > 0 || (state.prefs.fill && state.home.filter !== 'teams' && !slot?.othersAt));
// A game the person follows by name (a team, a player, the game itself):
// always among 我的比賽, its hour taken (not a league's chosen game, which
// competes for its hour like any other).
const ownGame = e => isFollowedEvent(e, { chosen: false });
// 首頁's sections on the board (ui.js homeBoard): cols' two lists, in their
// places: left [lead game, 正在進行, a day gone by, a note, the spinner,
// 我的比賽], right [their teams' later games when 推薦 leads, 更多賽事, 我的球隊, 已結束].
// The lead game, 正在進行 and 我的比賽 pair up; their later games and teams to
// the side. (我的聯賽 left for 追蹤 11-10: its slot had taken 我的球隊's,
// and 已結束 went to the side, not under the board.)
function homeLayout([hero, live, past, note, spin, mine], [later, more, teams, ended]) {
  const isList = x => x?.classList?.contains('q-section');
  const pairs = new Set([hero, live, isList(mine) ? mine : null].filter(Boolean));
  return homeBoard([note, hero, live, isList(mine) ? mine : null, past, spin, isList(mine) ? null : mine], [later, teams], pairs, [more, ended]);
}
function renderHome() {
  const box = $('panel-home');
  const h = state.home;
  const slot = state.days.get(h.date);
  h.settled = false;
  // The picks are only games on TV here: none until the lists saying which
  // are in (onTvChange repaints then). The day is read again only when it
  // needs it: never for the TV lists alone, or loadDay's repaint calls
  // straight back here and the page locks up.
  const unread = !slot?.at || (slot.leagues !== leaguesKey() && !slot.stale);
  // (A day none of whose leagues answered, opened again: read again now, not at the next retry.)
  const lost = slot?.at && !slot.loading && slot.partial > 0 && !slot.events.length;
  if (unread || lost || !tvReady()) {
    if ((unread || lost) && !slot?.loading) loadDay(h.date);
    // (The other leagues alongside theirs: a day with nothing of theirs
    // needs them, and reading them only after theirs made it two reads long.)
    const read = state.days.get(h.date);
    if (read && !read.othersAt && !read.othersLoading && h.filter === 'all') loadOthers(h.date);
    // The day's shape while it's read (never the page dropped to a spinner and grown back).
    put(box, homeBar(), homeFilters(), box.querySelector(':scope > .live-shape') || liveShape());
    centerChosen(box);
    return;
  }
  const now = Date.now();
  const pctx = pickContext(slot, now);
  let past = h.date < today();
  // The picks of a list: the plan and the rest (a past day ranked as it
  // stood before, shown with the real results).
  const rank = (list, also = 999, ctx = pctx, before = past) => {
    // (Only their own games are 我的比賽; with 填滿空檔 on, the free hours
    // take the game of any sport worth most then.)
    // (Filling keeps the quiet hours as their leagues do: never the small hours, Jay 2026-11-04.)
    const fill = state.prefs.fill;
    const { plan, also: awake } = dayPlan(list.filter(e => !nightOnly(e)), ctx, { n: 6, also: 999, asStood: before, keep: ownGame, only: isFollowedEvent, fill: fill ? e => worth(e, ctx) : null });
    // The small hours' big games: with the rest, by their score.
    const { also: night } = dayPlan(list.filter(nightOnly), ctx, { n: 0, also: 999, asStood: before });
    const rest = [...awake, ...night].sort((x, y) => y.score - x.score);
    return [plan, rest.slice(0, also)];
  };
  // Only what's on TV in Taiwan is recommended (賽事 has every game), a game
  // over too: a result is among the picks only if it was on. Only where it
  // can't be known (before the days ELTA's list reaches) is any result kept.
  // A match followed on its own shows whether or not it's on TV here: the person asked for it.
  // (ELTA's list unread: every game of theirs, not none; tvUnread.)
  const shown = e => !practice(e) && (isFollowedGame(e) || onTv(e) || ((e.status.state === 'post' || past || tvUnread()) && !tvKnown(e)));
  // A league read only for a followed match in it (pickLeagues) gives that
  // match, not its other games: one New England v Miami followed isn't MLS
  // followed (the owner, 2026-11-01: every MLS game came up in 推薦).
  const own = new Set([...followedLeagues(), ...state.prefs.follows.map(f => f.league)]);
  const mine = slot.events.filter(e => shown(e) && (own.has(e.league) || isFollowedGame(e)));
  // What the reads left unknown (the day's leagues, the others', ELTA's
  // list): while any is, the day is never said to have nothing on.
  const gap = dayUnknown([slot], tvUnread());
  // Nothing of theirs and part of the day unread (a league, ELTA's list): the
  // day's shape while it's read again, up to 6 s, never a note about it
  // (Jay 2026-11-03: a day with nothing on kept loading, then an ugly message).
  if (gap && !past && h.filter === 'all' && !h.picking && !mine.length && !holdDay(box, 6_000)) return;
  // Today with every one of its games over: shown as any day gone by (its
  // picks as they stood, the results in them, 今天 · 已結束的推薦 and how
  // many, 更多推薦), not as a day still going with an ended corner.
  const todayOver = h.date === today() && mine.length > 0 && mine.every(e => e.status.state === 'post' || e.status.void) && !slot.stale && !slot.loading;
  if (todayOver) past = true;
  // 填滿空檔: every sport's games can fill a free hour (the others read alongside).
  const fillPool = () => (state.prefs.fill && h.filter !== 'teams' ? filtered((slot.others || []).filter(shown)) : []);
  if (state.prefs.fill && !slot.othersAt && !slot.othersLoading) loadOthers(h.date);
  // A day's first drawing waits in its shape (up to 6 s) for what its list
  // is made of, so no game pops in among the ones drawn and pushes them down
  // (Jay 2026-11-04: "the games often jump in"): every league of theirs (one
  // unread is asked again in 4 s; the filled games stood alone till then),
  // and with 填滿空檔 on, the others' too (read alongside: they came after).
  if (dayWaits(slot) && !h.picking && !holdDay(box, 6_000)) return;
  let [planList, more] = rank([...filtered(mine), ...fillPool()]);
  // Nothing of theirs on: the best of the rest.
  // Opened on a day with nothing of theirs, or with all of it over: the
  // next day they have games (only on a fresh read: a saved or half-read
  // day can't say there's none). 今天 on the strip still shows today's.
  // (A followed team playing now, on TV here or not, keeps 首頁 on today: it jumped to tomorrow
  // while the Lakers were on, and their game showed nowhere on 首頁, 11-12.)
  // (Nor while today still has what that next day would be picked for, a game
  // of their sport on TV here: lib/strip.mjs tvDayHas.)
  const nothingToday = !planList.length && !mine.some(e => e.status.state === 'in' || e.status.state === 'post') && !followedOnNow() && !(h.date === today() && pickDayHas(h.date, { left: true }));
  // (Only their own leagues and ELTA's list need to be in for it: one of the
  // other leagues unread kept it waiting for a retry, 4 s and more.)
  if ((nothingToday || todayOver) && h.filter === 'all' && h.autoDay && h.date === today() && state.prefs.leagues.length && !slot.stale && !slot.loading && !(slot.partial > 0) && !tvUnread()) {
    h.autoDay = false;
    h.jumping = true;
    let went = false;
    const go = d => {
      if (went) return;
      went = true;
      h.jumping = false;
      if (d) saveJump(d);
      if (d && state.home.date === today()) {
        state.home.date = d;
        stripRange.recenter = true;
        if (state.tab === 'home') renderHome();
      }
    };
    // Worked out already today (kept, and read at the open alongside today's): at once
    // (once this drawing's done).
    const kept = savedJump();
    if (kept) Promise.resolve().then(() => go(kept));
    else {
      // The next day any of their leagues plays (each one's small list of
      // game days): with a game of theirs on TV in the day's hours, it's that
      // day. Only a day without one has the seasons read to find the next on
      // TV here: read alongside, every followed league's season (about 540 KB
      // on a first open) held the day's own reads back for 10 s on a slow
      // link, and the picks jumped to it after the loading screen had lifted.
      const guess = nextLeagueDay();
      const seasons = () => nextPickDay().then(go);
      if (guess) (state.days.get(guess)?.at ? Promise.resolve() : loadDay(guess)).then(() => (pickDayHas(guess) ? go(guess) : seasons()), seasons);
      else seasons();
    }
  }
  let fallback = false;
  let finding = false;
  if (!planList.length && h.filter === 'all') {
    if (!slot.othersAt) {
      finding = true;
      loadOthers(h.date);
      // Nothing of theirs that day, the others still coming: the day's shape
      // for up to 3 s, then what there is (never 沒有轉播 said and the others'
      // games popping in under it a moment later, Jay 2026-11-03).
      if (!past && !h.picking && !holdDay(box, 3_000)) return;
    } else {
      // Worth watching on its own: the stakes and the sides, not the person's sport order
      // (their own small hours' big games kept first among the rest).
      const night = more;
      [planList, more] = rank(slot.others.filter(shown), 12, { ...pctx, sports: [], leagues: [] });
      more = [...night, ...more];
      fallback = true;
    }
  }
  // (Today over is shown as a past day: no live strip, no ended corner.)
  const isToday = h.date === today() && !todayOver;
  // Today's picks that have ended (the picks only look ahead): the day
  // ranked as it stood before, as on a past day, and what of it was on
  // show (the plan and the first of the rest) that's over now, or called
  // off (延期: still there, said so, not gone without a word).
  // (Theirs as it stood is also what their picks' finals are said for.)
  const ownWas = isToday ? rank(filtered(mine), 999, pctx, true) : [[], []];
  const [wasPlan, wasMore] = isToday ? (fallback && !filtered(mine).some(e => e.status.state === 'post') ? rank(slot.others.filter(shown), 12, { ...pctx, sports: [], leagues: [] }, true) : ownWas) : [[], []];
  // Today's that ended: the games of theirs over (or called off), by the
  // clock, never ranked again (the tables move with each result, and a
  // ranking redone put another game in a pick's place). Only their own, and
  // with 填滿空檔 on the games filled in as the day stood (lib/home-shown.mjs):
  // never the others' results (six small-hours 歐冠 games, Jay 2026-11-04).
  const endedOf = list => list.filter(e => e.status.state === 'post' || e.status.void).sort((x, y) => Date.parse(x.start) - Date.parse(y.start));
  const filledStood = state.prefs.fill && h.filter !== 'teams' ? new Set(rank([...filtered(mine), ...fillPool()], 999, pctx, true)[0].filter(x => x.filled).map(x => `${x.event.league}:${x.event.id}`)) : new Set();
  // (A league they follow: every one of its games on TV here is theirs once over, not only the
  // one or two its plan chose; Jay 2026-11-09, MLS followed: 已結束 showed 2 of the day's 15.)
  const dayGames = homeGames([...filtered(mine), ...fillPool()], { followed: e => isFollowedEvent(e) || own.has(e.league), filled: filledStood });
  // (Videos are looked ahead only for the games the plan had: a followed league's whole day is looked up on its page.)
  const planGames = homeGames([...filtered(mine), ...fillPool()], { followed: e => isFollowedEvent(e), filled: filledStood });
  const endedGames = isToday ? endedOf(dayGames.own) : [];
  const endedFilled = isToday ? endedOf(dayGames.filled) : [];
  // A light day's games over are drawn as cards with who led each side: their
  // box scores read before the day's first drawing (its shape held meanwhile,
  // 3 s at most), so the cards come whole (Jay 2026-11-05). Only while the
  // day's shape is up anyway (the day itself was being read, or the loading
  // screen): a day that's in is drawn at once, never its shape swapped in
  // mid-slide for a swipe (Jay 2026-11-05: "look like it's flickering").
  const boxGames = dayGames.own.length <= 3 ? (past ? dayGames.own : endedGames).filter(boxCard) : [];
  boxGames.forEach(readBox);
  const shapeUp = Boolean(box.querySelector(':scope > .live-shape')) || !$('loading').hidden;
  if (!slot.drawn && !h.picking && shapeUp && boxGames.some(e => homeBest.get(boxKey(e)) === null) && !holdDay(box, 3_000)) return;
  // 正在進行: today's games on now, first on 首頁 (theirs; with none of
  // theirs on, the best of everything on now), ranked like the picks, and
  // taken out of the lists below so no game shows twice.
  const onNow = list => list.filter(e => onAir(e));
  const keyOf = x => `${x.league}:${x.id}`;
  const planKeys = new Set(isToday ? (fallback ? wasPlan : ownWas[0]).map(x => keyOf(x.event)) : []);
  const isPick = x => planKeys.has(keyOf(x.event));
  homePicks.set(h.date, new Set([...planKeys, ...planList.map(x => keyOf(x.event))]));
  let liveItems = isToday ? rankOnNow(onNow(filtered(mine)), pctx, planKeys) : [];
  const liveMine = liveItems.length > 0;
  // (Never a game of a league read only for a followed match in it: one New
  // England v Miami followed put Atlanta v Toronto at the top, Jay 2026-11-03.)
  // (With 填滿空檔 off, nothing of the others: 首頁 is theirs alone, Jay 2026-11-04.)
  if (isToday && !liveItems.length && h.filter === 'all' && state.prefs.fill) liveItems = rankOnNow(onNow(dayAll(slot).filter(e => !practice(e) && onTv(e) && !matchOnly(e, own, keptGames(state.prefs.games)))), { ...pctx, sports: [], leagues: [] }, planKeys).filter(x => x.score >= 0.3);
  const allLive = isToday ? onNow(dayAll(slot)).filter(onTv).length : 0;
  // (Videos are looked up ahead only for the games over that 首頁 shows, theirs and the ones
  // 填滿空檔 put in: every league's games on the day had a phone search YouTube through the
  // proxy 80 times, one request each, on an open after a night of European cups, 2026-11-06.
  // Any other game's comes with the pack, built every hour, or is looked up when its page
  // opens: its row says 搜尋精華影片 meanwhile, the same size, and works as a link.)
  if (slot?.at) prefetchVideos([...planGames.own, ...planGames.filled]);
  // Today's picks on now first, each marked ★ 推薦, then the rest of theirs,
  // ranked. The picks as the plan has them (picks.mjs: games that don't
  // clash, a little overlap allowed, so two can be on at once), not every
  // list a day's finals are told for (three at once read as no plan at all,
  // the owner 2026-10-18): the day's plan as it stood (ranked with the games
  // already on: the picks only look ahead).
  const liveShown = liveItems.slice(0, liveMine ? 5 : 3);
  const liveKeys = new Set(liveShown.map(x => `${x.event.league}:${x.event.id}`));
  planList = planList.filter(x => !liveKeys.has(`${x.event.league}:${x.event.id}`));
  more = more.filter(x => !liveKeys.has(`${x.event.league}:${x.event.id}`));
  // The game to lead with: the best on now, else a followed team's next, else the first pick.
  const heroItem = past || h.picking ? null : liveShown[0] || planList.find(x => isFollowedEvent(x.event) && !x.event.status.void) || planList.find(x => !x.filled && !x.event.status.void) || null;
  const heroKey = heroItem ? keyOf(heroItem.event) : '';
  const liveRest = liveShown.filter(x => x !== heroItem);
  planList = planList.filter(x => x !== heroItem);
  more = more.filter(x => keyOf(x.event) !== heroKey);
  let hero = heroItem ? look.paintHero(heroGame(heroItem.event, { picked: isPick(heroItem), mine: isFollowedEvent(heroItem.event), onOpen: openEvent }), heroItem.event) : null;
  // The hero led with from the plan is today's first pick (its start notice, what the picks learn from).
  const heroPick = heroItem && !liveShown.includes(heroItem) ? [heroItem] : [];
  // The rest on now: a row each with 觀看; every game on is 轉播's.
  const liveBlock = liveRest.length
    ? section(t('liveNow'), el('div', { class: 'q-card list' }, liveRest.map(x => withWatch(eventRow(x.event), x.event))), {
        cls: 'live-now',
        action: allLive > liveShown.length ? moreButton(t('allN', { n: allLive }), () => showTab('live')) : null
      })
    : null;
  const hasFollows = state.prefs.leagues.length > 0;
  // A first pick keeps the picker up for the next ones (in order), until 完成.
  if (!hasFollows && state.prefsLoaded) h.picking = true;
  // Everything the picks lean on is in: the day read fresh, the tables,
  // the followed teams, and no search for other games or days going on.
  // (Today with nothing of theirs left, the move to their next day still to
  // come: not settled, so the loading screen never lifts on today's ended
  // games and then jumps to that day under the person's eyes.)
  const mayJump = (nothingToday || todayOver) && h.filter === 'all' && h.autoDay && h.date === today() && state.prefs.leagues.length > 0;
  h.settled = !slot.stale && !slot.loading && !finding && !h.jumping && !mayJump && !h.tablesPending && ![...h.teams.values()].includes(null);
  // (A league of theirs that didn't answer: the loading screen reads it again before it lifts.)
  h.partial = slot.partial > 0;
  // The best of the rest, by the clock (by score, a 02:45 sat above a 00:00): 稍後's 全部.
  const byStart = (x, y) => Date.parse(x.event.start) - Date.parse(y.event.start);
  // 更多賽事 is their own leagues' other games only: never the other sports'
  // games 填滿空檔 or a day with nothing of theirs read in (Jay 2026-11-04:
  // "flooded with filled in schedule games, most of them aren't my following").
  const moreAll = more.filter(x => own.has(x.event.league) || isFollowedGame(x.event)).sort(byStart);
  // Today's picks (the 今日推薦 list, not 更多推薦 or the others when none are
  // yours), for their start notices: kept when the list settles, and the
  // Worker's list sent again when they change. Their finals are said for the
  // day's picks as they stood too: one on now (正在進行, or about to start)
  // has left the list, or never was on it when the app opened.
  if (isToday && h.filter === 'all' && h.settled) {
    const picks = fallback ? [] : [...heroPick, ...planList].map(x => x.event);
    const sig = [...picks, ...ownWas[0].map(x => x.event)].map(e => `${e.league}:${e.id}:${e.start}`).join('|');
    if (sig !== state.todayPicksSig) {
      state.todayPicks = picks;
      state.todayPicksSig = sig;
      notePicked([...picks, ...ownWas[0].map(x => x.event)]);
      feedback?.shown('match', picks.map(pickItem));
      clearTimeout(pushTimer);
      pushTimer = setTimeout(syncPush, 1500);
    }
  }
  // Another day's rows: their time alone (the head says the day).
  const rowDay = { day: h.date === today() };
  // 已結束 is all their own games (as 我的比賽 is): no row lit grey or marked
  // ★ 推薦 in it, a busy day's list or a light day's cards alike (Jay 2026-11-05:
  // 10/31's four games, "only this page is marked all grey weird").
  const endedRow = { ...rowDay, mark: false };
  // Nothing of theirs: a quiet card saying why, and the way to every game.
  const note = (title, sub, go = true) => el('div', { class: 'home-note' }, [title ? el('strong', { text: title }) : null, sub ? el('p', { text: sub }) : null, go ? fullSchedule() : null]);
  // A day gone by: only theirs, the games of their own leagues (what the
  // day showed them), not every league's (the others' ten German and
  // Italian games were there too). Under the sport chosen; by the clock.
  const pastGames = past ? dayGames.own : [];
  const pastFilled = past ? dayGames.filled : [];
  // A light day (three games of theirs or fewer, a weekday's one or two,
  // Jay 2026-10-23): each game over as a card with who led each side; a
  // busy day stays a plain list. Only the day's own games.
  const light = dayGames.own.length <= 3;
  // Games 填滿空檔 filled in, over: the same quiet line as before they started, with the score.
  // (Over, a result like any other: the two sides and their scores, a row each, never the quiet one-line
  // form spread across the card with the score off at its end; Jay 2026-11-09.)
  const filledOver = list => (list.length ? el('div', { class: 'q-card list filled-over' }, list.map(e => eventRow(e, endedRow))) : null);
  // 已結束 in two groups when it has both (Jay 2026-11-10: "you used to categorize them by if you
  // recommended that game for me"): 推薦給你, the games the day's plan chose for them (a followed
  // team's, a league's chosen game, a race session) and the ones 填滿空檔 put in, then 其他比賽, the
  // rest of their leagues' games (every one since 11-09). Each group's rows stay unmarked (the head
  // says it; the grey ★ rows read "weird", 11-05); one group alone has no head.
  const gameKey = e => `${e.league}:${e.id}:${e.sessionKey || ''}`;
  const pickedKeys = new Set(planGames.own.map(gameKey));
  // (Split: the picks and the rest; grouped only when both are there.)
  const endedSplit = (own, fill) => {
    const picked = own.filter(e => pickedKeys.has(gameKey(e)));
    const others = own.filter(e => !pickedKeys.has(gameKey(e)));
    return { picked, others, grouped: (picked.length > 0 || fill.length > 0) && others.length > 0 };
  };
  const endedHead = text => el('h3', { class: 'q-list-head ended-head', text });
  // rowsOf draws the picks (or the one list), restOf the rest (a busy day's, 30 at a time); tail under the rest.
  const endedBody = (own, fill, rowsOf, { rest: restOf = rowsOf, tail = null } = {}) => {
    const { picked, others, grouped } = endedSplit(own, fill);
    if (!grouped) {
      const one = [own.length ? restOf(own) : null, tail, filledOver(fill)].filter(Boolean);
      return one.length === 1 ? one[0] : el('div', { class: 'ended-both' }, one);
    }
    return el('div', { class: 'ended-both ended-groups' }, [endedHead(t('endedPicked')), picked.length ? rowsOf(picked) : null, filledOver(fill), endedHead(t('endedOthers')), restOf(others), tail].filter(Boolean));
  };
  function pastDay() {
    const games = pastGames;
    const count = { action: el('span', { class: 'q-tag', text: t('gamesN', { n: games.length + pastFilled.length }) }) };
    if (light && (games.length || pastFilled.length)) return section(t('pastEvents'), endedBody(games, pastFilled, g => recapList(g, endedRow)), count);
    const title = t('pastEvents');
    if (!games.length && !pastFilled.length) return section(title, note('', gap === 'leagues' ? t('someUnread') : hasFollows ? t('noMineDay') : t('noFollowsYet')));
    // (A busy day: the picks whole, the rest of their leagues' games 30 at a time.)
    const { others, grouped } = endedSplit(games, pastFilled);
    const cut = grouped ? others : games;
    const tail = cut.length > h.shown ? moreToggle({ more: `${t('showMore')} (${cut.length - h.shown})`, less: null, cls: 'show-more', onToggle: () => ((h.shown += 30), renderHome()) }) : null;
    const rows = list => el('div', { class: 'q-card list' }, list.map(e => eventRow(e, endedRow)));
    return section(title, endedBody(games, pastFilled, rows, { rest: list => rows(list.slice(0, h.shown)), tail }), count);
  }
  // Shelves under the picks (each game once: the hero and 正在進行 first, then
  // 我的球隊, the picks, 今晚, the ended): my teams' games still to come, the
  // rest of the day's picks, my leagues, my teams' places in them.
  // (Today over is still today: what's next of theirs, their leagues and places stay;
  // a light day gone by keeps their leagues and places under its few games.)
  const gone = past && !todayOver && !light;
  const seenKeys = new Set([heroKey, ...liveRest.map(x => keyOf(x.event))]);
  // (A followed team's next game from its own schedule, whatever day is open, and the open day's.)
  const nextOf = f => (state.home.teams.get(`${f.league}:${f.id}`) || []).map(freshGame).filter(e => e.status?.state === 'pre' && !e.status.void && Date.parse(e.start) > now).sort((x, y) => Date.parse(x.start) - Date.parse(y.start))[0];
  // (A followed team's game on now, on TV here or not: 我的球隊 and the lead card said 下一場 11/16
  // while the Lakers were playing, as 追蹤 already showed, 11-12.)
  const onNowOf = f => (state.home.teams.get(`${f.league}:${f.id}`) || []).map(freshGame).find(e => e.status?.state === 'in' && !e.status.void) || null;
  const nextKeys = new Set();
  const mineNext = past || h.picking || !hasFollows
    ? []
    : followedTeams().map(nextOf).filter(Boolean)
        .filter(e => localDate(e.start) > h.date && !seenKeys.has(keyOf(e)) && !nextKeys.has(keyOf(e)) && nextKeys.add(keyOf(e)))
        .sort((x, y) => Date.parse(x.start) - Date.parse(y.start))
        .slice(0, 6);
  // 我的比賽 is the day's plan, one list: the games they follow first, then
  // the best of the rest in the hours left free (Jay 2026-11-03: "推薦 and
  // 我的比賽 are the same thing"; "you can't catch two"). Their teams' next
  // games on later days follow under it.
  const planShown = planList.filter(x => !seenKeys.has(keyOf(x.event)));
  planShown.forEach(x => seenKeys.add(keyOf(x.event)));
  mineNext.forEach(e => seenKeys.add(keyOf(e)));
  // 下一場 is always theirs (Jay 2026-11-03): a day with only filled games
  // leads with their own next game, whatever day it is, never a filled one.
  const mineOn = !hero && hasFollows && isToday && !h.picking && !liveBlock ? followedTeams().map(onNowOf).find(e => e && !seenKeys.has(keyOf(e))) : null;
  if (mineOn) {
    seenKeys.add(keyOf(mineOn));
    hero = look.paintHero(heroGame(mineOn, { mine: true, onOpen: openEvent }), mineOn);
  }
  if (!hero && hasFollows && !past && !h.picking && !liveBlock) {
    const next = followedTeams()
      .flatMap(f => (state.home.teams.get(`${f.league}:${f.id}`) || []).map(freshGame))
      .filter(e => e.status?.state === 'pre' && !e.status.void && Date.parse(e.start) > now && localDate(e.start) >= h.date)
      .sort((x, y) => Date.parse(x.start) - Date.parse(y.start))[0];
    if (next) {
      const i = mineNext.findIndex(e => keyOf(e) === keyOf(next));
      if (i >= 0) mineNext.splice(i, 1);
      hero = look.paintHero(heroGame(next, { mine: true, eyebrow: L({ zh: `下一場 · ${dayLabel(localDate(next.start), { long: true })}`, en: `Next · ${dayLabel(localDate(next.start), { long: true })}` }), onOpen: openEvent }), next);
    }
  }
  // (A wide screen shows them as a grid, not a rail: six, then 全部.)
  const restShown = moreAll.filter(x => !seenKeys.has(keyOf(x.event))).slice(0, screenFit().wide ? 6 : 12);
  // (我的聯賽 lives on 追蹤 now, Jay 2026-11-10: "Remove「我的聯賽」from Home and move followed-league content to「追蹤」": myLeaguesCard.)
  // (Each team once: a followed player's team is often followed too.)
  const placeSeen = new Set();
  const placeRows = gone || h.picking ? [] : followedTeams().filter(f => state.home.tables[f.league]?.[f.id]?.pos && !f.athlete && !placeSeen.has(`${f.league}:${f.id}`) && placeSeen.add(`${f.league}:${f.id}`)).slice(0, 6);
  const placesShelf = placeRows.length
    ? section(
        L({ zh: '我的球隊排名', en: 'My teams in the table' }),
        el('div', { class: 'q-rowcard' }, placeRows.map(f => {
          const r = state.home.tables[f.league][f.id];
          return el('button', { class: 'q-ritem chevron', type: 'button', onclick: () => openTeam(f.league, f.id, f) }, [
            el('span', { class: 'suggest-tile' }, [logo(f.logo || fallbackLogo(f.league, { id: f.id, name: f.name }), f.name, 'sm')]),
            el('span', { class: 'q-ritem-text' }, [el('span', { class: 'q-ritem-title', text: shownName(f) }), el('small', { text: [leagueName(f.league, locale).replace(/\s.*$/, ''), r.group && !/\d{4}/.test(r.group) && r.group !== leagueName(f.league, locale) ? r.group : ''].filter(Boolean).join(' · ') })]),
            el('b', { class: 'q-ritem-value rank-pos num', text: L({ zh: `第 ${r.pos} 名`, en: `#${r.pos}` }) })
          ]);
        }))
      )
    : null;
  // A day of others' picks: they're 推薦, their own teams' later games 我的比賽
  // in a section of their own after them (the Lakers' 11/16 read under 推薦, 11-12).
  const splitMine = !past && fallback && planShown.length > 0 && mineNext.length > 0;
  // A day with nothing on TV at all (theirs and the others', any hour): never
  // said while a game of the small hours is listed under 更多賽事.
  const nothing = !past && !h.picking && fallback && !planList.length && !restShown.length && !endedGames.length && !hero && !liveBlock;
  // The kit's empty state for a day: what's so in one line (its reason under
  // it only past ELTA's list), and every game; a day still unread after its
  // wait (`says` null): that, and a tap to read it again.
  const dayEmpty = says =>
    says
      ? kitUI.empty({ icon: 'tv', title: says.title, body: says.body || '', action: { label: L({ zh: '看完整賽程', en: 'Every game' }), onTap: () => openAll(h.date) }, cls: 'home-empty' })
      : kitUI.empty({ icon: 'tv', title: L({ zh: '這天的賽程還讀不到', en: "Couldn't read this day yet" }), action: { label: L({ zh: '再試一次', en: 'Try again' }), onTap: () => ((h.gate = null), loadDay(h.date), loadOthers(h.date), renderHome()) }, cls: 'home-empty' });
  // (Theirs unread: never said to have nothing on.)
  const noMine = slot.partial > 0 ? L({ zh: '我的聯賽還讀不到', en: "My leagues couldn't be read yet" }) : hasFollows || !state.prefsLoaded ? t(isToday ? 'noMineToday' : 'noMineDay') : t('noFollowsYet');
  // 我的球隊: each team's place in its table and its next game, its own
  // colour as a thin mark (else the places to watch, as before).
  const teamsShelf =
    !gone && !h.picking && hasFollows
      ? (() => {
          const seen = new Set();
          const rows = followedTeams()
            .filter(f => !f.athlete && !seen.has(`${f.league}:${f.id}`) && seen.add(`${f.league}:${f.id}`))
            .slice(0, 6)
            .map(f => {
              const r = state.home.tables[f.league]?.[f.id];
              const sub = [leagueName(f.league, locale).replace(/\s.*$/, ''), r?.group && !/\d{4}/.test(r.group) && r.group !== leagueName(f.league, locale) ? r.group : ''].filter(Boolean).join(' · ');
              // (Its colour from a day's scoreboard: a team's own schedule carries none.)
              const side = [...state.days.values()].flatMap(dayAll).filter(e => LEAGUES[e.league]?.sport === LEAGUES[f.league]?.sport).flatMap(e => [e.home, e.away]).find(x => String(x?.id) === String(f.id) && x.color) || null;
              return { f: { ...f, logo: f.logo || fallbackLogo(f.league, { id: f.id, name: f.name }), shown: shownName(f) }, pos: r?.pos || null, sub, next: (isToday && onNowOf(f)) || nextOf(f) || null, side };
            });
          return rows.length ? section(L({ zh: '我的球隊', en: 'My teams' }), look.teams(rows, f => openTeam(f.league, f.id, f))) : null;
        })()
      : null;
  put(
    box,
    homeBar(),
    homeFilters(),
    h.picking ? sportPicker() : null,
    // (A wide screen: the day's answer on the left, what's next of theirs on
    // the right; a tablet on its side or a computer, the board, ui.js homeBoard.)
    (screenFit().w3 ? homeLayout : cols)([
      h.picking ? null : hero,
      h.picking ? null : liveBlock,
      // A day gone by: its games, every one, by the clock, as they ended (no
      // picks: ranked again on today's tables, yesterday's changed; the owner,
      // 2026-10-18). Theirs and the others on TV, under the sport chosen.
      past ? pastDay() : null,
      // (Nothing followed yet: the sport picker above already says so; no note under it.)
      // Nothing of theirs: the others' picks under a line that says so;
      // nothing on at all, the kit's empty state (one line and the way to
      // every game; Jay 2026-11-03: the two-line card read ugly).
      past || h.picking ? null : finding ? note(noMine, t('findingOthers'), false) : fallback && planList.length && !endedGames.length ? note(noMine, t('othersSub'), false) : nothing ? dayEmpty(gap ? null : noTvTitle(h.date)) : null,
      !past && finding ? spinner() : null,
      past
        ? null
        : planShown.length || mineNext.length
          ? section(fallback && planShown.length ? t('picks') : t('myGames'), el('div', { class: 'q-card list pick-list' }, [...planShown.map(x => planRow(x, rowDay)), ...(splitMine ? [] : mineNext.map(e => eventRow(e)))]), { action: !restShown.length && moreAll.length ? moreButton(t('allN', { n: moreAll.length }), () => openMore(moreAll, rowDay)) : null })
          : finding || fallback || liveBlock || hero || h.picking || mineNext.length || restShown.length
            ? null
            : dayEmpty(gap ? null : h.filter === 'all' ? noTvTitle(h.date) : { title: t('noPicksMine') })
    ], [
      splitMine ? section(t('myGames'), el('div', { class: 'q-card list pick-list' }, mineNext.map(e => eventRow(e)))) : null,
      !past && restShown.length ? section(t('moreGames'), kitRail(restShown.map(x => x.event)), { action: moreAll.length > restShown.length ? moreButton(t('allN', { n: moreAll.length }), () => openMore(moreAll, rowDay)) : null }) : null,
      teamsShelf || placesShelf,
      endedGames.length || endedFilled.length ? section(t('pastEvents'), endedBody(endedGames, endedFilled, g => (light ? recapList(g, endedRow) : kitRail(g, endedRow))), { action: el('span', { class: 'q-tag', text: t('gamesN', { n: endedGames.length + endedFilled.length }) }) }) : null
    ])
  );
  // (Drawn: what comes later for this day goes in as it is.)
  if (!slot.stale) slot.drawn = true;
  h.drawnOnce = true;
  // Back from a sport: the page where they left it, once that day is drawn.
  if (h.backY != null && slot.drawn) {
    const y = h.backY;
    h.backY = null;
    requestAnimationFrame(() => window.scrollTo({ top: y }));
  }
  // (A finished game's top players still being read, held in their shape: the loading screen waits for them.)
  if (box.querySelector('.recap-best.q-wait')) h.settled = false;
  // An F1 session on: its live timing read now, not at the next tick.
  if (!f1Live.feed && box.querySelector('[data-f1-brief]')) pollF1Live();
  // The open day in: the days either side read meanwhile.
  if (h.settled) readAround(h.date);
}
// A light day's games over: a card each, with who led each side
// (sheets.js gameRecap); each game's leaders read once.
// Read with the day (readBox: renderHome before its first drawing, readAround
// for the days either side), so a card is drawn with its leaders already in
// (Jay 2026-11-05: "more like an empty space then it jump in"). One read
// late anyway fades in where its room was kept: only its opacity, never a move.
const homeBest = new Map();
const boxKey = e => `${e.league}:${e.id}`;
const boxCard = e => e.kind === 'match' && !e.status?.void;
function readBox(e) {
  const k = boxKey(e);
  if (!boxCard(e) || homeBest.has(k)) return;
  homeBest.set(k, null);
  finalBox(e.league, e.id)
    .then(d => homeBest.set(k, d || {}))
    .catch(() => homeBest.set(k, {}))
    .finally(() => state.tab === 'home' && renderHome());
}
function readDayBoxes(d) {
  const read = state.days.get(d);
  const own = d < today() && read?.at ? (read.events || []).filter(e => ownGame(e)) : [];
  if (own.length <= 3) own.filter(e => e.status?.state === 'post').forEach(readBox);
}
// (Each card drawn while its leaders were read: when they came, to fade them in once.)
const boxLate = new Map();
const BOX_FADE = 300;
function recapList(games, opts) {
  return el('div', { class: 'recap-list' }, games.map(e => {
    const k = boxKey(e);
    readBox(e);
    const d = homeBest.get(k);
    const lines = boxCard(e) ? gameRecap(e, d) : [];
    if (d === null) boxLate.set(k, 0);
    else if (boxLate.has(k)) {
      // (A redraw while it fades carries on from where it was: never back to clear, never cut short.)
      const since = boxLate.get(k) || (boxLate.set(k, Date.now()), Date.now());
      const gone = Date.now() - since;
      if (gone < BOX_FADE) lines[0]?.classList.add('recap-in'), lines[0]?.style.setProperty('animation-delay', `-${gone}ms`);
      else boxLate.delete(k);
    }
    const row = eventRow(e, opts);
    // The card is one game: a tap anywhere on it opens the game, but a
    // player's face or name (sheets.js gameRecap), which opens the player.
    return el('div', { class: 'q-card recap', onclick: ev => recapTap(ev, row) }, [row, ...lines]);
  }));
}
function recapTap(ev, row) {
  if (row.contains(ev.target)) return;
  const lead = ev.target.closest?.('.recap-hit')?.closest('.recap-lead');
  if (lead?.openPlayer) return lead.openPlayer();
  if (row.tagName === 'BUTTON' && !row.disabled) row.click();
}
// Cards that scroll sideways (the kit's rail).
// A rail of games as cards; a lone game as a row in a full-width card (one
// card by itself in a rail looked empty, Jay 2026-10-23).
const kitRail = (games, opts = {}) => (games.length === 1 ? el('div', { class: 'q-card list' }, [eventRow(games[0], { day: true, ...opts })]) : el('div', { class: 'q-rail score-rail' }, games.map(e => scoreCard(e, openEvent))));
// 稍後's 全部: the rest of the day worth a look, by the clock.
function openMore(items, opts) {
  const s = sheet(t('moreGames'));
  put(s.body, el('div', { class: 'q-card list' }, items.map(x => eventRow(x.event, opts))));
}
// A day with nothing on TV here, said in one line: past the end of ELTA's
// list, that end (what's after it is only guessed from its usual line-up).
function noTvTitle(date) {
  const until = tvUntil();
  if (!state.prefs.leagues.length && state.prefsLoaded) return { title: t('noFollowsYet') };
  if (until && date > until) {
    const d = new Date(`${until}T12:00:00`);
    return { title: L({ zh: `節目表只排到 ${d.getMonth() + 1}/${d.getDate()}`, en: `ELTA's guide ends ${d.getMonth() + 1}/${d.getDate()}` }), body: L({ zh: '之後的轉播是依往例預估', en: 'Later broadcasts are estimates' }) };
  }
  return { title: L({ zh: '這天沒有轉播', en: 'Nothing on TV this day' }) };
}
// Nothing on TV here that day: why (past ELTA's list, only guesses from its
// usual line-up, NBA.com's and MLS's games), and the way to every game (賽事).
function noTvText(date) {
  const until = tvUntil();
  if (until && date > until) {
    const d = new Date(`${until}T12:00:00`);
    return L({ zh: `愛爾達的節目表排到 ${d.getMonth() + 1}/${d.getDate()}，之後的轉播是依往例預估。`, en: `ELTA's schedule runs to ${d.getMonth() + 1}/${d.getDate()}; later broadcasts are estimates.` });
  }
  return t('noOthers');
}
const fullSchedule = () => goBar(L({ zh: '看完整賽程', en: 'Every game' }), () => openAll(state.home.date));
// 首頁's day: the date strip at the top, always on screen (it sticks under
// the status bar while the page scrolls), today in the middle; a swipe
// across the page goes a day either way (daySwipe). Under it, what to show
// (every game, the followed teams', one sport: then only the days it plays).
// Nothing while still picking sports.
const homeBarEl = el('div', { class: 'q-day-bar day-bar' });
function pickHomeDay(d) {
  const h = state.home;
  if (d === h.date) return;
  h.date = d;
  h.shown = 20;
  h.autoDay = false;
  // (Their own day now: 全部 or 我的比賽 stays on it, not the one before a sport's chip.)
  h.kept = null;
  toPageTop();
  renderHome();
}
function homeBar() {
  const h = state.home;
  if (h.picking) return null;
  const sport = SPORTS[h.filter] ? h.filter : null;
  const days = sport ? h.sportDays.get(sport) : null;
  const strip = dateStrip(h.date, pickHomeDay, { follow: true, only: days?.size ? days : null, bounds: sport ? unionBounds(allBounds, Object.keys(LEAGUES).filter(k => LEAGUES[k].sport === sport)) : homeBounds() });
  put(homeBarEl, strip);
  return homeBarEl;
}
function homeFilters() {
  const h = state.home;
  if (h.picking || !state.prefs.leagues.length) return null;
  const filters = [['all', t('f_all')], ...(watched().length ? [['teams', t('f_mine')]] : state.prefs.follows.length ? [['teams', t('f_teams')]] : []), ...homeSports().filter(isActiveSport).map(sp => [sp, L(SPORTS[sp])])];
  if (filters.length < 3) return null;
  return el('div', { class: 'q-chips day-filters q-texttabs', 'data-noswipe': '' }, filters.map(([k, label]) => el('button', { class: 'q-chip', type: 'button', 'aria-pressed': String(h.filter === k), text: label, onclick: () => h.filter !== k && ((stripRange.recenter = true), pickFilter(k)) })));
}
// A day changed from below the top: the page starts at its top (the strip stays in view).
function toPageTop() {
  if (window.scrollY > 0) window.scrollTo({ top: 0 });
}
// The strip sticks under the status bar, taking the page's colour there, and a
// swipe across a page goes a day either way: the kit's (.q-day-bar, daySwipe).
// The day a strip shows next to `date`, `dir` days on (among its chips: a
// sport's game days, the bounds), or null at an end.
function stripStep(range, date, dir) {
  const days = [...(range.strip?.row.children || [])].map(c => c.dataset.day);
  const i = days.indexOf(date);
  return i < 0 ? null : days[i + dir] || null;
}
// A sport's days read (again): one with a league unread is read again (15
// seconds on), keeping the days it had (a day never drops off the strip
// because a league failed once).
const needDays = sp => {
  const had = state.home.sportDays.get(sp);
  return !had || (had.failed && Date.now() - had.at > 15_000);
};
// (One read at a time per sport: the boot's early one and the jump's are the same.)
const sportDaysReading = new Map();
async function readSportDays(sp) {
  const h = state.home;
  if (!sportDaysReading.has(sp)) sportDaysReading.set(sp, sportDays(sp).catch(() => null).finally(() => sportDaysReading.delete(sp)));
  const days = await sportDaysReading.get(sp);
  if (!days) return null;
  const old = h.sportDays.get(sp);
  if (days.failed && old) for (const d of old) days.add(d);
  days.at = Date.now();
  if (days.size || !days.failed) h.sportDays.set(sp, days);
  return days;
}
// The first day after today any followed sport plays on TV here.
async function nextPickDay() {
  const h = state.home;
  const sets = await Promise.all(
    followedSports().map(async sp => {
      if (needDays(sp) && tvReady()) await readSportDays(sp);
      return h.sportDays.get(sp) || new Set();
    })
  );
  return [...new Set(sets.flatMap(x => [...x]))].filter(d => d > today()).sort()[0] || null;
}
async function pickFilter(k) {
  const h = state.home;
  // Back from a sport to 全部 or 我的比賽: the day and the place they were on (lib/strip.mjs sportBack).
  const way = sportBack(h.kept, { from: Boolean(SPORTS[h.filter]), to: Boolean(SPORTS[k]), date: h.date, y: window.scrollY });
  h.kept = way.kept;
  if (way.back) {
    h.date = way.back.date;
    h.backY = way.back.y;
    // (The day they were on stays: today's games over never moves it on to the next day now.)
    h.autoDay = false;
  }
  h.filter = k;
  h.shown = 20;
  renderHome();
  if (!SPORTS[k]) return;
  // The days are the ones on TV here: worked out once the TV lists are in
  // (they repaint, and pick again, when they come), and not kept when the
  // leagues couldn't be read.
  if (needDays(k)) {
    if (!tvReady()) return;
    const days = await readSportDays(k);
    if (!days) return;
    if (days.failed) setTimeout(() => h.filter === k && pickFilter(k), 16_000);
    if (!h.sportDays.has(k)) return;
  }
  const days = h.sportDays.get(k);
  if (h.filter !== k) return;
  // The day left from when it plays then, else its next (today included), else its latest:
  // never the day another sport's chip moved to (lib/strip.mjs sportDay).
  h.date = sportDay(days, { from: h.kept?.date || h.date, today: today() });
  renderHome();
}
// The days (the date strip's stretch so far) a followed sport's leagues play
// on TV here.
async function sportDays(sport) {
  const leagues = pickLeagues().filter(k => LEAGUES[k].sport === sport);
  const from = addDays(today(), stripRange.from);
  const to = addDays(today(), stripRange.to);
  let failed = 0;
  const miss = () => (failed++, []);
  // Each league's season from the nightly packs (one read each, not a
  // scoreboard per day of the strip's two and a half months).
  const lists = await Promise.all(leagues.map(k => seasonEvents(k).catch(miss)));
  const now = Date.now();
  const days = new Set();
  days.failed = failed;
  for (const e of lists.flat().flatMap(x => (x.sessions ? splitWeekend(x, now, locale) : [x]))) {
    if (e.status?.void || practice(e) || !(onTv(e) || ((e.status?.state === 'post' || tvUnread()) && !tvKnown(e)))) continue;
    const ms = officialMs(e);
    const d = localDate(ms);
    if (inPickDay(ms, d) && d >= from && d <= to) days.add(d);
  }
  return days;
}

// First run: the sports, tapped in order of priority, drawn like 追蹤's
// suggestions: each a card with its leagues' marks and names, + turning into
// its place in the order once tapped; 完成 when there's one.
function sportPicker() {
  const mine = followedSports();
  return el('section', { class: 'q-section sport-picker' }, [
    el('div', { class: 'q-section-head' }, [el('h2', { text: L({ zh: '選擇你的運動', en: 'Pick your sports' }) }), mine.length ? el('span', { class: 'sp-count num', text: L({ zh: `已選 ${mine.length}`, en: `${mine.length} picked` }) }) : null]),
    el(
      'div',
      { class: 'sport-grid' },
      Object.entries(SPORTS)
        .filter(([k]) => isActiveSport(k))
        .map(([k, sp]) => {
          const i = mine.indexOf(k);
          const all = leaguesOf(k).sort((a, b) => Boolean(LEAGUES[b].top) - Boolean(LEAGUES[a].top));
          return sportTile({ key: k, name: L(sp), marks: all.slice(0, 3).map(x => leagueMark(x)), order: i >= 0 ? i + 1 : 0, onclick: () => toggleSport(k) });
        })
    ),
    mine.length ? el('button', { class: 'q-btn primary block sp-done', type: 'button', text: L({ zh: '完成', en: 'Done' }), onclick: () => ((state.home.picking = false), renderHome()) }) : null
  ]);
}

// ---- 轉播: what's on TV in Taiwan, now and next ----------------------------------------------
//
// The one place for when and where: what's on now (觀看), your teams',
// players' and matches' games on TV this week (one list, by day), what
// starts in the next hours, what just ended, and ELTA's whole guide a tap
// away. (首頁 recommends, 賽事 browses a league, 追蹤 is how your teams
// and players are doing.)

// A day's events: the followed leagues' and, once read, the others' and the rest's.
function dayAll(slot) {
  const seen = new Set();
  return [...(slot?.events || []), ...(slot?.others || []), ...(slot?.rest || [])].filter(e => !seen.has(`${e.league}:${e.id}`) && seen.add(`${e.league}:${e.id}`));
}
const liveGate = { drawn: false, since: 0, timer: 0 };
const liveShape = () =>
  el('div', { class: 'live-shape', 'aria-hidden': 'true' }, [
    el('div', { class: 'skel-hero' }),
    el('div', { class: 'q-card list' }, Array.from({ length: 4 }, () => el('div', { class: 'event-row skel-row' }, [skeleton([30, 70, 60])])))
  ]);
// 轉播's days: yesterday's (replays) to two weeks on (ELTA's list), a strip like 首頁's.
const liveRange = { from: -1, to: 13 };
const liveBarEl = el('div', { class: 'q-day-bar day-bar' });
// (null: today, whichever day that is now.)
const liveDay = () => state.live.date || today();
function pickLiveDay(d) {
  if (d === liveDay()) return;
  state.live.date = d === today() ? null : d;
  toPageTop();
  renderLive();
}
function liveBar() {
  const d = liveDay();
  put(liveBarEl, dateStrip(d, pickLiveDay, { range: liveRange, bounds: homeBounds(), follow: true }));
  return liveBarEl;
}
function renderLive() {
  const box = $('panel-live');
  if (liveDay() !== today()) return renderLiveDay(liveDay());
  const slot = state.days.get(today());
  if (!slot?.at || !tvReady()) {
    if (!slot?.loading && !slot?.at) loadDay(today());
    // (The other leagues read alongside, not after.)
    const now = state.days.get(today());
    if (now && !now.othersAt && !now.othersLoading) loadOthers(today());
    put(box, liveBar(), box.querySelector('.live-shape') || liveShape());
    return;
  }
  loadFollowedTeams();
  if (!slot.othersAt && !slot.othersLoading) loadOthers(today());
  else if (slot.othersAt && !slot.restAt && !slot.restLoading) loadRest(today());
  const now = Date.now();
  // Today's and (once read) tomorrow's games by the clock, the small hours included.
  const byKey = new Map();
  for (const d of [today(), addDays(today(), 1)]) for (const [k, e] of rawDays.get(d) || []) if (!byKey.has(k) || e.status.state === 'in') byKey.set(k, e);
  const keys = new Set();
  // Only what's on TV in Taiwan (賽事 has every game).
  const all = [...dayAll(slot), ...byKey.values()].filter(e => !keys.has(`${e.league}:${e.id}:${e.sessionKey || ''}`) && keys.add(`${e.league}:${e.id}:${e.sessionKey || ''}`)).filter(onTv);
  // Every game on now, in 首頁's order (rankOnNow).
  const live = rankOnNow(all.filter(e => onAir(e)), pickContext(slot, now)).map(x => x.event);
  // Nothing on: the next 24 hours, so tomorrow's too.
  const tomorrow = addDays(today(), 1);
  const next = state.days.get(tomorrow);
  if (!next?.at && !next?.loading) loadDay(tomorrow);
  else if (next?.at && !next.othersAt && !next.othersLoading) loadOthers(tomorrow);
  const reading = !next?.at || !slot.othersAt || !next.othersAt;
  // A league's games or ELTA's list unread: never "nothing on" (dayUnknown).
  const gap = dayUnknown([slot, next], tvUnread(), { rest: true });
  // Drawn once everything's in (the other leagues, tomorrow's, every league
  // on now, the followed teams' schedules), or after 3 s with what there is:
  // drawn on each arrival, the rows reshuffled under the finger as games
  // slotted in among them. Meanwhile, its shape.
  if (!liveGate.drawn) {
    const ready = !reading && slot.restAt && ![...teamsAt.values()].includes('loading');
    liveGate.since ||= now;
    if (!ready && now - liveGate.since < 3_000) {
      clearTimeout(liveGate.timer);
      liveGate.timer = setTimeout(() => state.tab === 'live' && renderLive(), liveGate.since + 3_000 - now);
      if (!box.querySelector('.live-shape')) put(box, liveBar(), liveShape());
      return;
    }
    liveGate.drawn = true;
    clearTimeout(liveGate.timer);
  }
  const ahead = all;
  // What starts next: within 3 hours while games are on, else (or with nothing that soon) the next 24.
  const startsWithin = hours => ahead.filter(e => e.status.state === 'pre' && !e.status.void && !onAir(e, now) && Date.parse(e.start) - now < hours * 3_600_000 && Date.parse(e.start) > now - 15 * 60_000).sort((a, b) => a.start.localeCompare(b.start));
  const soonShort = live.length ? startsWithin(3) : [];
  const soon = soonShort.length ? soonShort : startsWithin(24);
  // A game on now: its row, and 觀看 beside it (straight into ELTA.tv's or Apple TV's app).
  const liveRow = e => withWatch(eventRow(e), e);
  // The next to start (a followed team's if one is within the hour of the first).
  const first = soon[0];
  const nextUp = first && (soon.find(e => isFollowedEvent(e) && Date.parse(e.start) - Date.parse(first.start) < 3_600_000) || first);
  // Yours on TV this week, by day (once their schedules are in), not the ones
  // already up there; and they aren't listed again among the next hours'.
  const key = e => `${e.league}:${e.id}:${e.sessionKey || ''}`;
  const above = new Set([...live, ...(live.length ? [] : [nextUp].filter(Boolean))].map(key));
  const mine = myTvGames().filter(e => !above.has(key(e)) && e.status.state !== 'in');
  const mineKeys = new Set(mine.map(key));
  const byDay = new Map();
  for (const e of mine) {
    const d = localDate(Date.parse(e.start));
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(e);
  }
  const mineBlock = byDay.size
    ? section(t('myGames'), el('div', { class: 'by-day mine-list' }, [...byDay].map(([d, list]) => [el('p', { class: 'day-head', text: dayLabel(d, { long: true }) }), el('div', { class: 'q-card list' }, list.map(e => eventRow(e, { day: false })))]).flat()), {
        action: el('span', { class: 'q-tag tint', text: L({ zh: `${TV_DAYS} 天`, en: `${TV_DAYS} days` }) })
      })
    : null;
  const later = soon.filter(e => (e !== nextUp || live.length) && !mineKeys.has(key(e)));
  const wait = nextUp ? Math.max(0, Date.parse(nextUp.start) - now) : 0;
  const waitText = wait < 60_000 ? L({ zh: '馬上', en: 'any minute' }) : wait < 3_600_000 ? L({ zh: `${Math.round(wait / 60_000)} 分鐘後`, en: `in ${Math.round(wait / 60_000)} min` }) : ((m = Math.round(wait / 60_000)) => L({ zh: `${Math.floor(m / 60)} 小時 ${m % 60} 分後`, en: `in ${Math.floor(m / 60)} h ${m % 60} min` }))();
  // The game to lead with: the first on now (首頁's), else the next to start.
  const heroEvent = live[0] || nextUp || null;
  const hero = heroEvent ? heroGame(heroEvent, { mine: isFollowedEvent(heroEvent), picked: pickedToday().has(`${heroEvent.league}:${heroEvent.id}`), eyebrow: live.length ? '' : L({ zh: `下一場 · ${waitText}`, en: `Next · ${waitText}` }), onOpen: openEvent }) : null;
  const guide = guideItems().some(p => p.end > now) ? guideLink(all) : null;
  // (Nothing else on the right, a quiet day: ELTA's next showings there with the
  // guide, beside the next game, not the guide under it and half the page empty.)
  const rightEmpty = !mineBlock && !later.length;
  const nextShows = rightEmpty && guide ? guideItems().filter(p => p.start > now && !(heroEvent && p.league === heroEvent.league && tvOf(heroEvent).some(b => b.at === p.start))).slice(0, 5) : [];
  // (ELTA lists nothing more: today's games already over, their replays, there instead.)
  const doneToday = rightEmpty && !nextShows.length ? all.filter(e => e.status.state === 'post' && !e.status.void && inDay(Date.parse(e.start), today())).sort((a, b) => b.start.localeCompare(a.start)).slice(0, 8) : [];
  const beside = !rightEmpty
    ? null
    : nextShows.length
      ? section(L({ zh: '接下來的轉播', en: 'Next on TV' }), el('div', { class: 'by-day' }, [...new Set(nextShows.map(p => localDate(p.start)))].flatMap(d => [el('p', { class: 'day-head', text: dayLabel(d, { long: true }) }), el('div', { class: 'q-card list tv-guide' }, nextShows.filter(p => localDate(p.start) === d).map(p => guideRow(p, all, now)))])))
      : doneToday.length
        ? section(L({ zh: '今天稍早', en: 'Earlier today' }), el('div', { class: 'q-card list' }, doneToday.map(e => eventRow(e, { day: false }))))
        : null;
  put(
    box,
    liveBar(),
    // (A wide screen: what's on now on the left, what's next on the right.)
    cols(
      [
        hero,
        !hero ? (reading && !gap ? spinner() : el('div', { class: 'home-note' }, [el('strong', { text: gap ? t('liveUnread') : L({ zh: '接下來一天沒有比賽', en: 'Nothing in the next day' }) })])) : null,
        beside ? null : guide,
        live.length > 1 ? section(t('liveNow'), el('div', { class: 'q-card list' }, live.slice(1).map(liveRow)), { cls: 'live-now' }) : null
      ],
      [mineBlock, later.length ? section(t('upcomingEvents'), el('div', { class: 'q-card list' }, later.slice(0, 30).map(e => eventRow(e)))) : null, beside, beside ? guide : null]
    )
  );
}
// Another day on 轉播: everything on TV here that day by the clock (the
// small hours too), its best game first: a followed team's, else the one
// the picks rank highest. A day gone by shows its results and replays.
function renderLiveDay(d) {
  const box = $('panel-live');
  const slot = state.days.get(d);
  // Drawn once the day's leagues, the others' and ELTA's list are in (never filled in under the finger).
  if (!slot?.at || !slot.othersAt || !tvReady()) {
    if (!slot?.at && !slot?.loading) loadDay(d);
    // (The other leagues read alongside the day's, not after.)
    const now = state.days.get(d);
    if (now && !now.othersAt && !now.othersLoading) loadOthers(d);
    if (!box.querySelector('.live-shape')) put(box, liveBar(), liveShape());
    else put(box, liveBar(), box.querySelector('.live-shape'));
    return;
  }
  const now = Date.now();
  const past = d < today();
  const seen = new Set();
  const list = [...dayAll(slot), ...(rawDays.get(d)?.values() || [])]
    .map(freshGame)
    .filter(e => inDay(Date.parse(e.start), d) && !practice(e) && !seen.has(dayKey(e)) && seen.add(dayKey(e)))
    .filter(e => onTv(e) || isFollowedGame(e) || ((e.status.state === 'post' || past) && !tvKnown(e)))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const c = { leagues: state.prefs.leagues, follows: state.prefs.follows, games: state.prefs.games.map(gameKey), tables: state.home.tables, now, featured: featuredIn(list), chosen: chosenGames(), ...theirs(now) };
  const ranked = list.filter(e => !e.status.void).map(e => ({ e, mine: isFollowedEvent(e), score: scoreMatch(e, c).score })).sort((x, y) => y.mine - x.mine || y.score - x.score);
  const top = ranked[0]?.e || null;
  const hero = top ? heroGame(top, { mine: isFollowedEvent(top), eyebrow: top.status.state === 'pre' ? dayLabel(d, { long: true }) : '', onOpen: openEvent }) : null;
  const rest = list.filter(e => e !== top);
  const gap = dayUnknown([slot], tvUnread());
  const guide = !past && guideItems().some(p => p.end > now && localDate(p.start) === d) ? guideLink(list, d) : null;
  put(
    box,
    liveBar(),
    cols(
      [hero, !hero ? el('div', { class: 'home-note' }, [el('strong', { text: gap ? t('liveUnread') : L({ zh: '這天沒有轉播', en: 'Nothing on TV that day' }) }), d > (tvUntil() || d) ? el('p', { text: noTvText(d) }) : null]) : null, guide],
      [rest.length ? section(L({ zh: '當天轉播', en: 'On TV that day' }), el('div', { class: 'q-card list' }, rest.map(e => eventRow(e, { day: false }))), { action: el('span', { class: 'q-tag', text: t('gamesN', { n: list.length }) }) }) : null]
    )
  );
}
// ---- 愛爾達's guide -------------------------------------------------------------------------
//
// Every showing on ELTA.tv's channels (its own list, about two weeks), the
// same game on several channels as one, and after the list NBA.com's ELTA
// games (channel to come). A showing reads short: the time, the league, the
// two sides (or the event), one detail (the round or stage), and each
// channel with its commentary.
const AUDIO_SHORT = { en: { zh: '英', en: 'EN' }, dual: { zh: '雙語', en: 'Dual' }, venue: { zh: '中', en: 'ZH' }, local: { zh: '雙語', en: 'ZH×2' }, zh: { zh: '中', en: 'ZH' }, data: { zh: '數據', en: 'Data' }, cam: { zh: '球員', en: 'Cam' } };
const STAGE_WORD = /(熱身賽|例行賽|季後賽|外卡賽|分區系列賽|聯盟冠軍賽|世界大賽|總冠軍賽|準決賽|決賽|\d+強|第\d+輪|第\d+比賽日|排位賽|衝刺排位賽|衝刺賽|正賽|第\d節自由練習)/;
function guideItems() {
  const shows = new Map();
  for (const p of eltaSchedule() || []) {
    if (!eltaChannel(p.ch).url) continue;
    const key = `${p.start}|${p.league}|${p.teams.join('|') || p.title}`;
    if (!shows.has(key)) shows.set(key, { ...p, channels: [] });
    shows.get(key).channels.push({ ch: p.ch, audio: p.audio, adFree: p.adFree });
  }
  // MAX (no ads) first: 觀看 opens the first.
  for (const p of shows.values()) p.channels.sort((a, b) => channelRank(a, state.prefs.audio || 'en') - channelRank(b, state.prefs.audio || 'en') || a.ch - b.ch);
  return [...shows.values(), ...nbaAfterList()].sort((a, b) => a.start - b.start);
}
const guideTitle = p => (p.teams.length === 2 ? `${p.teams[0]} vs ${p.teams[1]}` : p.title.replace(/[【（(][^】）)]*[】）)]/g, '').replace(STAGE_WORD, '').trim() || p.title);
const guideDetail = p => STAGE_WORD.exec(p.title)?.[1] || '';
function guideRow(p, events, now) {
  const on = p.start <= now && p.end > now;
  const e = events.find(x => x.league === p.league && tvOf(x).some(b => p.channels.some(c => c.ch === b.ch) && b.at === p.start));
  const detail = guideDetail(p);
  return el('div', { class: `tvg-row${on ? ' on' : ''}` }, [
    el('b', { class: 'tvg-time num', text: on ? L({ zh: '播出中', en: 'Live' }) : clock(new Date(p.start).toISOString()) }),
    el('button', { class: 'tvg-body', type: 'button', disabled: e && !e.status?.void ? null : true, onclick: () => e && openEvent(e) }, [
      el('span', { class: 'tvg-head' }, [leagueMark(p.league, 'lg-mark xs'), el('strong', { class: 'tvg-title', text: guideTitle(p) })]),
      el('span', { class: 'tvg-chs' }, [
        detail ? el('small', { class: 'tvg-detail', text: detail }) : null,
        ...(p.channels.length
          ? p.channels.map(c => el('span', { class: `tvg-ch${hasAudio(c, state.prefs.audio || 'en') ? ' mine' : ''}` }, [L(eltaChannel(c.ch).short).replace(/^愛爾達/, '體育'), el('i', { text: L(AUDIO_SHORT[c.audio] || AUDIO_SHORT.zh) })]))
          : [el('span', { class: 'tvg-ch tbd', text: L({ zh: '頻道待公布', en: 'Channel TBA' }) })])
      ])
    ]),
    on && p.channels[0] ? watchLink(eltaChannel(p.channels[0].ch), { class: 'tvg-watch', text: L({ zh: '觀看', en: 'Watch' }) }) : null
  ]);
}
// 轉播's way into the guide: a row of its own under the hero (the owner,
// 2026-10-23: a small 節目表 link at a section's edge went unseen).
const guideLink = (events, day = null) =>
  el('div', { class: 'q-rowcard guide-link' }, [
    el('button', { class: 'q-ritem chevron', type: 'button', onclick: () => openGuide(events, day) }, [
      el('span', { class: 'q-tile', 'aria-hidden': 'true', html: icon('tv') }),
      el('span', { class: 'q-ritem-text' }, [el('span', { class: 'q-ritem-title', text: L({ zh: '愛爾達節目表', en: 'ELTA TV guide' }) }), el('small', { text: L({ zh: '每個頻道、每一天的轉播', en: 'Every channel, every day' }) })])
    ])
  ]);
// The whole guide, a day at a time: the kit's day strip (every app's), the
// day's showings in one card.
function openGuide(events, from = null) {
  // Full height from the start: a day of two showings and a day of twenty
  // the same sheet, never growing or shrinking as the days go by (Jay 2026-11-05).
  const s = sheet(L({ zh: '愛爾達節目表', en: 'ELTA TV guide' }), { full: true });
  const items = guideItems();
  const days = [...new Set(items.map(p => localDate(p.start)))].filter(d => d >= today());
  let day = days.includes(from) ? from : days[0];
  const strip = {};
  const paint = () => {
    const now = Date.now();
    const list = items.filter(p => localDate(p.start) === day && (day !== today() || p.end > now));
    put(
      s.body,
      kitUI.dayBar(strip, { flat: true, days, current: day, today: today(), bounds: { from: days[0], to: days.at(-1) }, clamp: v => days.find(d => d >= v) ?? days.at(-1), onPick: d => ((day = d), paint()) }),
      list.length ? el('div', { class: 'q-card list tv-guide' }, list.map(p => guideRow(p, events, now))) : empty(L({ zh: '這天沒有節目。', en: 'Nothing that day.' })),
      el('p', { class: 'section-sub', text: L({ zh: '需訂閱 ELTA.tv', en: 'Needs ELTA.tv' }) })
    );
  };
  paint();
  // A swipe across the guide: the day before or after, as on 轉播 under it
  // (Jay 2026-11-05, "愛爾達節目表 can't swipe": the page's swipe stops
  // under a sheet, and this one had none of its own).
  kitUI.daySwipe?.(s.body, dir => {
    const d = days[days.indexOf(day) + dir];
    return Boolean(d && ((day = d), paint(), true));
  });
}

// ---- 賽事: every sport, league and game day ------------------------------------------------------

function openScores(league, date, view = 'games') {
  state.scores = { ...state.scores, sport: LEAGUES[league].sport, league, date: date || null, picked: Boolean(date), chosen: date ? chosenOf(date, today()) : state.scores.chosen ?? null, byDay: null, days: [], extra: 0, stage: 'all', touched: true, view: hasStandings(league) ? view : 'games', q: '' };
  // Opened from a search: the search is done (its box emptied), the league shows.
  clearSearch();
  if (state.tab === 'matches') loadScores();
  else showTab('matches');
}

// Which days (or weeks) to read, then the games of each, grouped by the
// viewer's own day: the strip shows only days with games. Races, tours and
// fight promotions: the whole season, past and to come.
// ---- The playoffs or a cup's knockout rounds ----------------------------------------
//
// Every league with playoffs or knockout rounds (lib/playoffs.mjs): the real
// games while they're on (MLB, the NBA, MLS: the days around now; a cup:
// its season's games), the first round predicted from the table while the
// season's on, last season's when this one hasn't begun. Read once a league
// is opened, kept 10 minutes (`brackets`, kept up by chosenGames, which reads them too).
// The NBA Cup's knockout (lib/playoffs.mjs nbaCupRound): a bracket of its own
// beside the NBA's playoffs, kept as 'nbacup', drawn with the NBA's logos and sheets.
const CUP = 'nbacup';
const leagueOfBracket = k => (k === CUP ? 'nba' : k);
const hasBracket = k => k === CUP || (LEAGUES[k]?.kind === 'match' && (!LEAGUES[k].asia || k === 'cpbl') && Boolean(FORMATS[k]));
// The bracket 賽事 shows now: the open league's, or the NBA Cup's when it's picked.
const shownBracket = () => (state.tab !== 'matches' ? '' : state.scores.league === 'nba' && cupPicked(state.scores) ? CUP : state.scores.league);
// The NBA's 季後賽: the playoffs or the NBA Cup, a chip each (the cup's
// groups and knockout one view: Jay, 2026-10-26); the cup's picked first
// while it's played (November, December).
const cupPicked = sc => {
  if (sc.po == null) sc.po = [11, 12].includes(new Date(Date.now() + 8 * 3_600_000).getUTCMonth() + 1) ? 'cup' : 'po';
  return sc.po !== 'po';
};
const played = r => Number(r.stats?.GP ?? r.stats?.gamesPlayed ?? 0) || Number(r.stats?.W || 0) + Number(r.stats?.L || 0);
// Playoff games read back a week of game days at a time from the latest of
// `days`, until a week with none (the regular season): one small batch after
// another, never a season's days at once (MLB's were 85 pages, the NBA's last
// season 70, enough to hit the proxy's limit and fail every league after).
// A week unread is a failure (thrown), never "the playoffs are over".
async function playoffWeeks(league, days, ttl) {
  const today = yyyymmdd(new Date());
  const ms = d => Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6));
  const out = [];
  for (let i = 0; i < days.length; ) {
    let j = i;
    while (j < days.length && ms(days[j]) > ms(days[i]) - 7 * 86_400_000) j++;
    const week = days.slice(i, (i = j));
    const games = (await scoreboard(league, week, ttl)).filter(e => e.round);
    out.push(...games);
    if (!games.length && week[0] < today) break;
  }
  return out;
}
// The playoffs so far: from the next two and a half weeks back (MLS's first
// round on ESPN's schedule twelve days before it, Jay 2026-11-10: "display the schedule").
// (A round begun in that time is read to its own last day: MLS's best-of-three first round runs
// 11/21–12/2, its games 2 and 3 past the 17 days, so a series showed only its first game, Jay 2026-11-10.)
async function postseason(league) {
  const cal = await seasonCalendar(league);
  const from = yyyymmdd(new Date(Date.now() - 80 * 86_400_000));
  const soon = yyyymmdd(new Date(Date.now() + 17 * 86_400_000));
  const ends = Object.values(FORMATS[league]?.official || {}).flatMap(y => Object.values(y)).filter(d => d[0].replaceAll('-', '') <= soon).map(d => d.at(-1).replaceAll('-', ''));
  const to = [soon, ...ends].sort().at(-1);
  return playoffWeeks(league, (cal?.days || []).filter(d => d >= from && d <= to).reverse());
}
// Last season's playoffs: from the end of its calendar back (kept a month on the phone: it's over).
async function lastSeason(league, info) {
  const start = Date.parse(info?.season?.start || '') || Date.now();
  const prev = await seasonInfo(league, yyyymmdd(new Date(start - 3 * 86_400_000)));
  const events = await playoffWeeks(league, (prev?.days || []).slice(-90).reverse(), 30 * 86_400_000);
  // Every league here had playoffs: none found is a read gone wrong.
  if (!events.length) throw new Error(`${league}: last playoffs unread`);
  return { mode: 'last', events, season: prev?.season?.name || '' };
}
// CPBL's: this season's play-off games (its own lists), else the table's
// prediction while the season's on (March to October), else last year's.
async function cpblPlayoffData() {
  const [pack, groups] = await Promise.all([cpblPack(), standings('cpbl')]);
  const seeds = cpblSeeds(pack);
  const year = new Date(Date.now() + 8 * 3_600_000).getUTCFullYear();
  const events = (await asiaEvents('cpbl', 1)).filter(e => e.round && Date.parse(e.start) >= Date.UTC(year, 0, 1));
  if (events.length) return { mode: 'live', events, groups, seeds, season: String(year) };
  const month = new Date(Date.now() + 8 * 3_600_000).getUTCMonth() + 1;
  if (pack?.year === year && month >= 3 && month <= 10 && seeds) return { mode: 'projected', events: [], groups, seeds, season: String(year) };
  const last = (await asiaEvents('cpbl', 0, Date.UTC(year - 1, 9, 20))).filter(e => e.round);
  // Last year's seeds aren't this pack's: its games say who met whom.
  if (!last.length) throw new Error('cpbl: last playoffs unread');
  return { mode: 'last', events: last, groups: null, seeds: null, season: String(year - 1) };
}
// The NBA Cup's: this season's once its group play is on the schedule (the
// draw known, every record 0-0 till the first night), else last season's
// (kept a month: it's over). Group play from its nights (October 28 to
// November 30), the knockout from December 1 to 18: each day's page (ESPN
// answers no stretch of days for the NBA: "20251201-20251222" a 400), its
// 52 pages in the kit's batches of 24.
// It came up "暫時無法取得資料" now and then (Jay, 2026-10-28): one week of
// pages refused failed the whole cup. Now a week unread is asked again, days
// still missing make it `partial` (read again in a minute, what came shown),
// days three or more off are kept 30 minutes (not re-read every time), and
// the season's year never waits on another read.
async function nbaCupData() {
  const info = await seasonInfo('nba').catch(() => null);
  // (The season starts in October: from August on, this year's.)
  const tw = new Date(Date.now() + 8 * 3_600_000);
  const y = info?.season?.start ? new Date(Date.parse(info.season.start)).getUTCFullYear() : tw.getUTCMonth() >= 7 ? tw.getUTCFullYear() : tw.getUTCFullYear() - 1;
  const dates = (from, n) => Array.from({ length: n }, (_, i) => yyyymmdd(new Date(Date.UTC(from.y, from.m - 1, from.d + i, 12))));
  const missing = new Set();
  const week = async (days, keep) => {
    const got = await scoreboard('nba', days, keep, 30 * 60_000).catch(() => null);
    if (got && !got.unread) return got;
    // Asked again once (a batch's slow item, a refused minute), whatever's still unread noted.
    await new Promise(r => setTimeout(r, 1_500));
    const again = await scoreboard('nba', got ? got.unread : days, keep, 30 * 60_000).catch(() => null);
    for (const d of again ? again.unread || [] : got ? got.unread : days) missing.add(d);
    return [...(got || []), ...(again || [])];
  };
  // The weeks side by side (the kit puts them in batches of 24 a call): one
  // after another, a first read took most of a minute.
  const read = async (days, keep) => {
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(week(days.slice(i, i + 7), keep));
    return (await Promise.all(weeks)).flat();
  };
  const ko = list => list.flatMap(e => {
    const round = nbaCupRound(e);
    // (A single game: the regular season's meetings ESPN counts as a series aren't its.)
    return round ? [{ ...e, round, series: null }] : [];
  });
  // Group play and the knockout read together.
  const season = async (year, keep) => {
    const [all, knock] = await Promise.all([read(dates({ y: year, m: 10, d: 28 }, 34), keep), read(dates({ y: year, m: 12, d: 1 }, 18), keep)]);
    const seen = new Set();
    const groupGames = all.filter(e => isGroupPlay(e) && !seen.has(e.id) && seen.add(e.id));
    return groupGames.length ? { groupGames, events: ko(knock), season: `${year}-${String(year + 1).slice(2)}` } : null;
  };
  // Last regular season's records (the cup's fifth tiebreak): ESPN numbers a season by the year it ends.
  const prevOf = year =>
    standings('nba', { season: year })
      .then(gs => Object.fromEntries(gs.flatMap(g => g.rows).map(r => [r.id, { w: Number(r.stats.W), l: Number(r.stats.L) }]).filter(([, x]) => Number.isFinite(x.w) && Number.isFinite(x.l))))
      .catch(() => null);
  const [now, prev] = await Promise.all([season(y), prevOf(y)]);
  if (now) return { mode: 'live', ...now, prev, partial: missing.size > 0 };
  // Pages missing, none of the cup's in what came: unread, not "no cup this season".
  if (missing.size) throw new Error('nbacup: unread');
  const last = await season(y - 1, 30 * 86_400_000);
  // Every season here had its cup: none found is a read gone wrong.
  if (!last?.events.length) throw new Error('nbacup: last season unread');
  return { mode: 'last', ...last, prev: await prevOf(y - 1), partial: missing.size > 0 };
}
// The cup as last read whole, kept on the phone: shown while a read fails
// (or before the first is in), never "暫時無法取得資料" once it has been read.
const CUP_KEY = 'orbit-sports-nbacup';
function keptCup() {
  try {
    const x = JSON.parse(localStorage.getItem(CUP_KEY) || 'null');
    return x?.d?.groupGames?.length ? x.d : null;
  } catch {
    return null;
  }
}
function keepCup(d) {
  try {
    localStorage.setItem(CUP_KEY, JSON.stringify({ at: Date.now(), d: { mode: d.mode, groupGames: d.groupGames, events: d.events, season: d.season, prev: d.prev || null } }));
  } catch {}
}
// A bracket's model from its data: the NBA Cup's with its groups too.
const bracketOf = (league, d) => {
  const model = playoffModel({ league, ...d });
  if (league === 'nationsleague') return withUnlGroups(model, d);
  if (league !== CUP) return model;
  model.groups = nbaCupGroups(d.groupGames, { prev: d.prev });
  // The quarterfinals not drawn yet: as the groups stand (this season's).
  const qf = model.rounds.find(r => r.key === 'QF');
  if (model.mode !== 'last' && qf?.ties.every(t => !t) && model.groups.length) qf.ties = cupQuarters(model.groups);
  // The groups the bracket's first column, each card beside the place it fills (its tables in it, not under it).
  const column = qf ? cupGroupColumn(model.groups, qf.ties) : [];
  if (column.length) {
    const games = (d.groupGames || []).filter(isGroupPlay);
    const times = games.map(e => Date.parse(e.start)).filter(Number.isFinite);
    const on = games.some(e => e.status?.state === 'in');
    const done = games.length && games.every(e => e.status?.state === 'post' || e.status?.void);
    model.rounds.unshift({ key: 'GROUPS', title: { zh: '小組賽', en: 'Group play' }, ties: column, dates: times.length ? { from: Math.min(...times), to: Math.max(...times) } : null, state: on ? 'live' : done ? 'done' : times.length && Math.min(...times) <= Date.now() ? 'on' : 'later' });
  }
  return model;
};
// The Nations League's League A groups in front of its quarterfinals (this season's, the draw made or not).
function withUnlGroups(model, d) {
  const qf = model.rounds.find(r => r.key === 'quarterfinals');
  const column = model.mode !== 'last' && qf ? unlGroupColumn(d.groups, qf.ties) : [];
  if (!column.length) return model;
  const games = d.groupGames || [];
  const times = games.map(e => Date.parse(e.start)).filter(Number.isFinite);
  const groups = column.filter(Boolean).map(c => c.group.rows);
  const rows = groups.flat();
  // (Each meets each of its group twice.)
  const done = groups.every(g => g.every(r => played(r) >= 2 * (g.length - 1)));
  const on = games.some(e => e.status?.state === 'in');
  model.rounds.unshift({ key: 'GROUPS', title: { zh: 'A 級小組賽', en: 'League A groups' }, ties: column, dates: times.length ? { from: Math.min(...times), to: Math.max(...times) } : null, state: on ? 'live' : done ? 'done' : rows.some(r => played(r) > 0) ? 'on' : 'later' });
  return model;
}
async function playoffData(league) {
  if (league === CUP) return nbaCupData();
  if (league === 'cpbl') return cpblPlayoffData();
  // Unread is a failure (asked again soon), never taken for "no season".
  const info = await seasonInfo(league);
  const season = info?.season || {};
  const stages = info?.stages || [];
  const table = async () => {
    const groups = await standings(league).catch(() => standings(league));
    return groups?.some(g => g.rows.some(r => played(r) > 0)) ? groups : null;
  };
  if (LEAGUES[league].cup) {
    const start = Date.parse(season.start) || 0;
    const every = await seasonEvents(league).catch(() => []);
    const all = every.filter(e => e.round);
    const now = all.filter(e => Date.parse(e.start) >= start);
    // ESPN can keep a finished season as its current one (the FA Cup's, all summer): last season, said so.
    // (The Nations League's: its table and group games too, League A's groups in its bracket.)
    const unl = league === 'nationsleague' ? { groupGames: every.filter(e => !e.round && Date.parse(e.start) >= start) } : {};
    if (now.length) {
      const mode = Date.parse(season.end) < Date.now() ? 'last' : 'live';
      return { mode, events: now, stages, season: season.name, ...unl, ...(league === 'nationsleague' && mode === 'live' ? { groups: await table().catch(() => null) } : {}) };
    }
    const groups = FORMATS[league].project ? await table() : null;
    if (groups) return { mode: 'projected', events: [], groups, stages, season: season.name, ...unl };
    // A season under way with no knockout games or table yet (the FA Cup's early rounds): its rounds' dates.
    if (season.phase && season.phase !== 'off' && stages.length && !FORMATS[league].project) return { mode: 'live', events: [], stages, season: season.name };
    let before = all.filter(e => Date.parse(e.start) < start);
    if (!before.length) before = (await seasonEvents(league, start - 30 * 86_400_000).catch(() => [])).filter(e => e.round);
    return { mode: 'last', events: before, season: '' };
  }
  if (season.phase === 'post') {
    // (MLS's games carry no seeds: the final table gives them, a moment at most.)
    const [events, groups] = await Promise.all([postseason(league), FORMATS[league]?.tableSeeds ? Promise.race([table().catch(() => null), new Promise(r => setTimeout(() => r(null), 4000))]) : null]);
    return { mode: 'live', events, groups, stages, season: season.name };
  }
  if (season.phase === 'regular') {
    const groups = await table();
    const last = info?.days?.at(-1);
    if (groups) return { mode: 'projected', events: [], groups, stages, season: season.name, startsAfter: last ? Date.parse(`${last.slice(0, 4)}-${last.slice(4, 6)}-${last.slice(6, 8)}T12:00:00`) : 0 };
  }
  return lastSeason(league, info);
}
// A read that failed is asked again after a minute (the kit holds a failure
// that long), its last good model kept meanwhile; with none, the view says so.
function loadBracket(league) {
  let had = brackets.get(league);
  if (!hasBracket(league) || (had && (had.loading || Date.now() - had.at < (had.failed ? 61_000 : 10 * 60_000)))) return;
  // The NBA Cup's last whole read (this phone's), drawn at once while today's is read.
  if (league === CUP && !had?.model) {
    const kept = keptCup();
    let model = null;
    try {
      model = kept && bracketOf(league, kept);
    } catch {}
    if (model) had = { model, at: 0, shown: false };
  }
  brackets.set(league, { ...(had || {}), loading: true, again: false });
  playoffData(league)
    // A game started or ended while it was read: read again at once (at 0).
    .then(d => {
      const model = bracketOf(league, d);
      if (league === CUP && !d.partial) keepCup(d);
      // Days unread (d.partial): what came drawn, the rest asked again in a minute.
      brackets.set(league, { model, at: brackets.get(league)?.again ? 0 : d.partial ? Date.now() - 10 * 60_000 + 61_000 : Date.now() });
      if (d.partial) setTimeout(() => shownBracket() === league && state.scores.view === 'bracket' && renderScores(), 61_500);
      // A series' games from weeks back: their watch links ready for its sheet.
      watchMonthsOf(model.rounds.flatMap(r => r.ties.flatMap(t => t?.games || [])));
    })
    .catch(() => {
      // A first failure with nothing to show: asked again in 20 seconds, its
      // shape drawn meanwhile (a refused minute isn't "no data"); a second says so.
      const fails = (had?.fails || 0) + 1;
      const wait = fails === 1 && !had?.model ? 20_000 : 61_000;
      brackets.set(league, { model: had?.model || null, at: Date.now() - 61_000 + wait, failed: true, fails });
      setTimeout(() => shownBracket() === league && state.scores.view === 'bracket' && renderScores(), wait + 500);
    })
    .finally(() => state.tab === 'matches' && state.scores.league === leagueOfBracket(league) && renderScores());
}
// A playoff game starting or ending (seen in today's read or the open
// league's) changes its bracket (the series, who's through, on now): read
// again then, not left as it was for up to 10 minutes after a clincher.
const poState = new Map();
// A cup's games read (the FA Cup's non-league clubs ESPN has no badge for):
// its clubs' FotMob badges, the shields drawn so far swapped for them.
function noteCupBadges(events) {
  for (const k of new Set((events || []).map(e => e.league))) if (LEAGUES[k]?.cup) cupBadges(k).then(got => got && refreshBadges());
}
function notePlayoffGames(events) {
  const changed = new Set();
  for (const e of events) {
    const k = e.round && hasBracket(e.league) ? e.league : nbaCupRound(e) || isGroupPlay(e) ? CUP : '';
    if (!k) continue;
    const key = `${k}:${e.id}`;
    const was = poState.get(key);
    poState.set(key, e.status.state);
    if (was && was !== e.status.state) changed.add(k);
  }
  for (const league of changed) staleBracket(league);
}
function staleBracket(league) {
  const had = brackets.get(league);
  if (!had) return;
  if (had.loading) had.again = true;
  else had.at = 0;
  // Open: read now (renderScores asks for it).
  if (shownBracket() === league && state.scores.view === 'bracket') renderScores();
}
// A game's whole series (or two-legged tie), for its match page: from the
// league's bracket, the one 季後賽 shows (read now when not held fresh).
// The league's bracket model, held fresh 10 minutes (read now when not).
async function bracketModel(league) {
  const had = brackets.get(league);
  let model = had?.model && !had.failed && Date.now() - had.at < 10 * 60_000 ? had.model : null;
  if (!model) {
    model = bracketOf(league, await playoffData(league));
    brackets.set(league, { ...(brackets.get(league) || {}), model, at: Date.now(), loading: false, failed: false });
  }
  return model;
}
async function seriesOf(e) {
  const league = e?.league;
  if (!e?.round || !hasBracket(league)) return null;
  const model = await bracketModel(league);
  for (const r of model.rounds)
    for (const t of r.ties)
      if (t && !t.gap && !t.projected && !t.pending && t.games.some(g => g.id === e.id)) {
        // Its games' watch links (weeks back) with it, a moment at most: the sheet drawn once.
        await Promise.race([watchMonthsOf(t.games), new Promise(r => setTimeout(r, 1200))]);
        return { tie: { ...t, games: t.games.map(freshGame) }, title: locale === 'en' ? r.title.en : r.title.zh };
      }
  return null;
}
ctx.seriesOf = seriesOf;
// A playoff game's page: 季後賽 in place of 排名 (the owner, 2026-10-23), the
// same map the league's 季後賽 shows; null when there's none to show.
ctx.hasBracket = league => hasBracket(league);
// (`league`: a bracket's key, 'nbacup' the NBA Cup's: its games' pages show it.)
ctx.playoffsOf = async league => {
  if (!hasBracket(league)) return null;
  const model = await bracketModel(league);
  // A game of it started or ended (the sheet's own reads, while 首頁's tick waits under it): read again next time.
  notePlayoffGames(model.rounds.flatMap(r => r.ties.flatMap(t => t?.games || [])).map(freshGame));
  return model?.rounds?.length ? playoffView(model, league) : null;
};
const cupBanner = model => el('p', { class: 'po-banner' }, [el('strong', { text: locale === 'en' ? 'Last season' : '上季' }), document.createTextNode(`${model.season ? ` ${model.season}` : ''}${locale === 'en' ? ': this season’s NBA Cup hasn’t begun.' : '　本季 NBA 盃尚未開打。'}`)]);
// The playoffs as a map you swipe across: a column a round (its name, and
// done / on now / its dates under it), the later rounds between the ties
// that feed them. Each tie: each side's seed, logo and name with its wins (or
// aggregate, or score), who went through (the other greyed), the next game,
// or 待定 with the round's dates; a predicted tie dashed. A prediction or
// last season says so on top.
const md = ms => {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};
const roundDates = r => (!r.dates ? '' : r.dates.by ? (locale === 'en' ? `By ${md(r.dates.to)}` : `${md(r.dates.to)} 前`) : r.dates.about ? `${locale === 'en' ? 'c.' : '約'} ${md(r.dates.from)}${locale === 'en' ? '' : ' 起'}` : md(r.dates.from) === md(r.dates.to) ? md(r.dates.from) : `${md(r.dates.from)}–${md(r.dates.to)}`);
// How many games a round's series runs to, where its games don't say yet.
const SERIES_LEN = { mlb: { RD16: 3, QTR: 5, SEMI: 7, FINAL: 7 }, nba: { RD16: 7, QTR: 7, SEMI: 7, FINAL: 7 }, mls: { 'round-one': 3 } };
// (`key`: the bracket's, 'nbacup' for the NBA Cup; its logos and sheets the league's.)
function playoffView(model, key) {
  const league = leagueOfBracket(key);
  const en = locale === 'en';
  const banner =
    model.mode === 'projected'
      ? el('p', { class: 'po-banner' }, [el('strong', { text: en ? 'Predicted' : '預測' }), ...(model.rounds.some(r => r.ties.some(t => t?.sides?.some(x => x?.sure)))
          ? // (One line: the legend in place of 開打前會變動.)
            [document.createTextNode(en ? ' from the table as it stands' : '　依目前排名推算'), el('span', { class: 'po-sure' }, [el('span', { class: 'br-seed num', text: '1' }), document.createTextNode(en ? 'clinched' : '已確定')])]
          : [document.createTextNode(en ? ' from the table as it stands: it changes until the playoffs start.' : '　依目前排名推算，開打前會變動。')])])
      : model.mode === 'last'
        ? key === CUP
          ? cupBanner(model)
          : el('p', { class: 'po-banner' }, [el('strong', { text: en ? 'Last season' : '上季' }), document.createTextNode(`${model.season ? ` ${model.season}` : ''}${en ? ': this season’s playoffs haven’t begun.' : '　本季季後賽尚未開打。'}`)])
        : null;
  // The NBA Cup's groups in it: what their bars mean, as a table's legend says (each group's first in, and each conference's best second, the wild card).
  // (The Nations League's: each group's first two, the winner against another group's runner-up.)
  const keys = key === CUP ? [['lead', en ? 'Group winner' : '分組第一'], ['card', en ? 'Wild card: best 2nd' : '外卡・各區最佳第二']] : [['lead', en ? 'Group winner' : '分組第一'], ['card', en ? 'Runner-up: v another winner' : '分組第二・對他組第一']];
  const legend = model.rounds[0]?.key === 'GROUPS' ? el('p', { class: 'po-legend' }, keys.map(([k, w]) => el('span', { class: 'po-key', style: `--zone: ${PICTURE_COLOR[k]}`, text: w }))) : null;
  // A round's length (七戰四勝): its games' series, else the league's format.
  const lenOf = r => key === CUP ? '' : bestOf(r.ties.flatMap(t => t?.games || []).find(g => g.series?.games)) || bestOf({ series: { games: SERIES_LEN[league]?.[r.key] } });
  const stateText = r => (r.state === 'done' ? (en ? 'Done' : '已完成') : r.state === 'live' ? (en ? 'On now' : '進行中') : roundDates(r) || (en ? 'TBD' : '待定'));
  const sideRow = (s, t, i) => {
    const id = s ? String(s.id) : '';
    const seed = t.projected ? t.seeds?.[i] : s?.seed;
    const label = t.projected ? labelText(t.labels?.[i]) : '';
    const score = !t.projected && s ? t.score?.[id] : undefined;
    // A place still being played for: both sides that could take it.
    const maybe = !s && t.options?.[i];
    // The 8th seed game's places: both logos and what they're playing for ("🚀/🦅 敗者").
    if (maybe && t.optionWords?.[i])
      return el('div', { class: 'br-side maybe' }, [
        el('span', { class: 'br-seed num', text: seed ? String(seed) : '' }),
        el('span', { class: 'br-maybe' }, [...maybe.flatMap((x, j) => [j ? el('span', { class: 'br-or', text: '/' }) : null, sideLogo(x, league, 'xs')]), el('span', { class: 'br-name br-word', text: en ? t.optionWords[i].en : t.optionWords[i].zh })])
      ]);
    if (maybe)
      return el('div', { class: 'br-side maybe' }, [
        el('span', { class: 'br-seed num' }),
        // Each side's logo beside its own name: "🅼 釀酒人 / 🆂 教士".
        // (Too long for its card, a phone's: the two logos and 勝者, never cut: `tight`.)
        el('span', { class: 'br-maybe' }, [...maybe.flatMap((x, j) => [j ? el('span', { class: 'br-or', text: '/' }) : null, el('span', { class: 'br-opt' }, [sideLogo(x, league, 'xs'), el('span', { class: 'br-name', text: x.short || x.name })])]), el('span', { class: 'br-name br-word br-won', text: en ? 'winner' : '勝者' })])
      ]);
    return el('div', { class: `br-side${t.winner ? (t.winner === id ? ' win' : ' out') : ''}${s ? '' : ' tbd'}${t.projected && s?.sure ? ' sure' : ''}` }, [
      el('span', { class: 'br-seed num', text: seed ? String(seed) : '' }),
      s ? sideLogo(s, league, 'xs') : el('span', { class: 'logo xs br-tbd-logo', 'aria-hidden': 'true' }),
      el('span', { class: 'br-name q-fit', text: s ? s.short || s.name : label || (en ? 'TBD' : '待定'), ...(s?.abbr ? { 'data-abbr': s.abbr } : {}) }),
      el('strong', { class: 'num br-score', text: score ?? '' })
    ]);
  };
  // A predicted place's words (playoffs.mjs has them in Chinese) in English.
  const labelText = x =>
    !en || !x
      ? x
      : x
          .replace(/^(\S+) 勝者$/, '$1 winner')
          .replace(/^(\S+) 敗者$/, '$1 loser')
          .replace(/^附加賽勝者$/, 'Play-off winner')
          .replace(/^附加賽$/, 'Play-In')
          .replace(/^(東|西)區分組第一$/, (_, c) => `${c === '東' ? 'East' : 'West'} group winner`)
          .replace(/^(東|西)區外卡$/, (_, c) => `${c === '東' ? 'East' : 'West'} wild card`)
          .replace(/^挑戰賽勝者$/, 'Challenge winner')
          .replace(/^一勝優勢$/, '1 win up')
          .replace(/^(\S+) 組$/, 'Group $1');
  const note = (t, r) => {
    if (!t) return roundDates(r) ? `${en ? 'Expected' : '預計'} ${roundDates(r)}` : en ? 'To be decided' : '待定';
    // A play-in game not decided: what winning and losing it means.
    if (t.outcome && !t.winner && !t.live && (t.projected || t.pending || !t.next)) return en ? t.outcome.en : t.outcome.zh;
    // (The 8th seed game sits in the play-in's column: named on its card; English's words too long for 預測 beside them.)
    if (t.projected && t.sure) return en ? 'Confirmed' : '已確定';
    // (Both places of one conference: said once by the column, so the line fits: 分組第一 v 外卡, not 東區分組第一 v 東區外卡 cut off. Jay 2026-10-31.)
    const ls = (t.labels || []).filter(Boolean);
    const same = ls.length === 2 && /^[東西]區/.test(ls[0]) && ls[0].slice(0, 2) === ls[1].slice(0, 2);
    const said = same ? ls.map(x => (en ? labelText(`東區${x.slice(2)}`).replace(/^East /, '') : x.slice(2))) : ls.map(labelText);
    if (t.projected) return [t.roundTitle ? (en ? t.roundTitle.en : t.roundTitle.zh) : '', said.length && t.sides.every(Boolean) ? said.join(' v ') : '', en && t.roundTitle ? '' : en ? 'Predicted' : '預測'].filter(Boolean).join(' · ');
    const won = t.winner && t.sides.find(s => String(s.id) === t.winner);
    // The last round's winner takes the title (道奇 奪冠), never "晉級".
    if (won) return `${won.short || won.name} ${r === model.rounds.at(-1) ? (en ? 'champions' : '奪冠') : en ? 'through' : '晉級'}`;
    // The game on now as it stands, each live tick: "G5 3–2 · 7局下" (the sides in the card's order).
    if (t.live) {
      const g = t.games.find(x => x.status?.state === 'in');
      if (!g) return en ? 'On now' : '進行中';
      const [a, b] = t.sides.map(x => [g.home, g.away].find(y => String(y?.id) === String(x?.id))?.score ?? '–');
      const n = Number(/\bgame (\d+)/i.exec(g.note || '')?.[1]) || t.games.indexOf(g) + 1;
      return [t.kind === 'series' ? `G${n} ${a}–${b}` : `${a}–${b}`, statusText(g)].join(' · ');
    }
    if (t.next) return `${t.kind === 'series' ? `G${Number(/\bgame (\d+)/i.exec(t.next.note || '')?.[1]) || t.games.indexOf(t.next) + 1} · ` : ''}${dayLabel(localDate(Date.parse(t.next.start)))} ${timeText(t.next)}`;
    // A series under way with its next game not yet set: where it stands ("中信兄弟 2–1 領先", "1–1 平手").
    if (t.kind === 'series' && t.sides.every(Boolean) && t.score) {
      const [a, b] = t.sides.map(x => Number(t.score[String(x.id)]) || 0);
      if (a + b > 0) {
        if (a === b) return en ? `Level ${a}–${b}` : `系列賽 ${a}–${b} 平手`;
        const lead = a > b ? t.sides[0] : t.sides[1];
        return en ? `${lead.short || lead.name} lead ${Math.max(a, b)}–${Math.min(a, b)}` : `${lead.short || lead.name} ${Math.max(a, b)}–${Math.min(a, b)} 領先`;
      }
    }
    // A place still being played for: what it waits on ("等待季後挑戰賽勝隊").
    const before = model.rounds[model.rounds.indexOf(r) - 1];
    if (t.options?.some(Boolean) && before) return en ? `Waiting on the ${before.title.en} winner` : `等待${before.title.zh}勝隊`;
    return t.kind === 'agg' ? (en ? 'Aggregate' : '總比分') : t.pending ? (en ? 'To be decided' : '待定') : '';
  };
  // The NBA Cup's first column: a group (or its conference's wild card race)
  // as a small table, its place in the quarterfinals marked (分組第一 green,
  // the wild card blue), beside the tie it fills.
  const groupCard = g => {
    // A Nations League group: its four by points, its first two marked.
    if (g.kind === 'unl')
      return el('div', { class: 'br-tie br-group' }, [
        el('small', { class: 'br-gname', text: en ? `Group ${g.name}` : `${g.name} 組` }),
        ...g.rows.map(x => el('div', { class: 'br-grow', ...(x.zone ? { style: `--zone: ${PICTURE_COLOR[x.zone]}` } : {}) }, [sideLogo(x, league, 'xs'), el('span', { class: 'br-name', text: x.short || x.name }), el('span', { class: 'num br-rec', text: en ? `${x.stats.P} pts` : `${x.stats.P} 分` })]))
      ]);
    const conf = g.conf === 'East' ? (en ? 'East' : '東區') : en ? 'West' : '西區';
    return el('div', { class: `br-tie br-group${g.kind === 'card' ? ' br-card' : ''}` }, [
      el('small', { class: 'br-gname', text: g.kind === 'card' ? (en ? `${conf} wild card · 2nds` : `${conf}外卡・各組第二`) : en ? `${conf} group` : `${conf}小組` }),
      ...g.rows.map(x => el('div', { class: 'br-grow', ...(g.kind === 'card' ? x.zone === 'card' : x.zone === 'lead' || x.zone === 'card') ? { style: `--zone: ${PICTURE_COLOR[x.zone]}` } : {} }, [sideLogo(x, 'nba', 'xs'), el('span', { class: 'br-name', text: x.short || x.name }), el('span', { class: 'num br-rec', text: `${x.w}-${x.l}` })])),
      // Teams level on record: why the one above is above (the cup's tiebreaks; Jay, 2026-11-01).
      ...tieLines(g.notes, g.rows, g.kind === 'card' ? (en ? 'Wild card' : '外卡') : en ? '1st' : '第一')
    ]);
  };
  // (One short line, no names: the card's first place, or a seed, and the step that gave it: 第一依分差 +20/+5.)
  const tieLines = (notes, rows, what) => (notes || []).map(n => el('small', { class: 'br-why', text: `${n.seed ? (en ? 'Seed' : '種子') : what}${en ? ' by ' : '依'}${cupNote(n, () => '', en).why}` }));
  const tie = (t, r) => {
    // Its games as the newest read has them (the live tick's scoreboard), not as the bracket was read.
    if (t?.games?.length) {
      const games = t.games.map(freshGame);
      t = { ...t, games, live: games.some(g => g.status?.state === 'in') };
    }
    const blank = { projected: true, seeds: [], labels: [] };
    if (t?.group) return groupCard(t.group);
    // An empty row (the play-in's): a card's height, unseen, so the columns line up.
    if (t?.gap) return el('div', { class: `br-tie gap${t.through ? ' through' : ''}`, 'aria-hidden': 'true' }, [sideRow(null, blank, 0), sideRow(null, blank, 1), el('small', { class: 'br-note', text: '·' })]);
    const said = note(t, r);
    // A game on at a break (中場休息, 暫停): its countdown ticking in the note as everywhere else.
    const on = t?.live && t.games.find(g => g.status?.state === 'in');
    const body = [sideRow(t?.sides[0] || null, t || blank, 0), sideRow(t?.sides[1] || null, t || blank, 1), said ? el('small', { class: `br-note${t?.live ? ' live' : ''}${t?.outcome ? ' q-fit' : ''}`, text: said, ...(on ? breakTick(on, said) : {}) }) : null, ...(t?.notes?.length ? tieLines(t.notes.slice(0, 1)) : [])];
    if (!t || t.projected || t.pending) return el('div', { class: `br-tie ${t?.pending ? 'pending' : t?.sure ? 'sure' : t ? 'projected' : 'tbd'}${t?.roundTitle ? ' eighth' : ''}` }, body);
    // (Its sheet from the card as last drawn: patchPlayoffs moves __open over with the newer games.)
    const card = el('button', { class: `br-tie${t.live ? ' live' : ''}`, type: 'button', onclick: () => card.__open() }, body);
    // A tie that is one game (a cup's single match): straight to that game, never a sheet listing
    // it alone; a series or two legs keep their sheet (Jay 2026-11-09).
    card.__open = () => (t.kind === 'single' && t.games?.length === 1 ? openEvent(t.games[0]) : openTie(t, league, en ? (t.roundTitle || r.title).en : (t.roundTitle || r.title).zh));
    return card;
  };
  const entry = brackets.get(key);
  const fade = entry && !entry.shown;
  if (entry) entry.shown = true;
  // Two rounds or fewer (CPBL's challenge series and Taiwan Series): one
  // under the other, each tie the screen's width (two columns cut its names).
  const stacked = model.rounds.length <= 2;
  const map = el(
    'div',
    { class: `bracket${stacked ? ' stacked' : ''}${model.rounds.some(r => r.ties.some(t => t?.seeds?.some(Boolean) || t?.sides?.some(x => x?.seed))) ? '' : ' no-seeds'}` },
    model.rounds.map(r => el('section', { class: `br-col ${r.state}` }, [el('div', { class: 'br-head' }, [el('strong', { text: en ? r.title.en : r.title.zh }), el('small', { text: [lenOf(r), stateText(r)].filter(Boolean).join(' · ') })]), el('div', { class: 'br-ties' }, r.undrawn ? [el('div', { class: 'br-undrawn' }, en ? 'Not drawn yet' : '尚未抽籤')] : r.ties.map(t => tie(t, r)))]))
  );
  if (!stacked) linkTies(map, model);
  // A place's two names too long for its card: its logos and 勝者 (measured as the map's width changes).
  if (map.querySelector('.br-won')) {
    const tight = () => map.querySelectorAll('.br-maybe:has(.br-won)').forEach(m => (m.classList.remove('tight'), m.classList.toggle('tight', m.scrollWidth > m.clientWidth + 1)));
    new ResizeObserver(() => requestAnimationFrame(tight)).observe(map);
  }
  // Opened on the round that's on (or next), not always the first.
  const at = stacked ? 0 : openRound(model) - 1;
  // (By the rounds themselves: the lines' drawing sits first in the map.)
  if (at > 0) requestAnimationFrame(() => map.isConnected && (map.scrollLeft = map.querySelectorAll(':scope > .br-col')[at]?.offsetLeft - map.offsetLeft - 16));
  const root = el('div', { class: `playoffs${fade ? ' fade-in' : ''}` }, [banner, legend, map]);
  root.__patch = neu => patchPlayoffs(root, neu);
  // Faded in once: never again if it's put back on the page (a tab tapped back to it).
  if (fade) root.addEventListener('animationend', () => root.classList.remove('fade-in'), { once: true });
  return root;
}
// A live refresh's drawing put into the bracket on screen: the same ties
// (the same sides in the same places), only their scores, notes and states
// changed in place, so the map keeps where it was swiped to and its lines;
// another shape (a series won, a round filled) put in whole. The node now shown.
function patchPlayoffs(old, neu) {
  const cards = n => [...n.querySelectorAll('.br-tie')];
  const shape = n => [n.querySelector('.po-banner')?.textContent || '', ...cards(n).map(c => `${c.tagName}:${[...c.querySelectorAll('.br-name')].map(x => x.dataset.abbr || x.textContent).join('/')}`)].join('|');
  if (!old.isConnected || shape(old) !== shape(neu)) return old.isConnected && old.replaceWith(neu), neu;
  const pairs = sel => [...old.querySelectorAll(sel)].map((n, i) => [n, neu.querySelectorAll(sel)[i]]);
  for (const [a, b] of pairs('.br-head small')) if (a.textContent !== b.textContent) a.textContent = b.textContent;
  for (const [a, b] of pairs(':scope > .bracket > .br-col')) a.className = b.className;
  const olds = cards(old);
  cards(neu).forEach((b, i) => {
    const a = olds[i];
    a.classList.toggle('live', b.classList.contains('live'));
    if (b.__open) a.__open = b.__open;
    const sides = [...b.querySelectorAll('.br-side')];
    a.querySelectorAll('.br-side').forEach((x, j) => {
      const y = sides[j];
      if (!y) return;
      for (const k of ['win', 'out']) x.classList.toggle(k, y.classList.contains(k));
      const [sx, sy] = [x.querySelector('.br-score'), y.querySelector('.br-score')];
      if (sx && sy && sx.textContent !== sy.textContent) sx.textContent = sy.textContent;
    });
    const [na, nb] = [a.querySelector('.br-note'), b.querySelector('.br-note')];
    if (na && nb) {
      if (na.textContent !== nb.textContent) na.textContent = nb.textContent;
      na.classList.toggle('live', nb.classList.contains('live'));
      // (Its break's countdown, if any, ticking on with the newer drawing's.)
      for (const k of ['halftime', 'halftimeLabel']) nb.dataset[k] != null ? (na.dataset[k] = nb.dataset[k]) : delete na.dataset[k];
    } else if (nb) a.append(nb);
    else na?.remove();
  });
  return old;
}
// The lines from each tie to the one it feeds (a bracket's elbows), drawn
// once the columns are laid out and again when they change size. A tie goes
// where the model says (`feeds`: the NBA's play-in, 9 v 10's winner down
// and 7 v 8's loser up into the 8th seed game between them),
// else to the next one holding its winner, else where its seeds' winner
// waits ("4/5 勝者"), else the one beside it; a decided tie's line drawn
// stronger, to follow a side's way.
function linkTies(map, model) {
  const NS = 'http://www.w3.org/2000/svg';
  const ids = t => (t ? [...(t.sides || []), ...(t.options || []).flat()].filter(Boolean).map(x => String(x.id)) : []);
  const R = model.rounds;
  const target = (i, j) => {
    const t = R[i].ties[j];
    const next = R[i + 1]?.ties || [];
    const past = next[j]?.through;
    if (t.winner)
      for (const k of past ? [i + 1, i + 2] : [i + 1]) {
        const m = (R[k]?.ties || []).findIndex(x => x && !x.gap && ids(x).includes(t.winner));
        if (m >= 0) return [k, m];
      }
    const key = t.projected && t.seeds?.every(Boolean) ? `${t.seeds.join('/')} 勝者` : '';
    const waits = key ? next.findIndex(x => x?.labels?.includes(key)) : -1;
    if (waits >= 0) return [i + 1, waits];
    if (past) return R[i + 2] ? [i + 2, j] : null;
    // (Into a round that isn't two of these to one, the top clubs joining it (the FA Cup's third): no line by place.)
    if (next.length * 2 !== R[i].ties.length && next.length !== R[i].ties.length) return null;
    const m = Math.floor((j * next.length) / R[i].ties.length);
    return next.length && !next[m]?.gap ? [i + 1, m] : null;
  };
  const draw = () => {
    if (!map.isConnected) return void ro.disconnect();
    // A name too long for its column even shrunk as far as the kit goes
    // (72%: English's Timberwolves, Trail Blazers): its abbreviation, the
    // logo beside it (never cut).
    for (const n of map.querySelectorAll('.br-name[data-abbr]')) {
      const k = parseFloat(n.style.fontSize) / (Number(n.dataset.qFit) || parseFloat(getComputedStyle(n).fontSize)) || 1;
      if (n.clientWidth && (n.scrollWidth / k) * 0.72 > n.clientWidth + 1) (n.textContent = n.dataset.abbr), (n.style.fontSize = '');
    }
    map.querySelector(':scope > .br-links')?.remove();
    const nodes = [...map.querySelectorAll(':scope > .br-col')].map(c => [...c.querySelectorAll('.br-ties > .br-tie')]);
    if (!nodes[0]?.[0]?.offsetHeight) return;
    // Every head and every card the same height (the 8th seed game's two
    // lines of words ran taller than a side's logo row; 約 4/14 起 under a
    // head), so the rows line up across columns and a line between two
    // cards side by side runs straight (Jay, 2026-10-23: "not straight").
    // (The NBA Cup's group cards among themselves: a tie isn't a table's height; its wild card race, three rows, its own.)
    for (const sel of [':scope > .br-col > .br-head', ':scope > .br-col .br-tie:not(.br-group)', ':scope > .br-col .br-tie.br-group:not(.br-card)']) {
      const all = [...map.querySelectorAll(sel)];
      const tall = Math.max(...all.map(n => n.offsetHeight));
      for (const n of all) if (n.offsetHeight < tall) n.style.minHeight = `${tall}px`;
    }
    const box = map.getBoundingClientRect();
    const at = n => {
      const r = n.getBoundingClientRect();
      const top = r.top - box.top + map.scrollTop;
      return { l: r.left - box.left + map.scrollLeft, r: r.right - box.left + map.scrollLeft, x: r.left - box.left + map.scrollLeft + r.width / 2, top, bottom: top + r.height, y: Math.round(top + r.height / 2) + 0.5 };
    };
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'br-links');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', map.scrollWidth);
    svg.setAttribute('height', map.scrollHeight);
    R.forEach((r, i) =>
      r.ties.forEach((t, j) => {
        if (!t || t.gap || !nodes[i]?.[j]) return;
        for (const f of t.feeds || [{ to: target(i, j) }]) {
          const end = f.to && nodes[f.to[0]]?.[f.to[1]];
          if (!end) continue;
          const [a, b] = [at(nodes[i][j]), at(end)];
          const path = document.createElementNS(NS, 'path');
          // In its own column (9 v 10 and 7 v 8 into the 8th seed game between them): straight across the gap.
          // (An arrowhead at the end: which way the team goes.)
          if (f.to[0] === i) {
            const [from, to, d] = b.top > a.top ? [a.bottom, b.top, -1] : [a.top, b.bottom, 1];
            path.setAttribute('d', `M${a.x} ${from}V${to + d * 4}`);
            const head = document.createElementNS(NS, 'path');
            head.setAttribute('d', `M${a.x - 4} ${to + d * 5}L${a.x} ${to}L${a.x + 4} ${to + d * 5}Z`);
            head.setAttribute('class', 'head');
            svg.append(head);
          }
          // Side by side: one straight line.
          else if (Math.abs(a.y - b.y) < 4) path.setAttribute('d', `M${a.r} ${a.y}H${b.l}`);
          else {
            // The turn halfway across the gap before the tie fed, so a line passing a column runs straight.
            const turn = b.l - (parseFloat(getComputedStyle(map).columnGap) || 18) / 2;
            path.setAttribute('d', `M${a.r} ${a.y}H${turn}V${b.y}H${b.l}`);
          }
          if (t.winner) path.setAttribute('class', 'won');
          svg.append(path);
        }
      })
    );
    map.prepend(svg);
  };
  const ro = new ResizeObserver(() => requestAnimationFrame(draw));
  ro.observe(map);
}
// Its shape while it's read: the round chips and four ties in grey.
const bracketShape = () =>
  el('div', { class: 'playoffs waiting', 'aria-hidden': 'true' }, [el('div', { class: 'bracket' }, [4, 2, 1].map(n => el('section', { class: 'br-col' }, [el('div', { class: 'br-head' }, [el('i', { class: 'skel' }), el('i', { class: 'skel skel-short' })]), el('div', { class: 'br-ties' }, Array.from({ length: n }, () => el('div', { class: 'br-tie tbd' }, [el('i', { class: 'skel' }), el('i', { class: 'skel' }), el('i', { class: 'skel skel-short' })])))])))]);

// `quiet`: the live tick's read again: no "reading" drawing first, and only
// what changed put in on the page (a card's score and clock), never the
// whole list drawn again every few seconds.
async function loadScores({ quiet = false } = {}) {
  const sc = state.scores;
  const league = sc.league;
  if (league === ALL) return renderScores();
  const key = `${league}|${sc.extra}`;
  sc.loadingKey = key;
  sc.loading = !quiet;
  // A new league: its own stretch of days on the strip.
  if (sc.rangeOf !== league) (sc.range = { from: STRIP.from, to: STRIP.to }), (sc.rangeOf = league);
  if (!quiet) renderScores();
  track([`league:${leagueKey(league)}`], 0.3);
  let events = [];
  try {
    // A live tick between whole reads (every two minutes): only the pages with a game on.
    const live = quiet && sc.fullKey === key && Date.now() - sc.fullAt < 120_000 ? await liveScores(sc) : null;
    events = live || (await fetchScores(sc));
    if (!live) Object.assign(sc, { fullKey: key, fullAt: Date.now() });
  } catch {
    if (sc.loadingKey === key) sc.byDay = 'failed';
    // Asked again once the kit stops holding the failure (a minute), if it's still in view.
    setTimeout(() => state.scores === sc && sc.loadingKey === key && sc.byDay === 'failed' && loadScores(), 61_000);
  }
  if (sc.loadingKey !== key) return;
  sc.loading = false;
  if (sc.byDay !== 'failed' || events.length) {
    applyScores(sc, events);
    // Games past the recent pack's ten days: their months' watch links read
    // now (a small file a month), so a day picked later draws its cards with
    // 愛爾達・重播 already on them, never growing a row after.
    watchMonthsOf(sc.all.filter(e => e.status.state === 'post' && Date.parse(e.start) > Date.now() - 45 * 86_400_000));
    // The day shown: the one asked for, else one with a game on now, else
    // today's or the next game day (however far: a break opens on the next
    // round), else the latest.
    const byDay = sc.byDay;
    const liveDays = sc.days.filter(d => byDay.get(d).some(e => e.status.state === 'in'));
    const liveDay = liveDays.includes(today()) ? today() : liveDays.at(-1);
    const next = sc.days.find(d => d >= today() && byDay.get(d).some(e => e.status.state !== 'post' && !e.status.void));
    // A day picked while the league was loading stays picked (read on its own).
    if (sc.picked && sc.date && !byDay.has(sc.date)) return pickScoresDay(sc.date);
    if (!sc.date || !byDay.has(sc.date)) sc.date = liveDay || next || nearestDay(sc.days) || today();
  }
  if (quiet) quietScores();
  else renderScores();
}
// While set, renderScores changes the page in place (morph), not anew.
let scoresQuiet = false;
function quietScores() {
  scoresQuiet = true;
  try {
    renderScores();
  } finally {
    scoresQuiet = false;
  }
}
// The page as drawn, made like the new drawing with the least change: a
// node the same kept (its scroll, its handlers), text changed in place, an
// element whose tag, attributes or children's count differ replaced whole.
function morph(old, neu) {
  if (old === neu) return;
  // A node kept across draws (the league rail): put in whole, never patched
  // from (its chips moved into the old one, the kept rail lost them: a rail
  // reordered with as many chips showed five of fifteen).
  if (neu.__kept) return old.replaceWith(neu);
  if (old.nodeType !== neu.nodeType || old.nodeName !== neu.nodeName) return old.replaceWith(neu);
  // (The bracket: its own, keeping its swipe and lines.)
  if (old.__patch && neu.__patch) return void old.__patch(neu);
  if (old.nodeType === 3) {
    if (old.nodeValue !== neu.nodeValue) old.nodeValue = neu.nodeValue;
    return;
  }
  if (old.nodeType !== 1 || old.isEqualNode(neu)) return;
  const attrs = n => [...n.attributes].map(a => `${a.name}=${a.value}`).join('\u0001');
  if (attrs(old) !== attrs(neu) || old.childNodes.length !== neu.childNodes.length) return old.replaceWith(neu);
  const [a, b] = [[...old.childNodes], [...neu.childNodes]];
  a.forEach((n, i) => morph(n, b[i]));
}
// The games grouped by the viewer's day.
function applyScores(sc, events) {
  const now = Date.now();
  events = events.flatMap(e => (e.sessions ? splitWeekend(e, now, locale) : [e]));
  const byDay = new Map();
  for (const e of events.filter(x => !x.status.void || x.kind === 'match')) {
    const d = localDate(Date.parse(e.start));
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(e);
  }
  sc.byDay = byDay;
  sc.all = events;
  notePlayoffGames(events);
  noteCupBadges(events);
  sc.days = [...byDay.keys()].sort();
  tagGroups(sc.league, events, () => state.tab === 'matches' && state.scores === sc && renderScores());
}
// A cup with groups (the Nations League's tiers, the World Cup's): each
// game's group from its table (read once a session), so a game says which
// it is (C 級第 2 組). A league phase of one table says nothing.
const groupsRead = new Map();
function tagGroups(league, events, redraw) {
  if (!LEAGUES[league]?.cup || !hasStandings(league)) return;
  if (!groupsRead.has(league))
    groupsRead.set(
      league,
      standings(league)
        .then(gs => new Map((gs || []).length > 1 ? gs.flatMap(g => g.rows.map(r => [String(r.id), g.name])) : []))
        .catch(() => (groupsRead.delete(league), new Map()))
    );
  groupsRead.get(league).then(of => {
    let changed = false;
    for (const e of events) {
      const g = of.get(String(e.home?.id));
      if (g && g === of.get(String(e.away?.id)) && e.group !== g) {
        e.group = g;
        changed = true;
      }
    }
    if (changed) redraw();
  });
}
// A day picked on the strip or the 📅: shown at once; a day not read yet (an
// ESPN league's, far from now) is read first.
// Each month's watch links these games need (once each); never throws.
function watchMonthsOf(events) {
  const months = new Map();
  for (const e of events) if (watchMonthWanted(e) && !months.has(watchMonthPath(e))) months.set(watchMonthPath(e), e);
  return Promise.all([...months.values()].map(e => loadWatchMonth(e, packJson)));
}
async function pickScoresDay(d) {
  const sc = state.scores;
  // Another day from below the top: the page at its top, as on 首頁 and 全部 (a long day's
  // scroll held over a short one left a screen of black, Jay 2026-11-10).
  if (sc.date !== d) toPageTop();
  sc.date = d;
  sc.picked = true;
  sc.chosen = chosenOf(d, today());
  const l = LEAGUES[sc.league];
  // A day further back than the league's months read: its month's watch
  // links with it (the cards drawn once, with their 愛爾達・重播).
  const at = Date.parse(`${d}T12:00:00`);
  const month = watchMonthsOf([-1, 0, 1].map(k => ({ league: sc.league, start: new Date(at + k * 86_400_000).toISOString(), status: { state: 'post' } })));
  if (sc.byDay instanceof Map && !sc.byDay.has(d) && l.espn && sc.mode === 'days' && within(d, leagueBounds(sc.league))) {
    renderScores();
    // Its US days: the one before, the day, and the one after.
    const us = [-1, 0, 1].map(k => yyyymmdd(new Date(at + k * 86_400_000)));
    const [events] = await Promise.all([scoreboard(sc.league, us).catch(() => []), month]);
    if (state.scores !== sc) return;
    // A weekend read again replaces its sessions (kept apart by their own ids, they were doubled).
    const fresh = new Set(events.map(e => String(e.id)));
    const byId = new Map((sc.all || []).filter(e => !fresh.has(String(e.weekend))).map(e => [e.id, e]));
    for (const e of events) byId.set(e.id, e);
    applyScores(sc, [...byId.values()]);
    // Another day picked meanwhile: that one's on screen.
    if (sc.date !== d) return;
  } else if (sc.byDay instanceof Map && (sc.byDay.get(d) || []).some(e => e.status.state === 'post' && watchMonthWanted(e))) {
    // Read already, its month not yet: waited for a moment at most.
    await Promise.race([month, new Promise(r => setTimeout(r, 1200))]);
    if (state.scores !== sc || sc.date !== d) return;
  }
  renderScores();
}
// 賽事's live tick: an ESPN league's day pages its games on now (or due to
// start) are on, read again over the games held; null when there's none (or
// it isn't such a league), for a whole read. A cup's stretch is three month
// pages (800 KB): one day's page instead.
async function liveScores(sc) {
  const l = LEAGUES[sc.league];
  if (sc.mode !== 'days' || l.kind !== 'match' || !l.espn || l.asia || !Array.isArray(sc.all)) return null;
  const pages = new Set(sc.all.filter(e => e.status.state === 'in' || dueToStart(e)).map(e => e.usDay || usDayOf(e.start)).filter(Boolean));
  if (!pages.size) return null;
  const fresh = await scoreboard(sc.league, [...pages]).catch(() => null);
  // Unread this time: the games held, as they were.
  if (!fresh) return sc.all;
  const byId = new Map(fresh.map(e => [e.id, e]));
  const out = [];
  for (const e of sc.all) {
    if (byId.has(e.id)) out.push(byId.get(e.id)), byId.delete(e.id);
    else if (!pages.has(e.usDay)) out.push(e);
  }
  return [...out, ...byId.values()];
}
// Which events to read for the league as sc stands (sc.extra: how far).
async function fetchScores(sc) {
  const league = sc.league;
  const l = LEAGUES[league];
  let events = [];
  {
    if (l.kind !== 'match') {
      sc.mode = 'event';
      // The season's schedule, with the current event's live copy on top.
      const [season, current] = await Promise.all([seasonEvents(league), scoreboard(league).catch(() => [])]);
      const byId = new Map(season.map(e => [e.id, e]));
      for (const e of current) byId.set(e.id, e);
      events = [...byId.values()];
    } else if (l.asia) {
      // CPBL: the months around now, more with ‹ and ›.
      sc.mode = 'days';
      events = await asiaEvents(league, sc.extra);
    } else {
      sc.mode = 'days';
      const cal = await seasonCalendar(league).catch(() => null);
      if (cal?.months) {
        // A cup: the last month, this one and the next (more with ‹ and ›).
        const now = Date.now();
        events = await scoreboard(league, monthsBetween(now - (31 + 31 * sc.extra) * 86_400_000, now + (31 + 31 * sc.extra) * 86_400_000));
      } else {
        // The game days of the last week and next fortnight, and in any case
        // the last few before today and the next few after (a break between
        // rounds never leaves the strip empty); more with ‹ and ›.
        const all = cal?.days || [];
        const tt = yyyymmdd(new Date());
        const t0 = yyyymmdd(new Date(Date.now() - 6 * 86_400_000));
        const t1 = yyyymmdd(new Date(Date.now() + 14 * 86_400_000));
        const before = all.filter(d => d < tt);
        const after = all.filter(d => d >= tt);
        const usDays = [...new Set([...all.filter(d => d >= t0 && d <= t1), ...before.slice(-(3 + 4 * sc.extra)), ...after.slice(0, 4 + 4 * sc.extra)])].sort();
        events = usDays.length ? await scoreboard(league, usDays) : await scoreboard(league);
      }
    }
  }
  return events;
}

// 賽事's search: a sheet with the field at its top (it keeps its focus and
// caret while typing), the results drawn under it.
let searchOut = null;
let clearSearch = () => {};
function openSearch() {
  const s = sheet(L({ zh: '搜尋', en: 'Search' }));
  const input = el('input', { type: 'search', inputmode: 'search', enterkeyhint: 'search', autocomplete: 'off', placeholder: t('searchPlaceholder'), 'aria-label': t('searchPlaceholder') });
  const clear = el('button', { class: 'q-search-clear', type: 'button', 'aria-label': t('close'), text: '✕', onclick: () => ((input.value = ''), input.dispatchEvent(new Event('input')), input.focus()) });
  let timer = 0;
  // The European cups' clubs, ready before a search needs them.
  europeanClubs().catch(() => {});
  searchOut = el('div', { class: 'search-out' });
  input.addEventListener('input', () => {
    state.scores.q = input.value.trim();
    clearTimeout(timer);
    // Asked once typing pauses, not at every letter (each would be a read of its own).
    timer = setTimeout(() => (state.scores.q ? runSearch(state.scores.q) : put(searchOut)), 450);
  });
  clearSearch = () => s.close();
  s.dialog.addEventListener('close', () => {
    clearTimeout(timer);
    state.scores.q = '';
    searchOut = null;
    clearSearch = () => {};
  });
  put(s.body, el('label', { class: 'q-search fx-search' }, [input, clear]), searchOut);
  input.focus();
}

// Search: leagues by name, then ESPN's teams and players (a Chinese query is
// read in English first: "洋基" finds the Yankees).
let searchSeq = 0;
// A found league, team or player: its picture on a white tile, the name, where it plays.
const findRow = (pic, title, sub, onclick) => el('button', { class: 'q-ritem chevron find-row', type: 'button', onclick }, [el('span', { class: 'pic-tile' }, [pic]), el('span', { class: 'q-ritem-text' }, [el('span', { class: 'q-ritem-title', text: title }), el('small', { text: sub })])]);
async function runSearch(query, again = false) {
  const box = searchOut;
  if (!box) return;
  const seq = ++searchSeq;
  const leagues = findLeagues(query);
  const paint = (found, busy) =>
    put(
      box,
      leagues.length ? section(t('leagues'), el('div', { class: 'q-rowcard' }, leagues.slice(0, 8).map(k => findRow(leagueMark(k, 'lg-mark mid'), leagueName(k, locale), L(SPORTS[LEAGUES[k].sport]), () => openScores(k))))) : null,
      found?.teams.length ? section(t('teamsFound'), el('div', { class: 'q-rowcard' }, found.teams.slice(0, 10).map(x => findRow(logo(x.logo, x.name, 'sm'), localSide(x.league, { name: x.name }).name, leagueName(x.league, locale), () => openTeam(x.league, x.id, x))))) : null,
      found?.players.length ? section(t('playersFound'), el('div', { class: 'q-rowcard' }, found.players.slice(0, 10).map(x => findRow(personPic(x, x.league, 'sm round'), x.name, leagueName(x.league, locale), () => openPlayer(x.league, x.id))))) : null,
      busy
        ? spinner()
        : found?.failed
          ? kitUI.empty({ title: t('searchFailed'), action: { label: t('retry'), onTap: () => runSearch(query) } })
          : !leagues.length && !found?.teams.length && !found?.players.length
            ? empty(t('noResults'))
            : null
    );
  // One letter: leagues only (ESPN's search answers nothing for one).
  if ([...query].length < 2) return paint({ teams: [], players: [] }, false);
  paint(null, true);
  let q = query;
  // In Chinese: the teams whose Chinese name has the words (皇家 → Real
  // Madrid, Real Sociedad, Real Betis…), each searched by its English name,
  // and the words translated for anything else (a player's name). A machine
  // translation alone turned 皇家 into "Royal".
  const byName = /[\u3400-\u9fff]/.test(query) ? teamsByZh(query, 5) : [];
  if (/[\u3400-\u9fff]/.test(query)) q = await translate(query, 'en', 'zh-TW').catch(() => query);
  // A search that couldn't be read says so (never "nothing matches"), and is asked again once a little later.
  const lists = await Promise.all([...byName.map(x => searchEspn(x.name).catch(() => null)), searchEspn(q).catch(() => null)]);
  const read = lists.filter(Boolean);
  const seen = new Set();
  const once = list => list.filter(x => !seen.has(`${x.league}:${x.slug || ''}:${x.id}`) && seen.add(`${x.league}:${x.slug || ''}:${x.id}`));
  const found = read.length ? { teams: once(read.flatMap(f => f.teams)), players: once(read.flatMap(f => f.players)) } : { teams: [], players: [], failed: true };
  if (seq !== searchSeq || state.scores.q !== query) return;
  const within = (p, fallback) => Promise.race([p, new Promise(r => setTimeout(() => r(fallback), 3_000))]);
  // A club or a footballer of a league Orbit Sports doesn't have (Real
  // Madrid, Benfica, their players) is shown in the European cup the club
  // plays in this season. The cups' clubs are one list, read when 賽事 opens:
  // a club is placed at once. A player takes a read of their own: the first
  // few within 3 s, on their own (a search for "madrid" finds eight
  // footballers of other leagues; waiting on them all lost Real Madrid too).
  if ([...(found.teams || []), ...(found.players || [])].some(x => !x.league)) {
    const cups = (await within(europeanClubs(), null).catch(() => null)) || new Map();
    const players = found.players.some(x => !x.league) ? await within(placePlayers(found.players, cups, clubOfPlayer), null).catch(() => null) : found.players;
    if (seq !== searchSeq || state.scores.q !== query) return;
    found.teams = placeTeams(found.teams, cups);
    found.players = players || found.players.filter(x => x.league);
  }
  // A footballer found in a cup (Haaland in the Nations League over a break)
  // is shown in their club's league, before the list is drawn (never moving
  // after it); one not read within 3 s stays where ESPN put them.
  if (found.players?.length) {
    const homes = await within(Promise.all(found.players.slice(0, 10).map(x => playerHome(x.league, x.id).catch(() => x.league))), null);
    if (seq !== searchSeq || state.scores.q !== query) return;
    if (homes) found.players = found.players.map((x, i) => (homes[i] ? { ...x, league: homes[i] } : x));
  }
  if (!box.isConnected) return;
  paint(found, false);
  if (found.failed && !again) setTimeout(() => seq === searchSeq && state.scores.q === query && runSearch(query, true), 16_000);
}

// Sessions grouped back into their weekends (in the order given).
function weekends(list) {
  const out = new Map();
  for (const e of list) {
    const key = e.weekend || e.id;
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(e);
  }
  return [...out.values()];
}
// A race weekend as a card (Jay 2026-11-03: the first take, its days side by
// side, was "flat and all text"; columns of uneven height left gaps under
// short days). Now three parts, every card the same shape:
// - the head: the flag, the name, the circuit, the dates at the right;
// - a panel: what to look at now, the circuit's outline beside it: the next
//   session and a countdown that runs (to the minute), or the session on in
//   the live colour, or (over) the podium, the winner's face first;
// - the weekend as a line of stops, one even column a session: a dot on the
//   line (practice small, qualifying and sprints bigger, the race chequered),
//   the line filled as far as the weekend has run; under each its name, then
//   its day and time, or once it's over who topped it (最快 / 桿位 / 冠軍) on
//   their team's colour.
// One card, one tap: the session on, else the next to come, else (over) the
// race; its sheet has the others a tap away.
const WK_TRACKS = 'sports.wkTrack.v1';
const wkTracks = readJson(WK_TRACKS, {}) || {};
// A circuit's outline as a polyline's points in a W×H box, turned a quarter
// where that draws it bigger (from the same MultiViewer drawing the
// weekend's sheet uses).
function trackPoints(c, W = 120, H = 72, pad = 5) {
  const best = [c.rotation, c.rotation + 90]
    .map(r => {
      const a = ((Number(r) + 90) * Math.PI) / 180;
      const pts = c.x.map((x, i) => [x * Math.cos(a) - c.y[i] * Math.sin(a), c.y[i] * Math.cos(a) + x * Math.sin(a)]);
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const k = Math.min((W - pad * 2) / (x1 - x0 || 1), (H - pad * 2) / (y1 - y0 || 1));
      return { k, pts, x0, x1, y0, y1 };
    })
    .sort((a, b) => b.k - a.k)[0];
  const { k, pts, x0, x1, y0, y1 } = best;
  const ox = (W - (x1 - x0) * k) / 2, oy = (H - (y1 - y0) * k) / 2;
  const step = Math.max(1, Math.floor(pts.length / 160));
  return pts.filter((_, i) => i % step === 0).map(([x, y]) => `${(ox + (x - x0) * k).toFixed(1)},${(oy + (y - y0) * k).toFixed(1)}`).join(' ');
}
const trackSvg = pts => `<svg viewBox="0 0 120 72" aria-hidden="true"><polyline class="wk-track-edge" points="${pts}"/><polyline class="wk-track-line" points="${pts}"/><circle class="wk-track-start" cx="${pts.split(' ')[0].split(',')[0]}" cy="${pts.split(' ')[0].split(',')[1]}" r="3"/></svg>`;
// The outline's box: drawn at once from the phone's copy, else read once the
// card is near the screen and faded in (the box holds its size: nothing moves).
let wkSeen = null;
const wkWanted = new WeakMap();
function trackBox(day, start) {
  const box = el('span', { class: 'wk-track' });
  if (wkTracks[day]) {
    box.innerHTML = trackSvg(wkTracks[day]);
    return box;
  }
  const load = () =>
    weekendCircuit(start)
      .then(c => {
        if (!c?.x?.length) return;
        wkTracks[day] = trackPoints(c);
        writeJson(WK_TRACKS, wkTracks);
        for (const b of document.querySelectorAll(`.wk-track[data-day="${day}"]:empty`)) {
          b.innerHTML = trackSvg(wkTracks[day]);
          b.classList.add('in');
        }
      })
      .catch(() => {});
  box.dataset.day = day;
  if (typeof IntersectionObserver !== 'function') {
    load();
    return box;
  }
  wkSeen ||= new IntersectionObserver(
    seen => {
      for (const x of seen) {
        if (!x.isIntersecting) continue;
        wkSeen.unobserve(x.target);
        const go = wkWanted.get(x.target);
        wkWanted.delete(x.target);
        go?.();
      }
    },
    { rootMargin: '300px 0px' }
  );
  wkWanted.set(box, load);
  wkSeen.observe(box);
  return box;
}
// How long until a session starts: days and hours, hours and minutes, or minutes (numbers big, units small).
function untilParts(ms) {
  const en = locale === 'en';
  const m = Math.max(0, Math.ceil(ms / 60_000));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  const u = (zh, e) => (en ? e : zh);
  if (d >= 7) return [[d, u('天', d === 1 ? 'day' : 'days')]];
  if (d >= 1) return [[d, u('天', 'd')], [h, u('時', 'h')]];
  if (h >= 1) return [[h, u('時', 'h')], [mm, u('分', 'm')]];
  return [[mm || 1, u('分', 'm')]];
}
const countdown = at => {
  const node = el('span', { class: 'wk-count num', 'data-at': String(at) });
  paintCount(node);
  wkTick();
  return node;
};
function paintCount(node) {
  const parts = untilParts(Number(node.dataset.at) - Date.now());
  const text = parts.map(([n, u]) => `${n}${u}`).join(' ');
  if (node.dataset.text === text) return;
  node.dataset.text = text;
  node.replaceChildren(...parts.flatMap(([n, u]) => [el('b', { text: String(n) }), el('small', { text: u })]));
}
// One beat for every countdown on the page, in place (stopped when none is left).
let wkTimer = 0;
function wkTick() {
  if (wkTimer) return;
  wkTimer = setInterval(() => {
    const all = document.querySelectorAll('.wk-count[data-at]');
    if (!all.length) {
      clearInterval(wkTimer);
      wkTimer = 0;
      return;
    }
    for (const n of all) paintCount(n);
  }, 20_000);
}
// Who topped a session, and what that's called.
const topOf = x => (x.sessions?.find(s => s.abbr === x.sessionKey) || (x.sessions?.length === 1 ? x.sessions[0] : null))?.field?.[0] || null;
const codeOf = p => (/^[A-Z]{3}$/.test(p?.abbr || '') ? p.abbr : String(p?.en || p?.name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).pop().slice(0, 3).toUpperCase());
const teamColor = p => f1Driver(p?.en || p?.name || '').color;
const SESSION_KIND = k => (k === 'Race' ? 'race' : ['Qual', 'SS', 'SQ', 'SR'].includes(k) ? 'big' : 'practice');
export function weekendCard(sessions) {
  const e = sessions[0];
  const list = [...sessions].sort((a, b) => a.start.localeCompare(b.start));
  const race = list.find(x => x.sessionKey === 'Race') || list.at(-1);
  const done = list.every(x => x.status.state === 'post');
  const on = list.find(x => x.status.state === 'in');
  const coming = on ? null : list.find(x => x.status.state === 'pre');
  const open = on || coming || race;
  const en = locale === 'en';
  const dayOf = x => localDate(Date.parse(x.start));
  const md = d => { const x = new Date(`${d}T12:00:00`); return `${x.getMonth() + 1}/${x.getDate()}`; };
  const wd = d => new Date(`${d}T12:00:00`).toLocaleDateString(en ? 'en-US' : 'zh-TW', { weekday: 'short' });
  const near = d => (d === today() ? t('today') : d === addDays(today(), 1) ? t('tomorrow') : '');
  const sname = x => { const n = SESSION_NAMES[x.sessionKey]; return n ? n.short[en ? 'en' : 'zh'] : x.session || ''; };
  const first = dayOf(list[0]), last = dayOf(list.at(-1));
  const head = el('div', { class: 'wk-card-head' }, [
    el('div', { class: 'wk-card-top' }, [raceFlag(e), el('strong', { class: 'wk-card-name', text: e.name }), el('span', { class: 'wk-when num', text: first === last ? md(first) : `${md(first)} – ${md(last)}` })]),
    e.venue ? el('small', { class: 'wk-card-line', text: e.venue }) : null
  ]);
  // The panel: on now, next (with its countdown), or the podium.
  let panel;
  if (on) {
    const mins = Math.max(0, Math.round((Date.now() - Date.parse(on.start)) / 60_000));
    panel = [
      el('span', { class: 'wk-kick live' }, [el('i', { class: 'wk-live-dot' }), L({ zh: '進行中', en: 'Live now' })]),
      el('strong', { class: 'wk-big', text: sname(on) }),
      el('small', { class: 'wk-sub num', text: L({ zh: `${timeText(on)} 開始 · 已 ${mins} 分`, en: `Started ${timeText(on)} · ${mins} min in` }) })
    ];
  } else if (coming) {
    const d = dayOf(coming);
    const firstOne = coming === list[0];
    panel = [
      el('span', { class: 'wk-kick' }, [firstOne ? L({ zh: '首場', en: 'First up' }) : L({ zh: '下一場', en: 'Next' }), ' · ', el('b', { text: sname(coming) })]),
      countdown(Date.parse(coming.start)),
      el('small', { class: 'wk-sub num', text: `${near(d) || wd(d)} ${md(d)} ${timeText(coming)}` })
    ];
  } else {
    const field = race.sessions?.find(s => s.abbr === race.sessionKey)?.field || [];
    const [p1, p2, p3] = field;
    panel = p1
      ? [
          el('span', { class: 'wk-kick', text: L({ zh: '冠軍', en: 'Winner' }) }),
          el('span', { class: 'wk-winner' }, [personPic(p1, e.league, 'sm round'), el('strong', { class: 'wk-big', text: String(p1.short || p1.name || '').replace(/^\p{Lu}\.\s*/u, '') })]),
          el('span', { class: 'wk-sub wk-podium' }, [p2, p3].filter(Boolean).map((p, i) => el('span', { class: 'wk-pod' }, [el('em', { class: 'num', text: String(i + 2) }), el('i', { class: 'wk-team', style: `--team:${teamColor(p)}` }), codeOf(p)])))
        ]
      : [el('span', { class: 'wk-kick', text: L({ zh: '已結束', en: 'Over' }) }), el('strong', { class: 'wk-big', text: sname(race) }), el('small', { class: 'wk-sub', text: L({ zh: '成績整理中', en: 'Results to come' }) })];
  }
  // The stops.
  // (The next stop marked only on a weekend this week: every card a month ahead marked read as noise.)
  const soon = coming && Date.parse(coming.start) - Date.now() < 7 * 86_400_000;
  const state = x => (x.status.state === 'in' ? 'live' : x.status.state === 'post' ? 'done' : x === coming && soon ? 'next' : 'later');
  const ran = x => ['live', 'done'].includes(state(x));
  const stops = list.map((x, i) => {
    const st = state(x);
    const d = dayOf(x);
    const top = st === 'done' ? topOf(x) : null;
    const role = x.sessionKey === 'Race' || x.sessionKey === 'SR' ? L({ zh: '冠軍', en: 'Won' }) : ['Qual', 'SS', 'SQ'].includes(x.sessionKey) ? L({ zh: '桿位', en: 'Pole' }) : L({ zh: '最快', en: 'Top' });
    return el('span', { class: `wk-stop ${SESSION_KIND(x.sessionKey)} ${st}${i && ran(x) ? ' fill-l' : ''}${list[i + 1] && ran(list[i + 1]) ? ' fill-r' : ''}${i === 0 ? ' first' : ''}${i === list.length - 1 ? ' last' : ''}` }, [
      el('i', { class: 'wk-dot' }),
      el('small', { class: 'wk-stop-k', text: sname(x) }),
      top
        ? el('small', { class: 'wk-stop-d', text: role })
        : el('small', { class: `wk-stop-d${d === today() ? ' today' : ''}`, text: near(d) || wd(d) }),
      top
        ? el('span', { class: 'wk-stop-t wk-code', style: `--team:${teamColor(top)}`, text: codeOf(top) })
        : el('span', { class: 'wk-stop-t num', text: st === 'live' ? L({ zh: '進行中', en: 'Live' }) : st === 'done' ? '✓' : timeText(x) })
    ]);
  });
  return el('button', { class: `q-card wk-card${on ? ' live' : ''}${done ? ' done' : ''}`, type: 'button', disabled: open?.status?.void ? true : null, onclick: () => openEvent(open) }, [
    head,
    el('div', { class: `wk-panel${on ? ' live' : ''}` }, [el('span', { class: 'wk-panel-text' }, panel), trackBox(dayOf(race), race.start)]),
    el('div', { class: 'wk-rail', style: `--n:${stops.length}` }, stops)
  ]);
}

// A league's rounds read: the page drawn again once (every game on it asked
// for them, and each drew the whole page again: 18 redraws on a cup night).
let roundsTimer = 0;
const roundsIn = () => {
  clearTimeout(roundsTimer);
  roundsTimer = setTimeout(() => state.tab === 'matches' && renderScores());
};
// The league rail: made once for its leagues and language, the chosen one
// marked in place on every redraw after (made again each time, its thirty
// logos were most of a league switch's freeze on a phone; kept, it also
// keeps its scroll).
let railKept = null;
function leagueRail(rail) {
  const key = `${locale}|${rail.join()}`;
  if (railKept?.key !== key) {
    const pick = k => pickLeague(k);
    railKept = {
      key,
      node: el('div', { class: 'q-chips league-rail' }, [
        el('button', { class: 'q-chip search-chip', type: 'button', 'aria-label': L({ zh: '搜尋', en: 'Search' }), html: icon('search'), onclick: openSearch }),
        el('button', { class: 'q-chip all-chip', type: 'button', 'data-league': ALL, 'aria-pressed': 'false', text: t('f_all'), onclick: () => state.scores.league !== ALL && openAll(state.scores.chosen || today()) }),
        ...rail.map(k => el('button', { class: 'q-chip', type: 'button', 'data-league': k, 'aria-pressed': 'false', onclick: () => pick(k) }, [leagueMark(k), locale === 'en' ? leagueName(k, locale) : leagueName(k, locale).replace(/\s.*$/, '')]))
      ])
    };
  }
  railKept.node.__kept = true;
  for (const chip of railKept.node.querySelectorAll('[data-league]')) chip.setAttribute('aria-pressed', String(chip.dataset.league === state.scores.league));
  return railKept.node;
}
// A league opened from a page of it (a game's, team's or player's sheet,
// by the league's name at its top): 賽事 on that league, the sheets put
// away (Jay 2026-10-30: every page leads to the others).
function openLeague(k, view = null) {
  if (!LEAGUES[k]) return;
  for (const d of document.querySelectorAll('dialog[open]')) d.close();
  if (state.scores.league !== k) pickLeague(k, view);
  else if (view) state.scores.view = view;
  if (state.tab !== 'matches') showTab('matches');
  else renderScores();
}
// A league of 賽事's rail opened (`view`: on that tab, else the one open now where it has it).
function pickLeague(k, view = null) {
  const sc = state.scores;
  if (sc.league === k) return;
  state.scores = { ...sc, sport: LEAGUES[k].sport, league: k, season: null, date: sc.chosen || null, picked: false, byDay: null, days: [], extra: 0, stage: 'all', touched: true, view: view || (hasStandings(k) || sc.view === 'bracket' ? sc.view : 'games') };
  loadScores();
}
// A swipe past a league's first or last tab: the league beside it on the
// rail (全部 first), on its first tab going on, its last coming back (Jay 2026-10-27).
function stepLeague(dir) {
  const rail = [ALL, ...scoresRail()];
  const k = rail[rail.indexOf(state.scores.league) + dir];
  if (!k) return false;
  if (k === ALL) return openAll(state.scores.chosen || today()), true;
  const sport = LEAGUES[k].sport;
  pickLeague(k, dir > 0 ? 'games' : hasLeaders(sport, LEAGUES[k].espn) ? 'leaders' : hasBracket(k) ? 'bracket' : hasStandings(k) ? 'table' : 'games');
  return true;
}
function scoresRail() {
  const mine = new Set(state.prefs.leagues);
  // Every league on one rail, theirs first (in their order), then by what's
  // at stake and how watchable in Taiwan (leagues.mjs byStakes); the search
  // first of all, then 全部.
  const rest = shownSports().flatMap(sp => shownLeaguesOf(sp)).filter(k => !mine.has(k));
  return inSeasonFirst([...state.prefs.leagues.filter(isActive), ...byStakes(rest, leagueBounds, today())]);
}
function renderScores() {
  const sc = state.scores;
  if (sc.league === ALL) return renderAll();
  // A sport or league with nothing on now: the first one that has.
  if (activeSet && !isActive(sc.league)) {
    const sport = isActiveSport(sc.sport) ? sc.sport : shownSports()[0];
    const league = shownLeaguesOf(sport).find(k => LEAGUES[k].top) || shownLeaguesOf(sport)[0];
    if (league) {
      state.scores = { ...sc, sport, league, date: sc.chosen || null, picked: false, byDay: null, days: [], extra: 0, stage: 'all', view: hasStandings(league) ? sc.view : 'games' };
      return loadScores();
    }
  }
  const box = $('panel-matches');
  const mine = new Set(state.prefs.leagues);
  const leagueChips = leagueRail(scoresRail());
  let strip = null;
  let list;
  let stages = null;
  loadBracket(sc.league);
  warmTable(sc.league);
  // Every league with playoffs has the tab from the start (its shape while it's read).
  const po = brackets.get(sc.league);
  const rounds = po?.model?.rounds || [];
  const reading = hasBracket(sc.league) && !po?.model;
  const knockView = sc.view === 'bracket' && hasBracket(sc.league) && (rounds.length > 0 || reading);
  // The NBA's 季後賽 holds the NBA Cup too (cupPicked), read once picked.
  const poKey = sc.league === 'nba' && cupPicked(sc) ? CUP : sc.league;
  if (knockView && poKey === CUP) loadBracket(CUP);
  const shown = brackets.get(poKey);
  const shownRounds = shown?.model?.rounds || [];
  const poFailed = !shown?.model && shown?.failed && shown.fails > 1 && !shown.loading;
  const cupChips = knockView && sc.league === 'nba' ? segmented([['po', L({ zh: '季後賽', en: 'Playoffs' })], ['cup', L({ zh: 'NBA 盃', en: 'NBA Cup' })]], poKey === CUP ? 'cup' : 'po', v => ((sc.po = v), renderScores()), '', { chips: true }) : null;
  const tableView = !knockView && sc.view === 'table' && hasStandings(sc.league);
  const leadersView = !knockView && !tableView && sc.view === 'leaders' && hasLeaders(LEAGUES[sc.league]?.sport, LEAGUES[sc.league]?.espn);
  if (leadersView) list = leadersOf(sc.league);
  else if (knockView) list = el('div', { class: 'po-wrap' }, [cupChips, shownRounds.length ? playoffView(shown.model, poKey) : poFailed ? empty(t('failed')) : bracketShape()]);
  else if (tableView) list = tableOf(sc.league);
  else if (sc.byDay == null || sc.loading) list = spinner();
  else if (sc.byDay === 'failed') list = empty(t('failed'));
  else if (sc.mode === 'event') {
    const events = [...sc.byDay.values()].flat().sort((a, b) => a.start.localeCompare(b.start));
    const now = Date.now();
    const current = events.filter(e => e.status.state === 'in');
    const next = events.filter(e => e.status.state === 'pre' && Date.parse(e.end || e.start) > now - 86_400_000);
    const past = events.filter(e => e.status.state === 'post').reverse();
    // A race series: one card per weekend (its sessions inside), not a row per session.
    const racing = LEAGUES[sc.league]?.sport === 'racing';
    const block = (title, list) => section(title, el('div', { class: 'q-card list game-grid' }, list.map(e => eventRow(e, { league: false }))));
    // A race series: one card per weekend (its sessions inside), placed by
    // the whole weekend: on while a session is, to come while one is (its
    // practice over or not), over once they all are.
    const wkBlock = (title, list) => section(title, el('div', { class: 'wk-cards' }, list.map(weekendCard)));
    const wks = racing ? weekends(events) : [];
    const wkNow = wks.filter(w => w.some(x => x.status.state === 'in'));
    const wkNext = wks.filter(w => !wkNow.includes(w) && w.some(x => x.status.state === 'pre' && Date.parse(x.end || x.start) > now - 86_400_000));
    const wkPast = wks.filter(w => !wkNow.includes(w) && !wkNext.includes(w)).reverse();
    list = !events.length
      ? empty(t('noEvents'))
      : racing
        ? (() => {
            // 接下來 or 已結束, one at a time (a season's every weekend in one
            // list put the finished ones a long scroll down); the one on, in both.
            const part = sc.racePart === 'past' && wkPast.length ? 'past' : wkNext.length ? 'next' : 'past';
            const pick = wkNext.length && wkPast.length ? segmented([['next', t('upcomingEvents')], ['past', t('pastEvents')]], part, v => ((sc.racePart = v), renderScores()), 'views race-part') : null;
            return el('div', {}, [wkNow.length ? wkBlock(t('liveNow'), wkNow) : null, pick, pick ? el('div', { class: 'wk-cards' }, (part === 'next' ? wkNext : wkPast).map(weekendCard)) : part === 'next' ? wkBlock(t('upcomingEvents'), wkNext) : wkBlock(t('pastEvents'), wkPast)]);
          })()
        : el('div', {}, [
            current.length ? block(t('liveNow'), current) : null,
            next.length ? block(t('upcomingEvents'), next) : null,
            past.length ? block(t('pastEvents'), past) : null
          ]);
  } else if (!sc.days.length) list = empty(t('noGamesSeason'));
  else {
    // The same date strip as 首頁: the league's game days, more of them as
    // it's scrolled near either end, and 📅 for any day.
    // The season's game days, all of them (the nightly pack), so it scrolls
    // freely and stops at the season's ends; the days read so far meanwhile.
    const league = sc.league;
    const season = leagueDays(league, () => state.tab === 'matches' && state.scores.league === league && renderScores());
    const only = new Set([...sc.days, ...(season || [])]);
    put(scoresBarEl, dateStrip(sc.date, pickScoresDay, { only, range: sc.range, bounds: leagueBounds(league) }));
    strip = scoresBarEl;
    const order = { in: 0, pre: 1, post: 2 };
    const games = [...(sc.byDay.get(sc.date) || [])].sort((a, b) => order[a.status.state] - order[b.status.state] || a.start.localeCompare(b.start));
    // A filter by stage only when this day has games of more than one (a cup
    // night among regular-season games): the season's preseason and regular
    // season are never on the same day, so a filter by those picks nothing.
    const keys = [...new Set(games.map(e => stageOf(e).key).filter(Boolean))];
    if (!keys.includes(sc.stage)) sc.stage = 'all';
    if (keys.length > 1) {
      stages = segmented([['all', t('f_all')], ...keys.map(k => [k, stageOf(games.find(e => stageOf(e).key === k))[locale === 'en' ? 'en' : 'zh']])], sc.stage, v => ((sc.stage = v), renderScores()), 'scroll stage-filter');
    }
    const shown = sc.stage === 'all' ? games : games.filter(e => stageOf(e).key === sc.stage);
    // A football league's day: its matchweek (第 6 輪, or 第 6–7 輪 across a
    // postponed game), a cup's league-phase matchday (第 2 比賽日).
    const weeks = [...new Set(shown.map(e => weekOf(e, roundsIn)).filter(Boolean))].sort((a, b) => a - b);
    const wk = weeks.length ? roundLabel(sc.league, weeks[0], weeks.at(-1), locale) : '';
    // The first screen's games at once, the rest a few at a time after (a
    // cup night's 18 drawn at once froze a league switch for most of a second
    // on a phone). A quiet refresh redraws in place, every game at once.
    const row = e => eventRow(e, { league: false, day: false });
    // (On a wide page the games stand in columns, filled down each in turn:
    // there every game at once, since each few added after dealt the columns
    // again and the cards hopped from one to another: Jay 2026-11-06, an iPad.)
    const whole = scoresQuiet || document.documentElement.classList.contains('q-wide');
    const card = shown.length ? el('div', { class: 'q-card list game-grid' }, (whole ? shown : shown.slice(0, FIRST_ROWS)).map(row)) : null;
    if (card && !whole) moreRows(card, shown.slice(FIRST_ROWS), row);
    list = el('div', {}, [el('p', { class: 'day-head', text: [dayLabel(sc.date, { long: true }), wk, t('gamesN', { n: shown.length })].filter(Boolean).join(' · ') }), card || empty(t('noGames'))]);
  }
  // The league as the page's head: its name, following it at the right.
  const name = leagueName(sc.league, locale);
  const head = pageHead(name, followButton(() => mine.has(sc.league), () => (toggleLeague(sc.league), renderScores()), t('followLeague')));
  if (name.length > (locale === 'en' ? 14 : 7)) head.classList.add('long');
  const viewList = [['games', t('schedule')], ...(hasStandings(sc.league) ? [['table', t('table')]] : []), ...(rounds.length || reading ? [['bracket', LEAGUES[sc.league].cup ? L({ zh: '淘汰賽', en: 'Knockouts' }) : L({ zh: '季後賽', en: 'Playoffs' })]] : []), ...(hasLeaders(LEAGUES[sc.league]?.sport, LEAGUES[sc.league]?.espn) ? [['leaders', L({ zh: '數據', en: 'Stats' })]] : [])];
  const viewNow = knockView ? 'bracket' : tableView ? 'table' : leadersView ? 'leaders' : 'games';
  const views = viewList.length > 1 ? segmented(viewList, viewNow, v => ((sc.view = v), renderScores()), 'views') : null;
  // (For the page's swipe: the tab beside this one.)
  const other = tableView || knockView || leadersView;
  // (A league of games has a date strip on 賽程, a race series none.)
  sc.views = { list: viewList.map(([k]) => k), now: viewNow, strip: !other && LEAGUES[sc.league].kind === 'match' };
  const parts = [head, leagueChips, views, other ? null : strip, other ? null : stages, list].filter(Boolean);
  if (scoresQuiet && box.childNodes.length === parts.length) return parts.forEach((n, i) => morph(box.childNodes[i], n));
  put(box, ...parts);
  centerChosen(box);
}

// A long list's rows past the first screen, added a few at a time, each
// batch its own moment (the page answers a tap in between); none once the
// list has been drawn again.
const FIRST_ROWS = 8;
function moreRows(card, rest, row, step = 6) {
  if (!rest.length) return;
  setTimeout(() => {
    if (!card.isConnected) return;
    card.append(...rest.slice(0, step).map(row));
    moreRows(card, rest.slice(step), row, step);
  }, 0);
}

const searchEspn = q => proxyJson(`https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(q)}&limit=12`, { ttl: 10 * 60_000 }).then(parseSearch);

// ---- 追蹤: what you follow, at a glance ------------------------------------------------------
//
// How your teams and players are doing: the matches followed on their own,
// then each team (its place, form, next game and where it's on, last
// result), then the players. Their week on TV is 轉播's (one place for when
// and where), their leagues 賽事's. Nothing followed yet: popular teams of
// the leagues on TV, a tap each.
const TV_DAYS = 7;
// (In English by the short name fans use: "Los Angeles Dodgers" was cut to "Los Angeles …" in its half-width card.)
const SUGGEST = [
  ['mlb', '19', 'Los Angeles Dodgers', 'Dodgers'], ['mlb', '10', 'New York Yankees', 'Yankees'], ['cpbl', 'CTBC Brothers', null, 'Brothers'], ['cpbl', 'Rakuten Monkeys', null, 'Monkeys'],
  ['nba', '13', 'Los Angeles Lakers', 'Lakers'], ['nba', '9', 'Golden State Warriors', 'Warriors'], ['nba', '2', 'Boston Celtics', 'Celtics'],
  ['epl', '359', 'Arsenal'], ['epl', '382', 'Manchester City', 'Man City'], ['epl', '364', 'Liverpool'], ['mls', '20232', 'Inter Miami CF', 'Inter Miami']
].map(([league, id, name, short]) => ({ league, id, name: name || id, short }));

// F1's season (every weekend), read once for 追蹤.
let f1Season = null;
function f1Races() {
  if (f1Season === null) {
    f1Season = undefined;
    seasonEvents('f1')
      .then(list => (f1Season = list || []))
      .catch(() => (f1Season = []))
      .then(() => (state.tab === 'following' ? renderFollowing() : state.tab === 'live' ? renderLive() : null));
  }
  return f1Season || [];
}
const teamGames = f => state.home.teams.get(`${f.league}:${f.id}`)?.map(freshGame);
// The followed teams' (and F1's) games on TV in the next week, live first, by start.
function myTvGames() {
  const now = Date.now();
  const fresh = new Map(dayAll(state.days.get(today())).map(e => [`${e.league}:${e.id}`, e]));
  const games = followedTeams().flatMap(f => teamGames(f) || []).map(e => fresh.get(`${e.league}:${e.id}`) || e);
  // F1's qualifying, sprint and race (practice is on 賽事 and the guide, not among yours).
  const f1 = state.prefs.follows.some(f => f.league === 'f1') || watched().includes('f1') ? f1Races().flatMap(e => splitWeekend(e, now, locale)).filter(e => e.sessionKey && !practice(e)) : [];
  // A match followed on its own is theirs, on TV here or not.
  const own = followedGames();
  const seen = new Set();
  const key = e => `${e.league}:${e.id}:${e.sessionKey || ''}`;
  // A league followed as a league: its chosen games (the days read so far).
  const chosen = [...state.days.values()].flatMap(x => x.events || []).filter(isChosenGame).map(e => fresh.get(`${e.league}:${e.id}`) || e);
  return [...own, ...games, ...chosen, ...f1]
    .filter(e => !e.status?.void && e.status?.state !== 'post' && Date.parse(e.start) > now - 4 * 3_600_000 && Date.parse(e.start) < now + TV_DAYS * 86_400_000)
    .filter(e => (onTv(e) || own.includes(e)) && !seen.has(key(e)) && seen.add(key(e)))
    .sort((a, b) => (b.status.state === 'in') - (a.status.state === 'in') || a.start.localeCompare(b.start));
}
// A finished game's result with where it can be watched again under it, as
// a game to come has its time and channel (愛爾達1台・回看, 愛爾達・重播).
function withAgain(pill, e) {
  const r = replayHint(e);
  if (!r) return pill;
  const en = locale === 'en';
  const text = r.video ? (en ? 'ELTA · replay' : '愛爾達・重播') : `${r.channels[0].short[en ? 'en' : 'zh']}${en ? ' · replay' : '・回看'}`;
  return el('span', { class: 'tf-when' }, [pill, el('span', { class: 'tf-tv', text })]);
}
// An opponent on a followed card: in English by the name fans use (Brewers, not Milwaukee Brewers).
const oppName = (league, side) => (locale === 'en' ? side.short || side.name : localSide(league, side).name);
// A game's when on a followed card: its weekday within the week ahead (週四 03:00), else as every list says it.
const soonOf = e => {
  const d = localDate(Date.parse(shownStart(e)));
  const n = dayOffset(d);
  return n > 1 && n < 7 ? `${new Date(`${d}T12:00:00`).toLocaleDateString(locale === 'en' ? 'en-US' : 'zh-TW', { weekday: 'short' })} ${timeText(e)}` : whenOf(e);
};
// Where a game is on: its channel and commentary, else whether it's known to be on nowhere.
function whereTv(e) {
  const b = channelsOf(e)[0];
  if (b) return el('span', { class: 'tf-tv' }, [document.createTextNode(b.short[locale === 'en' ? 'en' : 'zh']), b.guess ? guessTag() : b.audio ? el('span', { class: 'au-tag', text: audioName(b) }) : null]);
  return el('span', { class: 'tf-tv none', text: tvKnown(e) ? L({ zh: '沒有轉播', en: 'Not on TV' }) : L({ zh: '轉播待公布', en: 'TV to come' }) });
}

// 我的聯賽: a short list, each league with how many games today has, its
// 賽事 a tap away (Jay 2026-11-04: the big tiles never pleased). At the top of
// 追蹤 (Jay 2026-11-10: off 首頁); on a wide page its rows in three columns.
function myLeaguesCard() {
  const slot = state.days.get(today());
  const dayCount = k => (slot ? dayAll(slot).filter(e => e.league === k && !practice(e)).length : 0);
  return el('div', { class: 'q-card list my-leagues-list' }, inSeasonFirst(state.prefs.leagues).map(k => el('button', { class: 'ml-row', type: 'button', onclick: () => openScores(k) }, [leagueMark(k), el('span', { class: 'ml-name', text: leagueName(k, locale).replace(/\s.*$/, '') }), el('span', { class: 'ml-sub', text: !slot ? '' : dayCount(k) ? L({ zh: `今天 ${dayCount(k)} 場`, en: `${dayCount(k)} today` }) : L({ zh: '今天休息', en: 'Off today' }) }), el('span', { class: 'ml-chev', html: icon('chevron') })])));
}
// 問比賽 (the family's AI plan): what the phone has read of the teams and
// leagues followed, handed to ask.js; each row opens its team or game.
function askSource() {
  const en = locale === 'en';
  const nameOf = (league, side) => (!side ? '' : en ? side.short || side.name || '' : localSide(league, { name: side.name }).name || side.short || side.name || '');
  const mine = () => {
    const seen = new Set();
    return followedTeams().filter(f => !f.athlete && !seen.has(`${f.league}:${f.id}`) && seen.add(`${f.league}:${f.id}`));
  };
  const todays = () => {
    const leagues = new Set(followedLeagues());
    return dayAll(state.days.get(today())).filter(e => leagues.has(e.league)).map(freshGame);
  };
  return {
    en,
    nameOf,
    teams: () =>
      mine().slice(0, 8).map(f => {
        const r = state.home.tables[f.league]?.[f.id];
        return { league: f.league, id: String(f.id), name: shownName(f), logo: f.logo || fallbackLogo(f.league, { id: f.id, name: f.name }), pos: r?.pos || null, n: r?.n || null, group: r?.group && !/\d{4}/.test(r.group) && r.group !== leagueName(f.league, locale) ? r.group : '', leagueName: leagueName(f.league, locale).replace(/\s.*$/, ''), games: teamGames(f) || [] };
      }),
    // Each followed league's table (a league of groups: the groups my teams are in, else its first).
    standings: async () => {
      const ids = new Set(mine().map(f => `${f.league}:${f.id}`));
      const out = {};
      const leagues = followedLeagues().filter(k => hasStandings(k) && LEAGUES[k]?.sport !== 'racing').slice(0, 4);
      const got = await Promise.all(leagues.map(k => standings(k).then(g => [k, g]).catch(() => [k, null])));
      for (const [k, groups] of got) {
        const list = (groups || []).filter(g => g.rows?.length && tableStarted(g));
        const pick = list.filter(g => g.rows.some(r => ids.has(`${k}:${r.id}`)));
        (pick.length ? pick : list.slice(0, 1)).slice(0, 2).forEach((g, i) => {
          const soccer = LEAGUES[k]?.sport === 'soccer';
          const name = leagueName(k, locale).replace(/\s.*$/, '');
          out[i ? `${k}${i}` : k] = {
            league: k,
            name,
            title: list.length > 1 && g.name ? `${name} ${g.name}` : name,
            rows: g.rows.map(r => ({ id: String(r.id), name: r.name, short: r.short, logo: r.logo, record: soccer ? (r.stats?.PTS != null ? (en ? `${r.stats.PTS} pts` : `${r.stats.PTS} 分`) : '') : r.stats?.W != null ? `${r.stats.W}-${r.stats.L}` : '' }))
          };
        });
      }
      return out;
    },
    today: todays,
    openTeam: (league, id) => {
      const f = mine().find(x => x.league === league && String(x.id) === String(id));
      openTeam(league, id, f || { id });
    },
    openGame: (league, id) => {
      const e = todays().find(x => x.league === league && String(x.id) === String(id));
      if (e) openEvent(e);
    }
  };
}
// 問比賽's way in: the Orbit AI mark, a question to start from.
// (ask.js and the kit's AI read on the tap, not with the first screen.)
const askRow = () =>
  el('div', { class: 'q-rowcard ask-card' }, [
    el('button', { class: 'q-ritem chevron ask-row', type: 'button', onclick: () => import('./ask.js').then(m => m.openAsk(askSource())).catch(() => {}) }, [
      el('span', { class: 'q-tile ask-tile', 'aria-hidden': 'true', html: kitUI.icons?.ai || icon('spark') }),
      el('span', { class: 'q-ritem-text' }, [el('span', { class: 'q-ritem-title', text: L({ zh: '問比賽', en: 'Ask about your teams' }) }), el('small', { text: L({ zh: '例如「我的球隊排第幾」', en: '“When do my teams play next?”' }) })])
    ])
  ]);
function renderFollowing() {
  const box = $('panel-following');
  const p = state.prefs;
  loadFollowedTeams();
  loadTables();
  loadFollowedGames();
  const teams = p.follows.filter(f => !f.athlete);
  const people = p.follows.filter(f => f.athlete);
  // The matches followed one by one: on now first, then by start; one over stays until it's let go.
  const games = followedGames().sort((a, b) => (b.status.state === 'in') - (a.status.state === 'in') || (a.status.state === 'post') - (b.status.state === 'post') || a.start.localeCompare(b.start));
  const gamesBlock = games.length
    ? section(
        L({ zh: '比賽', en: 'Matches' }),
        el('div', { class: 'q-card list followed-games game-grid' }, games.map(e => el('div', { class: 'fg-row' }, [withWatch(eventRow(e), e), el('button', { class: 'fg-off', type: 'button', 'aria-label': L({ zh: '取消追蹤這場', en: 'Unfollow this match' }), text: '★', onclick: () => toggleFollowGame(e) })]))),
        { sub: gamesNote(games) }
      )
    : null;
  // 我的設定 where it's seen (the owner, 2026-10-23: not a 管理 button in
  // the head): its rows at the foot of the tab, each saying what's set now.
  const names = p.leagues.slice(0, 2).map(k => leagueName(k, locale)).join('、') + (p.leagues.length > 2 ? L({ zh: ` 等 ${p.leagues.length} 個`, en: ` and ${p.leagues.length - 2} more` }) : '');
  const settings = section(
    L({ zh: '設定', en: 'Settings' }),
    el('div', { class: 'q-rowcard' }, [
      el('button', { class: 'q-ritem chevron set-open', type: 'button', onclick: openFollowEditor }, [el('span', { class: 'q-tile', 'aria-hidden': 'true', html: icon('list') }), el('span', { class: 'q-ritem-text' }, [el('span', { class: 'q-ritem-title', text: L({ zh: '聯賽與追蹤', en: 'Leagues and follows' }) }), el('small', { text: names || t('noLeaguesYet') })])]),
      el('button', { class: 'q-ritem chevron set-open', type: 'button', onclick: openFollowEditor }, [el('span', { class: 'q-tile', 'aria-hidden': 'true', html: icon('tv') }), el('span', { class: 'q-ritem-text' }, [el('span', { class: 'q-ritem-title', text: t('tvAudio') })]), el('span', { class: 'q-ritem-value', text: (p.audio || 'en') === 'en' ? t('tvAudioEn') : t('tvAudioZh') })])
    ]),
    { cls: 'following-settings' }
  );
  // 我的聯賽 first, what's followed from the widest down: leagues, then
  // matches, teams, players (Jay 2026-11-10: at the foot beside 設定 it went unseen).
  const leagues = p.leagues.length ? section(t('yourLeagues'), myLeaguesCard(), { cls: 'following-leagues' }) : null;
  if (!teams.length && !people.length) {
    put(box, pageHead(t('tab_following')), leagues, gamesBlock, section(L({ zh: '熱門球隊', en: 'Popular teams' }), el('div', { class: 'q-rowcard' }, SUGGEST.map(suggestCard)), { cls: 'suggest-teams' }), settings);
    return;
  }
  put(
    box,
    pageHead(t('tab_following')),
    askRow(),
    leagues,
    gamesBlock,
    teams.length ? section(L({ zh: '球隊', en: 'Teams' }), el('div', { class: 'team-cards' }, teams.map(f => (f.f1team === true ? crewRow(f) : teamCard(f))))) : null,
    people.length ? section(L({ zh: '選手', en: 'Players' }), el('div', { class: 'team-cards' }, people.map(personRow))) : null,
    settings
  );
}
// A popular team, followed with a tap.
function suggestCard(s) {
  const on = isFollowed(s.league, s.id);
  const logoUrl = fallbackLogo(s.league, { id: s.id, name: s.name });
  // A row of the kit's list: the team's logo at 40px as the tile (white in every theme: the Dodgers' and Yankees' marks are white), name and league, + / ✓ trailing.
  return el('button', { class: `q-ritem suggest${on ? ' on' : ''}`, type: 'button', onclick: () => toggleFollow(s.league, { id: s.id, name: s.name, en: s.name, logo: logoUrl }) }, [
    el('span', { class: 'suggest-tile' }, [logo(logoUrl, s.name, 'sm')]),
    el('span', { class: 'q-ritem-text' }, [el('span', { class: 'q-ritem-title', text: locale === 'en' && s.short ? s.short : localSide(s.league, { name: s.name }).name }), el('small', { text: leagueName(s.league, locale) })]),
    el('b', { class: 'suggest-add', text: on ? '✓' : '+' })
  ]);
}
// A followed team at a glance: its place and form, its next game (when, where
// it's on, 觀看 while it's on) and last result; its page on a tap.
function teamCard(f) {
  const games = teamGames(f);
  const id = String(f.id);
  const us = g => [g.home, g.away].find(x => String(x?.id) === id);
  const them = g => [g.home, g.away].find(x => x && String(x.id) !== id);
  const result = g => (us(g) && them(g) ? outcome(us(g), them(g)) : '');
  const now = Date.now();
  const played = (games || []).filter(g => g.status.state === 'post' && !g.status.void && us(g) && them(g));
  const last = played.at(-1);
  const next = (games || []).find(g => g.status.state === 'in') || (games || []).find(g => g.status.state === 'pre' && !g.status.void && Date.parse(g.start) > now - 3_600_000);
  const place = state.home.tables[f.league]?.[id];
  const word = r => (locale === 'en' ? r : { W: '勝', L: '敗', D: '和' }[r]);
  const line = (g, label) => {
    if (!g) return null;
    const x = them(g);
    const opp = x && !/^TBD$/i.test(x.name || '') ? x : null;
    const right =
      g.status.state === 'pre'
        ? el('span', { class: 'tf-when' }, [el('small', { class: 'num', text: soonOf(g) }), whereTv(g)])
        : g.status.state === 'in'
          ? el('span', { class: `num tf-score live${g.status?.noScore ? ' no-score' : ''}`, text: g.status?.noScore ? L({ zh: '比賽中・比分讀不到', en: 'Live · score unavailable' }) : `${t('live')} ${scoreText(us(g)?.score)}–${scoreText(opp?.score)}` })
          : withAgain(el('span', { class: `num result-pill ${result(g).toLowerCase()}`, text: `${word(result(g)) || ''} ${scoreText(us(g)?.score)}–${scoreText(opp?.score)}`.trim() }), g);
    return el('button', { class: 'tf-game', type: 'button', disabled: g.status?.void ? true : null, onclick: () => openEvent(g) }, [
      el('small', { class: 'muted tf-k', text: label }),
      opp ? logo(opp.logo, opp.name, 'xs') : el('span'),
      el('span', { class: 'tf-opp', text: opp ? `${g.home && String(g.home.id) === id ? 'vs' : '@'} ${oppName(g.league, opp)}` : L({ zh: '對手待定', en: 'Opponent to be decided' }) }),
      right
    ]);
  };
  const sub = [locale === 'en' ? leagueName(f.league, locale) : /^([A-Za-z0-9]+) [^\x00-\x7f]/.exec(leagueName(f.league, locale))?.[1] || leagueName(f.league, locale), place?.pos ? L({ zh: `${place.group || ''}第 ${place.pos} 名`, en: `${place.pos}${['th', 'st', 'nd', 'rd'][place.pos % 10 < 4 && Math.floor(place.pos / 10) !== 1 ? place.pos % 10 : 0]}${place.group ? ` in ${place.group}` : ''}` }) : ''].filter(Boolean).join(' · ');
  return el('div', { class: 'tf-row' }, [
    el('button', { class: 'tf-team', type: 'button', onclick: () => openTeam(f.league, f.id, f) }, [
      logo(f.logo || fallbackLogo(f.league, { id: f.id, name: f.name }), f.name, 'tf-logo'),
      el('span', { class: 'tf-name' }, [
        el('strong', { text: shownName(f) }),
        el('small', { class: 'muted', text: sub }),
        // Its form in the league named beside it, as on its page (leagueForm).
        played.length ? el('span', { class: 'form-pills' }, (leagueForm(played, id, f.league) || played.slice(-5)).map(g => el('span', { class: `pill sm ${result(g)}`, text: word(result(g)) }))) : null
      ])
    ]),
    games === null ? el('small', { class: 'muted tf-wait', text: '…' }) : !games && teamsUnread.has(`${f.league}:${f.id}`) ? el('small', { class: 'muted tf-wait', text: t('failed') }) : el('div', { class: 'tf-games' }, [line(next, L({ zh: '下一場', en: 'Next' })), line(last, L({ zh: '上一場', en: 'Last' }))]),
    next ? watchButton(next, 'wide') : null
  ]);
}

// A followed F1 team: its cars' finishes in the last race, and the next session (where it's on).
function crewRow(f) {
  const races = f1Races();
  const raceOf = e => (e.sessions || []).find(x => x.abbr === 'Race' && x.status.state === 'post');
  const last = [...races].reverse().find(raceOf);
  const next = races.find(e => (e.sessions || []).some(x => x.status.state !== 'post'));
  const mine = d => d?.name && f1Driver(d.name).team === f1Constructor(f.name).name;
  const lastLine = last
    ? el('button', { class: 'tf-game', type: 'button', onclick: () => openEvent(splitWeekend(last, Date.now(), locale).find(x => x.sessionKey === 'Race') || last) }, [
        el('small', { class: 'muted tf-k', text: L({ zh: '上一站', en: 'Last' }) }),
        raceFlag(last),
        el('span', { class: 'tf-opp', text: last.name }),
        el('span', { class: 'num tf-score', text: raceOf(last).field.map((d, i) => (mine(d) ? `P${i + 1}` : '')).filter(Boolean).join(' · ') || '–' })
      ])
    : null;
  const session = next && splitWeekend(next, Date.now(), locale).find(x => x.status.state !== 'post');
  const nextLine = session
    ? el('button', { class: 'tf-game', type: 'button', onclick: () => openEvent(session) }, [
        el('small', { class: 'muted tf-k', text: L({ zh: '下一站', en: 'Next' }) }),
        raceFlag(next),
        el('span', { class: 'tf-opp', text: [next.name, session.sessionKey ? sessionName({ abbr: session.sessionKey }, locale, true) : session.session].filter(Boolean).join(' · ') }),
        el('span', { class: 'tf-when' }, [el('small', { class: 'num', text: soonOf(session) }), whereTv(session)])
      ])
    : null;
  return el('div', { class: 'tf-row' }, [
    el('button', { class: 'tf-team', type: 'button', onclick: () => openConstructor({ id: f.id, name: f.name, en: f.name }) }, [constructorBadge(f.name, 'tf-logo'), el('span', { class: 'tf-name' }, [el('strong', { text: shownName(f) }), el('small', { class: 'muted', text: leagueName(f.league, locale) })])]),
    f1Season === undefined ? el('small', { class: 'muted tf-wait', text: '…' }) : el('div', { class: 'tf-games' }, [nextLine, lastLine])
  ]);
}

// A game's four numbers worth showing, by what the line has: a hitter's hits,
// home runs, runs batted in and walks; a pitcher's innings, hits, earned runs
// and strikeouts; points, rebounds, assists and steals; goals, assists, shots.
const GAME_STATS = [['IP', 'ER', 'H', 'K'], ['H', 'HR', 'RBI', 'BB'], ['PTS', 'REB', 'AST', 'STL'], ['G', 'A', 'SH', 'ST']];
const gameStats = labels => {
  const set = GAME_STATS.find(want => want.filter(k => labels.includes(k)).length >= 3);
  const picked = set ? set.filter(k => labels.includes(k)).map(k => labels.indexOf(k)) : [];
  return [...picked, ...labels.map((_, i) => i).filter(i => !picked.includes(i))].slice(0, 4);
};
// ---- A followed player or driver -------------------------------------------------------------
//
// A player: their team and position, an injury, the season's key numbers,
// their last game's line, and their team's next game with where it's on.
// A driver: the championship place and points, the last race's finish and
// the next session with its channel. Read once a visit (ESPN's player card
// and its overview; F1's table), drawn again as they come.
const people = new Map();
let f1Table;
function loadPerson(f) {
  const key = `${f.league}:${f.id}`;
  if (people.has(key)) return people.get(key);
  people.set(key, null);
  Promise.all([athlete(f.league, f.id), f.league === 'f1' ? null : athleteOverview(f.league, f.id).catch(() => null)])
    .then(([a, ov]) => people.set(key, { a, ov }))
    .catch(() => people.set(key, { a: null, ov: null }))
    .then(() => state.tab === 'following' && renderFollowing());
  if (f.league === 'f1' && f1Table === undefined) {
    f1Table = null;
    standings('f1')
      .then(groups => (f1Table = groups))
      .catch(() => (f1Table = []))
      .then(() => state.tab === 'following' && renderFollowing());
  }
  return null;
}
const personHead = (f, sub, tag) =>
  el('button', { class: 'tf-team', type: 'button', onclick: () => openPlayer(f.league, f.id) }, [personPic(f, f.league, 'tf-logo round'), el('span', { class: 'tf-name' }, [el('strong', {}, [personName(f)]), el('small', { class: 'muted', text: sub })]), tag]);
function personRow(f) {
  const got = loadPerson(f);
  const a = got?.a;
  if (f.league === 'f1') return driverRow(f, a);
  const injured = a?.injuries?.[0];
  const head = personHead(f, [a?.team ? localSide(f.league, { name: a.team }).name : f.team ? localSide(f.league, { name: f.team.name }).name : leagueName(f.league, locale), a?.position ? zhLater(a.position) : ''].filter(Boolean).join(' · '), injured ? el('span', { class: 'tf-injury', text: locale === 'en' ? injured : injuryZh(injured) }) : null);
  if (!got) return el('div', { class: 'tf-row' }, [head, el('small', { class: 'muted tf-wait', text: '…' })]);
  // Numbers as tiles: the season's, and the last game's under its result.
  // A tile's name: the Chinese when it's short, else the abbreviation (OPS, not 整體攻擊指數).
  const tileName = (label, long) => {
    const name = statName(label, locale, { sport: LEAGUES[f.league]?.sport, long });
    return locale === 'en' || name.length <= 4 ? name : label;
  };
  const tiles = list => el('div', { class: 'pf-stats' }, list.map(([v, label, long]) => el('span', { class: 'pf-stat' }, [el('b', { class: 'num', text: v }), el('small', { text: tileName(label, long) })])));
  const season = (a?.stats.list || []).slice(0, 4).map(x => [x.value, x.label, x.name]);
  // Their last game: the team's latest one over (a preseason or a cup game
  // too, today's if it's over) when it's newer than ESPN's game log (which
  // can still be last season's), their numbers from its box score.
  const teamIdOf = f.team?.id || a?.teamId;
  const teamLast = teamIdOf ? [...(teamGames({ league: f.league, id: teamIdOf }) || [])].reverse().find(x => x.status.state === 'post' && !x.status.void) : null;
  const logged = got.ov?.log?.games?.[0];
  const newer = teamLast && (!logged || Date.parse(teamLast.start) > Date.parse(logged.date || 0) + 6 * 3_600_000);
  const box = newer ? boxLine(f, teamLast) : null;
  const g = newer ? teamGameLine(teamLast, teamIdOf, box) : logged;
  // While its box score is read: the game log's labels, the numbers '–'.
  const labels = (newer && box?.labels?.length ? box.labels : got.ov?.log?.labels) || [];
  const lastLine = g
    ? el('div', { class: 'pf-block' }, [
        el('div', { class: 'pf-head' }, [
          el('small', { class: 'muted tf-k', text: L({ zh: '上一場', en: 'Last game' }) }),
          logo(g.opp.logo, g.opp.name, 'xs'),
          el('span', { class: 'tf-opp', text: `${g.at} ${localSide(f.league, { name: g.opp.name }).short || g.opp.abbr}` }),
          g.result ? el('span', { class: `num result-pill ${g.result.toLowerCase()}`, text: `${locale === 'en' ? g.result : { W: '勝', L: '敗', D: '和', T: '和' }[g.result] || g.result} ${g.score}` }) : null
        ]),
        newer && box?.out ? el('small', { class: 'muted pf-out', text: L({ zh: '沒有上場', en: 'Did not play' }) }) : tiles(gameStats(labels).map(i => [g.stats[i] ?? '–', labels[i]]))
      ])
    : null;
  // Their team's next game (the team's schedule, read for 追蹤).
  const teamId = teamIdOf;
  const next = teamId ? (teamGames({ league: f.league, id: teamId }) || []).find(x => x.status.state === 'in' || (x.status.state === 'pre' && !x.status.void && Date.parse(x.start) > Date.now() - 3_600_000)) : null;
  const opp = next && [next.home, next.away].find(x => x && String(x.id) !== String(teamId));
  const nextLine = next
    ? el('button', { class: 'tf-game', type: 'button', disabled: next.status?.void ? true : null, onclick: () => openEvent(next) }, [
        el('small', { class: 'muted tf-k', text: L({ zh: '下一場', en: 'Next' }) }),
        opp ? logo(opp.logo, opp.name, 'xs') : el('span'),
        el('span', { class: 'tf-opp', text: opp ? `${String(next.home?.id) === String(teamId) ? 'vs' : '@'} ${oppName(next.league, opp)}` : '' }),
        next.status.state === 'in' ? el('span', { class: 'num tf-score live', text: t('live') }) : el('span', { class: 'tf-when' }, [el('small', { class: 'num', text: soonOf(next) }), whereTv(next)])
      ])
    : null;
  return el('div', { class: 'tf-row' }, [
    head,
    el('div', { class: 'tf-games' }, [season.length ? el('div', { class: 'pf-block' }, [el('small', { class: 'muted tf-k', text: L({ zh: '本季', en: 'Season' }) }), tiles(season)]) : null, nextLine, lastLine])
  ]);
}
// A team's game over as a game-log line ({ at, opp, result, score, stats }),
// the player's numbers from `box` when it's in.
// (The score from the team's side, as the game log's lines are: 1-2 lost.)
function teamGameLine(e, teamId, box) {
  const { home, us, them } = sidesFor(e, teamId);
  return { at: home ? 'vs' : '@', opp: { name: them?.en || them?.name || '', abbr: them?.abbr || '', logo: them?.logo || null }, result: outcome(us, them), score: sideScore(us, them), stats: box?.stats || [] };
}
// The player's line in a game's box score: { labels, stats } or { out: true }
// (not in it); null while it's read. Read once a game.
const boxes = new Map();
function boxLine(f, e) {
  const key = `${e.league}:${e.id}:${f.id}`;
  if (boxes.has(key)) return boxes.get(key);
  boxes.set(key, null);
  summary(e.league, e.id)
    .then(d => {
      for (const t of d?.players || [])
        for (const tb of t.tables || []) {
          const row = tb.rows.find(r => r.id === String(f.id));
          if (row && row.stats.length) return boxes.set(key, { labels: tb.labels, stats: row.stats });
        }
      boxes.set(key, { out: true, labels: [], stats: [] });
    })
    // (Failed: asked again on a redraw a minute on, not by the redraw this one makes.)
    .catch(() => setTimeout(() => boxes.delete(key), 60_000))
    .then(() => state.tab === 'following' && renderFollowing());
  return null;
}
function driverRow(f, a) {
  const champ = f1Table?.length ? driverSeason(f1Table, f.id) : null;
  const races = f1Races();
  const raceOf = e => (e.sessions || []).find(x => x.abbr === 'Race' && x.status.state === 'post');
  const last = [...races].reverse().find(raceOf);
  const at = last ? raceOf(last).field.findIndex(d => d.id === String(f.id)) : -1;
  const next = races.find(e => (e.sessions || []).some(x => x.status.state !== 'post'));
  const session = next && splitWeekend(next, Date.now(), locale).find(x => x.status.state !== 'post');
  const team = f1Driver(a?.name || f.name).team;
  const head = personHead(f, team ? (locale === 'en' ? team : f1Constructor(team).zh || team) : leagueName(f.league, locale), null);
  return el('div', { class: 'tf-row' }, [
    head,
    el('div', { class: 'tf-games' }, [
      champ ? el('div', { class: 'pf-stats' }, [el('span', { class: 'pf-stat' }, [el('b', { class: 'num', text: `P${champ.pos}` }), el('small', { text: L({ zh: '車手積分榜', en: 'Standings' }) })]), el('span', { class: 'pf-stat' }, [el('b', { class: 'num', text: champ.points }), el('small', { text: L({ zh: '積分', en: 'Points' }) })]), champ.gap && champ.pos > 1 ? el('span', { class: 'pf-stat' }, [el('b', { class: 'num', text: champ.gap }), el('small', { text: L({ zh: '落後', en: 'Behind' }) })]) : null]) : null,
      session
        ? el('button', { class: 'tf-game', type: 'button', onclick: () => openEvent(session) }, [el('small', { class: 'muted tf-k', text: L({ zh: '下一節', en: 'Next' }) }), raceFlag(next), el('span', { class: 'tf-opp', text: [next.name, session.sessionKey ? sessionName({ abbr: session.sessionKey }, locale, true) : session.session].filter(Boolean).join(' · ') }), el('span', { class: 'tf-when' }, [el('small', { class: 'num', text: soonOf(session) }), whereTv(session)])])
        : null,
      last
        ? el('button', { class: 'tf-game', type: 'button', onclick: () => openEvent(splitWeekend(last, Date.now(), locale).find(x => x.sessionKey === 'Race') || last) }, [el('small', { class: 'muted tf-k', text: L({ zh: '上一站', en: 'Last' }) }), raceFlag(last), el('span', { class: 'tf-opp', text: last.name }), el('span', { class: 'num tf-score', text: at >= 0 ? `P${at + 1}` : '–' })])
        : null
    ])
  ]);
}

// ---- 排名, in 賽事: the league's tables -------------------------------------------------------

// A league's tables this season.
const tables = new Map();
// The league's games of the last few days that the app has (the day lists
// and the league's own schedule), for the table's games not counted yet.
ctx.recentOf = league => recentOf(league);
function recentOf(league) {
  const since = Date.now() - 3 * 86_400_000;
  const sc = state.scores;
  const lists = [...[...state.days.values()].map(dayAll), ...(sc.league === league && sc.byDay instanceof Map ? [...sc.byDay.values()] : [])];
  // Each game once, its newest copy: the days held can each have one (past
  // midnight yesterday's, still 90'+1', before today's, over), and the
  // first found was taken.
  const best = new Map();
  const ORDER = { pre: 0, in: 1, post: 2 };
  for (const e of lists.flat()) {
    if (e.league !== league || !(Date.parse(e.start) > since)) continue;
    const f = freshGame(e);
    const had = best.get(f.id);
    if (!had || (ORDER[f.status?.state] ?? 0) > (ORDER[had.status?.state] ?? 0)) best.set(f.id, f);
  }
  return [...best.values()];
}
// F1: the race weekends (and sprints) still to run, for the title's maths.
let f1Rounds = null;
function racesLeft(league) {
  if (league !== 'f1') return null;
  if (f1Rounds === null) {
    f1Rounds = undefined;
    seasonEvents(league)
      .then(list => (f1Rounds = (list || []).filter(e => e.sessions?.length)))
      .catch(() => {})
      .then(() => state.tab === 'matches' && state.scores.league === league && renderScores());
  }
  if (!f1Rounds?.length) return null;
  // Each time, as F1's feed has the sessions (a race over at its flag, not when ESPN's copy says so: Singapore 2026 still counted as to come).
  const ahead = settleScoring(f1Rounds);
  const left = x => x.status?.state !== 'post' && sessionStatus(x).state !== 'post';
  const open = abbr => ahead.filter(e => e.sessions.some(x => x.abbr === abbr && left(x))).length;
  // The weekends still to come, in order, each with whether it has a sprint (when a title can be settled, by name).
  const weeks = ahead.filter(e => e.sessions.some(x => x.abbr === 'Race' && left(x))).sort((a, b) => Date.parse(a.start || a.date || 0) - Date.parse(b.start || b.date || 0)).map(e => ({ name: e.name, sprint: e.sessions.some(x => x.abbr === 'SR' && left(x)) }));
  return { races: open('Race'), sprints: open('SR'), list: weeks };
}
ctx.racesLeft = racesLeft;
// The title fight going into a race weekend (its sheet): each table as 排名
// has it now (the finals in), with its race (title.mjs), or null before any.
ctx.titleFight = async league => {
  const groups = tables.get(league) || (await standings(league).catch(() => null));
  if (!Array.isArray(groups) || !groups.some(tableStarted)) return null;
  if (league === 'f1' && !f1Rounds?.length) f1Rounds = ((await seasonEvents(league).catch(() => [])) || []).filter(e => e.sessions?.length);
  const sport = LEAGUES[league].sport;
  // (`left`: the races and sprints still to run, for the title fight as it stands while one runs.)
  const left = racesLeft(league);
  return tableNow(groups, league, recentOf(league)).map(g => ({ g, left, race: standingsRace(g, sport, { total: SEASON_GAMES[league] || null, left, team: sport === 'racing' && !g.rows.some(r => r.athlete) }) }));
};
// Last seasons' final tables ('<league>:<year>'), read once.
const lastTables = new Map();
// Read as soon as a league opens in 賽事 (not on the tap on 排名): the copy
// this phone has shown at once, the fresh one in its place when it comes.
// Read again after ten minutes, the table on screen kept till then.
const tableAt = new Map();
function warmTable(league) {
  if (!hasStandings(league) || Date.now() - (tableAt.get(league) ?? -Infinity) < 10 * 60_000) return;
  tableAt.set(league, Date.now());
  const shown = () => state.tab === 'matches' && state.scores.league === league && (state.scores.view === 'table' || state.scores.view === 'leaders') && renderScores();
  if (!tables.has(league)) {
    tables.set(league, null);
    savedStandings(league)
      .then(g => g?.length && tables.get(league) === null && (tables.set(league, g), shown()))
      .catch(() => {});
  }
  // Unread (and none held): said so, never "no table" (tableSays), and read
  // again shortly (while its league is open in 賽事), not in ten minutes.
  const key = `table:${league}`;
  standings(league)
    .then(g => (tables.set(league, g), retries.done(key)))
    .catch(() => {
      if (!tables.get(league)?.length) tables.set(league, Object.assign([], { failed: true }));
      retryLater(key, true, () => (tableAt.delete(league), warmTable(league)), () => state.tab === 'matches' && state.scores.league === league);
    })
    .then(shown);
}
// 數據領先 of a league (sheets.js' leagueLeadersView): read once a session
// (kept 6 h on the device), each player's team named from its table.
const leaders = new Map();
const leaderPick = new Map();
const FAILED = Symbol('failed');
// 數據 of a league: its players' leaders (球員) and, where there are any,
// its teams by their own numbers (球隊, lib/teamstats.mjs), one switch.
const teamNums = new Map();
const teamPick = new Map();
const teamLists = new Map();
function leadersOf(league) {
  const sport = LEAGUES[league]?.sport;
  const has = ['basketball', 'baseball', 'soccer'].includes(sport) && LEAGUES[league]?.espn;
  if (has && !teamNums.has(league)) {
    teamNums.set(league, undefined);
    leagueTeamStats(league)
      .then(d => teamNums.set(league, d))
      .catch(() => teamNums.set(league, null))
      .then(() => state.tab === 'matches' && state.scores.league === league && renderScores());
  }
  // (F1's teams come with its drivers, added up from the same results.)
  const lead = sport === 'racing' ? leaders.get(league) : null;
  const teams = sport === 'racing' ? (lead && typeof lead === 'object' ? lead.crews : null) : teamNums.get(league);
  const part = teams && state.scores.statPart === 'teams' ? 'teams' : 'players';
  const pick = teams ? segmented([['players', sport === 'racing' ? L({ zh: '車手', en: 'Drivers' }) : L({ zh: '球員', en: 'Players' })], ['teams', sport === 'racing' ? L({ zh: '車隊', en: 'Teams' }) : L({ zh: '球隊', en: 'Teams' })]], part, v => ((state.scores.statPart = v), renderScores()), 'views stat-part') : null;
  return el('div', {}, [pick, part === 'teams' ? teamsOf(league, teams) : playersOf(league)]);
}
function teamsOf(league, d) {
  if (d.racing) return teamStatsView(d, league, { pick: teamPick.get(league), onPick: k => (teamPick.set(league, k), renderScores()), wide: true });
  warmTable(league);
  const all = (tables.get(league) || []).flatMap(g => g.rows || []);
  const rows = new Map(all.map(r => [String(r.id), r]));
  const clubs = d.teams?.length ? fotmobClubRows(d.teams, all, r => sideWords({ name: r.en || r.name, en: r.en, short: r.short })) : new Map();
  const st = d.stats.find(x => x.key === teamPick.get(league)) || d.stats[0];
  // A football stat's whole list: read when its chip is chosen.
  if (st.url && !teamLists.has(st.url)) {
    teamLists.set(st.url, null);
    fotmobTeamList(st.url, st.key)
      .then(list => teamLists.set(st.url, list))
      // (Failed: its top three stay, said read (not a place held for rows that won't come).)
      .catch(() => teamLists.set(st.url, []))
      .then(() => state.tab === 'matches' && state.scores.league === league && renderScores());
  }
  // (A team's name and logo as the table has them: 勇士, not Golden State Warriors.)
  const teamOf = x => {
    const r = x.id ? rows.get(String(x.id)) : clubs.get(String(x.fotmob ?? ''));
    if (r) return { id: String(r.id), name: r.name, short: r.short, logo: r.logo || x.logo };
    // (Not matched yet, the table still coming: FotMob's short name, Brighton not Brighton & Hove Albion.)
    const club = x.fotmob ? d.teams?.find(t => String(t.id) === x.fotmob) : null;
    return club ? { id: '', name: club.shortName || club.name, short: club.shortName || club.name, logo: x.logo } : null;
  };
  return teamStatsView(d, league, { teamOf, pick: st.key, full: st.url ? teamLists.get(st.url) : null, onPick: k => (teamPick.set(league, k), renderScores()), wide: true });
}
function playersOf(league) {
  const key = `leaders:${league}`;
  const shown = () => state.tab === 'matches' && state.scores.league === league;
  if (!leaders.has(league)) {
    leaders.set(league, undefined);
    // (A failed read says so and is asked again a little later while it's on
    // screen: forgetting it at once had the redraw read it again, a spinner
    // flickering for ever on F1's, 2026-10-27.)
    leagueLeaders(league)
      .then(d => (leaders.set(league, d), retries.done(key)))
      .catch(() => (leaders.set(league, FAILED), retryLater(key, true, () => (leaders.delete(league), shown() && renderScores()), shown)))
      .then(() => shown() && renderScores());
  }
  const d = leaders.get(league);
  if (d === FAILED) return empty(t('failed'));
  if (d === undefined) return spinner();
  if (!d) return empty(L({ zh: '本季還沒有數據。', en: 'No numbers yet this season.' }));
  warmTable(league);
  const all = (tables.get(league) || []).flatMap(g => g.rows || []);
  const rows = new Map(all.map(r => [String(r.id), r]));
  // (A FotMob player's club by its name: the two write the clubs alike.)
  const byName = name => all.find(r => [r.name, r.en, r.short].some(n => n && fold(n) === fold(name))) || null;
  // FotMob's clubs matched to the table's rows once (Brighton and Hove Albion is Brighton & Hove Albion).
  const clubs = d.teams?.length ? fotmobClubRows(d.teams, all, r => sideWords({ name: r.en || r.name, en: r.en, short: r.short })) : new Map();
  const st = d.stats.find(x => x.key === leaderPick.get(league)) || d.stats[0];
  // A football stat's top ten: read when its chip is chosen.
  if (st.url && !leaderLists.has(st.url)) {
    leaderLists.set(st.url, null);
    leaderList(st.url, st.key)
      .then(list => leaderLists.set(st.url, list))
      // (Failed: its top three stay, not read again at once by the redraw, and no rows held for it.)
      .catch(() => leaderLists.set(st.url, []))
      .then(() => state.tab === 'matches' && state.scores.league === league && renderScores());
  }
  return leagueLeadersView(d, league, { teamOf: (id, x) => rows.get(String(id)) || clubs.get(String(x?.fotmobTeam ?? '')) || (x?.teamName ? byName(x.teamName) : null), pick: st.key, full: st.url ? leaderLists.get(st.url) : null, onPick: k => (leaderPick.set(league, k), renderScores()), wide: true });
}
const leaderLists = new Map();
function tableOf(league) {
  warmTable(league);
  const groups = tables.get(league);
  const says = tableSays(groups);
  if (says === 'wait') return spinner();
  if (says !== 'table') return empty(t(says === 'failed' ? 'failed' : 'noStandings'));
  // Before this season's first counted game (a preseason's table is all
  // zeros, its order meaningless): last season's final table, said so, as
  // the playoffs tab shows last season's bracket. Not once a game that
  // counts is on or over (opening night, before ESPN's table has it): this
  // season's (its finals in: liveTable), never last season's carried on.
  const begun = recentOf(league).some(e => COUNTS(e) && ['in', 'post'].includes(e.status?.state));
  if (!groups.some(tableStarted) && groups.year && !begun) {
    const key = `${league}:${groups.year - 1}`;
    if (!lastTables.has(key)) {
      lastTables.set(key, null);
      standings(league, { season: groups.year - 1 })
        .then(g => lastTables.set(key, g))
        .catch(() => lastTables.set(key, []))
        .then(() => state.tab === 'matches' && state.scores.league === league && renderScores());
    }
    const last = lastTables.get(key);
    if (!last) return spinner();
    if (last.length && last.some(tableStarted)) {
      const en = locale === 'en';
      return el('div', {}, [
        el('p', { class: 'po-banner' }, [el('strong', { text: en ? 'Last season' : '上季' }), document.createTextNode(en ? ': the final table. This season’s starts with its first game.' : '　最終排名。本季開賽後換成本季的。')]),
        standingsTables(last, league, { many: LEAGUES[league].sport !== 'racing' && last.length > 1 })
      ]);
    }
  }
  // The games the official table hasn't counted yet, in; then each table's race.
  const sport = LEAGUES[league].sport;
  // (F1: a sprint or race in the moment F1's feed calls it over, in its finishing order; ESPN's copy says so an hour or more later.)
  const recent = recentOf(league);
  if (sport === 'racing') askFinishes(recent, () => state.tab === 'matches' && state.scores.league === league && renderScores());
  // (The games on now in, as they stand, marked: Jay 2026-11-09. The races below stay on the finals.)
  const now = tableNow(groups, league, recent, { live: true });
  // The race on the finals alone (the owner, 2026-10-18): a game on now
  // counted as it stands (納什維爾 0:0 in the first half, a draw) made the
  // "next game" the one after it, and a win tonight that settles it went
  // unsaid. The game on is the next one, said as this one (raceBlock).
  const settledNow = sport === 'racing' ? now : tableNow(groups, league, recent.filter(e => e.status?.state !== 'in'));
  const races = settledNow.map(g => standingsRace(g, sport, { total: SEASON_GAMES[league] || null, left: racesLeft(league), team: sport === 'racing' && !g.rows.some(r => r.athlete) }));
  // A league by division (MLB's): its playoff seeds first, the divisions' rows marked by them.
  const { picture, divisions } = seedPicture(now, league, locale);
  return el('div', {}, [
    standingsTables([...picture, ...divisions], league, { races: [...picture.map(() => null), ...races], many: sport !== 'racing' && now.length > 1 }),
    el('p', { class: 'muted small table-note', text: t('gapHint') })
  ]);
}

// ---- Tabs, refresh, start ---------------------------------------------------------------------

const TAB_ICONS = { home: 'home', matches: 'calendar', live: 'live', following: 'star' };
const tabNav = tabBar({ tabs: TABS.map(id => ({ id, label: t(`tab_${id}`), icon: TAB_ICONS[id] })), onSelect: (tab, { again }) => (again ? tabAgain(tab) : showTab(tab)) });
function renderTabs() {
  tabNav.select(state.tab);
  tabNav.badge('live', dayAll(state.days.get(today())).filter(e => e.status.state === 'in' && onTv(e)).length);
}
// Each tab keeps its place (the kit's tab bar); a tap on the open tab
// scrolls it up, and at the top, home goes back to today.
function showTab(tab) {
  state.tab = tab;
  renderTabs();
  if (tab === 'home') renderHome();
  if (tab === 'matches') {
    // (It opens on 全部, never on whichever league is followed first: F1 every time.)
    // Back on it: the page as it was, changed in place only where a game
    // moved (drawn anew, its games came again a few at a time and an iPad's
    // columns dealt them again: Jay 2026-11-06, "switching back to 賽程 has
    // shuffle"; tests/tab-return.test.mjs).
    state.scores.byDay ? quietScores() : loadScores();
  }
  if (tab === 'live') renderLive();
  if (tab === 'following') renderFollowing();
  // What's on now, at once rather than at the next beat.
  liveTick();
}
function tabAgain(tab) {
  if (tab === 'home' && state.home.date !== today()) {
    stripRange.recenter = true;
    pickHomeDay(today());
  }
  if (tab === 'live' && liveDay() !== today()) {
    liveRange.recenter = true;
    pickLiveDay(today());
  }
  if (tab === 'matches' && state.scores.league === ALL && allDay() !== today()) {
    allRange.recenter = true;
    pickAllDay(today());
  }
}
// Turned on its side, or a window made wider or narrower: 賽事's 全部 dealt
// again into as many columns as fit (ui.js balanced; the other tabs' columns
// are the stylesheet's alone).
const fitKey = f => `${f.wide}${f.w3}`;
let screenWas = fitKey(screenFit());
onScreen(fit => {
  if (fitKey(fit) === screenWas) return;
  screenWas = fitKey(fit);
  kitUI.flowColumns?.(document);
  // (首頁: the board on q-w3, cols below it, drawn again for the new width.)
  if (state.home.drawnOnce) renderHome();
  if (state.tab === 'matches' && state.scores.league === ALL && state.prefsLoaded) renderAll();
  // (數據: the stats down the side on a wide page, the chips over the ranking on a narrow one.)
  else if (state.tab === 'matches' && state.scores.view === 'leaders') renderScores();
});
// A swipe on 首頁 or 轉播: the day before or after.
kitUI.daySwipe($('panel-home'), dir => {
  const d = !state.home.picking && stripStep(stripRange, state.home.date, dir);
  return Boolean(d && (pickHomeDay(d), true));
});
kitUI.daySwipe($('panel-live'), dir => {
  const d = stripStep(liveRange, liveDay(), dir);
  return Boolean(d && (pickLiveDay(d), true));
});
// 賽事's too: 全部's days, a league's on its 賽程 (its date strip on top: a
// swipe under one is a day everywhere, Jay 2026-10-27), and its other tabs
// one swipe apart where there's no strip (排名, 季後賽, 數據領先: 2026-10-26;
// F1's 賽程 too, a season's weekends with no strip), then past the last
// (or first) tab the next league on the rail (Jay 2026-10-27).
kitUI.daySwipe($('panel-matches'), dir => {
  const sc = state.scores;
  if (sc.league === ALL) {
    const d = stripStep(allRange, allDay(), dir);
    return Boolean(d && (pickAllDay(d), true));
  }
  if (sc.views?.now === 'games' && sc.views.strip) {
    const d = sc.range && stripStep(sc.range, sc.date, dir);
    return Boolean(d && (pickScoresDay(d), true));
  }
  const v = sc.views?.list[sc.views.list.indexOf(sc.views.now) + dir];
  if (v) return (sc.view = v), renderScores(), true;
  return stepLeague(dir);
});
// The refresh button: today (or the day on screen) and the open league again.
async function reloadNow() {
  actions.refresh.disabled = true;
  try {
    // The open league's playoffs too (read again, not kept their 10 minutes).
    if (state.tab === 'matches') staleBracket(state.scores.league);
    await Promise.allSettled([loadDay(state.tab === 'home' ? state.home.date : state.tab === 'matches' && state.scores.league === ALL ? allDay() : today()), state.tab === 'matches' ? loadScores() : null]);
  } finally {
    actions.refresh.disabled = false;
  }
}

// Live games refresh every 15 seconds while on screen (the proxy keeps live
// scores 10 seconds), at once on coming back to the app or to a tab that
// shows them; today every 2 minutes in any case (so a followed team's start
// and finish are noticed).
// (Every dev('sportsList') seconds: the admin panel's 開發, 10 by default.)
// A day held, its games as the newest copy read anywhere has them (freshGame):
// true when one changed.
function freshenHeld(slot) {
  let changed = false;
  for (const k of ['events', 'others', 'rest']) {
    const list = slot[k];
    if (!list?.length) continue;
    const next = list.map(e => {
      const f = freshGame(e);
      if (f !== e && (f.status.state !== e.status.state || f.status.detail !== e.status.detail || f.home?.score !== e.home?.score || f.away?.score !== e.away?.score)) changed = true;
      return f;
    });
    if (changed) slot[k] = Object.assign(next, { failed: list.failed, read: list.read });
  }
  return changed;
}
function liveTick() {
  if (document.visibilityState !== 'visible' || !q.active || sheetOver()) return;
  // Reads that failed, waiting while nobody looked: tried now they're on screen.
  retries.kick();
  const day = state.days.get(today());
  // On now, or due to start (its kickoff passed or a minute away): watched as live.
  const live = dayAll(day).some(e => e.status.state === 'in' || dueToStart(e));
  const age = Date.now() - (day?.at || 0);
  const onScreen = (state.tab === 'home' && state.home.date === today()) || state.tab === 'live' || state.tab === 'following' || allShown(today());
  // The whole day every two minutes; between, only the pages with a game on.
  if (Date.now() - (day?.fullAt || 0) > 120_000) loadDay(today());
  else if (onScreen && live && age > dev('sportsList') * 1000 - 2_000) loadDay(today(), { live: true });
  // 首頁 on another day: past midnight it still shows the evening's games,
  // some still on (a 22:00 kick-off). Those are watched as today's are (the
  // whole day every two minutes, between only their pages), and any newer
  // copy read meanwhile (today's pages, the game's own sheet) taken at once:
  // checked only every 10 minutes, a game over at 00:02 stayed 90'+1' there.
  if (state.tab === 'home' && state.home.date !== today()) {
    const held = state.days.get(state.home.date);
    if (held && freshenHeld(held) && !sheetOver()) renderHome();
    const on = dayAll(held).some(e => e.status.state === 'in' || dueToStart(e));
    const since = Date.now() - (held?.at || 0);
    if (on && Date.now() - (held?.fullAt || 0) > 120_000) loadDay(state.home.date);
    else if (on && since > dev('sportsList') * 1000 - 2_000) loadDay(state.home.date, { live: true });
    else if (!on && since > 10 * 60_000) loadDay(state.home.date);
  }
  // 比分 too: a game on, or one due to start (it had waited for another game on to be read again).
  if (state.tab === 'matches' && state.scores.byDay instanceof Map && [...state.scores.byDay.values()].flat().some(e => e.status.state === 'in' || dueToStart(e))) loadScores({ quiet: true });
  renderTabs();
}
everyDev('sportsList', liveTick);
document.addEventListener('visibilitychange', liveTick);

// ELTA's schedule came in: its 📺 channels appear (or go) on the open tab.
let repaintTimer = 0;
knownEvents(() => [...state.days.values()].flatMap(slot => dayAll(slot)));
audioPref(() => state.prefs.audio || 'en');
// A game whose hour isn't set yet takes ELTA's, once its list has the game.
fixTimes(eltaTime);
const repaintOpen = () => {
  clearTimeout(repaintTimer);
  repaintTimer = setTimeout(() => {
    // ELTA's list in: the hours it sets, on the days held (the same day, only the time).
    for (const slot of state.days.values()) if (slot.events?.some(e => e.timeTbd && !e.timeFrom)) slot.events = slot.events.map(fixTime);
    if (state.scores.byDay instanceof Map && state.scores.all?.some(e => e.timeTbd && !e.timeFrom)) applyScores(state.scores, state.scores.all.map(fixTime));
    // Which days a sport plays on TV here changes with the lists: worked out again.
    state.home.sportDays.clear();
    if (state.tab === 'home' && SPORTS[state.home.filter]) pickFilter(state.home.filter);
    if (document.querySelector('dialog[open]')) return;
    if (state.tab === 'home' && state.days.get(state.home.date)?.at) renderHome();
    if (state.tab === 'live') renderLive();
    if (state.tab === 'matches' && state.scores.byDay instanceof Map && !state.scores.q) renderScores();
    if (state.tab === 'following') renderFollowing();
    // The live count and the start notices are the games on TV: again now it's known which.
    renderTabs();
    clearTimeout(pushTimer);
    pushTimer = setTimeout(syncPush, 1500);
  }, 250);
};
onTvChange(() => (tvGen++, repaintOpen()));

// (Only those new or changed since they were last fitted, the kit's watchFit:
// every one measured at every change anywhere on the page laid the whole page
// out each time, most of a tap on 過程 and of each slice of its rows.)
watchFit('.mh-score, .team-head h3, .mh-team strong, .event-row.filled .side-name');

// An F1 session on now: F1's own live timing every 10 seconds, its cards'
// briefs (the top three) filled again in place, never the whole page.
let f1Polling = false;
async function pollF1Live() {
  if (document.visibilityState !== 'visible' || f1Polling) return;
  // On, or due to start: F1's feed says it has started minutes before ESPN does.
  const all = dayAll(state.days.get(today())).filter(e => e.league === 'f1' && e.sessionKey);
  const on = all.find(e => e.status.state === 'in') || all.find(e => dueToStart(e));
  if (!on) return void (f1Live.key = '');
  f1Polling = true;
  const feed = await liveTiming(on.sessionKey, on.official || on.start).catch(() => null);
  f1Polling = false;
  // Not read: the cards fall back to ESPN's leader rather than wait on.
  f1Live.failed = !feed;
  if (!feed) return void document.querySelectorAll(`[data-f1-brief="${CSS.escape(on.id)}"]`).forEach(node => fillF1Brief(node, on));
  f1Live.feed = feed;
  f1Live.key = on.id;
  for (const node of document.querySelectorAll(`[data-f1-brief="${CSS.escape(on.id)}"]`)) fillF1Brief(node, on);
  // F1's feed says it's started or over (ESPN would minutes later): the day drawn again with it so.
  const fed = e => (e.league === 'f1' && e.sessionKey ? feedStatus(e.sessionKey, e.official || e.start, e.status) : e.status);
  if (fed(on).state !== on.status.state) {
    const turn = e => {
      const status = fed(e);
      return status === e.status ? e : { ...e, status };
    };
    for (const slot of state.days.values()) for (const k of ['events', 'others', 'rest']) if (Array.isArray(slot?.[k])) slot[k] = slot[k].map(turn);
    if (state.tab === 'home') renderHome();
    else if (state.tab === 'live') renderLive();
    else if (state.tab === 'following') renderFollowing();
    // (A race over moves the standings: an open table shows it now.)
    else if (state.tab === 'matches' && state.scores.league === 'f1') renderScores();
    renderTabs();
  }
}
everyDev('f1Feed', pollF1Live);
document.addEventListener('visibilitychange', pollF1Live);

window.__fxStarted = true;
const gated = installGate('match', locale);
watchUpdates({ current: document.querySelector('meta[name="build-version"]')?.content, key: 'orbitSports', cachePrefix: 'orbit-sports-' });
const actions = topActions(q, { refresh: reloadNow });
// Shared-Data's pack of recent games (built every few hours): each one's
// official highlights and whether ELTA has its whole game, so a sheet has
// its video at once and a card its replay. Kept on the device: an open
// after the first has it before the loading screen lifts.
watchPack = packJson('sports/watch.json', { ttl: 30 * 60_000 })
  .then(p => {
    setWatchPack(p);
    if (state.tab === 'home') renderHome();
  })
  .catch(() => {});
// Recent games over that the pack hasn't got yet: their videos looked up
// in the background, one at a time, after it's in.
renderTabs();

q.on('wallet', w => {
  state.wallet = w;
  if (state.tab === 'home' && state.days.get(state.home.date)?.at) renderHome();
});
q.on('active', live => live && (readPrefs({ offline: true }), savePending && state.prefsLoaded && savePrefs(), loadDay(today())));

function firstTab() {
  const hash = location.hash.slice(1);
  if (hash === 'standings') state.scores.view = 'table';
  return TABS.includes(hash) ? hash : hash === 'scores' || hash === 'standings' ? 'matches' : 'home';
}
// A game's notice tapped (#game=<league>/<id>/<day>, lib/notice.mjs): that
// game's page, over the tab the app opens on, once the game is known (the
// day's board, a follow's or a pick's copy; its day read if it isn't one
// read already). The address is cleared after: opening the app again opens
// it where it would, and the same notice tapped again opens the game again.
let gameAsk = 0;
const sleepMs = ms => new Promise(r => setTimeout(r, ms));
function knownGame(league, id) {
  const key = `${league}:${id}`;
  const hit = e => e && `${e.league}:${e.id}` === key;
  for (const slot of state.days.values()) {
    const e = (slot?.events || []).find(hit);
    if (e) return e;
  }
  return [...followedGames(), ...(state.todayPicks || []), ...[...state.home.teams.values()].flat()].find(hit) || null;
}
async function openGameFromHash() {
  const want = readGameHash(location.hash);
  if (!want || !LEAGUES[want.league]) return;
  const n = ++gameAsk;
  const day = want.day || today();
  const until = Date.now() + 20_000;
  let e = knownGame(want.league, want.id);
  while (!e && n === gameAsk && Date.now() < until) {
    // (Once the follows are in: the day read for the leagues the person has.)
    const slot = state.days.get(day);
    const read = slot?.at && !slot.loading && slot.leagues === leaguesKey();
    if (booted && read) break;
    if (booted && !slot?.loading) loadDay(day);
    await sleepMs(150);
    e = knownGame(want.league, want.id);
  }
  if (n !== gameAsk) return;
  if (readGameHash(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  if (!e) return;
  $('loading').hidden = true;
  openEvent(freshGame(e));
}
// 問 Orbit's question (the Pass sheet, kit ask-orbit.mjs: #ask=<words>): 問比賽 with it.
function askFromLink() {
  if (!/(?:^#|&)ask=/.test(location.hash)) return;
  import('#kit/ask-orbit.mjs')
    .then(m => {
      const text = m.takeAsk?.();
      if (text) return import('./ask.js').then(x => x.openAsk(askSource(), { ask: text }));
    })
    .catch(() => {});
}
// A link or a notice's tap that points at a tab while the app is open.
window.addEventListener('hashchange', () => {
  if (booted && /(?:^#|&)ask=/.test(location.hash)) return void askFromLink();
  const hash = location.hash.slice(1);
  if (readGameHash(hash)) return void openGameFromHash();
  if (!TABS.includes(hash) && hash !== 'scores' && hash !== 'standings') return;
  const tab = firstTab();
  if (tab === 'live') state.live.date = null;
  if (tab !== state.tab) showTab(tab);
  else if (tab === 'live') renderLive();
  else if (hash === 'standings' && tab === 'matches') renderScores();
});
// The loading screen stays up on the picks until they're settled, so they
// don't open half-read and fill in or reshuffle after it lifts: every
// league of theirs read (one that didn't answer read again at once, not
// in the retry's 4 s; shown as it is if it fails twice), the next day
// they play read when today's over. A cap for a connection that hangs.
const BOOT_WAIT = 12_000;
async function homeReady(until) {
  const again = new Set();
  // (A connection the kit finds slow: the saved picks at once, not the rest of the wait for fresh ones.)
  while (state.tab === 'home' && Date.now() < until && netState() === 'online') {
    const h = state.home;
    if (h.settled && !(h.partial && !again.has(h.date))) return;
    if (h.settled) {
      again.add(h.date);
      h.settled = false;
      loadDay(h.date);
    }
    await new Promise(r => setTimeout(r, 100));
  }
}
// Today's games all over, the app opens on the next day they play: that
// day, kept for today, is read alongside today's at the next open (and the
// days each sport plays with it), not one after the other.
// A followed team's game on now (its own schedule, fresh from the day's reads), or null.
// (Today's scoreboard too: the teams' own schedules come after the day's first drawing, and the jump was decided by then.)
function followedOnNow() {
  const day = state.days.get(today());
  const live = (day ? dayAll(day) : []).filter(x => x.status?.state === 'in' && !x.status.void);
  for (const f of followedTeams()) {
    const e = (state.home.teams.get(`${f.league}:${f.id}`) || []).map(freshGame).find(x => x.status?.state === 'in' && !x.status.void) || live.find(x => x.league === f.league && [x.home, x.away].some(s => String(s?.id) === String(f.id)));
    if (e) return e;
  }
  return null;
}
const JUMP_KEY = 'fx.jump.v1';
function saveJump(to) {
  try {
    localStorage.setItem(JUMP_KEY, JSON.stringify({ from: today(), to, leagues: leaguesKey() }));
  } catch {}
}
function savedJump() {
  try {
    const j = JSON.parse(localStorage.getItem(JUMP_KEY) || 'null');
    return j?.from === today() && j.leagues === leaguesKey() && j.to > today() ? j.to : null;
  } catch {
    return null;
  }
}
const pickDayHas = (date, { left = false } = {}) => {
  const slot = state.days.get(date);
  const sports = new Set(followedSports());
  const fits = e => sports.has(LEAGUES[e.league]?.sport) && !practice(e) && inPickDay(officialMs(e), date);
  return Boolean(slot?.at && !slot.partial && slot.leagues === leaguesKey() && tvDayHas(slot.events, { fits, onTv, left }));
};
const nextLeagueDay = () =>
  pickLeagues()
    .filter(k => LEAGUES[k].espn)
    .map(k => [...(leagueDays(k) || [])].filter(d => d > today()).sort()[0])
    .filter(Boolean)
    .sort()[0] || null;
function readJumpEarly() {
  // (Each league's game days, small, for nextLeagueDay.)
  pickLeagues().filter(k => LEAGUES[k].espn).forEach(k => leagueDays(k));
  const to = savedJump();
  if (!to) return;
  loadDay(to);
  if (tvReady()) followedSports().filter(needDays).forEach(readSportDays);
}
async function boot() {
  const until = Date.now() + BOOT_WAIT;
  // (A game's notice tapped: its page as soon as the game is known.)
  if (readGameHash(location.hash)) openGameFromHash();
  // A signed-in device opens at once on what it had: the follows and the
  // day it last read, while the Worker is asked for the fresh ones (the
  // picks wait behind the loading screen for their fresh day).
  const quick = cachedPayload('match');
  // The TV lists (ELTA's, NBA.com's), early: the picks and rows read each
  // game's channels from them.
  tvReady();
  if (quick != null) {
    state.wallet = cachedWallet();
    applyPrefs(quick);
    restoreDay();
    if (firstTab() !== 'home') $('loading').hidden = true;
    showTab(firstTab());
    restorePlace();
  }
  const starting = q.start();
  // Kept on the device: today's read while the sign-in is on its way (the
  // nightly copies need none; a read through the proxy waits for that
  // sign-in, not a second one), not a round trip after it.
  // (Not under a sign-in link: its hand-off is redeemed first.)
  const early = quick != null && !/[#&]q[hp]=/.test(location.hash) ? loadDay(today()) : null;
  if (early) readJumpEarly();
  const first = await starting;
  state.wallet = first.wallet || q.wallet;
  const before = JSON.stringify(state.prefs);
  if (typeof first?.payload === 'string') applyPrefs(first.payload);
  else if (quick == null) await readPrefs(first);
  if (firstTab() !== 'home') $('loading').hidden = true;
  if (quick == null) {
    restoreDay();
    showTab(firstTab());
    restorePlace();
  } else if (JSON.stringify(state.prefs) !== before) {
    state.days.clear();
    showTab(state.tab);
  }
  const prefsMoved = quick != null && JSON.stringify(state.prefs) !== before;
  if (!early || prefsMoved) readJumpEarly();
  booted = true;
  setTimeout(syncFollows, 3000);
  window.__bootStep?.(t('loadingGames'), 0.84);
  // Which leagues have games now (after the day's own reading, not before it).
  setTimeout(() => checkActive().catch(() => {}), 1500);
  await (early && !prefsMoved ? early : loadDay(today()));
  window.__bootStep?.(t('loadingPicks'), 0.94);
  await homeReady(until);
  $('loading').hidden = true;
  askFromLink();
  // The followed leagues' tables, read once the day's games are in: 排名 opens at once.
  setTimeout(() => followedLeagues().filter(hasStandings).slice(0, 6).forEach(warmTable), 2000);
}
if (!gated) boot();
setTimeout(() => ($('loading').hidden = true), BOOT_WAIT + 2000);

// Opens without a connection: the kit registers the worker and has it keep every file loaded.
keepOffline();
// Every screen is live (an old copy would read as now): no connection, the kit's cover, not the saved copy.
onlineOnly({ zh: '比分和賽程需要網路連線', en: 'Scores and schedules need a connection.' });
