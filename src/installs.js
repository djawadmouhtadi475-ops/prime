// المرحلة 2: قائمة الإصدارات (التثبيتات) وشاشة إنشاء/تعديل النسخة.
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const DEFAULT_JVM = '-Xmx2G -XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M';
  let A, list = [], listFilter = 'all', sortBy = 'recent';
  let editing = null, snap = '', dirAuto = true, touched = new Set(), javaInfo;
  const VS = { all: [], loaded: false, sel: '', snaps: false, act: 0, flat: [] };

  /* ---------- أدوات ---------- */
  const vtype = (v) => (/^\d+\.\d+(\.\d+)?$/.test(v) ? 'release' : /^(a|b)\d|^rd-|^c\d|^inf-/.test(v) ? 'old' : 'snapshot');
  const newId = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const sep = () => (A.info.platform === 'win32' ? '\\' : '/');
  const safeName = (n) => (n.replace(/[\\/:*?"<>|]/g, '_').replace(/[. ]+$/, '').trim() || 'نسخة جديدة');
  const defaultDir = (name) => [A.info.userData, 'instances', safeName(name)].join(sep());
  function rel(ts) {
    if (!ts) return 'لم تُشغَّل بعد';
    const d = Math.floor((Date.now() - ts) / 864e5);
    return d <= 0 ? 'اليوم' : d === 1 ? 'أمس' : d < 7 ? `قبل ${d} أيام` : d < 30 ? `قبل ${Math.floor(d / 7)} أسابيع` : 'قبل أكثر من شهر';
  }
  async function persist() {
    list = await window.prime.installs.set(list);
    A.state.installs = list; A.refreshPicker();
  }

  /* ---------- نافذة التأكيد ---------- */
  function confirmBox({ title, text, ok = 'تأكيد', danger = false }) {
    const d = $('#dlg-confirm');
    $('#cf-title').textContent = title; $('#cf-text').textContent = text;
    const y = $('#cf-yes'); y.textContent = ok; y.className = 'btn ' + (danger ? 'danger' : 'primary');
    d.returnValue = '';
    return new Promise((res) => { d.addEventListener('close', () => res(d.returnValue === 'yes'), { once: true }); d.showModal(); $('#cf-no').focus(); });
  }

  /* ---------- قائمة الإصدارات ---------- */
  function seed() {
    // لا تنشئ نسخًا وهمية؛ تظهر النسخ فقط بعد أن ينشئها المستخدم فعليًا.
    return [];
  }
  async function load() {
    let l = await window.prime.installs.get();
    if (!Array.isArray(l)) { l = seed(); }
    list = await window.prime.installs.set(l);
    A.state.installs = list;
    const saved = localStorage.getItem('prime.selected');
    A.state.selected = list.find((x) => x.id === saved)?.id || list[0]?.id || null;
  }
  function visible() {
    const q = $('#inst-q').value.trim().toLowerCase();
    let r = list.filter((x) => {
      const t = vtype(x.version);
      if (listFilter === 'stable') return x.loader === 'Vanilla' && t === 'release';
      if (listFilter === 'snap') return t === 'snapshot';
      if (listFilter === 'mod') return x.loader !== 'Vanilla';
      return true;
    }).filter((x) => !q || (x.name + ' ' + x.version + ' ' + x.loader).toLowerCase().includes(q));
    if (sortBy === 'name') r.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    else if (sortBy === 'version') r.sort((a, b) => b.version.localeCompare(a.version, 'en', { numeric: true }));
    else r.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
    return r;
  }
  function render() {
    const box = $('#inst-list'), rows = visible();
    if (!rows.length) {
      box.innerHTML = `<div class="empty">${A.ico('empty', 'empty-ill')}<h3>${list.length ? 'لا توجد نتائج' : 'لا توجد نسخ بعد'}</h3><p>${list.length ? 'جرّب تغيير التصفية أو عبارة البحث.' : 'أنشئ نسختك الأولى للبدء باللعب.'}</p></div>`;
      return;
    }
    box.innerHTML = rows.map((x) => `<article class="inst" data-id="${A.esc(x.id)}">
      <span class="inst-ic">${window.blockSvg(x.icon)}</span>
      <div class="inst-main"><h3>${A.esc(x.name)}</h3><div class="inst-meta"><span class="ltr">${A.esc(x.version)}</span><i class="sepdot"></i><span>${rel(x.lastPlayed)}</span></div></div>
      <span class="loader-chip ${x.loader === 'Vanilla' ? '' : 'mod'} ltr">${A.esc(x.loader)}</span>
      <button class="btn primary sm" data-play type="button">العب</button>
      <button class="icon-btn" data-more type="button" aria-haspopup="menu" aria-label="المزيد من الخيارات">${A.ico('more')}</button>
    </article>`).join('');
    $$('.inst', box).forEach((c, k) => { c.style.animationDelay = k * 40 + 'ms'; });
  }

  /* القائمة المنسدلة للصف */
  let menuBtn = null, menuId = null;
  function closeMenu(focus) { const m = $('#row-menu'); if (m.hidden) return; m.hidden = true; if (focus && menuBtn) menuBtn.focus(); }
  function openMenu(btn, id) {
    const m = $('#row-menu'); menuBtn = btn; menuId = id;
    m.innerHTML = [['edit', 'edit', 'تعديل'], ['dup', 'duplicate', 'تكرار'], ['folder', 'folder', 'فتح المجلد'], ['del', 'trash', 'حذف']]
      .map(([a, i, t]) => `<button type="button" role="menuitem" data-a="${a}" class="${a === 'del' ? 'danger' : ''}">${A.ico(i, 'sm')}${t}</button>`).join('');
    m.hidden = false;
    const r = btn.getBoundingClientRect(), h = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8)) + 'px';
    m.style.top = (r.bottom + h + 8 > innerHeight ? r.top - h - 4 : r.bottom + 4) + 'px';
    m.querySelector('button').focus();
  }
  async function menuAction(a) {
    const x = list.find((i) => i.id === menuId); closeMenu(false); if (!x) return;
    if (a === 'edit') openEditor(x.id);
    else if (a === 'dup') {
      const name = x.name + ' (نسخة)';
      list.push({ ...x, id: newId(), name, gameDir: defaultDir(name), lastPlayed: null, created: Date.now() });
      await persist(); render(); A.toast('تم تكرار النسخة بإعداداتها');
    } else if (a === 'folder') {
      const ok = await window.prime.installs.openFolder(x.id); if (!ok) A.toast('تعذّر فتح المجلد', true);
    } else if (a === 'del') {
      const ok = await confirmBox({ title: 'حذف النسخة', text: `سيتم حذف النسخة «${x.name}» من القائمة، ولن تُحذف ملفات اللعبة من جهازك.`, ok: 'حذف', danger: true });
      if (!ok) return;
      list = list.filter((i) => i.id !== x.id);
      if (A.state.selected === x.id) A.state.selected = list[0]?.id || null;
      await persist(); render(); A.toast('تم حذف النسخة');
    }
  }
  function initList() {
    $('#cf-no').addEventListener('click', () => $('#dlg-confirm').close('no'));
    $('#cf-yes').addEventListener('click', () => $('#dlg-confirm').close('yes'));
    $('#inst-new').addEventListener('click', openNew);
    $('#inst-chips').addEventListener('click', (e) => {
      const c = e.target.closest('.chip'); if (!c) return;
      $$('#inst-chips .chip').forEach((x) => x.classList.toggle('on', x === c)); listFilter = c.dataset.f; render();
    });
    $('#inst-q').addEventListener('input', render);
    $('#inst-sort').addEventListener('change', (e) => { sortBy = e.target.value; render(); });
    $('#inst-list').addEventListener('click', (e) => {
      const row = e.target.closest('.inst'); if (!row) return;
      if (e.target.closest('[data-play]')) A.playInstall(row.dataset.id);
      else if (e.target.closest('[data-more]')) openMenu(e.target.closest('[data-more]'), row.dataset.id);
    });
    const m = $('#row-menu');
    m.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (b) menuAction(b.dataset.a); });
    m.addEventListener('keydown', (e) => {
      const items = $$('button', m), i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); }
      else if (e.key === 'Tab') closeMenu(false);
    });
    document.addEventListener('mousedown', (e) => { if (!e.target.closest('#row-menu') && !e.target.closest('[data-more]')) closeMenu(false); });
    $('#view-installs').addEventListener('scroll', () => closeMenu(false));
  }

  /* ---------- اختيار الأيقونة ---------- */
  function setIcon(id) {
    $('#ni-icon').dataset.icon = id; $('#ni-icon').innerHTML = window.blockSvg(id);
    $$('#ni-icons button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
  }
  function initIcons() {
    $('#ni-icons').innerHTML = window.BLOCKS.map((b) => `<button type="button" data-id="${b.id}" title="${b.name}" aria-label="${b.name}" aria-pressed="false">${window.blockSvg(b.id)}</button>`).join('');
    const btn = $('#ni-icon'), grid = $('#ni-icons');
    const close = (f) => { grid.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (f) btn.focus(); };
    btn.addEventListener('click', () => { const o = grid.hidden; grid.hidden = !o; btn.setAttribute('aria-expanded', String(o)); if (o) $('#ni-icons button[aria-pressed=true]')?.focus(); });
    grid.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { setIcon(b.dataset.id); close(true); } });
    grid.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(true); } });
    document.addEventListener('mousedown', (e) => { if (!e.target.closest('.icon-field')) close(false); });
  }

  /* ---------- قائمة الإصدارات المنسدلة (بحث + مجموعات) ---------- */
  const grp = (v) => (v.type === 'release' ? 'stable' : v.type === 'snapshot' ? 'snap' : 'old');
  async function loadVersions() {
    if (VS.loaded) return;
    const r = await window.prime.versions.get(); VS.all = r.list; VS.loaded = true;
    if (r.source !== 'online') A.toast(r.source === 'cache' ? 'تم استخدام قائمة الإصدارات المحفوظة' : 'تعذّر الاتصال؛ تم استخدام قائمة إصدارات مبسّطة', true);
  }
  const latestRelease = () => VS.all.find((v) => v.type === 'release')?.id || '';
  function setVersion(id) {
    VS.sel = id; const b = $('#vs-btn');
    b.innerHTML = id ? `<span class="ltr">${A.esc(id)}</span><span class="badge">${{ release: 'مستقرة', snapshot: 'لقطة', old: 'قديمة' }[vtype(id)]}</span>` : '<span class="muted">اختر إصدارًا</span>';
    b.insertAdjacentHTML('beforeend', A.ico('chevron-down'));
    refresh('version');
  }
  function vsRender() {
    const q = $('#vs-q').value.trim().toLowerCase(), ul = $('#vs-list'); VS.flat = []; let html = '';
    for (const [g, title] of [['stable', 'إصدارات مستقرة'], ['snap', 'لقطات'], ['old', 'قديمة']]) {
      if (g === 'snap' && !VS.snaps) continue;
      const all = VS.all.filter((v) => grp(v) === g && v.id.toLowerCase().includes(q)); if (!all.length) continue;
      const items = all.slice(0, q ? 200 : g === 'stable' ? 400 : 150);
      html += `<li class="vs-group" role="presentation">${title}</li>`;
      for (const v of items) { const k = VS.flat.push(v) - 1; html += `<li class="vs-opt${k === VS.act ? ' act' : ''}" id="vs-${k}" role="option" data-i="${k}" aria-selected="${v.id === VS.sel}"><span class="ltr">${A.esc(v.id)}</span>${v.id === VS.sel ? A.ico('check', 'sm') : ''}</li>`; }
      if (all.length > items.length) html += '<li class="vs-more" role="presentation">ابحث لعرض المزيد</li>';
    }
    ul.innerHTML = html || '<li class="pick-none" role="presentation">لا توجد نتائج مطابقة</li>';
    VS.act = Math.max(0, Math.min(VS.act, VS.flat.length - 1));
    if (VS.flat.length) $('#vs-q').setAttribute('aria-activedescendant', 'vs-' + VS.act);
    $('#vs-' + VS.act)?.scrollIntoView({ block: 'nearest' });
  }
  function vsClose(f) { $('#vs-panel').hidden = true; $('#vs-btn').setAttribute('aria-expanded', 'false'); if (f) $('#vs-btn').focus(); }
  async function vsOpen() {
    await loadVersions();
    $('#vs-panel').hidden = false; $('#vs-btn').setAttribute('aria-expanded', 'true'); $('#vs-q').value = '';
    vsRender(); VS.act = Math.max(0, VS.flat.findIndex((v) => v.id === VS.sel)); vsRender(); $('#vs-q').focus();
  }
  function initVersion() {
    $('#vs-btn').addEventListener('click', () => ($('#vs-panel').hidden ? vsOpen() : vsClose()));
    $('#vs-q').addEventListener('input', () => { VS.act = 0; vsRender(); });
    $('#vs-q').addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); VS.act = Math.min(VS.act + 1, VS.flat.length - 1); vsRender(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); VS.act = Math.max(VS.act - 1, 0); vsRender(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (VS.flat[VS.act]) { setVersion(VS.flat[VS.act].id); vsClose(true); } }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); vsClose(true); }
    });
    $('#vs-list').addEventListener('click', (e) => { const o = e.target.closest('.vs-opt'); if (o) { setVersion(VS.flat[+o.dataset.i].id); vsClose(true); } });
    $('#ni-snaps').addEventListener('change', (e) => { VS.snaps = e.target.checked; if (!$('#vs-panel').hidden) vsRender(); });
    document.addEventListener('mousedown', (e) => { if (!e.target.closest('.vs-wrap')) vsClose(false); });
  }

  /* ---------- الذاكرة العشوائية ↔ وسائط JVM ---------- */
  const fmtMem = (mb) => (mb % 1024 === 0 ? mb / 1024 + 'G' : mb + 'M');
  const ramLabel = (mb) => (mb / 1024) + ' GB';
  function applyRam(mb) {
    const j = $('#ni-jvm'); let a = j.value;
    a = /-Xmx\S+/.test(a) ? a.replace(/-Xmx\S+/, '-Xmx' + fmtMem(mb)) : ('-Xmx' + fmtMem(mb) + ' ' + a).trim();
    if (/-Xms\S+/.test(a)) a = a.replace(/-Xms\S+/, '-Xms' + fmtMem(Math.min(mb, 1024)));
    j.value = a; $('#ni-ram-out').textContent = ramLabel(mb);
  }
  function parseXmx(a) {
    const m = a.match(/-Xmx(\d+)([GgMm])/); if (!m) return null;
    const mb = /g/i.test(m[2]) ? +m[1] * 1024 : +m[1]; return Math.round(mb / 512) * 512;
  }

  /* ---------- النموذج ---------- */
  const val = (id) => $('#' + id).value;
  function vals() {
    return {
      name: val('ni-name').trim(), icon: $('#ni-icon').dataset.icon, version: VS.sel, loader: ($('input[name=loader]:checked') || {}).value || 'Vanilla',
      gameDir: val('ni-dir').trim(), width: val('ni-w').trim(), height: val('ni-h').trim(), fullscreen: $('#ni-fs').checked,
      java: val('ni-java').trim(), jvm: val('ni-jvm'), ram: +val('ni-ram')
    };
  }
  function errors(v) {
    const e = {};
    if (!v.name) e.name = 'الاسم مطلوب';
    else if (v.name.length > 64) e.name = 'الاسم طويل جدًا (الحد الأقصى 64 حرفًا)';
    else if (list.some((x) => x.id !== editing?.id && x.name.toLowerCase() === v.name.toLowerCase())) e.name = 'توجد نسخة بهذا الاسم بالفعل';
    if (!v.version) e.version = 'اختر إصدارًا للّعبة';
    if (!v.gameDir) e.dir = 'مسار دليل اللعبة مطلوب';
    else if (!/^([a-zA-Z]:[\\/]|\/)/.test(v.gameDir)) e.dir = 'أدخل مسارًا كاملًا صحيحًا';
    if (!v.fullscreen && (v.width || v.height)) {
      const w = +v.width, h = +v.height;
      if (!v.width || !v.height) e.res = 'أدخل العرض والارتفاع معًا';
      else if (!Number.isInteger(w) || !Number.isInteger(h) || w < 320 || h < 240 || w > 7680 || h > 4320) e.res = 'الدقة يجب أن تكون بين 320×240 و7680×4320';
    }
    return e;
  }
  function refresh(field) {
    if (field) touched.add(field);
    const v = vals(), e = errors(v);
    for (const [k, id] of [['name', 'e-name'], ['version', 'e-version'], ['dir', 'e-dir'], ['res', 'e-res']]) {
      const msg = touched.has(k) ? e[k] || '' : ''; $('#' + id).textContent = msg;
    }
    $('#ni-name').setAttribute('aria-invalid', String(touched.has('name') && !!e.name));
    $('#ni-create').disabled = !!(e.name || e.version) || Object.keys(e).length > 0;
  }
  const dirty = () => JSON.stringify(vals()) !== snap;

  function fill(v) {
    $('#ni-name').value = v.name; setIcon(v.icon);
    $$('input[name=loader]').forEach((r) => { r.checked = r.value === v.loader; });
    $('#ni-dir').value = v.gameDir; $('#ni-w').value = v.width || ''; $('#ni-h').value = v.height || '';
    $('#ni-fs').checked = !!v.fullscreen; $('#ni-w').disabled = $('#ni-h').disabled = !!v.fullscreen;
    $('#ni-java').value = v.java || ''; $('#ni-jvm').value = v.jvm; $('#ni-ram').value = v.ram; $('#ni-ram-out').textContent = ramLabel(v.ram);
    setVersion(v.version);
  }
  async function show(title, btnText, v) {
    await loadVersions();
    if (!v.version) v.version = latestRelease();
    VS.snaps = vtype(v.version) !== 'release'; $('#ni-snaps').checked = VS.snaps;
    touched = new Set(); $('#ni-title').textContent = title; $('#ni-create').textContent = btnText;
    fill(v); refresh(); snap = JSON.stringify(vals());
    A.setView('new'); $('#ni-name').focus();
    if (javaInfo === undefined) {
      javaInfo = await window.prime.java.detect();
    }
    $('#ni-java-hint').innerHTML = javaInfo ? `تم اكتشاف جافا: <span class="ltr">${A.esc(javaInfo.path)} (${A.esc(javaInfo.version)})</span>` : 'لم يتم العثور على جافا تلقائيًا — حدّد الملف التنفيذي يدويًا.';
  }
  function openNew() {
    editing = null; dirAuto = true;
    show('إنشاء نسخة جديدة', 'إنشاء', { name: '', icon: 'grass', version: '', loader: 'Vanilla', gameDir: defaultDir('نسخة جديدة'), width: '', height: '', fullscreen: false, java: '', jvm: DEFAULT_JVM, ram: 2048 });
  }
  function openEditor(id) {
    const x = list.find((i) => i.id === id); if (!x) return;
    editing = x; dirAuto = false;
    show('تعديل النسخة', 'حفظ', { ...x, width: x.width || '', height: x.height || '', java: x.java || '' });
  }
  async function submit(e) {
    e.preventDefault();
    ['name', 'version', 'dir', 'res'].forEach((k) => touched.add(k)); refresh();
    const v = vals(); if (Object.keys(errors(v)).length) { $('#ni-form [aria-invalid=true], #ni-form .err:not(:empty)')?.scrollIntoView({ block: 'center' }); return; }
    const rec = {
      id: editing?.id || newId(), name: v.name, icon: v.icon, version: v.version, loader: v.loader, gameDir: v.gameDir,
      width: v.fullscreen || !v.width ? null : +v.width, height: v.fullscreen || !v.height ? null : +v.height, fullscreen: v.fullscreen,
      java: v.java, jvm: v.jvm, ram: v.ram, lastPlayed: editing?.lastPlayed || null, created: editing?.created || Date.now()
    };
    if (editing) list = list.map((x) => (x.id === rec.id ? rec : x)); else list.push(rec);
    snap = JSON.stringify(v);
    await persist();
    if (!editing) { A.state.selected = rec.id; localStorage.setItem('prime.selected', rec.id); A.refreshPicker(); }
    A.toast(editing ? 'تم حفظ التعديلات' : 'تم إنشاء النسخة بنجاح');
    A.setView('installs', undefined, true);
  }
  function initForm() {
    initIcons(); initVersion();
    const f = $('#ni-form'); f.addEventListener('submit', submit);
    $('#ni-name').addEventListener('input', () => { if (dirAuto) $('#ni-dir').value = defaultDir($('#ni-name').value.trim() || 'نسخة جديدة'); refresh('name'); });
    $('#ni-name').addEventListener('blur', () => refresh('name'));
    $('#ni-dir').addEventListener('input', () => { dirAuto = false; refresh('dir'); });
    $('#ni-dir-br').addEventListener('click', async () => { const p = await window.prime.dialog.folder(); if (p) { dirAuto = false; $('#ni-dir').value = p; refresh('dir'); } });
    $('#ni-java-br').addEventListener('click', async () => { const p = await window.prime.dialog.file(['exe', 'bin']); if (p) { $('#ni-java').value = p; refresh(); } });
    $('#ni-java-auto').addEventListener('click', () => { $('#ni-java').value = ''; refresh(); });
    for (const id of ['ni-w', 'ni-h']) $('#' + id).addEventListener('input', () => refresh('res'));
    $('#ni-fs').addEventListener('change', (e) => { $('#ni-w').disabled = $('#ni-h').disabled = e.target.checked; refresh('res'); });
    $$('input[name=loader]').forEach((r) => r.addEventListener('change', () => refresh()));
    $('#ni-ram').addEventListener('input', (e) => { applyRam(+e.target.value); refresh(); });
    $('#ni-jvm').addEventListener('input', (e) => {
      const mb = parseXmx(e.target.value);
      if (mb && mb >= 1024 && mb <= 16384) { $('#ni-ram').value = mb; $('#ni-ram-out').textContent = ramLabel(mb); }
      refresh();
    });
    $('#ni-jvm-reset').addEventListener('click', () => { $('#ni-jvm').value = DEFAULT_JVM; $('#ni-ram').value = 2048; $('#ni-ram-out').textContent = ramLabel(2048); refresh(); });
    $('#ni-cancel').addEventListener('click', () => A.setView('installs'));
  }

  /* ---------- الواجهة العامة ---------- */
  window.Installs = {
    async init(api) { A = api; await load(); initList(); initForm(); render(); },
    onView(name) { if (name === 'installs') render(); },
    isDirty: () => A.state.view === 'new' && dirty(),
    confirmLeave: (go) => confirmBox({ title: 'تغييرات غير محفوظة', text: 'لديك تغييرات لم تُحفظ بعد. هل تريد المغادرة وتجاهلها؟', ok: 'مغادرة', danger: true }).then((ok) => ok && go()),
    async touch(id) { const x = list.find((i) => i.id === id); if (x) { x.lastPlayed = Date.now(); await persist(); } },
    confirm: confirmBox,
    openNew
  };
})();
