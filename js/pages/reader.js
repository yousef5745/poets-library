import { t, pearlsWord } from '../i18n.js';
import { ic, ornament } from '../icons.js';
import { $, esc, img, sheet, closeSheet, sheetOpen, toast } from '../ui.js';
import { storyMeta } from '../../content/catalog.js';
import { S, save, saveNow, done, endings, chk } from '../store.js';
import { canRead } from '../access.js';
import { freshRun, clone, cond, applyFx, unmet, resolveRoute } from '../engine.js';
import { splitTitle } from './story.js';
import * as audio from '../audio.js';

const SIZES = { s: 20, m: 22, l: 25 };

export default function reader(sid, chapId) {
  const meta = storyMeta(sid);
  if (!meta || !meta.ready) { location.hash = '#/'; return; }
  document.body.classList.add('in-reader');
  applyPrefs();
  $('#app').innerHTML = `<div class="reader"><p class="loading">…</p></div>`;
  let R = null; // reader context
  let alive = true;
  meta.load().then((mod) => {
    if (!alive) return;
    R = makeReader(meta, mod);
    R.boot(chapId);
  });
  return () => { alive = false; if (R) R.destroy(); audio.stop(); document.body.classList.remove('in-reader'); };
}

export function applyPrefs() {
  document.body.dataset.theme = S.prefs.theme === 'night' ? 'night' : 'day';
  document.documentElement.style.setProperty('--read-size', SIZES[S.prefs.size] + 'px');
}

function makeReader(meta, mod) {
  const story = mod.story, CH = mod.chars, NAMES = { stats: mod.stats, rels: mod.rels };
  const sid = meta.id;
  const chapters = story.chapters;
  let run = S.runs[sid] || null;
  let curBg = null;
  const chIdx = (cid) => chapters.findIndex((c) => c.id === cid);
  const chap = (cid) => chapters[chIdx(cid)];
  const heroImg = () => CH.hero.looks[S.look] || 'antara1';
  const charImg = (id, e) => (id === 'hero' ? heroImg() : (CH[id].img[e] || CH[id].img.n));

  function layout() {
    $('#app').innerHTML = `<div class="reader" id="reader">
      <header class="rtop">
        <a class="iconbtn" href="#/story/${sid}" aria-label="${t('r.back')}">${ic('back')}</a>
        <div class="rtitle"><b>${esc(story.title)}</b><small id="rch"></small></div>
        <button class="pearls" data-r="pearls" aria-label="${t('r.pearls')}">${ic('pearl')}<b id="pc">${S.pearls}</b><span>${t('r.pearls')}</span></button>
        <button class="iconbtn" data-r="map" aria-label="${t('r.map')}" title="${t('r.map')}">${ic('map')}</button>
        <button class="iconbtn" data-r="settings" aria-label="${t('r.settings')}" title="${t('r.settings')}">${ic('settings')}</button>
        <div class="rprog"><i id="rprog"></i></div>
      </header>
      <div class="rbody">
        <div class="rmain">
          <div class="stage" id="stage" data-r="adv"><div class="bg" id="bgA"></div><div class="bg" id="bgB"></div><div id="sprs"></div></div>
          <div class="panel-r" id="ui" aria-live="polite"></div>
        </div>
        <aside class="rside" id="rside"></aside>
      </div>
    </div>`;
  }

  function setBg(k, inst) {
    if (curBg === k) return; curBg = k;
    const a = $('#bgA'), b = $('#bgB');
    if (!a) return;
    if (inst || !a.style.backgroundImage) { a.style.backgroundImage = `url(${img(k)})`; a.style.opacity = 1; b.style.opacity = 0; return; }
    const top = a.style.opacity === '1' ? b : a, bot = top === a ? b : a;
    top.style.backgroundImage = `url(${img(k)})`; top.style.opacity = 1; bot.style.opacity = 0;
  }
  function placeSpr(id, pos, e) {
    let el = document.getElementById('sp_' + id);
    if (!el) { el = document.createElement('img'); el.id = 'sp_' + id; el.alt = CH[id].name; el.className = 'spr'; $('#sprs').appendChild(el); }
    el.src = img(charImg(id, e));
    el.dataset.pos = pos;
    requestAnimationFrame(() => el.classList.add('on'));
    run.stage[id] = pos;
  }
  function hideSpr(id) {
    const el = document.getElementById('sp_' + id);
    if (el) { el.classList.remove('on'); setTimeout(() => el.remove(), 350); }
    delete run.stage[id];
  }
  function focus(id) {
    for (const k in run.stage) { const el = document.getElementById('sp_' + k); if (el) { el.classList.toggle('dim', !!id && k !== id); el.classList.toggle('talk', k === id); } }
  }
  function setPearls(n) { S.pearls += n; const e = $('#pc'); if (e) e.textContent = S.pearls; if (n > 0) audio.sfx('pearl'); save(); }
  function fx(f) {
    const r = applyFx(run.st, f, NAMES);
    if (r.pearls) setPearls(r.pearls);
    if (r.msgs.length) toast(r.msgs.join('  ·  '));
  }
  function mode(m) { $('#reader').dataset.mode = m; requestAnimationFrame(fit); }
  // Art takes the room the text leaves, between ~30% (choices, long lines) and ~56% of the reading area.
  function fit() {
    const rm = document.querySelector('.rmain'), st = $('#stage'), ui = $('#ui');
    if (!rm || !st) return;
    if (matchMedia('(orientation:landscape) and (max-height:520px)').matches) { st.style.height = ''; return; }
    const H = rm.clientHeight, desk = innerWidth >= 1024;
    st.style.setProperty('--spr-h', Math.round(H * (desk ? 0.8 : 0.64)) + 'px');
    const m = $('#reader').dataset.mode;
    if (m === 'intro') { st.style.height = Math.round(H * (desk ? 0.62 : 0.6)) + 'px'; return; }
    const c = ui.firstElementChild ? ui.firstElementChild.offsetHeight + 40 : 0;
    const lo = H * (desk ? 0.36 : 0.30), hi = H * (desk ? 0.64 : 0.72);
    st.style.height = Math.round(Math.max(lo, Math.min(hi, H - c - 24))) + 'px';
  }
  function headerInfo() {
    const i = chIdx(run.chap);
    const [num, name] = splitTitle(chapters[i].title);
    $('#rch').textContent = `${num} · ${name}`;
    $('#rprog').style.width = `${((i + (run.node ? 0.5 : 1)) / chapters.length) * 100}%`;
    side();
  }

  /* ---------- side panel / map ---------- */
  function mapHTML() {
    const dn = done(sid);
    return `<div class="rs"><h4>${t('sp.chapters')}</h4><ol class="path">${chapters.map((c, i) => {
      const [num, name] = splitTitle(c.title);
      const cls = c.id === run.chap ? 'c' : dn[c.id] ? 'd' : '';
      const lock = !canRead(meta, i) ? ic('lock') : '';
      return `<li class="${cls}"><span>${esc(name)}</span><small>${esc(num)}</small>${lock}</li>`;
    }).join('')}</ol></div>`;
  }
  function statsHTML() {
    const st = run.st;
    const bar = (icon, l, v) => `<li>${ic(icon)}<span>${l}</span><b>${v}</b><i><u style="width:${Math.max(0, Math.min(100, v * 100 / (story.statMax || 6)))}%"></u></i></li>`;
    return `<div class="rs"><h4>${t('r.stats')}</h4><ul class="statl">${bar('sword', NAMES.stats.fur, st.fur)}${bar('tongue', NAMES.stats.fas, st.fas)}${Object.keys(NAMES.rels).map((k, i) => bar(['heart', 'flag', 'user'][i % 3], NAMES.rels[k], st.rel[k] || 0)).join('')}</ul></div>`;
  }
  function versesHTML() {
    const v = run.verses || [];
    if (!v.length) return '';
    return `<div class="rs"><h4>${t('r.verse')}</h4><ul class="vlist">${v.slice(-3).map((x) => `<li><p>${esc(x[0])}</p><p>${esc(x[1])}</p></li>`).join('')}</ul></div>`;
  }
  function side() { const s = $('#rside'); if (s) s.innerHTML = mapHTML() + statsHTML() + versesHTML() + `<p class="keys">${t('r.keys')}</p>`; }

  /* ---------- chapter flow ---------- */
  function enterChapter(cid) {
    const i = chIdx(cid);
    if (i < 0) return;
    if (!canRead(meta, i)) { paywall(cid); return; }
    const snap = chk(sid)[cid];
    if (snap) run = clone(snap);
    else { run.chap = cid; chk(sid)[cid] = clone({ ...run, node: chap(cid).start, step: 0, stage: {} }); }
    run.chap = cid; run.node = chap(cid).start; run.step = 0; run.stage = {}; run.verses = run.verses || [];
    S.runs[sid] = run; saveNow();
    $('#sprs').innerHTML = ''; curBg = null;
    setBg(story.nodes[run.node].bg, true);
    headerInfo(); mode('intro'); $('#ui').innerHTML = '';
    const [num, name] = splitTitle(chap(cid).title);
    sheet(`<div class="kicker">${esc(story.title)}</div><h2>${esc(num)}</h2><p class="chname">${esc(name)}</p>
      <div class="chcover" style="background-image:url(${img(chap(cid).cover)})"></div>
      <button class="btn pri wide" data-r="play">${t('sp.start')}</button>`, { cls: 'intro', closable: false });
  }
  function play() { closeSheet(true); render(); }

  function render() {
    const nd = story.nodes[run.node];
    if (!nd) { console.error('missing node', run.node); return; }
    setBg(nd.bg);
    const ui = $('#ui');
    while (run.step < nd.steps.length) {
      const st = nd.steps[run.step];
      if (st.show) { for (const k in st.show) placeSpr(k, st.show[k]); run.step++; continue; }
      if (st.hide) { hideSpr(st.hide); run.step++; continue; }
      if (st.fx) { fx(st.fx); run.step++; continue; }
      break;
    }
    if (run.step < nd.steps.length) {
      const st = nd.steps[run.step];
      if (st.v) {
        focus(null); mode('verse'); audio.sfx('verse');
        if (!run.verses.some((x) => x[0] === st.v[0])) run.verses.push(st.v);
        ui.innerHTML = `<div class="dlg verse fade" data-r="adv"><div class="kicker">${t('r.verse')}</div>${ornament}<p class="h">${esc(st.v[0])}</p><p class="h">${esc(st.v[1])}</p><small class="by">${esc(st.by || '')}</small>${st.ex ? `<p class="gloss">${esc(st.ex)}</p>` : ''}${goHint()}</div>`;
        side(); return;
      }
      if (st.n) { focus(null); mode('nar'); ui.innerHTML = `<div class="dlg nar fade" data-r="adv"><p>${esc(st.n)}</p>${goHint()}</div>`; return; }
      if (st.c) {
        if (!(st.c in run.stage)) placeSpr(st.c, st.c === 'hero' ? 'r' : 'l', st.e);
        else if (st.e || st.c !== 'hero') { const el = document.getElementById('sp_' + st.c); if (el) el.src = img(charImg(st.c, st.e)); }
        focus(st.c); mode('dlg');
        ui.innerHTML = `<div class="dlg fade" data-r="adv"><div class="who">${esc(CH[st.c].name)}</div><p>${esc(st.t)}</p>${goHint()}</div>`;
        return;
      }
    }
    if (nd.choices) { focus(null); mode('choice'); ui.innerHTML = choicesHTML(nd); return; }
    if (nd.next) return go(nd.next);
    if (nd.route) return go(resolveRoute(run.st, nd.route));
    if (nd.chapterEnd) return chapterEnd(nd.chapterEnd);
    if (nd.ending) return ending(nd.ending);
  }
  const goHint = () => `<span class="go">${t('r.tapToContinue')}${ic('fwd')}</span>`;

  function choicesHTML(nd) {
    return `<div class="choices fade"><div class="kicker ask">${t('r.whatNow')}</div><ol>${nd.choices.map((c, i) => {
      const miss = unmet(run.st, c.req);
      const poor = c.gem && S.pearls < c.gem;
      const locked = miss.length > 0 || poor;
      let tags = '';
      if (c.req && (c.req.fur || c.req.fas)) {
        const parts = ['fur', 'fas'].filter((k) => c.req[k]).map((k) => `${NAMES.stats[k]} ${c.req[k]}`).join('، ');
        const have = ['fur', 'fas'].filter((k) => c.req[k]).map((k) => run.st[k]).join('، ');
        tags += `<span class="tag req${miss.length ? ' miss' : ''}">${miss.length ? ic('lock') : ''}${t('r.needs', { req: parts, have })}</span>`;
      }
      if (c.gem) tags += `<span class="tag cost${poor ? ' miss' : ''}">${ic(poor ? 'lock' : 'pearl')}${t('r.cost', { cost: pearlsWord(c.gem), have: S.pearls })}</span>`;
      return `<li><button class="choice${c.gem ? ' prem' : ''}${locked ? ' locked' : ''}" data-r="ch" data-v="${i}"${locked ? ' aria-disabled="true"' : ''}><span class="k">${i + 1}</span><span class="ctext">${esc(c.t)}</span>${tags ? `<span class="tags">${tags}</span>` : ''}</button></li>`;
    }).join('')}</ol></div>`;
  }

  function go(id) { run.node = id; run.step = 0; save(); render(); }
  function adv() {
    if (sheetOpen()) return;
    const nd = story.nodes[run.node];
    if (nd && run.step < nd.steps.length) { audio.sfx('tap'); run.step++; save(); render(); }
  }
  function choose(i) {
    const nd = story.nodes[run.node], c = nd.choices && nd.choices[i];
    if (!c) return;
    const miss = unmet(run.st, c.req);
    if (miss.length) { audio.sfx('no'); toast(t('r.needs', { req: miss.map((m) => `${NAMES.stats[m.k]} ${m.need}`).join('، '), have: miss.map((m) => m.have).join('، ') })); return; }
    if (c.gem) {
      if (S.pearls < c.gem) {
        audio.sfx('no');
        sheet(`<h2>${t('r.notEnough')}</h2><p>${t('r.notEnoughBody', { cost: pearlsWord(c.gem), have: S.pearls })}</p><button class="btn pri wide" data-a="sheet-close">${t('r.ok')}</button>`);
        return;
      }
      setPearls(-c.gem);
    }
    audio.sfx('choose'); fx(c.fx); go(c.to);
  }

  function rewardRow(n) { return `<div class="reward">${ic('pearl')}<b>${t('r.reward', { n })}</b></div>`; }

  function chapterEnd(next) {
    const dn = done(sid), first = !dn[run.chap], r = first ? 4 : 1;
    dn[run.chap] = 1; setPearls(r); audio.sfx('end');
    const [num, name] = splitTitle(chap(run.chap).title);
    const nx = chap(next), ni = chIdx(next);
    run.chap = next; run.node = null; run.step = 0; run.stage = {};
    const snap = clone(run); snap.node = nx.start;
    chk(sid)[next] = snap; S.runs[sid] = run; saveNow();
    headerInfo();
    const nextBtn = canRead(meta, ni)
      ? `<button class="btn pri wide" data-r="nextch" data-v="${next}">${t('r.nextChapter')}${ic('fwd')}</button>`
      : `<p class="pw">${ic('lock')}${t('r.paywallBody')}</p><a class="btn pri wide" href="#/pricing">${t('r.subscribe')}</a>`;
    sheet(`<div class="kicker">${t('r.chapterDone', { ch: esc(num) })}</div><h2>${esc(name)}</h2>${rewardRow(r)}${statsHTML()}${nextBtn}<a class="btn ghost wide" href="#/story/${sid}">${t('r.toStory')}</a>`, { closable: false, cls: 'endch' });
  }

  function ending(eid) {
    const en = endings(sid), e = story.endings[eid], first = !en[eid];
    en[eid] = 1; done(sid)[run.chap] = 1;
    if (first) setPearls(6);
    audio.sfx('end');
    delete S.runs[sid]; S.chk[sid] = {}; saveNow();
    const got = Object.keys(story.endings).filter((k) => en[k]).length;
    sheet(`<div class="kicker">${t('r.theEnd')}</div>${ornament}<h2>${esc(e.title)}</h2><p>${esc(e.desc)}</p><p class="fine">${t('r.endingsFound', { a: got, b: Object.keys(story.endings).length })}</p>${first ? rewardRow(6) : ''}
      <a class="btn pri wide" href="#/story/${sid}" data-r="done">${t('r.backToStory')}</a><a class="btn ghost wide" href="#/">${t('r.home')}</a>`, { closable: false, cls: 'ending' });
    $('#reader').dataset.ended = eid;
  }

  function paywall(cid) {
    const c = chap(cid);
    if (c) { setBg(c.cover, true); const [num, name] = splitTitle(c.title); $('#rch').textContent = `${num} · ${name}`; }
    mode('intro');
    sheet(`<div class="kicker">${esc(story.title)}</div><h2>${t('r.paywallTitle')}</h2><p>${t('r.paywallBody')}</p>
      <a class="btn pri wide" href="#/pricing">${t('r.subscribe')}</a><a class="btn ghost wide" href="#/story/${sid}">${t('r.toStory')}</a>`, { closable: false, cls: 'paywall' });
  }

  function settings() {
    const seg = (r, cur, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button data-r="${r}" data-v="${v}" class="${cur === v ? 'on' : ''}" aria-pressed="${cur === v}">${l}</button>`).join('')}</div>`;
    sheet(`<h2>${t('r.settings')}</h2>
      <div class="setrow"><span>${t('r.textSize')}</span>${seg('size', S.prefs.size, [['s', '<span style="font-size:16px">أ</span>'], ['m', '<span style="font-size:20px">أ</span>'], ['l', '<span style="font-size:25px">أ</span>']])}</div>
      <div class="setrow"><span>${t('r.theme')}</span>${seg('theme', S.prefs.theme, [['day', t('r.themeDay')], ['night', t('r.themeNight')]])}</div>
      <div class="setrow"><span>${t('r.sound')}</span>${seg('sound', S.prefs.sound ? 'on' : 'off', [['on', t('r.on')], ['off', t('r.off')]])}</div>
      <p class="preview">${t('r.statsNote')}</p>`, { cls: 'settings' });
  }

  /* ---------- input ---------- */
  function onClick(ev) {
    const el = ev.target.closest('[data-r]');
    if (!el) return;
    const a = el.dataset.r, v = el.dataset.v;
    audio.unlock();
    switch (a) {
      case 'adv': adv(); break;
      case 'ch': choose(+v); break;
      case 'play': play(); break;
      case 'nextch': closeSheet(true); enterChapter(v); break;
      case 'map': sheet(mapHTML() + statsHTML() + versesHTML(), { cls: 'map' }); break;
      case 'settings': settings(); break;
      case 'pearls': sheet(`<h2>${t('r.pearls')}: ${S.pearls}</h2><p>${t('pr.a1')}</p><button class="btn pri wide" data-a="sheet-close">${t('r.ok')}</button>`); break;
      case 'size': S.prefs.size = v; saveNow(); applyPrefs(); settings(); fit(); break;
      case 'theme': S.prefs.theme = v; saveNow(); applyPrefs(); settings(); break;
      case 'sound': S.prefs.sound = v === 'on'; saveNow(); audio.setOn(S.prefs.sound); settings(); break;
    }
  }
  function onKey(ev) {
    if (sheetOpen()) {
      if ((ev.key === 'Enter' || ev.key === ' ') && document.querySelector('#sheet [data-r="play"]')) { ev.preventDefault(); play(); }
      return;
    }
    if (ev.target.closest('input,textarea')) return;
    if (ev.key === ' ' || ev.key === 'Enter') {
      if (ev.target.closest('button,a') && ev.key === 'Enter') return;
      ev.preventDefault(); adv();
    } else if (/^[1-9]$/.test(ev.key)) { choose(+ev.key - 1); }
  }

  return {
    boot(chapId) {
      layout();
      document.addEventListener('click', onClick);
      document.addEventListener('keydown', onKey);
      addEventListener('resize', fit);
      audio.setOn(S.prefs.sound, true);
      if (!run) run = freshRun(sid);
      if (chapId) {
        const i = chIdx(chapId);
        const open = i === 0 || done(sid)[chapters[i - 1]?.id];
        if (i < 0 || !open) { location.hash = `#/story/${sid}`; return; }
        if (run.chap === chapId && run.node) { resume(); return; }
        enterChapter(chapId); return;
      }
      if (run.node) { resume(); return; }
      enterChapter(run.chap || chapters[0].id);
    },
    destroy() { removeEventListener('resize', fit); document.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); saveNow(); },
  };
  function resume() {
    if (!canRead(meta, chIdx(run.chap))) { paywall(run.chap); return; }
    setBg(story.nodes[run.node].bg, true);
    for (const id in run.stage) placeSpr(id, run.stage[id]);
    headerInfo(); render();
  }
}
