import { test } from 'node:test';
import assert from 'node:assert/strict';
import { injuryFacts, sentences } from '../public/lib/injurynote.mjs';

const ZH = { Rockets: '火箭', Spurs: '馬刺', Minnesota: '灰狼', Lakers: '湖人', Phoenix: '太陽', Washington: '巫師', Magic: '魔術' };
const team = w => ZH[w] || null;
const facts = (note, date, lang = 'zh', today = '2026-11-12') => injuryFacts(note, { date, lang, team, today }).map(f => (f.day ? `${f.day} ` : '') + f.text);

test("Jay's 11-12 card: Curry left Wednesday's game (our Thursday morning) against the Rockets; no reporter, no box score, never 不會參加", () => {
  const note = "Curry won't return to Wednesday's game against the Rockets due to right abdominal soreness, Anthony Slater of ESPN.com reports. He'll finish with three points (1-3 FG, 1-2 3Pt) across six minutes.";
  assert.deepEqual(facts(note, '2026-11-12T03:19Z'), ['2026-11-12 對火箭 因傷退場']);
  assert.deepEqual(facts(note, '2026-11-12T03:19Z', 'en'), ['2026-11-12 Left the game vs Rockets']);
});

test('a game ahead: out, questionable, probable, as soon as; the American weekday is the next morning here', () => {
  assert.deepEqual(facts("Lively (foot) is listed as out for Thursday's game in Minnesota.", '2026-11-11T22:13Z'), ['2026-11-13 對灰狼 不出賽']);
  assert.deepEqual(facts("James (back) is questionable for Thursday's game against the Raptors, Kyle Neubeck of AllPHLY.com reports.", '2026-11-11T20:00Z'), ['2026-11-13 出賽存疑']);
  assert.deepEqual(facts("Diabate (quadriceps) is listed as probable for Thursday's game against the Suns.", '2026-11-11T20:00Z', 'en'), ['2026-11-13 Probable vs Suns']);
  assert.deepEqual(facts("Head coach Ime Udoka said Monday that Adams could return as soon as Sunday's game at Washington, Lachard Binkley of SI.com reports.", '2026-11-10T01:00Z'), ['2026-11-16 對巫師 最快回歸']);
});

test('a game gone by: said as gone by, a question about it left out', () => {
  assert.deepEqual(facts("Newell (toe) has been ruled out for Monday's game against the Lakers.", '2026-11-09T20:00Z'), ['2026-11-10 對湖人 未出賽']);
  assert.deepEqual(facts("James (back) is questionable for Monday's game against the Raptors.", '2026-11-09T20:00Z'), []);
  // ESPN dates a note when it last touched the player: Tuesday's game said on a Wednesday is the one gone by.
  assert.deepEqual(facts("Christie (ankle) is listed as out for Tuesday's game against Phoenix.", '2026-11-11T20:00Z'), ['2026-11-11 對太陽 未出賽']);
  assert.deepEqual(facts("Achiuwa left Tuesday's 107-100 loss to the Magic with a left lower leg contusion and did not return, Matt George of ABC 10 Sacramento reports.", '2026-11-11T05:00Z'), ['2026-11-11 對魔術 因傷退場']);
});

test('surgery, how long, re-evaluated, diagnosis: from the fixed words, the place first', () => {
  assert.deepEqual(facts('Krejci underwent surgery on his fractured left ankle Wednesday and will be re-evaluated in eight weeks, Brett Siegel of ClutchPoints.com reports.', '2026-11-11T20:00Z'), ['已動手術', '8 週後再評估']);
  assert.deepEqual(facts('Jackson has been diagnosed with a torn MCL in his right knee and will be sidelined for 6-to-8 weeks, per Shams Charania of ESPN.', '2026-11-11T20:00Z'), ['診斷：右膝蓋內側副韌帶撕裂', '預計缺陣 6 到 8 週']);
  assert.deepEqual(facts('Markkanen has been diagnosed with a non-displaced fracture in his right hand and will be sidelined for at least one month, Shams Charania of ESPN reports.', '2026-11-11T20:00Z'), ['診斷：右手骨折', '至少缺陣一個月']);
  assert.deepEqual(facts('Greene (elbow) will be out for 12-to-18 months after undergoing his second Tommy John surgery Wednesday, Gordon Wittenmyer of The Cincinnati Enquirer reports.', '2026-11-11T20:00Z'), ['已動韌帶重建手術', '預計缺陣 12 到 18 個月']);
  assert.deepEqual(facts('Anthony (finger) will be re-evaluated in a couple weeks, at which point he is likely to begin a range-of-motion program.', '2026-11-11T20:00Z'), ['數週後再評估']);
  assert.deepEqual(facts('Moody (knee) is progressing toward a potential return between December and January after rupturing his left patellar tendon in March, Anthony Slater of ESPN reports.', '2026-11-11T20:00Z'), ['預計 12 月到 1 月回歸']);
  // A place the list hasn't: no bare 右傷勢.
  assert.deepEqual(facts('The Wizards announced Monday that Beekman sustained a right acromioclavicular joint injury and will be re-evaluated in approximately three weeks.', '2026-11-11T20:00Z'), ['3 週後再評估']);
});

test("baseball's injured list, throwing again; whatever isn't his health is left out", () => {
  assert.deepEqual(facts('The Blue Jays transferred Berrios (elbow) from the 15-day injured list to the 60-day IL on Wednesday.', '2026-11-11T20:00Z'), ['移至 60 天傷兵名單']);
  assert.deepEqual(facts('Saalfrank (shoulder) has begun a throwing program, Alex Weiner of Arizona Sports reports.', '2026-11-11T20:00Z'), ['已開始投球']);
  assert.deepEqual(facts('Brown (shoulder) had been scheduled to throw a live bullpen session this weekend, MLB.com reports.', '2026-11-11T20:00Z'), []);
  assert.deepEqual(facts('Helsley (elbow) will exercise his $14 million player option for 2027, Andy Kostka of TheBanner.com reports.', '2026-11-11T20:00Z'), []);
  assert.deepEqual(facts('Carroll went 1-for-4 with a triple and two RBI in Wednesday\'s 5-3 win over Colorado.', '2026-11-11T20:00Z'), []);
  assert.deepEqual(facts('no', '2026-11-11T20:00Z'), []);
});

test('sentences: an abbreviation is no end, the reporter is cut', () => {
  assert.deepEqual(sentences('Nurkic (toe) got hurt in an Oct. 4 game against Denver. He will be re-evaluated in two weeks, the Jazz announced Friday.'), ['Nurkic (toe) got hurt in an Oct. 4 game against Denver', 'He will be re-evaluated in two weeks']);
});

test("back: ESPN's American day is the next day here (Curry's 11/13 was 明天 on the 12th; his Friday game is our Saturday)", async () => {
  const { backDay } = await import('../public/lib/injurynote.mjs');
  assert.equal(backDay('2026-11-13'), '2026-11-14');
  assert.equal(backDay('2026-11-13T00:00:00.000+00:00'), '2026-11-14');
  assert.equal(backDay('2026-11-13T18:00Z'), '2026-11-14');
  assert.equal(backDay(''), '');
});
