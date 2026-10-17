// تخزين إعدادات بسيط في userData/settings.json (كتابة ذرّية).
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const file = () => path.join(app.getPath('userData'), 'settings.json');

function read() {
  try { return JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { return {}; }
}
function write(data) {
  const tmp = file() + '.tmp';
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file());
}
function get(key, fallback) { const d = read(); return key in d ? d[key] : fallback; }
function set(key, value) { const d = read(); d[key] = value; write(d); }

module.exports = { get, set };
