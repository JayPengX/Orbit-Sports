// Quadra Fixtures' shared pieces: small DOM helpers, days and times, event
// rows, sheets. `ctx` is filled by app.js (the text, the state and the
// actions rows and sheets call).
import { LEAGUES, SPORTS, leagueName, leagueLogo } from './lib/leagues.mjs';
import { logoPicture, countryFlag, f1Driver } from './lib/logos.mjs';
import { liveLabel, liveNote, possessionOf } from './lib/live.mjs';
import { stageTag } from './lib/stage.mjs';
import { broadcastsOf } from './lib/broadcast.mjs';
import { playGameId } from './lib/espn.mjs';

export const ctx = { t: k => k, locale: 'zh', state: null, openEvent: () => {}, openTeam: () => {}, openPlayer: () => {} };

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const child of [].concat(children)) if (child != null && child !== false) node.append(child);
  return node;
}
// replaceChildren, skipping the null and false left by conditional pieces.
export const put = (node, ...kids) => node.replaceChildren(...kids.flat().filter(k => k != null && k !== false));
export const spinner = () => el('div', { class: 'center-spin' }, [el('div', { class: 'spinner' })]);
export const empty = text => el('p', { class: 'empty', text });
export const $ = id => document.getElementById(id);

// ---- Days and times (the viewer's own clock) ----------------------------------------

export function localDate(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const today = () => localDate(Date.now());
export const addDays = (date, n) => localDate(new Date(`${date}T12:00:00`).getTime() + n * 86_400_000);
export const onDay = (e, date) => localDate(Date.parse(e.start)) === date;
const locales = () => (ctx.locale === 'en' ? 'en-US' : 'zh-TW');
export const clock = iso => new Date(iso).toLocaleTimeString(locales(), { hour: '2-digit', minute: '2-digit', hour12: false });
export function dayLabel(date, { long = false } = {}) {
  const { t } = ctx;
  const d = new Date(`${date}T12:00:00`);
  const wd = d.toLocaleDateString(locales(), { weekday: ctx.locale === 'en' ? 'short' : 'narrow' });
  const plain = `${d.getMonth() + 1}/${d.getDate()}`;
  const near = date === today() ? t('today') : date === addDays(today(), 1) ? t('tomorrow') : date === addDays(today(), -1) ? t('yesterday') : '';
  if (long) return near ? `${near} · ${plain}（${wd}）` : `${plain}（${wd}）`;
  return near || `${plain} ${wd}`;
}
export const whenText = iso => {
  const date = localDate(Date.parse(iso));
  return date === today() ? clock(iso) : `${dayLabel(date)} ${clock(iso)}`;
};
export function toast(text) {
  const box = el('div', { class: 'toast', text });
  $('toasts').append(box);
  setTimeout(() => box.remove(), 3200);
}

// ---- Logos, leagues ----------------------------------------------------------------

// A team's (or a player's) picture: the logo (tried twice), else a
// national side's flag, else the name's first letter.
export function logo(url, name, cls = '') {
  const fallback = () => {
    const flag = countryFlag(name);
    return flag ? el('span', { class: `logo logo-flag ${cls}`, 'aria-hidden': 'true', text: flag }) : el('span', { class: `logo logo-fallback ${cls}`, 'aria-hidden': 'true', text: (name || '?').trim().slice(0, 1) });
  };
  return logoPicture(url, null, `logo ${cls}`, fallback);
}
// An F1 driver: their headshot, else a badge in their team's colour.
export function driverLogo(url, name, cls = '') {
  const d = f1Driver(name);
  const initials = String(name || '').split(/\s+/).filter(w => !/^jr\.?$/i.test(w)).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return logoPicture(url, null, `logo ${cls}`, () => el('span', { class: `logo driver-badge ${cls}`, style: `--team:${d.color}`, 'aria-hidden': 'true', text: initials }));
}
export const sportIcon = league => SPORTS[LEAGUES[league]?.sport]?.icon || '';
// A league's mark: its logo, else its sport's icon.
// On a small white disc (as Quadra Play shows them), so no logo vanishes
// into a dark background.
export function leagueMark(key, cls = 'lg-mark') {
  const icon = () => el('span', { class: 'league-icon', 'aria-hidden': 'true', text: sportIcon(key) });
  return el('span', { class: `league-badge ${cls}` }, [logoPicture(leagueLogo(key), null, 'league-img', icon)]);
}
export const leagueChip = key => el('span', { class: 'league-tag' }, [leagueMark(key), el('span', { text: leagueName(key, ctx.locale) })]);

// ---- Events --------------------------------------------------------------------------

export function statusText(e) {
  const { t } = ctx;
  const s = e.status;
  if (s.void) return t('postponed');
  if (s.state === 'in') return e.kind === 'match' ? liveLabel(e, LEAGUES[e.league]?.sport, ctx.locale) : s.short || s.detail || t('live');
  if (s.state === 'post') return s.short && !/^final$/i.test(s.short) ? s.short : t('final');
  return whenText(e.start);
}
// A row's status: a game on another day shows its day above its time.
function statusEl(e, day = true) {
  if (e.status.state === 'pre' && !e.status.void && localDate(Date.parse(e.start)) !== today())
    return day ? el('span', { class: 'event-status pre two' }, [el('span', { text: dayLabel(localDate(Date.parse(e.start))) }), el('b', { text: clock(e.start) })]) : el('span', { class: 'event-status pre', text: clock(e.start) });
  return el('span', { class: `event-status ${e.status.state}`, text: statusText(e) });
}
export function sideLine(side, e, win) {
  const ball = e.status.state === 'in' && possessionOf(e) === side.homeAway;
  return el('div', { class: `side${win ? ' win' : ''}` }, [
    logo(side.logo, side.name, 'sm'),
    el('span', { class: 'side-name' }, [side.rank ? el('small', { class: 'rank', text: String(side.rank) }) : null, document.createTextNode(side.short || side.name), ball ? el('span', { class: 'ball', title: ctx.t('possession'), text: ' 🏈' }) : null]),
    e.status.state !== 'pre' && !e.status.void ? el('strong', { class: 'side-score num', text: side.score }) : null
  ]);
}
export function winners(e) {
  const decided = e.status.state === 'post' && e.home.score !== e.away.score;
  return {
    home: decided && (e.home.winner || Number(e.home.score) > Number(e.away.score)),
    away: decided && (e.away.winner || Number(e.away.score) > Number(e.home.score))
  };
}
// A playoff series line under a match: "LAL lead series 2-1".
export const seriesText = e => (e.series?.summary && !/^series starts/i.test(e.series.summary) ? e.series.summary : '');
// 投注: straight into Quadra Play on this game (a tap on it doesn't open the game here).
export function betChip(e) {
  const id = e.kind === 'match' && e.status.state !== 'post' && !e.status.void ? playGameId(e) : null;
  if (!id) return null;
  const go = ev => {
    ev.stopPropagation();
    ev.preventDefault();
    ctx.track?.('toPlay', [], 2);
    ctx.q.go('odds', `game=${id}`);
  };
  return el('span', { class: `bet-chip${e.status.state === 'in' ? ' live' : ''}`, role: 'link', tabindex: '0', onclick: go, onkeydown: ev => ev.key === 'Enter' && go(ev) }, [document.createTextNode(ctx.t(e.status.state === 'in' ? 'betLive' : 'betChip'))]);
}

export function eventRow(e, { league = true, day = true } = {}) {
  const { t } = ctx;
  const mine = ctx.isFollowedEvent?.(e);
  const tag = stageTag(e, ctx.locale);
  if (e.kind === 'match') {
    const w = winners(e);
    const series = seriesText(e);
    return el('button', { class: `event-row${e.status.state === 'in' ? ' live' : ''}${mine ? ' mine' : ''}`, type: 'button', onclick: () => ctx.openEvent(e) }, [
      el('div', { class: 'event-meta' }, [statusEl(e, day), league ? leagueChip(e.league) : null]),
      el('div', { class: 'event-sides' }, [
        tag ? el('span', { class: 'stage-tag', text: tag }) : null,
        sideLine(e.away, e, w.away),
        sideLine(e.home, e, w.home),
        series ? el('small', { class: 'series-line', text: series }) : null,
        liveLine(e)
      ]),
      betChip(e)
    ]);
  }
  // Races, tournaments, fight cards: one row for the whole event.
  const ended = e.sessionKey ? e.sessions?.find(x => x.abbr === e.sessionKey) : e.sessions?.at(-1);
  const sub = e.status.state === 'in' && fieldNow(e) ? fieldNow(e) : e.kind === 'field' ? (e.status.state === 'post' && ended?.field?.[0]?.name ? [e.session, `🏆 ${ended.field[0].name}`].filter(Boolean).join(' · ') : [e.session, e.venue].filter(Boolean).join(' · ')) : e.kind === 'card' ? `${e.bouts?.length || 0} ${t('card')}` : e.venue;
  return el('button', { class: `event-row wide${e.status.state === 'in' ? ' live' : ''}`, type: 'button', onclick: () => ctx.openEvent(e) }, [
    el('div', { class: 'event-meta' }, [statusEl(e, day), league ? leagueChip(e.league) : null]),
    el('div', { class: 'event-title' }, [el('strong', { text: e.name }), sub ? el('small', { text: sub }) : null])
  ]);
}

// A game on now: its line (count, outs and runners; down and ball; the
// latest goal), for the row under the sides.
export function liveLine(e) {
  if (e.status.state !== 'in' || !e.live) return null;
  const sport = LEAGUES[e.league]?.sport;
  const note = liveNote(e, sport, ctx.locale);
  if (!note && !(sport === 'baseball' && e.live.bases)) return null;
  return el('div', { class: `live-line${e.live.redZone ? ' red-zone' : ''}` }, [sport === 'baseball' && e.live.bases ? diamond(e.live.bases, e.live.outs) : null, note ? el('span', { text: note }) : null, e.live.redZone ? el('b', { class: 'rz', text: ctx.locale === 'en' ? 'Red zone' : '紅區' }) : null]);
}
// Baseball: the three bases (filled when a runner is on) and the outs.
export function diamond(bases = [], outs = 0, big = false) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 34 22');
  svg.setAttribute('class', `diamond${big ? ' big' : ''}`);
  svg.setAttribute('aria-label', `${bases.map((b, i) => (b ? i + 1 : '')).join('')} ${outs}`);
  const base = (x, y, on) => {
    const r = document.createElementNS(ns, 'rect');
    for (const [k, v] of Object.entries({ x: x - 3.6, y: y - 3.6, width: 7.2, height: 7.2, transform: `rotate(45 ${x} ${y})`, class: on ? 'on' : '' })) r.setAttribute(k, v);
    return r;
  };
  svg.append(base(24, 10, bases[0]), base(17, 4, bases[1]), base(10, 10, bases[2]));
  for (let i = 0; i < 3; i++) {
    const c = document.createElementNS(ns, 'circle');
    for (const [k, v] of Object.entries({ cx: 11 + i * 6, cy: 19, r: 1.9, class: i < outs ? 'on' : '' })) c.setAttribute(k, v);
    svg.append(c);
  }
  return svg;
}
// A tournament, race or fight card on now: what's happening in it.
export function fieldNow(e) {
  const en = ctx.locale === 'en';
  if (e.kind === 'draw') {
    const live = (e.draws || []).flatMap(d => d.matches).filter(m => m.status.state === 'in');
    if (!live.length) return '';
    const m = live[0];
    const line = `${m.a?.short || m.a?.name || ''} ${(m.a?.lines || []).join(' ')} · ${(m.b?.lines || []).join(' ')} ${m.b?.short || m.b?.name || ''}`.replace(/\s+/g, ' ').trim();
    return live.length > 1 ? `${line}${en ? ` +${live.length - 1} more` : ` 等 ${live.length} 場`}` : line;
  }
  if (e.kind === 'card') {
    const b = (e.bouts || []).find(x => x.status.state === 'in');
    return b ? `${b.status.short || ''} ${b.a?.short || b.a?.name || ''} vs ${b.b?.short || b.b?.name || ''}`.trim() : '';
  }
  const ss = e.sessionKey ? e.sessions?.find(x => x.abbr === e.sessionKey) : e.sessions?.find(x => x.status.state === 'in');
  const lead = ss?.field?.[0];
  return lead ? `${e.session ? `${e.session} · ` : ''}${en ? 'Leader' : '領先'} ${lead.short || lead.name}${lead.score && LEAGUES[e.league]?.sport === 'golf' ? ` ${lead.score}` : ''}` : '';
}

// Where to watch it in Taiwan: small chips (the first few).
export function twChips(league, n = 3) {
  const list = broadcastsOf(league);
  if (!list.length) return null;
  return el('div', { class: 'tw-chips' }, list.slice(0, n).map(b => el('span', { class: `tw-chip ${b.kind}`, text: ctx.locale === 'en' ? b.en : b.zh })));
}

// ---- Sheets and sections ----------------------------------------------------------------

export function sheet(title, { accent, league } = {}) {
  const dialog = el('dialog', { class: 'q-sheet fx-sheet' });
  const body = el('div', { class: 'sheet-body' });
  const close = () => dialog.close();
  dialog.append(el('div', { class: 'q-sheet-head' }, [league ? el('h2', { class: 'sheet-lg' }, [leagueMark(league), el('span', { text: title })]) : el('h2', { text: title }), el('button', { class: 'q-close', type: 'button', text: '×', 'aria-label': ctx.t('close'), onclick: close })]), body);
  dialog.addEventListener('click', e => e.target === dialog && close());
  dialog.addEventListener('close', () => dialog.remove());
  if (accent) dialog.style.setProperty('--q-accent', accent);
  document.body.append(dialog);
  dialog.showModal();
  return { dialog, body, close };
}
export function segmented(options, current, onPick, cls = 'scroll') {
  return el(
    'div',
    { class: `segmented ${cls}`, role: 'group' },
    options.map(([key, label]) => el('button', { type: 'button', 'aria-pressed': String(key === current), text: label, onclick: () => onPick(key) }))
  );
}
export function section(title, content, { sub = '', action = null, cls = '' } = {}) {
  return el('section', { class: `q-section ${cls}` }, [el('div', { class: 'q-section-head' }, [el('h2', { text: title }), action]), sub ? el('p', { class: 'section-sub', text: sub }) : null, content]);
}
export const moreButton = (label, onclick) => el('button', { class: 'section-more', type: 'button', text: label, onclick });
