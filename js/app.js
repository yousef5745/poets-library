import { setLocale, t } from './i18n.js';
import * as store from './store.js';
import * as auth from './auth.js';
import { $, closeSheet, toast } from './ui.js';
import library from './pages/library.js';
import storyPage from './pages/story.js';
import reader from './pages/reader.js';
import login from './pages/login.js';
import pricing from './pages/pricing.js';
import legal from './pages/legal.js';

setLocale('ar');
store.load();

const routes = [
  [/^\/?$/, () => library()],
  [/^\/story\/([\w-]+)$/, (m) => storyPage(m[1])],
  [/^\/read\/([\w-]+)(?:\/([\w-]+))?$/, (m) => reader(m[1], m[2])],
  [/^\/login$/, () => login()],
  [/^\/pricing$/, () => pricing()],
  [/^\/legal\/(\w+)$/, (m) => legal(m[1])],
];

let cleanup = null;
export function render() {
  const path = (location.hash.replace(/^#/, '').split('?')[0]) || '/';
  closeSheet(true);
  if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
  document.body.removeAttribute('data-theme');
  document.body.className = '';
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
  } else if (a === 'logout') { await auth.signOut(); toast(t('nav.logout')); render(); }
});
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeSheet(); });

render();
auth.init();
window.__ps = { store };
