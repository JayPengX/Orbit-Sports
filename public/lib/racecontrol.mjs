// Race control's messages (賽事幹事) in Chinese: they're FIA's set phrases
// ("CAR 18 (STR) STOPPED AT TURN 15"), so each is told by rule, never by a
// translator that guesses at the jargon. Each car named becomes { no } (the
// app draws the driver, a tap opening them). A message with words the rules
// don't know stays in English, its cars still drawn as drivers.

// "CAR 18 (STR)", "CARS 1 (VER) AND 16 (LEC)": each car a token \u0001no\u0001.
const carTokens = text =>
  text
    .replace(/\bCARS?\s+(\d{1,2})\s*\(([A-Z]{3})\)/g, (_, no) => `\u0001${no}\u0001`)
    .replace(/(^|[\s,])(\d{1,2})\s*\(([A-Z]{3})\)/g, (_, pre, no) => `${pre}\u0001${no}\u0001`)
    .replace(/\bCARS?\s+(\d{1,2})\b/g, (_, no) => `\u0001${no}\u0001`);

// In order: the longer phrase first.
const RULES = [
  [/FIA STEWARDS:\s*/g, '幹事決定：'],
  [/(\d+) SECOND TIME PENALTY FOR /g, '$1 秒罰時：'],
  [/DRIVE THROUGH PENALTY FOR /g, '通過維修區罰則：'],
  [/(\d+) SECOND STOP\/GO PENALTY FOR /g, '$1 秒停站罰則：'],
  [/(\d+) PLACE GRID PENALTY FOR /g, '下站發車退後 $1 位：'],
  [/PIT LANE START FOR /g, '維修區起步：'],
  [/REPRIMAND FOR /g, '警告處分：'],
  [/BLACK AND WHITE FLAG FOR /g, '黑白旗警告：'],
  [/BLACK AND ORANGE FLAG FOR /g, '黑橘旗（車損須進站）：'],
  [/BLUE FLAG FOR /g, '藍旗：'],
  [/INCIDENT INVOLVING /g, '事故：'],
  [/ TIME (\d+:\d{2}\.\d{3}) DELETED/g, ' 圈速 $1 取消'],
  [/ LAP (\d+) DELETED/g, ' 第 $1 圈成績取消'],
  [/TRACK LIMITS AT TURN (\d+)/g, '第 $1 彎超出賽道界線'],
  [/TRACK LIMITS/g, '超出賽道界線'],
  [/STOPPED AT TURN (\d+)/g, '在第 $1 彎停車'],
  [/STOPPED ON TRACK/g, '停在賽道上'],
  [/STOPPED/g, '停車'],
  [/CAUSING A COLLISION/g, '造成碰撞'],
  [/FORCING ANOTHER DRIVER OFF THE TRACK/g, '將對手擠出賽道'],
  [/LEAVING THE TRACK AND GAINING AN ADVANTAGE/g, '離開賽道並取得優勢'],
  [/UNSAFE RELEASE/g, '不安全放行'],
  [/SPEEDING IN THE PIT LANE/g, '維修區超速'],
  [/MOVING UNDER BRAKING/g, '煞車時變線'],
  [/IMPEDING/g, '阻擋'],
  [/FALSE START/g, '偷跑'],
  [/OVERTAKING UNDER (SAFETY CAR|SC)/g, '安全車期間超車'],
  [/OVERTAKING UNDER (VSC|VIRTUAL SAFETY CAR)/g, '虛擬安全車期間超車'],
  [/OVERTAKING UNDER YELLOW FLAGS?/g, '黃旗下超車'],
  [/WILL BE INVESTIGATED AFTER THE (RACE|SESSION)/g, '賽後調查'],
  [/UNDER INVESTIGATION/g, '調查中'],
  [/REVIEWED,? NO FURTHER INVESTIGATION/g, '已檢視，不再調查'],
  [/NO FURTHER INVESTIGATION/g, '不再調查'],
  [/NO FURTHER ACTION/g, '不處分'],
  [/NOTED/g, '已記錄'],
  [/INVESTIGATION:?/g, '調查：'],
  [/VIRTUAL SAFETY CAR DEPLOYED/g, '虛擬安全車出動'],
  [/VIRTUAL SAFETY CAR ENDING/g, '虛擬安全車即將結束'],
  [/SAFETY CAR DEPLOYED/g, '安全車出動'],
  [/SAFETY CAR IN THIS LAP/g, '安全車本圈進站'],
  [/SAFETY CAR THROUGH THE PIT LANE/g, '安全車經由維修區'],
  [/LAPPED CARS (WILL BE|MAY) ALLOWED TO OVERTAKE|LAPPED CARS MAY NOW OVERTAKE/g, '被套圈車可超越'],
  [/LAPPED CARS WILL NOT BE ALLOWED TO OVERTAKE/g, '被套圈車不可超越'],
  [/RED FLAG/g, '紅旗'],
  [/CHEQUERED FLAG/g, '方格旗'],
  [/DOUBLE YELLOW IN TRACK SECTOR (\d+)/g, '第 $1 區段雙黃旗'],
  [/YELLOW IN TRACK SECTOR (\d+)/g, '第 $1 區段黃旗'],
  [/CLEAR IN TRACK SECTOR (\d+)/g, '第 $1 區段解除'],
  [/TRACK CLEAR/g, '賽道淨空'],
  [/GREEN LIGHT - PIT EXIT OPEN/g, '綠燈：維修區出口開放'],
  [/PIT EXIT OPEN/g, '維修區出口開放'],
  [/PIT EXIT CLOSED/g, '維修區出口關閉'],
  [/PIT ENTRY CLOSED/g, '維修區入口關閉'],
  [/DRS ENABLED/g, 'DRS 開放'],
  [/DRS DISABLED/g, 'DRS 關閉'],
  [/RISK OF RAIN FOR F1 RACE IS (\d+)%/g, '正賽降雨機率 $1%'],
  [/WET TRACK/g, '賽道濕滑'],
  [/(SESSION|RACE) WILL RESUME AT (\d{1,2}:\d{2})/g, '$2 恢復比賽'],
  [/(SESSION|RACE) SUSPENDED/g, '比賽暫停'],
  [/ AT TURN (\d+)/g, '（第 $1 彎）'],
  [/ LAP (\d+)/g, '，第 $1 圈'],
  [/ AND /g, '與'],
  [/\s+-\s+/g, '：']
];

// [text | { no }]: the message in Chinese (or, with words left unknown, in
// English), each car a { no }.
export function raceControlParts(message, zh = true) {
  const raw = String(message || '').trim();
  let text = carTokens(raw);
  if (zh) {
    let out = text;
    for (const [re, to] of RULES) out = out.replace(re, to);
    // A clock at the end (track limits: "15:03:22") says nothing more.
    out = out.replace(/\s+\d{2}:\d{2}:\d{2}$/, '').replace(/\s*([：，（）])\s*/g, '$1').replace(/：$/, '');
    // Anything English left (besides DRS, a lap time): the rules didn't know it.
    if (!/[A-Z]{2,}/.test(out.replace(/DRS|\u0001\d+\u0001/g, ''))) text = out;
  }
  return text.split('\u0001').map((x, i) => (i % 2 ? { no: x } : x)).filter(x => x !== '');
}
