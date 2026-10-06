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
// "Yandy Díaz" → "Y. Díaz", as ESPN shows them.
const shortName = full => {
  const [first, ...rest] = String(full || '').split(' ');
  return rest.length ? `${first[0]}. ${rest.join(' ')}` : first;
};
// MLB's own picture of a player, by its id.
export const mlbHeadshot = id => (id ? `https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_auto:best/v1/people/${id}/headshot/67/current` : null);
const person = p => (p?.fullName ? { id: '', name: p.fullName, headshot: mlbHeadshot(p.id) } : null);

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
        }
      };
    });
}

// The MLB game of an Orbit Sports event (each side's English name).
export const mlbGameOf = (games, e) => games.find(g => g.home === plain(e.home?.en || e.home?.name) && g.away === plain(e.away?.en || e.away?.name)) || null;

// ESPN's table columns, filled from MLB's numbers: the game's line, then the season's.
const BATTING = ['H-AB', 'AB', 'R', 'H', 'RBI', 'HR', 'BB', 'K', '#P', 'AVG', 'OBP', 'SLG'];
const PITCHING = ['IP', 'H', 'R', 'ER', 'BB', 'K', 'HR', 'PC-ST', 'ERA', 'PC'];
const n = v => (v == null ? '0' : String(v));

// side: 'home' | 'away' → { batting: { labels, rows }, pitching: { labels, rows } },
// each row { name, full, mlbId, headshot, pos, starter, stats }.
export function mlbBoxTables(data, side) {
  const t = data?.teams?.[side];
  if (!t) return null;
  const of = id => t.players?.[`ID${id}`];
  const row = (p, stats) => ({ name: shortName(p.person?.fullName), full: p.person?.fullName || '', mlbId: String(p.person?.id ?? ''), headshot: mlbHeadshot(p.person?.id), pos: p.position?.abbreviation || '', stats });
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

// ESPN's box score as good as empty: no player with a number in it.
export const emptyBox = players => !players.some(p => p.tables.some(tb => tb.rows.some(r => r.stats.some(v => /\d/.test(String(v))))));
