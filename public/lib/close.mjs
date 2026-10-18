// "The game is close": a game on now in its last stretch with the score
// within reach. Basketball: the 4th quarter or overtime, 5 minutes or less
// left, 5 points or fewer apart. Baseball: the 8th, a run apart, or the 9th
// on, two or fewer. Soccer: the 80th minute on, a goal or none apart.
// e: a match ({ status, home, away }); → true or false.
const secs = clock => {
  const s = String(clock || '').trim();
  const m = /^(\d+):(\d{2})/.exec(s);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
};
export function closeGame(e, sport) {
  const s = e?.status;
  if (!s || s.state !== 'in' || s.void || s.delayed) return false;
  const a = Number(e.away?.score);
  const h = Number(e.home?.score);
  if (!(e.away?.score !== '' && e.home?.score !== '' && Number.isFinite(a) && Number.isFinite(h))) return false;
  const gap = Math.abs(a - h);
  const n = s.period || 0;
  if (sport === 'basketball') return n >= 4 && gap <= 5 && secs(s.clock) <= 300 && !/END_PERIOD|HALFTIME/.test(s.name || '');
  if (sport === 'baseball') return n >= 8 && gap <= (n >= 9 ? 2 : 1);
  if (sport === 'soccer') {
    const minute = parseInt(String(s.clock || s.short || ''), 10);
    return Number.isFinite(minute) && minute >= 80 && gap <= 1 && !/HALFTIME|SHOOTOUT/.test(s.name || '');
  }
  return false;
}
