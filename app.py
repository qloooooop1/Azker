const TelegramBot = require(‘node-telegram-bot-api’);
const axios = require(‘axios’);
const cron = require(‘node-cron’);
const moment = require(‘moment-timezone’);

// Configuration
const BOT_TOKEN = process.env.BOT_TOKEN || ‘8507528865:AAGxbvXjNVg7ITo3awlwn9RRbfUiSDcngZw’;
const DATABASE_CHANNEL_ID = -1003624663502;
const OFFICIAL_GROUP_ID = -1003595290365;
const DEVELOPER_ID = 6960704733;

// Initialize bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// In-memory storage (يمكن استبداله بقاعدة بيانات حقيقية)
const groupSettings = new Map();

// Default settings structure
const defaultSettings = {
morningAzkar: { enabled: true, time: ‘06:00’ },
eveningAzkar: { enabled: true, time: ‘17:00’ },
periodicAzkar: { enabled: true, interval: 120 }, // minutes
fridayReminder: { enabled: true, time: ‘11:00’ },
istijabahHour: { enabled: true },
ramadanAzkar: { enabled: true },
arafatDay: { enabled: true },
eidReminders: { enabled: true },
ashuraReminders: { enabled: true },
lailatulQadr: { enabled: true },
lastTenDays: { enabled: true },
quranAudio: { enabled: true },
azkarAudio: { enabled: true },
eidTakbeer: { enabled: true },
aiResponses: { enabled: true },
lastPeriodicAzkar: null,
timezone: ‘Asia/Riyadh’
};

// API URLs
const API_SOURCES = {
azkarSabah: ‘https://ahegazy.github.io/muslimKit/json/azkar_sabah.json’,
azkarMassa: ‘https://ahegazy.github.io/muslimKit/json/azkar_massa.json’,
azkarPostPrayer: ‘https://ahegazy.github.io/muslimKit/json/PostPrayer_azkar.json’,
azkarComprehensive: ‘https://raw.githubusercontent.com/rn0x/Adhkar-json/main/adhkar.json’,
quranAudio: ‘https://api.quran.com/api/v4/chapter_recitations’,
everyAyah: ‘https://everyayah.com/data’
};

// ==================== UTILITY FUNCTIONS ====================

async function getGroupSettings(chatId) {
if (!groupSettings.has(chatId)) {
groupSettings.set(chatId, { …defaultSettings });
}
return groupSettings.get(chatId);
}

async function updateGroupSettings(chatId, updates) {
const settings = await getGroupSettings(chatId);
Object.assign(settings, updates);
groupSettings.set(chatId, settings);
}

function isAdmin(chatId, userId) {
return new Promise((resolve) => {
bot.getChatMember(chatId, userId)
.then(member => {
resolve([‘creator’, ‘administrator’].includes(member.status));
})
.catch(() => resolve(false));
});
}

async function fetchAzkar(type) {
try {
let url;
switch(type) {
case ‘morning’:
url = API_SOURCES.azkarSabah;
break;
case ‘evening’:
url = API_SOURCES.azkarMassa;
break;
case ‘prayer’:
url = API_SOURCES.azkarPostPrayer;
break;
default:
url = API_SOURCES.azkarComprehensive;
}

```
    const response = await axios.get(url);
    return response.data;
} catch (error) {
    console.error('Error fetching azkar:', error);
    return null;
}
```

}

function formatAzkarMessage(azkar, title) {
let message = `🌙 *${title}* 🌙\n\n`;

```
if (Array.isArray(azkar)) {
    azkar.slice(0, 10).forEach((item, index) => {
        const text = item.ARABIC || item.text || item.content;
        const count = item.REPEAT || item.count || 1;
        message += `${index + 1}. ${text}\n`;
        if (count > 1) message += `   🔢 التكرار: ${count} مرة\n`;
        message += '\n';
    });
}

message += '\n📿 حصن المسلم';
return message;
```

}

// ==================== ISLAMIC CALENDAR & OCCASIONS ====================

function getIslamicDate() {
// تقريبي - يمكن استخدام مكتبة أفضل
const gregorianDate = new Date();
const islamicYear = Math.floor((gregorianDate.getFullYear() - 622) * 1.030684);
return { year: islamicYear, month: 1, day: 1 }; // تحتاج تحسين
}

function isRamadan() {
const islamic = getIslamicDate();
return islamic.month === 9;
}

function isLastTenDaysRamadan() {
const islamic = getIslamicDate();
return islamic.month === 9 && islamic.day >= 20;
}

function isArafatDay() {
const islamic = getIslamicDate();
return islamic.month === 12 && islamic.day === 9;
}

function isEidDay() {
const islamic = getIslamicDate();
return (islamic.month === 10 && islamic.day === 1) ||
(islamic.month === 12 && islamic.day === 10);
}

function isAshuraDay() {
const islamic = getIslamicDate();
return islamic.month === 1 && islamic.day === 10;
}

// ==================== BOT COMMANDS ====================

bot.onText(//start/, async (msg) => {
const chatId = msg.chat.id;
const userId = msg.from.id;

```
if (msg.chat.type === 'private') {
    const keyboard = {
        inline_keyboard: [
            [{ text: '➕ إضافة البوت للمجموعة', url: `https://t.me/${(await bot.getMe()).username}?startgroup=true` }],
            [{ text: '📚 المجموعة الرسمية', url: `https://t.me/c/${Math.abs(OFFICIAL_GROUP_ID).toString().substring(3)}` }],
            [{ text: '👨‍💻 المطور', url: 'https://t.me/dev3bod' }],
            [{ text: '📖 دليل الاستخدام', callback_data: 'help' }]
        ]
    };
    
    const welcomeMessage = `🌟 *أهلاً بك في بوت الأذكار والقرآن الكريم* 🌟\n\n` +
        `📿 البوت يقدم:\n` +
        `• أذكار الصباح والمساء\n` +
        `• تذكير بسورة الكهف يوم الجمعة\n` +
        `• أذكار دورية قابلة للتخصيص\n` +
        `• أذكار المناسبات (رمضان، عرفة، الأعياد)\n` +
        `• تلاوات قرآنية مع الصوت\n` +
        `• ذكاء اصطناعي للإجابة عن الأسئلة الدينية\n\n` +
        `🎛 للمدراء: استخدم /settings في المجموعة للتحكم`;
    
    bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
} else {
    // في المجموعة - التحقق من الصلاحيات
    const isUserAdmin = await isAdmin(chatId, userId);
    
    if (isUserAdmin) {
        bot.sendMessage(userId, 
            `✅ تم فتح لوحة التحكم في الخاص\n\nاستخدم الأزرار أدناه للتحكم في إعدادات المجموعة`,
            { reply_markup: await getSettingsKeyboard(chatId) }
        ).catch(() => {
            bot.sendMessage(chatId, 
                `⚠️ عذراً، لا يمكنني مراسلتك في الخاص.\nالرجاء بدء محادثة معي أولاً: @${(await bot.getMe()).username}`
            );
        });
    } else {
        bot.sendMessage(chatId, '⛔️ هذا الأمر متاح للمدراء فقط', {
            reply_to_message_id: msg.message_id
        });
    }
}
```

});

bot.onText(//settings/, async (msg) => {
const chatId = msg.chat.id;
const userId = msg.from.id;

```
if (msg.chat.type !== 'private') {
    const isUserAdmin = await isAdmin(chatId, userId);
    if (!isUserAdmin) {
        return bot.sendMessage(chatId, '⛔️ هذا الأمر متاح للمدراء فقط');
    }
}

const keyboard = await getSettingsKeyboard(chatId);
bot.sendMessage(userId, '⚙️ *لوحة التحكم الرئيسية*\n\nاختر القسم المطلوب:', {
    parse_mode: 'Markdown',
    reply_markup: keyboard
}).catch(() => {
    bot.sendMessage(chatId, 
        `⚠️ الرجاء بدء محادثة معي في الخاص أولاً: @${bot.getMe().then(me => me.username)}`
    );
});
```

});

async function getSettingsKeyboard(chatId) {
const settings = await getGroupSettings(chatId);

```
return {
    inline_keyboard: [
        [{ text: '🌅 أذكار الصباح والمساء', callback_data: `settings_daily_${chatId}` }],
        [{ text: '🔄 الأذكار الدورية', callback_data: `settings_periodic_${chatId}` }],
        [{ text: '📅 تذكيرات الجمعة', callback_data: `settings_friday_${chatId}` }],
        [{ text: '🌙 أذكار رمضان', callback_data: `settings_ramadan_${chatId}` }],
        [{ text: '⛰ مناسبات خاصة', callback_data: `settings_occasions_${chatId}` }],
        [{ text: '🎵 إعدادات الصوت', callback_data: `settings_audio_${chatId}` }],
        [{ text: '🤖 الذكاء الاصطناعي', callback_data: `settings_ai_${chatId}` }],
        [{ text: '⏰ المنطقة الزمنية', callback_data: `settings_timezone_${chatId}` }],
        [{ text: '📊 الإحصائيات', callback_data: `stats_${chatId}` }],
        [{ text: '🔙 رجوع', callback_data: 'main_menu' }]
    ]
};
```

}

// ==================== CALLBACK HANDLERS ====================

bot.on(‘callback_query’, async (query) => {
const data = query.data;
const chatId = query.message.chat.id;

```
// Extract group ID from callback data
const groupIdMatch = data.match(/_(-?\d+)$/);
const groupId = groupIdMatch ? parseInt(groupIdMatch[1]) : chatId;

const settings = await getGroupSettings(groupId);

if (data.startsWith('settings_daily_')) {
    const keyboard = {
        inline_keyboard: [
            [
                { text: settings.morningAzkar.enabled ? '✅ أذكار الصباح' : '☑️ أذكار الصباح', 
                  callback_data: `toggle_morning_${groupId}` }
            ],
            [
                { text: `⏰ وقت الصباح: ${settings.morningAzkar.time}`, 
                  callback_data: `time_morning_${groupId}` }
            ],
            [
                { text: settings.eveningAzkar.enabled ? '✅ أذكار المساء' : '☑️ أذكار المساء', 
                  callback_data: `toggle_evening_${groupId}` }
            ],
            [
                { text: `⏰ وقت المساء: ${settings.eveningAzkar.time}`, 
                  callback_data: `time_evening_${groupId}` }
            ],
            [{ text: '🔙 رجوع', callback_data: `back_to_settings_${groupId}` }]
        ]
    };
    
    bot.editMessageText('🌅 *إعدادات أذكار الصباح والمساء*', {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

else if (data.startsWith('settings_periodic_')) {
    const keyboard = {
        inline_keyboard: [
            [
                { text: settings.periodicAzkar.enabled ? '✅ الأذكار الدورية' : '☑️ الأذكار الدورية', 
                  callback_data: `toggle_periodic_${groupId}` }
            ],
            [
                { text: `⏱ الفاصل الزمني: ${settings.periodicAzkar.interval} دقيقة`, 
                  callback_data: `interval_periodic_${groupId}` }
            ],
            [{ text: '➖ تقليل (30 دقيقة)', callback_data: `interval_decrease_${groupId}` },
             { text: '➕ زيادة (30 دقيقة)', callback_data: `interval_increase_${groupId}` }],
            [{ text: '🔙 رجوع', callback_data: `back_to_settings_${groupId}` }]
        ]
    };
    
    bot.editMessageText('🔄 *إعدادات الأذكار الدورية*', {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

else if (data.startsWith('settings_ramadan_')) {
    const keyboard = {
        inline_keyboard: [
            [{ text: settings.ramadanAzkar.enabled ? '✅ أذكار رمضان' : '☑️ أذكار رمضان', 
               callback_data: `toggle_ramadan_${groupId}` }],
            [{ text: settings.lailatulQadr.enabled ? '✅ ليلة القدر' : '☑️ ليلة القدر', 
               callback_data: `toggle_qadr_${groupId}` }],
            [{ text: settings.lastTenDays.enabled ? '✅ العشر الأواخر' : '☑️ العشر الأواخر', 
               callback_data: `toggle_lastten_${groupId}` }],
            [{ text: '🔙 رجوع', callback_data: `back_to_settings_${groupId}` }]
        ]
    };
    
    bot.editMessageText('🌙 *إعدادات رمضان*', {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

else if (data.startsWith('settings_occasions_')) {
    const keyboard = {
        inline_keyboard: [
            [{ text: settings.arafatDay.enabled ? '✅ يوم عرفة' : '☑️ يوم عرفة', 
               callback_data: `toggle_arafat_${groupId}` }],
            [{ text: settings.eidReminders.enabled ? '✅ العيدين' : '☑️ العيدين', 
               callback_data: `toggle_eid_${groupId}` }],
            [{ text: settings.ashuraReminders.enabled ? '✅ يوم عاشوراء' : '☑️ يوم عاشوراء', 
               callback_data: `toggle_ashura_${groupId}` }],
            [{ text: settings.eidTakbeer.enabled ? '✅ تكبيرات العيد' : '☑️ تكبيرات العيد', 
               callback_data: `toggle_takbeer_${groupId}` }],
            [{ text: '🔙 رجوع', callback_data: `back_to_settings_${groupId}` }]
        ]
    };
    
    bot.editMessageText('⛰ *المناسبات الخاصة*', {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

else if (data.startsWith('settings_audio_')) {
    const keyboard = {
        inline_keyboard: [
            [{ text: settings.quranAudio.enabled ? '✅ صوتيات القرآن' : '☑️ صوتيات القرآن', 
               callback_data: `toggle_quran_audio_${groupId}` }],
            [{ text: settings.azkarAudio.enabled ? '✅ صوتيات الأذكار' : '☑️ صوتيات الأذكار', 
               callback_data: `toggle_azkar_audio_${groupId}` }],
            [{ text: '🔙 رجوع', callback_data: `back_to_settings_${groupId}` }]
        ]
    };
    
    bot.editMessageText('🎵 *إعدادات الصوت*', {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

else if (data.startsWith('settings_ai_')) {
    const keyboard = {
        inline_keyboard: [
            [{ text: settings.aiResponses.enabled ? '✅ الذكاء الاصطناعي' : '☑️ الذكاء الاصطناعي', 
               callback_data: `toggle_ai_${groupId}` }],
            [{ text: '💡 عن الذكاء الاصطناعي', callback_data: `ai_info_${groupId}` }],
            [{ text: '🔙 رجوع', callback_data: `back_to_settings_${groupId}` }]
        ]
    };
    
    bot.editMessageText('🤖 *إعدادات الذكاء الاصطناعي*\n\nالبوت يستخدم AI مفتوح المصدر للإجابة على الأسئلة الدينية', {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

// Toggle handlers
else if (data.startsWith('toggle_')) {
    const [_, feature, gId] = data.split('_');
    const targetGroupId = parseInt(gId);
    const targetSettings = await getGroupSettings(targetGroupId);
    
    const featureMap = {
        'morning': 'morningAzkar',
        'evening': 'eveningAzkar',
        'periodic': 'periodicAzkar',
        'ramadan': 'ramadanAzkar',
        'qadr': 'lailatulQadr',
        'lastten': 'lastTenDays',
        'arafat': 'arafatDay',
        'eid': 'eidReminders',
        'ashura': 'ashuraReminders',
        'takbeer': 'eidTakbeer',
        'ai': 'aiResponses'
    };
    
    if (featureMap[feature]) {
        targetSettings[featureMap[feature]].enabled = !targetSettings[featureMap[feature]].enabled;
        await updateGroupSettings(targetGroupId, targetSettings);
        
        bot.answerCallbackQuery(query.id, {
            text: `✅ تم ${targetSettings[featureMap[feature]].enabled ? 'تفعيل' : 'إيقاف'} الخاصية`,
            show_alert: false
        });
        
        // Refresh the current menu
        bot.emit('callback_query', { ...query, data: query.data.replace('toggle_', 'settings_').replace(`_${feature}_`, '_') });
    }
}

// Interval adjustments
else if (data.startsWith('interval_increase_')) {
    const gId = parseInt(data.split('_')[2]);
    const targetSettings = await getGroupSettings(gId);
    targetSettings.periodicAzkar.interval += 30;
    await updateGroupSettings(gId, targetSettings);
    
    bot.answerCallbackQuery(query.id, { text: `✅ تم زيادة الفاصل الزمني إلى ${targetSettings.periodicAzkar.interval} دقيقة` });
    bot.emit('callback_query', { ...query, data: `settings_periodic_${gId}` });
}

else if (data.startsWith('interval_decrease_')) {
    const gId = parseInt(data.split('_')[2]);
    const targetSettings = await getGroupSettings(gId);
    if (targetSettings.periodicAzkar.interval > 30) {
        targetSettings.periodicAzkar.interval -= 30;
        await updateGroupSettings(gId, targetSettings);
        bot.answerCallbackQuery(query.id, { text: `✅ تم تقليل الفاصل الزمني إلى ${targetSettings.periodicAzkar.interval} دقيقة` });
    } else {
        bot.answerCallbackQuery(query.id, { text: '⚠️ الحد الأدنى 30 دقيقة', show_alert: true });
    }
    bot.emit('callback_query', { ...query, data: `settings_periodic_${gId}` });
}

else if (data.startsWith('back_to_settings_')) {
    const gId = parseInt(data.split('_')[3]);
    const keyboard = await getSettingsKeyboard(gId);
    bot.editMessageText('⚙️ *لوحة التحكم الرئيسية*', {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

bot.answerCallbackQuery(query.id);
```

});

// ==================== SCHEDULED TASKS ====================

// Morning Azkar
cron.schedule(‘0 6 * * *’, async () => {
for (const [chatId, settings] of groupSettings.entries()) {
if (settings.morningAzkar.enabled) {
const azkar = await fetchAzkar(‘morning’);
if (azkar) {
const message = formatAzkarMessage(azkar, ‘أذكار الصباح ☀️’);
bot.sendMessage(chatId, message, { parse_mode: ‘Markdown’ });
}
}
}
});

// Evening Azkar
cron.schedule(‘0 17 * * *’, async () => {
for (const [chatId, settings] of groupSettings.entries()) {
if (settings.eveningAzkar.enabled) {
const azkar = await fetchAzkar(‘evening’);
if (azkar) {
const message = formatAzkarMessage(azkar, ‘أذكار المساء 🌙’);
bot.sendMessage(chatId, message, { parse_mode: ‘Markdown’ });
}
}
}
});

// Friday Reminder - Surah Al-Kahf
cron.schedule(‘0 11 * * 5’, async () => {
for (const [chatId, settings] of groupSettings.entries()) {
if (settings.fridayReminder.enabled) {
const message = `📖 *تذكير بقراءة سورة الكهف* 📖\n\n` +
`"مَنْ قَرَأَ سُورَةَ الكَهْفِ يَوْمَ الجُمُعَةِ أَضَاءَ لَهُ مِنَ النُّورِ مَا بَيْنَ الجُمُعَتَيْنِ"\n\n` +
`📥 جاري إرسال ملف PDF للسورة...`;

```
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        
        // Send PDF (يمكن استخدام رابط PDF من المصادر)
        bot.sendDocument(chatId, 'https://example.com/surah-kahf.pdf', {
            caption: '📖 سورة الكهف - PDF'
        }).catch(err => console.error('PDF send error:', err));
    }
}
```

});

// Periodic Azkar checker
setInterval(async () => {
const now = Date.now();

```
for (const [chatId, settings] of groupSettings.entries()) {
    if (settings.periodicAzkar.enabled) {
        const lastSent = settings.lastPeriodicAzkar || 0;
        const intervalMs = settings.periodicAzkar.interval * 60 * 1000;
        
        if (now - lastSent >= intervalMs) {
            const azkar = await fetchAzkar('prayer');
            if (azkar) {
                const randomAzkar = Array.isArray(azkar) 
                    ? [azkar[Math.floor(Math.random() * azkar.length)]]
                    : azkar;
                
                const message = formatAzkarMessage(randomAzkar, 'ذكر دوري 💚');
                bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
                
                settings.lastPeriodicAzkar = now;
                await updateGroupSettings(chatId, settings);
            }
        }
    }
}
```

}, 60000); // Check every minute

// ==================== AI RESPONSES ====================

bot.on(‘message’, async (msg) => {
const chatId = msg.chat.id;
const text = msg.text?.toLowerCase() || ‘’;

```
// Skip commands
if (text.startsWith('/')) return;

const settings = await getGroupSettings(chatId);

// Check if message is a reply to bot or contains trigger words
const isBotMentioned = msg.reply_to_message?.from?.is_bot ||
                      text.includes('أذكار') ||
                      text.includes('قرآن') ||
                      text.includes('حديث') ||
                      text.includes('دعاء');

if (settings.aiResponses.enabled && isBotMentioned) {
    bot.sendChatAction(chatId, 'typing');
    
    // Simple AI response (يمكن استبداله بـ API حقيقي)
    const response = await generateAIResponse(text);
    
    bot.sendMessage(chatId, response, {
        reply_to_message_id: msg.message_id,
        parse_mode: 'Markdown'
    });
}
```

});

async function generateAIResponse(question) {
// هنا يمكن دمج API مجاني مثل:
// - Hugging Face Inference API
// - Ollama (محلي)
// - أي نموذج مفتوح المصدر

```
// مثال بسيط للتوضيح
const responses = {
    'أذكار': 'الأذكار من أعظم العبادات. تجدها في حصن المسلم وتشمل أذكار الصباح والمساء وأذكار النوم والاستيقاظ.',
    'قرآن': 'القرآن الكريم هو كلام الله المنزل على نبيه محمد صلى الله عليه وسلم. قراءته عبادة عظيمة.',
    'دعاء': 'الدعاء مخ العبادة، وهو من أعظم القربات إلى الله تعالى.',
    'حديث': 'الحديث النبوي هو ما أُثر عن النبي محمد صلى الله عليه وسلم من قول أو فعل أو تقرير.'
};

for (const [key, value] of Object.entries(responses)) {
    if (question.includes(key)) {
        return `🤖 *إجابة ذكية:*\n\n${value}\n\n_للمزيد من المعلومات، يمكنك البحث في المصادر الإسلامية الموثوقة._`;
    }
}

return '🤖 أنا بوت
```