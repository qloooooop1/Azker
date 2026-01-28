const fs = require('fs-extra');
const path = require('path');

async function createBackup() {
  console.log('💾 بدء إنشاء نسخة احتياطية...');
  
  try {
    const dbPath = path.join(__dirname, '..', 'data', 'database');
    const backupDir = path.join(__dirname, '..', 'backups');
    
    await fs.ensureDir(backupDir);
    
    // قراءة جميع ملفات قاعدة البيانات
    const files = ['groups', 'users', 'adhkar', 'schedules', 'media', 'categories', 'broadcasts', 'streams'];
    const backupData = {};
    
    for (const file of files) {
      const filePath = path.join(dbPath, `${file}.json`);
      if (await fs.pathExists(filePath)) {
        backupData[file] = JSON.parse(await fs.readFile(filePath, 'utf8'));
      }
    }
    
    // إنشاء اسم الملف مع التاريخ
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `backup-${timestamp}.json`;
    const backupPath = path.join(backupDir, backupFile);
    
    // حفظ النسخة الاحتياطية
    await fs.writeJson(backupPath, backupData, { spaces: 2 });
    
    // حذف النسخ القديمة (احتفظ بآخر 10 نسخ)
    const backupFiles = (await fs.readdir(backupDir))
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    if (backupFiles.length > 10) {
      for (let i = 10; i < backupFiles.length; i++) {
        await fs.remove(path.join(backupDir, backupFiles[i]));
        console.log(`🗑️ تم حذف نسخة قديمة: ${backupFiles[i]}`);
      }
    }
    
    console.log('✅ تم إنشاء نسخة احتياطية بنجاح!');
    console.log(`📁 الموقع: ${backupPath}`);
    console.log(`📊 الملفات: ${files.length}`);
    console.log(`💾 إجمالي النسخ: ${Math.min(backupFiles.length, 10)}`);
    
  } catch (error) {
    console.error('❌ خطأ في إنشاء النسخة الاحتياطية:', error);
  }
}

// تشغيل النسخ الاحتياطي
createBackup();