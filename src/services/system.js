// خدمات النظام للعملية الرئيسية: قائمة إصدارات ماينكرافت، اكتشاف جافا، وتنقية بيانات النسخ.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const store = require('../config/store');
const { UA } = require('../config/keys');

const MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const LOADERS = ['Vanilla', 'Fabric', 'Forge', 'NeoForge'];

/* ---------- الإصدارات: الشبكة ← الذاكرة المؤقتة ← القائمة المضمّنة ---------- */
async function getVersions() {
  try {
    const r = await fetch(MANIFEST, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('http');
    const j = await r.json();
    const list = j.versions.map((v) => ({ id: v.id, type: v.type, time: v.releaseTime }));
    store.set('versionsCache', { at: Date.now(), list });
    return { list, source: 'online' };
  } catch {
    const c = store.get('versionsCache', null);
    if (c && Array.isArray(c.list) && c.list.length) return { list: c.list, source: 'cache' };
    return { list: require('../data/versions-fallback.json'), source: 'bundled' };
  }
}

/* ---------- اكتشاف جافا ---------- */
const exe = process.platform === 'win32' ? 'java.exe' : 'java';
function javaVersion(bin) {
  return new Promise((resolve) => {
    execFile(bin, ['-version'], { timeout: 5000, windowsHide: true }, (_err, so, se) => {
      const m = String(se || so || '').match(/version "([^"]+)"/);
      resolve(m ? m[1] : null);
    });
  });
}
const major = (v) => { const p = String(v).split(/[._-]/); return +(p[0] === '1' ? p[1] : p[0]) || 0; };

async function detectAllJava() {
  const cands = [];
  if (process.env.JAVA_HOME) cands.push(path.join(process.env.JAVA_HOME, 'bin', exe));
  if (process.platform === 'win32') {
    const pf = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean);
    for (const base of pf) for (const vendor of ['Java', 'Eclipse Adoptium', 'Microsoft', 'Zulu', 'Amazon Corretto', 'BellSoft', 'Semeru']) {
      const dir = path.join(base, vendor);
      try { for (const d of fs.readdirSync(dir)) cands.push(path.join(dir, d, 'bin', exe)); } catch { /* غير موجود */ }
    }
  } else {
    for (const dir of ['/usr/lib/jvm', '/Library/Java/JavaVirtualMachines']) {
      try { for (const d of fs.readdirSync(dir)) cands.push(path.join(dir, d, 'bin', exe), path.join(dir, d, 'Contents', 'Home', 'bin', exe)); } catch { /* غير موجود */ }
    }
  }
  cands.push('java');
  const found = [];
  for (const c of cands) {
    if (c !== 'java' && !fs.existsSync(c)) continue;
    const v = await javaVersion(c);
    if (v) found.push({ path: c, version: v, major: major(v) });
  }
  return found;
}
async function detectJava() {
  const f = await detectAllJava(); if (!f.length) return null;
  f.sort((a, b) => b.major - a.major); return f[0];   // الأحدث أولًا
}
// أصغر إصدار جافا يحقق الحد الأدنى المطلوب (الأنسب للإصدارات القديمة)
async function findJava(required) {
  const f = (await detectAllJava()).filter((x) => x.major >= required).sort((a, b) => a.major - b.major);
  return f[0] || null;
}

/* ---------- تنقية النسخ قبل الحفظ ---------- */
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const posInt = (v) => (Number.isFinite(+v) && +v > 0 ? Math.round(+v) : null);
function sanitizeInstalls(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 500).map((x) => ({
    id: str(x?.id, 64), name: str(x?.name, 64), icon: str(x?.icon, 24), version: str(x?.version, 40),
    loader: LOADERS.includes(x?.loader) ? x.loader : 'Vanilla',
    gameDir: str(x?.gameDir, 500), width: posInt(x?.width), height: posInt(x?.height), fullscreen: !!x?.fullscreen,
    java: str(x?.java, 500), jvm: str(x?.jvm, 2000), ram: posInt(x?.ram) || 2048,
    lastPlayed: posInt(x?.lastPlayed), created: posInt(x?.created) || Date.now()
  })).filter((x) => x.id && x.name && x.version);
}

module.exports = { getVersions, detectJava, detectAllJava, findJava, sanitizeInstalls };
