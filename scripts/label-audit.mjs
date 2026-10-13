// Every stat label a player's page and a game's box score can show (ESPN's, a few players of two teams in each league), and any with no Chinese: node scripts/label-audit.mjs (2026-10-13: 111, now 0).
import { statName } from '../public/lib/statnames.mjs';
const LEAGUES = { nba: 'basketball/nba', wnba: 'basketball/wnba', mlb: 'baseball/mlb', nhl: 'hockey/nhl', nfl: 'football/nfl', epl: 'soccer/eng.1', laliga: 'soccer/esp.1', mls: 'soccer/usa.1', ucl: 'soccer/uefa.champions' };
const j = async u => { try { const r = await fetch(u); return r.ok ? r.json() : null; } catch { return null; } };
const missing = new Map();
const SPORT = { nba: 'basketball', wnba: 'basketball', mlb: 'baseball', nhl: 'hockey', nfl: 'football', epl: 'soccer', laliga: 'soccer', mls: 'soccer', ucl: 'soccer' };
const note = (league, where, label, long) => {
  if (!label) return;
  const zh = statName(label, 'zh', { sport: SPORT[league], long });
  const viaLong = long ? statName(long, 'zh') : null;
  if (zh === label && /[A-Za-z]/.test(label)) {
    const k = `${league}|${label}`;
    if (!missing.has(k)) missing.set(k, { league, label, long: long || '', where, longZh: viaLong !== long ? viaLong : '' });
  }
};
for (const [lg, path] of Object.entries(LEAGUES)) {
  const teams = (await j(`https://site.api.espn.com/apis/site/v2/sports/${path}/teams`))?.sports?.[0]?.leagues?.[0]?.teams?.slice(0, 2) || [];
  for (const t of teams) {
    const ro = await j(`https://site.api.espn.com/apis/site/v2/sports/${path}/teams/${t.team.id}/roster`);
    const people = (ro?.athletes || []).flatMap(a => (a.items ? a.items : [a])).filter((_, i, all) => i % Math.max(1, Math.floor(all.length / 8)) === 0).slice(0, 8);
    for (const p of people) {
      const a = await j(`https://site.web.api.espn.com/apis/common/v3/sports/${path}/athletes/${p.id}`);
      for (const s of a?.athlete?.statsSummary?.statistics || []) note(lg, 'key numbers', s.shortDisplayName || s.abbreviation, s.displayName);
      const ov = await j(`https://site.web.api.espn.com/apis/common/v3/sports/${path}/athletes/${p.id}/overview`);
      (ov?.statistics?.labels || []).forEach((l, i) => note(lg, 'season table', l, ov.statistics.displayNames?.[i] || ov.statistics.names?.[i]));
      for (const c of ov?.seasonRankings?.categories || []) note(lg, 'rankings', c.shortDisplayName || c.displayName, c.displayName);
      for (const st of ov?.gameLog?.statistics || []) (st.labels || []).forEach((l, i) => note(lg, 'game log', l, st.displayNames?.[i] || st.names?.[i]));
    }
  }
  const sb = await j(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard`);
  const done = (sb?.events || []).find(e => e.status?.type?.state !== 'pre');
  if (done) {
    const sm = await j(`https://site.api.espn.com/apis/site/v2/sports/${path}/summary?event=${done.id}`);
    for (const t of sm?.boxscore?.players || []) for (const st of t.statistics || []) (st.labels || []).forEach((l, i) => note(lg, 'box score', l, st.descriptions?.[i] || st.names?.[i]));
  }
}
const rows = [...missing.values()];
console.log(rows.length, 'untranslated');
for (const r of rows) console.log(`${r.league}\t${r.where}\t${r.label}\t${r.long}\t${r.longZh}`);
