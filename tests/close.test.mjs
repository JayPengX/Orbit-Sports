import test from 'node:test';
import assert from 'node:assert/strict';
import { closeGame } from '../public/lib/close.mjs';

const g = (status, away, home) => ({ status: { state: 'in', ...status }, away: { score: away }, home: { score: home } });

test('basketball: 4th quarter or overtime, 5 minutes or less, 5 points or fewer', () => {
  assert.equal(closeGame(g({ period: 4, clock: '4:59' }, '98', '95'), 'basketball'), true);
  assert.equal(closeGame(g({ period: 4, clock: '45.3' }, '98', '100'), 'basketball'), true);
  assert.equal(closeGame(g({ period: 5, clock: '2:10' }, '110', '110'), 'basketball'), true);
  assert.equal(closeGame(g({ period: 4, clock: '5:01' }, '98', '95'), 'basketball'), false);
  assert.equal(closeGame(g({ period: 4, clock: '3:00' }, '98', '90'), 'basketball'), false);
  assert.equal(closeGame(g({ period: 3, clock: '1:00' }, '98', '97'), 'basketball'), false);
  assert.equal(closeGame(g({ period: 4, clock: '0:00', name: 'STATUS_END_PERIOD' }, '98', '97'), 'basketball'), false);
});

test('baseball: 8th a run apart, 9th on two apart', () => {
  assert.equal(closeGame(g({ period: 8 }, '3', '2'), 'baseball'), true);
  assert.equal(closeGame(g({ period: 8 }, '4', '2'), 'baseball'), false);
  assert.equal(closeGame(g({ period: 9 }, '4', '2'), 'baseball'), true);
  assert.equal(closeGame(g({ period: 10 }, '4', '1'), 'baseball'), false);
  assert.equal(closeGame(g({ period: 7 }, '2', '2'), 'baseball'), false);
});

test('soccer: 80th minute on, a goal or none apart; never half-time; never without a score', () => {
  assert.equal(closeGame(g({ clock: "82'" }, '1', '1'), 'soccer'), true);
  assert.equal(closeGame(g({ clock: "90'+3'" }, '2', '1'), 'soccer'), true);
  assert.equal(closeGame(g({ clock: "79'" }, '1', '1'), 'soccer'), false);
  assert.equal(closeGame(g({ clock: "85'" }, '3', '1'), 'soccer'), false);
  assert.equal(closeGame(g({ clock: "45'", name: 'STATUS_HALFTIME' }, '1', '1'), 'soccer'), false);
  assert.equal(closeGame(g({ clock: "85'" }, '', ''), 'soccer'), false);
  assert.equal(closeGame({ ...g({ clock: "85'" }, '1', '1'), status: { state: 'post' } }, 'soccer'), false);
  assert.equal(closeGame(g({ clock: "85'", delayed: true }, '1', '1'), 'soccer'), false);
});

test('a soccer game with a goal keeps the tag on the goal line: 勝負未定 first, then 最新進球', async () => {
  const { goalHead } = await import('../public/lib/live.mjs');
  assert.deepEqual(goalHead(g({ clock: "82'" }, '1', '1')), ['勝負未定', '最新進球']);
  assert.deepEqual(goalHead(g({ clock: "82'" }, '1', '1'), 'en'), ['Close finish', 'Latest goal']);
  assert.deepEqual(goalHead(g({ clock: "70'" }, '1', '1')), ['最新進球']);
  assert.deepEqual(goalHead(g({ clock: "85'" }, '3', '0')), ['最新進球']);
});
