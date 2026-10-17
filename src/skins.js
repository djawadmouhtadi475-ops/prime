// المرحلة 3: تبويب السكنات — عارض ثلاثي الأبعاد (CSS 3D)، منطقة الرفع، ومكتبة السكنات.
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  let A, lib = [], model = 'classic', pending = null, raf = 0, last = 0;
  const V = { yaw: -28, rot: false, walk: false, phase: 0, drag: false, limbs: [], dataUrl: '' };
  const S = 10;   // بكسلات الشاشة لكل بكسل في الخامة
  const thumbs = {};
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MSG = { png: 'الملف ليس بصيغة PNG', dims: 'الأبعاد غير مدعومة', size: 'الحجم يتجاوز 1 ميغابايت', read: 'تعذّر قراءة الملف' };

  /* ---------- الصور ---------- */
  const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const FACE = (ox, oy, w, h, d) => ({ top: [ox + d, oy, w, d], bottom: [ox + d + w, oy, w, d], right: [ox, oy + d, d, h], front: [ox + d, oy + d, w, h], left: [ox + d + w, oy + d, d, h], back: [ox + d + w + d, oy + d, w, h] });
  const flip = (ctx, img, f, t) => { ctx.save(); ctx.translate(t[0] + t[2], t[1]); ctx.scale(-1, 1); ctx.drawImage(img, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]); ctx.restore(); };
  function mirrorPart(ctx, img, s, t) {
    const a = FACE(s[0], s[1], 4, 12, 4), b = FACE(t[0], t[1], 4, 12, 4), map = { top: 'top', bottom: 'bottom', front: 'front', back: 'back', right: 'left', left: 'right' };
    for (const k in b) flip(ctx, img, a[map[k]], b[k]);
  }
  // يحوّل 64×32 القديمة إلى 64×64 بنسخ الذراع والساق اليسرى معكوستين.
  async function normalize(src) {
    const img = await loadImg(src), c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0);
    if (img.height === 32) { mirrorPart(x, img, [0, 16], [16, 48]); mirrorPart(x, img, [40, 16], [32, 48]); }
    return c;
  }
  async function headUrl(id) {
    const e = lib.find((s) => s.id === id); if (!e) return null;
    const img = await loadImg(e.data), c = document.createElement('canvas'); c.width = c.height = 8;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(img, 8, 8, 8, 8, 0, 0, 8, 8); x.drawImage(img, 40, 8, 8, 8, 0, 0, 8, 8);
    return c.toDataURL();
  }
  // صورة أمامية مصغّرة (16×32) لبطاقة المكتبة
  async function frontThumb(e) {
    if (thumbs[e.id]) return thumbs[e.id];
    const c64 = await normalize(e.data), c = document.createElement('canvas'); c.width = 16; c.height = 32;
    const x = c.getContext('2d'), aw = e.model === 'slim' ? 3 : 4, put = (sx, sy, w, h, dx, dy) => x.drawImage(c64, sx, sy, w, h, dx, dy, w, h);
    put(8, 8, 8, 8, 4, 0); put(40, 8, 8, 8, 4, 0); put(20, 20, 8, 12, 4, 8); put(20, 36, 8, 12, 4, 8);
    put(44, 20, aw, 12, 4 - aw, 8); put(44, 36, aw, 12, 4 - aw, 8); put(36, 52, aw, 12, 12, 8); put(52, 52, aw, 12, 12, 8);
    put(4, 20, 4, 12, 4, 20); put(4, 36, 4, 12, 4, 20); put(20, 52, 4, 12, 8, 20); put(4, 52, 4, 12, 8, 20);
    return (thumbs[e.id] = c.toDataURL());
  }

  /* ---------- العارض ثلاثي الأبعاد ---------- */
  const div = (c) => { const d = document.createElement('div'); d.className = c; return d; };
  function box(w, h, d, uv) {
    const el = div('bx'), F = FACE(uv[0], uv[1], w, h, d);
    el.style.width = w * S + 'px'; el.style.height = h * S + 'px';
    const face = (r, fw, fh, left, top, tf) => {
      const f = div('fc'); f.style.width = fw * S + 'px'; f.style.height = fh * S + 'px'; f.style.left = left * S + 'px'; f.style.top = top * S + 'px';
      f.style.transform = tf; f.style.backgroundSize = 64 * S + 'px ' + 64 * S + 'px'; f.style.backgroundPosition = `${-r[0] * S}px ${-r[1] * S}px`; el.appendChild(f);
    };
    face(F.front, w, h, 0, 0, `translateZ(${d * S / 2}px)`);
    face(F.back, w, h, 0, 0, `rotateY(180deg) translateZ(${d * S / 2}px)`);
    face(F.right, d, h, (w - d) / 2, 0, `rotateY(-90deg) translateZ(${w * S / 2}px)`);
    face(F.left, d, h, (w - d) / 2, 0, `rotateY(90deg) translateZ(${w * S / 2}px)`);
    face(F.top, w, d, 0, (h - d) / 2, `rotateX(90deg) translateZ(${h * S / 2}px)`);
    face(F.bottom, w, d, 0, (h - d) / 2, `rotateX(-90deg) translateZ(${h * S / 2}px)`);
    return el;
  }
  function build() {
    const pl = $('#sk-pl'); pl.innerHTML = ''; V.limbs = [];
    const aw = model === 'slim' ? 3 : 4;
    const parts = [
      { w: 8, h: 8, d: 8, uv: [0, 0], ov: [32, 0], x: 0, y: 8, bottom: true, k: 0, head: true },
      { w: 8, h: 12, d: 4, uv: [16, 16], ov: [16, 32], x: 0, y: 8, k: 0 },
      { w: aw, h: 12, d: 4, uv: [40, 16], ov: [40, 32], x: -(4 + aw / 2), y: 8, k: 1 },
      { w: aw, h: 12, d: 4, uv: [32, 48], ov: [48, 48], x: 4 + aw / 2, y: 8, k: -1 },
      { w: 4, h: 12, d: 4, uv: [0, 16], ov: [0, 32], x: -2, y: 20, k: -1 },
      { w: 4, h: 12, d: 4, uv: [16, 48], ov: [0, 48], x: 2, y: 20, k: 1 }
    ];
    for (const p of parts) {
      const lb = div('lb'); lb.style.left = p.x * S + 'px'; lb.style.top = p.y * S + 'px';
      for (const [uv, over] of [[p.uv, false], [p.ov, true]]) {
        const b = box(p.w, p.h, p.d, uv); b.style.left = -p.w * S / 2 + 'px'; b.style.top = (p.bottom ? -p.h * S : 0) + 'px';
        if (over) b.style.transform = 'scale3d(1.07,1.07,1.07)'; lb.appendChild(b);
      }
      pl.appendChild(lb); V.limbs.push({ el: lb, k: p.k, head: !!p.head });
    }
    pose();
  }
  function pose() {
    $('#sk-pl').style.transform = `rotateX(-12deg) rotateY(${V.yaw}deg)`;
    const amp = V.walk ? 38 : (reduce ? 0 : 3);
    for (const l of V.limbs) {
      const a = l.head ? Math.sin(V.phase * .6) * (V.walk ? 3 : (reduce ? 0 : 2)) : Math.sin(V.phase) * amp * l.k;
      l.el.style.transform = `rotateX(${a}deg)`;
    }
  }
  function tick(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (V.rot && !V.drag) V.yaw += dt * 45;
    V.phase += dt * (V.walk ? 7 : 1.4); pose(); raf = requestAnimationFrame(tick);
  }
  const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  function setMode(rot, walk) {
    V.rot = rot; V.walk = walk;
    $('#sk-rot').setAttribute('aria-pressed', String(rot)); $('#sk-walk').setAttribute('aria-pressed', String(walk));
  }
  async function showSkin(src) {
    const c = await normalize(src); V.dataUrl = c.toDataURL();
    $('#sk-stage').style.setProperty('--skin', `url("${V.dataUrl}")`);
  }
  function setModel(m) {
    model = m; $$('input[name=skmodel]').forEach((r) => { r.checked = r.value === m; }); build();
  }
  function initViewer() {
    build(); showSkin(window.blockSvg ? defaultSkin() : '').catch(() => {});
    $('#sk-rot').addEventListener('click', () => setMode(!V.rot, V.walk));
    $('#sk-walk').addEventListener('click', () => setMode(V.rot, !V.walk));
    $('#sk-stop').addEventListener('click', () => setMode(false, false));
    $$('input[name=skmodel]').forEach((r) => r.addEventListener('change', () => setModel(r.value)));
    const st = $('#sk-stage'); let px = 0;
    st.addEventListener('pointerdown', (e) => { V.drag = true; px = e.clientX; st.setPointerCapture(e.pointerId); });
    st.addEventListener('pointermove', (e) => { if (V.drag) { V.yaw += (e.clientX - px) * .6; px = e.clientX; pose(); } });
    const up = () => { V.drag = false; }; st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
    st.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { V.yaw -= 10; pose(); } if (e.key === 'ArrowRight') { V.yaw += 10; pose(); } });
  }
  // سكن افتراضي بسيط (يُرسم برمجيًا) يظهر قبل اختيار أي سكن
  function defaultSkin() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const fill = (col, a) => { x.fillStyle = col; x.fillRect(...a); };
    fill('#c58c6b', [0, 0, 64, 64]); fill('#3b2a1e', [8, 0, 16, 8]); fill('#3b2a1e', [0, 8, 32, 3]);
    fill('#2f9a4f', [16, 16, 24, 16]); fill('#2f9a4f', [40, 16, 16, 16]); fill('#2f9a4f', [32, 48, 16, 16]);
    fill('#3b4f8c', [0, 16, 16, 16]); fill('#3b4f8c', [16, 48, 16, 16]); fill('#fff', [10, 12, 2, 2]); fill('#fff', [18, 12, 2, 2]);
    fill('#2b4a8c', [11, 12, 1, 2]); fill('#2b4a8c', [19, 12, 1, 2]);
    return c.toDataURL();
  }

  /* ---------- منطقة الرفع ---------- */
  const DROP = {
    idle: () => `${A.ico('upload')}<strong>اسحب ملف السكن هنا أو انقر للاختيار</strong><span>PNG بأبعاد 64×64 أو 64×32</span>`,
    over: () => `${A.ico('upload')}<strong>أفلت الملف هنا</strong>`,
    busy: () => `<span class="spin" aria-hidden="true"></span><strong>جارٍ قراءة الملف...</strong>`,
    ok: (d, n) => `<img class="sk-thumb" src="${d.thumb}" alt="" >${A.ico('check')}<strong>${A.esc(n)}</strong><span>انقر لاختيار ملف آخر</span>`,
    err: (m) => `${A.ico('info')}<strong>${A.esc(m)}</strong><span>انقر للمحاولة مرة أخرى</span>`
  };
  function dropState(st, a, b) { const z = $('#sk-drop'); z.dataset.state = st; z.innerHTML = DROP[st](a, b); }
  async function handleFile(file) {
    if (!file) return;
    dropState('busy');
    try {
      const head = new Uint8Array(await file.slice(0, 24).arrayBuffer());
      const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      if (head.length < 24 || sig.some((v, i) => head[i] !== v)) return dropState('err', MSG.png);
      if (file.size > 1048576) return dropState('err', MSG.size);
      const dv = new DataView(head.buffer), w = dv.getUint32(16), h = dv.getUint32(20);
      if (w !== 64 || (h !== 64 && h !== 32)) return dropState('err', MSG.dims);
      const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
      pending = { data, name: (file.name || 'سكن').replace(/\.png$/i, '').slice(0, 40) };
      const n64 = await normalize(data); await showSkin(data);
      dropState('ok', { thumb: await frontThumb({ id: '_p', data, model }) }, file.name || 'skin.png'); delete thumbs._p;
      $('#sk-name').value = pending.name; $('#sk-form').hidden = false; void n64;
    } catch { dropState('err', MSG.read); }
  }
  function initDrop() {
    const z = $('#sk-drop'), f = $('#sk-file'); dropState('idle');
    z.addEventListener('click', () => f.click());
    z.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f.click(); } });
    f.addEventListener('change', () => { handleFile(f.files[0]); f.value = ''; });
    ['dragenter', 'dragover'].forEach((t) => z.addEventListener(t, (e) => { e.preventDefault(); if (z.dataset.state !== 'over') dropState('over'); }));
    z.addEventListener('dragleave', () => dropState(pending ? 'idle' : 'idle'));
    z.addEventListener('drop', (e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); });
    document.addEventListener('paste', (e) => {
      if (A.state.view !== 'skins') return;
      const it = [...(e.clipboardData?.items || [])].find((i) => i.type === 'image/png'); if (it) { e.preventDefault(); handleFile(it.getAsFile()); }
    });
    $('#sk-save').addEventListener('click', () => save(false));
    $('#sk-save-apply').addEventListener('click', () => save(true));
  }
  async function save(apply) {
    if (!pending) return;
    const r = await window.prime.skins.save({ name: $('#sk-name').value, model, data: pending.data });
    if (r.error) { dropState('err', MSG[r.error] || MSG.read); return; }
    lib.push(r.entry); pending = null; $('#sk-form').hidden = true; dropState('idle');
    A.toast('تم حفظ السكن في المكتبة'); await renderLib();
    if (apply) await applySkin(r.entry.id);
  }

  /* ---------- المكتبة والتطبيق ---------- */
  const activeId = () => window.Accounts?.current()?.skinId || null;
  async function renderLib() {
    const g = $('#sk-grid');
    if (!lib.length) { g.innerHTML = `<div class="empty grid-empty">${A.ico('empty', 'empty-ill')}<h3>المكتبة فارغة</h3><p>ارفع أول سكن لك لتراه هنا.</p></div>`; return; }
    const act = activeId(), thumbsHtml = await Promise.all(lib.map(frontThumb));
    g.innerHTML = lib.map((e, i) => `<article class="sk-card${e.id === act ? ' on' : ''}" data-id="${A.esc(e.id)}">
      <button class="sk-prev" type="button" aria-label="معاينة ${A.esc(e.name)}"><img src="${thumbsHtml[i]}" alt=""></button>
      <div class="sk-meta"><strong>${A.esc(e.name)}</strong><span class="loader-chip ltr">${e.model === 'slim' ? 'Slim' : 'Classic'}</span>${e.id === act ? '<span class="loader-chip mod">مُفعّل</span>' : ''}</div>
      <div class="sk-btns"><button class="btn sm primary" data-act="apply" type="button">تطبيق</button><button class="btn sm" data-act="del" type="button">حذف</button></div></article>`).join('');
  }
  async function applySkin(id) {
    const r = await window.prime.skins.apply(id);
    if (r.error) {
      A.toast({ noaccount: 'سجّل الدخول بحساب أولًا ثم أعد المحاولة', relogin: 'أعد تسجيل الدخول بحساب Microsoft ثم جرّب مجددًا', upload: 'رفضت خدمة ماينكرافت رفع السكن', network: 'تعذّر الاتصال بالإنترنت' }[r.error] || 'تعذّر تطبيق السكن', true); return;
    }
    await window.Accounts.refresh(); await renderLib();
    A.toast(r.type === 'microsoft' ? 'تم رفع السكن إلى حسابك على Microsoft' : `تم تطبيق السكن على ${r.applied} من النسخ`);
    if (r.notes?.length) setTimeout(() => A.toast(r.notes[0] + (r.notes.length > 1 ? ` (+${r.notes.length - 1})` : ''), true), 600);
  }
  function initLib() {
    $('#sk-grid').addEventListener('click', async (e) => {
      const card = e.target.closest('.sk-card'); if (!card) return;
      const s = lib.find((x) => x.id === card.dataset.id); if (!s) return;
      const b = e.target.closest('[data-act]');
      if (!b) { setModel(s.model); showSkin(s.data); return; }
      if (b.dataset.act === 'apply') { setModel(s.model); showSkin(s.data); applySkin(s.id); }
      else if (await window.Installs.confirm({ title: 'حذف السكن', text: `سيتم حذف «${s.name}» من المكتبة.`, ok: 'حذف', danger: true })) {
        await window.prime.skins.remove(s.id); lib = lib.filter((x) => x.id !== s.id); delete thumbs[s.id];
        await window.Accounts.refresh(); await renderLib(); A.toast('تم حذف السكن');
      }
    });
    const t = $('#sk-all');
    window.prime.prefs.get().then((p) => { t.checked = p.skinsForAll; });
    t.addEventListener('change', async () => { await window.prime.prefs.set({ skinsForAll: t.checked }); A.toast(t.checked ? 'تم تفعيل «السكنات للجميع»' : 'تم إيقاف «السكنات للجميع»'); });
  }

  window.Skins = {
    async init(api) {
      A = api; lib = await window.prime.skins.list();
      initViewer(); initDrop(); initLib(); await renderLib();
    },
    onView(name) { if (name === 'skins') { start(); const s = lib.find((x) => x.id === activeId()); if (s && !pending) { setModel(s.model); showSkin(s.data); } renderLib(); } else stop(); },
    onAccount() { if (A) renderLib(); },
    headUrl, dataFor: (id) => lib.find((s) => s.id === id)?.data || null
  };
})();
