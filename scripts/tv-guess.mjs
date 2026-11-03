// How good the guess past ELTA's list is (the kit's eltaGuess, through
// broadcastsFor): an older list guesses the games a later one has past its
// end, as the app does past today's list. Two pairs of ELTA's real lists
// (tests/fixtures/elta-*.json): 10/1's (to 10/16) guessing 10/8's last week
// (10/17–10/23), and 10/8's (to 10/23) guessing 11/3's (10/31–11/18, 8 to 26
// days past it, and over Europe's change of clocks).
//   node scripts/tv-guess.mjs [seasons-dir]   (the family's season packs, read from /data once into the dir)
// → per league: taken as on against carried (games ELTA had, games it hadn't
// and were guessed on), and the channel guessed against the channels ELTA
// gave it (a hit when it's one of them), beside the league's most used channel.
import fs from 'node:fs';
import { parseElta, eltaDays, eltaListed, eltaPrograms, broadcastsFor, eltaGuess, withEltaNames, ALT_VIEW } from '#kit/sports-broadcast.mjs';
import { parseScoreboard } from '#kit/sports-espn.mjs';
import { teamNameZh } from '#kit/names.mjs';
import { LEAGUES } from '../public/lib/leagues.mjs';

const DIR = process.argv[2] || '/tmp/orbit-seasons';
const FIX = new URL('../tests/fixtures/', import.meta.url);
const list = day => parseElta(JSON.parse(fs.readFileSync(new URL(`elta-${day}.json`, FIX))));
const PAIRS = [
  ['2026-10-01', '2026-10-08'],
  ['2026-10-08', '2026-11-03']
];
const LGS = ['epl', 'seriea', 'bundesliga', 'ligue1', 'ucl', 'uel', 'uecl', 'scotland', 'nationsleague', 'nba'];
fs.mkdirSync(DIR, { recursive: true });
const games = [];
for (const l of LGS) {
  const file = `${DIR}/${l}.json`;
  if (!fs.existsSync(file)) {
    const r = await fetch(`https://api.jaypengx.com/data/sports/${l}/2026.json`, { headers: { Origin: 'http://localhost:8123' } });
    fs.writeFileSync(file, await r.text());
  }
  games.push(...parseScoreboard(JSON.parse(fs.readFileSync(file, 'utf8')), l, { lang: 'zh' }).filter(e => !e.status?.void));
}
const zhSides = e => {
  const l = LEAGUES[e.league];
  return [e.home, e.away].map(s => {
    const zh = teamNameZh(l?.play || e.league, s?.en || s?.name, l?.sport);
    return withEltaNames([s?.name, s?.short, zh?.full, zh?.short].filter(Boolean));
  });
};
const twDay = ms => new Date(ms + 8 * 3_600_000).toISOString().slice(0, 10);
const byLeague = l => games.filter(o => o.league === l);
// The league's most used channel in the old list (the plain guess to beat).
const most = (OLD, l) => {
  const n = new Map();
  for (const p of OLD) if (p.league === l && p.ch < 980 && !ALT_VIEW.has(p.audio)) n.set(p.ch, (n.get(p.ch) || 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0];
};
const rows = [];
for (const l of LGS) {
  const s = { league: l, carried: 0, off: 0, onHit: 0, onMiss: 0, falseOn: 0, chHit: 0, chN: 0, plain: 0, sureN: 0, sureHit: 0, missed: [] };
  for (const [old, now] of PAIRS) {
    const OLD = list(old);
    const NEW = list(now);
    const days = eltaDays(NEW);
    const end = eltaDays(OLD).to;
    for (const e0 of byLeague(l)) {
      const day = twDay(Date.parse(e0.start));
      if (day <= end || day <= days.from || day > days.to || !eltaListed(NEW, e0)) continue;
      // As it was before the game: not over yet.
      const e = { ...e0, status: { state: 'pre' } };
      const others = games.map(o => ({ ...o, status: { state: 'pre' } }));
      const truth = [
        ...new Set(
          eltaPrograms(NEW, e, zhSides(e), others, zhSides)
            .filter(p => p.ch < 980 && !ALT_VIEW.has(p.audio))
            .map(p => p.ch)
        )
      ];
      const guess = l === 'nba' ? (truth.length ? eltaGuess(e, OLD, { on: true }) : null) : broadcastsFor(e, OLD, { sides: zhSides(e), others, sidesOf: zhSides }).find(b => b.guess);
      if (truth.length) s.carried++;
      else s.off++;
      if (truth.length && guess) s.onHit++;
      else if (truth.length) s.onMiss++;
      else if (guess) s.falseOn++;
      if (truth.length && guess) s.chN++;
      if (truth.length && guess?.ch) {
        s.sureN++;
        if (truth.includes(guess.ch)) s.sureHit++;
        else if (s.missed.length < 4) s.missed.push(`${day} ${e.home.name}-${e.away.name}: ${guess.ch} not ${truth.join('/')}`);
        if (truth.includes(most(OLD, l))) s.plain++;
      }
    }
  }
  rows.push(s);
}
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '–');
console.log("league        carried  off  taken on (of carried)  wrongly on (of off)  channel named  named right  league's usual channel");
for (const s of rows)
  console.log(
    `${s.league.padEnd(14)}${String(s.carried).padStart(7)}${String(s.off).padStart(5)}  ${`${s.onHit} ${pct(s.onHit, s.carried)}`.padStart(21)}  ${`${s.falseOn} ${pct(s.falseOn, s.off)}`.padStart(19)}  ${`${s.sureN}/${s.chN}`.padStart(13)}  ${`${s.sureHit} ${pct(s.sureHit, s.sureN)}`.padStart(11)}  ${pct(s.plain, s.sureN).padStart(9)}`
  );
const sum = k => rows.reduce((n, s) => n + s[k], 0);
console.log(
  `all: taken on ${pct(sum('onHit'), sum('carried'))} of the games ELTA had, wrongly on ${pct(sum('falseOn'), sum('off'))} of the rest; a channel named for ${sum('sureN')} of ${sum('chN')}, right ${sum('sureHit')} ${pct(sum('sureHit'), sum('sureN'))} (the league's usual channel ${pct(sum('plain'), sum('sureN'))})`
);
if (process.argv.includes('--misses')) for (const s of rows) for (const m of s.missed) console.log(' ', s.league, m);
