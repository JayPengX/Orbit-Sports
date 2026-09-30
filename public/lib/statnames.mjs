// ESPN's stat names in Chinese (team stats and leaders), by their English
// label, lower-cased. Anything not here stays as ESPN wrote it.
const ZH = {
  // Soccer
  fouls: '犯規', 'yellow cards': '黃牌', 'red cards': '紅牌', offsides: '越位', 'corner kicks': '角球', saves: '撲救', possession: '控球率',
  shots: '射門', 'shots on goal': '射正', 'on goal': '射正', 'on target': '射正', 'shot %': '射正率', 'shots on target': '射正', 'blocked shots': '被封阻射門',
  passes: '傳球', 'accurate passes': '成功傳球', 'pass completion %': '傳球成功率', 'pass %': '傳球成功率', crosses: '傳中', 'accurate crosses': '成功傳中',
  'long balls': '長傳', 'accurate long balls': '成功長傳', tackles: '搶斷', 'effective tackles': '成功搶斷', 'tackle %': '搶斷成功率', interceptions: '攔截',
  clearances: '解圍', 'effective clearances': '有效解圍', 'penalty goals': '點球進球', 'penalty kicks taken': '罰點球', goals: '進球', assists: '助攻',
  // Basketball
  'field goals': '投籃', 'field goal %': '投籃命中率', 'fg%': '投籃命中率', '3pt': '三分球', 'three point %': '三分命中率', '3p%': '三分命中率',
  'free throws': '罰球', 'free throw %': '罰球命中率', 'ft%': '罰球命中率', rebounds: '籃板', 'offensive rebounds': '進攻籃板', 'defensive rebounds': '防守籃板',
  steals: '抄截', blocks: '阻攻', turnovers: '失誤', 'total turnovers': '總失誤', 'technical fouls': '技術犯規', 'flagrant fouls': '惡意犯規',
  'fast break points': '快攻得分', 'points in paint': '禁區得分', 'points off turnovers': '失誤轉換得分', 'largest lead': '最大領先', points: '得分',
  'lead changes': '領先易手', 'personal fouls': '個人犯規', 'team turnovers': '球隊失誤',
  // Baseball
  hits: '安打', runs: '得分', errors: '失誤', 'batting average': '打擊率', avg: '打擊率', 'home runs': '全壘打', rbis: '打點', rbi: '打點', walks: '保送',
  strikeouts: '三振', 'stolen bases': '盜壘', 'left on base': '殘壘', era: '防禦率', 'earned runs': '自責分', 'innings pitched': '投球局數', pitches: '投球數',
  doubles: '二壘安打', triples: '三壘安打', 'on base %': '上壘率', obp: '上壘率', slg: '長打率', ops: '整體攻擊指數', whip: '每局被上壘率', wins: '勝投', saves_: '救援',
  // Football
  'first downs': '首攻', 'total yards': '總碼數', 'passing yards': '傳球碼數', 'rushing yards': '跑球碼數', 'third down efficiency': '三檔成功', 'fourth down efficiency': '四檔成功',
  sacks: '擒殺', 'possession time': '控球時間', 'time of possession': '控球時間', penalties: '犯規', 'red zone': '紅區', 'total plays': '總進攻次數',
  'yards per play': '每次進攻碼數', 'passing touchdowns': '傳球達陣', 'rushing touchdowns': '跑球達陣', interceptions_: '抄截', fumbles: '掉球', 'fumbles lost': '掉球被搶',
  'completions/attempts': '傳球成功/嘗試', 'yards per pass': '每傳碼數', 'yards per rush': '每跑碼數', 'rushing attempts': '跑球次數', 'passing': '傳球', 'rushing': '跑球', 'receiving': '接球',
  // Hockey
  'power play goals': '以多打少進球', 'power play opportunities': '以多打少機會', 'power play %': '以多打少成功率', 'penalty minutes': '受罰分鐘', 'faceoffs won': '爭球勝',
  'faceoff win %': '爭球勝率', hits_: '衝撞', giveaways: '失誤傳球', takeaways: '抄截', 'shorthanded goals': '以少打多進球', 'blocked shots_': '封阻射門'
};

// A player's season line (ESPN's short labels): PPG, HR, G, SHOT…
const SHORT = {
  ppg: '場均得分', rpg: '場均籃板', apg: '場均助攻', spg: '場均抄截', bpg: '場均阻攻', 'fg%': '投籃命中率', '3p%': '三分命中率', 'ft%': '罰球命中率', min: '上場時間', mpg: '場均時間',
  g: '進球', a: '助攻', shot: '射門', sht: '射門', sog: '射正', 'strt-subin': '先發（替補）', app: '出賽', yc: '黃牌', rc: '紅牌', ga: '失球', cs: '零封',
  hr: '全壘打', r: '得分', h: '安打', sb: '盜壘', 'w-l': '勝-敗', k: '三振', so: '三振', ip: '投球局數', gp: '出賽',
  'pass yards': '傳球碼數', 'rush yards': '跑球碼數', 'rec yards': '接球碼數', touchdowns: '達陣', td: '達陣', int: '被抄截', qbr: 'QBR', rec: '接球', yds: '碼數', 'tackles': '擒抱', 'sacks': '擒殺',
  'plus/minus': '正負值', '+/-': '正負值', pts: '積分', gaa: '場均失分', 'sv%': '撲救率', w: '勝', l: '敗', d: '和', wins: '勝場', losses: '敗場',
  events: '出賽', cuts: '晉級', top10: '前十', earnings: '獎金', 'scoring average': '平均桿數', 'official money won': '獎金', 'fedexcup points': 'FedEx 積分', 'world ranking': '世界排名'
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
    .replace(/UEFA Champions League/, '歐冠')
    .replace(/PGA Tour/, 'PGA 巡迴賽');
}
// Fixed words machine translation gets wrong ("Final" → 最終的, "Right" → 正確的):
// a draw's rounds, a player's hand and stance, positions.
const WORDS = {
  final: '決賽', finals: '決賽', semifinal: '準決賽', semifinals: '準決賽', 'semi-final': '準決賽', 'semi-finals': '準決賽', quarterfinal: '八強', quarterfinals: '八強', 'quarter-final': '八強', 'quarter-finals': '八強',
  'round of 16': '16 強', 'round of 32': '32 強', 'round of 64': '64 強', 'round of 128': '128 強', 'round 1': '第一輪', 'round 2': '第二輪', 'round 3': '第三輪', 'round 4': '第四輪', '1st round': '第一輪', '2nd round': '第二輪', '3rd round': '第三輪', '4th round': '第四輪', 'first round': '第一輪', 'second round': '第二輪', 'third round': '第三輪', 'fourth round': '第四輪', qualifying: '資格賽', 'qualifying round': '資格賽',
  right: '右手', 'right-handed': '右手', 'right handed': '右手', left: '左手', 'left-handed': '左手', 'left handed': '左手', 'right-handed, two-handed backhand': '右手（雙手反拍）', 'right-handed, one-handed backhand': '右手（單手反拍）', 'left-handed, two-handed backhand': '左手（雙手反拍）', 'left-handed, one-handed backhand': '左手（單手反拍）',
  orthodox: '正架', southpaw: '反架', switch: '換架',
  forward: '前鋒', midfielder: '中場', defender: '後衛', goalkeeper: '守門員', guard: '後衛', 'point guard': '控球後衛', 'shooting guard': '得分後衛', 'small forward': '小前鋒', 'power forward': '大前鋒', center: '中鋒', 'guard-forward': '後衛／前鋒', 'forward-center': '前鋒／中鋒',
  pitcher: '投手', 'starting pitcher': '先發投手', 'relief pitcher': '後援投手', catcher: '捕手', 'first baseman': '一壘手', 'second baseman': '二壘手', 'third baseman': '三壘手', shortstop: '游擊手', 'left fielder': '左外野手', 'center fielder': '中外野手', 'right fielder': '右外野手', outfielder: '外野手', infielder: '內野手', 'designated hitter': '指定打擊',
  quarterback: '四分衛', 'running back': '跑衛', 'wide receiver': '外接員', 'tight end': '近端鋒', 'offensive tackle': '進攻截鋒', 'defensive end': '防守端鋒', linebacker: '線衛', cornerback: '角衛', safety: '安全衛', kicker: '踢球員', punter: '棄踢員',
  'left wing': '左翼', 'right wing': '右翼', defenseman: '防守球員', goalie: '守門員',
  heavyweight: '重量級', 'light heavyweight': '輕重量級', middleweight: '中量級', welterweight: '次中量級', lightweight: '輕量級', featherweight: '羽量級', bantamweight: '雛量級', flyweight: '蠅量級', strawweight: '草量級', "women's strawweight": '女子草量級', "women's flyweight": '女子蠅量級', "women's bantamweight": '女子雛量級', "women's featherweight": '女子羽量級'
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
