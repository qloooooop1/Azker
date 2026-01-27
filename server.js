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
    const defaultAdhkar = require('./data/default-adhkar.json');
    db.adhkar = defaultAdhkar;
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
        randomInterval: 120, // دقائق
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

async function sendTelegramDocument(chatId, documentUrl, caption = '', options = {}) {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendDocument`,
      {
        chat_id: chatId,
        document: documentUrl,
        caption: caption,
        parse_mode: options.parse_mode || 'HTML'
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('❌ خطأ في إرسال ملف:', error.message);
    return null;
  }
}

async function sendTelegramAudio(chatId, audioUrl, caption = '', options = {}) {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendAudio`,
      {
        chat_id: chatId,
        audio: audioUrl,
        caption: caption,
        parse_mode: options.parse_mode || 'HTML'
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('❌ خطأ في إرسال صوت:', error.message);
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
}

async function sendAdminDashboard(userId, groupId) {
  const group = db.groups[groupId];
  const settings = group.settings;
  
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
          ],
          [
            { text: '👑 لوحة المطور', callback_data: `dev_panel_${userId}` }
          ]
        ]
      }
    }
  );
}

async function checkAdminPermissions(userId, groupId) {
  try {
    if (userId.toString() === process.env.DEVELOPER_ID) {
      return true;
    }
    
    if (db.groups[groupId] && db.groups[groupId].admins) {
      return db.groups[groupId].admins.includes(userId.toString());
    }
    
    // التحقق من تليجرام
    const response = await axios.post(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getChatMember`,
      {
        chat_id: groupId,
        user_id: userId
      }
    );
    
    const status = response.data.result.status;
    return ['administrator', 'creator'].includes(status);
    
  } catch (error) {
    console.error('خطأ في التحقق من الصلاحيات:', error.message);
    return false;
  }
}

// ==================== لوحة تحكم المطور ====================

async function sendDeveloperPanel(userId) {
  const stats = await getSystemStats();
  const user = db.users[userId] || {};
  
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

// ==================== إدارة المحتوى (JSON) ====================

async function sendContentManagement(userId) {
  const message = `📝 *إدارة المحتوى عبر JSON*\n\n` +
    `يمكنك رفع ملفات JSON تحتوي على:\n\n` +
    `1. أذكار جديدة\n` +
    `2. فئات جديدة\n` +
    `3. جداول جديدة\n` +
    `4. إعدادات النظام\n\n` +
    `📌 *التنسيق المطلوب:*\n` +
    `• ملف JSON صالح\n` +
    `• هيكل بيانات منظم\n` +
    `• ترميز UTF-8\n\n` +
    `🔧 *اختر نوع الملف:*`;
  
  await sendTelegramMessage(
    userId,
    message,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🕌 رفع أذكار', callback_data: 'upload_adhkar' },
            { text: '📂 رفع فئات', callback_data: 'upload_categories' }
          ],
          [
            { text: '📅 رفع جداول', callback_data: 'upload_schedules' },
            { text: '⚙️ رفع إعدادات', callback_data: 'upload_settings' }
          ],
          [
            { text: '📋 مثال JSON', callback_data: 'json_example' },
            { text: '📤 تصدير البيانات', callback_data: 'export_data' }
          ],
          [
            { text: '◀️ رجوع', callback_data: 'back_to_dev' }
          ]
        ]
      }
    }
  );
}

// ==================== نظام البث المتقدم ====================

async function sendBroadcastPanel(userId) {
  const message = `📨 *نظام البث المتقدم*\n\n` +
    `يمكنك بث رسائل لجميع المجموعات مع خيارات متقدمة:\n\n` +
    `✨ *أنواع البث:*\n` +
    `1. بث فوري (نص، وسائط)\n` +
    `2. بث مجدول (تاريخ/وقت محدد)\n` +
    `3. بث متكرر (يومي، أسبوعي)\n` +
    `4. بث شرطي (حسب الفئة)\n\n` +
    `🎯 *المرشحات:*\n` +
    `• حسب الفئة\n` +
    `• حسب المنطقة\n` +
    `• حسب اللغة\n` +
    `• حسب النشاط\n\n` +
    `🔧 *اختر نوع البث:*`;
  
  await sendTelegramMessage(
    userId,
    message,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🚀 بث فوري', callback_data: 'broadcast_now' },
            { text: '📅 بث مجدول', callback_data: 'broadcast_scheduled' }
          ],
          [
            { text: '🔄 بث متكرر', callback_data: 'broadcast_recurring' },
            { text: '🎯 بث شرطي', callback_data: 'broadcast_conditional' }
          ],
          [
            { text: '📊 إحصائيات البث', callback_data: 'broadcast_stats' },
            { text: '📋 تاريخ البث', callback_data: 'broadcast_history' }
          ],
          [
            { text: '◀️ رجوع', callback_data: 'back_to_dev' }
          ]
        ]
      }
    }
  );
}

// ==================== نظام الأقسام والفئات ====================

async function sendCategoriesManagement(userId) {
  const categories = Object.values(db.categories);
  
  let categoriesList = '📂 *الفئات الحالية:*\n\n';
  categories.forEach(cat => {
    categoriesList += `${cat.icon} ${cat.name} ${cat.enabled ? '✅' : '❌'}\n`;
  });
  
  const message = categoriesList + `\n🔧 *إدارة الفئات:*\n` +
    `يمكنك إنشاء فئات جديدة للأذكار والمناسبات`;
  
  await sendTelegramMessage(
    userId,
    message,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '➕ فئة جديدة', callback_data: 'new_category' },
            { text: '✏️ تعديل فئة', callback_data: 'edit_category' }
          ],
          [
            { text: '🗑️ حذف فئة', callback_data: 'delete_category' },
            { text: '⚙️ تفعيل/تعطيل', callback_data: 'toggle_category' }
          ],
          [
            { text: '📅 مناسبات', callback_data: 'manage_events' },
            { text: '🕌 رمضان', callback_data: 'ramadan_special' }
          ],
          [
            { text: '◀️ رجوع', callback_data: 'back_to_dev' }
          ]
        ]
      }
    }
  );
}

// ==================== جدولة متقدمة ====================

async function sendAdvancedScheduling(userId) {
  const message = `📅 *الجدولة المتقدمة*\n\n` +
    `✨ *أنواع الجدولة:*\n` +
    `1. جدولة واحدة (تاريخ/وقت محدد)\n` +
    `2. جدولة متكررة (يومي، أسبوعي، شهري)\n` +
    `3. جدولة موسمية (رمضان، الحج)\n` +
    `4. جدولة ديناميكية (حسب الأحداث)\n\n` +
    `🎯 *ميزات متقدمة:*\n` +
    `• تحديد أيام معينة\n` +
    `• استثناء أيام\n` +
    `• تكرار محدد\n` +
    `• شروط خاصة\n\n` +
    `🔧 *اختر نوع الجدولة:*`;
  
  await sendTelegramMessage(
    userId,
    message,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⏰ جدولة واحدة', callback_data: 'schedule_single' },
            { text: '🔄 جدولة متكررة', callback_data: 'schedule_recurring' }
          ],
          [
            { text: '🌙 رمضان كامل', callback_data: 'schedule_ramadan' },
            { text: '🕌 مناسبات', callback_data: 'schedule_events' }
          ],
          [
            { text: '📋 الجداول النشطة', callback_data: 'active_schedules' },
            { text: '📊 إحصائيات', callback_data: 'schedule_stats' }
          ],
          [
            { text: '◀️ رجوع', callback_data: 'back_to_dev' }
          ]
        ]
      }
    }
  );
}

// ==================== معالجة Callback Queries ====================

async function handleCallbackQuery(userId, data, messageId) {
  console.log(`📲 Callback: ${data} from ${userId}`);
  
  const parts = data.split('_');
  const action = parts[0];
  const target = parts[1];
  const param = parts.slice(2).join('_');
  
  try {
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
        
      case 'upload':
        await handleUploadAction(userId, target, messageId);
        break;
        
      case 'broadcast':
        await handleBroadcastAction(userId, target, messageId);
        break;
        
      case 'schedule':
        await handleScheduleAction(userId, target, messageId);
        break;
        
      case 'back':
        await sendDeveloperPanel(userId);
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
  const group = db.groups[groupId];
  if (!group) return;
  
  switch(type) {
    case 'morning':
      group.settings.morningAdhkar = !group.settings.morningAdhkar;
      await sendTelegramMessage(userId, `✅ تم ${group.settings.morningAdhkar ? 'تفعيل' : 'تعطيل'} أذكار الصباح`);
      break;
      
    case 'evening':
      group.settings.eveningAdhkar = !group.settings.eveningAdhkar;
      await sendTelegramMessage(userId, `✅ تم ${group.settings.eveningAdhkar ? 'تفعيل' : 'تعطيل'} أذكار المساء`);
      break;
      
    case 'random':
      group.settings.randomAdhkar = !group.settings.randomAdhkar;
      await sendTelegramMessage(userId, `✅ تم ${group.settings.randomAdhkar ? 'تفعيل' : 'تعطيل'} الأذكار الدورية`);
      break;
      
    case 'friday':
      group.settings.fridayReminder = !group.settings.fridayReminder;
      await sendTelegramMessage(userId, `✅ تم ${group.settings.fridayReminder ? 'تفعيل' : 'تعطيل'} تذكير الجمعة`);
      break;
      
    case 'audio':
      group.settings.includeAudio = !group.settings.includeAudio;
      await sendTelegramMessage(userId, `✅ تم ${group.settings.includeAudio ? 'تفعيل' : 'تعطيل'} الصوتيات`);
      break;
      
    case 'pdf':
      group.settings.includePDF = !group.settings.includePDF;
      await sendTelegramMessage(userId, `✅ تم ${group.settings.includePDF ? 'تفعيل' : 'تعطيل'} ملفات PDF`);
      break;
  }
  
  await sendAdminDashboard(userId, groupId);
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
    }
  }
}

async function handleCallbackUpdate(callback) {
  const userId = callback.from.id;
  const data = callback.data;
  const messageId = callback.message.message_id;
  
  await handleCallbackQuery(userId, data, messageId);
  
  // إجابة على callback
  try {
    await axios.post(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/answerCallbackQuery`,
      {
        callback_query_id: callback.id
      }
    );
  } catch (error) {
    console.error('❌ خطأ في إجابة callback:', error.message);
  }
}

async function sendHelpMessage(chatId, userId) {
  const isDeveloper = userId.toString() === process.env.DEVELOPER_ID;
  
  let helpText = `📚 *مساعدة - بوت الأذكار الإسلامي*\n\n`;
  
  if (isDeveloper) {
    helpText += `👑 *أوامر المطور:*\n`;
    helpText += `/dev - لوحة التحكم المتقدمة\n`;
    helpText += `/stats - إحصائيات النظام\n`;
    helpText += `/backup - نسخة احتياطية\n`;
    helpText += `/restart - إعادة تشغيل\n\n`;
  }
  
  helpText += `⚙️ *أوامر المشرفين:*\n`;
  helpText += `أرسل /start في المجموعة\n`;
  helpText += `سيرسل لك البوت لوحة التحكم في الخاص\n\n`;
  
  helpText += `🕌 *مميزات البوت:*\n`;
  helpText += `• أذكار الصباح والمساء\n`;
  helpText += `• أذكار دورية عشوائية\n`;
  helpText += `• تذكير يوم الجمعة\n`;
  helpText += `• المناسبات الإسلامية\n`;
  helpText += `• وسائط صوتية وPDF\n\n`;
  
  helpText += `👤 *المطور:* @dev3bod\n`;
  helpText += `📞 *الدعم:* ${process.env.DEVELOPER_ID || '6960704733'}`;
  
  await sendTelegramMessage(chatId, helpText, { parse_mode: 'Markdown' });
}

// ==================== نظام الجدولة ====================

function setupScheduler() {
  // أذكار الصباح
  cron.schedule('0 6 * * *', async () => {
    await sendMorningAdhkar();
  });
  
  // أذكار المساء
  cron.schedule('0 18 * * *', async () => {
    await sendEveningAdhkar();
  });
  
  // أذكار دورية
  cron.schedule('*/30 * * * *', async () => {
    await sendRandomAdhkar();
  });
  
  // يوم الجمعة
  cron.schedule('0 11 * * 5', async () => {
    await sendFridayReminder();
  });
  
  // التحقق من الجداول
  cron.schedule('* * * * *', async () => {
    await checkScheduledMessages();
  });
  
  console.log('⏰ تم إعداد الجدولة');
}

async function sendMorningAdhkar() {
  const groups = Object.values(db.groups).filter(g => g.settings.morningAdhkar && g.settings.active);
  
  for (const group of groups) {
    const adhkar = Object.values(db.adhkar).filter(a => 
      a.category === 'morning' && a.enabled
    );
    
    if (adhkar.length > 0) {
      const randomAdhkar = adhkar[Math.floor(Math.random() * adhkar.length)];
      await sendAdhkarToGroup(group.id, randomAdhkar);
    }
  }
}

async function sendEveningAdhkar() {
  const groups = Object.values(db.groups).filter(g => g.settings.eveningAdhkar && g.settings.active);
  
  for (const group of groups) {
    const adhkar = Object.values(db.adhkar).filter(a => 
      a.category === 'evening' && a.enabled
    );
    
    if (adhkar.length > 0) {
      const randomAdhkar = adhkar[Math.floor(Math.random() * adhkar.length)];
      await sendAdhkarToGroup(group.id, randomAdhkar);
    }
  }
}

async function sendRandomAdhkar() {
  const groups = Object.values(db.groups).filter(g => g.settings.randomAdhkar && g.settings.active);
  
  for (const group of groups) {
    const adhkar = Object.values(db.adhkar).filter(a => a.enabled);
    
    if (adhkar.length > 0) {
      const randomAdhkar = adhkar[Math.floor(Math.random() * adhkar.length)];
      await sendAdhkarToGroup(group.id, randomAdhkar);
    }
  }
}

async function sendFridayReminder() {
  const groups = Object.values(db.groups).filter(g => g.settings.fridayReminder && g.settings.active);
  
  for (const group of groups) {
    const adhkar = Object.values(db.adhkar).filter(a => 
      a.category === 'friday' && a.enabled
    );
    
    if (adhkar.length > 0) {
      const randomAdhkar = adhkar[Math.floor(Math.random() * adhkar.length)];
      await sendAdhkarToGroup(group.id, randomAdhkar);
    }
  }
}

async function sendAdhkarToGroup(groupId, adhkar) {
  try {
    let message = `🕌 *${adhkar.title || 'ذكر'}*\n\n${adhkar.text}\n\n`;
    
    if (adhkar.source) {
      message += `📖 ${adhkar.source}\n\n`;
    }
    
    message += `✨ @${process.env.BOT_USERNAME || 'islamic_adhkar_bot'}`;
    
    // إرسال مع الوسائط
    if (adhkar.audio && db.groups[groupId].settings.includeAudio) {
      await sendTelegramAudio(groupId, adhkar.audio, message, { parse_mode: 'Markdown' });
    } else if (adhkar.pdf && db.groups[groupId].settings.includePDF) {
      await sendTelegramDocument(groupId, adhkar.pdf, message, { parse_mode: 'Markdown' });
    } else {
      await sendTelegramMessage(groupId, message, { parse_mode: 'Markdown' });
    }
    
    // تسجيل في السجل
    if (!db.schedules[groupId]) {
      db.schedules[groupId] = [];
    }
    
    db.schedules[groupId].push({
      id: uuidv4(),
      adhkarId: adhkar.id,
      type: adhkar.category,
      sentAt: new Date().toISOString(),
      success: true
    });
    
  } catch (error) {
    console.error(`❌ خطأ في إرسال ذكر للمجموعة ${groupId}:`, error.message);
  }
}

async function checkScheduledMessages() {
  const now = moment();
  const scheduled = Object.values(db.schedules).flat();
  
  for (const schedule of scheduled) {
    if (schedule.scheduledTime && moment(schedule.scheduledTime).isSameOrBefore(now) && !schedule.sent) {
      // إرسال الرسالة المجدولة
      await sendScheduledMessage(schedule);
      schedule.sent = true;
      schedule.sentAt = new Date().toISOString();
    }
  }
}

// ==================== API Routes ====================

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>بوت الأذكار الإسلامي - النظام المتكامل</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        body { background: linear-gradient(135deg, #1a2980 0%, #26d0ce 100%); color: white; min-height: 100vh; padding: 40px 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 50px; }
        h1 { font-size: 3.5em; color: #FFD700; margin-bottom: 20px; text-shadow: 3px 3px 6px rgba(0,0,0,0.3); }
        .subtitle { font-size: 1.2em; opacity: 0.9; margin-bottom: 30px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 25px; margin: 40px 0; }
        .stat-card { background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); padding: 30px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.2); text-align: center; transition: transform 0.3s; }
        .stat-card:hover { transform: translateY(-10px); background: rgba(255,255,255,0.15); }
        .stat-number { font-size: 3em; font-weight: bold; color: #FFD700; margin-bottom: 10px; }
        .stat-label { font-size: 1.1em; opacity: 0.8; }
        .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px; margin: 50px 0; }
        .feature-card { background: rgba(255,255,255,0.08); padding: 25px; border-radius: 15px; border-left: 5px solid #FFD700; }
        .feature-card h3 { color: #FFD700; margin-bottom: 15px; font-size: 1.5em; }
        .feature-list { list-style: none; margin-top: 15px; }
        .feature-list li { padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .feature-list li:last-child { border-bottom: none; }
        .api-section { background: rgba(0,0,0,0.2); padding: 30px; border-radius: 15px; margin-top: 40px; }
        .api-links { display: flex; flex-wrap: wrap; gap: 15px; margin-top: 20px; }
        .api-link { display: inline-block; background: rgba(255,215,0,0.2); color: #FFD700; padding: 12px 25px; border-radius: 25px; text-decoration: none; border: 1px solid #FFD700; transition: all 0.3s; }
        .api-link:hover { background: #FFD700; color: #1a2980; transform: scale(1.05); }
        .footer { margin-top: 60px; text-align: center; padding-top: 30px; border-top: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.7); }
        .status-badge { display: inline-block; padding: 8px 20px; background: #4CAF50; border-radius: 20px; font-weight: bold; margin-left: 15px; }
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
                    <li>📝 رفع ملفات JSON للمحتوى</li>
                    <li>🎧 إدارة الوسائط (رفع صوتيات، PDF)</li>
                    <li>📨 نظام بث متقدم</li>
                    <li>📅 جدولة متقدمة (رمضان، مناسبات)</li>
                    <li>📂 إنشاء أقسام وفئات جديدة</li>
                    <li>📊 تقارير وإحصائيات مفصلة</li>
                </ul>
            </div>
            
            <div class="feature-card">
                <h3>✨ مميزات النظام</h3>
                <p>نظام متكامل بكل المميزات:</p>
                <ul class="feature-list">
                    <li>🕌 أذكار الصباح والمساء التلقائية</li>
                    <li>📖 تذكير سورة الكهف يوم الجمعة</li>
                    <li>🌙 مناسبات إسلامية (رمضان، الأعياد)</li>
                    <li>🎵 وسائط صوتية للقرآن والأذكار</li>
                    <li>📄 ملفات PDF للتحميل</li>
                    <li>⚡ تشغيل تلقائي في المجموعات</li>
                </ul>
            </div>
        </div>
        
        <div class="api-section">
            <h3>🔗 نقاط الوصول API</h3>
            <div class="api-links">
                <a href="/health" class="api-link" target="_blank">🩺 فحص صحة النظام</a>
                <a href="/api/stats" class="api-link" target="_blank">📊 إحصائيات النظام</a>
                <a href="/api/groups" class="api-link" target="_blank">👥 قائمة المجموعات</a>
                <a href="/api/adhkar" class="api-link" target="_blank">🕌 قائمة الأذكار</a>
                <a href="/setup-webhook" class="api-link" target="_blank">⚙️ إعداد Webhook</a>
                <a href="/admin" class="api-link" target="_blank">🎛️ واجهة الإدارة</a>
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
                statsContainer.innerHTML = `
                    <div class="stat-card">
                        <div class="stat-number">${data.groups || 0}</div>
                        <div class="stat-label">👥 مجموعات نشطة</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${data.users || 0}</div>
                        <div class="stat-label">👤 مستخدمين</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${data.adhkar || 0}</div>
                        <div class="stat-label">🕌 أذكار</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${data.scheduled || 0}</div>
                        <div class="stat-label">📅 مجدول</div>
                    </div>
                `;
                
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
  `);
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

app.get('/api/groups', (req, res) => {
  res.json({
    count: Object.keys(db.groups).length,
    groups: Object.values(db.groups),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/adhkar', (req, res) => {
  res.json({
    count: Object.keys(db.adhkar).length,
    adhkar: Object.values(db.adhkar),
    categories: Object.values(db.categories),
    timestamp: new Date().toISOString()
  });
});

app.get('/setup-webhook', async (req, res) => {
  try {
    const webhookUrl = `${process.env.RENDER_EXTERNAL_URL || `https://${req.hostname}`}/webhook`;
    
    const response = await axios.post(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/setWebhook`,
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
      console.log(`
  🌐 ===================================================== 🌐
     ✅ الخادم يعمل بنجاح!
     📍 http://0.0.0.0:${PORT}
     ⏰ ${moment().format('YYYY-MM-DD HH:mm:ss')}
     🤖 ${process.env.BOT_TOKEN ? 'البوت جاهز' : '⚠️ تأكد من BOT_TOKEN'}
     
     🔗 لوحة التحكم: /admin
     🔗 فحص الصحة: /health
     🔗 إعداد Webhook: /setup-webhook
  🌐 ===================================================== 🌐
      `);
    });
    
    // إعداد webhook تلقائياً
    setTimeout(async () => {
      try {
        if (process.env.RENDER_EXTERNAL_URL) {
          const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/webhook`;
          await axios.post(
            `https://api.telegram.org/bot${process.env.BOT_TOKEN}/setWebhook`,
            {
              url: webhookUrl,
              allowed_updates: ['message', 'callback_query']
            }
          );
          console.log(`✅ تم إعداد webhook: ${webhookUrl}`);
        }
      } catch (error) {
        console.log('⚠️ يمكن استخدام polling mode');
      }
    }, 5000);
    
    // حفظ قاعدة البيانات بشكل دوري
    setInterval(async () => {
      await saveDatabase();
    }, 5 * 60 * 1000); // كل 5 دقائق
    
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