// ESPN's news: who each story is about, and a team's, a player's or a driver's stories.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNews, newsAbout } from '../public/lib/espn.mjs';

const story = (id, at, cats, extra = {}) => ({ id, type: 'Story', headline: `H${id}`, description: `D${id}`, published: at, images: [{ url: `https://a/${id}.jpg` }], links: { web: { href: `https://espn/${id}` } }, categories: cats, ...extra });
const feed = {
  articles: [
    story(1, '2026-10-05T09:00:00Z', [{ type: 'athlete', athleteId: 4665, description: 'Max Verstappen' }, { type: 'team', teamId: 106921, description: 'Red Bull' }]),
    story(2, '2026-10-06T10:38:08Z', [{ type: 'athlete', athleteId: 5503, description: 'George Russell' }, { type: 'league', description: 'Formula One' }]),
    story(3, '2026-10-05T12:00:00Z', [{ type: 'league', description: 'Formula One' }]),
    story(4, '2026-10-05T15:00:00Z', [{ type: 'team', teamId: 99, description: 'Ferrari' }]),
    { id: 5, headline: 'no link' }
  ]
};

test("a story's people, latest first; one without a link left out", () => {
  const list = parseNews(feed);
  assert.deepEqual(list.map(s => s.id), ['2', '4', '3', '1']);
  assert.deepEqual(list[0].athletes, ['5503']);
  assert.equal(list[0].url, 'https://espn/2');
  assert.equal(list[0].image, 'https://a/2.jpg');
  assert.deepEqual(list[3].teams, [{ id: '106921', name: 'Red Bull' }]);
  assert.deepEqual(parseNews(null), []);
});

test("a driver's, a team's and a constructor's stories, each once", () => {
  const list = parseNews(feed);
  assert.deepEqual(newsAbout([list], { athletes: ['5503'] }).map(s => s.headline), ['H2'], "Russell's grid penalty");
  assert.deepEqual(newsAbout([list, list], { team: '106921' }).map(s => s.id), ['1'], 'each once');
  assert.deepEqual(newsAbout([list], { athletes: ['4665'], named: n => n === 'Ferrari' }).map(s => s.id), ['4', '1']);
  assert.deepEqual(newsAbout([list], {}), [], 'about no one: nothing');
});

test("F1's drivers and teams by the app's names, whoever a story is tagged with", async () => {
  const { namedZh } = await import('../public/lib/f1names.mjs');
  assert.equal(namedZh('George Russell: Bahrain Grand Prix was another failure'), '羅素: Bahrain Grand Prix was another failure');
  assert.equal(namedZh("Max Verstappen won from pole; Russell's Mercedes retired"), '維斯塔潘 won from pole; 羅素的 賓士 retired');
  assert.equal(namedZh('Carlos Sainz Jr. and Nico Hülkenberg for Red Bull Racing'), '塞恩斯 and 霍肯伯格 for 紅牛');
  assert.equal(namedZh('Kimi Antonelli, Andrea Kimi Antonelli'), '安東內利, 安東內利');
  // An ordinary word that happens to be a name in lower case stays.
  assert.equal(namedZh('a stroll in the park'), 'a stroll in the park');
});
