// A game over on 首頁 with who led each side is one card, one game (Jay
// 2026-11-06, iPad: "clicking empty space of that player area will result in
// opening player not the match"). Each player's line was a button as wide as
// the card, so the room beside a name opened the player, and it dimmed alone
// as it was pressed. Now only a face or a name opens the player; any other
// spot on the card opens the game. Checked in a real page (Chromium) where one
// is here, on a phone's card and a wide one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const sheets = readFileSync(new URL('../public/sheets.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
let chromium = null;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {}

const slice = (src, from, to) => {
  const a = src.indexOf(from);
  assert.ok(a >= 0, `${from} is there`);
  return src.slice(a, src.indexOf(to, a + from.length));
};
const recap = slice(sheets, 'export function gameRecap(e, d) {', '\nfunction fitLine(');
const tapSrc = slice(app, 'function recapTap(ev, row) {', '\n}\n') + '\n}';
const recapCss = slice(css, "/* A light day's games over on 首頁", '/* F1 timing tower');

test("a player's line is not a button: only its face and its name open the player", () => {
  assert.doesNotMatch(recap, /el\('button', \{ class: 'recap-lead'/, 'no button the width of the card');
  assert.match(recap, /class: 'recap-face recap-hit'/, 'the face a button');
  assert.match(recap, /<strong class="recap-hit">/, 'the name the other way in');
  assert.match(app, /class: 'q-card recap', onclick: ev => recapTap\(ev, row\)/, 'the card answers every other tap');
});

test('the card lights whole, never the top half or a player line alone', () => {
  assert.match(recapCss, /\.q-card\.recap > \.event-row:is\(:active, :hover\) \{ background: none; opacity: 1; \}/);
  assert.match(recapCss, /\.q-card\.recap:active:not\(:has\(\.recap-hit:active/);
});

for (const width of [300, 720])
  test(`taps on a ${width}px card: the room beside a name opens the game, the name and face the player`, { skip: !chromium && 'no browser here' }, async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: width + 40, height: 400 } });
      await page.setContent(`<style>body{margin:0;padding:20px;font:16px sans-serif}.event-row{display:grid;grid-template-columns:64px minmax(0,1fr);gap:12px;width:100%;padding:14px 16px;border:0;background:none;text-align:left}.side{display:flex;height:30px;align-items:center}.logo{display:block;width:20px;height:20px;border-radius:50%;background:#888}${recapCss}</style>
        <div class="recap-list" style="width:${width}px"><div class="q-card recap" id="card">
          <button class="event-row" type="button" id="row"><div>完賽</div><div><div class="side">熱火 100</div><div class="side">勇士 120</div></div></button>
          <div class="recap-best">
            <div class="recap-lead" data-side="0" id="lead0"><button class="recap-face recap-hit" type="button" id="face0"><span class="logo"></span></button><span class="recap-text"><strong class="recap-hit" id="name0">D. Mitchell</strong><small>22 分</small></span></div>
            <div class="recap-lead" data-side="1" id="lead1"><button class="recap-face recap-hit" type="button"><span class="logo"></span></button><span class="recap-text"><strong class="recap-hit" id="name1">Stephen Curry</strong><small id="stats1">29 分</small></span></div>
          </div></div></div>`);
      await page.evaluate(tapSrc => {
        const recapTap = new Function(`${tapSrc}; return recapTap;`)();
        window.opened = [];
        const row = document.getElementById('row');
        row.onclick = () => window.opened.push('game');
        document.getElementById('lead0').openPlayer = () => window.opened.push('Mitchell');
        document.getElementById('lead1').openPlayer = () => window.opened.push('Curry');
        document.getElementById('card').onclick = ev => recapTap(ev, row);
      }, tapSrc);
      const box = id => page.locator(`#${id}`).boundingBox();
      const tapAt = async (x, y) => {
        await page.evaluate(() => (window.opened = []));
        await page.mouse.click(x, y);
        return page.evaluate(() => window.opened.join());
      };
      const card = await box('card');
      const name = await box('name1');
      const stats = await box('stats1');
      // Beside the name, out to the card's edge: the game.
      assert.equal(await tapAt(card.x + card.width - 8, name.y + name.height / 2), 'game');
      assert.equal(await tapAt(stats.x + stats.width / 2, stats.y + stats.height / 2), 'game', 'the stats are the game’s, not a way to the player');
      // Under the players, in the card's foot: the game.
      assert.equal(await tapAt(card.x + card.width / 2, card.y + card.height - 4), 'game');
      // The name and the face: the player, and only the one.
      assert.equal(await tapAt(name.x + 4, name.y + name.height / 2), 'Curry');
      const face = await box('face0');
      assert.equal(await tapAt(face.x + face.width / 2, face.y + face.height / 2), 'Mitchell');
      // The top: the game, once.
      const row = await box('row');
      assert.equal(await tapAt(row.x + 30, row.y + 20), 'game');
    } finally {
      await browser.close();
    }
  });
