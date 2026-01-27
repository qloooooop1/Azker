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

// ... باقي كود البوت يبقى كما هو ...
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

// باقي كود البوت يبقى كما هو...
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
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs-extra');
const path = require('path');
const mongoose = require('mongoose');
const cron = require('node-cron');
const moment = require('moment-timezone');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// تعريف الثوابت
const token = process.env.BOT_TOKEN || '8507528865:AAGxbvXjNVg7ITo3awlwn9RRbfUiSDcngZw';
const bot = new TelegramBot(token, { polling: true });

// إعدادات المجموعات
const ADMIN_GROUP_ID = '-1003595290365';
const DATABASE_GROUP_ID = '-1003624663502';
const DEVELOPER_ID = '6960704733';
const DEVELOPER_USERNAME = '@dev3bod';

// تحميل بيانات الأذكار
let islamicData = {};
try {
  islamicData = require('./data/adhkar.json');
  console.log('✅ تم تحميل بيانات الأذكار بنجاح');
} catch (error) {
  console.error('❌ خطأ في تحميل ملف الأذكار:', error);
  islamicData = { categories: {} };
}

// قاعدة البيانات
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/islamic_bot_v2', {
  useNewUrlParser: true,
  useUnifiedTopology: true
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
    reminderInterval: { type: Number, default: 60 },
    sendAsDocument: { type: Boolean, default: false },
    includeAudio: { type: Boolean, default: true },
    includePDF: { type: Boolean, default: true }
  },
  customSchedule: {
    morningTime: { type: String, default: '06:00' },
    eveningTime: { type: String, default: '18:00' },
    fridayTime: { type: String, default: '11:00' }
  },
  lastReminderSent: Date,
  reminderCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
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
  includesPDF: Boolean
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
  targetGroups: [String], // 'all' أو IDs محددة
  sentCount: { type: Number, default: 0 }
});

// إنشاء النماذج
const db = {
  GroupSettings: mongoose.model('GroupSettings', groupSettingsSchema),
  UserSettings: mongoose.model('UserSettings', userSettingsSchema),
  ReminderLog: mongoose.model('ReminderLog', reminderLogSchema),
  CustomAdhkar: mongoose.model('CustomAdhkar', customAdhkarSchema)
};

// وظائف مساعدة
async function saveToDatabaseGroup(content, type) {
  try {
    const message = `📥 *إضافة جديدة*\n\n`
      + `📌 النوع: ${type}\n`
      + `⏰ الوقت: ${new Date().toLocaleString('ar-SA')}\n`
      + `📝 المحتوى:\n${content.substring(0, 500)}...`;
    
    await bot.sendMessage(DATABASE_GROUP_ID, message, { parse_mode: 'Markdown' });
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
  
  for (const group of groups) {
    try {
      await bot.sendMessage(group.chatId, message, options);
      successCount++;
      
      // إضافة تأخير لتجنب حظر التيليجرام
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`خطأ في الإرسال للمجموعة ${group.chatId}:`, error.message);
      failCount++;
      
      // إذا كانت المجموعة محذوفة، تعطيلها
      if (error.response && error.response.statusCode === 403) {
        group.isActive = false;
        await group.save();
      }
    }
  }
  
  return { successCount, failCount, total: groups.length };
}

// لوحة التحكم المحسنة
function getDeveloperKeyboard(userId) {
  const isDeveloper = userId.toString() === DEVELOPER_ID;
  
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📝 إضافة ذكر/دعاء', callback_data: 'add_adhkar' },
          { text: '📊 إدارة المحتوى', callback_data: 'manage_content' }
        ],
        [
          { text: '👥 إدارة المجموعات', callback_data: 'manage_groups' },
          { text: '🔄 جدولة البث', callback_data: 'schedule_broadcast' }
        ],
        [
          { text: '📨 بث مباشر', callback_data: 'instant_broadcast' },
          { text: '⚙️ إعدادات متقدمة', callback_data: 'advanced_settings' }
        ],
        [
          { text: '💾 نسخة احتياطية', callback_data: 'backup_data' },
          { text: '📈 إحصائيات مفصلة', callback_data: 'detailed_stats' }
        ],
        [
          { text: '🔧 صيانة النظام', callback_data: 'system_maintenance' },
          { text: '🎯 اختبار الإرسال', callback_data: 'test_send' }
        ]
      ]
    }
  };
  
  if (!isDeveloper) {
    keyboard.reply_markup.inline_keyboard = keyboard.reply_markup.inline_keyboard.filter(row => 
      !['🔧 صيانة النظام', '🎯 اختبار الإرسال'].includes(row[0].text)
    );
  }
  
  return keyboard;
}

// معالجة الأوامر
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const isPrivate = msg.chat.type === 'private';
  
  // تسجيل المستخدم
  await registerUser(msg.from);
  
  if (!isPrivate) {
    // في المجموعات: عرض خيارات للمديرين
    try {
      const chatMember = await bot.getChatMember(chatId, userId);
      if (['administrator', 'creator'].includes(chatMember.status)) {
        const keyboard = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '⚙️ فتح لوحة التحكم', url: `https://t.me/${bot.options.username}?start=group_${chatId}` },
                { text: '📊 إعدادات المجموعة', callback_data: `group_settings_${chatId}` }
              ]
            ]
          }
        };
        
        await bot.sendMessage(chatId, 
          `👋 *مرحباً ${msg.from.first_name}*\n\n` +
          `لتحكم في إعدادات البوت في هذه المجموعة، اضغط على الزر أدناه:`, 
          { parse_mode: 'Markdown', ...keyboard }
        );
      }
    } catch (error) {
      console.error('خطأ في التحقق من الصلاحيات:', error);
    }
    return;
  }
  
  // في الخاص: عرض لوحة التحكم المناسبة
  const user = await db.UserSettings.findOne({ userId: userId.toString() });
  const isAdmin = user ? (user.isDeveloper || user.isSuperAdmin) : (userId.toString() === DEVELOPER_ID);
  
  if (isAdmin) {
    await showDeveloperPanel(chatId, userId);
  } else {
    await showUserDashboard(chatId, userId);
  }
});

// لوحة المطور المحسنة
async function showDeveloperPanel(chatId, userId) {
  const stats = await getDetailedStatistics();
  
  const message = `👑 *لوحة تحكم المطور*\n\n` +
    `📊 *الإحصائيات الحالية:*\n` +
    `👥 مجموعات نشطة: ${stats.activeGroups}\n` +
    `📨 رسائل اليوم: ${stats.todayMessages}\n` +
    `📝 أذكار مضافة: ${stats.totalAdhkar}\n` +
    `✅ ناجحة: ${stats.successRate}%\n\n` +
    `⏰ *آخر نشاط:*\n${stats.lastActivity}\n\n` +
    `🔧 *الأدوات المتاحة:*\n` +
    `يمكنك إدارة جميع محتويات البوت من هنا`;
  
  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    ...getDeveloperKeyboard(userId)
  });
}

// إضافة ذكر/دعاء جديد
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;
  
  try {
    switch(data) {
      case 'add_adhkar':
        await startAddAdhkarWizard(msg.chat.id, userId);
        break;
        
      case 'manage_content':
        await showContentManagement(msg.chat.id, userId);
        break;
        
      case 'instant_broadcast':
        await startInstantBroadcast(msg.chat.id, userId);
        break;
        
      case 'schedule_broadcast':
        await showScheduleOptions(msg.chat.id, userId);
        break;
        
      case 'manage_groups':
        await showGroupManagement(msg.chat.id, userId);
        break;
        
      default:
        if (data.startsWith('category_')) {
          const category = data.replace('category_', '');
          await showCategoryAdhkar(msg.chat.id, userId, category);
        }
    }
    
    await bot.answerCallbackQuery(callbackQuery.id);
  } catch (error) {
    console.error('خطأ في معالجة callback:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ حدث خطأ، حاول مرة أخرى' });
  }
});

// واجهة إضافة ذكر/دعاء
async function startAddAdhkarWizard(chatId, userId) {
  const categories = Object.keys(islamicData.categories || {});
  
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        ...categories.map(cat => [{
          text: islamicData.categories[cat].name,
          callback_data: `select_category_${cat}`
        }]),
        [
          { text: '📁 فئة جديدة', callback_data: 'new_category' },
          { text: '◀️ عودة', callback_data: 'back_to_dev' }
        ]
      ]
    }
  };
  
  await bot.sendMessage(chatId, 
    `📝 *إضافة ذكر أو دعاء جديد*\n\n` +
    `اختر الفئة المناسبة للذكر/الدعاء:`, 
    { parse_mode: 'Markdown', ...keyboard }
  );
}

// معالجة اختيار الفئة
bot.on('callback_query', async (callbackQuery) => {
  const data = callbackQuery.data;
  
  if (data.startsWith('select_category_')) {
    const category = data.replace('select_category_', '');
    await askForAdhkarText(callbackQuery.message.chat.id, callbackQuery.from.id, category);
  }
});

// طلب نص الذكر
async function askForAdhkarText(chatId, userId, category) {
  await bot.sendMessage(chatId,
    `📝 *إضافة ذكر لفئة ${islamicData.categories[category].name}*\n\n` +
    `أرسل نص الذكر أو الدعاء الآن:\n\n` +
    `*ملاحظة:* يمكنك إضافة:\n` +
    `• رابط صوتي (mp3)\n` +
    `• رابط PDF\n` +
    `• المصدر (اختياري)`,
    { parse_mode: 'Markdown' }
  );
  
  // حفظ الحالة
  const user = await db.UserSettings.findOne({ userId: userId.toString() });
  user.adhkarWizard = { category, step: 'text' };
  await user.save();
}

// معالجة الرسائل النصية لإضافة الأذكار
bot.on('message', async (msg) => {
  if (msg.chat.type !== 'private' || !msg.text || msg.text.startsWith('/')) {
    return;
  }
  
  const userId = msg.from.id.toString();
  const user = await db.UserSettings.findOne({ userId });
  
  if (user && user.adhkarWizard) {
    await processAdhkarWizard(msg, user);
  }
});

async function processAdhkarWizard(msg, user) {
  const chatId = msg.chat.id;
  const wizard = user.adhkarWizard;
  
  switch(wizard.step) {
    case 'text':
      wizard.text = msg.text;
      wizard.step = 'source';
      
      await bot.sendMessage(chatId,
        `📚 *الخطوة 2: المصدر*\n\n` +
        `أرسل مصدر الذكر (مثال: حصن المسلم، صحيح البخاري، إلخ):\n\n` +
        `أو أرسل /تخطي للاستمرار`,
        { parse_mode: 'Markdown' }
      );
      break;
      
    case 'source':
      if (msg.text !== '/تخطي') {
        wizard.source = msg.text;
      }
      wizard.step = 'audio';
      
      await bot.sendMessage(chatId,
        `🎵 *الخطوة 3: رابط صوتي*\n\n` +
        `أرسل رابط صوتي للذكر (MP3):\n\n` +
        `أو أرسل /تخطي للاستمرار`,
        { parse_mode: 'Markdown' }
      );
      break;
      
    case 'audio':
      if (msg.text !== '/تخطي') {
        wizard.audioUrl = msg.text;
      }
      wizard.step = 'pdf';
      
      await bot.sendMessage(chatId,
        `📄 *الخطوة 4: رابط PDF*\n\n` +
        `أرسل رابط PDF (اختياري):\n\n` +
        `أو أرسل /تخطي للاستمرار`,
        { parse_mode: 'Markdown' }
      );
      break;
      
    case 'pdf':
      if (msg.text !== '/تخطي') {
        wizard.pdfUrl = msg.text;
      }
      wizard.step = 'schedule';
      
      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '⏰ فوراً', callback_data: 'schedule_now' },
              { text: '📅 جدولة', callback_data: 'schedule_later' }
            ],
            [
              { text: '🔄 متكرر', callback_data: 'schedule_recurring' }
            ]
          ]
        }
      };
      
      await bot.sendMessage(chatId,
        `⏰ *الخطوة 5: الجدولة*\n\n` +
        `متى تريد إرسال هذا الذكر؟`,
        { parse_mode: 'Markdown', ...keyboard }
      );
      break;
  }
  
  user.adhkarWizard = wizard;
  await user.save();
}

// معالجة جدولة الذكر
bot.on('callback_query', async (callbackQuery) => {
  const data = callbackQuery.data;
  const userId = callbackQuery.from.id.toString();
  
  if (data.startsWith('schedule_')) {
    const user = await db.UserSettings.findOne({ userId });
    const wizard = user.adhkarWizard;
    
    if (data === 'schedule_now') {
      await saveAndBroadcastAdhkar(userId, wizard, 'now');
    } else if (data === 'schedule_later') {
      await askForScheduleTime(callbackQuery.message.chat.id, userId);
    } else if (data === 'schedule_recurring') {
      await askForRecurrencePattern(callbackQuery.message.chat.id, userId);
    }
  }
});

// حفظ الذكر وإرساله
async function saveAndBroadcastAdhkar(userId, wizard, scheduleType) {
  // حفظ في قاعدة البيانات
  const newAdhkar = new db.CustomAdhkar({
    addedBy: userId,
    addedByUsername: wizard.username,
    category: wizard.category,
    text: wizard.text,
    source: wizard.source || 'مستخدم',
    audioUrl: wizard.audioUrl,
    pdfUrl: wizard.pdfUrl,
    approved: userId === DEVELOPER_ID, // المطور يوافق تلقائياً
    addedDate: new Date()
  });
  
  if (scheduleType === 'now') {
    newAdhkar.scheduledDate = new Date();
    newAdhkar.targetGroups = ['all'];
  }
  
  await newAdhkar.save();
  
  // حفظ في مجموعة قاعدة البيانات
  const dbMessage = `📥 *تم إضافة ذكر جديد*\n\n` +
    `👤 المضيف: ${wizard.username || userId}\n` +
    `📂 الفئة: ${islamicData.categories[wizard.category].name}\n` +
    `📝 النص: ${wizard.text.substring(0, 200)}...\n` +
    `⏰ الجدولة: ${scheduleType}\n` +
    `✅ الحالة: ${newAdhkar.approved ? 'مقبول' : 'بانتظار الموافقة'}`;
  
  await saveToDatabaseGroup(dbMessage, 'إضافة ذكر');
  
  // إذا كان مقبولاً، نشره على المجموعات
  if (newAdhkar.approved && scheduleType === 'now') {
    await broadcastCustomAdhkar(newAdhkar);
  }
  
  // إرسال تأكيد للمستخدم
  const userChatId = (await db.UserSettings.findOne({ userId }))?.chatId || userId;
  await bot.sendMessage(userChatId,
    `✅ *تم حفظ الذكر بنجاح*\n\n` +
    `سيتم ${newAdhkar.approved ? 'نشره على المجموعات' : 'مراجعته من قبل المطور'}`,
    { parse_mode: 'Markdown' }
  );
}

// بث الذكر المخصص
async function broadcastCustomAdhkar(adhkar) {
  const groups = await db.GroupSettings.find({ enabled: true, isActive: true });
  
  for (const group of groups) {
    try {
      let message = `🕌 *${islamicData.categories[adhkar.category].name}*\n\n` +
        `${adhkar.text}\n\n`;
      
      if (adhkar.source) {
        message += `📖 المصدر: ${adhkar.source}\n\n`;
      }
      
      message += `✨ شارك الخير: @${bot.options.username}`;
      
      const options = { parse_mode: 'Markdown' };
      
      // إضافة الوسائط
      if (adhkar.audioUrl && group.settings.includeAudio) {
        try {
          await bot.sendAudio(group.chatId, adhkar.audioUrl, {
            caption: message,
            parse_mode: 'Markdown'
          });
          continue;
        } catch (error) {
          console.error('خطأ في إرسال الصوت:', error);
        }
      }
      
      if (adhkar.pdfUrl && group.settings.includePDF) {
        try {
          await bot.sendDocument(group.chatId, adhkar.pdfUrl, {
            caption: message,
            parse_mode: 'Markdown'
          });
          continue;
        } catch (error) {
          console.error('خطأ في إرسال PDF:', error);
        }
      }
      
      // إرسال نصي فقط
      await bot.sendMessage(group.chatId, message, options);
      
      // تحديث العداد
      adhkar.sentCount += 1;
      await adhkar.save();
      
      // تسجيل في السجل
      await new db.ReminderLog({
        chatId: group.chatId,
        reminderType: 'custom',
        category: adhkar.category,
        adhkarId: adhkar.adhkarId,
        message: adhkar.text,
        includesAudio: !!adhkar.audioUrl,
        includesPDF: !!adhkar.pdfUrl
      }).save();
      
      // تأخير بين المجموعات
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`خطأ في البث للمجموعة ${group.chatId}:`, error.message);
    }
  }
}

// إدارة المحتوى
async function showContentManagement(chatId, userId) {
  const pendingCount = await db.CustomAdhkar.countDocuments({ approved: false });
  const totalCount = await db.CustomAdhkar.countDocuments();
  
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: `📝 المعروضات (${pendingCount})`, callback_data: 'view_pending' },
          { text: `📊 الكل (${totalCount})`, callback_data: 'view_all_content' }
        ],
        [
          { text: '🔍 بحث في المحتوى', callback_data: 'search_content' },
          { text: '📂 تصدير المحتوى', callback_data: 'export_content' }
        ],
        [
          { text: '◀️ عودة', callback_data: 'back_to_dev' }
        ]
      ]
    }
  };
  
  await bot.sendMessage(chatId,
    `📊 *إدارة المحتوى*\n\n` +
    `• معروضات بانتظار الموافقة: ${pendingCount}\n` +
    `• إجمالي المحتوى: ${totalCount}\n\n` +
    `اختر الإجراء المطلوب:`,
    { parse_mode: 'Markdown', ...keyboard }
  );
}

// بث مباشر
async function startInstantBroadcast(chatId, userId) {
  await bot.sendMessage(chatId,
    `📨 *البث المباشر*\n\n` +
    `أرسل الرسالة التي تريد بثها لجميع المجموعات:\n\n` +
    `*يمكنك إضافة:*\n` +
    `• نص\n` +
    `• صور\n` +
    `• صوت\n` +
    `• ملفات\n\n` +
    `أو أرسل /إلغاء للإلغاء`,
    { parse_mode: 'Markdown' }
  );
  
  const user = await db.UserSettings.findOne({ userId: userId.toString() });
  user.broadcastWizard = { step: 'message' };
  await user.save();
}

// معالجة البث المباشر
bot.on('message', async (msg) => {
  if (msg.chat.type !== 'private' || !msg.text || msg.text.startsWith('/')) {
    return;
  }
  
  const userId = msg.from.id.toString();
  const user = await db.UserSettings.findOne({ userId });
  
  if (user && user.broadcastWizard) {
    if (msg.text === '/إلغاء') {
      delete user.broadcastWizard;
      await user.save();
      await bot.sendMessage(msg.chat.id, 'تم إلغاء البث المباشر.');
      return;
    }
    
    await processBroadcastWizard(msg, user);
  }
});

async function processBroadcastWizard(msg, user) {
  const chatId = msg.chat.id;
  const wizard = user.broadcastWizard;
  
  if (wizard.step === 'message') {
    wizard.message = msg.text || msg.caption || '';
    wizard.media = msg.photo ? msg.photo[0].file_id : 
                   msg.audio ? msg.audio.file_id : 
                   msg.document ? msg.document.file_id : null;
    wizard.mediaType = msg.photo ? 'photo' : 
                       msg.audio ? 'audio' : 
                       msg.document ? 'document' : 'text';
    
    wizard.step = 'confirm';
    
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ تأكيد البث', callback_data: 'confirm_broadcast' },
            { text: '❌ إلغاء', callback_data: 'cancel_broadcast' }
          ]
        ]
      }
    };
    
    await bot.sendMessage(chatId,
      `📨 *تأكيد البث المباشر*\n\n` +
      `الرسالة: ${wizard.message.substring(0, 200)}...\n\n` +
      `سيتم إرسال هذه الرسالة لجميع المجموعات النشطة.\n` +
      `هل تريد المتابعة؟`,
      { parse_mode: 'Markdown', ...keyboard }
    );
  }
}

// تأكيد البث
bot.on('callback_query', async (callbackQuery) => {
  const data = callbackQuery.data;
  const userId = callbackQuery.from.id.toString();
  
  if (data === 'confirm_broadcast') {
    const user = await db.UserSettings.findOne({ userId });
    const wizard = user.broadcastWizard;
    
    if (wizard) {
      await executeBroadcast(userId, wizard);
      delete user.broadcastWizard;
      await user.save();
    }
  } else if (data === 'cancel_broadcast') {
    const user = await db.UserSettings.findOne({ userId });
    delete user.broadcastWizard;
    await user.save();
    await bot.editMessageText('تم إلغاء البث.', {
      chat_id: callbackQuery.message.chat.id,
      message_id: callbackQuery.message.message_id
    });
  }
});

async function executeBroadcast(userId, wizard) {
  const groups = await db.GroupSettings.find({ enabled: true, isActive: true });
  const totalGroups = groups.length;
  let sentCount = 0;
  
  // إرسال رسالة بدء البث
  await bot.sendMessage(userId, `🚀 بدء البث لـ ${totalGroups} مجموعة...`);
  
  for (const group of groups) {
    try {
      switch(wizard.mediaType) {
        case 'photo':
          await bot.sendPhoto(group.chatId, wizard.media, {
            caption: wizard.message,
            parse_mode: 'Markdown'
          });
          break;
        case 'audio':
          await bot.sendAudio(group.chatId, wizard.media, {
            caption: wizard.message,
            parse_mode: 'Markdown'
          });
          break;
        case 'document':
          await bot.sendDocument(group.chatId, wizard.media, {
            caption: wizard.message,
            parse_mode: 'Markdown'
          });
          break;
        default:
          await bot.sendMessage(group.chatId, wizard.message, {
            parse_mode: 'Markdown'
          });
      }
      
      sentCount++;
      
      // تحديث التقدم كل 10 مجموعات
      if (sentCount % 10 === 0) {
        await bot.sendMessage(userId, 
          `📤 تم إرسال ${sentCount}/${totalGroups} (${Math.round(sentCount/totalGroups*100)}%)`
        );
      }
      
      // تأخير بين الإرسالات
      await new Promise(resolve => setTimeout(resolve, 150));
      
    } catch (error) {
      console.error(`خطأ في البث للمجموعة ${group.chatId}:`, error.message);
    }
  }
  
  // إرسال تقرير النهاية
  const successRate = Math.round(sentCount/totalGroups*100);
  await bot.sendMessage(userId,
    `✅ *تم الانتهاء من البث*\n\n` +
    `📊 النتائج:\n` +
    `• إجمالي المجموعات: ${totalGroups}\n` +
    `• تم الإرسال بنجاح: ${sentCount}\n` +
    `• نسبة النجاح: ${successRate}%\n\n` +
    `⏰ الوقت: ${new Date().toLocaleString('ar-SA')}`,
    { parse_mode: 'Markdown' }
  );
  
  // حفظ في مجموعة قاعدة البيانات
  const dbMessage = `📨 *بث مباشر جديد*\n\n` +
    `👤 المرسل: ${userId}\n` +
    `📝 الرسالة: ${wizard.message.substring(0, 200)}...\n` +
    `📤 تم الإرسال لـ: ${sentCount}/${totalGroups}\n` +
    `✅ النجاح: ${successRate}%`;
  
  await saveToDatabaseGroup(dbMessage, 'بث مباشر');
}

// جدولة البث
async function showScheduleOptions(chatId, userId) {
  const scheduled = await db.CustomAdhkar.countDocuments({ 
    scheduledDate: { $gt: new Date() } 
  });
  
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📅 جدولة ذكر', callback_data: 'schedule_single' },
          { text: '🔄 جدولة متكررة', callback_data: 'schedule_recurring' }
        ],
        [
          { text: `📋 الجدول (${scheduled})`, callback_data: 'view_schedule' },
          { text: '🗑️ حذف مجدول', callback_data: 'delete_schedule' }
        ],
        [
          { text: '◀️ عودة', callback_data: 'back_to_dev' }
        ]
      ]
    }
  };
  
  await bot.sendMessage(chatId,
    `⏰ *جدولة البث*\n\n` +
    `• المهام المجدولة: ${scheduled}\n\n` +
    `اختر نوع الجدولة:`,
    { parse_mode: 'Markdown', ...keyboard }
  );
}

// إدارة المجموعات
async function showGroupManagement(chatId, userId) {
  const activeGroups = await db.GroupSettings.countDocuments({ isActive: true });
  const totalGroups = await db.GroupSettings.countDocuments();
  
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: `👥 المجموعات النشطة (${activeGroups})`, callback_data: 'view_active_groups' },
          { text: `📊 إحصائيات المجموعات`, callback_data: 'groups_stats' }
        ],
        [
          { text: '🔍 بحث عن مجموعة', callback_data: 'search_group' },
          { text: '📋 تصدير البيانات', callback_data: 'export_groups' }
        ],
        [
          { text: '⚙️ إعدادات جماعية', callback_data: 'bulk_settings' },
          { text: '📨 إرسال جماعي', callback_data: 'bulk_send' }
        ],
        [
          { text: '◀️ عودة', callback_data: 'back_to_dev' }
        ]
      ]
    }
  };
  
  await bot.sendMessage(chatId,
    `👥 *إدارة المجموعات*\n\n` +
    `• إجمالي المجموعات: ${totalGroups}\n` +
    `• مجموعات نشطة: ${activeGroups}\n` +
    `• نسبة النشاط: ${Math.round(activeGroups/totalGroups*100)}%\n\n` +
    `اختر الإجراء المطلوب:`,
    { parse_mode: 'Markdown', ...keyboard }
  );
}

// إحصائيات مفصلة
async function getDetailedStatistics() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart - 24*60*60*1000);
  
  const [
    activeGroups,
    totalGroups,
    todayMessages,
    yesterdayMessages,
    totalAdhkar,
    pendingAdhkar,
    lastActivityLog
  ] = await Promise.all([
    db.GroupSettings.countDocuments({ isActive: true }),
    db.GroupSettings.countDocuments(),
    db.ReminderLog.countDocuments({ sentAt: { $gte: todayStart } }),
    db.ReminderLog.countDocuments({ sentAt: { $gte: yesterdayStart, $lt: todayStart } }),
    db.CustomAdhkar.countDocuments(),
    db.CustomAdhkar.countDocuments({ approved: false }),
    db.ReminderLog.findOne().sort({ sentAt: -1 })
  ]);
  
  const successRate = todayMessages > 0 ? 
    Math.round((todayMessages / (activeGroups * 5)) * 100) : 0;
  
  return {
    activeGroups,
    totalGroups,
    todayMessages,
    yesterdayMessages,
    totalAdhkar,
    pendingAdhkar,
    successRate: Math.min(successRate, 100),
    lastActivity: lastActivityLog ? 
      `${lastActivityLog.sentAt.toLocaleString('ar-SA')}\n${lastActivityLog.reminderType}` : 
      'لا يوجد نشاط'
  };
}

// تسجيل المستخدم
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

// تسجيل المجموعة تلقائياً
bot.on('message', async (msg) => {
  if (msg.chat.type === 'private' || msg.text?.startsWith('/')) {
    return;
  }
  
  const chatId = msg.chat.id.toString();
  
  try {
    let group = await db.GroupSettings.findOne({ chatId });
    
    if (!group) {
      // الحصول على معلومات المجموعة
      const chat = await bot.getChat(chatId);
      
      group = new db.GroupSettings({
        chatId,
        chatTitle: chat.title,
        chatType: chat.type,
        enabled: true,
        addedBy: msg.from?.id.toString() || 'auto',
        addedDate: new Date(),
        isActive: true
      });
      
      await group.save();
      
      // إرسال رسالة ترحيب
      await bot.sendMessage(chatId,
        `🕌 *مرحباً بكم في بوت الأذكار الإسلامي*\n\n` +
        `✅ تم تفعيل البوت تلقائياً في مجموعتك\n\n` +
        `*المميزات:*\n` +
        `• أذكار الصباح والمساء\n` +
        `• تذكير سورة الكهف يوم الجمعة\n` +
        `• المناسبات الإسلامية\n` +
        `• ملفات صوتية وPDF\n\n` +
        `⚙️ للإعدادات: أرسل /start في الخاص\n\n` +
        `📚 ${DEVELOPER_USERNAME}`,
        { parse_mode: 'Markdown' }
      );
      
      // إعلام المطور
      await bot.sendMessage(DEVELOPER_ID,
        `🆕 *مجموعة جديدة*\n\n` +
        `📝 الاسم: ${chat.title}\n` +
        `🆔 المعرف: ${chatId}\n` +
        `👤 المضيف: ${msg.from?.username || 'غير معروف'}\n` +
        `📊 الإجمالي: ${await db.GroupSettings.countDocuments()}`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (error) {
    console.error('خطأ في تسجيل المجموعة:', error);
  }
});

// جدولة المهام الأساسية
function scheduleBaseTasks() {
  // أذكار الصباح
  cron.schedule('0 6 * * *', async () => {
    await sendScheduledAdhkar('morning');
  }, { timezone: 'Asia/Riyadh' });
  
  // أذكار المساء
  cron.schedule('0 18 * * *', async () => {
    await sendScheduledAdhkar('evening');
  }, { timezone: 'Asia/Riyadh' });
  
  // سورة الكهف يوم الجمعة
  cron.schedule('0 11 * * 5', async () => {
    await sendScheduledAdhkar('friday');
  }, { timezone: 'Asia/Riyadh' });
  
  // الأذكار الدورية
  cron.schedule('*/30 * * * *', async () => {
    await sendPeriodicRandomAdhkar();
  }, { timezone: 'Asia/Riyadh' });
  
  // التحقق من المناسبات اليومية
  cron.schedule('0 0 * * *', async () => {
    await checkIslamicEvents();
  }, { timezone: 'Asia/Riyadh' });
  
  // التحقق من الأذكار المجدولة
  cron.schedule('* * * * *', async () => {
    await checkScheduledAdhkar();
  }, { timezone: 'Asia/Riyadh' });
}

// إرسال أذكار مجدولة
async function sendScheduledAdhkar(category) {
  const groups = await db.GroupSettings.find({ 
    isActive: true,
    enabled: true,
    [`settings.${category}Adhkar`]: true 
  });
  
  const categoryData = islamicData.categories[category];
  if (!categoryData || !categoryData.items || categoryData.items.length === 0) {
    return;
  }
  
  const randomItem = categoryData.items[
    Math.floor(Math.random() * categoryData.items.length)
  ];
  
  for (const group of groups) {
    try {
      let message = `🕌 *${categoryData.name}*\n\n${randomItem.text}\n\n`;
      
      if (randomItem.source) {
        message += `📖 ${randomItem.source}\n\n`;
      }
      
      message += `✨ @${bot.options.username}`;
      
      // إرسال مع الوسائط
      if (randomItem.audio && group.settings.includeAudio) {
        try {
          await bot.sendAudio(group.chatId, randomItem.audio, {
            caption: message,
            parse_mode: 'Markdown'
          });
          continue;
        } catch (error) {
          console.error('خطأ في إرسال الصوت:', error);
        }
      }
      
      if (randomItem.pdf && group.settings.includePDF) {
        try {
          await bot.sendDocument(group.chatId, randomItem.pdf, {
            caption: message,
            parse_mode: 'Markdown'
          });
          continue;
        } catch (error) {
          console.error('خطأ في إرسال PDF:', error);
        }
      }
      
      // إرسال نصي
      await bot.sendMessage(group.chatId, message, { parse_mode: 'Markdown' });
      
      // تحديث العداد
      group.reminderCount += 1;
      group.lastReminderSent = new Date();
      await group.save();
      
    } catch (error) {
      console.error(`خطأ في إرسال ${category} للمجموعة ${group.chatId}:`, error.message);
    }
  }
}

// إرسال أذكار دورية عشوائية
async function sendPeriodicRandomAdhkar() {
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
      const message = `🕌 *ذكر دوري*\n\n` +
        `${randomAdhkar.text}\n\n` +
        `📂 ${randomAdhkar.categoryName}\n` +
        (randomAdhkar.source ? `📖 ${randomAdhkar.source}\n\n` : '\n') +
        `✨ @${bot.options.username}`;
      
      await bot.sendMessage(group.chatId, message, { parse_mode: 'Markdown' });
      
    } catch (error) {
      console.error(`خطأ في إرسال ذكر دوري للمجموعة ${group.chatId}:`, error.message);
    }
  }
}

// التحقق من الأذكار المجدولة
async function checkScheduledAdhkar() {
  const now = new Date();
  const scheduledAdhkar = await db.CustomAdhkar.find({
    scheduledDate: { $lte: now },
    approved: true,
    sentCount: 0
  });
  
  for (const adhkar of scheduledAdhkar) {
    await broadcastCustomAdhkar(adhkar);
    adhkar.scheduledDate = null; // تم الإرسال
    await adhkar.save();
  }
}

// التحقق من المناسبات الإسلامية
async function checkIslamicEvents() {
  const today = moment().tz('Asia/Riyadh');
  const hijriDate = await getHijriDate(today);
  
  // رمضان
  if (hijriDate.month === 9) {
    await sendRamadanEvent(hijriDate.day);
  }
  
  // يوم عرفة
  if (hijriDate.month === 12 && hijriDate.day === 9) {
    await sendArafatEvent();
  }
  
  // الأعياد
  if (hijriDate.month === 10 && hijriDate.day === 1) {
    await sendEidEvent('الفطر');
  }
  
  if (hijriDate.month === 12 && hijriDate.day === 10) {
    await sendEidEvent('الأضحى');
  }
  
  // عاشوراء
  if (hijriDate.month === 1 && hijriDate.day === 10) {
    await sendAshuraEvent();
  }
}

async function sendRamadanEvent(day) {
  const message = `🌙 *ليلة ${day} من رمضان*\n\n` +
    `اللهم بلغنا رمضان وأعنا على الصيام والقيام\n\n` +
    `✨ @${bot.options.username}`;
  
  await broadcastToAllGroups(message, { parse_mode: 'Markdown' });
}

async function sendArafatEvent() {
  const message = `🕋 *يوم عرفة*\n\n` +
    `خير الدعاء دعاء يوم عرفة\n` +
    `لا إله إلا الله وحده لا شريك له\n\n` +
    `✨ @${bot.options.username}`;
  
  await broadcastToAllGroups(message, { parse_mode: 'Markdown' });
}

async function sendEidEvent(eidType) {
  const message = `🎉 *عيد ${eidType} مبارك*\n\n` +
    `تقبل الله منا ومنكم صالح الأعمال\n` +
    `كل عام وأنتم بخير\n\n` +
    `✨ @${bot.options.username}`;
  
  await broadcastToAllGroups(message, { parse_mode: 'Markdown' });
  
  // إرسال تكبيرات صوتية
  const takbirAudio = 'https://server.islamic.com/audio/eid/takbeerat.mp3';
  const groups = await db.GroupSettings.find({ 
    isActive: true,
    enabled: true,
    'settings.takbiratAudio': true 
  });
  
  for (const group of groups) {
    try {
      await bot.sendAudio(group.chatId, takbirAudio, {
        caption: 'تكبيرات العيد 🎉',
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error(`خطأ في إرسال تكبيرات للمجموعة ${group.chatId}:`, error);
    }
  }
}

async function sendAshuraEvent() {
  const message = `📅 *يوم عاشوراء*\n\n` +
    `صيام يوم عاشوراء يكفر سنة ماضية\n\n` +
    `✨ @${bot.options.username}`;
  
  await broadcastToAllGroups(message, { parse_mode: 'Markdown' });
}

// الحصول على التاريخ الهجري
async function getHijriDate(gregorianDate) {
  try {
    const dateStr = gregorianDate.format('DD-MM-YYYY');
    const response = await axios.get(`http://api.aladhan.com/v1/gToH/${dateStr}`);
    return response.data.data.hijri;
  } catch (error) {
    console.error('خطأ في الحصول على التاريخ الهجري:', error);
    return { day: 1, month: 1, year: 1445 };
  }
}

// أمر المساعدة
bot.onText(/\/help/, (msg) => {
  const helpMessage = `🕌 *مساعدة - بوت الأذكار الإسلامي*\n\n` +
    `*الأوامر:*\n` +
    `/start - لوحة التحكم\n` +
    `/help - هذه الرسالة\n` +
    `/adhkar - أذكار عشوائية\n` +
    `/quran - آية عشوائية\n` +
    `/pdf - روابط PDF\n` +
    `/audio - روابط صوتية\n\n` +
    `*المطور:* ${DEVELOPER_USERNAME}\n` +
    `*الدعم:* ${ADMIN_GROUP_ID}`;
  
  bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: 'Markdown' });
});

// أمر إرسال أذكار عشوائية
bot.onText(/\/adhkar/, async (msg) => {
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
  
  if (allAdhkar.length > 0) {
    const randomAdhkar = allAdhkar[Math.floor(Math.random() * allAdhkar.length)];
    const message = `🕌 *${randomAdhkar.categoryName}*\n\n` +
      `${randomAdhkar.text}\n\n` +
      (randomAdhkar.source ? `📖 ${randomAdhkar.source}\n\n` : '') +
      `✨ @${bot.options.username}`;
    
    await bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  }
});

// أمر روابط PDF
bot.onText(/\/pdf/, async (msg) => {
  const pdfList = islamicData.resources?.pdf_files || [];
  
  let message = `📚 *روابط PDF المتاحة*\n\n`;
  
  pdfList.forEach((pdf, index) => {
    message += `${index + 1}. ${pdf.name}\n`;
    message += `   ${pdf.url}\n\n`;
  });
  
  message += `✨ @${bot.options.username}`;
  
  await bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
});

// أمر روابط صوتية
bot.onText(/\/audio/, async (msg) => {
  const audioList = islamicData.quran_audio || [];
  
  let message = `🎵 *روابط قرآن صوتية*\n\n`;
  
  audioList.slice(0, 10).forEach((audio, index) => {
    message += `${index + 1}. سورة ${audio.surah}\n`;
    message += `   القارئ: ${audio.reciter}\n`;
    message += `   ${audio.url}\n\n`;
  });
  
  if (audioList.length > 10) {
    message += `*و ${audioList.length - 10} سورة أخرى...*\n\n`;
  }
  
  message += `✨ @${bot.options.username}`;
  
  await bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
});

// بدء التشغيل
async function startBot() {
  console.log('🚀 بدء تشغيل البوت الإسلامي v2.0...');
  
  try {
    // التحقق من اتصال قاعدة البيانات
    await mongoose.connection.db.admin().ping();
    console.log('✅ تم الاتصال بقاعدة البيانات');
    
    // جدولة المهام
    scheduleBaseTasks();
    
    // التحقق من المناسبات فور التشغيل
    setTimeout(() => checkIslamicEvents(), 5000);
    
    console.log('✅ البوت يعمل بنجاح!');
    console.log(`👤 المطور: ${DEVELOPER_USERNAME}`);
    console.log(`📊 قاعدة البيانات: ${DATABASE_GROUP_ID}`);
    
    // إعلام المطور
    const stats = await getDetailedStatistics();
    await bot.sendMessage(DEVELOPER_ID,
      `🤖 *تم تشغيل البوت v2.0*\n\n` +
      `🕒 ${new Date().toLocaleString('ar-SA')}\n` +
      `📊 المجموعات: ${stats.activeGroups}\n` +
      `💾 الإصدار: 2.0 - الوسائط الكاملة\n` +
      `✅ الحالة: 🟢 نشط`,
      { parse_mode: 'Markdown' }
    );
    
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

// معالجة الأخطاء
process.on('uncaughtException', (error) => {
  console.error('⚠️ خطأ غير متوقع:', error);
  // محاولة إعادة التشغيل بعد 10 ثواني
  setTimeout(() => {
    console.log('🔄 إعادة تشغيل البوت...');
    process.exit(1);
  }, 10000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ وعد مرفوض:', reason);
});

// بدء البوت
startBot();

// تصدير الدوال للاختبارات
module.exports = {
  bot,
  db,
  broadcastToAllGroups,
  saveToDatabaseGroup,
  getDetailedStatistics
};