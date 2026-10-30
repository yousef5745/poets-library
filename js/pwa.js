// Installable app: registers the service worker and offers «ثبّت التطبيق».
// Android / desktop Chrome and Edge: the browser's own prompt (beforeinstallprompt).
// iPhone / iPad Safari has no prompt, so the button opens a short Share > Add to Home Screen hint.
import { t } from './i18n.js';
import { ic } from './icons.js';
import { sheet } from './ui.js';

let deferred = null;
const ua = () => navigator.userAgent || '';
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(ua()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isIOSSafari = () => isIOS() && /safari/i.test(ua()) && !/crios|fxios|edgios|opios/i.test(ua());
export const canInstall = () => !isStandalone() && (!!deferred || isIOSSafari());
export const hasPrompt = () => !!deferred;
// The browser's own install prompt (Android / desktop Chrome and Edge). Resolves to its outcome.
export async function promptInstall() {
  if (!deferred) return 'unavailable';
  const d = deferred; deferred = null;
  d.prompt();
  let out = 'dismissed';
  try { out = (await d.userChoice).outcome || out; } catch (e) {}
  refresh(); dispatchEvent(new CustomEvent('ps:installable'));
  return out;
}

export const installSlot = (cls = '') => `<span class="install-slot ${cls}" data-install-slot>${installBtn()}</span>`;
function installBtn() {
  return canInstall() ? `<button type="button" class="btn ghost sm install" data-a="install">${ic('download')}<span>${t('pwa.install')}</span></button>` : '';
}
function refresh() { document.querySelectorAll('[data-install-slot]').forEach((el) => { el.innerHTML = installBtn(); }); }

export function initPWA() {
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; refresh(); dispatchEvent(new CustomEvent('ps:installable')); });
  addEventListener('appinstalled', () => { deferred = null; refresh(); });
  new MutationObserver(() => { const s = document.querySelector('[data-install-slot]:empty'); if (s && canInstall()) refresh(); })
    .observe(document.getElementById('app'), { childList: true });
  document.addEventListener('click', async (ev) => {
    if (!ev.target.closest('[data-a=install]')) return;
    if (deferred) await promptInstall(); else if (isIOSSafari()) {
      sheet(`<h2>${t('pwa.iosTitle')}</h2><ol class="ios-steps"><li>${t('pwa.ios1', { icon: ic('share') })}</li><li>${t('pwa.ios2')}</li><li>${t('pwa.ios3')}</li></ol>
        <button class="btn pri wide" data-a="sheet-close">${t('r.ok')}</button>`, { cls: 'ios-hint' });
    }
  });
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || local)) {
    addEventListener('load', () => navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {}));
  }
}
