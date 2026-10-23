// Every league's playoffs (or a cup's knockout rounds) as one model for the
// 季後賽 view: the rounds in order, each with its dates and state, and its
// ties: real ones from the games (bracket.mjs), predicted ones from the
// table while the season's still on, or last season's when this one hasn't
// begun. Pure: app.js reads the games, table and calendar and hands them in.
//
//   playoffModel({ league, mode, events, groups, stages, season, now })
//     -> { mode: 'live' | 'projected' | 'last', season, rounds: [{ key, title, dates, state, ties }] }
//   a predicted tie: { projected: true, sides: [side | null, side | null], seeds: [n, n], labels: ['', '8/9 勝者'] }
import { buildBracket, undecided } from './bracket.mjs';

const R = (key, zh, en, n) => ({ key, zh, en, n });
const CUP = [R('knockout-round-playoffs', '淘汰附加賽', 'Knockout playoffs', 8), R('round-of-16', '16 強', 'Round of 16', 8), R('quarterfinals', '八強', 'Quarterfinals', 4), R('semifinals', '準決賽', 'Semifinals', 2), R('final', '決賽', 'Final', 1)];
// Each league's rounds (its games' round keys), and how its first rounds
// come from the table (`project`: groups -> { roundKey: [predicted tie] }).
export const FORMATS = {
  mlb: {
    rounds: [R('RD16', '外卡賽', 'Wild Card', 4), R('QTR', '分區系列賽', 'Division Series', 4), R('SEMI', '聯盟冠軍賽', 'LCS', 2), R('FINAL', '世界大賽', 'World Series', 1)],
    // Each league: seeds 4 v 5 and 3 v 6; 1 and 2 wait in the Division Series (4/5's beside 1).
    project: g => leagues2(g).reduce((o, rows) => ({ RD16: [...(o.RD16 || []), pair(rows, 4, 5), pair(rows, 3, 6)], QTR: [...(o.QTR || []), waits(rows, 1, '4/5'), waits(rows, 2, '3/6')] }), {})
  },
  nba: {
    rounds: [R('PLAYIN', '附加賽', 'Play-In', 4), R('PLAYIN2', '第八種子戰', '8th Seed Game', 2), R('RD16', '首輪', 'First Round', 8), R('QTR', '分區準決賽', 'Conf. Semifinals', 4), R('SEMI', '分區冠軍賽', 'Conf. Finals', 2), R('FINAL', '總冠軍賽', 'NBA Finals', 1)],
    // Each conference: the play-in (7 v 8, 9 v 10, then 7/8's loser v 9/10's
    // winner), then 1 v 8, 4 v 5, 3 v 6, 2 v 7: the 7 and 8 places the
    // play-in's winners' (its games beside them: mergePlayIn).
    project: g => ({
      PLAYIN: leagues2(g).flatMap(rows => [pair(rows, 7, 8), pair(rows, 9, 10)]),
      PLAYIN2: leagues2(g).map(() => ({ projected: true, sides: [null, null], seeds: [0, 0], labels: ['7/8 敗者', '9/10 勝者'] })),
      RD16: leagues2(g).flatMap(rows => [{ ...waits(rows, 1, ''), seeds: [1, 8], labels: ['', '附加賽'] }, pair(rows, 4, 5), pair(rows, 3, 6), { ...waits(rows, 2, '7/8'), seeds: [2, 7] }])
    })
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
  // The challenge (best of five, the half champion a win given) and the
  // Taiwan Series against the better half champion, who waits (espn.mjs cpblSeeds).
  cpbl: {
    rounds: [R('challenge', '季後挑戰賽', 'Playoff Challenge', 1), R('final', '台灣大賽', 'Taiwan Series', 1)],
    project: (g, seeds) => {
      const club = cpblClub(g);
      if (!seeds?.direct) return {};
      return {
        challenge: [{ projected: true, sides: [club(seeds.given), club(seeds.rival)], seeds: [0, 0], labels: [seeds.given ? '一勝優勢' : '', ''] }],
        final: [{ projected: true, sides: [club(seeds.direct), null], seeds: [0, 0], labels: ['', '挑戰賽勝者'] }]
      };
    },
    // The Taiwan Series before it's drawn: the club waiting in it, and the challenge's winner (or both its sides).
    fill: (rounds, g, seeds) => {
      const [ch, fin] = ['challenge', 'final'].map(k => rounds.find(r => r.key === k));
      if (!fin || fin.ties.some(Boolean) || !seeds?.direct) return;
      const t = ch?.ties.find(x => x && !x.projected);
      const waiting = t?.sides.find(x => String(x.id) === seeds.direct) ? null : cpblClub(g)(seeds.direct);
      if (!waiting) return;
      const won = t?.winner ? t.sides.find(x => String(x.id) === t.winner) : null;
      fin.ties = [
        t
          ? { id: 'final|pending|0', round: 'final', title: '', pending: true, kind: 'pending', sides: [waiting, won], options: [null, won ? null : t.sides], score: {}, winner: null, live: false, next: null, games: [] }
          : { projected: true, sides: [waiting, null], seeds: [0, 0], labels: ['', '挑戰賽勝者'] }
      ];
    }
  },
  facup: { rounds: [R('third-round', '第三輪', 'Third Round', 32), R('fourth-round', '第四輪', 'Fourth Round', 16), R('fifth-round', '第五輪', 'Fifth Round', 8), R('quarterfinals', '八強', 'Quarterfinals', 4), R('semifinals', '準決賽', 'Semifinals', 2), R('final', '決賽', 'Final', 1)] },
  worldcup: { rounds: [R('round-of-32', '32 強', 'Round of 32', 16), R('round-of-16', '16 強', 'Round of 16', 8), R('quarterfinals', '八強', 'Quarterfinals', 4), R('semifinals', '準決賽', 'Semifinals', 2), R('final', '決賽', 'Final', 1)] }
};
// A CPBL club as the table has it (any of its halves).
const cpblClub = groups => en => {
  const row = en && (groups || []).flatMap(x => x.rows || []).find(r => r.id === en || r.en === en);
  return row ? side(row, 0) : null;
};
const side = (row, seed) => (row ? { id: row.id, name: row.name, short: row.short || row.name, abbr: row.abbr || '', logo: row.logo, seed } : null);
// The two conferences / leagues of a table, each in seed order.
// (MLB's table is by division: each league's divisions read together, by the seeds ESPN gives.)
const leagues2 = groups => bySeed(groups).filter(g => g.rows?.length >= 6).slice(0, 2).map(g => g.rows);
// How a league by division makes its playoffs (Jay, 2026-10-23: the
// division tables alone didn't say): each league's six seeds, the three
// division leaders then the three wild cards, and the next sides out, with
// the games each is ahead of (+) or behind the last wild card. And the
// divisions' own rows marked the same (a bar: 分區第一, 外卡).
// MLB's: 3 division leaders, 3 wild cards a league.
const PICTURE = { mlb: { leaders: 3, cards: 3, more: 3 } };
const PICTURE_COLOR = { lead: '#81D6AC', card: '#6CA6F0' };
export function seedPicture(groups, league, lang = 'zh') {
  const f = PICTURE[league];
  if (!f || !(groups || []).some(g => g.parent)) return { picture: [], divisions: groups || [] };
  const en = lang === 'en';
  const seeds = f.leaders + f.cards;
  const zone = seed => (!seed || seed > seeds ? null : seed <= f.leaders ? { note: en ? 'Division leader' : '分區第一', color: PICTURE_COLOR.lead } : { note: en ? 'Wild card' : '外卡', color: PICTURE_COLOR.card });
  const marked = r => ({ ...r, ...(zone(r.seed) || { note: '', color: '' }) });
  const divisions = groups.map(g => (g.parent ? { ...g, rows: g.rows.map(marked) } : g));
  const half = x => (Number.isInteger(x) ? String(x) : x.toFixed(1));
  const picture = bySeed(groups)
    .filter(g => g.rows.length > seeds && g.rows.every(r => r.seed))
    .map(g => {
      const last = g.rows[seeds - 1];
      const [w0, l0] = [Number(last.stats.W), Number(last.stats.L)];
      const rows = g.rows.slice(0, seeds + f.more).map((r, i) => {
        const gb = (w0 - Number(r.stats.W) + (Number(r.stats.L) - l0)) / 2;
        const GB = i < f.leaders ? '' : i === seeds - 1 || gb === 0 ? '-' : gb < 0 ? `+${half(-gb)}` : half(gb);
        return { ...marked(r), stats: { ...r.stats, GB } };
      });
      const name = en ? `${g.name} playoff picture` : `${{ 'American League': '美聯', 'National League': '國聯' }[g.name] || g.name}季後賽席次`;
      return { name, en: g.name, rows, picture: true };
    });
  return { picture, divisions };
}
export function bySeed(groups) {
  if (!(groups || []).some(g => g.parent)) return groups || [];
  const out = [];
  for (const g of groups) {
    const at = out.find(x => x.name === (g.parent || g.name));
    if (at) at.rows.push(...g.rows);
    else out.push({ name: g.parent || g.name, rows: [...g.rows] });
  }
  for (const g of out) g.rows = g.rows.map((r, i) => [r, i]).sort((x, y) => (x[0].seed || 99) - (y[0].seed || 99) || x[1] - y[1]).map(([r]) => r);
  return out;
}
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

// `startsAfter`: the regular season's last day (ms), for a first round no calendar dates yet (about 3 days after it).
export function playoffModel({ league, mode = 'live', events = [], groups = null, seeds = null, stages = [], season = '', startsAfter = 0, now = Date.now() }) {
  const fmt = FORMATS[league] || null;
  const shape = fmt?.rounds?.map(r => [r.key, r.zh, r.en, r.n]);
  // Only the rounds the view shows (a cup's early rounds, before its third, left out).
  const shown = shape ? events.filter(e => shape.some(r => r[0] === e.round?.key)) : events;
  let rounds = buildBracket(shown, league, { shape });
  if (!rounds.length && shape) rounds = shape.map(([key, zh, en, n]) => ({ key, title: { zh, en }, ties: Array(n).fill(null) }));
  // The table's prediction in the rounds it decides.
  if (mode === 'projected' && fmt?.project) {
    const p = fmt.project(groups, seeds) || {};
    for (const r of rounds) if (p[r.key]?.length && r.ties.every(t => !t)) r.ties = p[r.key];
  }
  if (mode !== 'projected') fmt?.fill?.(rounds, groups, seeds);
  mergePlayIn(rounds);
  alignFeeders(rounds);
  // Each round's dates: its games' (games not drawn yet count too), else the calendar's stage.
  for (const r of rounds) {
    const games = events.filter(e => (r.keys || [r.key]).includes(e.round?.key));
    const stage = stages.find(s => stageKey(s.label) === r.key);
    const times = games.map(e => Date.parse(e.start)).filter(Number.isFinite);
    r.dates = times.length ? { from: Math.min(...times), to: Math.max(...times) } : stage?.start ? { from: Date.parse(stage.start), to: Date.parse(stage.end) - 1 } : null;
    if (!r.dates && r === rounds[0] && startsAfter) r.dates = { from: startsAfter + 3 * 86_400_000, to: startsAfter + 3 * 86_400_000, about: true };
    const real = r.ties.filter(t => t && !t.projected && !t.gap);
    const live = real.some(t => t.live) || games.some(e => e.status?.state === 'in' && !undecided(e.home) && !undecided(e.away));
    const done = real.length === r.ties.filter(t => !t?.gap).length && real.length > 0 && real.every(t => t.winner);
    r.state = live ? 'live' : done ? 'done' : real.length || (r.dates && r.dates.from <= now) ? 'on' : 'later';
  }
  return { mode, season, rounds };
}

// The NBA's play-in in the bracket itself (Jay, 2026-10-23: two graphs
// read as two things, when one leads to the other), one column before the
// first round, each game beside where its winner goes. Each conference's
// first round put 3 v 6, 2 v 7, 1 v 8, 4 v 5 (2 v 7 and 1 v 8 side by
// side, each with its pair), the play-in beside them read from the top:
// an empty row, 7 v 8 (by the 2 v 7), the 8th seed game (by the 1 v 8 it
// feeds), 9 v 10. 9 v 10's winner and 7 v 8's loser go to the 8th seed game between
// them in the same column, a short line each (`feeds`: [{ to: [round, tie] }],
// drawn by app.js).
// (Drawn as two columns, 2026-10-21, it was mostly empty rows; apart, it
// stood on its own.)
export function mergePlayIn(rounds) {
  const [a, b, first] = ['PLAYIN', 'PLAYIN2', 'RD16'].map(k => rounds.find(r => r.key === k));
  if (!a || !b || !first) return;
  const halves = ['東區', '西區'];
  const ids = t => (t && !t.gap ? [...(t.sides || []), ...(t.options || []).flat()].filter(Boolean).map(s => String(s.id)) : []);
  const per = Math.max(1, Math.floor(first.ties.length / 2));
  // A conference: its tie's own half, else the first round's (the table's order, East first), else its place in the list.
  const blockOf = (t, i, each) => {
    if (t?.half) return Math.max(0, halves.indexOf(t.half));
    const j = first.ties.findIndex(x => ids(x).some(id => ids(t).includes(id)));
    return j >= 0 ? Math.floor(j / per) : Math.floor(i / each);
  };
  const nine = t => /9th|9\/10/i.test(t?.games?.[0]?.note || '') || t?.seeds?.[0] === 9;
  const groups = [0, 1].map(c => {
    const pa = a.ties.filter((t, i) => t && !t.gap && blockOf(t, i, Math.max(1, a.ties.length / 2)) === c);
    return {
      seven: pa.find(t => !nine(t)) ?? null,
      ten: pa.find(t => nine(t)) ?? null,
      eighth: b.ties.find((t, i) => t && !t.gap && blockOf(t, i, Math.max(1, b.ties.length / 2)) === c) ?? null
    };
  });
  const ties = [];
  const links = [];
  groups.forEach((g, c) => {
    const block = first.ties.slice(c * per, (c + 1) * per);
    // The first round's tie a play-in game feeds: one holding its sides
    // (its winner, or both still playing for the place), else its seed's
    // place (a prediction), else the one with a side to come.
    const fedBy = (t, seed, not = -1) => {
      const won = t?.winner;
      let j = won ? block.findIndex(x => ids(x).includes(won)) : -1;
      if (j < 0 && t) j = block.findIndex((x, k) => k !== not && x?.options?.some(o => o && ids(t).some(id => ids({ sides: o }).includes(id))));
      if (j < 0) j = block.findIndex((x, k) => k !== not && x?.seeds?.[1] === seed);
      if (j < 0) j = block.findIndex((x, k) => k !== not && x && x.sides?.some(s => !s));
      return j;
    };
    let f7 = fedBy(g.seven, 7);
    let f8 = fedBy(g.eighth, 8, f7);
    if (f8 < 0 || f8 === f7) f8 = f7 === 0 ? per - 1 : 0;
    if (f7 < 0 || f7 === f8) f7 = f8 === 0 ? per - 1 : 0;
    const pairOf = j => Math.floor(j / 2);
    const order = [...block.keys()];
    if (per === 4 && pairOf(f7) !== pairOf(f8)) {
      // 7 v 8's pair on top, 7 v 8's tie on its lower row; the 8th seed
      // game's pair under it, its tie on its upper row: the two side by
      // side, the play-in read from the top (Jay, 2026-10-23: "flip it").
      const pair = j => [pairOf(j) * 2, pairOf(j) * 2 + 1];
      const [p7, p8] = [pair(f7), pair(f8)];
      order.splice(0, 4, p7.find(j => j !== f7), f7, f8, p8.find(j => j !== f8));
      // The pairs swapped: the next round's two ties of this conference too.
      const next = rounds[rounds.indexOf(first) + 1];
      if (pairOf(f7) === 1 && next?.ties.length === first.ties.length / 2) {
        const at = c * (per / 2);
        [next.ties[at], next.ties[at + 1]] = [next.ties[at + 1], next.ties[at]];
      }
      [f7, f8] = [1, 2];
    }
    const placed = order.map(j => block[j]);
    first.ties.splice(c * per, per, ...placed);
    // The play-in's column: 7 v 8, the 8th seed game, 9 v 10 under it.
    const col = Array.from({ length: per }, () => ({ gap: true }));
    const up = f8 < f7;
    const ten = up ? f8 - 1 : f8 + 1;
    const seat = (t, j, fallback) => (j >= 0 && j < per ? (col[j] = t || fallback) : null);
    seat(g.eighth, f8, { projected: true, sides: [null, null], seeds: [0, 0], labels: ['7/8 敗者', '9/10 勝者'] });
    seat(g.seven, f7, null);
    seat(g.ten, ten >= 0 && ten < per && ten !== f7 ? ten : -1, null);
    // (Each place an object of its own to hang its lines on: a game not drawn yet an empty card.)
    for (let j = 0; j < per; j++) if (col[j] === null) col[j] = { pending: true, kind: 'pending', sides: [null, null], options: [null, null], score: {}, winner: null, live: false, next: null, games: [] };
    // The 8th seed game not drawn yet: who it'll be, by the teams
    // (7 v 8's loser once it's played, else both its logos and 敗者; 9 v
    // 10's winner the same), not "7/8 敗者".
    const e8 = col[f8];
    if (e8 && !e8.gap && !e8.games?.length) {
      const known = [g.seven, g.ten].map(t => (t?.sides?.every(Boolean) ? t : null));
      const loser = known[0]?.winner ? known[0].sides.find(x => String(x.id) !== known[0].winner) : null;
      const winner = known[1]?.winner ? known[1].sides.find(x => String(x.id) === known[1].winner) : null;
      Object.assign(e8, { sides: [loser, winner], options: [loser ? null : known[0]?.sides || null, winner ? null : known[1]?.sides || null], optionWords: [{ zh: '敗者', en: 'loser' }, { zh: '勝者', en: 'winner' }] });
    }
    // The 2 v 7's 7 the same way while 7 v 8's on: its two logos and 勝者.
    const t7 = first.ties[c * per + f7];
    const k7 = t7 && !t7.gap && t7.sides ? t7.sides.findIndex(x => !x) : -1;
    if (k7 >= 0 && !t7.options?.[k7] && g.seven?.sides?.every(Boolean) && !g.seven.winner) {
      t7.options = [0, 1].map(k => (k === k7 ? g.seven.sides : t7.options?.[k] || null));
      t7.optionWords = [0, 1].map(k => (k === k7 ? { zh: '勝者', en: 'winner' } : null));
    }
    // What each game means, on its card till it's decided.
    const means = (t, zh, en) => t && !t.gap && (t.outcome = { zh, en });
    means(g.seven || col[f7], '勝者 7 種子・敗者再戰', 'W: 7 seed · L: again');
    means(col[ten], '勝者再戰・敗者淘汰', 'W: again · L: out');
    means(e8, '勝者 8 種子・敗者淘汰', 'W: 8 seed · L: out');
    const base = c * per;
    if (col[f8] && !col[f8].gap) col[f8].roundTitle = { zh: '第八種子戰', en: '8th Seed Game' };
    links.push([col[f7], [{ to: [1, base + f7] }, { to: [0, base + f8] }]], [col[f8], [{ to: [1, base + f8] }]]);
    if (ten >= 0 && ten < per && ten !== f7) links.push([col[ten], [{ to: [0, base + f8] }]]);
    ties.push(...col);
  });
  // The column's lines, once it's in place (its round first).
  for (const [t, feeds] of links) if (t && !t.gap) t.feeds = feeds;
  const merged = { key: 'PLAYIN', keys: ['PLAYIN', 'PLAYIN2'], title: a.title, ties };
  rounds.splice(0, rounds.length, merged, ...rounds.filter(r => r !== a && r !== b));
}
// A round of fewer ties than the next (MLS's wild card, 8 v 9 for the 1
// seed's place): each tie beside the one it feeds, the rows between empty,
// so its line runs straight across.
function alignFeeders(rounds) {
  const ids = t => (t && !t.gap ? [...(t.sides || []), ...(t.options || []).flat()].filter(Boolean).map(s => String(s.id)) : []);
  for (let i = 0; i + 1 < rounds.length; i++) {
    const [r, next] = [rounds[i], rounds[i + 1]];
    if (r.keys || r.ties.length >= next.ties.length || r.ties.some(t => !t)) continue;
    // (Each conference's "8/9 勝者" the same words: the first not taken, in order.)
    const at = [];
    for (const t of r.ties) {
      const key = t.seeds?.every(Boolean) ? `${t.seeds.join('/')} 勝者` : '';
      const j = next.ties.findIndex((x, k) => !at.includes(k) && ids(x).some(id => ids(t).includes(id)));
      at.push(j >= 0 ? j : key ? next.ties.findIndex((x, k) => !at.includes(k) && x?.labels?.includes(key)) : -1);
    }
    if (at.some(j => j < 0) || new Set(at).size < at.length) continue;
    const col = next.ties.map(() => ({ gap: true }));
    r.ties.forEach((t, k) => (col[at[k]] = t));
    r.ties = col;
  }
}
// The round to open on: the one on now, else the next unfinished, else the last.
export const openRound = model => model.rounds.findIndex(r => r.state === 'live') + 1 || model.rounds.findIndex(r => r.state !== 'done') + 1 || model.rounds.length;
