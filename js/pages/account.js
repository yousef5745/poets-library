// Account page (spec section 3): identity, continue reading, subscription, pearls + ledger,
// progress per story, endings found (titles only once reached, never spoilers), wardrobe.
import { t, fnum, fsigned, fdate, fmonthYear } from '../i18n.js';
import { ic } from '../icons.js';
import { header, footer, esc, $, avatar, img, toast, applyTheme, applyReadSize, sizeControl, applyReadFont, fontControl } from '../ui.js';
import * as auth from '../auth.js';
import { cloud, currentSub, subActive, refreshAccount, onCloud, ALL_STORIES } from '../cloud.js';
import { S, saveNow, setPref } from '../store.js';
import { CONFIG } from '../../config.js';
import { sw, flip, tag, confirm, empty } from '../dash-ui.js';

const A = (k, v) => t('acc2.' + k, v);
const mods = {};          // story id -> loaded module (titles of chapters, endings, looks)
let ledger = null;
const started = () => ALL_STORIES.filter((s) => (S.runs[s.id] || Object.keys(S.chDone[s.id] || {}).length || Object.keys(S.endings[s.id] || {}).length));
const chNum = (id) => Number(String(id || '').replace(/\D/g, '')) || 1;
const chTitle = (sid, id) => { const c = ((mods[sid] && mods[sid].story.chapters) || []).find((x) => x.id === id); return c ? (c.title.split(/[:：]/)[1] || c.title).trim() : ''; };

async function loadMods() {
  const want = new Set([...started().map((s) => s.id), 'antara']);
  await Promise.all([...want].map(async (id) => { const s = ALL_STORIES.find((x) => x.id === id); if (s && s.load && !mods[id]) { try { mods[id] = await s.load(); } catch (e) {} } }));
}
async function loadLedger() {
  const u = auth.currentUser(); const c = await auth.getClient().catch(() => null);
  if (!u || !c || !cloud.profile) { ledger = []; return; }
  const { data, error } = await c.from('pearl_ledger').select('delta,reason,at').eq('user_id', u.id).order('at', { ascending: false }).limit(3);
  ledger = error ? [] : data || [];
}
async function portal(action) {
  const c = await auth.getClient();
  const { data, error } = await c.functions.invoke('ls-portal', { body: { action } });
  if (error || !data || data.error) throw new Error((data && data.error) || (error && error.message) || 'portal');
  return data;
}

// ------------------------------------------------------------ side panels
function subPanel() {
  const s = currentSub(), p = cloud.profile || {};
  const comp = p.premium_until && new Date(p.premium_until) > new Date() && !(s && subActive(s));
  const P = CONFIG.plans;
  const h = (tg) => `<h3 id="h-sub">${A('sub')} ${tg}</h3>`;
  const lsNote = `<p class="fine" style="font-size:13px">${A('lsNote')}</p>`;
  if (comp) {
    const forever = new Date(p.premium_until).getFullYear() >= 2099;
    return `<section class="panel" aria-labelledby="h-sub">${h(tag(A('compTag'), 'fill'))}<p class="acc-subline">${forever ? A('compForever') : A('compUntil', { d: fdate(p.premium_until) })}</p></section>`;
  }
  if (!s || s.status === 'expired' || !subActive(s) && s.status !== 'past_due') {
    return `<section class="panel" aria-labelledby="h-sub">${h(tag(A('free'), 'mut'))}<p class="acc-subline">${A('freeLine', { n: fnum(CONFIG.freeChaptersDefault) })}</p><a class="btn pri sm" href="#/pricing">${A('subFrom', { p: P.yearly.perMonth })}</a></section>`;
  }
  const plan = s.variant === 'yearly' ? 'yearly' : 'monthly';
  const priceLine = `<p class="acc-subline"><b>${A('plan.' + plan)}</b> · <bdi class="ltr tnum">$${esc(P[plan].price)}</bdi> ${A('per.' + plan)}</p>`;
  if (s.status === 'cancelled') {
    return `<section class="panel" aria-labelledby="h-sub">${h(tag(A('cancelled'), 'acc'))}${priceLine}<p class="acc-subline">${A('activeUntil', { d: `<b>${fdate(s.ends_at)}</b>` })}</p><button type="button" class="btn pri sm" data-acc="resume">${A('resume')}</button>${lsNote}</section>`;
  }
  if (s.status === 'past_due' || s.status === 'unpaid') {
    return `<section class="panel" aria-labelledby="h-sub">${h(tag(A('pastDue'), 'acc'))}${priceLine}<p class="acc-subline" style="color:var(--acc);font-weight:700">${A('pastDueLine')}</p>${s.renews_at ? `<p class="fine">${A('pastDueBy', { d: fdate(s.renews_at) })}</p>` : ''}
      <a class="btn pri sm" href="${esc(s.update_url || s.portal_url || '#')}" target="_blank" rel="noopener" data-acc="update">${A('updateCard')}${ic('ext')}</a>${lsNote}</section>`;
  }
  return `<section class="panel" aria-labelledby="h-sub">${h(tag(A('active')))}${priceLine}${s.renews_at ? `<p class="fine">${A('renews', { d: fdate(s.renews_at) })}</p>` : ''}
    <a class="btn ghost sm wide" href="${esc(s.portal_url || '#')}" target="_blank" rel="noopener" data-acc="portal">${A('manage')}${ic('ext')}</a><button type="button" class="link" style="align-self:flex-start" data-acc="cancel">${A('cancel')}</button>${lsNote}</section>`;
}
function pearlsPanel() {
  const s = currentSub(), on = s && subActive(s) && s.status !== 'cancelled';
  const next = on && s.renews_at ? A('pearlsNext', { d: fdate(s.renews_at) }) : '';
  const rows = (ledger || []).map((r) => `<li><span>${esc(r.reason || '')}</span><b class="tnum sgn${r.delta < 0 ? ' dn' : ''}">${fsigned(r.delta)}</b></li>`).join('');
  return `<section class="panel" aria-labelledby="h-pe"><h3 id="h-pe">${A('pearls')}</h3><div class="acc-big"><b class="tnum">${fnum(S.pearls)}</b><span>${A('pearlWord')}</span></div>
    <p class="fine">${on ? A('pearlsMonthly', { n: fnum(CONFIG.plans.monthlyPearls) }) + ' ' + next : A('pearlsFree')}</p>
    ${rows ? `<ul class="acc-ledger" aria-label="${A('ledger')}">${rows}</ul>` : ''}</section>`;
}

// Reading settings: the same font + text-size controls as the reader's ⋯ menu (saved with the wallet prefs).
function readPanel() {
  return `<section class="panel acc-read" aria-labelledby="h-rd"><h3 id="h-rd">${t('r.settings')}</h3><p class="fine">${t('r.fontFamily')}</p>${fontControl(S.prefs.font, 'data-fs')}<p class="fine">${t('r.textSize')}</p>${sizeControl(S.prefs.size, 'data-fs')}</section>`;
}

// ------------------------------------------------------------ main column
function progressRows() {
  const all = ALL_STORIES.filter((s) => s.ready && !s.hidden);
  const st = started();
  const cur = st.find((s) => S.runs[s.id] && Object.keys(S.chDone[s.id] || {}).length < (s.chapters || 1));
  const rank = (s) => (s === cur ? 0 : Object.keys(S.chDone[s.id] || {}).length >= (s.chapters || 1) ? 1 : 2);
  st.sort((a, b) => rank(a) - rank(b));
  const list = [...st, ...all.filter((s) => !st.includes(s)).slice(0, Math.max(0, 5 - st.length))];
  const rows = list.map((s) => {
    const n = s.chapters || 1, dn = Object.keys(S.chDone[s.id] || {}).length;
    const got = Object.keys(S.endings[s.id] || {}).length;
    const state = dn >= n ? 'done' : !st.includes(s) ? 'new' : s === cur ? 'cur' : '';
    const pc = Math.round((Math.min(dn, n) / n) * 100);
    const run = S.runs[s.id];
    const where = state === 'done' ? A('doneLine', { g: fnum(got), n: fnum(s.endings || 0) }) : state === 'new' ? A('notStarted')
      : A('chOf', { c: fnum(run ? chNum(run.chap) : dn + 1), n: fnum(n) });
    const btn = state === 'done' ? `<a class="btn ghost sm" href="#/story/${s.id}">${ic('restart')}${A('replay')}</a>`
      : state === 'new' ? `<a class="btn ghost sm" href="#/story/${s.id}">${A('start')}</a>`
      : `<a class="btn ${state === 'cur' ? 'pri' : 'ghost'} sm" href="#/read/${s.id}">${ic('play')}${A('continue')}</a>`;
    return `<li class="acc-prow ${state}"><span class="cov" style="background-image:url(${img(s.cover)})"></span><div class="pb"><h3>${esc(s.title)}</h3><span class="poet">${esc(s.poet)}</span><span class="where">${where}</span>
      <div class="acc-pbar" role="progressbar" aria-valuenow="${pc}" aria-valuemin="0" aria-valuemax="100" aria-label="${A('pct')}"><span class="t"><i style="width:${pc}%"></i></span><b class="tnum">${fnum(pc)}%</b></div></div><div class="pa">${btn}</div></li>`;
  }).join('');
  return `<section aria-labelledby="h-pr"><header class="adm-head"><h2 id="h-pr">${A('reads')}</h2><span class="fine">${A('startedOf', { a: fnum(st.length), b: fnum(all.length) })}</span></header>
    ${rows ? `<ul class="acc-prog">${rows}</ul>` : empty(A('noReads'), '', `<a class="btn pri sm" href="#/">${A('toLibrary')}</a>`)}</section>`;
}
function endingsCards() {
  const all = ALL_STORIES.filter((s) => s.ready && !s.hidden);
  const total = all.reduce((n, s) => n + (s.endings || 0), 0);
  const gotAll = Object.values(S.endings || {}).reduce((n, e) => n + Object.keys(e).length, 0);
  const cards = started().map((s) => {
    const m = mods[s.id], ends = m ? Object.entries(m.story.endings) : [];
    const n = ends.length || s.endings || 0;
    const mine = S.endings[s.id] || {};
    const got = ends.filter(([k]) => mine[k]);
    const marks = Array.from({ length: n }, (_, i) => `<i class="${i < got.length ? 'got' : ''}"></i>`).join('');
    const li = got.map(([, e]) => `<li class="got">${ic('check')}${esc(e.title)}</li>`).join('') + Array.from({ length: Math.max(0, n - got.length) }, () => `<li>${ic('lock')}${A('locked')}</li>`).join('');
    const hint = got.length ? A('hintMore') : A('hintFirst');
    const btn = got.length ? `<a class="btn ghost sm" href="#/story/${s.id}">${ic('restart')}${A('pickChapter')}</a>` : `<a class="btn ghost sm" href="#/read/${s.id}">${ic('play')}${A('continueStory')}</a>`;
    return `<article class="acc-endcard"><header><h3>${esc(s.title)}</h3><span class="cnt"><b class="tnum">${fnum(got.length)}</b> ${A('of')} ${fnum(n)}</span></header><div class="acc-marks" aria-hidden="true">${marks}</div><ul>${li}</ul><p class="fine">${hint}</p>${btn}</article>`;
  }).join('');
  return `<section aria-labelledby="h-en"><header class="adm-head"><h2 id="h-en">${A('endings')}</h2><span class="fine">${A('endingsOf', { a: fnum(gotAll), b: fnum(total) })}</span></header>
    ${cards ? `<div class="acc-endgrid">${cards}</div>` : empty(A('noEndings'))}</section>`;
}
function wardrobe() {
  const m = mods.antara;
  if (!m || !m.looks) return '';
  const map = (m.chars && m.chars.hero && m.chars.hero.looks) || {};
  const owned = new Set(S.owned || []);
  const items = m.looks.map((l) => {
    const st = S.look === l.id ? 'on' : owned.has(l.id) || !l.cost ? 'owned' : 'lock';
    const btn = st === 'on' ? `<span class="tag fill" style="align-self:flex-start">${A('wearing')}</span>`
      : st === 'owned' ? `<button type="button" class="btn ghost sm" data-wear="${l.id}">${A('wear')}</button>`
      : `<button type="button" class="btn pri sm" data-buy="${l.id}">${ic('pearl')}${A('unlock', { n: fnum(l.cost) })}</button>`;
    return `<article class="acc-look ${st}"><div class="fr"><img src="${img(map[l.id] || 'antara1')}" alt="">${st === 'lock' ? `<span class="lk">${ic('lock')}${fnum(l.cost)}</span>` : ''}</div><b>${esc(l.name)}</b><small>${esc(l.desc || '')}</small>${btn}</article>`;
  }).join('');
  const nOwned = m.looks.filter((l) => owned.has(l.id) || !l.cost).length;
  return `<section aria-labelledby="h-wa"><header class="adm-head"><h2 id="h-wa">${A('wardrobe')}</h2><span class="fine">${A('looksOf', { h: esc(m.chars.hero.name), a: fnum(nOwned), b: fnum(m.looks.length) })}</span></header>
    <div class="acc-looks">${items}</div><p class="fine" style="margin-top:10px">${ic('robe')}${A('moreLooks')}</p></section>`;
}
function contCard() {
  const s = started().find((x) => S.runs[x.id] && Object.keys(S.chDone[x.id] || {}).length < (x.chapters || 1));
  if (!s) return '';
  const run = S.runs[s.id], ct = chTitle(s.id, run.chap);
  return { html: `<a class="contcard" href="#/read/${s.id}"><img src="${img(s.portrait || s.cover)}" alt=""><div><small>${A('contKicker')}</small><b>${esc(s.title)}</b><small>${A('chOf', { c: fnum(chNum(run.chap)), n: fnum(s.chapters) })}${ct ? ` · «${esc(ct)}»` : ''}</small></div><span class="btn pri sm">${ic('play')}${A('continueShort')}</span></a>`, s };
}

function draw() {
  const u = auth.currentUser();
  const app = $('#app');
  if (!u) {
    app.innerHTML = `${header('account')}<main id="main" class="wrap dash"><section class="acc-head"><div style="grid-column:1/-1"><span class="kicker">${t('acc.title')}</span><h1>${t('acc.title')}</h1><p>${t('acc.needLogin')}</p><a class="btn pri" href="#/login">${t('nav.login')}</a></div></section></main>${footer()}`;
    return;
  }
  const p = cloud.profile;
  const name = (p && p.display_name) || auth.displayName(u);
  const prov = (u.app_metadata && u.app_metadata.provider) || 'google';
  const since = (p && p.created_at) || u.created_at;
  const night = S.prefs.theme === 'night';
  const cc = contCard();
  app.innerHTML = `${header('account')}<main id="main" class="wrap dash acc">
    <section class="acc-head">${avatar(name, 'acc-avatar', p && p.avatar != null ? p.avatar : auth.avatarUrl(u))}
      <div><span class="kicker">${t('acc.title')}</span><h1><bdi>${esc(name)}</bdi></h1><p class="fine"><bdi class="ltr">${esc(u.email || '')}</bdi></p>
        <p class="fine">${A('via.' + prov) !== 'acc2.via.' + prov ? A('via.' + prov) : A('via.google')} · ${A('since', { d: fmonthYear(since) })}</p></div>
      <div class="hact">${sw(night, `${A('night')}: ${A('swOn')}`, `${A('night')}: ${A('swOff')}`, 'data-acc="theme"')}<button type="button" class="btn ghost sm" data-a="logout">${ic('logout')}<span>${A('logout')}</span></button></div></section>
    ${cc ? cc.html : ''}
    <div class="acc-grid"><aside class="acc-side" aria-label="${A('sideLabel')}">${subPanel()}${pearlsPanel()}${readPanel()}</aside>
      <div class="acc-main">${progressRows()}${endingsCards()}${wardrobe()}</div></div>
    <p class="fine" style="margin-top:24px">${ic(p ? 'check' : 'lock')}${p ? t('acc.sync') : t('acc.noSync')}</p>
    <div class="acc-signout" style="margin-top:24px"><button type="button" class="btn ghost" data-a="logout">${ic('logout')}${A('logout')}</button></div>
  </main>${cc ? `<div class="stickycta acc-cta"><div class="wrap"><a class="btn pri" href="#/read/${cc.s.id}">${ic('play')}${A('continueNamed', { s: esc(cc.s.title) })}</a></div></div>` : ''}${footer()}`;
}

function bind() {
  const app = $('#app');
  const onClick = async (e) => {
    const th = e.target.closest('[data-acc=theme]');
    if (th) { setPref('theme', S.prefs.theme === 'night' ? 'day' : 'night'); applyTheme(S.prefs.theme); flip(th, S.prefs.theme === 'night'); return; }
    const ff = e.target.closest('[data-fs=font]');
    if (ff) {
      setPref('font', applyReadFont(ff.dataset.v));
      const box = ff.closest('.acc-read'); if (box) box.outerHTML = readPanel();
      const nb = document.querySelector(`.acc-read [data-fs=font][data-v="${S.prefs.font}"]`); if (nb) nb.focus();
      return;
    }
    const fs = e.target.closest('[data-fs=size]');
    if (fs) {
      setPref('size', applyReadSize(fs.dataset.v));
      const box = fs.closest('.acc-read'); if (box) box.outerHTML = readPanel();
      const nb = document.querySelector(`.acc-read [data-fs][data-v="${S.prefs.size}"]:not(.fsstep)`); if (nb) nb.focus();
      return;
    }
    const w = e.target.closest('[data-wear]');
    if (w) { S.look = w.dataset.wear; saveNow(); toast(A('worn')); draw(); return; }
    const b = e.target.closest('[data-buy]');
    if (b) {
      const l = mods.antara.looks.find((x) => x.id === b.dataset.buy);
      if (S.pearls < l.cost) { toast(A('notEnough', { n: fnum(l.cost), h: fnum(S.pearls) })); return; }
      if (!(await confirm({ title: A('buyTitle', { n: l.name }), body: A('buyBody', { n: fnum(l.cost), h: fnum(S.pearls - l.cost) }), ok: A('buyOk') }))) return;
      S.pearls -= l.cost; S.owned = [...new Set([...(S.owned || []), l.id])]; S.look = l.id; saveNow(); toast(A('bought')); draw(); return;
    }
    const a = e.target.closest('[data-acc]'); if (!a) return;
    const s = currentSub();
    if (a.dataset.acc === 'portal' || a.dataset.acc === 'update') {
      e.preventDefault();
      const win = window.open('', '_blank');
      try { const r = await portal('portal'); const url = a.dataset.acc === 'update' ? r.update_url || r.url : r.url; if (win) win.location = url; else location.href = url; }
      catch (er) { const url = a.dataset.acc === 'update' ? s.update_url || s.portal_url : s.portal_url; if (url) { if (win) win.location = url; else location.href = url; } else { if (win) win.close(); toast(A('portalErr')); } }
      return;
    }
    if (a.dataset.acc === 'cancel') {
      if (!(await confirm({ title: A('cancelTitle'), body: A('cancelBody', { d: fdate(s.renews_at || s.ends_at) }), ok: A('cancelOk'), cancel: A('keep'), danger: true }))) return;
      a.setAttribute('aria-busy', 'true');
      try { await portal('cancel'); await refreshAccount(); toast(A('cancelDone')); } catch (er) { toast(A('portalErr')); a.removeAttribute('aria-busy'); }
      return;
    }
    if (a.dataset.acc === 'resume') {
      if (!(await confirm({ title: A('resumeTitle'), body: A('resumeBody'), ok: A('resume') }))) return;
      a.setAttribute('aria-busy', 'true');
      try { await portal('resume'); await refreshAccount(); toast(A('resumeDone')); } catch (er) { toast(A('portalErr')); a.removeAttribute('aria-busy'); }
    }
  };
  app.addEventListener('click', onClick);
  return () => app.removeEventListener('click', onClick);
}

export default function account() {
  draw();
  const unbind = bind();
  let alive = true;
  Promise.all([loadMods(), loadLedger(), refreshAccount()]).then(() => alive && draw(), () => alive && draw());
  const off = onCloud(() => { if (alive) { loadLedger().then(() => alive && draw()); } });
  return () => { alive = false; off(); unbind(); };
}
