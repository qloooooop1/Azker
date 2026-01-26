require(‘dotenv’).config();
const TelegramBot = require(‘node-telegram-bot-api’);
const axios = require(‘axios’);
const cron = require(‘node-cron’);
const moment = require(‘moment-timezone’);
const express = require(‘express’);

// ==================== CONFIGURATION ====================
const BOT_TOKEN = process.env.BOT_TOKEN;
const DATABASE_CHANNEL_ID = parseInt(process.env.DATABASE_CHANNEL_ID);
const OFFICIAL_GROUP_ID = parseInt(process.env.OFFICIAL_GROUP_ID);
const DEVELOPER_ID = parseInt(process.env.DEVELOPER_ID);
const PORT = process.env.PORT || 3000;

// Initialize bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Express server for keep-alive
const app = express();
app.get(’/’, (req, res) => {
res.send(‘🤖 Islamic Bot is running! الحمد لله’);
});
app.listen(PORT, () => {
console.log(`✅ Keep-alive server running on port ${PORT}`);
});

// ==================== DATA STORAGE ====================
const groupSettings = new Map();

const defaultSettings = {
morningAzkar: { enabled: true, time: ‘06:00’ },
eveningAzkar: { enabled: true, time: ‘17:00’ },
periodicAzkar: { enabled: true, interval: 120 },
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
prayerTimes: { enabled: false },
lastPeriodicAzkar: null,
timezone: ‘Asia/Riyadh’
};

// ==================== API SOURCES ====================
const API_SOURCES = {
azkarSabah: ‘https://ahegazy.github.io/muslimKit/json/azkar_sabah.json’,
azkarMassa: ‘https://ahegazy.github.io/muslimKit/json/azkar_massa.json’,
azkarPostPrayer: ‘https://ahegazy.github.io/muslimKit/json/PostPrayer_azkar.json’,
hadith: ‘https://api.hadith.gading.dev/books/muslim?range=1-300’,
quranAudio: ‘https://api.quran.com/api/v4/chapter_recitations/1’,
prayerTimes: ‘http://api.aladhan.com/v1/timings’
};

// ==================== HELPER FUNCTIONS ====================
async function getGroupSettings(chatId) {
if (!groupSettings.has(chatId)) {
groupSettings.set(chatId, JSON.parse(JSON.stringify(defaultSettings)));
}
return groupSettings.get(chatId);
}

async function updateGroupSettings(chatId, updates) {
const settings = await getGroupSettings(chatId);
Object.assign(settings, updates);
groupSettings.set(chatId, settings);
}

async function isAdmin(chatId, userId) {
try {
const member = await bot.getChatMember(chatId, userId);
return [‘creator’, ‘administrator’].includes(member.status);
} catch (error) {
return false;
}
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
url = API_SOURCES.azkarSabah;
}

```
    const response = await axios.get(url);
    return response.data;
} catch (error) {
    console.error('Error fetching azkar:', error.message);
    return null;
}
```

}

function formatAzkarMessage(azkar, title) {
let message = `🌙 *${title}* 🌙\n\n`;

```
if (Array.isArray(azkar)) {
    const items = azkar.slice(0, 10);
    items.forEach((item, index) => {
        const text = item.ARABIC || item.text || item.content || item.category;
        const count = item.REPEAT || item.count || 1;
        
        if (text) {
            message += `${index + 1}. ${text}\n`;
            if (count > 1) {
                message += `   🔢 التكرار: ${count} مرة\n`;
            }
            message += '\n';
        }
    });
} else if (azkar && typeof azkar === 'object') {
    message += JSON.stringify(azkar, null, 2);
}

message += '\n📿 *حصن المسلم*';
return message;
```

}

// ==================== ISLAMIC CALENDAR ====================
function getIslamicDate() {
const now = new Date();
const islamicYear = Math.floor((now.getFullYear() - 622) * 1.030684);
const month = Math.floor(Math.random() * 12) + 1;
const day = Math.floor(Math.random() * 29) + 1;
return { year: islamicYear, month, day };
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

// ==================== KEYBOARDS ====================
async function getMainKeyboard() {
return {
inline_keyboard: [
[{ text: ‘➕ إضافة البوت للمجموعة’, url: `https://t.me/${(await bot.getMe()).username}?startgroup=true` }],
[{ text: ‘📚 المجموعة الرسمية’, url: `https://t.me/c/${Math.abs(OFFICIAL_GROUP_ID).toString().substring(3)}` }],
[{ text: ‘👨‍💻 المطور’, url: ‘https://t.me/dev3bod’ }],
[{ text: ‘📖 القرآن الكريم’, callback_data: ‘quran_menu’ }],
[{ text: ‘📿 الأذكار’, callback_data: ‘azkar_menu’ }],
[{ text: ‘🕌 أوقات الصلاة’, callback_data: ‘prayer_times’ }],
[{ text: ‘❓ المساعدة’, callback_data: ‘help’ }]
]
};
}

async function getSettingsKeyboard(chatId) {
return {
inline_keyboard: [
[{ text: ‘🌅 أذكار الصباح والمساء’, callback_data: `settings_daily_${chatId}` }],
[{ text: ‘🔄 الأذكار الدورية’, callback_data: `settings_periodic_${chatId}` }],
[{ text: ‘📅 تذكيرات الجمعة’, callback_data: `settings_friday_${chatId}` }],
[{ text: ‘🌙 أذكار رمضان’, callback_data: `settings_ramadan_${chatId}` }],
[{ text: ‘⛰ مناسبات خاصة’, callback_data: `settings_occasions_${chatId}` }],
[{ text: ‘🎵 إعدادات الصوت’, callback_data: `settings_audio_${chatId}` }],
[{ text: ‘🤖 الذكاء الاصطناعي’, callback_data: `settings_ai_${chatId}` }],
[{ text: ‘📊 الإحصائيات’, callback_data: `stats_${chatId}` }],
[{ text: ‘🔙 رجوع’, callback_data: ‘main_menu’ }]
]
};
}

// ==================== BOT COMMANDS ====================
bot.onText(//start/, async (msg) => {
const chatId = msg.chat.id;
const userId = msg.from.id;

```
if (msg.chat.type === 'private') {
    const welcomeMessage = 
        `🌟 *السلام عليكم ورحمة الله وبركاته* 🌟\n\n` +
        `أهلاً بك في *بوت الأذكار والقرآن الكريم*\n\n` +
        `📿 *المميزات:*\n` +
        `• أذكار الصباح والمساء\n` +
        `• تذكير بسورة الكهف يوم الجمعة\n` +
        `• أذكار دورية قابلة للتخصيص\n` +
        `• أذكار المناسبات (رمضان، عرفة، الأعياد)\n` +
        `• تلاوات قرآنية مع الصوت\n` +
        `• ذكاء اصطناعي للإجابة عن الأسئلة\n` +
        `• أوقات الصلاة\n` +
        `• حديث اليوم\n\n` +
        `🎛 *للمدراء:* استخدم /settings في المجموعة للتحكم\n\n` +
        `_جزاكم الله خيراً_ 🤲`;
    
    bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'Markdown',
        reply_markup: await getMainKeyboard()
    });
} else {
    const isUserAdmin = await isAdmin(chatId, userId);
    
    if (isUserAdmin) {
        try {
            await bot.sendMessage(userId, 
                `✅ *تم فتح لوحة التحكم*\n\nاستخدم الأزرار أدناه للتحكم في إعدادات المجموعة`,
                { 
                    parse_mode: 'Markdown',
                    reply_markup: await getSettingsKeyboard(chatId) 
                }
            );
            bot.sendMessage(chatId, '✅ تم إرسال لوحة التحكم في الخاص', {
                reply_to_message_id: msg.message_id
            });
        } catch (error) {
            bot.sendMessage(chatId, 
                `⚠️ لا يمكنني مراسلتك في الخاص.\n\n` +
                `الرجاء بدء محادثة معي أولاً من هنا:\n` +
                `https://t.me/${(await bot.getMe()).username}`,
                { reply_to_message_id: msg.message_id }
            );
        }
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
if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    const isUserAdmin = await isAdmin(chatId, userId);
    if (!isUserAdmin) {
        return bot.sendMessage(chatId, '⛔️ هذا الأمر متاح للمدراء فقط');
    }
}

try {
    await bot.sendMessage(userId, 
        '⚙️ *لوحة التحكم الرئيسية*\n\nاختر القسم المطلوب:', 
        {
            parse_mode: 'Markdown',
            reply_markup: await getSettingsKeyboard(chatId)
        }
    );
} catch (error) {
    bot.sendMessage(chatId, 
        `⚠️ الرجاء بدء محادثة معي في الخاص أولاً:\n` +
        `https://t.me/${(await bot.getMe()).username}`
    );
}
```

});

bot.onText(//quran/, async (msg) => {
const chatId = msg.chat.id;

```
const keyboard = {
    inline_keyboard: [
        [{ text: '📖 سورة البقرة', callback_data: 'quran_2' },
         { text: '📖 سورة آل عمران', callback_data: 'quran_3' }],
        [{ text: '📖 سورة الكهف', callback_data: 'quran_18' },
         { text: '📖 سورة يس', callback_data: 'quran_36' }],
        [{ text: '📖 سورة الرحمن', callback_data: 'quran_55' },
         { text: '📖 سورة الواقعة', callback_data: 'quran_56' }],
        [{ text: '📖 سورة الملك', callback_data: 'quran_67' }]
    ]
};

bot.sendMessage(chatId, '📖 *القرآن الكريم*\n\nاختر السورة:', {
    parse_mode: 'Markdown',
    reply_markup: keyboard
});
```

});

bot.onText(//azkar/, async (msg) => {
const chatId = msg.chat.id;

```
const keyboard = {
    inline_keyboard: [
        [{ text: '🌅 أذكار الصباح', callback_data: 'azkar_morning' }],
        [{ text: '🌙 أذكار المساء', callback_data: 'azkar_evening' }],
        [{ text: '🕌 أذكار بعد الصلاة', callback_data: 'azkar_prayer' }],
        [{ text: '🛏 أذكار النوم', callback_data: 'azkar_sleep' }]
    ]
};

bot.sendMessage(chatId, '📿 *الأذكار*\n\nاختر نوع الذكر:', {
    parse_mode: 'Markdown',
    reply_markup: keyboard
});
```

});

bot.onText(//help/, async (msg) => {
const helpMessage =
`📚 *دليل استخدام البوت*\n\n` +
`*الأوامر المتاحة:*\n` +
`/start - البدء مع البوت\n` +
`/quran - تصفح القرآن الكريم\n` +
`/azkar - الأذكار\n` +
`/settings - لوحة التحكم (للمدراء)\n` +
`/help - المساعدة\n\n` +
`*للمدراء:*\n` +
`• استخدم /start في المجموعة لفتح لوحة التحكم\n` +
`• يمكنك تخصيص جميع الإعدادات\n` +
`• تفعيل/إلغاء أي ميزة\n\n` +
`*الدعم الفني:*\n` +
`@dev3bod\n\n` +
`_جزاكم الله خيراً_ 🤲`;

```
bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: 'Markdown' });
```

});

// ==================== CALLBACK HANDLERS ====================
bot.on(‘callback_query’, async (query) => {
const data = query.data;
const chatId = query.message.chat.id;
const messageId = query.message.message_id;

```
// Extract group ID from callback data
const groupIdMatch = data.match(/_(-?\d+)$/);
const groupId = groupIdMatch ? parseInt(groupIdMatch[1]) : chatId;

try {
    if (data === 'main_menu') {
        await bot.editMessageText(
            '🌟 *القائمة الرئيسية*\n\nاختر ما تريد:', 
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: await getMainKeyboard()
            }
        );
    }
    
    else if (data.startsWith('azkar_')) {
        const type = data.split('_')[1];
        let azkarType = 'morning';
        let title = 'أذكار الصباح';
        
        if (type === 'evening') {
            azkarType = 'evening';
            title = 'أذكار المساء';
        } else if (type === 'prayer') {
            azkarType = 'prayer';
            title = 'أذكار بعد الصلاة';
        }
        
        const azkar = await fetchAzkar(azkarType);
        if (azkar) {
            const message = formatAzkarMessage(azkar, title);
            await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        }
    }
    
    else if (data.startsWith('settings_daily_')) {
        const settings = await getGroupSettings(groupId);
        const keyboard = {
            inline_keyboard: [
                [{ text: settings.morningAzkar.enabled ? '✅ أذكار الصباح' : '☑️ أذكار الصباح', 
                   callback_data: `toggle_morning_${groupId}` }],
                [{ text: `⏰ وقت: ${settings.morningAzkar.time}`, 
                   callback_data: `time_morning_${groupId}` }],
                [{ text: settings.eveningAzkar.enabled ? '✅ أذكار المساء' : '☑️ أذكار المساء', 
                   callback_data: `toggle_evening_${groupId}` }],
                [{ text: `⏰ وقت: ${settings.eveningAzkar.time}`, 
                   callback_data: `time_evening_${groupId}` }],
                [{ text: '🔙 رجوع', callback_data: `back_to_settings_${groupId}` }]
            ]
        };
        
        await bot.editMessageText('🌅 *إعدادات أذكار الصباح والمساء*', {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    
    else if (data.startsWith('settings_periodic_')) {
        const settings = await getGroupSettings(groupId);
        const keyboard = {
            inline_keyboard: [
                [{ text: settings.periodicAzkar.enabled ? '✅ الأذكار الدورية' : '☑️ الأذكار الدورية', 
                   callback_data: `toggle_periodic_${groupId}` }],
                [{ text: `⏱ الفاصل: ${settings.periodicAzkar.interval} دقيقة`, 
                   callback_data: `interval_info_${groupId}` }],
                [{ text: '➖ تقليل', callback_data: `interval_decrease_${groupId}` },
                 { text: '➕ زيادة', callback_data: `interval_increase_${groupId}` }],
                [{ text: '🔙 رجوع', callback_data: `back_to_settings_${groupId}` }]
            ]
        };
        
        await bot.editMessageText('🔄 *إعدادات الأذكار الدورية*', {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    
    else if (data.startsWith('settings_ai_')) {
        const settings = await getGroupSettings(groupId);
        const keyboard = {
            inline_keyboard: [
                [{ text: settings.aiResponses.enabled ? '✅ الذكاء الاصطناعي' : '☑️ الذكاء الاصطناعي', 
                   callback_data: `toggle_ai_${groupId}` }],
                [{ text: '💡 كيفية الحصول على API مجاني', callback_data: `ai_help_${groupId}` }],
                [{ text: '🔙 رجوع', callback_data: `back_to_settings_${groupId}` }]
            ]
        };
        
        await bot.editMessageText(
            '🤖 *إعدادات الذكاء الاصطناعي*\n\n' +
            'يستخدم البوت مكتبات AI مفتوحة المصدر\n' +
            'للحصول على ردود ذكية على الأسئلة الدينية',
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            }
        );
    }
    
    else if (data.startsWith('ai_help_')) {
        const helpText = 
            `🤖 *كيفية الحصول على API مجاني للذكاء الاصطناعي*\n\n` +
            `*خيار 1: Hugging Face (موصى به)*\n` +
            `1. اذهب إلى: https://huggingface.co\n` +
            `2. سجل حساب مجاني\n` +
            `3. اذهب إلى Settings → Access Tokens\n` +
            `4. أنشئ Token جديد\n` +
            `5. انسخ المفتاح وضعه في إعدادات المجموعة\n\n` +
            `*خيار 2: استخدام البوت بدون AI*\n` +
            `يمكنك استخدام جميع الميزات الأخرى بدون AI\n\n` +
            `_للمزيد من المساعدة: @dev3bod_`;
        
        await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
    }
    
    else if (data.startsWith('toggle_')) {
        const parts = data.split('_');
        const feature = parts[1];
        const gId = parseInt(parts[2]);
        const settings = await getGroupSettings(gId);
        
        const featureMap = {
            'morning': 'morningAzkar',
            'evening': 'eveningAzkar',
            'periodic': 'periodicAzkar',
            'ai': 'aiResponses'
        };
        
        if (featureMap[feature]) {
            settings[featureMap[feature]].enabled = !settings[featureMap[feature]].enabled;
            await updateGroupSettings(gId, settings);
            
            await bot.answerCallbackQuery(query.id, {
                text: `✅ تم ${settings[featureMap[feature]].enabled ? 'تفعيل' : 'إيقاف'} الخاصية`
            });
            
            // Refresh current menu
            const menuType = data.includes('morning') || data.includes('evening') ? 'daily' : 
                            data.includes('periodic') ? 'periodic' : 'ai';
            bot.emit('callback_query', { 
                ...query, 
                data: `settings_${menuType}_${gId}` 
            });
        }
    }
    
    else if (data.startsWith('interval_')) {
        const action = data.split('_')[1];
        const gId = parseInt(data.split('_')[2]);
        const settings = await getGroupSettings(gId);
        
        if (action === 'increase') {
            settings.periodicAzkar.interval += 30;
            await updateGroupSettings(gId, settings);
            await bot.answerCallbackQuery(query.id, {
                text: `✅ تم زيادة الفاصل إلى ${settings.periodicAzkar.interval} دقيقة`
            });
        } else if (action === 'decrease' && settings.periodicAzkar.interval > 30) {
            settings.periodicAzkar.interval -= 30;
            await updateGroupSettings(gId, settings);
            await bot.answerCallbackQuery(query.id, {
                text: `✅ تم تقليل الفاصل إلى ${settings.periodicAzkar.interval} دقيقة`
            });
        } else {
            await bot.answerCallbackQuery(query.id, {
                text: '⚠️ الحد الأدنى 30 دقيقة',
                show_alert: true
            });
        }
        
        bot.emit('callback_query', { ...query, data: `settings_periodic_${gId}` });
    }
    
    else if (data.startsWith('back_to_settings_')) {
        const gId = parseInt(data.split('_')[3]);
        await bot.editMessageText('⚙️ *لوحة التحكم الرئيسية*', {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: await getSettingsKeyboard(gId)
        });
    }
    
    await bot.answerCallbackQuery(query.id);
    
} catch (error) {
    console.error('Callback error:', error.message);
    bot.answerCallbackQuery(query.id, { text: '❌ حدث خطأ' });
}
```

});

// ==================== SCHEDULED TASKS ====================

// Morning Azkar - 6:00 AM
cron.schedule(‘0 6 * * *’, async () => {
console.log(‘⏰ Sending morning azkar…’);
for (const [chatId, settings] of groupSettings.entries()) {
if (settings.morningAzkar.enabled) {
const azkar = await fetchAzkar(‘morning’);
if (azkar) {
const message = formatAzkarMessage(azkar, ‘أذكار الصباح ☀️’);
bot.sendMessage(chatId, message, { parse_mode: ‘Markdown’ })
.catch(err => console.log(`Failed to send to ${chatId}:`, err.message));
}
}
}
});

// Evening Azkar - 5:00 PM
cron.schedule(‘0 17 * * *’, async () => {
console.log(‘⏰ Sending evening azkar…’);
for (const [chatId, settings] of groupSettings.entries()) {
if (settings.eveningAzkar.enabled) {
const azkar = await fetchAzkar(‘evening’);
if (azkar) {
const message = formatAzkarMessage(azkar, ‘أذكار المساء 🌙’);
bot.sendMessage(chatId, message, { parse_mode: ‘Markdown’ })
.catch(err => console.log(`Failed to send to ${chatId}:`, err.message));
}
}
}
});

// Friday Reminder - Surah Al-Kahf - 11:00 AM
cron.schedule(‘0 11 * * 5’, async () => {
console.log(‘📖 Friday: Sending Surah Al-Kahf reminder…’);
for (const [chatId, settings] of groupSettings.entries()) {
if (settings.fridayReminder.enabled) {
const message =
`📖 *تذكير بقراءة سورة الكهف* 📖\n\n` +
`"مَنْ قَرَأَ سُورَةَ الكَهْفِ يَوْمَ الجُمُعَةِ أَضَاءَ لَهُ مِنَ النُّورِ مَا بَيْنَ الجُمُعَتَيْنِ"\n\n` +
`📿 لا تنسوا قراءة السورة اليوم\n` +
`🤲 والإكثار من الصلاة على النبي ﷺ`;

```
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
            .catch(err => console.log(`Failed to send to ${chatId}:`, err.message));
    }
}
```

});

// Periodic Azkar checker - Every minute
setInterval(async