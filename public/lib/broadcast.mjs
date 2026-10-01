// Where to watch in Taiwan, by league: the streaming services that carry it
// (checked October 2026), never a cable or MOD channel: Quadra Fixtures is
// about what a phone can play. ESPN's own broadcast list is the US
// networks, which don't help anyone here, so it isn't shown.
//
//   kind  'ott' a streaming service (a TV channel counts only as it's streamed
//         on one), 'pass' the league's own subscription
//
// Sources: ELTA's 2026-27 football and baseball announcements, ELTA's NBA
// 2026-2030 and F1 2026-2029 rights, DAZN Taiwan (LaLiga, NFL from
// 2026-27, NPB, NHL), 緯來 (NBA, MLB daily), CPBL's 2026 platform list.
// Rights change: keep this list current.
export const CHECKED = '2026-10';

const ELTA = { zh: '愛爾達 ELTA.tv', en: 'ELTA.tv', kind: 'ott', svc: 'elta' };
// Hami Video streams ELTA's 體育台 (not its MAX ones) and 緯來.
const HAMI = { zh: 'Hami Video', en: 'Hami Video', kind: 'ott', svc: 'hami' };
// 緯來體育台 streamed: Hami Video and 緯來's own app (緯來電視網).
const VL = { zh: '緯來體育台（Hami Video・緯來 App）', en: 'Videoland Sports (Hami Video, Videoland app)', kind: 'ott', svc: 'videoland' };
const DAZN = { zh: 'DAZN', en: 'DAZN', kind: 'ott', svc: 'dazn' };
// A league's own subscription: only where it's the one way to watch (WNBA,
// EuroLeague). One sport's passes are otherwise not listed.
const pass = (svc, zh, en = zh) => ({ zh, en, kind: 'pass', svc });
// Free on YouTube (the league's own channel): listed for a game only when the
// channel has a video of that very game (ytVideoFor, from the channel's feed:
// a live stream, or the full match after), and then a link to that video.
const yt = (zh, en, url, channel) => ({ zh: `YouTube ${zh}`, en: `YouTube ${en}`, kind: 'ott', svc: 'youtube', url, channel, free: true });
const SOOP = { zh: 'SOOP（免費）', en: 'SOOP (free)', kind: 'ott', svc: 'soop', url: 'https://www.sooplive.com/station/kboglobal1', free: true };
const DISNEY = { zh: 'Disney+', en: 'Disney+', kind: 'ott', svc: 'disney' };
const APPLE = { zh: 'Apple TV', en: 'Apple TV', kind: 'ott', svc: 'appletv' };

const SOCCER_ELTA = [ELTA, HAMI];

export const BROADCAST = {
  mlb: [ELTA, VL, HAMI, { ...APPLE, zh: 'Apple TV（週五）', en: 'Apple TV (Fridays)' }],
  npb: [DAZN, VL],
  cpbl: [VL, DAZN, ELTA, HAMI, { zh: 'MyVideo', en: 'MyVideo', kind: 'ott', svc: 'myvideo' }],
  // Every game free on SOOP (KBO_Global), outside Korea.
  kbo: [SOOP, DAZN],
  // ELTA: one game a day, from the 2026-27 preseason (10/6); which one, its schedule says.
  nba: [{ ...ELTA, note: { zh: '每日一場，10/6 起', en: 'one game a day from 10/6' } }, VL],
  wnba: [pass('nbapass', 'WNBA League Pass')],
  nfl: [DAZN],
  nhl: [DAZN],
  epl: [ELTA, HAMI],
  facup: SOCCER_ELTA,
  ucl: [ELTA, HAMI],
  uel: SOCCER_ELTA,
  uecl: SOCCER_ELTA,
  bundesliga: [ELTA, HAMI],
  seriea: [ELTA, HAMI],
  ligue1: [ELTA, HAMI],
  scotland: [ELTA],
  // Selected games free on the leagues' international YouTube channels.
  jleague: [yt('J.LEAGUE International', 'J.LEAGUE International', 'https://www.youtube.com/@JLEAGUEInternational', 'UCmQp6ZaAejJKKkXc_Y_lh1A')],
  kleague: [yt('K League International', 'K League International', 'https://www.youtube.com/@KLeagueintl', 'UCrfu1VaYOZ_-FBGQMzKFfMA')],
  worldcup: [ELTA, HAMI],
  nationsleague: SOCCER_ELTA,
  laliga: [DAZN],
  // Every MLS match with an Apple TV subscription from 2026.
  mls: [APPLE],
  f1: [ELTA, HAMI],
  // F1's feeder series: ELTA.tv only (MAX 5-8, English commentary, no ads).
  f2: [{ ...ELTA, note: { zh: 'MAX 5-8 台', en: 'MAX 5-8' } }],
  f3: [{ ...ELTA, note: { zh: 'MAX 5-8 台', en: 'MAX 5-8' } }],
  // From 2026-27 on Disney+ (every session); practice free on its YouTube.
  formulae: [DISNEY, yt('Formula E', 'Formula E', 'https://www.youtube.com/@FIAFormulaE', 'UC-DuRqsBQOEk_5o1q4Ze-Fg')],
  euroleague: [pass('euroleaguetv', 'EuroLeague TV')]
};

export const broadcastsOf = league => BROADCAST[league] || [];

// ---- YouTube: the very game, or nothing -----------------------------------------------
const plainWords = s =>
  String(s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const COMMON = new Set(['united', 'city', 'club', 'football', 'fc', 'sc', 'cf', 'hd', 'the', 'and', 'vs', 'de', 'real', 'sporting', 'team']);
// The words that tell a side apart in a title ("Ulsan HD" → ulsan; "Li Hechen" → li, hechen).
const sideWords = side => [...new Set([side?.en, side?.name, side?.short].flatMap(n => plainWords(n).split(' ')))].filter(w => w.length >= 2 && !COMMON.has(w));
// The channel's video of this game (videos: the feed's { id, t, p }): its
// title names both sides (a match) or the event and the session (a race),
// put up from three days before the start to two days after. Null when none.
export function ytVideoFor(e, videos) {
  if (!e || !videos?.length) return null;
  const start = Date.parse(e.start);
  const near = videos.filter(v => {
    const p = Date.parse(v.p);
    return p >= start - 3 * 86_400_000 && p <= start + 2 * 86_400_000;
  });
  const title = v => ` ${plainWords(v.t)} `;
  const has = (v, w) => title(v).includes(` ${w} `);
  if (e.kind === 'match' || (e.home && e.away)) {
    const a = sideWords(e.home);
    const b = sideWords(e.away);
    if (!a.length || !b.length) return null;
    return near.find(v => a.some(w => w.length >= 3 && has(v, w)) && b.some(w => w.length >= 3 && has(v, w))) || null;
  }
  // A race weekend's session: the event's place and the session's word.
  const place = plainWords(e.name || e.shortName).split(' ').filter(w => w.length >= 4 && !['prix', 'grand', 'race', 'round'].includes(w));
  const word = { FP1: 'fp1', FP2: 'fp2', FP3: 'fp3', Qual: 'qualifying', Race: 'race' }[e.sessionKey] || '';
  return near.find(v => place.some(w => has(v, w)) && (!word || has(v, word) || (word === 'fp1' && has(v, 'practice')))) || null;
}

// ---- ELTA's own schedule: which game each channel carries ---------------------------
//
// ELTA (愛爾達) publishes its sports channels' live programs two weeks ahead
// (the list its site's 節目表 reads; the proxy trims it). Where it covers a
// game's day, a game on ELTA shows the channel it's on, and a game it doesn't
// carry (the NBA: one a day, from the preseason's 10/6) isn't said to be on ELTA.
export const ELTA_LIST = 'https://piceltaott-elta.cdn.hinet.net/production/json/program_list/sports_live_program_list.json';
// ELTA's league names (its English ones) → Fixtures' leagues.
const ELTA_LEAGUE = {
  MLB: 'mlb', NBA: 'nba', CPBL: 'cpbl', 'Premier League': 'epl', UCL: 'ucl', 'UEFA Champions League': 'ucl', 'UEFA Europa League': 'uel', 'UEFA Conference League': 'uecl',
  Bundesliga: 'bundesliga', 'Serie A': 'seriea', 'Ligue 1': 'ligue1', 'UEFA Nations League': 'nationsleague', 'Scottish Premiership': 'scotland', 'FA Cup': 'facup', F1: 'f1', F2: 'f2', F3: 'f3', 'Formula 2': 'f2', 'Formula 3': 'f3'
};
// Its channels: the four 體育台 (streamed on ELTA.tv and Hami Video, with
// ads), the ten MAX (ELTA.tv only, no ads) and MOD's own 980s (its add-on
// sports channels: not streamed, so never shown).
export function eltaChannel(n) {
  const TV = { 101: 1, 105: 2, 110: 3, 115: 4 };
  if (TV[n]) return { zh: `ELTA.tv 體育${TV[n]}台`, en: `ELTA.tv Sports ${TV[n]}`, short: { zh: `愛爾達${TV[n]}台`, en: `ELTA ${TV[n]}` }, kind: 'ott', svc: 'elta', ch: n, sports: true };
  if (n >= 540 && n <= 549) return { zh: `ELTA.tv 體育MAX${n - 539}台`, en: `ELTA.tv Sports MAX ${n - 539}`, short: { zh: `MAX${n - 539}台`, en: `MAX ${n - 539}` }, kind: 'ott', svc: 'elta', ch: n, max: true };
  if (n >= 980 && n <= 989) return { zh: `MOD ${n}台`, en: `MOD ${n}`, short: { zh: `MOD ${n}`, en: `MOD ${n}` }, kind: 'mod', svc: 'elta', ch: n, mod: true };
  return { zh: `ELTA.tv（${n}）`, en: `ELTA.tv (${n})`, short: { zh: `ELTA ${n}`, en: `ELTA ${n}` }, kind: 'ott', svc: 'elta', ch: n };
}
// The page on ELTA.tv that plays a channel (MOD's 980s aren't on ELTA.tv).
const ELTA_PLAY = { 101: 1, 102: 3, 103: 2, 104: 4, 105: 5, 110: 6, 115: 92, 540: 71, 541: 72, 542: 73, 543: 81, 544: 108, 545: 109, 546: 110, 547: 111, 548: 140, 549: 141 };
export const eltaWatchUrl = n => (ELTA_PLAY[n] ? `https://eltaott.tv/channel/play/${n}/${ELTA_PLAY[n]}` : n >= 980 ? null : 'https://eltaott.tv/channel');
// The same channel in the ELTA.tv app: the link ELTA's own site sends phones
// to (its appRedirect.js: /channel/play/<ch>/… → eltatv://live/<ch>).
export const eltaAppUrl = n => (ELTA_PLAY[n] ? `eltatv://live/${n}` : null);

// What a program sounds like, from ELTA's title: 'en' English commentary or
// the original feed (原音, 英文解說原音), 'dual' two audio tracks (雙語), 'venue'
// Chinese with the ground's sound on the second track (副聲道現場原音), 'zh'
// Chinese commentary (anything unmarked). `adFree`: said so, or a MAX channel.
export function eltaAudio(title, ch) {
  const t = String(title || '');
  const audio = /雙語/.test(t) ? 'dual' : /副聲道/.test(t) ? 'venue' : /原音|英文解說|English/i.test(t) ? 'en' : 'zh';
  return { audio, adFree: /無廣告/.test(t) || (ch >= 540 && ch <= 549) };
}
export const AUDIO_NAMES = {
  en: { zh: '原音', en: 'English' },
  dual: { zh: '雙語', en: 'Dual audio' },
  venue: { zh: '中文・副聲道現場音', en: 'Chinese · ground sound' },
  zh: { zh: '中文', en: 'Chinese' }
};
// How well a channel suits the person: the commentary they like first (with
// 原音 wanted, a 雙語 channel has it on its second track), then no ads (a MAX
// channel before the 體育台 with the same game), MOD's last. Lower is better.
export function channelRank(c, prefer = 'en') {
  const order = prefer === 'zh' ? { zh: 0, dual: 1, venue: 2, en: 3 } : { en: 0, dual: 1, venue: 2, zh: 3 };
  return (order[c.audio] ?? 3) * 10 + (c.adFree ? 0 : 5) + (c.mod ? 1 : 0);
}

// The list (trimmed by the proxy, or ELTA's own) as programs: { league, start,
// end (ms), ch, title, teams: ['海盜', '老虎'] or [], live, day }. Replays left out.
export function parseElta(data) {
  const raw = Array.isArray(data?.programs)
    ? data.programs
    : Object.entries(data?.calendar || {}).flatMap(([d, list]) => (Array.isArray(list) ? list : []).map(p => ({ d, s: p.start_time, e: p.end_time, ch: p.channel_number, g: p.game_type_en || p.game_type, t: p.program_desc })));
  const out = [];
  for (const p of raw) {
    const league = ELTA_LEAGUE[p.g];
    // Live only: not a delayed showing (D-LIVE) or the children's version (Kids).
    if (!league || !p.s || !/\bLIVE\b/i.test(p.t || '') || /D-LIVE/i.test(p.t || '') || /^\s*Kids\b/i.test(p.t || '')) continue;
    // "海盜 VS 老虎 李灝宇先發… 例行賽 9/27(原音) LIVE": the two sides before the details.
    const vs = /^\s*(?:UEFA\s+)?([^\s【】]+)\s+VS\s+([^\s【】(（]+)/i.exec(p.t || '');
    // The title without "LIVE" and the day (the row shows the time), the details kept.
    const title = String(p.t || '')
      .replace(/\s*LIVE\s*$/i, '')
      .replace(/\s+\d{1,2}\/\d{1,2}(?=\s|\(|（|$)/, '')
      .trim();
    out.push({ league, start: p.s * 1000, end: (p.e || p.s + 10_800) * 1000, ch: Number(p.ch), title, teams: vs ? [vs[1], vs[2]] : [], day: p.d, ...eltaAudio(p.t, Number(p.ch)) });
  }
  return out.sort((a, b) => a.start - b.start);
}
// The days the list covers ('YYYY-MM-DD', Taiwan's): outside them nothing is known.
export const eltaDays = programs => {
  const days = programs.map(p => p.day).filter(Boolean).sort();
  return days.length ? { from: days[0], to: days.at(-1) } : null;
};

// Two names for one side ("里茲聯" and "利茲聯", "海盜" and "匹茲堡海盜"): two
// characters in a row in common.
export function zhSame(a, b) {
  const [x, y] = [String(a || ''), String(b || '')];
  if (!x || !y) return false;
  if (x.includes(y) || y.includes(x)) return true;
  for (let i = 0; i < x.length - 1; i++) if (y.includes(x.slice(i, i + 2))) return true;
  return false;
}
// The programs that carry a game: its league's, starting from an hour before
// it to 20 minutes after, with either side's name (a program without the
// sides, "【onELTA 熱身賽】", counts when it's the only game near that time).
// `sides`: the game's two sides in Chinese (full and short names).
export function eltaPrograms(programs, e, sides, others = []) {
  if (!programs?.length || !e) return [];
  const t = Date.parse(e.start);
  const near = p => p.league === e.league && p.start >= t - 60 * 60_000 && p.start <= t + 20 * 60_000;
  const cand = programs.filter(near);
  if (e.kind !== 'match') {
    // A race weekend's session: the program naming it (排位賽, 正賽, 衝刺賽).
    const word = { Qual: '排位賽', Race: '正賽', SR: '衝刺賽', SS: '衝刺排位', SQ: '衝刺排位' }[e.sessionKey] || '';
    return cand.filter(p => !word || (p.title.includes(word) && !(word === '排位賽' && p.title.includes('衝刺'))));
  }
  const named = cand.filter(p => p.teams.length && p.teams.some(x => sides.some(s => zhSame(x, s))));
  if (named.length) return named;
  // No names: only if no other game of the league starts near it.
  const blank = cand.filter(p => !p.teams.length);
  if (!blank.length) return [];
  // Several games near it: one of them, not yet said which (ELTA names it nearer the day).
  const rivals = others.filter(o => o !== e && o.id !== e.id && o.league === e.league && Math.abs(Date.parse(o.start) - t) < 45 * 60_000);
  return rivals.length ? blank.map(p => ({ ...p, tentative: true })) : blank;
}
// The channels a game is on in Taiwan: ELTA's from its schedule when the
// schedule covers the day (none when ELTA doesn't carry it), the others as listed.
// `programs`: parseElta's; `sides`, `others` as for eltaPrograms.
// Apple TV+ has MLB's Friday Night Baseball: a regular-season game on a
// Friday in the US (Eastern time), no other.
const fridayNight = e => new Date(Date.parse(e.start) - 4 * 3_600_000).getUTCDay() === 5 && !['post', 'final'].includes(e.stage?.key);
export function broadcastsFor(e, programs, sides = [], others = [], prefer = 'en') {
  const base = broadcastsOf(e.league).filter(b => !(e.league === 'mlb' && b.svc === 'appletv' && !fridayNight(e)));
  const covered = programs?.length && base.some(b => b.svc === 'elta') && Object.values(ELTA_LEAGUE).includes(e.league);
  const days = covered ? eltaDays(programs) : null;
  const day = new Date(Date.parse(e.start) + 8 * 3_600_000).toISOString().slice(0, 10);
  if (!days || day < days.from || day > days.to) {
    // Beyond the schedule: the league's list, with the NBA's rule (one game a day, from 10/6).
    return base.map(b => (b.svc === 'elta' && e.league === 'nba' ? { ...b, note: { zh: '每日一場', en: 'one game a day' } } : b)).filter(b => !(b.svc === 'elta' && e.league === 'nba' && day < NBA_ELTA_FROM));
  }
  const on = eltaPrograms(programs, e, sides, others);
  const seen = new Set();
  const channels = on
    .map(p => ({ ...eltaChannel(p.ch), at: p.start, title: p.title, url: eltaWatchUrl(p.ch), app: eltaAppUrl(p.ch), audio: p.audio || 'zh', adFree: Boolean(p.adFree), ...(p.tentative ? { note: { zh: '同時段擇一，待公布', en: 'one of the games then, TBA' } } : {}) }))
    // MOD's own channels aren't streamed: not listed.
    .filter(c => !c.mod && !seen.has(c.ch) && seen.add(c.ch));
  // Hami Video carries ELTA's 體育台 (not its MAX ones).
  const hami = channels.some(c => c.sports) ? base.filter(b => b.svc === 'hami') : [];
  // The best for the person first (their commentary, no ads), then the rest.
  return [...channels.sort((a, b) => channelRank(a, prefer) - channelRank(b, prefer) || a.ch - b.ch), ...hami, ...base.filter(b => b.svc !== 'elta' && b.svc !== 'hami')];
}
// ELTA's NBA: the 2026-27 preseason's games from 10/6 (Taiwan), one a day.
export const NBA_ELTA_FROM = '2026-10-06';

// The services a person can say they have (the recommendations keep to
// those), in the order they're offered.
export const SERVICES = [
  { id: 'elta', zh: '愛爾達 ELTA.tv', en: 'ELTA.tv' },
  { id: 'hami', zh: 'Hami Video', en: 'Hami Video' },
  { id: 'videoland', zh: '緯來（Hami Video・緯來 App）', en: 'Videoland (Hami Video, app)' },
  { id: 'dazn', zh: 'DAZN', en: 'DAZN' },
  { id: 'myvideo', zh: 'MyVideo', en: 'MyVideo' },
  { id: 'appletv', zh: 'Apple TV', en: 'Apple TV' },
  { id: 'disney', zh: 'Disney+', en: 'Disney+' },
  { id: 'youtube', zh: 'YouTube（免費）', en: 'YouTube (free)' },
  { id: 'soop', zh: 'SOOP（免費）', en: 'SOOP (free)' },
  { id: 'nbapass', zh: 'WNBA League Pass', en: 'WNBA League Pass' },
  { id: 'euroleaguetv', zh: 'EuroLeague TV', en: 'EuroLeague TV' }
];
// Whether a league can be watched on any of these services (none picked: any Taiwan broadcast).
export function watchable(league, services = []) {
  const list = broadcastsOf(league);
  if (!services.length) return list.length > 0;
  return list.some(b => services.includes(b.svc));
}
// The leagues these services carry.
export const leaguesOn = (services = []) => Object.keys(BROADCAST).filter(k => watchable(k, services));
