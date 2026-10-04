// The title race on a league's table: the table as it stands this minute,
// and how soon the title can be won.
//
//   liveTable   ESPN's standings come in late (minutes to hours after a
//               final whistle): the games the table hasn't counted yet,
//               finished or on now, added to it, marked as not settled.
//               A game is counted once only: by games played. A side's
//               record on the scoreboard (ESPN's, the team's season so far)
//               says how many games it will have played once this one is
//               in; a table that has that many already has it, and one
//               short of it gets it added (games in time order).
//   titleRace   whether the top of each table is settled, the magic
//               number, and the earliest it could be: points (soccer, F1)
//               or wins (baseball, basketball).

const num = v => {
  const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const has = v => v != null && v !== '';
// A season's games for each side, where it isn't each other side twice.
export const SEASON_GAMES = { mlb: 162, nba: 82, wnba: 44, nbl: 29, mls: 34, nfl: 17, nhl: 82 };

const playedOf = (r, sport) => (sport === 'soccer' ? num(r.stats.GP) : num(r.stats.W) + num(r.stats.L) + num(r.stats.T));
// "4-0-1", "90-72": the games in a record.
const recordGames = rec => (/^\d+(-\d+)+$/.test(String(rec || '').trim()) ? String(rec).split('-').reduce((a, n) => a + Number(n), 0) : null);

// groups: the standings ([{ name, rows: [{ id, stats }] }]); events: the
// league's recent games (any state). → the groups, the uncounted games in,
// re-ordered, their rows marked `fresh` ('in' on now, 'post' final, not yet
// in the official table); `.fresh` on the array: how many games were added.
export function liveTable(groups, events, sport, { teamOf = null } = {}) {
  if (sport === 'racing') return liveRacing(groups, events, teamOf);
  if (!groups?.length || !['soccer', 'baseball', 'basketball'].includes(sport)) return groups;
  const games = (events || []).filter(e => e.kind === 'match' && !e.status?.void && (e.status?.state === 'in' || e.status?.state === 'post') && e.home?.id && e.away?.id);
  games.sort((x, y) => Date.parse(x.start) - Date.parse(y.start));
  // Each side's record (as of its latest game here: ESPN's is the season so
  // far, finals in) and its games in time order: a final is the record's
  // games less the finals after it; a game on now, one more than the record.
  const sides = new Map();
  for (const e of games)
    for (const s of [e.home, e.away]) {
      const x = sides.get(s.id) || { list: [] };
      x.list.push(e);
      x.n = recordGames(s.record);
      sides.set(s.id, x);
    }
  const doneAfter = (e, side) => {
    const x = sides.get(side.id);
    if (x?.n == null) return null;
    if (e.status.state === 'in') return x.n + 1;
    return x.n - x.list.filter(g => g.status.state === 'post' && Date.parse(g.start) > Date.parse(e.start)).length;
  };
  const out = groups.map(g => ({ ...g, rows: g.rows.map(r => ({ ...r, stats: { ...r.stats } })) }));
  const rowOf = id => {
    for (const g of out) {
      const r = g.rows.find(x => x.id === id);
      if (r) return [g, r];
    }
    return [];
  };
  let fresh = 0;
  const touched = new Set();
  for (const e of games) {
    const [gh, h] = rowOf(e.home.id);
    const [ga, a] = rowOf(e.away.id);
    if (!h || !a) continue;
    const [dh, da] = [doneAfter(e, e.home), doneAfter(e, e.away)];
    if (dh == null || da == null) continue;
    // In the table already (both sides), or the record not caught up yet: as it is.
    if (playedOf(h, sport) >= dh || playedOf(a, sport) >= da) continue;
    if (playedOf(h, sport) !== dh - 1 || playedOf(a, sport) !== da - 1) continue;
    const [hs, as] = [Number(e.home.score), Number(e.away.score)];
    if (!Number.isFinite(hs) || !Number.isFinite(as) || !has(e.home.score) || !has(e.away.score)) continue;
    if (sport === 'soccer') {
      for (const [r, f, ag] of [[h, hs, as], [a, as, hs]]) {
        r.stats.GP = String(num(r.stats.GP) + 1);
        const k = f > ag ? 'W' : f === ag ? 'D' : 'L';
        r.stats[k] = String(num(r.stats[k]) + 1);
        r.stats.P = String(num(r.stats.P) + (f > ag ? 3 : f === ag ? 1 : 0));
        if (has(r.stats.F)) r.stats.F = String(num(r.stats.F) + f);
        if (has(r.stats.A)) r.stats.A = String(num(r.stats.A) + ag);
        const gd = num(r.stats.GD) + f - ag;
        r.stats.GD = gd > 0 ? `+${gd}` : String(gd);
      }
    } else {
      // Level while on: no result yet, only marked.
      if (hs !== as) {
        const [w, l] = hs > as ? [h, a] : [a, h];
        w.stats.W = String(num(w.stats.W) + 1);
        l.stats.L = String(num(l.stats.L) + 1);
        for (const r of [w, l]) {
          const p = num(r.stats.W) / Math.max(1, num(r.stats.W) + num(r.stats.L));
          r.stats.PCT = p >= 1 ? '1.000' : p.toFixed(3).replace(/^0/, '');
        }
      }
    }
    h.fresh = a.fresh = e.status.state;
    touched.add(gh).add(ga);
    fresh++;
  }
  for (const g of touched) {
    const key = sport === 'soccer' ? r => [num(r.stats.P), num(r.stats.GD), num(r.stats.F)] : r => [num(r.stats.PCT), num(r.stats.W)];
    g.rows.sort((x, y) => {
      const [p, q] = [key(x), key(y)];
      for (let i = 0; i < p.length; i++) if (p[i] !== q[i]) return q[i] - p[i];
      return 0;
    });
    const top = g.rows[0];
    for (const [i, r] of g.rows.entries()) {
      if (sport === 'soccer') r.stats.GAP = i === 0 ? '-' : String(num(top.stats.P) - num(r.stats.P));
      else {
        const gb = (num(top.stats.W) - num(r.stats.W) + (num(r.stats.L) - num(top.stats.L))) / 2;
        r.stats.GB = i === 0 || !(gb > 0) ? '-' : String(gb);
      }
    }
  }
  out.fresh = fresh;
  return out;
}

// Every place in one table, as far as the maths goes: each side's lowest
// and highest total by the end (what it has; that plus everything still to
// play for), so the best and worst place it can finish. A place is settled
// when the best and worst are the same. Ties count against certainty (a
// side level on the most it can make could still go above).
//
// opts: `total` (each side's games in the season; null: twice each other
// side), `left` (racing: { races, sprints } still to run), `team` (racing:
// a constructors' table, two cars scoring).
// → { unit ('pts' | 'wins'), rows: [{ id, best, worst, settled }], title,
// places: [{ pos, rows }] (the next places still open, who's in them),
// zones: [{ note, color, from, to, bottom, sure: [ids] }] } or null.
const RACE_MAX = { driver: { race: 25, sprint: 8 }, team: { race: 25 + 18, sprint: 8 + 7 } };
export function standingsRace(group, sport, { total = null, left = null, team = false } = {}) {
  const rows = group?.rows || [];
  if (rows.length < 2) return null;
  let have;
  let more;
  let unit = 'pts';
  if (sport === 'racing') {
    if (!left) return null;
    const m = RACE_MAX[team ? 'team' : 'driver'];
    have = r => num(r.stats.PTS);
    more = () => left.races * m.race + left.sprints * m.sprint;
  } else if (sport === 'soccer') {
    const games = total || (rows.length > 3 ? 2 * (rows.length - 1) : null);
    if (!games) return null;
    have = r => num(r.stats.P);
    more = r => 3 * Math.max(0, games - num(r.stats.GP));
  } else if (sport === 'baseball' || sport === 'basketball') {
    if (!total) return null;
    unit = 'wins';
    have = r => num(r.stats.W);
    more = r => Math.max(0, total - num(r.stats.W) - num(r.stats.L));
  } else return null;
  const lo = rows.map(have);
  const hi = rows.map((r, i) => lo[i] + more(r));
  const out = rows.map((r, i) => {
    let best = 1;
    let worst = 1;
    rows.forEach((_, j) => {
      if (j === i) return;
      if (lo[j] > hi[i]) best++;
      if (hi[j] >= lo[i]) worst++;
    });
    return { id: r.id, best, worst, settled: best === worst, row: r };
  });
  // The title: won, or how many more the leader needs if every rival wins
  // out (points, or wins and rivals' losses: baseball's magic number), and
  // the soonest it can be (each game the leader wins and the nearest rival
  // doesn't, it comes closer by both).
  const lead = rows[0];
  const rivalBest = Math.max(...hi.slice(1));
  const magic = Math.max(0, rivalBest - lo[0] + 1);
  const step = sport === 'racing' ? 2 * RACE_MAX[team ? 'team' : 'driver'].race : sport === 'soccer' ? 6 : 2;
  const leadLeft = sport === 'racing' ? left.races : sport === 'soccer' ? more(lead) / 3 : more(lead);
  let soonest = magic === 0 ? 0 : Math.ceil(magic / step);
  if (sport === 'racing') {
    // A weekend's most, the sprint's too while there are sprints.
    soonest = null;
    const m = RACE_MAX[team ? 'team' : 'driver'];
    for (let k = 1, gain = 0; k <= left.races; k++) {
      gain += 2 * m.race + (k <= left.sprints ? 2 * m.sprint : 0);
      if (gain >= magic) {
        soonest = k;
        break;
      }
    }
    if (magic === 0) soonest = 0;
  } else if (soonest > leadLeft) soonest = null;
  const title = { leader: lead, done: out[0].settled && out[0].best === 1, magic, soonest, round: sport === 'soccer' && soonest != null ? num(lead.stats.GP) + soonest : null, left: leadLeft };
  // A table not in order of what's counted (MLB's, by playoff seed), or a
  // season over: no places to work out, only the title.
  const ordered = lo.every((v, i) => i === 0 || v <= lo[i - 1]);
  const over = rows.every(r => more(r) === 0);
  if (!ordered || over) for (const x of out) x.settled = false;
  // The next places still open, each once the one above it is settled (the
  // fight for 2nd once the title's won): who can still finish there.
  const places = [];
  if (ordered && !over)
    for (let pos = 2; pos <= Math.min(rows.length, 3); pos++) {
      if (!out.some(x => x.settled && x.best === pos - 1)) break;
      const can = out.filter(x => !x.settled && x.best <= pos && x.worst >= pos);
      if (can.length > 1) {
        places.push({ pos, rows: can.map(x => x.row) });
        break;
      }
    }
  // ESPN's zones (its notes on the rows: Champions League, relegation…): the
  // places they cover, and who's sure of being in.
  const zones = [];
  rows.forEach((r, i) => {
    if (!r.note) return;
    const z = zones.at(-1);
    if (z && z.note === r.note && z.to === i) z.to = i + 1;
    else zones.push({ note: r.note, color: r.color || '', from: i + 1, to: i + 1 });
  });
  if (!ordered || over) zones.length = 0;
  for (const z of zones) {
    z.bottom = z.to === rows.length;
    z.sure = out.filter(x => (z.bottom ? x.best >= z.from : x.worst <= z.to && x.best >= z.from)).map(x => x.id);
  }
  return { unit, rows: out, title, places, zones };
}

// The title alone (the home page and tests): won, magic, soonest.
export function titleRace(group, sport, opts = {}) {
  const r = standingsRace(group, sport, opts);
  if (!r) return null;
  return { ...r.title, unit: r.unit, out: r.rows.filter(x => x.best > 1).map(x => x.id) };
}

// F1: a race (or sprint) on now or just over, its points by the running
// order, until the championship's own column for that weekend has them.
// ESPN's table has a column a weekend (its points; "-" or blank until it's
// counted, "-" also a weekend without points): counted once any side has a
// number there. A sprint weekend's column can hold the sprint alone (its
// points, 36 in all, at most): then the race still goes in.
export const POINTS = { Race: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1], SR: [8, 7, 6, 5, 4, 3, 2, 1] };
const SPRINT_TOTAL = 36;
function liveRacing(groups, events, teamOf) {
  if (!groups?.length) return groups;
  const out = groups.map(g => ({ ...g, rows: g.rows.map(r => ({ ...r, stats: { ...r.stats } })) }));
  const weekends = new Map();
  for (const e of events || []) if (e.sessions?.length && !weekends.has(e.weekend || e.id)) weekends.set(e.weekend || e.id, e);
  let fresh = 0;
  for (const e of weekends.values()) {
    const scoring = e.sessions.filter(x => POINTS[x.abbr] && (x.status?.state === 'in' || x.status?.state === 'post') && x.field?.length);
    if (!scoring.length) continue;
    let added = false;
    for (const g of out) {
      const col = g.rounds?.find(r => r.name === e.name)?.key;
      if (!col) continue;
      const sum = g.rows.reduce((a, r) => a + (/\d/.test(String(r.stats[col] ?? '')) ? num(r.stats[col]) : 0), 0);
      const counted = g.rows.some(r => /\d/.test(String(r.stats[col] ?? '')));
      const todo = !counted ? scoring : sum <= SPRINT_TOTAL && e.sessions.some(x => x.abbr === 'SR') ? scoring.filter(x => x.abbr === 'Race') : [];
      if (!todo.length) continue;
      const team = !g.rows.some(r => r.athlete);
      for (const x of todo)
        x.field.forEach((side, i) => {
          const pts = POINTS[x.abbr][i];
          if (!pts) return;
          const r = team ? g.rows.find(r => teamOf && teamOf(side) && sameTeam(teamOf(side), r)) : g.rows.find(r => r.id === side.id);
          if (!r) return;
          r.stats.PTS = String(num(r.stats.PTS) + pts);
          r.fresh = x.status.state === 'in' ? 'in' : r.fresh || 'post';
        });
      g.rows.sort((a, b) => num(b.stats.PTS) - num(a.stats.PTS));
      const top = num(g.rows[0].stats.PTS);
      g.rows.forEach((r, i) => (r.stats.GAP = i === 0 ? '-' : String(top - num(r.stats.PTS))));
      added = true;
    }
    if (added) fresh++;
  }
  out.fresh = fresh;
  return out;
}
const plain = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
const sameTeam = (name, r) => {
  const [a, b] = [plain(name), plain(r.en || r.name)];
  return Boolean(a && b) && (a.includes(b) || b.includes(a));
};
