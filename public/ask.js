// 問比賽 (the family's AI plan, Jay 11-10): ask about the teams and leagues
// you follow in your own words. The phone lays out what it has read
// (lib/ask.mjs askTables); the Worker's AI (Orbit-Core 'sports-ask') picks
// the tables that answer and writes one line, every number theirs. Drawn,
// never a paragraph (Jay 11-11): the line under the Orbit AI mark, then the
// tables as rows, each team's logo, the rows it names lit, each row opening
// its team or game. The bar to type in is the sheet's foot (on the keyboard).
import * as kitUI from '#kit/ui.mjs';
import * as kitAI from '#kit/ai.mjs';
import { askTables, askFacts } from './lib/ask.mjs';

const W = (en, zh, e) => (en ? e : zh);

// src: { en, teams(), standings() → Promise<{ league: { name, rows } }>, today(), nameOf(league, side), openTeam(league, id), openGame(league, id) }
// `ask`: a question already said (問 Orbit's, #ask=…), asked at once.
export function openAsk(src, { ask = '' } = {}) {
  const en = src.en;
  const h = kitUI.h;
  const STARTERS = [W(en, '我的球隊排第幾？', 'Where are my teams in the table?'), W(en, '我的球隊下一場什麼時候？', 'When do my teams play next?'), W(en, '最近打得怎麼樣？', 'How did my teams do last time?'), W(en, '今天有什麼比賽？', 'What’s on today?')];
  const talk = h('div', { class: 'sp-ask-talk', 'aria-live': 'polite' });
  let open = true;
  const bar = kitAI.aiBar({ placeholder: W(en, '問你的球隊…', 'Ask about your teams…'), label: W(en, '問比賽', 'Ask about your teams'), max: 200, onSend: q => go(q) });
  const starters = h('div', { class: 'q-ai-chips sp-ask-starters' }, STARTERS.map(q => h('button', { class: 'q-chip', type: 'button', text: q, onclick: () => go(q) })));
  const hint = h('p', { class: 'sp-ask-hint', text: W(en, '名次、賽程、比分都是 App 讀到的，AI 只挑出回答的表、說一句話。', 'Places, games and scores are what the app read; AI only picks the tables that answer and says one line.') });
  const foot = h('div', { class: 'q-sheet-foot sp-ask-foot' }, [bar]);
  kitUI.sheet({ title: W(en, '問比賽', 'Ask about your teams'), detent: 'large', cls: 'sp-ask', body: [hint, starters, talk], foot, onClose: () => (open = false) });
  if (ask) requestAnimationFrame(() => go(String(ask).slice(0, 200)));
  // (In the tap that opened it: iOS raises its keys only then; the kit lands the sheet first.)
  else bar.input?.focus();

  // A row's picture: the team's logo (a game: the home side's); its tap: the team or the game.
  const rowOf = (r, lit) => {
    const [league, id] = String(r.key).split(':');
    return {
      lead: r.logo ? { src: r.logo } : null,
      label: r.label,
      sub: r.sub || '',
      value: r.value || '',
      on: lit.has(r.label),
      onTap: () => (r.game ? src.openGame?.(league, id) : src.openTeam?.(league, id))
    };
  };
  const answerOf = (line, shown, mark) => {
    const lit = new Set(mark);
    const note = W(en, 'AI 挑的表，名次和比分都是 App 讀到的', 'Tables picked by AI; every place and score from the app');
    if (kitAI.aiAnswer) return kitAI.aiAnswer({ line, sections: shown.map(t => ({ title: t.title, rows: t.rows.map(r => rowOf(r, lit)) })), note });
    // (An older kit: the line and the rows as plain text lines.)
    return h('div', { class: 'sp-ask-a' }, [h('p', { class: 'sp-ask-line', text: line }), ...shown.flatMap(t => [h('h4', { text: t.title }), ...t.rows.map(r => h('p', { class: `sp-ask-row${lit.has(r.label) ? ' on' : ''}`, text: [r.label, r.sub, r.value].filter(Boolean).join(' · ') }))])]);
  };

  // 「追蹤湖人」: a command, read by code (kit act.mjs), no AI call. The team
  // found is shown with 追蹤 to tap; done, 復原 in the toast takes it back.
  async function follow(name) {
    const think = kitAI.aiAnswerWait?.({ text: W(en, '找這支球隊…', 'Finding the team…'), rows: 1 }) || kitAI.aiThinking(W(en, '找這支球隊…', 'Finding the team…'));
    talk.append(think);
    const side = await src.findTeam(name).catch(() => null);
    if (!open) return;
    if (!side) return void think.replaceWith(h('p', { class: 'sp-ask-hint sp-ask-err', text: W(en, `找不到「${name}」這支球隊，到 賽事 › 搜尋 試試。`, `Couldn’t find “${name}”. Try 賽事 › Search.`) }));
    const btn = h('button', { class: 'q-btn small tinted sp-ask-follow', type: 'button' });
    const paint = () => {
      const on = src.isFollowed(side.league, side.id);
      btn.textContent = on ? W(en, '已追蹤', 'Following') : W(en, '追蹤', 'Follow');
      btn.classList.toggle('primary', !on);
    };
    btn.onclick = () => {
      const was = src.isFollowed(side.league, side.id);
      src.toggleFollow(side);
      paint();
      kitUI.toast?.(was ? W(en, `不再追蹤 ${side.name}`, `Unfollowed ${side.name}`) : W(en, `追蹤了 ${side.name}`, `Following ${side.name}`), { action: { label: W(en, '復原', 'Undo'), onTap: () => (src.toggleFollow(side), paint()) } });
    };
    paint();
    const row = h('div', { class: 'q-rowcard sp-ask-team' }, [
      h('div', { class: 'q-ritem' }, [
        side.logo ? h('img', { class: 'sp-ask-logo', src: side.logo, alt: '', width: 32, height: 32, loading: 'lazy' }) : null,
        h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: side.name }), h('small', { text: side.leagueName })]),
        btn
      ])
    ]);
    think.replaceWith(row);
    row.scrollIntoView?.({ block: 'nearest' });
  }

  async function go(q) {
    if (bar.classList.contains('busy')) return;
    const act = src.findTeam ? await import('#kit/act.mjs').then(m => m.readAct?.(q)).catch(() => null) : null;
    if (act?.act === 'follow') {
      starters.hidden = true;
      bar.clear();
      talk.append(h('p', { class: 'sp-ask-you', text: q }));
      return follow(act.name);
    }
    starters.hidden = true;
    bar.busy(true);
    bar.clear();
    const doing = W(en, '看一下你的球隊…', 'Looking at your teams…');
    const think = kitAI.aiAnswerWait?.({ text: doing, rows: 4 }) || kitAI.aiThinking(doing);
    talk.append(h('p', { class: 'sp-ask-you', text: q }), think);
    think.scrollIntoView?.({ block: 'nearest' });
    try {
      const now = Date.now();
      const standings = await src.standings().catch(() => ({}));
      const tables = askTables({ teams: src.teams(), standings, today: src.today(), now, en, nameOf: src.nameOf });
      const r = globalThis.ORBIT_TEST?.flags?.aiCap ? { error: 'cap' } : Object.keys(tables).length ? await kitAI.aiCall('sports-ask', { question: q, facts: askFacts(tables, { en, now }), lang: en ? 'en' : 'zh' }) : { error: 'none' };
      if (!open) return;
      const line = r.out?.line;
      const shown = (r.out?.show || []).map(id => tables[id]).filter(Boolean);
      const says = r.error === 'none' ? W(en, '先追蹤幾支球隊或聯賽，才有東西可以問。', 'Follow a few teams or leagues first, then ask.') : r.error ? kitAI.aiSays(r.error, r.left) : W(en, '你追蹤的球隊裡看不出這個，換個問法試試。', 'Your teams don’t say. Try asking another way.');
      const a = line ? answerOf(line, shown, r.out?.mark || []) : h('p', { class: 'sp-ask-hint sp-ask-err', text: says });
      think.replaceWith(a);
      a.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    } finally {
      bar.busy(false);
    }
  }
}
