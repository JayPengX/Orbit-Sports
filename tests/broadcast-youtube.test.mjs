import test from 'node:test';
import assert from 'node:assert/strict';
import { ytVideoFor } from '../public/lib/broadcast.mjs';

const videos = [
  { id: 'a1', t: 'Nikita Artemenko vs Li Hechen | MS QR1 | #ChinaSmash 2026', p: '2026-10-01T06:36:38+00:00' },
  { id: 'b2', t: 'Ulsan HD vs Pohang Steelers | K League 1 Round 31 LIVE', p: '2026-10-03T09:00:00+00:00' },
  { id: 'c3', t: 'K LEAGUE 1 scoring race check-in after Round 30', p: '2026-10-01T06:00:00+00:00' }
];
test('a game is on YouTube only with its own video on the channel', () => {
  const tt = { kind: 'match', start: '2026-10-01T05:00:00Z', home: { name: 'Nikita Artemenko' }, away: { name: 'Li Hechen' } };
  assert.equal(ytVideoFor(tt, videos)?.id, 'a1');
  const k = { kind: 'match', start: '2026-10-04T10:00:00Z', home: { en: 'Ulsan HD', name: '蔚山' }, away: { en: 'Pohang Steelers', name: '浦項' } };
  assert.equal(ytVideoFor(k, videos)?.id, 'b2');
  // Another game of the league: nothing, not "selected games".
  const other = { kind: 'match', start: '2026-10-04T10:00:00Z', home: { en: 'FC Seoul' }, away: { en: 'Daegu FC' } };
  assert.equal(ytVideoFor(other, videos), null);
  // The same teams a month later: not that video.
  assert.equal(ytVideoFor({ ...k, start: '2026-11-04T10:00:00Z' }, videos), null);
});
