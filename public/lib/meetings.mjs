// The meetings card's bar (近期交手, 上季對戰, 本季對戰): one bar across the
// card, under the counts it splits. Its pieces left to right, [class,
// flex-grow]: the left side's wins from its end, the draws grey between,
// the right side's wins from its end (Jay 2026-11-03: a pip a meeting under
// each side left the middle empty). A dozen meetings or fewer, a piece each;
// meetings the counts don't cover (none should be) are grey; more than a
// dozen, one piece a kind.
export const PIECE_EACH = 12;
export function h2hPieces([[left, l], [right, r]], draws, n) {
  const rest = Math.max(0, n - l - r - draws);
  const kinds = [[left, l], ['draw', draws + rest], [right, r]].filter(([, k]) => k > 0);
  return n <= PIECE_EACH ? kinds.flatMap(([c, k]) => Array.from({ length: k }, () => [c, 1])) : kinds;
}
