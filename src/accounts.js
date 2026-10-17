// المرحلة 3: لوحة الحسابات (Microsoft + أوفلاين) وشريط الحساب العلوي.
(() => {
  'use strict';
  let A, S = { accounts: [], active: null }, tab = 'ms', headCache = {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const cur = () => S.accounts.find((a) => a.id === S.active) || null;
  const TYPE = { offline: 'أوفلاين', microsoft: 'Microsoft' };

  // رأس اللاعب: من السكن المطبَّق إن وُجد، وإلا رأس افتراضي بكسلي.
  async function headHtml(a) {
    if (a?.skinId && window.Skins) {
      if (!(a.skinId in headCache)) headCache[a.skinId] = await window.Skins.headUrl(a.skinId);
      if (headCache[a.skinId]) return `<img class="head" src="${headCache[a.skinId]}" alt="">`;
    }
    return A.headSvg(a?.name || 'Steve');
  }
  async function updateChrome() {
    const a = cur(), h = await headHtml(a);
    $('#sb-account').innerHTML = h;
    $('#acct-chip').innerHTML = a
      ? `${h}<span class="nm">${A.esc(a.name)}</span><span class="tp">${TYPE[a.type]}</span>`
      : `${A.headSvg('Steve')}<span class="nm">تسجيل الدخول</span>`;
  }

  /* ---------- القائمة ---------- */
  async function renderList() {
    const ul = $('#acc-list');
    if (!S.accounts.length) { ul.innerHTML = '<li class="pick-none">لا توجد حسابات محفوظة بعد</li>'; return; }
    const rows = await Promise.all(S.accounts.map(async (a) => {
      const on = a.id === S.active;
      return `<li class="acc-row${on ? ' on' : ''}" data-id="${A.esc(a.id)}">
        <span class="acc-head">${await headHtml(a)}</span>
        <div class="acc-info"><strong class="ltr">${A.esc(a.name)}</strong><span class="acc-sub"><span class="loader-chip">${TYPE[a.type]}</span>${a.type === 'offline' ? `<code class="ltr">${A.esc(a.uuid)}</code>` : ''}</span></div>
        ${on ? '<span class="loader-chip mod">نشِط</span>' : '<button class="btn sm" data-act="use" type="button">تفعيل</button>'}
        <button class="icon-btn" data-act="del" type="button" aria-label="إزالة الحساب">${A.ico('trash')}</button></li>`;
    }));
    ul.innerHTML = rows.join('');
  }
  async function setState(s) { S = s; await Promise.all([renderList(), updateChrome()]); window.Skins?.onAccount(); }

  /* ---------- أوفلاين ---------- */
  function validate(n) {
    if (!n) return '';
    if (n.length < 3) return 'الاسم يجب ألا يقل عن 3 أحرف';
    if (n.length > 16) return 'الاسم يجب ألا يزيد عن 16 حرفًا';
    if (!/^[A-Za-z0-9_]+$/.test(n)) return 'يُسمح بالأحرف الإنجليزية والأرقام والشرطة السفلية (_) فقط';
    return '';
  }
  async function loginOffline() {
    const n = $('#acc-name').value.trim(), err = validate(n);
    if (!n || err) { $('#acc-err').textContent = err || 'أدخل اسم المستخدم'; $('#acc-name').focus(); return; }
    const r = await window.prime.accounts.addOffline(n);
    if (r.error) { $('#acc-err').textContent = 'اسم المستخدم غير صالح'; return; }
    $('#acc-name').value = ''; await setState(r); A.toast(`مرحبًا ${n}`);
    $('#dlg-acc').close();
  }

  /* ---------- Microsoft ---------- */
  function msView(v, msg) {
    for (const id of ['nokey', 'idle', 'wait']) $('#ms-' + id).hidden = id !== v;
    $('#ms-err').textContent = msg || '';
  }
  async function msIdle() { const k = await window.prime.keys.status(); msView(k.microsoft ? 'idle' : 'nokey'); }
  async function msLogin() {
    $('#ms-login').disabled = true;
    const r = await window.prime.ms.start(); $('#ms-login').disabled = false;
    if (r.error === 'nokey') return msView('nokey');
    if (r.error) return msView('idle', r.error === 'network' ? 'تعذّر الاتصال بالإنترنت' : 'معرّف تطبيق Azure غير صالح أو لا يدعم تسجيل الدخول بالرمز');
    $('#ms-code').textContent = r.userCode; $('#ms-uri').textContent = r.verificationUri; $('#ms-open').dataset.uri = r.verificationUri;
    msView('wait'); window.prime.openExternal(r.verificationUri);
  }

  function tabTo(t) {
    tab = t;
    for (const k of ['ms', 'off']) { $('#atab-' + k).setAttribute('aria-selected', String(k === t)); $('#ap-' + k).hidden = k !== t; }
    if (t === 'ms') msIdle(); else $('#acc-name').focus();
  }
  async function open(t) {
    await renderList(); $('#dlg-acc').showModal(); tabTo(t || (S.accounts.length ? tab : 'off'));
  }

  window.Accounts = {
    async init(api) {
      A = api;
      $('#sb-account').addEventListener('click', () => open());
      $('#acct-chip').addEventListener('click', () => open());
      $('#acct-chip').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      $$('.dtabs [role=tab]').forEach((b) => b.addEventListener('click', () => tabTo(b.dataset.t)));
      $('#acc-name').addEventListener('input', (e) => { $('#acc-err').textContent = validate(e.target.value.trim()); });
      $('#acc-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); loginOffline(); } });
      $('#acc-login').addEventListener('click', loginOffline);
      $('#ms-login').addEventListener('click', msLogin);
      $('#ms-open').addEventListener('click', () => window.prime.openExternal($('#ms-open').dataset.uri));
      $('#ms-cancel').addEventListener('click', async () => { await window.prime.ms.cancel(); msIdle(); });
      $('#ms-keys').addEventListener('click', () => { $('#dlg-acc').close(); $('#sb-settings').click(); });
      window.prime.ms.onDone(async (p) => {
        if (p.ok) { await setState({ accounts: p.accounts, active: p.active }); A.toast('تم تسجيل الدخول عبر Microsoft'); $('#dlg-acc').close(); }
        else msView('idle', p.error);
      });
      $('#acc-list').addEventListener('click', async (e) => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        const id = b.closest('.acc-row').dataset.id, a = S.accounts.find((x) => x.id === id);
        if (b.dataset.act === 'use') { await setState(await window.prime.accounts.setActive(id)); A.toast(`تم التبديل إلى ${a.name}`); }
        else if (await window.Installs.confirm({ title: 'إزالة الحساب', text: `سيتم إزالة «${a.name}» من هذا الجهاز.`, ok: 'إزالة', danger: true })) await setState(await window.prime.accounts.remove(id));
      });
      S = await window.prime.accounts.list(); await Promise.all([renderList(), updateChrome()]);
      if (!S.accounts.length) open('off');
    },
    current: cur,
    refresh: async () => setState(await window.prime.accounts.list()),
    open
  };
})();
