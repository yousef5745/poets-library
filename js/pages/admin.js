// Admin dashboard (spec section 2). Routes: #/admin (overview + analytics), #/admin/analytics,
// #/admin/users, #/admin/subs, #/admin/stories, #/admin/categories, #/admin/settings.
// Only role=admin sees it; RLS and the is_admin() check in every RPC enforce the same rule.
import { t, fnum, fsigned, fday, fshort, fago, ftime, fdate } from '../i18n.js';
import { ic } from '../icons.js';
import { $, esc, toast, sheet, closeSheet, avatar, footer } from '../ui.js';
import * as auth from '../auth.js';
import { S } from '../store.js';
import { cloud, isAdmin, onCloud, ALL_STORIES, applySettings, applyStoryFlags, applyCategories, subActive } from '../cloud.js';
import { CONFIG } from '../../config.js';
import * as api from '../admin-api.js';
import { ALL_CATEGORIES, DEFAULT_CATEGORY, catName, catDesc, accentOf, ACCENTS, ORNAMENT_KEYS } from '../categories.js';
import { sw, flip, isOn, stepper, setStep, seg, tag, empty, errorBox, skeleton, confirm, spark } from '../dash-ui.js';

const T = (k, v) => t('a.' + k, v);
const NAV = [['overview', 'overview', ''], ['chart', 'analytics', ''], ['users', 'users', 'users'], ['card', 'subs', 'subs'], ['book', 'stories', 'stories'], ['menu', 'categories', 'cats'], ['settings', 'settings', '']];
const schemaMissing = (e) => e && (e.code === '42P01' || e.code === 'PGRST205' || e.code === 'PGRST202' || /does not exist|schema cache|Could not find/.test(e.message || ''));
const errText = (e) => (e && (e.message || e.code)) || '?';
const storyOf = (id) => ALL_STORIES.find((s) => s.id === id);
const storyTitle = (id) => (storyOf(id) || {}).title || id;
const short = (s) => { const p = (s.poet || '').split(' ')[0]; return p || s.title; };

const st = { period: 30, stats: null, counts: {}, users: { q: '', filter: 'all', page: 1 }, subsFilter: 'all', funnel: null, asTable: {} };
let leave = null;   // unsaved-changes guard, read by app.js before a route change
window.__psLeaveGuard = () => !leave || leave();

// ------------------------------------------------------------ frame
function adminHeader() {
  const u = auth.currentUser();
  const night = S.prefs.theme === 'night';
  return `<header class="top"><div class="wrap topin adm-topin">
    <a class="logo" href="#/">${ic('quill', 'ic lg')}<span>${t('site.name')}</span></a><span class="adm-badge">${T('badge')}</span>
    <div class="topact">
      <button class="iconbtn" data-a="theme" aria-pressed="${night}" aria-label="${T('night')}">${ic('moon')}</button>
      <span class="me"><bdi>${esc(((cloud.profile && cloud.profile.display_name) || auth.displayName(u)).split(' ')[0])} (${T('roleAdmin')})</bdi></span>
      <a class="btn ghost sm" href="#/">${ic('home')}<span>${T('toSite')}</span></a>
    </div></div></header>`;
}
function navHtml(cur) {
  const c = st.counts;
  const items = NAV.map(([icn, k, cnt]) => [icn, k, cnt && c[cnt] != null ? fnum(c[cnt]) : '']);
  const href = (k) => `#/admin${k === 'overview' ? '' : '/' + k}`;
  const chips = `<nav class="eratabs adm-chips" aria-label="${T('navLabel')}"><div class="eratabs-in">${items.map(([, k]) =>
    `<a class="chip${k === cur ? ' on' : ''}" href="${href(k)}"${k === cur ? ' aria-current="page"' : ''}>${T('nav.' + k)}</a>`).join('')}</div></nav>`;
  const aside = `<aside class="adm-aside" aria-label="${T('navLabel')}"><h4>${T('menu')}</h4><ul class="adm-nav">${items.map(([icn, k, n]) =>
    `<li><a href="${href(k)}" class="${k === cur ? 'on' : ''}"${k === cur ? ' aria-current="page"' : ''}>${ic(icn)}${T('nav.' + k)}${n ? `<small class="tnum">${n}</small>` : ''}</a></li>`).join('')}</ul>
    ${st.stats ? `<div class="back fine">${ic('flag')}<span id="adm-upd">${T('updated', { t: ftime(st.stats.updated_at || Date.now()) })}</span></div>` : ''}</aside>`;
  return { chips, aside };
}
function frame(cur, body) {
  const { chips, aside } = navHtml(cur);
  return `${adminHeader()}${chips}<div class="wrap adm dash">${aside}<main id="main" class="adm-main">${body}</main></div>${footer()}`;
}
const head = (h, sub = '', tools = '', level = 'h2', kicker = '') =>
  `<header class="adm-head"><div>${kicker ? `<span class="kicker">${kicker}</span>` : ''}<${level}>${h}</${level}>${sub ? `<span class="fine">${sub}</span>` : ''}</div>${tools ? `<div class="tools">${tools}</div>` : ''}</header>`;

// ------------------------------------------------------------ overview + analytics
function niceMax(v) { if (v <= 4) return 4; const p = 10 ** Math.floor(Math.log10(v)); const m = [1, 2, 2.5, 5, 10].find((x) => x * p >= v); return m * p; }
const gl = (vals, mx, fmt = fnum) => vals.map((v) => `<div class="adm-gl" style="bottom:${((v / mx) * 100).toFixed(0)}%"><span class="tnum">${fmt(v)}</span></div>`).join('');

function kpisHtml(s) {
  const d = st.period;
  const pct = s.plays_prev ? Math.round(((s.plays - s.plays_prev) / s.plays_prev) * 100) : null;
  const rate = s.plays ? Math.round((s.endings_n / s.plays) * 100) : 0;
  const avg = Math.round((s.signups_period || 0) / d);
  const sp = s.spark || {};
  const k = (label, val, delta, sv) => `<div class="adm-kpi"><dt>${label}</dt><dd class="tnum">${fnum(val)}</dd><span class="d">${delta}</span>${spark(sv)}</div>`;
  return `<dl class="adm-kpis">
    ${k(T('k.users'), s.users, `<b class="sgn">${fsigned(s.users_week || 0)}</b> ${T('k.week')}`, sp.users)}
    ${k(T('k.subs'), s.active_subs, `<b class="sgn">${fsigned(s.subs_week || 0)}</b> ${T('k.week')}`, sp.subs)}
    ${k(T('k.today'), s.signups_today, `${T('k.avg', { d: fnum(d) })} <b>${fnum(avg)}</b>`, sp.signups)}
    ${k(T('k.plays', { d: fnum(d) }), s.plays, pct == null ? T('k.noPrev') : `<b class="sgn${pct < 0 ? ' dn' : ''}">${fsigned(pct)}%</b> ${T('k.vsPrev')}`, sp.plays)}
    ${k(T('k.endings', { d: fnum(d) }), s.endings_n, `<b>${fnum(rate)}%</b> ${T('k.ofPlays')}`, sp.endings)}
  </dl>`;
}

function chart(id, title, small, label, plotHtml, xax, legend, rows) {
  const tbl = st.asTable[id];
  const table = `<div class="adm-scroll"><table class="adm-table"><thead><tr><th scope="col">${rows.h[0]}</th><th scope="col">${rows.h[1]}</th></tr></thead><tbody>${rows.r.map(([a, b]) => `<tr><td>${esc(a)}</td><td class="tnum">${esc(b)}</td></tr>`).join('')}</tbody></table></div>`;
  return `<figure class="adm-chart" style="margin:0" data-chart="${id}"><h3>${title} <small>${small}</small></h3>
    ${tbl ? table : `<div class="adm-plot" role="img" aria-label="${esc(label)}">${plotHtml}</div>${xax ? `<div class="adm-xax">${xax}</div>` : ''}${legend ? `<div class="adm-legend">${legend}</div>` : ''}`}
    <button type="button" class="link adm-astable" data-astable="${id}" aria-pressed="${!!tbl}">${tbl ? T('asChart') : T('asTable')}</button></figure>`;
}
const noData = (id, title) => `<figure class="adm-chart" style="margin:0" data-chart="${id}"><h3>${title}</h3>${empty(T('noData'))}</figure>`;

function chartsHtml(s) {
  const d = st.period;
  // 1. signups per day (oldest at the right, today in acc)
  const su = s.signups || [];
  const tot = su.reduce((n, r) => n + r.n, 0);
  const m1 = niceMax(Math.max(...su.map((r) => r.n), 1));
  const c1 = !tot ? noData('signups', T('c.signups')) : chart('signups', T('c.signups'), `${T('c.lastDays', { d: fnum(d) })} · ${T('c.total')} <b class="tnum">${fnum(tot)}</b>`,
    T('c.signupsAria', { min: fnum(Math.min(...su.map((r) => r.n))), max: fnum(Math.max(...su.map((r) => r.n))), today: fnum((su[su.length - 1] || {}).n || 0) }),
    `${gl([0, m1 / 2, m1].map(Math.round), m1)}<div class="adm-cols">${su.map((r, i) => `<i class="${i === su.length - 1 ? 'now' : ''}" style="height:${((r.n / m1) * 100).toFixed(1)}%" title="${fday(r.d)}: ${r.n}"></i>`).join('')}</div>`,
    `<span>${fday(su[0] && su[0].d)}</span><span>${fday(su[Math.floor(su.length / 2)] && su[Math.floor(su.length / 2)].d)}</span><span>${T('c.today')}</span>`,
    `<span><i class="sq"></i>${T('c.perDay')}</span><span><i class="sq a"></i>${T('c.today')}</span>`,
    { h: [T('c.day'), T('c.signups')], r: su.slice().reverse().map((r) => [fdate(r.d), fnum(r.n)]) });
  // 2. active subscriptions per week, yearly solid ink, monthly dashed acc
  const wk = s.subs_weekly || [];
  const any = wk.some((w) => w.monthly || w.yearly);
  const m2 = niceMax(Math.max(1, ...wk.map((w) => Math.max(w.monthly, w.yearly))));
  const pl = (k) => wk.map((w, i) => `${(100 - (i * 100) / Math.max(1, wk.length - 1)).toFixed(2)},${(100 - (w[k] / m2) * 100).toFixed(2)}`).join(' ');
  const last = wk[wk.length - 1] || { monthly: 0, yearly: 0 };
  const c2 = !any ? noData('subs', T('c.subs')) : chart('subs', T('c.subs'), T('c.weeks', { n: fnum(wk.length) }), T('c.subsAria', { y: fnum(last.yearly), m: fnum(last.monthly) }),
    `${gl([0, m2 / 4, m2 / 2, (m2 * 3) / 4, m2].map(Math.round), m2)}<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${pl('yearly')}" stroke="var(--ink)" stroke-width="2"/><polyline points="${pl('monthly')}" stroke="var(--acc)" stroke-width="2" stroke-dasharray="5 4"/></svg>`,
    `<span>${T('c.week1')}</span><span>${T('c.weekN', { n: fnum(Math.ceil(wk.length / 2)) })}</span><span>${T('c.thisWeek')}</span>`,
    `<span><i></i>${T('plan.yearly')} <b class="tnum">${fnum(last.yearly)}</b></span><span><i class="m"></i>${T('plan.monthly')} <b class="tnum">${fnum(last.monthly)}</b></span>`,
    { h: [T('c.week'), `${T('plan.yearly')} / ${T('plan.monthly')}`], r: wk.slice().reverse().map((w) => [fdate(w.w), `${fnum(w.yearly)} / ${fnum(w.monthly)}`]) });
  // 3. plays per story (horizontal bars from the right, top story in acc)
  const by = (s.stories || []).filter((r) => r.plays).sort((a, b) => b.plays - a.plays);
  const m3 = Math.max(1, ...by.map((r) => r.plays));
  const c3 = !by.length ? noData('plays', T('c.plays')) : st.asTable.plays
    ? chart('plays', T('c.plays'), T('c.lastDays', { d: fnum(d) }), '', '', '', '', { h: [T('story'), T('c.plays')], r: by.map((r) => [storyTitle(r.story), fnum(r.plays)]) })
    : `<figure class="adm-chart" style="margin:0" data-chart="plays"><h3>${T('c.plays')} <small>${T('c.lastDays', { d: fnum(d) })}</small></h3>
      <ul class="adm-hbars" role="img" aria-label="${esc(T('c.playsAria', { s: storyTitle(by[0].story), n: fnum(by[0].plays) }))}">${by.map((r, i) => `<li><span>${esc(short(storyOf(r.story) || { title: r.story }))}</span><span class="bar"><i class="${i === 0 ? 'a' : ''}" style="width:${((r.plays / m3) * 100).toFixed(1)}%"></i></span><b class="tnum">${fnum(r.plays)}</b></li>`).join('')}</ul>
      <button type="button" class="link adm-astable" data-astable="plays" aria-pressed="false">${T('asTable')}</button></figure>`;
  // 4. who reaches each chapter (free chapters mut, paid ink, paywall rule)
  const ready = ALL_STORIES.filter((x) => x.ready && x.chapters);
  const fs = storyOf(st.funnel) || storyOf((by[0] || {}).story) || ready[0];
  let c4 = '';
  if (fs) {
    const n = fs.chapters, free = fs.freeChapters ?? CONFIG.freeChaptersDefault;
    const plays = ((s.stories || []).find((r) => r.story === fs.id) || {}).plays || 0;
    const fn = (s.funnel || []).filter((r) => r.story === fs.id);
    const ids = chIds[fs.id] || [];
    const reach = Array.from({ length: n }, (_, i) => (i === 0 ? plays : ((fn.find((r) => r.chapter === ids[i - 1]) || {}).n || 0)));
    const top = Math.max(1, reach[0], ...reach);
    const pct = reach.map((v) => Math.round((v / top) * 100));
    const picker = `<label>${T('c.story')} <select class="adm-sel" data-a="funnel" aria-label="${T('c.pickStory')}">${ready.map((x) => `<option value="${x.id}"${x.id === fs.id ? ' selected' : ''}>${esc(short(x))}</option>`).join('')}</select></label>`;
    c4 = !plays ? `<figure class="adm-chart" style="margin:0" data-chart="funnel"><h3>${T('c.funnel')} <small>${picker}</small></h3>${empty(T('noData'))}</figure>`
      : chart('funnel', T('c.funnel'), picker, T('c.funnelAria', { p3: fnum(pct[2] ?? 0), pn: fnum(pct[n - 1]) }),
        `${gl([0, 50, 100], 100, (v) => fnum(v) + '%')}<div class="adm-cols" style="gap:10px">${pct.map((v, i) => `<i class="${i < free ? 'free' : ''}" style="height:${v}%" title="${T('c.ch', { n: fnum(i + 1) })}: ${v}%"></i>`).join('')}</div>${free > 0 && free < n ? `<div class="adm-paywall" style="inset-inline-start:${((free / n) * 100).toFixed(1)}%"><span>${T('c.paywall')}</span></div>` : ''}`,
        `<span>${T('c.ch', { n: fnum(1) })}</span><span>${T('c.ch', { n: fnum(Math.ceil(n / 2)) })}</span><span>${T('c.ch', { n: fnum(n) })}</span>`,
        `<span><i class="sq" style="background:var(--mut)"></i>${T('c.freeCh')}</span><span><i class="sq"></i>${T('c.paidCh')}</span>`,
        { h: [T('c.chapter'), T('c.reach')], r: pct.map((v, i) => [T('c.ch', { n: fnum(i + 1) }), v + '%']) });
  }
  return `<div class="adm-charts">${c1}${c2}${c3}${c4}</div>`;
}

const chIds = {};   // story id -> chapter ids, read from the story module for the funnel
async function ensureChIds(id) {
  const s = storyOf(id); if (!s || chIds[id] || !s.load) return;
  try { const m = await s.load(); chIds[id] = ((m.story || m.default || {}).chapters || []).map((c) => c.id); } catch (e) { chIds[id] = []; }
}
const funnelStory = (s) => st.funnel || (((s.stories || []).filter((r) => r.plays).sort((a, b) => b.plays - a.plays)[0] || {}).story) || (ALL_STORIES.find((x) => x.ready) || {}).id;
async function loadStats() { st.stats = await api.stats(st.period); st.counts.users = st.stats.users; st.counts.subs = st.stats.active_subs; return st.stats; }

async function overview(sub) {
  const s = await loadStats();
  await ensureChIds(funnelStory(s));
  const periods = seg('period', [['7', T('p7')], ['30', T('p30')], ['90', T('p90')]], String(st.period), T('period'));
  return `<section class="adm-sec" id="overview" aria-labelledby="h-ov">${head(T('ovTitle'), '', periods, 'h1', T('badge'))}<div id="adm-kpis">${kpisHtml(s)}</div></section>
    <section class="adm-sec" id="analytics" aria-labelledby="h-an">${head(`<span id="h-an">${T('nav.analytics')}</span>`, T('anSub'))}<div id="adm-charts">${chartsHtml(s)}</div></section>`;
}
function bindOverview(sub) {
  const main = $('#main');
  if (sub === 'analytics') document.getElementById('analytics')?.scrollIntoView();
  main.addEventListener('click', async (e) => {
    const p = e.target.closest('[data-seg=period]');
    if (p) {
      st.period = +p.dataset.v;
      main.querySelectorAll('[data-seg=period]').forEach((b) => b.setAttribute('aria-pressed', String(b === p)));
      $('#adm-kpis').setAttribute('aria-busy', 'true');
      try { const s = await loadStats(); await ensureChIds(funnelStory(s)); $('#adm-kpis').innerHTML = kpisHtml(s); $('#adm-charts').innerHTML = chartsHtml(s); } catch (er) { toast(T('saveErr')); }
      $('#adm-kpis').removeAttribute('aria-busy');
      return;
    }
    const tb = e.target.closest('[data-astable]');
    if (tb) { st.asTable[tb.dataset.astable] = !st.asTable[tb.dataset.astable]; $('#adm-charts').innerHTML = chartsHtml(st.stats); }
  });
  main.addEventListener('change', async (e) => { if (e.target.matches('[data-a=funnel]')) { st.funnel = e.target.value; await ensureChIds(st.funnel); $('#adm-charts').innerHTML = chartsHtml(st.stats); } });
}

// ------------------------------------------------------------ users
const COMP_UNTIL = '2100-01-01T00:00:00Z';   // "until revoked"
const memTag = (u) => ({
  paid: tag(`${T('mem.paid')} · ${T('plan.' + (u.sub_variant || 'monthly'))}`),
  past_due: tag(T('st.past_due'), 'acc'),
  comp: tag(T('mem.comp'), 'fill'),
  free: tag(T('mem.free'), 'mut'),
}[u.membership] || tag(T('mem.free'), 'mut'));
const memBtn = (u) => (u.membership === 'comp' ? `<button type="button" class="btn xs danger" data-u="revoke">${T('revoke')}</button>`
  : u.membership === 'free' ? `<button type="button" class="btn xs ghost" data-u="grant">${T('grant')}</button>`
  : `<button type="button" class="btn xs ghost" disabled title="${T('paidHint')}">${T('mem.paidBtn')}</button>`);
let ulist = { rows: [], total: 0, counts: {} };
function userRows() {
  const me = auth.currentUser();
  if (!ulist.rows.length) return empty(T('u.none'), T('u.noneLine'), st.users.q ? `<button type="button" class="btn ghost sm" data-a="clearq">${T('u.clear')}</button>` : '');
  const rows = ulist.rows.map((u) => {
    const self = me && u.id === me.id;
    const nm = u.display_name || (u.email || '').split('@')[0];
    return `<tr data-id="${esc(u.id)}"><td class="first"><div class="adm-who">${avatar(nm, 'adm-ava', u.avatar || '')}<div style="min-width:0"><b>${esc(nm)}</b><small>${esc(u.email || '')}</small></div></div></td>
      <td data-l="${T('col.role')}"><select class="adm-sel" data-u="role" aria-label="${T('roleOf', { n: nm })}"${self ? ` disabled title="${T('selfRole')}"` : ''}><option value="user"${u.role === 'user' ? ' selected' : ''}>${T('roleUser')}</option><option value="admin"${u.role === 'admin' ? ' selected' : ''}>${T('roleAdmin')}</option></select>${self ? `<small class="fine">${T('selfRole')}</small>` : ''}</td>
      <td data-l="${T('col.mem')}"><div class="adm-mcell">${memTag(u)}${memBtn(u)}</div></td>
      <td data-l="${T('col.pearls')}"><div class="adm-ord"><span class="num">${fnum(u.pearls)}</span><button type="button" class="iconbtn sm" data-u="pearls" aria-label="${T('pearlsOf', { n: nm })}" title="${T('pearlsEdit')}">${ic('pearl')}</button></div></td>
      <td data-l="${T('col.seen')}" class="t-hide">${fago(u.last_seen)}</td><td data-l="${T('col.joined')}" class="t-hide"><span class="tnum">${fshort(u.created_at)}</span></td></tr>`;
  }).join('');
  const per = 20, from = (st.users.page - 1) * per + 1, to = Math.min(ulist.total, st.users.page * per);
  return `<div class="adm-scroll"><table class="adm-table"><caption class="sr">${T('u.caption')}</caption><thead><tr><th scope="col">${T('col.user')}</th><th scope="col">${T('col.role')}</th><th scope="col">${T('col.mem')}</th><th scope="col">${T('col.pearls')}</th><th scope="col" class="t-hide">${T('col.seen')}</th><th scope="col" class="t-hide">${T('col.joined')}</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="adm-tfoot"><span class="tnum">${fnum(from)}–${fnum(to)} ${T('of')} ${fnum(ulist.total)}</span><div class="pg"><button type="button" class="btn xs ghost" data-pg="-1"${st.users.page <= 1 ? ' disabled' : ''}>${ic('back')}${T('prev')}</button><button type="button" class="btn xs ghost" data-pg="1"${to >= ulist.total ? ' disabled' : ''}>${T('next')}${ic('fwd')}</button></div></div>`;
}
async function loadUsers() { ulist = await api.users(st.users.q, st.users.filter, st.users.page); st.counts.users = (ulist.counts && ulist.counts.all) ?? st.counts.users; return ulist; }
const usersSummary = () => { const c = ulist.counts || {}; return T('u.summary', { n: fnum(c.all ?? ulist.total), p: fnum(c.paid ?? 0), c: fnum(c.comp ?? 0) }); };
async function users() {
  await loadUsers();
  return `<section class="adm-sec" aria-labelledby="h-us">${head(`<span id="h-us">${T('nav.users')}</span>`, `<span id="usum">${usersSummary()}</span>`)}
    <div class="adm-tbar"><label class="search"><span class="sr">${T('u.searchLabel')}</span>${ic('search')}<input id="uq" type="search" placeholder="${T('u.search')}" value="${esc(st.users.q)}" autocomplete="off"></label>
      ${seg('uf', [['all', T('f.all')], ['paid', T('f.paid')], ['comp', T('f.comp')], ['admins', T('f.admins')]], st.users.filter, T('f.label'))}</div>
    <div id="ulist">${userRows()}</div></section>`;
}
async function refreshUsers() {
  const box = $('#ulist'); if (!box) return;
  box.setAttribute('aria-busy', 'true');
  try { await loadUsers(); box.innerHTML = userRows(); $('#usum').textContent = usersSummary(); }
  catch (e) { box.innerHTML = errorBox(T('u.err'), errText(e)); }
  box.removeAttribute('aria-busy');
}
function pearlsDialog(u) {
  const nm = u.display_name || u.email;
  let mode = 'add', n = 0;
  const after = () => (mode === 'add' ? u.pearls + n : u.pearls - n);
  sheet(`<form class="cdlg adm-pearls" novalidate><h2>${T('pd.title', { n: esc(nm) })}</h2>
    <p>${T('pd.current')} <b class="tnum">${fnum(u.pearls)}</b></p>
    ${seg('pmode', [['add', T('pd.add')], ['sub', T('pd.sub')]], 'add', T('pd.mode'))}
    <div class="fld"><label>${T('pd.amount')}</label>${stepper(0, 0, 999, T('pd.amount'), 'id="pstep"')}<span class="emsg" id="pmsg" hidden>${T('pd.short')}</span></div>
    <div class="fld" id="preason"><label for="pr">${T('pd.reason')}</label><input id="pr" required maxlength="200" aria-describedby="pre"><span class="emsg" id="pre" hidden>${T('pd.reasonReq')}</span></div>
    <p class="fine" role="status">${T('pd.after')} <b class="tnum" id="pafter">${fnum(u.pearls)}</b></p>
    <div class="cdlg-acts"><button type="submit" class="btn pri">${T('pd.save')}</button><button type="button" class="btn ghost" data-a="sheet-close">${T('back')}</button></div></form>`);
  const f = document.querySelector('.adm-pearls'), box = f.querySelector('#pstep');
  const upd = () => { box.dataset.max = mode === 'sub' ? u.pearls : 999; n = setStep(box, n); f.querySelector('#pafter').textContent = fnum(after()); f.querySelector('#pmsg').hidden = !(mode === 'sub' && n >= u.pearls && u.pearls >= 0 && n > 0 && n === u.pearls && false); };
  f.addEventListener('click', (e) => {
    const m = e.target.closest('[data-seg=pmode]');
    if (m) { mode = m.dataset.v; f.querySelectorAll('[data-seg=pmode]').forEach((b) => b.setAttribute('aria-pressed', String(b === m))); upd(); }
    const sb = e.target.closest('[data-step]');
    if (sb) { const want = n + +sb.dataset.step; if (mode === 'sub' && want > u.pearls) { f.querySelector('#pmsg').hidden = false; return; } f.querySelector('#pmsg').hidden = true; n = want; upd(); }
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const reason = f.querySelector('#pr').value.trim();
    const bad = !reason; f.querySelector('#preason').classList.toggle('err', bad); f.querySelector('#pr').setAttribute('aria-invalid', String(bad)); f.querySelector('#pre').hidden = !bad;
    if (bad || !n) return;
    const btn = f.querySelector('[type=submit]'); btn.setAttribute('aria-busy', 'true'); btn.textContent = T('saving');
    try { u.pearls = await api.adjustPearls(u.id, mode === 'add' ? n : -n, reason); closeSheet(true); toast(T('pd.done')); $('#ulist').innerHTML = userRows(); }
    catch (er) { btn.removeAttribute('aria-busy'); btn.textContent = T('pd.save'); toast(/insufficient/.test(errText(er)) ? T('pd.short') : T('saveErr')); }
  });
}
function bindUsers() {
  const main = $('#main'); let tm;
  const q = $('#uq');
  q.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { st.users.q = q.value; st.users.page = 1; refreshUsers(); }, 300); });
  main.addEventListener('click', async (e) => {
    const f = e.target.closest('[data-seg=uf]');
    if (f) { st.users.filter = f.dataset.v; st.users.page = 1; main.querySelectorAll('[data-seg=uf]').forEach((b) => b.setAttribute('aria-pressed', String(b === f))); return refreshUsers(); }
    const pg = e.target.closest('[data-pg]'); if (pg) { st.users.page += +pg.dataset.pg; return refreshUsers(); }
    if (e.target.closest('[data-a=clearq]')) { st.users.q = ''; q.value = ''; return refreshUsers(); }
    if (e.target.closest('[data-a=retry]')) return refreshUsers();
    const b = e.target.closest('button[data-u]'); if (!b) return;
    const u = ulist.rows.find((x) => x.id === b.closest('tr').dataset.id); if (!u) return;
    const nm = u.display_name || u.email;
    if (b.dataset.u === 'pearls') return pearlsDialog(u);
    const grant = b.dataset.u === 'grant';
    const ok = await confirm(grant ? { title: T('cg.title', { n: nm }), body: T('cg.body'), ok: T('cg.ok') } : { title: T('cr.title', { n: nm }), body: T('cr.body'), ok: T('cr.ok'), danger: true });
    if (!ok) return;
    try { await api.updateUser(u.id, { premium_until: grant ? COMP_UNTIL : null }); toast(grant ? T('cg.done') : T('cr.done')); refreshUsers(); } catch (er) { toast(T('saveErr')); }
  });
  main.addEventListener('change', async (e) => {
    if (!e.target.matches('select[data-u=role]')) return;
    const sel = e.target, u = ulist.rows.find((x) => x.id === sel.closest('tr').dataset.id);
    const role = sel.value, nm = u.display_name || u.email;
    if (role === 'admin' && !(await confirm({ title: T('ca.title', { n: nm }), body: T('ca.body'), ok: T('ca.ok') }))) { sel.value = u.role; return; }
    try { await api.updateUser(u.id, { role }); u.role = role; toast(T('saved')); } catch (er) { sel.value = u.role; toast(T('saveErr')); }
  });
}

// ------------------------------------------------------------ subscriptions
const SUB_TAG = { active: ['st.active', ''], on_trial: ['st.on_trial', ''], past_due: ['st.past_due', 'acc'], unpaid: ['st.unpaid', 'acc'], paused: ['st.paused', 'mut'], cancelled: ['st.cancelledGrace', 'acc'], expired: ['st.expired', 'mut'] };
const subTag = (s) => { const [k, c] = SUB_TAG[s.status] || ['st.expired', 'mut']; return tag(T(k), c); };
const price = (plan) => (plan === 'yearly' ? CONFIG.plans.yearly.price : CONFIG.plans.monthly.price);
function subsRows(list) {
  if (!list.length) return empty(T('s.none'));
  return `<div class="adm-scroll"><table class="adm-table"><caption class="sr">${T('nav.subs')}</caption><thead><tr><th scope="col">${T('col.subscriber')}</th><th scope="col">${T('col.plan')}</th><th scope="col">${T('col.status')}</th><th scope="col" class="t-hide">${T('col.started')}</th><th scope="col">${T('col.renewEnd')}</th><th scope="col"><span class="sr">${T('col.link')}</span></th></tr></thead><tbody>
    ${list.map((s) => {
      const nm = s.name || (s.email || '').split('@')[0] || '—';
      const when = s.status === 'expired' ? T('s.ended', { d: fshort(s.ends_at) }) : s.status === 'cancelled' ? T('s.ends', { d: fshort(s.ends_at) }) : s.status === 'past_due' ? T('s.retry', { d: fshort(s.renews_at) }) : s.renews_at ? T('s.renews', { d: fshort(s.renews_at) }) : '—';
      return `<tr><td class="first"><div class="adm-who">${avatar(nm, 'adm-ava', '')}<b>${esc(nm)}</b></div></td>
        <td data-l="${T('col.plan')}">${T('plan.' + (s.variant === 'yearly' ? 'yearly' : 'monthly'))} · <bdi class="ltr tnum">$${esc(price(s.variant))}</bdi>${s.test_mode ? ` ${tag(T('test'), 'mut')}` : ''}</td>
        <td data-l="${T('col.status')}">${subTag(s)}</td><td data-l="${T('col.started')}" class="t-hide"><span class="tnum">${fshort(s.created_at)}</span></td>
        <td data-l="${T('col.renewEnd')}"><span class="tnum">${when}</span></td>
        <td class="act"><a class="btn xs ghost" href="https://app.lemonsqueezy.com/subscriptions/${encodeURIComponent(s.ls_subscription_id)}" target="_blank" rel="noopener" aria-label="${T('s.openAria')}">${T('s.open')}${ic('ext')}</a></td></tr>`;
    }).join('')}</tbody></table></div>`;
}
async function subs() {
  const [list, s] = await Promise.all([api.subs(st.subsFilter), st.stats ? st.stats : loadStats()]);
  const c = s.subs_counts || { monthly: 0, yearly: 0, cancelled_month: 0 };
  const mrr = c.monthly * +CONFIG.plans.monthly.price + (c.yearly * +CONFIG.plans.yearly.price) / 12;
  const sub = [T('s.sub'), CONFIG.lemonSqueezy.testMode ? T('s.testOn') : ''].filter(Boolean).join(' · ');
  return `<section class="adm-sec" aria-labelledby="h-sb">${head(`<span id="h-sb">${T('nav.subs')}</span>`, sub, seg('sf', [['all', T('f.all')], ['active', T('sf.active')], ['late', T('sf.late')], ['cancelled', T('sf.cancelled')]], st.subsFilter, T('f.label')))}
    <div class="adm-sum"><span>${T('plan.yearly')} <b class="tnum">${fnum(c.yearly)}</b></span><span>${T('plan.monthly')} <b class="tnum">${fnum(c.monthly)}</b></span><span>${T('s.mrr')} <b class="ltr tnum">$${fnum(Math.round(mrr))}</b></span><span>${T('s.cancelledMonth')} <b class="tnum">${fnum(c.cancelled_month)}</b></span></div>
    <div id="slist">${subsRows(list)}</div></section>`;
}
function bindSubs() {
  $('#main').addEventListener('click', async (e) => {
    const f = e.target.closest('[data-seg=sf]'); if (!f) return;
    st.subsFilter = f.dataset.v; document.querySelectorAll('[data-seg=sf]').forEach((b) => b.setAttribute('aria-pressed', String(b === f)));
    try { $('#slist').innerHTML = subsRows(await api.subs(st.subsFilter)); } catch (er) { $('#slist').innerHTML = errorBox(T('s.err'), errText(er)); }
  });
}

// ------------------------------------------------------------ categories data (shared by stories + categories)
let cats = [];
async function loadCats() {
  try { const rows = await api.categories(); cats = rows.length ? rows : JSON.parse(JSON.stringify(ALL_CATEGORIES)); }
  catch (e) { if (schemaMissing(e)) cats = JSON.parse(JSON.stringify(ALL_CATEGORIES)); else throw e; }
  cats.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  st.counts.cats = cats.length;
}
const catBy = (slug) => cats.find((c) => c.slug === slug);
const storyCount = (slug) => ALL_STORIES.filter((s) => (s.category || DEFAULT_CATEGORY) === slug).length;

// ------------------------------------------------------------ stories
let flags = [], orig = [];
async function stories() {
  await loadCats();
  const [rows, s] = await Promise.all([api.storyFlags(), st.stats ? st.stats : loadStats().catch(() => ({}))]);
  const by = Object.fromEntries(rows.map((r) => [r.story_id, r]));
  flags = ALL_STORIES.map((x, i) => {
    const r = by[x.id] || {};
    return { story_id: x.id, category: r.category || x.category || DEFAULT_CATEGORY, published: r.published !== false, coming_soon: !!r.coming_soon,
      free_chapters: Number.isInteger(r.free_chapters) ? r.free_chapters : (x.freeChapters ?? CONFIG.freeChaptersDefault), sort_order: Number.isInteger(r.sort_order) ? r.sort_order : i };
  }).sort((a, b) => a.sort_order - b.sort_order);
  orig = JSON.parse(JSON.stringify(flags));
  st.counts.stories = flags.length;
  return `<section class="adm-sec" aria-labelledby="h-st">${head(`<span id="h-st">${T('nav.stories')}</span>`, T('st.sub'))}<div id="stbody">${storiesTable()}</div><div id="dirty"></div></section>`;
}
function storiesTable() {
  const by = Object.fromEntries(((st.stats && st.stats.stories) || []).map((r) => [r.story, r]));
  const rows = flags.map((f, i) => {
    const s = storyOf(f.story_id), o = orig.find((x) => x.story_id === f.story_id) || f;
    const live = !f.coming_soon && s;
    const r = by[f.story_id] || {};
    const n = s.chapters || 0;
    return `<tr class="adm-stcard" data-i="${i}"><td class="first"><div class="adm-who"><span class="adm-stcov" style="background-image:url(assets/img/${esc(s.cover)}.webp)"></span><div style="min-width:0"><b style="font-family:var(--f-read);font-size:19px">${esc(s.title)}</b><span class="fine" style="font-size:14px">${esc(s.poet)}</span></div></div></td>
      <td data-l="${T('col.order')}"><div class="adm-ord"><button type="button" class="iconbtn sm" data-mv="-1" aria-label="${T('moveUp', { n: s.title })}"${i === 0 ? ' disabled' : ''}>${ic('up')}</button><span class="num">${String(i + 1).padStart(2, '0')}</span><button type="button" class="iconbtn sm" data-mv="1" aria-label="${T('moveDown', { n: s.title })}"${i === flags.length - 1 ? ' disabled' : ''}>${ic('down')}</button></div></td>
      <td data-l="${T('col.cat')}"><select class="adm-sel" data-k="category" aria-label="${T('catOf', { n: s.title })}">${cats.map((c) => `<option value="${esc(c.slug)}"${c.slug === f.category ? ' selected' : ''}>${esc(catName(c))}${c.published === false ? ` (${T('hidden')})` : ''}</option>`).join('')}</select></td>
      <td data-l="${T('col.status')}">${sw(!f.coming_soon, T('pub'), T('soon'), `data-k="status" aria-label="${T('pubOf', { n: s.title })}"`)}</td>
      <td data-l="${T('col.free')}">${stepper(f.free_chapters, 0, n || 20, T('freeOf', { n: s.title }), 'data-k="free"')}${f.free_chapters < o.free_chapters ? `<span class="hint fine">${T('freeLower')}</span>` : ''}</td>
      <td data-l="${T('col.chapters')}" class="t-hide"><span class="num">${fnum(n)}</span></td>
      <td data-l="${T('col.plays')}" class="t-hide"><span class="num">${live && r.plays ? fnum(r.plays) : '—'}</span></td>
      <td data-l="${T('col.endings')}" class="t-hide"><span class="num">${live && r.endings ? fnum(r.endings) : '—'}</span>${live ? `<small class="fine" style="font-size:13px">${T('ofEndings', { n: fnum(s.endings || 0) })}</small>` : ''}</td></tr>`;
  }).join('');
  return `<div class="adm-scroll"><table class="adm-table"><caption class="sr">${T('st.caption')}</caption><thead><tr><th scope="col">${T('story')}</th><th scope="col">${T('col.order')}</th><th scope="col">${T('col.cat')}</th><th scope="col">${T('col.status')}</th><th scope="col">${T('col.free')}</th><th scope="col" class="t-hide">${T('col.chapters')}</th><th scope="col" class="t-hide">${T('col.plays')}</th><th scope="col" class="t-hide">${T('col.endings')}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function describeChanges() {
  const parts = [];
  const moved = flags.filter((f, i) => orig[i] && orig[i].story_id !== f.story_id).length;
  if (moved) parts.push(T('ch.order', { n: fnum(moved) }));
  const diff = (k) => flags.filter((f) => { const o = orig.find((x) => x.story_id === f.story_id); return o && o[k] !== f[k]; }).map((f) => `«${storyTitle(f.story_id)}»`);
  const fr = diff('free_chapters'); if (fr.length) parts.push(T('ch.free', { s: fr.join('، ') }));
  const sv = diff('coming_soon'); if (sv.length) parts.push(T('ch.status', { s: sv.join('، ') }));
  const ca = diff('category'); if (ca.length) parts.push(T('ch.cat', { s: ca.join('، ') }));
  return parts.length ? T('ch.you', { s: parts.join(T('ch.and')) }) : '';
}
function renderDirty() {
  const d = describeChanges();
  $('#dirty').innerHTML = d ? `<div class="adm-dirty" role="status"><p>${esc(d)}</p><div class="adm-act"><button type="button" class="btn ghost sm" data-a="undo">${T('undo')}</button><button type="button" class="btn pri sm" data-a="savestories">${T('saveChanges')}</button></div></div>` : '';
  leave = d ? () => window.confirm(T('leave')) : null;
}
function bindStories() {
  const main = $('#main');
  const redraw = () => { $('#stbody').innerHTML = storiesTable(); renderDirty(); };
  main.addEventListener('click', async (e) => {
    const tr = e.target.closest('tr[data-i]'); const i = tr ? +tr.dataset.i : -1;
    const mv = e.target.closest('[data-mv]');
    if (mv) { const j = i + +mv.dataset.mv; [flags[i], flags[j]] = [flags[j], flags[i]]; return redraw(); }
    const stp = e.target.closest('[data-step]');
    if (stp) { const f = flags[i]; const n = storyOf(f.story_id).chapters || 20; f.free_chapters = Math.max(0, Math.min(n, f.free_chapters + +stp.dataset.step)); return redraw(); }
    const swb = e.target.closest('.sw[data-k=status]');
    if (swb) {
      const f = flags[i];
      if (!f.coming_soon && !(await confirm({ title: T('cs.title', { n: storyTitle(f.story_id) }), body: T('cs.body'), ok: T('cs.ok') }))) return;
      f.coming_soon = !f.coming_soon; return redraw();
    }
    if (e.target.closest('[data-a=undo]')) { flags = JSON.parse(JSON.stringify(orig)); return redraw(); }
    const sv = e.target.closest('[data-a=savestories]');
    if (sv) {
      sv.setAttribute('aria-busy', 'true'); sv.textContent = T('saving');
      const rows = flags.map((f, k) => ({ ...f, sort_order: k }));
      try { await api.saveStoryFlags(rows); applyStoryFlags(rows); orig = JSON.parse(JSON.stringify(flags)); toast(T('saved')); redraw(); }
      catch (er) { toast(T('saveErr')); renderDirty(); }
    }
  });
  main.addEventListener('change', async (e) => {
    if (!e.target.matches('select[data-k=category]')) return;
    const f = flags[+e.target.closest('tr').dataset.i], c = catBy(e.target.value);
    if (c && c.kid_friendly && !(await confirm({ title: T('ck.title', { s: storyTitle(f.story_id), c: catName(c) }), body: T('ck.body', { c: catName(c) }), ok: T('ck.ok') }))) { e.target.value = f.category; return; }
    f.category = e.target.value; renderDirty();
  });
}

// ------------------------------------------------------------ categories
let editing = null;   // slug being edited, or '' for a new one
async function categoriesTab() { await loadCats(); return `<section class="adm-sec" aria-labelledby="h-ca">${head(`<span id="h-ca">${T('nav.categories')}</span>`, T('ca.sub'), `<button type="button" class="btn pri sm" data-a="catadd">${ic('plus')}${T('ca.add')}</button>`)}<div id="catbody">${catsHtml()}</div></section>`; }
function catsHtml() {
  const rows = cats.map((c, i) => {
    const fl = [c.kid_friendly ? T('ca.kids') : '', c.no_character_images ? T('ca.noImg') : ''].filter(Boolean);
    return `<tr data-cat="${accentOf(c)}" data-i="${i}" class="${editing === c.slug ? 'sel' : ''}"><td class="first"><div class="catname"><span class="sw8"></span><div><b>${esc(catName(c))}</b><small>/c/${esc(c.slug)}</small></div></div></td>
      <td data-l="${T('col.order')}"><div class="adm-ord"><button type="button" class="iconbtn sm" data-mv="-1" aria-label="${T('moveUp', { n: catName(c) })}"${i === 0 ? ' disabled' : ''}>${ic('up')}</button><span class="num">${String(i + 1).padStart(2, '0')}</span><button type="button" class="iconbtn sm" data-mv="1" aria-label="${T('moveDown', { n: catName(c) })}"${i === cats.length - 1 ? ' disabled' : ''}>${ic('down')}</button></div></td>
      <td data-l="${T('col.stories')}"><span class="num">${fnum(storyCount(c.slug))}</span></td>
      <td data-l="${T('col.visible')}">${sw(c.published !== false, T('shown'), T('hidden'), `data-k="vis" aria-label="${T('showOf', { n: catName(c) })}"`)}</td>
      <td data-l="${T('col.flags')}"><div class="flags">${fl.map((x) => tag(x)).join('') || '<span class="fine">—</span>'}</div></td>
      <td class="act"><button type="button" class="btn xs ghost" data-a="catedit" aria-expanded="${editing === c.slug}">${T('edit')}</button></td></tr>`;
  }).join('');
  const panel = editing !== null && window.innerWidth >= 700 ? editPanel() : '';
  return `<div class="adm-scroll"><table class="adm-table"><caption class="sr">${T('ca.caption')}</caption><thead><tr><th scope="col">${T('col.cat')}</th><th scope="col">${T('col.order')}</th><th scope="col">${T('col.stories')}</th><th scope="col">${T('col.visible')}</th><th scope="col">${T('col.flags')}</th><th scope="col"><span class="sr">${T('edit')}</span></th></tr></thead><tbody>${rows}</tbody></table></div>${panel}`;
}
function editPanel() {
  const isNew = editing === '';
  const c = isNew ? { slug: '', name: { ar: '' }, description: { ar: '' }, accent: 'poets', ornament: 'lozenge', published: false, no_character_images: false, kid_friendly: false, min_age: null } : catBy(editing);
  const n = isNew ? 0 : storyCount(c.slug);
  const delOff = isNew || n > 0 || c.slug === DEFAULT_CATEGORY;
  const ac = accentOf(c);
  return `<form class="catedit" data-cat="${ac}" id="catf" novalidate aria-labelledby="ce-h"><h3 class="full" id="ce-h"><span class="sw8"></span>${isNew ? T('ca.new') : T('ca.editTitle', { n: esc(catName(c)) })}</h3>
    <div class="fld" id="f_name"><label for="cn">${T('ca.name')}</label><input id="cn" value="${esc(catName(c))}" required aria-describedby="cn-e"><span class="emsg" id="cn-e" hidden>${T('ca.nameReq')}</span></div>
    <div class="fld" id="f_slug"><label for="cs">${T('ca.slug')}</label><div class="affix ltr" dir="ltr"><span>/c/</span><input id="cs" value="${esc(c.slug)}" dir="ltr" maxlength="40" ${isNew ? '' : 'readonly'} aria-describedby="cs-h cs-e"></div><span class="hint" id="cs-h">${isNew ? T('ca.slugHint') : T('ca.slugFixed')}</span><span class="emsg" id="cs-e" hidden></span></div>
    <div class="fld full"><label for="cd">${T('ca.desc')}</label><input id="cd" value="${esc(catDesc(c))}"></div>
    <fieldset class="fld full" style="border:0;padding:0;margin:0"><legend>${T('ca.color')}</legend><div class="swatches">${ACCENTS.map(([k, hex]) => `<label class="${k === ac ? 'on' : ''}" style="--c:${hex}"><input type="radio" name="acc" value="${k}" class="sr"${k === ac ? ' checked' : ''}><i></i>${T('acc.' + k)}</label>`).join('')}</div><span class="hint">${T('ca.colorHint')}</span></fieldset>
    <div class="flagrow">${sw(!!c.no_character_images, T('ca.noImg'), T('ca.noImg'), 'data-f="noimg"')}<span class="hint">${T('ca.noImgHint')}</span></div>
    <div class="flagrow">${sw(!!c.kid_friendly, T('ca.kidsLong'), T('ca.kidsLong'), 'data-f="kids"')}<span class="hint">${T('ca.kidsHint')}</span>
      <div class="fld" style="margin-top:6px"><label>${T('ca.minAge')}</label>${stepper(c.min_age ?? 0, 0, 18, T('ca.minAge'), 'id="cage"')}</div></div>
    <div class="flagrow">${sw(c.published !== false, T('ca.visLong'), T('ca.visLong'), 'data-f="vis"')}<span class="hint">${T('ca.visHint', { n: fnum(n) })}</span></div>
    <div class="flagrow"><span class="fld"><label for="co">${T('ca.orn')}</label><select id="co">${ORNAMENT_KEYS.map((k) => `<option value="${k}"${k === (c.ornament || 'lozenge') ? ' selected' : ''}>${T('orn.' + k)}</option>`).join('')}</select></span></div>
    <div class="acts full"><button type="submit" class="btn pri sm">${T('ca.save')}</button><button type="button" class="btn ghost sm" data-a="catcancel">${T('cancel')}</button><button type="button" class="btn danger sm" data-a="catdel"${delOff ? ' disabled' : ''}>${T('ca.del')}</button>${!isNew && delOff ? `<span class="fine">${c.slug === DEFAULT_CATEGORY ? T('ca.delDefault') : T('ca.delHint')}</span>` : ''}</div></form>`;
}
const catRow = (c, i) => ({ slug: c.slug, name: c.name, description: c.description || {}, sort_order: i + 1, icon: c.icon || 'book', cover: c.cover || null, accent: accentOf(c), ornament: c.ornament || 'lozenge',
  published: c.published !== false, no_character_images: !!c.no_character_images, kid_friendly: !!c.kid_friendly, min_age: c.min_age ?? null, options: c.options || {} });
async function saveCats(list = cats) {
  const rows = list.map(catRow);
  await api.saveCategories(rows); applyCategories(rows);
}
function openEditor(slug) {
  editing = slug;
  if (window.innerWidth < 700) { sheet(editPanel(), { cls: 'full' }); bindEditor(document.getElementById('sheet')); }
  else { $('#catbody').innerHTML = catsHtml(); bindEditor($('#catbody')); $('#catf').scrollIntoView({ block: 'nearest' }); $('#cn').focus(); }
}
function closeEditor() { editing = null; closeSheet(true); $('#catbody').innerHTML = catsHtml(); }
function bindEditor(root) {
  const f = root.querySelector('#catf'); if (!f) return;
  f.addEventListener('input', (e) => { const w = e.target.closest('.fld.err'); if (w) { w.classList.remove('err'); w.querySelectorAll('.emsg').forEach((m) => { m.hidden = true; }); } });
  f.addEventListener('change', (e) => { if (e.target.name === 'acc') { f.dataset.cat = e.target.value; f.querySelectorAll('.swatches label').forEach((l) => l.classList.toggle('on', l.contains(e.target))); } });
  f.addEventListener('click', async (e) => {
    const s = e.target.closest('.sw[data-f]');
    if (s) {
      const on = !isOn(s);
      if (s.dataset.f === 'noimg' && on && editing && storyCount(editing) && !(await confirm({ title: T('cn.title'), body: T('cn.body', { n: fnum(storyCount(editing)) }), ok: T('cn.ok') }))) return;
      flip(s, on); return;
    }
    const stp = e.target.closest('#cage [data-step]'); if (stp) { const b = f.querySelector('#cage'); setStep(b, (+b.dataset.v || +b.querySelector('output').textContent || 0) + +stp.dataset.step); return; }
    if (e.target.closest('[data-a=catcancel]')) return closeEditor();
    if (e.target.closest('[data-a=catdel]')) {
      const c = catBy(editing), nm = catName(c);
      const ok = await confirm({ title: T('cd.title', { n: nm }), body: T('cd.body'), ok: T('cd.ok'), danger: true,
        extra: `<div class="fld"><label for="cdn">${T('cd.type', { n: esc(nm) })}</label><input id="cdn" autocomplete="off"></div>`, check: (box) => box.querySelector('#cdn').value.trim() === nm });
      if (!ok) return;
      try { await api.deleteCategory(c.slug); cats = cats.filter((x) => x !== c); await saveCats(); toast(T('cd.done')); closeEditor(); } catch (er) { toast(T('saveErr')); }
    }
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const isNew = editing === '';
    const v = (id) => f.querySelector('#' + id).value.trim();
    const slug = v('cs').toLowerCase(), name = v('cn');
    const slugErr = isNew ? (!/^[a-z0-9-]{1,40}$/.test(slug) ? T('ca.slugBad') : catBy(slug) ? T('ca.slugUsed') : '') : '';
    f.querySelector('#f_name').classList.toggle('err', !name); f.querySelector('#cn-e').hidden = !!name;
    f.querySelector('#f_slug').classList.toggle('err', !!slugErr); const se = f.querySelector('#cs-e'); se.hidden = !slugErr; se.textContent = slugErr;
    if (!name || slugErr) return;
    const get = (k) => isOn(f.querySelector(`.sw[data-f=${k}]`));
    const age = +(f.querySelector('#cage').dataset.v ?? f.querySelector('#cage output').textContent);
    const base = isNew ? { slug, icon: 'book', cover: null, options: {} } : catBy(editing);
    const row = Object.assign(base, { name: { ...(base.name || {}), ar: name }, description: { ...(base.description || {}), ar: v('cd') }, accent: f.querySelector('[name=acc]:checked').value,
      ornament: v('co'), no_character_images: get('noimg'), kid_friendly: get('kids'), min_age: age || null, published: get('vis') });
    if (!isNew && row.published === false && catBy(editing).published !== false) { /* unchanged */ }
    if (isNew) cats.push(row);
    try { await saveCats(); toast(T('ca.saved')); closeEditor(); } catch (er) { if (isNew) cats.pop(); toast(T('saveErr')); }
  });
}
function bindCats() {
  const main = $('#main');
  main.addEventListener('click', async (e) => {
    if (e.target.closest('#catf')) return;
    if (e.target.closest('[data-a=catadd]')) return openEditor('');
    const tr = e.target.closest('tr[data-i]'); if (!tr) return;
    const i = +tr.dataset.i, c = cats[i];
    const mv = e.target.closest('[data-mv]');
    if (mv) { const j = i + +mv.dataset.mv; [cats[i], cats[j]] = [cats[j], cats[i]]; try { await saveCats(); toast(T('ca.orderSaved')); } catch (er) { toast(T('saveErr')); } $('#catbody').innerHTML = catsHtml(); bindEditor($('#catbody')); return; }
    const s = e.target.closest('.sw[data-k=vis]');
    if (s) {
      const on = !isOn(s);
      if (!on && !(await confirm({ title: T('ch2.title', { n: catName(c) }), body: T('ch2.body', { n: fnum(storyCount(c.slug)) }), ok: T('ch2.ok'), danger: true }))) return;
      c.published = on; s.setAttribute('aria-busy', 'true'); flip(s, on);
      try { await saveCats(); toast(on ? T('ca.shownDone') : T('ca.hiddenDone')); } catch (er) { c.published = !on; flip(s, !on); toast(T('saveErr')); }
      s.removeAttribute('aria-busy'); $('#catbody').innerHTML = catsHtml(); bindEditor($('#catbody'));
      return;
    }
    if (e.target.closest('[data-a=catedit]')) openEditor(editing === c.slug ? null : c.slug);
  });
}

// ------------------------------------------------------------ settings
let saved = null, lastSaved = null;
const PROVS = ['google', 'facebook', 'x', 'email'];
function readSettings() {
  const P = CONFIG.plans;
  return { mp: String(P.monthly.price), yp: String(P.yearly.price), mpearls: String(P.monthlyPearls), spearls: String(CONFIG.startingPearls), free: CONFIG.freeChaptersDefault,
    auth: Object.fromEntries(PROVS.map((p) => [p, !!CONFIG.auth[p].enabled])) };
}
async function settingsTab() {
  try { const rows = await api.settings(); applySettings(rows); lastSaved = rows.reduce((m, r) => (r.updated_at && (!m || r.updated_at > m) ? r.updated_at : m), null); } catch (e) { if (!schemaMissing(e)) throw e; }
  saved = readSettings();
  const v = saved;
  const money = (id, label, val) => `<div class="fld" id="w_${id}"><label for="${id}">${label}</label><div class="affix ltr" dir="ltr"><span>$</span><input id="${id}" inputmode="decimal" value="${esc(val)}" dir="ltr" aria-describedby="${id}-e"></div><span class="emsg" id="${id}-e" hidden>${T('se.price')}</span></div>`;
  const int = (id, label, val, hint = '') => `<div class="fld" id="w_${id}"><label for="${id}">${label}</label><input id="${id}" inputmode="numeric" value="${esc(val)}" dir="ltr" aria-describedby="${id}-e">${hint ? `<span class="hint">${hint}</span>` : ''}<span class="emsg" id="${id}-e" hidden>${T('se.range')}</span></div>`;
  const prov = (p) => `<div class="adm-prov"><span>${T('prov.' + p)}<small>${v.auth[p] ? (p === 'email' ? T('prov.magic') : T('prov.on')) : (p === 'email' ? T('prov.magic') : T('prov.needs'))}</small></span>${sw(v.auth[p], T('enabled'), T('disabled'), `data-p="${p}"`)}</div>`;
  return `<section class="adm-sec" aria-labelledby="h-se">${head(`<span id="h-se">${T('nav.settings')}</span>`, T('se.sub'))}
    <form class="adm-setgrid" id="setf" novalidate>
      <fieldset><legend>${T('se.prices')}</legend><div class="adm-two">${money('s_mp', T('se.monthly'), v.mp)}${money('s_yp', T('se.yearly'), v.yp)}</div><p class="fine">${T('se.pricesNote')}</p></fieldset>
      <fieldset><legend>${T('se.pearls')}</legend><div class="adm-two">${int('s_mpearls', T('se.monthlyPearls'), v.mpearls, T('se.monthlyPearlsHint'))}${int('s_spearls', T('se.startPearls'), v.spearls)}</div></fieldset>
      <fieldset><legend>${T('se.free')}</legend><div class="fld"><label>${T('se.freeDefault')}</label>${stepper(v.free, 0, 10, T('se.freeDefault'), 'id="s_free"')}<span class="hint">${T('se.freeHint')}</span></div></fieldset>
      <fieldset><legend>${T('se.auth')}</legend>${PROVS.map(prov).join('')}<span class="emsg" id="prov-e" hidden>${T('se.oneProv')}</span></fieldset>
    </form>
    <div class="adm-savebar"><button type="button" class="btn pri" data-a="saveset" disabled>${T('se.save')}</button><button type="button" class="btn ghost" data-a="revert" disabled>${T('se.revert')}</button><span class="fine" role="status" id="setmsg">${lastSaved ? T('se.last', { t: `${fdate(lastSaved)} ${ftime(lastSaved)}` }) : ''}</span></div></section>`;
}
function bindSettings() {
  const main = $('#main'), f = $('#setf');
  const cur = () => ({ mp: $('#s_mp').value.trim(), yp: $('#s_yp').value.trim(), mpearls: $('#s_mpearls').value.trim(), spearls: $('#s_spearls').value.trim(),
    free: +($('#s_free').dataset.v ?? saved.free), auth: Object.fromEntries(PROVS.map((p) => [p, isOn(f.querySelector(`.sw[data-p=${p}]`))])) });
  const errs = (c) => {
    const e = {};
    for (const k of ['mp', 'yp']) if (!/^\d{1,4}(\.\d{1,2})?$/.test(c[k])) e['s_' + k] = 1;
    for (const k of ['mpearls', 'spearls']) if (!/^\d+$/.test(c[k]) || +c[k] > 100) e['s_' + k] = 1;
    return e;
  };
  const check = () => {
    const c = cur(), e = errs(c);
    for (const id of ['s_mp', 's_yp', 's_mpearls', 's_spearls']) { const bad = !!e[id]; $('#w_' + id).classList.toggle('err', bad); $('#' + id).setAttribute('aria-invalid', String(bad)); $('#' + id + '-e').hidden = !bad; }
    const changed = JSON.stringify(c) !== JSON.stringify(saved);
    const nErr = Object.keys(e).length;
    main.querySelector('[data-a=saveset]').disabled = !changed || nErr > 0;
    main.querySelector('[data-a=revert]').disabled = !changed;
    const last = lastSaved ? T('se.last', { t: `${fdate(lastSaved)} ${ftime(lastSaved)}` }) : '';
    $('#setmsg').textContent = [nErr ? T('se.fix') : '', last].filter(Boolean).join(' · ');
    leave = changed ? () => window.confirm(T('leave')) : null;
  };
  f.addEventListener('input', check);
  main.addEventListener('click', async (e) => {
    const s = e.target.closest('.sw[data-p]');
    if (s) {
      const on = !isOn(s);
      if (!on && PROVS.filter((p) => isOn(f.querySelector(`.sw[data-p=${p}]`))).length <= 1) { $('#prov-e').hidden = false; return; }
      $('#prov-e').hidden = true; flip(s, on); return check();
    }
    const stp = e.target.closest('#s_free [data-step]'); if (stp) { const b = $('#s_free'); setStep(b, cur().free + +stp.dataset.step); return check(); }
    if (e.target.closest('[data-a=revert]')) { main.querySelector('#admbody, .adm-main').innerHTML = await settingsTab(); return bindSettings(); }
    const sv = e.target.closest('[data-a=saveset]');
    if (sv) {
      const c = cur();
      const obj = { plans: { monthly: { price: c.mp, currency: 'USD' }, yearly: { price: c.yp, currency: 'USD', perMonth: (+c.yp / 12).toFixed(2), savePct: Math.max(0, Math.round((1 - +c.yp / (12 * +c.mp)) * 100)) }, monthlyPearls: +c.mpearls },
        startingPearls: +c.spearls, freeChaptersDefault: c.free, auth: Object.fromEntries(PROVS.map((p) => [p, { enabled: c.auth[p] }])) };
      sv.setAttribute('aria-busy', 'true'); sv.textContent = T('saving');
      try { await api.saveSettings(obj); applySettings(Object.entries(obj).map(([key, value]) => ({ key, value }))); saved = c; lastSaved = new Date().toISOString(); toast(T('se.saved')); }
      catch (er) { toast(T('saveErr')); }
      sv.removeAttribute('aria-busy'); sv.textContent = T('se.save'); check();
    }
  });
}

// ------------------------------------------------------------ mount
const PAGES = { overview: [overview, bindOverview], analytics: [overview, bindOverview], users: [users, bindUsers], subs: [subs, bindSubs], stories: [stories, bindStories], categories: [categoriesTab, bindCats], settings: [settingsTab, bindSettings] };

export default function admin(tab) {
  tab = PAGES[tab] ? tab : 'overview';
  const app = $('#app');
  let loaded = false;
  const run = async () => {
    if (loaded) return;
    if (!auth.currentUser()) {
      if (cloud.ready || !auth.isConfigured()) { try { sessionStorage.setItem('ps_auth_return', location.hash); } catch (e) {} location.hash = '#/login'; }
      else app.innerHTML = frame(tab, skeleton(6));
      return;
    }
    if (!cloud.ready) { app.innerHTML = frame(tab, skeleton(6)); return; }
    if (!isAdmin()) {
      if (cloud.profile) { location.hash = '#/'; return; }   // signed in, not an admin
      app.innerHTML = `${adminHeader()}<main id="main" class="wrap adm-denied dash">${errorBox(T('noSchemaTitle'), t('adm.noSchema'))}</main>${footer()}`;
      return;
    }
    loaded = true; leave = null; editing = null;
    app.innerHTML = frame(tab, skeleton(8));
    const [load, bind] = PAGES[tab];
    const paint = async () => {
      try { const html = await load(tab); app.innerHTML = frame(tab, html); bind && bind(tab); }
      catch (e) {
        app.innerHTML = frame(tab, schemaMissing(e) ? errorBox(T('noSchemaTitle'), t('adm.noSchema')) : errorBox(T('loadErr.' + tab), errText(e)));
        $('#main').addEventListener('click', (ev) => { if (ev.target.closest('[data-a=retry]')) paint(); });
      }
    };
    paint();
  };
  run();
  const off = onCloud(run);
  return () => { off(); leave = null; closeSheet(true); };
}
