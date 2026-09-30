// Quadra Fixtures' sheets: a match (header, the way into Play, then its data
// by section), a race / tournament / fight card, a team, a player, and the
// standings tables they share with the Standings tab.
import { APPS, appUrl, translate } from './lib/quadra.mjs';
import { scoreboard, splitWeekend, settleField, summary, standings, team, teamSchedule, roster, athlete, athleteOverview, playPairId, STANDING_COLUMNS, COMPACT_COLUMNS, sessionName, seasonEvents, rankings, driverSeason, playerMatches } from './lib/espn.mjs';
import { stageTag } from './lib/stage.mjs';
import { possessionOf } from './lib/live.mjs';
import { statName, statsTitle, metric, fixedWord, dateText } from './lib/statnames.mjs';
import { f1Driver, countryName } from './lib/logos.mjs';
import { playablePair } from './lib/playable.mjs';
import { tvOf } from './lib/tv.mjs';
import { broadcastsOf, CHECKED } from './lib/broadcast.mjs';
import { LEAGUES, leagueName, hasTeams, hasStandings } from './lib/leagues.mjs';
import { eventKeys, teamKey, leagueKey } from './lib/foryou.mjs';
import { ctx, el, put, spinner, empty, logo, driverLogo, diamond, clock, dayLabel, localDate, statusText, whenText, eventRow, sheet, segmented, seriesText, playTarget, goPlay, tvName } from './ui.js';

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
        el('button', { class: 'mh-team', type: 'button', disabled: !hasTeams(e.league) || e.kambi ? true : null, onclick: () => ctx.openTeam(e.league, x.id, x) }, [logo(x.logo || raw.logo, x.name, 'lg'), el('strong', { text: raw.short || x.short || x.name })]),
        x.record || raw.record ? el('small', { text: x.record || raw.record }) : null,
        hasTeams(e.league) && !e.kambi ? followChip(e.league, x, () => paintHeader(sm)) : null
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
      linescore(sm, e),
      livePanel(e),
      playTarget(e) ? playLink(playTarget(e), e, e.status.state === 'in' ? 'betLiveTitle' : 'betTitle') : null
    );
  };
  paintHeader(null);
  // A game on (or about to start): the score, the situation and the
  // sections again every 20 seconds while the sheet is open.
  const soon = () => e.status.state === 'in' || (e.status.state === 'pre' && Date.parse(e.start) - Date.now() < 15 * 60_000);
  const timer = setInterval(async () => {
    if (!s.dialog.isConnected) return clearInterval(timer);
    if (document.visibilityState !== 'visible' || !soon()) return;
    const fresh = (await scoreboard(e.league).catch(() => [])).find(x => x.id === e.id);
    if (fresh) e = { ...e, ...fresh };
    if (!e.kambi && LEAGUES[e.league].espn) data = await summary(e.league, e.id).catch(() => data);
    paintHeader(data);
    paint();
  }, 20_000);
  s.dialog.addEventListener('close', () => clearInterval(timer));
  const paint = () => {
    const tabs = [['overview', T('overview')]];
    if (data?.teamStats.length) tabs.push(['stats', T('stats')]);
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
  if (e.kambi || !LEAGUES[e.league].espn) {
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
// who bats against whom; the down, distance, ball and red zone; the goals and
// red cards by minute; and the last play.
function livePanel(e) {
  const lv = e.live;
  if (e.status.state !== 'in' || !lv) return null;
  const sport = LEAGUES[e.league]?.sport;
  const en = L() === 'en';
  const rows = [];
  if (sport === 'baseball' && lv.bases) {
    rows.push(
      el('div', { class: 'lp-baseball' }, [
        diamond(lv.bases, lv.outs, true),
        el('div', { class: 'lp-count' }, [
          el('span', {}, [el('small', { text: 'B' }), dots(lv.balls, 4, 'ball')]),
          el('span', {}, [el('small', { text: 'S' }), dots(lv.strikes, 3, 'strike')]),
          el('span', {}, [el('small', { text: 'O' }), dots(lv.outs, 3, 'out')])
        ]),
        el('div', { class: 'lp-who' }, [lv.batter ? el('p', {}, [el('small', { text: T('batter') }), el('strong', { text: lv.batter })]) : null, lv.pitcher ? el('p', {}, [el('small', { text: T('pitcher') }), el('strong', { text: lv.pitcher })]) : null])
      ])
    );
  }
  if (sport === 'football' && lv.downText) {
    const side = possessionOf(e);
    const team = side ? e[side] : null;
    rows.push(
      el('div', { class: `lp-football${lv.redZone ? ' red-zone' : ''}` }, [
        team ? logo(team.logo, team.name, 'sm') : null,
        el('strong', { text: lv.downText }),
        lv.ballOn ? el('span', { text: `${en ? 'Ball on' : '球在'} ${lv.ballOn}` }) : null,
        lv.redZone ? el('b', { class: 'rz', text: en ? 'Red zone' : '紅區' }) : null
      ])
    );
  }
  if (lv.events?.length) {
    const col = id => lv.events.filter(x => x.team === id).map(x => el('li', {}, [el('span', { class: 'num', text: x.minute }), el('span', { text: `${x.kind === 'red' ? '🟥' : '⚽'} ${x.who}${x.kind === 'pen' ? '（PK）' : x.kind === 'own' ? (en ? ' (OG)' : '（烏龍）') : ''}` })]));
    rows.push(el('div', { class: 'lp-goals' }, [el('ul', {}, col(e.away.id)), el('ul', { class: 'home' }, col(e.home.id))]));
  }
  if (lv.lastPlay) {
    // ESPN writes it in English: in Chinese once translated (kept 30 days per line).
    const text = document.createTextNode(lv.lastPlay);
    if (!en) translate(lv.lastPlay).then(zh => (text.textContent = zh));
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
    text: on ? `✓ ${T('following')}` : `+ ${T('follow')}`,
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
  const row = x => el('tr', {}, [el('th', { text: x.abbr || x.short }), ...Array.from({ length: n }, (_, i) => el('td', { class: 'num', text: x.lines?.[i] ?? '' })), el('td', { class: 'num total', text: x.score })]);
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
    if (i >= 0) return { pos: i + 1, row: g.rows[i], n: g.rows.length, group: g.name };
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
          d.teamStats
            .filter(s => !/games played/i.test(s.label) && !(Number(s.home) === 0 && Number(s.away) === 0))
            .slice(0, 40)
            .map(s => {
              const [a, h] = [statValue(s.away), statValue(s.home)];
              const top = Math.max(Math.abs(a ?? 0), Math.abs(h ?? 0));
              // Each side's own bar, measured against the larger of the two
              // (never a split of one line: an average or a rate doesn't add
              // up to a whole with the other side's).
              const bar = (v, cls) => el('div', { class: `sb-half ${cls}` }, [el('i', { style: `width:${top > 0 && v ? Math.max(3, (Math.abs(v) / top) * 100) : 0}%` })]);
              return el('div', { class: 'stat-bar' }, [
                el('div', { class: 'sb-top' }, [el('strong', { class: `num${a > h ? ' lead' : ''}`, text: s.away }), el('span', { text: statName(s.label, L()) }), el('strong', { class: `num${h > a ? ' lead' : ''}`, text: s.home })]),
                top > 0 ? el('div', { class: 'sb-track' }, [bar(a, 'away'), bar(h, 'home')]) : null
              ]);
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
          const list = ps => el('ul', { class: 'roster-list' }, ps.map(p => el('li', {}, [el('span', { class: 'jersey num', text: p.jersey }), el('button', { class: 'link', type: 'button', text: p.name, onclick: () => ctx.openPlayer(e.league, p.id) }), el('small', { text: p.pos })])));
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
    el('div', { class: 'cmp-head' }, [cmpTeam(e.away, 'away'), el('span', { class: 'cmp-vs', text: 'vs' }), cmpTeam(e.home, 'home')]),
    ...compareRows.map(([label, a, h]) => el('div', { class: 'cmp-row' }, [cmpValue(a), el('span', { text: label }), cmpValue(h)])),
    forms.some(f => f.length)
      ? el('div', { class: 'cmp-row form' }, [formPills(forms[0]), el('span', { text: T('form') }), formPills(forms[1])])
      : null
  ]);
  const when = new Date(e.start);
  const info = [
    ['🕒', T('kickoff'), `${dayLabel(localDate(when.getTime()), { long: true })} ${clock(e.start)}`],
    ['📍', T('venue'), [d?.venue || e.venue, d?.city].filter(Boolean).join(' · ')],
    ['📺', T('tv'), tvOf(e).map(tvName).join('、') || T('noTw')],
    stageTag(e, L()) ? ['🏅', T('stage'), [stageTag(e, L()), seriesText(e)].filter(Boolean).join(' · ')] : null,
    ['🌤', T('weather'), d?.weather],
    ['👥', T('attendance'), d?.attendance ? Number(d.attendance).toLocaleString(L() === 'en' ? 'en-US' : 'zh-TW') : ''],
    ['🧑‍⚖️', T('officials'), (d?.officials || []).slice(0, 3).join('、')],
    ['🏆', T('competition'), [leagueName(e.league, L()), e.note].filter(Boolean).join(' · ')]
  ]
    .filter(Boolean)
    .filter(([, , v]) => v);
  const leadersBy = sides.map(s => (d?.leaders || []).filter(l => l.team === s.id).slice(0, 4));
  return el('div', { class: 'stack' }, [
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
                ...list.map(l => el('div', { class: 'leader' }, [el('small', { text: statName(l.stat, L()) }), el('span', {}, [el('strong', { text: l.name }), el('b', { class: 'num', text: l.value })])]))
              ])
            )
          )
        )
      : null,
    d?.series.length && d.series[0].summary ? card(T('series'), el('p', { class: 'series-text', text: d.series[0].summary })) : null,
    d?.injuries.some(i => i.list.length)
      ? card(
          T('injuries'),
          el(
            'div',
            { class: 'injuries' },
            d.injuries
              .filter(i => i.list.length)
              .map(i => el('div', {}, [el('p', { class: 'mini-h', text: nameOf(i.team) }), el('ul', { class: 'inj-list' }, i.list.slice(0, 8).map(x => el('li', {}, [el('span', { text: x.name }), el('small', { text: x.status })])))]))
          )
        )
      : null,
    e.status.state !== 'post' && tvOf(e).some(b => b.ch) ? twCard(e.league, e) : null,
    card(T('matchInfo'), el('ul', { class: 'info-list' }, info.map(([icon, k, v]) => el('li', {}, [el('span', { class: 'info-icon', 'aria-hidden': 'true', text: icon }), el('span', { class: 'info-k', text: k }), el('span', { class: 'info-v', text: v })]))))
  ]);
}

// A few table columns worth comparing, by sport.
function keyStats(league, places) {
  const sport = LEAGUES[league]?.sport;
  const want = { soccer: ['P', 'GD', 'F', 'A'], baseball: ['PCT', 'GB', 'STRK'], basketball: ['PCT', 'GB', 'STRK'], football: ['PCT', 'STRK'], hockey: ['PTS', 'STRK'], rugby: ['PTS'], aussie: ['PTS'] }[sport] || [];
  return want.filter(k => places.every(p => p.row.stats[k] != null && p.row.stats[k] !== '')).map(k => [T(`col_${k}`) === `col_${k}` ? k : T(`col_${k}`), places[0].row.stats[k], places[1].row.stats[k]]);
}
// A long group name to its initials ("National Football Conference" → NFC).
export const groupShort = name => {
  const n = String(name || '').trim();
  if (n.length <= 12) return n;
  const caps = n.split(/[\s-]+/).filter(w => /^[A-Z]/.test(w)).map(w => w[0]).join('');
  return caps.length >= 2 ? caps : n;
};
const placeCell = (p, grouped) => [T('placeN', { n: p.pos }), grouped && p.group ? groupShort(p.group) : ''];
const cmpValue = v => (Array.isArray(v) ? el('strong', { class: 'cmp-val' }, [el('span', { class: 'num', text: v[0] }), v[1] ? el('small', { text: v[1] }) : null]) : el('strong', { class: 'cmp-val num', text: v }));
const cmpTeam = (s, cls) => el('div', { class: `cmp-team ${cls}` }, [logo(s.logo, s.name, 'sm'), el('span', { text: s.short || s.name })]);
const formPills = games => el('div', { class: 'form-pills' }, games.slice(-5).map(g => el('span', { class: `pill ${g.result}`, title: `${g.opp} ${g.score}`, text: g.result })));

function winProbCard(d, e) {
  const pts = d.winProb;
  const w = 320;
  const h = 90;
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${((i / (pts.length - 1)) * w).toFixed(1)},${(h - p * h).toFixed(1)}`).join(' ');
  const last = pts.at(-1);
  const box = el('div', { class: 'wp' }, [
    el('div', { class: 'wp-labels' }, [el('span', { text: `${e.home.short || e.home.name} ${Math.round(last * 100)}%` }), el('span', { text: `${e.away.short || e.away.name} ${Math.round((1 - last) * 100)}%` })]),
    el('div', { html: `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="wp-chart" aria-hidden="true"><line x1="0" x2="${w}" y1="${h / 2}" y2="${h / 2}" class="wp-mid"/><path d="${path}" class="wp-line"/></svg>` })
  ]);
  return card(T('winProb'), box);
}

// ---- Races, tournaments, fight cards ---------------------------------------------------

// A person in a race, tournament or fight: their page, where ESPN has one.
function personName(league, p, cls = 'field-name') {
  if (!p) return el('span', { class: cls });
  const can = p.id && LEAGUES[league]?.espn && !/^k/.test(String(p.id));
  return can ? el('button', { class: `link ${cls}`, type: 'button', text: p.name, onclick: () => ctx.openPlayer(league, p.id, p) }) : el('span', { class: cls, text: p.name });
}
// Where to watch in Taiwan: a game's own channels (ELTA's schedule: the
// channel, when it starts, a tap to watch it on ELTA.tv), then the other services.
function twCard(league, e = null) {
  const list = e ? tvOf(e) : broadcastsOf(league);
  const exact = list.filter(b => b.ch);
  const rest = list.filter(b => !b.ch);
  return card(
    T('watchTw'),
    list.length
      ? el('div', { class: 'stack tight' }, [
          exact.length
            ? el(
                'div',
                { class: 'tw-exact' },
                exact.map(b =>
                  el('a', { class: `tw-watch ${b.kind}`, href: b.url, target: '_blank', rel: 'noopener' }, [
                    el('span', { class: 'tw-watch-name' }, [el('strong', { text: tvName(b) }), b.at ? el('small', { text: `${clock(new Date(b.at).toISOString())} ${L() === 'en' ? 'on air' : '開播'}${b.kind === 'tv' ? (L() === 'en' ? ' · MOD, cable, ELTA.tv' : ' · MOD、有線電視、ELTA.tv') : ' · ELTA.tv'}` }) : null]),
                    el('span', { class: 'tw-watch-go', text: `${L() === 'en' ? 'Watch' : '觀看'} ›` })
                  ])
                )
              )
            : null,
          rest.length ? el('div', { class: 'tw-list' }, rest.map(b => el('span', { class: `tw-chip ${b.kind}`, text: tvName(b) }))) : null
        ])
      : el('p', { class: 'muted small', text: T('noTw') }),
    { sub: exact.length ? (L() === 'en' ? "ELTA's schedule" : '愛爾達節目表') : CHECKED }
  );
}

// The Quadra Play card: this game (the F1 board, the league's board) in Play, one tap.
function playLink(target, e, title) {
  return el('a', { class: 'play-link', href: appUrl('odds', target), onclick: ev => (ev.preventDefault(), ctx.track('toPlay', eventKeys(e), 2), ctx.q.go('odds', target)) }, [
    el('img', { src: `${APPS.odds.path}favicon.svg`, alt: '', width: '36', height: '36' }),
    el('span', { class: 'play-link-text' }, [el('strong', { text: T(title) }), el('small', { text: T('betSub') })]),
    el('span', { class: 'play-link-go', text: `${T('betGo')} ›` })
  ]);
}
// One bout or draw match in Play: a small 投注 (場中 once on) chip, while it isn't over.
function pairChip(e, start, a, b, status) {
  if (status.state === 'post' || status.void) return null;
  // Only a pair Play has priced.
  if (!playablePair(e.league, start, a?.en || a?.name, b?.en || b?.name, status.state)) return null;
  const id = playPairId(e.league, start, a, b);
  if (!id) return null;
  return el('button', { class: `bet-chip${status.state === 'in' ? ' live' : ''}`, type: 'button', onclick: ev => goPlay(`game=${id}`, ev) }, [document.createTextNode(T(status.state === 'in' ? 'betLive' : 'betChip'))]);
}

export function openFieldEvent(e) {
  const s = sheet(leagueName(e.league, L()), { league: e.league });
  fillField(s, e);
  // Something on: the order, the draw and the bouts again every 30 seconds.
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
function fillField(s, e) {
  s.body.append(el('div', { class: 'q-card pad fx-card' }, [el('h3', { class: 'field-title', text: e.name }), el('p', { class: 'muted', text: [e.venue, whenText(e.start)].filter(Boolean).join(' · ') })]));
  // F1: pole position for the qualifying, the race board otherwise (practice
  // and sprints aren't sold); a fight card or a tennis draw: the league's board.
  const target = playTarget(e);
  if (target) s.body.append(playLink(target, e, target === 'game=f1pole' ? 'betPoleTitle' : target === 'game=f1' ? 'betF1Title' : e.status.state === 'in' ? 'betBoardLive' : 'betBoard'));
  if (e.kind === 'field') {
    // The weekend's (or week's) sessions, then the chosen one's order.
    const sessions = [...e.sessions].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    if (sessions.length > 1)
      s.body.append(
        card(
          T('schedule'),
          el(
            'ul',
            { class: 'info-list sessions' },
            sessions.map(x => el('li', {}, [el('span', { class: 'info-k', text: sessionName(x, L()) }), el('span', { class: `info-v num${x.status.state === 'in' ? ' live-text' : ''}`, text: x.status.state === 'post' ? `${T('final')} · ${dayLabel(localDate(Date.parse(x.start)))}` : x.status.state === 'in' ? T('live') : whenText(x.start) })]))
          )
        )
      );
    let pick = e.sessionKey ? Math.max(0, sessions.findIndex(x => x.abbr === e.sessionKey)) : Math.max(0, sessions.findLastIndex(x => x.status.state !== 'pre'));
    const box = el('div');
    const paint = () => {
      const ss = sessions[pick];
      put(
        box,
        sessions.length > 1 ? segmented(sessions.map((x, i) => [String(i), sessionName(x, L(), true)]), String(pick), v => ((pick = Number(v)), paint())) : null,
        el('p', { class: 'muted small', text: `${sessionName(ss, L())} · ${statusText({ ...e, start: ss.start, status: ss.status })}` }),
        ss.field.length ? el('ol', { class: 'field' }, ss.field.map((c, i) => el('li', { class: ctx.isFollowed(e.league, c.id) ? 'mine' : '' }, [el('span', { class: 'pos num', text: String(i + 1) }), (e.league === 'f1' ? driverLogo : logo)(c.logo, c.name, 'sm round'), personName(e.league, c), c.score ? el('small', { class: 'num', text: c.score }) : null]))) : empty(T('noField'))
      );
    };
    paint();
    s.body.append(box);
  } else if (e.kind === 'card') {
    s.body.append(
      el(
        'div',
        { class: 'bouts' },
        e.bouts.map(b =>
          el('div', { class: `q-card pad bout${b.status.state === 'in' ? ' live' : ''}` }, [
            el('div', { class: 'bout-top' }, [el('small', { class: 'muted' }, joinNodes([zhLater(b.weight), statusText({ ...e, start: b.start, status: b.status })], ' · ')), pairChip(e, b.start || e.start, b.a, b.b, b.status)]),
            el('div', { class: 'bout-row' }, [
              el('span', { class: b.a?.winner ? 'win' : '' }, [logo(b.a?.logo, b.a?.name, 'sm round'), personName(e.league, b.a, 'bout-name')]),
              el('span', { class: 'vs', text: 'vs' }),
              el('span', { class: b.b?.winner ? 'win' : '' }, [personName(e.league, b.b, 'bout-name'), logo(b.b?.logo, b.b?.name, 'sm round')])
            ])
          ])
        )
      )
    );
  } else if (e.kind === 'draw') {
    const order = { in: 0, pre: 1, post: 2 };
    for (const dr of e.draws.map(d => ({ ...d, matches: [...d.matches].sort((a, b) => order[a.status.state] - order[b.status.state] || String(a.start).localeCompare(String(b.start))) }))) {
      s.body.append(
        el('h3', { class: 'section-h' }, [zhLater(dr.name)]),
        el(
          'div',
          { class: 'bouts' },
          dr.matches.map(m =>
            el('div', { class: `q-card pad bout${m.status.state === 'in' ? ' live' : ''}` }, [
              el('div', { class: 'bout-top' }, [el('small', { class: 'muted' }, joinNodes([zhLater(m.round), statusText({ ...e, start: m.start, status: m.status })], ' · ')), pairChip(e, m.start || e.start, m.a, m.b, m.status)]),
              ...[m.a, m.b].filter(Boolean).map(p => el('div', { class: `draw-row${p.winner ? ' win' : ''}` }, [logo(p.logo, p.name, 'sm round'), personName(e.league, p), el('span', { class: 'num sets', text: p.lines.join(' ') })]))
            ])
          )
        )
      );
    }
  }
  s.body.append(twCard(e.league, e));
}

// ---- A team -------------------------------------------------------------------------------

export async function openTeam(league, id, fallback = {}) {
  if (!id || !hasTeams(league)) return;
  const s = sheet(leagueName(league, L()), { league });
  const content = el('div', {}, [spinner()]);
  s.body.append(content);
  ctx.track(null, [teamKey(league, fallback.name || ''), `league:${leagueKey(league)}`].filter(k => !k.endsWith(':')), 1.5);
  try {
    const [info, sched, groups] = await Promise.all([team(league, id), teamSchedule(league, id).catch(() => []), hasStandings(league) ? standings(league).catch(() => null) : null]);
    const now = Date.now();
    const past = sched.filter(x => x.status.state === 'post').slice(-6).reverse();
    const next = sched.filter(x => x.status.state !== 'post' && Date.parse(x.start) > now - 4 * 3_600_000).slice(0, 5);
    const side = { id: info.id, name: info.name, logo: info.logo };
    const followBtn = el('button', { class: 'q-btn', type: 'button' });
    const paintFollow = () => {
      const on = ctx.isFollowed(league, id);
      followBtn.textContent = on ? `✓ ${T('following')}` : `+ ${T('follow')}`;
      followBtn.classList.toggle('primary', !on);
    };
    followBtn.addEventListener('click', () => (ctx.toggleFollow(league, side), paintFollow()));
    paintFollow();
    const place = placeOf(groups, id);
    // A club in several competitions: each game says which.
    const comps = new Set(sched.map(x => x.other || x.league)).size > 1;
    const rosterBox = el('div');
    put(
      content,
      el('div', { class: 'team-head' }, [logo(info.logo, info.name, 'xl'), el('div', {}, [el('h3', { text: info.name }), el('p', { class: 'muted', text: [info.record, info.standing].filter(Boolean).join(' · ') })]), followBtn]),
      place ? el('div', { class: 'team-tiles' }, [tile(T('standing'), T('placeN', { n: place.pos }), place.group), ...Object.entries(place.row.stats).filter(([k]) => ['W', 'L', 'D', 'P', 'PCT', 'GB', 'GD', 'PTS', 'STRK'].includes(k)).slice(0, 5).map(([k, v]) => tile(k, v))]) : null,
      next.length ? el('h3', { class: 'section-h', text: T('schedule') }) : null,
      next.length ? el('div', { class: 'q-card list' }, next.map(x => eventRow(x, { league: comps }))) : null,
      past.length ? el('h3', { class: 'section-h', text: T('lastGames') }) : null,
      past.length ? el('div', { class: 'q-card list' }, past.map(x => eventRow(x, { league: comps }))) : null,
      el('h3', { class: 'section-h', text: T('roster') }),
      rosterBox
    );
    rosterBox.append(spinner());
    roster(league, id, info.home)
      .then(list =>
        put(
          rosterBox,
          list.map(g =>
            el('div', { class: 'q-card pad fx-card' }, [
              g.name ? el('p', { class: 'mini-h', text: g.name }) : null,
              el('ul', { class: 'roster-list' }, g.players.map(p => el('li', {}, [el('span', { class: 'jersey num', text: p.jersey }), el('button', { class: 'link', type: 'button', text: p.name, onclick: () => ctx.openPlayer(league, p.id) }), el('small', { text: [p.pos, p.age ? `${p.age}` : ''].filter(Boolean).join(' · ') })])))
            ])
          )
        )
      )
      .catch(() => put(rosterBox, empty(T('failed'))));
  } catch {
    put(content, empty(T('failed')));
  }
}
const tile = (label, value, sub = '') => el('div', { class: 'stat-tile' }, [el('small', { text: label }), el('strong', { class: 'num', text: value }), sub ? el('small', { class: 'muted', text: sub }) : null]);

// ---- A player -----------------------------------------------------------------------------

// Individual sports (races, tours, fights): the person is followed like a team.
const individual = league => LEAGUES[league]?.kind !== 'match';

export async function openPlayer(league, id, fallback = {}) {
  if (!id) return;
  const s = sheet(leagueName(league, L()), { league });
  const content = el('div', {}, [spinner()]);
  s.body.append(content);
  try {
    const sport = LEAGUES[league]?.sport;
    // This season, from the league's own tables and results (ESPN's player
    // card has little for drivers and tennis players): the championship and
    // each race, the world ranking and the matches.
    const [a, ov, champ, races, rank, events] = await Promise.all([
      athlete(league, id),
      individual(league) ? athleteOverview(league, id).catch(() => null) : null,
      sport === 'racing' && LEAGUES[league].standings ? standings(league).then(g => driverSeason(g, id)).catch(() => null) : null,
      sport === 'racing' ? seasonEvents(league).catch(() => []) : null,
      sport === 'tennis' ? rankings(league).then(list => list.find(r => r.id === String(id)) || null).catch(() => null) : null,
      LEAGUES[league]?.kind === 'draw' || LEAGUES[league]?.kind === 'card' ? seasonEvents(league).catch(() => []) : null
    ]);
    const en = L() === 'en';
    const W = (zh, eng) => (en ? eng : zh);
    const driver = league === 'f1' ? f1Driver(a.name) : null;
    const facts = [
      [sport === 'racing' ? W('車隊', 'Team') : T('team'), a.team || driver?.team || ''],
      [T('country'), countryName(a.country, L())],
      [T('position'), zhLater(a.position)],
      [T('weightClass'), zhLater(a.weightClass)],
      [T('age'), a.age ? String(a.age) : ''],
      [T('height'), metric(a.height, L())],
      [T('weight'), metric(a.weight, L())],
      [T('hand'), zhLater(a.hand)],
      [T('stance'), zhLater(a.stance)],
      [T('turnedPro'), a.turnedPro ? String(a.turnedPro) : ''],
      [T('born'), dateText(a.dob, a.born, L())],
      [T('birthPlace'), zhLater(a.birthPlace)]
    ].filter(([, v]) => v);
    // Each race this season: where they finished (the race, else the sprint), latest first.
    const raceRows = (races || [])
      .flatMap(e => {
        const race = (e.sessions || []).find(x => x.abbr === 'Race' && x.status.state === 'post');
        const at = race ? race.field.findIndex(c => c.id === String(id)) : -1;
        return at >= 0 ? [{ name: e.name, start: race.start, pos: at + 1 }] : [];
      })
      .sort((x, y) => y.start.localeCompare(x.start));
    const nextRace = (races || []).find(e => e.status.state !== 'post' && Date.parse(e.end || e.start) > Date.now() - 86_400_000);
    const matches = playerMatches(events, id);
    const played = matches.filter(m => m.won != null);
    const upcoming = matches.filter(m => m.status?.state !== 'post' && !m.status?.void).reverse()[0];
    let followBtn = null;
    if (individual(league)) {
      followBtn = el('button', { class: 'q-btn', type: 'button' });
      const paintFollow = () => {
        const on = ctx.isFollowed(league, id);
        followBtn.textContent = on ? `✓ ${T('following')}` : `+ ${T('follow')}`;
        followBtn.classList.toggle('primary', !on);
      };
      followBtn.addEventListener('click', () => (ctx.toggleFollow(league, { id, name: a.name || fallback.name, logo: a.headshot || fallback.logo, athlete: true }), paintFollow()));
      paintFollow();
    }
    const name = driver && !en && driver.zh !== a.name ? `${driver.zh}` : a.name;
    const sub = [zhLater(a.position || a.weightClass), a.team || driver?.team || countryName(a.country, L()), a.record].filter(Boolean);
    const year = new Date().getFullYear();
    put(
      content,
      el('div', { class: 'team-head' }, [
        (league === 'f1' ? driverLogo : logo)(a.headshot || fallback.logo, a.name, 'xl round'),
        el('div', { class: 'team-head-text' }, [el('h3', { text: `${name}${a.jersey ? ` #${a.jersey}` : ''}` }), name !== a.name ? el('small', { class: 'muted', text: a.name }) : null, el('p', { class: 'muted' }, joinNodes(sub, ' · '))]),
        followBtn
      ]),
      champ
        ? card(
            W(`${year} 車手積分榜`, `${year} drivers' championship`),
            el('div', { class: 'stat-grid' }, [tile(W('排名', 'Place'), T('placeN', { n: champ.pos }), W(`共 ${champ.of} 位`, `of ${champ.of}`)), tile(W('積分', 'Points'), champ.points), champ.pos > 1 && champ.gap ? tile(W('落後領先者', 'Behind the leader'), champ.gap) : null, tile(W('完成站數', 'Races'), String(champ.races.length))].filter(Boolean))
          )
        : null,
      rank ? card(W('世界排名', 'World ranking'), el('div', { class: 'stat-grid' }, [tile(W('排名', 'Rank'), `#${rank.rank}`, rank.previous && rank.previous !== rank.rank ? `${rank.previous > rank.rank ? '▲' : '▼'} ${Math.abs(rank.previous - rank.rank)}` : ''), tile(W('積分', 'Points'), Number(rank.points).toLocaleString(en ? 'en-US' : 'zh-TW'))])) : null,
      nextRace ? card(W('下一站', 'Next race'), el('p', { class: 'series-text', text: [nextRace.name, whenText(nextRace.start)].filter(Boolean).join(' · ') })) : null,
      upcoming ? card(W('下一場', 'Next match'), el('p', { class: 'series-text' }, joinNodes([upcoming.event, zhLater(upcoming.round), upcoming.opp?.name ? `vs ${upcoming.opp.name}` : '', upcoming.start ? whenText(upcoming.start) : ''], ' · '))) : null,
      raceRows.length
        ? card(
            W('本季各站正賽', 'This season, race by race'),
            el('ul', { class: 'info-list results' }, raceRows.map(r => el('li', {}, [el('span', { class: 'info-k', text: r.name }), el('span', { class: `info-v num pos-pill${r.pos <= 3 ? ' podium' : ''}`, text: `P${r.pos}` })])))
          )
        : null,
      played.length
        ? card(
            W('近期比賽', 'Recent matches'),
            el(
              'ul',
              { class: 'info-list results' },
              played.slice(0, 8).map(m => el('li', {}, [el('span', { class: 'info-k' }, [el('span', { text: `vs ${m.opp?.name || ''}` }), el('small', { class: 'muted' }, joinNodes([m.event, zhLater(m.round)], ' · '))]), el('span', { class: `info-v num result-pill ${m.won ? 'w' : 'l'}`, text: `${m.won ? W('勝', 'W') : W('負', 'L')}${m.score ? ` ${m.score}` : ''}` })]))
            )
          )
        : null,
      a.stats.list.length ? card(statsTitle(a.stats.title, L()) || T('season'), el('div', { class: 'stat-grid' }, a.stats.list.map(x => tile(statName(x.label, L()), x.value, x.rank)))) : null,
      ov?.fight ? card(statsTitle(ov.fight.title, L()) || T('nextEvent'), el('p', { class: 'series-text', text: [ov.fight.name, ov.fight.date ? whenText(ov.fight.date) : '', ov.fight.where].filter(Boolean).join(' · ') })) : null,
      ov?.season
        ? card(
            statsTitle(ov.season.title, L()) || T('season'),
            el('div', { class: 'stack' }, ov.season.rows.map(r => el('div', {}, [el('p', { class: 'mini-h', text: r.name }), el('div', { class: 'stat-grid' }, r.cells.map(c => tile(statName(c.label, L()), c.value)))])))
          )
        : null,
      ov?.rankings?.length ? card(T('rankings'), el('div', { class: 'stat-grid' }, ov.rankings.map(x => tile(statName(x.label, L()), x.value, x.rank)))) : null,
      ov?.recent?.length ? card(T('recentEvents'), el('ul', { class: 'info-list' }, ov.recent.map(x => el('li', {}, [el('span', { class: 'info-k', text: x.name }), el('span', { class: 'info-v num', text: [x.place, x.score].filter(Boolean).join(' · ') || dayLabel(localDate(Date.parse(x.date))) })])))) : null,
      facts.length ? card(T('profile'), el('ul', { class: 'info-list' }, facts.map(([k, v]) => el('li', {}, [el('span', { class: 'info-k', text: k }), el('span', { class: 'info-v' }, [v])])))) : null,
      a.teamId && !individual(league) ? el('button', { class: 'q-btn block', type: 'button', text: a.team, onclick: () => openTeam(league, a.teamId, { name: a.team }) }) : null
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
  const ZH_COL = { GP: '場', W: '勝', D: '和', T: '和', L: '敗', GD: '淨勝', P: '積分', PTS: '積分', PCT: '勝率', GB: '勝差', STRK: '連勝敗', OTL: '延敗', GAP: '落後' };
  const colName = c => (L() === 'en' ? (c === 'GAP' ? T('col_GAP') : c) : ZH_COL[c] || c);
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
                    el('button', { class: 'link team-link', type: 'button', onclick: () => (r.athlete ? r.id && ctx.openPlayer(league, r.id, r) : r.id && openTeam(league, r.id, r)) }, [logo(r.logo, r.name, `xs${r.athlete ? ' round' : ''}`), el('span', { class: 'nm' }, name)])
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
