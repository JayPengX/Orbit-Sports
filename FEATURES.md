# Features kept

Every feature a person uses in Orbit Sports, with the code that makes it.
`tests/features.test.mjs` fails if any mark below disappears, so a refactor can't
drop a feature silently (2026-11-03, after the lost-features audit).
To remove a feature on purpose, delete its line here in the same commit, and say why.

- Break countdowns (half-time, timeouts, quarter breaks) — `public/ui.js`, `public/cards.js`: `breakTick`, `中場休息`
- A basketball timeout keeps the game clock beside its countdown (第4節 2:10 · 暫停 0:20; a row's three lines), and a game on now shows each side's timeouts left under its record (暫停剩 2, ESPN's summary) — `public/lib/live.mjs` `liveLabel`, `public/ui.js` `statusEl`, `public/sheets.js` header
- Win chance and its chart with 關鍵時刻 — `public/sheets.js`, `public/lib/i18n.mjs`: `勝率走勢`, `勝率預測`, `關鍵時刻`
- Line-ups: basketball starters and bench, MLB batting order and bullpen — `public/sheets.js`, `public/lib/lineups.mjs`: `打序`, `牛棚`, `mlbLineups`, `rotowireGame`
- Injuries with return dates — `public/sheets.js`: `回歸待定`
- A game's page holds every part still being read in its shape (先發陣容, 本季數據領先, 傷兵, the table's rows) — `public/sheets.js`, `public/lib/espn.mjs`: `later(`, `holdShape`, `asksLineups`
- Basketball's plays read by stoppage: a free-throw trip one row (兩罰一中) with the foul under it, an and-one on its basket, a stoppage's changes one row (過程, 最新, the closing stretch) — `public/lib/plays.mjs`, `public/sheets.js`: `foldPlays`, `tripZh`, `加罰`
- A basket the other side answered at once with as much is not a key moment — `public/lib/moments.mjs`: `answered(`
- A game over: the win chart says each side's chance before it, an upset and the winner's lowest (賽前勝率 · 爆冷勝出 · 最低曾剩) — `public/lib/wpline.mjs`, `public/sheets.js`: `gameArc`, `賽前勝率`, `爆冷勝出`
- Soccer's win chance moves with each side's shots, not only goals — `public/lib/soccerwp.mjs`, `public/sheets.js`: `shotsOf`, `shownRates`
- 賽後三句話's why line: a finished game's one line on why it went that way (the AI, made once a game by Orbit-Core's `builders/recaps.js`, never repeating the score), first in the game's story panel with the AI's spark — `public/lib/why.mjs`, `public/sheets.js`: `whyLine`, `lp-why`
- 去球場 and 球場天氣: a CPBL game within two days at a known park gets 怎麼去 under the park (Orbit Transit plans the trip, there half an hour before) and the park's weather for the game's hours, 可能因雨延賽 when rain is likely (never under the dome) — `public/lib/parks.mjs`, `public/sheets.js`: `goPark`, `parkWeather`
- 賽前看點: a game to come gets one line on why it matters over 兩隊比較 (two sides close in the table, how many games or points apart; nothing notable, no line) — `public/lib/preview.mjs`, `public/sheets.js`: `cmp-why`
- A basketball game on at a glance: the run on now, a side without a field goal, foul trouble, lead changes — `public/lib/plays.mjs`, `public/sheets.js`: `liveState`, `liveChips`, `攻勢`, `未投進`
- Live standings: the games on now counted as they stand, each side's score and move, said 即時排名 (排名 and a game's 排名) — `public/lib/title.mjs`, `public/sheets.js`, `public/app.js`: `live: true`, `即時排名`, `live-score`
- A basketball player's season in depth (概況: 每場得分 bars, a tap on one reads that game, last five against the season; 數據: 投籃效率, 每 36 分鐘, 本季單場最高 opening each game, 分項數據 home/road, wins/losses, months) — `public/lib/hoops.mjs`, `public/lib/espn.mjs`, `public/sheets.js`: `hoopsSeason`, `parseSplits`, `athleteSplits`, `hoopsFormCard`, `hoopsShootingCard`, `hoopsMoreCard`, `hoopsHighsCard`, `hoopsSplitsCard`
- Player careers — `public/sheets.js`, `public/lib/career.mjs`: `openPlayer`, `playerCareer`
- Team pages — `public/sheets.js`: `openTeam`
- Follow a game from its page — `public/sheets.js`: `追蹤這場比賽`
- A followed match brings only itself, never its league's other games — `public/lib/follows.mjs`, `public/app.js`: `matchOnly`
- A followed match over leaves the follows once its final is told — `public/lib/follows.mjs`, `public/app.js`: `endedFollows`, `dropEnded`
- A player ESPN lists with an all-star side shows his club — `public/lib/espn.mjs`: `clubOfOverview`
- Replay and highlights on a finished game — `public/sheets.js`: `replayLink`, `精華`
- Title race and clinch lines under tables — `public/lib/title.mjs`, `public/sheets.js`: `standingsRace`, `nextNeeds`; a line whose day (1/28) is still being read is drawn waiting, never 第 N 場 first: `clinchPending`
- Official tiebreaks order level sides — `public/lib/tiebreak.mjs`: `TIEBREAKS`, `tableKey`
- Picks for you on 首頁, learning from what's opened and passed over (the kit's one engine, kept on the Pass) — `public/lib/picks.mjs`, `public/app.js`: `scoreMatch`, `feedback.keep`, `whyOf`
- 首頁's lead game with each club on its own colour, its logo on the solid tile — `public/look.js`, `public/look.css`: `paintHero`, `hc-logo`
- 我的球隊 on 首頁: each followed team's place and its next game — `public/look.js`, `public/app.js`: `function teams`, `teamsShelf`
- 首頁 reads the days either side ahead, so a swipe lands on a day already in — `public/app.js`: `function readAround`
- 首頁's sport chips move to a day that sport plays; 全部 or 我的比賽 goes back to the day and place left (unless a day was picked meanwhile) — `public/lib/strip.mjs`, `public/app.js`: `sportBack`, `pickFilter`
- A day with nothing on TV: one clean line and 看完整賽程 (the kit's empty state) — `public/app.js`: `function noTvTitle`, `這天沒有轉播`
- Result notices on the phone — `public/app.js`: `syncPush`
- Channels on cards and every channel on a game page — `public/app.js`, `public/sheets.js`: `頻道`
- Past ELTA's list: every Premier League, Serie A, Bundesliga and Champions League game taken as on ELTA, the NBA's by NBA.com, the channel guessed from ELTA's usual line-up, said 預估 — `public/ui.js`, `public/sheets.js`, `.kit/sports-broadcast.mjs`: `guessTag`, `節目表公布後更新`, `eltaGuess`
- 愛爾達節目表: every channel's showings a day at a time, full height, a swipe across it the next or the day before — `public/app.js`: `openGuide`, `daySwipe`
- Playoff brackets and series — `public/sheets.js`: `openTie`
- F1 weekends — `public/sheets.js`: `openFieldEvent`
- F1 賽程 cards: a weekend as a panel (the next session's running countdown, the one on, or the podium) beside the circuit's outline (kept on the phone, `sports.wkTrack.v1`), then its sessions as stops on one line, each finished one showing who topped it on their team's colour — `public/app.js`: `weekendCard`
- F1 flags as they stand: red flag, safety car, VSC, yellows, with the clock and the cause — `public/sheets.js`, `public/lib/f1.mjs`: `flagBanner`, `flagNow`, `resumeAt`
- F1 race chart: climbs through the field and numbered moments — `public/lib/f1.mjs`, `public/lib/moments.mjs`, `public/sheets.js`: `placeClimbs`, `'climb'`, `rc-pin`
- F1 title fight live during a race — `public/sheets.js`: `fight-live`, `現在結束`
- F1 driver comparison under a red flag: no gap, no closing rate — `public/sheets.js`: `const held = race && !over`
- F1 過程: the race lap by lap, and each driver's own — `public/lib/f1story.mjs`, `public/sheets.js`: `raceStory`, `f1RaceStory`, `story-pick`
- An F1 driver's page: season strip, 本季走勢 chart, next weekend card, 隊友對比 bars, a row a race — `public/sheets.js`, `public/lib/f1driver.mjs`: `f1Strip`, `f1FormCard`, `f1MateCard`, `f1RunRows`, `seasonRuns`, `mateDuel`
- An F1 race weekend on a wide sheet: the order beside 勝率走勢 and the weekend's cards — `public/sheets.js`, `public/styles.css`: `wk-cols`, `wk-side`
- 勝率走勢 (F1): every moment at the lap a finger is on — `public/lib/wpline.mjs`: `momentsAt`
- An F1 driver's birthplace from formula1.com — `public/lib/f1.mjs`: `birthPlaceOf`
- Wide screens: sections dealt into columns — `public/ui.js`: `flowColumns`
