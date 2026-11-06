// A part kept to be put back keeps its pictures (Jay 2026-11-05: the team
// page's 下一場, 火箭 vs 太陽, came back from 賽程 to 概況 with no logos).
// ui.js put moves a drawn picture into the new drawing of the same one; it
// took the kept 概況's logos for 賽程's same game, and 概況 came back
// without them. Now the two swap, run in a real page (Chromium) where one is here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const src = readFileSync(new URL('../public/lib/pictures.mjs', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../public/ui.js', import.meta.url), 'utf8');
let chromium = null;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {}

test('put moves pictures through lib/pictures.mjs, never its own copy', () => {
  assert.match(ui, /import \{ keepPictures \} from '\.\/lib\/pictures\.mjs';/);
  assert.ok(!/function keepPictures/.test(ui));
});

test('a drawn picture is swapped into the new drawing, never taken from the old', () => {
  assert.match(src, /to\.replaceWith\(from\)/, 'the new one goes where the old one was');
});

test('概況 → 賽程 → 概況: the kept part has its logos each time', { skip: !chromium && 'no browser here' }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    await page.setContent('<div id="body"></div>');
    const out = await page.evaluate(
      async ({ code, png }) => {
        const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
        const { keepPictures } = await import(url);
        const put = (node, ...list) => {
          const keep = new Set(list.filter(k => k.parentNode === node));
          keepPictures(node, list, keep);
          node.replaceChildren(...list);
        };
        const row = name => {
          const d = document.createElement('div');
          d.className = name;
          for (const team of ['rockets', 'suns']) {
            const p = document.createElement('picture');
            p.className = 'logo-wrap';
            const img = document.createElement('img');
            img.className = 'logo';
            img.src = `${png}#${team}`;
            p.append(img);
            d.append(p);
          }
          return d;
        };
        const loaded = async n => Promise.all([...n.querySelectorAll('img')].map(i => i.decode().catch(() => {})));
        const body = document.getElementById('body');
        const overview = [row('next'), row('last')];
        put(body, ...overview);
        await loaded(body);
        const shown = [...body.querySelectorAll('img')];
        const games = [row('coming')];
        put(body, ...games);
        const count = n => n.querySelectorAll('picture img').length;
        const after1 = { gamesLogos: count(body), movedOver: shown.includes(body.querySelector('img')), keptLogos: overview.map(count) };
        await loaded(body);
        put(body, ...overview);
        await loaded(body);
        const back = [...body.querySelectorAll('img')];
        return { ...after1, backLogos: overview.map(count), allDrawn: back.every(i => i.complete && i.naturalWidth > 0), sameAsFirst: back.every(i => shown.includes(i)) };
      },
      { code: src, png }
    );
    assert.equal(out.gamesLogos, 2, '賽程 has its two logos');
    assert.ok(out.movedOver, '賽程 got the logo already drawn (no blank frame)');
    assert.deepEqual(out.keptLogos, [2, 2], 'the kept 概況 still has a logo for each side');
    assert.deepEqual(out.backLogos, [2, 2], 'back on 概況, both rows have both logos');
    assert.ok(out.allDrawn, 'and they are drawn');
    assert.ok(out.sameAsFirst, 'the ones drawn first, come back');
  } finally {
    await browser.close();
  }
});
