require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cron = require('node-cron');
const moment = require('moment-timezone');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

// ==================== CONFIGURATION ====================
const BOT_TOKEN = process.env.BOT_TOKEN;
const DATABASE_CHANNEL_ID = parseInt(process.env.DATABASE_CHANNEL_ID || '0');
const OFFICIAL_GROUP_ID = parseInt(process.env.OFFICIAL_GROUP_ID || '0');
const DEVELOPER_ID = parseInt(process.env.DEVELOPER_ID || '0');
const PORT = process.env.PORT || 3000;

// Initialize bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Express server for keep-alive
const app = express();
app.get('/', (req, res) => {
    res.send('🤖 Islamic Bot is running! الحمد لله');
});
app.listen(PORT, () => {
    console.log(`✅ Keep-alive server running on port ${PORT}`);
});

// ==================== SETTINGS STORAGE (دائم بملف JSON) ====================
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

let allSettings = {}; // { chatId: { ...settings } }

async function loadAllSettings() {
    try {
        const data = await fs.readFile(SETTINGS_FILE, 'utf8');
        allSettings = JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            allSettings = {};
        } else {
            console.error('خطأ في قراءة settings.json:', err);
        }
    }
}

async function saveAllSettings() {
    try {
        await fs.writeFile(SETTINGS_FILE, JSON.stringify(allSettings, null, 2), 'utf8');
    } catch (err) {
        console.error('خطأ في حفظ settings.json:', err);
    }
}

// تحميل الإعدادات عند بدء البوت
loadAllSettings();

const defaultSettings = {
    morningAzkar: { enabled: true, time: '06:00' },
    eveningAzkar: { enabled: true, time: '17:00' },
    periodicAzkar: { enabled: true, interval: 120 },
    fridayReminder: { enabled: true },
    ramadan: { enabled: true },
    arafat: { enabled: true },
    eid: { enabled: true },
    ashura: { enabled: true },
    lastTenDays: { enabled: true },
    quranAudio: { enabled: true },
    azkarAudio: { enabled: true },
    eidTakbeer: { enabled: true },
    aiResponses: { enabled: true, token: null },
    prayerTimes: { enabled: false },
    lastPeriodicAzkar: null,
    timezone: 'Asia/Riyadh',
    stats: { totalMessages: 0, lastActive: null }
};

function getGroupSettings(chatId) {
    if (!allSettings[chatId]) {
        allSettings[chatId] = JSON.parse(JSON.stringify(defaultSettings));
        saveAllSettings();
    }
    return allSettings[chatId];
}

function updateGroupSettings(chatId, updates) {
    const settings = getGroupSettings(chatId);
    Object.assign(settings, updates);
    allSettings[chatId] = settings;
    saveAllSettings();
}

// ==================== API SOURCES ====================
const API_SOURCES = {
    azkarSabah: 'https://ahegazy.github.io/muslimKit/json/azkar_sabah.json',
    azkarMassa: 'https://ahegazy.github.io/muslimKit/json/azkar_massa.json',
    azkarPostPrayer: 'https://ahegazy.github.io/muslimKit/json/PostPrayer_azkar.json',
    hadith: 'https://api.hadith.gading.dev/books/muslim?range=1-300',
    quranAudio: 'https://api.quran.com/api/v4/chapter_recitations/1',
    prayerTimes: 'http://api.aladhan.com/v1/timings'
};

// ==================== HELPER FUNCTIONS ====================
async function isAdmin(chatId, userId) {
    try {
        const member = await bot.getChatMember(chatId, userId);
        return ['creator', 'administrator'].includes(member.status);
    } catch {
        return false;
    }
}

async function fetchAzkar(type) {
    try {
        let url;
        switch (type) {
            case 'morning': url = API_SOURCES.azkarSabah; break;
            case 'evening': url = API_SOURCES.azkarMassa; break;
            case 'prayer': url = API_SOURCES.azkarPostPrayer; break;
            default: url = API_SOURCES.azkarSabah;
        }
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching azkar:', error.message);
        return null;
    }
}

function formatAzkarMessage(azkar, title) {
    let message = `🌙 *${title}* 🌙\n\n`;
    if (Array.isArray(azkar)) {
        const items = azkar.slice(0, 10);
        items.forEach((item, index) => {
            const text = item.zekr || item.ARABIC || item.text || item.content || item.category || 'غير متوفر';
            const count = item.repeat || item.REPEAT || item.count || 1;
            if (text.trim()) {
                message += `${index + 1}. ${text}\n`;
                if (count > 1) message += `   🔢 التكرار: ${count} مرة\n`;
                message += '\n';
            }
        });
    }
    message += '\n📿 *حصن المسلم*';
    return message;
}

// ==================== ISLAMIC CALENDAR (تقريبي لكن يعمل) ====================
function getIslamicDate() {
    const now = new Date();
    const gregorianYear = now.getFullYear();
    const islamicYear = Math.floor((gregorianYear - 622) * 1.030684);
    const month = now.getMonth() + 1;
    const day = now.getDate();
    return { year: islamicYear, month, day };
}

// ==================== KEYBOARDS ====================
async function getMainKeyboard() {
    return {
        inline_keyboard: [
            [{ text: '➕ إضافة البوت للمجموعة', url: `https://t.me/${(await bot.getMe()).username}?startgroup=true` }],
            [{ text: '📚 المجموعة الرسمية', url: `https://t.me/c/${Math.abs(OFFICIAL_GROUP_ID).toString().substring(3)}` }],
            [{ text: '👨‍💻 المطور', url: 'https://t.me/dev3bod' }],
            [{ text: '📖 القرآن الكريم', callback_data: 'quran_menu' }],
            [{ text: '📿 الأذكار', callback_data: 'azkar_menu' }],
            [{ text: '🕌 أوقات الصلاة', callback_data: 'prayer_times' }],
            [{ text: '❓ المساعدة', callback_data: 'help' }]
        ]
    };
}

async function getSettingsKeyboard(chatId) {
    const settings = getGroupSettings(chatId);
    return {
        inline_keyboard: [
            [{ text: `🌅 أذكار الصباح والمساء ${settings.morningAzkar.enabled || settings.eveningAzkar.enabled ? '✅' : '☑️'}`, callback_data: `settings_daily_${chatId}` }],
            [{ text: `🔄 الأذكار الدورية ${settings.periodicAzkar.enabled ? '✅' : '☑️'}`, callback_data: `settings_periodic_${chatId}` }],
            [{ text: `📅 تذكيرات الجمعة ${settings.fridayReminder.enabled ? '✅' : '☑️'}`, callback_data: `settings_friday_${chatId}` }],
            [{ text: `🌙 رمضان والمناسبات ${settings.ramadan.enabled || settings.arafat.enabled || settings.eid.enabled ? '✅' : '☑️'}`, callback_data: `settings_occasions_${chatId}` }],
            [{ text: '🎵 إعدادات الصوت', callback_data: `settings_audio_${chatId}` }],
            [{ text: `🤖 الذكاء الاصطناعي ${settings.aiResponses.enabled ? '✅' : '☑️'}`, callback_data: `settings_ai_${chatId}` }],
            [{ text: '📊 الإحصائيات', callback_data: `stats_${chatId}` }],
            [{ text: '🔙 رجوع', callback_data: 'main_menu' }]
        ]
    };
}

// ==================== BOT COMMANDS ====================
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

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
});

bot.onText(/\/settings/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

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
});

// ==================== CALLBACK HANDLERS ====================
bot.on('callback_query', async (query) => {
    const data = query.data;
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const userId = query.from.id;

    const groupIdMatch = data.match(/_(-?\d+)$/);
    const groupId = groupIdMatch ? parseInt(groupIdMatch[1]) : chatId;

    try {
        if (data === 'main_menu') {
            await bot.editMessageText('🌟 *القائمة الرئيسية*\n\nاختر ما تريد:', {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: await getMainKeyboard()
            });
        }

        else if (data.startsWith('azkar_')) {
            const type = data.split('_')[1];
            let azkarType = 'morning';
            let title = 'أذكار الصباح';
            if (type === 'evening') { azkarType = 'evening'; title = 'أذكار المساء'; }
            if (type === 'prayer') { azkarType = 'prayer'; title = 'أذكار بعد الصلاة'; }

            const azkar = await fetchAzkar(azkarType);
            if (azkar) {
                const message = formatAzkarMessage(azkar, title);
                await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            } else {
                await bot.sendMessage(chatId, 'تعذر جلب الأذكار حالياً');
            }
        }

        else if (data.startsWith('settings_daily_')) {
            const settings = getGroupSettings(groupId);
            const keyboard = {
                inline_keyboard: [
                    [{ text: settings.morningAzkar.enabled ? '✅ أذكار الصباح' : '☑️ أذكار الصباح', callback_data: `toggle_morning_${groupId}` }],
                    [{ text: `⏰ وقت: ${settings.morningAzkar.time}`, callback_data: `time_morning_${groupId}` }],
                    [{ text: settings.eveningAzkar.enabled ? '✅ أذكار المساء' : '☑️ أذكار المساء', callback_data: `toggle_evening_${groupId}` }],
                    [{ text: `⏰ وقت: ${settings.eveningAzkar.time}`, callback_data: `time_evening_${groupId}` }],
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

        else if (data.startsWith('toggle_morning_') || data.startsWith('toggle_evening_')) {
            const settings = getGroupSettings(groupId);
            const isMorning = data.includes('morning');
            const key = isMorning ? 'morningAzkar' : 'eveningAzkar';
            settings[key].enabled = !settings[key].enabled;
            updateGroupSettings(groupId, settings);
            await bot.answerCallbackQuery(query.id, { text: settings[key].enabled ? 'تم التفعيل' : 'تم الإيقاف' });
            bot.emit('callback_query', { ...query, data: `settings_daily_${groupId}` });
        }

        else if (data.startsWith('settings_occasions_')) {
            const settings = getGroupSettings(groupId);
            const keyboard = {
                inline_keyboard: [
                    [{ text: settings.ramadan.enabled ? '✅ رمضان' : '☑️ رمضان', callback_data: `toggle_ramadan_${groupId}` }],
                    [{ text: settings.arafat.enabled ? '✅ يوم عرفة' : '☑️ يوم عرفة', callback_data: `toggle_arafat_${groupId}` }],
                    [{ text: settings.eid.enabled ? '✅ الأعياد' : '☑️ الأعياد', callback_data: `toggle_eid_${groupId}` }],
                    [{ text: settings.ashura.enabled ? '✅ عاشوراء' : '☑️ عاشوراء', callback_data: `toggle_ashura_${groupId}` }],
                    [{ text: settings.lastTenDays.enabled ? '✅ العشر الأواخر' : '☑️ العشر الأواخر', callback_data: `toggle_lastTen_${groupId}` }],
                    [{ text: '🔙 رجوع', callback_data: `back_to_settings_${groupId}` }]
                ]
            };
            await bot.editMessageText('🌙 *إعدادات المناسبات الدينية*', {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        }

        else if (data.startsWith('toggle_ramadan_') || data.startsWith('toggle_arafat_') ||
                 data.startsWith('toggle_eid_') || data.startsWith('toggle_ashura_') ||
                 data.startsWith('toggle_lastTen_')) {
            const settings = getGroupSettings(groupId);
            let key;
            if (data.includes('ramadan')) key = 'ramadan';
            else if (data.includes('arafat')) key = 'arafat';
            else if (data.includes('eid')) key = 'eid';
            else if (data.includes('ashura')) key = 'ashura';
            else if (data.includes('lastTen')) key = 'lastTenDays';

            settings[key].enabled = !settings[key].enabled;
            updateGroupSettings(groupId, settings);
            await bot.answerCallbackQuery(query.id, { text: settings[key].enabled ? 'تم التفعيل' : 'تم الإيقاف' });
            bot.emit('callback_query', { ...query, data: `settings_occasions_${groupId}` });
        }

        else if (data.startsWith('settings_friday_')) {
            const settings = getGroupSettings(groupId);
            const keyboard = {
                inline_keyboard: [
                    [{ text: settings.fridayReminder.enabled ? '✅ مفعّل' : '☑️ معطّل', callback_data: `toggle_friday_${groupId}` }],
                    [{ text: '🔙 رجوع', callback_data: `back_to_settings_${groupId}` }]
                ]
            };
            await bot.editMessageText('📅 *إعدادات تذكيرات الجمعة*', {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        }

        else if (data.startsWith('toggle_friday_')) {
            const settings = getGroupSettings(groupId);
            settings.fridayReminder.enabled = !settings.fridayReminder.enabled;
            updateGroupSettings(groupId, settings);
            await bot.answerCallbackQuery(query.id, { text: settings.fridayReminder.enabled ? 'تم التفعيل' : 'تم الإيقاف' });
            bot.emit('callback_query', { ...query, data: `settings_friday_${groupId}` });
        }

        else if (data.startsWith('settings_ai_')) {
            const settings = getGroupSettings(groupId);
            const hasToken = !!settings.aiResponses.token;
            const status = settings.aiResponses.enabled ? 'مفعّل' : 'معطّل';
            const keyboard = {
                inline_keyboard: [
                    [{ text: status, callback_data: `toggle_ai_${groupId}` }],
                    [{ text: hasToken ? '🔄 تغيير المفتاح' : '➕ إضافة مفتاح Hugging Face', callback_data: `set_ai_key_${groupId}` }],
                    [{ text: '🔙 رجوع', callback_data: `back_to_settings_${groupId}` }]
                ]
            };
            await bot.editMessageText(
                `🤖 *إعدادات الذكاء الاصطناعي*\n\n` +
                `الحالة: ${status}\n` +
                `المفتاح: ${hasToken ? '✔ موجود' : '✖ غير موجود'}\n\n` +
                'اختر خيار:',
                {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                }
            );
        }

        else if (data.startsWith('toggle_ai_')) {
            const settings = getGroupSettings(groupId);
            settings.aiResponses.enabled = !settings.aiResponses.enabled;
            updateGroupSettings(groupId, settings);
            await bot.answerCallbackQuery(query.id, { text: settings.aiResponses.enabled ? 'تم التفعيل' : 'تم الإيقاف' });
            bot.emit('callback_query', { ...query, data: `settings_ai_${groupId}` });
        }

        else if (data.startsWith('set_ai_key_')) {
            await bot.answerCallbackQuery(query.id);
            await bot.sendMessage(userId,
                `📤 أرسل مفتاح Hugging Face الآن (يبدأ بـ hf_)\n\n` +
                `سيتم حفظه خصيصاً لهذه المجموعة (${groupId})`
            );
            // سيتم التقاط المفتاح في on('message')
        }

        else if (data.startsWith('stats_')) {
            const settings = getGroupSettings(groupId);
            const totalGroups = Object.keys(allSettings).length;
            const activeFeatures = Object.values(settings).filter(v => v?.enabled).length;

            const statsMsg = 
                `📊 *إحصائيات المجموعة*\n\n` +
                `• عدد المجموعات المسجلة: ${totalGroups}\n` +
                `• الميزات المفعلة: ${activeFeatures} من ${Object.keys(defaultSettings).length}\n` +
                `• آخر نشاط: ${settings.stats?.lastActive || 'غير معروف'}\n` +
                `• إجمالي الرسائل المرسلة: ${settings.stats?.totalMessages || 0}`;

            await bot.sendMessage(chatId, statsMsg, { parse_mode: 'Markdown' });
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
        bot.answerCallbackQuery(query.id, { text: '❌ حدث خطأ', show_alert: true });
    }
});

// ==================== حفظ مفتاح AI من الرسائل الخاصة ====================
bot.on('message', async (msg) => {
    if (msg.chat.type !== 'private') return;
    if (!msg.text || !msg.text.startsWith('hf_') || msg.text.length < 30) return;

    // نفترض أن آخر طلب مفتاح كان من هذا المستخدم
    // (يمكن تحسينه بـ state لاحقاً)
    await bot.sendMessage(msg.chat.id, 'تم استلام المفتاح!\n\n' +
        'للحفظ في مجموعة معينة، أرسل في المجموعة الأمر:\n' +
        `/setaikey ${msg.text}`
    );
});

// أمر حفظ المفتاح داخل المجموعة
bot.onText(/\/setaikey (.+)/, async (msg, match) => {
    if (msg.chat.type === 'private') return;
    const chatId = msg.chat.id;
    const token = match[1].trim();

    if (!(await isAdmin(chatId, msg.from.id))) {
        return bot.sendMessage(chatId, 'هذا الأمر للمشرفين فقط');
    }

    if (!token.startsWith('hf_')) {
        return bot.sendMessage(chatId, 'المفتاح يجب أن يبدأ بـ hf_');
    }

    const settings = getGroupSettings(chatId);
    settings.aiResponses.token = token;
    updateGroupSettings(chatId, settings);

    bot.sendMessage(chatId, 'تم حفظ مفتاح Hugging Face بنجاح لهذه المجموعة');
});

// ==================== SCHEDULED TASKS ====================

// أذكار الصباح - 6:00 صباحاً
cron.schedule('0 6 * * *', async () => {
    console.log('⏰ إرسال أذكار الصباح...');
    for (const [chatId, settings] of Object.entries(allSettings)) {
        if (settings.morningAzkar?.enabled) {
            const azkar = await fetchAzkar('morning');
            if (azkar) {
                const message = formatAzkarMessage(azkar, 'أذكار الصباح ☀️');
                bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
                    .catch(err => console.log(`فشل الإرسال إلى ${chatId}:`, err.message));
            }
        }
    }
}, { timezone: 'Asia/Riyadh' });

// أذكار المساء - 5:00 مساءً
cron.schedule('0 17 * * *', async () => {
    console.log('⏰ إرسال أذكار المساء...');
    for (const [chatId, settings] of Object.entries(allSettings)) {
        if (settings.eveningAzkar?.enabled) {
            const azkar = await fetchAzkar('evening');
            if (azkar) {
                const message = formatAzkarMessage(azkar, 'أذكار المساء 🌙');
                bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
                    .catch(err => console.log(`فشل الإرسال إلى ${chatId}:`, err.message));
            }
        }
    }
}, { timezone: 'Asia/Riyadh' });

// تذكير الجمعة - 11:00 صباحاً يوم الجمعة
cron.schedule('0 11 * * 5', async () => {
    console.log('📖 إرسال تذكير الجمعة...');
    for (const [chatId, settings] of Object.entries(allSettings)) {
        if (settings.fridayReminder?.enabled) {
            const message =
                `📖 *تذكير بقراءة سورة الكهف* 📖\n\n` +
                `"مَنْ قَرَأَ سُورَةَ الكَهْفِ يَوْمَ الجُمُعَةِ أَضَاءَ لَهُ مِنَ النُّورِ مَا بَيْنَ الجُمُعَتَيْنِ"\n\n` +
                `📿 لا تنسوا قراءة السورة اليوم\n` +
                `🤲 والإكثار من الصلاة على النبي ﷺ`;

            bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
                .catch(err => console.log(`فشل الإرسال إلى ${chatId}:`, err.message));
        }
    }
}, { timezone: 'Asia/Riyadh' });

// الأذكار الدورية (كل interval دقيقة)
setInterval(async () => {
    const now = moment().tz('Asia/Riyadh');
    for (const [chatId, settings] of Object.entries(allSettings)) {
        if (settings.periodicAzkar?.enabled) {
            const last = settings.lastPeriodicAzkar ? moment(settings.lastPeriodicAzkar) : null;
            if (!last || now.diff(last, 'minutes') >= settings.periodicAzkar.interval) {
                const azkar = await fetchAzkar('morning');
                if (azkar) {
                    const message = formatAzkarMessage(azkar, 'ذكر دوري 📿');
                    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
                        .catch(err => console.log(`فشل الإرسال الدوري إلى ${chatId}:`, err.message));

                    settings.lastPeriodicAzkar = now.toISOString();
                    updateGroupSettings(chatId, settings);
                }
            }
        }
    }
}, 60000);

console.log('🤖 البوت بدأ بنجاح');