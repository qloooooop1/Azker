require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const moment = require('moment');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { initializeDatabase, addDefaultAdkar } = require('./database');

// التحقق من التوكن
const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
    console.error('❌ خطأ: لم يتم تعيين TELEGRAM_BOT_TOKEN');
    process.exit(1);
}

// تهيئة البوت
const bot = new TelegramBot(botToken, { polling: true });
console.log('✅ بوت التلجرام يعمل...');

// تهيئة قاعدة البيانات
const db = new sqlite3.Database(process.env.DB_PATH || './adkar.db');

// إنشاء الجداول الأساسية
db.serialize(() => {
    // جدول المجموعات
    db.run(`CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT UNIQUE NOT NULL,
        title TEXT,
        admin_id TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        bot_enabled INTEGER DEFAULT 1,
        settings TEXT DEFAULT '{}',
        join_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_message_date DATETIME
    )`);

    // جدول الأذكار (يتم تعبئتها من لوحة تحكم المطور فقط)
    db.run(`CREATE TABLE IF NOT EXISTS adkar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL,
        type TEXT DEFAULT 'text',
        file_path TEXT,
        schedule_type TEXT DEFAULT 'daily',
        schedule_time TEXT,
        days_of_week TEXT DEFAULT '[0,1,2,3,4,5,6]',
        repeat_interval INTEGER DEFAULT 60,
        is_active INTEGER DEFAULT 1,
        priority INTEGER DEFAULT 1,
        created_by TEXT DEFAULT 'developer',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // جدول إحصائيات المجموعات
    db.run(`CREATE TABLE IF NOT EXISTS group_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT,
        adkar_sent INTEGER DEFAULT 0,
        last_adkar_sent DATETIME,
        members_count INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // جدول طلبات المشرفين
    db.run(`CREATE TABLE IF NOT EXISTS admin_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT,
        admin_id TEXT,
        request_type TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// إضافة الأذكار الافتراضية (فقط عند التشغيل الأول)
function addDefaultAdkarIfNeeded() {
    db.get("SELECT COUNT(*) as count FROM adkar", (err, row) => {
        if (row.count === 0) {
            console.log('📝 إضافة الأذكار الافتراضية...');
            
            const defaultAdkar = [
                {
                    title: "أذكار الصباح",
                    content: "أصبحنا وأصبح الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير.",
                    category: "morning",
                    schedule_time: "06:00"
                },
                {
                    title: "أذكار المساء",
                    content: "أمسينا وأمسى الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير.",
                    category: "evening", 
                    schedule_time: "18:00"
                },
                {
                    title: "سبحان الله وبحمده",
                    content: "سبحان الله وبحمده، سبحان الله العظيم. من قالها في يوم مائة مرة حطت خطاياه وإن كانت مثل زبد البحر.",
                    category: "general",
                    schedule_time: "12:00"
                }
            ];

            defaultAdkar.forEach(adkar => {
                db.run(`INSERT INTO adkar (title, content, category, schedule_type, schedule_time) 
                        VALUES (?, ?, ?, 'daily', ?)`,
                    [adkar.title, adkar.content, adkar.category, adkar.schedule_time]);
            });
        }
    });
}

addDefaultAdkarIfNeeded();

// وظيفة التحقق من صلاحية النشر للمجموعة
function canSendToGroup(chatId, callback) {
    db.get(`SELECT bot_enabled, is_active FROM groups WHERE chat_id = ?`, 
        [chatId], (err, group) => {
            if (err || !group) {
                callback(false);
                return;
            }
            callback(group.bot_enabled === 1 && group.is_active === 1);
        });
}

// وظيفة إرسال الأذكار
async function sendAdkarToGroup(chatId, adkar) {
    try {
        canSendToGroup(chatId, async (canSend) => {
            if (!canSend) return;

            let messageOptions = { parse_mode: 'HTML' };
            
            switch (adkar.type) {
                case 'audio':
                    if (adkar.file_path && fs.existsSync(adkar.file_path)) {
                        await bot.sendAudio(chatId, adkar.file_path, {
                            caption: `<b>${adkar.title}</b>\n\n${adkar.content}`,
                            ...messageOptions
                        });
                    } else {
                        await sendTextAdkar(chatId, adkar);
                    }
                    break;
                    
                case 'pdf':
                    if (adkar.file_path && fs.existsSync(adkar.file_path)) {
                        await bot.sendDocument(chatId, adkar.file_path, {
                            caption: `<b>${adkar.title}</b>\n\n${adkar.content}`,
                            ...messageOptions
                        });
                    } else {
                        await sendTextAdkar(chatId, adkar);
                    }
                    break;
                    
                default:
                    await sendTextAdkar(chatId, adkar);
            }
            
            // تحديث الإحصائيات
            db.run(`UPDATE group_stats SET adkar_sent = adkar_sent + 1, last_adkar_sent = datetime('now') 
                    WHERE chat_id = ?`, [chatId]);
            
            console.log(`✅ تم نشر ذكر في ${chatId}: ${adkar.title}`);
        });
    } catch (error) {
        console.error(`❌ خطأ في النشر لـ ${chatId}:`, error.message);
    }
}

async function sendTextAdkar(chatId, adkar) {
    const message = `🕌 <b>${adkar.title}</b>\n\n${adkar.content}\n\n` +
                   `📅 ${moment().format('YYYY/MM/DD')} | 🕒 ${moment().format('HH:mm')}`;
    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
}

// جدولة النشر اليومي
cron.schedule('* * * * *', () => { // تتحقق كل دقيقة
    const now = moment();
    const currentTime = now.format('HH:mm');
    const currentDay = now.day();
    
    // جلب الأذكار المجدولة لهذا الوقت
    db.all(`SELECT * FROM adkar WHERE is_active = 1 AND schedule_time = ?`, 
        [currentTime], (err, adkarList) => {
            if (err || !adkarList.length) return;
            
            // فلترة حسب أيام الأسبوع
            const filteredAdkar = adkarList.filter(adkar => {
                if (adkar.schedule_type === 'daily') return true;
                if (adkar.schedule_type === 'weekly' && adkar.days_of_week) {
                    const days = JSON.parse(adkar.days_of_week);
                    return days.includes(currentDay);
                }
                return false;
            });
            
            // جلب المجموعات النشطة
            db.all(`SELECT chat_id FROM groups WHERE bot_enabled = 1 AND is_active = 1`, 
                (err, groups) => {
                    if (err || !groups.length) return;
                    
                    filteredAdkar.forEach(adkar => {
                        groups.forEach(group => {
                            sendAdkarToGroup(group.chat_id, adkar);
                        });
                    });
                });
        });
});

// النشر بفاصل زمني
cron.schedule('*/5 * * * *', () => { // كل 5 دقائق
    db.all(`SELECT * FROM adkar WHERE is_active = 1 AND schedule_type = 'interval' 
            AND repeat_interval > 0`, (err, intervalAdkar) => {
        if (err || !intervalAdkar.length) return;
        
        db.all(`SELECT chat_id FROM groups WHERE bot_enabled = 1 AND is_active = 1`, 
            (err, groups) => {
                if (err || !groups.length) return;
                
                intervalAdkar.forEach(adkar => {
                    const now = moment();
                    const lastHour = now.format('HH');
                    
                    // التحقق من الفاصل الزمني
                    db.get(`SELECT MAX(sent_at) as last_sent FROM group_adkar_log 
                            WHERE adkar_id = ? AND strftime('%H', sent_at) = ?`,
                        [adkar.id, lastHour], (err, row) => {
                            if (!row || !row.last_sent || 
                                moment(now).diff(moment(row.last_sent), 'minutes') >= adkar.repeat_interval) {
                                
                                groups.forEach(group => {
                                    sendAdkarToGroup(group.chat_id, adkar);
                                });
                            }
                        });
                });
            });
    });
});

// معالجة أوامر المشرفين
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const chatType = msg.chat.type;
    
    if (chatType === 'private') {
        // محادثة خاصة
        bot.sendMessage(chatId, 
            `مرحباً! 👋\n\n` +
            `أنا بوت نشر الأذكار التلقائي.\n` +
            `يمكنك إضافتي لمجموعتك وسأقوم بنشر الأذكار حسب إعدادات المطور.\n\n` +
            `⚠️ التحكم الكامل في البوت متاح فقط للمطور من خلال لوحة التحكم المركزية.`,
            { parse_mode: 'Markdown' }
        );
    } else if (chatType === 'group' || chatType === 'supergroup') {
        // تمت إضافة البوت لمجموعة
        const chatTitle = msg.chat.title;
        const adminId = userId.toString();
        
        // حفظ المجموعة في قاعدة البيانات
        db.run(`INSERT OR REPLACE INTO groups (chat_id, title, admin_id, bot_enabled) 
                VALUES (?, ?, ?, 1)`, 
            [chatId, chatTitle, adminId], 
            (err) => {
                if (err) {
                    console.error('❌ خطأ في حفظ المجموعة:', err);
                    return;
                }
                
                // إرسال رسالة ترحيب
                const welcomeMessage = `🕌 *تم تفعيل بوت الأذكار في ${chatTitle}* 🕌\n\n` +
                    `سأقوم بنشر الأذكار حسب الإعدادات المركزية من المطور.\n\n` +
                    `*الأوامر المتاحة للمشرفين:*\n` +
                    `/enable_bot - تفعيل البوت في المجموعة\n` +
                    `/disable_bot - إيقاف البوت مؤقتاً\n` +
                    `/bot_status - حالة البوت في المجموعة\n\n` +
                    `⚠️ *ملاحظة:*\n` +
                    `إعدادات النشر والتوقيت والأذكار يتم التحكم بها من قبل المطور فقط.`;
                
                bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
                
                // إرسال رسالة خاصة للمشرف
                bot.sendMessage(adminId,
                    `✅ *تم تفعيل البوت في مجموعة جديدة*\n\n` +
                    `📌 المجموعة: ${chatTitle}\n` +
                    `👥 الرابط: ${msg.chat.username ? `@${msg.chat.username}` : 'خاصة'}\n\n` +
                    `يمكنك التحكم في البوت من خلال:\n` +
                    `/enable_bot - تفعيل النشر\n` +
                    `/disable_bot - إيقاف النشر\n` +
                    `/bot_status - عرض الحالة`,
                    { parse_mode: 'Markdown' }
                );
            });
    }
});

// تفعيل البوت في المجموعة
bot.onText(/\/enable_bot/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // التحقق من صلاحية المشرف
    const isAdmin = await isChatAdmin(chatId, userId);
    if (!isAdmin) {
        bot.sendMessage(chatId, '⚠️ هذا الأمر متاح للمشرفين فقط.');
        return;
    }
    
    db.run(`UPDATE groups SET bot_enabled = 1 WHERE chat_id = ?`, [chatId], (err) => {
        if (err) {
            bot.sendMessage(chatId, '❌ حدث خطأ في تفعيل البوت.');
            return;
        }
        
        bot.sendMessage(chatId, '✅ *تم تفعيل البوت في المجموعة*\nسيبدأ نشر الأذكار حسب الإعدادات المركزية.', 
            { parse_mode: 'Markdown' });
    });
});

// إيقاف البوت في المجموعة
bot.onText(/\/disable_bot/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // التحقق من صلاحية المشرف
    const isAdmin = await isChatAdmin(chatId, userId);
    if (!isAdmin) {
        bot.sendMessage(chatId, '⚠️ هذا الأمر متاح للمشرفين فقط.');
        return;
    }
    
    db.run(`UPDATE groups SET bot_enabled = 0 WHERE chat_id = ?`, [chatId], (err) => {
        if (err) {
            bot.sendMessage(chatId, '❌ حدث خطأ في إيقاف البوت.');
            return;
        }
        
        bot.sendMessage(chatId, '⏸️ *تم إيقاف البوت مؤقتاً*\nلن يتم نشر أي أذكار حتى إعادة التفعيل.', 
            { parse_mode: 'Markdown' });
    });
});

// حالة البوت في المجموعة
bot.onText(/\/bot_status/, async (msg) => {
    const chatId = msg.chat.id;
    
    db.get(`SELECT bot_enabled, is_active, join_date FROM groups WHERE chat_id = ?`, 
        [chatId], (err, group) => {
            if (err || !group) {
                bot.sendMessage(chatId, '❌ المجموعة غير مسجلة.');
                return;
            }
            
            const status = group.bot_enabled === 1 ? '🟢 نشط' : '🔴 متوقف';
            const statusMessage = `*حالة البوت في المجموعة:*\n\n` +
                `📌 الحالة: ${status}\n` +
                `📅 تاريخ الإضافة: ${moment(group.join_date).format('YYYY/MM/DD')}\n` +
                `👤 المشرف الرئيسي: ${msg.from.first_name}\n\n` +
                `*الأوامر:*\n` +
                `${group.bot_enabled === 1 ? '❌ /disable_bot' : '✅ /enable_bot'}`;
            
            bot.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });
        });
});

// التحقق من صلاحية المشرف
async function isChatAdmin(chatId, userId) {
    try {
        const admins = await bot.getChatAdministrators(chatId);
        return admins.some(admin => admin.user.id === userId);
    } catch (error) {
        return false;
    }
}

// معالجة رسائل المجموعة
bot.on('message', (msg) => {
    if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
        const chatId = msg.chat.id;
        
        // تحديث تاريخ آخر رسالة
        db.run(`UPDATE groups SET last_message_date = datetime('now') WHERE chat_id = ?`, 
            [chatId]);
    }
});

// معالجة إزالة البوت من مجموعة
bot.on('left_chat_member', (msg) => {
    if (msg.left_chat_member.username === bot.options.username) {
        const chatId = msg.chat.id;
        
        db.run(`UPDATE groups SET is_active = 0 WHERE chat_id = ?`, [chatId], () => {
            console.log(`❌ تم إزالة البوت من المجموعة: ${chatId}`);
        });
    }
});

// بدء الخادم
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`);
    console.log(`👑 لوحة تحكم المطور: http://localhost:${PORT}/admin`);
    console.log(`📊 إحصائيات المجموعات: http://localhost:${PORT}/stats`);
});