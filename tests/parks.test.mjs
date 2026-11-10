import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parkOf, arriveBy } from '../public/lib/parks.mjs';

test('a CPBL park by its Chinese or English name; an unknown one gets no link', () => {
  assert.equal(parkOf('天母棒球場').name, '天母棒球場');
  assert.equal(parkOf('Taichung Intercontinental Baseball Stadium').name, '臺中洲際棒球場');
  assert.equal(parkOf('臺北大巨蛋').name, '臺北大巨蛋');
  assert.equal(parkOf('Rakuten Taoyuan Baseball Stadium').name, '樂天桃園棒球場');
  assert.equal(parkOf('Dodger Stadium'), null);
  assert.equal(parkOf(''), null);
});

test('there half an hour early, only for a game within two days that has not begun', () => {
  const now = Date.parse('2026-11-10T08:00:00Z');
  assert.equal(arriveBy('2026-11-10T10:35:00Z', now), Date.parse('2026-11-10T10:05:00Z'));
  assert.equal(arriveBy('2026-11-10T08:20:00Z', now), null);
  assert.equal(arriveBy('2026-11-14T10:35:00Z', now), null);
  assert.equal(arriveBy('nope', now), null);
});

test('the park\'s weather for the game\'s three hours; the dome is indoors', async () => {
  const { gameWeather, gameWeatherText, parkOf: park } = await import('../public/lib/parks.mjs');
  const fc = { hourly: { time: ['2026-11-11T17:00', '2026-11-11T18:00', '2026-11-11T19:00', '2026-11-11T20:00', '2026-11-11T21:00', '2026-11-11T22:00'], temperature_2m: [25.2, 24.6, 24, 23.5, 23, 22], precipitation_probability: [10, 20, 65, 40, 30, 90], precipitation: [0, 0, 1.2, 0.4, 0, 3], weather_code: [2, 3, 61, 3, 3, 63] } };
  const w = gameWeather(fc, '2026-11-11T10:35:00Z', park('天母'));
  assert.deepEqual(w, { temp: 25, rain: 65, mm: 1.2, code: 61, wet: true });
  assert.equal(gameWeatherText(w, park('天母')), '雨 25°C · 降雨機率 65%');
  assert.equal(gameWeather(fc, '2026-11-11T10:35:00Z', park('大巨蛋')).wet, false);
  assert.equal(gameWeatherText(w, park('大巨蛋')), '室內（巨蛋）');
  assert.equal(gameWeather(fc, '2026-11-14T10:35:00Z', park('天母')), null);
});
