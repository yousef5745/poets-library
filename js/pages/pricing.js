import { t } from '../i18n.js';
import { ic } from '../icons.js';
import { header, footer, $, toast } from '../ui.js';
import { CONFIG } from '../../config.js';
import { openCheckout } from '../pay.js';
import { refreshAccount, track } from '../cloud.js';

export default function pricing() {
  const P = CONFIG.plans;
  const feats = (extra = '') => `<ul class="feats">
    <li>${ic('check')}<span>${t('pr.f1')}</span></li>
    <li>${ic('check')}<span>${t('pr.f2')}</span></li>
    <li>${ic('pearl')}<span>${t('pr.f3', { n: P.monthlyPearls })}<small>${t('pr.pearlsExplain')}</small></span></li>
    <li>${ic('check')}<span>${t('pr.f4')}</span></li>${extra}</ul>`;
  const faq = [1, 2, 3, 4].map((i) => `<details><summary>${t('pr.q' + i)}</summary><p>${t('pr.a' + i)}</p></details>`).join('');

  $('#app').innerHTML = `${header('pricing')}<main id="main" class="pricing"><div class="wrap">
    <section class="phead"><h1>${t('pr.title')}</h1><p class="lead">${t('pr.lead')}</p></section>
    <div class="plans">
      <article class="plan best" aria-labelledby="py">
        <div class="planhead"><h2 id="py">${t('pr.yearly')}</h2><span class="bestlbl">${t('pr.best')}</span></div>
        <div class="price"><b dir="ltr">$${P.yearly.price}</b><span>${t('pr.perYear')}</span></div>
        <p class="pnote">${t('pr.yearlyNote', { pm: P.yearly.perMonth, pct: P.yearly.savePct })}</p>
        ${feats()}
        <button class="btn pri wide" data-buy="yearly">${t('pr.chooseYearly')}</button>
        <p class="trust">${ic('lock')}${t('pr.trust')}</p>
      </article>
      <article class="plan" aria-labelledby="pm">
        <div class="planhead"><h2 id="pm">${t('pr.monthly')}</h2></div>
        <div class="price"><b dir="ltr">$${P.monthly.price}</b><span>${t('pr.perMonth')}</span></div>
        <p class="pnote">${t('pr.monthlyNote')}</p>
        <p class="same">${t('pr.monthlySame')}</p>
        <button class="btn ghost wide" data-buy="monthly">${t('pr.chooseMonthly')}</button>
      </article>
    </div>
    <p class="msg" id="pmsg" role="status"></p>
    <p class="fine legal-links pr-legal">${t('legal.subLine', { pay: `<a href="#/legal/payment">${t('foot.payment')}</a>`, ref: `<a href="#/legal/refunds">${t('foot.refunds')}</a>` })}</p>
    <p class="freelink"><a href="#/">${t('pr.free')}</a></p>
    <section class="faq"><h2>${t('pr.faq')}</h2>${faq}</section>
  </div></main>${footer()}`;

  $('#app').querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', async () => {
    const r = await openCheckout(b.dataset.buy, () => {
      toast('تم الاشتراك. شكرًا لك.');
      // The webhook writes the subscription a few seconds after payment.
      [3000, 8000, 20000].forEach((ms) => setTimeout(refreshAccount, ms));
    });
    if (r === 'opened') track('checkout', null, { plan: b.dataset.buy });
    const m = $('#pmsg');
    if (r === 'not_configured') m.textContent = t('pr.notConfigured');
    else if (r === 'need_login') { m.textContent = t('pr.needLogin'); setTimeout(() => { location.hash = '#/login'; }, 900); }
  }));
}
