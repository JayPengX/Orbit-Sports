// Race control's messages in Chinese, each car a driver.
import test from 'node:test';
import assert from 'node:assert/strict';
import { raceControlParts } from '../public/lib/racecontrol.mjs';

const said = (m, zh = true) => raceControlParts(m, zh).map(x => (typeof x === 'string' ? x : `[${x.no}]`)).join('');

test('set phrases in Chinese, each car a driver', () => {
  assert.equal(said('CAR 18 (STR) STOPPED AT TURN 15'), '[18] 在第 15 彎停車');
  assert.equal(said('FIA STEWARDS: 5 SECOND TIME PENALTY FOR CAR 44 (HAM) - CAUSING A COLLISION'), '幹事決定：5 秒罰時：[44]：造成碰撞');
  assert.equal(said('INCIDENT INVOLVING CARS 1 (VER) AND 16 (LEC) NOTED - CAUSING A COLLISION'), '事故：[1]與[16] 已記錄：造成碰撞');
  assert.equal(said('CAR 4 (NOR) TIME 1:32.123 DELETED - TRACK LIMITS AT TURN 4 LAP 12 15:03:22'), '[4] 圈速 1:32.123 取消：第 4 彎超出賽道界線，第 12 圈');
  assert.equal(said('VIRTUAL SAFETY CAR DEPLOYED'), '虛擬安全車出動');
  assert.equal(said('DRS ENABLED'), 'DRS 開放');
  assert.equal(said('DOUBLE YELLOW IN TRACK SECTOR 7'), '第 7 區段雙黃旗');
});

test('words the rules don\'t know: English, the cars still drivers', () => {
  assert.equal(said('CAR 63 (RUS) WILL START FROM THE BACK OF THE GRID'), '[63] WILL START FROM THE BACK OF THE GRID');
  assert.equal(said('CAR 18 (STR) STOPPED AT TURN 15', false), '[18] STOPPED AT TURN 15');
});

test('a lap deleted without its number, with a clock and (PIT) after it: in Chinese, short (Stroll, Singapore FP1)', () => {
  assert.equal(said('CAR 18 (STR) LAP DELETED - TRACK LIMITS AT TURN 11 LAP 16 17:04:46 (PIT)'), '[18] 圈速取消：第 11 彎超出賽道界線，第 16 圈');
});

test('an incident at a turn, its clock in brackets, in Chinese', () => {
  const parts = raceControlParts('FIA STEWARDS: TURN 5 INCIDENT INVOLVING CARS 27 (HUL) AND 55 (SAI) WILL BE INVESTIGATED AFTER THE SESSION - IMPEDING (22:10:13)');
  assert.deepEqual(parts, ['幹事決定：第 5 彎事故：', { no: '27' }, '與', { no: '55' }, ' 賽後調查：阻擋']);
});
