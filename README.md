# Prime Launcher 0.3.9

لانشر ماينكرافت عربي بالكامل من **Gmu Studios** — مبني بـ Electron وواجهة HTML/CSS/JavaScript خالصة.

> **حالة الحزمة:** المرحلة 4 من 4 — الواجهة كاملة: العب، الإصدارات، الحسابات، السكنات، متصفح المودات، والتشغيل الفعلي.
> **التشغيل الفعلي:** يعمل مع Vanilla و Fabric. أما Forge و NeoForge فتحتاج مثبّتًا خاصًا ولم تُدعم بعد (يمكن تثبيت مودات Forge لكن التشغيل غير متاح).
> **المتطلبات:** جافا مثبّتة (17 أو 21 حسب الإصدار) ويكتشفها التطبيق تلقائيًا، واتصال بالإنترنت عند أول تشغيل لكل إصدار.

## التشغيل محليًا
```bash
npm install     # يثبّت الاعتماديات وينزّل خط Cairo تلقائيًا
npm start       # تشغيل التطبيق
npm run build   # إنشاء ملفات التثبيت داخل مجلد dist
```

## ضبط المفاتيح (طريقتان)

**أ) محليًا**
1. انسخ `keys.example.json` إلى `keys.json`.
2. ضع معرّف تطبيق Azure ومفتاح CurseForge داخله.
3. الملف `keys.json` مُدرج في `.gitignore` ولن يُرفع إلى GitHub.

يمكنك أيضًا إدخال المفاتيح من داخل التطبيق: الإعدادات ← مفاتيح الخدمات.

**ب) عبر GitHub**
1. افتح المستودع ← Settings ← Secrets and variables ← Actions ← New repository secret.
2. أنشئ سرّين: `MICROSOFT_CLIENT_ID` و `CURSEFORGE_API_KEY`.
3. سيُنشئ مسار البناء ملف `keys.json` تلقائيًا قبل البناء (يعمل البناء حتى لو كانت القيم فارغة).

أولوية التحميل: متغيرات البيئة ← `keys.json` ← القيم المحفوظة من الإعدادات.

## رفع المشروع إلى GitHub والحصول على ملف التثبيت
1. أنشئ مستودعًا جديدًا على GitHub (فارغًا).
2. فك ضغط الملف `PrimeLauncher-0.3.9.zip` وارفع **محتوياته مباشرة** إلى المستودع (Add file ← Upload files)، ثم اضغط Commit على فرع `main`.
3. افتح تبويب **Actions** وانتظر انتهاء المهمة «Build Prime Launcher».
4. افتح المهمة المكتملة ونزّل الملف من قسم **Artifacts** باسم `PrimeLauncher-windows`.
5. لنشر إصدار رسمي: أنشئ وسمًا مثل `v0.3.9` وسيُرفع ملف `.exe` تلقائيًا إلى صفحة Releases.

## الأيقونات والخطوط
- أيقونة التطبيق: `assets/icon.png` و `assets/icon.ico`. لتوليد ICO من PNG: `npm run make-icons`.
- أيقونات المنصات في `assets/icons/platforms/` يمكن استبدالها بالشعارات الرسمية.
- الخط Cairo يُنزَّل إلى `assets/fonts/` عند `npm install`؛ إن تعذّر يُستخدم خط النظام دون أن يفشل التثبيت.

## الأمان
لا تُرسل المفاتيح إلى الواجهة أبدًا (قيم منطقية فقط)، ولا تُسجَّل ولا تُخزَّن في localStorage.


## Live official data
- The version picker reads Mojang’s version manifest (`piston-meta.mojang.com`) online and caches results. The bundled fallback includes release 26.3; snapshot IDs are deliberately not guessed and are loaded from the live manifest.
- The home feed requests the Minecraft.net community RSS feed. If it is unavailable, it falls back to real release/snapshot metadata from Mojang’s version manifest. It no longer displays fabricated news or example server populations.
- Fresh installs start with no fake game instances or sample player account; the user creates a real installation or signs in.
