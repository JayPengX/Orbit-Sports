// 首頁 on an iPad on its side (Jay 2026-11-06, "kind of ugly ain't it?"):
// the sections were dealt into three columns by height, each a different
// length with holes under them, and a quiet day's two sections sat in two of
// three columns with a third of the screen empty. On q-w3 首頁 is a board now
// (ui.js homeBoard, styles.css .home-board): the day in a main column, my
// leagues and teams in a side column, the lead pieces paired. Checked in a
// real page (Chromium) where one is here; the phone keeps cols.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const ui = readFileSync(new URL('../public/ui.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
let chromium = null;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {}

const fnSrc = (() => {
  const a = ui.indexOf('export function homeBoard(');
  const b = ui.indexOf('// Like cards of a list', a);
  return ui.slice(a, b).replaceAll('export ', '');
})();
const boardCss = (() => {
  const a = css.indexOf('/* A rail of cards in a column');
  const b = css.indexOf('/* A list of games as tiles side by side');
  return css.slice(a, b);
})();

test('首頁 is the board only on q-w3; narrower screens keep cols (the phone untouched)', () => {
  assert.match(app, /\(screenFit\(\)\.w3 \? homeLayout : cols\)\(\[/);
  assert.match(app, /if \(state\.home\.drawnOnce\) renderHome\(\);/, 'drawn again when the screen crosses q-w3');
  assert.ok(fnSrc.includes('settleBoard') && boardCss.includes('.home-board.wide'));
});

test('a rail is measured as the grid it becomes in a column (no column dealt short)', () => {
  assert.match(css, /:root\.q-wide :is\(\.col, \.q-flow-col, \.q-flow-measure, \.hb-main, \.hb-low\) \.q-rail \{/);
});

const layout = async (page, { width, lead, low = [], side }) =>
  page.evaluate(
    ({ fnSrc, width, lead, low, side }) => {
      const el = (tag, o = {}, kids = []) => {
        const n = document.createElement(tag);
        if (o.class) n.className = o.class;
        n.append(...kids.filter(Boolean));
        return n;
      };
      const { homeBoard, settleBoard } = new Function('el', `${fnSrc}; return { homeBoard, settleBoard };`)(el);
      // A section: its title, then a card (h: the card's height); a lead game: a card alone.
      const sec = h => {
        const n = el('section', { class: 'q-section' }, [el('div', { class: 'q-section-head' }), el('div', { class: 'q-card' })]);
        n.firstChild.style.height = '40px';
        n.lastChild.style.minHeight = `${h}px`;
        return n;
      };
      const heroCard = h => {
        const n = el('div', { class: 'q-hero-card' });
        n.style.minHeight = `${h}px`;
        return n;
      };
      const rail = n => {
        const s = sec(0);
        s.lastChild.replaceWith(el('div', { class: 'q-rail' }, Array.from({ length: n }, () => el('div', { class: 'q-card' }))));
        [...s.lastChild.children].forEach(c => (c.style.height = '200px'));
        return s;
      };
      const l = lead.map((h, i) => (i === 0 ? heroCard(h) : sec(h)));
      const w = low.map(rail);
      const s = side.map(sec);
      const wrap = document.getElementById('wrap');
      wrap.style.width = `${width}px`;
      const board = homeBoard(l, s, new Set(l), w);
      wrap.replaceChildren(board);
      settleBoard(board);
      const rect = n => n.getBoundingClientRect();
      const b = rect(board);
      const cardOf = n => (n.classList.contains('q-hero-card') ? n : n.lastChild);
      return {
        board: b.width,
        wide: board.classList.contains('wide'),
        dropped: s.slice(1).some(n => n.parentElement.classList.contains('hb-low')),
        tracks: [...l, ...s.slice(0, 1)].map(n => ({ left: Math.round(rect(n).left - b.left), width: Math.round(rect(n).width) })),
        cards: [...l, ...s.slice(0, 1)].map(n => ({ top: Math.round(rect(cardOf(n)).top - b.top), bottom: Math.round(rect(cardOf(n)).bottom - b.top) })),
        low: w.flatMap(x => [...x.querySelector('.q-rail').children].map(c => ({ left: Math.round(rect(c).left - b.left), width: Math.round(rect(c).width) })))
      };
    },
    { fnSrc, width, lead, low, side }
  );

test('the board: three even tracks, every edge lined up, a pair as tall as each other', { skip: !chromium && 'no browser here' }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await page.setContent(`<style>.q-rail{display:grid}${boardCss}</style><div id="wrap"></div>`);
    await page.evaluate(() => document.documentElement.classList.add('q-wide'));
    // Jay's iPad (11/7): 下一場 beside 我的比賽, 我的聯賽 to the side, 更多賽事's two cards under.
    const busy = await layout(page, { width: 1040, lead: [380, 430], low: [2], side: [320] });
    const [a, b, c] = busy.tracks;
    assert.ok(Math.abs(a.width - b.width) <= 1 && Math.abs(b.width - c.width) <= 1, `even tracks ${JSON.stringify(busy.tracks)}`);
    assert.ok(Math.abs(b.left - (a.left + a.width) - (c.left - (b.left + b.width))) <= 1, 'one gap');
    assert.equal(busy.cards[0].top, busy.cards[1].top, 'the lead game level with 我的比賽’s card, not its title');
    assert.equal(busy.cards[1].top, busy.cards[2].top, 'and with 我的聯賽’s');
    assert.equal(busy.cards[0].bottom, busy.cards[1].bottom, 'a pair as tall as each other');
    // 更多賽事's cards on the same tracks as the cards above.
    for (const [i, x] of busy.low.entries()) {
      assert.ok(Math.abs(x.left - busy.tracks[i].left) <= 1 && Math.abs(x.width - busy.tracks[i].width) <= 1, `更多賽事 card ${i} on track ${i}`);
    }
    // 我的聯賽 short: 更多賽事 runs across all three, under it too.
    assert.ok(busy.wide, 'across all three when the side is short');
    // A long side (my leagues and my teams) beside one lead game: my teams goes under it, not a screen of nothing.
    const long = await layout(page, { width: 1040, lead: [400], side: [500, 400] });
    assert.ok(long.dropped, '我的球隊 under the lead game');
    // A quiet day (one game, my leagues): the game two tracks wide, my leagues the third.
    const quiet = await layout(page, { width: 1040, lead: [380], side: [320] });
    assert.ok(Math.abs(quiet.tracks[0].width - (2 * quiet.tracks[1].width + 20)) <= 2, 'the lone game two tracks wide');
  } finally {
    await browser.close();
  }
});
