// ESPN's stat names in Chinese (team stats and leaders), by their English
// label, lower-cased. Anything not here stays as ESPN wrote it.
const ZH = {
  // Soccer
  fouls: '犯規', 'yellow cards': '黃牌', 'red cards': '紅牌', offsides: '越位', 'corner kicks': '角球', saves: '撲救', possession: '控球率',
  shots: '射門', 'shots on goal': '射正', 'on goal': '射正', 'on target': '射正', 'shot %': '射正率', 'shots on target': '射正', 'blocked shots': '被封阻射門',
  passes: '傳球', 'accurate passes': '成功傳球', 'pass completion %': '傳球成功率', 'pass %': '傳球成功率', crosses: '傳中', 'accurate crosses': '成功傳中',
  'long balls': '長傳', 'accurate long balls': '成功長傳', tackles: '搶斷', 'effective tackles': '成功搶斷', 'tackle %': '搶斷成功率', interceptions: '攔截',
  'total shots': '射門總數', 'total passes': '傳球總數', 'passes completed': '成功傳球', 'big chances': '絕佳機會', 'key passes': '關鍵傳球', dribbles: '盤帶', 'duels won': '對抗成功', 'receiving yards': '接球碼數', 'total tackles': '總擒抱',
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
// A table's group in Chinese: "American League" → 美國聯盟, "AL East" → 美聯東區,
// "Driver Standings" → 車手積分榜; a season's league name without its years' English.
export function groupZh(name, lang = 'zh') {
  const n = String(name || '').trim();
  if (lang === 'en' || !n) return n;
  const FIXED = {
    'american league': '美國聯盟', 'national league': '國家聯盟', 'eastern conference': '東區', 'western conference': '西區', 'american football conference': '美式足球聯會（AFC）', 'national football conference': '國家美式足球聯會（NFC）',
    'driver standings': '車手積分榜', 'constructor standings': '車隊積分榜', 'drivers standings': '車手積分榜', 'constructors standings': '車隊積分榜', 'overall': '總排名', 'league phase': '聯賽階段',
    'atlantic division': '大西洋組', 'central division': '中央組', 'southeast division': '東南組', 'northwest division': '西北組', 'pacific division': '太平洋組', 'southwest division': '西南組', 'metropolitan division': '都會組'
  };
  if (FIXED[n.toLowerCase()]) return FIXED[n.toLowerCase()];
  const div = /^(AL|NL|AFC|NFC) (East|West|Central|North|South)$/i.exec(n);
  if (div) return `${{ al: '美聯', nl: '國聯', afc: 'AFC ', nfc: 'NFC ' }[div[1].toLowerCase()]}${{ east: '東區', west: '西區', central: '中區', north: '北區', south: '南區' }[div[2].toLowerCase()]}`;
  const grp = /^Group ([A-Z])$/i.exec(n);
  if (grp) return `${grp[1].toUpperCase()} 組`;
  return statsTitle(n.replace(/^\d{4}(-\d{2})?\s+/, ''), lang);
}
// A leader's line ("Matches: 5, Goals: 5", "25 PTS, 8 REB") in Chinese words.
export function leaderValue(text, lang = 'zh') {
  const t = String(text || '');
  if (lang === 'en' || !/[A-Za-z]/.test(t)) return t;
  const W = { matches: '出賽', goals: '進球', assists: '助攻', 'total shots': '射門', shots: '射門', saves: '撲救', 'clean sheets': '零封', appearances: '出賽', pts: '分', reb: '籃板', ast: '助攻', stl: '抄截', blk: '阻攻', yds: '碼', td: '達陣', tds: '達陣', int: '抄截', car: '次推進', rec: '次接球', comp: '成功', att: '嘗試', hr: '全壘打', rbi: '打點', avg: '打擊率', era: '防禦率', k: '三振', w: '勝', l: '敗', sv: '救援', g: '進球', a: '助攻', p: '分', '+/-': '正負值' };
  return t
    .replace(/([A-Za-z][A-Za-z +/-]*?)\s*:\s*/g, (m, w) => `${W[w.trim().toLowerCase()] ?? w.trim()} `)
    .replace(/(\d)\s+([A-Za-z+/-]+)\b/g, (m, d, w) => (W[w.toLowerCase()] ? `${d} ${W[w.toLowerCase()]}` : m))
    .replace(/,\s*/g, '、');
}
// A roster's position abbreviation in Chinese, by sport (G is a goalkeeper in
// soccer and hockey, a guard in basketball).
export function posZh(abbr, sport, lang = 'zh') {
  const a = String(abbr || '').toUpperCase();
  if (lang === 'en' || !a) return abbr || '';
  const BY = {
    soccer: { G: '門將', GK: '門將', D: '後衛', M: '中場', F: '前鋒' },
    hockey: { G: '守門員', D: '防守', C: '中鋒', LW: '左翼', RW: '右翼', F: '前鋒' },
    basketball: { G: '後衛', F: '前鋒', C: '中鋒', PG: '控衛', SG: '得分後衛', SF: '小前鋒', PF: '大前鋒', 'G-F': '後衛／前鋒', 'F-C': '前鋒／中鋒', 'F-G': '前鋒／後衛', 'C-F': '中鋒／前鋒' },
    baseball: { P: '投手', SP: '先發投手', RP: '後援投手', C: '捕手', '1B': '一壘手', '2B': '二壘手', '3B': '三壘手', SS: '游擊手', LF: '左外野手', CF: '中外野手', RF: '右外野手', OF: '外野手', IF: '內野手', DH: '指定打擊', UT: '工具人', TWP: '二刀流' },
    football: { QB: '四分衛', RB: '跑衛', FB: '全衛', WR: '外接員', TE: '近端鋒', OT: '進攻截鋒', T: '截鋒', G: '護鋒', OG: '護鋒', C: '中鋒', OL: '進攻線', DE: '防守端鋒', DT: '防守截鋒', NT: '鼻截鋒', DL: '防守線', LB: '線衛', ILB: '內線衛', OLB: '外線衛', MLB: '中線衛', CB: '角衛', S: '安全衛', FS: '自由安全衛', SS: '強側安全衛', DB: '防守後衛', K: '踢球員', P: '棄踢員', LS: '長開球員' }
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
      'day-to-day': '每日觀察', out: '缺陣', questionable: '出賽存疑', doubtful: '可能缺陣', probable: '可望出賽', suspension: '禁賽', suspended: '禁賽', injured: '受傷', 'injured reserve': '傷兵名單', 'physically unable to perform': '無法出賽（PUP）', 'out for season': '球季報銷', 'game time decision': '賽前決定', active: '可出賽', paternity: '陪產假', bereavement: '喪假', 'restricted list': '限制名單'
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
