// ينزّل خط Cairo (OFL) محليًا إلى assets/fonts مرة واحدة. لا يُفشل التثبيت إذا تعذّر.
const fs = require('fs');
const path = require('path');
const https = require('https');
const dir = path.join(__dirname, '..', 'assets', 'fonts');
fs.mkdirSync(dir, { recursive: true });
const jobs = [];
for (const w of [400, 600, 700, 800]) for (const s of ['arabic', 'latin'])
  jobs.push([`https://cdn.jsdelivr.net/fontsource/fonts/cairo@latest/${s}-${w}-normal.woff2`, `cairo-${s}-${w}.woff2`]);
function get(url, out, redirects = 3) {
  return new Promise((resolve) => {
    if (fs.existsSync(out) && fs.statSync(out).size > 1000) return resolve();
    https.get(url, { headers: { 'User-Agent': 'PrimeLauncher-build' } }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && redirects > 0) { r.resume(); return resolve(get(r.headers.location, out, redirects - 1)); }
      if (r.statusCode !== 200) { r.resume(); return resolve(); }
      const f = fs.createWriteStream(out); r.pipe(f); f.on('finish', () => f.close(resolve));
    }).on('error', () => resolve());
  });
}
Promise.all(jobs.map(([u, n]) => get(u, path.join(dir, n)))).then(() => console.log('الخطوط جاهزة (أو سيُستخدم خط النظام).'));
