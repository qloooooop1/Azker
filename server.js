require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cors = require('cors');

// ========== إعدادات التطبيق ==========
const app = express();
const PORT = process.env.PORT || 3000;

// إعدادات الوسائط
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// التحقق من التوكن
if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('❌ خطأ: TELEGRAM_BOT_TOKEN غير محدد في ملف .env');
    process.exit(1);
}

// تهيئة البوت
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
    polling: true,
    request: {
        timeout: 60000,
        agentOptions: {
            keepAlive: true,
            family: 4
        }
    }
});

console.log('🤖 بوت التلجرام جاهز...');

// ========== إعداد رفع الملفات ==========
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    ['audio', 'images', 'pdfs'].forEach(dir => {
        fs.mkdirSync(path.join(uploadsDir, dir), { recursive: true });
    });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let folder = 'general';
        if (file.fieldname === 'audio_file') folder = 'audio';
        else if (file.fieldname === 'image_file') folder = 'images';
        else if (file.fieldname === 'pdf_file') folder = 'pdfs';
        
        const dir = path.join(uploadsDir, folder);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        const allowedTypes = {
            'audio_file': ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a'],
            'image_file': ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            'pdf_file': ['application/pdf']
        };
        
        if (allowedTypes[file.fieldname] && allowedTypes[file.fieldname].includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`نوع الملف غير مسموح`), false);
        }
    }
});

// ========== قاعدة البيانات ==========
const db = new sqlite3.Database('./adkar.db', (err) => {
    if (err) {
        console.error('❌ خطأ في فتح قاعدة البيانات:', err);
    } else {
        console.log('✅ قاعدة البيانات متصلة');
    }
});

// إنشاء الجداول
db.serialize(() => {
    // جدول الأقسام
    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        color TEXT DEFAULT '#667eea',
        icon TEXT DEFAULT '📖',
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // جدول الأذكار
    db.run(`CREATE TABLE IF NOT EXISTS adkar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        content_type TEXT DEFAULT 'text',
        file_path TEXT,
        schedule_type TEXT DEFAULT 'daily',
        schedule_days TEXT DEFAULT '[0,1,2,3,4,5,6]',
        schedule_time TEXT NOT NULL,
        is_repeating INTEGER DEFAULT 0,
        repeat_interval INTEGER DEFAULT 60,
        is_active INTEGER DEFAULT 1,
        priority INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // جدول المجموعات
    db.run(`CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT UNIQUE NOT NULL,
        title TEXT,
        admin_id TEXT,
        bot_enabled INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // جدول السجلات
    db.run(`CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT,
        adkar_id INTEGER,
        status TEXT,
        error TEXT,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // إضافة أقسام افتراضية
    const defaultCategories = [
        ['أذكار الصباح', 'أذكار الصباح المأثورة', '#FF6B6B', '☀️', 1],
        ['أذكار المساء', 'أذكار المساء المأثورة', '#4ECDC4', '🌙', 2],
        ['أذكار عامة', 'أذكار متنوعة للوقت العام', '#45B7D1', '📿', 3],
        ['آيات قرآنية', 'آيات مختارة من القرآن الكريم', '#96CEB4', '📖', 4],
        ['أحاديث نبوية', 'أحاديث شريفة', '#FFEAA7', '💬', 5]
    ];

    defaultCategories.forEach((category) => {
        db.run(`INSERT OR IGNORE INTO categories (name, description, color, icon, sort_order) VALUES (?, ?, ?, ?, ?)`,
            category);
    });

    // إضافة أذكار افتراضية
    db.get("SELECT COUNT(*) as count FROM adkar", (err, row) => {
        if (row.count === 0) {
            const defaultAdkar = [
                [1, 'أذكار الصباح', 'أصبحنا وأصبح الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير.', '06:00'],
                [2, 'أذكار المساء', 'أمسينا وأمسى الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير.', '18:00'],
                [3, 'سبحان الله وبحمده', 'سبحان الله وبحمده، سبحان الله العظيم. من قالها في يوم مائة مرة حطت خطاياه وإن كانت مثل زبد البحر.', '12:00']
            ];
            
            const stmt = db.prepare("INSERT INTO adkar (category_id, title, content, schedule_time) VALUES (?, ?, ?, ?)");
            defaultAdkar.forEach(adkar => {
                stmt.run(adkar);
            });
            stmt.finalize();
            console.log('✅ تم إضافة الأذكار الافتراضية');
        }
    });
});

// ========== معالجة أوامر البوت ==========
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    
    try {
        if (chatType === 'group' || chatType === 'supergroup') {
            const title = msg.chat.title;
            const adminId = msg.from.id;
            
            db.run(`INSERT OR REPLACE INTO groups (chat_id, title, admin_id) VALUES (?, ?, ?)`, 
                [chatId, title, adminId], async (err) => {
                    if (err) {
                        console.error('❌ خطأ في حفظ المجموعة:', err);
                        return;
                    }
                    
                    const welcomeMsg = `🕌 *مرحباً بكم في ${title}* 🕌\n\n` +
                        `تم تفعيل بوت الأذكار بنجاح!\n\n` +
                        `*الأوامر المتاحة:*\n` +
                        `/enable - تفعيل البوت\n` +
                        `/disable - إيقاف البوت\n` +
                        `/status - حالة البوت\n` +
                        `/help - المساعدة\n\n` +
                        `📊 *الأقسام المتاحة:*\n`;
                    
                    db.all("SELECT name, icon FROM categories WHERE is_active = 1 ORDER BY sort_order", async (err, categories) => {
                        let categoriesMsg = welcomeMsg;
                        categories.forEach(cat => {
                            categoriesMsg += `${cat.icon} ${cat.name}\n`;
                        });
                        
                        await bot.sendMessage(chatId, categoriesMsg, { parse_mode: 'Markdown' });
                        
                        // إرسال أول ذكر
                        setTimeout(async () => {
                            db.get(`SELECT a.*, c.name as category_name FROM adkar a 
                                   LEFT JOIN categories c ON a.category_id = c.id 
                                   WHERE a.is_active = 1 ORDER BY a.priority LIMIT 1`, 
                                async (err, adkar) => {
                                    if (adkar) {
                                        await sendAdkarToGroup(chatId, adkar);
                                    }
                                });
                        }, 1000);
                    });
                });
        } else {
            const helpMsg = `مرحباً بك! 👋\n\n` +
                `أنا بوت نشر الأذكار التلقائي المتقدم.\n\n` +
                `*المميزات:*\n` +
                `• أقسام متعددة (صباح، مساء، قرآن، أحاديث)\n` +
                `• جدولة متقدمة (أيام محددة، أوقات متعددة)\n` +
                `• دعم الملفات (صور، صوتيات، PDF)\n` +
                `• تحكم كامل من لوحة التحكم`;
            
            await bot.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown' });
        }
    } catch (error) {
        console.error('❌ خطأ في /start:', error);
    }
});

// معالجة أمر /enable
bot.onText(/\/enable/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
        const chatMember = await bot.getChatMember(chatId, userId);
        if (!['creator', 'administrator'].includes(chatMember.status)) {
            await bot.sendMessage(chatId, '⚠️ هذا الأمر متاح للمشرفين فقط.');
            return;
        }

        db.run(`UPDATE groups SET bot_enabled = 1 WHERE chat_id = ?`, [chatId], async (err) => {
            if (err) {
                await bot.sendMessage(chatId, '❌ حدث خطأ في تفعيل البوت.');
                return;
            }

            await bot.sendMessage(chatId, 
                '✅ *تم تفعيل البوت بنجاح*\nسأبدأ بنشر الأذكار حسب الجدولة المحددة.', 
                { parse_mode: 'Markdown' }
            );
        });

    } catch (error) {
        console.error('❌ خطأ في /enable:', error);
        await bot.sendMessage(chatId, '❌ حدث خطأ، حاول مرة أخرى.');
    }
});

// معالجة أمر /disable
bot.onText(/\/disable/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
        const chatMember = await bot.getChatMember(chatId, userId);
        if (!['creator', 'administrator'].includes(chatMember.status)) {
            await bot.sendMessage(chatId, '⚠️ هذا الأمر متاح للمشرفين فقط.');
            return;
        }

        db.run(`UPDATE groups SET bot_enabled = 0 WHERE chat_id = ?`, [chatId], async (err) => {
            if (err) {
                await bot.sendMessage(chatId, '❌ حدث خطأ في إيقاف البوت.');
                return;
            }

            await bot.sendMessage(chatId, 
                '⏸️ *تم إيقاف البوت مؤقتاً*\nلن يتم نشر أي أذكار حتى إعادة التفعيل.', 
                { parse_mode: 'Markdown' }
            );
        });

    } catch (error) {
        console.error('❌ خطأ في /disable:', error);
        await bot.sendMessage(chatId, '❌ حدث خطأ، حاول مرة أخرى.');
    }
});

// معالجة أمر /status
bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    
    db.get(`SELECT bot_enabled, title, created_at FROM groups WHERE chat_id = ?`, 
        [chatId], async (err, group) => {
            if (err || !group) {
                await bot.sendMessage(chatId, '❌ هذه المجموعة غير مسجلة.');
                return;
            }

            const status = group.bot_enabled === 1 ? '🟢 نشط' : '🔴 متوقف';
            const statusMsg = `*حالة البوت في ${group.title || 'المجموعة'}*\n\n` +
                `📊 الحالة: ${status}\n` +
                `📅 تاريخ الإضافة: ${new Date(group.created_at).toLocaleDateString('ar-SA')}\n` +
                `🕒 الوقت: ${new Date().toLocaleTimeString('ar-SA')}\n\n` +
                `*الأوامر:*\n` +
                `${group.bot_enabled === 1 ? '❌ /disable - إيقاف البوت' : '✅ /enable - تفعيل البوت'}`;

            await bot.sendMessage(chatId, statusMsg, { parse_mode: 'Markdown' });
        });
});

// معالجة أمر /help
bot.onText(/\/help/, (msg) => {
    const helpMsg = `*مركز المساعدة*\n\n` +
        `*أوامر المشرفين:*\n` +
        `/enable - تفعيل البوت في المجموعة\n` +
        `/disable - إيقاف البوت مؤقتاً\n` +
        `/status - عرض حالة البوت\n` +
        `/help - هذه الرسالة\n\n` +
        `*المميزات:*\n` +
        `• نشر أذكار تلقائي\n` +
        `• أقسام متعددة\n` +
        `• جدولة متقدمة\n` +
        `• دعم الملفات\n` +
        `• تحكم سهل للمشرفين`;

    bot.sendMessage(msg.chat.id, helpMsg, { parse_mode: 'Markdown' });
});

// ========== وظيفة إرسال الأذكار ==========
async function sendAdkarToGroup(chatId, adkar) {
    try {
        // التحقق من حالة المجموعة
        db.get("SELECT bot_enabled FROM groups WHERE chat_id = ?", [chatId], async (err, group) => {
            if (!group || group.bot_enabled !== 1) return;

            let message = `📌 *${adkar.category_name || 'ذكر'}*\n`;
            message += `📖 ${adkar.title}\n\n`;
            message += `${adkar.content}\n\n`;
            message += `🕒 ${adkar.schedule_time} | 📅 ${moment().format('YYYY/MM/DD')}`;

            try {
                // إرسال حسب نوع المحتوى
                if (adkar.content_type === 'audio' && adkar.file_path) {
                    const filePath = path.join(__dirname, adkar.file_path);
                    if (fs.existsSync(filePath)) {
                        await bot.sendAudio(chatId, filePath, {
                            caption: message,
                            parse_mode: 'Markdown'
                        });
                    } else {
                        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
                    }
                } else if (adkar.content_type === 'image' && adkar.file_path) {
                    const filePath = path.join(__dirname, adkar.file_path);
                    if (fs.existsSync(filePath)) {
                        await bot.sendPhoto(chatId, filePath, {
                            caption: message,
                            parse_mode: 'Markdown'
                        });
                    } else {
                        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
                    }
                } else if (adkar.content_type === 'pdf' && adkar.file_path) {
                    const filePath = path.join(__dirname, adkar.file_path);
                    if (fs.existsSync(filePath)) {
                        await bot.sendDocument(chatId, filePath, {
                            caption: message,
                            parse_mode: 'Markdown'
                        });
                    } else {
                        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
                    }
                } else {
                    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
                }

                // تسجيل النجاح
                db.run("INSERT INTO logs (chat_id, adkar_id, status) VALUES (?, ?, ?)", 
                    [chatId, adkar.id, 'success']);

                console.log(`✅ تم نشر "${adkar.title}" في ${chatId}`);

            } catch (error) {
                console.error(`❌ خطأ في الإرسال لـ ${chatId}:`, error.message);
                db.run("INSERT INTO logs (chat_id, adkar_id, status, error) VALUES (?, ?, ?, ?)", 
                    [chatId, adkar.id, 'failed', error.message]);
            }
        });
    } catch (error) {
        console.error('❌ خطأ في إرسال الأذكار:', error);
    }
}

// ========== جدولة النشر ==========
setInterval(() => {
    const now = moment();
    const currentTime = now.format('HH:mm');
    const currentDay = now.day(); // 0=الأحد, 6=السبت

    // جلب الأذكار المجدولة لهذا الوقت
    db.all(`SELECT a.*, c.name as category_name FROM adkar a 
           LEFT JOIN categories c ON a.category_id = c.id 
           WHERE a.is_active = 1 AND a.schedule_time = ?`, 
        [currentTime], (err, adkarList) => {
            if (err || !adkarList.length) return;

            // جلب المجموعات النشطة
            db.all("SELECT chat_id FROM groups WHERE bot_enabled = 1", async (err, groups) => {
                if (err || !groups.length) return;

                console.log(`🕒 نشر ${adkarList.length} ذكر في ${groups.length} مجموعة`);

                for (const adkar of adkarList) {
                    // التحقق من أيام الأسبوع
                    if (adkar.schedule_type === 'weekly') {
                        try {
                            const days = JSON.parse(adkar.schedule_days || '[]');
                            if (!days.includes(currentDay)) {
                                continue;
                            }
                        } catch {
                            // استمرار إذا كان هناك خطأ في الـ JSON
                        }
                    }

                    for (const group of groups) {
                        await sendAdkarToGroup(group.chat_id, adkar);
                        // تأخير بسيط بين الإرساليات
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            });
        });
}, 60000); // كل دقيقة

// ========== واجهات API ==========
app.get('/api/stats', (req, res) => {
    const stats = {};
    
    const queries = [
        { key: 'categories', query: "SELECT COUNT(*) as count FROM categories WHERE is_active = 1" },
        { key: 'adkar', query: "SELECT COUNT(*) as count FROM adkar WHERE is_active = 1" },
        { key: 'groups', query: "SELECT COUNT(*) as count FROM groups WHERE bot_enabled = 1" },
        { key: 'today', query: "SELECT COUNT(*) as count FROM logs WHERE date(sent_at) = date('now') AND status = 'success'" }
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

// إدارة الأقسام
app.get('/api/categories', (req, res) => {
    db.all("SELECT * FROM categories ORDER BY sort_order, name", (err, categories) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(categories);
        }
    });
});

app.post('/api/categories', (req, res) => {
    const { name, description, color, icon, sort_order } = req.body;
    
    db.run(`INSERT INTO categories (name, description, color, icon, sort_order) VALUES (?, ?, ?, ?, ?)`,
        [name, description || '', color || '#667eea', icon || '📖', sort_order || 0],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json({ success: true, id: this.lastID });
            }
        });
});

app.put('/api/categories/:id', (req, res) => {
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
    
    db.run(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, values, (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ success: true });
        }
    });
});

app.delete('/api/categories/:id', (req, res) => {
    const { id } = req.params;
    
    db.run("DELETE FROM categories WHERE id = ?", [id], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ success: true });
        }
    });
});

// إدارة الأذكار
app.get('/api/adkar', (req, res) => {
    const { category_id } = req.query;
    
    let query = `SELECT a.*, c.name as category_name, c.icon as category_icon 
                 FROM adkar a 
                 LEFT JOIN categories c ON a.category_id = c.id`;
    
    const params = [];
    
    if (category_id) {
        query += " WHERE a.category_id = ?";
        params.push(category_id);
    }
    
    query += " ORDER BY a.priority, a.schedule_time";
    
    db.all(query, params, (err, adkar) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(adkar);
        }
    });
});

app.post('/api/adkar', upload.fields([
    { name: 'audio_file', maxCount: 1 },
    { name: 'image_file', maxCount: 1 },
    { name: 'pdf_file', maxCount: 1 }
]), (req, res) => {
    const {
        category_id,
        title,
        content,
        content_type = 'text',
        schedule_type = 'daily',
        schedule_days = '[0,1,2,3,4,5,6]',
        schedule_time,
        is_active = 1,
        priority = 1
    } = req.body;
    
    let file_path = null;
    let final_content_type = content_type;
    
    // تحديد نوع الملف ومساره
    if (req.files?.audio_file) {
        file_path = `/uploads/audio/${req.files.audio_file[0].filename}`;
        final_content_type = 'audio';
    } else if (req.files?.image_file) {
        file_path = `/uploads/images/${req.files.image_file[0].filename}`;
        final_content_type = 'image';
    } else if (req.files?.pdf_file) {
        file_path = `/uploads/pdfs/${req.files.pdf_file[0].filename}`;
        final_content_type = 'pdf';
    }
    
    db.run(`INSERT INTO adkar (
        category_id, title, content, content_type, file_path, 
        schedule_type, schedule_days, schedule_time, 
        is_active, priority
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            category_id || null, title, content, final_content_type, file_path,
            schedule_type, schedule_days, schedule_time,
            is_active, priority
        ],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json({ success: true, id: this.lastID });
            }
        });
});

app.put('/api/adkar/:id', upload.fields([
    { name: 'audio_file', maxCount: 1 },
    { name: 'image_file', maxCount: 1 },
    { name: 'pdf_file', maxCount: 1 }
]), (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    // معالجة الملفات المرفوعة
    let file_path = null;
    let content_type = updates.content_type;
    
    if (req.files?.audio_file) {
        file_path = `/uploads/audio/${req.files.audio_file[0].filename}`;
        content_type = 'audio';
    } else if (req.files?.image_file) {
        file_path = `/uploads/images/${req.files.image_file[0].filename}`;
        content_type = 'image';
    } else if (req.files?.pdf_file) {
        file_path = `/uploads/pdfs/${req.files.pdf_file[0].filename}`;
        content_type = 'pdf';
    }
    
    if (file_path) {
        updates.file_path = file_path;
        updates.content_type = content_type;
    }
    
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
            res.status(500).json({ error: err.message });
        } else {
            res.json({ success: true });
        }
    });
});

app.delete('/api/adkar/:id', (req, res) => {
    const { id } = req.params;
    
    db.run("DELETE FROM adkar WHERE id = ?", [id], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ success: true });
        }
    });
});

// المجموعات
app.get('/api/groups', (req, res) => {
    db.all("SELECT * FROM groups ORDER BY created_at DESC", (err, groups) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(groups);
        }
    });
});

// الصفحة الرئيسية
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>بوت الأذكار المتقدم</title>
            <style>
                body { font-family: Arial; text-align: center; padding: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
                .container { max-width: 800px; margin: auto; background: rgba(255,255,255,0.1); padding: 30px; border-radius: 20px; backdrop-filter: blur(10px); }
                h1 { margin-bottom: 30px; }
                .btn { display: inline-block; padding: 12px 30px; margin: 10px; background: white; color: #764ba2; text-decoration: none; border-radius: 50px; font-weight: bold; }
                .stats { display: flex; justify-content: center; gap: 20px; margin: 30px 0; }
                .stat-box { background: rgba(255,255,255,0.2); padding: 20px; border-radius: 10px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🕌 بوت الأذكار المتقدم</h1>
                <p>نظام متكامل لإدارة ونشر الأذكار تلقائياً</p>
                
                <div class="stats">
                    <div class="stat-box">
                        <h3 id="statsCategories">0</h3>
                        <p>أقسام</p>
                    </div>
                    <div class="stat-box">
                        <h3 id="statsAdkar">0</h3>
                        <p>أذكار</p>
                    </div>
                    <div class="stat-box">
                        <h3 id="statsGroups">0</h3>
                        <p>مجموعات</p>
                    </div>
                </div>
                
                <div>
                    <a href="/admin" class="btn">👑 لوحة التحكم</a>
                </div>
            </div>
            
            <script>
                async function loadStats() {
                    try {
                        const response = await fetch('/api/stats');
                        const stats = await response.json();
                        
                        document.getElementById('statsCategories').textContent = stats.categories;
                        document.getElementById('statsAdkar').textContent = stats.adkar;
                        document.getElementById('statsGroups').textContent = stats.groups;
                    } catch (error) {
                        console.error('خطأ:', error);
                    }
                }
                
                loadStats();
                setInterval(loadStats, 10000);
            </script>
        </body>
        </html>
    `);
});

// لوحة التحكم
app.get('/admin', (req, res) => {
    const adminHTML = `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>👑 لوحة تحكم بوت الأذكار</title>
        <style>
            body { font-family: Arial; background: #f5f5f5; margin: 0; }
            .sidebar { 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                height: 100vh;
                width: 250px;
                position: fixed;
                padding: 20px;
            }
            .main-content { margin-right: 250px; padding: 20px; }
            .nav-link { color: white; display: block; padding: 10px; text-decoration: none; margin: 5px 0; border-radius: 5px; }
            .nav-link:hover { background: rgba(255,255,255,0.1); }
            .card { background: white; padding: 20px; margin: 20px 0; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 10px; border: 1px solid #ddd; text-align: right; }
            th { background: #f0f0f0; }
            .btn { padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; }
        </style>
    </head>
    <body>
        <div class="sidebar">
            <h2>👑 لوحة التحكم</h2>
            <a href="#" class="nav-link" onclick="showSection('dashboard')">📊 لوحة القيادة</a>
            <a href="#" class="nav-link" onclick="showSection('categories')">📚 الأقسام</a>
            <a href="#" class="nav-link" onclick="showSection('adkar')">📝 الأذكار</a>
            <a href="#" class="nav-link" onclick="showSection('groups')">👥 المجموعات</a>
        </div>
        
        <div class="main-content">
            <div id="dashboard">
                <h2>📊 لوحة القيادة</h2>
                <div class="card">
                    <h3>الإحصائيات</h3>
                    <div id="stats"></div>
                </div>
            </div>
            
            <div id="categories" style="display: none;">
                <h2>📚 إدارة الأقسام</h2>
                <button class="btn" onclick="showCategoryForm()">➕ إضافة قسم</button>
                <div class="card">
                    <h3>الأقسام</h3>
                    <div id="categoriesList"></div>
                </div>
            </div>
            
            <div id="adkar" style="display: none;">
                <h2>📝 إدارة الأذكار</h2>
                <button class="btn" onclick="showAdkarForm()">➕ إضافة ذكر</button>
                <div class="card">
                    <h3>الأذكار</h3>
                    <div id="adkarList"></div>
                </div>
            </div>
            
            <div id="groups" style="display: none;">
                <h2>👥 المجموعات</h2>
                <div class="card">
                    <h3>المجموعات النشطة</h3>
                    <div id="groupsList"></div>
                </div>
            </div>
        </div>
        
        <script>
            async function loadStats() {
                const res = await fetch('/api/stats');
                const stats = await res.json();
                
                document.getElementById('stats').innerHTML = \`
                    <p>الأقسام النشطة: \${stats.categories}</p>
                    <p>الأذكار النشطة: \${stats.adkar}</p>
                    <p>المجموعات النشطة: \${stats.groups}</p>
                    <p>النشر اليومي: \${stats.today}</p>
                \`;
            }
            
            async function loadCategories() {
                const res = await fetch('/api/categories');
                const categories = await res.json();
                
                let html = '<table><tr><th>الاسم</th><th>الوصف</th><th>الحالة</th><th>الإجراءات</th></tr>';
                categories.forEach(cat => {
                    html += \`<tr>
                        <td>\${cat.icon} \${cat.name}</td>
                        <td>\${cat.description || '-'}</td>
                        <td>\${cat.is_active ? '✅' : '❌'}</td>
                        <td>
                            <button onclick="editCategory(\${cat.id})">تعديل</button>
                            <button onclick="deleteCategory(\${cat.id})">حذف</button>
                        </td>
                    </tr>\`;
                });
                html += '</table>';
                document.getElementById('categoriesList').innerHTML = html;
            }
            
            async function loadAdkar() {
                const res = await fetch('/api/adkar');
                const adkar = await res.json();
                
                let html = '<table><tr><th>العنوان</th><th>القسم</th><th>الوقت</th><th>الحالة</th><th>الإجراءات</th></tr>';
                adkar.forEach(item => {
                    html += \`<tr>
                        <td>\${item.title}</td>
                        <td>\${item.category_name || 'عام'}</td>
                        <td>\${item.schedule_time}</td>
                        <td>\${item.is_active ? '✅' : '❌'}</td>
                        <td>
                            <button onclick="editAdkar(\${item.id})">تعديل</button>
                            <button onclick="deleteAdkar(\${item.id})">حذف</button>
                        </td>
                    </tr>\`;
                });
                html += '</table>';
                document.getElementById('adkarList').innerHTML = html;
            }
            
            async function loadGroups() {
                const res = await fetch('/api/groups');
                const groups = await res.json();
                
                let html = '<table><tr><th>المجموعة</th><th>الحالة</th><th>التاريخ</th></tr>';
                groups.forEach(group => {
                    html += \`<tr>
                        <td>\${group.title || group.chat_id}</td>
                        <td>\${group.bot_enabled ? '✅' : '❌'}</td>
                        <td>\${new Date(group.created_at).toLocaleDateString('ar-SA')}</td>
                    </tr>\`;
                });
                html += '</table>';
                document.getElementById('groupsList').innerHTML = html;
            }
            
            function showSection(section) {
                ['dashboard', 'categories', 'adkar', 'groups'].forEach(s => {
                    document.getElementById(s).style.display = s === section ? 'block' : 'none';
                });
                
                if (section === 'dashboard') loadStats();
                else if (section === 'categories') loadCategories();
                else if (section === 'adkar') loadAdkar();
                else if (section === 'groups') loadGroups();
            }
            
            function showCategoryForm() {
                const name = prompt('اسم القسم:');
                if (name) {
                    fetch('/api/categories', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: name })
                    }).then(() => loadCategories());
                }
            }
            
            function showAdkarForm() {
                const title = prompt('عنوان الذكر:');
                const content = prompt('نص الذكر:');
                const time = prompt('وقت النشر (مثال: 06:00):');
                
                if (title && content && time) {
                    fetch('/api/adkar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: title,
                            content: content,
                            schedule_time: time
                        })
                    }).then(() => loadAdkar());
                }
            }
            
            // التحميل الأولي
            loadStats();
            setInterval(loadStats, 30000);
        </script>
    </body>
    </html>
    `;
    
    res.send(adminHTML);
});

// ========== بدء الخادم ==========
app.listen(PORT, async () => {
    console.log(`🚀 الخادم يعمل على http://localhost:${PORT}`);
    console.log(`👑 لوحة التحكم: http://localhost:${PORT}/admin`);
    
    try {
        const me = await bot.getMe();
        console.log(`🤖 البوت: @${me.username}`);
        console.log(`✅ النظام جاهز للاستخدام!`);
        
        // عرض الإحصائيات الأولية
        db.get("SELECT COUNT(*) as categories FROM categories", (err, cats) => {
            db.get("SELECT COUNT(*) as adkar FROM adkar", (err, adkar) => {
                db.get("SELECT COUNT(*) as groups FROM groups", (err, groups) => {
                    console.log(`📊 ${cats.categories} قسم، ${adkar.adkar} ذكر، ${groups.groups} مجموعة`);
                });
            });
        });
    } catch (error) {
        console.error('❌ خطأ في الاتصال بتلجرام:', error.message);
    }
});