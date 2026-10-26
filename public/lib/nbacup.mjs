// The NBA Cup: its group play and its knockout. ESPN keeps every cup game a
// regular-season game and says which only in its note ("NBA Cup - Group
// Play", "NBA Cup - Quarterfinals", "NBA Cup Championship"); no feed the app
// reads names a team's group. The schedule says it: in group play each team
// meets the other four of its group once, so the games' pairings are the
// groups (five teams, three a conference). Their letters aren't in any feed,
// so they're drawn without them.
//
//   nbaCupRound(event) -> { key: 'QF' | 'SF' | 'F', title, leg, through } | null
//   nbaCupGroups(games) -> [{ conf: 'East' | 'West', rows: [{ id, name, short, abbr, logo, w, l, pd, pf, left, zone }] }]
//     zone: 'lead' (first in its group: the quarterfinals) | 'card' (the conference's best second: its wild card) | ''
//   cupQuarters(groups) -> the quarterfinals as the groups stand: [predicted tie] (East 1 v 4, 2 v 3, then West's)
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
// each its five by who meets whom, ranked by the cup's rules: record, then
// the games between those level, then points for less against, then points
// for. A group's first goes through; so does the conference's best second.
export function nbaCupGroups(games) {
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
    if (e.status?.state !== 'post') {
      teams.get(h).left++;
      teams.get(a).left++;
      continue;
    }
    const [hs, as] = [Number(e.home.score), Number(e.away.score)];
    if (!Number.isFinite(hs) || !Number.isFinite(as) || hs === as) continue;
    const win = hs > as ? h : a;
    for (const [id, f, ag] of [[h, hs, as], [a, as, hs]]) {
      const t = teams.get(id);
      t[id === win ? 'w' : 'l']++;
      t.pd += f - ag;
      t.pf += f;
    }
    result.set(`${h}|${a}`, win);
    result.set(`${a}|${h}`, win);
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
    groups.push({ conf: isEast(id) ? 'East' : 'West', rows: rank(members.map(m => teams.get(m)), result) });
  }
  // The wild card: each conference's best second (record, points for less
  // against, points for). Neither marked before a group's first game (the
  // draw's order says nothing).
  const played = g => g.rows.some(r => r.w + r.l > 0);
  for (const conf of ['East', 'West']) {
    const seconds = groups.filter(g => g.conf === conf && g.rows.length > 1 && played(g)).map(g => g.rows[1]);
    const best = [...seconds].sort(byRecord)[0];
    for (const g of groups.filter(g => g.conf === conf)) g.rows.forEach((r, i) => (r.zone = i === 0 && played(g) ? 'lead' : r === best ? 'card' : ''));
  }
  // East first; within a conference, the groups as ESPN numbers its teams (no letters to go by).
  return groups.sort((a, b) => (a.conf === b.conf ? 0 : a.conf === 'East' ? -1 : 1));
}
const pct = t => (t.w + t.l ? t.w / (t.w + t.l) : 0);
const byRecord = (a, b) => pct(b) - pct(a) || b.w - a.w || b.pd - a.pd || b.pf - a.pf;
// A group in order: by record, those level then by their games between them.
function rank(rows, result) {
  const h2h = (t, level) => level.filter(o => o !== t && result.get(`${t.id}|${o.id}`) === t.id).length;
  return [...rows].sort((a, b) => {
    if (pct(a) !== pct(b) || a.w !== b.w) return byRecord(a, b);
    const level = rows.filter(r => pct(r) === pct(a) && r.w === a.w);
    return h2h(b, level) - h2h(a, level) || b.pd - a.pd || b.pf - a.pf;
  });
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
    const lead = list.flatMap(g => g.rows.filter(r => r.zone === 'lead')).sort(byRecord);
    const card = list.flatMap(g => g.rows.filter(r => r.zone === 'card'))[0];
    const by = [...lead, card];
    const label = seed => (seed === 4 ? `${zh}外卡` : `${zh}分組第一`);
    const known = lead.length === list.length && list.length === 3 && card;
    return [[1, 4], [2, 3]].map(([a, b]) => ({ projected: true, sides: known ? [side(by[a - 1], a), side(by[b - 1], b)] : [null, null], seeds: [a, b], labels: [label(a), label(b)] }));
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
    cards[conf].push(...list.map(g => ({ conf, kind: 'group', rows: g.rows })));
    cards[conf].push({ conf, kind: 'card', rows: list.map(g => g.rows[1]).filter(Boolean).sort(byRecord) });
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
