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

test("F1 stories: teams by the app's names, drivers kept in English through the translator", async () => {
  const { namedZh } = await import('../public/lib/f1names.mjs');
  const one = namedZh("Max Verstappen won from pole; Russell's Mercedes retired");
  assert.equal(one.text, "⟦1⟧ won from pole; ⟦0⟧'s 賓士 retired");
  // What the translator gives back: the names in English again, a space beside Chinese, none after punctuation.
  assert.equal(one.back('⟦1⟧ 贏得桿位； ⟦0⟧的賓士退賽了'), 'Max Verstappen 贏得桿位；Russell 的賓士退賽了');
  assert.equal(one.back('賓士更換動力單位後，⟦0⟧將從後排發車。'), '賓士更換動力單位後，Russell 將從後排發車。');
  const two = namedZh('Carlos Sainz Jr. and Nico Hülkenberg for Red Bull Racing');
  assert.equal(two.back(two.text), 'Carlos Sainz Jr. and Nico Hulkenberg for 紅牛');
  const three = namedZh('Kimi Antonelli, Andrea Kimi Antonelli');
  assert.equal(three.back(three.text), 'Kimi Antonelli, Andrea Kimi Antonelli');
  // An ordinary word that happens to be a name in lower case stays.
  assert.equal(namedZh('a stroll in the park').text, 'a stroll in the park');
});

test("最新動態 only from a story about them: their name in the headline, not a schedule, odds or preview that tags them", async () => {
  const { storyAbout } = await import('../public/lib/espn.mjs');
  assert.equal(storyAbout({ headline: '2026 Singapore Grand Prix: Race start times, how to watch, full schedule, predictions' }, 'Max Verstappen'), false);
  assert.equal(storyAbout({ headline: 'Malaysia-Bahrain GP result: Max Verstappen wins after chaos' }, 'Max Verstappen'), true);
  assert.equal(storyAbout({ headline: "Russell's F1 engine nightmare to continue with grid penalty" }, 'George Russell'), true);
  assert.equal(storyAbout({ headline: 'Updates on the biggest remaining NBA free agents' }, 'Russell Westbrook'), false);
  assert.equal(storyAbout({ headline: 'Westbrook announces NBA retirement after 18 seasons' }, 'Russell Westbrook'), true);
  assert.equal(storyAbout({ headline: 'Westbrook: Russ will be remembered', video: true }, 'Russell Westbrook'), false, 'a video: its summary is its headline');
  assert.equal(storyAbout({ headline: 'Jaren Jackson Jr. out with ankle injury' }, 'Jaren Jackson Jr.'), true);
  assert.equal(storyAbout({ headline: 'NBA fantasy: Westbrook a sleeper pick' }, 'Russell Westbrook'), false);
});

test("a team's 最新動態: a story about the club, not its games", async () => {
  const { storyAboutTeam } = await import('../public/lib/espn.mjs');
  const city = { en: 'Manchester City', enShort: 'Man City', sport: 'soccer' };
  assert.equal(storyAboutTeam({ headline: "Man City's 115 charges: verdict expected this month" }, city), true);
  assert.equal(storyAboutTeam({ headline: 'Arsenal vs. Man City: how to watch, odds' }, city), false);
  assert.equal(storyAboutTeam({ headline: 'Manchester City player ratings vs Brentford' }, city), false);
  assert.equal(storyAboutTeam({ headline: 'Haaland scores twice as Man City beat Brentford' }, city), false);
  assert.equal(storyAboutTeam({ headline: 'Premier League title race: who can stop Arsenal?' }, city), false);
  assert.equal(storyAboutTeam({ headline: 'Lakers sign veteran guard to one-year deal' }, { en: 'Los Angeles Lakers', sport: 'basketball' }), true);
  assert.equal(storyAboutTeam({ headline: 'City set to appeal' }, city), false, "'City' alone is too many clubs");
});
