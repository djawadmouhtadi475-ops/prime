// تسجيل الدخول عبر Microsoft بطريقة رمز الجهاز (Device Code). كل الطلبات من العملية الرئيسية.
const keys = require('../config/keys');
const accounts = require('./accounts');

const TENANT = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';
let run = 0;   // رقم المحاولة الحالية لإلغاء الاستطلاع القديم

const form = (o) => new URLSearchParams(o);
async function post(url, body, json = false) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'User-Agent': keys.UA, Accept: 'application/json', 'Content-Type': json ? 'application/json' : 'application/x-www-form-urlencoded' },
    body: json ? JSON.stringify(body) : form(body), signal: AbortSignal.timeout(15000)
  });
  let data = {}; try { data = await r.json(); } catch { /* فارغ */ }
  return { ok: r.ok, status: r.status, data };
}

async function chain(msToken) {
  const xbl = await post('https://user.auth.xboxlive.com/user/authenticate', { Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: 'd=' + msToken }, RelyingParty: 'http://auth.xboxlive.com', TokenType: 'JWT' }, true);
  if (!xbl.ok) throw new Error('xbox');
  const uhs = xbl.data.DisplayClaims.xui[0].uhs;
  const xsts = await post('https://xsts.auth.xboxlive.com/xsts/authorize', { Properties: { SandboxId: 'RETAIL', UserTokens: [xbl.data.Token] }, RelyingParty: 'rp://api.minecraftservices.com/', TokenType: 'JWT' }, true);
  if (!xsts.ok) { const e = new Error('xsts'); e.xerr = xsts.data?.XErr; throw e; }
  const mc = await post('https://api.minecraftservices.com/authentication/login_with_xbox', { identityToken: `XBL3.0 x=${uhs};${xsts.data.Token}` }, true);
  if (!mc.ok) throw new Error('mc');
  const token = mc.data.access_token;
  const pr = await fetch('https://api.minecraftservices.com/minecraft/profile', { headers: { Authorization: 'Bearer ' + token, 'User-Agent': keys.UA }, signal: AbortSignal.timeout(15000) });
  if (pr.status === 404) throw new Error('nogame');
  if (!pr.ok) throw new Error('profile');
  const p = await pr.json();
  return { name: p.name, uuidHex: p.id, mcToken: token };
}

const ERR = {
  xbox: 'تعذّر الاتصال بخدمة Xbox', mc: 'تعذّر تسجيل الدخول إلى خدمات ماينكرافت', profile: 'تعذّر جلب الملف الشخصي',
  nogame: 'هذا الحساب لا يملك نسخة من ماينكرافت (جافا)', network: 'تعذّر الاتصال بالإنترنت', expired: 'انتهت صلاحية الرمز، حاول مجددًا', denied: 'تم رفض تسجيل الدخول'
};
function xerr(code) {
  if (code === 2148916233) return 'هذا الحساب لا يملك حساب Xbox، أنشئ واحدًا أولًا';
  if (code === 2148916238) return 'حسابات الأطفال تحتاج إلى إضافتها إلى عائلة Microsoft أولًا';
  return 'تعذّر التحقق عبر Xbox';
}

async function start(send) {
  const id = keys.getKeys().MICROSOFT_CLIENT_ID;
  if (!id) return { error: 'nokey' };
  const my = ++run;
  let d;
  try { d = await post(TENANT + '/devicecode', { client_id: id, scope: 'XboxLive.signin offline_access' }); } catch { return { error: 'network' }; }
  if (!d.ok) return { error: 'invalid' };
  const { device_code: dc, user_code: userCode, verification_uri: uri, expires_in: exp } = d.data;
  let interval = (d.data.interval || 5) * 1000; const until = Date.now() + exp * 1000;
  const finish = (payload) => { if (my === run) send(payload); };
  (async () => {
    while (my === run) {
      await new Promise((r) => setTimeout(r, interval));
      if (my !== run) return;
      if (Date.now() > until) return finish({ ok: false, error: ERR.expired });
      let t;
      try { t = await post(TENANT + '/token', { grant_type: 'urn:ietf:params:oauth:grant-type:device_code', client_id: id, device_code: dc }); } catch { return finish({ ok: false, error: ERR.network }); }
      if (t.ok) {
        try { const p = await chain(t.data.access_token); return finish({ ok: true, ...accounts.addMicrosoft(p) }); }
        catch (e) { return finish({ ok: false, error: e.xerr ? xerr(e.xerr) : (ERR[e.message] || ERR.network) }); }
      }
      const er = t.data?.error;
      if (er === 'slow_down') interval += 5000;
      else if (er !== 'authorization_pending') return finish({ ok: false, error: er === 'authorization_declined' ? ERR.denied : ERR.expired });
    }
  })();
  return { userCode, verificationUri: uri, expiresIn: exp };
}
const cancel = () => { run++; };

module.exports = { start, cancel };
