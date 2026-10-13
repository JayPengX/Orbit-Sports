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

// Basketball: each side's five, with the numbers that matter now.
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
    return { team: r.team, formation: r.formation, on, off, bench };
  }).filter(s => s.on.length);
}
