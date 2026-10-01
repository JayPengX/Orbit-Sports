// Where a game is on: ELTA's own schedule matched game by game, NBA.com's
// Taiwan schedule for the NBA beyond it, Apple TV's MLS, the commentary, and
// the kit's Chinese team names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseElta, broadcastsFor, eltaPrograms, zhSame, eltaDays, eltaAudio, eltaChannel, eltaAppUrl, eltaWatchUrl, nbaEltaGames, broadcastsOf, hasAudio } from '../public/lib/broadcast.mjs';
import { teamNameZh } from '../public/lib/names.mjs';

const elta = day => parseElta(JSON.parse(readFileSync(new URL(`./fixtures/elta-${day}.json`, import.meta.url), 'utf8')));
const programs = elta('2026-09-30');
const nba = (id, start, away, home) => ({ id, league: 'nba', kind: 'match', start, status: { state: 'pre' }, away: { name: away }, home: { name: home } });
const sides = e => [e.home, e.away].flatMap(s => Object.values(teamNameZh('nba', s.name) || {}));
const on = (e, list, more = {}) => broadcastsFor(e, list, { sides: sides(e), ...more });

test("ELTA's schedule: live programs only, by league, the sides from the title", () => {
  assert.ok(programs.length > 100);
  assert.ok(programs.every(p => p.league && p.ch && p.start));
  const hou = programs.find(p => p.league === 'nba' && p.teams.includes('火箭'));
  assert.deepEqual(hou.teams, ['火箭', '獨行俠']);
  assert.equal(hou.ch, 101);
  assert.ok(!/LIVE|10\/9/.test(hou.title));
  assert.deepEqual(eltaDays(programs), { from: '2026-09-27', to: '2026-10-15' });
});

test("ELTA's league names as it writes them: UEL, UECL, and 蘇超 with no English name", () => {
  const oct = elta('2026-10-01');
  const leagues = new Set(oct.map(p => p.league));
  for (const k of ['uel', 'uecl', 'scotland', 'ucl', 'epl', 'mlb', 'cpbl', 'nba', 'f1']) assert.ok(leagues.has(k), k);
  // Only Fixtures' leagues: not the Asian Games, BWF, WTT…
  assert.ok([...leagues].every(k => broadcastsOf(k).length), [...leagues].join());
});

test('an NBA game ELTA carries shows its channel; the others on that day no ELTA', () => {
  const hou = nba('1', '2026-10-09T12:00Z', 'Houston Rockets', 'Dallas Mavericks');
  const mem = nba('2', '2026-10-10T00:00Z', 'Memphis Grizzlies', 'Chicago Bulls');
  const [ch] = on(hou, programs, { others: [hou, mem] });
  assert.equal(ch.zh, 'ELTA.tv 體育1台');
  assert.equal(ch.url, 'https://eltaott.tv/channel/play/101/1');
  assert.equal(ch.exact, true);
  assert.deepEqual(on(mem, programs, { others: [hou, mem] }), []);
  // In the list's days with no program of it: not on ELTA.
  assert.deepEqual(on(nba('3', '2026-10-02T23:30Z', 'Boston Celtics', 'New York Knicks'), programs), []);
});

test('a program without the sides: the only game near it gets it; among several it is one of them, to be named', () => {
  const lal = nba('4', '2026-10-07T02:00Z', 'Los Angeles Lakers', 'Golden State Warriors');
  const den = nba('5', '2026-10-07T01:00Z', 'Denver Nuggets', 'Utah Jazz');
  assert.equal(eltaPrograms(programs, lal, sides(lal), [lal, den]).length, 1);
  const a = nba('6', '2026-10-05T23:00Z', 'Memphis Grizzlies', 'Atlanta Hawks');
  const b = nba('7', '2026-10-05T23:00Z', 'Phoenix Suns', 'Detroit Pistons');
  const [tba] = on(a, programs, { others: [a, b] });
  assert.ok(tba?.note, 'marked as one of the games then');
});

// SYNTHETIC: the shape of NBA.com's scheduleLeagueV2_32.json (Taiwan), made
// up for this test (cdn.nba.com refuses this container): two ELTA games on
// one Taiwan day, one game on another broadcaster.
const ELTA_TV = { broadcasterId: 9001, broadcasterDisplay: 'ELTA', broadcasterAbbreviation: 'ELTA' };
const game = (gameId, gameDateTimeUTC, away, home, intl) => ({ gameId, gameDateTimeUTC, awayTeam: { teamId: away, teamTricode: 'AAA' }, homeTeam: { teamId: home, teamTricode: 'HHH' }, broadcasters: { nationalTvBroadcasters: [], intlTvBroadcasters: intl, intlOttBroadcasters: [] } });
const SYNTHETIC_NBA = {
  leagueSchedule: {
    seasonYear: '2026-27',
    gameDates: [
      {
        gameDate: '11/20/2026 00:00:00',
        games: [
          game('0022600201', '2026-11-20T00:00:00Z', 1610612738, 1610612748, [ELTA_TV]),
          game('0022600202', '2026-11-20T03:00:00Z', 1610612747, 1610612744, [ELTA_TV]),
          game('0022600203', '2026-11-20T01:00:00Z', 1610612752, 1610612741, [{ broadcasterId: 1, broadcasterDisplay: 'Other TV' }])
        ]
      }
    ]
  }
};

test("NBA.com's Taiwan schedule: ELTA's games only, the same from the deploy's list or NBA.com's file", () => {
  const games = nbaEltaGames(SYNTHETIC_NBA);
  assert.deepEqual(games.map(g => g.id), ['0022600201', '0022600202']);
  assert.deepEqual(games[0], { id: '0022600201', start: Date.parse('2026-11-20T00:00:00Z'), home: 1610612748, away: 1610612738 });
  // The Worker's answer ({ games }) reads the same.
  assert.deepEqual(nbaEltaGames({ games: games.map(g => ({ ...g, start: new Date(g.start).toISOString() })) }), games);
  assert.deepEqual(nbaEltaGames(null), []);
});

test("beyond ELTA's list: an NBA game on ELTA by NBA.com's schedule (two that day), never guessed", () => {
  const games = nbaEltaGames(SYNTHETIC_NBA);
  const ids = (away, home) => ({ games, ids: { away, home } });
  const bos = nba('8', '2026-11-20T00:10Z', 'Boston Celtics', 'Miami Heat');
  const lal = nba('9', '2026-11-20T03:00Z', 'Los Angeles Lakers', 'Golden State Warriors');
  const nyk = nba('10', '2026-11-20T01:00Z', 'New York Knicks', 'Chicago Bulls');
  const [first] = on(bos, programs, { nba: ids(1610612738, 1610612748) });
  assert.equal(first.svc, 'elta');
  assert.equal(first.exact, true);
  // No channel yet: ELTA's sports schedule, in its app.
  assert.equal(first.ch, undefined);
  assert.equal(first.app, 'eltatv://schedule/live');
  assert.equal(on(lal, programs, { nba: ids(1610612747, 1610612744) })[0]?.svc, 'elta');
  // Another broadcaster's game, the same teams the other way round, or no schedule yet: no ELTA.
  assert.deepEqual(on(nyk, programs, { nba: ids(1610612752, 1610612741) }), []);
  assert.deepEqual(on(bos, programs, { nba: ids(1610612748, 1610612738) }), []);
  assert.deepEqual(on(bos, programs, { nba: { games: null, ids: { away: 1610612738, home: 1610612748 } } }), []);
  assert.deepEqual(on(bos, programs), []);
});

test('Chinese names match however ELTA shortens them', () => {
  assert.ok(zhSame('海盜', '匹茲堡海盜'));
  assert.ok(zhSame('里茲聯', '利茲聯'));
  assert.ok(!zhSame('老虎', '洋基'));
  assert.deepEqual(teamNameZh('mlb', 'Pittsburgh Pirates'), { full: '匹茲堡海盜', short: '海盜' });
  assert.equal(teamNameZh('epl', 'Manchester City', 'soccer').short, '曼城');
  assert.equal(teamNameZh('cpbl', 'Uni Lions').short, '統一獅');
  assert.equal(teamNameZh('nba', 'Nobody FC'), null);
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

test('Apple TV: every MLS game, a link its app opens; MLB only on ELTA', () => {
  const game = league => ({ id: '1', league, kind: 'match', start: '2026-09-25T23:10:00Z', status: { state: 'pre' }, away: { name: 'A' }, home: { name: 'B' } });
  const [mls] = broadcastsFor(game('mls'), programs);
  assert.equal(mls.svc, 'appletv');
  assert.match(mls.url, /^https:\/\/tv\.apple\.com\/tw\/channel\/mls\//);
  assert.ok(!broadcastsOf('mlb').some(b => b.svc === 'appletv'));
});

test("ELTA's commentary and ads from its titles; delayed and Kids showings left out", () => {
  assert.deepEqual(eltaAudio('道奇 VS 巨人 例行賽 9/28(原音) LIVE', 540), { audio: 'en', adFree: true });
  assert.deepEqual(eltaAudio('巴林站 正賽(英文解說原音無廣告) LIVE', 544), { audio: 'en', adFree: true });
  assert.deepEqual(eltaAudio('巴林站 排位賽(中文解說無廣告) LIVE', 545), { audio: 'zh', adFree: true });
  assert.deepEqual(eltaAudio('味全 VS 富邦 例行賽 9/28(雙語/無廣告) LIVE', 544), { audio: 'dual', adFree: true });
  assert.deepEqual(eltaAudio('統一 VS 味全 例行賽 10/1(無廣告/副聲道現場原音) LIVE', 545), { audio: 'venue', adFree: true });
  // A 體育台 unmarked: Chinese, with ads; one marked 原音 is the original feed.
  assert.deepEqual(eltaAudio('巴林站 正賽 LIVE', 105), { audio: 'zh', adFree: false });
  assert.deepEqual(eltaAudio('海盜 VS 老虎 例行賽 9/27(原音) LIVE', 110), { audio: 'en', adFree: false });
  const oct = elta('2026-10-01');
  assert.ok(!oct.some(p => /^Kids|D-$/.test(p.title)), 'no Kids, no D-LIVE');
  assert.ok(oct.some(p => p.ch === 544 && p.audio === 'en'));
});

test('雙語 is Chinese with the original on the second track: it suits both, and wins on no ads', () => {
  assert.ok(hasAudio({ audio: 'dual' }, 'zh') && hasAudio({ audio: 'dual' }, 'en'));
  assert.ok(hasAudio({ audio: 'venue' }, 'zh') && !hasAudio({ audio: 'venue' }, 'en'));
  assert.ok(!hasAudio({ audio: 'zh' }, 'en') && !hasAudio({ audio: 'en' }, 'zh'));
  // CPBL 9/28, 味全 vs 富邦: 體育3台 (Chinese, ads) and MAX5 (雙語, no ads).
  const cpbl = { id: 'c1', league: 'cpbl', kind: 'match', start: '2026-09-28T09:05:00Z', status: { state: 'pre' }, away: { name: '味全龍' }, home: { name: '富邦悍將' } };
  const chs = prefer => broadcastsFor(cpbl, programs, { sides: ['味全', '富邦'], prefer }).map(b => b.ch);
  assert.deepEqual(chs('zh'), [544, 110]);
  assert.deepEqual(chs('en'), [544, 110]);
});

test("a race's channels: the person's commentary first, a MAX channel without ads before the 體育台", () => {
  const oct = elta('2026-10-01');
  const f1 = (k, start) => ({ id: `600060990~${k}`, league: 'f1', kind: 'field', sessionKey: k, start, status: { state: 'pre' } });
  const chs = (e, prefer) => broadcastsFor(e, oct, { prefer }).map(b => b.ch);
  // Bahrain (at Sepang): the race on MAX5 原音, MAX6 中文 without ads, 體育2台.
  assert.deepEqual(chs(f1('Race', '2026-10-04T07:00Z'), 'en'), [544, 545, 105]);
  assert.deepEqual(chs(f1('Race', '2026-10-04T07:00Z'), 'zh'), [545, 105, 544]);
  // Qualifying: no sprint qualifying mixed in; Singapore's sprint qualifying only on MAX5.
  assert.deepEqual(chs(f1('Qual', '2026-10-03T08:00Z'), 'en'), [544, 545, 110]);
  assert.deepEqual(chs(f1('SQ', '2026-10-09T12:30Z'), 'en'), [544]);
  const [top] = broadcastsFor(f1('Race', '2026-10-04T07:00Z'), oct, { prefer: 'en' });
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
