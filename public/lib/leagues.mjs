// Every league Quadra Fixtures covers: its sport, where its data comes from
// and, when Quadra Play sells it, Play's key for it (the "bet on this" link).
//
//   espn    ESPN's site API path (scoreboards, match summaries, teams,
//           rosters, standings, news, players)
//   kambi   Kambi's list view path, for the leagues ESPN doesn't carry
//           (schedules and live scores only)
//   play    Quadra Play's league key
//   kind    'match' two sides; 'field' a race or tournament; 'card' a fight card;
//           'draw' a tennis draw

export const SPORTS = {
  soccer: { zh: '足球', en: 'Soccer', icon: '⚽' },
  baseball: { zh: '棒球', en: 'Baseball', icon: '⚾' },
  basketball: { zh: '籃球', en: 'Basketball', icon: '🏀' },
  football: { zh: '美式足球', en: 'Football', icon: '🏈' },
  hockey: { zh: '冰球', en: 'Hockey', icon: '🏒' },
  tennis: { zh: '網球', en: 'Tennis', icon: '🎾' },
  racing: { zh: '賽車', en: 'Racing', icon: '🏎️' },
  golf: { zh: '高爾夫', en: 'Golf', icon: '⛳' },
  mma: { zh: '綜合格鬥', en: 'MMA', icon: '🥊' },
  rugby: { zh: '橄欖球', en: 'Rugby', icon: '🏉' },
  aussie: { zh: '澳式足球', en: 'Aussie rules', icon: '🏉' },
  racket: { zh: '球拍與其他', en: 'Racket & more', icon: '🏓' }
};

const soccer = (espn, zh, en, play, extra = {}) => ({ sport: 'soccer', espn: `soccer/${espn}`, zh, en, play, kind: 'match', ...extra });

export const LEAGUES = {
  // Baseball
  mlb: { sport: 'baseball', espn: 'baseball/mlb', zh: 'MLB 美國職棒', en: 'MLB', play: 'mlb', kind: 'match', top: true },
  npb: { sport: 'baseball', kambi: 'baseball/japan/npb', zh: '日本職棒', en: 'NPB', play: 'npb', kind: 'match' },
  kbo: { sport: 'baseball', kambi: 'baseball/south_korea/kbo_league', zh: '韓國職棒', en: 'KBO', play: 'kbo', kind: 'match' },
  cpbl: { sport: 'baseball', kambi: 'baseball/taiwan/chinese_professional_baseball', zh: '中華職棒', en: 'CPBL', play: 'cpbl', kind: 'match', top: true },
  // Basketball
  nba: { sport: 'basketball', espn: 'basketball/nba', zh: 'NBA', en: 'NBA', play: 'nba', kind: 'match', top: true },
  wnba: { sport: 'basketball', espn: 'basketball/wnba', zh: 'WNBA', en: 'WNBA', play: 'wnba', kind: 'match' },
  ncaam: { sport: 'basketball', espn: 'basketball/mens-college-basketball', zh: 'NCAA 男籃', en: 'NCAA Men', play: 'ncaam', kind: 'match' },
  ncaaw: { sport: 'basketball', espn: 'basketball/womens-college-basketball', zh: 'NCAA 女籃', en: 'NCAA Women', play: 'ncaaw', kind: 'match' },
  euroleague: { sport: 'basketball', kambi: 'basketball/euroleague', zh: '歐洲籃球聯賽', en: 'EuroLeague', play: 'euroleague', kind: 'match' },
  bleague: { sport: 'basketball', kambi: 'basketball/japan/b1__league', zh: '日本 B 聯賽', en: 'B.League', play: 'bleague', kind: 'match' },
  // Football
  nfl: { sport: 'football', espn: 'football/nfl', zh: 'NFL', en: 'NFL', play: 'nfl', kind: 'match', top: true },
  ncaaf: { sport: 'football', espn: 'football/college-football', zh: 'NCAA 美足', en: 'College football', play: 'ncaaf', kind: 'match' },
  // Hockey
  nhl: { sport: 'hockey', espn: 'hockey/nhl', zh: 'NHL', en: 'NHL', play: 'nhl', kind: 'match' },
  // Soccer
  epl: soccer('eng.1', '英超', 'Premier League', 'epl', { top: true }),
  laliga: soccer('esp.1', '西甲', 'LaLiga', 'laliga', { top: true }),
  seriea: soccer('ita.1', '義甲', 'Serie A', 'seriea'),
  bundesliga: soccer('ger.1', '德甲', 'Bundesliga', 'bundesliga'),
  ligue1: soccer('fra.1', '法甲', 'Ligue 1', 'ligue1'),
  ucl: soccer('uefa.champions', '歐冠', 'Champions League', 'ucl', { top: true, cup: true }),
  uel: soccer('uefa.europa', '歐霸', 'Europa League', 'uel', { cup: true }),
  uecl: soccer('uefa.europa.conf', '歐協聯', 'Conference League', 'uecl', { cup: true }),
  eredivisie: soccer('ned.1', '荷甲', 'Eredivisie', 'eredivisie'),
  primeira: soccer('por.1', '葡超', 'Primeira Liga', 'primeira'),
  championship: soccer('eng.2', '英冠', 'Championship', 'championship'),
  league1: soccer('eng.3', '英甲', 'League One', 'league1'),
  scotland: soccer('sco.1', '蘇超', 'Scottish Premiership', 'scotland'),
  bundesliga2: soccer('ger.2', '德乙', '2. Bundesliga', 'bundesliga2'),
  laliga2: soccer('esp.2', '西乙', 'LaLiga 2', 'laliga2'),
  serieb: soccer('ita.2', '義乙', 'Serie B', 'serieb'),
  ligue2: soccer('fra.2', '法乙', 'Ligue 2', 'ligue2'),
  belgium: soccer('bel.1', '比甲', 'Belgian Pro League', 'belgium'),
  austria: soccer('aut.1', '奧超', 'Austrian Bundesliga', 'austria'),
  swiss: soccer('sui.1', '瑞士超', 'Swiss Super League', 'swiss'),
  denmark: soccer('den.1', '丹超', 'Danish Superliga', 'denmark'),
  norway: soccer('nor.1', '挪超', 'Eliteserien', 'norway'),
  sweden: soccer('swe.1', '瑞典超', 'Allsvenskan', 'sweden'),
  greece: soccer('gre.1', '希超', 'Greek Super League', 'greece'),
  superlig: soccer('tur.1', '土超', 'Süper Lig', 'superlig'),
  saudi: soccer('ksa.1', '沙烏地聯', 'Saudi Pro League', 'saudi'),
  mls: soccer('usa.1', '美職足', 'MLS', 'mls'),
  usl: soccer('usa.usl.1', 'USL', 'USL Championship', 'usl'),
  nwsl: soccer('usa.nwsl', '美國女足聯', 'NWSL', 'nwsl'),
  ligamx: soccer('mex.1', '墨超', 'Liga MX', 'ligamx'),
  brasileirao: soccer('bra.1', '巴甲', 'Brasileirão', 'brasileirao'),
  argentina: soccer('arg.1', '阿甲', 'Liga Profesional', 'argentina'),
  colombia: soccer('col.1', '哥甲', 'Colombian Primera A', 'colombia'),
  chile: soccer('chi.1', '智甲', 'Chilean Primera', 'chile'),
  libertadores: soccer('conmebol.libertadores', '解放者盃', 'Copa Libertadores', 'libertadores', { cup: true }),
  sudamericana: soccer('conmebol.sudamericana', '南美球會盃', 'Copa Sudamericana', 'sudamericana', { cup: true }),
  jleague: soccer('jpn.1', '日職聯', 'J1 League', 'jleague'),
  kleague: soccer('kor.1', 'K 聯賽', 'K League 1', null),
  csl: soccer('chn.1', '中超', 'Chinese Super League', 'csl'),
  aleague: soccer('aus.1', '澳超', 'A-League', 'aleague'),
  facup: soccer('eng.fa', '英足總盃', 'FA Cup', null, { cup: true }),
  leaguecup: soccer('eng.league_cup', '英聯盃', 'EFL Cup', 'leaguecup', { cup: true }),
  copadelrey: soccer('esp.copa_del_rey', '國王盃', 'Copa del Rey', 'copadelrey', { cup: true }),
  nationsleague: soccer('uefa.nations', '歐國聯', 'Nations League', 'nationsleague', { cup: true }),
  wcqeurope: soccer('fifa.worldq.uefa', '世界盃資格賽（歐洲）', 'WC qualifying (UEFA)', 'wcqeurope', { cup: true }),
  // Tennis
  atp: { sport: 'tennis', espn: 'tennis/atp', zh: 'ATP 男網', en: 'ATP', play: 'tennis', kind: 'draw' },
  wta: { sport: 'tennis', espn: 'tennis/wta', zh: 'WTA 女網', en: 'WTA', play: 'wta', kind: 'draw' },
  // Racing
  f1: { sport: 'racing', espn: 'racing/f1', zh: 'F1 一級方程式', en: 'Formula 1', play: 'f1', kind: 'field', top: true },
  indycar: { sport: 'racing', espn: 'racing/irl', zh: 'IndyCar', en: 'IndyCar', kind: 'field' },
  nascar: { sport: 'racing', espn: 'racing/nascar-premier', zh: 'NASCAR', en: 'NASCAR Cup', kind: 'field' },
  // Golf
  pga: { sport: 'golf', espn: 'golf/pga', zh: 'PGA 巡迴賽', en: 'PGA Tour', kind: 'field' },
  lpga: { sport: 'golf', espn: 'golf/lpga', zh: 'LPGA', en: 'LPGA', kind: 'field' },
  // Fighting
  ufc: { sport: 'mma', espn: 'mma/ufc', zh: 'UFC', en: 'UFC', kind: 'card' },
  // Rugby and Aussie rules
  nrl: { sport: 'rugby', espn: 'rugby-league/3', zh: 'NRL 聯盟式橄欖球', en: 'NRL', kind: 'match' },
  afl: { sport: 'aussie', espn: 'australian-football/afl', zh: 'AFL 澳式足球', en: 'AFL', kind: 'match' },
  // Racket and more (Kambi)
  badminton: { sport: 'racket', kambi: 'badminton', zh: '羽球', en: 'Badminton', play: 'badminton', kind: 'match', players: true },
  tabletennis: { sport: 'racket', kambi: 'table_tennis', zh: '桌球', en: 'Table tennis', play: 'tabletennis', kind: 'match', players: true },
  volleyball: { sport: 'racket', kambi: 'volleyball', zh: '排球', en: 'Volleyball', play: 'volleyball', kind: 'match' },
  snooker: { sport: 'racket', kambi: 'snooker', zh: '司諾克', en: 'Snooker', play: 'snooker', kind: 'match', players: true }
};

export const leagueName = (key, lang = 'zh') => LEAGUES[key]?.[lang === 'en' ? 'en' : 'zh'] || key;
export const leaguesOf = sport => Object.keys(LEAGUES).filter(k => LEAGUES[k].sport === sport);
export const TOP_LEAGUES = Object.keys(LEAGUES).filter(k => LEAGUES[k].top);
// Kinds of data each source has.
export const hasStandings = key => Boolean(LEAGUES[key]?.espn) && ['match'].includes(LEAGUES[key].kind) && !LEAGUES[key].cup;
export const hasNews = key => Boolean(LEAGUES[key]?.espn);
export const hasTeams = key => Boolean(LEAGUES[key]?.espn) && LEAGUES[key].kind === 'match';
export const leagueLogo = key => {
  const l = LEAGUES[key];
  if (!l?.espn) return null;
  const [sport, code] = l.espn.split('/');
  if (sport === 'soccer') return null;
  return `https://a.espncdn.com/i/teamlogos/leagues/500/${code === 'mens-college-basketball' || code === 'womens-college-basketball' ? 'ncaa' : code === 'college-football' ? 'ncaa' : code}.png`;
};
