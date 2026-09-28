// Quadra Fixtures' text, Traditional Chinese and English (the page follows
// the browser's language).
export const STRINGS = {
  zh: {
    appName: 'Quadra Fixtures',
    tab_home: '首頁', tab_scores: '比分', tab_standings: '排名', tab_news: '新聞',
    forYou: '為你推薦', forYouSub: '依你追蹤、瀏覽和下注的球隊聯盟', liveNow: '正在進行', yourTeams: '你追蹤的球隊', yourBets: '你在 Play 的投注',
    today: '今天', tomorrow: '明天', yesterday: '昨天', highlights: '今日焦點', allSports: '全部', noGames: '這天沒有比賽。', loading: '載入中…', failed: '暫時無法取得資料。',
    live: '進行中', final: '完賽', upcoming: '未開賽', postponed: '延期', vs: 'vs', at: '@', starts: '開賽', updated: '{time} 更新',
    follow: '追蹤', following: '已追蹤', betInPlay: '到 Play 下注', openInPlay: '在 Play 查看',
    overview: '概況', stats: '數據', players: '球員', plays: '過程', lineups: '陣容', h2h: '對戰', table: '排名', injuries: '傷兵', news: '新聞',
    venue: '場地', attendance: '觀眾', officials: '裁判', weather: '天氣', tv: '轉播', record: '戰績', standing: '排名', nextGame: '下一場', lastGames: '最近比賽', schedule: '賽程', roster: '球員名單',
    winProb: '勝率走勢', homeWin: '主隊勝率', leaders: '數據領先', form: '近況', series: '本季對戰',
    age: '年齡', height: '身高', weight: '體重', born: '生日', birthPlace: '出生地', position: '位置', season: '本季數據', team: '球隊',
    followTeams: '追蹤你喜歡的球隊', followHint: '打開任何一場比賽或球隊，按「追蹤」。首頁會優先顯示它們的比賽和新聞。',
    noStandings: '這個聯賽沒有積分榜。', noNews: '沒有新聞。', readMore: '閱讀全文', search: '搜尋球隊',
    sessions: '場次', field: '名次', draws: '籤表', card: '對戰卡', round: '輪次',
    betsOn: '{n} 張投注單', pinned: '已加入你的賽程', openBets: '投注中',
    footer: ''
  },
  en: {
    appName: 'Quadra Fixtures',
    tab_home: 'Home', tab_scores: 'Scores', tab_standings: 'Standings', tab_news: 'News',
    forYou: 'For you', forYouSub: 'From the teams and leagues you follow, open and bet on', liveNow: 'Live now', yourTeams: 'Your teams', yourBets: 'Your bets in Play',
    today: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday', highlights: 'Today’s highlights', allSports: 'All', noGames: 'No games on this day.', loading: 'Loading…', failed: 'Couldn’t load this right now.',
    live: 'Live', final: 'Final', upcoming: 'Upcoming', postponed: 'Postponed', vs: 'vs', at: '@', starts: 'Starts', updated: 'Updated {time}',
    follow: 'Follow', following: 'Following', betInPlay: 'Bet in Play', openInPlay: 'See in Play',
    overview: 'Overview', stats: 'Stats', players: 'Players', plays: 'Plays', lineups: 'Line-ups', h2h: 'Head to head', table: 'Table', injuries: 'Injuries', news: 'News',
    venue: 'Venue', attendance: 'Attendance', officials: 'Officials', weather: 'Weather', tv: 'TV', record: 'Record', standing: 'Standing', nextGame: 'Next game', lastGames: 'Recent games', schedule: 'Schedule', roster: 'Roster',
    winProb: 'Win probability', homeWin: 'Home win chance', leaders: 'Leaders', form: 'Form', series: 'Season series',
    age: 'Age', height: 'Height', weight: 'Weight', born: 'Born', birthPlace: 'Birthplace', position: 'Position', season: 'This season', team: 'Team',
    followTeams: 'Follow the teams you like', followHint: 'Open any match or team and tap Follow. Home puts their games and news first.',
    noStandings: 'This league has no table.', noNews: 'No news.', readMore: 'Read more', search: 'Search teams',
    sessions: 'Sessions', field: 'Order', draws: 'Draws', card: 'Fight card', round: 'Round',
    betsOn: '{n} slips', pinned: 'In your schedule', openBets: 'Bets on it',
    footer: ''
  }
};

export function detectLocale() {
  try {
    const saved = localStorage.getItem('quadra.lang');
    if (saved === 'zh' || saved === 'en') return saved;
  } catch {}
  const langs = globalThis.navigator?.languages || [globalThis.navigator?.language || 'zh-TW'];
  return langs.some(l => /^zh/i.test(l)) || !langs.some(l => /^en/i.test(l)) ? 'zh' : 'en';
}
export function makeT(locale) {
  const dict = STRINGS[locale] || STRINGS.zh;
  return (key, vars = {}) => String(dict[key] ?? STRINGS.zh[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}
