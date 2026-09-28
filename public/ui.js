// Quadra Fixtures' shared pieces: small DOM helpers, days and times, event
// rows, sheets. `ctx` is filled by app.js (the text, the state and the
// actions rows and sheets call).
import { LEAGUES, SPORTS, leagueName } from './lib/leagues.mjs';
import { stageTag } from './lib/stage.mjs';
import { broadcastsOf } from './lib/broadcast.mjs';

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

export function logo(url, name, cls = '') {
  if (!url) return el('span', { class: `logo logo-fallback ${cls}`, 'aria-hidden': 'true', text: (name || '?').trim().slice(0, 1) });
  const img = el('img', { class: `logo ${cls}`, src: url, alt: '', loading: 'lazy', decoding: 'async' });
  img.addEventListener('error', () => img.replaceWith(logo(null, name, cls)), { once: true });
  return img;
}
export const sportIcon = league => SPORTS[LEAGUES[league]?.sport]?.icon || '';
export const leagueChip = key => el('span', { class: 'league-tag', text: `${sportIcon(key)} ${leagueName(key, ctx.locale)}` });

// ---- Events --------------------------------------------------------------------------

export function statusText(e) {
  const { t } = ctx;
  const s = e.status;
  if (s.void) return t('postponed');
  if (s.state === 'in') return s.short || s.detail || t('live');
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
  return el('div', { class: `side${win ? ' win' : ''}` }, [
    logo(side.logo, side.name, 'sm'),
    el('span', { class: 'side-name' }, [side.rank ? el('small', { class: 'rank', text: String(side.rank) }) : null, document.createTextNode(side.short || side.name)]),
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
        series ? el('small', { class: 'series-line', text: series }) : null
      ])
    ]);
  }
  // Races, tournaments, fight cards: one row for the whole event.
  const sub = e.kind === 'field' ? (e.status.state === 'post' && e.sessions?.at(-1)?.field?.[0]?.name ? `🏆 ${e.sessions.at(-1).field[0].name}` : [e.session, e.venue].filter(Boolean).join(' · ')) : e.kind === 'card' ? `${e.bouts?.length || 0} ${t('card')}` : e.venue;
  return el('button', { class: `event-row wide${e.status.state === 'in' ? ' live' : ''}`, type: 'button', onclick: () => ctx.openEvent(e) }, [
    el('div', { class: 'event-meta' }, [statusEl(e, day), league ? leagueChip(e.league) : null]),
    el('div', { class: 'event-title' }, [el('strong', { text: e.name }), sub ? el('small', { text: sub }) : null])
  ]);
}

// Where to watch it in Taiwan: small chips (the first few).
export function twChips(league, n = 3) {
  const list = broadcastsOf(league);
  if (!list.length) return null;
  return el('div', { class: 'tw-chips' }, list.slice(0, n).map(b => el('span', { class: `tw-chip ${b.kind}`, text: ctx.locale === 'en' ? b.en : b.zh })));
}

// ---- Sheets and sections ----------------------------------------------------------------

export function sheet(title, { accent } = {}) {
  const dialog = el('dialog', { class: 'q-sheet fx-sheet' });
  const body = el('div', { class: 'sheet-body' });
  const close = () => dialog.close();
  dialog.append(el('div', { class: 'q-sheet-head' }, [el('h2', { text: title }), el('button', { class: 'q-close', type: 'button', text: '×', 'aria-label': ctx.t('close'), onclick: close })]), body);
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
