// The NBA Cup: its group play and its knockout. ESPN keeps every cup game a
// regular-season game and says which only in its note ("NBA Cup - Group
// Play", "NBA Cup - Quarterfinals", "NBA Cup Championship"). The schedule
// says who's in which group: in group play each team meets the other four of
// its group once, so the games' pairings are the groups (five teams, three a
// conference). Their letters (East Group A) are ESPN's cup standings'
// (cupLetters), read beside the games; without them, drawn without letters.
//
//   nbaCupRound(event) -> { key: 'QF' | 'SF' | 'F', title, leg, through } | null
//   nbaCupGroups(games, { prev, letters, live }) -> [{ conf: 'East' | 'West', letter, rows: [{ id, name, short, abbr, logo, w, l, pd, pf, left, zone, fate, live, moved }], notes }]
//     zone: 'lead' (first in its group: the quarterfinals) | 'card' (the conference's best second: its wild card) | ''
//     fate: 'lead' (sure to win its group) | 'in' (sure of the quarterfinals, the wild card maybe) | 'out' (can't reach them) | ''
//     live: the games on now counted as they stand (Jay 2026-11-14, as the league's and F1's live tables):
//       a side playing its score ({ for, against }), `moved` its places up (+) or down (-) from the table without them
//   cupLetters(espnCupStandings) -> { teamId: 'A' }
//   cupStakes(games, e, opts) -> what a group game decides ({ kind, side, also }) | null
//   cupQuarters(groups) -> the quarterfinals as the groups stand: [predicted tie] (East 1 v 4, 2 v 3, then West's; `notes`: a seed settled by a tiebreak)
//   cupOrder(rows, steps), cupNote(note, nameOf, en): the tiebreak steps, and why one is ahead ({ a, b, why })
//   cupGroupColumn(groups, quarters) -> the bracket's first column: a card a place in the quarterfinals,
//     [{ group: { conf, kind: 'group' | 'card', rows } }], two beside each quarterfinal (its sides' order)

const NBA_EAST = new Set(['1', '2', '4', '5', '8', '11', '14', '15', '17', '18', '19', '20', '27', '28', '30']);
export const isEast = id => NBA_EAST.has(String(id));
const CUP_NOTE = /nba cup|emirates cup|in-season tournament/i;
export const isGroupPlay = e => e?.league === 'nba' && CUP_NOTE.test(e?.note || '') && /group/i.test(e.note);

// A knockout game's round for the bracket, its conference in the title so
// each side of the draw keeps its own (a "TBD" side by the other); null for
// any other game, group play too.
export function nbaCupRound(e) {
  const note = e?.note || '';
  if (e?.league !== 'nba' || !CUP_NOTE.test(note) || /group/i.test(note)) return null;
  const key = /quarter/i.test(note) ? 'QF' : /semi/i.test(note) ? 'SF' : /championship|final/i.test(note) ? 'F' : '';
  if (!key) return null;
  const conf = key === 'F' ? '' : [e.home, e.away].some(x => isEast(x?.id)) ? 'East ' : 'West ';
  return { key, title: `${conf}${{ QF: 'Quarterfinals', SF: 'Semifinals', F: 'Championship' }[key]}`, leg: 0, through: [] };
}

// The groups from group play's games (every one scheduled, played or not):
// each its five by who meets whom, ranked by the cup's rules (NBA, "NBA Cup
// 101"; Jay, 2026-11-01: teams level settled as the league settles them, not
// picked at random): record, then the games between those level, then
// point differential, then total points (both in group play, overtime's
// points not counted), then last regular season's record, then the league's
// random drawing (not published: by ESPN's team number till it is). A
// group's first goes through; so does the conference's best second (the
// same steps, head-to-head left out). `prev`: last regular season's record
// by team id ({ w, l }), when read.
//   Each group's `notes`: why a team is above one level with it,
//   [{ ahead, behind, by: 'h2h' | 'pd' | 'pf' | 'prev' | 'draw', values: [a, b] }].
export function nbaCupGroups(games, { prev = null, letters = null, live = false } = {}) {
  const groups = cupGroupsAt(games, { prev, letters, live });
  // Live: each row's move from the table without the games on now (▲▼).
  if (live && groups.some(g => g.rows.some(r => r.live))) {
    const before = cupGroupsAt(games, { prev, letters, live: false });
    for (const g of groups) {
      const was = before.find(b => b.rows.some(r => r.id === g.rows[0]?.id));
      g.rows.forEach((r, i) => {
        const at = was ? was.rows.findIndex(x => x.id === r.id) : -1;
        if (at >= 0 && at !== i) r.moved = at - i;
      });
    }
  }
  return groups;
}
function cupGroupsAt(games, { prev, letters, live }) {
  const list = (games || []).filter(e => isGroupPlay(e) && e.home?.id && e.away?.id && Number(e.home.id) > 0 && Number(e.away.id) > 0 && !e.status?.void);
  const teams = new Map();
  const link = new Map();
  for (const e of list)
    for (const [a, b] of [[e.home, e.away], [e.away, e.home]]) {
      const id = String(a.id);
      if (!teams.has(id)) teams.set(id, { id, name: a.name, short: a.short || a.name, abbr: a.abbr || '', logo: a.logo, w: 0, l: 0, pd: 0, pf: 0, left: 0 });
      (link.get(id) || link.set(id, new Set()).get(id)).add(String(b.id));
    }
  const result = new Map();
  for (const e of list) {
    const [h, a] = [String(e.home.id), String(e.away.id)];
    const state = e.status?.state;
    const on = live && state === 'in';
    // (Live: a game on counted as played, so not left; 2-0 with 2 left, never 2-0 with 3.)
    if (state !== 'post' && !on) {
      teams.get(h).left++;
      teams.get(a).left++;
      continue;
    }
    const [hs, as] = [Number(e.home.score), Number(e.away.score)];
    if (on && Number.isFinite(hs) && Number.isFinite(as)) {
      teams.get(h).live = { for: hs, against: as };
      teams.get(a).live = { for: as, against: hs };
    }
    // (A game on level just now: counted for neither, so still left.)
    if (!Number.isFinite(hs) || !Number.isFinite(as) || hs === as) {
      if (on) teams.get(h).left++, teams.get(a).left++;
      continue;
    }
    const win = hs > as ? h : a;
    // Overtime's points not counted: the four quarters' when the periods are known.
    const [hr, ar] = [regulation(e.home, hs), regulation(e.away, as)];
    for (const [id, f, ag] of [[h, hr, ar], [a, ar, hr]]) {
      const t = teams.get(id);
      t[id === win ? 'w' : 'l']++;
      t.pd += f - ag;
      t.pf += f;
    }
    result.set(`${h}|${a}`, win);
    result.set(`${a}|${h}`, win);
  }
  const prevOf = id => prev?.[id] || prev?.get?.(id) || null;
  for (const t of teams.values()) {
    const p = prevOf(t.id);
    if (p && Number.isFinite(p.w) && Number.isFinite(p.l)) t.prev = { w: p.w, l: p.l };
  }
  // The groups: each team with all it meets, joined.
  const groups = [];
  const seen = new Set();
  for (const id of [...teams.keys()].sort((x, y) => x - y)) {
    if (seen.has(id)) continue;
    const members = [];
    const todo = [id];
    while (todo.length) {
      const x = todo.pop();
      if (seen.has(x)) continue;
      seen.add(x);
      members.push(x);
      todo.push(...(link.get(x) || []));
    }
    const rows = members.map(m => teams.get(m));
    const { rows: ranked, notes } = cupOrder(rows, groupSteps(result));
    // Said only where it decides who goes through: first v second (Jay, 2026-11-01: not every level pair).
    // Its letter: ESPN's, when every one of the five has the same.
    const named = new Set(members.map(m => letters?.[m] || ''));
    const letter = named.size === 1 ? [...named][0] : '';
    groups.push({ conf: isEast(id) ? 'East' : 'West', letter, rows: ranked, notes: played({ rows }) ? edge(notes, ranked) : [] });
  }
  // The wild card: each conference's best second. Neither marked before a
  // group's first game (the draw's order says nothing).
  for (const conf of ['East', 'West']) {
    const seconds = groups.filter(g => g.conf === conf && g.rows.length > 1 && played(g)).map(g => g.rows[1]);
    const best = cupOrder(seconds, CARD_STEPS).rows[0];
    for (const g of groups.filter(g => g.conf === conf)) g.rows.forEach((r, i) => (r.zone = i === 0 && played(g) ? 'lead' : r === best ? 'card' : ''));
  }
  cupFates(groups, list, live);
  // East first; within a conference, by letter (without them, as ESPN numbers its teams).
  return groups.sort((a, b) => (a.conf === b.conf ? (a.letter && b.letter ? a.letter.localeCompare(b.letter) : 0) : a.conf === 'East' ? -1 : 1));
}

// ESPN's cup standings (its type 3, by conference then group: "Group A")
// -> each team's group letter, { '8': 'A' }.
export function cupLetters(d) {
  const out = {};
  for (const conf of d?.children || [])
    for (const g of conf.children || []) {
      const letter = /group\s+([A-Z])\b/i.exec(g.name || '')?.[1]?.toUpperCase();
      if (letter) for (const en of g.standings?.entries || []) if (en.team?.id) out[String(en.team.id)] = letter;
    }
  return out;
}

// Who's sure of what (Jay 2026-11-14: "a confirmed system, like the
// playoffs"): every way the group games still to play can go, won or lost
// (a margin can be anything, so a tie the margins would settle is taken
// either way: never sure, never out on it). The order in each: record, then
// the games between those level (again for those still level); level after
// that, by point differential, points and last season once none of them has
// a game left, else still open. The wild card: a conference's best second
// by record, a level one open (its margins). Live: a game on as it stands
// (level, still open). Once a conference's groups are all played, its zones
// are the fates. Each row gets `fate`.
function cupFates(groups, list, live) {
  const winnerOf = e => {
    const state = e.status?.state;
    if (state !== 'post' && !(live && state === 'in')) return null;
    const [hs, as] = [Number(e.home.score), Number(e.away.score)];
    return Number.isFinite(hs) && Number.isFinite(as) && hs !== as ? String(hs > as ? e.home.id : e.away.id) : null;
  };
  const read = groups.map(g => {
    const ids = g.rows.map(r => r.id);
    const mine = list.filter(e => ids.includes(String(e.home.id)) && ids.includes(String(e.away.id)));
    const fixed = [];
    const open = [];
    for (const e of mine) {
      const pair = [String(e.home.id), String(e.away.id)];
      const w = winnerOf(e);
      if (w) fixed.push([...pair, w]);
      else if (e.status?.state !== 'post') open.push(pair);
    }
    const busy = new Set(open.flat());
    // Every way it can go: each team's place (its range, a tie still open) and wins.
    const ways = [];
    for (let m = 0; m < 2 ** open.length; m++) {
      const res = [...fixed, ...open.map(([h, a], k) => [h, a, m & (1 << k) ? h : a])];
      ways.push(placesOf(g.rows, res, busy));
    }
    return { g, ways, open: open.length };
  });
  for (const conf of ['East', 'West']) {
    const mine = read.filter(x => x.g.conf === conf);
    // All played: the zones as they are.
    if (mine.every(x => !x.open)) {
      for (const { g } of mine) for (const r of g.rows) r.fate = r.zone === 'lead' ? 'lead' : r.zone === 'card' ? 'in' : 'out';
      continue;
    }
    // Each group's second: the fewest and the most wins it can have.
    const seconds = mine.map(({ ways }) => {
      let [lo, hi] = [Infinity, -Infinity];
      for (const w of ways) for (const [id, p] of w.place) if (p.best <= 2 && p.worst >= 2) [lo, hi] = [Math.min(lo, w.wins.get(id)), Math.max(hi, w.wins.get(id))];
      return { lo, hi };
    });
    mine.forEach(({ g, ways }, gi) => {
      const others = seconds.filter((_, k) => k !== gi);
      for (const r of g.rows) {
        let [canFirst, sureFirst, can, sure] = [false, true, false, true];
        for (const w of ways) {
          const p = w.place.get(r.id);
          const wins = w.wins.get(r.id);
          if (p.best === 1) canFirst = true;
          if (p.worst !== 1) sureFirst = false;
          // In as the wild card: second, ahead of (or level with) every other group's second as it can end.
          const second = p.best <= 2 && p.worst >= 2;
          if (p.best === 1 || (second && others.every(o => o.lo <= wins))) can = true;
          if (!(p.worst === 1 || (p.worst === 2 && others.every(o => wins > o.hi)))) sure = false;
        }
        r.fate = sureFirst ? 'lead' : sure ? 'in' : !can && !canFirst ? 'out' : '';
      }
    });
  }
}
// One way the games go: each team's wins and its place (best, worst: a tie the margins settle, every place it could take).
function placesOf(rows, res, busy) {
  const wins = new Map(rows.map(r => [r.id, 0]));
  const beat = new Map();
  for (const [h, a, w] of res) {
    wins.set(w, (wins.get(w) || 0) + 1);
    beat.set(`${w}|${w === h ? a : h}`, true);
  }
  const place = new Map();
  const byWins = [...rows].sort((a, b) => wins.get(b.id) - wins.get(a.id));
  let at = 1;
  const put = block => {
    for (const r of block) place.set(r.id, { best: at, worst: at + block.length - 1 });
    at += block.length;
  };
  // Those level: by their games against each other, again for any still level; then the margins (known once none has a game left).
  const split = level => {
    if (level.length < 2) return put(level);
    const h2h = new Map(level.map(t => [t.id, level.reduce((n, o) => n + (beat.get(`${t.id}|${o.id}`) ? 1 : 0) - (beat.get(`${o.id}|${t.id}`) ? 1 : 0), 0)]));
    const values = [...new Set(h2h.values())].sort((a, b) => b - a);
    if (values.length > 1) return values.forEach(v => split(level.filter(t => h2h.get(t.id) === v)));
    if (level.some(t => busy.has(t.id))) return put(level);
    settle(level, CARD_STEPS, []).forEach(t => put([t]));
  };
  for (let i = 0; i < byWins.length; ) {
    let j = i + 1;
    while (j < byWins.length && wins.get(byWins[j].id) === wins.get(byWins[i].id)) j++;
    split(byWins.slice(i, j));
    i = j;
  }
  return { wins, place };
}
const played = g => g.rows.some(r => r.w + r.l > 0);
// The note deciding first place, if a tiebreak did.
const edge = (notes, rows) => notes.filter(n => n.ahead === rows[0]?.id && n.behind === rows[1]?.id);
// A side's points in the four quarters (overtime's not counted), else its score.
function regulation(side, score) {
  const lines = (side?.lines || []).map(Number);
  return lines.length > 4 && lines.every(Number.isFinite) ? lines.slice(0, 4).reduce((a, b) => a + b, 0) : score;
}
const prevPct = t => (t.prev && t.prev.w + t.prev.l ? t.prev.w / (t.prev.w + t.prev.l) : null);
// The steps after the record, each a team's value among those level (higher first).
const PD = { key: 'pd', value: t => t.pd };
const PF = { key: 'pf', value: t => t.pf };
// Last season's record: only when every one level has one (a team missing it not ranked last for it).
const PREV = { key: 'prev', value: (t, level) => (level.every(o => prevPct(o) != null) ? prevPct(t) : 0), show: t => (t.prev ? `${t.prev.w}-${t.prev.l}` : '') };
const groupSteps = result => [
  {
    key: 'h2h',
    // The record in the games between those level (a pair yet to meet: no games, level).
    value: (t, level) => {
      let [w, l] = [0, 0];
      for (const o of level) {
        if (o === t) continue;
        const r = result.get(`${t.id}|${o.id}`);
        if (r === t.id) w++;
        else if (r) l++;
      }
      return w + l ? (w - l) / (w + l) : 0;
    },
    show: (t, level) => {
      let [w, l] = [0, 0];
      for (const o of level) if (o !== t) result.get(`${t.id}|${o.id}`) === t.id ? w++ : result.get(`${t.id}|${o.id}`) && l++;
      return `${w}-${l}`;
    }
  },
  PD,
  PF,
  PREV
];
const CARD_STEPS = [PD, PF, PREV];
// Teams in the cup's order: by record, those level by `steps` in turn; a
// step that parts them starts the steps again for any still level (the
// NBA's way with three or more), none parting them the drawing (by id).
// -> { rows, notes } (notes: the step deciding each pair next to each other and level on record).
export function cupOrder(rows, steps = CARD_STEPS) {
  const notes = [];
  // (One yet to play at .500: a 0-0 above a 0-1. Level only on the same record.)
  const share = t => (t.w + t.l ? t.w / (t.w + t.l) : 0.5);
  const byRec = [...rows].sort((a, b) => share(b) - share(a) || b.w - a.w || a.l - b.l);
  const out = [];
  for (let i = 0; i < byRec.length; ) {
    let j = i + 1;
    while (j < byRec.length && byRec[j].w === byRec[i].w && byRec[j].l === byRec[i].l) j++;
    out.push(...settle(byRec.slice(i, j), steps, notes));
    i = j;
  }
  // (Those yet to play: no reason to give.)
  const byId = new Map(rows.map(r => [r.id, r]));
  const on = id => (r => r && r.w + r.l > 0)(byId.get(id));
  return { rows: out, notes: notes.filter(n => on(n.ahead) && on(n.behind)) };
}
function settle(level, steps, notes) {
  if (level.length < 2) return level;
  for (const step of steps) {
    const value = new Map(level.map(t => [t, step.value(t, level)]));
    const parts = [...new Set(value.values())].sort((a, b) => b - a).map(v => level.filter(t => value.get(t) === v));
    if (parts.length < 2) continue;
    const show = t => (step.show ? step.show(t, level) : value.get(t));
    const done = parts.map(p => settle(p, steps, notes));
    for (let k = 1; k < done.length; k++) {
      const [a, b] = [done[k - 1].at(-1), done[k][0]];
      notes.push({ ahead: a.id, behind: b.id, by: step.key, values: [show(a), show(b)] });
    }
    return done.flat();
  }
  const drawn = [...level].sort((a, b) => Number(a.id) - Number(b.id));
  for (let k = 1; k < drawn.length; k++) notes.push({ ahead: drawn[k - 1].id, behind: drawn[k].id, by: 'draw', values: ['', ''] });
  return drawn;
}
// Why a team is above another, short (one line in a card at 320):
// { a, b, why } -> 熱火 > 76人 · 分差 +20/+5.
export function cupNote(n, names, en = false) {
  const v = n.values;
  const signed = x => (Number(x) > 0 ? `+${x}` : String(x));
  const zh = { h2h: `對戰 ${v[0]}`, pd: `分差 ${signed(v[0])}/${signed(v[1])}`, pf: `得分 ${v[0]}/${v[1]}`, prev: `上季 ${v[0]}/${v[1]}`, draw: '待抽籤' }[n.by];
  const eng = { h2h: `H2H ${v[0]}`, pd: `Diff ${signed(v[0])}/${signed(v[1])}`, pf: `Pts ${v[0]}/${v[1]}`, prev: `Last yr ${v[0]}/${v[1]}`, draw: 'Draw due' }[n.by];
  return { a: names(n.ahead), b: names(n.behind), why: en ? eng : zh, seed: Boolean(n.seed) };
}

// The quarterfinals as the groups stand (Jay, 2026-10-26: the groups and
// the knockout one view, the six winners and two wild cards going in):
// each conference's group winners seeded 1-3 by record, its wild card 4th;
// 1 v 4 and 2 v 3, the better seed at home. Before a group's first game: the
// places by what fills them (東區分組第一, 東區外卡), no team.
export function cupQuarters(groups) {
  const side = (r, seed) => (r ? { id: r.id, name: r.name, short: r.short, abbr: r.abbr, logo: r.logo, seed } : null);
  return ['East', 'West'].flatMap(conf => {
    const list = (groups || []).filter(g => g.conf === conf);
    const zh = conf === 'East' ? '東區' : '西區';
    const { rows: lead, notes } = cupOrder(list.flatMap(g => g.rows.filter(r => r.zone === 'lead')));
    const card = list.flatMap(g => g.rows.filter(r => r.zone === 'card'))[0];
    const by = [...lead, card];
    const label = seed => (seed === 4 ? `${zh}外卡` : `${zh}分組第一`);
    const known = lead.length === list.length && list.length === 3 && card;
    const seedNotes = known ? notes.map(n => ({ ...n, seed: true })) : [];
    return [[1, 4], [2, 3]].map(([a, b]) => ({ projected: true, notes: seedNotes.filter(n => [by[a - 1]?.id, by[b - 1]?.id].includes(n.ahead)), sides: known ? [side(by[a - 1], a), side(by[b - 1], b)] : [null, null], seeds: [a, b], labels: [label(a), label(b)] }));
  });
}

// The groups as the bracket's first column (Jay, 2026-10-26: the bracket
// starting at the groups, the tables in it): each conference's three
// groups and its wild card race (the three seconds), a card each, so every
// place in the quarterfinals has the card it comes from beside it, in the
// order of the quarterfinals' sides (a group by its winner, the wild card
// by its own; a place not known yet by its label, 東區外卡, else the next
// group of its conference).
export function cupGroupColumn(groups, quarters) {
  const cards = { East: [], West: [] };
  for (const conf of ['East', 'West']) {
    const list = (groups || []).filter(g => g.conf === conf);
    if (!list.length) continue;
    cards[conf].push(...list.map(g => ({ conf, kind: 'group', rows: g.rows, notes: g.notes || [] })));
    const seconds = cupOrder(list.map(g => g.rows[1]).filter(Boolean));
    cards[conf].push({ conf, kind: 'card', rows: seconds.rows, notes: list.some(played) ? edge(seconds.notes, seconds.rows) : [] });
  }
  const used = new Set();
  const take = c => (c && !used.has(c) ? (used.add(c), c) : null);
  const out = [];
  for (const t of quarters || []) {
    const confOf = (s, i) => (s ? (isEast(s.id) ? 'East' : 'West') : /^東/.test(t?.labels?.[i] || '') ? 'East' : /^西/.test(t?.labels?.[i] || '') ? 'West' : t?.sides?.find(Boolean) ? (isEast(t.sides.find(Boolean).id) ? 'East' : 'West') : null);
    for (let i = 0; i < 2; i++) {
      const s = t?.sides?.[i];
      const conf = confOf(s, i);
      const mine = cards[conf] || [];
      const card = (s && take(mine.find(c => (c.kind === 'group' ? c.rows[0]?.id === String(s.id) : c.rows.some(r => r.zone === 'card' && r.id === String(s.id)))))) || (/外卡/.test(t?.labels?.[i] || '') && take(mine.find(c => c.kind === 'card'))) || take(mine.find(c => !used.has(c) && (c.kind === 'group') === !/外卡/.test(t?.labels?.[i] || ''))) || take(mine.find(c => !used.has(c)));
      out.push(card ? { group: card } : null);
    }
  }
  return out.some(Boolean) ? out : [];
}

// What a group game decides (Jay 2026-11-14, a group being many games: "what
// it means"), for its card: either side's win or loss as the fates have it
// (晉級 / 淘汰 / 分組第一 sure), else who'd top the group with a win.
// Over: what it settled. -> { kind, side, also } | null
//   kind: 'in' | 'lead' (side's win puts it through / wins the group; side 'both': either's),
//         'out' (side's loss puts it out), 'top' (side's win puts it top for now), 'did-in' | 'did-lead' | 'did-out' (over: what it settled)
//   also: a second fact as { kind, side } (勝者晉級，敗者淘汰), or null
export function cupStakes(games, e, opts = {}) {
  if (!isGroupPlay(e)) return null;
  const [h, a] = [String(e.home.id), String(e.away.id)];
  const others = (games || []).filter(x => String(x.id) !== String(e.id));
  const groupOf = list => nbaCupGroups(list, opts).find(g => g.rows.some(r => r.id === h) && g.rows.some(r => r.id === a));
  const rowOf = (g, id) => g?.rows.find(r => r.id === id);
  if (e.status?.state === 'post') {
    const g = groupOf([...others, e]);
    const was = groupOf([...others, { ...e, status: { state: 'pre' } }]);
    const won = Number(e.home.score) > Number(e.away.score) ? h : a;
    const lost = won === h ? a : h;
    const did = id => {
      const [now, then] = [rowOf(g, id)?.fate, rowOf(was, id)?.fate];
      return now && now !== then ? now : '';
    };
    const facts = [[won, did(won)], [lost, did(lost)]].filter(([, f]) => f).map(([side, f]) => ({ kind: `did-${f}`, side }));
    return facts.length ? { ...facts[0], also: facts[1] || null } : null;
  }
  // Either result as a game over (a point's margin: the order beyond it is the fates' to leave open).
  const ending = winner => ({ ...e, status: { state: 'post' }, home: { ...e.home, score: winner === h ? 1 : 0, lines: [] }, away: { ...e.away, score: winner === a ? 1 : 0, lines: [] } });
  const after = { [h]: groupOf([...others, ending(h)]), [a]: groupOf([...others, ending(a)]) };
  const now = groupOf([...others, { ...e, status: { state: 'pre' } }]);
  const gain = id => {
    const f = rowOf(after[id], id)?.fate;
    return (f === 'lead' || f === 'in') && rowOf(now, id)?.fate !== f && rowOf(now, id)?.fate !== 'lead' ? f : '';
  };
  const loss = id => (rowOf(after[id === h ? a : h], id)?.fate === 'out' && rowOf(now, id)?.fate !== 'out' ? 'out' : '');
  const wins = [h, a].map(id => [id, gain(id)]).filter(([, f]) => f);
  const outs = [h, a].filter(loss);
  // (Both through with a win, one as its group's first and one as the wild card: 勝者晉級.)
  const win = wins.length === 2 ? { kind: wins.every(([, f]) => f === 'lead') ? 'lead' : 'in', side: 'both' } : wins.length ? { kind: wins[0][1], side: wins[0][0] } : null;
  const out = outs.length ? { kind: 'out', side: outs.length === 2 ? 'both' : outs[0] } : null;
  if (win || out) return { ...(win || out), also: win && out ? out : null };
  // Nothing settled either way: who'd top the group with a win (sure of the top, its tie not left to margins).
  const top = [h, a].filter(id => {
    const g = after[id];
    return g?.rows[0]?.id === id && !(g.rows[1] && g.rows[1].w === g.rows[0].w && g.rows[1].l === g.rows[0].l && g.notes?.some(n => n.by !== 'h2h'));
  });
  return top.length ? { kind: 'top', side: top.length === 2 ? 'both' : top[0], also: null } : null;
}
