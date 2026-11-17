// 11-17 round 5: bugs proven and fixed (each test fails on the code before).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { device, sleep } from './prefs-harness.mjs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const base = { v: 4, leagues: ['nba'], games: [], audio: 'en' };
const team = (id, name) => ({ league: 'nba', id, name });

// The phone opened on its cached copy with a save of its own never sent (the
// Celtics); the Pass had the Lakers, followed since on the iPad. The Lakers
// showed, then the save from the cached copy wrote the Celtics over them.
test('opening never writes this device’s older follows over the Pass’s newer ones', async () => {
  const pass = { payload: JSON.stringify({ ...base, follows: [team('13', 'Los Angeles Lakers')], t: 4000 }), writes: [] };
  const phone = device('phone', pass);
  phone.store.set('fx.prefs', JSON.stringify({ a: 'acct1', p: JSON.stringify({ ...base, follows: [team('2', 'Boston Celtics')], t: 3000 }) }));
  phone.applyPrefs(JSON.stringify({ ...base, follows: [], t: 1000 }), { save: false });
  phone.q.active = true;
  phone.applyPrefs(pass.payload);
  await sleep(900);
  assert.deepEqual(JSON.parse(pass.payload).follows.map(f => f.name), ['Los Angeles Lakers']);
  assert.deepEqual(phone.state.prefs.follows.map(f => f.name), ['Los Angeles Lakers']);
  assert.match(app, /applyPrefs\(quick, \{ save: false \}\);/);
});

test('a save writes what’s here when it’s written', async () => {
  const pass = { payload: null, writes: [] };
  const phone = device('phone', pass);
  phone.q.active = true;
  phone.applyPrefs(JSON.stringify({ ...base, follows: [], t: 1000 }));
  phone.savePrefs();
  phone.state.prefs.follows = [team('13', 'Los Angeles Lakers')];
  await sleep(900);
  assert.deepEqual(JSON.parse(pass.payload).follows.map(f => f.name), ['Los Angeles Lakers']);
});

// Sports taken over on the iPad (在這裡繼續): the paused phone's minute beat
// let an ended game go and saved, stamping its old follows newest; taken
// back, they went over the Lakers followed on the iPad.
test('a paused device saves nothing on its own', () => {
  const beat = app.slice(app.indexOf("// A game that's on again"), app.indexOf('}, 60_000);', app.indexOf("// A game that's on again")));
  assert.match(beat, /if \(q\.active\) dropEnded\(\);/);
});

// 賽事 › a league's 賽程 left open at 18:00 and the app back at 08:00: no
// game held was on or due within 3 hours, so nothing was read, and last
// night's games stayed "to come" without scores until a pull.
test('a league’s 賽程 held overnight is read again once a game to come has started', () => {
  const tick = app.slice(app.indexOf('function liveTick()'), app.indexOf('\n}\n', app.indexOf('function liveTick()')));
  assert.match(tick, /Date\.now\(\) - \(state\.scores\.fullAt \|\| 0\) > 10 \* 60_000 && held\.some\(e => e\.status\.state === 'pre' && Date\.parse\(e\.start\) < Date\.now\(\)\)/);
});

// A Scottish club's League Cup was called 英格蘭聯賽盃, and the Scottish Cup
// stayed in English (a player's card, 出賽紀錄, a club's schedule).
test('Scotland’s cups by their own names', async () => {
  const { compName } = await import('../public/lib/compname.mjs');
  assert.equal(compName('Scottish League Cup', false), '蘇格蘭聯賽盃');
  assert.equal(compName('Scottish Cup', false), '蘇格蘭盃');
  assert.equal(compName('Carabao Cup', false), '英格蘭聯賽盃');
  assert.equal(compName('English League Cup', false), '英格蘭聯賽盃');
  assert.equal(compName('League Cup', false), '英格蘭聯賽盃');
});

// In English a day or a league with one game said "1 games".
test('one game is "1 game" in English', async () => {
  const { makeT } = await import('../public/lib/i18n.mjs');
  assert.equal(makeT('en')('gamesN', { n: 1 }), '1 game');
  assert.equal(makeT('en')('gamesN', { n: 3 }), '3 games');
  assert.equal(makeT('zh')('gamesN', { n: 1 }), '1 場');
});

// In English a game's weather was ESPN's Fahrenheit bare: "72° Partly
// Cloudy", read as 72 °C in Taiwan (the Chinese page said 22°C).
test('a game’s weather in Celsius in English too', async () => {
  const { weatherZh } = await import('../public/lib/statnames.mjs');
  assert.equal(weatherZh('72° Partly Cloudy', 'en'), '22°C Partly Cloudy');
  assert.equal(weatherZh('72° Partly Cloudy', 'zh'), '多雲時晴 22°C');
  assert.equal(weatherZh('Dome', 'en'), 'Dome');
});
