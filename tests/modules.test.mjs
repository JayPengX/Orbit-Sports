// The smaller pure rules each module keeps, with the edges the feeds bring
// (an empty field, a name with accents, a season across the new year, the
// night the clocks change).
import test from 'node:test';
import assert from 'node:assert/strict';
import { roundName, stageFrom, stageOf, stageTag, groupName } from '../public/lib/stage.mjs';
import { LEAGUES, leaguesOf, hasStandings, hasTeams, hasTeamPage, leagueName } from '../public/lib/leagues.mjs';
import { leagueKey, familyOf, teamKey, eventKeys } from '../public/lib/foryou.mjs';
import { metric, boxHead } from '../public/lib/statnames.mjs';
import { contrast, readableOn, gameTime } from '../public/lib/wpline.mjs';
import { bandName, basketEn, tighten } from '../public/lib/moments.mjs';
import { clash, strength, tableStarted, tableIndex, bigGame, dayPlan } from '../public/lib/picks.mjs';
import { STRINGS, makeT } from '../public/lib/i18n.mjs';
import { openRound, stageKey } from '../public/lib/playoffs.mjs';
import { undecided, buildBracket } from '../public/lib/bracket.mjs';
import { mlbDate } from '../public/lib/mlb.mjs';
import { pointsFor, POINTS as F1_POINTS } from '../public/lib/f1.mjs';
import { POINTS } from '../public/lib/title.mjs';
import { parseAsia, kambiInnings, applyKambiLive, cpblSeeds, mergeInjuries, withoutPlayed, rosterAverages, parseLeagueInjuries, usDate, leagueByName, parseGameLog, logSeason, normalizeTeamName } from '../public/lib/espn.mjs';

test('a round’s name in Chinese: the league’s half, the game, 如需; anything unknown as written', () => {
  assert.equal(roundName('ALCS - Game 3'), '美聯聯盟冠軍賽 G3');
  assert.equal(roundName('NLDS - Game 5 - If Necessary'), '國聯分區系列賽 G5（如需）');
  assert.equal(roundName('East 1st Round - Game 2'), '東區首輪 G2');
  assert.equal(roundName('World Series - Game 7'), '世界大賽 G7');
  assert.equal(roundName('Round of 16 - 1st Leg'), '16 強');
  assert.equal(roundName('Knockout Round Playoffs'), '淘汰附加賽');
  assert.equal(roundName('Something New'), 'Something New');
  assert.equal(roundName(''), '');
  assert.equal(roundName('ALCS - Game 3', 'en'), 'ALCS - Game 3');
});

test('a game’s stage, and the tag a row shows for it', () => {
  const ws = stageFrom({ seasonType: 3, note: 'World Series - Game 1' });
  assert.deepEqual([ws.key, ws.round.zh, ws.special], ['final', '世界大賽 G1', true]);
  assert.equal(stageFrom({ seasonType: 2 }).special, false);
  assert.equal(stageFrom({ seasonType: 1 }).key, 'pre');
  assert.equal(stageFrom({ note: 'NBA Cup - Group Play' }).key, 'cup');
  assert.equal(stageFrom({ typeAbbr: 'ALLSTAR' }).key, 'allstar');
  assert.equal(stageFrom({ note: 'Play-In Tournament' }).key, 'playin');
  assert.deepEqual(stageOf(null), { key: '', zh: '', en: '', round: null, special: false });
  assert.equal(stageTag({ stage: ws }), '世界大賽 G1');
  assert.equal(stageTag({ stage: stageFrom({ seasonType: 2 }), group: 'Group B3' }), 'B 級第 3 組');
  assert.equal(stageTag({ stage: stageFrom({ seasonType: 2 }) }), '');
  assert.equal(groupName('Group C', 'en'), 'Group C');
  assert.equal(groupName('Eastern Conference'), 'Eastern Conference');
});

test('the leagues: each sport’s, which have tables, teams and team pages', () => {
  for (const sport of ['soccer', 'baseball', 'basketball', 'racing']) assert.ok(leaguesOf(sport).every(k => LEAGUES[k].sport === sport) && leaguesOf(sport).length, sport);
  assert.equal(hasStandings('cpbl'), true, 'CPBL’s own table');
  assert.equal(hasStandings('epl'), true);
  assert.equal(hasStandings('facup'), false, 'a cup without a table');
  assert.equal(hasStandings('f1'), true, 'the drivers’ and constructors’ championships');
  assert.equal(hasTeams('cpbl'), false);
  assert.equal(hasTeamPage('cpbl'), true);
  assert.equal(hasTeamPage('f1'), false);
  assert.equal(hasStandings('nope'), false);
  assert.equal(leagueName('nope'), 'nope');
  assert.equal(leagueName('epl', 'en'), LEAGUES.epl.en);
});

test('affinity keys: the catalogue keys whatever the page shows (the English name)', () => {
  assert.equal(leagueKey('nope'), 'nope');
  assert.equal(typeof familyOf('nba'), 'string');
  assert.equal(teamKey('epl', 'Brighton & Hove Albion'), teamKey('epl', 'brighton and hove albion'));
  assert.equal(normalizeTeamName('Atlético Madrid FC'), 'atletico madrid');
  assert.equal(normalizeTeamName(''), '');
  const keys = eventKeys({ league: 'epl', home: { name: '曼城', en: 'Manchester City' }, away: { name: 'Arsenal' } });
  assert.ok(keys.includes(teamKey('epl', 'Manchester City')), 'by the English name, not 曼城');
  assert.ok(keys.includes(teamKey('epl', 'Arsenal')));
});

test('heights and weights in Taiwan’s units; a box score’s heads short and Chinese', () => {
  assert.equal(metric(`6' 3"`), '191 公分');
  assert.equal(metric('6\''), '183 公分');
  assert.equal(metric('220 lbs'), '100 公斤');
  assert.equal(metric('185 cm'), '185 公分');
  assert.equal(metric('80 kg'), '80 公斤');
  assert.equal(metric(''), '');
  assert.equal(metric(`6' 3"`, 'en'), `6' 3"`);
  assert.equal(boxHead('R', 'zh', { sport: 'baseball', pitching: true }), '失分');
  assert.equal(boxHead('HR', 'zh', { sport: 'baseball', pitching: true }), '被轟');
  assert.equal(boxHead('', 'zh'), '');
  assert.equal(boxHead('PTS', 'en'), 'PTS');
  assert.ok(boxHead('PTS', 'zh', { sport: 'basketball' }).length <= 3);
});

test('a line’s colours readable on the card; the game’s time without its breaks', () => {
  assert.ok(Math.abs(contrast([0, 0, 0], [255, 255, 255]) - 21) < 0.01);
  assert.equal(contrast([10, 20, 30], [10, 20, 30]), 1);
  const yellow = readableOn('#ffff00', '#ffffff');
  assert.ok(yellow && yellow !== '#ffff00');
  assert.equal(readableOn('nope'), null);
  assert.equal(readableOn('#000000', '#ffffff'), '#000000');
  // Half time (15 minutes) taken out, nothing after the whistle.
  const tl = [{ t: 0, n: 1 }, { t: 2700, n: 1 }, { t: 3600, n: 2 }, { t: 6300, n: 2, type: 'end-regular-time' }];
  const gt = gameTime(tl);
  assert.equal(gt(2700), 2700);
  assert.equal(gt(3600), 2700);
  assert.equal(gt(6300), 5400);
  assert.equal(gt(99_999), 5520, 'two minutes past the whistle at most');
  assert.equal(gameTime([])(100), 100);
});

test('moments’ small words', () => {
  assert.equal(bandName('nope', false), 'nope');
  assert.equal(basketEn({ who: 'Curry', text: 'Stephen Curry makes 26-foot three point jumper' }), 'Curry three');
  assert.equal(basketEn({ who: 'Jokic', text: 'Nikola Jokic makes free throw 2 of 2' }), 'Jokic free throw 2/2');
  assert.equal(basketEn({ who: 'X', text: '' }), 'X jumper');
  // No move: the stretch as given.
  assert.deepEqual(tighten([0.5, 0.5, 0.5], { from: 0, to: 2 }), { from: 0, to: 2 });
});

test('picks: an unset hour clashes with nothing; a table says nothing before its first game', () => {
  const e = (start, sport = 'nba', extra = {}) => ({ id: start, league: sport, kind: 'match', start, status: { state: 'pre' }, ...extra });
  assert.equal(clash(e('2026-10-12T00:00Z'), e('2026-10-12T00:30Z')), true);
  assert.equal(clash(e('2026-10-12T00:00Z'), e('2026-10-12T00:30Z', 'nba', { timeTbd: true })), false);
  assert.equal(clash(e('2026-10-12T00:00Z'), e('2026-10-12T02:30Z')), false);
  assert.equal(strength({ epl: { 1: { pos: 1, n: 1 } } }, 'epl', { id: '1' }), null, 'a table of one says nothing');
  assert.equal(strength({ epl: { 1: { pos: 1, n: 20 } } }, 'epl', { id: '1' }), 1);
  assert.equal(strength({ epl: { 1: { pos: 20, n: 20 } } }, 'epl', { id: '1' }), 0);
  assert.equal(strength({}, 'epl', null), null);
  assert.equal(tableStarted({ rows: [{ stats: { GP: '0', W: '0' } }] }), false);
  assert.equal(tableStarted({ rows: [{ stats: { GP: '1' } }] }), true);
  assert.equal(tableStarted({ rows: [{ stats: {} }] }), true, 'a table with no counts: its order is all there is');
  assert.deepEqual(tableIndex([{ name: 'X', rows: [{ id: 'a', stats: { GP: '0' } }] }]), {});
  assert.equal(bigGame({ stage: { key: 'post' }, note: 'ALCS - Game 7' }), true);
  assert.equal(bigGame({ note: 'Champions League Final' }), true);
  assert.equal(bigGame({ stage: { key: 'regular' }, note: '', name: 'Yankees at Red Sox' }), false);
  assert.equal(bigGame(null), false);
  // A day with nothing to pick: an empty plan, never a failure.
  assert.deepEqual(dayPlan([], { now: 0 }), { plan: [], also: [] });
  // Called off, and over: never picked (as it stood: still there, as they stood before).
  const off = e('2026-10-12T00:00Z', 'nba', { status: { state: 'pre', void: true } });
  const over = e('2026-10-12T03:00Z', 'nba', { id: 'o', status: { state: 'post' } });
  assert.equal(dayPlan([off, over], { now: 0 }).plan.length, 0);
  assert.equal(dayPlan([off, over], { now: 0 }, { asStood: true }).plan.length, 2);
});

test('the text: every key in both languages, every {placeholder} in both, every key used', async () => {
  const { readFileSync } = await import('node:fs');
  assert.deepEqual(Object.keys(STRINGS.en).sort(), Object.keys(STRINGS.zh).sort());
  const holes = s => (String(s).match(/\{\w+\}/g) || []).sort().join();
  for (const k of Object.keys(STRINGS.zh)) assert.equal(holes(STRINGS.en[k]), holes(STRINGS.zh[k]), k);
  const src = ['app.js', 'sheets.js', 'ui.js'].map(f => readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8')).join('\n');
  // (Keys built from a prefix, `why_${r}`, `tab_${id}`, count as used by it.)
  const unused = Object.keys(STRINGS.zh).filter(k => !src.includes(`'${k}'`) && !src.includes(`\`${k.split('_')[0]}_`));
  assert.deepEqual(unused, []);
  const used = [...src.matchAll(/\b(?:t|T|ctx\.t)\(\s*'([A-Za-z_0-9]+)'/g)].map(m => m[1]);
  for (const k of used) assert.ok(k in STRINGS.zh, `t('${k}') has no text`);
  const t = makeT('en');
  assert.equal(t('gamesN', { n: 3 }), STRINGS.en.gamesN.replace('{n}', '3'));
  assert.equal(t('noSuchKey'), 'noSuchKey');
  assert.equal(makeT('fr')('tab_home'), STRINGS.zh.tab_home, 'another language: Chinese');
});

test('the playoffs: the round to open on, a calendar stage as its round key, a side not decided', () => {
  // (Counted from 1.)
  assert.equal(openRound({ rounds: [{ state: 'done' }, { state: 'live' }, { state: 'later' }] }), 2);
  assert.equal(openRound({ rounds: [{ state: 'live' }, { state: 'on' }, { state: 'live' }] }), 1, 'the first on now');
  assert.equal(openRound({ rounds: [{ state: 'done' }, { state: 'on' }, { state: 'later' }] }), 2);
  assert.equal(openRound({ rounds: [{ state: 'done' }, { state: 'done' }] }), 2, 'all done: the last');
  assert.equal(openRound({ rounds: [{ state: 'later' }] }), 1);
  assert.equal(stageKey('Rd of 16'), 'round-of-16');
  assert.equal(stageKey('Knockout Round Playoffs'), 'knockout-round-playoffs');
  assert.equal(undecided({ id: '-2', name: 'TBD', abbr: 'CLE/CHW' }), true);
  assert.equal(undecided({ id: '5', name: 'TBD' }), true);
  assert.equal(undecided({ id: '5', name: 'Yankees', abbr: 'NYY' }), false);
  assert.equal(undecided(null), false);
  assert.deepEqual(buildBracket([], 'mlb'), []);
});

test('a series not begun shows no score (never 0-0); a game called off isn’t a tie’s', () => {
  const side = (id, abbr) => ({ id, abbr, name: abbr, short: abbr });
  const g = (id, state, extra = {}) => ({ id, league: 'mlb', kind: 'match', start: `2026-10-0${id}T20:00Z`, note: `ALDS - Game ${id}`, status: { state }, round: { key: 'QTR', title: 'ALDS' }, home: side('1', 'NYY'), away: side('2', 'BOS'), series: { completed: false, games: 5, wins: { 1: 0, 2: 0 } }, ...extra });
  const [r] = buildBracket([g('1', 'pre'), g('2', 'pre'), g('3', 'pre', { status: { state: 'pre', void: true } })], 'x', { shape: [['QTR', '分區系列賽', 'Division Series', 1]] });
  const [t] = r.ties;
  assert.deepEqual(t.score, {});
  assert.equal(t.winner, null);
  assert.equal(t.next.id, '1');
  assert.equal(t.games.length, 2);
});

test('MLB’s date (New York’s), summer time and winter time; F1’s points one table', () => {
  assert.equal(mlbDate(Date.parse('2026-10-05T02:30Z')), '2026-10-04');
  assert.equal(mlbDate(Date.parse('2026-11-02T04:30Z')), '2026-11-01');
  assert.equal(mlbDate(Date.parse('2026-03-08T06:59Z')), '2026-03-08', 'the night the clocks go forward');
  assert.equal(F1_POINTS, POINTS);
  assert.deepEqual([pointsFor('Race', 1), pointsFor('Race', 10), pointsFor('Race', 11), pointsFor('SR', 8), pointsFor('SR', 9), pointsFor('Race', 1, true), pointsFor('Qual', 1)], [25, 1, 0, 1, 0, 0, 0]);
});

test('CPBL’s lists: a score where one side’s is missing is 0 (an older list’s copy); none at all, a dash; called off is void', () => {
  const g = (state, homeScore, awayScore, extra = {}) => ({ id: 'c1', state, start: '2026-10-10T10:35Z', home: { en: 'Rakuten Monkeys', zh: '樂天桃猿' }, away: { en: 'CTBC Brothers', zh: '中信兄弟' }, homeScore, awayScore, ...extra });
  const [done] = parseAsia([g('post', 3, null)], 'cpbl', 'zh');
  assert.deepEqual([done.home.score, done.away.score, done.home.winner], [3, 0, true]);
  const [none] = parseAsia([g('post', null, null)], 'cpbl', 'zh');
  assert.deepEqual([none.home.score, none.away.score, none.home.winner, none.away.winner], ['', '', false, false]);
  const [off] = parseAsia([g('void', null, null)], 'cpbl', 'en');
  assert.deepEqual([off.status.state, off.status.void, off.home.name], ['pre', true, 'Rakuten Monkeys']);
});

test('Kambi’s live innings: a game started, its innings’ runs, the sides by nickname either way round', () => {
  const data = { events: [{ event: { state: 'STARTED', homeName: 'Uni-President 7-Eleven Lions', awayName: 'Rakuten Monkeys', path: [{ termKey: 'baseball' }, { termKey: 'cpbl' }] }, liveData: { score: { home: '2', away: '1', info: '1-0 | 1-1' } } }, { event: { state: 'NOT_STARTED', homeName: 'A', awayName: 'B' } }] };
  const [k] = kambiInnings(data, 'baseball/cpbl');
  assert.deepEqual(k, { home: 'lions', away: 'monkeys', inning: 2, homeScore: 2, awayScore: 1, homeLines: ['1', '1'], awayLines: ['0', '1'] });
  assert.deepEqual(kambiInnings(data, 'baseball/npb'), []);
  const e = { status: { state: 'in' }, home: { en: 'Rakuten Monkeys', score: '' }, away: { en: 'Uni-President Lions', score: '' } };
  const [out] = applyKambiLive([e], [k]);
  assert.deepEqual([out.home.score, out.away.score, out.status.period], [1, 2, 2], 'listed the other way round: swapped');
  assert.equal(applyKambiLive([{ ...e, status: { state: 'post' } }], [k])[0].home.score, '', 'only a game on');
});

test('CPBL’s play-off seeds: the better half champion waits, one club winning both halves', () => {
  const t = (key, rows) => ({ key, rows: rows.map(([en, w, l, gp = 60]) => ({ en, w, l, gp })) });
  const two = cpblSeeds({ year: 2026, tables: [t('first', [['A', 40, 20], ['B', 35, 25], ['C', 30, 30]]), t('second', [['B', 38, 22], ['A', 36, 24], ['C', 31, 29]])] });
  assert.deepEqual([two.direct, two.given, two.rival, two.sure], ['A', 'B', 'C', true]);
  const one = cpblSeeds({ tables: [t('first', [['A', 40, 20], ['B', 35, 25], ['C', 30, 30]]), t('second', [['A', 38, 22], ['C', 37, 23], ['B', 31, 29]])] });
  assert.deepEqual([one.direct, one.given, one.rival], ['A', 'C', 'B']);
  assert.equal(cpblSeeds({ tables: [] }), null);
  assert.equal(cpblSeeds({ tables: [t('first', [['A', 10, 5, 15]])] }).sure, false, 'a half not over: its leader stands in');
});

test('injuries: a game’s and the teams’ together, once each; one who’s played left off', () => {
  const merged = mergeInjuries([{ team: '1', list: [{ id: 'a', name: 'A' }] }], { 1: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], 2: [{ id: '', name: 'C' }] });
  assert.deepEqual(merged.map(t => [t.team, t.list.map(x => x.name)]), [['1', ['A', 'B']], ['2', ['C']]]);
  const played = withoutPlayed(merged, { players: [{ tables: [{ rows: [{ id: 'b', stats: ['12', '3'] }, { id: 'a', dnp: true, stats: [] }] }] }] });
  assert.deepEqual(played[0].list.map(x => x.id), ['a']);
  assert.equal(withoutPlayed(merged, {}), merged, 'no box score: as it is');
  const zeros = withoutPlayed(merged, { players: [{ tables: [{ rows: [{ id: 'b', stats: ['0', '--', '0-0'] }] }] }] });
  assert.deepEqual(zeros[0].list.map(x => x.id), ['a', 'b'], 'a line of zeros isn’t playing');
  const report = parseLeagueInjuries({ injuries: [{ id: 7, injuries: [{ athlete: { displayName: 'Joe', links: [{ rel: ['playercard'], href: 'https://x/id/123/joe' }] }, status: 'Out', details: { type: 'Knee', detail: 'Not Specified' } }, { athlete: {} }] }, { id: 8, injuries: [] }] });
  assert.deepEqual(Object.keys(report), ['7']);
  assert.deepEqual([report[7][0].id, report[7][0].what], ['123', 'Knee']);
});

test('a team’s players to come: this season’s roster, a newcomer’s numbers from the league, a rookie’s dashes, by minutes', () => {
  const avg = { season: { name: '2025-26' }, labels: ['MIN', 'PTS', 'REB', 'AST'], rows: [{ id: '1', name: 'A. One', stats: ['30.1', '20', '5', '5'] }, { id: 'gone', name: 'Gone', stats: ['35', '30', '9', '9'] }] };
  const out = rosterAverages(avg, [{ id: '1', name: 'Al One' }, { id: '2', name: 'Bo Two' }, { id: '3', name: 'Cy Three' }], new Map([['2', ['32.0', '18', '4', '3']]]));
  assert.deepEqual(out.rows.map(r => [r.id, r.stats[0]]), [['2', '32.0'], ['1', '30.1'], ['3', '–']]);
  assert.equal(out.rows[2].name, 'C. Three');
  assert.equal(rosterAverages(avg, []), avg);
});

test('a player’s game log: the score from his side, his competition by name, RotoWire’s time', () => {
  const log = {
    statistics: [{ displayName: 'Regular Season', labels: ['MIN', 'PTS', 'MIN'], events: [{ eventId: '1', stats: ['30', '20', '30'] }, { eventId: '1', stats: [] }] }],
    events: { 1: { gameDate: '2026-10-10T00:00Z', atVs: '@', leagueName: 'English Premier League', team: { id: '9', abbreviation: 'ARS' }, homeTeamId: '4', homeTeamScore: '2', awayTeamScore: '1', opponent: { id: '4', displayName: 'Chelsea', abbreviation: 'CHE' }, gameResult: 'L', score: '2-1' } }
  };
  const g = parseGameLog(log);
  assert.deepEqual(g.labels, ['MIN', 'PTS'], 'the first set of labels only');
  assert.equal(g.games.length, 1);
  assert.deepEqual([g.games[0].score, g.games[0].result, g.games[0].league, g.games[0].home], ['1-2', 'L', 'epl', false]);
  assert.equal(parseGameLog(null), null);
  assert.equal(leagueByName('UEFA Nations League'), 'nationsleague');
  assert.equal(leagueByName('Premier League'), 'epl');
  assert.equal(leagueByName('Egyptian Premier League'), '');
  assert.equal(usDate('Tue Sep 29 07:02:00 PDT 2026'), '2026-09-29T14:02:00.000Z');
  assert.equal(usDate('Sun Nov 01 07:00:00 EST 2026'), '2026-11-01T12:00:00.000Z');
  assert.equal(usDate('yesterday'), '');
  assert.equal(logSeason('nba', Date.parse('2026-10-18T00:00Z')), 2027);
  assert.equal(logSeason('nba', Date.parse('2026-04-18T00:00Z')), 2026);
  assert.equal(logSeason('mlb', Date.parse('2026-10-18T00:00Z')), 2026);
  assert.equal(logSeason('epl'), null);
});

test('a basketball overtime over and still level: 延長賽結束, not 第5節結束; while played: 延長賽 2:31', async () => {
  const { liveLabel } = await import('../public/lib/live.mjs');
  const e = (period, name, short = '', clock = '') => ({ status: { period, name, short, clock } });
  assert.equal(liveLabel(e(5, 'STATUS_END_PERIOD', 'End of OT'), 'basketball'), '延長賽結束');
  assert.equal(liveLabel(e(6, 'STATUS_END_PERIOD', 'End of 2OT'), 'basketball', 'en'), 'End of 2OT');
  assert.equal(liveLabel(e(4, 'STATUS_END_PERIOD', 'End of 4th'), 'basketball'), '第4節結束');
  assert.equal(liveLabel(e(5, 'STATUS_IN_PROGRESS', '2:31 - OT', '2:31'), 'basketball'), '延長賽 2:31');
  assert.equal(liveLabel(e(7, 'STATUS_IN_PROGRESS', '', '0:00'), 'basketball', 'en'), '3OT');
  assert.equal(liveLabel(e(9, 'STATUS_END_PERIOD', 'End of 9th'), 'baseball'), '9局結束');
});
