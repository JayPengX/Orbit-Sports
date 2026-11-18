// A game's recap on 首頁 (who decided it for each side, sheets.js used to
// hold it) and the few helpers it shares with the game sheets: kept apart so
// 首頁 draws without the sheets' code, read only when a sheet or another
// tab first needs it (app.js `sheets`; 11-18: the sheets and what only they
// use are 240 KB of the 560 KB a first opening waited for on a slow link).
import * as kitUI from '#kit/ui.mjs';
import { statName, leaderValue } from './lib/statnames.mjs';
import { esc } from './lib/text.mjs';
import { LEAGUES } from './lib/leagues.mjs';
import { ctx, el, personPic, sidesOf } from './ui.js';

const L = () => ctx.locale;
// A player's name in English in both languages (Jay, 2026-10-23: never
// 多諾萬·米切爾; teams stay in Chinese): `full` the whole name ("Donovan
// Mitchell"), `short` the box score's ("D. Mitchell").
export const playerName = (full, form = 'full', shown = full) => (form === 'full' ? full || shown : shown || full) || '';

// The game's sides in the order the cards show them (soccer home first, the rest away first).
export const homeFirst = e => String(sidesOf(e)[0]?.id) === String(e.home?.id);
export const inOrder = (e, [away, home]) => (homeFirst(e) ? [home, away] : [away, home]);

// A name's short form: the given names to initials (Alexander Albon, A. Albon).
export const shortWords = n => {
  const w = String(n || '').trim().split(/\s+/);
  return w.length > 1 ? `${w[0][0]}. ${w.slice(1).join(' ')}` : w[0] || '';
};

// Wider than its box, measured exactly (scrollWidth rounds: "George Russell"
// 0.7px over its 105 read as fitting, and was cut to "George Russ…").
export const overflows = n => {
  if (n.scrollWidth > n.clientWidth) return true;
  const r = document.createRange();
  r.selectNodeContents(n);
  return r.getBoundingClientRect().width > n.getBoundingClientRect().width + 0.1;
};

// Words said several ways, fullest first: the first that fits its box on
// one line, else the last made smaller (lineWatch).
const choiceWatch = typeof ResizeObserver === 'function'
  ? new ResizeObserver(list => {
      for (const { target: n } of list) {
        // (Built off the page: fitted once it's on it; let go once it's left it.)
        // (A box doesn't change size as it's put on the page: looked at again a frame on, a few times.)
        if (!n.isConnected) {
          choiceWatch.unobserve(n);
          if (!n.dataset.fitted && (n.__tries = (n.__tries || 0) + 1) < 20) requestAnimationFrame(() => choiceWatch.observe(n));
          continue;
        }
        n.dataset.fitted = '1';
        fitWays(n);
        // (Lines said the same way: if one needs the short words, its siblings take them too.)
        if (n.dataset.same) {
          const group = [...(n.parentElement?.parentElement?.querySelectorAll(`[data-same="${n.dataset.same}"]`) || [])];
          if (group.some(x => x.__pick?.tight)) group.filter(x => !x.__pick?.tight && x.__ways?.some(w => w?.tight)).forEach(x => fitWays(x, w => w?.tight));
          if (group.some(x => x.__pick?.packed)) group.filter(x => !x.__pick?.packed && x.__ways?.some(w => w?.packed)).forEach(x => fitWays(x, w => w?.packed));
          // (And at one size: the smallest one of them needed.)
          const sizes = group.map(x => parseFloat(x.style.fontSize) || 0).filter(Boolean);
          if (sizes.length) group.forEach(x => (x.style.fontSize = `${Math.min(...sizes)}px`));
        }
      }
    })
  : null;
// The first of a box's ways (those `only` allows) that fits on one line, else the last made smaller.
// (A packed way, 26分·4板·3助, only when the others don't fit even made smaller.)
function fitWays(n, only = () => true) {
  const all = (n.__ways || []).filter(only);
  const plain = all.filter(w => !w?.packed);
  fitAmong(n, plain.length ? plain : all);
  if (plain.length && plain.length < all.length && overflows(n)) fitAmong(n, all.filter(w => w?.packed));
}
function fitAmong(n, ways) {
  n.style.fontSize = '';
  for (const w of ways) {
    if (w?.html != null) n.innerHTML = w.html;
    else n.textContent = w;
    n.__pick = w;
    if (!overflows(n)) break;
  }
  for (let i = 0; i < 30 && overflows(n); i++) {
    const size = parseFloat(getComputedStyle(n).fontSize) - 0.5;
    if (size < 10) break;
    n.style.fontSize = `${size}px`;
  }
}
export function fitChoice(n, ways) {
  n.__ways = ways;
  // (A way may be { html }: words with their <b>, escaped where they're made.)
  if (ways[0]?.html != null) n.innerHTML = ways[0].html;
  else n.textContent = ways[0];
  n.classList.add('one-line');
  choiceWatch?.observe(n);
  return n;
}
// A game over on a light day's 首頁 (Jay 2026-10-23): who decided it for
// each side, by what decides the sport (never a stat that misleads, Jay:
// not shots for a forward who didn't score in a 3-1). The ways to see it
// again (回看, 精華) stay on its page (2026-10-25), not on the card.
const boxNum = v => parseFloat(String(v ?? '').replace(/[^\d.-]/g, '')) || 0;
function sideStar(d, e, team) {
  const en = L() === 'en';
  const sport = LEAGUES[e.league]?.sport;
  const tables = (d?.players || []).find(p => p.team === team)?.tables || [];
  const col = (t, ...labels) => t.labels.findIndex(x => labels.includes(x));
  const rowsWith = (...labels) => tables.filter(t => col(t, ...labels) >= 0).flatMap(t => t.rows.map(r => ({ r, t })));
  const val = ({ r, t }, ...labels) => boxNum(r.stats[col(t, ...labels)]);
  const join = parts => parts.filter(Boolean).join(' · ');
  if (sport === 'soccer') {
    // The goals (an own goal is the other side's), with their minutes; then
    // the assists; then a keeper who kept them in it.
    const goals = new Map();
    for (const k of d?.keyEvents || []) if (k.scoring && k.team === team && k.pic?.id && !/own/i.test(`${k.kind} ${k.type} ${k.text}`)) goals.set(k.pic.id, [...(goals.get(k.pic.id) || []), k.clock]);
    const all = rowsWith('G', 'A');
    const row = id => all.find(x => x.r.id === id);
    const [id, mins] = [...goals].sort((x, y) => y[1].length - x[1].length)[0] || [];
    if (id) {
      const x = row(id);
      const ast = x ? val(x, 'A') : 0;
      const ke = d.keyEvents.find(k => k.pic?.id === id);
      return { p: x?.r || { id, name: ke.who, full: ke.pic.name, headshot: ke.pic.headshot }, line: join([`${en ? 'Goal' : '進球'} ${mins.join(en ? ', ' : '、')}`, ast ? (en ? `${ast} assist${ast > 1 ? 's' : ''}` : `${ast} 助攻`) : '']) };
    }
    const a = all.filter(x => val(x, 'A') > 0).sort((x, y) => val(y, 'A') - val(x, 'A'))[0];
    if (a) return { p: a.r, line: en ? `${val(a, 'A')} assist${val(a, 'A') > 1 ? 's' : ''}` : `${val(a, 'A')} 助攻` };
    const k = rowsWith('SV').filter(x => val(x, 'SV') >= 3).sort((x, y) => val(y, 'SV') - val(x, 'SV'))[0];
    return k ? { p: k.r, line: en ? `${val(k, 'SV')} saves` : `${val(k, 'SV')} 次撲救` } : null;
  }
  if (sport === 'basketball') {
    const x = rowsWith('PTS').sort((p, q) => val(q, 'PTS') - val(p, 'PTS'))[0];
    if (!x || !val(x, 'PTS')) return null;
    return { p: x.r, line: en ? join([`${val(x, 'PTS')} PTS`, `${val(x, 'REB')} REB`, `${val(x, 'AST')} AST`]) : join([`${val(x, 'PTS')} 分`, `${val(x, 'REB')} 籃板`, `${val(x, 'AST')} 助攻`]), tight: en ? null : join([`${val(x, 'PTS')} 分`, `${val(x, 'REB')} 板`, `${val(x, 'AST')} 助`]) };
  }
  if (sport === 'baseball') {
    // A starter who shut them down, else the bat that drove the runs in,
    // else whoever pitched longest.
    const outs = x => { const ip = String(x.r.stats[col(x.t, 'IP')] || '0').split('.'); return Number(ip[0]) * 3 + Number(ip[1] || 0); };
    const arms = rowsWith('IP').filter(x => x.t.name === 'pitching' || col(x.t, 'ERA') >= 0).sort((p, q) => outs(q) - outs(p));
    const arm = arms[0];
    const armLine = x => (en ? join([`${x.r.stats[col(x.t, 'IP')]} IP`, `${val(x, 'K')} K`, `${val(x, 'ER')} ER`]) : join([`${x.r.stats[col(x.t, 'IP')]} 局`, `${val(x, 'K')} 次三振`, `失 ${val(x, 'ER')} 分`]));
    const armTight = x => (en ? null : join([`${x.r.stats[col(x.t, 'IP')]} 局`, `${val(x, 'K')}K`, `失 ${val(x, 'ER')}`]));
    if (arm && outs(arm) >= 18 && val(arm, 'ER') <= 1) return { p: arm.r, line: armLine(arm), tight: armTight(arm) };
    const bats = rowsWith('RBI', 'HR').filter(x => x.t.name !== 'pitching' && col(x.t, 'IP') < 0);
    const weight = x => val(x, 'HR') * 3 + val(x, 'RBI') * 2 + val(x, 'H') + val(x, 'R');
    const bat = bats.filter(x => val(x, 'RBI') > 0 || val(x, 'HR') > 0).sort((p, q) => weight(q) - weight(p))[0];
    if (bat) {
      const h = val(bat, 'H');
      const hr = val(bat, 'HR');
      const rbi = val(bat, 'RBI');
      return { p: bat.r, line: en ? join([`${bat.r.stats[col(bat.t, 'H-AB')] || h + ' H'}`, hr ? `${hr > 1 ? hr + ' ' : ''}HR` : '', rbi ? `${rbi} RBI` : '']) : join([h ? `${h} 安` : '', hr ? `${hr} 轟` : '', rbi ? `${rbi} 分打點` : '']), tight: en ? null : join([h ? `${h} 安` : '', hr ? `${hr} 轟` : '', rbi ? `${rbi} 打點` : '']) };
    }
    return arm ? { p: arm.r, line: armLine(arm), tight: armTight(arm) } : null;
  }
  // Anything else: the game's own first leader, its stat named.
  const l = (d?.leaders || []).find(x => x.team === team && x.name);
  return l ? { p: l, line: `${statName(l.stat, L(), { sport })} ${leaderValue(l.value, L())}` } : null;
}
export function gameRecap(e, d) {
  const sides = inOrder(e, [e.away, e.home]);
  // Still being read (d null): its lines held in their shape from the first
  // drawing, a face and a line a side (football's: a side that scored), so
  // nothing under the card moves when they come (Jay 2026-11-04, "don't
  // jump in this section").
  if (d === null && kitUI.waiting) {
    const n = LEAGUES[e.league]?.sport === 'soccer' ? sides.filter(x => boxNum(x?.score) > 0).length : sides.length;
    return n ? [kitUI.waiting(el('div', { class: 'recap-best' }, sides.slice(0, n).map(() => el('div', { class: 'recap-lead' }, [personPic({ stand: true }, e.league, 'xs round'), el('span', { class: 'recap-text one-line' }, [el('strong', { text: '口口口口' }), el('small', { text: '口口 · 口口' })])]))))] : [];
  }
  const best = sides.map(s => ({ s, star: d ? sideStar(d, e, String(s.id)) : null })).filter(x => x.star);
  // One line a side, under the scores as a race's top three is under its
  // name (Jay 2026-10-27: not two big cards that make one game twice as tall).
  // Never cut (Jay 2026-10-27, "why it text wrap"): the full name first, then
  // its short form (R. Gasser), then the stats' short words (3K, 12 板),
  // then smaller (fitChoice).
  const ways = (p, line, tight) => {
    const full = playerName(p.full || p.name, 'full', p.name);
    const short = p.name && p.name !== full ? p.name : shortWords(full);
    // (The name is one of the two places that open the player, with the face: recapList.)
    const way = (who, what) => ({ html: `<strong class="recap-hit">${esc(who)}</strong><small>${esc(what)}</small>` });
    // (Still too long, a 320 phone's G. Antetokounmpo: the last name alone, never cut.)
    const last = short.replace(/^(\S+\.\s+)+/, '');
    // (`tight`: the stats' short words; a card's lines all take them if one must: recapSame.)
    const t = tight && tight !== line;
    // (And at the last, a 320 phone's Gilgeous-Alexander: the stats packed, 26分·4板·3助, never cut.)
    const packed = t && tight.replace(/(?<=\d) (?=[^\d\s·])/g, '').replace(/ · /g, '·');
    return [way(full, line), way(short, line), ...(t ? [{ ...way(short, tight), tight: true }] : []), ...(last !== short ? [{ ...way(last, tight || line), tight: t }] : []), ...(packed && packed !== tight ? [{ ...way(last, packed), tight: true, packed: true }] : [])];
  };
  // One card, one game (Jay 2026-11-06, iPad: "clicking empty space of that
  // player area will result in opening player not the match"): only a
  // player's face or name opens the player (the face a button, the name
  // `.recap-hit`); anything else on the card opens the game (recapList).
  // `data-side`: the side it stands for (0 away, 1 home), its row beside
  // that side's on a wide card.
  return best.length
    ? [
        el('div', { class: 'recap-best' }, best.map(({ s, star: { p, line, tight } }) => {
          const name = p.full || p.name;
          const open = p.id ? () => ctx.openPlayer(e.league, p.id, { name, logo: p.headshot }) : null;
          const face = personPic({ ...p, name }, e.league, 'xs round');
          const lead = el('div', { class: 'recap-lead', 'data-side': String(sides.indexOf(s)) }, [
            open ? el('button', { class: 'recap-face recap-hit', type: 'button', 'aria-label': name }, [face]) : face,
            fitChoice(el('span', { class: 'recap-text', 'data-same': 'recap' }), ways(p, line, tight))
          ]);
          lead.openPlayer = open;
          return lead;
        }))
      ]
    : [];
}
