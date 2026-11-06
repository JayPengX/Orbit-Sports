// A picture drawn again the same (a logo, a headshot) is the one already on
// screen, moved over: a new <img>, even of a file the phone holds, is blank a
// frame or more while it decodes, and every live refresh (the game sheet's
// every few seconds, the lists' scores) flashed every logo. ui.js `put`.
//
// Swapped, never taken: the new drawing's picture goes where the old one was.
// A part drawn once and kept to be put back (the team page's 概況, kept while
// 賽程 shows) gave its logos to 賽程's same game and came back with none
// (Jay 2026-11-05: 火箭 vs 太陽 with no logos after 概況 → 賽程 → 概況);
// swapped, it has a picture of its own again, and the drawn one comes back
// to it the same way.

// A picture's place: its <picture> (with the dark-screen <source>) or the <img> alone.
const pictureOf = img => (img.parentNode?.tagName === 'PICTURE' ? img.parentNode : img);
// What makes two pictures the same: the files and the img's class (never its
// style: a new one fades in by it).
const pictureKey = img => {
  const pic = pictureOf(img);
  const sources = pic === img ? '' : [...pic.querySelectorAll('source')].map(x => `${x.getAttribute('srcset')} ${x.getAttribute('media')}`).join('|');
  return `${img.getAttribute('src')}#${sources}#${img.className}#${pic === img ? '' : pic.className}`;
};

// node: the box being drawn again; list: its new children (one may be swapped
// in place); keep: the children that stay.
export function keepPictures(node, list, keep) {
  if (!node.firstChild || !list.length) return;
  // The ones on screen now that have drawn, in the children going away.
  const shown = new Map();
  for (const c of node.children) {
    if (keep.has(c)) continue;
    for (const img of c.tagName === 'IMG' ? [c] : c.querySelectorAll('img')) {
      // (Never taken from a card that stays: it would leave it without its picture.)
      if ([...keep].some(k => k.contains?.(img))) continue;
      if (!img.complete || !img.naturalWidth || !img.getAttribute('src')) continue;
      const k = pictureKey(img);
      shown.has(k) ? shown.get(k).push(img) : shown.set(k, [img]);
    }
  }
  if (!shown.size) return;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c.nodeType !== 1 || keep.has(c)) continue;
    for (const img of c.tagName === 'IMG' ? [c] : [...c.querySelectorAll('img')]) {
      const was = shown.get(pictureKey(img))?.shift();
      if (!was) continue;
      // (Safari picks a <picture>'s source again when it's put back on the page:
      // a lazy one then waited, never loaded, and drew nothing. Eager, it's the cached one at once.)
      was.loading = 'eager';
      const [from, to] = [pictureOf(img), pictureOf(was)];
      // The two change places (a mark holds the new one's).
      const mark = document.createComment('');
      if (from === c) list[i] = to;
      else from.replaceWith(mark);
      to.replaceWith(from);
      if (from !== c) mark.replaceWith(to);
      // (Each keeps its own alt and title: a name can change language.)
      for (const a of ['alt', 'title']) {
        const [now, old] = [img.getAttribute(a), was.getAttribute(a)];
        now == null ? was.removeAttribute(a) : was.setAttribute(a, now);
        old == null ? img.removeAttribute(a) : img.setAttribute(a, old);
      }
    }
  }
}
