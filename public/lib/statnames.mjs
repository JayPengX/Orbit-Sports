// ESPN's stat names in Chinese (team stats and leaders), by their English
// label, lower-cased. Anything not here stays as ESPN wrote it.
const ZH = {
  // Soccer
  fouls: '犯規', 'yellow cards': '黃牌', 'red cards': '紅牌', offsides: '越位', 'corner kicks': '角球', saves: '撲救', possession: '控球率',
  shots: '射門', 'shots on goal': '射正', 'on goal': '射正', 'on target': '射正', 'shot %': '射正率', 'shots on target': '射正', 'blocked shots': '被封阻射門',
  passes: '傳球', 'accurate passes': '成功傳球', 'pass completion %': '傳球成功率', 'pass %': '傳球成功率', crosses: '傳中', 'accurate crosses': '成功傳中',
  'long balls': '長傳', 'accurate long balls': '成功長傳', tackles: '搶斷', 'effective tackles': '成功搶斷', 'tackle %': '搶斷成功率', interceptions: '攔截',
  'total shots': '射門總數', 'total passes': '傳球總數', 'passes completed': '成功傳球', 'big chances': '絕佳機會', 'key passes': '關鍵傳球', dribbles: '盤帶', 'duels won': '對抗成功',
  clearances: '解圍', 'defensive interventions': '防守貢獻', 'defensive actions': '防守動作', 'effective clearances': '有效解圍', 'penalty goals': '點球進球', 'penalty kicks taken': '罰點球', goals: '進球', assists: '助攻',
  // Basketball
  'field goals': '投籃', 'field goal %': '投籃命中率', 'fg%': '投籃命中率', '3pt': '三分球', 'three point %': '三分命中率', '3p%': '三分命中率',
  'free throws': '罰球', 'free throw %': '罰球命中率', 'ft%': '罰球命中率', rebounds: '籃板', 'offensive rebounds': '進攻籃板', 'defensive rebounds': '防守籃板',
  steals: '抄截', blocks: '阻攻', turnovers: '失誤', 'total turnovers': '總失誤', 'technical fouls': '技術犯規', 'flagrant fouls': '惡意犯規',
  'fast break points': '快攻得分', 'points in paint': '禁區得分', 'points off turnovers': '失誤轉換得分', 'largest lead': '最大領先', points: '得分',
  'lead changes': '領先易手', 'personal fouls': '個人犯規', 'team turnovers': '球隊失誤',
  // Baseball
  hits: '安打', runs: '得分', errors: '失誤', 'batting average': '打擊率', avg: '打擊率', 'home runs': '全壘打', rbis: '打點', rbi: '打點', 'runs batted in': '打點', 'earned run average': '防禦率', 'on-base percentage': '上壘率', 'slugging percentage': '長打率', 'walks and hits per inning pitched': '每局被上壘率', walks: '保送',
  strikeouts: '三振', 'stolen bases': '盜壘', 'left on base': '殘壘', era: '防禦率', 'earned runs': '自責分', 'innings pitched': '投球局數', pitches: '投球數',
  doubles: '二壘安打', triples: '三壘安打', 'on base %': '上壘率', obp: '上壘率', slg: '長打率', ops: '整體攻擊指數', whip: '每局被上壘率', wins: '勝投', saves_: '救援'
};

// A player's season line (ESPN's short labels): PPG, HR, G, SHOT…
const SHORT = {
  ppg: '場均得分', rpg: '場均籃板', apg: '場均助攻', spg: '場均抄截', bpg: '場均阻攻', 'fg%': '投籃命中率', '3p%': '三分命中率', 'ft%': '罰球命中率', min: '上場時間', mpg: '場均時間',
  strt: '先發', fc: '犯規', fa: '被犯規', of: '越位', ab: '打數', '2b': '二壘打', '3b': '三壘打', bb: '保送', reb: '籃板', ast: '助攻', blk: '阻攻', stl: '抄截', pf: '犯規', to: '失誤',
  g: '進球', a: '助攻', shot: '射門', sht: '射門', sog: '射正', 'strt-subin': '先發（替補）', app: '出賽', yc: '黃牌', rc: '紅牌', ga: '失球', cs: '零封',
  hr: '全壘打', r: '得分', h: '安打', sb: '盜壘', 'w-l': '勝-敗', k: '三振', so: '三振', ip: '投球局數', gp: '出賽',
  'plus/minus': '正負值', '+/-': '正負值', pts: '積分', w: '勝', l: '敗', d: '和', wins: '勝場', losses: '敗場'
};
export function statName(label, lang = 'zh') {
  if (lang === 'en' || !label) return label;
  const key = String(label).toLowerCase().trim();
  return ZH[key] || SHORT[key] || label;
}
// A stats card's title: "2026 season stats" → "2026 球季數據".
export function statsTitle(title, lang = 'zh') {
  if (lang === 'en' || !title) return title;
  return String(title)
    .replace(/\bregular season stats\b/i, '例行賽數據')
    .replace(/\bpostseason stats\b/i, '季後賽數據')
    .replace(/\bseason stats\b/i, '球季數據')
    .replace(/\bseason overview\b/i, '球季總覽')
    .replace(/\bstats\b/i, '數據')
    .replace(/\branking\b/i, '排名')
    .replace(/English Premier League|Premier League/, '英超')
    .replace(/LALIGA|LaLiga|Spanish LALIGA/, '西甲')
    .replace(/Italian Serie A|Serie A/, '義甲')
    .replace(/German Bundesliga|Bundesliga/, '德甲')
    .replace(/French Ligue 1|Ligue 1/, '法甲')
    .replace(/UEFA Champions League/, '歐冠');
}
// Fixed words machine translation gets wrong ("Final" → 最終的, "Right" → 正確的):
// a cup's rounds, a player's hand, positions.
const WORDS = {
  final: '決賽', finals: '決賽', semifinal: '準決賽', semifinals: '準決賽', 'semi-final': '準決賽', 'semi-finals': '準決賽', quarterfinal: '八強', quarterfinals: '八強', 'quarter-final': '八強', 'quarter-finals': '八強',
  'round of 16': '16 強', 'round of 32': '32 強', 'round 1': '第一輪', 'round 2': '第二輪', 'round 3': '第三輪', 'round 4': '第四輪', '1st round': '第一輪', '2nd round': '第二輪', '3rd round': '第三輪', '4th round': '第四輪', 'first round': '第一輪', 'second round': '第二輪', 'third round': '第三輪', 'fourth round': '第四輪', qualifying: '資格賽', 'qualifying round': '資格賽',
  right: '右手', 'right-handed': '右手', 'right handed': '右手', left: '左手', 'left-handed': '左手', 'left handed': '左手',
  forward: '前鋒', midfielder: '中場', defender: '後衛', goalkeeper: '守門員', guard: '後衛', 'point guard': '控球後衛', 'shooting guard': '得分後衛', 'small forward': '小前鋒', 'power forward': '大前鋒', center: '中鋒', 'guard-forward': '後衛／前鋒', 'forward-center': '前鋒／中鋒',
  pitcher: '投手', 'starting pitcher': '先發投手', 'relief pitcher': '後援投手', catcher: '捕手', 'first baseman': '一壘手', 'second baseman': '二壘手', 'third baseman': '三壘手', shortstop: '游擊手', 'left fielder': '左外野手', 'center fielder': '中外野手', 'right fielder': '右外野手', outfielder: '外野手', infielder: '內野手', 'designated hitter': '指定打擊',
  'left wing': '左翼', 'right wing': '右翼'
};
// One of those words in Chinese, or null (then translated as it comes).
export function fixedWord(text, lang = 'zh') {
  if (lang === 'en' || !text) return null;
  return WORDS[String(text).toLowerCase().replace(/\s+/g, ' ').trim()] ?? null;
}
// A date ESPN wrote as "30/9/1997" (or an ISO date) in the reader's words.
export function dateText(iso, display, lang = 'zh') {
  let d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(display || '').trim());
    // ESPN's display is day/month/year (a day over 12 can't be a month).
    if (m) d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  }
  if (!d || Number.isNaN(d.getTime())) return display || '';
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-TW', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}
// A table's group in Chinese: "American League" → 美國聯盟, "AL East" → 美聯東區,
// "Driver Standings" → 車手積分榜; a season's league name without its years' English.
export function groupZh(name, lang = 'zh') {
  const n = String(name || '').trim();
  if (lang === 'en' || !n) return n;
  const FIXED = {
    'american league': '美國聯盟', 'national league': '國家聯盟', 'eastern conference': '東區', 'western conference': '西區',
    'driver standings': '車手積分榜', 'constructor standings': '車隊積分榜', 'drivers standings': '車手積分榜', 'constructors standings': '車隊積分榜', 'overall': '總排名', 'league phase': '聯賽階段',
    'atlantic division': '大西洋組', 'central division': '中央組', 'southeast division': '東南組', 'northwest division': '西北組', 'pacific division': '太平洋組', 'southwest division': '西南組'
  };
  if (FIXED[n.toLowerCase()]) return FIXED[n.toLowerCase()];
  const div = /^(AL|NL) (East|West|Central)$/i.exec(n);
  if (div) return `${{ al: '美聯', nl: '國聯' }[div[1].toLowerCase()]}${{ east: '東區', west: '西區', central: '中區' }[div[2].toLowerCase()]}`;
  const grp = /^Group ([A-Z])$/i.exec(n);
  if (grp) return `${grp[1].toUpperCase()} 組`;
  // The Nations League's tiers: Group C2 → C 級第 2 組.
  const tier = /^Group ([A-D])(\d)$/i.exec(n);
  if (tier) return `${tier[1].toUpperCase()} 級第 ${tier[2]} 組`;
  return statsTitle(n.replace(/^\d{4}(-\d{2})?\s+/, ''), lang);
}
// A leader's line ("Matches: 5, Goals: 5", "25 PTS, 8 REB") in Chinese words.
export function leaderValue(text, lang = 'zh') {
  const t = String(text || '');
  if (lang === 'en' || !/[A-Za-z]/.test(t)) return t;
  const W = { matches: '出賽', goals: '進球', assists: '助攻', 'total shots': '射門', shots: '射門', saves: '撲救', 'clean sheets': '零封', appearances: '出賽', pts: '分', reb: '籃板', ast: '助攻', stl: '抄截', blk: '阻攻', hr: '全壘打', rbi: '打點', avg: '打擊率', era: '防禦率', k: '三振', w: '勝', l: '敗', sv: '救援', g: '進球', a: '助攻', p: '分', '+/-': '正負值' };
  return t
    .replace(/([A-Za-z][A-Za-z +/-]*?)\s*:\s*/g, (m, w) => `${W[w.trim().toLowerCase()] ?? w.trim()} `)
    .replace(/(\d)\s+([A-Za-z+/-]+)\b/g, (m, d, w) => (W[w.toLowerCase()] ? `${d} ${W[w.toLowerCase()]}` : m))
    .replace(/,\s*/g, '、');
}
// A roster's position abbreviation in Chinese, by sport (G is a goalkeeper in
// soccer, a guard in basketball).
export function posZh(abbr, sport, lang = 'zh') {
  const a = String(abbr || '').toUpperCase();
  if (lang === 'en' || !a) return abbr || '';
  const BY = {
    soccer: { G: '門將', GK: '門將', D: '後衛', M: '中場', F: '前鋒' },
    basketball: { G: '後衛', F: '前鋒', C: '中鋒', PG: '控衛', SG: '得分後衛', SF: '小前鋒', PF: '大前鋒', 'G-F': '後衛／前鋒', 'F-C': '前鋒／中鋒', 'F-G': '前鋒／後衛', 'C-F': '中鋒／前鋒' },
    baseball: { P: '投手', SP: '先發投手', RP: '後援投手', C: '捕手', '1B': '一壘手', '2B': '二壘手', '3B': '三壘手', SS: '游擊手', LF: '左外野手', CF: '中外野手', RF: '右外野手', OF: '外野手', IF: '內野手', DH: '指定打擊', UT: '工具人', TWP: '二刀流' }
  };
  return BY[sport]?.[a] || abbr;
}
// A team's standing line: "1st in English Premier League" → 英超第 1 名.
export function standingZh(text, lang = 'zh') {
  const t = String(text || '').trim();
  if (lang === 'en' || !t) return t;
  const m = /^(\d+)(?:st|nd|rd|th) in (.+)$/i.exec(t);
  if (m) return `${groupZh(m[2], lang)}第 ${m[1]} 名`;
  const tie = /^T-(\d+)(?:st|nd|rd|th) in (.+)$/i.exec(t);
  if (tie) return `${groupZh(tie[2], lang)}並列第 ${tie[1]} 名`;
  return t;
}
// An injury list's status in Chinese ("15-Day-IL" → 15 天傷兵名單), or null.
export function injuryZh(status) {
  const s = String(status || '').trim();
  const il = /^(\d+)-Day[- ]IL$/i.exec(s);
  if (il) return `${il[1]} 天傷兵名單`;
  return (
    {
      'day-to-day': '每日觀察', out: '缺陣', questionable: '出賽存疑', doubtful: '可能缺陣', probable: '可望出賽', suspension: '禁賽', suspended: '禁賽', injured: '受傷', 'injured reserve': '傷兵名單', 'out for season': '球季報銷', 'game time decision': '賽前決定', active: '可出賽', paternity: '陪產假', bereavement: '喪假', 'restricted list': '限制名單'
    }[s.toLowerCase()] ?? null
  );
}
// A playoff series' line in Chinese: "NYY win series 2-0", "LV leads series 1-0",
// "Series tied 1-1". `name(abbr)` gives a side's name.
export function seriesLineZh(text, name = x => x) {
  const t = String(text || '').trim();
  let m = /^(\S+) (?:win|wins|won) series (\d+-\d+)$/i.exec(t);
  if (m) return `${name(m[1])} 以 ${m[2]} 贏得系列賽`;
  m = /^(\S+) (?:lead|leads) series (\d+-\d+)$/i.exec(t);
  if (m) return `${name(m[1])} 系列賽 ${m[2]} 領先`;
  m = /^series tied (\d+-\d+)$/i.exec(t);
  if (m) return `系列賽 ${m[1]} 平手`;
  m = /^series starts/i.exec(t);
  if (m) return '系列賽即將開打';
  return null;
}
// ESPN's weather ("65°", Fahrenheit, sometimes with words) in Celsius.
export function weatherZh(text, lang = 'zh') {
  const t = String(text || '').trim();
  if (!t || lang === 'en') return t;
  const f = /(-?\d+)\s*°\s*F?/.exec(t);
  const c = f ? `${Math.round(((Number(f[1]) - 32) * 5) / 9)}°C` : '';
  const words = t.replace(/(-?\d+)\s*°\s*F?/, '').replace(/[,·]/g, ' ').trim();
  const W = { sunny: '晴', clear: '晴朗', 'mostly sunny': '大致晴朗', 'partly sunny': '晴時多雲', 'partly cloudy': '多雲時晴', 'mostly cloudy': '多雲', cloudy: '陰', overcast: '陰', rain: '雨', showers: '陣雨', 'light rain': '小雨', thunderstorms: '雷雨', fog: '霧', windy: '有風', snow: '雪', dome: '室內', indoor: '室內' };
  return [W[words.toLowerCase()] ?? words, c].filter(Boolean).join(' ');
}
// A baseball pitch as ESPN writes it ("Ball 3", "Strike 2 Foul", "Strike 1
// Looking"): in Chinese without asking a translator (which reads "Strike" as a walkout).
export function pitchZh(text) {
  // "Pitch 3 : Ball 2": the pitch's number in front.
  const n = /^Pitch (\d+)\s*:\s*(.+)$/i.exec(String(text || '').trim());
  if (n) {
    const rest = pitchZh(n[2]);
    return rest ? `第 ${n[1]} 球：${rest}` : null;
  }
  const t = String(text || '').trim();
  let m = /^Ball (\d)$/i.exec(t);
  if (m) return `壞球（${m[1]} 壞）`;
  m = /^Strike (\d)\s*(Foul|Looking|Swinging)?$/i.exec(t);
  if (m) return `${{ foul: '界外', looking: '好球（未揮棒）', swinging: '揮空' }[String(m[2] || '').toLowerCase()] || '好球'}（${m[1]} 好）`;
  if (/^Foul Ball$/i.test(t) || /^Foul$/i.test(t)) return '界外球';
  if (/^In play/i.test(t)) return '擊出';
  if (/^Pitchout$/i.test(t)) return '故意偏投';
  if (/^Hit By Pitch$/i.test(t)) return '觸身球';
  if (/^Intentional Ball$/i.test(t)) return '故意壞球';
  // "Grant Holmes pitches to J.T. Realmuto": who's up, in the players' own names.
  m = /^(.+?) pitches to (.+?)\.?$/i.exec(t);
  if (m) return `${m[1]} 對 ${m[2]}，準備投球`;
  return null;
}
// Height and weight in metres and kilos ("6' 2\"" → 188 公分, "195 lbs" → 88 公斤).
export function metric(text, lang = 'zh') {
  const t = String(text || '');
  if (lang === 'en' || !t) return t;
  const ft = /(\d+)'\s*(\d+)?/.exec(t);
  if (ft) return `${Math.round((Number(ft[1]) * 12 + Number(ft[2] || 0)) * 2.54)} 公分`;
  const lb = /([\d.]+)\s*lbs?/i.exec(t);
  if (lb) return `${Math.round(Number(lb[1]) * 0.4536)} 公斤`;
  return t.replace(/\bcm\b/, '公分').replace(/\bkg\b/, '公斤');
}

// A match's team stats worth showing, by ESPN's key, in Chinese; `low` where
// fewer is better. Baseball's are picked and ordered (ESPN sends ~150, most of
// them sabermetrics nobody reads in a box score); the others keep ESPN's order.
const LOW = true;
const TEAM_PICK = {
  baseball: [
    ['batting.runs', '得分'], ['batting.hits', '安打'], ['batting.homeRuns', '全壘打'], ['batting.RBIs', '打點'], ['batting.doubles', '二壘安打'],
    ['batting.walks', '保送'], ['batting.strikeouts', '被三振', LOW], ['batting.stolenBases', '盜壘'], ['batting.runnersLeftOnBase', '殘壘', LOW],
    ['batting.avg', '打擊率'], ['batting.onBasePct', '上壘率'], ['batting.slugAvg', '長打率'], ['batting.OPS', 'OPS'],
    ['pitching.innings', '投球局數'], ['pitching.pitches', '用球數', LOW], ['pitching.strikeouts', '奪三振'], ['pitching.walks', '投出保送', LOW],
    ['pitching.hits', '被安打', LOW], ['pitching.homeRuns', '被全壘打', LOW], ['pitching.earnedRuns', '自責分', LOW], ['pitching.ERA', '防禦率', LOW], ['pitching.WHIP', 'WHIP', LOW],
    ['fielding.errors', '失誤', LOW], ['fielding.doublePlays', '雙殺']
  ],
  // As a broadcast's stats screen and the leagues' apps run them: the game's shape first (possession, shots), then passing, defending, discipline; 0-0 kept (no red cards is a number too).
  soccer: [
    ['possessionPct', '控球率', false, '攻勢'], ['totalShots', '射門', false, '攻勢'], ['shotsOnTarget', '射正', false, '攻勢'], ['shotPct', '射正率', false, '攻勢'], ['wonCorners', '角球', false, '攻勢'], ['offsides', '越位', LOW, '攻勢'], ['penaltyKickGoals', '點球進球', false, '攻勢'],
    ['totalPasses', '傳球', false, '傳球'], ['accuratePasses', '成功傳球', false, '傳球'], ['passPct', '傳球成功率', false, '傳球'], ['totalCrosses', '傳中', false, '傳球'], ['crossPct', '傳中成功率', false, '傳球'], ['totalLongBalls', '長傳', false, '傳球'], ['longballPct', '長傳成功率', false, '傳球'],
    ['totalTackles', '搶斷', false, '防守'], ['tacklePct', '搶斷成功率', false, '防守'], ['interceptions', '攔截', false, '防守'], ['totalClearance', '解圍', false, '防守'], ['blockedShots', '封阻射門', false, '防守'], ['saves', '撲救', false, '防守'],
    ['foulsCommitted', '犯規', LOW, '紀律'], ['yellowCards', '黃牌', LOW, '紀律'], ['redCards', '紅牌', LOW, '紀律']
  ],
  basketball: [
    ['fieldGoalsMade-fieldGoalsAttempted', '投籃', false, '投籃'], ['fieldGoalPct', '投籃命中率', false, '投籃'], ['threePointFieldGoalsMade-threePointFieldGoalsAttempted', '三分球', false, '投籃'], ['threePointFieldGoalPct', '三分命中率', false, '投籃'], ['freeThrowsMade-freeThrowsAttempted', '罰球', false, '投籃'], ['freeThrowPct', '罰球命中率', false, '投籃'],
    ['totalRebounds', '籃板', false, '籃板與傳導'], ['offensiveRebounds', '進攻籃板', false, '籃板與傳導'], ['defensiveRebounds', '防守籃板', false, '籃板與傳導'], ['assists', '助攻', false, '籃板與傳導'], ['steals', '抄截', false, '籃板與傳導'], ['blocks', '阻攻', false, '籃板與傳導'],
    ['pointsInPaint', '禁區得分', false, '得分來源'], ['fastBreakPoints', '快攻得分', false, '得分來源'], ['turnoverPoints', '失誤得分', false, '得分來源'], ['largestLead', '最大領先', false, '得分來源'],
    ['totalTurnovers', '失誤', LOW, '失誤與犯規'], ['fouls', '犯規', LOW, '失誤與犯規'], ['technicalFouls', '技術犯規', LOW, '失誤與犯規'], ['flagrantFouls', '惡意犯規', LOW, '失誤與犯規']
  ]
};
const GROUP_EN = { 攻勢: 'Attack', 傳球: 'Passing', 防守: 'Defending', 紀律: 'Discipline', 投籃: 'Shooting', 籃板與傳導: 'Rebounds & playmaking', 得分來源: 'Scoring', 失誤與犯規: 'Turnovers & fouls' };
const TEAM_KEY = {
  // Soccer
  possessionPct: ['控球率'], totalShots: ['射門'], shotsOnTarget: ['射正'], shotPct: ['射正率'], wonCorners: ['角球'], foulsCommitted: ['犯規', LOW],
  offsides: ['越位', LOW], yellowCards: ['黃牌', LOW], redCards: ['紅牌', LOW], saves: ['撲救'], penaltyKickGoals: ['點球進球'], penaltyKickShots: ['點球'],
  totalPasses: ['傳球'], accuratePasses: ['成功傳球'], passPct: ['傳球成功率'], totalCrosses: ['傳中'], accurateCrosses: ['成功傳中'], crossPct: ['傳中成功率'],
  totalLongBalls: ['長傳'], accurateLongBalls: ['成功長傳'], longballPct: ['長傳成功率'], blockedShots: ['封阻射門'], totalTackles: ['搶斷'],
  effectiveTackles: ['成功搶斷'], tacklePct: ['搶斷成功率'], interceptions: ['攔截'], totalClearance: ['解圍'], effectiveClearance: ['有效解圍'],
  // Basketball
  'fieldGoalsMade-fieldGoalsAttempted': ['投籃'], fieldGoalPct: ['投籃命中率'], 'threePointFieldGoalsMade-threePointFieldGoalsAttempted': ['三分球'],
  threePointFieldGoalPct: ['三分命中率'], 'freeThrowsMade-freeThrowsAttempted': ['罰球'], freeThrowPct: ['罰球命中率'], totalRebounds: ['籃板'],
  offensiveRebounds: ['進攻籃板'], defensiveRebounds: ['防守籃板'], assists: ['助攻'], steals: ['抄截'], blocks: ['阻攻'], turnovers: ['失誤', LOW],
  totalTurnovers: ['總失誤', LOW], technicalFouls: ['技術犯規', LOW], flagrantFouls: ['惡意犯規', LOW], turnoverPoints: ['失誤被得分', LOW],
  fastBreakPoints: ['快攻得分'], pointsInPaint: ['禁區得分'], fouls: ['犯規', LOW], largestLead: ['最大領先'], leadChanges: ['領先易手'], leadPercentage: ['領先時間比例']
};
// A sport's own names where a key means something else elsewhere (hockey's
// hits are checks, not 安打; football's interceptions are thrown, not made).
const SPORT_KEY = {
  football: {
    firstDowns: ['首攻'], firstDownsPassing: ['傳球首攻'], firstDownsRushing: ['跑球首攻'], firstDownsPenalty: ['對手犯規首攻'],
    thirdDownEff: ['三檔轉換'], fourthDownEff: ['四檔轉換'], totalOffensivePlays: ['進攻次數'], totalYards: ['總推進碼數'], yardsPerPlay: ['每次推進碼數'],
    totalDrives: ['進攻回合'], netPassingYards: ['傳球碼數'], completionAttempts: ['傳球成功-嘗試'], yardsPerPass: ['每次傳球碼數'],
    interceptions: ['被抄截', LOW], sacksYardsLost: ['被擒殺-損失碼數', LOW], rushingYards: ['跑球碼數'], rushingAttempts: ['跑球次數'],
    yardsPerRushAttempt: ['每次跑球碼數'], redZoneAttempts: ['紅區得分-進入'], totalPenaltiesYards: ['犯規-罰碼', LOW], turnovers: ['失誤', LOW],
    fumblesLost: ['掉球被奪', LOW], defensiveTouchdowns: ['防守/特勤達陣'], possessionTime: ['控球時間']
  },
  hockey: {
    shotsTotal: ['射門'], blockedShots: ['阻擋射門'], hits: ['衝撞'], takeaways: ['抄截'], giveaways: ['失誤', LOW],
    powerPlayGoals: ['多打一進球'], powerPlayOpportunities: ['多打一機會'], powerPlayPct: ['多打一成功率'], shortHandedGoals: ['少打一進球'],
    shootoutGoals: ['射門大賽進球'], faceoffsWon: ['爭球勝'], faceoffPercent: ['爭球勝率'], penalties: ['犯規', LOW], penaltyMinutes: ['受罰分鐘', LOW]
  }
};
const GROUP_ZH = { batting: '打擊', pitching: '投球', fielding: '守備' };
const DULL = /^(games ?played|team games played|is qualified|games started)$/i;

// A percentage as people read it: soccer's 0.4 is 40%, basketball's 51 is 51%.
function pctText(key, a, h) {
  if (!/pct|percent/i.test(key)) return [a, h];
  const [x, y] = [a, h].map(v => parseFloat(v));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return [a, h];
  const k = x <= 1 && y <= 1 ? 100 : 1;
  return [x, y].map(v => `${Math.round(v * k)}%`);
}

// The rows of a match's 數據 tab: [{ group, label, away, home, low }]. In
// Chinese a stat without a Chinese name is left out rather than shown in English.
export function teamStatRows(stats, sport, lang = 'zh') {
  const zh = lang !== 'en';
  const byKey = new Map((stats || []).map(s => [s.key, s]));
  const pick = TEAM_PICK[sport];
  if (pick) {
    // (In English, ESPN's others after them, in its words.)
    const rest = zh ? [] : (stats || []).filter(s => !pick.some(([k]) => k === s.key) && !DULL.test(s.label)).map(s => ({ group: '', label: s.label, away: s.away, home: s.home, low: false }));
    return pick
      .filter(([k]) => byKey.has(k))
      .map(([k, name, low, group]) => {
        const s = byKey.get(k);
        const [away, home] = pctText(k, s.away, s.home);
        const g = group ? (zh ? group : GROUP_EN[group] || group) : zh ? GROUP_ZH[s.group] || s.group : String(s.group || '').replace(/^./, c => c.toUpperCase());
        return { group: g, label: zh ? name : s.label, away, home, low: Boolean(low) };
      })
      .concat(rest);
  }
  return (stats || [])
    .filter(s => !DULL.test(s.label) && !(Number(s.home) === 0 && Number(s.away) === 0 && !/:|-|\//.test(`${s.home}${s.away}`)))
    .map(s => {
      const [name, low] = SPORT_KEY[sport]?.[s.key] || TEAM_KEY[s.key] || [statName(s.label, 'zh') !== s.label ? statName(s.label, 'zh') : ''];
      const [away, home] = pctText(s.key, s.away, s.home);
      return { group: '', label: zh ? name : s.label, away, home, low: Boolean(low) };
    })
    .filter(r => r.label)
    .slice(0, 30);
}
