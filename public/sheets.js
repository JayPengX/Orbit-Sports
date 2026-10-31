// Orbit Sports' sheets: a match (header, then its data by section), a
// race weekend, a team, a player, and the
// standings tables they share with the Standings tab.
import { translate, proxyJson, packJson, everyDev, dev } from '#kit/orbit.mjs';
import * as kitUI from '#kit/ui.mjs';
import { searchUrl, videoUrl, knownHighlights, findHighlights, highlightsKind, watchMonthWanted, loadWatchMonth } from './lib/highlights.mjs';
import { teamNameZh } from '#kit/names.mjs';
import { splitName, otherName, compName as compWord } from './lib/compname.mjs';
import { playerCareer, draftOf, seasonsIn } from './lib/career.mjs';
import { SESSION_NAMES, returnWord, mlbGameLog, regularTally, caughtUp, weekOf, winLine, winNow, raceWinLine, scoreboard, splitWeekend, settleField, summary, cpblGame, teamInjuries, mergeInjuries, withoutPlayed, standings, team, teamSchedule, roster, athlete, athleteOverview, STANDING_COLUMNS, COMPACT_COLUMNS, sessionName, seasonEvents, leagueForm, resultFor, outcome, sideScore, sidesFor, driverSeason, leagueInjuries, homeLeague, roundLabel, roundKind, feedStatus, sessionStatus, dueToStart, pregameLineups, seasonAverages, rosterAverages, leagueAverages, teamLeaders, leagueLeaders, teamStatRanks, leagueTeamStats, fotmobTeamList, logSeasonLine, logSeason, clubAbroad } from './lib/espn.mjs';
import { stageTag, groupName } from './lib/stage.mjs';
import { tableStarted } from './lib/picks.mjs';
import { onCourt, onPitch, pitchSpots } from './lib/onfield.mjs';
import { playPeriod } from './lib/live.mjs';
import { personKey, pitcherRole } from './lib/mlb.mjs';
import { lineXs, periodMarks, pointStamp, stampAt, quietRuns, periodName, nearestMoment, holdToEnd, sideColors, readableOn, hasHue } from './lib/wpline.mjs';
import { playMoments, eventMoments, raceMoments, scoreAt, bandName, lateClock, feedText, playParts, playText, goalHowParts, basketEn } from './lib/moments.mjs';
import { controlBands, causeOf, PM_LEAGUE } from './lib/winprob.mjs';
import { soccerLine } from './lib/soccerwp.mjs';
import { statName, boxHead, statsTitle, metric, fixedWord, dateText, injuryZh, injuryWhatZh, seriesLineZh, weatherZh, pitchZh, posZh, standingZh, leaderValue, teamStatRows } from './lib/statnames.mjs';
import { f1Driver, f1Constructor, countryName, logoPicture, countryFlag } from '#kit/logos.mjs';
import { isFlag } from '#kit/photos.mjs';
import { raceControlParts } from './lib/racecontrol.mjs';
import { lapRate, readCar, stepCar, spread, behindLeader, apart, placeTags } from './lib/carpace.mjs';
import { fold, surname, esc } from './lib/text.mjs';
import { driverAbout, f1Official, f1Label, f1Value, finishOf, eventOfRace, raceResult, qualifyingResult, espnQualifying, liveTiming, keptTiming, qualiCut, feedOver, feedBreak, sessionTiming, sessionLaps, circuitMap, lapMs, practicePace, MIN_RUN, PRACTICE_SPAN, lapTicks, pitLaps, pushLaps, gapsBetween, closingRate, recentPace, neutralLaps, pointsFor, asItStands, standingAfter, settleScoring, liveLapEnds, liveRaceEvents, circuitFacts, lastPodium, weekendCircuit, circuitWeather } from './lib/f1.mjs';
import { tvOf, replayOf, camKnownOf, camPlayerOf } from './lib/tv.mjs';
import { parseSearch } from './lib/search.mjs';
import { hasLeaders, playerRanks } from './lib/leaders.mjs';
import { broadcastsOf, twSource, ELTA_VOD_LEAGUES, guideWhen } from './lib/broadcast.mjs';
import { LEAGUES, leagueName, hasTeamPage, hasStandings } from './lib/leagues.mjs';
import { SEASON_GAMES, liveTable, roundCounted, roundOf, pctText, gbText, nextNeeds } from './lib/title.mjs';
import { FORMATS } from './lib/playoffs.mjs';
import { teamKey, leagueKey } from './lib/foryou.mjs';
import { f1Shown, leagueChip, ctx, el, shownStart, timeText, leagueMark, put, spinner, empty, skeleton, logo, diamond, clock, dayLabel, localDate, statusText, breakTick, whenOf, eventRow, sheet, segmented, seriesText, tvName, watchLink, watchButton, scoreText, mmss, audioName, sessionTag, raceFlag, personPic, sideLogo, withHome, today, sidesOf } from './ui.js';

const L = () => ctx.locale;
const T = (k, v) => ctx.t(k, v);
// ESPN's English words ("Right Fielder", "Hasselt, Belgium"), in Chinese once
// translated (a text node that changes when the translation comes; kept 30
// days per line). Empty stays empty.
// `from`: the text's language when it's known (ESPN's stories: 'en', which
// Google translates better than its guess, in traditional characters).
export function zhLater(text, from = 'auto', after = x => x) {
  if (!text) return '';
  if (L() === 'en' || !/[A-Za-z]/.test(text)) return after(text);
  const fixed = fixedWord(text, L());
  if (fixed) return fixed;
  const node = document.createTextNode(after(text));
  translate(text, 'zh-TW', from).then(zh => zh && (node.textContent = after(zh))).catch(() => {});
  return node;
}
// A player's name in English in both languages (Jay, 2026-10-23: never
// 多諾萬·米切爾; teams stay in Chinese): `full` the whole name ("Donovan
// Mitchell"), `short` the box score's ("D. Mitchell").
const playerName = (full, form = 'full', shown = full) => (form === 'full' ? full || shown : shown || full) || '';
// (A status not in the list: its words from the fixed list, never Google's guess.)
const injuryText = s => (L() === 'en' ? s : injuryZh(s) || injuryWhatZh(s) || '傷兵');
const weatherText = w => weatherZh(w, L());
// The game's sides in the order the cards show them (soccer home first, the rest away first).
const homeFirst = e => String(sidesOf(e)[0]?.id) === String(e.home?.id);
const inOrder = (e, [away, home]) => (homeFirst(e) ? [home, away] : [away, home]);
// The last meetings at a glance: each side's logo, name and wins, the draws
// between, and one bar split by them (a sentence wrapped its parts apart).
function h2hView({ n, wins, draws, noDraw = false }, e) {
  const en = L() === 'en';
  const side = (x, cls) => el('div', { class: `h2h-side ${cls}` }, [teamTap(x, e.league, 'h2h-who', [logo(x.logo, x.name, 'sm'), el('span', { class: 'h2h-name', text: x.short || x.name })]), el('div', { class: 'h2h-score' }, [el('strong', { class: 'num h2h-n', text: String(wins[x.id] || 0) }), el('small', { text: en ? 'won' : '勝' })])]);
  const share = k => `flex-grow:${k}`;
  const [a, h] = [wins[e.away.id] || 0, wins[e.home.id] || 0];
  return el('div', { class: 'h2h' }, [
    // (A sport without draws: none between them.)
    el('div', { class: 'h2h-row' }, [side(homeFirst(e) ? e.home : e.away, 'away'), noDraw ? el('div', { class: 'h2h-draw' }, [el('small', { class: 'muted', text: 'vs' })]) : el('div', { class: 'h2h-draw' }, [el('strong', { class: 'num h2h-n', text: String(draws || 0) }), el('small', { text: en ? 'drawn' : '和局' })]), side(homeFirst(e) ? e.away : e.home, 'home')]),
    // Each side's bar in the shirt it wears in this game (the win chart's colours: tintOf), the draws grey.
    n ? el('div', { class: 'h2h-bar', 'aria-hidden': 'true', style: (c => `--home:${c.home};--away:${c.away}`)(tintOf(e)) }, inOrder(e, [a ? el('i', { class: 'away', style: share(a) }) : null, h ? el('i', { class: 'home', style: share(h) }) : null]).flatMap((x, i) => (i === 0 ? [x, draws ? el('i', { class: 'draw', style: share(draws) }) : null] : [x]))) : null
  ]);
}
// No meeting this season yet: last season's, as football's head-to-head is
// drawn (each side's wins, one bar), then each game: the day, both sides
// with their scores, the winner's strong; a tap opens it.
// Meetings, each a row (its date, both sides by logo and score, the winner
// bold), under who won how many: last season's, this season's, a playoff
// series; the game open now marked.
function meetingsCard(title, sub, games, e, { wins = null } = {}) {
  const team = t => [e.home, e.away].find(x => String(x?.id) === t.id) || t;
  const tally = wins || games.reduce((w, g) => (([g.home, g.away].forEach(t => t.winner && (w[t.id] = (w[t.id] || 0) + 1))), w), {});
  const row = g => {
    // (Each game in the page's order of the two, whoever was at home then.)
    const [first, second] = String(sidesOf(e)[0]?.id) === g.home.id ? [g.home, g.away] : [g.away, g.home];
    // (Each side by its logo and score: the names are the card's header.)
    const side = (t, right) => el('span', { class: `ls-side${right ? ' right' : ''}${t.winner ? ' win' : ''}`, title: team(t).short || t.short || t.abbr }, right ? [el('b', { class: 'num', text: t.score }), logo(team(t).logo || t.logo, t.name, 'xs')] : [logo(team(t).logo || t.logo, t.name, 'xs'), el('b', { class: 'num', text: t.score })]);
    const here = g.id === String(e.id);
    return el('button', { class: `ls-game${here ? ' now' : ''}`, type: 'button', disabled: here ? true : null, onclick: () => ctx.openEvent({ id: g.id, league: e.league, kind: 'match', start: g.date, status: { state: 'post', detail: '', short: '', completed: true }, home: { ...team(g.home), score: g.home.score }, away: { ...team(g.away), score: g.away.score } }) }, [el('span', { class: 'ls-date num', text: localDate(Date.parse(g.date)).slice(5).replace('-', '/') }), side(first), el('span', { class: 'ls-dash', text: '–' }), side(second, true), el('span', { class: 'ls-chev', 'aria-hidden': 'true', text: here ? '' : '›' })]);
  };
  return card(title, el('div', {}, [h2hView({ n: games.length, wins: tally, draws: 0, noDraw: true }, e), el('div', { class: 'ls-games' }, games.map(row))]), { sub });
}
function lastSeriesCard(ls, e) {
  const en = L() === 'en';
  return meetingsCard(en ? 'Last season' : '上季對戰', en ? `${ls.season} regular season · ${ls.n}` : `${ls.season} 例行賽 · ${ls.n} 場`, ls.games, e, { wins: ls.wins });
}
// This game's own series, as it stood when this game ended (a past game's
// never the meetings after it): the regular season's 本季對戰, a playoff's
// series by its round; the newest first.
function ownSeriesCard(s, e) {
  const en = L() === 'en';
  const at = Date.parse(e.start) + 6 * 3_600_000;
  const games = (s.games || []).filter(g => Date.parse(g.date) <= at).sort((x, y) => y.date.localeCompare(x.date));
  if (!games.length) return null;
  const playoff = s.kind === 'playoff';
  // (A game long over: that season's, never read as this one's.)
  const then = Date.now() - Date.parse(e.start) > 36 * 3_600_000;
  const title = playoff ? stageTag(e, L()) || (en ? 'Playoff series' : '季後賽系列賽') : en ? (then ? 'Series that season' : 'Season series') : then ? '當季對戰' : '本季對戰';
  const sub = playoff ? (en ? `Playoffs · ${games.length}` : `季後賽 · ${games.length} 場`) : en ? `Regular season · ${games.length}` : `例行賽 · ${games.length} 場`;
  return meetingsCard(title, sub, games, e);
}
// A series' line in the reader's words (the sides by their names here).
export function seriesZh(text, e) {
  if (L() === 'en') return text;
  const name = abbr => [e.home, e.away].find(s => s?.abbr && s.abbr.toUpperCase() === String(abbr).toUpperCase())?.short || abbr;
  return seriesLineZh(text, name) || text;
}
// Strings and nodes joined by a separator, as nodes.
const joinNodes = (items, sep) => items.filter(Boolean).flatMap((x, i) => (i ? [sep, x] : [x])).map(x => (typeof x === 'string' ? document.createTextNode(x) : x));

// A preseason guest's league, said under its name where a record would be.
const GUEST_FROM = { 'London Lions': ['英國職籃', 'British basketball'] };

// ---- A match ----------------------------------------------------------------------------

// A side's record the moment its game ends (Jay, 2026-10-21: everything
// reflects at once): ESPN's is tonight's result behind for a while, so a
// regular-season final whose record is still the one seen before it (or a
// side's 0-0, which a team that's played can't be) counts the result itself.
export function recordNow(rec, side, other, { state, seasonType, before } = {}) {
  const m = /^(\d+)-(\d+)$/.exec(rec || '');
  if (!m || state !== 'post' || seasonType !== 2) return rec || '';
  const [w, l] = [Number(m[1]), Number(m[2])];
  const [a, b] = [Number(side?.score), Number(other?.score)];
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b || !(w + l === 0 || before === rec)) return rec;
  return a > b ? `${w + 1}-${l}` : `${w}-${l + 1}`;
}
// A team's or player's tabs: a swipe across what's under them is the tab
// beside (Jay 2026-10-27, swipes where they fit; not a game's page, whose
// charts and pitch take a finger sideways).
function swipeTabs(node, at) {
  kitUI.daySwipe?.(node, dir => {
    const { list, now, go } = at();
    const k = list[list.indexOf(now) + dir];
    return Boolean(k && (go(k), true));
  });
}
// The game page open now (openMatch), for a player opened from it.
let openGame = null;
export async function openMatch(e) {
  // (Reassigned as the live copy comes in.)
  const s = sheet(leagueName(e.league, L()), { league: e.league });
  const header = el('div', { class: 'match-head' });
  const sections = el('div', { class: 'match-tabs' });
  // The line score and the game's moment (on now, or how it went): under the
  // tabs on 概況, so a game's page is one layout whatever its state (the
  // hero, the tabs, then the cards; the owner, 2026-10-21).
  const top = el('div', { class: 'match-top' });
  // While the game's own page is read: the tabs and two cards in their
  // shape, where they'll be, not a lone spinner under the line score (Jay
  // 2026-10-27, "when it's loading don't cramp together").
  const content = el('div', { class: 'match-content' }, [el('div', { class: 'stack' }, [0, 1].map(i => el('div', { class: 'q-card match-skel' }, [skeleton(i ? [30, 88, 72, 80] : [26, 92, 64])])))]);
  if (LEAGUES[e.league].espn) put(sections, el('div', { class: 'match-tabs-skel', 'aria-hidden': 'true' }, [0, 1, 2, 3].map(() => el('i', { class: 'skel' }))));
  // (數據's switch, 球隊 or 球員, under the tabs.)
  const subBox = el('div', { class: 'match-sub' });
  s.body.append(header, sections, subBox, top, content);
  let view = 'overview';
  let statsPart = 'team';
  let standPart = '';
  let data = null;
  // A CPBL game begun whose box score (cpbl.com.tw, read through the proxy) failed: said, not left blank.
  let boxUnread = false;
  let table = null;
  // The game open: a player opened from it (any face, row or name in it)
  // has its numbers in this game too (openPlayer's 本場), told of each refresh.
  const game = { dialog: s.dialog, subs: new Set() };
  Object.defineProperties(game, { e: { get: () => e }, data: { get: () => data } });
  openGame = game;
  s.dialog.addEventListener('close', () => openGame === game && (openGame = null));
  // Each side's injuries from its roster (ESPN's game page leaves some out).
  let hurt = {};
  // A player's number where the box score leaves it out (Kevin McCullar Jr.,
  // a two-way player, numberless under 未上場: Jay, 2026-10-28): his own page's.
  const numbers = {};
  const askedNumber = new Set();
  const numbered = x => (x && !x.jersey && x.id && numbers[x.id] ? { ...x, jersey: numbers[x.id] } : x);
  const fillNumbers = () => {
    const missing = [...new Set([...(data?.players || []).flatMap(p => p.tables.flatMap(tb => tb.rows)), ...(data?.injuries || []).flatMap(t => t.list), ...Object.values(hurt).flat()].filter(x => x?.id && !x.jersey && !askedNumber.has(x.id)).map(x => x.id))].slice(0, 12);
    if (!missing.length) return;
    missing.forEach(id => askedNumber.add(id));
    Promise.all(missing.map(id => athlete(e.league, id).then(a => a.jersey && (numbers[id] = a.jersey)).catch(() => null))).then(got => got.some(Boolean) && paint());
  };
  // Who starts, before the game (pregameLineups).
  let lineups = null;
  // A basketball game to come: each side's averages (球員) and roster (陣容), by team id.
  let squads = null;
  // Each side's season leaders (數據領先, its own best in each stat), for 本季數據 head to head.
  let seasonLead = null;
  // Polymarket's win probability where ESPN draws none (a game on: again each
  // minute); a game to come, its chance for each side now, where ESPN has no
  // prediction of its own.
  let line = null;
  let lineAt = 0;
  // A soccer competition's season, for each side's form (loaded below).
  let seasonGames = LEAGUES[e.league].espn && LEAGUES[e.league].sport === 'soccer' && e.kind === 'match' ? undefined : null;
  // What's still coming (the win chance cards wait in their shape, never a source standing in for another).
  const wait = { summary: !LEAGUES[e.league].espn, line: false };
  const loadLine = () => {
    const now = { ...e, status: data?.status || e.status };
    const pre = now.status.state === 'pre';
    // (A soccer game on or over is drawn here, lib/soccerwp.mjs: the market's line only for its odds before the start, where ESPN has none.)
    const soccer = !pre && LEAGUES[e.league].sport === 'soccer' && e.kind === 'match';
    if ((pre ? data?.predict && data.predict.source !== 'espn' : soccer ? data?.predict || line : data?.winProb.length > 3) || Date.now() - lineAt < 60_000) return;
    lineAt = Date.now();
    (pre ? winNow : winLine)(now)
      .then(l => l && (line = l))
      .catch(() => {})
      .finally(() => {
        wait.line = true;
        paint();
      });
  };
  // The game's own page a step behind the day's list (still "End of 4th"
  // there, over here): the list's word kept, never back from 完賽 to the break.
  const behind = sm => (sm && e.status.state === 'post' && sm.status?.state !== 'post' ? { ...sm, status: e.status } : sm);
  // A game over a day and more ago (last season's, from 上季對戰): its page
  // that game's alone, never today's injuries, table or season leaders (Jay, 2026-10-21).
  const past = () => (data?.status || e.status).state === 'post' && Date.now() - Date.parse(e.start) > 36 * 3_600_000;
  let headSm = null;
  // Each side's record as it stood before the final (recordNow).
  const seenRecord = {};
  // Each side's finished regular-season games (regularTally), once the game's over.
  const tallies = {};
  const paintHeader = sm => {
    headSm = sm;
    const home = sm?.home || e.home;
    const away = sm?.away || e.away;
    const st = sm?.status || e.status;
    // The game as the summary has it now: its status, and its last play (a timeout's countdown).
    const atNow = { ...e, status: st, live: sm?.lastPlay ? { ...e.live, lastType: sm.lastPlay.type, lastId: sm.lastPlay.id } : e.live };
    const guestGame = Boolean(e.home.guest || e.away.guest);
    const rec = (x, raw) => {
      const r = x.record || raw.record || '';
      if (st.state !== 'post') seenRecord[raw.id] = r;
      const now = recordNow(r, x, String(x.id) === String(home.id) ? away : home, { state: st.state, seasonType: sm?.seasonType, before: seenRecord[raw.id] });
      // Opened after the final, ESPN's still behind: counted from the team's finished games.
      if (st.state === 'post' && sm?.seasonType === 2 && LEAGUES[e.league]?.espn && !(raw.id in tallies)) {
        tallies[raw.id] = null;
        regularTally(e.league, raw.id).then(t => t && ((tallies[raw.id] = t), headSm === sm && header.isConnected && paintHeader(sm)), () => {});
      }
      return caughtUp(now, tallies[raw.id]);
    };
    // (The league's rounds still coming: the header drawn again once they're in, not left without its round.)
    const roundOnly = !stageTag(e, L()) && !seriesText(e) && Boolean(weekOf(e, () => headSm === sm && header.isConnected && paintHeader(sm)));
    const side = (x, raw) =>
      el('div', { class: 'mh-side' }, [
        el('button', { class: 'mh-team', type: 'button', disabled: !hasTeamPage(e.league) || x.guest || raw.guest ? true : null, onclick: () => ctx.openTeam(e.league, x.id, x) }, [withHome(sideLogo({ ...raw, ...x, logo: x.logo || raw.logo }, e.league, 'lg'), e, raw), el('strong', { text: raw.short || x.short || x.name })]),
        rec(x, raw) ? el('small', { text: rec(x, raw) }) : x.guest || raw.guest ? el('small', { text: GUEST_FROM[raw.en || raw.name]?.[L() === 'en' ? 1 : 0] || (L() === 'en' ? 'Guest club' : '表演賽客隊') }) : null,
        // A guest club's game: neither side's follow here (the two sides even), the league side's under the score.
        hasTeamPage(e.league) && !guestGame ? followChip(e.league, x, () => paintHeader(sm)) : null
      ]);
    put(
      header,
      el('div', { class: 'mh-row' }, [
        homeFirst(e) ? side(home, e.home) : side(away, e.away),
        el('div', { class: 'mh-mid' }, [
          st.state === 'pre' ? el('strong', { class: 'mh-time', text: timeText(e) }) : el('strong', { class: 'mh-score num', 'data-q-live': st.state === 'in' ? `mh:${e.league}:${e.id}` : null, text: (homeFirst(e) ? [home, away] : [away, home]).map(x => scoreText(x.score)).join(' - ') }),
          el('span', { class: `mh-status ${st.state}`, text: st.state === 'pre' ? dayLabel(localDate(Date.parse(e.start))) : statusText(atNow), ...breakTick(atNow) }),
          // A league's round alone (第 5 輪): under the status, in the room the
          // sides' records and follows leave there, not a row of its own
          // floating between the header and the line score (the owner, 2026-10-17).
          roundOnly ? el('small', { class: 'mh-round', text: roundLabel(e.league, weekOf(e), weekOf(e), L()) }) : null
        ]),
        homeFirst(e) ? side(away, e.away) : side(home, e.home)
      ]),
      !roundOnly && (stageTag(e, L()) || seriesText(e)) ? stageLine(e) : null,
      gameFollow(e, st, () => paintHeader(sm), guestGame && hasTeamPage(e.league) ? inOrder(e, [away, home]).filter((x, i) => !x.guest && !inOrder(e, [e.away, e.home])[i].guest) : []),
      // On now or about to start: one tap to watch it, at the top.
      watchButton({ ...e, status: st }, 'wide')
    );
    put(top, linescore(sm, e), livePanel(e, sm) || storyPanel(e, sm));
  };
  paintHeader(null);
  // A game on (or about to start): the score, the situation and the
  // sections again every 15 seconds while the sheet is open, and at once on
  // coming back to the app. Its own day's page (a cup's default page can be
  // another round).
  const soon = () => e.status.state === 'in' || (e.status.state === 'pre' && Date.parse(e.start) - Date.now() < 15 * 60_000);
  const gameDays = () => [...new Set([0, 5].map(h => new Date(Date.parse(e.start) - h * 3_600_000).toISOString().slice(0, 10).replaceAll('-', '')))];
  let busy = false;
  const refresh = async () => {
    if (!s.dialog.isConnected) return stop();
    if (busy || document.visibilityState !== 'visible' || !soon()) return;
    busy = true;
    try {
      // The day's list and the game's own page asked together: one request to the proxy, not two one after the other.
      const espn = Boolean(LEAGUES[e.league].espn);
      const [list, sm] = await Promise.all([scoreboard(e.league, espn ? gameDays() : undefined).catch(() => []), espn ? summary(e.league, e.id).catch(() => data) : null]);
      const fresh = list.find(x => x.id === e.id);
      if (fresh) e = { ...e, ...fresh };
      if (espn) (data = behind(sm)), fillNumbers();
      else if (e.league === 'cpbl') {
        const sm = await cpblGame(e).catch(() => null);
        boxUnread = !sm && !data;
        data = sm || data;
      }
      // Read while a finger took the sheet (or it's closing): drawn at the next beat, not under the drag.
      if (document.querySelector('dialog.q-sheet.q-dragging, dialog.q-sheet.q-leaving')) return;
      paintHeader(data);
      paint();
      loadLine();
    } finally {
      busy = false;
    }
  };
  // (Every dev('sportsGame') seconds: the admin panel's 開發, 5 by default.)
  const stopBeat = everyDev('sportsGame', refresh);
  document.addEventListener('visibilitychange', refresh);
  const stop = () => {
    stopBeat();
    document.removeEventListener('visibilitychange', refresh);
  };
  s.dialog.addEventListener('close', stop);
  // The sections and what's in them drawn once, with the game's own page in
  // (or after 3 s without it): not a tab or two first (排名, its table read
  // sooner), the others popping in and everything moving down.
  let ready = !LEAGUES[e.league].espn;
  let shown = false;
  // 過程 drawn once for the game's data as it is (an NBA game's 500-odd rows):
  // a tab tapped back to it puts the same list back, drawn again only when the data changes.
  let playsKept = null;
  // (Its rows by what they show, kept across a live game's refreshes: playsNav.)
  const playsKeep = { rows: new Map(), shown: null };
  // 季後賽 (a playoff game): the league's bracket, read when first shown and
  // drawn again at every live refresh after (the game's score and inning on
  // its card, a series won), changed in place on the map already there;
  // undefined before, null while it's first read, false when there's none.
  // (The same for an NBA Cup game's NBA 盃: the whole cup, its six groups and
  // the knockout, a group-play game's too: Jay, 2026-10-30.)
  const poViews = new Map();
  const playoffsNode = (key, tab, load = () => ctx.playoffsOf(key)) => {
    const po = poViews.get(key) || poViews.set(key, { view: undefined, busy: false }).get(key);
    if (po.view === undefined) {
      po.view = null;
      load()
        .then(n => (po.view = n || false))
        .catch(() => (po.view = false))
        .finally(() => paint());
    } else if (po.view && !po.busy) {
      po.busy = true;
      load()
        .then(n => n && (po.view = po.view.__patch ? po.view.__patch(n) : n))
        .catch(() => {})
        .finally(() => (po.busy = false));
    }
    // On the page already: the same stack kept (built anew, the bracket was
    // taken out and put back each refresh: its fade played again, a flash
    // every few seconds, and its swipe went back to the first round).
    const shownStack = content.firstElementChild;
    if (po.view && po.view.parentNode === shownStack && shownStack?.dataset.view === tab) return shownStack;
    return el('div', { class: 'stack' }, [po.view || spinner()]);
  };
  const poViewOf = key => poViews.get(key)?.view;
  const settle = () => {
    if (ready) return;
    ready = true;
    paintHeader(data);
    paint();
  };
  setTimeout(settle, 3_000);
  const paint = () => {
    if (data?.kits && Object.keys(data.kits).length) gameKits.set(`${e.league}|${e.id}`, data.kits);
    if (!ready) return;

    if (!shown) {
      shown = true;
      sections.classList.add('fade-in');
      content.classList.add('fade-in');
    }
    const tabs = [['overview', T('overview')]];
    // 數據: the game's numbers, 球隊 (each side's, once it's begun: before
    // it ESPN's are a stray season total or two, 助攻 4–3) and 球員 (the box
    // score; before the start the season's, seasonPlayers, never a box of
    // blanks), one switch between them: every page's 數據 is its numbers
    // (Jay 2026-10-30).
    const before = (data?.status || e.status).state === 'pre';
    const season = before ? seasonPlayers(data, squads) : [];
    const teamNums = !before && teamStatRows(data?.teamStats, LEAGUES[e.league]?.sport, L()).length > 0;
    const playerNums = before ? season.length > 0 : Boolean(data?.players.some(p => p.tables.some(tb => tb.rows.length)));
    if (teamNums || playerNums) tabs.push(['stats', T('stats')]);
    const part = teamNums && playerNums ? statsPart : teamNums ? 'team' : 'players';
    if (data?.plays.length || data?.keyEvents.length || data?.commentary?.length) tabs.push(['plays', T('plays')]);
    // 陣容: soccer's line-ups; basketball's from its box score (先發, 替補, 未上場 and why: a player who didn't play is left off 球員); baseball's active roster; before the start, each side's squad.
    if (data?.rosters.some(r => r.players.length) || Object.keys(data?.squads || {}).length || (LEAGUES[e.league]?.sport === 'basketball' && data?.players.some(p => p.tables[0]?.rows.length)) || (before && squads && Object.values(squads).some(x => x.roster.length))) tabs.push(['lineups', T('lineups')]);
    // The table only once it has a game in it (a preseason's is all zeros in the feed's order).
    const shownTable = past() ? [] : table?.length ? table : data?.table.length ? [{ rows: data.table.map(r => ({ id: r.id, stats: r.stats })) }] : [];
    // 排名: the league's table, the playoffs' bracket (a series, a knockout
    // tie: 季後賽, a cup's 淘汰賽) and the NBA Cup's (group play or knockout),
    // chips inside the one tab as every page has its 排名 (Jay 2026-10-30);
    // a playoff or cup game opens on its own bracket.
    const playoff = Boolean(e.round && ctx.hasBracket?.(e.league) && ctx.playoffsOf);
    const cup = e.league === 'nba' && /nba cup|emirates cup|in-season tournament/i.test(e.note || '') && ctx.hasBracket?.('nbacup');
    const en = L() === 'en';
    const stands = [
      playoff && poViewOf(e.league) !== false ? ['playoffs', LEAGUES[e.league]?.cup ? (en ? 'Knockouts' : '淘汰賽') : en ? 'Playoffs' : '季後賽'] : null,
      cup && poViewOf('nbacup') !== false ? ['cup', en ? 'NBA Cup' : 'NBA 盃'] : null,
      shownTable.some(tableStarted) ? ['table', en ? 'Table' : LEAGUES[e.league]?.cup ? '積分榜' : '聯盟排名'] : null
    ].filter(Boolean);
    if (stands.length) tabs.push(['table', T('table')]);
    if (!stands.some(([k]) => k === standPart)) standPart = stands[0]?.[0] || 'table';
    if (view === 'table' && !stands.length) view = 'overview';
    put(subBox, view === 'stats' && teamNums && playerNums ? segmented([['team', en ? 'Teams' : '球隊'], ['players', en ? 'Players' : '球員']], statsPart, v => ((statsPart = v), paint()), 'match-part') : view === 'table' && stands.length > 1 ? segmented(stands, standPart, v => ((standPart = v), paint()), 'match-part') : null);
    // The same row of tabs before, during and after (two of them or six).
    put(sections, tabs.length > 1 ? segmented(tabs, view, v => ((view = v), paint()), '', { seg: true }) : null);
    top.hidden = view !== 'overview';
    const over = (data?.status || e.status).state === 'post';
    // (A game over a day and more ago: ESPN's injuries are today's, not that
    // night's, so none. Just over: who was out hurt stays, with who sat out, 未上場: Jay, 2026-10-28.)
    const shownView = view === 'stats' && part === 'players' ? 'players' : view === 'table' ? standPart : view;
    const fresh = () => matchSection(shownView, data && { ...data, players: data.players.map(p => ({ ...p, tables: p.tables.map(tb => ({ ...tb, rows: tb.rows.map(numbered) })) })), table: past() ? [] : data.table, injuries: past() ? [] : withoutPlayed(mergeInjuries(data.injuries, hurt), data).map(t => ({ ...t, list: t.list.map(numbered) })), lineups, seasonPlayers: season, courtSquads: before ? squads : null, seasonGames, seasonLead: past() ? null : seasonLead }, e, past() ? null : table, { line, wait, plays: Object.assign(playsKeep, { shown: view === 'plays' ? content.firstElementChild : null }) });
    const keep = view === 'plays' && playsKept?.data === data && playsKept.lang === L() && playsKept.over === over ? playsKept.node : null;
    const next = shownView === 'playoffs' ? playoffsNode(e.league, shownView) : shownView === 'cup' ? playoffsNode('nbacup', shownView) : keep || fresh();
    // The same view again (a live refresh): its cards changed inside the
    // stack already there, so a card kept from the last drawing (the win
    // chance chart, a finger on it) never leaves the page.
    const was = content.firstElementChild;
    // (A kept card comes as a stand-in, __keep: the card itself never put in the new stack.)
    if (was === next) {
      // (過程 kept: already on the page.)
    } else if (was?.classList.contains('stack') && next?.classList?.contains('stack') && was.dataset.view === shownView && content.childElementCount === 1 && !keep) put(was, ...[...next.childNodes].map(n => n.__keep || n));
    else put(content, next);
    if (content.firstElementChild?.classList.contains('stack')) content.firstElementChild.dataset.view = shownView;
    // (What's on the page now: a live refresh's rows go into the list already there.)
    if (view === 'plays' && !keep && content.firstElementChild) playsKept = { data, lang: L(), over, node: content.firstElementChild };
    if (boxUnread && view === 'overview' && e.status.state !== 'pre') content.append(el('p', { class: 'muted box-unread', text: T('boxUnread') }));
    for (const f of game.subs) f();
  };
  // A soccer competition's season (the pack 第 N 輪 already reads): each
  // side's form in it for 兩隊比較. Null elsewhere (ESPN's last five are the
  // league's own there); undefined while it's coming, the row held till then.
  if (seasonGames === undefined)
    seasonEvents(e.league)
      .catch(() => null)
      .then(list => {
        seasonGames = list;
        paint();
      });
  // The league's table: both sides' places, and the Table section.
  if (hasStandings(e.league))
    standings(e.league)
      .then(groups => {
        table = groups;
        // A cup with groups: the game's group in the header (C 級第 2 組).
        const g = LEAGUES[e.league].cup && (groups || []).length > 1 ? groups.find(x => x.rows.some(r => r.id === String(e.home.id)) && x.rows.some(r => r.id === String(e.away.id))) : null;
        if (g && !e.group) {
          e = { ...e, group: g.name };
          paintHeader(data);
        }
        paint();
      })
      .catch(() => {});
  // A league ESPN doesn't cover (CPBL): the table counted from its own season.
  else if (LEAGUES[e.league].asia && e.kind === 'match')
    ownTeam(e.league, e.home.id, e.home)
      .then(([, , groups]) => {
        if (groups) (table = groups), paint();
      })
      .catch(() => {});
  if (!LEAGUES[e.league].espn) {
    paint();
    loadLine();
    // CPBL's box score, the league's own: the line score, 數據, 球員 and 過程.
    if (e.league === 'cpbl' && e.status.state !== 'pre')
      cpblGame(e)
        .catch(() => null)
        .then(sm => {
          boxUnread = !sm && !data;
          if (sm) (data = sm), paintHeader(data);
          paint();
        });
    return;
  }
  // A game to come: who starts (lib/lineups.mjs), again each minute while
  // the sheet is open, until it starts (an NBA five comes 30 minutes before).
  let lineupTimer = 0;
  const stopLineups = () => clearInterval(lineupTimer);
  const loadLineups = () => {
    if (!s.dialog.isConnected || (data?.status || e.status).state !== 'pre') return stopLineups();
    pregameLineups(e)
      .then(l => {
        if (JSON.stringify(l) === JSON.stringify(lineups)) return;
        lineups = l;
        paint();
      })
      .catch(() => {});
  };
  loadLineups();
  lineupTimer = setInterval(loadLineups, 60_000);
  s.dialog.addEventListener('close', stopLineups);
  {
    const l = LEAGUES[e.league];
    if (e.kind === 'match' && l?.espn && l.sport !== 'racing' && hasLeaders(l.sport, l.espn) && e.away?.id && e.home?.id)
      Promise.all([e.away, e.home].map(x => teamLeaders(e.league, x.id, { name: x.en || x.name, en: x.en, short: x.short }).catch(() => null))).then(([a, h]) => {
        if (!a || !h) return;
        seasonLead = { a, h };
        paint();
      });
  }
  // A game to come: each side's roster (陣容 before the line-ups are out),
  // a basketball side's with its averages too (球員). Baseball's whole
  // active roster comes with MLB's box score.
  const sportOf = LEAGUES[e.league].sport;
  if (e.kind === 'match' && e.status.state === 'pre' && sportOf !== 'baseball' && LEAGUES[e.league].espn && e.away?.id && e.home?.id)
    Promise.all([e.away, e.home].map(x => Promise.all([sportOf === 'basketball' ? seasonAverages(e.league, x.id).catch(() => null) : null, roster(e.league, x.id).catch(() => []), sportOf === 'basketball' ? leagueAverages(e.league).catch(() => new Map()) : null]).then(([avg, list, all]) => [String(x.id), { avg: sportOf === 'basketball' ? rosterAverages(avg, list.flatMap(g => g.players), all) : null, roster: list.flatMap(g => g.players) }]))).then(got => {
      squads = Object.fromEntries(got);
      paint();
    });
  // A game to come, on or just over: who's out, from each team's roster too (soccer's rosters say nothing of it).
  if (e.kind === 'match' && !(e.status.state === 'post' && Date.now() - Date.parse(e.start) > 36 * 3_600_000) && LEAGUES[e.league].sport !== 'soccer')
    // (With the league's report, the same the team's page reads: each one's why and when back.)
    Promise.all([leagueInjuries(e.league).catch(() => ({})), ...[e.away, e.home].map(x => (x?.id ? teamInjuries(e.league, x.id).then(list => [x.id, list]).catch(() => null) : null))]).then(([report, ...got]) => {
      hurt = Object.fromEntries(got.filter(Boolean).map(([id, list]) => [id, list.map(x => ({ ...x, ...whyOf(report?.[String(id)], x) }))]));
      for (const id of [e.away?.id, e.home?.id].map(String)) for (const x of report?.[id] || []) if (!hurt[id]?.some(y => (x.id && y.id === x.id) || y.name === x.name)) (hurt[id] ||= []).push(x);
      if (Object.values(hurt).some(l => l.length)) paint();
      fillNumbers();
    });
  try {
    data = behind(await summary(e.league, e.id));
  } catch {}
  fillNumbers();
  wait.summary = true;
  if (ready) {
    paintHeader(data);
    paint();
  } else settle();
  loadLine();
}

// One player's why and when back from the league's report (by id, else name).
function whyOf(list, x) {
  const r = (list || []).find(y => (x.id && y.id === x.id) || y.name === x.name);
  // (The report's word too: its 回歸待定 / 本季報銷 is read from it, the date alone said Saturday.)
  return r ? { what: x.what || r.what || '', back: x.back || r.back || '', comment: x.comment || r.comment || '' } : {};
}

// Basketball: each side's top scorer (the face, then who and their line, the team fouls), live or over.
function topScorers(e, sm) {
  if (!sm?.players?.length) return null;
  const en = L() === 'en';
    const top = id => {
      const tb = sm.players.find(p => p.team === id)?.tables[0];
      const i = tb?.labels.indexOf('PTS') ?? -1;
      if (!tb || i < 0) return null;
      const reb = tb.labels.indexOf('REB');
      const ast = tb.labels.indexOf('AST');
      const best = [...tb.rows].sort((a, b) => Number(b.stats[i] || 0) - Number(a.stats[i] || 0))[0];
      return best ? { id: best.id, name: best.name, line: [`${best.stats[i]}${en ? ' pts' : '分'}`, reb >= 0 ? `${best.stats[reb]}${en ? ' reb' : '籃板'}` : '', ast >= 0 ? `${best.stats[ast]}${en ? ' ast' : '助攻'}` : ''].filter(Boolean).join(' ') } : null;
    };
    const fouls = sm.teamStats.find(s => s.key === 'fouls');
    // Each side's top scorer as baseball shows batter and pitcher: the face, then who and their line.
    const person = id => {
      const t = top(id);
      const name = sm.byId[id]?.short || sm.byId[id]?.name || '';
      const f = fouls ? (id === e.away.id ? fouls.away : fouls.home) : '';
      return lpPerson(e.league, t && { id: t.id, name: t.name }, [t ? personPic({ id: t.id, name: t.name }, e.league, 'md round') : null, el('p', {}, [el('small', {}, [teamTag(sm.byId[id] || [e.away, e.home].find(t => t.id === id), `${name} · ${en ? 'top scorer' : '得分王'}`, e.league, { tap: false })]), el('strong', { text: t?.name || '–' }), t?.line ? el('small', { class: 'num lp-line', text: t.line }) : null, f !== '' ? el('small', { class: 'num', text: `${en ? 'Team fouls' : '全隊犯規'} ${f}` }) : null])]);
    };
  return el('div', { class: 'lp-who lp-bb' }, inOrder(e, [e.away, e.home]).map(t => person(t.id)));
}
// The situation of a game on now, by sport: the bases, count and outs, and
// who bats against whom; the goals and red cards by minute; and the last play.
function livePanel(e, sm = null) {
  const lv = e.live || {};
  if (e.status.state !== 'in') return null;
  const sport = LEAGUES[e.league]?.sport;
  const en = L() === 'en';
  const rows = [];
  // Basketball, from the box score as it stands (read every 15 seconds):
  // each side's top scorer now, the team fouls, then the last plays.
  if (sport === 'basketball' && sm) {
    rows.push(topScorers(e, sm));
    const last = sm.feed.slice(-4).reverse();
    if (last.length) {
      const nameOf = id => sm.byId[id]?.short || sm.byId[id]?.name || '';
      rows.push(el('small', { class: 'lp-feed-h', text: en ? 'Latest' : '最新' }));
      rows.push(
        el(
          'ol',
          { class: 'lp-feed' },
          last.map(p => el('li', { class: p.scoring ? 'scoring' : '' }, [el('span', { class: 'num play-when', text: p.clock }), playLine(e.league, p, sm.byId[p.team] || nameOf(p.team)), p.scoring ? el('strong', { class: 'num', text: inOrder(e, [p.away, p.home]).join('-') }) : null]))
        )
      );
    }
    // Faded in once, as it takes its shape's place; the 15-second refreshes draw it straight.
    const fade = !e.panelShown;
    e.panelShown = true;
    return el('div', { class: `live-panel${fade ? ' fade-in' : ''}` }, rows);
  }
  // Basketball before the box score is in: the panel's shape, so it doesn't push the page down when it comes.
  if (sport === 'basketball' && !sm) return el('div', { class: 'live-panel waiting' }, [el('div', { class: 'lp-who lp-bb' }, [0, 1].map(() => el('div', { class: 'lp-person' }, [el('i', { class: 'skel skel-face' }), skeleton([55, 80, 65, 45])]))), skeleton([18, 92, 84, 88, 76])]);
  if (!e.live) return null;
  if (sport === 'baseball' && lv.bases) {
    rows.push(
      el('div', { class: 'lp-baseball' }, [
        diamond(lv.bases, null, true),
        el('div', { class: 'lp-count' }, [
          el('span', {}, [el('small', { text: 'B' }), dots(lv.balls, 4, 'ball')]),
          el('span', {}, [el('small', { text: 'S' }), dots(lv.strikes, 3, 'strike')]),
          el('span', {}, [el('small', { text: 'O' }), dots(lv.outs, 3, 'out')])
        ]),
        el('div', { class: 'lp-who' }, [
          lv.batter ? lpPerson(e.league, lv.batterWho, [lv.batterWho ? personPic({ ...lv.batterWho, en: lv.batterWho.name }, e.league, 'md round') : null, el('p', {}, [el('small', { text: T('batter') }), el('strong', { text: lv.batter })])]) : null,
          lv.pitcher ? lpPerson(e.league, lv.pitcherWho, [lv.pitcherWho ? personPic({ ...lv.pitcherWho, en: lv.pitcherWho.name }, e.league, 'md round') : null, el('p', {}, [el('small', { text: T('pitcher') }), el('strong', { text: lv.pitcher })])]) : null
        ])
      ])
    );
  }
  // Football: the game's own page's goals (each with how it went in) once it's read, else the scoreboard's.
  const told = sport === 'soccer' ? storyRows(e, sm) : null;
  if (told) rows.push(told);
  else if (lv.events?.length) rows.push(goalTimeline(e, lv.events));
  // Baseball's scoring so far, as a game over shows it.
  if (sport === 'baseball') {
    const scored = storyRows(e, sm);
    if (scored) rows.push(scored);
  }
  if (lv.lastPlay) {
    // ESPN writes it in English: in Chinese once translated (kept 30 days per line).
    // A pitch ("Strike 2 Foul") in fixed words; anything else translated.
    const pitch = en ? null : pitchZh(lv.lastPlay);
    const text = document.createTextNode(pitch || lv.lastPlay);
    if (!en && !pitch) translate(lv.lastPlay).then(zh => zh && (text.textContent = zh)).catch(() => {});
    rows.push(el('p', { class: 'lp-last' }, [el('small', { text: T('lastPlay') }), text]));
  }
  return rows.length ? el('div', { class: 'live-panel' }, rows) : null;
}
// A football game's goals and red cards as a match centre lists them, each
// face and name a tap to the player's page.
export function goalTimeline(e, events) {
  const en = L() === 'en';
  const mins = x => {
    const [a, b] = String(x.minute || '').replace(/'/g, '').split('+').map(Number);
    return (a || 0) + (b || 0) / 100;
  };
  const side = x => (x.team === String(e.home.id) ? 'home' : 'away');
  // One full-width line a goal, in time order (two columns left half the
  // card empty and cut the names short): the minute, the scorer's face, the
  // name whole with the team (and PK, or the defender's own goal) under it,
  // and the score it made, the scoring side's number bold. A red card the same, no score.
  const score = { home: 0, away: 0 };
  // (The cards' order, as the score above.)
  const order = inOrder(e, ['away', 'home']);
  return el(
    'ol',
    { class: 'lp-goals' },
    [...events]
      .sort((a, b) => mins(a) - mins(b))
      .map(x => {
        const s = side(x);
        const team = e[s];
        const red = x.kind === 'red';
        if (!red) score[s] += 1;
        const p = x.person || { name: x.who };
        // An own goal: the team it counted for (the defender's face read as his goal), the defender named under it.
        const pic = x.kind === 'own' ? logo(team.logo, team.name, 'sm') : personPic({ ...p, en: p.name }, e.league, 'sm round');
        const tag = x.kind === 'pen' ? (en ? 'Penalty' : '點球') : x.kind === 'own' ? (en ? 'Own goal' : '對方烏龍球') : red ? (en ? 'Red card' : '紅牌') : '';
        const can = x.kind !== 'own' && p.id && LEAGUES[e.league]?.espn && /^\d+$/.test(String(p.id));
        const who = [
          pic,
          el('span', { class: 'lg-text' }, [
            el('span', { class: 'lg-name' }, [document.createTextNode(x.kind === 'own' ? team.short || team.name : x.who || p.name || ''), red ? el('i', { class: 'lg-red', 'aria-hidden': 'true' }) : null]),
            // The team's badge and who set it up (the team's name when no one did); how it
            // went in on its own line (the foot or the head, where from, the corner), each one line.
            // (An assist by a player: their face and name, a tap to their page.)
            x.helpers?.length ? helpersLine(e.league, x.helpers) : fitLine(el('small', { class: 'lg-sub' }, [x.kind === 'own' ? el('span', { text: [x.who || p.name, tag].filter(Boolean).join(' · ') }) : teamTag(team, x.how?.help || [team.short || team.name, x.how?.shot ? '' : tag].filter(Boolean).join(' · '), e.league, { tap: false })])),
            x.how?.shot ? fitLine(el('small', { class: 'lg-how', text: x.how.shot })) : null
          ])
        ];
        return el('li', { class: `lg-${s}${red ? ' lg-card' : ''}` }, [
          el('span', { class: 'lg-min num', text: x.minute }),
          can ? el('button', { class: 'lg-who tap', type: 'button', 'aria-label': p.name || '', onclick: ev => (ev.stopPropagation(), ctx.openPlayer(e.league, String(p.id), { name: p.name, logo: p.headshot })) }, who) : el('span', { class: 'lg-who' }, who),
          red ? el('span') : el('span', { class: 'lg-score num' }, order.flatMap((k, i) => [i ? document.createTextNode('–') : null, el('b', { class: k === s ? 'on' : '', text: String(score[k]) })]).filter(Boolean))
        ]);
      })
  );
}
// Who set it up, as every player shown is: a face and the name, a tap to
// their page (the owner, 2026-10-18), then 助攻.
function assistTag(league, pic, name) {
  const en = L() === 'en';
  const body = [personPic({ ...pic, en: pic.name }, league, 'xs round'), el('span', { text: en ? `assist ${name}` : `${name} 助攻` })];
  const can = pic?.id && LEAGUES[league]?.espn && /^\d+$/.test(String(pic.id));
  return can ? el('button', { class: 'lg-assist tap', type: 'button', 'aria-label': pic.name || name, onclick: ev => (ev.stopPropagation(), ctx.openPlayer(league, String(pic.id), { name: pic.name, logo: pic.headshot })) }, body) : el('span', { class: 'lg-assist' }, body);
}
// Who helped on a play (a goal's assist, a basket's), each a face and a name.
const helpersLine = (league, helpers) => (helpers?.length ? fitLine(el('span', { class: 'lg-sub lg-help' }, helpers.slice(0, 2).map(h => assistTag(league, h.pic, h.name)))) : null);
// How a game went, under its scoreboard, the same live and over (the
// owner, 2026-10-18: a game on had its goals there, one over had nothing):
// football's goals and red cards, each with how it went in and who set it
// up; baseball's scoring plays (the inning, the batter, what he did, the
// RBIs); basketball's top scorer on each side and its deciding stretch;
// each with the score after it. From the game's own page (sm); a game on
// gets its situation above it (livePanel).
export function storyRows(e, sm) {
  const sport = LEAGUES[e.league]?.sport;
  if (!sm) return null;
  const en = L() === 'en';
  if (sport === 'soccer') {
    // Each goal's commentary line (the same minute and scorer) for how it went in.
    const lines = (sm.commentary || []).filter(c => c.scoring);
    const lineOf = k => lines.find(c => c.clock === k.clock && (!k.who || !c.who || c.who === k.who)) || lines.find(c => c.clock === k.clock);
    const events = (sm.keyEvents || [])
      .filter(k => k.scoring || /red-card/.test(k.type || ''))
      .map(k => ({ kind: /red-card/.test(k.type) ? 'red' : /own-goal/.test(k.type) ? 'own' : /penalty/.test(k.type) ? 'pen' : 'goal', minute: k.clock, team: k.team, who: k.who, person: k.pic, how: k.scoring ? goalHowParts(lineOf(k)?.text || k.text, k.type, en) : null, helpers: k.scoring ? lineOf(k)?.helpers || k.helpers || null : null }));
    return events.length ? goalTimeline(e, events) : null;
  }
  // Basketball, a game of a hundred baskets: its deciding stretch, if it had
  // one (one possession in the last two minutes of the fourth or an overtime): each
  // basket from there, how it went in (a three, a layup, a dunk, who
  // assisted), the score after it.
  const secs = c => {
    const [m, x] = String(c || '').split(':');
    return x == null ? Number(m) || 0 : Number(m) * 60 + (Number(x) || 0);
  };
  const plays = sport === 'basketball' ? clutchPlays(sm.feed || [], secs) : (sm.plays || []).filter(p => p.team && p.home != null && p.away != null);
  if (!plays.length) return null;
  const sideOf = p => (p.team === String(e.home.id) ? 'home' : 'away');
  // (A clock's period over its time, each on its line: the minute's column is narrow.)
  const when = p => (sport === 'baseball' ? (en ? `${/^bot/i.test(p.periodType) ? 'Bot' : 'Top'} ${p.periodNum}` : `${p.periodNum}局${/^bot/i.test(p.periodType) ? '下' : '上'}`) : [periodName(sport, p.periodNum, en), p.clock].filter(Boolean));
  return el(
    'ol',
    { class: 'lp-goals lp-scoring' },
    plays.map(p => {
      const s2 = sideOf(p);
      const team = e[s2];
      const tname = team.short || team.name;
      // (Baseball as its key moments say it, short in both languages: who, what, the RBIs.)
      // (Baseball: the batter on the line, what he did and its RBIs under it, as its key moments: one line ran onto three.)
      const hit = sport === 'baseball' ? playText(sport, { ...p, scoring: true }, en, tname) : '';
      const { main, sub } = sport === 'baseball' ? (p.who && hit.startsWith(`${p.who} `) ? { main: p.who, sub: hit.slice(p.who.length + 1) } : { main: hit, sub: '' }) : sport === 'basketball' ? { main: en ? basketEn(p) : playParts(feedText(sport, p, en, tname), '').main, sub: '' } : playParts(feedText(sport, p, en, tname), '');
      // Who helped (an assist): the player's face, a tap away (not their name in brackets).
      const helper = helpersLine(e.league, p.helpers);
      const pic = p.pic ? personPic({ ...p.pic, en: p.pic.name }, e.league, 'sm round') : logo(team.logo, tname, 'sm');
      const who = [pic, el('span', { class: 'lg-text' }, [fitLine(el('span', { class: 'lg-name', text: main })), helper || fitLine(el('small', { class: 'lg-sub' }, [teamTag(team, sport === 'baseball' && sub ? sub : [tname, sub].filter(Boolean).join(' · '), e.league, { tap: false })]))])];
      const can = p.pic?.id && LEAGUES[e.league]?.espn && /^\d+$/.test(String(p.pic.id));
      return el('li', { class: `lg-${s2}` }, [
        el('span', { class: 'lg-min num' }, [when(p)].flat().map(x => el('span', { text: x }))),
        can ? el('button', { class: 'lg-who tap', type: 'button', 'aria-label': p.pic.name || '', onclick: ev => (ev.stopPropagation(), ctx.openPlayer(e.league, String(p.pic.id), { name: p.pic.name, logo: p.pic.headshot })) }, who) : el('span', { class: 'lg-who' }, who),
        el('span', { class: 'lg-score num' }, inOrder(e, ['away', 'home']).flatMap((k, i) => [i ? document.createTextNode('–') : null, el('b', { class: k === s2 ? 'on' : '', text: String(p[k]) })]).filter(Boolean))
      ]);
    })
  );
}
// A game over: the same panel a game on has, without its situation.
function storyPanel(e, sm) {
  if (e.status.state !== 'post') return null;
  const sport = LEAGUES[e.league]?.sport;
  const parts = [sport === 'basketball' ? topScorers(e, sm) : null, storyRows(e, sm)].filter(Boolean);
  return parts.length ? el('div', { class: 'live-panel' }, parts) : null;
}
// The baskets from two minutes left in the fourth (or an overtime) on, when
// it came down to one possession (3 points or fewer at some point in them,
// or a tie); none in a game the leader saw out (Cavaliers–76ers, 2026-10-22:
// 6 down at 2:00, never closer than 4, and ten free throws listed).
function clutchPlays(feed, secs) {
  const scored = feed.filter(p => p.scoring && p.team && p.home != null && p.away != null);
  const late = p => p.periodNum > 4 || (p.periodNum === 4 && secs(p.clock) <= 120);
  const first = scored.findIndex(late);
  if (first < 0) return [];
  const plays = scored.slice(first).filter(late);
  const gap = p => Math.abs(Number(p.home) - Number(p.away));
  if (Math.min(...[scored[first - 1] || { home: 0, away: 0 }, ...plays].map(gap)) > 3) return [];
  return plays.slice(-10);
}
// A count as dots: balls of 4, strikes and outs of 3.
const dots = (n, of, cls) => el('span', { class: `lp-dots ${cls}` }, Array.from({ length: of }, (_, i) => el('i', { class: i < n ? 'on' : '' })));

// One follow button everywhere (a game's sides, a team, a player, a
// constructor, a league): the same small pill, filled until followed, then
// quiet with a tick. `isOn()` says whether it's followed; `toggle()` flips it.
// This one match followed on its own (its start and final told, first on 首頁, in 追蹤):
// offered until it's over, and shown while it's followed.
// `teams`: sides followed from here rather than under their names (a guest
// club's game: the header kept even, its one league side's follow beside this).
function gameFollow(e, st, after, teams = []) {
  const en = L() === 'en';
  const on = ctx.isFollowedGame?.(e);
  const game = ctx.isFollowedGame && (on || st.state !== 'post')
    ? el('button', { class: `game-follow${on ? ' on' : ''}`, type: 'button', 'aria-pressed': String(on), onclick: () => (ctx.toggleFollowGame(e), after()) }, [
        el('span', { class: 'gf-star', 'aria-hidden': 'true', text: on ? '★' : '☆' }),
        el('span', { text: on ? (en ? 'Following this match' : '已追蹤這場') : en ? 'Follow this match' : '追蹤這場比賽' })
      ])
    : null;
  const team = x => {
    const mine = ctx.isFollowed(e.league, x.id);
    const name = x.short || x.name;
    return el('button', { class: `game-follow${mine ? ' on' : ''}`, type: 'button', 'aria-pressed': String(mine), onclick: () => (ctx.toggleFollow(e.league, x), after()) }, [
      el('span', { class: 'gf-star', 'aria-hidden': 'true', text: mine ? '✓' : '+' }),
      el('span', { text: mine ? (en ? `Following ${name}` : `已追蹤${name}`) : en ? `Follow ${name}` : `追蹤${name}` })
    ]);
  };
  const all = [game, ...teams.map(team)].filter(Boolean);
  return all.length ? el('div', { class: 'mh-follow' }, all) : null;
}
// A race weekend followed from any of its sessions (every session of it counts):
// offered until its last session is over.
function weekendFollow(e) {
  if (!ctx.isFollowedGame || e.kind !== 'field') return null;
  const box = el('div', { class: 'mh-follow' });
  const paint = () => {
    const on = ctx.isFollowedGame(e);
    const over = (e.sessions || []).length > 0 && e.sessions.every(x => x.status.state === 'post');
    if (!on && over) return put(box);
    const en = L() === 'en';
    put(
      box,
      el('button', { class: `game-follow${on ? ' on' : ''}`, type: 'button', 'aria-pressed': String(on), onclick: () => (ctx.toggleFollowGame(e), paint()) }, [
        el('span', { class: 'gf-star', 'aria-hidden': 'true', text: on ? '★' : '☆' }),
        el('span', { text: on ? (en ? 'Following this race weekend' : '已追蹤這一站') : en ? 'Follow this race weekend' : '追蹤這一站' })
      ])
    );
  };
  paint();
  return box;
}
export function followButton(isOn, toggle, label = T('follow')) {
  const b = el('button', { class: 'follow-btn', type: 'button' });
  const paint = () => {
    const on = isOn();
    b.textContent = on ? `✓ ${T('following')}` : `+ ${label}`;
    b.classList.toggle('on', on);
  };
  b.addEventListener('click', ev => (ev.stopPropagation(), toggle(), paint()));
  paint();
  return b;
}
function followChip(league, side, after) {
  return followButton(() => ctx.isFollowed(league, side.id), () => (ctx.toggleFollow(league, side), after()));
}

function linescore(sm, e) {
  // (The summary's sides with the event's logos, as the header has them.)
  const home = { ...e.home, ...sm?.home, logo: sm?.home?.logo || e.home.logo };
  const away = { ...e.away, ...sm?.away, logo: sm?.away?.logo || e.away.logo };
  const played = Math.max(home.lines?.length || 0, away.lines?.length || 0);
  if (!played || played > 20) return null;
  // Each column by its sport's name for it: a football game's halves (上半 / 下半, extra time, penalties), a period past regulation OT.
  const sport = LEAGUES[e.league]?.sport;
  const en = L() === 'en';
  const regular = { basketball: 4 }[sport] || 0;
  // Every regular inning, period or half from the start, the ones to come blank (as a ballpark's board):
  // four innings played had spread across the whole card, a wide gap after the names.
  const n = Math.max(played, { baseball: 9, soccer: 2 }[sport] || regular);
  const colName = i =>
    sport === 'soccer'
      ? (en ? ['1H', '2H', 'ET1', 'ET2', 'Pens'] : ['上半', '下半', '延長上', '延長下', 'PK'])[i] || String(i + 1)
      : regular && i >= regular
        ? `OT${i - regular ? i - regular + 1 : ''}`
        : String(i + 1);
  const head = Array.from({ length: n }, (_, i) => el('th', { text: colName(i) }));
  // The sides by their Chinese names when they have them (a short one fits the column).
  const tag = x => (L() !== 'en' && x.en && x.short && x.short.length <= 5 ? x.short : x.abbr || x.short);
  // Each side's logo beside its name.
  const row = x => el('tr', {}, [el('th', { class: 'ls-team' }, [teamTap(x, e.league, 'ls-who', [sideLogo(x, e.league, 'xs'), el('span', { text: tag(x) })])]), ...Array.from({ length: n }, (_, i) => el('td', { class: 'num', text: x.lines?.[i] ?? '' })), el('td', { class: 'num total', text: x.score })]);
  return el('div', { class: 'table-wrap' }, [el('table', { class: `linescore${n > 5 ? ' innings' : ''}` }, [el('thead', {}, [el('tr', {}, [el('th'), ...head, el('th', { text: sport === 'baseball' ? 'R' : en ? 'T' : '總分' })])]), el('tbody', {}, inOrder(e, [away, home]).map(row))])]);
}

// A stat's number: "12-25" (made-attempted) is its rate, "45%" and ".271" as they are.
export function statValue(text) {
  const t = String(text ?? '').trim();
  const pair = /^(\d+(?:\.\d+)?)\s*[-/]\s*(\d+(?:\.\d+)?)$/.exec(t);
  if (pair) return Number(pair[2]) > 0 ? Number(pair[1]) / Number(pair[2]) : 0;
  const time = /^(\d+):(\d{2})$/.exec(t);
  if (time) return Number(time[1]) * 60 + Number(time[2]);
  const n = parseFloat(t.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// A team named anywhere: its logo beside the name (the side as the game's header has it, the summary's else);
// a tap opens its page (tap: false inside another button, or beside a player's name where it'd be hit by mistake).
const teamTag = (t, text, league, { tap = true } = {}) => {
  const kids = [t?.logo ? sideLogo(t, league, 'xs') : null, el('span', { text })];
  return tap && t?.id && !t.guest && !t.athlete && hasTeamPage(league)
    ? el('button', { class: 'team-tag link', type: 'button', onclick: ev => (ev.stopPropagation(), ctx.openTeam(league, String(t.id), t)) }, kids)
    : el('span', { class: 'team-tag' }, kids);
};
// A team's own logo and name as one tap to its page (a div where it has none).
const teamTap = (t, league, cls, kids) =>
  t?.id && !t.guest && !t.athlete && hasTeamPage(league) ? el('button', { class: `${cls} team-tap`, type: 'button', onclick: ev => (ev.stopPropagation(), ctx.openTeam(league, String(t.id), t)) }, kids) : el('div', { class: cls }, kids);
const sideOf = (d, e, id) => [e.away, e.home].find(t => t && String(t.id) === String(id)) || d?.byId?.[id] || null;
// The game's team by id, tagged: its short name (and anything after it, " · " between).
const tagOf = (d, e) => (id, ...more) => teamTag(sideOf(d, e, id), [d?.byId?.[id]?.short || d?.byId?.[id]?.name || sideOf(d, e, id)?.short || sideOf(d, e, id)?.name || '', ...more].filter(Boolean).join(' · '), e.league);
const card = (title, body, { sub = '' } = {}) => el('div', { class: 'q-card pad fx-card' }, [el('div', { class: 'card-h row' }, [typeof title === 'string' ? el('span', { text: title }) : el('span', {}, [title]), sub ? el('small', {}, [sub]) : null]), body]);

// Why a player didn't play, as ESPN says it ("COACH'S DECISION", "INJURY/ILLNESS - Left Knee; Sprain").
// A game over: who sat it out (the box score's, each with why), in the
// injuries' place, in the injury report's rows (the reason a chip, what's
// wrong under the name); none said, no card.
function satOutCard(d, e) {
  const en = L() === 'en';
  const teams = (d?.players || [])
    .map(p => ({ team: p.team, list: [...new Map(p.tables.flatMap(tb => tb.rows.filter(r => r.dnp)).map(r => [r.id || r.name, r])).values()] }))
    .filter(t => t.list.length)
    .sort((x, y) => ((x.team === String(e.home.id)) - (y.team === String(e.home.id))) * (homeFirst(e) ? -1 : 1));
  if (!teams.length) return null;
  return card(en ? 'Did not play' : '未上場', el('div', { class: 'injuries' }, teams.map(t => el('div', {}, [el('p', { class: 'mini-h' }, [tagOf(d, e)(t.team)]), el('div', { class: 'inj-report' }, t.list.slice(0, 12).map(x => injuryLine(sat(x), e.league)))]))));
}
// A player who sat a game out as an injury report's row: the reason (教練決定, 傷病, 輪休) and what's wrong.
const sat = x => ({ ...x, ...dnpWhy(x.reason, L() === 'en') });
function dnpWhy(reason, en) {
  const r = String(reason || '').trim();
  const [kind, ...rest] = r.split(/\s+-\s+/);
  const what = rest.join(' ').replace(/;/g, ' ');
  const of = (label, tone = 'warn') => ({ label, tone, whatText: what ? (en ? what : injuryWhatZh(what)) : '' });
  if (en) return of(kind ? kind.toLowerCase().replace(/^./, c => c.toUpperCase()) : 'Did not play', /injury|illness|suspen/i.test(kind) ? 'bad' : 'warn');
  if (/coach/i.test(r)) return of('教練決定');
  if (/injury|illness/i.test(r)) return of('傷病', 'bad');
  if (/not with team/i.test(r)) return of('未隨隊');
  if (/suspen/i.test(r)) return of('禁賽', 'bad');
  if (/personal/i.test(r)) return of('個人因素');
  if (/rest/i.test(r)) return of('輪休');
  return of('未上場');
}
const dnpText = (reason, en) => [dnpWhy(reason, en).label, dnpWhy(reason, en).whatText].filter(Boolean).join(' · ');
// A player's line in a game (parseSummary's box score: every sport's
// tables, soccer's made from its line-ups): [{ team, table, row }], or null.
function gameLine(d, id) {
  const found = (d?.players || []).flatMap(p => p.tables.map(tb => ({ team: p.team, table: tb, row: tb.rows.find(r => r.id === String(id)) }))).filter(x => x.row);
  return found.length ? found : null;
}
// 本場: the game (both sides, the score, where it is), whether he's on now,
// and each of his tables as tiles: the box score's columns, his numbers.
function gameCards(game, id, league) {
  const d = game.data;
  const e = game.e;
  const lines = gameLine(d, id);
  if (!lines) return [];
  const en = L() === 'en';
  const st = d?.status || e.status;
  const sport = LEAGUES[league]?.sport;
  const [away, home] = [d?.away || e.away, d?.home || e.home];
  const team = lines[0].team;
  const row = lines[0].row;
  // Where he is: on the court (basketball's mark), on the pitch or off it (soccer's line-ups), else started or came off the bench.
  // A pitcher who pitched: started it or came out of the bullpen (never 替補).
  const mound = sport === 'baseball' ? lines.find(l => l.table.labels.includes('IP'))?.row : null;
  const rp = sport === 'soccer' ? d?.rosters?.find(r => r.team === team)?.players.find(p => p.id === String(id)) : null;
  const where =
    row.dnp
      ? [en ? 'Did not play' : ['未上場', dnpText(row.reason, en)].filter((x, i, all) => all.indexOf(x) === i).join(' · '), 'out']
      : st.state === 'in' && sport === 'basketball'
      ? row.on ? [en ? 'On the court' : '場上', 'on'] : [en ? 'On the bench' : '板凳', '']
      : rp?.sentOff
        ? [`${en ? 'Sent off' : '紅牌'}${rp.sentAt ? ` ${rp.sentAt}` : ''}`, 'bad']
        : rp?.subbedOut
          ? [`↓ ${en ? 'Off' : '下場'}${rp.subAt ? ` ${rp.subAt}` : ''}`, 'out']
          : rp?.subbedIn
            ? [`↑ ${en ? 'On' : '上場'}${rp.subAt ? ` ${rp.subAt}` : ''}`, st.state === 'in' ? 'on' : '']
            : mound
              ? mound.starter ? [en ? 'Starting pitcher' : '先發投手', ''] : [en ? 'Relief' : '後援', '']
              : row.starter
                ? [en ? 'Started' : '先發', st.state === 'in' && sport === 'soccer' ? 'on' : '']
                : [en ? 'Bench' : '替補', ''];
  // One card: the score line (the two sides' marks and the score, the
  // game's clock at the right, red while on), then his numbers; where he
  // is (場上, 先發, ↓ 69') beside the title, not a card of its own.
  const scoreRow = el('div', { class: 'pg-row' }, [
    el('span', { class: 'pg-score' }, (([l, rt]) => [logo(l?.logo, l?.name, 'xs'), el('strong', { class: 'num', 'data-q-live': st.state === 'in' ? `pg:${e.league}:${e.id}` : null, text: st.state === 'pre' ? 'vs' : `${scoreText(l?.score)} – ${scoreText(rt?.score)}` }), logo(rt?.logo, rt?.name, 'xs')])(inOrder(e, [away, home]))),
    el('span', { class: `pg-status ${st.state}`, text: statusText({ ...e, status: st }), ...breakTick({ ...e, status: st }) })
  ]);
  // Soccer's cards: a label by the title, not a number among his stats (one
  // yellow, or two and off, or a straight red: never "2" of anything).
  const keyed = (tb, k) => (tb.keys ? tb.keys.indexOf(k) : -1);
  const cardOf = (tb, r) => {
    const n = k => Number(r.stats[keyed(tb, k)]) || 0;
    const y = n('yellowCards');
    const red = n('redCards') > 0 || rp?.sentOff;
    return red && y >= 2 ? ['yy', en ? 'Two yellows, off' : '兩黃變紅'] : red ? ['r', en ? 'Red card' : '紅牌'] : y ? ['y', en ? 'Booked' : '黃牌'] : null;
  };
  const booked = sport === 'soccer' ? cardOf(lines[0].table, lines[0].row) : null;
  const title = text => el('span', { class: 'pg-title' }, [el('span', { text }), where[1] === 'bad' && booked ? null : el('span', { class: `pg-where ${where[1]}`, text: where[0] }), booked ? el('span', { class: `pg-card ${booked[0]}` }, [el('i', { 'aria-hidden': 'true' }), booked[0] === 'yy' ? el('i', { 'aria-hidden': 'true' }) : null, booked[1]]) : null]);
  return lines.map(({ table: tb, row: r }, i) =>
    card(
      title(lines.length > 1 ? boxTableName(tb.name) : en ? 'This game' : '本場數據'),
      el('div', {}, [i === 0 ? scoreRow : null, el('div', { class: 'stat-grid dense' }, tb.labels.map((k, n) => [k, r.stats[n], tb.keys?.[n]]).filter(([, v, key]) => v !== '' && v != null && key !== 'yellowCards' && key !== 'redCards').map(([k, v]) => tile(statName(k, L(), { sport, long: tb.longs?.[tb.labels.indexOf(k)], pitching: tb.labels.includes('IP') }), String(v))))])
    )
  );
}

// ---- Injury report ------------------------------------------------------------------------
//
// Who's hurt, live from ESPN's injury report (NBA, MLB: a
// league's whole list in one read, kept ten minutes): each player's status,
// what and where, when they're due back and the reporter's word on it. A
// league ESPN keeps no report for (soccer, Asian baseball) has no card.
const INJ_TONE = { out: 'bad', 'injured reserve': 'bad', 'injured list': 'bad', suspension: 'bad', doubtful: 'bad', questionable: 'warn', 'day-to-day': 'warn', probable: 'good' };
const injTone = status => Object.entries(INJ_TONE).find(([k]) => String(status).toLowerCase().includes(k))?.[1] || 'warn';
// When he's due back ("11/8 週日 回歸"); a date already gone by is the report's old guess: left off.
function backText(at, comment = '') {
  const word = returnWord(comment);
  if (word) return L() === 'en' ? (word === 'season' ? 'out for the season' : 'return TBD') : word === 'season' ? '本季報銷' : '回歸待定';
  if (!at || !(localDate(Date.parse(at)) >= localDate(Date.now()))) return '';
  return L() === 'en' ? `back ${dayLabel(localDate(Date.parse(at)))}` : `${dayLabel(localDate(Date.parse(at)))} 回歸`;
}
// One player's line: status chip, what's wrong, when they're back.
// (`lead`: a 陣容 card's, the number's column first, so its rows line up with the squad's above.)
function injuryLine(x, league, { lead = false } = {}) {
  const en = L() === 'en';
  const back = backText(x.back, x.comment);
  // One row a player: the face and name, what and when under it on one line, the status at the right.
  const sub = [x.whatText ?? (x.what ? (en ? x.what : injuryWhatZh(x.what)) : null), back || null].filter(Boolean);
  return el('button', { class: `inj-row${lead ? ' lead' : ''}`, type: 'button', disabled: x.id ? null : true, onclick: () => x.id && ctx.openPlayer(league, x.id, { name: x.name, logo: x.headshot }) }, [
    lead ? el('span', { class: 'jersey num', text: x.jersey || '' }) : null,
    personPic(x, league, 'xs round'),
    el('span', { class: 'inj-who' }, [fitLine(el('strong', { class: 'one-line' }, [playerName(x.full || x.name, 'full', x.name)])), sub.length ? fitLine(el('small', { class: 'one-line' }, joinNodes(sub, ' · '))) : null]),
    el('span', { class: `inj-status ${x.tone || injTone(x.status)}`, text: x.label || injuryText(x.status) })
  ]);
}
// A team's card: the most serious first, three of them until 全部 is tapped
// (a long report pushed the team's own tabs off the screen).
const INJ_ORDER = ['bad', 'warn', 'good'];
const INJ_SHOWN = 3;
// (Opened stays open: a live game's page draws again every few seconds.)
const injOpen = new Set();
// One side's injuries, the same on a team's page and a game's: the most
// serious first, three until 全部 is tapped.
function injuryBox(list, league) {
  const sorted = [...list].sort((a, b) => INJ_ORDER.indexOf(injTone(a.status)) - INJ_ORDER.indexOf(injTone(b.status)));
  const key = `${league}|${sorted.map(x => x.id || x.name).join(',')}`;
  const all = injOpen.has(key) || sorted.length <= INJ_SHOWN + 1;
  const box = el('div', { class: 'inj-report' }, sorted.slice(0, all ? sorted.length : INJ_SHOWN).map(x => injuryLine(x, league)));
  const rest = all ? 0 : sorted.length - INJ_SHOWN;
  const more =
    rest > 0
      ? el('button', {
          class: 'section-more inj-more',
          type: 'button',
          text: L() === 'en' ? `All ${sorted.length}` : `全部 ${sorted.length} 人`,
          onclick: ev => (injOpen.add(key), box.append(...sorted.slice(INJ_SHOWN).map(x => injuryLine(x, league))), ev.currentTarget.remove())
        })
      : null;
  return el('div', {}, [box, more]);
}
function teamInjuryCard(list, league) {
  if (!list?.length) return null;
  return card(T('injuries'), injuryBox(list, league), { sub: dayLabel(localDate(Math.max(...list.map(x => Date.parse(x.date) || 0)) || Date.now())) });
}

// A side's row in the league's table: [place, row, group size]; none before the table's first game.
function placeOf(groups, id) {
  for (const g of (groups || []).filter(tableStarted)) {
    const i = g.rows.findIndex(r => r.id === id);
    if (i >= 0) return { pos: i + 1, row: g.rows[i], n: g.rows.length, group: g.name, lead: g.rows[0] };
  }
  return null;
}

// A box score table's name: ESPN's "batting" and "pitching" in the viewer's language.
const BOX_TABLES = { batting: ['打擊', 'Batting'], pitching: ['投球', 'Pitching'], fielding: ['守備', 'Fielding'] };
// A player's row in a box score or a season's table: the face (live too: the
// box score's own, else the kit's way), name and position on one line (Safari
// dropped the position below, over the numbers), then one cell per column
// (a player yet to come on has none: the row's line still runs across).
const boxRow = (e, tb, r) =>
  el('tr', {}, [
    el('th', { class: 'left' }, [el('span', { class: 'box-who' }, [el('button', { class: 'link roster-name', type: 'button', disabled: r.id ? null : true, onclick: () => r.id && ctx.openPlayer(e.league, r.id, { name: r.full || r.name, logo: r.headshot }) }, [personPic({ ...r, name: r.full || r.name }, e.league, 'xs round'), el('span', { class: 'box-name' }, [playerName(r.full || r.name, 'short', r.name)])]), r.pos ? el('small', { text: r.pos }) : null])]),
    ...tb.labels.map((_, i) => el('td', { class: 'num', text: r.stats[i] ?? '' }))
  ]);
// A game to come's 球員: each side's season numbers (MLB's lineups from the
// summary; a basketball side's averages), [{ team, season, tables }].
function seasonPlayers(data, squads) {
  if (data?.seasonPlayers?.length) return data.seasonPlayers;
  return Object.entries(squads || {})
    .filter(([, x]) => x.avg)
    .map(([team, x]) => ({ team, season: x.avg.season, tables: [{ name: 'avg', labels: x.avg.labels, rows: x.avg.rows, totals: [] }] }));
}
// Whose numbers they are: a season ESPN names, per game ("2025-26 例行賽平均"),
// else this one's totals ("本季", in the postseason "季後賽").
function seasonSub(season) {
  const en = L() === 'en';
  const kind = { 1: ['季前賽', 'preseason'], 2: ['例行賽', 'regular season'], 3: ['季後賽', 'playoffs'] }[season?.type];
  if (season?.name) return en ? `${season.name}${kind ? ` ${kind[1]}` : ''} per game` : `${season.name} ${kind ? kind[0] : ''}平均`;
  return season?.type === 3 ? (en ? 'Postseason' : '季後賽') : en ? 'This season' : '本季';
}
const boxTableName = name => BOX_TABLES[String(name).toLowerCase()]?.[L() === 'en' ? 1 : 0] || name;
function matchSection(view, d, e, table, lw = {}) {
  const nameOf = id => d?.byId[id]?.short || d?.byId[id]?.name || (id === e.home.id ? e.home.short : id === e.away.id ? e.away.short : '');
  const tag = tagOf(d, e);
  if (view === 'stats' && d) {
    // Each side in its own colour (the win chance chart's: told apart from each other and the card), the leagues' own apps' way.
    const tint = tintOf(e);
    return card(
      T('teamStats'),
      el(
        'div',
        { class: 'stat-bars', style: `--away:${tint.away};--home:${tint.home}` },
        [el('div', { class: 'sb-legend' }, inOrder(e, [el('span', { class: 'away' }, [tag(e.away.id)]), el('span', { class: 'home' }, [tag(e.home.id)])]))].concat(
          teamStatRows(d.teamStats, LEAGUES[e.league]?.sport, L()).flatMap((s, i, rows) => {
            const [a, h] = [statValue(s.away), statValue(s.home)];
            const [aa, hh] = [Math.abs(a ?? 0), Math.abs(h ?? 0)];
            // Which side did better: more, or fewer for ERA, errors, fouls…
            const better = a === h || a == null || h == null ? '' : (a > h) !== s.low ? 'away' : 'home';
            // One full line split by the two sides' shares, as the leagues' own apps draw it.
            const share = aa + hh > 0 ? (aa / (aa + hh)) * 100 : 50;
            return [
              s.group && s.group !== rows[i - 1]?.group ? el('p', { class: 'mini-h sb-group', text: s.group }) : null,
              el('div', { class: 'stat-bar' }, [
                el('div', { class: 'sb-top' }, (([x, y]) => [x, el('span', { text: s.label }), y])(inOrder(e, [el('strong', { class: `num${better === 'away' ? ' lead' : ''}`, text: s.away }), el('strong', { class: `num${better === 'home' ? ' lead' : ''}`, text: s.home })]))),
                aa + hh > 0 ? el('div', { class: 'sb-track' }, inOrder(e, [el('i', { class: 'away', style: `flex-grow:${share}` }), el('i', { class: 'home', style: `flex-grow:${100 - share}` })])) : null
              ])
            ];
          })
        )
      )
    );
  }
  if (view === 'players' && d?.seasonPlayers?.length) {
    return el(
      'div',
      { class: 'stack' },
      d.seasonPlayers.flatMap(p =>
        p.tables.map((tb, _, all) =>
          card(tag(p.team, tb.name === 'avg' || all.length < 2 ? '' : boxTableName(tb.name)), boxTable(tb, `${e.id}|${p.team}|season-${tb.name}`, LEAGUES[e.league]?.sport, r => boxRow(e, tb, r)), { sub: seasonSub(p.season) })
        )
      )
    );
  }
  if (view === 'players' && d) {
    return el(
      'div',
      { class: 'stack' },
      inOrder(e, [e.away, e.home]).flatMap(t => d.players.filter(p => p.team === String(t.id))).concat(d.players.filter(p => ![e.away, e.home].some(t => String(t.id) === p.team))).flatMap(p =>
        p.tables
          // Basketball: a player who didn't play a minute (no numbers) is left off; 陣容 lists him and why.
          .map(tb => (LEAGUES[e.league]?.sport === 'basketball' ? { ...tb, rows: tb.rows.filter(r => !r.dnp && r.stats?.some(v => v !== '' && v != null)) } : tb))
          .filter(tb => tb.rows.length)
          // (A table's name only beside another: baseball's 打擊 and 投球, never a lone 球員.)
          .map((tb, _, all) =>
            card(
              tag(p.team, all.length > 1 ? boxTableName(tb.name) : ''),
              boxTable(tb, `${e.id}|${p.team}|${tb.name}`, LEAGUES[e.league]?.sport, r => boxRow(e, tb, r))
            )
          )
          // (MLB's 比賽細節 left off, the owner's call, 2026-10-13: the box score says it.)
          .concat(e.league === 'mlb' ? [] : gameNotes(d.details?.find(x => x.team === p.team), tag(p.team, L() === 'en' ? 'Notes' : '比賽細節')) || [])
      )
    );
  }
  if (view === 'plays' && d) {
    // The whole game: basketball every play, baseball every at-bat, soccer
    // its events (goals, cards, changes). A
    // finished game reads in order like a story; one on, the latest first.
    // A header at each period; the scores stand out, and the chart's key
    // moments (a run where it ended, a lead taken, a big play) are marked.
    const sport = LEAGUES[e.league]?.sport;
    const en = L() === 'en';
    const side = id => d.byId[id] || (id === e.home.id ? e.home : id === e.away.id ? e.away : nameOf(id));
    const sideShort = id => side(id)?.short || side(id)?.name || '';
    const live = (d.status || e.status).state === 'in';
    // Football: the whole commentary (every shot, corner and foul), its key events where there's none.
    const list = sport === 'basketball' && d.feed.length ? d.feed : sport === 'baseball' && d.feed.some(p => p.kind === 'play-result') ? d.feed.filter(p => p.kind === 'play-result' || (p.scoring && p.kind !== 'play-result')) : sport === 'soccer' && d.commentary?.length ? d.commentary : d.keyEvents.length ? d.keyEvents : d.plays;
    // The chart's key moments, by play: a run told where it ended (or where it took the lead), a play by itself.
    const marks = new Map();
    const tint = tintOf(e);
    const pts = d.winProb || [];
    if (pts.length && pts.every(p => p.n)) {
      const sides = { home: { id: e.home.id, name: sideShort(e.home.id) }, away: { id: e.away.id, name: sideShort(e.away.id) }, en };
      for (const m of playMoments(pts, sport, sides)) {
        // (A run that took the lead: on the play that took it, not where the lagging price peaked.)
        const at = m.lead ?? m.i;
        const id = (m.periods || m.rally ? pts[at]?.play?.id : m.src?.id) || pts[at]?.play?.id;
        if (id) marks.set(id, m);
      }
    }
    // (Each play's words worked out once: three looks at each below.)
    const words = new Map();
    const said = p => (words.has(p) ? words.get(p) : words.set(p, feedText(sport, p, en, '')).get(p));
    // Baseball has no clock (the inning's in the headers): no column for one.
    const clockless = list.every(p => !p.clock);
    const shown = list
      // ESPN logs some twice in a row (a delay with its words and without): said once.
      .filter((p, i) => !i || said(p) !== said(list[i - 1]) || p.clock !== list[i - 1].clock || (p.team !== list[i - 1].team && Boolean(p.who || list[i - 1].who)));
    // Each row a recipe (its key: what it shows), made only when it's needed:
    // a live refresh's rows are the ones already on the page (an NBA game's
    // 500 rebuilt every 3 seconds were a second of a phone's time each), and a
    // long game's first screen is drawn first, the rest behind it (playsNav).
    const items = [];
    let at = '';
    for (const p of live ? [...shown].reverse() : shown) {
      const period = playPeriod(p, sport, L());
      if (period && period !== at && sport !== 'soccer') items.push({ key: `h|${period}`, head: period, make: () => el('li', { class: 'period-head', text: period }) });
      at = period || at;
      const m = p.id ? marks.get(p.id) : null;
      const runs = Boolean(m && (m.periods || m.rally));
      const delta = m ? Math.round(Math.abs(m.delta) * 100) : 0;
      const chip = () => el('span', { class: `wp-gain ${m.side}`, style: tint[m.side] ? `--side:${tint[m.side]}` : null, text: `${m.side === 'home' ? sideShort(e.home.id) : sideShort(e.away.id)} +${delta}%` });
      const what = [p.id, p.clock, said(p), p.home, p.away, p.scoring, p.team, p.pic?.id, sport === 'soccer' ? period : '', m ? [m.side, delta, m.text, m.team, runs] : 0, clockless, L()];
      // A run: a line of its own after the play that ended it (its words, its swing).
      // (Its side's logo where a play has its face; the row tinted in the shirt that side wore, the chart's colour.)
      // (The logo in the clock's column where there is one, so the words have the row: 76人 16-3 超前 on one line at 320 px.)
      const run = runs
        ? {
            key: `r|${JSON.stringify(what)}`,
            run: true,
            make: () => {
              const runSide = side(m.team) || (m.side === 'home' ? e.home : e.away);
              const runLogo = () => (runSide?.logo ? logo(runSide.logo, sideShort(m.team), 'xs play-team') : el('span', { class: 'play-none', 'aria-hidden': 'true' }, [leagueMark(e.league)]));
              const runWords = () => el('span', { class: 'play-words' }, [el('span', { class: 'play-main q-fit-wrap', text: m.text })]);
              return el('li', { class: 'run-mark', style: tint[m.side] ? `--side:${tint[m.side]}` : null }, [clockless ? null : el('span', { class: 'play-when run-logo' }, [runLogo()]), el('span', { class: `play-text${clockless ? ' has-face' : ''}` }, [clockless ? runLogo() : null, runWords()]), chip()]);
            }
          }
        : null;
      const row = {
        key: `p|${JSON.stringify(what)}`,
        scoring: Boolean(p.scoring),
        moment: Boolean(m && !runs),
        make: () => {
          // A key play: its swing under its words (the score stays on the right).
          const line = playLine(e.league, p, side(p.team));
          if (m && !runs) line.querySelector('.play-words')?.append(chip());
          // (A score tinted in the shirt its side wore, as the chart colours it.)
          const by = String(p.team) === String(e.home.id) ? 'home' : String(p.team) === String(e.away.id) ? 'away' : '';
          return el('li', { class: [p.scoring ? 'scoring' : '', m && !runs ? 'key' : ''].filter(Boolean).join(' '), style: (p.scoring || (m && !runs)) && tint[by] ? `--side:${tint[by]}` : null }, [
            // The period over the clock, a designed two lines in a narrow column.
            clockless ? null : el('span', { class: 'play-when' }, [sport === 'soccer' && period ? el('small', { text: period }) : null, el('span', { class: 'num', text: p.clock })]),
            line,
            p.home != null && p.away != null ? el('strong', { class: 'num', text: inOrder(e, [p.away, p.home]).join('-') }) : null
          ]);
        }
      };
      items.push(...(live ? [run, row] : [row, run]).filter(Boolean));
    }
    return playsNav(items, clockless, lw.plays);
  }
  // 陣容: each side a card of the one shape (sideSquad), every sport and
  // moment alike (the owner, 2026-10-23: starters shown one way across the
  // sports): who starts first (先發; baseball's 打序 and its pitchers; a
  // soccer game on, who's on the pitch and who's come off), then 替補, then
  // who's out (未上場 once it's over, 傷兵 before). A game to come with no
  // starters said yet: the squad by position, the probable ones marked.
  if (view === 'lineups' && d) {
    const en = L() === 'en';
    const W = (zh, eng) => (en ? eng : zh);
    const sport = LEAGUES[e.league]?.sport;
    const pos = p => (p.pos === 'SUB' ? '' : posZh(p.pos, sport, L()));
    const hurtOf = t => d.injuries?.find(x => x.team === String(t.id))?.list || [];
    const hurtRows = list => list.map(x => ({ ...x, status: x.status || (en ? 'Injured' : '傷兵') }));
    const sides = inOrder(e, [e.away, e.home]);
    const k = t => (t === e.away ? 0 : 1);
    const rostered = d.rosters.some(r => r.players.length);
    const cards = sides.map(t => {
      const id = String(t.id);
      // Baseball (MLB's box score: its whole active roster).
      const sq = d.squads?.[id];
      if (sq) {
        const lead = (list, f) => list.map(p => ({ ...p, jersey: f(p) }));
        if (sq.order.length)
          return sideSquad(tag(id), [
            { name: W('打序', 'Batting order'), list: lead(sq.order, p => (p.sub ? '' : String(p.slot))), note: p => (p.sub ? `${W('替補', 'Sub')} · ${pos(p)}` : pos(p)) },
            { name: W('投手', 'Pitchers'), list: sq.pitched, note: p => (p.starter ? W('先發', 'Starter') : W('後援', 'Relief')) },
            { name: W('牛棚', 'Bullpen'), list: sq.bullpen },
            { name: T('bench'), list: sq.bench, note: pos },
            { name: T('injuries'), list: hurtRows(hurtOf(t)), out: true }
          ], e.league, sport);
        const probable = d.lineups?.kind === 'mlb' ? [d.lineups.pitchers.away, d.lineups.pitchers.home][k(t)] : null;
        const isProbable = p => Boolean(probable) && ((probable.id && p.id === probable.id) || p.name === probable.name);
        const KIND = [['P', W('投手', 'Pitchers')], ['C', W('捕手', 'Catchers')], ['IF', W('內野手', 'Infielders')], ['OF', W('外野手', 'Outfielders')]];
        const kind = p => (/^(P|SP|RP|TWP)$/.test(p.pos) ? 'P' : p.pos === 'C' ? 'C' : /^(1B|2B|3B|SS|IF)$/.test(p.pos) ? 'IF' : 'OF');
        return sideSquad(tag(id), [...KIND.map(([key, name]) => ({ name, list: sq.all.filter(p => kind(p) === key).sort((a, b) => isProbable(b) - isProbable(a)), note: p => (isProbable(p) ? W('預計先發', 'Probable') : key === 'P' ? '' : pos(p)) })), { name: T('injuries'), list: hurtRows(hurtOf(t)), out: true }], e.league, sport);
      }
      // Soccer's line-ups (ESPN's, an hour or so before): on now, who's on
      // the pitch, who's come off, the bench; else 先發 and 替補, each sub's
      // minute by his name.
      const r = d.rosters.find(x => x.team === id && x.players.length);
      if (r) {
        const live = (d.status || e.status).state === 'in';
        const now = sport === 'soccer' && live ? onPitch([r])[0] : null;
        const mark = p => [pos(p), p.sentOff ? W('紅牌', 'Sent off') : p.subAt && (p.subbedIn || p.subbedOut) ? `${p.subbedOut ? '↓' : '↑'}${p.subAt}` : ''].filter(Boolean).join(' · ');
        const head = tag(id, r.formation);
        if (now) return sideSquad(head, [{ name: now.on.length < 11 ? W(`場上 · ${now.on.length} 人`, `On the pitch · ${now.on.length} men`) : W('場上', 'On the pitch'), list: now.on, note: mark }, { name: W('已下場', 'Off'), list: now.off, note: mark }, { name: T('bench'), list: now.bench, note: mark }], e.league, sport);
        return sideSquad(head, [{ name: W('先發', 'Starters'), list: r.players.filter(p => p.starter), note: mark }, { name: T('bench'), list: r.players.filter(p => !p.starter), note: mark }], e.league, sport);
      }
      // A game begun (basketball's box score): 先發, 替補, 未上場 and why.
      const box = d.players.find(p => p.team === id)?.tables[0]?.rows || [];
      if (box.length && (d.status || e.status).state !== 'pre') {
        const out = box.filter(x => x.dnp || !x.stats?.some(v => v !== '' && v != null));
        // (The inactive aren't in the box score at all: the injury report's, while it's tonight's.)
        const boxed = new Set(box.flatMap(x => [x.id, x.name].filter(Boolean)));
        const away = hurtRows(hurtOf(t)).filter(x => !boxed.has(x.id) && !boxed.has(x.name));
        return sideSquad(tag(id), [
          { name: W('先發', 'Starters'), list: box.filter(x => x.starter && !out.includes(x)), note: pos },
          { name: T('bench'), list: box.filter(x => !x.starter && !out.includes(x)), note: pos },
          { name: W('未上場', 'Did not play'), list: [...out.map(sat), ...away], out: true }
        ], e.league, sport);
      }
      // A game to come: the squad (its roster), the named starters first,
      // else by position; the hurt apart, with why.
      const people = [...(d.courtSquads?.[id]?.roster || [])].sort((a, b) => posRank(a.pos, sport) - posRank(b.pos, sport));
      if (!people.length) return null;
      const hurt = new Map(hurtOf(t).map(x => [x.id || x.name, x]));
      const why = p => hurt.get(p.id) || hurt.get(p.name);
      const out = people.filter(p => why(p) || p.injured);
      const named = d.lineups?.kind === 'core' && !d.lineups.pending && !d.lineups.last ? [d.lineups.away, d.lineups.home][k(t)] || [] : [];
      const starters = people.filter(p => !out.includes(p) && named.some(x => x.id === p.id));
      const rest = people.filter(p => !out.includes(p) && !starters.includes(p));
      const groups = starters.length ? [{ name: W('先發', 'Starters'), list: starters, note: pos }, { name: T('bench'), list: rest, note: pos }] : byPosition([{ name: '', players: rest }], sport).map(g => ({ name: g.name, list: g.players }));
      return sideSquad(tag(id), [...groups, { name: T('injuries'), list: out.map(p => ({ ...p, status: why(p)?.status || (en ? 'Injured' : '傷兵'), what: why(p)?.what || '', back: why(p)?.back || '' })), out: true }], e.league, sport);
    });
    if (cards.some(Boolean) || rostered) return el('div', { class: 'lineups' }, cards.filter(Boolean));
  }
  if (view === 'table') {
    const official = table?.length ? table : [{ name: '', rows: (d?.table || []).map(r => ({ id: r.id, name: r.team, short: r.team, logo: null, stats: r.stats })) }];
    // This game over (or the day's others) before the official table has it: counted in at once, as 賽事's table does.
    const sport = LEAGUES[e.league]?.sport;
    const recent = [...(ctx.recentOf?.(e.league) || []).filter(x => x.id !== e.id), { ...e, status: d?.status || e.status, home: { ...e.home, ...(d?.home || {}) }, away: { ...e.away, ...(d?.away || {}) } }];
    const groups = table?.length && sport !== 'racing' ? tableNow(official, e.league, recent) : official;
    // A league by division (MLB's six): the divisions of this game's two sides.
    const mine = groups.filter(g => g.parent && g.rows.some(r => r.id === String(e.home.id) || r.id === String(e.away.id)));
    return standingsTables(mine.length ? mine : groups, e.league, { mark: [e.home.id, e.away.id], many: mine.length > 0 });
  }
  return overview(d, e, table, nameOf, lw);
}

// YouTube's own play button, drawn in place (nothing to load).
const ytLogo = () => {
  const mark = el('span', { class: 'yt-icon', 'aria-hidden': 'true' });
  mark.innerHTML = '<svg viewBox="0 0 28 20"><path fill="#f00" d="M27.4 3.1A3.5 3.5 0 0 0 25 .6C22.8 0 14 0 14 0S5.2 0 3 .6A3.5 3.5 0 0 0 .6 3.1C0 5.3 0 10 0 10s0 4.7.6 6.9A3.5 3.5 0 0 0 3 19.4C5.2 20 14 20 14 20s8.8 0 11-.6a3.5 3.5 0 0 0 2.4-2.5C28 14.7 28 10 28 10s0-4.7-.6-6.9Z"/><path fill="#fff" d="m11.2 14.3 7.3-4.3-7.3-4.3v8.6Z"/></svg>';
  return mark;
};
// An ended game's highlights, opened in YouTube (its app on a phone): the
// video itself when it's known as the sheet opens (found on this device, or
// in Shared-Data's pack of recent games), named for what it is (官方精華 · MLB
// · 20:12, 愛爾達精華, 全場精華 for the NBA's one channel), else YouTube's
// search, said so. Drawn once, never changed under the reader: a video found
// while it's open is kept for the next time it's opened. A game the recent
// pack has let go waits for its month of Shared-Data's season (a row the
// same size, its words only), then is drawn so.
const HL_NAME = { extended: ['完整精華', 'Extended highlights'], official: ['官方精華', 'Official highlights'], elta: ['愛爾達精華', 'ELTA highlights'], full: ['全場精華', 'Full-game highlights'], search: ['搜尋精華影片', 'Search for highlights'] };
function highlights(e, waited = false) {
  if (e?.status?.state !== 'post' || e.status.void) return null;
  const en = L() === 'en';
  if (!waited && !knownHighlights(e) && watchMonthWanted(e)) {
    const wait = el('div', { class: 'yt-link search' }, [ytLogo(), el('span', { class: 'yt-text' }, [el('strong', { text: HL_NAME.search[en ? 1 : 0] }), el('small', { class: 'one-line', text: en ? 'Finding the video…' : '找這場的影片…' })]), el('span', { class: 'yt-go', text: '›' })]);
    loadWatchMonth(e, packJson).then(() => wait.isConnected && wait.replaceWith(highlights(e, true) || ''));
    return wait;
  }
  const v = knownHighlights(e);
  const kind = highlightsKind(v);
  // (Found now: the row becomes the video's, not the search's.)
  const node = el('a', { class: `yt-link${v ? '' : ' search'}`, href: v ? videoUrl(v.id) : searchUrl(e), target: '_blank', rel: 'noopener' }, [
    ytLogo(),
    el('span', { class: 'yt-text' }, [el('strong', { text: HL_NAME[kind][en ? 1 : 0] }), el('small', { class: 'one-line', text: v ? [v.channel, v.length].filter(Boolean).join(' · ') : 'YouTube' })]),
    el('span', { class: 'yt-go', text: '›' })
  ]);
  if (!v) findHighlights(e, (url, o) => proxyJson(url, o)).then(f => f && node.isConnected && node.replaceWith(highlights(e, true))).catch(() => {});
  return node;
}

// The overview: the teams side by side, what the match is (where, when, TV),
// the win probability, each side's leaders, the season series and injuries.
function overview(d, e, table, nameOf, { line = null, wait = { summary: true, line: true } } = {}) {
  const sides = inOrder(e, [e.away, e.home]);
  const places = sides.map(s => placeOf(table, s.id));
  const sm = side => d?.byId?.[side.id] || side;
  // Each side's form in this game's competition, as on its team card opened
  // from here (leagueForm): a soccer club's cup games left out once its
  // season's in; ESPN's last five (every competition) under three there yet.
  const forms = sides.map(s => {
    const own = d?.seasonGames && leagueForm(d.seasonGames, s.id, e.league, Date.parse(e.start));
    if (own) return own.map(x => ({ result: resultFor(x, s.id), opp: sidesFor(x, s.id).them.short || '', score: sidesOf(x).map(t => t.score).join('-') }));
    const games = d?.seasonGames === undefined ? [] : d?.form.find(f => f.team === s.id)?.games || [];
    // ESPN's last five reach back into the preseason (a 2-0 team showed 敗勝勝勝勝,
    // Jay 2026-10-26): no more than the games its record counts.
    const played = /^\d+(-\d+)+$/.test(sm(s).record || '') ? sm(s).record.split('-').reduce((n, x) => n + +x, 0) : null;
    return played == null ? games : games.slice(Math.max(0, games.length - played));
  });
  const compareRows = [
    // The record: the feed's, else the table's wins and losses.
    // (A game long over: its record then, said so, never read as today's.)
    [(d?.status || e.status).state === 'post' && Date.now() - Date.parse(e.start) > 36 * 3_600_000 ? (L() === 'en' ? 'Record then' : '當時戰績') : T('record'), ...sides.map((s, i) => sm(s).record || s.record || (places[i]?.row?.stats?.W != null ? `${places[i].row.stats.W}-${places[i].row.stats.L}` : '—'))],
    places.some(Boolean) ? [T('standing'), ...places.map(p => (p ? placeCell(p, (table?.length || 0) > 1) : '—'))] : null,
    ...(places.every(Boolean) ? keyStats(e.league, places) : [])
  ].filter(Boolean);
  const compare = el('div', { class: 'compare' }, [
    el('div', { class: 'cmp-head' }, sides.map((x, i) => cmpTeam(x, i ? 'home' : 'away', e.league)).flatMap((x, i) => (i ? [el('span', { class: 'cmp-vs', text: 'vs' }), x] : [x]))),
    ...compareRows.map(([label, a, h]) => el('div', { class: 'cmp-row' }, [cmpValue(a), el('span', { text: label }), cmpValue(h)])),
    forms.some(f => f.length)
      ? el('div', { class: 'cmp-row form' }, [formPills(forms[0]), el('span', { text: T('form') }), formPills(forms[1])])
      : null
  ]);
  const when = new Date(e.start);
  // Where to watch has its own card when there's a link to it (a schedule's channel, Apple TV); the list here otherwise.
  const exactTv = e.status.state !== 'post' && tvOf(e).some(b => b.exact);
  const info = [
    // (ELTA's slot for a game whose time isn't set: under it, on a line of its own.)
    // A game over: when it ended, under the start (the last play's own clock; the owner, 2026-10-14).
    ['🕒', T('kickoff'), [el('span', { class: 'nb', text: `${dayLabel(localDate(when.getTime()), { long: true })} ${timeText(e)}` }), e.timeTbd && e.timeFrom === 'elta' ? el('small', { class: 'info-sub', text: L() === 'en' ? `ELTA's slot ${clock(e.start)}` : `愛爾達暫排 ${clock(e.start)}` }) : null, d?.endedAt ? el('small', { class: 'info-sub nb', text: endedText(d.endedAt, e.start) }) : null].filter(Boolean)],
    // The ground, and its city on a line of its own (each said apart: a ground's name never broken by its city's).
    ['📍', T('venue'), d?.venue || e.venue || d?.city ? [d?.venue || e.venue ? zhLater(d?.venue || e.venue) : null, d?.city ? el('small', { class: 'muted venue-city' }, [zhLater(d.city)]) : null].filter(Boolean) : ''],
    // Each channel on a line of its own (two in a row ran onto a second line mid-name).
    exactTv ? null : ['📺', T('tv'), tvOf(e).length ? tvOf(e).map(b => el('span', { class: 'nb info-line', text: tvName(b) })) : T('noTw')],
    // Each part whole on a line ("2-1 領先" never split; a name never broken).
    // The round, then how the series stands under it (a line each: " · " between them wrapped, the dot left hanging).
    stageTag(e, L()) ? ['🏅', T('stage'), [el('span', { class: 'nb', text: stageTag(e, L()) }), seriesText(e) ? el('small', { class: 'info-sub', text: seriesText(e) }) : null].filter(Boolean)] : null,
    ['🌤', T('weather'), weatherText(d?.weather)],
    ['👥', T('attendance'), d?.attendance ? Number(d.attendance).toLocaleString(L() === 'en' ? 'en-US' : 'zh-TW') : ''],
    ['🧑‍⚖️', T('officials'), joinNodes((d?.officials || []).slice(0, 3).map(x => el('span', { class: 'nb', text: x })), '、')],
    // ESPN's note ("ALWC - Game 1") only where the stage tag doesn't already say it.
    ['🏆', T('competition'), joinNodes([leagueName(e.league, L()), stageTag(e, L()) && L() !== 'en' ? '' : zhLater(e.note)], ' · ')]
  ]
    .filter(Boolean)
    .filter(([, , v]) => v && (!Array.isArray(v) || v.length));
  const leadersBy = sides.map(s => (d?.leaders || []).filter(l => l.team === s.id && l.name).slice(0, 4));
  // (A game over: those in its box score, who sat out, are 未上場's, not 傷兵's too.)
  const boxed = new Set((d?.status || e.status).state === 'post' ? (d?.players || []).flatMap(p => p.tables.flatMap(tb => tb.rows.flatMap(r => [r.id, r.name]))).filter(Boolean) : []);
  const hurtNow = (d?.injuries || []).map(t => ({ ...t, list: t.list.filter(x => !boxed.has(x.id) && !boxed.has(x.name)) }));
  const part = {
    replay: replayLink(e),
    highlights: highlights(e),
    // (A guest club from outside the league has no record or place to set beside the other's.)
    // (The records alone, the hero's already: no card of one row.)
    matchup: e.home.guest || e.away.guest || (compareRows.length < 2 && !forms.some(f => f.length)) ? null : card(T('matchup'), compare),
    win: winCard(d, e, line, wait),
    onField: onFieldCard(d, e, nameOf),
    lineups: lineupCard(d?.lineups, d, e, nameOf),
    leaders: leadersBy.some(x => x.length)
      ? card(
          T('leaders'),
          el(
            'div',
            { class: 'leader-cols' },
            leadersBy.map((list, i) =>
              el('div', {}, [
                el('p', { class: 'mini-h' }, [teamTag(sides[i], sides[i].short || sides[i].name, e.league)]),
                ...list.map(l => el('button', { class: 'leader', type: 'button', disabled: l.id ? null : true, onclick: () => l.id && ctx.openPlayer(e.league, l.id, { name: l.full || l.name, logo: l.headshot }) }, [personPic({ ...l, name: l.full || l.name }, e.league, 'sm round'), el('span', { class: 'leader-text' }, [el('small', { text: statName(l.stat, L(), { sport: LEAGUES[e.league]?.sport }) }), el('span', {}, [fitLine(el('strong', { class: 'one-line' }, [playerName(l.full || l.name, 'full', l.name)])), el('b', { class: 'num', text: leaderValue(l.value, L()) })])])]))
              ])
            )
          )
        )
      : null,
    season: seasonLeadCard(d?.seasonLead, e),
    series: d?.series[0]?.h2h?.n ? card(L() === 'en' ? 'Head to head' : '近期交手', h2hView(d.series[0].h2h, e), { sub: L() === 'en' ? `Last ${d.series[0].h2h.n}` : `近 ${d.series[0].h2h.n} 次` }) : d?.lastSeries ? lastSeriesCard(d.lastSeries, e) : d?.series[0]?.games?.length && ownSeriesCard(d.series[0], e) ? ownSeriesCard(d.series[0], e) : d?.series.length && d.series[0].summary && d.series[0].events.some(x => x.done) ? card(T('series'), el('p', { class: 'series-text', text: seriesZh(d.series[0].summary, e) }), { sub: { season: L() === 'en' ? 'Regular season' : '例行賽', playoff: L() === 'en' ? 'Playoffs' : '季後賽' }[d.series[0].kind] || '' }) : null,
    // A game over: who sat it out (its box score's), then who was out hurt (no one twice).
    satOut: (d?.status || e.status).state === 'post' ? satOutCard(d, e) : null,
    injuries: hurtNow.some(i => i.list.length)
      ? card(
          T('injuries'),
          el(
            'div',
            { class: 'injuries' },
            hurtNow
              .filter(i => i.list.length)
              // The cards' order (soccer home first, the rest away first).
              .sort((x, y) => ((x.team === String(e.home.id)) - (y.team === String(e.home.id))) * (homeFirst(e) ? -1 : 1))
              // Each one as the team's page has him (Jay, 2026-10-22: the why only
              // there): the status, what's wrong and when he's back.
              .map(i => el('div', {}, [el('p', { class: 'mini-h' }, [tagOf(d, e)(i.team)]), injuryBox(i.list.map(x => (/^rest$/i.test(x.detail) ? { ...x, status: L() === 'en' ? 'Rest' : '休息' } : x)), e.league)]))
          )
        )
      : null,
    tv: exactTv ? twCard(e.league, e) : null,
    info: card(T('matchInfo'), el('ul', { class: 'info-list' }, info.map(([, k, v]) => el('li', {}, [el('span', { class: 'info-k', text: k }), el('span', { class: 'info-v' }, [].concat(v))]))))
  };
  // One order whatever the game's moment (the owner, 2026-10-21: the page
  // before, during and after alike), only what's in it changing: the replay
  // and highlights once it's over, who's on (or starts), the chance, who
  // leads, the matchup, the season, the series, the rest.
  const ORDER = ['replay', 'highlights', 'onField', 'win', 'leaders', 'matchup', 'season', 'series', 'satOut', 'injuries', 'tv', 'info'];
  return el('div', { class: 'stack' }, ORDER.map(k => part[k] || (k === 'onField' ? part.lineups : null)));
}

// 本季數據領先, side by side: each stat both teams have, its leader on each
// side (in the cards' order), the first eight of them.
function seasonLeadCard(lead, e) {
  if (!lead) return null;
  const sport = LEAGUES[e.league]?.sport;
  const en = L() === 'en';
  const both = lead.a.stats.filter(st => lead.h.stats.some(x => x.key === st.key)).slice(0, 8);
  if (!both.length) return null;
  const side = (st, x) =>
    el('button', { class: 'leader', type: 'button', onclick: () => openLeader(e.league, x) }, [
      personPic({ ...x, name: x.full || x.name }, e.league, 'sm round'),
      el('span', { class: 'leader-text' }, [fitLine(el('small', { class: 'one-line', text: leaderLabel(st, sport, en) })), el('span', {}, [fitLine(el('strong', { class: 'one-line' }, [playerName(x.full || x.name, 'full', x.name)])), el('b', { class: 'num', text: x.value })])])
    ]);
  return card(
    en ? 'Season leaders' : '本季數據領先',
    el('div', { class: 'leader-cols' }, [
      ...inOrder(e, [e.away, e.home]).map(t => el('p', { class: 'mini-h' }, [teamTag(t, t.short || t.name, e.league)])),
      ...both.flatMap(st => inOrder(e, [side(st, st.list[0]), side(st, lead.h.stats.find(x => x.key === st.key).list[0])]))
    ]),
    { sub: leadersSeason(lead.a, sport, en) }
  );
}

// 先發陣容 on 概況, before the start, one card in every sport: each side
// under its name, its starters as 陣容's rows (number or place in the order,
// face, name, position), and in the corner whether they're 已公布, 預計 or
// 上場先發. MLB's probable pitcher heads his side's batting order; soccer's
// eleven come with ESPN's line-ups (about an hour before); until a sport's
// are said, when they will be.
function lineupCard(l, d, e, nameOf) {
  if ((d?.status || e.status).state !== 'pre') return null;
  const en = L() === 'en';
  const W = (zh, eng) => (en ? eng : zh);
  const sport = LEAGUES[e.league]?.sport;
  const sides = inOrder(e, [e.away, e.home]);
  const k = t => (t === e.away ? 0 : 1);
  const pos = p => (p.pos === 'SUB' ? '' : posZh(p.pos, sport, L()));
  // (Each side's name and rows held together, as 陣容's are: the card's gap only between the sides, Jay 2026-10-28.)
  const side = (t, list, note = pos, extra = '') => (list.length ? [el('div', {}, [el('p', { class: 'mini-h' }, [teamTag(t, [nameOf(t.id), extra].filter(Boolean).join(' · '), e.league)]), squadList(list, e.league, sport, note, { bare: true })])] : []);
  const title = W('先發陣容', 'Starting lineups');
  const pending = text => card(title, el('p', { class: 'muted small', text }));
  const xi = sides.map(t => d?.rosters?.find(r => r.team === String(t.id) && r.players.some(p => p.starter)));
  if (sport === 'soccer' && xi.some(Boolean))
    return card(title, el('div', { class: 'injuries' }, sides.flatMap((t, i) => (xi[i] ? side(t, xi[i].players.filter(p => p.starter), pos, xi[i].formation) : []))), { sub: W('已公布', 'Announced') });
  // Not named yet: each side's eleven from its last game, said so (上場先發); the real one about an hour before.
  if (sport === 'soccer' && l?.kind === 'soccer')
    return card(title, el('div', { class: 'injuries' }, sides.flatMap(t => [l.away, l.home][k(t)] ? side(t, [l.away, l.home][k(t)].players, pos, [l.away, l.home][k(t)].formation) : [])), { sub: W('上場先發', 'Last game') });
  if (sport === 'soccer') return Date.parse(e.start) - Date.now() < 2 * 86_400_000 ? pending(W('開賽前約 1 小時公布。', 'Named about an hour before kick-off.')) : null;
  if (!l) return null;
  if (l.kind === 'mlb') {
    // Each side: its probable pitcher (待定 under an empty face while MLB
    // hasn't named him), then its batting order once posted.
    const posted = sides.some(t => [l.order.away, l.order.home][k(t)].length);
    const of = t => [{ ...([l.pitchers.away, l.pitchers.home][k(t)] || { id: '', name: W('待定', 'TBD'), tbd: true }), jersey: '', probable: true }, ...[l.order.away, l.order.home][k(t)].map((p, i) => ({ ...p, jersey: String(i + 1) }))];
    return card(
      title,
      el('div', { class: 'injuries' }, sides.flatMap(t => side(t, of(t), p => (p.tbd ? '' : p.probable ? W('先發投手', 'Starting pitcher') : pos(p))))),
      { sub: posted ? W('打序已公布', 'Batting orders posted') : W('打序賽前數小時公布', 'Batting orders hours before') }
    );
  }
  if (l.pending) return pending(W('開賽前約 30 分鐘公布。', 'Named about 30 minutes before tip-off.'));
  return card(
    title,
    el('div', { class: 'injuries' }, sides.flatMap(t => side(t, [l.away, l.home][k(t)]))),
    // (RotoWire's: expected hours before, confirmed once each team says it.)
    // (Nothing said for this game yet: each side's five last time out, 上場先發.)
    { sub: l.last ? W('上場先發', 'Last game') : l.projected ? W('預計先發', 'Expected') : !l.confirmed || (l.confirmed.away && l.confirmed.home) ? W('已公布', 'Announced') : W('預計先發', 'Expected') }
  );
}

// "結束 21:26" (another day's: "結束 10/15 01:02"); English "Ended 21:26".
function endedText(at, start) {
  const en = L() === 'en';
  const day = localDate(Date.parse(at)) !== localDate(Date.parse(start)) ? `${dayLabel(localDate(Date.parse(at)))} ` : '';
  return `${en ? 'Ended' : '結束'} ${day}${clock(at)}`;
}
// A game on: who's on the court or the pitch now (lib/onfield.mjs), in the
// starting lineups' place and look, drawn again with each refresh (5 s).
// Basketball: each five with their points, rebounds and assists (fouls
// from the fourth, the trouble); soccer: each side's players on the pitch in
// the formation's order, a sub with the minute he came on, a side down to
// ten said so.
function onFieldCard(d, e, nameOf) {
  if (!d || (d.status || e.status).state !== 'in') return null;
  const en = L() === 'en';
  const sport = LEAGUES[e.league]?.sport;
  const sides = inOrder(e, [e.away, e.home]).map(t => String(t.id));
  const order = list => sides.map(id => list.find(x => x.team === id)).filter(Boolean);
  if (sport === 'basketball') {
    const five = order(onCourt(d.players));
    if (!five.length) return null;
    const shirt = shirtsOf(d, e);
    // Each side's five as a row of faces (no court: a basketball position
    // is no place on the floor): the number; a green ↑ at the corner for one
    // who came on (off the bench, or a starter back from a rest; soccer's sub on), and under the name 先發 or 替補 in
    // words (the owner, 2026-10-13: a corner mark for a starter went
    // unseen); his points, then rebounds and assists, fouls from the fourth
    // in red. Under the row, the side's starters sitting now.
    const tile = (p, colour) =>
      el('button', { class: 'five-tile', type: 'button', style: `--shirt:${colour}`, 'aria-label': `${p.full || p.name}${p.starter ? (en ? ', starter' : '，先發') : en ? ', off the bench' : '，替補'}`, onclick: () => p.id && ctx.openPlayer(e.league, p.id, { name: p.full || p.name, logo: p.headshot }) }, [
        el('span', { class: 'pm-face' }, [personPic({ ...p, name: p.full || p.name }, e.league, 'pm-pic'), p.jersey ? el('span', { class: 'pm-num num', style: `color:${inkOn(colour)}`, text: p.jersey }) : null, p.starter && !p.cameOn ? null : el('span', { class: 'pm-sub on', 'aria-hidden': 'true', text: '↑' })]),
        el('span', { class: 'pm-name one' }, [playerName(p.full || p.name, 'short', tileName(p))]),
        // Said in words, not a mark to learn: 先發 or 替補 (the green ↑ on the face too).
        el('span', { class: `five-role${p.starter ? ' starter' : ''}`, text: p.starter ? (en ? 'Starter' : '先發') : en ? 'Bench' : '替補' }),
        el('strong', { class: 'five-pts num', text: en ? `${p.line.pts || 0} PTS` : `${p.line.pts || 0} 分` }),
        el('small', { class: 'five-more num' }, [en ? `${p.line.reb || 0} R ${p.line.ast || 0} A` : `${p.line.reb || 0}板 ${p.line.ast || 0}助`, Number(p.line.pf) >= 4 ? el('b', { class: 'foul-trouble', text: en ? ` ${p.line.pf}PF` : ` ${p.line.pf}犯` }) : null])
      ]);
    // The side's starters sitting now, by name (a tap opens each).
    // On one line (the owner: chips took too much room): each a face in his
    // team's ring, a tap opening him on 本場 (his name said to VoiceOver).
    const resting = s =>
      s.resting.length
        ? el('div', { class: 'five-resting' }, [
            el('span', { class: 'muted', text: en ? 'Starters sitting' : '先發休息' }),
            ...s.resting.map(p => el('button', { class: 'rest-face', type: 'button', style: `--shirt:${shirt[s.team]}`, 'aria-label': `${p.full || p.name}, ${en ? `${p.line.pts || 0} points` : `${p.line.pts || 0} 分`}`, title: surnameOf(p), onclick: () => p.id && ctx.openPlayer(e.league, p.id, { name: p.full || p.name, logo: p.headshot }) }, [personPic({ ...p, name: p.full || p.name }, e.league, 'rest-pic round')]))
          ])
        : null;
    return card(en ? 'On the court' : '場上球員', el('div', { class: 'five-sides' }, five.map(s => el('div', {}, [el('p', { class: 'mini-h' }, [tagOf(d, e)(s.team)]), fitFive(el('div', { class: 'five-row' }, s.players.map(p => tile(p, shirt[s.team])))), resting(s)]))), { sub: en ? 'Live' : '即時' });
  }
  if (sport === 'baseball' && d.field) return card(en ? 'On the field' : '場上球員', diamondView(d, e, nameOf), { sub: en ? 'Live' : '即時' });
  if (sport === 'soccer') {
    const xi = order(onPitch(d.rosters));
    if (xi.length < 2) return null;
    return card(en ? 'On the pitch' : '場上球員', el('div', {}, [pitchView(xi, d, e, nameOf), subsList(xi, tagOf(d, e), e.league)]), { sub: en ? 'Live' : '即時' });
  }
  return null;
}
// The pitch as a broadcast draws it: the away side in the top half
// attacking down, the home side in the bottom half attacking up, each
// player a shirt in his team's colour with his number, in his place in the
// formation (lib/onfield.mjs pitchSpots), his name under it; one who came
// on with a green ↑. A side's name and shape at its own end.
function pitchView([away, home], d, e, nameOf) {
  const en = L() === 'en';
  const shirt = shirtsOf(d, e);
  const [awayShirt, homeShirt] = [shirt[away.team], shirt[home.team]];
  const surname = surnameOf;
  // His face in a ring of his team's colour, his number on it; a sub on with a green ↑. A tap: his page.
  const marker = (p, x, y, shirt) =>
    el('button', { class: 'pm', type: 'button', style: `left:${(x * 100).toFixed(1)}%;top:${(y * 100).toFixed(1)}%;--shirt:${shirt}`, 'aria-label': `${p.name}${p.subbedIn ? (en ? ', came on' : '，替補上場') : ''}`, onclick: () => p.id && ctx.openPlayer(e.league, p.id, { name: p.name, logo: p.headshot }) }, [
      el('span', { class: 'pm-face' }, [personPic(p, e.league, 'pm-pic'), p.jersey ? el('span', { class: 'pm-num num', style: `color:${inkOn(shirt)}`, text: p.jersey }) : null, p.subbedIn ? el('span', { class: 'pm-sub on', 'aria-hidden': 'true', text: '↑' }) : null]),
      // One line, a long surname smaller (fitted to the marker below), never broken at its hyphen.
      el('span', { class: oneLineName(surname(p)) }, [playerName(p.full || p.name, 'short', surname(p))])
    ]);
  const spots = [
    // The away side's left is the screen's right, its goal at the top.
    ...pitchSpots(away.held, away.formation).filter(s => !s.p.sentOff).map(s => marker(s.p, 1 - s.x, s.y / 2, awayShirt)),
    ...pitchSpots(home.held, home.formation).filter(s => !s.p.sentOff).map(s => marker(s.p, s.x, 1 - s.y / 2, homeShirt))
  ];
  const label = s => el('p', { class: 'pitch-team' }, [el('strong', {}, [tagOf(d, e)(s.team)]), el('span', { class: 'num', text: [s.formation, s.on.length < 11 ? (en ? `${s.on.length} men` : `${s.on.length} 人`) : ''].filter(Boolean).join(' · ') })]);
  const pitch = el('div', { class: 'pitch' }, [el('div', { class: 'pitch-lines', 'aria-hidden': 'true', html: PITCH_LINES }), ...spots]);
  fiveWatch?.observe(pitch);
  return el('div', { class: 'pitch-wrap' }, [label(away), pitch, label(home)]);
}
// Baseball's field as a broadcast draws it (MLB's own word on who's where,
// espn.mjs summary's d.field): the side in the field, each of the nine a
// face at his position in his team's colour, the batter by the plate in
// his; the bases with a runner lit, and under it the inning, the outs, the
// batter and who's on. A face opens the player (ESPN's, found by name).
const RUNNER_SPOTS = [[70, 66], [50, 47], [30, 66]];
const FIELD_SPOTS = { P: [50, 66], C: [50, 91], '1B': [80, 53], '2B': [63, 44], SS: [37, 44], '3B': [20, 53], LF: [20, 29], CF: [50, 16], RF: [80, 29] };
function diamondView(d, e, nameOf) {
  const en = L() === 'en';
  const f = d.field;
  const shirt = shirtsOf(d, e);
  const [fieldSide, batSide] = f.fielding === 'home' ? [e.home, e.away] : [e.away, e.home];
  const rows = new Map((d.players || []).flatMap(p => p.tables.flatMap(tb => tb.rows)).map(r => [personKey(r.full || r.name), r]));
  // A pitcher just in (or a pinch runner) is on the field before he's in the
  // box score: the whole active roster (陣容's, ESPN's ids) finds him.
  const squad = new Map(Object.values(d.squads || {}).flatMap(sq => sq.all || []).filter(p => p.id).map(p => [personKey(p.name), p]));
  const who = full => {
    const r = rows.get(personKey(full))?.id ? rows.get(personKey(full)) : squad.get(personKey(full));
    return { id: r?.id || '', name: full, full, short: r?.name || '', headshot: r?.headshot || null };
  };
  const marker = (full, [x, y], colour, label = '', cls = '') => {
    if (!full) return null;
    const p = who(full);
    return el('button', { class: `pm${cls ? ` ${cls}` : ''}`, type: 'button', style: `left:${x}%;top:${y}%;--shirt:${colour}`, 'aria-label': `${label ? `${label} ` : ''}${full}`, onclick: () => p.id && ctx.openPlayer(e.league, p.id, { name: full, logo: p.headshot }) }, [
      el('span', { class: 'pm-face' }, [personPic(p, e.league, 'pm-pic'), label ? el('span', { class: 'pm-num', style: `color:${inkOn(colour)}`, text: label }) : null]),
      el('span', { class: oneLineName(tileName({ name: full, full, short: p.short || full.split(' ').slice(1).join(' ') || full })) }, [playerName(full, 'short', tileName({ name: full, full, short: p.short || full.split(' ').slice(1).join(' ') || full }))])
    ]);
  };
  const posWord = k => (en ? k : posZh(k, 'baseball', 'zh').replace(/手$/, '').replace('外野', '外'));
  const lit = f.runners.map(Boolean);
  const field = el('div', { class: 'diamond-field' }, [
    el('div', { class: 'pitch-lines', 'aria-hidden': 'true', html: diamondLines(lit) }),
    ...Object.entries(FIELD_SPOTS).map(([k, at]) => marker(f.defense[k], at, shirt[String(fieldSide.id)], posWord(k))),
    marker(f.batter, [31, 86], shirt[String(batSide.id)], en ? 'AB' : '打'),
    // Each runner on his base: a smaller face, his base on it, no name (the
    // line under the field names him; a name here ran over the infielders'),
    // the corner infielders a step off the bag; a tap opens him as any other.
    ...f.runners.map((r, i) => marker(r, RUNNER_SPOTS[i], shirt[String(batSide.id)], en ? ['1B', '2B', '3B'][i] : ['一', '二', '三'][i], 'runner'))
  ]);
  fiveWatch?.observe(field);
  const half = en ? `${f.top ? 'Top' : 'Bottom'} ${f.inning}` : `${f.inning} 局${f.top ? '上' : '下'}`;
  const bases = en ? ['1st', '2nd', '3rd'] : ['一壘', '二壘', '三壘'];
  const on = f.runners.map((r, i) => (r ? `${bases[i]} ${surnameOf({ name: r, short: who(r).short || r })}` : '')).filter(Boolean);
  return el('div', { class: 'pitch-wrap' }, [
    el('p', { class: 'pitch-team' }, [el('strong', {}, [teamTag(fieldSide, `${nameOf(String(fieldSide.id))} ${en ? 'in the field' : '守備'}`, e.league)]), el('span', { class: 'num', text: `${half} · ${en ? `${f.outs} out` : `${f.outs} 出局`}` })]),
    field,
    el('p', { class: 'diamond-at-bat' }, [
      teamTag(batSide, `${nameOf(String(batSide.id))} ${en ? 'batting' : '進攻'}${f.batter ? ` · ${en ? '' : '打者 '}${who(f.batter).short || f.batter}${f.order ? (en ? ` (#${Math.floor(f.order / 100) || f.order})` : `（第 ${Math.floor(f.order / 100) || f.order} 棒）`) : ''}` : ''}`, e.league),
      el('span', { class: 'muted', text: on.length ? on.join(' · ') : en ? 'Bases empty' : '壘上無人' })
    ])
  ]);
}
// The field (100 × 100, home plate at the bottom): the outfield's fan, the
// infield's dirt, the foul lines, the mound, and the bases (a runner's lit).
const diamondLines = lit =>
  `<svg viewBox="0 0 100 100" preserveAspectRatio="none" stroke="currentColor" stroke-width=".5"><path d="M50 86 L0 36 A70.7 70.7 0 0 1 100 36 Z" fill="var(--pitch)"/><path d="M50 90 L73 67 L50 44 L27 67 Z" fill="var(--dirt)" stroke="none"/><path d="M50 86 L0 36 M50 86 L100 36" fill="none"/><circle cx="50" cy="68" r="3" fill="var(--dirt)"/>${[
    [69, 67],
    [50, 48],
    [31, 67]
  ].map(([x, y], i) => `<rect x="${x - 2.2}" y="${y - 2.2}" width="4.4" height="4.4" transform="rotate(45 ${x} ${y})" fill="${lit[i] ? 'var(--accent)' : 'var(--q-surface)'}" stroke="${lit[i] ? 'var(--accent)' : 'currentColor'}"/>`).join('')}<path d="M48 85h4l0 2-2 2-2-2z" fill="var(--q-surface)"/></svg>`;
// The substitutions so far, each side's in order: the minute, who came on
// (green ↑) and who went off (red ↓) on one line; a red card too. One grid
// for both sides, so the minutes, the ↑s and the ↓s each stand in a column.
function subsList(sides, tag, league) {
  const en = L() === 'en';
  const cells = sides.flatMap(s => {
    const all = [...s.on, ...s.off];
    const byId = new Map(all.map(p => [p.id, p]));
    // 90'+2' before 90'+12': the minute, then the added ones.
    const minute = t => {
      const [m = 0, add = 0] = (String(t).match(/\d+/g) || []).map(Number);
      return m + add / 1000;
    };
    // One person: the mark, his face, his name; a tap to his page.
    const who = (p, kind) => {
      if (!p?.name) return el('span');
      const mark = kind === 'sent' ? el('b', { class: 'card-red', 'aria-hidden': 'true' }) : el('b', { class: `sub-arrow ${kind}`, 'aria-hidden': 'true', text: kind === 'in' ? '↑' : '↓' });
      const kids = [mark, personPic({ ...p, en: p.name }, league, 'xs round'), el('span', { text: p.short || p.name }), kind === 'sent' ? el('span', { class: 'muted', text: en ? 'sent off' : '紅牌' }) : null];
      const label = `${p.name}${kind === 'in' ? (en ? ', on' : '，上場') : kind === 'out' ? (en ? ', off' : '，下場') : en ? ', sent off' : '，紅牌'}`;
      // A long name (A. Maitland-Niles) a little smaller till it fits its column, never past the card.
      return fitLine(p.id ? el('button', { class: `link sub-who ${kind}`, type: 'button', 'aria-label': label, onclick: () => ctx.openPlayer(league, p.id, { name: p.name, logo: p.headshot }) }, kids) : el('span', { class: `sub-who ${kind}`, 'aria-label': label }, kids));
    };
    const rows = [
      ...all.filter(p => p.subbedIn).map(p => ({ at: p.subAt, cells: [who(p, 'in'), who(byId.get(p.inFor), 'out')] })),
      ...all.filter(p => p.sentOff).map(p => ({ at: p.sentAt, cells: [who(p, 'sent')] }))
    ].sort((a, b) => minute(a.at) - minute(b.at));
    if (!rows.length) return [];
    return [el('p', { class: 'mini-h subs-team' }, [tag(s.team)]), ...rows.flatMap(r => [el('span', { class: 'num sub-at', text: r.at }), ...r.cells])];
  });
  return cells.length ? el('div', { class: 'subs-block' }, [el('p', { class: 'subs-h', text: en ? 'Substitutions' : '換人' }), el('div', { class: 'subs-grid' }, cells)]) : null;
}
// The card's colour as it's drawn now (light or dark), and each side's
// colour on it (sideColors: always two, told apart): the win chance chart's
// bands and labels, the stat bars, the players' rings.
const cardBg = () => getComputedStyle(document.documentElement).getPropertyValue('--q-surface').trim() || '#ffffff';
// (In the shirts the sides wore that day where the game's page says, its summary's kits: gameKits.)
const gameKits = new Map();
function tintOf(e) {
  const kits = gameKits.get(`${e.league}|${e.id}`) || {};
  // The shirt's colour as it is (white on a dark card, black on a light one,
  // where it shows: sideColors), else its trim's where it has a hue, else the club's own.
  const worn = s => {
    const k = kits[String(s.id)];
    const c = [k?.color, k?.alt].find(hasHue);
    return k ? { ...s, shirt: k.color, ...(c ? { color: c, alt: s.color } : {}) } : s;
  };
  return sideColors(worn(e.home), worn(e.away), cardBg());
}
// Each side's colour as text: its band's, darker (or lighter) to read at 4.5:1.
const inkOf = c => readableOn(c, cardBg(), 4.5) || c;
// Each side's colour for its players' rings: the win chance chart's, so a
// side's ring is the colour its line is (the owner, 2026-10-17: Chelsea's
// ring navy on the pitch, its line white).
function shirtsOf(d, e) {
  const tint = tintOf(e);
  return { [String(e.away.id)]: tint.away, [String(e.home.id)]: tint.home };
}
// A name as a shirt says it: "O. Costa" → Costa ("João Marcelo" as it is).
// A suffix (Jr., Sr., II, III) left off: the face and number say who (McCullar Jr. ran onto a second line).
const surnameOf = p => {
  const s = p.short || (p.full ? p.name : '') || p.name || '';
  return (/^\S{1,3}\. /.test(s) ? s.replace(/^\S{1,3}\. /, '') : s).replace(/,?\s+(Jr\.?|Sr\.?|II|III|IV)$/i, '');
};
// The name in a tile, as broadcasts say a long one (the owner, 2026-10-16:
// Gilgeous-Alexander took two tiles' room): a long double-barrelled surname
// as the initials (Shai Gilgeous-Alexander SGA, Trent Alexander-Arnold TAA,
// Kentavious Caldwell-Pope KCP); Antetokounmpo by his first name (Giannis,
// Thanasis); otherwise the surname.
const tileName = p => {
  const sur = surnameOf(p);
  const first = String(p.full || '').split(/\s+/)[0] || '';
  if (/^Antetokounmpo$/i.test(sur) && first) return first;
  if (sur.includes('-') && sur.length > 10 && first) return [first, ...sur.split('-')].map(w => w[0]).join('').toUpperCase();
  return sur;
};
// A name on one line in a narrow tile: smaller as it's longer, never wrapped.
const oneLineName = name => `pm-name one${name.length > 11 ? ' tight' : name.length > 8 ? ' snug' : ''}`;
const hexRgb = c => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c || ''));
  return m ? [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)) : null;
};
const inkOn = c => {
  const x = hexRgb(c);
  return x && (0.299 * x[0] + 0.587 * x[1] + 0.114 * x[2]) / 255 > 0.6 ? '#111' : '#fff';
};
// The pitch's lines: 68 wide, drawn 128 long (a real one is 105): a
// broadcast's pitch is longer than life, so four lines a side fit with a
// face and a two-line name between each (a 4-2-3-1 against a 4-2-3-1, both
// strikers at the centre). The touchlines, halfway, the centre circle, both
// boxes and six-yard boxes at their real sizes, in the theme's line colour.
const PITCH_LINES = '<svg viewBox="0 0 68 128" preserveAspectRatio="none" fill="none" stroke="currentColor" stroke-width=".5"><rect x="1" y="1" width="66" height="126"/><path d="M1 64h66"/><circle cx="34" cy="64" r="9.15"/><circle cx="34" cy="64" r=".6" fill="currentColor"/><path d="M13.84 1v16.5h40.32V1M24.84 1v5.5h18.32V1M13.84 127V110.5h40.32V127M24.84 127V121.5h18.32V127"/><path d="M26.7 17.5a9.15 9.15 0 0 0 14.6 0M26.7 110.5a9.15 9.15 0 0 1 14.6 0"/></svg>';

// A few table columns worth comparing, by sport.
function keyStats(league, places) {
  const sport = LEAGUES[league]?.sport;
  const want = { soccer: ['P', 'GD', 'F', 'A'], baseball: ['PCT', 'GB', 'STRK'], basketball: ['PCT', 'GB', 'STRK'] }[sport] || [];
  // Games behind the leader of the table shown next to it (ESPN's own figure
  // can be against another list, such as the division, and read as nonsense).
  const gb = p => {
    const [w, l, lw, ll] = [p.row.stats.W, p.row.stats.L, p.lead.stats.W, p.lead.stats.L].map(Number);
    if (![w, l, lw, ll].every(Number.isFinite)) return null;
    const n = (lw - w + (l - ll)) / 2;
    return n <= 0 ? '—' : String(n);
  };
  return want
    .map(k => (k === 'GB' ? [k, ...places.map(gb)] : [k, ...places.map(p => p.row.stats[k])]))
    .filter(([, a, h]) => a != null && a !== '' && h != null && h !== '')
    .map(([k, a, h]) => [T(`col_${k}`) === `col_${k}` ? k : T(`col_${k}`), a, h]);
}
// A long group name to its initials ("Eastern Conference Group" → ECG).
export const groupShort = name => {
  const n = String(name || '').trim();
  if (n.length <= 12) return n;
  const caps = n.split(/[\s-]+/).filter(w => /^[A-Z]/.test(w)).map(w => w[0]).join('');
  return caps.length >= 2 ? caps : n;
};
const placeCell = (p, grouped) => [T('placeN', { n: p.pos }), grouped && p.group ? groupShort(p.group) : ''];
const cmpValue = v => (Array.isArray(v) ? el('strong', { class: 'cmp-val' }, [el('span', { class: 'num', text: v[0] }), v[1] ? el('small', { text: v[1] }) : null]) : el('strong', { class: 'cmp-val num', text: v }));
const cmpTeam = (s, cls, league) => teamTap(s, league, `cmp-team ${cls}`, [sideLogo(s, league, 'sm'), el('span', { text: s.short || s.name })]);
// (勝和敗 in Chinese, as on the team card.)
const formPills = games => el('div', { class: 'form-pills' }, games.slice(-5).map(g => el('span', { class: `pill ${g.result}`, title: `${g.opp} ${g.score}`, text: L() === 'en' ? g.result : { W: '勝', D: '和', L: '敗' }[g.result] || g.result })));

// The game's win chance card: to come, each side's chance; on or over, the
// chart. One source for a game, decided before it shows: the sportsbook's,
// else (a league Polymarket covers) its market, else ESPN's own model; while the
// one it waits for is coming, the card in its shape, the real one fading in.
const waited = new WeakMap();
function winCard(d, e, line, wait) {
  const state = (d?.status || e.status).state;
  const market = Boolean(PM_LEAGUE[e.league]) && e.kind === 'match';
  const sport = LEAGUES[e.league]?.sport;
  let real = null;
  let coming = false;
  if (state === 'pre') {
    const book = d?.predict && d.predict.source !== 'espn' ? d.predict : null;
    real = book || (line?.home != null ? line : null) || (wait.summary && (!market || wait.line) ? d?.predict : null);
    coming = !real && (!wait.summary || (market && !wait.line));
    if (real) real = winChanceCard(real, e);
  } else {
    if (sport === 'soccer' && e.kind === 'match') {
      // Worked out from the game (lib/soccerwp.mjs), its odds before the start
      // ESPN's or the sportsbook's, else the market's first price, else a usual game's.
      const prior = d?.predict || (line?.points?.[0] ? line.points[0] : null);
      const status = { ...(d?.status || e.status) };
      const model = d && (prior || !market || wait.line) ? soccerLine({ prior, timeline: d.timeline, events: d.events, status, homeId: e.home.id, start: e.start, score: { home: (d.home || e.home)?.score, away: (d.away || e.away)?.score } }) : null;
      real = model ? winProbCard(model, e, d.timeline, d.events) : null;
      coming = !real && (!wait.summary || (market && !d?.predict && !wait.line));
    } else {
      real = d?.winProb.length > 3 ? winProbCard({ points: d.winProb }, e, d.timeline) : line?.points?.length > 3 ? winProbCard(line, e, d?.timeline, d?.events) : null;
      coming = !real && ((!wait.summary && (market || ['baseball', 'basketball'].includes(sport))) || (market && wait.summary && !wait.line));
    }
  }
  if (coming) {
    waited.set(wait, true);
    return state === 'pre'
      ? card(T('winChance'), el('div', { class: 'wp waiting' }, [skeleton([22, 16, 22], 'wc-skel'), el('i', { class: 'skel wc-skel-bar' })]))
      : card(T('winProb'), el('div', { class: 'wp waiting' }, [skeleton([22, 22], 'wc-skel'), el('i', { class: 'skel wp-skel-chart' })]));
  }
  if (real && waited.get(wait)) {
    real.classList.add('fade-in');
    // Once: the same card is kept from one refresh to the next, and moved in again would fade again.
    real.addEventListener('animationend', () => real.classList.remove('fade-in'), { once: true });
    waited.delete(wait);
  }
  return real;
}

// Each side's colour on a win chance card: its band's (--home, --away) and
// its label's (--home-ink, --away-ink), so a chance reads as whose it is; a draw's grey.
const sideVars = e => {
  const tint = tintOf(e);
  return `--home:${tint.home};--away:${tint.away};--home-ink:${inkOf(tint.home)};--away-ink:${inkOf(tint.away)}`;
};
// A game to come: each side's chance (and a draw's), one bar split by them;
// a sportsbook's odds, else Polymarket's price, else ESPN's prediction.
function winChanceCard(odds, e) {
  if (odds?.home == null) return null;
  const en = L() === 'en';
  const home = Math.round(odds.home * 100);
  const draw = odds.draw != null ? Math.round(odds.draw * 100) : null;
  const away = Math.max(0, 100 - home - (draw ?? 0));
  return card(
    T('winChance'),
    el('div', { class: 'wp', style: sideVars(e) }, [
      // Each side with its small logo beside its name and chance.
      el('div', { class: 'wp-labels wc-labels' }, (() => {
        const a = el('span', { class: 'away' }, homeFirst(e) ? [document.createTextNode(`${e.away.short || e.away.name} ${away}%`), logo(e.away.logo, e.away.name, 'xs')] : [logo(e.away.logo, e.away.name, 'xs'), document.createTextNode(`${e.away.short || e.away.name} ${away}%`)]);
        const h = el('span', { class: 'home' }, homeFirst(e) ? [logo(e.home.logo, e.home.name, 'xs'), document.createTextNode(`${e.home.short || e.home.name} ${home}%`)] : [document.createTextNode(`${e.home.short || e.home.name} ${home}%`), logo(e.home.logo, e.home.name, 'xs')]);
        return [...inOrder(e, [a, h]).flatMap((x, i) => (i ? [x] : [x, draw != null ? el('span', { class: 'draw', text: `${en ? 'Draw' : '和局'} ${draw}%` }) : null]))];
      })()),
      el('div', { class: 'wc-bar', 'aria-hidden': 'true' }, inOrder(e, [el('span', { class: 'away', style: `flex:${away}` }), el('span', { class: 'home', style: `flex:${home}` })]).flatMap((x, i) => (i ? [x] : [x, draw ? el('span', { class: 'draw', style: `flex:${draw}` }) : null])))
    ])
  );
}

// The win probability over the game: the home side's chance up, the away
// side's down (a draw counts half to each, so a level game sits on the
// middle line), the periods marked under it. Its key moments (lib/
// moments.mjs: the plays and runs that turned it, a soccer game's goals)
// dotted on it and listed under it; a finger (or a mouse) on it reads any
// moment: each side's chance then, the period, and the moment if it's near
// one (it snaps to it). A game on: the latest swing, just now. ESPN's, else
// Polymarket's market on it (said under it).
// Each game's chart as last drawn ('league|id'): the same card while its
// points are the same (nothing redrawn under a reader), and the moment
// picked from its list kept across a redraw with a new point.
const wpKept = new Map();
function winProbCard(line, e, timeline, events = []) {
  // (Over: the result, as the chances a point holds.)
  const r = e.status.state === 'post' ? outcome(e.home, e.away) : '';
  const final = r ? { W: { home: 1, draw: 0 }, L: { home: 0, draw: 0 }, D: { home: 0, draw: 1 } }[r] : null;
  const pts = holdToEnd(line.points, timeline, final);
  const keyOf = `${e.league}|${e.id}`;
  const kept = wpKept.get(keyOf) || {};
  const last = pts.at(-1) || {};
  const sig = [pts.length, last.home, last.draw, last.t, e.status.state, L(), cardBg(), (events || []).length].join('|');
  // On the page already: a stand-in for it in the new drawing (paint puts the card itself back in its place).
  const stay = c => (c.isConnected ? Object.assign(el('div', { hidden: true }), { __keep: c }) : c);
  if (kept.card && kept.sig === sig) return stay(kept.card);
  const sport = LEAGUES[e.league]?.sport;
  const en = L() === 'en';
  const w = 320;
  const h = 90;
  const xs = lineXs(pts, timeline);
  // The chances stacked, each a band as tall as it (the owner's call,
  // 2026-10-15: a draw's chance was lost in one line): the home side's on
  // top, a draw's grey in the middle (soccer), the away side's below. A
  // point's place: the middle of the draw (the two sides' edge without one).
  const mid = p => p.home + (p.draw ?? 0) / 2;
  const X = i => (xs[i] * w).toFixed(1);
  // Where the market stood still: no price, so no telling how it went. Its
  // bands go straight from the last price to the next (a price frozen to the
  // final whistle read as the game's story, the result a sliver at the edge),
  // faded there. Points at one place (the prices after the whistle, all at
  // the end): the last of them.
  const quiet = quietRuns(pts);
  const drawn = pts.map((p, i) => i).filter(i => (i === pts.length - 1 || xs[i + 1] !== xs[i]) && !quiet.some(([a, b]) => i > a && i <= b && i < pts.length - 1));
  const edge = f => drawn.map(i => `${X(i)},${(f(pts[i]) * h).toFixed(1)}`);
  // A finger's place on the bands: in a still stretch, on its straight way.
  const midAt = i => {
    const run = quiet.find(([a, b]) => i > a && i <= b && i < pts.length - 1);
    if (!run) return mid(pts[i]);
    const [a, j] = [run[0], Math.min(run[1] + 1, pts.length - 1)];
    const k = xs[j] > xs[a] ? (xs[i] - xs[a]) / (xs[j] - xs[a]) : 1;
    return mid(pts[a]) + (mid(pts[j]) - mid(pts[a])) * k;
  };
  const [e1, e2] = [edge(p => p.home), edge(p => p.home + (p.draw ?? 0))];
  const [x0, x1] = [X(0), X(pts.length - 1)];
  const homeArea = `M${x0},0 L${e1.join(' L')} L${x1},0 Z`;
  const drawArea = pts.some(p => p.draw) ? `M${e1.join(' L')} L${[...e2].reverse().join(' L')} Z` : '';
  const awayArea = `M${e2.join(' L')} L${x1},${h} L${x0},${h} Z`;
  const isQuiet = i => quiet.some(([a, b]) => i > a && i < b);
  const gaps = quiet.map(([a, b]) => `<rect x="${X(a)}" y="0" width="${(Number(X(b)) - Number(X(a))).toFixed(1)}" height="${h}" class="wp-quiet"/>`).join('');
  const marks = periodMarks(timeline, sport, pts, en);
  const grid = marks.filter(m => m.x > 0.01).map(m => `<line x1="${(m.x * w).toFixed(1)}" x2="${(m.x * w).toFixed(1)}" y1="0" y2="${h}" class="wp-grid"/>`).join('');
  const sideName = s => s.short || s.name;
  // Each side in its own colour (sideColors: two reds, one takes a spare;
  // none, spares), on the card as it's drawn now (light or dark): the home
  // side's band on top, the away side's below, each label in its band's.
  const tint = tintOf(e);
  const [homeC, awayC] = [tint.home, tint.away];
  const sideC = s => (s === 'home' ? homeC : awayC);
  const side = { home: { id: e.home.id, name: sideName(e.home) }, away: { id: e.away.id, name: sideName(e.away) }, en };
  const moments = (pts.every(p => p.n) ? playMoments(pts, sport, side) : eventMoments(pts, events, sport, side, pts.map(p => p.t))).filter(m => !isQuiet(m.i));
  // When it was: the period (a stretch, its periods), the clock in the last two minutes, the score after it.
  const momentAt = m => {
    const [a, b] = m.periods || [];
    // 第2–3節, 2–3局 (one word for both ends).
    const when = a && b && b > a ? (en ? `${periodName(sport, a, en)}–${periodName(sport, b, en)}` : `${periodName(sport, a, en).replace(/[節局]$/, '')}–${periodName(sport, b, en).replace(/^第/, '')}`) : pointStamp(timeline, sport, m.t != null ? { ...pts[m.i], t: m.t } : pts[m.i], en);
    // A run that took the lead (or tied it): the score on the play that did,
    // not where the lagging price peaked (98–91 for a lead taken at 89–88).
    const at = m.lead ?? m.i;
    const score = scoreAt(pts, at, events, e.home.id);
    return [when, lateClock(sport, pts[at]), score ? inOrder(e, score).join('–') : ''].filter(Boolean).join(' · ');
  };
  // Whose chance it lifted, and by how much.
  const gain = m => `${side[m.delta >= 0 ? 'home' : 'away'].name} +${Math.round(Math.abs(m.delta) * 100)}%`;
  // (None on a decided game's run to the result: no price there to move.)
  const gainChip = m => pts[m.i]?.settled ? null : el('span', { class: `wp-gain ${m.side}`, style: `--side:${sideC(m.delta >= 0 ? 'home' : 'away')}`, text: gain(m) });
  // The key moment closest to a finger (within 2.5% of the chart), if any.
  const near = i => nearestMoment(listed, xs, i);
  // The sides in the cards' order, adding up to 100.
  const away = el('span', { class: 'away' });
  const draw = pts.some(p => p.draw != null) ? el('span', { class: 'draw' }) : null;
  const home = el('span', { class: 'home' });
  const at = el('small', { class: 'wp-at' });
  const why = el('div', { class: 'wp-why', hidden: true });
  const rule = el('span', { class: 'wp-rule', hidden: true });
  const dot = el('span', { class: 'wp-dot', hidden: true });
  const live = e.status.state === 'in';
  const rest = e.status.state === 'post' ? (en ? 'Final' : '終場') : pointStamp(timeline, sport, pts.at(-1), en) || (en ? 'Now' : '目前');
  // A game on: a swing among its last few points is news.
  const latestOf = () => (live ? listed.find(m => pts.length - 1 - m.i <= Math.max(2, pts.length * 0.03)) : null);
  // The player's face (the batter, the scorer), else the team's badge (a run), else the sport's sign.
  // A run's team badge to the team's page.
  const teamTap = x => (hasTeamPage(e.league) && x.id && !x.guest ? el('button', { class: 'wp-who team', type: 'button', 'aria-label': x.name || '', onclick: ev => (ev.stopPropagation(), ctx.openTeam(e.league, x.id, x)) }, [sideLogo(x, e.league, 'sm')]) : sideLogo(x, e.league, 'sm'));
  const face = m => (m.pics?.length > 1 ? el('span', { class: 'wp-pair' }, m.pics.map(p => personTap(e.league, p, personPic(p, e.league, 'sm round')))) : m.pic ? personTap(e.league, m.pic, personPic(m.pic, e.league, 'sm round')) : m.team ? teamTap(String(m.team) === String(e.home.id) ? e.home : e.away) : momentGlyph(m.icon));
  const tell = (m, label) => {
    why.hidden = !m;
    // The words on one line, the chance's move under them (the owner,
    // 2026-10-16: beside them it pushed the words onto two lines); a little
    // smaller only where it's still too long.
    if (m) put(why, el('span', { class: 'wp-why-icon' }, [face(m)]), el('span', { class: 'wp-why-text' }, [...momentWords(m.text, label), gainChip(m)]));
    if (m) fitLine(why.querySelector('.mo-main'));
  };
  // Dotted on the line: the big swings and a lead taken or tied, never two crowding each other (the bigger kept; a lead taken first).
  // (Baseball: a run scored over a pitch next to it.)
  const weight = m => (m.always ? 2 : 0) + (m.rally ? 1 : 0) + (m.turned ? 1 : 0) + Math.abs(m.delta);
  // A moment's dot on the edge of the band of the side it helped (the home
  // side's above, the away side's below the draw), not in the draw's middle.
  const pinY = m => (m.delta >= 0 ? pts[m.i].home : pts[m.i].home + (pts[m.i].draw ?? 0));
  const dotted = [];
  // (A soccer game's goals and red cards always: Ipswich–Man City's five goals moved a favourite's price little, and none had a dot.)
  // (A goal always: Messi's 2–0 at 56' and 3–0 at 60' sat closer than the
  // spacing, and the second went unlisted; only one on top of another goes.)
  for (const m of moments.filter(m => Math.abs(m.delta) >= 0.12 || m.turned || m.always).sort((a, b) => weight(b) - weight(a))) if (dotted.every(d => Math.abs(xs[d.i] - xs[m.i]) >= (m.always ? 0.012 : 0.04))) dotted.push(m);
  // The list is the dotted ones, in the game's order (the owner, 2026-10-18:
  // a moment listed with no dot read as one that didn't matter).
  const listed = [...dotted].sort((a, b) => a.i - b.i);
  const show = (j, picked) => {
    // A moment picked from the list: that one; a finger close to one: on it.
    const m = picked || (j != null ? near(j) : null);
    rows.forEach((r, k) => r.classList.toggle('on', listed[k] === picked));
    const i = m ? m.i : j;
    const p = pts[i ?? pts.length - 1];
    const [hh, dd] = [Math.round(p.home * 100), p.draw != null ? Math.round(p.draw * 100) : 0];
    const pct = v => `${v}%`;
    away.textContent = `${sideName(e.away)} ${pct(Math.max(0, 100 - hh - dd))}`;
    if (draw) draw.textContent = `${en ? 'Draw' : '和局'} ${pct(dd)}`;
    home.textContent = `${sideName(e.home)} ${pct(hh)}`;
    // Where the game was: the period and the score then (in the cards' order).
    const score = scoreAt(pts, i ?? pts.length - 1, events, e.home.id);
    const tally = score ? ` · ${inOrder(e, score).join('–')}` : '';
    const stamp = [pointStamp(timeline, sport, p, en) || `${i + 1} / ${pts.length}`, lateClock(sport, p)].filter(Boolean).join(' ');
    // (On a key moment: its own words, as its row in the list has them, so the two never differ: Jay, 2026-10-28.)
    at.textContent = i == null ? `${rest}${tally}` : m ? momentAt(m) : `${stamp}${tally}`;
    at.classList.toggle('on', i != null);
    const latest = latestOf();
    tell(i == null ? latest : m, i == null && latest ? (en ? 'Just now' : '剛剛') : '');
    // The rule wherever the finger is; the ring only round a moment it's on
    // (the owner, 2026-10-16: a dot anywhere else looked like a moment with
    // nothing in it).
    rule.hidden = i == null;
    dot.hidden = i == null || !dotted.includes(m);
    if (i == null) return;
    rule.style.left = dot.style.left = `${xs[i] * 100}%`;
    dot.style.top = `${(dotted.includes(m) ? pinY(m) : midAt(i)) * 100}%`;
  };
  const pins = dotted.map(m => el('span', { class: `wp-moment ${m.side}`, style: `left:${xs[m.i] * 100}%;top:${pinY(m) * 100}%;background:${sideC(m.delta >= 0 ? 'home' : 'away')}` }));
  // Each band in its side's colour (a draw's grey), the even line dashed across.
  // A white or black side's band near solid, so it never reads as the draw's grey.
  const solid = c => (hasHue(c) ? '62%' : '92%');
  const band = (d, c, cls = '') => (d ? `<path d="${d}" class="wp-band${cls}" style="fill:${c}"/>` : '');
  const svg = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="wp-chart" aria-hidden="true">${band(homeArea, `color-mix(in srgb, ${homeC} ${solid(homeC)}, transparent)`)}${band(drawArea, 'color-mix(in srgb, var(--q-muted) 38%, transparent)', ' draw')}${band(awayArea, `color-mix(in srgb, ${awayC} ${solid(awayC)}, transparent)`)}${grid}<line x1="0" x2="${w}" y1="${h / 2}" y2="${h / 2}" class="wp-mid"/>${gaps}</svg>`;
  const plot = scrubPlot(xs, show, [el('div', { html: svg }), ...pins, rule, dot]);
  dot.classList.add('ring');
  // Whose half is whose: each side's logo beside the chart (never over the line).
  const frame = el('div', { class: 'wp-frame' }, [el('div', { class: 'wp-sides', 'aria-hidden': 'true' }, [sideLogo(e.home, e.league, 'xs'), sideLogo(e.away, e.league, 'xs')]), plot]);
  // The key moments, in the game's order: a tap puts the chart on that one (brought into view).
  const rows = listed.map(m =>
    // The face to the player's page, the rest to the chart.
    el('div', { class: 'wp-mo' }, [
      el('span', { class: 'wp-mo-face' }, [face(m)]),
      el('button', { type: 'button', class: 'wp-mo-go', onclick: () => ((state.picked = m.i), show(m.i, m), bringIn(plot)) }, [
        el('span', { class: 'wp-mo-body' }, [el('small', { class: 'wp-mo-at', text: momentAt(m) }), el('span', { class: 'wp-mo-text' }, oneLineWords(m.text))]),
        gainChip(m)
      ])
    ])
  );
  show();
  // The moment picked before this redraw, picked again (a point's place
  // never moves as new ones come: they're added at the end).
  const again = kept.picked != null ? listed.find(m => m.i === kept.picked) : null;
  const state = { picked: again ? again.i : null };
  if (again) show(again.i, again);
  const list = listed.length
    ? el('div', { class: 'wp-moments' }, [
        el('p', { class: 'mini-h', text: en ? 'Key moments' : '關鍵時刻' }),
        ...rows
      ])
    : null;
  const box = el('div', { class: 'wp', style: sideVars(e) }, [
    el('div', { class: 'wp-labels wc-labels' }, (([l, rt]) => [l, draw, rt])(inOrder(e, [el('span', { class: 'away' }, homeFirst(e) ? [away, sideLogo(e.away, e.league, 'xs')] : [sideLogo(e.away, e.league, 'xs'), away]), el('span', { class: 'home' }, homeFirst(e) ? [sideLogo(e.home, e.league, 'xs'), home] : [home, sideLogo(e.home, e.league, 'xs')])]))),
    at,
    frame,
    el('div', { class: 'wp-axis-in' }, [axisRow(marks)]),
    why,
    list
  ]);
  // (A finger on the chart lets a picked moment go: it shows where the finger is, then the latest.)
  plot.__impl = { xs, show, down: () => (state.picked = null) };
  // The chart on the page already: changed in place, never replaced, so
  // what's being looked at stays (the owner, 2026-10-13: it reset to the
  // latest with every refresh). Its touch area, its frame and its card stay
  // the same elements; the line, the dots, the labels and the list are the
  // new ones; then the point under the finger (or the mouse), or the moment
  // picked, is shown again on the new line.
  if (kept.card?.isConnected && kept.plot) {
    const old = kept.plot;
    old.replaceChildren(...plot.childNodes);
    old.__impl = plot.__impl;
    kept.frame.firstChild.replaceWith(frame.firstChild);
    // (The sides' colours too: the theme may have changed under it.)
    kept.box.style.cssText = box.style.cssText;
    put(kept.box, ...[...box.childNodes].map(n => (n === frame ? kept.frame : n)));
    if (old.__at != null && old.__at < pts.length) show(old.__at);
    wpKept.set(keyOf, { ...kept, sig, get picked() { return state.picked; } });
    return stay(kept.card);
  }
  const made = card(T('winProb'), box);
  wpKept.set(keyOf, { sig, card: made, box, frame, plot, get picked() { return state.picked; } });
  return made;
}

// A team's game notes under its tables (baseball's, as MLB's own box score
// has them): each group (打擊, 跑壘, 投球, 守備) its lines, the note's name
// in Chinese over ESPN's words (the players' names as ESPN writes them).
const NOTE_GROUP = { battingDetails: ['打擊', 'Batting'], baserunningDetails: ['跑壘', 'Baserunning'], pitchingDetails: ['投球', 'Pitching'], fieldingDetails: ['守備', 'Fielding'] };
const NOTE_ZH = {
  doubles: '二壘安打', triples: '三壘安打', homeruns: '全壘打', homeRuns: '全壘打', totalBases: '壘打數', rbi: '打點', '2outRBI': '兩出局打點',
  sacHit: '犧牲觸擊', sacFly: '高飛犧牲打', sacFlies: '高飛犧牲打', gidp: '雙殺打', teamLOB: '球隊殘壘', teamRISP: '得點圈打擊',
  runnersLeftScoringPosition2Outs: '兩出局得點圈殘壘', stolenBases: '盜壘', caughtStealing: '盜壘失敗', pickoffs: '牽制出局', hitByPitch: '觸身球',
  wildPitches: '暴投', balks: '投手犯規', intentionalWalks: '故意四壞', firstPitchStrikesBattersFaced: '首球好球／面對打者', strikeRatio: '好球（看-揮-界外-擊出）',
  groundballFlyballRatio: '滾地-飛球', gameScores: '比賽分數', topSpeed: '最快球速', errors: '失誤', doublePlays: '雙殺', triplePlays: '三殺', passedBalls: '捕逸', outfieldAssists: '外野助殺'
};
function gameNotes(t, title) {
  if (!t) return null;
  const en = L() === 'en';
  return card(
    title,
    el(
      'div',
      { class: 'game-notes' },
      t.groups.map(g =>
        el('div', { class: 'gn-group' }, [
          el('p', { class: 'mini-h', text: NOTE_GROUP[g.name]?.[en ? 1 : 0] || g.name }),
          ...g.items.map(x => el('p', { class: 'gn-line' }, [el('b', { text: en ? x.abbr || x.label : NOTE_ZH[x.key] || x.abbr || x.label }), el('span', { text: x.text })]))
        ])
      )
    )
  );
}
// A box score's table, sorted by a column's tap: the most first, a second
// tap the fewest, a third back to the box score's own order. A made-of
// count (FG 7-11) by what was made; a player with no numbers (yet to come
// on) always last.
// (Each table's sort kept for the game, by its key: the sheet draws its
// sections again on a live game's refresh and on coming back from a
// player's page, and the sort stays as it was left.)
const boxSorts = new Map();
// A box score's name in its one width: a long one by the last name alone
// (Hartenstein, Gilgeous-Alexander) unless a teammate shares it (Jal. and
// Jay. Williams kept apart); still long, smaller, and past that on two lines
// at its hyphen (Jay, 2026-10-21: a long name pushed the numbers off).
const lastName = n => String(n || '').replace(/^(\S+\.\s+)+/, '');
// A player page's name: past 12 letters, given names and surname each on a line of their own.
const heroName = full => {
  const cut = full.length > 12 ? full.replace(/,?\s+(Jr\.?|Sr\.?|II|III|IV|V)$/i, '').lastIndexOf(' ') : -1;
  return cut > 0 ? [full.slice(0, cut), el('br'), full.slice(cut + 1)] : [full];
};
function boxNames(rows) {
  const count = {};
  for (const [r] of rows) count[lastName(r.name)] = (count[lastName(r.name)] || 0) + 1;
  for (const [r, tr] of rows) {
    const span = tr?.querySelector?.('.box-name');
    if (!span) continue;
    const name = (r.name || '').length > 12 && count[lastName(r.name)] === 1 ? lastName(r.name) : r.name || '';
    // A name still long (Gilgeous-Alexander): two lines at its hyphen or
    // space, set in the markup (Safari wouldn't break it there itself and cut it, Jay 2026-10-21).
    const cut = name.length > 13 ? Math.max(name.lastIndexOf('-', name.length - 3) + 1, name.lastIndexOf(' ') + 1) : 0;
    if (cut > 2) {
      span.replaceChildren(document.createTextNode(name.slice(0, cut).trimEnd()), el('br'), document.createTextNode(name.slice(cut)));
      span.classList.add('long');
    } else span.textContent = name;
  }
  // Each fitted once drawn: smaller where it runs over, on two lines past that.
  const spans = rows.map(([, tr]) => tr?.querySelector?.('.box-name')).filter(Boolean);
  let tries = 0;
  const fit = () => {
    if (!spans[0]?.isConnected) return ++tries < 20 && requestAnimationFrame(fit);
    for (const sp of spans) {
      if (sp.scrollWidth <= sp.clientWidth + 1) continue;
      sp.classList.add('mid');
      if (sp.scrollWidth > sp.clientWidth + 1) sp.classList.add('tiny');
    }
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fit);
}
function boxTable(tb, key, sport, rowOf) {
  const rows = tb.rows.map(r => [r, rowOf(r)]);
  boxNames(rows);
  const body = el('tbody', {}, rows.map(([, tr]) => tr));
  let { by, dir } = boxSorts.get(key) || { by: -1, dir: 0 };
  const value = (r, i) => {
    const m = /^[+-]?\d+(\.\d+)?/.exec(String(r.stats[i] ?? '').trim());
    return m ? Number(m[0]) : null;
  };
  const apply = () => {
    const order = by < 0 ? rows : [...rows].sort((a, b) => {
      const [x, y] = [value(a[0], by), value(b[0], by)];
      if (x == null || y == null) return (x == null) - (y == null);
      return (x - y) * dir;
    });
    body.replaceChildren(...order.map(([, tr]) => tr));
    heads.forEach((h, k) => {
      h.setAttribute('aria-sort', k === by ? (dir < 0 ? 'descending' : 'ascending') : 'none');
      h.classList.toggle('on', k === by);
    });
  };
  const heads = tb.labels.map((l, i) =>
    el('th', { class: 'sortable', 'aria-sort': 'none' }, [
      el('button', { type: 'button', class: 'sort-btn', title: l, text: boxHead(l, L(), { sport, long: tb.longs?.[i], pitching: tb.name === 'pitching' }), onclick: () => {
        dir = by === i ? (dir === -1 ? 1 : dir === 1 ? 0 : -1) : -1;
        by = dir ? i : -1;
        boxSorts.set(key, { by, dir });
        apply();
      } })
    ])
  );
  if (by >= 0 && by < tb.labels.length) apply();
  // The team's totals under its players (never sorted among them).
  const totals = tb.totals?.some(v => v !== '' && v != null) ? el('tfoot', {}, [el('tr', {}, [el('th', { class: 'left', text: L() === 'en' ? 'Totals' : '合計' }), ...tb.labels.map((_, i) => el('td', { class: 'num', text: tb.totals[i] ?? '' }))])]) : null;
  return el('div', { class: 'table-wrap' }, [el('table', { class: 'data box' }, [el('thead', {}, [el('tr', {}, [el('th', { class: 'left' }), ...heads])]), body, totals])]);
}
// A moment's words: the play on the first line, what came of it small on
// the second ("E. Hernandez 全壘打" over "2 分打點 · 超前"), so neither
// wraps at a stray ·. (A long play, an English sentence, takes two lines.)
// A key moment's row: its words on one line, a little smaller where long
// (VAR：取消 12 碼罰球 beside a face wrapped to two).
const oneLineWords = text => {
  const [main, sub] = momentWords(text);
  // (The line under it too: an English one runs longer.)
  return [fitLine(main), sub && fitLine(sub)];
};
const momentWords = (text, label = '') => {
  const [main, ...rest] = String(text || '').split(' · ');
  return [el('span', { class: 'mo-main' }, [label ? el('b', { text: `${label} · ` }) : null, document.createTextNode(main)]), rest.length ? el('small', { class: 'mo-sub', text: rest.join(' · ') }) : null];
};
// 過程's way around a long game (an NBA game's 400-odd plays): a bar kept
// at the top while it scrolls, a filter (全部 / 得分 / 關鍵: every play,
// the scores, the chart's key moments) and a chip a period that jumps to
// it. Only when the list is long; the filter kept across a live game's
// refreshes (and other games: a way of reading).
// `items`: the rows' recipes in order ({ key, make, head?, scoring?, moment?, run? });
// `keep`: the sheet's own ({ rows: the rows made so far by key, shown: the
// list on the page now }). Only the rows in reach are made: the first
// screen's at once, more as the list is scrolled near its end, and a live
// refresh changes only what changed in the list already there (a new play
// on top, a run's swing), where it's read and its filter as they were. (A
// tap on 過程 made all 500 rows and their 1,000 pictures at once, over a
// second on a phone, and again at every 3-second refresh of a game on.)
const PLAYS_LONG = 40;
const PLAYS_PAGE = 40;
let playsShow = 'all';
function playsNav(items, clockless, keep = { rows: new Map() }) {
  const en = L() === 'en';
  const was = keep.shown?.__plays && keep.shown.isConnected ? keep.shown : null;
  const wrap = was || el('div', { class: 'plays-wrap' });
  const st = (wrap.__plays ||= { ol: el('ol', { class: 'plays' }), nav: el('div', { class: 'plays-nav' }), filter: el('div'), end: el('div', { class: 'plays-end', 'aria-hidden': 'true' }), heads: '', kinds: '', count: 0 });
  const { ol } = st;
  ol.className = `plays${clockless ? ' clockless' : ''}`;
  const long = items.filter(it => !it.head).length >= PLAYS_LONG;
  const kinds = long ? [['all', en ? 'All' : '全部'], ['score', en ? 'Scores' : '得分'], ['key', en ? 'Key' : '關鍵']].filter(([k]) => k === 'all' || items.some(it => (k === 'score' ? it.scoring : it.moment || it.run))) : [];
  if (!kinds.some(([k]) => k === playsShow)) playsShow = 'all';
  // The rows the filter shows (a period's header only over a row of its own).
  const shownItems = () => {
    if (playsShow === 'all') return items;
    const out = [];
    let head = null;
    for (const it of items) {
      if (it.head) head = it;
      else if (it.run || (playsShow === 'score' ? it.scoring : it.moment)) {
        if (head) out.push(head), (head = null);
        out.push(it);
      }
    }
    return out;
  };
  // Each recipe's row: the one made before for the same play as it was, else made now.
  const made = new Map();
  const nodeOf = it => {
    let n = made.has(it.key) ? null : keep.rows.get(it.key);
    if (!n) n = it.make();
    made.set(it.key, n);
    return n;
  };
  let list = shownItems();
  // The first `n` of them in the list, the ones already there left where they are.
  const draw = n => {
    made.clear();
    let cur = ol.firstElementChild;
    for (const it of list.slice(0, n)) {
      const node = nodeOf(it);
      if (node === cur) cur = cur.nextElementSibling;
      else ol.insertBefore(node, cur);
    }
    while (cur) {
      const next = cur.nextElementSibling;
      cur.remove();
      cur = next;
    }
    st.count = Math.min(n, list.length);
    for (const [k, v] of made) keep.rows.set(k, v);
  };
  // More once the list's end comes near (a screen and a half ahead).
  const more = n => {
    if (st.count >= list.length) return;
    const add = document.createDocumentFragment();
    for (const it of list.slice(st.count, st.count + n)) add.append(nodeOf(it));
    ol.append(add);
    st.count = Math.min(st.count + n, list.length);
    for (const [k, v] of made) keep.rows.set(k, v);
    // (Still near: looked at again, the observer only tells of a change.)
    watch();
  };
  st.more = () => more(PLAYS_PAGE);
  // (Watched against the sheet's own scrolling box once it's on the page: against the screen, the box's edge cut the margin off.)
  const watch = () => {
    if (typeof IntersectionObserver !== 'function' || !wrap.isConnected) return;
    if (!st.io) {
      const root = wrap.closest('.q-sheet');
      st.io = new IntersectionObserver(seen => seen.some(x => x.isIntersecting) && st.more(), { root, rootMargin: '0px 0px 1200px 0px' });
    }
    st.io.unobserve(st.end);
    if (st.count < list.length) st.io.observe(st.end);
  };
  // (Where a live game's reader had read to stays made; the rows the game no longer has, let go.)
  const keys = new Set(items.map(it => it.key));
  for (const k of keep.rows.keys()) if (!keys.has(k)) keep.rows.delete(k);
  draw(Math.max(PLAYS_PAGE, st.count));
  if (typeof IntersectionObserver !== 'function') more(list.length);
  else if (wrap.isConnected) watch();
  else requestAnimationFrame(watch);
  const pick = k => {
    playsShow = k;
    list = shownItems();
    draw(PLAYS_PAGE);
    watch();
    put(st.filter, segmented(kinds, playsShow, pick, 'plays-filter'));
  };
  // The bar: drawn again only when its chips change (a jump row kept where it was scrolled).
  const headKey = items.filter(it => it.head).map(it => it.head).join('|');
  const kindKey = kinds.map(([k]) => k).join('|');
  if (st.kinds !== kindKey || !was) {
    st.kinds = kindKey;
    put(st.filter, kinds.length > 1 ? segmented(kinds, playsShow, pick, 'plays-filter') : null);
  }
  st.pick = pick;
  // A period's chip: its rows made if they aren't yet, then its header at the top.
  st.jump = head => {
    const at = list.findIndex(it => it.head === head);
    if (at < 0) return;
    if (at + PLAYS_PAGE > st.count) more(at + PLAYS_PAGE - st.count);
    const node = keep.rows.get(list[at].key);
    if (!node) return;
    // (The rows above it are laid out only as they come near, sized as
    // guessed until then: put right just under the bar once they are.)
    const settle = (tries = 3) => {
      const scroller = wrap.closest('.q-sheet');
      const off = node.getBoundingClientRect().top - st.nav.getBoundingClientRect().bottom;
      if (scroller && Math.abs(off) > 2) scroller.scrollTop += off;
      if (tries > 1) requestAnimationFrame(() => settle(tries - 1));
    };
    node.scrollIntoView({ block: 'start' });
    requestAnimationFrame(() => settle());
  };
  if (st.heads !== headKey || !was) {
    st.heads = headKey;
    const heads = items.filter(it => it.head).map(it => it.head);
    const jumps = long && heads.length > 1 ? el('div', { class: 'plays-jump' }, heads.map(h => el('button', { type: 'button', class: 'q-chip', text: h, onclick: () => st.jump(h) }))) : null;
    put(st.nav, kinds.length > 1 ? st.filter : null, jumps);
  }
  st.nav.style.display = long ? '' : 'none';
  if (!was) wrap.append(st.nav, ol, st.end);
  return wrap;
}

// A chart scrolled into view when a moment under it is picked (a long list leaves it off the screen).
function bringIn(plot) {
  const r = plot.getBoundingClientRect();
  if (r.top < 60 || r.bottom > innerHeight - 20) plot.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
// A chart's plot a finger (or a mouse) reads: show(i) for the point nearest
// it while it's down, show() again once it lets go.
function scrubPlot(xs, show, kids) {
  // (Through plot.__impl: a chart updated in place swaps its points and its
  // show, the element under the finger stays the same.)
  const impl = () => plot.__impl || { xs, show };
  const pick = ev => {
    const { xs: at, show: put_ } = impl();
    const r = plot.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
    let lo = 0;
    let hi = at.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (at[mid] <= f) lo = mid;
      else hi = mid;
    }
    // The point looked at (kept: a refresh shows it again on the new line).
    plot.__at = f - at[lo] <= at[hi] - f ? lo : hi;
    put_(plot.__at);
  };
  const leave = () => ((plot.__at = null), impl().show());
  let held = false;
  const plot = el(
    'div',
    {
      class: 'wp-plot',
      onpointerdown: ev => {
        held = true;
        impl().down?.();
        plot.setPointerCapture?.(ev.pointerId);
        pick(ev);
      },
      onpointermove: ev => (held || ev.pointerType === 'mouse') && pick(ev),
      onpointerup: () => ((held = false), leave()),
      onpointercancel: () => ((held = false), leave()),
      onpointerleave: ev => ev.pointerType === 'mouse' && !held && leave()
    },
    kids
  );
  return plot;
}
// The marks under a chart (periods, laps, hours).
const axisRow = marks => (marks.length ? el('div', { class: 'wp-axis', 'aria-hidden': 'true' }, marks.map(m => el('span', { class: m.x < 0.04 ? 'start' : m.x > 0.96 ? 'end' : '', style: `left:${(m.x * 100).toFixed(2)}%`, text: m.label }))) : null);

// An F1 race's chance for each driver (Polymarket's winner market): over or
// on, a line per driver who ever had a real chance, in the team's colour (a
// teammate's dashed), by lap (while it runs too, from F1's feed; by the
// clock only till two laps are run); a finger on it reads each one's chance
// at that lap. To come: each
// one's chance now, the likeliest first.
const driverShort = name => f1Driver(name).surname || name.split(' ').at(-1);
function raceChanceCard(line, ss, feed = null) {
  const en = L() === 'en';
  if (line.drivers[0]?.chance != null)
    return card(
      T('winChance'),
      el('div', { class: 'wp' }, [
        el(
          'div',
          { class: 'rc-bars' },
          // Each a tap to the driver's page (the weekend's field, or before it's out, the season's drivers).
          line.drivers.map(d =>
            el('button', { class: 'rc-bar', type: 'button', onclick: async () => {
              const who = fieldDriver(ss.field, d.name) || fieldDriver(await seasonDrivers(), d.name);
              if (who?.id) ctx.openPlayer('f1', who.id, who);
            } }, [el('span', { class: 'rc-name' }, [personPic(fieldDriver(ss.field, d.name) || { name: d.name }, 'f1', 'xs round'), el('span', { text: driverShort(d.name) })]), el('span', { class: 'rc-track' }, [el('i', { style: `width:${Math.max(2, d.chance * 100)}%;background:${f1Driver(d.name).color}` })]), el('strong', { class: 'num', text: `${Math.round(d.chance * 100)}%` })])
          )
        )
      ])
    );
  const pts = line.points;
  const w = 320;
  const h = 110;
  const byLap = line.by === 'lap';
  const xs = byLap ? pts.map(p => p.lap / Math.max(1, pts.at(-1).lap)) : lineXs(pts);
  const seen = new Set();
  const paths = line.drivers
    .map((name, k) => {
      const { color, team } = f1Driver(name);
      const mate = seen.has(team || name);
      seen.add(team || name);
      return `<path d="${pts.map((p, i) => `${i ? 'L' : 'M'}${(xs[i] * w).toFixed(1)},${(h - p.c[k] * h).toFixed(1)}`).join(' ')}" class="rc-line" style="stroke:${color}"${mate ? ' stroke-dasharray="5 3"' : ''}/>`;
    })
    .reverse()
    .join('');
  // Every ten laps (or the clock's hours), lined up under the chart.
  const marks = byLap
    ? pts.filter(p => p.lap && p.lap % 10 === 0).map(p => ({ x: p.lap / pts.at(-1).lap, label: en ? `L${p.lap}` : `${p.lap}圈` }))
    : periodMarks([], 'f1', pts, en);
  const grid = [0.25, 0.5, 0.75].map(y => `<line x1="0" x2="${w}" y1="${h * y}" y2="${h * y}" class="wp-mid"/>`).join('') + marks.map(m => `<line x1="${(m.x * w).toFixed(1)}" x2="${(m.x * w).toFixed(1)}" y1="0" y2="${h}" class="wp-grid"/>`).join('');
  // A teammate's chip a ring, as their line is dashed.
  const teams = new Set();
  const chips = line.drivers.map(name => {
    const { color, team } = f1Driver(name);
    const mate = teams.has(team || name);
    teams.add(team || name);
    const who = fieldDriver(ss.field, name);
    return el(who?.id ? 'button' : 'span', { class: `rc-chip${mate ? ' mate' : ''}`, type: who?.id ? 'button' : null, onclick: who?.id ? () => ctx.openPlayer('f1', who.id, who) : null }, [el('i', { class: 'rc-face', style: `--team:${color}` }, [personPic(who || { name }, 'f1', 'xs round')]), el('span', { text: driverShort(name, en) }), el('strong', { class: 'num' })]);
  });
  // What turned it: the safety car (the race's kept turns, or a race on, the live feed's), stops, leads.
  const last = pts.length - 1;
  const idxOfLap = lap => Math.max(0, Math.min(last, pts.findIndex(p => p.lap >= lap) < 0 ? last : pts.findIndex(p => p.lap >= lap)));
  const idxOfT = t => {
    let k = 0;
    while (k < last && pts[k + 1].t <= t) k++;
    return k;
  };
  let bands = [];
  let events = [];
  if (byLap && line.bands) {
    bands = line.bands.map(([from, to, kind, why, who]) => ({ i0: idxOfLap(from - 1), i1: idxOfLap(to), kind, from, to, why, who }));
    events = (line.events || []).map(([lap, kind, k]) => ({ i: idxOfLap(lap), kind, k }));
  } else if (feed?.control?.length) {
    // A race on: the live feed's race control, by its laps (or the clock, before two laps are run).
    const msgs = feed.control.map(m => ({ ...m, t: Date.parse(/Z|[+-]\d\d:?\d\d$/.test(m.at) ? m.at : `${m.at}Z`) / 1000 })).filter(m => Number.isFinite(m.t));
    const byT = new Map(msgs.map(m => [m.t, m]));
    // A car's number to its driver's name (the feed's cars).
    const family = n => feed.cars?.find(c => String(c.no) === String(n))?.name || '';
    bands = controlBands(msgs, m => m.t, pts.at(-1).t ?? Infinity).map(([a, b, kind, m]) => {
      const cause = causeOf(msgs, m?.t ?? a, [], family);
      const from = byT.get(a)?.lap || null;
      const to = byT.get(b)?.lap || feed.lap?.now || null;
      return { i0: byLap ? idxOfLap((from || 1) - 1) : idxOfT(a), i1: byLap ? idxOfLap(to || from || 1) : idxOfT(b), kind, from, to, why: cause?.kind, who: cause?.who };
    });
    // By lap: who led each lap, the drawn drivers' stops and retirements, as a race over has them.
    if (byLap) events = liveRaceEvents(feed, line.drivers).filter(([lap]) => lap <= pts.at(-1).lap).map(([lap, kind, k]) => ({ i: idxOfLap(lap), kind, k }));
  }
  const names = line.drivers.map(n => driverShort(n, en));
  // (The start: the first lap's end, or three minutes in on the clock.)
  const start = byLap ? idxOfLap(1) : idxOfT(pts[0].t + 180);
  const moments = raceMoments(pts, names, bands, events, en, n => driverShort(n, en), start);
  // (Every moment, a band's start too, in the order of the race: the list under the chart.)
  const listed = [...moments].sort((a, b) => a.i - b.i);
  // The driver's face: the one a moment is about (a band, its cause).
  const face = m => {
    const name = m.band ? m.driver || '' : line.drivers[m.k];
    const who = fieldDriver(ss.field, name);
    return personTap('f1', who, personPic(who || { name }, 'f1', 'sm round'));
  };
  const colorOf = k => f1Driver(line.drivers[k]).color;
  // (None on a decided game's run to the result: no price there to move.)
  const gainChip = m => {
    const { k, delta } = m.gain || m;
    return pts[m.i]?.settled || Math.round(Math.abs(delta) * 100) < 1 ? null : el('span', { class: 'wp-gain', style: `color:${colorOf(k)};background:color-mix(in srgb, ${colorOf(k)} 16%, transparent)`, text: `${names[k]} ${delta >= 0 ? '+' : '−'}${Math.round(Math.abs(delta) * 100)}%` });
  };
  const shade = bands.map(b => `<rect x="${(xs[b.i0] * w).toFixed(1)}" y="0" width="${Math.max(2, (xs[b.i1] - xs[b.i0]) * w).toFixed(1)}" height="${h}" class="rc-band ${b.kind}"/>`).join('');
  // Tagged in a strip above the chart (never over the lines), each at its band's start; one close after another (a virtual safety car turned real) just after it.
  let free = 0;
  const tags = bands.map(b => {
    const x = Math.min(0.9, Math.max(xs[b.i0], free));
    free = x + 0.1;
    return el('span', { class: `rc-band-tag ${b.kind}`, style: `left:${x * 100}%`, text: b.kind === 'red' ? (en ? 'RED' : '紅旗') : b.kind.toUpperCase() });
  });
  const pins = moments.filter(m => !m.band).map(m => el('span', { class: 'wp-moment', style: `left:${xs[m.i] * 100}%;top:${(1 - pts[m.i].c[m.k]) * 100}%;background:${colorOf(m.k)}` }));
  const at = el('small', { class: 'wp-at' });
  const why = el('div', { class: 'wp-why', hidden: true });
  const rule = el('span', { class: 'wp-rule', hidden: true });
  const lapText = p => (byLap ? (p.lap ? (en ? `Lap ${p.lap}` : `第 ${p.lap} 圈`) : en ? 'The start' : '起跑') : stampAt([], 'f1', p.t, en));
  const open = ss.status.state === 'in' ? bands.find(b => b.i1 >= last) : null;
  const tell = (m, label) => {
    why.hidden = !m;
    if (m) put(why, el('span', { class: 'wp-why-icon' }, [m.band && !m.driver ? momentGlyph(m.icon) : face(m)]), el('span', { class: 'wp-why-text' }, momentWords(m.text, label)), gainChip(m));
  };
  const show = (j, picked) => {
    // A moment picked from the list: that one; a finger close to a stop or a lead (the closest): on it.
    const near = picked || (j != null ? nearestMoment(moments.filter(m => !m.band), xs, j) : null);
    rows.forEach((r, k) => r.classList.toggle('on', listed[k] === picked));
    const i = near ? near.i : j;
    const p = pts[i ?? last];
    chips.forEach((c, k) => (c.lastChild.textContent = `${Math.round(p.c[k] * 100)}%`));
    // Who led then (of the drivers drawn), and the safety car if it was out.
    const k = i ?? last;
    const lead = [...events].reverse().find(ev => ev.kind === 'lead' && ev.i <= k);
    const under = bands.find(b => k > b.i0 && k <= b.i1);
    const leader = lead ? (typeof lead.k === 'number' ? names[lead.k] : driverShort(lead.k, en)) : '';
    const state = [leader ? (en ? `${leader} leads` : `${leader} 領先`) : '', under ? bandName(under.kind, en) : ''].filter(Boolean).map(x => ` · ${x}`).join('');
    at.textContent = i == null ? `${ss.status.state === 'post' ? (en ? 'Final' : '終場') : lapText(p)}${state}` : `${lapText(p)}${state}`;
    at.classList.toggle('on', i != null);
    // On a moment, or under the safety car: what it was.
    const bandOf = m => bands.find(b => m.i === Math.min(b.i1, b.i0 + 1));
    const inBand = i != null && !near ? moments.find(m => m.band && bands.some(b => b === bandOf(m) && i >= b.i0 && i <= b.i1)) : null;
    if (i == null) tell(open ? moments.find(m => m.band && bandOf(m) === open) : null, open ? (en ? 'Now' : '出動中') : '');
    else tell(near || inBand, '');
    rule.hidden = i == null;
    if (i != null) rule.style.left = `${xs[i] * 100}%`;
  };
  const plot = scrubPlot(xs, show, [el('div', { html: `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="wp-chart rc-chart" aria-hidden="true">${shade}${grid}${paths}</svg>` }), ...pins, rule]);
  const strip = tags.length ? el('div', { class: 'rc-band-tags', 'aria-hidden': 'true' }, tags) : null;
  const rows = listed.map(m => el('div', { class: 'wp-mo' }, [el('span', { class: 'wp-mo-face' }, [m.band && !m.driver ? momentGlyph(m.icon) : face(m)]), el('button', { type: 'button', class: 'wp-mo-go', onclick: () => (show(m.i, m), bringIn(plot)) }, [el('span', { class: 'wp-mo-body' }, [el('small', { class: 'wp-mo-at', text: m.laps && m.laps[1] > m.laps[0] ? (en ? `Laps ${m.laps[0]}–${m.laps[1]}` : `第 ${m.laps[0]}–${m.laps[1]} 圈`) : lapText(pts[m.i]) }), el('span', { class: 'wp-mo-text' }, oneLineWords(m.text))]), gainChip(m)])]));
  show();
  const list = listed.length
    ? el('div', { class: 'wp-moments' }, [el('p', { class: 'mini-h', text: en ? 'Key moments' : '關鍵時刻' }), ...rows])
    : null;
  return card(T('winProb'), el('div', { class: 'wp' }, [el('div', { class: 'rc-chips' }, chips), at, strip, plot, axisRow(marks), why, list]));
}

// ---- Race weekends ----------------------------------------------------------------------

// A driver in a race: their page, where ESPN has one; else just the name.
// A face that opens its person's page (a moment's player, a race's driver), else just the face.
// The live panel's batter, pitcher or top scorer: the whole of it a tap to their page.
function lpPerson(league, p, children) {
  const can = p?.id && LEAGUES[league]?.espn && /^\d+$/.test(String(p.id));
  return can ? el('button', { class: 'lp-person tap', type: 'button', 'aria-label': p.name || '', onclick: ev => (ev.stopPropagation(), ctx.openPlayer(league, String(p.id), { name: p.name, logo: p.headshot })) }, children) : el('div', { class: 'lp-person' }, children);
}
function personTap(league, p, pic) {
  const can = p?.id && LEAGUES[league]?.espn && /^\d+$/.test(String(p.id));
  return can ? el('button', { class: 'wp-who', type: 'button', 'aria-label': p.name || '', onclick: ev => (ev.stopPropagation(), ctx.openPlayer(league, p.id, p)) }, [pic]) : pic;
}
function personName(league, p, cls = 'field-name') {
  if (!p) return el('span', { class: cls });
  const can = p.id && LEAGUES[league]?.espn && /^\d+$/.test(String(p.id));
  return can ? el('button', { class: `link ${cls}`, type: 'button', onclick: () => ctx.openPlayer(league, p.id, p) }, [playerName(p.full || p.name, 'full', p.name)]) : el('span', { class: cls }, [playerName(p.full || p.name, 'full', p.name)]);
}
// A play in 過程 (and the live panel's latest): the player's face (a tap
// opens them), or the team's logo for a team's play; what happened in
// Chinese on one line (lib/moments.mjs's feedText; English: ESPN's words),
// and under it, small, the team and who helped (an assist, a steal), so no
// line wraps. `side`: the team ({ name, short, logo }) or its name.
function playLine(league, p, side) {
  const team = typeof side === 'string' ? side : side?.short || side?.name || '';
  // (An own goal: the team it counts for, not the defender who put it in.)
  const own = /own-goal/i.test(String(p.kind || p.type || ''));
  // A player's play: their face with their team's badge on it, so the small
  // line under it is the play's details alone (the team's name took its room).
  const badged = Boolean(p.pic && !own && side?.logo);
  const parts = playParts(feedText(LEAGUES[league]?.sport, p, L() === 'en', team), badged ? '' : team);
  // (A name never split over two lines: J. Embiid, C. Porter Jr. kept whole, the line broken between names and words.)
  const whole = t => String(t || '').replace(/\b([A-Z][a-z]{0,2}\.) (?=\p{Lu})/gu, '$1\u00a0').replace(/ (Jr\.|Sr\.|II|III|IV)\b/g, '\u00a0$1');
  const main = whole(parts.main);
  // Who helped, as faces (a tap to their page): their names taken out of the small line.
  const helpers = (p.helpers || []).filter(h => h.pic?.id);
  const sub = whole(helpers.length ? String(parts.sub || '').split(' · ').filter(x => !helpers.some(h => h.name && x.includes(h.name.split(' ').at(-1)))).join(' · ') : parts.sub);
  const face = p.pic && !own ? personTap(league, p.pic, el('span', { class: 'play-face' }, [personPic(p.pic, league, 'xs round'), badged ? logo(side.logo, team, 'play-badge', { onWhite: true }) : null])) : side?.logo ? logo(side.logo, team, 'xs play-team') : null;
  // A play with neither (本節結束, 比賽結束): the league's mark, so every row has its picture.
  return el('span', { class: `play-text${face ? ' has-face' : ''}` }, [face || el('span', { class: 'play-none', 'aria-hidden': 'true' }, [leagueMark(league)]), el('span', { class: 'play-words' }, [el('span', { class: 'play-main', text: main }), sub ? el('small', { class: 'play-sub', text: sub }) : null, helpers.length ? helpersLine(league, helpers) : null])]);
}

// Where to watch in Taiwan: a game's own channels (a schedule's: the
// channel, its commentary, when it starts, a tap to watch it in the app),
// else the league's service.
// A finished game on ELTA: where to watch it again (回看 on its channel for
// 48 hours, then its video, ELTA.tv's season page while it isn't up).
// A finished game on ELTA, at the top beside its highlights and drawn like
// them: its whole game to watch again (its video; within 48 hours with no
// video yet, its channel, the game tapped in the guide; the season's page
// while it isn't up), and a channel's 回看 when the video lacks the
// commentary the person likes. Gone when ELTA didn't show it. Drawn once:
// what was found is kept (a sheet drawn again shows it at once), and while
// it's looked for the row is already in its place and look, the same logo
// staying when it's filled in (no blink, no row popping in).
const replayKnown = new Map();
// ELTA's mark (its app's icon, as it is) from the stylesheet, not a picture
// element: decoded once when the app opens (one kept off screen) and every
// row's the same image already drawn, so it never blinks.
const eltaLogo = () => el('span', { class: 'replay-icon', 'aria-hidden': 'true' });
if (typeof document !== 'undefined' && document.body) document.body.append(el('span', { class: 'replay-icon replay-icon-keep', 'aria-hidden': 'true' }));
// Where a program is in its channel's guide: the channel, its day and the
// time it started ("愛爾達1台・10/6（二）19:30"), so it's found at once.
function guideText(b, en = L() === 'en') {
  if (en) return b.at ? `${b.short.en} · ${guideWhen(b.at, true)}` : `${b.short.en}: tap the game in its guide`;
  return b.at ? `${b.short.zh}・${guideWhen(b.at)}` : `${b.short.zh}・在節目表點這場`;
}
function replayRows(e, r, logo = eltaLogo()) {
  const en = L() === 'en';
  const row = (b, title, sub, go, cls, icon) => watchLink(b, { class: `replay-link${cls}` }, [icon, el('span', { class: 'yt-text' }, [el('strong', { text: title }), el('small', { class: 'one-line', text: sub })]), el('span', { class: 'replay-go', text: go })]);
  if (r.channels) {
    const b = r.channels[0];
    return [row(b, en ? 'Replay on the channel' : '頻道回看', guideText(b, en), en ? 'Channel' : '開頻道', '', logo)];
  }
  // Its video not found (not up yet, or not shown): said so, with nothing to tap.
  if (!r.episode)
    return [el('div', { class: 'replay-link none' }, [logo, el('span', { class: 'yt-text' }, [el('strong', { text: en ? 'Full game replay' : '全場重播' }), el('small', { class: 'one-line', text: en ? 'Not on ELTA.tv yet' : '愛爾達還沒上架這場' })])])];
  const sub = `${r.episode.label}${r.alsoChannels ? (en ? ' (Chinese)' : '（中文）') : ''}`;
  const alt = r.alsoChannels?.[0];
  return [
    row(r.video, en ? 'Full game replay' : '全場重播', sub, en ? 'Watch' : '觀看', '', logo),
    alt ? row(alt, alt.audio === 'en' ? (en ? 'Channel replay, original audio' : '頻道回看（原音）') : en ? 'Channel replay, bilingual' : '頻道回看（雙語）', guideText(alt, en), en ? 'Channel' : '開頻道', ' alt', eltaLogo()) : null
  ].filter(Boolean);
}
// Apple TV's row: the game's own page (`apple.game`), else the channel's.
const replayLinkRow = (apple, en) =>
  el('div', { class: 'replay-group' }, [
    watchLink(apple, { class: 'replay-link' }, [el('span', { class: 'replay-icon apple', 'aria-hidden': 'true', text: '\uF8FFtv' }), el('span', { class: 'yt-text' }, [el('strong', { text: en ? 'Full game replay' : '全場重播' }), el('small', { class: 'one-line', text: apple.game ? (en ? 'Apple TV · MLS Season Pass' : 'Apple TV・MLS Season Pass') : en ? "On Apple TV's MLS channel" : '在 Apple TV 的 MLS 頻道' })]), el('span', { class: 'replay-go', text: en ? 'Watch' : '觀看' })])
  ]);
function replayLink(e) {
  if (e?.status?.state !== 'post' || e.status.void) return null;
  // Apple TV (MLS): every game whole, at its own page once Shared-Data has it, else the channel's.
  const apple = tvOf(e).find(b => b.svc === 'appletv');
  if (apple) {
    const en = L() === 'en';
    // An older game's page is in its month's file: read, then the row points at the game.
    if (!apple.game && watchMonthWanted(e)) {
      const wait = replayLinkRow(apple, en);
      loadWatchMonth(e, packJson).then(() => wait.isConnected && tvOf(e).find(b => b.svc === 'appletv')?.game && wait.replaceWith(replayLink(e)));
      return wait;
    }
    return replayLinkRow(apple, en);
  }
  if (broadcastsOf(e.league)[0]?.svc !== 'elta') return null;
  // Only where there'll likely be one (a season of videos, or its channel in
  // ELTA's list): a row that comes and goes would move the sheet.
  if (!ELTA_VOD_LEAGUES.has(e.league) && !tvOf(e).some(b => b.exact)) return null;
  const key = `${e.league}:${e.id}:${e.sessionKey || ''}`;
  // Known this session: a video found, for good; none found (or only the
  // channels' 回看), for ten minutes, then looked for again (ELTA puts a
  // game's video up hours later, and an installed app stays open for days:
  // a game opened before it was up said "none" until the app was closed).
  const known = replayKnown.get(key);
  if (known && (known.r?.episode || Date.now() - known.at < 10 * 60_000)) {
    const r = known.r;
    return r ? el('div', { class: 'replay-group' }, replayRows(e, r)) : null;
  }
  const en = L() === 'en';
  const logo = eltaLogo();
  const out = el('div', { class: 'replay-group' }, [
    el('div', { class: 'replay-link wait' }, [logo, el('span', { class: 'yt-text' }, [el('strong', { text: en ? 'Full game replay' : '全場重播' }), el('small', { class: 'one-line', text: en ? 'Finding it on ELTA.tv…' : '在愛爾達找這場…' })]), el('span', { class: 'replay-go', style: 'visibility:hidden', 'aria-hidden': 'true', text: en ? 'Watch' : '觀看' })])
  ]);
  replayOf(e)
    .then(r => {
      replayKnown.set(key, { r, at: Date.now() });
      if (!r) return out.remove();
      put(out, ...replayRows(e, r, logo));
    })
    .catch(() => out.remove());
  return out;
}
// A 球員視角's line: who it follows, or plainly that ELTA hasn't said.
const camLine = (e, b) => {
  const who = e && camKnownOf(e, b);
  return L() === 'en' ? (who ? `Player cam: ${who}` : 'Player cam · player not named by ELTA') : who ? `球員視角：${who}` : '球員視角・愛爾達未公布跟拍球員';
};
// A broadcast's lines on 台灣轉播, each short enough for its row.
function twLines(b, e) {
  const en = L() === 'en';
  const when = at => {
    const iso = new Date(at).toISOString();
    return localDate(at) === today() ? clock(iso) : `${dayLabel(localDate(at))} ${clock(iso)}`;
  };
  const guess = e?.timeFrom === 'elta';
  const air = at => (guess ? (en ? `Expected ${when(at)}` : `預計 ${when(at)}`) : `${when(at)} ${en ? 'on air' : '開播'}`);
  if (b.ch) return [b.audio === 'cam' ? camLine(e, b) : [audioName(b), b.adFree ? (en ? 'no ads' : '無廣告') : ''].filter(Boolean).join(en ? ', ' : '・'), b.at ? air(b.at) : ''].filter(Boolean);
  if (b.svc === 'appletv') return [en ? 'Every game' : '每場都有'];
  if (b.every) return [en ? 'Every session' : '每節都轉播'];
  // A play-off game ELTA hasn't named yet (MLB's postseason: it has every game).
  if (b.tba) return [en ? 'Every postseason game' : '季後賽每場都轉播', guess ? air(Date.parse(e.start)) : ''].filter(Boolean);
  return [en ? 'On ELTA, says NBA.com' : 'NBA.com 確認有轉播'];
}
// (Nothing drawn: finds the line above it once the name comes.)
function camLater(e, b) {
  const mark = el('i', { hidden: true });
  camPlayerOf(e, b).then(who => {
    const line = who && mark.isConnected && mark.previousElementSibling?.querySelector('small.one-line');
    if (line) line.textContent = camLine(e, b);
  });
  return mark;
}
function twCard(league, e = null) {
  const list = e ? tvOf(e) : broadcastsOf(league);
  const exact = list.filter(b => b.exact);
  const rest = list.filter(b => !exact.includes(b));
  return card(
    T('watchTw'),
    list.length
      ? el('div', { class: 'stack tight' }, [
          exact.length
            ? el(
                'div',
                { class: 'tw-exact' },
                exact.map(b =>
                  watchLink(b, { class: 'tw-watch' }, [
                    // The service's own mark (ELTA's, Apple TV's), else a TV's.
                    b.svc === 'elta' ? eltaLogo() : b.svc === 'appletv' ? el('span', { class: 'replay-icon apple', 'aria-hidden': 'true', text: '\uF8FFtv' }) : kitUI.tile(kitUI.icons.tv, 'var(--accent)'),
                    el('span', { class: 'tw-watch-name' }, [
                      el('strong', { text: tvName(b) }),
                      // Short lines, each designed for its own row (one long one wrapped):
                      // its commentary and ads, then when it's on air (its day too when
                      // it isn't today; 預計 when the game's hour isn't set and this is
                      // ELTA's slot); a channel not yet named, who says it's on.
                      ...twLines(b, e).map(text => el('small', { class: 'one-line', text }))
                    ]),
                    // (Who a 球員視角 follows, looked up on ELTA.tv: its line said again once found.)
                    b.audio === 'cam' && e && !camKnownOf(e, b) ? camLater(e, b) : null,
                    b.url ? el('span', { class: 'tw-watch-go' }, [el('span', { class: 'watch-play', 'aria-hidden': 'true' }), document.createTextNode(L() === 'en' ? 'Watch' : '觀看')]) : null
                  ])
                )
              )
            : null,
          rest.length ? el('div', { class: 'tw-list' }, rest.map(b => el('span', { class: 'tw-chip', text: tvName(b) }))) : null
        ])
      : el('p', { class: 'muted small', text: T('noTw') }),
    { sub: twSource(exact, L() === 'en') }
  );
}

// A race weekend's sessions as one timeline, by day (the owner, 2026-10-27:
// the session pills and a list of the same sessions under them read as old):
// each session a stop on one line (done, on, next, to come; 正賽 its
// chequered mark), its short name and hour under it, the days over them. A
// tap picks the session whose order shows below.
const SESSION_KIND = { Race: 'race', Qual: 'qual', SR: 'sprint', SS: 'sq', SQ: 'sq' };
// The session on, else the next to come (one rule for the hero and the line).
const nextSession = (sessions, now = Date.now()) => sessions.find(x => x.status.state === 'in') || sessions.find(x => x.status.state === 'pre' && Date.parse(x.start) > now);
function sessionLine(sessions, pick, onPick) {
  const en = L() === 'en';
  const next = nextSession(sessions);
  const days = [];
  for (const x of sessions) {
    const d = localDate(Date.parse(x.start));
    if (days.at(-1)?.d === d) days.at(-1).n++;
    else days.push({ d, n: 1 });
  }
  const word = x => (x.status.state === 'in' ? T('live') : x.status.state === 'post' ? T('final') : x === next ? (en ? 'Next' : '下一節') : '');
  const stops = sessions.map((x, i) => {
    const kind = SESSION_KIND[x.abbr] || 'other';
    const state = x.status.state === 'in' ? 'live' : x.status.state === 'post' ? 'done' : x === next ? 'next' : 'later';
    // The line to it filled once the one before is over; on from it once this one is.
    const from = i > 0 && sessions[i - 1].status.state === 'post';
    return el(
      'button',
      {
        class: `wkt-stop ${kind} ${state}${from ? ' from' : ''}${x.status.state === 'post' ? ' to' : ''}`,
        type: 'button',
        'aria-pressed': String(i === pick),
        'aria-label': [sessionName(x, L()), dayLabel(localDate(Date.parse(x.start))), timeText(x), word(x)].filter(Boolean).join(' '),
        onclick: () => onPick(i)
      },
      [el('span', { class: 'wkt-dot', 'aria-hidden': 'true' }), el('span', { class: 'wkt-name', text: sessionName(x, L(), true) }), el('span', { class: 'wkt-time num', text: timeText(x) })]
    );
  });
  return el('div', { class: 'q-card wkt', style: `--n:${sessions.length}` }, [
    ...days.map(({ d, n }) => el('span', { class: 'wkt-day num', style: `grid-column:span ${n}`, text: dayLabel(d) })),
    ...stops
  ]);
}
// How long until a time, in the largest two parts: 3 天 14 小時, 5 小時 12 分, 12 分.
function untilText(ms, en) {
  const m = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (m < 1) return en ? 'Starting' : '即將開始';
  if (d) return en ? `${d}d ${h}h` : `${d} 天 ${h} 小時`;
  if (h) return en ? `${h}h ${mm}m` : `${h} 小時 ${mm} 分`;
  return en ? `${mm} min` : `${mm} 分`;
}
// A race weekend's hero: its flag, name, circuit and days; then what's next:
// the session on, the countdown to the next, or (all over) the race's winner;
// following it, and watching what's on.
function weekendHero(e, sessions) {
  const en = L() === 'en';
  const first = localDate(Date.parse(sessions[0]?.start || e.start));
  const last = localDate(Date.parse(sessions.at(-1)?.start || e.start));
  const md = d => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  const span = first === last ? dayLabel(first) : `${md(first)} – ${md(last)}`;
  const now = nextSession(sessions);
  const race = sessions.find(x => x.abbr === 'Race') || sessions.at(-1);
  const winner = !now && race?.status.state === 'post' ? race.field?.[0] : null;
  let panel = null;
  if (now?.status.state === 'in') {
    panel = el('div', { class: 'wkh-now live' }, [el('span', { class: 'wkh-k' }, [el('i', { class: 'wkh-live', 'aria-hidden': 'true' }), document.createTextNode(T('live'))]), el('strong', { class: 'wkh-big', text: sessionName(now, L()) })]);
  } else if (now) {
    const count = el('strong', { class: 'wkh-big num' });
    const tick = () => (count.textContent = untilText(Date.parse(now.start) - Date.now(), en));
    tick();
    const timer = setInterval(() => (count.isConnected ? tick() : clearInterval(timer)), 20_000);
    panel = el('div', { class: `wkh-now${now.abbr === 'Race' ? ' race' : ''}` }, [
      el('span', { class: 'wkh-k', text: `${en ? 'Next' : '下一節'} · ${sessionName(now, L())}` }),
      count,
      el('small', { class: 'wkh-at num', text: `${dayLabel(localDate(Date.parse(now.start)))} ${timeText(now)}` })
    ]);
  } else if (winner) {
    panel = el('div', { class: 'wkh-now done' }, [
      personPic(winner, e.league, 'round wkh-pic'),
      el('span', { class: 'wkh-win' }, [el('span', { class: 'wkh-k', text: en ? 'Race winner' : '正賽冠軍' }), el('strong', { class: 'wkh-big', text: winner.short || winner.name })])
    ]);
  }
  return el('div', { class: 'q-hero-card wk-hero' }, [
    el('div', { class: 'wkh-top' }, [
      raceFlag(e, 'big wkh-flag'),
      el('div', { class: 'wkh-text' }, [el('small', { class: 'wkh-over num', text: span }), el('h3', { class: `wkh-name${e.name.length > 16 ? ' long' : ''}`, text: e.name }), e.venue ? el('small', { class: 'wkh-where', text: e.venue }) : null])
    ]),
    panel,
    weekendFollow(e),
    watchButton(e, 'wide')
  ]);
}

// A part of a weekend's sheet read on its own: its card's shape meanwhile,
// the card faded in when it comes, nothing left where there's nothing.
function lateCard(title, height, load) {
  const box = card(title, el('i', { class: 'skel wk-skel', style: `height:${height}px` }));
  load()
    .then(node => (node ? (node.classList.add('fade-in'), box.replaceWith(node)) : box.remove()))
    .catch(() => box.remove());
  return box;
}
const pts = r => Number(r?.stats?.PTS) || 0;
// The championship going into the weekend: what the leader needs (the
// table's race line), the top three drivers on bars of their points (a tap
// to their page), and the teams' lead in a line.
function titleFightCard(e) {
  const en = L() === 'en';
  const title = en ? 'Title fight' : '冠軍之爭';
  if (!ctx.titleFight) return null;
  return lateCard(title, 168, async () => {
    const all = await ctx.titleFight(e.league);
    const d = all?.find(x => x.g.rows.some(r => r.athlete));
    if (!d || pts(d.g.rows[0]) <= 0) return null;
    const top = d.g.rows.slice(0, 3);
    const lead = pts(top[0]);
    const teams = all.find(x => x !== d)?.g.rows;
    const tn = r => (en ? r.en || r.name : f1Constructor(r.en || r.name)?.zh || r.short || r.name);
    const teamLine = teams?.length > 1 && pts(teams[0]) > 0 ? el('p', { class: 'fight-teams' }, [constructorBadge(teams[0].en || teams[0].name, 'xs'), el('span', { text: en ? `${tn(teams[0])} lead the teams by ${pts(teams[0]) - pts(teams[1])}` : `車隊：${tn(teams[0])}領先 ${pts(teams[0]) - pts(teams[1])} 分` })]) : null;
    return card(
      title,
      el('div', { class: 'stack tight' }, [
        raceBlock(d.race, d.g, e.league, false),
        el(
          'div',
          { class: 'fight-rows' },
          top.map((r, i) =>
            el('button', { class: 'fight-row', type: 'button', style: r.color ? `--c:${r.color}` : null, onclick: () => r.id && ctx.openPlayer(e.league, r.id, r) }, [
              el('span', { class: 'fight-pos num', text: String(i + 1) }),
              personPic(r, e.league, 'sm round'),
              el('span', { class: 'fight-main' }, [el('span', { class: 'fight-name', text: r.short || r.name }), el('span', { class: 'fight-bar' }, [el('i', { style: `width:${Math.max(4, Math.round((pts(r) / lead) * 100))}%` })])]),
              el('span', { class: 'fight-pts' }, [el('strong', { class: 'num', text: String(pts(r)) }), el('small', { class: 'num', text: i ? `−${lead - pts(r)}` : en ? 'pts' : '分' })])
            ])
          )
        ),
        teamLine
      ])
    );
  });
}
// A weather code (WMO's) as the kit's icon.
const skyIcon = code => (code >= 51 ? 'rain' : code >= 2 ? 'cloud' : 'sun');
// The circuit: its outline, figures (length, laps, distance, first race, the
// lap record and who holds it) and, while the weekend's to come or on, the
// weather there each of its days.
function circuitCard(e, sessions) {
  const en = L() === 'en';
  const title = en ? 'The circuit' : '賽道';
  const race = sessions.find(x => x.abbr === 'Race') || sessions.at(-1);
  const ahead = sessions.some(x => x.status.state !== 'post');
  return lateCard(title, 200, async () => {
    const [facts, c, wx] = await Promise.all([circuitFacts(race.start).catch(() => null), weekendCircuit(race.start).catch(() => null), ahead ? circuitWeather(race.start, sessions.map(x => x.start)).catch(() => []) : []]);
    if (!facts && !c && !wx.length) return null;
    const km = v => String(v || '').replace(/km$/, ' km');
    const tiles = facts
      ? [
          [en ? 'Length' : '單圈長度', km(facts['Circuit Length']?.v)],
          [en ? 'Laps' : '圈數', facts['Number of Laps']?.v],
          [en ? 'Distance' : '比賽距離', km(facts['Race Distance']?.v)],
          [en ? 'First race' : '首次舉辦', facts['First Grand Prix']?.v]
        ].filter(([, v]) => v)
      : [];
    // Figures MultiViewer's map has (the corners, a stop's cost), beside formula1.com's.
    if (c?.corners?.length) tiles.push([en ? 'Corners' : '彎道', String(c.corners.length)]);
    if (c?.pitLoss?.normal) tiles.push([en ? 'Pit stop' : '進站損失', en ? `${c.pitLoss.normal.toFixed(1)} s` : `${c.pitLoss.normal.toFixed(1)} 秒`]);
    const map = c ? circuitDrawing(c, title, en) : null;
    const rec = facts?.['Fastest lap time'];
    const day = date => new Date(`${date}T12:00:00`).toLocaleDateString(en ? 'en-US' : 'zh-TW', { weekday: 'short' });
    return card(
      title,
      el('div', { class: 'stack tight' }, [
        map,
        tiles.length ? el('div', { class: 'cc-facts' }, tiles.map(([k, v]) => el('span', { class: 'cc-fact' }, [el('small', { text: k }), el('strong', { class: 'num', text: v })]))) : null,
        // The lap record, who and when on the line under it.
        rec?.v ? el('div', { class: 'cc-record' }, [el('small', { text: en ? 'Lap record' : '單圈紀錄' }), el('span', { class: 'cc-v' }, [el('strong', { class: 'num', text: rec.v }), rec.sub ? el('small', { text: rec.sub }) : null])]) : null,
        wx.length
          ? el('div', { class: 'cc-wx', style: `--n:${wx.length}` }, wx.map(w => el('span', { class: 'cc-day' }, [el('small', { text: day(w.date) }), el('span', { class: `cc-sky ${skyIcon(w.code)}`, html: kitUI.icons[skyIcon(w.code)] || '' }), el('strong', { class: 'num', text: `${w.hi}°` }), el('small', { class: 'num', text: `${w.lo}°${w.rain != null ? ` · ${w.rain}%` : ''}` })])))
          : null
      ])
    );
  });
}
// The circuit drawn the width of the card: the track, the start/finish line
// (a chequered bar across it), an arrow the way the cars go, and each corner's
// number beside it (MultiViewer's: the corner's point and the side its label
// goes, as F1's own TV graphics put them).
function circuitDrawing(c, title, en) {
  const W = 320;
  const { fit, H } = trackFit(c, W, 160, 280, 24);
  const P = c.x.map((x, i) => fit(x, c.y[i]));
  const f = n => n.toFixed(1);
  const d = P.map(p => `${f(p[0])},${f(p[1])}`).join(' ');
  // The way along the track at a point (a few points on, so one short step doesn't turn it).
  const along = i => {
    const a = P[i], b = P[Math.min(P.length - 1, i + 3)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  };
  const [s0, s1] = P[0];
  const [tx, ty] = along(0);
  const [nx, ny] = [-ty, tx];
  const bar = 9;
  // The start line: across the track, in two halves (white and black: chequered).
  const line = `<line class="cc-sf" x1="${f(s0 - nx * bar)}" y1="${f(s1 - ny * bar)}" x2="${f(s0 + nx * bar)}" y2="${f(s1 + ny * bar)}"/><line class="cc-sf-c" x1="${f(s0 - nx * bar)}" y1="${f(s1 - ny * bar)}" x2="${f(s0 + nx * bar)}" y2="${f(s1 + ny * bar)}"/>`;
  // The arrow a twentieth of the lap on, beside the track (on the side away from the corner labels' usual one).
  const k = Math.max(4, Math.round(P.length / 20));
  const [ax, ay] = P[k];
  const [ux, uy] = along(k);
  const [vx, vy] = [-uy, ux];
  const o = 13;
  const [cx, cy] = [ax + vx * o, ay + vy * o];
  const arrow = `<path class="cc-dir" d="M${f(cx - ux * 7 - vx * 4.5)},${f(cy - uy * 7 - vy * 4.5)} L${f(cx + ux * 5)},${f(cy + uy * 5)} L${f(cx - ux * 7 + vx * 4.5)},${f(cy - uy * 7 + vy * 4.5)}"/>`;
  // Each corner's number, its label set off the track the way MultiViewer says.
  const R = Math.hypot(Math.max(...c.x) - Math.min(...c.x), Math.max(...c.y) - Math.min(...c.y)) * 0.045;
  const labels = (c.corners || [])
    .map(t => {
      const a = (Number(t.angle) || 0) * (Math.PI / 180);
      const [lx, ly] = fit(t.x + Math.cos(a) * R, t.y + Math.sin(a) * R);
      return `<g class="cc-turn"><circle cx="${f(lx)}" cy="${f(ly)}" r="6.8"/><text x="${f(lx)}" y="${f(ly)}">${Number(t.n)}</text></g>`;
    })
    .join('');
  return el('div', { class: 'cc-map' }, [
    el('div', {
      html: `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.name || title)}"><polyline class="cc-edge" points="${d}"/><polyline class="cc-line" points="${d}"/>${line}${arrow}${labels}</svg>`
    }),
    el('div', { class: 'cc-key' }, [
      el('span', {}, [el('i', { class: 'cc-key-sf' }), el('small', { text: en ? 'Start / finish' : '起終點' })]),
      el('span', {}, [el('i', { class: 'cc-key-dir', html: '<svg viewBox="0 0 12 12"><path d="M3 2 L9 6 L3 10"/></svg>' }), el('small', { text: en ? 'Direction' : '行駛方向' })]),
      c.corners?.length ? el('span', {}, [el('i', { class: 'cc-key-turn', text: '1' }), el('small', { text: en ? 'Corner' : '彎道編號' })]) : null
    ])
  ]);
}
// Last year's podium here: second, first and third side by side, the winner raised.
function podiumCard(e, sessions) {
  const en = L() === 'en';
  const race = sessions.find(x => x.abbr === 'Race') || sessions.at(-1);
  if (race.status.state === 'post') return null;
  return lateCard(en ? 'Last year here' : '去年這一站', 150, async () => {
    const [{ year, rows }, grid] = await Promise.all([lastPodium(race.start), seasonDrivers().catch(() => [])]);
    if (rows.length < 3) return null;
    // Each one as this season's standings know him (ESPN's name, id and
    // headshot): Jolpica's "Andrea Kimi Antonelli" isn't ESPN's "Kimi
    // Antonelli", so his search found only TheSportsDB's zoomed-out cutout.
    // A driver in the standings opens; one gone from F1 doesn't.
    const step = r => {
      const full = `${r.driver.givenName} ${r.driver.familyName}`;
      const found = fieldDriver(grid, full, r.driver.familyName);
      // (The standings' picture is a driver's flag: his face comes by his id.)
      const who = found && { id: found.id, name: found.name, headshot: isFlag(found.headshot) ? null : found.headshot };
      const body = [
        personPic(who || { name: full, en: full }, 'f1', 'round pd-pic'),
        el('strong', { class: 'pd-name', text: r.driver.familyName || '' }),
        el('span', { class: 'pd-team' }, [constructorBadge(r.team, 'xxs'), el('small', { text: en ? r.team : f1Constructor(r.team)?.zh || r.team })]),
        el('span', { class: 'pd-block num', text: String(r.pos) })
      ];
      return who?.id
        ? el('button', { class: `pd-step p${r.pos}`, type: 'button', 'aria-label': `${r.pos}. ${who.name}`, onclick: () => ctx.openPlayer('f1', who.id, who) }, body)
        : el('span', { class: `pd-step p${r.pos}` }, body);
    };
    return card(en ? `Here in ${year}` : `${year} 年這一站`, el('div', { class: 'pd' }, [2, 1, 3].map(p => step(rows.find(r => r.pos === p))).filter(Boolean)));
  });
}

export function openFieldEvent(e) {
  const s = sheet(leagueName(e.league, L()), { league: e.league });
  fillField(s, e);
  // A session on, or due to start (open before it, the sheet turns live
  // the moment it does): read again every 15 seconds. F1's own feed is asked
  // too, which says a session has started minutes before ESPN does.
  const states = x => [x.status.state, ...(x.sessions || []).map(y => feedStatus(y.abbr, y.start, y.status).state)].join();
  let busy = false;
  const timer = everyDev('sportsGame', async () => {
    if (!s.dialog.isConnected) return timer();
    const now = Date.now();
    const due = [e, ...(e.sessions || [])].filter(x => dueToStart(x, now));
    if (busy || document.visibilityState !== 'visible' || (e.status.state !== 'in' && !due.length && !(e.sessions || []).some(x => x.status.state === 'in'))) return;
    busy = true;
    try {
      const before = states(e);
      if (e.league === 'f1') await Promise.all(due.filter(x => x.abbr || x.sessionKey).map(x => liveTiming(x.abbr || x.sessionKey, x.official || x.start).catch(() => null)));
      const fresh = (await scoreboard(e.league).catch(() => [])).find(x => x.id === (e.weekend || e.id));
      const again = !fresh ? null : e.sessionKey ? splitWeekend(fresh, Date.now(), L()).find(x => x.sessionKey === e.sessionKey) : fresh.sessions ? settleField(fresh, Date.now()) : fresh;
      // Drawn again only when a session starts or ends: the live board keeps itself current.
      if (again ? states(again) === before : states(e) === before) return;
      if (again) e = again;
    } finally {
      busy = false;
    }
    const top = s.body.scrollTop;
    s.body.replaceChildren();
    fillField(s, e);
    s.body.scrollTop = top;
  });
  s.dialog.addEventListener('close', () => timer());
}
// An F1 result, row by row: the place (or the retirement), the driver (to
// their page) and team (to its page), the time or gap, the places gained and
// the points.
// One car in an F1 list, the same in a result and live: the place, the
// driver's picture and name (to their page), the team's badge and name (to
// its page), then the number that matters (a time, a gap) over its tags.
// `field`: the session's cars from ESPN (their ids, so the pictures match
// the rest of the app's).
// A driver of the session's cars by their name (full, else the family name).
// A season's numbers' title in Chinese, a league ESPN names in English too ("2025-26 Cypriot First Division 數據").
const seasonTitle = title => {
  const t = statsTitle(title, L()) || T('season');
  return L() !== 'en' && /[A-Za-z]{3}/.test(t) ? zhLater(t, 'en') : t;
};
// The season's drivers (the standings' rows: id, name), once a session: a driver not in a weekend's field yet.
let seasonDriverList = null;
const seasonDrivers = () =>
  (seasonDriverList ||= standings('f1')
    .then(groups => (groups || []).flatMap(g => g.rows || []).filter(r => r.athlete && r.id).map(r => ({ id: r.id, name: r.en || r.name, headshot: r.logo || null })))
    .catch(() => ((seasonDriverList = null), [])));
const fieldDriver = (field = [], full, family = String(full || '').split(' ').slice(1).join(' ') || full) => field.find(x => fold(x.name) === fold(full)) || field.find(x => fold(x.name).endsWith(fold(family))) || null;
// A driver's name whole where it fits, the surname where it doesn't (the
// owner, 2026-10-11): each name drawn whole, measured once laid out (a
// ResizeObserver: before the screen is painted, so it never flickers), and
// the surname put in if the whole one runs past its box; again whenever
// the box changes size (a turned phone).
// Wider than its box, measured exactly (scrollWidth rounds: "George Russell"
// 0.7px over its 105 read as fitting, and was cut to "George Russ…").
const overflows = n => {
  if (n.scrollWidth > n.clientWidth) return true;
  const r = document.createRange();
  r.selectNodeContents(n);
  return r.getBoundingClientRect().width > n.getBoundingClientRect().width + 0.1;
};
const fitWatch = typeof ResizeObserver === 'function'
  ? new ResizeObserver(list => {
      for (const { target: n } of list) {
        // (A name built off the page, 數據 behind 成績, is fitted once it's on it: it was let go, and cut.)
        if (!n.isConnected) {
          if (n.dataset.fitted) fitWatch.unobserve(n);
          continue;
        }
        n.dataset.fitted = '1';
        n.textContent = n.dataset.full;
        if (overflows(n)) n.textContent = n.dataset.short;
      }
    })
  : null;
// A name wider than its place among the five (a narrow phone): that name a
// half point smaller at a time, down to 7.5px.
const fiveWatch = typeof ResizeObserver === 'function'
  ? new ResizeObserver(list => {
      for (const { target: row } of list) {
        if (!row.isConnected) {
          fiveWatch.unobserve(row);
          continue;
        }
        const names = [...row.querySelectorAll('.pm-name')];
        for (const n of names) n.style.fontSize = '';
        const over = n => n.scrollWidth > n.parentElement.clientWidth + 0.5;
        for (let i = 0; i < 40 && names.some(over); i++) {
          const n = names.find(over);
          const size = parseFloat(getComputedStyle(n).fontSize) - 0.5;
          if (size < 7.5) break;
          n.style.fontSize = `${size}px`;
        }
      }
    })
  : null;
// A line of words that mustn't wrap: a half point smaller at a time until it
// fits its box, down to 10px (fitted again when the box changes size).
const lineWatch = typeof ResizeObserver === 'function'
  ? new ResizeObserver(list => {
      for (const { target: n } of list) {
        if (!n.isConnected) {
          lineWatch.unobserve(n);
          continue;
        }
        n.style.fontSize = '';
        for (let i = 0; i < 30 && overflows(n); i++) {
          const size = parseFloat(getComputedStyle(n).fontSize) - 0.5;
          if (size < 10) break;
          n.style.fontSize = `${size}px`;
        }
      }
    })
  : null;
// Words said several ways, fullest first: the first that fits its box on
// one line, else the last made smaller (lineWatch).
const choiceWatch = typeof ResizeObserver === 'function'
  ? new ResizeObserver(list => {
      for (const { target: n } of list) {
        // (Built off the page: fitted once it's on it; let go once it's left it.)
        // (A box doesn't change size as it's put on the page: looked at again a frame on, a few times.)
        if (!n.isConnected) {
          choiceWatch.unobserve(n);
          if (!n.dataset.fitted && (n.__tries = (n.__tries || 0) + 1) < 20) requestAnimationFrame(() => choiceWatch.observe(n));
          continue;
        }
        n.dataset.fitted = '1';
        const ways = n.__ways || [];
        n.style.fontSize = '';
        for (const w of ways) {
          if (w?.html != null) n.innerHTML = w.html;
          else n.textContent = w;
          if (!overflows(n)) break;
        }
        for (let i = 0; i < 30 && overflows(n); i++) {
          const size = parseFloat(getComputedStyle(n).fontSize) - 0.5;
          if (size < 10) break;
          n.style.fontSize = `${size}px`;
        }
      }
    })
  : null;
function fitChoice(n, ways) {
  n.__ways = ways;
  // (A way may be { html }: words with their <b>, escaped where they're made.)
  if (ways[0]?.html != null) n.innerHTML = ways[0].html;
  else n.textContent = ways[0];
  n.classList.add('one-line');
  choiceWatch?.observe(n);
  return n;
}
// A game over on a light day's 首頁 (Jay 2026-10-23): who decided it for
// each side, by what decides the sport (never a stat that misleads, Jay:
// not shots for a forward who didn't score in a 3-1). The ways to see it
// again (回看, 精華) stay on its page (2026-10-25), not on the card.
const boxNum = v => parseFloat(String(v ?? '').replace(/[^\d.-]/g, '')) || 0;
function sideStar(d, e, team) {
  const en = L() === 'en';
  const sport = LEAGUES[e.league]?.sport;
  const tables = (d?.players || []).find(p => p.team === team)?.tables || [];
  const col = (t, ...labels) => t.labels.findIndex(x => labels.includes(x));
  const rowsWith = (...labels) => tables.filter(t => col(t, ...labels) >= 0).flatMap(t => t.rows.map(r => ({ r, t })));
  const val = ({ r, t }, ...labels) => boxNum(r.stats[col(t, ...labels)]);
  const join = parts => parts.filter(Boolean).join(' · ');
  if (sport === 'soccer') {
    // The goals (an own goal is the other side's), with their minutes; then
    // the assists; then a keeper who kept them in it.
    const goals = new Map();
    for (const k of d?.keyEvents || []) if (k.scoring && k.team === team && k.pic?.id && !/own/i.test(`${k.kind} ${k.type} ${k.text}`)) goals.set(k.pic.id, [...(goals.get(k.pic.id) || []), k.clock]);
    const all = rowsWith('G', 'A');
    const row = id => all.find(x => x.r.id === id);
    const [id, mins] = [...goals].sort((x, y) => y[1].length - x[1].length)[0] || [];
    if (id) {
      const x = row(id);
      const ast = x ? val(x, 'A') : 0;
      const ke = d.keyEvents.find(k => k.pic?.id === id);
      return { p: x?.r || { id, name: ke.who, full: ke.pic.name, headshot: ke.pic.headshot }, line: join([`${en ? 'Goal' : '進球'} ${mins.join(en ? ', ' : '、')}`, ast ? (en ? `${ast} assist${ast > 1 ? 's' : ''}` : `${ast} 助攻`) : '']) };
    }
    const a = all.filter(x => val(x, 'A') > 0).sort((x, y) => val(y, 'A') - val(x, 'A'))[0];
    if (a) return { p: a.r, line: en ? `${val(a, 'A')} assist${val(a, 'A') > 1 ? 's' : ''}` : `${val(a, 'A')} 助攻` };
    const k = rowsWith('SV').filter(x => val(x, 'SV') >= 3).sort((x, y) => val(y, 'SV') - val(x, 'SV'))[0];
    return k ? { p: k.r, line: en ? `${val(k, 'SV')} saves` : `${val(k, 'SV')} 次撲救` } : null;
  }
  if (sport === 'basketball') {
    const x = rowsWith('PTS').sort((p, q) => val(q, 'PTS') - val(p, 'PTS'))[0];
    if (!x || !val(x, 'PTS')) return null;
    return { p: x.r, line: en ? join([`${val(x, 'PTS')} PTS`, `${val(x, 'REB')} REB`, `${val(x, 'AST')} AST`]) : join([`${val(x, 'PTS')} 分`, `${val(x, 'REB')} 籃板`, `${val(x, 'AST')} 助攻`]), tight: en ? null : join([`${val(x, 'PTS')} 分`, `${val(x, 'REB')} 板`, `${val(x, 'AST')} 助`]) };
  }
  if (sport === 'baseball') {
    // A starter who shut them down, else the bat that drove the runs in,
    // else whoever pitched longest.
    const outs = x => { const ip = String(x.r.stats[col(x.t, 'IP')] || '0').split('.'); return Number(ip[0]) * 3 + Number(ip[1] || 0); };
    const arms = rowsWith('IP').filter(x => x.t.name === 'pitching' || col(x.t, 'ERA') >= 0).sort((p, q) => outs(q) - outs(p));
    const arm = arms[0];
    const armLine = x => (en ? join([`${x.r.stats[col(x.t, 'IP')]} IP`, `${val(x, 'K')} K`, `${val(x, 'ER')} ER`]) : join([`${x.r.stats[col(x.t, 'IP')]} 局`, `${val(x, 'K')} 次三振`, `失 ${val(x, 'ER')} 分`]));
    const armTight = x => (en ? null : join([`${x.r.stats[col(x.t, 'IP')]} 局`, `${val(x, 'K')}K`, `失 ${val(x, 'ER')}`]));
    if (arm && outs(arm) >= 18 && val(arm, 'ER') <= 1) return { p: arm.r, line: armLine(arm), tight: armTight(arm) };
    const bats = rowsWith('RBI', 'HR').filter(x => x.t.name !== 'pitching' && col(x.t, 'IP') < 0);
    const weight = x => val(x, 'HR') * 3 + val(x, 'RBI') * 2 + val(x, 'H') + val(x, 'R');
    const bat = bats.filter(x => val(x, 'RBI') > 0 || val(x, 'HR') > 0).sort((p, q) => weight(q) - weight(p))[0];
    if (bat) {
      const h = val(bat, 'H');
      const hr = val(bat, 'HR');
      const rbi = val(bat, 'RBI');
      return { p: bat.r, line: en ? join([`${bat.r.stats[col(bat.t, 'H-AB')] || h + ' H'}`, hr ? `${hr > 1 ? hr + ' ' : ''}HR` : '', rbi ? `${rbi} RBI` : '']) : join([h ? `${h} 安` : '', hr ? `${hr} 轟` : '', rbi ? `${rbi} 分打點` : '']), tight: en ? null : join([h ? `${h} 安` : '', hr ? `${hr} 轟` : '', rbi ? `${rbi} 打點` : '']) };
    }
    return arm ? { p: arm.r, line: armLine(arm), tight: armTight(arm) } : null;
  }
  if (sport === 'hockey') {
    const pts = x => val(x, 'G') * 2 + val(x, 'A');
    const x = rowsWith('G').filter(x => val(x, 'G') + val(x, 'A') > 0).sort((p, q) => pts(q) - pts(p))[0];
    if (x) return { p: x.r, line: en ? join([val(x, 'G') ? `${val(x, 'G')} G` : '', val(x, 'A') ? `${val(x, 'A')} A` : '']) : join([val(x, 'G') ? `${val(x, 'G')} 進球` : '', val(x, 'A') ? `${val(x, 'A')} 助攻` : '']) };
    const g = rowsWith('SV').sort((p, q) => val(q, 'SV') - val(p, 'SV'))[0];
    return g && val(g, 'SV') ? { p: g.r, line: en ? `${val(g, 'SV')} saves` : `${val(g, 'SV')} 次撲救` } : null;
  }
  // The rest (American football): the game's own first leader, its stat named.
  const l = (d?.leaders || []).find(x => x.team === team && x.name);
  return l ? { p: l, line: `${statName(l.stat, L(), { sport })} ${leaderValue(l.value, L())}` } : null;
}
export function gameRecap(e, d) {
  const sides = inOrder(e, [e.away, e.home]);
  const best = sides.map(s => ({ s, star: d ? sideStar(d, e, String(s.id)) : null })).filter(x => x.star);
  // One line a side, under the scores as a race's top three is under its
  // name (Jay 2026-10-27: not two big cards that make one game twice as tall).
  // Never cut (Jay 2026-10-27, "why it text wrap"): the full name first, then
  // its short form (R. Gasser), then the stats' short words (3K, 12 板),
  // then smaller (fitChoice).
  const ways = (p, line, tight) => {
    const full = playerName(p.full || p.name, 'full', p.name);
    const short = p.name && p.name !== full ? p.name : shortWords(full);
    const way = (who, what) => ({ html: `<strong>${esc(who)}</strong><small>${esc(what)}</small>` });
    return [way(full, line), way(short, line), ...(tight && tight !== line ? [way(short, tight)] : [])];
  };
  return best.length
    ? [
        el('div', { class: 'recap-best' }, best.map(({ star: { p, line, tight } }) =>
          el('button', { class: 'recap-lead', type: 'button', disabled: p.id ? null : true, onclick: () => p.id && ctx.openPlayer(e.league, p.id, { name: p.full || p.name, logo: p.headshot }) }, [
            personPic({ ...p, name: p.full || p.name }, e.league, 'xs round'),
            fitChoice(el('span', { class: 'recap-text' }), ways(p, line, tight))
          ])
        ))
      ]
    : [];
}
function fitLine(n) {
  if (!n) return n;
  n.classList.add('one-line');
  lineWatch?.observe(n);
  return n;
}
function fitFive(row) {
  fiveWatch?.observe(row);
  return row;
}
// A name's short form: the given names to initials (Alexander Albon, A. Albon).
const shortWords = n => {
  const w = String(n || '').trim().split(/\s+/);
  return w.length > 1 ? `${w[0][0]}. ${w.slice(1).join(' ')}` : w[0] || '';
};
function fitName(node, full, short) {
  node.dataset.full = full;
  node.dataset.short = short || full;
  node.textContent = full;
  node.classList.add('fit-name');
  fitWatch?.observe(node);
  return node;
}
const f1Whole = name => f1Shown(name);
// A team's name short ("Racing Bulls" → "RB"; one word, or Chinese, as it is).
const teamShort = name => (/^[A-Za-z]+( [A-Za-z]+)+$/.test(name) ? name.split(' ').map(w => w[0]).join('').toUpperCase() : name);
// One row for every F1 list (results, qualifying, practice, live), the
// same in each and as 數據's tables read: the team's colour down its edge,
// the place, the face; the surname, and under it the team with what else
// counts (the tyre, places gained, the fastest lap, in the pits); on the
// right the time or gap, and under it one more number (the points, the car
// ahead). Nothing is ever cut: the full name, cut to "Lewis Ha…" beside the
// tags, is the driver's page.
// A car's word from the stewards by its name: each penalty still to serve
// (+5 秒, 穿越罰, 停站罰), and 調查中 while an incident of its is looked at.
function stewardPills(x) {
  if (!x) return [];
  const en = L() === 'en';
  const pen = k => (/^\d+s$/.test(k) ? (en ? `+${parseInt(k)}s` : `+${parseInt(k)} 秒`) : k === 'DT' ? (en ? 'Drive-through' : '穿越罰') : en ? `Stop-go${k.slice(2) ? ` ${k.slice(2)}s` : ''}` : `停站罰${k.slice(2) ? ` ${k.slice(2)} 秒` : ''}`);
  return [...x.pen.map(k => el('small', { class: 'f1-pill bad num', text: pen(k) })), x.probe ? el('small', { class: 'f1-pill warn', text: en ? 'Under investigation' : '調查中' }) : null];
}
function f1Row({ pos, posText = '', posOut = false, full, team, field, main = '', aside = null, notes = [], cls = '', colour = '', tower = null }) {
  const en = L() === 'en';
  const c = fieldDriver(field, full) || { name: full };
  const who = { ...c, name: f1Whole(full) };
  const car = f1Constructor(team || f1Driver(full).team);
  // A live session's timing tower: one line a car (its team the colour bar),
  // the tyre in a column of its own, the gap at the right; a tag under the
  // name only when there's one (in the pits, a penalty, an investigation).
  if (tower) {
    const pills = (tower.pills || []).filter(Boolean);
    const row = el('li', { class: `tower${ctx.isFollowed('f1', c.id) ? ' mine' : ''}${cls ? ` ${cls}` : ''}` }, [
      el('span', { class: `pos num${posOut ? ' out' : ''}`, text: posText || String(pos) }),
      c.id ? el('button', { class: 'face-btn', type: 'button', 'aria-label': f1Shown(full), onclick: () => ctx.openPlayer('f1', c.id, c) }, [personPic(c, 'f1', 'xs round')]) : personPic(c, 'f1', 'xs round'),
      el('span', { class: 'f1-who' }, [fitName(personName('f1', who), who.name, f1Sur({ name: full })), pills.length ? el('span', { class: 'f1-sub' }, pills) : null]),
      el('span', { class: 'tw-tyre' }, (tower.tyre || []).filter(Boolean)),
      el('span', { class: 'f1-res' }, [el('span', { class: 'num f1-main tw-a', text: main }), el('span', { class: 'num f1-main tw-b', text: tower.alt ?? main })])
    ]);
    row.style.setProperty('--team', colour || car.color);
    return row;
  }
  const row = el('li', { class: `${ctx.isFollowed('f1', c.id) ? 'mine' : ''}${cls ? ` ${cls}` : ''}`.trim() }, [
    el('span', { class: `pos num${posOut ? ' out' : ''}`, text: posText || String(pos) }),
    // (The face opens the driver too.)
    c.id ? el('button', { class: 'face-btn', type: 'button', 'aria-label': f1Shown(full), onclick: () => ctx.openPlayer('f1', c.id, c) }, [personPic(c, 'f1', 'sm round')]) : personPic(c, 'f1', 'sm round'),
    el('span', { class: 'f1-who' }, [
      fitName(personName('f1', who), who.name, f1Sur({ name: full })),
      el('span', { class: 'f1-sub' }, [el('button', { class: 'link f1-team', type: 'button', onclick: () => openConstructor({ id: '', name: car.name, en: car.name }) }, [constructorBadge(car.name, 'xxs'), fitName(el('span'), en ? car.name : car.zh, teamShort(en ? car.name : car.zh))]), ...notes.filter(Boolean)])
    ]),
    el('span', { class: 'f1-res' }, [el('span', { class: 'num f1-main', text: main }), aside ? el('small', { class: 'num f1-aside' }, [aside]) : null])
  ]);
  row.style.setProperty('--team', colour || car.color);
  return row;
}
function f1Field(rows, field) {
  const en = L() === 'en';
  return el(
    'ol',
    { class: 'field f1-field' },
    rows.map(r => {
      const gained = r.grid && !r.out ? r.grid - r.pos : 0;
      // A car out as the live board has it: its place, 退賽 by the name, the laps it ran (a race's; a qualifying's out has none: 退賽 in its place).
      const placed = r.out && r.place;
      return f1Row({
        pos: placed ? r.place : r.pos,
        posText: r.out && !placed ? r.text : '',
        posOut: r.out && !placed,
        full: `${r.driver.givenName} ${r.driver.familyName}`,
        team: r.team,
        field,
        cls: r.out ? 'gone' : '',
        main: r.out ? (placed ? (en ? `${r.laps} laps` : `${r.laps} 圈`) : r.why) : r.time || (r.status === 'Lapped' ? (en ? 'Lapped' : '被套圈') : ''),
        // Under the name: places from the grid, out in which part, the fastest lap; on the right under the time: the points (or the gap).
        notes: [
          gained ? el('small', { class: `num gain ${gained > 0 ? 'up' : 'down'}`, title: en ? `From P${r.grid}` : `起跑第 ${r.grid}`, text: `${gained > 0 ? '▲' : '▼'}${Math.abs(gained)}` }) : null,
          placed ? el('small', { class: 'f1-pill bad', text: r.text }) : null,
          r.outIn ? el('small', { class: 'f1-pill', text: en ? `Out ${r.outIn}` : `${r.outIn} 淘汰` }) : null,
          r.fastest ? el('small', { class: 'f1-pill fl', text: en ? 'Fastest' : '最快圈' }) : null
        ],
        aside: r.points ? (en ? `${r.points} pts` : `${r.points} 分`) : r.gap || null
      });
    })
  );
}
// A session on now, as F1's own timing screen reads: the part (or the lap)
// with the time left and the flag on top, race control's latest, then each
// car: place, team colour, name, tyre, best lap (qualifying) or gap and
// interval (race), and in the pits or out. In qualifying a line where the
// part cuts, the cars under it shaded; the ones already out greyed.
const TRACK = { 1: ['綠旗', 'Green', 'green'], 2: ['黃旗', 'Yellow', 'yellow'], 4: ['安全車', 'Safety car', 'yellow'], 5: ['紅旗', 'Red flag', 'red'], 6: ['虛擬安全車', 'VSC', 'yellow'], 7: ['虛擬安全車結束', 'VSC ending', 'yellow'] };
const TYRE = { SOFT: ['S', '#e10600'], MEDIUM: ['M', '#ffd12e'], HARD: ['H', '#f2f2f2'], INTERMEDIATE: ['I', '#43b02a'], WET: ['W', '#0067ad'] };
const TYRE_NAME = { SOFT: ['軟胎', 'Soft'], MEDIUM: ['中性胎', 'Medium'], HARD: ['硬胎', 'Hard'], INTERMEDIATE: ['半雨胎', 'Inter'], WET: ['全雨胎', 'Wet'] };
// A tyre as Pirelli draws it: the black tyre, its compound's coloured band
// and letter, the letter centred by the drawing itself (not a font's box).
function tyreIcon(compound) {
  const t = TYRE[compound];
  if (!t) return null;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'tyre');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', compound);
  const add = (tag, attrs) => {
    const n = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    svg.append(n);
    return n;
  };
  add('circle', { cx: 12, cy: 12, r: 11.5, fill: '#16171b' });
  add('circle', { cx: 12, cy: 12, r: 8.4, fill: 'none', stroke: t[1], 'stroke-width': 2.4 });
  const letter = add('text', { x: 12, y: 12, fill: t[1], 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 9.5, 'font-weight': 900, 'font-family': 'system-ui, -apple-system, Helvetica, Arial, sans-serif' });
  letter.textContent = t[0];
  return svg;
}
// How long each part of a session runs (seconds), for the time bar: a practice, qualifying's three parts, the sprint's.
const f1AllMsgs = new Set();
const PART_S = { FP1: [3600], FP2: [3600], FP3: [3600], Qual: [1080, 900, 720], SS: [720, 600, 480], SQ: [720, 600, 480] };
function f1LiveBoard(b, ss, { order: orderOnly = false } = {}) {
  const en = L() === 'en';
  const quali = /^(Qual|SS|SQ)$/.test(ss.abbr);
  const race = ss.abbr === 'Race' || ss.abbr === 'SR';
  // A practice: each car by its best lap, like a qualifying (it showed 領先 and no times at all).
  const timed = !race;
  const prefix = ss.abbr === 'Qual' ? 'Q' : 'SQ';
  // Over (F1's archive, or its feed's last word): the final order, no clock or flag.
  const over = feedOver(b);
  // Between parts: the one just run is over; a part not begun has no cut line yet (Q2's showed before Q2 began).
  const pause = quali && !over && feedBreak(b);
  const begun = !pause || (b.clock.left < ([0, 1080, 900, 720][b.part] || 0) - 2);
  const cut = quali && begun ? qualiCut(b.part, b.entries) : 0;
  const flag = over ? null : TRACK[b.track.status];
  // The time left as F1's feed last said it (never counted on between reads: it stood still on screen when the feed did), and the bar under the head.
  const left = el('span', { class: 'num lb-clock' });
  const fill = el('i');
  const total = (PART_S[ss.abbr] || [])[Math.max(0, (b.part || 1) - 1)] || 0;
  const tickClock = () => {
    const n = Math.max(0, b.clock.left);
    left.textContent = over ? (en ? 'Final' : '最終成績') : pause ? (begun ? (en ? 'Over · break' : '結束 · 休息中') : en ? 'Starting soon' : '即將開始') : race && b.lap ? '' : `${en ? '' : '剩 '}${mmss(n)}${en ? ' left' : ''}`;
    const done = over ? 1 : race && b.lap?.of ? b.lap.now / b.lap.of : total ? 1 - n / total : 0;
    fill.style.width = `${Math.round(Math.min(1, Math.max(0, done)) * 100)}%`;
  };
  tickClock();
  // The head, one card: on top the session with a live dot and the flag;
  // under it the lap (or the part) large, its total beside it, and what's
  // left on the right (laps, or the clock); the bar with the safety car's
  // laps marked on it; race control's last words under a hairline.
  const lapNow = race && b.lap?.now && !over;
  const lapsLeft = lapNow ? Math.max(0, b.lap.of - b.lap.now) : 0;
  const leftText = lapNow ? (lapsLeft ? (en ? `${lapsLeft} to go` : `剩 ${lapsLeft} 圈`) : en ? 'Last lap' : '最後一圈') : null;
  if (leftText) left.textContent = leftText;
  const marks = lapNow && b.lap.of ? neutralLaps(b.control || [], b.lap.now).map(p => el('b', { class: `lb-sc ${p.kind}`, style: `left:${((p.from - 1) / b.lap.of) * 100}%;width:${Math.max(0.8, ((p.to - p.from + 1) / b.lap.of) * 100)}%` })) : [];
  const head = el('div', { class: 'lb-top' }, [
    el('div', { class: 'lb-state' }, [
      el('span', { class: 'lb-live' }, [el('i'), el('span', { text: sessionName(ss, L()) })]),
      flag ? el('span', { class: `lb-flag ${flag[2]}` }, [el('i'), el('span', { text: en ? flag[1] : flag[0] })]) : null
    ]),
    el('div', { class: 'lb-head' }, [
      lapNow
        ? el('span', { class: 'lb-lap' }, [el('small', { text: en ? 'Lap' : '第' }), el('strong', { class: 'num', text: String(b.lap.now) }), el('small', { class: 'num', text: en ? `/ ${b.lap.of}` : `/ ${b.lap.of} 圈` })])
        : el('strong', { class: 'lb-part', text: quali && b.part && !over ? `${prefix}${b.part}` : sessionName(ss, L(), true) }),
      left
    ]),
    !over && (total || (race && b.lap?.of)) ? el('div', { class: 'lb-bar', 'aria-hidden': 'true' }, [fill, ...marks]) : null
  ]);
  const fastestNo = race ? [...b.cars].filter(c => lapMs(c.best)).sort((x, y) => lapMs(x.best) - lapMs(y.best))[0]?.no : null;
  const gainOf = c => {
    const n = race && c.grid && !c.retired && !c.stopped ? c.grid - c.pos : 0;
    return n ? el('small', { class: `num gain ${n > 0 ? 'up' : 'down'}`, title: en ? `From P${c.grid}` : `起跑第 ${c.grid}`, text: `${n > 0 ? '▲' : '▼'}${Math.abs(n)}` }) : null;
  };
  const rows = b.cars.flatMap((c, i) => {
    const tyre = TYRE[c.tyre];
    const state = c.retired || c.stopped ? (en ? 'Out' : '退賽') : c.out ? (en ? 'Out' : '淘汰') : c.inPit ? (en ? 'Pit' : '進站') : c.pitOut ? (en ? 'Out lap' : '出站') : '';
    const row = f1Row({
      pos: c.pos,
      full: c.name,
      team: c.team,
      field: ss.field,
      colour: c.colour,
      // Out of it (retired, stopped, knocked out): greyed, every one alike (a stopped car said 退賽 but stayed bright).
      cls: `${cut && c.pos > cut && !c.out ? 'drop' : ''}${c.out || c.retired || c.stopped ? ' gone' : ''}`.trim(),
      // Qualifying and practice: the best lap (of this part), the gap to the top under it; a race: the gap, the car ahead's interval under it.
      // (A car out: the laps it ran, not the laps it's down: "55L" read as still running, long after it stopped.)
      main: timed ? c.best || '—' : i === 0 ? (over ? (en ? 'Winner' : '冠軍') : en ? 'Leader' : '領先') : race && (c.retired || c.stopped) ? (c.laps ? (en ? `${c.laps} laps` : `${c.laps} 圈`) : en ? 'DNS' : '未起跑') : c.gap,
      // Under the name: the tyre and its age, in the pits or out; on the right under the gap: the car ahead (a race), the gap (qualifying, practice); over, the laps run.
      // (A race, on and over: the places from the grid by the name, as the official results have them; over, the points it took under the gap.)
      // (A race over: the official results' own row, whichever came first: the places gained, the fastest lap, the points.)
      notes: over
        ? race
          ? [gainOf(c), c.no === fastestNo ? el('small', { class: 'f1-pill fl', text: en ? 'Fastest' : '最快圈' }) : null, c.retired || c.stopped ? el('small', { class: 'f1-pill bad', text: en ? 'Out' : '退賽' }) : null]
          : [c.laps ? el('small', { class: 'num f1-laps', text: `${c.laps}${en ? ' laps' : ' 圈'}` }) : null, c.retired || c.stopped ? el('small', { class: 'f1-pill bad', text: en ? 'Out' : '退賽' }) : null]
        : [tyre ? el('span', { class: 'f1-tyre' }, [tyreIcon(c.tyre), c.tyreLaps ? el('small', { class: 'num', text: `${c.tyreLaps}${en ? ' laps' : ' 圈'}` }) : null]) : null, gainOf(c), state ? el('small', { class: `f1-pill${c.inPit || c.pitOut ? '' : ' bad'}`, text: state }) : null, ...stewardPills(b.stewards?.[c.no])],
      tower: over ? null : { alt: timed ? (i > 0 && c.gap ? c.gap : '') : i === 0 ? (en ? 'Leader' : '領先') : race && (c.retired || c.stopped) ? (c.laps ? (en ? `${c.laps} laps` : `${c.laps} 圈`) : en ? 'DNS' : '未起跑') : c.interval || c.gap, tyre: [gainOf(c), tyre ? el('span', { class: 'f1-tyre' }, [tyreIcon(c.tyre), c.tyreLaps ? el('small', { class: 'num', text: String(c.tyreLaps) }) : null]) : null], pills: [state ? el('small', { class: `f1-pill${c.inPit || c.pitOut ? '' : ' bad'}`, text: state }) : null, ...stewardPills(b.stewards?.[c.no])] },
      aside: over
        ? race ? (pointsFor(ss.abbr, c.pos, c.retired || c.stopped) ? (en ? `${pointsFor(ss.abbr, c.pos)} pts` : `${pointsFor(ss.abbr, c.pos)} 分`) : null) : timed && i > 0 && c.gap ? c.gap : null
        : timed ? (i > 0 && c.gap ? c.gap : null) : i > 0 && c.interval && c.interval !== c.gap ? `${en ? 'int ' : '前車 '}${c.interval}` : null
    });
    return cut && c.pos === cut ? [row, el('li', { class: 'lb-cut', 'aria-hidden': 'true' }, [el('span', { text: en ? `Out after ${prefix}${b.part}` : `${prefix}${b.part} 淘汰線` })])] : [row];
  });
  // Race control's word, in Chinese by rule (lib/racecontrol.mjs); each car named a driver chip that opens them.
  const carChip = no => {
    const c = b.cars.find(x => x.no === no);
    if (!c) return `#${no}`;
    const who = fieldDriver(ss.field, c.name, driverShort(c.name)) || { name: c.name };
    return el(who.id ? 'button' : 'span', { class: 'rc-who', type: who.id ? 'button' : null, onclick: who.id ? () => ctx.openPlayer('f1', who.id, who) : null }, [personPic(who, 'f1', 'xs round'), el('span', { text: driverShort(c.name) })]);
  };
  // (Over: race control's last word, a flag long gone, isn't said.)
  // Its last three, newest first, each with its lap (one, in English, before); the rest a tap away.
  const said = (b.messages?.length ? b.messages : b.message?.text ? [{ text: b.message.text, lap: 0 }] : []).filter(m => m.text);
  const msgRow = m => el('li', {}, [el('small', { class: 'num lb-msg-lap', text: m.lap ? (en ? `L${m.lap}` : `${m.lap} 圈`) : '' }), el('span', {}, raceControlParts(m.text, !en).map(x => (typeof x === 'string' ? document.createTextNode(x) : carChip(x.no))))]);
  const makeMsg = () => {
    const showAll = f1AllMsgs.has(ss.start);
    const box = el('div', { class: 'lb-msg' }, [
      el('small', { class: 'lb-msg-h', text: en ? 'Race control' : '賽事控制' }),
      el('ol', { class: 'lb-msgs' }, said.slice(0, showAll ? 8 : 1).map(msgRow)),
      said.length > 1 ? el('button', { type: 'button', class: 'link lb-msg-more', text: showAll ? (en ? 'Fewer' : '收起') : en ? `${said.length - 1} more` : `再看 ${said.length - 1} 則`, onclick: () => (showAll ? f1AllMsgs.delete(ss.start) : f1AllMsgs.add(ss.start), box.replaceWith(makeMsg())) }) : null
    ]);
    return box;
  };
  const msg = said.length && !over ? makeMsg() : null;
  // Live: the tower's head, its last column one number (the gap to the
  // leader, or a tap and the car ahead; a qualifying's best lap, or its gap),
  // each car one line.
  const [colA, colB] = timed ? (en ? ['Best', 'Gap'] : ['最快圈', '差距']) : en ? ['Leader', 'Ahead'] : ['差距', '前車'];
  const towerHead = over
    ? null
    : el('li', { class: 'tw-head' }, [
        el('small', { text: en ? 'Driver' : '車手' }),
        el('small', { class: 'tw-h-tyre', text: en ? 'Tyre' : '輪胎' }),
        el('button', { type: 'button', class: 'tw-h-gap', onclick: ev => { f1GapAlt = !f1GapAlt; ev.currentTarget.closest('ol').classList.toggle('alt', f1GapAlt); ev.currentTarget.querySelector('b').textContent = f1GapAlt ? colB : colA; ev.currentTarget.querySelector('i').textContent = f1GapAlt ? colA : colB; } }, [el('b', { text: f1GapAlt ? colB : colA }), el('span', { text: ' ⇄ ' }), el('i', { text: f1GapAlt ? colA : colB })])
      ]);
  const order = el('ol', { class: `field f1-field lb-rows${f1GapAlt ? ' alt' : ''}` }, [towerHead, ...rows].filter(Boolean));
  if (orderOnly) return order;
  // Over: no head (its part, clock and flag are gone; "最終成績" over the
  // results said nothing), the order and its 數據 as every finished session.
  // On: the head, race control's latest, then 成績 or 數據 (F1 timing's other numbers).
  if (msg) head.append(msg);
  // (The weather a line under it, not a card of its own.)
  if (!over) head.append(f1Weather(b) || '');
  return el('div', { class: 'live-board' }, over ? [f1Views(order, f1Stats(b, ss))] : [head, f1Views(order, f1Stats(b, ss))]);
}
// A session's other numbers, as F1's timing has them, for every session
// (practice, sprint qualifying, sprint, qualifying, race), on and over:
//   - the headline numbers as tiles: the fastest lap, the ideal lap (each
//     best sector, whoever set it), the speed trap, the most places gained
//     (a race) or the most laps run (a practice);
//   - a qualifying's best lap in each part (Q1, Q2, Q3), each part's fastest purple;
//   - the tyres: each car's stints by compound and length, its stops (a race) or laps;
//   - a race's fastest laps, each with the lap it was set on;
//   - the best sectors (the fastest of each purple, as F1 marks it) and each car's ideal lap;
//   - the speed traps: the trap's top ten, with the two intermediates and the line.
// Every name is the driver's surname, whole (the columns are made for the
// longest on the grid). Null when the feed has none of it.
const fmtLap = n => (n ? `${Math.floor(n / 60000)}:${((n % 60000) / 1000).toFixed(3).padStart(6, '0')}` : '');
// ---- F1 數據, live and after: the weather, the track with the cars on it,
// each car's laps side by side, and where a stop now would put each car ----

// The weather at the track (live): four small numbers in one row.
function f1Weather(b) {
  const w = b.weather;
  if (!w) return null;
  const en = L() === 'en';
  // One quiet line (four big numbers, before, came first and said least).
  const items = [[en ? 'Air' : '氣溫', `${w.air.toFixed(1)}°`], [en ? 'Track' : '賽道', `${w.track.toFixed(1)}°`], [en ? 'Humidity' : '濕度', `${Math.round(w.humidity)}%`], [en ? 'Rain' : '降雨', w.rain ? (en ? 'Yes' : '有') : en ? 'No' : '無']];
  return el('div', { class: 'fs-weather' }, items.map(([k, v]) => el('span', {}, [el('small', { text: k }), el('strong', { class: 'num', text: v })])));
}

// Circuits by F1's key, read once (MultiViewer's outline, F1's coordinates).
const f1Circuits = new Map();
function circuitOf(b, ss, redraw) {
  const key = b.session?.circuit;
  if (!key) return null;
  const c = f1Circuits.get(key);
  if (c === undefined) {
    f1Circuits.set(key, 'loading');
    circuitMap(key, new Date(ss.start).getUTCFullYear())
      .then(x => {
        f1Circuits.set(key, x);
        if (x) redraw?.();
      })
      .catch(() => f1Circuits.set(key, null));
  }
  return c && c !== 'loading' ? c : null;
}

// The track and every car on it, drawn in 車手比較 (the drivers picked
// there named, bright and on top; a tap on a car picks it or drops it). One
// drawing kept for the session, the cars moved in it, not drawn again. As
// F1 stopped giving the cars' x/y in 2026, each car is placed by the
// mini-sectors it has passed this lap, and between reads it runs on at its
// own pace (lib/carpace.mjs), so no car stands still waiting for the feed.
const f1Maps = new Map();
// One frame loop a map while it's on the page (started again when it's back).
function tmLoop(m) {
  if (m.loop || matchMedia('(prefers-reduced-motion: reduce)').matches) return tmDraw(m, performance.now(), 0);
  m.loop = true;
  let last = performance.now();
  const step = t => {
    if (!m.svg.isConnected) return (m.loop = false);
    tmDraw(m, t, Math.min(100, t - last));
    last = t;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
// Every car moved on by `dt` ms and drawn: on the track line (a car on the
// one ahead set back behind it, a train of dots), the same size zoomed or not.
// Where the track folds back on itself (a hairpin, the esses) a train along
// it still sits in a heap: dots on one another are pushed apart on the
// screen (a short line from each back to where it is on the track), and the
// named ones' tags put where they cover least (tmTags).
function tmDraw(m, t, dt) {
  const z = Math.max(1, m.z || 1);
  const gapU = (11.5 * 2) / z;
  const moving = [];
  const cars = [];
  for (const [no, s] of m.run) {
    const g = m.cars.get(no);
    if (!g?.isConnected) continue;
    if (s.xy) {
      cars.push([s, g, m.fit(...s.xy)]);
      continue;
    }
    if (dt) s.d = stepCar(s, t, dt);
    moving.push([s, g, ((s.d % 1) + 1) % 1]);
  }
  // (A dot's width as a share of the lap, here: the line's pace varies round it.)
  const sep = f => {
    const [x, y] = m.fit(...m.pointAt(f));
    const [x2, y2] = m.fit(...m.pointAt(f + 0.004));
    return (gapU / (Math.hypot(x2 - x, y2 - y) || 1)) * 0.004;
  };
  const at = spread(moving.map(x => x[2]), sep);
  moving.forEach(([s, g, f], i) => {
    // (How far it's set back eased, not jumped: two close cars trade places in the train often.)
    const back = at[i] - f;
    s.back = s.back == null ? back : s.back + (back - s.back) * Math.min(1, dt / 350);
    cars.push([s, g, m.fit(...m.pointAt(f + s.back))]);
  });
  // Apart on the screen (a heap where the track folds back), eased there, so a heap opens and closes smoothly.
  const rOf = g => (g.classList.contains('face') ? 13 : 11.5) / z;
  const pts = apart(cars.map(([, g, xy]) => ({ x: xy[0], y: xy[1], r: rOf(g) })));
  cars.forEach(([s, g], i) => {
    const p = pts[i];
    const ease = s.shown && dt ? Math.min(1, dt / 220) : 1;
    s.shown = s.shown ? [s.shown[0] + (p.x - p.hx - s.shown[0]) * ease, s.shown[1] + (p.y - p.hy - s.shown[1]) * ease] : [p.x - p.hx, p.y - p.hy];
    const [x, y] = [p.hx + s.shown[0], p.hy + s.shown[1]];
    g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})${z > 1 ? ` scale(${(1 / z).toFixed(3)})` : ''}`);
    s.drawn = [x, y];
    // The line back to its place, once it's been pushed a dot's half off it.
    const lead = g.querySelector('.tm-lead');
    const far = Math.hypot(s.shown[0], s.shown[1]) > p.r * 0.6;
    lead.toggleAttribute('hidden', !far);
    if (far) {
      lead.querySelector('line').setAttribute('x2', (-s.shown[0] * z).toFixed(1));
      lead.querySelector('line').setAttribute('y2', (-s.shown[1] * z).toFixed(1));
      lead.querySelector('circle').setAttribute('cx', (-s.shown[0] * z).toFixed(1));
      lead.querySelector('circle').setAttribute('cy', (-s.shown[1] * z).toFixed(1));
    }
  });
  // The tags again a few times a second (not each frame: they'd flicker side to side).
  if (!dt || t - (m.tagsAt || 0) > 300) {
    m.tagsAt = t;
    tmTags(m);
  }
}
// The named cars' tags (each its code, a picked one's gap to the first
// picked: set in g.__tag), each where it covers fewest dots and other tags
// and stays on the map: right of its dot, left, above or below; where it
// was, unless another place is clearly better.
function tmTags(m) {
  const z = Math.max(1, m.z || 1);
  const dots = [];
  for (const [, s] of m.run) if (s.drawn) dots.push(s.drawn);
  const [vx, vy, vw, vh] = (m.svg.getAttribute('viewBox') || `0 0 ${m.W} ${m.H}`).split(' ').map(Number);
  const tags = (m.tagged || []).filter(g => g.isConnected && g.__tag && m.run.get(g.__no)?.drawn);
  const spots = placeTags(tags.map(g => ({ at: m.run.get(g.__no).drawn, w: g.__tag.text.length * 6.9 + 4, off: g.__tag.off, was: g.__side })), dots, [vx, vy, vx + vw, vy + vh], z);
  tags.forEach((g, i) => {
    const [side, x, y, anchor] = spots[i];
    g.__side = side;
    const tag = g.querySelector('.tm-tag');
    tag.setAttribute('x', String(x));
    tag.setAttribute('y', String(y));
    tag.setAttribute('text-anchor', anchor);
  });
}
// The map zoomed with two fingers (dragged with one once in), or twice
// tapped in close; back to the whole track a few seconds after the last
// touch. The cars and the line keep their size, so a bunch spreads out.
function tmZoom(m) {
  const { svg, W, H } = m;
  const whole = { x: 0, y: 0, w: W, h: H };
  let view = { ...whole };
  let back = 0;
  let easing = 0;
  m.z = 1;
  const show = v => {
    const w = Math.max(W / 6, Math.min(W, v.w));
    const h = (w / W) * H;
    view = { x: Math.max(0, Math.min(W - w, v.x)), y: Math.max(0, Math.min(H - h, v.y)), w, h };
    svg.setAttribute('viewBox', `${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.w.toFixed(1)} ${view.h.toFixed(1)}`);
    m.z = W / view.w;
    svg.style.setProperty('--z', m.z.toFixed(3));
    svg.classList.toggle('zoomed', m.z > 1.01);
    const t = performance.now();
    tmDraw(m, t, 0);
  };
  // A point on the screen in the drawing's own units.
  const at = (cx, cy) => {
    const r = svg.getBoundingClientRect();
    return [view.x + ((cx - r.left) / r.width) * view.w, view.y + ((cy - r.top) / r.height) * view.h];
  };
  const zoomAt = ([px, py], w) => show({ x: px - ((px - view.x) / view.w) * w, y: py - ((py - view.y) / view.h) * ((w / W) * H), w });
  const later = () => {
    clearTimeout(back);
    back = setTimeout(() => {
      const from = { ...view };
      const t0 = performance.now();
      const step = t => {
        const p = Math.min(1, (t - t0) / 450);
        const e = 1 - (1 - p) ** 3;
        show({ x: from.x + (0 - from.x) * e, y: from.y + (0 - from.y) * e, w: from.w + (W - from.w) * e });
        if (p < 1) easing = requestAnimationFrame(step);
      };
      easing = requestAnimationFrame(step);
    }, 4000);
  };
  let pinch = null;
  let pan = null;
  let tapAt = 0;
  svg.addEventListener('touchstart', ev => {
    clearTimeout(back);
    cancelAnimationFrame(easing);
    const [a, b2] = ev.touches;
    if (b2) {
      pinch = { d: Math.hypot(a.clientX - b2.clientX, a.clientY - b2.clientY), w: view.w, mid: at((a.clientX + b2.clientX) / 2, (a.clientY + b2.clientY) / 2) };
      pan = null;
    } else if (m.z > 1.01) pan = { x: a.clientX, y: a.clientY, v: { ...view } };
    // Twice tapped off the cars: in, or back out.
    if (!b2 && !ev.target.closest('.tm-car')) {
      const now = Date.now();
      if (now - tapAt < 300) {
        ev.preventDefault();
        m.z > 1.01 ? show(whole) : zoomAt(at(a.clientX, a.clientY), W / 2.5);
        tapAt = 0;
        later();
      } else tapAt = now;
    }
  }, { passive: false });
  svg.addEventListener('touchmove', ev => {
    const [a, b2] = ev.touches;
    if (pinch && b2) {
      ev.preventDefault();
      zoomAt(pinch.mid, pinch.w * (pinch.d / (Math.hypot(a.clientX - b2.clientX, a.clientY - b2.clientY) || 1)));
    } else if (pan && a) {
      ev.preventDefault();
      const r = svg.getBoundingClientRect();
      show({ x: pan.v.x - ((a.clientX - pan.x) / r.width) * view.w, y: pan.v.y - ((a.clientY - pan.y) / r.height) * view.h, w: view.w });
    }
  }, { passive: false });
  svg.addEventListener('touchend', ev => {
    if (ev.touches.length < 2) pinch = null;
    if (!ev.touches.length) {
      pan = null;
      if (m.z > 1.01) later();
    }
  });
}
// A circuit's outline turned as MultiViewer draws it (its rotation and a
// quarter turn, y as it comes), then fitted to W wide, between minH and maxH
// high: fit(x, y) → [x, y] in the drawing, and its height.
function trackFit(c, W, minH, maxH, pad) {
  const a = ((c.rotation + 90) * Math.PI) / 180;
  const cx = (Math.min(...c.x) + Math.max(...c.x)) / 2;
  const cy = (Math.min(...c.y) + Math.max(...c.y)) / 2;
  const turn = (x, y) => [(x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), (y - cy) * Math.cos(a) + (x - cx) * Math.sin(a)];
  const pts = c.x.map((x, i) => turn(x, c.y[i]));
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = (W - pad * 2) / (x1 - x0);
  const H = Math.round(Math.min(maxH, Math.max(minH, (y1 - y0) * k + pad * 2)));
  const kk = Math.min(k, (H - pad * 2) / (y1 - y0));
  const ox = (W - (x1 - x0) * kk) / 2, oy = (H - (y1 - y0) * kk) / 2;
  return {
    H,
    fit: (x, y) => {
      const [u, v] = turn(x, y);
      return [ox + (u - x0) * kk, oy + (v - y0) * kk];
    }
  };
}
function f1TrackMap(b, ss) {
  const c = circuitOf(b, ss);
  // (Each car where F1's feed puts it, or, as F1 stopped giving the cars' x/y in 2026, by the mini-sectors it has passed this lap.)
  if (!c || !b.cars.some(x => x.at || x.seg?.[1])) return null;
  const en = L() === 'en';
  const ns = 'http://www.w3.org/2000/svg';
  let m = f1Maps.get(ss.start);
  if (!m) {
    const W = 340;
    const { fit, H } = trackFit(c, W, 180, 340, 16);
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'tm-svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', c.name || (en ? 'Track map' : '賽道'));
    const d = c.x.map((x, i) => fit(x, c.y[i]).map(n => n.toFixed(1)).join(',')).join(' ');
    // (One round clip for every face: in each car's own place, as it's drawn in it.)
    svg.innerHTML = `<defs><clipPath id="tm-face-clip"><circle r="11"/></clipPath></defs><polyline class="tm-edge" points="${d}"/><polyline class="tm-track" points="${d}"/>`;
    // Over the track: the sector lines and the finish, then the cars.
    const marks = document.createElementNS(ns, 'g');
    const layer = document.createElementNS(ns, 'g');
    svg.append(marks, layer);
    // How far into a lap each point is: by the time the outline's own lap
    // took to get there (MultiViewer's, where it has it), else by distance
    // (the outline starts at the line).
    const run = [0];
    for (let i = 1; i < c.x.length; i++) run.push(run[i - 1] + Math.hypot(c.x[i] - c.x[i - 1], c.y[i] - c.y[i - 1]));
    const scale = c.times?.length === c.x.length && c.times.at(-1) > 0 ? c.times : run;
    const fracOfIdx = i => scale[Math.max(0, Math.min(scale.length - 1, i))] / scale.at(-1);
    // The point a share of the lap round ([x, y] in F1's space), between two of the outline's.
    const pointAt = f => {
      const want = (((f % 1) + 1) % 1) * scale.at(-1);
      let lo = 0, hi = scale.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (scale[mid] <= want) lo = mid;
        else hi = mid;
      }
      const t = (want - scale[lo]) / (scale[hi] - scale[lo] || 1);
      return [c.x[lo] + t * (c.x[hi] - c.x[lo]), c.y[lo] + t * (c.y[hi] - c.y[lo]), lo];
    };
    m = { svg, fit, layer, marks, cars: new Map(), run: new Map(), faces: el('div', { class: 'tm-faces', 'aria-hidden': 'true' }), fracOfIdx, pointAt, W, H };
    tmZoom(m);
    f1Maps.set(ss.start, m);
  }
  // A share of the lap for a car's mini-sectors passed: on the circuit's
  // own mini-sector point where it has them; else each sector's share of
  // the lap by the field's best sector times (sectors aren't the same
  // length: Singapore's three have eight mini-sectors each), the
  // mini-sectors spread over it; else the plain share.
  const segs = b.sectorSegs || [];
  const best = [0, 1, 2].map(i => Math.min(...b.cars.map(x => lapMs(x.sectors?.[i]?.v) || Infinity)));
  const timed = segs.length === 3 && best.every(Number.isFinite);
  const lapOfSecs = best.reduce((n, x) => n + x, 0);
  const fracOf = (done, total) => {
    if (c.mini?.length === total && c.mini[done % total] != null) return m.fracOfIdx(c.mini[done % total]);
    if (timed && segs.reduce((n, x) => n + x, 0) === total) {
      let k = done % total;
      let t = 0;
      for (let j = 0; j < 3; j++) {
        if (k < segs[j]) return (t + (k / segs[j]) * best[j]) / lapOfSecs;
        k -= segs[j];
        t += best[j];
      }
    }
    return (done % total) / total;
  };

  // The finish (a chequered bar across the track) and the sector lines (a
  // bar across, S1, S2, S3 by each sector's middle).
  const total = segs.reduce((n, x) => n + x, 0);
  const cuts = total ? [0, fracOf(segs[0], total), fracOf(segs[0] + segs[1], total)] : [0];
  const across = (f, len) => {
    const [x, y] = m.fit(...m.pointAt(f));
    const [x2, y2] = m.fit(...m.pointAt(f + 0.004));
    const [dx, dy] = [x2 - x, y2 - y];
    const n = Math.hypot(dx, dy) || 1;
    return [x, y, (-dy / n) * len, (dx / n) * len];
  };
  m.marks.innerHTML = cuts
    .map((f, i) => {
      const [x, y, nx, ny] = across(f, 9);
      const line = `x1="${(x - nx).toFixed(1)}" y1="${(y - ny).toFixed(1)}" x2="${(x + nx).toFixed(1)}" y2="${(y + ny).toFixed(1)}"`;
      return i === 0 ? `<line class="tm-finish-b" ${line}/><line class="tm-finish" ${line}/>` : `<line class="tm-sector" ${line}/>`;
    })
    .join('') +
    (cuts.length === 3
      ? [0, 1, 2]
          .map(i => {
            const mid = (cuts[i] + ((i < 2 ? cuts[i + 1] : 1) - cuts[i]) / 2) % 1;
            const [x, y, nx, ny] = across(mid, 15);
            return `<text class="tm-sector-t" x="${(x + nx).toFixed(1)}" y="${(y + ny + 3).toFixed(1)}">S${i + 1}</text>`;
          })
          .join('')
      : '');

  // Each car's reading: where it is and how fast it goes (its own pace, the
  // flag's, the pit lane's) until the next.
  const picked = new Set(f1Picks.get(ss.start) || []);
  const placed = x => !x.retired && !x.stopped && (x.at || x.seg?.[1]);
  const order = [...b.cars].filter(placed).sort((x, y) => (picked.has(x.no) ? 1 : 0) - (picked.has(y.no) ? 1 : 0) || y.pos - x.pos);
  const fieldMs = Math.min(...b.cars.map(x => lapMs(x.best) || Infinity));
  const now = performance.now();
  // (A race: the leader by its own timing points, everyone else by their gap to it.)
  const race = ss.abbr === 'Race' || ss.abbr === 'SR';
  const lead = race ? order.find(x => x.pos === 1 && !x.at) : null;
  for (const car of lead ? [lead, ...order.filter(x => x !== lead)] : order) {
    if (car.at) {
      m.run.set(car.no, { xy: car.at });
      continue;
    }
    const v = lapRate({ lastMs: lapMs(car.last), bestMs: lapMs(car.pb?.v) || lapMs(car.best), inPit: car.inPit || car.pitOut }, Number.isFinite(fieldMs) ? fieldMs : undefined, b.track?.status);
    const ls = lead && car !== lead ? m.run.get(lead.no) : null;
    const gap = ls ? gapNum(car) : null;
    m.run.set(car.no, gap != null ? readCar(m.run.get(car.no), behindLeader(ls.frac, gap, ls.v), v, now, 1 / car.seg[1], ls.at) : readCar(m.run.get(car.no), fracOf(car.seg[0], car.seg[1]), v, now, 1 / car.seg[1]));
  }
  for (const no of m.run.keys()) if (!order.some(x => x.no === no)) m.run.delete(no);

  // The cars: the picked ones named, on top and bright, the others faint
  // (with nobody picked, the top three named).
  for (const car of order) {
    let g = m.cars.get(car.no);
    if (!g) {
      g = document.createElementNS(ns, 'g');
      g.setAttribute('class', 'tm-car');
      g.innerHTML = `<g class="tm-lead" hidden><line x1="0" y1="0"/><circle r="2.6"/></g><circle r="15" class="tm-hit"/><circle r="11" class="tm-dot"/><text class="tm-no" y="2.9"></text><g class="tm-face"><circle r="12.5" class="tm-ring"/><image x="-13" y="-11" width="26" height="26" clip-path="url(#tm-face-clip)" preserveAspectRatio="xMidYMin slice"/></g><text class="tm-tag" x="15.5" y="4"></text>`;
      g.addEventListener('click', () => {
        const now2 = f1Picks.get(ss.start) || [];
        const next = now2.includes(car.no) ? now2.filter(x => x !== car.no) : [...now2, car.no].slice(-4);
        if (!next.length) return;
        f1Picks.set(ss.start, next);
        document.querySelectorAll(`[data-laps="${ss.start}"]`).forEach(n => n.__redraw?.());
      });
      m.cars.set(car.no, g);
    }
    g.style.setProperty('--team', car.colour || '#888');
    // The number on the dot, white or black as the team's colour is dark or light.
    const hex = /^#?([0-9a-f]{6})$/i.exec(car.colour || '')?.[1];
    const light = hex && [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)).reduce((n, v, i) => n + v * [0.299, 0.587, 0.114][i], 0) > 160;
    g.classList.toggle('light', Boolean(light));
    // (Its code, not its number: who it is, without knowing the numbers.)
    g.querySelector('.tm-no').textContent = car.tla || car.no;
    g.classList.toggle('named', picked.size ? picked.has(car.no) : car.pos <= 3);
    g.classList.toggle('picked', picked.has(car.no));
    g.classList.toggle('pit', car.inPit);
    // A picked driver drawn as their face in their team's colour, once the photo has come (the numbered dot till then, or when there's none).
    // (The photo is found on the page, out of sight: the kit swaps its stand-in for the photo only there.)
    if (picked.has(car.no) && !g.__pic) {
      g.__pic = el('span', {}, [personPic(fieldDriver(ss.field, car.name, driverShort(car.name)) || { name: car.name }, 'f1')]);
      const show = () => {
        const img = g.__pic.querySelector('img');
        if (!img?.naturalWidth) return;
        g.querySelector('image').setAttribute('href', img.currentSrc || img.src);
        g.classList.add('has-face');
        g.classList.toggle('face', g.classList.contains('picked'));
      };
      g.__pic.addEventListener('load', show, true);
      m.faces.append(g.__pic);
      show();
    }
    g.classList.toggle('face', picked.has(car.no) && g.classList.contains('has-face'));
    // A ring on any car within a second of the car ahead (in range to pass).
    const iv = Number(String(car.interval || '').replace('+', ''));
    g.classList.toggle('close', car.pos > 1 && Number.isFinite(iv) && iv > 0 && iv < 1 && !car.inPit);
    m.layer.append(g);
  }
  for (const [no, g] of m.cars) if (!m.run.has(no)) g.remove();
  tmDraw(m, now, 0);

  // A named car's tag: its code, a picked one's gap to the first picked (put by tmTags).
  const picks = [...picked].map(no => b.cars.find(x => x.no === no)).filter(Boolean).sort((x, y) => x.pos - y.pos);
  const first = picks[0];
  m.tagged = [];
  for (const car of [...order].sort((x, y) => x.pos - y.pos)) {
    const g = m.cars.get(car.no);
    if (!g.classList.contains('named')) continue;
    const gap = first && car !== first && gapNum(car) != null && gapNum(first) != null ? gapNum(car) - gapNum(first) : null;
    g.__no = car.no;
    g.__tag = { text: gap != null ? `${car.tla || car.no} +${gap.toFixed(1)}` : car.tla || car.no, off: picked.has(car.no) ? 17 : 15.5 };
    g.querySelector('.tm-tag').textContent = g.__tag.text;
    m.tagged.push(g);
  }
  tmTags(m);
  tmLoop(m);
  const noteEl = m.noteEl || (m.noteEl = el('p', { class: 'muted small tm-note' }));
  noteEl.textContent = en ? 'Tap a car to add or drop it. ◯ within a second of the car ahead.' : '點車加入或移出比較 · ◯ 與前車 1 秒內';
  return m.box || (m.box = el('div', { class: 'tm-box' }, [m.svg, m.faces, noteEl]));
}

// Each car's laps (f1-live.js /laps.json, again each 15 seconds while it
// runs), with the board's own last lap of each car added as it comes (the
// stream may lag the board).
const f1LapData = new Map();
const f1Seen = new Map();
const f1Picks = new Map();
let f1LapMode = 'gap';
const f1AllLaps = new Set();
// (Every card waiting on a session's laps drawn again as they come: only the
// first to ask was, 練習's 車手比較 empty under 長距離模擬 until touched.)
const f1LapWait = new Map();
function lapsFor(b, ss, over, redraw) {
  const k = ss.start;
  const seen = f1Seen.get(k) || {};
  if (!over)
    for (const c of b.cars) {
      const ms = lapMs(c.last);
      if (!ms || !c.laps) continue;
      const list = (seen[c.no] ||= []);
      if (list.at(-1)?.[0] !== c.laps) list.push([c.laps, ms, c.pos === 1 ? 0 : /^\+?\d+(\.\d+)?$/.test(c.gap) ? Number(String(c.gap).replace('+', '')) : null, c.pos, c.inPit || c.pitOut ? 1 : 0]);
    }
  f1Seen.set(k, seen);
  const got = f1LapData.get(k);
  // (Over: again each minute while it's the proxy's log, or nothing, until F1's archive has it.)
  const due = !got?.loading && (!got || (!over && Date.now() - got.at > dev('f1Laps') * 1000) || (over && (got.live || !got.cars) && Date.now() - got.at > 60_000));
  if (due || got?.loading) {
    if (!f1LapWait.has(k)) f1LapWait.set(k, new Set());
    f1LapWait.get(k).add(redraw);
  }
  if (due) {
    f1LapData.set(k, { ...(got || { at: 0 }), loading: true });
    sessionLaps(k, over)
      .then(d => f1LapData.set(k, d?.cars ? { at: Date.now(), cars: d.cars, places: d.places || {}, stops: d.stops || {}, live: Boolean(d.live) } : { ...(got || {}), at: Date.now(), loading: false }))
      .catch(() => f1LapData.set(k, { ...(got || {}), at: Date.now(), loading: false }))
      .then(() => {
        const waiting = [...(f1LapWait.get(k)?.values() || [])];
        f1LapWait.delete(k);
        waiting.forEach(f => f());
      });
  }
  const base = got?.cars || {};
  const out = {};
  for (const no of new Set([...Object.keys(base), ...Object.keys(seen)])) {
    const by = new Map((base[no] || []).map(x => [x[0], x]));
    for (const x of seen[no] || []) if (!by.has(x[0])) by.set(x[0], x);
    out[no] = [...by.values()].sort((x, y) => x[0] - y[0]);
  }
  // (Live: the proxy's minute looks, or none yet (the laps seen here): the gap counted from the lap times.)
  // The places and stops: the board's own while it runs (the feed's latest), else the laps'.
  const pick = (mine, theirs) => (Object.keys(mine || {}).length ? mine : theirs || {});
  return { laps: out, places: over ? pick(got?.places, b.places) : pick(b.places, got?.places), stops: over ? pick(got?.stops, b.stops) : pick(b.stops, got?.stops), live: over ? Boolean(got?.live) : got?.live ?? true };
}

// A driver's face that opens them (every face in F1's 數據 and board).
function f1Face(ss, name, size = 'xs round') {
  const who = fieldDriver(ss.field, name, driverShort(name)) || { name };
  const pic = personPic(who, 'f1', size);
  return who.id ? el('button', { class: 'face-btn', type: 'button', 'aria-label': f1Shown(name), onclick: () => ctx.openPlayer('f1', who.id, who) }, [pic]) : pic;
}
// A driver's name (or code) that opens them, as their face does.
function f1NameTap(ss, c, text, cls = '') {
  const who = fieldDriver(ss.field, c.name, driverShort(c.name));
  return who?.id ? el('button', { type: 'button', class: `link name-tap ${cls}`.trim(), text, onclick: () => ctx.openPlayer('f1', who.id, who) }) : el('span', { class: cls, text });
}
const f1Sur = c => f1Shown(c.name).split(' ').filter(w => !/^(jr|sr)\.?$/i.test(w)).at(-1) || c.tla;
const gapNum = c => (c.pos === 1 ? 0 : /^\+?\d+(\.\d+)?$/.test(c.gap || '') ? Number(String(c.gap).replace('+', '')) : null);
// Up to four cars side by side, the way one watches a fight. One table, a
// column a car (its face and name on top, a tap there takes it off): the
// place, the gap to the first of them and whether it's closing (and when it
// would meet), the tyre and its age, the stops (and the last stop's time),
// the last lap, the recent pace and the best; then the race lap by lap in
// one chart (the gap between them, each one's lap times, or the places, the
// safety car's laps shaded), every lap since the start (the proxy keeps
// them as the session runs); then the last laps side by side. The other
// drivers to pick from fold away under a button (22 faces in four rows
// before, nothing said whose).
const f1PickerOpen = new Set();
function f1LapCompare(b, ss) {
  const en = L() === 'en';
  const race = ss.abbr === 'Race' || ss.abbr === 'SR';
  const over = feedOver(b);
  const box = el('div', { 'data-laps': ss.start });
  const draw = () => {
    const { laps, places, stops, live } = lapsFor(b, ss, over, () => box.isConnected && draw());
    const cars = b.cars.filter(c => c.name);
    if (!f1Picks.has(ss.start)) f1Picks.set(ss.start, cars.slice(0, 2).map(c => c.no));
    const car = no => cars.find(c => c.no === no);
    const picks = f1Picks.get(ss.start).filter(no => car(no)).sort((x, y) => car(x).pos - car(y).pos);
    // (Never none: the last one dropped, the table went and the picker opened, the whole card jumping.)
    const setPicks = next => next.length && (f1Picks.set(ss.start, next), draw());
    const dashed = no => picks.slice(0, picks.indexOf(no)).some(o => car(o)?.colour === car(no)?.colour);
    const colourOf = no => car(no)?.colour || '#888';
    const pitsOf = no => pitLaps(laps[no] || [], stops[no] || [], car(no)?.stints || []);
    const timeOf = (no, lap) => (laps[no] || []).find(x => x[0] === lap);
    // A qualifying or a practice: each car's timed laps, the first of each
    // side by side, the second (lap numbers lined nobody up: one car's eighth
    // a flying lap, another's in the garage; Austin 2026's was all pit laps).
    const quali = /^(Qual|SS|SQ)$/.test(ss.abbr);
    const timed = race ? {} : Object.fromEntries(picks.map(no => [no, pushLaps(laps[no] || [], pitsOf(no), quali ? 1.05 : PRACTICE_SPAN, b.deleted?.[no] || [])]));

    // The picker: every car by its place, face and code, folded unless asked for (or nobody's picked).
    // (Opened by itself with nobody picked, it stays open as they're picked: it closed after the first, before.)
    if (!picks.length) f1PickerOpen.add(ss.start);
    const open = f1PickerOpen.has(ss.start);
    const picker = open
      ? el('div', { class: 'dc-picker' }, cars.map(c => el('button', {
          type: 'button', class: 'dc-pick', style: c.colour ? `--team:${c.colour}` : null, 'aria-pressed': String(picks.includes(c.no)), 'aria-label': f1Shown(c.name),
          onclick: () => {
            const now = f1Picks.get(ss.start) || [];
            setPicks(now.includes(c.no) ? now.filter(x => x !== c.no) : [...now, c.no].slice(-4));
          }
        }, [personPic(fieldDriver(ss.field, c.name, driverShort(c.name)) || { name: c.name }, 'f1', 'sm round'), el('small', { class: 'num', text: `${c.pos < 99 ? `P${c.pos} ` : ''}${c.tla || ''}` })])))
      : null;
    const toggle = el('button', { type: 'button', class: 'dc-toggle', 'aria-expanded': String(open), onclick: () => (f1PickerOpen.has(ss.start) ? f1PickerOpen.delete(ss.start) : f1PickerOpen.add(ss.start), draw()) }, [
      el('span', { text: open ? (en ? 'Done' : '完成') : en ? 'Change drivers' : '選擇車手' }),
      el('small', { class: 'num', text: `${picks.length}/4` })
    ]);
    // The track with the cars on it, live (the picked ones named; a tap on a car picks it).
    const map = over ? null : f1TrackMap(b, ss);
    if (!picks.length) return put(box, card(en ? 'Compare' : '車手比較', el('div', { class: 'lc' }, [picker, map, el('p', { class: 'muted small fs-empty', text: en ? 'Pick up to four drivers.' : '選最多 4 位車手來比較' })]), { sub: toggle }));

    // The table.
    const [a, ...rest] = picks.map(car);
    const gapNow = c => (gapNum(c) != null && gapNum(a) != null ? gapNum(c) - gapNum(a) : null);
    const gaps = Object.fromEntries(rest.map(c => [c.no, gapsBetween(laps[a.no] || [], laps[c.no] || [], { now: gapNow(c), live })]));
    const lapsLeft = b.lap?.of && b.lap?.now ? b.lap.of - b.lap.now : 0;
    const cell = (text, cls = '') => el('td', { class: `num ${cls}`.trim(), text });
    const head = el('tr', {}, [el('th', { class: 'dc-label' }), ...picks.map(no => {
      const c = car(no);
      return el('th', { class: 'dc-head', style: `--team:${colourOf(no)}` }, [
        el('span', { class: 'dc-who' }, [
          f1Face(ss, c.name, 'sm round'),
          // (Four abreast, the code: four surnames don't fit a phone.) A tap on the face or the name opens the driver; × takes them off.
          picks.length > 3 ? f1NameTap(ss, c, c.tla || f1Sur(c), 'dc-name') : fitName(f1NameTap(ss, c, f1Whole(c.name), 'dc-name'), f1Whole(c.name), f1Sur(c)),
          picks.length < 2 ? null : el('button', { type: 'button', class: 'dc-x', 'aria-label': en ? `Remove ${f1Shown(c.name)}` : `移除 ${f1Shown(c.name)}`, text: '×', onclick: () => setPicks(picks.filter(x => x !== no)) })
        ])
      ]);
    })]);
    const row = (label, cells, cls = '') => el('tr', { class: cls }, [el('th', { class: 'dc-label', text: label }), ...cells]);
    const rows = [];
    const out = c => c.retired || c.stopped;
    rows.push(row(over ? (en ? 'Finished' : '名次') : en ? 'Place' : '名次', picks.map(no => cell(out(car(no)) ? (en ? 'Out' : '退賽') : `P${car(no).pos}`, 'dc-big'))));
    if (race) {
      rows.push(row(en ? 'Gap' : '差距', picks.map((no, i) => {
        if (!i) return cell('—', 'muted');
        const g = gapNow(car(no));
        return cell(g == null ? (/L/.test(car(no).gap || '') ? car(no).gap : '—') : `+${g.toFixed(1)}`, 'dc-big');
      })));
      if (!over && rest.length) {
        // Closing (green, ▲) or losing (red, ▼) a lap, over the last five; when it would meet.
        const neutral = new Set(neutralLaps(b.control || [], b.lap?.now || 0).flatMap(p => Array.from({ length: p.to - p.from + 2 }, (_, k) => p.from + k)));
        const rates = Object.fromEntries(rest.map(c => [c.no, closingRate(gaps[c.no], new Set([...pitsOf(a.no), ...pitsOf(c.no)]), 5, neutral)]));
        rows.push(row(en ? 'A lap' : '每圈', picks.map((no, i) => {
          const r = i ? rates[no] : null;
          if (r == null) return cell(i ? '—' : '', 'muted');
          return Math.abs(r) < 0.05 ? cell(en ? 'level' : '持平', 'muted') : cell(`${r > 0 ? '▲' : '▼'}${Math.abs(r).toFixed(2)}`, r > 0 ? 'good' : 'bad');
        })));
        const meets = rest.map(c => {
          const r = rates[c.no];
          const g = gapNow(c);
          return r > 0.05 && g != null ? Math.ceil((g - 0.5) / r) : 0;
        });
        if (meets.some(Boolean)) rows.push(row(en ? 'Catches' : '追上', picks.map((no, i) => (i && meets[i - 1] ? cell(meets[i - 1] <= lapsLeft ? (en ? `~${meets[i - 1]} laps` : `約 ${meets[i - 1]} 圈`) : en ? 'after flag' : '來不及', meets[i - 1] <= lapsLeft ? 'good' : 'muted') : cell('', 'muted')))));
      } else if (over && rest.length) {
        const avgDiff = c => {
          const pits = new Set([...pitsOf(a.no), ...pitsOf(c.no)]);
          const both = (laps[c.no] || []).map(x => [x, timeOf(a.no, x[0])]).filter(([x, y]) => y && x[1] && y[1] && !pits.has(x[0]));
          return both.length >= 3 ? both.reduce((n, [x, y]) => n + (x[1] - y[1]), 0) / both.length / 1000 : null;
        };
        rows.push(row(en ? 'A lap' : '每圈', picks.map((no, i) => {
          const d = i ? avgDiff(car(no)) : null;
          return d == null ? cell(i ? '—' : '', 'muted') : cell(`${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(2)}`, d > 0 ? 'bad' : 'good');
        })));
      }
    } else if (quali && picks.some(no => car(no).parts?.some(Boolean))) {
      // Each part's time (purple the part's best, green the quickest of
      // them), then the gap where it was decided: the last part both ran (the
      // best lap alone put P4 ahead of P2, theirs in an earlier part).
      const partOf = c => [2, 1, 0].find(i => lapMs(c.parts?.[i])) ?? -1;
      const fastestIn = [0, 1, 2].map(i => Math.min(...cars.map(c => lapMs(c.parts?.[i]) || Infinity)));
      for (const i of [0, 1, 2]) {
        const ts = picks.map(no => lapMs(car(no).parts?.[i]));
        if (!ts.some(Boolean)) continue;
        const top = Math.min(...ts.filter(Boolean));
        rows.push(row(`${ss.abbr === 'Qual' ? 'Q' : 'SQ'}${i + 1}`, picks.map((no, k) => cell(ts[k] ? fmtLap(ts[k]) : '—', !ts[k] ? 'muted' : ts[k] === fastestIn[i] ? 'best' : picks.length > 1 && ts[k] === top ? 'quick' : ''))));
      }
      rows.push(row(en ? 'Gap' : '差距', picks.map((no, i) => {
        const at = Math.min(partOf(a), partOf(car(no)));
        const d = i && at >= 0 ? (lapMs(car(no).parts[at]) - lapMs(a.parts[at])) / 1000 : null;
        return cell(d == null ? (i ? '—' : '') : `${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(3)}`, 'muted');
      })));
    } else {
      rows.push(row(en ? 'Best' : '最快圈', picks.map(no => cell(car(no).best || '—', 'dc-big'))));
      rows.push(row(en ? 'Gap' : '差距', picks.map((no, i) => {
        const d = i && lapMs(car(no).best) && lapMs(a.best) ? (lapMs(car(no).best) - lapMs(a.best)) / 1000 : null;
        return cell(d == null ? (i ? '—' : '') : `+${d.toFixed(3)}`, 'muted');
      })));
    }
    if (!over) rows.push(row(en ? 'Tyre' : '輪胎', picks.map(no => {
      const c = car(no);
      return el('td', { class: 'dc-tyre' }, [el('span', {}, [tyreIcon(c.tyre), el('small', { class: 'num', text: c.tyreLaps ? `${c.tyreLaps}${en ? 'L' : '圈'}` : '' })])]);
    })));
    if (race) rows.push(row(en ? 'Stops' : '進站', picks.map(no => {
      const s = stops[no] || [];
      const n = Math.max(car(no).pits || 0, s.length);
      const lastStop = s.at(-1);
      return el('td', { class: 'num' }, [el('span', { class: 'dc-two' }, [el('span', { text: String(n) }), lastStop?.[1] ? el('small', { text: `${lastStop[1].toFixed(1)}${en ? 's' : '秒'}` }) : null])]);
    })));
    else rows.push(row(en ? 'Timed laps' : '計時圈', picks.map(no => cell(`${timed[no].length} / ${car(no).laps || 0}`))));
    const lastOf = no => (laps[no] || []).filter(x => x[1] > 0).at(-1);
    const bestOf = no => Math.min(...(laps[no] || []).filter(x => x[1] > 0).map(x => x[1]));
    const lastMs = picks.map(no => (!over && lapMs(car(no).last)) || lastOf(no)?.[1] || 0);
    const quick = Math.min(...lastMs.filter(Boolean));
    if (!over) rows.push(row(en ? 'Last lap' : '上一圈', picks.map((no, i) => cell(lastMs[i] ? fmtLap(lastMs[i]) : '—', picks.length > 1 && lastMs[i] === quick ? 'quick' : ''))));
    const paces = picks.map(no => recentPace(laps[no] || [], pitsOf(no)));
    const quickest = Math.min(...paces.filter(Boolean));
    if (race && paces.some(Boolean)) rows.push(row(over ? (en ? 'Last 5 avg' : '最後 5 圈') : en ? 'Last 5 avg' : '近 5 圈', picks.map((no, i) => cell(paces[i] ? fmtLap(paces[i]) : '—', picks.length > 1 && paces[i] === quickest ? 'quick' : ''))));
    const bests = picks.map(no => lapMs(car(no).pb?.v) || (Number.isFinite(bestOf(no)) ? bestOf(no) : 0));
    const bestest = Math.min(...bests.filter(Boolean));
    if (race) rows.push(row(en ? 'Best lap' : '最快圈', picks.map((no, i) => cell(bests[i] ? fmtLap(bests[i]) : '—', bests[i] && bests[i] === bestest ? 'best' : ''))));
    // Who is quicker where: each one's best in each sector (purple the
    // session's best, green the quickest of them), then their lap so far,
    // mini-sector by mini-sector in F1's own colours (purple the session's
    // best, green their own, yellow neither, the rest of the lap still grey).
    for (const i of [0, 1, 2]) {
      const ts = picks.map(no => lapMs(car(no).sectors?.[i]?.v));
      if (!ts.some(Boolean)) continue;
      const top = Math.min(...ts.filter(Boolean));
      rows.push(row(en ? `S${i + 1} best` : `S${i + 1} 最佳`, picks.map((no, k) => cell(ts[k] ? (ts[k] / 1000).toFixed(3) : '—', !ts[k] ? 'muted' : car(no).sectors[i].p === 1 ? 'best' : picks.length > 1 && ts[k] === top ? 'quick' : ''))));
    }
    // The best sectors put together: the lap each had in them.
    if (!race) {
      const ideal = picks.map(no => {
        const t = [0, 1, 2].map(i => lapMs(car(no).sectors?.[i]?.v));
        return t.every(Boolean) ? t.reduce((x, y) => x + y, 0) : 0;
      });
      const top = Math.min(...ideal.filter(Boolean));
      if (ideal.some(Boolean)) rows.push(row(en ? 'Ideal lap' : '理論最快', picks.map((no, k) => cell(ideal[k] ? fmtLap(ideal[k]) : '—', picks.length > 1 && ideal[k] === top ? 'quick' : ''))));
    }
    const table = el('table', { class: `dc-table n${picks.length}` }, [el('thead', {}, [head]), el('tbody', {}, rows)]);

    // The chart.
    const modes = [...(race && rest.length ? [['gap', en ? 'Gap' : '差距']] : []), ['time', en ? 'Lap times' : '圈速'], ...(race && Object.keys(places).length ? [['place', en ? 'Places' : '名次']] : [])];
    const mode = modes.some(([k]) => k === f1LapMode) ? f1LapMode : modes[0][0];
    const series = mode === 'gap'
      ? rest.map(c => ({ no: c.no, c, pts: gaps[c.no] }))
      : mode === 'place'
        ? picks.map(no => ({ no, c: car(no), pts: (places[no] || []).map((p, lap) => [lap, p]).filter(([, p]) => p > 0) }))
        : race
          ? picks.map(no => ({ no, c: car(no), pts: (laps[no] || []).filter(x => x[1] > 0).map(x => [x[0], x[1]]) }))
          : picks.map(no => ({ no, c: car(no), pts: timed[no].map((x, k) => Object.assign([k + 1, x[1]], { gone: x.gone })) }));
    const all = series.flatMap(s => s.pts);
    let chart = el('p', { class: 'muted small fs-empty', text: en ? 'Laps show here as they are run.' : '跑完的圈會出現在這裡' });
    if (all.length) {
      const W = 340, H = 190, L0 = 44, R0 = 8, T0 = 10, B0 = 20;
      const lapLo = Math.min(...all.map(p => p[0]));
      const lapHi = Math.max(lapLo + 1, ...all.map(p => p[0]));
      const X = lap => L0 + ((lap - lapLo) / (lapHi - lapLo)) * (W - L0 - R0);
      // Better is up in every view (the owner, 2026-10-11): quicker laps, a
      // smaller gap (the first of them along the top line), a higher place.
      // A lap that isn't the race's run (a stop's in- and out-lap, a lap
      // behind the safety car) doesn't set the range: one pit lap 30 s down
      // squeezed every other lap into a strip. Off the range, the line breaks there.
      // (A qualifying's or a practice's timed laps: none of that.) The
      // first lap neither, from the grid (Austin 2026's alone at the bottom).
      const neutral = race ? neutralLaps(b.control || [], b.lap?.now || lapHi) : [];
      const odd = (no, lap) => race && mode !== 'place' && ((mode === 'time' && lap === 1) || pitsOf(no).has(lap) || pitsOf(no).has(lap - 1) || neutral.some(p => lap >= p.from && lap <= p.to + 1));
      const usual = series.flatMap(sr => sr.pts.filter(p => !odd(sr.no, p[0])));
      // (The gap is one line through it all, stops and the safety car too:
      // broken there, Singapore's read as broken, the owner 2026-10-26; a
      // stop's jump is the race, its ring says why.)
      const whole = mode !== 'time' || !race;
      const ranged = whole || !usual.length ? all : usual;
      let top, bottom, label, ticks, pad = 0;
      if (mode === 'gap') {
        const vs = ranged.map(p => p[1]);
        const [lo, hi] = [Math.min(...vs), Math.max(...vs)];
        // (The first of them's line along the top only while they're near it:
        // 16 s back, the lines sat in the bottom third under an empty top.)
        pad = Math.max(0.5, (hi - lo) * 0.15);
        top = lo > 3 ? lo - pad : Math.min(0, lo);
        bottom = Math.max(top + 1, hi + pad);
        label = v => (Math.abs(v) < 0.05 ? a.tla : `${v > 0 ? '+' : ''}${v.toFixed(Math.abs(bottom - top) < 5 ? 1 : 0)}`);
        ticks = top > 0 ? [top + pad, (top + bottom) / 2, bottom - pad] : [...new Set([top, 0, (top + bottom) / 2, bottom])];
      } else if (mode === 'place') {
        top = Math.max(0.5, Math.min(...all.map(p => p[1])) - 0.5);
        bottom = Math.max(...all.map(p => p[1])) + 0.5;
        label = v => `P${Math.round(v)}`;
        const first = Math.ceil(top), last = Math.floor(bottom);
        ticks = [...new Set([first, Math.round((first + last) / 2), last])];
      } else {
        // Racing laps set the range: a pit lap or one behind the safety car
        // runs off the bottom. A qualifying's or a practice's timed laps are
        // already only its running (pushLaps): every one in (a 6% cap sat
        // Austin 2026's Friday long runs flat along the bottom).
        const best = Math.min(...ranged.map(p => p[1]));
        const cap = race ? best * 1.06 : Infinity;
        top = best - 300;
        bottom = Math.max(top + 1000, Math.min(cap, Math.max(...ranged.map(p => p[1]).filter(v => v <= cap))) + 300);
        const t = lapTicks(top, bottom);
        label = v => fmtLap(v).replace(/\.(\d)\d\d$/, t.tenths ? '.$1' : '');
        ticks = t.ticks;
      }
      const Y = v => T0 + ((Math.min(Math.max(v, top), bottom) - top) / (bottom - top)) * (H - T0 - B0);
      const inRange = v => v >= top - (bottom - top) * 0.04 && v <= bottom + (bottom - top) * 0.04;
      // Places: lines on one row side by side, a hair apart (four cars a lap at P1 and P2 read as one line).
      const nudge = k => (mode === 'place' ? (k - (series.length - 1) / 2) * 2.4 : 0);
      const shade = neutral
        .filter(p => p.to >= lapLo && p.from <= lapHi)
        .map(p => `<rect class="lc-sc ${p.kind}" x="${X(Math.max(lapLo, p.from - 0.5)).toFixed(1)}" y="${T0}" width="${Math.max(3, X(Math.min(lapHi, p.to + 0.5)) - X(Math.max(lapLo, p.from - 0.5))).toFixed(1)}" height="${H - T0 - B0}"/><text class="lc-sc-t" x="${(X(Math.max(lapLo, p.from - 0.5)) + 3).toFixed(1)}" y="${H - B0 - 4}">${p.kind === 'sc' ? 'SC' : 'VSC'}</text>`)
        .join('');
      const grid = ticks.map(v => `<line class="lc-grid${mode === 'gap' && v === 0 ? ' zero' : ''}" x1="${L0}" x2="${W - R0}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="lc-y" x="${L0 - 6}" y="${(Y(v) + 3.5).toFixed(1)}">${label(v)}</text>`).join('');
      // (A few timed laps: each one numbered.)
      const step = lapHi - lapLo <= 8 ? 1 : Math.max(1, Math.ceil((lapHi - lapLo) / 5 / 5) * 5);
      const xsLaps = [lapLo, ...Array.from({ length: 9 }, (_, k) => Math.ceil(lapLo / step) * step + k * step).filter(l => l > lapLo + step / 2 && l < lapHi - step / 2), lapHi];
      const xt = xsLaps.map(l => `<text class="lc-x" x="${X(l).toFixed(1)}" y="${H - 5}">${l}</text>`).join('');
      const lines = series.map((s, k) => {
        const col = colourOf(s.no);
        const pits = race ? pitsOf(s.no) : new Set();
        const xy = p => `${X(p[0]).toFixed(1)},${(Y(p[1]) + nudge(k)).toFixed(1)}`;
        // Runs of laps drawn as lines: on across a few laps not had (the log
        // missed them). Lap times: one line, on over a lap off the range (a
        // stop's, the safety car's: left out, its ring or shading says why;
        // broken there, Austin 2026's read as broken, the owner 2026-10-26).
        const runs = [];
        let prev = null;
        for (const p of s.pts) {
          if (!whole && (!inRange(p[1]) || odd(s.no, p[0]))) continue;
          if (prev && (p[0] - prev[0] <= 3 || mode === 'time')) runs.at(-1).push(p);
          else runs.push([p]);
          prev = p;
        }
        const d = runs.filter(r => r.length > 1).map(r => r.map((p, i) => `${i ? 'L' : 'M'}${xy(p)}`).join('')).join('');
        // A lap alone as a dot (a line through one point draws nothing).
        const lone = runs.filter(r => r.length === 1).map(([p]) => `<circle cx="${X(p[0]).toFixed(1)}" cy="${(Y(p[1]) + nudge(k)).toFixed(1)}" r="2.2" style="fill:${col}"/>`).join('');
        // A stop marked where it's drawn, or (its lap off the range) on the last lap drawn before it.
        const drawn = runs.flat();
        const dots = [...pits]
          .map(lap => drawn.find(p => p[0] === lap) || [...drawn].reverse().find(p => p[0] < lap && lap - p[0] <= 3))
          .filter(Boolean)
          .map(p => `<circle class="lc-pit" cx="${X(p[0]).toFixed(1)}" cy="${(Y(p[1]) + nudge(k)).toFixed(1)}" r="3.2" style="stroke:${col}"/>`)
          .join('');
        // (Timed laps: a ring on each one's best.)
        const pb = race ? null : s.pts.filter(p => !p.gone).reduce((x, p) => (!x || p[1] < x[1] ? p : x), null);
        const ring = pb ? `<circle class="lc-pit" cx="${X(pb[0]).toFixed(1)}" cy="${Y(pb[1]).toFixed(1)}" r="3.2" style="stroke:${col}"/>` : '';
        return `<path class="lc-line${dashed(s.no) ? ' dash' : ''}" d="${d}" style="stroke:${col}"/>${lone}${dots}${ring}`;
      }).join('');
      // A finger (or a mouse) on it reads every line at that lap, as every chart here: the chips above say each one's number, a rule and a dot on each line mark it.
      const laps = Array.from({ length: lapHi - lapLo + 1 }, (_, k) => lapLo + k);
      const xs = laps.map(l => X(l) / W);
      const valueText = v => (v == null ? '—' : mode === 'gap' ? `+${Math.max(0, v).toFixed(1)}`.replace('+-', '−') : mode === 'place' ? `P${v}` : fmtLap(v));
      const chipVal = series.map(() => el('strong', { class: 'num' }));
      const chips = el('div', { class: 'rc-chips lc-chips' }, series.map((sr, k) => el('span', { class: 'rc-chip lc-chip' }, [
        el('span', { class: 'lc-key-line', 'aria-hidden': 'true', html: `<svg viewBox="0 0 22 6"><line x1="1" y1="3" x2="21" y2="3" class="lc-line${dashed(sr.no) ? ' dash' : ''}" style="stroke:${colourOf(sr.no)}"/></svg>` }),
        f1Face(ss, sr.c.name),
        f1NameTap(ss, sr.c, picks.length > 3 ? sr.c.tla || f1Sur(sr.c) : f1Sur(sr.c)),
        chipVal[k]
      ])));
      const at = el('small', { class: 'wp-at' });
      const rule = el('span', { class: 'wp-rule', hidden: true });
      const marks = series.map(sr => el('span', { class: 'wp-dot', hidden: true, style: `background:${colourOf(sr.no)}` }));
      const show = i => {
        const lap = i == null ? null : laps[i];
        series.forEach((sr, k) => {
          // (Untouched: the latest lap of a race, each one's best of the timed laps.)
          const p = lap == null ? (race ? sr.pts.at(-1) : sr.pts.filter(q => !q.gone).reduce((x, q) => (!x || q[1] < x[1] ? q : x), null)) : sr.pts.find(x => x[0] === lap);
          chipVal[k].textContent = valueText(p?.[1]);
          marks[k].hidden = lap == null || !p || !inRange(p[1]) || odd(sr.no, p[0]);
          if (p && lap != null) Object.assign(marks[k].style, { left: `${(X(p[0]) / W) * 100}%`, top: `${((Y(p[1]) + nudge(k)) / H) * 100}%` });
        });
        const under = lap != null && neutral.find(p => lap >= p.from && lap <= p.to);
        if (!race) at.textContent = lap == null ? (en ? 'Each one\'s best' : '各自最快') : en ? `Timed lap ${lap}` : `第 ${lap} 個計時圈`;
        else at.textContent = lap == null ? `${en ? `Lap ${series[0]?.pts.at(-1)?.[0] ?? lapHi}` : `第 ${series[0]?.pts.at(-1)?.[0] ?? lapHi} 圈`}` : `${en ? `Lap ${lap}` : `第 ${lap} 圈`}${pitsAt(lap)}${under ? ` · ${under.kind === 'sc' ? (en ? 'Safety car' : '安全車') : en ? 'VSC' : '虛擬安全車'}` : ''}`;
        at.classList.toggle('on', lap != null);
        rule.hidden = lap == null;
        if (lap != null) rule.style.left = `${xs[i] * 100}%`;
      };
      // (Who stopped on that lap, said beside it.)
      const pitsAt = lap => {
        if (!race) return '';
        const who = series.filter(sr => pitsOf(sr.no).has(lap)).map(sr => sr.c.tla || f1Sur(sr.c));
        return who.length ? ` · ${who.join('、')} ${en ? 'pit' : '進站'}` : '';
      };
      const plot = scrubPlot(xs, show, [el('div', { class: 'lc-box', html: `<svg viewBox="0 0 ${W} ${H}" class="lc-svg" aria-hidden="true">${shade}${grid}${xt}${lines}</svg>` }), rule, ...marks]);
      show();
      const note = mode === 'gap' ? (top > 0 ? (en ? `Seconds behind ${f1Sur(a)}; up: closer. ○ a stop.` : `落後 ${f1Sur(a)} 秒數 · 越高越接近 · ○ 進站`) : en ? `Up: closer to ${f1Sur(a)} (the dashes). ○ a stop.` : `越高越接近 ${f1Sur(a)}（虛線）· ○ 進站`) : mode === 'place' ? (en ? 'Each lap\'s place, from the start. ○ a stop.' : '每圈名次，從起跑開始 · ○ 進站') : !race ? (en ? 'Timed laps only, the first of each side by side. Up: quicker. ○ each one\'s best.' : '只算計時圈，依各自第幾個對齊 · 越高越快 · ○ 最快圈') : en ? 'Up: quicker. ○ a stop.' : '越高越快 · ○ 進站';
      chart = el('div', { class: 'lc-chart' }, [chips, at, plot, el('p', { class: 'muted small lc-key-note', text: note })]);
    }
    const pick = modes.length > 1 ? segmented(modes, mode, v => ((f1LapMode = v), draw()), 'lc-modes') : null;

    // The last laps side by side. Live: the last 5. Over: every lap, the latest 10 first and the rest a tap away.
    // (A qualifying's or a practice's: the timed laps, the n-th of each.)
    const allNos = race
      ? [...new Set(picks.flatMap(no => (laps[no] || []).filter(x => x[1] > 0).map(x => x[0])))].sort((x, y) => y - x)
      : Array.from({ length: Math.max(0, ...picks.map(no => timed[no].length)) }, (_, k) => k + 1).reverse();
    const lapAt = (no, l) => (race ? timeOf(no, l) : timed[no][l - 1]);
    const pitAt = (no, l) => race && pitsOf(no).has(l);
    const opened = f1AllLaps.has(ss.start);
    const lapNos = over ? (opened ? allNos : allNos.slice(0, 10)) : allNos.slice(0, 5);
    const lapTable = lapNos.length
      ? el('table', { class: `dc-table dc-laps n${picks.length}` }, [
          el('thead', {}, [el('tr', {}, [el('th', { class: 'dc-label', text: race ? (en ? 'Lap' : '圈') : '#' }), ...picks.map(no => el('th', { class: 'dc-colour', style: `--team:${colourOf(no)}` }, [el('span', { class: 'dc-code' }, [f1Face(ss, car(no).name), f1NameTap(ss, car(no), car(no).tla || f1Sur(car(no)))])]))])]),
          el('tbody', {}, lapNos.map(l => {
            const ts = picks.map(no => lapAt(no, l));
            // Green: the quickest of two or more on the row (one alone beats nobody; a deleted time, struck out, never).
            const fair = ts.filter(x => x?.[1] && !x.gone);
            const best = fair.length > 1 ? Math.min(...fair.map(x => x[1])) : null;
            return el('tr', {}, [
              el('th', { class: 'dc-label num', text: String(l) }),
              ...ts.map((x, i) => cell(x?.[1] ? `${fmtLap(x[1])}${pitAt(picks[i], l) ? ' P' : ''}` : '—', [x?.[1] && !x.gone && x[1] === best ? 'quick' : '', x?.gone ? 'gone' : '', pitAt(picks[i], l) ? 'pit' : ''].filter(Boolean).join(' ')))
            ]);
          }))
        ])
      : null;
    const more = over && allNos.length > lapNos.length ? el('button', { class: 'q-btn small lc-more', type: 'button', text: race ? (en ? `All ${allNos.length} laps` : `顯示全部 ${allNos.length} 圈`) : en ? `All ${allNos.length}` : `顯示全部 ${allNos.length} 個`, onclick: () => (f1AllLaps.add(ss.start), draw()) }) : null;
    put(box, card(en ? 'Compare' : '車手比較', el('div', { class: 'lc' }, [picker, map, table, pick, chart, lapTable ? el('p', { class: 'dc-sub', text: !race ? (en ? 'Timed laps' : '計時圈') : over ? (en ? 'Lap by lap' : '每圈圈速') : en ? 'Last 5 laps' : '最近 5 圈' }) : null, lapTable, more]), { sub: toggle }));
  };
  // (Drawn again when 數據 is shown: built behind 成績, its laps came while it wasn't on the page.)
  box.__redraw = draw;
  draw();
  return box;
}

// The championship as things stand, a race or a sprint on: the table
// before it (ESPN's: the weekend's sprint in, this race not) with the
// points each car takes from its place now, drivers or teams; who moves
// up or down, the points each takes, the lead at the top. While it runs,
// and over until ESPN's own table has it in (it'd count twice after).
let f1TableView = 'drivers';
let f1TableLast = null;
const f1TableAll = new Set();
function f1LiveTable(b, ss) {
  const en = L() === 'en';
  const box = el('div', { 'data-table': ss.start });
  const over = feedOver(b);
  const draw = groups => {
    const [drivers, teams] = [groups?.[0]?.rows || [], groups?.[1]?.rows || []];
    if (!drivers.length) return put(box);
    const cars = b.cars.filter(c => c.name);
    const carOf = r => cars.find(c => fold(c.name) === fold(r.en || r.name)) || cars.find(c => surname(c.name) === surname(r.en || r.name));
    const gain = c => pointsFor(ss.abbr, c.pos, c.retired || c.stopped);
    const teamOf = name => f1Constructor(name).name;
    // Counted in the table (any race over a while): the championship just
    // after this weekend, from its own column (the tab stood empty for every
    // past race, 2026-10-26); its column not found, nothing.
    const settled = over && counted(groups[0]);
    const after = (group, key) => {
      const s = standingAfter(group, roundOf(group, b.meeting || '')?.key);
      return s && asItStands(s.map(r => ({ ...r, key: key(r), pts: r.before })), new Map(s.map(r => [key(r), r.add])));
    };
    let dRows;
    let tRows;
    if (settled) {
      dRows = after(groups[0], r => r.id);
      tRows = (groups[1] && after(groups[1], r => teamOf(r.en || r.name))) || [];
      if (!dRows) return put(box);
    } else {
      dRows = asItStands(drivers.map(r => ({ ...r, key: r.id, pts: r.stats?.PTS, rank: r.stats?.RK })), new Map(drivers.map(r => [r.id, carOf(r) ? gain(carOf(r)) : 0])));
      const tGain = new Map();
      for (const c of cars) tGain.set(teamOf(c.team), (tGain.get(teamOf(c.team)) || 0) + gain(c));
      tRows = asItStands(teams.map(r => ({ ...r, key: teamOf(r.en || r.name), pts: r.stats?.PTS, rank: r.stats?.RK })), tGain);
    }
    const view = f1TableView === 'teams' && tRows.length ? 'teams' : 'drivers';
    const list = view === 'teams' ? tRows : dRows;
    const all = f1TableAll.has(ss.start);
    const shown = all || list.length <= 12 ? list : list.slice(0, 10);
    const [first, second] = list;
    const lead = first && second ? (en ? `${view === 'teams' ? f1Constructor(first.en || first.name).name : f1Sur({ name: first.en || first.name })} leads by ${first.total - second.total}` : `${view === 'teams' ? f1Constructor(first.en || first.name).zh : f1Sur({ name: first.en || first.name })} 領先 ${first.total - second.total} 分`) : '';
    const rows = shown.map(r => {
      const moved = r.was - r.now;
      const c = view === 'drivers' ? carOf(r) : null;
      const team = view === 'teams' ? f1Constructor(r.en || r.name) : null;
      return el('li', { style: `--team:${view === 'teams' ? team.color : c?.colour || f1Driver(r.en || r.name).color || 'transparent'}` }, [
        el('span', { class: 'pos num', text: String(r.now) }),
        el('small', { class: `num st-move${moved > 0 ? ' up' : moved < 0 ? ' down' : ''}`, text: moved > 0 ? `▲${moved}` : moved < 0 ? `▼${-moved}` : '' }),
        view === 'teams'
          ? el('button', { type: 'button', class: 'fs-who link', onclick: () => openConstructor({ id: r.id || '', name: team.name, en: team.name }) }, [constructorBadge(team.name, 'xs'), el('span', { class: 'fs-name', text: en ? team.name : team.zh })])
          : el('span', { class: 'fs-who' }, [f1Face(ss, r.en || r.name), fitName(f1NameTap(ss, { name: r.en || r.name }, '', 'fs-name'), f1Whole(r.en || r.name), f1Sur({ name: r.en || r.name }))]),
        el('small', { class: `num st-add${r.add ? '' : ' none'}`, text: r.add ? `+${r.add}` : '' }),
        el('strong', { class: 'num st-total', text: String(r.total) })
      ]);
    });
    const pick = tRows.length ? segmented([['drivers', en ? 'Drivers' : '車手'], ['teams', en ? 'Teams' : '車隊']], view, v => ((f1TableView = v), draw(groups)), 'st-modes') : null;
    // (Ten teams and an eleventh: all of them, no button for one more row.)
    const more = list.length > 12 ? el('button', { class: 'q-btn small lc-more', type: 'button', text: all ? (en ? 'Top 10' : '只看前 10') : en ? `All ${list.length}` : `全部 ${list.length} ${view === 'teams' ? '隊' : '位'}`, onclick: () => (all ? f1TableAll.delete(ss.start) : f1TableAll.add(ss.start), draw(groups)) }) : null;
    const what = ss.abbr === 'SR' ? (en ? 'sprint' : '衝刺賽') : en ? 'race' : '正賽';
    const key = settled ? (en ? 'Just after this weekend. ▲▼ places moved; + its points.' : '本站結束時 · ▲▼ 名次變化 · + 本站得分') : over ? (en ? `▲▼ places moved; + points from this ${what}.` : `▲▼ 名次變化 · + 本場得分`) : en ? `If the ${what} ended now. ▲▼ places moved; + points from this ${what}.` : `假如${what}現在結束 · ▲▼ 名次變化 · + 本場得分`;
    put(box, card(over ? (en ? 'Championship' : '積分榜') : en ? 'Championship, as it stands' : '即時積分榜', el('div', { class: 'lc' }, [pick, lead ? el('p', { class: 'st-lead', text: lead }) : null, el('ol', { class: 'fs-rows st-rows' }, rows), more, el('p', { class: 'muted small lc-key-note', text: key })]), { sub: over ? null : el('span', { class: 'live-dot-text', text: en ? 'Live' : '即時' }) }));
  };
  // Over, until ESPN's table has it in (title.mjs roundCounted, the rule the
  // 賽事 table's count goes by; a race in only past a sprint's 36 points,
  // which a weekend with no sprint passes too once its race is in).
  // (Only the latest: an older race's 數據 put its points on today's table,
  // its column not found, 2026-10-12. Its round found and not yet in, and
  // the race in the last two days, or nothing.)
  const counted = group => !roundOf(group, b.meeting || '') || Date.now() - Date.parse(ss.start) > 2 * 86_400_000 || roundCounted(group, b.meeting || '', ss.abbr, true);
  // (Drawn at once from the last table: the board is drawn again every 5 seconds.)
  if (f1TableLast) draw(f1TableLast);
  standings('f1')
    .then(g => {
      const fresh = g !== f1TableLast;
      f1TableLast = g;
      if (fresh || !box.childNodes.length) draw(g);
    })
    .catch(() => {});
  return box;
}

// A practice, as the teams read one: each car's long run (its race
// simulation, lib/f1.mjs practicePace) ranked by its average lap, with the
// tyre, how many laps and how much it fell away; and the best lap each car
// set on each compound (its short runs). From each car's laps
// (lapsFor) and its stints; live, again as the laps come.
function f1PracticePace(b, ss) {
  const en = L() === 'en';
  const over = feedOver(b);
  const box = el('div', { 'data-pace': ss.start });
  const draw = () => {
    const { laps } = lapsFor(b, ss, over, () => box.isConnected && draw());
    const cars = b.cars.filter(c => c.name && c.stints?.length);
    const paced = cars.map(c => ({ c, p: practicePace(laps[c.no] || [], c.stints, b.deleted?.[c.no] || []) }));
    const runs = paced.filter(x => x.p.long).sort((x, y) => x.p.long.avg - y.p.long.avg);
    const cards = [];
    if (runs.length) {
      const top = runs[0].p.long.avg;
      cards.push(card(en ? 'Long runs' : '長距離模擬', el('ol', { class: 'fs-rows pp-rows' }, runs.map(({ c, p }, i) => {
        const r = p.long;
        return el('li', { style: c.colour ? `--team:${c.colour}` : null }, [
          el('span', { class: 'pos num', text: String(i + 1) }),
          el('span', { class: 'fs-who' }, [f1Face(ss, c.name), fitName(f1NameTap(ss, c, '', 'fs-name'), f1Whole(c.name), f1Sur(c))]),
          r.c ? tyreIcon(r.c) : el('span', { class: 'tyre none', 'aria-hidden': 'true' }),
          el('span', { class: 'pp-val' }, [el('strong', { class: 'num', text: fmtLap(r.avg) }), el('small', { class: 'num', text: [i ? `+${((r.avg - top) / 1000).toFixed(3)}` : '', `${r.laps}${en ? ' laps' : ' 圈'}`, Math.abs(r.fade) >= 30 ? `${r.fade > 0 ? '+' : '−'}${(Math.abs(r.fade) / 1000).toFixed(2)}${en ? '/lap' : '/圈'}` : ''].filter(Boolean).join(' · ') })])
        ]);
      })), { sub: en ? `average lap, ${MIN_RUN}+ laps in a row on one set` : `同一套胎連續 ${MIN_RUN} 圈以上的平均圈速` }));
    }
    // Best lap on each compound run.
    const kinds = Object.keys(TYRE).filter(k => paced.some(x => x.p.best[k]));
    if (kinds.length) {
      const fastest = Object.fromEntries(kinds.map(k => [k, Math.min(...paced.map(x => x.p.best[k]?.ms || Infinity))]));
      const rows = paced.filter(x => kinds.some(k => x.p.best[k])).sort((x, y) => Math.min(...kinds.map(k => x.p.best[k]?.ms || Infinity)) - Math.min(...kinds.map(k => y.p.best[k]?.ms || Infinity)));
      cards.push(card(en ? 'Best lap on each tyre' : '各配方最快圈', el('table', { class: 'fs-table pp-best' }, [
        el('thead', {}, [el('tr', {}, [el('th', { class: 'n' }), ...kinds.map(k => el('th', {}, [tyreIcon(k)]))])]),
        el('tbody', {}, rows.map(({ c, p }) => el('tr', { style: c.colour ? `--team:${c.colour}` : null }, [
          el('th', { class: 'n' }, [f1NameTap(ss, c, f1Sur(c))]),
          ...kinds.map(k => el('td', { class: `num${p.best[k] && p.best[k].ms === fastest[k] ? ' best' : ''}`, text: p.best[k] ? fmtLap(p.best[k].ms) : '' }))
        ])))
      ])));
    }
    put(box, ...cards);
  };
  box.__redraw = draw;
  draw();
  return box;
}

// A race on: where a stop now would put each car (its gap to the leader
// plus the time a stop costs here, under the safety car or not), the
// strategy question every lap.
function f1PitWindow(b, ss) {
  const c = circuitOf(b, ss);
  if (!c?.pitLoss?.normal) return null;
  const en = L() === 'en';
  const status = b.track?.status;
  const [loss, under] = status === '4' ? [c.pitLoss.sc, en ? 'safety car' : '安全車'] : status === '6' || status === '7' ? [c.pitLoss.vsc, en ? 'VSC' : '虛擬安全車'] : [c.pitLoss.normal, ''];
  const gapOf = car => (car.pos === 1 ? 0 : /^\+?\d+(\.\d+)?$/.test(car.gap) ? Number(String(car.gap).replace('+', '')) : null);
  const running = b.cars.filter(x => !x.retired && !x.stopped && gapOf(x) != null);
  if (running.length < 4) return null;
  const sur = car => f1Shown(car.name).split(' ').filter(w => !/^(jr|sr)\.?$/i.test(w)).at(-1) || car.tla;
  const rows = running.slice(0, 10).map(car => {
    const after = gapOf(car) + loss;
    const others = running.filter(o => o !== car).map(o => [o, gapOf(o)]).sort((x, y) => x[1] - y[1]);
    const ahead = others.filter(([, g]) => g <= after).at(-1);
    const behind = others.find(([, g]) => g > after);
    const place = 1 + others.filter(([, g]) => g <= after).length;
    // Who it'd come out beside, by name, and by how much: one line under the driver's.
    const near = behind ? [behind[0], behind[1] - after, true] : ahead ? [ahead[0], after - ahead[1], false] : null;
    const note = near ? (en ? `out ${near[1].toFixed(1)}s ${near[2] ? 'ahead of' : 'behind'} ${sur(near[0])}` : `出站在 ${sur(near[0])} ${near[2] ? '前方' : '後方'} ${near[1].toFixed(1)} 秒`) : '';
    const lost = place - car.pos;
    return el('li', { style: car.colour ? `--team:${car.colour}` : null }, [
      el('span', { class: 'pos num', text: String(car.pos) }),
      f1Face(ss, car.name),
      el('span', { class: 'pw-who' }, [fitName(f1NameTap(ss, car, '', 'pw-name'), f1Whole(car.name), sur(car)), note ? el('small', { text: note }) : null]),
      // Where it lands, and how many places that costs (a red ▼ and the count).
      el('span', { class: 'pw-to' }, [el('strong', { class: 'num', text: `P${place}` }), el('small', { class: `num${lost > 0 ? ' lose' : ''}`, text: lost > 0 ? `▼${lost}` : en ? 'same' : '不變' })])
    ]);
  });
  return card(en ? 'If they stop now' : '現在進站會掉到', el('ol', { class: 'fs-rows pw-rows' }, rows), { sub: en ? `a stop costs ~${loss.toFixed(0)}s${under ? ` (${under})` : ''}` : `進站約損失 ${loss.toFixed(0)} 秒${under ? `（${under}）` : ''}` });
}

function f1Stats(b, ss) {
  const en = L() === 'en';
  const race = ss.abbr === 'Race' || ss.abbr === 'SR';
  const quali = /^(Qual|SS|SQ)$/.test(ss.abbr);
  const prefix = ss.abbr === 'Qual' ? 'Q' : 'SQ';
  const cars = b.cars.filter(c => c.name);
  // The surname as F1 writes it (Hülkenberg, Pérez; Sainz, not "Jr.").
  const sur = c => f1Shown(c.name).split(' ').filter(w => !/^(jr|sr)\.?$/i.test(w)).at(-1) || driverShort(c.name);
  const face = c => f1Face(ss, c.name);
  const who = c => el('span', { class: 'fs-who' }, [face(c), fitName(f1NameTap(ss, c, '', 'fs-name'), f1Whole(c.name), sur(c))]);
  const teamed = c => (c.colour ? `--team:${c.colour}` : null);
  const ms = t => lapMs(t);

  // The headline numbers.
  const tiles = [];
  // (A driver's tile says the detail by its label, "最快圈 · 第 13 圈": under it the face and the name, whole.)
  const tile = (label, value, c, note = '') => tiles.push(el('div', { class: 'fs-tile', style: c ? teamed(c) : null }, [el('small', { text: c && note ? `${label} · ${note}` : label }), el('strong', { class: 'num', text: value }), c ? el('span', { class: 'fs-tile-who' }, [face(c), f1NameTap(ss, c, sur(c))]) : note ? el('span', { class: 'fs-tile-who' }, [el('small', { text: note })]) : null]));
  const lapOf = c => ms(c.pb?.v) || ms(c.best);
  const fastest = [...cars].filter(lapOf).sort((x, y) => lapOf(x) - lapOf(y))[0];
  if (fastest) tile(race ? (en ? 'Fastest lap' : '最快圈') : quali ? (en ? 'Pole lap' : '最快圈速') : en ? 'Fastest' : '最快圈速', fmtLap(lapOf(fastest)), fastest, race && fastest.pb?.lap ? (en ? `lap ${fastest.pb.lap}` : `第 ${fastest.pb.lap} 圈`) : '');
  const bestSector = i => Math.min(...cars.map(c => ms(c.sectors?.[i]?.v) || Infinity));
  const ideal = [0, 1, 2].map(bestSector).reduce((n, x) => n + x, 0);
  if (!race && Number.isFinite(ideal) && fastest) tile(en ? 'Ideal lap' : '理想圈速', fmtLap(ideal), null, en ? `${((lapOf(fastest) - ideal) / 1000).toFixed(3)}s under the best` : `比最快圈快 ${((lapOf(fastest) - ideal) / 1000).toFixed(3)} 秒`);
  const trap = [...cars].filter(c => c.speed?.v).sort((x, y) => y.speed.v - x.speed.v);
  if (trap[0]) tile(en ? 'Top speed' : '極速', `${trap[0].speed.v} km/h`, trap[0]);
  if (race) {
    const gainer = [...cars].filter(c => c.grid && !c.retired && !c.stopped).sort((x, y) => y.grid - y.pos - (x.grid - x.pos))[0];
    if (gainer && gainer.grid > gainer.pos) tile(en ? 'Most places gained' : '進步最多', `▲${gainer.grid - gainer.pos}`, gainer, `P${gainer.grid}→P${gainer.pos}`);
    const running = cars.filter(c => !c.retired && !c.stopped).length;
    tile(feedOver(b) ? (en ? 'Finished' : '完賽') : en ? 'Still running' : '仍在賽道', `${running} / ${cars.length}`, null, en ? `${cars.length - running} out` : `${cars.length - running} 位退賽`);
  } else {
    const busiest = [...cars].sort((x, y) => y.laps - x.laps)[0];
    if (busiest?.laps) tile(en ? 'Most laps' : '跑最多圈', `${busiest.laps}${en ? ' laps' : ' 圈'}`, busiest);
  }
  // Each card by name; put in their order at the end.
  const live = !feedOver(b);
  const named = {};
  const add = (k, x) => (named[k] = x);
  if (/^FP\d$/.test(ss.abbr)) add('pace', f1PracticePace(b, ss));
  // (Live, 車手比較 is the track with the cars on it: 賽道. Over, no track: with the laps.)
  add(live ? 'track' : 'compare', f1LapCompare(b, ss));
  // (Over too, until ESPN's own table has the race in.)
  if (race) add('table', f1LiveTable(b, ss));
  if (live && race) add('stop', f1PitWindow(b, ss));
  if (tiles.length) add('tiles', el('div', { class: 'fs-tiles' }, tiles));

  // A qualifying's parts.
  if (quali && cars.some(c => c.parts?.some(Boolean))) {
    const fastestIn = [0, 1, 2].map(i => Math.min(...cars.map(c => ms(c.parts?.[i]) || Infinity)));
    add('parts',
      card(
        en ? 'Each part' : '各節圈速',
        el('table', { class: 'fs-table fs-parts' }, [
          el('thead', {}, [el('tr', {}, [el('th', { class: 'pos' }), el('th', { class: 'n' }), ...[1, 2, 3].map(n => el('th', { text: `${prefix}${n}` }))])]),
          el(
            'tbody',
            {},
            cars.map(c =>
              el('tr', { style: teamed(c) }, [
                el('td', { class: 'pos num', text: String(c.pos) }),
                el('th', { class: 'n' }, [f1NameTap(ss, c, sur(c))]),
                ...[0, 1, 2].map(i => el('td', { class: `num${ms(c.parts?.[i]) && ms(c.parts[i]) === fastestIn[i] ? ' best' : ''}`, text: c.parts?.[i] || '' }))
              ])
            )
          )
        ]),
        { sub: en ? 'Purple: fastest in the part' : '紫色：該節最快' }
      )
    );
  }

  // Tyres.
  if (cars.some(c => c.stints?.length)) {
    const total = c => (c.stints || []).reduce((n, x) => n + x.laps, 0);
    const most = Math.max(1, ...cars.map(total));
    add('tyres',
      card(
        en ? 'Tyres' : '輪胎策略',
        el(
          'ol',
          { class: 'fs-rows' },
          cars.map(c =>
            el('li', { style: teamed(c) }, [
              el('span', { class: 'pos num', text: String(c.pos) }),
              who(c),
              el(
                'span',
                { class: 'fs-stints' },
                (c.stints || [])
                  .filter(x => x.laps > 0)
                  .map(x => el('i', { class: `stint ${String(x.c).toLowerCase()}${x.new ? '' : ' used'}`, style: `flex-grow:${x.laps / most}`, title: `${x.c} ${x.laps}` }, [x.laps / most >= 0.12 ? el('small', { class: 'num', text: String(x.laps) }) : null]))
                  .concat(el('i', { class: 'stint-rest', style: `flex-grow:${Math.max(0, 1 - total(c) / most)}` }))
              ),
              el('small', { class: 'num fs-end', text: race ? (en ? `${Math.max(0, (c.stints || []).length - 1)} stop${(c.stints || []).length === 2 ? '' : 's'}` : `${Math.max(0, (c.stints || []).length - 1)} 停`) : `${total(c)}${en ? ' laps' : ' 圈'}` })
            ])
          )
        ),
        { sub: el('span', { class: 'fs-key' }, Object.entries(TYRE).filter(([k]) => cars.some(c => c.stints?.some(x => x.c === k))).map(([k]) => el('span', {}, [el('i', { class: `stint ${k.toLowerCase()}` }), document.createTextNode(TYRE_NAME[k][en ? 1 : 0])]))) }
      )
    );
  }

  // A race's fastest laps.
  if (race && cars.some(c => ms(c.pb?.v))) {
    const laps = [...cars].filter(c => ms(c.pb?.v)).sort((x, y) => ms(x.pb.v) - ms(y.pb.v)).slice(0, 10);
    const top = ms(laps[0].pb.v);
    add('laps',
      card(
        en ? 'Fastest laps' : '最快圈速',
        el(
          'ol',
          { class: 'fs-rows fs-laps' },
          laps.map((c, i) =>
            el('li', { style: teamed(c) }, [
              el('span', { class: 'pos num', text: String(i + 1) }),
              who(c),
              el('small', { class: 'num fs-lapno', text: c.pb.lap ? (en ? `lap ${c.pb.lap}` : `第 ${c.pb.lap} 圈`) : '' }),
              el('span', { class: `num fs-end${i === 0 ? ' best' : ''}`, text: i === 0 ? c.pb.v : `+${((ms(c.pb.v) - top) / 1000).toFixed(3)}` })
            ])
          )
        )
      )
    );
  }

  // Sectors.
  if (cars.some(c => c.sectors?.some(x => x.v))) {
    const best = [0, 1, 2].map(bestSector);
    const own = c => (c.sectors?.length === 3 && c.sectors.every(x => ms(x.v)) ? c.sectors.reduce((n, x) => n + ms(x.v), 0) : 0);
    add('sectors',
      card(
        en ? 'Best sectors' : '最佳分段',
        el('table', { class: 'fs-table fs-sectors' }, [
          el('thead', {}, [el('tr', {}, [el('th', { class: 'n' }), el('th', { text: 'S1' }), el('th', { text: 'S2' }), el('th', { text: 'S3' }), el('th', { class: 'ideal', text: en ? 'Ideal' : '理想圈' })])]),
          el(
            'tbody',
            {},
            cars
              .filter(c => c.sectors?.some(x => x.v))
              .map(c =>
                el('tr', { style: teamed(c) }, [
                  el('th', { class: 'n' }, [f1NameTap(ss, c, sur(c))]),
                  ...[0, 1, 2].map(i => el('td', { class: `num${ms(c.sectors[i]?.v) && ms(c.sectors[i].v) === best[i] ? ' best' : ''}`, text: c.sectors[i]?.v || '' })),
                  el('td', { class: 'num ideal', text: fmtLap(own(c)) })
                ])
              )
          )
        ]),
        { sub: en ? 'Purple: fastest of all' : '紫色：全場最快' }
      )
    );
  }

  // Speed traps.
  if (trap.length) {
    const top = trap.slice(0, 10);
    const max = top[0].speed.v;
    const min = top.at(-1).speed.v - 4;
    add('speed',
      card(
        en ? 'Speed trap' : '極速',
        el(
          'ol',
          { class: 'fs-rows' },
          top.map((c, i) => el('li', { style: teamed(c) }, [el('span', { class: 'pos num', text: String(i + 1) }), who(c), el('span', { class: 'fs-speed' }, [el('i', { style: `width:${Math.round(((c.speed.v - min) / (max - min || 1)) * 100)}%` })]), el('small', { class: 'num fs-end', text: `${c.speed.v}` })]))
        ),
        // (F1's other traps, I1 and I2 mid-sector, said nothing anyone reads.)
        { sub: en ? 'km/h, on the longest straight' : 'km/h · 最長直道測速' }
      )
    );
  }
  // In the order they're read (the owner, 2026-10-11). Live: the drivers
  // picked side by side with the cars on the track, a race's stop window and
  // tyres (the strategy), the headline numbers, a qualifying's parts, the
  // race's fastest laps, the championship as it stands (context, after the
  // race itself), the sectors and the speed trap. Over: the headline numbers
  // first, then the same without the live-only cards. A practice's long runs
  // after the compare.
  const order = live
    ? ['track', 'pace', 'stop', 'parts', 'tyres', 'tiles', 'laps', 'table', 'sectors', 'speed']
    : ['tiles', 'table', 'compare', 'pace', 'parts', 'tyres', 'laps', 'sectors', 'speed'];
  // (In that order within each tab, f1Views.)
  const out = Object.fromEntries(order.map(k => [k, named[k]]).filter(([, x]) => x));
  return Object.keys(out).length ? out : null;

}
// The session's two views, 成績 (the order) and 數據 (f1Stats), the choice
// kept for the next session opened.
let f1BoardView = 'order';
// The tower's last column: the gap to the leader, or (tapped) to the car ahead; kept as the board refreshes.
let f1GapAlt = false;
// A session's views, each one thing (the owner, 2026-10-26: 數據 was a
// dozen cards down one page, hard to use): 排名 the timing tower; 賽道 車手比較
// with the cars on the track (one picking, the map and the drivers side by
// side, who's quicker where); 輪胎 the strategy (each car's stints, where a
// stop now puts it); 圈速 the laps (the headline numbers, the fastest laps,
// sectors, speed trap; 車手比較 too once over, with no track); 積分
// the championship as it would stand. A view with nothing in it isn't offered.
const F1_TABS = [
  ['order', '排名', 'Order', null],
  ['track', '賽道', 'Track', ['track']],
  ['tyres', '輪胎', 'Tyres', ['stop', 'tyres']],
  ['laps', '圈速', 'Laps', ['tiles', 'compare', 'pace', 'parts', 'laps', 'sectors', 'speed']],
  ['table', '積分', 'Points', ['table']]
];
function f1Views(order, named) {
  const en = L() === 'en';
  if (!named) return order;
  const tabs = F1_TABS.filter(([k, , , keys]) => (k === 'order' ? order : keys.some(x => named[x])));
  const nodeOf = k => (k === 'order' ? order : el('div', { class: 'stack fs-stats' }, F1_TABS.find(t => t[0] === k)[3].map(x => named[x]).filter(Boolean)));
  const now = tabs.some(([k]) => k === f1BoardView) ? f1BoardView : 'order';
  const body = el('div', {}, [nodeOf(now)]);
  const pick = segmented(tabs.map(([k, zh, eng]) => [k, en ? eng : zh]), now, v => {
    f1BoardView = v;
    const node = nodeOf(v);
    put(body, node);
    for (const n of node.querySelectorAll?.('[data-laps], [data-pace]') || []) n.__redraw?.();
  }, 'lb-views', { chips: true });
  return el('div', { class: 'f1-views' }, [pick, body]);
}
// A session that's over: the official order (a race's points and grid, a
// qualifying's parts) where it's in, else F1's archive's order, and F1's
// archive's 數據; the same for every session, practice to race.
function f1Final(rows, board, ss) {
  const order = rows?.length ? f1Field(rows, ss.field) : board ? f1LiveBoard({ ...board, final: true }, ss, { order: true }) : null;
  return order ? el('div', { class: 'f1-final' }, [f1Views(order, board ? f1Stats(board, ss) : null)]) : null;
}
function fillField(s, e) {
  // (Each session as F1's feed has it where it has said: on or over before
  // ESPN; the home's cards' rule: a session long past its start is over, ESPN's "on" or not.)
  const sessions = e.kind === 'field' ? [...(e.sessions || [])].map(x => ({ ...x, status: sessionStatus(x) })).sort((a, b) => Date.parse(a.start) - Date.parse(b.start)) : [];
  s.body.append(
    sessions.length
      ? weekendHero(e, sessions)
      : el('div', { class: 'q-card pad fx-card' }, [el('div', { class: 'sess-head field-title' }, [raceFlag(e, 'big'), sessionTag(e), el('h3', { text: e.name })]),
          // The day and time, then the place, on one line: the time always whole, a long place cut (two lines read as one wrapped).
          el('p', { class: 'muted sess-line' }, [el('span', { class: 'sess-when num', text: whenOf(e) }), e.venue ? el('span', { class: 'sess-where', text: e.venue }) : null]), weekendFollow(e), watchButton(e, 'wide')])
  );
  // A race weekend's replay and highlights go with the session picked below
  // (they're that session's); anything else's here.
  if (e.kind !== 'field') {
    const again = replayLink(e);
    if (again) s.body.append(again);
    const yt = highlights(e);
    if (yt) s.body.append(yt);
  }
  if (e.kind === 'field') {
    // The weekend's (or week's) sessions on one line, then the chosen one's order.
    let pick = e.sessionKey ? Math.max(0, sessions.findIndex(x => x.abbr === e.sessionKey)) : Math.max(0, sessions.findLastIndex(x => x.status.state !== 'pre'));
    // Its parts spaced as the sheet's (the owner, 2026-10-16: the sessions' chips sat on the card above).
    const box = el('div', { class: 'stack race-box' });
    let liveTimer = () => {};
    // F1's race: each driver's chance to win (to come, on, over), read again each minute while it runs.
    const raceBox = el('div');
    let raceAt = 0;
    const loadRace = () => {
      const ss = sessions[pick];
      const key = `${e.weekend || e.id}:${ss.id}:${ss.status.state}`;
      if (e.league !== 'f1' || ss.abbr !== 'Race') return put(raceBox);
      const kept = raceLines.get(key);
      if (kept && !raceBox.childElementCount) put(raceBox, raceChanceCard(kept, ss, keptTiming(ss.abbr, ss.start)));
      if ((kept && ss.status.state === 'post') || Date.now() - raceAt < 60_000) return;
      raceAt = Date.now();
      const at = pick;
      // Read for the first time: the card in its shape meanwhile, the real one fading in.
      const shaped = !raceBox.childElementCount;
      if (shaped) put(raceBox, card(T(ss.status.state === 'pre' ? 'winChance' : 'winProb'), el('div', { class: 'wp waiting' }, [skeleton([30, 24, 30], 'wc-skel'), el('i', { class: `skel ${ss.status.state === 'pre' ? 'rc-skel-bars' : 'wp-skel-chart'}` })])));
      // (A race on: by lap too, each lap's end counted from F1's feed and the leader's laps.)
      (ss.status.state === 'in' ? sessionLaps(ss.start, false).then(d => liveLapEnds(keptTiming(ss.abbr, ss.start), d?.cars)).catch(() => null) : Promise.resolve(null))
        .then(laps => raceWinLine(ss, laps))
        .then(l => {
          if (at !== pick || !box.isConnected) return;
          if (!l) return shaped && put(raceBox);
          raceLines.set(key, l);
          const done = raceChanceCard(l, ss, keptTiming(ss.abbr, ss.start));
          if (shaped) done.classList.add('fade-in');
          put(raceBox, done);
        })
        .catch(() => shaped && at === pick && put(raceBox));
    };
    const paint = () => {
      const ss = sessions[pick];
      raceAt = 0;
      put(raceBox);
      // F1, a session that's over: the official numbers. A race or sprint:
      // each car's team, time or retirement, points and places gained from
      // the grid; a qualifying (or the sprint's): each one's best lap, the
      // gap to pole and the part the others went out in. Read once a
      // session (a reopen draws them at once); while they come, rows in
      // their shape (never ESPN's order first and the numbers jumping in).
      const at = pick;
      const weekend = e.weekend || e.id;
      const key = `${weekend}:${ss.id}`;
      // F1's archive of the session (each car's best lap or gap, and the
      // numbers behind 數據): every session, practice to race. A slow read
      // isn't waited on past 6 seconds (the official order shows; 數據 next time).
      const archive = () =>
        Promise.race([sessionTiming(ss.start).catch(() => null), new Promise(r => setTimeout(() => r(null), 6_000))]);
      // Each official source asked at once, the best one that has them taken.
      const first = (...asks) => Promise.all(asks.map(a => a.catch(() => []))).then(lists => lists.find(rows => rows.length) || []);
      const official =
        f1Numbers.has(key) || e.league !== 'f1' || ss.status.state !== 'post'
          ? null
          : ss.abbr === 'Race' || ss.abbr === 'SR'
            ? first(raceResult(ss.start, ss.abbr === 'SR', L() === 'en'))
            : ss.abbr === 'Qual'
              ? first(qualifyingResult(ss.start), espnQualifying(weekend, ss.id, ss.field))
              : ss.abbr === 'SS' || ss.abbr === 'SQ'
                ? first(espnQualifying(weekend, ss.id, ss.field, 'SQ'))
                : /^FP\d$/.test(ss.abbr)
                  ? Promise.resolve([])
                  : null;
      // Both at once: the official order and the archive, drawn together (never the list then its 數據 jumping in).
      const numbers = official && Promise.all([official.catch(() => []), archive()]);
      // Over and its numbers still coming: its last live reading meanwhile (never an empty list or rows in their shape).
      const lastWord = numbers && keptTiming(ss.abbr, ss.start);
      const espnList = () => (ss.field.length && e.league === 'f1' ? el('ol', { class: 'field f1-field' }, ss.field.map((c, i) => f1Row({ pos: i + 1, full: c.name, field: ss.field, main: c.score || '' }))) : ss.field.length ? el('ol', { class: 'field' }, ss.field.map((c, i) => el('li', { class: ctx.isFollowed(e.league, c.id) ? 'mine' : '' }, [el('span', { class: 'pos num', text: String(i + 1) }), personPic(c, e.league, 'sm round'), personName(e.league, c), c.score ? el('small', { class: 'num', text: c.score }) : null]))) : empty(T('noField')));
      const known = f1Numbers.get(key);
      const shape = () => el('ol', { class: 'field f1-field waiting' }, Array.from({ length: Math.max(1, Math.min(ss.field.length || 10, 22)) }, () => el('li', { class: 'skel-row' }, [skeleton([70], 'skel-pos'), el('i', { class: 'skel skel-pic' }), skeleton([62, 40]), skeleton([90, 50], 'skel-right')])));
      // A session still to come with no order yet: nothing in its place (its
      // line above says when; a big 還沒有名次 box read as broken: the owner, 2026-10-23).
      const holder = el('div', { class: 'f1-holder' }, [known ? f1Final(known.rows, known.board, ss) : lastWord ? f1Final(null, { ...lastWord, final: true }, ss) : numbers ? shape() : ss.status.state === 'pre' && !ss.field.length ? null : espnList()]);
      put(
        box,
        sessions.length > 1 ? sessionLine(sessions, pick, i => i !== pick && ((pick = i), paint())) : null,
        // (A live F1 session's own card says it, and the line above says a session's hour or that it's over.)
        // The chosen session's own hour (the weekend's opened one's official start
        // said every session's: the owner, 2026-10-21).
        (e.league === 'f1' && ss.status.state === 'in') || (sessions.length > 1 && ['pre', 'post'].includes(ss.status.state) && !ss.status.void && !ss.status.delayed) ? null : el('p', { class: 'muted small', text: `${sessionName(ss, L())} · ${statusText({ ...e, start: ss.start, official: ss.start, timeTbd: ss.timeTbd, status: ss.status })}` }),
        // The picked session's whole replay and highlights, once it's over.
        ...(() => {
          const one = { ...e, id: `${weekend}~${ss.abbr}`, weekend, sessionKey: ss.abbr, session: sessionName(ss, L()), start: ss.start, official: ss.start, status: ss.status };
          return ss.status.state === 'post' ? [replayLink(one), highlights(one)].filter(Boolean) : [];
        })(),
        holder,
        raceBox
      );
      loadRace();
      const draw = (rows, board, fade) => {
        if (at !== pick || !box.isConnected) return;
        const done = f1Final(rows, board, ss);
        // (The last live reading stays where nothing better came.)
        if (!done && lastWord) return;
        const fresh = done || espnList();
        if (fade) fresh.classList.add('fade-in');
        put(holder, fresh);
      };
      numbers?.then(([rows, board]) => {
        // Kept for the session only whole: the order and the archive's 數據
        // (a practice has no official order). An archive slower than the
        // wait is still read, and drawn in place when it comes (it was kept
        // missing for good, 數據 left with the last live reading's scraps).
        if (board) {
          if (rows.length || /^FP\d$/.test(ss.abbr)) f1Numbers.set(key, { rows, board });
          return draw(rows, board, !lastWord);
        }
        draw(rows, lastWord ? { ...lastWord, final: true } : null, !lastWord);
        // (A session's first read is rebuilt from OpenF1, up to half a
        // minute: asked again, three times 15 s apart, the proxy's copy kept by then.)
        const late = (n = 3) => sessionTiming(ss.start).catch(() => null).then(x => x || (n > 1 && at === pick && box.isConnected ? new Promise(r => setTimeout(r, 15_000)).then(() => late(n - 1)) : null));
        late()
          .then(late => {
            if (!late) return;
            f1Numbers.set(key, { rows, board: late });
            draw(rows, late, false);
          })
          .catch(() => {});
      });
      // F1, a session on now: F1's own live timing, again every 5 seconds in place.
      liveTimer();
      if (e.league === 'f1' && ss.status.state === 'in') {
        // The last reading at once if there is one, else the board's shape;
        // ESPN's order comes back only if F1's feed can't be read.
        const espnOrder = box.querySelector('ol.field, .empty');
        const kept = keptTiming(ss.abbr, ss.start);
        const shape = () => el('div', { class: 'live-board' }, [skeleton([22, 30], 'lb-head-skel'), el('ol', { class: 'field f1-field lb-rows' }, Array.from({ length: 10 }, () => el('li', { class: 'skel-row' }, [skeleton([70], 'skel-pos'), el('i', { class: 'skel skel-pic' }), skeleton([62, 40]), skeleton([90, 50], 'skel-right')])))]);
        espnOrder?.replaceWith(kept ? f1LiveBoard(kept, ss) : shape());
        if (!kept) box.querySelector('.live-board')?.classList.add('waiting');
        const tick = () => {
          if (!box.isConnected || at !== pick) return liveTimer();
          if (document.visibilityState !== 'visible') return;
          loadRace();
          liveTiming(ss.abbr, ss.start)
            .then(b => {
              if (at !== pick || !box.isConnected) return;
              const now = box.querySelector('.live-board');
              if (b) {
                const board = f1LiveBoard(b, ss);
                if (now?.classList.contains('waiting')) board.classList.add('fade-in');
                return now ? now.replaceWith(board) : box.append(board);
              }
              if (now?.classList.contains('waiting') && espnOrder) now.replaceWith(espnOrder);
            })
            .catch(() => {});
        };
        tick();
        liveTimer = everyDev('f1Board', tick);
      }
    };
    paint();
    s.body.append(box);
  }
  // A race weekend (the owner, 2026-10-27: before its sessions the sheet
  // stood nearly empty): the title fight, where to watch, the circuit and
  // its weather, last year's podium there.
  if (sessions.length) s.body.append(...[e.league === 'f1' ? titleFightCard(e) : null, twCard(e.league, e), e.league === 'f1' ? circuitCard(e, sessions) : null, e.league === 'f1' ? podiumCard(e, sessions) : null].filter(Boolean));
  else s.body.append(twCard(e.league, e));
}

// A finished session's official numbers, once read (they don't change).
const f1Numbers = new Map();
// A race's chances, by weekend, session and its state.
const raceLines = new Map();

// ---- A team -------------------------------------------------------------------------------

// A team's page, the way the leagues' own apps lay it out: the hero (logo,
// name, record, place, form, follow), a strip of its key numbers, the next
// game as a card, then tabs: 賽程 (to come), 戰績 (results), 陣容 (the
// roster, ESPN's leagues) and 排名 (its part of the table). CPBL (not on
// ESPN) gets the same page from its own schedule: the record and the table
// counted from the results. A club from a league we don't cover, met in one
// of our cups (Benfica in 歐霸): only its games in our competitions (ELTA's),
// its league named, no roster (its home games, opponents and players are
// ones ELTA doesn't show, ESPN half-covers and nobody here has heard of).
// `scope`: the competition shown (Jay 2026-10-30: a club opened from 英超
// saw only 英超, yet 全部 mixed is too much when one league is wanted):
// the one it's opened from, another of its competitions, or 'all'; the
// chips under the hero switch it in the same sheet (`into`), on the same tab.
export async function openTeam(league, id, fallback = {}, { into = null, scope = league, tab = '' } = {}) {
  if (!id || !hasTeamPage(league) || fallback.guest) return;
  const s = into || sheet(leagueName(league, L()), { league });
  const content = el('div', {}, [spinner()]);
  if (into) {
    s.body.replaceChildren(content);
    // (The sheet's head names the competition shown, a tap to it.)
    const head = s.dialog.querySelector('.sheet-league');
    if (head) head.replaceWith(el('button', { class: 'sheet-league', type: 'button', onclick: () => ctx.openLeague?.(league) }, [leagueMark(league), el('span', { text: leagueName(league, L()) })]));
  } else s.body.append(content);
  ctx.track([teamKey(league, fallback.name || ''), `league:${leagueKey(league)}`].filter(k => !k.endsWith(':')), 1.5);
  const espn = Boolean(LEAGUES[league]?.espn);
  const en = L() === 'en';
  const W = (zh, eng) => (en ? eng : zh);
  try {
    // A club opened from a cup whose own league ESPN doesn't give us (Lech
    // Poznań: ESPN files it under the Europa League and has no Ekstraklasa;
    // Real Madrid's LaLiga isn't followed): that league from FotMob (Jay,
    // 2026-10-22: every club's page shows its own league).
    const infoP = espn ? team(league, id) : null;
    const homeP = espn ? homeLeague(league, id).catch(() => null) : null;
    const abroadP = espn ? Promise.all([infoP, homeP]).then(([i, h]) => (LEAGUES[league]?.cup && !(h?.key && h.key !== league && LEAGUES[h.key] && !LEAGUES[h.key].cup) ? clubAbroad(league, i) : null)).catch(() => null) : null;
    const [info, all, groups, hurt = null, home, abroad = null] = espn
      ? await Promise.all([infoP, teamSchedule(league, id).catch(() => []), hasStandings(league) ? freshStandings(league).catch(() => null) : null, leagueInjuries(league).catch(() => null), homeP, abroadP])
      : await ownTeam(league, id, fallback);
    const away = abroad?.league ? abroad : null;
    const outside = Boolean(home && !home.key && home.name);
    // Opened from a European cup: the club's own league too (義甲 第 3 名 ·
    // 4勝2和1敗), a tap to its page there (Jay, 2026-10-21); the record
    // beside the cup's place the cup's own.
    const domestic = LEAGUES[league]?.cup && home?.key && home.key !== league && LEAGUES[home.key] && !LEAGUES[home.key].cup ? home.key : abroad?.key || null;
    const domBox = domestic ? el('button', { class: 'team-domestic', type: 'button', hidden: true, onclick: () => openTeam(domestic, id, fallback) }) : null;
    if (domestic)
      freshStandings(domestic)
        .then(g => {
          const p = placeOf(g, id);
          if (!p) return;
          const st = p.row.stats;
          const wdl = [st.W, st.D, st.L].every(v => v != null && v !== '') ? W(`${st.W}勝${st.D}和${st.L}敗`, `${st.W}-${st.D}-${st.L}`) : '';
          put(domBox, leagueChip(domestic, true), el('span', { class: 'td-text', text: [W(`第 ${p.pos} 名`, `${p.pos}${['th', 'st', 'nd', 'rd'][p.pos % 10 < 4 && Math.floor(p.pos / 10) !== 1 ? p.pos % 10 : 0]}`), wdl].filter(Boolean).join(' · ') }), el('span', { class: 'td-chev', 'aria-hidden': 'true', text: '›' }));
          domBox.hidden = false;
        })
        .catch(() => {});
    // Only the competitions Orbit Sports has: a friendly or another country's
    // cup has nothing of its own here (its table, its names, its page). And
    // a club's own league from FotMob (its games no page of their own).
    const every = [...all.filter(x => !x.other && LEAGUES[x.league]), ...(away?.games || [])].sort((a, b) => a.start.localeCompare(b.start));
    // Its competitions (ours, and a club's own league from FotMob), the one shown first among them.
    const compOf = x => (x.abroad ? 'abroad' : x.league);
    const compKeys = [...new Set(every.map(compOf))];
    if (!compKeys.includes(league) && !away) compKeys.unshift(league);
    const sched = scope === 'all' ? every : every.filter(x => compOf(x) === (scope === 'abroad' ? 'abroad' : league));
    const now = Date.now();
    const played = sched.filter(x => x.status.state === 'post' && !x.status.void);
    const upcoming = sched.filter(x => x.status.state !== 'post' && !x.status.void && Date.parse(x.start) > now - 4 * 3_600_000);
    // (A club ESPN has no badge for: FotMob's, from its own league's page.)
    if (!info.logo && away?.badge) info.logo = away.badge;
    const side = { id: info.id, name: info.name, en: info.en, logo: info.logo };
    const followBtn = followButton(() => ctx.isFollowed(league, id), () => ctx.toggleFollow(league, side));
    const place = placeOf(groups, id);
    // A club in several competitions: each game says which.
    const comps = new Set(sched.map(x => x.other || x.league)).size > 1;
    const resultOf = x => resultFor(x, id);
    // Its form in the competition it's opened from, as the record and place
    // beside it are (leagueForm); 戰績 below keeps every competition. A club
    // from outside our leagues, or with under three games there yet: all of them.
    const inLeague = outside ? null : leagueForm(played, id, league);
    const formFrom = inLeague || played;
    const form = formFrom.slice(-5).filter(x => x.home && x.away).map(resultOf).filter(Boolean);
    // Games played before the table's first are preseason ones, and so is ESPN's record then: said so.
    const pre = Boolean(groups?.length) && !groups.some(tableStarted) && played.length > 0;
    // (ESPN's record is the club's league's: in a cup, the cup's own from its table, W-D-L.)
    const cupRecord = domestic && place && [place.row.stats.W, place.row.stats.D, place.row.stats.L].every(v => v != null && v !== '') ? `${place.row.stats.W}-${place.row.stats.D}-${place.row.stats.L}` : '';
    const record = [pre ? W('季前賽', 'Preseason') : '', cupRecord || (outside || domestic ? '' : info.record) || ownRecord(played.filter(x => !x.abroad), resultOf)].filter(Boolean).join(' ');
    // The numbers that matter in the sport, in one strip.
    const sport = LEAGUES[league]?.sport;
    const want = sport === 'soccer' ? ['GP', 'W', 'D', 'L', 'GD', 'P'] : ['W', 'L', 'PCT', 'GB', 'STRK'];
    const stats = place ? want.filter(k => place.row.stats[k] != null && place.row.stats[k] !== '').slice(0, 5) : [];
    const strip = place
      ? el('div', { class: 'team-strip' }, [
          el('div', { class: 'ts-cell lead' }, [el('strong', { class: 'num', text: String(place.pos) }), el('small', { text: (groups || []).length > 1 && place.group && !/20\d\d/.test(place.group) ? groupName(place.group, L()) : W('排名', 'Place') })]),
          ...stats.map(k => el('div', { class: 'ts-cell' }, [el('strong', { class: 'num', text: place.row.stats[k] }), el('small', { text: colLabel(k) })]))
        ])
      : null;
    const next = upcoming[0];
    // Its own league's place (FotMob's): 波蘭超 第 2 名 · 8勝1和1敗, a tap to that table.
    const ord = n => `${n}${['th', 'st', 'nd', 'rd'][n % 10 < 4 && Math.floor(n / 10) !== 1 ? n % 10 : 0]}`;
    const awayBox = away?.place
      ? (() => {
          const st = away.place.row.stats;
          const wdl = [st.W, st.D, st.L].every(v => v != null && v !== '') ? W(`${st.W}勝${st.D}和${st.L}敗`, `${st.W}-${st.D}-${st.L}`) : '';
          const chip = el('span', { class: 'league-tag' }, [el('span', { class: 'league-badge lg-mark' }, [logoPicture(away.league.logo, away.league.dark, 'league-img', () => null)]), el('span', { text: away.league.name })]);
          return el('button', { class: 'team-domestic', type: 'button', onclick: () => ((view = 'table'), paint(), body.scrollIntoView({ behavior: 'smooth', block: 'start' })) }, [chip, el('span', { class: 'td-text', text: [W(`第 ${away.place.pos} 名`, ord(away.place.pos)), wdl].filter(Boolean).join(' · ') }), el('span', { class: 'td-chev', 'aria-hidden': 'true', text: '›' })]);
        })()
      : null;
    // One competition or all of them (a club in 英超 and 歐冠, the FA Cup):
    // chips when it plays in more than one of ours; a tap draws the page for that one.
    const compName = k => (k === 'abroad' ? away?.league?.name || '' : leagueName(k, L()));
    const compChips = compKeys.length > 1 ? [...compKeys.map(k => [k, compName(k)]), ['all', W('全部', 'All')]] : [];
    const compBox = compChips.length
      ? el('div', { class: 'team-comps' }, [
          segmented(compChips, scope === 'all' ? 'all' : scope === 'abroad' ? 'abroad' : league, k => {
            if (k === 'abroad') return openTeam(league, id, fallback, { into: s, scope: 'abroad', tab: view });
            openTeam(k === 'all' ? league : k, id, fallback, { into: s, scope: k === 'all' ? 'all' : k, tab: view });
          }, 'scroll stage-filter', { chips: true })
        ])
      : null;
    const tabsBox = el('div');
    const body = el('div', { class: 'team-tab' });
    swipeTabs(body, () => ({ list: views.map(v => v[0]), now: view, go: k => ((view = k), paint()) }));
    // The same tabs, in the same order, on every team, player, league and
    // game (Jay 2026-10-30, "information is here and there"): 概況 the
    // glance, 賽程 every game (to come, then results), 數據 the numbers
    // (the team's own ranked in its league, then 隊內排行), 陣容, 排名.
    const leaders = (!outside || away) && hasLeaders(sport, LEAGUES[league]?.espn);
    const ranksOn = espn && !outside && !away && ['basketball', 'baseball', 'soccer'].includes(sport);
    const views = [['overview', W('概況', 'Overview')], ['games', W('賽程', 'Games')]];
    if (leaders || ranksOn) views.push(['stats', W('數據', 'Stats')]);
    if (espn && !outside) views.push(['roster', W('陣容', 'Roster')]);
    if (place || away?.place) views.push(['table', W('排名', 'Table')]);
    let view = views.some(v => v[0] === tab) ? tab : 'overview';
    let rosterList = null;
    let leadersData = leaders ? undefined : null;
    let ranksData = ranksOn ? undefined : null;
    let teamPick = null;
    let shownResults = 10;
    let allTables = null;
    if (leaders)
      teamLeaders(league, id, { name: info.en || info.name, en: info.en, short: info.enShort })
        .then(d => (leadersData = d))
        .catch(() => (leadersData = null))
        .then(() => (view === 'overview' || view === 'stats') && paint());
    if (ranksOn)
      teamStatRanks(league, id, { name: info.en || info.name, en: info.en, short: info.enShort })
        .then(d => (ranksData = d))
        .catch(() => (ranksData = null))
        .then(() => (view === 'overview' || view === 'stats') && paint());
    // A game in a list as every list draws it: the result's row (its date, the other side, the score), a tap opens it.
    const mixed = new Set(played.map(g => g.other || g.league)).size > 1;
    const resultRow = x => {
      const r = resultOf(x);
      const them = x.home.id === String(id) ? x.away : x.home;
      const at = x.home.id === String(id) ? 'vs' : '@';
      const score = x.home.id === String(id) ? `${x.home.score}-${x.away.score}` : `${x.away.score}-${x.home.score}`;
      return el(x.abroad ? 'div' : 'button', x.abroad ? { class: 'res-row abroad' } : { class: 'res-row', type: 'button', disabled: x.status?.void ? true : null, onclick: () => ctx.openEvent(x) }, [
        el('span', { class: 'res-date num', text: localDate(Date.parse(x.start)).slice(5).replace('-', '/') }),
        el('span', { class: 'res-opp' }, [el('small', { class: 'muted', text: at }), logo(them.logo, them.name, 'xs'), el('span', { class: 'res-name' }, [el('span', { text: them.short || them.name }), mixed ? el('small', { class: 'res-comp', text: x.other ? otherName(x.other, en) : leagueName(x.league, L()) }) : null])]),
        el('span', { class: `result-pill ${r === 'W' ? 'w' : r === 'L' ? 'l' : 'd'}`, text: `${en ? r : { W: '勝', L: '敗', D: '和' }[r]} ${score}` })
      ]);
    };
    const block = (head, node) => el('div', { class: 'team-next' }, [el('p', { class: 'mini-h', text: head }), node]);
    // The season in its splits, counted from its games in this competition: home, away, the last ten, scored and let in a game.
    const splitCard = () => {
      // (Every game of it this season, not the hero's last five.)
      const list = (inLeague ? played.filter(x => x.league === league) : played).filter(x => x.home && x.away && !x.abroad && x.home.score !== '' && x.away.score !== '');
      if (list.length < 3) return null;
      const mine = x => (x.home.id === String(id) ? x.home : x.away);
      const theirs = x => (x.home.id === String(id) ? x.away : x.home);
      const at = (k, f) => ownRecord(list.filter(f), resultOf) || '0-0';
      const avg = f => (list.reduce((n, x) => n + Number(f(x).score || 0), 0) / list.length).toFixed(sport === 'soccer' ? 2 : 1);
      const scored = { soccer: W('場均進球', 'Scored a game'), baseball: W('場均得分', 'Runs a game'), basketball: W('場均得分', 'Points a game') }[sport] || W('場均得分', 'Scored a game');
      const let_ = { soccer: W('場均失球', 'Conceded a game'), baseball: W('場均失分', 'Runs allowed'), basketball: W('場均失分', 'Points allowed') }[sport] || W('場均失分', 'Allowed a game');
      const last = list.slice(-10);
      return card(
        W('本季戰績', 'This season'),
        el('div', { class: 'stat-grid' }, [
          tile(W('主場', 'Home'), at('h', x => x.home.id === String(id))),
          tile(W('客場', 'Away'), at('a', x => x.away.id === String(id))),
          list.length > 10 ? tile(W('近 10 場', 'Last 10'), ownRecord(last, resultOf)) : null,
          tile(scored, avg(mine)),
          tile(let_, avg(theirs))
        ].filter(Boolean)),
        { sub: formFrom === inLeague ? leagueName(league, L()) : '' }
      );
    };
    // Where it stands among the league's teams, its best places first (a
    // player's 聯盟排名, the same card); a tap to 數據 for every one.
    const ranksCard = (all = false) => {
      if (!ranksData?.ranks.length) return null;
      const list = all ? ranksData.ranks : [...ranksData.ranks].sort((a, b) => a.rank - b.rank).slice(0, 6);
      const of = Math.max(...ranksData.ranks.map(r => r.of));
      return card(
        all ? W('球隊數據', 'Team stats') : W('聯盟排名', 'League ranks'),
        el('div', {}, [
          el('div', { class: `stat-grid${all ? ' dense' : ''}` }, list.map(r => tile(en ? r.stat.en : r.stat.zh, r.value, W(`第 ${r.rank} 名`, `#${r.rank}`)))),
          all ? null : el('button', { class: 'section-more lb-more', type: 'button', onclick: () => ((view = 'stats'), paint()), text: W('全部球隊數據 ›', 'All team stats ›') })
        ]),
        { sub: [all ? leadersSeason(ranksData.data, sport, en) : '', W(`共 ${of} 隊`, `of ${of}`)].filter(Boolean).join(' · ') }
      );
    };
    const paint = () => {
      put(tabsBox, segmented(views, view, v => ((view = v), paint()), '', { seg: true }));
      if (view === 'overview') {
        const last = [...played].reverse().find(x => !x.abroad);
        const parts = [
          next ? block(W('下一場', 'Next game'), el('div', { class: 'q-card list' }, [eventRow(next, { league: comps })])) : null,
          last ? block(W('上一場', 'Last game'), el('div', { class: 'q-card list results-list' }, [resultRow(last)])) : null,
          teamInjuryCard(hurt?.[id], league),
          splitCard(),
          ranksCard(),
          leadersData?.stats.length ? teamLeadersCard(leadersData, league) : null
        ].filter(Boolean);
        put(body, ...(parts.length ? parts : [empty(W('本季還沒有比賽。', 'No games yet this season.'))]));
      }
      if (view === 'games') {
        const results = [...played].reverse();
        const more = results.length > shownResults ? el('button', { class: 'section-more lb-more', type: 'button', onclick: () => ((shownResults += 10), paint()), text: W(`再看 ${Math.min(10, results.length - shownResults)} 場`, `Show ${Math.min(10, results.length - shownResults)} more`) }) : null;
        put(
          body,
          ...(upcoming.length || results.length
            ? [
                upcoming.length ? block(W('接下來', 'Coming up'), el('div', { class: 'q-card list' }, upcoming.slice(0, 15).map(x => eventRow(x, { league: comps })))) : null,
                results.length ? block(W('已結束', 'Results'), el('div', {}, [el('div', { class: 'q-card list results-list' }, results.slice(0, shownResults).map(resultRow)), more])) : null
              ].filter(Boolean)
            : [empty(W('本季還沒有賽程。', 'Nothing scheduled this season yet.'))])
        );
      }
      if (view === 'roster') {
        if (!rosterList) {
          put(body, spinner());
          roster(league, id, info.home)
            .then(list => ((rosterList = list), view === 'roster' && paint()))
            .catch(() => put(body, empty(T('failed'))));
          return;
        }
        put(
          body,
          byPosition(rosterList, sport).map(g =>
            el('div', { class: 'q-card pad fx-card' }, [
              g.name ? el('p', { class: 'mini-h', text: g.name }) : null,
              squadList(g.players, league, sport, p => [posZh(p.pos, sport, L()), p.age ? (en ? `${p.age}` : `${p.age} 歲`) : ''].filter(Boolean).join(' · '), { hurt: true })
            ])
          )
        );
      }
      if (view === 'stats') {
        if (leadersData === undefined && ranksData === undefined) return put(body, spinner());
        // The team's own numbers, each ranked among the league's; then each stat's leader and the team's own list of it (隊內排行).
        const ranked = leadersData?.stats.some(st => st.list.length > 1);
        const parts = [
          ranksCard(true),
          ranksData === undefined ? spinner() : null,
          leadersData?.stats.length ? teamLeadersCard(leadersData, league) : null,
          ranked ? el('div', { class: 'lb-team' }, [el('p', { class: 'mini-h lb-head', text: W('隊內排行', 'Within the team') }), leagueLeadersView({ ...leadersData, stats: leadersData.stats.filter(st => st.list.length > 1) }, league, { pick: teamPick, onPick: k => ((teamPick = k), paint()) })]) : null,
          leadersData === undefined ? spinner() : null
        ].filter(Boolean);
        put(body, ...(parts.length ? parts : [empty(W('本季還沒有數據。', 'No numbers yet this season.'))]));
      }
      if (view === 'table' && scope === 'all' && compKeys.length > 1) {
        // Every competition's table it's in, this one first (a cup without a table, the FA Cup's: none).
        if (!allTables) {
          allTables = Promise.all(compKeys.filter(k => k !== 'abroad' && hasStandings(k)).map(k => (k === league ? Promise.resolve(groups) : freshStandings(k).catch(() => null)).then(g => [k, g])));
          allTables.then(list => ((allTables = list), view === 'table' && paint()));
        }
        if (allTables instanceof Promise) return put(body, spinner());
        const parts = allTables.flatMap(([k, gs]) => {
          const g = (gs || []).find(x => x.rows.some(r => r.id === String(id)));
          return g ? [standingsTables([{ ...g, name: [leagueName(k, L()), (gs.length > 1 && g.name) || ''].filter(Boolean).join(' · ') }], k, { mark: [String(id)], compact: true })] : [];
        });
        const home = away?.place ? standingsTables([{ ...away.group, name: away.league.name }], league, { mark: [String(id)], compact: true, open: false }) : null;
        return put(body, parts.length || home ? el('div', { class: 'stack' }, [home, ...parts]) : empty(T('noStandings')));
      }
      if (view === 'table') {
        const g = (groups || []).find(x => x.rows.some(r => r.id === String(id)));
        // Its own league's table first (FotMob's: its rows open nothing), then the cup's.
        const home = away?.place ? standingsTables([{ ...away.group, name: away.league.name }], league, { mark: [String(id)], compact: true, open: false }) : null;
        put(body, home || g ? el('div', { class: 'stack' }, [home, g ? standingsTables([home ? { ...g, name: g.name || leagueName(league, L()) } : g], league, { mark: [String(id)], compact: true }) : null]) : empty(T('noStandings')));
      }
    };
    put(
      content,
      el('div', { class: `team-hero${info.color ? ' tinted' : ''}`, style: info.color ? `--hero:${info.color}` : null }, [
        logo(info.logo, info.name, 'xl'),
        el('div', { class: 'team-hero-text' }, [
          el('h3', { text: info.name }),
          info.en && info.en !== info.name ? el('small', { class: 'muted', text: info.en }) : null,
          outside && !away ? el('small', { class: 'muted team-home' }, [zhLater(home.name, 'en')]) : null,
          el('p', { class: 'team-hero-sub' }, joinNodes([record, place ? el('span', { class: 'nowrap', text: W(`${leagueName(league, L())}${groups.length > 1 && place.group ? ` ${groupName(place.group, 'zh')} · ` : ''}第 ${place.pos} 名`, `${place.pos}${['th', 'st', 'nd', 'rd'][place.pos % 10 < 4 && Math.floor(place.pos / 10) !== 1 ? place.pos % 10 : 0]} in ${groups.length > 1 && place.group ? groupName(place.group, 'en') : `the ${leagueName(league, L())}`}`) }) : !groups || groups.some(tableStarted) ? standingZh(info.standing, L()) : ''].filter(Boolean), ' · ')),
          domBox,
          awayBox,
          form.length ? el('div', { class: 'hero-form', 'aria-label': formFrom === inLeague ? W(`${leagueName(league, L())}近 ${form.length} 場`, `Last ${form.length} in the ${leagueName(league, L())}`) : W(`近 ${form.length} 場`, `Last ${form.length}`) }, [resultPills(form)]) : null
        ]),
        followBtn
      ]),
      strip,
      compBox,
      tabsBox,
      body
    );
    paint();
  } catch {
    put(content, empty(T('failed')));
  }
}
// 數據領先 of a team or a league (lib/leaders.mjs), the regular season's.
// A team's: each stat's leader, two to a row, as a game's sheet has them
// (one flow: the same faces, the same taps). A league's (`teamOf`: a team
// by id, from its table): one stat at a time (its chips), the top ten, each
// with his team.
const leaderLabel = (st, sport, en) => (st.perGame ? (en ? `${st.en} per game` : `場均${st.zh}`) : st.per90 ? (en ? `${st.en} /90` : `${st.zh}（每90分）`) : en ? st.en : st.zh);
const leadersSeason = (data, sport, en) => (data?.season?.name ? `${data.season.name}${sport === 'soccer' || sport === 'racing' ? '' : en ? ' regular season' : ' 例行賽'}` : '');
// A footballer from FotMob has no ESPN id: found by his name in ESPN's
// search (the one in this league, else the first footballer), then opened.
const openLeader = async (league, x) => {
  if (x.id) return ctx.openPlayer(league, x.id, { name: x.full || x.name, logo: x.headshot });
  const found = await proxyJson(`https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(x.full || x.name)}&limit=12`, { ttl: 24 * 3_600_000 })
    .then(parseSearch)
    .catch(() => null);
  const p = found?.players.find(y => y.league === league) || found?.players.find(y => LEAGUES[y.league]?.sport === 'soccer') || found?.players[0];
  // (Under the league he was opened from: ESPN's search places a player by
  // his last competition, a Nations League in an international break.)
  if (p) ctx.openPlayer(league, p.id, { name: x.full || x.name, logo: x.headshot });
};
export function teamLeadersCard(data, league) {
  const sport = LEAGUES[league]?.sport;
  const en = L() === 'en';
  return card(
    T('leaders'),
    el(
      'div',
      { class: 'leader-cols' },
      data.stats.map(st => {
        const x = st.list[0];
        return el('button', { class: 'leader', type: 'button', onclick: () => openLeader(league, x) }, [personPic({ ...x, name: x.full || x.name }, league, 'sm round'), el('span', { class: 'leader-text' }, [fitLine(el('small', { class: 'one-line', text: leaderLabel(st, sport, en) })), el('span', {}, [fitLine(el('strong', { class: 'one-line' }, [playerName(x.full || x.name, 'full', x.name)])), el('b', { class: 'num', text: x.value })])])]);
      })
    ),
    { sub: leadersSeason(data, sport, en) }
  );
}
// (The first 25, then 25 more a tap, to the hundred.)
const LB_STEP = 25;
export function leagueLeadersView(data, league, { teamOf = () => null, pick = null, onPick = () => {}, full = null } = {}) {
  const sport = LEAGUES[league]?.sport;
  const en = L() === 'en';
  const chosen = data.stats.find(x => x.key === pick) || data.stats[0];
  // (A football stat's whole list once read; its page's top three until then.)
  const st = full?.length ? { ...chosen, list: full } : chosen;
  const chips = data.stats.length > 1 ? segmented(data.stats.map(x => [x.key, en ? x.en : x.zh]), st.key, onPick, 'scroll stage-filter') : null;
  // (Level on the number, level in the list: four on 3 assists are all 2nd.)
  const list = st.list;
  const rankOf = i => list.findIndex(y => y.value === list[i].value) + 1;
  const row = (x, i) => {
    const t = teamOf(x.team, x);
    return el('button', { class: 'lb-row', type: 'button', onclick: () => openLeader(league, x) }, [
      el('span', { class: 'lb-rank num', text: String(rankOf(i)) }),
      personPic({ ...x, name: x.full || x.name }, league, 'sm round'),
      el('span', { class: 'lb-name' }, [fitName(el('strong', { class: 'one-line' }), x.full || x.name, x.full && x.name !== x.full ? x.name : shortWords(x.full || x.name)), t ? fitLine(el('small', { class: 'one-line' }, [teamTag(t, t.short || t.name, league, { tap: false })])) : x.teamName ? fitLine(el('small', { class: 'one-line', text: !en && x.teamZh ? x.teamZh : x.teamName })) : null]),
      el('b', { class: 'lb-value num', text: x.value })
    ]);
  };
  const box = el('div', { class: 'lb-list' }, list.slice(0, LB_STEP).map(row));
  let shown = Math.min(LB_STEP, list.length);
  const more = el('button', { class: 'section-more lb-more', type: 'button' });
  const label = () => {
    more.textContent = en ? `Show ${Math.min(LB_STEP, list.length - shown)} more` : `再看 ${Math.min(LB_STEP, list.length - shown)} 位`;
    more.hidden = shown >= list.length;
  };
  more.onclick = () => {
    box.append(...list.slice(shown, shown + LB_STEP).map((x, j) => row(x, shown + j)));
    shown = Math.min(list.length, shown + LB_STEP);
    label();
  };
  label();
  const sub = [leadersSeason(data, sport, en), list.length > 10 ? (en ? `top ${list.length}` : `前 ${list.length} 名`) : ''].filter(Boolean).join(' · ');
  return el('div', {}, [chips, card(leaderLabel(st, sport, en), el('div', {}, [box, more]), { sub })]);
}

// A league's teams by one of their own numbers (lib/teamstats.mjs), as its
// players' are drawn: the stat's chips, then every team in its order, its
// place, logo and name; a tap opens its page. `teamOf(x)` the table's row
// for a team (its Chinese name, its id: a FotMob club matched by name).
export function teamStatsView(data, league, { teamOf = () => null, pick = null, onPick = () => {}, full = null } = {}) {
  const en = L() === 'en';
  const chosen = data.stats.find(x => x.key === pick) || data.stats[0];
  const list = full?.length ? full : chosen.list;
  const chips = data.stats.length > 1 ? segmented(data.stats.map(x => [x.key, en ? x.en : x.zh]), chosen.key, onPick, 'scroll stage-filter') : null;
  const row = x => {
    const t = teamOf(x) || (x.id ? { id: x.id, name: x.name, short: x.short, logo: x.logo } : null);
    const name = t?.short || t?.name || x.short || x.name;
    const kids = [el('span', { class: 'lb-rank num', text: String(x.rank) }), logo(t?.logo || x.logo, name, 'sm'), el('span', { class: 'lb-name' }, [fitLine(el('strong', { class: 'one-line', text: name }))]), el('b', { class: 'lb-value num', text: x.value })];
    return t?.id && hasTeamPage(league) ? el('button', { class: 'lb-row', type: 'button', onclick: () => ctx.openTeam(league, String(t.id), t) }, kids) : el('div', { class: 'lb-row' }, kids);
  };
  const sub = [data.season?.name ? `${data.season.name}${LEAGUES[league]?.sport === 'soccer' ? '' : en ? ' regular season' : ' 例行賽'}` : '', chosen.low ? (en ? 'lower is better' : '越低越好') : ''].filter(Boolean).join(' · ');
  return el('div', {}, [chips, card(en ? chosen.en : chosen.zh, el('div', { class: 'lb-list' }, list.map(row)), { sub })]);
}

// "8-4-2" from a list of results (wins, draws, losses; no draws: "8-4").
function ownRecord(played, resultOf) {
  const n = { W: 0, D: 0, L: 0 };
  for (const x of played) if (x.home && x.away) n[resultOf(x)]++;
  return n.W + n.D + n.L ? (n.D ? `${n.W}-${n.D}-${n.L}` : `${n.W}-${n.L}`) : '';
}
// A team of a league ESPN doesn't cover (CPBL), from the league's own
// season: [info, its games, a table counted from every result].
async function ownTeam(league, id, fallback) {
  const events = (await seasonEvents(league).catch(() => [])).filter(e => e.kind === 'match' && e.home && e.away);
  const mine = events.filter(e => e.home.id === String(id) || e.away.id === String(id)).sort((a, b) => a.start.localeCompare(b.start));
  const me = mine.map(e => (e.home.id === String(id) ? e.home : e.away))[0] || fallback;
  const table = new Map();
  for (const e of events) {
    if (e.status.state !== 'post' || e.status.void) continue;
    const h = Number(e.home.score);
    const a = Number(e.away.score);
    if (!Number.isFinite(h) || !Number.isFinite(a)) continue;
    for (const [x, mine, theirs] of [[e.home, h, a], [e.away, a, h]]) {
      const row = table.get(x.id) || { id: x.id, name: x.name, short: x.short, en: x.en, logo: x.logo, W: 0, L: 0 };
      // A tie (called for the night) counts for neither.
      if (mine !== theirs) row[mine > theirs ? 'W' : 'L']++;
      table.set(x.id, row);
    }
  }
  const rows = [...table.values()]
    .map(r => {
      const pct = r.W + r.L ? r.W / (r.W + r.L) : 0;
      return { id: r.id, name: r.name, short: r.short, en: r.en, logo: r.logo, stats: { W: String(r.W), L: String(r.L), PCT: pctText(r.W, r.L) }, key: pct };
    })
    .sort((x, y) => y.key - x.key);
  if (rows.length) {
    const top = rows[0];
    for (const r of rows) r.stats.GB = gbText({ w: Number(top.stats.W), l: Number(top.stats.L) }, { w: Number(r.stats.W), l: Number(r.stats.L) });
  }
  // The league's own table where there's one (CPBL's), the count otherwise.
  const own = hasStandings(league) ? await standings(league).catch(() => null) : null;
  const groups = own?.length ? own : rows.length ? [{ name: leagueName(league, L()), rows }] : null;
  return [{ id: String(id), name: me.name || fallback.name, en: me.en || fallback.en, logo: me.logo || fallback.logo, record: '' }, mine, groups];
}
// A squad in groups: ESPN's own (MLB's pitchers, catchers…) named in the
// reader's language, else by position (門將, 後衛, 中場, 前鋒).
const ROSTER_GROUP = { pitchers: '投手', catchers: '捕手', infielders: '內野手', outfielders: '外野手', 'designated hitter': '指定打擊', injured: '傷兵' };
// A squad's rows: number, face and name (a tap opens the player), and a note
// at the right (`note`: position, age, an injury). `hurt`: 🩹 by a hurt name.
// (`bare`: a list on its own, none with a number (先發陣容's pitcher before the order's out): no empty number column pushing the rows in.)
function squadList(ps, league, sport, note, { hurt = false, bare = false } = {}) {
  return el('ul', { class: `roster-list${bare && !ps.some(p => p.jersey) ? ' no-num' : ''}` }, ps.map(p => el('li', {}, [el('span', { class: 'jersey num', text: p.jersey }), el('button', { class: 'link roster-name', type: 'button', disabled: p.id ? null : true, onclick: () => p.id && ctx.openPlayer(league, p.id, { name: p.name, logo: p.headshot }) }, [p.tbd ? el('span', { class: 'logo xs round empty-face', 'aria-hidden': 'true' }) : personPic(p, league, 'xs round'), fitLine(el('span', { class: p.tbd ? 'muted' : null }, [playerName(p.full || p.name, 'full', p.name)])), hurt && p.injured ? el('span', { class: 'inj-dot', title: T('injuries'), text: '🩹' }) : null]), el('small', {}, [].concat(note(p) ?? ''))])));
}
// A position's place in a squad read by position: basketball's guards to
// centres, soccer's keeper to forwards (each group in that order).
const POS_ORDER = { basketball: ['PG', 'G', 'SG', 'G-F', 'SF', 'F', 'F-G', 'PF', 'F-C', 'C-F', 'C'], soccer: ['G', 'D', 'M', 'F'] };
const posRank = (pos, sport) => {
  const list = POS_ORDER[sport] || [];
  const at = list.indexOf(sport === 'soccer' ? String(pos || '').slice(0, 1).toUpperCase() : pos);
  return at < 0 ? list.length : at;
};
// One side's 陣容, the same card in every sport: the side's name (its
// formation where it has one), then each group under its heading in the
// order given (an empty one left out); players as squadList's rows, the
// hurt and those who sat out as the injury report's (status, what, back).
function sideSquad(head, groups, league, sport) {
  const parts = groups.filter(g => g.list?.length).flatMap(g => [g.name ? el('p', { class: 'mini-h', text: g.name }) : null, g.out ? el('div', { class: 'inj-report' }, g.list.map(x => injuryLine(x, league, { lead: true }))) : squadList(g.list, league, sport, g.note || (() => ''))]);
  return parts.length ? card(head, el('div', {}, parts)) : null;
}
function byPosition(list, sport) {
  const zh = L() !== 'en';
  if (list.length > 1 || list[0]?.name) return list.map(g => ({ ...g, name: zh ? ROSTER_GROUP[String(g.name).toLowerCase()] || g.name : g.name }));
  const players = list[0]?.players || [];
  if (!players.some(p => p.pos)) return list;
  const groups = new Map();
  for (const p of players) {
    const k = posZh(p.pos, sport, L()) || '';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  return groups.size > 1 ? [...groups].map(([name, ps]) => ({ name, players: ps })) : list;
}
// A table column's short name in the reader's language.
const COL_ZH = { PD: '得失分', POD: '頒獎台', GP: '場', W: '勝', D: '和', L: '敗', GD: '淨勝', P: '積分', PTS: '積分', PCT: '勝率', GB: '勝差', STRK: '連勝敗', GAP: '落後' };
const colLabel = c => (L() === 'en' ? (c === 'GAP' ? T('col_GAP') : c) : COL_ZH[c] || c);
// ESPN's rank under a number ("Tied-42nd", "3rd"), in Chinese: 並列第 42、第 3.
const rankText = (sub, en = L() === 'en') => {
  const m = /^(Tied-)?(\d+)(st|nd|rd|th)$/i.exec(String(sub || '').trim());
  return !m || en ? sub : `${m[1] ? '並列' : ''}第 ${m[2]}`;
};
const tile = (label, value, sub = '') => el('div', { class: 'stat-tile' }, [el('small', { text: label }), el('strong', { class: 'num', text: value }), sub ? el('small', { class: 'muted', text: rankText(sub) }) : null]);

// Form in pills (W, D, L), oldest first.
const resultPills = list => el('div', { class: 'form-pills' }, list.map(r => el('span', { class: `pill ${r}`, text: L() === 'en' ? r : { W: '勝', D: '和', L: '敗' }[r] || r })));

// ---- A player -----------------------------------------------------------------------------

// Individual sports (races, tours, fights): the person is followed like a team.
const individual = league => LEAGUES[league]?.kind !== 'match';
const LOG_WORDS = { Started: '先發', Sub: '替補', Substitute: '替補', 'Did not play': '未上場', DNP: '未上場' };
// A game in a player's log, as a card: three or four numbers big (the ones
// a line is read by), a few more in a line under them that wraps, never a
// table to scroll sideways. By the log's columns: a batter's (AB), a
// pitcher's (IP), else the sport's; a log of other columns, its first ones.
const LOG_PICKS = {
  basketball: [['PTS', 'REB', 'AST'], ['FG', '3PT', 'FT', 'MIN', 'STL', 'BLK', 'TO']],
  batting: [['H', 'HR', 'RBI'], ['AB', 'R', 'BB', 'SO', 'SB', 'AVG']],
  pitching: [['IP', 'ER', 'K'], ['DEC', 'H', 'BB', 'HR', 'P', 'ERA']],
  soccer: [['G', 'A'], ['STRT', 'SH', 'ST', 'YC', 'RC']]
};
// A season's row (例行賽, 季後賽, 生涯) as a card, as a game is: its games,
// three numbers big, the rest in a line that wraps. Not played yet: said so.
const SEASON_PICKS = {
  basketball: [['PTS', 'REB', 'AST'], ['MIN', 'FG%', '3P%', 'FT%', 'STL', 'BLK', 'TO']],
  batting: [['AVG', 'H', 'HR', 'RBI'], ['AB', 'R', 'H', '2B', 'BB', 'SO', 'OBP', 'SLG', 'OPS', 'SB']],
  pitching: [['ERA', 'W', 'K', 'SO'], ['L', 'SV', 'IP', 'WHIP', 'BB']],
  soccer: [['G', 'A'], ['STRT', 'SHOT', 'SOG', 'YC', 'RC']]
};
function seasonRow(r, rows, sport, en) {
  const W = (zh, eng) => (en ? eng : zh);
  const name = splitName(r.name, rows, en) || zhLater(r.name);
  if (r.none) return el('div', { class: 'glog-game' }, [el('div', { class: 'glog-head' }, [el('strong', { class: 'glog-split', text: name })]), el('p', { class: 'muted glog-none', text: W('還沒出賽', 'No games yet') })]);
  const labels = r.cells.map(c => c.label);
  const has = k => labels.includes(k);
  const [big0, small0] = SEASON_PICKS[has('ERA') || has('IP') ? 'pitching' : has('AVG') || has('AB') ? 'batting' : sport] || [[], []];
  let big = big0.filter(has).slice(0, 3);
  let small = small0.filter(k => has(k) && !big.includes(k));
  if (big.length < 2) [big, small] = [labels.filter(k => !/^(GP|G)$/.test(k) || sport === 'soccer').slice(0, 3), labels.slice(3, 9)];
  const cell = k => r.cells.find(c => c.label === k);
  const pitching = has('IP');
  const label = k => statName(k, en ? 'en' : 'zh', { sport, long: cell(k)?.long, pitching });
  const gp = cell('GP')?.value;
  return el('div', { class: 'glog-game' }, [
    el('div', { class: 'glog-head' }, [el('strong', { class: 'glog-split', text: name }), gp ? el('span', { class: 'result-pill', text: W(`${gp} 場`, `${gp} games`) }) : null]),
    el('div', { class: 'glog-big' }, big.map(k => el('div', { class: 'glog-fig' }, [el('b', { class: 'num', text: cell(k)?.value ?? '–' }), el('small', { text: LOG_BIG[k]?.[en ? 1 : 0] || label(k) })]))),
    small.length ? el('p', { class: 'glog-more' }, small.map(k => (k === 'MIN' ? el('span', { class: 'num', text: W(`${cell(k).value} 分鐘`, `${cell(k).value} min`) }) : el('span', {}, [`${label(k)} `, el('b', { class: 'num', text: cell(k)?.value ?? '' })])))) : null
  ]);
}
// A player's teams, newest first (資料): each with its badge, its years
// (至今 for the one he's with), and his seasons, games and goals there; a
// footballer's loans said, his country's senior side last. A team of the
// league's opens its page.
function careerTeams(c, a, league, sport, en) {
  const W = (zh, eng) => (en ? eng : zh);
  const racing = sport === 'racing';
  const soccer = sport === 'soccer';
  const year = new Date().getFullYear();
  const nameOf = t => (racing ? (en ? t.name : f1Constructor(t.name).zh) : soccer ? (en ? t.name : teamNameZh('', t.name, 'soccer')?.short || t.name) : en ? t.name : teamNameZh(LEAGUES[league]?.play || league, t.name, sport)?.short || t.short || t.name);
  const row = (x, i, { national = false } = {}) => {
    const name = national ? countryName(x.team.name, L()) : nameOf(x.team);
    // (Now: football's open-ended spell; elsewhere the newest, with the team he's with, up to this season.)
    const now = i === 0 && (soccer ? x.to == null : racing ? x.to >= year - (new Date().getMonth() < 2 ? 1 : 0) : String(x.team.id) === String(a.teamId));
    const span = now ? W(`${x.from} 至今`, `${x.from}–`) : x.from === x.to || x.to == null ? String(x.from) : `${x.from}–${x.to}`;
    const sub = [
      national ? W('國家隊', 'National team') : '',
      x.loan ? W('租借', 'Loan') : '',
      !soccer && x.seasons ? W(`${x.seasons} 季`, `${x.seasons} season${x.seasons > 1 ? 's' : ''}`) : '',
      x.games ? W(`${x.games} 場`, `${x.games} games`) : '',
      soccer && x.goals ? W(`${x.goals} 球`, `${x.goals} goals`) : ''
    ].filter(Boolean);
    const mark = racing ? constructorBadge(x.team.name, 'xs') : x.team.logo ? logo(x.team.logo, name, 'xs') : null;
    const taps = !soccer && !racing && x.team.id && hasTeamPage(league);
    return el('li', { class: taps ? 'q-press' : '', ...(taps ? { role: 'button', tabindex: '0', onclick: () => ctx.openTeam(league, x.team.id, { id: x.team.id, name: x.team.name, logo: x.team.logo }) } : {}) }, [
      el('span', { class: 'info-k' }, [el('span', { class: 'fact-mark' }, [mark, el('strong', { text: name })]), sub.length ? el('small', { class: 'muted', text: sub.join(' · ') }) : null]),
      el('span', { class: 'info-v num', text: span })
    ]);
  };
  const rows = [...(c.teams || []).map((x, i) => row(x, i)), ...(c.national || []).map((x, i) => row(x, i, { national: true }))];
  return rows.length ? card(racing ? W('生涯車隊', 'Teams') : W('生涯球隊', 'Teams'), el('ul', { class: 'info-list results career-teams' }, rows)) : null;
}
// Each season's numbers, newest first (數據): its team's badge and the
// few numbers that say the season (a hitter's average, home runs and RBI).
const SEASON_COLS = { basketball: ['GP', 'PTS', 'REB', 'AST'], batting: ['GP', 'AVG', 'HR', 'RBI'], pitching: ['GP', 'W', 'ERA', 'K'], soccer: ['APP', 'G', 'A', 'RAT'] };
const SEASON_HEADS = { GP: ['出賽', 'GP'], APP: ['出賽', 'Apps'], PTS: ['得分', 'PTS'], REB: ['籃板', 'REB'], AST: ['助攻', 'AST'], AVG: ['打擊率', 'AVG'], HR: ['全壘打', 'HR'], RBI: ['打點', 'RBI'], W: ['勝投', 'W'], ERA: ['防禦率', 'ERA'], K: ['三振', 'K'], G: ['進球', 'Goals'], A: ['助攻', 'Assists'], RAT: ['評分', 'Rating'] };
function seasonsCard(c, sport, en) {
  if (!c.seasons?.length || c.seasons.length < 2) return null;
  const cols = SEASON_COLS[sport === 'soccer' ? 'soccer' : sport === 'baseball' ? (c.pitching ? 'pitching' : 'batting') : sport]?.filter(k => c.labels.includes(k));
  if (!cols?.length) return null;
  const head = el('tr', {}, [el('th', { class: 'left', text: en ? 'Season' : '賽季' }), el('th', { class: 'left' }), ...cols.map(k => el('th', { text: SEASON_HEADS[k][en ? 1 : 0] }))]);
  const rows = c.seasons.map(r =>
    el('tr', {}, [
      el('td', { class: 'left num', text: r.season.replace(/^\d\d(\d\d)-(\d\d)$/, '$1-$2') }),
      el('td', { class: 'left' }, [el('span', { class: 'season-team' }, [r.team.logo ? logo(r.team.logo, r.team.name, 'xs') : null, r.team.abbr ? el('span', { text: r.team.abbr }) : null, r.loan ? el('small', { class: 'muted', text: en ? 'loan' : '租借' }) : null])]),
      ...cols.map(k => el('td', { class: 'num', text: r.cells.find(x => x.label === k)?.value || '–' }))
    ])
  );
  return card(en ? 'By season' : '歷年數據', el('div', { class: 'table-wrap' }, [el('table', { class: 'data career-seasons' }, [el('thead', {}, [head]), el('tbody', {}, rows)])]));
}
function logPicks(log, sport) {
  const has = k => log.labels.includes(k);
  const [big, small] = LOG_PICKS[has('IP') ? 'pitching' : has('AB') ? 'batting' : sport] || [[], []];
  const b = big.filter(has);
  if (b.length >= 2) return { big: b, small: small.filter(has) };
  return { big: log.labels.slice(0, 3), small: log.labels.slice(3, 8) };
}
// Their words under a big number and in the line (shorter than the table's).
const LOG_BIG = { PTS: ['得分', 'PTS'], REB: ['籃板', 'REB'], AST: ['助攻', 'AST'], H: ['安打', 'H'], HR: ['全壘打', 'HR'], RBI: ['打點', 'RBI'], IP: ['局數', 'IP'], ER: ['自責分', 'ER'], K: ['三振', 'K'], G: ['進球', 'Goals'], A: ['助攻', 'Assists'] };
const LOG_SMALL = { FG: ['投籃', 'FG'], '3PT': ['三分', '3PT'], FT: ['罰球', 'FT'], STL: ['抄截', 'STL'], BLK: ['阻攻', 'BLK'], TO: ['失誤', 'TO'], AB: ['打數', 'AB'], R: ['得分', 'R'], BB: ['保送', 'BB'], SO: ['三振', 'SO'], SB: ['盜壘', 'SB'], AVG: ['打擊率', 'AVG'], H: ['被安打', 'H'], P: ['用球數', 'P'], ERA: ['防禦率', 'ERA'], SH: ['射門', 'Shots'], ST: ['射正', 'On target'], YC: ['黃牌', 'YC'], RC: ['紅牌', 'RC'] };
// A player's games newer than ESPN's log of them: the team's games over
// since the log's newest (six hours' grace: a log's date is the game's
// day), newest first, each with his line from its box score, in the log's
// columns (a percentage worked out from its made-attempted, a column the
// box score hasn't: –); a game he didn't play, 未上場.
async function newerGames(league, id, teamId, log, scheduleOf, name = '') {
  const newest = Date.parse(log.games[0]?.date || '') || 0;
  // (The game on now too: his line so far, said to be live.)
  const done = (await scheduleOf()).filter(x => (x.status?.state === 'post' || x.status?.state === 'in') && !x.status.void && Date.parse(x.start) > newest + 6 * 3_600_000).reverse().slice(0, 5);
  // (Each game under its own competition: a League Cup night among a club's league games was said to be 英超.)
  const compOf = x => (x.league && LEAGUES[x.league] && !x.other ? x.league : null);
  const lines = await Promise.all(done.map(x => (compOf(x) || !x.other ? summary(compOf(x) || league, x.id).catch(() => null) : null)));
  // MLB: his line from MLB's own box score, every column of the log (ESPN's has no 2B, 3B, GS, CG, SHO).
  const mlb = league === 'mlb' && name ? await Promise.all(done.map(x => mlbGameLog(x, name, log.labels).catch(() => null))) : [];
  return done.map((x, i) => {
    const d = lines[i];
    const { home, us, them } = sidesFor(x, teamId);
    const live = x.status?.state === 'in';
    const result = live ? '' : outcome(us, them);
    // His row: the table sharing the most columns with the log's (a two-way player's batting or pitching).
    const found = (d?.players || []).flatMap(p => p.tables.map(tb => ({ tb, row: tb.rows.find(r => r.id === String(id)) }))).filter(x => x.row && !x.row.dnp && x.row.stats?.some(v => v !== '' && v != null));
    const best = found.sort((p, q) => q.tb.labels.filter(k => log.labels.includes(k)).length - p.tb.labels.filter(k => log.labels.includes(k)).length)[0];
    const val = k => {
      if (!best) return '';
      // (A strikeout is SO in a log, K in a box score.)
      const at = [k, { SO: 'K', K: 'SO' }[k]].map(x => best.tb.labels.indexOf(x)).find(n => n >= 0) ?? -1;
      if (at >= 0) return String(best.row.stats[at] ?? '');
      const made = { 'FG%': 'FG', '3P%': '3PT', 'FT%': 'FT' }[k];
      const m = made && /^(\d+)-(\d+)$/.exec(String(best.row.stats[best.tb.labels.indexOf(made)] ?? ''));
      return m ? (Number(m[2]) ? ((100 * Number(m[1])) / Number(m[2])).toFixed(1) : '0.0') : '–';
    };
    const stats = mlb[i] || (best ? log.labels.map(val) : log.labels.map((_, k) => (k ? '' : 'DNP')));
    // (A box score with nobody's numbers in it, football's at ESPN: his line unknown, never "didn't play".)
    const unknown = !mlb[i] && !(d?.players || []).some(p => p.tables.some(tb => tb.rows.some(r => r.stats?.some(v => v !== '' && v != null))));
    return { unknown, id: String(x.id), date: x.start, live, at: home ? 'vs' : '@', home, league: compOf(x) || (x.other ? null : league), leagueName: x.other ? otherName(x.other, L() === 'en') : '', pre: Boolean(x.preseason || /preseason/i.test(x.note || '')), team: { id: String(teamId), abbr: us?.abbr || '', logo: us?.logo || null }, opp: { id: String(them?.id ?? ''), name: them?.name || '', abbr: them?.abbr || '', logo: them?.logo || null }, result, score: sideScore(us, them), stats };
  });
}

// formula1.com's figures as tiles, in the app's words.
// "P1（133 次）" reads as P1 with "133 次" under it: a tile is too narrow for both on a line.
const f1Tile = (k, v, en) => {
  const text = f1Value(v, en);
  const two = text.match(/^(\S+)\s*[（(](.+)[)）]$/);
  return two ? tile(f1Label(k, en), two[1], two[2]) : tile(f1Label(k, en), text);
};
const f1Tiles = (grid, en) => el('div', { class: 'stat-grid dense' }, grid.map(([k, v]) => f1Tile(k, v, en)));
// A finish: P3, or the retirement (its reason on hold); none: a dash.
const finishPill = (f, extra = '') => (f ? el('span', { class: `pos-pill num${f.out ? ' out' : f.pos <= 3 ? ' podium' : ''}${f.pos === 1 ? ' win' : ''}${extra}`, title: f.why || null, text: f.text }) : el('span', { class: 'muted', text: '–' }));
// A race's name and, apart, where it's held when it says (巴林站（馬來西亞）: 巴林站, 馬來西亞), so a
// narrow column wraps it at the name, never leaving a bracket alone on a line.
const raceWhere = name => {
  const m = String(name || '').match(/^(.+?)\s*[（(]([^）)]+)[）)]$/);
  return m ? [m[1], m[2]] : [name, ''];
};
// Each weekend this season, latest first, a row each opening the race: its
// round, flag and name; per car its race finish with the sprint's under it
// (S3); the points. A team's cars head their columns with face and name (the
// three-letter code when three share the width); one car (a driver's own
// page): the grid, the race and the sprint. A grid, not a table: up to three
// cars fit a phone without scrolling.
// `grid: false`: no grid column (ESPN's finishes, which don't say where they started).
function f1Weekends(weekends, en, cars, { grid = true } = {}) {
  const W = (zh, eng) => (en ? eng : zh);
  const one = cars[0]?.key === 'me';
  const carOf = (w, c) => (c.key === 'me' ? w.me : w.rows.find(r => r.driverId === c.key));
  const sprints = weekends.some(w => cars.some(c => carOf(w, c)?.sprint));
  const sprintOf = r => (r?.sprint ? finishOf(r.sprint, en) : null);
  const heads = one
    ? [grid ? W('發車', 'Grid') : null, W('正賽', 'Race'), sprints ? W('衝刺', 'Sprint') : null].filter(Boolean).map(t => el('span', { class: 'rw-h', text: t }))
    : cars.map(c => el('span', { class: 'rw-h rw-car', title: c.full || null }, [c.full ? personPic({ name: c.full }, 'f1', 'xs round') : null, el('span', { text: cars.length > 2 ? c.code || c.head : c.head })]));
  const cols = one ? heads.length : cars.length;
  const list = el('div', { class: 'race-weeks', style: `--cols:${cols}` }, [
    el('div', { class: 'rw-row rw-head' }, [el('span'), el('span', { class: 'rw-h left', text: W('分站', 'Race') }), ...heads, el('span', { class: 'rw-h', text: W('得分', 'Pts') })]),
    ...weekends.map(w => {
      const open = w.e ? () => ctx.openEvent(splitWeekend(w.e, Date.now(), L()).find(x => x.sessionKey === 'Race') || w.e) : null;
      const [name, where] = raceWhere(w.e?.name || w.name);
      const cells = one
        ? (r => [
            grid ? el('span', { class: 'rw-cell num muted', text: r?.grid ? String(r.grid) : r ? W('維修區', 'Pit') : '–' }) : null,
            el('span', { class: 'rw-cell' }, [finishPill(finishOf(r?.result, en))]),
            sprints ? el('span', { class: 'rw-cell' }, [r?.sprint ? finishPill(sprintOf(r)) : el('span', { class: 'muted', text: '' })]) : null
          ])(w.me).filter(Boolean)
        : cars.map(c => {
            const r = carOf(w, c);
            const sp = sprintOf(r);
            return el('span', { class: 'rw-cell' }, [finishPill(finishOf(r?.result, en)), sp ? el('small', { class: `rw-sprint num${sp.pos && sp.pos <= 3 ? ' podium' : ''}`, text: `S${sp.out ? '–' : sp.pos || ''}` }) : null]);
          });
      const pts = one ? Number(w.me?.result?.points || 0) + Number(w.me?.sprint?.points || 0) : w.points;
      return el(open ? 'button' : 'div', { class: 'rw-row', type: open ? 'button' : null, onclick: open }, [
        el('span', { class: 'rw-round num', text: String(w.round || '') }),
        el('span', { class: 'rw-race' }, [raceFlag(w.e), el('span', { class: 'rw-name' }, [el('span', { text: name }), where ? el('small', { class: 'muted', text: where }) : null])]),
        ...cells,
        el('strong', { class: `rw-pts num${Number(pts) ? '' : ' muted'}`, text: String(pts) })
      ]);
    })
  ]);
  return card(W('本季每站', 'Race by race'), list, { sub: sprints && !one ? W('S：衝刺賽名次', 'S: sprint finish') : '' });
}
// A fact with its mark (a team's badge, a country's flag) before it; the text alone without one.
const withMark = (mark, text) => (text && mark ? el('span', { class: 'fact-mark' }, [mark, el('span', { text })]) : text);
// The next race weekend, to tap: its flag, name and circuit, how soon the
// race is, and the sessions still to come (each opening its own sheet).
function nextRaceCard(e, en) {
  const W = (zh, eng) => (en ? eng : zh);
  const left = splitWeekend(e, Date.now(), L()).filter(x => x.status.state !== 'post');
  const race = left.find(x => x.sessionKey === 'Race') || left.at(-1) || e;
  const days = Math.round((Date.parse(localDate(Date.parse(race.official || race.start))) - Date.parse(today())) / 86_400_000);
  const soon = days <= 0 ? W('今天', 'Today') : days === 1 ? W('明天', 'Tomorrow') : W(`${days} 天後`, `In ${days} days`);
  return el('button', { class: 'q-card next-race', type: 'button', onclick: () => ctx.openEvent(race) }, [
    el('div', { class: 'next-race-head' }, [
      raceFlag(e, 'big'),
      el('span', { class: 'next-race-text' }, [el('small', { class: 'muted', text: W('下一站', 'Next race') }), el('strong', { text: e.name }), e.venue ? el('small', { class: 'muted', text: e.venue }) : null]),
      el('span', { class: 'next-race-soon', text: soon })
    ]),
    left.length > 1
      ? el(
          'div',
          { class: 'next-race-sessions' },
          left.map(x => el('span', { class: `nr-sess${x === race ? ' main' : ''}`, onclick: ev => (ev.stopPropagation(), ctx.openEvent(x)) }, [sessionTag(x), el('small', { class: 'num', text: `${dayLabel(localDate(Date.parse(x.official || x.start)))} ${clock(shownStart(x))}` })]))
        )
      : el('small', { class: 'muted num', text: whenOf(race) })
  ]);
}
// A moment's sign where it has no face or badge, drawn (an emoji in the
// list looked out of place: the owner, 2026-10-18): play stopped, VAR, a red
// card or flag, a safety car, the chequered flag, out, a pit stop, a ball.
const GLYPHS = {
  '⏸': ['pause', '<rect x="7" y="5.5" width="3.6" height="13" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.4" y="5.5" width="3.6" height="13" rx="1.2" fill="currentColor" stroke="none"/>'],
  '📺': ['var', '<rect x="3.5" y="5" width="17" height="11.5" rx="2.2"/><path d="M9 20h6M12 16.5V20"/>'],
  '🟥': ['red', '<rect x="7" y="4" width="10" height="16" rx="2" fill="currentColor" stroke="none" transform="rotate(8 12 12)"/>'],
  '🚨': ['sc', '<path d="M6 17a6 6 0 0 1 12 0"/><path d="M4 17h16v3H4z"/><path d="M12 5V3M5.5 7.5 4 6M18.5 7.5 20 6"/>'],
  '🏁': ['finish', '<path d="M5 21V4"/><path d="M5 4h13v9H5"/><path d="M5 8.5h13M9.3 4v9M13.6 4v9" stroke-width="1.4"/>'],
  '❌': ['out', '<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/>'],
  '🔧': ['pit', '<path d="M14.5 4.5a4 4 0 0 0-4.9 5.2L4 15.3 6.7 18l5.6-5.6a4 4 0 0 0 5.2-4.9l-2.3 2.3-2.4-.6-.6-2.4z"/>']
};
function momentGlyph(icon) {
  const [kind, draw] = GLYPHS[icon] || ['ball', '<circle cx="12" cy="12" r="8"/><path d="M12 8.2l3.4 2.5-1.3 4h-4.2l-1.3-4z" fill="currentColor" stroke="none"/>'];
  const g = el('span', { class: `wp-glyph ${kind}`, 'aria-hidden': 'true' });
  g.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${draw}</svg>`;
  return g;
}
// A league's table with what's over that it hasn't counted yet (title.mjs
// liveTable; F1: a race at F1's flag): every page with a table on it (a
// team's, a driver's, a constructor's) as 賽事's table has it.
// formula1.com's season place and points, as the table has them now (its
// page is updated a day after a race: 196 points, 5th, beside a table with
// the race in).
const freshSeason = (grid, champ) => (champ ? grid.map(([k, v]) => (k === 'Season Position' ? [k, String(champ.pos)] : k === 'Season Points' ? [k, String(champ.points)] : [k, v])) : grid);
// The one rule for every table shown (賽事's 排名 too, app.js tableOf).
export function tableNow(groups, league, recent = []) {
  const sport = LEAGUES[league]?.sport;
  return liveTable(groups, sport === 'racing' ? settleScoring(recent) : recent, sport, { teamOf: side => f1Driver(side.en || side.name).team });
}
function freshStandings(league) {
  return standings(league).then(g => (g?.length ? tableNow(g, league, ctx.recentOf?.(league) || []) : g));
}
// Each session of the season a stand-in drove (in its entry list, ESPN's),
// as F1's own timing has his car: [{ e, abbr, start, team, colour, number,
// pos }], oldest first (a session not over yet: no place).
async function sessionsDriven(events, id, name) {
  const runs = (events || []).flatMap(e => (e.sessions || []).filter(x => (x.field || []).some(c => c.id === String(id))).map(x => ({ e, x })));
  const want = fold(name);
  const last = want.split(' ').at(-1);
  const out = await Promise.all(
    runs.map(async ({ e, x }) => {
      const timing = await sessionTiming(x.start).catch(() => null);
      const car = (timing?.cars || []).find(c => fold(c.name) === want) || (timing?.cars || []).find(c => fold(c.name).endsWith(last));
      const at = x.field.findIndex(c => c.id === String(id));
      return { e, abbr: x.abbr, start: x.start, team: car?.team || '', colour: car?.colour || '', number: car?.no || '', pos: x.status.state === 'post' ? car?.pos < 99 ? car.pos : at + 1 : 0 };
    })
  );
  return out.sort((a, b) => a.start.localeCompare(b.start));
}
// The sessions a stand-in drove this season, latest first: the weekend, the
// session, the car, where he finished it; a tap opens that session.
function outingsCard(list, en) {
  const rows = [...list].reverse();
  return card(
    en ? `${new Date().getFullYear()} sessions driven` : `${new Date().getFullYear()} 出賽紀錄`,
    el(
      'div',
      { class: 'fp-outs' },
      rows.map(o => {
        const team = f1Constructor(o.team);
        const session = SESSION_NAMES[o.abbr]?.[en ? 'en' : 'zh'] || o.abbr;
        const open = o.e ? () => ctx.openEvent(splitWeekend(o.e, Date.now(), L()).find(x => x.sessionKey === o.abbr) || o.e) : null;
        return el(open ? 'button' : 'div', { class: 'fp-out', type: open ? 'button' : null, onclick: open, style: `--team:${o.colour || team.color}` }, [
          raceFlag(o.e) || el('span', { class: 'race-flag' }),
          el('span', { class: 'fp-out-main' }, [el('strong', { text: o.e?.name || session || '' }), el('small', {}, [session || '', ' · ', en ? team.name : team.zh])]),
          o.pos ? el('span', { class: 'fp-out-pos num', text: `P${o.pos}` }) : null
        ]);
      })
    )
  );
}
// Who he is (Wikipedia's first lines): in Chinese the Chinese article's own, else the English put into Chinese.
function aboutCard(about, en) {
  const text = en ? about.en : about.zh || (about.en ? zhLater(about.en, 'en') : '');
  if (!text) return null;
  return card(en ? 'About' : '車手背景', el('div', { class: 'stack tight' }, [el('p', { class: 'about-text' }, [text]), el('small', { class: 'muted', text: en ? 'From Wikipedia' : '資料來源：維基百科' })]));
}
export async function openPlayer(league, id, fallback = {}) {
  if (!id) return;
  // Opened from a game's page: that game, if he's in its box score.
  const game = openGame?.dialog.isConnected && openGame.e.league === league && gameLine(openGame.data, id) ? openGame : null;
  const s = sheet(leagueName(league, L()), { league });
  const content = el('div', {}, [spinner()]);
  s.body.append(content);
  try {
    const sport = LEAGUES[league]?.sport;
    // This season, from the league's own tables and results (ESPN's player
    // card has little for drivers): the championship and each race.
    const [a, ov, table, races, official, guest] = await Promise.all([
      athlete(league, id),
      athleteOverview(league, id).catch(() => null),
      sport === 'racing' && LEAGUES[league].standings ? freshStandings(league).catch(() => null) : null,
      sport === 'racing' ? seasonEvents(league).then(settleScoring).catch(() => []) : null,
      // F1: formula1.com's figures and each weekend's grid, finish and sprint.
      league === 'f1' ? athlete(league, id).then(x => f1Official('drivers', { page: f1Driver(x.name).page, name: x.name })).catch(() => null) : null,
      // A driver who isn't one of the season's twenty-two (a practice's
      // stand-in, a reserve): the sessions he drove (OpenF1) and who he is
      // (Wikipedia, f1-people.js), since ESPN and formula1.com have neither.
      league === 'f1'
        ? athlete(league, id)
            .then(x => (f1Driver(x.name).team ? null : Promise.all([seasonEvents(league).then(evs => sessionsDriven(evs, id, x.name)).catch(() => []), driverAbout(x.name).catch(() => null)])))
            .then(g => (g ? { outings: g[0], about: g[1] } : null))
            .catch(() => null)
        : null
    ]);
    // ESPN's player card can name a club record of its own ("RC STRASBOURG
    // ALSACE I", id 133232, no badge) for a club's real side (Strasbourg):
    // opened from a game, the side he played for in it is his team; else
    // the name made readable ("RC Strasbourg Alsace").
    const odd = !a.teamLogo && /^[^a-z]*[A-Z]{3}[^a-z]*$/.test(a.team || '');
    const side = game && odd ? [game.e.home, game.e.away].find(x => x && String(x.id) === gameLine(game.data, id)?.[0]?.team) : null;
    if (side) Object.assign(a, { team: side.name, teamId: String(side.id), teamLogo: side.logo || '', teamColor: side.color || a.teamColor });
    else if (odd) {
      a.team = a.team.replace(/\s+(I{1,3}|B|II)$/, '').toLowerCase().replace(/(^|[\s-])(\S)/g, (m, sp, c) => sp + c.toUpperCase()).replace(/\b(Rc|Fc|Ac|Sc|Ss|As|Us|Cf|Sv|Vfb|Vfl|Psv|Afc)\b/g, w => w.toUpperCase());
      // Its club as the league names it (Strasbourg: 史特拉斯堡), where one of its words is.
      const known = a.team.split(/\s+/).find(w => w.length > 3 && teamNameZh(LEAGUES[league]?.play || league, w, sport));
      if (known) a.team = known;
    }
    // A new regular season begun and ESPN's card still last season's: this
    // season's from his games so far (athleteOverview's now), last season's
    // regular season, playoffs and ranks put away; his career stays.
    if (ov?.now && !String(a.stats?.title || '').includes(ov.now.name)) {
      a.stats = ov.now.stats;
      ov.season = { title: `${ov.now.name} season stats`, rows: [ov.now.row, ...(ov.season?.rows || []).filter(r => /career/i.test(r.name))] };
      ov.rankings = [];
    }
    const en = L() === 'en';
    const W = (zh, eng) => (en ? eng : zh);
    // A pitcher's role as he's used now (his last games), not the season's.
    const position = sport === 'baseball' ? pitcherRole(a.position, ov?.log) : a.position;
    const driver = league === 'f1' ? f1Driver(a.name) : null;
    const champ = table ? driverSeason(table, id) : null;
    const name = driver && !en && driver.zh !== a.name ? `${driver.zh}` : a.name;
    // A stand-in's car now (the last session he drove): his team, colour and number.
    const outings = guest?.outings || [];
    const lastCar = outings.at(-1) || null;
    const guestTeam = lastCar?.team ? f1Constructor(lastCar.team).name : '';
    const draft = draftOf(a.draft);
    const draftNode = draft ? el('span', { text: W(`${draft.year} 年${draft.round === 1 ? '首' : `第 ${draft.round} `}輪第 ${draft.pick} 順位`, `${draft.year} · Round ${draft.round}, pick ${draft.pick}`) }) : null;
    const facts = [
      guestTeam ? [W('車隊', 'Team'), withMark(constructorBadge(guestTeam, 'xs'), en ? guestTeam : f1Constructor(guestTeam).zh)] : null,
      guestTeam ? null : [sport === 'racing' ? W('車隊', 'Team') : T('team'), withMark(driver?.team ? constructorBadge(driver.team, 'xs') : a.teamLogo ? logo(a.teamLogo, a.team, 'xs') : null, driver?.team && !en ? f1Constructor(driver.team).zh : (a.team && !en ? teamNameZh(LEAGUES[league]?.play || league, a.team, sport)?.short : '') || a.team || driver?.team || '')],
      [T('country'), withMark(countryFlag(a.country) ? el('span', { class: 'fact-flag', 'aria-hidden': 'true', text: countryFlag(a.country) }) : null, countryName(a.country, L()))],
      [T('position'), zhLater(position)],
      [T('age'), a.age ? String(a.age) : ''],
      [T('height'), metric(a.height, L())],
      [T('weight'), metric(a.weight, L())],
      [T('born'), dateText(a.dob, a.born, L())],
      [T('birthPlace'), zhLater(a.birthPlace || official?.grids.bio?.find(([k]) => k === 'Place of Birth')?.[1])],
      // How he came into the league (Jay 2026-10-31: his history with his
      // facts): the draft (its team once the league's table is in), his
      // first season, his seasons in it, his college.
      [W('選秀', 'Draft'), draftNode],
      [W('初登場', 'Debut'), a.debut ? W(`${a.debut} 年`, String(a.debut)) : ''],
      [W('年資', 'In the league'), seasonsIn(a.experience) ? W(`第 ${seasonsIn(a.experience)} 季`, a.experience) : ''],
      [W('大學', 'College'), a.college ? (en ? a.college : teamNameZh('ncaaf', a.college)?.full || a.college) : '']
    ].filter(x => x && x[1]);
    const og = official?.grids || {};
    const weekends = (official?.weekends || []).map(w => ({ ...w, me: w.rows[0], e: eventOfRace(races, w.date) }));
    // Each race this season: where they finished (the race, else the sprint), latest first.
    const raceRows = (races || [])
      .flatMap(e => {
        const race = (e.sessions || []).find(x => x.abbr === 'Race' && x.status.state === 'post');
        const at = race ? race.field.findIndex(c => c.id === String(id)) : -1;
        const sprint = (e.sessions || []).find(x => x.abbr === 'SR' && x.status.state === 'post');
        const sp = sprint ? sprint.field.findIndex(c => c.id === String(id)) + 1 : 0;
        return at >= 0 ? [{ name: e.name, start: race.start, pos: at + 1, sprint: sp, e }] : [];
      })
      .sort((x, y) => y.start.localeCompare(x.start));
    // The season in four numbers: wins, podiums, the best and the average finish.
    const finishes = raceRows.map(r => r.pos);
    const summaryTiles = finishes.length
      ? [
          tile(W('分站冠軍', 'Wins'), String(finishes.filter(p => p === 1).length)),
          tile(W('頒獎台', 'Podiums'), String(finishes.filter(p => p <= 3).length)),
          tile(W('最佳成績', 'Best finish'), `P${Math.min(...finishes)}`),
          tile(W('平均名次', 'Average finish'), `P${(finishes.reduce((x, y) => x + y, 0) / finishes.length).toFixed(1)}`)
        ]
      : [];
    // Their teammate (same car, the fairest yardstick): points, place, and who finished ahead race by race.
    const mateRow = driver?.team ? table?.flatMap(g => g.rows).find(r => r.athlete && r.id !== String(id) && f1Driver(r.en || r.name).team === driver.team) : null;
    const mate = mateRow ? driverSeason(table, mateRow.id) : null;
    let ahead = 0;
    let behind = 0;
    if (mate) {
      for (const e of races || []) {
        const race = (e.sessions || []).find(x => x.abbr === 'Race' && x.status.state === 'post');
        const me = race ? race.field.findIndex(c => c.id === String(id)) : -1;
        const them = race ? race.field.findIndex(c => c.id === mateRow.id) : -1;
        if (me >= 0 && them >= 0) me < them ? ahead++ : behind++;
      }
    }
    const mateName = mateRow ? (en ? mateRow.en || mateRow.name : f1Driver(mateRow.en || mateRow.name).zh) : '';
    const mateCard = mate
      ? card(
          W(`隊友對比 · ${mateName}`, `Against teammate ${mateName}`),
          el('div', { class: 'mate-grid' }, [
            el('span'),
            el('span', { class: 'mate-who mate-me' }, [personPic({ id, name: a.name, headshot: a.headshot, logo: fallback.logo }, league, 'lg round'), el('strong', { text: name })]),
            el('button', { class: 'mate-who mate-them', type: 'button', onclick: () => ctx.openPlayer(league, mateRow.id, mateRow) }, [personPic(mateRow, league, 'lg round'), el('strong', { text: `${mateName} ›` })]),
            ...[
              [W('排名', 'Place'), `P${champ?.pos ?? '–'}`, `P${mate.pos}`, (champ?.pos ?? 99) < mate.pos],
              [W('積分', 'Points'), String(champ?.points ?? '–'), String(mate.points), Number(champ?.points) > Number(mate.points)],
              ahead + behind ? [W('正賽名次較前', 'Ahead in races'), String(ahead), String(behind), ahead > behind] : null
            ]
              .filter(Boolean)
              .flatMap(([k, x, y, win]) => [el('span', { class: 'mate-k', text: k }), el('strong', { class: `num${win ? ' mate-win' : ''}`, text: x }), el('strong', { class: `num${!win && x !== y ? ' mate-win' : ''}`, text: y })])
          ])
        )
      : null;
    // Their last games (team sports): the date, the other side, the result,
    // their numbers. Each game says its competition (a Nations League game
    // among a club's; one competition for all: once, at the top), and one of
    // ours opens its match.
    const log = ov?.log;
    const compOf = g => (g.league ? leagueName(g.league, L()) : zhLater(g.leagueName, 'en'));
    const matchOf = g => {
      const us = { id: g.team.id, name: g.team.abbr, short: g.team.abbr, abbr: g.team.abbr, logo: g.team.logo };
      const them = { id: g.opp.id, name: g.opp.name, short: g.opp.abbr || g.opp.name, abbr: g.opp.abbr, logo: g.opp.logo };
      const [ours, theirs] = g.score.split('-');
      const home = g.home ?? g.at !== '@';
      return { id: g.id, league: g.league, kind: 'match', start: g.date, status: { state: 'post', detail: '', short: '', completed: true, name: 'STATUS_FULL_TIME', clock: '', period: 0 }, home: { ...(home ? us : them), score: home ? ours : theirs }, away: { ...(home ? them : us), score: home ? theirs : ours } };
    };
    const opensMatch = g => Boolean(g.league && LEAGUES[g.league]?.espn && g.team.id && g.opp.id && /^\d+$/.test(g.id));
    // A game opened as the home page opens it: its whole record from the
    // team's schedule (a playoff game with its round and series, a tap to
    // the whole series), else that day's scoreboard, else as the log has it.
    let schedule = null;
    const scheduleOf = () => (schedule ??= a.teamId ? teamSchedule(league, a.teamId).catch(() => []) : Promise.resolve([]));
    // (The scoreboard's: the schedule's has the note, not the round,
    // series and stage the header's line and its tap need.)
    const openLogGame = async g => {
      const listed = g.league === league ? (await scheduleOf()).find(x => String(x.id) === String(g.id)) : null;
      const at = Date.parse(listed?.start || g.date || '');
      const days = Number.isFinite(at) ? [-1, 0, 1].map(k => new Date(at + k * 86_400_000).toISOString().slice(0, 10).replaceAll('-', '')) : [];
      const board = days.length ? (await scoreboard(g.league, days).catch(() => [])).find(x => String(x.id) === String(g.id)) : null;
      ctx.openEvent(board || listed || matchOf(g));
    };
    const logCardOf = (log, head = '') => {
      // (One competition for all its games: said once, at the top.)
      const oneComp = new Set(log.games.map(g => g.league || g.leagueName)).size === 1 ? log.games[0] : null;
      return card(
          // Last season's (ESPN's until a player's first game of the new one: April's in October), said to be.
          head || (Date.now() - (Date.parse(log.games[0]?.date || '') || Date.now()) > 45 * 86_400_000 ? W(`上季最後 ${log.games.length} 場`, `Last season's last ${log.games.length}`) : W(`近 ${log.games.length} 場`, `Last ${log.games.length} games`)),
          el(
            'div',
            { class: 'glog' },
            log.games.map(g => {
              const { big, small } = logPicks(log, sport);
              const at = k => g.stats[log.labels.indexOf(k)];
              const said = v => (en ? v : LOG_WORDS[v] || v);
              const name = k => statName(k, L(), { sport, long: log.longs?.[log.labels.indexOf(k)], pitching: log.labels.includes('IP') });
              const taps = opensMatch(g);
              return el('div', { class: `glog-game${taps ? ' q-press' : ''}`, ...(taps ? { role: 'button', tabindex: '0', onclick: () => openLogGame(g) } : {}) }, [
                el('div', { class: 'glog-head' }, [
                  el('span', { class: 'glog-date num', text: g.date ? localDate(Date.parse(g.date)).slice(5).replace('-', '/') : '' }),
                  el('span', { class: 'glog-opp' }, [el('span', { class: 'muted', text: g.at === '@' ? '@' : 'vs' }), logo(g.opp.logo, g.opp.name, 'xs'), el('strong', { text: g.opp.abbr || g.opp.name })]),
                  g.pre ? el('small', { class: 'glog-comp', text: W('熱身賽', 'Preseason') }) : !oneComp && (g.league || g.leagueName) ? el('small', { class: 'glog-comp' }, [compOf(g)]) : null,
                  g.live
                    ? el('span', { class: 'result-pill live', text: [W('進行中', 'Live'), g.score].filter(Boolean).join(' ') })
                    : el('span', { class: `result-pill ${g.result === 'W' ? 'w' : g.result === 'L' ? 'l' : g.result === 'D' || g.result === 'T' ? 'd' : ''}`, text: [g.result ? (en ? g.result : { W: '勝', L: '敗', D: '和', T: '和' }[g.result] || g.result) : '', g.score].filter(Boolean).join(' ') })
                ]),
                // (Not in the box score at all: said, not a row of empty figures.)
                g.unknown
                  ? null
                  : !g.live && g.stats.every(v => v === '' || v == null || v === 'DNP')
                  ? el('p', { class: 'glog-more muted', text: W('未上場', 'Did not play') })
                  : big.length
                  ? el(
                      'div',
                      { class: 'glog-big' },
                      big.map(k => el('div', { class: 'glog-fig' }, [el('b', { class: 'num', text: said(at(k) ?? '–') }), el('small', { text: LOG_BIG[k]?.[en ? 1 : 0] || name(k) })]))
                    )
                  : null,
                small.length && !g.unknown && !g.stats.every(v => v === '' || v == null || v === 'DNP')
                  ? el(
                      'p',
                      { class: 'glog-more' },
                      small.map(k => {
                        const v = said(at(k) ?? '');
                        if (v === '' || v === '–') return null;
                        if (k === 'MIN') return el('span', { class: 'num', text: W(`${v} 分鐘`, `${v} min`) });
                        if (/[^\d.\-/]/.test(v)) return el('span', { text: v });
                        return el('span', {}, [`${LOG_SMALL[k]?.[en ? 1 : 0] || name(k)} `, el('b', { class: 'num', text: v })]);
                      })
                    )
                  : null,
                taps ? el('span', { class: 'glog-chev', 'aria-hidden': 'true', text: '›' }) : null
              ]);
            })
          ),
          { sub: oneComp && (oneComp.league || oneComp.leagueName) ? compOf(oneComp) : '' }
        );
    };
    // (This season begun, none of his yet: said so, not last season's.)
    const noGamesCard = () => card(W('近期比賽', 'Games'), el('p', { class: 'muted glog-none', text: W(`${ov.now.name} 例行賽還沒出賽`, `No ${ov.now.name} regular-season games yet`) }));
    // His games in more than one competition (a club's league, a European
    // cup, his country's): a chip each and 全部, the page's own first (a
    // team's page has the same, Jay 2026-10-30).
    const logBox = lg => {
      const comps = [...new Set(lg.games.map(g => g.league || g.leagueName).filter(Boolean))].sort((a, b) => (b === league) - (a === league) || Boolean(LEAGUES[b]) - Boolean(LEAGUES[a]));
      if (comps.length < 2) return logCardOf(lg);
      let pick = comps.includes(league) ? league : 'all';
      const box = el('div', { class: 'log-box' });
      const draw = () =>
        put(
          box,
          segmented([...comps.map(k => [k, LEAGUES[k] ? leagueName(k, L()) : k]), ['all', W('全部', 'All')]], pick, v => ((pick = v), draw()), 'scroll stage-filter', { chips: true }),
          logCardOf(pick === 'all' ? lg : { ...lg, games: lg.games.filter(g => (g.league || g.leagueName) === pick) })
        );
      draw();
      return box;
    };
    let logCard = log?.games.length ? logBox(log) : ov?.now?.none ? noGamesCard() : null;
    // (ESPN's honours; a footballer's from his career, its competitions in our words.)
    const awardsOf = (list, comps = false) => card(W('榮譽', 'Honours'), el('ul', { class: 'award-list' }, list.map(w => el('li', {}, [el('strong', {}, [(comps && compWord(w.name, en)) || zhLater(w.name)]), w.count ? el('span', { class: 'award-count num', text: w.count.replace(/x$/i, '×') }) : null, w.seasons.length ? el('small', { class: 'muted', text: w.seasons.slice(0, 6).join(' · ') + (w.seasons.length > 6 ? ' …' : '') }) : null]))));
    let awardsCard = ov?.awards?.length ? awardsOf(ov.awards) : null;
    const nextRace = (races || []).find(e => e.status.state !== 'post' && Date.parse(e.end || e.start) > Date.now() - 86_400_000);
    // A player in any league; a team sport's with their team, whose games are theirs.
    const team = !individual(league) && a.teamId ? { id: String(a.teamId), name: a.team || '' } : null;
    const followBtn = followButton(() => ctx.isFollowed(league, id), () => ctx.toggleFollow(league, { id, name: a.name || fallback.name, logo: a.headshot || fallback.logo, athlete: true, ...(team ? { team } : {}) }));
    // Their team in the viewer's language (道奇, not "Los Angeles Dodgers" cut to "Los Angel…").
    const teamShown = driver?.team && !en ? f1Constructor(driver.team).zh : a.team && !en ? teamNameZh(LEAGUES[league]?.play || league, a.team, sport)?.short || a.team : a.team || driver?.team;
    // Their team at a glance: its logo and name, a tap to its page (a driver's, an individual's: as before).
    // A tap opens it in its own league, only when that's one of ours (a
    // national side's player's club in Cyprus: its name, no page).
    // A driver's team, as a player's: its badge and name, a tap to its page.
    const teamChip = driver?.team || guestTeam
      ? el('button', { class: 'hero-team', type: 'button', onclick: () => openConstructor({ id: '', name: driver?.team || guestTeam, en: driver?.team || guestTeam }) }, [constructorBadge(driver?.team || guestTeam, 'xs'), el('span', { text: driver?.team ? teamShown : en ? guestTeam : f1Constructor(guestTeam).zh })])
      : team && teamShown
        ? el('span', { class: 'hero-team' }, [a.teamLogo ? logo(a.teamLogo, teamShown, 'xs') : null, fitLine(el('span', { text: teamShown }))])
        : null;
    // A club from a league we don't cover says which league it is (few know Omonia Aradippou).
    if (teamChip && team)
      homeLeague(league, team.id)
        .then(({ key, name }) => {
          if (!teamChip.isConnected) return;
          if (!key || !hasTeamPage(key)) {
            if (name) teamChip.querySelector('span').append(el('small', { class: 'hero-team-league' }, [zhLater(name, 'en')]));
            return;
          }
          const tap = el('button', { class: 'hero-team', type: 'button', onclick: () => ctx.openTeam(key, team.id, { id: team.id, name: teamShown, logo: a.teamLogo }) }, [...teamChip.childNodes]);
          teamChip.replaceWith(tap);
        })
        .catch(() => {});
    // (A stand-in: his number in that car, and what he is: one who drives a practice, not the races.)
    const sub = guest ? [lastCar?.number ? `#${lastCar.number}` : '', W('試車手', 'Test driver')].filter(Boolean) : [a.jersey ? `#${a.jersey}` : '', zhLater(position), teamChip ? '' : teamShown || countryName(a.country, L())].filter(Boolean);
    const year = new Date().getFullYear();
    const heroColor = driver?.team ? driver.color : guestTeam ? lastCar.colour || f1Constructor(guestTeam).color : a.teamColor;
    const lastFive = weekends.length ? weekends.slice(0, 5).reverse().map(w => ({ name: w.e?.name || w.name, e: w.e, ...finishOf(w.me?.result, en) })) : raceRows.slice(0, 5).reverse().map(r => ({ ...r, text: `P${r.pos}` }));
    // Their headshot (ESPN's; none, every footballer: TheSportsDB's cut-out, personPic finds it).
    const pic = el('span', { class: 'pic-slot' }, [personPic({ id, name: a.name, headshot: a.headshot || guest?.about?.photo || null, logo: fallback.logo, flag: a.flag }, league, 'xxl round')]);
    // The key numbers in a strip under the hero (the season's first few).
    const stripOf = () => {
      const keyNums = a.stats.list.slice(0, 4);
      return keyNums.length ? el('div', { class: 'team-strip' }, keyNums.map(x => el('div', { class: 'ts-cell' }, [el('strong', { class: 'num', text: x.value }), el('small', { text: statName(x.label, L(), { sport, long: x.name }) })]))) : null;
    };
    const stripBox = el('div', { class: 'strip-slot' }, [stripOf()]);
    const strip = stripBox;
    // Tabs: 概況 (the latest, this season), 數據 (the numbers), 近期比賽 (the
    // game log), 資料 (profile, honours); only those with something in them.
    const keep = list => list.filter(Boolean);
    const racing = sport === 'racing';
    // This season's numbers: 概況's card and 數據's rows, drawn again when a
    // game newer than ESPN's log comes in (the one on now among them).
    const seasonCardOf = () =>
      racing || !(a.stats.list.length || a.stats.none)
        ? null
        : card(seasonTitle(a.stats.title), a.stats.none ? el('p', { class: 'muted glog-none', text: W('本季例行賽還沒出賽', 'No regular-season games yet') }) : el('div', { class: 'stat-grid' }, a.stats.list.map(x => tile(statName(x.label, L(), { sport, long: x.name }), x.value, x.rank))), { sub: a.stats.live ? W('含進行中的比賽', 'With the game on now') : '' });
    let seasonCard = seasonCardOf();
    const rowsCardOf = () => (ov?.season ? card(en || !/career/i.test(ov.season.title) ? statsTitle(ov.season.title, L()) || T('season') : '生涯數據', el('div', { class: 'glog' }, ov.season.rows.map(r => seasonRow(r, ov.season.rows, sport, en))), { sub: a.stats.live ? W('含進行中的比賽', 'With the game on now') : '' }) : null);
    let rowsCard = rowsCardOf();
    const overview = keep([
      og.season
        ? card(W(`${year} 賽季`, `${year} season`), el('div', { class: 'stat-grid' }, [...freshSeason(og.season, champ).map(([k, v]) => f1Tile(k, v, en)), champ?.pos > 1 && champ.gap ? tile(W('落後領先者', 'Behind the leader'), champ.gap) : null].filter(Boolean)))
        : null,
      !og.season && champ
        ? card(
            W(`${year} 車手積分榜`, `${year} drivers' championship`),
            el('div', { class: 'stat-grid' }, [tile(W('排名', 'Place'), T('placeN', { n: champ.pos }), W(`共 ${champ.of} 位`, `of ${champ.of}`)), tile(W('積分', 'Points'), champ.points), champ.pos > 1 && champ.gap ? tile(W('落後領先者', 'Behind the leader'), champ.gap) : null, tile(W('完成站數', 'Races'), String(champ.races.length))].filter(Boolean))
          )
        : null,
      // (Not a stand-in's: he isn't in the next race.)
      nextRace && !guest ? nextRaceCard(nextRace, en) : null,
      outings.length ? outingsCard(outings, en) : null,
      guest?.about ? aboutCard(guest.about, en) : null,
      mateCard,
      seasonCard
    ]);
    // A team sport's player as his team's page has it (Jay 2026-10-30, one
    // shape for every page): 概況 opens on his team's next game and his last
    // line, 賽程 the next game then his game log.
    const nextBox = el('div', { class: 'team-next', hidden: true });
    const lastOf = lg => (lg?.games.length ? logCardOf({ ...lg, games: lg.games.slice(0, 1) }, W('上一場', 'Last game')) : null);
    let lastCard = racing ? null : lastOf(log);
    if (!racing) overview.unshift(...[nextBox, lastCard].filter(Boolean));
    if (!racing && a.teamId)
      scheduleOf().then(list => {
        const next = list.find(x => x.status.state !== 'post' && !x.status.void && Date.parse(x.start) > Date.now() - 4 * 3_600_000);
        if (!next || !s.dialog.isConnected) return;
        put(nextBox, el('p', { class: 'mini-h', text: W('下一場', 'Next game') }), el('div', { class: 'q-card list' }, [eventRow(next, { league: false })]));
        nextBox.hidden = false;
        const box2 = nextBox.cloneNode(false);
        put(box2, el('p', { class: 'mini-h', text: W('下一場', 'Next game') }), el('div', { class: 'q-card list' }, [eventRow(next, { league: false })]));
        box2.hidden = false;
        games.unshift(box2);
        if (!views.some(v => v[0] === 'games')) {
          const at = views.findIndex(v => v[0] === 'numbers' || v[0] === 'bio');
          views.splice(at >= 0 ? at : views.length, 0, ['games', W('賽程', 'Games'), games]);
          paintTab();
        }
        if (view === 'games') paintTab();
      });
    const numbers = keep([
      og.gp ? card(W('正賽', 'Grand Prix'), f1Tiles(og.gp, en)) : summaryTiles.length ? card(W('本季表現', 'This season'), el('div', { class: 'stat-grid' }, summaryTiles)) : null,
      og.sprint ? card(W('衝刺賽', 'Sprint'), f1Tiles(og.sprint, en)) : null,
      rowsCard,
      ov?.rankings?.length ? card(T('rankings'), el('div', { class: 'stat-grid' }, ov.rankings.map(x => tile(statName(x.label, L(), { sport, long: x.long }), x.value, x.rank)))) : null,
      og.career ? card(W('生涯數據', 'Career'), f1Tiles(og.career, en)) : null
    ]);
    const games = keep([
      logCard,
      weekends.length ? f1Weekends(weekends, en, [{ key: 'me', head: '' }]) : null,
      // (Jolpica's results not in: ESPN's finishes, drawn the same way.)
      !weekends.length && raceRows.length
        ? f1Weekends(
            raceRows.map((r, i) => ({ e: r.e, round: r.e?.round || raceRows.length - i, me: { result: { position: String(r.pos), positionText: String(r.pos), points: RACE_PTS[r.pos - 1] || 0 }, sprint: r.sprint ? { position: String(r.sprint), positionText: String(r.sprint), points: SPRINT_PTS[r.sprint - 1] || 0 } : null } })),
            en,
            [{ key: 'me', head: '' }],
            { grid: false }
          )
        : null
    ]);
    // 資料: who he is and how he got here: the profile, every team he has
    // played for (his career, read behind the page), his honours.
    const profileCard = facts.length ? card(T('profile'), el('ul', { class: 'info-list' }, facts.map(([k, v]) => el('li', {}, [el('span', { class: 'info-k', text: k }), el('span', { class: 'info-v' }, [v])])))) : null;
    const teamBtn = driver?.team || guestTeam ? el('button', { class: 'q-btn block with-mark', type: 'button', onclick: () => openConstructor({ id: '', name: driver?.team || guestTeam, en: driver?.team || guestTeam }) }, [constructorBadge(driver?.team || guestTeam, 'sm'), el('span', { text: `${en ? driver?.team || guestTeam : f1Constructor(driver?.team || guestTeam).zh} ›` })]) : null;
    let teamsCard = null;
    const bioOf = () => keep([profileCard, teamsCard, awardsCard, teamBtn]);
    const bio = bioOf();
    // 本場 first when opened from a game: his numbers in it, live (drawn
    // again with each of the game page's refreshes while this one is open).
    const views = [
      game ? ['game', W('本場', 'This game'), () => gameCards(game, id, league)] : null,
      ['overview', W('概況', 'Overview'), overview],
      ['games', W('賽程', 'Games'), games],
      ['numbers', W('數據', 'Stats'), numbers],
      ['bio', W('資料', 'Bio'), bio]
    ].filter(v => v && (typeof v[2] === 'function' || v[2].length));
    let view = views[0]?.[0];
    const tabsBox = el('div');
    const tabBody = el('div', { class: 'team-tab' });
    swipeTabs(tabBody, () => ({ list: views.map(v => v[0]), now: view, go: k => ((view = k), paintTab()) }));
    const paintTab = () => {
      put(tabsBox, views.length > 1 ? segmented(views.map(([k, label]) => [k, label]), view, v => ((view = v), paintTab())) : null);
      const v = views.find(x => x[0] === view)?.[2];
      put(tabBody, ...((typeof v === 'function' ? v() : v) || []));
    };
    // His career, read behind the page (資料 and 數據 aren't what it opens
    // on): 資料's teams and honours, 數據's seasons, the draft's team.
    playerCareer(league, id, a)
      .then(c => {
        if (!c || !s.dialog.isConnected) return;
        const draftTeam = c.draftTeam;
        if (draftTeam && draftNode) draftNode.after(el('span', { class: 'info-sub', text: `${en ? draftTeam.name : teamNameZh(LEAGUES[league]?.play || league, draftTeam.name, sport)?.short || draftTeam.short || draftTeam.name}` }));
        teamsCard = careerTeams(c, a, league, sport, en);
        if (!awardsCard && c.awards?.length) awardsCard = awardsOf(c.awards, true);
        bio.splice(0, bio.length, ...bioOf());
        const table = seasonsCard(c, sport, en);
        if (table) numbers.push(table);
        let added = false;
        for (const [k, label, list] of [['numbers', W('數據', 'Stats'), numbers], ['bio', W('資料', 'Bio'), bio]]) {
          if (!list.length || views.some(v => v[0] === k)) continue;
          const at = k === 'numbers' ? views.findIndex(v => v[0] === 'bio') : -1;
          views.splice(at < 0 ? views.length : at, 0, [k, label, list]);
          added = true;
        }
        if (added || view === 'bio' || view === 'numbers') paintTab();
      })
      .catch(() => {});
    if (game) {
      const live = () => (s.dialog.isConnected ? view === 'game' && tabBody.isConnected && put(tabBody, ...gameCards(game, id, league)) : game.subs.delete(live));
      game.subs.add(live);
      s.dialog.addEventListener('close', () => game.subs.delete(live));
    }
    put(
      content,
      el('div', { class: `team-head player-hero${heroColor ? ' tinted' : ''}`, style: heroColor ? `--hero:${heroColor}` : null }, [
        pic,
        el('div', { class: 'team-head-text' }, [
          // The name a little smaller where long (fitNumbers on .team-head h3); a long
          // one on two lines, the given names over the surname (Donovan / Mitchell,
          // never Samir El / Mourabet); the number with the position under it.
          el('h3', {}, heroName(playerName(name, 'full', name))),
          // (The box scores' form under it, where it differs.)
          name !== a.name ? el('small', { class: 'muted', text: a.name || name }) : null,
          teamChip,
          el('p', { class: 'muted' }, joinNodes(sub, ' · ')),
          // Why he's out and when he's back, as the team's page says it (Jay, 2026-10-22), the report's word under it.
          a.injuries.length ? el('p', { class: 'injury-tag' }, joinNodes(['🩹', ...a.injuries.map(injuryText)], ' ')) : null,
        ]),
        followBtn,
        lastFive.length
          ? el('div', { class: 'hero-races' }, [
              el('small', { class: 'muted', text: W(`近${lastFive.length}站`, `Last ${lastFive.length}`) }),
              ...lastFive.map(r =>
                el('button', { class: 'hero-race', type: 'button', title: [r.name, r.out ? r.text : ''].filter(Boolean).join(' · '), onclick: r.e ? () => ctx.openEvent(splitWeekend(r.e, Date.now(), L()).find(x => x.sessionKey === 'Race') || r.e) : null }, [
                  raceFlag(r.e) || el('span', { class: 'race-flag' }),
                  el('span', { class: `pos-pill num${r.out ? ' out' : r.pos <= 3 ? ' podium' : ''}${r.pos === 1 ? ' win' : ''}`, text: r.code || r.text })
                ])
              )
            ])
          : null
      ]),
      // Why he's out and when he's back (Jay, 2026-10-22: said only on the
      // team's page), the report's word under it: a card of its own under
      // the hero, whatever the tab.
      // (Three tiers, not one crowded line: the status and what's wrong, when he's back under it, the report's word below a hairline.)
      a.injury ? el('div', { class: 'q-card pad player-injury' }, [el('div', { class: 'player-inj' }, [el('span', { class: `inj-status ${injTone(a.injury.status)}`, text: injuryText(a.injury.status) }), (en ? a.injury.what : injuryWhatZh(a.injury.what)) ? el('strong', { text: en ? a.injury.what : injuryWhatZh(a.injury.what) }) : null]), backText(a.injury.back, a.injury.comment) ? el('p', { class: 'player-inj-back num', text: backText(a.injury.back, a.injury.comment) }) : null, a.injury.comment ? el('p', { class: 'injury-note muted' }, [zhLater(a.injury.comment)]) : null]) : null,
      strip,
      tabsBox,
      tabBody
    );
    paintTab();
    // 聯盟排名: where he stands in each of the league's 數據領先 lists (its
    // top hundred), the best places first, put into 概況 once read; two at least.
    if (!racing && hasLeaders(sport, LEAGUES[league]?.espn))
      leagueLeaders(league)
        .then(data => {
          // (Not those the season's card above already ranks.)
          const above = new Set((a.stats?.list || []).filter(x => x.rank).map(x => statName(x.label, L(), { sport, long: x.name })));
          const every = playerRanks(data, id, a.name);
          const ranks = every.filter(r => !above.has(leaderLabel(r.stat, sport, en))).slice(0, 6);
          // One place alone (a bench player's lone 第 74 名) says little and left a near-empty card: none then.
          if (ranks.length < 2 || !s.dialog.isConnected) return;
          // (The lists' length, not the best place's: a rate's 94 qualified made it "前 94 名".)
          const top = Math.min(100, Math.max(...every.map(r => r.of)));
          const rc = card(
            W('聯盟排名', 'League ranks'),
            el('div', {}, [
              el('div', { class: 'stat-grid' }, ranks.map(r => tile(leaderLabel(r.stat, sport, en), r.value, W(`第 ${r.rank} 名`, `#${r.rank}`)))),
              every.length > ranks.length ? el('button', { class: 'section-more lb-more', type: 'button', onclick: () => ((view = 'numbers'), paintTab()), text: W('全部聯盟排名 ›', 'All league ranks ›') }) : null
            ]),
            { sub: W(`各項前 ${top} 名裡`, `Within each top ${top}`) }
          );
          // 數據: every list he's in, in the lists' own order (a team's 數據 ranks every stat too).
          const all = card(W('聯盟排名', 'League ranks'), el('div', { class: 'stat-grid dense' }, every.map(r => tile(leaderLabel(r.stat, sport, en), r.value, W(`第 ${r.rank} 名`, `#${r.rank}`)))), { sub: W(`各項前 ${top} 名裡`, `Within each top ${top}`) });
          const rowsAt = numbers.indexOf(rowsCard);
          numbers.splice(rowsAt >= 0 ? rowsAt + 1 : numbers.length, 0, all);
          if (!views.some(v => v[0] === 'numbers')) views.splice(views.findIndex(v => v[0] === 'bio') >= 0 ? views.findIndex(v => v[0] === 'bio') : views.length, 0, ['numbers', W('數據', 'Stats'), numbers]);
          const at = overview.findIndex(c => c?.dataset?.kind === 'season');
          overview.splice(at >= 0 ? at + 1 : overview.length, 0, rc);
          if (!views.some(v => v[0] === 'overview')) views.splice(game ? 1 : 0, 0, ['overview', W('概況', 'Overview'), overview]);
          if (view === 'overview' || view === 'numbers') paintTab();
        })
        .catch(() => {});
    // The games ESPN's log hasn't caught up with (it's a day behind, and
    // MLB's leaves the postseason out): the team's games over since its
    // newest, his line from each one's box score, at once.
    if (log && a.teamId && !racing)
      newerGames(league, id, a.teamId, log, scheduleOf, a.name).then(newer => {
        // (This season begun: its preseason left out here too.)
        if (ov?.now) newer = newer.filter(g => !g.pre);
        if (!newer.length || !s.dialog.isConnected) return;
        const all = [...newer, ...log.games];
        const swap = (list, old, fresh) => {
          const at = list.indexOf(old);
          if (at >= 0) list[at] = fresh;
          else list.unshift(fresh);
          if (old?.isConnected) old.replaceWith(fresh);
          return fresh;
        };
        logCard = swap(games, logCard, logBox({ ...log, games: all.slice(0, Math.max(log.games.length, 5)) }));
        if (lastCard) lastCard = swap(overview, lastCard, lastOf({ ...log, games: all }));
        if (!views.some(v => v[0] === 'games')) {
          const at = views.findIndex(v => v[0] === 'numbers' || v[0] === 'bio');
          views.splice(at >= 0 ? at : views.length, 0, ['games', W('賽程', 'Games'), games]);
          paintTab();
        }
        // ESPN's card still last season's: this season's numbers with these games (the one on now counted, said so).
        const line = ov?.now ? logSeasonLine({ labels: log.labels, games: all }, logSeason(league)) : null;
        if (!line) return;
        a.stats = { ...line.stats, live: all.some(g => g.live) };
        ov.season = { ...ov.season, rows: [line.row, ...ov.season.rows.filter(r => /career/i.test(r.name))] };
        seasonCard = swap(overview, seasonCard, seasonCardOf());
        rowsCard = swap(numbers, rowsCard, rowsCardOf());
        put(stripBox, stripOf());
      });
  } catch {
    put(content, empty(T('failed')));
  }
}

// ---- An F1 team ---------------------------------------------------------------------------
//
// ESPN has no page for a constructor: its place and points from the
// championship, its two drivers (the kit's grid) with their photos and points,
// and each weekend this season (both drivers' finishes, the points the team took).
const RACE_PTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_PTS = [8, 7, 6, 5, 4, 3, 2, 1];
// A team's logo on its colour (its short name if the logo can't be had).
export const constructorBadge = (name, cls = '') => {
  const c = f1Constructor(name);
  const disc = el('span', { class: `logo team-disc ${cls}`, style: `--team:${c.color}`, 'aria-hidden': 'true' });
  disc.append(c.logo ? logoPicture(c.logo, null, 'team-disc-img', () => document.createTextNode(c.short)) : document.createTextNode(c.short));
  return disc;
};
export async function openConstructor(row) {
  const league = 'f1';
  const c = f1Constructor(row.en || row.name);
  const en = L() === 'en';
  const W = (zh, eng) => (en ? eng : zh);
  const s = sheet(leagueName(league, L()), { league, accent: c.color });
  const content = el('div', {}, [spinner()]);
  s.body.append(content);
  try {
    const [table, races, official] = await Promise.all([freshStandings(league).catch(() => null), seasonEvents(league).then(settleScoring).catch(() => []), f1Official('constructors', { page: c.page, name: c.name }).catch(() => null)]);
    const og = official?.grids || {};
    const jw = (official?.weekends || []).map(w => ({ ...w, e: eventOfRace(races, w.date) }));
    const groups = table || [];
    const teams = groups.find(g => g.rows.some(r => !r.athlete))?.rows || [];
    const at = teams.findIndex(r => r.id === row.id || f1Constructor(r.en || r.name).name === c.name);
    const me = teams[at] || row;
    const drivers = (groups.find(g => g.rows.some(r => r.athlete))?.rows || []).map((r, i) => ({ ...r, pos: i + 1 })).filter(r => f1Driver(r.en || r.name).team === c.name);
    const ids = new Set(drivers.map(d => d.id));
    // The team's cars this season (most races first), named as the app names them.
    const carRank = d => {
      const i = drivers.findIndex(x => f1Driver(x.en || x.name).surname === d.familyName);
      return i < 0 ? 9 : i;
    };
    const carCount = new Map();
    for (const w of jw) for (const r of w.rows) carCount.set(r.driverId, { n: (carCount.get(r.driverId)?.n || 0) + 1, d: r.result.Driver });
    const cars = [...carCount]
      .sort((x, y) => carRank(x[1].d) - carRank(y[1].d) || y[1].n - x[1].n)
      .slice(0, 3)
      .map(([key, { d }]) => ({ key, head: d.familyName, full: `${d.givenName} ${d.familyName}`, code: d.code || String(d.familyName).slice(0, 3).toUpperCase() }));
    // Each weekend: the drivers' race finishes and the team's points (race and sprint).
    const weekends = races
      .map(e => {
        const race = (e.sessions || []).find(x => x.abbr === 'Race' && x.status.state === 'post');
        if (!race) return null;
        const sprint = (e.sessions || []).find(x => x.abbr === 'SR' && x.status.state === 'post');
        const fin = drivers.map(d => race.field.findIndex(f => f.id === d.id) + 1);
        const pts = race.field.reduce((n, f, i) => n + (ids.has(f.id) ? RACE_PTS[i] || 0 : 0), 0) + (sprint?.field || []).reduce((n, f, i) => n + (ids.has(f.id) ? SPRINT_PTS[i] || 0 : 0), 0);
        return { e, start: race.start, fin, pts };
      })
      .filter(Boolean)
      .sort((x, y) => y.start.localeCompare(x.start));
    const all = weekends.flatMap(w => w.fin.filter(p => p > 0));
    const wins = weekends.filter(w => w.fin.includes(1)).length;
    const podiums = all.filter(p => p <= 3).length;
    // Both cars on the podium: said beside the drivers (車手 · 雙登台 5 次).
    const doubles = weekends.filter(w => w.fin.length === 2 && w.fin.every(p => p > 0 && p <= 3)).length;
    const next = races.find(e => e.status.state !== 'post' && (e.sessions || []).some(x => x.status.state !== 'post'));
    const pts = me.stats?.PTS ?? '';
    // Followed by the kit's name (ESPN's constructor ids aren't kept anywhere else).
    const side = { id: `f1team:${c.name}`, name: c.name, en: c.name, f1team: true };
    const followBtn = followButton(() => ctx.isFollowed(league, side.id), () => ctx.toggleFollow(league, side));
    put(
      content,
      el('div', { class: 'team-head player-hero tinted wide-sub', style: `--hero:${c.color}` }, [
        constructorBadge(c.name, 'xl'),
        el('div', { class: 'team-head-text' }, [
          el('h3', { text: en ? c.name : c.zh }),
          !en && c.zh !== c.name ? el('small', { class: 'muted', text: c.name }) : null,
          el('p', { class: 'muted team-place', text: [at >= 0 ? W(`車隊積分榜第\u00a0${at + 1}`, `P${at + 1} in the constructors'`) : '', pts !== '' ? W(`${pts}\u00a0分`, `${pts}\u00a0pts`) : ''].filter(Boolean).join(' · ') })
        ]),
        followBtn
      ]),
      el('div', { class: 'team-tiles' }, [
        tile(W('排名', 'Place'), at >= 0 ? `P${at + 1}` : '–'),
        tile(W('積分', 'Points'), String(pts || '–')),
        tile(W('分站冠軍', 'Wins'), String(wins)),
        tile(W('頒獎台', 'Podiums'), String(podiums))
      ]),
      drivers.length
        ? card(
            W('車手', 'Drivers'),
            el(
              'div',
              { class: 'team-drivers' },
              drivers.map(d =>
                el('button', { class: 'team-driver', type: 'button', onclick: () => ctx.openPlayer(league, d.id, d) }, [
                  personPic(d, league, 'lg round'),
                  el('strong', { text: en ? d.en || d.name : f1Driver(d.en || d.name).zh }),
                  el('small', { class: 'muted num', text: `P${d.pos} · ${d.stats?.PTS ?? 0} ${W('分', 'pts')}` }),
                ])
              )
            ),
            { sub: doubles ? W(`雙登台 ${doubles} 次`, `${doubles} double podium${doubles > 1 ? 's' : ''}`) : '' }
          )
        : null,
      og.gp ? card(W('正賽', 'Grand Prix'), f1Tiles(og.gp, en)) : null,
      og.sprint ? card(W('衝刺賽', 'Sprint'), f1Tiles(og.sprint, en)) : null,
      next ? el('h3', { class: 'section-h', text: W('下一站', 'Next') }) : null,
      next ? el('div', { class: 'q-card list' }, splitWeekend(next, Date.now(), L()).filter(x => x.status.state !== 'post').map(x => eventRow(x, { league: false }))) : null,
      jw.length && cars.length ? f1Weekends(jw, en, cars) : null,
      og.career ? card(W('車隊歷史', 'Highlights'), f1Tiles(og.career, en)) : null,
      og.profile ? card(W('車隊資料', 'Team profile'), el('ul', { class: 'info-list' }, og.profile.map(([k, v]) => el('li', {}, [el('span', { class: 'info-k', text: f1Label(k, en) }), el('span', { class: 'info-v' }, [k === 'Base' && !en ? zhLater(v) : v])])))) : null,
      // (Jolpica's results not in: ESPN's race finishes, drawn the same way.)
      !jw.length && weekends.length
        ? f1Weekends(
            weekends.map((w, i) => ({ e: w.e, round: w.e.round || weekends.length - i, points: w.pts, rows: drivers.map((d, k) => ({ driverId: d.id, result: w.fin[k] > 0 ? { position: String(w.fin[k]), positionText: String(w.fin[k]) } : null })) })),
            en,
            drivers.map(d => { const full = d.en || d.name; const last = f1Driver(full).surname || full.split(' ').at(-1); return { key: d.id, head: last, full, code: last.slice(0, 3).toUpperCase() }; })
          )
        : null
    );
  } catch {
    put(content, empty(T('failed')));
  }
}


// ---- Standings tables -----------------------------------------------------------------------

// mark: team ids to highlight (a match's two sides); followed teams always are.
// The race above a table (title.mjs standingsRace), a line each, like a
// sports app's "what's still to play for": the title (won; close: what the
// leader still needs; early: the soonest it can be), the next places still
// open (F1's runner-up, or once the title's gone), and what ESPN's zones
// (Champions League, relegation…) have settled. Settled places get a lock.
const GLYPH = {
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5.5a2.5 2.5 0 0 0 2.6 3.6M16 6h2.5a2.5 2.5 0 0 1-2.6 3.6M12 13v4M8.5 20h7"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2"/>',
  medal: '<circle cx="12" cy="14.5" r="4.5"/><path d="M8.5 3.5 12 10l3.5-6.5"/>',
  lock: '<rect x="6.5" y="11" width="11" height="8.5" rx="2"/><path d="M9 11V8.5a3 3 0 0 1 6 0V11"/>'
};
const glyph = (k, cls = '') => el('span', { class: `race-g ${cls}`.trim(), html: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPH[k]}</svg>` });
// ESPN's zone notes in Chinese, each its own name (every note the leagues
// use, checked 2026-10: two zones never read the same in a legend).
const ZONE_ZH = [
  [/qualif\w* for (the )?(qfs?|quarter-?finals?)/i, '晉級八強'],
  [/qualif\w* for (the )?round of 16/i, '晉級16強'],
  [/knockout phase play-?offs?.*\bunseeded/i, '淘汰附加賽（非種子）'],
  [/knockout phase play-?offs?.*\bseeded/i, '淘汰附加賽（種子）'],
  [/knockout phase play-?offs?/i, '淘汰附加賽'],
  [/wild ?card/i, '季後賽外卡'],
  [/play-?offs?.*round one|round one/i, '季後賽首輪'],
  [/relegation or play-?offs?/i, '降級或附加賽'],
  [/champions league qualif/i, '歐冠資格賽'],
  [/europa league qualif/i, '歐霸資格賽'],
  [/conference league qualif/i, '歐協聯資格賽'],
  [/champions league/i, '歐冠'],
  [/europa league/i, '歐霸'],
  [/conference league/i, '歐協聯'],
  [/relegation play/i, '降級附加賽'],
  [/relegat/i, '降級'],
  [/promotion play/i, '升級附加賽'],
  [/promotion/i, '升級'],
  [/eliminated/i, '淘汰'],
  [/play-?offs?/i, '季後賽'],
  [/play-?in/i, '附加賽']
];
// And in English, as short (ESPN's "Qualifies for MLS Cup Playoffs - Wild Card Matches" is a wild card).
const ZONE_EN = { 晉級八強: 'quarter-finals', 晉級16強: 'last 16', '淘汰附加賽（非種子）': 'play-offs (unseeded)', '淘汰附加賽（種子）': 'play-offs (seeded)', 淘汰附加賽: 'play-offs', 季後賽外卡: 'wild card', 季後賽首輪: 'playoffs', 降級或附加賽: 'relegation or play-off', 歐冠資格賽: 'UCL qualifying', 歐霸資格賽: 'UEL qualifying', 歐協聯資格賽: 'UECL qualifying', 歐冠: 'Champions League', 歐霸: 'Europa League', 歐協聯: 'Conference League', 降級附加賽: 'relegation play-off', 降級: 'relegation', 升級附加賽: 'promotion play-off', 升級: 'promotion', 淘汰: 'elimination', 季後賽: 'playoffs', 附加賽: 'play-in' };
export const zoneName = n => {
  const zh = ZONE_ZH.find(([re]) => re.test(n))?.[1];
  return L() === 'en' ? ZONE_EN[zh] || n : zh || n;
};
// The day a side plays its n-th game from now, from its own schedule (Jay,
// 2026-10-28: "第 44 場" says nothing in the NBA; the Premier League's
// 第 12 輪 does, a league without rounds has its calendar). null till it's in.
// (Its opponent too: a game against the rival is a win for one, never both.)
const clinchGames = new Map();
function clinchGame(league, id, n, redo) {
  const key = `${league}:${id}:${n}`;
  if (clinchGames.has(key)) return clinchGames.get(key);
  clinchGames.set(key, null);
  teamSchedule(league, id).then(games => {
    const e = games.filter(e => e.status?.state !== 'post')[n - 1];
    if (!e?.start || Number.isNaN(Date.parse(e.start))) return;
    clinchGames.set(key, e);
    redo();
  }, () => {});
  return null;
}
function raceBlock(race, g, league, many) {
  if (!race) return null;
  const W = (zh, eng) => (L() === 'en' ? eng : zh);
  const sport = LEAGUES[league]?.sport;
  const nm = r => r.short || r.name;
  // A driver by family name on a card's second line (one row at 375 px), a team as it is.
  const last = r => (r?.athlete ? String(nm(r)).split(' ').at(-1) : nm(r));
  // A space between Chinese and a Latin name or a number (Russell 沒贏, 前 8 名), none twice.
  const spaced = x => (L() === 'en' ? x : x.replace(/([\u3400-\u9fff])([A-Za-z0-9])/g, '$1 $2').replace(/([A-Za-z0-9.])([\u3400-\u9fff])/g, '$1 $2'));
  // A side playing now (its game isn't in the table till it's over: liveTable).
  const onNow = id => (ctx.recentOf?.(league) || []).some(e => e.status?.state === 'in' && (e.home?.id === id || e.away?.id === id));
  // (`sub` said several ways, fullest first: the first that fits one line.)
  // (`main` too: several ways, fullest first, e.g. the leader's full name then the family name.)
  const line = (icon, main, sub = '', cls = '') => {
    const ways = [].concat(sub).filter(Boolean);
    const mains = [].concat(main).filter(Boolean);
    return el('div', { class: `race-line ${cls}`.trim() }, [glyph(icon), el('span', { class: 'race-t' }, [mains.length > 1 ? fitChoice(el('span', { class: 'race-main' }), mains.map(html => ({ html }))) : el('span', { html: mains[0] || '' }), ways.length > 1 ? fitChoice(el('small'), ways) : ways.length ? el('small', { text: ways[0] }) : null])]);
  };
  // (Its words go in as HTML for the <b>: every name and word from a feed escaped, never read as markup, an & kept.)
  const b = x => `<b>${esc(x)}</b>`;
  // Football, settled by the next game: as results, never points (Jay
  // 2026-10-30): "新英格蘭革命下一場贏邁阿密國際即可" when the two meet (a win
  // is 3 for one and none for the other), else each side's own next game
  // ("納什維爾下一場贏，或邁阿密國際下一場沒贏"). One rival to name (any other
  // stopped by the same results); the opponent from the holder's schedule
  // (said once it's in).
  const resultLine = t => {
    if (sport !== 'soccer' || t.soonest !== 1 || !t.margins?.length) return [];
    const game = clinchGame(league, t.leader.id, 1, () => redo());
    if (!game) return [];
    const vs = game.home?.id === t.leader.id ? game.away?.id : game.away?.id === t.leader.id ? game.home?.id : null;
    const needs = nextNeeds(t.margins, vs);
    if (needs?.length !== 1) return [];
    const [{ row, need }] = needs;
    // A side playing now: its next game is this one (這場).
    const nx = r => (onNow(r.id) ? W('這場', ' this game') : W('下一場', ' next'));
    const [me, R] = [nx(t.leader), nm(row)];
    const they = nx(row);
    const say = L => ({
      beat: W(`${L}${me}贏${R}`, `${L} beat ${R}${me}`),
      unbeaten: W(`${L}${me}對${R}不敗`, `${L} avoid defeat to ${R}${me}`),
      winOrTheyDont: W(`${L}${me}贏，或${R}${they}沒贏`, `${L} win${me}, or ${R} don't win`),
      unbeatenOrTheyDont: W(`${L}${me}不敗，或${R}${they}沒贏`, `${L} avoid defeat${me}, or ${R} don't win`),
      noWorse: W(`${L}${me}戰果不比${R}差`, `${L} do no worse than ${R}${me}`),
      better: W(`${L}${me}戰果比${R}好`, `${L} do better than ${R}${me}`),
      winTheyDont: W(`${L}${me}贏且${R}${they}沒贏`, `${L} win${me} and ${R} don't`),
      winTheyLose: W(`${L}${me}贏且${R}${they}輸`, `${L} win${me} and ${R} lose`)
    })[need].trim();
    return [say(nm(t.leader)) + W('即可', ''), say(nm(t.leader)), say(last(t.leader)), say('')].map(x => spaced(x[0].toUpperCase() + x.slice(1)));
  };
  // What the soonest clinch takes, as one number (the owner, 2026-10-16:
  // the lead it takes then, over everyone: 領先 102 分，美國站後領先達
  // 126 分即封王; a sum against the runner-up was wrong, a third can catch up).
  const leadLine = t => {
    const span = sport === 'racing' ? (t.at || (t.soonest === 1 ? W('下一站', 'the next race') : W(`${t.soonest} 站`, `${t.soonest} races`))) : t.soonest === 1 ? (perRound ? W('這一輪', 'this round') : W('下一場', 'the next game')) : W(`${t.soonest} ${perRound ? '輪' : '場'}`, `${t.soonest} ${perRound ? 'rounds' : 'games'}`);
    const now = t.gap > 0 ? W(`領先 ${t.gap} 分`, `${t.gap} pts ahead`) : W(`與第${'二三四五六七八九十'[t.place || 0] || ` ${(t.place || 0) + 2} `}名同分`, 'level on points');
    // (Short, on one line: the title above says what for; a lead is over everyone.)
    return W(`${now}，${span}後需領先 ${t.leadAt} 分`, `${now}; needs ${t.leadAt} after ${span}`);
  };
  // F1's next weekend as results (title.mjs weekend): "Antonelli 前 8 名完賽，
  // 或 Russell 沒贏即可"; a place on a race-only weekend, else points.
  const weekendLine = t => {
    const x = t.weekend;
    if (!x || (!x.mine && !x.theirs)) return [];
    if (x.mine?.pts === 0) return [W('無論結果', 'whatever happens')];
    // (The holder's part with its name, and without: the line above names it.)
    const mineOf = me => x.mine && (x.mine.place === 1 ? W(`${me}贏下這站`, `${me} win${me ? '' : ' it'}`.trim()) : x.mine.place ? W(`${me}前${x.mine.place}名`, `${me} top ${x.mine.place}`.trim()) : W(`${me}拿到${x.mine.pts}分`, `${me} score ${x.mine.pts}`.trim()));
    const stop = r => (r.place === 1 ? W('沒贏', " doesn't win") : r.place ? W(`沒進前${r.place}`, ` misses the top ${r.place}`) : W(`拿不到${r.pts}分`, ` scores under ${r.pts}`));
    // (Two rivals held to the same: "Russell、Hamilton 都沒贏".)
    const same = x.theirs && x.theirs.every(r => stop(r) === stop(x.theirs[0]));
    const theirs = x.theirs && (same && x.theirs.length > 1 ? W(`${x.theirs.map(r => last(r.row)).join('、')}都${stop(x.theirs[0])}`, `${x.theirs.map(r => last(r.row)).join(' and ')} both${stop(x.theirs[0]).replace("doesn't", "don't").replace('misses', 'miss').replace('scores', 'score')}`) : x.theirs.map(r => `${last(r.row)}${stop(r)}`).join(W('且', ' and ')));
    const both = me => [mineOf(me), theirs].filter(Boolean).join(W('，或', ', or '));
    const ways = [both(last(t.leader)) + W('即可', ''), both(last(t.leader)), both('')];
    // Narrowest: the holder's part alone ("墨西哥站前 8 名即可": enough by itself).
    if (x.mine) ways.push(W(`${spanWord(t)}${mineOf('')}即可`, `${spanWord(t)}: ${mineOf('')}`));
    return ways.map(spaced);
  };
  const lines = [];
  const t = race.title;
  // A cup's league phase has no champion: its first place is said as that.
  // A table under its own heading (a group, a half, the league phase) is
  // said plainly: 第一 (the heading says of what), the line kept to one row.
  const phase = Boolean(LEAGUES[league]?.cup) && !many;
  many = many || phase;
  // A division's first is its title (MLB's 美聯東區: 拿下分區冠軍).
  const top = many ? (g?.parent ? W('分區冠軍', 'the division') : W('第一', 'first place')) : '';
  const unit = race.unit === 'pts' ? W(' 分', ' pts') : W(' 場', '');
  // Football's rounds as the league counts them: a matchweek league's and a
  // cup's league phase are each side's games (第 N 輪, 第 N 比賽日); MLS's
  // matchdays are its calendar's (a side sits some out): said in games.
  const perRound = sport === 'soccer' && (roundKind(league) === 'matchweek' || Boolean(LEAGUES[league]?.cup));
  const roundAt = (n, bold = x => x) => (L() === 'en' ? `${roundLabel(league, n, n, 'en').replace(/\d+/, bold)}` : roundLabel(league, n).replace(/\d+/, bold));
  const leftWord = n => (sport === 'racing' ? W(`還剩 ${n} 站`, `${n} to go`) : perRound ? W(`還剩 ${n} ${roundKind(league) === 'matchday' ? '個比賽日' : '輪'}`, `${n} ${roundKind(league) === 'matchday' ? 'matchday' : 'matchweek'}${n === 1 ? '' : 's'} to go`) : W(`還剩 ${n} 場`, `${n} game${n === 1 ? '' : 's'} to go`));
  // The soonest as the leader's game day (4/2), once its schedule's in: a league without rounds (the NBA, MLB, MLS).
  let redo = () => {};
  const dayOf = t => {
    if (perRound || sport === 'racing' || !(t.soonest > 0) || !t.leader?.id) return '';
    const e = clinchGame(league, t.leader.id, t.soonest, () => redo());
    if (!e) return '';
    const d = new Date(Date.parse(e.start));
    return L() === 'en' ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : `${d.getMonth() + 1}/${d.getDate()}`;
  };
  const when = t => (t.soonest == null ? '' : perRound ? W(`最快${roundAt(t.round)}`, `${roundAt(t.round)} at the earliest`) : sport === 'racing' ? (t.at ? W(`最快${t.at}`, `${t.at} at the earliest`) : W(`最快再 ${t.soonest} 站`, `${t.soonest} race weekends from now at the earliest`)) : (dayOf(t) ? W(`最快 ${dayOf(t)}`, `${dayOf(t)} at the earliest`) : W(`最快第 ${t.round} 場`, `game ${t.round} at the earliest`)));
  // The span to the soonest: 墨西哥站, 接下來 2 站, 這一輪, 下一場.
  const spanWord = t => (sport === 'racing' ? (t.soonest === 1 ? t.at || W('下一站', 'the next race') : W(`接下來 ${t.soonest} 站`, `the next ${t.soonest} races`)) : t.soonest === 1 ? (perRound ? W('這一輪', 'this round') : W('下一場', 'the next game')) : W(`接下來 ${t.soonest} ${perRound ? '輪' : '場'}`, `the next ${t.soonest} ${perRound ? 'rounds' : 'games'}`));
  // What it takes by then against each rival who could still stop it
  // (title.mjs margins): "墨西哥站比 Russell 多拿 7 分即可", "接下來 2 站不被
  // Russell 多拿 30 分即可"; two rivals at most, else the lead it takes.
  const marginLine = t => {
    const ms = t.margins;
    if (!ms?.length || ms.length > 2) return [];
    const part = ({ row, d }) => (d > 0 ? W(`比${last(row)}多拿${d}分`, `outscore ${last(row)} by ${d}`) : d === 0 ? W(`得分不少於${last(row)}`, `match ${last(row)}`) : W(`不被${last(row)}多拿${1 - d}分`, `not be outscored by ${last(row)} by ${1 - d}`));
    return [spaced(W(`${spanWord(t)}${ms.map(part).join('、')}即可`, `${spanWord(t)}: ${ms.map(part).join(', ')}`)), spaced(W(`${spanWord(t)}${ms.map(part).join('、')}`, `${spanWord(t)}: ${ms.map(part).join(', ')}`))];
  };
  // A place's race (the title's; F1's runner-up's once it's won): its clock
  // line by the soonest it can be settled, what it takes under it.
  const chaseLine = (t, k = 0) => {
    const name = k ? W(`第 ${k + 1} 名`, `P${k + 1}`) : many ? top : W('冠軍', 'The title');
    if (t.soonest != null && t.soonest <= 5) {
      // Wins: baseball's magic number (the leader's wins and the rivals' losses together).
      // Points: a title closes from both sides (the leader scoring, the rival
      // not), so say when at the soonest, and what it takes by then.
      if (race.unit === 'wins') return line('clock', W(`${b(nm(t.leader))} ${k ? `第 ${k + 1} 名` : many ? top : '封王'}魔術數字 ${b(t.magic)}`, `${b(nm(t.leader))}: ${k ? `P${k + 1} ` : ''}magic number ${b(t.magic)}`), when(t));
      const what = k ? W(`確定第 ${k + 1} 名`, `clinch P${k + 1}`) : many ? W(`確定${top}`, 'clinch 1st') : W('封王', 'clinch the title');
      const at = perRound ? W(`最快${roundAt(t.round, b)}`, `in ${roundAt(t.round, b)} at the earliest`) : sport === 'racing' ? (t.at ? W(`最快在${b(t.at)}`, `at ${b(t.at)} at the earliest`) : t.soonest === 1 ? W('最快下一站就', 'at the next race at the earliest') : W(`最快再 ${b(t.soonest)} 站`, `${b(t.soonest)} race weekends from now at the earliest`)) : t.soonest === 1 && onNow(t.leader.id) ? W('最快這場', 'this game') : dayOf(t) ? W(`最快 ${b(dayOf(t))} `, `on ${b(dayOf(t))} at the earliest`) : W(`最快第 ${b(t.round)} 場`, `in game ${b(t.round)} at the earliest`);
      // (English runs long: last, the place alone, "at the earliest" left to "could".)
      const near = sport === 'racing' && t.at ? `at ${b(t.at)}` : at;
      const says = (who, short) => W(`${b(who)} ${at}${what}`, `${b(who)} could ${what} ${short ? near : at}`);
      // (Chinese short of room: without the spaces, 最快11/2確定第2名, then made smaller: one row.)
      const tight = x => (L() === 'en' ? x : x.replace(/ (?=[\d<])|(?<=[\d>]) /g, '').replace(/(?<=最快) |(?<=第) | (?=名)/g, ''));
      return line('clock', [...new Set([says(nm(t.leader)), says(last(t.leader)), says(last(t.leader), true), ...(L() === 'en' ? [] : [tight(says(last(t.leader)))])])], [...resultLine(t), ...weekendLine(t), ...(sport === 'soccer' ? [] : marginLine(t)), leadLine(t)]);
    }
    if (t.soonest == null) return null;
    const next = g.rows[k + 1];
    // (The lead as the title's own sums have it: a table's points column isn't named alike in every league, and the line went blank.)
    const gap = next ? (race.unit === 'wins' ? Number(next.stats.GB) - (k ? Number(t.leader.stats.GB) || 0 : 0) : t.gap) : 0;
    // (The game is the season's, 82 a side in the NBA; the leader's record under it says how far off: 活塞 5 勝 1 敗.)
    // (Early on several share first: 與 76 人 等 3 隊 同勝.)
    const level = race.unit === 'wins' ? g.rows.slice(k + 1).filter(r => r.stats.W === t.leader.stats.W && r.stats.L === t.leader.stats.L).length : 1;
    const rec = race.unit === 'wins' ? W(` ${t.leader.stats.W} 勝 ${t.leader.stats.L} 敗，`, ` ${t.leader.stats.W}–${t.leader.stats.L},`) : '';
    return line('clock', W(`${name}${esc(when(t))}${dayOf(t) ? ' ' : ''}才會確定`, `${name}: ${esc(when(t))}`), !next ? '' : gap > 0 ? [true, false].map(full => W(`${nm(t.leader)}${full ? rec : ''} 領先 ${gap}${unit}`.replace('， ', '，'), `${nm(t.leader)}${full ? rec : ''} lead by ${gap}`)) : [true, false].map(full => W(`${nm(t.leader)}${full ? rec : ''} 與 ${nm(next)}${level > 1 ? ` 等 ${level} 隊` : ''} 同${race.unit === 'pts' ? '分' : '勝'}`.replace('， ', '，'), `${nm(t.leader)}${full ? rec : ''} level with ${nm(next)}${level > 1 ? ` +${level - 1}` : ''}`)));
  };
  // A line said again once its day is in (the schedule comes after the table).
  const chase = (t, k = 0) => {
    let shown = chaseLine(t, k);
    let tries = 0;
    redo = () => {
      const fresh = chaseLine(t, k);
      if (!fresh || !shown) return;
      if (!shown.isConnected) return tries++ < 20 && setTimeout(redo, 250);
      shown.replaceWith(fresh);
      shown = fresh;
    };
    return shown;
  };
  if (t.done) {
    const early = t.left > 0;
    lines.push(line('trophy', many ? W(`${b(nm(t.leader))} 拿下${top}`, `${b(nm(t.leader))} have clinched ${top}`) : W(`${b(nm(t.leader))} ${early ? '提前封王' : '奪冠'}`, `${b(nm(t.leader))} ${early ? 'have clinched the title' : 'are champions'}`), early ? leftWord(t.left) : '', 'won'));
    // Then the next place still open (第 2 名, then 第 3 名… as each is settled).
    const second = t.second && chase(t.second, t.second.place);
    if (second) lines.push(second);
  } else {
    const l = chase(t);
    if (l) lines.push(l);
  }
  // The next places still open: F1's always (a championship's 2nd and 3rd
  // matter), a league's once its title is settled.
  // The close fights still on (F1's, once the champion's decided).
  const team = !g.rows.some(r => r.athlete);
  for (const p of race.places) {
    const names = p.rows.slice(0, 3).map(nm).join(W('、', ', ')) + (p.rows.length > 3 ? W(` 等 ${p.rows.length} ${team ? '隊' : '位'}`, ` +${p.rows.length - 3}`) : '');
    const span = p.to > p.pos ? `${p.pos}–${p.to}` : `${p.pos}`;
    const fight = line('medal', W(`${b(`第 ${span} 名之爭`)} ${esc(names)}`, `${b(`Fight for P${span}`)} ${esc(names)}`), p.spread > 0 ? W(`前後相差 ${p.spread}${unit}`, `${p.spread}${unit} apart`) : W('同分', 'level on points'));
    fight.classList.add('fight');
    lines.push(fight);
  }
  // What the zones have settled.
  for (const z of race.zones) {
    if (!z.sure.length || z.sure.length === g.rows.length) continue;
    const who = z.sure.map(id => g.rows.find(r => r.id === id)).filter(Boolean);
    const names = who.slice(0, 4).map(nm).join(W('、', ', ')) + (who.length > 4 ? W(` 等 ${who.length} 隊`, ` +${who.length - 4}`) : '');
    const zn = zoneName(z.note);
    const row = line('lock', z.bottom ? W(`${b(`確定${zn}`)} ${esc(names)}`, `${b(`Confirmed: ${zn}`)} ${esc(names)}`) : W(`${b(`確定${zn}`)} ${esc(names)}`, `${b(`Sure of ${zn}`)} ${esc(names)}`));
    if (z.color) row.style.setProperty('--zone', z.color);
    row.classList.add('zone');
    lines.push(row);
  }
  // The zones' fights in the run-in: the way into anything (the last good
  // zone's edge) and out of the bottom first, then any other edge whose
  // sides are others. One row each: how many and how close; their names under it.
  const good = race.zones.filter(z => !z.bottom && !/relegat|eliminat/i.test(z.note));
  const order = z => (z.bottom ? 0 : z === good.at(-1) ? 0 : 1);
  const shown = new Set();
  for (const z of race.zones.filter(x => x.fight).sort((a, b) => order(a) - order(b) || a.fight.spread - b.fight.spread)) {
    if (z.fight.rows.some(r => shown.has(r.id))) continue;
    z.fight.rows.forEach(r => shown.add(r.id));
    // (The name without its bracket, 淘汰附加賽 not 淘汰附加賽（非種子）: one line.)
    const zn = zoneName(z.note).replace(/（.*）|\s*\(.*\)/, '');
    const n = z.fight.rows.length;
    const head = z.bottom ? W(`避開${zn}`, `Avoiding ${zn}`) : W(`${zn}之爭`, `${zn[0].toUpperCase()}${zn.slice(1)} race`);
    const how = W(` ${n} 隊・${z.fight.spread > 0 ? `相差 ${z.fight.spread} 分` : '同分'}`, ` · ${n} teams, ${z.fight.spread > 0 ? `${z.fight.spread} pts apart` : 'level'}`);
    // (Short of room: 外卡之爭 for 季後賽外卡之爭, the count alone.)
    const short = z.bottom ? head : W(`${zn.replace(/^季後賽/, '')}之爭`, head);
    const row = line('medal', [...new Set([`${b(head)}${esc(how)}`, `${b(short)}${esc(how)}`, `${b(short)}${esc(W(` ${n} 隊`, ` · ${n} teams`))}`])], '');
    // (Four names at most, the rest counted, on one line: fewer named where
    // four don't fit, "另 2 隊" never split off onto a line of its own, Jay
    // 2026-10-30; the head says how many.)
    const names = z.fight.rows.map(nm);
    const ways = [4, 3, 2, 1].filter(k => k <= names.length).map(k => {
      const shownNames = names.length > k && k === 4 ? names.slice(0, 3) : names.slice(0, k);
      const more = names.length - shownNames.length;
      return shownNames.join(W('、', ', ')) + (more ? W(`，另 ${more} 隊`, ` +${more}`) : '');
    });
    const small = row.querySelector('.race-t small') || row.querySelector('.race-t').appendChild(el('small'));
    small.replaceWith(fitChoice(el('small'), [...new Set(ways)]));
    if (z.color) row.style.setProperty('--zone', z.color);
    row.classList.add('zone', 'fight');
    lines.push(row);
  }
  // Two lines at most: the race still open first (the title's, or the next
  // place's once it's won), then a fight (F1's constructors', a zone's), then
  // a conference's or group's first already won (its row has the lock), then
  // what's been locked in.
  // (Jay 2026-10-30: the East said "Nashville have clinched first" and 2nd's
  // race, the West 1st's race and the wild cards: each the open race and its
  // fight now.) A league's own champion stays first: the season's news.
  const rank = l => (l.classList.contains('fight') ? 1 : many && l.classList.contains('won') ? 2 : l.classList.contains('zone') ? 3 : 0);
  const kept = lines.map((l, k) => [l, k]).sort((x, y) => rank(x[0]) - rank(y[0]) || x[1] - y[1]).slice(0, 2).map(([l]) => l);
  return kept.length ? el('div', { class: 'title-race' }, kept) : null;
}
// `open: false`: rows that open nothing (a club's own league from FotMob, its clubs not ESPN's).
// (`cols`: a table's own columns, the NBA Cup's groups' 勝 敗 得失分.)
export function standingsTables(groups, league, { mark = [], top = 0, compact = false, races = [], many = false, open = true, cols: own = null } = {}) {
  const sport = LEAGUES[league]?.sport;
  const want = own || STANDING_COLUMNS[sport] || ['W', 'L'];
  const small = own || COMPACT_COLUMNS[sport] || want;
  // Short headers in the reader's language.
  const colName = colLabel;
  return el(
    'div',
    { class: 'stack' },
    groups.map(g => {
      const cols = want.filter(c => g.rows.some(r => r.stats[c] != null && r.stats[c] !== ''));
      const rows = top ? g.rows.filter((r, i) => i < top || ctx.isFollowed(league, r.id)) : g.rows;
      // Columns beyond the essentials go on narrow screens (and in compact tables).
      // (場 the first to go on the narrowest screens where 落後 is there too: every side's mostly the same, and 落後 was cut at 320.)
      const cls = c => `num${!small.includes(c) ? ' extra' : ''}${c === 'GAP' || c === 'GB' ? ' gap' : ''}${c === 'GP' && cols.includes('GAP') ? ' gp' : ''}`;
      const race = races[groups.indexOf(g)];
      // A lock on a settled place (not when the whole table is: the season's over).
      const settled = new Set(race && race.rows.some(x => !x.settled) ? race.rows.filter(x => x.settled).map(x => x.id) : []);
      const out = outOfIt(g, race, league);
      return el('div', { class: 'q-card pad fx-card' }, [
        g.name ? el('p', { class: 'mini-h', text: g.name }) : null,
        raceBlock(race, g, league, many),
        el('div', { class: 'table-wrap' }, [
          el('table', { class: `data standings${compact ? ' compact' : ''}` }, [
            el('thead', {}, [el('tr', {}, [el('th', { class: 'left rank-cell', text: '#' }), el('th', { class: 'left name-cell' }), ...cols.map(c => el('th', { class: cls(c), text: colName(c) }))])]),
            el(
              'tbody',
              {},
              rows.map(r => {
                const i = g.rows.indexOf(r);
                const name = [el('span', { class: 'nm-full' }, [playerName(r.full || r.name, 'full', r.name)]), el('span', { class: 'nm-short', text: r.short || r.name })];
                const rowCls = [ctx.isFollowed(league, r.id) ? 'mine' : mark.includes(r.id) ? 'marked' : '', out.has(r.id) ? 'out' : ''].filter(Boolean).join(' ');
                return el('tr', { class: rowCls }, [
                  el('td', { class: 'left num rank-cell', style: r.color ? `box-shadow: inset 3px 0 0 ${r.color}` : null }, [String(i + 1), settled.has(r.id) ? glyph('lock', 'rank-lock') : null]),
                  el('th', { class: 'left name-cell' }, [
                    el(open ? 'button' : 'span', open ? { class: 'link team-link', type: 'button', onclick: () => (r.athlete ? r.id && ctx.openPlayer(league, r.id, r) : league === 'f1' ? openConstructor(r) : r.id && openTeam(league, r.id, r)) } : { class: 'team-link' }, [r.athlete ? personPic(r, league, 'xs round') : league === 'f1' ? constructorBadge(r.en || r.name, 'xs') : logo(r.logo, r.name, 'xs'), el('span', { class: 'nm' }, name)])
                  ]),
                  ...cols.map(c => el('td', { class: cls(c), text: r.stats[c] ?? '' }))
                ]);
              })
            )
          ])
        ]),
        zoneLegend(g.rows)
      ]);
    })
  );
}
// The sides greyed out in a table: those with no chance left at all. A
// league with playoffs (MLB, the NBA, MLS) keeps them greyed once its
// season's over: everyone who missed the playoffs, everyone in (wild cards
// too) not, their results the playoffs tab's. MLB's and the NBA's by ESPN's
// own mark (e: eliminated, its math with the divisions in); a points
// table's by every point a side can still win (a tie counted as a chance)
// against the lowest good zone (Europe, playoffs, promotion: MLS's 9th, the
// wild card) and the relegation line, and once over, by its zones; a
// championship's (F1's) against the title, then its places.
export function outOfIt(g, race, league) {
  const rows = g?.rows || [];
  const sport = LEAGUES[league]?.sport;
  const total = SEASON_GAMES[league];
  const played = r => (sport === 'soccer' ? Number(r.stats.GP) : Number(r.stats.W) + Number(r.stats.L) + (Number(r.stats.T) || 0));
  const over = race ? race.rows.every(x => x.settled) && race.title.done : total ? rows.every(r => played(r) >= total) : false;
  // ESPN's e: out of the playoffs, during the season and after it.
  if (rows.some(r => r.clincher)) return new Set(rows.filter(r => r.clincher === 'e').map(r => r.id));
  // A division's or a league's seeds (MLB's): its bars are the playoff seeds, out only by ESPN's e.
  if (g.parent || g.picture) return new Set();
  const zones = rows.some(r => r.note && !/relegat|eliminat/i.test(r.note));
  const ended = over || (total && rows.every(r => played(r) >= total));
  // A playoff league's season over: the sides outside its playoff zones.
  if (ended && zones && FORMATS[league] && !LEAGUES[league]?.cup) return new Set(rows.filter(r => !r.note || /relegat|eliminat/i.test(r.note)).map(r => r.id));
  if (!race || ended) return new Set();
  // A championship (F1's): those who can't win it; once it's won, each
  // one whose place is settled (the race moves down the places still open).
  if (sport === 'racing') {
    if (!race.title.done) return new Set(race.rows.filter(x => x.best > 1).map(x => x.id));
    return new Set(race.rows.filter((x, i) => i > 0 && x.settled).map(x => x.id));
  }
  if (!zones) return new Set();
  // Nothing left to play for (Jay, 2026-10-26): no good zone in reach, and
  // not still in or out of the bottom one (a relegation fight keeps its colour).
  const reach = goodZoneReach(rows);
  const bottom = rows.findIndex(r => r.note && /relegat|eliminat/i.test(r.note)) + 1;
  return new Set(race.rows.filter(x => x.best > reach && !(bottom && x.best < bottom && x.worst >= bottom)).map(x => x.id));
}
// The lowest place a table's good zones reach (its last row with a zone
// that isn't relegation or elimination), 1 when it has none.
export function goodZoneReach(rows) {
  let reach = 1;
  rows.forEach((r, i) => {
    if (r.note && !/relegat|eliminat/i.test(r.note)) reach = i + 1;
  });
  return reach;
}
// What a table's coloured bars mean (晉級八強, 降級附加賽…), each once, in
// the order they come down the table.
function zoneLegend(rows) {
  const seen = new Map();
  for (const r of rows) if (r.note && r.color && !seen.has(r.note)) seen.set(r.note, r.color);
  if (!seen.size) return null;
  return el('div', { class: 'zone-legend' }, [...seen].map(([note, color]) => el('span', { class: 'zone-key' }, [el('i', { style: `background:${color}`, 'aria-hidden': 'true' }), document.createTextNode(zoneName(note).replace(/^[a-z]/, c => c.toUpperCase()))])));
}

// ---- A playoff series or a knockout tie: every game of it ---------------------------------

// The tie (bracket.mjs): its two sides with the wins (or aggregate), who
// went through or what's next, then each game, G1 first, each opening its match.
// A match's stage and series ("國聯分區系列賽 G4 · 道奇 系列賽 3-1 獲勝"): a
// playoff series or a two-legged tie opens the whole of it, as 季後賽 does.
const warm = new Map();
function warmSeries(e) {
  const key = `${e.league}:${e.id}`;
  const had = warm.get(key);
  if (had && had.at > Date.now() - 60_000) return had;
  const got = { at: Date.now(), p: ctx.seriesOf(e).catch(() => null) };
  warm.set(key, got);
  return got;
}
function stageLine(e) {
  const parts = [stageTag(e, L()) ? el('span', { class: 'stage-tag', text: stageTag(e, L()) }) : null, seriesText(e) ? el('small', { text: seriesText(e) }) : null, weekOf(e) ? el('small', { text: roundLabel(e.league, weekOf(e), weekOf(e), L()) }) : null];
  if (!e.round || !(e.series || e.round.leg) || !ctx.seriesOf) return el('div', { class: 'mh-stage' }, parts);
  // The › at the end of the last words, never alone on a line of its own.
  const shown = parts.filter(Boolean);
  const chev = el('span', { class: 'mh-chev', 'aria-hidden': 'true', text: '\u00a0›' });
  if (shown.at(-1)?.tagName === 'SMALL') shown.at(-1).append(chev);
  else shown.push(chev);
  const btn = el('button', { class: 'mh-stage link', type: 'button', 'aria-label': L() === 'en' ? 'See the whole series' : '看整個系列賽' }, shown);
  // Read while the page is looked at, so the tap opens it at once (it had
  // waited on the bracket's first read: seconds). A redraw keeps the read.
  const ready = warmSeries(e);
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const got = await (ready.at > Date.now() - 60_000 ? ready.p : warmSeries(e).p);
    btn.disabled = false;
    if (got) openTie(got.tie, e.league, got.title);
    // Not in the bracket read (a season long gone): just the line, no more.
    else (chev.remove(), btn.replaceWith(el('div', { class: 'mh-stage' }, parts)));
  });
  return btn;
}

export function openTie(t, league, roundTitle = '') {
  const en = L() === 'en';
  const s = sheet(leagueName(league, L()), { league });
  const won = t.winner && t.sides.find(x => String(x.id) === t.winner);
  const sideRow = x => {
    const id = String(x.id);
    return el('div', { class: `tie-side${t.winner ? (t.winner === id ? ' win' : ' out') : ''}` }, [teamTap(x, league, 'tie-who', [sideLogo(x, league, 'sm'), el('strong', { class: 'tie-name', text: x.short || x.name })]), el('strong', { class: 'num tie-score', text: t.score?.[id] ?? '' })]);
  };
  const said = won ? (en ? `${won.short || won.name} through` : `${won.short || won.name} 晉級`) : t.live ? (en ? 'On now' : '進行中') : t.kind === 'agg' ? (en ? 'Aggregate' : '總比分') : t.kind === 'series' ? (en ? 'Series' : '系列賽') : '';
  const label = (g, i) => [t.kind === 'series' ? (en ? `Game ${i + 1}` : `第 ${i + 1} 戰`) : t.kind === 'agg' ? (en ? `Leg ${i + 1}` : `第 ${i + 1} 回合`) : '', dayLabel(localDate(Date.parse(g.start)))].filter(Boolean).join(' · ');
  s.body.append(
    el('div', { class: 'tie-head' }, [roundTitle ? el('p', { class: 'mini-h', text: roundTitle }) : null, ...t.sides.map(sideRow), said ? el('small', { class: `muted tie-said${t.live ? ' live' : ''}`, text: said }) : null]),
    el(
      'div',
      { class: 'q-card list tie-games' },
      t.games.map((g, i) => el('div', { class: 'tie-game' }, [label(g, i) ? el('small', { class: 'tie-gn', text: label(g, i) }) : null, eventRow(g, { league: false })]))
    )
  );
}
