// A player's name in Chinese (Jay, 2026-10-22: every name in Chinese, never
// Nae'Qwan Tomlin in English). Google's transliteration of the whole name
// ("Mr. LeBron James" → 勒布朗·詹姆斯), else of the surname alone (Google
// leaves "Nae'Qwan" in Latin letters: 湯姆林); none at all, the name as it
// is. Kept a month on the phone by the kit's translate.
import { translate } from '#kit/quadra.mjs';

const SUFFIX = /,?\s+(Jr\.?|Sr\.?|II|III|IV|V)$/i;
// Google's answer as a name: the honorific off, its dots one kind (·).
export const cleanZh = s => String(s || '').replace(/(先生|女士|小姐)\s*$/, '').replace(/[‧・•]/g, '·').replace(/\s*·\s*/g, '·').replace(/\s+/g, '').trim();
// Chinese, and no Latin letters left in it.
export const usableZh = s => /[㐀-鿿]/.test(s) && !/[A-Za-z]/.test(s);
const sur = full => String(full || '').replace(SUFFIX, '').trim().split(/\s+/).at(-1) || '';

const known = new Map(); // full name → Promise of { full, short } in Chinese, or null
export function personZh(full) {
  const name = String(full || '').replace(SUFFIX, '').trim();
  if (!name || usableZh(name)) return Promise.resolve(name ? { full: name, short: name } : null);
  if (!known.has(name))
    known.set(
      name,
      (async () => {
        const whole = cleanZh(await translate(`Mr. ${name}`, 'zh-TW', 'en').catch(() => ''));
        if (usableZh(whole) && whole.includes('·')) return { full: whole, short: whole.split('·').at(-1) };
        // (No dot between them, 德雷蒙格林: the surname asked alone for the short form.)
        const last = sur(name).replace(/^\S{1,3}\.$/, '');
        const one = last && last !== name ? cleanZh(await translate(`Mr. ${last}`, 'zh-TW', 'en').catch(() => '')) : '';
        if (usableZh(whole)) return { full: usableZh(one) && whole.endsWith(one) && whole !== one ? `${whole.slice(0, -one.length)}·${one}` : whole, short: usableZh(one) ? one : whole };
        return usableZh(one) ? { full: one, short: one } : null;
      })()
    );
  return known.get(name);
}
