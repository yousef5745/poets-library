// Supabase Auth: Google (OAuth) and email + password (sign-up with email confirmation,
// login, forgot / reset password). Facebook and X are wired the same way, off in config.js.
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

let clientP = null;
export function getClient() {
  if (!isConfigured()) return Promise.resolve(null);
  return (clientP ||= makeClient());
}
async function makeClient() {
  // Tests inject an in-memory fake on localhost only (tests/mock-supabase.js).
  const mock = isLocal() && window.__psMockSupabase;
  const { createClient } = mock ? { createClient: mock } : await import(/* @vite-ignore */ CONFIG.supabase.sdkUrl);
  client = createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  });
  client.auth.onAuthStateChange((ev, session) => {
    user = session ? session.user : null;
    // Reset-password link: the session is a recovery session, so send the reader to the new-password form.
    if (ev === 'PASSWORD_RECOVERY') { recovery = true; setTimeout(() => { location.hash = '#/reset'; }, 0); }
    emit();
  });
  const { data } = await client.auth.getSession();
  user = data.session ? data.session.user : null;
  readyDone = true;
  emit();
  return client;
}

const RET = 'ps_auth_return';
const RET_L = 'ps_auth_return_l';   // localStorage copy: an email confirmation link opens in a new tab
let authError = '';
// Where to go after signing in (e.g. the reader chapter the login gate interrupted).
export function setReturn(h) {
  try { sessionStorage.setItem(RET, h); localStorage.setItem(RET_L, JSON.stringify({ h, at: Date.now() })); } catch (e) {}
}
export function takeReturn() {
  let r = '';
  try {
    r = sessionStorage.getItem(RET) || '';
    if (!r) { const l = JSON.parse(localStorage.getItem(RET_L) || 'null'); if (l && Date.now() - l.at < 864e5) r = l.h || ''; }
    sessionStorage.removeItem(RET); localStorage.removeItem(RET_L);
  } catch (e) {}
  return /access_token=|error_description=/.test(r) ? '' : r;
}
// Resolves once the stored session (if any) is known, so routes can decide without a flash.
let readyDone = !isConfigured();
let clientFailed = false;
// Offline (PWA) or the auth library could not load: a reader who has a stored Supabase session on
// this device keeps reading; the server is never asked, nothing new is unlocked.
export function knownUserOffline() {
  if (navigator.onLine !== false && !clientFailed) return false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (/^sb-.+-auth-token$/.test(k)) { const v = JSON.parse(localStorage.getItem(k) || 'null'); if (v && (v.user || (v.currentSession && v.currentSession.user))) return true; }
    }
  } catch (e) {}
  return false;
}
export const isReady = () => readyDone;
export const ready = () => (isConfigured() ? getClient().then(() => user, () => { readyDone = true; clientFailed = true; return null; }) : Promise.resolve(null));
let recovery = false;
export const lastAuthError = () => authError;
export const inRecovery = () => recovery;
let notice = '';
export const lastNotice = () => notice;

export async function init() {
  if (!isConfigured()) return;
  // Google sends the reader back to /poets-library/?code=... (PKCE) or ?error=...
  const qs = new URLSearchParams(location.search);
  const back = qs.has('code') || qs.has('error') || /access_token=|error_description=/.test(location.hash);
  if (qs.has('error')) authError = qs.get('error_description') || qs.get('error');
  try { await getClient(); } catch (e) { console.warn('supabase init failed', e); }
  // A confirmation / reset link opened in another browser has no PKCE verifier, so no session
  // starts; Supabase has still confirmed the address. Tell the reader to log in with the password.
  if (qs.has('code') && !user && !authError) notice = 'link_other_browser';
  if (back) {
    const ret = takeReturn();
    const hash = (/^#\//.test(location.hash) ? location.hash : '') || ret || '#/';
    history.replaceState(null, '', location.pathname + (hash === '#/login' && user ? '#/account' : hash));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
}

function redirectTo(ret) {
  // Supabase redirects to this exact URL (no hash: the code comes back as ?code=).
  // The hash route is kept in sessionStorage and restored by init().
  setReturn(ret || location.hash || '#/');
  return location.origin + location.pathname;
}

export const avatarUrl = (u = user) => (u && u.user_metadata && (u.user_metadata.avatar_url || u.user_metadata.picture)) || '';

export async function signInWith(provider) {
  const c = await getClient();
  if (!c) return { error: 'not_configured' };
  const p = provider === 'x' ? CONFIG.auth.x.supabaseProvider : provider;
  // Supabase answers a disabled provider with a bare JSON error page; check first and stay here.
  if (!(isLocal() && window.__psMockSupabase)) {
    try {
      const r = await fetch(`${CONFIG.supabase.url}/auth/v1/settings`, { headers: { apikey: CONFIG.supabase.anonKey } });
      const j = await r.json();
      if (j && j.external && j.external[p] === false) return { error: 'provider_disabled' };
    } catch (e) {}
  }
  const { error } = await c.auth.signInWithOAuth({ provider: p, options: { redirectTo: redirectTo() } });
  return { error };
}

// Email + password. Errors come back as short codes the login page turns into Arabic copy.
function emailErr(error) {
  if (!error) return null;
  const m = `${error.code || ''} ${error.message || ''}`.toLowerCase();
  if (/invalid.?login|invalid_credentials/.test(m)) return 'bad_credentials';
  if (/not.?confirmed/.test(m)) return 'not_confirmed';
  if (/rate|429|too many|security purposes/.test(m) || error.status === 429) return 'rate_limit';
  if (/weak|password should|at least/.test(m)) return 'weak_password';
  if (/already|registered|exists/.test(m)) return 'exists';
  if (/signup.*disabled|signups not allowed|provider.*disabled|email_provider_disabled/.test(m)) return 'provider_disabled';
  if (/invalid.*email|email_address_invalid|unable to validate email/.test(m)) return 'bad_email';
  if (/same.?password|different from the old/.test(m)) return 'same_password';
  return 'unknown';
}
// ret: hash to open after the confirmation link (the gated reader chapter, else the account page).
export async function signUpEmail(email, password, name, ret) {
  const c = await getClient();
  if (!c) return { error: 'not_configured' };
  const { data, error } = await c.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo(ret || '#/account'), data: name ? { full_name: name } : {} } });
  if (error) return { error: emailErr(error) };
  // An address that already has an account comes back with no identities (Supabase hides it).
  if (data && data.user && Array.isArray(data.user.identities) && !data.user.identities.length) return { error: 'exists' };
  return { error: null, confirm: !(data && data.session) };
}
export async function signInEmail(email, password) {
  const c = await getClient();
  if (!c) return { error: 'not_configured' };
  const { error } = await c.auth.signInWithPassword({ email, password });
  return { error: emailErr(error) };
}
export async function resendConfirm(email, ret) {
  const c = await getClient();
  if (!c) return { error: 'not_configured' };
  const { error } = await c.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirectTo(ret || '#/account') } });
  return { error: emailErr(error) };
}
export async function sendReset(email) {
  const c = await getClient();
  if (!c) return { error: 'not_configured' };
  const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: redirectTo('#/reset') });
  return { error: emailErr(error) };
}
export async function setPassword(password) {
  const c = await getClient();
  if (!c) return { error: 'not_configured' };
  const { error } = await c.auth.updateUser({ password });
  if (!error) recovery = false;
  return { error: emailErr(error) };
}
// Kept for the magic-link option (off): a one-time sign-in link by email.
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
