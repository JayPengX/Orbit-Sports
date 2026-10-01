import test from 'node:test';
import assert from 'node:assert/strict';

test('photos: only studio headshots (ESPN by id or name, TheSportsDB cutouts), never a casual picture', async () => {
  const P = await import('../public/lib/photos.mjs');
  assert.equal(P.espnHeadshot('nba', 1966), 'https://a.espncdn.com/i/headshots/nba/players/full/1966.png');
  assert.equal(P.espnHeadshot('epl', 22), 'https://a.espncdn.com/i/headshots/soccer/players/full/22.png');
  assert.equal(P.espnHeadshot('cpbl', 22), null);
  const tsdb = async () => ({ player: [{ strPlayer: 'Shohei Ohtani', strSport: 'Baseball', strThumb: 'thumb.jpg', strCutout: 'https://r2.thesportsdb.com/images/media/player/cutout/x.png' }, { strPlayer: 'Juan Soto', strSport: 'Baseball', strThumb: 'casual.jpg', strCutout: null }] });
  assert.equal(await P.tsdbCutout('Shohei Ohtani', 'baseball', tsdb), 'https://r2.thesportsdb.com/images/media/player/cutout/x.png');
  // Only a thumbnail (often a casual picture): none.
  assert.equal(await P.tsdbCutout('Juan Soto', 'baseball', tsdb), '');
  assert.ok(P.isCutout('https://r2.thesportsdb.com/images/media/player/cutout/x.png'));
  const espn = async () => ({ items: [{ type: 'player', sport: 'basketball', league: 'wnba', id: '7', displayName: 'Caitlin Clark' }] });
  assert.equal(await P.espnSearchPhoto('Caitlin Clark', 'basketball', espn, async () => true), 'https://a.espncdn.com/combiner/i?img=/i/headshots/wnba/players/full/7.png&w=256');
  assert.equal(P.smallPhoto('https://a.espncdn.com/i/headshots/nba/players/full/1966.png'), 'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/1966.png&w=256');
  assert.equal(P.smallPhoto('https://r2.thesportsdb.com/x.png'), 'https://r2.thesportsdb.com/x.png');
  assert.equal(await P.espnSearchPhoto('Caitlin Clark', 'basketball', espn, async () => false), '');
});
