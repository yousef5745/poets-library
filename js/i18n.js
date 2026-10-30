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

// Numbers and dates. Digits are Latin; month names follow 'fmt.locale' in the dictionary
// (ar: 'ar-u-nu-latn' gives سبتمبر; switch it to 'ar-JO-u-nu-latn' for أيلول). One switch.
const fl = () => t('fmt.locale');
export const fnum = (n) => new Intl.NumberFormat(fl()).format(Number(n) || 0);
export const fsigned = (n) => (n > 0 ? '+' : n < 0 ? '\u2212' : '') + fnum(Math.abs(n));
export const fdate = (d) => (d ? new Intl.DateTimeFormat(fl(), { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d)) : '');
export const fday = (d) => (d ? new Intl.DateTimeFormat(fl(), { day: 'numeric', month: 'long' }).format(new Date(d)) : '');
export const fmonthYear = (d) => (d ? new Intl.DateTimeFormat(fl(), { month: 'long', year: 'numeric' }).format(new Date(d)) : '');
export const ftime = (d) => (d ? new Intl.DateTimeFormat(fl(), { hour: 'numeric', minute: '2-digit' }).format(new Date(d)) : '');
export const fshort = (d) => { if (!d) return ''; const x = new Date(d); return `${x.getFullYear()}/${String(x.getMonth() + 1).padStart(2, '0')}/${String(x.getDate()).padStart(2, '0')}`; };
// "قبل ساعة"-style relative time for admin tables.
export function fago(d) {
  if (!d) return '—';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 90) return t('ago.now');
  if (s < 3600) return t('ago.min', { n: fnum(Math.round(s / 60)) });
  if (s < 86400) return Math.round(s / 3600) === 1 ? t('ago.hour') : t('ago.hours', { n: fnum(Math.round(s / 3600)) });
  const dd = Math.floor(s / 86400);
  if (dd === 1) return t('ago.yesterday');
  if (dd < 30) return t('ago.days', { n: fnum(dd) });
  return dd < 60 ? t('ago.month') : fshort(d);
}
