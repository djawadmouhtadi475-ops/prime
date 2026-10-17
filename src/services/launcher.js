// محرك التشغيل: يحلّ ملف الإصدار، ينزّل المكتبات والموارد ويتحقق منها، ثم يشغّل جافا.
// يدعم Vanilla و Fabric. (Forge/NeoForge تحتاج مثبّتًا خاصًا ولم تُدعم بعد.)
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { app } = require('electron');
const store = require('../config/store');
const accounts = require('./accounts');
const skins = require('./skins');
const sys = require('./system');
const net = require('./net');
const { version: LAUNCHER_VERSION } = require('../../package.json');

const OS = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux';
const root = () => path.join(app.getPath('userData'), 'minecraft');
const MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
let busy = false;

/* ---------- القواعد (rules) ---------- */
function ruleMatches(r, features) {
  if (r.os) {
    if (r.os.name && r.os.name !== OS) return false;
    if (r.os.arch === 'x86' && process.arch !== 'ia32') return false;
  }
  if (r.features) for (const [k, v] of Object.entries(r.features)) if (!!features[k] !== !!v) return false;
  return true;
}
function allowedByRules(rules, features = {}) {
  if (!rules || !rules.length) return true;
  let ok = false;
  for (const r of rules) if (ruleMatches(r, features)) ok = r.action === 'allow';
  return ok;
}

/* ---------- ملف الإصدار ---------- */
const jsonPath = (id) => path.join(root(), 'versions', id, id + '.json');
async function getVersionJson(id) {
  const p = jsonPath(id);
  if (fs.existsSync(p)) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { /* تالف: أعد التنزيل */ } }
  const man = await net.jget(MANIFEST);
  const e = man.versions.find((v) => v.id === id);
  if (!e) throw net.E(`الإصدار ${id} غير موجود في قائمة Mojang`);
  await net.download(e.url, p, { hash: e.sha1 });
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
const libKey = (n) => { const [g, a, , c] = String(n).split(':'); return `${g}:${a}${c ? ':' + c : ''}`; };
function mergeVersions(parent, child) {
  const seen = new Set(), libs = [];
  for (const l of [...(child.libraries || []), ...(parent.libraries || [])]) { const k = libKey(l.name); if (!seen.has(k)) { seen.add(k); libs.push(l); } }
  const pa = parent.arguments || {}, ca = child.arguments || {};
  return {
    ...parent, id: child.id || parent.id, mainClass: child.mainClass || parent.mainClass, libraries: libs,
    arguments: parent.arguments || child.arguments ? { game: [...(pa.game || []), ...(ca.game || [])], jvm: [...(pa.jvm || []), ...(ca.jvm || [])] } : undefined,
    minecraftArguments: child.minecraftArguments || parent.minecraftArguments
  };
}
async function resolveVersion(inst) {
  const base = await getVersionJson(inst.version);
  if (inst.loader === 'Vanilla') return base;
  if (inst.loader !== 'Fabric') throw net.E('التشغيل مع Forge وNeoForge سيتوفر في تحديث لاحق. استخدم Vanilla أو Fabric حاليًا.');
  const cache = path.join(root(), 'versions', `prime-fabric-${inst.version}.json`);
  let prof;
  try {
    const list = await net.jget(`https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(inst.version)}`);
    if (!list.length) throw net.E('هذا الإصدار غير مدعوم من Fabric');
    const lv = (list.find((x) => x.loader.stable) || list[0]).loader.version;
    prof = await net.jget(`https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(inst.version)}/${encodeURIComponent(lv)}/profile/json`);
    fs.mkdirSync(path.dirname(cache), { recursive: true }); fs.writeFileSync(cache, JSON.stringify(prof));
  } catch (e) {
    if (e.user) throw e;
    if (!fs.existsSync(cache)) throw net.E('تعذّر الاتصال بخدمة Fabric');
    prof = JSON.parse(fs.readFileSync(cache, 'utf8'));
  }
  return mergeVersions(base, prof);
}

/* ---------- المكتبات ---------- */
function mavenPath(name) {
  const [spec, ext = 'jar'] = String(name).split('@'); const [g, a, v, c] = spec.split(':');
  return `${g.replace(/\./g, '/')}/${a}/${v}/${a}-${v}${c ? '-' + c : ''}.${ext}`;
}
function collectLibraries(ver, features) {
  const files = [], natives = [];
  for (const lib of ver.libraries || []) {
    if (!allowedByRules(lib.rules, features)) continue;
    const dl = lib.downloads;
    if (dl?.artifact) files.push({ path: dl.artifact.path, url: dl.artifact.url, sha1: dl.artifact.sha1, size: dl.artifact.size, cp: true });
    else if (!lib.natives) { const p = mavenPath(lib.name); files.push({ path: p, url: (lib.url || 'https://libraries.minecraft.net/').replace(/\/?$/, '/') + p, sha1: lib.sha1, size: lib.size, cp: true }); }
    const cls = lib.natives?.[OS]?.replace('${arch}', process.arch === 'ia32' ? '32' : '64');
    const nat = cls && dl?.classifiers?.[cls];
    if (nat) { const f = { path: nat.path, url: nat.url, sha1: nat.sha1, size: nat.size, cp: false }; files.push(f); natives.push({ file: f, exclude: lib.extract?.exclude || ['META-INF/'] }); }
  }
  return { files, natives };
}
function extractNatives(natives, libDir, dir) {
  if (!natives.length) return;
  const AdmZip = require('adm-zip');
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  for (const { file, exclude } of natives) {
    for (const e of new AdmZip(path.join(libDir, file.path)).getEntries()) {
      if (e.isDirectory || exclude.some((x) => e.entryName.startsWith(x))) continue;
      fs.writeFileSync(net.safeJoin(dir, e.entryName), e.getData());
    }
  }
}

/* ---------- الوسائط ---------- */
const fillArgs = (list, vars, features) => {
  const out = [];
  for (const a of list || []) {
    if (typeof a === 'string') out.push(a);
    else if (allowedByRules(a.rules, features)) out.push(...[].concat(a.value));
  }
  return out.map((s) => s.replace(/\$\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)));
};
function buildArgs(ver, vars, features) {
  const jvm = ver.arguments?.jvm?.length ? ver.arguments.jvm : ['-Djava.library.path=${natives_directory}', '-cp', '${classpath}'];
  const game = ver.arguments?.game ? ver.arguments.game : (ver.minecraftArguments || '').split(/\s+/).filter(Boolean);
  return { jvm: fillArgs(jvm, vars, features), game: fillArgs(game, vars, features) };
}

/* ---------- التشغيل ---------- */
async function launch(instId, send) {
  if (busy) return { error: 'جارٍ تشغيل نسخة أخرى بالفعل' };
  busy = true;
  const step = (pct, text) => send('launch:progress', { pct: Math.round(pct), text });
  try {
    const inst = (store.get('installations', []) || []).find((i) => i.id === instId);
    if (!inst) throw net.E('النسخة غير موجودة');
    const acc = accounts.getActive();
    if (!acc) throw net.E('سجّل الدخول بحساب أولًا (اضغط على الحساب في الأعلى)');
    let token = '0';
    if (acc.type === 'microsoft') { token = accounts.token(acc.id); if (!token) throw net.E('انتهت جلسة Microsoft، أعد تسجيل الدخول'); }
    if (!path.isAbsolute(inst.gameDir)) throw net.E('مسار دليل اللعبة غير صالح');
    fs.mkdirSync(inst.gameDir, { recursive: true });

    step(2, 'جارٍ التحقق من الإصدار...');
    const ver = await resolveVersion(inst);
    const baseId = inst.version;
    const features = { has_custom_resolution: !!(inst.width && inst.height) && !inst.fullscreen };

    const libDir = path.join(root(), 'libraries'), assetDir = path.join(root(), 'assets');
    const { files, natives } = collectLibraries(ver, features);
    const client = ver.downloads?.client;
    if (!client) throw net.E('ملف اللعبة غير متوفر لهذا الإصدار');
    const idx = ver.assetIndex;
    const idxFile = path.join(assetDir, 'indexes', idx.id + '.json');
    await net.download(idx.url, idxFile, { hash: idx.sha1, size: idx.size });
    const assets = Object.values(JSON.parse(fs.readFileSync(idxFile, 'utf8')).objects);
    const uniq = [...new Map(assets.map((a) => [a.hash, a])).values()];

    const total = files.length + uniq.length + 1; let done = 0;
    const tick = (label) => { done++; step(5 + (done / total) * 90, label); };
    await net.download(client.url, path.join(root(), 'versions', baseId, baseId + '.jar'), { hash: client.sha1, size: client.size }); tick('جارٍ تنزيل ملفات اللعبة...');
    await net.pool(files, 8, async (f) => { await net.download(f.url, path.join(libDir, f.path), { hash: f.sha1, size: f.size }); tick('جارٍ تنزيل المكتبات...'); });
    await net.pool(uniq, 16, async (a) => {
      const p = a.hash.slice(0, 2) + '/' + a.hash;
      await net.download('https://resources.download.minecraft.net/' + p, path.join(assetDir, 'objects', p), { hash: a.hash, size: a.size }); tick('جارٍ تنزيل الموارد...');
    });

    step(96, 'جارٍ تجهيز اللعبة...');
    const nativesDir = path.join(root(), 'natives', inst.id);
    extractNatives(natives, libDir, nativesDir);
    let assetsRoot = assetDir;
    if (JSON.parse(fs.readFileSync(idxFile, 'utf8')).virtual) {   // إصدارات قديمة جدًا
      assetsRoot = path.join(assetDir, 'virtual', 'legacy');
      for (const [name, a] of Object.entries(JSON.parse(fs.readFileSync(idxFile, 'utf8')).objects)) {
        const dst = net.safeJoin(assetsRoot, name); if (fs.existsSync(dst)) continue;
        fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(path.join(assetDir, 'objects', a.hash.slice(0, 2), a.hash), dst);
      }
    }

    const need = ver.javaVersion?.majorVersion || 8;
    let java = inst.java ? { path: inst.java } : await sys.findJava(need);
    if (!java) throw net.E(`لم يتم العثور على جافا ${need} أو أحدث. ثبّتها من adoptium.net ثم أعد المحاولة.`);

    const cp = [...files.filter((f) => f.cp).map((f) => path.join(libDir, f.path)), path.join(root(), 'versions', baseId, baseId + '.jar')];
    const vars = {
      auth_player_name: acc.name, version_name: ver.id, game_directory: inst.gameDir, assets_root: assetsRoot, game_assets: assetsRoot,
      assets_index_name: idx.id, auth_uuid: acc.uuid.replace(/-/g, ''), auth_access_token: token, auth_session: token, clientid: '', auth_xuid: '',
      user_type: acc.type === 'microsoft' ? 'msa' : 'legacy', user_properties: '{}', version_type: ver.type || 'release',
      natives_directory: nativesDir, launcher_name: 'PrimeLauncher', launcher_version: LAUNCHER_VERSION, classpath: cp.join(path.delimiter),
      library_directory: libDir, classpath_separator: path.delimiter, resolution_width: String(inst.width || 854), resolution_height: String(inst.height || 480)
    };
    const a = buildArgs(ver, vars, features);
    const user = String(inst.jvm || '').split(/\s+/).filter(Boolean);
    const game = [...a.game];
    if (inst.fullscreen) game.push('--fullscreen');
    else if (inst.width && inst.height && !ver.arguments) game.push('--width', String(inst.width), '--height', String(inst.height));
    const argv = [...user, ...a.jvm, ver.mainClass, ...game];

    await skins.reapplyActive().catch(() => {});   // تأكد من تطبيق السكن قبل التشغيل
    const logDir = path.join(inst.gameDir, 'logs'); fs.mkdirSync(logDir, { recursive: true });
    const out = fs.openSync(path.join(logDir, 'prime-latest.log'), 'w');
    const child = spawn(java.path, argv, { cwd: inst.gameDir, detached: true, stdio: ['ignore', out, out], windowsHide: false });
    child.on('error', () => { busy = false; send('launch:error', { message: 'تعذّر تشغيل جافا. تحقق من المسار في إعدادات النسخة.' }); });
    child.once('spawn', () => { step(100, 'تم التشغيل'); send('launch:started', { name: inst.name }); });
    child.on('exit', (code) => { busy = false; try { fs.closeSync(out); } catch { /* تجاهل */ } send('launch:exit', { code, log: path.join(logDir, 'prime-latest.log') }); });
    child.unref();
    return { ok: true };
  } catch (e) {
    busy = false;
    return { error: e.user ? e.message : 'تعذّر التحضير للتشغيل. تحقق من الاتصال بالإنترنت وحاول مجددًا.' };
  }
}

module.exports = { launch, allowedByRules, collectLibraries, buildArgs, mergeVersions, mavenPath };
