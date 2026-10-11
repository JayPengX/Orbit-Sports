// Race control's messages (賽事控制) in Chinese: they're FIA's set phrases
// ("FIA STEWARDS: TURN 1 INCIDENT INVOLVING CAR 55 (SAI) REVIEWED NO FURTHER
// INVESTIGATION - LEAVING THE TRACK AND GAINING AN ADVANTAGE"), so each is
// told by rule, never by a translator that guesses at the jargon. A message
// is read the way FIA writes it: who decided (the stewards), what (the
// head: an incident and its verdict, a penalty, a lap deleted, a notice),
// then why (each part after " - "), and said the Chinese way round: who,
// where, the verdict, the reason in brackets ("幹事：Sainz 第 1 彎事件已檢視，
// 不再調查（離開賽道並取得優勢）"). Each car named becomes { no } (the app
// draws the driver, a tap opening them). A head the rules don't know stays
// in English, its cars still drawn as drivers; a reason they don't know is
// left out (the verdict is what's read). Every message of 2025 and 2026's
// sessions is told in Chinese (tests/racecontrol.test.mjs reads them all).

const CAR = '\u0001';
// "CAR 18 (STR)", "CARS 1 (VER) AND 16 (LEC)", a support series' "CAR 3 (FM1)": each car a token.
const carTokens = text =>
  text
    .replace(/\bCARS?\s+(\d{1,3})\s*\(([A-Z0-9]{3})\)/g, (_, no) => `${CAR}${no}${CAR}`)
    .replace(/(^|[\s,])(\d{1,3})\s*\(([A-Z0-9]{3})\)/g, (_, pre, no) => `${pre}${CAR}${no}${CAR}`)
    .replace(/\bCARS?\s+(\d{1,3})\b/g, (_, no) => `${CAR}${no}${CAR}`)
    // (Once, a car by its code alone: "CAR LEC".)
    .replace(/\bCAR ([A-Z]{3})\b(?= (?:LAP |TIME))/g, '$1');
// A list of cars ("1, 4 AND 16" as tokens): one after the other, 、 between.
const CARS = `((?:${CAR}\\d+${CAR})(?:\\s*(?:,|AND)\\s*${CAR}\\d+${CAR})*|ALL CARS|[A-Z]{3})`;
const carList = s => (s === 'ALL CARS' ? '全體車手' : s.replace(/\s*(?:,|AND)\s*/g, '、'));
// "1, 4, 16" (cars by number alone, after a colon): each a car.
const numberList = s => s.replace(/\s*(?:,|AND)\s*/g, ' ').trim().split(/\s+/).map(n => `${CAR}${n}${CAR}`).join('、');

const SESSION = [
  [/^(THE )?F1 SPRINT( RACE)?$|^SPRINT( RACE)?$/, '衝刺賽'],
  [/^(THE )?F1 SPRINT QUALIFYING( SESSION)?$|^SPRINT QUALIFYING( SESSION)?$/, '衝刺排位賽'],
  [/^(THE )?F1 RACE$|^RACE$/, '正賽'],
  [/^(THE )?F1 QUALIFYING( SESSION)?$|^QUALIFYING( SESSION)?$/, '排位賽'],
  [/^(?:F1 )?FIRST PRACTICE( SESSION)?$|^(F1 )?FREE PRACTICE 1$|^P1$/, '一練'],
  [/^(?:F1 )?SECOND PRACTICE( SESSION)?$|^(F1 )?FREE PRACTICE 2$|^P2$/, '二練'],
  [/^(?:F1 )?THIRD PRACTICE( SESSION)?$|^(F1 )?FREE PRACTICE 3$|^P3$/, '三練'],
  [/^(F1 )?PRACTICE( SESSION)?$/, '練習賽'],
  [/^(THIS )?(AM|PM) SESSION$|^SESSION$|^THIS SESSION$|^START OF SESSION$/, '本節'],
  [/^(S?Q[123])$/, '$1'],
  [/^FORMATION LAP$/, '暖胎圈']
];
const session = s => {
  const t = s.trim();
  // A support series' (F2, F3): its name, then the session.
  const f = t.match(/^(?:THE )?(F[23]) (.+)$/);
  if (f) {
    const rest = session(f[2]);
    return rest == null ? null : `${f[1]} ${rest}`;
  }
  for (const [re, to] of SESSION) if (re.test(t)) return t.replace(re, to);
  return null;
};
const WHERE = [
  [/^LAP (\d+) TURN (\d+)$/, '第 $1 圈第 $2 彎'],
  [/^TURNS (\d+) TO (\d+)$/, '第 $1 至 $2 彎'],
  [/^TURN (\d+)$/, '第 $1 彎'],
  [/^PIT LANE$/, '維修區'],
  [/^PIT EXIT$/, '維修區出口'],
  [/^PIT ENTRY$/, '維修區入口'],
  [/^START\/FINISH STRAIGHT$/, '起終點直道'],
  [/^START$/, '起跑'],
  [/^LAP (\d+)$/, '第 $1 圈'],
  [/^(S?Q[123])$/, '$1 ']
];
const where = s => {
  const t = (s || '').trim();
  if (!t) return '';
  for (const [re, to] of WHERE) if (re.test(t)) return t.replace(re, to);
  return null;
};
const VERDICT = [
  [/^NOTED$/, '已記錄'],
  [/^UNDER INVESTIGATION$/, '調查中'],
  [/^UNDER REVIEW$/, '審視中'],
  [/^WILL BE INVESTIGATED AFTER THE (SESSION|RACE|SPRINT)$/, '賽後調查'],
  [/^REVIEWED,? NO FURTHER INVESTIGATION$/, '已檢視，不再調查'],
  [/^NO FURTHER INVESTIGATION$/, '不再調查'],
  [/^NO FURTHER ACTION$/, '不處分']
];
const verdict = s => {
  for (const [re, to] of VERDICT) if (re.test(s)) return to;
  return null;
};

// Why, each part after " - ".
const REASONS = [
  [/^TRACK LIMITS AT TURN (\d+) LAP (\d+)$/, '第 $2 圈第 $1 彎超出賽道界線'],
  [/^TRACK LIMITS AT TURN (\d+) \(NEXT LAP( PIT)?\)$/, '第 $1 彎超出賽道界線，取消下一圈'],
  [/^TRACK LIMITS AT TURN (\d+)$/, '第 $1 彎超出賽道界線'],
  [/^TRACK LIMITS AT PIT ENTRY LAP (\d+)$/, '第 $1 圈維修區入口超出賽道界線'],
  [/^TRACK LIMITS \((\d+)(ST|ND|RD|TH) OFFENCE\)$/, '超出賽道界線第 $1 次'],
  [/^TRACK LIMITS$/, '超出賽道界線'],
  [/^DOUBLE YELLOW AT TURN (\d+) LAP (\d+)$/, '第 $2 圈第 $1 彎雙黃旗'],
  [/^DOUBLE YELLOW AT TURN (\d+)$/, '第 $1 彎雙黃旗'],
  [/^FAILING TO FOLLOW RACE DIRECTORS? INSTRUCTIONS$|^NOT FOLLOWING (THE )?RACE DIRECTOR'?S INSTRUCTIONS$/, '未遵守賽事總監指示'],
  [/^MAXIMUM DELTA TIME$|^EXCEEDING THE MAXIMUM (DELTA )?TIME$/, '超過規定的最慢圈速'],
  [/^ESCAPE ROAD INSTRUCTIONS$/, '未依指示走緩衝道'],
  [/^PRACTICE STARTS?( INFRINGEMENT)?$/, '練習起步違規'],
  [/^NO PRACTICE STARTS$/, '禁止練習起步'],
  [/^CAUSING A COLLISION$/, '造成碰撞'],
  [/^YELLOW FLAG INFRINGEMENT$/, '黃旗違規'],
  [/^FAILING TO SLOW UNDER YELLOW FLAGS$/, '黃旗下未減速'],
  [/^RED FLAG INFRINGEMENT$/, '紅旗違規'],
  [/^SAFETY CAR( PROCEDURE)? INFRINGEMENT$/, '安全車規定違規'],
  [/^VSC INFRINGEMENT$/, '虛擬安全車違規'],
  [/^DRS INFRINGEMENT$/, 'DRS 違規'],
  [/^IMPEDING$/, '阻擋'],
  [/^LEAVING THE TRACK( MULTIPLE TIMES)? AND GAINING AN ADVANTAGE$/, '離開賽道並取得優勢'],
  [/^SPEEDING IN THE PIT LANE$/, '維修區超速'],
  [/^FORCING ANOTHER DRIVER OFF THE TRACK$/, '將對手擠出賽道'],
  [/^UNSAFE RELEASE$/, '不安全放行'],
  [/^UNSAFE CONDITION$/, '賽車處於不安全狀態'],
  [/^REJOINING UNSAFELY$|^UNSAFE REJOIN$/, '不安全回到賽道'],
  [/^FALSE START$/, '偷跑'],
  [/^MOVING BEFORE SIGNAL$/, '燈號前移動'],
  [/^STARTING PROCEDURE INFRINGEMENT$/, '起跑程序違規'],
  [/^OUT OF POSITION( AT SAFETY CAR LINE)?$/, '未在正確位置'],
  [/^DRIVING ERRATICALLY$|^ERRATIC DRIVING$/, '駕駛不穩定'],
  [/^DRIVING UNNECESSARILY SLOWLY( IN PIT EXIT ROAD)?$/, '不必要的慢速駕駛'],
  [/^MOVING UNDER BRAKING$/, '煞車時變線'],
  [/^MORE THAN ONE CHANGE OF DIRECTION$/, '多次變換路線'],
  [/^IGNORING BLUE FLAGS?$/, '無視藍旗'],
  [/^PIT LANE INFRINGEMENT$/, '維修區違規'],
  [/^FAILING TO SERVE TIME PENALTY CORRECTLY$/, '未正確執行罰時'],
  [/^CROSSING THE LINE AT PIT (ENTRY|EXIT)$|^CROSSING THE PIT (ENTRY|EXIT) LINE$/, '越過維修區線'],
  [/^LEAVING PIT EXIT ON RED LIGHT$/, '維修區出口紅燈時出站'],
  [/^KEEPING TO CORRECT SIDE OF THE BOLLARD$/, '未從標柱正確一側通過'],
  [/^ENTERING (THE )?FAST LANE( BEFORE RESUMPTION TIME ANNOUNCED)?$/, '過早進入維修區快車道'],
  [/^LEAVING GARAGE BEFORE RESUMPTION TIME ANNOUNCED$/, '過早離開車庫'],
  [/^POST-SPRINT PARC FERME$/, '衝刺賽後封閉車房'],
  [/^DRIVER WEIGHING$/, '車手過磅'],
  [/^CAR SAFETY LIGHTS$/, '車尾安全燈'],
  [/^TECHNICAL INFRINGEMENT$/, '技術違規'],
  [/^PIT EXIT OPEN$/, '維修區出口開放'],
  [/^RACE SUSPENDED$|^SESSION SUSPENDED$/, '比賽暫停'],
  [/^LOW GRIP$/, '低抓地力'],
  [/^NORMAL GRIP$/, '抓地力正常'],
  [/^DISABLED$/, '關閉'],
  [/^UNDER REVIEW$/, '審視中'],
  [/^UNDER INVESTIGATION$/, '調查中'],
  // Said elsewhere already (the part, the series, a lap's time): nothing more.
  [/^S?Q[123]$|^F\d$|^\d+:\d{2}\.\d{3}$|^RACE CONTROL TEST$/, ''],
  [/^ENABLED$/, '開放']
];
const reason = s => {
  for (const [re, to] of REASONS) if (re.test(s)) return s.replace(re, to);
  // A notice after the dash ("… - BLUE HEAD PADDING MATERIAL MUST BE USED").
  for (const [re, to] of NOTICES) if (re.test(s)) return s.replace(re, to);
  return null;
};

// A notice: the whole head.
const NOTICES = [
  [/^VIRTUAL SAFETY CAR DEPLOYED$|^VSC DEPLOYED$/, '虛擬安全車出動'],
  [/^VIRTUAL SAFETY CAR ENDING$|^VSC ENDING$/, '虛擬安全車即將結束'],
  [/^SAFETY CAR DEPLOYED$/, '安全車出動'],
  [/^SAFETY CAR IN THIS LAP$/, '安全車本圈回維修區'],
  [/^SAFETY CAR LIGHTS ON$/, '安全車亮燈'],
  [/^SAFETY CAR LIGHTS OFF$/, '安全車關燈，本圈回維修區'],
  [/^SAFETY CAR THROUGH THE PIT LANE$/, '安全車經由維修區'],
  [/^ALL CARS (TO FOLLOW THE SAFETY CAR )?THROUGH THE PIT LANE$/, '全體車手經由維修區'],
  [/^(ALL CARS USE|SAFETY CAR WILL USE) START\/FINISH STRAIGHT$/, '經由起終點直道'],
  [/^SAFETY CAR ENDING$/, '安全車即將結束'],
  [/^LAPPED CARS WILL NOT BE ALLOWED TO OVERTAKE$/, '被套圈車不可超越安全車'],
  [/^LAPPED CARS (WILL BE|MAY) ALLOWED TO OVERTAKE$/, '被套圈車可超越安全車'],
  [/^RACE WILL START BEHIND THE SAFETY CAR$|^FORMATION LAP WILL BE STARTED BEHIND THE SAFETY CAR$|^FORMATION LAP\(S\) BEHIND SAFETY CAR$/, '在安全車後方起跑'],
  [/^RECOVERY VEHICLE ON TRACK( (AT|BEFORE) TURN (\d+))?$/, (_, x, how, n) => (n ? `拖吊車上賽道（第 ${n} 彎${how === 'BEFORE' ? '前' : ''}）` : '拖吊車上賽道')],
  [/^RECOVERY VEHICLE IN PIT ENTRY$/, '拖吊車在維修區入口'],
  [/^MARSHALS ON TRACK AT TURN (\d+)$/, '工作人員在賽道上（第 $1 彎）'],
  [/^MARSHALS ON TRACK AT PIT (EXIT|ENTRY)$/, (_, x) => `工作人員在維修區${x === 'EXIT' ? '出口' : '入口'}`],
  [/^MEDICAL CAR (DEPLOYED|ON TRACK)$/, '醫療車上賽道'],
  [/^DEBRIS ON TRACK$/, '賽道上有碎片'],
  [/^TRACK SURFACE SLIPPERY IN TRACK SECTOR (\d+)$/, '第 $1 區段路面濕滑'],
  [/^SLIPPERY SURFACE$/, '路面濕滑'],
  [/^DOUBLE YELLOW IN TRACK SECTOR (\d+)$/, '第 $1 區段雙黃旗'],
  [/^YELLOW IN TRACK SECTOR (\d+)$/, '第 $1 區段黃旗'],
  [/^CLEAR IN TRACK SECTOR (\d+)$/, '第 $1 區段解除'],
  [/^YELLOW IN PIT LANE$/, '維修區黃旗'],
  [/^TRACK CLEAR$/, '賽道淨空'],
  [/^PIT LANE CLEAR$/, '維修區淨空'],
  [/^GREEN LIGHT$/, '綠燈'],
  [/^PIT EXIT OPEN$/, '維修區出口開放'],
  [/^PIT EXIT CLOSED$/, '維修區出口關閉'],
  [/^PIT (LANE )?ENTRY OPEN$/, '維修區入口開放'],
  [/^PIT (LANE )?ENTRY CLOSED$/, '維修區入口關閉'],
  [/^DRS ENABLED( IN ZONE (\d+))?$/, (_, x, n) => (n ? `第 ${n} 區 DRS 開放` : 'DRS 開放')],
  [/^DRS DISABLED( IN ZONE (\d+))?$/, (_, x, n) => (n ? `第 ${n} 區 DRS 關閉` : 'DRS 關閉')],
  [/^OVERTAKE ENABLED$/, '超車模式開放'],
  [/^OVERTAKE DISABLED$/, '超車模式關閉'],
  [/^STRAIGHT MODE$/, '直道模式'],
  [/^LOW GRIP (CONDITIONS|DELTA ACTIVE)$/, '低抓地力狀況'],
  [/^NORMAL GRIP (CONDITIONS|DELTA ACTIVE)$/, '抓地力恢復正常'],
  [/^WET TRACK$/, '賽道濕滑'],
  [/^CHANGE IN CLIMATIC CONDITIONS$/, '天候變化'],
  [/^RED FLAG$/, '紅旗'],
  [/^CHEQUERED FLAG$/, '方格旗'],
  [/^FIRST CAR TO TAKE THE FLAG$/, '首位衝線'],
  [/^FORMATION LAP$/, '暖胎圈'],
  [/^EXTRA FORMATION LAP$/, '加跑一圈暖胎圈'],
  [/^ROLLING START( PROCEDURE)?$/, '滾動起跑'],
  [/^STANDING START$/, '定點起跑'],
  [/^ABORTED START$/, '起跑中止'],
  [/^(START DELAYED|DELAYED START)$/, '延後起跑'],
  [/^STARTING PROCEDURE SUSPENDED$/, '起跑程序暫停'],
  [/^(RACE|SPRINT) START$/, '起跑'],
  [/^START ORDER: ORIGINAL GRID$/, '依原排位起跑'],
  [/^(SESSION|RACE) SUSPENDED$/, '比賽暫停'],
  [/^SESSION WILL BE TEMPORARILY STOPPED$/, '本節暫時中止'],
  [/^SESSION WILL NOT BE RESUMED$/, '本節不再恢復'],
  [/^PENALTY SERVED$/, '已執行罰則'],
  [/^LAP TIME UNDER INVESTIGATION$/, '圈速調查中'],
  [/^NO PRACTICE STARTS$/, '禁止練習起步'],
  [/^AWNINGS MAY BE USED$/, '可使用遮陽棚'],
  [/^AWNINGS TO BE REMOVED$/, '遮陽棚須移除'],
  [/^(LIGHT BLUE|BLUE|PINK|RED|YELLOW|GREEN) HEAD PADDING MATERIAL MUST BE USED$/, (_, c) => `須使用${{ 'LIGHT BLUE': '淺藍', BLUE: '藍', PINK: '粉紅', RED: '紅', YELLOW: '黃', GREEN: '綠' }[c]}色頭部護墊`],
  [/^ALL PASS HOLDERS MAY ACCESS THE PIT LANE$/, '持證人員可進入維修區'],
  [/^WEATHER RADAR SYSTEM NOT AVAILABLE$/, '氣象雷達暫停服務'],
  [/^WEATHER RADAR SYSTEM NOW OPERATIONAL$/, '氣象雷達恢復服務'],
  [/^TRACK TEST COMPLETED$/, '賽道測試完成'],
  [/^RESUMPTION TEST ABORTED$/, '恢復測試中止'],
  [/^(RACE CONTROL TEST|THIS IS A TEST MESSAGE FROM RACE CONTROL)$/, '賽事控制測試訊息'],
  [/^WORK MAY COMMENCE AT (\d{1,2}:\d{2})$/, '衝刺賽後封閉車房：當地 $1 起可開始作業'],
  [/^CORRECTION$/, '更正']
];

// Each head, with the reasons after it: the Chinese, or null.
function head(h, parts) {
  let m;
  // An incident: who, where, the verdict.
  if ((m = h.match(new RegExp(`^(?:(.+?) )?INCIDENT(?: INVOLVING ${CARS})? (NOTED|UNDER INVESTIGATION|UNDER REVIEW|WILL BE INVESTIGATED AFTER THE (?:SESSION|RACE|SPRINT)|REVIEWED,? NO FURTHER INVESTIGATION|NO FURTHER INVESTIGATION|NO FURTHER ACTION)$`)))) {
    const at = where(m[1]);
    const v = verdict(m[3]);
    if (at == null || !v) return null;
    return `${m[2] ? `${carList(m[2])} ` : ''}${at}事件${v}`;
  }
  // A penalty, a reprimand, a flag shown to a car.
  if ((m = h.match(new RegExp(`^(\\d+) SECOND TIME PENALTY FOR ${CARS}$`)))) return `${carList(m[2])} 罰時 ${m[1]} 秒`;
  if ((m = h.match(new RegExp(`^(?:(\\d+) SECOND )?(?:STOP\\/GO|STOP-AND-GO) PENALTY FOR ${CARS}$`)))) return `${carList(m[2])} ${m[1] ? `${m[1]} 秒` : ''}停站罰則`;
  if ((m = h.match(new RegExp(`^DRIVE THROUGH PENALTY FOR ${CARS}$`)))) return `${carList(m[1])} 通過維修區罰則`;
  if ((m = h.match(new RegExp(`^(\\d+) PLACE GRID PENALTY FOR ${CARS}$`)))) return `${carList(m[2])} 下一場發車退後 ${m[1]} 位`;
  if ((m = h.match(new RegExp(`^PIT LANE START FOR ${CARS}$`)))) return `${carList(m[1])} 維修區起步`;
  if ((m = h.match(new RegExp(`^REPRIMAND(?: \\((?:DRIVING|SPORTING)\\))? FOR ${CARS}$`)))) return `${carList(m[1])} 申誡處分`;
  if ((m = h.match(new RegExp(`^WARNING FOR ${CARS}$`)))) return `${carList(m[1])} 警告`;
  if ((m = h.match(new RegExp(`^BLACK AND WHITE FLAG FOR ${CARS}$`)))) return `${carList(m[1])} 黑白旗警告`;
  if ((m = h.match(new RegExp(`^BLACK AND ORANGE FLAG FOR ${CARS}$`)))) return `${carList(m[1])} 黑橘旗（車損須進站）`;
  if ((m = h.match(new RegExp(`^(?:WAVED )?BLUE FLAGS? FOR ${CARS}(?: TIMED AT)?$`)))) return `${carList(m[1])} 藍旗（須讓車）`;
  // A lap deleted, or given back.
  if ((m = h.match(new RegExp(`^${CARS} (?:LAP )?TIME(?: (\\d+:\\d{2}\\.\\d{3}))? DELETED$`)))) return `${carList(m[1])} 圈速${m[2] ? ` ${m[2]}` : ''} 取消`;
  if ((m = h.match(new RegExp(`^${CARS} LAP(?: (\\d+))? DELETED$`)))) return `${carList(m[1])} ${m[2] ? `第 ${m[2]} 圈` : '該圈'}成績取消`;
  if ((m = h.match(new RegExp(`^${CARS} (?:TIME (\\d+:\\d{2}\\.\\d{3})|LAP (\\d+)) WILL BE REINSTATED$`)))) return `${carList(m[1])} ${m[2] ? `圈速 ${m[2]}` : `第 ${m[3]} 圈`}恢復`;
  if ((m = h.match(new RegExp(`^LAP TIME OF ${CARS}$`)))) return `${carList(m[1])} 的圈速`;
  if ((m = h.match(new RegExp(`^${CARS} (?:STOPPED|STOPPED ON TRACK)(?: AT TURN (\\d+))?$`)))) return `${carList(m[1])} ${m[2] ? `在第 ${m[2]} 彎` : ''}停車`;
  if ((m = h.match(new RegExp(`^${CARS} PENALTY SERVED$`)))) return `${carList(m[1])} 已執行罰則`;
  // The cars that may unlap themselves, the order to restart in.
  if ((m = h.match(/^LAPPED CARS? MAY NOW OVERTAKE THE SAFETY CAR:\s*(.+)$/))) return `被套圈車可超越安全車：${numberList(m[1])}`;
  if (/^LAPPED CARS MAY NOW OVERTAKE$/.test(h)) return '被套圈車可超越安全車';
  if ((m = h.match(/^(?:RESUMPTION ORDER|ORDER FOR RESTART|PUSH CARS TO FRONT IN ORDER):\s*(.+)$/))) return `重新起跑順序：${m[1].replace(/\s*(?:,|AND)\s*/g, '、')}`;
  // The weather before, the clock: when a session starts, resumes or ends.
  if ((m = h.match(/^RISK OF RAIN FOR (.+?) IS (\d+) ?%$/))) {
    const s = session(m[1]);
    return s == null ? null : `${s === '本節' ? '' : s}降雨機率 ${m[2]}%`;
  }
  if ((m = h.match(/^(?:TEST: )?AIR TEMPERATURE (\d+) HOURS? BEFORE (.+?) = (\d+(?:\.\d+)?) DEGREES$/))) {
    const s = session(m[2]);
    return s == null ? null : `${s}前 ${m[1]} 小時氣溫 ${m[3]}°C`;
  }
  if ((m = h.match(/^SESSION TEMPERATURES: AIR = (\d+(?:\.\d+)?), TRACK = (\d+(?:\.\d+)?)$/))) return `氣溫 ${m[1]}°C，賽道 ${m[2]}°C`;
  if ((m = h.match(/^(.+?) WILL (START|RESUME|END) AT ?(\d{1,2}:\d{2})\d?$/))) {
    const s = session(m[1]);
    return s == null ? null : `${s} 當地 ${m[3]} ${{ START: '開始', RESUME: '恢復', END: '結束' }[m[2]]}`;
  }
  if ((m = h.match(/^ESTIMATED TIME OF (.+?) (START|RESUMPTION)$/))) {
    const s = session(m[1]);
    const at = parts.find(p => /^\d{1,2}:\d{2}$/.test(p));
    return s == null ? null : `${s}預計${at ? `當地 ${at} ` : ''}${m[2] === 'START' ? '開始' : '恢復'}`;
  }
  if ((m = h.match(/^START OF (.+?) WILL BE DELAYED$/))) {
    const s = session(m[1]);
    return s == null ? null : `${s}延後開始`;
  }
  if ((m = h.match(/^(?:FREE PRACTICE (\d)|SESSION) WILL BE EXTENDED BY (?:A FURTHER )?(\d+) MINUTES$/))) return `${m[1] ? ['', '一練', '二練', '三練'][m[1]] : '本節'}延長 ${m[2]} 分鐘`;
  if ((m = h.match(/^(?:(SESSION|RACE) )?RESUMPTION$/))) return '恢復比賽';
  for (const [re, to] of NOTICES) if (re.test(h)) return h.replace(re, to);
  return null;
}

// The reasons, in brackets.
function why(parts, unknown) {
  const kept = parts.filter(p => !/^\d{1,2}:\d{2}$/.test(p) && !new RegExp(`^${CARS}$`).test(p));
  for (const p of kept) if (reason(p) == null) unknown?.push(p);
  const said = kept.map(reason).filter(Boolean);
  return said.length ? `（${said.join('，')}）` : '';
}

// [text | { no }]: the message in Chinese (or, with a head the rules don't
// know, in English), each car a { no }.
export function raceControlParts(message, zh = true) {
  const raw = String(message || '').trim();
  let text = carTokens(raw);
  if (zh) {
    const said = toChinese(text);
    if (said != null) text = said;
  }
  return text.split(CAR).map((x, i) => (i % 2 ? { no: x } : x)).filter(x => x !== '');
}

function toChinese(text, unknown) {
  let t = text
    // A clock ("15:03:22", "(22:10:13)", "(PIT)" after it) says nothing more.
    .replace(/\s*\(?\b\d{1,2}:\d{2}:\d{2}\b\)?(?::\d+)?(\s*\(PIT\))?/g, '')
    .replace(/\s*\(\d{1,2}:\d{2}::\d+\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  let who = '';
  let lead = '';
  for (;;) {
    const m = t.match(/^(FIA STEWARDS|UPDATE|CORRECTION):+\s*/);
    if (!m) break;
    if (m[1] === 'FIA STEWARDS') who = '幹事：';
    else lead = m[1] === 'UPDATE' ? '更新：' : '更正：';
    t = t.slice(m[0].length);
  }
  // The head, then why (" - ", " – ", a dash at a word's start: never START/FINISH or STOP-AND-GO).
  let [h, ...rest] = t.split(/\s+[-–]\s*|\s*[-–]\s+|\s[-–](?=[A-Z])/).map(x => x.trim()).filter(Boolean);
  // The part or the series first ("SQ1 - TURN 14 INCIDENT …", "F1 - POST-SPRINT PARC FERME - …"): the part said before, the series not at all.
  let part = '';
  while (rest.length && /^(S?Q[123]|F1)$/.test(h)) {
    if (h !== 'F1') part = `${h} `;
    h = rest.shift();
  }
  if (h === 'POST-SPRINT PARC FERME' && rest.length) h = rest.shift();
  if (!h) return null;
  // Practice's "(Q2)", "(SQ1)" after a reason: the part, said before it.
  const parts = rest.map(p => p.replace(/\s*\((S?Q[123])\)$/, ''));
  // A penalty served: the penalty, after the dash, is what was served.
  if (/^PENALTY SERVED$/.test(h)) {
    const k = parts.findIndex(p => /PENALTY FOR/.test(p) && head(p, []) != null);
    if (k >= 0) return `${lead}${who}${head(parts[k], [])}已執行${why(parts.filter((_, i) => i !== k), unknown)}`;
  }
  let said = head(h, parts);
  if (said == null) return unknown?.push(h), null;
  // The first car to take the flag, named after the dash.
  if (/^FIRST CAR TO TAKE THE FLAG$/.test(h)) {
    const car = parts.find(p => new RegExp(`^${CARS}$`).test(p));
    return `${lead}${said}${car ? `：${carList(car)}` : ''}`;
  }
  // A car named only after the dash ("LAP TIME UNDER INVESTIGATION - … - CAR 27 (HUL)"): first.
  const car = parts.find(p => new RegExp(`^${CARS}$`).test(p) && p.includes(CAR));
  if (car && !said.includes(CAR)) said = `${carList(car)} ${said}`;
  return `${lead}${who}${part}${said}${why(parts, unknown)}`;
}

// What the rules don't know in a message (its head, or a reason left out): for the tests.
export function raceControlUnknown(message) {
  const unknown = [];
  toChinese(carTokens(String(message || '').trim()), unknown);
  return unknown;
}
