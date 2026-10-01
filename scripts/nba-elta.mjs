// Writes public/nba-elta.json: the NBA games ELTA carries in Taiwan, the
// whole season, from NBA.com's schedule for Taiwan (region 32, what
// nba.com/schedule?region=32 shows). ELTA's own list runs two weeks; this
// one runs as far as NBA.com has named the broadcasters. NBA.com's CDN
// refuses Cloudflare's Workers and won't be read from another site, so the
// deploy workflow fetches it (on every push and every few hours) and the app
// reads the small result from its own site. Run by the workflow only.
import { writeFile } from 'node:fs/promises';
import { NBA_TW_SCHEDULE, nbaEltaGames } from '../public/lib/broadcast.mjs';

const res = await fetch(NBA_TW_SCHEDULE, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36', Referer: 'https://www.nba.com/', Accept: 'application/json' } });
if (!res.ok) {
  // The app then names only what ELTA's own list has.
  console.warn(`NBA.com answered ${res.status}: no nba-elta.json this deploy`);
  process.exit(0);
}
const data = await res.json();
const games = nbaEltaGames(data).map(g => ({ id: g.id, start: new Date(g.start).toISOString(), home: g.home, away: g.away }));
const names = [...new Set((data?.leagueSchedule?.gameDates || []).flatMap(d => d.games || []).flatMap(g => Object.values(g.broadcasters || {}).flat()).map(b => b?.broadcasterDisplay).filter(Boolean))];
console.log(`${games.length} ELTA games; Taiwan broadcasters: ${names.join(', ')}`);
await writeFile(new URL('../public/nba-elta.json', import.meta.url), JSON.stringify({ games }) + '\n');
