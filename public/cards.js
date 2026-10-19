// The tabs' own pieces, drawn with the kit's classes (quadra.css "Premium
// layer": .q-page-head, .q-hero-card, .q-tag, .q-rail): the page head, the
// hero game, a finished game's score card, a sport's tile. Markup only: what
// a game is (onAir, sessionStatus, picks, standings) is decided elsewhere.
import * as kitUI from '#kit/ui.mjs';
import { el, ctx, sidesOf, logo, personPic, statusText, timeText, seriesText, scoreText, raceFlag, sessionTag, watchLink, leagueMark, winners, tvLine } from './ui.js';
import { channelsOf, watchOf } from './lib/tv.mjs';
import { leagueName, leagueLogo } from './lib/leagues.mjs';
import { knownHighlights } from './lib/highlights.mjs';
import { stageTag } from './lib/stage.mjs';

// An icon from the kit (empty on a phone still running an old kit).
export const icon = name => kitUI.icons?.[name] || '';
const en = () => ctx.locale === 'en';

// The page's head: a title, an action at the right.
export function pageHead(title, action = null) {
  return el('header', { class: 'q-page-head sp-head' }, [el('div', { class: 'sp-head-text' }, [kitUI.navTitle?.(title) ?? el('h1', { text: title })]), action]);
}
// A head's action: a tinted capsule with its glyph (管理, 追蹤).
export const headAction = (label, glyph, onclick, on = false) =>
  el('button', { class: `head-act q-press${on ? ' on' : ''}`, type: 'button', 'aria-pressed': String(on), onclick }, [el('span', { class: 'head-act-ico', 'aria-hidden': 'true', html: icon(glyph) }), el('span', { text: label })]);

// A sport's colour: tiles and the hero's ground.
export const SPORT_COLOR = { soccer: '#16a34a', baseball: '#dc2626', basketball: '#ea580c', football: '#7c3aed', hockey: '#0891b2', racing: '#4f46e5' };

// A game's TV channels as tags on the hero (the first two).
function channelTags(e, n = 2) {
  if (!e || e.status?.void || e.status?.state === 'post') return [];
  return channelsOf(e)
    .slice(0, n)
    .map(b => el('span', { class: 'q-tag on-hero', text: b.short?.[en() ? 'en' : 'zh'] || b.zh || '' }));
}

const sidePic = side => (side?.athlete ? personPic(side, side.league, 'hc-pic round') : logo(side?.logo, side?.name, 'hc-pic', { onWhite: true }));

// The hero: the one game to watch. A live game's scores carry the kit's live
// attribute so they tick as every row's do.
export function heroGame(e, { eyebrow = '', picked = false, mine = false, onOpen } = {}) {
  const live = e.status?.state === 'in';
  const post = e.status?.state === 'post';
  const card = el('div', { class: `q-hero-card q-press hero-game${live ? ' is-live' : ''}`, role: 'button', tabindex: '0', onclick: () => onOpen(e) });
  card.addEventListener('keydown', ev => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), onOpen(e)));
  const status = live || post || e.status?.void ? statusText(e) : timeText(e);
  card.append(
    el('div', { class: 'hc-top' }, [
      el('span', { class: 'q-hc-eyebrow' }, [live ? el('i', { class: 'hc-dot', 'aria-hidden': 'true' }) : el('span', { class: 'hc-ico', html: icon(post ? 'check' : 'clock') }), el('span', { text: eyebrow || (live ? (en() ? 'Live now' : '正在進行') : post ? (en() ? 'Final' : '已結束') : en() ? 'Up next' : '下一場') })]),
      el('span', { class: 'hc-status num', text: status })
    ])
  );
  if (e.kind === 'match') {
    const w = winners(e);
    for (const side of sidesOf(e))
      card.append(
        el('div', { class: `hc-side${(side === e.home ? w.home : w.away) ? ' win' : ''}` }, [
          el('span', { class: 'hc-logo' }, [sidePic({ ...side, league: e.league })]),
          el('strong', { class: 'hc-name', text: side.short || side.name }),
          live || post ? el('b', { class: 'hc-score num', 'data-q-live': live ? `sc:${e.league}:${e.id}:${side.id}` : null, text: scoreText(side.score) }) : null
        ])
      );
    const line = seriesText(e);
    if (line) card.append(el('p', { class: 'q-hc-sub', text: line }));
  } else {
    card.append(el('div', { class: 'hc-event' }, [raceFlag(e, 'big'), el('strong', { class: 'q-hc-title', text: e.sessionKey || !e.session ? e.name : `${e.name} · ${e.session}` }), sessionTag(e)]));
    if (e.venue) card.append(el('p', { class: 'q-hc-sub', text: e.venue }));
  }
  const stage = e.kind === 'match' ? stageTag(e, ctx.locale) : '';
  const tags = [
    el('span', { class: 'q-tag on-hero', text: stage || leagueName(e.league, ctx.locale).replace(/\s.*$/, '') }),
    mine ? el('span', { class: 'q-tag on-hero strong', text: en() ? 'Following' : '追蹤中' }) : picked ? el('span', { class: 'q-tag on-hero strong', text: en() ? '★ Pick' : '★ 推薦' }) : null,
    ...channelTags(e)
  ];
  card.append(el('div', { class: 'hc-tags' }, tags));
  // 觀看 while it's on (or within half an hour of its start), straight into ELTA.tv's or Apple TV's app.
  const b = !e.status?.void && (live || (e.status?.state === 'pre' && Date.parse(e.start) - Date.now() < 30 * 60_000)) ? watchOf(e) : null;
  if (b)
    card.append(
      el('div', { class: 'q-hc-row' }, [
        watchLink(b, { class: 'q-hc-btn', onclick: ev => ev.stopPropagation(), 'aria-label': `${en() ? 'Watch on' : '觀看'} ${b[en() ? 'en' : 'zh']}` }, [el('span', { class: 'hc-play', 'aria-hidden': 'true', html: icon('play') }), el('span', { text: en() ? 'Watch' : '觀看' }), el('small', { text: b.short?.[en() ? 'en' : 'zh'] || '' })])
      ])
    );
  return card;
}

// A finished game as a small card for a rail: the league, both sides with
// their scores (the winner's strong), where it can be watched again.
export function scoreCard(e, onOpen) {
  const w = e.kind === 'match' ? winners(e) : null;
  const side = (s, win) => el('span', { class: `sc-side${win ? ' win' : ''}` }, [s.athlete ? personPic(s, e.league, 'sm round') : logo(s.logo, s.name, 'sm'), el('span', { class: 'sc-name', text: s.short || s.name }), el('b', { class: 'num', text: e.status.void || e.status.state === 'pre' ? '' : scoreText(s.score) })]);
  const champ = e.kind !== 'match' ? (e.sessionKey ? e.sessions?.find(x => x.abbr === e.sessionKey) : e.sessions?.at(-1))?.field?.[0] : null;
  return el('button', { class: 'score-card q-press', type: 'button', disabled: e.status?.void ? true : null, onclick: () => onOpen(e) }, [
    el('span', { class: 'sc-top' }, [leagueMark(e.league, 'lg-mark xs'), el('span', { text: leagueName(e.league, ctx.locale).replace(/\s.*$/, '') }), el('small', { text: statusText(e) }), e.status?.state === 'post' && knownHighlights(e) ? el('i', { class: 'sc-play', 'aria-hidden': 'true', html: icon('play') }) : null]),
    ...(e.kind === 'match'
      ? sidesOf(e).map(s => side(s, s === e.home ? w.home : w.away))
      : [el('span', { class: 'sc-event' }, [raceFlag(e), el('strong', { text: e.name })]), champ ? el('span', { class: 'sc-champ' }, [personPic(champ, e.league, 'sm round'), el('span', { text: champ.short || champ.name })]) : sessionTag(e)]),
    tvLine(e)
  ]);
}

// First run: a sport as a colour tile, its leagues' marks inside, + or its
// place in the order once tapped.
export function sportTile({ key, name, marks, order, onclick }) {
  const b = el('button', { class: `sport-card q-press${order ? ' on' : ''}`, type: 'button', 'aria-pressed': String(Boolean(order)), onclick }, [el('span', { class: 'sc-marks' }, marks), el('strong', { class: 'sc-label', text: name }), el('b', { class: 'sc-badge num', text: order ? String(order) : '+' })]);
  b.style.setProperty('--t', SPORT_COLOR[key] || 'var(--q-accent)');
  return b;
}

// 聯賽: a followed league as the kit's tile for a rail; a tap opens it in 賽事.
export function leagueTile(key, onOpen) {
  const name = leagueName(key, ctx.locale).replace(/\s.*$/, '');
  return kitUI.leagueTile?.({ logo: leagueLogo(key), name, onOpen: () => onOpen(key) }) ?? el('button', { class: 'q-press', type: 'button', text: name, onclick: () => onOpen(key) });
}
