require('dotenv').config();

console.log(`
╔══════════════════════════════════════════╗
║     🕌 بوت الأذكار الإسلامي             ║
║     الإصدار: 3.1.0                      ║
║     المطور: @dev3bod                    ║
║     الوقت: ${new Date().toLocaleString('ar-SA')} ║
╚══════════════════════════════════════════╝
`);

const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// قاعدة بيانات بسيطة في الذاكرة
const database = {
  groups: {},
  users: {},
  admins: ['6960704733'], // ID المطور
  settings: {}
};

// ==================== TELEGRAM BOT FUNCTIONS ====================

async function sendTelegramMessage(chatId, text, options = {}) {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
      {
        chat_id: chatId,
        text: text,
        parse_mode: options.parse_mode || 'HTML',
        reply_markup: options.reply_markup
      }
    );
    return response.data;
  } catch (error) {
    console.error('❌ خطأ في إرسال رسالة:', error.message);
    return null;
  }
}

async function handleStartCommand(chatId, userId, username, isGroup = false) {
  const isDeveloper = userId === process.env.DEVELOPER_ID;
  
  if (isGroup) {
    // في المجموعات: إرسال رسالة للمديرين
    if (isDeveloper || database.admins.includes(userId.toString())) {
      await sendTelegramMessage(
        userId, // إرسال للخاص
        `🎛️ *لوحة تحكم البوت*\n\n` +
        `يمكنك التحكم في إعدادات البوت من هنا:\n\n` +
        `👥 *إدارة المجموعات:*\n` +
        `/group_settings - إعدادات المجموعة\n` +
        `/group_stats - إحصائيات المجموعة\n` +
        `/group_admins - إدارة المشرفين\n\n` +
        `⚙️ *الإعدادات العامة:*\n` +
        `/toggle_morning - أذكار الصباح\n` +
        `/toggle_evening - أذكار المساء\n` +
        `/toggle_friday - تذكير الجمعة\n\n` +
        `👑 *لوحة المطور:*\n` +
        `/dev_panel - لوحة التحكم المتقدمة`,
        { parse_mode: 'Markdown' }
      );
      
      // إرسال رسالة في المجموعة
      await sendTelegramMessage(
        chatId,
        `✅ تم إرسال لوحة التحكم إلى رسائلك الخاصة @${username || 'المستخدم'}`
      );
    }
  } else {
    // في الخاص: عرض لوحة التحكم المناسبة
    if (isDeveloper) {
      // لوحة المطور
      await sendTelegramMessage(
        chatId,
        `👑 *لوحة تحكم المطور*\n\n` +
        `📊 *الإحصائيات:*\n` +
        `• المجموعات: ${Object.keys(database.groups).length}\n` +
        `• المستخدمين: ${Object.keys(database.users).length}\n\n` +
        `⚙️ *الأدوات:*\n` +
        `1. إدارة المحتوى\n` +
        `2. إدارة المجموعات\n` +
        `3. البث المباشر\n` +
        `4. الإحصائيات\n\n` +
        `🔧 *الإعدادات:*\n` +
        `5. إعدادات النظام\n` +
        `6. النسخ الاحتياطي\n` +
        `7. السجلات\n\n` +
        `📱 *أرسل الرقم أو استخدم الأوامر:*`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📝 إدارة المحتوى', callback_data: 'manage_content' }],
              [{ text: '👥 إدارة المجموعات', callback_data: 'manage_groups' }],
              [{ text: '📨 البث المباشر', callback_data: 'broadcast' }],
              [{ text: '📊 الإحصائيات', callback_data: 'stats' }],
              [{ text: '⚙️ إعدادات النظام', callback_data: 'system_settings' }],
              [{ text: '💾 نسخة احتياطية', callback_data: 'backup' }]
            ]
          }
        }
      );
    } else if (database.admins.includes(userId.toString())) {
      // لوحة المشرفين
      await sendTelegramMessage(
        chatId,
        `⚙️ *لوحة تحكم المشرف*\n\n` +
        `يمكنك التحكم في المجموعات التي تديرها:\n\n` +
        `📋 *المجموعات النشطة:*\n` +
        `${getManagedGroups(userId)}\n\n` +
        `🎛️ *الأدوات المتاحة:*\n` +
        `/group_settings - إعدادات المجموعة\n` +
        `/schedule - جدولة الأذكار\n` +
        `/adhkar_list - قائمة الأذكار\n` +
        `/stats - إحصائيات المجموعة`,
        { parse_mode: 'Markdown' }
      );
    } else {
      // لوحة المستخدم العادي
      await sendTelegramMessage(
        chatId,
        `🕌 *مرحباً بك في بوت الأذكار الإسلامي*\n\n` +
        `✨ *المميزات المتوفرة:*\n` +
        `✅ أذكار الصباح والمساء تلقائياً\n` +
        `✅ تذكير سورة الكهف يوم الجمعة\n` +
        `✅ المناسبات الإسلامية والأعياد\n` +
        `✅ ملفات صوتية وPDF للقرآن\n\n` +
        `📱 *الأوامر المتاحة:*\n` +
        `/adhkar - أذكار عشوائية\n` +
        `/quran - آيات قرآنية\n` +
        `/pdf - روابط ملفات PDF\n` +
        `/audio - روابط صوتية\n` +
        `/settings - إعداداتك\n\n` +
        `👤 *المطور:* @dev3bod\n` +
        `📞 *الدعم:* ${process.env.DEVELOPER_ID || '6960704733'}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🕌 الأذكار', callback_data: 'show_adhkar' }],
              [{ text: '📖 القرآن', callback_data: 'show_quran' }],
              [{ text: '🎧 الوسائط', callback_data: 'show_media' }],
              [{ text: '⚙️ الإعدادات', callback_data: 'user_settings' }]
            ]
          }
        }
      );
    }
  }
}

function getManagedGroups(userId) {
  const groups = Object.values(database.groups).filter(g => 
    g.admins && g.admins.includes(userId.toString())
  );
  return groups.map(g => `• ${g.title || g.chatId}`).join('\n') || 'لا توجد مجموعات';
}

// ==================== WEBHOOK HANDLER ====================

app.post('/webhook', express.json(), async (req, res) => {
  try {
    const update = req.body;
    
    // معالجة الرسائل
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const userId = message.from.id;
      const text = message.text || '';
      const isGroup = message.chat.type !== 'private';
      
      // تحديث قاعدة البيانات
      if (!database.users[userId]) {
        database.users[userId] = {
          id: userId,
          username: message.from.username,
          firstName: message.from.first_name,
          lastName: message.from.last_name,
          isAdmin: database.admins.includes(userId.toString()),
          joinDate: new Date(),
          lastActive: new Date()
        };
      }
      
      if (isGroup && !database.groups[chatId]) {
        database.groups[chatId] = {
          chatId: chatId,
          title: message.chat.title,
          type: message.chat.type,
          addedBy: userId,
          addedDate: new Date(),
          admins: [userId.toString()],
          settings: {
            morningAdhkar: true,
            eveningAdhkar: true,
            fridayReminder: true,
            ramadanReminders: true,
            eidReminders: true
          }
        };
      }
      
      // معالجة الأوامر
      if (text.startsWith('/')) {
        const command = text.split(' ')[0].toLowerCase();
        
        switch(command) {
          case '/start':
            await handleStartCommand(chatId, userId, message.from.username, isGroup);
            break;
            
          case '/help':
            await sendHelpMessage(chatId, userId);
            break;
            
          case '/adhkar':
            await sendRandomAdhkar(chatId);
            break;
            
          case '/dev':
          case '/dev_panel':
            if (userId.toString() === process.env.DEVELOPER_ID) {
              await sendDeveloperPanel(chatId);
            }
            break;
            
          case '/admin':
            await sendAdminPanel(chatId, userId, isGroup);
            break;
        }
      }
    }
    
    // معالجة callback queries (الأزرار)
    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message.chat.id;
      const data = callback.data;
      
      await handleCallbackQuery(chatId, callback.from.id, data, callback.message.message_id);
      
      // إجابة على callback
      await axios.post(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/answerCallbackQuery`,
        {
          callback_query_id: callback.id
        }
      );
    }
    
    res.json({ ok: true });
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

async function sendHelpMessage(chatId, userId) {
  const isAdmin = database.admins.includes(userId.toString());
  const isDeveloper = userId.toString() === process.env.DEVELOPER_ID;
  
  let helpText = `📚 *مساعدة - بوت الأذكار الإسلامي*\n\n`;
  
  if (isDeveloper) {
    helpText += `👑 *أوامر المطور:*\n`;
    helpText += `/dev_panel - لوحة التحكم\n`;
    helpText += `/broadcast - بث رسالة\n`;
    helpText += `/stats - إحصائيات\n`;
    helpText += `/backup - نسخة احتياطية\n`;
    helpText += `/restart - إعادة تشغيل\n\n`;
  }
  
  if (isAdmin) {
    helpText += `⚙️ *أوامر المشرفين:*\n`;
    helpText += `/admin - لوحة التحكم\n`;
    helpText += `/group_settings - إعدادات المجموعة\n`;
    helpText += `/schedule - جدولة\n`;
    helpText += `/adhkar_list - الأذكار\n\n`;
  }
  
  helpText += `📱 *أوامر عامة:*\n`;
  helpText += `/start - بدء البوت\n`;
  helpText += `/adhkar - أذكار عشوائية\n`;
  helpText += `/quran - آيات قرآنية\n`;
  helpText += `/pdf - روابط PDF\n`;
  helpText += `/audio - روابط صوتية\n\n`;
  helpText += `👤 *المطور:* @dev3bod`;
  
  await sendTelegramMessage(chatId, helpText, { parse_mode: 'Markdown' });
}

async function sendRandomAdhkar(chatId) {
  const adhkarList = [
    'سبحان الله وبحمده، سبحان الله العظيم',
    'لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير',
    'اللهم صل على محمد وعلى آل محمد',
    'أستغفر الله العظيم الذي لا إله إلا هو الحي القيوم وأتوب إليه',
    'حسبي الله لا إله إلا هو عليه توكلت وهو رب العرش العظيم'
  ];
  
  const randomAdhkar = adhkarList[Math.floor(Math.random() * adhkarList.length)];
  
  await sendTelegramMessage(
    chatId,
    `🕌 *ذكر عشوائي*\n\n${randomAdhkar}\n\n📖 من كتاب حصن المسلم`,
    { parse_mode: 'Markdown' }
  );
}

async function sendDeveloperPanel(chatId) {
  const stats = {
    groups: Object.keys(database.groups).length,
    users: Object.keys(database.users).length,
    admins: database.admins.length
  };
  
  await sendTelegramMessage(
    chatId,
    `👑 *لوحة تحكم المطور*\n\n` +
    `📊 *الإحصائيات:*\n` +
    `• المجموعات النشطة: ${stats.groups}\n` +
    `• المستخدمين: ${stats.users}\n` +
    `• المشرفين: ${stats.admins}\n\n` +
    `⚙️ *أدوات النظام:*\n` +
    `1. إدارة المحتوى (الأذكار، القرآن)\n` +
    `2. إدارة المجموعات والمستخدمين\n` +
    `3. البث والجدولة\n` +
    `4. الإحصائيات والتقارير\n` +
    `5. الإعدادات المتقدمة\n` +
    `6. النسخ الاحتياطي\n\n` +
    `🔧 *استخدم الأزرار أدناه:*`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📝 المحتوى', callback_data: 'dev_content' },
            { text: '👥 المجموعات', callback_data: 'dev_groups' }
          ],
          [
            { text: '📨 البث', callback_data: 'dev_broadcast' },
            { text: '📊 إحصائيات', callback_data: 'dev_stats' }
          ],
          [
            { text: '⚙️ الإعدادات', callback_data: 'dev_settings' },
            { text: '💾 نسخ احتياطي', callback_data: 'dev_backup' }
          ],
          [
            { text: '🔄 إعادة تشغيل', callback_data: 'dev_restart' },
            { text: '📝 السجلات', callback_data: 'dev_logs' }
          ]
        ]
      }
    }
  );
}

async function sendAdminPanel(chatId, userId, isGroup) {
  if (isGroup) {
    const group = database.groups[chatId];
    if (group && group.admins.includes(userId.toString())) {
      await sendTelegramMessage(
        chatId,
        `⚙️ *إدارة المجموعة*\n\n` +
        `📝 *${group.title || 'المجموعة'}*\n\n` +
        `✅ *الميزات المفعلة:*\n` +
        `• أذكار الصباح: ${group.settings.morningAdhkar ? '✅' : '❌'}\n` +
        `• أذكار المساء: ${group.settings.eveningAdhkar ? '✅' : '❌'}\n` +
        `• تذكير الجمعة: ${group.settings.fridayReminder ? '✅' : '❌'}\n\n` +
        `🎛️ *الأدوات:*\n` +
        `1. تفعيل/تعطيل الميزات\n` +
        `2. إدارة المشرفين\n` +
        `3. جدولة الأذكار\n` +
        `4. إحصائيات المجموعة`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🔄 الميزات', callback_data: 'group_features' },
                { text: '👥 المشرفين', callback_data: 'group_admins' }
              ],
              [
                { text: '⏰ الجدولة', callback_data: 'group_schedule' },
                { text: '📊 الإحصائيات', callback_data: 'group_stats' }
              ]
            ]
          }
        }
      );
    }
  }
}

async function handleCallbackQuery(chatId, userId, data, messageId) {
  console.log(`Callback: ${data} from ${userId}`);
  
  try {
    switch(data) {
      case 'show_adhkar':
        await sendRandomAdhkar(chatId);
        break;
        
      case 'user_settings':
        await sendTelegramMessage(
          chatId,
          `⚙️ *إعدادات المستخدم*\n\n` +
          `هنا يمكنك تعديل إعداداتك الشخصية:\n\n` +
          `• اللغة\n` +
          `• التوقيت\n` +
          `• الإشعارات\n\n` +
          `🔧 *قريباً...*`,
          { parse_mode: 'Markdown' }
        );
        break;
        
      case 'dev_content':
        if (userId.toString() === process.env.DEVELOPER_ID) {
          await sendTelegramMessage(
            chatId,
            `📝 *إدارة المحتوى*\n\n` +
            `1. الأذكار (الصباح، المساء، دورية)\n` +
            `2. القرآن والسور\n` +
            `3. المناسبات الإسلامية\n` +
            `4. الوسائط (صوت، PDF)\n\n` +
            `📌 *اختر القسم:*`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '🕌 الأذكار', callback_data: 'manage_adhkar' },
                    { text: '📖 القرآن', callback_data: 'manage_quran' }
                  ],
                  [
                    { text: '🎯 المناسبات', callback_data: 'manage_events' },
                    { text: '🎧 الوسائط', callback_data: 'manage_media' }
                  ],
                  [
                    { text: '◀️ رجوع', callback_data: 'back_to_dev' }
                  ]
                ]
              }
            }
          );
        }
        break;
        
      case 'manage_adhkar':
        await sendTelegramMessage(
          chatId,
          `🕌 *إدارة الأذكار*\n\n` +
          `• أذكار الصباح\n` +
          `• أذكار المساء\n` +
          `• أذكار دورية\n` +
          `• أدعية خاصة\n\n` +
          `📌 *الأدوات:*\n` +
          `1. إضافة ذكر جديد\n` +
          `2. تعديل الذكر\n` +
          `3. حذف ذكر\n` +
          `4. تفعيل/تعطيل\n` +
          `5. تصدير الكل`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '➕ إضافة', callback_data: 'add_adhkar' },
                  { text: '✏️ تعديل', callback_data: 'edit_adhkar' }
                ],
                [
                  { text: '🗑️ حذف', callback_data: 'delete_adhkar' },
                  { text: '⚙️ تفعيل/تعطيل', callback_data: 'toggle_adhkar' }
                ],
                [
                  { text: '📤 تصدير', callback_data: 'export_adhkar' },
                  { text: '◀️ رجوع', callback_data: 'dev_content' }
                ]
              ]
            }
          }
        );
        break;
        
      case 'back_to_dev':
        await sendDeveloperPanel(chatId);
        break;
    }
  } catch (error) {
    console.error('Error handling callback:', error);
  }
}

// ==================== WEB SERVER ROUTES ====================

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>بوت الأذكار الإسلامي</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: linear-gradient(135deg, #1a2980, #26d0ce); color: white; 
               min-height: 100vh; padding: 20px; font-family: Arial, sans-serif; }
        .container { max-width: 1000px; margin: 0 auto; }
        h1 { text-align: center; margin: 30px 0; color: #ffd700; }
        .card { background: rgba(255,255,255,0.1); padding: 25px; border-radius: 15px; 
                margin: 20px 0; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2); }
        .command { background: rgba(0,0,0,0.2); padding: 10px 15px; border-radius: 8px; 
                   margin: 8px 0; font-family: monospace; border-right: 4px solid #ffd700; }
        .section-title { color: #ffd700; margin: 20px 0 10px 0; padding-bottom: 10px; 
                         border-bottom: 2px solid rgba(255,255,255,0.2); }
        .status { text-align: center; padding: 15px; background: rgba(76,175,80,0.2); 
                  border-radius: 10px; margin: 20px 0; border: 2px solid #4CAF50; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🕌 بوت الأذكار الإسلامي - نظام الأوامر</h1>
        
        <div class="status">
            ✅ النظام يعمل بنجاح | المنفذ: ${PORT}
        </div>
        
        <div class="card">
            <h2 class="section-title">📱 أوامر البوت في تليجرام</h2>
            
            <h3>👤 للمستخدمين العاديين:</h3>
            <div class="command">/start - فتح البوت والترحيب</div>
            <div class="command">/help - عرض رسالة المساعدة</div>
            <div class="command">/adhkar - أذكار عشوائية</div>
            <div class="command">/quran - آيات قرآنية</div>
            <div class="command">/pdf - روابط ملفات PDF</div>
            <div class="command">/audio - روابط صوتية</div>
            
            <h3>⚙️ للمشرفين في المجموعات:</h3>
            <div class="command">/start - (في الخاص) يفتح لوحة التحكم</div>
            <div class="command">/admin - إدارة البوت في المجموعة</div>
            <div class="command">/group_settings - إعدادات المجموعة</div>
            <div class="command">/stats - إحصائيات المجموعة</div>
            
            <h3>👑 للمطور:</h3>
            <div class="command">/dev أو /dev_panel - لوحة تحكم المطور</div>
            <div class="command">/broadcast - بث رسالة لجميع المجموعات</div>
            <div class="command">/stats - إحصائيات النظام</div>
            <div class="command">/backup - نسخة احتياطية</div>
            <div class="command">/restart - إعادة تشغيل البوت</div>
        </div>
        
        <div class="card">
            <h2 class="section-title">🎯 كيفية فتح لوحة التحكم</h2>
            
            <h3>للمشرفين في المجموعات:</h3>
            <p>1. أرسل <strong>/start</strong> في المجموعة</p>
            <p>2. سيرسل لك البوت لوحة التحكم في رسائلك الخاصة</p>
            <p>3. يمكنك التحكم في إعدادات المجموعة من هناك</p>
            
            <h3>للمطور:</h3>
            <p>1. أرسل <strong>/dev</strong> أو <strong>/dev_panel</strong></p>
            <p>2. ستظهر لك لوحة التحكم المتقدمة</p>
            <p>3. يمكنك إدارة المحتوى، المجموعات، البث، وغيرها</p>
            
            <h3>للمستخدمين العاديين:</h3>
            <p>1. أرسل <strong>/start</strong></p>
            <p>2. ستظهر لك واجهة المستخدم مع خيارات الأذكار والقرآن</p>
        </div>
        
        <div class="card">
            <h2 class="section-title">🔗 روابط مهمة</h2>
            <p>📞 المطور: @dev3bod</p>
            <p>🆔 ID المطور: ${process.env.DEVELOPER_ID || '6960704733'}</p>
            <p>🌐 رابط البوت: <a href="https://t.me/${process.env.BOT_USERNAME || 'your_bot'}" style="color:#ffd700;">فتح في تليجرام</a></p>
            <p>📊 حالة النظام: <a href="/health" style="color:#ffd700;">فحص الصحة</a></p>
        </div>
    </div>
</body>
</html>
  `);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    bot: 'running',
    webhook: 'active',
    database: {
      groups: Object.keys(database.groups).length,
      users: Object.keys(database.users).length
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/setup-webhook', async (req, res) => {
  try {
    const webhookUrl = `https://${req.hostname}/webhook`;
    const response = await axios.post(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/setWebhook`,
      {
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query']
      }
    );
    
    res.json({
      success: response.data.ok,
      message: 'تم إعداد webhook بنجاح',
      url: webhookUrl
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ==================== START SERVER ====================
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🌐 ===================================================== 🌐
     الخادم يعمل على: http://0.0.0.0:${PORT}
     الوقت: ${new Date().toLocaleString('ar-SA')}
     إصدار Node: ${process.version}
     
     🔗 لوحة الأوامر: https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost:' + PORT}
     🔗 إعداد Webhook: /setup-webhook
     🔗 فحص الصحة: /health
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
    console.log('⚠️ لم يتم إعداد webhook (يمكن استخدام polling)');
  }
}, 5000);

module.exports = server;