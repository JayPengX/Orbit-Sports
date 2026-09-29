// Quadra Fixtures: the sports data centre of Quadra. Every supported sport's
// scores, schedules, match details (box scores, plays, line-ups, win
// probability), standings, teams and players, the way into Quadra Play for
// any match it sells, and a day planned around what the person follows.
// The data is ESPN's (Kambi's for the leagues ESPN doesn't carry), read
// through the Quadra data proxy (lib/espn.mjs).
//
// What the person follows lives on the pass (this app's payload): sports in
// their order of priority, leagues and teams. A copy goes to the wallet
// (setting 'follow:match') so Quadra Play recommends from the same follows.
import { quadraSession, accountButton, installGate, watchUpdates, recordAffinity, affinityPatch, activityPatch, affinity, appUrl, fitNumbers, settingPatch, notify, helpUrl, cachedPayload, cachedWallet, restorePlace, schedulePush, translate, proxyJson } from './lib/quadra.mjs';
import { useSession, scoreboard, standings, teamSchedule, seasonCalendar, weekScoreboard, yyyymmdd, settleField, seasonEvents, splitWeekend } from './lib/espn.mjs';
import { SERVICES, watchable, leaguesOn } from './lib/broadcast.mjs';
import { findLeagues, parseSearch } from './lib/search.mjs';
import { LEAGUES, SPORTS, leagueName, leaguesOf, hasStandings, hasTeams } from './lib/leagues.mjs';
import { detectLocale, makeT } from './lib/i18n.mjs';
import { eventKeys, teamKey, leagueKey } from './lib/foryou.mjs';
import { dayPlan, tableIndex, scoreMatch, DURATION } from './lib/picks.mjs';
import { stageOf } from './lib/stage.mjs';
import { nearestDay } from './lib/days.mjs';
import { ctx, el, put, spinner, empty, $, localDate, today, addDays, onDay, clock, dayLabel, whenText, statusText, sideLine, eventRow, sheet, section, moreButton, logo, leagueChip, leagueMark, twChips, seriesText, segmented, liveLine, fieldNow } from './ui.js';
import { openMatch, openFieldEvent, openTeam, openPlayer, standingsTables } from './sheets.js';

const locale = detectLocale();
const t = makeT(locale);
const L = obj => (locale === 'en' ? obj.en : obj.zh);
document.documentElement.lang = locale === 'zh' ? 'zh-Hant' : 'en';
const TABS = ['home', 'matches', 'live', 'following'];

const state = {
  tab: 'home',
  prefs: { sports: [], leagues: [], follows: [], tv: [] },
  prefsLoaded: false,
  wallet: null,
  // The days read so far: date -> { events, at, loading }.
  days: new Map(),
  home: { date: today(), filter: 'all', shown: 20, teams: new Map(), tables: {}, sportDays: new Map(), autoDay: true, tablesPending: 0, settled: false },
  scores: { sport: 'soccer', league: 'epl', date: null, byDay: null, days: [], extra: 0, loading: false, mode: 'days', stage: 'all', view: 'games' },
  following: new Map(),
};

const q = quadraSession('match', { lang: locale });
useSession(q);
Object.assign(ctx, { t, locale, state, q, openEvent, openTeam, openPlayer, isFollowed, toggleFollow, track, isFollowedEvent });

// ---- What the person follows (on the pass) ---------------------------------------------

function applyPrefs(payload) {
  try {
    const p = payload ? JSON.parse(payload) : null;
    if (p?.v === 3) state.prefs = { sports: p.sports || [], leagues: p.leagues || [], follows: p.follows || [], tv: p.tv || [] };
    else if (p?.v === 2 && Array.isArray(p.follows)) {
      // Teams only, before: their sports and leagues follow from them.
      const leagues = [...new Set(p.follows.map(f => f.league).filter(k => LEAGUES[k]))];
      state.prefs = { sports: [...new Set(leagues.map(k => LEAGUES[k].sport))], leagues, follows: p.follows, tv: [] };
    }
  } catch {}
  state.prefs.sports = state.prefs.sports.filter(s => SPORTS[s]);
  state.prefs.leagues = state.prefs.leagues.filter(k => LEAGUES[k]);
  state.prefs.tv = (state.prefs.tv || []).filter(id => SERVICES.some(x => x.id === id));
  state.prefsLoaded = true;
}
let saveTimer = 0;
function savePrefs() {
  clearTimeout(saveTimer);
  const { sports, leagues, follows, tv } = state.prefs;
  // Play's copy: the follows, by its own league keys.
  const forPlay = { sports, leagues: leagues.map(leagueKey), teams: follows.map(f => ({ league: leagueKey(f.league), name: f.name })) };
  saveTimer = setTimeout(() => {
    q.write({ payload: JSON.stringify({ v: 3, sports, leagues, follows, tv, t: Date.now() }), wallet: { settings: { ...affinityPatch('match').settings, ...settingPatch('follow:match', forPlay).settings } } }).catch(() => {});
  }, 800);
}
function isFollowed(league, id) {
  return state.prefs.follows.some(f => f.league === league && f.id === id);
}
function isFollowedEvent(e) {
  if (e.kind === 'match') return isFollowed(e.league, e.home?.id) || isFollowed(e.league, e.away?.id);
  // A race, tournament or fight card with a followed player in it.
  const people = [...(e.sessions || []).flatMap(x => x.field || []), ...(e.bouts || []).flatMap(b => [b.a, b.b]), ...(e.draws || []).flatMap(d => d.matches.flatMap(m => [m.a, m.b]))];
  return people.some(p => p && isFollowed(e.league, p.id));
}
function toggleFollow(league, side) {
  const p = state.prefs;
  if (isFollowed(league, side.id)) p.follows = p.follows.filter(f => !(f.league === league && f.id === side.id));
  else {
    p.follows = [...p.follows, { league, id: side.id, name: side.name, logo: side.logo, ...(side.athlete ? { athlete: true } : {}) }];
    // Following a team follows its league and sport too.
    if (!p.leagues.includes(league)) p.leagues = [...p.leagues, league];
    if (!p.sports.includes(LEAGUES[league].sport)) p.sports = [...p.sports, LEAGUES[league].sport];
    recordAffinity('match', [teamKey(league, side.name), `league:${leagueKey(league)}`], 4);
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
    recordAffinity('match', [`sport:${sport === 'tennis' || sport === 'racket' ? 'sets' : sport}`], 3);
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
function openFollowEditor() {
  const s = sheet(t('editFollows'));
  const paint = () => {
    const p = state.prefs;
    put(
      s.body,
      el('p', { class: 'section-sub', text: t('editHint') }),
      el('h3', { class: 'section-h', text: t('yourSports') }),
      p.sports.length
        ? el(
            'ol',
            { class: 'order-list' },
            p.sports.map((sp, i) =>
              el('li', {}, [
                el('span', { class: 'order-n num', text: String(i + 1) }),
                el('span', { class: 'order-name', text: `${SPORTS[sp].icon} ${L(SPORTS[sp])}` }),
                el('button', { class: 'icon-btn', type: 'button', 'aria-label': t('moveUp'), disabled: i === 0 ? true : null, text: '↑', onclick: () => (moveSport(sp, -1), paint()) }),
                el('button', { class: 'icon-btn', type: 'button', 'aria-label': t('moveDown'), disabled: i === p.sports.length - 1 ? true : null, text: '↓', onclick: () => (moveSport(sp, 1), paint()) }),
                el('button', { class: 'icon-btn', type: 'button', 'aria-label': t('unfollow'), text: '✕', onclick: () => (toggleSport(sp), paint()) })
              ])
            )
          )
        : el('p', { class: 'muted small', text: t('noSportsYet') }),
      el('div', { class: 'q-chips wrap' }, Object.entries(SPORTS).filter(([k]) => !p.sports.includes(k)).map(([k, sp]) => el('button', { class: 'q-chip', type: 'button', text: `+ ${sp.icon} ${L(sp)}`, onclick: () => (toggleSport(k), paint()) }))),
      ...p.sports.map(sp =>
        el('div', { class: 'league-pick' }, [
          el('h3', { class: 'section-h', text: `${SPORTS[sp].icon} ${L(SPORTS[sp])} · ${t('leagues')}` }),
          el('div', { class: 'q-chips wrap' }, leaguesOf(sp).map(k => el('button', { class: `q-chip${p.leagues.includes(k) ? ' on' : ''}`, type: 'button', 'aria-pressed': String(p.leagues.includes(k)), text: `${p.leagues.includes(k) ? '✓ ' : ''}${leagueName(k, locale)}`, onclick: () => (toggleLeague(k), paint()) })))
        ])
      ),
      el('h3', { class: 'section-h', text: t('yourTeams') }),
      p.follows.length
        ? el('ul', { class: 'order-list' }, p.follows.map(f => el('li', {}, [logo(f.logo, f.name, `sm${f.athlete ? ' round' : ''}`), el('span', { class: 'order-name', text: `${f.name} · ${leagueName(f.league, locale)}` }), el('button', { class: 'icon-btn', type: 'button', 'aria-label': t('unfollow'), text: '✕', onclick: () => (toggleFollow(f.league, f), paint()) })])))
        : el('p', { class: 'muted small', text: t('teamsHint') }),
      el('h3', { class: 'section-h', text: `📺 ${t('tvPick')}` }),
      el('p', { class: 'muted small', text: t('tvHint') }),
      tvChips(paint)
    );
  };
  paint();
}

// ---- Opening things ------------------------------------------------------------------------

// The first match opened today counts for Rewards' daily mission.
let openedToday = '';
function openEvent(e) {
  const day = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
  track(openedToday === day ? null : 'open', eventKeys(e), 1);
  openedToday = day;
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
function otherLeagues() {
  const mine = new Set(pickLeagues());
  return leaguesOn(state.prefs.tv)
    .filter(k => LEAGUES[k] && !mine.has(k))
    .sort((a, b) => Boolean(LEAGUES[b].top) - Boolean(LEAGUES[a].top));
}
// On the person's services (every match when they haven't said which).
const onMyTv = e => !state.prefs.tv.length || watchable(e.league, state.prefs.tv);
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
    if (saved?.date === today() && saved.leagues === pickLeagues().join() && Date.now() - saved.at < 6 * 3_600_000) state.days.set(saved.date, { events: saved.events, at: saved.at, loading: false, stale: true });
  } catch {}
}

// A day of picks is the hours Taiwan is awake, 05:00 to midnight: a game
// starting between midnight and 5 (Europe's evenings, America's afternoons)
// is while everyone sleeps, and isn't recommended on either day.
const AWAKE_FROM = 5;
const inPickDay = (ms, date) => ms >= Date.parse(`${date}T${String(AWAKE_FROM).padStart(2, '0')}:00:00`) && ms < Date.parse(`${addDays(date, 1)}T00:00:00`);

// A day's events of these leagues (races split into their sessions).
async function readDay(leagues, date) {
  const dates = espnDaysOf(date);
  const isToday = date === today();
  const lists = await Promise.all(
    leagues.map(k => {
      const l = LEAGUES[k];
      if (l.kind !== 'match') return (isToday ? scoreboard(k) : seasonEvents(k)).catch(() => []);
      return scoreboard(k, l.espn ? dates : undefined).catch(() => []);
    })
  );
  const now = Date.now();
  return lists
    .flat()
    .flatMap(e => (e.sessions ? splitWeekend(e, now, locale) : [e]))
    .map(e => (e.sessions ? settleField(e, now) : e))
    .map(e => (e.at ? { ...e, start: e.at } : e))
    .filter(e => (isToday && e.status.state === 'in') || inPickDay(Date.parse(e.start), date) || (!e.sessionKey && e.kind !== 'match' && e.status.state !== 'post' && e.end && Date.parse(e.start) <= Date.parse(`${date}T23:59:59`) && Date.parse(e.end) >= Date.parse(`${date}T00:00:00`)));
}
function repaintDay(date) {
  paintStatus();
  renderTabs();
  if (state.tab === 'home' && state.home.date === date) renderHome();
  if (state.tab === 'live' && date === today()) renderLive();
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
  try {
    const events = await readDay(pickLeagues(), date);
    if (isToday) noticeChanges(events);
    Object.assign(slot, { events, at: Date.now(), stale: false });
    if (isToday) saveDay(date, slot);
  } catch {
    if (!slot.at) slot.at = Date.now();
    slot.stale = false;
  } finally {
    slot.loading = false;
  }
  // The others again too, once they've been read for this day.
  if (slot.othersAt) loadOthers(date);
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
    if (e.kind !== 'match' || seen.has(key) || e.status?.state === 'post' || e.status?.void) continue;
    seen.add(key);
    const start = Date.parse(e.start);
    if (!(start > now - 4 * 3_600_000 && start < now + 8 * 86_400_000)) continue;
    const league = leagueName(e.league, locale);
    if (start > now) items.push({ at: start, title: matchLine(e), body: `${league} ${L(NOTICE_TEXT.start)}`, tag: `start:${key}`, hash: 'home', kind: 'start' });
    // The Worker fills in the score as the title once ESPN has the final.
    if (LEAGUES[e.league].espn && /^\d+$/.test(e.id)) items.push({ at: Math.max(now + 60_000, start + (DURATION[LEAGUES[e.league].sport] || 150) * 60_000), title: matchLine(e), body: `${league} ${L(NOTICE_TEXT.end)}`, tag: `end:${key}`, hash: 'home', kind: 'end', check: { espn: LEAGUES[e.league].espn, event: e.id } });
  }
  schedulePush(q, items);
}

// A notice's words: the teams (and the score) on top, the league and what
// happened below.
const NOTICE_TEXT = { start: { zh: '開賽了', en: 'game started' }, end: { zh: '比賽結束', en: 'final' } };
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
    if (e.status.state === 'post') notify(q, { title: matchLine(e, true), body: `${league} ${L(NOTICE_TEXT.end)}`, tag: `end:${key}`, hash: 'home', kind: 'end' });
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
  const reasons = item.reasons.filter(r => r !== 'tv').slice(0, 2).map(r => (r === 'priority' ? `${SPORTS[LEAGUES[e.league].sport].icon} ${REASON(r)}` : REASON(r)));
  const tag = stageOf(e).special ? (stageOf(e).round?.[locale === 'en' ? 'en' : 'zh'] || stageOf(e)[locale === 'en' ? 'en' : 'zh']) : '';
  const series = seriesText(e);
  return el('button', { class: `pick-card${e.status.state === 'in' ? ' live' : ''}`, type: 'button', onclick: () => openEvent(e) }, [
    el('div', { class: 'pick-time' }, [
      el('strong', { class: 'num', text: e.status.state === 'in' ? '●' : e.status.state === 'post' ? t('final') : clock(e.start) }),
      el('small', { text: e.status.state === 'in' ? statusText(e) : n === 0 ? t('firstUp') : '' })
    ]),
    el('div', { class: 'pick-body' }, [
      el('div', { class: 'pick-top' }, [leagueChip(e.league), tag ? el('span', { class: 'stage-tag', text: tag }) : null]),
      e.kind === 'match' ? el('div', { class: 'card-sides' }, [sideLine(e.away, e, false), sideLine(e.home, e, false)]) : el('strong', { class: 'pick-title', text: e.session ? `${e.name} · ${e.session}` : e.name }),
      series ? el('small', { class: 'series-line', text: series }) : null,
      liveLine(e),
      e.kind !== 'match' && e.status.state === 'in' && fieldNow(e) ? el('small', { class: 'live-line', text: fieldNow(e) }) : null,
      reasons.length ? el('div', { class: 'why-row' }, reasons.map(r => el('span', { class: 'why', text: r }))) : null,
      twChips(e.league, 2)
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

// The date strip's days: three back, a week ahead.
const STRIP = { from: -3, to: 7 };
function dateStrip(current, onPick, { from = STRIP.from, to = STRIP.to, only = null } = {}) {
  const days = [];
  for (let i = from; i <= to; i++) days.push(addDays(today(), i));
  if (only) days.splice(0, days.length, ...days.filter(d => only.has(d)));
  return el(
    'div',
    { class: 'q-chips day-strip' },
    days.map(d => {
      const dt = new Date(`${d}T12:00:00`);
      return el('button', { class: `q-chip day${d === today() ? ' is-today' : ''}`, type: 'button', 'aria-pressed': String(d === current), onclick: () => onPick(d) }, [
        el('span', { text: d === today() ? t('today') : d === addDays(today(), 1) ? t('tomorrow') : d === addDays(today(), -1) ? t('yesterday') : dt.toLocaleDateString(locale === 'en' ? 'en-US' : 'zh-TW', { weekday: 'short' }) }),
        el('small', { class: 'num', text: `${dt.getMonth() + 1}/${dt.getDate()}` })
      ]);
    })
  );
}

function renderHome() {
  const box = $('panel-home');
  const h = state.home;
  const slot = state.days.get(h.date);
  h.settled = false;
  if (!slot?.at) {
    if (!slot?.loading) loadDay(h.date);
    put(box, homeHead(), spinner());
    centerChosen(box);
    return;
  }
  const now = Date.now();
  const pctx = { sports: state.prefs.sports, leagues: state.prefs.leagues, follows: state.prefs.follows, tables: h.tables, aff: affinity(state.wallet), now };
  const past = h.date < today();
  // The picks of a list: the plan and the rest (a past day ranked as it
  // stood before, shown with the real results).
  const rank = (list, also = 999, ctx = pctx) => {
    const { plan, also: rest } = dayPlan(past ? list.map(e => ({ ...e, status: { ...e.status, state: 'pre' } })) : list, ctx, { n: 6, also });
    const real = new Map(list.map(e => [`${e.league}:${e.id}`, e]));
    const fix = items => items.map(x => ({ ...x, event: real.get(`${x.event.league}:${x.event.id}`) || x.event }));
    return [fix(plan), fix(rest)];
  };
  const mine = slot.events.filter(onMyTv);
  let [planList, more] = rank(filtered(mine));
  // Nothing of theirs on (on their services): the best of the rest there.
  // Opened on a day with nothing of theirs: the next day they have games.
  if (!planList.length && h.filter === 'all' && h.autoDay && h.date === today() && state.prefs.sports.length) {
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
  const teamRows = isToday
    ? state.prefs.follows.map(f => {
        const list = state.home.teams.get(`${f.league}:${f.id}`) || [];
        const next = list.find(x => x.status.state !== 'post' && Date.parse(x.start) > now - 4 * 3_600_000);
        const last = [...list].reverse().find(x => x.status.state === 'post');
        const e = next || last;
        return el('div', { class: 'follow-row' }, [
          el('button', { class: 'follow-team', type: 'button', onclick: () => (f.athlete ? openPlayer(f.league, f.id) : openTeam(f.league, f.id, f)) }, [logo(f.logo, f.name, `sm${f.athlete ? ' round' : ''}`), el('span', { text: f.name })]),
          e ? eventRow(e, { league: false }) : el('small', { class: 'muted', text: leagueName(f.league, locale) })
        ]);
      })
    : [];
  const bets = isToday ? (state.wallet?.snap?.odds?.slips || []).flatMap(slip => slip.l.map(leg => ({ ...leg, slip }))) : [];
  const betRows = bets
    .filter(b => b.s && Date.parse(b.s) > now - 4 * 3_600_000)
    .slice(0, 6)
    .map(b =>
      el('a', { class: 'bet-row', href: appUrl('odds', 'history'), onclick: ev => (ev.preventDefault(), q.go('odds', 'history')) }, [
        el('span', { class: 'event-status pre', text: whenText(b.s) }),
        el('span', { class: 'bet-pick', text: b.p }),
        el('strong', { class: 'num', text: `@${b.o}` })
      ])
    );
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
    fallback || finding ? el('div', { class: 'q-card pad none-mine' }, [el('strong', { text: hasFollows ? t(isToday ? 'noMineToday' : 'noMineDay') : t('noFollowsYet') }), el('p', { class: 'muted small', text: finding ? t('findingOthers') : planList.length ? t('othersSub') : t('noOthers') })]) : null,
    finding ? spinner() : null,
    planList.length
      ? section(fallback ? t('othersPicks') : isToday ? t('todayPicks') : `${dayLabel(h.date)} · ${t('picksOn')}`, el('div', { class: 'pick-list' }, planList.map(pickCard)), { sub: fallback ? '' : t('recsN', { n: planList.length + more.length }) })
      : finding || fallback ? null : section(t('todayPicks'), empty(t(h.filter === 'all' ? 'noRecs' : 'noPicksMine'))),
    shownMore.length
      ? section(t('moreRecs'), el('div', { class: 'q-card list' }, shownMore.map(x => eventRow(x.event))), {
          action: null
        })
      : null,
    more.length > h.shown ? el('button', { class: 'q-btn block show-more', type: 'button', text: `${t('showMore')} (${more.length - h.shown})`, onclick: () => ((h.shown += 30), renderHome()) }) : null,
    teamRows.length ? section(t('yourTeams'), el('div', { class: 'q-card list' }, teamRows), { action: moreButton(t('seeAll'), () => showTab('following')) }) : null,
    betRows.length ? section(t('yourBets'), el('div', { class: 'q-card list' }, betRows)) : null
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
            { only: days }
          )
  ]);
}
// Every followed sport as a filter, whether it plays today or not: picking
// one keeps the date strip to the days it plays and goes to the nearest.
function sportChips() {
  const h = state.home;
  const filters = [['all', t('f_all')], ...(state.prefs.follows.length ? [['teams', t('f_teams')]] : []), ...state.prefs.sports.map(sp => [sp, `${SPORTS[sp].icon} ${L(SPORTS[sp])}`])];
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
// The days (from three days ago to a week ahead) a followed sport's leagues
// play on the person's services.
async function sportDays(sport) {
  const leagues = pickLeagues().filter(k => LEAGUES[k].sport === sport);
  const from = addDays(today(), STRIP.from);
  const to = addDays(today(), STRIP.to);
  const usFrom = yyyymmdd(new Date(Date.parse(`${from}T00:00:00`) - 12 * 3_600_000));
  const usTo = yyyymmdd(new Date(Date.parse(`${to}T23:59:59`)));
  const lists = await Promise.all(
    leagues.map(async k => {
      const l = LEAGUES[k];
      if (l.kind !== 'match') return seasonEvents(k).catch(() => []);
      if (l.kambi) return scoreboard(k).catch(() => []);
      const cal = await seasonCalendar(k).catch(() => null);
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
  return el('button', { class: 'tv-row', type: 'button', onclick: openTvEditor }, [el('span', { class: 'tv-row-k', text: `📺 ${t('tvMine')}` }), el('span', { class: 'tv-row-v', text: tvNames() }), el('span', { class: 'tv-row-go', 'aria-hidden': 'true', text: '›' })]);
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
        text: `${tv.includes(x.id) ? '✓ ' : ''}${L(x)}`,
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
  }
  if (state.tab === 'home') renderHome();
}
function openTvEditor() {
  const s = sheet(t('tvPick'));
  const paint = () => put(s.body, el('p', { class: 'section-sub', text: t('tvHint') }), tvChips(paint), state.prefs.tv.length ? el('button', { class: 'q-btn block', type: 'button', text: t('tvClear'), onclick: () => ((state.prefs.tv = []), tvChanged(), paint()) }) : null);
  paint();
}

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

// A day's events: the followed leagues' and, once read, the others'.
function dayAll(slot) {
  const seen = new Set();
  return [...(slot?.events || []), ...(slot?.others || [])].filter(e => !seen.has(`${e.league}:${e.id}`) && seen.add(`${e.league}:${e.id}`));
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
  const now = Date.now();
  const all = dayAll(slot);
  const live = all.filter(e => e.status.state === 'in');
  const soon = all.filter(e => e.status.state === 'pre' && !e.status.void && Date.parse(e.start) - now < 3 * 3_600_000 && Date.parse(e.start) > now - 15 * 60_000).sort((a, b) => a.start.localeCompare(b.start));
  const bySport = list => {
    const groups = new Map();
    for (const e of list) {
      const sp = LEAGUES[e.league]?.sport;
      if (!groups.has(sp)) groups.set(sp, []);
      groups.get(sp).push(e);
    }
    return [...groups].sort(([a], [b]) => (state.prefs.sports.indexOf(a) + 1 || 99) - (state.prefs.sports.indexOf(b) + 1 || 99));
  };
  const mineFirst = list => [...list].sort((a, b) => isFollowedEvent(b) - isFollowedEvent(a));
  put(
    box,
    el('div', { class: 'home-hero' }, [el('div', {}, [el('p', { class: 'hero-kicker live-kicker', text: `● ${t('liveNow')}` }), el('h2', { class: 'hero-title', text: live.length ? `${live.length} ${locale === 'en' ? 'live' : '場進行中'}` : t('liveEmpty') })])]),
    ...bySport(mineFirst(live)).map(([sp, list]) => section(`${SPORTS[sp]?.icon || ''} ${L(SPORTS[sp] || { zh: '', en: '' })}`, el('div', { class: 'q-card list' }, list.map(e => eventRow(e))))),
    soon.length ? section(t('startingSoon'), el('div', { class: 'q-card list' }, mineFirst(soon).slice(0, 30).map(e => eventRow(e)))) : null
  );
}

// ---- 賽事: every sport, league and game day ------------------------------------------------------

function openScores(league, date, view = 'games') {
  state.scores = { ...state.scores, sport: LEAGUES[league].sport, league, date: date || null, byDay: null, days: [], extra: 0, stage: 'all', touched: true, view: hasStandings(league) ? view : 'games' };
  if (state.tab === 'matches') loadScores();
  else showTab('matches');
}

// Which days (or weeks) to read, then the games of each, grouped by the
// viewer's own day: the strip shows only days with games. Races, tours and
// fight promotions: the whole season, past and to come.
async function loadScores() {
  const sc = state.scores;
  const league = sc.league;
  const l = LEAGUES[league];
  const key = `${league}|${sc.extra}`;
  sc.loadingKey = key;
  sc.loading = true;
  renderScores();
  track(null, [`league:${leagueKey(league)}`], 0.3);
  let events = [];
  try {
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
    } else {
      sc.mode = 'days';
      const cal = await seasonCalendar(league).catch(() => null);
      if (cal?.weeks) {
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
  } catch {
    if (sc.loadingKey === key) sc.byDay = 'failed';
  }
  if (sc.loadingKey !== key) return;
  sc.loading = false;
  if (sc.byDay !== 'failed' || events.length) {
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
    // The day shown: the one asked for, else one with a game on now, else
    // today's or the next game day (within a few days: a break shows the
    // latest round instead), else the nearest.
    const liveDay = sc.days.find(d => byDay.get(d).some(e => e.status.state === 'in'));
    const next = sc.days.find(d => d >= today() && d <= addDays(today(), 4));
    if (!sc.date || !byDay.has(sc.date)) sc.date = liveDay || next || nearestDay(sc.days) || today();
  }
  renderScores();
}

// The search box stays put (it keeps its focus and caret while typing); the
// rest of the page is drawn under it.
let scoresBody = null;
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
      leagues.length ? section(t('leagues'), el('div', { class: 'q-card list' }, leagues.slice(0, 8).map(k => el('button', { class: 'search-row', type: 'button', onclick: () => openScores(k) }, [leagueMark(k, 'lg-mark mid'), el('span', { text: leagueName(k, locale) }), el('small', { text: `${SPORTS[LEAGUES[k].sport].icon} ${L(SPORTS[LEAGUES[k].sport])}` })])))) : null,
      found?.teams.length ? section(t('teamsFound'), el('div', { class: 'q-card list' }, found.teams.slice(0, 10).map(x => el('button', { class: 'search-row', type: 'button', onclick: () => openTeam(x.league, x.id, x) }, [logo(x.logo, x.name, 'sm'), el('span', { text: x.name }), el('small', { text: leagueName(x.league, locale) })])))) : null,
      found?.players.length ? section(t('playersFound'), el('div', { class: 'q-card list' }, found.players.slice(0, 10).map(x => el('button', { class: 'search-row', type: 'button', onclick: () => openPlayer(x.league, x.id) }, [logo(x.logo, x.name, 'sm round'), el('span', { text: x.name }), el('small', { text: leagueName(x.league, locale) })])))) : null,
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
        text: `${SPORTS[key].icon} ${L(SPORTS[key])}`,
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
      .map(k => el('button', { class: 'q-chip', type: 'button', 'aria-pressed': String(sc.league === k), onclick: () => ((state.scores = { ...sc, league: k, date: null, byDay: null, days: [], extra: 0, stage: 'all', touched: true, view: hasStandings(k) ? sc.view : 'games' }), loadScores()) }, [leagueMark(k), `${mine.has(k) ? '★ ' : ''}${leagueName(k, locale)}`]))
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
    strip = el('div', { class: 'q-chips day-strip' }, [
      LEAGUES[sc.league].espn ? el('button', { class: 'q-chip more', type: 'button', text: '‹', 'aria-label': t('moreDays'), onclick: () => ((sc.extra += 1), loadScores()) }) : null,
      ...sc.days.map(d =>
        el('button', { class: `q-chip day${d === today() ? ' is-today' : ''}`, type: 'button', 'aria-pressed': String(sc.date === d), onclick: () => ((sc.date = d), renderScores()) }, [el('span', { text: dayLabel(d) }), el('small', { class: 'num', text: String(sc.byDay.get(d).length) })])
      ),
      LEAGUES[sc.league].espn ? el('button', { class: 'q-chip more', type: 'button', text: '›', 'aria-label': t('moreDays'), onclick: () => ((sc.extra += 1), loadScores()) }) : null
    ]);
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
      el('button', { class: `q-chip small${mine.has(sc.league) ? ' on' : ''}`, type: 'button', text: mine.has(sc.league) ? `✓ ${t('following')}` : `+ ${t('followLeague')}`, onclick: () => (!state.prefs.sports.includes(sc.sport) && toggleSport(sc.sport), toggleLeague(sc.league), renderScores()) })
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
  const head = el('div', { class: 'home-hero' }, [
    el('div', {}, [el('p', { class: 'hero-kicker', text: t('yourSports') }), el('div', { class: 'prio-row' }, p.sports.map((sp, i) => el('span', { class: 'prio', text: `${i + 1} ${SPORTS[sp].icon} ${L(SPORTS[sp])}` })))]),
    el('button', { class: 'q-btn small', type: 'button', text: t('editFollows'), onclick: openFollowEditor })
  ]);
  const people = p.follows.filter(f => f.athlete);
  const blocks = p.sports.map(sp => {
    const leagues = followedLeagues().filter(k => LEAGUES[k].sport === sp);
    return el('section', { class: 'q-section follow-sport' }, [
      el('div', { class: 'q-section-head' }, [el('h2', { text: `${SPORTS[sp].icon} ${L(SPORTS[sp])}` })]),
      leagues.length ? null : el('p', { class: 'muted small', text: t('noLeaguesYet') }),
      ...leagues.map(k => leagueBlock(k))
    ]);
  });
  put(
    box,
    head,
    people.length ? section(t('yourPlayers'), el('div', { class: 'team-chips loose' }, people.map(f => el('button', { class: 'team-chip', type: 'button', onclick: () => openPlayer(f.league, f.id) }, [logo(f.logo, f.name, 'xs round'), el('span', { text: f.name })])))) : null,
    ...blocks
  );
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
    teams.length ? el('div', { class: 'team-chips' }, teams.map(f => el('button', { class: 'team-chip', type: 'button', onclick: () => openTeam(f.league, f.id, f) }, [logo(f.logo, f.name, 'xs'), el('span', { text: f.name })]))) : null,
    !slot?.events ? spinner() : slot.events.length ? el('div', { class: 'list' }, slot.events.map(e => eventRow(e, { league: false }))) : empty(t('noUpcoming')),
    slot?.groups?.length ? el('div', { class: 'mini-table' }, [standingsTables(slot.groups.slice(0, 2), league, { top: 5, compact: true })]) : null
  ]);
}

// ---- 排名, in 賽事: the league's tables -------------------------------------------------------

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

function renderTabs() {
  for (const tab of TABS) {
    const b = $(`tab-${tab}`);
    b.setAttribute('aria-selected', String(state.tab === tab));
    b.querySelector('span').textContent = t(`tab_${tab}`);
    $(`panel-${tab}`).hidden = state.tab !== tab;
  }
  const live = dayAll(state.days.get(today())).filter(e => e.status.state === 'in').length;
  const badge = $('tab-live').querySelector('.tab-badge');
  if (badge) {
    badge.textContent = live ? String(live) : '';
    badge.hidden = !live;
  }
}
// Each tab keeps its place: switching back returns to where it was.
const scrollOf = {};
function showTab(tab) {
  if (state.tab !== tab) scrollOf[state.tab] = window.scrollY;
  const same = state.tab === tab;
  state.tab = tab;
  try {
    history.replaceState(null, '', `#${tab}`);
  } catch {}
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
  window.scrollTo({ top: same ? 0 : scrollOf[tab] || 0 });
}
for (const b of document.querySelectorAll('#tabs .tab')) b.addEventListener('click', () => showTab(b.dataset.tab));

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

function paintStatus() {
  const at = state.days.get(today())?.at;
  const text = at ? t('updated', { time: clock(new Date(at).toISOString()) }) : '';
  $('status').textContent = text;
  $('status-mini').textContent = text;
}
{
  const phone = matchMedia('(max-width: 720px)');
  const place = () => {
    if (phone.matches) $('mobile-bar').append($('help-link'), $('account-slot'));
    else document.querySelector('.appbar-inner').append($('help-link'), $('account-slot'));
  };
  place();
  phone.addEventListener('change', place);
}
new MutationObserver(() => fitNumbers([...document.querySelectorAll('.mh-score')])).observe(document.body, { childList: true, subtree: true });

window.__fxStarted = true;
const gated = installGate('match', locale);
watchUpdates({ current: document.querySelector('meta[name="build-version"]')?.content, key: 'quadraFixtures', cachePrefix: 'quadra-fixtures-' });
renderTabs();
$('account-slot').append(accountButton(q));
$('help-link').href = helpUrl('match');
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
  await loadDay(today());
  await homeReady(until);
  $('loading').hidden = true;
}
if (!gated) boot();
setTimeout(() => ($('loading').hidden = true), BOOT_WAIT + 2000);

if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('./sw.js').catch(() => {});
