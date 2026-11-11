// 問比賽 (the family's AI plan, Jay 11-10; code first): a question about
// the teams and leagues you follow ("湖人排第幾", "這週有誰比賽", "道奇最近
// 怎樣"). The phone lays out what it already read into tables (lib/ask.mjs
// askTables: my teams' places, their next and last games, each followed
// league's table, today's games of yours); the Worker's AI (sports-ask) only
// picks the tables that answer and writes one line, each number one of
// theirs. The app draws them with each team's logo (the kit's aiAnswer).

const DAY = 86_400_000;
const tw = t => new Date(t + 8 * 3_600_000);
const md = t => `${tw(t).getUTCMonth() + 1}/${tw(t).getUTCDate()}`;
const hm = t => tw(t).toISOString().slice(11, 16);
const WEEK_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_ZH = ['日', '一', '二', '三', '四', '五', '六'];
const when = (t, en) => `${md(t)}（${(en ? WEEK_EN : WEEK_ZH)[tw(t).getUTCDay()]}）${hm(t)}`.replace(/（(\w+)）/, en ? ' $1 ' : '（$1）');

// The other side of a game, and whether `id` is at home.
const sides = (e, id) => {
  const home = String(e.home?.id) === String(id);
  return { us: home ? e.home : e.away, them: home ? e.away : e.home, home };
};
const num = v => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));

// The tables: { id: { title, rows: [{ label, sub, value, logo, key }] } }, in order.
// teams: [{ league, id, name, logo, pos, n, group, leagueName, games }]; standings: { key: { league, name, title, rows } };
// today: the day's games of the followed leagues; nameOf(league, side) a side's name as the app shows it.
export function askTables({ teams = [], standings = {}, today = [], now = Date.now(), en = false, nameOf = (l, s) => s?.short || s?.name || '' } = {}) {
  const W = (zh, e) => (en ? e : zh);
  const t = {};
  const put = (id, title, rows) => rows.length && (t[id] = { title, rows });
  // 我的球隊: each team's place.
  put(
    'mine',
    W('我的球隊排名', 'My teams in the table'),
    teams.filter(x => x.pos).map(x => ({ key: `${x.league}:${x.id}`, label: x.name, logo: x.logo, sub: [x.leagueName, x.group].filter(Boolean).join(' · '), value: W(`第 ${x.pos} 名`, `#${x.pos}`), pos: x.pos, of: x.n || null }))
  );
  // Their next game each, soonest first; and the last one each, newest first.
  const nextOf = x => (x.games || []).filter(e => e.status?.state === 'pre' && Date.parse(e.start) > now).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
  const lastOf = x => (x.games || []).filter(e => e.status?.state === 'post').sort((a, b) => Date.parse(b.start) - Date.parse(a.start))[0];
  put(
    'next',
    W('我的球隊下一場', 'My teams next'),
    teams
      .map(x => [x, nextOf(x)])
      .filter(([, e]) => e)
      .sort((a, b) => Date.parse(a[1].start) - Date.parse(b[1].start))
      .map(([x, e]) => {
        const { them, home } = sides(e, x.id);
        return { key: `${x.league}:${x.id}`, label: `${x.name} ${home ? 'vs' : '@'} ${nameOf(x.league, them)}`, logo: x.logo, sub: when(Date.parse(e.start), en), value: '', at: Date.parse(e.start) };
      })
  );
  put(
    'last',
    W('我的球隊上一場', 'My teams last time'),
    teams
      .map(x => [x, lastOf(x)])
      .filter(([, e]) => e)
      .sort((a, b) => Date.parse(b[1].start) - Date.parse(a[1].start))
      .map(([x, e]) => {
        const { us, them, home } = sides(e, x.id);
        const a = num(us?.score), b = num(them?.score);
        const won = us?.winner === true || (a != null && b != null && a > b) ? 'W' : them?.winner === true || (a != null && b != null && a < b) ? 'L' : a != null && a === b ? 'D' : '';
        const res = won ? W({ W: '勝', L: '負', D: '和' }[won], won) : '';
        return { key: `${x.league}:${x.id}`, label: `${x.name} ${home ? 'vs' : '@'} ${nameOf(x.league, them)}`, logo: x.logo, sub: md(Date.parse(e.start)), value: a != null && b != null ? `${a}–${b}${res ? ` ${res}` : ''}` : res, won };
      })
  );
  // Each followed league's table: its first eight, and any of mine below them.
  const mineIds = new Set(teams.map(x => `${x.league}:${x.id}`));
  for (const [key, s] of Object.entries(standings)) {
    const league = s.league || key;
    const rows = s.rows || [];
    const keep = rows.filter((r, i) => i < 8 || mineIds.has(`${league}:${r.id}`));
    put(
      `table.${key}`,
      s.title || W(`${s.name} 排名`, `${s.name} table`),
      keep.map(r => ({ key: `${league}:${r.id}`, label: nameOf(league, r), logo: r.logo, sub: r.record || '', value: W(`第 ${rows.indexOf(r) + 1} 名`, `#${rows.indexOf(r) + 1}`), pos: rows.indexOf(r) + 1, mine: mineIds.has(`${league}:${r.id}`) }))
    );
  }
  // Today's games of the followed leagues.
  put(
    'today',
    W('今天我的聯賽', 'Today in my leagues'),
    today
      .slice()
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .slice(0, 12)
      .map(e => {
        const state = e.status?.state;
        const score = state !== 'pre' && e.away?.score !== '' && e.home?.score !== '' ? `${e.away?.score}–${e.home?.score}` : '';
        return { key: `${e.league}:${e.id}`, label: `${nameOf(e.league, e.away)} @ ${nameOf(e.league, e.home)}`, logo: e.home?.logo || '', logos: [e.away?.logo, e.home?.logo], sub: state === 'in' ? W('進行中', 'Live') : state === 'post' ? W('已結束', 'Final') : hm(Date.parse(e.start)), value: score, game: e.id, league: e.league };
      })
  );
  return t;
}

// What the AI is told: a line a table, its id first, each row once.
export function askFacts(tables, { en = false, now = Date.now() } = {}) {
  const out = [`Today: ${md(now)} (Taiwan).`];
  for (const [id, x] of Object.entries(tables)) out.push(`[${id}] ${x.title}: ${x.rows.map(r => [r.label, r.sub, r.value].filter(Boolean).join(', ')).join('; ')}`);
  return out.join('\n').slice(0, 5000);
}
