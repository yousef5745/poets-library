// Supabase data layer: public settings, per-story admin flags, progress/pearls sync,
// subscription status and analytics events. Everything here degrades to localStorage
// (store.js) and config.js when Supabase is unreachable or the tables are not created yet.
import { CONFIG } from '../config.js';
import { STORIES } from '../content/catalog.js';
import * as auth from './auth.js';
import { S, hooks, saveNow } from './store.js';
import { setSubscriber } from './access.js';
import { setCategories, category, DEFAULT_CATEGORY } from './categories.js';

export const ALL_STORIES = STORIES.slice();          // admin sees hidden ones too
const BASE = ALL_STORIES.map((s) => ({ id: s.id, ready: s.ready, freeChapters: s.freeChapters, portrait: s.portrait, category: s.category || DEFAULT_CATEGORY, draft: !!s.draft }));
// Draft stories (catalog `draft: true`) stay hidden until an admin row sets published = true.
// Local preview only: localStorage.ps_dev_drafts = '1' on localhost.
const devDrafts = () => { try { return auth.isLocal() && localStorage.getItem('ps_dev_drafts') === '1'; } catch (e) { return false; } };
const CACHE = 'ps_public_v1';

export const cloud = { profile: null, subs: [], ready: false };
export const isAdmin = () => !!(cloud.profile && cloud.profile.role === 'admin');
const listeners = new Set();
export const onCloud = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => { try { fn(); } catch (e) {} });

// ------------------------------------------------------------ public settings
const deep = (a, b) => { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) deep(a[k] ||= {}, b[k]); else a[k] = b[k]; } return a; };

export function applySettings(rows) {
  for (const r of rows || []) {
    const v = r.value;
    if (r.key === 'plans' && v) deep(CONFIG.plans, v);
    else if (r.key === 'auth' && v) for (const p in v) { if (CONFIG.auth[p] && v[p] && 'enabled' in v[p]) CONFIG.auth[p].enabled = !!v[p].enabled; }
    else if (r.key === 'freeChaptersDefault' && Number.isFinite(+v)) CONFIG.freeChaptersDefault = +v;
    else if (r.key === 'startingPearls' && Number.isFinite(+v)) CONFIG.startingPearls = +v;
  }
}

// stories_admin rows -> catalogue: category, hide unpublished, coming-soon, free chapters, order.
// Category options are copied onto the story: noCharImages (never draw people, e.g. prophets)
// removes every portrait and character sprite; kid marks children's stories.
let lastFlags = [];
export function applyStoryFlags(rows) {
  if (rows) lastFlags = rows;
  const by = Object.fromEntries(lastFlags.map((r) => [r.story_id, r]));
  ALL_STORIES.forEach((s, i) => {
    const b = BASE[i], r = by[s.id] || {};
    s.category = r.category || b.category;
    const c = category(s.category) || { published: true };
    s.noCharImages = !!c.no_character_images;
    s.kid = !!c.kid_friendly; s.minAge = c.min_age ?? null;
    s.portrait = s.noCharImages ? null : b.portrait;
    s.ready = r.coming_soon ? false : b.ready;
    s.freeChapters = Number.isInteger(r.free_chapters) ? r.free_chapters : b.freeChapters;
    s.hidden = r.published === false || c.published === false || (b.draft && r.published !== true && !devDrafts());
    s.order = Number.isInteger(r.sort_order) ? r.sort_order : i;
  });
  const vis = ALL_STORIES.filter((s) => !s.hidden).sort((a, b) => a.order - b.order);
  STORIES.splice(0, STORIES.length, ...vis);
}

function applyPublic(p) { applySettings(p.settings); if (p.categories) setCategories(p.categories); applyStoryFlags(p.stories); }
export const applyCategories = (rows) => { setCategories(rows); applyStoryFlags(); };

export async function loadPublic() {
  const c = await auth.getClient().catch(() => null);
  if (!c) return false;
  const [a, b, k] = await Promise.all([c.from('settings').select('key,value'), c.from('stories_admin').select('*'), c.from('categories').select('*')]);
  if (a.error || b.error) return false;           // tables not created yet -> config.js values stay
  const p = { settings: a.data, stories: b.data, categories: k.error ? null : k.data };
  applyPublic(p);
  try { localStorage.setItem(CACHE, JSON.stringify(p)); } catch (e) {}
  return true;
}

// ------------------------------------------------------------ events
export async function track(type, story_id = null, meta = {}) {
  const c = await auth.getClient().catch(() => null);
  if (!c) return;
  const u = auth.currentUser();
  c.from('events').insert({ type, story_id, meta, user_id: u ? u.id : null }).then(() => {}, () => {});
}

// ------------------------------------------------------------ progress sync
const storyIds = () => [...new Set([...Object.keys(S.runs || {}), ...Object.keys(S.chDone || {}), ...Object.keys(S.endings || {})])];
const rowOf = (sid) => ({
  story_id: sid,
  node: (S.runs[sid] && S.runs[sid].chap) || null,
  state: { run: S.runs[sid] || null, chk: (S.chk || {})[sid] || {}, chDone: (S.chDone || {})[sid] || {} },
  endings: Object.keys((S.endings || {})[sid] || {}),
});
const walletOf = () => ({ look: S.look, owned: S.owned, prefs: S.prefs, synced: true });

let snap = {};           // last state seen per story (for diffs and events)
let snapWallet = '';
function takeSnap() {
  snap = {}; for (const sid of storyIds()) snap[sid] = JSON.stringify(rowOf(sid));
  snapWallet = JSON.stringify([S.pearls, walletOf()]);
}

let pushT = null; const dirty = new Set(); let dirtyWallet = false;
function afterSave() {
  for (const sid of storyIds()) {
    const now = rowOf(sid), was = snap[sid] ? JSON.parse(snap[sid]) : null;
    const js = JSON.stringify(now);
    if (js === snap[sid]) continue;
    if (now.state.run && !(was && was.state.run)) track('play', sid);
    const oldCh = was ? was.state.chDone : {};
    for (const ch in now.state.chDone) if (!oldCh[ch]) track('chapter', sid, { chapter: ch });
    const oldEn = new Set(was ? was.endings : []);
    for (const e of now.endings) if (!oldEn.has(e)) track('ending', sid, { ending: e });
    snap[sid] = js; dirty.add(sid);
  }
  const w = JSON.stringify([S.pearls, walletOf()]);
  if (w !== snapWallet) { snapWallet = w; dirtyWallet = true; }
  if (auth.currentUser() && (dirty.size || dirtyWallet)) { clearTimeout(pushT); pushT = setTimeout(push, 1500); }
}

async function push() {
  const u = auth.currentUser(); const c = await auth.getClient().catch(() => null);
  if (!u || !c || !cloud.profile) return;
  const ids = [...dirty]; dirty.clear();
  if (ids.length) {
    const rows = ids.map((sid) => ({ ...rowOf(sid), user_id: u.id, updated_at: new Date().toISOString() }));
    const { error } = await c.from('progress').upsert(rows, { onConflict: 'user_id,story_id' });
    if (error) ids.forEach((i) => dirty.add(i));
  }
  if (dirtyWallet) {
    dirtyWallet = false;
    const { error } = await c.from('profiles').update({ pearls: S.pearls, wallet: walletOf(), last_seen: new Date().toISOString() }).eq('id', u.id);
    if (error) dirtyWallet = true; else { cloud.profile.pearls = S.pearls; }
  }
}
export const flush = () => { clearTimeout(pushT); return push(); };

// Merge after login: union of finished chapters and endings; the server's run wins when it
// has one; pearls come from the server once this device has synced before.
function merge(profile, rows) {
  const w = profile.wallet || {};
  const first = !w.synced;
  if (!first) {
    S.pearls = profile.pearls;
    if (w.look) S.look = w.look;
    if (Array.isArray(w.owned)) S.owned = [...new Set([...(S.owned || []), ...w.owned])];
    if (w.prefs) S.prefs = Object.assign(S.prefs || {}, w.prefs);
  } else {
    S.pearls = Math.max(S.pearls, profile.pearls);
  }
  for (const r of rows) {
    const sid = r.story_id, st = r.state || {};
    S.chDone[sid] = Object.assign({}, S.chDone[sid] || {}, st.chDone || {});
    S.endings[sid] = Object.assign({}, S.endings[sid] || {}, Object.fromEntries((r.endings || []).map((e) => [e, 1])));
    if (st.run) { S.runs[sid] = st.run; S.chk[sid] = st.chk || {}; }
  }
  return first;
}

export function subActive(s) {
  return ['active', 'on_trial', 'past_due'].includes(s.status) || (s.status === 'cancelled' && s.ends_at && new Date(s.ends_at) > new Date());
}
export const premium = () => !!((cloud.profile && cloud.profile.premium_until && new Date(cloud.profile.premium_until) > new Date()) || cloud.subs.some(subActive));
export const currentSub = () => cloud.subs.find(subActive) || cloud.subs[0] || null;

export async function refreshAccount() {
  const u = auth.currentUser(); const c = await auth.getClient().catch(() => null);
  if (!u || !c) return;
  const { data: subs } = await c.from('subscriptions').select('*').eq('user_id', u.id).order('updated_at', { ascending: false });
  cloud.subs = subs || [];
  const { data: p } = await c.from('profiles').select('*').eq('id', u.id).maybeSingle();
  if (p) { cloud.profile = p; if (p.wallet && p.wallet.synced) { S.pearls = p.pearls; saveNow(); } }
  setSubscriber(premium()); emit();
}

let loggedFor = null;
async function onLogin(u) {
  if (!u) { loggedFor = null; cloud.profile = null; cloud.subs = []; cloud.ready = true; setSubscriber(false); emit(); return; }
  if (loggedFor === u.id) return;
  loggedFor = u.id;
  const c = await auth.getClient();
  const { data: profile, error } = await c.from('profiles').select('*').eq('id', u.id).maybeSingle();
  if (error || !profile) { cloud.ready = true; emit(); return; }   // schema not installed yet
  cloud.profile = profile;
  const [{ data: rows }, { data: subs }] = await Promise.all([
    c.from('progress').select('*').eq('user_id', u.id),
    c.from('subscriptions').select('*').eq('user_id', u.id).order('updated_at', { ascending: false }),
  ]);
  cloud.subs = subs || [];
  const first = merge(profile, rows || []);
  hooks.afterSave = null; saveNow(); takeSnap(); hooks.afterSave = afterSave;
  for (const sid of storyIds()) dirty.add(sid);       // push the merged result back
  dirtyWallet = true;
  if (!first && !(rows || []).length && !storyIds().length) dirty.clear();
  push();
  setSubscriber(premium());
  cloud.ready = true; emit();
}

export function init() {
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch (e) {}
  if (cached) applyPublic(cached); else applyStoryFlags([]);
  takeSnap(); hooks.afterSave = afterSave;
  auth.onAuth((u) => setTimeout(() => onLogin(u), 0));
  window.addEventListener('pagehide', () => { if (dirty.size || dirtyWallet) push(); });
}
