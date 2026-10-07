import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlightsQuery, pickHighlights, sideWords, ageSpan, gameNumber } from '../public/lib/highlights.mjs';

const NOW = Date.parse('2026-10-07T15:00:00Z');
const v = (id, title, channel, channelId, age, verified = true) => ({ id, title, channel, channelId, verified, age, length: '9:52' });
const MLB = 'UCoLrcjPV5PbUrUyXq5mjc_A';
const side = (en, score) => ({ en, name: en, short: en.split(' ').at(-1), score: String(score) });
const game = (league, away, home, extra = {}) => ({ id: '1', league, kind: 'match', start: '2026-10-07T00:08Z', status: { state: 'post' }, away, home, note: '', ...extra });

test("a playoff game is searched by its round and number, any other by its day; football's home side first", () => {
  const nlds = game('mlb', side('Milwaukee Brewers', 3), side('San Diego Padres', 4), { note: 'NLDS - Game 3' });
  assert.deepEqual(gameNumber(nlds), { round: 'NLDS', game: 3 });
  assert.equal(highlightsQuery(nlds), 'Milwaukee Brewers vs San Diego Padres NLDS Game 3 highlights 2026');
  assert.equal(highlightsQuery(game('nba', side('Los Angeles Lakers', 98), side('Golden State Warriors', 124), { start: '2026-10-07T02:00Z' })), 'Los Angeles Lakers vs Golden State Warriors highlights Oct 6, 2026');
  assert.equal(highlightsQuery(game('seriea', side('AS Roma', 2), side('Torino', 0), { start: '2026-10-05T18:45Z' })), 'Torino vs AS Roma highlights Oct 5, 2026');
});

test("the game's own number: another game of the series is another game's", () => {
  const e = game('mlb', side('Milwaukee Brewers', 3), side('San Diego Padres', 4), { note: 'NLDS - Game 3', series: { summary: 'MIL leads 2-1' } });
  const list = [
    v('g1', 'PADRES vs. BREWERS: NLDS Full Game 1 Highlights (October 3) | 2026 MLB Season', 'MLB', MLB, '3d ago'),
    v('fan', 'Brewers vs Padres NLDS Game 3 Highlights', 'Brew Crew Fan', 'UCfan', '10h ago', false),
    v('g3', 'BREWERS vs. PADRES: NLDS Full Game 3 Highlights (October 6) | 2026 MLB Postseason', 'MLB', MLB, '10h ago'),
    v('every', 'EVERY PLAY from Brewers vs. Padres NLDS Game 3', 'MLB', MLB, '9h ago')
  ];
  assert.equal(pickHighlights(list, e, NOW).id, 'g3');
  assert.equal(pickHighlights(list.slice(0, 2), e, NOW), null, 'Game 1, or a fan channel: none');
});

test("an NBA game: one channel's cut every game (GAMETIME HIGHLIGHTS), never the NBA's own (not in Taiwan) or a team's", () => {
  const e = game('nba', side('Los Angeles Lakers', 98), side('Golden State Warriors', 124), { start: '2026-10-07T02:00Z' });
  const nba = v('nba', 'LAKERS at WARRIORS | NBA PRESEASON FULL GAME HIGHLIGHTS | October 6, 2026', 'NBA', 'UCWJ2lWNubArHWmf3FIHbfcQ', '10h ago');
  const team = v('team', 'Golden State Warriors vs. Los Angeles Lakers Full Game Highlights', 'Golden State Warriors', 'UCgsw', '11h ago');
  const dawkins = v('fd', 'Los Angeles Lakers vs Golden State Warriors Full Game Highlights | Oct 6, 2026 | FreeDawkins', 'FreeDawkins', 'UCEjOSbbaOfgnfRODEEMYlCw', '11h ago');
  const gametime = v('gt', 'Los Angeles Lakers vs Golden State Warriors Full Game Highlights - October 6, 2026 | NBA Preseason', 'GAMETIME HIGHLIGHTS', 'UC0LrZO9wORIqn_aRJtKdgfA', '11h ago');
  assert.equal(pickHighlights([nba, team, dawkins, gametime], e, NOW).id, 'gt');
  assert.equal(pickHighlights([nba, team, dawkins], e, NOW), null);
});

test("CPBL: ELTA's 全場精華 first, then the league's own; clubs by their owner's name; the game's own day", () => {
  const cpbl = (away, home, extra) => ({ id: 'c', league: 'cpbl', kind: 'match', start: '2026-10-03T09:05:00Z', status: { state: 'post' }, away: { name: away, en: 'x', score: '3' }, home: { name: home, en: 'y', score: '5' }, ...extra });
  const e = cpbl('中信兄弟', '富邦悍將');
  assert.equal(highlightsQuery(e), '10/3 中信兄弟 VS 富邦悍將 全場精華 中華職棒');
  const own = v('own', '10/03 中信 VS 富邦 全場精華', 'CPBL 中華職棒', 'UCDt9GAqyRzc2e5BNxPrwZrw', '4d ago');
  const elta = v('elta', '【全場精華】10/3 中信兄弟 vs. 富邦悍將 ｜ 中華職棒37年例行賽｜鎖定ELTA.tv愛爾達', '愛爾達體育家族 ELTA Sports', 'UCCQvP4hsRW9emj0meGk15jg', '4d ago');
  const videoland = v('vl', '【2026中華職棒例行賽】10/03 #中信兄弟 VS #富邦悍將 全場賽事精華', '緯來體育台', 'UC3P83RUWwKbZ4bkhNti4ZuQ', '4d ago');
  const NOW2 = Date.parse('2026-10-07T15:00:00Z');
  assert.equal(pickHighlights([videoland, own, elta], e, NOW2).id, 'elta');
  assert.equal(pickHighlights([videoland, own], e, NOW2).id, 'own');
  assert.equal(pickHighlights([videoland], e, NOW2), null, "緯來's: not taken");
  assert.equal(pickHighlights([v('d2', '10/04 中信 VS 富邦 全場精華', 'CPBL 中華職棒', 'UCDt9GAqyRzc2e5BNxPrwZrw', '3d ago')], e, NOW2), null, 'the next day: another game');
  assert.equal(pickHighlights([own], e, NOW2).official, true);
});

test("football: the league's own, a side's own (its federation's too), by both sides and the score; never a US-only broadcaster's", () => {
  const e = game('seriea', side('AS Roma', 2), side('Torino', 0), { start: '2026-10-05T18:45Z' });
  const list = [
    v('cbs', 'Torino vs. Roma: Extended Highlights | Serie A | CBS Sports Golazo', 'CBS Sports Golazo', 'UCET00YnetHT7tOpu12v8jxg', '1d ago'),
    v('it', 'MAXI SINTESI TORINO-ROMA 0-2 | EXTENDED HIGHLIGHTS | SERIE A ENILIVE 2026/27', 'Serie A', 'UCBJeMCIeLQos7wacox4hmLQ', '1d ago'),
    v('old', 'TORINO-ROMA 1-1 | HIGHLIGHTS | SERIE A 2025/26', 'Serie A', 'UCBJeMCIeLQos7wacox4hmLQ', '7mo ago'),
    v('club', 'TORINO 0-2 ROMA | SERIE A HIGHLIGHTS 2026-27', 'AS Roma', 'UCroma', '1d ago'),
    v('league', 'TORINO-ROMA 0-2 | EXTENDED HIGHLIGHTS | SERIE A 2026/27', 'Serie A', 'UCBJeMCIeLQos7wacox4hmLQ', '1d ago')
  ];
  assert.equal(pickHighlights(list, e, NOW).id, 'league');
  assert.equal(pickHighlights(list.slice(0, 4), e, NOW).id, 'club');
  assert.equal(pickHighlights([v('wrong', 'TORINO-ROMA 1-3 | HIGHLIGHTS | SERIE A 2026/27', 'Serie A', 'UCBJeMCIeLQos7wacox4hmLQ', '1d ago')], e, NOW), null, 'another score');
  // Ligue 1's own video of a game says its sides and score, not "highlights".
  const l1 = game('ligue1', side('Angers', 0), { en: 'Le Havre AC', name: 'Le Havre AC', short: 'Le Havre', score: '0' }, { start: '2026-09-12T15:00Z' });
  assert.equal(pickHighlights([v('l1', "HAVRE AC - ANGERS SCO (0-0) | Week 4 - Ligue 1 McDonald's 26/27", 'Ligue 1 McDonald’s', 'UCQsH5XtIc9hONE1BQjucM0g', '3w ago')], l1, NOW).id, 'l1');
  // A federation's channel: Germany's is German Football.
  const nl = game('nationsleague', side('Germany', 0), side('Greece', 0), { start: '2026-10-04T18:45Z' });
  assert.equal(pickHighlights([v('de', 'VAR decides on the game-winner! | Greece vs Germany | Highlights Nations League', 'German Football', 'UCde', '1d ago')], nl, NOW).id, 'de');
});

test('Manchester derby: each side by its own words', () => {
  const city = { en: 'Manchester City', name: 'Manchester City' };
  const united = { en: 'Manchester United', name: 'Manchester United' };
  assert.ok(sideWords(city, united).includes('man city'));
  assert.ok(!sideWords(city, united).includes('manchester'));
  const e = game('epl', { ...united, score: '1' }, { ...city, score: '2' }, { start: '2026-10-04T11:30Z' });
  assert.equal(pickHighlights([v('mc', 'HIGHLIGHTS | Man City 2-1 Man Utd | Derby day', 'Man City', 'UCcity', '3d ago')], e, NOW).id, 'mc');
});

test("F1: the weekend's place and its session, not the sprint's for the race", () => {
  const e = { id: 'x~Race', league: 'f1', kind: 'field', sessionKey: 'Race', enName: 'Singapore Airlines Singapore Grand Prix', start: '2026-10-04T12:00Z', official: '2026-10-04T12:00Z', status: { state: 'post' } };
  const F1 = 'UCB_qr75-ydFVKSF9Dmo6izg';
  assert.equal(highlightsQuery(e), 'F1 2026 Singapore Grand Prix Race Highlights');
  const list = [v('old', 'Extended Highlights | 2017 Singapore Grand Prix', 'FORMULA 1', F1, '1d ago'), v('sprint', 'Sprint Race Highlights | 2026 Singapore Grand Prix', 'FORMULA 1', F1, '3d ago'), v('race', 'Race Highlights | 2026 Singapore Grand Prix', 'FORMULA 1', F1, '3d ago')];
  assert.equal(pickHighlights(list, e, NOW).id, 'race');
});

test("a video's age: put up after the game, not before it", () => {
  assert.deepEqual(ageSpan('10h ago'), { min: 36e6, max: 39.6e6 });
  assert.equal(ageSpan('Streamed 2 weeks ago').min, 2 * 6.048e8);
  assert.equal(ageSpan('Premiered'), null);
  const e = game('mls', side('Vancouver Whitecaps', 1), side('Chicago Fire FC', 3), { start: '2026-10-07T00:30Z' });
  const mls = 'UCSZbXT5TLLW_i-5W8FZpFsg';
  assert.equal(pickHighlights([v('before', 'Chicago Fire FC vs. Vancouver Whitecaps | Full Match Highlights', 'Major League Soccer', mls, '5mo ago')], e, NOW), null);
  assert.equal(pickHighlights([v('now', 'Chicago Fire FC vs. Vancouver | Full Match Highlights | Lewandowski vs. Müller!', 'Major League Soccer', mls, '12h ago')], e, NOW).id, 'now');
});
