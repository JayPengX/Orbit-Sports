// An F1 driver's page, the numbers behind it (sheets.js openPlayer): his
// season race by race, oldest first, and how he stands against his teammate.

// Each race this season, oldest first: { round, e, name, pos, out, text,
// grid, sprint, points } from formula1.com's weekends (each { round, e,
// me: { result, grid, sprint } }, latest first) where they're in, else
// ESPN's finishes ({ e, pos, sprint }, latest first). `finish` reads a
// result (lib/f1.mjs finishOf); `pts` a place's points when only ESPN's are in.
export function seasonRuns(weekends, raceRows, finish, pts = () => 0) {
  if (weekends?.length)
    return weekends
      .map(w => {
        const f = finish(w.me?.result);
        const sp = finish(w.me?.sprint);
        return {
          round: Number(w.round) || 0,
          e: w.e || null,
          name: w.e?.name || w.name || '',
          pos: f?.pos || 0,
          out: Boolean(f?.out),
          text: f?.text || '',
          why: f?.why || '',
          grid: Number(w.me?.grid) || 0,
          sprint: sp ? (sp.out ? -1 : sp.pos) : 0,
          points: Number(w.me?.result?.points || 0) + Number(w.me?.sprint?.points || 0),
          ran: Boolean(f)
        };
      })
      .filter(r => r.ran)
      .reverse();
  return (raceRows || [])
    .map((r, i, all) => ({ round: Number(r.e?.round) || all.length - i, e: r.e || null, name: r.name || r.e?.name || '', pos: r.pos, out: false, text: `P${r.pos}`, why: '', grid: 0, sprint: r.sprint || 0, points: pts(r.pos, r.sprint), ran: true }))
    .reverse();
}

// The season in a few numbers: wins, podiums, the best and the average
// finish (of the races he finished), retirements.
export function seasonSums(runs) {
  const done = runs.filter(r => !r.out && r.pos);
  return {
    races: runs.length,
    wins: done.filter(r => r.pos === 1).length,
    podiums: done.filter(r => r.pos <= 3).length,
    best: done.length ? Math.min(...done.map(r => r.pos)) : 0,
    average: done.length ? done.reduce((n, r) => n + r.pos, 0) / done.length : 0,
    outs: runs.filter(r => r.out).length
  };
}

// Him against his teammate in the weekends both drove: who finished ahead
// in the race, who qualified ahead. Each session: { abbr, status: { state },
// field: [{ id }] } in finishing order (ESPN's).
export function mateDuel(events, me, mate) {
  const tally = abbr => {
    let ahead = 0;
    let behind = 0;
    for (const e of events || []) {
      const s = (e.sessions || []).find(x => x.abbr === abbr && x.status?.state === 'post');
      const a = s ? s.field.findIndex(c => String(c.id) === String(me)) : -1;
      const b = s ? s.field.findIndex(c => String(c.id) === String(mate)) : -1;
      if (a >= 0 && b >= 0) a < b ? ahead++ : behind++;
    }
    return [ahead, behind];
  };
  return { race: tally('Race'), quali: tally('Qual') };
}
