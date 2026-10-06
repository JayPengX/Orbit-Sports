// Orbit Sports (was Quadra Fixtures): an Orbit app, one of the everyday
// tools, signed in with the Quadra Pass. Every supported sport's scores, schedules, match details (box
// scores, plays, line-ups, win probability), standings, teams and players,
// and a day planned around what the person follows, for the leagues on
// ELTA.tv and Apple TV in Taiwan, with a tap to watch them there. The data is
// ESPN's (CPBL's own site for its games), read through the
// Quadra data proxy (lib/espn.mjs).
//
// What the person follows lives on the pass (this app's payload): leagues in
// their order of priority, teams and F1's drivers and teams. Nothing of it goes to the other
// apps; their activity doesn't steer the picks here either.
import { quadraSession, tabBar, topActions, installGate, watchUpdates, recordAffinity, affinity, affinityPatch, settingPatch, setting, fitNumbers, notify, cachedPayload, cachedWallet, restorePlace, schedulePush, translate, proxyJson } from '#kit/quadra.mjs';
import { stripDays } from './lib/strip.mjs';
import * as kit from '#kit/quadra.mjs';
import { freshGame, summary, sessionName, weekOf, localSide, fallbackLogo, scoreboard, standings, teamSchedule, seasonCalendar, seasonInfo, monthsBetween, yyyymmdd, settleField, seasonEvents, splitWeekend, asiaEvents, athlete, athleteOverview, driverSeason } from './lib/espn.mjs';
import { statName, injuryZh } from './lib/statnames.mjs';
import { eltaChannel, hasAudio, channelRank } from './lib/broadcast.mjs';
import { findLeagues, parseSearch } from './lib/search.mjs';
import { LEAGUES, SPORTS, leagueName, leaguesOf, hasStandings, hasTeams } from './lib/leagues.mjs';
import { familyOfSport } from '#kit/catalog.mjs';
import { detectLocale, makeT } from './lib/i18n.mjs';
import { eventKeys, teamKey, leagueKey } from './lib/foryou.mjs';
import { liveTable, standingsRace, SEASON_GAMES } from './lib/title.mjs';
import { dayPlan, tableIndex, DURATION, scoreMatch, bigGame } from './lib/picks.mjs';
import { liveTiming } from './lib/f1.mjs';
import { playoffModel, openRound, FORMATS } from './lib/playoffs.mjs';
import { stageOf } from './lib/stage.mjs';
import { nearestDay } from './lib/days.mjs';
import { onTvChange, tvOf, knownEvents, eltaSchedule, audioPref, onTv, tvReady, tvUntil, tvKnown, channelsOf, nbaAfterList } from './lib/tv.mjs';
import { ctx, el, shownStart, put, spinner, empty, $, localDate, today, addDays, clock, dayLabel, whenText, statusText, sideLine, eventRow, sheet, section, moreButton, logo, leagueChip, leagueMark, twChips, seriesText, segmented, liveLine, fieldNow, podium, sideLogo, f1Brief, fillF1Brief, f1Live, watchLink, withWatch, watchButton, sessionTag, raceFlag, audioName, personPic } from './ui.js';
import { followButton, openMatch, openFieldEvent, openTie, openTeam, openPlayer, openConstructor, constructorBadge, standingsTables, zhLater } from './sheets.js';
import { f1Driver, f1Constructor, teamLogo } from '#kit/logos.mjs';

// ---- What's on: leagues with games from two weeks back to two months on ---------------
//
// A league out of season (or a tournament not being played, the Nations
// League between editions) is hidden, and a sport with none left with it. Checked
// once and kept on the device for 12 hours.
const ACTIVE_KEY = 'fx.active.v2';
// The copies of before (v1, fx.day.v3), which could hold a failed read as "no games", go.
try {
  for (const k of ['fx.active.v1', 'fx.day.v3']) localStorage.removeItem(k);
} catch {}
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
  home: { date: today(), filter: 'all', shown: 20, teams: new Map(), tables: {}, sportDays: new Map(), autoDay: true, tablesPending: 0, settled: false },
  scores: { sport: 'soccer', league: 'epl', date: null, byDay: null, days: [], extra: 0, loading: false, mode: 'days', stage: 'all', view: 'games' },
};

const q = quadraSession('match', { lang: locale });
Object.assign(ctx, { t, locale, state, q, openEvent, openTeam, openPlayer, isFollowed, toggleFollow, track, isFollowedEvent, isFollowedGame, toggleFollowGame });

// ---- What the person follows (on the pass) ---------------------------------------------

// `leagues`: the person's leagues, in their order (the first counts most).
function applyPrefs(payload) {
  try {
    const p = payload ? JSON.parse(payload) : null;
    if (p) state.prefs = { leagues: (p.leagues || []).filter(k => LEAGUES[k]), follows: p.follows || [], games: p.games || [], audio: p.audio === 'zh' ? 'zh' : 'en' };
  } catch {}
  // Only the leagues Orbit Sports has; an NBA team with NBA.com's logo, as everywhere.
  state.prefs.games = keptGames(state.prefs.games);
  state.prefs.follows = state.prefs.follows.filter(f => LEAGUES[f.league]).map(f => (f.league === 'nba' && !f.athlete ? { ...f, logo: teamLogo('nba', f.name) } : f));
  state.prefsLoaded = true;
}
// The sports of the person's leagues, in the leagues' order.
const followedSports = () => [...new Set(state.prefs.leagues.map(k => LEAGUES[k].sport))];
let saveTimer = 0;
function savePrefs() {
  clearTimeout(saveTimer);
  const { leagues, follows, games, audio } = state.prefs;
  saveTimer = setTimeout(() => {
    q.write({ payload: JSON.stringify({ v: 4, leagues, follows, games: keptGames(games), audio, t: Date.now() }), wallet: followsPatch() }).catch(() => {});
  }, 800);
}
// What the person follows and opens, on the pass too (`follows:match`,
// `aff:match`): Quadra Play recommends from it, and apps on a phone's home
// screen don't share storage. Leagues in order; teams as [league, name].
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
  const had = setting(state.wallet, 'follows:match', null);
  if (JSON.stringify(had) === JSON.stringify(followsValue()) && sessionStorage.getItem('fx.followsSynced')) return;
  q.write({ wallet: followsPatch() })
    .then(() => sessionStorage.setItem('fx.followsSynced', '1'))
    .catch(() => {});
}
// A followed team's name as shown (kept in English on the pass).
const shownName = f => (f.athlete ? (f.league === 'f1' && locale !== 'en' ? f1Driver(f.name).zh || f.name : f.name) : f.f1team === true ? (locale === 'en' ? f.name : f1Constructor(f.name).zh || f.name) : localSide(f.league, { name: f.name }).name);
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
const slimSide = x => (x ? { id: String(x.id ?? ''), name: x.name, short: x.short, en: x.en, abbr: x.abbr, logo: x.logo, color: x.color } : x);
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
function isFollowedEvent(e) {
  if (isFollowedGame(e)) return true;
  if (e.kind === 'match') return followedTeams().some(f => f.league === e.league && (f.id === e.home?.id || f.id === e.away?.id));
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

// 我的設定: everything the person picks, in one sheet: the sports in order,
// their leagues, who they follow and the commentary they like.
function openFollowEditor() {
  const s = sheet(L({ zh: '我的設定', en: 'My settings' }));
  const pickChip = (on, text, onclick) => el('button', { class: `q-chip${on ? ' on' : ''}`, type: 'button', 'aria-pressed': String(on), text, onclick });
  const paint = () => {
    const p = state.prefs;
    put(
      s.body,
      el('h3', { class: 'section-h', text: t('yourLeagues') }),
      el('p', { class: 'section-sub', text: L({ zh: '排在前面的聯賽先出現。', en: 'The first ones show first.' }) }),
      p.leagues.length
        ? el(
            'ol',
            { class: 'order-list' },
            p.leagues.map((k, i) =>
              el('li', {}, [
                el('span', { class: 'order-n num', text: String(i + 1) }),
                leagueMark(k, 'lg-mark sm'),
                el('span', { class: 'order-name', text: leagueName(k, locale) }),
                el('button', { class: 'icon-btn', type: 'button', 'aria-label': t('moveUp'), disabled: i === 0 ? true : null, text: '↑', onclick: () => (moveLeague(k, -1), paint()) }),
                el('button', { class: 'icon-btn', type: 'button', 'aria-label': t('moveDown'), disabled: i === p.leagues.length - 1 ? true : null, text: '↓', onclick: () => (moveLeague(k, 1), paint()) }),
                el('button', { class: 'icon-btn', type: 'button', 'aria-label': t('unfollow'), text: '✕', onclick: () => (toggleLeague(k), paint()) })
              ])
            )
          )
        : el('p', { class: 'muted small', text: t('noLeaguesYet') }),
      ...shownSports()
        .map(sp => [sp, shownLeaguesOf(sp).filter(k => !p.leagues.includes(k))])
        .filter(([, ks]) => ks.length)
        .map(([sp, ks]) => el('div', { class: 'league-pick' }, [el('p', { class: 'mini-h', text: L(SPORTS[sp]) }), el('div', { class: 'q-chips wrap' }, ks.map(k => pickChip(false, `+ ${leagueName(k, locale)}`, () => (toggleLeague(k), paint()))))])),
      el('h3', { class: 'section-h', text: L({ zh: '追蹤的球隊與選手', en: 'Teams and players you follow' }) }),
      p.follows.length
        ? el('ul', { class: 'order-list' }, p.follows.map((f, i) => el('li', {}, [f.athlete ? personPic(f, f.league, 'sm round') : f.f1team === true ? constructorBadge(f.name, 'sm') : logo(f.logo, f.name, 'sm'), el('span', { class: 'order-name', text: `${shownName(f)} · ${leagueName(f.league, locale)}` }), el('button', { class: 'icon-btn', type: 'button', 'aria-label': t('moveUp'), disabled: i === 0 ? true : null, text: '↑', onclick: () => (moveFollow(i, -1), paint()) }), el('button', { class: 'icon-btn', type: 'button', 'aria-label': t('unfollow'), text: '✕', onclick: () => (toggleFollow(f.league, f), paint()) })])))
        : el('p', { class: 'muted small', text: t('teamsHint') }),
      el('h3', { class: 'section-h', text: t('tvAudio') }),
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
      el('p', { class: 'section-sub', text: t('tvAudioHint') })
    );
  };
  paint();
}

// ---- Opening things ------------------------------------------------------------------------

function openEvent(e) {
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
// is while everyone sleeps, and isn't recommended on either day. Unless it's
// worth staying up for (nightWorthy): a play-off, a final or a series game
// (an MLB wild-card decider at 02:00), or a followed team's; that one counts
// on its own day, at its hour. A big game of the small hours is only among
// the other picks (nightOnly), never 今日推薦; a followed team's can be.
const AWAKE_FROM = 5;
const nightWorthy = e => bigGame(e) || isFollowedEvent(e);
// A race weekend's practice: in 賽事 and the race's sheet, never among 首頁's picks or days.
const practice = e => /^FP\d$/.test(e.sessionKey || '');
const nightOnly = e => new Date(Date.parse(e.start)).getHours() < AWAKE_FROM && !isFollowedEvent(e);
const inDay = (ms, date) => ms >= Date.parse(`${date}T00:00:00`) && ms < Date.parse(`${addDays(date, 1)}T00:00:00`);
const inPickDay = (ms, date) => ms >= Date.parse(`${date}T${String(AWAKE_FROM).padStart(2, '0')}:00:00`) && ms < Date.parse(`${addDays(date, 1)}T00:00:00`);

// A day's events of these leagues (races split into their sessions).
// `current`: each league's current scoreboard (what's on now) instead of the day's dates.
const rawDays = new Map();
async function readDay(leagues, date, { current = false } = {}) {
  const dates = espnDaysOf(date);
  const isToday = date === today();
  // A league that couldn't be read is counted, never taken for "no games".
  let failed = 0;
  const miss = () => (failed++, []);
  const lists = await Promise.all(
    leagues.map(k => {
      const l = LEAGUES[k];
      // A race weekend: what's on that day (ESPN's dated page lists the
      // events running then); the other sources' lists are the season's anyway.
      if (l.kind !== 'match') return (isToday ? scoreboard(k) : l.espn ? scoreboard(k, dates) : seasonEvents(k)).catch(miss);
      // Soccer by its dated pages even for what's on now: a cup's current page can be a round long past.
      return scoreboard(k, l.espn && (!current || l.sport === 'soccer') ? dates : undefined).catch(miss);
    })
  );
  if (leagues.length && failed === leagues.length) throw new Error('unread');
  const now = Date.now();
  const raw = lists
    .flat()
    .flatMap(e => (e.sessions ? splitWeekend(e, now, locale) : [e]))
    .map(e => (e.sessions ? settleField(e, now) : e))
    .map(e => (e.at ? { ...e, start: e.at } : e));
  // Everything read, by the clock (直播 wants the small hours too).
  const kept = rawDays.get(date) || new Map();
  for (const e of raw) kept.set(`${e.league}:${e.id}:${e.sessionKey || ''}`, e);
  rawDays.set(date, kept);
  // Results are the whole day's: a game in the small hours that's over (or
  // any of a past day's) counts for its day, it just wasn't one to wake up for.
  const past = date < today();
  const out = raw.filter(e => (isToday && e.status.state === 'in') || inPickDay(Date.parse(e.start), date) || (inDay(Date.parse(e.start), date) && nightWorthy(e)) || ((past || e.status.state === 'post') && inDay(Date.parse(e.start), date)) || (!e.sessionKey && e.kind !== 'match' && e.status.state !== 'post' && e.end && Date.parse(e.start) <= Date.parse(`${date}T23:59:59`) && Date.parse(e.end) >= Date.parse(`${date}T00:00:00`)));
  out.failed = failed;
  return out;
}
function repaintDay(date) {
  paintStatus();
  renderTabs();
  if (state.tab === 'home' && state.home.date === date) renderHome();
  if (state.tab === 'live' && (date === today() || date === addDays(today(), 1))) renderLive();
}
async function loadDay(date) {
  const slot = state.days.get(date) || { events: [], at: 0, loading: false };
  if (slot.loading) return;
  slot.loading = true;
  state.days.set(date, slot);
  const isToday = date === today();
  loadTables();
  const key = leaguesKey();
  let retry = false;
  try {
    const events = await readDay(pickLeagues(), date);
    // Some leagues unread: what came is shown (with what was there of the
    // others), and the day is read again shortly.
    const kept = events.failed ? [...events, ...slot.events.filter(e => !events.some(x => x.league === e.league))] : events;
    if (isToday) noticeChanges(kept);
    Object.assign(slot, { events: kept, at: Date.now(), stale: false, leagues: key, partial: events.failed || 0 });
    if (isToday && !events.failed) saveDay(date, slot);
    retry = events.failed > 0;
  } catch {
    // Nothing read: the last copy stays, and it's tried again shortly.
    Object.assign(slot, { at: slot.at || Date.now(), stale: false, leagues: key, partial: pickLeagues().length });
    retry = true;
  } finally {
    slot.loading = false;
  }
  if (retry && (slot.retries = (slot.retries || 0) + 1) <= 4) setTimeout(() => loadDay(date), 4000 * slot.retries);
  else if (!retry) slot.retries = 0;
  // The follows changed while reading: read again for them.
  if (key !== leaguesKey()) return loadDay(date);
  // The others (and the rest) again too, once they've been read for this day;
  // today's rest in any case (every league's games on now, for 直播's badge
  // and 首頁's live games), a moment after the first read.
  if (slot.othersAt) loadOthers(date);
  if (slot.restAt && (state.tab === 'live' || Date.now() - slot.restAt > 120_000)) loadRest(date);
  else if (!slot.restAt && isToday && !slot.restLoading) setTimeout(() => !slot.restAt && loadRest(date), 2500);
  loadFollowedTeams();
  repaintDay(date);
  if (isToday) {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(syncPush, 1500);
  }
}
async function loadOthers(date) {
  const slot = state.days.get(date);
  if (!slot || slot.othersLoading) return;
  slot.othersLoading = true;
  try {
    slot.others = await readDay(otherLeagues().slice(0, 24), date);
  } catch {
    slot.others = slot.others || [];
  } finally {
    slot.othersLoading = false;
    slot.othersAt = Date.now();
  }
  repaintDay(date);
}
// Every other league, for 直播: what's on now anywhere, not only in the
// followed and televised leagues (the others above). Each one's current
// scoreboard, read once 直播 is open.
function restLeagues() {
  const have = new Set([...pickLeagues(), ...otherLeagues().slice(0, 24)]);
  return Object.keys(LEAGUES).filter(k => !have.has(k));
}
async function loadRest(date) {
  const slot = state.days.get(date);
  if (!slot || slot.restLoading) return;
  slot.restLoading = true;
  try {
    slot.rest = await readDay(restLeagues(), date, { current: true });
  } catch {
    slot.rest = slot.rest || [];
  } finally {
    slot.restLoading = false;
    slot.restAt = Date.now();
  }
  repaintDay(date);
}
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
      standings(k)
        .then(g => {
          state.home.tables[k] = tableIndex(g);
          if (state.tab === 'home' && state.days.get(state.home.date)?.at) renderHome();
          if (state.tab === 'following') renderFollowing();
        })
        .catch(() => {})
        .finally(() => state.home.tablesPending--);
    });
}
// Followed teams' schedules (their next and last games).
// Read again while the app stays open (an iPhone keeps it for hours in the
// background): every 10 minutes, every 2 while one of its games is on or
// due to end. Until then a game's state comes from the live scoreboards
// (freshGame), so a game over is never left 'on'.
const teamsAt = new Map();
const TEAM_MS = 10 * 60_000;
const teamDue = list => (list || []).some(e => e.status?.state === 'in' || (e.status?.state === 'pre' && Date.parse(e.start) < Date.now()));
async function loadFollowedTeams() {
  for (const f of followedTeams().slice(0, 12)) {
    const key = `${f.league}:${f.id}`;
    if (LEAGUES[f.league]?.kind !== 'match') continue;
    const had = state.home.teams.get(key);
    if (state.home.teams.has(key) && (had === null || teamsAt.get(key) === 'loading' || Date.now() - (teamsAt.get(key) || 0) < (teamDue(had) ? 2 * 60_000 : TEAM_MS))) continue;
    if (!had) state.home.teams.set(key, null);
    teamsAt.set(key, 'loading');
    // ESPN's team schedule; the other leagues' own season, the team's games.
    (hasTeams(f.league) ? teamSchedule(f.league, f.id) : seasonEvents(f.league).then(list => list.filter(e => e.home?.id === String(f.id) || e.away?.id === String(f.id)).sort((a, b) => a.start.localeCompare(b.start))))
      .then(list => {
        teamsAt.set(key, Date.now());
        state.home.teams.set(key, list);
        if (state.tab === 'home') renderHome();
        if (state.tab === 'following') renderFollowing();
        clearTimeout(pushTimer);
        pushTimer = setTimeout(syncPush, 1500);
      })
      .catch(() => {
        teamsAt.delete(key);
        if (!had) state.home.teams.delete(key);
      });
  }
}
// Followed teams' coming games, for notices while the app is closed: the
// start, and the final score (the Worker checks ESPN after the game's usual
// length).
function syncPush() {
  const now = Date.now();
  const items = [];
  const seen = new Set();
  // The live scoreboards' copy of a game first (the schedules are minutes older).
  const games = [...(state.days.get(today())?.events || []).filter(isFollowedEvent), ...followedGames(), ...followedTeams().flatMap(f => state.home.teams.get(`${f.league}:${f.id}`) || [])].map(freshGame);
  for (const e of games) {
    const key = `${e.league}:${e.id}`;
    if (e.kind !== 'match' || e.other || seen.has(key) || e.status?.state === 'post' || e.status?.void) continue;
    seen.add(key);
    const start = Date.parse(e.start);
    if (!(start > now - 4 * 3_600_000 && start < now + 8 * 86_400_000)) continue;
    const league = leagueName(e.league, locale);
    // Its start only when it's on TV here (where, in the notice); its final score in any case.
    if (start > now && (onTv(e) || isFollowedGame(e))) items.push({ at: start, title: matchLine(e), body: startLine(e), tag: `start:${key}`, hash: 'live', kind: 'start' });
    // The Worker fills in the score (the title) and who won ({result}) once ESPN has the final.
    if (LEAGUES[e.league].espn && /^\d+$/.test(e.id)) items.push({ at: Math.max(now + 60_000, start + (DURATION[LEAGUES[e.league].sport] || 150) * 60_000), title: matchLine(e), body: `${league} · {result}`, tag: `end:${key}`, hash: 'home', kind: 'end', check: { espn: LEAGUES[e.league].espn, event: e.id, names: [e.away.short || e.away.name, e.home.short || e.home.name] } });
  }
  // A followed race weekend: each qualifying, sprint and race starting, and
  // the sprint's and the race's result (the Worker reads the podium off ESPN's day).
  for (const e of followedGames()) {
    if (e.kind !== 'field' || !['Qual', 'SR', 'Race'].includes(e.sessionKey) || e.status.state === 'post') continue;
    const start = Date.parse(e.official || e.start);
    if (!(start > now - 4 * 3_600_000 && start < now + 8 * 86_400_000)) continue;
    const title = `${e.name} · ${e.session}`;
    if (start > now && e.status.state === 'pre') items.push({ at: start, title, body: startLine(e), tag: `start:${e.league}:${e.id}`, hash: 'live', kind: 'start' });
    if (e.sessionKey !== 'Qual' && LEAGUES[e.league].espn && /^\d+$/.test(String(e.weekend)))
      items.push({ at: Math.max(now + 60_000, start + (e.sessionKey === 'Race' ? 100 : 40) * 60_000), title, body: `${leagueName(e.league, locale)} · {result}`, tag: `end:${e.league}:${e.id}`, hash: 'home', kind: 'end', check: { espn: LEAGUES[e.league].espn, event: String(e.weekend), session: e.sessionKey, day: new Date(start).toISOString().slice(0, 10).replaceAll('-', '') } });
  }
  schedulePush(q, items);
}

// A notice's words: the teams (and the score) on top, the league and what
// happened below.
const NOTICE_TEXT = { start: { zh: '開賽了', en: 'game started' } };
// "MLB 美國職棒 開賽了 · 愛爾達1台": the league, and where it's on.
const startLine = e => [`${leagueName(e.league, locale)} ${L(NOTICE_TEXT.start)}`, channelsOf(e)[0]?.short[locale === 'en' ? 'en' : 'zh']].filter(Boolean).join(' · ');
// Who won, for the final's notice: "Yankees 贏了", or a draw.
function resultLine(e) {
  if (e.status?.void) return L({ zh: '比賽取消', en: 'Canceled' });
  const [a, h] = [Number(e.away.score), Number(e.home.score)];
  if (!Number.isFinite(a) || !Number.isFinite(h)) return L({ zh: '比賽結束', en: 'Final' });
  if (a === h) return L({ zh: '平手', en: 'Draw' });
  const w = a > h ? e.away : e.home;
  return locale === 'en' ? `${w.short || w.name} win` : `${w.short || w.name} 贏了`;
}
const matchLine = (e, score = false) => (score ? `${e.away.short || e.away.name} ${e.away.score} : ${e.home.score} ${e.home.short || e.home.name}` : `${e.away.short || e.away.name} vs ${e.home.short || e.home.name}`);

// A followed team's game starting or ending: a notice.
const lastState = new Map();
function noticeChanges(events) {
  for (const e of events) {
    if (e.kind !== 'match' || !isFollowedEvent(e)) continue;
    const key = `${e.league}:${e.id}`;
    const was = lastState.get(key);
    lastState.set(key, e.status.state);
    if (!was || was === e.status.state) continue;
    const league = leagueName(e.league, locale);
    if (e.status.state === 'in' && (onTv(e) || isFollowedGame(e))) notify(q, { title: matchLine(e), body: startLine(e), tag: `start:${key}`, hash: 'live', kind: 'start' });
    if (e.status.state === 'post') notify(q, { title: matchLine(e, true), body: `${league} · ${resultLine(e)}`, tag: `end:${key}`, hash: 'home', kind: 'end' });
  }
}

// A sideways row of chips scrolled so the chosen one sits in the middle
// (the row only, never the page).
function centerChosen(box) {
  // A date strip the person scrolled stays where they left it (dateStrip).
  for (const row of box.querySelectorAll('.day-strip')) if (row.keepLeft != null) row.scrollLeft = row.keepLeft;
  for (const chip of box.querySelectorAll('.q-chips [aria-pressed="true"], .segmented [aria-pressed="true"]')) {
    const row = chip.parentElement;
    if (row.keepLeft != null) continue;
    if (row.scrollWidth > row.clientWidth) row.scrollLeft = chip.offsetLeft - row.offsetLeft - row.clientWidth / 2 + chip.clientWidth / 2;
  }
}

// ---- 推薦: every match of the chosen day, ranked for this person ---------------------------

const REASON = r => t(`why_${r}`);
function pickCard(item, n) {
  const e = item.event;
  const reasons = item.reasons.slice(0, 2).map(r => REASON(r));
  const tag = stageOf(e).special ? (stageOf(e).round?.[locale === 'en' ? 'en' : 'zh'] || stageOf(e)[locale === 'en' ? 'en' : 'zh']) : '';
  const series = seriesText(e);
  return el('button', { class: `pick-card${e.status.state === 'in' ? ' live' : ''}`, type: 'button', onclick: () => openEvent(e) }, [
    el('div', { class: 'pick-time' }, [
      el('strong', { class: 'num', text: e.status.state === 'in' ? '●' : e.status.state === 'post' ? t('final') : clock(shownStart(e)) }),
      el('small', { text: e.status.state === 'in' ? statusText(e) : n === 0 ? t('firstUp') : '' })
    ]),
    el('div', { class: 'pick-body' }, [
      el('div', { class: 'pick-top' }, [leagueChip(e.league), tag ? el('span', { class: 'stage-tag', text: tag }) : null]),
      e.kind === 'match' ? el('div', { class: 'card-sides' }, [sideLine(e.away, e, false), sideLine(e.home, e, false)]) : el('div', { class: 'sess-head pick-title' }, [raceFlag(e), sessionTag(e), el('strong', { text: e.sessionKey || !e.session ? e.name : `${e.name} · ${e.session}` })]),
      series ? el('small', { class: 'series-line', text: series }) : null,
      liveLine(e),
      e.league === 'f1' && e.status.state === 'in' ? f1Brief(e) : e.kind !== 'match' && e.status.state === 'in' && fieldNow(e) ? el('small', { class: 'live-line', text: fieldNow(e) }) : podium(e),
      reasons.length ? el('div', { class: 'why-row' }, reasons.map(r => el('span', { class: 'why', text: r }))) : null,
      e.status.state === 'post' ? null : twChips(e.league, 2, e)
    ])
  ]);
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
function dayChip(d, current, onPick) {
  const dt = new Date(`${d}T12:00:00`);
  const other = dt.getFullYear() !== new Date().getFullYear();
  const first = dt.getDate() === 1;
  return el('button', { class: `q-chip day${d === today() ? ' is-today' : ''}${first ? ' month-start' : ''}`, type: 'button', 'aria-pressed': String(d === current), 'data-day': d, onclick: () => onPick(d) }, [
    el('span', { text: d === today() ? t('today') : d === addDays(today(), 1) ? t('tomorrow') : d === addDays(today(), -1) ? t('yesterday') : dt.toLocaleDateString(locale === 'en' ? 'en-US' : 'zh-TW', { weekday: 'short' }) }),
    el('small', { class: 'num', text: other ? `${String(dt.getFullYear()).slice(2)}/${dt.getMonth() + 1}/${dt.getDate()}` : `${dt.getMonth() + 1}/${dt.getDate()}` })
  ]);
}
// `range`: the stretch of days shown (home's own by default; 賽事 keeps one
// per league), and the person's own scroll of it (`held`, at `left`).
function dateStrip(current, onPick, { only = null, range = stripRange } = {}) {
  if (current && !only) reach(current, range);
  // A day picked: the strip is centred on it again.
  const pickDay = d => ((range.held = false), onPick(d));
  const row = el('div', { class: 'q-chips day-strip' }, stripDays(current, { only, range, base: today() }).map(d => dayChip(d, current, pickDay)));
  // Scrolled by the person: a repaint (a day or a team read, the live
  // refresh) keeps it where they left it (centerChosen), not back on the day.
  row.keepLeft = range.held ? range.left : null;
  for (const ev of ['pointerdown', 'touchstart', 'wheel']) row.addEventListener(ev, () => (range.held = true), { passive: true });
  row.addEventListener('scroll', () => row.isConnected && row.clientWidth && range.held && (range.left = row.scrollLeft), { passive: true });
  // Any day: the browser's own date picker.
  const pick = el('input', { class: 'day-pick-input', type: 'date', 'aria-label': L({ zh: '選擇日期', en: 'Pick a date' }), value: current || today() });
  pick.addEventListener('change', () => {
    if (!pick.value) return;
    reach(pick.value, range);
    pickDay(pick.value);
  });
  const cal = el('label', { class: 'q-chip day-pick', title: L({ zh: '選擇日期', en: 'Pick a date' }) }, [el('span', { class: 'day-pick-icon', 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M7.5 13.5h2M11 13.5h2M14.5 13.5h2M7.5 17h2M11 17h2"/></svg>' }), pick]);
  return el('div', { class: 'day-strip-wrap' }, [row, cal]);
}
// A league's game days this season (Taipei dates): Shared-Data's nightly
// sports/<league>/days.json (small; the season across both year packs), a
// league without one (CPBL) from its own season. Read once a session; null
// until read (the days read so far stand in), a failed read asked again later.
const seasonDays = new Map();
function leagueDays(league, then) {
  if (!seasonDays.has(league)) {
    seasonDays.set(league, null);
    const own = () => seasonEvents(league).then(list => list.filter(e => !e.status?.void).map(e => localDate(Date.parse(e.start))));
    const read = LEAGUES[league].espn && kit.packJson ? kit.packJson(`sports/${league}/days.json`, { ttl: 12 * 3_600_000 }).then(d => d?.days || []) : own();
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

const ENDED_PICKS = { zh: '已結束的推薦', en: 'Picks that ended' };
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
    put(box, homeHead(), spinner());
    centerChosen(box);
    return;
  }
  const now = Date.now();
  const pctx = { leagues: state.prefs.leagues, follows: state.prefs.follows, games: state.prefs.games.map(gameKey), tables: h.tables, aff: affinity(null, now, ['match']), now };
  const past = h.date < today();
  // The picks of a list: the plan and the rest (a past day ranked as it
  // stood before, shown with the real results).
  const rank = (list, also = 999, ctx = pctx, before = past) => {
    const asBefore = l => (before ? l.map(e => ({ ...e, status: { ...e.status, state: 'pre' } })) : l);
    const { plan, also: awake } = dayPlan(asBefore(list.filter(e => !nightOnly(e))), ctx, { n: 6, also });
    // The small hours' big games: with the rest, by their score.
    const { also: night } = dayPlan(asBefore(list.filter(nightOnly)), ctx, { n: 0, also });
    const rest = [...awake, ...night].sort((x, y) => y.score - x.score).slice(0, also);
    const real = new Map(list.map(e => [`${e.league}:${e.id}`, e]));
    const fix = items => items.map(x => ({ ...x, event: real.get(`${x.event.league}:${x.event.id}`) || x.event }));
    return [fix(plan), fix(rest)];
  };
  // Only what's on TV in Taiwan is recommended (賽事 has every game), a game
  // over too: a result is among the picks only if it was on. Only where it
  // can't be known (before the days ELTA's list reaches) is any result kept.
  // A match followed on its own shows whether or not it's on TV here: the person asked for it.
  const shown = e => !practice(e) && (isFollowedGame(e) || onTv(e) || ((e.status.state === 'post' || past) && !tvKnown(e)));
  const mine = slot.events.filter(shown);
  let [planList, more] = rank(filtered(mine));
  // Nothing of theirs on: the best of the rest.
  // Opened on a day with nothing of theirs: the next day they have games
  // (only on a fresh read: a saved or half-read day can't say there's none).
  if (!planList.length && h.filter === 'all' && h.autoDay && h.date === today() && state.prefs.leagues.length && !slot.stale && !slot.loading && !mine.some(e => e.status.state === 'in' || e.status.state === 'post')) {
    h.autoDay = false;
    h.jumping = true;
    nextPickDay().then(d => {
      h.jumping = false;
      if (d && state.home.date === today()) {
        state.home.date = d;
        stripRange.held = false;
        if (state.tab === 'home') renderHome();
      }
    });
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
  const isToday = h.date === today();
  // Today's picks that have ended (the picks only look ahead): the day
  // ranked as it stood before, as on a past day, and what of it was on
  // show (the plan and the first of the rest) that's over now.
  const ended = x => x.event.status.state === 'post' && !x.event.status.void;
  const [wasPlan, wasMore] = isToday ? (fallback && !filtered(mine).some(e => e.status.state === 'post') ? rank(slot.others.filter(shown), 12, { ...pctx, sports: [], leagues: [] }, true) : rank(filtered(mine), 999, pctx, true)) : [[], []];
  const endedPlan = wasPlan.filter(ended);
  // A few of the rest, not the whole day's results (賽事 has those).
  const endedMore = wasMore.slice(0, 20).filter(ended).slice(0, 4);
  // 正在進行: today's games on now, first on 首頁 (theirs; with none of
  // theirs on, the best of everything on now), ranked like the picks, and
  // taken out of the lists below so no game shows twice.
  const onNow = list => list.filter(e => e.status.state === 'in' && !e.status.void);
  const rankLive = (list, c) => list.map(e => ({ event: e, ...scoreMatch(e, c) })).sort((x, y) => y.score - x.score);
  let liveItems = isToday ? rankLive(onNow(filtered(mine)), pctx) : [];
  const liveMine = liveItems.length > 0;
  if (isToday && !liveItems.length && h.filter === 'all') liveItems = rankLive(onNow(dayAll(slot).filter(e => !practice(e) && onTv(e))), { ...pctx, sports: [], leagues: [] }).filter(x => x.score >= 0.3);
  const allLive = isToday ? onNow(dayAll(slot)).filter(onTv).length : 0;
  const liveShown = liveItems.slice(0, liveMine ? 5 : 3);
  const liveKeys = new Set(liveShown.map(x => `${x.event.league}:${x.event.id}`));
  planList = planList.filter(x => !liveKeys.has(`${x.event.league}:${x.event.id}`));
  more = more.filter(x => !liveKeys.has(`${x.event.league}:${x.event.id}`));
  const liveBlock = liveShown.length
    ? section(`● ${t('liveNow')}`, el('div', { class: 'q-card list live-strip' }, [...liveShown.map(x => withWatch(eventRow(x.event), x.event)), allLive > liveShown.length ? el('button', { class: 'live-strip-more', type: 'button', text: `${L({ zh: `全部 ${allLive} 場直播`, en: `All ${allLive} live` })} ›`, onclick: () => showTab('live') }) : null]), { sub: liveMine ? '' : L({ zh: '你追蹤的比賽都還沒開打，先看看這些', en: 'Nothing you follow is on yet: these are' }), cls: 'live-now' })
    : null;
  // Followed teams that play today, with that game (the rest are on 追蹤).
  const teamRows = isToday
    ? state.prefs.follows.flatMap(f => {
        const list = (state.home.teams.get(`${f.league}:${f.id}`) || []).map(freshGame);
        const e = list.find(x => localDate(Date.parse(x.start)) === h.date);
        if (!e) return [];
        return el('div', { class: 'follow-row' }, [
          el('button', { class: 'follow-team', type: 'button', onclick: () => (f.athlete ? openPlayer(f.league, f.id) : openTeam(f.league, f.id, f)) }, [f.athlete ? personPic(f, f.league, 'sm round') : logo(f.logo, f.name, 'sm'), el('span', { text: shownName(f) })]),
          eventRow(e, { league: false })
        ]);
      })
    : [];
  const hasFollows = state.prefs.leagues.length > 0;
  // A first pick keeps the picker up for the next ones (in order), until 完成.
  if (!hasFollows && state.prefsLoaded) h.picking = true;
  // Everything the picks lean on is in: the day read fresh, the tables,
  // the followed teams, and no search for other games or days going on.
  h.settled = !slot.stale && !slot.loading && !finding && !h.jumping && !h.tablesPending && ![...h.teams.values()].includes(null);
  const shownMore = more.slice(0, h.shown);
  put(
    box,
    homeHead(),
    !hasFollows || h.picking ? sportPicker() : null,
    liveBlock,
    (fallback || finding) && !endedPlan.length && !endedMore.length ? el('div', { class: 'q-card pad none-mine' }, [el('strong', { text: slot.partial ? t('someUnread') : hasFollows ? t(isToday ? 'noMineToday' : 'noMineDay') : t('noFollowsYet') }), el('p', { class: 'muted small', text: finding ? t('findingOthers') : planList.length ? t('othersSub') : noTvText(h.date) }), !finding && !planList.length ? fullSchedule() : null]) : null,
    finding ? spinner() : null,
    planList.length
      ? section(fallback ? t('othersPicks') : isToday ? t('todayPicks') : `${dayLabel(h.date)} · ${past ? L(ENDED_PICKS) : t('picksOn')}`, el('div', { class: 'pick-list' }, planList.map((x, i) => pickCard(x, i))), { sub: fallback ? '' : t('recsN', { n: planList.length + more.length }) })
      : finding || fallback || liveBlock ? null : section(t('todayPicks'), el('div', { class: 'q-card pad none-mine' }, [el('p', { class: 'muted small', text: h.filter === 'all' ? noTvText(h.date) : t('noPicksMine') }), fullSchedule()])),
    shownMore.length
      ? section(t('moreRecs'), el('div', { class: 'q-card list' }, shownMore.map(x => eventRow(x.event))), {
          action: null
        })
      : null,
    more.length > h.shown ? el('button', { class: 'q-btn block show-more', type: 'button', text: `${t('showMore')} (${more.length - h.shown})`, onclick: () => ((h.shown += 30), renderHome()) }) : null,
    endedPlan.length || endedMore.length
      ? section(L(ENDED_PICKS), el('div', { class: 'ended-picks' }, [endedPlan.length ? el('div', { class: 'pick-list' }, endedPlan.map((x, i) => pickCard(x, i))) : null, endedMore.length ? el('div', { class: 'q-card list' }, endedMore.map(x => eventRow(x.event))) : null]))
      : null,
    teamRows.length ? section(t('yourTeams'), el('div', { class: 'q-card list' }, teamRows), { action: moreButton(t('seeAll'), () => showTab('following')) }) : null
  );
  centerChosen(box);
  // An F1 session on: its live timing read now, not at the next tick.
  if (!f1Live.feed && box.querySelector('[data-f1-brief]')) pollF1Live();
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
const fullSchedule = () => el('button', { class: 'section-more none-go', type: 'button', text: `${L({ zh: '看完整賽程', en: 'Every game' })} ›`, onclick: () => showTab('matches') });
function homeHead() {
  const h = state.home;
  // Still picking (a newcomer, until 完成): the welcome, and no sport filter yet.
  const hasFollows = state.prefs.leagues.length > 0 && !h.picking;
  const sport = SPORTS[h.filter] ? h.filter : null;
  const days = sport ? h.sportDays.get(sport) : null;
  return el('div', {}, [
    el('div', { class: 'home-hero' }, [
      el('div', {}, [el('p', { class: 'hero-kicker', text: dayLabel(h.date, { long: true }) }), el('h2', { class: 'hero-title', text: hasFollows ? t(h.date === today() ? 'heroTitle' : 'heroTitleDay') : t('heroTitleNew') })]),
      el('button', { class: 'q-btn small', type: 'button', text: hasFollows ? t('editFollows') : t('pickSports'), onclick: openFollowEditor })
    ]),
    hasFollows ? sportChips() : null,
    // One sport: only the days it plays (read first, then shown).
    sport && !days
      ? el('div', { class: 'day-strip-wait' }, [el('div', { class: 'spinner small' }), el('span', { class: 'muted small', text: t('findingDays') })])
      : sport && !days.size
        ? el('p', { class: 'muted small no-days', text: t('noSportDays', { sport: L(SPORTS[sport]) }) })
        : dateStrip(
            h.date,
            d => {
              h.date = d;
              h.shown = 20;
              h.autoDay = false;
              renderHome();
            },
{ only: days }
          )
  ]);
}
// Every followed sport as a filter, whether it plays today or not: picking
// one keeps the date strip to the days it plays and goes to the nearest.
function sportChips() {
  const h = state.home;
  const filters = [['all', t('f_all')], ...(state.prefs.follows.length ? [['teams', t('f_teams')]] : []), ...followedSports().filter(isActiveSport).map(sp => [sp, L(SPORTS[sp])])];
  if (filters.length < 3) return null;
  return el(
    'div',
    { class: 'q-chips small filter-chips' },
    filters.map(([k, label]) => el('button', { class: 'q-chip', type: 'button', 'aria-pressed': String(h.filter === k), text: label, onclick: () => ((stripRange.held = false), pickFilter(k)) }))
  );
}
// A sport's days read (again): one with a league unread is read again (15
// seconds on), keeping the days it had (a day never drops off the strip
// because a league failed once).
const needDays = sp => {
  const had = state.home.sportDays.get(sp);
  return !had || (had.failed && Date.now() - had.at > 15_000);
};
async function readSportDays(sp) {
  const h = state.home;
  const days = await sportDays(sp).catch(() => null);
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
    if (e.status?.void || practice(e) || !(onTv(e) || (e.status?.state === 'post' && !tvKnown(e)))) continue;
    const ms = Date.parse(e.start);
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
  return el('div', { class: 'sport-picker' }, [
    el('div', { class: 'sp-head' }, [el('strong', { text: L({ zh: '從喜歡的運動開始', en: 'Start with what you like' }) }), el('small', { class: 'muted', text: L({ zh: '依喜好順序點選，第一個最優先', en: 'Tap in order: the first counts most' }) })]),
    el(
      'div',
      { class: 'suggest-grid sport-grid' },
      Object.entries(SPORTS)
        .filter(([k]) => isActiveSport(k))
        .map(([k, sp]) => {
          const i = mine.indexOf(k);
          const all = leaguesOf(k).sort((a, b) => Boolean(LEAGUES[b].top) - Boolean(LEAGUES[a].top));
          const names = all.slice(0, 4).map(x => leagueName(x, locale).replace(/\s.*$/, '')).join(locale === 'en' ? ', ' : '、') + (all.length > 4 ? L({ zh: ` 等 ${all.length} 個聯賽`, en: ` and ${all.length - 4} more` }) : '');
          return el('button', { class: `suggest sport-tile${i >= 0 ? ' on' : ''}`, type: 'button', 'aria-pressed': String(i >= 0), onclick: () => toggleSport(k) }, [
            el('span', { class: 'sport-marks' }, all.slice(0, 3).map(x => leagueMark(x))),
            el('span', { class: 'suggest-name' }, [el('strong', { text: L(sp) }), el('small', { class: 'muted', text: names })]),
            el('b', { class: `suggest-add${i >= 0 ? ' sport-n num' : ''}`, text: i >= 0 ? String(i + 1) : '+' })
          ]);
        })
    ),
    mine.length ? el('button', { class: 'q-btn primary block sp-done', type: 'button', text: L({ zh: `完成（已選 ${mine.length} 項）`, en: `Done (${mine.length} picked)` }), onclick: () => ((state.home.picking = false), renderHome()) }) : null
  ]);
}

// ---- 直播: what's on now, and what starts in the next hours ------------------------------------

// A day's events: the followed leagues' and, once read, the others' and the rest's.
function dayAll(slot) {
  const seen = new Set();
  return [...(slot?.events || []), ...(slot?.others || []), ...(slot?.rest || [])].filter(e => !seen.has(`${e.league}:${e.id}`) && seen.add(`${e.league}:${e.id}`));
}
function renderLive() {
  const box = $('panel-live');
  const slot = state.days.get(today());
  if (!slot?.at || !tvReady()) {
    if (!slot?.loading && !slot?.at) loadDay(today());
    put(box, spinner());
    return;
  }
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
  const live = all.filter(e => e.status.state === 'in').sort((a, b) => Boolean(LEAGUES[b.league]?.top) - Boolean(LEAGUES[a.league]?.top));
  // Nothing on: the next 24 hours, so tomorrow's too.
  const tomorrow = addDays(today(), 1);
  const next = state.days.get(tomorrow);
  if (!next?.at && !next?.loading) loadDay(tomorrow);
  else if (next?.at && !next.othersAt && !next.othersLoading) loadOthers(tomorrow);
  const reading = !next?.at || !slot.othersAt || !next.othersAt;
  const ahead = all;
  const window = (live.length ? 3 : 24) * 3_600_000;
  const soon = ahead.filter(e => e.status.state === 'pre' && !e.status.void && Date.parse(e.start) - now < window && Date.parse(e.start) > now - 15 * 60_000).sort((a, b) => a.start.localeCompare(b.start));
  // Finished in the last few hours (by start: a game's end isn't known), latest first.
  const ended = all.filter(e => e.status.state === 'post' && !e.status.void && Date.parse(e.start) > now - 8 * 3_600_000).sort((a, b) => b.start.localeCompare(a.start));
  const mineFirst = list => [...list].sort((a, b) => isFollowedEvent(b) - isFollowedEvent(a));
  // A game on now: its row, and 觀看 beside it (straight into ELTA.tv's or Apple TV's app).
  const liveRow = e => withWatch(eventRow(e), e);
  // The next to start (a followed team's if one is within the hour of the first).
  const first = soon[0];
  const nextUp = first && (soon.find(e => isFollowedEvent(e) && Date.parse(e.start) - Date.parse(first.start) < 3_600_000) || first);
  const wait = nextUp ? Math.max(0, Date.parse(nextUp.start) - now) : 0;
  const waitText = wait < 60_000 ? L({ zh: '馬上', en: 'any minute' }) : wait < 3_600_000 ? L({ zh: `${Math.round(wait / 60_000)} 分鐘後`, en: `in ${Math.round(wait / 60_000)} min` }) : L({ zh: `${Math.floor(wait / 3_600_000)} 小時 ${Math.round((wait % 3_600_000) / 60_000)} 分後`, en: `in ${Math.floor(wait / 3_600_000)} h ${Math.round((wait % 3_600_000) / 60_000)} min` });
  const hero = live.length
    ? el('div', { class: 'home-hero' }, [el('div', {}, [el('p', { class: 'hero-kicker live-kicker', text: t('liveNow') }), el('h2', { class: 'hero-title', text: `${live.length} ${locale === 'en' ? 'live' : '場進行中'}` })])])
    : el('div', { class: 'home-hero live-idle' }, [
        el('div', {}, [
          el('p', { class: 'hero-kicker', text: t('liveEmpty') }),
          nextUp ? el('h2', { class: 'hero-title', text: L({ zh: `下一場 ${waitText}`, en: `Next one ${waitText}` }) }) : reading ? null : el('h2', { class: 'hero-title', text: L({ zh: '接下來一天沒有比賽', en: 'Nothing in the next day' }) })
        ])
      ]);
  put(
    box,
    hero,
    !live.length && nextUp ? el('div', { class: 'q-card list' }, [liveRow(nextUp)]) : null,
    !live.length && !nextUp && reading ? spinner() : null,
    live.length ? section(L({ zh: '直播中', en: 'Live now' }), el('div', { class: 'q-card list' }, mineFirst(live).map(liveRow))) : null,
    ended.length && !live.length ? section(L({ zh: '剛結束', en: 'Just ended' }), el('div', { class: 'q-card list' }, mineFirst(ended).slice(0, 12).map(e => eventRow(e)))) : null,
    soon.filter(e => e !== nextUp || live.length).length ? section(live.length ? t('startingSoon') : L({ zh: '接下來 24 小時', en: 'Next 24 hours' }), el('div', { class: 'q-card list' }, (live.length ? mineFirst(soon) : soon.filter(e => e !== nextUp)).slice(0, 30).map(e => eventRow(e)))) : null,
    ended.length && live.length ? section(L({ zh: '剛結束', en: 'Just ended' }), el('div', { class: 'q-card list' }, mineFirst(ended).slice(0, 8).map(e => eventRow(e)))) : null,
    tvGuide(all)
  );
}
// ---- 愛爾達's guide -------------------------------------------------------------------------
//
// Every showing on ELTA.tv's channels (its own list, about two weeks), the
// same game on several channels as one, and after the list NBA.com's ELTA
// games (channel to come). A showing reads short: the time, the league, the
// two sides (or the event), one detail (the round or stage), and each
// channel with its commentary.
const AUDIO_SHORT = { en: { zh: '英', en: 'EN' }, dual: { zh: '雙語', en: 'Dual' }, venue: { zh: '中', en: 'ZH' }, local: { zh: '雙語', en: 'ZH×2' }, zh: { zh: '中', en: 'ZH' } };
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
    el('button', { class: 'tvg-body', type: 'button', disabled: e ? null : true, onclick: () => e && openEvent(e) }, [
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
// On 直播: what's on now and the next few, with the whole guide a tap away.
function tvGuide(events) {
  const now = Date.now();
  const items = guideItems();
  const list = items.filter(p => p.end > now).slice(0, 6);
  if (!list.length) return null;
  return section(L({ zh: '愛爾達轉播表', en: 'ELTA TV guide' }), el('div', { class: 'q-card list tv-guide' }, list.map(p => guideRow(p, events, now))), {
    action: moreButton(L({ zh: '完整轉播表 ›', en: 'Full guide ›' }), () => openGuide(events))
  });
}
// The whole guide, a day at a time.
function openGuide(events) {
  const s = sheet(L({ zh: '愛爾達轉播表', en: 'ELTA TV guide' }));
  const items = guideItems();
  const days = [...new Set(items.map(p => localDate(p.start)))].filter(d => d >= today());
  let day = days[0];
  const paint = () => {
    const now = Date.now();
    const list = items.filter(p => localDate(p.start) === day && (day !== today() || p.end > now));
    put(
      s.body,
      el('div', { class: 'q-chips tvg-days' }, days.map(d => el('button', { class: `q-chip${d === day ? ' on' : ''}`, type: 'button', 'aria-pressed': String(d === day), text: dayLabel(d), onclick: () => ((day = d), paint()) }))),
      list.length ? el('div', { class: 'q-card list tv-guide' }, list.map(p => guideRow(p, events, now))) : el('p', { class: 'muted small', text: L({ zh: '這天沒有節目。', en: 'Nothing that day.' }) }),
      el('p', { class: 'section-sub', text: L({ zh: '愛爾達公布的節目表約兩週；之後的 NBA 依 NBA.com，頻道待公布。需訂閱 ELTA.tv。', en: "ELTA publishes about two weeks; NBA games after that are NBA.com's, channel to come. Needs ELTA.tv." }) })
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
const hasBracket = k => LEAGUES[k]?.kind === 'match' && !LEAGUES[k].asia && Boolean(FORMATS[k]);
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
async function playoffData(league) {
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
  brackets.set(league, { ...(had || {}), loading: true });
  playoffData(league)
    .then(d => brackets.set(league, { model: playoffModel({ league, ...d }), at: Date.now() }))
    .catch(() => {
      brackets.set(league, { model: had?.model || null, at: Date.now(), failed: true });
      setTimeout(() => state.tab === 'matches' && state.scores.league === league && state.scores.view === 'bracket' && renderScores(), 61_500);
    })
    .finally(() => state.tab === 'matches' && state.scores.league === league && renderScores());
}
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
function playoffView(model, league) {
  const en = locale === 'en';
  const banner =
    model.mode === 'projected'
      ? el('p', { class: 'po-banner' }, [el('strong', { text: en ? 'Predicted' : '預測' }), document.createTextNode(en ? ' from the table as it stands: it changes until the playoffs start.' : '　依目前排名推算，開打前會變動。')])
      : model.mode === 'last'
        ? el('p', { class: 'po-banner' }, [el('strong', { text: en ? 'Last season' : '上季' }), document.createTextNode(`${model.season ? ` ${model.season}` : ''}${en ? ': this season’s playoffs haven’t begun.' : '　本季季後賽尚未開打。'}`)])
        : null;
  const stateText = r => (r.state === 'done' ? (en ? 'Done' : '已完成') : r.state === 'live' ? (en ? 'On now' : '進行中') : roundDates(r) || (en ? 'TBD' : '待定'));
  const sideRow = (s, t, i) => {
    const id = s ? String(s.id) : '';
    const seed = t.projected ? t.seeds?.[i] : s?.seed;
    const label = t.projected ? t.labels?.[i] : '';
    const score = !t.projected && s ? t.score?.[id] : undefined;
    return el('div', { class: `br-side${t.winner ? (t.winner === id ? ' win' : ' out') : ''}${s ? '' : ' tbd'}` }, [
      el('span', { class: 'br-seed num', text: seed ? String(seed) : '' }),
      s ? sideLogo(s, league, 'xs') : el('span', { class: 'logo xs br-tbd-logo', 'aria-hidden': 'true' }),
      el('span', { class: 'br-name', text: s ? s.short || s.name : label || (en ? 'TBD' : '待定') }),
      el('strong', { class: 'num br-score', text: score ?? '' })
    ]);
  };
  const note = (t, r) => {
    if (!t) return roundDates(r) ? `${en ? 'Expected' : '預計'} ${roundDates(r)}` : en ? 'To be decided' : '待定';
    if (t.projected) return [t.labels?.find(Boolean) && t.sides.every(Boolean) ? t.labels.filter(Boolean).join(' v ') : '', en ? 'Predicted' : '預測'].filter(Boolean).join(' · ');
    const won = t.winner && t.sides.find(s => String(s.id) === t.winner);
    if (won) return `${won.short || won.name} ${en ? 'through' : '晉級'}`;
    if (t.live) return en ? 'On now' : '進行中';
    if (t.next) return `${t.kind === 'series' ? `G${t.games.indexOf(t.next) + 1} · ` : ''}${dayLabel(localDate(Date.parse(t.next.start)))} ${clock(t.next.start)}`;
    return t.kind === 'agg' ? (en ? 'Aggregate' : '總比分') : '';
  };
  const tie = (t, r) => {
    const blank = { projected: true, seeds: [], labels: [] };
    const body = [sideRow(t?.sides[0] || null, t || blank, 0), sideRow(t?.sides[1] || null, t || blank, 1), el('small', { class: `br-note${t?.live ? ' live' : ''}`, text: note(t, r) })];
    return t && !t.projected
      ? el('button', { class: `br-tie${t.live ? ' live' : ''}`, type: 'button', onclick: () => openTie({ ...t, games: t.games.map(freshGame) }, league, en ? r.title.en : r.title.zh) }, body)
      : el('div', { class: `br-tie ${t ? 'projected' : 'tbd'}` }, body);
  };
  const entry = brackets.get(league);
  const fade = entry && !entry.shown;
  if (entry) entry.shown = true;
  const map = el(
    'div',
    { class: 'bracket' },
    model.rounds.map(r => el('section', { class: `br-col ${r.state}` }, [el('div', { class: 'br-head' }, [el('strong', { text: en ? r.title.en : r.title.zh }), el('small', { text: stateText(r) })]), el('div', { class: 'br-ties' }, r.ties.map(t => tie(t, r)))]))
  );
  // Opened on the round that's on (or next), not always the first.
  const at = openRound(model) - 1;
  if (at > 0) requestAnimationFrame(() => map.isConnected && (map.scrollLeft = map.children[at]?.offsetLeft - map.offsetLeft - 16));
  return el('div', { class: `playoffs${fade ? ' fade-in' : ''}` }, [banner, map]);
}
// Its shape while it's read: the round chips and four ties in grey.
const bracketShape = () =>
  el('div', { class: 'playoffs waiting', 'aria-hidden': 'true' }, [el('div', { class: 'bracket' }, [4, 2, 1].map(n => el('section', { class: 'br-col' }, [el('div', { class: 'br-head' }, [el('i', { class: 'skel' }), el('i', { class: 'skel skel-short' })]), el('div', { class: 'br-ties' }, Array.from({ length: n }, () => el('div', { class: 'br-tie tbd' }, [el('i', { class: 'skel' }), el('i', { class: 'skel' }), el('i', { class: 'skel skel-short' })])))])))]);

async function loadScores() {
  const sc = state.scores;
  const league = sc.league;
  const key = `${league}|${sc.extra}`;
  sc.loadingKey = key;
  sc.loading = true;
  // A new league: its own stretch of days on the strip.
  if (sc.rangeOf !== league) (sc.range = { from: STRIP.from, to: STRIP.to }), (sc.rangeOf = league);
  renderScores();
  track([`league:${leagueKey(league)}`], 0.3);
  let events = [];
  try {
    events = await fetchScores(sc);
  } catch {
    if (sc.loadingKey === key) sc.byDay = 'failed';
    // Asked again once the kit stops holding the failure (a minute), if it's still in view.
    setTimeout(() => state.scores === sc && sc.loadingKey === key && sc.byDay === 'failed' && loadScores(), 61_000);
  }
  if (sc.loadingKey !== key) return;
  sc.loading = false;
  if (sc.byDay !== 'failed' || events.length) {
    applyScores(sc, events);
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
  renderScores();
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
  sc.days = [...byDay.keys()].sort();
}
// A day picked on the strip or the 📅: shown at once; a day not read yet (an
// ESPN league's, far from now) is read first.
async function pickScoresDay(d) {
  const sc = state.scores;
  sc.date = d;
  sc.picked = true;
  const l = LEAGUES[sc.league];
  if (sc.byDay instanceof Map && !sc.byDay.has(d) && l.espn && sc.mode === 'days') {
    renderScores();
    const at = Date.parse(`${d}T12:00:00`);
    // Its US days: the one before, the day, and the one after.
    const us = [-1, 0, 1].map(k => yyyymmdd(new Date(at + k * 86_400_000)));
    const events = await scoreboard(sc.league, us).catch(() => []);
    if (state.scores !== sc) return;
    const byId = new Map((sc.all || []).map(e => [e.id, e]));
    for (const e of events) byId.set(e.id, e);
    applyScores(sc, [...byId.values()]);
    // Another day picked meanwhile: that one's on screen.
    if (sc.date !== d) return;
  }
  renderScores();
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

// The search box stays put (it keeps its focus and caret while typing); the
// rest of the page is drawn under it.
let scoresBody = null;
let clearSearch = () => {};
function scoresShell() {
  const panel = $('panel-matches');
  if (scoresBody?.isConnected) return scoresBody;
  const input = el('input', { class: 'fx-search-input', type: 'search', inputmode: 'search', enterkeyhint: 'search', autocomplete: 'off', placeholder: t('searchPlaceholder'), 'aria-label': t('searchPlaceholder') });
  const clear = el('button', { class: 'fx-search-clear', type: 'button', 'aria-label': t('close'), text: '×', hidden: true });
  let timer = 0;
  const go = () => {
    state.scores.q = input.value.trim();
    clear.hidden = !input.value;
    clearTimeout(timer);
    // Asked once typing pauses, not at every letter (each would be a read of its own).
    timer = setTimeout(() => (state.scores.q ? runSearch(state.scores.q) : renderScores()), 450);
  };
  input.addEventListener('input', go);
  clear.addEventListener('click', () => {
    input.value = '';
    go();
    input.focus();
  });
  clearSearch = () => {
    input.value = '';
    clear.hidden = true;
    clearTimeout(timer);
    input.blur();
  };
  scoresBody = el('div', { class: 'scores-body' });
  put(panel, el('div', { class: 'fx-search' }, [el('span', { class: 'fx-search-icon', 'aria-hidden': 'true', text: '🔍' }), input, clear]), scoresBody);
  return scoresBody;
}

// Search: leagues by name, then ESPN's teams and players (a Chinese query is
// read in English first: "洋基" finds the Yankees).
let searchSeq = 0;
async function runSearch(query, again = false) {
  const box = scoresShell();
  const seq = ++searchSeq;
  const leagues = findLeagues(query);
  const paint = (found, busy) =>
    put(
      box,
      leagues.length ? section(t('leagues'), el('div', { class: 'q-card list' }, leagues.slice(0, 8).map(k => el('button', { class: 'search-row', type: 'button', onclick: () => openScores(k) }, [leagueMark(k, 'lg-mark mid'), el('span', { text: leagueName(k, locale) }), el('small', { text: L(SPORTS[LEAGUES[k].sport]) })])))) : null,
      found?.teams.length ? section(t('teamsFound'), el('div', { class: 'q-card list' }, found.teams.slice(0, 10).map(x => el('button', { class: 'search-row', type: 'button', onclick: () => openTeam(x.league, x.id, x) }, [logo(x.logo, x.name, 'sm'), el('span', { text: localSide(x.league, { name: x.name }).name }), el('small', { text: leagueName(x.league, locale) })])))) : null,
      found?.players.length ? section(t('playersFound'), el('div', { class: 'q-card list' }, found.players.slice(0, 10).map(x => el('button', { class: 'search-row', type: 'button', onclick: () => openPlayer(x.league, x.id) }, [personPic(x, x.league, 'sm round'), el('span', { text: x.name }), el('small', { text: leagueName(x.league, locale) })])))) : null,
      busy
        ? spinner()
        : found?.failed
          ? el('div', { class: 'empty' }, [el('p', { class: 'muted', text: t('searchFailed') }), el('button', { class: 'q-btn small', type: 'button', text: t('retry'), onclick: () => runSearch(query) })])
          : !leagues.length && !found?.teams.length && !found?.players.length
            ? empty(t('noResults'))
            : null
    );
  // One letter: leagues only (ESPN's search answers nothing for one).
  if ([...query].length < 2) return paint({ teams: [], players: [] }, false);
  paint(null, true);
  let q = query;
  if (/[\u3400-\u9fff]/.test(query)) q = await translate(query, 'en', 'zh-TW').catch(() => query);
  // A search that couldn't be read says so (never "nothing matches"), and is asked again once a little later.
  const found = await searchEspn(q).catch(() => ({ teams: [], players: [], failed: true }));
  if (seq !== searchSeq || state.scores.q !== query) return;
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
  return el('button', { class: `q-card wk-card${live ? ' live' : ''}${done ? ' done' : ''}`, type: 'button', onclick: () => openEvent(race) }, [
    el('div', { class: 'wk-card-head' }, [raceFlag(e, 'big'), el('div', { class: 'wk-card-text' }, [el('strong', { class: 'wk-card-name', text: e.name }), el('small', { class: 'muted', text: [e.venue, days].filter(Boolean).join(' · ') })])]),
    winner
      ? el('div', { class: 'wk-winner' }, [personPic(winner, e.league, 'sm round'), el('span', {}, [el('small', { class: 'muted', text: L({ zh: '冠軍', en: 'Winner' }) }), el('strong', { text: winner.short || winner.name })])])
      : el(
          'div',
          { class: 'wk-sessions' },
          list.map(x => {
            const kind = { Race: 'race', Qual: 'qual', SR: 'sprint', SS: 'sq', SQ: 'sq' }[x.sessionKey] || 'other';
            return el('div', { class: `wk-row ${kind}${x.status.state === 'in' ? ' live' : ''}${x.status.state === 'post' ? ' done' : ''}`, onclick: ev => (ev.stopPropagation(), openEvent(x)) }, [
              el('span', { class: 'wk-time num' }, [el('small', { text: dayLabel(localDate(Date.parse(x.start))) }), document.createTextNode(clock(shownStart(x)))]),
              el('span', { class: 'wk-name' }, [sessionTag(x)]),
              el('span', { class: `wk-state ${x.status.state}`, text: x.status.state === 'post' ? t('final') : x.status.state === 'in' ? t('live') : '' })
            ]);
          })
        )
  ]);
}

function renderScores() {
  const sc = state.scores;
  if (sc.q) return runSearch(sc.q);
  // A sport or league with nothing on now: the first one that has.
  if (activeSet && !isActive(sc.league)) {
    const sport = isActiveSport(sc.sport) ? sc.sport : shownSports()[0];
    const league = shownLeaguesOf(sport).find(k => LEAGUES[k].top) || shownLeaguesOf(sport)[0];
    if (league) {
      state.scores = { ...sc, sport, league, date: null, picked: false, byDay: null, days: [], extra: 0, stage: 'all', view: hasStandings(league) ? sc.view : 'games' };
      return loadScores();
    }
  }
  const box = scoresShell();
  const mineSports = followedSports();
  const sports = shownSports().sort((a, b) => mineSports.includes(b) - mineSports.includes(a) || mineSports.indexOf(a) - mineSports.indexOf(b));
  const sportChips = el(
    'div',
    { class: 'q-chips sport-chips' },
    sports.map(key =>
      el('button', {
        class: 'q-chip',
        type: 'button',
        'aria-pressed': String(sc.sport === key),
        text: L(SPORTS[key]),
        onclick: () => {
          const first = followedLeagues().find(k => LEAGUES[k].sport === key && isActive(k)) || shownLeaguesOf(key).find(k => LEAGUES[k].top) || shownLeaguesOf(key)[0];
          state.scores = { ...sc, sport: key, league: first, date: null, picked: false, byDay: null, days: [], extra: 0, stage: 'all', touched: true, view: hasStandings(first) ? sc.view : 'games' };
          loadScores();
        }
      })
    )
  );
  const mine = new Set(state.prefs.leagues);
  const leagueChips = el(
    'div',
    { class: 'q-chips small' },
    shownLeaguesOf(sc.sport)
      .sort((a, b) => mine.has(b) - mine.has(a))
      .map(k => el('button', { class: 'q-chip', type: 'button', 'aria-pressed': String(sc.league === k), onclick: () => ((state.scores = { ...sc, league: k, season: null, date: null, picked: false, byDay: null, days: [], extra: 0, stage: 'all', touched: true, view: hasStandings(k) || sc.view === 'bracket' ? sc.view : 'games' }), loadScores()) }, [leagueMark(k), leagueName(k, locale)]))
  );
  let strip = null;
  let list;
  let stages = null;
  loadBracket(sc.league);
  // Every league with playoffs has the tab from the start (its shape while it's read).
  const po = brackets.get(sc.league);
  const rounds = po?.model?.rounds || [];
  const reading = hasBracket(sc.league) && !po?.model;
  const poFailed = reading && po?.failed && !po.loading;
  const knockView = sc.view === 'bracket' && hasBracket(sc.league) && (rounds.length > 0 || reading);
  const tableView = !knockView && sc.view === 'table' && hasStandings(sc.league);
  if (knockView) list = rounds.length ? playoffView(po.model, sc.league) : poFailed ? empty(t('failed')) : bracketShape();
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
    strip = dateStrip(sc.date, pickScoresDay, { only, range: sc.range });
    const order = { in: 0, pre: 1, post: 2 };
    const games = [...(sc.byDay.get(sc.date) || [])].sort((a, b) => order[a.status.state] - order[b.status.state] || a.start.localeCompare(b.start));
    // The season's stages on show (preseason, playoffs, a cup…), as a filter.
    const keys = [...new Set((sc.all || []).map(e => stageOf(e).key).filter(Boolean))];
    if (keys.length > 1) {
      stages = segmented([['all', t('f_all')], ...keys.map(k => [k, stageOf((sc.all || []).find(e => stageOf(e).key === k))[locale === 'en' ? 'en' : 'zh']])], sc.stage, v => ((sc.stage = v), renderScores()), 'scroll stage-filter');
    }
    const shown = sc.stage === 'all' ? games : games.filter(e => stageOf(e).key === sc.stage);
    // A football league's day: its matchweek (第 6 輪, or 第 6–7 輪 across a postponed game).
    const weeks = [...new Set(shown.map(e => weekOf(e, () => state.tab === 'matches' && renderScores())).filter(Boolean))].sort((a, b) => a - b);
    const wk = weeks.length ? L({ zh: `第 ${weeks[0]}${weeks.length > 1 ? `–${weeks.at(-1)}` : ''} 輪`, en: `Matchweek ${weeks[0]}${weeks.length > 1 ? `–${weeks.at(-1)}` : ''}` }) : '';
    list = el('div', {}, [el('p', { class: 'day-head', text: [dayLabel(sc.date, { long: true }), wk, t('gamesN', { n: shown.length })].filter(Boolean).join(' · ') }), shown.length ? el('div', { class: 'q-card list' }, shown.map(e => eventRow(e, { league: false, day: false }))) : empty(t('noGames'))]);
  }
  // The league: its logo and name, where its season is, what's on now,
  // following it, and where to watch it in Taiwan.
  const all = sc.all || [];
  const liveN = all.filter(e => e.status.state === 'in').length;
  const nextUp = all.filter(e => e.status.state !== 'post').sort((a, b) => a.start.localeCompare(b.start))[0];
  const stage = nextUp && stageOf(nextUp).special ? stageOf(nextUp)[locale === 'en' ? 'en' : 'zh'] : '';
  const tools = el('div', { class: 'q-card league-head' }, [
    el('div', { class: 'lh-row' }, [
      leagueMark(sc.league, 'lg-mark big'),
      el('div', { class: 'lh-text' }, [el('strong', { text: leagueName(sc.league, locale) }), stage || liveN ? el('small', {}, [stage ? el('span', { class: 'stage-tag', text: stage }) : null, liveN ? el('span', { class: 'lh-live', text: `● ${t('liveN', { n: liveN })}` }) : null]) : null]),
      followButton(() => mine.has(sc.league), () => (toggleLeague(sc.league), renderScores()), t('followLeague'))
    ]),
    twChips(sc.league, 3)
  ]);
  const viewList = [['games', t('schedule')], ...(hasStandings(sc.league) ? [['table', t('table')]] : []), ...(rounds.length || reading ? [['bracket', LEAGUES[sc.league].cup ? L({ zh: '淘汰賽', en: 'Knockouts' }) : L({ zh: '季後賽', en: 'Playoffs' })]] : [])];
  const views = viewList.length > 1 ? segmented(viewList, knockView ? 'bracket' : tableView ? 'table' : 'games', v => ((sc.view = v), renderScores()), 'views') : null;
  const other = tableView || knockView;
  put(box, sportChips, leagueChips, tools, views, other ? null : strip, other ? null : stages, list);
  centerChosen(box);
}

const searchEspn = q => proxyJson(`https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(q)}&limit=12`, { ttl: 10 * 60_000 }).then(parseSearch);

// ---- 追蹤: what you follow, at a glance ------------------------------------------------------
//
// 我的轉播 first: every game of a followed team (and every F1 session, with a
// driver or an F1 team followed) on TV in the next week, by day, 觀看 on the
// one that's on; then each team: its place, form, next game (when, where it's
// on) and last result; the drivers; the leagues (their games and tables in
// 賽事). Nothing followed yet: popular teams of the leagues on TV, a tap each.
const TV_DAYS = 7;
const SUGGEST = [
  ['mlb', '19', 'Los Angeles Dodgers'], ['mlb', '10', 'New York Yankees'], ['cpbl', 'CTBC Brothers'], ['cpbl', 'Rakuten Monkeys'],
  ['nba', '13', 'Los Angeles Lakers'], ['nba', '9', 'Golden State Warriors'], ['nba', '2', 'Boston Celtics'],
  ['epl', '359', 'Arsenal'], ['epl', '382', 'Manchester City'], ['epl', '364', 'Liverpool'], ['mls', '20232', 'Inter Miami CF']
].map(([league, id, name = id]) => ({ league, id, name }));

// F1's season (every weekend), read once for 追蹤.
let f1Season = null;
function f1Races() {
  if (f1Season === null) {
    f1Season = undefined;
    seasonEvents('f1')
      .then(list => (f1Season = list || []))
      .catch(() => (f1Season = []))
      .then(() => state.tab === 'following' && renderFollowing());
  }
  return f1Season || [];
}
const teamGames = f => state.home.teams.get(`${f.league}:${f.id}`)?.map(freshGame);
// The followed teams' (and F1's) games on TV in the next week, live first, by start.
function myTvGames() {
  const now = Date.now();
  const fresh = new Map(dayAll(state.days.get(today())).map(e => [`${e.league}:${e.id}`, e]));
  const games = followedTeams().flatMap(f => teamGames(f) || []).map(e => fresh.get(`${e.league}:${e.id}`) || e);
  const f1 = state.prefs.follows.some(f => f.league === 'f1') ? f1Races().flatMap(e => splitWeekend(e, now, locale)).filter(e => e.sessionKey) : [];
  const seen = new Set();
  return [...games, ...f1]
    .filter(e => !e.status?.void && e.status?.state !== 'post' && Date.parse(e.start) > now - 4 * 3_600_000 && Date.parse(e.start) < now + TV_DAYS * 86_400_000)
    .filter(e => onTv(e) && !seen.has(`${e.league}:${e.id}`) && seen.add(`${e.league}:${e.id}`))
    .sort((a, b) => (b.status.state === 'in') - (a.status.state === 'in') || a.start.localeCompare(b.start));
}
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
        L({ zh: '追蹤的比賽', en: 'Matches you follow' }),
        el('div', { class: 'q-card list followed-games' }, games.map(e => el('div', { class: 'fg-row' }, [withWatch(eventRow(e), e), el('button', { class: 'fg-off', type: 'button', 'aria-label': L({ zh: '取消追蹤這場', en: 'Unfollow this match' }), text: '★', onclick: () => toggleFollowGame(e) })]))),
        { sub: gamesNote(games) }
      )
    : null;
  if (!teams.length && !people.length) {
    put(
      box,
      el('div', { class: 'home-hero' }, [el('div', {}, [el('h2', { class: 'hero-title', text: L({ zh: '追蹤球隊和選手', en: 'Follow teams and players' }) }), el('p', { class: 'muted small', text: L({ zh: '他們的下一場、在哪一台轉播、戰績和排名，都在這裡。先從熱門球隊開始：', en: 'Their next game, where it is on, form and place, all here. Start with these:' }) })])]),
      gamesBlock,
      el('div', { class: 'suggest-grid' }, SUGGEST.map(suggestCard)),
      followedLeagues().length ? leaguesBlock() : null
    );
    return;
  }
  const tv = myTvGames();
  const byDay = new Map();
  for (const e of tv) {
    const d = e.status.state === 'in' ? today() : localDate(Date.parse(e.start));
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(e);
  }
  const waiting = !tvReady() || [...state.home.teams.values()].includes(null);
  put(
    box,
    el('div', { class: 'follow-head' }, [
      el('div', {}, [el('h2', { class: 'hero-title', text: t('tab_following') }), el('p', { class: 'muted small', text: [L({ zh: `${teams.length} 隊`, en: `${teams.length} teams` }), people.length ? L({ zh: `${people.length} 位選手`, en: `${people.length} players` }) : '', L({ zh: `${p.leagues.length} 個聯賽`, en: `${p.leagues.length} leagues` })].filter(Boolean).join(' · ') })]),
      el('button', { class: 'q-btn small', type: 'button', text: L({ zh: '管理', en: 'Manage' }), onclick: openFollowEditor })
    ]),
    gamesBlock,
    section(
      L({ zh: '我的轉播', en: 'On TV for you' }),
      tv.length
        ? el('div', { class: 'stack' }, [...byDay].map(([d, list]) => el('div', {}, [el('p', { class: 'day-head', text: dayLabel(d, { long: true }) }), el('div', { class: 'q-card list' }, list.map(e => withWatch(eventRow(e), e)))])))
        : waiting
          ? spinner()
          : el('p', { class: 'muted small follow-hint', text: L({ zh: `接下來 ${TV_DAYS} 天，你追蹤的球隊沒有轉播。`, en: `Nothing you follow is on TV in the next ${TV_DAYS} days.` }) }),
      { sub: L({ zh: `你追蹤的球隊接下來 ${TV_DAYS} 天在愛爾達、Apple TV 的比賽`, en: `Your teams on ELTA and Apple TV, the next ${TV_DAYS} days` }) }
    ),
    teams.length ? section(t('yourTeams'), el('div', { class: 'q-card list team-form-list' }, teams.map(f => (f.f1team === true ? crewRow(f) : teamCard(f))))) : null,
    people.length ? section(t('yourPlayers'), el('div', { class: 'q-card list team-form-list' }, people.map(personRow))) : null,
    followedLeagues().length ? leaguesBlock() : null
  );
}
// A popular team, followed with a tap.
function suggestCard(s) {
  const on = isFollowed(s.league, s.id);
  const logoUrl = fallbackLogo(s.league, { id: s.id, name: s.name });
  return el('button', { class: `suggest${on ? ' on' : ''}`, type: 'button', onclick: () => toggleFollow(s.league, { id: s.id, name: s.name, en: s.name, logo: logoUrl }) }, [
    logo(logoUrl, s.name, 'sm'),
    el('span', { class: 'suggest-name' }, [el('strong', { text: localSide(s.league, { name: s.name }).name }), el('small', { class: 'muted', text: leagueName(s.league, locale) })]),
    el('b', { class: 'suggest-add', text: on ? '✓' : '+' })
  ]);
}
// The followed leagues: their games and tables in 賽事.
const leaguesBlock = () =>
  section(
    L({ zh: '你的聯賽', en: 'Your leagues' }),
    el('div', { class: 'q-card list' }, followedLeagues().map(k => el('div', { class: 'league-card-head' }, [leagueMark(k), el('strong', { text: leagueName(k, locale) }), el('button', { class: 'section-more', type: 'button', text: t('tab_matches'), onclick: () => openScores(k) }), hasStandings(k) ? el('button', { class: 'section-more', type: 'button', text: t('table'), onclick: () => openScores(k, null, 'table') }) : null])))
  );

// A followed team at a glance: its place and form, its next game (when, where
// it's on, 觀看 while it's on) and last result; its page on a tap.
function teamCard(f) {
  const games = teamGames(f);
  const id = String(f.id);
  const us = g => [g.home, g.away].find(x => String(x?.id) === id);
  const them = g => [g.home, g.away].find(x => x && String(x.id) !== id);
  const result = g => {
    const [a, b] = [us(g), them(g)];
    if (!a || !b) return '';
    if (a.winner || b.winner) return a.winner ? 'W' : 'L';
    return Number(a.score) > Number(b.score) ? 'W' : Number(a.score) < Number(b.score) ? 'L' : 'D';
  };
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
        ? el('span', { class: 'tf-when' }, [el('small', { class: 'num', text: whenText(g.start) }), whereTv(g)])
        : g.status.state === 'in'
          ? el('span', { class: 'num tf-score live', text: `${t('live')} ${us(g)?.score ?? ''}–${opp?.score ?? ''}` })
          : el('span', { class: `num result-pill ${result(g).toLowerCase()}`, text: `${word(result(g))} ${us(g)?.score ?? ''}–${opp?.score ?? ''}` });
    return el('button', { class: 'tf-game', type: 'button', onclick: () => openEvent(g) }, [
      el('small', { class: 'muted tf-k', text: label }),
      opp ? logo(opp.logo, opp.name, 'xs') : el('span'),
      el('span', { class: 'tf-opp', text: opp ? `${g.home && String(g.home.id) === id ? 'vs' : '@'} ${localSide(g.league, opp).name}` : L({ zh: '對手待定', en: 'Opponent to be decided' }) }),
      right
    ]);
  };
  const sub = [leagueName(f.league, locale), place?.pos ? L({ zh: `${place.group || ''}第 ${place.pos} 名`, en: `${place.pos}${['th', 'st', 'nd', 'rd'][place.pos % 10 < 4 && Math.floor(place.pos / 10) !== 1 ? place.pos % 10 : 0]}${place.group ? ` in ${place.group}` : ''}` }) : ''].filter(Boolean).join(' · ');
  return el('div', { class: 'tf-row' }, [
    el('button', { class: 'tf-team', type: 'button', onclick: () => openTeam(f.league, f.id, f) }, [
      logo(f.logo || fallbackLogo(f.league, { id: f.id, name: f.name }), f.name, 'tf-logo'),
      el('span', { class: 'tf-name' }, [el('strong', { text: shownName(f) }), el('small', { class: 'muted', text: sub })]),
      played.length ? el('span', { class: 'form-pills' }, played.slice(-5).map(g => el('span', { class: `pill sm ${result(g)}`, text: word(result(g)) }))) : null
    ]),
    games === null ? el('small', { class: 'muted tf-wait', text: '…' }) : el('div', { class: 'tf-games' }, [line(next, L({ zh: '下一場', en: 'Next' })), line(last, L({ zh: '上一場', en: 'Last' }))]),
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
        el('span', { class: 'tf-when' }, [el('small', { class: 'num', text: whenText(session.start) }), whereTv(session)])
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
  el('button', { class: 'tf-team', type: 'button', onclick: () => openPlayer(f.league, f.id) }, [personPic(f, f.league, 'tf-logo round'), el('span', { class: 'tf-name' }, [el('strong', { text: shownName(f) }), el('small', { class: 'muted', text: sub })]), tag]);
function personRow(f) {
  const got = loadPerson(f);
  const a = got?.a;
  if (f.league === 'f1') return driverRow(f, a);
  const injured = a?.injuries?.[0];
  const head = personHead(f, [a?.team ? localSide(f.league, { name: a.team }).name : f.team ? localSide(f.league, { name: f.team.name }).name : leagueName(f.league, locale), a?.position ? zhLater(a.position) : ''].filter(Boolean).join(' · '), injured ? el('span', { class: 'tf-injury', text: locale === 'en' ? injured : injuryZh(injured) }) : null);
  if (!got) return el('div', { class: 'tf-row' }, [head, el('small', { class: 'muted tf-wait', text: '…' })]);
  // Numbers as tiles: the season's, and the last game's under its result.
  // A tile's name: the Chinese when it's short, else the abbreviation (OPS, not 整體攻擊指數).
  const tileName = label => {
    const name = statName(label, locale);
    return locale === 'en' || name.length <= 4 ? name : label;
  };
  const tiles = list => el('div', { class: 'pf-stats' }, list.map(([v, label]) => el('span', { class: 'pf-stat' }, [el('b', { class: 'num', text: v }), el('small', { text: tileName(label) })])));
  const season = (a?.stats.list || []).slice(0, 4).map(x => [x.value, x.label]);
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
    ? el('button', { class: 'tf-game', type: 'button', onclick: () => openEvent(next) }, [
        el('small', { class: 'muted tf-k', text: L({ zh: '下一場', en: 'Next' }) }),
        opp ? logo(opp.logo, opp.name, 'xs') : el('span'),
        el('span', { class: 'tf-opp', text: opp ? `${String(next.home?.id) === String(teamId) ? 'vs' : '@'} ${localSide(next.league, opp).name}` : '' }),
        next.status.state === 'in' ? el('span', { class: 'num tf-score live', text: t('live') }) : el('span', { class: 'tf-when' }, [el('small', { class: 'num', text: whenText(next.start) }), whereTv(next)])
      ])
    : null;
  return el('div', { class: 'tf-row' }, [
    head,
    el('div', { class: 'tf-games' }, [season.length ? el('div', { class: 'pf-block' }, [el('small', { class: 'muted tf-k', text: L({ zh: '本季', en: 'Season' }) }), tiles(season)]) : null, nextLine, lastLine])
  ]);
}
// A team's game over as a game-log line ({ at, opp, result, score, stats }),
// the player's numbers from `box` when it's in.
function teamGameLine(e, teamId, box) {
  const home = String(e.home?.id) === String(teamId);
  const [us, them] = home ? [e.home, e.away] : [e.away, e.home];
  const [a, b] = [Number(us?.score), Number(them?.score)];
  const result = us?.winner || a > b ? 'W' : them?.winner || b > a ? 'L' : a === b && Number.isFinite(a) ? 'D' : '';
  return { at: home ? 'vs' : '@', opp: { name: them?.en || them?.name || '', abbr: them?.abbr || '', logo: them?.logo || null }, result, score: `${Math.max(a, b)}-${Math.min(a, b)}`, stats: box?.stats || [] };
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
        ? el('button', { class: 'tf-game', type: 'button', onclick: () => openEvent(session) }, [el('small', { class: 'muted tf-k', text: L({ zh: '下一節', en: 'Next' }) }), raceFlag(next), el('span', { class: 'tf-opp', text: [next.name, session.sessionKey ? sessionName({ abbr: session.sessionKey }, locale, true) : session.session].filter(Boolean).join(' · ') }), el('span', { class: 'tf-when' }, [el('small', { class: 'num', text: whenText(session.start) }), whereTv(session)])])
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
function recentOf(league) {
  const since = Date.now() - 3 * 86_400_000;
  const seen = new Set();
  const sc = state.scores;
  const lists = [...[...state.days.values()].map(dayAll), ...(sc.league === league && sc.byDay instanceof Map ? [...sc.byDay.values()] : [])];
  return lists.flat().filter(e => e.league === league && Date.parse(e.start) > since && !seen.has(e.id) && seen.add(e.id));
}
// F1: the race weekends (and sprints) still to run, for the title's maths.
let f1Left = null;
function racesLeft(league) {
  if (league !== 'f1') return null;
  if (f1Left === null) {
    f1Left = undefined;
    seasonEvents(league)
      .then(list => {
        const ahead = (list || []).filter(e => e.sessions?.length);
        const open = abbr => ahead.filter(e => e.sessions.some(x => x.abbr === abbr && x.status?.state !== 'post')).length;
        // The weekends still to come, in order, each with whether it has a sprint (when a title can be settled, by name).
        const weeks = ahead.filter(e => e.sessions.some(x => x.abbr === 'Race' && x.status?.state !== 'post')).sort((a, b) => Date.parse(a.start || a.date || 0) - Date.parse(b.start || b.date || 0)).map(e => ({ name: e.name, sprint: e.sessions.some(x => x.abbr === 'SR' && x.status?.state !== 'post') }));
        f1Left = ahead.length ? { races: open('Race'), sprints: open('SR'), list: weeks } : undefined;
      })
      .catch(() => {})
      .then(() => state.tab === 'matches' && state.scores.league === league && renderScores());
  }
  return f1Left || null;
}
function tableOf(league) {
  const groups = tables.get(league);
  if (groups === undefined) {
    tables.set(league, null);
    standings(league)
      .then(g => tables.set(league, g))
      .catch(() => tables.set(league, []))
      .then(() => state.tab === 'matches' && state.scores.league === league && renderScores());
  }
  if (!groups) return spinner();
  if (!groups.length) return empty(t('noStandings'));
  // The games the official table hasn't counted yet, in; then each table's race.
  const sport = LEAGUES[league].sport;
  const now = liveTable(groups, recentOf(league), sport, { teamOf: side => f1Driver(side.en || side.name).team });
  const races = now.map(g => standingsRace(g, sport, { total: SEASON_GAMES[league] || null, left: racesLeft(league), team: sport === 'racing' && !g.rows.some(r => r.athlete) }));
  return el('div', {}, [
    standingsTables(now, league, { races, many: sport !== 'racing' && now.length > 1 }),
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
    // First time here: the person's first followed league.
    const first = followedLeagues()[0];
    if (!state.scores.touched && !state.scores.byDay && first) state.scores = { ...state.scores, sport: LEAGUES[first].sport, league: first, view: hasStandings(first) ? state.scores.view : 'games' };
    state.scores.byDay ? renderScores() : loadScores();
  }
  if (tab === 'live') renderLive();
  if (tab === 'following') renderFollowing();
  // What's on now, at once rather than at the next beat.
  liveTick();
}
function tabAgain(tab) {
  if (tab === 'home' && state.home.date !== today()) {
    state.home.date = today();
    renderHome();
  }
}
// The refresh button: today (or the day on screen) and the open league again.
async function reloadNow() {
  actions.refresh.disabled = true;
  try {
    await Promise.allSettled([loadDay(state.tab === 'home' ? state.home.date : today()), state.tab === 'matches' ? loadScores() : null]);
  } finally {
    actions.refresh.disabled = false;
    paintStatus();
  }
}

// Live games refresh every 15 seconds while on screen (the proxy keeps live
// scores 10 seconds), at once on coming back to the app or to a tab that
// shows them; today every 2 minutes in any case (so a followed team's start
// and finish are noticed).
const LIVE_MS = 15_000;
function liveTick() {
  if (document.visibilityState !== 'visible' || !q.active) return;
  const day = state.days.get(today());
  // On now, or due to start (its kickoff passed or a minute away): watched as live.
  const live = dayAll(day).some(e => e.status.state === 'in' || (e.status.state === 'pre' && Date.parse(e.start) - Date.now() < 60_000 && Date.now() - Date.parse(e.start) < 3 * 3_600_000));
  const age = Date.now() - (day?.at || 0);
  const onScreen = (state.tab === 'home' && state.home.date === today()) || state.tab === 'live' || state.tab === 'following';
  if (onScreen && live && age > 12_000) loadDay(today());
  else if (age > 120_000) loadDay(today());
  if (state.tab === 'home' && state.home.date !== today() && Date.now() - (state.days.get(state.home.date)?.at || 0) > 10 * 60_000) loadDay(state.home.date);
  if (state.tab === 'matches' && state.scores.byDay instanceof Map && [...state.scores.byDay.values()].flat().some(e => e.status.state === 'in')) loadScores();
  paintStatus();
  renderTabs();
}
setInterval(liveTick, LIVE_MS);
document.addEventListener('visibilitychange', liveTick);

// ELTA's schedule came in: its 📺 channels appear (or go) on the open tab.
let repaintTimer = 0;
knownEvents(() => [...state.days.values()].flatMap(slot => dayAll(slot)));
audioPref(() => state.prefs.audio || 'en');
const repaintOpen = () => {
  clearTimeout(repaintTimer);
  repaintTimer = setTimeout(() => {
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
onTvChange(repaintOpen);

function paintStatus() {
  const at = state.days.get(today())?.at;
  $('status').textContent = at ? t('updated', { time: clock(new Date(at).toISOString()) }) : '';
}
new MutationObserver(() => fitNumbers([...document.querySelectorAll('.mh-score, .team-head h3')])).observe(document.body, { childList: true, subtree: true });

// An F1 session on now: F1's own live timing every 10 seconds, its cards'
// briefs (the top three) filled again in place, never the whole page.
let f1Polling = false;
async function pollF1Live() {
  if (document.visibilityState !== 'visible' || f1Polling) return;
  const on = dayAll(state.days.get(today())).find(e => e.league === 'f1' && e.sessionKey && e.status.state === 'in');
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
}
setInterval(pollF1Live, 10_000);
document.addEventListener('visibilitychange', pollF1Live);

window.__fxStarted = true;
const gated = installGate('match', locale);
watchUpdates({ current: document.querySelector('meta[name="build-version"]')?.content, key: 'quadraFixtures', cachePrefix: 'quadra-fixtures-' });
const actions = topActions(q, { refresh: reloadNow });
renderTabs();
q.on('wallet', w => {
  state.wallet = w;
  if (state.tab === 'home' && state.days.get(state.home.date)?.at) renderHome();
});
q.on('active', live => live && loadDay(today()));

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
  if (tab !== state.tab) showTab(tab);
  else if (hash === 'standings' && tab === 'matches') renderScores();
});
// The loading screen stays up on the picks until they're settled (a few
// seconds at most), so they don't open half-read and reshuffle.
const BOOT_WAIT = 7000;
async function homeReady(until) {
  while (state.tab === 'home' && !state.home.settled && Date.now() < until) await new Promise(r => setTimeout(r, 150));
}
async function boot() {
  const until = Date.now() + BOOT_WAIT;
  // A signed-in device opens at once on what it had: the follows and the
  // day it last read, while the Worker is asked for the fresh ones (the
  // picks wait behind the loading screen for their fresh day).
  const quick = cachedPayload('match');
  // ELTA's schedule, early: the picks and rows read each game's channels from it.
  eltaSchedule();
  if (quick != null) {
    state.wallet = cachedWallet();
    applyPrefs(quick);
    restoreDay();
    if (firstTab() !== 'home') $('loading').hidden = true;
    showTab(firstTab());
    restorePlace();
  }
  const first = await q.start();
  state.wallet = first.wallet || q.wallet;
  const before = JSON.stringify(state.prefs);
  if (first?.payload != null || quick == null) applyPrefs(first?.payload);
  if (firstTab() !== 'home') $('loading').hidden = true;
  if (quick == null) {
    restoreDay();
    showTab(firstTab());
    restorePlace();
  } else if (JSON.stringify(state.prefs) !== before) {
    state.days.clear();
    showTab(state.tab);
  }
  setTimeout(syncFollows, 3000);
  window.__bootStep?.(t('loadingGames'), 0.84);
  // Which leagues have games now (after the day's own reading, not before it).
  setTimeout(() => checkActive().catch(() => {}), 1500);
  await loadDay(today());
  window.__bootStep?.(t('loadingPicks'), 0.94);
  await homeReady(until);
  $('loading').hidden = true;
}
if (!gated) boot();
setTimeout(() => ($('loading').hidden = true), BOOT_WAIT + 2000);

if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('./sw.js').catch(() => {});
