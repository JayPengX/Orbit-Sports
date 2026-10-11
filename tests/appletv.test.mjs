import test from 'node:test';
import assert from 'node:assert/strict';

test("an MLS game opens at its own Apple TV page once Shared-Data has it, and over it's Apple TV's to watch again", async () => {
  const { setWatchPack } = await import('../public/lib/highlights.mjs');
  const { tvOf, replayHint, watchOf } = await import('../public/lib/tv.mjs');
  const game = state => ({ league: 'mls', id: '761858', kind: 'match', start: '2026-10-11T02:30Z', status: { state }, home: { name: 'LAFC', en: 'LAFC' }, away: { name: 'Vancouver Whitecaps', en: 'Vancouver Whitecaps' } });
  // Before the pack: the MLS channel's page.
  assert.match(watchOf(game('in')).url, /channel\/mls/);
  setWatchPack({ games: { 'mls:761858:': { apple: 'https://tv.apple.com/tw/sporting-event/x/umc.cse.7abk', at: 1 } } });
  const b = tvOf(game('in')).find(x => x.svc === 'appletv');
  assert.equal(b.url, 'https://tv.apple.com/tw/sporting-event/x/umc.cse.7abk');
  assert.equal(b.game, true);
  assert.deepEqual(replayHint(game('post')), { video: true, apple: true });
  assert.equal(replayHint(game('in')), null);
});
