// تنزيل آمن: قائمة مضيفين مسموحة، تحقق من التجزئة، كتابة ذرّية، وتنفيذ متوازٍ.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');
const { UA } = require('../config/keys');

const HOSTS = ['mojang.com', 'minecraft.net', 'minecraftservices.com', 'fabricmc.net', 'modrinth.com', 'forgecdn.net', 'curseforge.com', 'githubusercontent.com', 'github.com', 'neoforged.net', 'minecraftforge.net', 'maven.org'];
function allowed(url) {
  try { const u = new URL(url); return u.protocol === 'https:' && HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h)); } catch { return false; }
}
const E = (msg) => Object.assign(new Error(msg), { user: true });

async function jget(url, headers = {}) {
  if (!allowed(url)) throw E('عنوان غير مسموح');
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) { const e = new Error('http ' + r.status); e.status = r.status; throw e; }
  return r.json();
}

// يعيد true إذا نُزِّل ملف جديد، وfalse إذا كان الملف موجودًا وسليمًا (بحسب الحجم).
async function download(url, dest, { algo = 'sha1', hash, size } = {}) {
  if (!allowed(url)) throw E('رابط تنزيل غير مسموح');
  if (fs.existsSync(dest) && (!size || fs.statSync(dest).size === size)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = dest + '.part', h = crypto.createHash(algo);
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(180000) });
  if (!r.ok) throw new Error('http ' + r.status);
  await pipeline(Readable.fromWeb(r.body), async function* (src) { for await (const c of src) { h.update(c); yield c; } }, fs.createWriteStream(tmp));
  if (hash && h.digest('hex') !== hash.toLowerCase()) { fs.unlinkSync(tmp); throw E('فشل التحقق من سلامة الملف'); }
  fs.renameSync(tmp, dest); return true;
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}
// يمنع الخروج من مجلد الأساس (zip-slip / مسارات ..)
function safeJoin(base, rel) {
  const p = path.resolve(base, rel);
  if (p !== path.resolve(base) && !p.startsWith(path.resolve(base) + path.sep)) throw E('مسار ملف غير آمن');
  return p;
}
module.exports = { allowed, jget, download, pool, safeJoin, E };
