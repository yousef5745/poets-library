import { t } from '../i18n.js';
import { ic, ornament } from '../icons.js';
import { header, footer, esc, img, $ } from '../ui.js';
import { storyMeta, eraName } from '../../content/catalog.js';
import { S, done, endings, chk, saveNow } from '../store.js';
import { canRead, isFreeChapter, freeCount } from '../access.js';

export const splitTitle = (title) => { const i = title.indexOf(':'); return i < 0 ? ['', title] : [title.slice(0, i).trim(), title.slice(i + 1).trim()]; };

function art(m) {
  return `<div class="sart" style="background-image:url(${img(m.cover)})">${m.portrait ? `<img src="${img(m.portrait)}" alt="${esc(m.poet)}">` : ''}</div>`;
}

export default function storyPage(id) {
  const m = storyMeta(id);
  const app = $('#app');
  if (!m) { location.hash = '#/'; return; }
  if (!m.ready) {
    app.innerHTML = `${header('library')}<main id="main" class="wrap">
      <nav class="crumb"><a href="#/">${t('sp.crumbLib')}</a> / ${eraName(m.era)}</nav>
      <section class="shero">${art(m)}<div class="stxt">
        <div class="kicker">${eraName(m.era)}</div><h1>${esc(m.title)}</h1><div class="poet">${esc(m.poet)} · ${esc(m.sub)}</div>
        <p class="syn">${esc(m.synopsis)}</p>
        <div class="panel"><h3>${t('sp.soonTitle')}</h3><p>${t('sp.soonBody')}</p></div>
        <a class="btn ghost" href="#/">${ic('back')}${t('sp.crumbLib')}</a>
      </div></section></main>${footer()}`;
    return;
  }
  app.innerHTML = `${header('library')}<main id="main"><div class="wrap"><p class="loading">…</p></div></main>`;
  m.load().then(({ story, notes }) => draw(m, story, notes));
}

function draw(m, story, notes) {
  const app = $('#app');
  const run = S.runs[m.id];
  const dn = done(m.id), en = endings(m.id);
  const chapters = story.chapters;
  const curIdx = run ? Math.max(0, chapters.findIndex((c) => c.id === run.chap)) : -1;
  const curTitle = curIdx >= 0 ? splitTitle(chapters[curIdx].title)[0] : '';
  const primary = run
    ? `<a class="btn pri" href="#/read/${m.id}">${ic('book')}${t('sp.continue', { ch: curTitle })}</a>`
    : `<a class="btn pri" href="#/read/${m.id}">${ic('book')}${t('sp.start')}</a>`;

  const rows = chapters.map((c, i) => {
    const [num, name] = splitTitle(c.title);
    const open = i === 0 || dn[chapters[i - 1].id];
    const readable = canRead(m, i);
    const isCur = curIdx === i;
    let status, cls = '', href = null;
    if (!readable) { status = `<span class="st lockred">${ic('lock')}${t('sp.chMembers')}</span>`; cls = 'lock'; href = '#/pricing'; }
    else if (isCur) { status = `<span class="st cur">${t('sp.chCurrent')}</span>`; cls = 'cur'; href = `#/read/${m.id}`; }
    else if (dn[c.id]) { status = `<span class="st">${ic('check')}${t('sp.chDone')}</span>`; cls = 'done'; href = `#/read/${m.id}/${c.id}`; }
    else if (!open) { status = `<span class="st">${ic('lock')}${t('sp.chLocked')}</span>`; cls = 'wait'; }
    else { status = ''; href = `#/read/${m.id}/${c.id}`; }
    const free = isFreeChapter(m, i) ? `<span class="tagfree">${t('sp.chFree')}</span>` : '';
    const inner = `<span class="cn">${i + 1}</span><span class="ct"><b>${esc(name)}</b><small>${esc(num)}</small></span><span class="cs">${free}${status}</span>`;
    return `<li>${href ? `<a class="chap ${cls}" href="${href}">${inner}</a>` : `<div class="chap ${cls}" aria-disabled="true">${inner}</div>`}</li>`;
  }).join('');

  const ends = Object.entries(story.endings).map(([k, e]) =>
    `<li class="${en[k] ? 'got' : ''}">${ic(en[k] ? 'check' : 'lock')}<span><b>${en[k] ? esc(e.title) : '؟'}</b>${en[k] ? `<small>${esc(e.desc)}</small>` : `<small>${t('sp.endingUnknown')}</small>`}</span></li>`).join('');
  const gotEnds = Object.keys(story.endings).filter((k) => en[k]).length;

  app.innerHTML = `${header('library')}<main id="main" class="storypg">
  <div class="wrap">
    <nav class="crumb"><a href="#/">${t('sp.crumbLib')}</a> / ${eraName(m.era)} / ${esc(m.poet)}</nav>
    <section class="shero">${art(m)}
      <div class="stxt">
        <div class="kicker">${eraName(m.era)}</div>
        <h1>${esc(m.title)}</h1>
        <div class="poet">${esc(m.poet)} · ${esc(m.sub)}</div>
        <p class="syn">${esc(m.synopsis)}</p>
        <dl class="stats">
          <div><dt>${t('sp.stChapters')}</dt><dd>${chapters.length}</dd></div>
          <div><dt>${t('sp.stMinutes')}</dt><dd>${m.minutes}</dd></div>
          <div><dt>${t('sp.stEndings')}</dt><dd>${gotEnds}/${Object.keys(story.endings).length}</dd></div>
          <div><dt>${t('sp.stVerses')}</dt><dd>${m.verses}</dd></div>
        </dl>
        <div class="actions">${primary}${run ? `<button class="btn ghost" data-a="restart">${ic('restart')}${t('sp.restart')}</button>` : ''}</div>
        <p class="fine">${ic('book')}${t('story.freeNote')}</p>
      </div>
    </section>
    <div class="sbody">
      <section class="chapters"><h2>${t('sp.chapters')}</h2><ol class="chlist">${rows}</ol></section>
      <aside class="sside">
        <div class="panel verse"><div class="kicker">${t('sp.verseHead')}</div>${ornament}<p class="bayt">${esc(m.verse[0])}</p><p class="bayt">${esc(m.verse[1])}</p><small>${esc(m.poet)}</small></div>
        <div class="panel"><h3>${t('sp.endings')} <small>${gotEnds}/${Object.keys(story.endings).length}</small></h3><ul class="ends">${ends}</ul></div>
        <div class="panel"><h3>${t('sp.aboutPoet')}</h3><p>${esc(m.poetBio)}</p><p class="src"><b>${t('sp.sources')}:</b> ${esc(m.sources)}</p></div>
        ${notes && notes.length ? `<div class="panel notes"><h3>${t('sp.history')}</h3><ul>${notes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      </aside>
    </div>
  </div>
  <div class="stickycta"><div class="wrap">${primary}</div></div>
  </main>${footer()}`;

  // The sticky button shows only once the hero button has scrolled out of view.
  const cta = app.querySelector('.stickycta'), heroBtn = app.querySelector('.actions .btn');
  if (cta && heroBtn && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => cta.classList.toggle('show', !e.isIntersecting && e.boundingClientRect.top < 0)).observe(heroBtn);
  }
  app.querySelector('[data-a="restart"]')?.addEventListener('click', () => {
    delete S.runs[m.id]; S.chk[m.id] = {}; saveNow();
    location.hash = `#/read/${m.id}`;
  });
}
