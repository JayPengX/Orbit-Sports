import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zhSides } from '../public/lib/tv.mjs';

// ELTA lists its games in Chinese. An English page's sides are in English, and a
// national side has no club name: 拉脫維亞 v 亞美尼亞 was on TV in Chinese only, so
// English 首頁 showed other games (Showcase, 11-14). The language changes the words, never the games.
test('a national side matches ELTA in Chinese from an English page', () => {
  const e = { league: 'nationsleague', home: { id: '1', name: 'Latvia', short: 'Latvia' }, away: { id: '2', name: 'Armenia', short: 'Armenia' } };
  const [home, away] = zhSides(e);
  assert.ok(home.includes('拉脫維亞'), home.join(','));
  assert.ok(away.includes('亞美尼亞'), away.join(','));
});

test('a club keeps its Chinese names from an English page', () => {
  const e = { league: 'epl', home: { id: '1', name: 'Arsenal', short: 'Arsenal' }, away: { id: '2', name: 'Newcastle United', short: 'Newcastle' } };
  assert.ok(zhSides(e)[0].includes('兵工廠'), zhSides(e)[0].join(','));
});
