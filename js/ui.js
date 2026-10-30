import { t } from './i18n.js';
import { ic } from './icons.js';
import { currentUser, displayName } from './auth.js';

export const $ = (s, r = document) => r.querySelector(s);
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const img = (k) => `assets/img/${k}.webp`;

export function header(active) {
  const u = currentUser();
  const link = (href, key, id) => `<a href="${href}" class="${active === id ? 'on' : ''}"${active === id ? ' aria-current="page"' : ''}>${t(key)}</a>`;
  return `<header class="top">
    <div class="wrap topin">
      <a class="logo" href="#/">${ic('quill', 'ic lg')}<span>${t('site.name')}</span></a>
      <nav class="nav" id="nav" aria-label="${t('nav.menu')}">
        ${link('#/', 'nav.library', 'library')}
        ${link('#/pricing', 'nav.pricing', 'pricing')}
      </nav>
      <div class="topact">
        ${u ? `<span class="me"><bdi>${esc(displayName(u))}</bdi></span><button class="btn ghost sm" data-a="logout">${ic('logout')}<span>${t('nav.logout')}</span></button>`
            : `<a class="btn ghost sm" href="#/login">${ic('user')}<span>${t('nav.login')}</span></a>`}
        <button class="iconbtn navbtn" data-a="nav" aria-expanded="false" aria-controls="nav" aria-label="${t('nav.menu')}">${ic('menu')}</button>
      </div>
    </div>
  </header>`;
}

export function footer() {
  return `<footer class="foot"><div class="wrap footin">
    <div><a class="logo" href="#/">${ic('quill', 'ic lg')}<span>${t('site.name')}</span></a><p>${t('foot.about')}</p></div>
    <nav class="flinks"><a href="#/legal/terms">${t('foot.terms')}</a><a href="#/legal/privacy">${t('foot.privacy')}</a><a href="#/legal/refunds">${t('foot.refunds')}</a></nav>
  </div></footer>`;
}

let toastT;
export function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('on'), 2200);
}

let lastFocus = null;
export function sheet(html, opts = {}) {
  const m = $('#sheet');
  lastFocus = document.activeElement;
  m.innerHTML = `<div class="sheet-bg" data-a="sheet-close"></div><div class="sheet-box ${opts.cls || ''}" role="dialog" aria-modal="true">${opts.closable === false ? '' : `<button class="iconbtn sheet-x" data-a="sheet-close" aria-label="${t('r.close')}">${ic('close')}</button>`}${html}</div>`;
  m.hidden = false;
  m.dataset.closable = opts.closable === false ? '0' : '1';
  const f = m.querySelector('.btn, button:not(.sheet-x)');
  if (f) f.focus({ preventScroll: true });
}
export function closeSheet(force) {
  const m = $('#sheet');
  if (m.hidden) return;
  if (!force && m.dataset.closable === '0') return;
  m.hidden = true; m.innerHTML = '';
  if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
}
export const sheetOpen = () => !$('#sheet').hidden;
