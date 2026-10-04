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
const RACE = { race: 25, sprint: 8 };

const playedOf = (r, sport) => (sport === 'soccer' ? num(r.stats.GP) : num(r.stats.W) + num(r.stats.L) + num(r.stats.T));
// "4-0-1", "90-72": the games in a record.
const recordGames = rec => (/^\d+(-\d+)+$/.test(String(rec || '').trim()) ? String(rec).split('-').reduce((a, n) => a + Number(n), 0) : null);

// groups: the standings ([{ name, rows: [{ id, stats }] }]); events: the
// league's recent games (any state). → the groups, the uncounted games in,
// re-ordered, their rows marked `fresh` ('in' on now, 'post' final, not yet
// in the official table); `.fresh` on the array: how many games were added.
export function liveTable(groups, events, sport) {
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

// One table's race. `total`: each side's games in the season (null: a
// double round-robin, from the table's size); for racing, `left`: the
// season's races and sprints still to run ({ races, sprints }).
// → { leader, done (the title won), magic (points or wins still needed if
// every rival wins out), soonest (the fewest games or race weekends to it),
// unit ('pts' | 'wins'), out: [ids that can't catch the leader] } or null.
export function titleRace(group, sport, { total = null, left = null } = {}) {
  const rows = group?.rows || [];
  if (rows.length < 2) return null;
  const [lead, ...rest] = rows;
  if (sport === 'racing') {
    if (!left) return null;
    const most = left.races * RACE.race + left.sprints * RACE.sprint;
    const pts = r => num(r.stats.PTS);
    const best = Math.max(...rest.map(pts));
    const magic = best + most - pts(lead) + 1;
    // A weekend at most: the leader wins (25, 8 a sprint), the rival scores nothing.
    const weekends = left.races;
    let soonest = null;
    for (let k = 1, gain = 0; k <= weekends; k++) {
      gain += RACE.race * 2 + (k <= left.sprints ? RACE.sprint * 2 : 0);
      if (gain >= magic) {
        soonest = k;
        break;
      }
    }
    return { leader: lead, done: magic <= 0, magic: Math.max(0, magic), soonest, unit: 'pts', out: rest.filter(r => pts(r) + most < pts(lead)).map(r => r.id), left: weekends };
  }
  if (sport === 'soccer') {
    const games = total || (rows.length > 3 ? 2 * (rows.length - 1) : null);
    if (!games) return null;
    const left = r => Math.max(0, games - num(r.stats.GP));
    const most = r => num(r.stats.P) + 3 * left(r);
    const best = Math.max(...rest.map(most));
    const magic = best - num(lead.stats.P) + 1;
    // Each round at most 6 closer: the leader wins, the nearest rival loses.
    const soonest = magic <= 0 ? 0 : Math.ceil(magic / 6) <= left(lead) ? Math.ceil(magic / 6) : null;
    return { leader: lead, done: magic <= 0, magic: Math.max(0, magic), soonest, round: soonest != null ? num(lead.stats.GP) + soonest : null, unit: 'pts', out: rest.filter(r => most(r) < num(lead.stats.P)).map(r => r.id), left: left(lead) };
  }
  if (sport === 'baseball' || sport === 'basketball') {
    if (!total) return null;
    // The rival who could still win the most: the fewest losses.
    const fewest = Math.min(...rest.map(r => num(r.stats.L)));
    const magic = total + 1 - num(lead.stats.W) - fewest;
    const left = total - num(lead.stats.W) - num(lead.stats.L);
    const soonest = magic <= 0 ? 0 : Math.ceil(magic / 2) <= left ? Math.ceil(magic / 2) : null;
    return { leader: lead, done: magic <= 0, magic: Math.max(0, magic), soonest, unit: 'wins', out: rest.filter(r => total - num(r.stats.L) < num(lead.stats.W)).map(r => r.id), left };
  }
  return null;
}
