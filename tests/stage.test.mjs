// Season stages, the nearest game day, table gaps, stat bars, Taiwan broadcasts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stageFrom, stageTag, roundName } from '../public/lib/stage.mjs';
import { nearestDay } from '../public/lib/days.mjs';
import { withGaps, parseSeries, parseScoreboard } from '../public/lib/espn.mjs';
import { statValue, groupShort } from '../public/sheets.js';

test('stages: preseason, regular, cup, All-Star, playoffs and finals', () => {
  assert.equal(stageFrom({ seasonType: 1, seasonSlug: 'preseason' }).key, 'pre');
  assert.equal(stageFrom({ seasonType: 2, seasonSlug: 'regular-season' }).special, false);
  const cup = stageFrom({ seasonType: 2, note: 'NBA Cup - Quarterfinals' });
  assert.equal(cup.key, 'cup');
  assert.equal(stageTag({ stage: cup }, 'zh'), 'NBA 盃 · 八強');
  assert.equal(stageFrom({ seasonType: 2, typeAbbr: 'ALLSTAR', note: 'NBA All-Star - Round Robin' }).key, 'allstar');
  const wc = stageFrom({ seasonType: 3, seasonSlug: 'post-season', note: 'NLWC - Game 1' });
  assert.equal(wc.key, 'post');
  assert.equal(stageTag({ stage: wc }, 'zh'), '國聯外卡賽 G1');
  assert.equal(stageFrom({ seasonType: 3, note: 'World Series - Game 7' }).key, 'final');
  assert.equal(stageFrom({ seasonType: 3, note: 'NBA Finals - Game 2' }).key, 'final');
  assert.equal(stageFrom({ seasonType: 3, note: 'West Finals - Game 2' }).key, 'post');
  assert.equal(roundName('West Finals - Game 2'), '西區分區冠軍賽 G2');
  assert.equal(roundName('ALDS - Game 3 If Necessary'), '美聯分區系列賽 G3（如需）');
});

test('scoreboards carry the stage and the series', () => {
  const data = {
    events: [
      {
        id: '1',
        date: '2026-09-29T17:00Z',
        name: 'PHI at ATL',
        season: { year: 2026, type: 3, slug: 'post-season' },
        competitions: [
          {
            type: { abbreviation: 'RD16' },
            notes: [{ headline: 'NLWC - Game 1' }],
            series: { type: 'playoff', summary: 'Series tied 1-1', totalCompetitions: 3, competitors: [{ id: '15', wins: 1 }, { id: '16', wins: 1 }] },
            competitors: [
              { homeAway: 'home', team: { id: '15', displayName: 'Atlanta Braves' } },
              { homeAway: 'away', team: { id: '16', displayName: 'Philadelphia Phillies' } }
            ]
          }
        ]
      }
    ]
  };
  const [e] = parseScoreboard(data, 'mlb');
  assert.equal(e.stage.key, 'post');
  assert.equal(e.series.summary, 'Series tied 1-1');
  assert.equal(e.series.wins['15'], 1);
  assert.equal(parseSeries({ type: 'other' }), null);
});

test('the nearest game day, the next one on a tie', () => {
  const now = Date.parse('2026-09-29T12:00:00');
  assert.equal(nearestDay(['2026-09-20', '2026-10-10'], now), '2026-09-20');
  assert.equal(nearestDay(['2026-09-26', '2026-10-01'], now), '2026-10-01');
  assert.equal(nearestDay(['2026-09-28', '2026-09-30'], now), '2026-09-30');
  assert.equal(nearestDay([], now), null);
});

test('tables: points behind the leader, games behind where missing', () => {
  const [g] = withGaps([{ name: '', rows: [{ stats: { P: '15' } }, { stats: { P: '12' } }, { stats: { P: '9' } }] }], 'soccer');
  assert.deepEqual(g.rows.map(r => r.stats.GAP), ['-', '3', '6']);
  const [f] = withGaps([{ name: '', rows: [{ stats: { W: '10', L: '2' } }, { stats: { W: '8', L: '4' } }, { stats: { W: '9', L: '2' } }] }], 'basketball');
  assert.deepEqual(f.rows.map(r => r.stats.GB), ['-', '2', '0.5']);
});

test('stat bars read rates, times and made-attempted as numbers', () => {
  assert.equal(statValue('.271'), 0.271);
  assert.equal(statValue('45%'), 45);
  assert.equal(statValue('12-25'), 0.48);
  assert.equal(statValue('32:14'), 1934);
  assert.equal(statValue('-'), null);
});

test('a long conference name fits the comparison as its initials', () => {
  assert.equal(groupShort('Eastern Conference Group'), 'ECG');
  assert.equal(groupShort('American League East'), 'ALE');
  assert.equal(groupShort('Eastern'), 'Eastern');
});
