// Where to watch in Taiwan, by league: the channels and streaming services
// that carry it (checked September 2026). ESPN's own broadcast list is the
// US networks, which don't help anyone here, so it isn't shown.
//
//   kind  'tv' a cable / MOD channel, 'ott' a streaming service,
//         'pass' the league's own subscription
//
// Sources: ELTA's 2026-27 football and baseball announcements, ELTA's NBA
// 2026-2030 and F1 2026-2029 rights, DAZN Taiwan (LaLiga, NFL from
// 2026-27, NPB), 緯來 (NBA, MLB daily), CPBL's 2026 platform list, 博斯
// (tennis, golf, badminton). Rights change: keep this list current.
export const CHECKED = '2026-09';

const ELTA = { zh: '愛爾達 ELTA.tv', en: 'ELTA.tv', kind: 'ott' };
const ELTA_MOD = { zh: '愛爾達體育（MOD）', en: 'ELTA Sports (MOD)', kind: 'tv' };
const HAMI = { zh: 'Hami Video', en: 'Hami Video', kind: 'ott' };
const VL = { zh: '緯來體育台', en: 'Videoland Sports', kind: 'tv' };
const DAZN = { zh: 'DAZN', en: 'DAZN', kind: 'ott' };
const DAZN_TV = { zh: 'DAZN 體育台', en: 'DAZN (cable)', kind: 'tv' };
const BOS = { zh: '博斯運動', en: 'Sportcast', kind: 'tv' };
const BOS_TENNIS = { zh: '博斯網球台', en: 'Sportcast Tennis', kind: 'tv' };
const BOS_GOLF = { zh: '博斯高球台', en: 'Sportcast Golf', kind: 'tv' };
const pass = (zh, en = zh) => ({ zh, en, kind: 'pass' });

const SOCCER_ELTA = [ELTA, ELTA_MOD, HAMI];

export const BROADCAST = {
  mlb: [ELTA, ELTA_MOD, VL, { zh: '東森電影台（週末）', en: 'EBC Movie (weekends)', kind: 'tv' }, { zh: '華視（週末）', en: 'CTS (weekends)', kind: 'tv' }, HAMI, pass('MLB.TV'), { zh: 'Apple TV+（週五）', en: 'Apple TV+ (Fridays)', kind: 'ott' }],
  npb: [DAZN, DAZN_TV, VL],
  cpbl: [pass('CPBLTV'), VL, DAZN, { zh: 'MOMOTV', en: 'MOMOTV', kind: 'tv' }, ELTA, HAMI, { zh: 'MyVideo', en: 'MyVideo', kind: 'ott' }],
  kbo: [],
  nba: [ELTA, ELTA_MOD, VL, pass('NBA League Pass')],
  wnba: [pass('WNBA League Pass')],
  nfl: [DAZN, pass('NFL Game Pass（DAZN）', 'NFL Game Pass (DAZN)')],
  nhl: [pass('NHL.TV（DAZN）', 'NHL.TV (DAZN)')],
  epl: [ELTA, ELTA_MOD],
  facup: SOCCER_ELTA,
  ucl: [ELTA, ELTA_MOD],
  uel: SOCCER_ELTA,
  uecl: SOCCER_ELTA,
  bundesliga: [ELTA, HAMI],
  seriea: [ELTA, HAMI],
  ligue1: [ELTA, HAMI],
  scotland: [ELTA],
  nationsleague: SOCCER_ELTA,
  laliga: [DAZN, DAZN_TV],
  mls: [pass('MLS Season Pass（Apple TV）', 'MLS Season Pass (Apple TV)')],
  f1: [ELTA, ELTA_MOD, VL, pass('F1 TV')],
  atp: [BOS_TENNIS, pass('Tennis TV')],
  wta: [BOS_TENNIS],
  pga: [BOS_GOLF],
  lpga: [BOS_GOLF],
  ufc: [pass('UFC Fight Pass')],
  badminton: [BOS, ELTA],
  euroleague: [pass('EuroLeague TV')]
};

export const broadcastsOf = league => BROADCAST[league] || [];
export const broadcastText = (league, lang = 'zh', n = 3) =>
  broadcastsOf(league)
    .slice(0, n)
    .map(b => (lang === 'en' ? b.en : b.zh))
    .join('、');
