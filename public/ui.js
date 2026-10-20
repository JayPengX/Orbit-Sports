// Orbit Sports' shared pieces: small DOM helpers, days and times, event
// rows, sheets. `ctx` is filled by app.js (the text, the state and the
// actions rows and sheets call).
import { LEAGUES, SPORTS, leagueName, leagueLogo } from './lib/leagues.mjs';
import { sidesInOrder } from '#kit/play-teams.mjs';
import { logoPicture, countryFlag, flagUrl, flagEmoji, f1Driver } from '#kit/logos.mjs';
import { keptTiming } from './lib/f1.mjs';
import { espnHeadshot, espnCollegeHeadshot, smallPhoto, isFlag, personPhoto } from '#kit/photos.mjs';
import { liveLabel, liveNote, closeLabel, goalHead } from './lib/live.mjs';
import { stageTag } from './lib/stage.mjs';
import { otherName } from './lib/compname.mjs';
import { AUDIO_NAMES, hasAudio } from './lib/broadcast.mjs';
import { freshHeadshot, SESSION_NAMES, espnSummary, onAir } from './lib/espn.mjs';
import { watchHalftime, halftimeAttrs, halftimeClock, halftimeEnd } from '#kit/quadra.mjs';
import * as kitUI from '#kit/ui.mjs';
import { channelsOf, watchOf, replayHint } from './lib/tv.mjs';
import { seriesLineZh } from './lib/statnames.mjs';
import { fold } from './lib/text.mjs';

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
// A child drawn again as the same node (the date strip) stays where it is,
// never taken out and put back: that lost its scroll and closed an open picker.
// A picture drawn again the same (a logo, a headshot) is the one already on
// screen, moved over (keepPictures): a new <img>, even of a file the phone
// holds, is blank a frame or more while it decodes, and every live refresh
// (the game sheet's every few seconds, the lists' scores) flashed every logo.
export function put(node, ...kids) {
  const list = kids.flat().filter(k => k != null && k !== false).map(k => (typeof k === 'string' ? document.createTextNode(k) : k));
  const keep = new Set(list.filter(k => k.parentNode === node));
  keepPictures(node, list, keep);
  if (!keep.size) return node.replaceChildren(...list);
  for (const c of [...node.childNodes]) if (!keep.has(c)) c.remove();
  let at = node.firstChild;
  for (const k of list) k === at ? (at = at.nextSibling) : node.insertBefore(k, at);
}
// A picture's place: its <picture> (with the dark-screen <source>) or the <img> alone.
const pictureOf = img => (img.parentNode?.tagName === 'PICTURE' ? img.parentNode : img);
// What makes two pictures the same: the files and the img's class (never its
// style: a new one fades in by it).
const pictureKey = img => {
  const pic = pictureOf(img);
  const sources = pic === img ? '' : [...pic.querySelectorAll('source')].map(x => `${x.getAttribute('srcset')} ${x.getAttribute('media')}`).join('|');
  return `${img.getAttribute('src')}#${sources}#${img.className}#${pic === img ? '' : pic.className}`;
};
function keepPictures(node, list, keep) {
  if (!node.firstChild || !list.length) return;
  // The ones on screen now that have drawn, in the children going away.
  const shown = new Map();
  for (const c of node.children) {
    if (keep.has(c)) continue;
    for (const img of c.tagName === 'IMG' ? [c] : c.querySelectorAll('img')) {
      if (!img.complete || !img.naturalWidth || !img.getAttribute('src')) continue;
      const k = pictureKey(img);
      shown.has(k) ? shown.get(k).push(img) : shown.set(k, [img]);
    }
  }
  if (!shown.size) return;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c.nodeType !== 1 || keep.has(c)) continue;
    for (const img of c.tagName === 'IMG' ? [c] : [...c.querySelectorAll('img')]) {
      const was = shown.get(pictureKey(img))?.shift();
      if (!was) continue;
      const [from, to] = [pictureOf(img), pictureOf(was)];
      if (from === c) list[i] = to;
      else from.replaceWith(to);
      // (The new one's alt and title: a name can change language.)
      for (const a of ['alt', 'title']) img.hasAttribute(a) ? was.setAttribute(a, img.getAttribute(a)) : was.removeAttribute(a);
    }
  }
}
export const spinner = () => el('div', { class: 'center-spin' }, [el('div', { class: 'spinner' })]);
export const empty = text => kitUI.empty({ title: text });
export const $ = id => document.getElementById(id);

// ---- Wide tables -----------------------------------------------------------------------
// A box score wider than the phone (twelve columns of a player's game) fades at
// its right edge while there's more that way: FS was the last column in view
// and nothing said OFF, YC, RC… were past it. (The name column stays put, so
// the left edge never fades.)
function markTable(wrap) {
  wrap.classList.toggle('more-right', wrap.scrollWidth - wrap.clientWidth > 2 && wrap.scrollLeft < wrap.scrollWidth - wrap.clientWidth - 2);
}
if (typeof document !== 'undefined') {
  document.addEventListener('scroll', e => e.target?.classList?.contains('table-wrap') && markTable(e.target), true);
  const marked = () => document.querySelectorAll('.table-wrap').forEach(markTable);
  let queued = false;
  new MutationObserver(() => queued || ((queued = true), requestAnimationFrame(() => ((queued = false), marked())))).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('resize', marked);
}

// ---- Days and times (the viewer's own clock) ----------------------------------------

export function localDate(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const today = () => localDate(Date.now());
export const addDays = (date, n) => localDate(new Date(`${date}T12:00:00`).getTime() + n * 86_400_000);
const locales = () => (ctx.locale === 'en' ? 'en-US' : 'zh-TW');
// (One formatter a language: making one costs more than a thousand uses, and a day's games ask hundreds of times.)
const clocks = new Map();
export const clock = iso => {
  const loc = locales();
  if (!clocks.has(loc)) clocks.set(loc, new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit', hour12: false }));
  return clocks.get(loc).format(new Date(iso));
};
export function dayLabel(date, { long = false } = {}) {
  const { t } = ctx;
  const d = new Date(`${date}T12:00:00`);
  // 週一, not 一 alone (beside a date it read as a dash: "10/5 —").
  const wd = d.toLocaleDateString(locales(), { weekday: 'short' });
  const plain = `${d.getMonth() + 1}/${d.getDate()}`;
  const near = date === today() ? t('today') : date === addDays(today(), 1) ? t('tomorrow') : date === addDays(today(), -1) ? t('yesterday') : '';
  const loc = ctx.locale === "en";
  const paren = loc ? ` (${wd})` : `（${wd}）`;
  if (long) return near ? `${near} · ${plain}${paren}` : `${plain}${paren}`;
  return near || `${plain} ${wd}`;
}
export function toast(text, action = null, ms = 3200) {
  const box = el('div', { class: `toast${action ? ' with-action' : ''}` }, [el('span', { text }), action]);
  $('toasts').append(box);
  setTimeout(() => box.remove(), ms);
  return box;
}

// ---- Watching: ELTA.tv, Apple TV ------------------------------------------------------
//
// On a phone an ELTA channel (or its schedule) opens in the ELTA.tv app
// itself (eltatv://live/<ch>, eltatv://schedule/live: the links ELTA's own
// site uses), so no Safari page is left behind when the app opens. If the app
// didn't open (not installed), a tap away from the web page; once the web
// page is taken that way, the next taps go straight to it for a month.
// Elsewhere, the web page. Apple TV's link opens its app by itself.
const APP_MISS = 'fx.eltaAppMiss';
const phone = () => (/Android/i.test(navigator.userAgent) ? 'android' : /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios' : '');
const appMissed = () => {
  try {
    return Date.now() - Number(localStorage.getItem(APP_MISS) || 0) < 30 * 86_400_000;
  } catch {
    return false;
  }
};
export function openWatch(ev, b) {
  const device = phone();
  if (!b.app || !device || appMissed()) return; // the link's own web page
  ev.preventDefault();
  if (device === 'android') {
    // Android's own fallback: the web page when the app isn't there.
    location.href = `intent://${b.app.replace(/^eltatv:\/\//, '')}#Intent;scheme=eltatv;package=tv.eltaott.app;${b.url ? `S.browser_fallback_url=${encodeURIComponent(b.url)};` : ''}end`;
    return;
  }
  let left = false;
  let offer = null;
  const away = () => {
    if (document.visibilityState !== 'hidden') return;
    left = true;
    offer?.remove();
  };
  document.addEventListener('visibilitychange', away);
  window.addEventListener('pagehide', away, { once: true });
  location.href = b.app;
  setTimeout(() => {
    if (left || !b.url) return document.removeEventListener('visibilitychange', away);
    const web = el('a', {
      class: 'toast-act',
      href: b.url,
      target: '_blank',
      rel: 'noopener',
      text: `${ctx.t('eltaWeb')} ›`,
      onclick: () => {
        try {
          localStorage.setItem(APP_MISS, String(Date.now()));
        } catch {}
        offer?.remove();
      }
    });
    offer = toast(ctx.t('eltaAppMiss'), web, 8000);
    setTimeout(() => document.removeEventListener('visibilitychange', away), 8000);
  }, 1800);
}
// A link that plays a channel (`b` from tvOf: url, app), or a plain label when it can't be watched online.
export const watchLink = (b, attrs, children) => (b.url ? el('a', { ...attrs, href: b.url, target: '_blank', rel: 'noopener', onclick: ev => openWatch(ev, b) }, children) : el('div', attrs, children));
// One tap to watch a game on now (or starting within half an hour): ▶ 觀看 and where (MAX5台,
// 愛爾達, Apple TV), straight into the app. Null when it can't be watched.
export function watchButton(e, cls = '') {
  const on = !e.status?.void && (e.status?.state === 'in' || (e.status?.state === 'pre' && Date.parse(e.start) - Date.now() < 30 * 60_000));
  const b = on ? watchOf(e) : null;
  if (!b) return null;
  return watchLink(b, { class: `watch-btn ${cls}`.trim(), 'aria-label': `${ctx.locale === 'en' ? 'Watch on' : '觀看'} ${b[ctx.locale === 'en' ? 'en' : 'zh']}` }, [
    el('span', { class: 'watch-play', 'aria-hidden': 'true' }),
    el('span', { class: 'watch-text' }, [el('strong', { text: ctx.locale === 'en' ? 'Watch' : '觀看' }), cls.includes('wide') ? el('small', { text: b.short[ctx.locale === 'en' ? 'en' : 'zh'] }) : null])
  ]);
}
// A row with its watch button (a live game's): at the foot of the row's
// left column, under the time and league (on a line of its own under the
// row it left the card half empty, the time floating in the middle); kept
// outside the row's own button (a link in a button isn't followed), the
// column holding room for it. Or the row alone.
export const withWatch = (row, e) => {
  const watch = watchButton(e);
  if (!watch) return row;
  const side = row.classList.contains('event-row') && row.querySelector(':scope > .event-meta');
  return el('div', { class: `watch-row${side ? ' in-meta' : ''}` }, [row, watch]);
};

// ---- Logos, leagues ----------------------------------------------------------------

// A team's (or a player's) picture: the logo (tried twice), else a
// national side's flag, else the name's first letter.
// onWhite: drawn on a white disc in every theme (a face's team badge):
// never the dark screen's version (the Rays' light mark vanished on it).
// A game's two sides in the kit's order (soccer home first, the rest away first).
export const sidesOf = e => sidesInOrder({ home: e.home, away: e.away, sport: e.league });
export function logo(url, name, cls = '', { onWhite = false } = {}) {
  const fallback = () => {
    const flag = countryFlag(name);
    return flag ? el('span', { class: `logo logo-flag ${cls}`, 'aria-hidden': 'true', text: flag }) : el('span', { class: `logo logo-fallback ${cls}`, 'aria-hidden': 'true', text: (name || '?').trim().slice(0, 1) });
  };
  return logoPicture(smallPhoto(freshHeadshot(url)), onWhite ? null : darkLogo(url), `logo ${cls}${PLATED.test(url || '') ? ' plate' : ''}`, fallback);
}
// Logos drawn dark with no version for a dark screen (the London Lions' black
// lion): on a light round plate there, so they don't vanish into the card.
const PLATED = /London_Lions_logo/;
// A team logo's version for a dark screen (ESPN's 500-dark, NBA.com's D): the
// Padres' brown or the Yankees' navy mark doesn't vanish on a dark card.
export const darkLogo = url =>
  typeof url !== 'string' ? null
  : /^https:\/\/a\.espncdn\.com\/i\/teamlogos\/(?!countries\/)[a-z0-9-]+\/500\//.test(url) ? url.replace('/500/', '/500-dark/')
  : /^https:\/\/cdn\.nba\.com\/logos\/nba\/.+\/primary\/L\/logo\.svg$/.test(url) ? url.replace('/primary/L/', '/primary/D/')
  : null;
// A race weekend's country flag, the emoji if the picture fails.
export const raceFlag = (e, cls = '') => (e?.country ? logoPicture(flagUrl(e.country), null, `race-flag ${cls}`.trim(), () => el('span', { class: `race-flag emoji ${cls}`.trim(), 'aria-hidden': 'true', text: flagEmoji(e.country) })) : null);
// A person (a player, a driver): their studio headshot (the feed's, ESPN's by
// their id or name, TheSportsDB's cutout), never a flag while a face can be
// had; the flag (or, for a driver, their team's colour) only when there's none.
// `p`: { id, name, en?, logo?, headshot?, flag? }.
export function personPic(p, league, cls = '') {
  const name = p?.en || p?.name || '';
  const flag = p?.flag || (isFlag(p?.logo) ? p.logo : '');
  // The feed's own pictures, then the kit's way (photos.mjs personPhoto):
  // one found before, ESPN's by id (a guess), then a search by name; the
  // driver's badge, the flag or the initials meanwhile or when there's none.
  const stand = () => (league === 'f1' ? driverBadge(name, cls) : flag ? logoPicture(flag, null, `logo ${cls} flag-pic`, () => initialsPic(name, cls)) : countryFlag(name) ? el('span', { class: `logo logo-flag ${cls}`, 'aria-hidden': 'true', text: countryFlag(name) }) : initialsPic(name, cls));
  return personPhoto(name, league, { urls: [p?.headshot, isFlag(p?.logo) ? null : p?.logo].map(freshHeadshot), guess: freshHeadshot(espnHeadshot(league, p?.id)), later: [espnCollegeHeadshot(league, p?.id)], cls: `logo ${cls}`, fallback: stand });
}
const initialsPic = (name, cls) =>
  el('span', {
    class: `logo logo-fallback ${cls}`,
    'aria-hidden': 'true',
    text: String(name || '?').split(/\s+/).filter(w => w && !/^(jr|sr)\.?$/i.test(w)).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
  });
function driverBadge(name, cls) {
  const d = f1Driver(name);
  const initials = String(name || '').split(/\s+/).filter(w => !/^jr\.?$/i.test(w)).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return el('span', { class: `logo driver-badge ${cls}`, style: `--team:${d.color}`, 'aria-hidden': 'true', text: initials });
}
export const sportIcon = league => SPORTS[LEAGUES[league]?.sport]?.icon || '';
// A league's mark: its logo, else its sport's icon.
// On a small white disc (as Quadra Play shows them), so no logo vanishes
// into a dark background.
export function leagueMark(key, cls = 'lg-mark') {
  const icon = () => el('span', { class: 'league-icon', 'aria-hidden': 'true', text: sportIcon(key) });
  return el('span', { class: `league-badge ${cls}` }, [logoPicture(leagueLogo(key), null, 'league-img', icon)]);
}
export const leagueChip = (key, short = false) => el('span', { class: 'league-tag' }, [leagueMark(key), el('span', { text: short ? shortLeague(key) : leagueName(key, ctx.locale) })]);
// A row's narrow column: a league known by its letters by them alone (MLB, not MLB 美國職棒);
// in English, by the letters fans use (Premier League and Bundesliga wrapped there).
const SHORT_EN = { epl: 'EPL', bundesliga: 'Bundes.', seriea: 'Serie A', ligue1: 'Ligue 1', ucl: 'UCL', uel: 'UEL', uecl: 'UECL', facup: 'FA Cup', scotland: 'SPFL', nationsleague: 'UNL', f1: 'F1' };
const shortLeague = key => (ctx.locale === 'en' && SHORT_EN[key]) || /^([A-Za-z0-9]+) [^\x00-\x7f]/.exec(leagueName(key, ctx.locale))?.[1] || leagueName(key, ctx.locale);
// An event's competition: its league, or (a friendly, a cup Orbit Sports doesn't have) its own name.
const compChip = e => (e.other ? el('span', { class: 'league-tag other' }, [el('span', { text: otherName(e.other, ctx.locale === 'en') })]) : leagueChip(e.league, true));

// ---- Events --------------------------------------------------------------------------

// A game at half-time: its countdown's key, its break's end looked up once
// (ESPN's summary, the kit's watchHalftime); null for any other moment.
const atHalftime = e => e.kind === 'match' && e.status?.state === 'in' && !e.status.delayed && /HALFTIME/.test(e.status.name || '') && Boolean(LEAGUES[e.league]?.espn);
export function halftimeKey(e) {
  if (!atHalftime(e)) return null;
  const key = `sports:${e.league}:${e.id}`;
  watchHalftime(key, { sport: LEAGUES[e.league].sport, league: e.league, read: () => espnSummary(e.league, e.id) });
  return key;
}
// What a status's element carries to tick (中場休息 12:34), drawn with statusText's words.
export const halftimeTick = (e, label = statusText(e)) => {
  const key = halftimeKey(e);
  return key ? halftimeAttrs(key, label.replace(/\s+\d+:\d{2}$/, '')) : {};
};
export function statusText(e) {
  const { t } = ctx;
  const s = e.status;
  const ht = halftimeKey(e);
  if (ht) return [liveLabel(e, LEAGUES[e.league]?.sport, ctx.locale), halftimeClock(halftimeEnd(ht))].filter(Boolean).join(' ');
  if (s.void) return t('postponed');
  // Waiting (rain, a late start): still on, not called off.
  if (s.delayed && s.state === 'pre') return t('delayed');
  if (s.state === 'in') {
    const label = e.kind === 'match' ? liveLabel(e, LEAGUES[e.league]?.sport, ctx.locale) : fieldStatus(String(s.short || s.detail || t('live')));
    // ESPN's own word for it ("Delayed") gives way to ours.
    if (s.delayed) return /delay|suspend/i.test(label) ? t('paused') : `${label} · ${t('paused')}`;
    return label;
  }
  if (s.state === 'post') return s.short && !/^final$/i.test(s.short) ? finalText(s.short) : t('final');
  return whenOf(e);
}
// A finished game's ESPN status in Chinese: "Final/OT" 完賽（延長）, "Final/10"
// 完賽（10 局）, "FT", "AET", "FT-Pens"…; anything else as ESPN wrote it.
function finalText(text) {
  if (ctx.locale === 'en') return text;
  const t = String(text).trim();
  const F = ctx.t('final');
  const f = /^F(?:inal)?\/(.+)$/i.exec(t);
  if (f) {
    const x = f[1];
    if (/^OT$/i.test(x)) return `${F}（延長）`;
    const ot = /^(\d)OT$/i.exec(x);
    if (ot) return `${F}（${ot[1]} 度延長）`;
    if (/^SO$/i.test(x)) return `${F}（射門大賽）`;
    if (/^\d+$/.test(x)) return `${F}（${x} 局）`;
    return `${F}（${x}）`;
  }
  if (/^(FT|Full Time)$/i.test(t)) return ctx.t('final');
  if (/^AET$/i.test(t)) return `${F}（延長賽）`;
  if (/pens|penalties/i.test(t)) return `${F}（PK 大戰）`;
  if (/^(retired|ret\.?)$/i.test(t)) return '退賽';
  if (/^(walkover|w\/o)$/i.test(t)) return '不戰而勝';
  if (/^abandoned$/i.test(t)) return '比賽中止';
  return t;
}
// ESPN's words for a race on now, in Chinese: "In Progress", "Lap 12/57".
function fieldStatus(text) {
  if (ctx.locale === 'en') return text;
  return text
    .replace(/\s*-\s*In Progress\b/i, ' 進行中')
    .replace(/\bIn Progress\b/i, ctx.t('live'))
    .replace(/\bLap (\d+)\s*\/\s*(\d+)/i, '第$1/$2圈')
    .replace(/\bLap (\d+)/i, '第$1圈');
}
// The time a schedule shows: an F1 session's official start (its `start`
// is when the titles come, a few minutes before).
export const shownStart = e => e?.official || e?.start;
// A game's hour: 待定 while it isn't set (a play-off's next game: its day is known, its time not yet).
export const timeText = e => (e?.timeTbd ? (ctx.locale === 'en' ? 'TBD' : '待定') : clock(shownStart(e)));
// When a game or session is, as every list says it (today its time, another
// day's its day too): its official start (an F1 session's, not its titles' minutes
// before) and 待定 while its hour isn't set, never the stand-in's clock.
export const whenOf = e => {
  const date = localDate(Date.parse(shownStart(e)));
  return date === today() ? timeText(e) : `${dayLabel(date)} ${timeText(e)}`;
};
// A row's status: a game on another day shows its day above its time.
function statusEl(e, day = true) {
  if (e.status.state === 'pre' && !e.status.void && localDate(Date.parse(e.start)) !== today())
    return day ? el('span', { class: 'event-status pre two' }, [el('span', { text: dayLabel(localDate(Date.parse(e.start))) }), el('b', { text: timeText(e) })]) : el('span', { class: 'event-status pre', text: timeText(e) });
  // Its start come, ESPN not yet saying it's under way: about to start, said in the live colour.
  // (The one rule for it, onAir: not a game whose hour is only a stand-in, nor one hours past it.)
  if (e.status.state === 'pre' && onAir(e)) return el('span', { class: 'event-status in', text: ctx.locale === 'en' ? 'Starting' : '即將開賽' });
  // A game on now with its clock (第4節 8:58): the period, the clock under it (two lines drawn for it, never a wrap).
  const text = statusText(e);
  // At half-time: 中場休息, its countdown under it, ticking (the line kept for it before the countdown is known).
  const ht = halftimeKey(e);
  if (ht) return el('span', { class: 'event-status in clocked' }, [el('span', { text: text.replace(/\s+\d+:\d{2}$/, '') }), el('small', { class: 'num', ...halftimeAttrs(ht), text: /\d+:\d{2}$/.exec(text)?.[0] || '' })]);
  const clockAt = e.status.state === 'in' ? /^(.+?)\s+(\d{1,2}:\d{2}(?:\.\d)?)$/.exec(text) : null;
  if (clockAt) return el('span', { class: 'event-status in clocked' }, [el('span', { text: clockAt[1] }), el('small', { class: 'num', text: clockAt[2] })]);
  // Paused mid-game (rain): the period, 暫停 under it (two lines drawn for it, never a wrap).
  const pausedAt = e.status.state === 'in' && e.status.delayed ? new RegExp(`^(.+?) · (${ctx.t('paused')})$`).exec(text) : null;
  if (pausedAt) return el('span', { class: 'event-status in clocked' }, [el('span', { text: pausedAt[1] }), el('small', { text: pausedAt[2] })]);
  // A final with more to say (完賽（10 局）, 完賽（PK 大戰）): 完賽, and the rest under it (two lines drawn for it, never cut).
  const ended = e.status.state === 'post' ? /^(.+?)（(.+)）$/.exec(text) : null;
  if (ended) return el('span', { class: 'event-status post ended' }, [el('span', { text: ended[1] }), el('small', { text: ended[2] })]);
  return el('span', { class: `event-status ${e.status.state}`, text });
}
// A side's picture: a person's photo (a driver), a team's badge.
export const sideLogo = (side, league, cls = '') => (side && side.athlete ? personPic(side, league, `${cls} round`) : logo(side?.logo, side?.name, cls));
// A side's score as shown: a dash while there's none (a game just begun,
// a list that has only its state), never a made-up 0.
export const scoreText = v => (v == null || String(v).trim() === '' ? '–' : String(v));
export function sideLine(side, e, win) {
  return el('div', { class: `side${win ? ' win' : ''}` }, [
    sideLogo(side, e.league, 'sm'),
    el('span', { class: 'side-name', text: side.short || side.name }),
    e.status.state !== 'pre' && !e.status.void ? el('strong', { class: 'side-score num', 'data-q-live': e.status.state === 'in' ? `sc:${e.league}:${e.id}:${side.id}` : null, text: e.status.state === 'post' && (side.score === '' || side.score == null) ? '' : scoreText(side.score) }) : null
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
// In Chinese: "洋基 系列賽 2-1 領先" (the sides by their names).
// A series' length: 七戰四勝 / Best of 7 (ESPN's totalCompetitions), or ''.
const ZH_N = ['', '一', '兩', '三', '四', '五', '六', '七', '八', '九'];
export const bestOf = e => {
  const n = Number(e?.series?.games) || 0;
  if (n < 3 || n > 9 || n % 2 === 0) return '';
  return ctx.locale === 'en' ? `Best of ${n}` : `${ZH_N[n]}戰${ZH_N[(n + 1) / 2]}勝`;
};
// A series game's line: its length, then how it stands (白襪 2-1 領先).
export const seriesText = e => {
  const s = e.series?.summary;
  const len = bestOf(e);
  if (!s || /^series starts/i.test(s)) return len;
  const name = abbr => [e.home, e.away].find(x => x?.abbr && x.abbr.toUpperCase() === String(abbr).toUpperCase())?.short || abbr;
  const now = ctx.locale === 'en' ? s : seriesLineZh(s, name) || s;
  return [len, now].filter(Boolean).join(' · ');
};
// A game as a row: its time (or state) down the left, the two sides with
// their scores, then a line of tags: the league, the stage, ★ 推薦 for one of
// today's picks, the channels it's on (or where it can be watched again).
const pickMark = () => el('span', { class: 'q-tag tint pick-mark', text: ctx.locale === 'en' ? '★ Pick' : '★ 推薦' });
const rowTags = (e, { league, picked, tag }) => {
  const kids = [league ? compChip(e) : null, tag ? el('span', { class: 'q-tag orange', text: tag }) : null, picked ? pickMark() : null, tvLine(e)].filter(Boolean);
  return kids.length ? el('div', { class: 'ev-tags' }, kids) : null;
};
export function eventRow(e, { league = true, day = true, picked = false } = {}) {
  const mine = ctx.isFollowedEvent?.(e);
  const live = e.status.state === 'in';
  if (e.kind === 'match') {
    const w = winners(e);
    const series = seriesText(e);
    return el('button', { class: `event-row${live ? ' live' : ''}${mine ? ' mine' : ''}`, type: 'button', disabled: e.status?.void ? true : null, onclick: () => ctx.openEvent(e) }, [
      el('div', { class: 'event-meta' }, [statusEl(e, day)]),
      el('div', { class: 'event-sides' }, [sideLine(e.away, e, w.away), sideLine(e.home, e, w.home), series ? el('small', { class: 'series-line', text: series }) : null, liveLine(e), rowTags(e, { league, picked, tag: stageTag(e, ctx.locale) })])
    ]);
  }
  // A race weekend (or one of its sessions): one row.
  const ended = e.sessionKey ? e.sessions?.find(x => x.abbr === e.sessionKey) : e.sessions?.at(-1);
  // A race weekend's session: its badge says which, so the line under it doesn't repeat it.
  const sess = sessionTag(e);
  const said = sess ? '' : e.session;
  const sub = live && fieldNow(e) ? fieldNow(e).replace(sess && e.session ? `${e.session} · ` : '', '') : e.kind === 'field' ? (e.status.state === 'post' && ended?.field?.[0]?.name ? [said, (ctx.locale === 'en' ? `Won by ${ended.field[0].name}` : `冠軍 ${ended.field[0].name}`)].filter(Boolean).join(' · ') : [said, e.venue].filter(Boolean).join(' · ')) : e.venue;
  return el('button', { class: `event-row wide${live ? ' live' : ''}${mine ? ' mine' : ''}${sess ? ` sess-${e.sessionKey === 'Race' ? 'race' : 'other'}` : ''}`, type: 'button', disabled: e.status?.void ? true : null, onclick: () => ctx.openEvent(e) }, [
    el('div', { class: 'event-meta' }, [statusEl(e, day)]),
    el('div', { class: 'event-title' }, [el('div', { class: 'sess-head' }, [raceFlag(e), sess, el('strong', { text: e.name })]), e.league === 'f1' && live ? f1Brief(e) : podium(e) || (sub ? el('small', { text: sub }) : null), rowTags(e, { league, picked })])
  ]);
}

// A game on now: its line (count, outs and runners; the latest goal), for
// the row under the sides. Baseball: the bases and outs drawn, the count,
// then who bats against whom by last name, quietly.
export function liveLine(e) {
  if (e.status.state !== 'in' || !e.live) return null;
  const sport = LEAGUES[e.league]?.sport;
  if (sport === 'baseball' && e.live.bases) {
    const lv = e.live;
    const en = ctx.locale === 'en';
    const last = name => String(name || '').replace(/\s+(Jr\.?|Sr\.?|II|III|IV)$/i, '').split(' ').at(-1);
    const who = lv.batter && lv.pitcher ? `${last(lv.batter)} vs ${last(lv.pitcher)}` : last(lv.batter);
    // The batter's and pitcher's faces, overlapping.
    const faces = [lv.batterWho, lv.pitcherWho].filter(Boolean);
    return el('div', { class: 'live-line base' }, [
      diamond(lv.bases, lv.outs),
      el('span', { class: 'live-text' }, [
        el('span', { class: 'live-count num', text: [closeLabel(e, sport, ctx.locale), en ? `${lv.balls ?? 0}-${lv.strikes ?? 0} · ${lv.outs ?? 0} out` : `${lv.balls ?? 0}壞${lv.strikes ?? 0}好 · ${lv.outs ?? 0}出局`].filter(Boolean).join(' · ') }),
        who ? el('span', { class: 'live-who' }, [faces.length ? el('span', { class: 'live-faces', 'aria-hidden': 'true' }, faces.map(p => personPic({ ...p, en: p.name }, e.league, 'xs round'))) : null, el('span', { class: 'live-names', text: who })]) : null
      ])
    ]);
  }
  // Soccer: the latest goal, as two lines like baseball's (the minute, then who).
  const goal = sport === 'soccer' ? (e.live.events || []).filter(x => x.kind !== 'red').at(-1) : null;
  if (goal) {
    const en = ctx.locale === 'en';
    // The scorer's face with a ball at its bottom right (an own goal: that team's logo alone, the defender named),
    // then the minute over the club's badge and the scorer.
    const side = [e.home, e.away].find(s => String(s?.id) === goal.team);
    const own = goal.kind === 'own';
    const p = goal.person || { name: goal.who };
    const pic = own && side ? logo(side.logo, side.name, 'sm') : personPic({ ...p, en: p.name }, e.league, 'sm round');
    return el('div', { class: 'live-line base goal' }, [
      el('span', { class: 'live-scorer', 'aria-hidden': 'true' }, [pic, own ? null : el('span', { class: 'scorer-ball', text: '⚽' })]),
      el('span', { class: 'live-text' }, [
        el('span', { class: 'live-count' }, [...goalHead(e, ctx.locale).map(t => el('span', { text: t })), el('span', { class: 'num live-min', text: goal.minute })]),
        el('span', { class: 'live-who' }, [!own && side?.logo ? logo(side.logo, side.name, 'scorer-club') : null, el('span', { class: 'live-names', text: own ? `${goal.who} ${en ? 'own goal' : '烏龍球'}` : `${goal.who}${goal.kind === 'pen' ? (en ? ' (pen)' : '（點球）') : ''}` })])
      ])
    ]);
  }
  const note = liveNote(e, sport, ctx.locale);
  // Basketball: each side's points leader now, faces and points, the way baseball's shows batter and pitcher.
  const sc = e.live.scorers;
  if (sport === 'basketball' && (sc?.away || sc?.home)) {
    const en = ctx.locale === 'en';
    const last = p => String(p.short || p.name || '').split(' ').at(-1);
    const both = [sc.away, sc.home].filter(Boolean);
    return el('div', { class: 'live-line base hoop' }, [
      el('span', { class: 'live-faces', 'aria-hidden': 'true' }, both.map(p => personPic({ ...p, en: p.name }, e.league, 'xs round'))),
      el('span', { class: 'live-text' }, [
        el('span', { class: 'live-count', text: [note, en ? 'Top scorers' : '得分王'].filter(Boolean).join(' · ') }),
        el('span', { class: 'live-who' }, [el('span', { class: 'live-names num', text: both.map(p => `${last(p)} ${p.value}`).join(' · ') })])
      ])
    ]);
  }
  return note ? el('div', { class: 'live-line' }, [el('span', { text: note })]) : null;
}
// Baseball: the three bases (filled when a runner is on) and, unless
// `outs` is null, the outs as three dots under them.
export function diamond(bases = [], outs = 0, big = false) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  const withOuts = outs != null;
  svg.setAttribute('viewBox', withOuts ? '0 0 30 30' : '0 0 30 21');
  svg.setAttribute('class', `diamond${big ? ' big' : ''}${withOuts ? '' : ' bare'}`);
  svg.setAttribute('aria-label', `${bases.map((b, i) => (b ? i + 1 : '')).join('')} ${outs ?? ''}`.trim());
  const base = (x, y, on) => {
    const r = document.createElementNS(ns, 'rect');
    for (const [k, v] of Object.entries({ x: x - 3.4, y: y - 3.4, width: 6.8, height: 6.8, rx: 1, transform: `rotate(45 ${x} ${y})`, class: on ? 'on' : '' })) r.setAttribute(k, v);
    return r;
  };
  svg.append(base(23, 13, bases[0]), base(15, 5.5, bases[1]), base(7, 13, bases[2]));
  if (withOuts)
    for (let i = 0; i < 3; i++) {
      const c = document.createElementNS(ns, 'circle');
      for (const [k, v] of Object.entries({ cx: 9 + i * 6, cy: 26.5, r: 2.2, class: i < outs ? 'on' : '' })) c.setAttribute(k, v);
      svg.append(c);
    }
  return svg;
}
// A race on now: who leads it.
// F1's live timing for the session on now (app.js keeps it, from the
// proxy's copy of F1's own feed): `key` the session event's id.
export const f1Live = { feed: null, key: '', failed: false };
// A block's shape while its numbers are read: grey bars where they'll be,
// so nothing moves when they come (`lines`: [width%…], `cls` the block's).
export const skeleton = (lines, cls = '') => el('div', { class: `skel-block ${cls}`.trim(), 'aria-hidden': 'true' }, lines.map(w => el('i', { class: 'skel', style: `width:${w}%` })));
// Seconds as a clock's minutes and seconds ("12:05").
export const mmss = n => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
// A card's brief of an F1 session on now, as baseball's shows the count:
// the part (or lap) and the time left, then the top three with their
// pictures and best lap (qualifying, practice) or gap (a race). A slot
// (`data-f1-brief`) app.js fills again as the feed moves; until the feed is
// in, the leader as ESPN has it.
// A driver as F1 names them (its page's: "Kimi Antonelli", not ESPN's "Andrea Kimi Antonelli").
export const f1Shown = full => {
  const page = f1Driver(full).page;
  return page ? page.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ').replace(/\bHulkenberg\b/, 'Hülkenberg').replace(/\bPerez\b/, 'Pérez') : full;
};
export function f1Brief(e) {
  if (e?.league !== 'f1' || e.status?.state !== 'in') return null;
  const box = el('div', { class: 'f1-brief', 'data-f1-brief': e.id });
  fillF1Brief(box, e);
  return box;
}
export function fillF1Brief(box, e) {
  const en = ctx.locale === 'en';
  const f = (f1Live.key === e.id && f1Live.feed) || keptTiming(e.sessionKey, e.official || e.start);
  if (!f) {
    // The feed not in yet: its shape (the head and three rows); ESPN's leader only if it can't be read.
    if (!f1Live.failed) return put(box, skeleton([38, 82, 76, 70], 'f1-brief-skel'));
    const lead = fieldNow(e);
    return put(box, lead ? el('small', { class: 'live-line', text: lead }) : null);
  }
  // Faded in only when it takes the place of its shape (a repaint draws it straight).
  const first = Boolean(box.querySelector('.f1-brief-skel'));
  const race = e.sessionKey === 'Race' || e.sessionKey === 'SR';
  const quali = /^(Qual|SS|SQ)$/.test(e.sessionKey || '');
  // As the feed last said it, not counted on between reads.
  const left = Math.max(0, f.clock.left);
  const head = race && f.lap?.now ? (en ? `Lap ${f.lap.now}/${f.lap.of}` : `第 ${f.lap.now}/${f.lap.of} 圈`) : [quali && f.part ? `${e.sessionKey === 'Qual' ? 'Q' : 'SQ'}${f.part}` : '', `${en ? '' : '剩 '}${mmss(left)}${en ? ' left' : ''}`].filter(Boolean).join(' · ');
  const field = (e.sessions || []).find(x => x.abbr === e.sessionKey)?.field || [];
  put(
    box,
    el('small', { class: 'f1-brief-head num', text: head }),
    el(
      'ol',
      { class: 'f1-brief-top' },
      f.cars.slice(0, 3).map((c, i) => {
        const espn = field.find(x => fold(x.name) === fold(c.name)) || { name: c.name };
        return el('li', {}, [
          el('span', { class: 'pos num', text: String(c.pos) }),
          personPic({ ...espn, en: c.name }, 'f1', 'xs round'),
          el('span', { class: 'f1-brief-name', text: f1Shown(c.name) }),
          el('span', { class: 'num f1-brief-v', text: race ? (i === 0 ? '' : c.gap) : c.best || (i === 0 ? '' : c.gap) || '' })
        ]);
      })
    )
  );
  if (first) box.classList.add('fade-in');
}
// A finished race or session: its top three, each with their photo, in a line.
export function podium(e) {
  if (e.kind === 'match' || e.status?.state !== 'post') return null;
  const ss = e.sessionKey ? e.sessions?.find(x => x.abbr === e.sessionKey) : e.sessions?.at(-1);
  const top = (ss?.field || e.field || []).slice(0, 3);
  if (top.length < 3) return null;
  // Each by their full name ("Max Verstappen"), as every card names a player.
  const nameOf = x => (e.league === 'f1' ? f1Shown(x.name) : x.name || x.short);
  return el('ol', { class: 'top-three' }, top.map((x, i) => el('li', { class: `p${i + 1}` }, [
    el('span', { class: 'pos num', text: String(i + 1) }),
    personPic({ ...x, en: x.name }, e.league, 'xs round'),
    el('span', { class: 'top-three-name', text: nameOf(x) })
  ])));
}
export function fieldNow(e) {
  const en = ctx.locale === 'en';
  const ss = e.sessionKey ? e.sessions?.find(x => x.abbr === e.sessionKey) : e.sessions?.find(x => x.status.state === 'in');
  const lead = ss?.field?.[0];
  return lead ? `${e.session ? `${e.session} · ` : ''}${en ? 'Leader' : '領先'} ${lead.short || lead.name}` : '';
}

// A channel's name in the reader's language, with its note.
export const tvName = b => `${ctx.locale === 'en' ? b.en : b.zh}${b.note ? `（${ctx.locale === 'en' ? b.note.en : b.note.zh}）` : ''}`;
// A row's 📺 line: the channels a game is on, when a schedule says (not a guess from the league).
// Each with its commentary (英文原音, 中文, 雙語), the person's kind marked:
// the best for them first (their commentary, then a MAX channel without ads).
export const audioName = b => (b.audio ? AUDIO_NAMES[b.audio]?.[ctx.locale === 'en' ? 'en' : 'zh'] || '' : '');
const audioTag = b => (b.audio ? el('span', { class: `au-tag${hasAudio(b, ctx.state?.prefs?.audio || 'en') ? ' mine' : ''}`, text: audioName(b) }) : null);
export function tvLine(e) {
  if (e.status?.void) return null;
  const name = b => b.short[ctx.locale === 'en' ? 'en' : 'zh'];
  // Over: still its ELTA label while it can be watched again (its channel's
  // 回看 for 48 hours, then its video once found).
  if (e.status?.state === 'post') {
    const r = replayHint(e);
    if (!r) return null;
    const again = el('span', { class: 'tv-again', text: r.apple ? (ctx.locale === 'en' ? 'Apple TV · replay' : 'Apple TV・重播') : ctx.locale === 'en' ? (r.replay ? ' · replay' : 'ELTA · replay') : r.replay ? '・回看' : '愛爾達・重播' });
    if (r.video) return el('small', { class: 'tv-line' }, [again]);
    const ch = r.channels.slice(0, 2).map(b => el('span', { class: 'tv-ch', text: name(b) }));
    // A channel's 回看 / replay reads as part of that channel, not a chip of its own.
    if (r.replay && ch.length) ch.at(-1).append(again);
    return el('small', { class: 'tv-line' }, r.replay && ch.length ? ch : [...ch, again]);
  }
  const list = channelsOf(e);
  if (!list.length) return null;
  const parts = list.slice(0, 2).map(b => el('span', { class: 'tv-ch' }, [document.createTextNode(name(b)), audioTag(b)]));
  return el('small', { class: 'tv-line' }, [...parts, list.length > 2 ? el('span', { class: 'tv-ch', text: `+${list.length - 2}` }) : null]);
}
// A race weekend's session as a badge (排位賽, 衝刺賽, 正賽…), coloured by kind, so the row says it at a glance.
export function sessionTag(e) {
  if (!e?.sessionKey) return null;
  const n = SESSION_NAMES[e.sessionKey];
  const kind = { Race: 'race', Qual: 'qual', SR: 'sprint', SS: 'sq', SQ: 'sq' }[e.sessionKey] || 'other';
  return el('span', { class: `sess-tag ${kind}` }, [document.createTextNode(n ? n[ctx.locale === 'en' ? 'en' : 'zh'] : e.session || '')]);
}

// ---- Sheets and sections ----------------------------------------------------------------

export function sheet(title, { accent, league } = {}) {
  // The kit's sheet (a game's, a team's, a player's: large from the start, as iOS's, not rising to a spinner's and jumping up later).
  const body = el('div', { class: 'sheet-body' });
  const head = league ? (() => { const f = document.createDocumentFragment(); f.append(leagueMark(league), el('span', { text: title })); return f; })() : title;
  const s = kitUI.sheet({ title: head, body: [body], cls: `fx-sheet${league ? ' q-full' : ''}`, detent: league ? 'large' : '', label: title, closeLabel: ctx.t('close') });
  if (league) s.head?.querySelector('h2')?.classList.add('sheet-lg');
  if (accent) s.el.style.setProperty('--q-accent', accent);
  return { dialog: s.el, body, close: s.close };
}
// A choice of a few (four at most): the kit's segmented control, its thumb
// sliding to the pick; of more, the kit's chips in a row that scrolls (as
// iOS keeps a segmented control to a handful).
// (`seg`: one row of equal parts whatever the count, up to the kit's seven: a team's five tabs.)
export function segmented(options, current, onPick, cls = '', { seg = false } = {}) {
  const few = options.length <= 4 || (seg && options.length <= 7);
  return el(
    'div',
    { class: `${few ? 'q-seg' : 'q-chips'} ${cls === 'scroll' ? '' : cls}`.trim(), role: 'group' },
    options.map(([key, label]) => el('button', { type: 'button', ...(few ? {} : { class: 'q-chip' }), 'aria-pressed': String(key === current), text: label, onclick: () => onPick(key) }))
  );
}
export function section(title, content, { sub = '', action = null, cls = '' } = {}) {
  // The kit's head (its h2 and chevron more).
  const head = kitUI.sectionHead(title);
  if (action) head.append(action);
  return el('section', { class: `q-section ${cls}` }, [head, sub ? el('p', { class: 'section-sub', text: sub }) : null, content]);
}
export const moreButton = (label, onclick) => el('button', { class: 'section-more', type: 'button', text: label, onclick });
