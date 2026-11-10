import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewLine, runOf } from '../public/lib/preview.mjs';

const place = (pos, W, L, extra = {}) => ({ pos, n: 15, group: 'West', row: { stats: { W, L, ...extra } }, lead: {} });
const form = s => [...s].map(result => ({ result }));

test('the top two, close: 龍頭之爭 and the gap between them', () => {
  assert.equal(previewLine({ sport: 'basketball', places: [place(2, 10, 4), place(1, 11, 3)], forms: [form('WWWW'), form('LWL')], names: ['湖人', '勇士'] }), '第 1 對第 2 的龍頭之爭，只差 1 場');
  assert.equal(previewLine({ sport: 'soccer', places: [place(4, 0, 0, { P: 20 }), place(5, 0, 0, { P: 20 })], forms: [form('WDL'), form('LLLLLL')], names: ['A', 'B'], en: true }), '4th v 5th in the table, level · B lost 6 straight');
});

test('places apart, wins close: the race the table hides (8-2 against 6-3)', () => {
  assert.equal(previewLine({ sport: 'basketball', places: [place(3, 8, 2), place(8, 6, 3)], forms: [form('LWWWW'), form('WWWLL')], names: ['雷霆', '拓荒者'] }), '排名第 3 對第 8，只差 1.5 場');
});

test('nothing notable, nothing said: far apart, another group, a short run, the table already saying it', () => {
  assert.equal(previewLine({ sport: 'basketball', places: [place(1, 12, 2), place(9, 6, 8)], forms: [form('WW'), form('LWL')], names: ['A', 'B'] }), '');
  assert.equal(previewLine({ sport: 'basketball', places: [place(1, 12, 2), { ...place(2, 11, 3), group: 'East' }], forms: [], names: [] }), '');
  assert.equal(previewLine({ sport: 'basketball', places: [place(12, 4, 10), place(13, 3, 11)], forms: [], names: [] }), '', 'the bottom of the table is no race');
  assert.equal(previewLine({ sport: 'baseball', places: [place(3, 20, 10), place(4, 14, 16)], forms: [form('WWWWWWW')], names: ['A'] }), '', 'a run the 連勝敗 row shows');
  assert.equal(runOf(form('WLWD')), null);
});
