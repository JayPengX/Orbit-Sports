import test from 'node:test';
import assert from 'node:assert/strict';
import { clubHome } from '../public/lib/espn.mjs';

// A friend's 追蹤 (Jay 11-26): Barcelona followed under the Nations League read 歐國聯 on its card.
test("a club found in a national sides' competition goes to its own league, else its European cup; a national side stays", async () => {
  const cups = async () => new Map([['83', 'ucl']]);
  const laLiga = async () => ({ key: null, name: 'Spanish LALIGA' });
  assert.equal(await clubHome('nationsleague', '83', { home: laLiga, cups }), 'ucl');
  assert.equal(await clubHome('nationsleague', '359', { home: async () => ({ key: 'epl', name: 'English Premier League' }), cups }), 'epl');
  assert.equal(await clubHome('nationsleague', '164', { home: async () => ({ key: null, name: 'UEFA Nations League' }), cups }), 'nationsleague');
  assert.equal(await clubHome('epl', '359', { home: laLiga, cups }), 'epl');
});

// LaLiga added (Jay 11-26): Barcelona, followed under 歐冠 while LaLiga wasn't ours, goes to LaLiga; Arsenal under 歐冠 stays.
test('a club under a European cup only for want of its league: its league once ours', async () => {
  const cups = async () => new Map();
  assert.equal(await clubHome('ucl', '83', { home: async () => ({ key: 'laliga', name: 'Spanish LALIGA' }), cups }), 'laliga');
  assert.equal(await clubHome('ucl', '359', { home: async () => ({ key: 'epl', name: 'English Premier League' }), cups }), 'ucl');
  assert.equal(await clubHome('nationsleague', '83', { home: async () => ({ key: 'laliga', name: 'Spanish LALIGA' }), cups }), 'laliga');
});
