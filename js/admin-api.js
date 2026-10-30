// Admin queries. Every call is checked again on the server (row-level security and the
// is_admin() check inside each RPC): a non-admin token gets an error, whatever the UI shows.
import * as auth from './auth.js';

const db = async () => { const c = await auth.getClient(); if (!c) throw new Error('not_configured'); return c; };
const ok = ({ data, error }) => { if (error) throw error; return data; };

export const stats = async (days = 30) => ok(await (await db()).rpc('admin_stats', { days }));
export const users = async (q = '', filter = 'all', page = 1, per = 20) => ok(await (await db()).rpc('admin_users', { q: q.trim(), filter, page, per }));
export const subs = async (filter = 'all') => ok(await (await db()).rpc('admin_subs', { filter }));
export const adjustPearls = async (uid, delta, reason) => ok(await (await db()).rpc('admin_adjust_pearls', { uid, delta, reason }));
export const updateUser = async (id, patch) => ok(await (await db()).from('profiles').update(patch).eq('id', id).select().single());

export const storyFlags = async () => ok(await (await db()).from('stories_admin').select('*'));
export const saveStoryFlags = async (rows) => ok(await (await db()).from('stories_admin').upsert(rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: 'story_id' }));

export const settings = async () => ok(await (await db()).from('settings').select('key,value,updated_at'));
export const saveSettings = async (obj) => ok(await (await db()).from('settings').upsert(Object.entries(obj).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() })), { onConflict: 'key' }));

export const categories = async () => ok(await (await db()).from('categories').select('*').order('sort_order', { ascending: true }));
export const saveCategories = async (rows) => ok(await (await db()).from('categories').upsert(rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: 'slug' }));
export const deleteCategory = async (slug) => ok(await (await db()).from('categories').delete().eq('slug', slug));
