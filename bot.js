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

// إضافة خادم ويب للتحقق من الصحة
const express = require('express');
const healthApp = express();
const HEALTH_PORT = process.env.HEALTH_PORT || 3001;

healthApp.get('/', (req, res) => {
  res.json({ 
    status: 'Bot is running', 
    timestamp: new Date().toISOString(),
    service: 'Telegram Islamic Bot'
  });
});

healthApp.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    bot: 'islamic-telegram-bot',
    version: '2.1.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

healthApp.listen(HEALTH_PORT, () => {
  console.log(`🌐 Health check server running on port ${HEALTH_PORT}`);
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
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    }
  },
  request: {
    timeout: 60000,
    agentOptions: {
      keepAlive: true,
      keepAliveMsecs: 10000
    }
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
  
  // محاولة تحميل ملف الأذكار المطورة
  try {
    enhancedAdhkar = require('./data/enhanced-adhkar.json');
    console.log('✅ تم تحميل بيانات الأذكار المطورة بنجاح');
  } catch (error) {
    console.log('⚠️ ملف الأذكار المطورة غير موجود، سيتم استخدام بيانات افتراضية');
    // إنشاء بيانات افتراضية محسنة
    enhancedAdhkar = {
      categories: {
        sleep: {
          name: "أذكار النوم",
          items: [
            {
              text: "باسمك اللهم أموت وأحيا",
              source: "حصن المسلم - رواه البخاري",
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
              source: "حصن المسلم - رواه البخاري",
              audio: "https://server.islamic.com/audio/wakeup/001.mp3",
              pdf: "https://server.islamic.com/pdf/wakeup-adhkar.pdf"
            }
          ]
        },
        travel: {
          name: "أذكار السفر",
          items: [
            {
              text: "سبحان الذي سخر لنا هذا وما كنا له مقرنين وإنا إلى ربنا لمنقلبون",
              source: "حصن المسلم - سورة الزخرف",
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
              source: "حصن المسلم - رواه الترمذي",
              audio: "https://server.islamic.com/audio/eating/001.mp3",
              pdf: "https://server.islamic.com/pdf/eating-adhkar.pdf"
            }
          ]
        },
        general: {
          name: "أذكار عامة",
          items: [
            {
              text: "سبحان الله وبحمده، سبحان الله العظيم",
              source: "حصن المسلم - رواه البخاري ومسلم",
              audio: "https://server.islamic.com/audio/general/001.mp3",
              pdf: "https://server.islamic.com/pdf/general-adhkar.pdf"
            }
          ]
        }
      },
      pdf_resources: [
        {
          title: "حصن المسلم كامل",
          url: "https://ia800908.us.archive.org/16/items/hisn-muslim-pdf/Hisn_Al-Muslim.pdf",
          description: "كتاب حصن المسلم كامل PDF - الشيخ سعيد بن علي القحطاني"
        },
        {
          title: "الأذكار للنووي",
          url: "https://www.noor-book.com/كتاب-الاذكار-من-كلام-سيد-الابرار-pdf",
          description: "كتاب الأذكار للإمام النووي - تحفة الأخبار"
        }
      ],
      audio_resources: [
        {
          title: "القرآن الكريم كامل - عبد الباسط",
          url: "https://everyayah.com/data/Abdul_Basit_Murattal_128kbps/",
          description: "القرآن الكريم بصوت الشيخ عبد الباسط عبد الصمد"
        },
        {
          title: "أذكار مسموعة كاملة",
          url: "https://server.islamic.com/audio/adhkar/full-collection/",
          description: "مكتبة الأذكار المسموعة من حصن المسلم"
        }
      ]
    };
  }
  
  console.log('✅ تم تحميل جميع بيانات الأذكار بنجاح');
} catch (error) {
  console.error('❌ خطأ في تحميل ملف الأذكار الأساسي:', error);
  islamicData = { categories: {} };
}

// قاعدة البيانات المحسنة
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/islamic_bot_v3', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  retryWrites: true,
  w: 'majority'
}).then(() => {
  console.log('✅ تم الاتصال بقاعدة البيانات بنجاح');
}).catch(err => {
  console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err);
  console.log('⚠️ سيتم استخدام تخزين محلي');
});

// نماذج قاعدة البيانات المحسنة
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
    periodicEnhancedAdhkar: { type: Boolean, default: true },
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
    enhancedCategories: {
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
  isEnhanced: { type: Boolean, default: false }
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
  isEnhancedCategory: { type: Boolean, default: false }
});

// نماذج جديدة
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
  fileType: String,
  fileSize: Number,
  url: String,
  uploadedBy: String,
  uploadedAt: { type: Date, default: Date.now },
  usedIn: [String],
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

// ========== نظام الجلسات المحلي ==========
const userSessions = new Map();

function getUserSession(userId) {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, {
      wizardState: null,
      lastActivity: Date.now(),
      data: {}
    });
  }
  return userSessions.get(userId);
}

function clearOldSessions() {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  for (const [userId, session] of userSessions.entries()) {
    if (now - session.lastActivity > oneHour) {
      userSessions.delete(userId);
    }
  }
}

// تشغيل تنظيف الجلسات القديمة كل ساعة
setInterval(clearOldSessions, 60 * 60 * 1000);

// ========== دوال مساعدة ==========

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
  try {
    const groups = await db.GroupSettings.find({ enabled: true, isActive: true });
    let successCount = 0;
    let failCount = 0;
    
    for (const group of groups) {
      try {
        await bot.sendMessage(group.chatId, message, {
          parse_mode: options.parse_mode || 'Markdown',
          disable_web_page_preview: true,
          ...options
        });
        successCount++;
        
        // تأخير لتجنب حظر التيليجرام
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`خطأ في الإرسال للمجموعة ${group.chatId}:`, error.message);
        failCount++;
        
        if (error.response && error.response.statusCode === 403) {
          group.isActive = false;
          group.lastError = error.message;
          await group.save();
        }
      }
    }
    
    return { successCount, failCount, total: groups.length };
  } catch (error) {
    console.error('❌ خطأ في البث:', error);
    return { successCount: 0, failCount: 0, total: 0 };
  }
}

// ========== لوحة التحكم المحسنة ==========

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
              { text: '🎧 الوسائط', callback_data: 'dev_media' },
              { text: '📨 نظام البث', callback_data: 'dev_broadcast' }
            ],
            [
              { text: '📂 الأقسام', callback_data: 'dev_categories' },
              { text: '🎯 البث المباشر', callback_data: 'dev_livestream' }
            ],
            [
              { text: '📊 التقارير', callback_data: 'dev_reports' },
              { text: '⚙️ إعدادات', callback_data: 'dev_settings' }
            ],
            isDeveloper ? [
              { text: '🔧 صيانة', callback_data: 'dev_maintenance' },
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
              { text: '➕ إضافة ذكر', callback_data: 'add_adhkar' },
              { text: '📋 عرض الأذكار', callback_data: 'list_adhkar' }
            ],
            [
              { text: '✏️ تعديل', callback_data: 'edit_adhkar' },
              { text: '🗑️ حذف', callback_data: 'delete_adhkar' }
            ],
            [
              { text: '◀️ رجوع', callback_data: 'dev_back' }
            ]
          ]
        }
      };
      break;
  }
  
  return keyboard;
}

// ========== عرض لوحة المطور ==========

async function showDeveloperPanel(chatId, userId) {
  try {
    const stats = await getDetailedStatistics();
    
    const message = `👑 *لوحة تحكم المطور*\n\n` +
      `📊 *الإحصائيات:*\n` +
      `👥 المجموعات: ${stats.activeGroups}\n` +
      `📝 الأذكار: ${stats.totalAdhkar}\n` +
      `✅ النجاح: ${stats.successRate}%\n\n` +
      `🔧 *اختر القسم:*`;
    
    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      ...getDeveloperKeyboard(userId, 'main')
    });
  } catch (error) {
    console.error('خطأ في عرض لوحة المطور:', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ في فتح لوحة التحكم. حاول مرة أخرى.');
  }
}

// ========== معالجة الأوامر الرئيسية ==========

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const isPrivate = msg.chat.type === 'private';
  
  console.log(`📩 /start من ${userId} في ${isPrivate ? 'خاص' : 'مجموعة'} ${chatId}`);
  
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
          `👤 المطور: ${DEVELOPER_USERNAME}\n` +
          `💬 الدعم: ${ADMIN_GROUP_ID}`,
          { parse_mode: 'Markdown' }
        );
      }
    } else {
      // في المجموعات
      try {
        const chatMember = await bot.getChatMember(chatId, userId);
        if (['administrator', 'creator'].includes(chatMember.status)) {
          await bot.sendMessage(chatId, 
            `👋 *مرحباً ${msg.from.first_name}*\n\n` +
            `أنا بوت الأذكار الإسلامي 🤖\n\n` +
            `*المميزات:*\n` +
            `• أذكار الصباح والمساء\n` +
            `• أذكار دورية متنوعة\n` +
            `• تذكير يوم الجمعة\n` +
            `• ملفات صوتية وPDF\n\n` +
            `📩 أرسل /start في الخاص للتحكم في الإعدادات`,
            { parse_mode: 'Markdown' }
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

bot.onText(/\/dev/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  console.log(`👑 /dev من ${userId}`);
  
  if (userId.toString() === DEVELOPER_ID) {
    await showDeveloperPanel(chatId, userId);
  } else {
    await bot.sendMessage(chatId, '⛔ ليس لديك صلاحية الوصول إلى لوحة المطور.');
  }
});

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  
  const helpMessage = `🕌 *مساعدة - بوت الأذكار الإسلامي*\n\n` +
    `*الأوامر:*\n` +
    `/start - بدء البوت ولوحة التحكم\n` +
    `/help - هذه الرسالة\n` +
    `/adhkar - ذكر عشوائي\n` +
    `/quran - آية عشوائية\n` +
    `/pdf - روابط ملفات PDF\n` +
    `/audio - روابط صوتية\n\n` +
    `*للمشرفين:*\n` +
    `أرسل /start في الخاص لفتح لوحة التحكم\n\n` +
    `👤 المطور: ${DEVELOPER_USERNAME}\n` +
    `💬 الدعم: ${ADMIN_GROUP_ID}`;
  
  await bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/adhkar/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    // جمع كل الأذكار
    const allAdhkar = [];
    
    // من الأذكار الأساسية
    Object.values(islamicData.categories || {}).forEach(category => {
      if (category.items) {
        category.items.forEach(item => {
          allAdhkar.push({
            ...item,
            categoryName: category.name || 'عام'
          });
        });
      }
    });
    
    // من الأذكار المطورة
    Object.values(enhancedAdhkar.categories || {}).forEach(category => {
      if (category.items) {
        category.items.forEach(item => {
          allAdhkar.push({
            ...item,
            categoryName: category.name || 'مطور'
          });
        });
      }
    });
    
    if (allAdhkar.length > 0) {
      const randomAdhkar = allAdhkar[Math.floor(Math.random() * allAdhkar.length)];
      const message = `🕌 *${randomAdhkar.categoryName}*\n\n` +
        `${randomAdhkar.text}\n\n` +
        (randomAdhkar.source ? `📖 ${randomAdhkar.source}\n\n` : '') +
        `✨ @${bot.options.username}`;
      
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } else {
      await bot.sendMessage(chatId, '❌ لا توجد أذكار متاحة حالياً.');
    }
  } catch (error) {
    console.error('خطأ في /adhkar:', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ في جلب الأذكار.');
  }
});

bot.onText(/\/pdf/, async (msg) => {
  const chatId = msg.chat.id;
  
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
        message += `   ${pdf.description}\n`;
      }
      message += `   ${pdf.url}\n\n`;
    });
    
    message += `✨ @${bot.options.username}`;
    
    await bot.sendMessage(chatId, message, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });
  } catch (error) {
    console.error('خطأ في /pdf:', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ في جلب ملفات PDF.');
  }
});

bot.onText(/\/audio/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    const audios = enhancedAdhkar.audio_resources || [];
    
    if (audios.length === 0) {
      await bot.sendMessage(chatId, '❌ لا توجد روابط صوتية متاحة حالياً.');
      return;
    }
    
    let message = `🎵 *روابط صوتية متاحة*\n\n`;
    
    audios.forEach((audio, index) => {
      message += `${index + 1}. *${audio.title}*\n`;
      if (audio.description) {
        message += `   ${audio.description}\n`;
      }
      message += `   ${audio.url}\n\n`;
    });
    
    message += `✨ @${bot.options.username}`;
    
    await bot.sendMessage(chatId, message, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });
  } catch (error) {
    console.error('خطأ في /audio:', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ في جلب الروابط الصوتية.');
  }
});

// ========== معالجة Callback Queries ==========

bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;
  
  console.log(`📲 Callback: ${data} من ${userId}`);
  
  try {
    // معالجة الإجراءات العامة
    switch(data) {
      case 'dev_back':
        await showDeveloperPanel(msg.chat.id, userId);
        break;
        
      case 'dev_content':
        await showContentManagement(msg.chat.id, userId);
        break;
        
      case 'dev_groups':
        await showGroupManagement(msg.chat.id, userId);
        break;
        
      case 'dev_media':
        await showMediaManagement(msg.chat.id, userId);
        break;
        
      case 'add_adhkar':
        await startAddAdhkarWizard(msg.chat.id, userId);
        break;
        
      case 'list_adhkar':
        await listAllAdhkar(msg.chat.id, userId);
        break;
        
      default:
        if (data.startsWith('category_')) {
          const category = data.replace('category_', '');
          await showCategoryAdhkar(msg.chat.id, userId, category);
        }
    }
    
    await bot.answerCallbackQuery(callbackQuery.id);
  } catch (error) {
    console.error('❌ خطأ في معالجة callback:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { 
      text: '❌ حدث خطأ في المعالجة' 
    });
  }
});

// ========== دوال الإدارة ==========

async function showContentManagement(chatId, userId) {
  try {
    const totalAdhkar = await db.CustomAdhkar.countDocuments();
    const pendingAdhkar = await db.CustomAdhkar.countDocuments({ approved: false });
    
    const message = `📝 *إدارة المحتوى*\n\n` +
      `📊 *الإحصائيات:*\n` +
      `📝 الأذكار الكلية: ${totalAdhkar}\n` +
      `⏳ بانتظار الموافقة: ${pendingAdhkar}\n\n` +
      `🔧 *اختر الإجراء:*`;
    
    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      ...getDeveloperKeyboard(userId, 'content')
    });
  } catch (error) {
    console.error('خطأ في عرض إدارة المحتوى:', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ في فتح إدارة المحتوى.');
  }
}

async function showGroupManagement(chatId, userId) {
  try {
    const activeGroups = await db.GroupSettings.countDocuments({ isActive: true });
    const totalGroups = await db.GroupSettings.countDocuments();
    
    const message = `👥 *إدارة المجموعات*\n\n` +
      `📊 *الإحصائيات:*\n` +
      `🟢 نشطة: ${activeGroups}\n` +
      `📊 الإجمالي: ${totalGroups}\n\n` +
      `🔧 *اختر الإجراء:*`;
    
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📊 إحصائيات', callback_data: 'groups_stats' },
            { text: '👁️ عرض', callback_data: 'view_groups' }
          ],
          [
            { text: '⚙️ إعدادات', callback_data: 'bulk_settings' },
            { text: '📨 إرسال', callback_data: 'bulk_send' }
          ],
          [
            { text: '◀️ رجوع', callback_data: 'dev_back' }
          ]
        ]
      }
    };
    
    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  } catch (error) {
    console.error('خطأ في عرض إدارة المجموعات:', error);
  }
}

async function showMediaManagement(chatId, userId) {
  try {
    const pdfs = enhancedAdhkar.pdf_resources || [];
    const audios = enhancedAdhkar.audio_resources || [];
    
    const message = `🎧 *إدارة الوسائط*\n\n` +
      `📊 *الإحصائيات:*\n` +
      `📄 ملفات PDF: ${pdfs.length}\n` +
      `🎵 روابط صوتية: ${audios.length}\n\n` +
      `🔧 *اختر الإجراء:*`;
    
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📄 عرض PDF', callback_data: 'list_pdfs' },
            { text: '🎵 عرض صوتيات', callback_data: 'list_audios' }
          ],
          [
            { text: '🔗 مشاركة', callback_data: 'share_media' },
            { text: '🔄 تحديث', callback_data: 'refresh_media' }
          ],
          [
            { text: '◀️ رجوع', callback_data: 'dev_back' }
          ]
        ]
      }
    };
    
    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  } catch (error) {
    console.error('خطأ في عرض إدارة الوسائط:', error);
  }
}

async function startAddAdhkarWizard(chatId, userId) {
  try {
    const categories = Object.keys(islamicData.categories || {});
    
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          ...categories.map(cat => [{
            text: islamicData.categories[cat].name || cat,
            callback_data: `select_category_${cat}`
          }]),
          [
            { text: '📁 فئة جديدة', callback_data: 'new_category' },
            { text: '◀️ رجوع', callback_data: 'dev_content' }
          ]
        ]
      }
    };
    
    await bot.sendMessage(chatId, 
      `📝 *إضافة ذكر أو دعاء جديد*\n\n` +
      `اختر الفئة المناسبة:`, 
      { parse_mode: 'Markdown', ...keyboard }
    );
  } catch (error) {
    console.error('خطأ في بدء إضافة ذكر:', error);
  }
}

async function listAllAdhkar(chatId, userId) {
  try {
    const adhkar = await db.CustomAdhkar.find().limit(10).sort({ addedDate: -1 });
    
    if (adhkar.length === 0) {
      await bot.sendMessage(chatId, '📭 لا توجد أذكار مضافة حتى الآن.');
      return;
    }
    
    let message = `📋 *آخر 10 أذكار مضافة*\n\n`;
    
    adhkar.forEach((item, index) => {
      message += `${index + 1}. *${item.category || 'عام'}*\n`;
      message += `   ${item.text.substring(0, 50)}...\n`;
      message += `   👤 ${item.addedByUsername || 'مستخدم'}\n`;
      message += `   ${item.approved ? '✅ مقبول' : '⏳ بانتظار'}\n\n`;
    });
    
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('خطأ في عرض الأذكار:', error);
  }
}

// ========== تسجيل المستخدم ==========

async function registerUser(userInfo) {
  try {
    const userId = userInfo.id.toString();
    
    // التحقق إذا كان المستخدم موجوداً
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
      await user.save();
      console.log(`✅ تم تسجيل مستخدم جديد: ${userInfo.username || userId}`);
    } else {
      // تحديث آخر نشاط
      user.lastActive = new Date();
      if (userInfo.username) user.username = userInfo.username;
      await user.save();
    }
    
    return user;
  } catch (error) {
    console.error('خطأ في تسجيل المستخدم:', error);
    return null;
  }
}

// ========== تسجيل المجموعات ==========

bot.on('message', async (msg) => {
  // تخطي الرسائل الخاصة
  if (msg.chat.type === 'private') return;
  
  const chatId = msg.chat.id.toString();
  const fromId = msg.from?.id.toString();
  
  // تخطي الرسائل التي تبدأ بشرطة مائلة (أوامر)
  if (msg.text && msg.text.startsWith('/')) return;
  
  try {
    let group = await db.GroupSettings.findOne({ chatId });
    
    if (!group) {
      // محاولة الحصول على معلومات المجموعة
      try {
        const chat = await bot.getChat(chatId);
        
        group = new db.GroupSettings({
          chatId,
          chatTitle: chat.title || `المجموعة ${chatId}`,
          chatType: chat.type,
          enabled: true,
          addedBy: fromId || 'auto',
          addedDate: new Date(),
          isActive: true,
          admins: fromId ? [{ userId: fromId, addedDate: new Date() }] : []
        });
        
        await group.save();
        
        console.log(`✅ تم تسجيل مجموعة جديدة: ${chat.title || chatId}`);
        
        // إرسال رسالة ترحيب
        await bot.sendMessage(chatId,
          `🕌 *مرحباً بكم في بوت الأذكار الإسلامي*\n\n` +
          `✅ تم تفعيل البوت في مجموعتك تلقائياً\n\n` +
          `*المميزات:*\n` +
          `• أذكار الصباح والمساء\n` +
          `• أذكار دورية متنوعة\n` +
          `• تذكير يوم الجمعة\n` +
          `• ملفات صوتية وPDF\n\n` +
          `📩 أرسل /start في الخاص للإعدادات\n` +
          `👤 المطور: ${DEVELOPER_USERNAME}`,
          { parse_mode: 'Markdown' }
        );
        
      } catch (error) {
        console.error(`❌ خطأ في تسجيل المجموعة ${chatId}:`, error.message);
      }
    }
  } catch (error) {
    console.error('خطأ في معالجة رسالة المجموعة:', error);
  }
});

// ========== جدولة المهام ==========

function setupScheduler() {
  try {
    console.log('⏰ بدء إعداد الجدولة...');
    
    // أذكار الصباح - 6:00 صباحاً
    cron.schedule('0 6 * * *', async () => {
      console.log('🌅 إرسال أذكار الصباح...');
      await sendMorningAdhkar();
    }, { timezone: 'Asia/Riyadh' });
    
    // أذكار المساء - 6:00 مساءً
    cron.schedule('0 18 * * *', async () => {
      console.log('🌇 إرسال أذكار المساء...');
      await sendEveningAdhkar();
    }, { timezone: 'Asia/Riyadh' });
    
    // الأذكار الدورية - كل ساعتين
    cron.schedule('0 */2 * * *', async () => {
      console.log('🔄 إرسال أذكار دورية...');
      await sendPeriodicAdhkar();
    }, { timezone: 'Asia/Riyadh' });
    
    // يوم الجمعة - 11:00 صباحاً
    cron.schedule('0 11 * * 5', async () => {
      console.log('🕌 إرسال تذكير الجمعة...');
      await sendFridayReminder();
    }, { timezone: 'Asia/Riyadh' });
    
    // الأذكار المطورة - كل 3 ساعات
    cron.schedule('0 */3 * * *', async () => {
      console.log('🌟 إرسال أذكار مطورة...');
      await sendEnhancedAdhkar();
    }, { timezone: 'Asia/Riyadh' });
    
    console.log('✅ تم إعداد الجدولة بنجاح');
  } catch (error) {
    console.error('❌ خطأ في إعداد الجدولة:', error);
  }
}

async function sendMorningAdhkar() {
  try {
    const groups = await db.GroupSettings.find({ 
      isActive: true,
      enabled: true,
      'settings.morningAdhkar': true 
    });
    
    const category = islamicData.categories.morning;
    if (!category || !category.items || category.items.length === 0) return;
    
    const randomItem = category.items[Math.floor(Math.random() * category.items.length)];
    
    for (const group of groups) {
      try {
        const message = `🌅 *${category.name}*\n\n${randomItem.text}\n\n✨ @${bot.options.username}`;
        await bot.sendMessage(group.chatId, message, { parse_mode: 'Markdown' });
        
        // تحديث العداد
        group.reminderCount += 1;
        group.lastReminderSent = new Date();
        await group.save();
        
      } catch (error) {
        console.error(`❌ خطأ في إرسال أذكار الصباح للمجموعة ${group.chatId}:`, error.message);
      }
    }
  } catch (error) {
    console.error('❌ خطأ عام في إرسال أذكار الصباح:', error);
  }
}

async function sendEveningAdhkar() {
  try {
    const groups = await db.GroupSettings.find({ 
      isActive: true,
      enabled: true,
      'settings.eveningAdhkar': true 
    });
    
    const category = islamicData.categories.evening;
    if (!category || !category.items || category.items.length === 0) return;
    
    const randomItem = category.items[Math.floor(Math.random() * category.items.length)];
    
    for (const group of groups) {
      try {
        const message = `🌇 *${category.name}*\n\n${randomItem.text}\n\n✨ @${bot.options.username}`;
        await bot.sendMessage(group.chatId, message, { parse_mode: 'Markdown' });
        
        group.reminderCount += 1;
        group.lastReminderSent = new Date();
        await group.save();
        
      } catch (error) {
        console.error(`❌ خطأ في إرسال أذكار المساء للمجموعة ${group.chatId}:`, error.message);
      }
    }
  } catch (error) {
    console.error('❌ خطأ عام في إرسال أذكار المساء:', error);
  }
}

async function sendPeriodicAdhkar() {
  try {
    const groups = await db.GroupSettings.find({ 
      isActive: true,
      enabled: true,
      'settings.periodicAdhkar': true 
    });
    
    // جمع كل الأذكار من جميع الفئات
    const allAdhkar = [];
    Object.values(islamicData.categories).forEach(category => {
      if (category.items) {
        category.items.forEach(item => {
          allAdhkar.push({
            ...item,
            categoryName: category.name
          });
        });
      }
    });
    
    if (allAdhkar.length === 0) return;
    
    const randomAdhkar = allAdhkar[Math.floor(Math.random() * allAdhkar.length)];
    
    for (const group of groups) {
      try {
        const message = `🔄 *ذكر دوري*\n\n${randomAdhkar.text}\n\n📂 ${randomAdhkar.categoryName}\n✨ @${bot.options.username}`;
        await bot.sendMessage(group.chatId, message, { parse_mode: 'Markdown' });
        
      } catch (error) {
        console.error(`❌ خطأ في إرسال ذكر دوري للمجموعة ${group.chatId}:`, error.message);
      }
    }
  } catch (error) {
    console.error('❌ خطأ عام في إرسال الأذكار الدورية:', error);
  }
}

async function sendFridayReminder() {
  try {
    const groups = await db.GroupSettings.find({ 
      isActive: true,
      enabled: true,
      'settings.fridayReminder': true 
    });
    
    for (const group of groups) {
      try {
        const message = `🕌 *يوم الجمعة المبارك*\n\n` +
          `• قراءة سورة الكهف نور ما بين الجمعتين\n` +
          `• فيه ساعة إجابة فأكثروا من الدعاء\n` +
          `• الصلاة على النبي ﷺ\n\n` +
          `✨ @${bot.options.username}`;
        
        await bot.sendMessage(group.chatId, message, { parse_mode: 'Markdown' });
        
      } catch (error) {
        console.error(`❌ خطأ في إرسال تذكير الجمعة للمجموعة ${group.chatId}:`, error.message);
      }
    }
  } catch (error) {
    console.error('❌ خطأ عام في إرسال تذكير الجمعة:', error);
  }
}

async function sendEnhancedAdhkar() {
  try {
    const groups = await db.GroupSettings.find({ 
      isActive: true,
      enabled: true,
      'settings.periodicEnhancedAdhkar': true 
    });
    
    const categories = enhancedAdhkar.categories;
    if (!categories) return;
    
    const categoryKeys = Object.keys(categories);
    if (categoryKeys.length === 0) return;
    
    const randomCategoryKey = categoryKeys[Math.floor(Math.random() * categoryKeys.length)];
    const randomCategory = categories[randomCategoryKey];
    
    if (!randomCategory.items || randomCategory.items.length === 0) return;
    
    const randomItem = randomCategory.items[Math.floor(Math.random() * randomCategory.items.length)];
    
    for (const group of groups) {
      // التحقق من تفعيل الفئة في إعدادات المجموعة
      if (group.settings.enhancedCategories && 
          group.settings.enhancedCategories[randomCategoryKey] !== false) {
        
        try {
          const message = `🌟 *${randomCategory.name}*\n\n${randomItem.text}\n\n✨ @${bot.options.username}`;
          await bot.sendMessage(group.chatId, message, { parse_mode: 'Markdown' });
          
        } catch (error) {
          console.error(`❌ خطأ في إرسال ذكر مطور للمجموعة ${group.chatId}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.error('❌ خطأ عام في إرسال الأذكار المطورة:', error);
  }
}

// ========== إحصائيات النظام ==========

async function getDetailedStatistics() {
  try {
    const activeGroups = await db.GroupSettings.countDocuments({ isActive: true });
    const totalAdhkar = await db.CustomAdhkar.countDocuments();
    
    return {
      activeGroups,
      totalAdhkar,
      successRate: activeGroups > 0 ? 95 : 0
    };
  } catch (error) {
    console.error('خطأ في حساب الإحصائيات:', error);
    return {
      activeGroups: 0,
      totalAdhkar: 0,
      successRate: 0
    };
  }
}

// ========== بدء البوت ==========

async function startBot() {
  console.log('🚀 بدء تشغيل البوت الإسلامي v2.1...');
  
  try {
    // التحقق من اتصال قاعدة البيانات
    if (mongoose.connection.readyState === 1) {
      console.log('✅ تم الاتصال بقاعدة البيانات');
    } else {
      console.log('⚠️ قاعدة البيانات غير متصلة، سيتم استخدام النظام دون قاعدة بيانات');
    }
    
    // إعداد الجدولة
    setupScheduler();
    
    // إعلام المطور
    await bot.sendMessage(DEVELOPER_ID,
      `🤖 *تم تشغيل البوت v2.1*\n\n` +
      `🕒 ${new Date().toLocaleString('ar-SA')}\n` +
      `✅ الحالة: 🟢 نشط\n` +
      `✨ الإصدار: 2.1 - نظام محتوى متكامل`,
      { parse_mode: 'Markdown' }
    );
    
    console.log('✅ البوت يعمل بنجاح!');
    console.log(`👤 المطور: ${DEVELOPER_USERNAME}`);
    console.log(`📊 قاعدة البيانات: ${DATABASE_GROUP_ID}`);
    
  } catch (error) {
    console.error('❌ خطأ في تشغيل البوت:', error);
    
    // إعلام المطور بالخطأ
    try {
      await bot.sendMessage(DEVELOPER_ID,
        `❌ *خطأ في تشغيل البوت*\n\n` +
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

// ========== معالجة الأخطاء ==========

process.on('uncaughtException', (error) => {
  console.error('⚠️ خطأ غير متوقع:', error);
  
  // محاولة إعادة التشغيل بعد 30 ثانية
  setTimeout(() => {
    console.log('🔄 محاولة إعادة تشغيل البوت...');
    process.exit(1);
  }, 30000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ وعد مرفوض:', reason);
});

// ========== تشغيل البوت ==========

// بدء البوت بعد تأخير قصير
setTimeout(() => {
  startBot();
}, 2000);

// تشغيل تنظيف الجلسات القديمة كل ساعة
setInterval(clearOldSessions, 60 * 60 * 1000);

// ========== تصدير الدوال ==========

module.exports = {
  bot,
  db,
  broadcastToAllGroups,
  saveToDatabaseGroup,
  getDetailedStatistics,
  showDeveloperPanel
};