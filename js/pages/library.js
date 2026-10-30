// Library (spec section 4): hero, category folio tabs, "الكل" = one shelf per category,
// #/c/:slug = one category with search, era chips and filters. Empty categories show
// a "coming soon" panel (the user's rule; the spec hides them, see report).
import { t, fnum, freeText } from '../i18n.js';
import { ic, ornament } from '../icons.js';
import { header, footer, esc, img, $ } from '../ui.js';
import { installSlot } from '../pwa.js';
import { STORIES, ERAS, eraName } from '../../content/catalog.js';
import { S } from '../store.js';
import { freeCount } from '../access.js';
import { CATEGORIES, DEFAULT_CATEGORY, catName, catDesc, category, accentOf, ornamentSvg, PATTERN } from '../categories.js';

// Arabic search normalisation: drop tashkeel and tatweel, unify alef / ta marbuta / ya forms.
export function norm(s) {
  return String(s).replace(/[\u064B-\u0652\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase().trim();
}

const ALL = 'all';
const f = { q: '', era: 'all', access: 'all', status: 'all', cat: ALL };
const catOf = (s) => s.category || DEFAULT_CATEGORY;
const inCat = (slug) => (s) => catOf(s) === slug;
const match = (s) => { const q = norm(f.q); return !q || norm(`${s.title} ${s.poet} ${s.sub || ''} ${s.synopsis || ''}`).includes(q); };

// Cover by the category's rules, not its colour: no-images -> geometric pattern + cartouche,
// kids -> rounded picture, image covers -> scene + portrait, no art yet -> typographic.
function bookCover(s, c, i) {
  const kid = !!(c && c.kid_friendly);
  const age = s.minAge || (c && c.min_age);
  if (s.noCharImages || (c && c.no_character_images)) return `<span class="cv geo">${PATTERN()}<span class="cart">${esc(s.title)}</span></span>`;
  if (kid && s.cover) return `<span class="cv kid"><img src="${img(s.cover)}" alt="" loading="lazy">${age ? `<span class="badge">${t('lib.age', { n: fnum(age) })}</span>` : ''}</span>`;
  // plays: the scene behind a drawn stage curtain (css .cv.stage)
  if (s.cover && c && accentOf(c) === 'plays') return `<span class="cv img stage" style="background-image:url(${img(s.cover)})"><span class="pelmet"></span>${s.ready && s.portrait ? `<img src="${img(s.portrait)}" alt="" loading="lazy">` : ''}<span class="badge tnum">${String(i + 1).padStart(2, '0')}</span></span>`;
  if (s.cover) return `<span class="cv img" style="background-image:url(${img(s.cover)})">${s.ready && s.portrait ? `<img src="${img(s.portrait)}" alt="" loading="lazy">` : ''}<span class="badge tnum">${String(i + 1).padStart(2, '0')}</span></span>`;
  return `<span class="cv typo">${ornamentSvg({ ornament: 'rule' })}<span class="t">${esc(s.title)}</span><span class="r"></span><span class="a">${esc(s.poet || '')}</span></span>`;
}
const revTag = (s) => (s.underReview ? `<span class="revtag">${t('rev.badge')}</span>` : '');
const metaLine = (s) => (s.ready ? `${t('story.chapters', { n: fnum(s.chapters || 5) })} · ${t('story.minutes', { n: fnum(s.minutes) })}${revTag(s)}` : t('story.soon'));
const book = (s, c, i) => `<li><a class="bk${c && c.kid_friendly ? ' kid' : ''}${s.ready ? '' : ' soon'}" href="#/story/${s.id}">${bookCover(s, c, i)}<b>${esc(s.title)}</b><span class="by">${esc(s.poet || '')}</span><span class="mt">${metaLine(s)}</span></a></li>`;

// Categories that have stories first; empty ones («قريبًا») after them, each group in admin order.
const byFilled = () => { const n = (c) => STORIES.filter(inCat(c.slug)).length; return [...CATEGORIES.filter((c) => n(c)), ...CATEGORIES.filter((c) => !n(c))]; };

function catTabs() {
  const tab = (slug, label, n, acc) => {
    const on = f.cat === slug;
    return `<li data-cat="${acc}"${n === 0 ? ' class="soonc"' : ''}><a class="cattab${on ? ' on' : ''}" href="${slug === ALL ? '#/' : '#/c/' + slug}"${on ? ' aria-current="page"' : ''}>${slug === ALL ? '' : '<span class="sw8"></span>'}${esc(label)}${n === null ? '' : n ? `<small class="tnum">${fnum(n)}</small>` : `<small>${t('story.soon')}</small>`}</a></li>`;
  };
  return `<nav class="cattabs" aria-label="${t('lib.sections')}"><div class="wrap" style="padding-inline:0"><ul>${tab(ALL, t('lib.all'), null, 'poets')}${byFilled().map((c) =>
    tab(c.slug, catName(c), STORIES.filter(inCat(c.slug)).length, accentOf(c))).join('')}</ul></div></nav>`;
}

function soonBox(c, big) {
  const notes = [c.kid_friendly ? `${ic('heart')}${t('cat.kids', { n: c.min_age || '' })}` : '', c.no_character_images ? `${ic('book')}${t('cat.noImages')}` : ''].filter(Boolean);
  return `<div class="catsoon${big ? ' big' : ''}">${big ? ornamentSvg(c) : ''}<span class="kicker">${t('story.soon')}</span>${big ? `<h1>${esc(catName(c))}</h1><p class="lead">${esc(catDesc(c))}</p>` : ''}
    ${notes.map((n) => `<p class="fine">${n}</p>`).join('')}<p class="catsoon-note">${t('cat.soonNote')}</p>${big ? `<a class="btn ghost sm" href="#/">${t('lib.backAll')}</a>` : ''}</div>`;
}

function shelf(c, list) {
  const acc = accentOf(c);
  const note = c.no_character_images ? `<p class="shelfnote">${ic('book')}<span>${t('lib.noImgNote')}</span></p>` : '';
  const all = STORIES.filter(inCat(c.slug));
  return `<section class="shelf" data-cat="${acc}" aria-labelledby="sh-${esc(c.slug)}"><header class="shelfhead">${ornamentSvg(c)}<h2 id="sh-${esc(c.slug)}">${esc(catName(c))}</h2><p>${esc(catDesc(c))}</p>
    ${all.length ? `<a class="more" href="#/c/${c.slug}">${t('lib.seeAll', { n: fnum(all.length) })}${ic('fwd')}</a>` : ''}</header>
    ${list.length ? `<ul class="rack">${list.slice(0, 4).map((s) => book(s, c, STORIES.indexOf(s))).join('')}</ul>${note}` : soonBox(c, false)}</section>`;
}

function continueCard() {
  const sid = Object.keys(S.runs || {}).find((k) => S.runs[k] && S.runs[k].chap);
  const s = sid && STORIES.find((x) => x.id === sid);
  if (!s) return '';
  const n = Number(String(S.runs[sid].chap).replace(/\D/g, '')) || 1;
  return `<div class="wrap"><a class="contcard" href="#/read/${sid}"><img src="${img(s.portrait || s.cover)}" alt=""><div><small>${t('home.lastRead')}</small><b>${esc(s.title)}</b><small>${t('lib.chOf', { c: fnum(n), n: fnum(s.chapters || n) })}</small></div><span class="btn pri sm">${t('home.continue')}${ic('fwd')}</span></a></div>`;
}

const searchBox = (ph) => `<label class="search"><span class="sr">${t('home.searchLabel')}</span>${ic('search')}<input id="q" type="search" placeholder="${ph}" value="${esc(f.q)}" autocomplete="off"></label>`;

// ------------------------------------------------------------ الكل
function shelves() {
  const q = !!norm(f.q);
  const html = byFilled().map((c) => { const list = STORIES.filter((s) => catOf(s) === c.slug && match(s)); return q && !list.length ? '' : shelf(c, list); }).join('');
  return html || `<p class="empty">${t('home.noResults')}</p>`;
}
function allView(app) {
  app.innerHTML = `${header('library')}<main id="main">
    <section class="lhero"><div class="wrap">${ornament}<h1>${t('lib.title')}</h1><p class="lead" style="margin-inline:auto">${t('lib.lead')}</p>${searchBox(t('lib.searchPh'))}${installSlot('lib')}</div></section>
    ${catTabs()}${continueCard()}<div class="wrap" id="shelves">${shelves()}</div></main>${footer()}`;
  const q = $('#q');
  q.addEventListener('input', () => { f.q = q.value; $('#shelves').innerHTML = shelves(); });
}

// ------------------------------------------------------------ one category
function opt(group, val, label) {
  return `<button class="chip${f[group] === val ? ' on' : ''}" data-f="${group}" data-v="${val}" aria-pressed="${f[group] === val}">${label}</button>`;
}
function cover(s, i) {
  if (s.noCharImages) return `<div class="cov geo">${PATTERN()}<span class="num">${String(i + 1).padStart(2, '0')}</span></div>`;
  return `<div class="cov" style="background-image:url(${img(s.cover)})">${s.ready && s.portrait ? `<img class="cov-por" src="${img(s.portrait)}" alt="" loading="lazy">` : ''}<span class="num">${String(i + 1).padStart(2, '0')}</span></div>`;
}
function card(s, i) {
  const meta = s.ready
    ? `<span>${ic('book')}${t('story.chapters', { n: fnum(s.chapters || 5) })}</span><span>${ic('clock')}${t('story.minutes', { n: fnum(s.minutes) })}</span><span class="fr">${freeText(freeCount(s), s.chapters)}</span>${revTag(s)}`
    : `<span class="soonlbl">${t('story.soon')}</span>`;
  return `<li><a class="card${s.ready ? '' : ' soon'}" href="#/story/${s.id}">${cover(s, i)}<div class="cbody">
      <div class="kicker">${eraName(s.era)}${s.trio ? ` · ${t('trio.' + s.trio)}` : ''}${s.kid && s.minAge ? ` · ${t('lib.age', { n: fnum(s.minAge) })}` : ''}</div>
      <h3>${esc(s.title)}</h3><div class="poet">${esc(s.poet)}</div><p class="syn">${esc(s.synopsis)}</p><div class="meta">${meta}</div></div></a></li>`;
}
function filtered() {
  return STORIES.filter((s) => catOf(s) === f.cat && (f.era === 'all' || s.era === f.era) &&
    (f.status === 'all' || (f.status === 'ready') === s.ready) && (f.access === 'all' || (s.ready && freeCount(s) > 0)) && match(s));
}
function results() {
  const list = filtered();
  $('#count').textContent = t('home.results', { n: fnum(list.length) });
  $('#cards').innerHTML = list.length ? list.map((s) => card(s, STORIES.indexOf(s))).join('') : `<li class="empty">${t('home.noResults')}</li>`;
  document.querySelectorAll('[data-f]').forEach((b) => { const on = f[b.dataset.f] === b.dataset.v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
}
function catView(app, c) {
  const acc = accentOf(c);
  const list = STORIES.filter(inCat(c.slug));
  if (!list.length) { app.innerHTML = `${header('library')}<main id="main">${catTabs()}<div class="wrap" data-cat="${acc}">${soonBox(c, true)}</div></main>${footer()}`; return; }
  const eras = ERAS.filter((e) => list.some((s) => s.era === e.id));
  app.innerHTML = `${header('library')}<main id="main">
    <section class="lhero" data-cat="${acc}"><div class="wrap">${ornamentSvg(c)}<h1 class="cat-h">${esc(catName(c))}</h1><p class="lead" style="margin-inline:auto">${esc(catDesc(c))}</p>${searchBox(t('home.searchPh'))}</div></section>
    ${catTabs()}
    ${eras.length > 1 ? `<div class="eratabs" role="toolbar" aria-label="${t('home.era')}"><div class="wrap eratabs-in">${opt('era', 'all', t('era.all'))}${eras.map((e) => opt('era', e.id, e.name)).join('')}</div></div>` : ''}
    ${continueCard()}
    <div class="wrap libgrid" data-cat="${acc}">
      <aside class="filters" aria-label="${t('home.filters')}">
        <div class="fgroup"><h4>${t('home.status')}</h4>${opt('status', 'all', t('status.all'))}${opt('status', 'ready', t('status.ready'))}${opt('status', 'soon', t('status.soon'))}</div>
        <div class="fgroup"><h4>${t('home.access')}</h4>${opt('access', 'all', t('access.all'))}${opt('access', 'free', t('access.free'))}</div>
        ${c.no_character_images ? `<p class="shelfnote">${ic('book')}<span>${t('lib.noImgNote')}</span></p>` : ''}
      </aside>
      <section><div class="reshead"><h2>${t('lib.inCat', { c: esc(catName(c)) })}</h2><small id="count"></small></div><ul class="cards" id="cards"></ul></section>
    </div></main>${footer()}`;
  results();
  const q = $('#q');
  q.addEventListener('input', () => { f.q = q.value; results(); });
  app.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { f[b.dataset.f] = b.dataset.v; results(); }));
}

export default function library(slug) {
  const app = $('#app');
  const c = slug && category(slug);
  const visible = c && CATEGORIES.includes(c);
  if (slug && !visible) { location.hash = '#/'; return; }
  const next = visible ? slug : ALL;
  if (next !== f.cat) { f.cat = next; f.era = 'all'; }
  if (next === ALL) allView(app); else catView(app, c);
}
