<p align="center">
  <img src="public/icons/icon-192.png" width="96" height="96" alt="">
</p>

<h1 align="center">Orbit Sports</h1>

<p align="center">
  <b>Every game, live.</b><br>
  <a href="https://jaypengx.com/sports/"><b>jaypengx.com/sports</b></a>
</p>

<p align="center">
  <img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-ES_modules-F7DF1E?logo=javascript&logoColor=000"> <img alt="PWA" src="https://img.shields.io/badge/PWA-works_offline-5A0FC8?logo=pwa&logoColor=fff"> <img alt="Cloudflare" src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=fff"> <img alt="GitHub" src="https://img.shields.io/badge/GitHub-Pages-24292F?logo=github&logoColor=fff"> <img alt="Tests" src="https://img.shields.io/badge/Tests-node_--test-339933?logo=nodedotjs&logoColor=fff">
</p>

Scores, schedules and stats for the leagues you can watch in Taiwan, with a plan for your day and one tap to watch. Part of **Orbit**, a family of phone apps for life in Taiwan that share one sign-in, the Orbit Pass. See them all at [jaypengx.com](https://jaypengx.com/).

<p align="center">
  <img src="docs/screenshots/sports-1.webp" width="240" alt="Today">
  <img src="docs/screenshots/sports-2.webp" width="240" alt="A league">
  <img src="docs/screenshots/sports-3.webp" width="240" alt="On TV">
</p>

## Features

- **Today:** a sticky date strip, what's on now, a no-clash plan of the day's best games, your own teams' games, and what already finished.
- **Only what you can watch here:** MLB and CPBL, the NBA, the Premier League, Serie A, Bundesliga, Ligue 1, the UEFA cups, MLS on Apple TV, and every F1 session. A league out of season hides itself.
- **Match pages:** live score and line score, a win-chance chart with key moments, line-ups, box score, play by play, injuries, standings and season leaders, ordered by the moment of the game.
- **F1 live board:** F1's own timing in tabs (order, track, tyres, lap times, points), every car moving on the track map, race control in Chinese.
- **Live tables:** standings count results the moment a game ends, with a title line ("前 8 名，或 Russell、Hamilton 都沒贏") and magic numbers.
- **Playoffs:** real brackets, or ones predicted from the table while the season runs; the NBA Cup's groups and knockout.
- **Where to watch:** ELTA's own schedule (exact channel and commentary), NBA.com's ELTA list and Apple TV's MLS pages, plus replays and highlights.
- **Follow** teams, players, leagues and drivers; get a notice when a game starts or ends, even with the app closed.
- **Chinese first**, English second; teams in Chinese, players in their own names.

## Tech stack

| Layer | What |
| --- | --- |
| App | Plain JavaScript (ES modules), HTML and CSS; no framework, no build step, no dependencies |
| Platform | Installable web app (Add to Home Screen) with a service worker; phones from 320 to 440 px |
| Shared | The look, the Orbit Pass sign-in, notices and data reads come from the kit in [Shared-Proxy](https://github.com/JayPengX/Shared-Proxy) |
| Data | ESPN, MLB's API, CPBL, F1 timing, Jolpica, FotMob and ELTA, all through the Orbit proxy on Cloudflare Workers; seasons and finished games kept in Cloudflare R2 |
| Hosting | GitHub Pages, served at jaypengx.com by a Cloudflare Worker |
| Tests | `node --test` (about 50 test files on the logic: tables, picks, playoffs, F1, live state) |

## How it works

```
phone ── public/ (this repo, GitHub Pages) + the kit (Shared-Proxy's Pages)
  │  kit proxyJson: memory → the phone's cache → R2 packs → the proxy's edge cache → upstream
  ▼
api.jaypengx.com (Cloudflare Worker) ── ESPN · MLB · CPBL · F1 timing · FotMob · ELTA · …
```

- **One rule, one function.** A game's state (`sessionStatus`, `overByRule`) and the live table (`lib/title.mjs liveTable`) are each one function that every screen reads, so the home card, the TV guide and the standings never disagree.
- **Refresh in place.** Lists refresh every 5 s, an open game every 3 s, F1 every 4 to 15 s; values change in place, the page never redraws.
- **Picks** (`lib/picks.mjs`) weigh the leagues and teams you follow, closeness, stakes and what's on TV, then pick the best game and the best that doesn't clash.
- **Offline:** the app says it's offline rather than show old scores as live.

The full map, file by file, and the decisions still in force: **[MAP.md](MAP.md)**.

## Project structure

```
public/
├── index.html, app.js     the tabs, follows, days, picks, notices, live ticks
├── sheets.js              every sheet: match, race weekend, team, player, tables
├── cards.js, ui.js        cards, tiles and DOM helpers
├── styles.css             the app's own look on top of the kit's
├── lib/                   36 modules: ESPN reads, F1, tables and title race,
│                          playoffs, leaders, picks, TV, win chance, live state
├── sw.js                  the service worker (the kit's, with this app's settings)
└── icons/, share/, img/   icons and share cards
scripts/                   NBA-on-ELTA list, ESPN label audit, version stamp
tests/                     node --test
MAP.md                     how it works, file by file
```

## Getting started

The app loads the shared kit from a sibling folder, so clone this repo next to [Shared-Proxy](https://github.com/JayPengX/Shared-Proxy):

```bash
git clone https://github.com/JayPengX/Shared-Proxy.git
git clone https://github.com/JayPengX/Orbit-Sports.git
cd Orbit-Sports
```

Requirements: Node.js 22 or newer. There is nothing to install: no framework, no `node_modules`.

```bash
npm test   # links ../Shared-Proxy/kit as .kit, then runs node --test
```

See it on a phone-sized screen, signed in with a made-up wallet and real data (needs Playwright):

```bash
# a screenshot, saved in /tmp/orbit-preview
node ../Shared-Proxy/tools/preview.mjs sports --live --width 375
# serve it, then open http://localhost:8123/Orbit-Sports/
node ../Shared-Proxy/tools/preview.mjs sports --live --serve --port 8123
```

`--dark`, `--lang en`, `--webkit` (Safari's engine) and the other flags are listed in [Shared-Proxy/tools/README.md](https://github.com/JayPengX/Shared-Proxy/blob/main/tools/README.md).

`node scripts/label-audit.mjs` lists any ESPN stat label still missing a Chinese name.

## Deploying

Push to `main`. GitHub Actions runs the tests, writes `nba-elta.json`, stamps every file with its content hash (so a phone downloads only what changed) and publishes `public/` to GitHub Pages; the site Worker serves it at its jaypengx.com address. It also runs every 6 hours. There are no pull requests or release branches.

## Part of Orbit

| App | What it is |
| --- | --- |
| [Orbit Sports](https://github.com/JayPengX/Orbit-Sports) | Every game you can watch in Taiwan, live |
| [Orbit Transit](https://github.com/JayPengX/Orbit-Transit) | Bus, train, metro and YouBike, planned and navigated |
| [Orbit Weather](https://github.com/JayPengX/Orbit-Weather) | One clear forecast, to the township |
| [Orbit Words](https://github.com/JayPengX/Orbit-Words) | English vocabulary that stays |
| [Orbit Securities](https://github.com/JayPengX/Orbit-Securities) | A Taiwan broker on play money |
| [Orbit Class](https://github.com/JayPengX/Orbit-Class) | Today's classes at a glance |
| [Orbit Beats](https://github.com/JayPengX/Orbit-Beats) | Endless music and your own beats |
| [Orbit Law](https://github.com/JayPengX/Orbit-Law) | Laws, rulings and bills, linked |
| [Orbit Money](https://github.com/JayPengX/Orbit-Money) | Your own books |
| [Shared-Proxy](https://github.com/JayPengX/Shared-Proxy) | The kit, the Orbit Pass and the Workers behind them all |

How it was all built, in pictures and numbers: [jaypengx.com/showcase](https://jaypengx.com/showcase/).
