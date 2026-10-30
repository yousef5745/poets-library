// Audience: «حكايات للأطفال» (kids) or «حكايات للكبار» (adult). Stored in S.prefs.audience and
// synced like the other reading prefs (setPref -> prefsAt, last write wins in cloud.js).
// Kids mode is a look and an order only: every story stays open to everyone.
// Applied as <html data-aud="kids|adult">; css/kids.css holds the kids tokens and overrides.
// First visit: a 3-step onboarding (audience, text size, font) over the current page, once.
import { t } from './i18n.js';
import { S, setPref } from './store.js';
import { sizeControl, fontControl, applyReadSize, applyReadFont } from './ui.js';
import { isLocal } from './auth.js';
import { ic } from './icons.js';
import { canInstall, hasPrompt, isIOSSafari, promptInstall } from './pwa.js';

export const AUDS = ['kids', 'adult'];
export const aud = () => (S.prefs.audience === 'kids' ? 'kids' : 'adult');
export const isKids = () => aud() === 'kids';

export function applyAudience() {
  document.documentElement.dataset.aud = aud();
  applyReadSize(S.prefs.size);      // kids mode reads a step larger (ui.js)
}
export function setAudience(a) { setPref('audience', a === 'kids' ? 'kids' : 'adult'); applyAudience(); }

// Category order on the home page: kids -> kids' stories and the prophets first;
// adults -> poets, novels, plays first. Others keep the admin order after them.
const FIRST = { kids: ['kids', 'prophets'], adult: ['poets', 'novels', 'plays'] };
export function orderCats(list) {
  const f = FIRST[aud()];
  const rank = (c) => { const i = f.indexOf(c.slug); return i < 0 ? f.length + list.indexOf(c) : i; };
  return list.slice().sort((a, b) => rank(a) - rank(b));
}

// Segmented «للكبار | للأطفال» switch; attr = the click data attribute of the host page.
export function audSwitch(attr = 'data-a', cls = '') {
  const b = (v) => `<button type="button" ${attr}="aud" data-v="${v}" aria-pressed="${aud() === v}" class="${aud() === v ? 'on' : ''}">${t('aud.' + v)}</button>`;
  return `<div class="audsw ${cls}" role="group" aria-label="${t('aud.label')}">${b('adult')}${b('kids')}</div>`;
}

// ------------------------------------------------------------ onboarding
const ART = {
  // flat shapes only: a kite and a sun for kids, an open book and a crescent for adults
  kids: '<svg viewBox="0 0 120 90" aria-hidden="true"><circle cx="92" cy="24" r="14" fill="#f6c343"/><path d="M92 4v6M92 38v6M72 24h6M106 24h6M78 10l4 4M102 34l4 4M78 38l4-4M102 14l4-4" stroke="#f6c343" stroke-width="3" stroke-linecap="round"/><path d="M34 14l18 18-18 22-18-22z" fill="#e8590c"/><path d="M34 14v40M16 32h36" stroke="#fff8ec" stroke-width="2"/><path d="M34 54q-6 10 2 16t0 16" fill="none" stroke="#2b2140" stroke-width="2" stroke-linecap="round"/><path d="M30 64l-6 2 4 4zM36 74l6 0-3 5z" fill="#0f766e"/></svg>',
  adult: '<svg viewBox="0 0 120 90" aria-hidden="true"><path d="M86 12a16 16 0 1 0 14 24 13 13 0 1 1-14-24z" fill="#9b2f20"/><path d="M14 40q22-8 44 2v38q-22-10-44-2z" fill="none" stroke="#211b14" stroke-width="2.5" stroke-linejoin="round"/><path d="M102 40q-22-8-44 2v38q22-10 44-2z" fill="none" stroke="#211b14" stroke-width="2.5" stroke-linejoin="round"/><path d="M22 52q14-4 28 1M22 62q14-4 28 1M66 53q14-5 28-1M66 63q14-5 28-1" stroke="#9b2f20" stroke-width="1.5" fill="none"/></svg>',
};
let open = false;
const testSkip = () => { try { return isLocal() && navigator.webdriver && localStorage.getItem('ps_test_onboard') !== '1'; } catch (e) { return false; } };
export const needsOnboarding = () => !S.prefs.onboarded && !testSkip();

export function maybeOnboard() {
  if (open || !needsOnboarding()) return;
  if (/^#\/(reset|admin)/.test(location.hash) || document.body.classList.contains('in-reader')) return;
  onboard();
}
export function closeOnboarding() { const el = document.getElementById('onb'); if (el) el.remove(); open = false; document.documentElement.classList.remove('onb-open'); }

function onboard() {
  open = true;
  let step = 1;
  // a 4th step «ثبّت حكايا كتطبيق» only where installing is possible (not installed yet; a browser
  // prompt on Android / desktop Chrome and Edge, or the Share steps on iPhone / iPad Safari)
  const total = () => (canInstall() || step === 4 ? 4 : 3);
  const lastFocus = document.activeElement;
  const el = document.createElement('div');
  el.id = 'onb';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'onb-h');
  document.body.appendChild(el);
  document.documentElement.classList.add('onb-open');
  const dots = () => `<ol class="onb-dots" aria-label="${t('onb.progress', { i: step, n: total() })}">${Array.from({ length: total() }, (_, k) => k + 1).map((i) => `<li class="${i === step ? 'on' : i < step ? 'done' : ''}"></li>`).join('')}</ol>`;
  const sample = () => `<div class="onb-prev"><p class="onb-sample">${t(isKids() ? 'onb.sampleKids' : 'onb.sampleAdult')}</p></div>`;
  const draw = () => {
    let body;
    if (step === 1) {
      const card = (v) => `<button type="button" class="onb-aud${aud() === v && S.prefs.audience ? ' on' : ''}" data-ob="aud" data-v="${v}" aria-pressed="${!!S.prefs.audience && aud() === v}">${ART[v]}<b>${t('onb.' + v)}</b><span>${t('onb.' + v + 'D')}</span></button>`;
      body = `<h2 id="onb-h">${t('onb.q1')}</h2><p class="onb-lead">${t('onb.l1')}</p><div class="onb-auds">${card('kids')}${card('adult')}</div>`;
    } else if (step === 2) {
      body = `<h2 id="onb-h">${t('onb.q2')}</h2><p class="onb-lead">${t('onb.l2')}</p>${sizeControl(S.prefs.size, 'data-ob')}${sample()}`;
    } else if (step === 4) {
      const how = hasPrompt()
        ? `<button type="button" class="btn pri wide onb-inst" data-ob="install">${ic('download')}<span>${t('onb.installNow')}</span></button>`
        : isIOSSafari() ? `<ol class="ios-steps onb-ios"><li>${t('pwa.ios1', { icon: ic('share') })}</li><li>${t('pwa.ios2')}</li><li>${t('pwa.ios3')}</li></ol>` : `<p class="onb-lead">${t('onb.installDone')}</p>`;
      body = `<div class="onb-appic"><img src="assets/brand/icon-192.png" alt="" width="72" height="72"></div><h2 id="onb-h">${t('onb.q4')}</h2><p class="onb-lead">${t('onb.l4')}</p>${how}`;
    } else {
      body = `<h2 id="onb-h">${t('onb.q3')}</h2><p class="onb-lead">${t('onb.l3')}</p>${fontControl(S.prefs.font, 'data-ob')}${sample()}`;
    }
    const canNext = step > 1 || !!S.prefs.audience;
    const last = step === total();
    el.innerHTML = `<div class="onb-box"><div class="onb-top">${dots()}<button type="button" class="onb-skip" data-ob="skip">${t('onb.skip')}</button></div>
      <div class="onb-body">${body}</div>
      <div class="onb-nav">${step > 1 ? `<button type="button" class="btn ghost" data-ob="back">${t('onb.back')}</button>` : '<span></span>'}
        <button type="button" class="btn ${step === 4 ? 'ghost' : 'pri'}" data-ob="${last ? 'done' : 'next'}"${canNext ? '' : ' disabled'}>${t(last ? (step === 4 ? 'onb.later' : 'onb.done') : 'onb.next')}</button></div></div>`;
    const f = el.querySelector('h2'); if (f) { f.tabIndex = -1; f.focus({ preventScroll: true }); }
  };
  const finish = () => {
    if (!S.prefs.audience) setPref('audience', 'adult');
    setPref('onboarded', 1);
    closeOnboarding();
    window.dispatchEvent(new CustomEvent('ps:audience'));
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {}
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ob]');
    if (!b) return;
    const a = b.dataset.ob, v = b.dataset.v;
    if (a === 'aud') {
      const first = !S.prefs.audience;
      setAudience(v);
      // kids read a size larger by default, unless the size was already chosen
      if (first && v === 'kids' && S.prefs.size === 'm') setPref('size', 'l');
      applyReadSize(S.prefs.size);
      window.dispatchEvent(new CustomEvent('ps:audience'));
      step = 2; draw(); return;
    }
    if (a === 'size') { setPref('size', applyReadSize(v)); draw(); return; }
    if (a === 'font') { setPref('font', applyReadFont(v)); draw(); return; }
    if (a === 'next') { step = Math.min(total(), step + 1); draw(); return; }
    if (a === 'install') { promptInstall().then((out) => { if (out === 'accepted') finish(); else draw(); }); return; }
    if (a === 'back') { step = Math.max(1, step - 1); draw(); return; }
    if (a === 'skip' || a === 'done') finish();
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { finish(); return; }
    if (e.key !== 'Tab') return;
    const f = [...el.querySelectorAll('button:not([disabled])')];
    if (!f.length) return;
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  });
  const onInst = () => { if (open && step < 4 && document.getElementById('onb')) draw(); };
  addEventListener('ps:installable', onInst);
  draw();
}
