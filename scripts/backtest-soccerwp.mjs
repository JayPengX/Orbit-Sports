// How good soccer's win chance line is (lib/soccerwp.mjs), on finished games:
// each game's closing odds as the prior, its goals and red cards as they
// came, every minute's chances scored against the result.
//   node scripts/backtest-soccerwp.mjs /tmp/games.jsonl   (reads ESPN once into the file, then reuses it)
// → games, log loss and Brier per minute (lower is better), and calibration
// (said → happened, in tenths).
import fs from 'node:fs';
import { parseSummary } from '../public/lib/espn.mjs';
import { soccerLine } from '../public/lib/soccerwp.mjs';

const FILE = process.argv[2] || '/tmp/soccer-games.jsonl';
const LG = { epl: 'eng.1', laliga: 'esp.1', seriea: 'ita.1', bundesliga: 'ger.1', ligue1: 'fra.1', ucl: 'uefa.champions', uel: 'uefa.europa', mls: 'usa.1', scotland: 'sco.1' };
const SITE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const get = async u => {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(u);
      if (r.ok) return r.json();
    } catch {}
    await new Promise(r => setTimeout(r, 1000 * (i + 1)));
  }
  return null;
};

if (!fs.existsSync(FILE)) {
  const jobs = [];
  for (const [lg, path] of Object.entries(LG))
    for (const year of ['2025', '2026']) for (const e of (await get(`${SITE}/${path}/scoreboard?dates=${year}&limit=1000`))?.events || []) if (e.status?.type?.state === 'post') jobs.push([lg, path, e.id]);
  const rows = [];
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (jobs.length) {
        const [lg, path, id] = jobs.shift();
        const d = await get(`${SITE}/${path}/summary?event=${id}`);
        const c = d?.header?.competitions?.[0];
        if (!c) continue;
        const s = parseSummary(d, lg);
        const side = k => c.competitors?.find(x => x.homeAway === k);
        if (s.predict) rows.push(JSON.stringify({ id, lg, start: c.date, homeId: side('home')?.id, score: { home: side('home')?.score, away: side('away')?.score }, status: s.status, predict: s.predict, timeline: s.timeline, events: s.events }));
      }
    })
  );
  fs.writeFileSync(FILE, rows.join('\n'));
}

const games = fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
let [n, ll, br, used] = [0, 0, 0, 0];
const cal = Array.from({ length: 10 }, () => ({ n: 0, p: 0, y: 0 }));
for (const g of games) {
  const [h, a] = [Number(g.score.home), Number(g.score.away)];
  if (!Number.isFinite(h) || (g.status?.period || 2) > 2) continue;
  const line = soccerLine({ prior: g.predict, timeline: g.timeline, events: g.events, status: g.status, homeId: g.homeId, start: g.start, score: g.score });
  if (!line) continue;
  used++;
  const won = [h > a, h === a, h < a];
  for (const p of line.points.slice(0, -1)) {
    const q = [p.home, p.draw ?? 0, Math.max(0, 1 - p.home - (p.draw ?? 0))];
    n++;
    ll -= Math.log(Math.max(1e-4, q[won.indexOf(true)]));
    br += q.reduce((s, x, i) => s + (x - won[i]) ** 2, 0);
    q.forEach((x, i) => {
      const b = cal[Math.min(9, Math.floor(x * 10))];
      b.n++;
      b.p += x;
      b.y += won[i];
    });
  }
}
console.log({ games: used, logloss: +(ll / n).toFixed(4), brier: +(br / n).toFixed(4), calibration: cal.map(b => (b.n ? `${Math.round((b.p / b.n) * 100)}→${Math.round((b.y / b.n) * 100)}` : '')).join(' ') });
