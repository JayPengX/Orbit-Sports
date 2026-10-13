// Who's on the floor or the pitch now, in a game on (the owner, 2026-10-13:
// the starting lineup's card, but live). From ESPN's game summary, as
// parseSummary keeps it:
//   - basketball: the box score marks each player `active` while he's on
//     the court (checked against every substitution of three NBA games,
//     2026-10-13: five a side each time);
//   - soccer: the rosters' `active` is the matchday squad, not the pitch, so
//     the eleven are counted: the starters and those subbed on, less those
//     subbed off or sent off. A sub stands in the place of the one he
//     replaced (the formation's slot), so the eleven keep the formation's order.

// Basketball: each side's five, with the numbers that matter now (and
// whether each started: the box score's own mark).
// players: parseSummary's [{ team, tables: [{ labels, rows }] }].
export function onCourt(players) {
  return (players || []).map(p => {
    const tb = p.tables?.[0];
    const at = k => tb?.labels?.indexOf(k) ?? -1;
    const num = (r, k) => (at(k) >= 0 ? r.stats?.[at(k)] ?? '' : '');
    const list = (tb?.rows || []).filter(r => r.on).map(r => ({ ...r, line: { pts: num(r, 'PTS'), reb: num(r, 'REB'), ast: num(r, 'AST'), pf: num(r, 'PF'), min: num(r, 'MIN') } }));
    return { team: p.team, players: list };
  }).filter(s => s.players.length);
}

// Soccer: each side's players on the pitch, in the formation's order; and
// those who came off (subbed off, sent off), and the bench not yet used.
// rosters: parseSummary's [{ team, formation, players }].
export function onPitch(rosters) {
  return (rosters || []).map(r => {
    const byId = new Map(r.players.map(p => [p.id, p]));
    // The slot a player stands in: his own, else the one of whom he replaced (and so on back).
    const slot = (p, seen = new Set()) => {
      if (p.place > 0) return p.place;
      const was = byId.get(p.inFor);
      if (!was || seen.has(was.id)) return 99;
      seen.add(p.id);
      return slot(was, seen);
    };
    const played = r.players.filter(p => p.starter || p.subbedIn);
    // A sub on the pitch: the position of the slot he took (his own is "SUB").
    const posOf = p => (p.place > 0 || !p.inFor ? p.pos : posOf(byId.get(p.inFor) || { pos: p.pos, place: 1 }));
    const on = played.filter(p => !p.subbedOut && !p.sentOff).map(p => (p.subbedIn ? { ...p, pos: posOf(p) } : p)).sort((a, b) => slot(a) - slot(b));
    const off = played.filter(p => p.subbedOut || p.sentOff);
    const bench = r.players.filter(p => !p.starter && !p.subbedIn);
    // Each slot's last holder (a player sent off keeps his slot empty): the pitch's places.
    const held = played.filter(p => !p.subbedOut).map(p => (p.subbedIn ? { ...p, pos: posOf(p) } : p));
    return { team: r.team, formation: r.formation, on, off, bench, held };
  }).filter(s => s.on.length);
}

// Where each player stands, as a broadcast draws the line-ups: rows from his
// own goal (the keeper, then the formation's lines: 4-2-3-1 is four, two,
// three, one) and each row from his side's left to its right. ESPN's slots
// say the line loosely (a 4-2-3-1's two holding midfielders come as LM and
// RM), so the players go into the formation's rows by how deep each
// position plays, then across by its side. held: onPitch's (sent off too,
// so the shape stays), formation: "4-2-3-1".
// Returns [{ p, x, y }]: x 0..1 from his side's left, y 0..1 from his own goal line to halfway.
const DEPTH = { G: 0, GK: 0, SW: 0.8, CD: 1, CB: 1, D: 1, LB: 1, RB: 1, LWB: 1.6, RWB: 1.6, WB: 1.6, DM: 2, CM: 2.5, M: 2.5, LM: 2.6, RM: 2.6, AM: 3, LW: 3.5, RW: 3.5, F: 4, CF: 4, ST: 4, FW: 4 };
const depthOf = pos => {
  const a = String(pos || '').toUpperCase();
  return DEPTH[a] ?? DEPTH[a.replace(/-[LR]$/, '')] ?? 2.5;
};
const sideOf = pos => {
  const a = String(pos || '').toUpperCase();
  if (/-L$/.test(a)) return -1;
  if (/-R$/.test(a)) return 1;
  if (/^L/.test(a)) return -2;
  if (/^R/.test(a)) return 2;
  return 0;
};
export function pitchSpots(held, formation) {
  const keeper = held.find(p => depthOf(p.pos) === 0) || null;
  const field = held.filter(p => p !== keeper).sort((a, b) => depthOf(a.pos) - depthOf(b.pos) || (a.place || 99) - (b.place || 99));
  let counts = String(formation || '').split('-').map(Number).filter(n => n > 0);
  // No formation, or one that doesn't add up: a row for each depth there is.
  if (counts.reduce((a, b) => a + b, 0) !== field.length) {
    counts = [];
    let last = null;
    for (const p of field) {
      const d = Math.round(depthOf(p.pos));
      if (d === last) counts[counts.length - 1]++;
      else counts.push(1), (last = d);
    }
  }
  const rows = [];
  let at = 0;
  for (const n of counts) rows.push(field.slice(at, (at += n)));
  // The keeper clear of his goal line (his name under him); the lines from
  // a quarter of the way up the half to a tenth short of halfway: four lines
  // a face and a name apart (a 4-2-3-1's), the two sides' forwards still
  // apart (measured at 375 px in WebKit, 2026-10-13).
  const out = keeper ? [{ p: keeper, x: 0.5, y: 0.08 }] : [];
  rows.forEach((row, i) => {
    const y = rows.length === 1 ? 0.55 : 0.27 + (0.63 * i) / (rows.length - 1);
    row.sort((a, b) => sideOf(a.pos) - sideOf(b.pos) || (a.place || 99) - (b.place || 99));
    row.forEach((p, j) => out.push({ p, x: 0.08 + (0.84 * (j + 0.5)) / row.length, y }));
  });
  return out;
}
