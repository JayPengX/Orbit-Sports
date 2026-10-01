# Quadra Fixtures

A related add-on of Quadra: the scores, schedules, match details, standings,
teams and players of every league you can watch in Taiwan on ELTA.tv
(愛爾達) or Apple TV, a day planned around the sports you follow, and one tap
to watch a game in the ELTA.tv (or Apple TV) app.

**https://jaypengx.github.io/Quadra-Fixtures/**

## What's in it

Four tabs (the kit's tab bar; each keeps its place, and a tap on the open
one scrolls it to the top), with help, refresh and the account at the top
right:

- **首頁 Home**: any day (a strip from three days back to a week ahead),
  every match of it ranked for you: a no-clash plan of the best (with the
  reasons), then every other match in order ("show more"). Filters: all,
  what you follow, your teams only, or one sport. Your teams' next or last
  game (today). Games on now first, each with 觀看.
- **賽事 Matches**: every sport and league. Team sports open on the game day
  nearest to now (a live one first) with the same date strip as 首頁 (the league's game days, more of them as
  it's scrolled near either end, and 📅 for any day);
  a filter by stage when the season has more than one (preseason, playoffs,
  the NBA Cup…). F1 shows its whole season, a card per
  weekend with its country's flag: live, coming up and results.
- **直播 Live**: everything in progress now (followed first), each with a
  觀看 button that opens the game's channel in the ELTA.tv app (or Apple TV's
  MLS), what starts in the next hours, and ELTA's guide for the next 12
  hours. The tab shows the live count.
- **追蹤 Following**: your sports in priority order; for each followed league
  its live and next games, latest results, your teams and the top of the
  table; the players you follow (individual sports).
- **Tables** (in 賽事, a league's table view) for every league that has one,
  with the gap to the top (points behind the leader, or games behind), full
  team names where they fit and the short ones on a phone.
- **Match sheets**: score, stage and playoff series ("Series tied 1-1"),
  觀看 when it's on, line score, then the overview, team stats (each
  side's own bar against the larger value, so averages and rates read
  right), player box scores, plays, line-ups and the table.
- **Where to watch in Taiwan** (`lib/broadcast.mjs`, checked 2026-10): ELTA.tv
  and Apple TV only, and only their leagues. A game's exact channel from
  ELTA's own schedule (two weeks ahead), with its commentary (英文原音, 中文,
  雙語: a 體育台 unless said otherwise) and ads; an NBA game also from NBA.com's Taiwan schedule (the
  whole season: which games ELTA has, one or two a day). ESPN's US networks
  aren't shown.
- **Stages** (`lib/stage.mjs`): preseason, regular season, NBA Cup, All-Star,
  play-in, playoffs with their rounds in Chinese (外卡賽, 分區系列賽…), finals.
- **Teams and players**: place and key figures, schedule, results, roster,
  follow. F1 drivers and teams get their pages too (formula1.com's figures,
  each weekend), and can be followed.
- **Notices**: a followed team's game starting and its final score.

## Today's picks

Each match of the day is scored from: your sports' order (the first counts
most) and followed leagues; a followed team (the strongest signal); both
sides' places in the table (quality, how even they are, a meeting at the
top); a big game (final, play-off, series, derby); fame (headline league,
a final); what you open and follow (this app's affinity); and live or starting soon. The plan takes the
best match, then the best that doesn't clash with those already in (each
sport's usual length), and lists them by time, each with its reasons.

Leagues (the ones on ELTA.tv or Apple TV in Taiwan): baseball (MLB, CPBL),
basketball (NBA), soccer (Premier League, Serie A, Bundesliga, Ligue 1,
Scottish Premiership, FA Cup, Champions League, Europa League, Conference
League, Nations League; MLS on Apple TV) and racing (F1). The list is
`BROADCAST` in `public/lib/broadcast.mjs`; `public/lib/leagues.mjs` takes
those of the shared catalogue.

## How it works

A static site (GitHub Pages) with no build step.

- Data comes from ESPN's site API (CPBL's own site for its
  games; ELTA's schedule and NBA.com's Taiwan schedule for where to watch),
  read through the Quadra data proxy
  (`sports-proxy.pengzjay.workers.dev`, in Shared-Proxy), which needs the
  Quadra Pass session token (`lib/espn.mjs`), with the kit's `proxyJson`:
  lists asked for together go as one batch, and answers are kept on the
  device for their lifetime, so reopening the app doesn't ask again. The
  last day read and the follows are kept too: a signed-in phone opens on
  them at once while fresh ones load.
- A Quadra Pass is required: the sign-in, the account button, the account sheet
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
  app.js            tabs: Home, Matches, Live, Following; follows
  sheets.js         match, event, team and player sheets; standings tables
  ui.js             shared DOM helpers, rows, days and times
  lib/leagues.mjs   every league: sport, source, Play key, kind
  lib/espn.mjs      fetching and parsing scoreboards, calendars, summaries, standings, teams, players
  lib/picks.mjs     the day's picks: scoring and the no-clash plan
  lib/stage.mjs     season stages and playoff rounds
  lib/broadcast.mjs where to watch in Taiwan: the leagues, ELTA's and NBA.com's schedules
  lib/tv.mjs        reading those schedules, and each game's channels
  lib/days.mjs      the nearest game day
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
