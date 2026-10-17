// Prime Launcher — الواجهة (الرندر). لا يصل إلى المفاتيح؛ يستقبل قيمًا منطقية فقط.
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ico = (n, c = '') => `<svg class="ico ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const M = window.MOCK;
const state = { view: 'play', installs: [], selected: null, filter: 'all', newsItems: [], launching: false, keys: { microsoft: false, curseforge: false } };

/* ---------- إشعارات ---------- */
function toast(msg, err = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' bad' : '');
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3200);
}

/* ---------- رأس الشخصية (بكسلات) ---------- */
function headSvg(seed = 'Steve') {
  let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const skin = ['#c58c6b', '#e0ac85', '#a56f4f'][h % 3], hair = ['#3b2a1e', '#1f1f1f', '#6b4423'][(h >> 3) % 3];
  const eye = '#2b4a8c', rows = [
    [hair, hair, hair, hair, hair, hair, hair, hair], [hair, hair, hair, hair, hair, hair, hair, hair],
    [hair, skin, skin, skin, skin, skin, skin, hair], [skin, skin, skin, skin, skin, skin, skin, skin],
    [skin, '#fff', eye, skin, skin, eye, '#fff', skin], [skin, skin, skin, '#8a5a40', '#8a5a40', skin, skin, skin],
    [skin, skin, '#8a3b3b', '#8a3b3b', '#8a3b3b', '#8a3b3b', skin, skin], [skin, skin, skin, skin, skin, skin, skin, skin]
  ];
  let r = '';
  rows.forEach((row, y) => row.forEach((c, x) => { r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${c}"/>`; }));
  return `<svg class="head" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
}

/* ---------- التنقل بين العروض ---------- */
const tabOf = (v) => (v === 'new' ? 'installs' : v);
function moveIndicator() {
  const tab = $(`.tab[data-view="${tabOf(state.view)}"]`), ind = $('#tab-ind');
  if (!tab) { ind.style.opacity = '0'; return; }
  ind.style.opacity = '1';
  ind.style.width = tab.offsetWidth + 'px';
  ind.style.transform = `translateX(${tab.offsetLeft}px)`;   // إحداثيات فيزيائية (الشريط يبدأ من اليسار)
}
function setView(name, platform, force) {
  if (!force && state.view === 'new' && name !== 'new' && window.Installs.isDirty()) { window.Installs.confirmLeave(() => setView(name, platform, true)); return; }
  state.view = name;
  $$('.view').forEach((v) => { v.hidden = v.id !== 'view-' + name; v.classList.remove('enter'); });
  const v = $('#view-' + name); void v.offsetWidth; v.classList.add('enter');
  $$('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.view === tabOf(name))));
  $$('.sb-btn[data-platform]').forEach((b) => b.classList.toggle('active', b.dataset.platform === platform));
  moveIndicator();
  if (name === 'mods') window.Mods.open(platform);
  window.Installs?.onView(name); window.Skins?.onView(name);
  closePicker();
}
/* ---------- شرائح الخلفية ---------- */
function initSlides() {
  const box = $('#slides'), dots = $('#dots'); let i = 0, timer;
  M.art.forEach((a, n) => {
    const s = document.createElement('div'); s.className = 'slide';
    s.style.backgroundImage = `url("assets/art/${a.file}.svg"), linear-gradient(135deg,#1b2a49,#2f6b3a)`;
    box.appendChild(s);
    const d = document.createElement('button'); d.className = 'dot'; d.setAttribute('aria-label', a.caption);
    d.addEventListener('click', () => { show(n); restart(); }); dots.appendChild(d);
  });
  function show(n) {
    i = n;
    $$('.slide').forEach((s, k) => { s.classList.remove('on'); if (k === n) { void s.offsetWidth; s.classList.add('on'); } });
    $$('.dot').forEach((d, k) => d.classList.toggle('on', k === n));
    $('#caption').textContent = M.art[n].caption;
  }
  const restart = () => { clearInterval(timer); timer = setInterval(() => !document.hidden && show((i + 1) % M.art.length), 8000); };
  show(0); restart();
}

/* ---------- زر العب + قائمة النسخ ---------- */
const sel = () => state.installs.find((x) => x.id === state.selected);
function updateSub() {
  const s = sel();
  $('#play-sub').innerHTML = s ? `${esc(s.name)} · <span dir="ltr">${esc(s.loader)} ${esc(s.version)}</span>` : 'لا توجد نسخة محددة';
  $('#btn-play').disabled = !s;
}
let activeIdx = 0, shown = [];
function renderList() {
  const q = $('#pick-q').value.trim().toLowerCase();
  shown = state.installs.filter((x) => (x.name + ' ' + x.version).toLowerCase().includes(q));
  const ul = $('#pick-list');
  if (!shown.length) { ul.innerHTML = '<li class="pick-none" role="presentation">لا توجد نتائج مطابقة</li>'; $('#pick-q').removeAttribute('aria-activedescendant'); return; }
  activeIdx = Math.max(0, Math.min(activeIdx, shown.length - 1));
  ul.innerHTML = shown.map((x, k) => `<li class="pick-item${k === activeIdx ? ' act' : ''}" id="pk-${x.id}" role="option" data-id="${x.id}" aria-selected="${x.id === state.selected}">
    <span class="pi-ic">${window.blockSvg(x.icon)}</span><span class="pi-tx"><span class="pi-nm">${esc(x.name)}</span><span class="pi-v">${esc(x.loader)} ${esc(x.version)}</span></span>${ico('check', 'ck')}</li>`).join('');
  $('#pick-q').setAttribute('aria-activedescendant', 'pk-' + shown[activeIdx].id);
}
function openPicker() {
  $('#pick-panel').hidden = false; $('#btn-pick').setAttribute('aria-expanded', 'true');
  $('#pick-q').value = ''; activeIdx = Math.max(0, state.installs.findIndex((x) => x.id === state.selected)); renderList(); $('#pick-q').focus();
}
function closePicker(focus) {
  if ($('#pick-panel').hidden) return;
  $('#pick-panel').hidden = true; $('#btn-pick').setAttribute('aria-expanded', 'false'); if (focus) $('#btn-pick').focus();
}
function choose(id) { state.selected = id; localStorage.setItem('prime.selected', id); updateSub(); closePicker(true); }
function initPlay() {
  updateSub();
  $('#btn-pick').addEventListener('click', () => ($('#pick-panel').hidden ? openPicker() : closePicker()));
  $('#pick-q').addEventListener('input', () => { activeIdx = 0; renderList(); });
  $('#pick-q').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, shown.length - 1); renderList(); $('#pk-' + shown[activeIdx]?.id)?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); renderList(); $('#pk-' + shown[activeIdx]?.id)?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[activeIdx]) choose(shown[activeIdx].id); }
    else if (e.key === 'Escape') { e.preventDefault(); closePicker(true); }
  });
  $('#pick-list').addEventListener('click', (e) => { const li = e.target.closest('.pick-item'); if (li) choose(li.dataset.id); });
  $('#pick-new').addEventListener('click', () => { closePicker(); window.Installs.openNew(); });
  $('#pick-panel').addEventListener('keydown', (e) => { if (e.key === 'Escape') closePicker(true); });
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('#play-dock')) closePicker(); });
  $('#btn-play').addEventListener('click', launch);
}
// التشغيل الفعلي: العملية الرئيسية تنزّل الملفات وتتحقق منها ثم تشغّل جافا، وتبث التقدّم عبر الأحداث.
function setLaunchUi(pct, text) {
  const b = $('#btn-play'); b.classList.add('launching'); b.setAttribute('aria-busy', 'true');
  b.style.setProperty('--p', pct + '%'); $('#play-lbl').textContent = text;
}
function endLaunch() {
  state.launching = false; const b = $('#btn-play'); b.classList.remove('launching'); b.removeAttribute('aria-busy');
  b.style.setProperty('--p', '0%'); $('#play-lbl').textContent = 'العب';
}
function launch() {
  if (state.launching || !sel()) return;
  state.launching = true; window.Installs.touch(state.selected); setLaunchUi(0, 'جارٍ التشغيل...');
  window.prime.launch.start(state.selected).then((r) => { if (r?.error) { endLaunch(); toast(r.error, true); } });
}
function initLaunchEvents() {
  window.prime.launch.on((ch, p) => {
    if (ch === 'progress') setLaunchUi(p.pct, p.pct < 8 ? 'جارٍ التشغيل...' : `جارٍ التحميل ${p.pct}%`);
    else if (ch === 'started') { toast('تم تشغيل ماينكرافت'); setTimeout(endLaunch, 1200); }
    else if (ch === 'error') { endLaunch(); toast(p.message, true); }
    else if (ch === 'exit') { if (state.launching) endLaunch(); if (p.code) toast(`أُغلقت اللعبة بشكل غير متوقع (الرمز ${p.code}). راجع ملف السجل في مجلد logs داخل دليل اللعبة`, true); }
  });
}

function playInstall(id) { state.selected = id; localStorage.setItem('prime.selected', id); updateSub(); setView('play'); launch(); }
function refreshPicker() { updateSub(); if (!$('#pick-panel').hidden) renderList(); }

/* ---------- الأخبار والسيرفرات ---------- */
const pingCls = (ms) => (ms < 80 ? '' : ms < 140 ? 'mid' : 'bad');
const pingBars = (ms) => { const n = ms < 60 ? 4 : ms < 100 ? 3 : ms < 160 ? 2 : 1; return `<span class="ping ${pingCls(ms)}" title="${ms} ms">${[1, 2, 3, 4].map((k) => `<i class="${k <= n ? 'on' : ''}"></i>`).join('')}</span>`; };
function newsCard(n) {
  const url = /^https:\/\//i.test(n.url || '') ? n.url : 'https://www.minecraft.net/en-us/articles';
  return `<article class="card news-card" role="link" tabindex="0" data-news-url="${esc(url)}"><div class="cover" data-art="${esc(n.art || 'dawn')}"><span class="tag">${esc(n.tag || 'Minecraft')}</span></div><div class="card-body"><h3 class="card-title">${esc(n.title)}</h3><div class="card-date">${esc(n.date || '')}</div><p class="card-sum">${esc(n.summary || '')}</p><span class="news-read">قراءة الخبر الرسمي ↗</span></div></article>`;
}
function serverCard(s) {
  return `<article class="card"><div class="banner" data-c1="${s.color[0]}" data-c2="${s.color[1]}">${esc(s.name)}</div><div class="card-body">
    <div class="ip-row"><code>${esc(s.ip)}</code><button class="icon-btn" data-copy="${esc(s.ip)}" aria-label="نسخ العنوان">${ico('copy')}</button></div>
    <div class="status"><span class="dot-s"></span><span>${s.online ? 'متصل' : 'غير متصل'}</span><span class="pl">${s.players}/${s.max}</span>${pingBars(s.ping)}</div>
    <button class="btn primary sm" data-join="${esc(s.name)}">انضمام</button></div></article>`;
}
function renderFeed(loading) {
  const g = $('#feed-grid');
  if (loading) { g.innerHTML = '<div class="skel"></div>'.repeat(4); return; }
  const items = state.newsItems || [];
  g.innerHTML = items.length ? items.map(newsCard).join('') : `<div class="empty grid-empty">${ico('news', 'empty-ill')}<h3>تعذّر تحميل الأخبار</h3><p>لم نعرض أخبارًا تجريبية. تحقق من اتصال الإنترنت ثم أعد تشغيل اللانشر.</p><button class="btn secondary sm" id="news-retry">إعادة المحاولة</button></div>`;
  $$('.cover', g).forEach((c) => { c.style.backgroundImage = `linear-gradient(to top,rgba(0,0,0,.35),transparent),url("assets/art/${c.dataset.art}.svg")`; });
  $$('.card', g).forEach((c, k) => { c.style.animationDelay = k * 40 + 'ms'; });
}
async function loadRealNews() {
  renderFeed(true);
  try { const result = await window.prime.news.get(); state.newsItems = Array.isArray(result?.list) ? result.list : []; }
  catch (_) { state.newsItems = []; }
  renderFeed(false);
}
function initFeed() {
  state.newsItems = []; loadRealNews();
  $('#feed-chips').addEventListener('click', (e) => {
    const c = e.target.closest('.chip'); if (!c) return;
    $$('.chip').forEach((x) => x.classList.toggle('on', x === c)); state.filter = c.dataset.f; loadRealNews();
  });
  $('#feed-grid').addEventListener('click', async (e) => {
    if (e.target.closest('#news-retry')) { loadRealNews(); return; }
    const article = e.target.closest('[data-news-url]'); if (article) { window.prime.openExternal(article.dataset.newsUrl); return; }
    const cp = e.target.closest('[data-copy]'), jn = e.target.closest('[data-join]');
    if (cp) {
      try { await navigator.clipboard.writeText(cp.dataset.copy); } catch { /* تجاهل */ }
      cp.innerHTML = ico('check'); setTimeout(() => { cp.innerHTML = ico('copy'); }, 1400); toast('تم نسخ عنوان السيرفر');
    }
    if (jn) toast(`اختر نسخة ثم اضغط «العب» للانضمام إلى ${jn.dataset.join}`);
  });
}

/* ---------- الإعدادات ومفاتيح الخدمات ---------- */
async function refreshKeys() {
  state.keys = await window.prime.keys.status();
  for (const [id, ok] of [['st-ms', state.keys.microsoft], ['st-cf', state.keys.curseforge]]) {
    const p = $('#' + id); p.textContent = ok ? 'مضبوط' : 'غير مضبوط'; p.classList.toggle('ok', ok);
  }
  $('#h-ms').textContent = state.keys.microsoft ? '' : 'أضف معرّف تطبيق Azure لتفعيل تسجيل الدخول عبر Microsoft';
  $('#h-cf').textContent = state.keys.curseforge ? '' : 'أضف مفتاح CurseForge لتفعيل التصفح';
  for (const id of ['h-ms', 'h-cf']) $('#' + id).className = 'hint';
}
const TEST_MSG = { ok: ['المفتاح صالح ويعمل بنجاح', true], invalid: ['المفتاح غير صالح، تحقق منه وحاول مجددًا', false], missing: ['لم يتم إدخال مفتاح للاختبار', false], network: ['تعذّر الاتصال بالإنترنت، حاول لاحقًا', false] };
function initSettings() {
  const dlg = $('#dlg-settings'), about = $('#dlg-about');
  $('#sb-settings').addEventListener('click', () => { refreshKeys(); dlg.showModal(); });
  $('#mods-keys').addEventListener('click', () => { refreshKeys(); dlg.showModal(); });
  $('#open-about').addEventListener('click', () => { dlg.close(); about.showModal(); });
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  $$('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
  $$('[data-eye]').forEach((b) => b.addEventListener('click', () => {
    const inp = $('#' + b.dataset.eye), show = inp.type === 'password';
    inp.type = show ? 'text' : 'password'; b.innerHTML = ico(show ? 'eye-off' : 'eye');
  }));
  $$('[data-ext]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); window.prime.openExternal(a.dataset.ext); }));
  $('#keys-save').addEventListener('click', async () => {
    state.keys = await window.prime.keys.save({ MICROSOFT_CLIENT_ID: $('#k-ms').value, CURSEFORGE_API_KEY: $('#k-cf').value });
    $('#k-ms').value = ''; $('#k-cf').value = ''; await refreshKeys(); toast('تم حفظ مفاتيح الخدمات');
  });
  $$('[data-test]').forEach((b) => b.addEventListener('click', async () => {
    const which = b.dataset.test, hint = $(which === 'microsoft' ? '#h-ms' : '#h-cf'), inp = $(which === 'microsoft' ? '#k-ms' : '#k-cf');
    b.disabled = true; hint.className = 'hint'; hint.textContent = 'جارٍ الاختبار...';
    const r = await window.prime.keys.test(which, inp.value); const [msg, ok] = TEST_MSG[r.code] || TEST_MSG.network;
    hint.textContent = msg; hint.className = 'hint ' + (ok ? 'ok' : 'err'); b.disabled = false;
  }));
  $('#check-upd').addEventListener('click', () => toast('أنت تستخدم أحدث إصدار متاح'));
}

/* ---------- التشغيل ---------- */
async function boot() {
  const info = await window.prime.info();
  $('#sb-version').textContent = 'v' + info.version; $('#ab-ver').textContent = 'الإصدار ' + info.version;
  $$('.tab').forEach((t) => t.addEventListener('click', () => setView(t.dataset.view)));
  document.addEventListener('click', (e) => { const t=e.target.closest('.tab'); if(t) { $$('.side-link[data-prime-view]').forEach((b)=>b.classList.toggle('active', b.dataset.primeView===t.dataset.view && !b.dataset.primeNews)); } });
  $('#sb-home').addEventListener('click', () => setView('play'));
  $$('.side-link[data-prime-view]').forEach((b) => b.addEventListener('click', () => {
    const view = b.dataset.primeView;
    if (b.dataset.primeNews) { setView('play'); $('#feed-grid').scrollIntoView({behavior:'smooth', block:'start'}); }
    else setView(view, b.dataset.primePlatform);
    $$('.side-link[data-prime-view]').forEach((x) => x.classList.toggle('active', x === b));
  }));
  $('#sb-home').addEventListener('click', () => { setView('play'); $$('.side-link[data-prime-view]').forEach((x) => x.classList.toggle('active', x.dataset.primeView === 'play' && !x.dataset.primeNews && x.textContent.includes('الرئيسية'))); });
  $$('.sb-btn[data-platform]').forEach((b) => b.addEventListener('click', () => setView('mods', b.dataset.platform)));
  $('#win-min').addEventListener('click', () => window.prime.win.minimize());
  $('#win-max').addEventListener('click', () => window.prime.win.maximize());
  $('#win-close').addEventListener('click', () => window.prime.win.close());
  window.prime.win.onState((mx) => { $('#win-max').innerHTML = ico(mx ? 'restore' : 'maximize'); setTimeout(moveIndicator, 50); });
  window.addEventListener('resize', moveIndicator);
  await window.Installs.init({ state, toast, setView, ico, esc, $, $$, mock: M, info, playInstall, refreshPicker });
  const api = { state, toast, setView, ico, esc, $, $$, mock: M, info, playInstall, refreshPicker, headSvg };
  window.Mods.init(api); initLaunchEvents();
  await window.Skins.init(api); await window.Accounts.init(api);
  initSlides(); initPlay(); initFeed(); initSettings(); await refreshKeys();
  setView('play'); document.fonts?.ready.then(moveIndicator);
}
boot();
