import { t, fdate } from './i18n.js';
import { ic } from './icons.js';
import { currentUser, displayName, avatarUrl } from './auth.js';
import { isAdmin } from './cloud.js';

export const $ = (s, r = document) => r.querySelector(s);
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const img = (k) => `assets/img/${k}.webp`;

// Brand lockup «حكايا» (seal + wordmark). The SVG symbols live once in index.html and
// paint with --ink / --acc / --paper, so the night theme gets the gold seal on its own.
export const brand = () => `<a class="logo" href="#/" aria-label="${t('site.name')}"><svg class="lgm" viewBox="0 0 225 100" aria-hidden="true" focusable="false"><use href="#hk-logo"/></svg></a>`;

export function header(active) {
  const u = currentUser();
  const link = (href, key, id) => `<a href="${href}" class="${active === id ? 'on' : ''}"${active === id ? ' aria-current="page"' : ''}>${t(key)}</a>`;
  return `<header class="top">
    <div class="wrap topin">
      ${brand()}
      <nav class="nav" id="nav" aria-label="${t('nav.menu')}">
        ${link('#/', 'nav.library', 'library')}
        ${link('#/pricing', 'nav.pricing', 'pricing')}
        ${u ? link('#/account', 'nav.account', 'account') : ''}
        ${u && isAdmin() ? link('#/admin', 'nav.admin', 'admin') : ''}
      </nav>
      <div class="topact">
        ${u ? `<a class="btn ghost sm me-btn" href="#/account" aria-label="${t('nav.account')}">${ic('user')}<bdi class="me">${esc(displayName(u).split(' ')[0])}</bdi></a>`
            : `<a class="btn ghost sm" href="#/login">${ic('user')}<span>${t('nav.login')}</span></a>`}
        <button class="iconbtn navbtn" data-a="nav" aria-expanded="false" aria-controls="nav" aria-label="${t('nav.menu')}">${ic('menu')}</button>
      </div>
    </div>
  </header>`;
}

// Square framed avatar plate (spec 3.2): the Google photo over the first letter, which
// stays visible while the photo loads or when it fails.
export function avatar(u, cls = 'adm-ava', src) {
  const url = src !== undefined ? src : avatarUrl(u);
  const name = typeof u === 'string' ? u : displayName(u);
  const letter = esc((name || '؟').trim().charAt(0));
  return `<span class="${cls} avp" aria-hidden="true">${letter}${url ? `<img src="${esc(url)}" alt="" referrerpolicy="no-referrer" loading="lazy" onerror="this.remove()">` : ''}</span>`;
}

export const fmtDate = (d) => (d ? fdate(d) : '—');

// Theme (day / night) outside the reader: S.prefs.theme, applied on every route.
export function applyTheme(theme) {
  if (theme === 'night') document.body.dataset.theme = 'night'; else document.body.removeAttribute('data-theme');
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.content = theme === 'night' ? '#0e1319' : '#f2ebdd';
}

export function footer() {
  return `<footer class="foot"><div class="wrap footin">
    <div>${brand()}<p>${t('foot.about')}</p></div>
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
