import test from 'node:test';
import assert from 'node:assert/strict';
import { injuryWhatZh } from '../public/lib/statnames.mjs';

test('what is wrong, from the fixed list: Back is 背部, never 後退', () => {
  assert.equal(injuryWhatZh('Back'), '背部');
  assert.equal(injuryWhatZh('Knee Soreness'), '膝蓋痠痛');
  assert.equal(injuryWhatZh('Knee - ACL + MCL'), '膝蓋前十字韌帶、內側副韌帶');
  assert.equal(injuryWhatZh('Left Hamstring Tightness'), '左腿後肌緊繃');
  assert.equal(injuryWhatZh("Coach's Decision"), '教練決定');
  assert.equal(injuryWhatZh('Gibberish'), null);
});
