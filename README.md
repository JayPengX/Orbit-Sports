# Orbit Sports

What a viewer in Taiwan would watch: every league on ELTA.tv (愛爾達) or
Apple TV, with scores, schedules, match details, standings, teams and
players; a day planned around what you follow; one tap to watch. F1 has
its own live board from F1's timing. Signs in with the Orbit Pass.

Live: https://jaypengx.github.io/Orbit-Sports/

## Leagues

Only what's on TV here (`lib/broadcast.mjs`; leagues from
`kit/catalog.mjs` via `lib/leagues.mjs`):

- **Baseball:** MLB; CPBL (ELTA's selected games).
- **Basketball:** NBA (ELTA's selected games).
- **Soccer on ELTA:** Premier League, Serie A, Bundesliga, Ligue 1,
  Scotland, FA Cup, the three UEFA cups, Nations League.
- **Soccer on Apple TV:** MLS (every game).
- **Racing:** F1 (every session).

A league out of season is hidden (checked, kept 12 h). A league that
couldn't be read is shown, never hidden.

## How it works

- **Tabs, one question each:**
  - **首頁:** what to watch. A date strip that sticks at the top (swipe
    the page for the next or last day), 正在進行, 推薦 (a no-clash plan), 我的比賽, 更多賽事,
    已結束, followed teams today.
  - **賽事:** a league. Sport and league chips, game days, then 賽程, 排名,
    季後賽, 數據領先.
  - **轉播:** when and where. The same date strip (yesterday to two weeks
    on). Today: on now with 觀看, yours in the next 7 days, the next 24 h,
    ELTA's whole guide; another day: its best game, then all it has on TV.
  - **追蹤:** how yours are doing. Teams, players, matches, drivers; 設定
    at its foot (leagues in order, follows, commentary).
- **Sheets** (full height):
  - **A match:** header and line score, a live panel, then sections drawn
    once in an order set by the game's moment: 概況, 數據, 球員, 過程, 先發,
    場上球員, 陣容, 傷兵, 本季數據領先, 排名, 比賽資訊. Every sport shares one
    先發陣容 card, one 陣容 card per side (先發 or 打序, 替補, then 未上場 or
    傷兵 in the injury report's rows) and one 傷兵 list (three, then 全部).
  - **A race weekend.**
  - **A team:** 賽程, 戰績, 陣容, 數據領先 with 隊內排行, 排名.
  - **A player:** 概況 with 聯盟排名, 數據, 近期比賽, 資料; opened from a
    game, its 本場 line.
  - **An F1 constructor.**
- **數據領先** (`lib/leaders.mjs`):
  - Basketball's 12 stats and baseball's 23 come from ESPN's whole-league
    list; rates only among qualified players.
  - Football's 23 come from FotMob; F1's 9 are counted from the season's
    results.
  - A team page ranks its own players; a player page shows their league
    ranks; a match shows each side's season leaders.
- **Win chance:** ESPN's line, else Polymarket's. Soccer on or over is
  worked out here (`lib/soccerwp.mjs`): each side's goals a Poisson count
  over the time left, its rate from the odds before the start (ESPN's or
  the sportsbook's, else the market's first price), from the score, the
  minute and red cards; every competition gets it, and a late level game
  is a draw's. A chart with key moments
  while on or over; a split bar before. Each side in its colour, its
  chance written in it (`wpline.mjs sideColors`: two alike, or none, and
  one takes a spare colour); a draw grey.
- **F1 live board:** F1's own timing (`f1-live`), in tabs 排名 · 賽道 · 輪胎 ·
  圈速 · 積分. Race control in Chinese by rule (`lib/racecontrol.mjs`). 賽道
  is 車手比較 on the track: one pick of up to four drivers (their faces on
  the map, a tap on a car adds it), every car always moving at its own pace
  between reads and in race order by its gap to the leader
  (`lib/carpace.mjs`), then the drivers side by side. The win chance goes by
  lap while a race runs too (each lap's end counted from the feed and the
  leader's lap times), with its leads, stops and the start's own swing.
- **勝負未定** (close finish): a live game in its last stretch and within reach (NBA 4th or OT, MLB 8th–9th, soccer from the 80th).
- **Tables count results at once** (`lib/title.mjs liveTable`,
  `liveRacing`, `freshStandings`), on every page with a table: finals
  only, never a game still on. The title
  line says the lead the leader takes at the soonest clinch.
- **Playoffs** (`lib/playoffs.mjs`, `bracket.mjs`): real ties, predicted
  from the table while the season runs, or last season's. The NBA Cup
  (`lib/nbacup.mjs`) beside the NBA's: its groups, found from who meets whom
  in group play (no feed names them, so no letters), first and best second
  marked, and its knockout; chips in 季後賽, an NBA 盃 tab on a cup game (a
  group game's group, a knockout game's bracket); last season's until this
  season's group play is on the schedule.
- **Where to watch** (`lib/tv.mjs`): ELTA's own schedule (exact channel,
  commentary, MAX first); NBA.com's ELTA list (`public/nba-elta.json`,
  written every 6 h by the deploy); Apple TV's page per MLS game. Replays
  and highlights from `watch.json` (R2).
- **A league followed as a league** (none of its teams or players
  followed; `picks.mjs leagueChoices`): of its games starting within the
  hour of one another, the best matchup on TV here (table, odds, stakes,
  big clubs; the channel only breaks an even tie) counts as a followed
  team's game: picks, the hero, 我的比賽, 你的轉播, start and final notices.
  Never a game from midnight to 05:00 (those stay in 更多賽事).
  F1 followed that way: its qualifying, sprint and race. A league with a
  team or player of it followed goes by those.
- **Today's picks** (`lib/picks.mjs`): followed leagues and teams, quality,
  closeness, stakes, fame, habit, ELTA's featured game, live now. The best
  game, then the best that doesn't clash.
- **Notices** (the kit's `match` kinds): a followed team's start and final,
  each pick's start and final, F1 sessions and podiums. Sent by the Worker
  while the app is closed.
- **Data:** ESPN through the sports proxy (`lib/espn.mjs getJson` → the
  kit's `proxyJson`). Seasons and game days come from R2 packs; finished
  games are kept in R2 on first read. MLB's API, CPBL's site, F1 timing,
  Jolpica, formula1.com, FotMob and Polymarket are all read through the
  proxy.
- **Refresh** (owner-set speeds): lists 5 s, an open game 3 s, F1 4–15 s;
  today whole every 2 minutes. Values change in place (`morph`), never a
  redraw.
- **Offline:** covered (`onlineOnly`); never old scores as now.
- **Saved:** the Pass payload `{ v: 4, leagues, follows, games, audio, t }` (copied
  to the wallet for Play's recommendations); on the phone `fx.day.v4`,
  `fx.active.v2`, `fx.f1live.v2`, `fx.f1ended`.

## Decisions in force

- Picks are only games on TV here, 05:00 to midnight. In the small hours:
  every game of your own leagues, plus one big game of any other.
- A followed league is never hidden by a failed read.
- A game is over the moment the rules say so (`overByRule`), not when
  ESPN marks it. 比賽資訊 says when it ended.
- A past page shows its own moment, not today's points on top.
- Table zones stay with their places as results reorder them.
- No news and no AI in Sports. The injury report is on team pages only.
- Players and F1 drivers are named in English, in both languages (never 勒布朗·詹姆斯); teams in Chinese.
- A called-off game opens nothing (延期 in its place).
- The kit's `sports-*.mjs` (highlights, broadcast, win probability) are run
  by the proxy's builders too, so they import nothing but each other.

## Files (`public/`)

| File | What |
| --- | --- |
| `app.js` | The tabs, follows, days, picks, notices, live ticks |
| `sheets.js` | Every sheet: match, race weekend, team, player, constructor, tables, series |
| `ui.js`, `cards.js`, `styles.css` | DOM helpers, rows; the tabs' cards and tiles; the look |
| `lib/espn.mjs` | Every read and parser (the scoreboard parser is the kit's `sports-espn.mjs`); `sessionStatus` |
| `lib/f1.mjs`, `racecontrol.mjs` | F1 data and the board's maths; race control in Chinese |
| `lib/title.mjs`, `playoffs.mjs`, `bracket.mjs` | Live tables and title race; playoffs |
| `lib/leaders.mjs` | 數據領先: stats, ranks, team and player |
| `lib/picks.mjs`, `foryou.mjs` | Today's picks; affinity (shared with Play) |
| `lib/broadcast.mjs`, `tv.mjs`, `highlights.mjs` | Where to watch (the kit's, shared with the proxy); channels; videos |
| `lib/winprob.mjs`, `soccerwp.mjs`, `wpline.mjs`, `moments.mjs` | Win chance line and key moments |
| `lib/live.mjs`, `lineups.mjs`, `onfield.mjs`, `mlb.mjs`, `cpblbox.mjs` | Live state; starters (MLB's own, the NBA's from RotoWire through the proxy: ESPN's core API refuses it); who's on; MLB and CPBL fill-ins |
| `lib/leagues.mjs`, `search.mjs`, `statnames.mjs`, `stage.mjs`, `compname.mjs`, `i18n.mjs`, `text.mjs` | Leagues; search; Chinese names for stats, stages and competitions; text |
| `lib/days.mjs`, `bounds.mjs`, `strip.mjs`, `retry.mjs` | Days on the viewer's clock; the days a league has; the date strip; failed reads tried again |
| `lib/close.mjs`, `notice.mjs` | 拉鋸; what a change of state is for a notice |

## Run and test

```bash
npm test
```

```bash
node ../Shared-Proxy/tools/preview.mjs sports --live --width 375
```

`scripts/label-audit.mjs` lists any ESPN stat label without Chinese. A push
to `main` tests, writes `nba-elta.json`, stamps versions and deploys (also
every 6 hours).

## If you change…

| This | Also check |
| --- | --- |
| A league | `leagues.mjs`, picks, Shared-Proxy's `builders/` |
| `liveTable` / `title.mjs` | Every table and the title line |
| A session's status | Home cards, 轉播, the weekend sheet, standings, notices |
| `trimF1Live` (Shared-Proxy) | The F1 board, 數據, Play's settling |
| A saved key's meaning | Bump its version, remove the old key |
