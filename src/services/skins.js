// مكتبة السكنات وتطبيقها: CustomSkinLoader للنسخ المعدّلة، وحزمة PrimeSkin لـ Vanilla، ورفع السكن لحسابات Microsoft.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');
const store = require('../config/store');
const accounts = require('./accounts');
const { UA } = require('../config/keys');

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const dir = () => path.join(app.getPath('userData'), 'skins');
const idxFile = () => path.join(dir(), 'skins.json');
const readIdx = () => { try { return JSON.parse(fs.readFileSync(idxFile(), 'utf8')); } catch { return []; } };
const writeIdx = (l) => { fs.mkdirSync(dir(), { recursive: true }); fs.writeFileSync(idxFile(), JSON.stringify(l, null, 1)); };
const ID_RE = /^s[a-z0-9]{4,24}$/;

function checkPng(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 24 || !buf.subarray(0, 8).equals(SIG)) return 'png';
  if (buf.length > 1048576) return 'size';
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  return w === 64 && (h === 64 || h === 32) ? null : 'dims';
}
const fromDataUrl = (d) => { const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(d || '')); return m ? Buffer.from(m[1], 'base64') : null; };
const readSkin = (id) => { try { return fs.readFileSync(path.join(dir(), id + '.png')); } catch { return null; } };

function list() {
  return readIdx().map((e) => { const b = readSkin(e.id); return b ? { ...e, data: 'data:image/png;base64,' + b.toString('base64') } : null; }).filter(Boolean);
}
function save({ name, model, data }) {
  const buf = fromDataUrl(data); const err = buf ? checkPng(buf) : 'png';
  if (err) return { error: err };
  const id = 's' + Date.now().toString(36) + crypto.randomBytes(2).toString('hex');
  fs.mkdirSync(dir(), { recursive: true }); fs.writeFileSync(path.join(dir(), id + '.png'), buf);
  const e = { id, name: String(name || '').trim().slice(0, 40) || 'سكن جديد', model: model === 'slim' ? 'slim' : 'classic', created: Date.now() };
  const l = readIdx(); l.push(e); writeIdx(l);
  return { entry: { ...e, data } };
}
function remove(id) {
  if (!ID_RE.test(id)) return false;
  try { fs.unlinkSync(path.join(dir(), id + '.png')); } catch { /* غير موجود */ }
  writeIdx(readIdx().filter((e) => e.id !== id)); accounts.clearSkin(id); return true;
}

/* ---------- جدول pack_format حسب إصدار اللعبة ---------- */
const FORMATS = [[1, 6, 1, 1], [1, 9, 0, 2], [1, 11, 0, 3], [1, 13, 0, 4], [1, 15, 0, 5], [1, 16, 2, 6], [1, 17, 0, 7], [1, 18, 0, 8], [1, 19, 0, 9], [1, 19, 3, 12], [1, 19, 4, 13], [1, 20, 0, 15], [1, 20, 2, 18], [1, 20, 3, 22], [1, 20, 5, 32], [1, 21, 0, 34], [1, 21, 2, 42], [1, 21, 4, 46], [1, 21, 5, 55], [1, 21, 6, 63], [1, 21, 7, 64]];
function parseVer(v) { const m = /^(\d+)\.(\d+)(?:\.(\d+))?/.exec(v); return m ? [+m[1], +m[2], +(m[3] || 0)] : null; }
const cmp = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
function packFormat(version) {
  const v = parseVer(version); if (!v) return FORMATS[FORMATS.length - 1][3];   // لقطات: أحدث تنسيق معروف
  let f = 1; for (const [a, b, c, n] of FORMATS) if (cmp(v, [a, b, c]) >= 0) f = n; return f;
}
const isModern = (version) => { const v = parseVer(version); return !v || cmp(v, [1, 19, 3]) >= 0; };
const NAMES = ['alex', 'ari', 'efe', 'kai', 'makena', 'noor', 'steve', 'sunny', 'zuri'];

/* ---------- Vanilla: حزمة PrimeSkin ---------- */
function applyVanilla(inst, buf) {
  const pack = path.join(inst.gameDir, 'resourcepacks', 'PrimeSkin');
  const tex = path.join(pack, 'assets', 'minecraft', 'textures', 'entity');
  fs.mkdirSync(tex, { recursive: true });
  if (isModern(inst.version)) {
    for (const kind of ['wide', 'slim']) {
      fs.mkdirSync(path.join(tex, 'player', kind), { recursive: true });
      for (const n of NAMES) fs.writeFileSync(path.join(tex, 'player', kind, n + '.png'), buf);
    }
  } else { fs.writeFileSync(path.join(tex, 'steve.png'), buf); fs.writeFileSync(path.join(tex, 'alex.png'), buf); }
  fs.writeFileSync(path.join(pack, 'pack.mcmeta'), JSON.stringify({ pack: { pack_format: packFormat(inst.version), description: 'Prime Skin' } }, null, 2));
  // تفعيل الحزمة في options.txt (الحزمة الأخيرة في القائمة لها الأولوية)
  const entry = (parseVer(inst.version) && cmp(parseVer(inst.version), [1, 13, 0]) < 0) ? 'PrimeSkin' : 'file/PrimeSkin';
  const opt = path.join(inst.gameDir, 'options.txt');
  let text = ''; try { text = fs.readFileSync(opt, 'utf8'); } catch { /* جديد */ }
  const lines = text ? text.split(/\r?\n/) : []; let found = false;
  const out = lines.map((l) => {
    if (!l.startsWith('resourcePacks:')) return l; found = true;
    let arr = []; try { arr = JSON.parse(l.slice('resourcePacks:'.length)); } catch { arr = []; }
    if (!arr.includes(entry)) arr.push(entry); return 'resourcePacks:' + JSON.stringify(arr);
  });
  if (!found) out.push('resourcePacks:' + JSON.stringify(entry === 'PrimeSkin' ? [entry] : ['vanilla', entry]));
  fs.writeFileSync(opt, out.filter((l, i, a) => l !== '' || i < a.length - 1).join('\n') + '\n');
  return 'pack';
}

/* ---------- المعدّلة: CustomSkinLoader ---------- */
async function ensureCSL(inst) {
  const mods = path.join(inst.gameDir, 'mods'); fs.mkdirSync(mods, { recursive: true });
  if (fs.readdirSync(mods).some((f) => /customskinloader/i.test(f) && f.endsWith('.jar'))) return 'present';
  const q = `loaders=${encodeURIComponent(JSON.stringify([inst.loader.toLowerCase()]))}&game_versions=${encodeURIComponent(JSON.stringify([inst.version]))}`;
  const r = await fetch(`https://api.modrinth.com/v2/project/customskinloader/version?${q}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000) });
  if (!r.ok) return 'failed';
  const vers = await r.json(); if (!vers.length) return 'unsupported';
  const f = vers[0].files.find((x) => x.primary) || vers[0].files[0];
  const u = new URL(f.url); if (u.protocol !== 'https:' || u.hostname !== 'cdn.modrinth.com') return 'failed';
  const d = await fetch(f.url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
  if (!d.ok) return 'failed';
  const jar = Buffer.from(await d.arrayBuffer());
  if (f.hashes?.sha512 && crypto.createHash('sha512').update(jar).digest('hex') !== f.hashes.sha512) return 'failed';   // تحقق من السلامة
  fs.writeFileSync(path.join(mods, path.basename(f.filename)), jar);
  return 'installed';
}
async function applyModded(inst, username, buf) {
  const status = await ensureCSL(inst).catch(() => 'failed');
  const d = path.join(inst.gameDir, 'CustomSkinLoader', 'LocalSkin', 'skins'); fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, username + '.png'), buf);
  return status;
}

/* ---------- تطبيق السكن على كل النسخ (للحساب غير المتصل) ---------- */
async function applyToInstalls(account, skinId) {
  const buf = skinId ? readSkin(skinId) : null; if (!buf) return { applied: 0, notes: [] };
  const res = { applied: 0, notes: [] };
  for (const inst of store.get('installations', []) || []) {
    if (!path.isAbsolute(inst.gameDir)) continue;
    try {
      fs.mkdirSync(inst.gameDir, { recursive: true });
      const st = inst.loader === 'Vanilla' ? applyVanilla(inst, buf) : await applyModded(inst, account.name, buf);
      res.applied++;
      if (st === 'failed') res.notes.push(`${inst.name}: تعذّر تثبيت CustomSkinLoader تلقائيًا`);
      else if (st === 'unsupported') res.notes.push(`${inst.name}: لا يوجد CustomSkinLoader لهذا الإصدار`);
    } catch { res.notes.push(`${inst.name}: تعذّر كتابة ملفات السكن`); }
  }
  return res;
}

async function uploadMicrosoft(account, skin) {
  const token = accounts.token(account.id); if (!token) return { error: 'relogin' };
  const fd = new FormData(); fd.append('variant', skin.model === 'slim' ? 'slim' : 'classic');
  fd.append('file', new Blob([readSkin(skin.id)], { type: 'image/png' }), 'skin.png');
  try {
    const r = await fetch('https://api.minecraftservices.com/minecraft/profile/skins', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'User-Agent': UA }, body: fd, signal: AbortSignal.timeout(20000) });
    return r.ok ? { uploaded: true } : { error: 'upload' };
  } catch { return { error: 'network' }; }
}

// تطبيق سكن (أو إزالته إذا skinId = null) على الحساب النشط.
async function apply(skinId) {
  const acc = accounts.getActive(); if (!acc) return { error: 'noaccount' };
  if (skinId !== null && !ID_RE.test(skinId)) return { error: 'invalid' };
  const skin = skinId ? readIdx().find((e) => e.id === skinId) : null;
  if (skinId && !skin) return { error: 'invalid' };
  accounts.setSkin(acc.id, skinId);
  if (!skin) return { ok: true, type: acc.type, applied: 0, notes: [] };
  if (acc.type === 'microsoft') { const r = await uploadMicrosoft(acc, skin); return r.error ? { error: r.error } : { ok: true, type: 'microsoft', applied: 0, notes: [] }; }
  return { ok: true, type: 'offline', ...(await applyToInstalls(acc, skinId)) };
}
// يُستدعى عند تبديل الحساب أو قبل التشغيل
async function reapplyActive() {
  const acc = accounts.getActive();
  if (acc && acc.type === 'offline' && acc.skinId) return applyToInstalls(acc, acc.skinId);
  return null;
}

module.exports = { list, save, remove, apply, reapplyActive, packFormat, isModern, checkPng };
