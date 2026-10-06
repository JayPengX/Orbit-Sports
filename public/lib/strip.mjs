// The days a date strip shows: `only` (a league's or a sport's game days,
// the whole season's) as they are, else every day of `range` around `base`
// (days from it); the day picked always among them. Dates 'YYYY-MM-DD'.
const plus = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
export function stripDays(current, { only = null, range = { from: -30, to: 45 }, base }) {
  const list = only ? [...only] : Array.from({ length: range.to - range.from + 1 }, (_, i) => plus(base, range.from + i));
  if (current && !list.includes(current)) list.push(current);
  return [...new Set(list)].sort();
}
