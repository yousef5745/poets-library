import { header, footer, $ } from '../ui.js';
import { t } from '../i18n.js';
// Phase 6 fills these pages (Lemon Squeezy reviews them before activating the store).
export default function legal(kind) {
  const title = { terms: t('foot.terms'), privacy: t('foot.privacy'), refunds: t('foot.refunds') }[kind] || '';
  $('#app').innerHTML = `${header('')}<main id="main" class="wrap legal"><h1>${title}</h1><p class="lead">تُكتب هذه الصفحة قبل تفعيل الاشتراكات.</p></main>${footer()}`;
}
