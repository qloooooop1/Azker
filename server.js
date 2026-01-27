require('dotenv').config();

console.log(`
╔══════════════════════════════════════════════════════════╗
║        🕌 بوت الأذكار الإسلامي - النظام المتكامل        ║
║        الإصدار: 4.0.0 - لوحة تحكم متقدمة                ║
║        المطور: @dev3bod                                 ║
║        الوقت: ${new Date().toLocaleString('ar-SA')}     ║
╚══════════════════════════════════════════════════════════╝
`);

const express = require('express');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment-timezone');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// إعدادات الوقت
moment.tz.setDefault(process.env.TIMEZONE || 'Asia/Riyadh');

// إعدادات Express
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static('uploads'));

// تسجيل الطلبات
app.use((req, res, next) => {
  const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

// ==================== قاعدة البيانات ====================
const dbPath = path.join(__dirname, 'data', 'database');
const db = {
  groups: {},
  users: {},
  adhkar: {},
  schedules: {},
  media: {},
  categories: {},
  broadcasts: {}
};

// تحميل قاعدة البيانات
async function loadDatabase() {
  try {
    await fs.ensureDir(dbPath);
    
    const files = ['groups', 'users', 'adhkar', 'schedules', 'media', 'categories', 'broadcasts'];
    
    for (const file of files) {
      const filePath = path.join(dbPath, `${file}.json`);
      if (await fs.pathExists(filePath)) {
        db[file] = JSON.parse(await fs.readFile(filePath, 'utf8'));
        console.log(`✅ تم تحميل ${file}: ${Object.keys(db[file]).length} عنصر`);
      }
    }
    
    // تهيئة بيانات افتراضية
    await initializeDefaultData();
    
    console.log('📊 قاعدة البيانات جاهزة');
    return true;
  } catch (error) {
    console.error('❌ خطأ في تحميل قاعدة البيانات:', error);
    return false;
  }
}

// حفظ قاعدة البيانات
async function saveDatabase() {
  try {
    await fs.ensureDir(dbPath);
    
    const files = ['groups', 'users', 'adhkar', 'schedules', 'media', 'categories', 'broadcasts'];
    
    for (const file of files) {
      const filePath = path.join(dbPath, `${file}.json`);
      await fs.writeFile(filePath, JSON.stringify(db[file], null, 2));
    }
    
    console.log('💾 تم حفظ قاعدة البيانات');
    return true;
  } catch (error) {
    console.error('❌ خطأ في حفظ قاعدة البيانات:', error);
    return false;
  }
}

// تهيئة البيانات الافتراضية
async function initializeDefaultData() {
  // فئات افتراضية
  if (Object.keys(db.categories).length === 0) {
    db.categories = {
      'morning': {
        id: 'morning',
        name: 'أذكار الصباح',
        description: 'أذكار الصباح من كتاب حصن المسلم',
        enabled: true,
        icon: '🌅',
        color: '#FFD700'
      },
      'evening': {
        id: 'evening',
        name: 'أذكار المساء',
        description: 'أذكار المساء من كتاب حصن المسلم',
        enabled: true,
        icon: '🌇',
        color: '#4169E1'
      },
      'friday': {
        id: 'friday',
        name: 'يوم الجمعة',
        description: 'أذكار وتذكيرات يوم الجمعة',
        enabled: true,
        icon: '🕌',
        color: '#32CD32'
      },
      'random': {
        id: 'random',
        name: 'أذكار دورية',
        description: 'أذكار عشوائية خلال اليوم',
        enabled: true,
        icon: '🔄',
        color: '#9370DB'
      }
    };
  }
  
  // أذكار افتراضية
  if (Object.keys(db.adhkar).length === 0) {
    try {
      const defaultAdhkarPath = path.join(__dirname, 'data', 'default-adhkar.json');
      if (await fs.pathExists(defaultAdhkarPath)) {
        db.adhkar = JSON.parse(await fs.readFile(defaultAdhkarPath, 'utf8'));
      } else {
        // إنشاء بيانات افتراضية بسيطة
        db.adhkar = {
          'morning_001': {
            id: 'morning_001',
            title: 'أذكار الصباح',
            text: 'أصبحنا وأصبح الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير',
            category: 'morning',
            source: 'حصن المسلم',
            enabled: true
          }
        };
      }
    } catch (error) {
      console.log('⚠️ استخدام أذكار افتراضية بسيطة');
      db.adhkar = {
        'morning_001': {
          id: 'morning_001',
          title: 'أذكار الصباح',
          text: 'أصبحنا وأصبح الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له',
          category: 'morning',
          source: 'حصن المسلم',
          enabled: true
        }
      };
    }
  }
  
  // إعدادات افتراضية للمجموعات
  if (Object.keys(db.groups).length === 0) {
    db.groups['default'] = {
      id: 'default',
      name: 'إعدادات افتراضية',
      settings: {
        morningAdhkar: true,
        eveningAdhkar: true,
        randomAdhkar: true,
        fridayReminder: true,
        randomInterval: 120,
        morningTime: '06:00',
        eveningTime: '18:00',
        includeAudio: true,
        includePDF: true,
        active: true
      }
    };
  }
}

// ==================== دوال تليجرام ====================

async function sendTelegramMessage(chatId, text, options = {}) {
  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: options.parse_mode || 'HTML',
      disable_web_page_preview: options.disable_preview || true
    };
    
    if (options.reply_markup) {
      payload.reply_markup = options.reply_markup;
    }
    
    const response = await axios.post(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
      payload
    );
    
    return response.data;
  } catch (error) {
    console.error('❌ خطأ في إرسال رسالة:', error.response?.data || error.message);
    return null;
  }
}

async function editMessageReplyMarkup(chatId, messageId, replyMarkup) {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/editMessageReplyMarkup`,
      {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: replyMarkup
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('❌ خطأ في تعديل الرسالة:', error.message);
    return null;
  }
}

// ==================== لوحة تحكم المشرفين ====================

async function handleAdminStart(chatId, userId, groupId, username) {
  try {
    // التحقق من صلاحيات المشرف
    const isAdmin = await checkAdminPermissions(userId, groupId);
    
    if (!isAdmin) {
      await sendTelegramMessage(
        userId,
        '⛔ *ليس لديك صلاحية الوصول إلى لوحة التحكم*\n\n' +
        'يجب أن تكون مشرفاً في المجموعة للوصول إلى هذه اللوحة.',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    // تسجيل المستخدم
    if (!db.users[userId]) {
      db.users[userId] = {
        id: userId,
        username: username,
        isDeveloper: userId.toString() === process.env.DEVELOPER_ID,
        isSuperAdmin: false,
        managedGroups: [groupId],
        joinDate: new Date().toISOString(),
        lastActive: new Date().toISOString()
      };
    }
    
    // تسجيل المجموعة
    if (!db.groups[groupId]) {
      db.groups[groupId] = {
        id: groupId,
        title: `المجموعة ${groupId}`,
        addedBy: userId,
        addedDate: new Date().toISOString(),
        admins: [userId.toString()],
        settings: { ...db.groups['default'].settings }
      };
    }
    
    // إرسال لوحة التحكم
    await sendAdminDashboard(userId, groupId);
    
  } catch (error) {
    console.error('خطأ في handleAdminStart:', error);
    await sendTelegramMessage(
      userId,
      '❌ حدث خطأ في فتح لوحة التحكم. حاول مرة أخرى.'
    );
  }
}

async function sendAdminDashboard(userId, groupId) {
  try {
    const group = db.groups[groupId];
    if (!group) return;
    
    const settings = group.settings || db.groups['default'].settings;
    
    const message = `🎛️ *لوحة تحكم المشرف*\n\n` +
      `📝 *${group.title || 'المجموعة'}*\n\n` +
      `⚙️ *الإعدادات الحالية:*\n` +
      `🌅 أذكار الصباح: ${settings.morningAdhkar ? '✅' : '❌'}\n` +
      `🌇 أذكار المساء: ${settings.eveningAdhkar ? '✅' : '❌'}\n` +
      `🔄 أذكار دورية: ${settings.randomAdhkar ? '✅' : '❌'}\n` +
      `🕌 تذكير الجمعة: ${settings.fridayReminder ? '✅' : '❌'}\n\n` +
      `⏰ *الفاصل الزمني:* ${settings.randomInterval} دقيقة\n` +
      `🕐 توقيت الصباح: ${settings.morningTime}\n` +
      `🕐 توقيت المساء: ${settings.eveningTime}\n\n` +
      `🎧 *الوسائط:*\n` +
      `🔊 الصوتيات: ${settings.includeAudio ? '✅' : '❌'}\n` +
      `📄 ملفات PDF: ${settings.includePDF ? '✅' : '❌'}\n\n` +
      `🔧 *اختر الإعداد الذي تريد تعديله:*`;
    
    await sendTelegramMessage(
      userId,
      message,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: `${settings.morningAdhkar ? '✅' : '❌'} الصباح`, callback_data: `toggle_morning_${groupId}` },
              { text: `${settings.eveningAdhkar ? '✅' : '❌'} المساء`, callback_data: `toggle_evening_${groupId}` }
            ],
            [
              { text: `${settings.randomAdhkar ? '✅' : '❌'} دورية`, callback_data: `toggle_random_${groupId}` },
              { text: `${settings.fridayReminder ? '✅' : '❌'} الجمعة`, callback_data: `toggle_friday_${groupId}` }
            ],
            [
              { text: '⏱️ الفاصل الزمني', callback_data: `set_interval_${groupId}` },
              { text: '🕐 تعديل التوقيت', callback_data: `set_time_${groupId}` }
            ],
            [
              { text: `${settings.includeAudio ? '✅' : '❌'} صوتيات`, callback_data: `toggle_audio_${groupId}` },
              { text: `${settings.includePDF ? '✅' : '❌'} PDF`, callback_data: `toggle_pdf_${groupId}` }
            ],
            [
              { text: '📊 إحصائيات', callback_data: `stats_${groupId}` },
              { text: '🔄 إعادة تعيين', callback_data: `reset_${groupId}` }
            ]
          ]
        }
      }
    );
    
  } catch (error) {
    console.error('خطأ في sendAdminDashboard:', error);
  }
}

async function checkAdminPermissions(userId, groupId) {
  try {
    // المطور لديه جميع الصلاحيات
    if (userId.toString() === process.env.DEVELOPER_ID) {
      return true;
    }
    
    // التحقق من قاعدة البيانات المحلية
    if (db.groups[groupId] && db.groups[groupId].admins) {
      return db.groups[groupId].admins.includes(userId.toString());
    }
    
    // التحقق من تليجرام (اختياري)
    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getChatMember`,
        {
          chat_id: groupId,
          user_id: userId
        }
      );
      
      const status = response.data.result.status;
      return ['administrator', 'creator'].includes(status);
      
    } catch (telegramError) {
      console.log('⚠️ استخدام قاعدة البيانات المحلية للصلاحيات');
      return false;
    }
    
  } catch (error) {
    console.error('خطأ في التحقق من الصلاحيات:', error.message);
    return false;
  }
}

// ==================== لوحة تحكم المطور ====================

async function sendDeveloperPanel(userId) {
  try {
    const stats = await getSystemStats();
    
    const message = `👑 *لوحة تحكم المطور*\n\n` +
      `📊 *إحصائيات النظام:*\n` +
      `👥 المجموعات: ${stats.groups}\n` +
      `👤 المستخدمين: ${stats.users}\n` +
      `🕌 الأذكار: ${stats.adhkar}\n` +
      `📅 مجدول: ${stats.scheduled}\n` +
      `🎧 وسائط: ${stats.media}\n\n` +
      `⚡ *أدوات النظام:*\n` +
      `1. إدارة المحتوى (JSON)\n` +
      `2. إدارة الوسائط\n` +
      `3. البث والجدولة\n` +
      `4. الأقسام والفئات\n` +
      `5. الإحصائيات والتقارير\n` +
      `6. النسخ الاحتياطي\n\n` +
      `🔧 *اختر القسم:*`;
    
    await sendTelegramMessage(
      userId,
      message,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📝 إدارة المحتوى', callback_data: 'dev_content' },
              { text: '🎧 الوسائط', callback_data: 'dev_media' }
            ],
            [
              { text: '📨 البث المتقدم', callback_data: 'dev_broadcast' },
              { text: '📂 الأقسام', callback_data: 'dev_categories' }
            ],
            [
              { text: '📊 التقارير', callback_data: 'dev_reports' },
              { text: '💾 النسخ الاحتياطي', callback_data: 'dev_backup' }
            ],
            [
              { text: '⚙️ إعدادات النظام', callback_data: 'dev_settings' },
              { text: '🔄 جدولة متقدمة', callback_data: 'dev_scheduling' }
            ]
          ]
        }
      }
    );
    
  } catch (error) {
    console.error('خطأ في sendDeveloperPanel:', error);
  }
}

async function getSystemStats() {
  return {
    groups: Object.keys(db.groups).length,
    users: Object.keys(db.users).length,
    adhkar: Object.keys(db.adhkar).length,
    scheduled: Object.keys(db.schedules).length,
    media: Object.keys(db.media).length,
    categories: Object.keys(db.categories).length
  };
}

// ==================== معالجة Callback Queries ====================

async function handleCallbackQuery(userId, data, messageId) {
  console.log(`📲 Callback: ${data} from ${userId}`);
  
  try {
    const parts = data.split('_');
    const action = parts[0];
    const target = parts[1];
    const param = parts.slice(2).join('_');
    
    switch(action) {
      case 'toggle':
        await handleToggleAction(userId, target, param, messageId);
        break;
        
      case 'set':
        await handleSetAction(userId, target, param, messageId);
        break;
        
      case 'stats':
        await handleStatsAction(userId, param, messageId);
        break;
        
      case 'reset':
        await handleResetAction(userId, param, messageId);
        break;
        
      case 'dev':
        await handleDevAction(userId, target, messageId);
        break;
        
      default:
        console.log(`⚠️ إجراء غير معروف: ${action}`);
    }
    
    await saveDatabase();
    
  } catch (error) {
    console.error('❌ خطأ في معالجة callback:', error);
    await sendTelegramMessage(
      userId,
      `❌ حدث خطأ: ${error.message}`,
      { parse_mode: 'HTML' }
    );
  }
}

async function handleToggleAction(userId, type, groupId, messageId) {
  try {
    const group = db.groups[groupId];
    if (!group) {
      await sendTelegramMessage(userId, '❌ المجموعة غير موجودة');
      return;
    }
    
    if (!group.settings) {
      group.settings = { ...db.groups['default'].settings };
    }
    
    let message = '';
    let newValue = false;
    
    switch(type) {
      case 'morning':
        newValue = !group.settings.morningAdhkar;
        group.settings.morningAdhkar = newValue;
        message = `✅ تم ${newValue ? 'تفعيل' : 'تعطيل'} أذكار الصباح`;
        break;
        
      case 'evening':
        newValue = !group.settings.eveningAdhkar;
        group.settings.eveningAdhkar = newValue;
        message = `✅ تم ${newValue ? 'تفعيل' : 'تعطيل'} أذكار المساء`;
        break;
        
      case 'random':
        newValue = !group.settings.randomAdhkar;
        group.settings.randomAdhkar = newValue;
        message = `✅ تم ${newValue ? 'تفعيل' : 'تعطيل'} الأذكار الدورية`;
        break;
        
      case 'friday':
        newValue = !group.settings.fridayReminder;
        group.settings.fridayReminder = newValue;
        message = `✅ تم ${newValue ? 'تفعيل' : 'تعطيل'} تذكير الجمعة`;
        break;
        
      case 'audio':
        newValue = !group.settings.includeAudio;
        group.settings.includeAudio = newValue;
        message = `✅ تم ${newValue ? 'تفعيل' : 'تعطيل'} الصوتيات`;
        break;
        
      case 'pdf':
        newValue = !group.settings.includePDF;
        group.settings.includePDF = newValue;
        message = `✅ تم ${newValue ? 'تفعيل' : 'تعطيل'} ملفات PDF`;
        break;
        
      default:
        message = '❌ نوع غير معروف';
    }
    
    await sendTelegramMessage(userId, message);
    await sendAdminDashboard(userId, groupId);
    
  } catch (error) {
    console.error('خطأ في handleToggleAction:', error);
    await sendTelegramMessage(userId, '❌ حدث خطأ في التعديل');
  }
}

async function handleSetAction(userId, type, groupId, messageId) {
  try {
    const group = db.groups[groupId];
    if (!group) {
      await sendTelegramMessage(userId, '❌ المجموعة غير موجودة');
      return;
    }
    
    let message = '';
    
    switch(type) {
      case 'interval':
        message = '⏱️ *تحديد الفاصل الزمني*\n\n' +
                 'أرسل عدد الدقائق بين كل ذكر وآخر (مثال: 120)\n' +
                 'الحد الأدنى: 30 دقيقة\n' +
                 'الحد الأقصى: 1440 دقيقة (24 ساعة)';
        break;
        
      case 'time':
        message = '🕐 *تعديل التوقيت*\n\n' +
                 'أرسل التوقيت بالتنسيق 24 ساعة (مثال: 06:00)\n\n' +
                 '1. توقيت الصباح\n' +
                 '2. توقيت المساء\n\n' +
                 'أرسل "صباح 06:00" أو "مساء 18:00"';
        break;
        
      default:
        message = '❌ نوع غير معروف';
    }
    
    // حفظ حالة المستخدم للرد التالي
    if (!db.users[userId].pendingAction) {
      db.users[userId].pendingAction = {};
    }
    db.users[userId].pendingAction = {
      type: `set_${type}`,
      groupId: groupId,
      messageId: messageId
    };
    
    await sendTelegramMessage(userId, message, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('خطأ في handleSetAction:', error);
    await sendTelegramMessage(userId, '❌ حدث خطأ في الإعداد');
  }
}

async function handleDevAction(userId, target, messageId) {
  try {
    switch(target) {
      case 'content':
        await sendContentManagement(userId);
        break;
        
      case 'media':
        await sendMediaManagement(userId);
        break;
        
      case 'broadcast':
        await sendBroadcastPanel(userId);
        break;
        
      case 'categories':
        await sendCategoriesManagement(userId);
        break;
        
      case 'reports':
        await sendReportsPanel(userId);
        break;
        
      case 'backup':
        await sendBackupPanel(userId);
        break;
        
      case 'settings':
        await sendSystemSettings(userId);
        break;
        
      case 'scheduling':
        await sendAdvancedScheduling(userId);
        break;
        
      default:
        await sendDeveloperPanel(userId);
    }
    
  } catch (error) {
    console.error('خطأ في handleDevAction:', error);
    await sendTelegramMessage(userId, '❌ حدث خطأ في فتح اللوحة');
  }
}

async function sendContentManagement(userId) {
  try {
    const message = `📝 *إدارة المحتوى*\n\n` +
      `يمكنك إدارة المحتوى عبر:\n\n` +
      `1. رفع ملفات JSON\n` +
      `2. إضافة أذكار يدوياً\n` +
      `3. تعديل المحتوى الحالي\n` +
      `4. حذف المحتوى\n\n` +
      `🔧 *اختر الإجراء:*`;
    
    await sendTelegramMessage(
      userId,
      message,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📤 رفع JSON', callback_data: 'upload_json' },
              { text: '➕ إضافة يدوي', callback_data: 'add_manual' }
            ],
            [
              { text: '✏️ تعديل', callback_data: 'edit_content' },
              { text: '🗑️ حذف', callback_data: 'delete_content' }
            ],
            [
              { text: '📋 تصدير', callback_data: 'export_content' },
              { text: '◀️ رجوع', callback_data: 'dev_back' }
            ]
          ]
        }
      }
    );
    
  } catch (error) {
    console.error('خطأ في sendContentManagement:', error);
  }
}

async function sendMediaManagement(userId) {
  try {
    const message = `🎧 *إدارة الوسائط*\n\n` +
      `أنواع الوسائط المدعومة:\n\n` +
      `🎵 الصوتيات (MP3, OGG)\n` +
      `📄 ملفات PDF\n` +
      `🖼️ الصور (JPG, PNG)\n\n` +
      `🔧 *اختر الإجراء:*`;
    
    await sendTelegramMessage(
      userId,
      message,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🎵 رفع صوت', callback_data: 'upload_audio' },
              { text: '📄 رفع PDF', callback_data: 'upload_pdf' }
            ],
            [
              { text: '📋 الوسائط', callback_data: 'list_media' },
              { text: '🔗 روابط', callback_data: 'media_links' }
            ],
            [
              { text: '◀️ رجوع', callback_data: 'dev_back' }
            ]
          ]
        }
      }
    );
    
  } catch (error) {
    console.error('خطأ في sendMediaManagement:', error);
  }
}

async function sendBroadcastPanel(userId) {
  try {
    const message = `📨 *نظام البث*\n\n` +
      `أنواع البث المتاحة:\n\n` +
      `🚀 بث فوري\n` +
      `📅 بث مجدول\n` +
      `🔄 بث متكرر\n` +
      `🎯 بث شرطي\n\n` +
      `🔧 *اختر نوع البث:*`;
    
    await sendTelegramMessage(
      userId,
      message,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🚀 فوري', callback_data: 'broadcast_now' },
              { text: '📅 مجدول', callback_data: 'broadcast_scheduled' }
            ],
            [
              { text: '🔄 متكرر', callback_data: 'broadcast_recurring' },
              { text: '🎯 شرطي', callback_data: 'broadcast_conditional' }
            ],
            [
              { text: '📊 إحصائيات', callback_data: 'broadcast_stats' },
              { text: '◀️ رجوع', callback_data: 'dev_back' }
            ]
          ]
        }
      }
    );
    
  } catch (error) {
    console.error('خطأ في sendBroadcastPanel:', error);
  }
}

// ==================== Webhook Handler ====================

app.post('/webhook', express.json(), async (req, res) => {
  try {
    const update = req.body;
    
    if (update.message) {
      await handleMessage(update.message);
    }
    
    if (update.callback_query) {
      await handleCallbackUpdate(update.callback_query);
    }
    
    res.json({ ok: true });
    
  } catch (error) {
    console.error('❌ خطأ في webhook:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

async function handleMessage(message) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text || '';
  const username = message.from.username || message.from.first_name;
  const isGroup = message.chat.type !== 'private';
  
  try {
    // تحديث آخر نشاط
    if (!db.users[userId]) {
      db.users[userId] = {
        id: userId,
        username: username,
        isDeveloper: userId.toString() === process.env.DEVELOPER_ID,
        lastActive: new Date().toISOString(),
        joinDate: new Date().toISOString()
      };
    } else {
      db.users[userId].lastActive = new Date().toISOString();
    }
    
    // معالجة الأوامر
    if (text.startsWith('/')) {
      const command = text.split(' ')[0].toLowerCase();
      
      switch(command) {
        case '/start':
          if (isGroup) {
            await handleAdminStart(chatId, userId, chatId.toString(), username);
          } else {
            if (userId.toString() === process.env.DEVELOPER_ID) {
              await sendDeveloperPanel(userId);
            } else {
              await sendTelegramMessage(
                chatId,
                '🕌 *مرحباً بك في بوت الأذكار الإسلامي*\n\n' +
                'هذا البوت مخصص للمجموعات فقط.\n' +
                'أضف البوت إلى مجموعتك ثم أرسل /start لفتح لوحة التحكم.',
                { parse_mode: 'Markdown' }
              );
            }
          }
          break;
          
        case '/dev':
        case '/developer':
          if (userId.toString() === process.env.DEVELOPER_ID) {
            await sendDeveloperPanel(userId);
          }
          break;
          
        case '/help':
          await sendHelpMessage(chatId, userId);
          break;
          
        case '/test':
          await sendTelegramMessage(
            chatId,
            '✅ البوت يعمل بنجاح!\n' +
            '👤 المطور: @dev3bod\n' +
            '🕌 الإصدار: 4.0.0',
            { parse_mode: 'Markdown' }
          );
          break;
      }
    } else {
      // معالجة ردود المستخدمين
      await handleUserResponse(userId, text);
    }
    
  } catch (error) {
    console.error('خطأ في handleMessage:', error);
  }
}

async function handleUserResponse(userId, text) {
  try {
    const user = db.users[userId];
    if (!user || !user.pendingAction) return;
    
    const action = user.pendingAction;
    
    switch(action.type) {
      case 'set_interval':
        await handleSetIntervalResponse(userId, text, action.groupId);
        break;
        
      case 'set_time':
        await handleSetTimeResponse(userId, text, action.groupId);
        break;
    }
    
    // مسح الإجراء المعلّق
    delete user.pendingAction;
    
  } catch (error) {
    console.error('خطأ في handleUserResponse:', error);
  }
}

async function handleSetIntervalResponse(userId, text, groupId) {
  try {
    const minutes = parseInt(text);
    
    if (isNaN(minutes) || minutes < 30 || minutes > 1440) {
      await sendTelegramMessage(
        userId,
        '❌ الرقم غير صالح. يرجى إدخال عدد دقائق بين 30 و 1440'
      );
      return;
    }
    
    const group = db.groups[groupId];
    if (group) {
      group.settings.randomInterval = minutes;
      await sendTelegramMessage(
        userId,
        `✅ تم تعيين الفاصل الزمني إلى ${minutes} دقيقة`
      );
      await sendAdminDashboard(userId, groupId);
    }
    
  } catch (error) {
    console.error('خطأ في handleSetIntervalResponse:', error);
  }
}

async function handleSetTimeResponse(userId, text, groupId) {
  try {
    const parts = text.split(' ');
    if (parts.length !== 2) {
      await sendTelegramMessage(
        userId,
        '❌ تنسيق غير صالح. استخدم: "صباح 06:00" أو "مساء 18:00"'
      );
      return;
    }
    
    const type = parts[0];
    const time = parts[1];
    
    // التحقق من تنسيق الوقت
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(time)) {
      await sendTelegramMessage(userId, '❌ تنسيق الوقت غير صالح. استخدم: HH:MM');
      return;
    }
    
    const group = db.groups[groupId];
    if (group) {
      if (type === 'صباح' || type === 'morning') {
        group.settings.morningTime = time;
        await sendTelegramMessage(userId, `✅ تم تعيين وقت الصباح إلى ${time}`);
      } else if (type === 'مساء' || type === 'evening') {
        group.settings.eveningTime = time;
        await sendTelegramMessage(userId, `✅ تم تعيين وقت المساء إلى ${time}`);
      } else {
        await sendTelegramMessage(userId, '❌ نوع غير معروف. استخدم "صباح" أو "مساء"');
        return;
      }
      
      await sendAdminDashboard(userId, groupId);
    }
    
  } catch (error) {
    console.error('خطأ في handleSetTimeResponse:', error);
  }
}

async function handleCallbackUpdate(callback) {
  const userId = callback.from.id;
  const data = callback.data;
  const messageId = callback.message.message_id;
  
  try {
    await handleCallbackQuery(userId, data, messageId);
    
    // إجابة على callback
    await axios.post(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/answerCallbackQuery`,
      {
        callback_query_id: callback.id
      }
    );
    
  } catch (error) {
    console.error('❌ خطأ في معالجة callback:', error.message);
  }
}

async function sendHelpMessage(chatId, userId) {
  const isDeveloper = userId.toString() === process.env.DEVELOPER_ID;
  
  let helpText = `📚 *مساعدة - بوت الأذكار الإسلامي*\n\n`;
  
  if (isDeveloper) {
    helpText += `👑 *أوامر المطور:*\n`;
    helpText += `/dev - لوحة التحكم المتقدمة\n`;
    helpText += `/test - اختبار البوت\n\n`;
  }
  
  helpText += `⚙️ *أوامر المشرفين:*\n`;
  helpText += `أرسل /start في المجموعة\n`;
  helpText += `سيرسل لك البوت لوحة التحكم في الخاص\n\n`;
  
  helpText += `🕌 *مميزات البوت:*\n`;
  helpText += `• أذكار الصباح والمساء\n`;
  helpText += `• أذكار دورية عشوائية\n`;
  helpText += `• تذكير يوم الجمعة\n`;
  helpText += `• تحكم كامل في الإعدادات\n\n`;
  
  helpText += `👤 *المطور:* @dev3bod\n`;
  helpText += `📞 *الدعم:* ${process.env.DEVELOPER_ID || '6960704733'}`;
  
  await sendTelegramMessage(chatId, helpText, { parse_mode: 'Markdown' });
}

// ==================== نظام الجدولة ====================

function setupScheduler() {
  try {
    // أذكار الصباح
    cron.schedule('0 6 * * *', async () => {
      await sendMorningAdhkar();
    });
    
    // أذكار المساء
    cron.schedule('0 18 * * *', async () => {
      await sendEveningAdhkar();
    });
    
    // أذكار دورية كل ساعة
    cron.schedule('0 * * * *', async () => {
      await sendRandomAdhkar();
    });
    
    // يوم الجمعة
    cron.schedule('0 11 * * 5', async () => {
      await sendFridayReminder();
    });
    
    console.log('⏰ تم إعداد الجدولة');
    
  } catch (error) {
    console.error('❌ خطأ في إعداد الجدولة:', error);
  }
}

async function sendMorningAdhkar() {
  try {
    const groups = Object.values(db.groups).filter(g => 
      g.settings && g.settings.morningAdhkar && g.settings.active !== false
    );
    
    console.log(`🌅 إرسال أذكار الصباح لـ ${groups.length} مجموعة`);
    
    for (const group of groups) {
      const adhkar = Object.values(db.adhkar).filter(a => 
        a.category === 'morning' && a.enabled !== false
      );
      
      if (adhkar.length > 0) {
        const randomAdhkar = adhkar[Math.floor(Math.random() * adhkar.length)];
        await sendAdhkarToGroup(group.id, randomAdhkar, 'morning');
      }
    }
    
  } catch (error) {
    console.error('❌ خطأ في إرسال أذكار الصباح:', error);
  }
}

async function sendEveningAdhkar() {
  try {
    const groups = Object.values(db.groups).filter(g => 
      g.settings && g.settings.eveningAdhkar && g.settings.active !== false
    );
    
    console.log(`🌇 إرسال أذكار المساء لـ ${groups.length} مجموعة`);
    
    for (const group of groups) {
      const adhkar = Object.values(db.adhkar).filter(a => 
        a.category === 'evening' && a.enabled !== false
      );
      
      if (adhkar.length > 0) {
        const randomAdhkar = adhkar[Math.floor(Math.random() * adhkar.length)];
        await sendAdhkarToGroup(group.id, randomAdhkar, 'evening');
      }
    }
    
  } catch (error) {
    console.error('❌ خطأ في إرسال أذكار المساء:', error);
  }
}

async function sendRandomAdhkar() {
  try {
    const groups = Object.values(db.groups).filter(g => 
      g.settings && g.settings.randomAdhkar && g.settings.active !== false
    );
    
    console.log(`🔄 إرسال أذكار دورية لـ ${groups.length} مجموعة`);
    
    for (const group of groups) {
      const adhkar = Object.values(db.adhkar).filter(a => a.enabled !== false);
      
      if (adhkar.length > 0) {
        const randomAdhkar = adhkar[Math.floor(Math.random() * adhkar.length)];
        await sendAdhkarToGroup(group.id, randomAdhkar, 'random');
      }
    }
    
  } catch (error) {
    console.error('❌ خطأ في إرسال أذكار دورية:', error);
  }
}

async function sendFridayReminder() {
  try {
    const groups = Object.values(db.groups).filter(g => 
      g.settings && g.settings.fridayReminder && g.settings.active !== false
    );
    
    console.log(`🕌 إرسال تذكير الجمعة لـ ${groups.length} مجموعة`);
    
    for (const group of groups) {
      const adhkar = Object.values(db.adhkar).filter(a => 
        a.category === 'friday' && a.enabled !== false
      );
      
      if (adhkar.length > 0) {
        const randomAdhkar = adhkar[Math.floor(Math.random() * adhkar.length)];
        await sendAdhkarToGroup(group.id, randomAdhkar, 'friday');
      } else {
        // رسالة افتراضية ليوم الجمعة
        await sendTelegramMessage(
          group.id,
          `🕌 *يوم الجمعة المبارك*\n\n` +
          `• قراءة سورة الكهف لها فضل عظيم\n` +
          `• فيه ساعة إجابة فأكثروا من الدعاء\n` +
          `• الصلاة على النبي ﷺ\n\n` +
          `✨ @${process.env.BOT_USERNAME || 'islamic_adhkar_bot'}`,
          { parse_mode: 'Markdown' }
        );
      }
    }
    
  } catch (error) {
    console.error('❌ خطأ في إرسال تذكير الجمعة:', error);
  }
}

async function sendAdhkarToGroup(groupId, adhkar, type) {
  try {
    const group = db.groups[groupId];
    if (!group) return;
    
    let message = `🕌 *${adhkar.title || 'ذكر'}*\n\n${adhkar.text}\n\n`;
    
    if (adhkar.source) {
      message += `📖 ${adhkar.source}\n\n`;
    }
    
    message += `✨ @${process.env.BOT_USERNAME || 'islamic_adhkar_bot'}`;
    
    await sendTelegramMessage(groupId, message, { parse_mode: 'Markdown' });
    
    // تسجيل في السجل
    if (!db.schedules[groupId]) {
      db.schedules[groupId] = [];
    }
    
    db.schedules[groupId].push({
      id: uuidv4(),
      adhkarId: adhkar.id,
      type: type,
      sentAt: new Date().toISOString(),
      success: true
    });
    
    // حفظ قاعدة البيانات
    await saveDatabase();
    
  } catch (error) {
    console.error(`❌ خطأ في إرسال ذكر للمجموعة ${groupId}:`, error.message);
  }
}

// ==================== API Routes ====================

app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>بوت الأذكار الإسلامي - النظام المتكامل</title>
    <style>
        * { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box; 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
        }
        body { 
            background: linear-gradient(135deg, #1a2980 0%, #26d0ce 100%); 
            color: white; 
            min-height: 100vh; 
            padding: 40px 20px; 
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
        }
        .header { 
            text-align: center; 
            margin-bottom: 50px; 
        }
        h1 { 
            font-size: 3.5em; 
            color: #FFD700; 
            margin-bottom: 20px; 
            text-shadow: 3px 3px 6px rgba(0,0,0,0.3); 
        }
        .subtitle { 
            font-size: 1.2em; 
            opacity: 0.9; 
            margin-bottom: 30px; 
        }
        .stats-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 25px; 
            margin: 40px 0; 
        }
        .stat-card { 
            background: rgba(255,255,255,0.1); 
            backdrop-filter: blur(10px); 
            padding: 30px; 
            border-radius: 20px; 
            border: 1px solid rgba(255,255,255,0.2); 
            text-align: center; 
            transition: transform 0.3s; 
        }
        .stat-card:hover { 
            transform: translateY(-10px); 
            background: rgba(255,255,255,0.15); 
        }
        .stat-number { 
            font-size: 3em; 
            font-weight: bold; 
            color: #FFD700; 
            margin-bottom: 10px; 
        }
        .stat-label { 
            font-size: 1.1em; 
            opacity: 0.8; 
        }
        .features { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
            gap: 25px; 
            margin: 50px 0; 
        }
        .feature-card { 
            background: rgba(255,255,255,0.08); 
            padding: 25px; 
            border-radius: 15px; 
            border-left: 5px solid #FFD700; 
        }
        .feature-card h3 { 
            color: #FFD700; 
            margin-bottom: 15px; 
            font-size: 1.5em; 
        }
        .feature-list { 
            list-style: none; 
            margin-top: 15px; 
        }
        .feature-list li { 
            padding: 8px 0; 
            border-bottom: 1px solid rgba(255,255,255,0.1); 
        }
        .feature-list li:last-child { 
            border-bottom: none; 
        }
        .api-section { 
            background: rgba(0,0,0,0.2); 
            padding: 30px; 
            border-radius: 15px; 
            margin-top: 40px; 
        }
        .api-links { 
            display: flex; 
            flex-wrap: wrap; 
            gap: 15px; 
            margin-top: 20px; 
        }
        .api-link { 
            display: inline-block; 
            background: rgba(255,215,0,0.2); 
            color: #FFD700; 
            padding: 12px 25px; 
            border-radius: 25px; 
            text-decoration: none; 
            border: 1px solid #FFD700; 
            transition: all 0.3s; 
        }
        .api-link:hover { 
            background: #FFD700; 
            color: #1a2980; 
            transform: scale(1.05); 
        }
        .footer { 
            margin-top: 60px; 
            text-align: center; 
            padding-top: 30px; 
            border-top: 1px solid rgba(255,255,255,0.2); 
            color: rgba(255,255,255,0.7); 
        }
        .status-badge { 
            display: inline-block; 
            padding: 8px 20px; 
            background: #4CAF50; 
            border-radius: 20px; 
            font-weight: bold; 
            margin-left: 15px; 
        }
        @media (max-width: 768px) { 
            h1 { font-size: 2.5em; } 
            .stat-card, .feature-card { padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🕌 بوت الأذكار الإسلامي</h1>
            <p class="subtitle">نظام متكامل لإدارة الأذكار والتذكيرات الإسلامية عبر تليجرام</p>
            <div class="status-badge">🟢 النظام يعمل بنجاح</div>
        </div>
        
        <div class="stats-grid" id="statsContainer">
            <!-- سيتم ملؤها بالجافاسكربت -->
        </div>
        
        <div class="features">
            <div class="feature-card">
                <h3>🎛️ لوحة تحكم المشرفين</h3>
                <p>تحكم كامل في إعدادات المجموعة:</p>
                <ul class="feature-list">
                    <li>✅ تفعيل/تعطيل أذكار الصباح</li>
                    <li>✅ تفعيل/تعطيل أذكار المساء</li>
                    <li>🔄 الأذكار الدورية العشوائية</li>
                    <li>⏱️ تحديد الفاصل الزمني</li>
                    <li>🕐 تعديل توقيت الإرسال</li>
                    <li>🎧 إدارة الوسائط (صوت، PDF)</li>
                </ul>
            </div>
            
            <div class="feature-card">
                <h3>👑 لوحة تحكم المطور</h3>
                <p>أدوات متقدمة للإدارة:</p>
                <ul class="feature-list">
                    <li>📝 إدارة المحتوى الكامل</li>
                    <li>🎧 إدارة الوسائط المتقدمة</li>
                    <li>📨 نظام بث متقدم</li>
                    <li>📅 جدولة متقدمة</li>
                    <li>📂 إنشاء أقسام جديدة</li>
                    <li>📊 تقارير مفصلة</li>
                </ul>
            </div>
            
            <div class="feature-card">
                <h3>✨ مميزات النظام</h3>
                <p>نظام متكامل بكل المميزات:</p>
                <ul class="feature-list">
                    <li>🕌 أذكار الصباح والمساء التلقائية</li>
                    <li>📖 تذكير سورة الكهف يوم الجمعة</li>
                    <li>🌙 مناسبات إسلامية</li>
                    <li>🎵 وسائط صوتية</li>
                    <li>📄 ملفات PDF للتحميل</li>
                    <li>⚡ تشغيل تلقائي</li>
                </ul>
            </div>
        </div>
        
        <div class="api-section">
            <h3>🔗 نقاط الوصول API</h3>
            <div class="api-links">
                <a href="/health" class="api-link" target="_blank">🩺 فحص صحة النظام</a>
                <a href="/api/stats" class="api-link" target="_blank">📊 إحصائيات النظام</a>
                <a href="/setup-webhook" class="api-link" target="_blank">⚙️ إعداد Webhook</a>
            </div>
        </div>
        
        <div class="footer">
            <p>👤 المطور: @dev3bod | 📞 الدعم: ${process.env.DEVELOPER_ID || '6960704733'}</p>
            <p>⚡ يستضاف على Render | ⏰ الوقت: <span id="currentTime">${new Date().toLocaleString('ar-SA')}</span></p>
            <p>🔄 آخر تحديث: <span id="lastUpdate">جاري التحميل...</span></p>
        </div>
    </div>
    
    <script>
        // تحديث الإحصائيات
        async function updateStats() {
            try {
                const response = await fetch('/api/stats');
                const data = await response.json();
                
                const statsContainer = document.getElementById('statsContainer');
                statsContainer.innerHTML = \`
                    <div class="stat-card">
                        <div class="stat-number">\${data.groups || 0}</div>
                        <div class="stat-label">👥 مجموعات نشطة</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">\${data.users || 0}</div>
                        <div class="stat-label">👤 مستخدمين</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">\${data.adhkar || 0}</div>
                        <div class="stat-label">🕌 أذكار</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">\${data.scheduled || 0}</div>
                        <div class="stat-label">📅 مجدول</div>
                    </div>
                \`;
                
                document.getElementById('lastUpdate').textContent = 
                    new Date(data.timestamp).toLocaleString('ar-SA');
                    
            } catch (error) {
                console.error('خطأ في تحديث الإحصائيات:', error);
            }
        }
        
        // تحديث الوقت
        function updateCurrentTime() {
            document.getElementById('currentTime').textContent = 
                new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' });
        }
        
        // التحديث الأولي
        updateStats();
        updateCurrentTime();
        
        // تحديث كل 30 ثانية
        setInterval(updateStats, 30000);
        setInterval(updateCurrentTime, 1000);
    </script>
</body>
</html>
  `;
  
  res.send(html);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'islamic-telegram-bot',
    version: '4.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: {
      loaded: Object.keys(db.groups).length > 0,
      groups: Object.keys(db.groups).length,
      users: Object.keys(db.users).length
    },
    bot: {
      token_configured: !!process.env.BOT_TOKEN,
      developer: process.env.DEVELOPER_ID || '6960704733'
    }
  });
});

app.get('/api/stats', (req, res) => {
  res.json({
    groups: Object.keys(db.groups).length,
    users: Object.keys(db.users).length,
    adhkar: Object.keys(db.adhkar).length,
    scheduled: Object.keys(db.schedules).length,
    media: Object.keys(db.media).length,
    categories: Object.keys(db.categories).length,
    timestamp: new Date().toISOString()
  });
});

app.get('/setup-webhook', async (req, res) => {
  try {
    const webhookUrl = \`\${process.env.RENDER_EXTERNAL_URL || \`https://\${req.hostname}\`}/webhook\`;
    
    const response = await axios.post(
      \`https://api.telegram.org/bot\${process.env.BOT_TOKEN}/setWebhook\`,
      {
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true
      }
    );
    
    res.json({
      success: response.data.ok,
      message: 'تم إعداد webhook بنجاح',
      url: webhookUrl,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ==================== بدء الخادم ====================

async function startServer() {
  try {
    // تحميل قاعدة البيانات
    await loadDatabase();
    
    // إعداد الجدولة
    setupScheduler();
    
    // بدء الخادم
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(\`
  🌐 ===================================================== 🌐
     ✅ الخادم يعمل بنجاح!
     📍 http://0.0.0.0:\${PORT}
     ⏰ \${moment().format('YYYY-MM-DD HH:mm:ss')}
     🤖 \${process.env.BOT_TOKEN ? 'البوت جاهز' : '⚠️ تأكد من BOT_TOKEN'}
     
     🔗 لوحة التحكم: /admin
     🔗 فحص الصحة: /health
     🔗 إعداد Webhook: /setup-webhook
  🌐 ===================================================== 🌐
      \`);
    });
    
    // إعداد webhook تلقائياً
    setTimeout(async () => {
      try {
        if (process.env.RENDER_EXTERNAL_URL) {
          const webhookUrl = \`\${process.env.RENDER_EXTERNAL_URL}/webhook\`;
          await axios.post(
            \`https://api.telegram.org/bot\${process.env.BOT_TOKEN}/setWebhook\`,
            {
              url: webhookUrl,
              allowed_updates: ['message', 'callback_query']
            }
          );
          console.log(\`✅ تم إعداد webhook: \${webhookUrl}\`);
        }
      } catch (error) {
        console.log('⚠️ يمكن استخدام polling mode');
      }
    }, 5000);
    
    // حفظ قاعدة البيانات بشكل دوري
    setInterval(async () => {
      await saveDatabase();
    }, 5 * 60 * 1000);
    
    return server;
    
  } catch (error) {
    console.error('❌ فشل في بدء الخادم:', error);
    process.exit(1);
  }
}

startServer();

// ==================== معالجة الإغلاق ====================

process.on('SIGTERM', async () => {
  console.log('🛑 تلقي إشارة SIGTERM، إيقاف الخادم...');
  await saveDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 تلقي إشارة SIGINT، إيقاف الخادم...');
  await saveDatabase();
  process.exit(0);
});

module.exports = app;