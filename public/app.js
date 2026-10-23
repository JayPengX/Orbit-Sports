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
import { orbitSession, tabBar, topActions, installGate, watchUpdates, recordAffinity, affinity, affinityPatch, settingPatch, setting, fitNumbers, notify, cachedPayload, cachedWallet, restorePlace, schedulePush, translate, proxyJson, packJson, dev, everyDev, keepOffline, onlineOnly, netState } from '#kit/orbit.mjs';
import { stripDays } from './lib/strip.mjs';
import { fold } from './lib/text.mjs';
import { boundsOf, unionBounds, within, clampDay } from './lib/bounds.mjs';
import * as kitUI from '#kit/ui.mjs';
import { transition } from './lib/notice.mjs';
import { freshGame, sessionStatus, settleSeries, fixTime, fixTimes, summary, sessionName, weekOf, localSide, fallbackLogo, scoreboard, standings, savedStandings, teamSchedule, seasonCalendar, seasonInfo, monthsBetween, yyyymmdd, settleField, seasonEvents, splitWeekend, feedStatus, dueToStart, usDayOf, onAir, asiaEvents, cpblPack, cpblSeeds, leagueForm, outcome, sideScore, sidesFor, athlete, athleteOverview, driverSeason, playerHome, europeanClubs, clubOfPlayer, roundLabel, leagueLeaders, leaderList } from './lib/espn.mjs';
import { hasLeaders, fotmobClubRows } from './lib/leaders.mjs';
import { sideWords } from '#kit/sports-highlights.mjs';
import { statName, injuryZh } from './lib/statnames.mjs';
import { eltaChannel, hasAudio, channelRank } from './lib/broadcast.mjs';
import { findLeagues, parseSearch, placeTeams, placePlayers } from './lib/search.mjs';
import { setWatchPack, prefetchHighlights, watchMonthWanted, watchMonthPath, loadWatchMonth } from './lib/highlights.mjs';
import { LEAGUES, SPORTS, leagueName, leaguesOf, hasStandings, hasTeams } from './lib/leagues.mjs';
import { familyOfSport } from '#kit/catalog.mjs';
import { detectLocale, makeT } from './lib/i18n.mjs';
import { eventKeys, teamKey, leagueKey } from './lib/foryou.mjs';
import { standingsRace, SEASON_GAMES, COUNTS } from './lib/title.mjs';
import { dayPlan, tableIndex, SHORTEST, scoreMatch, bigGame, tableStarted, watchedLeagues, leagueChoices } from './lib/picks.mjs';
import { liveTiming, settleScoring, askFinishes } from './lib/f1.mjs';
import { playoffModel, openRound, FORMATS, seedPicture } from './lib/playoffs.mjs';
import { stageOf } from './lib/stage.mjs';
import { nearestDay, dayReads, dayUnknown, tableSays } from './lib/days.mjs';
import { retrier } from './lib/retry.mjs';
import { onTvChange, tvOf, knownEvents, eltaSchedule, audioPref, onTv, tvReady, tvUntil, tvKnown, tvUnread, channelsOf, nbaAfterList, replayHint, eltaTime } from './lib/tv.mjs';
import { ctx, sidesOf, el, shownStart, timeText, bestOf, put, spinner, skeleton, empty, $, localDate, today, addDays, clock, dayLabel, whenOf, eventRow, sheet, section, moreButton, logo, leagueMark, segmented, sideLogo, fillF1Brief, f1Live, watchLink, withWatch, watchButton, scoreText, sessionTag, raceFlag, audioName, personPic } from './ui.js';
import { followButton, gameRecap, openMatch, openFieldEvent, openTie, openTeam, openPlayer, openConstructor, constructorBadge, standingsTables, zhLater, leagueLeadersView, tableNow } from './sheets.js';
import { f1Driver, f1Constructor, teamLogo } from '#kit/logos.mjs';
import { teamsByZh } from '#kit/names.mjs';
import { icon, pageHead, heroGame, scoreCard, sportTile, leagueTile } from './cards.js';

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
  prefs: { leagues: [], follows: [], games: [], audio: 'en' },
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
Object.assign(ctx, { t, locale, state, q, openEvent, openTeam, openPlayer, isFollowed, toggleFollow, track, isFollowedEvent, isFollowedGame, toggleFollowGame });

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
  if (p) state.prefs = { leagues: (p.leagues || []).filter(k => LEAGUES[k]), follows: p.follows || [], games: p.games || [], audio: p.audio === 'zh' ? 'zh' : 'en' };
  // Only the leagues Orbit Sports has; an NBA team with NBA.com's logo, as everywhere.
  state.prefs.games = keptGames(state.prefs.games);
  state.prefs.follows = state.prefs.follows.filter(f => LEAGUES[f.league]).map(f => (f.league === 'nba' && !f.athlete ? { ...f, logo: teamLogo('nba', f.name) } : f));
  state.prefsLoaded = true;
  // Leagues in: not a newcomer, whatever was shown before they came.
  if (state.prefs.leagues.length) state.home.picking = false;
  if (restored) savePrefs();
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
  const { leagues, follows, games, audio } = state.prefs;
  saveTimer = setTimeout(() => {
    const payload = JSON.stringify({ v: 4, leagues, follows, games: keptGames(games), audio, t: Date.now() });
    keepLocalPrefs(payload);
    // Not saved (another app live on the pass, offline): again when this one is live.
    savePending = true;
    q.write({ payload, wallet: followsPatch() })
      .then(() => (savePending = false))
      .catch(() => {});
  }, 800);
}
let savePending = false;
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
// them (freshGame), and let go two days after the start.
const GAME_KEEP = 2 * 86_400_000;
// A race weekend's sessions all share its key (the weekend's id).
const gameKey = e => `${e.league}:${e.weekend || e.id}`;
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
    recordAffinity('match', [`league:${leagueKey(e.league)}`, ...[e.away, e.home].filter(Boolean).map(x => teamKey(e.league, x.en || x.name))], 2);
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
}, 60_000);
// Leagues followed as a league (no team or player of them followed): each
// slot's chosen game is the person's as a followed team's is (picks.mjs
// leagueChoices; Jay 2026-10-23), and a race weekend's qualifying, sprint
// and race.
const watched = () => watchedLeagues(state.prefs.leagues, state.prefs.follows);
let tvGen = 0;
const chosenMemo = { key: '', set: new Set() };
function chosenGames() {
  const w = watched();
  if (!w.length) return new Set();
  const slots = [...state.days.values()];
  const key = `${w.join()}|${tvGen}|${tvReady()}|${slots.map(x => `${x.at}:${x.events?.length}`).join()}|${Object.keys(state.home.tables || {}).join()}`;
  if (chosenMemo.key === key) return chosenMemo.set;
  const all = slots.flatMap(x => x.events || []);
  const ctx = { leagues: state.prefs.leagues, follows: state.prefs.follows, tables: state.home.tables, aff: affinity(null, Date.now(), ['match']), featured: featuredIn(all) };
  chosenMemo.key = key;
  chosenMemo.set = leagueChoices(all, { watched: w, onTv, tvKnown, awake: e => new Date(officialMs(e)).getHours() >= AWAKE_FROM, ctx });
  return chosenMemo.set;
}
const isChosenGame = e => e.kind === 'match' && chosenGames().has(`${e.league}:${e.id}`);
// (`chosen` false: a followed team's, player's or match's only.)
function isFollowedEvent(e, { chosen = true } = {}) {
  if (isFollowedGame(e)) return true;
  if (e.kind === 'match') return followedTeams().some(f => f.league === e.league && (f.id === e.home?.id || f.id === e.away?.id)) || (chosen && isChosenGame(e));
  // (Not one in the small hours: a 04:00 race is among 更多賽事, as a match is.)
  if (chosen && e.sessionKey && ['Qual', 'SR', 'Race'].includes(e.sessionKey) && watched().includes(e.league) && new Date(officialMs(e)).getHours() >= AWAKE_FROM) return true;
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
// A league up or down the person's order.
function moveLeague(league, by) {
  const list = [...state.prefs.leagues];
  const i = list.indexOf(league);
  const j = i + by;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  state.prefs.leagues = list;
  changed();
}
// A follow up the list (追蹤 shows them in this order).
function moveFollow(i, by) {
  const list = [...state.prefs.follows];
  const j = i + by;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  state.prefs.follows = list;
  changed();
}
function changed() {
  savePrefs();
  state.home.sportDays.clear();
  state.days.clear();
  if (state.tab === 'home' || state.tab === 'live') loadDay(state.tab === 'live' ? today() : state.home.date);
  if (state.tab === 'following') renderFollowing();
}
function track(keys = [], weight = 1) {
  if (keys.length) recordAffinity('match', keys, weight);
}
// The leagues the person follows, in their order.
const followedLeagues = () => [...state.prefs.leagues];

// 我的設定 (追蹤's 設定): everything the person picks, in one sheet, in the
// app's look (the owner, 2026-10-23: no rows of small buttons): a hero
// saying what's followed; their leagues as logo tiles in their order (a tap:
// move it or let it go); the rest of the leagues by sport, a tap to add;
// the teams and players followed as rows (a tap: open, move up, let go);
// the commentary they like.
function openFollowEditor() {
  const s = sheet(L({ zh: '我的設定', en: 'My settings' }));
  // The league or follow tapped: its actions in a row under it (a menu
  // would open behind the sheet).
  let picked = null;
  let pickedF = -1;
  const acts = list => el('div', { class: 'set-acts' }, list.filter(Boolean).map(([label, onClick, cls = 'tinted']) => el('button', { class: `q-btn small ${cls}`, type: 'button', text: label, onclick: () => (onClick(), paint()) })));
  const paint = () => {
    const p = state.prefs;
    const n = p.leagues.length;
    if (!p.leagues.includes(picked)) picked = null;
    if (pickedF >= p.follows.length) pickedF = -1;
    const tile = (k, i, add) => {
      const box = leagueTile(k, () => {});
      box.classList.add('set-league');
      if (!add && k === picked) box.classList.add('on');
      box.prepend(el('span', { class: `set-badge${add ? ' add' : ''}`, 'aria-hidden': 'true', text: add ? '+' : String(i + 1) }));
      box.setAttribute('aria-label', add ? L({ zh: `加入${leagueName(k, locale)}`, en: `Add ${leagueName(k, locale)}` }) : leagueName(k, locale));
      box.onclick = add ? () => (toggleLeague(k), paint()) : () => ((picked = picked === k ? null : k), paint());
      return box;
    };
    const at = p.leagues.indexOf(picked);
    const leagueActs = picked
      ? acts([
          at > 0 ? [L({ zh: '往前', en: 'Earlier' }), () => moveLeague(picked, -1)] : null,
          at < n - 1 ? [L({ zh: '往後', en: 'Later' }), () => moveLeague(picked, 1)] : null,
          [t('unfollow'), () => toggleLeague(picked), 'danger tinted']
        ])
      : null;
    const toAdd = shownSports()
      .map(sp => [sp, shownLeaguesOf(sp).filter(k => !p.leagues.includes(k))])
      .filter(([, ks]) => ks.length);
    const openOne = f => (f.athlete ? openPlayer(f.league, f.id, f) : f.f1team === true ? openConstructor({ id: '', name: f.name, en: f.name }) : openTeam(f.league, f.id, f));
    const follow = (f, i) => [
      el('button', { class: `q-ritem set-follow${i === pickedF ? ' on' : ''}`, type: 'button', onclick: () => ((pickedF = pickedF === i ? -1 : i), paint()) }, [
        el('span', { class: 'suggest-tile' }, [f.athlete ? personPic(f, f.league, 'sm round') : f.f1team === true ? constructorBadge(f.name, 'sm') : logo(f.logo, f.name, 'sm')]),
        el('span', { class: 'q-ritem-text' }, [el('span', { class: 'q-ritem-title', text: shownName(f) }), el('small', { text: leagueName(f.league, locale) })])
      ]),
      i === pickedF
        ? acts([
            [f.athlete ? L({ zh: '球員頁面', en: 'Player page' }) : L({ zh: '球隊頁面', en: 'Team page' }), () => openOne(f)],
            i > 0 ? [L({ zh: '往前', en: 'Up' }), () => ((pickedF = i - 1), moveFollow(i, -1))] : null,
            [t('unfollow'), () => ((pickedF = -1), toggleFollow(f.league, f)), 'danger tinted']
          ])
        : null
    ];
    const teams = p.follows.length;
    put(
      s.body,
      kitUI.sheetHero({
        eyebrow: L({ zh: '我的追蹤', en: 'Following' }),
        big: L({ zh: `${n} 個聯賽`, en: `${n} league${n === 1 ? '' : 's'}` }),
        sub: teams ? L({ zh: `${teams} 支球隊與選手`, en: `${teams} teams and players` }) : '',
        tint: 'var(--q-accent)'
      }),
      section(
        t('yourLeagues'),
        n ? el('div', { class: 'q-card pad' }, [el('div', { class: 'set-grid' }, p.leagues.map((k, i) => tile(k, i, false))), leagueActs]) : el('p', { class: 'muted small set-empty', text: t('noLeaguesYet') }),
        { sub: n > 1 ? L({ zh: '按一下調整順序', en: 'Tap one to reorder' }) : '' }
      ),
      toAdd.length ? section(L({ zh: '加入聯賽', en: 'Add a league' }), el('div', { class: 'q-card pad set-add' }, toAdd.flatMap(([sp, ks]) => [el('p', { class: 'mini-h', text: L(SPORTS[sp]) }), el('div', { class: 'set-grid' }, ks.map(k => tile(k, 0, true)))]))) : null,
      section(L({ zh: '球隊與選手', en: 'Teams and players' }), teams ? el('div', { class: 'q-rowcard' }, p.follows.flatMap(follow)) : el('p', { class: 'muted small set-empty', text: t('teamsHint') })),
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
      )
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
  track(eventKeys(e), 1);
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

// A day of picks is the hours Taiwan is awake, 05:00 to midnight: a game
// starting between midnight and 5 (Europe's evenings, America's afternoons)
// is while everyone sleeps, and is never 今日推薦 (nightOnly), only among
// 其他推薦, on its own day at its hour. Every one of the person's own
// leagues is there; of the others, only one worth staying up for
// (nightWorthy: a play-off, a final or a series game, an MLB wild-card
// decider at 02:00). A followed team's or match's can be 今日推薦 (a league
// followed as a league: its small hours' games stay there, or every night's
// 03:00 game would lead the day).
const AWAKE_FROM = 5;
const nightWorthy = e => bigGame(e) || isFollowedEvent(e, { chosen: false });
// A race weekend's practice: in 賽事 and the race's sheet, never among 首頁's picks or days.
const practice = e => /^FP\d$/.test(e.sessionKey || '');
// (A race session by its official start, not its broadcast's titles a few
// minutes before: a 05:00 qualifying titled at 04:56 is a morning pick, not the small hours.)
const officialMs = e => Date.parse(e.official || e.start);
const nightOnly = e => new Date(officialMs(e)).getHours() < AWAKE_FROM && !isFollowedEvent(e, { chosen: false });
const inDay = (ms, date) => ms >= Date.parse(`${date}T00:00:00`) && ms < Date.parse(`${addDays(date, 1)}T00:00:00`);
const inPickDay = (ms, date) => ms >= Date.parse(`${date}T${String(AWAKE_FROM).padStart(2, '0')}:00:00`) && ms < Date.parse(`${addDays(date, 1)}T00:00:00`);

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
  const out = raw.filter(e => (isToday && e.status.state === 'in') || inPickDay(officialMs(e), date) || (inDay(Date.parse(e.start), date) && (night || nightWorthy(e))) || ((past || e.status.state === 'post') && inDay(Date.parse(e.start), date)) || (!e.sessionKey && e.kind !== 'match' && e.status.state !== 'post' && e.end && Date.parse(e.start) <= Date.parse(`${date}T23:59:59`) && Date.parse(e.end) >= Date.parse(`${date}T00:00:00`)));
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
  // A day outside every league's (nothing kept, or next season's before its
  // schedule's in): nothing asked of the proxy.
  await boundsRead;
  if (!within(date, homeBounds())) {
    Object.assign(slot, { events: [], at: Date.now(), stale: false, leagues: leaguesKey(), partial: 0 });
    state.days.set(date, slot);
    return repaintDay(date);
  }
  slot.loading = true;
  state.days.set(date, slot);
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
    // The other days held (the nightly copies of the days to come): today's results on top.
    if (isToday) for (const [d, other] of state.days) if (d !== date && other.events?.length) other.events = settleSeries(other.events);
    Object.assign(slot, { events: kept, at: Date.now(), stale: false, leagues: key, partial: events.failed || 0 }, live ? {} : { fullAt: Date.now() });
    if (isToday && !events.failed) saveDay(date, slot);
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
  if (isToday) {
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
function loadTables() {
  followedLeagues()
    .filter(hasStandings)
    .filter(k => !state.home.tables[k])
    .slice(0, 8)
    .forEach(k => {
      state.home.tables[k] = {};
      state.home.tablesPending++;
      // (Counted in before the repaint: the last table's repaint is the one that settles the picks.)
      standings(k)
        .then(g => {
          state.home.tables[k] = tableIndex(g);
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
    if (e.status?.state !== 'post' && start > now - GRACE && !e.timeTbd && (onTv(e) || isFollowedGame(e))) items.push({ at: start, title: startTitle(e), body: startLine(e), tag: `start:${key}`, hash: 'live', kind: 'start' });
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
    items.push({ at: start, title: startTitle(e), body: startLine(e, true), tag: `pick:${key}`, hash: 'home', kind: 'pick' });
  }
  // Today's picks, each ending (今日推薦賽果): every pick of the day, the ones
  // on now too (they've left 今日推薦 for 正在進行); one a followed team's or
  // race weekend's final already covers isn't said twice.
  const picked = pickedToday();
  for (const e of (state.days.get(today())?.events || []).filter(e => picked.has(`${e.league}:${e.id}`)).map(freshGame)) {
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
    if (start > now - GRACE) items.push({ at: start, title: startTitle(e), body: startLine(e), tag: `start:${e.league}:${e.id}`, hash: 'live', kind: 'start' });
    const end = resultItem(e, now);
    if (end) items.push(end);
  }
  schedulePush(q, items);
}
// A game's or a sprint's or race's final, for the Worker to send the moment
// it's over (it fills in the score or the podium, and who won: {result}); a
// pick's says so (今日推薦賽果, its own switch). Asked from the soonest it can
// end (SHORTEST) at every Worker run until 8 hours after the start (`until`):
// fixed times, so the list sent stays the same from one refresh to the next,
// and an app opened mid-game hands over a check that's due at once.
const HOLD = 8 * 3_600_000;
function resultItem(e, now, pick = false) {
  const espn = LEAGUES[e.league].espn;
  const start = Date.parse(e.official || e.start);
  if (e.timeTbd || !(start > now - 4 * 3_600_000 && start < now + 8 * 86_400_000)) return null;
  const base = { body: [`{result}`, leagueName(e.league, locale), pick ? L(PICKED) : ''].filter(Boolean).join(' · '), tag: `end:${e.league}:${e.id}`, hash: 'home', kind: pick ? 'pickend' : 'end' };
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
function pickedToday() {
  try {
    const kept = JSON.parse(localStorage.getItem(PICKED_KEY) || 'null');
    if (kept?.date === today()) return new Set(kept.keys);
  } catch {}
  return new Set();
}
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
    if (followed && change === 'start' && (onTv(e) || isFollowedGame(e))) notify(q, { title: startTitle(e), body: startLine(e), tag: `start:${key}`, hash: 'live', kind: 'start' });
    if (change === 'end' && document.visibilityState === 'visible') bannered.add(key);
    if (change === 'end') notify(q, { title: matchLine(e, true), body: [resultLine(e), league, followed ? '' : L(PICKED)].filter(Boolean).join(' · '), tag: `end:${key}`, hash: 'home', kind: followed ? 'end' : 'pickend' });
  }
}

// A sideways row of chips scrolled so the chosen one sits in the middle
// (the row only, never the page).
// Only when the choice is new: a redraw with the same chip chosen (the
// games coming in, a live refresh) leaves the row where the person scrolled
// it (the kit's keepStrips puts it back), never pulls it back to the chip.
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
    centered.set(key, chosen);
    if (row.scrollWidth > row.clientWidth) moves.push([row, chip.offsetLeft - row.offsetLeft - row.clientWidth / 2 + chip.clientWidth / 2]);
  }
  for (const [row, left] of moves) row.scrollLeft = left;
}

// ---- 推薦: every match of the chosen day, ranked for this person ---------------------------

const REASON = r => t(`why_${r}`);
// A pick on 稍後: its game's row, and why it was picked as tags under it.
function planRow(item, opts = {}) {
  const row = eventRow(item.event, opts);
  const why = item.reasons.slice(0, 2).map(r => el('span', { class: 'q-tag tint', text: REASON(r) }));
  if (why.length) (row.querySelector('.ev-tags') || row.querySelector('.event-sides, .event-title')?.appendChild(el('div', { class: 'ev-tags' })))?.prepend(...why);
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
  state.scores = { ...state.scores, sport: null, league: ALL, date: date && date !== today() ? date : null, picked: false, byDay: null, days: [], extra: 0, stage: 'all', touched: true, q: '' };
  allRange.recenter = true;
  clearSearch();
  if (state.tab === 'matches') renderScores();
  else showTab('matches');
}
function pickAllDay(d) {
  if (d === allDay()) return;
  state.scores.date = d === today() ? null : d;
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
  if (!ready) list = spinner();
  else {
    const games = allGames(date);
    const unread = (slot.partial || 0) + (slot.othersFailed || 0) + ((isToday ? slot.restFailed : restDays.get(date)?.failed) || 0);
    const place = new Map(scoresRail().map((k, i) => [k, i]));
    const byLeague = new Map();
    for (const e of games) byLeague.set(e.league, [...(byLeague.get(e.league) || []), e]);
    const order = { in: 0, pre: 1, post: 2 };
    const groups = [...byLeague].sort(([a], [b]) => (place.get(a) ?? 999) - (place.get(b) ?? 999));
    prefetchVideos(games);
    const group = ([k, rows]) => {
      rows.sort((a, b) => order[a.status.state] - order[b.status.state] || a.start.localeCompare(b.start));
      // The league's head: its mark and name, and how many, a tap to its page that day.
      const sh = kitUI.sectionHead(leagueName(k, locale), { more: t('gamesN', { n: rows.length }), onMore: () => openScores(k, date) });
      sh.prepend(leagueMark(k));
      return el('section', { class: 'q-section all-league', 'data-league': k }, [sh, el('div', { class: 'q-card list' }, rows.slice(0, ALL_ROWS).map(e => eventRow(e, { league: false, day: false }))), rows.length > ALL_ROWS ? el('button', { class: 'q-btn block show-more', type: 'button', text: L({ zh: `還有 ${rows.length - ALL_ROWS} 場`, en: `${rows.length - ALL_ROWS} more` }), onclick: () => openScores(k, date) }) : null]);
    };
    list = el('div', { class: 'all-day' }, [
      el('p', { class: 'day-head', text: [dayLabel(date, { long: true }), t('gamesN', { n: games.length })].join(' · ') }),
      ...(games.length ? groups.map(group) : [empty(unread ? t('someUnread') : t('noGames'))])
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
const onMain = e => channelsOf(e).some(c => MAIN_CHANNELS.has(c.ch) && !['en', 'data', 'cam'].includes(c.audio));
// The broadcaster's pick: a game on a main channel while another of its
// league, starting within the hour, is on TV only on MAX. (One game on
// alone isn't a pick: there was nothing to choose from.)
const featuredIn = list => e => onMain(e) && list.some(o => o !== e && o.id !== e.id && o.league === e.league && Math.abs(Date.parse(o.start) - Date.parse(e.start)) < 3_600_000 && onTv(o) && !onMain(o));
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
  if (unread || !tvReady()) {
    if (unread && !slot?.loading) loadDay(h.date);
    put(box, homeBar(), homeFilters(), spinner());
    centerChosen(box);
    return;
  }
  const now = Date.now();
  const pctx = { leagues: state.prefs.leagues, follows: state.prefs.follows, games: state.prefs.games.map(gameKey), tables: h.tables, aff: affinity(null, now, ['match']), now, featured: featuredIn(dayAll(slot)), chosen: chosenGames() };
  let past = h.date < today();
  // The picks of a list: the plan and the rest (a past day ranked as it
  // stood before, shown with the real results).
  const rank = (list, also = 999, ctx = pctx, before = past) => {
    const { plan, also: awake } = dayPlan(list.filter(e => !nightOnly(e)), ctx, { n: 6, also: 999, asStood: before });
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
  const mine = slot.events.filter(shown);
  // What the reads left unknown (the day's leagues, the others', ELTA's
  // list): while any is, the day is never said to have nothing on.
  const gap = dayUnknown([slot], tvUnread());
  // Today with every one of its games over: shown as any day gone by (its
  // picks as they stood, the results in them, 今天 · 已結束的推薦 and how
  // many, 更多推薦), not as a day still going with an ended corner.
  const todayOver = h.date === today() && mine.length > 0 && mine.every(e => e.status.state === 'post' || e.status.void) && !slot.stale && !slot.loading;
  if (todayOver) past = true;
  let [planList, more] = rank(filtered(mine));
  // Nothing of theirs on: the best of the rest.
  // Opened on a day with nothing of theirs, or with all of it over: the
  // next day they have games (only on a fresh read: a saved or half-read
  // day can't say there's none). 今天 on the strip still shows today's.
  const nothingToday = !planList.length && !mine.some(e => e.status.state === 'in' || e.status.state === 'post');
  if ((nothingToday || todayOver) && h.filter === 'all' && h.autoDay && h.date === today() && state.prefs.leagues.length && !slot.stale && !slot.loading && !gap) {
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
      // game days), read while the one on TV here is worked out from the
      // seasons: with a game of theirs on TV in the day's hours, it's that day.
      const guess = nextLeagueDay();
      if (guess) (state.days.get(guess)?.at ? Promise.resolve() : loadDay(guess)).then(() => pickDayHas(guess) && go(guess));
      nextPickDay().then(go);
    }
  }
  let fallback = false;
  let finding = false;
  if (!planList.length && h.filter === 'all') {
    if (!slot.othersAt) {
      finding = true;
      loadOthers(h.date);
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
  // ranking redone put another game in a pick's place). With none of theirs, the others'.
  const endedOf = list => list.filter(e => e.status.state === 'post' || e.status.void).sort((x, y) => Date.parse(x.start) - Date.parse(y.start));
  const endedGames = isToday ? (fallback && !filtered(mine).some(e => e.status.state === 'post') ? endedOf([...wasPlan, ...wasMore].map(x => x.event)).slice(0, 6) : endedOf(filtered(mine))) : [];
  // 正在進行: today's games on now, first on 首頁 (theirs; with none of
  // theirs on, the best of everything on now), ranked like the picks, and
  // taken out of the lists below so no game shows twice.
  const onNow = list => list.filter(e => onAir(e));
  const rankLive = (list, c) => list.map(e => ({ event: e, ...scoreMatch(e, c) })).sort((x, y) => y.score - x.score);
  let liveItems = isToday ? rankLive(onNow(filtered(mine)), pctx) : [];
  const liveMine = liveItems.length > 0;
  if (isToday && !liveItems.length && h.filter === 'all') liveItems = rankLive(onNow(dayAll(slot).filter(e => !practice(e) && onTv(e))), { ...pctx, sports: [], leagues: [] }).filter(x => x.score >= 0.3);
  const allLive = isToday ? onNow(dayAll(slot)).filter(onTv).length : 0;
  if (slot?.at) prefetchVideos(dayAll(slot));
  // Today's picks on now first, each marked ★ 推薦, then the rest of theirs,
  // ranked. The picks as the plan has them (picks.mjs: games that don't
  // clash, a little overlap allowed, so two can be on at once), not every
  // list a day's finals are told for (three at once read as no plan at all,
  // the owner 2026-10-18): the day's plan as it stood (ranked with the games
  // already on: the picks only look ahead).
  const keyOf = x => `${x.league}:${x.id}`;
  const planKeys = new Set(isToday ? (fallback ? wasPlan : ownWas[0]).map(x => keyOf(x.event)) : []);
  const isPick = x => planKeys.has(keyOf(x.event));
  liveItems = [...liveItems.filter(isPick), ...liveItems.filter(x => !isPick(x))];
  const liveShown = liveItems.slice(0, liveMine ? 5 : 3);
  const liveKeys = new Set(liveShown.map(x => `${x.event.league}:${x.event.id}`));
  planList = planList.filter(x => !liveKeys.has(`${x.event.league}:${x.event.id}`));
  more = more.filter(x => !liveKeys.has(`${x.event.league}:${x.event.id}`));
  // The game to lead with: the best on now, else a followed team's next, else the first pick.
  const heroItem = past || h.picking ? null : liveShown[0] || planList.find(x => isFollowedEvent(x.event) && !x.event.status.void) || planList.find(x => !x.event.status.void) || null;
  const heroKey = heroItem ? keyOf(heroItem.event) : '';
  const liveRest = liveShown.filter(x => x !== heroItem);
  planList = planList.filter(x => x !== heroItem);
  more = more.filter(x => keyOf(x.event) !== heroKey);
  const hero = heroItem ? heroGame(heroItem.event, { picked: isPick(heroItem), mine: isFollowedEvent(heroItem.event), onOpen: openEvent }) : null;
  // The rest on now: a row each with 觀看; every game on is 轉播's.
  const liveBlock = liveRest.length
    ? section(t('liveNow'), kitRail(liveRest.map(x => x.event)), {
        cls: 'live-now',
        action: allLive > liveShown.length ? moreButton(t('allN', { n: allLive }), () => showTab('live')) : null
      })
    : null;
  const hasFollows = state.prefs.leagues.length > 0;
  // A first pick keeps the picker up for the next ones (in order), until 完成.
  if (!hasFollows && state.prefsLoaded) h.picking = true;
  // Everything the picks lean on is in: the day read fresh, the tables,
  // the followed teams, and no search for other games or days going on.
  h.settled = !slot.stale && !slot.loading && !finding && !h.jumping && !h.tablesPending && ![...h.teams.values()].includes(null);
  // (A league of theirs that didn't answer: the loading screen reads it again before it lifts.)
  h.partial = slot.partial > 0;
  // The best of the rest, by the clock (by score, a 02:45 sat above a 00:00): 稍後's 全部.
  const byStart = (x, y) => Date.parse(x.event.start) - Date.parse(y.event.start);
  const moreAll = [...more].sort(byStart);
  // Today's picks (the 今日推薦 list, not 更多推薦 or the others when none are
  // yours), for their start notices: kept when the list settles, and the
  // Worker's list sent again when they change. Their finals are said for the
  // day's picks as they stood too: one on now (正在進行, or about to start)
  // has left the list, or never was on it when the app opened.
  if (isToday && h.filter === 'all' && h.settled) {
    const picks = fallback ? [] : planList.map(x => x.event);
    const sig = [...picks, ...ownWas[0].map(x => x.event)].map(e => `${e.league}:${e.id}:${e.start}`).join('|');
    if (sig !== state.todayPicksSig) {
      state.todayPicks = picks;
      state.todayPicksSig = sig;
      notePicked([...picks, ...ownWas[0].map(x => x.event)]);
      clearTimeout(pushTimer);
      pushTimer = setTimeout(syncPush, 1500);
    }
  }
  // Another day's rows: their time alone (the head says the day).
  const rowDay = { day: h.date === today() };
  // Nothing of theirs: a quiet card saying why, and the way to every game.
  const note = (title, sub, go = true) => el('div', { class: 'home-note' }, [title ? el('strong', { text: title }) : null, sub ? el('p', { text: sub }) : null, go ? fullSchedule() : null]);
  // A day gone by: only theirs, the games of their own leagues (what the
  // day showed them), not every league's (the others' ten German and
  // Italian games were there too). Under the sport chosen; by the clock.
  const pastSeen = new Set();
  const pastGames = past
    ? filtered(mine)
        .filter(e => !pastSeen.has(`${e.league}:${e.id}:${e.sessionKey || ''}`) && pastSeen.add(`${e.league}:${e.id}:${e.sessionKey || ''}`))
        .sort((x, y) => Date.parse(x.start) - Date.parse(y.start))
    : [];
  // A light day (three games of theirs or fewer, a weekday's one or two,
  // Jay 2026-10-23): each game over as a card with who led and the ways to
  // see it again; a busy day stays a plain list. Only the day's own games.
  const light = filtered(mine).length <= 3;
  function pastDay() {
    const games = pastGames;
    if (light && games.length) return section(t('pastEvents'), recapList(games, rowDay), { action: el('span', { class: 'q-tag', text: t('gamesN', { n: games.length }) }) });
    const title = t('pastEvents');
    if (!games.length) return section(title, note('', gap === 'leagues' ? t('someUnread') : hasFollows ? t('noMineDay') : t('noFollowsYet')));
    return section(title, el('div', {}, [el('div', { class: 'q-card list' }, games.slice(0, h.shown).map(e => eventRow(e, rowDay))), games.length > h.shown ? el('button', { class: 'q-btn block show-more', type: 'button', text: `${t('showMore')} (${games.length - h.shown})`, onclick: () => ((h.shown += 30), renderHome()) }) : null]), { action: el('span', { class: 'q-tag', text: t('gamesN', { n: games.length }) }) });
  }
  // Shelves under the picks (each game once: the hero and 正在進行 first, then
  // 我的球隊, the picks, 今晚, the ended): my teams' games still to come, the
  // rest of the day's picks, my leagues, my teams' places in them.
  // (Today over is still today: what's next of theirs, their leagues and places stay.)
  const gone = past && !todayOver;
  const seenKeys = new Set([heroKey, ...liveRest.map(x => keyOf(x.event))]);
  // (A followed team's next game from its own schedule, whatever day is open, and the open day's.)
  const nextOf = f => (state.home.teams.get(`${f.league}:${f.id}`) || []).map(freshGame).filter(e => e.status?.state === 'pre' && !e.status.void && Date.parse(e.start) > now).sort((x, y) => Date.parse(x.start) - Date.parse(y.start))[0];
  const nextKeys = new Set();
  const mineNext = past || h.picking || !hasFollows
    ? []
    : [...filtered(mine).filter(e => isFollowedEvent(e) && !e.status.void && e.status.state === 'pre'), ...followedTeams().map(nextOf).filter(Boolean)]
        .filter(e => !seenKeys.has(keyOf(e)) && !nextKeys.has(keyOf(e)) && nextKeys.add(keyOf(e)))
        .sort((x, y) => Date.parse(x.start) - Date.parse(y.start))
        .slice(0, 12);
  mineNext.forEach(e => seenKeys.add(keyOf(e)));
  const planShown = planList.filter(x => !seenKeys.has(keyOf(x.event)));
  planShown.forEach(x => seenKeys.add(keyOf(x.event)));
  const restShown = moreAll.filter(x => !seenKeys.has(keyOf(x.event))).slice(0, 12);
  const leaguesShelf = gone || h.picking || !hasFollows ? null : section(t('yourLeagues'), el('div', { class: 'q-rail league-rail' }, state.prefs.leagues.map(k => leagueTile(k, lk => openScores(lk)))));
  const placeRows = gone || h.picking ? [] : followedTeams().filter(f => state.home.tables[f.league]?.[f.id]?.pos && !f.athlete).slice(0, 6);
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
  put(
    box,
    homeBar(),
    homeFilters(),
    h.picking ? sportPicker() : hero,
    h.picking ? null : liveBlock,
    // A day gone by: its games, every one, by the clock, as they ended (no
    // picks: ranked again on today's tables, yesterday's changed; the owner,
    // 2026-10-18). Theirs and the others on TV, under the sport chosen.
    past ? pastDay() : null,
    // (Nothing followed yet: the sport picker above already says so; no note under it.)
    !past && (fallback || finding) && !endedGames.length && !(h.picking && !hasFollows && state.prefsLoaded && !finding) ? note(gap === 'leagues' ? t('someUnread') : gap === 'tv' ? t('tvUnread') : hasFollows || !state.prefsLoaded ? t(isToday ? 'noMineToday' : 'noMineDay') : t('noFollowsYet'), finding ? t('findingOthers') : planList.length ? t('othersSub') : gap ? t('notKnownYet') : noTvText(h.date), !finding && !planList.length) : null,
    !past && finding ? spinner() : null,
    past
      ? null
      : planShown.length
        ? section(t('picks'), el('div', { class: 'q-card list' }, planShown.map(x => planRow(x, rowDay))), { action: !restShown.length && moreAll.length ? moreButton(t('allN', { n: moreAll.length }), () => openMore(moreAll, rowDay)) : null })
        : finding || fallback || liveBlock || hero || h.picking || mineNext.length || restShown.length
          ? null
          : section(t('picks'), note('', gap === 'leagues' ? t('someUnread') : h.filter === 'all' ? (gap ? t('tvUnread') : noTvText(h.date)) : t('noPicksMine'))),
    mineNext.length ? section(t('myGames'), kitRail(mineNext)) : null,
    !past && restShown.length ? section(t('moreGames'), kitRail(restShown.map(x => x.event)), { action: moreAll.length > restShown.length ? moreButton(t('allN', { n: moreAll.length }), () => openMore(moreAll, rowDay)) : null }) : null,
    leaguesShelf,
    placesShelf,
    endedGames.length ? section(t('pastEvents'), light ? recapList(endedGames, rowDay) : kitRail(endedGames), { action: el('span', { class: 'q-tag', text: t('gamesN', { n: endedGames.length }) }) }) : null
  );
  // An F1 session on: its live timing read now, not at the next tick.
  if (!f1Live.feed && box.querySelector('[data-f1-brief]')) pollF1Live();
}
// A light day's games over: a card each, with who led each side and the
// ways to see it again (sheets.js gameRecap); each game's leaders read once.
const homeBest = new Map();
function recapList(games, opts) {
  return el('div', { class: 'recap-list' }, games.map(e => {
    const k = `${e.league}:${e.id}`;
    if (!homeBest.has(k)) {
      homeBest.set(k, null);
      summary(e.league, e.id)
        .then(d => homeBest.set(k, d || {}))
        .catch(() => homeBest.set(k, {}))
        .finally(() => state.tab === 'home' && renderHome());
    }
    return el('div', { class: 'q-card recap' }, [eventRow(e, opts), ...(e.kind === 'match' && !e.status.void ? gameRecap(e, homeBest.get(k)) : [])]);
  }));
}
// Cards that scroll sideways (the kit's rail).
// A rail of games as cards; a lone game as a row in a full-width card (one
// card by itself in a rail looked empty, Jay 2026-10-23).
const kitRail = games => (games.length === 1 ? el('div', { class: 'q-card list' }, [eventRow(games[0], { day: true })]) : el('div', { class: 'q-rail score-rail' }, games.map(e => scoreCard(e, openEvent))));
// 稍後's 全部: the rest of the day worth a look, by the clock.
function openMore(items, opts) {
  const s = sheet(t('moreGames'));
  put(s.body, el('div', { class: 'q-card list' }, items.map(x => eventRow(x.event, opts))));
}
// Nothing on TV here that day: why (past ELTA's list, only the NBA's and
// MLS's games are known), and the way to every game (賽事).
function noTvText(date) {
  const until = tvUntil();
  if (until && date > until) {
    const d = new Date(`${until}T12:00:00`);
    return L({ zh: `愛爾達的節目表排到 ${d.getMonth() + 1}/${d.getDate()}，之後只知道 NBA 和 MLS 的轉播。`, en: `ELTA's schedule runs to ${d.getMonth() + 1}/${d.getDate()}; after that only NBA and MLS broadcasts are known.` });
  }
  return t('noOthers');
}
const fullSchedule = () => el('button', { class: 'section-more', type: 'button', text: `${L({ zh: '看完整賽程', en: 'Every game' })} ›`, onclick: () => openAll(state.home.date) });
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
  const filters = [['all', t('f_all')], ...(watched().length ? [['teams', t('f_mine')]] : state.prefs.follows.length ? [['teams', t('f_teams')]] : []), ...followedSports().filter(isActiveSport).map(sp => [sp, L(SPORTS[sp])])];
  if (filters.length < 3) return null;
  return el('div', { class: 'q-chips day-filters' }, filters.map(([k, label]) => el('button', { class: 'q-chip', type: 'button', 'aria-pressed': String(h.filter === k), text: label, onclick: () => h.filter !== k && ((stripRange.recenter = true), pickFilter(k)) })));
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
  // The next day it plays (today included), else its latest.
  const list = [...days].sort();
  if (list.length && !days.has(h.date)) h.date = list.find(d => d >= today()) || list.at(-1);
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
    put(box, liveBar(), liveShape());
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
  // Every game on now, the headline leagues first.
  const live = all.filter(e => onAir(e)).sort((a, b) => Boolean(LEAGUES[b.league]?.top) - Boolean(LEAGUES[a.league]?.top));
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
  const mineFirst = list => [...list].sort((a, b) => isFollowedEvent(b) - isFollowedEvent(a));
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
    ? section(t('myGames'), el('div', { class: 'by-day' }, [...byDay].map(([d, list]) => [el('p', { class: 'day-head', text: dayLabel(d, { long: true }) }), el('div', { class: 'q-card list' }, list.map(e => eventRow(e, { day: false })))]).flat()), {
        action: el('span', { class: 'q-tag tint', text: L({ zh: `${TV_DAYS} 天`, en: `${TV_DAYS} days` }) })
      })
    : null;
  const later = soon.filter(e => (e !== nextUp || live.length) && !mineKeys.has(key(e)));
  const wait = nextUp ? Math.max(0, Date.parse(nextUp.start) - now) : 0;
  const waitText = wait < 60_000 ? L({ zh: '馬上', en: 'any minute' }) : wait < 3_600_000 ? L({ zh: `${Math.round(wait / 60_000)} 分鐘後`, en: `in ${Math.round(wait / 60_000)} min` }) : L({ zh: `${Math.floor(wait / 3_600_000)} 小時 ${Math.round((wait % 3_600_000) / 60_000)} 分後`, en: `in ${Math.floor(wait / 3_600_000)} h ${Math.round((wait % 3_600_000) / 60_000)} min` });
  // The game to lead with: the first on now (a followed team's first), else the next to start.
  const liveSorted = mineFirst(live);
  const heroEvent = liveSorted[0] || nextUp || null;
  const hero = heroEvent ? heroGame(heroEvent, { mine: isFollowedEvent(heroEvent), picked: pickedToday().has(`${heroEvent.league}:${heroEvent.id}`), eyebrow: live.length ? '' : L({ zh: `下一場 · ${waitText}`, en: `Next · ${waitText}` }), onOpen: openEvent }) : null;
  const guide = guideItems().some(p => p.end > now) ? guideLink(all) : null;
  put(
    box,
    liveBar(),
    hero,
    !hero ? (reading && !gap ? spinner() : el('div', { class: 'home-note' }, [el('strong', { text: gap ? t('liveUnread') : L({ zh: '接下來一天沒有比賽', en: 'Nothing in the next day' }) })])) : null,
    guide,
    liveSorted.length > 1 ? section(t('liveNow'), el('div', { class: 'q-card list' }, liveSorted.slice(1).map(liveRow)), { cls: 'live-now' }) : null,
    mineBlock,
    later.length ? section(t('upcomingEvents'), el('div', { class: 'q-card list' }, later.slice(0, 30).map(e => eventRow(e)))) : null
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
    else if (slot?.at && !slot.othersAt && !slot.othersLoading) loadOthers(d);
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
  const c = { leagues: state.prefs.leagues, follows: state.prefs.follows, games: state.prefs.games.map(gameKey), tables: state.home.tables, aff: affinity(null, now, ['match']), now, featured: featuredIn(list), chosen: chosenGames() };
  const ranked = list.filter(e => !e.status.void).map(e => ({ e, mine: isFollowedEvent(e), score: scoreMatch(e, c).score })).sort((x, y) => y.mine - x.mine || y.score - x.score);
  const top = ranked[0]?.e || null;
  const hero = top ? heroGame(top, { mine: isFollowedEvent(top), eyebrow: top.status.state === 'pre' ? dayLabel(d, { long: true }) : '', onOpen: openEvent }) : null;
  const rest = list.filter(e => e !== top);
  const gap = dayUnknown([slot], tvUnread());
  const guide = !past && guideItems().some(p => p.end > now && localDate(p.start) === d) ? guideLink(list, d) : null;
  put(
    box,
    liveBar(),
    hero,
    !hero ? el('div', { class: 'home-note' }, [el('strong', { text: gap ? t('liveUnread') : L({ zh: '這天沒有轉播', en: 'Nothing on TV that day' }) }), d > (tvUntil() || d) ? el('p', { text: noTvText(d) }) : null]) : null,
    guide,
    rest.length ? section(L({ zh: '當天轉播', en: 'On TV that day' }), el('div', { class: 'q-card list' }, rest.map(e => eventRow(e, { day: false }))), { action: el('span', { class: 'q-tag', text: t('gamesN', { n: list.length }) }) }) : null
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
  const s = sheet(L({ zh: '愛爾達節目表', en: 'ELTA TV guide' }));
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
}

// ---- 賽事: every sport, league and game day ------------------------------------------------------

function openScores(league, date, view = 'games') {
  state.scores = { ...state.scores, sport: LEAGUES[league].sport, league, date: date || null, picked: Boolean(date), byDay: null, days: [], extra: 0, stage: 'all', touched: true, view: hasStandings(league) ? view : 'games', q: '' };
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
// is opened, kept 10 minutes.
const brackets = new Map();
const hasBracket = k => LEAGUES[k]?.kind === 'match' && (!LEAGUES[k].asia || k === 'cpbl') && Boolean(FORMATS[k]);
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
// The playoffs so far: from the next ten days back.
async function postseason(league) {
  const cal = await seasonCalendar(league);
  const from = yyyymmdd(new Date(Date.now() - 80 * 86_400_000));
  return playoffWeeks(league, (cal?.days || []).filter(d => d >= from && d <= yyyymmdd(new Date(Date.now() + 10 * 86_400_000))).reverse());
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
async function playoffData(league) {
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
    const all = (await seasonEvents(league).catch(() => [])).filter(e => e.round);
    const now = all.filter(e => Date.parse(e.start) >= start);
    // ESPN can keep a finished season as its current one (the FA Cup's, all summer): last season, said so.
    if (now.length) return { mode: Date.parse(season.end) < Date.now() ? 'last' : 'live', events: now, stages, season: season.name };
    const groups = FORMATS[league].project ? await table() : null;
    if (groups) return { mode: 'projected', events: [], groups, stages, season: season.name };
    // A season under way with no knockout games or table yet (the FA Cup's early rounds): its rounds' dates.
    if (season.phase && season.phase !== 'off' && stages.length && !FORMATS[league].project) return { mode: 'live', events: [], stages, season: season.name };
    let before = all.filter(e => Date.parse(e.start) < start);
    if (!before.length) before = (await seasonEvents(league, start - 30 * 86_400_000).catch(() => [])).filter(e => e.round);
    return { mode: 'last', events: before, season: '' };
  }
  if (season.phase === 'post') return { mode: 'live', events: await postseason(league), stages, season: season.name };
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
  const had = brackets.get(league);
  if (!hasBracket(league) || (had && (had.loading || Date.now() - had.at < (had.failed ? 61_000 : 10 * 60_000)))) return;
  brackets.set(league, { ...(had || {}), loading: true, again: false });
  playoffData(league)
    // A game started or ended while it was read: read again at once (at 0).
    .then(d => {
      const model = playoffModel({ league, ...d });
      brackets.set(league, { model, at: brackets.get(league)?.again ? 0 : Date.now() });
      // A series' games from weeks back: their watch links ready for its sheet.
      watchMonthsOf(model.rounds.flatMap(r => r.ties.flatMap(t => t?.games || [])));
    })
    .catch(() => {
      brackets.set(league, { model: had?.model || null, at: Date.now(), failed: true });
      setTimeout(() => state.tab === 'matches' && state.scores.league === league && state.scores.view === 'bracket' && renderScores(), 61_500);
    })
    .finally(() => state.tab === 'matches' && state.scores.league === league && renderScores());
}
// A playoff game starting or ending (seen in today's read or the open
// league's) changes its bracket (the series, who's through, on now): read
// again then, not left as it was for up to 10 minutes after a clincher.
const poState = new Map();
function notePlayoffGames(events) {
  const changed = new Set();
  for (const e of events) {
    if (!e.round || !hasBracket(e.league)) continue;
    const key = `${e.league}:${e.id}`;
    const was = poState.get(key);
    poState.set(key, e.status.state);
    if (was && was !== e.status.state) changed.add(e.league);
  }
  for (const league of changed) staleBracket(league);
}
function staleBracket(league) {
  const had = brackets.get(league);
  if (!had) return;
  if (had.loading) had.again = true;
  else had.at = 0;
  // Open: read now (renderScores asks for it).
  if (state.tab === 'matches' && state.scores.league === league && state.scores.view === 'bracket') renderScores();
}
// A game's whole series (or two-legged tie), for its match page: from the
// league's bracket, the one 季後賽 shows (read now when not held fresh).
// The league's bracket model, held fresh 10 minutes (read now when not).
async function bracketModel(league) {
  const had = brackets.get(league);
  let model = had?.model && !had.failed && Date.now() - had.at < 10 * 60_000 ? had.model : null;
  if (!model) {
    model = playoffModel({ league, ...(await playoffData(league)) });
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
ctx.playoffsOf = async league => {
  if (!hasBracket(league)) return null;
  const model = await bracketModel(league);
  return model?.rounds?.length ? playoffView(model, league) : null;
};
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
const roundDates = r => (!r.dates ? '' : r.dates.about ? `${locale === 'en' ? 'c.' : '約'} ${md(r.dates.from)}${locale === 'en' ? '' : ' 起'}` : md(r.dates.from) === md(r.dates.to) ? md(r.dates.from) : `${md(r.dates.from)}–${md(r.dates.to)}`);
// How many games a round's series runs to, where its games don't say yet.
const SERIES_LEN = { mlb: { RD16: 3, QTR: 5, SEMI: 7, FINAL: 7 }, nba: { RD16: 7, QTR: 7, SEMI: 7, FINAL: 7 } };
function playoffView(model, league) {
  const en = locale === 'en';
  const banner =
    model.mode === 'projected'
      ? el('p', { class: 'po-banner' }, [el('strong', { text: en ? 'Predicted' : '預測' }), document.createTextNode(en ? ' from the table as it stands: it changes until the playoffs start.' : '　依目前排名推算，開打前會變動。')])
      : model.mode === 'last'
        ? el('p', { class: 'po-banner' }, [el('strong', { text: en ? 'Last season' : '上季' }), document.createTextNode(`${model.season ? ` ${model.season}` : ''}${en ? ': this season’s playoffs haven’t begun.' : '　本季季後賽尚未開打。'}`)])
        : null;
  // A round's length (七戰四勝): its games' series, else the league's format.
  const lenOf = r => bestOf(r.ties.flatMap(t => t?.games || []).find(g => g.series?.games)) || bestOf({ series: { games: SERIES_LEN[league]?.[r.key] } });
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
        el('span', { class: 'br-maybe' }, maybe.flatMap((x, j) => [j ? el('span', { class: 'br-or', text: '/' }) : null, el('span', { class: 'br-opt' }, [sideLogo(x, league, 'xs'), el('span', { class: 'br-name', text: x.short || x.name })])]))
      ]);
    return el('div', { class: `br-side${t.winner ? (t.winner === id ? ' win' : ' out') : ''}${s ? '' : ' tbd'}` }, [
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
          .replace(/^挑戰賽勝者$/, 'Challenge winner')
          .replace(/^一勝優勢$/, '1 win up')
          .replace(/^(\S+) 組$/, 'Group $1');
  const note = (t, r) => {
    if (!t) return roundDates(r) ? `${en ? 'Expected' : '預計'} ${roundDates(r)}` : en ? 'To be decided' : '待定';
    // A play-in game not decided: what winning and losing it means.
    if (t.outcome && !t.winner && !t.live && (t.projected || t.pending || !t.next)) return en ? t.outcome.en : t.outcome.zh;
    // (The 8th seed game sits in the play-in's column: named on its card; English's words too long for 預測 beside them.)
    if (t.projected) return [t.roundTitle ? (en ? t.roundTitle.en : t.roundTitle.zh) : '', t.labels?.find(Boolean) && t.sides.every(Boolean) ? t.labels.filter(Boolean).map(labelText).join(' v ') : '', en && t.roundTitle ? '' : en ? 'Predicted' : '預測'].filter(Boolean).join(' · ');
    const won = t.winner && t.sides.find(s => String(s.id) === t.winner);
    if (won) return `${won.short || won.name} ${en ? 'through' : '晉級'}`;
    if (t.live) return en ? 'On now' : '進行中';
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
  const tie = (t, r) => {
    const blank = { projected: true, seeds: [], labels: [] };
    // An empty row (the play-in's): a card's height, unseen, so the columns line up.
    if (t?.gap) return el('div', { class: `br-tie gap${t.through ? ' through' : ''}`, 'aria-hidden': 'true' }, [sideRow(null, blank, 0), sideRow(null, blank, 1), el('small', { class: 'br-note', text: '·' })]);
    const said = note(t, r);
    const body = [sideRow(t?.sides[0] || null, t || blank, 0), sideRow(t?.sides[1] || null, t || blank, 1), said ? el('small', { class: `br-note${t?.live ? ' live' : ''}${t?.outcome ? ' q-fit' : ''}`, text: said }) : null];
    return t && !t.projected && !t.pending
      ? el('button', { class: `br-tie${t.live ? ' live' : ''}`, type: 'button', onclick: () => openTie({ ...t, games: t.games.map(freshGame) }, league, en ? (t.roundTitle || r.title).en : (t.roundTitle || r.title).zh) }, body)
      : el('div', { class: `br-tie ${t?.pending ? 'pending' : t ? 'projected' : 'tbd'}${t?.roundTitle ? ' eighth' : ''}` }, body);
  };
  const entry = brackets.get(league);
  const fade = entry && !entry.shown;
  if (entry) entry.shown = true;
  // Two rounds or fewer (CPBL's challenge series and Taiwan Series): one
  // under the other, each tie the screen's width (two columns cut its names).
  const stacked = model.rounds.length <= 2;
  const map = el(
    'div',
    { class: `bracket${stacked ? ' stacked' : ''}${model.rounds.some(r => r.ties.some(t => t?.seeds?.some(Boolean) || t?.sides?.some(x => x?.seed))) ? '' : ' no-seeds'}` },
    model.rounds.map(r => el('section', { class: `br-col ${r.state}` }, [el('div', { class: 'br-head' }, [el('strong', { text: en ? r.title.en : r.title.zh }), el('small', { text: [lenOf(r), stateText(r)].filter(Boolean).join(' · ') })]), el('div', { class: 'br-ties' }, r.ties.map(t => tie(t, r)))]))
  );
  if (!stacked) linkTies(map, model);
  // Opened on the round that's on (or next), not always the first.
  const at = stacked ? 0 : openRound(model) - 1;
  // (By the rounds themselves: the lines' drawing sits first in the map.)
  if (at > 0) requestAnimationFrame(() => map.isConnected && (map.scrollLeft = map.querySelectorAll(':scope > .br-col')[at]?.offsetLeft - map.offsetLeft - 16));
  return el('div', { class: `playoffs${fade ? ' fade-in' : ''}` }, [banner, map]);
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
    for (const sel of [':scope > .br-col > .br-head', ':scope > .br-col .br-tie']) {
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
  if (quiet) {
    scoresQuiet = true;
    try {
      renderScores();
    } finally {
      scoresQuiet = false;
    }
  } else renderScores();
}
// While set, renderScores changes the page in place (morph), not anew.
let scoresQuiet = false;
// The page as drawn, made like the new drawing with the least change: a
// node the same kept (its scroll, its handlers), text changed in place, an
// element whose tag, attributes or children's count differ replaced whole.
function morph(old, neu) {
  if (old.nodeType !== neu.nodeType || old.nodeName !== neu.nodeName) return old.replaceWith(neu);
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
  sc.date = d;
  sc.picked = true;
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
  setTimeout(() => input.focus(), 50);
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
// A race weekend as a card: its flag, name, circuit and days, then each session (time, badge, state); over, the
// race's winner.
function weekendCard(sessions) {
  const e = sessions[0];
  const list = [...sessions].sort((a, b) => a.start.localeCompare(b.start));
  const first = localDate(Date.parse(list[0].start));
  const last = localDate(Date.parse(list.at(-1).start));
  const days = first === last ? dayLabel(first) : `${dayLabel(first)} – ${dayLabel(last)}`;
  const race = list.find(x => x.sessionKey === 'Race') || list.at(-1);
  const done = list.every(x => x.status.state === 'post');
  const winner = done ? (race.sessions?.find(x => x.abbr === race.sessionKey) || race.sessions?.at(-1))?.field?.[0] : null;
  const live = list.some(x => x.status.state === 'in');
  // One card, one tap: the session on, else the next to come, else (over) the
  // race; its sheet has the others a tap away. (Each line used to be its own
  // tap, so where the finger fell picked 一練, the sprint or qualifying.)
  const open = list.find(x => x.status.state === 'in') || list.find(x => x.status.state === 'pre') || race;
  return el('button', { class: `q-card wk-card${live ? ' live' : ''}${done ? ' done' : ''}`, type: 'button', disabled: open?.status?.void ? true : null, onclick: () => openEvent(open) }, [
    el('div', { class: 'wk-card-head' }, [raceFlag(e, 'big'), el('div', { class: 'wk-card-text' }, [el('strong', { class: 'wk-card-name', text: e.name }), e.venue ? el('small', { class: 'muted wk-card-line', text: e.venue }) : null, el('small', { class: 'muted wk-card-line num', text: days })])]),
    winner
      ? el('div', { class: 'wk-winner' }, [personPic(winner, e.league, 'sm round'), el('span', {}, [el('small', { class: 'muted', text: L({ zh: '冠軍', en: 'Winner' }) }), el('strong', { text: winner.short || winner.name })])])
      : el(
          'div',
          { class: 'wk-sessions' },
          list.map(x => {
            const kind = { Race: 'race', Qual: 'qual', SR: 'sprint', SS: 'sq', SQ: 'sq' }[x.sessionKey] || 'other';
            return el('div', { class: `wk-row ${kind}${x.status.state === 'in' ? ' live' : ''}${x.status.state === 'post' ? ' done' : ''}` }, [
              el('span', { class: 'wk-time num' }, [el('small', { text: dayLabel(localDate(Date.parse(x.start))) }), document.createTextNode(timeText(x))]),
              el('span', { class: 'wk-name' }, [sessionTag(x)]),
              el('span', { class: `wk-state ${x.status.state}`, text: x.status.state === 'post' ? t('final') : x.status.state === 'in' ? t('live') : '' })
            ]);
          })
        )
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
    const pick = k => {
      const sc = state.scores;
      if (sc.league === k) return;
      state.scores = { ...sc, sport: LEAGUES[k].sport, league: k, season: null, date: null, picked: false, byDay: null, days: [], extra: 0, stage: 'all', touched: true, view: hasStandings(k) || sc.view === 'bracket' ? sc.view : 'games' };
      loadScores();
    };
    railKept = {
      key,
      node: el('div', { class: 'q-chips league-rail' }, [
        el('button', { class: 'q-chip search-chip', type: 'button', 'aria-label': L({ zh: '搜尋', en: 'Search' }), html: icon('search'), onclick: openSearch }),
        el('button', { class: 'q-chip all-chip', type: 'button', 'data-league': ALL, 'aria-pressed': 'false', text: t('f_all'), onclick: () => state.scores.league !== ALL && openAll(today()) }),
        ...rail.map(k => el('button', { class: 'q-chip', type: 'button', 'data-league': k, 'aria-pressed': 'false', onclick: () => pick(k) }, [leagueMark(k), locale === 'en' ? leagueName(k, locale) : leagueName(k, locale).replace(/\s.*$/, '')]))
      ])
    };
  }
  for (const chip of railKept.node.querySelectorAll('[data-league]')) chip.setAttribute('aria-pressed', String(chip.dataset.league === state.scores.league));
  return railKept.node;
}
function scoresRail() {
  const mine = new Set(state.prefs.leagues);
  // Every league on one rail, theirs first (in their order), then by sport;
  // the search first of all, then 全部.
  const sportOrder = shownSports().sort((a, b) => followedSports().includes(b) - followedSports().includes(a));
  return [...state.prefs.leagues.filter(isActive), ...sportOrder.flatMap(sp => shownLeaguesOf(sp).sort((a, b) => Boolean(LEAGUES[b].top) - Boolean(LEAGUES[a].top)).filter(k => !mine.has(k)))];
}
function renderScores() {
  const sc = state.scores;
  if (sc.league === ALL) return renderAll();
  // A sport or league with nothing on now: the first one that has.
  if (activeSet && !isActive(sc.league)) {
    const sport = isActiveSport(sc.sport) ? sc.sport : shownSports()[0];
    const league = shownLeaguesOf(sport).find(k => LEAGUES[k].top) || shownLeaguesOf(sport)[0];
    if (league) {
      state.scores = { ...sc, sport, league, date: null, picked: false, byDay: null, days: [], extra: 0, stage: 'all', view: hasStandings(league) ? sc.view : 'games' };
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
  const poFailed = reading && po?.failed && !po.loading;
  const knockView = sc.view === 'bracket' && hasBracket(sc.league) && (rounds.length > 0 || reading);
  const tableView = !knockView && sc.view === 'table' && hasStandings(sc.league);
  const leadersView = !knockView && !tableView && sc.view === 'leaders' && hasLeaders(LEAGUES[sc.league]?.sport, LEAGUES[sc.league]?.espn);
  if (leadersView) list = leadersOf(sc.league);
  else if (knockView) list = rounds.length ? playoffView(po.model, sc.league) : poFailed ? empty(t('failed')) : bracketShape();
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
    const block = (title, list) => section(title, el('div', { class: 'q-card list' }, list.map(e => eventRow(e, { league: false }))));
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
    prefetchVideos(games);
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
    const card = shown.length ? el('div', { class: 'q-card list' }, (scoresQuiet ? shown : shown.slice(0, FIRST_ROWS)).map(row)) : null;
    if (card && !scoresQuiet) moreRows(card, shown.slice(FIRST_ROWS), row);
    list = el('div', {}, [el('p', { class: 'day-head', text: [dayLabel(sc.date, { long: true }), wk, t('gamesN', { n: shown.length })].filter(Boolean).join(' · ') }), card || empty(t('noGames'))]);
  }
  // The league as the page's head: its name, following it at the right.
  const name = leagueName(sc.league, locale);
  const head = pageHead(name, followButton(() => mine.has(sc.league), () => (toggleLeague(sc.league), renderScores()), t('followLeague')));
  if (name.length > (locale === 'en' ? 14 : 7)) head.classList.add('long');
  const viewList = [['games', t('schedule')], ...(hasStandings(sc.league) ? [['table', t('table')]] : []), ...(rounds.length || reading ? [['bracket', LEAGUES[sc.league].cup ? L({ zh: '淘汰賽', en: 'Knockouts' }) : L({ zh: '季後賽', en: 'Playoffs' })]] : []), ...(hasLeaders(LEAGUES[sc.league]?.sport, LEAGUES[sc.league]?.espn) ? [['leaders', L({ zh: '數據領先', en: 'Leaders' })]] : [])];
  const views = viewList.length > 1 ? segmented(viewList, knockView ? 'bracket' : tableView ? 'table' : leadersView ? 'leaders' : 'games', v => ((sc.view = v), renderScores()), 'views') : null;
  const other = tableView || knockView || leadersView;
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
  if (b) return el('span', { class: 'tf-tv' }, [document.createTextNode(b.short[locale === 'en' ? 'en' : 'zh']), b.audio ? el('span', { class: 'au-tag', text: audioName(b) }) : null]);
  return el('span', { class: 'tf-tv none', text: tvKnown(e) ? L({ zh: '沒有轉播', en: 'Not on TV' }) : L({ zh: '轉播待公布', en: 'TV to come' }) });
}

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
        el('div', { class: 'q-card list followed-games' }, games.map(e => el('div', { class: 'fg-row' }, [withWatch(eventRow(e), e), el('button', { class: 'fg-off', type: 'button', 'aria-label': L({ zh: '取消追蹤這場', en: 'Unfollow this match' }), text: '★', onclick: () => toggleFollowGame(e) })]))),
        { sub: gamesNote(games) }
      )
    : null;
  // 我的設定 where it's seen (the owner, 2026-10-23: not a 管理 button in
  // the head): its rows at the foot of the tab, each saying what's set now.
  const names = p.leagues.slice(0, 3).map(k => leagueName(k, locale)).join('、') + (p.leagues.length > 3 ? L({ zh: ` 等 ${p.leagues.length} 個`, en: ` and ${p.leagues.length - 3} more` }) : '');
  const settings = section(
    L({ zh: '設定', en: 'Settings' }),
    el('div', { class: 'q-rowcard' }, [
      el('button', { class: 'q-ritem chevron set-open', type: 'button', onclick: openFollowEditor }, [el('span', { class: 'q-tile', 'aria-hidden': 'true', html: icon('list') }), el('span', { class: 'q-ritem-text' }, [el('span', { class: 'q-ritem-title', text: L({ zh: '聯賽與追蹤', en: 'Leagues and follows' }) }), el('small', { text: names || t('noLeaguesYet') })])]),
      el('button', { class: 'q-ritem chevron set-open', type: 'button', onclick: openFollowEditor }, [el('span', { class: 'q-tile', 'aria-hidden': 'true', html: icon('tv') }), el('span', { class: 'q-ritem-text' }, [el('span', { class: 'q-ritem-title', text: t('tvAudio') })]), el('span', { class: 'q-ritem-value', text: (p.audio || 'en') === 'en' ? t('tvAudioEn') : t('tvAudioZh') })])
    ])
  );
  if (!teams.length && !people.length) {
    put(box, pageHead(t('tab_following')), gamesBlock, section(L({ zh: '熱門球隊', en: 'Popular teams' }), el('div', { class: 'q-rowcard' }, SUGGEST.map(suggestCard))), settings);
    return;
  }
  put(
    box,
    pageHead(t('tab_following')),
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
    .catch(() => boxes.delete(key))
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
// Last seasons' final tables ('<league>:<year>'), read once.
const lastTables = new Map();
// Read as soon as a league opens in 賽事 (not on the tap on 排名): the copy
// this phone has shown at once, the fresh one in its place when it comes.
// Read again after ten minutes, the table on screen kept till then.
const tableAt = new Map();
function warmTable(league) {
  if (!hasStandings(league) || Date.now() - (tableAt.get(league) ?? -Infinity) < 10 * 60_000) return;
  tableAt.set(league, Date.now());
  const shown = () => state.tab === 'matches' && state.scores.league === league && state.scores.view === 'table' && renderScores();
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
function leadersOf(league) {
  if (!leaders.has(league)) {
    leaders.set(league, undefined);
    leagueLeaders(league)
      .then(d => leaders.set(league, d))
      .catch(() => leaders.delete(league))
      .then(() => state.tab === 'matches' && state.scores.league === league && renderScores());
  }
  if (!leaders.has(league)) return empty(t('failed'));
  const d = leaders.get(league);
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
      .catch(() => leaderLists.delete(st.url))
      .then(() => state.tab === 'matches' && state.scores.league === league && renderScores());
  }
  return leagueLeadersView(d, league, { teamOf: (id, x) => rows.get(String(id)) || clubs.get(String(x?.fotmobTeam ?? '')) || (x?.teamName ? byName(x.teamName) : null), pick: st.key, full: st.url ? leaderLists.get(st.url) : null, onPick: k => (leaderPick.set(league, k), renderScores()) });
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
  const now = tableNow(groups, league, recent);
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
    state.scores.byDay ? renderScores() : loadScores();
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
// A swipe on 首頁 or 轉播: the day before or after.
kitUI.daySwipe($('panel-home'), dir => {
  const d = !state.home.picking && stripStep(stripRange, state.home.date, dir);
  return Boolean(d && (pickHomeDay(d), true));
});
kitUI.daySwipe($('panel-live'), dir => {
  const d = stripStep(liveRange, liveDay(), dir);
  return Boolean(d && (pickLiveDay(d), true));
});
// 賽事's too: 全部's days, or a league's game days (its schedule shown, not its table).
kitUI.daySwipe($('panel-matches'), dir => {
  const sc = state.scores;
  if (sc.league === ALL) {
    const d = stripStep(allRange, allDay(), dir);
    return Boolean(d && (pickAllDay(d), true));
  }
  const d = scoresBarEl.isConnected && sc.range && stripStep(sc.range, sc.date, dir);
  return Boolean(d && (pickScoresDay(d), true));
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

new MutationObserver(() => fitNumbers([...document.querySelectorAll('.mh-score, .team-head h3, .mh-team strong')])).observe(document.body, { childList: true, subtree: true });

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
// A link or a notice's tap that points at a tab while the app is open.
window.addEventListener('hashchange', () => {
  const hash = location.hash.slice(1);
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
const pickDayHas = date => {
  const slot = state.days.get(date);
  const sports = new Set(followedSports());
  return Boolean(slot?.at && !slot.partial && slot.leagues === leaguesKey() && slot.events.some(e => sports.has(LEAGUES[e.league]?.sport) && !e.status?.void && !practice(e) && onTv(e) && inPickDay(officialMs(e), date)));
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
  // The followed leagues' tables, read once the day's games are in: 排名 opens at once.
  setTimeout(() => followedLeagues().filter(hasStandings).slice(0, 6).forEach(warmTable), 2000);
}
if (!gated) boot();
setTimeout(() => ($('loading').hidden = true), BOOT_WAIT + 2000);

// Opens without a connection: the kit registers the worker and has it keep every file loaded.
keepOffline();
// Every screen is live (an old copy would read as now): no connection, the kit's cover, not the saved copy.
onlineOnly({ zh: '比分和賽程需要網路連線', en: 'Scores and schedules need a connection.' });
