import { setLocale, t } from './i18n.js';
import * as store from './store.js';
import * as auth from './auth.js';
import { $, closeSheet, sheetOpen, toast, applyTheme, applyReadSize, applyReadFont } from './ui.js';
import library from './pages/library.js';
import storyPage from './pages/story.js';
import reader from './pages/reader.js';
import login from './pages/login.js';
import pricing from './pages/pricing.js';
import legal from './pages/legal.js';
import account from './pages/account.js';
import admin from './pages/admin.js';
import * as cloud from './cloud.js';
import { initPWA } from './pwa.js';
import { storyMeta } from '../content/catalog.js';
import { isFreeChapter } from './access.js';
import { applyAudience, setAudience, maybeOnboard, closeOnboarding } from './audience.js';

setLocale('ar');
store.load();
initPWA();

const routes = [
  [/^\/?$/, () => library()],
  [/^\/c\/([\w-]+)$/, (m) => library(m[1])],
  [/^\/story\/([\w-]+)$/, (m) => storyPage(m[1])],
  [/^\/read\/([\w-]+)(?:\/([\w-]+))?$/, (m) => readGate(m[1], m[2])],
  [/^\/login$/, () => login()],
  [/^\/reset$/, () => login('reset')],
  [/^\/pricing$/, () => pricing()],
  [/^\/legal\/(\w+)$/, (m) => legal(m[1])],
  [/^\/account$/, () => account()],
  [/^\/admin(?:\/(\w+))?$/, (m) => admin(m[1])],
];

// Reading needs an account (free chapters included). Home, category and story pages stay public.
// Signed out -> the sign-in gate on the same #/read/... hash; once signed in (Google redirect,
// email login or a confirmation link) the router renders this route again and opens that chapter.
// This is a UI gate only: chapter files are still public JS until chapters move behind Supabase RLS.
function readGate(sid, chapId) {
  const meta = storyMeta(sid);
  if (!meta || !meta.ready) { location.hash = '#/'; return null; }
  if (!auth.isConfigured() || auth.currentUser()) return reader(sid, chapId);
  const hash = location.hash;
  let alive = true;
  if (!auth.isReady()) {
    $('#app').innerHTML = `<main id="main" class="auth"><p class="loading">…</p></main>`;
    auth.ready().then(() => { if (alive && location.hash === hash) render(); });
    return () => { alive = false; };
  }
  if (auth.knownUserOffline()) return reader(sid, chapId);
  const n = /^c(\d+)$/.exec(chapId || (store.S.runs[sid] && store.S.runs[sid].chap) || '');
  return login('gate', { meta, free: isFreeChapter(meta, n ? +n[1] - 1 : 0) });
}

let cleanup = null, lastHash = location.hash, renderedPath = null;
export function render(ev) {
  // Unsaved admin edits: ask before leaving the page (window.__psLeaveGuard is set by admin.js).
  if (ev && ev.type === 'hashchange' && location.hash !== lastHash && window.__psLeaveGuard && !window.__psLeaveGuard()) {
    history.replaceState(null, '', lastHash || '#/'); return;
  }
  lastHash = location.hash;
  const path = (location.hash.replace(/^#/, '').split('?')[0]) || '/';
  // A data refresh re-renders the same page (auth ready, public settings loaded): keep an open
  // sheet (e.g. the iPhone install steps) instead of closing it under the reader's finger.
  if (!(ev === undefined && path === renderedPath && sheetOpen())) closeSheet(true);
  renderedPath = path;
  if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
  document.body.removeAttribute('data-theme');
  document.body.className = '';
  applyAudience();                    // kids / adult look (before the size: kids read larger)
  applyTheme(store.S.prefs.theme);   // night mode follows the reader's saved choice on every page
  applyReadSize(store.S.prefs.size); // reading text size too (account page sample, reader)
  applyReadFont(store.S.prefs.font); // and the reading font
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (m) { cleanup = fn(m) || null; window.scrollTo(0, 0); maybeOnboard(); return; }
  }
  location.hash = '#/';
}

window.addEventListener('hashchange', render);
// onboarding picked an audience or closed: redraw the page behind it in the new look and order
window.addEventListener('ps:audience', () => { if (!document.body.classList.contains('in-reader')) { const y = scrollY; render(); scrollTo(0, y); } });
auth.onAuth(() => { if (!document.body.classList.contains('in-reader')) render(); });

// Global clicks shared by every page.
document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-a]');
  if (!el) return;
  const a = el.dataset.a;
  if (a === 'sheet-close') closeSheet();
  else if (a === 'nav') {
    const n = $('#nav'); const open = n.classList.toggle('open');
    el.setAttribute('aria-expanded', String(open));
  } else if (a === 'logout') { await auth.signOut(); toast(t('acc.signedOut')); if (/^#\/(account|admin)/.test(location.hash)) location.hash = '#/'; else render(); }
  else if (a === 'aud') {
    setAudience(el.dataset.v);
    if (!document.body.classList.contains('in-reader')) render();
  } else if (a === 'theme') {
    store.setPref('theme', store.S.prefs.theme === 'night' ? 'day' : 'night');
    applyTheme(store.S.prefs.theme);
    document.querySelectorAll('[data-a=theme]').forEach((b) => b.setAttribute('aria-pressed', String(store.S.prefs.theme === 'night')));
  }
});
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeSheet(); });

// Re-render when login state, admin role or premium access changes (not on every sync).
let cloudKey = '';
cloud.onCloud(() => {
  applyAudience(); applyReadSize(store.S.prefs.size); applyReadFont(store.S.prefs.font);
  if (store.S.prefs.onboarded) closeOnboarding();   // finished on another device (cloud prefs newer)
  const k = `${!!cloud.cloud.profile}:${cloud.isAdmin()}:${cloud.premium()}`;
  if (k === cloudKey) return;
  cloudKey = k;
  if (!document.body.classList.contains('in-reader') && !/^#\/(account|admin)/.test(location.hash)) render();
});

cloud.init();
render();
auth.init().then(() => {
  if (auth.lastAuthError()) toast(t('auth.failed', { why: auth.lastAuthError() }));
  return cloud.loadPublic();
}).then((changed) => { if (changed && !document.body.classList.contains('in-reader') && !/^#\/admin/.test(location.hash)) render(); });
window.__ps = { store };
