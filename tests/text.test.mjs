// Text every view shares: names compared (lib/text.mjs), feed text made
// safe for a line drawn as HTML, a score's dash, and a game's time as every
// list says it (ui.js scoreText, timeText, whenOf, statusText).
process.env.TZ = 'Asia/Taipei';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fold, esc, surname } from '../public/lib/text.mjs';
import { scoreText, timeText, whenOf, statusText, shownStart, mmss, localDate, ctx } from '../public/ui.js';
import { makeT } from '../public/lib/i18n.mjs';

test('names compared plainly: accents, case and the edges aside', () => {
  assert.equal(fold('Sergio Pérez'), 'sergio perez');
  assert.equal(fold('  Nico HÜLKENBERG '), 'nico hulkenberg');
  assert.equal(fold('Kimi Antonelli'), fold('kimi antonelli'));
  assert.equal(fold(null), '');
  assert.equal(fold(0), '0');
  assert.equal(surname('Carlos Sainz Jr.'), 'sainz');
  assert.equal(surname('Bobby Witt Jr'), 'witt');
  assert.equal(surname('Gabriel Bortoleto'), 'bortoleto');
  assert.equal(surname(''), '');
});

test('feed text in a line drawn as HTML is shown as written, never read as markup', () => {
  assert.equal(esc('Brighton & Hove Albion'), 'Brighton &amp; Hove Albion');
  assert.equal(esc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(esc(`"O'Brien"`), '&quot;O&#39;Brien&quot;');
  assert.equal(esc(undefined), '');
  assert.equal(esc(12), '12');
});

test('a score with none yet is a dash, never a 0; a 0 is a 0', () => {
  assert.equal(scoreText(''), '–');
  assert.equal(scoreText(null), '–');
  assert.equal(scoreText(undefined), '–');
  assert.equal(scoreText('  '), '–');
  assert.equal(scoreText('0'), '0');
  assert.equal(scoreText(0), '0');
  assert.equal(scoreText('112'), '112');
});

test('a game’s time: 待定 while its hour isn’t set (never the stand-in’s clock), an F1 session’s official start', () => {
  ctx.locale = 'zh';
  ctx.t = makeT('zh');
  const at = new Date(Date.now() + 86_400_000 * 3);
  at.setHours(8, 0, 0, 0);
  const tbd = { kind: 'match', start: at.toISOString(), timeTbd: true, status: { state: 'pre' } };
  assert.equal(timeText(tbd), '待定');
  assert.match(whenOf(tbd), /待定$/);
  assert.doesNotMatch(whenOf(tbd), /08:00/);
  assert.doesNotMatch(statusText(tbd), /08:00/, 'the row’s status says 待定 too');
  // Today's: the time alone.
  const today = new Date();
  today.setHours(23, 30, 0, 0);
  assert.equal(whenOf({ start: today.toISOString(), status: { state: 'pre' } }), '23:30');
  // An F1 session: its titles at 16:26, the schedule says 16:30.
  const official = new Date(Date.now() + 86_400_000 * 2);
  official.setHours(16, 30, 0, 0);
  const session = { kind: 'field', start: new Date(official.getTime() - 4 * 60_000).toISOString(), official: official.toISOString(), status: { state: 'pre' } };
  assert.equal(shownStart(session), session.official);
  assert.match(whenOf(session), / 16:30$/);
  assert.equal(localDate(Date.parse('2026-10-11T16:30Z')), '2026-10-12', 'Taiwan’s day');
  ctx.locale = 'en';
  ctx.t = makeT('en');
  assert.equal(timeText(tbd), 'TBD');
  ctx.locale = 'zh';
});

test('a clock’s minutes and seconds', () => {
  assert.deepEqual([mmss(0), mmss(59.9), mmss(60), mmss(725), mmss(3600)], ['0:00', '0:59', '1:00', '12:05', '60:00']);
});
