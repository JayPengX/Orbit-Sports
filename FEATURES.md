# Features kept

Every feature a person uses in Orbit Sports, with the code that makes it.
`tests/features.test.mjs` fails if any mark below disappears, so a refactor can't
drop a feature silently (2026-11-03, after the lost-features audit).
To remove a feature on purpose, delete its line here in the same commit, and say why.

- Break countdowns (half-time, timeouts, quarter breaks) — `public/ui.js`, `public/cards.js`: `breakTick`, `中場休息`
- Win chance and its chart with 關鍵時刻 — `public/sheets.js`, `public/lib/i18n.mjs`: `勝率走勢`, `勝率預測`, `關鍵時刻`
- Line-ups: basketball starters and bench, MLB batting order and bullpen — `public/sheets.js`, `public/lib/lineups.mjs`: `打序`, `牛棚`, `mlbLineups`, `rotowireGame`
- Injuries with return dates — `public/sheets.js`: `回歸待定`
- A game's page holds every part still being read in its shape (先發陣容, 本季數據領先, 傷兵, the table's rows) — `public/sheets.js`, `public/lib/espn.mjs`: `later(`, `holdShape`, `asksLineups`
- Player careers — `public/sheets.js`, `public/lib/career.mjs`: `openPlayer`, `playerCareer`
- Team pages — `public/sheets.js`: `openTeam`
- Follow a game from its page — `public/sheets.js`: `追蹤這場比賽`
- A followed match brings only itself, never its league's other games — `public/lib/follows.mjs`, `public/app.js`: `matchOnly`
- A followed match over leaves the follows once its final is told — `public/lib/follows.mjs`, `public/app.js`: `endedFollows`, `dropEnded`
- A player ESPN lists with an all-star side shows his club — `public/lib/espn.mjs`: `clubOfOverview`
- Replay and highlights on a finished game — `public/sheets.js`: `replayLink`, `精華`
- Title race and clinch lines under tables — `public/lib/title.mjs`, `public/sheets.js`: `standingsRace`, `nextNeeds`
- Official tiebreaks and why level sides are ordered — `public/lib/tiebreak.mjs`: `TIEBREAKS`, `tieNotes`
- Picks for you on 首頁, learning from what's opened and passed over (the kit's one engine, kept on the Pass) — `public/lib/picks.mjs`, `public/app.js`: `scoreMatch`, `feedback.keep`, `whyOf`
- 首頁's lead game with each club on its own colour, its logo on the solid tile — `public/look.js`, `public/look.css`: `paintHero`, `hc-logo`
- 我的球隊 on 首頁: each followed team's place and its next game — `public/look.js`, `public/app.js`: `function teams`, `teamsShelf`
- 首頁 reads the days either side ahead, so a swipe lands on a day already in — `public/app.js`: `function readAround`
- A day with nothing on TV: one clean line and 看完整賽程 (the kit's empty state) — `public/app.js`: `function noTvTitle`, `這天沒有轉播`
- Result notices on the phone — `public/app.js`: `syncPush`
- Channels on cards and every channel on a game page — `public/app.js`, `public/sheets.js`: `頻道`
- Past ELTA's list: every Premier League, Serie A, Bundesliga and Champions League game taken as on ELTA, the NBA's by NBA.com, the channel guessed from ELTA's usual line-up, said 預估 — `public/ui.js`, `public/sheets.js`, `.kit/sports-broadcast.mjs`: `guessTag`, `節目表公布後更新`, `eltaGuess`
- Playoff brackets and series — `public/sheets.js`: `openTie`
- F1 weekends — `public/sheets.js`: `openFieldEvent`
- F1 賽程 cards: a weekend as a panel (the next session's running countdown, the one on, or the podium) beside the circuit's outline (kept on the phone, `sports.wkTrack.v1`), then its sessions as stops on one line, each finished one showing who topped it on their team's colour — `public/app.js`: `weekendCard`
- F1 flags as they stand: red flag, safety car, VSC, yellows, with the clock and the cause — `public/sheets.js`, `public/lib/f1.mjs`: `flagBanner`, `flagNow`, `resumeAt`
- F1 race chart: climbs through the field and numbered moments — `public/lib/f1.mjs`, `public/lib/moments.mjs`, `public/sheets.js`: `placeClimbs`, `'climb'`, `rc-pin`
- F1 title fight live during a race — `public/sheets.js`: `fight-live`, `現在結束`
- F1 driver comparison under a red flag: no gap, no closing rate — `public/sheets.js`: `const held = race && !over`
- F1 過程: the race lap by lap, and each driver's own — `public/lib/f1story.mjs`, `public/sheets.js`: `raceStory`, `f1RaceStory`, `story-pick`
- An F1 driver's birthplace from formula1.com — `public/lib/f1.mjs`: `birthPlaceOf`
- Wide screens: sections dealt into columns — `public/ui.js`: `flowColumns`
