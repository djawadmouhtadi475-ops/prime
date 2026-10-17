// تصفح المودات وتثبيتها: Modrinth (واجهة عامة v2) و CurseForge (بمفتاح).
const fs = require('fs');
const path = require('path');
const os = require('os');
const store = require('../config/store');
const keys = require('../config/keys');
const net = require('./net');

const TYPES = ['mod', 'modpack', 'resourcepack'];
const LOADERS = ['fabric', 'forge', 'neoforge', 'quilt'];
const CF_CLASS = { mod: 6, modpack: 4471, resourcepack: 12 };
const CF_LOADER = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 };
const SAFE = /^[\w.\-+]{1,40}$/;

function clean(p = {}) {
  const o = { q: String(p.q || '').slice(0, 80), type: TYPES.includes(p.type) ? p.type : 'mod', offset: Math.max(0, Math.min(10000, +p.offset || 0)) };
  if (LOADERS.includes(p.loader)) o.loader = p.loader;
  if (p.version && SAFE.test(p.version)) o.version = p.version;
  if (p.category && SAFE.test(p.category)) o.category = p.category;
  return o;
}
const fail = (e) => ({ error: e.status === 403 || e.status === 401 ? 'invalid' : e.status === 429 ? 'rate' : 'network' });

/* ---------- البحث ---------- */
async function searchModrinth(p) {
  const facets = [[`project_type:${p.type}`]];
  if (p.loader && p.type !== 'resourcepack') facets.push([`categories:${p.loader}`]);
  if (p.version) facets.push([`versions:${p.version}`]);
  if (p.category) facets.push([`categories:${p.category}`]);
  const u = new URL('https://api.modrinth.com/v2/search');
  u.searchParams.set('query', p.q); u.searchParams.set('facets', JSON.stringify(facets)); u.searchParams.set('limit', '20');
  u.searchParams.set('offset', String(p.offset)); u.searchParams.set('index', p.q ? 'relevance' : 'downloads');
  const j = await net.jget(u.toString());
  return { total: j.total_hits, items: j.hits.map((h) => ({ id: h.project_id, name: h.title, author: h.author, desc: h.description, downloads: h.downloads, icon: h.icon_url || '', type: p.type, platform: 'modrinth' })) };
}
async function searchCurse(p) {
  const key = keys.getKeys().CURSEFORGE_API_KEY; if (!key) return { error: 'nokey' };
  const u = new URL('https://api.curseforge.com/v1/mods/search');
  const q = { gameId: 432, classId: CF_CLASS[p.type], searchFilter: p.q, sortField: 2, sortOrder: 'desc', pageSize: 20, index: p.offset };
  if (p.version) q.gameVersion = p.version;
  if (p.loader && p.type !== 'resourcepack') q.modLoaderType = CF_LOADER[p.loader];
  for (const [k, v] of Object.entries(q)) if (v !== '' && v !== undefined) u.searchParams.set(k, String(v));
  const j = await net.jget(u.toString(), { 'x-api-key': key });
  return { total: j.pagination?.totalCount || 0, items: j.data.map((m) => ({ id: String(m.id), name: m.name, author: m.authors?.[0]?.name || '', desc: m.summary, downloads: m.downloadCount, icon: m.logo?.thumbnailUrl || '', type: p.type, platform: 'curseforge' })) };
}
async function search(platform, params) {
  const p = clean(params);
  try { return platform === 'curseforge' ? await searchCurse(p) : await searchModrinth(p); } catch (e) { return fail(e); }
}

/* ---------- التثبيت ---------- */
const FOLDER = { mod: 'mods', resourcepack: 'resourcepacks' };
async function installModrinth(project, type, inst, seen, depth) {
  if (seen.has(project)) return [];
  seen.add(project);
  const q = new URLSearchParams({ game_versions: JSON.stringify([inst.version]) });
  if (type !== 'resourcepack') q.set('loaders', JSON.stringify([inst.loader.toLowerCase()]));
  const vers = await net.jget(`https://api.modrinth.com/v2/project/${encodeURIComponent(project)}/version?${q}`);
  if (!vers.length) throw net.E(`لا يوجد إصدار متوافق مع ${inst.loader} ${inst.version}`);
  const v = vers[0], f = v.files.find((x) => x.primary) || v.files[0], done = [];
  if (type === 'modpack') return installMrpack(v, f, inst);
  await net.download(f.url, path.join(inst.gameDir, FOLDER[type], path.basename(f.filename)), { algo: 'sha512', hash: f.hashes?.sha512 });
  done.push(f.filename);
  if (type === 'mod' && depth < 2) {
    for (const d of v.dependencies || []) if (d.dependency_type === 'required' && d.project_id) done.push(...await installModrinth(d.project_id, 'mod', inst, seen, depth + 1).catch(() => []));
  }
  return done;
}
// حزمة مودات .mrpack: ملفات من modrinth.index.json + مجلدات overrides
async function installMrpack(v, f, inst) {
  const AdmZip = require('adm-zip');
  const tmp = path.join(os.tmpdir(), 'prime-' + Date.now() + '.mrpack');
  await net.download(f.url, tmp, { algo: 'sha512', hash: f.hashes?.sha512 });
  try {
    const zip = new AdmZip(tmp), idx = JSON.parse(zip.readAsText('modrinth.index.json'));
    const list = (idx.files || []).filter((x) => x.env?.client !== 'unsupported');
    await net.pool(list, 6, async (x) => {
      const dest = net.safeJoin(inst.gameDir, x.path), url = (x.downloads || []).find((u) => net.allowed(u));
      if (!url) throw net.E('رابط ملف في الحزمة غير مسموح');
      await net.download(url, dest, { algo: 'sha512', hash: x.hashes?.sha512 });
    });
    for (const e of zip.getEntries()) {
      const m = /^(client-)?overrides\/(.+)$/.exec(e.entryName);
      if (!m || e.isDirectory) continue;
      const dest = net.safeJoin(inst.gameDir, m[2]); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, e.getData());
    }
    return [idx.name || f.filename];
  } finally { fs.rmSync(tmp, { force: true }); }
}
async function installCurse(id, type, inst) {
  const key = keys.getKeys().CURSEFORGE_API_KEY; if (!key) throw net.E('أضف مفتاح CurseForge لتفعيل التثبيت');
  if (type === 'modpack') throw net.E('تثبيت حزم CurseForge غير مدعوم بعد، جرّب Modrinth');
  const u = new URL(`https://api.curseforge.com/v1/mods/${encodeURIComponent(id)}/files`);
  u.searchParams.set('gameVersion', inst.version); u.searchParams.set('pageSize', '1');
  if (type === 'mod') u.searchParams.set('modLoaderType', String(CF_LOADER[inst.loader.toLowerCase()] || 0));
  const j = await net.jget(u.toString(), { 'x-api-key': key });
  const f = j.data?.[0]; if (!f) throw net.E(`لا يوجد إصدار متوافق مع ${inst.loader} ${inst.version}`);
  if (!f.downloadUrl) throw net.E('صاحب المود لا يسمح بالتنزيل من خارج موقع CurseForge');
  const sha1 = f.hashes?.find((h) => h.algo === 1)?.value;
  await net.download(f.downloadUrl, path.join(inst.gameDir, FOLDER[type], path.basename(f.fileName)), { algo: 'sha1', hash: sha1 });
  return [f.fileName];
}
async function install({ platform, id, type, instanceId }) {
  const inst = (store.get('installations', []) || []).find((i) => i.id === instanceId);
  if (!inst || !path.isAbsolute(inst.gameDir)) return { error: 'النسخة غير صالحة' };
  if (!TYPES.includes(type) || !id || String(id).length > 40) return { error: 'طلب غير صالح' };
  if (type === 'mod' && inst.loader === 'Vanilla') return { error: 'هذه النسخة Vanilla؛ اختر نسخة Fabric أو Forge لتثبيت المودات' };
  try {
    fs.mkdirSync(inst.gameDir, { recursive: true });
    const files = platform === 'curseforge' ? await installCurse(String(id), type, inst) : await installModrinth(String(id), type, inst, new Set(), 0);
    return { ok: true, files };
  } catch (e) { return { error: e.user ? e.message : 'تعذّر التثبيت، تحقق من الاتصال وحاول مجددًا' }; }
}

module.exports = { search, install };
