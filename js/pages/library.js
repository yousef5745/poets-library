import { t } from '../i18n.js';
import { ic, ornament } from '../icons.js';
import { header, footer, esc, img, $ } from '../ui.js';
import { STORIES, ERAS, eraName } from '../../content/catalog.js';
import { S } from '../store.js';
import { freeCount } from '../access.js';

// Arabic search normalisation: drop tashkeel and tatweel, unify alef / ta marbuta / ya forms.
export function norm(s) {
  return String(s).replace(/[\u064B-\u0652\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase().trim();
}

const f = { q: '', era: 'all', access: 'all', status: 'all' };

function cover(s, i) {
  return `<div class="cov" style="background-image:url(${img(s.cover)})">
    ${s.ready && s.portrait ? `<img class="cov-por" src="${img(s.portrait)}" alt="" loading="lazy">` : ''}
    <span class="num">${String(i + 1).padStart(2, '0')}</span></div>`;
}

function card(s, i) {
  const meta = s.ready
    ? `<span>${ic('book')}${t('story.chapters', { n: s.chapters || 5 })}</span><span>${ic('clock')}${t('story.minutes', { n: s.minutes })}</span><span class="fr">${t('card.free', { n: freeCount(s) })}</span>`
    : `<span class="soonlbl">${t('story.soon')}</span>`;
  return `<li><a class="card${s.ready ? '' : ' soon'}" href="#/story/${s.id}">
    ${cover(s, i)}
    <div class="cbody">
      <div class="kicker">${eraName(s.era)}${s.trio ? ` · ${t('trio.' + s.trio)}` : ''}</div>
      <h3>${esc(s.title)}</h3>
      <div class="poet">${esc(s.poet)}</div>
      <p class="syn">${esc(s.synopsis)}</p>
      <div class="meta">${meta}</div>
    </div></a></li>`;
}

function filtered() {
  const q = norm(f.q);
  return STORIES.filter((s) =>
    (f.era === 'all' || s.era === f.era) &&
    (f.status === 'all' || (f.status === 'ready') === s.ready) &&
    (f.access === 'all' || (s.ready && freeCount(s) > 0)) &&
    (!q || norm(`${s.title} ${s.poet} ${s.sub} ${s.synopsis}`).includes(q)));
}

function continueCard() {
  const sid = Object.keys(S.runs || {}).find((k) => S.runs[k] && S.runs[k].chap);
  if (!sid) return '';
  const s = STORIES.find((x) => x.id === sid);
  if (!s) return '';
  const n = Number(String(S.runs[sid].chap).replace(/\D/g, '')) || 1;
  return `<a class="contcard" href="#/read/${sid}">
    <img src="${img(s.portrait || s.cover)}" alt="">
    <div><div class="kicker">${t('home.lastRead')}</div><b>${esc(s.title)}</b><small>${t('home.continueAt', { ch: 'الفصل ' + n })}</small></div>
    <span class="btn pri sm">${t('home.continue')}${ic('fwd')}</span></a>`;
}

function opt(group, val, label) {
  return `<button class="chip${f[group] === val ? ' on' : ''}" data-f="${group}" data-v="${val}" aria-pressed="${f[group] === val}">${label}</button>`;
}

function results() {
  const list = filtered();
  $('#count').textContent = t('home.results', { n: list.length });
  $('#cards').innerHTML = list.length ? list.map((s) => card(s, STORIES.indexOf(s))).join('') : `<li class="empty">${t('home.noResults')}</li>`;
  document.querySelectorAll('[data-f]').forEach((b) => { const on = f[b.dataset.f] === b.dataset.v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
}

export default function library() {
  const app = $('#app');
  app.innerHTML = `${header('library')}
  <main id="main">
    <section class="hero"><div class="wrap">
      ${ornament}
      <h1>${t('home.title')}</h1>
      <p class="lead">${t('home.lead')}</p>
      <label class="search"><span class="sr">${t('home.searchLabel')}</span>${ic('search')}<input id="q" type="search" placeholder="${t('home.searchPh')}" value="${esc(f.q)}" autocomplete="off"></label>
    </div></section>
    <div class="eratabs" role="toolbar" aria-label="${t('home.era')}"><div class="wrap eratabs-in">
      ${opt('era', 'all', t('era.all'))}${ERAS.map((e) => opt('era', e.id, e.name)).join('')}
    </div></div>
    <div class="wrap">${continueCard()}</div>
    <div class="wrap libgrid">
      <aside class="filters" aria-label="${t('home.filters')}">
        <div class="fgroup"><h4>${t('home.status')}</h4>${opt('status', 'all', t('status.all'))}${opt('status', 'ready', t('status.ready'))}${opt('status', 'soon', t('status.soon'))}</div>
        <div class="fgroup"><h4>${t('home.access')}</h4>${opt('access', 'all', t('access.all'))}${opt('access', 'free', t('access.free'))}</div>
      </aside>
      <section>
        <div class="reshead"><h2>${t('home.allStories')}</h2><small id="count"></small></div>
        <ul class="cards" id="cards"></ul>
      </section>
    </div>
  </main>${footer()}`;
  results();
  const q = $('#q');
  q.addEventListener('input', () => { f.q = q.value; results(); });
  app.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { f[b.dataset.f] = b.dataset.v; results(); }));
}
