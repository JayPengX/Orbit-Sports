# Features kept

Every feature a person uses in Orbit Sports, with the code that makes it.
`tests/features.test.mjs` fails if any mark below disappears, so a refactor can't
drop a feature silently (2026-11-03, after the lost-features audit).
To remove a feature on purpose, delete its line here in the same commit, and say why.

- Break countdowns (half-time, timeouts, quarter breaks) — `public/ui.js`, `public/cards.js`: `breakTick`, `中場休息`
- Win chance and its chart with 關鍵時刻 — `public/sheets.js`, `public/lib/i18n.mjs`: `勝率走勢`, `勝率預測`, `關鍵時刻`
- Line-ups: basketball starters and bench, MLB batting order and bullpen — `public/sheets.js`, `public/lib/lineups.mjs`: `打序`, `牛棚`, `mlbLineups`, `rotowireGame`
- Injuries with return dates — `public/sheets.js`: `回歸待定`
- Player careers — `public/sheets.js`, `public/lib/career.mjs`: `openPlayer`, `playerCareer`
- Team pages — `public/sheets.js`: `openTeam`
- Follow a game from its page — `public/sheets.js`: `追蹤這場比賽`
- A followed match brings only itself, never its league's other games — `public/lib/follows.mjs`, `public/app.js`: `matchOnly`
- A followed match over leaves the follows once its final is told — `public/lib/follows.mjs`, `public/app.js`: `endedFollows`, `dropEnded`
- A player ESPN lists with an all-star side shows his club — `public/lib/espn.mjs`: `clubOfOverview`
- Replay and highlights on a finished game — `public/sheets.js`: `replayLink`, `精華`
- Title race and clinch lines under tables — `public/lib/title.mjs`, `public/sheets.js`: `standingsRace`, `nextNeeds`
- Official tiebreaks and why level sides are ordered — `public/lib/tiebreak.mjs`: `TIEBREAKS`, `tieNotes`
- Picks for you on 首頁, learning from habits — `public/lib/picks.mjs`, `public/app.js`: `scoreMatch`, `habitOf`
- Result notices on the phone — `public/app.js`: `syncPush`
- Channels on cards and every channel on a game page — `public/app.js`, `public/sheets.js`: `頻道`
- Playoff brackets and series — `public/sheets.js`: `openTie`
- F1 weekends — `public/sheets.js`: `openFieldEvent`
- Wide screens: sections dealt into columns — `public/ui.js`: `flowColumns`
