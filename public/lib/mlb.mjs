// MLB's own API (statsapi.mlb.com, through the proxy), for a game on now
// whose ESPN feed is empty: ESPN's can go hours with the score alone (no
// count, runners, batter or pitcher; every box score number "--"), as
// in a 2026 Wild Card game. MLB's answers fill in only what ESPN left out.
//
//   mlbLiveGames(data)  a day's schedule (hydrated) → each game on now's live state
//   mlbBoxTables(data)  a game's box score → ESPN's batting and pitching tables

export const MLB_API = 'https://statsapi.mlb.com/api/v1';

// A day's games, as MLB files them (the US Eastern date).
export const mlbDate = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(t));
export const mlbScheduleUrl = date => `${MLB_API}/schedule?sportId=1&date=${date}&hydrate=linescore,previousPlay`;
export const mlbBoxUrl = pk => `${MLB_API}/game/${pk}/boxscore`;

// A team's name compared plainly ("Athletics", "Tampa Bay Rays"; accents and case aside).
const plain = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
// A person's name as MLB's and ESPN's are compared: accents, case and a
// suffix one names and the other doesn't aside ("Bobby Witt", "Bobby Witt Jr.").
export const personKey = s => plain(s).replace(/[.,]/g, '').replace(/\s+(jr|sr|ii|iii|iv)$/, '');
// "Yandy Díaz" → "Y. Díaz", as ESPN shows them.
const shortName = full => {
  const [first, ...rest] = String(full || '').split(' ');
  return rest.length ? `${first[0]}. ${rest.join(' ')}` : first;
};
// MLB's own picture of a player, by its id.
export const mlbHeadshot = id => (id ? `https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_auto:best/v1/people/${id}/headshot/67/current` : null);
// (Faces as everywhere else in the app: the kit's by name, not MLB's big cropped headshot.)
const person = p => (p?.fullName ? { id: '', name: p.fullName, headshot: null } : null);

export function mlbLiveGames(data) {
  return (data?.dates || [])
    .flatMap(d => d.games || [])
    .filter(g => g.status?.abstractGameState === 'Live' && g.linescore)
    .map(g => {
      const ls = g.linescore;
      const off = ls.offense || {};
      const batter = off.batter;
      const pitcher = ls.defense?.pitcher;
      return {
        pk: g.gamePk,
        away: plain(g.teams?.away?.team?.name),
        home: plain(g.teams?.home?.team?.name),
        live: {
          balls: ls.balls ?? 0,
          strikes: ls.strikes ?? 0,
          outs: ls.outs ?? 0,
          bases: [Boolean(off.first), Boolean(off.second), Boolean(off.third)],
          batter: batter ? shortName(batter.fullName) : '',
          pitcher: pitcher ? shortName(pitcher.fullName) : '',
          batterWho: person(batter),
          pitcherWho: person(pitcher),
          lastPlay: g.previousPlay?.result?.description || ''
        },
        field: fieldOf(ls)
      };
    });
}

// Who's on the field (場上球員's diamond): the side in the field, its nine
// by position (full names, as MLB has them), the batter and his place in
// the order, who's on each base, the inning and the outs.
const POSITIONS = [['P', 'pitcher'], ['C', 'catcher'], ['1B', 'first'], ['2B', 'second'], ['3B', 'third'], ['SS', 'shortstop'], ['LF', 'left'], ['CF', 'center'], ['RF', 'right']];
export function fieldOf(ls) {
  if (!ls?.defense) return null;
  const off = ls.offense || {};
  const top = ls.isTopInning ?? ls.inningHalf !== 'Bottom';
  return {
    fielding: top ? 'home' : 'away',
    inning: ls.currentInning || 0,
    top,
    outs: ls.outs ?? 0,
    defense: Object.fromEntries(POSITIONS.map(([k, key]) => [k, ls.defense[key]?.fullName || ''])),
    batter: off.batter?.fullName || '',
    order: off.battingOrder || 0,
    runners: [off.first, off.second, off.third].map(r => r?.fullName || '')
  };
}

// The MLB game of an Orbit Sports event (each side's English name).
export const mlbGameOf = (games, e) => games.find(g => g.home === plain(e.home?.en || e.home?.name) && g.away === plain(e.away?.en || e.away?.name)) || null;

// ESPN's table columns, filled from MLB's numbers: the game's line, then the season's.
const BATTING = ['H-AB', 'AB', 'R', 'H', 'RBI', 'HR', 'BB', 'K', '#P', 'AVG', 'OBP', 'SLG'];
const PITCHING = ['IP', 'H', 'R', 'ER', 'BB', 'K', 'HR', 'PC-ST', 'ERA', 'PC'];
const n = v => (v == null ? '0' : String(v));

// side: 'home' | 'away' → { batting: { labels, rows }, pitching: { labels, rows } },
// each row { name, full, mlbId, headshot, pos, starter, stats }.
// A day's games of any state (a schedule read plain): { pk, away, home, at }.
export const mlbDayGames = data => (data?.dates || []).flatMap(d => d.games || []).map(g => ({ pk: g.gamePk, away: plain(g.teams?.away?.team?.name), home: plain(g.teams?.home?.team?.name), at: Date.parse(g.gameDate || '') }));
// An event's game among them: its two sides, the start nearest its (a doubleheader's two).
export const mlbGameAt = (games, e) =>
  games.filter(g => g.home === plain(e.home?.en || e.home?.name) && g.away === plain(e.away?.en || e.away?.name)).sort((a, b) => Math.abs(a.at - Date.parse(e.start)) - Math.abs(b.at - Date.parse(e.start)))[0] || null;
// A player's line in a game, in a game log's columns (ESPN's: a batter's
// AB R H 2B 3B HR RBI BB SO, a pitcher's GS CG SHO IP H R ER HR BB K), from
// MLB's own box score: every column ESPN's box score hasn't (2B, 3B, GS…).
// box: MLB's game boxscore; name: the player's full name. null: not in it.
const LOG_KEYS = {
  batting: { AB: 'atBats', R: 'runs', H: 'hits', '2B': 'doubles', '3B': 'triples', HR: 'homeRuns', RBI: 'rbi', BB: 'baseOnBalls', SO: 'strikeOuts', K: 'strikeOuts', SB: 'stolenBases', CS: 'caughtStealing', HBP: 'hitByPitch' },
  pitching: { GS: 'gamesStarted', CG: 'completeGames', SHO: 'shutouts', IP: 'inningsPitched', H: 'hits', R: 'runs', ER: 'earnedRuns', HR: 'homeRuns', BB: 'baseOnBalls', K: 'strikeOuts', SO: 'strikeOuts', PC: 'numberOfPitches', W: 'wins', L: 'losses', SV: 'saves', HLD: 'holds' }
};
export function mlbLogLine(box, name, labels) {
  const who = personKey(name);
  const p = ['away', 'home'].flatMap(s => Object.values(box?.teams?.[s]?.players || {})).find(x => personKey(x.person?.fullName) === who);
  if (!p) return null;
  const kind = labels.includes('IP') ? 'pitching' : 'batting';
  const st = p.stats?.[kind];
  if (!st || !Object.keys(st).length) return null;
  return labels.map(k => (LOG_KEYS[kind][k] && st[LOG_KEYS[kind][k]] != null ? String(st[LOG_KEYS[kind][k]]) : '–'));
}

export function mlbBoxTables(data, side) {
  const t = data?.teams?.[side];
  if (!t) return null;
  const of = id => t.players?.[`ID${id}`];
  const row = (p, stats) => ({ name: shortName(p.person?.fullName), full: p.person?.fullName || '', mlbId: String(p.person?.id ?? ''), headshot: null, pos: p.position?.abbreviation || '', stats });
  const batters = (t.batters || [])
    .map(of)
    .filter(p => p?.battingOrder)
    .sort((a, b) => Number(a.battingOrder) - Number(b.battingOrder))
    .map(p => {
      const b = p.stats?.batting || {};
      const s = p.seasonStats?.batting || {};
      return { ...row(p, [`${n(b.hits)}-${n(b.atBats)}`, n(b.atBats), n(b.runs), n(b.hits), n(b.rbi), n(b.homeRuns), n(b.baseOnBalls), n(b.strikeOuts), n(b.numberOfPitches), s.avg || '', s.obp || '', s.slg || '']), starter: Number(p.battingOrder) % 100 === 0 };
    });
  const pitchers = (t.pitchers || [])
    .map(of)
    .filter(Boolean)
    .map((p, i) => {
      const x = p.stats?.pitching || {};
      return { ...row(p, [x.inningsPitched || '0.0', n(x.hits), n(x.runs), n(x.earnedRuns), n(x.baseOnBalls), n(x.strikeOuts), n(x.homeRuns), `${n(x.numberOfPitches)}-${n(x.strikes)}`, p.seasonStats?.pitching?.era || '', n(x.numberOfPitches)]), starter: i === 0 };
    });
  return { batting: { labels: BATTING, rows: batters }, pitching: { labels: PITCHING, rows: pitchers } };
}

// A game to come: each side's batting order and starting pitcher with their
// season numbers (MLB's box score has them once the lineups are posted), for
// 球員 before the first pitch: no game columns waiting to be filled.
const SEASON_BATTING = ['AVG', 'HR', 'RBI', 'OBP', 'SLG'];
const SEASON_PITCHING = ['ERA', 'W-L', 'IP', 'K', 'BB'];
export function mlbSeasonTables(data, side) {
  const t = data?.teams?.[side];
  if (!t) return null;
  const of = id => t.players?.[`ID${id}`];
  const row = (p, stats) => ({ name: shortName(p.person?.fullName), full: p.person?.fullName || '', mlbId: String(p.person?.id ?? ''), headshot: null, pos: p.position?.abbreviation || '', stats });
  const batters = (t.batters || [])
    .map(of)
    .filter(p => p?.battingOrder && Number(p.battingOrder) % 100 === 0)
    .sort((a, b) => Number(a.battingOrder) - Number(b.battingOrder))
    .map(p => {
      const s = p.seasonStats?.batting || {};
      return row(p, [s.avg || '', n(s.homeRuns), n(s.rbi), s.obp || '', s.slg || '']);
    });
  const pitchers = (t.pitchers || [])
    .map(of)
    .filter(Boolean)
    .slice(0, 1)
    .map(p => {
      const s = p.seasonStats?.pitching || {};
      return row(p, [s.era || '', `${n(s.wins)}-${n(s.losses)}`, s.inningsPitched || '', n(s.strikeOuts), n(s.baseOnBalls)]);
    });
  return { batting: { labels: SEASON_BATTING, rows: batters }, pitching: { labels: SEASON_PITCHING, rows: pitchers } };
}

// ESPN's box score as good as empty: no player with a number in it.
export const emptyBox = players => !players.some(p => p.tables.some(tb => tb.rows.some(r => r.stats.some(v => /\d/.test(String(v))))));
