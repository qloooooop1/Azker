const fs = require('fs-extra');
const path = require('path');

async function initializeDatabase() {
  try {
    const dbPath = path.join(__dirname, '..', 'data', 'database');
    
    // إنشاء المجلدات
    await fs.ensureDir(dbPath);
    await fs.ensureDir(path.join(__dirname, '..', 'uploads'));
    await fs.ensureDir(path.join(__dirname, '..', 'backups'));
    
    // ملفات قاعدة البيانات الافتراضية
    const defaultFiles = {
      'groups.json': {},
      'users.json': {},
      'adhkar.json': require('../data/default-adhkar.json'),
      'schedules.json': {},
      'media.json': {},
      'categories.json': {
        'morning': {
          id: 'morning',
          name: 'أذكار الصباح',
          icon: '🌅',
          enabled: true
        },
        'evening': {
          id: 'evening',
          name: 'أذكار المساء',
          icon: '🌇',
          enabled: true
        },
        'friday': {
          id: 'friday',
          name: 'يوم الجمعة',
          icon: '🕌',
          enabled: true
        },
        'ramadan': {
          id: 'ramadan',
          name: 'شهر رمضان',
          icon: '🌙',
          enabled: true
        },
        'eid': {
          id: 'eid',
          name: 'الأعياد',
          icon: '🎉',
          enabled: true
        },
        'random': {
          id: 'random',
          name: 'أذكار دورية',
          icon: '🔄',
          enabled: true
        }
      },
      'broadcasts.json': {}
    };
    
    // حفظ الملفات
    for (const [fileName, content] of Object.entries(defaultFiles)) {
      const filePath = path.join(dbPath, fileName);
      await fs.writeJson(filePath, content, { spaces: 2 });
      console.log(`✅ تم إنشاء ${fileName}`);
    }
    
    console.log('\n🎉 تم تهيئة قاعدة البيانات بنجاح!');
    console.log('📁 الموقع:', dbPath);
    
  } catch (error) {
    console.error('❌ خطأ في تهيئة قاعدة البيانات:', error);
    process.exit(1);
  }
}

initializeDatabase();