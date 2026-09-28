# Quadra Fixtures

The sports data centre of Quadra: every supported sport's scores, schedules,
match details, standings, teams, players and news, and the way into
[Quadra Play](https://jaypengx.github.io/Quadra-Play/) for any match it sells.

**https://jaypengx.github.io/Quadra-Fixtures/**

## What's in it

- **Home**: For you (matches ranked by the shared Quadra engine from what
  you follow, open and bet on in any Quadra app), live now, your followed
  teams' next or last game, your open bets in Play, and today's games by league.
- **Scores**: every sport and league, day by day (races, tournaments and
  fight cards show their current event).
- **Match sheets**: score and line score, the Bet in Play link, then
  overview (win probability, leaders, form, season series, injuries, venue,
  officials, news), team stats, player box scores, plays, line-ups and table.
- **Teams and players**: schedule, recent results, roster, follow; player
  bio, season stats and news.
- **Standings** and **News** for every league that has them.

Sports: soccer (about 45 leagues and cups), baseball (MLB, NPB, KBO, CPBL),
basketball (NBA, WNBA, NCAA, EuroLeague, B.League), NFL and college football,
NHL, ATP/WTA tennis, F1/IndyCar/NASCAR, PGA/LPGA golf, UFC, NRL, AFL,
badminton, table tennis, volleyball and snooker. The list is in
`public/lib/leagues.mjs`.

## How it works

A static site (GitHub Pages) with no build step.

- Data comes from ESPN's site API (Kambi's list views for the leagues ESPN
  doesn't carry), read through the Quadra data proxy
  (`sports-proxy.pengzjay.workers.dev`, in Shared-Proxy), which needs the
  Quadra Pass session token (`lib/espn.mjs`).
- A Quadra Pass is required: the sign-in, the balance chip, the account sheet
  and the one-app-at-a-time session are the shared kit
  (`public/lib/quadra.mjs` and `public/quadra.css`, copied from
  `Shared-Proxy/kit` by `node kit/sync.mjs`; don't edit the copies).
- Followed teams are this app's payload on the pass (`{ v: 2, follows }`);
  what you open and follow feeds the pass's shared interests, so Play and
  the other apps rank the same teams higher too.

```
public/
  index.html, app.js, styles.css, sw.js, manifest.webmanifest
  lib/leagues.mjs   every league: sport, source, Play key, kind
  lib/espn.mjs      fetching and parsing scoreboards, summaries, standings, teams, players, news
  lib/foryou.mjs    For you ranking
  lib/i18n.mjs      Traditional Chinese and English
  lib/quadra.mjs    shared Quadra kit (copy)
```

## Develop

```
npm test                          # parsers, leagues, ranking
python3 -m http.server -d public  # then open http://localhost:8000
```

Pushing to `main` runs the tests, stamps a cache-busting version on every
file (`scripts/stamp-version.mjs`) and deploys `public/` to Pages.
