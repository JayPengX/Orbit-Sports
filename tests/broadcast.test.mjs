// Where a game is on: ELTA's own schedule, NBA.com's Taiwan schedule, team
// names and Apple TV's Friday Night Baseball.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseElta, broadcastsFor, eltaPrograms, zhSame, eltaDays, NBA_ELTA_FROM, eltaAudio, eltaChannel, eltaAppUrl, eltaWatchUrl, AUDIO_NAMES } from '../public/lib/broadcast.mjs';
import { teamNameZh } from '../public/lib/names.mjs';

const programs = parseElta(JSON.parse(readFileSync(new URL('./fixtures/elta-2026-09-30.json', import.meta.url), 'utf8')));
const nba = (id, start, away, home) => ({ id, league: 'nba', kind: 'match', start, status: { state: 'pre' }, away: { name: away }, home: { name: home } });
const sides = e => [e.home, e.away].flatMap(s => Object.values(teamNameZh('nba', s.name) || {}));

test("ELTA's schedule: live programs only, by league, the sides from the title", () => {
  assert.ok(programs.length > 100);
  assert.ok(programs.every(p => p.league && p.ch && p.start));
  const hou = programs.find(p => p.league === 'nba' && p.teams.includes('火箭'));
  assert.deepEqual(hou.teams, ['火箭', '獨行俠']);
  assert.equal(hou.ch, 101);
  assert.ok(!/LIVE|10\/9/.test(hou.title));
  assert.deepEqual(eltaDays(programs), { from: '2026-09-27', to: '2026-10-15' });
});

test('an NBA game ELTA carries shows its channel; the others on that day no ELTA', () => {
  const hou = nba('1', '2026-10-09T12:00Z', 'Houston Rockets', 'Dallas Mavericks');
  const mem = nba('2', '2026-10-10T00:00Z', 'Memphis Grizzlies', 'Chicago Bulls');
  const on = broadcastsFor(hou, programs, sides(hou), [hou, mem]);
  assert.equal(on[0].zh, 'ELTA.tv 體育1台');
  assert.equal(on[0].url, 'https://eltaott.tv/channel/play/101/1');
  const off = broadcastsFor(mem, programs, sides(mem), [hou, mem]);
  assert.ok(!off.some(b => b.svc === 'elta'), JSON.stringify(off));
  // Before 10/6 ELTA has no NBA at all.
  const early = nba('3', '2026-10-02T23:30Z', 'Boston Celtics', 'New York Knicks');
  assert.ok(!broadcastsFor(early, programs, sides(early), []).some(b => b.svc === 'elta'));
  assert.equal(NBA_ELTA_FROM, '2026-10-06');
});

test('a program without the sides: the only game near it gets it; among several it is one of them, to be named', () => {
  const lal = nba('4', '2026-10-07T02:00Z', 'Los Angeles Lakers', 'Golden State Warriors');
  const den = nba('5', '2026-10-07T01:00Z', 'Denver Nuggets', 'Utah Jazz');
  assert.equal(eltaPrograms(programs, lal, sides(lal), [lal, den]).length, 1);
  const a = nba('6', '2026-10-05T23:00Z', 'Memphis Grizzlies', 'Atlanta Hawks');
  const b = nba('7', '2026-10-05T23:00Z', 'Phoenix Suns', 'Detroit Pistons');
  const tba = broadcastsFor(a, programs, sides(a), [a, b]).find(x => x.svc === 'elta');
  assert.ok(tba?.note, 'marked as one of the games then');
});

test('beyond the schedule: the NBA list says selected games, not every game', () => {
  const late = nba('8', '2026-11-20T00:00Z', 'Boston Celtics', 'Miami Heat');
  const list = broadcastsFor(late, programs, sides(late), []);
  assert.ok(list.some(x => x.svc === 'elta' && x.note?.zh === '部分賽事'));
});

test('Chinese names match however ELTA shortens them', () => {
  assert.ok(zhSame('海盜', '匹茲堡海盜'));
  assert.ok(zhSame('里茲聯', '利茲聯'));
  assert.ok(!zhSame('老虎', '洋基'));
  assert.deepEqual(teamNameZh('mlb', 'Pittsburgh Pirates'), { full: '匹茲堡海盜', short: '海盜' });
  assert.equal(teamNameZh('epl', 'Manchester City', 'soccer').short, '曼城');
  assert.equal(teamNameZh('cpbl', 'Uni Lions').short, '統一獅');
  assert.equal(teamNameZh('nfl', 'Nobody FC'), null);
});

test('ESPN words in Chinese: pitches, series, injuries, groups, positions, leaders, weather', async () => {
  const m = await import('../public/lib/statnames.mjs');
  assert.equal(m.pitchZh('Strike 2 Foul'), '界外（2 好）');
  assert.equal(m.pitchZh('Pitch 3 : Ball 2'), '第 3 球：壞球（2 壞）');
  assert.equal(m.seriesLineZh('NYY win series 2-0', a => ({ NYY: '洋基' })[a]), '洋基 以 2-0 贏得系列賽');
  assert.equal(m.injuryZh('15-Day-IL'), '15 天傷兵名單');
  assert.equal(m.groupZh('American League'), '美國聯盟');
  assert.equal(m.groupZh('AL East'), '美聯東區');
  assert.equal(m.standingZh('1st in English Premier League'), '英超第 1 名');
  assert.equal(m.posZh('G', 'soccer'), '門將');
  assert.equal(m.posZh('G', 'basketball'), '後衛');
  assert.equal(m.leaderValue('Matches: 5, Goals: 5'), '出賽 5、進球 5');
  assert.equal(m.weatherZh('65°'), '18°C');
  assert.equal(m.fixedWord('Final'), '決賽');
  assert.equal(m.dateText('', '30/9/1997'), '1997年9月30日');
});

test('Apple TV+ only on a regular-season MLB Friday (US time)', () => {
  const mlb = (start, stage) => ({ id: '1', league: 'mlb', kind: 'match', start, status: { state: 'pre' }, stage, away: { name: 'A' }, home: { name: 'B' } });
  const apple = e => broadcastsFor(e, []).some(b => b.svc === 'appletv');
  assert.ok(apple(mlb('2026-09-25T23:10:00Z')));
  assert.ok(!apple(mlb('2026-09-24T23:10:00Z')));
  assert.ok(!apple(mlb('2026-10-01T00:00:00Z', { key: 'post' })));
  assert.ok(!apple(mlb('2026-10-02T23:10:00Z', { key: 'post' })));
});

test("ELTA's commentary and ads from its titles; delayed and Kids showings left out", () => {
  assert.equal(AUDIO_NAMES.zh.zh, '中文・雙語');
  assert.deepEqual(eltaAudio('道奇 VS 巨人 例行賽 9/28(原音) LIVE', 540), { audio: 'en', adFree: true });
  assert.deepEqual(eltaAudio('巴林站 正賽(英文解說原音無廣告) LIVE', 544), { audio: 'en', adFree: true });
  assert.deepEqual(eltaAudio('巴林站 排位賽(中文解說無廣告) LIVE', 545), { audio: 'zh', adFree: true });
  assert.deepEqual(eltaAudio('味全 VS 富邦 例行賽 9/28(雙語/無廣告) LIVE', 544), { audio: 'dual', adFree: true });
  assert.deepEqual(eltaAudio('統一 VS 味全 例行賽 10/1(無廣告/副聲道現場原音) LIVE', 545), { audio: 'venue', adFree: true });
  // A 體育台 unmarked: Chinese, with ads; one marked 原音 is the original feed.
  assert.deepEqual(eltaAudio('巴林站 正賽 LIVE', 105), { audio: 'zh', adFree: false });
  assert.deepEqual(eltaAudio('海盜 VS 老虎 例行賽 9/27(原音) LIVE', 110), { audio: 'en', adFree: false });
  const oct = parseElta(JSON.parse(readFileSync(new URL('./fixtures/elta-2026-10-01.json', import.meta.url), 'utf8')));
  assert.ok(!oct.some(p => /^Kids|D-$/.test(p.title)), 'no Kids, no D-LIVE');
  assert.ok(oct.some(p => p.ch === 544 && p.audio === 'en'));
});

test("a race's channels: the person's commentary first, a MAX channel without ads before the 體育台", () => {
  const oct = parseElta(JSON.parse(readFileSync(new URL('./fixtures/elta-2026-10-01.json', import.meta.url), 'utf8')));
  const f1 = (k, start) => ({ id: `600060990~${k}`, league: 'f1', kind: 'field', sessionKey: k, start, status: { state: 'pre' } });
  const chs = (e, pref) => broadcastsFor(e, oct, [], [], pref).filter(b => b.ch).map(b => b.ch);
  // Bahrain (at Sepang): the race on MAX5 原音, MAX6 中文 without ads, 體育2台.
  assert.deepEqual(chs(f1('Race', '2026-10-04T07:00Z'), 'en'), [544, 545, 105]);
  assert.deepEqual(chs(f1('Race', '2026-10-04T07:00Z'), 'zh'), [545, 105, 544]);
  // Qualifying: no sprint qualifying mixed in; Singapore's sprint qualifying only on MAX5.
  assert.deepEqual(chs(f1('Qual', '2026-10-03T08:00Z'), 'en'), [544, 545, 110]);
  assert.deepEqual(chs(f1('SQ', '2026-10-09T12:30Z'), 'en'), [544]);
  const top = broadcastsFor(f1('Race', '2026-10-04T07:00Z'), oct, [], [], 'en')[0];
  assert.equal(top.audio, 'en');
  assert.equal(top.adFree, true);
  assert.equal(top.app, 'eltatv://live/544');
  assert.equal(top.short.zh, 'MAX5台');
});

test("ELTA's channels: MOD's 980s aren't on ELTA.tv; the app opens a channel the way ELTA's site does", () => {
  assert.equal(eltaChannel(983).zh, 'MOD 983台');
  assert.equal(eltaWatchUrl(983), null);
  assert.equal(eltaAppUrl(983), null);
  assert.equal(eltaAppUrl(101), 'eltatv://live/101');
  assert.equal(eltaWatchUrl(544), 'https://eltaott.tv/channel/play/544/108');
  assert.equal(eltaChannel(105).short.zh, '愛爾達2台');
});
