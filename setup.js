require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs-extra');
const path = require('path');

async function setupDatabase() {
  console.log('🔧 بدء إعداد قاعدة البيانات...');
  
  try {
    // الاتصال بقاعدة البيانات
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/islamic_bot_v2');
    console.log('✅ تم الاتصال بقاعدة البيانات');
    
    // مسح المجموعات القديمة (اختياري)
    const { GroupSettings, UserSettings, CustomAdhkar, ReminderLog } = mongoose.models;
    
    await Promise.all([
      GroupSettings.deleteMany({}),
      UserSettings.deleteMany({}),
      CustomAdhkar.deleteMany({}),
      ReminderLog.deleteMany({})
    ]);
    
    console.log('🧹 تم تنظيف البيانات القديمة');
    
    // إنشاء المجموعة الإدارية
    const GroupSettings = mongoose.model('GroupSettings');
    await GroupSettings.create({
      chatId: process.env.ADMIN_GROUP_ID || '-1003595290365',
      chatTitle: 'المجموعة الإدارية',
      chatType: 'supergroup',
      enabled: true,
      addedBy: process.env.DEVELOPER_ID || '6960704733',
      isActive: true,
      settings: {
        morningAdhkar: true,
        eveningAdhkar: true,
        periodicAdhkar: true,
        fridayReminder: true,
        prayerTimeReminder: true,
        ramadanReminders: true,
        arafatReminder: true,
        eidReminders: true,
        ashuraReminder: true,
        lastTenNights: true,
        quranAudio: true,
        adhkarAudio: true,
        takbiratAudio: true,
        reminderInterval: 30,
        includeAudio: true,
        includePDF: true
      }
    });
    
    console.log('✅ تم إنشاء المجموعة الإدارية');
    
    // إنشاء حساب المطور
    const UserSettings = mongoose.model('UserSettings');
    await UserSettings.create({
      userId: process.env.DEVELOPER_ID || '6960704733',
      username: 'dev3bod',
      firstName: 'المطور',
      isDeveloper: true,
      isSuperAdmin: true,
      joinDate: new Date(),
      lastActive: new Date()
    });
    
    console.log('✅ تم إنشاء حساب المطور');
    
    // إنشاء دليل للوسائط
    const mediaDir = path.join(__dirname, 'media');
    await fs.ensureDir(mediaDir);
    await fs.ensureDir(path.join(mediaDir, 'audio'));
    await fs.ensureDir(path.join(mediaDir, 'pdf'));
    
    console.log('✅ تم إنشاء دليل الوسائط');
    
    console.log('\n🎉 تم إعداد النظام بنجاح!');
    console.log(`👤 المطور: ${process.env.DEVELOPER_ID}`);
    console.log(`👥 المجموعة الإدارية: ${process.env.ADMIN_GROUP_ID}`);
    console.log(`💾 قاعدة البيانات: ${process.env.MONGODB_URI}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ خطأ في إعداد قاعدة البيانات:', error);
    process.exit(1);
  }
}

setupDatabase();