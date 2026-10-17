// المرحلة 4: متصفح المودات (Modrinth / CurseForge). كل الطلبات تمر عبر العملية الرئيسية.
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  let A, platform = 'modrinth', type = 'mod', items = [], offset = 0, total = 0, token = 0, timer = 0, versionsLoaded = false;
  const nf = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
  const CATS = [['', 'الكل'], ['adventure', 'مغامرة'], ['decoration', 'ديكور'], ['equipment', 'معدات'], ['food', 'طعام'], ['game-mechanics', 'ميكانيكيات اللعب'], ['library', 'مكتبات'], ['magic', 'سحر'], ['management', 'إدارة'], ['mobs', 'مخلوقات'], ['optimization', 'تحسين الأداء'], ['storage', 'تخزين'], ['technology', 'تقنية'], ['transportation', 'مواصلات'], ['utility', 'أدوات مساعدة'], ['worldgen', 'توليد العالم']];
  const ERR = { network: 'تعذّر الاتصال بالإنترنت، حاول مجددًا', rate: 'عدد الطلبات كبير، انتظر قليلًا ثم أعد المحاولة', invalid: 'مفتاح CurseForge غير صالح، تحقق منه من الإعدادات' };

  const target = () => A.state.installs.find((i) => i.id === $('#mods-inst').value) || null;
  function fillInstalls() {
    const sel = $('#mods-inst'), keep = sel.value;
    sel.innerHTML = A.state.installs.map((i) => `<option value="${A.esc(i.id)}">${A.esc(i.name)} — ${A.esc(i.loader)} ${A.esc(i.version)}</option>`).join('') || '<option value="">لا توجد نسخ</option>';
    sel.value = A.state.installs.some((i) => i.id === keep) ? keep : (A.state.selected || A.state.installs[0]?.id || '');
  }
  async function fillVersions() {
    if (versionsLoaded) return;
    const r = await window.prime.versions.get(); versionsLoaded = true;
    const rel = r.list.filter((v) => v.type === 'release').slice(0, 60).map((v) => v.id);
    $('#mods-ver').innerHTML = '<option value="">كل الإصدارات</option>' + rel.map((v) => `<option value="${v}">${v}</option>`).join('');
  }
  // يضبط عوامل التصفية حسب النسخة المختارة (المحمّل + الإصدار)
  function syncFromInstall() {
    const t = target(); if (!t) return;
    const ld = t.loader.toLowerCase(); $('#mods-loader').value = ld === 'vanilla' ? '' : ld;
    const ver = $('#mods-ver'); if (![...ver.options].some((o) => o.value === t.version)) ver.add(new Option(t.version, t.version)); ver.value = t.version;
  }
  function syncUi() {
    $('#mods-title').textContent = platform === 'curseforge' ? 'مودات CurseForge' : 'مودات Modrinth';
    $$('#mods-tabs [role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.t === type)));
    const catOk = platform === 'modrinth' && type === 'mod'; $('#mods-cat').disabled = !catOk; if (!catOk) $('#mods-cat').value = '';
    $('#mods-loader').disabled = type === 'resourcepack';
  }

  async function run(more) {
    const my = ++token; if (!more) { offset = 0; items = []; $('#mods-grid').innerHTML = '<div class="skel"></div>'.repeat(6); }
    $('#mods-notice').hidden = true; $('#mods-more').hidden = true;
    const r = await window.prime.mods.search(platform, { q: $('#mods-q').value.trim(), type, loader: $('#mods-loader').value, version: $('#mods-ver').value, category: $('#mods-cat').value, offset });
    if (my !== token) return;
    if (r.error) {
      items = []; $('#mods-grid').innerHTML = '';
      $('#mods-notice').hidden = false; $('#mods-keys').hidden = r.error !== 'nokey' && r.error !== 'invalid';
      $('#mods-note').textContent = r.error === 'nokey' ? 'أضف مفتاح CurseForge لتفعيل التصفح' : ERR[r.error] || ERR.network; return;
    }
    items = items.concat(r.items); total = r.total; offset = items.length; render();
  }
  function icon(it) { return it.icon ? `<img class="mod-ic" src="${A.esc(it.icon)}" alt="" loading="lazy">` : `<span class="mod-ic">${window.blockSvg('grass')}</span>`; }
  function render() {
    const g = $('#mods-grid');
    if (!items.length) { g.innerHTML = `<div class="empty grid-empty">${A.ico('empty', 'empty-ill')}<h3>لا توجد نتائج</h3><p>جرّب كلمة بحث أخرى أو غيّر عوامل التصفية.</p></div>`; return; }
    g.innerHTML = items.map((it, i) => `<article class="card mod"><div class="mod-top">${icon(it)}<div class="mod-nm"><h3>${A.esc(it.name)}</h3><span class="muted">بواسطة <bdi>${A.esc(it.author)}</bdi></span></div></div>
      <p class="card-sum clamp2">${A.esc(it.desc || '')}</p>
      <div class="mod-foot"><span class="dl" title="عدد التنزيلات">${A.ico('download', 'sm')}<bdi class="ltr">${nf.format(it.downloads || 0)}</bdi></span><button class="btn primary sm inst-btn" data-i="${i}" type="button">تثبيت</button></div></article>`).join('');
    $$('.card', g).forEach((c, k) => { c.style.animationDelay = (k % 20) * 40 + 'ms'; });
    $('#mods-more').hidden = items.length >= total;
  }
  async function installItem(btn) {
    const it = items[+btn.dataset.i], t = target();
    if (!t) { A.toast('أنشئ نسخة أولًا لتثبيت المحتوى فيها', true); return; }
    if (it.type === 'mod' && t.loader === 'Vanilla') { A.toast('هذه النسخة Vanilla؛ اختر نسخة Fabric أو Forge لتثبيت المودات', true); return; }
    btn.disabled = true; btn.classList.add('busy'); btn.textContent = 'جارٍ التثبيت...';
    const r = await window.prime.mods.install({ platform: it.platform, id: it.id, type: it.type, instanceId: t.id });
    btn.classList.remove('busy');
    if (r.error) { btn.disabled = false; btn.textContent = 'تثبيت'; A.toast(r.error, true); return; }
    btn.innerHTML = `${A.ico('check', 'sm')}تم التثبيت`; A.toast(`تم تثبيت «${it.name}» في ${t.name}` + (r.files.length > 1 ? ` (+${r.files.length - 1} تبعيات)` : ''));
    setTimeout(() => { btn.disabled = false; btn.textContent = 'تثبيت'; }, 3000);
  }

  window.Mods = {
    init(api) {
      A = api;
      $('#mods-tabs').addEventListener('click', (e) => { const b = e.target.closest('[role=tab]'); if (!b) return; type = b.dataset.t; syncUi(); run(); });
      $('#mods-q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => run(), 350); });
      for (const id of ['mods-loader', 'mods-ver', 'mods-cat']) $('#' + id).addEventListener('change', () => run());
      $('#mods-inst').addEventListener('change', () => { syncFromInstall(); run(); });
      $('#mods-more').addEventListener('click', () => run(true));
      $('#mods-grid').addEventListener('click', (e) => { const b = e.target.closest('.inst-btn'); if (b) installItem(b); });
      $('#mods-grid').addEventListener('error', (e) => {   // أيقونة بعيدة تعذّر تحميلها
        if (e.target.matches?.('img.mod-ic')) { const s = document.createElement('span'); s.className = 'mod-ic'; s.innerHTML = window.blockSvg('grass'); e.target.replaceWith(s); }
      }, true);
      $('#mods-cat').innerHTML = CATS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    },
    async open(p) {
      platform = p === 'curseforge' ? 'curseforge' : 'modrinth'; fillInstalls(); await fillVersions(); syncFromInstall(); syncUi(); run();
    }
  };
})();
