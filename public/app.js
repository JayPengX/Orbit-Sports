// Quadra Fixtures: a sports app that goes with Quadra (a related add-on, like
// Orbit Class). Every supported sport's scores, schedules, match details (box
// scores, plays, line-ups, win probability), standings, teams and players,
// and a day planned around what the person follows. The data is ESPN's
// (Kambi's for the leagues ESPN doesn't carry), read through the Quadra data
// proxy (lib/espn.mjs).
//
// What the person follows lives on the pass (this app's payload): sports in
// their order of priority, leagues and teams. Nothing of it goes to the other
// apps; their activity doesn't steer the picks here either.
import { quadraSession, tabBar, topActions, installGate, watchUpdates, recordAffinity, activityPatch, affinity, appUrl, fitNumbers, notify, cachedPayload, cachedWallet, restorePlace, schedulePush, translate, proxyJson, affinityPatch, settingPatch } from './lib/quadra.mjs';
import { localSide, scoreboard, standings, teamSchedule, seasonCalendar, monthsBetween, weekScoreboard, yyyymmdd, settleField, seasonEvents, splitWeekend, asiaEvents } from './lib/espn.mjs';
import { SERVICES, watchable, leaguesOn, eltaChannel, eltaWatchUrl, eltaAppUrl } from './lib/broadcast.mjs';
import { findLeagues, parseSearch } from './lib/search.mjs';
import { LEAGUES, SPORTS, leagueName, leaguesOf, hasStandings, hasTeams } from './lib/leagues.mjs';
import { familyOfSport } from './lib/catalog.mjs';
import { detectLocale, makeT } from './lib/i18n.mjs';
import { eventKeys, teamKey, leagueKey } from './lib/foryou.mjs';
import { dayPlan, tableIndex, DURATION, scoreMatch, bigGame } from './lib/picks.mjs';
import { stageOf } from './lib/stage.mjs';
import { nearestDay } from './lib/days.mjs';
import { onTvChange, tvOf, knownEvents, eltaSchedule, audioPref } from './lib/tv.mjs';
import { ctx, el, put, spinner, empty, $, localDate, today, addDays, clock, dayLabel, whenText, statusText, sideLine, eventRow, sheet, section, moreButton, logo, leagueChip, leagueMark, twChips, seriesText, segmented, liveLine, fieldNow, watchLink, sessionTag, audioName, personPic } from './ui.js';
import { openMatch, openFieldEvent, openTeam, openPlayer, openConstructor, constructorBadge, standingsTables } from './sheets.js';
import { f1Driver, f1Constructor } from './lib/logos.mjs';

const locale = detectLocale();
const t = makeT(locale);
const L = obj => (locale === 'en' ? obj.en : obj.zh);
document.documentElement.lang = locale === 'zh' ? 'zh-Hant' : 'en';
const TABS = ['home', 'matches', 'live', 'following'];

const state = {
  tab: 'home',
  prefs: { sports: [], leagues: [], follows: [], tv: [], audio: 'en' },
  prefsLoaded: false,
  wallet: null,
  // The days read so far: date -> { events, at, loading }.
  days: new Map(),
  home: { date: today(), filter: 'all', shown: 20, teams: new Map(), tables: {}, sportDays: new Map(), autoDay: true, tablesPending: 0, settled: false },
  scores: { sport: 'soccer', league: 'epl', date: null, byDay: null, days: [], extra: 0, loading: false, mode: 'days', stage: 'all', view: 'games' },
  following: new Map(),
};

const q = quadraSession('match', { lang: locale });
Object.assign(ctx, { t, locale, state, q, openEvent, openTeam, openPlayer, isFollowed, toggleFollow, track, isFollowedEvent });

// ---- What the person follows (on the pass) ---------------------------------------------

function applyPrefs(payload) {
  try {
    const p = payload ? JSON.parse(payload) : null;
    if (p?.v === 3) state.prefs = { sports: p.sports || [], leagues: p.leagues || [], follows: p.follows || [], tv: p.tv || [], audio: p.audio === 'zh' ? 'zh' : 'en' };
    else if (p?.v === 2 && Array.isArray(p.follows)) {
      // Teams only, before: their sports and leagues follow from them.
      const leagues = [...new Set(p.follows.map(f => f.league).filter(k => LEAGUES[k]))];
      state.prefs = { sports: [...new Set(leagues.map(k => LEAGUES[k].sport))], leagues, follows: p.follows, tv: [], audio: 'en' };
    }
  } catch {}
  // The old 球拍與其他: badminton is what's left of it.
  state.prefs.sports = state.prefs.sports.map(s => (s === 'racket' ? 'badminton' : s));
  state.prefs.sports = [...new Set(state.prefs.sports.filter(s => SPORTS[s]))];
  state.prefs.leagues = state.prefs.leagues.filter(k => LEAGUES[k]);
  state.prefs.tv = (state.prefs.tv || []).filter(id => SERVICES.some(x => x.id === id));
  state.prefsLoaded = true;
}
let saveTimer = 0;
function savePrefs() {
  clearTimeout(saveTimer);
  const { sports, leagues, follows, tv, audio } = state.prefs;
  saveTimer = setTimeout(() => {
    q.write({ payload: JSON.stringify({ v: 3, sports, leagues, follows, tv, audio, t: Date.now() }) }).catch(() => {});
  }, 800);
}
// A followed team's name as shown (kept in English on the pass).
const shownName = f => (f.athlete ? f.name : f.f1team === true ? (locale === 'en' ? f.name : f1Constructor(f.name).zh || f.name) : localSide(f.league, { name: f.name }).name);
function isFollowed(league, id) {
  return state.prefs.follows.some(f => f.league === league && f.id === id);
}
function isFollowedEvent(e) {
  if (e.kind === 'match') return isFollowed(e.league, e.home?.id) || isFollowed(e.league, e.away?.id);
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
    p.follows = [...p.follows, { league, id: side.id, name: side.en || side.name, logo: side.logo, ...(side.athlete ? { athlete: true } : {}), ...(side.f1team === true ? { f1team: true } : {}) }];
    // Following a team follows its league and sport too.
    if (!p.leagues.includes(league)) p.leagues = [...p.leagues, league];
    if (!p.sports.includes(LEAGUES[league].sport)) p.sports = [...p.sports, LEAGUES[league].sport];
    recordAffinity('match', [teamKey(league, side.en || side.name), `league:${leagueKey(league)}`], 4);
    track('follow');
  }
  changed();
}
function toggleSport(sport) {
  const p = state.prefs;
  if (p.sports.includes(sport)) {
    p.sports = p.sports.filter(s => s !== sport);
    p.leagues = p.leagues.filter(k => LEAGUES[k].sport !== sport);
  } else {
    p.sports = [...p.sports, sport];
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
function moveSport(sport, by) {
  const list = [...state.prefs.sports];
  const i = list.indexOf(sport);
  const j = i + by;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  state.prefs.sports = list;
  changed();
}
function changed() {
  savePrefs();
  state.home.sportDays.clear();
  state.days.clear();
  state.following.clear();
  if (state.tab === 'home' || state.tab === 'live') loadDay(state.tab === 'live' ? today() : state.home.date);
  if (state.tab === 'following') renderFollowing();
}
function track(action, keys = [], weight = 1) {
  if (keys.length) recordAffinity('match', keys, weight);
  if (action && q.active) q.write({ wallet: activityPatch(q.wallet, 'match', action) }).catch(() => {});
}
// The leagues the person follows, their sports' order first.
function followedLeagues() {
  const { sports, leagues } = state.prefs;
  return [...leagues].sort((a, b) => sports.indexOf(LEAGUES[a].sport) - sports.indexOf(LEAGUES[b].sport));
}

// The editor: sports in order, each one's leagues, the teams.
// 我的設定: everything the person picks, in one sheet: the sports in order,
// their leagues, who they follow, their services and the commentary.
// `focus`: a section to open on ('tv').
function openFollowEditor(focus = '') {
  const s = sheet(L({ zh: '我的設定', en: 'My settings' }));
  const pickChip = (on, text, onclick) => el('button', { class: `q-chip${on ? ' on' : ''}`, type: 'button', 'aria-pressed': String(on), text, onclick });
  const paint = () => {
    const p = state.prefs;
    put(
      s.body,
      el('h3', { class: 'section-h', text: t('yourSports') }),
      el('p', { class: 'section-sub', text: L({ zh: '排在前面的運動先出現。', en: 'The first ones show first.' }) }),
      p.sports.length
        ? el(
            'ol',
            { class: 'order-list' },
            p.sports.map((sp, i) =>
              el('li', {}, [
                el('span', { class: 'order-n num', text: String(i + 1) }),
                el('span', { class: 'order-name', text: L(SPORTS[sp]) }),
                el('button', { class: 'icon-btn', type: 'button', 'aria-label': t('moveUp'), disabled: i === 0 ? true : null, text: '↑', onclick: () => (moveSport(sp, -1), paint()) }),
                el('button', { class: 'icon-btn', type: 'button', 'aria-label': t('moveDown'), disabled: i === p.sports.length - 1 ? true : null, text: '↓', onclick: () => (moveSport(sp, 1), paint()) }),
                el('button', { class: 'icon-btn', type: 'button', 'aria-label': t('unfollow'), text: '✕', onclick: () => (toggleSport(sp), paint()) })
              ])
            )
          )
        : el('p', { class: 'muted small', text: t('noSportsYet') }),
      Object.keys(SPORTS).some(k => !p.sports.includes(k)) ? el('div', { class: 'q-chips wrap' }, Object.entries(SPORTS).filter(([k]) => !p.sports.includes(k)).map(([k, sp]) => pickChip(false, `+ ${L(sp)}`, () => (toggleSport(k), paint())))) : null,
      p.sports.length ? el('h3', { class: 'section-h', text: t('leagues') }) : null,
      ...p.sports.map(sp => el('div', { class: 'league-pick' }, [el('p', { class: 'mini-h', text: L(SPORTS[sp]) }), el('div', { class: 'q-chips wrap' }, leaguesOf(sp).map(k => pickChip(p.leagues.includes(k), leagueName(k, locale), () => (toggleLeague(k), paint()))))])),
      el('h3', { class: 'section-h', text: L({ zh: '追蹤的球隊與選手', en: 'Teams and players you follow' }) }),
      p.follows.length
        ? el('ul', { class: 'order-list' }, p.follows.map(f => el('li', {}, [f.athlete ? personPic(f, f.league, 'sm round') : f.f1team === true ? constructorBadge(f.name, 'sm') : logo(f.logo, f.name, 'sm'), el('span', { class: 'order-name', text: `${shownName(f)} · ${leagueName(f.league, locale)}` }), el('button', { class: 'icon-btn', type: 'button', 'aria-label': t('unfollow'), text: '✕', onclick: () => (toggleFollow(f.league, f), paint()) })])))
        : el('p', { class: 'muted small', text: t('teamsHint') }),
      el('h3', { class: 'section-h', id: 'set-tv', text: t('tvPick') }),
      el('p', { class: 'section-sub', text: t('tvHint') }),
      tvChips(paint),
      el('h3', { class: 'section-h', text: t('tvAudio') }),
      segmented(
        [
          ['en', t('tvAudioEn')],
          ['zh', t('tvAudioZh')]
        ],
        state.prefs.audio || 'en',
        v => {
          state.prefs.audio = v;
          tvChanged();
          paint();
        }
      ),
      el('p', { class: 'section-sub', text: t('tvAudioHint') })
    );
  };
  paint();
  if (focus === 'tv') requestAnimationFrame(() => s.body.querySelector('#set-tv')?.scrollIntoView({ block: 'start' }));
}

// ---- Opening things ------------------------------------------------------------------------

// Matches opened today, each once: Rewards' daily missions count different ones.
const openedToday = { day: '', set: new Set() };
function openEvent(e) {
  const day = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
  if (openedToday.day !== day) Object.assign(openedToday, { day, set: new Set() });
  const key = `${e.league}:${e.id}`;
  track(openedToday.set.has(key) ? null : 'open', eventKeys(e), 1);
  openedToday.set.add(key);
  if (e.kind === 'match') return openMatch(e);
  return openFieldEvent(e);
}

// ---- A day's matches, for 推薦 and 直播 --------------------------------------------------

// The leagues the picks come from: the ones followed and the followed
// teams'. Only when none of them plays (or the person follows nothing yet)
// are the others read: the leagues on their broadcast services (any Taiwan
// broadcast when they haven't said which they have), the headline ones first.
function pickLeagues() {
  return [...new Set([...followedLeagues(), ...state.prefs.follows.map(f => f.league)])].filter(k => LEAGUES[k]);
}
// Which leagues a day was read for: a day read before the follows came in
// (the pass answers after the first read) is read again, never taken for "nothing on".
const leaguesKey = () => pickLeagues().join();
function otherLeagues() {
  const mine = new Set(pickLeagues());
  return leaguesOn(state.prefs.tv)
    .filter(k => LEAGUES[k] && !mine.has(k))
    .sort((a, b) => Boolean(LEAGUES[b].top) - Boolean(LEAGUES[a].top));
}
// On the person's services (every match when they haven't said which): the
// game's own channels where ELTA's schedule says (an NBA game ELTA doesn't carry isn't on ELTA).
const onMyTv = e => !state.prefs.tv.length || (watchable(e.league, state.prefs.tv) && tvOf(e).some(b => state.prefs.tv.includes(b.svc)));
const espnDaysOf = date => {
  const start = new Date(`${date}T00:00:00`).getTime();
  return [...new Set([yyyymmdd(new Date(start - 11 * 3_600_000)), yyyymmdd(new Date(start + 12 * 3_600_000)), yyyymmdd(new Date(start + 23 * 3_600_000))])];
};

// The last day read is kept on the device, so the app opens on it at once.
const DAY_KEY = 'fx.day.v3';
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
// on its own day, at its hour.
const AWAKE_FROM = 5;
const nightWorthy = e => bigGame(e) || isFollowedEvent(e);
const inDay = (ms, date) => ms >= Date.parse(`${date}T00:00:00`) && ms < Date.parse(`${addDays(date, 1)}T00:00:00`);
const inPickDay = (ms, date) => ms >= Date.parse(`${date}T${String(AWAKE_FROM).padStart(2, '0')}:00:00`) && ms < Date.parse(`${addDays(date, 1)}T00:00:00`);

// A day's events of these leagues (races split into their sessions).
// `current`: each league's current scoreboard (what's on now) instead of the day's dates.
const rawDays = new Map();
async function readDay(leagues, date, { current = false } = {}) {
  const dates = espnDaysOf(date);
  const isToday = date === today();
  const lists = await Promise.all(
    leagues.map(k => {
      const l = LEAGUES[k];
      // A race weekend: what's on that day (ESPN's dated page lists the
      // events running then); the other sources' lists are the season's anyway.
      if (l.kind !== 'match') return (isToday ? scoreboard(k) : l.espn ? scoreboard(k, dates) : seasonEvents(k)).catch(() => []);
      // Soccer by its dated pages even for what's on now: a cup's current page can be a round long past.
      return scoreboard(k, l.espn && (!current || l.sport === 'soccer') ? dates : undefined).catch(() => []);
    })
  );
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
  return raw.filter(e => (isToday && e.status.state === 'in') || inPickDay(Date.parse(e.start), date) || (inDay(Date.parse(e.start), date) && nightWorthy(e)) || ((past || e.status.state === 'post') && inDay(Date.parse(e.start), date)) || (!e.sessionKey && e.kind !== 'match' && e.status.state !== 'post' && e.end && Date.parse(e.start) <= Date.parse(`${date}T23:59:59`) && Date.parse(e.end) >= Date.parse(`${date}T00:00:00`)));
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
  // The followed leagues' tables, for the picks (they come in on their own).
  followedLeagues()
    .filter(hasStandings)
    .filter(k => !state.home.tables[k])
    .slice(0, 8)
    .forEach(k => {
      state.home.tablesPending++;
      standings(k)
        .then(g => {
          state.home.tables[k] = tableIndex(g);
          if (state.tab === 'home' && state.days.get(state.home.date)?.at) renderHome();
        })
        .catch(() => {})
        .finally(() => state.home.tablesPending--);
    });
  const key = leaguesKey();
  try {
    const events = await readDay(pickLeagues(), date);
    if (isToday) noticeChanges(events);
    Object.assign(slot, { events, at: Date.now(), stale: false, leagues: key });
    if (isToday) saveDay(date, slot);
  } catch {
    if (!slot.at) slot.at = Date.now();
    slot.stale = false;
  } finally {
    slot.loading = false;
  }
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
// Followed teams' schedules (their next and last games).
async function loadFollowedTeams() {
  for (const f of state.prefs.follows.slice(0, 10)) {
    const key = `${f.league}:${f.id}`;
    if (f.athlete || state.home.teams.has(key) || !hasTeams(f.league)) continue;
    state.home.teams.set(key, null);
    teamSchedule(f.league, f.id)
      .then(list => {
        state.home.teams.set(key, list);
        if (state.tab === 'home') renderHome();
        clearTimeout(pushTimer);
        pushTimer = setTimeout(syncPush, 1500);
      })
      .catch(() => state.home.teams.delete(key));
  }
}
// Followed teams' coming games, for notices while the app is closed: the
// start, and the final score (the Worker checks ESPN after the game's usual
// length).
function syncPush() {
  const now = Date.now();
  const items = [];
  const seen = new Set();
  const games = [...state.prefs.follows.flatMap(f => state.home.teams.get(`${f.league}:${f.id}`) || []), ...(state.days.get(today())?.events || []).filter(isFollowedEvent)];
  for (const e of games) {
    const key = `${e.league}:${e.id}`;
    if (e.kind !== 'match' || e.other || seen.has(key) || e.status?.state === 'post' || e.status?.void) continue;
    seen.add(key);
    const start = Date.parse(e.start);
    if (!(start > now - 4 * 3_600_000 && start < now + 8 * 86_400_000)) continue;
    const league = leagueName(e.league, locale);
    if (start > now) items.push({ at: start, title: matchLine(e), body: `${league} ${L(NOTICE_TEXT.start)}`, tag: `start:${key}`, hash: 'home', kind: 'start' });
    // The Worker fills in the score (the title) and who won ({result}) once ESPN has the final.
    if (LEAGUES[e.league].espn && /^\d+$/.test(e.id)) items.push({ at: Math.max(now + 60_000, start + (DURATION[LEAGUES[e.league].sport] || 150) * 60_000), title: matchLine(e), body: `${league} · {result}`, tag: `end:${key}`, hash: 'home', kind: 'end', check: { espn: LEAGUES[e.league].espn, event: e.id, names: [e.away.short || e.away.name, e.home.short || e.home.name] } });
  }
  schedulePush(q, items);
}

// A notice's words: the teams (and the score) on top, the league and what
// happened below.
const NOTICE_TEXT = { start: { zh: '開賽了', en: 'game started' } };
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
    if (e.status.state === 'in') notify(q, { title: matchLine(e), body: `${league} ${L(NOTICE_TEXT.start)}`, tag: `start:${key}`, hash: 'home', kind: 'start' });
    if (e.status.state === 'post') notify(q, { title: matchLine(e, true), body: `${league} · ${resultLine(e)}`, tag: `end:${key}`, hash: 'home', kind: 'end' });
  }
}

// A sideways row of chips scrolled so the chosen one sits in the middle
// (the row only, never the page).
function centerChosen(box) {
  for (const chip of box.querySelectorAll('.q-chips [aria-pressed="true"], .segmented [aria-pressed="true"]')) {
    const row = chip.parentElement;
    if (row.scrollWidth > row.clientWidth) row.scrollLeft = chip.offsetLeft - row.offsetLeft - row.clientWidth / 2 + chip.clientWidth / 2;
  }
}

// ---- 推薦: every match of the chosen day, ranked for this person ---------------------------

const REASON = r => t(`why_${r}`);
function pickCard(item, n) {
  const e = item.event;
  const reasons = item.reasons.filter(r => r !== 'tv').slice(0, 2).map(r => REASON(r));
  const tag = stageOf(e).special ? (stageOf(e).round?.[locale === 'en' ? 'en' : 'zh'] || stageOf(e)[locale === 'en' ? 'en' : 'zh']) : '';
  const series = seriesText(e);
  return el('button', { class: `pick-card${e.status.state === 'in' ? ' live' : ''}`, type: 'button', onclick: () => openEvent(e) }, [
    el('div', { class: 'pick-time' }, [
      el('strong', { class: 'num', text: e.status.state === 'in' ? '●' : e.status.state === 'post' ? t('final') : clock(e.start) }),
      el('small', { text: e.status.state === 'in' ? statusText(e) : n === 0 ? t('firstUp') : '' })
    ]),
    el('div', { class: 'pick-body' }, [
      el('div', { class: 'pick-top' }, [leagueChip(e.league), tag ? el('span', { class: 'stage-tag', text: tag }) : null]),
      e.kind === 'match' ? el('div', { class: 'card-sides' }, [sideLine(e.away, e, false), sideLine(e.home, e, false)]) : e.sessionKey ? el('div', { class: 'sess-head pick-title' }, [sessionTag(e), el('strong', { text: e.name })]) : el('strong', { class: 'pick-title', text: e.session ? `${e.name} · ${e.session}` : e.name }),
      series ? el('small', { class: 'series-line', text: series }) : null,
      liveLine(e),
      e.kind !== 'match' && e.status.state === 'in' && fieldNow(e) ? el('small', { class: 'live-line', text: fieldNow(e) }) : null,
      reasons.length ? el('div', { class: 'why-row' }, reasons.map(r => el('span', { class: 'why', text: r }))) : null,
      twChips(e.league, 2, e)
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

// The date strip's days: it has no end. It opens on a week back and a
// fortnight ahead, grows by two weeks whenever it's scrolled near either end,
// and 📅 jumps to any day (the strip grows to reach it).
const STRIP = { from: -7, to: 14, step: 14 };
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
// per league); `only`: just these days (a sport's or a league's game days);
// `grow`: read more of them before the strip grows.
function dateStrip(current, onPick, { only = null, grow = null, range = stripRange } = {}) {
  const stripRange = range;
  if (current) reach(current, range);
  const row = el('div', { class: 'q-chips day-strip' });
  const days = () => {
    const list = [];
    for (let i = stripRange.from; i <= stripRange.to; i++) list.push(addDays(today(), i));
    return only ? list.filter(d => only.has(d)) : list;
  };
  const fill = () => put(row, days().map(d => dayChip(d, current, onPick)));
  fill();
  // Near an end: two more weeks that way. After a pick (or on opening) the
  // chosen day is centred again once they're in; while the person is
  // scrolling the strip themselves, the days in view stay put.
  let busy = false;
  let touchedAt = 0;
  for (const ev of ['pointerdown', 'touchstart', 'wheel']) row.addEventListener(ev, () => (touchedAt = Date.now()), { passive: true });
  row.addEventListener(
    'scroll',
    () => {
      // (A strip being replaced reports a scroll with no size: not the person's.)
      if (busy || !row.isConnected || !row.clientWidth) return;
      const nearEnd = row.scrollLeft + row.clientWidth > row.scrollWidth - 120;
      const nearStart = row.scrollLeft < 120;
      if (!nearEnd && !nearStart) return;
      busy = true;
      const before = row.scrollWidth;
      if (nearEnd) stripRange.to += STRIP.step;
      else stripRange.from -= STRIP.step;
      const done = () => {
        const left = row.scrollLeft;
        fill();
        const chosen = row.querySelector('[aria-pressed="true"]');
        if (chosen && Date.now() - touchedAt > 1500) row.scrollLeft = chosen.offsetLeft - row.offsetLeft - row.clientWidth / 2 + chosen.clientWidth / 2;
        else if (nearStart) row.scrollLeft = left + (row.scrollWidth - before);
        requestAnimationFrame(() => (busy = false));
      };
      // One sport's days are read for the new stretch first.
      grow ? grow().then(done, done) : done();
    },
    { passive: true }
  );
  // Any day: the browser's own date picker.
  const pick = el('input', { class: 'day-pick-input', type: 'date', 'aria-label': L({ zh: '選擇日期', en: 'Pick a date' }), value: current || today() });
  pick.addEventListener('change', () => {
    if (!pick.value) return;
    reach(pick.value, range);
    onPick(pick.value);
  });
  const cal = el('label', { class: 'q-chip day-pick', title: L({ zh: '選擇日期', en: 'Pick a date' }) }, [el('span', { class: 'day-pick-icon', 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M7.5 13.5h2M11 13.5h2M14.5 13.5h2M7.5 17h2M11 17h2"/></svg>' }), pick]);
  return el('div', { class: 'day-strip-wrap' }, [row, cal]);
}

const ENDED_PICKS = { zh: '已結束的推薦', en: 'Picks that ended' };
function renderHome() {
  const box = $('panel-home');
  const h = state.home;
  const slot = state.days.get(h.date);
  h.settled = false;
  if (!slot?.at || (slot.leagues !== leaguesKey() && !slot.stale)) {
    if (!slot?.loading) loadDay(h.date);
    put(box, homeHead(), spinner());
    centerChosen(box);
    return;
  }
  const now = Date.now();
  const pctx = { sports: state.prefs.sports, leagues: state.prefs.leagues, follows: state.prefs.follows, tables: h.tables, aff: affinity(null, now, ['match']), now };
  const past = h.date < today();
  // The picks of a list: the plan and the rest (a past day ranked as it
  // stood before, shown with the real results).
  const rank = (list, also = 999, ctx = pctx, before = past) => {
    const { plan, also: rest } = dayPlan(before ? list.map(e => ({ ...e, status: { ...e.status, state: 'pre' } })) : list, ctx, { n: 6, also });
    const real = new Map(list.map(e => [`${e.league}:${e.id}`, e]));
    const fix = items => items.map(x => ({ ...x, event: real.get(`${x.event.league}:${x.event.id}`) || x.event }));
    return [fix(plan), fix(rest)];
  };
  const mine = slot.events.filter(onMyTv);
  let [planList, more] = rank(filtered(mine));
  // Nothing of theirs on (on their services): the best of the rest there.
  // Opened on a day with nothing of theirs: the next day they have games
  // (only on a fresh read: a saved or half-read day can't say there's none).
  if (!planList.length && h.filter === 'all' && h.autoDay && h.date === today() && state.prefs.sports.length && !slot.stale && !slot.loading && !mine.some(e => e.status.state === 'in' || e.status.state === 'post')) {
    h.autoDay = false;
    h.jumping = true;
    nextPickDay().then(d => {
      h.jumping = false;
      if (d && state.home.date === today()) {
        state.home.date = d;
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
      // Worth watching on its own: the stakes and the sides, not the person's sport order.
      [planList, more] = rank(slot.others.filter(onMyTv), 12, { ...pctx, sports: [], leagues: [] });
      fallback = true;
    }
  }
  // Followed teams: each one's next game, or its last result (today only).
  const isToday = h.date === today();
  // Today's picks that have ended (the picks only look ahead): the day
  // ranked as it stood before, as on a past day, and what of it was on
  // show (the plan and the first of the rest) that's over now.
  const ended = x => x.event.status.state === 'post' && !x.event.status.void;
  const [wasPlan, wasMore] = isToday ? (fallback && !filtered(mine).some(e => e.status.state === 'post') ? rank(slot.others.filter(onMyTv), 12, { ...pctx, sports: [], leagues: [] }, true) : rank(filtered(mine), 999, pctx, true)) : [[], []];
  const endedPlan = wasPlan.filter(ended);
  const endedMore = wasMore.slice(0, 20).filter(ended);
  // 正在進行: today's games on now, first on 首頁 (theirs; with none of
  // theirs on, the best of everything on now), ranked like the picks, and
  // taken out of the lists below so no game shows twice.
  const onNow = list => list.filter(e => e.status.state === 'in' && !e.status.void);
  const rankLive = (list, c) => list.map(e => ({ event: e, ...scoreMatch(e, c) })).sort((x, y) => y.score - x.score);
  let liveItems = isToday ? rankLive(onNow(filtered(mine)), pctx) : [];
  const liveMine = liveItems.length > 0;
  if (isToday && !liveItems.length && h.filter === 'all') liveItems = rankLive(onNow(dayAll(slot).filter(onMyTv)), { ...pctx, sports: [], leagues: [] }).filter(x => x.score >= 0.3);
  const allLive = isToday ? onNow(dayAll(slot)).length : 0;
  const liveShown = liveItems.slice(0, liveMine ? 5 : 3);
  const liveKeys = new Set(liveShown.map(x => `${x.event.league}:${x.event.id}`));
  planList = planList.filter(x => !liveKeys.has(`${x.event.league}:${x.event.id}`));
  more = more.filter(x => !liveKeys.has(`${x.event.league}:${x.event.id}`));
  const liveBlock = liveShown.length
    ? section(`● ${t('liveNow')}`, el('div', { class: 'q-card list live-strip' }, [...liveShown.map(x => eventRow(x.event)), allLive > liveShown.length ? el('button', { class: 'live-strip-more', type: 'button', text: `${L({ zh: `全部 ${allLive} 場直播`, en: `All ${allLive} live` })} ›`, onclick: () => showTab('live') }) : null]), { sub: liveMine ? '' : L({ zh: '你追蹤的比賽都還沒開打，先看看這些', en: 'Nothing you follow is on yet: these are' }), cls: 'live-now' })
    : null;
  const teamRows = isToday
    ? state.prefs.follows.map(f => {
        const list = state.home.teams.get(`${f.league}:${f.id}`) || [];
        const next = list.find(x => x.status.state !== 'post' && Date.parse(x.start) > now - 4 * 3_600_000);
        const last = [...list].reverse().find(x => x.status.state === 'post');
        const e = next || last;
        return el('div', { class: 'follow-row' }, [
          el('button', { class: 'follow-team', type: 'button', onclick: () => (f.athlete ? openPlayer(f.league, f.id) : openTeam(f.league, f.id, f)) }, [f.athlete ? personPic(f, f.league, 'sm round') : logo(f.logo, f.name, 'sm'), el('span', { text: shownName(f) })]),
          e ? eventRow(e, { league: false }) : el('small', { class: 'muted', text: leagueName(f.league, locale) })
        ]);
      })
    : [];
  const hasFollows = state.prefs.sports.length > 0;
  // Everything the picks lean on is in: the day read fresh, the tables,
  // the followed teams, and no search for other games or days going on.
  h.settled = !slot.stale && !slot.loading && !finding && !h.jumping && !h.tablesPending && ![...h.teams.values()].includes(null);
  const shownMore = more.slice(0, h.shown);
  put(
    box,
    homeHead(),
    !hasFollows ? sportPicker() : null,
    tvRow(),
    liveBlock,
    (fallback || finding) && !endedPlan.length && !endedMore.length ? el('div', { class: 'q-card pad none-mine' }, [el('strong', { text: hasFollows ? t(isToday ? 'noMineToday' : 'noMineDay') : t('noFollowsYet') }), el('p', { class: 'muted small', text: finding ? t('findingOthers') : planList.length ? t('othersSub') : t('noOthers') })]) : null,
    finding ? spinner() : null,
    planList.length
      ? section(fallback ? t('othersPicks') : isToday ? t('todayPicks') : `${dayLabel(h.date)} · ${past ? L(ENDED_PICKS) : t('picksOn')}`, el('div', { class: 'pick-list' }, planList.map((x, i) => pickCard(x, i))), { sub: fallback ? '' : t('recsN', { n: planList.length + more.length }) })
      : finding || fallback || liveBlock ? null : section(t('todayPicks'), empty(t(h.filter === 'all' ? 'noRecs' : 'noPicksMine'))),
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
}
function homeHead() {
  const hasFollows = state.prefs.sports.length > 0;
  const h = state.home;
  const sport = SPORTS[h.filter] ? h.filter : null;
  const days = sport ? h.sportDays.get(sport) : null;
  return el('div', {}, [
    el('div', { class: 'home-hero' }, [
      el('div', {}, [el('p', { class: 'hero-kicker', text: dayLabel(h.date, { long: true }) }), el('h2', { class: 'hero-title', text: hasFollows ? t(h.date === today() ? 'heroTitle' : 'heroTitleDay') : t('heroTitleNew') })]),
      el('button', { class: 'q-btn small', type: 'button', text: hasFollows ? t('editFollows') : t('pickSports'), onclick: openFollowEditor })
    ]),
    sportChips(),
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
            {
              only: days,
              // One sport: its days over the longer stretch, read before the strip grows.
              grow: sport ? () => sportDays(sport).then(more => (h.sportDays.set(sport, more), (days && more.forEach(d => days.add(d))))) : null
            }
          )
  ]);
}
// Every followed sport as a filter, whether it plays today or not: picking
// one keeps the date strip to the days it plays and goes to the nearest.
function sportChips() {
  const h = state.home;
  const filters = [['all', t('f_all')], ...(state.prefs.follows.length ? [['teams', t('f_teams')]] : []), ...state.prefs.sports.map(sp => [sp, L(SPORTS[sp])])];
  if (filters.length < 3) return null;
  return el(
    'div',
    { class: 'q-chips small filter-chips' },
    filters.map(([k, label]) => el('button', { class: 'q-chip', type: 'button', 'aria-pressed': String(h.filter === k), text: label, onclick: () => pickFilter(k) }))
  );
}
// The first day after today any followed sport plays (on the person's services).
async function nextPickDay() {
  const h = state.home;
  const sets = await Promise.all(
    state.prefs.sports.map(async sp => {
      if (!h.sportDays.has(sp)) h.sportDays.set(sp, await sportDays(sp).catch(() => new Set()));
      return h.sportDays.get(sp);
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
  if (!h.sportDays.has(k)) {
    try {
      h.sportDays.set(k, await sportDays(k));
    } catch {
      h.sportDays.set(k, new Set());
    }
  }
  const days = h.sportDays.get(k);
  if (h.filter !== k) return;
  // The next day it plays (today included), else its latest.
  const list = [...days].sort();
  if (list.length && !days.has(h.date)) h.date = list.find(d => d >= today()) || list.at(-1);
  renderHome();
}
// The days (the date strip's stretch so far) a followed sport's leagues
// play on the person's services.
async function sportDays(sport) {
  const leagues = pickLeagues().filter(k => LEAGUES[k].sport === sport);
  const from = addDays(today(), stripRange.from);
  const to = addDays(today(), stripRange.to);
  const usFrom = yyyymmdd(new Date(Date.parse(`${from}T00:00:00`) - 12 * 3_600_000));
  const usTo = yyyymmdd(new Date(Date.parse(`${to}T23:59:59`)));
  const lists = await Promise.all(
    leagues.map(async k => {
      const l = LEAGUES[k];
      if (l.kind !== 'match') return seasonEvents(k).catch(() => []);
      if (l.kambi || l.asia) return scoreboard(k).catch(() => []);
      const cal = await seasonCalendar(k).catch(() => null);
      if (cal?.months) return scoreboard(k, monthsBetween(Date.parse(`${from}T00:00:00`) - 86_400_000, Date.parse(`${to}T23:59:59`))).catch(() => []);
      if (cal?.weeks) {
        const weeks = cal.weeks.filter(w => Date.parse(w.end) >= Date.parse(`${from}T00:00:00`) - 86_400_000 && Date.parse(w.start) <= Date.parse(`${to}T23:59:59`));
        return (await Promise.all(weeks.map(w => weekScoreboard(k, w.seasontype, w.week).catch(() => [])))).flat();
      }
      const us = (cal?.days || []).filter(d => d >= usFrom && d <= usTo);
      return us.length ? scoreboard(k, us).catch(() => []) : [];
    })
  );
  const now = Date.now();
  const days = new Set();
  for (const e of lists.flat().flatMap(x => (x.sessions ? splitWeekend(x, now, locale) : [x]))) {
    if (e.status?.void || !onMyTv(e)) continue;
    const ms = Date.parse(e.start);
    const d = localDate(ms);
    if (inPickDay(ms, d) && d >= from && d <= to) days.add(d);
  }
  return days;
}

// The broadcast services the person has: the picks keep to them.
function tvNames() {
  const tv = state.prefs.tv;
  return tv.length ? SERVICES.filter(x => tv.includes(x.id)).map(x => L(x).replace(/（.*）|\s*\(.*\)/, '')).join('、') : t('tvAny');
}
function tvRow() {
  return el('button', { class: 'tv-row', type: 'button', onclick: openTvEditor }, [el('span', { class: 'tv-row-k', text: t('tvMine') }), el('span', { class: 'tv-row-v', text: tvNames() }), el('span', { class: 'tv-row-go', 'aria-hidden': 'true', text: '›' })]);
}
function tvChips(after) {
  const tv = state.prefs.tv;
  return el(
    'div',
    { class: 'q-chips wrap' },
    SERVICES.map(x =>
      el('button', {
        class: `q-chip${tv.includes(x.id) ? ' on' : ''}`,
        type: 'button',
        'aria-pressed': String(tv.includes(x.id)),
        text: L(x).replace(/（.*）|\s*\(.*\)/, ''),
        onclick: () => {
          state.prefs.tv = tv.includes(x.id) ? tv.filter(id => id !== x.id) : [...tv, x.id];
          tvChanged();
          after();
        }
      })
    )
  );
}
function tvChanged() {
  savePrefs();
  state.home.sportDays.clear();
  // The others depend on the services: read again when needed.
  for (const slot of state.days.values()) {
    slot.others = null;
    slot.othersAt = 0;
    slot.rest = null;
    slot.restAt = 0;
  }
  if (state.tab === 'home') renderHome();
}
const openTvEditor = () => openFollowEditor('tv');

// First run: the sports, tapped in order of priority.
function sportPicker() {
  return el('div', { class: 'q-card pad sport-picker' }, [
    el('p', { class: 'muted small', text: t('pickSportsHint') }),
    el(
      'div',
      { class: 'sport-grid' },
      Object.entries(SPORTS).map(([k, sp]) => {
        const i = state.prefs.sports.indexOf(k);
        return el('button', { class: `sport-tile${i >= 0 ? ' on' : ''}`, type: 'button', onclick: () => toggleSport(k) }, [el('span', { class: 'sport-icon', text: sp.icon }), el('span', { text: L(sp) }), i >= 0 ? el('b', { class: 'sport-n num', text: String(i + 1) }) : null]);
      })
    )
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
  if (!slot?.at) {
    if (!slot?.loading) loadDay(today());
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
  const all = [...dayAll(slot), ...byKey.values()].filter(e => !keys.has(`${e.league}:${e.id}:${e.sessionKey || ''}`) && keys.add(`${e.league}:${e.id}:${e.sessionKey || ''}`));
  // Every league's games on now, the headline leagues first in each sport.
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
  // The services strip: all, mine (the ones in 我的設定), then each service
  // that has something in these lists, with how many.
  const svcOf = e => new Set(tvOf(e).map(b => b.svc));
  const shown = [...live, ...soon, ...ended];
  const counts = new Map();
  for (const e of shown) for (const id of svcOf(e)) counts.set(id, (counts.get(id) || 0) + 1);
  const mineSvc = state.prefs.tv || [];
  const pick = state.liveSvc && (state.liveSvc === 'all' || state.liveSvc === 'mine' || counts.has(state.liveSvc)) ? state.liveSvc : 'all';
  const keep = e => pick === 'all' || (pick === 'mine' ? mineSvc.some(id => svcOf(e).has(id)) : svcOf(e).has(pick));
  const svcName = sv => L(sv).replace(/（.*$|\s*\(.*$/, '');
  const strip = el(
    'div',
    { class: 'q-chips svc-strip' },
    [
      ['all', L({ zh: '全部', en: 'All' }), shown.length],
      mineSvc.length ? ['mine', L({ zh: '我的服務', en: 'Mine' }), shown.filter(e => mineSvc.some(id => svcOf(e).has(id))).length] : null,
      ...SERVICES.filter(sv => counts.has(sv.id))
        .sort((x, y) => counts.get(y.id) - counts.get(x.id))
        .map(sv => [sv.id, svcName(sv), counts.get(sv.id)])
    ]
      .filter(Boolean)
      .map(([id, name, n]) =>
        el('button', { class: `q-chip${pick === id ? ' on' : ''}`, type: 'button', 'aria-pressed': String(pick === id), onclick: () => ((state.liveSvc = id), renderLive()) }, [el('span', { text: name }), el('small', { class: 'num svc-n', text: String(n) })])
      )
  );
  const liveF = live.filter(keep);
  const soonF = soon.filter(keep);
  const endedF = ended.filter(keep);
  // The next to start (a followed team's if one is within the hour of the first).
  const first = soonF[0];
  const nextUp = first && (soonF.find(e => isFollowedEvent(e) && Date.parse(e.start) - Date.parse(first.start) < 3_600_000) || first);
  const wait = nextUp ? Math.max(0, Date.parse(nextUp.start) - now) : 0;
  const waitText = wait < 60_000 ? L({ zh: '馬上', en: 'any minute' }) : wait < 3_600_000 ? L({ zh: `${Math.round(wait / 60_000)} 分鐘後`, en: `in ${Math.round(wait / 60_000)} min` }) : L({ zh: `${Math.floor(wait / 3_600_000)} 小時 ${Math.round((wait % 3_600_000) / 60_000)} 分後`, en: `in ${Math.floor(wait / 3_600_000)} h ${Math.round((wait % 3_600_000) / 60_000)} min` });
  const hero = liveF.length
    ? el('div', { class: 'home-hero' }, [el('div', {}, [el('p', { class: 'hero-kicker live-kicker', text: t('liveNow') }), el('h2', { class: 'hero-title', text: `${liveF.length} ${locale === 'en' ? 'live' : '場進行中'}` })])])
    : el('div', { class: 'home-hero live-idle' }, [
        el('div', {}, [
          el('p', { class: 'hero-kicker', text: t('liveEmpty') }),
          nextUp ? el('h2', { class: 'hero-title', text: L({ zh: `下一場 ${waitText}`, en: `Next one ${waitText}` }) }) : reading ? null : el('h2', { class: 'hero-title', text: L({ zh: '接下來一天沒有比賽', en: 'Nothing in the next day' }) })
        ])
      ]);
  put(
    box,
    hero,
    shown.length ? strip : null,
    !liveF.length && nextUp ? el('div', { class: 'q-card list' }, [eventRow(nextUp)]) : null,
    !liveF.length && !nextUp && reading ? spinner() : null,
    liveF.length ? section(L({ zh: '直播中', en: 'Live now' }), el('div', { class: 'q-card list' }, mineFirst(liveF).map(e => eventRow(e)))) : null,
    endedF.length && !liveF.length ? section(L({ zh: '剛結束', en: 'Just ended' }), el('div', { class: 'q-card list' }, mineFirst(endedF).slice(0, 12).map(e => eventRow(e)))) : null,
    soonF.filter(e => e !== nextUp || liveF.length).length ? section(liveF.length ? t('startingSoon') : L({ zh: '接下來 24 小時', en: 'Next 24 hours' }), el('div', { class: 'q-card list' }, (liveF.length ? mineFirst(soonF) : soonF.filter(e => e !== nextUp)).slice(0, 30).map(e => eventRow(e)))) : null,
    endedF.length && liveF.length ? section(L({ zh: '剛結束', en: 'Just ended' }), el('div', { class: 'q-card list' }, mineFirst(endedF).slice(0, 8).map(e => eventRow(e)))) : null,
    pick === 'all' || pick === 'elta' ? tvGuide(all) : null
  );
}
// 愛爾達's guide: what its channels show now and in the next 12 hours (the
// followed leagues first), each with its game when Fixtures has it, and a
// way to watch the channel on ELTA.tv.
function tvGuide(events) {
  const programs = eltaSchedule();
  if (!programs?.length) return null;
  const now = Date.now();
  const mine = new Set(state.prefs.leagues);
  const list = programs
    .filter(p => p.end > now && p.start < now + 12 * 3_600_000)
    .sort((a, b) => mine.has(b.league) - mine.has(a.league) || a.start - b.start)
    .slice(0, 14)
    .sort((a, b) => a.start - b.start);
  if (!list.length) return null;
  const gameOf = p => events.find(e => e.league === p.league && tvOf(e).some(b => b.ch === p.ch && b.at === p.start));
  return section(
    L({ zh: '愛爾達轉播表', en: 'ELTA TV guide' }),
    el(
      'div',
      { class: 'q-card list tv-guide' },
      list.map(p => {
        const e = gameOf(p);
        const ch = eltaChannel(p.ch);
        const on = p.start <= now;
        return el('div', { class: `tvg-row${on ? ' on' : ''}` }, [
          el('span', { class: 'tvg-time num' }, [el('b', { text: on ? L({ zh: '播出中', en: 'On now' }) : clock(new Date(p.start).toISOString()) }), el('small', { text: [L(ch).replace(/^愛爾達|^ELTA\.tv\s*/, ''), audioName(p)].filter(Boolean).join(' · ') })]),
          el('button', { class: 'tvg-body', type: 'button', disabled: e ? null : true, onclick: () => e && openEvent(e) }, [leagueChip(p.league), el('span', { class: 'tvg-title', text: p.title })]),
          eltaWatchUrl(p.ch) ? watchLink({ ch: p.ch, url: eltaWatchUrl(p.ch), app: eltaAppUrl(p.ch) }, { class: 'tvg-watch', text: L({ zh: '觀看', en: 'Watch' }) }) : null
        ]);
      })
    ),
    { sub: L({ zh: '愛爾達的節目表（需訂閱 ELTA.tv 或 MOD）', en: "ELTA's schedule (needs ELTA.tv or MOD)" }) }
  );
}

// ---- 賽事: every sport, league and game day ------------------------------------------------------

function openScores(league, date, view = 'games') {
  state.scores = { ...state.scores, sport: LEAGUES[league].sport, league, date: date || null, byDay: null, days: [], extra: 0, stage: 'all', touched: true, view: hasStandings(league) ? view : 'games', q: '' };
  // Opened from a search: the search is done (its box emptied), the league shows.
  clearSearch();
  if (state.tab === 'matches') loadScores();
  else showTab('matches');
}

// Which days (or weeks) to read, then the games of each, grouped by the
// viewer's own day: the strip shows only days with games. Races, tours and
// fight promotions: the whole season, past and to come.
async function loadScores() {
  const sc = state.scores;
  const league = sc.league;
  const key = `${league}|${sc.extra}`;
  sc.loadingKey = key;
  sc.loading = true;
  // A new league: its own stretch of days on the strip.
  if (sc.rangeOf !== league) (sc.range = { from: STRIP.from, to: STRIP.to }), (sc.rangeOf = league);
  renderScores();
  track(null, [`league:${leagueKey(league)}`], 0.3);
  let events = [];
  try {
    events = await fetchScores(sc);
  } catch {
    if (sc.loadingKey === key) sc.byDay = 'failed';
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
// Scrolled near an end of the strip: the league's next stretch of game days
// (sc.extra one more), read without redrawing; the days it added. One read
// at a time (`growing`: the scores it's for).
let growing = null;
async function growScores() {
  const sc = state.scores;
  const league = sc.league;
  if (sc.mode !== 'days' || !(LEAGUES[league].espn || LEAGUES[league].asia) || growing === sc) return [];
  growing = sc;
  const had = new Set(sc.days);
  sc.extra += 1;
  try {
    const events = await fetchScores(sc);
    if (state.scores !== sc || sc.league !== league) return [];
    // Keep what's already read (a day's own read, say) and add the rest.
    const byId = new Map((sc.all || []).map(e => [e.id, e]));
    for (const e of events) byId.set(e.id, e);
    applyScores(sc, [...byId.values()]);
    return sc.days.filter(d => !had.has(d));
  } catch {
    return [];
  } finally {
    if (growing === sc) growing = null;
  }
}
// A day picked on the strip or the 📅: shown at once; a day not read yet (an
// ESPN league's, far from now) is read first.
async function pickScoresDay(d) {
  const sc = state.scores;
  sc.date = d;
  const l = LEAGUES[sc.league];
  if (sc.byDay instanceof Map && !sc.byDay.has(d) && l.espn && sc.mode === 'days' && !l.kambi) {
    renderScores();
    const at = Date.parse(`${d}T12:00:00`);
    // Its US days: the one before, the day, and the one after.
    const us = [-1, 0, 1].map(k => yyyymmdd(new Date(at + k * 86_400_000)));
    const events = await scoreboard(sc.league, us).catch(() => []);
    if (state.scores !== sc) return;
    const byId = new Map((sc.all || []).map(e => [e.id, e]));
    for (const e of events) byId.set(e.id, e);
    applyScores(sc, [...byId.values()]);
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
    } else if (l.kambi) {
      sc.mode = 'days';
      events = await scoreboard(league);
    } else if (l.asia) {
      // NPB, KBO, CPBL: the months around now, more with ‹ and ›.
      sc.mode = 'days';
      events = await asiaEvents(league, sc.extra);
    } else {
      sc.mode = 'days';
      const cal = await seasonCalendar(league).catch(() => null);
      if (cal?.months) {
        // A cup: the last month, this one and the next (more with ‹ and ›).
        const now = Date.now();
        events = await scoreboard(league, monthsBetween(now - (31 + 31 * sc.extra) * 86_400_000, now + (31 + 31 * sc.extra) * 86_400_000));
      } else if (cal?.weeks) {
        const now = Date.now();
        let i = cal.weeks.findIndex(w => Date.parse(w.end) > now);
        if (i < 0) i = cal.weeks.length - 1;
        const pick = cal.weeks.slice(Math.max(0, i - 1 - sc.extra), i + 2 + sc.extra);
        events = (await Promise.all(pick.map(w => weekScoreboard(league, w.seasontype, w.week).catch(() => [])))).flat();
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
    timer = setTimeout(() => (state.scores.q ? runSearch(state.scores.q) : renderScores()), 280);
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
async function runSearch(query) {
  const box = scoresShell();
  const seq = ++searchSeq;
  const leagues = findLeagues(query);
  const paint = (found, busy) =>
    put(
      box,
      leagues.length ? section(t('leagues'), el('div', { class: 'q-card list' }, leagues.slice(0, 8).map(k => el('button', { class: 'search-row', type: 'button', onclick: () => openScores(k) }, [leagueMark(k, 'lg-mark mid'), el('span', { text: leagueName(k, locale) }), el('small', { text: L(SPORTS[LEAGUES[k].sport]) })])))) : null,
      found?.teams.length ? section(t('teamsFound'), el('div', { class: 'q-card list' }, found.teams.slice(0, 10).map(x => el('button', { class: 'search-row', type: 'button', onclick: () => openTeam(x.league, x.id, x) }, [logo(x.logo, x.name, 'sm'), el('span', { text: localSide(x.league, { name: x.name }).name }), el('small', { text: leagueName(x.league, locale) })])))) : null,
      found?.players.length ? section(t('playersFound'), el('div', { class: 'q-card list' }, found.players.slice(0, 10).map(x => el('button', { class: 'search-row', type: 'button', onclick: () => openPlayer(x.league, x.id) }, [personPic(x, x.league, 'sm round'), el('span', { text: x.name }), el('small', { text: leagueName(x.league, locale) })])))) : null,
      busy ? spinner() : !leagues.length && !found?.teams.length && !found?.players.length ? empty(t('noResults')) : null
    );
  paint(null, true);
  let q = query;
  if (/[\u3400-\u9fff]/.test(query)) q = await translate(query, 'en', 'zh-TW').catch(() => query);
  const found = await searchEspn(q).catch(() => ({ teams: [], players: [] }));
  if (seq === searchSeq && state.scores.q === query) paint(found, false);
}

function renderScores() {
  const sc = state.scores;
  if (sc.q) return runSearch(sc.q);
  const box = scoresShell();
  const followed = new Set(state.prefs.sports);
  const sports = Object.keys(SPORTS).sort((a, b) => followed.has(b) - followed.has(a) || state.prefs.sports.indexOf(a) - state.prefs.sports.indexOf(b));
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
          const first = followedLeagues().find(k => LEAGUES[k].sport === key) || leaguesOf(key).find(k => LEAGUES[k].top) || leaguesOf(key)[0];
          state.scores = { ...sc, sport: key, league: first, date: null, byDay: null, days: [], extra: 0, stage: 'all', touched: true, view: hasStandings(first) ? sc.view : 'games' };
          loadScores();
        }
      })
    )
  );
  const mine = new Set(state.prefs.leagues);
  const leagueChips = el(
    'div',
    { class: 'q-chips small' },
    leaguesOf(sc.sport)
      .sort((a, b) => mine.has(b) - mine.has(a))
      .map(k => el('button', { class: 'q-chip', type: 'button', 'aria-pressed': String(sc.league === k), onclick: () => ((state.scores = { ...sc, league: k, season: null, date: null, byDay: null, days: [], extra: 0, stage: 'all', touched: true, view: hasStandings(k) ? sc.view : 'games' }), loadScores()) }, [leagueMark(k), leagueName(k, locale)]))
  );
  let strip = null;
  let list;
  let stages = null;
  const tableView = sc.view === 'table' && hasStandings(sc.league);
  if (tableView) list = tableOf(sc.league);
  else if (sc.byDay == null || sc.loading) list = spinner();
  else if (sc.byDay === 'failed') list = empty(t('failed'));
  else if (sc.mode === 'event') {
    const events = [...sc.byDay.values()].flat().sort((a, b) => a.start.localeCompare(b.start));
    const now = Date.now();
    const current = events.filter(e => e.status.state === 'in');
    const next = events.filter(e => e.status.state === 'pre' && Date.parse(e.end || e.start) > now - 86_400_000);
    const past = events.filter(e => e.status.state === 'post').reverse();
    list = events.length
      ? el('div', {}, [
          current.length ? section(t('liveNow'), el('div', { class: 'q-card list' }, current.map(e => eventRow(e, { league: false })))) : null,
          next.length ? section(t('upcomingEvents'), el('div', { class: 'q-card list' }, next.map(e => eventRow(e, { league: false })))) : null,
          past.length ? section(t('pastEvents'), el('div', { class: 'q-card list' }, past.slice(0, 12).map(e => eventRow(e, { league: false })))) : null
        ])
      : empty(t('noEvents'));
  } else if (!sc.days.length) list = empty(t('noGamesSeason'));
  else {
    // The same date strip as 首頁: the league's game days, more of them as
    // it's scrolled near either end, and 📅 for any day.
    const only = new Set(sc.days);
    for (const d of [sc.days[0], sc.days.at(-1)]) reach(d, sc.range);
    strip = dateStrip(sc.date, pickScoresDay, { only, range: sc.range, grow: () => growScores().then(added => added.forEach(d => only.add(d))) });
    const order = { in: 0, pre: 1, post: 2 };
    const games = [...(sc.byDay.get(sc.date) || [])].sort((a, b) => order[a.status.state] - order[b.status.state] || a.start.localeCompare(b.start));
    // The season's stages on show (preseason, playoffs, a cup…), as a filter.
    const keys = [...new Set((sc.all || []).map(e => stageOf(e).key).filter(Boolean))];
    if (keys.length > 1) {
      stages = segmented([['all', t('f_all')], ...keys.map(k => [k, stageOf((sc.all || []).find(e => stageOf(e).key === k))[locale === 'en' ? 'en' : 'zh']])], sc.stage, v => ((sc.stage = v), renderScores()), 'scroll stage-filter');
    }
    const shown = sc.stage === 'all' ? games : games.filter(e => stageOf(e).key === sc.stage);
    list = el('div', {}, [el('p', { class: 'day-head', text: `${dayLabel(sc.date, { long: true })} · ${t('gamesN', { n: shown.length })}` }), shown.length ? el('div', { class: 'q-card list' }, shown.map(e => eventRow(e, { league: false, day: false }))) : empty(t('noGames'))]);
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
      el('button', { class: `q-chip small${mine.has(sc.league) ? ' on' : ''}`, type: 'button', text: mine.has(sc.league) ? t('following') : `+ ${t('followLeague')}`, onclick: () => (!state.prefs.sports.includes(sc.sport) && toggleSport(sc.sport), toggleLeague(sc.league), renderScores()) })
    ]),
    twChips(sc.league, 3)
  ]);
  const views = hasStandings(sc.league) ? segmented([['games', t('schedule')], ['table', t('table')]], tableView ? 'table' : 'games', v => ((sc.view = v), renderScores()), 'views') : null;
  put(box, sportChips, leagueChips, tools, views, tableView ? null : strip, tableView ? null : stages, list);
  centerChosen(box);
}

const searchEspn = q => proxyJson(`https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(q)}&limit=12`, { ttl: 10 * 60_000 }).then(parseSearch);

// ---- 追蹤: everything about what you follow ------------------------------------------------------

async function loadFollowing(league) {
  const l = LEAGUES[league];
  const slot = { events: null, groups: null };
  state.following.set(league, slot);
  const [events, groups] = await Promise.all([
    (l.kind === 'match' ? scoreboard(league) : seasonEvents(league)).catch(() => []),
    hasStandings(league) ? standings(league).catch(() => []) : Promise.resolve(null)
  ]);
  const now = Date.now();
  const settled = events.flatMap(e => (e.sessions ? splitWeekend(e, now, locale) : [e]));
  // Live, then the next games, then the latest results.
  const upcoming = settled.filter(e => e.status.state === 'in' || (e.status.state === 'pre' && Date.parse(e.end || e.start) > now - 3_600_000)).sort((a, b) => a.start.localeCompare(b.start));
  const recent = settled.filter(e => e.status.state === 'post').sort((a, b) => b.start.localeCompare(a.start));
  slot.events = l.kind === 'match' ? [...upcoming, ...recent].slice(0, 6) : [...upcoming.slice(0, 3), ...recent.slice(0, 1)];
  slot.groups = groups;
  if (state.tab === 'following') renderFollowing();
}

function renderFollowing() {
  const box = $('panel-following');
  const p = state.prefs;
  if (!p.sports.length) {
    put(box, el('div', { class: 'home-hero' }, [el('div', {}, [el('h2', { class: 'hero-title', text: t('followingEmpty') })])]), sportPicker());
    return;
  }
  const teams = p.follows.filter(f => !f.athlete);
  const people = p.follows.filter(f => f.athlete);
  const head = el('div', { class: 'follow-head' }, [
    el('div', {}, [el('h2', { class: 'hero-title', text: t('tab_following') }), el('p', { class: 'muted small', text: [L({ zh: `${teams.length} 隊`, en: `${teams.length} teams` }), people.length ? L({ zh: `${people.length} 位選手`, en: `${people.length} players` }) : '', L({ zh: `${p.leagues.length} 個聯賽`, en: `${p.leagues.length} leagues` })].filter(Boolean).join(' · ') })]),
    el('button', { class: 'q-btn small', type: 'button', text: t('editFollows'), onclick: openFollowEditor })
  ]);
  put(
    box,
    head,
    teams.length ? section(t('yourTeams'), el('div', { class: 'q-card list team-form-list' }, teams.map(f => (f.f1team === true ? crewRow(f) : teamFormRow(f))))) : el('p', { class: 'muted small follow-hint', text: t('teamsHint') }),
    people.length ? section(t('yourPlayers'), el('div', { class: 'people-strip' }, people.map(f => el('button', { class: 'person-card', type: 'button', onclick: () => openPlayer(f.league, f.id) }, [personPic(f, f.league, 'lg round'), el('strong', { text: f.name }), el('small', { class: 'muted', text: leagueName(f.league, locale) })])))) : null,
    followedLeagues().length ? section(L({ zh: '你的聯賽', en: 'Your leagues' }), el('div', { class: 'stack' }, followedLeagues().map(k => leagueBlock(k)))) : el('p', { class: 'muted small', text: t('noLeaguesYet') })
  );
}

// A followed team at a glance: its last result and its next game (ESPN's
// schedule of the team), the team's page on a tap, the game's on the line.
const teamForm = new Map();
function formOf(f) {
  const key = `${f.league}:${f.id}`;
  if (!teamForm.has(key) && LEAGUES[f.league]?.espn && f.id) {
    teamForm.set(key, null);
    teamSchedule(f.league, f.id)
      .then(games => {
        const now = Date.now();
        const done = games.filter(g => g.status.state === 'post');
        const next = games.find(g => g.status.state === 'in') || games.find(g => g.status.state === 'pre' && !g.status.void && Date.parse(g.start) > now - 3_600_000);
        teamForm.set(key, { last: done.at(-1) || null, next: next || null, form: done.slice(-5) });
      })
      .catch(() => teamForm.set(key, { last: null, next: null, form: [] }))
      .then(() => state.tab === 'following' && renderFollowing());
  }
  return teamForm.get(key);
}
function teamFormRow(f) {
  const form = formOf(f);
  const sideOf = g => [g.home, g.away].find(x => String(x?.id) === String(f.id));
  const otherOf = g => [g.home, g.away].find(x => x && String(x.id) !== String(f.id));
  const result = g => {
    const us = sideOf(g);
    const them = otherOf(g);
    if (!us || !them) return '';
    return us.winner ? 'w' : them.winner ? 'l' : 'd';
  };
  const gameLine = (g, label) => {
    if (!g) return null;
    const found = otherOf(g);
    // ESPN names an opponent not yet known (a playoff's next round) "TBD".
    const them = found && !/^TBD$/i.test(found.name || '') ? found : null;
    const at = g.home && String(g.home.id) === String(f.id) ? 'vs' : '@';
    const us = sideOf(g);
    const score = g.status.state !== 'pre' && us && them ? `${us.score ?? ''}–${them.score ?? ''}` : '';
    return el('button', { class: 'tf-game', type: 'button', onclick: ev => (ev.stopPropagation(), openEvent(g)) }, [
      el('small', { class: 'muted tf-k', text: label }),
      them ? logo(them.logo, them.name, 'xs') : el('span'),
      el('span', { class: 'tf-opp', text: them ? `${at} ${localSide(g.league, them).name}` : found ? L({ zh: '對手待定', en: 'Opponent to be decided' }) : g.name }),
      g.status.state === 'pre' ? el('small', { class: 'num muted', text: whenText(g.start) }) : el('span', { class: `num tf-score ${result(g)}`, text: g.status.state === 'in' ? `${t('live')} ${score}` : score })
    ]);
  };
  return el('div', { class: 'tf-row' }, [
    el('button', { class: 'tf-team', type: 'button', onclick: () => openTeam(f.league, f.id, f) }, [
      logo(f.logo, f.name, 'tf-logo'),
      el('span', { class: 'tf-name' }, [el('strong', { text: shownName(f) }), el('small', { class: 'muted', text: leagueName(f.league, locale) })]),
      form?.form?.length ? el('span', { class: 'tf-form' }, form.form.map(g => el('i', { class: `tf-dot ${result(g)}`, title: g.name }))) : null
    ]),
    form === null ? el('small', { class: 'muted tf-wait', text: '…' }) : form ? el('div', { class: 'tf-games' }, [gameLine(form.last, L({ zh: '上一場', en: 'Last' })), gameLine(form.next, L({ zh: '下一場', en: 'Next' }))]) : null
  ]);
}

// A followed F1 team: its cars' finishes in the last race, and the next session.
let f1Season = null;
function crewRow(f) {
  if (f1Season === null) {
    f1Season = undefined;
    seasonEvents(f.league)
      .then(list => (f1Season = list || []))
      .catch(() => (f1Season = []))
      .then(() => state.tab === 'following' && renderFollowing());
  }
  const races = f1Season || [];
  const raceOf = e => (e.sessions || []).find(x => x.abbr === 'Race' && x.status.state === 'post');
  const last = [...races].reverse().find(raceOf);
  const next = races.find(e => (e.sessions || []).some(x => x.status.state !== 'post'));
  const mine = d => d?.name && f1Driver(d.name).team === f1Constructor(f.name).name;
  const lastLine = last
    ? el('button', { class: 'tf-game', type: 'button', onclick: ev => (ev.stopPropagation(), openEvent(splitWeekend(last, Date.now(), locale).find(x => x.sessionKey === 'Race') || last)) }, [
        el('small', { class: 'muted tf-k', text: L({ zh: '上一站', en: 'Last' }) }),
        el('span'),
        el('span', { class: 'tf-opp', text: last.name }),
        el('span', { class: 'num tf-score', text: raceOf(last).field.map((d, i) => (mine(d) ? `P${i + 1}` : '')).filter(Boolean).join(' · ') || '–' })
      ])
    : null;
  const nextSession = next && (next.sessions || []).find(x => x.status.state !== 'post');
  const nextLine = nextSession
    ? el('button', { class: 'tf-game', type: 'button', onclick: ev => (ev.stopPropagation(), openEvent(next)) }, [
        el('small', { class: 'muted tf-k', text: L({ zh: '下一站', en: 'Next' }) }),
        el('span'),
        el('span', { class: 'tf-opp', text: next.name }),
        el('small', { class: 'num muted', text: whenText(nextSession.start) })
      ])
    : null;
  return el('div', { class: 'tf-row' }, [
    el('button', { class: 'tf-team', type: 'button', onclick: () => openConstructor({ id: f.id, name: f.name, en: f.name }) }, [constructorBadge(f.name, 'tf-logo'), el('span', { class: 'tf-name' }, [el('strong', { text: shownName(f) }), el('small', { class: 'muted', text: leagueName(f.league, locale) })])]),
    f1Season === undefined ? el('small', { class: 'muted tf-wait', text: '…' }) : el('div', { class: 'tf-games' }, [lastLine, nextLine])
  ]);
}

function leagueBlock(league) {
  if (!state.following.has(league)) loadFollowing(league);
  const slot = state.following.get(league);
  const teams = state.prefs.follows.filter(f => f.league === league && !f.athlete);
  return el('div', { class: 'q-card league-card' }, [
    el('div', { class: 'league-card-head' }, [
      leagueMark(league),
      el('strong', { text: leagueName(league, locale) }),
      el('button', { class: 'section-more', type: 'button', text: t('tab_matches'), onclick: () => openScores(league) }),
      hasStandings(league) ? el('button', { class: 'section-more', type: 'button', text: t('table'), onclick: () => openScores(league, null, 'table') }) : null
    ]),
    teams.length ? el('div', { class: 'team-chips' }, teams.map(f => el('button', { class: 'team-chip', type: 'button', onclick: () => (f.f1team === true ? openConstructor({ id: f.id, name: f.name, en: f.name }) : openTeam(f.league, f.id, f)) }, [f.f1team === true ? constructorBadge(f.name, 'xs') : logo(f.logo, f.name, 'xs'), el('span', { text: shownName(f) })]))) : null,
    !slot?.events ? spinner() : slot.events.length ? el('div', { class: 'list' }, slot.events.map(e => eventRow(e, { league: false }))) : empty(t('noUpcoming')),
    slot?.groups?.length ? el('div', { class: 'mini-table' }, [standingsTables(slot.groups.slice(0, 2), league, { top: 5, compact: true })]) : null
  ]);
}

// ---- 排名, in 賽事: the league's tables -------------------------------------------------------

// A league's tables this season.
const tables = new Map();
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
  return groups.length ? el('div', {}, [standingsTables(groups, league), el('p', { class: 'muted small table-note', text: t('gapHint') })]) : empty(t('noStandings'));
}

// ---- Tabs, refresh, start ---------------------------------------------------------------------

const TAB_ICONS = { home: 'home', matches: 'calendar', live: 'live', following: 'star' };
const tabNav = tabBar({ tabs: TABS.map(id => ({ id, label: t(`tab_${id}`), icon: TAB_ICONS[id] })), onSelect: (tab, { again }) => (again ? tabAgain(tab) : showTab(tab)) });
function renderTabs() {
  tabNav.select(state.tab);
  tabNav.badge('live', dayAll(state.days.get(today())).filter(e => e.status.state === 'in').length);
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
  if (tab === 'live') {
    renderLive();
    if (Date.now() - (state.days.get(today())?.at || 0) > 30_000) loadDay(today());
  }
  if (tab === 'following') renderFollowing();
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

// Live games refresh every 30 seconds while on screen; today every 2 minutes
// in any case (so a followed team's start and finish are noticed).
setInterval(() => {
  if (document.visibilityState !== 'visible' || !q.active) return;
  const day = state.days.get(today());
  const live = dayAll(day).some(e => e.status.state === 'in');
  const age = Date.now() - (day?.at || 0);
  if (((state.tab === 'home' && state.home.date === today()) || state.tab === 'live') && live && age > 25_000) loadDay(today());
  else if (age > 120_000) loadDay(today());
  if (state.tab === 'home' && state.home.date !== today() && Date.now() - (state.days.get(state.home.date)?.at || 0) > 10 * 60_000) loadDay(state.home.date);
  if (state.tab === 'matches' && state.scores.byDay instanceof Map && [...state.scores.byDay.values()].flat().some(e => e.status.state === 'in')) loadScores();
  paintStatus();
  renderTabs();
}, 30_000);

// ELTA's schedule came in: its 📺 channels appear (or go) on the open tab.
let repaintTimer = 0;
knownEvents(() => [...state.days.values()].flatMap(slot => dayAll(slot)));
audioPref(() => state.prefs.audio || 'en');
const repaintOpen = () => {
  clearTimeout(repaintTimer);
  repaintTimer = setTimeout(() => {
    if (document.querySelector('dialog[open]')) return;
    if (state.tab === 'home' && state.days.get(state.home.date)?.at) renderHome();
    if (state.tab === 'live') renderLive();
    if (state.tab === 'matches' && state.scores.byDay instanceof Map && !state.scores.q) renderScores();
    if (state.tab === 'following') renderFollowing();
  }, 250);
};
onTvChange(repaintOpen);

function paintStatus() {
  const at = state.days.get(today())?.at;
  $('status').textContent = at ? t('updated', { time: clock(new Date(at).toISOString()) }) : '';
}
new MutationObserver(() => fitNumbers([...document.querySelectorAll('.mh-score')])).observe(document.body, { childList: true, subtree: true });

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
  window.__bootStep?.(t('loadingGames'), 0.84);
  await loadDay(today());
  window.__bootStep?.(t('loadingPicks'), 0.94);
  await homeReady(until);
  $('loading').hidden = true;
}
if (!gated) boot();
setTimeout(() => ($('loading').hidden = true), BOOT_WAIT + 2000);

if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('./sw.js').catch(() => {});
