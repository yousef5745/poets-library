import { t, fdate } from './i18n.js';
import { ic } from './icons.js';
import { currentUser, displayName, avatarUrl } from './auth.js';
import { isAdmin } from './cloud.js';
import { installSlot } from './pwa.js';
import { audSwitch } from './audience.js';

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
        ${audSwitch('data-a', 'navaud')}
      </nav>
      <div class="topact">
        ${u ? `<a class="btn ghost sm me-btn" href="#/account" aria-label="${t('nav.account')}">${ic('user')}<bdi class="me">${esc(displayName(u).split(' ')[0])}</bdi></a>`
            : `${active === 'pricing' ? `<a class="btn sm cta" href="#/">${t('nav.startReading')}</a>` : `<a class="btn sm cta" href="#/pricing">${t('nav.subscribe')}</a>`}<a class="btn ghost sm" href="#/login" aria-label="${t('nav.login')}">${ic('user')}<span>${t('nav.login')}</span></a>`}
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

// Reading text size (S.prefs.size): four steps, applied as --read-size on <html> on every route,
// and html[data-rsize] lets the reader panel grow at the larger steps. Synced with the wallet prefs.
export const READ_SIZES = { s: 19, m: 22, l: 25, xl: 29 };
export const READ_STEPS = ['s', 'm', 'l', 'xl'];
export function applyReadSize(size) {
  const k = READ_SIZES[size] ? size : 'm';
  // kids mode (html[data-aud=kids], js/audience.js) reads 2px larger at every step
  const kids = document.documentElement.dataset.aud === 'kids' ? 2 : 0;
  document.documentElement.style.setProperty('--read-size', READ_SIZES[k] + kids + 'px');
  document.documentElement.dataset.rsize = k;
  return k;
}
// Segmented control «صغير / عادي / كبير / كبير جدًا» with A− / A+ at the ends and a live sample line.
// attr names the click data attribute (data-r in the reader, data-fs on the account page).
export function sizeControl(cur, attr) {
  const i = Math.max(0, READ_STEPS.indexOf(cur));
  const step = (d, lab, dis) => `<button type="button" class="fsstep" ${attr}="size" data-v="${READ_STEPS[Math.min(READ_STEPS.length - 1, Math.max(0, i + d))]}" aria-label="${t(d < 0 ? 'fs.smaller' : 'fs.bigger')}"${dis ? ' disabled' : ''}><bdi dir="ltr">${lab}</bdi></button>`;
  return `<div class="fsctl"><div class="fsrow">${step(-1, 'A−', i === 0)}<div class="seg fsseg" role="group" aria-label="${t('r.textSize')}">${READ_STEPS.map((k) => `<button type="button" ${attr}="size" data-v="${k}" class="${READ_STEPS[i] === k ? 'on' : ''}" aria-pressed="${READ_STEPS[i] === k}">${t('fs.' + k)}</button>`).join('')}</div>${step(1, 'A+', i === READ_STEPS.length - 1)}</div>
    <p class="preview fsprev" aria-live="polite">${t('fs.sample')}</p></div>`;
}

// Reading font (S.prefs.font): applied as --f-story on <html> (dialogue, narration, choices, glosses).
// Amiri and Noto Naskh are already loaded; Markazi Text and Cairo are self-hosted in assets/fonts/extra and
// fetched only when the picker or the chosen font draws text. Ayah cards keep Amiri (css/reader.css).
export const READ_FONTS = {
  amiri: "Amiri,'Noto Naskh Arabic',serif",
  naskh: "'Noto Naskh Arabic',Amiri,serif",
  markazi: "'Markazi Text',Amiri,serif",
  cairo: "Cairo,'Noto Naskh Arabic',sans-serif",
};
export const FONT_KEYS = Object.keys(READ_FONTS);
export function applyReadFont(font) {
  const k = READ_FONTS[font] ? font : 'amiri';
  document.documentElement.style.setProperty('--f-story', READ_FONTS[k]);
  document.documentElement.dataset.rfont = k;
  return k;
}
// «نوع الخط»: four buttons, each written in its own face (name + a one-word descriptor).
export function fontControl(cur, attr) {
  const c = READ_FONTS[cur] ? cur : 'amiri';
  return `<div class="ffseg" role="group" aria-label="${t('r.fontFamily')}">${FONT_KEYS.map((k) => `<button type="button" ${attr}="font" data-v="${k}" class="${c === k ? 'on' : ''}" aria-pressed="${c === k}" style="font-family:${READ_FONTS[k].replace(/"/g, '&quot;')}">${t('ff.' + k)}<small>${t('ff.' + k + 'D')}</small></button>`).join('')}</div>`;
}

// Theme (day / night) outside the reader: S.prefs.theme, applied on every route.
export function applyTheme(theme) {
  if (theme === 'night') document.body.dataset.theme = 'night'; else document.body.removeAttribute('data-theme');
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.content = theme === 'night' ? '#0e1319' : '#f2ebdd';
}

export function footer() {
  return `<footer class="foot"><div class="wrap footin">
    <div>${brand()}<p>${t('foot.about')}</p></div>
    ${installSlot()}<nav class="flinks"><a href="#/legal/terms">${t('foot.terms')}</a><a href="#/legal/privacy">${t('foot.privacy')}</a><a href="#/legal/payment">${t('foot.payment')}</a><a href="#/legal/refunds">${t('foot.refunds')}</a></nav>
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
