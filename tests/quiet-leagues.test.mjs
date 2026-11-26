// More leagues without burying the big ones (Jay 11-26): a league on no TV
// here, not followed, never fills 首頁's other games, sits behind one
// 更多聯賽 chip on 賽事's rail, and in 全部 is one row a league at the end.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

test('quiet leagues: out of 首頁, folded on the rail, one card in 全部', () => {
  assert.match(app, /const NO_TV = broadcast\.NO_TV \|\| new Set/);
  assert.match(app, /const quietLeague = k => NO_TV\.has\(k\) && !state\.prefs\.leagues\.includes\(k\);/);
  const others = app.slice(app.indexOf('function otherLeagues()'), app.indexOf('const espnDaysOf'));
  assert.match(others, /!quietLeague\(k\)/);
  const rail = app.slice(app.indexOf('function leagueRail(rail)'), app.indexOf('function openLeague('));
  assert.match(rail, /更多聯賽/);
  assert.match(rail, /if \(!open\) rail = rail\.filter\(k => !quietLeague\(k\)\)/);
  const all = app.slice(app.indexOf('function renderAll()'), app.indexOf('const MAIN_CHANNELS'));
  assert.match(all, /all-quiet/);
  assert.match(all, /\.filter\(\(\[k\]\) => !quietLeague\(k\)\)/);
});
