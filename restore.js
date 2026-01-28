const fs = require('fs-extra');
const path = require('path');

async function restoreDatabase(backupFile) {
  console.log('🔄 بدء استعادة قاعدة البيانات...');
  
  try {
    const backupPath = path.join(__dirname, '..', 'backups', backupFile);
    
    if (!await fs.pathExists(backupPath)) {
      console.error(`❌ ملف النسخة الاحتياطية غير موجود: ${backupFile}`);
      console.log('📋 الملفات المتاحة:');
      const files = await fs.readdir(path.join(__dirname, '..', 'backups'));
      files.filter(f => f.endsWith('.json')).forEach(f => console.log(`   - ${f}`));
      return;
    }
    
    const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'));
    const dbPath = path.join(__dirname, '..', 'data', 'database');
    
    // حفظ الملفات المستعادة
    for (const [fileName, content] of Object.entries(backupData)) {
      const filePath = path.join(dbPath, `${fileName}.json`);
      await fs.writeJson(filePath, content, { spaces: 2 });
      console.log(`✅ تم استعادة ${fileName}.json`);
    }
    
    console.log('\n🎉 تم استعادة قاعدة البيانات بنجاح!');
    console.log(`📁 من: ${backupFile}`);
    console.log('📊 إلى: data/database/');
    
  } catch (error) {
    console.error('❌ خطأ في استعادة قاعدة البيانات:', error);
  }
}

// تشغيل الاستعادة
const backupFile = process.argv[2];
if (!backupFile) {
  console.error('❌ يرجى تحديد ملف النسخة الاحتياطية');
  console.log('📌 الاستخدام: node restore.js backup-file.json');
  process.exit(1);
}

restoreDatabase(backupFile);