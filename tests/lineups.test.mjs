import test from 'node:test';
import assert from 'node:assert/strict';
import { coreStarters, withRoster, mlbLineups, coreRosterUrl, byRosterName } from '../public/lib/lineups.mjs';

test("ESPN's competitor roster: the starters as marked, named from the team's roster", () => {
  const data = { entries: [{ playerId: 1, starter: true, jersey: '23', displayName: 'James' }, { playerId: 2, starter: false, displayName: 'Bench' }, { playerId: 3, starter: true, didNotPlay: true, displayName: 'Out' }] };
  const s = coreStarters(data);
  assert.deepEqual(s, [{ id: '1', jersey: '23', name: 'James' }]);
  const named = withRoster(s, [{ name: 'Forwards', players: [{ id: '1', name: 'LeBron James', pos: 'F', headshot: 'x.png', jersey: '23' }] }]);
  assert.deepEqual(named[0], { id: '1', jersey: '23', name: 'LeBron James', headshot: 'x.png', pos: 'F' });
  // None marked yet: nothing.
  assert.deepEqual(coreStarters({ entries: [{ playerId: 1, starter: false }] }), []);
  assert.match(coreRosterUrl('basketball/nba', '401', '10'), /leagues\/nba\/events\/401\/competitions\/401\/competitors\/10\/roster/);
});

test("MLB's lineups: each side's probable pitcher, and its batting order once posted", () => {
  const data = { dates: [{ games: [{ teams: { away: { team: { name: 'Los Angeles Dodgers' }, probablePitcher: { id: 5, fullName: 'Tarik Skubal' } }, home: { team: { name: 'Milwaukee Brewers' } } }, lineups: { homePlayers: [{ id: 7, fullName: 'Jackson Chourio', primaryPosition: { abbreviation: 'LF' } }] } }] }] };
  const m = mlbLineups(data, { away: { en: 'Los Angeles Dodgers' }, home: { en: 'Milwaukee Brewers' } });
  assert.equal(m.pitchers.away.name, 'Tarik Skubal');
  assert.equal(m.pitchers.home, null);
  assert.deepEqual(m.order.home.map(p => [p.name, p.pos]), [['Jackson Chourio', 'LF']]);
  assert.equal(mlbLineups(data, { away: { en: 'X' }, home: { en: 'Y' } }), null);
});

test("MLB's people open their page: matched to the team's ESPN roster by name", () => {
  const roster = [{ name: 'Batters', players: [{ id: '42', name: 'Bobby Witt Jr.', pos: 'SS', headshot: 'w.png' }, { id: '9', name: 'Ronald Acuña Jr.', pos: 'RF' }] }];
  const [witt, acuna, nobody, none] = byRosterName([{ id: '', name: 'Bobby Witt', pos: 'SS' }, { id: '', name: 'Ronald Acuna', pos: '' }, { id: '', name: 'Someone Else', pos: 'C' }, null], roster);
  assert.deepEqual([witt.id, witt.headshot, acuna.id, acuna.pos], ['42', 'w.png', '9', 'RF']);
  assert.equal(nobody.id, '');
  assert.equal(none, null);
});
