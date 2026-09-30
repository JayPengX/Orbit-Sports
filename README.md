# Quadra Fixtures

The sports data centre of Quadra: every supported sport's scores, schedules,
match details, standings, teams and players, a day planned around the sports
you follow, and the way into
[Quadra Play](https://jaypengx.github.io/Quadra-Play/) for any match it sells.

**https://jaypengx.github.io/Quadra-Fixtures/**

## What's in it

Four tabs (the kit's tab bar; each keeps its place, and a tap on the open
one scrolls it to the top), with help, refresh and the account at the top
right:

- **首頁 Home**: any day (a strip from three days back to a week ahead),
  every match of it ranked for you: a no-clash plan of the best (with the
  reasons), then every other match in order ("show more"). Filters: all,
  what you follow, your teams only, or one sport. Your teams' next or last
  game and your open bets in Play (today).
- **賽事 Matches**: every sport and league. Team sports open on the game day
  nearest to now (a live one first) with a strip of the league's game days;
  a filter by stage when the season has more than one (preseason, playoffs,
  the NBA Cup…). Races, tours and fight promotions show their whole season:
  live, coming up (every future event, e.g. the rest of the F1 calendar) and
  results.
- **直播 Live**: everything in progress now, by sport (followed first), and
  what starts in the next three hours. The tab shows the live count.
- **追蹤 Following**: your sports in priority order; for each followed league
  its live and next games, latest results, your teams and the top of the
  table; the players you follow (individual sports).
- **Tables** (in 賽事, a league's table view) for every league that has one,
  with the gap to the top (points behind the leader, or games behind), full
  team names where they fit and the short ones on a phone.
- **Match sheets**: score, stage and playoff series ("Series tied 1-1"),
  line score, the Bet in Play link, then the overview, team stats (each
  side's own bar against the larger value, so averages and rates read
  right), player box scores, plays, line-ups and the table.
- **Where to watch in Taiwan** (`lib/broadcast.mjs`, checked 2026-09): ELTA
  (愛爾達), Videoland (緯來), DAZN, Sportcast (博斯), league passes… on match
  sheets, pick cards and the matches tab. ESPN's US networks aren't shown.
- **Stages** (`lib/stage.mjs`): preseason, regular season, NBA Cup, All-Star,
  play-in, playoffs with their rounds in Chinese (外卡賽, 分區系列賽…), finals.
- **Teams and players**: place and key figures, schedule, results, roster,
  follow. Individual sports (tennis, golf, F1, UFC) get a player page too:
  country, age, plays, division, season numbers and rankings, the next
  fight, recent events, and a follow button; names in draws, fields, fight
  cards and the drivers' table open it.
- **Into Quadra Play**: a small outlined 投注 chip (場中 while it's on) on
  every game Play sells, opening that game there; on the match sheet, a
  Quadra Play card (投注這場比賽, with the boost and cash-out pitch).
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

Sports: soccer (each nation's first tier, the European, South American and
Asian club competitions, the Asian Cup and the national teams), baseball
(MLB, NPB, KBO, CPBL), basketball (NBA, WNBA, EuroLeague, Liga ACB, NBL,
B.League), NFL and college football, NHL, ATP/WTA tennis, F1, PGA/LPGA golf,
UFC, international rugby union, badminton, and the pro events of table
tennis and volleyball, and snooker. The list is in
`public/lib/leagues.mjs`.

## How it works

A static site (GitHub Pages) with no build step.

- Data comes from ESPN's site API (Kambi's list views for the leagues ESPN
  doesn't carry), read through the Quadra data proxy
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
  lib/broadcast.mjs where to watch in Taiwan, by league
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
