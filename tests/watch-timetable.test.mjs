import test from 'node:test';
import assert from 'node:assert/strict';

test("a game to come opens ELTA's timetable, never its channel; a game on, or its program begun, the channel (Jay 11-17)", async () => {
  const { watchLinkOf } = await import('../public/lib/tv.mjs');
  const { eltaChannel } = await import('../public/lib/broadcast.mjs');
  const game = (state, start = Date.now() + 3 * 3_600_000) => ({ league: 'epl', id: '1', kind: 'match', start: new Date(start).toISOString(), status: { state } });
  const max5 = { ...eltaChannel(544), at: Date.now() + 3 * 3_600_000, exact: true };
  const soon = watchLinkOf(game('pre'), max5);
  assert.equal(soon.url, 'https://eltaott.tv/channel/sports_program_detail');
  assert.equal(soon.app, 'eltatv://schedule/live');
  // Still the channel's name and lines.
  assert.equal(soon.ch, 544);
  assert.equal(soon.short.zh, 'MAX5台');
  // On now: the channel itself, in the app (eltatv://live/<ch>).
  const on = watchLinkOf(game('in'), max5);
  assert.equal(on.url, 'https://eltaott.tv/channel/play/544/108');
  assert.equal(on.app, 'eltatv://live/544');
  // ESPN not yet started, the program on that channel begun: the channel.
  assert.equal(watchLinkOf(game('pre', Date.now() + 60_000), { ...max5, at: Date.now() - 60_000 }).app, 'eltatv://live/544');
  // Apple TV's and a link with no channel are as they were.
  const apple = { svc: 'appletv', url: 'https://tv.apple.com/tw/channel/mls/tvs.sbd.7000', exact: true };
  assert.equal(watchLinkOf(game('pre'), apple), apple);
  assert.equal(watchLinkOf(null, max5), max5);
});
