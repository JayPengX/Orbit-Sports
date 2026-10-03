// Every league's playoffs (or a cup's knockout rounds) as one model for the
// 季後賽 view: the rounds in order, each with its dates and state, and its
// ties: real ones from the games (bracket.mjs), predicted ones from the
// table while the season's still on, or last season's when this one hasn't
// begun. Pure: app.js reads the games, table and calendar and hands them in.
//
//   playoffModel({ league, mode, events, groups, stages, season, now })
//     -> { mode: 'live' | 'projected' | 'last', season, rounds: [{ key, title, dates, state, ties }] }
//   a predicted tie: { projected: true, sides: [side | null, side | null], seeds: [n, n], labels: ['', '8/9 勝者'] }
import { buildBracket } from './bracket.mjs';

const R = (key, zh, en, n) => ({ key, zh, en, n });
const CUP = [R('knockout-round-playoffs', '淘汰附加賽', 'Knockout playoffs', 8), R('round-of-16', '16 強', 'Round of 16', 8), R('quarterfinals', '八強', 'Quarterfinals', 4), R('semifinals', '準決賽', 'Semifinals', 2), R('final', '決賽', 'Final', 1)];
// Each league's rounds (its games' round keys), and how its first rounds
// come from the table (`project`: groups -> { roundKey: [predicted tie] }).
export const FORMATS = {
  mlb: {
    rounds: [R('RD16', '外卡賽', 'Wild Card', 4), R('QTR', '分區系列賽', 'Division Series', 4), R('SEMI', '聯盟冠軍賽', 'LCS', 2), R('FINAL', '世界大賽', 'World Series', 1)],
    // Each league: seeds 3 v 6 and 4 v 5; 1 and 2 wait in the Division Series.
    project: g => leagues2(g).reduce((o, rows) => ({ RD16: [...(o.RD16 || []), pair(rows, 3, 6), pair(rows, 4, 5)], QTR: [...(o.QTR || []), waits(rows, 1, '4/5'), waits(rows, 2, '3/6')] }), {})
  },
  nba: {
    rounds: [R('RD16', '首輪', 'First Round', 8), R('QTR', '分區準決賽', 'Conf. Semifinals', 4), R('SEMI', '分區冠軍賽', 'Conf. Finals', 2), R('FINAL', '總冠軍賽', 'NBA Finals', 1)],
    // Each conference: 1 v 8, 4 v 5, 3 v 6, 2 v 7 (7 and 8 through the play-in).
    project: g => ({ RD16: leagues2(g).flatMap(rows => [pair(rows, 1, 8, ['', '附加賽']), pair(rows, 4, 5), pair(rows, 3, 6), pair(rows, 2, 7, ['', '附加賽'])]) })
  },
  mls: {
    rounds: [R('wildcard', '外卡賽', 'Wild Card', 2), R('round-one', '首輪', 'Round One', 8), R('conf-semis', '分區準決賽', 'Conf. Semifinals', 4), R('conf-finals', '分區冠軍賽', 'Conf. Finals', 2), R('final', 'MLS 盃決賽', 'MLS Cup', 1)],
    // Each conference: 8 v 9 for the last place; 1 v that winner, 4 v 5, 3 v 6, 2 v 7.
    project: g => leagues2(g).reduce((o, rows) => ({ wildcard: [...(o.wildcard || []), pair(rows, 8, 9)], 'round-one': [...(o['round-one'] || []), waits(rows, 1, '8/9'), pair(rows, 4, 5), pair(rows, 3, 6), pair(rows, 2, 7)] }), {})
  },
  // The league phase: 9-24 play off for the last 8 places (9 v 24, 10 v 23…, as the draw's pots pair them); 1-8 wait.
  ucl: { rounds: CUP, project: g => cupProject(g) },
  uel: { rounds: CUP, project: g => cupProject(g) },
  uecl: { rounds: CUP, project: g => cupProject(g) },
  // League A's group winners and runners-up to the quarterfinals (winners v another group's runners-up).
  nationsleague: {
    rounds: [R('quarterfinals', '八強', 'Quarterfinals', 4), R('semifinals', '準決賽', 'Semifinals', 2), R('final', '決賽', 'Final', 1)],
    project: g => {
      const groups = (g || []).filter(x => /^group a\d/i.test(x.en || x.name));
      if (groups.length < 4) return {};
      const t = (i, k) => side(groups[i].rows[k], k + 1);
      // Each side's group by it ("A1 組"), its place as the seed.
      const name = i => (groups[i].en || groups[i].name).replace(/^group\s*/i, '');
      return { quarterfinals: [[0, 1], [1, 0], [2, 3], [3, 2]].map(([w, r]) => ({ projected: true, sides: [t(w, 0), t(r, 1)], seeds: [1, 2], labels: [`${name(w)} 組`, `${name(r)} 組`] })) };
    }
  },
  facup: { rounds: [R('third-round', '第三輪', 'Third Round', 32), R('fourth-round', '第四輪', 'Fourth Round', 16), R('fifth-round', '第五輪', 'Fifth Round', 8), R('quarterfinals', '八強', 'Quarterfinals', 4), R('semifinals', '準決賽', 'Semifinals', 2), R('final', '決賽', 'Final', 1)] },
  worldcup: { rounds: [R('round-of-32', '32 強', 'Round of 32', 16), R('round-of-16', '16 強', 'Round of 16', 8), R('quarterfinals', '八強', 'Quarterfinals', 4), R('semifinals', '準決賽', 'Semifinals', 2), R('final', '決賽', 'Final', 1)] }
};
const side = (row, seed) => (row ? { id: row.id, name: row.name, short: row.short || row.name, logo: row.logo, seed } : null);
// The two conferences / leagues of a table, each in seed order.
const leagues2 = groups => (groups || []).filter(g => g.rows?.length >= 6).slice(0, 2).map(g => g.rows);
const pair = (rows, a, b, labels = ['', '']) => ({ projected: true, sides: [side(rows[a - 1], a), side(rows[b - 1], b)], seeds: [a, b], labels });
const waits = (rows, a, from) => ({ projected: true, sides: [side(rows[a - 1], a), null], seeds: [a, 0], labels: ['', `${from} 勝者`] });
function cupProject(groups) {
  const rows = (groups || []).find(g => g.rows?.length >= 24)?.rows;
  if (!rows) return {};
  return {
    'knockout-round-playoffs': [9, 10, 11, 12, 13, 14, 15, 16].map(a => pair(rows, a, 33 - a)),
    'round-of-16': [1, 2, 3, 4, 5, 6, 7, 8].map(a => ({ projected: true, sides: [side(rows[a - 1], a), null], seeds: [a, 0], labels: ['', '附加賽勝者'] }))
  };
}
// A calendar stage's name as its round key ("Rd of 16" -> round-of-16).
export const stageKey = label =>
  String(label || '')
    .toLowerCase()
    .replace(/^rd of/, 'round of')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const tbd = s => /^tbd$/i.test(String(s?.short || s?.abbr || s?.name || '').trim()) || Number(s?.id) <= 0;

// `startsAfter`: the regular season's last day (ms), for a first round no calendar dates yet (about 3 days after it).
export function playoffModel({ league, mode = 'live', events = [], groups = null, stages = [], season = '', startsAfter = 0, now = Date.now() }) {
  const fmt = FORMATS[league] || null;
  const shape = fmt?.rounds?.map(r => [r.key, r.zh, r.en, r.n]);
  // Only the rounds the view shows (a cup's early rounds, before its third, left out).
  const shown = shape ? events.filter(e => shape.some(r => r[0] === e.round?.key)) : events;
  let rounds = buildBracket(shown, league, { shape });
  if (!rounds.length && shape) rounds = shape.map(([key, zh, en, n]) => ({ key, title: { zh, en }, ties: Array(n).fill(null) }));
  // The table's prediction in the rounds it decides.
  if (mode === 'projected' && fmt?.project) {
    const p = fmt.project(groups) || {};
    for (const r of rounds) if (p[r.key]?.length && r.ties.every(t => !t)) r.ties = p[r.key];
  }
  // Each round's dates: its games' (games not drawn yet count too), else the calendar's stage.
  for (const r of rounds) {
    const games = events.filter(e => e.round?.key === r.key);
    const stage = stages.find(s => stageKey(s.label) === r.key);
    const times = games.map(e => Date.parse(e.start)).filter(Number.isFinite);
    r.dates = times.length ? { from: Math.min(...times), to: Math.max(...times) } : stage?.start ? { from: Date.parse(stage.start), to: Date.parse(stage.end) - 1 } : null;
    if (!r.dates && r === rounds[0] && startsAfter) r.dates = { from: startsAfter + 3 * 86_400_000, to: startsAfter + 3 * 86_400_000, about: true };
    const real = r.ties.filter(t => t && !t.projected);
    const live = real.some(t => t.live) || games.some(e => e.status?.state === 'in' && !tbd(e.home) && !tbd(e.away));
    const done = real.length === r.ties.length && real.length > 0 && real.every(t => t.winner);
    r.state = live ? 'live' : done ? 'done' : real.length || (r.dates && r.dates.from <= now) ? 'on' : 'later';
  }
  return { mode, season, rounds };
}
// The round to open on: the one on now, else the next unfinished, else the last.
export const openRound = model => model.rounds.findIndex(r => r.state === 'live') + 1 || model.rounds.findIndex(r => r.state !== 'done') + 1 || model.rounds.length;
