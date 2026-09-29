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

const ELTA = { zh: '愛爾達 ELTA.tv', en: 'ELTA.tv', kind: 'ott', svc: 'elta' };
const ELTA_MOD = { zh: '愛爾達體育（MOD）', en: 'ELTA Sports (MOD)', kind: 'tv', svc: 'elta' };
const HAMI = { zh: 'Hami Video', en: 'Hami Video', kind: 'ott', svc: 'hami' };
const VL = { zh: '緯來體育台', en: 'Videoland Sports', kind: 'tv', svc: 'videoland' };
const DAZN = { zh: 'DAZN', en: 'DAZN', kind: 'ott', svc: 'dazn' };
const DAZN_TV = { zh: 'DAZN 體育台', en: 'DAZN (cable)', kind: 'tv', svc: 'dazn' };
const BOS = { zh: '博斯運動', en: 'Sportcast', kind: 'tv', svc: 'sportcast' };
const BOS_TENNIS = { zh: '博斯網球台', en: 'Sportcast Tennis', kind: 'tv', svc: 'sportcast' };
const BOS_GOLF = { zh: '博斯高球台', en: 'Sportcast Golf', kind: 'tv', svc: 'sportcast' };
const pass = (svc, zh, en = zh) => ({ zh, en, kind: 'pass', svc });

const SOCCER_ELTA = [ELTA, ELTA_MOD, HAMI];

export const BROADCAST = {
  mlb: [ELTA, ELTA_MOD, VL, { zh: '東森電影台（週末）', en: 'EBC Movie (weekends)', kind: 'tv', svc: 'free' }, { zh: '華視（週末）', en: 'CTS (weekends)', kind: 'tv', svc: 'free' }, HAMI, pass('mlbtv', 'MLB.TV'), { zh: 'Apple TV+（週五）', en: 'Apple TV+ (Fridays)', kind: 'ott', svc: 'appletv' }],
  npb: [DAZN, DAZN_TV, VL],
  cpbl: [pass('cpbltv', 'CPBLTV'), VL, DAZN, { zh: 'MOMOTV', en: 'MOMOTV', kind: 'tv', svc: 'momo' }, ELTA, HAMI, { zh: 'MyVideo', en: 'MyVideo', kind: 'ott', svc: 'myvideo' }],
  kbo: [],
  nba: [ELTA, ELTA_MOD, VL, pass('nbapass', 'NBA League Pass')],
  wnba: [pass('nbapass', 'WNBA League Pass')],
  nfl: [DAZN, pass('dazn', 'NFL Game Pass（DAZN）', 'NFL Game Pass (DAZN)')],
  nhl: [pass('dazn', 'NHL.TV（DAZN）', 'NHL.TV (DAZN)')],
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
  mls: [pass('appletv', 'MLS Season Pass（Apple TV）', 'MLS Season Pass (Apple TV)')],
  f1: [ELTA, ELTA_MOD, VL, pass('f1tv', 'F1 TV')],
  atp: [BOS_TENNIS, pass('tennistv', 'Tennis TV')],
  wta: [BOS_TENNIS],
  pga: [BOS_GOLF],
  lpga: [BOS_GOLF],
  ufc: [pass('ufcpass', 'UFC Fight Pass')],
  badminton: [BOS, ELTA],
  euroleague: [pass('euroleaguetv', 'EuroLeague TV')]
};

export const broadcastsOf = league => BROADCAST[league] || [];

// The services a person can say they have (the recommendations keep to
// those), in the order they're offered.
export const SERVICES = [
  { id: 'elta', zh: '愛爾達（ELTA.tv / MOD）', en: 'ELTA (ELTA.tv / MOD)' },
  { id: 'videoland', zh: '緯來體育台', en: 'Videoland Sports' },
  { id: 'dazn', zh: 'DAZN', en: 'DAZN' },
  { id: 'sportcast', zh: '博斯運動', en: 'Sportcast' },
  { id: 'hami', zh: 'Hami Video', en: 'Hami Video' },
  { id: 'free', zh: '無線台（華視、東森）', en: 'Free-to-air (CTS, EBC)' },
  { id: 'momo', zh: 'MOMOTV', en: 'MOMOTV' },
  { id: 'myvideo', zh: 'MyVideo', en: 'MyVideo' },
  { id: 'appletv', zh: 'Apple TV', en: 'Apple TV' },
  { id: 'cpbltv', zh: 'CPBLTV', en: 'CPBLTV' },
  { id: 'mlbtv', zh: 'MLB.TV', en: 'MLB.TV' },
  { id: 'nbapass', zh: 'NBA League Pass', en: 'NBA League Pass' },
  { id: 'f1tv', zh: 'F1 TV', en: 'F1 TV' },
  { id: 'tennistv', zh: 'Tennis TV', en: 'Tennis TV' },
  { id: 'ufcpass', zh: 'UFC Fight Pass', en: 'UFC Fight Pass' },
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
