// Orbit's own look for Sports' 首頁 (RULEBOOK §3, Jay 2026-11-03: the first
// Native sample's cards, never two clubs' colours blended into one surface,
// nothing drawn after another app). The lead game: graphite, each club's row on its own
// colour. 我的球隊: each team's place in its table and its next game.
import { el, ctx, sidesOf, logo, timeText, today, localDate, dayLabel } from './ui.js';
import { sideColors } from './lib/wpline.mjs';

const L = o => (ctx.locale === 'en' ? o.en : o.zh);
const dayOf = e => localDate(Date.parse(e.official || e.start));

// The lead game's two rows, each on its own club's colour (dark enough for white over it).
export function paintHero(card, e) {
  if (e.kind !== 'match') return card;
  const c = sideColors(e.home, e.away, '#ffffff');
  const rows = card.querySelectorAll('.hc-side');
  sidesOf(e).forEach((s, i) => rows[i]?.style.setProperty('--tc', s === e.home ? c.home : c.away));
  return card;
}

// ---- 我的球隊: each team's place and its next game --------------------------------------------

// rows: [{ f (the followed team, with logo and shown name), pos, sub, next (its next game) }]
export function teams(rows, onOpen) {
  return el(
    'div',
    { class: 'q-rowcard tm-list' },
    rows.map(({ f, pos, sub, next, side }) => {
      // The team's own colour (never one moved off it to stand apart from the other side's).
      const tc = side?.color ? sideColors(side, null, '#ffffff').home : '';
      const s = next ? sidesOf(next).find(x => String(x.id) === String(f.id)) : null;
      const other = next && s ? sidesOf(next).find(x => x !== s) : null;
      const day = next ? dayOf(next) : '';
      const nextEl = next
        ? el('span', { class: 'tm-next' }, [el('small', { text: L({ zh: '下一場', en: 'Next' }) }), el('b', { class: 'num', text: `${day === today() ? L({ zh: '今天', en: 'Today' }) : dayLabel(day)} ${timeText(next)}` }), other ? el('small', { class: 'q-fit', text: `${L({ zh: '對', en: 'vs' })} ${other.short || other.name}` }) : null])
        : null;
      return el('button', { class: 'q-ritem tm-row', type: 'button', style: tc ? `--tc:${tc}` : null, onclick: () => onOpen(f) }, [
        el('span', { class: 'tm-logo' }, [logo(f.logo, f.name, 'sm')]),
        el('span', { class: 'q-ritem-text' }, [el('span', { class: 'q-ritem-title q-fit', text: f.shown }), el('small', { class: 'q-fit', text: [sub, pos ? L({ zh: `第 ${pos} 名`, en: `#${pos}` }) : ''].filter(Boolean).join(' · ') })]),
        nextEl
      ]);
    })
  );
}
