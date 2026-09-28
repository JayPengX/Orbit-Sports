// Quadra Fixtures' sheets: a match (header, the way into Play, then its data
// by section), a race / tournament / fight card, a team, a player, and the
// standings tables they share with the Standings tab.
import { appUrl } from './lib/quadra.mjs';
import { summary, standings, team, teamSchedule, roster, athlete, athleteOverview, playGameId, STANDING_COLUMNS, COMPACT_COLUMNS, sessionName } from './lib/espn.mjs';
import { stageTag } from './lib/stage.mjs';
import { statName } from './lib/statnames.mjs';
import { broadcastsOf, CHECKED } from './lib/broadcast.mjs';
import { LEAGUES, leagueName, hasTeams, hasStandings } from './lib/leagues.mjs';
import { eventKeys, teamKey, leagueKey } from './lib/foryou.mjs';
import { ctx, el, put, spinner, empty, logo, clock, dayLabel, localDate, statusText, whenText, eventRow, sheet, segmented, seriesText } from './ui.js';

const L = () => ctx.locale;
const T = (k, v) => ctx.t(k, v);

// ---- A match ----------------------------------------------------------------------------

export async function openMatch(e) {
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
    const playId = playGameId(e);
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
      playId && e.status.state !== 'post' && !e.status.void
        ? el('a', { class: 'q-btn primary block play-link', href: appUrl('odds', `game=${playId}`), onclick: ev => (ev.preventDefault(), ctx.track('toPlay', eventKeys(e), 2), ctx.q.go('odds', `game=${playId}`)) }, [document.createTextNode(`🎟️ ${T('betInPlay')}`)])
        : null
    );
  };
  paintHeader(null);
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
    ['📺', T('tv'), broadcastsOf(e.league).map(b => (L() === 'en' ? b.en : b.zh)).join('、') || T('noTw')],
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
function twCard(league) {
  const list = broadcastsOf(league);
  return card(
    T('watchTw'),
    list.length ? el('div', { class: 'tw-list' }, list.map(b => el('span', { class: `tw-chip ${b.kind}`, text: L() === 'en' ? b.en : b.zh }))) : el('p', { class: 'muted small', text: T('noTw') }),
    { sub: CHECKED }
  );
}

export function openFieldEvent(e) {
  const s = sheet(leagueName(e.league, L()), { league: e.league });
  s.body.append(el('div', { class: 'q-card pad fx-card' }, [el('h3', { class: 'field-title', text: e.name }), el('p', { class: 'muted', text: [e.venue, whenText(e.start)].filter(Boolean).join(' · ') })]));
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
        ss.field.length ? el('ol', { class: 'field' }, ss.field.map((c, i) => el('li', { class: ctx.isFollowed(e.league, c.id) ? 'mine' : '' }, [el('span', { class: 'pos num', text: String(i + 1) }), logo(c.logo, c.name, 'sm round'), personName(e.league, c), c.score ? el('small', { class: 'num', text: c.score }) : null]))) : empty(T('noField'))
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
          el('div', { class: 'q-card pad bout' }, [
            el('small', { class: 'muted', text: [b.weight, statusText({ ...e, start: b.start, status: b.status })].filter(Boolean).join(' · ') }),
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
    for (const dr of e.draws) {
      s.body.append(
        el('h3', { class: 'section-h', text: dr.name }),
        el(
          'div',
          { class: 'bouts' },
          dr.matches.map(m =>
            el('div', { class: 'q-card pad bout' }, [
              el('small', { class: 'muted', text: [m.round, statusText({ ...e, start: m.start, status: m.status })].filter(Boolean).join(' · ') }),
              ...[m.a, m.b].filter(Boolean).map(p => el('div', { class: `draw-row${p.winner ? ' win' : ''}` }, [logo(p.logo, p.name, 'sm round'), personName(e.league, p), el('span', { class: 'num sets', text: p.lines.join(' ') })]))
            ])
          )
        )
      );
    }
  }
  s.body.append(twCard(e.league));
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
    const rosterBox = el('div');
    put(
      content,
      el('div', { class: 'team-head' }, [logo(info.logo, info.name, 'xl'), el('div', {}, [el('h3', { text: info.name }), el('p', { class: 'muted', text: [info.record, info.standing].filter(Boolean).join(' · ') })]), followBtn]),
      place ? el('div', { class: 'team-tiles' }, [tile(T('standing'), T('placeN', { n: place.pos }), place.group), ...Object.entries(place.row.stats).filter(([k]) => ['W', 'L', 'D', 'P', 'PCT', 'GB', 'GD', 'PTS', 'STRK'].includes(k)).slice(0, 5).map(([k, v]) => tile(k, v))]) : null,
      next.length ? el('h3', { class: 'section-h', text: T('schedule') }) : null,
      next.length ? el('div', { class: 'q-card list' }, next.map(x => eventRow(x, { league: false }))) : null,
      past.length ? el('h3', { class: 'section-h', text: T('lastGames') }) : null,
      past.length ? el('div', { class: 'q-card list' }, past.map(x => eventRow(x, { league: false }))) : null,
      el('h3', { class: 'section-h', text: T('roster') }),
      rosterBox
    );
    rosterBox.append(spinner());
    roster(league, id)
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
    const [a, ov] = await Promise.all([athlete(league, id), individual(league) ? athleteOverview(league, id).catch(() => null) : null]);
    const facts = [
      [T('team'), a.team],
      [T('country'), a.country],
      [T('position'), a.position],
      [T('weightClass'), a.weightClass],
      [T('age'), a.age ? String(a.age) : ''],
      [T('height'), a.height],
      [T('weight'), a.weight],
      [T('hand'), a.hand],
      [T('stance'), a.stance],
      [T('turnedPro'), a.turnedPro ? String(a.turnedPro) : ''],
      [T('born'), a.born],
      [T('birthPlace'), a.birthPlace]
    ].filter(([, v]) => v);
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
    const sub = [a.position || a.weightClass, a.team || a.country, a.record].filter(Boolean).join(' · ');
    put(
      content,
      el('div', { class: 'team-head' }, [logo(a.headshot || fallback.logo, a.name, 'xl round'), el('div', {}, [el('h3', { text: `${a.name}${a.jersey ? ` #${a.jersey}` : ''}` }), el('p', { class: 'muted', text: sub })]), followBtn]),
      a.stats.list.length ? card(a.stats.title || T('season'), el('div', { class: 'stat-grid' }, a.stats.list.map(x => tile(x.label, x.value, x.rank)))) : null,
      ov?.fight ? card(ov.fight.title || T('nextEvent'), el('p', { class: 'series-text', text: [ov.fight.name, ov.fight.date ? whenText(ov.fight.date) : '', ov.fight.where].filter(Boolean).join(' · ') })) : null,
      ov?.season
        ? card(
            ov.season.title || T('season'),
            el('div', { class: 'stack' }, ov.season.rows.map(r => el('div', {}, [el('p', { class: 'mini-h', text: r.name }), el('div', { class: 'stat-grid' }, r.cells.map(c => tile(c.label, c.value)))])))
          )
        : null,
      ov?.rankings?.length ? card(T('rankings'), el('div', { class: 'stat-grid' }, ov.rankings.map(x => tile(x.label, x.value, x.rank)))) : null,
      ov?.recent?.length ? card(T('recentEvents'), el('ul', { class: 'info-list' }, ov.recent.map(x => el('li', {}, [el('span', { class: 'info-k', text: x.name }), el('span', { class: 'info-v num', text: [x.place, x.score].filter(Boolean).join(' · ') || dayLabel(localDate(Date.parse(x.date))) })])))) : null,
      facts.length ? card(T('profile'), el('ul', { class: 'info-list' }, facts.map(([k, v]) => el('li', {}, [el('span', { class: 'info-k', text: k }), el('span', { class: 'info-v', text: v })])))) : null,
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
