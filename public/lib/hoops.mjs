// A basketball player's season beyond ESPN's four numbers (Jay 2026-11-09:
// "Add significantly more individual player statistics and data, especially
// for basketball players"). From his season's own game log (the regular
// season, the games he played and that are over):
//   - shooting as the game reads it now: true shooting (points per shot, a
//     trip to the line 0.44 of a shot: Basketball-Reference's TS%), effective
//     field goal (a three counts 1.5 makes), two-point %, how many of his
//     shots are threes, how often he gets to the line (FTA per FGA);
//   - per 36 minutes (a bench player beside a starter) and assists per turnover;
//   - his games: double-doubles, triple-doubles, 20- and 30-point nights;
//   - his highs, each with its game;
//   - his last five against his season (form), and his points game by game.
// ESPN's splits (home and road, wins and losses, each month) are read apart
// (`parseSplits`).

const FIVE = ['PTS', 'REB', 'AST', 'STL', 'BLK'];

export function hoopsSeason(log) {
  const at = k => log?.labels?.indexOf(k) ?? -1;
  if (!log || at('PTS') < 0 || at('FG') < 0 || at('MIN') < 0) return null;
  const raw = (g, k) => (at(k) < 0 ? '' : String(g.stats[at(k)] ?? '').trim());
  const num = (g, k) => Number(raw(g, k)) || 0;
  const pair = (g, k) => {
    const m = /^(\d+)-(\d+)$/.exec(raw(g, k));
    return m ? [Number(m[1]), Number(m[2])] : [0, 0];
  };
  // (A game he sat out reads '' or DNP: not a game of his.)
  const games = log.games.filter(g => !g.pre && !g.live && /^\d+$/.test(raw(g, 'PTS')) && num(g, 'MIN') > 0);
  if (!games.length) return null;
  const sum = (list, k) => list.reduce((n, g) => n + num(g, k), 0);
  const sumPair = (list, k) => list.reduce(([m, a], g) => { const [x, y] = pair(g, k); return [m + x, a + y]; }, [0, 0]);
  const totals = list => {
    const [fgm, fga] = sumPair(list, 'FG');
    const [tpm, tpa] = sumPair(list, '3PT');
    const [ftm, fta] = sumPair(list, 'FT');
    const t = { n: list.length, min: sum(list, 'MIN'), fgm, fga, tpm, tpa, ftm, fta };
    for (const k of ['PTS', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PF']) t[k] = sum(list, k);
    return t;
  };
  const t = totals(games);
  const pct = (m, a) => (a ? (100 * m) / a : null);
  const per = (x, n) => (n ? x / n : null);
  // A game's ten in two (or three) of the five: a double-double (a triple-double).
  const tens = g => FIVE.filter(k => at(k) >= 0 && num(g, k) >= 10).length;
  // His highs: the most in a game, its newest game when he did it more than once.
  const high = (k, value) => {
    let best = null;
    for (const g of games) {
      const v = value(g);
      if (v > 0 && (!best || v > best.value)) best = { key: k, value: v, game: g };
    }
    return best;
  };
  const highs = [
    high('PTS', g => num(g, 'PTS')),
    high('REB', g => num(g, 'REB')),
    high('AST', g => num(g, 'AST')),
    high('3PM', g => pair(g, '3PT')[0]),
    high('STL', g => num(g, 'STL')),
    high('BLK', g => num(g, 'BLK'))
  ].filter(Boolean);
  // Form: the last five he played (the log is newest first) against the season, once there's a season to set them against.
  const last = games.slice(0, 5);
  const l = totals(last);
  const line = x => ({ pts: per(x.PTS, x.n), reb: per(x.REB, x.n), ast: per(x.AST, x.n), fg: pct(x.fgm, x.fga), min: per(x.min, x.n) });
  return {
    games: t.n,
    shooting: {
      ts: t.fga + t.fta ? (100 * t.PTS) / (2 * (t.fga + 0.44 * t.fta)) : null,
      efg: pct(t.fgm + 0.5 * t.tpm, t.fga),
      two: pct(t.fgm - t.tpm, t.fga - t.tpa),
      twoMade: [t.fgm - t.tpm, t.fga - t.tpa],
      threeMade: [t.tpm, t.tpa],
      ftMade: [t.ftm, t.fta],
      threeRate: pct(t.tpa, t.fga),
      ftRate: pct(t.fta, t.fga)
    },
    per36: t.min ? { pts: (36 * t.PTS) / t.min, reb: (36 * t.REB) / t.min, ast: (36 * t.AST) / t.min, stocks: (36 * (t.STL + t.BLK)) / t.min } : null,
    astTo: t.TO ? t.AST / t.TO : null,
    counts: {
      dd: games.filter(g => tens(g) >= 2).length,
      td: games.filter(g => tens(g) >= 3).length,
      p20: games.filter(g => num(g, 'PTS') >= 20).length,
      p30: games.filter(g => num(g, 'PTS') >= 30).length,
      p40: games.filter(g => num(g, 'PTS') >= 40).length
    },
    highs,
    form: games.length >= 8 ? { n: l.n, last: line(l), season: line(t) } : null,
    // His points game by game, oldest first (a bar each, its result's colour).
    points: games
      .slice()
      .reverse()
      .map(g => ({ pts: num(g, 'PTS'), reb: num(g, 'REB'), ast: num(g, 'AST'), result: g.result || '', game: g }))
  };
}

// ESPN's splits for a player (its /splits read): each split's numbers by
// label, the ones a person asks about kept (home and road, wins and losses,
// each month), in that order. `null` when there's nothing to split.
const KEEP = [
  ['split', /^home$/i, 'home'],
  ['split', /^road$/i, 'road'],
  ['byResult', /^wins$/i, 'wins'],
  ['byResult', /^losses$/i, 'losses'],
  ['byMonth', /^(january|february|march|april|may|june|july|august|september|october|november|december)$/i, 'month']
];
const MONTH = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
export function parseSplits(data) {
  const labels = data?.labels || [];
  if (!labels.length) return null;
  const rows = [];
  for (const [cat, re, kind] of KEEP)
    for (const sp of (data.splitCategories || []).find(c => c.name === cat)?.splits || []) {
      if (!re.test(String(sp.displayName || '').trim())) continue;
      const stats = Object.fromEntries(labels.map((k, i) => [k, String(sp.stats?.[i] ?? '')]));
      if (!(Number(stats.GP) > 0)) continue;
      rows.push({ kind, name: sp.displayName, month: kind === 'month' ? MONTH[String(sp.displayName).toLowerCase()] : 0, stats });
    }
  return rows.length >= 2 ? { title: data.displayName || '', rows } : null;
}

// A figure as it's shown: one decimal, or a dash.
export const fig = (v, d = 1) => (v == null || !Number.isFinite(v) ? '–' : v.toFixed(d));
