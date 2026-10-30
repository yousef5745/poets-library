import { t, pearlsWord } from '../i18n.js';
import { ic, ornament } from '../icons.js';
import { $, esc, img, sheet, closeSheet, sheetOpen, toast, applyReadSize, sizeControl, applyReadFont, fontControl } from '../ui.js';
import { CONFIG } from '../../config.js';
import { storyMeta } from '../../content/catalog.js';
import { S, save, saveNow, done, endings, chk, setPref } from '../store.js';
import { canRead } from '../access.js';
import { freshRun, clone, cond, applyFx, unmet, resolveRoute } from '../engine.js';
import { splitTitle } from './story.js';
import * as audio from '../audio.js';

const HINT_KEY = 'ps_hint_n', HINT_MAX = 4;   // the big «المس للمتابعة» shows on the first few screens only
const MS_PER_CHAR = 30, REVEAL_CAP = 2400;     // line reveal speed; a tap shows the whole line at once
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// Arabic count of remaining chapters: 1 فصل واحد, 2 فصلان, 3-10 فصول, 11+ فصلًا
export const chaptersLeft = (n) => (n === 1 ? t('r.left1') : n === 2 ? t('r.left2') : t(n <= 10 ? 'r.leftFew' : 'r.leftMany', { n }));

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
  S.prefs.size = applyReadSize(S.prefs.size);
  S.prefs.font = applyReadFont(S.prefs.font);
}

function makeReader(meta, mod) {
  const story = mod.story, CH = mod.chars, NAMES = { stats: mod.stats, rels: mod.rels };
  const sid = meta.id;
  const chapters = story.chapters;
  let run = S.runs[sid] || null;
  let curBg = null;
  const chIdx = (cid) => chapters.findIndex((c) => c.id === cid);
  const chap = (cid) => chapters[chIdx(cid)];
  const POSES = mod.poses || {};
  const heroImg = () => (run && CH.hero.chap && CH.hero.chap[run.chap]) || CH.hero.looks[S.look] || 'antara1';
  // Sprite for a character in pose/expression e. Lookup: the character's own map (@chars ... | e:img),
  // then @poses for the base image in use (so the hero's outfit or chapter look keeps its own poses),
  // then the base image. A line without (e) uses the character's standing pose set by `pose`/`show x=l:e`.
  const charImg = (id, e) => {
    const base = id === 'hero' ? heroImg() : CH[id].img.n;
    if (!e && run && run.pose) e = run.pose[id];
    if (!e || e === 'n') return base;
    return (id !== 'hero' && CH[id].img[e]) || (POSES[base] && POSES[base][e]) || (id === 'hero' && CH.hero.img[e]) || base;
  };
  let revealUntil = 0, revealT = 0;

  function layout() {
    $('#app').innerHTML = `<div class="reader" id="reader" data-mode="intro">
      <div class="stage" id="stage" data-r="adv"><div class="bg" id="bgA"></div><div class="bg" id="bgB"></div><div id="sprs"></div></div>
      <header class="rtop">
        <a class="iconbtn" href="#/story/${sid}" aria-label="${t('r.back')}">${ic('back')}</a>
        <div class="rtitle"><b>${esc(story.title)}</b><small id="rch"></small></div>
        <button class="pearls" data-r="pearls" aria-label="${t('r.pearls')}">${ic('pearl')}<b id="pc">${S.pearls}</b></button>
        <button class="iconbtn" data-r="menu" aria-label="${t('r.menu')}" title="${t('r.menu')}">${ic('more')}</button>
        <div class="rprog"><i id="rprog"></i></div>
      </header>
      <ul class="rtraits" id="rtraits" aria-label="${t('r.stats')}"></ul>
      <div class="fxpop" id="fxpop" aria-live="polite"></div>
      <div class="panel-r" id="ui" aria-live="polite"></div>
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
    if (pos && pos.includes(':')) { const [p2, e2] = pos.split(':'); pos = p2; (run.pose = run.pose || {})[id] = e2; }
    if (meta.noCharImages) { run.stage[id] = pos; return; }   // category forbids drawing people
    let el = document.getElementById('sp_' + id);
    if (!el) { el = document.createElement('img'); el.id = 'sp_' + id; el.alt = CH[id].name; el.className = 'spr'; el.onload = () => el.classList.toggle('wide', el.naturalWidth > el.naturalHeight * 1.2); $('#sprs').appendChild(el); }
    el.src = img(charImg(id, e));
    el.dataset.pos = pos;
    requestAnimationFrame(() => el.classList.add('on'));
    run.stage[id] = pos;
    countSpr();
  }
  function hideSpr(id) {
    const el = document.getElementById('sp_' + id);
    if (el) { el.classList.remove('on'); setTimeout(() => el.remove(), 350); }
    delete run.stage[id];
    countSpr();
  }
  function countSpr() { const b = $('#sprs'); if (b) b.dataset.n = Math.min(3, Object.keys(run.stage).length) || 1; }
  function setSprImg(id, e) {
    const el = document.getElementById('sp_' + id);
    if (!el) return;
    const src = img(charImg(id, e));
    if (!el.src.endsWith(src)) { el.src = src; el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); }
  }
  function focus(id) {
    for (const k in run.stage) {
      const el = document.getElementById('sp_' + k);
      if (!el) continue;
      el.classList.toggle('dim', !!id && k !== id); el.classList.toggle('talk', k === id);
      if (k === id) { el.classList.remove('say'); void el.offsetWidth; el.classList.add('say'); }
    }
  }
  function setPearls(n) { S.pearls += n; const e = $('#pc'); if (e) e.textContent = S.pearls; if (n > 0) audio.sfx('pearl'); save(); }
  // Trait and pearl changes pop up as small chips just above the text panel for ~1.5 s ('+1 الفروسية').
  function fx(f) {
    if (!f) return;
    const r = applyFx(run.st, f, NAMES);
    if (r.pearls) setPearls(r.pearls);
    const m = [];
    for (const k of ['fur', 'fas']) if (f[k]) m.push([chip(f[k], NAMES.stats[k]), f[k] < 0]);
    if (f.rel) for (const k in f.rel) if (f.rel[k]) m.push([chip(f.rel[k], NAMES.rels[k] || k), f.rel[k] < 0]);
    if (r.pearls) m.push([chip(r.pearls, t('r.pearls')), false]);
    if (f.toast) m.push([esc(f.toast), false]);
    pop(m);
    traits(f);
  }
  function pop(items) {
    const box = $('#fxpop');
    if (!box || !items.length) return;
    box.innerHTML = items.map(([html, neg]) => `<span class="fxc${neg ? ' neg' : ''}">${html}</span>`).join('');
    // sit just above whatever panel the next screen shows (the verse and choice panels are taller)
    requestAnimationFrame(() => { placePop(); box.classList.remove('on'); void box.offsetWidth; box.classList.add('on'); });
    clearTimeout(pop.t); pop.t = setTimeout(() => box.classList.remove('on'), 1600);
  }
  const chip = (v, label) => `<bdi dir="ltr">${v > 0 ? '+' : '−'}${Math.abs(v)}</bdi> ${esc(label)}`;
  function traitList() {
    const st = run.st, icons = ['heart', 'flag', 'user'];
    return [['fur', 'sword', NAMES.stats.fur, st.fur], ['fas', 'tongue', NAMES.stats.fas, st.fas],
      ...Object.keys(NAMES.rels).map((k, i) => ['rel.' + k, icons[i % 3], NAMES.rels[k], st.rel[k] || 0])];
  }
  // Always-visible strip of traits under the top bar (phone included); changed ones flash.
  function traits(f) {
    const ul = $('#rtraits');
    if (!ul) return;
    const ch = new Set();
    if (f) { ['fur', 'fas'].forEach((k) => f[k] && ch.add(k)); if (f.rel) Object.keys(f.rel).forEach((k) => ch.add('rel.' + k)); }
    ul.innerHTML = traitList().map(([k, icn, l, v]) => `<li class="${ch.has(k) ? 'up' : ''}" title="${esc(l)}">${ic(icn)}<span>${esc(l)}</span><b>${v}</b></li>`).join('');
  }
  function placePop() {
    const box = $('#fxpop'), p = document.querySelector('#ui > *');
    if (box) box.style.bottom = p ? `${Math.round(innerHeight - p.getBoundingClientRect().top + 10)}px` : '';
  }
  function mode(m) { $('#reader').dataset.mode = m; requestAnimationFrame(placePop); }
  function headerInfo() {
    const i = chIdx(run.chap);
    const [num, name] = splitTitle(chapters[i].title);
    $('#rch').textContent = `${num} · ${name}`;
    $('#rprog').style.width = `${((i + (run.node ? 0.5 : 1)) / chapters.length) * 100}%`;
    traits();
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

  /* ---------- chapter flow ---------- */
  function enterChapter(cid) {
    const i = chIdx(cid);
    if (i < 0) return;
    if (!canRead(meta, i)) { paywall(cid); return; }
    const snap = chk(sid)[cid];
    if (snap) run = clone(snap);
    else { run.chap = cid; chk(sid)[cid] = clone({ ...run, node: chap(cid).start, step: 0, stage: {} }); }
    run.chap = cid; run.node = chap(cid).start; run.step = 0; run.stage = {}; run.pose = {}; run.picks = []; run.verses = run.verses || [];
    S.runs[sid] = run; saveNow();
    $('#sprs').innerHTML = ''; curBg = null;
    setBg(story.nodes[run.node].bg, true);
    headerInfo(); mode('intro'); $('#ui').innerHTML = '';
    const [num, name] = splitTitle(chap(cid).title);
    // Stories flagged underReview show the review note once, on the first chapter's intro.
    const REV_KEY = 'ps_rev_seen_' + sid;
    let rev = '';
    try { if (meta.underReview && i === 0 && !localStorage.getItem(REV_KEY)) { rev = `<div class="revnote" role="note"><span class="revtag">${t('rev.badge')}</span><p>${t('rev.note')}</p></div>`; localStorage.setItem(REV_KEY, '1'); } } catch (e) {}
    sheet(`<div class="kicker">${esc(story.title)}</div><h2>${esc(num)}</h2><p class="chname">${esc(name)}</p>
      <div class="chcover" style="background-image:url(${img(chap(cid).cover)})"></div>${rev}
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
      if (st.pose) {
        run.pose = run.pose || {};
        for (const k in st.pose) {
          run.pose[k] = st.pose[k];
          // a poet who starts reciting off screen walks on in that pose (hero on the right, others on the left, alone in the centre)
          if (!(k in run.stage) && st.pose[k] !== 'n' && CH[k]) placeSpr(k, Object.keys(run.stage).length ? (k === 'hero' ? 'r' : 'l') : 'c');
          else setSprImg(k);
        }
        run.step++; continue;
      }
      if (st.fx) { fx(st.fx); run.step++; continue; }
      break;
    }
    if (run.step < nd.steps.length) {
      const st = nd.steps[run.step];
      if (st.v) {
        focus(null); mode('verse'); audio.sfx('verse');
        // Ayah cards (prophets): one block, own kicker, never added to the recent-verses list.
        // Quote cards (novels, plays, fables): a famous line of the original work in our translation,
        // the original-language line under it; also kept out of the recent-verses list.
        if (!st.ayah && !st.quote && !run.verses.some((x) => x[0] === st.v[0])) run.verses.push(st.v);
        const kick = st.quote ? (st.k || t('r.quote')) : t(st.ayah ? 'r.ayah' : 'r.verse');
        ui.innerHTML = `<div class="dlg verse${st.ayah ? ' ayah' : ''}${st.quote ? ' quote' : ''} fade" data-r="adv"><div class="kicker">${esc(kick)}</div>${ornament}<p class="h">${esc(st.v[0])}</p>${st.v[1] ? `<p class="h">${esc(st.v[1])}</p>` : ''}${st.orig ? `<p class="orig" dir="ltr" lang="${/[àâçéèêëîïôûùüÿœ]/i.test(st.orig) ? 'fr' : 'en'}">${esc(st.orig)}</p>` : ''}<small class="by">${esc(st.by || '')}</small>${st.ex ? `<p class="gloss">${esc(st.ex)}</p>` : ''}${goHint()}</div>`;
        revealUntil = 0; return;
      }
      if (st.n) { focus(null); mode('nar'); ui.innerHTML = `<div class="dlg nar" data-r="adv"><p class="rv">${words(st.n)}</p>${goHint()}</div>`; startReveal(st.n); return; }
      if (st.c) {
        if (!(st.c in run.stage)) placeSpr(st.c, st.c === 'hero' ? 'r' : 'l', st.e);
        else setSprImg(st.c, st.e);
        focus(st.c); mode('dlg');
        ui.innerHTML = `<div class="dlg" data-r="adv"><div class="who">${esc(CH[st.c].name)}</div><p class="rv">${words(st.t)}</p>${goHint()}</div>`;
        startReveal(st.t);
        return;
      }
    }
    if (nd.choices) { focus(null); mode('choice'); ui.innerHTML = choicesHTML(nd); return; }
    if (nd.next) return go(nd.next);
    if (nd.route) return go(resolveRoute(run.st, nd.route));
    if (nd.chapterEnd) return chapterEnd(nd.chapterEnd);
    if (nd.ending) return ending(nd.ending);
  }
  const hintN = () => +(localStorage.getItem(HINT_KEY) || 0);
  const goHint = () => (hintN() < HINT_MAX ? `<span class="go">${t('r.tapToContinue')}${ic('fwd')}</span>` : `<span class="go mini" aria-label="${t('r.tapToContinue')}">${ic('fwd')}</span>`);
  // Word-by-word reveal (~30 ms per letter, capped): whole words fade in, so Arabic joining is never broken mid-word.
  function words(text) {
    const k = Math.min(MS_PER_CHAR, REVEAL_CAP / Math.max(1, text.length));
    let c = 0;
    return text.split(/(\s+)/).map((w) => { if (!w.trim()) return w; const d = Math.round(c * k); c += w.length + 1; return `<span class="w" style="--d:${d}ms">${esc(w)}</span>`; }).join('');
  }
  function startReveal(text) {
    clearTimeout(revealT);
    const box = document.querySelector('#ui .dlg');
    if (reduced()) { box && box.classList.add('shown'); revealUntil = 0; return; }
    const dur = Math.min(REVEAL_CAP, text.length * MS_PER_CHAR) + 250;
    revealUntil = Date.now() + dur;
    revealT = setTimeout(() => { revealUntil = 0; const b = document.querySelector('#ui .dlg'); if (b) b.classList.add('shown'); }, dur);
  }

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

  // A new scene (the background changes) with no one speaking or shown, only narration and verses,
  // is background only: whoever stood in the previous scene leaves. A `pose` step may still bring
  // the poet on. Narration in the same place (e.g. right after a choice) keeps the people there.
  function clearIfEmpty(nd) {
    if (!nd || !nd.steps || nd.bg === curBg || nd.steps.some((st) => st.c || st.show)) return;
    for (const k of Object.keys(run.stage)) hideSpr(k);
  }
  function go(id) { run.node = id; run.step = 0; clearIfEmpty(story.nodes[id]); save(); render(); }
  function adv() {
    if (sheetOpen()) return;
    const nd = story.nodes[run.node];
    if (revealUntil > Date.now()) { revealUntil = 0; clearTimeout(revealT); const b = document.querySelector('#ui .dlg'); if (b) b.classList.add('shown'); return; }
    if (nd && run.step < nd.steps.length) {
      audio.sfx('tap'); run.step++; save();
      const n = hintN(); if (n < HINT_MAX) localStorage.setItem(HINT_KEY, n + 1);
      render();
    }
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
    audio.sfx('choose');
    (run.picks = run.picks || []).push(c.t);
    fx(c.fx); go(c.to);
  }

  function rewardRow(n) { return `<div class="reward">${ic('pearl')}<b>${t('r.reward', { n })}</b></div>`; }

  // Traits gained this chapter: current stats minus the snapshot taken when the chapter started.
  function gainedHTML() {
    const s0 = (chk(sid)[run.chap] || {}).st || { fur: 0, fas: 0, rel: {} };
    const g = [];
    for (const k of ['fur', 'fas']) { const d = run.st[k] - (s0[k] || 0); if (d) g.push([chip(d, NAMES.stats[k]), d < 0]); }
    for (const k in NAMES.rels) { const d = (run.st.rel[k] || 0) - ((s0.rel || {})[k] || 0); if (d) g.push([chip(d, NAMES.rels[k]), d < 0]); }
    return g.length ? `<div class="gain">${g.map(([x, neg]) => `<span class="fxc${neg ? ' neg' : ''}">${x}</span>`).join('')}</div>` : `<p class="fine">${t('r.noGain')}</p>`;
  }
  function priceLine() {
    const P = CONFIG.plans;
    return `<p class="price-line">${t('r.priceLine', { m: `<bdi dir="ltr"><b>$${P.monthly.price}</b></bdi>`, y: `<bdi dir="ltr"><b>$${P.yearly.price}</b></bdi>` })}</p>`;
  }
  function lockedHTML(fromIdx) {
    const left = chapters.length - fromIdx;
    return `<div class="pwbox"><p class="pw">${ic('lock')}<span>${chaptersLeft(left)}. ${t('r.paywallShort')}</span></p>${priceLine()}
      <a class="btn pri wide" href="#/pricing">${t('r.subscribe')}</a></div>`;
  }

  function chapterEnd(next) {
    const dn = done(sid), first = !dn[run.chap], r = first ? 4 : 1;
    dn[run.chap] = 1; setPearls(r); audio.sfx('end');
    const [num, name] = splitTitle(chap(run.chap).title);
    const picks = run.picks || [], gained = gainedHTML();
    const nx = chap(next), ni = chIdx(next);
    const [nnum, nname] = splitTitle(nx.title);
    run.chap = next; run.node = null; run.step = 0; run.stage = {}; run.pose = {}; run.picks = [];
    const snap = clone(run); snap.node = nx.start;
    chk(sid)[next] = snap; S.runs[sid] = run; saveNow();
    headerInfo();
    const pickList = picks.length ? `<ol class="picks">${picks.slice(-4).map((p) => `<li>${esc(p)}</li>`).join('')}</ol>` : '';
    const nextBtn = canRead(meta, ni)
      ? `<button class="btn pri wide" data-r="nextch" data-v="${next}">${t('r.nextChapter')}${ic('fwd')}</button>`
      : lockedHTML(ni);
    sheet(`<div class="kicker">${t('r.chapterDone', { ch: esc(num) })}</div><h2>${esc(name)}</h2>${rewardRow(r)}
      <div class="endsec"><h4>${t('r.yourChoices', { n: picks.length })}</h4>${pickList}</div>
      <div class="endsec"><h4>${t('r.gained')}</h4>${gained}</div>
      <div class="nextup"><small>${t('r.upNext')}</small><b>${esc(nnum)} · ${esc(nname)}</b></div>
      ${nextBtn}<a class="btn ghost wide" href="#/story/${sid}">${t('r.toStory')}</a>`, { closable: false, cls: 'endch' });
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
    const left = chapters.length - Math.max(0, chIdx(cid));
    sheet(`<div class="kicker">${esc(story.title)}</div><h2>${t('r.paywallTitle')}</h2><p>${t('r.paywallBody')}</p>
      <p class="left">${ic('book')}<span>${chaptersLeft(left)}</span></p>${priceLine()}
      <a class="btn pri wide" href="#/pricing">${t('r.subscribe')}</a><a class="btn ghost wide" href="#/story/${sid}">${t('r.toStory')}</a>`, { closable: false, cls: 'paywall' });
  }

  // One ⋯ menu for reading settings, the chapter map, traits and recent verses.
  function menu() {
    const seg = (r, cur, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button data-r="${r}" data-v="${v}" class="${cur === v ? 'on' : ''}" aria-pressed="${cur === v}">${l}</button>`).join('')}</div>`;
    const box = document.querySelector('#sheet .sheet-box.menu'), y = box ? box.scrollTop : 0;
    sheet(`<h2>${t('r.settings')}</h2>
      <div class="setrow fsrowset ffrowset"><span>${t('r.fontFamily')}</span>${fontControl(S.prefs.font, 'data-r')}</div>
      <div class="setrow fsrowset"><span>${t('r.textSize')}</span>${sizeControl(S.prefs.size, 'data-r')}</div>
      <div class="setrow"><span>${t('r.theme')}</span>${seg('theme', S.prefs.theme, [['day', t('r.themeDay')], ['night', t('r.themeNight')]])}</div>
      <div class="setrow"><span>${t('r.sound')}</span>${seg('sound', S.prefs.sound ? 'on' : 'off', [['on', t('r.on')], ['off', t('r.off')]])}</div>
      ${mapHTML()}${statsHTML()}${versesHTML()}<p class="keys">${t('r.keys')}</p>`, { cls: 'menu' });
    const nb = document.querySelector('#sheet .sheet-box.menu'); if (nb) nb.scrollTop = y;
  }

  /* ---------- input ---------- */
  function onClick(ev) {
    const el = ev.target.closest('[data-r]');
    if (!el) {
      // the whole screen continues the story, except the bars, the choices and real controls
      const rd = ev.target.closest('#reader');
      if (rd && !ev.target.closest('.rtop,.rtraits,.choices,button,a,input,select,textarea')) { audio.unlock(); adv(); }
      return;
    }
    const a = el.dataset.r, v = el.dataset.v;
    audio.unlock();
    switch (a) {
      case 'adv': adv(); break;
      case 'ch': choose(+v); break;
      case 'play': play(); break;
      case 'nextch': closeSheet(true); enterChapter(v); break;
      case 'menu': case 'map': case 'settings': menu(); break;
      case 'pearls': sheet(`<h2>${t('r.pearls')}: ${S.pearls}</h2><p>${t('pr.a1')}</p><button class="btn pri wide" data-a="sheet-close">${t('r.ok')}</button>`); break;
      case 'size': setPref('size', v); applyPrefs(); menu(); requestAnimationFrame(placePop); break;
      case 'font': setPref('font', v); applyPrefs(); menu(); requestAnimationFrame(placePop); break;
      case 'theme': setPref('theme', v); applyPrefs(); menu(); break;
      case 'sound': setPref('sound', v === 'on'); audio.setOn(S.prefs.sound); menu(); break;
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
    destroy() { clearTimeout(revealT); document.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); saveNow(); },
  };
  function resume() {
    if (!canRead(meta, chIdx(run.chap))) { paywall(run.chap); return; }
    setBg(story.nodes[run.node].bg, true);
    for (const id in run.stage) placeSpr(id, run.stage[id], undefined);
    headerInfo(); render();
  }
}
