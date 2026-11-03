// F1's 過程 (lib/f1story.mjs): the whole race's turns and one driver's race,
// from each car's place at each lap's end, its stops and race control.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { raceStory, placeRuns, stopLaps, ems, STORY_FIT } from '../public/lib/f1story.mjs';

// Four cars, six laps: Alpha leads from pole, stops on lap 2 (Bravo leads),
// passes Charlie on lap 4; Delta stops at turn 3 on lap 4, a safety car for it.
const at = s => `2026-11-01T20:${String(s).padStart(2, '0')}:00Z`;
const race = {
  cars: [
    { no: '1', name: 'Al Alpha', pos: 2, grid: 1, stints: [{ c: 'MEDIUM' }, { c: 'HARD' }] },
    { no: '2', name: 'Bo Bravo', pos: 1, grid: 2 },
    { no: '3', name: 'Cy Charlie', pos: 3, grid: 3 },
    { no: '4', name: 'Di Delta', pos: 0, grid: 4, retired: true, laps: 4 }
  ],
  places: { 1: [1, 1, 1, 3, 2, 2, 2], 2: [2, 2, 2, 1, 1, 1, 1], 3: [3, 3, 3, 2, 3, 3, 3], 4: [4, 4, 4, 4, 4] },
  stops: { 1: [[2, 0, 22]] },
  control: [
    { lap: 3, at: at(5), message: 'FIA STEWARDS: 5 SECOND TIME PENALTY FOR CAR 3 (CHA) - CAUSING A COLLISION' },
    { lap: 5, at: at(8), message: 'SAFETY CAR DEPLOYED' },
    { lap: 5, at: at(9), message: 'CAR 4 (DEL) STOPPED AT TURN 3' },
    { lap: 6, at: at(11), message: 'SAFETY CAR IN THIS LAP' }
  ],
  last: 6,
  over: true
};
const nameOf = no => race.cars.find(c => c.no === String(no))?.name.split(' ')[1] || `#${no}`;

test("F1's 過程: the whole race, its lead, stops, penalty, the car out and the safety car it brought, the finish", () => {
  const list = raceStory(race, { nameOf });
  const said = list.map(e => `${e.lap} ${e.kind} ${e.text}${e.sub ? ` [${e.sub}]` : ''}`);
  assert.deepEqual(said, [
    '0 grid Alpha 竿位起跑',
    '1 lead Alpha 領先 [起跑守住]',
    '3 lead Bravo 接手領先 [Alpha 進站]',
    '3 penalty Charlie 罰時 5 秒 [造成碰撞]',
    '4 out Delta 退賽 [Delta 在第 3 彎停車]',
    '5 sc 安全車 · Delta 退賽 [第 3 彎 · 至第 6 圈]',
    '6 finish Bravo 奪冠 [Alpha 亞軍 · Charlie 季軍]'
  ]);
});

test("F1's 過程: one driver's race, how it ended up where it did (its stop, a pass, the finish)", () => {
  const list = raceStory(race, { nameOf, pick: '1' });
  const said = list.map(e => `${e.lap} ${e.kind} ${e.text}${e.sub ? ` [${e.sub}]` : ''}`);
  assert.deepEqual(said, [
    '0 grid 第 1 位起跑',
    '1 start 起跑後守住第 1',
    '2 pit 第 1 次進站，換硬胎 [第 1 → 第 3 · 維修區 22.0 秒]',
    '4 pass 超越 Charlie [第 3 → 第 2]',
    '5 sc 安全車 · Delta 退賽 [第 3 彎 · 至第 6 圈]',
    '6 finish 完賽第 2 [起跑第 1，退後 1 名]'
  ]);
  // Bravo's lead came from Alpha's stop, not a pass.
  assert.deepEqual(
    raceStory(race, { nameOf, pick: '2' }).filter(e => e.kind === 'gain').map(e => e.text),
    ['Alpha 進站，升到第 1']
  );
  // English too.
  assert.equal(raceStory(race, { nameOf, pick: '1', en: true }).find(e => e.kind === 'pass').text, 'Passes Charlie');
});

test("F1's 過程: a lap not read is carried from the one before; a stop's lap from the stops, else the pit flags", () => {
  assert.deepEqual(placeRuns({ 7: [0, 5, 0, 4, 0, 0] }, 10)[7], [0, 5, 5, 4]);
  assert.deepEqual(stopLaps([[12, 2.4, 22]]), [12]);
  assert.deepEqual(stopLaps([], [[10, 1, 0, 3, 0], [11, 1, 0, 5, 1], [12, 1, 0, 6, 1], [30, 1, 0, 4, 1]]), [11, 30]);
});

// Mexico 2026 (the replay's real laps and race control, tools/f1-replay.mjs):
// the safety car turned red flag as one turn with its cause and how long the
// race stopped; Verstappen's climb to the lead; under the red flag every car's
// tyres changed in the pit lane, never a 38-minute stop.
test("F1's 過程 on Mexico 2026: the red flag's cause and stop, Verstappen's climb, the red flag's tyre change", () => {
  const d = JSON.parse(readFileSync(new URL('./fixtures/f1-story-mexico.json', import.meta.url), 'utf8'));
  const name = no => d.names[no] || `#${no}`;
  const all = raceStory(d, { nameOf: name });
  const red = all.find(e => e.kind === 'red');
  // (Too long for one line at 320: the flag in the line, who, the corner, the medical car and the stop on two small ones.)
  assert.equal(red.text, '安全車轉紅旗');
  assert.equal(red.sub, 'Bottas 退賽 · 第 1 彎\n醫療車 · 暫停 39 分鐘');
  assert.equal(all.find(e => e.kind === 'vsc').text, '虛擬安全車 · 2 車退賽');
  assert.equal(all.find(e => e.kind === 'vsc').sub, 'Alonso、Stroll · 第 6 彎\n至第 8 圈');
  assert.ok(all.some(e => e.kind === 'climb' && e.text === 'Verstappen 升到領先' && e.sub === '第 5 → 第 1 · 第 29–44 圈'), all.map(e => e.text).join(' / '));
  assert.ok(all.some(e => e.kind === 'lead' && e.text === 'Verstappen 接手領先' && e.sub === 'Antonelli 進站'));
  // (Every line fits a phone's one line at 320, Jay: the whole race and every driver's, both languages.)
  for (const en of [false, true])
    for (const pick of [null, ...Object.keys(d.names)])
      for (const e of raceStory(d, { nameOf: name, pick, en })) {
        assert.ok(ems(e.text) <= STORY_FIT.main, `${pick} ${e.text}`);
        for (const line of e.sub.split('\n')) assert.ok(ems(line) <= STORY_FIT.sub, `${pick} ${e.text}: ${line}`);
      }
  // (Many names: how many in the line, as many as fit under it.)
  const perez = raceStory(d, { nameOf: name, pick: '11' }).find(e => e.kind === 'pass' && e.lap === 47);
  assert.equal(perez.text, '超越 5 車');
  assert.equal(perez.sub, 'Hadjar、Hulkenberg 等\n第 18 → 第 14');
  // (A steward's penalty in English, short and plain.)
  assert.deepEqual(raceStory(d, { nameOf: name, en: true }).filter(e => e.kind === 'penalty').map(e => `${e.text} [${e.sub}]`).slice(0, 2), ['Leclerc: 5 s penalty [Off-track advantage]', 'Russell: 10 s penalty [Caused a collision]']);
  // (Leclerc winning back what his own stop cost isn't a climb.)
  assert.ok(!all.some(e => e.kind === 'climb' && e.text.startsWith('Leclerc')));
  const ver = raceStory(d, { nameOf: name, pick: '3' });
  assert.ok(ver.some(e => e.kind === 'pit' && e.text === '紅旗暫停時換上軟胎'), ver.map(e => e.text).join(' / '));
  assert.ok(!ver.some(e => /\d{3,}\.\d 秒/.test(e.sub)), 'no pit-lane time from the red flag');
  assert.equal(ver.at(-1).text, '完賽第 1');
});
