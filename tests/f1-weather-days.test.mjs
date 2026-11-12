import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Las Vegas: Saturday 22:00 there is Sunday 14:00 in Taiwan. The weather's
// days are the circuit's, so each is named by its sessions, never a weekday
// that disagrees with the sessions listed above it in Taiwan's time.
test("an F1 weekend's weather days carry their sessions (the circuit's dates, not Taiwan's)", async () => {
  globalThis.fetch = async url => {
    const u = String(url?.url || url);
    const body = /jolpi|ergast/.test(u)
      ? { MRData: { RaceTable: { Races: [{ round: '22', date: '2026-11-21', Circuit: { Location: { lat: '36.11', long: '-115.16' } } }] } } }
      : /open-meteo/.test(u)
        ? { utc_offset_seconds: -8 * 3600, elevation: 610, daily: { time: ['2026-11-19', '2026-11-20', '2026-11-21'], weather_code: [0, 1, 2], temperature_2m_max: [18, 19, 17], temperature_2m_min: [8, 9, 7], precipitation_probability_max: [0, 5, 10] } }
        : {};
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const { circuitWeather } = await import('../public/lib/f1.mjs');
  const fp1 = '2026-11-20T00:30:00Z'; // Thu 16:30 there, Fri 08:30 here
  const qual = '2026-11-21T04:00:00Z'; // Fri 20:00 there, Sat 12:00 here
  const race = '2026-11-22T06:00:00Z'; // Sat 22:00 there, Sun 14:00 here
  const wx = await circuitWeather(race, [fp1, qual, race]);
  assert.deepEqual(wx.map(w => [w.date, w.starts]), [['2026-11-19', [fp1]], ['2026-11-20', [qual]], ['2026-11-21', [race]]]);
  const sheets = readFileSync(new URL('../public/sheets.js', import.meta.url), 'utf8');
  assert.match(sheets, /text: day\(w\) \}/);
  assert.match(sheets, /SESSION_NAMES\[top\]\.short/);
});
