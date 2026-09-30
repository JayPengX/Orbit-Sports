import test from 'node:test';
import assert from 'node:assert/strict';
import { teamStatRows } from '../public/lib/statnames.mjs';

test('baseball keeps batting and pitching apart, picked and in Chinese', () => {
  const rows = teamStatRows(
    [
      { key: 'batting.hits', label: 'Hits', group: 'batting', away: '1', home: '4' },
      { key: 'pitching.hits', label: 'Hits', group: 'pitching', away: '4', home: '1' },
      { key: 'batting.runsCreated', label: 'Runs Created', group: 'batting', away: '-0.4', home: '1.7' },
      { key: 'pitching.ERA', label: 'Earned Run Average', group: 'pitching', away: '3.00', home: '0.00' }
    ],
    'baseball'
  );
  assert.deepEqual(rows.map(r => [r.group, r.label, r.away, r.low]), [
    ['打擊', '安打', '1', false],
    ['投球', '被安打', '4', true],
    ['投球', '防禦率', '3.00', true]
  ]);
});

test('soccer percentages read as percents; untranslated stats are left out in Chinese', () => {
  const rows = teamStatRows(
    [
      { key: 'shotPct', label: 'On Target %', away: '0.4', home: '0.25' },
      { key: 'possessionPct', label: 'Possession', away: '63.8', home: '36.2' },
      { key: 'mysteryIndex', label: 'Mystery Index', away: '3', home: '2' }
    ],
    'soccer'
  );
  assert.deepEqual(rows.map(r => [r.label, r.away, r.home]), [
    ['射正率', '40%', '25%'],
    ['控球率', '64%', '36%']
  ]);
  assert.equal(teamStatRows([{ key: 'mysteryIndex', label: 'Mystery Index', away: '3', home: '2' }], 'soccer', 'en')[0].label, 'Mystery Index');
});
