// Orbit Sports' premium pieces: the page head, the hero card (the best game
// right now) and the sport tiles, drawn with the kit's premium classes
// (.q-page-head, .q-hero-card, .q-tile, .q-tag). Markup only: what a game
// is (onAir, sessionStatus, picks, standings) stays where it was.
import * as kitUI from '#kit/ui.mjs';
import { el, ctx, logo, personPic, statusText, timeText, seriesText, scoreText, raceFlag, sessionTag, watchLink } from './ui.js';
import { channelsOf, watchOf } from './lib/tv.mjs';
import { leagueName } from './lib/leagues.mjs';
import { stageTag } from './lib/stage.mjs';

// An icon from the kit (empty on a phone still running an old kit).
export const icon = name => kitUI.icons?.[name] || '';

// The page's own head: a small grey line over a large title, a button at the right.
export function pageHead(over, title, trailing = null) {
  return el('header', { class: `q-page-head ph${trailing ? ' with-trail' : ''}` }, [el('div', { class: 'ph-text' }, [over ? el('p', { class: 'q-over', text: over }) : null, el('h1', { text: title })]), trailing]);
}
// A round tinted button for a page head (管理, 我的設定).
export const headButton = (label, glyph, onclick) => el('button', { class: 'ph-btn q-press', type: 'button', 'aria-label': label, onclick }, [el('span', { class: 'ph-ico', 'aria-hidden': 'true', html: icon(glyph) }), el('span', { text: label })]);

export const tag = (text, tone = '', extra = '') => el('span', { class: `q-tag ${tone} ${extra}`.trim(), text });

// A sport's colour: tiles and logos' grounds.
export const SPORT_COLOR = { soccer: '#16a34a', baseball: '#dc2626', basketball: '#ea580c', football: '#7c3aed', hockey: '#0891b2', racing: '#4f46e5' };

// A game's TV channels as tags (the first two; the person's commentary marked).
export function channelTags(e, n = 2, onHero = false) {
  if (!e || e.status?.void) return [];
  const list = e.status?.state === 'post' ? [] : channelsOf(e);
  const zh = ctx.locale !== 'en';
  return list.slice(0, n).map(b => el('span', { class: `q-tag ch${onHero ? ' on-hero' : ''}`, text: b.short?.[zh ? 'zh' : 'en'] || b.zh || '' }));
}

const sidePic = side => (side?.athlete ? personPic(side, side.league, 'hc-lg round') : logo(side?.logo, side?.name, 'hc-lg', { onWhite: true }));

// The hero card: the game to watch. `live` events keep their scores in the
// kit's live attribute so they tick like every row's.
export function heroGame(e, { eyebrow = '', picked = false, mine = false, onOpen } = {}) {
  const live = e.status?.state === 'in';
  const post = e.status?.state === 'post';
  const en = ctx.locale === 'en';
  const card = el('div', { class: `q-hero-card q-press hero-game${live ? ' is-live' : ''}`, role: 'button', tabindex: '0', onclick: () => onOpen(e) });
  card.addEventListener('keydown', ev => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), onOpen(e)));
  const status = e.status?.void ? statusText(e) : live ? statusText(e) : post ? statusText(e) : e.timeTbd ? timeText(e) : timeText(e);
  card.append(
    el('div', { class: 'hc-top' }, [
      el('span', { class: `q-hc-eyebrow${live ? ' live' : ''}` }, [live ? el('i', { class: 'hc-dot', 'aria-hidden': 'true' }) : el('span', { class: 'hc-ico', html: icon(post ? 'check' : 'clock') }), el('span', { text: eyebrow || (live ? (en ? 'Live now' : '正在進行') : post ? (en ? 'Final' : '已結束') : en ? 'Up next' : '下一場') })]),
      el('span', { class: `hc-status${live ? ' live' : ''}`, text: status })
    ])
  );
  if (e.kind === 'match') {
    for (const side of [e.away, e.home]) {
      const w = post && e.home.score !== e.away.score && (side.winner || Number(side.score) > Number([e.home, e.away].find(x => x !== side).score));
      card.append(
        el('div', { class: `hc-side${w ? ' win' : ''}` }, [
          el('span', { class: 'hc-logo' }, [sidePic({ ...side, league: e.league })]),
          el('strong', { class: 'hc-name', text: side.short || side.name }),
          !live && !post ? null : el('b', { class: 'hc-score num', 'data-q-live': live ? `sc:${e.league}:${e.id}:${side.id}` : null, text: scoreText(side.score) })
        ])
      );
    }
    const line = seriesText(e);
    if (line) card.append(el('p', { class: 'q-hc-sub', text: line }));
  } else {
    card.append(el('div', { class: 'hc-event' }, [raceFlag(e, 'big'), el('strong', { class: 'q-hc-title', text: e.sessionKey || !e.session ? e.name : `${e.name} · ${e.session}` }), sessionTag(e)]));
    if (e.venue) card.append(el('p', { class: 'q-hc-sub', text: e.venue }));
  }
  const stage = e.kind === 'match' ? stageTag(e, ctx.locale) : '';
  const tags = [el('span', { class: 'q-tag on-hero', text: stage || leagueName(e.league, ctx.locale).replace(/\s.*$/, '') }), mine ? el('span', { class: 'q-tag on-hero strong', text: en ? 'Following' : '追蹤中' }) : picked ? el('span', { class: 'q-tag on-hero strong', text: en ? '★ Pick' : '★ 推薦' }) : null, ...channelTags(e, 2, true)].filter(Boolean);
  card.append(el('div', { class: 'hc-tags' }, tags));
  const actions = el('div', { class: 'q-hc-row' });
  const b = !e.status?.void && (live || (e.status?.state === 'pre' && Date.parse(e.start) - Date.now() < 30 * 60_000)) ? watchOf(e) : null;
  if (b) actions.append(watchLink(b, { class: 'q-hc-btn', onclick: ev => ev.stopPropagation(), 'aria-label': `${en ? 'Watch on' : '觀看'} ${b[en ? 'en' : 'zh']}` }, [el('span', { class: 'hc-play', 'aria-hidden': 'true', html: icon('play') }), el('span', { text: en ? 'Watch' : '觀看' }), el('small', { text: b.short?.[en ? 'en' : 'zh'] || '' })]));
  actions.append(el('button', { class: `q-hc-btn${b ? ' ghost' : ''}`, type: 'button', text: en ? 'Details' : '賽事詳情', onclick: ev => (ev.stopPropagation(), onOpen(e)) }));
  card.append(actions);
  return card;
}

// A colour tile for a sport: the leagues' marks inside, its name, and + or
// its place in the order.
export function sportTile({ key, name, marks, order, onclick }) {
  const b = el('button', { class: `sport-card q-press${order ? ' on' : ''}`, type: 'button', 'aria-pressed': String(Boolean(order)), onclick }, [
    el('span', { class: 'sc-marks' }, marks),
    el('strong', { class: 'sc-name', text: name }),
    el('b', { class: 'sc-badge num', text: order ? String(order) : '+' })
  ]);
  b.style.setProperty('--t', SPORT_COLOR[key] || 'var(--q-accent)');
  return b;
}
