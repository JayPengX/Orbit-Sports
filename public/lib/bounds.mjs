// The days that can be asked for: Shared-Data's sports/bounds.json, each
// league's { from, to } ('YYYY-MM-DD', Taiwan's): its first kept game (this
// season's first, preseason too, once begun; last season's first before)
// to its season's last possible day (playoffs included). The date strips
// and 📅 stop there, and no day outside is read through the proxy: nothing
// is kept there, and next season's schedule comes in once this one is over.

// A league's, or null (not read, or none known: nothing locked).
export const boundsOf = (all, league) => {
  const b = all?.[league];
  return b?.from && b?.to ? { from: b.from, to: b.to } : null;
};
// Several leagues' together (home: every league the app has): the earliest
// first day to the latest last one; null when none is known.
export function unionBounds(all, leagues) {
  const list = leagues.map(k => boundsOf(all, k)).filter(Boolean);
  if (!list.length) return null;
  return { from: list.map(b => b.from).sort()[0], to: list.map(b => b.to).sort().at(-1) };
}
// Whether a day can be asked for (no bounds: any).
export const within = (d, b) => !b || (d >= b.from && d <= b.to);
// A day brought inside them.
export const clampDay = (d, b) => (!b ? d : d < b.from ? b.from : d > b.to ? b.to : d);
