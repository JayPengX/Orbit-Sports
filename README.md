# Quadra Fixtures

The sports data centre of Quadra: every supported sport's scores, schedules,
match details, standings, teams and players, a day planned around the sports
you follow, and the way into
[Quadra Play](https://jaypengx.github.io/Quadra-Play/) for any match it sells.

**https://jaypengx.github.io/Quadra-Fixtures/**

## What's in it

- **Today**: Today's picks, a plan of the day's best matches for you with no
  time clashes (`lib/picks.mjs`), what else is worth a look, live now, your
  teams' next or last game, your open bets in Play, and today's games in
  your leagues, in your order.
- **Scores**: every sport and league; the date strip lists only the days a
  league plays (from ESPN's season calendar, then the viewer's own days),
  with the latest and next rounds even across a break; more with ‹ and ›.
- **Following**: your sports in priority order; for each followed league its
  live and next games, latest results, your teams and the top of the table.
  "Edit follows" orders sports, picks leagues and removes teams.
- **Match sheets**: score, line score and the Bet in Play link, then the
  overview (the two sides compared: record, place, key table figures, form;
  win probability; each side's leaders; season series; injuries; match
  info), team stats, player box scores, plays, line-ups and the table.
- **Teams and players**: place and key figures, schedule, recent results,
  roster, follow; player bio and season stats.
- **Standings** for every league that has a table, followed ones first.
- **Notices**: a followed team's game starting and its final score.

## Today's picks

Each match of the day is scored from: your sports' order (the first counts
most) and followed leagues; a followed team (the strongest signal); both
sides' places in the table (quality, how even they are, a meeting at the
top); a big game (final, play-off, series, derby); fame (headline league,
national TV, ranked sides); what you open, follow and bet on in every Quadra
app (the shared affinity map); and live or starting soon. The plan takes the
best match, then the best that doesn't clash with those already in (each
sport's usual length), and lists them by time, each with its reasons.

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
- What you follow is this app's payload on the pass
  (`{ v: 3, sports, leagues, follows }`, sports in priority order), with a
  copy in the wallet (setting `follow:match`, Play's league keys) so Quadra
  Play recommends from the same follows. What you open and follow also feeds
  the pass's shared interests.

```
public/
  index.html, styles.css, sw.js, manifest.webmanifest
  app.js            tabs: Today, Scores, Following, Standings; follows
  sheets.js         match, event, team and player sheets; standings tables
  ui.js             shared DOM helpers, rows, days and times
  lib/leagues.mjs   every league: sport, source, Play key, kind
  lib/espn.mjs      fetching and parsing scoreboards, calendars, summaries, standings, teams, players
  lib/picks.mjs     Today's picks: scoring and the day's plan
  lib/foryou.mjs    the keys a match is about (shared with Play)
  lib/i18n.mjs      Traditional Chinese and English
  lib/quadra.mjs    shared Quadra kit (copy)
```

## Develop

```
npm test                          # parsers, calendars, leagues, picks
python3 -m http.server -d public  # then open http://localhost:8000
```

Pushing to `main` runs the tests, stamps a cache-busting version on every
file (`scripts/stamp-version.mjs`) and deploys `public/` to Pages.
