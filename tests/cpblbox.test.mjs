import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpblBoxUrl, cpblSummary, resultWords } from '../public/lib/cpblbox.mjs';

const box = {
  state: 'post',
  away: { zh: '台鋼雄鷹', score: 4, lines: ['0', '1', '3'], hits: 9, errors: 0 },
  home: { zh: '富邦悍將', score: 5, lines: ['0', '2', '3'], hits: 10, errors: 1 },
  batting: [
    { side: 'away', name: '王博玄', pos: '1B', starter: true, ab: 4, r: 1, h: 2, rbi: 1, d2: 1, d3: 0, hr: 0, bb: 0, hbp: 0, k: 1, sb: 1, cs: 0, sh: 0, sf: 0, gidp: 0, lob: 2 },
    { side: 'home', name: '范國宸', pos: '3B', starter: true, ab: 4, r: 2, h: 3, rbi: 3, d2: 0, d3: 0, hr: 2, bb: 1, hbp: 0, k: 0, sb: 0, cs: 0, sh: 0, sf: 0, gidp: 0, lob: 0 }
  ],
  pitching: [
    { side: 'home', name: '張奕', role: '中繼', decision: 'W', outs: 7, pc: 30, st: 20, h: 1, r: 0, er: 0, bb: 0, k: 3, hr: 0, hbp: 0, wp: 0, bk: 0, top: 151 },
    { side: 'away', name: '許峻暘', role: '中繼', decision: 'L', outs: 2, pc: 15, st: 9, h: 2, r: 2, er: 2, bb: 1, k: 0, hr: 1, hbp: 1, wp: 0, bk: 0, top: 148 }
  ],
  plays: [
    { inning: 2, half: 'bottom', batter: '范國宸', result: '全打', text: '擊出全壘打。 打者范國宸回本壘得分。', away: 1, home: 2, scoring: true },
    { inning: 3, half: 'top', batter: '王博玄', result: '三飛', text: '擊出內野飛球，三壘手接殺出局。', away: 1, home: 2, scoring: false }
  ]
};
const e = { id: 'cpbl-2026-290-2026-08-26', league: 'cpbl', status: { state: 'post' }, home: { id: 'Fubon Guardians', short: '富邦悍將' }, away: { id: 'TSG Hawks', short: '台鋼雄鷹' } };

test("CPBL's box score: the game from its id; the league's own box as the sheet's summary", () => {
  assert.equal(cpblBoxUrl(e), 'https://asia-baseball.quadra/cpbl/box/2026-290.json');
  assert.equal(cpblBoxUrl({ id: '401907992' }), null);
  const sm = cpblSummary(box, e);
  assert.deepEqual(sm.home.lines, ['0', '2', '3']);
  assert.equal(sm.home.score, '5');
  const homeBat = sm.players.find(p => p.team === 'Fubon Guardians').tables[0];
  assert.deepEqual(homeBat.labels, ['AB', 'R', 'H', 'RBI', 'HR', 'BB', 'K', 'SB']);
  assert.deepEqual(homeBat.rows[0].stats, ['4', '2', '3', '3', '2', '1', '0', '0']);
  const homeArm = sm.players.find(p => p.team === 'Fubon Guardians').tables[1];
  assert.deepEqual(homeArm.rows[0], { ...homeArm.rows[0], pos: '勝', stats: ['2.1', '1', '0', '0', '0', '3', '0', '30-20'] });
  const stat = k => sm.teamStats.find(s => s.key === k);
  assert.deepEqual([stat('batting.homeRuns').home, stat('batting.avg').home, stat('fielding.errors').home], ['2', '.750', '1']);
  const notes = sm.details.find(d => d.team === 'TSG Hawks').groups.flatMap(g => g.items.map(x => `${x.key}:${x.text}`));
  assert.ok(notes.includes('doubles:王博玄') && notes.includes('stolenBases:王博玄') && notes.includes('topSpeed:許峻暘 148 km/h'));
  assert.deepEqual(sm.feed.map(p => p.zh), ['范國宸 全壘打（范國宸 得分）', '王博玄 三壘飛球出局']);
  assert.equal(sm.feed[0].periodType, 'Bottom');
});

test("CPBL's at-bat results in words", () => {
  assert.equal(resultWords('一安'), '一壘安打');
  assert.equal(resultWords('右飛'), '右外野飛球出局');
  assert.equal(resultWords('游滾'), '游擊滾地球出局');
  assert.equal(resultWords('游失'), '游擊手失誤上壘');
  assert.equal(resultWords('死球'), '觸身球');
  assert.equal(resultWords('奇怪'), '', 'a code not known: the play\'s own words instead');
});
