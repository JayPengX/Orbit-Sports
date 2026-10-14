// Orbit Sports' sheets: a match (header, then its data by section), a
// race weekend, a team, a player, and the
// standings tables they share with the Standings tab.
import { translate, proxyJson, packJson, everyDev, dev } from '#kit/quadra.mjs';
import { searchUrl, videoUrl, knownHighlights, findHighlights, highlightsKind, watchMonthWanted, loadWatchMonth } from './lib/highlights.mjs';
import { teamNameZh } from '#kit/names.mjs';
import { splitName, otherName } from './lib/compname.mjs';
import { mlbGameLog, weekOf, winLine, winNow, raceWinLine, scoreboard, splitWeekend, settleField, summary, cpblGame, teamInjuries, mergeInjuries, standings, team, teamSchedule, roster, athlete, athleteOverview, STANDING_COLUMNS, COMPACT_COLUMNS, sessionName, seasonEvents, driverSeason, leagueInjuries, homeLeague, roundLabel, roundKind, feedStatus, sessionStatus, dueToStart, pregameLineups } from './lib/espn.mjs';
import { stageTag, groupName } from './lib/stage.mjs';
import { tableStarted } from './lib/picks.mjs';
import { onCourt, onPitch, pitchSpots } from './lib/onfield.mjs';
import { playPeriod } from './lib/live.mjs';
import { personKey } from './lib/mlb.mjs';
import { lineXs, periodMarks, pointStamp, stampAt, quietRuns, periodName, nearestMoment, holdToEnd, sideColors } from './lib/wpline.mjs';
import { playMoments, eventMoments, raceMoments, scoreAt, bandName, lateClock, feedText, playParts } from './lib/moments.mjs';
import { controlBands, causeOf, PM_LEAGUE } from './lib/winprob.mjs';
import { statName, boxHead, statsTitle, metric, fixedWord, dateText, injuryZh, seriesLineZh, weatherZh, pitchZh, posZh, standingZh, leaderValue, teamStatRows } from './lib/statnames.mjs';
import { f1Driver, f1Constructor, countryName, logoPicture, countryFlag } from '#kit/logos.mjs';
import { namedZh } from './lib/f1names.mjs';
import { raceControlParts } from './lib/racecontrol.mjs';
import { f1Official, f1Label, f1Value, finishOf, eventOfRace, raceResult, qualifyingResult, espnQualifying, liveTiming, keptTiming, qualiCut, feedOver, feedBreak, sessionTiming, sessionLaps, circuitMap, lapMs, practicePace, MIN_RUN, pitLaps, stintStops, gapsBetween, closingRate, recentPace, neutralLaps, pointsFor, POINTS, asItStands, settleScoring } from './lib/f1.mjs';
import { tvOf, replayOf } from './lib/tv.mjs';
import { broadcastsOf, twSource, ELTA_VOD_LEAGUES, guideWhen } from './lib/broadcast.mjs';
import { LEAGUES, leagueName, hasTeamPage, hasStandings } from './lib/leagues.mjs';
import { SEASON_GAMES, liveTable, roundCounted, roundOf } from './lib/title.mjs';
import { FORMATS } from './lib/playoffs.mjs';
import { teamKey, leagueKey } from './lib/foryou.mjs';
import { f1Shown, ctx, el, shownStart, timeText, leagueMark, put, spinner, empty, skeleton, logo, diamond, clock, dayLabel, localDate, statusText, whenText, eventRow, sheet, segmented, seriesText, tvName, watchLink, watchButton, audioName, sessionTag, raceFlag, personPic, sideLogo, today } from './ui.js';

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
// An F1 story's line: its teams by the app's names (賓士), its drivers kept
// in English through the translator (held as ⟦0⟧…, put back after).
function f1Later(text) {
  const { text: held, back } = namedZh(text);
  return zhLater(held, 'en', back);
}
const injuryText = s => (L() === 'en' ? s : injuryZh(s) || zhLater(s));
const weatherText = w => weatherZh(w, L());
// The last meetings at a glance: each side's logo, name and wins, the draws
// between, and one bar split by them (a sentence wrapped its parts apart).
function h2hView({ n, wins, draws }, e) {
  const en = L() === 'en';
  const side = (x, cls) => el('div', { class: `h2h-side ${cls}` }, [el('div', { class: 'h2h-who' }, [logo(x.logo, x.name, 'sm'), el('span', { class: 'h2h-name', text: x.short || x.name })]), el('div', { class: 'h2h-score' }, [el('strong', { class: 'num h2h-n', text: String(wins[x.id] || 0) }), el('small', { text: en ? 'won' : '勝' })])]);
  const share = k => `flex-grow:${k}`;
  const [a, h] = [wins[e.away.id] || 0, wins[e.home.id] || 0];
  return el('div', { class: 'h2h' }, [
    el('div', { class: 'h2h-row' }, [side(e.away, 'away'), el('div', { class: 'h2h-draw' }, [el('strong', { class: 'num h2h-n', text: String(draws || 0) }), el('small', { text: en ? 'drawn' : '和局' })]), side(e.home, 'home')]),
    n ? el('div', { class: 'h2h-bar', 'aria-hidden': 'true' }, [a ? el('i', { class: 'away', style: share(a) }) : null, draws ? el('i', { class: 'draw', style: share(draws) }) : null, h ? el('i', { class: 'home', style: share(h) }) : null]) : null
  ]);
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

// The game page open now (openMatch), for a player opened from it.
let openGame = null;
export async function openMatch(e) {
  // (Reassigned as the live copy comes in.)
  const s = sheet(leagueName(e.league, L()), { league: e.league });
  const header = el('div', { class: 'match-head' });
  const sections = el('div', { class: 'match-tabs' });
  const content = el('div', { class: 'match-content' }, [spinner()]);
  s.body.append(header, sections, content);
  let view = 'overview';
  let data = null;
  let table = null;
  // The game open: a player opened from it (any face, row or name in it)
  // has its numbers in this game too (openPlayer's 本場), told of each refresh.
  const game = { dialog: s.dialog, subs: new Set() };
  Object.defineProperties(game, { e: { get: () => e }, data: { get: () => data } });
  openGame = game;
  s.dialog.addEventListener('close', () => openGame === game && (openGame = null));
  // Each side's injuries from its roster (ESPN's game page leaves some out).
  let hurt = {};
  // Who starts, before the game (pregameLineups).
  let lineups = null;
  // Polymarket's win probability where ESPN draws none (a game on: again each
  // minute); a game to come, its chance for each side now, where ESPN has no
  // prediction of its own.
  let line = null;
  let lineAt = 0;
  // What's still coming (the win chance cards wait in their shape, never a source standing in for another).
  const wait = { summary: !LEAGUES[e.league].espn, line: false };
  const loadLine = () => {
    const now = { ...e, status: data?.status || e.status };
    const pre = now.status.state === 'pre';
    if ((pre ? data?.predict?.source === 'espn' : data?.winProb.length > 3) || Date.now() - lineAt < 60_000) return;
    lineAt = Date.now();
    (pre ? winNow : winLine)(now)
      .then(l => l && (line = l))
      .catch(() => {})
      .finally(() => {
        wait.line = true;
        paint();
      });
  };
  const paintHeader = sm => {
    const home = sm?.home || e.home;
    const away = sm?.away || e.away;
    const st = sm?.status || e.status;
    const guestGame = Boolean(e.home.guest || e.away.guest);
    const side = (x, raw) =>
      el('div', { class: 'mh-side' }, [
        el('button', { class: 'mh-team', type: 'button', disabled: !hasTeamPage(e.league) || x.guest || raw.guest ? true : null, onclick: () => ctx.openTeam(e.league, x.id, x) }, [sideLogo({ ...raw, ...x, logo: x.logo || raw.logo }, e.league, 'lg'), el('strong', { text: raw.short || x.short || x.name })]),
        x.record || raw.record ? el('small', { text: x.record || raw.record }) : x.guest || raw.guest ? el('small', { text: GUEST_FROM[raw.en || raw.name]?.[L() === 'en' ? 1 : 0] || (L() === 'en' ? 'Guest club' : '表演賽客隊') }) : null,
        // A guest club's game: neither side's follow here (the two sides even), the league side's under the score.
        hasTeamPage(e.league) && !guestGame ? followChip(e.league, x, () => paintHeader(sm)) : null
      ]);
    put(
      header,
      el('div', { class: 'mh-row' }, [
        side(away, e.away),
        el('div', { class: 'mh-mid' }, [
          st.state === 'pre' ? el('strong', { class: 'mh-time', text: timeText(e) }) : el('strong', { class: 'mh-score num', text: `${away.score ?? ''} - ${home.score ?? ''}` }),
          el('span', { class: `mh-status ${st.state}`, text: st.state === 'pre' ? dayLabel(localDate(Date.parse(e.start))) : statusText({ ...e, status: st }) })
        ]),
        side(home, e.home)
      ]),
      stageTag(e, L()) || seriesText(e) || weekOf(e) ? stageLine(e) : null,
      gameFollow(e, st, () => paintHeader(sm), guestGame && hasTeamPage(e.league) ? [away, home].filter((x, i) => !x.guest && ![e.away, e.home][i].guest) : []),
      // On now or about to start: one tap to watch it, at the top.
      watchButton({ ...e, status: st }, 'wide'),
      linescore(sm, e),
      livePanel(e, sm)
    );
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
      const fresh = (await scoreboard(e.league, LEAGUES[e.league].espn ? gameDays() : undefined).catch(() => [])).find(x => x.id === e.id);
      if (fresh) e = { ...e, ...fresh };
      if (LEAGUES[e.league].espn) data = await summary(e.league, e.id).catch(() => data);
      else if (e.league === 'cpbl') data = (await cpblGame(e).catch(() => null)) || data;
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
  const settle = () => {
    if (ready) return;
    ready = true;
    paintHeader(data);
    paint();
  };
  setTimeout(settle, 3_000);
  const paint = () => {
    if (!ready) return;

    if (!shown) {
      shown = true;
      sections.classList.add('fade-in');
      content.classList.add('fade-in');
    }
    const tabs = [['overview', T('overview')]];
    // The game's own numbers, once it's begun (before it, ESPN's are a stray season total or two: 助攻 4–3).
    if ((data?.status || e.status).state !== 'pre' && teamStatRows(data?.teamStats, LEAGUES[e.league]?.sport, L()).length) tabs.push(['stats', T('stats')]);
    if (data?.players.some(p => p.tables.some(tb => tb.rows.length))) tabs.push(['players', T('players')]);
    if (data?.plays.length || data?.keyEvents.length || data?.commentary?.length) tabs.push(['plays', T('plays')]);
    // 陣容: soccer's line-ups; basketball's from its box score (先發, 替補, 未上場 and why: a player who didn't play is left off 球員).
    if (data?.rosters.some(r => r.players.length) || (LEAGUES[e.league]?.sport === 'basketball' && data?.players.some(p => p.tables[0]?.rows.length))) tabs.push(['lineups', T('lineups')]);
    // The table only once it has a game in it (a preseason's is all zeros in the feed's order).
    const shownTable = table?.length ? table : data?.table.length ? [{ rows: data.table.map(r => ({ id: r.id, stats: r.stats })) }] : [];
    if (shownTable.some(tableStarted)) tabs.push(['table', T('table')]);
    else if (view === 'table') view = 'overview';
    put(sections, tabs.length > 1 ? segmented(tabs, view, v => ((view = v), paint())) : null);
    const next = matchSection(view, data && { ...data, injuries: mergeInjuries(data.injuries, hurt), lineups }, e, table, { line, wait });
    // The same view again (a live refresh): its cards changed inside the
    // stack already there, so a card kept from the last drawing (the win
    // chance chart, a finger on it) never leaves the page.
    const was = content.firstElementChild;
    // (A kept card comes as a stand-in, __keep: the card itself never put in the new stack.)
    if (was?.classList.contains('stack') && next?.classList?.contains('stack') && was.dataset.view === view && content.childElementCount === 1) put(was, ...[...next.childNodes].map(n => n.__keep || n));
    else put(content, next);
    if (content.firstElementChild?.classList.contains('stack')) content.firstElementChild.dataset.view = view;
    for (const f of game.subs) f();
  };
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
        .then(sm => {
          if (!sm) return;
          data = sm;
          paintHeader(data);
          paint();
        })
        .catch(() => {});
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
  // A game to come or on: who's out, from each team's roster too (soccer's rosters say nothing of it).
  if (e.kind === 'match' && e.status.state !== 'post' && LEAGUES[e.league].sport !== 'soccer')
    Promise.all([e.away, e.home].map(x => (x?.id ? teamInjuries(e.league, x.id).then(list => [x.id, list]).catch(() => null) : null))).then(got => {
      hurt = Object.fromEntries(got.filter(Boolean));
      if (Object.values(hurt).some(l => l.length)) paint();
    });
  try {
    data = await summary(e.league, e.id);
  } catch {}
  wait.summary = true;
  if (ready) {
    paintHeader(data);
    paint();
  } else settle();
  loadLine();
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
      return lpPerson(e.league, t && { id: t.id, name: t.name }, [t ? personPic({ id: t.id, name: t.name }, e.league, 'md round') : null, el('p', {}, [el('small', { text: `${name} · ${en ? 'top scorer' : '得分王'}` }), el('strong', { text: t?.name || '–' }), t?.line ? el('small', { class: 'num lp-line', text: t.line }) : null, f !== '' ? el('small', { class: 'num', text: `${en ? 'Team fouls' : '全隊犯規'} ${f}` }) : null])]);
    };
    rows.push(el('div', { class: 'lp-who lp-bb' }, [person(e.away.id), person(e.home.id)]));
    const last = sm.feed.slice(-4).reverse();
    if (last.length) {
      const nameOf = id => sm.byId[id]?.short || sm.byId[id]?.name || '';
      rows.push(el('small', { class: 'lp-feed-h', text: en ? 'Latest' : '最新' }));
      rows.push(
        el(
          'ol',
          { class: 'lp-feed' },
          last.map(p => el('li', { class: p.scoring ? 'scoring' : '' }, [el('span', { class: 'num play-when', text: p.clock }), playLine(e.league, p, sm.byId[p.team] || nameOf(p.team)), p.scoring ? el('strong', { class: 'num', text: `${p.away}-${p.home}` }) : null]))
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
  if (lv.events?.length) rows.push(goalTimeline(e, lv.events));
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
  // (Away first, as the score above.)
  const order = ['away', 'home'];
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
            el('small', { class: 'lg-sub', text: [x.kind === 'own' ? x.who || p.name : team.short || team.name, tag].filter(Boolean).join(' · ') })
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
  const home = sm?.home || e.home;
  const away = sm?.away || e.away;
  const n = Math.max(home.lines?.length || 0, away.lines?.length || 0);
  if (!n || n > 20) return null;
  // Each column by its sport's name for it: a football game's halves (上半 / 下半, extra time, penalties), a period past regulation OT.
  const sport = LEAGUES[e.league]?.sport;
  const en = L() === 'en';
  const regular = { basketball: 4, hockey: 3, football: 4 }[sport] || 0;
  const colName = i =>
    sport === 'soccer'
      ? (en ? ['1H', '2H', 'ET1', 'ET2', 'Pens'] : ['上半', '下半', '延長上', '延長下', 'PK'])[i] || String(i + 1)
      : regular && i >= regular
        ? `OT${i - regular ? i - regular + 1 : ''}`
        : String(i + 1);
  const head = Array.from({ length: n }, (_, i) => el('th', { text: colName(i) }));
  // The sides by their Chinese names when they have them (a short one fits the column).
  const tag = x => (L() !== 'en' && x.en && x.short && x.short.length <= 5 ? x.short : x.abbr || x.short);
  const row = x => el('tr', {}, [el('th', { class: 'ls-team', text: tag(x) }), ...Array.from({ length: n }, (_, i) => el('td', { class: 'num', text: x.lines?.[i] ?? '' })), el('td', { class: 'num total', text: x.score })]);
  return el('div', { class: 'table-wrap' }, [el('table', { class: 'linescore' }, [el('thead', {}, [el('tr', {}, [el('th'), ...head, el('th', { text: sport === 'baseball' ? 'R' : en ? 'T' : '總分' })])]), el('tbody', {}, [row(away), row(home)])])]);
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

const card = (title, body, { sub = '' } = {}) => el('div', { class: 'q-card pad fx-card' }, [el('div', { class: 'card-h row' }, [typeof title === 'string' ? el('span', { text: title }) : el('span', {}, [title]), sub ? el('small', {}, [sub]) : null]), body]);

// Why a player didn't play, as ESPN says it ("COACH'S DECISION", "INJURY/ILLNESS - Left Knee; Sprain").
function dnpText(reason, en) {
  const r = String(reason || '').trim();
  if (en || !r) return en ? r.toLowerCase().replace(/^./, c => c.toUpperCase()) || 'Did not play' : '未上場';
  if (/coach/i.test(r)) return '教練決定';
  if (/injury|illness/i.test(r)) return '傷病';
  if (/not with team/i.test(r)) return '未隨隊';
  if (/suspen/i.test(r)) return '禁賽';
  if (/personal/i.test(r)) return '個人因素';
  if (/rest/i.test(r)) return '輪休';
  return '未上場';
}
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
            : row.starter
              ? [en ? 'Started' : '先發', st.state === 'in' && sport === 'soccer' ? 'on' : '']
              : [en ? 'Bench' : '替補', ''];
  // One card: the score line (the two sides' marks and the score, the
  // game's clock at the right, red while on), then his numbers; where he
  // is (場上, 先發, ↓ 69') beside the title, not a card of its own.
  const scoreRow = el('div', { class: 'pg-row' }, [
    el('span', { class: 'pg-score' }, [logo(away?.logo, away?.name, 'xs'), el('strong', { class: 'num', text: st.state === 'pre' ? 'vs' : `${away?.score ?? ''} – ${home?.score ?? ''}` }), logo(home?.logo, home?.name, 'xs')]),
    el('span', { class: `pg-status ${st.state}`, text: statusText({ ...e, status: st }) })
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
      el('div', {}, [i === 0 ? scoreRow : null, el('div', { class: 'stat-grid dense' }, tb.labels.map((k, n) => [k, r.stats[n], tb.keys?.[n]]).filter(([, v, key]) => v !== '' && v != null && key !== 'yellowCards' && key !== 'redCards').map(([k, v]) => tile(statName(k, L(), { sport, long: tb.longs?.[tb.labels.indexOf(k)] }), String(v))))])
    )
  );
}

// ---- Injury report ------------------------------------------------------------------------
//
// Who's hurt, live from ESPN's injury report (NBA, WNBA, NFL, NHL, MLB: a
// league's whole list in one read, kept ten minutes): each player's status,
// what and where, when they're due back and the reporter's word on it. A
// league ESPN keeps no report for (soccer, Asian baseball) has no card.
const INJ_TONE = { out: 'bad', 'injured reserve': 'bad', 'injured list': 'bad', suspension: 'bad', doubtful: 'bad', questionable: 'warn', 'day-to-day': 'warn', probable: 'good' };
const injTone = status => Object.entries(INJ_TONE).find(([k]) => String(status).toLowerCase().includes(k))?.[1] || 'warn';
// One player's line: status chip, what's wrong, when they're back.
function injuryLine(x, league) {
  const en = L() === 'en';
  const back = x.back ? (en ? `back ${dayLabel(localDate(Date.parse(x.back)))}` : `預計 ${dayLabel(localDate(Date.parse(x.back)))} 回歸`) : '';
  return el('div', { class: 'inj-row' }, [
    x.id ? el('button', { class: 'link roster-name', type: 'button', onclick: () => ctx.openPlayer(league, x.id, { name: x.name, logo: x.headshot }) }, [personPic(x, league, 'xs round'), el('span', { text: x.name })]) : null,
    el('span', { class: 'inj-meta' }, [
      el('span', { class: `inj-status ${injTone(x.status)}`, text: injuryText(x.status) }),
      x.what ? el('small', {}, [en ? x.what : zhLater(x.what)]) : null,
      back ? el('small', { class: 'muted', text: back }) : null
    ])
  ]);
}
// A team's card: everyone on its report, the most serious first.
const INJ_ORDER = ['bad', 'warn', 'good'];
function teamInjuryCard(list, league) {
  if (!list?.length) return null;
  const sorted = [...list].sort((a, b) => INJ_ORDER.indexOf(injTone(a.status)) - INJ_ORDER.indexOf(injTone(b.status)));
  return card(L() === 'en' ? 'Injury report' : '傷兵報告', el('div', { class: 'inj-report' }, sorted.map(x => injuryLine(x, league))), { sub: dayLabel(localDate(Math.max(...list.map(x => Date.parse(x.date) || 0)) || Date.now())) });
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
const boxTableName = name => BOX_TABLES[String(name).toLowerCase()]?.[L() === 'en' ? 1 : 0] || name;
function matchSection(view, d, e, table, lw = {}) {
  const nameOf = id => d?.byId[id]?.short || d?.byId[id]?.name || (id === e.home.id ? e.home.short : id === e.away.id ? e.away.short : '');
  if (view === 'stats' && d) {
    // Each side in its own colour (the win chance chart's: told apart from each other and the card), the leagues' own apps' way.
    const tint = sideColors(e.home, e.away, getComputedStyle(document.documentElement).getPropertyValue('--q-surface').trim() || '#ffffff');
    return card(
      T('teamStats'),
      el(
        'div',
        { class: 'stat-bars', style: [tint.away ? `--away:${tint.away}` : '', tint.home ? `--home:${tint.home}` : ''].filter(Boolean).join(';') || null },
        [el('div', { class: 'sb-legend' }, [el('span', { class: 'away', text: nameOf(e.away.id) || e.away.short }), el('span', { class: 'home', text: nameOf(e.home.id) || e.home.short })])].concat(
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
                el('div', { class: 'sb-top' }, [el('strong', { class: `num${better === 'away' ? ' lead' : ''}`, text: s.away }), el('span', { text: s.label }), el('strong', { class: `num${better === 'home' ? ' lead' : ''}`, text: s.home })]),
                aa + hh > 0 ? el('div', { class: 'sb-track' }, [el('i', { class: 'away', style: `flex-grow:${share}` }), el('i', { class: 'home', style: `flex-grow:${100 - share}` })]) : null
              ])
            ];
          })
        )
      )
    );
  }
  if (view === 'players' && d) {
    return el(
      'div',
      { class: 'stack' },
      d.players.flatMap(p =>
        p.tables
          // Basketball: a player who didn't play a minute (no numbers) is left off; 陣容 lists him and why.
          .map(tb => (LEAGUES[e.league]?.sport === 'basketball' ? { ...tb, rows: tb.rows.filter(r => !r.dnp && r.stats?.some(v => v !== '' && v != null)) } : tb))
          .filter(tb => tb.rows.length)
          .map(tb =>
            card(
              [nameOf(p.team), boxTableName(tb.name)].filter(Boolean).join(' · '),
              boxTable(tb, `${e.id}|${p.team}|${tb.name}`, LEAGUES[e.league]?.sport, r =>
                      el('tr', {}, [
                        // Each player's face (live too: the box score's own, else the kit's way), name and
                        // position on one line (Safari dropped the position below, over the numbers).
                        el('th', { class: 'left' }, [el('span', { class: 'box-who' }, [el('button', { class: 'link roster-name', type: 'button', disabled: r.id ? null : true, onclick: () => r.id && ctx.openPlayer(e.league, r.id, { name: r.full || r.name, logo: r.headshot }) }, [personPic({ ...r, name: r.full || r.name }, e.league, 'xs round'), el('span', { text: r.name })]), r.pos ? el('small', { text: r.pos }) : null])]),
                        // One cell per column for a player yet to come on (no numbers), so the row's line runs across.
                        ...tb.labels.map((_, i) => el('td', { class: 'num', text: r.stats[i] ?? '' }))
                      ])
              )
            )
          )
          // (MLB's 比賽細節 left off, the owner's call, 2026-10-13: the box score says it.)
          .concat(e.league === 'mlb' ? [] : gameNotes(d.details?.find(x => x.team === p.team), nameOf(p.team)) || [])
      )
    );
  }
  if (view === 'plays' && d) {
    // The whole game: basketball every play, baseball every at-bat, American
    // football every drive, soccer its events (goals, cards, changes). A
    // finished game reads in order like a story; one on, the latest first.
    // A header at each period; the scores stand out, and the chart's key
    // moments (a run where it ended, a lead taken, a big play) are marked.
    const sport = LEAGUES[e.league]?.sport;
    const en = L() === 'en';
    const side = id => d.byId[id] || (id === e.home.id ? e.home : id === e.away.id ? e.away : nameOf(id));
    const sideShort = id => side(id)?.short || side(id)?.name || '';
    const live = (d.status || e.status).state === 'in';
    if (sport === 'football' && d.drives.length) {
      const rows = [];
      let at = 0;
      for (const x of live ? [...d.drives].reverse() : d.drives) {
        if (x.periodNum !== at) rows.push(el('li', { class: 'period-head', text: playPeriod(x, sport, L()) || (en ? `Q${x.periodNum}` : `第${x.periodNum}節`) }));
        at = x.periodNum;
        rows.push(
          el('li', { class: x.scoring ? 'scoring' : '' }, [
            el('span', { class: 'play-when' }, [el('span', { class: 'num', text: x.clock })]),
            el('span', { class: 'play-text has-face' }, [side(x.team)?.logo ? logo(side(x.team).logo, sideShort(x.team), 'xs play-team') : el('span', { class: 'play-none' }, [leagueMark(e.league)]), el('span', { class: 'play-words' }, [el('span', { class: 'play-main', text: `${sideShort(x.team)} ${en ? x.result : DRIVE_ZH[x.result] || x.result}` }), x.desc ? el('small', { class: 'play-sub', text: en ? x.desc : driveZh(x.desc) }) : null])]),
            x.home != null && x.away != null ? el('strong', { class: 'num', text: `${x.away}-${x.home}` }) : null
          ])
        );
      }
      return playsNav(el('ol', { class: 'plays' }, rows));
    }
    // Football: the whole commentary (every shot, corner and foul), its key events where there's none.
    const list = sport === 'basketball' && d.feed.length ? d.feed : sport === 'baseball' && d.feed.some(p => p.kind === 'play-result') ? d.feed.filter(p => p.kind === 'play-result' || (p.scoring && p.kind !== 'play-result')) : sport === 'soccer' && d.commentary?.length ? d.commentary : d.keyEvents.length ? d.keyEvents : d.plays;
    // The chart's key moments, by play: a run told where it ended, a play by itself.
    const marks = new Map();
    const tint = sideColors(e.home, e.away, getComputedStyle(document.documentElement).getPropertyValue('--q-surface').trim() || '#ffffff');
    const pts = d.winProb || [];
    if (pts.length && pts.every(p => p.n)) {
      const sides = { home: { id: e.home.id, name: sideShort(e.home.id) }, away: { id: e.away.id, name: sideShort(e.away.id) }, en };
      for (const m of playMoments(pts, sport, sides)) {
        const id = (m.periods || m.rally ? pts[m.i]?.play?.id : m.src?.id) || pts[m.i]?.play?.id;
        if (id) marks.set(id, m);
      }
    }
    const said = p => feedText(sport, p, en, '');
    // Baseball has no clock (the inning's in the headers): no column for one.
    const clockless = list.every(p => !p.clock);
    const shown = list
      // ESPN logs some twice in a row (a delay with its words and without): said once.
      .filter((p, i) => !i || said(p) !== said(list[i - 1]) || p.clock !== list[i - 1].clock || (p.team !== list[i - 1].team && Boolean(p.who || list[i - 1].who)));
    const rows = [];
    let at = '';
    for (const p of live ? [...shown].reverse() : shown) {
      const period = playPeriod(p, sport, L());
      if (period && period !== at && sport !== 'soccer') rows.push(el('li', { class: 'period-head', text: period }));
      at = period || at;
      const m = p.id ? marks.get(p.id) : null;
      const chip = m ? el('span', { class: `wp-gain ${m.side}`, style: tint[m.side] ? `--side:${tint[m.side]}` : null, text: `${m.side === 'home' ? sideShort(e.home.id) : sideShort(e.away.id)} +${Math.round(Math.abs(m.delta) * 100)}%` }) : null;
      // A run: a line of its own after the play that ended it (its words, its swing).
      const run = m && (m.periods || m.rally) ? el('li', { class: 'run-mark' }, [clockless ? null : el('span', { class: 'play-when' }), el('span', { class: 'play-text' }, [el('span', { class: 'play-main', text: m.text })]), chip]) : null;
      // A key play: its swing under its words (the score stays on the right).
      const line = playLine(e.league, p, side(p.team));
      if (m && !run) line.querySelector('.play-words')?.append(chip);
      const row = el('li', { class: [p.scoring ? 'scoring' : '', m && !run ? 'key' : ''].filter(Boolean).join(' ') }, [
        // The period over the clock, a designed two lines in a narrow column.
        clockless ? null : el('span', { class: 'play-when' }, [sport === 'soccer' && period ? el('small', { text: period }) : null, el('span', { class: 'num', text: p.clock })]),
        line,
        p.home != null && p.away != null ? el('strong', { class: 'num', text: `${p.away}-${p.home}` }) : null
      ]);
      rows.push(...(live ? [run, row] : [row, run]).filter(Boolean));
    }
    return playsNav(el('ol', { class: `plays${clockless ? ' clockless' : ''}` }, rows));
  }
  if (view === 'lineups' && d && LEAGUES[e.league]?.sport === 'basketball') {
    const en = L() === 'en';
    const list = ps => el('ul', { class: 'roster-list' }, ps.map(r => el('li', {}, [el('span', { class: 'jersey num', text: r.jersey || '' }), el('button', { class: 'link roster-name', type: 'button', onclick: () => r.id && ctx.openPlayer(e.league, r.id, { name: r.full || r.name, logo: r.headshot }) }, [personPic({ ...r, name: r.full || r.name }, e.league, 'xs round'), el('span', { text: r.full || r.name })]), el('small', {}, [r.dnp ? dnpText(r.reason, en) : posZh(r.pos, 'basketball', L())])])));
    const sides = [e.away, e.home].map(t => d.players.find(p => p.team === String(t.id))).filter(Boolean);
    return el(
      'div',
      { class: 'lineups' },
      sides.map(p => {
        const rows = p.tables[0]?.rows || [];
        const out = rows.filter(r => r.dnp || !r.stats?.some(v => v !== '' && v != null));
        const starters = rows.filter(r => r.starter && !out.includes(r));
        const bench = rows.filter(r => !r.starter && !out.includes(r));
        return card(nameOf(p.team), el('div', {}, [starters.length ? el('p', { class: 'mini-h', text: en ? 'Starters' : '先發' }) : null, starters.length ? list(starters) : null, bench.length ? el('p', { class: 'mini-h', text: T('bench') }) : null, bench.length ? list(bench) : null, out.length ? el('p', { class: 'mini-h', text: en ? 'Did not play' : '未上場' }) : null, out.length ? list(out) : null]));
      })
    );
  }
  if (view === 'lineups' && d) {
    return el(
      'div',
      { class: 'lineups' },
      d.rosters
        .filter(r => r.players.length)
        .map(r => {
          const sport = LEAGUES[e.league]?.sport;
          // A soccer game on: who's on the pitch now (a sub with his minute), who came off, the bench left.
          const now = sport === 'soccer' && (d.status || e.status).state === 'in' ? onPitch([r])[0] : null;
          const en = L() === 'en';
          const mark = p => (p.sentOff ? el('span', { class: 'sent-off', text: en ? ' · Sent off' : ' · 紅牌' }) : p.subAt && (p.subbedIn || p.subbedOut) ? el('span', { class: 'sub-on', text: ` ${p.subbedOut ? '↓' : '↑'}${p.subAt}` }) : null);
          const list = ps => el('ul', { class: 'roster-list' }, ps.map(p => el('li', {}, [el('span', { class: 'jersey num', text: p.jersey }), el('button', { class: 'link roster-name', type: 'button', onclick: () => ctx.openPlayer(e.league, p.id, p) }, [personPic(p, e.league, 'xs round'), el('span', { text: p.name })]), el('small', {}, [p.pos === 'SUB' ? '' : posZh(p.pos, sport, L()), now ? mark(p) : null])])));
          if (now)
            return card(`${nameOf(r.team)}${r.formation ? ` · ${r.formation}` : ''}`, el('div', {}, [el('p', { class: 'mini-h', text: now.on.length < 11 ? (en ? `On the pitch · ${now.on.length} men` : `場上 · ${now.on.length} 人`) : en ? 'On the pitch' : '場上' }), list(now.on), now.off.length ? el('p', { class: 'mini-h', text: en ? 'Off' : '已下場' }) : null, now.off.length ? list(now.off) : null, now.bench.length ? el('p', { class: 'mini-h', text: T('bench') }) : null, now.bench.length ? list(now.bench) : null]));
          const starters = r.players.filter(p => p.starter);
          const subs = r.players.filter(p => !p.starter);
          return card(`${nameOf(r.team)}${r.formation ? ` · ${r.formation}` : ''}`, el('div', {}, [starters.length ? list(starters) : null, subs.length ? el('p', { class: 'mini-h', text: T('bench') }) : null, subs.length ? list(subs) : null]));
        })
    );
  }
  if (view === 'table') {
    const official = table?.length ? table : [{ name: '', rows: (d?.table || []).map(r => ({ id: r.id, name: r.team, short: r.team, logo: null, stats: r.stats })) }];
    // This game over (or the day's others) before the official table has it: counted in at once, as 賽事's table does.
    const sport = LEAGUES[e.league]?.sport;
    const recent = [...(ctx.recentOf?.(e.league) || []).filter(x => x.id !== e.id), { ...e, status: d?.status || e.status, home: { ...e.home, ...(d?.home || {}) }, away: { ...e.away, ...(d?.away || {}) } }];
    const groups = table?.length && sport !== 'racing' ? liveTable(official, recent, sport) : official;
    return standingsTables(groups, e.league, { mark: [e.home.id, e.away.id] });
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
const HL_NAME = { official: ['官方精華', 'Official highlights'], elta: ['愛爾達精華', 'ELTA highlights'], full: ['全場精華', 'Full-game highlights'], search: ['搜尋精華影片', 'Search for highlights'] };
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
  if (!v) findHighlights(e, (url, o) => proxyJson(url, o)).catch(() => {});
  return el('a', { class: `yt-link${v ? '' : ' search'}`, href: v ? videoUrl(v.id) : searchUrl(e), target: '_blank', rel: 'noopener' }, [
    ytLogo(),
    el('span', { class: 'yt-text' }, [el('strong', { text: HL_NAME[kind][en ? 1 : 0] }), el('small', { class: 'one-line', text: v ? [v.channel, v.length].filter(Boolean).join(' · ') : 'YouTube' })]),
    el('span', { class: 'yt-go', text: '›' })
  ]);
}

// The overview: the teams side by side, what the match is (where, when, TV),
// the win probability, each side's leaders, the season series and injuries.
function overview(d, e, table, nameOf, { line = null, wait = { summary: true, line: true } } = {}) {
  const sides = [e.away, e.home];
  const places = sides.map(s => placeOf(table, s.id));
  const forms = sides.map(s => d?.form.find(f => f.team === s.id)?.games || []);
  const sm = side => d?.byId?.[side.id] || side;
  const compareRows = [
    // The record: the feed's, else the table's wins and losses.
    [T('record'), ...sides.map((s, i) => sm(s).record || s.record || (places[i]?.row?.stats?.W != null ? `${places[i].row.stats.W}-${places[i].row.stats.L}` : '—'))],
    places.some(Boolean) ? [T('standing'), ...places.map(p => (p ? placeCell(p, (table?.length || 0) > 1) : '—'))] : null,
    ...(places.every(Boolean) ? keyStats(e.league, places) : [])
  ].filter(Boolean);
  const compare = el('div', { class: 'compare' }, [
    el('div', { class: 'cmp-head' }, [cmpTeam(e.away, 'away', e.league), el('span', { class: 'cmp-vs', text: 'vs' }), cmpTeam(e.home, 'home', e.league)]),
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
  const part = {
    replay: replayLink(e),
    highlights: highlights(e),
    // (A guest club from outside the league has no record or place to set beside the other's.)
    matchup: e.home.guest || e.away.guest ? null : card(T('matchup'), compare),
    win: winCard(d, e, line, wait),
    onField: onFieldCard(d, e, nameOf),
    lineups: lineupCard(d?.lineups, e, nameOf),
    leaders: leadersBy.some(x => x.length)
      ? card(
          T('leaders'),
          el(
            'div',
            { class: 'leader-cols' },
            leadersBy.map((list, i) =>
              el('div', {}, [
                el('p', { class: 'mini-h', text: sides[i].short || sides[i].name }),
                ...list.map(l => el('button', { class: 'leader', type: 'button', disabled: l.id ? null : true, onclick: () => l.id && ctx.openPlayer(e.league, l.id, { name: l.full || l.name, logo: l.headshot }) }, [personPic({ ...l, name: l.full || l.name }, e.league, 'sm round'), el('span', { class: 'leader-text' }, [el('small', { text: statName(l.stat, L(), { sport: LEAGUES[e.league]?.sport }) }), el('span', {}, [el('strong', { text: l.name }), el('b', { class: 'num', text: leaderValue(l.value, L()) })])])]))
              ])
            )
          )
        )
      : null,
    series: d?.series[0]?.h2h?.n ? card(L() === 'en' ? 'Head to head' : '近期交手', h2hView(d.series[0].h2h, e), { sub: L() === 'en' ? `Last ${d.series[0].h2h.n}` : `近 ${d.series[0].h2h.n} 次` }) : d?.series.length && d.series[0].summary ? card(T('series'), el('p', { class: 'series-text', text: seriesZh(d.series[0].summary, e) }), { sub: { season: L() === 'en' ? 'Regular season' : '例行賽', playoff: L() === 'en' ? 'Playoffs' : '季後賽' }[d.series[0].kind] || '' }) : null,
    injuries: d?.injuries.some(i => i.list.length)
      ? card(
          T('injuries'),
          el(
            'div',
            { class: 'injuries' },
            d.injuries
              .filter(i => i.list.length)
              // Away first, as everywhere in the sheet.
              .sort((x, y) => (x.team === e.home.id) - (y.team === e.home.id))
              .map(i => el('div', {}, [el('p', { class: 'mini-h', text: nameOf(i.team) }), el('ul', { class: 'inj-list' }, i.list.slice(0, 12).map(x => el('li', {}, [x.id ? el('button', { class: 'link roster-name', type: 'button', onclick: () => ctx.openPlayer(e.league, x.id, { name: x.name, logo: x.headshot }) }, [personPic(x, e.league, 'xs round'), el('span', { text: x.name })]) : el('span', { text: x.name }), el('small', {}, [injuryText(x.status)])])))]))
          )
        )
      : null,
    tv: exactTv ? twCard(e.league, e) : null,
    info: card(T('matchInfo'), el('ul', { class: 'info-list' }, info.map(([, k, v]) => el('li', {}, [el('span', { class: 'info-k', text: k }), el('span', { class: 'info-v' }, [].concat(v))]))))
  };
  // In the order the game's moment wants (the owner, 2026-10-13: the live
  // page had grown): on, who's on now first, then the live chance, who's
  // leading, the rest; to come, the matchup, the chance, who starts; over,
  // the replay and highlights, who led, the chance's story, the rest.
  const ORDER = {
    in: ['onField', 'win', 'leaders', 'matchup', 'series', 'injuries', 'tv', 'info'],
    pre: ['matchup', 'win', 'lineups', 'series', 'injuries', 'tv', 'info', 'leaders'],
    post: ['replay', 'highlights', 'leaders', 'win', 'matchup', 'series', 'info', 'injuries']
  };
  const state = (d?.status || e.status).state;
  return el('div', { class: 'stack' }, (ORDER[state] || ORDER.pre).map(k => part[k] || (k === 'onField' ? part.lineups : null)));
}

// Who starts (pregameLineups): MLB's probable pitchers and batting orders,
// an NBA, WNBA or NHL side's starters once announced; before then, when
// they're said. Each side a list of its own (two columns cut the names).
function lineupCard(l, e, nameOf) {
  if (!l) return null;
  const en = L() === 'en';
  const sport = LEAGUES[e.league]?.sport;
  const who = p => (p.id ? el('button', { class: 'link roster-name', type: 'button', onclick: () => ctx.openPlayer(e.league, p.id, { name: p.name, logo: p.headshot }) }, [personPic(p, e.league, 'xs round'), el('span', { text: p.name })]) : el('span', { class: 'roster-name' }, [personPic(p, e.league, 'xs round'), el('span', { text: p.name })]));
  // Each row: its number (or place in the order), the face and name from the left, the position at the right.
  const row = (p, lead = '') => el('li', {}, [el('span', { class: 'jersey num', text: lead || '' }), who(p), el('small', { text: posZh(p.pos, sport, L()) })]);
  const side = (team, list, lead) => el('div', {}, [el('p', { class: 'mini-h', text: nameOf(team.id) }), el('ul', { class: 'inj-list lineup-list' }, list.map((p, i) => row(p, lead(p, i))))]);
  const sides = [e.away, e.home];
  if (l.kind === 'mlb') {
    const pitchers = sides.map((t, i) => [t, [l.pitchers.away, l.pitchers.home][i]]).filter(([, p]) => p);
    const orders = sides.map((t, i) => [t, [l.order.away, l.order.home][i]]).filter(([, o]) => o.length);
    return card(
      en ? 'Starters' : '先發',
      el('div', { class: 'injuries' }, [
        pitchers.length ? el('div', {}, [el('p', { class: 'mini-h', text: en ? 'Probable pitchers' : '預計先發投手' }), el('ul', { class: 'inj-list lineup-list' }, pitchers.map(([t, p]) => el('li', {}, [el('span', { class: 'jersey' }), who(p), el('small', { text: t.short || t.name })])))]) : null,
        ...orders.map(([t, o]) => side(t, o, (p, i) => String(i + 1)))
      ]),
      { sub: orders.length ? (en ? 'Batting orders posted' : '打序已公布') : en ? 'Batting orders hours before' : '打序賽前數小時公布' }
    );
  }
  if (l.pending)
    return card(en ? 'Starting lineups' : '先發陣容', el('p', { class: 'muted small', text: e.league === 'nhl' ? (en ? 'Starting goalies are named before the game.' : '先發門將賽前公布。') : en ? 'Named about 30 minutes before tip-off.' : '開賽前約 30 分鐘公布。' }));
  return card(
    en ? 'Starting lineups' : '先發陣容',
    el('div', { class: 'injuries' }, sides.map((t, i) => [t, [l.away, l.home][i]]).filter(([, list]) => list.length).map(([t, list]) => side(t, list, p => p.jersey))),
    { sub: en ? 'Announced' : '已公布' }
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
  const sides = [e.away, e.home].map(t => String(t.id));
  const order = list => sides.map(id => list.find(x => x.team === id)).filter(Boolean);
  if (sport === 'basketball') {
    const five = order(onCourt(d.players));
    if (!five.length) return null;
    const shirt = shirtsOf(d, e);
    // Each side's five as a row of faces (no court: a basketball position
    // is no place on the floor): the number; a green ↑ at the corner for one
    // off the bench (soccer's sub on), and under the name 先發 or 替補 in
    // words (the owner, 2026-10-13: a corner mark for a starter went
    // unseen); his points, then rebounds and assists, fouls from the fourth
    // in red. Under the row, the side's starters sitting now.
    const tile = (p, colour) =>
      el('button', { class: 'five-tile', type: 'button', style: `--shirt:${colour}`, 'aria-label': `${p.full || p.name}${p.starter ? (en ? ', starter' : '，先發') : en ? ', off the bench' : '，替補'}`, onclick: () => p.id && ctx.openPlayer(e.league, p.id, { name: p.full || p.name, logo: p.headshot }) }, [
        el('span', { class: 'pm-face' }, [personPic({ ...p, name: p.full || p.name }, e.league, 'pm-pic'), p.jersey ? el('span', { class: 'pm-num num', style: `color:${inkOn(colour)}`, text: p.jersey }) : null, p.starter ? null : el('span', { class: 'pm-sub on', 'aria-hidden': 'true', text: '↑' })]),
        el('span', { class: oneLineName(surnameOf(p)), text: surnameOf(p) }),
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
    return card(en ? 'On the court' : '場上球員', el('div', { class: 'five-sides' }, five.map(s => el('div', {}, [el('p', { class: 'mini-h', text: nameOf(s.team) }), el('div', { class: 'five-row' }, s.players.map(p => tile(p, shirt[s.team]))), resting(s)]))), { sub: en ? 'Live' : '即時' });
  }
  if (sport === 'baseball' && d.field) return card(en ? 'On the field' : '場上球員', diamondView(d, e, nameOf), { sub: en ? 'Live' : '即時' });
  if (sport === 'soccer') {
    const xi = order(onPitch(d.rosters));
    if (xi.length < 2) return null;
    return card(en ? 'On the pitch' : '場上球員', el('div', {}, [pitchView(xi, d, e, nameOf), subsList(xi, nameOf, e.league)]), { sub: en ? 'Live' : '即時' });
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
      el('span', { class: 'pm-name', text: surname(p) })
    ]);
  const spots = [
    // The away side's left is the screen's right, its goal at the top.
    ...pitchSpots(away.held, away.formation).filter(s => !s.p.sentOff).map(s => marker(s.p, 1 - s.x, s.y / 2, awayShirt)),
    ...pitchSpots(home.held, home.formation).filter(s => !s.p.sentOff).map(s => marker(s.p, s.x, 1 - s.y / 2, homeShirt))
  ];
  const label = s => el('p', { class: 'pitch-team' }, [el('strong', { text: nameOf(s.team) }), el('span', { class: 'num', text: [s.formation, s.on.length < 11 ? (en ? `${s.on.length} men` : `${s.on.length} 人`) : ''].filter(Boolean).join(' · ') })]);
  return el('div', { class: 'pitch-wrap' }, [label(away), el('div', { class: 'pitch' }, [el('div', { class: 'pitch-lines', 'aria-hidden': 'true', html: PITCH_LINES }), ...spots]), label(home)]);
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
  const who = full => {
    const r = rows.get(personKey(full));
    return { id: r?.id || '', name: full, full, short: r?.name || '', headshot: r?.headshot || null };
  };
  const marker = (full, [x, y], colour, label = '', cls = '') => {
    if (!full) return null;
    const p = who(full);
    return el('button', { class: `pm${cls ? ` ${cls}` : ''}`, type: 'button', style: `left:${x}%;top:${y}%;--shirt:${colour}`, 'aria-label': `${label ? `${label} ` : ''}${full}`, onclick: () => p.id && ctx.openPlayer(e.league, p.id, { name: full, logo: p.headshot }) }, [
      el('span', { class: 'pm-face' }, [personPic(p, e.league, 'pm-pic'), label ? el('span', { class: 'pm-num', style: `color:${inkOn(colour)}`, text: label }) : null]),
      el('span', { class: 'pm-name', text: surnameOf({ name: full, short: p.short || full.split(' ').slice(1).join(' ') || full }) })
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
  const half = en ? `${f.top ? 'Top' : 'Bottom'} ${f.inning}` : `${f.inning} 局${f.top ? '上' : '下'}`;
  const bases = en ? ['1st', '2nd', '3rd'] : ['一壘', '二壘', '三壘'];
  const on = f.runners.map((r, i) => (r ? `${bases[i]} ${surnameOf({ name: r, short: who(r).short || r })}` : '')).filter(Boolean);
  return el('div', { class: 'pitch-wrap' }, [
    el('p', { class: 'pitch-team' }, [el('strong', { text: `${nameOf(String(fieldSide.id))} ${en ? 'in the field' : '守備'}` }), el('span', { class: 'num', text: `${half} · ${en ? `${f.outs} out` : `${f.outs} 出局`}` })]),
    field,
    el('p', { class: 'diamond-at-bat' }, [
      el('span', { text: `${nameOf(String(batSide.id))} ${en ? 'batting' : '進攻'}${f.batter ? ` · ${en ? '' : '打者 '}${who(f.batter).short || f.batter}${f.order ? (en ? ` (#${Math.floor(f.order / 100) || f.order})` : `（第 ${Math.floor(f.order / 100) || f.order} 棒）`) : ''}` : ''}` }),
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
// The substitutions so far, each side's in order: the minute, who came on (green ↑) and who went off (red ↓); a red card too.
function subsList(sides, nameOf, league) {
  const en = L() === 'en';
  const parts = sides
    .map(s => {
      const all = [...s.on, ...s.off];
      const byId = new Map(all.map(p => [p.id, p]));
      const minute = t => parseInt(t, 10) || 0;
      const who = p => (p?.id ? el('button', { class: 'link', type: 'button', text: p.short || p.name, onclick: () => ctx.openPlayer(league, p.id, { name: p.name, logo: p.headshot }) }) : p?.short || p?.name || '');
      const rows = [
        ...all.filter(p => p.subbedIn).map(p => ({ at: p.subAt, li: el('li', {}, [el('span', { class: 'num sub-at', text: p.subAt }), el('span', { class: 'sub-pair' }, [el('span', { class: 'nb' }, [el('b', { class: 'arrow-in', text: '↑ ' }), who(p)]), byId.get(p.inFor) ? el('span', { class: 'nb' }, [el('b', { class: 'arrow-out', text: '↓ ' }), who(byId.get(p.inFor))]) : null])]) })),
        ...all.filter(p => p.sentOff).map(p => ({ at: p.sentAt, li: el('li', {}, [el('span', { class: 'num sub-at', text: p.sentAt }), el('span', { class: 'sub-pair' }, [el('span', { class: 'nb' }, [el('b', { class: 'card-red', 'aria-hidden': 'true' }), ' ', who(p), ` · ${en ? 'sent off' : '紅牌'}`])])]) }))
      ].sort((a, b) => minute(a.at) - minute(b.at));
      return rows.length ? el('div', {}, [el('p', { class: 'mini-h', text: nameOf(s.team) }), el('ul', { class: 'subs-list' }, rows.map(r => r.li))]) : null;
    })
    .filter(Boolean);
  return parts.length ? el('div', { class: 'subs-block' }, [el('p', { class: 'subs-h', text: en ? 'Substitutions' : '換人' }), ...parts]) : null;
}
// Each side's colour for its players' rings: its own, the away side in its
// second when the two are alike (two whites), a blue and a red when the feed has none.
function shirtsOf(d, e) {
  const [a, h] = [e.away, e.home].map(t => d?.byId?.[String(t.id)] || t);
  const away = a?.color && h?.color && near(a.color, h.color) && a.alt ? a.alt : a?.color || '#2f6fdf';
  return { [String(e.away.id)]: away, [String(e.home.id)]: h?.color || '#d9443a' };
}
// A name as a shirt says it: "O. Costa" → Costa ("João Marcelo" as it is).
// A suffix (Jr., Sr., II, III) left off: the face and number say who (McCullar Jr. ran onto a second line).
const surnameOf = p => {
  const s = p.short || (p.full ? p.name : '') || p.name || '';
  return (/^\S{1,3}\. /.test(s) ? s.replace(/^\S{1,3}\. /, '') : s).replace(/,?\s+(Jr\.?|Sr\.?|II|III|IV)$/i, '');
};
// A name on one line in a narrow tile: smaller as it's longer, never wrapped.
const oneLineName = name => `pm-name one${name.length > 11 ? ' tight' : name.length > 8 ? ' snug' : ''}`;
const hexRgb = c => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c || ''));
  return m ? [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)) : null;
};
const near = (a, b) => {
  const [x, y] = [hexRgb(a), hexRgb(b)];
  return Boolean(x && y) && Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 90;
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
const cmpTeam = (s, cls, league) => el('div', { class: `cmp-team ${cls}` }, [sideLogo(s, league, 'sm'), el('span', { text: s.short || s.name })]);
const formPills = games => el('div', { class: 'form-pills' }, games.slice(-5).map(g => el('span', { class: `pill ${g.result}`, title: `${g.opp} ${g.score}`, text: g.result })));

// The game's win chance card: to come, each side's chance; on or over, the
// chart. One source for a game, decided before it shows: ESPN's own, else
// (a league Polymarket covers) its market, else the sportsbook's; while the
// one it waits for is coming, the card in its shape, the real one fading in.
const waited = new WeakMap();
function winCard(d, e, line, wait) {
  const state = (d?.status || e.status).state;
  const market = Boolean(PM_LEAGUE[e.league]) && e.kind === 'match';
  const sport = LEAGUES[e.league]?.sport;
  let real = null;
  let coming = false;
  if (state === 'pre') {
    const espn = d?.predict?.source === 'espn' ? d.predict : null;
    real = espn || (line?.home != null ? line : null) || (wait.summary && (!market || wait.line) ? d?.predict : null);
    coming = !real && (!wait.summary || (market && !wait.line));
    if (real) real = winChanceCard(real, e);
  } else {
    real = d?.winProb.length > 3 ? winProbCard({ points: d.winProb }, e, d.timeline) : line?.points?.length > 3 ? winProbCard(line, e, d?.timeline, d?.events) : null;
    coming = !real && ((!wait.summary && (market || ['baseball', 'basketball', 'football'].includes(sport))) || (market && wait.summary && !wait.line));
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

// A game to come: each side's chance (and a draw's), one bar split by them;
// ESPN's prediction, else Polymarket's price, else a sportsbook's odds.
function winChanceCard(odds, e) {
  if (odds?.home == null) return null;
  const en = L() === 'en';
  const home = Math.round(odds.home * 100);
  const draw = odds.draw != null ? Math.round(odds.draw * 100) : null;
  const away = Math.max(0, 100 - home - (draw ?? 0));
  return card(
    T('winChance'),
    el('div', { class: 'wp' }, [
      // Each side with its small logo beside its name and chance.
      el('div', { class: 'wp-labels wc-labels' }, [el('span', { class: 'away' }, [logo(e.away.logo, e.away.name, 'xs'), document.createTextNode(`${e.away.short || e.away.name} ${away}%`)]), draw != null ? el('span', { class: 'draw', text: `${en ? 'Draw' : '和局'} ${draw}%` }) : null, el('span', { class: 'home' }, [document.createTextNode(`${e.home.short || e.home.name} ${home}%`), logo(e.home.logo, e.home.name, 'xs')])]),
      el('div', { class: 'wc-bar', 'aria-hidden': 'true' }, [el('span', { class: 'away', style: `flex:${away}` }), draw ? el('span', { class: 'draw', style: `flex:${draw}` }) : null, el('span', { class: 'home', style: `flex:${home}` })])
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
  const pts = holdToEnd(line.points, timeline);
  const keyOf = `${e.league}|${e.id}`;
  const kept = wpKept.get(keyOf) || {};
  const last = pts.at(-1) || {};
  const sig = [pts.length, last.home, last.draw, last.t, e.status.state, L(), getComputedStyle(document.documentElement).getPropertyValue('--q-surface').trim(), (events || []).length].join('|');
  // On the page already: a stand-in for it in the new drawing (paint puts the card itself back in its place).
  const stay = c => (c.isConnected ? Object.assign(el('div', { hidden: true }), { __keep: c }) : c);
  if (kept.card && kept.sig === sig) return stay(kept.card);
  const sport = LEAGUES[e.league]?.sport;
  const en = L() === 'en';
  const w = 320;
  const h = 90;
  const xs = lineXs(pts, timeline);
  const up = p => p.home + (p.draw ?? 0) / 2;
  const xy = i => `${(xs[i] * w).toFixed(1)},${(h - up(pts[i]) * h).toFixed(1)}`;
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${xy(i)}`).join(' ');
  // Where the market stood still: a faint dashed stretch, read as no price.
  const quiet = quietRuns(pts);
  const isQuiet = i => quiet.some(([a, b]) => i > a && i < b);
  const traded = pts.map((p, i) => `${i && !quiet.some(([a, b]) => i > a && i <= b) ? 'L' : 'M'}${xy(i)}`).join(' ');
  const gaps = quiet.map(([a, b]) => `M${xy(a)} L${xy(b)}`).join(' ');
  const marks = periodMarks(timeline, sport, pts, en);
  const grid = marks.filter(m => m.x > 0.01).map(m => `<line x1="${(m.x * w).toFixed(1)}" x2="${(m.x * w).toFixed(1)}" y1="0" y2="${h}" class="wp-grid"/>`).join('');
  const sideName = s => s.short || s.name;
  // Each side in its own colour: the home side's chance above the middle in
  // its colour, the away side's below in theirs (the app's colour, and a grey,
  // where a team has none).
  // On the card as it's drawn now (light or dark).
  const tint = sideColors(e.home, e.away, getComputedStyle(document.documentElement).getPropertyValue('--q-surface').trim() || '#ffffff');
  const homeC = tint.home || 'var(--accent)';
  const awayC = tint.away || 'var(--q-text-2)';
  const sideC = s => (s === 'home' ? homeC : awayC);
  const uid = `wp${Math.random().toString(36).slice(2, 8)}`;
  const side = { home: { id: e.home.id, name: sideName(e.home) }, away: { id: e.away.id, name: sideName(e.away) }, en };
  const moments = (pts.every(p => p.n) ? playMoments(pts, sport, side) : eventMoments(pts, events, sport, side, pts.map(p => p.t))).filter(m => !isQuiet(m.i));
  // When it was: the period (a stretch, its periods), the clock in the last two minutes, the score after it.
  const momentAt = m => {
    const [a, b] = m.periods || [];
    // 第2–3節, 2–3局 (one word for both ends).
    const when = a && b && b > a ? (en ? `${periodName(sport, a, en)}–${periodName(sport, b, en)}` : `${periodName(sport, a, en).replace(/[節局]$/, '')}–${periodName(sport, b, en).replace(/^第/, '')}`) : pointStamp(timeline, sport, pts[m.i], en);
    const score = scoreAt(pts, m.i, events, e.home.id);
    return [when, lateClock(sport, pts[m.i]), score ? `${score[0]}–${score[1]}` : ''].filter(Boolean).join(' · ');
  };
  // Whose chance it lifted, and by how much.
  const gain = m => `${side[m.delta >= 0 ? 'home' : 'away'].name} +${Math.round(Math.abs(m.delta) * 100)}%`;
  const gainChip = m => el('span', { class: `wp-gain ${m.side}`, style: `--side:${sideC(m.delta >= 0 ? 'home' : 'away')}`, text: gain(m) });
  // The key moment closest to a finger (within 2.5% of the chart), if any.
  const near = i => nearestMoment(moments, xs, i);
  // Away on the left, home on the right (as everywhere in the sheet), adding up to 100.
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
  const latest = live ? moments.find(m => pts.length - 1 - m.i <= Math.max(2, pts.length * 0.03)) : null;
  // The player's face (the batter, the scorer), else the team's badge (a run), else the sport's sign.
  // A run's team badge to the team's page.
  const teamTap = x => (hasTeamPage(e.league) && x.id && !x.guest ? el('button', { class: 'wp-who team', type: 'button', 'aria-label': x.name || '', onclick: ev => (ev.stopPropagation(), ctx.openTeam(e.league, x.id, x)) }, [sideLogo(x, e.league, 'sm')]) : sideLogo(x, e.league, 'sm'));
  const face = m => (m.pic ? personTap(e.league, m.pic, personPic(m.pic, e.league, 'sm round')) : m.team ? teamTap(String(m.team) === String(e.home.id) ? e.home : e.away) : el('span', { text: m.icon }));
  const tell = (m, label) => {
    why.hidden = !m;
    if (m) put(why, el('span', { class: 'wp-why-icon' }, [face(m)]), el('span', { class: 'wp-why-text' }, momentWords(m.text, label)), gainChip(m));
  };
  const show = (j, picked) => {
    // A moment picked from the list: that one; a finger close to one: on it.
    const m = picked || (j != null ? near(j) : null);
    rows.forEach((r, k) => r.classList.toggle('on', moments[k] === picked));
    const i = m ? m.i : j;
    const p = pts[i ?? pts.length - 1];
    const [hh, dd] = [Math.round(p.home * 100), p.draw != null ? Math.round(p.draw * 100) : 0];
    const pct = v => `${v}%`;
    away.textContent = `${sideName(e.away)} ${pct(Math.max(0, 100 - hh - dd))}`;
    if (draw) draw.textContent = `${en ? 'Draw' : '和局'} ${pct(dd)}`;
    home.textContent = `${sideName(e.home)} ${pct(hh)}`;
    // Where the game was: the period and the score then (away–home, as the sides sit).
    const score = scoreAt(pts, i ?? pts.length - 1, events, e.home.id);
    const tally = score ? ` · ${score[0]}–${score[1]}` : '';
    const stamp = [pointStamp(timeline, sport, p, en) || `${i + 1} / ${pts.length}`, lateClock(sport, p)].filter(Boolean).join(' ');
    at.textContent = i == null ? `${rest}${tally} · ${en ? 'Hold to look back' : '按住圖表查看'}` : `${stamp}${tally}`;
    at.classList.toggle('on', i != null);
    tell(i == null ? latest : m, i == null && latest ? (en ? 'Just now' : '剛剛') : '');
    rule.hidden = dot.hidden = i == null;
    if (i == null) return;
    rule.style.left = dot.style.left = `${xs[i] * 100}%`;
    dot.style.top = `${(1 - up(p)) * 100}%`;
  };
  // Dotted on the line: the big swings and a lead taken or tied, never two crowding each other (the bigger kept; a lead taken first).
  const weight = m => (m.turned ? 1 : 0) + Math.abs(m.delta);
  const dotted = [];
  for (const m of moments.filter(m => Math.abs(m.delta) >= 0.12 || m.turned).sort((a, b) => weight(b) - weight(a))) if (dotted.every(d => Math.abs(xs[d.i] - xs[m.i]) >= 0.04)) dotted.push(m);
  const pins = dotted.map(m => el('span', { class: `wp-moment ${m.side}`, style: `left:${xs[m.i] * 100}%;top:${(1 - up(pts[m.i])) * 100}%;background:${sideC(m.delta >= 0 ? 'home' : 'away')}` }));
  // Above the middle the home side's colour, below it the away side's: the
  // area and the line each cut at the middle (two clips of one shape).
  const svg = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="wp-chart" aria-hidden="true"><defs><clipPath id="${uid}t"><rect x="0" y="0" width="${w}" height="${h / 2}"/></clipPath><clipPath id="${uid}b"><rect x="0" y="${h / 2}" width="${w}" height="${h / 2}"/></clipPath></defs>${grid}<path d="${path} L${w},${h / 2} L0,${h / 2} Z" class="wp-area" clip-path="url(#${uid}t)" style="fill:color-mix(in srgb, ${homeC} 30%, transparent)"/><path d="${path} L${w},${h / 2} L0,${h / 2} Z" class="wp-area" clip-path="url(#${uid}b)" style="fill:color-mix(in srgb, ${awayC} 30%, transparent)"/><line x1="0" x2="${w}" y1="${h / 2}" y2="${h / 2}" class="wp-mid"/><path d="${quiet.length ? traded : path}" class="wp-line" clip-path="url(#${uid}t)" style="stroke:${homeC}"/><path d="${quiet.length ? traded : path}" class="wp-line" clip-path="url(#${uid}b)" style="stroke:${awayC}"/>${gaps ? `<path d="${gaps}" class="wp-gap"/>` : ''}</svg>`;
  const plot = scrubPlot(xs, show, [el('div', { html: svg }), ...pins, rule, dot]);
  dot.style.background = 'var(--q-text)';
  // Whose half is whose: each side's logo beside the chart (never over the line).
  const frame = el('div', { class: 'wp-frame' }, [el('div', { class: 'wp-sides', 'aria-hidden': 'true' }, [sideLogo(e.home, e.league, 'xs'), sideLogo(e.away, e.league, 'xs')]), plot]);
  // The key moments, in the game's order: a tap puts the chart on that one (brought into view).
  const rows = moments.map(m =>
    // The face to the player's page, the rest to the chart.
    el('div', { class: 'wp-mo' }, [
      el('span', { class: 'wp-mo-face' }, [face(m)]),
      el('button', { type: 'button', class: 'wp-mo-go', onclick: () => ((state.picked = m.i), show(m.i, m), bringIn(plot)) }, [
        el('span', { class: 'wp-mo-body' }, [el('small', { class: 'wp-mo-at', text: momentAt(m) }), el('span', { class: 'wp-mo-text' }, momentWords(m.text))]),
        gainChip(m)
      ])
    ])
  );
  show();
  // The moment picked before this redraw, picked again (a point's place
  // never moves as new ones come: they're added at the end).
  const again = kept.picked != null ? moments.find(m => m.i === kept.picked) : null;
  const state = { picked: again ? again.i : null };
  if (again) show(again.i, again);
  const list = moments.length
    ? el('div', { class: 'wp-moments' }, [
        el('p', { class: 'mini-h', text: en ? 'Key moments' : '關鍵時刻' }),
        ...rows
      ])
    : null;
  const box = el('div', { class: 'wp' }, [
    el('div', { class: 'wp-labels wc-labels' }, [el('span', { class: 'away' }, [sideLogo(e.away, e.league, 'xs'), away]), draw, el('span', { class: 'home' }, [home, sideLogo(e.home, e.league, 'xs')])]),
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
function gameNotes(t, team) {
  if (!t) return null;
  const en = L() === 'en';
  return card(
    [team, en ? 'Notes' : '比賽細節'].filter(Boolean).join(' · '),
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
function boxTable(tb, key, sport, rowOf) {
  const rows = tb.rows.map(r => [r, rowOf(r)]);
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
const momentWords = (text, label = '') => {
  const [main, ...rest] = String(text || '').split(' · ');
  return [el('span', { class: 'mo-main' }, [label ? el('b', { text: `${label} · ` }) : null, document.createTextNode(main)]), rest.length ? el('small', { class: 'mo-sub', text: rest.join(' · ') }) : null];
};
// 過程's way around a long game (an NBA game's 400-odd plays): a bar kept
// at the top while it scrolls, a filter (全部 / 得分 / 關鍵: every play,
// the scores, the chart's key moments) and a chip a period that jumps to
// it. Only when the list is long; the filter kept across a live game's
// refreshes (and other games: a way of reading).
const PLAYS_LONG = 40;
let playsShow = 'all';
function playsNav(ol) {
  const items = [...ol.children];
  const heads = items.filter(li => li.classList.contains('period-head'));
  const rows = items.filter(li => !li.classList.contains('period-head'));
  if (rows.length < PLAYS_LONG) return ol;
  const en = L() === 'en';
  const kinds = [['all', en ? 'All' : '全部'], ['score', en ? 'Scores' : '得分'], ['key', en ? 'Key' : '關鍵']].filter(
    ([k]) => k === 'all' || rows.some(li => (k === 'score' ? li.classList.contains('scoring') : li.classList.contains('key') || li.classList.contains('run-mark')))
  );
  if (!kinds.some(([k]) => k === playsShow)) playsShow = 'all';
  const apply = () => {
    for (const li of rows) li.hidden = playsShow === 'score' ? !li.classList.contains('scoring') && !li.classList.contains('run-mark') : playsShow === 'key' ? !li.classList.contains('key') && !li.classList.contains('run-mark') : false;
    // A period with nothing shown under it: its header goes too.
    for (const h of heads) {
      let next = h.nextElementSibling;
      let any = false;
      while (next && !next.classList.contains('period-head')) {
        any ||= !next.hidden;
        next = next.nextElementSibling;
      }
      h.hidden = !any;
    }
    put(filter, segmented(kinds, playsShow, k => ((playsShow = k), apply()), 'plays-filter'));
  };
  const filter = el('div');
  const jumps = heads.length > 1 ? el('div', { class: 'plays-jump' }, heads.map(h => el('button', { type: 'button', class: 'q-chip', text: h.textContent, onclick: () => (h.hidden ? null : h.scrollIntoView({ block: 'start', behavior: 'smooth' })) }))) : null;
  apply();
  return el('div', { class: 'plays-wrap' }, [el('div', { class: 'plays-nav' }, [kinds.length > 1 ? filter : null, jumps]), ol]);
}

// An American football drive's end and its length, in Chinese.
const DRIVE_ZH = { Touchdown: '達陣', 'Field Goal': '射門得分', 'Missed FG': '射門未進', Punt: '棄踢', Fumble: '掉球', Interception: '被攔截', Downs: '進攻失敗', 'End of Half': '半場結束', 'End of Game': '比賽結束', Safety: '安全分', 'Blocked FG': '射門被擋', 'Blocked Punt': '棄踢被擋' };
const driveZh = text => String(text || '').replace(/(\d+) plays?/, '$1 次進攻').replace(/(-?\d+) yards?/, '$1 碼').replace(/, /g, '・');
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
// teammate's dashed), by lap once the laps are in (by the clock while it
// runs); a finger on it reads each one's chance at that lap. To come: each
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
  } else if (!byLap && feed?.control?.length) {
    const msgs = feed.control.map(m => ({ ...m, t: Date.parse(/Z|[+-]\d\d:?\d\d$/.test(m.at) ? m.at : `${m.at}Z`) / 1000 })).filter(m => Number.isFinite(m.t));
    const lapOf = t => msgs.find(m => m.t === t)?.lap || null;
    // A car's number to its driver's name (the feed's cars).
    const family = n => feed.cars?.find(c => String(c.no) === String(n))?.name || '';
    bands = controlBands(msgs, m => m.t, pts.at(-1).t).map(([a, b, kind, m]) => {
      const cause = causeOf(msgs, m?.t ?? a, [], family);
      return { i0: idxOfT(a), i1: idxOfT(b), kind, from: lapOf(a), to: lapOf(b) || feed.lap?.now || null, why: cause?.kind, who: cause?.who };
    });
  }
  const names = line.drivers.map(n => driverShort(n, en));
  const moments = raceMoments(pts, names, bands, events, en, n => driverShort(n, en));
  // The driver's face: the one a moment is about (a band, its cause).
  const face = m => {
    const name = m.band ? m.driver || '' : line.drivers[m.k];
    const who = fieldDriver(ss.field, name);
    return personTap('f1', who, personPic(who || { name }, 'f1', 'sm round'));
  };
  const colorOf = k => f1Driver(line.drivers[k]).color;
  const gainChip = m => el('span', { class: 'wp-gain', style: `color:${colorOf(m.k)};background:color-mix(in srgb, ${colorOf(m.k)} 16%, transparent)`, text: `${names[m.k]} ${m.delta >= 0 ? '+' : '−'}${Math.round(Math.abs(m.delta) * 100)}%` });
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
    if (m) put(why, el('span', { class: 'wp-why-icon' }, [m.band && !m.driver ? el('span', { text: m.icon }) : face(m)]), el('span', { class: 'wp-why-text' }, momentWords(m.band && m.driver ? `${m.icon} ${m.text}` : m.text, label)), gainChip(m));
  };
  const show = (j, picked) => {
    // A moment picked from the list: that one; a finger close to a stop or a lead (the closest): on it.
    const near = picked || (j != null ? nearestMoment(moments.filter(m => !m.band), xs, j) : null);
    rows.forEach((r, k) => r.classList.toggle('on', moments[k] === picked));
    const i = near ? near.i : j;
    const p = pts[i ?? last];
    chips.forEach((c, k) => (c.lastChild.textContent = `${Math.round(p.c[k] * 100)}%`));
    // Who led then (of the drivers drawn), and the safety car if it was out.
    const k = i ?? last;
    const lead = [...events].reverse().find(ev => ev.kind === 'lead' && ev.i <= k);
    const under = bands.find(b => k > b.i0 && k <= b.i1);
    const leader = lead ? (typeof lead.k === 'number' ? names[lead.k] : driverShort(lead.k, en)) : '';
    const state = [leader ? (en ? `${leader} leads` : `${leader} 領先`) : '', under ? bandName(under.kind, en) : ''].filter(Boolean).map(x => ` · ${x}`).join('');
    at.textContent = i == null ? `${ss.status.state === 'post' ? (en ? 'Final' : '終場') : lapText(p)}${state} · ${en ? 'Hold to look back' : '按住圖表查看'}` : `${lapText(p)}${state}`;
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
  const rows = moments.map(m => el('div', { class: 'wp-mo' }, [el('span', { class: 'wp-mo-face' }, [m.band && !m.driver ? el('span', { text: m.icon }) : face(m)]), el('button', { type: 'button', class: 'wp-mo-go', onclick: () => (show(m.i, m), bringIn(plot)) }, [el('span', { class: 'wp-mo-body' }, [el('small', { class: 'wp-mo-at', text: m.laps && m.laps[1] > m.laps[0] ? (en ? `Laps ${m.laps[0]}–${m.laps[1]}` : `第 ${m.laps[0]}–${m.laps[1]} 圈`) : lapText(pts[m.i]) }), el('span', { class: 'wp-mo-text' }, momentWords(m.band && m.driver ? `${m.icon} ${m.text}` : m.text))]), gainChip(m)])]));
  show();
  const list = moments.length
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
  return can ? el('button', { class: `link ${cls}`, type: 'button', text: p.name, onclick: () => ctx.openPlayer(league, p.id, p) }) : el('span', { class: cls, text: p.name });
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
  const { main, sub } = playParts(feedText(LEAGUES[league]?.sport, p, L() === 'en', team), badged ? '' : team);
  const face = p.pic && !own ? personTap(league, p.pic, el('span', { class: 'play-face' }, [personPic(p.pic, league, 'xs round'), badged ? logo(side.logo, team, 'play-badge', { onWhite: true }) : null])) : side?.logo ? logo(side.logo, team, 'xs play-team') : null;
  // A play with neither (本節結束, 比賽結束): the league's mark, so every row has its picture.
  return el('span', { class: `play-text${face ? ' has-face' : ''}` }, [face || el('span', { class: 'play-none', 'aria-hidden': 'true' }, [leagueMark(league)]), el('span', { class: 'play-words' }, [el('span', { class: 'play-main', text: main }), sub ? el('small', { class: 'play-sub', text: sub }) : null])]);
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
function replayLink(e) {
  if (e?.status?.state !== 'post' || e.status.void) return null;
  // Apple TV (MLS): every game whole, at its own page once Shared-Data has it, else the channel's.
  const apple = tvOf(e).find(b => b.svc === 'appletv');
  if (apple) {
    const en = L() === 'en';
    return el('div', { class: 'replay-group' }, [
      watchLink(apple, { class: 'replay-link' }, [el('span', { class: 'replay-icon apple', 'aria-hidden': 'true', text: '\uF8FFtv' }), el('span', { class: 'yt-text' }, [el('strong', { text: en ? 'Full game replay' : '全場重播' }), el('small', { class: 'one-line', text: apple.game ? (en ? 'Apple TV · MLS Season Pass' : 'Apple TV・MLS Season Pass') : en ? "On Apple TV's MLS channel" : '在 Apple TV 的 MLS 頻道' })]), el('span', { class: 'replay-go', text: en ? 'Watch' : '觀看' })])
    ]);
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
// A broadcast's lines on 台灣轉播, each short enough for its row.
function twLines(b, e) {
  const en = L() === 'en';
  const when = at => {
    const iso = new Date(at).toISOString();
    return localDate(at) === today() ? clock(iso) : `${dayLabel(localDate(at))} ${clock(iso)}`;
  };
  const guess = e?.timeFrom === 'elta';
  const air = at => (guess ? (en ? `Expected ${when(at)}` : `預計 ${when(at)}`) : `${when(at)} ${en ? 'on air' : '開播'}`);
  if (b.ch) return [[audioName(b), b.adFree ? (en ? 'no ads' : '無廣告') : ''].filter(Boolean).join(en ? ', ' : '・'), b.at ? air(b.at) : ''].filter(Boolean);
  if (b.svc === 'appletv') return [en ? 'Every game' : '每場都有'];
  if (b.every) return [en ? 'Every session' : '每節都轉播'];
  // A play-off game ELTA hasn't named yet (MLB's postseason: it has every game).
  if (b.tba) return [en ? 'Every postseason game' : '季後賽每場都轉播', guess ? air(Date.parse(e.start)) : ''].filter(Boolean);
  return [en ? 'On ELTA, says NBA.com' : 'NBA.com 確認有轉播'];
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
                    el('span', { class: 'tw-watch-name' }, [
                      el('strong', { text: tvName(b) }),
                      // Short lines, each designed for its own row (one long one wrapped):
                      // its commentary and ads, then when it's on air (its day too when
                      // it isn't today; 預計 when the game's hour isn't set and this is
                      // ELTA's slot); a channel not yet named, who says it's on.
                      ...twLines(b, e).map(text => el('small', { class: 'one-line', text }))
                    ]),
                    b.url ? el('span', { class: 'tw-watch-go', text: `${L() === 'en' ? 'Watch' : '觀看'} ›` }) : null
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

// A race weekend's sessions as a timeline, by day: each session's time,
// its badge (正賽 marked out), and whether it's over, on or to come.
const SESSION_KIND = { Race: 'race', Qual: 'qual', SR: 'sprint', SS: 'sq', SQ: 'sq' };
function weekendTimeline(sessions) {
  const byDay = new Map();
  for (const x of sessions) {
    const d = localDate(Date.parse(x.start));
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(x);
  }
  const now = Date.now();
  const next = sessions.find(x => x.status.state === 'in') || sessions.find(x => x.status.state === 'pre' && Date.parse(x.start) > now);
  return el(
    'div',
    { class: 'wk-timeline' },
    [...byDay].map(([d, list]) =>
      el('div', { class: 'wk-day' }, [
        el('div', { class: 'wk-date' }, [el('strong', { text: dayLabel(d) })]),
        el(
          'div',
          { class: 'wk-sessions' },
          list.map(x => {
            const kind = SESSION_KIND[x.abbr] || 'other';
            const state = x.status.state;
            return el('div', { class: `wk-row ${kind}${state === 'in' ? ' live' : ''}${x === next ? ' next' : ''}${state === 'post' ? ' done' : ''}` }, [
              el('span', { class: 'wk-time num', text: timeText(x) }),
              el('span', { class: 'wk-name' }, [el('span', { class: `sess-tag ${kind}`, text: sessionName(x, L()) })]),
              el('span', { class: `wk-state ${state}`, text: state === 'post' ? T('final') : state === 'in' ? T('live') : x === next ? (L() === 'en' ? 'Next' : '下一場') : '' })
            ]);
          })
        )
      ])
    )
  );
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
const plainName = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
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
const fieldDriver = (field = [], full, family = String(full || '').split(' ').slice(1).join(' ') || full) => field.find(x => plainName(x.name) === plainName(full)) || field.find(x => plainName(x.name).endsWith(plainName(family))) || null;
// A driver's name whole where it fits, the surname where it doesn't (the
// owner, 2026-10-11): each name drawn whole, measured once laid out (a
// ResizeObserver: before the screen is painted, so it never flickers), and
// the surname put in if the whole one runs past its box; again whenever
// the box changes size (a turned phone).
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
        if (n.scrollWidth > n.clientWidth + 0.5) n.textContent = n.dataset.short;
      }
    })
  : null;
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
function f1Row({ pos, posText = '', posOut = false, full, team, field, main = '', aside = null, notes = [], cls = '', colour = '' }) {
  const en = L() === 'en';
  const c = fieldDriver(field, full) || { name: full };
  const who = { ...c, name: f1Whole(full) };
  const car = f1Constructor(team || f1Driver(full).team);
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
const mmss = n => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
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
  const over = b.final || feedOver(b);
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
    el('div', { class: 'lb-row' }, [
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
        : [tyre ? el('span', { class: 'f1-tyre' }, [tyreIcon(c.tyre), c.tyreLaps ? el('small', { class: 'num', text: `${c.tyreLaps}${en ? ' laps' : ' 圈'}` }) : null]) : null, gainOf(c), state ? el('small', { class: `f1-pill${c.inPit || c.pitOut ? '' : ' bad'}`, text: state }) : null],
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
      el('ol', { class: 'lb-msgs' }, said.slice(0, showAll ? 8 : 3).map(msgRow)),
      said.length > 3 ? el('button', { type: 'button', class: 'link lb-msg-more', text: showAll ? (en ? 'Fewer' : '收起') : en ? `${said.length - 3} more` : `再看 ${said.length - 3} 則`, onclick: () => (showAll ? f1AllMsgs.delete(ss.start) : f1AllMsgs.add(ss.start), box.replaceWith(makeMsg())) }) : null
    ]);
    return box;
  };
  const msg = said.length && !over ? makeMsg() : null;
  const order = el('ol', { class: 'field f1-field lb-rows' }, rows);
  if (orderOnly) return order;
  // Over: no head (its part, clock and flag are gone; "最終成績" over the
  // results said nothing), the order and its 數據 as every finished session.
  // On: the head, race control's latest, then 成績 or 數據 (F1 timing's other numbers).
  if (msg) head.append(msg);
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

// The track and every car on it where F1's feed has it now, the board's 5
// seconds glided over (one drawing kept for the session, the cars moved in
// it, not drawn again). The cars picked for 圈速比較 named and on top.
const f1Maps = new Map();
let f1DomMode = 'who';
let f1MapFocus = null;
let f1MapSector = null;
const f1MapPicks = new Map();
function f1TrackMap(b, ss, { redraw = false } = {}) {
  const c = circuitOf(b, ss);
  // (Each car where F1's feed puts it, or, as F1 stopped giving the cars' x/y in 2026, by the mini-sectors it has passed this lap.)
  if (!c || !b.cars.some(x => x.at || x.seg?.[1])) return null;
  const en = L() === 'en';
  const ns = 'http://www.w3.org/2000/svg';
  let m = f1Maps.get(ss.start);
  if (!m) {
    const a = ((c.rotation + 90) * Math.PI) / 180;
    const cx = (Math.min(...c.x) + Math.max(...c.x)) / 2;
    const cy = (Math.min(...c.y) + Math.max(...c.y)) / 2;
    // Turned as MultiViewer draws it (its rotation and a quarter turn, y as it comes), then fitted to the card.
    const turn = (x, y) => [(x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), (y - cy) * Math.cos(a) + (x - cx) * Math.sin(a)];
    const pts = c.x.map((x, i) => turn(x, c.y[i]));
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const W = 340, pad = 16;
    const k = (W - pad * 2) / (x1 - x0);
    const H = Math.round(Math.min(340, Math.max(180, (y1 - y0) * k + pad * 2)));
    const kk = Math.min(k, (H - pad * 2) / (y1 - y0));
    const ox = (W - (x1 - x0) * kk) / 2, oy = (H - (y1 - y0) * kk) / 2;
    const fit = (x, y) => {
      const [u, v] = turn(x, y);
      return [ox + (u - x0) * kk, oy + (v - y0) * kk];
    };
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'tm-svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', c.name || (en ? 'Track map' : '賽道'));
    const d = c.x.map((x, i) => fit(x, c.y[i]).map(n => n.toFixed(1)).join(',')).join(' ');
    svg.innerHTML = `<polyline class="tm-edge" points="${d}"/><polyline class="tm-track" points="${d}"/>`;
    // Over the track: the stretch between the first two picked (their gap), the sector lines and the finish, then the cars.
    const gapLayer = document.createElementNS(ns, 'g');
    const marks = document.createElementNS(ns, 'g');
    const layer = document.createElementNS(ns, 'g');
    svg.append(gapLayer, marks, layer);
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
    // The outline from one share of the lap to the next (round the line, if it is), fitted.
    const pathBetween = (f0, f1) => {
      const [ax, ay, ai] = pointAt(f0);
      const [bx, by, bi] = pointAt(f1);
      const out = [fit(ax, ay)];
      for (let i = (ai + 1) % c.x.length, n = 0; i !== (bi + 1) % c.x.length && n < c.x.length; i = (i + 1) % c.x.length, n++) out.push(fit(c.x[i], c.y[i]));
      out.push(fit(bx, by));
      return out;
    };
    m = { svg, fit, layer, marks, gapLayer, cars: new Map(), fracOfIdx, pointAt, pathBetween, W, H };
    f1Maps.set(ss.start, m);
  }
  m.b = b;
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
  const carFrac = car => (car.seg?.[1] ? fracOf(car.seg[0], car.seg[1]) : null);

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

  // The cars: the picked ones named, on top and bright, the others faint; a
  // tap on a car puts it in (or takes it out of) 車手比較, the two redrawn.
  // The drivers picked in 車手比較, as they stood when its picker was last
  // closed: while it's open, each tap there would redraw the map above it
  // and move the page (the map follows on 完成).
  // (Everyone taken out is the exception: the map is back to the plain
  // field at once, as the picker can't be closed with nobody in it.)
  const pickedNow = f1Picks.get(ss.start) || [];
  if (!f1PickerOpen.has(ss.start) || !f1MapPicks.has(ss.start) || !pickedNow.length) f1MapPicks.set(ss.start, [...pickedNow]);
  const picked = new Set(f1MapPicks.get(ss.start));
  const placed = x => !x.retired && !x.stopped && (x.at || x.seg?.[1]);
  const order = [...b.cars].filter(placed).sort((x, y) => (picked.has(x.no) ? 1 : 0) - (picked.has(y.no) ? 1 : 0) || y.pos - x.pos);
  // Where each car is drawn: on the track, but a car on top of another
  // (a train, a car right behind) moved across the track beside it, one
  // side then the other, so each dot and its number can be read.
  const R = 8.5;
  const spot = new Map();
  const drawn = [];
  for (const car of [...order].sort((x, y) => x.pos - y.pos)) {
    const f = car.at ? null : carFrac(car);
    const [x, y] = car.at ? m.fit(car.at[0], car.at[1]) : m.fit(...m.pointAt(f));
    let nx = 0, ny = 1;
    if (f != null) {
      const [x2, y2] = m.fit(...m.pointAt(f + 0.004));
      const n = Math.hypot(x2 - x, y2 - y) || 1;
      [nx, ny] = [-(y2 - y) / n, (x2 - x) / n];
    }
    let at = [x, y];
    // (One car's width to either side at most, then half a car further along the track: never off it.)
    for (let k = 1; k < 5 && drawn.some(([u, v]) => Math.hypot(u - at[0], v - at[1]) < R * 1.7); k++) {
      const side = (k % 2 ? 1 : -1) * R * 1.7;
      const on = k > 2 ? R : 0;
      at = [x + nx * side - ny * on, y + ny * side + nx * on];
    }
    drawn.push(at);
    spot.set(car.no, at);
  }
  for (const car of order) {
    let g = m.cars.get(car.no);
    if (!g) {
      g = document.createElementNS(ns, 'g');
      g.setAttribute('class', 'tm-car');
      g.innerHTML = `<circle r="12" class="tm-hit"/><circle r="7.5" class="tm-dot"/><text class="tm-no" y="2.7"></text><text class="tm-tag" x="11" y="3.5"></text>`;
      g.addEventListener('click', () => {
        const now = f1Picks.get(ss.start) || [];
        f1Picks.set(ss.start, now.includes(car.no) ? now.filter(x => x !== car.no) : [...now, car.no].slice(-4));
        document.querySelectorAll(`[data-laps="${ss.start}"]`).forEach(n => n.__redraw?.());
        f1TrackMap(m.b, ss, { redraw: true });
      });
      m.cars.set(car.no, g);
    }
    const [x, y] = spot.get(car.no);
    g.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    g.style.setProperty('--team', car.colour || '#888');
    // The number on the dot, white or black as the team's colour is dark or light.
    const hex = /^#?([0-9a-f]{6})$/i.exec(car.colour || '')?.[1];
    const light = hex && [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)).reduce((n, v, i) => n + v * [0.299, 0.587, 0.114][i], 0) > 160;
    g.classList.toggle('light', Boolean(light));
    g.querySelector('.tm-no').textContent = car.no;
    g.classList.toggle('named', picked.size ? picked.has(car.no) : car.pos <= 3);
    g.classList.toggle('picked', picked.has(car.no));
    g.classList.toggle('dim', picked.size > 0 && !picked.has(car.no));
    g.classList.toggle('pit', car.inPit);
    g.querySelector('.tm-tag').textContent = car.tla || car.no;
    m.layer.append(g);
  }
  for (const [no, g] of m.cars) if (!b.cars.some(x => x.no === no && placed(x))) g.remove();

  // The track and 車手比較 as one (the drivers picked there are the ones
  // drawn here, and a tap on a car picks it), two ways to read it, under
  // the map in a block of one height (no view moves the page):
  //   - 誰比較快 (two or more picked): each sector in the colour of the
  //     quickest of them there by their best sectors (F1's feed has no
  //     times finer than the sector), and the three in a strip, each with
  //     its quickest's face and time and the next one's gap (a sector
  //     tapped lights it on the track);
  //   - 本圈進度 (one or more): one driver's lap so far, mini-sector by
  //     mini-sector in F1's own colours (purple the session's best, green
  //     their own, yellow neither), the rest of the lap still grey.
  const picks = [...picked].map(no => b.cars.find(x => x.no === no)).filter(Boolean).sort((x, y) => x.pos - y.pos);
  const views = [...(picks.length >= 2 ? [['who', en ? 'Who is quicker' : '誰比較快']] : []), ...(picks.length ? [['lap', en ? 'This lap' : '本圈進度']] : [])];
  const mode = views.some(([k]) => k === f1DomMode) ? f1DomMode : views[0]?.[0];
  const poly = (pts, cls, style = '') => `<polyline class="${cls}" points="${pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}"${style ? ` style="${style}"` : ''}/>`;
  const faceOf = car => personPic(fieldDriver(ss.field, car.name, driverShort(car.name)) || { name: car.name }, 'f1', 'xs round');
  m.gapLayer.innerHTML = '';
  let dom = null;
  if (mode && cuts.length === 3) {
    const pick = views.length > 1 ? segmented(views, mode, v => ((f1DomMode = v), f1TrackMap(m.b, ss, { redraw: true })), 'tm-dom-modes') : null;
    if (mode === 'lap') {
      const focus = picks.find(x => x.no === f1MapFocus) || picks[0];
      const colour = st => (st === 2051 ? '#a855f7' : st === 2049 ? '#22c55e' : st === 2048 ? '#facc15' : st ? '#6b7280' : '');
      const st = focus.segStatus || [];
      m.gapLayer.innerHTML = st
        .map((v, k) => (colour(v) ? poly(m.pathBetween(fracOf(k, st.length), k + 1 < st.length ? fracOf(k + 1, st.length) : 1), 'tm-dom', `stroke:${colour(v)}`) : ''))
        .join('');
      const count = v => st.filter(x => x === v).length;
      dom = el('div', { class: 'tm-panel' }, [
        // Whose lap: each picked one (a tap shows theirs).
        el('div', { class: 'tm-focus' }, picks.map(car => el('button', { type: 'button', class: 'tm-focus-b', 'aria-pressed': String(car === focus), style: `--team:${car.colour || '#888'}`, onclick: () => ((f1MapFocus = car.no), f1TrackMap(m.b, ss, { redraw: true })) }, [faceOf(car), el('span', { text: car.tla || f1Sur(car) })]))),
        el('p', { class: 'tm-lap-key' }, [
          ...[['#a855f7', en ? 'best of all' : '全場最快', count(2051)], ['#22c55e', en ? 'own best' : '個人最快', count(2049)], ['#facc15', en ? 'slower' : '較慢', count(2048)]].map(([c2, t, n]) => el('span', {}, [el('i', { style: `background:${c2}` }), el('span', { text: t }), el('strong', { class: 'num', text: String(n) })]))
        ]),
        el('small', { class: 'muted tm-lap-at', text: en ? `Lap ${focus.laps + 1} · ${st.filter(Boolean).length} of ${st.length} done` : `第 ${focus.laps + 1} 圈 · 已跑 ${st.filter(Boolean).length}/${st.length} 段` })
      ]);
    } else {
      const timeOf = (car, i) => lapMs(car.sectors?.[i]?.v) || 0;
      const lit = f1MapSector;
      const cells = [0, 1, 2].map(i => {
        const ranked = picks.map(car => [car, timeOf(car, i)]).filter(([, t]) => t).sort((x, y) => x[1] - y[1]);
        return ranked;
      });
      const dashedCar = car => picks.slice(0, picks.indexOf(car)).some(o => o.colour === car.colour);
      m.gapLayer.innerHTML = [0, 1, 2]
        .map(i => {
          const w = cells[i][0]?.[0];
          const path = m.pathBetween(cuts[i], i < 2 ? cuts[i + 1] : 1);
          return (lit === i ? poly(path, 'tm-lit') : '') + (w ? poly(path, `tm-dom${dashedCar(w) ? ' dash' : ''}${lit != null && lit !== i ? ' faint' : ''}`, `stroke:${w.colour || '#888'}`) : '');
        })
        .join('');
      dom = el('div', { class: 'tm-panel' }, [
        el('div', { class: 'tm-strip' }, [0, 1, 2].map(i => {
          const [win, next] = cells[i];
          return el('button', { type: 'button', class: `tm-sec${lit === i ? ' on' : ''}`, style: win ? `--team:${win[0].colour || '#888'}` : null, onclick: () => ((f1MapSector = lit === i ? null : i), f1TrackMap(m.b, ss, { redraw: true })) }, [
            el('small', { text: `S${i + 1}` }),
            win ? el('span', { class: 'tm-sec-who' }, [faceOf(win[0]), el('strong', { text: win[0].tla || f1Sur(win[0]) })]) : el('span', { class: 'muted', text: '—' }),
            el('span', { class: 'num tm-sec-t', text: win ? (win[1] / 1000).toFixed(3) : '' }),
            el('small', { class: 'num tm-sec-gap', text: next ? `${next[0].tla || f1Sur(next[0])} +${((next[1] - win[1]) / 1000).toFixed(3)}` : '' })
          ]);
        }))
      ]);
    }
    dom = el('div', { class: 'tm-dom-box' }, [pick, dom]);
  }
  // On the cars: each picked one's gap to the first picked by its code; a ring on any car within a second of the car ahead (in range to pass).
  const first = picks[0];
  for (const car of b.cars) {
    const g = m.cars.get(car.no);
    if (!g) continue;
    const gap = first && car !== first && picked.has(car.no) && gapNum(car) != null && gapNum(first) != null ? gapNum(car) - gapNum(first) : null;
    if (gap != null) g.querySelector('.tm-tag').textContent = `${car.tla || car.no} +${gap.toFixed(1)}`;
    const iv = Number(String(car.interval || '').replace('+', ''));
    g.classList.toggle('close', car.pos > 1 && Number.isFinite(iv) && iv > 0 && iv < 1 && !car.inPit);
  }
  const holder = m.domBox || (m.domBox = el('div'));
  put(holder, dom);
  const note = !picks.length
    ? en ? 'Tap a car to compare it below. ◯ within a second of the car ahead.' : '點車加入下方的車手比較 · ◯ 與前車 1 秒內'
    : mode === 'lap'
      ? en ? 'Their lap so far, as F1 times it. Tap a car to add or drop it.' : 'F1 計時顏色 · 點車加入或移出比較'
      : en ? 'Each sector in the colour of the quickest there (best sectors); tap one to light it.' : '每段為最快者的顏色 · 點分段標出位置';
  // (Kept with the drawing: a tap redraws it in place, the note with it.)
  const noteEl = m.noteEl || (m.noteEl = el('p', { class: 'muted small tm-note' }));
  noteEl.textContent = note;
  // A redraw (a tap, a pick in 車手比較): the drawing on the page changed in place, no new card (it would take the drawing off the page).
  if (redraw) return null;
  return card(en ? 'On track' : '賽道位置', el('div', { class: 'tm-box' }, [m.svg, holder, noteEl]), { sub: c.name });
}

// Each car's laps (f1-live.js /laps.json, again each 15 seconds while it
// runs), with the board's own last lap of each car added as it comes (the
// stream may lag the board).
const f1LapData = new Map();
const f1Seen = new Map();
const f1Picks = new Map();
let f1LapMode = 'gap';
const f1AllLaps = new Set();
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
  if (!got?.loading && (!got || (!over && Date.now() - got.at > dev('f1Laps') * 1000) || (over && (got.live || !got.cars) && Date.now() - got.at > 60_000))) {
    f1LapData.set(k, { ...(got || { at: 0 }), loading: true });
    sessionLaps(k, over)
      .then(d => f1LapData.set(k, d?.cars ? { at: Date.now(), cars: d.cars, places: d.places || {}, stops: d.stops || {}, live: Boolean(d.live) } : { ...(got || {}), at: Date.now(), loading: false }))
      .catch(() => f1LapData.set(k, { ...(got || {}), at: Date.now(), loading: false }))
      .then(redraw);
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

const fmtGap = s => (s >= 60 ? `+${Math.floor(s / 60)}:${(s % 60).toFixed(0).padStart(2, '0')}` : `+${s.toFixed(s < 10 ? 1 : 0)}`);
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
  const over = Boolean(b.final || feedOver(b));
  const box = el('div', { 'data-laps': ss.start });
  const draw = () => {
    const { laps, places, stops, live } = lapsFor(b, ss, over, () => box.isConnected && draw());
    const cars = b.cars.filter(c => c.name);
    if (!f1Picks.has(ss.start)) f1Picks.set(ss.start, cars.slice(0, 2).map(c => c.no));
    const car = no => cars.find(c => c.no === no);
    const picks = f1Picks.get(ss.start).filter(no => car(no)).sort((x, y) => car(x).pos - car(y).pos);
    const setPicks = next => (f1Picks.set(ss.start, next), draw(), (!f1PickerOpen.has(ss.start) || !next.length) && f1Maps.get(ss.start)?.b && f1TrackMap(f1Maps.get(ss.start).b, ss, { redraw: true }));
    const dashed = no => picks.slice(0, picks.indexOf(no)).some(o => car(o)?.colour === car(no)?.colour);
    const colourOf = no => car(no)?.colour || '#888';
    const pitsOf = no => pitLaps(laps[no] || [], stops[no] || [], car(no)?.stints || []);
    const timeOf = (no, lap) => (laps[no] || []).find(x => x[0] === lap);
    const sec = en ? 's' : ' 秒';

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
    const toggle = el('button', { type: 'button', class: 'dc-toggle', 'aria-expanded': String(open), onclick: () => (f1PickerOpen.has(ss.start) ? f1PickerOpen.delete(ss.start) : f1PickerOpen.add(ss.start), draw(), f1Maps.get(ss.start)?.b && f1TrackMap(f1Maps.get(ss.start).b, ss, { redraw: true })) }, [
      el('span', { text: open ? (en ? 'Done' : '完成') : en ? 'Change drivers' : '選擇車手' }),
      el('small', { class: 'num', text: `${picks.length}/4` })
    ]);
    if (!picks.length) return put(box, card(en ? 'Compare' : '車手比較', el('div', { class: 'lc' }, [picker, el('p', { class: 'muted small fs-empty', text: en ? 'Pick up to four drivers.' : '選最多 4 位車手來比較' })]), { sub: toggle }));

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
          el('button', { type: 'button', class: 'dc-x', 'aria-label': en ? `Remove ${f1Shown(c.name)}` : `移除 ${f1Shown(c.name)}`, text: '×', onclick: () => setPicks(picks.filter(x => x !== no)) })
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
    else rows.push(row(en ? 'Laps' : '圈數', picks.map(no => cell(String(car(no).laps || 0)))));
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
    const table = el('table', { class: `dc-table n${picks.length}` }, [el('thead', {}, [head]), el('tbody', {}, rows)]);

    // The chart.
    const modes = [...(race && rest.length ? [['gap', en ? 'Gap' : '差距']] : []), ['time', en ? 'Lap times' : '圈速'], ...(race && Object.keys(places).length ? [['place', en ? 'Places' : '名次']] : [])];
    const mode = modes.some(([k]) => k === f1LapMode) ? f1LapMode : modes[0][0];
    const series = mode === 'gap'
      ? rest.map(c => ({ no: c.no, c, pts: gaps[c.no] }))
      : mode === 'place'
        ? picks.map(no => ({ no, c: car(no), pts: (places[no] || []).map((p, lap) => [lap, p]).filter(([, p]) => p > 0) }))
        : picks.map(no => ({ no, c: car(no), pts: (laps[no] || []).filter(x => x[1] > 0).map(x => [x[0], x[1]]) }));
    const all = series.flatMap(s => s.pts);
    let chart = el('p', { class: 'muted small fs-empty', text: en ? 'Laps show here as they are run.' : '跑完的圈會出現在這裡' });
    if (all.length) {
      const W = 340, H = 190, L0 = 44, R0 = 8, T0 = 10, B0 = 20;
      const lapLo = Math.min(...all.map(p => p[0]));
      const lapHi = Math.max(lapLo + 1, ...all.map(p => p[0]));
      const X = lap => L0 + ((lap - lapLo) / (lapHi - lapLo)) * (W - L0 - R0);
      // Better is up in every view (the owner, 2026-10-11): quicker laps, a
      // smaller gap (the first of them along the top line), a higher place.
      let top, bottom, label, ticks;
      if (mode === 'gap') {
        const vs = all.map(p => p[1]);
        top = Math.min(0, ...vs);
        bottom = Math.max(top + 1, ...vs);
        label = v => (Math.abs(v) < 0.05 ? a.tla : `${v > 0 ? '+' : ''}${v.toFixed(Math.abs(bottom - top) < 5 ? 1 : 0)}`);
        ticks = [...new Set([top, 0, (top + bottom) / 2, bottom])];
      } else if (mode === 'place') {
        top = Math.max(0.5, Math.min(...all.map(p => p[1])) - 0.5);
        bottom = Math.max(...all.map(p => p[1])) + 0.5;
        label = v => `P${Math.round(v)}`;
        const first = Math.ceil(top), last = Math.floor(bottom);
        ticks = [...new Set([first, Math.round((first + last) / 2), last])];
      } else {
        // Racing laps set the range: a pit lap or one behind the safety car runs off the bottom.
        const best = Math.min(...all.map(p => p[1]));
        const cap = best * 1.06;
        top = best - 300;
        bottom = Math.max(top + 1000, Math.min(cap, Math.max(...all.map(p => p[1]).filter(v => v <= cap))) + 300);
        label = v => fmtLap(v).replace(/(\.\d)\d\d$/, '$1');
        ticks = [top + 300, (top + bottom) / 2, bottom - 300];
      }
      const Y = v => T0 + ((Math.min(Math.max(v, top), bottom) - top) / (bottom - top)) * (H - T0 - B0);
      const shade = neutralLaps(b.control || [], b.lap?.now || lapHi)
        .filter(p => p.to >= lapLo && p.from <= lapHi)
        .map(p => `<rect class="lc-sc ${p.kind}" x="${X(Math.max(lapLo, p.from - 0.5)).toFixed(1)}" y="${T0}" width="${Math.max(3, X(Math.min(lapHi, p.to + 0.5)) - X(Math.max(lapLo, p.from - 0.5))).toFixed(1)}" height="${H - T0 - B0}"/><text class="lc-sc-t" x="${(X(Math.max(lapLo, p.from - 0.5)) + 3).toFixed(1)}" y="${H - B0 - 4}">${p.kind === 'sc' ? 'SC' : 'VSC'}</text>`)
        .join('');
      const grid = ticks.map(v => `<line class="lc-grid${mode === 'gap' && v === 0 ? ' zero' : ''}" x1="${L0}" x2="${W - R0}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="lc-y" x="${L0 - 6}" y="${(Y(v) + 3.5).toFixed(1)}">${label(v)}</text>`).join('');
      const step = Math.max(1, Math.ceil((lapHi - lapLo) / 5 / 5) * 5);
      const xsLaps = [lapLo, ...Array.from({ length: 6 }, (_, k) => Math.ceil(lapLo / step) * step + k * step).filter(l => l > lapLo + step / 2 && l < lapHi - step / 2), lapHi];
      const xt = xsLaps.map(l => `<text class="lc-x" x="${X(l).toFixed(1)}" y="${H - 5}">${l}</text>`).join('');
      const lines = series.map(s => {
        const col = colourOf(s.no);
        const pits = pitsOf(s.no);
        const d = s.pts.map((p, i) => `${i && s.pts[i - 1][0] === p[0] - 1 ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
        const dots = s.pts.filter(p => pits.has(p[0])).map(p => `<circle class="lc-pit" cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="3.2" style="stroke:${col}"/>`).join('');
        return `<path class="lc-line${dashed(s.no) ? ' dash' : ''}" d="${d}" style="stroke:${col}"/>${dots}`;
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
          const p = lap == null ? sr.pts.at(-1) : sr.pts.find(x => x[0] === lap);
          chipVal[k].textContent = valueText(p?.[1]);
          marks[k].hidden = lap == null || !p;
          if (p && lap != null) Object.assign(marks[k].style, { left: `${(X(p[0]) / W) * 100}%`, top: `${(Y(p[1]) / H) * 100}%` });
        });
        const under = lap != null && neutralLaps(b.control || [], b.lap?.now || lapHi).find(p => lap >= p.from && lap <= p.to);
        at.textContent = lap == null ? `${en ? `Lap ${series[0]?.pts.at(-1)?.[0] ?? lapHi}` : `第 ${series[0]?.pts.at(-1)?.[0] ?? lapHi} 圈`} · ${en ? 'Hold the chart to look back' : '按住圖表查看'}` : `${en ? `Lap ${lap}` : `第 ${lap} 圈`}${pitsAt(lap)}${under ? ` · ${under.kind === 'sc' ? (en ? 'Safety car' : '安全車') : en ? 'VSC' : '虛擬安全車'}` : ''}`;
        at.classList.toggle('on', lap != null);
        rule.hidden = lap == null;
        if (lap != null) rule.style.left = `${xs[i] * 100}%`;
      };
      // (Who stopped on that lap, said beside it.)
      const pitsAt = lap => {
        const who = series.filter(sr => pitsOf(sr.no).has(lap)).map(sr => sr.c.tla || f1Sur(sr.c));
        return who.length ? ` · ${who.join('、')} ${en ? 'pit' : '進站'}` : '';
      };
      const plot = scrubPlot(xs, show, [el('div', { class: 'lc-box', html: `<svg viewBox="0 0 ${W} ${H}" class="lc-svg" aria-hidden="true">${shade}${grid}${xt}${lines}</svg>` }), rule, ...marks]);
      show();
      const note = mode === 'gap' ? (en ? `Up: closer to ${f1Sur(a)} (the dashes). ○ a stop.` : `越高越接近 ${f1Sur(a)}（虛線）· ○ 進站`) : mode === 'place' ? (en ? 'Each lap\'s place, from the start. ○ a stop.' : '每圈名次，從起跑開始 · ○ 進站') : en ? 'Up: quicker. ○ a stop.' : '越高越快 · ○ 進站';
      chart = el('div', { class: 'lc-chart' }, [chips, at, plot, el('p', { class: 'muted small lc-key-note', text: note })]);
    }
    const pick = modes.length > 1 ? segmented(modes, mode, v => ((f1LapMode = v), draw()), 'lc-modes') : null;

    // The last laps side by side. Live: the last 5. Over: every lap, the latest 10 first and the rest a tap away.
    const allNos = [...new Set(picks.flatMap(no => (laps[no] || []).filter(x => x[1] > 0).map(x => x[0])))].sort((x, y) => y - x);
    const opened = f1AllLaps.has(ss.start);
    const lapNos = over ? (opened ? allNos : allNos.slice(0, 10)) : allNos.slice(0, 5);
    const lapTable = lapNos.length
      ? el('table', { class: `dc-table dc-laps n${picks.length}` }, [
          el('thead', {}, [el('tr', {}, [el('th', { class: 'dc-label', text: en ? 'Lap' : '圈' }), ...picks.map(no => el('th', { class: 'dc-colour', style: `--team:${colourOf(no)}` }, [el('span', { class: 'dc-code' }, [f1Face(ss, car(no).name), f1NameTap(ss, car(no), car(no).tla || f1Sur(car(no)))])]))])]),
          el('tbody', {}, lapNos.map(l => {
            const ts = picks.map(no => timeOf(no, l));
            const best = Math.min(...ts.filter(x => x?.[1]).map(x => x[1]));
            return el('tr', {}, [
              el('th', { class: 'dc-label num', text: String(l) }),
              ...ts.map((x, i) => cell(x?.[1] ? `${fmtLap(x[1])}${pitsOf(picks[i]).has(l) ? ' P' : ''}` : '—', `${x?.[1] === best && picks.length > 1 ? 'quick' : ''}${pitsOf(picks[i]).has(l) ? ' pit' : ''}`))
            ]);
          }))
        ])
      : null;
    const more = over && allNos.length > lapNos.length ? el('button', { class: 'q-btn small lc-more', type: 'button', text: en ? `All ${allNos.length} laps` : `顯示全部 ${allNos.length} 圈`, onclick: () => (f1AllLaps.add(ss.start), draw()) }) : null;
    put(box, card(en ? 'Compare' : '車手比較', el('div', { class: 'lc' }, [picker, table, pick, chart, lapTable ? el('p', { class: 'dc-sub', text: over ? (en ? 'Lap by lap' : '每圈圈速') : en ? 'Last 5 laps' : '最近 5 圈' }) : null, lapTable, more]), { sub: toggle }));
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
  const over = Boolean(b.final || feedOver(b));
  const draw = groups => {
    const [drivers, teams] = [groups?.[0]?.rows || [], groups?.[1]?.rows || []];
    if (!drivers.length) return put(box);
    const cars = b.cars.filter(c => c.name);
    const sur = n => plainName(String(n).split(' ').filter(w => !/^(jr|sr)\.?$/i.test(w)).at(-1));
    const carOf = r => cars.find(c => plainName(c.name) === plainName(r.en || r.name)) || cars.find(c => sur(c.name) === sur(r.en || r.name));
    if (over && counted(groups[0])) return put(box);
    const gain = c => pointsFor(ss.abbr, c.pos, c.retired || c.stopped);
    const dRows = asItStands(drivers.map(r => ({ ...r, key: r.id, pts: r.stats?.PTS, rank: r.stats?.RK })), new Map(drivers.map(r => [r.id, carOf(r) ? gain(carOf(r)) : 0])));
    const teamOf = name => f1Constructor(name).name;
    const tGain = new Map();
    for (const c of cars) tGain.set(teamOf(c.team), (tGain.get(teamOf(c.team)) || 0) + gain(c));
    const tRows = asItStands(teams.map(r => ({ ...r, key: teamOf(r.en || r.name), pts: r.stats?.PTS, rank: r.stats?.RK })), tGain);
    const view = f1TableView === 'teams' && tRows.length ? 'teams' : 'drivers';
    const list = view === 'teams' ? tRows : dRows;
    const all = f1TableAll.has(ss.start);
    const shown = all ? list : list.slice(0, 10);
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
    const more = list.length > 10 ? el('button', { class: 'q-btn small lc-more', type: 'button', text: all ? (en ? 'Top 10' : '只看前 10') : en ? `All ${list.length}` : `全部 ${list.length} ${view === 'teams' ? '隊' : '位'}`, onclick: () => (all ? f1TableAll.delete(ss.start) : f1TableAll.add(ss.start), draw(groups)) }) : null;
    const what = ss.abbr === 'SR' ? (en ? 'sprint' : '衝刺賽') : en ? 'race' : '正賽';
    const key = over ? (en ? `▲▼ places moved; + points from this ${what}.` : `▲▼ 名次變化 · + 本場得分`) : en ? `If the ${what} ended now. ▲▼ places moved; + points from this ${what}.` : `假如${what}現在結束 · ▲▼ 名次變化 · + 本場得分`;
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
  const over = Boolean(b.final || feedOver(b));
  const box = el('div', { 'data-pace': ss.start });
  const draw = () => {
    const { laps } = lapsFor(b, ss, over, () => box.isConnected && draw());
    const cars = b.cars.filter(c => c.name && c.stints?.length);
    const paced = cars.map(c => ({ c, p: practicePace(laps[c.no] || [], c.stints) }));
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
    tile(b.final || feedOver(b) ? (en ? 'Finished' : '完賽') : en ? 'Still running' : '仍在賽道', `${running} / ${cars.length}`, null, en ? `${cars.length - running} out` : `${cars.length - running} 位退賽`);
  } else {
    const busiest = [...cars].sort((x, y) => y.laps - x.laps)[0];
    if (busiest?.laps) tile(en ? 'Most laps' : '跑最多圈', `${busiest.laps}${en ? ' laps' : ' 圈'}`, busiest);
  }
  // Each card by name; put in their order at the end.
  const live = !(b.final || feedOver(b));
  const named = {};
  const add = (k, x) => (named[k] = x);
  if (live) add('weather', f1Weather(b));
  if (/^FP\d$/.test(ss.abbr)) add('pace', f1PracticePace(b, ss));
  add('compare', f1LapCompare(b, ss));
  // (Over too, until ESPN's own table has the race in.)
  if (race) add('table', f1LiveTable(b, ss));
  if (live) add('map', f1TrackMap(b, ss));
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
  // In the order they're read (the owner, 2026-10-11). Live: the weather in
  // a line, the cars on the track, the drivers picked side by side, a race's
  // stop window and tyres (the strategy), the headline numbers, a
  // qualifying's parts, the race's fastest laps, the championship as it
  // stands (context, after the race itself), the sectors and the speed
  // trap. Over: the headline numbers first, then the same without the
  // live-only cards. A practice's long runs after the compare.
  const order = live
    ? ['weather', 'map', 'compare', 'pace', 'stop', 'parts', 'tyres', 'tiles', 'laps', 'table', 'sectors', 'speed']
    : ['tiles', 'table', 'compare', 'pace', 'parts', 'tyres', 'laps', 'sectors', 'speed'];
  const cards = order.map(k => named[k]).filter(Boolean);
  return cards.length ? el('div', { class: 'stack fs-stats' }, cards) : null;

}
// The session's two views, 成績 (the order) and 數據 (f1Stats), the choice
// kept for the next session opened.
let f1BoardView = 'order';
function f1Views(order, stats) {
  const en = L() === 'en';
  if (!stats) return order;
  const body = el('div', {}, [f1BoardView === 'stats' ? stats : order]);
  const views = [['order', en ? 'Results' : '成績'], ['stats', en ? 'Stats' : '數據']];
  const pick = segmented(views, f1BoardView, v => {
    f1BoardView = v;
    put(body, v === 'stats' ? stats : order);
    if (v === 'stats') for (const n of stats.querySelectorAll('[data-laps], [data-pace]')) n.__redraw?.();
    pick.querySelectorAll('button').forEach((x, i) => x.setAttribute('aria-pressed', String(views[i][0] === v)));
  }, 'lb-views');
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
  s.body.append(el('div', { class: 'q-card pad fx-card' }, [el('div', { class: 'sess-head field-title' }, [raceFlag(e, 'big'), sessionTag(e), el('h3', { text: e.name })]), // The place, then the day and the official start: two designed lines (the
      // titles' time isn't said: the broadcast card says when the channel's on air).
      // The day and time, then the place, on one line: the time always whole, a long place cut (two lines read as one wrapped).
      el('p', { class: 'muted sess-line' }, [el('span', { class: 'sess-when num', text: whenText(shownStart(e)) }), e.venue ? el('span', { class: 'sess-where', text: e.venue }) : null]), weekendFollow(e), watchButton(e, 'wide')]));
  // A race weekend's replay and highlights go with the session picked below
  // (they're that session's); anything else's here.
  if (e.kind !== 'field') {
    const again = replayLink(e);
    if (again) s.body.append(again);
    const yt = highlights(e);
    if (yt) s.body.append(yt);
  }
  if (e.kind === 'field') {
    // The weekend's (or week's) sessions, then the chosen one's order.
    // (Each as F1's feed has it where it has said: on or over before ESPN.)
    // (The home's cards' rule: a session long past its start is over, ESPN's "on" or not.)
    const sessions = [...e.sessions].map(x => ({ ...x, status: sessionStatus(x) })).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    // A session on: its live board first, the weekend's schedule after it.
    const liveNow = sessions.some(x => x.status.state === 'in');
    // The weekend's schedule under the session's results (not a long list on top of them).
    const schedule = sessions.length > 1 ? card(T('schedule'), weekendTimeline(sessions)) : null;
    let pick = e.sessionKey ? Math.max(0, sessions.findIndex(x => x.abbr === e.sessionKey)) : Math.max(0, sessions.findLastIndex(x => x.status.state !== 'pre'));
    const box = el('div');
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
      raceWinLine(ss)
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
      const holder = el('div', { class: 'f1-holder' }, [known ? f1Final(known.rows, known.board, ss) : lastWord ? f1Final(null, { ...lastWord, final: true }, ss) : numbers ? shape() : espnList()]);
      put(
        box,
        sessions.length > 1 ? segmented(sessions.map((x, i) => [String(i), sessionName(x, L(), true)]), String(pick), v => ((pick = Number(v)), paint())) : null,
        // (A live F1 session's own card says it: the line said it twice.)
        e.league === 'f1' && ss.status.state === 'in' ? null : el('p', { class: 'muted small', text: `${sessionName(ss, L())} · ${statusText({ ...e, start: ss.start, status: ss.status })}` }),
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
        sessionTiming(ss.start)
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
    if (schedule) s.body.append(schedule);
  }
  s.body.append(twCard(e.league, e));
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
export async function openTeam(league, id, fallback = {}) {
  if (!id || !hasTeamPage(league) || fallback.guest) return;
  const s = sheet(leagueName(league, L()), { league });
  const content = el('div', {}, [spinner()]);
  s.body.append(content);
  ctx.track([teamKey(league, fallback.name || ''), `league:${leagueKey(league)}`].filter(k => !k.endsWith(':')), 1.5);
  const espn = Boolean(LEAGUES[league]?.espn);
  const en = L() === 'en';
  const W = (zh, eng) => (en ? eng : zh);
  try {
    const [info, all, groups, hurt = null, home] = espn
      ? await Promise.all([team(league, id), teamSchedule(league, id).catch(() => []), hasStandings(league) ? freshStandings(league).catch(() => null) : null, leagueInjuries(league).catch(() => null), homeLeague(league, id).catch(() => null)])
      : await ownTeam(league, id, fallback);
    const outside = Boolean(home && !home.key && home.name);
    // Only the competitions Orbit Sports has: a friendly or another country's
    // cup has nothing of its own here (its table, its names, its page).
    const sched = all.filter(x => !x.other && LEAGUES[x.league]);
    const now = Date.now();
    const played = sched.filter(x => x.status.state === 'post' && !x.status.void);
    const past = played.slice(-10).reverse();
    const upcoming = sched.filter(x => x.status.state !== 'post' && !x.status.void && Date.parse(x.start) > now - 4 * 3_600_000);
    const side = { id: info.id, name: info.name, en: info.en, logo: info.logo };
    const followBtn = followButton(() => ctx.isFollowed(league, id), () => ctx.toggleFollow(league, side));
    const place = placeOf(groups, id);
    // A club in several competitions: each game says which.
    const comps = new Set(sched.map(x => x.league)).size > 1;
    const resultOf = x => {
      const [me, them] = x.home.id === String(id) ? [x.home, x.away] : [x.away, x.home];
      return me.winner ? 'W' : them.winner ? 'L' : Number(me.score) === Number(them.score) && me.score !== '' ? 'D' : Number(me.score) > Number(them.score) ? 'W' : 'L';
    };
    const form = played.slice(-5).filter(x => x.home && x.away).map(resultOf);
    // Games played before the table's first are preseason ones, and so is ESPN's record then: said so.
    const pre = Boolean(groups?.length) && !groups.some(tableStarted) && played.length > 0;
    const record = [pre ? W('季前賽', 'Preseason') : '', (outside ? '' : info.record) || ownRecord(played, resultOf)].filter(Boolean).join(' ');
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
    const nextCard = next ? el('div', { class: 'team-next' }, [el('p', { class: 'mini-h', text: W('下一場', 'Next game') }), el('div', { class: 'q-card list' }, [eventRow(next, { league: comps })])]) : null;
    const tabsBox = el('div');
    const body = el('div', { class: 'team-tab' });
    const views = [['schedule', W('賽程', 'Schedule')], ['results', W('戰績', 'Results')]];
    if (espn && !outside) views.push(['roster', W('陣容', 'Roster')]);
    if (place) views.push(['table', W('排名', 'Table')]);
    let view = upcoming.length > 1 ? 'schedule' : 'results';
    let rosterList = null;
    const paint = () => {
      put(tabsBox, segmented(views, view, v => ((view = v), paint())));
      if (view === 'schedule') put(body, upcoming.length > 1 ? el('div', { class: 'q-card list' }, upcoming.slice(1, 16).map(x => eventRow(x, { league: comps }))) : empty(W('目前沒有更多賽程。', 'Nothing more scheduled yet.')));
      if (view === 'results')
        put(
          body,
          past.length
            ? el(
                'div',
                { class: 'q-card list results-list' },
                past.map((x, _, all) => {
                  // Its competition under the opponent, as a player's last games have it, when they're not all one.
                  const mixed = new Set(all.map(g => g.other || g.league)).size > 1;
                  const r = resultOf(x);
                  const them = x.home.id === String(id) ? x.away : x.home;
                  const at = x.home.id === String(id) ? 'vs' : '@';
                  const score = x.home.id === String(id) ? `${x.home.score}-${x.away.score}` : `${x.away.score}-${x.home.score}`;
                  return el('button', { class: 'res-row', type: 'button', onclick: () => ctx.openEvent(x) }, [
                    el('span', { class: 'res-date num', text: localDate(Date.parse(x.start)).slice(5).replace('-', '/') }),
                    el('span', { class: 'res-opp' }, [el('small', { class: 'muted', text: at }), logo(them.logo, them.name, 'xs'), el('span', { class: 'res-name' }, [el('span', { text: them.short || them.name }), mixed ? el('small', { class: 'res-comp', text: x.other ? otherName(x.other, en) : leagueName(x.league, L()) }) : null])]),
                    el('span', { class: `result-pill ${r === 'W' ? 'w' : r === 'L' ? 'l' : 'd'}`, text: `${en ? r : { W: '勝', L: '敗', D: '和' }[r]} ${score}` })
                  ]);
                })
              )
            : empty(W('本季還沒有賽果。', 'No results yet this season.'))
        );
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
              el('ul', { class: 'roster-list' }, g.players.map(p => el('li', {}, [el('span', { class: 'jersey num', text: p.jersey }), el('button', { class: 'link roster-name', type: 'button', onclick: () => ctx.openPlayer(league, p.id, { name: p.name, logo: p.headshot }) }, [personPic(p, league, 'xs round'), el('span', { text: p.name }), p.injured ? el('span', { class: 'inj-dot', title: T('injuries'), text: '🩹' }) : null]), el('small', { text: [posZh(p.pos, sport, L()), p.age ? (en ? `${p.age}` : `${p.age} 歲`) : ''].filter(Boolean).join(' · ') })])))
            ])
          )
        );
      }
      if (view === 'table') {
        const g = (groups || []).find(x => x.rows.some(r => r.id === String(id)));
        put(body, g ? standingsTables([g], league, { mark: [String(id)], compact: true }) : empty(T('noStandings')));
      }
    };
    put(
      content,
      el('div', { class: `team-hero${info.color ? ' tinted' : ''}`, style: info.color ? `--hero:${info.color}` : null }, [
        logo(info.logo, info.name, 'xl'),
        el('div', { class: 'team-hero-text' }, [
          el('h3', { text: info.name }),
          info.en && info.en !== info.name ? el('small', { class: 'muted', text: info.en }) : null,
          outside ? el('small', { class: 'muted team-home' }, [zhLater(home.name, 'en')]) : null,
          el('p', { class: 'team-hero-sub' }, joinNodes([record, place ? el('span', { class: 'nowrap', text: W(`${leagueName(league, L())}${groups.length > 1 && place.group ? ` ${groupName(place.group, 'zh')} · ` : ''}第 ${place.pos} 名`, `${place.pos}${['th', 'st', 'nd', 'rd'][place.pos % 10 < 4 && Math.floor(place.pos / 10) !== 1 ? place.pos % 10 : 0]} in ${groups.length > 1 && place.group ? groupName(place.group, 'en') : `the ${leagueName(league, L())}`}`) }) : !groups || groups.some(tableStarted) ? standingZh(info.standing, L()) : ''].filter(Boolean), ' · ')),
          form.length ? el('div', { class: 'hero-form' }, [resultPills(form)]) : null
        ]),
        followBtn
      ]),
      strip,
      teamInjuryCard(hurt?.[id], league),
      nextCard,
      tabsBox,
      body
    );
    paint();
  } catch {
    put(content, empty(T('failed')));
  }
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
      return { id: r.id, name: r.name, short: r.short, en: r.en, logo: r.logo, stats: { W: String(r.W), L: String(r.L), PCT: pct.toFixed(3).replace(/^0/, '') }, key: pct };
    })
    .sort((x, y) => y.key - x.key);
  if (rows.length) {
    const top = rows[0];
    for (const r of rows) {
      const gb = (Number(top.stats.W) - Number(r.stats.W) + Number(r.stats.L) - Number(top.stats.L)) / 2;
      r.stats.GB = gb === 0 ? '-' : String(gb);
    }
  }
  // The league's own table where there's one (CPBL's), the count otherwise.
  const own = hasStandings(league) ? await standings(league).catch(() => null) : null;
  const groups = own?.length ? own : rows.length ? [{ name: leagueName(league, L()), rows }] : null;
  return [{ id: String(id), name: me.name || fallback.name, en: me.en || fallback.en, logo: me.logo || fallback.logo, record: '' }, mine, groups];
}
// A squad in groups: ESPN's own (MLB's pitchers, catchers…) named in the
// reader's language, else by position (門將, 後衛, 中場, 前鋒).
const ROSTER_GROUP = { pitchers: '投手', catchers: '捕手', infielders: '內野手', outfielders: '外野手', 'designated hitter': '指定打擊', injured: '傷兵' };
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
const COL_ZH = { POD: '頒獎台', GP: '場', W: '勝', D: '和', L: '敗', GD: '淨勝', P: '積分', PTS: '積分', PCT: '勝率', GB: '勝差', STRK: '連勝敗', GAP: '落後' };
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
// A player's games newer than ESPN's log of them: the team's games over
// since the log's newest (six hours' grace: a log's date is the game's
// day), newest first, each with his line from its box score, in the log's
// columns (a percentage worked out from its made-attempted, a column the
// box score hasn't: –); a game he didn't play, 未上場.
async function newerGames(league, id, teamId, log, scheduleOf, name = '') {
  const newest = Date.parse(log.games[0]?.date || '') || 0;
  const done = (await scheduleOf()).filter(x => x.status?.state === 'post' && !x.status.void && Date.parse(x.start) > newest + 6 * 3_600_000).reverse().slice(0, 5);
  const lines = await Promise.all(done.map(x => summary(league, x.id).catch(() => null)));
  // MLB: his line from MLB's own box score, every column of the log (ESPN's has no 2B, 3B, GS, CG, SHO).
  const mlb = league === 'mlb' && name ? await Promise.all(done.map(x => mlbGameLog(x, name, log.labels).catch(() => null))) : [];
  return done.map((x, i) => {
    const d = lines[i];
    const home = String(x.home?.id) === String(teamId);
    const [us, them] = home ? [x.home, x.away] : [x.away, x.home];
    const [a, b] = [Number(us?.score), Number(them?.score)];
    const result = us?.winner || a > b ? 'W' : them?.winner || b > a ? 'L' : a === b && Number.isFinite(a) ? 'D' : '';
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
    return { id: String(x.id), date: x.start, at: home ? 'vs' : '@', home, league, leagueName: '', pre: Boolean(x.preseason || /preseason/i.test(x.note || '')), team: { id: String(teamId), abbr: us?.abbr || '', logo: us?.logo || null }, opp: { id: String(them?.id ?? ''), name: them?.name || '', abbr: them?.abbr || '', logo: them?.logo || null }, result, score: Number.isFinite(a) && Number.isFinite(b) ? `${a}-${b}` : '', stats };
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
      : el('small', { class: 'muted num', text: whenText(race.start) })
  ]);
}
// A league's table with what's over that it hasn't counted yet (title.mjs
// liveTable; F1: a race at F1's flag): every page with a table on it (a
// team's, a driver's, a constructor's) as 賽事's table has it.
// formula1.com's season place and points, as the table has them now (its
// page is updated a day after a race: 196 points, 5th, beside a table with
// the race in).
const freshSeason = (grid, champ) => (champ ? grid.map(([k, v]) => (k === 'Season Position' ? [k, String(champ.pos)] : k === 'Season Points' ? [k, String(champ.points)] : [k, v])) : grid);
function freshStandings(league) {
  return standings(league).then(g => {
    const sport = LEAGUES[league]?.sport;
    if (!g?.length) return g;
    const recent = ctx.recentOf?.(league) || [];
    const out = liveTable(g, sport === 'racing' ? settleScoring(recent) : recent, sport, { teamOf: side => f1Driver(side.en || side.name).team });
    if (out !== g) out.year = g.year;
    return out;
  });
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
    const [a, ov, table, races, official] = await Promise.all([
      athlete(league, id),
      athleteOverview(league, id).catch(() => null),
      sport === 'racing' && LEAGUES[league].standings ? freshStandings(league).catch(() => null) : null,
      sport === 'racing' ? seasonEvents(league).then(settleScoring).catch(() => []) : null,
      // F1: formula1.com's figures and each weekend's grid, finish and sprint.
      league === 'f1' ? athlete(league, id).then(x => f1Official('drivers', { page: f1Driver(x.name).page, name: x.name })).catch(() => null) : null
    ]);
    const en = L() === 'en';
    const W = (zh, eng) => (en ? eng : zh);
    const driver = league === 'f1' ? f1Driver(a.name) : null;
    const champ = table ? driverSeason(table, id) : null;
    const name = driver && !en && driver.zh !== a.name ? `${driver.zh}` : a.name;
    const facts = [
      [sport === 'racing' ? W('車隊', 'Team') : T('team'), withMark(driver?.team ? constructorBadge(driver.team, 'xs') : a.teamLogo ? logo(a.teamLogo, a.team, 'xs') : null, driver?.team && !en ? f1Constructor(driver.team).zh : a.team || driver?.team || '')],
      [T('country'), withMark(countryFlag(a.country) ? el('span', { class: 'fact-flag', 'aria-hidden': 'true', text: countryFlag(a.country) }) : null, countryName(a.country, L()))],
      [T('position'), zhLater(a.position)],
      [T('age'), a.age ? String(a.age) : ''],
      [T('height'), metric(a.height, L())],
      [T('weight'), metric(a.weight, L())],
      [T('born'), dateText(a.dob, a.born, L())],
      [T('birthPlace'), zhLater(a.birthPlace || official?.grids.bio?.find(([k]) => k === 'Place of Birth')?.[1])]
    ].filter(([, v]) => v);
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
    const oneComp = log && new Set(log.games.map(g => g.league || g.leagueName)).size === 1 ? log.games[0] : null;
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
    const logCardOf = log =>
      card(
          // Last season's (ESPN's until a player's first game of the new one: April's in October), said to be.
          Date.now() - (Date.parse(log.games[0]?.date || '') || Date.now()) > 45 * 86_400_000 ? W(`上季最後 ${log.games.length} 場`, `Last season's last ${log.games.length}`) : W(`近 ${log.games.length} 場`, `Last ${log.games.length} games`),
          el('div', { class: 'table-wrap' }, [
            el('table', { class: 'data game-log' }, [
              el('thead', {}, [el('tr', {}, [el('th', { class: 'left', text: W('日期', 'Date') }), el('th', { class: 'left', text: W('對手', 'Opp') }), el('th', { class: 'left', text: W('結果', 'Result') }), ...log.labels.map(k => el('th', { class: 'num', title: k, text: statName(k, L(), { sport, long: log.longs?.[log.labels.indexOf(k)] }) }))])]),
              el(
                'tbody',
                {},
                log.games.map(g =>
                  el('tr', opensMatch(g) ? { class: 'log-tap', onclick: () => openLogGame(g) } : {}, [
                    el('td', { class: 'left num', text: g.date ? localDate(Date.parse(g.date)).slice(5).replace('-', '/') : '' }),
                    el('td', { class: 'left' }, [
                      el('span', { class: 'opp-cell' }, [el('span', { class: 'muted opp-at', text: g.at === '@' ? '@' : 'vs' }), logo(g.opp.logo, g.opp.name, 'xs'), el('span', { class: 'opp-name', text: g.opp.abbr || g.opp.name })]),
                      g.pre ? el('small', { class: 'log-comp', text: W('熱身賽', 'Preseason') }) : !oneComp && (g.league || g.leagueName) ? el('small', { class: 'log-comp' }, [compOf(g)]) : null
                    ]),
                    el('td', { class: 'left' }, [el('span', { class: `result-pill ${g.result === 'W' ? 'w' : g.result === 'L' ? 'l' : g.result === 'D' || g.result === 'T' ? 'd' : ''}`, text: [g.result ? (en ? g.result : { W: '勝', L: '敗', D: '和', T: '和' }[g.result] || g.result) : '', g.score].filter(Boolean).join(' ') })]),
                    ...g.stats.map(v => el('td', { class: 'num', text: en ? v : LOG_WORDS[v] || v })),
                    opensMatch(g) ? el('td', { class: 'log-chev', 'aria-hidden': 'true', text: '›' }) : log.games.some(opensMatch) ? el('td') : null
                  ])
                )
              )
            ])
          ]),
          { sub: oneComp && (oneComp.league || oneComp.leagueName) ? compOf(oneComp) : '' }
        );
    let logCard = log ? logCardOf(log) : null;
    const awardsCard = ov?.awards?.length
      ? card(W('榮譽', 'Honours'), el('ul', { class: 'award-list' }, ov.awards.map(w => el('li', {}, [el('strong', {}, [zhLater(w.name)]), w.count ? el('span', { class: 'award-count num', text: w.count.replace(/x$/i, '×') }) : null, w.seasons.length ? el('small', { class: 'muted', text: w.seasons.slice(0, 6).join(' · ') + (w.seasons.length > 6 ? ' …' : '') }) : null]))))
      : null;
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
    const teamChip = driver?.team
      ? el('button', { class: 'hero-team', type: 'button', onclick: () => openConstructor({ id: '', name: driver.team, en: driver.team }) }, [constructorBadge(driver.team, 'xs'), el('span', { text: teamShown })])
      : team && teamShown
        ? el('span', { class: 'hero-team' }, [a.teamLogo ? logo(a.teamLogo, teamShown, 'xs') : null, el('span', { text: teamShown })])
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
    const sub = [a.jersey ? `#${a.jersey}` : '', zhLater(a.position), teamChip ? '' : teamShown || countryName(a.country, L())].filter(Boolean);
    const year = new Date().getFullYear();
    const heroColor = driver?.team ? driver.color : a.teamColor;
    const lastFive = weekends.length ? weekends.slice(0, 5).reverse().map(w => ({ name: w.e?.name || w.name, e: w.e, ...finishOf(w.me?.result, en) })) : raceRows.slice(0, 5).reverse().map(r => ({ ...r, text: `P${r.pos}` }));
    // Their headshot (ESPN's; none, every footballer: TheSportsDB's cut-out, personPic finds it).
    const pic = el('span', { class: 'pic-slot' }, [personPic({ id, name: a.name, headshot: a.headshot, logo: fallback.logo, flag: a.flag }, league, 'xxl round')]);
    // The key numbers in a strip under the hero (the season's first few).
    const keyNums = a.stats.list.slice(0, 4);
    const strip = keyNums.length
      ? el('div', { class: 'team-strip' }, keyNums.map(x => el('div', { class: 'ts-cell' }, [el('strong', { class: 'num', text: x.value }), el('small', { text: statName(x.label, L(), { sport, long: x.name }) })])))
      : null;
    // Tabs: 概況 (the latest, this season), 數據 (the numbers), 近期比賽 (the
    // game log), 資料 (profile, honours); only those with something in them.
    const keep = list => list.filter(Boolean);
    const racing = sport === 'racing';
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
      nextRace ? nextRaceCard(nextRace, en) : null,
      mateCard,
      !racing && a.stats.list.length ? card(seasonTitle(a.stats.title), el('div', { class: 'stat-grid' }, a.stats.list.map(x => tile(statName(x.label, L(), { sport, long: x.name }), x.value, x.rank)))) : null
    ]);
    const numbers = keep([
      og.gp ? card(W('正賽', 'Grand Prix'), f1Tiles(og.gp, en)) : summaryTiles.length ? card(W('本季表現', 'This season'), el('div', { class: 'stat-grid' }, summaryTiles)) : null,
      og.sprint ? card(W('衝刺賽', 'Sprint'), f1Tiles(og.sprint, en)) : null,
      ov?.season
        ? card(
            en || !/career/i.test(ov.season.title) ? statsTitle(ov.season.title, L()) || T('season') : '生涯數據',
            ov.season.rows.length > 1
              ? el('div', { class: 'table-wrap' }, [
                  el('table', { class: 'data game-log' }, [
                    el('thead', {}, [el('tr', {}, [el('th', { class: 'left' }), ...ov.season.rows[0].cells.map(c => el('th', { class: 'num', title: c.label, text: statName(c.label, L(), { sport, long: c.long }) }))])]),
                    el('tbody', {}, ov.season.rows.map(r => el('tr', {}, [el('th', { class: 'left split-name' }, [splitName(r.name, ov.season.rows, en) || zhLater(r.name)]), ...r.cells.map(c => el('td', { class: 'num', text: c.value }))])))
                  ])
                ])
              : el('div', { class: 'stat-grid dense' }, ov.season.rows[0].cells.map(c => tile(statName(c.label, L(), { sport, long: c.long }), c.value)))
          )
        : null,
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
    const bio = keep([
      facts.length ? card(T('profile'), el('ul', { class: 'info-list' }, facts.map(([k, v]) => el('li', {}, [el('span', { class: 'info-k', text: k }), el('span', { class: 'info-v' }, [v])])))) : null,
      awardsCard,
      driver?.team ? el('button', { class: 'q-btn block with-mark', type: 'button', onclick: () => openConstructor({ id: '', name: driver.team, en: driver.team }) }, [constructorBadge(driver.team, 'sm'), el('span', { text: `${en ? driver.team : f1Constructor(driver.team).zh} ›` })]) : null
    ]);
    // 本場 first when opened from a game: his numbers in it, live (drawn
    // again with each of the game page's refreshes while this one is open).
    const views = [
      game ? ['game', W('本場', 'This game'), () => gameCards(game, id, league)] : null,
      ['overview', W('概況', 'Overview'), overview],
      ['numbers', W('數據', 'Stats'), numbers],
      ['games', racing ? W('各站成績', 'Races') : W('近期比賽', 'Games'), games],
      ['bio', W('資料', 'Bio'), bio]
    ].filter(v => v && (typeof v[2] === 'function' || v[2].length));
    let view = views[0]?.[0];
    const tabsBox = el('div');
    const tabBody = el('div', { class: 'team-tab' });
    const paintTab = () => {
      put(tabsBox, views.length > 1 ? segmented(views.map(([k, label]) => [k, label]), view, v => ((view = v), paintTab())) : null);
      const v = views.find(x => x[0] === view)?.[2];
      put(tabBody, ...((typeof v === 'function' ? v() : v) || []));
    };
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
          // The name whole (two lines if it needs them); the number with the position under it.
          el('h3', { text: name }),
          name !== a.name ? el('small', { class: 'muted', text: a.name }) : null,
          teamChip,
          el('p', { class: 'muted' }, joinNodes(sub, ' · ')),
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
      strip,
      tabsBox,
      tabBody
    );
    paintTab();
    // The games ESPN's log hasn't caught up with (it's a day behind, and
    // MLB's leaves the postseason out): the team's games over since its
    // newest, his line from each one's box score, at once.
    if (log && a.teamId && !racing)
      newerGames(league, id, a.teamId, log, scheduleOf, a.name).then(newer => {
        if (!newer.length || !s.dialog.isConnected) return;
        const fresh = logCardOf({ ...log, games: [...newer, ...log.games].slice(0, Math.max(log.games.length, 5)) });
        const at = games.indexOf(logCard);
        if (at >= 0) games[at] = fresh;
        if (logCard.isConnected) logCard.replaceWith(fresh);
        logCard = fresh;
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
export const zoneName = n => (L() === 'en' ? n : ZONE_ZH.find(([re]) => re.test(n))?.[1] || n);
function raceBlock(race, g, league, many) {
  if (!race) return null;
  const W = (zh, eng) => (L() === 'en' ? eng : zh);
  const sport = LEAGUES[league]?.sport;
  const nm = r => r.short || r.name;
  const line = (icon, main, sub = '', cls = '') => el('div', { class: `race-line ${cls}`.trim() }, [glyph(icon), el('span', { class: 'race-t' }, [el('span', { html: main }), sub ? el('small', { text: sub }) : null])]);
  const b = x => `<b>${String(x).replace(/[<>&]/g, '')}</b>`;
  const lines = [];
  const t = race.title;
  // A cup's league phase has no champion: its first place is said as that.
  // A table under its own heading (a group, a half, the league phase) is
  // said plainly: 第一 (the heading says of what), the line kept to one row.
  const phase = Boolean(LEAGUES[league]?.cup) && !many;
  many = many || phase;
  const top = many ? W('第一', 'first place') : '';
  const unit = race.unit === 'pts' ? W(' 分', ' pts') : W(' 場', '');
  // Football's rounds as the league counts them: a matchweek league's and a
  // cup's league phase are each side's games (第 N 輪, 第 N 比賽日); MLS's
  // matchdays are its calendar's (a side sits some out): said in games.
  const perRound = sport === 'soccer' && (roundKind(league) === 'matchweek' || Boolean(LEAGUES[league]?.cup));
  const roundAt = (n, bold = x => x) => (L() === 'en' ? `${roundLabel(league, n, n, 'en').replace(/\d+/, bold)}` : roundLabel(league, n).replace(/\d+/, bold));
  const leftWord = n => (sport === 'racing' ? W(`還剩 ${n} 站`, `${n} to go`) : perRound ? W(`還剩 ${n} ${roundKind(league) === 'matchday' ? '個比賽日' : '輪'}`, `${n} ${roundKind(league) === 'matchday' ? 'matchday' : 'matchweek'}${n === 1 ? '' : 's'} to go`) : W(`還剩 ${n} 場`, `${n} game${n === 1 ? '' : 's'} to go`));
  const when = t.soonest == null ? '' : perRound ? W(`最快${roundAt(t.round)}`, `${roundAt(t.round)} at the earliest`) : sport === 'racing' ? (t.at ? W(`最快${t.at}`, `${t.at} at the earliest`) : W(`最快再 ${t.soonest} 站`, `${t.soonest} race weekends from now at the earliest`)) : W(`最快 ${t.soonest} 場後`, `${t.soonest} game(s) away at the earliest`);
  if (t.done) {
    const early = t.left > 0;
    lines.push(line('trophy', many ? W(`${b(nm(t.leader))} 拿下${top}`, `${b(nm(t.leader))} have clinched ${top}`) : W(`${b(nm(t.leader))} ${early ? '提前封王' : '奪冠'}`, `${b(nm(t.leader))} ${early ? 'have clinched the title' : 'are champions'}`), early ? leftWord(t.left) : '', 'won'));
  } else if (t.soonest != null && t.soonest <= 5) {
    // Wins: baseball's magic number (the leader's wins and the rivals' losses together).
    // Points: a title closes from both sides (the leader scoring, the rival
    // not), so say when at the soonest, and the lead against what's still to be won.
    if (race.unit === 'wins') lines.push(line('clock', W(`${b(nm(t.leader))} ${many ? top : '封王'}魔術數字 ${b(t.magic)}`, `${b(nm(t.leader))}: magic number ${b(t.magic)}`), when));
    else {
      const what = many ? W(`確定${top}`, `clinch ${top}`) : W('封王', 'clinch the title');
      const at = perRound ? W(`最快${roundAt(t.round, b)}`, `in ${roundAt(t.round, b)} at the earliest`) : sport === 'racing' ? (t.at ? W(`最快在${b(t.at)}`, `at ${b(t.at)} at the earliest`) : t.soonest === 1 ? W('最快下一站就', 'at the next race at the earliest') : W(`最快再 ${b(t.soonest)} 站`, `${b(t.soonest)} race weekends from now at the earliest`)) : W(`最快 ${b(t.soonest)} 場後`, `${b(t.soonest)} game(s) away at the earliest`);
      lines.push(line('clock', W(`${b(nm(t.leader))} ${at}${what}`, `${b(nm(t.leader))} can ${what}, ${at}`), 
        // (What it takes at the soonest, as a lead: more than the next one can still win after it; the lead now beside it.)
        t.gap > 0 ? W(`領先 ${t.gap} 分・屆時領先 ${t.leadAt} 分即${what}`, `${t.gap} pts ahead; a ${t.leadAt}-pt lead then does it`) : W(`與第二名同分・屆時領先 ${t.leadAt} 分即${what}`, `level on points; a ${t.leadAt}-pt lead then does it`)));
    }
  } else if (t.soonest != null) {
    const second = g.rows[1];
    // (The lead as the title's own sums have it: a table's points column isn't named alike in every league, and the line went blank.)
    const gap = second ? (race.unit === 'wins' ? Number(second.stats.GB) : t.gap) : 0;
    lines.push(line('clock', W(`${many ? top : '冠軍'}${when}才會確定`, `${many ? top : 'The title'}: ${when}`), !second ? '' : gap > 0 ? W(`${nm(t.leader)} 領先 ${gap}${unit}`, `${nm(t.leader)} lead by ${gap}`) : W(`${nm(t.leader)} 與 ${nm(second)} 同${race.unit === 'pts' ? '分' : '勝'}`, `${nm(t.leader)} level with ${nm(second)}`)));
  }
  // The next places still open: F1's always (a championship's 2nd and 3rd
  // matter), a league's once its title is settled.
  // The close fights still on (F1's, once the champion's decided).
  const team = !g.rows.some(r => r.athlete);
  for (const p of race.places) {
    const names = p.rows.slice(0, 3).map(nm).join('、') + (p.rows.length > 3 ? W(` 等 ${p.rows.length} ${team ? '隊' : '位'}`, ` +${p.rows.length - 3}`) : '');
    const span = p.to > p.pos ? `${p.pos}–${p.to}` : `${p.pos}`;
    const fight = line('medal', W(`${b(`第 ${span} 名之爭`)} ${names}`, `${b(`Fight for P${span}`)} ${names}`), p.spread > 0 ? W(`前後相差 ${p.spread}${unit}`, `${p.spread}${unit} apart`) : W('同分', 'level on points'));
    fight.classList.add('fight');
    lines.push(fight);
  }
  // What the zones have settled.
  for (const z of race.zones) {
    if (!z.sure.length || z.sure.length === g.rows.length) continue;
    const who = z.sure.map(id => g.rows.find(r => r.id === id)).filter(Boolean);
    const names = who.slice(0, 4).map(nm).join('、') + (who.length > 4 ? W(` 等 ${who.length} 隊`, ` +${who.length - 4}`) : '');
    const zn = zoneName(z.note);
    const row = line('lock', z.bottom ? W(`${b(`確定${zn}`)} ${names}`, `${b(`Confirmed: ${zn}`)} ${names}`) : W(`${b(`確定${zn}`)} ${names}`, `${b(`Sure of ${zn}`)} ${names}`));
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
    const head = z.bottom ? W(`避開${zn}`, `Avoiding ${zn}`) : W(`${zn}之爭`, `Race for ${zn}`);
    const how = W(` ${n} 隊・${z.fight.spread > 0 ? `相差 ${z.fight.spread} 分` : '同分'}`, ` ${n} teams, ${z.fight.spread > 0 ? `${z.fight.spread} pts apart` : 'level'}`);
    const row = line('medal', `${b(head)}${how}`, '');
    const small = row.querySelector('.race-t small') || row.querySelector('.race-t').appendChild(el('small'));
    small.replaceChildren(...z.fight.rows.flatMap((r, k) => [k ? document.createTextNode('、') : null, el('span', { class: 'nm-one', text: nm(r) })].filter(Boolean)));
    if (z.color) row.style.setProperty('--zone', z.color);
    row.classList.add('zone', 'fight');
    lines.push(row);
  }
  // Two lines at most: the title's first, then a fight (F1's constructors',
  // a zone's), then what's been locked in.
  const rank = l => (l.classList.contains('fight') ? 1 : l.classList.contains('zone') ? 2 : 0);
  const kept = lines.map((l, k) => [l, k]).sort((x, y) => rank(x[0]) - rank(y[0]) || x[1] - y[1]).slice(0, 2).map(([l]) => l);
  return kept.length ? el('div', { class: 'title-race' }, kept) : null;
}
export function standingsTables(groups, league, { mark = [], top = 0, compact = false, races = [], many = false } = {}) {
  const sport = LEAGUES[league]?.sport;
  const want = STANDING_COLUMNS[sport] || ['W', 'L'];
  const small = COMPACT_COLUMNS[sport] || want;
  // Short headers in the reader's language.
  const colName = colLabel;
  return el(
    'div',
    { class: 'stack' },
    groups.map(g => {
      const cols = want.filter(c => g.rows.some(r => r.stats[c] != null && r.stats[c] !== ''));
      const rows = top ? g.rows.filter((r, i) => i < top || ctx.isFollowed(league, r.id)) : g.rows;
      // Columns beyond the essentials go on narrow screens (and in compact tables).
      const cls = c => `num${!small.includes(c) ? ' extra' : ''}${c === 'GAP' || c === 'GB' ? ' gap' : ''}`;
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
                const name = [el('span', { class: 'nm-full', text: r.name }), el('span', { class: 'nm-short', text: r.short || r.name })];
                const rowCls = [ctx.isFollowed(league, r.id) ? 'mine' : mark.includes(r.id) ? 'marked' : '', out.has(r.id) ? 'out' : ''].filter(Boolean).join(' ');
                return el('tr', { class: rowCls }, [
                  el('td', { class: 'left num rank-cell', style: r.color ? `box-shadow: inset 3px 0 0 ${r.color}` : null }, [String(i + 1), settled.has(r.id) ? glyph('lock', 'rank-lock') : null]),
                  el('th', { class: 'left name-cell' }, [
                    el('button', { class: 'link team-link', type: 'button', onclick: () => (r.athlete ? r.id && ctx.openPlayer(league, r.id, r) : league === 'f1' ? openConstructor(r) : r.id && openTeam(league, r.id, r)) }, [r.athlete ? personPic(r, league, 'xs round') : league === 'f1' ? constructorBadge(r.en || r.name, 'xs') : logo(r.logo, r.name, 'xs'), el('span', { class: 'nm' }, name)])
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
// wild card), and once over, by its zones; a championship's (F1's) against
// the title.
export function outOfIt(g, race, league) {
  const rows = g?.rows || [];
  const sport = LEAGUES[league]?.sport;
  const total = SEASON_GAMES[league];
  const played = r => (sport === 'soccer' ? Number(r.stats.GP) : Number(r.stats.W) + Number(r.stats.L) + (Number(r.stats.T) || 0));
  const over = race ? race.rows.every(x => x.settled) && race.title.done : total ? rows.every(r => played(r) >= total) : false;
  // ESPN's e: out of the playoffs, during the season and after it.
  if (rows.some(r => r.clincher)) return new Set(rows.filter(r => r.clincher === 'e').map(r => r.id));
  const zones = rows.some(r => r.note && !/relegat|eliminat/i.test(r.note));
  const ended = over || (total && rows.every(r => played(r) >= total));
  // A playoff league's season over: the sides outside its playoff zones.
  if (ended && zones && FORMATS[league] && !LEAGUES[league]?.cup) return new Set(rows.filter(r => !r.note || /relegat|eliminat/i.test(r.note)).map(r => r.id));
  if (!race || ended) return new Set();
  if (sport === 'racing') return new Set(race.title.done ? [] : race.rows.filter(x => x.best > 1).map(x => x.id));
  if (!zones) return new Set();
  const reach = goodZoneReach(rows);
  return new Set(race.rows.filter(x => x.best > reach).map(x => x.id));
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
  return el('div', { class: 'zone-legend' }, [...seen].map(([note, color]) => el('span', { class: 'zone-key' }, [el('i', { style: `background:${color}`, 'aria-hidden': 'true' }), document.createTextNode(zoneName(note))])));
}

// ---- A playoff series or a knockout tie: every game of it ---------------------------------

// The tie (bracket.mjs): its two sides with the wins (or aggregate), who
// went through or what's next, then each game, G1 first, each opening its match.
// A match's stage and series ("國聯分區系列賽 G4 · 道奇 系列賽 3-1 獲勝"): a
// playoff series or a two-legged tie opens the whole of it, as 季後賽 does.
function stageLine(e) {
  const parts = [stageTag(e, L()) ? el('span', { class: 'stage-tag', text: stageTag(e, L()) }) : null, seriesText(e) ? el('small', { text: seriesText(e) }) : null, weekOf(e) ? el('small', { text: roundLabel(e.league, weekOf(e), weekOf(e), L()) }) : null];
  if (!e.round || !(e.series || e.round.leg) || !ctx.seriesOf) return el('div', { class: 'mh-stage' }, parts);
  // The › at the end of the last words, never alone on a line of its own.
  const shown = parts.filter(Boolean);
  const chev = el('span', { class: 'mh-chev', 'aria-hidden': 'true', text: '\u00a0›' });
  if (shown.at(-1)?.tagName === 'SMALL') shown.at(-1).append(chev);
  else shown.push(chev);
  const btn = el('button', { class: 'mh-stage link', type: 'button', 'aria-label': L() === 'en' ? 'See the whole series' : '看整個系列賽' }, shown);
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const got = await ctx.seriesOf(e).catch(() => null);
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
    return el('div', { class: `tie-side${t.winner ? (t.winner === id ? ' win' : ' out') : ''}` }, [sideLogo(x, league, 'sm'), el('strong', { class: 'tie-name', text: x.short || x.name }), el('strong', { class: 'num tie-score', text: t.score?.[id] ?? '' })]);
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
