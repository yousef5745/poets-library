// Lemon Squeezy checkout overlay. The webhook (Supabase Edge Function ls-webhook, Phase 6)
// maps the payment to the user through checkout[custom][user_id].
import { CONFIG } from '../config.js';
import { currentUser } from './auth.js';

const LS = CONFIG.lemonSqueezy;
export const isConfigured = () => !!(LS.storeSubdomain && LS.variants.monthly && LS.variants.yearly);

let loading = null;
function loadLemon(onEvent) {
  if (window.LemonSqueezy) return Promise.resolve();
  if (!loading) {
    loading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = LS.scriptUrl; s.defer = true;
      s.onload = () => {
        window.createLemonSqueezy && window.createLemonSqueezy();
        window.LemonSqueezy && window.LemonSqueezy.Setup({ eventHandler: onEvent });
        res();
      };
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  return loading;
}

export function checkoutUrl(plan, u) {
  const q = new URLSearchParams({ embed: '1', media: '0', logo: '0', desc: '0' });
  if (u.email) q.set('checkout[email]', u.email);
  q.set('checkout[custom][user_id]', u.id);
  return `https://${LS.storeSubdomain}.lemonsqueezy.com/buy/${LS.variants[plan]}?${q.toString()}`;
}

// Returns 'not_configured' | 'need_login' | 'opened'
export async function openCheckout(plan, onSuccess) {
  if (!isConfigured()) return 'not_configured';
  const u = currentUser();
  if (!u) return 'need_login';
  await loadLemon((ev) => { if (ev && ev.event === 'Checkout.Success' && onSuccess) onSuccess(ev); });
  window.LemonSqueezy.Url.Open(checkoutUrl(plan, u));
  return 'opened';
}
