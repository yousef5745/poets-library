import { t } from '../i18n.js';
import { ic, GOOGLE_G, FB_LOGO, X_LOGO } from '../icons.js';
import { header, footer, esc, img, $, toast } from '../ui.js';
import * as auth from '../auth.js';

export default function login() {
  const u = auth.currentUser();
  const prov = auth.enabledProviders();
  const others = prov.filter((p) => p === 'facebook' || p === 'x');
  const email = prov.includes('email');
  const box = u
    ? `<h1>${t('login.title')}</h1><p class="benefit">${t('login.signedInAs', { name: `<bdi>${esc(auth.displayName(u))}</bdi>` })}</p>
       <a class="btn pri wide" href="#/">${t('login.guestLink')}</a><button class="btn ghost wide" data-a="logout">${t('nav.logout')}</button>`
    : `<h1>${t('login.title')}</h1>
      <p class="benefit">${t('login.benefit')}</p>
      <div class="providers">
        ${prov.includes('google') ? `<button class="gsi" data-l="google"><span class="gsi-in">${GOOGLE_G}<span class="gsi-t">${t('login.google')}</span></span></button>` : ''}
        <p class="guest">${t('login.guest')} <a href="#/">${t('login.guestLink')}</a></p>
        ${others.map((p) => `<button class="sbtn" data-l="${p}">${p === 'facebook' ? FB_LOGO : X_LOGO}<span>${t('login.' + p)}</span></button>`).join('')}
        ${email ? `${others.length ? '' : ''}<div class="or"><span>${t('login.or')}</span></div>
          <form class="emailf" id="emailf" novalidate>
            <label for="em">${t('login.emailLabel')}</label>
            <input id="em" type="email" inputmode="email" autocomplete="email" dir="ltr" required>
            <button class="sbtn" type="submit">${ic('mail')}<span>${t('login.emailSend')}</span></button>
          </form>` : ''}
      </div>
      <p class="msg" id="lmsg" role="status"></p>
      <p class="fine">${t('login.terms')}</p>`;

  $('#app').innerHTML = `${header('login')}<main id="main" class="auth">
    <div class="authart" style="background-image:url(${img('tent')})">
      <figure class="aaq"><blockquote><p>هَلَّا سَأَلْتِ الخَيْلَ يَا ابْنَةَ مَالِكٍ</p><p>إِنْ كُنْتِ جَاهِلَةً بِمَا لَمْ تَعْلَمِي</p></blockquote><figcaption>عنترة بن شدّاد</figcaption></figure>
    </div>
    <section class="authbox"><div class="kicker">${t('site.name')}</div>${box}</section>
  </main>${footer()}`;

  const msg = (s) => { const m = $('#lmsg'); if (m) m.textContent = s; };
  $('#app').querySelectorAll('[data-l]').forEach((b) => b.addEventListener('click', async () => {
    if (!auth.isConfigured()) { msg(t('login.notConfigured')); return; }
    b.disabled = true;
    const { error } = await auth.signInWith(b.dataset.l);
    b.disabled = false;
    if (error) msg(t('login.error'));
  }));
  const f = $('#emailf');
  if (f) f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!auth.isConfigured()) { msg(t('login.notConfigured')); return; }
    const v = $('#em').value.trim();
    if (!/^\S+@\S+\.\S+$/.test(v)) { $('#em').focus(); return; }
    const { error } = await auth.signInWithEmail(v);
    msg(error ? t('login.error') : t('login.emailSent'));
  });
}
