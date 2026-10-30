// Who can read which chapter. The client check is only for the UI: from Phase 2 the
// chapter text itself comes from Supabase behind RLS, so a locked chapter never reaches
// a non-subscriber's browser.
import { CONFIG } from '../config.js';
import { isLocal } from './auth.js';

let subscriber = false; // set from the subscriptions table in Phase 3/6
export const setSubscriber = (v) => { subscriber = !!v; };

// Local testing only: localStorage.ps_dev_premium = '1' on localhost unlocks premium chapters.
export function isSubscriber() {
  if (subscriber) return true;
  try { return isLocal() && localStorage.getItem('ps_dev_premium') === '1'; } catch (e) { return false; }
}

export function freeCount(meta) { return meta.freeChapters ?? CONFIG.freeChaptersDefault; }
export function isFreeChapter(meta, index) { return index < freeCount(meta); }
export function canRead(meta, index) { return isFreeChapter(meta, index) || isSubscriber(); }
