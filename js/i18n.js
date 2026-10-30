import { CONFIG } from '../config.js';
import ar from '../i18n/ar.js';

const dicts = { ar };
let locale = CONFIG.defaultLocale;

export function setLocale(code) {
  if (dicts[code]) locale = code;
  document.documentElement.lang = locale;
  document.documentElement.dir = dicts[locale].dir || 'rtl';
}

export function t(key, vars) {
  let s = dicts[locale][key];
  if (s === undefined) s = dicts.ar[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, n) => (vars[n] ?? m));
  return s;
}

// Arabic counted noun for pearls (لؤلؤة). Other locales can override with their own keys.
export function pearlsWord(n) {
  if (n === 1) return t('pearls.1');
  if (n === 2) return t('pearls.2');
  if (n >= 3 && n <= 10) return t('pearls.few', { n });
  return t('pearls.many', { n });
}
