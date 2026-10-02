// Quadra Fixtures' sheets: a match (header, then its data by section), a
// race weekend, a team, a player, and the
// standings tables they share with the Standings tab.
import { translate } from './lib/quadra.mjs';
import { scoreboard, splitWeekend, settleField, summary, standings, team, teamSchedule, roster, athlete, athleteOverview, STANDING_COLUMNS, COMPACT_COLUMNS, sessionName, seasonEvents, driverSeason } from './lib/espn.mjs';
import { stageTag } from './lib/stage.mjs';
import { statName, statsTitle, metric, fixedWord, dateText, injuryZh, seriesLineZh, weatherZh, pitchZh, posZh, standingZh, leaderValue, teamStatRows } from './lib/statnames.mjs';
import { f1Driver, f1Constructor, countryName, logoPicture } from './lib/logos.mjs';
import { f1Official, f1Label, f1Value, finishOf, eventOfRace, raceResult } from './lib/f1.mjs';
import { tvOf } from './lib/tv.mjs';
import { broadcastsOf, CHECKED } from './lib/broadcast.mjs';
import { LEAGUES, leagueName, hasTeamPage, hasStandings } from './lib/leagues.mjs';
import { teamKey, leagueKey } from './lib/foryou.mjs';
import { ctx, el, put, spinner, empty, logo, diamond, clock, dayLabel, localDate, statusText, whenText, eventRow, sheet, segmented, seriesText, tvName, watchLink, watchButton, audioName, sessionTag, raceFlag, personPic, sideLogo } from './ui.js';

const L = () => ctx.locale;
const T = (k, v) => ctx.t(k, v);
// ESPN's English words ("Right Fielder", "Hasselt, Belgium"), in Chinese once
// translated (a text node that changes when the translation comes; kept 30
// days per line). Empty stays empty.
export function zhLater(text) {
  if (!text) return '';
  if (L() === 'en' || !/[A-Za-z]/.test(text)) return text;
  const fixed = fixedWord(text, L());
  if (fixed) return fixed;
  const node = document.createTextNode(text);
  translate(text).then(zh => zh && (node.textContent = zh)).catch(() => {});
  return node;
}
const injuryText = s => (L() === 'en' ? s : injuryZh(s) || zhLater(s));
const weatherText = w => weatherZh(w, L());
// The last meetings: each side's wins and the draws ("近 5 次交手：利物浦 4 勝、伯恩茅斯 1 勝").
function h2hText({ n, wins, draws }, e) {
  const side = x => (L() === 'en' ? `${x.short || x.name} ${wins[x.id] || 0} won` : `${x.short || x.name} ${wins[x.id] || 0} 勝`);
  const parts = [side(e.away), side(e.home), draws ? (L() === 'en' ? `${draws} drawn` : `和局 ${draws}`) : null].filter(Boolean);
  return `${L() === 'en' ? `Last ${n} meetings: ` : `近 ${n} 次交手：`}${parts.join(L() === 'en' ? ', ' : '、')}`;
}
// A series' line in the reader's words (the sides by their names here).
export function seriesZh(text, e) {
  if (L() === 'en') return text;
  const name = abbr => [e.home, e.away].find(s => s?.abbr && s.abbr.toUpperCase() === String(abbr).toUpperCase())?.short || abbr;
  return seriesLineZh(text, name) || text;
}
// Strings and nodes joined by a separator, as nodes.
const joinNodes = (items, sep) => items.filter(Boolean).flatMap((x, i) => (i ? [sep, x] : [x])).map(x => (typeof x === 'string' ? document.createTextNode(x) : x));

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
  const paintHeader = sm => {
    const home = sm?.home || e.home;
    const away = sm?.away || e.away;
    const st = sm?.status || e.status;
    const side = (x, raw) =>
      el('div', { class: 'mh-side' }, [
        el('button', { class: 'mh-team', type: 'button', disabled: !hasTeamPage(e.league) ? true : null, onclick: () => ctx.openTeam(e.league, x.id, x) }, [sideLogo({ ...raw, ...x, logo: x.logo || raw.logo }, e.league, 'lg'), el('strong', { text: raw.short || x.short || x.name })]),
        x.record || raw.record ? el('small', { text: x.record || raw.record }) : null,
        hasTeamPage(e.league) ? followChip(e.league, x, () => paintHeader(sm)) : null
      ]);
    put(
      header,
      el('div', { class: 'mh-row' }, [
        side(away, e.away),
        el('div', { class: 'mh-mid' }, [
          st.state === 'pre' ? el('strong', { class: 'mh-time', text: clock(e.start) }) : el('strong', { class: 'mh-score num', text: `${away.score ?? ''} - ${home.score ?? ''}` }),
          el('span', { class: `mh-status ${st.state}`, text: st.state === 'pre' ? dayLabel(localDate(Date.parse(e.start))) : statusText({ ...e, status: st }) })
        ]),
        side(home, e.home)
      ]),
      stageTag(e, L()) || seriesText(e) ? el('div', { class: 'mh-stage' }, [stageTag(e, L()) ? el('span', { class: 'stage-tag', text: stageTag(e, L()) }) : null, seriesText(e) ? el('small', { text: seriesText(e) }) : null]) : null,
      // On now or about to start: one tap to watch it, at the top.
      watchButton({ ...e, status: st }, 'wide'),
      linescore(sm, e),
      livePanel(e)
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
      paintHeader(data);
      paint();
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
  const paint = () => {
    const tabs = [['overview', T('overview')]];
    if (teamStatRows(data?.teamStats, LEAGUES[e.league]?.sport, L()).length) tabs.push(['stats', T('stats')]);
    if (data?.players.some(p => p.tables.some(tb => tb.rows.length))) tabs.push(['players', T('players')]);
    if (data?.plays.length || data?.keyEvents.length) tabs.push(['plays', T('plays')]);
    if (data?.rosters.some(r => r.players.length)) tabs.push(['lineups', T('lineups')]);
    if (table?.length || data?.table.length) tabs.push(['table', T('table')]);
    put(sections, tabs.length > 1 ? segmented(tabs, view, v => ((view = v), paint())) : null);
    put(content, matchSection(view, data, e, table));
  };
  // The league's table: both sides' places, and the Table section.
  if (hasStandings(e.league))
    standings(e.league)
      .then(groups => {
        table = groups;
        paint();
      })
      .catch(() => {});
  if (!LEAGUES[e.league].espn) {
    paint();
    return;
  }
  try {
    data = await summary(e.league, e.id);
    paintHeader(data);
    paint();
  } catch {
    paint();
  }
}

// The situation of a game on now, by sport: the bases, count and outs, and
// who bats against whom; the goals and red cards by minute; and the last play.
function livePanel(e) {
  const lv = e.live;
  if (e.status.state !== 'in' || !lv) return null;
  const sport = LEAGUES[e.league]?.sport;
  const en = L() === 'en';
  const rows = [];
  if (sport === 'baseball' && lv.bases) {
    rows.push(
      el('div', { class: 'lp-baseball' }, [
        diamond(lv.bases, null, true),
        el('div', { class: 'lp-count' }, [
          el('span', {}, [el('small', { text: 'B' }), dots(lv.balls, 4, 'ball')]),
          el('span', {}, [el('small', { text: 'S' }), dots(lv.strikes, 3, 'strike')]),
          el('span', {}, [el('small', { text: 'O' }), dots(lv.outs, 3, 'out')])
        ]),
        el('div', { class: 'lp-who' }, [lv.batter ? el('p', {}, [el('small', { text: T('batter') }), el('strong', { text: lv.batter })]) : null, lv.pitcher ? el('p', {}, [el('small', { text: T('pitcher') }), el('strong', { text: lv.pitcher })]) : null])
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

function followChip(league, side, after) {
  const on = ctx.isFollowed(league, side.id);
  return el('button', {
    class: `q-chip small${on ? ' on' : ''}`,
    type: 'button',
    text: on ? T('following') : `+ ${T('follow')}`,
    onclick: () => {
      ctx.toggleFollow(league, side);
      after();
    }
  });
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

const card = (title, body, { sub = '' } = {}) => el('div', { class: 'q-card pad fx-card' }, [el('div', { class: 'card-h row' }, [el('span', { text: title }), sub ? el('small', { text: sub }) : null]), body]);

// A side's row in the league's table: [place, row, group size].
function placeOf(groups, id) {
  for (const g of groups || []) {
    const i = g.rows.findIndex(r => r.id === id);
    if (i >= 0) return { pos: i + 1, row: g.rows[i], n: g.rows.length, group: g.name, lead: g.rows[0] };
  }
  return null;
}

function matchSection(view, d, e, table) {
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
              `${nameOf(p.team)} · ${tb.name}`,
              el('div', { class: 'table-wrap' }, [
                el('table', { class: 'data' }, [
                  el('thead', {}, [el('tr', {}, [el('th', { class: 'left' }), ...tb.labels.map(l => el('th', { text: l }))])]),
                  el(
                    'tbody',
                    {},
                    tb.rows.map(r =>
                      el('tr', {}, [
                        el('th', { class: 'left' }, [el('button', { class: 'link', type: 'button', text: r.name, onclick: () => ctx.openPlayer(e.league, r.id) }), r.pos ? el('small', { text: ` ${r.pos}` }) : null]),
                        ...r.stats.map(v => el('td', { class: 'num', text: v }))
                      ])
                    )
                  )
                ])
              ])
            )
          )
      )
    );
  }
  if (view === 'plays' && d) {
    const list = d.keyEvents.length ? d.keyEvents : d.plays;
    return el(
      'ol',
      { class: 'plays' },
      list
        .slice()
        .reverse()
        .map(p =>
          el('li', { class: p.scoring ? 'scoring' : '' }, [
            el('span', { class: 'play-when', text: [p.period, p.clock].filter(Boolean).join(' ') }),
            el('span', { class: 'play-text' }, [p.team && nameOf(p.team) ? el('b', { text: `${nameOf(p.team)} ` }) : null, document.createTextNode(p.text)]),
            p.home != null && p.away != null ? el('strong', { class: 'num', text: `${p.away}-${p.home}` }) : null
          ])
        )
    );
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
  return overview(d, e, table, nameOf);
}

// An ended game's highlights: YouTube's search for them (the league's own
// channel's video comes first), opened in YouTube (its app on a phone).
export function highlightsUrl(e) {
  if (e?.status?.state !== 'post' || e.status.void) return null;
  const d = new Date(e.start);
  const day = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
  const nm = x => x?.en || x?.name || '';
  const lg = LEAGUES[e.league]?.en || '';
  const q = e.kind === 'match' ? `${nm(e.away)} vs ${nm(e.home)} ${lg} highlights ${day}` : `${e.enName || e.name} ${e.sessionKey ? SESSION_EN[e.sessionKey] || '' : ''} ${lg} highlights ${d.getFullYear()}`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q.replace(/\s+/g, ' ').trim())}`;
}
const SESSION_EN = { Race: 'race', Qual: 'qualifying', SR: 'sprint', SS: 'sprint qualifying', SQ: 'sprint qualifying' };
function highlights(e) {
  const url = highlightsUrl(e);
  return url
    ? el('a', { class: 'yt-link', href: url, target: '_blank', rel: 'noopener' }, [
        el('span', { class: 'yt-icon', 'aria-hidden': 'true', text: '▶' }),
        el('span', { class: 'yt-text' }, [el('strong', { text: L() === 'en' ? 'Highlights' : '精華影片' }), el('small', { text: L() === 'en' ? 'On YouTube' : '在 YouTube 觀看' })]),
        el('span', { class: 'yt-go', text: '›' })
      ])
    : null;
}

// The overview: the teams side by side, what the match is (where, when, TV),
// the win probability, each side's leaders, the season series and injuries.
function overview(d, e, table, nameOf) {
  const sides = [e.away, e.home];
  const places = sides.map(s => placeOf(table, s.id));
  const forms = sides.map(s => d?.form.find(f => f.team === s.id)?.games || []);
  const sm = side => d?.byId?.[side.id] || side;
  const compareRows = [
    [T('record'), ...sides.map(s => sm(s).record || s.record || '—')],
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
    ['🕒', T('kickoff'), `${dayLabel(localDate(when.getTime()), { long: true })} ${clock(e.start)}`],
    ['📍', T('venue'), zhLater([d?.venue || e.venue, d?.city].filter(Boolean).join(' · '))],
    exactTv ? null : ['📺', T('tv'), tvOf(e).map(tvName).join('、') || T('noTw')],
    stageTag(e, L()) ? ['🏅', T('stage'), [stageTag(e, L()), seriesText(e)].filter(Boolean).join(' · ')] : null,
    ['🌤', T('weather'), weatherText(d?.weather)],
    ['👥', T('attendance'), d?.attendance ? Number(d.attendance).toLocaleString(L() === 'en' ? 'en-US' : 'zh-TW') : ''],
    ['🧑‍⚖️', T('officials'), (d?.officials || []).slice(0, 3).join('、')],
    // ESPN's note ("ALWC - Game 1") only where the stage tag doesn't already say it.
    ['🏆', T('competition'), joinNodes([leagueName(e.league, L()), stageTag(e, L()) && L() !== 'en' ? '' : zhLater(e.note)], ' · ')]
  ]
    .filter(Boolean)
    .filter(([, , v]) => v && (!Array.isArray(v) || v.length));
  const leadersBy = sides.map(s => (d?.leaders || []).filter(l => l.team === s.id).slice(0, 4));
  return el('div', { class: 'stack' }, [
    highlights(e),
    card(T('matchup'), compare),
    d?.winProb.length > 3 ? winProbCard(d, e) : null,
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
    d?.series[0]?.h2h?.n ? card(L() === 'en' ? 'Head to head' : '近期交手', el('p', { class: 'series-text', text: h2hText(d.series[0].h2h, e) })) : d?.series.length && d.series[0].summary ? card(T('series'), el('p', { class: 'series-text', text: seriesZh(d.series[0].summary, e) })) : null,
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
              .map(i => el('div', {}, [el('p', { class: 'mini-h', text: nameOf(i.team) }), el('ul', { class: 'inj-list' }, i.list.slice(0, 8).map(x => el('li', {}, [x.id ? el('button', { class: 'link roster-name', type: 'button', onclick: () => ctx.openPlayer(e.league, x.id, { name: x.name, logo: x.headshot }) }, [personPic(x, e.league, 'xs round'), el('span', { text: x.name })]) : el('span', { text: x.name }), el('small', {}, [injuryText(x.status)])])))]))
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

function winProbCard(d, e) {
  const pts = d.winProb;
  const w = 320;
  const h = 90;
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${((i / (pts.length - 1)) * w).toFixed(1)},${(h - p * h).toFixed(1)}`).join(' ');
  const last = pts.at(-1);
  // Away on the left, home on the right (as everywhere in the sheet), adding up to 100.
  const home = Math.round(last * 100);
  const box = el('div', { class: 'wp' }, [
    el('div', { class: 'wp-labels' }, [el('span', { class: 'away', text: `${e.away.short || e.away.name} ${100 - home}%` }), el('span', { class: 'home', text: `${e.home.short || e.home.name} ${home}%` })]),
    el('div', { class: 'wp-plot' }, [
      el('span', { class: 'wp-edge top', text: e.home.short || e.home.name }),
      el('div', { html: `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="wp-chart" aria-hidden="true"><path d="${path} L${w},${h / 2} L0,${h / 2} Z" class="wp-area"/><line x1="0" x2="${w}" y1="${h / 2}" y2="${h / 2}" class="wp-mid"/><path d="${path}" class="wp-line"/></svg>` }),
      el('span', { class: 'wp-edge bottom', text: e.away.short || e.away.name })
    ])
  ]);
  return card(T('winProb'), box);
}

// ---- Race weekends ----------------------------------------------------------------------

// A driver in a race: their page, where ESPN has one; else just the name.
function personName(league, p, cls = 'field-name') {
  if (!p) return el('span', { class: cls });
  const can = p.id && LEAGUES[league]?.espn && /^\d+$/.test(String(p.id));
  return can ? el('button', { class: `link ${cls}`, type: 'button', text: p.name, onclick: () => ctx.openPlayer(league, p.id, p) }) : el('span', { class: cls, text: p.name });
}
// Where to watch in Taiwan: a game's own channels (a schedule's: the
// channel, its commentary, when it starts, a tap to watch it in the app),
// else the league's service.
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
                      el('small', { text: b.ch ? [[audioName(b), b.adFree ? (L() === 'en' ? 'no ads' : '無廣告') : ''].filter(Boolean).join(L() === 'en' ? ', ' : '・'), b.at ? `${clock(new Date(b.at).toISOString())} ${L() === 'en' ? 'on air' : '開播'}` : ''].filter(Boolean).join(' · ') : b.svc === 'appletv' ? (L() === 'en' ? 'Every game' : '每場都有') : L() === 'en' ? "This game (NBA.com); channel in ELTA's schedule" : '這場有轉播（NBA.com）・頻道見愛爾達節目表' })
                    ]),
                    b.url ? el('span', { class: 'tw-watch-go', text: `${L() === 'en' ? 'Watch' : '觀看'} ›` }) : null
                  ])
                )
              )
            : null,
          rest.length ? el('div', { class: 'tw-list' }, rest.map(b => el('span', { class: 'tw-chip', text: tvName(b) }))) : null
        ])
      : el('p', { class: 'muted small', text: T('noTw') }),
    { sub: exact.some(b => b.ch) ? (L() === 'en' ? "ELTA's schedule" : '愛爾達節目表') : exact.some(b => b.svc === 'elta') ? 'NBA.com' : L() === 'en' ? `Checked ${CHECKED}` : `${CHECKED} 查核` }
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
              el('span', { class: 'wk-time num', text: clock(x.start) }),
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
function f1Field(rows, field) {
  const en = L() === 'en';
  const plain = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return el(
    'ol',
    { class: 'field f1-field' },
    rows.map(r => {
      const full = `${r.driver.givenName} ${r.driver.familyName}`;
      const c = field.find(x => plain(x.name).endsWith(plain(r.driver.familyName))) || { name: full };
      const who = { ...c, name: en ? c.name : f1Driver(full).zh || c.name };
      const gained = r.grid && !r.out ? r.grid - r.pos : 0;
      return el('li', { class: ctx.isFollowed('f1', c.id) ? 'mine' : '' }, [
        el('span', { class: `pos num${r.out ? ' out' : ''}`, text: r.out ? r.text : String(r.pos) }),
        personPic(c, 'f1', 'sm round'),
        el('span', { class: 'f1-who' }, [
          personName('f1', who),
          el('button', { class: 'link f1-team', type: 'button', onclick: () => openConstructor({ id: '', name: r.team, en: r.team }) }, [constructorBadge(f1Constructor(r.team).name, 'xxs'), el('span', { text: en ? f1Constructor(r.team).name : f1Constructor(r.team).zh })])
        ]),
        el('span', { class: 'f1-res' }, [
          el('small', { class: 'num', text: r.out ? r.why : r.time || (r.status === 'Lapped' ? (en ? 'Lapped' : '被套圈') : '') }),
          el('span', { class: 'f1-tags' }, [
            gained ? el('small', { class: `num ${gained > 0 ? 'up' : 'down'}`, text: `${gained > 0 ? '▲' : '▼'}${Math.abs(gained)}` }) : null,
            r.fastest ? el('small', { class: 'fl', title: en ? 'Fastest lap' : '最快圈', text: en ? 'FL' : '最快圈' }) : null,
            r.points ? el('strong', { class: 'num pts', text: `+${r.points}` }) : null
          ])
        ])
      ]);
    })
  );
}
function fillField(s, e) {
  s.body.append(el('div', { class: 'q-card pad fx-card' }, [el('div', { class: 'sess-head field-title' }, [raceFlag(e, 'big'), sessionTag(e), el('h3', { text: e.name })]), el('p', { class: 'muted', text: [e.venue, whenText(e.start)].filter(Boolean).join(' · ') }), watchButton(e, 'wide')]));
  const yt = highlights(e);
  if (yt) s.body.append(yt);
  if (e.kind === 'field') {
    // The weekend's (or week's) sessions, then the chosen one's order.
    const sessions = [...e.sessions].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    if (sessions.length > 1) s.body.append(card(T('schedule'), weekendTimeline(sessions)));
    let pick = e.sessionKey ? Math.max(0, sessions.findIndex(x => x.abbr === e.sessionKey)) : Math.max(0, sessions.findLastIndex(x => x.status.state !== 'pre'));
    const box = el('div');
    const paint = () => {
      const ss = sessions[pick];
      put(
        box,
        sessions.length > 1 ? segmented(sessions.map((x, i) => [String(i), sessionName(x, L(), true)]), String(pick), v => ((pick = Number(v)), paint())) : null,
        el('p', { class: 'muted small', text: `${sessionName(ss, L())} · ${statusText({ ...e, start: ss.start, status: ss.status })}` }),
        ss.field.length ? el('ol', { class: 'field' }, ss.field.map((c, i) => el('li', { class: ctx.isFollowed(e.league, c.id) ? 'mine' : '' }, [el('span', { class: 'pos num', text: String(i + 1) }), personPic(c, e.league, 'sm round'), personName(e.league, c), c.score ? el('small', { class: 'num', text: c.score }) : null]))) : empty(T('noField'))
      );
      // F1, a race or sprint that's over: the official result (each car's
      // team, time or retirement, points and places gained from the grid).
      const at = pick;
      if (e.league === 'f1' && ss.status.state === 'post' && (ss.abbr === 'Race' || ss.abbr === 'SR'))
        raceResult(ss.start, ss.abbr === 'SR', L() === 'en')
          .then(rows => rows.length && at === pick && box.isConnected && box.querySelector('ol.field')?.replaceWith(f1Field(rows, ss.field)))
          .catch(() => {});
    };
    paint();
    s.body.append(box);
  }
  s.body.append(twCard(e.league, e));
}

// ---- A team -------------------------------------------------------------------------------

// A team's page, the way the leagues' own apps lay it out: the hero (logo,
// name, record, place, form, follow), a strip of its key numbers, the next
// game as a card, then tabs: 賽程 (to come), 戰績 (results), 陣容 (the
// roster, ESPN's leagues) and 排名 (its part of the table). CPBL (not on
// ESPN) gets the same page from its own schedule: the record and the table
// counted from the results.
export async function openTeam(league, id, fallback = {}) {
  if (!id || !hasTeamPage(league)) return;
  const s = sheet(leagueName(league, L()), { league });
  const content = el('div', {}, [spinner()]);
  s.body.append(content);
  ctx.track([teamKey(league, fallback.name || ''), `league:${leagueKey(league)}`].filter(k => !k.endsWith(':')), 1.5);
  const espn = Boolean(LEAGUES[league]?.espn);
  const en = L() === 'en';
  const W = (zh, eng) => (en ? eng : zh);
  try {
    const [info, sched, groups] = espn
      ? await Promise.all([team(league, id), teamSchedule(league, id).catch(() => []), hasStandings(league) ? standings(league).catch(() => null) : null])
      : await ownTeam(league, id, fallback);
    const now = Date.now();
    const played = sched.filter(x => x.status.state === 'post' && !x.status.void);
    const past = played.slice(-10).reverse();
    const upcoming = sched.filter(x => x.status.state !== 'post' && !x.status.void && Date.parse(x.start) > now - 4 * 3_600_000);
    const side = { id: info.id, name: info.name, en: info.en, logo: info.logo };
    const followBtn = el('button', { class: 'q-chip small follow-pill', type: 'button' });
    const paintFollow = () => {
      const on = ctx.isFollowed(league, id);
      followBtn.textContent = on ? T('following') : `+ ${T('follow')}`;
      followBtn.classList.toggle('on', on);
    };
    followBtn.addEventListener('click', () => (ctx.toggleFollow(league, side), paintFollow()));
    paintFollow();
    const place = placeOf(groups, id);
    // A club in several competitions: each game says which.
    const comps = new Set(sched.map(x => x.other || x.league)).size > 1;
    const resultOf = x => {
      const [me, them] = x.home.id === String(id) ? [x.home, x.away] : [x.away, x.home];
      return me.winner ? 'W' : them.winner ? 'L' : Number(me.score) === Number(them.score) && me.score !== '' ? 'D' : Number(me.score) > Number(them.score) ? 'W' : 'L';
    };
    const form = played.slice(-5).filter(x => x.home && x.away).map(resultOf);
    const record = info.record || ownRecord(played, resultOf);
    // The numbers that matter in the sport, in one strip.
    const sport = LEAGUES[league]?.sport;
    const want = sport === 'soccer' ? ['GP', 'W', 'D', 'L', 'GD', 'P'] : ['W', 'L', 'PCT', 'GB', 'STRK'];
    const stats = place ? want.filter(k => place.row.stats[k] != null && place.row.stats[k] !== '').slice(0, 5) : [];
    const strip = place
      ? el('div', { class: 'team-strip' }, [
          el('div', { class: 'ts-cell lead' }, [el('strong', { class: 'num', text: String(place.pos) }), el('small', { text: place.group && !/20\d\d/.test(place.group) ? place.group : W('排名', 'Place') })]),
          ...stats.map(k => el('div', { class: 'ts-cell' }, [el('strong', { class: 'num', text: place.row.stats[k] }), el('small', { text: colLabel(k) })]))
        ])
      : null;
    const next = upcoming[0];
    const nextCard = next ? el('div', { class: 'team-next' }, [el('p', { class: 'mini-h', text: W('下一場', 'Next game') }), el('div', { class: 'q-card list' }, [eventRow(next, { league: comps })])]) : null;
    const tabsBox = el('div');
    const body = el('div', { class: 'team-tab' });
    const views = [['schedule', W('賽程', 'Schedule')], ['results', W('戰績', 'Results')]];
    if (espn) views.push(['roster', W('陣容', 'Roster')]);
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
                past.map(x => {
                  const r = resultOf(x);
                  const them = x.home.id === String(id) ? x.away : x.home;
                  const at = x.home.id === String(id) ? 'vs' : '@';
                  const score = x.home.id === String(id) ? `${x.home.score}-${x.away.score}` : `${x.away.score}-${x.home.score}`;
                  return el('button', { class: 'res-row', type: 'button', onclick: () => ctx.openEvent(x) }, [
                    el('span', { class: 'res-date num', text: localDate(Date.parse(x.start)).slice(5).replace('-', '/') }),
                    el('span', { class: 'res-opp' }, [el('small', { class: 'muted', text: at }), logo(them.logo, them.name, 'xs'), el('span', { text: them.short || them.name })]),
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
          el('p', { class: 'team-hero-sub' }, joinNodes([record, place ? el('span', { class: 'nowrap', text: W(`${leagueName(league, L())}第 ${place.pos} 名`, `${place.pos}${['th', 'st', 'nd', 'rd'][place.pos % 10 < 4 && Math.floor(place.pos / 10) !== 1 ? place.pos % 10 : 0]} in the ${leagueName(league, L())}`) }) : standingZh(info.standing, L())].filter(Boolean), ' · ')),
          form.length ? el('div', { class: 'hero-form' }, [resultPills(form)]) : null
        ]),
        followBtn
      ]),
      strip,
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
  const groups = rows.length ? [{ name: leagueName(league, L()), rows }] : null;
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
const tile = (label, value, sub = '') => el('div', { class: 'stat-tile' }, [el('small', { text: label }), el('strong', { class: 'num', text: value }), sub ? el('small', { class: 'muted', text: sub }) : null]);

// Form in pills (W, D, L), oldest first.
const resultPills = list => el('div', { class: 'form-pills' }, list.map(r => el('span', { class: `pill ${r}`, text: L() === 'en' ? r : { W: '勝', D: '和', L: '敗' }[r] || r })));

// ---- A player -----------------------------------------------------------------------------

// Individual sports (races, tours, fights): the person is followed like a team.
const individual = league => LEAGUES[league]?.kind !== 'match';
const LOG_WORDS = { Started: '先發', Sub: '替補', Substitute: '替補', 'Did not play': '未上場', DNP: '未上場' };
const SPLIT_ZH = { Career: '生涯', 'Regular Season': '例行賽', Postseason: '季後賽', Playoffs: '季後賽' };

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
// Each weekend this season, latest first, opening the race: per car the grid,
// the finish and the sprint (one car: a driver; two: a team), and the points.
function f1Weekends(weekends, en, cars) {
  const W = (zh, eng) => (en ? eng : zh);
  const one = cars[0]?.key === 'me';
  const carOf = (w, c) => (c.key === 'me' ? w.me : w.rows.find(r => r.driverId === c.key));
  const sprints = weekends.some(w => cars.some(c => carOf(w, c)?.sprint));
  const head = one
    ? [W('發車', 'Grid'), W('正賽', 'Race'), sprints ? W('衝刺', 'Sprint') : null]
    : cars.flatMap(c => [c.head]);
  return card(
    W('本季每站', 'Race by race'),
    el('div', { class: 'table-wrap' }, [
      el('table', { class: 'data team-season f1-weekends' }, [
        el('thead', {}, [el('tr', {}, [el('th', { class: 'left', text: W('分站', 'Race') }), ...head.filter(Boolean).map(h => el('th', { class: 'num', text: h })), el('th', { class: 'num', text: W('得分', 'Pts') })])]),
        el(
          'tbody',
          {},
          weekends.map(w => {
            const open = w.e ? () => ctx.openEvent(splitWeekend(w.e, Date.now(), L()).find(x => x.sessionKey === 'Race') || w.e) : null;
            const cells = one
              ? (r => [
                  el('td', { class: 'num muted', text: r?.grid ? String(r.grid) : r ? W('維修區', 'Pit') : '–' }),
                  el('td', { class: 'num' }, [finishPill(finishOf(r?.result, en))]),
                  sprints ? el('td', { class: 'num' }, [r?.sprint ? finishPill(finishOf(r.sprint, en), ' small') : el('span', { class: 'muted', text: '' })]) : null
                ])(w.me)
              : cars.map(c => {
                  const r = carOf(w, c);
                  return el('td', { class: 'num' }, [el('span', { class: 'f1-cell' }, [finishPill(finishOf(r?.result, en)), sprints ? (r?.sprint ? finishPill(finishOf(r.sprint, en), ' small') : el('span', { class: 'pos-pill small blank' })) : null])]);
                });
            return el('tr', { class: open ? 'tap' : null, onclick: open }, [
              el('td', { class: 'left' }, [el('span', { text: w.e?.name || w.name }), el('small', { class: 'muted num', text: `R${w.round}` })]),
              ...cells.filter(Boolean),
              el('td', { class: 'num', text: String(one ? Number(w.me?.result?.points || 0) + Number(w.me?.sprint?.points || 0) : w.points) })
            ]);
          })
        )
      ])
    ]),
    { sub: sprints ? W('小字為衝刺賽', 'small: sprint') : '' }
  );
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
export async function openPlayer(league, id, fallback = {}) {
  if (!id) return;
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
      sport === 'racing' && LEAGUES[league].standings ? standings(league).catch(() => null) : null,
      sport === 'racing' ? seasonEvents(league).catch(() => []) : null,
      // F1: formula1.com's figures and each weekend's grid, finish and sprint.
      league === 'f1' ? athlete(league, id).then(x => f1Official('drivers', { page: f1Driver(x.name).page, name: x.name })).catch(() => null) : null
    ]);
    const en = L() === 'en';
    const W = (zh, eng) => (en ? eng : zh);
    const driver = league === 'f1' ? f1Driver(a.name) : null;
    const champ = table ? driverSeason(table, id) : null;
    const name = driver && !en && driver.zh !== a.name ? `${driver.zh}` : a.name;
    const facts = [
      [sport === 'racing' ? W('車隊', 'Team') : T('team'), driver?.team && !en ? f1Constructor(driver.team).zh : a.team || driver?.team || ''],
      [T('country'), countryName(a.country, L())],
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
        return at >= 0 ? [{ name: e.name, start: race.start, pos: at + 1 }] : [];
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
            el('strong', { class: 'mate-me', text: name }),
            el('button', { class: 'link mate-them', type: 'button', text: mateName, onclick: () => ctx.openPlayer(league, mateRow.id, mateRow) }),
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
    // Their last games (team sports): the date, the other side, the result, their numbers.
    const logCard = ov?.log
      ? card(
          W(`近 ${ov.log.games.length} 場`, `Last ${ov.log.games.length} games`),
          el('div', { class: 'table-wrap' }, [
            el('table', { class: 'data game-log' }, [
              el('thead', {}, [el('tr', {}, [el('th', { class: 'left', text: W('日期', 'Date') }), el('th', { class: 'left', text: W('對手', 'Opp') }), el('th', { class: 'left', text: W('結果', 'Result') }), ...ov.log.labels.map(k => el('th', { class: 'num', title: k, text: sport === 'basketball' && k === 'PTS' && !en ? '得分' : statName(k, L()) }))])]),
              el(
                'tbody',
                {},
                ov.log.games.map(g =>
                  el('tr', {}, [
                    el('td', { class: 'left num', text: g.date ? localDate(Date.parse(g.date)).slice(5).replace('-', '/') : '' }),
                    el('td', { class: 'left opp-cell' }, [el('span', { class: 'muted', text: g.at === '@' ? '@' : 'vs' }), logo(g.opp.logo, g.opp.name, 'xs'), el('span', { text: g.opp.abbr || g.opp.name })]),
                    el('td', { class: 'left' }, [el('span', { class: `result-pill ${g.result === 'W' ? 'w' : g.result === 'L' ? 'l' : ''}`, text: [g.result ? (en ? g.result : { W: '勝', L: '敗', D: '和', T: '和' }[g.result] || g.result) : '', g.score].filter(Boolean).join(' ') })]),
                    ...g.stats.map(v => el('td', { class: 'num', text: en ? v : LOG_WORDS[v] || v }))
                  ])
                )
              )
            ])
          ])
        )
      : null;
    // The latest word on them (an injury, a lineup), in their language.
    const noteCard = ov?.note
      ? card(W('最新動態', 'Latest'), noteBody(ov.note), { sub: ov.note.date ? dayLabel(localDate(Date.parse(ov.note.date))) : '' })
      : null;
    const awardsCard = ov?.awards?.length
      ? card(W('榮譽', 'Honours'), el('ul', { class: 'award-list' }, ov.awards.map(w => el('li', {}, [el('strong', {}, [zhLater(w.name)]), w.count ? el('span', { class: 'award-count num', text: w.count.replace(/x$/i, '×') }) : null, w.seasons.length ? el('small', { class: 'muted', text: w.seasons.slice(0, 6).join(' · ') + (w.seasons.length > 6 ? ' …' : '') }) : null]))))
      : null;
    const nextRace = (races || []).find(e => e.status.state !== 'post' && Date.parse(e.end || e.start) > Date.now() - 86_400_000);
    // A player in any league; a team sport's with their team, whose games are theirs.
    const followBtn = el('button', { class: 'q-btn', type: 'button' });
    const paintFollow = () => {
      const on = ctx.isFollowed(league, id);
      followBtn.textContent = on ? T('following') : `+ ${T('follow')}`;
      followBtn.classList.toggle('primary', !on);
    };
    const team = !individual(league) && a.teamId ? { id: String(a.teamId), name: a.team || '' } : null;
    followBtn.addEventListener('click', () => (ctx.toggleFollow(league, { id, name: a.name || fallback.name, logo: a.headshot || fallback.logo, athlete: true, ...(team ? { team } : {}) }), paintFollow()));
    paintFollow();
    const sub = [zhLater(a.position), (driver?.team && !en ? f1Constructor(driver.team).zh : a.team || driver?.team) || countryName(a.country, L())].filter(Boolean);
    const year = new Date().getFullYear();
    const heroColor = driver?.team ? driver.color : a.teamColor;
    const lastFive = weekends.length ? weekends.slice(0, 5).reverse().map(w => ({ name: w.e?.name || w.name, ...finishOf(w.me?.result, en) })) : raceRows.slice(0, 5).reverse().map(r => ({ ...r, text: `P${r.pos}` }));
    const shot = a.headshot || fallback.logo;
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
    const overview = keep([
      noteCard,
      og.season
        ? card(W(`${year} 賽季`, `${year} season`), el('div', { class: 'stat-grid' }, [...og.season.map(([k, v]) => f1Tile(k, v, en)), champ?.pos > 1 && champ.gap ? tile(W('落後領先者', 'Behind the leader'), champ.gap) : null].filter(Boolean)))
        : null,
      !og.season && champ
        ? card(
            W(`${year} 車手積分榜`, `${year} drivers' championship`),
            el('div', { class: 'stat-grid' }, [tile(W('排名', 'Place'), T('placeN', { n: champ.pos }), W(`共 ${champ.of} 位`, `of ${champ.of}`)), tile(W('積分', 'Points'), champ.points), champ.pos > 1 && champ.gap ? tile(W('落後領先者', 'Behind the leader'), champ.gap) : null, tile(W('完成站數', 'Races'), String(champ.races.length))].filter(Boolean))
          )
        : null,
      nextRace ? card(W('下一站', 'Next race'), el('p', { class: 'series-text', text: [nextRace.name, whenText(nextRace.start)].filter(Boolean).join(' · ') })) : null,
      mateCard,
      !racing && a.stats.list.length ? card(statsTitle(a.stats.title, L()) || T('season'), el('div', { class: 'stat-grid' }, a.stats.list.map(x => tile(statName(x.label, L()), x.value, x.rank)))) : null
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
                    el('tbody', {}, ov.season.rows.map(r => el('tr', {}, [el('th', { class: 'left split-name' }, [en ? r.name : SPLIT_ZH[r.name] || zhLater(r.name)]), ...r.cells.map(c => el('td', { class: 'num', text: c.value }))])))
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
      !weekends.length && raceRows.length
        ? card(
            W('本季各站正賽', 'This season, race by race'),
            el('ul', { class: 'info-list results' }, raceRows.map(r => el('li', {}, [el('span', { class: 'info-k', text: r.name }), el('span', { class: `info-v num pos-pill${r.pos <= 3 ? ' podium' : ''}`, text: `P${r.pos}` })])))
          )
        : null
    ]);
    const bio = keep([
      facts.length ? card(T('profile'), el('ul', { class: 'info-list' }, facts.map(([k, v]) => el('li', {}, [el('span', { class: 'info-k', text: k }), el('span', { class: 'info-v' }, [v])])))) : null,
      awardsCard,
      a.teamId && !individual(league) ? el('button', { class: 'q-btn block', type: 'button', text: `${a.team} ›`, onclick: () => openTeam(league, a.teamId, { name: a.team }) }) : null,
      driver?.team ? el('button', { class: 'q-btn block', type: 'button', text: `${en ? driver.team : f1Constructor(driver.team).zh} ›`, onclick: () => openConstructor({ id: '', name: driver.team, en: driver.team }) }) : null
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
          el('h3', { text: `${name}${a.jersey ? ` #${a.jersey}` : ''}` }),
          name !== a.name ? el('small', { class: 'muted', text: a.name }) : null,
          el('p', { class: 'muted' }, joinNodes(sub, ' · ')),
          a.injuries.length ? el('p', { class: 'injury-tag' }, joinNodes(['🩹', ...a.injuries.map(injuryText)], ' ')) : null,
          lastFive.length ? el('div', { class: 'hero-form' }, [el('small', { class: 'muted', text: W('近 5 站', 'Last 5') }), ...lastFive.map(r => el('span', { class: `pos-pill num${r.out ? ' out' : r.pos <= 3 ? ' podium' : ''}`, title: r.name, text: r.text }))]) : null
        ]),
        followBtn
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
    const [table, races, official] = await Promise.all([standings(league).catch(() => null), seasonEvents(league).catch(() => []), f1Official('constructors', { page: c.page, name: c.name }).catch(() => null)]);
    const og = official?.grids || {};
    const jw = (official?.weekends || []).map(w => ({ ...w, e: eventOfRace(races, w.date) }));
    const groups = table || [];
    const teams = groups.find(g => g.rows.some(r => !r.athlete))?.rows || [];
    const at = teams.findIndex(r => r.id === row.id || f1Constructor(r.en || r.name).name === c.name);
    const me = teams[at] || row;
    const lead = teams[0];
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
      .map(([key, { d }]) => ({ key, head: (en ? d.familyName : f1Driver(`${d.givenName} ${d.familyName}`).zh).replace(/^.*[.\s]/, '') }));
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
    const gap = lead && lead !== me ? Number(lead.stats?.PTS) - Number(pts) : 0;
    // Followed by the kit's name (ESPN's constructor ids aren't kept anywhere else).
    const side = { id: `f1team:${c.name}`, name: c.name, en: c.name, f1team: true };
    const followBtn = el('button', { class: 'q-btn small', type: 'button' });
    const paintFollow = () => {
      const on = ctx.isFollowed(league, side.id);
      followBtn.textContent = on ? T('following') : `+ ${T('follow')}`;
      followBtn.classList.toggle('primary', !on);
    };
    paintFollow();
    followBtn.addEventListener('click', () => (ctx.toggleFollow(league, side), paintFollow()));
    put(
      content,
      el('div', { class: 'team-head player-hero tinted', style: `--hero:${c.color}` }, [
        constructorBadge(c.name, 'xl'),
        el('div', { class: 'team-head-text' }, [
          el('h3', { text: en ? c.name : c.zh }),
          !en && c.zh !== c.name ? el('small', { class: 'muted', text: c.name }) : null,
          el('p', { class: 'muted', text: [at >= 0 ? W(`車隊積分榜第 ${at + 1}`, `P${at + 1} in the constructors'`) : '', pts !== '' ? W(`${pts} 分`, `${pts} pts`) : ''].filter(Boolean).join(' · ') })
        ]),
        followBtn
      ]),
      el('div', { class: 'team-tiles' }, [
        tile(W('排名', 'Place'), at >= 0 ? `P${at + 1}` : '–', gap > 0 ? W(`落後 ${gap} 分`, `${gap} behind`) : at === 0 ? W('領先', 'Leading') : ''),
        tile(W('積分', 'Points'), String(pts || '–')),
        tile(W('分站冠軍', 'Wins'), String(wins)),
        tile(W('頒獎台', 'Podiums'), String(podiums), doubles ? W(`雙登台 ${doubles} 次`, `${doubles} double`) : '')
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
                  // Their share of the team's points, said in words beside the bar.
                  Number(pts) > 0
                    ? el('span', { class: 'share-line' }, [
                        el('span', { class: 'share-bar', style: `--w:${Math.round((100 * Number(d.stats?.PTS || 0)) / Number(pts))}%` }),
                        el('small', { class: 'muted num', text: W(`占車隊積分 ${Math.round((100 * Number(d.stats?.PTS || 0)) / Number(pts))}%`, `${Math.round((100 * Number(d.stats?.PTS || 0)) / Number(pts))}% of the team's points`) })
                      ])
                    : null
                ])
              )
            )
          )
        : null,
      og.gp ? card(W('正賽', 'Grand Prix'), f1Tiles(og.gp, en)) : null,
      og.sprint ? card(W('衝刺賽', 'Sprint'), f1Tiles(og.sprint, en)) : null,
      next ? el('h3', { class: 'section-h', text: W('下一站', 'Next') }) : null,
      next ? el('div', { class: 'q-card list' }, splitWeekend(next, Date.now(), L()).filter(x => x.status.state !== 'post').slice(0, 3).map(x => eventRow(x, { league: false }))) : null,
      jw.length && cars.length ? f1Weekends(jw, en, cars) : null,
      og.career ? card(W('車隊歷史', 'Highlights'), f1Tiles(og.career, en)) : null,
      og.profile ? card(W('車隊資料', 'Team profile'), el('ul', { class: 'info-list' }, og.profile.map(([k, v]) => el('li', {}, [el('span', { class: 'info-k', text: f1Label(k, en) }), el('span', { class: 'info-v' }, [k === 'Base' && !en ? zhLater(v) : v])])))) : null,
      !jw.length && weekends.length
        ? card(
            W('本季每站', 'This season'),
            el('div', { class: 'table-wrap' }, [
              el('table', { class: 'data team-season' }, [
                el('thead', {}, [el('tr', {}, [el('th', { class: 'left', text: W('分站', 'Race') }), ...drivers.map(d => el('th', { class: 'num', text: (en ? d.en || d.name : f1Driver(d.en || d.name).zh).replace(/^.*[.\s]/, '') })), el('th', { class: 'num', text: W('得分', 'Pts') })])]),
                el(
                  'tbody',
                  {},
                  weekends.map(w =>
                    el('tr', { class: 'tap', onclick: () => ctx.openEvent(splitWeekend(w.e, Date.now(), L()).find(x => x.sessionKey === 'Race') || w.e) }, [
                      el('td', { class: 'left', text: w.e.name }),
                      ...w.fin.map(p => el('td', { class: 'num' }, [p > 0 ? el('span', { class: `pos-pill num${p <= 3 ? ' podium' : ''}${p === 1 ? ' win' : ''}`, text: `P${p}` }) : el('span', { class: 'muted', text: '–' })])),
                      el('td', { class: 'num', text: String(w.pts) })
                    ])
                  )
                )
              ])
            ])
          )
        : null
    );
  } catch {
    put(content, empty(T('failed')));
  }
}


// ---- Standings tables -----------------------------------------------------------------------

// mark: team ids to highlight (a match's two sides); followed teams always are.
export function standingsTables(groups, league, { mark = [], top = 0, compact = false } = {}) {
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
      return el('div', { class: 'q-card pad fx-card' }, [
        g.name ? el('p', { class: 'mini-h', text: g.name }) : null,
        el('div', { class: 'table-wrap' }, [
          el('table', { class: `data standings${compact ? ' compact' : ''}` }, [
            el('thead', {}, [el('tr', {}, [el('th', { class: 'left rank-cell', text: '#' }), el('th', { class: 'left name-cell' }), ...cols.map(c => el('th', { class: cls(c), text: colName(c) }))])]),
            el(
              'tbody',
              {},
              rows.map(r => {
                const i = g.rows.indexOf(r);
                const name = [el('span', { class: 'nm-full', text: r.name }), el('span', { class: 'nm-short', text: r.short || r.name })];
                return el('tr', { class: ctx.isFollowed(league, r.id) ? 'mine' : mark.includes(r.id) ? 'marked' : '' }, [
                  el('td', { class: 'left num rank-cell', style: r.color ? `box-shadow: inset 3px 0 0 ${r.color}` : null, text: String(i + 1) }),
                  el('th', { class: 'left name-cell' }, [
                    el('button', { class: 'link team-link', type: 'button', onclick: () => (r.athlete ? r.id && ctx.openPlayer(league, r.id, r) : league === 'f1' ? openConstructor(r) : r.id && openTeam(league, r.id, r)) }, [r.athlete ? personPic(r, league, 'xs round') : league === 'f1' ? constructorBadge(r.en || r.name, 'xs') : logo(r.logo, r.name, 'xs'), el('span', { class: 'nm' }, name)])
                  ]),
                  ...cols.map(c => el('td', { class: cls(c), text: r.stats[c] ?? '' }))
                ]);
              })
            )
          ])
        ])
      ]);
    })
  );
}
