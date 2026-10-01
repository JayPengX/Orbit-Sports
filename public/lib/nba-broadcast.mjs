// NBA.com's regional schedule includes the broadcaster list for each game.
// Region 32 is Taiwan; this is the JSON feed behind its schedule filters.
export const NBA_TAIWAN_SCHEDULE = 'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_32.json';

const plain = value =>
  String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const providersOf = schedule => {
  const entries = schedule?.broadcasterList || [];
  return new Set(entries.filter(x => x.regionId === 32 && /elta/i.test(`${x.broadcasterDisplay} ${x.broadcasterAbbreviation}`)).map(x => Number(x.broadcasterId)));
};

const hasElta = (game, providers) =>
  Object.values(game.broadcasters || {})
    .flat()
    .some(b => providers.has(Number(b.broadcasterId)) || /elta\s*tv/i.test(b.broadcasterDisplay || ''));

const normalizeTeam = side => ({
  name: plain(side?.en || side?.name || side?.short),
  abbr: plain(side?.abbr).replaceAll(' ', '').toUpperCase()
});

const matchesTeam = (side, team) => {
  const target = normalizeTeam(side);
  const tri = String(team?.abbr || team?.teamTricode || '').toUpperCase();
  if (target.abbr && tri && target.abbr === tri) return true;
  const name = plain(team?.name || team?.teamName);
  return Boolean(name && (target.name === name || target.name.endsWith(` ${name}`)));
};

// Keep only the fields used by Fixtures, so cached schedules don't retain the
// large scoring and game-state payload from NBA.com.
export function parseNbaTaiwanSchedule(data) {
  const schedule = data?.leagueSchedule;
  const dates = Array.isArray(schedule?.gameDates) ? schedule.gameDates : [];
  const providers = providersOf(schedule);
  const games = dates.flatMap(date =>
    (date.games || []).flatMap(game => {
      const start = game.gameDateTimeUTC;
      if (!start || !game.homeTeam || !game.awayTeam) return [];
      return [{
        id: String(game.gameId || game.gameCode || ''),
        start,
        home: { name: game.homeTeam.teamName, city: game.homeTeam.teamCity, abbr: game.homeTeam.teamTricode },
        away: { name: game.awayTeam.teamName, city: game.awayTeam.teamCity, abbr: game.awayTeam.teamTricode },
        elta: hasElta(game, providers)
      }];
    })
  );
  if (!games.length) return null;
  const starts = games.map(g => Date.parse(g.start)).filter(Number.isFinite);
  if (!starts.length) return null;
  return { seasonYear: schedule.seasonYear || '', from: Math.min(...starts), to: Math.max(...starts), games };
}

// The ESPN event and NBA.com game use different ids. Match on both teams,
// accepting ESPN's city-qualified name or the NBA team tricode, then the
// closest scheduled tip-off.
export function nbaTaiwanGame(event, schedule) {
  if (event?.league !== 'nba' || !schedule?.games?.length) return null;
  const start = Date.parse(event.start);
  if (!Number.isFinite(start) || start < schedule.from || start > schedule.to) return null;
  const candidates = schedule.games
    .filter(g => matchesTeam(event.home, g.home) && matchesTeam(event.away, g.away))
    .map(g => ({ game: g, difference: Math.abs(Date.parse(g.start) - start) }))
    .filter(x => Number.isFinite(x.difference) && x.difference <= 18 * 60 * 60_000)
    .sort((a, b) => a.difference - b.difference);
  return candidates[0]?.game || null;
}
