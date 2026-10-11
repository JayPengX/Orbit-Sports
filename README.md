# Orbit Sports

An Orbit app (the everyday tools), signed in with the Quadra Pass. It
covers every league you can watch in Taiwan on ELTA.tv (愛爾達) or Apple TV:
- scores, schedules, match details (box scores, plays, line-ups, win
  probability), standings, teams and players;
- a day planned around what you follow;
- one tap to watch a game in the ELTA.tv or Apple TV app.

F1 has its own live board with F1's own timing.

**https://jaypengx.github.io/Orbit-Sports/** (was Quadra Fixtures; this
local folder is still `Quadra-Fixtures`)

The family's rules are `Shared-Proxy/docs/TRUTH.md`, and they win over
anything here. The data layers this app reads through (memory, device,
Shared-Data's packs and mirror, the proxy's edge cache, the upstream) are
in Shared-Proxy's README §2.

## Contents

- [Leagues](#leagues)
- [The four tabs](#the-four-tabs)
- [Sheets: a match, a race weekend, a team, a player, a constructor](#sheets)
- [F1 in detail](#f1-in-detail)
- [Tables, the title race and results counted at once](#tables-the-title-race-and-results-counted-at-once)
- [Playoffs and knockout rounds](#playoffs-and-knockout-rounds)
- [Where to watch in Taiwan](#where-to-watch-in-taiwan)
- [Today's picks](#todays-picks)
- [Following, notices and the pass](#following-notices-and-the-pass)
- [Search](#search)
- [Where the data comes from](#where-the-data-comes-from)
- [Refreshing, opening fast and staying still](#refreshing-opening-fast-and-staying-still)
- [What's kept on the device](#whats-kept-on-the-device)
- [Files](#files)
- [Develop, test, deploy](#develop-test-deploy)
- [What depends on what](#what-depends-on-what)

## Leagues

Only leagues on ELTA.tv or Apple TV in Taiwan (`BROADCAST` in
`lib/broadcast.mjs`, checked 2026-10). `lib/leagues.mjs` takes those
leagues from the shared catalogue (`Shared-Proxy/kit/catalog.mjs`).

| Sport | Leagues | Where |
| --- | --- | --- |
| Baseball | MLB; CPBL (selected games: ELTA has four clubs' home games) | ELTA |
| Basketball | NBA (selected games, one or two a day) | ELTA |
| Soccer | Premier League, Serie A, Bundesliga, Ligue 1, Scottish Premiership, FA Cup, Champions League, Europa League, Conference League, Nations League | ELTA |
| Soccer | MLS (every game, MLS Season Pass) | Apple TV |
| Racing | F1 (every session, practice too, 2026–2029) | ELTA |

A league out of season (no games from two weeks back to two months on) is
hidden, and a sport with none left goes with it. This is checked once and
kept 12 hours. **A league that couldn't be read is shown, never hidden for
a failed read.** Only a check with every league read is kept.

## The four tabs

The kit's tab bar. Each tab keeps its place; a tap on the open tab scrolls
it to the top, and at the top 首頁 goes back to today. At the top right are
說明 · 重新整理 · the account.

### 首頁 Home: the day, ranked for you

- **The date strip.** A month back to six weeks ahead, drawn once and never
  rebuilt while scrolled; it keeps the person's scroll across live
  refreshes. 📅 reaches any day. Filtering to one sport keeps the strip to
  the days that sport plays on TV here.
- **The filters.** 全部, 追蹤, my teams only, or one followed sport (every
  followed sport, whether it plays today or not).
- **正在進行.** Games on now come first: theirs, or with none of theirs on,
  the best of everything on now. Each has 觀看, and they are left out of
  the lists below.
- **今日推薦.** A no-clash plan of the best games (§Today's picks), each
  with its reasons. Then 更多推薦: the rest in order ("show more").
- **Followed teams that play today**, with that game.
- **When the day is over.** Today with every game over is shown as a past
  day: its picks as they stood, with the results. A past day shows its
  picks the same way.
- **Nothing on TV that day.** It says why (past ELTA's list, only the
  NBA's and MLS's games are known) and links to 賽事.
- **The small hours.** A day of picks is 05:00 to midnight. A game between
  midnight and 5 is recommended only if it's worth staying up for (a
  play-off, a final, a series game, or a followed team's); otherwise it
  sits among the other picks.
- **F1 cards.** A race weekend's cards show the top three live (F1's own
  feed every `f1Feed` seconds, filled in place). Practice is never among
  the picks.
- **The first run.** Pick sports in order of priority (cards with their
  leagues' marks), then 完成.

### 賽事 Matches: every sport, league and game day

- **Chips.** Sport chips, then league chips; both keep their scroll.
- **Team sports.**
  - The view opens on the game day nearest to now (a live day first), on
    the same date strip as 首頁, built from the league's season game days
    (Shared-Data's pack).
  - ‹ › read further: CPBL by months, a cup by months, others by weeks.
  - A football day says its matchweek (第 6 輪, 第 6–7 輪 across a
    postponed game) or a cup's league-phase matchday (第 2 比賽日).
  - A stage filter appears only when the day has games of more than one
    stage (a cup night among league games).
  - A cup with groups says each game's group (C 級第 2 組).
- **F1 (and race series).**
  - One card per weekend: flag, name, circuit, days, each session's time,
    badge and state, and over, the race's winner.
  - One tap opens the session on now, else the next, else the race.
  - 接下來 and 已結束 are shown one at a time.
- **Views**: 賽程 · 排名 (every league with a table) · 季後賽 / 淘汰賽
  (every league with playoffs, its shape drawn while read).
- **The league head**: its logo, where its season is, what's on now, the
  follow button, and where to watch it.
- **Live refresh.** The open league's live games refresh every
  `sportsList` seconds. **Only what changed is put in place** (a quiet read
  and `morph`: a card's score and clock); the list is never redrawn.
- **Search** sits at the top (§Search).

### 轉播 On TV: when and where

- **Everything on now** (followed first), each with **觀看**: it opens the
  game's channel in the ELTA.tv app, or Apple TV's own page of an MLS game.
- **你的轉播**: your teams', players' and followed matches' games on TV in
  the next 7 days, by day.
- **The next hours**: the next 24 hours' other games (a followed team's
  within the hour of the first comes first).
- **Just ended**: games finished in the last few hours, latest first.
- **愛爾達's guide**, a tap away: every showing on ELTA.tv's channels
  (about two weeks, the same game on several channels as one), then
  NBA.com's ELTA games after that (channel to come). Each shows the time,
  league, sides, one detail and each channel with its commentary. MAX
  (no ads) comes first, and 觀看 opens it.
- **Drawing.** It is drawn once everything is in, or after 3 s with what
  there is, never reshuffled under the finger.
- **The badge.** The tab shows the live count (games on TV here).

### 追蹤 Following: how yours are doing

- **The matches you follow one by one**: on now first, then by start; one
  that's over stays until it's let go.
- **Each followed team**: place and form, next game (when, where it's on,
  觀看 while it's on), last result, and its page on a tap. A followed F1
  team: its cars' finishes in the last race and the next session.
- **Each followed player**: team and position, any injury, the season's key
  numbers as tiles, their last game's line (from the box score), and their
  team's next game. A followed driver: championship place and points, the
  last race's finish, the next session with its channel.
- **Nothing followed yet**: popular teams of the leagues on TV, a tap each.
- **我的設定** (one sheet): the sports in order, their leagues, who you
  follow, the commentary you like (英文原音 / 中文 / 雙語).

## Sheets

Every sheet swipes down to close (the kit).

### A match

- **The header.**
  - Score, stage and playoff series ("系列賽 2-1 領先").
  - The follow buttons for both sides, and 追蹤這場比賽 (this match alone,
    until it's over).
  - **觀看** at the top when the game is on or about to start.
  - A guest club from outside the league keeps the header even; its
    league side's follow sits under the score.
- **The live panel** (a game on), redrawn every `sportsGame` seconds while
  the sheet is open, and at once on coming back:

  | Sport | What it shows |
  | --- | --- |
  | Baseball | Bases, the count as dots, outs, batter against pitcher (faces), the last play |
  | Soccer | Goals and red cards by minute (one full-width line each: the minute, the scorer's face, the name whole with the team, PK or own goal under it, the score it made) |
  | Basketball | Each side's top scorer now, team fouls, the last plays (from the box score as it stands) |

  When MLB's ESPN feed is empty, MLB's own API fills in (`lib/mlb.mjs`).
- **Sections**, drawn once, with the game's own page in (or after 3 s), so
  nothing pops in and moves the page:

  | Section | What |
  | --- | --- |
  | 概況 | The teams side by side; where, when, TV (each channel on its own line, each part whole); the win chance card; each side's leaders; the season series ("last meetings": wins, draws, one bar); injuries |
  | 數據 | Team stats: each side's own bar against the larger value, so averages and rates read right; which side did better, fewer for ERA, errors, fouls |
  | 球員 | Box scores: faces, sortable columns (most, fewest, back to the box order; kept per game), totals under, baseball's game notes (打擊, 跑壘, 投球, 守備) |
  | 過程 | Every play (basketball), at-bat (baseball), drive (American football), soccer's commentary; a header at each period; the chart's key moments marked; long games get a sticky bar, a filter (全部 / 得分 / 關鍵) and period chips |
  | 先發 | Who starts, before the game (`lib/lineups.mjs`): MLB's probable pitchers and batting orders (MLB's API), an NBA, WNBA or NHL side's starters once announced (ESPN's core rosters); read again each minute until it starts |
  | 傷兵 | ESPN's injury report (NBA, WNBA, NFL, NHL, MLB: the league's list, kept 10 minutes) |
  | 排名 | The league's table with both sides marked, the result counted in at once (§Tables) |

- **The win chance card.** One source per game, decided before it shows:
  - **a game to come**: each side's chance (and a draw's) as one split bar,
    from ESPN's prediction, else Polymarket's price, else a sportsbook's;
  - **a game on or over**: the chart (`lib/wpline.mjs`, `lib/moments.mjs`).
    The home side's chance is above the middle, the away side's below, each
    in its colour; a draw counts half, and periods are marked under it. Key
    moments (swings of 12+ points with their plays, or a soccer game's
    goals and red cards) are dotted on it and listed under it. A finger
    reads any moment, snapping to a near one.
  - **Sources**: ESPN's own line, else Polymarket's market (`lib/winprob.mjs`,
    read each minute while on). A finished game's market line comes from
    Shared-Data's `winprob` pack.
- **Highlights.** An ended game's highlights open in YouTube: the official
  video itself (league, club or an English rights holder whose videos play
  in Taiwan; the NBA's from GAMETIME HIGHLIGHTS), named for what it is, from
  Shared-Data's `watch.json` or found on the device. Else YouTube's search,
  said so.
- **Watching again.** A finished game on ELTA shows where to watch it
  again: its whole video, else its channel's 回看 within 48 hours, else the
  season's page. For MLS, it is Apple TV's own page of the game.
- **CPBL.** The box score is the league's own (`lib/cpblbox.mjs`): line
  score, 數據, 球員 and 過程 in its own Chinese.

### A race weekend (F1)

The weekend's schedule (each session's time, badge and state), then the
chosen session's board or results (§F1), its replay and highlights once
over, and for the race, each driver's chance to win.

### A team

The page follows the leagues' own apps:
- the hero (logo, name, record, place, form, follow);
- a strip of its key numbers, and the next game as a card;
- tabs: 賽程, 戰績, 陣容 (ESPN's leagues: ESPN's groups, else by
  position), 排名 (its part of the table, results counted in at once).

Two special cases:
- **CPBL**: the same page built from its own season (the record and table
  counted from the results; the league's own table from Shared-Data).
- **A club from a league not covered, met in one of the cups** (Benfica in
  歐霸): only its games in our competitions, its league named, no roster.

### A player

- **The hero**: headshot (ESPN's, else the kit's photo lists), team in
  Chinese (a tap to its page in its own league when ours), position.
- **Tabs**: 概況 (the latest, this season), 數據 (the numbers, the
  season's key numbers in a strip), 近期比賽 (the game log: each game's
  competition, ours opening its match), 資料 (profile, honours).
  - Last season's numbers are said to be until the new season's first
    game.
- **A driver.**
  - formula1.com's figures, with the season place and points overlaid from
    the live table, because formula1.com updates a day after a race.
  - Each weekend this season (round, flag, grid, race, sprint, points).
  - The season in four numbers (wins, podiums, best and average finish).
  - The teammate head-to-head (points, place, who finished ahead race by
    race).
  - The next weekend and its sessions.

### A constructor (F1 team)

ESPN has no page for one. This page builds it from:
- the championship (place, points, results counted at once);
- its two drivers with photos and points;
- each weekend's finishes and points (both cars on the podium: 雙登台 N 次);
- formula1.com's grids (正賽, 衝刺賽, history, profile).

## F1 in detail

F1's own timing comes through the sports proxy (`f1-live.quadra`, see
Shared-Proxy README §4.6). It is read the same way by Quadra Play
(`kit/f1live.mjs`).

**A session's state.**
- F1's feed says a session started or ended minutes before ESPN does.
- `feedEnded` and `feedStarted` (`lib/espn.mjs`) override ESPN's status
  everywhere (`sessionStatus`, `feedStatus`). They put 完賽 on the card at
  the flag, with the status text set to "Final".
- `feedEnded` is kept on the device for two days (`fx.f1ended`), so an
  app reopened after the flag never shows the session as on.
- A session long past its start is over whatever ESPN says.
- Qualifying is over only after its last part.

**The live board** (`f1LiveBoard`), redrawn every `f1Board` seconds in
place:
- **The head**: a live dot, the session and the flag. The lap is large
  with its total, and laps left (or the time left) are opposite. The bar
  has the safety car's and VSC's laps marked. Race control's last three
  messages are underneath, each with its lap, and the rest a tap away.
- **Race control in Chinese, by rule** (`lib/racecontrol.mjs`): FIA's set
  phrases are read as who, where, the verdict and the reason in brackets.
  Each car becomes a driver chip that opens them. Every message of 2025–26
  (5,784, 1,985 shapes) is told in Chinese; `tests/racecontrol.test.mjs`
  reads them all.
- **Each car** (`f1Row`, the same row in every F1 list):
  - the team colour down the edge, place, face, the name whole where it
    fits and the surname where it doesn't (`fitName`, measured once laid
    out, again on resize), and the team;
  - **live**: tyre (Pirelli's drawing) and age, places gained from the
    grid (▲▼), in the pits or out lap, gap and the car ahead's interval
    (`前車`);
  - **qualifying and practice**: best lap and gap. Qualifying shows a line
    where the part cuts, with the cars under it shaded;
  - **over**: places gained, the fastest-lap pill, the points (`25 分`),
    the gap;
  - **a car out**: its place, a red 退賽 tag by the name, and the laps it
    ran (`36 圈`), never "55L". The official results draw it the same way.
- **成績 / 數據** are two views; the choice is kept for the next session.

**數據** (`f1Stats`), in the order it is read.
- **Live**: the weather (one line), the track, the drivers compared, the
  stop window, a qualifying's parts, tyres, the headline tiles, fastest
  laps, the championship as it stands, sectors, the speed trap.
- **Over**: the headline tiles first, then the rest without the live-only
  cards. A practice's long runs come after the compare.

| Card | What |
| --- | --- |
| 賽道位置 | The circuit's outline (MultiViewer's, turned and fitted); the finish (chequered) and S1–S3 lines. **Cars**: placed from their mini-sectors passed this lap (`seg`; F1 stopped giving x/y in 2026), by the circuit's own mini-sector points, else each sector's share of the lap by the field's best sectors. Each dot carries its car number (white or black by the team colour). A car on top of another moves across the track beside it, one side then the other. A ring marks a car within 1 s of the car ahead. The picked cars are bright and named with their gap; the others faint. A tap on a car adds or drops it in 車手比較. **Two views** in a block of one height: **誰比較快** (2+ picked: each sector in the colour of the quickest of them by best sectors, and a strip of S1–S3 cards with the quickest's face and time and the next one's gap; tap one to light it) and **本圈進度** (one driver's lap so far, mini-sector by mini-sector in F1's colours: purple, green, yellow). **No jump while picking**: the map keeps the picks it had until 完成; taking everyone out returns it to the plain field at once. |
| 車手比較 | Up to four cars, a column each (face and name on top, × to drop): place, gap to the first of them and whether it's closing (over the last laps after either car's last stop; neutralised laps skipped; capped at 2 s a lap; when it would meet), tyre and age, stops and the last stop's lap, last lap, recent pace, best. The picker folds under 選擇車手 and stays open until 完成. **The chart**: 差距 / 圈速 / 名次, better always up, the safety car's laps shaded, every lap since the start, a finger reading every line at a lap. Then the last laps side by side. |
| 進站窗口 | (Race on.) Where a stop now would put each car: the gap to the leader plus this circuit's stop loss (under the safety car or not), "出站在 X 前方 N 秒", the places it costs |
| Headline tiles | Fastest lap, ideal lap (each best sector), speed trap, most places gained (race) or most laps (practice) |
| 各節圈速 | A qualifying's best lap in each part, each part's fastest purple |
| 輪胎策略 | Each car's stints by compound and length; stops (race) or laps |
| 最快圈 | A race's fastest laps, each with its lap |
| 即時積分榜 / 積分榜 | The championship with this race's points from each car's place now: drivers or teams, ▲▼ places moved, + points, the lead. Live during a race or sprint; **over too, but only for the race just run** (its round found in ESPN's table, not yet counted, within two days) |
| 分段 | Best sectors (the fastest purple) and each car's ideal lap |
| 測速 | The speed trap's top ten |
| 長距離 / 單圈 | (Practice.) Each car's long run ranked by average lap, its tyre, laps and fall-off; the best lap on each compound |

**Laps** (`lapsFor`) come from `laps.json`:
- every `f1Laps` seconds while live, plus the board's own last lap of each
  car as it comes;
- over, the archive, else the proxy's log, asked again each minute until
  the archive has it.

**Stops** are read from the stop list, else from tyre stints
(`stintStops`), so a stop never counts as pace.

**Results** (`f1Final`): the official order where it's in (Jolpica: a
race's grid, points, fastest lap; a qualifying's parts), else F1's
archive's order in the same row design. F1's archive feeds 數據.

**The race chance** (`raceChanceCard`): Polymarket's winner market.
- **To come**: each driver's chance now.
- **On or over**: a line per driver who ever had a chance, in team colours
  (teammates dashed), by lap. The safety car, stops and lead changes are
  marked, and a finger reads each one's chance at a lap.

## Tables, the title race and results counted at once

**Results counted at once.** ESPN's standings come in minutes to hours
after a final whistle. `lib/title.mjs liveTable` adds the games a table
hasn't counted yet, finished or on now:
- A game is counted once only, by games played.
- A side's record on the scoreboard says how many games it will have
  played once the game is in.
- Its rows are marked `fresh`.
- **Zones stay with places**: the Champions League's colour belongs to
  4th, whoever is 4th now.

**F1 (`liveRacing`).** A weekend's sprint and race count when over:
- **In what order**: the finishing order from F1's feed the moment it
  calls the session over (`settleScoring`, `askFinishes` in `lib/f1.mjs`).
  ESPN's scoreboard says "pre", with the field in grid order, for an hour
  or more after the flag.
- **Which column**: the weekend's column in ESPN's table is found by name
  (`roundOf`: ESPN's sponsor name "Singapore Airlines Singapore Grand
  Prix" or F1's "Singapore Grand Prix").
- **Whether ESPN has it yet**: `roundCounted`, the column has numbers; a
  race only once it holds more than a sprint's 36.
- **What it updates**: each driver's points, the column, the rank and the
  gap.

**Every table goes through this:**
- 賽事's 排名;
- the match sheet's table;
- a team's, a driver's and a constructor's page (`freshStandings`);
- the races left in the title maths.

**The title race** (`standingsRace`, `titleRace`), above each table:
- **Won**: 封王 / 提前封王, with what's left.
- **Close** (within 5): when at the soonest ("最快在美國站封王") and the
  lead it takes then: "領先 102 分・屆時領先 126 分即封王", which is more
  than the next one can still win after that weekend. Points tables are
  the same in every sport; baseball and basketball use the magic number.
- **Further off**: when it'll be decided at the soonest, and the lead now
  ("曼城 領先 2 分", or "曼城 與 兵工廠 同分").
- **Other places**: the next places still open (F1's always), the zone
  fights in the run-in, and what the zones have settled (a lock on a
  settled place). Sides with no chance left are greyed.
- **Before the first counted game**: last season's final table, said so.

## Playoffs and knockout rounds

`lib/playoffs.mjs`, `lib/bracket.mjs`, the 季後賽 view. Every league with
playoffs or knockout rounds:
- the real games while they're on;
- the first round predicted from the table while the season is on (MLB
  seeds 3–6 / 4–5; the NBA's play-in then 1–8; MLS 8–9; the Champions
  League's league phase 9–24);
- last season's when this one hasn't begun.

**The map.** One column a round (name, done / on now / dates), the later
rounds between the ties that feed them, and lines from each tie to the
next.
- **Each tie**: seeds, logos, names, wins or aggregate, who went through
  (the other greyed), the next game or 待定. A predicted tie is dashed.
- **Two rounds or fewer** (CPBL): stacked, a tie the screen's width.
- **Reading**: games are read back a week at a time until a week with
  none (never a season's days at once). A week unread is a failure, never
  "over". It is read again when a playoff game starts or ends.
- **Times**: MLB's postseason times, 待定 and 如需 come from MLB itself
  (`kit/postseason.mjs`).

A match's series line opens the whole tie (every game, G1 first).

## Where to watch in Taiwan

`lib/broadcast.mjs` (the leagues and services) and `lib/tv.mjs` (game by
game).

- **ELTA's own schedule** (its 直播節目表, read through the proxy, kept
  half an hour) gives a game's exact channel, its commentary (英文原音,
  中文, 雙語) and ads. A game whose hour isn't set takes ELTA's slot
  (預計).
- **NBA.com's Taiwan schedule** (`public/nba-elta.json`, written by
  `scripts/nba-elta.mjs` in the deploy every 6 hours) lists the whole
  season's ELTA games. NBA.com's CDN refuses Workers.
- **Apple TV**: every MLS game. Its 觀看 opens that game's own page in the
  TV app, from Shared-Data's `watch.json` (`packOf(e).apple`, a week ahead
  and ten days back), else the MLS channel.
- **The featured game**: of a league's games at one time, the one ELTA puts
  on a main 體育台 with its commentators (the rest on MAX's English feed).
  It counts in the picks.
- **Where not**: ESPN's US networks aren't shown. A game with no channel
  here says so.

## Today's picks

`lib/picks.mjs`. Every match gets a score:

| Signal | What |
| --- | --- |
| priority | The leagues followed, in their order (the first counts most) |
| teams | A followed team playing (the strongest single signal) |
| quality | Both sides' places in the table |
| closeness | How evenly matched |
| stakes | A top-of-the-table meeting, a final, a play-off, a series |
| fame | A headline league, a final |
| habit | What's opened and followed here (this app's affinity, the kit's engine, `lib/foryou.mjs` keys shared with Play) |
| featured | ELTA's own pick at that hour |
| now | Live, or starting soon |

**The plan**: the best match, then the best that doesn't clash with those
already in (each sport's usual length), listed by time with reasons.
- **Only games on TV here** are recommended. A match followed on its own
  shows regardless.
- **Before they settle**: the loading screen waits for the picks to settle
  (a few seconds at most), so they don't reshuffle.

## Following, notices and the pass

**Saved on the pass.** This app's payload is `{ v: 3, sports, leagues,
follows }`, sports in priority order. Follows are teams, players, F1
drivers and teams, single matches and race weekends.
- **A copy in the wallet**: `follows:match` (Play's league keys) and
  `aff:match`, so Quadra Play recommends from the same follows.
- **A copy on the device**, with its time. If the pass's copy comes back
  empty or older, the device's stands and is saved again, so nobody is
  welcomed as new because a save was lost.
- **Following a team** follows its league too.
- **Single matches** (追蹤這場比賽) and **race weekends** (追蹤這一站)
  come first on 首頁 that day (even off Taiwan TV) and at the top of 追蹤.
  They are let go two days after the start (a weekend after its last
  session).

**Notices** (the kit's `match` kinds; each has its own switch):
- `start`: a followed team's game starts (only when it's on TV here).
- `end`: its final score. The Worker checks ESPN after the game's usual
  length and fills in the score and who won.
- `pick`: each of 今日推薦 starts, unless a followed team's start already
  covers it.
- **Race weekends**: qualifying, sprint and race starting, and the sprint's
  and race's podium.
- **How they're sent**: through `schedulePush`, while the app is closed.
  Titles say what happened ("道奇 vs 費城人 開賽"); the line under it the
  league and why.

## Search

At the top of 賽事 (`lib/search.mjs`). It finds leagues by name in either
language, then ESPN's teams and players.
- **A Chinese query**: matched against the teams' Chinese names first
  (皇家 → Real Madrid, Real Sociedad, Real Betis), each searched in
  English, and translated for anything else.
- **A club or footballer of a league not covered** is shown in the
  European cup it plays this season.
- **A search that couldn't be read** says so, never "nothing matches".

## Where the data comes from

| Data | Source | Read through |
| --- | --- | --- |
| A league's season (schedule, results) | ESPN, built nightly | Shared-Data `sports/<league>/<year>.json` (`packJson`) |
| A league's game days | Shared-Data `sports/<league>/days.json` | packJson |
| Today's and live scoreboards, summaries | ESPN site API | the sports proxy (`live` tier) |
| Finished games, past days, tables, teams, squads, players | ESPN | Shared-Data's mirror, else the proxy |
| Standings | ESPN; CPBL from Shared-Data's `cpbl/standings.json` | mirror / proxy |
| Pre-game starters | ESPN core rosters; MLB's API | proxy (`lineup` tier) |
| MLB live fill-in, postseason | statsapi.mlb.com | proxy |
| CPBL games and box scores | cpbl.com.tw (`asia-baseball.quadra`) | proxy |
| F1 live, sessions, laps, circuits | F1's live timing and archive (`f1-live.quadra`) | proxy |
| F1 results, qualifying, sprints | Jolpica | mirror / proxy |
| F1 drivers' and teams' pages | formula1.com (trimmed) | mirror / proxy |
| Win probability (no ESPN line) | Polymarket | proxy (live), Shared-Data `winprob` (over) |
| Where to watch | ELTA's list (proxy), NBA.com (`nba-elta.json`), Apple TV (`watch.json`) | — |
| Highlights, ELTA's replays | YouTube, ELTA.tv | Shared-Data `watch.json`, else looked up on the device |
| Photos, logos, Chinese names | the kit (`photos.mjs`, `logos.mjs`, `names.mjs`) | — |
| Translations (ESPN's English words) | Google translate | proxy, kept 30 days a line |

All reads go through the kit's `proxyJson` (`lib/espn.mjs getJson`):
- reads made together are batched;
- answers are remembered in memory and on the device;
- failures are held a minute;
- the mirror is consulted first.

A Quadra Pass session is required.

## Refreshing, opening fast and staying still

**Refresh rates** (the 開發 settings, Shared-Proxy README §8):

| Setting | What it refreshes |
| --- | --- |
| `sportsList` (5 s) | Lists while something's on: 首頁, 轉播, 追蹤, and 賽事 in place |
| `sportsGame` (3 s) | An open game sheet |
| `f1Feed` (10 s) | F1 cards app-wide |
| `f1Board` (4 s) | An open F1 board |
| `f1Laps` (15 s) | F1 laps |

Today is read every 2 minutes in any case, and at once on coming back to
the app.

**Staying still.**
- **Opening**: a signed-in phone opens at once on the follows and the last
  day read (`fx.day.v4`), refreshed behind.
- **Drawing**: sections and lists are drawn once with everything in, or
  after 3 s in their shape. Nothing pops in and moves the page.
- **Redraws**: live refreshes change values in place (scores, clocks, the
  F1 board, the track's cars glide). Strips keep their scroll. Pictures
  seen before draw at once (`sw-images.js`).
- **Updates**: a new deploy is put in place at once by the kit (version
  stamped by `scripts/stamp-version.mjs`, `version.json`).

## What's kept on the device

| Key | What |
| --- | --- |
| `fx.day.v4` | The last day read (v3 and older removed: they could hold a failed read as "no games") |
| `fx.active.v2` | Which leagues have games (12 h) |
| `fx.prefs` | The follows' device copy |
| `fx.followsSynced` | When the wallet copy was last sent |
| `fx.f1live.v2` | F1's last live reading (a reload draws it at once) |
| `fx.f1ended` | Sessions F1's feed called over (two days) |
| `fx.highlights.v2`, `fx.replays.v1` | Highlights and replays found on the device |
| `fx.eltaAppMiss` | ELTA app links that didn't open |
| Cache Storage | Every proxied answer (the kit) |

## Files

```
public/
  index.html             the page: kit:head / kit:boot, the frame
  app.js                 the tabs (首頁, 賽事, 轉播, 追蹤), follows, days, picks, notices, live ticks, F1 polling
  sheets.js              sheets: match, race weekend (F1 board, 數據, track map, compare), team, player, constructor, tables, series
  ui.js                  DOM helpers, days and times, event rows, tv lines, sheets' frame
  styles.css             the app's look on the kit's tokens
  sw.js                  the service worker (versioned files cache-first; pictures via the kit's sw-images.js)
  lib/espn.mjs           every read and parser: scoreboards, calendars, summaries, standings, teams, rosters, athletes, injuries, sessions, F1 feed state (feedEnded, sessionStatus)
  lib/f1.mjs             F1: formula1.com figures, Jolpica results, live timing reads, laps, gaps, closing rate, stops, pace, points, asItStands, settleScoring, askFinishes
  lib/racecontrol.mjs    race control's messages in Chinese by rule
  lib/f1names.mjs        an F1 story ready for the translator
  lib/title.mjs          liveTable (results counted at once), liveRacing, roundOf, roundCounted, titleRace, standingsRace
  lib/playoffs.mjs       the playoff model (live, projected, last)
  lib/bracket.mjs        ties and rounds from games
  lib/picks.mjs          today's picks and the no-clash plan
  lib/foryou.mjs         a match's affinity keys (shared with Play)
  lib/broadcast.mjs      where to watch: the leagues, ELTA, Apple TV, NBA.com
  lib/tv.mjs             each game's channels; watch.json's Apple links
  lib/highlights.mjs     a game's official YouTube video
  lib/winprob.mjs        Polymarket's win probability line
  lib/wpline.mjs         a line's period marks and stamps
  lib/moments.mjs        a line's key moments and their plays
  lib/live.mjs           a live game's status, situation and details
  lib/lineups.mjs        starters before a game
  lib/mlb.mjs            MLB's own API for an empty ESPN feed
  lib/cpblbox.mjs        CPBL's own box score
  lib/stage.mjs          season stages and playoff rounds in Chinese
  lib/leagues.mjs        the leagues (catalogue ∩ broadcast)
  lib/search.mjs         search
  lib/statnames.mjs      ESPN's stat names in Chinese
  lib/compname.mjs       a competition's name in the app's words
  lib/days.mjs, strip.mjs  days and the date strip
  lib/i18n.mjs           Traditional Chinese and English
scripts/
  nba-elta.mjs           NBA.com's ELTA games (deploy only)
  stamp-version.mjs      ?v= on every file, version.json, modulepreload
tests/                   node:test, one file per lib (and consistency, weekend, appletv…)
```

## Develop, test, deploy

```bash
npm test
```

```bash
node ../Shared-Proxy/tools/preview.mjs sports --webkit
```

```bash
node ../Shared-Proxy/tools/preview.mjs sports --serve --port 8125
```

- **Tests**: `npm test` runs every parser and rule: calendars, leagues,
  picks, title/liveTable/roundCounted, F1 gaps and stops, race control
  over every 2025–26 message, playoffs, brackets, broadcast, Apple TV,
  highlights, win probability, lineups, CPBL, MLB.
- **The preview tool**: WebKit at 375 px with real data, a made-up pass.
  `--serve` serves it for the iOS Simulator, or for a WebKit driver
  against a live session.
- **Before calling it done**: check at 375 px with the longest real data,
  both languages. A wrap, an ellipsis or a clipped name is a bug (TRUTH
  §6).
- **Deploy**: a push to `main` runs the tests (the kit checked out as
  `.kit`), writes `nba-elta.json`, stamps versions and deploys `public/` to
  Pages; it also runs every 6 hours for NBA.com's list.

## What depends on what

| If you change… | Also check |
| --- | --- |
| A league (`kit/catalog.mjs`, `broadcast.mjs`) | `leagues.mjs`, picks, 賽事 chips, Shared-Data's `sports.mjs`/`mirror.mjs`/`watch.mjs`, Quadra Play |
| `lib/espn.mjs` parsers | Every tab and sheet; Shared-Data's mirror (its trims); tests |
| `liveTable` / `title.mjs` | 賽事 排名, match sheet 排名, team/driver/constructor pages (`freshStandings`), the title line in every sport, `racesLeft` |
| A session's status (`feedEnded`, `sessionStatus`) | Home cards, 轉播's badge and lists, the race weekend sheet, standings counting, notices |
| `f1Row` | Every F1 list: live, results (official and archive), qualifying, practice |
| `trimF1Live` (Shared-Proxy) | The board, 數據, track map, compare, stop window, standings at the flag, Quadra Play's settling |
| `lib/highlights.mjs`, `broadcast.mjs`, `winprob.mjs` | Shared-Data loads them alone (`watch.mjs`, `winprob.mjs`): `broadcast.mjs` and `winprob.mjs` import nothing, `highlights.mjs` only `broadcast.mjs`; keep it so |
| The row or card design | 375 px, light and dark, both languages, the longest names (TRUTH §6) |
| A saved key's meaning | Bump its version and remove the old key (TRUTH §4) |
