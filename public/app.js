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
import { quadraSession, accountButton, installGate, watchUpdates, recordAffinity, affinityPatch, activityPatch, affinity, appUrl, fitNumbers, settingPatch, notify, helpUrl } from './lib/quadra.mjs';
import { useSession, scoreboard, standings, teamSchedule, seasonCalendar, weekScoreboard, yyyymmdd } from './lib/espn.mjs';
import { LEAGUES, SPORTS, leagueName, leaguesOf, TOP_LEAGUES, hasStandings, hasTeams, leagueLogo } from './lib/leagues.mjs';
import { detectLocale, makeT } from './lib/i18n.mjs';
import { eventKeys, teamKey, leagueKey } from './lib/foryou.mjs';
import { dayPlan, tableIndex } from './lib/picks.mjs';
import { ctx, el, put, spinner, empty, $, localDate, today, addDays, onDay, clock, dayLabel, whenText, statusText, sideLine, eventRow, sheet, section, moreButton, logo, leagueChip } from './ui.js';
import { openMatch, openFieldEvent, openTeam, openPlayer, standingsTables } from './sheets.js';

const locale = detectLocale();
const t = makeT(locale);
const L = obj => (locale === 'en' ? obj.en : obj.zh);
document.documentElement.lang = locale === 'zh' ? 'zh-Hant' : 'en';
const TABS = ['home', 'scores', 'following', 'standings'];

const state = {
  tab: 'home',
  prefs: { sports: [], leagues: [], follows: [] },
  prefsLoaded: false,
  wallet: null,
  home: { events: [], loading: false, at: 0, teams: new Map(), tables: {} },
  scores: { sport: 'soccer', league: 'epl', date: today(), byDay: null, days: [], extra: 0, loading: false, mode: 'days' },
  following: new Map(),
  standings: { league: null, groups: null }
};

const q = quadraSession('match', { lang: locale });
useSession(q);
Object.assign(ctx, { t, locale, state, q, openEvent, openTeam, openPlayer, isFollowed, toggleFollow, track, isFollowedEvent });

// ---- What the person follows (on the pass) ---------------------------------------------

function applyPrefs(payload) {
  try {
    const p = payload ? JSON.parse(payload) : null;
    if (p?.v === 3) state.prefs = { sports: p.sports || [], leagues: p.leagues || [], follows: p.follows || [] };
    else if (p?.v === 2 && Array.isArray(p.follows)) {
      // Teams only, before: their sports and leagues follow from them.
      const leagues = [...new Set(p.follows.map(f => f.league).filter(k => LEAGUES[k]))];
      state.prefs = { sports: [...new Set(leagues.map(k => LEAGUES[k].sport))], leagues, follows: p.follows };
    }
  } catch {}
  state.prefs.sports = state.prefs.sports.filter(s => SPORTS[s]);
  state.prefs.leagues = state.prefs.leagues.filter(k => LEAGUES[k]);
  state.prefsLoaded = true;
}
let saveTimer = 0;
function savePrefs() {
  clearTimeout(saveTimer);
  const { sports, leagues, follows } = state.prefs;
  // Play's copy: the follows, by its own league keys.
  const forPlay = { sports, leagues: leagues.map(leagueKey), teams: follows.map(f => ({ league: leagueKey(f.league), name: f.name })) };
  saveTimer = setTimeout(() => {
    q.write({ payload: JSON.stringify({ v: 3, sports, leagues, follows, t: Date.now() }), wallet: { settings: { ...affinityPatch('match').settings, ...settingPatch('follow:match', forPlay).settings } } }).catch(() => {});
  }, 800);
}
function isFollowed(league, id) {
  return state.prefs.follows.some(f => f.league === league && f.id === id);
}
function isFollowedEvent(e) {
  return e.kind === 'match' && (isFollowed(e.league, e.home?.id) || isFollowed(e.league, e.away?.id));
}
function toggleFollow(league, side) {
  const p = state.prefs;
  if (isFollowed(league, side.id)) p.follows = p.follows.filter(f => !(f.league === league && f.id === side.id));
  else {
    p.follows = [...p.follows, { league, id: side.id, name: side.name, logo: side.logo }];
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
  state.home.at = 0;
  state.following.clear();
  if (state.tab === 'home') loadHome();
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
        ? el('ul', { class: 'order-list' }, p.follows.map(f => el('li', {}, [logo(f.logo, f.name, 'sm'), el('span', { class: 'order-name', text: `${f.name} · ${leagueName(f.league, locale)}` }), el('button', { class: 'icon-btn', type: 'button', 'aria-label': t('unfollow'), text: '✕', onclick: () => (toggleFollow(f.league, f), paint()) })])))
        : el('p', { class: 'muted small', text: t('teamsHint') })
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

// ---- Home: the day planned around what you follow ----------------------------------------

// The leagues home reads: followed ones first (in priority order), then the
// ones the person is into (every app's affinity), then the headline ones.
function homeLeagues() {
  const aff = affinity(state.wallet);
  const byPlay = Object.fromEntries(Object.entries(LEAGUES).map(([k, l]) => [l.play || k, k]));
  const liked = Object.entries(aff)
    .filter(([k]) => k.startsWith('league:'))
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => byPlay[k.slice(7)])
    .filter(Boolean);
  const followedSportsTop = state.prefs.sports.flatMap(sp => leaguesOf(sp).filter(k => LEAGUES[k].top));
  const set = new Set([...followedLeagues(), ...state.prefs.follows.map(f => f.league), ...followedSportsTop, ...liked.slice(0, 5), ...(state.prefs.sports.length ? [] : TOP_LEAGUES)]);
  return [...set].filter(k => LEAGUES[k]).slice(0, 18);
}
const espnDaysOf = date => {
  const start = new Date(`${date}T00:00:00`).getTime();
  return [...new Set([yyyymmdd(new Date(start - 11 * 3_600_000)), yyyymmdd(new Date(start + 12 * 3_600_000)), yyyymmdd(new Date(start + 23 * 3_600_000))])];
};

async function loadHome() {
  if (state.home.loading) return;
  state.home.loading = true;
  const d0 = today();
  const d1 = addDays(d0, 1);
  const dates = [...new Set([...espnDaysOf(d0), ...espnDaysOf(d1)])];
  const leagues = homeLeagues();
  const [lists] = await Promise.all([
    Promise.all(leagues.map(k => scoreboard(k, LEAGUES[k].espn && LEAGUES[k].kind === 'match' ? dates : undefined).catch(() => []))),
    // The followed leagues' tables, for the picks.
    Promise.all(
      followedLeagues()
        .filter(hasStandings)
        .slice(0, 8)
        .map(k =>
          standings(k)
            .then(g => (state.home.tables[k] = tableIndex(g)))
            .catch(() => {})
        )
    )
  ]);
  const events = lists.flat().filter(e => e.kind !== 'match' || onDay(e, d0) || onDay(e, d1) || e.status.state === 'in');
  noticeChanges(events);
  state.home.events = events;
  state.home.at = Date.now();
  state.home.loading = false;
  paintStatus();
  if (state.tab === 'home') renderHome();
  loadFollowedTeams();
}
// Followed teams' schedules (their next and last games).
async function loadFollowedTeams() {
  for (const f of state.prefs.follows.slice(0, 10)) {
    const key = `${f.league}:${f.id}`;
    if (state.home.teams.has(key) || !hasTeams(f.league)) continue;
    state.home.teams.set(key, null);
    teamSchedule(f.league, f.id)
      .then(list => {
        state.home.teams.set(key, list);
        if (state.tab === 'home') renderHome();
      })
      .catch(() => state.home.teams.delete(key));
  }
}
// A followed team's game starting or ending: a notice.
const lastState = new Map();
function noticeChanges(events) {
  for (const e of events) {
    if (!isFollowedEvent(e)) continue;
    const key = `${e.league}:${e.id}`;
    const was = lastState.get(key);
    lastState.set(key, e.status.state);
    if (!was || was === e.status.state) continue;
    const title = `${e.away.short || e.away.name} vs ${e.home.short || e.home.name}`;
    if (e.status.state === 'in') notify(q, { title: `${t('startedNow')} · ${leagueName(e.league, locale)}`, body: title, tag: `start:${key}`, hash: 'home' });
    if (e.status.state === 'post') notify(q, { title: `${t('final')} · ${leagueName(e.league, locale)}`, body: `${e.away.short || e.away.name} ${e.away.score} - ${e.home.score} ${e.home.short || e.home.name}`, tag: `end:${key}`, hash: 'home' });
  }
}

const REASON = r => t(`why_${r}`);
function pickCard(item, n) {
  const e = item.event;
  const reasons = item.reasons.slice(0, 2).map(r => (r === 'priority' ? `${SPORTS[LEAGUES[e.league].sport].icon} ${REASON(r)}` : REASON(r)));
  return el('button', { class: `pick-card${e.status.state === 'in' ? ' live' : ''}`, type: 'button', onclick: () => openEvent(e) }, [
    el('div', { class: 'pick-time' }, [el('strong', { class: 'num', text: e.status.state === 'in' ? '●' : clock(e.start) }), el('small', { text: e.status.state === 'in' ? statusText(e) : n === 0 ? t('firstUp') : '' })]),
    el('div', { class: 'pick-body' }, [
      leagueChip(e.league),
      e.kind === 'match' ? el('div', { class: 'card-sides' }, [sideLine(e.away, e, false), sideLine(e.home, e, false)]) : el('strong', { class: 'pick-title', text: e.name }),
      reasons.length ? el('div', { class: 'why-row' }, reasons.map(r => el('span', { class: 'why', text: r }))) : null
    ])
  ]);
}

function renderHome() {
  const box = $('panel-home');
  if (!state.home.at) return put(box, spinner());
  const events = state.home.events;
  const now = Date.now();
  const d0 = today();
  const pctx = { sports: state.prefs.sports, leagues: state.prefs.leagues, follows: state.prefs.follows, tables: state.home.tables, aff: affinity(state.wallet), now };
  let day = d0;
  let { plan, also } = dayPlan(events.filter(e => onDay(e, d0) || e.status.state === 'in'), pctx);
  if (!plan.length) {
    day = addDays(d0, 1);
    ({ plan, also } = dayPlan(events.filter(e => onDay(e, day)), pctx));
  }
  const live = events.filter(e => e.status.state === 'in');
  // Followed teams: each one's next game, or its last result.
  const teamRows = state.prefs.follows.map(f => {
    const list = state.home.teams.get(`${f.league}:${f.id}`) || [];
    const next = list.find(x => x.status.state !== 'post' && Date.parse(x.start) > now - 4 * 3_600_000);
    const last = [...list].reverse().find(x => x.status.state === 'post');
    const e = next || last;
    return el('div', { class: 'follow-row' }, [
      el('button', { class: 'follow-team', type: 'button', onclick: () => openTeam(f.league, f.id, f) }, [logo(f.logo, f.name, 'sm'), el('span', { text: f.name })]),
      e ? eventRow(e, { league: false }) : el('small', { class: 'muted', text: leagueName(f.league, locale) })
    ]);
  });
  // Bets in Play on games of the next days (the wallet carries the open slips).
  const bets = (state.wallet?.snap?.odds?.slips || []).flatMap(slip => slip.l.map(leg => ({ ...leg, slip })));
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
  // Today by league, in the person's order.
  const todays = events.filter(e => e.kind !== 'match' || onDay(e, d0));
  const byLeague = new Map();
  for (const k of homeLeagues()) byLeague.set(k, []);
  for (const e of todays) byLeague.get(e.league)?.push(e);
  const hasFollows = state.prefs.sports.length > 0;
  put(
    box,
    el('div', { class: 'home-hero' }, [
      el('div', {}, [el('p', { class: 'hero-kicker', text: dayLabel(d0, { long: true }) }), el('h2', { class: 'hero-title', text: hasFollows ? t('heroTitle') : t('heroTitleNew') })]),
      el('button', { class: 'q-btn small', type: 'button', text: hasFollows ? t('editFollows') : t('pickSports'), onclick: openFollowEditor })
    ]),
    !hasFollows ? sportPicker() : null,
    plan.length
      ? section(day === d0 ? t('todayPicks') : t('tomorrowPicks'), el('div', { class: 'pick-list' }, plan.map(pickCard)), { sub: t('picksSub') })
      : section(t('todayPicks'), empty(t('noPicks'))),
    also.length ? section(t('alsoToday'), el('div', { class: 'q-card list' }, also.map(x => eventRow(x.event)))) : null,
    live.length ? section(`${t('liveNow')} · ${live.length}`, el('div', { class: 'q-card list' }, live.slice(0, 12).map(e => eventRow(e)))) : null,
    state.prefs.follows.length ? section(t('yourTeams'), el('div', { class: 'q-card list' }, teamRows), { action: moreButton(t('seeAll'), () => showTab('following')) }) : null,
    betRows.length ? section(t('yourBets'), el('div', { class: 'q-card list' }, betRows)) : null,
    ...[...byLeague]
      .filter(([, list]) => list.length)
      .map(([league, list]) =>
        section(leagueName(league, locale), el('div', { class: 'q-card list' }, list.slice(0, 6).map(e => eventRow(e, { league: false }))), {
          action: moreButton(list.length > 6 ? t('allN', { n: list.length }) : t('scores'), () => openScores(league, d0))
        })
      )
  );
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

// ---- Scores: a league's game days -----------------------------------------------------------

function openScores(league, date) {
  state.scores = { ...state.scores, sport: LEAGUES[league].sport, league, date: date || today(), byDay: null, days: [], extra: 0 };
  showTab('scores');
}

// Which days (or weeks) to read, then the games of each, grouped by the
// viewer's own day: the strip shows only days with games.
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
      events = await scoreboard(league);
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
    const byDay = new Map();
    for (const e of events.filter(x => !x.status.void || x.kind === 'match')) {
      const d = localDate(Date.parse(e.start));
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d).push(e);
    }
    sc.byDay = byDay;
    sc.days = [...byDay.keys()].sort();
    // The day shown: the one asked for, else today, else the next game day, else the last.
    if (!byDay.has(sc.date)) sc.date = byDay.has(today()) ? today() : sc.days.find(d => d >= today()) || sc.days.at(-1) || today();
  }
  renderScores();
}

function renderScores() {
  const box = $('panel-scores');
  const sc = state.scores;
  const followed = new Set(state.prefs.sports);
  const sports = Object.keys(SPORTS).sort((a, b) => (followed.has(b) - followed.has(a)) || (state.prefs.sports.indexOf(a) - state.prefs.sports.indexOf(b)));
  const sportChips = el(
    'div',
    { class: 'q-chips' },
    sports.map(key =>
      el('button', {
        class: 'q-chip',
        type: 'button',
        'aria-pressed': String(sc.sport === key),
        text: `${SPORTS[key].icon} ${L(SPORTS[key])}`,
        onclick: () => {
          const first = followedLeagues().find(k => LEAGUES[k].sport === key) || leaguesOf(key)[0];
          state.scores = { ...sc, sport: key, league: first, byDay: null, days: [], extra: 0 };
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
      .map(k => el('button', { class: 'q-chip', type: 'button', 'aria-pressed': String(sc.league === k), text: `${mine.has(k) ? '★ ' : ''}${leagueName(k, locale)}`, onclick: () => ((state.scores = { ...sc, league: k, byDay: null, days: [], extra: 0 }), loadScores()) }))
  );
  let strip = null;
  let list;
  if (sc.byDay == null || sc.loading) list = spinner();
  else if (sc.byDay === 'failed') list = empty(t('failed'));
  else if (sc.mode === 'event') {
    const events = [...sc.byDay.values()].flat();
    list = events.length ? el('div', { class: 'q-card list' }, events.map(e => eventRow(e, { league: false }))) : empty(t('noEvents'));
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
    list = el('div', {}, [el('p', { class: 'day-head', text: `${dayLabel(sc.date, { long: true })} · ${t('gamesN', { n: games.length })}` }), el('div', { class: 'q-card list' }, games.map(e => eventRow(e, { league: false, day: false })))]);
  }
  const tools = el('div', { class: 'league-tools' }, [
    el('button', { class: `q-chip small${mine.has(sc.league) ? ' on' : ''}`, type: 'button', text: mine.has(sc.league) ? `✓ ${t('following')}` : `+ ${t('followLeague')}`, onclick: () => (!state.prefs.sports.includes(sc.sport) && toggleSport(sc.sport), toggleLeague(sc.league), renderScores()) }),
    hasStandings(sc.league) ? el('button', { class: 'q-chip small', type: 'button', text: t('table'), onclick: () => ((state.standings = { league: sc.league, groups: null }), showTab('standings')) }) : null
  ]);
  put(box, sportChips, leagueChips, tools, strip, list);
  box.querySelector('.day-strip [aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  box.querySelector('.q-chips.small [aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}

// ---- Following: everything about what you follow ---------------------------------------------

async function loadFollowing(league) {
  const l = LEAGUES[league];
  const slot = { events: null, groups: null };
  state.following.set(league, slot);
  const [events, groups] = await Promise.all([
    scoreboard(league).catch(() => []),
    hasStandings(league) ? standings(league).catch(() => []) : Promise.resolve(null)
  ]);
  const now = Date.now();
  // Live, then the next games, then the latest results.
  const upcoming = events.filter(e => e.status.state === 'in' || (e.status.state === 'pre' && Date.parse(e.start) > now - 3_600_000)).sort((a, b) => a.start.localeCompare(b.start));
  const recent = events.filter(e => e.status.state === 'post').sort((a, b) => b.start.localeCompare(a.start));
  slot.events = l.kind === 'match' ? [...upcoming, ...recent].slice(0, 6) : events.slice(0, 3);
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
  const blocks = p.sports.map(sp => {
    const leagues = followedLeagues().filter(k => LEAGUES[k].sport === sp);
    return el('section', { class: 'q-section follow-sport' }, [
      el('div', { class: 'q-section-head' }, [el('h2', { text: `${SPORTS[sp].icon} ${L(SPORTS[sp])}` })]),
      leagues.length ? null : el('p', { class: 'muted small', text: t('noLeaguesYet') }),
      ...leagues.map(k => leagueBlock(k))
    ]);
  });
  put(box, head, ...blocks);
}

function leagueBlock(league) {
  if (!state.following.has(league)) loadFollowing(league);
  const slot = state.following.get(league);
  const teams = state.prefs.follows.filter(f => f.league === league);
  const lg = leagueLogo(league);
  return el('div', { class: 'q-card league-card' }, [
    el('div', { class: 'league-card-head' }, [
      lg ? logo(lg, leagueName(league, locale), 'sm') : el('span', { class: 'league-emoji', text: SPORTS[LEAGUES[league].sport].icon }),
      el('strong', { text: leagueName(league, locale) }),
      el('button', { class: 'section-more', type: 'button', text: t('scores'), onclick: () => openScores(league) }),
      hasStandings(league) ? el('button', { class: 'section-more', type: 'button', text: t('table'), onclick: () => ((state.standings = { league, groups: null }), showTab('standings')) }) : null
    ]),
    teams.length ? el('div', { class: 'team-chips' }, teams.map(f => el('button', { class: 'team-chip', type: 'button', onclick: () => openTeam(f.league, f.id, f) }, [logo(f.logo, f.name, 'xs'), el('span', { text: f.name })]))) : null,
    !slot?.events ? spinner() : slot.events.length ? el('div', { class: 'list' }, slot.events.map(e => eventRow(e, { league: false }))) : empty(t('noUpcoming')),
    slot?.groups?.length ? el('div', { class: 'mini-table' }, [standingsTables(slot.groups.slice(0, 2), league, { top: 5 })]) : null
  ]);
}

// ---- Standings ------------------------------------------------------------------------------

async function renderStandings() {
  const box = $('panel-standings');
  const st = state.standings;
  const mine = followedLeagues().filter(hasStandings);
  const leagues = [...new Set([...mine, ...Object.keys(LEAGUES).filter(hasStandings)])];
  if (!hasStandings(st.league)) st.league = mine[0] || 'epl';
  const chips = el(
    'div',
    { class: 'q-chips' },
    leagues.map(k => el('button', { class: 'q-chip', type: 'button', 'aria-pressed': String(st.league === k), text: `${mine.includes(k) ? '★ ' : ''}${leagueName(k, locale)}`, onclick: () => ((st.league = k), (st.groups = null), renderStandings()) }))
  );
  if (!st.groups) {
    put(box, chips, spinner());
    const want = st.league;
    try {
      const groups = await standings(want);
      if (st.league !== want) return;
      st.groups = groups;
    } catch {
      st.groups = [];
    }
  }
  put(box, chips, st.groups.length ? standingsTables(st.groups, st.league) : empty(t('noStandings')));
  box.querySelector('.q-chips [aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}

// ---- Tabs, refresh, start ---------------------------------------------------------------------

function renderTabs() {
  for (const tab of TABS) {
    const b = $(`tab-${tab}`);
    b.setAttribute('aria-selected', String(state.tab === tab));
    b.querySelector('span').textContent = t(`tab_${tab}`);
    $(`panel-${tab}`).hidden = state.tab !== tab;
  }
}
function showTab(tab) {
  state.tab = tab;
  try {
    history.replaceState(null, '', `#${tab}`);
  } catch {}
  renderTabs();
  window.scrollTo({ top: 0 });
  if (tab === 'home') {
    renderHome();
    if (Date.now() - state.home.at > 60_000) loadHome();
  }
  if (tab === 'scores') state.scores.byDay ? renderScores() : loadScores();
  if (tab === 'following') renderFollowing();
  if (tab === 'standings') renderStandings();
}
for (const b of document.querySelectorAll('#tabs .tab')) b.addEventListener('click', () => showTab(b.dataset.tab));

// Live games refresh every 30 seconds while on screen; home every 2 minutes
// in any case (so a followed team's start and finish are noticed).
setInterval(() => {
  if (document.visibilityState !== 'visible' || !q.active) return;
  const liveHome = state.home.events.some(e => e.status.state === 'in');
  if (state.tab === 'home' && (liveHome || Date.now() - state.home.at > 120_000)) loadHome();
  else if (Date.now() - state.home.at > 120_000) loadHome();
  if (state.tab === 'scores' && state.scores.byDay instanceof Map && [...state.scores.byDay.values()].flat().some(e => e.status.state === 'in')) loadScores();
  paintStatus();
}, 30_000);

function paintStatus() {
  const text = state.home.at ? t('updated', { time: clock(new Date(state.home.at).toISOString()) }) : '';
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
  if (state.tab === 'home' && state.home.at) renderHome();
});
q.on('active', live => live && loadHome());

async function boot() {
  const first = await q.start();
  state.wallet = first.wallet || q.wallet;
  applyPrefs(first?.payload);
  $('loading').hidden = true;
  const hash = location.hash.slice(1);
  showTab(TABS.includes(hash) ? hash : 'home');
  await loadHome();
}
if (!gated) boot();
setTimeout(() => ($('loading').hidden = true), 8000);

if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('./sw.js').catch(() => {});
