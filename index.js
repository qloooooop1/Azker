require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cron = require('node-cron');
const moment = require('moment-timezone');
const express = require('express');

// ==================== CONFIGURATION ====================
const BOT_TOKEN = process.env.BOT_TOKEN;
const DATABASE_CHANNEL_ID = -1003624663502; // قناة حفظ الإعدادات
const PORT = process.env.PORT || 3000;

// نموذج عربي قوي على Hugging Face
const HF_MODEL_URL = 'https://api-inference.huggingface.co/models/Qwen/Qwen2.5-7B-Instruct';

// Initialize bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Express keep-alive (مهم لـ Render)
const app = express();
app.get('/', (req, res) => res.send('Bot is running'));
app.listen(PORT, () => console.log(`Server on port ${PORT}`));

// ==================== حفظ الإعدادات في القناة ====================
let allSettings = {}; // { "-100123456789": { ...settings } }

async function loadSettingsFromChannel() {
    try {
        const history = await bot.getChatHistory(DATABASE_CHANNEL_ID, { limit: 1 });
        const lastMsg = history[0];

        if (lastMsg && lastMsg.text && lastMsg.text.startsWith('BOT_SETTINGS_JSON:')) {
            const jsonPart = lastMsg.text.replace('BOT_SETTINGS_JSON:', '').trim();
            allSettings = JSON.parse(jsonPart);
            console.log('تم تحميل الإعدادات من القناة بنجاح');
        } else {
            console.log('لم يتم العثور على رسالة إعدادات سابقة');
        }
    } catch (err) {
        console.error('فشل تحميل إعدادات القناة:', err.message);
    }
}

async function saveSettingsToChannel() {
    try {
        const content = 'BOT_SETTINGS_JSON:\n' + JSON.stringify(allSettings, null, 2);

        const history = await bot.getChatHistory(DATABASE_CHANNEL_ID, { limit: 1 });
        const lastMsg = history[0];

        if (lastMsg && lastMsg.text && lastMsg.text.startsWith('BOT_SETTINGS_JSON:')) {
            // تعديل الرسالة الموجودة
            await bot.editMessageText(content, {
                chat_id: DATABASE_CHANNEL_ID,
                message_id: lastMsg.message_id
            });
        } else {
            // إرسال رسالة جديدة
            await bot.sendMessage(DATABASE_CHANNEL_ID, content);
        }
        console.log('تم حفظ الإعدادات في القناة');
    } catch (err) {
        console.error('فشل حفظ الإعدادات في القناة:', err.message);
    }
}

// تحميل الإعدادات عند بداية التشغيل
loadSettingsFromChannel();

// الإعدادات الافتراضية لأي مجموعة جديدة
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
    aiResponses: { enabled: false, token: null },
    prayerTimes: { enabled: false },
    lastPeriodicAzkar: null,
    timezone: 'Asia/Riyadh',
    lastAIDailyReminder: null
};

function getGroupSettings(chatId) {
    if (!allSettings[chatId]) {
        allSettings[chatId] = JSON.parse(JSON.stringify(defaultSettings));
        saveSettingsToChannel();
    }
    return allSettings[chatId];
}

function updateGroupSettings(chatId, updates) {
    const settings = getGroupSettings(chatId);
    Object.assign(settings, updates);
    allSettings[chatId] = settings;
    saveSettingsToChannel();
}

// ==================== API SOURCES ====================
const API_SOURCES = {
    azkarSabah: 'https://ahegazy.github.io/muslimKit/json/azkar_sabah.json',
    azkarMassa: 'https://ahegazy.github.io/muslimKit/json/azkar_massa.json',
    azkarPostPrayer: 'https://ahegazy.github.io/muslimKit/json/PostPrayer_azkar.json'
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
        let url = API_SOURCES.azkarSabah;
        if (type === 'evening') url = API_SOURCES.azkarMassa;
        if (type === 'prayer') url = API_SOURCES.azkarPostPrayer;

        const { data } = await axios.get(url);
        return data;
    } catch (err) {
        console.error('Error fetching azkar:', err.message);
        return null;
    }
}

function formatAzkarMessage(azkar, title) {
    let message = `✦ *${title}* ✦\n\n`;
    if (Array.isArray(azkar) && azkar.length > 0) {
        // اختيار 3–5 أذكار عشوائية فقط
        const shuffled = [...azkar].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, Math.floor(Math.random() * 3) + 3);

        selected.forEach((item, i) => {
            const text = item.zekr || item.text || '(غير متوفر)';
            const count = item.repeat || 1;
            message += `${i+1}. ${text}\n`;
            if (count > 1) message += `   التكرار: ${count}\n`;
            message += '\n';
        });
    }
    message += '📿 من حصن المسلم';
    return message;
}

// ==================== Hugging Face AI ====================
async function askAI(prompt, token) {
    try {
        const res = await axios.post(HF_MODEL_URL, {
            inputs: prompt,
            parameters: { max_new_tokens: 300, temperature: 0.7 }
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return res.data[0]?.generated_text?.trim() || 'لم أفهم السؤال جيدًا';
    } catch (err) {
        console.error('AI error:', err.response?.data || err.message);
        return 'تعذر الرد حاليًا، تأكد من المفتاح أو حاول لاحقًا';
    }
}

// ==================== KEYBOARDS ====================
async function getMainKeyboard() {
    return {
        inline_keyboard: [
            [{ text: '➕ إضافة البوت للمجموعة', url: `https://t.me/${(await bot.getMe()).username}?startgroup=true` }],
            [{ text: '📚 المجموعة الرسمية', url: `https://t.me/c/${Math.abs(OFFICIAL_GROUP_ID || 0).toString().substring(3)}` }],
            [{ text: '👨‍💻 المطور', url: 'https://t.me/dev3bod' }],
            [{ text: '📖 القرآن الكريم', callback_data: 'quran_menu' }],
            [{ text: '📿 الأذكار', callback_data: 'azkar_menu' }],
            [{ text: '🕌 أوقات الصلاة', callback_data: 'prayer_times' }],
            [{ text: '❓ المساعدة', callback_data: 'help' }]
        ]
    };
}

async function getSettingsKeyboard(chatId) {
    const s = getGroupSettings(chatId);
    return {
        inline_keyboard: [
            [{ text: `🌅 أذكار الصباح والمساء ${s.morningAzkar.enabled || s.eveningAzkar.enabled ? '✅' : ''}`, callback_data: `settings_daily_${chatId}` }],
            [{ text: `🔄 الأذكار الدورية ${s.periodicAzkar.enabled ? '✅' : ''}`, callback_data: `settings_periodic_${chatId}` }],
            [{ text: `📅 تذكيرات الجمعة ${s.fridayReminder.enabled ? '✅' : ''}`, callback_data: `settings_friday_${chatId}` }],
            [{ text: `🌙 رمضان والمناسبات ${s.ramadan.enabled || s.arafat.enabled ? '✅' : ''}`, callback_data: `settings_occasions_${chatId}` }],
            [{ text: `🤖 الذكاء الاصطناعي ${s.aiResponses.enabled ? '✅' : ''}`, callback_data: `settings_ai_${chatId}` }],
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
        bot.sendMessage(chatId, 
            '🌟 مرحبًا بك في بوت الأذكار والقرآن\n\n' +
            'اكتب في المجموعة:\nاذكار + سؤالك\nأو "سؤالك هنا"\n\n' +
            'استخدم /settings للإعدادات',
            { parse_mode: 'Markdown', reply_markup: await getMainKeyboard() }
        );
    } else {
        const isUserAdmin = await isAdmin(chatId, userId);
        if (isUserAdmin) {
            bot.sendMessage(userId, '⚙️ إعدادات المجموعة', {
                parse_mode: 'Markdown',
                reply_markup: await getSettingsKeyboard(chatId)
            });
            bot.sendMessage(chatId, 'تم إرسال لوحة التحكم في الخاص');
        } else {
            bot.sendMessage(chatId, '⛔️ هذا الأمر للمدراء فقط');
        }
    }
});

bot.onText(/\/settings/, async (msg) => {
    if (msg.chat.type === 'private') return;
    if (!(await isAdmin(msg.chat.id, msg.from.id))) return bot.reply(msg, 'للمشرفين فقط');

    bot.sendMessage(msg.from.id, '⚙️ إعدادات المجموعة', {
        parse_mode: 'Markdown',
        reply_markup: await getSettingsKeyboard(msg.chat.id)
    });
});

// ==================== CALLBACK QUERY ====================
bot.on('callback_query', async q => {
    const d = q.data;
    const chatId = q.message.chat.id;
    const msgId = q.message.message_id;

    if (d === 'main_menu') {
        bot.editMessageText('القائمة الرئيسية', {
            chat_id: chatId, message_id: msgId,
            reply_markup: await getMainKeyboard()
        });
    }

    if (d.startsWith('settings_ai_')) {
        const s = getGroupSettings(chatId);
        bot.editMessageText(
            `الذكاء الاصطناعي: ${s.aiResponses.enabled ? 'مفعل' : 'معطل'}\n` +
            `مفتاح: ${s.aiResponses.token ? 'موجود' : 'غير موجود'}`,
            {
                chat_id: chatId, message_id: msgId,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: s.aiResponses.enabled ? 'تعطيل' : 'تفعيل', callback_data: `toggle_ai_${chatId}` }],
                        [{ text: 'إضافة/تغيير المفتاح', callback_data: `set_ai_key_${chatId}` }],
                        [{ text: 'رجوع', callback_data: 'main_menu' }]
                    ]
                }
            }
        );
    }

    if (d.startsWith('toggle_ai_')) {
        const s = getGroupSettings(chatId);
        s.aiResponses.enabled = !s.aiResponses.enabled;
        updateGroupSettings(chatId, s);
        bot.answerCallbackQuery(q.id, { text: s.aiResponses.enabled ? 'تم التفعيل' : 'تم التعطيل' });
        bot.emit('callback_query', { ...q, data: `settings_ai_${chatId}` });
    }

    if (d.startsWith('set_ai_key_')) {
        bot.answerCallbackQuery(q.id);
        bot.sendMessage(q.from.id, 'أرسل مفتاح huggingface الآن (يبدأ بـ hf_)');
    }
});

// ==================== حفظ مفتاح AI ====================
bot.on('message', async msg => {
    if (msg.chat.type !== 'private') return;
    if (!msg.text?.startsWith('hf_')) return;

    bot.sendMessage(msg.chat.id, 'تم استلام المفتاح!\n\n' +
        'للحفظ في مجموعة معينة، أرسل داخلها:\n' +
        `/setaikey ${msg.text}`
    );
});

bot.onText(/\/setaikey (.+)/, async (msg, match) => {
    if (msg.chat.type === 'private') return;
    if (!(await isAdmin(msg.chat.id, msg.from.id))) return bot.reply(msg, 'للمشرفين فقط');

    const token = match[1].trim();
    if (!token.startsWith('hf_')) return bot.reply(msg, 'يجب أن يبدأ بـ hf_');

    const s = getGroupSettings(msg.chat.id);
    s.aiResponses.token = token;
    updateGroupSettings(msg.chat.id, s);
    bot.reply(msg, 'تم حفظ المفتاح بنجاح');
});

// ==================== الذكاء الاصطناعي ====================
bot.on('message', async msg => {
    if (msg.chat.type === 'private') return;
    const text = msg.text?.trim();
    if (!text) return;

    const lower = text.toLowerCase();
    if (!lower.startsWith('اذكار') && !text.includes('"')) return;

    const s = getGroupSettings(msg.chat.id);
    if (!s.aiResponses.enabled || !s.aiResponses.token) return;

    const prompt = `أنت عالم شرعي، أجب بالفصحى، موثوق، مختصر، مع ذكر المصدر إن أمكن:\n\n${text}`;

    const answer = await askAI(prompt, s.aiResponses.token);
    bot.reply(msg, answer);
});

// ==================== SCHEDULED TASKS ====================

// تذكير يومي بالذكاء الاصطناعي (9:30 صباحًا)
cron.schedule('30 9 * * *', async () => {
    const reminder = 
        '🕌 *تذكير يومي*\n\n' +
        'يمكنك سؤال البوت عن أي آية – حديث – دعاء – تفسير بكتابة:\n' +
        'اذكار + سؤالك\n' +
        'أو "سؤالك هنا" بين علامتي تنصيص\n\n' +
        'مثال:\nاذكار فضل سورة الكهف\n"ما معنى ليلة القدر"';

    for (const [chatId, s] of Object.entries(allSettings)) {
        if (s.aiResponses?.enabled) {
            bot.sendMessage(chatId, reminder, { parse_mode: 'Markdown' });
        }
    }
}, { timezone: 'Asia/Riyadh' });

// سورة الكهف – الجمعة 10 صباحًا
cron.schedule('0 10 * * 5', async () => {
    const audio = 'https://download.quranicaudio.com/qdc/abdul_baset/mujawwad/18.mp3';

    for (const [chatId, s] of Object.entries(allSettings)) {
        if (s.fridayReminder?.enabled) {
            bot.sendMessage(chatId, '📖 تذكير بقراءة سورة الكهف اليوم');
            bot.sendAudio(chatId, audio, { caption: 'سورة الكهف - عبد الباسط عبد الصمد' });
        }
    }
}, { timezone: 'Asia/Riyadh' });

// الأذكار الدورية (قصيرة 3-5 أذكار عشوائية)
setInterval(async () => {
    const now = moment().tz('Asia/Riyadh');
    for (const [chatId, s] of Object.entries(allSettings)) {
        if (!s.periodicAzkar?.enabled) continue;

        const last = s.lastPeriodicAzkar ? moment(s.lastPeriodicAzkar) : null;
        if (last && now.diff(last, 'minutes') < s.periodicAzkar.interval) continue;

        const types = ['azkarSabah', 'azkarMassa', 'azkarPostPrayer'];
        const type = types[Math.floor(Math.random() * types.length)];
        const azkar = await fetchAzkar(type);

        if (azkar && Array.isArray(azkar)) {
            const shuffled = [...azkar].sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, Math.floor(Math.random() * 3) + 3);

            const msg = formatAzkarMessage(selected, 'ذكر دوري');
            bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });

            s.lastPeriodicAzkar = now.toISOString();
            updateGroupSettings(chatId, s);
        }
    }
}, 60000);

console.log('🤖 البوت بدأ بنجاح');