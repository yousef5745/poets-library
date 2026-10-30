// Shared controls for the admin and account pages (spec section 1). Markup only; styles
// live in css/dash.css. Every helper returns an HTML string; behaviour is wired by the page.
import { t, fnum } from './i18n.js';
import { ic } from './icons.js';
import { esc, sheet, closeSheet } from './ui.js';

// Switch: <button role=switch> with the lozenge knob and a visible on/off label.
export const sw = (on, onLabel, offLabel, attrs = '') =>
  `<button type="button" class="sw" role="switch" aria-checked="${on ? 'true' : 'false'}" data-on="${esc(onLabel)}" data-off="${esc(offLabel)}" ${attrs}><i></i><span>${esc(on ? onLabel : offLabel)}</span></button>`;
export function flip(btn, on) {
  btn.setAttribute('aria-checked', on ? 'true' : 'false');
  const s = btn.querySelector('span'); if (s) s.textContent = on ? btn.dataset.on : btn.dataset.off;
}
export const isOn = (btn) => btn.getAttribute('aria-checked') === 'true';

// Stepper [+] value [−] with min/max; the page listens for clicks on [data-step].
export const stepper = (v, min, max, label, attrs = '') =>
  `<div class="stepper" role="group" aria-label="${esc(label)}" data-min="${min}" data-max="${max}" ${attrs}>
    <button type="button" data-step="1" aria-label="${t('ui.inc')}"${v >= max ? ' disabled' : ''}>${ic('plus')}</button>
    <output class="tnum">${fnum(v)}</output>
    <button type="button" data-step="-1" aria-label="${t('ui.dec')}"${v <= min ? ' disabled' : ''}>${ic('minus')}</button></div>`;
export function stepValue(box) { return parseInt(box.dataset.v ?? box.querySelector('output').textContent.replace(/\D/g, ''), 10) || 0; }
export function setStep(box, v) {
  const min = +box.dataset.min, max = +box.dataset.max;
  v = Math.max(min, Math.min(max, v)); box.dataset.v = v;
  box.querySelector('output').textContent = fnum(v);
  box.querySelector('[data-step="1"]').disabled = v >= max;
  box.querySelector('[data-step="-1"]').disabled = v <= min;
  return v;
}

export const seg = (name, opts, cur, label) =>
  `<div class="seg" role="group" aria-label="${esc(label)}">${opts.map(([v, l]) => `<button type="button" data-seg="${name}" data-v="${v}" aria-pressed="${v === cur}">${esc(l)}</button>`).join('')}</div>`;

export const tag = (text, kind = '') => `<span class="tag ${kind}">${esc(text)}</span>`;

export const empty = (title, line = '', btn = '') =>
  `<div class="state"><svg class="orn" viewBox="0 0 180 14" aria-hidden="true"><path d="M0 7h70M110 7h70" stroke="currentColor" stroke-width="1"/><g fill="currentColor"><path d="M80 7l4-4 4 4-4 4z"/><path d="M90 7l4-4 4 4-4 4z" transform="translate(-4 0)"/></g></svg><b>${esc(title)}</b>${line ? `<p>${esc(line)}</p>` : ''}${btn}</div>`;
export const errorBox = (title, cause = '') =>
  `<div class="state err" role="alert"><b>${esc(title)}</b>${cause ? `<p>${esc(cause)}</p>` : ''}<button type="button" class="btn ghost sm" data-a="retry">${t('ui.retry')}</button></div>`;
export const skeleton = (rows = 5) => `<div aria-busy="true"><span class="sr">${t('ui.loading')}</span>${Array.from({ length: rows }, (_, i) => `<span class="sk" style="width:${92 - (i % 3) * 14}%;margin:14px 0"></span>`).join('')}</div>`;

// Confirm dialog in the existing #sheet. Destructive ones use role=alertdialog with the
// safe button focused first. Resolves true / false.
export function confirm({ title, body = '', ok, cancel = t('ui.back'), danger = false, extra = '', check }) {
  return new Promise((res) => {
    sheet(`<div class="cdlg" ${danger ? 'role="alertdialog"' : ''} aria-labelledby="dlg-h"><h2 id="dlg-h">${esc(title)}</h2>${body ? `<p>${esc(body)}</p>` : ''}${extra}
      <div class="cdlg-acts"><button type="button" class="btn ${danger ? 'danger' : 'pri'}" data-dlg="ok">${esc(ok)}</button><button type="button" class="btn ghost" data-dlg="no">${esc(cancel)}</button></div></div>`);
    const box = document.getElementById('sheet');
    const okb = box.querySelector('[data-dlg=ok]');
    (danger ? box.querySelector('[data-dlg=no]') : okb).focus();
    if (check) { const upd = () => { okb.disabled = !check(box); }; upd(); box.addEventListener('input', upd); }
    let done = false;
    const end = (v) => { if (done) return; done = true; obs.disconnect(); closeSheet(true); res(v); };
    okb.addEventListener('click', () => end(true));
    box.querySelector('[data-dlg=no]').addEventListener('click', () => end(false));
    const obs = new MutationObserver(() => { if (box.hidden) end(false); });
    obs.observe(box, { attributes: true, attributeFilter: ['hidden'] });
  });
}

// 22px sparkline, oldest value at the right (time runs right to left).
export function spark(vals) {
  const v = vals && vals.length ? vals : [0, 0];
  const mx = Math.max(1, ...v), n = v.length;
  const pts = v.map((x, i) => `${(100 - (i * 100) / Math.max(1, n - 1)).toFixed(1)},${(20 - (x / mx) * 18).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 100 22" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.3" vector-effect="non-scaling-stroke"/></svg>`;
}
