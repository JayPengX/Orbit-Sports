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

## What it does

- **Today:** what's on now, a no-clash pick of the day's best games, and your teams.
- **Every league on ELTA or Apple TV:** MLB, CPBL, NBA, the big European soccer leagues, MLS and F1.
- **Match pages:** live score, win chance chart, line-ups, box score, standings and stat leaders.
- **F1 live board:** timing, tyres, lap times and every car moving on the track map.
- **Notices** when a team you follow starts or finishes, even with the app closed.

## Stack

- Plain JavaScript (ES modules), HTML and CSS: no framework, no build step, no runtime dependencies.
- An installable phone web app (Add to Home Screen), cached by a service worker.
- The look, sign-in (the Orbit Pass) and notices come from the shared kit in [Shared-Proxy](https://github.com/JayPengX/Shared-Proxy).
- Live data goes through the Orbit proxy on Cloudflare Workers (`api.jaypengx.com`). Scores from ESPN and each league's own feeds; seasons kept in Cloudflare R2.
- Hosted on GitHub Pages and served at jaypengx.com by a Cloudflare Worker; every push to `main` tests and deploys.

## For developers

```bash
npm test
```

How it works, file by file, and the decisions still in force: **[MAP.md](MAP.md)**.
