// Quadra Fixtures: the sports data centre of Quadra. Every supported sport's
// scores, schedules, match details (box scores, plays, line-ups, win
// probability), standings, teams, players and news, and the way into Quadra
// Play for any match it sells. The data is ESPN's (Kambi's for the leagues
// ESPN doesn't carry), read through the Quadra data proxy (lib/espn.mjs).
import {
  quadraSession, accountButton, installGate, watchUpdates, recordAffinity, affinityPatch, activityPatch, affinity, appUrl, fitNumbers
} from './lib/quadra.mjs';
import { useSession, scoreboard, summary, standings, team, teamSchedule, roster, athlete, news, playGameId, STANDING_COLUMNS, yyyymmdd } from './lib/espn.mjs';
import { LEAGUES, SPORTS, leagueName, leaguesOf, TOP_LEAGUES, hasStandings, hasNews, hasTeams } from './lib/leagues.mjs';
import { detectLocale, makeT } from './lib/i18n.mjs';
import { rankEvents, eventKeys, teamKey, leagueKey } from './lib/foryou.mjs';

const locale = detectLocale();
const t = makeT(locale);
const L = obj => (locale === 'en' ? obj.en : obj.zh);
document.documentElement.lang = locale === 'zh' ? 'zh-Hant' : 'en';
const $ = id => document.getElementById(id);
const TABS = ['home', 'scores', 'standings', 'news'];

const state = {
  tab: 'home',
  follows: [],
  prefsLoaded: false,
  wallet: null,
  home: { events: [], loading: false, at: 0, teams: new Map() },
  scores: { sport: 'soccer', league: 'epl', date: localDate(Date.now()), events: null, loading: false },
  standings: { league: 'epl', groups: null },
  news: { league: null, articles: null },
  sheet: null
};

const q = quadraSession('match', { lang: locale });
useSession(q);

// ---- Small helpers -----------------------------------------------------------------

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const child of [].concat(children)) if (child != null && child !== false) node.append(child);
  return node;
}
function localDate(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// The ESPN dates a local day spans (ESPN files games under the US date).
function espnDates(date) {
  const start = new Date(`${date}T00:00:00`).getTime();
  return [...new Set([yyyymmdd(new Date(start - 11 * 3_600_000)), yyyymmdd(new Date(start + 12 * 3_600_000)), yyyymmdd(new Date(start + 23 * 3_600_000))])];
}
const onDay = (e, date) => localDate(Date.parse(e.start)) === date;
const locales = locale === 'en' ? 'en-US' : 'zh-TW';
const clock = iso => new Date(iso).toLocaleTimeString(locales, { hour: '2-digit', minute: '2-digit', hour12: false });
function dayLabel(date) {
  const today = localDate(Date.now());
  if (date === today) return t('today');
  if (date === localDate(Date.now() + 86_400_000)) return t('tomorrow');
  if (date === localDate(Date.now() - 86_400_000)) return t('yesterday');
  const d = new Date(`${date}T12:00:00`);
  const wd = d.toLocaleDateString(locales, { weekday: locale === 'en' ? 'short' : 'narrow' });
  return `${d.getMonth() + 1}/${d.getDate()} ${wd}`;
}
const whenText = iso => {
  const date = localDate(Date.parse(iso));
  return date === localDate(Date.now()) ? clock(iso) : `${dayLabel(date)} ${clock(iso)}`;
};
function toast(text) {
  const box = el('div', { class: 'toast', text });
  $('toasts').append(box);
  setTimeout(() => box.remove(), 3200);
}
// replaceChildren, skipping the null and false left by conditional pieces.
const put = (node, ...kids) => node.replaceChildren(...kids.filter(k => k != null && k !== false));
const spinner = () => el('div', { class: 'center-spin' }, [el('div', { class: 'spinner' })]);
const empty = text => el('p', { class: 'empty', text });

function logo(url, name, cls = '') {
  if (!url) return el('span', { class: `logo logo-fallback ${cls}`, 'aria-hidden': 'true', text: (name || '?').trim().slice(0, 1) });
  const img = el('img', { class: `logo ${cls}`, src: url, alt: '', loading: 'lazy', decoding: 'async' });
  img.addEventListener('error', () => img.replaceWith(logo(null, name, cls)), { once: true });
  return img;
}
const leagueChip = key => el('span', { class: 'league-tag' }, [document.createTextNode(`${SPORTS[LEAGUES[key].sport].icon} ${leagueName(key, locale)}`)]);

// ---- Preferences on the pass: followed teams ---------------------------------------

function applyPrefs(payload) {
  try {
    const p = payload ? JSON.parse(payload) : null;
    if (p?.v === 2 && Array.isArray(p.follows)) state.follows = p.follows;
  } catch {}
  state.prefsLoaded = true;
}
let saveTimer = 0;
function savePrefs() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    q.write({ payload: JSON.stringify({ v: 2, follows: state.follows, t: Date.now() }), wallet: affinityPatch('match') }).catch(() => {});
  }, 800);
}
const isFollowed = (league, id) => state.follows.some(f => f.league === league && f.id === id);
function toggleFollow(league, side) {
  if (isFollowed(league, side.id)) state.follows = state.follows.filter(f => !(f.league === league && f.id === side.id));
  else {
    state.follows = [...state.follows, { league, id: side.id, name: side.name, logo: side.logo }];
    recordAffinity('match', [teamKey(league, side.name), `league:${leagueKey(league)}`], 4);
    track('follow');
  }
  savePrefs();
  if (state.tab === 'home') renderHome();
}
function track(action, keys = [], weight = 1) {
  if (keys.length) recordAffinity('match', keys, weight);
  if (action && q.active) q.write({ wallet: activityPatch(q.wallet, 'match', action) }).catch(() => {});
}

// ---- An event as a row, and its sheet ------------------------------------------------

function statusText(e) {
  const s = e.status;
  if (s.void) return t('postponed');
  if (s.state === 'in') return s.short || s.detail || t('live');
  if (s.state === 'post') return s.short && !/^final$/i.test(s.short) ? s.short : t('final');
  return whenText(e.start);
}
function sideLine(side, e, win) {
  return el('div', { class: `side${win ? ' win' : ''}` }, [
    logo(side.logo, side.name, 'sm'),
    el('span', { class: 'side-name' }, [side.rank ? el('small', { class: 'rank', text: String(side.rank) }) : null, document.createTextNode(side.short || side.name)]),
    e.status.state !== 'pre' && !e.status.void ? el('strong', { class: 'side-score num', text: side.score }) : null
  ]);
}
function eventRow(e, { league = true } = {}) {
  if (e.kind === 'match') {
    const decided = e.status.state === 'post' && e.home.score !== e.away.score;
    const homeWins = decided && (e.home.winner || Number(e.home.score) > Number(e.away.score));
    const awayWins = decided && (e.away.winner || Number(e.away.score) > Number(e.home.score));
    return el('button', { class: `event-row${e.status.state === 'in' ? ' live' : ''}`, type: 'button', onclick: () => openEvent(e) }, [
      el('div', { class: 'event-meta' }, [el('span', { class: `event-status ${e.status.state}`, text: statusText(e) }), league ? leagueChip(e.league) : null]),
      el('div', { class: 'event-sides' }, [sideLine(e.away, e, awayWins), sideLine(e.home, e, homeWins)])
    ]);
  }
  // Races, tournaments, fight cards: one row for the whole event.
  const sub = e.kind === 'field' ? (e.sessions?.at(-1)?.field?.[0]?.name ? `🏆 ${e.sessions.at(-1).field[0].name}` : e.venue) : e.kind === 'card' ? `${e.bouts?.length || 0} ${t('card')}` : e.venue;
  return el('button', { class: `event-row wide${e.status.state === 'in' ? ' live' : ''}`, type: 'button', onclick: () => openEvent(e) }, [
    el('div', { class: 'event-meta' }, [el('span', { class: `event-status ${e.status.state}`, text: statusText(e) }), league ? leagueChip(e.league) : null]),
    el('div', { class: 'event-title' }, [el('strong', { text: e.name }), sub ? el('small', { text: sub }) : null])
  ]);
}
function eventCard(item) {
  const e = item.event;
  const why = item.why?.startsWith('team:') ? t('following') : null;
  return el('button', { class: 'q-rec match-card', type: 'button', onclick: () => openEvent(e) }, [
    el('span', { class: 'q-rec-why', text: why || (e.status.state === 'in' ? `● ${t('live')}` : leagueName(e.league, locale)) }),
    e.kind === 'match'
      ? el('div', { class: 'card-sides' }, [sideLine(e.away, e, false), sideLine(e.home, e, false)])
      : el('p', { class: 'q-rec-title', text: e.name }),
    el('p', { class: 'q-rec-sub', text: e.status.state === 'in' ? [e.status.short || e.status.detail, leagueName(e.league, locale)].filter(Boolean).join(' · ') : `${statusText(e)}${why ? ` · ${leagueName(e.league, locale)}` : ''}` })
  ]);
}

// ---- Sheets ------------------------------------------------------------------------------

function sheet(title, { accent } = {}) {
  const dialog = el('dialog', { class: 'q-sheet fx-sheet' });
  const body = el('div', { class: 'sheet-body' });
  const close = () => {
    dialog.close();
  };
  dialog.append(el('div', { class: 'q-sheet-head' }, [el('h2', { text: title }), el('button', { class: 'q-close', type: 'button', text: '×', 'aria-label': 'close', onclick: close })]), body);
  dialog.addEventListener('click', e => e.target === dialog && close());
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (state.sheet?.dialog === dialog) state.sheet = null;
  });
  if (accent) dialog.style.setProperty('--q-accent', accent);
  document.body.append(dialog);
  dialog.showModal();
  return { dialog, body, close };
}
function segmented(options, current, onPick) {
  return el(
    'div',
    { class: 'segmented scroll', role: 'group' },
    options.map(([key, label]) => el('button', { type: 'button', 'aria-pressed': String(key === current), text: label, onclick: () => onPick(key) }))
  );
}

function openEvent(e) {
  track(null, eventKeys(e), 1);
  if (e.kind === 'match') return openMatch(e);
  return openFieldEvent(e);
}

// A match: its header, the way into Play, then its data by section.
async function openMatch(e) {
  const s = sheet(leagueName(e.league, locale));
  state.sheet = { dialog: s.dialog, event: e };
  const header = el('div', { class: 'match-head' });
  const sections = el('div');
  const content = el('div', { class: 'match-content' }, [spinner()]);
  s.body.append(header, sections, content);
  let view = 'overview';
  let data = null;
  const paintHeader = sm => {
    const home = sm?.home || e.home;
    const away = sm?.away || e.away;
    const st = sm?.status || e.status;
    const side = (x, raw) =>
      el('div', { class: 'mh-side' }, [
        logo(x.logo || raw.logo, x.name, 'lg'),
        el('strong', { text: raw.short || x.short || x.name }),
        x.record || raw.record ? el('small', { text: x.record || raw.record }) : null,
        hasTeams(e.league) && !e.kambi ? el('button', { class: `q-chip small${isFollowed(e.league, x.id) ? ' on' : ''}`, type: 'button', text: isFollowed(e.league, x.id) ? t('following') : t('follow'), onclick: () => (toggleFollow(e.league, x), paintHeader(sm)) }) : null
      ]);
    const playId = playGameId(e);
    put(header, 
      el('div', { class: 'mh-row' }, [
        side(away, e.away),
        el('div', { class: 'mh-mid' }, [
          st.state === 'pre' ? el('strong', { class: 'mh-time', text: clock(e.start) }) : el('strong', { class: 'mh-score num', text: `${away.score ?? ''} - ${home.score ?? ''}` }),
          el('small', { class: `event-status ${st.state}`, text: st.state === 'pre' ? dayLabel(localDate(Date.parse(e.start))) : statusText({ ...e, status: st }) })
        ]),
        side(home, e.home)
      ]),
      linescore(sm, e),
      playId && e.status.state !== 'post' && !e.status.void
        ? el('a', { class: 'q-btn primary block play-link', href: appUrl('odds', `game=${playId}`), onclick: ev => (ev.preventDefault(), track('toPlay', eventKeys(e), 2), q.go('odds', `game=${playId}`)) }, [document.createTextNode(`🎟️ ${t('betInPlay')}`)])
        : null
    );
  };
  paintHeader(null);
  const paint = () => {
    if (!data) return;
    const tabs = [['overview', t('overview')]];
    if (data.teamStats.length) tabs.push(['stats', t('stats')]);
    if (data.players.some(p => p.tables.length)) tabs.push(['players', t('players')]);
    if (data.plays.length || data.keyEvents.length) tabs.push(['plays', t('plays')]);
    if (data.rosters.length) tabs.push(['lineups', t('lineups')]);
    if (data.table.length) tabs.push(['table', t('table')]);
    put(sections, segmented(tabs, view, v => ((view = v), paint())));
    put(content, matchSection(view, data, e));
  };
  if (e.kambi || !LEAGUES[e.league].espn) {
    put(content, el('div', { class: 'q-card pad' }, [el('p', { class: 'muted', text: e.note || leagueName(e.league, locale) }), e.venue ? el('p', { text: e.venue }) : null]));
    return;
  }
  try {
    data = await summary(e.league, e.id);
    paintHeader(data);
    paint();
  } catch {
    put(content, empty(t('failed')));
  }
}

function linescore(sm, e) {
  const home = sm?.home || e.home;
  const away = sm?.away || e.away;
  const n = Math.max(home.lines?.length || 0, away.lines?.length || 0);
  if (!n || n > 20) return null;
  const head = Array.from({ length: n }, (_, i) => el('th', { text: String(i + 1) }));
  const row = x => el('tr', {}, [el('th', { text: x.abbr || x.short }), ...Array.from({ length: n }, (_, i) => el('td', { class: 'num', text: x.lines?.[i] ?? '' })), el('td', { class: 'num total', text: x.score })]);
  return el('div', { class: 'table-wrap' }, [el('table', { class: 'linescore' }, [el('thead', {}, [el('tr', {}, [el('th'), ...head, el('th', { text: 'T' })])]), el('tbody', {}, [row(away), row(home)])])]);
}

function matchSection(view, d, e) {
  const nameOf = id => d.byId[id]?.short || d.byId[id]?.name || '';
  if (view === 'stats') {
    return el(
      'div',
      { class: 'q-card pad stat-bars' },
      d.teamStats
        .filter(s => !/games played/i.test(s.label) && !(Number(s.home) === 0 && Number(s.away) === 0))
        .slice(0, 40)
        .map(s => {
        const h = parseFloat(String(s.home).replace(/[^\d.-]/g, ''));
        const a = parseFloat(String(s.away).replace(/[^\d.-]/g, ''));
        const total = Math.abs(h) + Math.abs(a);
        return el('div', { class: 'stat-bar' }, [
          el('div', { class: 'sb-top' }, [el('strong', { class: 'num', text: s.away }), el('span', { text: s.label }), el('strong', { class: 'num', text: s.home })]),
          total > 0 ? el('div', { class: 'sb-track' }, [el('i', { class: 'away', style: `flex:${Math.abs(a)}` }), el('i', { class: 'home', style: `flex:${Math.abs(h)}` })]) : null
        ]);
      })
    );
  }
  if (view === 'players') {
    return el(
      'div',
      {},
      d.players.flatMap(p =>
        p.tables
          .filter(tb => tb.rows.length)
          .map(tb =>
            el('div', { class: 'q-card pad' }, [
              el('h3', { class: 'card-h', text: `${nameOf(p.team)} · ${tb.name}` }),
              el('div', { class: 'table-wrap' }, [
                el('table', { class: 'data' }, [
                  el('thead', {}, [el('tr', {}, [el('th', { class: 'left' }), ...tb.labels.map(l => el('th', { text: l }))])]),
                  el(
                    'tbody',
                    {},
                    tb.rows.map(r =>
                      el('tr', {}, [
                        el('th', { class: 'left' }, [el('button', { class: 'link', type: 'button', text: r.name, onclick: () => openPlayer(e.league, r.id) }), r.pos ? el('small', { text: ` ${r.pos}` }) : null]),
                        ...r.stats.map(v => el('td', { class: 'num', text: v }))
                      ])
                    )
                  )
                ])
              ])
            ])
          )
      )
    );
  }
  if (view === 'plays') {
    const list = d.keyEvents.length ? d.keyEvents : d.plays;
    return el(
      'ol',
      { class: 'plays' },
      list
        .slice()
        .reverse()
        .map(p =>
          el('li', { class: p.scoring ? 'scoring' : '' }, [
            el('span', { class: 'play-when', text: [p.period, p.clock].filter(Boolean).join(' ') }),
            el('span', { class: 'play-text', text: p.text }),
            p.home != null && p.away != null ? el('strong', { class: 'num', text: `${p.away}-${p.home}` }) : null
          ])
        )
    );
  }
  if (view === 'lineups') {
    return el(
      'div',
      { class: 'lineups' },
      d.rosters.map(r =>
        el('div', { class: 'q-card pad' }, [
          el('h3', { class: 'card-h', text: `${nameOf(r.team)}${r.formation ? ` · ${r.formation}` : ''}` }),
          el(
            'ul',
            { class: 'roster-list' },
            r.players.map(p => el('li', { class: p.starter ? 'starter' : 'sub' }, [el('span', { class: 'jersey num', text: p.jersey }), el('button', { class: 'link', type: 'button', text: p.name, onclick: () => openPlayer(e.league, p.id) }), el('small', { text: p.pos })]))
          )
        ])
      )
    );
  }
  if (view === 'table') return standingsTables([{ name: '', rows: d.table.map(r => ({ id: r.id, name: r.team, short: r.team, logo: null, stats: r.stats })) }], e.league);
  // Overview
  const facts = [
    [t('venue'), [d.venue, d.city].filter(Boolean).join(' · ')],
    [t('tv'), e.tv],
    [t('attendance'), d.attendance ? Number(d.attendance).toLocaleString(locales) : ''],
    [t('weather'), d.weather],
    [t('officials'), d.officials.slice(0, 3).join('、')]
  ].filter(([, v]) => v);
  return el('div', {}, [
    d.winProb.length > 3 ? winProbCard(d) : null,
    d.leaders.length
      ? el('div', { class: 'q-card pad' }, [
          el('h3', { class: 'card-h', text: t('leaders') }),
          el('ul', { class: 'leaders' }, d.leaders.slice(0, 8).map(l => el('li', {}, [el('small', { text: `${nameOf(l.team)} · ${l.stat}` }), el('strong', { text: l.name }), el('span', { class: 'num', text: l.value })])))
        ])
      : null,
    d.form.length
      ? el('div', { class: 'q-card pad' }, [
          el('h3', { class: 'card-h', text: t('form') }),
          ...d.form.map(f => el('div', { class: 'form-row' }, [el('span', { text: nameOf(f.team) }), el('div', { class: 'form-pills' }, f.games.map(g => el('span', { class: `pill ${g.result}`, title: `${g.opp} ${g.score}`, text: g.result })))]))
        ])
      : null,
    d.series.length && d.series[0].summary ? el('div', { class: 'q-card pad' }, [el('h3', { class: 'card-h', text: t('series') }), el('p', { text: d.series[0].summary })]) : null,
    d.injuries.some(i => i.list.length)
      ? el('div', { class: 'q-card pad' }, [
          el('h3', { class: 'card-h', text: t('injuries') }),
          ...d.injuries.filter(i => i.list.length).map(i => el('p', { class: 'small' }, [el('strong', { text: `${nameOf(i.team)}：` }), document.createTextNode(i.list.map(x => `${x.name}（${x.status}）`).join('、'))]))
        ])
      : null,
    facts.length ? el('dl', { class: 'q-card pad facts' }, facts.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })])) : null,
    d.news.length ? newsList(d.news.slice(0, 4)) : null
  ]);
}

function winProbCard(d) {
  const pts = d.winProb;
  const w = 320;
  const h = 90;
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${((i / (pts.length - 1)) * w).toFixed(1)},${(h - p * h).toFixed(1)}`).join(' ');
  const last = pts.at(-1);
  const svg = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="wp-chart" aria-hidden="true"><line x1="0" x2="${w}" y1="${h / 2}" y2="${h / 2}" class="wp-mid"/><path d="${path}" class="wp-line"/></svg>`;
  const box = el('div', { class: 'q-card pad' }, [el('div', { class: 'card-h row' }, [el('span', { text: t('winProb') }), el('small', { text: `${t('homeWin')} ${Math.round(last * 100)}%` })])]);
  const holder = el('div');
  holder.innerHTML = svg;
  box.append(holder);
  return box;
}

// Races, tournaments, fight cards.
function openFieldEvent(e) {
  const s = sheet(leagueName(e.league, locale));
  const head = el('div', { class: 'q-card pad' }, [el('h3', { class: 'card-h', text: e.name }), el('p', { class: 'muted', text: [e.venue, whenText(e.start)].filter(Boolean).join(' · ') })]);
  s.body.append(head);
  if (e.kind === 'field') {
    let pick = e.sessions.length - 1;
    const box = el('div');
    const paint = () => {
      const ss = e.sessions[pick];
      put(box, 
        segmented(e.sessions.map((x, i) => [String(i), x.abbr || x.name]), String(pick), v => ((pick = Number(v)), paint())),
        el('p', { class: 'muted small', text: `${ss.name} · ${statusText({ ...e, start: ss.start, status: ss.status })}` }),
        el('ol', { class: 'field' }, ss.field.map((c, i) => el('li', {}, [el('span', { class: 'pos num', text: String(i + 1) }), logo(c.logo, c.name, 'sm round'), el('span', { class: 'field-name', text: c.name }), c.score ? el('small', { class: 'num', text: c.score }) : null])))
      );
    };
    paint();
    s.body.append(box);
  } else if (e.kind === 'card') {
    s.body.append(
      el(
        'div',
        { class: 'bouts' },
        e.bouts.map(b =>
          el('div', { class: 'q-card pad bout' }, [
            el('small', { class: 'muted', text: [b.weight, statusText({ ...e, start: b.start, status: b.status })].filter(Boolean).join(' · ') }),
            el('div', { class: 'bout-row' }, [
              el('span', { class: b.a?.winner ? 'win' : '' }, [logo(b.a?.logo, b.a?.name, 'sm round'), document.createTextNode(` ${b.a?.name || ''}`)]),
              el('span', { class: 'vs', text: 'vs' }),
              el('span', { class: b.b?.winner ? 'win' : '' }, [document.createTextNode(`${b.b?.name || ''} `), logo(b.b?.logo, b.b?.name, 'sm round')])
            ])
          ])
        )
      )
    );
  } else if (e.kind === 'draw') {
    for (const d of e.draws) {
      s.body.append(
        el('h3', { class: 'section-h', text: d.name }),
        el(
          'div',
          { class: 'bouts' },
          d.matches.map(m =>
            el('div', { class: 'q-card pad bout' }, [
              el('small', { class: 'muted', text: [m.round, statusText({ ...e, start: m.start, status: m.status })].filter(Boolean).join(' · ') }),
              ...[m.a, m.b].filter(Boolean).map(p => el('div', { class: `draw-row${p.winner ? ' win' : ''}` }, [logo(p.logo, p.name, 'sm round'), el('span', { class: 'field-name', text: p.name }), el('span', { class: 'num sets', text: p.lines.join(' ') })]))
            ])
          )
        )
      );
    }
  }
}

async function openTeam(league, id, fallback = {}) {
  const s = sheet(leagueName(league, locale));
  const content = el('div', {}, [spinner()]);
  s.body.append(content);
  track(null, [teamKey(league, fallback.name || ''), `league:${leagueKey(league)}`].filter(k => !k.endsWith(':')), 1.5);
  try {
    const [info, sched] = await Promise.all([team(league, id), teamSchedule(league, id).catch(() => [])]);
    const now = Date.now();
    const past = sched.filter(x => x.status.state === 'post').slice(-6).reverse();
    const next = sched.filter(x => x.status.state !== 'post' && Date.parse(x.start) > now - 4 * 3_600_000).slice(0, 5);
    const side = { id: info.id, name: info.name, logo: info.logo };
    const followBtn = el('button', { class: `q-btn${isFollowed(league, id) ? '' : ' primary'}`, type: 'button', text: isFollowed(league, id) ? t('following') : t('follow') });
    followBtn.addEventListener('click', () => {
      toggleFollow(league, side);
      followBtn.textContent = isFollowed(league, id) ? t('following') : t('follow');
      followBtn.classList.toggle('primary', !isFollowed(league, id));
    });
    const rosterBox = el('div');
    put(content, 
      el('div', { class: 'team-head' }, [logo(info.logo, info.name, 'xl'), el('div', {}, [el('h3', { text: info.name }), el('p', { class: 'muted', text: [info.record, info.standing].filter(Boolean).join(' · ') })]), followBtn]),
      next.length ? el('h3', { class: 'section-h', text: t('schedule') }) : null,
      next.length ? el('div', { class: 'q-card list' }, next.map(x => eventRow(x, { league: false }))) : null,
      past.length ? el('h3', { class: 'section-h', text: t('lastGames') }) : null,
      past.length ? el('div', { class: 'q-card list' }, past.map(x => eventRow(x, { league: false }))) : null,
      el('h3', { class: 'section-h', text: t('roster') }),
      rosterBox
    );
    rosterBox.append(spinner());
    roster(league, id)
      .then(groups =>
        put(rosterBox, 
          ...groups.map(g =>
            el('div', { class: 'q-card pad' }, [
              g.name ? el('h4', { class: 'card-h', text: g.name }) : null,
              el('ul', { class: 'roster-list' }, g.players.map(p => el('li', {}, [el('span', { class: 'jersey num', text: p.jersey }), el('button', { class: 'link', type: 'button', text: p.name, onclick: () => openPlayer(league, p.id) }), el('small', { text: [p.pos, p.age ? `${p.age}` : ''].filter(Boolean).join(' · ') })])))
            ])
          )
        )
      )
      .catch(() => put(rosterBox, empty(t('failed'))));
  } catch {
    put(content, empty(t('failed')));
  }
}

async function openPlayer(league, id) {
  if (!id) return;
  const s = sheet(leagueName(league, locale));
  const content = el('div', {}, [spinner()]);
  s.body.append(content);
  try {
    const a = await athlete(league, id);
    const facts = [
      [t('team'), a.team],
      [t('position'), a.position],
      [t('age'), a.age ? String(a.age) : ''],
      [t('height'), a.height],
      [t('weight'), a.weight],
      [t('born'), a.born],
      [t('birthPlace'), a.birthPlace]
    ].filter(([, v]) => v);
    put(content, 
      el('div', { class: 'team-head' }, [logo(a.headshot, a.name, 'xl round'), el('div', {}, [el('h3', { text: `${a.name}${a.jersey ? ` #${a.jersey}` : ''}` }), el('p', { class: 'muted', text: [a.position, a.team].filter(Boolean).join(' · ') })])]),
      a.stats.list.length
        ? el('div', { class: 'q-card pad' }, [el('h3', { class: 'card-h', text: a.stats.title || t('season') }), el('div', { class: 'stat-grid' }, a.stats.list.map(x => el('div', { class: 'stat-tile' }, [el('small', { text: x.label }), el('strong', { class: 'num', text: x.value }), x.rank ? el('small', { class: 'muted', text: x.rank }) : null])))])
        : null,
      facts.length ? el('dl', { class: 'q-card pad facts' }, facts.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })])) : null,
      a.teamId ? el('button', { class: 'q-btn block', type: 'button', text: a.team, onclick: () => openTeam(league, a.teamId, { name: a.team }) }) : null,
      a.news.length ? newsList(a.news) : null
    );
  } catch {
    put(content, empty(t('failed')));
  }
}

// ---- Home ----------------------------------------------------------------------------------

// The leagues home reads: followed teams' leagues, the leagues the person is
// into (every app's affinity), and the top leagues.
function homeLeagues() {
  const aff = affinity(state.wallet);
  const byPlay = Object.fromEntries(Object.entries(LEAGUES).map(([k, l]) => [l.play || k, k]));
  const liked = Object.entries(aff)
    .filter(([k]) => k.startsWith('league:'))
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => byPlay[k.slice(7)])
    .filter(Boolean);
  const set = new Set([...state.follows.map(f => f.league), ...liked.slice(0, 6), ...TOP_LEAGUES]);
  return [...set].filter(k => LEAGUES[k]).slice(0, 14);
}

async function loadHome() {
  if (state.home.loading) return;
  state.home.loading = true;
  const today = localDate(Date.now());
  const tomorrow = localDate(Date.now() + 86_400_000);
  const dates = [...new Set([...espnDates(today), ...espnDates(tomorrow)])];
  const lists = await Promise.all(homeLeagues().map(k => scoreboard(k, LEAGUES[k].espn && LEAGUES[k].kind === 'match' ? dates : undefined).catch(() => [])));
  state.home.events = lists.flat().filter(e => e.kind !== 'match' || onDay(e, today) || onDay(e, tomorrow) || e.status.state === 'in');
  state.home.at = Date.now();
  state.home.loading = false;
  if (state.tab === 'home') renderHome();
  loadFollowedTeams();
}
// Followed teams' schedules (their next and last games).
async function loadFollowedTeams() {
  for (const f of state.follows.slice(0, 8)) {
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

function section(title, content, { sub = '', action = null } = {}) {
  return el('section', { class: 'q-section' }, [el('div', { class: 'q-section-head' }, [el('h2', { text: title }), action]), sub ? el('p', { class: 'section-sub', text: sub }) : null, content]);
}

function renderHome() {
  const box = $('panel-home');
  const events = state.home.events;
  if (!state.home.at) {
    put(box, spinner());
    return;
  }
  const now = Date.now();
  const forYou = rankEvents(events.filter(e => e.status.state !== 'post' || now - Date.parse(e.start) < 5 * 3_600_000), { wallet: state.wallet, follows: state.follows, n: 10 });
  const live = events.filter(e => e.status.state === 'in');
  const today = localDate(now);
  const todays = events.filter(e => e.kind !== 'match' || onDay(e, today));
  const byLeague = new Map();
  for (const e of todays) {
    if (!byLeague.has(e.league)) byLeague.set(e.league, []);
    byLeague.get(e.league).push(e);
  }
  // Followed teams: each one's next game, or its last result.
  const teamRows = state.follows.map(f => {
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
    .slice(0, 8)
    .map(b =>
      el('a', { class: 'bet-row', href: appUrl('odds', 'history'), onclick: ev => (ev.preventDefault(), q.go('odds', 'history')) }, [
        el('span', { class: 'event-status pre', text: whenText(b.s) }),
        el('span', { class: 'bet-pick', text: b.p }),
        el('strong', { class: 'num', text: `@${b.o}` })
      ])
    );
  put(box, 
    ...[
      forYou.length ? section(t('forYou'), el('div', { class: 'q-recs' }, forYou.map(eventCard)), { sub: t('forYouSub') }) : null,
      live.length ? section(`${t('liveNow')} · ${live.length}`, el('div', { class: 'q-card list' }, live.slice(0, 12).map(e => eventRow(e)))) : null,
      state.follows.length
        ? section(t('yourTeams'), el('div', { class: 'q-card list' }, teamRows))
        : el('div', { class: 'q-card pad follow-cta' }, [el('h3', { text: t('followTeams') }), el('p', { class: 'muted', text: t('followHint') })]),
      betRows.length ? section(t('yourBets'), el('div', { class: 'q-card list' }, betRows)) : null,
      ...[...byLeague].map(([league, list]) =>
        section(leagueName(league, locale), el('div', { class: 'q-card list' }, list.slice(0, 8).map(e => eventRow(e, { league: false }))), {
          action: el('button', { type: 'button', text: '›', 'aria-label': leagueName(league, locale), onclick: () => ((state.scores = { ...state.scores, sport: LEAGUES[league].sport, league, date: today, events: null }), showTab('scores')) })
        })
      )
    ].filter(Boolean)
  );
}

// ---- Scores ---------------------------------------------------------------------------------

async function loadScores() {
  const sc = state.scores;
  const key = `${sc.league}|${sc.date}`;
  sc.loadingKey = key;
  sc.events = null;
  renderScores();
  track(null, [`league:${leagueKey(sc.league)}`], 0.3);
  try {
    const l = LEAGUES[sc.league];
    // Races, tournaments and fight cards: ESPN's current (or latest) event, whatever the day.
    const list = await scoreboard(sc.league, l.espn && l.kind === 'match' ? espnDates(sc.date) : undefined);
    if (sc.loadingKey !== key) return;
    sc.events = l.kind === 'match' ? list.filter(e => (l.kambi ? true : onDay(e, sc.date))) : list;
    sc.next = null;
    if (!sc.events.length && l.espn && l.kind === 'match') {
      // Nothing that day: ESPN's default scoreboard is the league's current or next round.
      const upcoming = await scoreboard(sc.league).catch(() => []);
      if (sc.loadingKey !== key) return;
      sc.next = upcoming.filter(e => e.status.state !== 'post' && Date.parse(e.start) > Date.now() - 4 * 3_600_000);
    }
  } catch {
    if (sc.loadingKey === key) sc.events = 'failed';
  }
  renderScores();
}

function renderScores() {
  const box = $('panel-scores');
  const sc = state.scores;
  const sportChips = el(
    'div',
    { class: 'q-chips' },
    Object.entries(SPORTS).map(([key, s]) =>
      el('button', {
        class: 'q-chip',
        type: 'button',
        'aria-pressed': String(sc.sport === key),
        text: `${s.icon} ${L(s)}`,
        onclick: () => {
          sc.sport = key;
          sc.league = leaguesOf(key)[0];
          loadScores();
        }
      })
    )
  );
  const leagueChips = el(
    'div',
    { class: 'q-chips small' },
    leaguesOf(sc.sport).map(k => el('button', { class: 'q-chip', type: 'button', 'aria-pressed': String(sc.league === k), text: leagueName(k, locale), onclick: () => ((sc.league = k), loadScores()) }))
  );
  const days = [];
  for (let d = -3; d <= 7; d++) days.push(localDate(Date.now() + d * 86_400_000));
  const byDay = !LEAGUES[sc.league].kambi && LEAGUES[sc.league].kind === 'match';
  const dayChips = !byDay
    ? null
    : el(
        'div',
        { class: 'q-chips day-strip' },
        days.map(d => el('button', { class: 'q-chip', type: 'button', 'aria-pressed': String(sc.date === d), text: dayLabel(d), onclick: () => ((sc.date = d), loadScores()) }))
      );
  let list;
  if (sc.events == null) list = spinner();
  else if (sc.events === 'failed') list = empty(t('failed'));
  else if (!sc.events.length)
    list = el('div', {}, [
      empty(t('noGames')),
      sc.next?.length ? el('h3', { class: 'section-h', text: t('nextGame') }) : null,
      sc.next?.length ? el('div', { class: 'q-card list' }, sc.next.slice(0, 20).map(e => eventRow(e, { league: false }))) : null
    ]);
  else {
    const order = { in: 0, pre: 1, post: 2 };
    const sorted = [...sc.events].sort((a, b) => order[a.status.state] - order[b.status.state] || a.start.localeCompare(b.start));
    list = el('div', { class: 'q-card list' }, sorted.map(e => eventRow(e, { league: false })));
  }
  const tools = el('div', { class: 'league-tools' }, [
    hasStandings(sc.league) ? el('button', { class: 'q-chip', type: 'button', text: t('table'), onclick: () => ((state.standings = { league: sc.league, groups: null }), showTab('standings')) }) : null,
    hasNews(sc.league) ? el('button', { class: 'q-chip', type: 'button', text: t('news'), onclick: () => ((state.news = { league: sc.league, articles: null }), showTab('news')) }) : null
  ]);
  put(box, sportChips, leagueChips, dayChips, tools, list);
  box.querySelector('.day-strip [aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}

// ---- Standings ------------------------------------------------------------------------------

function standingsTables(groups, league) {
  const sport = LEAGUES[league]?.sport;
  const want = STANDING_COLUMNS[sport] || ['W', 'L'];
  return el(
    'div',
    {},
    groups.map(g => {
      const cols = want.filter(c => g.rows.some(r => r.stats[c] != null && r.stats[c] !== ''));
      return el('div', { class: 'q-card pad' }, [
        g.name ? el('h3', { class: 'card-h', text: g.name }) : null,
        el('div', { class: 'table-wrap' }, [
          el('table', { class: 'data standings' }, [
            el('thead', {}, [el('tr', {}, [el('th', { class: 'left', text: '#' }), el('th', { class: 'left' }), ...cols.map(c => el('th', { text: c }))])]),
            el(
              'tbody',
              {},
              g.rows.map((r, i) =>
                el('tr', { class: isFollowed(league, r.id) ? 'mine' : '' }, [
                  el('td', { class: 'left num rank-cell', style: r.color ? `box-shadow: inset 3px 0 0 ${r.color}` : null, text: String(i + 1) }),
                  el('th', { class: 'left' }, [el('button', { class: 'link team-link', type: 'button', onclick: () => r.id && openTeam(league, r.id, r) }, [logo(r.logo, r.name, 'xs'), document.createTextNode(` ${r.short || r.name}`)])]),
                  ...cols.map(c => el('td', { class: 'num', text: r.stats[c] ?? '' }))
                ])
              )
            )
          ])
        ])
      ]);
    })
  );
}

async function renderStandings() {
  const box = $('panel-standings');
  const st = state.standings;
  const leagues = Object.keys(LEAGUES).filter(hasStandings);
  if (!hasStandings(st.league)) st.league = 'epl';
  const chips = el(
    'div',
    { class: 'q-chips' },
    leagues.map(k => el('button', { class: 'q-chip', type: 'button', 'aria-pressed': String(st.league === k), text: leagueName(k, locale), onclick: () => ((st.league = k), (st.groups = null), renderStandings()) }))
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

// ---- News -----------------------------------------------------------------------------------

function newsList(articles) {
  return el(
    'div',
    { class: 'news-list' },
    articles.map(a =>
      el('a', { class: 'news-card', href: a.url || '#', target: '_blank', rel: 'noopener' }, [
        a.image ? el('img', { src: a.image, alt: '', loading: 'lazy' }) : null,
        el('div', {}, [el('strong', { text: a.title }), a.text ? el('p', { text: a.text }) : null, a.at ? el('small', { class: 'muted', text: new Date(a.at).toLocaleString(locales, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) }) : null])
      ])
    )
  );
}
async function renderNews() {
  const box = $('panel-news');
  const nw = state.news;
  const leagues = [...new Set([...homeLeagues(), ...Object.keys(LEAGUES)])].filter(hasNews);
  nw.league ||= leagues[0];
  const chips = el(
    'div',
    { class: 'q-chips' },
    leagues.map(k => el('button', { class: 'q-chip', type: 'button', 'aria-pressed': String(nw.league === k), text: leagueName(k, locale), onclick: () => ((nw.league = k), (nw.articles = null), renderNews()) }))
  );
  if (!nw.articles) {
    put(box, chips, spinner());
    const want = nw.league;
    try {
      const list = await news(want);
      if (nw.league !== want) return;
      nw.articles = list;
    } catch {
      nw.articles = [];
    }
  }
  put(box, chips, nw.articles.length ? newsList(nw.articles) : empty(t('noNews')));
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
  if (tab === 'scores') state.scores.events ? renderScores() : loadScores();
  if (tab === 'standings') renderStandings();
  if (tab === 'news') renderNews();
}
for (const b of document.querySelectorAll('#tabs .tab')) b.addEventListener('click', () => showTab(b.dataset.tab));

// Live games refresh every 30 seconds while on screen.
setInterval(() => {
  if (document.visibilityState !== 'visible' || !q.active) return;
  if (state.tab === 'home' && state.home.events.some(e => e.status.state === 'in')) loadHome();
  if (state.tab === 'scores' && Array.isArray(state.scores.events) && state.scores.events.some(e => e.status.state === 'in')) loadScores();
  $('status').textContent = state.home.at ? t('updated', { time: clock(new Date(state.home.at).toISOString()) }) : '';
}, 30_000);

{
  const phone = matchMedia('(max-width: 720px)');
  const place = () => {
    if (phone.matches) $('mobile-bar').append($('status'), $('account-slot'));
    else {
      document.querySelector('.brand-text').append($('status'));
      document.querySelector('.appbar-inner').append($('account-slot'));
    }
  };
  place();
  phone.addEventListener('change', place);
}
if ('ResizeObserver' in window) {
  const watch = new MutationObserver(() => fitNumbers([...document.querySelectorAll('.mh-score')]));
  watch.observe(document.body, { childList: true, subtree: true });
}

window.__fxStarted = true;
const gated = installGate('match', locale);
watchUpdates({ current: document.querySelector('meta[name="build-version"]')?.content, key: 'quadraFixtures', cachePrefix: 'quadra-fixtures-' });
renderTabs();
$('account-slot').append(accountButton(q));
q.on('wallet', w => {
  state.wallet = w;
  if (state.tab === 'home' && state.home.at) renderHome();
});
q.on('active', live => live && loadHome());

async function boot() {
  const first = await q.start();
  state.wallet = q.wallet;
  applyPrefs(first?.payload);
  $('loading').hidden = true;
  const hash = location.hash.slice(1);
  showTab(TABS.includes(hash) ? hash : 'home');
  await loadHome();
}
if (!gated) boot();
setTimeout(() => ($('loading').hidden = true), 8000);

if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('./sw.js').catch(() => {});
