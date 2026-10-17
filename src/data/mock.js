// بيانات تجريبية — استبدلها لاحقًا بواجهات حقيقية (إصدارات، أخبار، سيرفرات).
window.MOCK = {
  account: { name: 'Steve_Prime', type: 'offline' },
  art: [
    { file: 'dawn',   caption: 'فجر على السهول المفتوحة' },
    { file: 'dusk',   caption: 'غروب الصحراء الذهبية' },
    { file: 'sakura', caption: 'بستان أزهار الكرز' },
    { file: 'frost',  caption: 'قمم الجليد الشاهقة' },
    { file: 'cave',   caption: 'أعماق الكهوف المضيئة' }
  ],
  // نسخ تجريبية تُزرع عند أول تشغيل فقط، ويمكن حذفها من شاشة الإصدارات.
  installations: [
    { id: 'i1', name: 'النسخة الأخيرة',   icon: 'grass',    version: '1.21.4', loader: 'Vanilla', lastPlayed: Date.now() - 2 * 36e5 },
    { id: 'i2', name: 'بقاء مع المودات',  icon: 'pickaxe',  version: '1.20.1', loader: 'Fabric',  lastPlayed: Date.now() - 30 * 36e5 },
    { id: 'i3', name: 'عالم الخيال',      icon: 'furnace',  version: '1.19.2', loader: 'Forge',   lastPlayed: Date.now() - 3 * 864e5 },
    { id: 'i4', name: 'اللقطة التجريبية', icon: 'tnt',      version: '24w14a', loader: 'Vanilla', lastPlayed: null }
  ],
  news: [
    { id: 'n1', tag: 'تحديث', title: 'تحديث جديد يضيف مناطق طبيعية وكائنات لم نرها من قبل', date: '12 أكتوبر 2026', summary: 'يصل التحديث بمناظر طبيعية متنوعة وتحسينات على الأداء وإصلاحات عديدة.', art: 'dawn' },
    { id: 'n2', tag: 'مجتمع', title: 'مسابقة البناء الشهرية: قرى معلّقة بين الجبال', date: '8 أكتوبر 2026', summary: 'شارك بأفضل بناء لديك واربح مكافآت حصرية داخل اللعبة.', art: 'frost' },
    { id: 'n3', tag: 'اللانشر', title: 'Prime Launcher 0.3.9: واجهة أسرع وإدارة أسهل للنسخ', date: '1 أكتوبر 2026', summary: 'تحسينات في شاشة الإصدارات ودعم أفضل للحسابات غير المتصلة.', art: 'sakura' },
    { id: 'n4', tag: 'لقطة', title: 'لقطة تجريبية جديدة: تعديلات على الكهوف والإضاءة', date: '24 سبتمبر 2026', summary: 'جرّب التغييرات المقبلة قبل صدورها الرسمي وشاركنا ملاحظاتك.', art: 'cave' }
  ],
  servers: [
    { id: 's1', name: 'عالم الأحلام',   ip: 'play.dreamworld.example', online: true,  players: 128, max: 500, ping: 38,  color: ['#1f3b2c', '#2f7a46'] },
    { id: 's2', name: 'صحراء البقاء',   ip: 'mc.survival-sands.example', online: true, players: 64,  max: 200, ping: 92,  color: ['#4a2f1a', '#b9722f'] },
    { id: 's3', name: 'مملكة الحرب',    ip: 'war.kingdom.example',      online: true,  players: 311, max: 500, ping: 160, color: ['#2a2540', '#5b4aa3'] }
  ]
};
