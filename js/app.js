import { setLocale, t } from './i18n.js';
import * as store from './store.js';
import * as auth from './auth.js';
import { $, closeSheet, toast, applyTheme } from './ui.js';
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

setLocale('ar');
store.load();
initPWA();

const routes = [
  [/^\/?$/, () => library()],
  [/^\/c\/([\w-]+)$/, (m) => library(m[1])],
  [/^\/story\/([\w-]+)$/, (m) => storyPage(m[1])],
  [/^\/read\/([\w-]+)(?:\/([\w-]+))?$/, (m) => reader(m[1], m[2])],
  [/^\/login$/, () => login()],
  [/^\/reset$/, () => login('reset')],
  [/^\/pricing$/, () => pricing()],
  [/^\/legal\/(\w+)$/, (m) => legal(m[1])],
  [/^\/account$/, () => account()],
  [/^\/admin(?:\/(\w+))?$/, (m) => admin(m[1])],
];

let cleanup = null, lastHash = location.hash;
export function render(ev) {
  // Unsaved admin edits: ask before leaving the page (window.__psLeaveGuard is set by admin.js).
  if (ev && ev.type === 'hashchange' && location.hash !== lastHash && window.__psLeaveGuard && !window.__psLeaveGuard()) {
    history.replaceState(null, '', lastHash || '#/'); return;
  }
  lastHash = location.hash;
  const path = (location.hash.replace(/^#/, '').split('?')[0]) || '/';
  closeSheet(true);
  if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
  document.body.removeAttribute('data-theme');
  document.body.className = '';
  applyTheme(store.S.prefs.theme);   // night mode follows the reader's saved choice on every page
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (m) { cleanup = fn(m) || null; window.scrollTo(0, 0); return; }
  }
  location.hash = '#/';
}

window.addEventListener('hashchange', render);
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
  else if (a === 'theme') {
    store.S.prefs.theme = store.S.prefs.theme === 'night' ? 'day' : 'night'; store.saveNow();
    applyTheme(store.S.prefs.theme);
    document.querySelectorAll('[data-a=theme]').forEach((b) => b.setAttribute('aria-pressed', String(store.S.prefs.theme === 'night')));
  }
});
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeSheet(); });

// Re-render when login state, admin role or premium access changes (not on every sync).
let cloudKey = '';
cloud.onCloud(() => {
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
