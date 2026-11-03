// F1's 過程 (Jay 2026-11-03: "a 過程 like feature like other sports, so we
// can read and know how a driver ended up where they are"): a race told lap
// by lap from what F1's timing keeps of it: each car's place at each lap's
// end (laps.json `places`: lap 0 the grid, 0 a lap not read), its stops,
// race control (the safety cars and red flags with their cause, the
// stewards' penalties, a car stopped on track) and who went out.
//
// raceStory({ cars, places, stops, control, last, over }, { pick, en, nameOf })
//   cars:    the board's cars ({ no, name, pos, grid, retired, stopped, laps, stints })
//   places:  { no: [grid, lap 1, …] }; stops: { no: [[lap, stop s, lane s]…] }
//   control: race control's messages ({ lap, message, flag, at })
//   last:    the laps run (the leader's); over: the flag is out
//   pick:    a car's number: its own race; none: the whole race's turns
// → [{ lap, kind, no, text, sub }], in the order they happened.
// Kinds: grid, start, lead, pass, lost, pit, gain, sc, vsc, red, out,
// penalty, climb, finish.
import { controlBands, causeOf } from './winprob.mjs';
import * as kitWp from '#kit/sports-winprob.mjs';
import { raceControlParts } from './racecontrol.mjs';

const TYRE = { SOFT: ['軟胎', 'softs'], MEDIUM: ['中性胎', 'mediums'], HARD: ['硬胎', 'hards'], INTERMEDIATE: ['半雨胎', 'inters'], WET: ['全雨胎', 'wets'] };
const BAND = { sc: ['安全車', 'Safety car'], vsc: ['虛擬安全車', 'Virtual safety car'], red: ['紅旗', 'Red flag'] };
// (A list of names: three at most, the rest counted.)
const names = (list, en) => (list.length > 3 ? `${list.slice(0, 3).join(en ? ', ' : '、')}${en ? ` and ${list.length - 3} more` : ` 等 ${list.length} 車`}` : list.join(en ? ', ' : '、'));
const P = (n, en) => (en ? `P${n}` : `第 ${n}`);
// As many names as fit one small line beside `tail` ("Hadjar、Hulkenberg 等 進站"), the line above saying how many.
const namesFit = (list, en, tail = '') => {
  for (let k = list.length; k > 1; k--) {
    const said = `${list.slice(0, k).join(en ? ', ' : '、')}${k < list.length ? (en ? ` +${list.length - k}` : ' 等') : ''}`;
    if (ems(`${said}${tail}`) <= STORY_FIT.sub) return said;
  }
  return `${list[0]}${list.length > 1 ? (en ? ` +${list.length - 1}` : ' 等') : ''}`;
};
// How wide a line runs, in ems of its own font: a Chinese character one, a
// Latin letter or digit about half, a space or a dot a quarter.
export const ems = text => [...String(text || '')].reduce((n, ch) => n + (/[\u2e80-\uffff→]/.test(ch) && !/[–·]/.test(ch) ? 1 : /[\s·.,'’]/.test(ch) ? 0.27 : /[A-Z0-9mw]/.test(ch) ? 0.6 : 0.5), 0);
// What fits a phone's one line at 320 (Jay: no wraps): the line at 13.5px, the
// small one under it at 12px, beside the lap, a face and the chevron.
export const STORY_FIT = { main: 11, sub: 12.8 };
// Pieces packed into the fewest lines that fit, " · " between (a flag with its
// cause, corner, medical car and stop runs to two small lines, never a wrap).
const pack = (parts, room) => parts.filter(Boolean).reduce((lines, x) => {
  const last = lines.at(-1);
  if (last != null && ems(`${last} · ${x}`) <= room) lines[lines.length - 1] = `${last} · ${x}`;
  else lines.push(x);
  return lines;
}, []);

// Each car's place at each lap's end, a lap not read carried from the one
// before (never past the car's last lap).
export function placeRuns(places = {}, last = 0) {
  const out = {};
  for (const [no, list] of Object.entries(places || {})) {
    const known = list.map((x, l) => (x > 0 ? l : -1)).filter(l => l >= 0);
    const end = Math.min(last || Infinity, known.at(-1) ?? -1);
    const run = [];
    let now = 0;
    for (let l = 0; l <= end; l++) run[l] = now = list[l] > 0 ? list[l] : now;
    out[no] = run;
  }
  return out;
}

// The laps a car stopped on (its in-laps): the stops' own, else the laps
// flagged in the pit (the first of each run).
export function stopLaps(stops = [], laps = []) {
  if (stops?.length) return stops.map(s => s[0]).filter(Boolean);
  const flagged = (laps || []).filter(x => x[4]).map(x => x[0]);
  return flagged.filter((l, i) => flagged[i - 1] !== l - 1);
}

export function raceStory({ cars = [], places = {}, stops = {}, laps = {}, control = [], last = 0, over = false } = {}, { pick = null, en = false, nameOf = no => `#${no}` } = {}) {
  const W = (zh, e) => (en ? e : zh);
  const run = placeRuns(places, last);
  const nos = Object.keys(run);
  if (!nos.length) return [];
  last = Math.max(last || 0, ...nos.map(no => run[no].length - 1));
  const car = no => cars.find(c => String(c.no) === String(no)) || null;
  const pits = Object.fromEntries(nos.map(no => [no, stopLaps(stops?.[no], laps?.[no])]));
  // A stop shows at its lap's end and the next (the time lost spread over both).
  const pitted = (no, l) => pits[no]?.some(s => s === l || s === l - 1);
  const at = (no, l) => run[no]?.[l] || 0;
  const gridOf = no => places?.[no]?.[0] || car(no)?.grid || 0;
  // Out: a car marked retired or stopped, at its last lap read.
  const outLap = no => (car(no)?.retired || car(no)?.stopped || (over && run[no].length - 1 < last - 1) ? run[no].length - 1 : 0);
  const bands = controlBands(control, m => Number(m.lap) || 0, last).map(([from, to, kind, m]) => {
    const t = m?.at ? Date.parse(m.at) / 1000 : null;
    const out = nos.filter(no => outLap(no) && outLap(no) >= from - 4 && outLap(no) <= from).map(nameOf);
    const why = causeOf(control.map(x => ({ t: Date.parse(x.at) / 1000, message: x.message })), t, out, nameOf);
    // The corner, from a car stopped near it ("CAR 77 (BOT) STOPPED AT TURN 1"), and the medical car.
    // (As the live banner reads it, lib/f1.mjs flagNow: the marshals' or a stopped car's corner, from just before it.)
    const near = control.filter(x => t != null && Date.parse(x.at) / 1000 >= t - 90 && Date.parse(x.at) / 1000 <= t + 600);
    const turn = near.map(x => x.message.match(/(?:MARSHALS|RECOVERY VEHICLE) ON TRACK (?:AT|BEFORE) TURN (\d+)|STOPPED (?:ON TRACK )?AT TURN (\d+)/)).find(Boolean);
    const medical = near.some(x => /^MEDICAL CAR (DEPLOYED|ON TRACK)/.test(x.message));
    // A red flag's stop: from it to the restart.
    const back = kind === 'red' && t != null ? control.find(x => Date.parse(x.at) / 1000 > t && /^SESSION (STARTED|RESUMED)$|^(STANDING|ROLLING) START\b/.test(x.message)) : null;
    return { from, to: Math.max(from, to), kind, why, turn: turn ? turn[1] || turn[2] : '', medical, t, stop: back ? Math.round((Date.parse(back.at) / 1000 - t) / 60) : 0 };
  });
  // A safety car turned red flag (the same crash, two laps at most apart): one turn of the race.
  for (let i = bands.length - 1; i > 0; i--) {
    const [a, b] = [bands[i - 1], bands[i]];
    if (b.kind === 'red' && a.kind !== 'red' && b.from - a.from <= 2) bands.splice(i - 1, 2, { ...b, from: a.from, was: a.kind, why: a.why || b.why, turn: a.turn || b.turn, medical: a.medical || b.medical });
  }
  const bandAt = l => bands.find(b => l >= b.from && l <= b.to) || null;
  // (Each line short enough for a phone's one line (Jay: no wraps at 320): the flag and who
  // in the line, the corner, the medical car and how long in the small one under it.)
  // (Two cars or more: how many in the line, their names under it.)
  const many = b => (b.why?.who?.length || 0) > 1;
  const whatOf = b => (b.why?.kind === 'out' ? W('退賽', 'out') : b.why?.kind === 'stopped' ? W('停車', 'stopped') : W('碰撞', 'collided'));
  const whoText = b => (!b.why?.who?.length ? '' : many(b) ? W(`${b.why.who.length} 車${whatOf(b)}`, `${b.why.who.length} cars ${whatOf(b)}`) : `${b.why.who[0]} ${whatOf(b)}`);
  const whereText = b => [many(b) ? names(b.why.who, en) : '', b.turn ? W(`第 ${b.turn} 彎`, `turn ${b.turn}`) : '', b.medical ? W('醫療車', 'medical car') : ''];
  const bandRange = b => (b.stop > 0 ? W(`暫停 ${b.stop} 分鐘`, `stopped ${b.stop} min`) : b.to > b.from ? W(`至第 ${b.to} 圈`, `to lap ${b.to}`) : '');
  // (The flag and who in the line when both fit, else who leads the small lines.)
  const bandLine = b => {
    const where = [...whereText(b), bandRange(b)].filter(Boolean).join(' · ');
    return [`${bandName(b)}${whoText(b) ? ` · ${whoText(b)}` : ''}`, where, whoText(b) ? { text: bandName(b), sub: [whoText(b), where].filter(Boolean).join(' · ') } : null];
  };
  const bandName = b => (b.was ? W(`${BAND[b.was][0]}轉紅旗`, `${BAND[b.was][1]} → red flag`) : BAND[b.kind][en ? 1 : 0]);
  const out = [];
  // A line too wide for a phone takes its shorter form (`short`: its words and
  // what moves under it); the small words go on as many lines as they need.
  const add = (lap, kind, no, text, sub = '', short = null) => {
    if (short && ems(text) > STORY_FIT.main) ({ text, sub = '' } = short);
    out.push({ lap, kind, no: no == null ? null : String(no), text, sub: pack(String(sub || '').split(' · '), STORY_FIT.sub).join('\n') });
  };
  // A car stopped on track or out, in race control's words near its last lap ("在第 1 彎停車").
  const outWhy = no => {
    const l = outLap(no);
    const m = control.find(x => Math.abs((Number(x.lap) || 0) - l) <= 1 && new RegExp(`CARS? ${no} \\(`).test(x.message) && /STOPPED|CRASH|BARRIER|GRAVEL|RETIRED/.test(x.message));
    // Else the safety car or red flag it brought out: its corner (Bottas's: 第 1 彎 · 安全車轉紅旗).
    const b = m ? null : bands.find(x => x.from >= l && x.from <= l + 3 && x.why?.who?.includes(nameOf(no)));
    if (b) return [b.turn ? W(`第 ${b.turn} 彎`, `turn ${b.turn}`) : '', bandName(b)].filter(Boolean).join(' · ');
    if (!m) return '';
    const parts = raceControlParts(m.message, !en);
    return parts.map(x => (typeof x === 'string' ? x : nameOf(x.no))).join('').trim();
  };
  // A steward's penalty: the penalty in the line, its reason (the bracket) under it.
  const penaltyLine = m => {
    if (en) return enPenalty(m.message, nameOf);
    const text = raceControlParts(m.message, !en).map(x => (typeof x === 'string' ? x : nameOf(x.no))).join('').trim();
    const k = en ? text.indexOf(' - ') : text.indexOf('（');
    return k > 0 ? [text.slice(0, k).trim(), text.slice(k).replace(/^\s*-\s*|^（|）$/g, '').trim()] : [text, ''];
  };
  const stintAfter = (no, k) => {
    const c = car(no)?.stints?.[k + 1]?.c;
    return TYRE[c] ? TYRE[c][en ? 1 : 0] : '';
  };
  // Who went from ahead of `no` to behind it (or the other way) between two laps.
  const swapped = (no, l, ahead) =>
    nos.filter(o => {
      if (o === no) return false;
      const [a0, a1, b0, b1] = [at(o, l - 1), at(o, l), at(no, l - 1), at(no, l)];
      if (!a0 || !b0 || !b1) return false;
      // (Out on this lap: no place now.)
      if (!a1) return ahead && a0 < b0 && outLap(o) === l - 1;
      return ahead ? a0 < b0 && a1 > b1 : a0 > b0 && a1 < b1;
    });

  if (pick != null) {
    const no = String(pick);
    if (!run[no]) return [];
    const g = gridOf(no);
    if (g) add(0, 'grid', no, W(`第 ${g} 位起跑`, `Starts P${g}`));
    const p1 = at(no, 1);
    // (The grid not read: lap 1's place alone, nothing said of holding it.)
    if (p1) add(1, 'start', no, !g ? W(`第 1 圈${P(p1, en)}`, `Lap 1: P${p1}`) : p1 !== g ? W(`起跑後 ${P(g, en)} → ${P(p1, en)}`, `Start: P${g} → P${p1}`) : W(`起跑後守住${P(p1, en)}`, `Start: holds P${p1}`), g && p1 !== g ? (p1 < g ? `+${g - p1}` : `−${p1 - g}`) : '');
    const myStops = pits[no] || [];
    let pend = null;
    const flush = () => {
      if (!pend) return;
      const { from, to, l0, l1, kind, who } = pend;
      const laps = l1 > l0 ? W(`第 ${l0}–${l1} 圈`, `laps ${l0}–${l1}`) : '';
      const sub = [`${P(from, en)} → ${P(to, en)}`, laps].filter(Boolean).join(' · ');
      // (Two or more long names: how many in the line, who under it.)
      const many = { text: '', sub: [namesFit(who, en), sub].join(' · ') };
      if (kind === 'pass') add(l1, 'pass', no, W(`超越 ${names(who, en)}`, `Passes ${names(who, en)}`), sub, { ...many, text: W(`超越 ${who.length} 車`, `Passes ${who.length}`) });
      else add(l1, 'lost', no, W(`被 ${names(who, en)} 超越`, `Passed by ${names(who, en)}`), sub, { ...many, text: W(`被 ${who.length} 車超越`, `Passed by ${who.length}`) });
      pend = null;
    };
    const end = run[no].length - 1;
    for (let l = 2; l <= end; l++) {
      const [was, now] = [at(no, l - 1), at(no, l)];
      // My stop: one line for it, the places it cost over its two laps.
      const k = myStops.indexOf(l);
      if (k >= 0) {
        flush();
        const after = at(no, Math.min(end, l + 1)) || now;
        const tyre = stintAfter(no, k);
        const lane = stops?.[no]?.[k]?.[2];
        const still = stops?.[no]?.[k]?.[1];
        // (Under a red flag every car waits in the pit lane: its tyres changed there, not a stop that cost it.)
        const red = bandAt(l)?.kind === 'red' || bandAt(l - 1)?.kind === 'red';
        if (red) add(l, 'pit', no, tyre ? W(`紅旗暫停時換上${tyre}`, `On ${tyre} under red`) : W('紅旗暫停時在維修區等候', 'Waits out the red flag'), was === after ? '' : `${P(was, en)} → ${P(after, en)}`);
        else add(l, 'pit', no, W(`第 ${k + 1} 次進站${tyre ? `，換${tyre}` : ''}`, `Stop ${k + 1}${tyre ? `, onto ${tyre}` : ''}`), [`${P(was, en)} → ${P(after, en)}`, still > 0 ? W(`停 ${still.toFixed(1)} 秒`, `${still.toFixed(1)} s stationary`) : lane > 0 && lane < 120 ? W(`維修區 ${lane.toFixed(1)} 秒`, `${lane.toFixed(1)} s in the lane`) : '', bandAt(l) ? W(`${BAND[bandAt(l).kind][0]}期間`, `under the ${bandAt(l).kind.toUpperCase()}`) : ''].filter(Boolean).join(' · '));
        continue;
      }
      if (!was || !now || was === now || myStops.includes(l - 1)) continue;
      const passed = swapped(no, l, true);
      const by = swapped(no, l, false);
      // Ahead, their stops and their exits: places that came to me.
      const theirStops = passed.filter(o => pitted(o, l));
      const gone = passed.filter(o => !at(o, l));
      const onTrack = passed.filter(o => !theirStops.includes(o) && !gone.includes(o));
      const lostOnTrack = by.filter(o => !pitted(no, l));
      if (theirStops.length || gone.length) {
        flush();
        const why = [theirStops.length ? W(`${names(theirStops.map(nameOf), en)} 進站`, `${names(theirStops.map(nameOf), en)} pitted`) : '', gone.length ? W(`${names(gone.map(nameOf), en)} 退賽`, `${names(gone.map(nameOf), en)} out`) : ''].filter(Boolean).join(W('，', '; '));
        // (Short: who stopped or went out under it, as many names as fit.)
        const whyFit = [theirStops.length ? W(`${namesFit(theirStops.map(nameOf), en, ' 進站')} 進站`, `${namesFit(theirStops.map(nameOf), en, ' pitted')} pitted`) : '', gone.length ? W(`${namesFit(gone.map(nameOf), en, ' 退賽')} 退賽`, `${namesFit(gone.map(nameOf), en, ' out')} out`) : ''].filter(Boolean).join(' · ');
        add(l, 'gain', no, W(`${why}，升到${P(now, en)}`, `${why}: up to P${now}`), `${P(was, en)} → ${P(now, en)}`, { text: W(`升到${P(now, en)}`, `Up to P${now}`), sub: whyFit });
      }
      if (onTrack.length) {
        if (pend?.kind === 'pass' && l - pend.l1 <= 3) Object.assign(pend, { to: now, l1: l, who: [...new Set([...pend.who, ...onTrack.map(nameOf)])] });
        else (flush(), (pend = { kind: 'pass', from: was, to: now, l0: l, l1: l, who: onTrack.map(nameOf) }));
      }
      if (lostOnTrack.length) {
        if (pend?.kind === 'lost' && l - pend.l1 <= 3) Object.assign(pend, { to: now, l1: l, who: [...new Set([...pend.who, ...lostOnTrack.map(nameOf)])] });
        else (flush(), (pend = { kind: 'lost', from: was, to: now, l0: l, l1: l, who: lostOnTrack.map(nameOf) }));
      }
    }
    flush();
    // The safety cars and red flags of its race, for what they did to it.
    for (const b of bands) if (b.from <= end) add(b.from, b.kind, null, ...bandLine(b));
    for (const m of control) if (/PENALTY FOR/.test(m.message) && !/SERVED/.test(m.message) && new RegExp(`CARS? (\\d+ \\(\\w+\\),? (AND )?)*${no} \\(`).test(m.message)) add(Number(m.lap) || 0, 'penalty', no, ...penaltyLine(m));
    const o = outLap(no);
    if (o) add(o, 'out', no, W(`第 ${o} 圈退賽`, `Out on lap ${o}`), outWhy(no));
    else if (over) {
      const f = car(no)?.pos || at(no, end);
      add(last, 'finish', no, W(`完賽${P(f, en)}`, `Finishes P${f}`), g ? (g === f ? W('與起跑相同', 'where it started') : W(`起跑第 ${g}，${f < g ? `進步 ${g - f}` : `退後 ${f - g}`} 名`, `from P${g}, ${f < g ? `+${g - f}` : `−${f - g}`}`)) : '');
    } else add(end, 'now', no, W(`目前${P(at(no, end), en)}`, `Now P${at(no, end)}`), W(`第 ${end} 圈`, `lap ${end}`));
    return order(out);
  }

  // The whole race: its turns.
  const leader = l => nos.find(no => at(no, l) === 1) || null;
  const pole = nos.find(no => gridOf(no) === 1);
  if (pole) add(0, 'grid', pole, W(`${nameOf(pole)} 竿位起跑`, `${nameOf(pole)} on pole`));
  const l1 = leader(1);
  if (l1) add(1, 'lead', l1, pole && pole !== l1 ? W(`${nameOf(l1)} 取得領先`, `${nameOf(l1)} takes the lead`) : W(`${nameOf(l1)} 領先`, `${nameOf(l1)} leads`), !pole ? '' : pole !== l1 ? W(`起跑超越 ${nameOf(pole)}`, `past ${nameOf(pole)} at the start`) : W('起跑守住', 'from pole'));
  // The start's big movers (three places or more on lap 1).
  const moved = nos.filter(no => gridOf(no) && at(no, 1)).map(no => [no, gridOf(no) - at(no, 1)]);
  const up = moved.filter(([, d]) => d >= 3).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const down = moved.filter(([, d]) => d <= -3).sort((a, b) => a[1] - b[1]).slice(0, 3);
  // (Each car's move beside its own name, a small line a car: the names in one long line and
  // their moves in another left a reader matching them up, and wrapped at 390.)
  const moves = list => list.map(([no]) => `${nameOf(no)} ${P(gridOf(no), en)} → ${P(at(no, 1), en)}`).join(' · ');
  const one = ([[no, d]], zh, en2) => [W(`${nameOf(no)} ${zh} ${Math.abs(d)} 名`, `${nameOf(no)} ${en2} ${Math.abs(d)} at the start`), `${P(gridOf(no), en)} → ${P(at(no, 1), en)}`];
  if (up.length) add(1, 'pass', up[0][0], ...(up.length === 1 ? one(up, '起跑升', 'up') : [W(`起跑進步 ${up.length} 車`, `Start: ${up.length} gained`), moves(up)]));
  if (down.length) add(1, 'lost', down[0][0], ...(down.length === 1 ? one(down, '起跑掉', 'down') : [W(`起跑掉位 ${down.length} 車`, `Start: ${down.length} lost`), moves(down)]));
  for (let l = 2; l <= last; l++) {
    const [a, b] = [leader(l - 1), leader(l)];
    if (!a || !b || a === b) continue;
    const why = !at(a, l) ? W(`${nameOf(a)} 退賽`, `${nameOf(a)} out`) : pitted(a, l) && !pitted(b, l) ? W(`${nameOf(a)} 進站`, `${nameOf(a)} pitted`) : '';
    add(l, 'lead', b, W(`${nameOf(b)} ${why ? '接手' : '取得'}領先`, `${nameOf(b)} leads`), why || W(`超越 ${nameOf(a)}`, `past ${nameOf(a)}`));
  }
  for (const b of bands) add(b.from, b.kind, null, ...bandLine(b));
  for (const no of nos) {
    const o = outLap(no);
    if (o) add(o, 'out', no, W(`${nameOf(no)} 退賽`, `${nameOf(no)} out`), outWhy(no));
  }
  for (const m of control) if (/PENALTY FOR/.test(m.message) && !/SERVED/.test(m.message)) add(Number(m.lap) || 0, 'penalty', null, ...penaltyLine(m));
  // Climbs through the field: four places or more without losing one, the three biggest.
  // (Not a car only winning back what its own stop cost: Leclerc's P6 to P2 after his, from P1;
  // Verstappen's P5 to the lead after his, from P2, is. One to the
  // podium first, however short: Verstappen's P5 to the lead in Mexico; three at most.)
  const climbs = nos
    .flatMap(no => (kitWp.placeClimbs?.(run[no].map((x, l) => (l ? x : 0)), 4) || []).map(c => ({ no, ...c })))
    .filter(c => !pits[c.no]?.some(s => c.lap0 >= s && c.lap0 <= s + 2 && c.to >= at(c.no, s - 1)))
    .sort((x, y) => (y.to <= 3) - (x.to <= 3) || y.from - y.to - (x.from - x.to))
    .filter((c, i, all) => c.to > 3 || all.slice(0, i).filter(x => x.to <= 3).length < 2)
    .slice(0, 3);
  for (const c of climbs) {
    const sub = [`${P(c.from, en)} → ${P(c.to, en)}`, c.lap1 > c.lap0 ? W(`第 ${c.lap0}–${c.lap1} 圈`, `laps ${c.lap0}–${c.lap1}`) : ''].filter(Boolean).join(' · ');
    add(c.lap1, 'climb', c.no, c.to === 1 ? W(`${nameOf(c.no)} 升到領先`, `${nameOf(c.no)} up to the lead`) : W(`${nameOf(c.no)} 升 ${c.from - c.to} 名`, `${nameOf(c.no)} up ${c.from - c.to} places`), sub, { text: c.to === 1 ? W(`${nameOf(c.no)} 領先`, `${nameOf(c.no)} leads`) : W(`${nameOf(c.no)} 升 ${c.from - c.to}`, `${nameOf(c.no)} +${c.from - c.to}`), sub });
  }
  if (over) {
    const podium = [...cars].filter(c => c.pos >= 1 && c.pos <= 3 && !c.retired).sort((x, y) => x.pos - y.pos);
    const win = podium[0]?.no ?? leader(last);
    if (win != null) add(last, 'finish', win, W(`${nameOf(win)} 奪冠`, `${nameOf(win)} wins`), podium.length > 2 ? W(`${nameOf(podium[1].no)} 亞軍 · ${nameOf(podium[2].no)} 季軍`, `${nameOf(podium[1].no)} 2nd · ${nameOf(podium[2].no)} 3rd`) : '');
    const best = cars.filter(c => !c.retired && !c.stopped && gridOf(c.no) && c.pos).map(c => [c.no, gridOf(c.no) - c.pos]).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= 3) add(last, 'climb', best[0], W(`進步最多：${nameOf(best[0])}`, `Most places gained: ${nameOf(best[0])}`), `${P(gridOf(best[0]), en)} → ${P(car(best[0]).pos, en)}`);
  }
  return order(out);
}
// A steward's penalty in English, short: "Leclerc: 5 s penalty" over why, said plainly.
const EN_WHY = [[/LEAVING THE TRACK AND GAINING (AN )?(LASTING )?ADVANTAGE/, 'Off-track advantage'], [/CAUSING A COLLISION/, 'Caused a collision'], [/SPEEDING IN THE PIT LANE/, 'Pit-lane speeding'], [/FORCING ANOTHER DRIVER OFF THE TRACK/, 'Forced a car off track'], [/FALSE START/, 'False start'], [/TRACK LIMITS/, 'Track limits'], [/UNSAFE RELEASE/, 'Unsafe release'], [/YELLOW FLAG/, 'Ignored yellow flags']];
function enPenalty(message, nameOf) {
  const s = String(message || '').replace(/^(FIA STEWARDS|UPDATE|CORRECTION):\s*/g, '').replace(/\s*\(\d{1,2}:\d{2}(:\d{2})?\)\s*$/, '');
  const [head, ...why] = s.split(/\s+[-–]\s+/);
  const m = /^(.*?) FOR CARS? (\d+)/.exec(head) || [];
  const what = String(m[1] || head)
    .replace(/(\d+) SECOND TIME PENALTY/, '$1 s penalty')
    .replace(/(\d+) SECOND STOP\/GO PENALTY/, '$1 s stop-go')
    .replace(/DRIVE THROUGH PENALTY/, 'drive-through')
    .replace(/(\d+) PLACE GRID PENALTY/, '$1-place grid drop')
    .toLowerCase();
  const reason = why.join(' – ');
  const plain = EN_WHY.find(([re]) => re.test(reason))?.[1] || (reason ? reason[0] + reason.slice(1).toLowerCase() : '');
  const What = what[0].toUpperCase() + what.slice(1);
  // (A long name: the penalty in the line, who under it.)
  return m[2] ? [`${nameOf(m[2])}: ${what}`, plain, { text: What, sub: [nameOf(m[2]), plain].filter(Boolean).join(' · ') }] : [What, plain];
}
// In the order they happened; on one lap, the flags first, then the lead, the rest, the finish last.
const RANK = { grid: 0, red: 1, sc: 1, vsc: 1, start: 2, lead: 3, out: 4, pit: 5, gain: 6, pass: 7, lost: 7, penalty: 8, climb: 9, now: 10, finish: 11 };
const order = list => list.map((x, i) => [x, i]).sort(([a, i], [b, j]) => a.lap - b.lap || (RANK[a.kind] ?? 7) - (RANK[b.kind] ?? 7) || i - j).map(([x]) => x);
