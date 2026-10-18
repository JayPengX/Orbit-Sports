// The title race on a league's table: the table as it stands this minute,
// and how soon the title can be won.
//
//   liveTable   ESPN's standings come in late (minutes to hours after a
//               final whistle): the finished games the table hasn't counted
//               yet added to it, marked as not settled. Never a game still
//               on (the owner, 2026-10-18: a 0:0 at 34' went in as a draw),
//               at half-time, delayed or suspended: only a final (FINAL).
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
// A win percentage as a table writes it (".667", "1.000"; ".000" before a game).
export const pctText = (w, l) => (w + l ? (w / (w + l)).toFixed(3).replace(/^0/, '') : '.000');
// Games behind the leader (each { w, l }): "-" for the leader and for any
// side not behind it (more wins and losses, a lower percentage). Every
// table's GB (ESPN's where it leaves it out, CPBL's, a count of results).
export function gbText(top, r) {
  const gb = (top.w - r.w + (r.l - top.l)) / 2;
  return gb > 0 ? String(gb) : '-';
}
// A season's games for each side, where it isn't each other side twice
// (CPBL's table is a half-season's: 60; a European cup's league phase is 8
// games each, not a round robin of its 36).
export const SEASON_GAMES = { mlb: 162, nba: 82, wnba: 44, nbl: 29, mls: 34, nfl: 17, nhl: 82, cpbl: 60, ucl: 8, uel: 8, uecl: 6 };

// A game the table counts (the regular season: not the preseason, play-in, playoffs or all-star game).
export const COUNTS = e => !['pre', 'post', 'final', 'playin', 'allstar', 'off'].includes(e.stage?.key || '');
// A game over and done (ESPN's final, or over by the rules: overByRule):
// the only kind a table adds. Not on, at half-time, delayed, suspended or called off.
export const FINAL = e => e.status?.state === 'post' && e.status.completed === true && !e.status.void && !e.status.delayed;
const playedOf = (r, sport) => (sport === 'soccer' ? num(r.stats.GP) : num(r.stats.W) + num(r.stats.L) + num(r.stats.T));
// "4-0-1", "90-72": the games in a record.
const recordGames = rec => (/^\d+(-\d+)+$/.test(String(rec || '').trim()) ? String(rec).split('-').reduce((a, n) => a + Number(n), 0) : null);

// groups: the standings ([{ name, rows: [{ id, stats }] }]); events: the
// league's recent games (any state). → the groups, the uncounted games in,
// re-ordered, their rows marked `fresh` ('post': a final not yet in the
// official table); `.fresh` on the array: how many games were added.
export function liveTable(groups, events, sport, { teamOf = null } = {}) {
  if (sport === 'racing') return liveRacing(groups, events, teamOf);
  if (!groups?.length || !['soccer', 'baseball', 'basketball'].includes(sport)) return groups;
  // Only what the table counts: finals of the regular season (not pre-season,
  // the play-ins, play-offs or an all-star game).
  const games = (events || []).filter(e => e.kind === 'match' && FINAL(e) && e.home?.id && e.away?.id && COUNTS(e));
  games.sort((x, y) => Date.parse(x.start) - Date.parse(y.start));
  // Each side's record (as of its latest final here: ESPN's is the season so
  // far, finals in) and its finals in time order: a final is the record's
  // games less the finals after it.
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
    return x.n - x.list.filter(g => Date.parse(g.start) > Date.parse(e.start)).length;
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
      // (A tie: no win or loss, only marked.)
      if (hs !== as) {
        const [w, l] = hs > as ? [h, a] : [a, h];
        w.stats.W = String(num(w.stats.W) + 1);
        l.stats.L = String(num(l.stats.L) + 1);
        for (const r of [w, l]) r.stats.PCT = pctText(num(r.stats.W), num(r.stats.L));
      }
    }
    h.fresh = a.fresh = 'post';
    touched.add(gh).add(ga);
    fresh++;
  }
  for (const g of touched) {
    const key = sport === 'soccer' ? r => [num(r.stats.P), num(r.stats.GD), num(r.stats.F)] : r => [num(r.stats.PCT), num(r.stats.W)];
    // A zone (the Champions League's, the drop) is a place's, not a side's:
    // kept by place through the new order (a side moved up into 5th came
    // without the colour, the one it passed took 5th's down to 6th).
    const zones = g.rows.map(r => [r.note, r.color]);
    g.rows.sort((x, y) => {
      const [p, q] = [key(x), key(y)];
      for (let i = 0; i < p.length; i++) if (p[i] !== q[i]) return q[i] - p[i];
      return 0;
    });
    g.rows.forEach((r, i) => ([r.note, r.color] = zones[i]));
    const top = g.rows[0];
    for (const [i, r] of g.rows.entries()) {
      if (sport === 'soccer') r.stats.GAP = i === 0 ? '-' : String(num(top.stats.P) - num(r.stats.P));
      else r.stats.GB = gbText({ w: num(top.stats.W), l: num(top.stats.L) }, { w: num(r.stats.W), l: num(r.stats.L) });
    }
  }
  out.fresh = fresh;
  // (The season's year with it, as the table it was made from.)
  out.year = groups.year;
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
  // Before a ball's been kicked (or a race run): nothing to say yet.
  const played = r => (sport === 'soccer' ? num(r.stats.GP) : sport === 'racing' ? num(r.stats.PTS) : num(r.stats.W) + num(r.stats.L));
  if (!rows.some(r => played(r) > 0)) return null;
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
  let atName = '';
  if (sport === 'racing') {
    // A weekend's most, the sprint's too while there are sprints.
    soonest = null;
    const m = RACE_MAX[team ? 'team' : 'driver'];
    // (The calendar's own weekends when known: which have a sprint, and their names.)
    const weeks = left.list?.length === left.races ? left.list : null;
    for (let k = 1, gain = 0; k <= left.races; k++) {
      gain += 2 * m.race + ((weeks ? weeks[k - 1].sprint : k <= left.sprints) ? 2 * m.sprint : 0);
      if (gain >= magic) {
        soonest = k;
        break;
      }
    }
    if (weeks && soonest) atName = weeks[soonest - 1].name;
    if (magic === 0) soonest = 0;
  } else if (soonest > leadLeft) soonest = null;
  // The lead over the nearest rival, and the most that rival can still score: past it, it's settled.
  const ri = hi.indexOf(rivalBest, 1);
  // The lead that settles it at the soonest: more than that rival can still
  // score after it (each weekend its most: a race's, a sprint's; a game's 3).
  let after = hi[ri] - lo[ri];
  if (soonest > 0)
    for (let k = 1; k <= soonest; k++)
      after -= sport === 'racing' ? RACE_MAX[team ? 'team' : 'driver'].race + ((left.list?.length === left.races ? left.list[k - 1]?.sprint : k <= left.sprints) ? RACE_MAX[team ? 'team' : 'driver'].sprint : 0) : sport === 'soccer' ? 3 : 1;
  const title = { leader: lead, done: out[0].settled && out[0].best === 1, magic, soonest, gap: lo[0] - lo[ri], avail: hi[ri] - lo[ri], leadAt: Math.max(0, after) + 1, at: atName, round: sport === 'soccer' && soonest != null ? num(lead.stats.GP) + soonest : null, left: leadLeft };
  // Football, settled at the soonest by the next game: which results do it,
  // when it turns on one rival alone ("{leader} win, or {rival} don't";
  // the lead it takes read backwards: 14 ahead, 13 then). Ties not counted
  // (the tiebreak decides), each side's next game its own.
  if (sport === 'soccer' && soonest === 1) {
    const R = [3, 1, 0];
    const ok = (j, r, q) => lo[0] + r > lo[j] + q + Math.max(0, more(rows[j]) - 3);
    const who = rows.map((_, j) => j).filter(j => j > 0 && R.some(r => R.some(q => !ok(j, r, q))));
    if (who.length === 1) {
      const j = who[0];
      const mine = R.filter(r => R.every(q => ok(j, r, q)));
      const theirs = R.filter(q => R.every(r => ok(j, r, q)));
      if ((mine.length || theirs.length) && R.every(r => R.every(q => ok(j, r, q) === (mine.includes(r) || theirs.includes(q))))) title.next = { rival: rows[j], mine, theirs };
    }
  }
  // A table not in order of what's counted (MLB's, by playoff seed), or a
  // season over: no places to work out, only the title.
  const ordered = lo.every((v, i) => i === 0 || v <= lo[i - 1]);
  const over = rows.every(r => more(r) === 0);
  if (!ordered || over) for (const x of out) x.settled = false;
  // A constructors' championship's close fights, once its champion is
  // decided (every place is the team's prize money; a driver's 7th or 8th
  // is nothing in itself):
  // runs of places still open where each side can still catch the one
  // above, and the run is within one weekend's points (a race's and a
  // sprint's most) top to bottom; the closest two. A team sport's places
  // inside a zone change nothing (its zones say what's at stake): none.
  const places = [];
  if (sport === 'racing' && team && ordered && !over && out[0].settled && out[0].best === 1) {
    const m = RACE_MAX[team ? 'team' : 'driver'];
    const weekend = m.race + (left.sprints ? m.sprint : 0);
    for (let i = 1; i < rows.length; ) {
      let j = i;
      while (j + 1 < rows.length && hi[j + 1] >= lo[j] && !out[j + 1].settled && lo[i] - lo[j + 1] <= weekend) j++;
      if (j > i && !out[i].settled) places.push({ pos: i + 1, to: j + 1, rows: out.slice(i, j + 1).map(x => x.row), spread: lo[i] - lo[j] });
      i = j + 1;
    }
    places.sort((a, b) => a.spread - b.spread || a.pos - b.pos).splice(2);
    places.sort((a, b) => a.pos - b.pos);
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
  // A zone's fight, by the numbers alone (no point of the season set): at its edge (a good
  // zone's last place; the last place above a bottom one), the sides that
  // can still finish either side of it and are close to it. Football's tables (their zones are ESPN's notes).
  if (sport === 'soccer' && ordered && !over) {
    for (const z of zones) {
      const edge = z.bottom ? z.from - 1 : z.to;
      if (edge < 1 || edge >= rows.length) continue;
      // Close: a fifth of the points the side on the line can still win,
      // a game's at least (MLS with 7 to go: 4, Columbus and Toronto in).
      const reach = Math.max(3, Math.round(more(rows[edge - 1]) / 5));
      // (Those in: as close to the first side out; those out: to the last side in.)
      const fight = out.filter((x, k) => x.best <= edge && x.worst > edge && lo[k] >= lo[edge - 1] - reach && lo[k] <= lo[edge] + reach);
      // Two to eight sides: more is half the table bunched (a Champions
      // League table after four matchdays; any league early on), not a fight.
      const pts = fight.map(x => lo[out.indexOf(x)]);
      if (fight.length > 1 && fight.length <= 8) {
        z.fight = { rows: fight.map(x => x.row), spread: Math.max(...pts) - Math.min(...pts) };
      }
    }
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
// A weekend's column in ESPN's F1 table ({ key, name }), by the weekend's
// name: ESPN's own ("Singapore Airlines Singapore Grand Prix") or F1's
// ("Singapore Grand Prix"), the one inside the other.
export function roundOf(group, name) {
  const want = plain(name);
  return (want && group?.rounds?.find(r => plain(r.name) === want || plain(r.name).includes(want) || want.includes(plain(r.name)))) || null;
}
// Whether ESPN's table has a weekend's sprint or race in: its column has
// numbers (the race: more than a sprint's whole 36, on a sprint weekend).
// No column found: taken as in (never counted twice).
export function roundCounted(group, name, abbr, sprintWeekend = false) {
  const col = roundOf(group, name)?.key;
  if (!col) return true;
  const sum = group.rows.reduce((a, r) => a + (/\d/.test(String(r.stats?.[col] ?? '')) ? num(r.stats[col]) : 0), 0);
  const counted = group.rows.some(r => /\d/.test(String(r.stats?.[col] ?? '')));
  return abbr === 'Race' && sprintWeekend ? sum > SPRINT_TOTAL : counted;
}
function liveRacing(groups, events, teamOf) {
  if (!groups?.length) return groups;
  const out = groups.map(g => ({ ...g, rows: g.rows.map(r => ({ ...r, stats: { ...r.stats } })) }));
  const weekends = new Map();
  for (const e of events || []) if (e.sessions?.length && !weekends.has(e.weekend || e.id)) weekends.set(e.weekend || e.id, e);
  let fresh = 0;
  for (const e of weekends.values()) {
    // Only a sprint or race that's over: the order while it runs isn't points
    // (the table moved with every pass during a session, 2026-10-10).
    const scoring = e.sessions.filter(x => POINTS[x.abbr] && x.status?.state === 'post' && x.field?.length);
    if (!scoring.length) continue;
    let added = false;
    for (const g of out) {
      const todo = scoring.filter(x => !roundCounted(g, e.enName || e.name, x.abbr, e.sessions.some(y => y.abbr === 'SR')));
      if (!todo.length) continue;
      const col = roundOf(g, e.enName || e.name)?.key;
      const team = !g.rows.some(r => r.athlete);
      for (const x of todo)
        x.field.forEach((side, i) => {
          const pts = POINTS[x.abbr][i];
          if (!pts) return;
          const r = team ? g.rows.find(r => teamOf && teamOf(side) && sameTeam(teamOf(side), r)) : g.rows.find(r => r.id === side.id);
          if (!r) return;
          r.stats.PTS = String(num(r.stats.PTS) + pts);
          // (The weekend's own column too: a driver's page lists each weekend's points.)
          if (col) r.stats[col] = String(num(r.stats[col]) + pts);
          r.fresh = r.fresh || 'post';
        });
      g.rows.sort((a, b) => num(b.stats.PTS) - num(a.stats.PTS));
      const top = num(g.rows[0].stats.PTS);
      g.rows.forEach((r, i) => ((r.stats.GAP = i === 0 ? '-' : String(top - num(r.stats.PTS))), r.stats.RK != null && (r.stats.RK = String(i + 1))));
      added = true;
    }
    if (added) fresh++;
  }
  out.fresh = fresh;
  out.year = groups.year;
  return out;
}
const plain = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
const sameTeam = (name, r) => {
  const [a, b] = [plain(name), plain(r.en || r.name)];
  return Boolean(a && b) && (a.includes(b) || b.includes(a));
};
