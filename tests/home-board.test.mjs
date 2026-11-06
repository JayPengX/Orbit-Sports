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
  const b = ui.indexOf('\n}\n', a);
  return ui.slice(a, b + 2).replace('export ', '');
})();
const boardCss = (() => {
  const a = css.indexOf('.home-board {');
  const b = css.indexOf('/* A list of games as tiles side by side');
  return css.slice(a, b);
})();

test('首頁 is the board only on q-w3; narrower screens keep cols (the phone untouched)', () => {
  assert.match(app, /\(screenFit\(\)\.w3 \? homeLayout : cols\)\(\[/);
  assert.match(app, /if \(state\.home\.drawnOnce\) renderHome\(\);/, 'drawn again when the screen crosses q-w3');
  assert.ok(fnSrc.length > 100 && boardCss.includes('@container hb'));
});

test('a rail is measured as the grid it becomes in a column (no column dealt short)', () => {
  assert.match(css, /:root\.q-wide :is\(\.col, \.q-flow-col, \.q-flow-measure, \.hb-main\) \.q-rail \{/);
});

const layout = async (page, { width, lead, rest = [], side }) =>
  page.evaluate(
    ({ fnSrc, width, lead, rest, side }) => {
      const el = (tag, o = {}, kids = []) => {
        const n = document.createElement(tag);
        if (o.class) n.className = o.class;
        n.append(...kids.filter(Boolean));
        return n;
      };
      const homeBoard = new Function('el', `${fnSrc}; return homeBoard;`)(el);
      const box = h => {
        const n = document.createElement('section');
        n.className = 'q-section';
        n.style.height = `${h}px`;
        n.style.marginTop = '24px';
        return n;
      };
      const l = lead.map(box);
      const r = rest.map(box);
      const s = side.map(box);
      const wrap = document.getElementById('wrap');
      wrap.style.width = `${width}px`;
      wrap.replaceChildren(homeBoard([...l, ...r], s, new Set(l)));
      const rect = n => n.getBoundingClientRect();
      const b = rect(wrap.firstChild);
      const main = wrap.querySelector('.hb-main');
      const aside = wrap.querySelector('.hb-side');
      return {
        board: b.width,
        main: main && rect(main).width,
        side: aside && rect(aside).width,
        sideTop: aside && rect(aside.firstChild).top - b.top,
        lead: l.map(n => ({ left: rect(n).left - b.left, top: rect(n).top - b.top, width: rect(n).width })),
        rest: r.map(n => ({ left: rect(n).left - b.left, width: rect(n).width }))
      };
    },
    { fnSrc, width, lead, rest, side }
  );

test('the board fills the width on a busy day and a quiet one', { skip: !chromium && 'no browser here' }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await page.setContent(`<style>${boardCss}</style><div id="wrap"></div>`);
    // An iPad on its side: the page about 1040 wide.
    const busy = await layout(page, { width: 1040, lead: [270, 300], rest: [500], side: [360, 300] });
    assert.ok(Math.abs(busy.main + 24 + busy.side - busy.board) < 1, 'main and side fill the board');
    assert.ok(busy.side >= 300 && busy.side <= 380);
    assert.equal(busy.lead[0].top, busy.lead[1].top, 'the lead game and 我的比賽 side by side, tops level');
    assert.ok(busy.lead[1].left > busy.lead[0].left + busy.lead[0].width, 'side by side');
    assert.equal(busy.lead[0].top, busy.sideTop, 'the side column starts level with the main');
    assert.ok(Math.abs(busy.rest[0].width - busy.main) < 1, '更多賽事 the main column wide');
    // Jay's quiet day: the live game and 我的聯賽, nothing else.
    const quiet = await layout(page, { width: 1040, lead: [270], side: [360] });
    assert.ok(Math.abs(quiet.lead[0].width - quiet.main) < 1, 'a lone lead game the main column wide');
    assert.ok(quiet.lead[0].width + quiet.side > 0.9 * quiet.board, 'never a third of the screen empty');
    // Three lead pieces: two paired, the third the column's width.
    const three = await layout(page, { width: 1040, lead: [270, 200, 300], side: [360] });
    assert.equal(three.lead[0].top, three.lead[1].top);
    assert.ok(Math.abs(three.lead[2].width - three.main) < 1);
    // A board too narrow for two cards of a phone's width in the main: one column.
    const narrow = await layout(page, { width: 900, lead: [270, 300], side: [360] });
    assert.ok(narrow.lead[1].top > narrow.lead[0].top, 'stacked when the main has no room for two');
  } finally {
    await browser.close();
  }
});
