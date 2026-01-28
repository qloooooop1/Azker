require('dotenv').config();

console.log(`
╔══════════════════════════════════════════╗
║     🕌 بوت الأذكار الإسلامي             ║
║     الإصدار: 2.1.0                      ║
║     المطور: @dev3bod                    ║
║     الوقت: ${new Date().toLocaleString('ar-SA')} ║
╚══════════════════════════════════════════╝
`);

// التحقق من المتغيرات البيئية الأساسية
const requiredEnvVars = ['BOT_TOKEN'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ متغيرات بيئية مفقودة:', missingEnvVars);
  console.error('🔧 يرجى إعداد ملف .env أو متغيرات البيئة في Render');
  process.exit(1);
}

console.log('✅ تم التحقق من المتغيرات البيئية');
console.log(`🤖 توكن البوت: ${process.env.BOT_TOKEN ? '✅ موجود' : '❌ مفقود'}`);

// إضافة في بداية ملف bot.js
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// بدء خادم ويب بسيط
app.get('/', (req, res) => {
  res.json({ status: 'Bot is running', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🌐 Health check server running on port ${PORT}`);
});

// التحقق من أن نسخة واحدة فقط تعمل
const fs = require('fs');
const lockFile = '/tmp/bot.lock';

function acquireLock() {
  try {
    if (fs.existsSync(lockFile)) {
      const lockContent = fs.readFileSync(lockFile, 'utf8');
      const lockTime = parseInt(lockContent);
      if (Date.now() - lockTime < 30000) { // 30 ثانية
        console.error('⚠️ البوت يعمل بالفعل في مكان آخر');
        process.exit(1);
      }
    }
    fs.writeFileSync(lockFile, Date.now().toString());
    return true;
  } catch (error) {
    console.error('خطأ في lock:', error);
    return false;
  }
}

function releaseLock() {
  try {
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
    }
  } catch (error) {
    console.error('خطأ في release lock:', error);
  }
}

// في بداية startBot()
if (!acquireLock()) {
  console.error('❌ لا يمكن بدء البوت، ربما يعمل نسخة أخرى');
  process.exit(1);
}

// عند إيقاف البوت
process.on('exit', releaseLock);
process.on('SIGINT', () => {
  releaseLock();
  process.exit(0);
});

const TelegramBot = require('node-telegram-bot-api');
const fsExtra = require('fs-extra');
const path = require('path');
const mongoose = require('mongoose');
const cron = require('node-cron');
const moment = require('moment-timezone');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// تعريف الثوابت
const token = process.env.BOT_TOKEN || '8507528865:AAGxbvXjNVg7ITo3awlwn9RRbfUiSDcngZw';
const bot = new TelegramBot(token, { 
  polling: true,
  request: {
    proxy: process.env.PROXY_URL || null
  }
});

// إعدادات المجموعات
const ADMIN_GROUP_ID = '-1003595290365';
const DATABASE_GROUP_ID = '-1003624663502';
const DEVELOPER_ID = '6960704733';
const DEVELOPER_USERNAME = '@dev3bod';

// تحميل بيانات الأذكار المطورة
let islamicData = {};
let enhancedAdhkar = {};
try {
  islamicData = require('./data/adhkar.json');
  enhancedAdhkar = require('./data/enhanced-adhkar.json'); // ملف جديد
  console.log('✅ تم تحميل بيانات الأذكار المطورة بنجاح');
} catch (error) {
  console.error('❌ خطأ في تحميل ملف الأذكار المطورة:', error);
  // إنشاء بيانات افتراضية محسنة
  enhancedAdhkar = {
    categories: {
      sleep: {
        name: "أذكار النوم",
        items: [
          {
            text: "باسمك اللهم أموت وأحيا",
            source: "حصن المسلم",
            audio: "https://server.islamic.com/audio/sleep/001.mp3",
            pdf: "https://server.islamic.com/pdf/sleep-adhkar.pdf"
          }
        ]
      },
      wakeup: {
        name: "أذكار الاستيقاظ",
        items: [
          {
            text: "الحمد لله الذي أحيانا بعد ما أماتنا وإليه النشور",
            source: "حصن المسلم",
            audio: "https://server.islamic.com/audio/wakeup/001.mp3"
          }
        ]
      },
      travel: {
        name: "أذكار السفر",
        items: [
          {
            text: "سبحان الذي سخر لنا هذا وما كنا له مقرنين وإنا إلى ربنا لمنقلبون",
            source: "حصن المسلم",
            audio: "https://server.islamic.com/audio/travel/001.mp3",
            pdf: "https://server.islamic.com/pdf/travel-adhkar.pdf"
          }
        ]
      },
      eating: {
        name: "أذكار الطعام",
        items: [
          {
            text: "بسم الله، اللهم بارك لنا فيما رزقتنا وقنا عذاب النار",
            source: "حصن المسلم",
            audio: "https://server.islamic.com/audio/eating/001.mp3"
          }
        ]
      }
    },
    pdf_resources: [
      {
        title: "حصن المسلم كامل",
        url: "https://ia800908.us.archive.org/16/items/hisn-muslim-pdf/Hisn_Al-Muslim.pdf",
        description: "كتاب حصن المسلم كامل PDF"
      },
      {
        title: "الأذكار للنووي",
        url: "https://www.noor-book.com/كتاب-الاذكار-من-كلام-سيد-الابرار-pdf",
        description: "كتاب الأذكار للإمام النووي"
      },
      {
        title: "سورة الكهف",
        url: "https://server.islamic.com/pdf/surah-al-kahf.pdf",
        description: "سورة الكهف كاملة"
      },
      {
        title: "أذكار الصباح والمساء",
        url: "https://server.islamic.com/pdf/morning-evening-adhkar.pdf",
        description: "أذكار الصباح والمساء كاملة"
      }
    ],
    audio_resources: [
      {
        title: "القرآن الكريم كامل - عبد الباسط",
        url: "https://everyayah.com/data/Abdul_Basit_Murattal_128kbps/",
        description: "القرآن الكريم بصوت عبد الباسط عبد الصمد"
      },
      {
        title: "أذكار مسموعة",
        url: "https://server.islamic.com/audio/adhkar/",
        description: "مكتبة الأذكار المسموعة"
      },
      {
        title: "دعاء القنوت",
        url: "https://server.islamic.com/audio/dua/qunut.mp3",
        description: "دعاء القنوت في الوتر"
      }
    ]
  };
}

// قاعدة البيانات المحسنة
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/islamic_bot_v3', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  retryWrites: true,
  w: 'majority'
});

// نماذج قاعدة البيانات المحسنة مع إصلاح المشاكل
const groupSettingsSchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true },
  chatTitle: String,
  chatType: String,
  enabled: { type: Boolean, default: true },
  addedBy: String,
  addedDate: { type: Date, default: Date.now },
  admins: [{
    userId: String,
    username: String,
    addedDate: Date
  }],
  settings: {
    morningAdhkar: { type: Boolean, default: true },
    eveningAdhkar: { type: Boolean, default: true },
    periodicAdhkar: { type: Boolean, default: true },
    periodicEnhancedAdhkar: { type: Boolean, default: true }, // إضافة الأذكار المطورة
    fridayReminder: { type: Boolean, default: true },
    prayerTimeReminder: { type: Boolean, default: true },
    ramadanReminders: { type: Boolean, default: true },
    arafatReminder: { type: Boolean, default: true },
    eidReminders: { type: Boolean, default: true },
    ashuraReminder: { type: Boolean, default: true },
    lastTenNights: { type: Boolean, default: true },
    quranAudio: { type: Boolean, default: true },
    adhkarAudio: { type: Boolean, default: true },
    takbiratAudio: { type: Boolean, default: true },
    enhancedCategories: { // فئات الأذكار المطورة
      sleep: { type: Boolean, default: true },
      wakeup: { type: Boolean, default: true },
      travel: { type: Boolean, default: true },
      eating: { type: Boolean, default: true },
      general: { type: Boolean, default: true }
    },
    reminderInterval: { type: Number, default: 60 },
    sendAsDocument: { type: Boolean, default: false },
    includeAudio: { type: Boolean, default: true },
    includePDF: { type: Boolean, default: true }
  },
  customSchedule: {
    morningTime: { type: String, default: '06:00' },
    eveningTime: { type: String, default: '18:00' },
    fridayTime: { type: String, default: '11:00' },
    periodicTime: { type: String, default: '12:00' }
  },
  lastReminderSent: Date,
  reminderCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  lastError: String,
  errorCount: { type: Number, default: 0 }
});

const userSettingsSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: String,
  firstName: String,
  lastName: String,
  isDeveloper: { type: Boolean, default: false },
  isSuperAdmin: { type: Boolean, default: false },
  managedGroups: [String],
  addedAdhkar: [{
    id: String,
    category: String,
    text: String,
    source: String,
    audioUrl: String,
    pdfUrl: String,
    addedDate: Date,
    approved: { type: Boolean, default: false },
    approvedBy: String,
    approvedDate: Date
  }],
  adminWizardState: { // لحفظ حالة الويزارد
    step: String,
    data: mongoose.Schema.Types.Mixed,
    groupId: String,
    messageId: String
  },
  lastActive: Date,
  joinDate: { type: Date, default: Date.now }
});

const reminderLogSchema = new mongoose.Schema({
  logId: { type: String, default: () => uuidv4() },
  chatId: String,
  chatTitle: String,
  reminderType: String,
  category: String,
  adhkarId: String,
  message: String,
  sentAt: { type: Date, default: Date.now },
  success: { type: Boolean, default: true },
  error: String,
  includesAudio: Boolean,
  includesPDF: Boolean,
  isEnhanced: { type: Boolean, default: false } // تحديد إذا كان من الأذكار المطورة
});

const customAdhkarSchema = new mongoose.Schema({
  adhkarId: { type: String, default: () => uuidv4() },
  addedBy: String,
  addedByUsername: String,
  category: String,
  subCategory: String,
  text: { type: String, required: true },
  source: String,
  audioUrl: String,
  pdfUrl: String,
  repeatCount: { type: Number, default: 1 },
  rewards: String,
  approved: { type: Boolean, default: false },
  approvedBy: String,
  approvedDate: Date,
  addedDate: { type: Date, default: Date.now },
  scheduledDate: Date,
  isRecurring: { type: Boolean, default: false },
  recurrencePattern: String,
  targetGroups: [String],
  sentCount: { type: Number, default: 0 },
  isEnhancedCategory: { type: Boolean, default: false } // تحديد إذا كان من الفئات المطورة
});

// نماذج جديدة للأقسام والوسائط
const categorySchema = new mongoose.Schema({
  categoryId: { type: String, default: () => uuidv4() },
  name: String,
  description: String,
  icon: String,
  enabled: { type: Boolean, default: true },
  parentCategory: String,
  sortOrder: Number,
  items: [{
    id: String,
    text: String,
    source: String,
    audioUrl: String,
    pdfUrl: String
  }],
  createdAt: { type: Date, default: Date.now }
});

const mediaLibrarySchema = new mongoose.Schema({
  mediaId: { type: String, default: () => uuidv4() },
  filename: String,
  originalName: String,
  fileType: String, // audio, pdf, image
  fileSize: Number,
  url: String,
  uploadedBy: String,
  uploadedAt: { type: Date, default: Date.now },
  usedIn: [String], // في أي أذكار استخدمت
  isActive: { type: Boolean, default: true }
});

const liveStreamSchema = new mongoose.Schema({
  streamId: { type: String, default: () => uuidv4() },
  title: String,
  streamUrl: String,
  streamType: { type: String, enum: ['hls', 'rtmp', 'youtube', 'm3u8'], default: 'hls' },
  isLive: { type: Boolean, default: false },
  viewersCount: { type: Number, default: 0 },
  startTime: Date,
  endTime: Date,
  createdBy: String,
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
});

// إنشاء النماذج
const db = {
  GroupSettings: mongoose.model('GroupSettings', groupSettingsSchema),
  UserSettings: mongoose.model('UserSettings', userSettingsSchema),
  ReminderLog: mongoose.model('ReminderLog', reminderLogSchema),
  CustomAdhkar: mongoose.model('CustomAdhkar', customAdhkarSchema),
  Category: mongoose.model('Category', categorySchema),
  MediaLibrary: mongoose.model('MediaLibrary', mediaLibrarySchema),
  LiveStream: mongoose.model('LiveStream', liveStreamSchema)
};

// ========== إصلاح وظائف لوحة التحكم ==========

// وظائف مساعدة محسنة
async function saveToDatabaseGroup(content, type) {
  try {
    const message = `📥 *إضافة جديدة*\n\n`
      + `📌 النوع: ${type}\n`
      + `⏰ الوقت: ${new Date().toLocaleString('ar-SA')}\n`
      + `📝 المحتوى:\n${content.substring(0, 500)}...`;
    
    await bot.sendMessage(DATABASE_GROUP_ID, message, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });
    return true;
  } catch (error) {
    console.error('❌ خطأ في الحفظ للمجموعة:', error);
    return false;
  }
}

async function broadcastToAllGroups(message, options = {}) {
  const groups = await db.GroupSettings.find({ enabled: true, isActive: true });
  let successCount = 0;
  let failCount = 0;
  const errors = [];
  
  for (const group of groups) {
    try {
      await bot.sendMessage(group.chatId, message, {
        parse_mode: options.parse_mode || 'Markdown',
        disable_web_page_preview: true,
        ...options
      });
      successCount++;
      
      // تأخير لتجنب حظر التيليجرام
      await new Promise(resolve => setTimeout(resolve, 150));
    } catch (error) {
      console.error(`خطأ في الإرسال للمجموعة ${group.chatId}:`, error.message);
      failCount++;
      errors.push({ group: group.chatId, error: error.message });
      
      // إذا كانت المجموعة محذوفة، تعطيلها
      if (error.response && error.response.statusCode === 403) {
        group.isActive = false;
        group.lastError = error.message;
        group.errorCount += 1;
        await group.save();
      }
    }
  }
  
  return { successCount, failCount, total: groups.length, errors };
}

// ========== إصلاح لوحة المطور ==========

function getDeveloperKeyboard(userId, context = 'main') {
  const isDeveloper = userId.toString() === DEVELOPER_ID;
  
  let keyboard = {};
  
  switch(context) {
    case 'main':
      keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📝 إدارة المحتوى', callback_data: 'dev_content' },
              { text: '👥 إدارة المجموعات', callback_data: 'dev_groups' }
            ],
            [
              { text: '🎧 إدارة الوسائط', callback_data: 'dev_media' },
              { text: '📨 نظام البث', callback_data: 'dev_broadcast' }
            ],
            [
              { text: '📂 الأقسام والفئات', callback_data: 'dev_categories' },
              { text: '🎯 البث المباشر', callback_data: 'dev_livestream' }
            ],
            [
              { text: '📊 التقارير والإحصائيات', callback_data: 'dev_reports' },
              { text: '⚙️ إعدادات النظام', callback_data: 'dev_settings' }
            ],
            isDeveloper ? [
              { text: '🔧 صيانة النظام', callback_data: 'dev_maintenance' },
              { text: '💾 نسخ احتياطي', callback_data: 'dev_backup' }
            ] : []
          ].filter(row => row.length > 0)
        }
      };
      break;
      
    case 'content':
      keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '➕ إضافة ذكر جديد', callback_data: 'add_adhkar' },
              { text: '📋 عرض الأذكار', callback_data: 'list_adhkar' }
            ],
            [
              { text: '✏️ تعديل ذكر', callback_data: 'edit_adhkar' },
              { text: '🗑️ حذف ذكر', callback_data: 'delete_adhkar' }
            ],
            [
              { text: '📁 إدارة الفئات', callback_data: 'manage_categories' },
              { text: '🔄 استيراد/تصدير', callback_data: 'import_export' }
            ],
            [
              { text: '◀️ العودة', callback_data: 'dev_back' }
            ]
          ]
        }
      };
      break;
      
    case 'groups':
      keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📊 إحصائيات المجموعات', callback_data: 'groups_stats' },
              { text: '👁️ عرض المجموعات', callback_data: 'view_groups' }
            ],
            [
              { text: '⚙️ إعدادات جماعية', callback_data: 'bulk_settings' },
              { text: '📨 إرسال جماعي', callback_data: 'bulk_send' }
            ],
            [
              { text: '🔍 بحث عن مجموعة', callback_data: 'search_group' },
              { text: '📋 تصدير البيانات', callback_data: 'export_groups' }
            ],
            [
              { text: '◀️ العودة', callback_data: 'dev_back' }
            ]
          ]
        }
      };
      break;
      
    case 'media':
      keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🎵 رفع صوتيات', callback_data: 'upload_audio' },
              { text: '📄 رفع ملفات PDF', callback_data: 'upload_pdf' }
            ],
            [
              { text: '📋 الوسائط المرفوعة', callback_data: 'list_media' },
              { text: '🔗 إدارة الروابط', callback_data: 'manage_links' }
            ],
            [
              { text: '🗑️ حذف وسائط', callback_data: 'delete_media' },
              { text: '📁 تنظيم الوسائط', callback_data: 'organize_media' }
            ],
            [
              { text: '◀️ العودة', callback_data: 'dev_back' }
            ]
          ]
        }
      };
      break;
      
    case 'categories':
      keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '➕ إضافة قسم جديد', callback_data: 'add_category' },
              { text: '📋 عرض الأقسام', callback_data: 'list_categories' }
            ],
            [
              { text: '✏️ تعديل قسم', callback_data: 'edit_category' },
              { text: '🗑️ حذف قسم', callback_data: 'delete_category' }
            ],
            [
              { text: '🎯 الفئات المطورة', callback_data: 'enhanced_categories' },
              { text: '📊 إحصائيات الفئات', callback_data: 'categories_stats' }
            ],
            [
              { text: '◀️ العودة', callback_data: 'dev_back' }
            ]
          ]
        }
      };
      break;
  }
  
  return keyboard;
}

// عرض لوحة المطور المحسنة
async function showDeveloperPanel(chatId, userId) {
  try {
    const stats = await getDetailedStatistics();
    
    const message = `👑 *لوحة تحكم المطور*\n\n` +
      `📊 *الإحصائيات الحالية:*\n` +
      `👥 المجموعات النشطة: ${stats.activeGroups}\n` +
      `👤 المستخدمين: ${stats.totalUsers}\n` +
      `📝 الأذكار الكلية: ${stats.totalAdhkar}\n` +
      `🎧 الوسائط: ${stats.totalMedia}\n` +
      `📂 الأقسام: ${stats.totalCategories}\n` +
      `✅ نسبة النجاح: ${stats.successRate}%\n\n` +
      `⏰ *آخر نشاط:*\n${stats.lastActivity}\n\n` +
      `🔧 *الأدوات المتاحة:*\n` +
      `يمكنك إدارة جميع محتويات البوت من الأقسام التالية:`;
    
    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      ...getDeveloperKeyboard(userId, 'main')
    });
  } catch (error) {
    console.error('خطأ في عرض لوحة المطور:', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ في فتح لوحة التحكم. حاول مرة أخرى.');
  }
}

// ========== إصلاح معالجة الأزرار ==========

// معالجة callback queries محسنة
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;
  const messageId = callbackQuery.message.message_id;
  
  try {
    console.log(`📲 Callback received: ${data} from ${userId}`);
    
    // قسم البيانات
    const parts = data.split('_');
    const action = parts[0];
    const target = parts[1];
    
    // معالجة الإجراءات العامة
    switch(data) {
      case 'dev_back':
        await showDeveloperPanel(msg.chat.id, userId);
        await bot.answerCallbackQuery(callbackQuery.id);
        return;
        
      case 'dev_content':
        await showContentManagement(msg.chat.id, userId);
        await bot.answerCallbackQuery(callbackQuery.id);
        return;
        
      case 'dev_groups':
        await showGroupManagement(msg.chat.id, userId);
        await bot.answerCallbackQuery(callbackQuery.id);
        return;
        
      case 'dev_media':
        await showMediaManagement(msg.chat.id, userId);
        await bot.answerCallbackQuery(callbackQuery.id);
        return;
        
      case 'dev_broadcast':
        await showBroadcastManagement(msg.chat.id, userId);
        await bot.answerCallbackQuery(callbackQuery.id);
        return;
        
      case 'dev_categories':
        await showCategoriesManagement(msg.chat.id, userId);
        await bot.answerCallbackQuery(callbackQuery.id);
        return;
        
      case 'dev_livestream':
        await showLiveStreamManagement(msg.chat.id, userId);
        await bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
    
    // معالجة الإجراءات المحددة
    if (data.startsWith('add_')) {
      await handleAddAction(msg.chat.id, userId, data.replace('add_', ''));
    } else if (data.startsWith('edit_')) {
      await handleEditAction(msg.chat.id, userId, data.replace('edit_', ''));
    } else if (data.startsWith('delete_')) {
      await handleDeleteAction(msg.chat.id, userId, data.replace('delete_', ''));
    } else if (data.startsWith('list_')) {
      await handleListAction(msg.chat.id, userId, data.replace('list_', ''));
    } else if (data.startsWith('manage_')) {
      await handleManageAction(msg.chat.id, userId, data.replace('manage_', ''));
    } else if (data.startsWith('upload_')) {
      await handleUploadAction(msg.chat.id, userId, data.replace('upload_', ''));
    } else if (data.startsWith('category_')) {
      const categoryId = data.replace('category_', '');
      await showCategoryDetails(msg.chat.id, userId, categoryId);
    } else if (data.startsWith('adhkar_')) {
      const adhkarId = data.replace('adhkar_', '');
      await showAdhkarDetails(msg.chat.id, userId, adhkarId);
    } else if (data.startsWith('media_')) {
      const mediaId = data.replace('media_', '');
      await showMediaDetails(msg.chat.id, userId, mediaId);
    } else if (data.startsWith('group_')) {
      const groupId = data.replace('group_', '');
      await showGroupDetails(msg.chat.id, userId, groupId);
    }
    
    await bot.answerCallbackQuery(callbackQuery.id);
  } catch (error) {
    console.error('❌ خطأ في معالجة callback:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { 
      text: '❌ حدث خطأ في المعالجة. حاول مرة أخرى.' 
    });
  }
});

// ========== إصلاح إدارة المحتوى ==========

async function showContentManagement(chatId, userId) {
  try {
    const totalAdhkar = await db.CustomAdhkar.countDocuments();
    const pendingAdhkar = await db.CustomAdhkar.countDocuments({ approved: false });
    const categories = await db.Category.countDocuments();
    
    const message = `📝 *إدارة المحتوى*\n\n` +
      `📊 *إحصائيات المحتوى:*\n` +
      `📝 الأذكار الكلية: ${totalAdhkar}\n` +
      `⏳ بانتظار الموافقة: ${pendingAdhkar}\n` +
      `📂 الأقسام: ${categories}\n\n` +
      `🔧 *اختر الإجراء المطلوب:*`;
    
    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      ...getDeveloperKeyboard(userId, 'content')
    });
  } catch (error) {
    console.error('خطأ في عرض إدارة المحتوى:', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ في فتح إدارة المحتوى.');
  }
}

// ========== إصلاح إدارة المجموعات ==========

async function showGroupManagement(chatId, userId) {
  try {
    const activeGroups = await db.GroupSettings.countDocuments({ isActive: true });
    const totalGroups = await db.GroupSettings.countDocuments();
    const disabledGroups = totalGroups - activeGroups;
    
    const message = `👥 *إدارة المجموعات*\n\n` +
      `📊 *إحصائيات المجموعات:*\n` +
      `🟢 نشطة: ${activeGroups}\n` +
      `🔴 معطلة: ${disabledGroups}\n` +
      `📊 الإجمالي: ${totalGroups}\n\n` +
      `🔧 *اختر الإجراء المطلوب:*`;
    
    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      ...getDeveloperKeyboard(userId, 'groups')
    });
  } catch (error) {
    console.error('خطأ في عرض إدارة المجموعات:', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ في فتح إدارة المجموعات.');
  }
}

// ========== إصلاح إدارة الوسائط ==========

async function showMediaManagement(chatId, userId) {
  try {
    const totalMedia = await db.MediaLibrary.countDocuments();
    const audioCount = await db.MediaLibrary.countDocuments({ fileType: 'audio' });
    const pdfCount = await db.MediaLibrary.countDocuments({ fileType: 'pdf' });
    
    const message = `🎧 *إدارة الوسائط*\n\n` +
      `📊 *إحصائيات الوسائط:*\n` +
      `🎵 ملفات صوتية: ${audioCount}\n` +
      `📄 ملفات PDF: ${pdfCount}\n` +
      `📁 الإجمالي: ${totalMedia}\n\n` +
      `🔧 *اختر الإجراء المطلوب:*`;
    
    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      ...getDeveloperKeyboard(userId, 'media')
    });
  } catch (error) {
    console.error('خطأ في عرض إدارة الوسائط:', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ في فتح إدارة الوسائط.');
  }
}

// ========== إصلاح نظام البث ==========

async function showBroadcastManagement(chatId, userId) {
  try {
    const scheduledCount = await db.CustomAdhkar.countDocuments({ 
      scheduledDate: { $gt: new Date() } 
    });
    
    const message = `📨 *نظام البث المتقدم*\n\n` +
      `📊 *المهام المجدولة:* ${scheduledCount}\n\n` +
      `🔧 *أنواع البث المتاحة:*\n` +
      `• بث فوري للمجموعات\n` +
      `• بث مجدول بوقت محدد\n` +
      `• بث متكرر (يومي، أسبوعي)\n` +
      `• بث شرطي حسب الفئات\n\n` +
      `⚙️ *اختر نوع البث:*`;
    
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🚀 بث فوري', callback_data: 'broadcast_instant' },
            { text: '📅 بث مجدول', callback_data: 'broadcast_scheduled' }
          ],
          [
            { text: '🔄 بث متكرر', callback_data: 'broadcast_recurring' },
            { text: '🎯 بث حسب الفئة', callback_data: 'broadcast_by_category' }
          ],
          [
            { text: '📊 إحصائيات البث', callback_data: 'broadcast_stats' },
            { text: '◀️ العودة', callback_data: 'dev_back' }
          ]
        ]
      }
    };
    
    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  } catch (error) {
    console.error('خطأ في عرض نظام البث:', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ في فتح نظام البث.');
  }
}

// ========== إصلاح الأقسام والفئات ==========

async function showCategoriesManagement(chatId, userId) {
  try {
    const categories = await db.Category.countDocuments();
    const enhancedCategories = Object.keys(enhancedAdhkar.categories || {}).length;
    
    const message = `📂 *إدارة الأقسام والفئات*\n\n` +
      `📊 *إحصائيات الفئات:*\n` +
      `📁 الأقسام المخصصة: ${categories}\n` +
      `🌟 الفئات المطورة: ${enhancedCategories}\n\n` +
      `🔧 *اختر الإجراء المطلوب:*`;
    
    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      ...getDeveloperKeyboard(userId, 'categories')
    });
  } catch (error) {
    console.error('خطأ في عرض إدارة الأقسام:', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ في فتح إدارة الأقسام.');
  }
}

// ========== إصلاح نظام البث المباشر ==========

async function showLiveStreamManagement(chatId, userId) {
  try {
    const liveStreams = await db.LiveStream.countDocuments({ isLive: true });
    const totalStreams = await db.LiveStream.countDocuments();
    
    const message = `🎯 *نظام البث المباشر*\n\n` +
      `📊 *إحصائيات البث:*\n` +
      `🔴 بث مباشر الآن: ${liveStreams}\n` +
      `📁 إجمالي البثوث: ${totalStreams}\n\n` +
      `🔧 *اختر الإجراء المطلوب:*`;
    
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🎥 بدء بث مباشر', callback_data: 'livestream_start' },
            { text: '📋 عرض البثوث', callback_data: 'livestream_list' }
          ],
          [
            { text: '⚙️ إدارة البثوث', callback_data: 'livestream_manage' },
            { text: '🗑️ حذف بث', callback_data: 'livestream_delete' }
          ],
          [
            { text: '📊 إحصائيات المشاهدات', callback_data: 'livestream_stats' },
            { text: '◀️ العودة', callback_data: 'dev_back' }
          ]
        ]
      }
    };
    
    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  } catch (error) {
    console.error('خطأ في عرض نظام البث المباشر:', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ في فتح نظام البث المباشر.');
  }
}

// ========== إصلاح عرض الفئات المطورة ==========

async function showEnhancedCategories(chatId, userId) {
  try {
    const categories = enhancedAdhkar.categories || {};
    const categoryList = Object.entries(categories).map(([key, cat]) => 
      `• ${cat.name}: ${cat.items?.length || 0} ذكر`
    ).join('\n');
    
    const message = `🌟 *الفئات المطورة للأذكار*\n\n` +
      `📂 *الفئات المتاحة:*\n${categoryList}\n\n` +
      `📚 *الموارد المتاحة:*\n` +
      `📄 ملفات PDF: ${enhancedAdhkar.pdf_resources?.length || 0}\n` +
      `🎵 روابط صوتية: ${enhancedAdhkar.audio_resources?.length || 0}\n\n` +
      `🔧 *اختر الفئة:*`;
    
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          ...Object.entries(categories).map(([key, cat]) => [
            { text: `${cat.name} (${cat.items?.length || 0})`, callback_data: `enhanced_category_${key}` }
          ]),
          [
            { text: '📄 عرض ملفات PDF', callback_data: 'enhanced_pdfs' },
            { text: '🎵 عرض روابط صوتية', callback_data: 'enhanced_audios' }
          ],
          [
            { text: '◀️ العودة', callback_data: 'dev_categories' }
          ]
        ]
      }
    };
    
    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  } catch (error) {
    console.error('خطأ في عرض الفئات المطورة:', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ في فتح الفئات المطورة.');
  }
}

// ========== إصلاح عرض ملفات PDF ==========

async function showEnhancedPDFs(chatId, userId) {
  try {
    const pdfs = enhancedAdhkar.pdf_resources || [];
    
    if (pdfs.length === 0) {
      await bot.sendMessage(chatId, '❌ لا توجد ملفات PDF متاحة حالياً.');
      return;
    }
    
    let message = `📚 *ملفات PDF المتاحة*\n\n`;
    
    pdfs.forEach((pdf, index) => {
      message += `${index + 1}. *${pdf.title}*\n`;
      if (pdf.description) {
        message += `   📝 ${pdf.description}\n`;
      }
      message += `   🔗 ${pdf.url}\n\n`;
    });
    
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📥 تنزيل كل الملفات', callback_data: 'download_all_pdfs' },
            { text: '📋 مشاركة مع المجموعات', callback_data: 'share_pdfs' }
          ],
          [
            { text: '◀️ العودة', callback_data: 'enhanced_categories' }
          ]
        ]
      }
    };
    
    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      ...keyboard
    });
  } catch (error) {
    console.error('خطأ في عرض ملفات PDF:', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ في عرض ملفات PDF.');
  }
}

// ========== إصلاح عرض الروابط الصوتية ==========

async function showEnhancedAudios(chatId, userId) {
  try {
    const audios = enhancedAdhkar.audio_resources || [];
    
    if (audios.length === 0) {
      await bot.sendMessage(chatId, '❌ لا توجد روابط صوتية متاحة حالياً.');
      return;
    }
    
    let message = `🎵 *الروابط الصوتية المتاحة*\n\n`;
    
    audios.forEach((audio, index) => {
      message += `${index + 1}. *${audio.title}*\n`;
      if (audio.description) {
        message += `   📝 ${audio.description}\n`;
      }
      message += `   🔗 ${audio.url}\n\n`;
    });
    
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🎧 تشغيل عينات', callback_data: 'play_audio_samples' },
            { text: '📋 مشاركة مع المجموعات', callback_data: 'share_audios' }
          ],
          [
            { text: '◀️ العودة', callback_data: 'enhanced_categories' }
          ]
        ]
      }
    };
    
    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      ...keyboard
    });
  } catch (error) {
    console.error('خطأ في عرض الروابط الصوتية:', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ في عرض الروابط الصوتية.');
  }
}

// ========== إصلاح معالجة رسائل المستخدم ==========

bot.on('message', async (msg) => {
  try {
    if (msg.chat.type !== 'private' || !msg.text || msg.text.startsWith('/')) {
      return;
    }
    
    const userId = msg.from.id.toString();
    const user = await db.UserSettings.findOne({ userId });
    
    if (user && user.adminWizardState) {
      await handleAdminWizardResponse(msg, user);
      return;
    }
    
    // معالجة الأوامر النصية الأخرى
    if (msg.text.toLowerCase().includes('pdf') || msg.text.includes('📄')) {
      await showEnhancedPDFs(msg.chat.id, userId);
    } else if (msg.text.toLowerCase().includes('صوت') || msg.text.includes('🎵')) {
      await showEnhancedAudios(msg.chat.id, userId);
    }
    
  } catch (error) {
    console.error('خطأ في معالجة رسالة:', error);
  }
});

// ========== إصلاح الجدولة ==========

function setupEnhancedScheduler() {
  try {
    // إيقاف الجدولة القديمة إذا كانت تعمل
    cron.getTasks().forEach(task => task.stop());
    
    // جدولة الأذكار المطورة (دورية - بدون صباح ومساء)
    cron.schedule('0 */2 * * *', async () => {
      await sendEnhancedPeriodicAdhkar();
    }, { timezone: 'Asia/Riyadh' });
    
    // جدولة الفئات المطورة المختلفة
    cron.schedule('0 8,12,16,20 * * *', async () => {
      await sendRandomEnhancedCategory();
    }, { timezone: 'Asia/Riyadh' });
    
    // جدولة ملفات PDF (مرة أسبوعياً)
    cron.schedule('0 10 * * 5', async () => {
      await sendWeeklyPDFResource();
    }, { timezone: 'Asia/Riyadh' });
    
    // جدولة روابط صوتية (يومياً)
    cron.schedule('0 14 * * *', async () => {
      await sendDailyAudioResource();
    }, { timezone: 'Asia/Riyadh' });
    
    console.log('✅ تم إعداد الجدولة المحسنة بنجاح');
    
  } catch (error) {
    console.error('❌ خطأ في إعداد الجدولة المحسنة:', error);
  }
}

// إرسال أذكار مطورة دورية (بدون صباح ومساء)
async function sendEnhancedPeriodicAdhkar() {
  try {
    const groups = await db.GroupSettings.find({ 
      isActive: true,
      enabled: true,
      'settings.periodicEnhancedAdhkar': true 
    });
    
    // جمع الأذكار من الفئات المطورة فقط
    const enhancedCategories = Object.values(enhancedAdhkar.categories || {});
    const allEnhancedAdhkar = [];
    
    enhancedCategories.forEach(category => {
      if (category.items) {
        category.items.forEach(item => {
          allEnhancedAdhkar.push({
            ...item,
            categoryName: category.name,
            categoryId: category.id
          });
        });
      }
    });
    
    if (allEnhancedAdhkar.length === 0) return;
    
    const randomAdhkar = allEnhancedAdhkar[Math.floor(Math.random() * allEnhancedAdhkar.length)];
    
    for (const group of groups) {
      try {
        let message = `🌟 *${randomAdhkar.categoryName}*\n\n${randomAdhkar.text}\n\n`;
        
        if (randomAdhkar.source) {
          message += `📖 ${randomAdhkar.source}\n\n`;
        }
        
        message += `✨ @${bot.options.username}`;
        
        // إرسال مع الوسائط إذا كانت متوفرة
        if (randomAdhkar.audio && group.settings.includeAudio) {
          try {
            await bot.sendAudio(group.chatId, randomAdhkar.audio, {
              caption: message,
              parse_mode: 'Markdown'
            });
            continue;
          } catch (error) {
            console.error('خطأ في إرسال الصوت:', error);
          }
        }
        
        if (randomAdhkar.pdf && group.settings.includePDF) {
          try {
            await bot.sendDocument(group.chatId, randomAdhkar.pdf, {
              caption: message,
              parse_mode: 'Markdown'
            });
            continue;
          } catch (error) {
            console.error('خطأ في إرسال PDF:', error);
          }
        }
        
        // إرسال نصي فقط
        await bot.sendMessage(group.chat.id, message, { parse_mode: 'Markdown' });
        
      } catch (error) {
        console.error(`خطأ في إرسال ذكر مطور للمجموعة ${group.chatId}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ خطأ في إرسال الأذكار المطورة:', error);
  }
}

// إرسال فئة مطورة عشوائية
async function sendRandomEnhancedCategory() {
  try {
    const groups = await db.GroupSettings.find({ 
      isActive: true,
      enabled: true 
    });
    
    const categories = Object.entries(enhancedAdhkar.categories || {});
    if (categories.length === 0) return;
    
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    const [categoryId, category] = randomCategory;
    
    if (!category.items || category.items.length === 0) return;
    
    const randomItem = category.items[Math.floor(Math.random() * category.items.length)];
    
    for (const group of groups) {
      // التحقق من تفعيل الفئة في إعدادات المجموعة
      if (group.settings.enhancedCategories && 
          group.settings.enhancedCategories[categoryId] !== false) {
        
        try {
          let message = `📂 *${category.name}*\n\n${randomItem.text}\n\n`;
          
          if (randomItem.source) {
            message += `📖 ${randomItem.source}\n\n`;
          }
          
          message += `✨ @${bot.options.username}`;
          
          await bot.sendMessage(group.chatId, message, { parse_mode: 'Markdown' });
          
        } catch (error) {
          console.error(`خطأ في إرسال فئة للمجموعة ${group.chatId}:`, error.message);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ خطأ في إرسال الفئة المطورة:', error);
  }
}

// إرسال مورد PDF أسبوعي
async function sendWeeklyPDFResource() {
  try {
    const groups = await db.GroupSettings.find({ 
      isActive: true,
      enabled: true,
      'settings.includePDF': true 
    });
    
    const pdfs = enhancedAdhkar.pdf_resources || [];
    if (pdfs.length === 0) return;
    
    const randomPdf = pdfs[Math.floor(Math.random() * pdfs.length)];
    
    for (const group of groups) {
      try {
        const message = `📚 *مورد أسبوعي - ملف PDF*\n\n` +
          `*${randomPdf.title}*\n` +
          (randomPdf.description ? `${randomPdf.description}\n\n` : '\n') +
          `✨ @${bot.options.username}`;
        
        await bot.sendMessage(group.chatId, message, { 
          parse_mode: 'Markdown',
          disable_web_page_preview: true 
        });
        
      } catch (error) {
        console.error(`خطأ في إرسال PDF للمجموعة ${group.chatId}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ خطأ في إرسال PDF أسبوعي:', error);
  }
}

// إرسال مورد صوتي يومي
async function sendDailyAudioResource() {
  try {
    const groups = await db.GroupSettings.find({ 
      isActive: true,
      enabled: true,
      'settings.includeAudio': true 
    });
    
    const audios = enhancedAdhkar.audio_resources || [];
    if (audios.length === 0) return;
    
    const randomAudio = audios[Math.floor(Math.random() * audios.length)];
    
    for (const group of groups) {
      try {
        const message = `🎵 *مورد يومي - رابط صوتي*\n\n` +
          `*${randomAudio.title}*\n` +
          (randomAudio.description ? `${randomAudio.description}\n\n` : '\n') +
          `✨ @${bot.options.username}`;
        
        await bot.sendMessage(group.chatId, message, { 
          parse_mode: 'Markdown',
          disable_web_page_preview: true 
        });
        
      } catch (error) {
        console.error(`خطأ في إرسال رابط صوتي للمجموعة ${group.chatId}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ خطأ في إرسال رابط صوتي يومي:', error);
  }
}

// ========== إصلاح الإحصائيات ==========

async function getDetailedStatistics() {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const [
      activeGroups,
      totalGroups,
      totalUsers,
      totalAdhkar,
      pendingAdhkar,
      totalMedia,
      totalCategories,
      todayReminders,
      lastActivityLog,
      enhancedCategoriesCount
    ] = await Promise.all([
      db.GroupSettings.countDocuments({ isActive: true }),
      db.GroupSettings.countDocuments(),
      db.UserSettings.countDocuments(),
      db.CustomAdhkar.countDocuments(),
      db.CustomAdhkar.countDocuments({ approved: false }),
      db.MediaLibrary.countDocuments(),
      db.Category.countDocuments(),
      db.ReminderLog.countDocuments({ sentAt: { $gte: todayStart } }),
      db.ReminderLog.findOne().sort({ sentAt: -1 }),
      db.Category.countDocuments({ isEnhanced: true })
    ]);
    
    const successRate = activeGroups > 0 ? 
      Math.round((todayReminders / (activeGroups * 3)) * 100) : 0;
    
    return {
      activeGroups,
      totalGroups,
      totalUsers,
      totalAdhkar,
      pendingAdhkar,
      totalMedia,
      totalCategories,
      todayReminders,
      enhancedCategoriesCount,
      successRate: Math.min(successRate, 100),
      lastActivity: lastActivityLog ? 
        `${lastActivityLog.sentAt.toLocaleString('ar-SA')} - ${lastActivityLog.reminderType}` : 
        'لا يوجد نشاط'
    };
  } catch (error) {
    console.error('خطأ في حساب الإحصائيات:', error);
    return {
      activeGroups: 0,
      totalGroups: 0,
      totalUsers: 0,
      totalAdhkar: 0,
      pendingAdhkar: 0,
      totalMedia: 0,
      totalCategories: 0,
      todayReminders: 0,
      enhancedCategoriesCount: 0,
      successRate: 0,
      lastActivity: 'غير متوفر'
    };
  }
}

// ========== إصلاح تسجيل المستخدم ==========

async function registerUser(userInfo) {
  try {
    const userId = userInfo.id.toString();
    let user = await db.UserSettings.findOne({ userId });
    
    if (!user) {
      user = new db.UserSettings({
        userId,
        username: userInfo.username,
        firstName: userInfo.first_name,
        lastName: userInfo.last_name,
        isDeveloper: userId === DEVELOPER_ID,
        joinDate: new Date()
      });
    } else {
      user.lastActive = new Date();
      if (userInfo.username) user.username = userInfo.username;
      if (userInfo.first_name) user.firstName = userInfo.first_name;
      if (userInfo.last_name) user.lastName = userInfo.last_name;
    }
    
    await user.save();
    return user;
  } catch (error) {
    console.error('خطأ في تسجيل المستخدم:', error);
    return null;
  }
}

// ========== إصلاح معالجة الأمر /start ==========

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const isPrivate = msg.chat.type === 'private';
  
  try {
    // تسجيل المستخدم
    await registerUser(msg.from);
    
    if (isPrivate) {
      const user = await db.UserSettings.findOne({ userId: userId.toString() });
      const isAdmin = user ? (user.isDeveloper || user.isSuperAdmin) : (userId.toString() === DEVELOPER_ID);
      
      if (isAdmin) {
        await showDeveloperPanel(chatId, userId);
      } else {
        await bot.sendMessage(chatId,
          `🕌 *مرحباً بك في بوت الأذكار الإسلامي*\n\n` +
          `هذا البوت مخصص للمشرفين والمطورين.\n` +
          `أضف البوت إلى مجموعتك ثم أرسل /start هنا لفتح لوحة التحكم.\n\n` +
          `👤 المطور: ${DEVELOPER_USERNAME}`,
          { parse_mode: 'Markdown' }
        );
      }
    } else {
      // في المجموعات: عرض خيارات للمشرفين
      try {
        const chatMember = await bot.getChatMember(chatId, userId);
        if (['administrator', 'creator'].includes(chatMember.status)) {
          const keyboard = {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '⚙️ فتح لوحة التحكم', url: `https://t.me/${bot.options.username}?start=admin` },
                  { text: '📊 إدارة المجموعة', callback_data: `group_admin_${chatId}` }
                ]
              ]
            }
          };
          
          await bot.sendMessage(chatId, 
            `👋 *مرحباً ${msg.from.first_name}*\n\n` +
            `لإدارة إعدادات البوت في هذه المجموعة، اضغط على الزر أدناه:`, 
            { parse_mode: 'Markdown', ...keyboard }
          );
        }
      } catch (error) {
        console.error('خطأ في التحقق من الصلاحيات:', error);
      }
    }
  } catch (error) {
    console.error('خطأ في معالجة /start:', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ. حاول مرة أخرى.');
  }
});

// ========== إصلاح معالجة الأوامر الأخرى ==========

bot.onText(/\/dev/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (userId.toString() === DEVELOPER_ID) {
    await showDeveloperPanel(chatId, userId);
  }
});

bot.onText(/\/enhanced/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  const user = await db.UserSettings.findOne({ userId: userId.toString() });
  if (user && (user.isDeveloper || user.isSuperAdmin)) {
    await showEnhancedCategories(chatId, userId);
  }
});

bot.onText(/\/pdfs/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  const user = await db.UserSettings.findOne({ userId: userId.toString() });
  if (user && (user.isDeveloper || user.isSuperAdmin)) {
    await showEnhancedPDFs(chatId, userId);
  }
});

bot.onText(/\/audios/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  const user = await db.UserSettings.findOne({ userId: userId.toString() });
  if (user && (user.isDeveloper || user.isSuperAdmin)) {
    await showEnhancedAudios(chatId, userId);
  }
});

// ========== بدء البوت المحسن ==========

async function startEnhancedBot() {
  console.log('🚀 بدء تشغيل البوت الإسلامي المطور v2.1...');
  
  try {
    // التحقق من اتصال قاعدة البيانات
    await mongoose.connection.db.admin().ping();
    console.log('✅ تم الاتصال بقاعدة البيانات');
    
    // إعداد الجدولة المحسنة
    setupEnhancedScheduler();
    
    // إنشاء فئات مطورة إذا لم تكن موجودة
    await setupEnhancedCategories();
    
    console.log('✅ البوت المطور يعمل بنجاح!');
    console.log(`👤 المطور: ${DEVELOPER_USERNAME}`);
    console.log(`📊 قاعدة البيانات: ${DATABASE_GROUP_ID}`);
    
    // إعلام المطور
    const stats = await getDetailedStatistics();
    await bot.sendMessage(DEVELOPER_ID,
      `🤖 *تم تشغيل البوت المطور v2.1*\n\n` +
      `🕒 ${new Date().toLocaleString('ar-SA')}\n` +
      `📊 المجموعات النشطة: ${stats.activeGroups}\n` +
      `🌟 الفئات المطورة: ${Object.keys(enhancedAdhkar.categories || {}).length}\n` +
      `💾 الإصدار: 2.1 - نظام محتوى متكامل\n` +
      `✅ الحالة: 🟢 نشط`,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    console.error('❌ خطأ في تشغيل البوت المطور:', error);
    
    // إعلام المطور بالخطأ
    try {
      await bot.sendMessage(DEVELOPER_ID,
        `❌ *خطأ في تشغيل البوت المطور*\n\n` +
        `🕒 ${new Date().toLocaleString('ar-SA')}\n` +
        `📛 الخطأ: ${error.message}\n` +
        `🔧 يرجى التحقق من السيرفر`,
        { parse_mode: 'Markdown' }
      );
    } catch (e) {
      console.error('تعذر إعلام المطور:', e);
    }
  }
}

// إعداد الفئات المطورة في قاعدة البيانات
async function setupEnhancedCategories() {
  try {
    const categories = enhancedAdhkar.categories || {};
    
    for (const [categoryId, categoryData] of Object.entries(categories)) {
      const existingCategory = await db.Category.findOne({ categoryId });
      
      if (!existingCategory) {
        const newCategory = new db.Category({
          categoryId,
          name: categoryData.name,
          description: `فئة مطورة - ${categoryData.name}`,
          icon: '🌟',
          enabled: true,
          isEnhanced: true,
          items: categoryData.items || []
        });
        
        await newCategory.save();
        console.log(`✅ تم إنشاء الفئة المطورة: ${categoryData.name}`);
      }
    }
    
    console.log('✅ تم إعداد الفئات المطورة في قاعدة البيانات');
  } catch (error) {
    console.error('❌ خطأ في إعداد الفئات المطورة:', error);
  }
}

// ========== معالجة الأخطاء المحسنة ==========

process.on('uncaughtException', (error) => {
  console.error('⚠️ خطأ غير متوقع:', error);
  // إرسال تقرير الخطأ للمطور
  try {
    bot.sendMessage(DEVELOPER_ID,
      `⚠️ *خطأ غير متوقع في البوت*\n\n` +
      `🕒 ${new Date().toLocaleString('ar-SA')}\n` +
      `📛 الخطأ: ${error.message}\n` +
      `📋 المكدس: ${error.stack.substring(0, 500)}...`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    console.error('تعذر إرسال تقرير الخطأ:', e);
  }
  
  // محاولة إعادة التشغيل بعد 30 ثانية
  setTimeout(() => {
    console.log('🔄 محاولة إعادة تشغيل البوت...');
    process.exit(1);
  }, 30000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ وعد مرفوض:', reason);
});

// ========== بدء البوت ==========

startEnhancedBot();

// تصدير الدوال للاختبارات
module.exports = {
  bot,
  db,
  broadcastToAllGroups,
  saveToDatabaseGroup,
  getDetailedStatistics,
  showDeveloperPanel,
  showEnhancedCategories,
  showEnhancedPDFs,
  showEnhancedAudios
};