require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const moment = require('moment');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors');
const helmet = require('helmet');

// ========== إعدادات التطبيق ==========
const app = express();
const PORT = process.env.PORT || 3000;

// إعدادات الأمان
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// التحقق من المتغيرات البيئية الأساسية
const requiredEnvVars = ['TELEGRAM_BOT_TOKEN', 'ADMIN_USERNAME'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`❌ خطأ: المتغير البيئي ${envVar} غير محدد`);
        process.exit(1);
    }
}

// ========== إعداد قاعدة البيانات ==========
const dbPath = process.env.DB_PATH || './adkar.db';
const db = new sqlite3.Database(dbPath);

// إنشاء الجداول
db.serialize(() => {
    // جدول الأذكار (التحكم فقط للمطور)
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

    // جدول سجلات النشر
    db.run(`CREATE TABLE IF NOT EXISTS broadcast_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT,
        adkar_id INTEGER,
        status TEXT,
        error TEXT,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // جدول البث الفوري
    db.run(`CREATE TABLE IF NOT EXISTS broadcasts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'text',
        file_path TEXT,
        sent_count INTEGER DEFAULT 0,
        total_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // جدول المستخدمين (للوحة التحكم)
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // إضافة المستخدم المطور إذا لم يكن موجوداً
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    db.get(`SELECT * FROM users WHERE username = ?`, [adminUsername], (err, user) => {
        if (!user) {
            bcrypt.hash(adminPassword, 10, (err, hash) => {
                if (!err) {
                    db.run(`INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'super_admin')`,
                        [adminUsername, hash]);
                    console.log('👑 تم إنشاء حساب المطور الافتراضي');
                }
            });
        }
    });

    // إضافة الأذكار الافتراضية
    addDefaultAdkar();
});

// ========== إعداد البوت ==========
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(botToken, { polling: true });

console.log('🤖 بوت التلجرام يعمل...');

// ========== وظائف مساعدة ==========
function addDefaultAdkar() {
    const defaultAdkar = [
        {
            title: "أذكار الصباح",
            content: "أصبحنا وأصبح الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير. سبحان الله وبحمده: عدد خلقه، ورضا نفسه، وزنة عرشه، ومداد كلماته.",
            category: "morning",
            schedule_time: "06:00",
            schedule_type: "daily"
        },
        {
            title: "أذكار المساء",
            content: "أمسينا وأمسى الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير. اللهم بك أمسينا، وبك أصبحنا، وبك نحيا، وبك نموت، وإليك النشور.",
            category: "evening",
            schedule_time: "18:00",
            schedule_type: "daily"
        },
        {
            title: "سبحان الله وبحمده",
            content: "سبحان الله وبحمده، سبحان الله العظيم. من قالها في يوم مائة مرة حطت خطاياه وإن كانت مثل زبد البحر.",
            category: "general",
            schedule_type: "interval",
            repeat_interval: 120
        },
        {
            title: "لا إله إلا الله وحده لا شريك له",
            content: "لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير. كان رسول الله ﷺ يعلمنا إذا أصبحنا أن نقولها عشر مرات.",
            category: "general",
            schedule_time: "12:00",
            schedule_type: "daily"
        }
    ];

    defaultAdkar.forEach(adkar => {
        db.run(`INSERT OR IGNORE INTO adkar (title, content, category, schedule_type, schedule_time, repeat_interval) 
                VALUES (?, ?, ?, ?, ?, ?)`,
            [
                adkar.title,
                adkar.content,
                adkar.category,
                adkar.schedule_type,
                adkar.schedule_time,
                adkar.repeat_interval || 60
            ]);
    });
}

// التحقق من إمكانية الإرسال للمجموعة
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

// إرسال ذكر لمجموعة
async function sendAdkarToGroup(chatId, adkar) {
    try {
        canSendToGroup(chatId, async (canSend) => {
            if (!canSend) {
                console.log(`⏸️ البوت موقوف في المجموعة ${chatId}`);
                return;
            }

            let messageOptions = { 
                parse_mode: 'HTML',
                disable_web_page_preview: true 
            };

            // إعداد الرسالة
            const message = `🕌 <b>${adkar.title}</b>\n\n${adkar.content}\n\n` +
                           `📅 ${moment().format('YYYY/MM/DD')} | 🕒 ${moment().format('HH:mm')}\n` +
                           `🔗 #أذكار_${adkar.category}`;

            try {
                // إرسال الملفات إذا وجدت
                if (adkar.type === 'audio' && adkar.file_path && fs.existsSync(adkar.file_path)) {
                    await bot.sendAudio(chatId, adkar.file_path, {
                        caption: message,
                        ...messageOptions
                    });
                } else if (adkar.type === 'pdf' && adkar.file_path && fs.existsSync(adkar.file_path)) {
                    await bot.sendDocument(chatId, adkar.file_path, {
                        caption: message,
                        ...messageOptions
                    });
                } else {
                    // إرسال نص عادي
                    await bot.sendMessage(chatId, message, messageOptions);
                }

                // تسجيل النجاح
                db.run(`INSERT INTO broadcast_logs (chat_id, adkar_id, status) VALUES (?, ?, ?)`,
                    [chatId, adkar.id, 'success']);

                console.log(`✅ تم نشر ذكر "${adkar.title}" في ${chatId}`);

                // تحديث آخر نشاط للمجموعة
                db.run(`UPDATE groups SET last_message_date = datetime('now') WHERE chat_id = ?`,
                    [chatId]);

            } catch (error) {
                console.error(`❌ خطأ في الإرسال لـ ${chatId}:`, error.message);
                db.run(`INSERT INTO broadcast_logs (chat_id, adkar_id, status, error) VALUES (?, ?, ?, ?)`,
                    [chatId, adkar.id, 'failed', error.message]);
            }
        });
    } catch (error) {
        console.error(`❌ خطأ في معالجة الإرسال:`, error);
    }
}

// ========== جدولة النشر ==========
cron.schedule('* * * * *', () => { // كل دقيقة
    const now = moment();
    const currentTime = now.format('HH:mm');
    const currentDay = now.day();

    // جلب الأذكار المجدولة لهذا الوقت
    db.all(`SELECT * FROM adkar WHERE is_active = 1 AND schedule_time = ?`, 
        [currentTime], (err, adkarList) => {
            if (err) {
                console.error('❌ خطأ في جلب الأذكار:', err);
                return;
            }

            if (adkarList.length === 0) return;

            // فلترة حسب أيام الأسبوع
            const filteredAdkar = adkarList.filter(adkar => {
                if (adkar.schedule_type === 'daily') return true;
                if (adkar.schedule_type === 'weekly' && adkar.days_of_week) {
                    try {
                        const days = JSON.parse(adkar.days_of_week);
                        return days.includes(currentDay);
                    } catch {
                        return true;
                    }
                }
                return false;
            });

            if (filteredAdkar.length === 0) return;

            // جلب المجموعات النشطة
            db.all(`SELECT chat_id FROM groups WHERE bot_enabled = 1 AND is_active = 1`, 
                (err, groups) => {
                    if (err) {
                        console.error('❌ خطأ في جلب المجموعات:', err);
                        return;
                    }

                    if (groups.length === 0) return;

                    console.log(`🕒 نشر ${filteredAdkar.length} ذكر في ${groups.length} مجموعة`);

                    // إرسال الأذكار لكل مجموعة
                    filteredAdkar.forEach(adkar => {
                        groups.forEach(async (group) => {
                            await sendAdkarToGroup(group.chat_id, adkar);
                            // تأخير بسيط بين الإرساليات
                            await new Promise(resolve => setTimeout(resolve, 500));
                        });
                    });
                });
        });
});

// النشر بفاصل زمني
cron.schedule('*/5 * * * *', () => { // كل 5 دقائق
    db.all(`SELECT * FROM adkar WHERE is_active = 1 AND schedule_type = 'interval'`, 
        (err, intervalAdkar) => {
            if (err || !intervalAdkar.length) return;

            db.all(`SELECT chat_id FROM groups WHERE bot_enabled = 1 AND is_active = 1`, 
                (err, groups) => {
                    if (err || !groups.length) return;

                    intervalAdkar.forEach(adkar => {
                        groups.forEach(async (group) => {
                            // التحقق من وقت آخر إرسال
                            db.get(`SELECT MAX(sent_at) as last_sent FROM broadcast_logs 
                                    WHERE chat_id = ? AND adkar_id = ? AND status = 'success'
                                    AND datetime(sent_at) > datetime('now', '-1 hour')`,
                                [group.chat_id, adkar.id], (err, row) => {
                                    if (!row || !row.last_sent || 
                                        moment().diff(moment(row.last_sent), 'minutes') >= adkar.repeat_interval) {
                                        sendAdkarToGroup(group.chat_id, adkar);
                                    }
                                });
                        });
                    });
                });
        });
});

// ========== معالجة أوامر البوت ==========
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const chatType = msg.chat.type;

    if (chatType === 'private') {
        // محادثة خاصة
        const welcomeMsg = `🕌 *مرحباً بك في بوت الأذكار* 🕌\n\n` +
            `أنا بوت متخصص في نشر الأذكار تلقائياً في المجموعات.\n\n` +
            `*للاستخدام:*\n` +
            `1. أضفني إلى مجموعتك\n` +
            `2. سأبدأ بنشر الأذكار تلقائياً\n` +
            `3. يمكنك التحكم في البوت من خلال الأوامر أدناه\n\n` +
            `*الأوامر المتاحة:*\n` +
            `/enable_bot - تفعيل البوت في المجموعة\n` +
            `/disable_bot - إيقاف البوت مؤقتاً\n` +
            `/bot_status - حالة البوت\n` +
            `/help - عرض المساعدة\n\n` +
            `⚠️ *ملاحظة:* إعدادات النشر والجدولة تتم من قبل المطور فقط.`;

        await bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'Markdown' });

    } else if (chatType === 'group' || chatType === 'supergroup') {
        // إضافة البوت لمجموعة
        const chatTitle = msg.chat.title;
        const adminId = msg.from.id.toString();

        try {
            // حفظ المجموعة
            db.run(`INSERT OR REPLACE INTO groups (chat_id, title, admin_id, bot_enabled) 
                    VALUES (?, ?, ?, 1)`, 
                [chatId, chatTitle, adminId], 
                async (err) => {
                    if (err) {
                        console.error('❌ خطأ في حفظ المجموعة:', err);
                        await bot.sendMessage(chatId, '❌ حدث خطأ في تفعيل البوت.');
                        return;
                    }

                    // رسالة ترحيب للمجموعة
                    const groupWelcome = `🕌 *تم تفعيل بوت الأذكار في ${chatTitle}* 🕌\n\n` +
                        `سأقوم بنشر الأذكار تلقائياً حسب الإعدادات المركزية.\n\n` +
                        `*الأوامر المتاحة للمشرفين:*\n` +
                        `/enable_bot - تفعيل البوت\n` +
                        `/disable_bot - إيقاف البوت\n` +
                        `/bot_status - حالة البوت\n` +
                        `/help - المساعدة\n\n` +
                        `⚠️ *إعدادات النشر:*\n` +
                        `يتم التحكم بالكامل في إعدادات النشر والجدولة من قبل المطور.`;

                    await bot.sendMessage(chatId, groupWelcome, { parse_mode: 'Markdown' });

                    // رسالة للمشرف
                    const adminMsg = `✅ *تم إضافة البوت لمجموعة جديدة*\n\n` +
                        `📌 المجموعة: ${chatTitle}\n` +
                        `👤 المشرف: ${msg.from.first_name}\n` +
                        `🆔 الرقم: ${chatId}\n\n` +
                        `يمكنك التحكم في البوت من خلال الأوامر في المجموعة.`;

                    await bot.sendMessage(adminId, adminMsg, { parse_mode: 'Markdown' });

                    // إرسال أول ذكر
                    setTimeout(async () => {
                        db.get(`SELECT * FROM adkar WHERE is_active = 1 ORDER BY priority LIMIT 1`, 
                            async (err, adkar) => {
                                if (adkar) {
                                    await sendAdkarToGroup(chatId, adkar);
                                }
                            });
                    }, 2000);
                });

        } catch (error) {
            console.error('❌ خطأ في معالجة المجموعة:', error);
        }
    }
});

bot.onText(/\/enable_bot/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // التحقق من صلاحية المشرف
    try {
        const chatMember = await bot.getChatMember(chatId, userId);
        if (!['creator', 'administrator'].includes(chatMember.status)) {
            await bot.sendMessage(chatId, '⚠️ هذا الأمر متاح للمشرفين فقط.');
            return;
        }

        db.run(`UPDATE groups SET bot_enabled = 1 WHERE chat_id = ?`, [chatId], (err) => {
            if (err) {
                bot.sendMessage(chatId, '❌ حدث خطأ في تفعيل البوت.');
                return;
            }

            bot.sendMessage(chatId, 
                '✅ *تم تفعيل البوت بنجاح*\nسأبدأ بنشر الأذكار حسب الجدولة المحددة.', 
                { parse_mode: 'Markdown' }
            );
        });

    } catch (error) {
        console.error('❌ خطأ في التحقق من المشرف:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ، حاول مرة أخرى.');
    }
});

bot.onText(/\/disable_bot/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        const chatMember = await bot.getChatMember(chatId, userId);
        if (!['creator', 'administrator'].includes(chatMember.status)) {
            await bot.sendMessage(chatId, '⚠️ هذا الأمر متاح للمشرفين فقط.');
            return;
        }

        db.run(`UPDATE groups SET bot_enabled = 0 WHERE chat_id = ?`, [chatId], (err) => {
            if (err) {
                bot.sendMessage(chatId, '❌ حدث خطأ في إيقاف البوت.');
                return;
            }

            bot.sendMessage(chatId, 
                '⏸️ *تم إيقاف البوت مؤقتاً*\nلن يتم نشر أي أذكار حتى إعادة التفعيل.', 
                { parse_mode: 'Markdown' }
            );
        });

    } catch (error) {
        console.error('❌ خطأ في التحقق من المشرف:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ، حاول مرة أخرى.');
    }
});

bot.onText(/\/bot_status/, async (msg) => {
    const chatId = msg.chat.id;

    db.get(`SELECT bot_enabled, is_active, join_date, title FROM groups WHERE chat_id = ?`, 
        [chatId], async (err, group) => {
            if (err || !group) {
                await bot.sendMessage(chatId, '❌ هذه المجموعة غير مسجلة.');
                return;
            }

            const status = group.bot_enabled === 1 ? '🟢 نشط' : '🔴 متوقف';
            const statusMsg = `*حالة البوت في ${group.title || 'المجموعة'}*\n\n` +
                `📊 الحالة: ${status}\n` +
                `📅 تاريخ الإضافة: ${moment(group.join_date).format('YYYY/MM/DD')}\n` +
                `🕒 آخر تحديث: ${moment().format('HH:mm')}\n\n` +
                `*الأوامر:*\n` +
                `${group.bot_enabled === 1 ? '❌ /disable_bot - إيقاف البوت' : '✅ /enable_bot - تفعيل البوت'}`;

            await bot.sendMessage(chatId, statusMsg, { parse_mode: 'Markdown' });
        });
});

bot.onText(/\/help/, (msg) => {
    const helpMsg = `*مركز المساعدة*\n\n` +
        `*أوامر المشرفين:*\n` +
        `/enable_bot - تفعيل البوت في المجموعة\n` +
        `/disable_bot - إيقاف البوت مؤقتاً\n` +
        `/bot_status - عرض حالة البوت\n` +
        `/help - هذه الرسالة\n\n` +
        `*معلومات:*\n` +
        `📌 البوت ينشر الأذكار تلقائياً\n` +
        `📌 الجدولة والإعدادات مركزية\n` +
        `📌 يدعم النصوص والملفات الصوتية\n` +
        `📌 إحصائيات مفصلة للمطور\n\n` +
        `*اتصل بالمطور:*\n` +
        `لأي استفسار تقني أو مشاكل.`;

    bot.sendMessage(msg.chat.id, helpMsg, { parse_mode: 'Markdown' });
});

// معالجة إزالة البوت من المجموعة
bot.on('left_chat_member', (msg) => {
    if (msg.left_chat_member.id === bot.bot.id) {
        const chatId = msg.chat.id;
        
        db.run(`UPDATE groups SET is_active = 0 WHERE chat_id = ?`, [chatId], () => {
            console.log(`❌ تم إزالة البوت من المجموعة: ${chatId}`);
        });
    }
});

// ========== لوحة تحكم المطور ==========
// إعدادات رفع الملفات
const uploadDir = process.env.UPLOAD_PATH || './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    fs.mkdirSync(path.join(uploadDir, 'audio'), { recursive: true });
    fs.mkdirSync(path.join(uploadDir, 'pdf'), { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const typeDir = path.join(uploadDir, file.fieldname);
        cb(null, typeDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }
});

// التحقق من التوكن
function verifyToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'الوصول مرفوض' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
        req.user = decoded;
        next();
    } catch (error) {
        res.status(400).json({ error: 'توكن غير صالح' });
    }
}

// تسجيل الدخول
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
        if (!user) {
            return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
        }
        
        const isValid = await bcrypt.compare(password, user.password_hash);
        
        if (isValid) {
            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                process.env.JWT_SECRET || 'secret_key',
                { expiresIn: '24h' }
            );
            
            res.json({ 
                success: true, 
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role
                }
            });
        } else {
            res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
        }
    });
});

// الحصول على الإحصائيات
app.get('/api/stats', verifyToken, (req, res) => {
    const stats = {};
    
    const queries = [
        { key: 'totalGroups', query: `SELECT COUNT(*) as count FROM groups` },
        { key: 'activeGroups', query: `SELECT COUNT(*) as count FROM groups WHERE is_active = 1 AND bot_enabled = 1` },
        { key: 'totalAdkar', query: `SELECT COUNT(*) as count FROM adkar` },
        { key: 'activeAdkar', query: `SELECT COUNT(*) as count FROM adkar WHERE is_active = 1` },
        { key: 'todaySent', query: `SELECT COUNT(*) as count FROM broadcast_logs WHERE date(sent_at) = date('now') AND status = 'success'` },
        { key: 'totalSent', query: `SELECT COUNT(*) as count FROM broadcast_logs WHERE status = 'success'` }
    ];
    
    let completed = 0;
    queries.forEach(({ key, query }) => {
        db.get(query, (err, row) => {
            stats[key] = row ? row.count : 0;
            completed++;
            
            if (completed === queries.length) {
                res.json(stats);
            }
        });
    });
});

// إدارة الأذكار
app.get('/api/adkar', verifyToken, (req, res) => {
    const { category, active } = req.query;
    
    let query = `SELECT * FROM adkar`;
    const params = [];
    
    if (category || active !== undefined) {
        query += ` WHERE`;
        const conditions = [];
        
        if (category) {
            conditions.push(`category = ?`);
            params.push(category);
        }
        
        if (active !== undefined) {
            conditions.push(`is_active = ?`);
            params.push(active === 'true' ? 1 : 0);
        }
        
        query += ` ` + conditions.join(' AND ');
    }
    
    query += ` ORDER BY priority, created_at DESC`;
    
    db.all(query, params, (err, adkar) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(adkar);
    });
});

app.post('/api/adkar', verifyToken, upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'pdf', maxCount: 1 }
]), (req, res) => {
    const {
        title,
        content,
        category,
        type = 'text',
        schedule_type = 'daily',
        schedule_time,
        days_of_week = '[0,1,2,3,4,5,6]',
        repeat_interval = 60,
        is_active = 1,
        priority = 1
    } = req.body;
    
    let file_path = null;
    if (req.files?.audio) {
        file_path = req.files.audio[0].path;
    } else if (req.files?.pdf) {
        file_path = req.files.pdf[0].path;
    }
    
    db.run(`INSERT INTO adkar 
        (title, content, category, type, file_path, schedule_type, schedule_time, 
         days_of_week, repeat_interval, is_active, priority, created_by) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            title, content, category, type, file_path, 
            schedule_type, schedule_time || '00:00',
            days_of_week, repeat_interval,
            is_active, priority, req.user.username
        ],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ 
                success: true, 
                id: this.lastID,
                message: 'تم إضافة الذكر بنجاح'
            });
        });
});

app.put('/api/adkar/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    const fields = [];
    const values = [];
    
    Object.keys(updates).forEach(key => {
        if (key !== 'id') {
            fields.push(`${key} = ?`);
            values.push(updates[key]);
        }
    });
    
    values.push(id);
    
    db.run(`UPDATE adkar SET ${fields.join(', ')} WHERE id = ?`, values, (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, message: 'تم تحديث الذكر بنجاح' });
    });
});

app.delete('/api/adkar/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    
    db.run(`DELETE FROM adkar WHERE id = ?`, [id], (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, message: 'تم حذف الذكر بنجاح' });
    });
});

// إدارة المجموعات
app.get('/api/groups', verifyToken, (req, res) => {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    const params = [];
    
    if (status === 'active') {
        whereClause = 'WHERE is_active = 1 AND bot_enabled = 1';
    } else if (status === 'inactive') {
        whereClause = 'WHERE is_active = 0 OR bot_enabled = 0';
    }
    
    db.all(`SELECT * FROM groups ${whereClause} ORDER BY join_date DESC LIMIT ? OFFSET ?`, 
        [...params, limit, offset], (err, groups) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            db.get(`SELECT COUNT(*) as total FROM groups ${whereClause}`, params, (err, count) => {
                res.json({
                    groups,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: count.total,
                        pages: Math.ceil(count.total / limit)
                    }
                });
            });
        });
});

// البث الفوري
app.post('/api/broadcast', verifyToken, upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'pdf', maxCount: 1 }
]), async (req, res) => {
    const { message, type = 'text' } = req.body;
    
    let file_path = null;
    if (req.files?.audio) {
        file_path = req.files.audio[0].path;
    } else if (req.files?.pdf) {
        file_path = req.files.pdf[0].path;
    }
    
    // جلب جميع المجموعات النشطة
    db.all(`SELECT chat_id FROM groups WHERE bot_enabled = 1 AND is_active = 1`, 
        async (err, groups) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // حفظ في جدول البث
            db.run(`INSERT INTO broadcasts (message, type, file_path, total_count) VALUES (?, ?, ?, ?)`,
                [message, type, file_path, groups.length], 
                async function(err) {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    
                    const broadcastId = this.lastID;
                    
                    // إرسال البث لكل مجموعة
                    let sentCount = 0;
                    for (const group of groups) {
                        try {
                            if (type === 'audio' && file_path) {
                                await bot.sendAudio(group.chat_id, file_path, {
                                    caption: message,
                                    parse_mode: 'HTML'
                                });
                            } else if (type === 'pdf' && file_path) {
                                await bot.sendDocument(group.chat_id, file_path, {
                                    caption: message,
                                    parse_mode: 'HTML'
                                });
                            } else {
                                await bot.sendMessage(group.chat_id, message, {
                                    parse_mode: 'HTML'
                                });
                            }
                            sentCount++;
                            
                            // تحديث العدد المرسل
                            db.run(`UPDATE broadcasts SET sent_count = ? WHERE id = ?`,
                                [sentCount, broadcastId]);
                            
                            // تأخير لتجنب الحظر
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            
                        } catch (error) {
                            console.error(`❌ خطأ في البث لـ ${group.chat_id}:`, error.message);
                        }
                    }
                    
                    // تحديث حالة البث
                    db.run(`UPDATE broadcasts SET status = 'completed' WHERE id = ?`,
                        [broadcastId]);
                    
                    res.json({ 
                        success: true, 
                        message: `تم إرسال البث إلى ${sentCount} من ${groups.length} مجموعة`,
                        sent: sentCount,
                        total: groups.length
                    });
                });
        });
});

// الحصول على سجلات النشر
app.get('/api/logs', verifyToken, (req, res) => {
    const { days = 7 } = req.query;
    
    const query = `
        SELECT 
            date(sent_at) as date,
            COUNT(*) as total,
            SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM broadcast_logs 
        WHERE sent_at >= date('now', ? || ' days')
        GROUP BY date(sent_at)
        ORDER BY date(sent_at) DESC
    `;
    
    db.all(query, [`-${days}`], (err, logs) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(logs);
    });
});

// واجهة لوحة التحكم
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// صفحة رئيسية بسيطة
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>بوت الأذكار التلقائي</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
                .container { max-width: 800px; margin: auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                h1 { color: #2c3e50; }
                .btn { display: inline-block; padding: 10px 20px; margin: 10px; background: #3498db; color: white; text-decoration: none; border-radius: 5px; }
                .stats { display: flex; justify-content: space-around; margin: 30px 0; }
                .stat-box { background: #ecf0f1; padding: 20px; border-radius: 5px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🕌 بوت نشر الأذكار التلقائي</h1>
                <p>بوت تلقائي لنشر الأذكار في مجموعات التلجرام حسب إعدادات المطور المركزية</p>
                
                <div class="stats">
                    <div class="stat-box">
                        <h3>المجموعات</h3>
                        <p id="groupsCount">0</p>
                    </div>
                    <div class="stat-box">
                        <h3>الأذكار</h3>
                        <p id="adkarCount">0</p>
                    </div>
                    <div class="stat-box">
                        <h3>النشر اليومي</h3>
                        <p id="todayCount">0</p>
                    </div>
                </div>
                
                <div>
                    <a href="/admin" class="btn">👑 لوحة تحكم المطور</a>
                    <a href="https://t.me/your_bot_username" class="btn" target="_blank">🤖 إضافة البوت لمجموعتك</a>
                </div>
                
                <div style="margin-top: 30px; text-align: right;">
                    <h3>كيفية الاستخدام:</h3>
                    <ol style="text-align: right;">
                        <li>أضف البوت لمجموعتك على تلجرام</li>
                        <li>البوت سيرسل رسالة ترحيب تلقائياً</li>
                        <li>استخدم /enable_bot لتفعيل البوت</li>
                        <li>استخدم /disable_bot لإيقاف البوت مؤقتاً</li>
                        <li>إعدادات النشر تتم من لوحة تحكم المطور</li>
                    </ol>
                </div>
            </div>
            
            <script>
                async function loadStats() {
                    try {
                        const response = await fetch('/api/stats');
                        const stats = await response.json();
                        
                        document.getElementById('groupsCount').textContent = stats.activeGroups;
                        document.getElementById('adkarCount').textContent = stats.activeAdkar;
                        document.getElementById('todayCount').textContent = stats.todaySent;
                    } catch (error) {
                        console.error('خطأ في تحميل الإحصائيات:', error);
                    }
                }
                
                loadStats();
            </script>
        </body>
        </html>
    `);
});

// صفحة الصحة للتحقق
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        bot: bot ? 'connected' : 'disconnected',
        database: 'connected'
    });
});

// بدء الخادم
app.listen(PORT, () => {
    console.log(`🚀 الخادم يعمل على http://localhost:${PORT}`);
    console.log(`👑 لوحة تحكم المطور: http://localhost:${PORT}/admin`);
    console.log(`📊 إحصائيات مباشرة: http://localhost:${PORT}`);
    console.log(`✅ البوت جاهز للاستخدام!`);
});