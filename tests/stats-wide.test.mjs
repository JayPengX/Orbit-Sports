// 數據 on an iPad or a computer (Jay 2026-11-06, F1's 分站冠軍: "Ugly"): the
// ranking was split into two CSS columns (1 2 2 | 4 5 5, the right one's
// lines out of step with the left's, small faces, the values far off, half
// the screen empty). Now (sheets.js statsSplit, styles.css .lb-wide) the
// stats go down the side, each with its leader, and the chosen one's ranking
// is one column beside them, read down; a phone and a team's sheet keep the
// chips over the ranking. Checked in a real page (Chromium) where one is here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const sheets = readFileSync(new URL('../public/sheets.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
let chromium = null;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {}

// The bars' rules, lifted out of sheets.js (it imports the whole app).
const bars = new Function(
  `${sheets.slice(sheets.indexOf('const lbNum = '), sheets.indexOf('function lbBar('))}; return { lbNum, lbBars };`
)();

test('the ranking is never split into CSS columns again', () => {
  assert.doesNotMatch(css, /\.lb-list[^{]*\{[^}]*\bcolumns:/);
  assert.doesNotMatch(css, /\.lb-row[^{]*\{[^}]*break-inside/);
});

test("the side's split only on a league's 賽事 (players and teams); a team's sheet keeps its chips", () => {
  assert.equal((app.match(/renderScores\(\)\), wide: true \}\)/g) || []).length, 3, 'players, teams, F1\'s teams');
  assert.match(app, /state\.scores\.view === 'leaders'\) renderScores\(\);/, 'drawn again when the screen crosses q-wide');
  const team = sheets.slice(sheets.indexOf('const paintLb = '), sheets.indexOf('// A game in a list as every list draws it'));
  assert.doesNotMatch(team, /wide: true/);
  assert.match(team, /leaderList\(st\.url, st\.key, \{ all: true \}\)/, "a team's 隊內排行 reads the league's whole list, not its top hundred");
});

test('bars on every list of numbers, or none (Jay 2026-11-06: "either show it all or don\'t")', () => {
  const v = a => a.map(value => ({ value }));
  assert.equal(bars.lbBars(v(['9', '3', '3', '2', '1', '1'])), true);
  assert.equal(bars.lbBars(v(['.316', '.311', '.300', '.262'])), true, 'close values too');
  assert.equal(bars.lbBars(v(['71.8%', '70.1%', '68.0%'])), true);
  assert.equal(bars.lbBars(v(['9'])), false, 'one row: no bar');
  assert.equal(bars.lbBars(v(['—', '—'])), false, 'no numbers: no bar');
  assert.equal(bars.lbNum('1.033'), 1.033);
  assert.equal(bars.lbNum('—'), null);
});

test("the side's own scroll hands on to the page's (held, its last stats were out of reach below the screen)", () => {
  const rule = css.match(/\.lb-stats \{[^}]*\}/)?.[0] || '';
  assert.match(rule, /overflow-y: auto/);
  assert.doesNotMatch(rule, /overscroll-behavior/);
});

const row = (rank, name, value) => `<button class="lb-row" type="button"><span class="lb-rank num">${rank}</span><span class="logo sm round"></span><span class="lb-name"><strong class="one-line">${name}</strong><small class="one-line">Team</small></span><span class="lbr-bar"><i style="width:${value * 10}%"></i></span><b class="lb-value num">${value}</b></button>`;
const page = (wide, w) => `<!doctype html><html class="${wide ? 'q-wide q-w3' : ''}"><head><style>${css}</style></head><body><div class="page" style="width:${w}px">
${wide ? '<div class="lb-wide"><div class="q-card lb-stats">' + ['分站冠軍', '頒獎台', '竿位'].map((s, i) => `<button class="lb-stat" aria-pressed="${i === 0}"><span class="lb-stat-name">${s}</span><span class="lb-stat-lead"><span class="logo sm round"></span><strong>Kimi Antonelli</strong><b>9</b></span></button>`).join('') + '</div>' : '<div>'}
<div class="q-card"><div class="lb-list bars">${[[1, 'Kimi Antonelli', 9], [2, 'George Russell', 3], [2, 'Max Verstappen', 3], [4, 'Lando Norris', 2], [5, 'Charles Leclerc', 1], [5, 'Lewis Hamilton', 1]].map(r => row(...r)).join('')}</div></div></div></div></body></html>`;

test('wide: one column read down, beside the stats; a phone: no side, no bars', { skip: !chromium && 'no playwright' }, async () => {
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage({ viewport: { width: 1180, height: 820 } });
    await p.setContent(page(true, 1080));
    const r = await p.evaluate(() => {
      const rows = [...document.querySelectorAll('.lb-list .lb-row')].map(e => e.getBoundingClientRect());
      const side = document.querySelector('.lb-stats').getBoundingClientRect();
      const bar = document.querySelector('.lb-list .lbr-bar').getBoundingClientRect();
      return { lefts: [...new Set(rows.map(x => Math.round(x.left)))], downs: rows.every((x, i) => !i || x.top >= rows[i - 1].bottom - 1), side, list: rows[0], bar, sticky: getComputedStyle(document.querySelector('.lb-stats')).position };
    });
    assert.equal(r.lefts.length, 1, 'every row in one column');
    assert.ok(r.downs, 'read down in rank order');
    assert.ok(r.side.right <= r.list.left, 'the stats beside the ranking, on its left');
    assert.ok(r.bar.width > 100, 'a bar between the name and its value');
    assert.equal(r.sticky, 'sticky');
    // NBA's eleven stats on an iPad (Jay 2026-11-06): the page a little way
    // down, the side's bottom below the screen; scrolling over the side
    // reaches its last stat (its own scroll, then the page's).
    const many = ['得分', '籃板', '助攻', '抄截', '阻攻', '三分球', '投籃命中率', '三分命中率', '罰球命中率', '上場時間', '雙十'];
    await p.setContent(page(true, 1080).replace('q-wide q-w3', 'q-wide q-w3 q-tabrail').replace(/<div class="q-card lb-stats">[\s\S]*?<\/div>\s*<div class="q-card">/, () => `<div class="q-card lb-stats">${many.map((st, i) => `<button class="lb-stat" aria-pressed="${i === 0}"><span class="lb-stat-name">${st}</span><span class="lb-stat-lead"><span class="logo sm round"></span><strong>Luka Doncic</strong><b>9</b></span></button>`).join('')}</div><div class="q-card">`).replace('<div class="lb-list bars">', `<div style="height:220px"></div><div class="lb-list bars">${'<div class="lb-row" style="height:100px"></div>'.repeat(30)}`));
    await p.evaluate(() => (document.querySelector('.lb-wide').style.marginTop = '220px', scrollTo(0, 96)));
    const box = await p.evaluate(() => { const r = document.querySelector('.lb-stats').getBoundingClientRect(); return { x: r.left + 40, y: r.top + 60 }; });
    await p.mouse.move(box.x, box.y);
    for (let k = 0; k < 12; k++) {
      await p.mouse.wheel(0, 200);
      await p.waitForTimeout(120);
    }
    const last = await p.evaluate(() => ({ bottom: [...document.querySelectorAll('.lb-stat')].pop().getBoundingClientRect().bottom, h: innerHeight }));
    assert.ok(last.bottom <= last.h, `the last stat in sight (${Math.round(last.bottom)} of ${last.h})`);
    await p.setViewportSize({ width: 320, height: 700 });
    await p.setContent(page(false, 320));
    const phone = await p.evaluate(() => ({ bar: getComputedStyle(document.querySelector('.lbr-bar')).display, w: document.documentElement.scrollWidth }));
    assert.equal(phone.bar, 'none', 'the phone as it was');
    assert.ok(phone.w <= 320, 'nothing sideways at 320');
  } finally {
    await browser.close();
  }
});
