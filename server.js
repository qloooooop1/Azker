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
        is_active INTEGER DEFAULT 1,
        priority INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
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

    // إضافة أقسام افتراضية
    const defaultCategories = [
        ['أذكار الصباح', 'أذكار الصباح المأثورة', '#FF6B6B', '☀️', 1],
        ['أذكار المساء', 'أذكار المساء المأثورة', '#4ECDC4', '🌙', 2],
        ['أذكار عامة', 'أذكار متنوعة للوقت العام', '#45B7D1', '📿', 3],
        ['آيات قرآنية', 'آيات مختارة من القرآن الكريم', '#96CEB4', '📖', 4]
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
                    });
                });
        } else {
            const helpMsg = `مرحباً بك! 👋\n\n` +
                `أنا بوت نشر الأذكار التلقائي المتقدم.\n\n` +
                `*المميزات:*\n` +
                `• أقسام متعددة (صباح، مساء، قرآن، أحاديث)\n` +
                `• جدولة متقدمة\n` +
                `• دعم الملفات المتعددة\n` +
                `• تحكم كامل من لوحة التحكم`;
            
            await bot.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown' });
        }
    } catch (error) {
        console.error('❌ خطأ في /start:', error);
    }
});

// باقي الأوامر
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

// ========== جدولة النشر ==========
setInterval(() => {
    const now = moment();
    const currentTime = now.format('HH:mm');
    const currentDay = now.day();

    // جلب الأذكار المجدولة لهذا الوقت
    db.all(`SELECT a.*, c.name as category_name FROM adkar a 
           LEFT JOIN categories c ON a.category_id = c.id 
           WHERE a.is_active = 1 AND a.schedule_time = ?`, 
        [currentTime], (err, adkarList) => {
            if (err || !adkarList.length) return;

            // جلب المجموعات النشطة
            db.all("SELECT chat_id FROM groups WHERE bot_enabled = 1", async (err, groups) => {
                if (err || !groups.length) return;

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
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            });
        });
}, 60000);

async function sendAdkarToGroup(chatId, adkar) {
    try {
        db.get("SELECT bot_enabled FROM groups WHERE chat_id = ?", [chatId], async (err, group) => {
            if (!group || group.bot_enabled !== 1) return;

            let message = `📌 *${adkar.category_name || 'ذكر'}*\n`;
            message += `📖 ${adkar.title}\n\n`;
            message += `${adkar.content}\n\n`;
            message += `🕒 ${adkar.schedule_time} | 📅 ${moment().format('YYYY/MM/DD')}`;

            try {
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
            } catch (error) {
                console.error(`❌ خطأ في الإرسال لـ ${chatId}:`, error.message);
            }
        });
    } catch (error) {
        console.error('❌ خطأ في إرسال الأذكار:', error);
    }
}

// ========== واجهات API ==========
app.get('/api/stats', (req, res) => {
    const stats = {};
    
    const queries = [
        { key: 'categories', query: "SELECT COUNT(*) as count FROM categories WHERE is_active = 1" },
        { key: 'adkar', query: "SELECT COUNT(*) as count FROM adkar WHERE is_active = 1" },
        { key: 'groups', query: "SELECT COUNT(*) as count FROM groups WHERE bot_enabled = 1" }
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

app.get('/api/categories/:id', (req, res) => {
    const { id } = req.params;
    db.get("SELECT * FROM categories WHERE id = ?", [id], (err, category) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (!category) {
            res.status(404).json({ error: 'القسم غير موجود' });
        } else {
            res.json(category);
        }
    });
});

app.post('/api/categories', (req, res) => {
    const { name, description, color, icon, sort_order, is_active } = req.body;
    
    db.run(`INSERT INTO categories (name, description, color, icon, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
        [name, description || '', color || '#667eea', icon || '📖', sort_order || 0, is_active || 1],
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
    const { name, description, color, icon, sort_order, is_active } = req.body;
    
    db.run(`UPDATE categories SET 
            name = ?, description = ?, color = ?, icon = ?, sort_order = ?, is_active = ? 
            WHERE id = ?`,
        [name, description, color, icon, sort_order, is_active, id],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json({ success: true, changes: this.changes });
            }
        });
});

app.delete('/api/categories/:id', (req, res) => {
    const { id } = req.params;
    
    db.run("DELETE FROM categories WHERE id = ?", [id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ success: true, changes: this.changes });
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

app.get('/api/adkar/:id', (req, res) => {
    const { id } = req.params;
    db.get(`SELECT a.*, c.name as category_name FROM adkar a 
            LEFT JOIN categories c ON a.category_id = c.id 
            WHERE a.id = ?`, [id], (err, adkar) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (!adkar) {
            res.status(404).json({ error: 'الذكر غير موجود' });
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
            schedule_type, schedule_days, schedule_time || '12:00',
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
    
    db.run(`UPDATE adkar SET ${fields.join(', ')} WHERE id = ?`, values, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ success: true, changes: this.changes });
        }
    });
});

app.delete('/api/adkar/:id', (req, res) => {
    const { id } = req.params;
    
    db.run("DELETE FROM adkar WHERE id = ?", [id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ success: true, changes: this.changes });
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

// ========== لوحة التحكم المتكاملة ==========
app.get('/admin', (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>👑 لوحة تحكم بوت الأذكار</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">
        <style>
            :root {
                --primary-color: #667eea;
                --secondary-color: #764ba2;
            }
            
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f8f9fa;
            }
            
            .sidebar {
                background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
                color: white;
                height: 100vh;
                position: fixed;
                width: 250px;
                padding: 20px 0;
            }
            
            .main-content {
                margin-right: 250px;
                padding: 20px;
            }
            
            .nav-link {
                color: rgba(255, 255, 255, 0.9) !important;
                padding: 12px 25px;
                margin: 5px 15px;
                border-radius: 10px;
                transition: all 0.3s;
            }
            
            .nav-link:hover, .nav-link.active {
                background: rgba(255, 255, 255, 0.15);
                transform: translateX(-5px);
            }
            
            .stat-card {
                background: white;
                border-radius: 15px;
                padding: 20px;
                margin-bottom: 20px;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
                border: none;
                transition: transform 0.3s;
            }
            
            .stat-card:hover {
                transform: translateY(-5px);
            }
            
            .stat-icon {
                width: 60px;
                height: 60px;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                margin-bottom: 15px;
            }
            
            .category-badge {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 14px;
                margin: 3px;
            }
            
            .action-btn {
                width: 35px;
                height: 35px;
                border-radius: 50%;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                margin: 2px;
                border: none;
            }
            
            .modal-xl-custom {
                max-width: 800px;
            }
            
            .day-selector {
                display: flex;
                gap: 5px;
                margin: 10px 0;
            }
            
            .day-btn {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                border: 2px solid #dee2e6;
                background: white;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
            }
            
            .day-btn.selected {
                background: var(--primary-color);
                color: white;
                border-color: var(--primary-color);
            }
            
            @media (max-width: 768px) {
                .sidebar {
                    width: 100%;
                    height: auto;
                    position: relative;
                }
                .main-content {
                    margin-right: 0;
                }
            }
        </style>
    </head>
    <body>
        <!-- الشريط الجانبي -->
        <div class="sidebar">
            <div class="text-center mb-4">
                <h4 class="mb-0"><i class="bi bi-cpu"></i> لوحة التحكم</h4>
                <small class="text-white-50">بوت الأذكار المتقدم</small>
            </div>
            
            <ul class="nav flex-column">
                <li class="nav-item">
                    <a class="nav-link active" href="#" onclick="showSection('dashboard')">
                        <i class="bi bi-speedometer2 me-2"></i>لوحة القيادة
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#" onclick="showSection('categories')">
                        <i class="bi bi-bookmarks me-2"></i>إدارة الأقسام
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#" onclick="showSection('adkar')">
                        <i class="bi bi-journal-text me-2"></i>إدارة الأذكار
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#" onclick="showSection('groups')">
                        <i class="bi bi-people me-2"></i>المجموعات
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#" onclick="showSection('settings')">
                        <i class="bi bi-gear me-2"></i>الإعدادات
                    </a>
                </li>
            </ul>
            
            <div class="position-absolute bottom-0 start-0 end-0 p-3 text-center">
                <small class="text-white-50" id="botStatus">🟢 البوت يعمل</small>
                <br>
                <small class="text-white-50" id="currentTime"></small>
            </div>
        </div>

        <!-- المحتوى الرئيسي -->
        <div class="main-content">
            <!-- لوحة القيادة -->
            <div id="dashboardSection">
                <h2 class="mb-4"><i class="bi bi-speedometer2"></i> لوحة القيادة</h2>
                
                <div class="row">
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-icon" style="background: #e3f2fd;">
                                <i class="bi bi-bookmarks text-primary"></i>
                            </div>
                            <h3 id="statsCategories">0</h3>
                            <p class="text-muted mb-0">الأقسام النشطة</p>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-icon" style="background: #e8f5e9;">
                                <i class="bi bi-journal-text text-success"></i>
                            </div>
                            <h3 id="statsAdkar">0</h3>
                            <p class="text-muted mb-0">الأذكار النشطة</p>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-icon" style="background: #fff3e0;">
                                <i class="bi bi-people text-warning"></i>
                            </div>
                            <h3 id="statsGroups">0</h3>
                            <p class="text-muted mb-0">المجموعات النشطة</p>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-icon" style="background: #ffebee;">
                                <i class="bi bi-clock text-danger"></i>
                            </div>
                            <h3 id="currentTime2"></h3>
                            <p class="text-muted mb-0">الوقت الحالي</p>
                        </div>
                    </div>
                </div>
                
                <div class="row mt-4">
                    <div class="col-md-6">
                        <div class="stat-card">
                            <h5><i class="bi bi-lightning-charge"></i> الإجراءات السريعة</h5>
                            <div class="d-flex gap-2 mt-3">
                                <button class="btn btn-primary" onclick="showCategoryModal()">
                                    <i class="bi bi-plus-circle"></i> قسم جديد
                                </button>
                                <button class="btn btn-success" onclick="showAdkarModal()">
                                    <i class="bi bi-plus-circle"></i> ذكر جديد
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="stat-card">
                            <h5><i class="bi bi-info-circle"></i> معلومات النظام</h5>
                            <div class="mt-3">
                                <p><i class="bi bi-check-circle text-success"></i> البوت يعمل بشكل طبيعي</p>
                                <p><i class="bi bi-check-circle text-success"></i> قاعدة البيانات متصلة</p>
                                <p><i class="bi bi-check-circle text-success"></i> النظام جاهز للنشر</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- إدارة الأقسام -->
            <div id="categoriesSection" class="d-none">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h2><i class="bi bi-bookmarks"></i> إدارة الأقسام</h2>
                    <button class="btn btn-primary" onclick="showCategoryModal()">
                        <i class="bi bi-plus-circle"></i> إضافة قسم جديد
                    </button>
                </div>
                
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead class="table-light">
                            <tr>
                                <th width="50">#</th>
                                <th>القسم</th>
                                <th>الوصف</th>
                                <th>الترتيب</th>
                                <th>الحالة</th>
                                <th width="120">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody id="categoriesTable">
                            <!-- سيتم ملؤها بالجافاسكريبت -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- إدارة الأذكار -->
            <div id="adkarSection" class="d-none">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h2><i class="bi bi-journal-text"></i> إدارة الأذكار</h2>
                    <div>
                        <select id="categoryFilter" class="form-select d-inline-block w-auto me-2" onchange="loadAdkar()">
                            <option value="">جميع الأقسام</option>
                        </select>
                        <button class="btn btn-primary" onclick="showAdkarModal()">
                            <i class="bi bi-plus-circle"></i> إضافة ذكر جديد
                        </button>
                    </div>
                </div>
                
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead class="table-light">
                            <tr>
                                <th>العنوان</th>
                                <th>القسم</th>
                                <th>النوع</th>
                                <th>الوقت</th>
                                <th>الحالة</th>
                                <th>الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody id="adkarTable">
                            <!-- سيتم ملؤها -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- المجموعات -->
            <div id="groupsSection" class="d-none">
                <h2 class="mb-4"><i class="bi bi-people"></i> المجموعات النشطة</h2>
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead class="table-light">
                            <tr>
                                <th>المجموعة</th>
                                <th>الحالة</th>
                                <th>تاريخ الإضافة</th>
                            </tr>
                        </thead>
                        <tbody id="groupsTable">
                            <!-- سيتم ملؤها -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- الإعدادات -->
            <div id="settingsSection" class="d-none">
                <h2 class="mb-4"><i class="bi bi-gear"></i> إعدادات النظام</h2>
                <div class="row">
                    <div class="col-md-6">
                        <div class="stat-card">
                            <h5>إعدادات البوت</h5>
                            <div class="mb-3">
                                <label class="form-label">وقت النشر الافتراضي</label>
                                <input type="time" class="form-control" value="12:00">
                            </div>
                            <button class="btn btn-primary">حفظ الإعدادات</button>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="stat-card">
                            <h5>حول النظام</h5>
                            <p>بوت الأذكار المتقدم</p>
                            <p>الإصدار: 2.0.0</p>
                            <p>المطور: فريق التطوير</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- مودال إضافة/تعديل قسم -->
        <div class="modal fade" id="categoryModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="categoryModalTitle">إضافة قسم جديد</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="categoryForm">
                            <input type="hidden" id="categoryId">
                            <div class="mb-3">
                                <label class="form-label">اسم القسم</label>
                                <input type="text" class="form-control" id="categoryName" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">الوصف</label>
                                <textarea class="form-control" id="categoryDescription" rows="2"></textarea>
                            </div>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label class="form-label">اللون</label>
                                        <input type="color" class="form-control form-control-color" id="categoryColor" value="#667eea">
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label class="form-label">الأيقونة</label>
                                        <select class="form-select" id="categoryIcon">
                                            <option value="📖">📖 كتاب</option>
                                            <option value="☀️">☀️ شمس</option>
                                            <option value="🌙">🌙 قمر</option>
                                            <option value="📿">📿 مسبحة</option>
                                            <option value="🕌">🕌 مسجد</option>
                                            <option value="⭐">⭐ نجمة</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label class="form-label">ترتيب العرض</label>
                                        <input type="number" class="form-control" id="categoryOrder" value="0">
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label class="form-label">الحالة</label>
                                        <select class="form-select" id="categoryActive">
                                            <option value="1">نشط</option>
                                            <option value="0">غير نشط</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">إلغاء</button>
                        <button type="button" class="btn btn-primary" onclick="saveCategory()">حفظ</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- مودال إضافة/تعديل ذكر -->
        <div class="modal fade" id="adkarModal" tabindex="-1">
            <div class="modal-dialog modal-xl-custom">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="adkarModalTitle">إضافة ذكر جديد</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="adkarForm">
                            <input type="hidden" id="adkarId">
                            
                            <div class="row">
                                <div class="col-md-8">
                                    <div class="mb-3">
                                        <label class="form-label">العنوان</label>
                                        <input type="text" class="form-control" id="adkarTitle" required>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">النص</label>
                                        <textarea class="form-control" id="adkarContent" rows="4" required></textarea>
                                    </div>
                                    
                                    <div class="row">
                                        <div class="col-md-6">
                                            <div class="mb-3">
                                                <label class="form-label">القسم</label>
                                                <select class="form-select" id="adkarCategory" required>
                                                    <option value="">اختر قسم</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="mb-3">
                                                <label class="form-label">نوع المحتوى</label>
                                                <select class="form-select" id="adkarContentType" onchange="toggleFileInput()">
                                                    <option value="text">نص فقط</option>
                                                    <option value="audio">صوت</option>
                                                    <option value="image">صورة</option>
                                                    <option value="pdf">ملف PDF</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="mb-3 d-none" id="fileInputSection">
                                        <label class="form-label" id="fileInputLabel">رفع ملف</label>
                                        <input type="file" class="form-control" id="adkarFile">
                                    </div>
                                </div>
                                
                                <div class="col-md-4">
                                    <div class="card">
                                        <div class="card-body">
                                            <h6>إعدادات النشر</h6>
                                            
                                            <div class="mb-3">
                                                <label class="form-label">نوع الجدولة</label>
                                                <select class="form-select" id="adkarScheduleType" onchange="toggleDaysSelector()">
                                                    <option value="daily">يومي</option>
                                                    <option value="weekly">أسبوعي</option>
                                                </select>
                                            </div>
                                            
                                            <div class="mb-3 d-none" id="daysSelectorSection">
                                                <label class="form-label">أيام النشر</label>
                                                <div class="day-selector">
                                                    <button type="button" class="day-btn" data-day="0" onclick="toggleDay(this)">أ</button>
                                                    <button type="button" class="day-btn" data-day="1" onclick="toggleDay(this)">إ</button>
                                                    <button type="button" class="day-btn" data-day="2" onclick="toggleDay(this)">ث</button>
                                                    <button type="button" class="day-btn" data-day="3" onclick="toggleDay(this)">أ</button>
                                                    <button type="button" class="day-btn" data-day="4" onclick="toggleDay(this)">خ</button>
                                                    <button type="button" class="day-btn" data-day="5" onclick="toggleDay(this)">ج</button>
                                                    <button type="button" class="day-btn" data-day="6" onclick="toggleDay(this)">س</button>
                                                </div>
                                                <input type="hidden" id="selectedDays" value="[0,1,2,3,4,5,6]">
                                            </div>
                                            
                                            <div class="mb-3">
                                                <label class="form-label">وقت النشر</label>
                                                <input type="time" class="form-control" id="adkarTime" required value="12:00">
                                            </div>
                                            
                                            <div class="row">
                                                <div class="col-md-6">
                                                    <div class="mb-3">
                                                        <label class="form-label">الأولوية</label>
                                                        <select class="form-select" id="adkarPriority">
                                                            <option value="1">عادي</option>
                                                            <option value="2">متوسط</option>
                                                            <option value="3">عالي</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div class="col-md-6">
                                                    <div class="mb-3">
                                                        <label class="form-label">الحالة</label>
                                                        <select class="form-select" id="adkarActive">
                                                            <option value="1">نشط</option>
                                                            <option value="0">غير نشط</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">إلغاء</button>
                        <button type="button" class="btn btn-primary" onclick="saveAdkar()">حفظ</button>
                    </div>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
        <script>
            // متغيرات عامة
            let categories = [];
            let currentCategoryId = null;
            let currentAdkarId = null;
            
            // تحديث الوقت
            function updateTime() {
                const now = new Date();
                const timeString = now.toLocaleTimeString('ar-SA');
                const dateString = now.toLocaleDateString('ar-SA');
                
                document.getElementById('currentTime').textContent = timeString + ' ' + dateString;
                document.getElementById('currentTime2').textContent = timeString;
            }
            
            // تحميل الإحصائيات
            async function loadStats() {
                try {
                    const response = await fetch('/api/stats');
                    const stats = await response.json();
                    
                    document.getElementById('statsCategories').textContent = stats.categories;
                    document.getElementById('statsAdkar').textContent = stats.adkar;
                    document.getElementById('statsGroups').textContent = stats.groups;
                } catch (error) {
                    console.error('خطأ في تحميل الإحصائيات:', error);
                }
            }
            
            // إظهار وإخفاء الأقسام
            function showSection(section) {
                // إخفاء جميع الأقسام
                ['dashboard', 'categories', 'adkar', 'groups', 'settings'].forEach(sec => {
                    document.getElementById(sec + 'Section').classList.add('d-none');
                });
                
                // إزالة النشط من جميع الروابط
                document.querySelectorAll('.nav-link').forEach(link => {
                    link.classList.remove('active');
                });
                
                // إظهار القسم المطلوب
                document.getElementById(section + 'Section').classList.remove('d-none');
                
                // تفعيل الرابط
                const activeLink = Array.from(document.querySelectorAll('.nav-link')).find(link => 
                    link.getAttribute('onclick')?.includes(`'${section}'`)
                );
                if (activeLink) {
                    activeLink.classList.add('active');
                }
                
                // تحميل البيانات حسب القسم
                if (section === 'categories') {
                    loadCategories();
                } else if (section === 'adkar') {
                    loadCategoriesForSelect();
                    loadAdkar();
                } else if (section === 'groups') {
                    loadGroups();
                }
            }
            
            // تحميل الأقسام للجدول
            async function loadCategories() {
                try {
                    const response = await fetch('/api/categories');
                    categories = await response.json();
                    
                    const tbody = document.getElementById('categoriesTable');
                    tbody.innerHTML = '';
                    
                    categories.forEach(category => {
                        const row = document.createElement('tr');
                        row.innerHTML = \`
                            <td>\${category.id}</td>
                            <td>
                                <span class="category-badge" style="background: \${category.color}20; color: \${category.color};">
                                    \${category.icon} \${category.name}
                                </span>
                            </td>
                            <td>\${category.description || '-'}</td>
                            <td>\${category.sort_order}</td>
                            <td>
                                <span class="badge \${category.is_active ? 'bg-success' : 'bg-secondary'}">
                                    \${category.is_active ? 'نشط' : 'غير نشط'}
                                </span>
                            </td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary action-btn" onclick="editCategory(\${category.id})" title="تعديل">
                                    <i class="bi bi-pencil"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger action-btn" onclick="deleteCategory(\${category.id})" title="حذف">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </td>
                        \`;
                        tbody.appendChild(row);
                    });
                } catch (error) {
                    console.error('خطأ في تحميل الأقسام:', error);
                    showToast('خطأ في تحميل الأقسام', 'danger');
                }
            }
            
            // تحميل الأقسام للقائمة المنسدلة
            async function loadCategoriesForSelect() {
                try {
                    const response = await fetch('/api/categories');
                    categories = await response.json();
                    
                    const filterSelect = document.getElementById('categoryFilter');
                    const adkarSelect = document.getElementById('adkarCategory');
                    
                    filterSelect.innerHTML = '<option value="">جميع الأقسام</option>';
                    adkarSelect.innerHTML = '<option value="">اختر قسم</option>';
                    
                    categories.forEach(cat => {
                        filterSelect.innerHTML += \`<option value="\${cat.id}">\${cat.name}</option>\`;
                        adkarSelect.innerHTML += \`<option value="\${cat.id}">\${cat.name}</option>\`;
                    });
                } catch (error) {
                    console.error('خطأ في تحميل الأقسام:', error);
                }
            }
            
            // تحميل الأذكار
            async function loadAdkar() {
                try {
                    const categoryFilter = document.getElementById('categoryFilter').value;
                    let url = '/api/adkar';
                    if (categoryFilter) {
                        url += \`?category_id=\${categoryFilter}\`;
                    }
                    
                    const response = await fetch(url);
                    const adkarList = await response.json();
                    
                    const tbody = document.getElementById('adkarTable');
                    tbody.innerHTML = '';
                    
                    adkarList.forEach(item => {
                        // تحديد أيقونة النوع
                        let typeIcon = '📝';
                        if (item.content_type === 'audio') typeIcon = '🎵';
                        else if (item.content_type === 'image') typeIcon = '🖼️';
                        else if (item.content_type === 'pdf') typeIcon = '📄';
                        
                        // تحديد أيام الجدولة
                        let scheduleText = 'يومي';
                        if (item.schedule_type === 'weekly') {
                            try {
                                const days = JSON.parse(item.schedule_days || '[]');
                                const dayNames = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
                                const selectedDays = days.map(d => dayNames[d]).join('، ');
                                if (selectedDays) scheduleText = selectedDays;
                            } catch (e) {
                                scheduleText = 'يومي';
                            }
                        }
                        
                        const row = document.createElement('tr');
                        row.innerHTML = \`
                            <td>
                                <strong>\${item.title}</strong>
                                <br>
                                <small class="text-muted">\${item.content.substring(0, 50)}...</small>
                            </td>
                            <td>
                                <span class="badge bg-light text-dark">
                                    \${item.category_icon || '📖'} \${item.category_name || 'عام'}
                                </span>
                            </td>
                            <td>\${typeIcon}</td>
                            <td>
                                \${item.schedule_time}
                                <br>
                                <small class="text-muted">\${scheduleText}</small>
                            </td>
                            <td>
                                <span class="badge \${item.is_active ? 'bg-success' : 'bg-secondary'}">
                                    \${item.is_active ? 'نشط' : 'غير نشط'}
                                </span>
                            </td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary action-btn" onclick="editAdkar(\${item.id})" title="تعديل">
                                    <i class="bi bi-pencil"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger action-btn" onclick="deleteAdkar(\${item.id})" title="حذف">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </td>
                        \`;
                        tbody.appendChild(row);
                    });
                } catch (error) {
                    console.error('خطأ في تحميل الأذكار:', error);
                    showToast('خطأ في تحميل الأذكار', 'danger');
                }
            }
            
            // تحميل المجموعات
            async function loadGroups() {
                try {
                    const response = await fetch('/api/groups');
                    const groups = await response.json();
                    
                    const tbody = document.getElementById('groupsTable');
                    tbody.innerHTML = '';
                    
                    groups.forEach(group => {
                        const row = document.createElement('tr');
                        row.innerHTML = \`
                            <td>
                                <strong>\${group.title || 'مجموعة'}</strong>
                                <br>
                                <small class="text-muted">ID: \${group.chat_id}</small>
                            </td>
                            <td>
                                <span class="badge \${group.bot_enabled ? 'bg-success' : 'bg-secondary'}">
                                    \${group.bot_enabled ? 'نشط' : 'متوقف'}
                                </span>
                            </td>
                            <td>\${new Date(group.created_at).toLocaleDateString('ar-SA')}</td>
                        \`;
                        tbody.appendChild(row);
                    });
                } catch (error) {
                    console.error('خطأ في تحميل المجموعات:', error);
                }
            }
            
            // إظهار مودال القسم
            function showCategoryModal(id = null) {
                currentCategoryId = id;
                const modal = new bootstrap.Modal(document.getElementById('categoryModal'));
                
                if (id) {
                    document.getElementById('categoryModalTitle').textContent = 'تعديل القسم';
                    fetch(\`/api/categories/\${id}\`)
                        .then(response => response.json())
                        .then(category => {
                            document.getElementById('categoryId').value = category.id;
                            document.getElementById('categoryName').value = category.name;
                            document.getElementById('categoryDescription').value = category.description || '';
                            document.getElementById('categoryColor').value = category.color || '#667eea';
                            document.getElementById('categoryIcon').value = category.icon || '📖';
                            document.getElementById('categoryOrder').value = category.sort_order || 0;
                            document.getElementById('categoryActive').value = category.is_active || 1;
                        })
                        .catch(error => {
                            console.error('خطأ في تحميل بيانات القسم:', error);
                            showToast('خطأ في تحميل بيانات القسم', 'danger');
                        });
                } else {
                    document.getElementById('categoryModalTitle').textContent = 'إضافة قسم جديد';
                    document.getElementById('categoryForm').reset();
                    document.getElementById('categoryId').value = '';
                    document.getElementById('categoryColor').value = '#667eea';
                    document.getElementById('categoryIcon').value = '📖';
                    document.getElementById('categoryOrder').value = '0';
                    document.getElementById('categoryActive').value = '1';
                }
                
                modal.show();
            }
            
            // حفظ القسم
            async function saveCategory() {
                const formData = {
                    name: document.getElementById('categoryName').value,
                    description: document.getElementById('categoryDescription').value,
                    color: document.getElementById('categoryColor').value,
                    icon: document.getElementById('categoryIcon').value,
                    sort_order: parseInt(document.getElementById('categoryOrder').value) || 0,
                    is_active: parseInt(document.getElementById('categoryActive').value) || 1
                };
                
                const id = currentCategoryId;
                const url = id ? \`/api/categories/\${id}\` : '/api/categories';
                const method = id ? 'PUT' : 'POST';
                
                try {
                    const response = await fetch(url, {
                        method: method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(formData)
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        const modal = bootstrap.Modal.getInstance(document.getElementById('categoryModal'));
                        modal.hide();
                        showToast(id ? 'تم تعديل القسم بنجاح' : 'تم إضافة القسم بنجاح', 'success');
                        loadCategories();
                        loadCategoriesForSelect();
                    } else {
                        showToast(data.error || 'حدث خطأ في الحفظ', 'danger');
                    }
                } catch (error) {
                    console.error('خطأ في حفظ القسم:', error);
                    showToast('حدث خطأ في الحفظ', 'danger');
                }
            }
            
            // تعديل القسم
            function editCategory(id) {
                showCategoryModal(id);
            }
            
            // حذف القسم
            async function deleteCategory(id) {
                if (confirm('هل أنت متأكد من حذف هذا القسم؟ سيتم حذف جميع الأذكار المرتبطة به.')) {
                    try {
                        const response = await fetch(\`/api/categories/\${id}\`, {
                            method: 'DELETE'
                        });
                        
                        const data = await response.json();
                        
                        if (response.ok) {
                            showToast('تم حذف القسم بنجاح', 'success');
                            loadCategories();
                            loadCategoriesForSelect();
                            loadAdkar();
                        } else {
                            showToast(data.error || 'حدث خطأ في الحذف', 'danger');
                        }
                    } catch (error) {
                        console.error('خطأ في حذف القسم:', error);
                        showToast('حدث خطأ في الحذف', 'danger');
                    }
                }
            }
            
            // إظهار مودال الذكر
            function showAdkarModal(id = null) {
                currentAdkarId = id;
                const modal = new bootstrap.Modal(document.getElementById('adkarModal'));
                
                if (id) {
                    document.getElementById('adkarModalTitle').textContent = 'تعديل ذكر';
                    fetch(\`/api/adkar/\${id}\`)
                        .then(response => response.json())
                        .then(adkar => {
                            document.getElementById('adkarId').value = adkar.id;
                            document.getElementById('adkarTitle').value = adkar.title;
                            document.getElementById('adkarContent').value = adkar.content;
                            document.getElementById('adkarCategory').value = adkar.category_id || '';
                            document.getElementById('adkarContentType').value = adkar.content_type || 'text';
                            document.getElementById('adkarScheduleType').value = adkar.schedule_type || 'daily';
                            document.getElementById('adkarTime').value = adkar.schedule_time || '12:00';
                            document.getElementById('adkarPriority').value = adkar.priority || 1;
                            document.getElementById('adkarActive').value = adkar.is_active || 1;
                            
                            // تعبئة أيام الأسبوع
                            try {
                                const days = JSON.parse(adkar.schedule_days || '[0,1,2,3,4,5,6]');
                                document.querySelectorAll('.day-btn').forEach(btn => {
                                    const dayNum = parseInt(btn.dataset.day);
                                    if (days.includes(dayNum)) {
                                        btn.classList.add('selected');
                                    } else {
                                        btn.classList.remove('selected');
                                    }
                                });
                                document.getElementById('selectedDays').value = JSON.stringify(days);
                            } catch (e) {
                                // إذا كان هناك خطأ في JSON، نختار جميع الأيام
                                document.querySelectorAll('.day-btn').forEach(btn => {
                                    btn.classList.add('selected');
                                });
                                document.getElementById('selectedDays').value = '[0,1,2,3,4,5,6]';
                            }
                            
                            toggleFileInput();
                            toggleDaysSelector();
                        })
                        .catch(error => {
                            console.error('خطأ في تحميل بيانات الذكر:', error);
                            showToast('خطأ في تحميل بيانات الذكر', 'danger');
                        });
                } else {
                    document.getElementById('adkarModalTitle').textContent = 'إضافة ذكر جديد';
                    document.getElementById('adkarForm').reset();
                    document.getElementById('adkarId').value = '';
                    document.getElementById('adkarTime').value = '12:00';
                    document.getElementById('adkarPriority').value = '1';
                    document.getElementById('adkarActive').value = '1';
                    
                    // اختيار جميع الأيام افتراضياً
                    document.querySelectorAll('.day-btn').forEach(btn => {
                        btn.classList.add('selected');
                    });
                    document.getElementById('selectedDays').value = '[0,1,2,3,4,5,6]';
                    
                    toggleFileInput();
                    toggleDaysSelector();
                }
                
                modal.show();
            }
            
            // تبديل عرض حقل الملف
            function toggleFileInput() {
                const contentType = document.getElementById('adkarContentType').value;
                const fileSection = document.getElementById('fileInputSection');
                const fileInput = document.getElementById('adkarFile');
                
                if (contentType === 'text') {
                    fileSection.classList.add('d-none');
                    if (fileInput) fileInput.required = false;
                } else {
                    fileSection.classList.remove('d-none');
                    if (fileInput) fileInput.required = true;
                }
            }
            
            // تبديل عرض اختيار الأيام
            function toggleDaysSelector() {
                const scheduleType = document.getElementById('adkarScheduleType').value;
                const daysSection = document.getElementById('daysSelectorSection');
                
                if (scheduleType === 'daily') {
                    daysSection.classList.add('d-none');
                } else {
                    daysSection.classList.remove('d-none');
                }
            }
            
            // تبديل اختيار اليوم
            function toggleDay(element) {
                element.classList.toggle('selected');
                
                const days = [];
                document.querySelectorAll('.day-btn.selected').forEach(btn => {
                    days.push(parseInt(btn.dataset.day));
                });
                
                document.getElementById('selectedDays').value = JSON.stringify(days);
            }
            
            // حفظ الذكر
            async function saveAdkar() {
                const formData = new FormData();
                const id = currentAdkarId;
                
                formData.append('category_id', document.getElementById('adkarCategory').value);
                formData.append('title', document.getElementById('adkarTitle').value);
                formData.append('content', document.getElementById('adkarContent').value);
                formData.append('content_type', document.getElementById('adkarContentType').value);
                formData.append('schedule_type', document.getElementById('adkarScheduleType').value);
                formData.append('schedule_days', document.getElementById('selectedDays').value);
                formData.append('schedule_time', document.getElementById('adkarTime').value);
                formData.append('priority', document.getElementById('adkarPriority').value);
                formData.append('is_active', document.getElementById('adkarActive').value);
                
                // إضافة الملف إذا تم اختياره
                const fileInput = document.getElementById('adkarFile');
                const contentType = document.getElementById('adkarContentType').value;
                
                if (fileInput && fileInput.files.length > 0 && contentType !== 'text') {
                    const file = fileInput.files[0];
                    const fieldName = contentType + '_file';
                    formData.append(fieldName, file);
                }
                
                const url = id ? \`/api/adkar/\${id}\` : '/api/adkar';
                const method = id ? 'PUT' : 'POST';
                
                try {
                    const response = await fetch(url, {
                        method: method,
                        body: formData
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        const modal = bootstrap.Modal.getInstance(document.getElementById('adkarModal'));
                        modal.hide();
                        showToast(id ? 'تم تعديل الذكر بنجاح' : 'تم إضافة الذكر بنجاح', 'success');
                        loadAdkar();
                    } else {
                        showToast(data.error || 'حدث خطأ في الحفظ', 'danger');
                    }
                } catch (error) {
                    console.error('خطأ في حفظ الذكر:', error);
                    showToast('حدث خطأ في الحفظ', 'danger');
                }
            }
            
            // تعديل ذكر
            function editAdkar(id) {
                showAdkarModal(id);
            }
            
            // حذف ذكر
            async function deleteAdkar(id) {
                if (confirm('هل أنت متأكد من حذف هذا الذكر؟')) {
                    try {
                        const response = await fetch(\`/api/adkar/\${id}\`, {
                            method: 'DELETE'
                        });
                        
                        const data = await response.json();
                        
                        if (response.ok) {
                            showToast('تم حذف الذكر بنجاح', 'success');
                            loadAdkar();
                        } else {
                            showToast(data.error || 'حدث خطأ في الحذف', 'danger');
                        }
                    } catch (error) {
                        console.error('خطأ في حذف الذكر:', error);
                        showToast('حدث خطأ في الحذف', 'danger');
                    }
                }
            }
            
            // عرض رسالة تنبيه
            function showToast(message, type = 'info') {
                // إنشاء عنصر التوست
                const toast = document.createElement('div');
                toast.className = \`position-fixed top-0 start-50 translate-middle-x mt-3 alert alert-\${type} alert-dismissible fade show\`;
                toast.style.zIndex = '9999';
                toast.innerHTML = \`
                    \${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                \`;
                
                document.body.appendChild(toast);
                
                // إزالة التوست بعد 5 ثواني
                setTimeout(() => {
                    toast.remove();
                }, 5000);
            }
            
            // التهيئة عند تحميل الصفحة
            document.addEventListener('DOMContentLoaded', function() {
                // تحميل البيانات الأولية
                loadStats();
                loadCategoriesForSelect();
                
                // تحديث الوقت كل ثانية
                updateTime();
                setInterval(updateTime, 1000);
                
                // تحديث الإحصائيات كل 30 ثانية
                setInterval(loadStats, 30000);
            });
        </script>
    </body>
    </html>
    `;
    
    res.send(html);
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