# Orbit Sports: the map

What a viewer in Taiwan would watch: every league on ELTA.tv (愛爾達) or Apple
TV, with scores, schedules, match details, standings, teams and players; a day
planned around what you follow; one tap to watch. F1 has its own live board
from F1's timing. Signs in with the Orbit Pass. Live: https://orbit.jaypengx.com/sports/
`FEATURES.md` lists every feature with its code.

## Leagues

Only what's on TV here (`lib/broadcast.mjs`; leagues from
`kit/catalog.mjs` via `lib/leagues.mjs`):

- **Baseball:** MLB; CPBL (ELTA's selected games).
- **Basketball:** NBA (ELTA's selected games).
- **Soccer on ELTA:** Premier League, Serie A, Bundesliga, Ligue 1,
  Scotland, FA Cup, the three UEFA cups, Nations League.
- **Soccer on Apple TV:** MLS (every game).
- **Racing:** F1 (every session).

A league out of season is hidden (checked by its game days, the nightly
`sports/<league>/days.json`, ESPN's pages only for a league without one;
kept 12 h). A league that couldn't be read is shown, never hidden.

## Rules

Jay's, dated (Taiwan day), newest wins; the family's are in Orbit-Core `docs/RULEBOOK.md`.

**What's shown.**
- 11-04 Code and data only for the leagues Sports shows (the 15 on ELTA or Apple TV, kit `BROADCAST`); nothing kept, built or read for another league. What players' pages need stays (clubs' Chinese and old names, an NBA player's college, LaLiga's photos).
- 10-20 Every break gets a countdown, timeouts too. 10-21 Two sports' games clash only within 30 minutes of each other.
- 10-22 賽事 opens on 全部, never on the first followed league.
- 10-22 NBA 先發 from RotoWire (not ESPN core); injury words from a fixed list, never machine-translated.
- 11-12 An injury report's note is never machine-translated either: code reads its facts (`lib/injurynote.mjs`); a sentence it can't read is left out. ESPN's return dates are America's days: here the next day.
- 10-23 One game page standard for every sport (lineups, 陣容, 傷兵). Cards show one channel row; the game page lists every channel and names whom a player cam follows.
- 10-23 Following a league counts like following a team (its best game on TV each hour); games 00:00–05:00 TW are never "my game". A match followed alone is that game, never its league, and leaves 追蹤 once over and told.
- 10-30 One word, one meaning, one order on every page: 概況 the glance, 賽程 every game, 數據 the numbers, 陣容 the people, 排名 the table, 資料 the facts; every tab row full width.
- 11-03 Past ELTA's published list, TV is predicted: every game of a league ELTA has whole (英超, 義甲, 德甲, 歐冠) is on, the NBA's by NBA.com's list; the channel named only where plain, else 愛爾達; every guess says 預估 and gives way to ELTA's listing; a league ELTA has in part stays 轉播待公布 (kit `eltaGuess`, measured by `scripts/tv-guess.mjs`). An empty ELTA timetable means no sport, not a failure.
- 11-06 A game's card is one game: only a player's face or name opens the player, any other spot the game, a press lights the whole card (`tests/home-recap-card.test.mjs`).
- 11-10 我的聯賽 lives at the top of 追蹤, not on 首頁. 已結束 shows 推薦給你 then 其他比賽. A followed league's pick for an hour is kept as it stood before its games began (`keptChoices`), so 首頁 and 賽事 agree.
- 11-11 A game past its hour that ESPN hasn't started says 即將開賽 (`tests/match-starting.test.mjs`); a basketball game on shows each side's timeouts left (`tests/live-head-timeouts.test.mjs`).

**Numbers and tables.**
- 10-21 Stats show the current season; last season only where this one is empty. A past page shows its own moment, not today's points on top.
- 10-22 Soccer win chance from our own model (score, minute, reds), never a frozen market; 勝負未定 not 拉鋸; no "按住圖表" hints. 10-26 For a game to come, the betting market goes ahead of ESPN's predictor.
- 10-23 Win-probability rows use team logos and shirt colours; the lead row lands on the right play.
- 10-27 Standings card: once first is settled, the race moves to 2nd, then 3rd, down the table until every place is settled.
- 11-01 Sides level on record or points are ordered by their league's official tiebreaks, never at random (`lib/tiebreak.mjs`); the NBA Cup's cards say why in one line. 11-06 No 同分 line under a league table.
- 11-03 近期交手 is the last five meetings at most, each counted by its score (level is a draw, even on penalties, marked PK); one bar across the card, a piece a meeting; never padded.
- 11-14 看點 says only what the page doesn't: never the places or the gap between them (兩隊比較 shows them), nothing at all rather than that (`restatesTable`). A face's team chip is small at its corner, on the card's colour, never a white disc over the face. A live update never draws a table anew (its scroll kept). The cup card says the group, the one 此戰 line and the table, nothing more.
- 11-14 The NBA Cup isn't the playoffs: it lives in the NBA's 排名 (聯盟 · NBA 盃), never under 季後賽. Its groups count the games on as they stand (▲▼); 晉級 / 淘汰 only when every way the games left can go agrees (a tie the margins would settle is never sure).
- 11-14 A 填滿空檔 game is the day's plan like his own: while one is to come or on, 首頁 stays on today. A player with no photo is a person drawn, never a flag. A competition in groups: its live groups first, a game's group on 概況 (`groupCard`). A player's 賽程 is his whole season, never 概況's five again.
- 11-14 AI only for what someone opens (Jay: "only spend it as I use it"): 賽後三句話's why line and 賽前看點 are made the first time anyone opens the game (Orbit-Core `/ai/open`), kept for everyone; never made ahead for every game. F1's 勝負關鍵 waits (stories made before stay).
- 11-06 No green in the playoff bracket (a clinched seed in the text's own colour); where there's room the bracket shows every round at once.
- Tables count finals at once (`liveTable`), never a game still on; table zones stay with their places as results reorder them. A game is over when the rules say so (`overByRule`), not when ESPN marks it.
- A streak (連勝敗) counts every game the form chips are from; F1's 本季走勢 runs on across a retirement (a cross on the floor).

**Notices and steadiness.**
- 10-22 Result notices checked every 2 minutes, the first check at the sport's shortest length. CPBL closed-app result notices stay broken until next season; revisit sources before spring.
- 11-03 A game's page draws once and holds every part read after it: each read past the game's own goes through `openMatch`'s `later(key, read)` and is drawn from the start in its shape (`tests/game-page.test.mjs`). 11-05 It holds still in Safari through live refreshes (`node ../Orbit-Core/tools/live-scroll.mjs sports --webkit`).
- 10-27 Swipes: 賽事's tabs swipe where there's no date strip (F1's 賽程 too) and past the last or first tab to the next league; team and player tabs swipe; not a game page (its charts take the finger).
- A followed league is never hidden by a failed read. A called-off game opens nothing (延期 in its place). The injury report is on team pages only. Players and drivers named in English in both languages; teams in Chinese.
- 11-10 The family's AI only where it adds: 賽後三句話 and 賽前看點 say what the card doesn't (no line when nothing explains it); names as chips (a player's face, a team's logo).

## How it works

- **Tabs:** 首頁 (what to watch: the day strip, the lead game, 正在進行, 我的比賽 as the day's plan from `dayPlan`, with 填滿空檔 the free hours filled by `picks.mjs worth`; 更多賽事, 我的球隊, 已結束; on a wide screen a board of three even tracks, `homeBoard`) · 賽事 (a league: 賽程, 排名, 季後賽, 數據; the NBA's 排名 also its cup, 聯盟 · NBA 盃; F1's weekends as cards) · 轉播 (when and where, ELTA's whole guide) · 追蹤 (我的聯賽, teams, players, matches, drivers, 設定, 問比賽). Look: `look.js`, `look.css` (the lead game's club colours, `sideColors`).
- **A day is drawn once:** its first drawing waits in its shape until every league of theirs is read (`dayWaits`, `holdDay`, `liveShape`), the days either side read ahead (`readAround`); finished games' top players (`gameRecap`) read with it.
- **Sheets** (`sheets.js`): a match (header, live panel, then 概況, 數據, 球員, 過程, 先發, 場上球員, 陣容, 傷兵, 本季數據領先, 排名, 比賽資訊 in the moment's order), a race weekend, a team, a player (career from ESPN, FotMob, Jolpica: `lib/career.mjs`), an F1 driver (`lib/f1driver.mjs`), a constructor. Wide sheets deal cards with the kit's `flowColumns` (never CSS columns: Safari put them all on the left).
- **Win chance:** ESPN's line, else Polymarket's; a game to come: the sportsbook's moneylines (margin removed), else Polymarket's, else ESPN's model. Soccer's own model (`lib/soccerwp.mjs`: Poisson over the time left from the pre-game odds, the score, the minute, reds). Key moments (`moments.mjs`).
- **F1 live board** (the proxy's `f1-live.orbit`): 排名 · 過程 (`lib/f1story.mjs raceStory`) · 賽道 (`lib/carpace.mjs`) · 輪胎 · 圈速 · 積分; race control in Chinese (`lib/racecontrol.mjs`); the flag now (`flagNow`, `flagBanner`).
- **Tables, playoffs, tiebreaks:** `lib/title.mjs` (`liveTable`, the title line's margins), `playoffs.mjs`, `bracket.mjs`, `nbacup.mjs`, `tiebreak.mjs`.
- **Where to watch** (`lib/tv.mjs`): ELTA's own schedule, NBA.com's ELTA list (`public/nba-elta.json`, every 6 h by the deploy), Apple TV per MLS game; the kit's `eltaGuess` past the list. Replays and highlights from R2's `watch.json`.
- **Picks** (`lib/picks.mjs`): followed leagues and teams, quality, closeness, stakes from the table in a season's last eighth (`raceOf`), fame, `STARS`, live now; learnt by the kit's `feedback.mjs` (`fb:match` on the Pass).
- **Data:** ESPN through the kit's `proxyJson` (`lib/espn.mjs`; the scoreboard parser is the kit's `sports-espn.mjs`); seasons and game days from R2 packs; finished games kept in R2 on first read; MLB, CPBL, F1, Jolpica, formula1.com, FotMob, Polymarket through the proxy (some read by the phone first, Orbit-Core `MAP.md` §5.1).
- **Refresh** at the owner's speeds (lists 5 s, an open game 3 s, F1 4–15 s, today whole every 2 minutes), patched in place (`put`, `morph`; drawn pictures kept, `lib/pictures.mjs`).
- **Notices** (the kit's `match` kinds): a followed team's start and final, each pick's, F1 sessions and podiums; a tap opens `#game=<league>/<id>/<day>`.
- **The family:** `tellFollows`, `tellNext` into the phone's notebook (News' 你關心的, the Pass's 今天, Class's calendar); 去球場 and 球場天氣 (`lib/parks.mjs`, Transit's planner); 相關新聞 on a player's, team's and game's page (`lib/news.mjs`, News' stories).
- **Saved:** the Pass payload `{ v: 4, leagues, follows, games, audio, t }`; on the phone `fx.day.v4`, `fx.active.v2`, `fx.f1live.v2`, `fx.f1ended`, `fx.chosen.v1`. **Offline:** covered (`onlineOnly`); never old scores as now.
- The kit's `sports-*.mjs` run in the proxy's builders too, so they import nothing but each other.

## Files (`public/`)

| File | What |
| --- | --- |
| `app.js` | The tabs, follows, days, picks, notices, live ticks |
| `sheets.js` | Every sheet: match, race weekend, team, player, constructor, tables, series |
| `ui.js`, `cards.js`, `styles.css` | DOM helpers, rows; the tabs' cards and tiles; the app's styles |
| `look.js`, `look.css` | Orbit's own look: the lead game's club colours, 我的球隊, and the look's overrides of the old card |
| `testing.mjs` | Sports' own switches in the kit's 測試工具 (flags change what's shown, never the Pass; the notice list isn't sent while one is on): `liveGame`, `startSoon` (in10/due), `gameOff` (void/delayed), `emptyDay` (app.js `readDay` → `testDay`), `f1Flag` (red/sc/vsc, `lib/f1.mjs flagNow`), `aiCap` (`ask.js`) |
| `lib/espn.mjs` | Every read and parser (the scoreboard parser is the kit's `sports-espn.mjs`); `sessionStatus` |
| `lib/f1.mjs`, `racecontrol.mjs` | F1 data and the board's maths; race control in Chinese |
| `lib/title.mjs`, `playoffs.mjs`, `bracket.mjs`, `tiebreak.mjs` | Live tables and title race (`liveTable`'s `live`: the games on now as they stand, marked, on 排名 and a game's 排名 only; the races on finals); playoffs; tiebreaks |
| `lib/leaders.mjs` | 數據領先: stats, ranks, team and player |
| `lib/teamstats.mjs` | Teams' own numbers ranked in their league (數據 球隊) |
| `lib/picks.mjs`, `foryou.mjs` | Today's picks; affinity |
| `lib/broadcast.mjs`, `tv.mjs`, `highlights.mjs` | Where to watch (the kit's, shared with the proxy); channels; videos |
| `lib/winprob.mjs`, `soccerwp.mjs`, `wpline.mjs`, `moments.mjs` | Win chance line and key moments (basketball's are its runs, three in four of the points and 8 or more ahead, each told at its last basket: `runMoments`; a basket answered at once by as much isn't one: `answered`); the chart's top half is the side the cards put first; soccer's line moves with each side's shots as rough xG (`shotsOf`, `shownRates`); a game over said by its odds before (`gameArc`: 賽前勝率, 爆冷, 最低曾剩) |
| `lib/why.mjs` | 賽後三句話's why line (the family's AI, Jay 11-10): `/data/sports/recaps/<Taiwan day>.json`, made once a game by Orbit-Core's `builders/recaps.js`; read once a day file (kit `packJson`) and drawn first in a finished game's story panel. v2 (Jay 11-10: it said the leaders again): only what the card doesn't show (code's comebacks, runs, ahead for good, the period that broke it open; no line when nothing explains it), its teams and players as tokens drawn as chips (`whyPieces`: a player with his face, a team by its name, each opening its page; sheets.js `whyNodes`); a file from before v2 is never read; F1's race story: 勝負關鍵, 2–4 moments as rows (`f1PointsFrom`: each its lap, the driver's face, one line; Jay 11-10: never a paragraph), `/data/sports/f1/stories/<year>.json` v2 (Orbit-Core's `builders/f1story.js`), on the weekend sheet; an older file's text still drawn (`f1StoryFrom`) |
| `lib/parks.mjs` | 去球場 and 球場天氣 (the family working together, Jay 11-10): CPBL parks by name (OpenStreetMap places; the dome roofed); a game within two days gets 怎麼去 under its park (Orbit Transit plans the trip, there half an hour early; the kit's `family.mjs` `planHash`, an older kit: none) and the park's weather for its hours (Open-Meteo from the phone; 可能因雨延賽 at 60% or 2 mm) |
| `lib/news.mjs` | 相關新聞 (the family's links, Jay 11-13): Orbit News' sports stories (Orbit-Core `news/sport.json`, read at the start and every 10 min, the phone's copy first) matched on the phone by the kit's `news-sport.mjs` (`newsAbout`; a story the AI has read by its own words and the AI's names, never only a link's headline): `playerNews` (his own; his injury's on his injury card), `teamNews`, `gameNews` (both sides from 3 days before to a day after; either side's injuries first; the world's sports outlets ahead of Taiwan's, which fill in, one at most where the world's have the game); `sheets.js` `newsCard` (the Orbit AI mark), a row opening the story in Orbit News (`ctx.q.go('news', 's=<id>')`: in place in Orbit). An older kit: none |
| `app.js` `tellFollows`, `tellNext` | The teams and players followed (English and Chinese names, `sports.follows`, for Orbit News' 你關心的) and their games starting within a day (`sports.next`, as the start notices say them, for the Orbit Pass's 今天) and within 8 days (`sports.games`, with about how long each lasts by its sport, `gameMins`: Orbit Class's 加到行事曆 and Orbit 助理), into the phone's family notebook (kit `family.mjs`) |
| `lib/ask.mjs`, `ask.js` | 問比賽 (the family's AI plan): what the phone has read of the teams and leagues followed laid out as tables (`askTables`: `mine` places, `next`, `last`, `table.<league>`, `today`) and told the AI a line a table (`askFacts`); `ask.js openAsk` is the sheet (the kit's `aiBar` as its foot, `aiAnswerWait` while it thinks, `aiAnswer` with each team's logo, rows opening the team or game); app.js `askSource` hands it the data, `askRow` is its way in at the top of 追蹤 (ask.js read on the tap); 問 Orbit's `#ask=<words>` (kit `takeAsk`, `askFromLink`) opens it asked. A why line's teams (with their logo) and players (with their face) are kit `.q-ai-ref` chips, each chipped once a line (`whyPieces` `again`) |
| `lib/preview.mjs` | 賽前看點 for a game to come and while it's on, not once over: the family's AI's points (`previewFrom`: up to two, made once by Orbit-Core's `builders/previews.js` into `/data/sports/previews/<day>.json`, each with a kind for its icon, teams and players as tokens), drawn by sheets.js `previewBox`; until then, or where the AI found nothing, code's one line: two sides of a table close to each other, a football run past the last five (`previewLine`) |
| `lib/plays.mjs` | Basketball's plays by stoppage (`foldPlays`: a free-throw trip one row with its foul, an and-one on its basket, the changes one row) for 過程, 最新 and the closing stretch; a game on at a glance (`liveState`: the run on now, a drought, lead changes) for the live panel's chips |
| `lib/hoops.mjs` | A basketball player's season beyond ESPN's four, from his season's own log (`hoopsSeason`: true and effective shooting, two-point %, three and free-throw rates, per 36, assists per turnover, double-doubles and 20/30/40-point games, his highs with their games, last five against the season, points game by game; a game he sat out or one on now never counted); ESPN's `/splits` read (`parseSplits`: home and road, wins and losses, each month). Drawn by `sheets.js` `hoops*Card` on the player's 概況 and 數據 |
| `lib/live.mjs`, `lineups.mjs`, `onfield.mjs`, `mlb.mjs`, `cpblbox.mjs` | Live state; starters (MLB's own, the NBA's from RotoWire through the proxy: ESPN's core API refuses it); who's on (and at a break, who came on in it: `courtStop`); MLB and CPBL fill-ins |
| `lib/leagues.mjs`, `search.mjs`, `statnames.mjs`, `stage.mjs`, `compname.mjs`, `i18n.mjs`, `text.mjs` | Leagues; search; Chinese names for stats, stages and competitions; text |
| `lib/days.mjs`, `bounds.mjs`, `strip.mjs`, `retry.mjs` | Days on the viewer's clock; the days a league has; the date strip and 賽事's chosen day (kept across 全部 and the leagues); 首頁's way back from a sport chip (`sportBack`); failed reads tried again |
| `lib/close.mjs`, `notice.mjs` | 拉鋸; what a change of state is for a notice; `pickFinals`: which picks' finals (今日推薦賽果) go on the Worker's list (today's and tomorrow's ahead, never one already over put on late) |
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
| `trimF1Live` (Orbit-Core) | The F1 board, 數據 |
| A saved key's meaning | Bump its version, remove the old key |
