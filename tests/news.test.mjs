// 相關新聞: Orbit News' sports stories on a player's, a team's and a game's
// page (lib/news.mjs over the kit's news-sport.mjs; Jay 2026-11-13: "do that
// cross app thing for sports's that's news related, for example injury").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanSport } from '#kit/news-sport.mjs';
import * as sport from '#kit/news-sport.mjs';
import { playerNews, teamNews, gameNews, teamFor } from '../public/lib/news.mjs';

const NOW = Date.now();
const story = (id, title, ago, extra = {}) => ({ id, title, at: NOW - ago, by: 'udn', n: 1, items: [['udn', title, `https://udn.com/news/story/${id}`, NOW - ago]], ...extra });
const n = {
  kit: sport,
  pack: cleanSport({
    built: NOW,
    tw: [
      story('hurt', '柯瑞傷勢MRI結果出爐！確診腹斜肌撕裂', 2 * 3_600_000, { k: 'injury', who: { p: ['Stephen Curry'], t: ['Golden State Warriors'] } }),
      story('game', 'NBA／勇士108：115輸火箭 中止8連勝', 3_600_000, { k: '' }),
      story('braves', '道奇牛棚大將轉戰勇士！3年合約', 3_600_000, { k: 'move' }),
      story('cpbl', '中職／林安可續約 統一獅', 3_600_000, { k: 'move' })
    ],
    intl: [story('rockets', 'Houston Rockets beat Golden State Warriors', 1_800_000, { k: '' })]
  })
};
const GSW = { name: 'Golden State Warriors', short: 'Warriors' };

test("a team's league as the kit's matcher takes it", () => {
  assert.deepEqual(teamFor('nba', GSW), { league: 'nba', name: 'Golden State Warriors', short: 'Warriors', sport: 'basketball' });
  assert.equal(teamFor('nba', {}), null);
});

test("a player's stories: his own, never his team's alone", () => {
  assert.deepEqual(playerNews(n, 'nba', { name: 'Stephen Curry', team: { name: 'Golden State Warriors' } }).map(s => s.id), ['hurt']);
  // (A CPBL player by his own Chinese name.)
  assert.deepEqual(playerNews(n, 'cpbl', { name: '', zh: '林安可' }).map(s => s.id), ['cpbl']);
  assert.deepEqual(playerNews(null, 'nba', { name: 'Stephen Curry' }), []);
});

test("a team's stories, its injuries first; 勇士 in baseball isn't Golden State", () => {
  const ids = teamNews(n, 'nba', GSW, 6).map(s => s.id);
  assert.equal(ids[0], 'hurt');
  assert.ok(ids.includes('game') && ids.includes('rockets'));
  assert.ok(!ids.includes('braves'));
});

test("a game's: either side's injury before it, then those naming both", () => {
  const e = { league: 'nba', start: new Date(NOW + 3_600_000).toISOString(), away: { name: '金州勇士', en: 'Golden State Warriors', short: '勇士' }, home: { name: '休士頓火箭', en: 'Houston Rockets', short: '火箭' } };
  assert.deepEqual(gameNews(n, e).map(s => s.id), ['hurt', 'rockets', 'game']);
  assert.deepEqual(gameNews(n, { ...e, home: null }), []);
});

test('the pages draw 相關新聞 with the Orbit AI mark, a tap opening the story in Orbit News', () => {
  const src = readFileSync(new URL('../public/sheets.js', import.meta.url), 'utf8');
  assert.match(src, /function newsCard\(list\)[\s\S]{0,300}kitUI\.aiMark\?\.\(\)/);
  assert.match(src, /ctx\.q\.go\('news', hash\)/);
  assert.match(src, /'injuries', 'news', 'tv'/);
});
