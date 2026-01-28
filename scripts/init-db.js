const fs = require('fs-extra');
const path = require('path');

async function initializeEnhancedDatabase() {
  console.log('🔧 بدء تهيئة قاعدة البيانات المطورة...');
  
  try {
    const dbPath = path.join(__dirname, '..', 'data', 'database');
    
    // إنشاء المجلدات
    await fs.ensureDir(dbPath);
    await fs.ensureDir(path.join(__dirname, '..', 'uploads'));
    await fs.ensureDir(path.join(__dirname, '..', 'backups'));
    await fs.ensureDir(path.join(__dirname, '..', 'admin'));
    
    // تحميل الأذكار المطورة
    const enhancedAdhkarPath = path.join(__dirname, '..', 'data', 'enhanced-adhkar.json');
    let enhancedAdhkar = {};
    
    if (await fs.pathExists(enhancedAdhkarPath)) {
      enhancedAdhkar = JSON.parse(await fs.readFile(enhancedAdhkarPath, 'utf8'));
      console.log('✅ تم تحميل الأذكار المطورة');
    } else {
      console.log('⚠️ ملف الأذكار المطورة غير موجود');
    }
    
    // ملفات قاعدة البيانات المحسنة
    const defaultFiles = {
      'groups.json': {
        'default': {
          id: 'default',
          name: 'إعدادات افتراضية مطورة',
          settings: {
            morningAdhkar: true,
            eveningAdhkar: true,
            periodicAdhkar: true,
            periodicEnhancedAdhkar: true,
            fridayReminder: true,
            randomInterval: 120,
            morningTime: '06:00',
            eveningTime: '18:00',
            includeAudio: true,
            includePDF: true,
            enhancedCategories: {
              sleep: true,
              wakeup: true,
              travel: true,
              eating: true,
              general: true,
              repentance: true,
              quran: true
            },
            active: true
          }
        }
      },
      
      'users.json': {
        '6960704733': {
          id: '6960704733',
          username: 'dev3bod',
          firstName: 'المطور',
          isDeveloper: true,
          isSuperAdmin: true,
          joinDate: new Date().toISOString(),
          lastActive: new Date().toISOString()
        }
      },
      
      'adhkar.json': {
        'enhanced_sleep_001': {
          id: 'enhanced_sleep_001',
          title: 'أذكار النوم',
          text: 'باسمك اللهم أموت وأحيا',
          category: 'sleep',
          source: 'حصن المسلم',
          audio: 'https://server.islamic.com/audio/sleep/001.mp3',
          pdf: 'https://server.islamic.com/pdf/sleep-adhkar.pdf',
          enabled: true,
          isEnhanced: true,
          createdAt: new Date().toISOString()
        }
      },
      
      'schedules.json': {
        'enhanced_periodic': {
          id: 'enhanced_periodic',
          type: 'enhanced_periodic',
          schedule: '0 */2 * * *',
          enabled: true,
          lastRun: null,
          nextRun: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        }
      },
      
      'media.json': {
        pdfs: enhancedAdhkar.pdf_resources || [],
        audios: enhancedAdhkar.audio_resources || []
      },
      
      'categories.json': Object.entries(enhancedAdhkar.categories || {}).reduce((acc, [key, cat]) => {
        acc[key] = {
          id: key,
          name: cat.name,
          description: cat.description || `فئة ${cat.name}`,
          icon: cat.icon || '🌟',
          enabled: true,
          isEnhanced: true,
          items: cat.items || []
        };
        return acc;
      }, {}),
      
      'broadcasts.json': {},
      
      'streams.json': {}
    };
    
    // حفظ الملفات
    for (const [fileName, content] of Object.entries(defaultFiles)) {
      const filePath = path.join(dbPath, fileName);
      await fs.writeJson(filePath, content, { spaces: 2 });
      console.log(`✅ تم إنشاء ${fileName}`);
    }
    
    // إنشاء ملف نصي للتعليمات
    const instructions = `# 🎯 قاعدة البيانات المطورة - بوت الأذكار الإسلامي

## 📊 محتويات قاعدة البيانات

### 1. groups.json
- إعدادات المجموعات
- تفعيل/تعطيل المميزات
- تخصيص الجدولة

### 2. users.json
- بيانات المستخدمين
- صلاحيات المشرفين
- سجل النشاط

### 3. adhkar.json
- الأذكار المطورة
- الفئات المحسنة
- الوسائط المرتبطة

### 4. schedules.json
- الجداول الزمنية
- المهام المجدولة
- سجل التنفيذ

### 5. media.json
- ملفات PDF
- روابط صوتية
- الوسائط المرفوعة

### 6. categories.json
- الفئات المطورة (8 فئات)
- الأذكار المصنفة
- إعدادات العرض

### 7. broadcasts.json
- سجل البث
- المهام المجدولة
- النتائج والإحصائيات

### 8. streams.json
- البثوث المباشرة
- إعدادات البث
- سجل المشاهدات

## 🔄 صيانة قاعدة البيانات

### النسخ الاحتياطي
\`\`\`bash
node scripts/backup.js
\`\`\`

### الاستعادة
\`\`\`bash
node scripts/restore.js backup-file.json
\`\`\`

### التهيئة من جديد
\`\`\`bash
node scripts/init-db.js
\`\`\`

## 📁 هيكل المجلدات

\`\`\`
data/
├── database/          # قاعدة البيانات الرئيسية
│   ├── groups.json
│   ├── users.json
│   ├── adhkar.json
│   ├── schedules.json
│   ├── media.json
│   ├── categories.json
│   ├── broadcasts.json
│   └── streams.json
├── adhkar.json       # الأذكار الأساسية
├── enhanced-adhkar.json # الأذكار المطورة
└── default-adhkar.json # الأذكار الافتراضية

uploads/              # الملفات المرفوعة
├── audio/           # ملفات صوتية
├── pdf/            # ملفات PDF
└── images/         # الصور

backups/             # النسخ الاحتياطية
logs/               # سجلات النظام
admin/              # لوحة الإدارة
\`\`\`

## ⚠️ ملاحظات مهمة

1. يتم حفظ التغييرات تلقائياً كل 5 دقائق
2. النسخ الاحتياطية تلقائية يومياً
3. يمكن استعادة البيانات من النسخ الاحتياطية
4. جميع الملفات بصيغة JSON للسهولة

## 🆘 استكشاف الأخطاء

إذا واجهت مشاكل في قاعدة البيانات:

1. تحقق من صلاحيات الملفات
2. تأكد من وجود مساحة تخزين كافية
3. تحقق من سجلات الأخطاء في /logs
4. جرب إعادة تهيئة قاعدة البيانات

## 📞 الدعم

للمساعدة في مشاكل قاعدة البيانات، اتصل بالمطور:
- @dev3bod
- ${process.env.ADMIN_GROUP_ID || '-1003595290365'}
`;

    await fs.writeFile(path.join(dbPath, 'README.txt'), instructions);
    console.log('✅ تم إنشاء ملف التعليمات');
    
    console.log('\n🎉 تم تهيئة قاعدة البيانات المطورة بنجاح!');
    console.log('📁 الموقع:', dbPath);
    console.log('📊 الفئات المطورة:', Object.keys(enhancedAdhkar.categories || {}).length);
    console.log('📄 ملفات PDF:', (enhancedAdhkar.pdf_resources || []).length);
    console.log('🎵 روابط صوتية:', (enhancedAdhkar.audio_resources || []).length);
    
  } catch (error) {
    console.error('❌ خطأ في تهيئة قاعدة البيانات:', error);
    process.exit(1);
  }
}

initializeEnhancedDatabase();