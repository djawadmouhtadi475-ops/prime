// يحوّل assets/icon.png (256×256 فأكثر) إلى assets/icon.ico (PNG داخل ICO).
// الاستخدام: npm run make-icons
const fs = require('fs');
const path = require('path');
const png = fs.readFileSync(path.join(__dirname, '..', 'assets', 'icon.png'));
const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
if (w < 256 || h < 256) { console.error('يجب أن تكون الصورة 256×256 على الأقل'); process.exit(1); }
const head = Buffer.alloc(22);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4);
head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12);
head.writeUInt32LE(png.length, 14); head.writeUInt32LE(22, 18);
fs.writeFileSync(path.join(__dirname, '..', 'assets', 'icon.ico'), Buffer.concat([head, png]));
console.log('تم إنشاء assets/icon.ico');
