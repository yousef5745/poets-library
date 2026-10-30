// Login page: Google, then email + password with three modes (دخول / حساب جديد / نسيت كلمة
// المرور), plus #/reset for the new password after a reset link. Controls follow the
// figma spec components (.seg, .fld with .emsg, .btn), inside a .dash wrapper.
import { t } from '../i18n.js';
import { ic, GOOGLE_G, FB_LOGO, X_LOGO } from '../icons.js';
import { header, footer, esc, img, $, toast } from '../ui.js';
import * as auth from '../auth.js';
import { CONFIG } from '../../config.js';

const L = (k, v) => t('login.' + k, v);
const MIN = 8;   // our rule (Supabase minimum is 6)
let mode = 'in'; // in | up | forgot
let lastEmail = '';
let gate = null;  // { meta, idx, free, ret } when login() is the reader's sign-in gate

const errMsg = (code) => L('err.' + code) !== 'login.err.' + code ? L('err.' + code) : L('error');
const field = (id, label, type, ac, extra = '') => `<div class="fld" id="w_${id}"><label for="${id}">${label}</label>
  <div class="pwrap">${`<input id="${id}" type="${type}" autocomplete="${ac}" ${type === 'email' || type === 'password' ? 'dir="ltr"' : ''} ${type === 'password' ? 'data-pw' : ''} ${extra} aria-describedby="${id}-e">`}${type === 'password' ? `<button type="button" class="pwshow" data-show="${id}" aria-pressed="false" aria-label="${L('show')}">${L('show')}</button>` : ''}</div>
  <span class="emsg" id="${id}-e" hidden></span></div>`;

function emailForm() {
  const tabs = `<div class="atabs" role="group" aria-label="${L('modeLabel')}"><button type="button" data-mode="in" aria-pressed="${mode === 'in'}">${L('tabIn')}</button><button type="button" data-mode="up" aria-pressed="${mode === 'up'}">${L('tabUp')}</button></div>`;
  if (mode === 'forgot') {
    return `<form class="emailf" id="emailf" novalidate><h2 class="eh">${L('forgotTitle')}</h2><p class="fine">${L('forgotLine')}</p>
      ${field('em', L('emailLabel'), 'email', 'email', `inputmode="email" required value="${esc(lastEmail)}"`)}
      <button class="btn ghost wide" type="submit">${ic('mail')}<span>${L('sendReset')}</span></button>
      <button type="button" class="link" data-mode="in">${L('backToLogin')}</button></form>`;
  }
  const up = mode === 'up';
  return `${tabs}<form class="emailf" id="emailf" novalidate>
    ${up ? field('nm', L('nameLabel'), 'text', 'name', 'maxlength="60"') : ''}
    ${field('em', L('emailLabel'), 'email', 'email', `inputmode="email" required value="${esc(lastEmail)}"`)}
    ${field('pw', L('pwLabel'), 'password', up ? 'new-password' : 'current-password', `required minlength="${up ? MIN : 1}"`)}
    ${up ? `<span class="hint fine">${L('pwHint', { n: MIN })}</span>` : `<button type="button" class="link forgot" data-mode="forgot">${L('forgot')}</button>`}
    <button class="btn ghost wide" type="submit">${ic(up ? 'user' : 'lock')}<span>${up ? L('signUp') : L('signIn')}</span></button></form>`;
}

function resetBox() {
  const u = auth.currentUser();
  if (!u) return `<h1>${L('resetTitle')}</h1><div class="state err" role="alert"><b>${L('resetNoSession')}</b><p>${L('resetNoSessionLine')}</p></div>
    <button type="button" class="btn ghost wide" data-goforgot>${L('sendAgain')}</button>`;
  return `<h1>${L('resetTitle')}</h1><p class="benefit">${L('resetLine', { e: `<bdi class="ltr">${esc(u.email || '')}</bdi>` })}</p>
    <form class="emailf" id="resetf" novalidate>${field('pw', L('newPw'), 'password', 'new-password', `required minlength="${MIN}"`)}${field('pw2', L('newPw2'), 'password', 'new-password', 'required')}
    <span class="hint fine">${L('pwHint', { n: MIN })}</span><button class="btn pri wide" type="submit">${L('savePw')}</button></form>
    <p class="msg" id="lmsg" role="status" aria-live="polite"></p>`;
}

function sentBox(email, kind) {
  return `<div class="sentbox" role="status">${ic('mail', 'ic lg')}<h2>${L(kind === 'reset' ? 'resetSentTitle' : 'confirmTitle')}</h2>
    <p>${L(kind === 'reset' ? 'resetSentLine' : 'confirmLine', { e: `<bdi class="ltr">${esc(email)}</bdi>` })}</p><p class="fine">${L('checkSpam')}</p>
    ${kind === 'confirm' ? `<button type="button" class="btn ghost sm" data-resend>${L('resend')}</button>` : ''}
    <button type="button" class="link" data-mode="in">${L('backToLogin')}</button></div>`;
}

// gateFor: { meta, chapIdx, free } from the reader route when a signed-out visitor opens a chapter.
// The URL keeps the reader hash, so after any sign-in the router opens that same chapter.
export default function login(view, gateFor) {
  gate = view === 'gate' ? { ...gateFor, ret: location.hash } : null;
  const u = auth.currentUser();
  const prov = auth.enabledProviders();
  const others = prov.filter((p) => p === 'facebook' || p === 'x');
  const email = prov.includes('email');
  const magic = CONFIG.auth.email && CONFIG.auth.email.mode === 'magic';
  let box;
  if (view === 'reset') box = resetBox();
  else if (u) box = `<h1>${L('title')}</h1><p class="benefit">${L('signedInAs', { name: `<bdi>${esc(auth.displayName(u))}</bdi>` })}</p>
       <a class="btn pri wide" href="#/">${L('guestLink')}</a><a class="btn ghost wide" href="#/account">${t('nav.account')}</a>`;
  else box = `${gate ? `<p class="kicker gatek">${esc(gate.meta.title)}</p><h1>${L('gateTitle')}</h1>
      <p class="benefit">${L(gate.free ? 'gateFree' : 'gatePaid')}</p>` : `<h1>${L('title')}</h1>
      <p class="benefit">${L('benefit')}</p>`}
      ${auth.lastNotice() === 'link_other_browser' ? `<p class="notice" role="status">${ic('check')}${L('otherBrowser')}</p>` : ''}
      <div class="providers">
        ${prov.includes('google') ? `<button class="gsi" data-l="google"><span class="gsi-in">${GOOGLE_G}<span class="gsi-t">${L('google')}</span></span></button>` : ''}
        ${gate ? '' : `<p class="guest">${L('guest')} <a href="#/">${L('guestLink')}</a></p>`}
        ${others.map((p) => `<button class="sbtn" data-l="${p}">${p === 'facebook' ? FB_LOGO : X_LOGO}<span>${L(p)}</span></button>`).join('')}
        ${email ? `<div class="or"><span>${L('orEmail')}</span></div><div id="ebox">${magic ? '' : emailForm()}</div>` : ''}
      </div>
      <p class="msg" id="lmsg" role="status" aria-live="polite"></p>
      <p class="fine">${L('terms')}</p>
      ${gate ? `<a class="link gateback" href="#/story/${gate.meta.id}">${ic('back')}${L('gateBack')}</a>` : ''}`;

  const gm = gate && gate.meta;
  const quote = gm && gm.verse && gm.verse.length === 2
    ? `<figure class="aaq"><blockquote><p>${esc(gm.verse[0])}</p><p>${esc(gm.verse[1])}</p></blockquote><figcaption>${esc(gm.poet || gm.title)}</figcaption></figure>`
    : gm ? `<figure class="aaq"><blockquote><p>${esc(gm.title)}</p></blockquote>${gm.poet ? `<figcaption>${esc(gm.poet)}</figcaption>` : ''}</figure>`
    : `<figure class="aaq"><blockquote><p>هَلَّا سَأَلْتِ الخَيْلَ يَا ابْنَةَ مَالِكٍ</p><p>إِنْ كُنْتِ جَاهِلَةً بِمَا لَمْ تَعْلَمِي</p></blockquote><figcaption>عنترة بن شدّاد</figcaption></figure>`;
  $('#app').innerHTML = `${header('login')}<main id="main" class="auth${gate ? ' gate' : ''}" ${gate ? 'data-gate="1"' : ''}>
    <div class="authart" style="background-image:url(${img((gm && gm.cover) || 'tent')})">
      ${quote}
    </div>
    <section class="authbox dash">${box}</section>
  </main>${footer()}`;

  const root = $('#app');
  const msg = (s, good) => { const m = $('#lmsg'); if (m) { m.innerHTML = s; m.classList.toggle('ok', !!good); } };
  const fieldErr = (id, text) => { const w = $('#w_' + id); if (!w) return; w.classList.toggle('err', !!text); const e = $('#' + id + '-e'); e.hidden = !text; e.textContent = text || ''; $('#' + id).setAttribute('aria-invalid', String(!!text)); };
  const busy = (btn, on) => { if (!btn) return; btn.disabled = on; on ? btn.setAttribute('aria-busy', 'true') : btn.removeAttribute('aria-busy'); };
  const ebox = () => $('#ebox');
  const redraw = () => { if (ebox()) { ebox().innerHTML = emailForm(); msg(''); const f = $('#em'); if (f && !f.value) f.focus(); } };
  // In the gate the hash is already the reader chapter: the auth listener re-renders it, so stay put.
  const G = gate;
  const goBack = () => { const r = auth.takeReturn(); if (G) { if (location.hash !== G.ret) location.hash = G.ret; return; } location.hash = r && !/^#\/(login|reset)/.test(r) ? r : '#/account'; };

  root.querySelectorAll('[data-l]').forEach((b) => b.addEventListener('click', async () => {
    if (!auth.isConfigured()) { msg(L('notConfigured')); return; }
    b.disabled = true;
    const { error } = await auth.signInWith(b.dataset.l);
    b.disabled = false;
    if (error) msg(error === 'provider_disabled' ? L('providerOff') : L('error'));
  }));

  const onClick = async (e) => {
    const m = e.target.closest('[data-mode]');
    if (m) { const em = $('#em'); if (em) lastEmail = em.value.trim(); mode = m.dataset.mode; redraw(); return; }
    const sh = e.target.closest('[data-show]');
    if (sh) { const i = $('#' + sh.dataset.show); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; sh.setAttribute('aria-pressed', String(show)); sh.textContent = show ? L('hide') : L('show'); return; }
    if (e.target.closest('[data-resend]')) {
      const b = e.target.closest('[data-resend]'); busy(b, true);
      const { error } = await auth.resendConfirm(lastEmail, gate && gate.ret); busy(b, false);
      toast(error ? errMsg(error) : L('resent')); return;
    }
    if (e.target.closest('[data-goforgot]')) { mode = 'forgot'; location.hash = '#/login'; }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const btn = f.querySelector('[type=submit]');
    if (f.id === 'resetf') {
      const a = $('#pw').value, b = $('#pw2').value;
      fieldErr('pw', a.length < MIN ? L('pwShort', { n: MIN }) : ''); fieldErr('pw2', a !== b ? L('pwMismatch') : '');
      if (a.length < MIN || a !== b) return;
      busy(btn, true); const { error } = await auth.setPassword(a); busy(btn, false);
      if (error) { msg(errMsg(error)); return; }
      toast(L('pwSaved')); location.hash = '#/account'; return;
    }
    if (f.id !== 'emailf') return;
    if (!auth.isConfigured()) { msg(L('notConfigured')); return; }
    const em = $('#em').value.trim(); lastEmail = em;
    const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em);
    fieldErr('em', okEmail ? '' : L('emailBad'));
    if (mode === 'forgot') {
      if (!okEmail) { $('#em').focus(); return; }
      busy(btn, true); const { error } = await auth.sendReset(em); busy(btn, false);
      if (error && error !== 'unknown') { msg(errMsg(error)); return; }
      ebox().innerHTML = sentBox(em, 'reset'); msg(''); return;   // same answer whether or not the address has an account
    }
    const pw = $('#pw').value;
    const pwBad = mode === 'up' ? (pw.length < MIN ? L('pwShort', { n: MIN }) : '') : (!pw ? L('pwReq') : '');
    fieldErr('pw', pwBad);
    if (!okEmail || pwBad) { (okEmail ? $('#pw') : $('#em')).focus(); return; }
    busy(btn, true); msg('');
    if (mode === 'up') {
      const name = ($('#nm') && $('#nm').value.trim()) || '';
      const r = await auth.signUpEmail(em, pw, name, gate && gate.ret);
      busy(btn, false);
      if (r.error === 'exists') { msg(`${L('err.exists')} <button type="button" class="link" data-mode="in">${L('tabIn')}</button> · <button type="button" class="link" data-mode="forgot">${L('forgot')}</button>`); return; }
      if (r.error) { msg(errMsg(r.error)); return; }
      if (r.confirm) { ebox().innerHTML = sentBox(em, 'confirm'); return; }
      toast(L('welcome')); goBack(); return;
    }
    const { error } = await auth.signInEmail(em, pw);
    busy(btn, false);
    if (error === 'not_confirmed') { msg(`${L('err.not_confirmed')} <button type="button" class="link" data-resend>${L('resend')}</button>`); return; }
    if (error) { msg(errMsg(error)); return; }
    toast(L('welcomeBack')); goBack();
  };
  const onInput = (e) => { const w = e.target.closest('.fld.err'); if (w) { w.classList.remove('err'); const m = w.querySelector('.emsg'); if (m) m.hidden = true; e.target.removeAttribute('aria-invalid'); } };
  root.addEventListener('input', onInput);
  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit);
  return () => { root.removeEventListener('input', onInput); root.removeEventListener('click', onClick); root.removeEventListener('submit', onSubmit); };
}
