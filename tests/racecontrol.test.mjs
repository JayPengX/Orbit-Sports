// Race control's messages in Chinese, each car a driver.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { raceControlParts, raceControlUnknown } from '../public/lib/racecontrol.mjs';

const said = (m, zh = true) => raceControlParts(m, zh).map(x => (typeof x === 'string' ? x : `[${x.no}]`)).join('');

test('the Chinese way round: who, where, the verdict, why in brackets', () => {
  assert.equal(said('FIA STEWARDS: TURN 1 INCIDENT INVOLVING CAR 55 (SAI) REVIEWED NO FURTHER INVESTIGATION - LEAVING THE TRACK AND GAINING AN ADVANTAGE'), '幹事：[55] 第 1 彎事件已檢視，不再調查（離開賽道並取得優勢）');
  assert.equal(said('FIA STEWARDS: 5 SECOND TIME PENALTY FOR CAR 44 (HAM) - CAUSING A COLLISION'), '幹事：[44] 罰時 5 秒（造成碰撞）');
  assert.equal(said('INCIDENT INVOLVING CARS 1 (VER) AND 16 (LEC) NOTED - CAUSING A COLLISION'), '[1]、[16] 事件已記錄（造成碰撞）');
  assert.equal(said('CAR 4 (NOR) TIME 1:32.123 DELETED - TRACK LIMITS AT TURN 4 LAP 12 15:03:22'), '[4] 圈速 1:32.123 取消（第 12 圈第 4 彎超出賽道界線）');
  assert.equal(said('WAVED BLUE FLAG FOR CAR 10 (GAS) TIMED AT 16:39:14'), '[10] 藍旗（須讓車）');
  assert.equal(said('FIA STEWARDS: PENALTY SERVED - 10 SECOND TIME PENALTY FOR CAR 31 (OCO) - CAUSING A COLLISION'), '幹事：[31] 罰時 10 秒已執行（造成碰撞）');
  assert.equal(said('FIA STEWARDS: SQ1 - TURN 14 INCIDENT INVOLVING CARS 63 (RUS) AND 22 (TSU) REVIEWED NO FURTHER INVESTIGATION - IMPEDING'), '幹事：SQ1 [63]、[22] 第 14 彎事件已檢視，不再調查（阻擋）');
  assert.equal(said('LAPPED CARS MAY NOW OVERTAKE THE SAFETY CAR: 1, 4 AND 16'), '被套圈車可超越安全車：[1]、[4]、[16]');
  assert.equal(said('FIRST CAR TO TAKE THE FLAG - CAR 1 (NOR)'), '首位衝線：[1]');
  assert.equal(said('RISK OF RAIN FOR F1 QUALIFYING SESSION IS 20%'), '排位賽降雨機率 20%');
});

test('the safety car, both ways FIA writes it (Singapore 2026: "VSC DEPLOYED" stayed English)', () => {
  assert.equal(said('VSC DEPLOYED'), '虛擬安全車出動');
  assert.equal(said('VIRTUAL SAFETY CAR DEPLOYED'), '虛擬安全車出動');
  assert.equal(said('VSC ENDING'), '虛擬安全車即將結束');
  assert.equal(said('SAFETY CAR IN THIS LAP'), '安全車本圈回維修區');
  assert.equal(said('DRS ENABLED'), 'DRS 開放');
  assert.equal(said('DOUBLE YELLOW IN TRACK SECTOR 7'), '第 7 區段雙黃旗');
});

test('a lap deleted without its number, with a clock and (PIT) after it (Stroll, Singapore FP1)', () => {
  assert.equal(said('CAR 18 (STR) LAP DELETED - TRACK LIMITS AT TURN 11 LAP 16 17:04:46 (PIT)'), '[18] 該圈成績取消（第 16 圈第 11 彎超出賽道界線）');
});

test('an incident at a turn, its clock in brackets', () => {
  const parts = raceControlParts('FIA STEWARDS: TURN 5 INCIDENT INVOLVING CARS 27 (HUL) AND 55 (SAI) WILL BE INVESTIGATED AFTER THE SESSION - IMPEDING (22:10:13)');
  assert.deepEqual(parts, ['幹事：', { no: '27' }, '、', { no: '55' }, ' 第 5 彎事件賽後調查（阻擋）']);
});

test('a head the rules don\'t know: English, the cars still drivers', () => {
  assert.equal(said('CAR 63 (RUS) WILL START FROM THE BACK OF THE GRID'), '[63] WILL START FROM THE BACK OF THE GRID');
  assert.equal(said('CAR 18 (STR) STOPPED AT TURN 15', false), '[18] STOPPED AT TURN 15');
});

test('every message of 2025 and 2026 (one of each shape) is told in Chinese', () => {
  const all = JSON.parse(readFileSync(new URL('./fixtures/racecontrol-2025-2026.json', import.meta.url), 'utf8'));
  assert.ok(all.length > 1000);
  const left = all.filter(m => raceControlUnknown(m).length);
  assert.deepEqual(left, []);
  // No English word left in any (DRS, a part, a series' name and a lap time aside).
  const english = all.map(m => said(m)).filter(t => /[A-Z]{3,}/.test(t.replace(/DRS|S?Q[123]|F[123]|\[\d+\]|\b[A-Z]{3}\b(?= 圈速| 該圈)/g, '')));
  assert.deepEqual(english, []);
});
