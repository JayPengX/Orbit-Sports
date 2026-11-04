# Orbit Sports: the map

What a viewer in Taiwan would watch: every league on ELTA.tv (愛爾達) or
Apple TV, with scores, schedules, match details, standings, teams and
players; a day planned around what you follow; one tap to watch. F1 has
its own live board from F1's timing. Signs in with the Orbit Pass.

Live: https://orbit.jaypengx.com/sports/

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
    the page for the next or last day), the filters as text tabs, the lead
    game (each club's row on its own colour, its logo on the solid logo
    tile), 正在進行, 我的比賽 (one list, the day's plan: `dayPlan`'s `keep`
    puts the games they follow in first, then the best others fill only the
    hours left free, one game a slot; their teams' later games under it;
    no separate 推薦, Jay 2026-11-03). Only their own games unless 我的設定's
    填滿空檔 is on (`prefs.fill`, off by default): then every free waking
    hour (their quiet hours stay quiet, as for their leagues: 我的設定 安靜時段,
    `prefs.quiet` {from,to} by the hour, 00–05 unset; app.js `asleep`) takes the game of any
    sport worth most then (`picks.mjs worth`: PRESTIGE by league, stakes, the
    table, the odds, big clubs, stars, the hour; no quality cut), drawn as one quiet
    line (`.filled`: time, the two sides, a small star at the end; Jay
    2026-11-04 picked it over a grey row). 我的聯賽 is a short list, each
    league with the open day's count of games (`.my-leagues-list`). Every list on
    首頁, 已結束 and a past day too, is only their own games and, with
    填滿空檔 on, the filled ones as the day stood (`lib/home-shown.mjs`
    `homeGames`): never the others' results; a filled game over is the same
    quiet line with its score at the end. 完賽 is as big as a start time. 下一場 is always their own next game (a later
    day's when the open day has none), never a filled one.
    更多賽事 (only their own leagues' other games, never the other sports'
    filled or fallback ones), 我的球隊 (each
    followed team's place in its table and its next game; without follows,
    the places to watch), 已結束.
- **Orbit's own look** (Jay 2026-11-03; Orbit-Core DESIGN.md §11; `<html
  data-look="native">`, `look.css` after `styles.css`): today's dark page,
  graphite cards, colour only on what it names (a club's row, a team's mark);
  the app's orange for what's live and the one main action. `look.js` draws
  the lead game's colours (`paintHero`, the clubs' colours by `sideColors`)
  and 我的球隊 (`teams`).
  - **賽事:** a league. Sport and league chips, game days, then 賽程, 排名,
    季後賽, 數據 (球員's leaders, 球隊: every team by each of its own stats).
    A followed or picked game in a list is a ★ 追蹤 / ★ 推薦 pill on a softly
    lit row. F1's 賽程 is a card a weekend (`weekendCard`): a panel with the
    next session's running countdown (or the one on, or the podium) beside the
    circuit's outline, then the sessions as even stops on one line, each
    finished one showing who topped it on their team's colour.
  - **轉播:** when and where. The same date strip (yesterday to two weeks
    on). Today: on now with 觀看, yours in the next 7 days, the next 24 h,
    ELTA's whole guide; another day: its best game, then all it has on TV.
  - **追蹤:** how yours are doing. Teams, players, matches, drivers; 設定
    at its foot (leagues and follows as rows, put in order by their grips,
    kit `reorder`, each let go by its ✕ with 復原; commentary).
- **Every screen** (Jay 2026-10-31; Orbit-Core DESIGN.md §10): on a tablet,
  a computer or a phone on its side each tab is two columns (首頁's answer
  left and what's next right, 轉播's on now and coming up, 賽事's leagues side
  by side), games and team cards in columns, tables with every column and
  conferences side by side, F1 weekends as a grid; the tabs a rail down the
  left. A game's page on a phone on its side: its head one row (the stage
  under the time, the follow star in the sheet's head), the score in the
  title once scrolled; 概況's cards dealt into two even columns (kit
  `flowColumns`), a game to come's 數據 both sides side by side.
- **Sheets** (full height):
  - **A match:** header and line score, a live panel, then sections drawn
    once in an order set by the game's moment: 概況, 數據, 球員, 過程, 先發,
    場上球員, 陣容, 傷兵, 本季數據領先, 排名, 比賽資訊. 數據 holds both
    球隊 and 球員 (the box score; before the start, the season's). Every sport shares one
    先發陣容 card, one 陣容 card per side (先發 or 打序, 替補, then 未上場 or
    傷兵 in the injury report's rows) and one 傷兵 list (three, then 全部).
  - **A race weekend:** a hero (flag, circuit, countdown to the next session),
    the sessions on one timeline (a tap picks whose order shows), then F1's
    冠軍之爭, 台灣轉播, 賽道 (outline, formula1.com's figures and lap record,
    Open-Meteo's weather there each day, through the proxy) and last year's podium there.
  - **One word, one meaning, one order on every page** (Jay 2026-10-30):
    概況 the glance, 賽程 every game (to come, then results), 數據 the
    numbers and where they rank, 陣容 the people, 排名 the table, 資料 the
    facts. Every tab row is one full-width row (never a few pills and a gap).
    The league's name at a sheet's top opens that league in 賽事.
  - **A team:** 概況 (next and last game, 傷兵, home/away/last 10 and
    scored/let in from its games, 聯盟排名, 數據領先), 賽程, 數據 (its own
    numbers ranked among the league's teams, then 隊內排行), 陣容, 排名.
  - **A player:** 概況 (his team's next game, his last line, the season,
    聯盟排名), 賽程 (next game, game log), 數據 (every league rank, then
    歷年數據: each season's team and numbers), 資料 (profile with 選秀,
    初登場, 年資, 大學; 生涯球隊: every team with its years, seasons and
    games, loans and the national side; 榮譽); opened from a game, its 本場
    line. The career (`lib/career.mjs`, read behind the page): NBA and MLB
    from ESPN's athletes/<id>/stats (proxy trim espn-career; a franchise's
    old name is a team of its own, 超音速 then 雷霆, unless one in Chinese,
    with its old badge or today's logo, kit `formerLogo`), football from
    FotMob's player page (found by name and club, checked by birthday;
    trims fotmob-search, fotmob-player), F1 teams from Jolpica. Each team
    row opens its team (a club in a European cup this season opens there; a
    loan he was then bought from is one spell).
  - **An F1 practice stand-in** (a team's FP1 driver): his car, sessions and
    who he is, his face from TheSportsDB (the proxy's about.json).
  - **An F1 constructor.**
- **Team numbers** (`lib/teamstats.mjs`): NBA and MLB from ESPN's
  statistics/byteam (the proxy's `espn-teams` trim), football from FotMob's
  club lists (its league page's `teamStats`, each list's file for the whole
  order); ranked here (level on the number, level in the list).
- **數據領先** (`lib/leaders.mjs`):
  - Basketball's 12 stats and baseball's 23 come from ESPN's whole-league
    list; rates only among qualified players.
  - Football's 23 come from FotMob; F1's 9 are counted from the season's
    results.
  - A team page ranks its own players; a player page shows their league
    ranks; a match shows each side's season leaders.
  - A team page (`sheets.js openTeam`) keeps each tab once drawn (`kept`:
    back from 賽程 to 概況 is the same page), holds 聯盟排名 and 數據領先 in
    their shape while they're read (`ranksHeld`, `leadersHeld`, kit
    `waiting`), and 隊內排行's chips redraw only that list (`paintLb`), each
    stat's whole list read from FotMob and kept to the team's players. A
    player's 生涯車隊 / 生涯球隊 is held the same way (`careerKey`).
  - Long names: `fitName` (full, short, surname) and the layout gives the row: a
    play's who on its own line (`PLAY_WHO`; on a 320 phone the score under the
    clock), 關鍵時刻's time and score above who; the leaders' columns
    (`leaderCols`, `leadWatch`) drop their faces, else go one column. Never an
    ellipsis. A home club: `homeName` (ui.js), a small house after the name.
  - 推薦 in every list: `isPickEvent` (app.js; 首頁's picks for that day, else
    the same plan from the day's games) lights the row and puts ★ 推薦 first
    on its tags (`rowMark`); never a 追蹤 mark (a followed league is all theirs).
  - Tile grids (`.stat-grid`) carry the kit's `.q-rows-full`: never a part
    row. A way on (全部球隊數據) is `ui.js goBar`, the kit's quiet bar.
- **Win chance:** ESPN's line, else Polymarket's. A game to come: the
  sportsbook's moneylines first with the book's margin taken off the long
  shots (新英格蘭 v 邁阿密 35/23/42, as Polymarket), else Polymarket's, else ESPN's own model. Soccer on or over is
  worked out here (`lib/soccerwp.mjs`): each side's goals a Poisson count
  over the time left, its rate from the odds before the start (ESPN's or
  the sportsbook's, else the market's first price), from the score, the
  minute and red cards; every competition gets it, and a late level game
  is a draw's (retuned 10-30 on 2,473 finished 2025–26 games: a side behind
  pushes and scores more, 3 and 7 minutes added, red cards weigh more; a side
  given 75% wins 76%). A chart with key moments (關鍵時刻 are the winner's;
  the loser's only for a 25%+ swing before the last two minutes; the go-ahead
  says 此後未再落後)
  while on or over; a split bar before. Each side in its colour, its
  chance written in it (`wpline.mjs sideColors`: two alike, or none, and
  one takes a spare colour); a draw grey.
- **F1 live board:** F1's own timing (`f1-live`), in tabs 排名 · 過程 · 賽道 · 輪胎 ·
  圈速 · 積分. 過程 (a race or sprint, live and over) tells the race lap by
  lap (`lib/f1story.mjs raceStory`, from each car's place at each lap's end,
  its stops and race control): the whole race's turns (the lead, each
  safety car or red flag with its cause and how long it stopped, who went
  out and where, the stewards' penalties, the biggest climbs, the finish),
  or one driver's own race picked above it (its stops and tyres, the places
  others' stops gave it, who it passed and who passed it, the finish
  against the grid); a tap on a row of the whole race picks its driver. Race control in Chinese by rule (`lib/racecontrol.mjs`; 賽會訊息,
  no speaker before each). The flag now (`lib/f1.mjs flagNow`: a red flag is
  the session Aborted, not the track status; an SC in this lap; the yellow
  sectors) is a banner under the bar (`sheets.js flagBanner`): what it is,
  its clock (a countdown to the set restart, else how long it has run) and
  why (the car out or stopped, the turn, the medical car; the kit's
  `causeOf`). Under a red flag the board holds still: no gaps, no 進站, the
  map's cars hidden under 紅旗 · 賽車都在維修區等候, 進站窗口 gone. 賽道
  is 車手比較 on the track: one pick of up to four drivers (their faces on
  the map, a tap on a car adds it), every car always moving at its own pace
  between reads and in race order by its gap to the leader, each by its
  code, always on the track's line (a train where they run close), the
  tags where they cover least (`lib/carpace.mjs`), then
  the drivers side by side. 進站窗口 lists the top ten, those yet to stop
  first, each with its tyre and its age. A qualifying or a practice compares their
  timed laps (`lib/f1.mjs pushLaps`: no pit lap, no cool-down), the first
  of each side by side, with a qualifying's Q1–Q3 and the gap where it was
  decided; a race's lap times one line a car over its stops. The win chance goes by
  lap while a race runs too (each lap's end counted from the feed and the
  leader's lap times), with its leads, stops and the start's own swing;
  each driver's climbs through the field (the kit's `placeClimbs`) and an
  SC turned red flag told as one moment, numbered pins on the lines, the
  bands' tags in two rows. 冠軍之爭 during a race or sprint is as it stands
  (假如正賽現在結束: each row's points to come, 將封王 or still open),
  redrawn every 30 s.
- **勝負未定** (close finish): a live game in its last stretch and within reach (NBA 4th or OT, MLB 8th–9th, soccer from the 80th).
- **Tables count results at once** (`lib/title.mjs liveTable`,
  `liveRacing`, `freshStandings`), on every page with a table: finals
  only, never a game still on. The title
  line says when it can be won at the soonest and what it takes: one rule
  for every sport (`title.mjs` margins: how much more than each rival who
  could still stop it), said as results when one game or race does it
  ("前 8 名，或 Russell、Hamilton 都沒贏"), baseball's and basketball's as a
  magic number; the fullest wording that fits one line (`fitChoice`). F1's
  title won, the runner-up's place is followed the same way.
- **Playoffs** (`lib/playoffs.mjs`, `bracket.mjs`): real ties, predicted
  from the table while the season runs, or last season's. The NBA Cup
  (`lib/nbacup.mjs`) beside the NBA's: its groups, found from who meets whom
  in group play (no feed names them, so no letters), first and best second
  marked, and its knockout; chips in 季後賽, an NBA 盃 tab on a cup game (a
  group game's group, a knockout game's bracket); last season's until this
  season's group play is on the schedule. Teams level on record settled by
  the cup's own tiebreaks (head-to-head, point differential and total points
  without overtime, last season's record, the draw; the wild card and seeds
  the same without head-to-head), each one said under its card.
- **Tiebreaks** (`lib/tiebreak.mjs`): each league's official order for sides
  level on its table, folded under the table (同分怎麼排) with the step that
  settled each pair where the table holds it; fresh finals re-sort by those
  steps only, ESPN's order kept past them.
- **Where to watch** (`lib/tv.mjs`): ELTA's own schedule (exact channel,
  commentary, MAX first); NBA.com's ELTA list (`public/nba-elta.json`,
  written every 6 h by the deploy); Apple TV's page per MLS game. Past
  ELTA's list (Jay 2026-11-03), the kit's `eltaGuess`: every game of a league
  ELTA has whole (英超, 義甲, 德甲, 歐冠) is on, the NBA's by NBA.com, the
  channel guessed from the list's own pattern on the league's clock and
  named only where it's plain (a game alone then), else 愛爾達; every guess
  says 預估 (cards, hero, 台灣轉播) and gives way to ELTA's listing. A league
  ELTA has in part stays 轉播待公布. `scripts/tv-guess.mjs` measures it on
  ELTA's real lists (`tests/fixtures/elta-*.json`). Replays
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
  closeness, stakes, fame, stars, theirs, ELTA's featured game, live now.
  In a season's last eighth each side's stake comes from the table
  (`tableIndex(groups, league)` → `raceOf`, on title.mjs `standingsRace`:
  a line it can still cross 1, a play-off seed 0.5; `idle` when nothing's
  left, which also halves what even odds count); `STARS` (Messi's Miami,
  Lewandowski's Chicago, Son's LAFC) adds per side. With 填滿空檔 on, the
  filled games' leagues' tables are read too (`loadTables(also)`). The best
  game, then the best that doesn't clash. Theirs is the kit's one engine
  (`feedback.mjs`): the picks shown (the hero first), opened from them or
  anywhere in the app, learnt as a weight per team, league and sport, kept
  on the Pass (`fb:match`, `feedback.keep`), so a league never opened sinks
  and a club opened rises; 常看 only for a team opened far more than the
  usual pick over enough looks (`picks.mjs HABIT`, `whyOf`).
- **Notices** (the kit's `match` kinds): a followed team's start and final,
  each pick's start and final, F1 sessions and podiums. Sent by the Worker
  while the app is closed.
- **Data:** ESPN through the sports proxy (`lib/espn.mjs getJson` → the
  kit's `proxyJson`). Seasons and game days come from R2 packs; finished
  games are kept in R2 on first read. MLB's API, CPBL's site, F1 timing,
  Jolpica, formula1.com, FotMob and Polymarket are all read through the
  proxy (Jolpica from the phone itself when it turns the proxy away: the
  kit's `proxyJson`).
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
- A match followed on its own is that game, never its league: its league's other games are no one's, not even the fallback 正在進行's; once over (and its final told) it leaves 追蹤 by itself.
- A player ESPN lists with an all-star side (MLS All-Stars) is shown with his club, the side of his newest games.
- Live refreshes patch the page in place (`put` keeps nodes and drawn pictures,
  a laid-out `.q-flow`'s cards too); the kit's `hold-place.mjs` keeps the
  reader's place whatever redraws (`node ../Orbit-Core/tools/live-scroll.mjs sports`).
- Nothing jumps (2026-11-03): a day is read as one (theirs and the other
  leagues together; 首頁 reads the days either side ahead, `readAround`), its
  shape drawn until it's in (`liveShape`, `holdDay`), never "none" first; a
  day with nothing on is the kit's empty state in one line (`noTvTitle`); a
  list still being read holds rows its size (`lbHeld`); a list's more is the
  kit's `moreToggle`.
- A game's page draws once and holds every part read after it (2026-11-03,
  Jay: 預計先發 came in last and pushed the page down): each read past the
  game's own page (who starts, the season's leaders, who's out, the table,
  the season's games, the squads) goes through `openMatch`'s `later(key,
  read)`, and overview draws its part while `still(key)` as the card itself
  built on stand-ins (`lineupsHeld`, `leadHeld`, `blanks`) through the kit's
  `waiting` (`holdShape`); the win chance card too. A new section with a
  read of its own goes through `later()` (`tests/game-page.test.mjs`);
  `live-scroll.mjs sports` watches three game pages load.
- Football's 近期交手: the last five meetings at most (ESPN's list), each
  counted by its score (`espn.mjs meetingResult`: level is a draw, even one
  settled on penalties, marked PK on its row); each side's wins and the
  draws over one bar across the card, a piece a meeting (`lib/meetings.mjs`:
  team colours from each end, draws grey between; 上季對戰 and 本季對戰 the
  same), then each meeting by year and month with its score, not tappable
  (they span competitions).
- The kit's `sports-*.mjs` (highlights, broadcast, win probability) are run
  by the proxy's builders too, so they import nothing but each other.

## Files (`public/`)

| File | What |
| --- | --- |
| `app.js` | The tabs, follows, days, picks, notices, live ticks |
| `sheets.js` | Every sheet: match, race weekend, team, player, constructor, tables, series |
| `ui.js`, `cards.js`, `styles.css` | DOM helpers, rows; the tabs' cards and tiles; the app's styles |
| `look.js`, `look.css` | Orbit's own look: the lead game's club colours, 我的球隊, and the look's overrides of the old card |
| `lib/espn.mjs` | Every read and parser (the scoreboard parser is the kit's `sports-espn.mjs`); `sessionStatus` |
| `lib/f1.mjs`, `racecontrol.mjs` | F1 data and the board's maths; race control in Chinese |
| `lib/title.mjs`, `playoffs.mjs`, `bracket.mjs`, `tiebreak.mjs` | Live tables and title race; playoffs; tiebreaks |
| `lib/leaders.mjs` | 數據領先: stats, ranks, team and player |
| `lib/teamstats.mjs` | Teams' own numbers ranked in their league (數據 球隊) |
| `lib/picks.mjs`, `foryou.mjs` | Today's picks; affinity (shared with Play) |
| `lib/broadcast.mjs`, `tv.mjs`, `highlights.mjs` | Where to watch (the kit's, shared with the proxy); channels; videos |
| `lib/winprob.mjs`, `soccerwp.mjs`, `wpline.mjs`, `moments.mjs` | Win chance line and key moments |
| `lib/live.mjs`, `lineups.mjs`, `onfield.mjs`, `mlb.mjs`, `cpblbox.mjs` | Live state; starters (MLB's own, the NBA's from RotoWire through the proxy: ESPN's core API refuses it); who's on; MLB and CPBL fill-ins |
| `lib/leagues.mjs`, `search.mjs`, `statnames.mjs`, `stage.mjs`, `compname.mjs`, `i18n.mjs`, `text.mjs` | Leagues; search; Chinese names for stats, stages and competitions; text |
| `lib/days.mjs`, `bounds.mjs`, `strip.mjs`, `retry.mjs` | Days on the viewer's clock; the days a league has; the date strip and 賽事's chosen day (kept across 全部 and the leagues); failed reads tried again |
| `lib/close.mjs`, `notice.mjs` | 拉鋸; what a change of state is for a notice |
| `lib/meetings.mjs` | The meetings card's bar (近期交手, 上季對戰, 本季對戰): a piece a meeting |
| `lib/follows.mjs` | A match followed on its own: only that game of its league (`matchOnly`), let go once over and told (`endedFollows`) |

## Run and test

```bash
npm test
```

```bash
node ../Orbit-Core/tools/preview.mjs sports --live --width 375
```

`scripts/label-audit.mjs` lists any ESPN stat label without Chinese. A push
to `main` tests, writes `nba-elta.json`, stamps versions and deploys (also
every 6 hours).

## If you change…

| This | Also check |
| --- | --- |
| A league | `leagues.mjs`, picks, Orbit-Core's `builders/` |
| `liveTable` / `title.mjs` | Every table and the title line |
| A session's status | Home cards, 轉播, the weekend sheet, standings, notices |
| `trimF1Live` (Orbit-Core) | The F1 board, 數據, Play's settling |
| A saved key's meaning | Bump its version, remove the old key |
