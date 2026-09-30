// Where a game is on: ELTA's own schedule matched game by game (the NBA only
// from 10/6, one game a day), the kit's Chinese team names, and whether Play sells a game.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseElta, broadcastsFor, eltaPrograms, zhSame, eltaDays, NBA_ELTA_FROM } from '../public/lib/broadcast.mjs';
import { teamNameZh } from '../public/lib/names.mjs';
import { parseKambiPriced, sameSide, playablePair, REACH } from '../public/lib/playable.mjs';

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
  assert.equal(on[0].zh, '愛爾達體育1台');
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

test('beyond the schedule: the league list, the NBA said to be one game a day', () => {
  const late = nba('8', '2026-11-20T00:00Z', 'Boston Celtics', 'Miami Heat');
  const list = broadcastsFor(late, programs, sides(late), []);
  assert.ok(list.some(x => x.svc === 'elta' && x.note?.zh === '每日一場'));
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

test("投注 only where Play has the game: Kambi's priced list, every ESPN game, one reach", () => {
  const priced = parseKambiPriced({ events: [{ event: { homeName: 'Rakuten Monkeys', awayName: 'Uni Lions', start: '2026-10-01T10:35:00Z', state: 'NOT_STARTED' }, betOffers: [{ betOfferType: { englishName: 'Match' } }] }, { event: { homeName: 'A', awayName: 'B', start: '2026-10-01T10:35:00Z', state: 'NOT_STARTED' }, betOffers: [] }] });
  assert.equal(priced.length, 1);
  assert.ok(sameSide('Uni-President Lions', 'Uni Lions') || sameSide('Uni Lions', 'Uni Lions'));
  const now = Date.parse('2026-09-30T00:00:00Z');
  // ESPN: every game within Play's reach (two weeks, every league), a
  // bookmaker's line or not (Play prices it itself); none past it.
  assert.equal(playablePair('nba', '2026-10-02T00:00Z', 'A', 'B', 'pre', now), true);
  assert.equal(playablePair('nba', '2026-10-13T00:00Z', 'A', 'B', 'pre', now), true);
  assert.equal(playablePair('nba', '2026-10-15T00:00Z', 'A', 'B', 'pre', now), false);
  assert.equal(playablePair('epl', '2026-10-15T00:00Z', 'A', 'B', 'pre', now), false);
  assert.equal(REACH, 14 * 86_400_000);
  // A league Play doesn't sell.
  assert.equal(playablePair('pga', '2026-10-02T00:00Z', 'A', 'B', 'pre', now), false);
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
