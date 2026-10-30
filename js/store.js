// Reader progress and preferences, kept in localStorage for guests.
// Phase 3 merges this into Supabase (progress + wallet tables) after login.
import { CONFIG } from '../config.js';

const KEY = 'ps_site_v1';
const OLD_KEY = 'poetstories_v1'; // the old single-file game, same github.io origin

const blank = () => ({
  v: 1,
  pearls: CONFIG.startingPearls,
  look: 'a1',
  owned: ['a1', 'a3'],
  runs: {},      // storyId -> current playthrough
  chk: {},       // storyId -> { chapterId: run snapshot at chapter start }
  chDone: {},    // storyId -> { chapterId: 1 }
  endings: {},   // storyId -> { endingId: 1 }
  prefs: { size: 'm', font: 'amiri', theme: 'day', sound: false },
  prefsAt: 0,    // when the reader last changed a pref on this device (cloud merge: newest wins)
});

export const S = blank();
export const fresh = blank;

// Called after every write to localStorage; js/cloud.js hooks in here to sync to Supabase.
export const hooks = { afterSave: null };
const after = () => { if (hooks.afterSave) { try { hooks.afterSave(); } catch (e) {} } };

export function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) {}
  if (raw) {
    try { Object.assign(S, JSON.parse(raw)); } catch (e) {}
  } else {
    importOld();
  }
  S.prefs = Object.assign(blank().prefs, S.prefs || {});
}

function importOld() {
  let o = null;
  try { o = JSON.parse(localStorage.getItem(OLD_KEY) || 'null'); } catch (e) {}
  if (!o) return;
  if (typeof o.pearls === 'number') S.pearls = o.pearls;
  if (o.look) S.look = o.look;
  if (Array.isArray(o.owned)) S.owned = o.owned;
  if (o.chDone) S.chDone.antara = o.chDone;
  if (o.endings) S.endings.antara = o.endings;
  save();
}

let tmr = null;
export function save() {
  clearTimeout(tmr);
  tmr = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} after(); }, 50);
}
export function saveNow() { clearTimeout(tmr); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} after(); }

// Every reading preference change goes through here: stored at once with its time, so a later
// cloud merge never replaces it with an older copy from the profile.
export function setPref(k, v) { S.prefs[k] = v; S.prefsAt = Date.now(); saveNow(); }

export const done = (sid) => (S.chDone[sid] ||= {});
export const endings = (sid) => (S.endings[sid] ||= {});
export const chk = (sid) => (S.chk[sid] ||= {});
