import test from 'node:test';
import assert from 'node:assert/strict';
import { injuryWhatZh } from '../public/lib/statnames.mjs';
import { cleanZh, usableZh } from '../public/lib/people.mjs';

test('what is wrong, from the fixed list: Back is 背部, never 後退', () => {
  assert.equal(injuryWhatZh('Back'), '背部');
  assert.equal(injuryWhatZh('Knee Soreness'), '膝蓋痠痛');
  assert.equal(injuryWhatZh('Knee - ACL + MCL'), '膝蓋前十字韌帶、內側副韌帶');
  assert.equal(injuryWhatZh('Left Hamstring Tightness'), '左腿後肌緊繃');
  assert.equal(injuryWhatZh("Coach's Decision"), '教練決定');
  assert.equal(injuryWhatZh('Gibberish'), null);
});

test("a name as Google gives it: the honorific off, one kind of dot; Latin letters left aren't Chinese", () => {
  assert.equal(cleanZh('泰瑞斯‧馬克西先生'), '泰瑞斯·馬克西');
  assert.equal(cleanZh('勒布朗 · 詹姆斯 先生'), '勒布朗·詹姆斯');
  assert.ok(usableZh('湯姆林'));
  assert.ok(!usableZh("Nae'Qwan 湯姆林"));
});
