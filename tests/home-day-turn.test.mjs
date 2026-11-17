// 首頁 left open on today moves on with the day (11-17: an iPhone keeps the
// app for hours; left on a day whose last game ended after midnight, 首頁
// still showed that day's results the next morning, and its move to their
// next day never came, waiting on the day shown being today). A game still on
// keeps it on the evening's games; a day the person picked stays. Runs
// app.js's own turnHomeDay with the rest stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const from = app.indexOf('function turnHomeDay(');
const src = app.slice(from, app.indexOf('\n}\n', from) + 3);
assert.ok(from > 0, 'turnHomeDay is there');

function harness({ date = '2026-11-21', events = [], tab = 'home', filter = 'all' } = {}) {
  let now = '2026-11-22';
  const drawn = [];
  const state = { tab, home: { date, todayWas: '2026-11-21', filter, autoDay: false, shown: 60, kept: { date: '2026-11-20' } }, days: new Map([['2026-11-21', { events }]]) };
  const env = {
    state, today: () => now, dayAll: slot => slot?.events || [], dueToStart: e => e.status.state === 'pre' && e.due,
    stripRange: {}, toPageTop() {}, SPORTS: { soccer: {} }, pickFilter: k => drawn.push(`filter:${k}`), renderHome: () => drawn.push('home'),
  };
  const turn = new Function(...Object.keys(env), `${src}; return turnHomeDay;`)(...Object.values(env));
  return { state, turn, drawn };
}

test('首頁 left on a day that turned goes to the new today once nothing of that day is on', () => {
  const h = harness({ events: [{ status: { state: 'post' } }] });
  assert.equal(h.turn(), true);
  assert.equal(h.state.home.date, '2026-11-22');
  assert.equal(h.state.home.autoDay, true, 'the move to their next day may come, as at a fresh open');
  assert.deepEqual(h.drawn, ['home']);
});

test('a game of that evening still on keeps 首頁 on it; a day the person picked stays', () => {
  for (const state of ['in', 'pre']) {
    const h = harness({ events: [{ status: { state }, due: true }] });
    assert.equal(h.turn(), false);
    assert.equal(h.state.home.date, '2026-11-21');
  }
  const picked = harness({ date: '2026-11-19' });
  assert.equal(picked.turn(), false);
  assert.equal(picked.state.home.date, '2026-11-19');
});

test('a sport chip picks the sport’s day from the new today; another tab draws 首頁 when opened', () => {
  const sport = harness({ filter: 'soccer' });
  sport.turn();
  assert.deepEqual(sport.drawn, ['filter:soccer']);
  const away = harness({ tab: 'live' });
  assert.equal(away.turn(), true);
  assert.equal(away.state.home.date, '2026-11-22');
  assert.deepEqual(away.drawn, []);
});

test('renderHome notes the day it was while on today, and the live tick looks at the turn', () => {
  const home = app.slice(app.indexOf('function renderHome() {'), app.indexOf('function renderHome() {') + 600);
  assert.match(home, /if \(h\.date === today\(\)\) h\.todayWas = h\.date;/);
  const tick = app.slice(app.indexOf('function liveTick() {'), app.indexOf('function liveTick() {') + 200);
  assert.match(tick, /turnHomeDay\(\);/);
});
