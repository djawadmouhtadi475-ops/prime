// ينشئ keys.json فارغًا إذا لم يوجد، حتى لا يفشل البناء (extraResources).
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'keys.json');
if (!fs.existsSync(file)) {
  fs.writeFileSync(file, JSON.stringify({ MICROSOFT_CLIENT_ID: '', CURSEFORGE_API_KEY: '' }));
  console.log('keys.json (فارغ) تم إنشاؤه.');
}
