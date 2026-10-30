/* Story engine (ported from the game's game.js, logic only, no DOM).
   Node:   {bg, steps:[...], choices:[...] | next:'id' | route:[...] | chapterEnd:'nextChapterId' | ending:'id'}
   Step:   {n:'narration'} | {c:'char', t:'line', e:'expression'} | {v:['sadr','ajuz'], by:'poet'}
           | {show:{char:'l|c|r'}} | {hide:'char'} | {fx:{...}}
   Choice: {t:'text', to:'id', gem:cost, req:{fur:n, fas:n}, fx:{fur, fas, rel:{who:n}, flag:'x', pearls:n, toast:'msg'}}
   Route:  [{if:{rel:{abla:5}, fur:3, flag:'camels'}, to:'id'}, {to:'default'}]            */

export function freshRun(storyId) {
  return { story: storyId, chap: null, node: null, step: 0, st: { fur: 0, fas: 0, rel: { abla: 0, shaddad: 0, malik: 0 }, flags: {} }, stage: {}, verses: [] };
}
export const clone = (o) => JSON.parse(JSON.stringify(o));

export function cond(st, c) {
  if (!c) return true;
  if (c.fur != null && st.fur < c.fur) return false;
  if (c.fas != null && st.fas < c.fas) return false;
  if (c.flag && !st.flags[c.flag]) return false;
  if (c.rel) for (const r in c.rel) if ((st.rel[r] || 0) < c.rel[r]) return false;
  return true;
}

// Applies effects to the run stats. Returns {msgs, pearls} so the UI decides how to show them.
export function applyFx(st, fx, names) {
  const out = { msgs: [], pearls: 0 };
  if (!fx) return out;
  for (const k of ['fur', 'fas']) if (fx[k]) { st[k] += fx[k]; out.msgs.push(`${names.stats[k]} ${fx[k] > 0 ? '+' : ''}${fx[k]}`); }
  if (fx.rel) for (const r in fx.rel) { st.rel[r] = (st.rel[r] || 0) + fx.rel[r]; out.msgs.push(`${names.rels[r]} ${fx.rel[r] > 0 ? '+' : ''}${fx.rel[r]}`); }
  if (fx.flag) st.flags[fx.flag] = 1;
  if (fx.pearls) out.pearls = fx.pearls;
  if (fx.toast) out.msgs.push(fx.toast);
  return out;
}

// Unmet requirement parts, e.g. [{k:'fas', need:2, have:1}]
export function unmet(st, req) {
  const a = [];
  if (!req) return a;
  for (const k of ['fur', 'fas']) if (req[k] && st[k] < req[k]) a.push({ k, need: req[k], have: st[k] });
  return a;
}

export function resolveRoute(st, route) {
  for (const r of route) if (cond(st, r.if)) return r.to;
  return null;
}

// Graph check used by tests: every node reachable from chapter starts, no dead ends,
// every ending reachable.
export function validate(story) {
  const errs = [], seen = new Set();
  const N = story.nodes;
  const stack = story.chapters.map((c) => c.start);
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    const n = N[id];
    if (!n) { errs.push('missing node ' + id); continue; }
    seen.add(id);
    const outs = [];
    if (n.choices) n.choices.forEach((c) => outs.push(c.to));
    if (n.next) outs.push(n.next);
    if (n.route) n.route.forEach((r) => outs.push(r.to));
    if (n.chapterEnd) { const c = story.chapters.find((x) => x.id === n.chapterEnd); if (!c) errs.push('bad chapterEnd ' + id); }
    if (!outs.length && !n.chapterEnd && !n.ending) errs.push('dead end ' + id);
    outs.forEach((o) => stack.push(o));
  }
  Object.keys(N).forEach((k) => { if (!seen.has(k)) errs.push('unreachable ' + k); });
  const endHit = new Set(Object.values(N).filter((n) => n.ending).map((n) => n.ending));
  Object.keys(story.endings).forEach((e) => { if (!endHit.has(e)) errs.push('ending never used ' + e); });
  return errs;
}
