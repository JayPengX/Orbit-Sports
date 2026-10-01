// Where to watch in Taiwan: ELTA.tv (愛爾達's streaming service) and Apple
// TV, the only two Quadra Fixtures shows, and every league it covers is on
// one of them (lib/leagues.mjs keeps only these of the shared catalogue).
//
// Checked October 2026 against ELTA's own schedule (its league names below)
// and its 2026-27 rights (NBA 2026-2030, F1 2026-2029, the European football
// it carries), and Apple TV's Taiwan storefront: MLS there, its MLB Friday
// Night Baseball not (that room isn't in the Taiwan store). Rights change:
// keep this list current.
export const CHECKED = '2026-10';

// ELTA's sports schedule (in its app: 直播節目表), for a game ELTA carries on
// a channel its own list doesn't name yet (an NBA game from NBA.com, below).
const ELTA = { zh: '愛爾達 ELTA.tv', en: 'ELTA.tv', short: { zh: '愛爾達', en: 'ELTA' }, svc: 'elta', url: 'https://eltaott.tv/channel/sports_program_detail', app: 'eltatv://schedule/live' };
// Apple TV's MLS channel (MLS Season Pass, every game: exact to each one), a
// link the Apple TV app opens.
const APPLE = { zh: 'Apple TV', en: 'Apple TV', short: { zh: 'Apple TV', en: 'Apple TV' }, svc: 'appletv', url: 'https://tv.apple.com/tw/channel/mls/tvs.sbd.7000', exact: true };

export const BROADCAST = {
  mlb: [ELTA],
  // The home games of four clubs (台鋼, 富邦, 統一, 味全: ELTA's 2026 rights); which ones, its schedule says.
  cpbl: [{ ...ELTA, note: { zh: '部分場次', en: 'selected games' } }],
  // Some games (one or two a day); which ones, its schedule and NBA.com's say.
  nba: [{ ...ELTA, note: { zh: '部分場次', en: 'selected games' } }],
  epl: [ELTA],
  seriea: [ELTA],
  bundesliga: [ELTA],
  ligue1: [ELTA],
  ucl: [ELTA],
  uel: [ELTA],
  uecl: [ELTA],
  scotland: [ELTA],
  mls: [APPLE],
  facup: [ELTA],
  nationsleague: [ELTA],
  f1: [ELTA]
};

export const broadcastsOf = league => BROADCAST[league] || [];

// ---- ELTA's own schedule: which game each channel carries ---------------------------
//
// ELTA (愛爾達) publishes its sports channels' live programs about two weeks
// ahead (the list its site's 節目表 reads; the proxy trims it). Where it
// covers a game's day, a game on ELTA shows the channel it's on, and a game it
// doesn't carry isn't said to be on ELTA.
export const ELTA_LIST = 'https://piceltaott-elta.cdn.hinet.net/production/json/program_list/sports_live_program_list.json';
// ELTA's league names (its English one, else its Chinese one: 蘇超 has no
// English name) → Fixtures' leagues.
const ELTA_LEAGUE = {
  MLB: 'mlb', CPBL: 'cpbl', NBA: 'nba', 'Premier League': 'epl', 'Serie A': 'seriea', Bundesliga: 'bundesliga', 'Ligue 1': 'ligue1',
  UCL: 'ucl', UEL: 'uel', UECL: 'uecl', 蘇超: 'scotland', 'FA Cup': 'facup', 英足總盃: 'facup', 'UEFA Nations League': 'nationsleague', F1: 'f1'
};
// Its channels: the four 體育台 (with ads), the ten MAX (no ads) and MOD's
// own 980s (its add-on sports channels: not streamed, so never shown).
export function eltaChannel(n) {
  const TV = { 101: 1, 105: 2, 110: 3, 115: 4 };
  const base = { svc: 'elta', ch: n, url: eltaWatchUrl(n), app: eltaAppUrl(n) };
  if (TV[n]) return { ...base, zh: `ELTA.tv 體育${TV[n]}台`, en: `ELTA.tv Sports ${TV[n]}`, short: { zh: `愛爾達${TV[n]}台`, en: `ELTA ${TV[n]}` } };
  if (n >= 540 && n <= 549) return { ...base, zh: `ELTA.tv 體育MAX${n - 539}台`, en: `ELTA.tv Sports MAX ${n - 539}`, short: { zh: `MAX${n - 539}台`, en: `MAX ${n - 539}` } };
  if (n >= 980 && n <= 989) return { ...base, zh: `MOD ${n}台`, en: `MOD ${n}`, short: { zh: `MOD ${n}`, en: `MOD ${n}` }, mod: true };
  return { ...base, zh: `ELTA.tv（${n}）`, en: `ELTA.tv (${n})`, short: { zh: `ELTA ${n}`, en: `ELTA ${n}` } };
}
// The page on ELTA.tv that plays a channel (MOD's 980s aren't on ELTA.tv).
const ELTA_PLAY = { 101: 1, 102: 3, 103: 2, 104: 4, 105: 5, 110: 6, 115: 92, 540: 71, 541: 72, 542: 73, 543: 81, 544: 108, 545: 109, 546: 110, 547: 111, 548: 140, 549: 141 };
export const eltaWatchUrl = n => (ELTA_PLAY[n] ? `https://eltaott.tv/channel/play/${n}/${ELTA_PLAY[n]}` : n >= 980 ? null : 'https://eltaott.tv/channel');
// The same channel in the ELTA.tv app: the link ELTA's own site sends phones
// to (its appRedirect.js: /channel/play/<ch>/… → eltatv://live/<ch>).
export const eltaAppUrl = n => (ELTA_PLAY[n] ? `eltatv://live/${n}` : null);

// What a program sounds like, from ELTA's title and channel:
//   'en'    English, the original feed (原音, 英文解說)
//   'dual'  雙語: Chinese commentary with the original on the second audio
//           track (said so, and a 體育台's program that says nothing: the
//           four 體育台 carry both); never CPBL's: a Taiwan league's own
//           broadcast has no English
//   'local' CPBL's 雙語: two Chinese commentary teams (ELTA's own and a
//           台語 one for 台鋼's home games, the club's for 富邦's)
//   'venue' Chinese commentary with the ground's sound on the second track
//           (副聲道現場原音)
//   'zh'    Chinese only (中文, a MAX channel's program that says nothing, CPBL's)
// `adFree`: said so, or a MAX channel.
const SPORTS_TV = new Set([101, 105, 110, 115]);
export function eltaAudio(title, ch, league = '') {
  const t = String(title || '');
  const audio = /雙語/.test(t) ? (league === 'cpbl' ? 'local' : 'dual') : /副聲道/.test(t) ? 'venue' : /原音|英文|English/i.test(t) ? 'en' : /中文/.test(t) ? 'zh' : SPORTS_TV.has(ch) && league !== 'cpbl' ? 'dual' : 'zh';
  return { audio, adFree: /無廣告/.test(t) || (ch >= 540 && ch <= 549) };
}
export const AUDIO_NAMES = {
  en: { zh: '英文原音', en: 'English' },
  dual: { zh: '雙語', en: 'Chinese + English' },
  venue: { zh: '中文・現場音', en: 'Chinese + ground' },
  local: { zh: '雙語・中文', en: 'Two Chinese crews' },
  zh: { zh: '中文', en: 'Chinese' }
};
// Whether a channel has the commentary the person likes: Chinese on every
// kind but 'en'; the original on 'en' and on 'dual' (its second track).
export const hasAudio = (c, prefer = 'en') => (prefer === 'zh' ? c.audio !== 'en' : c.audio === 'en' || c.audio === 'dual');
// How well a channel suits the person: their commentary first (on its main
// track before a second one), then no ads (a MAX channel before the 體育台
// with the same game). Lower is better.
export function channelRank(c, prefer = 'en') {
  const order = prefer === 'zh' ? { zh: 0, dual: 0, venue: 0, local: 0, en: 3 } : { en: 0, dual: 1, venue: 2, local: 3, zh: 3 };
  return (order[c.audio] ?? 3) * 10 + (c.adFree ? 0 : 5);
}

// The list (trimmed by the proxy, or ELTA's own) as programs: { league, start,
// end (ms), ch, title, teams: ['海盜', '老虎'] or [], day }. Replays left out.
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
    out.push({ league, start: p.s * 1000, end: (p.e || p.s + 10_800) * 1000, ch: Number(p.ch), title, teams: vs ? [vs[1], vs[2]] : [], day: p.d, ...eltaAudio(p.t, Number(p.ch), league) });
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

// ---- NBA.com's Taiwan schedule: the NBA games on ELTA, the whole season -------------------
//
// NBA.com's schedule for Taiwan (region 32, what nba.com/schedule?region=32
// reads) names each game's broadcasters there, months beyond ELTA's own two
// weeks, and some days ELTA has two games. The deploy reads it
// (scripts/nba-elta.mjs) and keeps ELTA's games on this site: { games: [{ id,
// start, home, away }] }, NBA.com's team ids.
export const NBA_TW_SCHEDULE = 'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_32.json';
const onElta = g => Object.values(g.broadcasters || {}).some(list => Array.isArray(list) && list.some(b => /elta/i.test(`${b.broadcasterDisplay} ${b.broadcasterAbbreviation}`)));
// ELTA's games: [{ id, start (ms), home, away }] (team ids as numbers).
export function nbaEltaGames(data) {
  const games = Array.isArray(data?.games)
    ? data.games
    : (data?.leagueSchedule?.gameDates || []).flatMap(d => d.games || []).filter(onElta).map(g => ({ id: g.gameId, start: g.gameDateTimeUTC, home: g.homeTeam?.teamId, away: g.awayTeam?.teamId }));
  return games.map(g => ({ id: String(g.id), start: Date.parse(g.start), home: Number(g.home), away: Number(g.away) })).filter(g => Number.isFinite(g.start) && g.home && g.away);
}
// The ELTA game that is this one: the same two teams (`ids`: the game's
// NBA.com team ids, home and away), the nearest start within 12 hours.
export function nbaEltaGame(games, e, ids) {
  if (!games?.length || !ids?.home || !ids?.away) return null;
  const t = Date.parse(e.start);
  const same = games.filter(g => g.home === ids.home && g.away === ids.away && Math.abs(g.start - t) < 12 * 3_600_000);
  return same.sort((a, b) => Math.abs(a.start - t) - Math.abs(b.start - t))[0] || null;
}

// ---- Everything a game is on --------------------------------------------------------------
//
// The channels a game is on in Taiwan: ELTA's from its schedule when the
// schedule covers the day (none when ELTA doesn't carry it); an NBA game also
// from NBA.com's (ELTA, its channel not yet named), never guessed; Apple TV's
// MLS. Each one exact to the game has `exact` (a row's 📺 line shows only those).
// `programs`: parseElta's; `sides`, `others` as for eltaPrograms; `nba`:
// nbaEltaGames' and the game's NBA.com team ids ({ games, ids }).
export function broadcastsFor(e, programs, { sides = [], others = [], prefer = 'en', nba = null } = {}) {
  const base = broadcastsOf(e.league);
  if (base[0]?.svc !== 'elta') return base;
  const days = programs?.length ? eltaDays(programs) : null;
  const day = new Date(Date.parse(e.start) + 8 * 3_600_000).toISOString().slice(0, 10);
  const listed = days && day >= days.from && day <= days.to;
  const seen = new Set();
  const channels = listed
    ? eltaPrograms(programs, e, sides, others)
        .map(p => ({ ...eltaChannel(p.ch), at: p.start, title: p.title, audio: p.audio, adFree: p.adFree, exact: true, ...(p.tentative ? { note: { zh: '同時段擇一，待公布', en: 'one of the games then, TBA' } } : {}) }))
        // MOD's own channels aren't streamed: not listed.
        .filter(c => !c.mod && !seen.has(c.ch) && seen.add(c.ch))
    : [];
  // The best for the person first (their commentary, no ads).
  if (channels.length) return channels.sort((a, b) => channelRank(a, prefer) - channelRank(b, prefer) || a.ch - b.ch);
  if (e.league === 'nba') {
    const g = nbaEltaGame(nba?.games, e, nba?.ids);
    return g ? [{ ...base[0], note: null, at: g.start, exact: true }] : [];
  }
  // ELTA's list covers the day and hasn't the game: not on ELTA.
  return listed ? [] : base;
}
