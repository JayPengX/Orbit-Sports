import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldPlays, tripZh, tripEn } from '../public/lib/plays.mjs';
import { feedText } from '../public/lib/moments.mjs';

// The Lakers–Pistons ending (ESPN 401909946, 2026-11-08) as the feed has it.
const LAL = '13';
const DET = '8';
let n = 0;
const play = (clock, team, type, who, text, score, extra = {}) => ({ id: String(++n), periodNum: 4, clock, team, type, who, pic: who ? { id: who } : null, text, away: score[0], home: score[1], scoring: /makes/.test(text), ...extra });
const feed = [
  play('2:15', LAL, 'Layup Shot Putback', 'W. Kessler', 'Walker Kessler makes two point shot', [106, 99], { value: 2 }),
  play('2:15', DET, 'Shooting Foul', 'P. Reed', 'Paul Reed shooting foul', [106, 99]),
  play('2:15', LAL, 'Free Throw - 1 of 1', 'W. Kessler', 'Walker Kessler makes free throw 1 of 1', [107, 99]),
  play('1:13', LAL, 'Shooting Foul', 'W. Kessler', 'Walker Kessler shooting foul', [109, 102]),
  play('1:13', DET, 'Free Throw - 1 of 2', 'P. Reed', 'Paul Reed misses free throw 1 of 2', [109, 102]),
  play('1:13', DET, 'Offensive Rebound', '', 'Pistons offensive team rebound', [109, 102]),
  play('1:13', DET, 'Free Throw - 2 of 2', 'P. Reed', 'Paul Reed misses free throw 2 of 2', [109, 102]),
  play('1:13', DET, 'Substitution', 'A. Thompson', 'Ausar Thompson enters the game for Duncan Robinson', [109, 102]),
  play('1:13', LAL, 'Defensive Rebound', 'W. Kessler', 'Walker Kessler defensive rebound', [109, 102]),
  play('1:06', DET, 'Full Timeout', '', 'Pistons Full timeout', [109, 104]),
  play('1:06', DET, "Coach's Challenge (Stands)", '', "(01:06) [Pistons] COACH'S CHALLENGE (CALL STANDS) [Pistons] charged with a timeout", [109, 104]),
  play('26.3', LAL, 'Shooting Foul', 'C. Sexton', 'Collin Sexton shooting foul', [114, 107]),
  play('26.3', DET, 'Free Throw - 1 of 3', 'D. Jenkins', 'Daniss Jenkins makes free throw 1 of 3', [114, 108]),
  play('26.3', DET, 'Free Throw - 2 of 3', 'D. Jenkins', 'Daniss Jenkins makes free throw 2 of 3', [114, 109]),
  play('26.3', DET, 'Free Throw - 3 of 3', 'D. Jenkins', 'Daniss Jenkins makes free throw 3 of 3', [114, 110]),
  play('26.3', DET, 'Substitution', 'A. Thompson', 'Ausar Thompson enters the game for Duncan Robinson', [114, 110]),
  play('26.3', LAL, 'Substitution', 'J. Vanderbilt', 'Jarred Vanderbilt enters the game for Matisse Thybulle', [114, 110]),
  play('26.3', LAL, 'Substitution', 'W. Kessler', 'Walker Kessler enters the game for Collin Sexton', [114, 110]),
  play('26.3', LAL, 'Full Timeout', '', 'Lakers Full timeout', [114, 110]),
  play('26.3', LAL, 'Substitution', 'C. Sexton', 'Collin Sexton enters the game for Jarred Vanderbilt', [114, 110]),
  play('8.7', DET, 'Personal Foul', 'D. Jenkins', 'Daniss Jenkins personal foul', [118, 114]),
  play('8.7', LAL, 'Free Throw - 1 of 2', 'Z. Williams', 'Ziaire Williams makes free throw 1 of 2', [119, 114]),
  play('8.7', LAL, 'Free Throw - 2 of 2', 'Z. Williams', 'Ziaire Williams misses free throw 2 of 2', [119, 114]),
  play('8.7', DET, 'Defensive Rebound', 'K. Huerter', 'Kevin Huerter defensive rebound', [119, 114]),
  play('0.0', '', 'End Period', '', 'End of the 4th Quarter', [121, 116]),
  play('0.0', '', 'End Game', '', 'End of Game', [121, 116])
];
const zh = p => feedText('basketball', p, false, p.team === LAL ? '湖人' : p.team === DET ? '活塞' : '');

test("a close game's end reads by stoppage: a trip one row, its foul under it, the changes one row", () => {
  const out = foldPlays(feed);
  assert.deepEqual(out.map(zh), [
    'W. Kessler 上籃命中，加罰命中（P. Reed 犯規）',
    'P. Reed 兩罰不中（W. Kessler 犯規）',
    'A. Thompson 上場',
    'W. Kessler 防守籃板',
    '活塞 教練挑戰（維持原判）',
    'D. Jenkins 三罰全中（C. Sexton 犯規）',
    '雙方換人（A. Thompson、J. Vanderbilt、W. Kessler 等 4 人 上場）',
    '湖人 暫停',
    'Z. Williams 兩罰一中（D. Jenkins 犯規）',
    'K. Huerter 防守籃板',
    '比賽結束'
  ]);
  // The score after the trip's last shot; every id it stands for kept (the chart's key moments are marked by id).
  const trip = out.find(p => p.ft?.of === 3);
  assert.deepEqual([trip.away, trip.home, trip.scoring, trip.value], [114, 110, true, 3]);
  assert.equal(trip.ids.length, 4);
  const andOne = out[0];
  assert.deepEqual([andOne.away, andOne.value, andOne.ids.length], [107, 3, 3]);
  // (Nothing changed in place: the feed itself is as ESPN gave it.)
  assert.equal(feed.length, 26);
  assert.equal(feed[2].text, 'Walker Kessler makes free throw 1 of 1');
});

test('a trip in English, and one still being shot', () => {
  const out = foldPlays(feed);
  assert.equal(feedText('basketball', out[1], true, 'Pistons'), 'P. Reed free throws 0/2 (W. Kessler foul)');
  assert.equal(feedText('basketball', out[0], true, 'Lakers'), 'W. Kessler layup, and-one (P. Reed foul)');
  // Live: the first of two in, the second not yet shot.
  const half = foldPlays(feed.slice(20, 22));
  assert.equal(half.length, 1);
  assert.equal(zh(half[0]), 'Z. Williams 兩罰 已一罰命中（D. Jenkins 犯規）');
  assert.equal(tripZh({ made: 2, tries: 3, of: 3 }), '三罰兩中');
  assert.equal(tripZh({ made: 1, tries: 1, of: 1, tech: true }), '技術罰球命中');
  assert.equal(tripEn({ made: 1, tries: 1, of: 2 }), 'free throws 1/1 of 2');
});

test('a lone free throw with no foul to say stays as it was; plays at different clocks never fold', () => {
  const lone = [play('5:00', LAL, 'Free Throw - 1 of 1', 'A. Reaves', 'Austin Reaves makes technical free throw 1 of 1', [1, 0])];
  assert.deepEqual(foldPlays(lone), lone);
  const apart = [feed[4], { ...feed[6], clock: '1:12' }];
  assert.equal(foldPlays(apart).length, 2);
});

test('a game on at a glance: the run on now, a side without a field goal, lead changes', async () => {
  const { liveState, playedAt } = await import('../public/lib/plays.mjs');
  assert.equal(playedAt({ periodNum: 2, clock: '6:00' }), 720 + 360);
  assert.equal(playedAt({ periodNum: 5, clock: '1:00' }), 4 * 720 + 240);
  const H = 'h';
  const A = 'a';
  let [h, a] = [0, 0];
  const s = (clock, team, pts, type = 'Jump Shot') => ((team === H ? (h += pts) : (a += pts)), { periodNum: 3, clock, team, type, text: '', scoring: true, home: h, away: a });
  const feed = [s('9:00', A, 2), s('8:40', H, 3), s('8:00', A, 3), s('7:30', H, 2), s('7:10', H, 2), s('6:30', A, 1, 'Free Throw - 1 of 2'), s('6:00', H, 3), s('5:20', H, 2)];
  const now = liveState(feed, H, A);
  // From 8:40 on: the home side 12 to 4, its last score the latest (the longest such stretch); the away side no field goal since 8:00 (2:40).
  assert.deepEqual([now.run.team, now.run.mine, now.run.theirs], [H, 12, 4]);
  assert.equal(now.drought, null);
  const later = liveState([...feed, { periodNum: 3, clock: '4:59', team: A, home: h, away: a, text: 'misses', type: 'Jump Shot' }], H, A);
  assert.deepEqual([later.drought.team, later.drought.secs], [A, 181]);
  // The lead: away, home, away, home: three changes.
  assert.equal(now.changes, 3);
  // The other side scored last: the run is over.
  assert.equal(liveState([...feed, s('5:00', A, 2)], H, A).run, null);
});
