import test from 'node:test';
import assert from 'node:assert/strict';
import { tableKey } from '../public/lib/tiebreak.mjs';

test('fresh finals re-sort by the league’s own steps, ESPN’s order kept past them (Serie A: points alone)', () => {
  assert.deepEqual(tableKey('epl', 'soccer')({ stats: { P: '3', GD: '+1', F: '2' } }), [3, 1, 2]);
  assert.deepEqual(tableKey('seriea', 'soccer')({ stats: { P: '3', GD: '+1', F: '2' } }), [3]);
});
