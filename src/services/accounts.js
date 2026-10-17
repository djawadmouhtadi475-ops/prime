// الحسابات: تُحفظ البيانات غير السرية فقط (الاسم، النوع، UUID، السكن النشط).
// رموز Microsoft تبقى في الذاكرة فقط ولا تُكتب على القرص.
const crypto = require('crypto');
const store = require('../config/store');

const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;
const tokens = new Map();   // accountId -> { mc: accessToken } (ذاكرة فقط)

// UUID v3 لسلسلة "OfflinePlayer:<name>" — مطابق لما تفعله اللعبة الأصلية.
function offlineUuid(name) {
  const b = crypto.createHash('md5').update('OfflinePlayer:' + name, 'utf8').digest();
  b[6] = (b[6] & 0x0f) | 0x30;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
const dash = (h) => `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;

const all = () => store.get('accounts', []);
const view = () => ({ accounts: all(), active: store.get('activeAccount', null) });
const getActive = () => all().find((a) => a.id === store.get('activeAccount', null)) || null;

function addOffline(name) {
  name = String(name || '').trim();
  if (!NAME_RE.test(name)) return { error: 'invalid' };
  const list = all();
  let acc = list.find((a) => a.type === 'offline' && a.name === name);
  if (!acc) {
    acc = { id: 'off-' + offlineUuid(name), name, type: 'offline', uuid: offlineUuid(name), skinId: null };
    list.push(acc); store.set('accounts', list);
  }
  store.set('activeAccount', acc.id);
  return { ...view(), account: acc };
}
function addMicrosoft({ name, uuidHex, mcToken }) {
  const list = all(), id = 'ms-' + uuidHex;
  let acc = list.find((a) => a.id === id);
  if (!acc) { acc = { id, name, type: 'microsoft', uuid: dash(uuidHex), skinId: null }; list.push(acc); }
  else acc.name = name;
  store.set('accounts', list); store.set('activeAccount', id); tokens.set(id, { mc: mcToken });
  return { ...view(), account: acc };
}
function setActive(id) {
  if (!all().some((a) => a.id === id)) return view();
  store.set('activeAccount', id); return view();
}
function remove(id) {
  const list = all().filter((a) => a.id !== id); store.set('accounts', list); tokens.delete(id);
  if (store.get('activeAccount', null) === id) store.set('activeAccount', list[0]?.id || null);
  return view();
}
function setSkin(id, skinId) {
  const list = all(), a = list.find((x) => x.id === id);
  if (a) { a.skinId = skinId; store.set('accounts', list); }
}
function clearSkin(skinId) {
  const list = all(); let ch = false;
  for (const a of list) if (a.skinId === skinId) { a.skinId = null; ch = true; }
  if (ch) store.set('accounts', list);
}
const token = (id) => tokens.get(id)?.mc || null;
// وسائط التشغيل للحساب غير المتصل (تُستخدم في مرحلة التشغيل الفعلي)
const offlineArgs = (a) => ['--username', a.name, '--uuid', a.uuid.replace(/-/g, ''), '--accessToken', '0', '--userType', 'legacy'];

module.exports = { NAME_RE, offlineUuid, view, getActive, addOffline, addMicrosoft, setActive, remove, setSkin, clearSkin, token, offlineArgs };
