// What a game's change of state is, for a notice on this device: 'start'
// when it goes on, 'end' when it is truly over, else null. A game called off
// (postponed, canceled) or suspended is "post" in ESPN's state but has no
// result: it is never a final, so no score is announced for it.
export const isFinal = s => s?.state === 'post' && !s.void && !/SUSPENDED/.test(s.name || '');
export function transition(was, status) {
  if (!was || was === status?.state) return null;
  if (status?.state === 'in') return 'start';
  return isFinal(status) ? 'end' : null;
}
