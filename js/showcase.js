// «اكتشف الحكايات»: a swipeable carousel of story covers + a row of category links, shown on the
// account page and the sign-in / reading-gate page (signed in or not). Data: the visible catalogue
// (STORIES already drops drafts and admin-hidden stories) and the published categories.
// Touch swipe and keyboard use native scrolling with scroll-snap; arrows on wider screens;
// autoplay (off with reduced motion) pauses on hover / focus and stops after any manual move.
import { t, fnum } from './i18n.js';
import { ic } from './icons.js';
import { esc } from './ui.js';
import { STORIES } from '../content/catalog.js';
import { CATEGORIES, DEFAULT_CATEGORY, catName, category, accentOf } from './categories.js';
import { bookCover } from './pages/library.js';

const AUTO_MS = 4500;
let nid = 0;

export function showcase() {
  const list = STORIES.filter((s) => s.ready).concat(STORIES.filter((s) => !s.ready));
  if (!list.length) return '';
  const id = 'scs' + (++nid);
  const card = (s, i) => {
    const c = category(s.category || DEFAULT_CATEGORY);
    return `<li class="scs-it" data-cat="${accentOf(c)}" role="group" aria-roledescription="${t('scs.slide')}" aria-label="${t('scs.of', { i: fnum(i + 1), n: fnum(list.length) })}">
      <a class="bk${c && c.kid_friendly ? ' kid' : ''}${s.ready ? '' : ' soon'}" href="#/story/${s.id}">${bookCover(s, c, i)}
        <b>${esc(s.title)}</b><span class="scs-tags"><span class="scs-cat">${esc(catName(c))}</span>${s.underReview ? `<span class="revtag">${t('rev.badge')}</span>` : ''}${s.ready ? '' : `<span class="scs-soon">${t('story.soon')}</span>`}</span></a></li>`;
  };
  const n = (slug) => STORIES.filter((s) => (s.category || DEFAULT_CATEGORY) === slug).length;
  const cats = CATEGORIES.map((c) => `<li data-cat="${accentOf(c)}"><a class="scs-chip" href="#/c/${c.slug}"><span class="sw8"></span>${esc(catName(c))}<small class="tnum">${n(c.slug) ? fnum(n(c.slug)) : t('story.soon')}</small></a></li>`).join('');
  return `<section class="showc" id="${id}" aria-roledescription="${t('scs.carousel')}" aria-labelledby="${id}-h">
    <div class="scs-head"><div><span class="kicker">${t('scs.kicker')}</span><h2 id="${id}-h">${t('scs.title')}</h2></div>
      <div class="scs-ctl"><button type="button" class="iconbtn scs-pause" data-scs="pause" aria-pressed="false" aria-label="${t('scs.pause')}" hidden>${ic('pause')}</button>
        <button type="button" class="iconbtn scs-arr" data-scs="prev" aria-controls="${id}-t" aria-label="${t('scs.prev')}">${ic('back')}</button>
        <button type="button" class="iconbtn scs-arr" data-scs="next" aria-controls="${id}-t" aria-label="${t('scs.next')}">${ic('fwd')}</button></div></div>
    <ul class="scs-track" id="${id}-t" tabindex="0" aria-label="${t('scs.title')}">${list.map(card).join('')}</ul>
    <nav aria-label="${t('lib.sections')}"><ul class="scs-cats">${cats}</ul></nav>
  </section>`;
}

// Wire every carousel inside root. Returns a cleanup function.
export function bindShowcase(root) {
  const offs = [];
  root.querySelectorAll('.showc').forEach((box) => {
    const tr = box.querySelector('.scs-track');
    const pauseBtn = box.querySelector('[data-scs=pause]');
    const rtl = () => getComputedStyle(tr).direction === 'rtl';
    const step = () => { const it = tr.querySelector('.scs-it'); return it ? it.getBoundingClientRect().width + parseFloat(getComputedStyle(tr).columnGap || 0) : tr.clientWidth; };
    const pos = () => Math.abs(tr.scrollLeft);                        // RTL scrollLeft runs negative
    const atEnd = () => pos() + tr.clientWidth >= tr.scrollWidth - 4;
    const atStart = () => pos() <= 4;
    const smooth = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
    const move = (dir) => tr.scrollBy({ left: dir * step() * (rtl() ? -1 : 1), behavior: smooth() });
    const arrows = () => {
      box.querySelector('[data-scs=prev]').disabled = atStart();
      box.querySelector('[data-scs=next]').disabled = atEnd();
    };
    let timer = null, stopped = matchMedia('(prefers-reduced-motion: reduce)').matches, hover = false;
    const tick = () => { if (hover || document.hidden) return; if (atEnd()) tr.scrollTo({ left: 0, behavior: smooth() }); else move(1); };
    const play = () => { clearInterval(timer); timer = null; if (!stopped && tr.scrollWidth > tr.clientWidth + 4) timer = setInterval(tick, AUTO_MS); };
    const stop = () => { stopped = true; clearInterval(timer); timer = null; if (pauseBtn) { pauseBtn.setAttribute('aria-pressed', 'true'); pauseBtn.setAttribute('aria-label', t('scs.play')); pauseBtn.innerHTML = ic('play'); } };
    if (pauseBtn && !stopped) pauseBtn.hidden = false;
    const onClick = (e) => {
      const b = e.target.closest('[data-scs]');
      if (!b) return;
      if (b.dataset.scs === 'pause') {
        if (stopped) { stopped = false; pauseBtn.setAttribute('aria-pressed', 'false'); pauseBtn.setAttribute('aria-label', t('scs.pause')); pauseBtn.innerHTML = ic('pause'); play(); }
        else stop();
        return;
      }
      stop(); move(b.dataset.scs === 'next' ? 1 : -1);
    };
    const manual = () => stop();
    const enter = () => { hover = true; }, leave = () => { hover = false; };
    box.addEventListener('click', onClick);
    tr.addEventListener('pointerdown', manual); tr.addEventListener('touchstart', manual, { passive: true }); tr.addEventListener('wheel', manual, { passive: true });
    tr.addEventListener('keydown', manual);
    box.addEventListener('pointerenter', enter); box.addEventListener('pointerleave', leave);
    box.addEventListener('focusin', enter); box.addEventListener('focusout', leave);
    tr.addEventListener('scroll', arrows, { passive: true });
    addEventListener('resize', arrows);
    requestAnimationFrame(() => { arrows(); play(); });
    offs.push(() => { clearInterval(timer); removeEventListener('resize', arrows); });
  });
  return () => offs.forEach((f) => f());
}
