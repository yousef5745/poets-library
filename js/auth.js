// Supabase Auth. Google is the only provider switched on at launch; Facebook, X and
// email (magic link) are wired the same way and turned on from config.js.
import { CONFIG } from '../config.js';

let client = null;
let user = null;
const listeners = new Set();

export const isConfigured = () => !!(CONFIG.supabase.url && CONFIG.supabase.anonKey);
export const currentUser = () => user;
export const onAuth = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => { try { fn(user); } catch (e) {} });

// Providers shown on the login page, in display order. Local preview can force all on
// with ?preview=providers (only on localhost) to check the disabled ones' layout.
export function enabledProviders() {
  const a = CONFIG.auth;
  const all = isLocal() && /preview=providers/.test(location.hash + location.search);
  return ['google', 'facebook', 'x', 'email'].filter((p) => all || (a[p] && a[p].enabled));
}

export const isLocal = () => /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

export async function getClient() {
  if (!isConfigured()) return null;
  if (client) return client;
  const { createClient } = await import(/* @vite-ignore */ CONFIG.supabase.sdkUrl);
  client = createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  });
  client.auth.onAuthStateChange((_ev, session) => { user = session ? session.user : null; emit(); });
  const { data } = await client.auth.getSession();
  user = data.session ? data.session.user : null;
  emit();
  return client;
}

export async function init() {
  if (!isConfigured()) return;
  try { await getClient(); } catch (e) { console.warn('supabase init failed', e); }
}

function redirectTo() {
  // Come back to the page the reader was on (hash route kept in sessionStorage).
  return location.origin + location.pathname;
}

export async function signInWith(provider) {
  const c = await getClient();
  if (!c) return { error: 'not_configured' };
  const p = provider === 'x' ? CONFIG.auth.x.supabaseProvider : provider;
  const { error } = await c.auth.signInWithOAuth({ provider: p, options: { redirectTo: redirectTo() } });
  return { error };
}

export async function signInWithEmail(email) {
  const c = await getClient();
  if (!c) return { error: 'not_configured' };
  const { error } = await c.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
  return { error };
}

export async function signOut() {
  const c = await getClient();
  if (c) await c.auth.signOut();
  user = null; emit();
}

export function displayName(u = user) {
  if (!u) return '';
  const m = u.user_metadata || {};
  return m.full_name || m.name || (u.email || '').split('@')[0];
}
