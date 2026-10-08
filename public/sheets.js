// Orbit Sports' sheets: a match (header, then its data by section), a
// race weekend, a team, a player, and the
// standings tables they share with the Standings tab.
import { translate, workerLines, proxyJson } from '#kit/quadra.mjs';
import { searchUrl, videoUrl, knownHighlights, findHighlights, highlightsKind } from './lib/highlights.mjs';
import { teamNameZh } from '#kit/names.mjs';
import { splitName, otherName } from './lib/compname.mjs';
import { weekOf, winLine, winNow, raceWinLine, scoreboard, splitWeekend, settleField, summary, cpblGame, teamInjuries, mergeInjuries, standings, team, teamSchedule, roster, athlete, athleteOverview, STANDING_COLUMNS, COMPACT_COLUMNS, sessionName, seasonEvents, driverSeason, news, newsAbout, storyAbout, storyAboutTeam, homeLeague, roundLabel, roundKind } from './lib/espn.mjs';
import { stageTag, groupName } from './lib/stage.mjs';
import { tableStarted } from './lib/picks.mjs';
import { playPeriod } from './lib/live.mjs';
import { lineXs, periodMarks, pointStamp, stampAt, quietRuns, periodName, nearestMoment, holdToEnd, sideColors } from './lib/wpline.mjs';
import { playMoments, eventMoments, raceMoments, scoreAt, bandName, lateClock, feedText, playParts } from './lib/moments.mjs';
import { controlBands, causeOf, PM_LEAGUE } from './lib/winprob.mjs';
import { statName, statsTitle, metric, fixedWord, dateText, injuryZh, seriesLineZh, weatherZh, pitchZh, posZh, standingZh, leaderValue, teamStatRows } from './lib/statnames.mjs';
import { f1Driver, f1Constructor, countryName, logoPicture, countryFlag, F1_TEAMS } from '#kit/logos.mjs';
import { namedZh } from './lib/f1names.mjs';
import { f1Official, f1Label, f1Value, finishOf, eventOfRace, raceResult, qualifyingResult, espnQualifying, liveTiming, keptTiming, qualiCut } from './lib/f1.mjs';
import { tvOf, replayOf } from './lib/tv.mjs';
import { broadcastsOf, twSource, ELTA_VOD, guideWhen } from './lib/broadcast.mjs';
import { LEAGUES, leagueName, hasTeamPage, hasStandings } from './lib/leagues.mjs';
import { SEASON_GAMES } from './lib/title.mjs';
import { FORMATS } from './lib/playoffs.mjs';
import { teamKey, leagueKey } from './lib/foryou.mjs';
import { ctx, el, shownStart, timeText, leagueMark, put, spinner, empty, skeleton, logo, diamond, clock, dayLabel, localDate, statusText, whenText, eventRow, sheet, segmented, seriesText, tvName, watchLink, watchButton, audioName, sessionTag, raceFlag, personPic, sideLogo, today } from './ui.js';

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
  // Each side's injuries from its roster (ESPN's game page leaves some out).
  let hurt = {};
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
  const timer = setInterval(refresh, 15_000);
  document.addEventListener('visibilitychange', refresh);
  const stop = () => {
    clearInterval(timer);
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
    if (data?.plays.length || data?.keyEvents.length) tabs.push(['plays', T('plays')]);
    if (data?.rosters.some(r => r.players.length)) tabs.push(['lineups', T('lineups')]);
    // The table only once it has a game in it (a preseason's is all zeros in the feed's order).
    const shownTable = table?.length ? table : data?.table.length ? [{ rows: data.table.map(r => ({ id: r.id, stats: r.stats })) }] : [];
    if (shownTable.some(tableStarted)) tabs.push(['table', T('table')]);
    else if (view === 'table') view = 'overview';
    put(sections, tabs.length > 1 ? segmented(tabs, view, v => ((view = v), paint())) : null);
    put(content, matchSection(view, data && { ...data, injuries: mergeInjuries(data.injuries, hurt) }, e, table, { line, wait }));
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
  if (lv.events?.length) {
    const col = id => lv.events.filter(x => x.team === id).map(x => el('li', {}, [el('span', { class: 'num', text: x.minute }), el('span', { text: `${x.kind === 'red' ? '🟥' : '⚽'} ${x.who}${x.kind === 'pen' ? '（PK）' : x.kind === 'own' ? (en ? ' (OG)' : '（烏龍）') : ''}` })]));
    rows.push(el('div', { class: 'lp-goals' }, [el('ul', {}, col(e.away.id)), el('ul', { class: 'home' }, col(e.home.id))]));
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
  const head = Array.from({ length: n }, (_, i) => el('th', { text: String(i + 1) }));
  // The sides by their Chinese names when they have them (a short one fits the column).
  const tag = x => (L() !== 'en' && x.en && x.short && x.short.length <= 5 ? x.short : x.abbr || x.short);
  const row = x => el('tr', {}, [el('th', { class: 'ls-team', text: tag(x) }), ...Array.from({ length: n }, (_, i) => el('td', { class: 'num', text: x.lines?.[i] ?? '' })), el('td', { class: 'num total', text: x.score })]);
  return el('div', { class: 'table-wrap' }, [el('table', { class: 'linescore' }, [el('thead', {}, [el('tr', {}, [el('th'), ...head, el('th', { text: 'T' })])]), el('tbody', {}, [row(away), row(home)])])]);
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

// ---- News ---------------------------------------------------------------------------------
//
// Not a news app: no list of stories, no team news. A player's or driver's
// sheet leads with 最新動態, ESPN's newest story about them (their name in the
// headline: espn.mjs storyAbout) from the last three days, in Chinese, or
// ESPN's own note on them when that's newer.
const FRESH_NEWS_MS = 3 * 86_400_000;
// The newest story, when it's from the last three days: drawn as a player's
// 最新動態 is (its headline, then its summary a point a sentence).
function freshNews(stories, league = '') {
  const st = stories[0];
  if (!st || Date.now() - st.at >= FRESH_NEWS_MS) return null;
  const en = L() === 'en';
  const zh = text => (en ? text : league === 'f1' ? f1Later(text) : zhLater(text, 'en'));
  const points = String(st.summary || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z"'(“])/)
    .map(x => x.trim())
    .filter(x => x.length > 2);
  return card(
    en ? 'Latest' : '最新動態',
    el('div', { class: 'player-note' }, [
      el('strong', { class: 'note-head' }, [zh(st.headline)]),
      points.length ? el('ul', { class: 'note-points' }, points.slice(0, 3).map(x => el('li', {}, [zh(x)]))) : null
    ]),
    { sub: dayLabel(localDate(st.at)) }
  );
}

// 最新動態 (Shared-Proxy latest.js): a player's, a driver's or a team's real
// news, and only that. The sheet sends who they are and what people wrote
// on them lately (ESPN's injury report, RotoWire's note); the Worker reads
// ESPN's and Google News's stories, and Gemini writes a card only when
// there's real news (an injury, a case, a transfer...), else none: no card
// on a quiet day, never the page's numbers read back. No match cards.
//
// Fast: each answer (a card or none) is kept on the phone half an hour, so
// opening a sheet again asks nothing. Older than that, or kept by an older
// version of the app, the kept one shows at
// once and a new one is fetched for the next opening (never swapped in
// under a finger); none kept: nothing until the Worker says it's writing a
// card (then its shape), so a sheet with no news never shows a loader.
// English (no Gemini), or Gemini down: ESPN's own word (`now`).
const LATEST_KEY = 'fx.latest.v1';
const LATEST_FRESH_MS = 30 * 60_000;
const latestMemo = () => {
  try {
    return JSON.parse(localStorage.getItem(LATEST_KEY) || '{}') || {};
  } catch {
    return {};
  }
};
// This deploy's stamp: answers kept by an older one aren't used.
const BUILD = () => document.querySelector('meta[name="build-version"]')?.content || '';
// The Worker's prompt as last seen (each answer says it, `v`): a card kept
// here from another is never taken as fresh.
const LATEST_V_KEY = 'fx.latest.prompt';
function seenPrompt(v) {
  try {
    if (v) localStorage.setItem(LATEST_V_KEY, v);
    return localStorage.getItem(LATEST_V_KEY) || '';
  } catch {
    return '';
  }
}
function rememberLatest(k, sent, answer) {
  try {
    const m = latestMemo();
    m[k] = { at: Date.now(), sent, answer, build: BUILD() };
    const keep = Object.keys(m).sort((x, y) => m[y].at - m[x].at).slice(0, 300);
    localStorage.setItem(LATEST_KEY, JSON.stringify(Object.fromEntries(keep.map(x => [x, m[x]]))));
  } catch {
    // Storage full or off: asked again next time.
  }
}
// One ask per body a session (a card or none; a failure asked again).
const latestAsked = new Map();
function askLatest(body) {
  if (!latestAsked.has(body)) latestAsked.set(body, workerLines('/latest', 'stream=1', { body, timeout: 20000 }).then(r => (r?.headline || r?.none ? r : (latestAsked.delete(body), null))));
  return latestAsked.get(body);
}
// 最新動態's words: a space between Chinese and Latin ("Van de Ven 傷勢無礙"),
// and each person Gemini names ({{Micky van de Ven}}) as that person: a chip
// with their face that opens them, once they're found among `people`.
const spaced = t => String(t).replace(/([\u3400-\u9fff])([A-Za-z0-9])/g, '$1 $2').replace(/([A-Za-z0-9.,!?%])([\u3400-\u9fff])/g, '$1 $2');
const notePlain = n => String(n || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z ]/g, '').trim();
function findPerson(people, name) {
  const want = notePlain(name);
  const last = want.split(' ').at(-1);
  return people.find(p => notePlain(p.name) === want) || people.find(p => p.name && notePlain(p.name).split(' ').at(-1) === last && notePlain(p.name)[0] === want[0]) || null;
}
// Lines may break after a clause (，、；) and on either side of a name (the
// headline breaks only there, when it can).
const noteWords = text => {
  const out = [];
  let clause = [];
  const close = () => clause.length && (out.push(el('span', { class: 'note-clause' }, clause), el('wbr')), (clause = []));
  String(text || '')
    .split(/\{\{([^{}]+)\}\}/)
    .forEach((part, i, all) => {
      // (A line may break on either side of a name.)
      if (i % 2) return clause.push(el('wbr'), el('span', { class: `note-who${all[i - 1] ? '' : ' lead'}`, 'data-who': part.trim(), text: part.trim() }), el('wbr'));
      for (const bit of spaced(part).split(/(?<=[，、；：。！？])/)) {
        if (bit) clause.push(document.createTextNode(bit));
        if (/[，、；：。！？]$/.test(bit)) close();
      }
    });
  close();
  return out;
};
// The names made people: a chip each (face, name; a tap opens them), the subject in their own name.
function namePeople(node, league, people) {
  // (A roster comes in groups by position: their players.)
  const all = people.flatMap(p => (Array.isArray(p?.players) ? p.players : [p]));
  for (const span of node.querySelectorAll('.note-who[data-who]')) {
    const p = findPerson(all, span.dataset.who);
    if (!p) continue;
    const shown = p.zh || span.dataset.who;
    const lead = span.classList.contains('lead') ? ' lead' : '';
    span.replaceWith(
      p.id && !p.self
        ? el('button', { class: `note-who chip${lead}`, type: 'button', onclick: () => ctx.openPlayer(league, p.id, { name: p.name, logo: p.headshot }) }, [personPic(p, league, 'xs round'), el('span', { text: shown })])
        : el('span', { class: `note-who self${lead}`, text: shown })
    );
  }
}
// What the news is, as a tag: Gemini's topic.
const NOTE_TOPIC = { injury: ['傷勢', 'bad'], return: ['回歸', 'good'], suspension: ['禁賽', 'bad'], grid: ['發車', 'bad'], legal: ['司法', 'bad'], transfer: ['轉會', 'info'], contract: ['合約', 'info'], rumour: ['傳聞', 'muted'], coach: ['教練', 'info'], role: ['陣容', 'info'], milestone: ['里程碑', 'good'], criticism: ['批評', 'bad'], quote: ['發言', 'muted'] };
const topicTag = topic => (NOTE_TOPIC[topic] ? el('span', { class: `note-topic ${NOTE_TOPIC[topic][1]}`, text: NOTE_TOPIC[topic][0] }) : null);
// Another story's line: its tag starting its first clause and its source
// ending its last, so neither is left on a line of its own.
function alsoLine(m) {
  const clauses = noteWords(m.line);
  const tag = topicTag(m.topic);
  const spans = clauses.filter(c => c.tagName === 'SPAN');
  if (tag && spans[0]) spans[0].prepend(tag);
  if (m.url && spans.at(-1)) spans.at(-1).append(el('a', { class: 'note-also-src', href: m.url, target: '_blank', rel: 'noopener', text: `${m.source || '原文'} ›` }));
  return clauses;
}
// The biggest story first (Gemini's weight: big, normal, minor; a minor one
// is its headline only), then up to two more in a line each (其他消息), each
// its own link.
const latestNote = (headline, points, sub, { topic = '', url = '', source = '', weight = '', more = [] } = {}) =>
  card(
    '最新動態',
    el('div', { class: `player-note${weight ? ` ${weight}` : ''}` }, [
      topicTag(topic),
      el('strong', { class: 'note-head' }, noteWords(headline)),
      points?.length && weight !== 'minor' ? el('ul', { class: 'note-points' }, points.map(p => el('li', {}, noteWords(p)))) : null,
      url ? el('a', { class: 'note-src', href: url, target: '_blank', rel: 'noopener', text: `閱讀原文${source ? ` · ${source}` : ''} ›` }) : null,
      more?.length
        ? el('div', { class: 'note-also' }, [
            el('p', { class: 'mini-h', text: '其他消息' }),
            ...more.map(m =>
              el('div', { class: 'note-also-row' }, alsoLine(m))
            )
          ])
        : null
    ]),
    { sub }
  );
const aiCard = (ai, league = '', people = null) => {
  if (!ai?.headline) return null;
  const node = latestNote(ai.headline, ai.points, ai.at ? dayLabel(localDate(ai.at)) : '', ai);
  if (people && node.querySelector('.note-who[data-who]')) Promise.resolve(people()).then(list => list?.length && namePeople(node, league, list)).catch(() => {});
  return node;
};
const fadeIn = node => (node && node.classList.add('fade-in'), node);
// `people`: () => [{ id, name, headshot, zh?, self? }] (or a promise of them), the names its card can make chips of.
function latestSlot(league, kind, id, { name = '', zh = '', team = '', facts = [], report = [], people = null } = {}, now = null) {
  if (L() === 'en' || !id) return now;
  const k = `${league}|${kind}|${id}`;
  const sent = JSON.stringify([facts, report]);
  const memo = latestMemo()[k];
  const known = memo?.sent === sent ? memo : null;
  // Kept on this phone, from the Worker's prompt as last seen and this
  // version of the app, and under half an hour old: shown, not asked again.
  if (known && known.build === BUILD() && known.answer?.v && known.answer.v === seenPrompt() && Date.now() - known.at < LATEST_FRESH_MS) return aiCard(known.answer, league, people);
  const body = JSON.stringify({ league, kind, id: String(id), team: String(team || ''), name, zh, facts, report });
  // Nothing shown until there's a card: no loading shape (most answers are
  // "no flash", and a shape that came and went was worse than nothing). One
  // kept here shows at once, and the Worker's answer takes its place when it
  // differs (a new prompt's: a card gone, or another), not the next opening.
  const box = el('div', { class: 'latest-slot' });
  const shown = known ? aiCard(known.answer, league, people) : null;
  if (shown) box.append(shown);
  const same = (a, b) => JSON.stringify([a?.headline, a?.points, a?.more, a?.none]) === JSON.stringify([b?.headline, b?.points, b?.more, b?.none]);
  askLatest(body).then(a => {
    if (!a) return;
    rememberLatest(k, sent, a);
    if (a.v) seenPrompt(a.v);
    if (known && same(a, known.answer)) return;
    // No flash: no card. ESPN's newest story isn't put in its place: that's
    // the quote or preview a 快訊 leaves out (it stays the card in English,
    // which has no flashes).
    const card = aiCard(a, league, people);
    put(box, card ? fadeIn(card) : null);
  });
  return box;
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
    return card(
      T('teamStats'),
      el(
        'div',
        { class: 'stat-bars' },
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
          .filter(tb => tb.rows.length)
          .map(tb =>
            card(
              [nameOf(p.team), boxTableName(tb.name)].filter(Boolean).join(' · '),
              boxTable(tb, `${e.id}|${p.team}|${tb.name}`, r =>
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
          .concat(gameNotes(d.details?.find(x => x.team === p.team), nameOf(p.team)) || [])
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
    const list = sport === 'basketball' && d.feed.length ? d.feed : sport === 'baseball' && d.feed.some(p => p.kind === 'play-result') ? d.feed.filter(p => p.kind === 'play-result' || (p.scoring && p.kind !== 'play-result')) : d.keyEvents.length ? d.keyEvents : d.plays;
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
  if (view === 'lineups' && d) {
    return el(
      'div',
      { class: 'lineups' },
      d.rosters
        .filter(r => r.players.length)
        .map(r => {
          const starters = r.players.filter(p => p.starter);
          const subs = r.players.filter(p => !p.starter);
          const list = ps => el('ul', { class: 'roster-list' }, ps.map(p => el('li', {}, [el('span', { class: 'jersey num', text: p.jersey }), el('button', { class: 'link roster-name', type: 'button', onclick: () => ctx.openPlayer(e.league, p.id, p) }, [personPic(p, e.league, 'xs round'), el('span', { text: p.name })]), el('small', { text: posZh(p.pos, LEAGUES[e.league]?.sport, L()) })])));
          return card(`${nameOf(r.team)}${r.formation ? ` · ${r.formation}` : ''}`, el('div', {}, [starters.length ? list(starters) : null, subs.length ? el('p', { class: 'mini-h', text: T('bench') }) : null, subs.length ? list(subs) : null]));
        })
    );
  }
  if (view === 'table') {
    const groups = table?.length ? table : [{ name: '', rows: (d?.table || []).map(r => ({ id: r.id, name: r.team, short: r.team, logo: null, stats: r.stats })) }];
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
// while it's open is kept for the next time it's opened.
const HL_NAME = { official: ['官方精華', 'Official highlights'], elta: ['愛爾達精華', 'ELTA highlights'], full: ['全場精華', 'Full-game highlights'], search: ['搜尋精華影片', 'Search for highlights'] };
function highlights(e) {
  if (e?.status?.state !== 'post' || e.status.void) return null;
  const en = L() === 'en';
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
    ['🕒', T('kickoff'), [el('span', { class: 'nb', text: `${dayLabel(localDate(when.getTime()), { long: true })} ${timeText(e)}` }), e.timeTbd && e.timeFrom === 'elta' ? el('small', { class: 'info-sub', text: L() === 'en' ? `ELTA's slot ${clock(e.start)}` : `愛爾達暫排 ${clock(e.start)}` }) : null].filter(Boolean)],
    // The ground, and its city on a line of its own (each said apart: a ground's name never broken by its city's).
    ['📍', T('venue'), d?.venue || e.venue || d?.city ? [d?.venue || e.venue ? zhLater(d?.venue || e.venue) : null, d?.city ? el('small', { class: 'muted venue-city' }, [zhLater(d.city)]) : null].filter(Boolean) : ''],
    exactTv ? null : ['📺', T('tv'), tvOf(e).map(tvName).join('、') || T('noTw')],
    // Each part whole on a line ("2-1 領先" never split; a name never broken).
    stageTag(e, L()) ? ['🏅', T('stage'), joinNodes([stageTag(e, L()), seriesText(e)].filter(Boolean).map(x => el('span', { class: 'nb', text: x })), ' · ')] : null,
    ['🌤', T('weather'), weatherText(d?.weather)],
    ['👥', T('attendance'), d?.attendance ? Number(d.attendance).toLocaleString(L() === 'en' ? 'en-US' : 'zh-TW') : ''],
    ['🧑‍⚖️', T('officials'), joinNodes((d?.officials || []).slice(0, 3).map(x => el('span', { class: 'nb', text: x })), '、')],
    // ESPN's note ("ALWC - Game 1") only where the stage tag doesn't already say it.
    ['🏆', T('competition'), joinNodes([leagueName(e.league, L()), stageTag(e, L()) && L() !== 'en' ? '' : zhLater(e.note)], ' · ')]
  ]
    .filter(Boolean)
    .filter(([, , v]) => v && (!Array.isArray(v) || v.length));
  const leadersBy = sides.map(s => (d?.leaders || []).filter(l => l.team === s.id).slice(0, 4));
  return el('div', { class: 'stack' }, [
    replayLink(e),
    highlights(e),
    // (A guest club from outside the league has no record or place to set beside the other's.)
    e.home.guest || e.away.guest ? null : card(T('matchup'), compare),
    winCard(d, e, line, wait),
    leadersBy.some(x => x.length)
      ? card(
          T('leaders'),
          el(
            'div',
            { class: 'leader-cols' },
            leadersBy.map((list, i) =>
              el('div', {}, [
                el('p', { class: 'mini-h', text: sides[i].short || sides[i].name }),
                ...list.map(l => el('button', { class: 'leader', type: 'button', disabled: l.id ? null : true, onclick: () => l.id && ctx.openPlayer(e.league, l.id, { name: l.full || l.name, logo: l.headshot }) }, [personPic({ ...l, name: l.full || l.name }, e.league, 'sm round'), el('span', { class: 'leader-text' }, [el('small', { text: statName(l.stat, L()) }), el('span', {}, [el('strong', { text: l.name }), el('b', { class: 'num', text: leaderValue(l.value, L()) })])])]))
              ])
            )
          )
        )
      : null,
    d?.series[0]?.h2h?.n ? card(L() === 'en' ? 'Head to head' : '近期交手', h2hView(d.series[0].h2h, e), { sub: L() === 'en' ? `Last ${d.series[0].h2h.n}` : `近 ${d.series[0].h2h.n} 次` }) : d?.series.length && d.series[0].summary ? card(T('series'), el('p', { class: 'series-text', text: seriesZh(d.series[0].summary, e) }), { sub: { season: L() === 'en' ? 'Regular season' : '例行賽', playoff: L() === 'en' ? 'Playoffs' : '季後賽' }[d.series[0].kind] || '' }) : null,
    d?.injuries.some(i => i.list.length)
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
    exactTv ? twCard(e.league, e) : null,
    card(T('matchInfo'), el('ul', { class: 'info-list' }, info.map(([, k, v]) => el('li', {}, [el('span', { class: 'info-k', text: k }), el('span', { class: 'info-v' }, [].concat(v))]))))
  ]);
}

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
function winProbCard(line, e, timeline, events = []) {
  const pts = holdToEnd(line.points, timeline);
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
      el('button', { type: 'button', class: 'wp-mo-go', onclick: () => (show(m.i, m), bringIn(plot)) }, [
        el('span', { class: 'wp-mo-body' }, [el('small', { class: 'wp-mo-at', text: momentAt(m) }), el('span', { class: 'wp-mo-text' }, momentWords(m.text))]),
        gainChip(m)
      ])
    ])
  );
  show();
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
  return card(T('winProb'), box);
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
function boxTable(tb, key, rowOf) {
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
      el('button', { type: 'button', class: 'sort-btn', text: l, onclick: () => {
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
  const pick = ev => {
    const r = plot.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
    let lo = 0;
    let hi = xs.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] <= f) lo = mid;
      else hi = mid;
    }
    show(f - xs[lo] <= xs[hi] - f ? lo : hi);
  };
  let held = false;
  const plot = el(
    'div',
    {
      class: 'wp-plot',
      onpointerdown: ev => {
        held = true;
        plot.setPointerCapture?.(ev.pointerId);
        pick(ev);
      },
      onpointermove: ev => (held || ev.pointerType === 'mouse') && pick(ev),
      onpointerup: () => ((held = false), show()),
      onpointercancel: () => ((held = false), show()),
      onpointerleave: ev => ev.pointerType === 'mouse' && !held && show()
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
  const { main, sub } = playParts(feedText(LEAGUES[league]?.sport, p, L() === 'en', team), team);
  const face = p.pic ? personTap(league, p.pic, personPic(p.pic, league, 'xs round')) : side?.logo ? logo(side.logo, team, 'xs play-team') : null;
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
  if (e?.status?.state !== 'post' || e.status.void || broadcastsOf(e.league)[0]?.svc !== 'elta') return null;
  // Only where there'll likely be one (a season of videos, or its channel in
  // ELTA's list): a row that comes and goes would move the sheet.
  if (!ELTA_VOD[e.league] && e.league !== 'cpbl' && !tvOf(e).some(b => b.exact)) return null;
  const key = `${e.league}:${e.id}:${e.sessionKey || ''}`;
  if (replayKnown.has(key)) {
    const r = replayKnown.get(key);
    return r ? el('div', { class: 'replay-group' }, replayRows(e, r)) : null;
  }
  const en = L() === 'en';
  const logo = eltaLogo();
  const out = el('div', { class: 'replay-group' }, [
    el('div', { class: 'replay-link wait' }, [logo, el('span', { class: 'yt-text' }, [el('strong', { text: en ? 'Full game replay' : '全場重播' }), el('small', { class: 'one-line', text: en ? 'Finding it on ELTA.tv…' : '在愛爾達找這場…' })]), el('span', { class: 'replay-go', style: 'visibility:hidden', 'aria-hidden': 'true', text: en ? 'Watch' : '觀看' })])
  ]);
  replayOf(e)
    .then(r => {
      replayKnown.set(key, r);
      if (!r) return out.remove();
      put(out, ...replayRows(e, r, logo));
    })
    .catch(() => out.remove());
  return out;
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
                      // Its commentary and ads, then when it starts; a game NBA.com
                      // names without its channel: ELTA's schedule says which.
                      el('small', { text: b.ch ? [[audioName(b), b.adFree ? (L() === 'en' ? 'no ads' : '無廣告') : ''].filter(Boolean).join(L() === 'en' ? ', ' : '・'), b.at ? `${clock(new Date(b.at).toISOString())} ${L() === 'en' ? 'on air' : '開播'}` : ''].filter(Boolean).join(' · ') : b.svc === 'appletv' ? (L() === 'en' ? 'Every game' : '每場都有') : b.every ? (L() === 'en' ? "Every session; channel in ELTA's schedule" : '每節都轉播・頻道見愛爾達節目表') : L() === 'en' ? "This game (NBA.com); channel in ELTA's schedule" : '這場有轉播（NBA.com）・頻道見愛爾達節目表' })
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
  // A session on: the order again every 30 seconds.
  const timer = setInterval(async () => {
    if (!s.dialog.isConnected) return clearInterval(timer);
    if (document.visibilityState !== 'visible' || e.status.state !== 'in') return;
    const fresh = (await scoreboard(e.league).catch(() => [])).find(x => x.id === (e.weekend || e.id));
    if (!fresh) return;
    const now = Date.now();
    const again = e.sessionKey ? splitWeekend(fresh, now, L()).find(x => x.sessionKey === e.sessionKey) : fresh.sessions ? settleField(fresh, now) : fresh;
    if (!again) return;
    // Drawn again only when a session starts or ends: the live board keeps itself current.
    const states = x => (x.sessions || []).map(y => y.status.state).join();
    if (states(again) === states(e) && again.status.state === e.status.state) return;
    e = again;
    const top = s.body.scrollTop;
    s.body.replaceChildren();
    fillField(s, e);
    s.body.scrollTop = top;
  }, 30_000);
  s.dialog.addEventListener('close', () => clearInterval(timer));
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
function f1Row({ pos, posText = '', posOut = false, full, family, team, field, main = '', tags = [], cls = '' }) {
  const en = L() === 'en';
  const c = fieldDriver(field, full, family) || { name: full };
  const who = { ...c, name: en ? c.name : f1Driver(full).zh || c.name };
  const car = f1Constructor(team || f1Driver(full).team);
  return el('li', { class: `${ctx.isFollowed('f1', c.id) ? 'mine' : ''}${cls ? ` ${cls}` : ''}`.trim() }, [
    el('span', { class: `pos num${posOut ? ' out' : ''}`, text: posText || String(pos) }),
    personPic(c, 'f1', 'sm round'),
    el('span', { class: 'f1-who' }, [
      personName('f1', who),
      el('button', { class: 'link f1-team', type: 'button', onclick: () => openConstructor({ id: '', name: car.name, en: car.name }) }, [constructorBadge(car.name, 'xxs'), el('span', { text: en ? car.name : car.zh })])
    ]),
    el('span', { class: 'f1-res' }, [el('span', { class: 'num f1-main', text: main }), tags.some(Boolean) ? el('span', { class: 'f1-tags' }, tags) : null])
  ]);
}
function f1Field(rows, field) {
  const en = L() === 'en';
  return el(
    'ol',
    { class: 'field f1-field' },
    rows.map(r => {
      const gained = r.grid && !r.out ? r.grid - r.pos : 0;
      return f1Row({
        pos: r.pos,
        posText: r.out ? r.text : '',
        posOut: r.out,
        full: `${r.driver.givenName} ${r.driver.familyName}`,
        family: r.driver.familyName,
        team: r.team,
        field,
        main: r.out ? r.why : r.time || (r.status === 'Lapped' ? (en ? 'Lapped' : '被套圈') : ''),
        tags: [
          r.gap ? el('small', { class: 'num', text: r.gap }) : null,
          r.outIn ? el('small', { class: 'q-out', title: en ? `Out in ${r.outIn}` : `${r.outIn} 淘汰`, text: r.outIn }) : null,
          // Each its own chip under the time (it read as one string of numbers):
          // places from the grid, the fastest lap, the points as points.
          gained ? el('small', { class: `num gain ${gained > 0 ? 'up' : 'down'}`, title: en ? `From P${r.grid}` : `起跑第 ${r.grid}`, text: `${gained > 0 ? '▲' : '▼'}${Math.abs(gained)}` }) : null,
          r.fastest ? el('small', { class: 'fl', title: en ? 'Fastest lap' : '最快圈', text: en ? 'FL' : '最快圈' }) : null,
          r.points ? el('small', { class: 'num pts', text: en ? `${r.points} pts` : `${r.points} 分` }) : null
        ]
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
function f1LiveBoard(b, ss) {
  const en = L() === 'en';
  const quali = /^(Qual|SS|SQ)$/.test(ss.abbr);
  const race = ss.abbr === 'Race' || ss.abbr === 'SR';
  const prefix = ss.abbr === 'Qual' ? 'Q' : 'SQ';
  const cut = quali ? qualiCut(b.part, b.entries) : 0;
  const flag = TRACK[b.track.status];
  // The time left, counting down between reads.
  const left = el('span', { class: 'num lb-clock' });
  const tickClock = () => {
    const n = Math.max(0, b.clock.left - (b.clock.running ? (Date.now() - b.at) / 1000 : 0));
    left.textContent = race && b.lap ? '' : `${en ? '' : '剩 '}${mmss(n)}${en ? ' left' : ''}`;
  };
  tickClock();
  const clockTimer = setInterval(() => (left.isConnected ? tickClock() : clearInterval(clockTimer)), 1000);
  const head = el('div', { class: 'lb-head' }, [
    el('strong', { class: 'lb-part', text: quali && b.part ? `${prefix}${b.part}` : race && b.lap?.now ? (en ? `Lap ${b.lap.now}/${b.lap.of}` : `第 ${b.lap.now}/${b.lap.of} 圈`) : sessionName(ss, L(), true) }),
    left,
    flag ? el('span', { class: `lb-flag ${flag[2]}`, text: en ? flag[1] : flag[0] }) : null
  ]);
  const rows = b.cars.flatMap((c, i) => {
    const tyre = TYRE[c.tyre];
    const state = c.retired || c.stopped ? (en ? 'Out' : '退賽') : c.out ? (en ? 'Out' : '淘汰') : c.inPit ? (en ? 'Pit' : '進站') : c.pitOut ? (en ? 'Out lap' : '出站') : '';
    const row = f1Row({
      pos: c.pos,
      full: c.name,
      family: c.name.split(' ').slice(1).join(' ') || c.name,
      team: c.team,
      field: ss.field,
      cls: `${cut && c.pos > cut && !c.out ? 'drop' : ''}${c.out || c.retired ? ' gone' : ''}`.trim(),
      // Qualifying: the best lap of this part, the gap to the top under it; a race: the gap, the car ahead's interval under it.
      main: quali ? c.best : i === 0 ? (en ? 'Leader' : '領先') : c.gap,
      tags: [
        state ? el('small', { class: `lb-state${c.inPit || c.pitOut ? ' pit' : ''}`, text: state }) : null,
        tyreIcon(c.tyre),
        tyre && c.tyreLaps ? el('small', { class: 'num', text: `${c.tyreLaps}${en ? 'L' : '圈'}` }) : null,
        quali ? (i > 0 && c.gap ? el('small', { class: 'num', text: c.gap }) : null) : i > 0 && c.interval ? el('small', { class: 'num', text: `${en ? 'int ' : '前車 '}${c.interval}` }) : null
      ]
    });
    return cut && c.pos === cut ? [row, el('li', { class: 'lb-cut', 'aria-hidden': 'true' }, [el('span', { text: en ? `Out after ${prefix}${b.part}` : `${prefix}${b.part} 淘汰線` })])] : [row];
  });
  const msg = b.message?.text ? el('p', { class: 'lb-msg' }, [el('small', { text: en ? 'Race control' : '賽事幹事' }), document.createTextNode(b.message.text)]) : null;
  return el('div', { class: 'live-board' }, [head, msg, el('ol', { class: 'field f1-field lb-rows' }, rows)]);
}
function fillField(s, e) {
  s.body.append(el('div', { class: 'q-card pad fx-card' }, [el('div', { class: 'sess-head field-title' }, [raceFlag(e, 'big'), sessionTag(e), el('h3', { text: e.name })]), // The place, then the day and the official start: two designed lines (the
      // titles' time isn't said: the broadcast card says when the channel's on air).
      el('p', { class: 'muted sess-where', text: e.venue || '' }),
      el('p', { class: 'muted sess-when', text: whenText(shownStart(e)) }), weekendFollow(e), watchButton(e, 'wide')]));
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
    const sessions = [...e.sessions].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    // A session on: its live board first, the weekend's schedule after it.
    const liveNow = sessions.some(x => x.status.state === 'in');
    // The weekend's schedule under the session's results (not a long list on top of them).
    const schedule = sessions.length > 1 ? card(T('schedule'), weekendTimeline(sessions)) : null;
    let pick = e.sessionKey ? Math.max(0, sessions.findIndex(x => x.abbr === e.sessionKey)) : Math.max(0, sessions.findLastIndex(x => x.status.state !== 'pre'));
    const box = el('div');
    let liveTimer = 0;
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
      const numbers =
        f1Numbers.has(key) || e.league !== 'f1' || ss.status.state !== 'post'
          ? null
          : ss.abbr === 'Race' || ss.abbr === 'SR'
            ? raceResult(ss.start, ss.abbr === 'SR', L() === 'en')
            : ss.abbr === 'Qual'
              ? qualifyingResult(ss.start).then(rows => (rows.length ? rows : espnQualifying(weekend, ss.id, ss.field)))
              : ss.abbr === 'SS' || ss.abbr === 'SQ'
                ? espnQualifying(weekend, ss.id, ss.field, 'SQ')
                : null;
      const espnList = () => (ss.field.length ? el('ol', { class: 'field' }, ss.field.map((c, i) => el('li', { class: ctx.isFollowed(e.league, c.id) ? 'mine' : '' }, [el('span', { class: 'pos num', text: String(i + 1) }), personPic(c, e.league, 'sm round'), personName(e.league, c), c.score ? el('small', { class: 'num', text: c.score }) : null]))) : empty(T('noField')));
      const known = f1Numbers.get(key);
      const shape = () => el('ol', { class: 'field f1-field waiting' }, Array.from({ length: Math.max(1, Math.min(ss.field.length || 10, 22)) }, () => el('li', { class: 'skel-row' }, [skeleton([70], 'skel-pos'), el('i', { class: 'skel skel-pic' }), skeleton([62, 40]), skeleton([90, 50], 'skel-right')])));
      put(
        box,
        sessions.length > 1 ? segmented(sessions.map((x, i) => [String(i), sessionName(x, L(), true)]), String(pick), v => ((pick = Number(v)), paint())) : null,
        el('p', { class: 'muted small', text: `${sessionName(ss, L())} · ${statusText({ ...e, start: ss.start, status: ss.status })}` }),
        // The picked session's whole replay and highlights, once it's over.
        ...(() => {
          const one = { ...e, id: `${weekend}~${ss.abbr}`, weekend, sessionKey: ss.abbr, session: sessionName(ss, L()), start: ss.start, official: ss.start, status: ss.status };
          return ss.status.state === 'post' ? [replayLink(one), highlights(one)].filter(Boolean) : [];
        })(),
        known?.length ? f1Field(known, ss.field) : numbers ? shape() : espnList(),
        raceBox
      );
      loadRace();
      numbers
        ?.catch(() => [])
        .then(rows => {
          if (rows.length) f1Numbers.set(key, rows);
          if (at !== pick || !box.isConnected) return;
          const waiting = box.querySelector('ol.field.waiting');
          if (!waiting) return;
          const done = rows.length ? f1Field(rows, ss.field) : espnList();
          done.classList.add('fade-in');
          waiting.replaceWith(done);
        });
      // F1, a session on now: F1's own live timing, again every 5 seconds in place.
      clearInterval(liveTimer);
      if (e.league === 'f1' && ss.status.state === 'in') {
        // The last reading at once if there is one, else the board's shape;
        // ESPN's order comes back only if F1's feed can't be read.
        const espnOrder = box.querySelector('ol.field, .empty');
        const kept = keptTiming(ss.abbr, ss.start);
        const shape = () => el('div', { class: 'live-board' }, [skeleton([22, 30], 'lb-head-skel'), el('ol', { class: 'field f1-field lb-rows' }, Array.from({ length: 10 }, () => el('li', { class: 'skel-row' }, [skeleton([70], 'skel-pos'), el('i', { class: 'skel skel-pic' }), skeleton([62, 40]), skeleton([90, 50], 'skel-right')])))]);
        espnOrder?.replaceWith(kept ? f1LiveBoard(kept, ss) : shape());
        if (!kept) box.querySelector('.live-board')?.classList.add('waiting');
        const tick = () => {
          if (!box.isConnected || at !== pick) return clearInterval(liveTimer);
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
        liveTimer = setInterval(tick, 5_000);
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
    const [info, all, groups, teamNews = [], home] = espn
      ? await Promise.all([team(league, id), teamSchedule(league, id).catch(() => []), hasStandings(league) ? standings(league).catch(() => null) : null, news(league, { team: id }).catch(() => []), homeLeague(league, id).catch(() => null)])
      : await ownTeam(league, id, fallback);
    const outside = Boolean(home && !home.key && home.name);
    // Only the competitions Orbit Sports has: a friendly or another country's
    // cup has nothing of its own here (its table, its names, its page).
    const sched = all.filter(x => !x.other && LEAGUES[x.league]);
    // 最新動態: a recent story about the club itself (storyAboutTeam), not its games.
    const stories = newsAbout([teamNews], { team: id }).filter(st => storyAboutTeam(st, { en: info.en || info.name, enShort: info.enShort, sport: LEAGUES[league]?.sport }));
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
      latestSlot(league, 'team', id, { name: info.en || info.name, zh: info.name, facts: [`${info.name}（${info.en || info.name}），${leagueName(league, L())}`], people: () => roster(league, id, info.home).catch(() => []) }, freshNews(stories, league)),
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
// For an F1 card's facts: the last race run and the next, with their days (a
// grid penalty is news only until its race is run).
function f1RaceFacts(races) {
  const raceOf = e => (e.sessions || []).find(x => x.abbr === 'Race') || e;
  const day = e => localDate(Date.parse(raceOf(e).start)).slice(5).replace('-', '/');
  const done = (races || []).filter(e => raceOf(e).status?.state === 'post');
  const last = done.at(-1);
  const next = (races || []).find(e => raceOf(e).status?.state !== 'post' && !done.includes(e));
  return [last ? `上一站：${last.name}，正賽 ${day(last)} 已賽完` : '', next ? `下一站：${next.name}，正賽 ${day(next)}` : ''].filter(Boolean).join('；');
}
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
// The latest word on a player (RotoWire's note): the headline, then the
// story as a few short points (a sentence each, translated one by one), the
// first two shown and the rest behind 更多.
function noteBody(note) {
  const points = String(note.story || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z"'(])/)
    .map(x => x.trim())
    .filter(x => x.length > 2);
  const item = x => el('li', {}, [zhLater(x)]);
  const list = el('ul', { class: 'note-points' }, points.slice(0, 2).map(item));
  const more = points.length > 2 ? el('button', { class: 'link note-more', type: 'button', text: L() === 'en' ? 'More' : '更多', onclick: () => (list.append(...points.slice(2).map(item)), more.remove()) }) : null;
  return el('div', { class: 'player-note' }, [el('strong', { class: 'note-head' }, [zhLater(note.headline)]), points.length ? list : null, more]);
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
export async function openPlayer(league, id, fallback = {}) {
  if (!id) return;
  const s = sheet(leagueName(league, L()), { league });
  const content = el('div', {}, [spinner()]);
  s.body.append(content);
  try {
    const sport = LEAGUES[league]?.sport;
    // This season, from the league's own tables and results (ESPN's player
    // card has little for drivers): the championship and each race.
    const [a, ov, table, races, official, leagueNews, clubNews] = await Promise.all([
      athlete(league, id),
      athleteOverview(league, id).catch(() => null),
      sport === 'racing' && LEAGUES[league].standings ? standings(league).catch(() => null) : null,
      sport === 'racing' ? seasonEvents(league).catch(() => []) : null,
      // F1: formula1.com's figures and each weekend's grid, finish and sprint.
      league === 'f1' ? athlete(league, id).then(x => f1Official('drivers', { page: f1Driver(x.name).page, name: x.name })).catch(() => null) : null,
      // Their news: the league's stories and their team's, those naming them.
      news(league).catch(() => []),
      individual(league) ? [] : athlete(league, id).then(x => (x.teamId ? news(league, { team: x.teamId }) : [])).catch(() => [])
    ]);
    // Only stories about them (their name in the headline), for 最新動態.
    const stories = newsAbout([leagueNews, clubNews], { athletes: [id] }).filter(st => storyAbout(st, a.name));
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
    const logCard = log
      ? card(
          // Last season's (ESPN's until a player's first game of the new one: April's in October), said to be.
          Date.now() - (Date.parse(log.games[0]?.date || '') || Date.now()) > 45 * 86_400_000 ? W(`上季最後 ${log.games.length} 場`, `Last season's last ${log.games.length}`) : W(`近 ${log.games.length} 場`, `Last ${log.games.length} games`),
          el('div', { class: 'table-wrap' }, [
            el('table', { class: 'data game-log' }, [
              el('thead', {}, [el('tr', {}, [el('th', { class: 'left', text: W('日期', 'Date') }), el('th', { class: 'left', text: W('對手', 'Opp') }), el('th', { class: 'left', text: W('結果', 'Result') }), ...log.labels.map(k => el('th', { class: 'num', title: k, text: sport === 'basketball' && k === 'PTS' && !en ? '得分' : statName(k, L()) }))])]),
              el(
                'tbody',
                {},
                log.games.map(g =>
                  el('tr', opensMatch(g) ? { class: 'log-tap', onclick: () => ctx.openEvent(matchOf(g)) } : {}, [
                    el('td', { class: 'left num', text: g.date ? localDate(Date.parse(g.date)).slice(5).replace('-', '/') : '' }),
                    el('td', { class: 'left' }, [
                      el('span', { class: 'opp-cell' }, [el('span', { class: 'muted opp-at', text: g.at === '@' ? '@' : 'vs' }), logo(g.opp.logo, g.opp.name, 'xs'), el('span', { class: 'opp-name', text: g.opp.abbr || g.opp.name })]),
                      !oneComp && (g.league || g.leagueName) ? el('small', { class: 'log-comp' }, [compOf(g)]) : null
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
        )
      : null;
    // The latest word on them (an injury, a lineup), in their language.
    // ESPN's note only while it's recent (two weeks): an August note in October isn't 最新.
    const noteCard = ov?.note && Date.now() - Date.parse(ov.note.date || 0) < 14 * 86_400_000
      ? card(W('最新動態', 'Latest'), noteBody(ov.note), { sub: ov.note.date ? dayLabel(localDate(Date.parse(ov.note.date))) : '' })
      : null;
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
      ? el('div', { class: 'team-strip' }, keyNums.map(x => el('div', { class: 'ts-cell' }, [el('strong', { class: 'num', text: x.value }), el('small', { text: statName(x.label, L()) })])))
      : null;
    // Tabs: 概況 (the latest, this season), 數據 (the numbers), 近期比賽 (the
    // game log), 資料 (profile, honours); only those with something in them.
    const keep = list => list.filter(Boolean);
    const racing = sport === 'racing';
    // For 最新動態: who they are, and what people wrote on them lately (ESPN's
    // injury report within a month, RotoWire's note within two weeks).
    const injury = a.injury;
    const latestFor = {
      team: a.teamId,
      name: a.name,
      zh: '',
      // Who its card can name: them, and their teammates.
      people: () => (a.teamId && league !== 'f1' ? roster(league, a.teamId).catch(() => []) : Promise.resolve([])).then(list => [{ id, name: a.name, headshot: a.headshot, self: true }, ...list]),
      facts: [`${name === a.name ? name : `${name}（${a.name}）`}：${[leagueName(league, L()), driver?.team ? f1Constructor(driver.team).zh : a.team, a.position].filter(Boolean).join('・')}`, league === 'f1' ? f1RaceFacts(races) : ''].filter(Boolean),
      report: [
        injury && Date.now() - Date.parse(injury.date || 0) < 30 * 86_400_000 ? `傷病（ESPN ${String(injury.date).slice(0, 10)}）：${[injury.status, injury.what].filter(Boolean).join('，')}${injury.back ? `，預計 ${localDate(Date.parse(injury.back))} 回歸` : ''}。${injury.comment}` : '',
        ov?.note && Date.now() - Date.parse(ov.note.date || 0) < 14 * 86_400_000 ? `RotoWire（${String(ov.note.date || '').slice(0, 10)}）：${ov.note.headline} ${String(ov.note.story || '').slice(0, 300)}` : ''
      ].filter(Boolean)
    };
    const overview = keep([
      // 最新動態: their real news, if any (Gemini); in English or without it, ESPN's note or story.
      latestSlot(league, 'player', id, latestFor, noteCard && !(stories[0] && Date.parse(ov.note.date || 0) < stories[0].at) ? noteCard : freshNews(stories, league) || noteCard),
      og.season
        ? card(W(`${year} 賽季`, `${year} season`), el('div', { class: 'stat-grid' }, [...og.season.map(([k, v]) => f1Tile(k, v, en)), champ?.pos > 1 && champ.gap ? tile(W('落後領先者', 'Behind the leader'), champ.gap) : null].filter(Boolean)))
        : null,
      !og.season && champ
        ? card(
            W(`${year} 車手積分榜`, `${year} drivers' championship`),
            el('div', { class: 'stat-grid' }, [tile(W('排名', 'Place'), T('placeN', { n: champ.pos }), W(`共 ${champ.of} 位`, `of ${champ.of}`)), tile(W('積分', 'Points'), champ.points), champ.pos > 1 && champ.gap ? tile(W('落後領先者', 'Behind the leader'), champ.gap) : null, tile(W('完成站數', 'Races'), String(champ.races.length))].filter(Boolean))
          )
        : null,
      nextRace ? nextRaceCard(nextRace, en) : null,
      mateCard,
      !racing && a.stats.list.length ? card(seasonTitle(a.stats.title), el('div', { class: 'stat-grid' }, a.stats.list.map(x => tile(statName(x.label, L()), x.value, x.rank)))) : null
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
                    el('thead', {}, [el('tr', {}, [el('th', { class: 'left' }), ...ov.season.rows[0].cells.map(c => el('th', { class: 'num', title: c.label, text: statName(c.label, L()) }))])]),
                    el('tbody', {}, ov.season.rows.map(r => el('tr', {}, [el('th', { class: 'left split-name' }, [splitName(r.name, ov.season.rows, en) || zhLater(r.name)]), ...r.cells.map(c => el('td', { class: 'num', text: c.value }))])))
                  ])
                ])
              : el('div', { class: 'stat-grid dense' }, ov.season.rows[0].cells.map(c => tile(statName(c.label, L()), c.value)))
          )
        : null,
      ov?.rankings?.length ? card(T('rankings'), el('div', { class: 'stat-grid' }, ov.rankings.map(x => tile(statName(x.label, L()), x.value, x.rank)))) : null,
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
    const views = [['overview', W('概況', 'Overview'), overview], ['numbers', W('數據', 'Stats'), numbers], ['games', racing ? W('各站成績', 'Races') : W('近期比賽', 'Games'), games], ['bio', W('資料', 'Bio'), bio]].filter(v => v[2].length);
    let view = views[0]?.[0];
    const tabsBox = el('div');
    const tabBody = el('div', { class: 'team-tab' });
    const paintTab = () => {
      put(tabsBox, views.length > 1 ? segmented(views.map(([k, label]) => [k, label]), view, v => ((view = v), paintTab())) : null);
      put(tabBody, ...(views.find(v => v[0] === view)?.[2] || []));
    };
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
    const [table, races, official, f1News] = await Promise.all([standings(league).catch(() => null), seasonEvents(league).catch(() => []), f1Official('constructors', { page: c.page, name: c.name }).catch(() => null), news(league).catch(() => [])]);
    const og = official?.grids || {};
    const jw = (official?.weekends || []).map(w => ({ ...w, e: eventOfRace(races, w.date) }));
    const groups = table || [];
    const teams = groups.find(g => g.rows.some(r => !r.athlete))?.rows || [];
    const at = teams.findIndex(r => r.id === row.id || f1Constructor(r.en || r.name).name === c.name);
    const me = teams[at] || row;
    const drivers = (groups.find(g => g.rows.some(r => r.athlete))?.rows || []).map((r, i) => ({ ...r, pos: i + 1 })).filter(r => f1Driver(r.en || r.name).team === c.name);
    const ids = new Set(drivers.map(d => d.id));
    // 最新動態: a recent story about the team itself (its name in the headline), not a race weekend's piece.
    const f1Team = Object.values(F1_TEAMS).find(t => t.name === c.name);
    const teamStories = newsAbout([f1News], { named: n => f1Constructor(n).name === c.name }).filter(st => storyAboutTeam(st, { en: c.name, aka: f1Team?.aka || [] }));
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
        tile(W('頒獎台', 'Podiums'), String(podiums), doubles ? W(`雙登台 ${doubles}`, `${doubles} double`) : '')
      ]),
      latestSlot(league, 'team', c.name.replace(/[^A-Za-z0-9]+/g, '-'), { name: c.name, zh: c.zh, facts: [`${c.zh}（${c.name}），F1 車隊；車手：${drivers.map(d => f1Driver(d.en || d.name).zh).join('、')}`, f1RaceFacts(races)].filter(Boolean) }, freshNews(teamStories, league)),
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
            )
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
      lines.push(line('clock', W(`${b(nm(t.leader))} ${at}${what}`, `${b(nm(t.leader))} can ${what}, ${at}`), t.gap > 0 ? W(`領先 ${t.gap} 分・還有 ${t.avail} 分可拿`, `${t.gap} pts ahead, ${t.avail} still to win`) : W(`與第二名同分・還有 ${t.avail} 分可拿`, `level on points, ${t.avail} still to win`)));
    }
  } else if (t.soonest != null) {
    const second = g.rows[1];
    const gap = second ? (race.unit === 'wins' ? Number(second.stats.GB) : Number(t.leader.stats[sport === 'racing' ? 'PTS' : 'P']) - Number(second.stats[sport === 'racing' ? 'PTS' : 'P'])) : 0;
    lines.push(line('clock', W(`${many ? top : '冠軍'}${when}才會確定`, `${many ? top : 'The title'}: ${when}`), gap > 0 ? W(`${nm(t.leader)} 領先 ${gap}${unit}`, `${nm(t.leader)} lead by ${gap}`) : ''));
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
