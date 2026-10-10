// A CPBL game's box score, the league's own (cpbl.com.tw's box page, read
// by the sports proxy: Shared-Proxy's asia-baseball.js, its `/cpbl/box/`),
// in the shape the match sheet reads ESPN's in (espn.mjs parseSummary): the
// line score, each side's batters and pitchers with their totals, the team
// numbers (數據), the game's notes (二壘安打, 盜壘, 最快球速…) and every
// at-bat for 過程. Its words are the league's own Chinese.

export const ASIA = 'https://asia-baseball.quadra';
// The game's year and number from its id (`cpbl-2026-290-2026-08-26`).
export function cpblBoxUrl(e) {
  // (A play-off game's number has its kind before it: cpbl-2026-E2-…)
  const m = /^cpbl-(\d{4})-([CE]?\d+)-/.exec(String(e?.id || ''));
  return m ? `${ASIA}/cpbl/box/${m[1]}-${m[2]}.json` : null;
}

// Each at-bat's result as the league abbreviates it (三飛, 一安): in words.
const FIELD = { 左: '左外野', 中: '中外野', 右: '右外野', 游: '游擊', 二: '二壘', 三: '三壘', 一: '一壘', 投: '投手', 捕: '捕手' };
// (Every code in a dozen games of 2026's, checked.)
const RESULT = {
  一安: '一壘安打', 二安: '二壘安打', 三安: '三壘安打', 全打: '全壘打', 內安: '內野安打', 場安: '場地安打', 三振: '三振', 不死三振: '不死三振',
  四壞: '四壞保送', 故四: '故意四壞', 死球: '觸身球', 觸身: '觸身球', 犧短: '犧牲觸擊', 犧觸: '犧牲觸擊', 犧飛: '高飛犧牲打', 雙殺: '雙殺打',
  界飛: '界外飛球出局', 野選: '野手選擇', 失誤: '對手失誤上壘', 妨礙: '妨礙打擊'
};
export function resultWords(code) {
  const c = String(code || '').trim();
  if (RESULT[c]) return RESULT[c];
  const m = /^([左中右游二三一投捕])(飛|滾|平|界)$/.exec(c);
  if (m) return `${FIELD[m[1]]}${{ 飛: '飛球', 滾: '滾地球', 平: '平飛球', 界: '界外飛球' }[m[2]]}出局`;
  // A fielder's error (游失): who missed it.
  const err = /^([游二三一投捕左中右])失$/.exec(c);
  if (err) return `${FIELDER[err[1]]}失誤上壘`;
  // A code not known here: none (the play's own words say it instead).
  return '';
}
const FIELDER = { 左: '左外野手', 中: '中外野手', 右: '右外野手', 游: '游擊手', 二: '二壘手', 三: '三壘手', 一: '一壘手', 投: '投手', 捕: '捕手' };

const ip = outs => `${Math.floor(outs / 3)}.${outs % 3}`;
const sum = (rows, k) => rows.reduce((n, r) => n + (Number(r[k]) || 0), 0);
const rate = (a, b) => (b > 0 ? (a / b).toFixed(3).replace(/^0/, '') : '.000');
const DECISION = { W: ['勝', 'W'], L: ['敗', 'L'], S: ['救援', 'S'], H: ['中繼', 'H'] };

export function cpblSummary(box, e, en = false) {
  if (!box?.batting || !box.away || !box.home) return null;
  const sides = ['away', 'home'];
  const ids = { away: String(e.away?.id ?? ''), home: String(e.home?.id ?? '') };
  const sideOf = k => ({ ...e[k], score: String(box[k].score), lines: box[k].lines, homeAway: k });
  const home = sideOf('home');
  const away = sideOf('away');
  const bat = k => box.batting.filter(r => r.side === k);
  const arm = k => box.pitching.filter(r => r.side === k);
  // A side's batting: the order as it went (a substitute under the one they replaced).
  const batting = k => {
    const rows = bat(k);
    const cols = [['ab', 'AB'], ['r', 'R'], ['h', 'H'], ['rbi', 'RBI'], ['hr', 'HR'], ['bb', 'BB'], ['k', 'K'], ['sb', 'SB']];
    return {
      name: 'batting',
      labels: cols.map(c => c[1]),
      rows: rows.map(r => ({ id: '', name: r.name, full: r.name, headshot: null, pos: r.pos, starter: r.starter, stats: cols.map(([c]) => String(r[c])) })),
      totals: cols.map(([c]) => String(sum(rows, c)))
    };
  };
  const pitching = k => {
    const rows = arm(k);
    const cols = ['IP', 'H', 'R', 'ER', 'BB', 'K', 'HR', 'PC-ST'];
    const line = r => [ip(r.outs), r.h, r.r, r.er, r.bb, r.k, r.hr, `${r.pc}-${r.st}`].map(String);
    return {
      name: 'pitching',
      labels: cols,
      rows: rows.map(r => ({ id: '', name: r.name, full: r.name, headshot: null, pos: DECISION[r.decision]?.[en ? 1 : 0] || '', starter: r.role === '先發', stats: line(r) })),
      totals: line({ outs: sum(rows, 'outs'), h: sum(rows, 'h'), r: sum(rows, 'r'), er: sum(rows, 'er'), bb: sum(rows, 'bb'), k: sum(rows, 'k'), hr: sum(rows, 'hr'), pc: sum(rows, 'pc'), st: sum(rows, 'st') })
    };
  };
  const players = sides.map(k => ({ team: ids[k], tables: [batting(k), pitching(k)].filter(t => t.rows.length) })).filter(p => p.tables.length);
  // The team numbers, by ESPN's keys (statnames.mjs picks and names them).
  const team = k => {
    const b = bat(k);
    const p = arm(k);
    const [ab, h, bb, hbp, sf] = ['ab', 'h', 'bb', 'hbp', 'sf'].map(c => sum(b, c));
    const tb = h + sum(b, 'd2') + 2 * sum(b, 'd3') + 3 * sum(b, 'hr');
    const obp = ab + bb + hbp + sf > 0 ? (h + bb + hbp) / (ab + bb + hbp + sf) : 0;
    const slg = ab > 0 ? tb / ab : 0;
    const outs = sum(p, 'outs');
    return {
      'batting.runs': box[k].score, 'batting.hits': h, 'batting.homeRuns': sum(b, 'hr'), 'batting.RBIs': sum(b, 'rbi'), 'batting.doubles': sum(b, 'd2'),
      'batting.walks': bb, 'batting.strikeouts': sum(b, 'k'), 'batting.stolenBases': sum(b, 'sb'), 'batting.runnersLeftOnBase': sum(b, 'lob'),
      'batting.avg': rate(h, ab), 'batting.onBasePct': obp.toFixed(3).replace(/^0/, ''), 'batting.slugAvg': slg.toFixed(3).replace(/^0/, ''), 'batting.OPS': (obp + slg).toFixed(3).replace(/^0/, ''),
      'pitching.innings': ip(outs), 'pitching.pitches': sum(p, 'pc'), 'pitching.strikeouts': sum(p, 'k'), 'pitching.walks': sum(p, 'bb'), 'pitching.hits': sum(p, 'h'),
      'pitching.homeRuns': sum(p, 'hr'), 'pitching.earnedRuns': sum(p, 'er'), 'fielding.errors': box[k].errors
    };
  };
  const [ta, th] = [team('away'), team('home')];
  const teamStats = Object.keys(th).map(key => ({ key, label: key, group: key.split('.')[0], home: String(th[key]), away: String(ta[key]) }));
  // The game's notes, each side's: who did it (and how many, when more than once).
  const who = (rows, c) =>
    rows
      .filter(r => r[c] > 0)
      .map(r => (r[c] > 1 ? `${r.name} ${r[c]}` : r.name))
      .join('、');
  const details = sides
    .map(k => {
      const b = bat(k);
      const p = arm(k);
      const items = (group, list) => ({ name: group, items: list.map(([key, text]) => ({ key, abbr: key, label: key, text })).filter(x => x.text) });
      const fastest = [...p].sort((x, y) => y.top - x.top).find(r => r.top > 0);
      return {
        team: ids[k],
        groups: [
          items('battingDetails', [['doubles', who(b, 'd2')], ['triples', who(b, 'd3')], ['homeruns', who(b, 'hr')], ['rbi', who(b, 'rbi')], ['sacHit', who(b, 'sh')], ['sacFly', who(b, 'sf')], ['gidp', who(b, 'gidp')], ['teamLOB', b.length ? String(sum(b, 'lob')) : '']]),
          items('baserunningDetails', [['stolenBases', who(b, 'sb')], ['caughtStealing', who(b, 'cs')]]),
          items('pitchingDetails', [['hitByPitch', who(p, 'hbp')], ['wildPitches', who(p, 'wp')], ['balks', who(p, 'bk')], ['topSpeed', fastest ? `${fastest.name} ${fastest.top} km/h` : '']])
        ].filter(g => g.items.length)
      };
    })
    .filter(t => t.groups.length);
  // Every at-bat (過程): the batter and what came of it, the runs that scored said after it.
  const feed = box.plays.map((p, i) => {
    const runs = p.scoring ? (p.text.match(/[^。\s]*回本壘得分/g) || []).map(x => x.replace('回本壘得分', '').replace(/^.*?(跑者|打者)/, '')).join('、') : '';
    return {
      id: `cpbl${i}`,
      kind: 'play-result',
      zh: `${p.batter} ${resultWords(p.result) || p.text.split(/[，。]/)[0].replace(/^擊出/, '')}${runs ? `（${runs} 得分）` : ''}`,
      text: p.text,
      period: String(p.inning),
      periodNum: p.inning,
      periodType: p.half === 'top' ? 'Top' : 'Bottom',
      clock: '',
      team: ids[p.half === 'top' ? 'away' : 'home'],
      home: p.home,
      away: p.away,
      scoring: p.scoring,
      who: p.batter
    };
  });
  const state = box.state === 'pre' ? e.status?.state || 'pre' : box.state;
  return {
    league: e.league,
    status: { ...e.status, state, ...(state === 'post' ? { completed: true } : {}) },
    sides: [away, home],
    home,
    away,
    byId: { [ids.home]: home, [ids.away]: away },
    teamStats,
    details,
    players,
    plays: feed.filter(p => p.scoring),
    feed,
    drives: [],
    keyEvents: [],
    rosters: [],
    leaders: [],
    injuries: [],
    winProb: [],
    timeline: [],
    events: [],
    predict: null,
    series: [],
    form: [],
    table: [],
    venue: '',
    city: '',
    attendance: null,
    officials: [],
    weather: ''
  };
}
