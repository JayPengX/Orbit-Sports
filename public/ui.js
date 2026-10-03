// Quadra Fixtures' shared pieces: small DOM helpers, days and times, event
// rows, sheets. `ctx` is filled by app.js (the text, the state and the
// actions rows and sheets call).
import { LEAGUES, SPORTS, leagueName, leagueLogo } from './lib/leagues.mjs';
import { logoPicture, countryFlag, flagUrl, flagEmoji, f1Driver } from './lib/logos.mjs';
import { espnHeadshot, smallPhoto, isFlag, personPhoto } from './lib/photos.mjs';
import { liveLabel, liveNote } from './lib/live.mjs';
import { stageTag } from './lib/stage.mjs';
import { broadcastsOf, AUDIO_NAMES, hasAudio } from './lib/broadcast.mjs';
import { freshHeadshot, SESSION_NAMES } from './lib/espn.mjs';
import { tvOf, channelsOf, watchOf } from './lib/tv.mjs';
import { seriesLineZh } from './lib/statnames.mjs';

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
// A row with its watch button beside it (a live game's), or the row alone.
export const withWatch = (row, e) => {
  const watch = watchButton(e);
  return watch ? el('div', { class: 'watch-row' }, [row, watch]) : row;
};

// ---- Logos, leagues ----------------------------------------------------------------

// A team's (or a player's) picture: the logo (tried twice), else a
// national side's flag, else the name's first letter.
export function logo(url, name, cls = '') {
  const fallback = () => {
    const flag = countryFlag(name);
    return flag ? el('span', { class: `logo logo-flag ${cls}`, 'aria-hidden': 'true', text: flag }) : el('span', { class: `logo logo-fallback ${cls}`, 'aria-hidden': 'true', text: (name || '?').trim().slice(0, 1) });
  };
  return logoPicture(smallPhoto(freshHeadshot(url)), null, `logo ${cls}`, fallback);
}
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
  return personPhoto(name, league, { urls: [p?.headshot, isFlag(p?.logo) ? null : p?.logo].map(freshHeadshot), guess: freshHeadshot(espnHeadshot(league, p?.id)), cls: `logo ${cls}`, fallback: stand });
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
export const leagueChip = key => el('span', { class: 'league-tag' }, [leagueMark(key), el('span', { text: leagueName(key, ctx.locale) })]);
// An event's competition: its league, or (a friendly, a cup Fixtures doesn't have) its own name.
const compChip = e => (e.other ? el('span', { class: 'league-tag other' }, [el('span', { text: e.other })]) : leagueChip(e.league));

// ---- Events --------------------------------------------------------------------------

export function statusText(e) {
  const { t } = ctx;
  const s = e.status;
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
  return whenText(e.start);
}
// A finished game's ESPN status in Chinese: "Final/OT" 終場（延長）, "Final/10"
// 終場（10 局）, "FT", "AET", "FT-Pens"…; anything else as ESPN wrote it.
function finalText(text) {
  if (ctx.locale === 'en') return text;
  const t = String(text).trim();
  const f = /^F(?:inal)?\/(.+)$/i.exec(t);
  if (f) {
    const x = f[1];
    if (/^OT$/i.test(x)) return '終場（延長）';
    const ot = /^(\d)OT$/i.exec(x);
    if (ot) return `終場（${ot[1]} 度延長）`;
    if (/^SO$/i.test(x)) return '終場（射門大賽）';
    if (/^\d+$/.test(x)) return `終場（${x} 局）`;
    return `終場（${x}）`;
  }
  if (/^(FT|Full Time)$/i.test(t)) return ctx.t('final');
  if (/^AET$/i.test(t)) return '終場（延長賽）';
  if (/pens|penalties/i.test(t)) return '終場（PK 大戰）';
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
// A row's status: a game on another day shows its day above its time.
function statusEl(e, day = true) {
  if (e.status.state === 'pre' && !e.status.void && localDate(Date.parse(e.start)) !== today())
    return day ? el('span', { class: 'event-status pre two' }, [el('span', { text: dayLabel(localDate(Date.parse(e.start))) }), el('b', { text: clock(e.start) })]) : el('span', { class: 'event-status pre', text: clock(e.start) });
  return el('span', { class: `event-status ${e.status.state}`, text: statusText(e) });
}
// A side's picture: a person's photo (a driver), a team's badge.
export const sideLogo = (side, league, cls = '') => (side && side.athlete ? personPic(side, league, `${cls} round`) : logo(side?.logo, side?.name, cls));
export function sideLine(side, e, win) {
  return el('div', { class: `side${win ? ' win' : ''}` }, [
    sideLogo(side, e.league, 'sm'),
    el('span', { class: 'side-name', text: side.short || side.name }),
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
// In Chinese: "洋基 系列賽 2-1 領先" (the sides by their names).
export const seriesText = e => {
  const s = e.series?.summary;
  if (!s || /^series starts/i.test(s)) return '';
  if (ctx.locale === 'en') return s;
  const name = abbr => [e.home, e.away].find(x => x?.abbr && x.abbr.toUpperCase() === String(abbr).toUpperCase())?.short || abbr;
  return seriesLineZh(s, name) || s;
};
export function eventRow(e, { league = true, day = true } = {}) {
  const { t } = ctx;
  const mine = ctx.isFollowedEvent?.(e);
  const tag = stageTag(e, ctx.locale);
  if (e.kind === 'match') {
    const w = winners(e);
    const series = seriesText(e);
    return el('button', { class: `event-row${e.status.state === 'in' ? ' live' : ''}${mine ? ' mine' : ''}`, type: 'button', onclick: () => ctx.openEvent(e) }, [
      el('div', { class: 'event-meta' }, [statusEl(e, day), league ? compChip(e) : null]),
      el('div', { class: 'event-sides' }, [
        tag ? el('span', { class: 'stage-tag', text: tag }) : null,
        sideLine(e.away, e, w.away),
        sideLine(e.home, e, w.home),
        series ? el('small', { class: 'series-line', text: series }) : null,
        liveLine(e),
        tvLine(e)
      ])
    ]);
  }
  // A race weekend (or one of its sessions): one row.
  const ended = e.sessionKey ? e.sessions?.find(x => x.abbr === e.sessionKey) : e.sessions?.at(-1);
  // A race weekend's session: its badge says which, so the line under it doesn't repeat it.
  const sess = sessionTag(e);
  const said = sess ? '' : e.session;
  const sub = e.status.state === 'in' && fieldNow(e) ? fieldNow(e).replace(sess && e.session ? `${e.session} · ` : '', '') : e.kind === 'field' ? (e.status.state === 'post' && ended?.field?.[0]?.name ? [said, (ctx.locale === 'en' ? `Won by ${ended.field[0].name}` : `冠軍 ${ended.field[0].name}`)].filter(Boolean).join(' · ') : [said, e.venue].filter(Boolean).join(' · ')) : e.venue;
  return el('button', { class: `event-row wide${e.status.state === 'in' ? ' live' : ''}${sess ? ` sess-${e.sessionKey === 'Race' ? 'race' : 'other'}` : ''}`, type: 'button', onclick: () => ctx.openEvent(e) }, [
    el('div', { class: 'event-meta' }, [statusEl(e, day), league ? compChip(e) : null]),
    el('div', { class: 'event-title' }, [el('div', { class: 'sess-head' }, [raceFlag(e), sess, el('strong', { text: e.name })]), e.league === 'f1' && e.status.state === 'in' ? f1Brief(e) : sub ? el('small', { text: sub }) : null, tvLine(e)])
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
        el('span', { class: 'live-count num', text: en ? `${lv.balls ?? 0}-${lv.strikes ?? 0} · ${lv.outs ?? 0} out` : `${lv.balls ?? 0}壞${lv.strikes ?? 0}好 · ${lv.outs ?? 0}出局` }),
        who ? el('span', { class: 'live-who' }, [faces.length ? el('span', { class: 'live-faces', 'aria-hidden': 'true' }, faces.map(p => personPic({ ...p, en: p.name }, e.league, 'xs round'))) : null, el('span', { class: 'live-names', text: who })]) : null
      ])
    ]);
  }
  // Soccer: the latest goal, as two lines like baseball's (the minute, then who).
  const goal = sport === 'soccer' ? (e.live.events || []).filter(x => x.kind !== 'red').at(-1) : null;
  if (goal) {
    const en = ctx.locale === 'en';
    const side = [e.home, e.away].find(s => String(s?.id) === goal.team);
    return el('div', { class: 'live-line base goal' }, [
      el('span', { class: 'live-ball', 'aria-hidden': 'true', text: '⚽' }),
      el('span', { class: 'live-text' }, [
        el('span', { class: 'live-count num', text: `${en ? 'Goal' : '最新進球'} ${goal.minute}` }),
        el('span', { class: 'live-who' }, [el('span', { class: 'live-names', text: `${goal.who}${goal.kind === 'pen' ? (en ? ' (pen)' : '（PK）') : goal.kind === 'own' ? (en ? ' (OG)' : '（烏龍）') : ''}${side ? ` · ${side.short || side.name}` : ''}` })])
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
        el('span', { class: 'live-count', text: en ? 'Top scorers' : '得分王' }),
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
export const f1Live = { feed: null, key: '' };
const mmss = n => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
// A card's brief of an F1 session on now, as baseball's shows the count:
// the part (or lap) and the time left, then the top three with their
// pictures and best lap (qualifying, practice) or gap (a race). A slot
// (`data-f1-brief`) app.js fills again as the feed moves; until the feed is
// in, the leader as ESPN has it.
export function f1Brief(e) {
  if (e?.league !== 'f1' || e.status?.state !== 'in') return null;
  const box = el('div', { class: 'f1-brief', 'data-f1-brief': e.id });
  fillF1Brief(box, e);
  return box;
}
export function fillF1Brief(box, e) {
  const en = ctx.locale === 'en';
  const f = f1Live.key === e.id ? f1Live.feed : null;
  if (!f) {
    const lead = fieldNow(e);
    return put(box, lead ? el('small', { class: 'live-line', text: lead }) : null);
  }
  const race = e.sessionKey === 'Race' || e.sessionKey === 'SR';
  const quali = /^(Qual|SS|SQ)$/.test(e.sessionKey || '');
  const left = Math.max(0, f.clock.left - (f.clock.running ? (Date.now() - f.at) / 1000 : 0));
  const head = race && f.lap?.now ? (en ? `Lap ${f.lap.now}/${f.lap.of}` : `第 ${f.lap.now}/${f.lap.of} 圈`) : [quali && f.part ? `${e.sessionKey === 'Qual' ? 'Q' : 'SQ'}${f.part}` : '', `${en ? '' : '剩 '}${mmss(left)}${en ? ' left' : ''}`].filter(Boolean).join(' · ');
  const field = (e.sessions || []).find(x => x.abbr === e.sessionKey)?.field || [];
  const plain = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  put(
    box,
    el('small', { class: 'f1-brief-head num', text: head }),
    el(
      'ol',
      { class: 'f1-brief-top' },
      f.cars.slice(0, 3).map((c, i) => {
        const espn = field.find(x => plain(x.name) === plain(c.name)) || { name: c.name };
        const zh = f1Driver(c.name).zh;
        const last = String(en || !zh || zh === c.name ? c.name : zh).split(/[.\s]/).at(-1);
        return el('li', {}, [
          el('span', { class: 'pos num', text: String(c.pos) }),
          personPic({ ...espn, en: c.name }, 'f1', 'xs round'),
          el('span', { class: 'f1-brief-name', text: last }),
          el('span', { class: 'num f1-brief-v', text: race ? (i === 0 ? '' : c.gap) : c.best || (i === 0 ? '' : c.gap) || '' })
        ]);
      })
    )
  );
}
export function fieldNow(e) {
  const en = ctx.locale === 'en';
  const ss = e.sessionKey ? e.sessions?.find(x => x.abbr === e.sessionKey) : e.sessions?.find(x => x.status.state === 'in');
  const lead = ss?.field?.[0];
  return lead ? `${e.session ? `${e.session} · ` : ''}${en ? 'Leader' : '領先'} ${lead.short || lead.name}` : '';
}

// Where to watch it in Taiwan: small chips (the first few). A league's list,
// or a game's own (`e`: the exact ELTA channel when a schedule has it, and no
// ELTA when ELTA doesn't carry that game).
export const tvName = b => `${ctx.locale === 'en' ? b.en : b.zh}${b.note ? `（${ctx.locale === 'en' ? b.note.en : b.note.zh}）` : ''}`;
export function twChips(league, n = 3, e = null) {
  const list = e ? tvOf(e) : broadcastsOf(league);
  if (!list.length) return null;
  return el('div', { class: 'tw-chips' }, list.slice(0, n).map(b => el('span', { class: `tw-chip${b.exact ? ' exact' : ''}`, text: tvName(b) })));
}
// A row's 📺 line: the channels a game is on, when a schedule says (not a guess from the league).
// Each with its commentary (英文原音, 中文, 雙語), the person's kind marked:
// the best for them first (their commentary, then a MAX channel without ads).
export const audioName = b => (b.audio ? AUDIO_NAMES[b.audio]?.[ctx.locale === 'en' ? 'en' : 'zh'] || '' : '');
const audioTag = b => (b.audio ? el('span', { class: `au-tag${hasAudio(b, ctx.state?.prefs?.audio || 'en') ? ' mine' : ''}`, text: audioName(b) }) : null);
export function tvLine(e) {
  if (e.status?.state === 'post' || e.status?.void) return null;
  const list = channelsOf(e);
  if (!list.length) return null;
  const name = b => b.short[ctx.locale === 'en' ? 'en' : 'zh'];
  const parts = list.slice(0, 2).flatMap((b, i) => [i ? document.createTextNode('、') : null, el('span', { class: 'tv-ch' }, [document.createTextNode(name(b)), audioTag(b)])]);
  return el('small', { class: 'tv-line' }, [...parts, list.length > 2 ? document.createTextNode(` +${list.length - 2}`) : null]);
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
