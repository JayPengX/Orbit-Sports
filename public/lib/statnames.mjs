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

export function statName(label, lang = 'zh') {
  if (lang === 'en' || !label) return label;
  const key = String(label).toLowerCase().trim();
  return ZH[key] || label;
}
