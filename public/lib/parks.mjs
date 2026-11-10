// 去球場 and 球場天氣 (Jay 11-10, the family working together): a CPBL
// game's park, where it is, so the game's sheet can hand the trip to Orbit
// Transit's planner (there before the first pitch) and say the weather at
// the park for the game's hours. Places from OpenStreetMap (11-10); a park
// not here gets neither (never a guess). The dome is roofed: no rain.
const PARKS = [
  [/大巨蛋|taipei dome/i, 25.042405, 121.559581, '臺北大巨蛋', true],
  [/天母|tianmu/i, 25.11349, 121.533285, '天母棒球場'],
  [/新莊|xinzhuang|hsinchuang/i, 25.041098, 121.447777, '新莊棒球場'],
  [/洲際|intercontinental/i, 24.198972, 120.686445, '臺中洲際棒球場'],
  [/亞太|asia.?pacific/i, 23.061278, 120.238014, '亞太國際棒球場'],
  [/臺南|台南|tainan/i, 22.980474, 120.20623, '臺南市立棒球場'],
  [/澄清湖|cheng.?ch?ing/i, 22.654521, 120.358917, '澄清湖棒球場'],
  [/桃園|taoyuan/i, 25.000975, 121.200393, '樂天桃園棒球場'],
  [/斗六|douliu|touliu/i, 23.717517, 120.536453, '斗六棒球場'],
  [/新竹|hsinchu/i, 24.806849, 120.960861, '新竹市立棒球場']
];

// The park a venue's name is, or null.
export function parkOf(venue) {
  const v = String(venue || '');
  if (!v) return null;
  const p = PARKS.find(([re]) => re.test(v));
  return p ? { lat: p[1], lon: p[2], name: p[3], dome: !!p[4] } : null;
}

// When to be there: half an hour before the start; null once that's past
// (or the game started, or it's more than two days off: plan nearer the day).
export function arriveBy(start, now = Date.now()) {
  const t = Date.parse(start);
  if (!Number.isFinite(t)) return null;
  const by = t - 30 * 60_000;
  return by > now && by - now < 2 * 86_400_000 ? by : null;
}

// The hours a game is played (from its start, three of them), from
// Open-Meteo's hourly forecast for the park (read from the phone):
// { temp, rain (the highest chance, %), mm, code, wet } or null (no hours
// for it: too far off, or past). `wet`: rain likely enough to hold the game
// (60% or more, or 2 mm in an hour), never under the dome.
export const parkForecastUrl = park => `https://api.open-meteo.com/v1/forecast?latitude=${park.lat}&longitude=${park.lon}&hourly=temperature_2m,precipitation_probability,precipitation,weather_code&timezone=Asia%2FTaipei&forecast_days=3`;
export function gameWeather(fc, start, park) {
  const h = fc?.hourly;
  const t0 = Date.parse(start);
  if (!h?.time?.length || !Number.isFinite(t0)) return null;
  // Open-Meteo's hours are Taipei's ('2026-11-11T18:00'), as asked.
  const at = h.time.map(x => Date.parse(`${x}:00+08:00`));
  const idx = at.map((t, i) => (t >= t0 - 3_600_000 + 1 && t < t0 + 3 * 3_600_000 ? i : -1)).filter(i => i >= 0 && h.temperature_2m?.[i] != null);
  if (!idx.length) return null;
  const pick = k => idx.map(i => Number(h[k]?.[i])).filter(Number.isFinite);
  const temps = pick('temperature_2m');
  const rain = Math.max(0, ...pick('precipitation_probability'));
  const mm = Math.max(0, ...pick('precipitation'));
  const codes = pick('weather_code');
  return { temp: Math.round(temps[0]), rain, mm: Math.round(mm * 10) / 10, code: Math.max(...codes, 0), wet: !park?.dome && (rain >= 60 || mm >= 2) };
}
// In words: "多雲 24°C · 降雨機率 30%", "室內（巨蛋）" under the dome.
const SKY = [[95, '雷雨', 'Thunderstorms'], [80, '陣雨', 'Showers'], [61, '雨', 'Rain'], [51, '毛毛雨', 'Drizzle'], [45, '霧', 'Fog'], [3, '陰', 'Overcast'], [2, '多雲', 'Cloudy'], [1, '晴時多雲', 'Partly cloudy'], [0, '晴', 'Clear']];
export function gameWeatherText(w, park, en = false) {
  if (park?.dome) return en ? 'Indoors (dome)' : '室內（巨蛋）';
  if (!w) return '';
  const sky = SKY.find(([c]) => w.code >= c) || SKY.at(-1);
  return [`${en ? sky[2] : sky[1]} ${w.temp}°C`, w.rain ? (en ? `${w.rain}% rain` : `降雨機率 ${w.rain}%`) : ''].filter(Boolean).join(' · ');
}
