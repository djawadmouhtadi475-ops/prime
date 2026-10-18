# Prime Launcher — Linux و macOS Build

تم تخصيص إعدادات البناء لإنتاج:
- **Linux:** `AppImage` و `deb` عبر `npm run build:linux`
- **macOS:** `dmg` و `zip` عبر `npm run build:mac`
- **Windows:** `exe` عبر `npm run build:windows`

## البناء تلقائيًا عبر GitHub Actions
ارفع محتويات هذا المشروع إلى مستودع GitHub ثم افتح **Actions** وشغّل **Build Prime Launcher**. سيبني النظام ثلاث نسخ على أنظمة تشغيل مناسبة لكل منصة، وستجد النتائج تحت Artifacts:
- `PrimeLauncher-linux`
- `PrimeLauncher-macos`
- `PrimeLauncher-windows`

إنشاء إصدار GitHub Release يتم تلقائيًا عند دفع tag يبدأ بـ `v` مثل `v0.3.9`.

## ملاحظات مهمة
- بناء macOS يتم على runner من macOS لإنشاء أيقونة `.icns` والتغليف الصحيح؛ لا يُنصح ببناء نسخة Mac على Windows.
- البناء لا يوقّع تطبيق macOS ولا يصدّقه لدى Apple. قد يعرض Gatekeeper تحذيرًا عند فتح التطبيق؛ التوزيع العام يحتاج عادةً إلى شهادة Apple Developer وتوثيق التطبيق.
- Linux ينتج AppImage وdeb. قد تختلف متطلبات تشغيل Electron حسب توزيعة Linux.
- تسجيل الدخول عبر Microsoft يحتاج `MICROSOFT_CLIENT_ID` مضبوطًا في GitHub Secrets أو من إعدادات التطبيق. مفتاح CurseForge اختياري لبعض وظائف البحث.
- لا يوجد `package-lock.json` في النسخة المرفقة، لذلك يستخدم workflow `npm install` تلقائيًا.
