// تحميل المفاتيح (العملية الرئيسية فقط). الأولوية:
// 1) متغيرات البيئة  2) keys.json  3) القيم المحفوظة من الإعدادات.
// لا تُطبع المفاتيح في السجلات ولا تُرسل إلى الواجهة أبدًا.
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const store = require('./store');

const NAMES = ['MICROSOFT_CLIENT_ID', 'CURSEFORGE_API_KEY'];
const UA = 'GmuStudios/PrimeLauncher/0.3.9 (prime-launcher)';

function clean(v) {
  v = typeof v === 'string' ? v.trim() : '';
  return v && !/^PUT_YOUR_/.test(v) ? v : '';
}

function fromFile() {
  const p = app.isPackaged
    ? path.join(process.resourcesPath, 'keys.json')
    : path.join(__dirname, '..', '..', 'keys.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
}

function getKeys() {
  const file = fromFile();
  const saved = store.get('keys', {});
  const out = {};
  for (const n of NAMES) out[n] = clean(process.env[n]) || clean(file[n]) || clean(saved[n]);
  return out;
}

// الواجهة تستقبل قيمًا منطقية فقط.
function hasKeys() {
  const k = getKeys();
  return { microsoft: !!k.MICROSOFT_CLIENT_ID, curseforge: !!k.CURSEFORGE_API_KEY };
}

function saveKeys(input) {
  const saved = store.get('keys', {});
  for (const n of NAMES) if (typeof input?.[n] === 'string' && input[n].trim()) saved[n] = input[n].trim();
  store.set('keys', saved);
  return hasKeys();
}

// اختبار خفيف: طلب واحد. يعيد { ok, code } دون أي نص يحوي المفتاح.
async function testKey(which, typed) {
  const k = getKeys();
  const t = (v) => (typeof v === 'string' ? v.trim() : '');
  try {
    if (which === 'microsoft') {
      const id = t(typed) || k.MICROSOFT_CLIENT_ID;
      if (!id) return { ok: false, code: 'missing' };
      const r = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: new URLSearchParams({ client_id: id, scope: 'XboxLive.signin offline_access' }),
        signal: AbortSignal.timeout(10000)
      });
      return r.ok ? { ok: true, code: 'ok' } : { ok: false, code: 'invalid' };
    }
    if (which === 'curseforge') {
      const key = t(typed) || k.CURSEFORGE_API_KEY;
      if (!key) return { ok: false, code: 'missing' };
      const r = await fetch('https://api.curseforge.com/v1/games/432', {
        headers: { 'x-api-key': key, Accept: 'application/json', 'User-Agent': UA },
        signal: AbortSignal.timeout(10000)
      });
      return r.ok ? { ok: true, code: 'ok' } : { ok: false, code: 'invalid' };
    }
  } catch { return { ok: false, code: 'network' }; }
  return { ok: false, code: 'missing' };
}

module.exports = { getKeys, hasKeys, saveKeys, testKey, UA };
