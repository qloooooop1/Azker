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
    ['audio', 'images', 'pdfs', 'videos'].forEach(dir => {
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
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: function (req, file, cb) {
        const allowedTypes = {
            'audio_file': ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a'],
            'image_file': ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            'pdf_file': ['application/pdf']
        };
        
        if (allowedTypes[file.fieldname] && allowedTypes[file.fieldname].includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`نوع الملف غير مسموح لـ ${file.fieldname}`), false);
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

// إنشاء الجداول المتقدمة
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
        file_type TEXT,
        schedule_type TEXT DEFAULT 'daily', -- daily, weekly, specific_days
        schedule_days TEXT DEFAULT '[0,1,2,3,4,5,6]', -- 0=الأحد, 6=السبت
        schedule_time TEXT NOT NULL,
        is_repeating INTEGER DEFAULT 0,
        repeat_interval INTEGER DEFAULT 1, -- بالدقائق
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
        settings TEXT DEFAULT '{}',
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
        ['أذكار الصباح', 'أذكار الصباح المأثورة', '#FF6B6B', '☀️'],
        ['أذكار المساء', 'أذكار المساء المأثورة', '#4ECDC4', '🌙'],
        ['أذكار عامة', 'أذكار متنوعة للوقت العام', '#45B7D1', '📿'],
        ['آيات قرآنية', 'آيات مختارة من القرآن الكريم', '#96CEB4', '📖'],
        ['أحاديث نبوية', 'أحاديث شريفة', '#FFEAA7', '💬']
    ];

    defaultCategories.forEach((category, index) => {
        db.run(`INSERT OR IGNORE INTO categories (name, description, color, icon, sort_order) VALUES (?, ?, ?, ?, ?)`,
            [category[0], category[1], category[2], category[3], index]);
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

// ========== وظائف مساعدة ==========
function parseDays(daysArray) {
    try {
        if (Array.isArray(daysArray)) return daysArray;
        if (typeof daysArray === 'string') return JSON.parse(daysArray);
        return [0,1,2,3,4,5,6]; // جميع الأيام
    } catch {
        return [0,1,2,3,4,5,6];
    }
}

function shouldSendToday(scheduleDays) {
    const today = moment().day(); // 0=الأحد, 6=السبت
    const days = parseDays(scheduleDays);
    return days.includes(today);
}

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
                    
                    // جلب الأقسام النشطة
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
                `• تحكم كامل من لوحة التحكم\n\n` +
                `*لوحة التحكم:*\n` +
                `http://localhost:${PORT}/admin`;
            
            await bot.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown' });
        }
    } catch (error) {
        console.error('❌ خطأ في /start:', error);
    }
});

// باقي الأوامر البسيطة
['enable', 'disable', 'status', 'help'].forEach(command => {
    bot.onText(new RegExp(`/${command}`), require(`./handlers/${command}.js`)(bot, db));
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
                    await bot.sendAudio(chatId, adkar.file_path, {
                        caption: message,
                        parse_mode: 'Markdown'
                    });
                } else if (adkar.content_type === 'image' && adkar.file_path) {
                    await bot.sendPhoto(chatId, adkar.file_path, {
                        caption: message,
                        parse_mode: 'Markdown'
                    });
                } else if (adkar.content_type === 'pdf' && adkar.file_path) {
                    await bot.sendDocument(chatId, adkar.file_path, {
                        caption: message,
                        parse_mode: 'Markdown'
                    });
                } else {
                    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
                }

                // تسجيل النجاح
                db.run("INSERT INTO logs (chat_id, adkar_id, status) VALUES (?, ?, ?)", 
                    [chatId, adkar.id, 'success']);

            } catch (error) {
                console.error(`❌ خطأ في الإرسال:`, error.message);
                db.run("INSERT INTO logs (chat_id, adkar_id, status, error) VALUES (?, ?, ?, ?)", 
                    [chatId, adkar.id, 'failed', error.message]);
            }
        });
    } catch (error) {
        console.error('❌ خطأ في إرسال الأذكار:', error);
    }
}

// ========== جدولة النشر المتقدمة ==========
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

                console.log(`🕒 نشر ${adkarList.length} ذكر في ${groups.length} مجموعة`);

                for (const adkar of adkarList) {
                    // التحقق من أيام الأسبوع
                    if (adkar.schedule_type === 'weekly' && !shouldSendToday(adkar.schedule_days)) {
                        continue;
                    }

                    for (const group of groups) {
                        await sendAdkarToGroup(group.chat_id, adkar);
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            });
        });
}, 60000); // كل دقيقة

// ========== واجهات API للوحة التحكم ==========

// الحصول على الإحصائيات
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
    const { category_id, active } = req.query;
    
    let query = `SELECT a.*, c.name as category_name, c.icon as category_icon 
                 FROM adkar a 
                 LEFT JOIN categories c ON a.category_id = c.id`;
    
    const conditions = [];
    const params = [];
    
    if (category_id) {
        conditions.push("a.category_id = ?");
        params.push(category_id);
    }
    
    if (active !== undefined) {
        conditions.push("a.is_active = ?");
        params.push(active === 'true' ? 1 : 0);
    }
    
    if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
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
        is_repeating = 0,
        repeat_interval = 60,
        is_active = 1,
        priority = 1
    } = req.body;
    
    let file_path = null;
    let final_content_type = content_type;
    
    // تحديد نوع الملف ومساره
    if (req.files.audio_file) {
        file_path = `/uploads/audio/${req.files.audio_file[0].filename}`;
        final_content_type = 'audio';
    } else if (req.files.image_file) {
        file_path = `/uploads/images/${req.files.image_file[0].filename}`;
        final_content_type = 'image';
    } else if (req.files.pdf_file) {
        file_path = `/uploads/pdfs/${req.files.pdf_file[0].filename}`;
        final_content_type = 'pdf';
    }
    
    db.run(`INSERT INTO adkar (
        category_id, title, content, content_type, file_path, 
        schedule_type, schedule_days, schedule_time, 
        is_repeating, repeat_interval, is_active, priority
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            category_id || null, title, content, final_content_type, file_path,
            schedule_type, schedule_days, schedule_time,
            is_repeating, repeat_interval, is_active, priority
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
    
    if (req.files.audio_file) {
        file_path = `/uploads/audio/${req.files.audio_file[0].filename}`;
        content_type = 'audio';
    } else if (req.files.image_file) {
        file_path = `/uploads/images/${req.files.image_file[0].filename}`;
        content_type = 'image';
    } else if (req.files.pdf_file) {
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
    
    // الحصول على معلومات الذكر لحذف الملف إذا وجد
    db.get("SELECT file_path FROM adkar WHERE id = ?", [id], (err, adkar) => {
        if (adkar && adkar.file_path && fs.existsSync(path.join(__dirname, adkar.file_path))) {
            fs.unlinkSync(path.join(__dirname, adkar.file_path));
        }
        
        db.run("DELETE FROM adkar WHERE id = ?", [id], (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json({ success: true });
            }
        });
    });
});

// الحصول على المجموعات
app.get('/api/groups', (req, res) => {
    const { active } = req.query;
    
    let query = "SELECT * FROM groups";
    const params = [];
    
    if (active === 'true') {
        query += " WHERE bot_enabled = 1";
    }
    
    query += " ORDER BY created_at DESC";
    
    db.all(query, params, (err, groups) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(groups);
        }
    });
});

// ========== لوحة التحكم المتقدمة ==========
app.get('/admin', (req, res) => {
    const adminPage = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>👑 لوحة تحكم بوت الأذكار المتقدم</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">
        <style>
            :root {
                --primary: #667eea;
                --secondary: #764ba2;
                --success: #10b981;
                --danger: #ef4444;
                --warning: #f59e0b;
            }
            
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: #f8fafc;
                color: #334155;
            }
            
            .sidebar {
                background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
                color: white;
                height: 100vh;
                position: fixed;
                width: 280px;
                box-shadow: 5px 0 15px rgba(0,0,0,0.1);
            }
            
            .main-content {
                margin-right: 280px;
                padding: 20px;
            }
            
            .nav-link {
                color: rgba(255,255,255,0.9) !important;
                padding: 12px 20px;
                margin: 5px 15px;
                border-radius: 10px;
                transition: all 0.3s;
            }
            
            .nav-link:hover, .nav-link.active {
                background: rgba(255,255,255,0.15);
                transform: translateX(-5px);
            }
            
            .stat-card {
                background: white;
                border-radius: 15px;
                padding: 25px;
                margin-bottom: 20px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.08);
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
                padding: 5px 15px;
                border-radius: 20px;
                font-size: 14px;
                display: inline-flex;
                align-items: center;
                gap: 5px;
            }
            
            .file-preview {
                width: 100px;
                height: 100px;
                object-fit: cover;
                border-radius: 10px;
                margin: 5px;
                border: 2px solid #e2e8f0;
            }
            
            .schedule-days .day {
                width: 35px;
                height: 35px;
                border-radius: 50%;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                margin: 2px;
                cursor: pointer;
                font-size: 12px;
            }
            
            .day.selected {
                background: var(--primary);
                color: white;
            }
            
            .modal-xl-custom {
                max-width: 1000px;
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
            <div class="p-4 text-center">
                <h3 class="mb-0"><i class="bi bi-cpu"></i> لوحة التحكم</h3>
                <p class="text-muted mb-0">بوت الأذكار المتقدم</p>
            </div>
            
            <nav class="nav flex-column">
                <a class="nav-link active" href="#" onclick="showSection('dashboard')">
                    <i class="bi bi-speedometer2 me-2"></i>لوحة القيادة
                </a>
                <a class="nav-link" href="#" onclick="showSection('categories')">
                    <i class="bi bi-bookmarks me-2"></i>إدارة الأقسام
                </a>
                <a class="nav-link" href="#" onclick="showSection('adkar')">
                    <i class="bi bi-journal-text me-2"></i>إدارة الأذكار
                </a>
                <a class="nav-link" href="#" onclick="showSection('groups')">
                    <i class="bi bi-people me-2"></i>المجموعات
                </a>
                <a class="nav-link" href="#" onclick="showSection('schedule')">
                    <i class="bi bi-calendar-event me-2"></i>الجدولة
                </a>
                <a class="nav-link" href="#" onclick="showSection('settings')">
                    <i class="bi bi-gear me-2"></i>الإعدادات
                </a>
            </nav>
            
            <div class="position-absolute bottom-0 start-0 end-0 p-3 text-center">
                <div class="text-white-50 small" id="botStatus">🟢 البوت يعمل</div>
                <div class="text-white-50 small mt-1" id="serverTime"></div>
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
                            <div class="stat-icon" style="background: #e0f2fe;">
                                <i class="bi bi-bookmarks text-primary"></i>
                            </div>
                            <h3 id="statsCategories">0</h3>
                            <p class="text-muted mb-0">الأقسام النشطة</p>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-icon" style="background: #dcfce7;">
                                <i class="bi bi-journal-text text-success"></i>
                            </div>
                            <h3 id="statsAdkar">0</h3>
                            <p class="text-muted mb-0">الأذكار النشطة</p>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-icon" style="background: #fef3c7;">
                                <i class="bi bi-people text-warning"></i>
                            </div>
                            <h3 id="statsGroups">0</h3>
                            <p class="text-muted mb-0">المجموعات النشطة</p>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-icon" style="background: #fee2e2;">
                                <i class="bi bi-send text-danger"></i>
                            </div>
                            <h3 id="statsToday">0</h3>
                            <p class="text-muted mb-0">النشر اليومي</p>
                        </div>
                    </div>
                </div>
                
                <div class="row mt-4">
                    <div class="col-md-6">
                        <div class="stat-card">
                            <h5><i class="bi bi-graph-up"></i> النشاط الأخير</h5>
                            <div id="activityChart"></div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="stat-card">
                            <h5><i class="bi bi-clock-history"></i> الأذكار القادمة</h5>
                            <div id="upcomingAdkar"></div>
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
                
                <div class="row" id="categoriesList">
                    <!-- سيتم ملؤها بالجافاسكريبت -->
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
                                <th>الجدولة</th>
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
                <h2 class="mb-4"><i class="bi bi-people"></i> المجموعات</h2>
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead class="table-light">
                            <tr>
                                <th>المجموعة</th>
                                <th>الأعضاء</th>
                                <th>الحالة</th>
                                <th>تاريخ الإضافة</th>
                                <th>الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody id="groupsTable">
                            <!-- سيتم ملؤها -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- الجدولة -->
            <div id="scheduleSection" class="d-none">
                <h2 class="mb-4"><i class="bi bi-calendar-event"></i> الجدولة</h2>
                <div class="row">
                    <div class="col-md-8">
                        <div class="stat-card">
                            <h5>جدول النشر الأسبوعي</h5>
                            <div id="weeklySchedule"></div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="stat-card">
                            <h5>إعدادات الجدولة</h5>
                            <!-- إعدادات الجدولة -->
                        </div>
                    </div>
                </div>
            </div>

            <!-- الإعدادات -->
            <div id="settingsSection" class="d-none">
                <h2 class="mb-4"><i class="bi bi-gear"></i> الإعدادات</h2>
                <div class="row">
                    <div class="col-md-6">
                        <div class="stat-card">
                            <h5>إعدادات البوت</h5>
                            <!-- إعدادات البوت -->
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="stat-card">
                            <h5>النسخ الاحتياطي</h5>
                            <!-- إعدادات النسخ -->
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
                                            <option value="💬">💬 حديث</option>
                                            <option value="🕌">🕌 مسجد</option>
                                            <option value="⭐">⭐ نجمة</option>
                                            <option value="✨">✨ بريق</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">ترتيب العرض</label>
                                <input type="number" class="form-control" id="categoryOrder" value="0">
                            </div>
                            <div class="form-check form-switch mb-3">
                                <input class="form-check-input" type="checkbox" id="categoryActive" checked>
                                <label class="form-check-label">نشط</label>
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
                        <form id="adkarForm" enctype="multipart/form-data">
                            <input type="hidden" id="adkarId">
                            
                            <div class="row">
                                <div class="col-md-8">
                                    <div class="mb-3">
                                        <label class="form-label">العنوان</label>
                                        <input type="text" class="form-control" id="adkarTitle" required>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">النص</label>
                                        <textarea class="form-control" id="adkarContent" rows="6" required></textarea>
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
                                    <div class="stat-card">
                                        <h6>إعدادات الجدولة</h6>
                                        
                                        <div class="mb-3">
                                            <label class="form-label">نوع الجدولة</label>
                                            <select class="form-select" id="adkarScheduleType" onchange="toggleScheduleFields()">
                                                <option value="daily">يومي</option>
                                                <option value="weekly">أسبوعي</option>
                                                <option value="specific">أيام محددة</option>
                                            </select>
                                        </div>
                                        
                                        <div class="mb-3">
                                            <label class="form-label">وقت النشر</label>
                                            <input type="time" class="form-control" id="adkarTime" required>
                                        </div>
                                        
                                        <div class="mb-3 d-none" id="daysSelection">
                                            <label class="form-label">أيام النشر</label>
                                            <div class="schedule-days">
                                                <div class="day" data-day="0" onclick="toggleDay(this)">أ</div>
                                                <div class="day" data-day="1" onclick="toggleDay(this)">إ</div>
                                                <div class="day" data-day="2" onclick="toggleDay(this)">ث</div>
                                                <div class="day" data-day="3" onclick="toggleDay(this)">أ</div>
                                                <div class="day" data-day="4" onclick="toggleDay(this)">خ</div>
                                                <div class="day" data-day="5" onclick="toggleDay(this)">ج</div>
                                                <div class="day" data-day="6" onclick="toggleDay(this)">س</div>
                                            </div>
                                            <input type="hidden" id="selectedDays" value="[0,1,2,3,4,5,6]">
                                        </div>
                                        
                                        <div class="form-check form-switch mb-3">
                                            <input class="form-check-input" type="checkbox" id="adkarRepeating">
                                            <label class="form-check-label">تكرار النشر</label>
                                        </div>
                                        
                                        <div class="mb-3 d-none" id="repeatIntervalSection">
                                            <label class="form-label">فترة التكرار (دقائق)</label>
                                            <input type="number" class="form-control" id="adkarRepeatInterval" value="60" min="1">
                                        </div>
                                        
                                        <div class="mb-3">
                                            <label class="form-label">الأولوية</label>
                                            <select class="form-select" id="adkarPriority">
                                                <option value="1">عادي</option>
                                                <option value="2">متوسط</option>
                                                <option value="3">عالي</option>
                                            </select>
                                        </div>
                                        
                                        <div class="form-check form-switch mb-3">
                                            <input class="form-check-input" type="checkbox" id="adkarActive" checked>
                                            <label class="form-check-label">نشط</label>
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
            let currentSection = 'dashboard';
            let categories = [];
            let adkarList = [];
            
            // تحميل الإحصائيات
            async function loadStats() {
                try {
                    const response = await fetch('/api/stats');
                    const stats = await response.json();
                    
                    document.getElementById('statsCategories').textContent = stats.categories;
                    document.getElementById('statsAdkar').textContent = stats.adkar;
                    document.getElementById('statsGroups').textContent = stats.groups;
                    document.getElementById('statsToday').textContent = stats.today;
                } catch (error) {
                    console.error('خطأ في تحميل الإحصائيات:', error);
                }
            }
            
            // إظهار وإخفاء الأقسام
            function showSection(section) {
                // إخفاء جميع الأقسام
                document.querySelectorAll('.main-content > div').forEach(div => {
                    div.classList.add('d-none');
                });
                
                // إزالة النشط من جميع الروابط
                document.querySelectorAll('.nav-link').forEach(link => {
                    link.classList.remove('active');
                });
                
                // إظهار القسم المطلوب
                document.getElementById(section + 'Section').classList.remove('d-none');
                
                // تفعيل الرابط
                document.querySelector(`[onclick="showSection('${section}')"]`).classList.add('active');
                
                currentSection = section;
                
                // تحميل البيانات عند التبديل
                switch(section) {
                    case 'dashboard':
                        loadStats();
                        break;
                    case 'categories':
                        loadCategories();
                        break;
                    case 'adkar':
                        loadCategoriesForFilter();
                        loadAdkar();
                        break;
                    case 'groups':
                        loadGroups();
                        break;
                }
            }
            
            // تحميل الأقسام
            async function loadCategories() {
                try {
                    const response = await fetch('/api/categories');
                    categories = await response.json();
                    
                    const container = document.getElementById('categoriesList');
                    container.innerHTML = '';
                    
                    categories.forEach(category => {
                        const card = document.createElement('div');
                        card.className = 'col-md-4 mb-3';
                        card.innerHTML = \`
                            <div class="stat-card">
                                <div class="d-flex justify-content-between align-items-start">
                                    <div>
                                        <span class="category-badge" style="background: \${category.color}20; color: \${category.color};">
                                            \${category.icon} \${category.name}
                                        </span>
                                        <p class="text-muted mt-2 mb-1 small">\${category.description || 'لا يوجد وصف'}</p>
                                    </div>
                                    <div class="dropdown">
                                        <button class="btn btn-sm btn-light" type="button" data-bs-toggle="dropdown">
                                            <i class="bi bi-three-dots"></i>
                                        </button>
                                        <ul class="dropdown-menu">
                                            <li><a class="dropdown-item" href="#" onclick="editCategory(\${category.id})"><i class="bi bi-pencil"></i> تعديل</a></li>
                                            <li><a class="dropdown-item text-danger" href="#" onclick="deleteCategory(\${category.id})"><i class="bi bi-trash"></i> حذف</a></li>
                                        </ul>
                                    </div>
                                </div>
                                <div class="d-flex justify-content-between mt-3">
                                    <small class="text-muted">
                                        <i class="bi bi-sort-numeric-down"></i> الترتيب: \${category.sort_order}
                                    </small>
                                    <span class="badge \${category.is_active ? 'bg-success' : 'bg-secondary'}">
                                        \${category.is_active ? 'نشط' : 'غير نشط'}
                                    </span>
                                </div>
                            </div>
                        \`;
                        container.appendChild(card);
                    });
                } catch (error) {
                    console.error('خطأ في تحميل الأقسام:', error);
                }
            }
            
            // تحميل الأقسام للفلتر
            async function loadCategoriesForFilter() {
                try {
                    const response = await fetch('/api/categories');
                    const cats = await response.json();
                    
                    const filter = document.getElementById('categoryFilter');
                    const select = document.getElementById('adkarCategory');
                    
                    filter.innerHTML = '<option value="">جميع الأقسام</option>';
                    select.innerHTML = '<option value="">اختر قسم</option>';
                    
                    cats.forEach(cat => {
                        filter.innerHTML += \`<option value="\${cat.id}">\${cat.name}</option>\`;
                        select.innerHTML += \`<option value="\${cat.id}">\${cat.name}</option>\`;
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
                    if (categoryFilter) url += \`?category_id=\${categoryFilter}\`;
                    
                    const response = await fetch(url);
                    adkarList = await response.json();
                    
                    const tbody = document.getElementById('adkarTable');
                    tbody.innerHTML = '';
                    
                    adkarList.forEach(item => {
                        const row = document.createElement('tr');
                        
                        // تحديد أيقونة النوع
                        let typeIcon = '📝';
                        if (item.content_type === 'audio') typeIcon = '🎵';
                        else if (item.content_type === 'image') typeIcon = '🖼️';
                        else if (item.content_type === 'pdf') typeIcon = '📄';
                        
                        // تحديد أيام الجدولة
                        let scheduleText = 'يومي';
                        if (item.schedule_type === 'weekly') {
                            const days = JSON.parse(item.schedule_days || '[]');
                            const dayNames = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
                            scheduleText = days.map(d => dayNames[d]).join('، ');
                        }
                        
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
                                <small>\${item.schedule_time}</small>
                                <br>
                                <small class="text-muted">\${scheduleText}</small>
                            </td>
                            <td>
                                <span class="badge \${item.is_active ? 'bg-success' : 'bg-secondary'}">
                                    \${item.is_active ? 'نشط' : 'غير نشط'}
                                </span>
                            </td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary me-1" onclick="editAdkar(\${item.id})">
                                    <i class="bi bi-pencil"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="deleteAdkar(\${item.id})">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </td>
                        \`;
                        tbody.appendChild(row);
                    });
                } catch (error) {
                    console.error('خطأ في تحميل الأذكار:', error);
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
                            <td>غير معروف</td>
                            <td>
                                <span class="badge \${group.bot_enabled ? 'bg-success' : 'bg-secondary'}">
                                    \${group.bot_enabled ? 'نشط' : 'متوقف'}
                                </span>
                            </td>
                            <td>\${new Date(group.created_at).toLocaleDateString('ar-SA')}</td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary">
                                    <i class="bi bi-info-circle"></i>
                                </button>
                            </td>
                        \`;
                        tbody.appendChild(row);
                    });
                } catch (error) {
                    console.error('خطأ في تحميل المجموعات:', error);
                }
            }
            
            // إظهار مودال القسم
            function showCategoryModal(id = null) {
                const modal = new bootstrap.Modal(document.getElementById('categoryModal'));
                const form = document.getElementById('categoryForm');
                
                if (id) {
                    document.getElementById('categoryModalTitle').textContent = 'تعديل القسم';
                    const category = categories.find(c => c.id == id);
                    if (category) {
                        document.getElementById('categoryId').value = category.id;
                        document.getElementById('categoryName').value = category.name;
                        document.getElementById('categoryDescription').value = category.description || '';
                        document.getElementById('categoryColor').value = category.color || '#667eea';
                        document.getElementById('categoryIcon').value = category.icon || '📖';
                        document.getElementById('categoryOrder').value = category.sort_order || 0;
                        document.getElementById('categoryActive').checked = category.is_active == 1;
                    }
                } else {
                    document.getElementById('categoryModalTitle').textContent = 'إضافة قسم جديد';
                    form.reset();
                    document.getElementById('categoryId').value = '';
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
                    sort_order: document.getElementById('categoryOrder').value,
                    is_active: document.getElementById('categoryActive').checked ? 1 : 0
                };
                
                const id = document.getElementById('categoryId').value;
                const url = id ? \`/api/categories/\${id}\` : '/api/categories';
                const method = id ? 'PUT' : 'POST';
                
                try {
                    const response = await fetch(url, {
                        method: method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(formData)
                    });
                    
                    if (response.ok) {
                        const modal = bootstrap.Modal.getInstance(document.getElementById('categoryModal'));
                        modal.hide();
                        loadCategories();
                        loadCategoriesForFilter();
                    }
                } catch (error) {
                    console.error('خطأ في حفظ القسم:', error);
                    alert('❌ حدث خطأ في الحفظ');
                }
            }
            
            // حذف القسم
            async function deleteCategory(id) {
                if (confirm('هل أنت متأكد من حذف هذا القسم؟')) {
                    try {
                        const response = await fetch(\`/api/categories/\${id}\`, { method: 'DELETE' });
                        if (response.ok) {
                            loadCategories();
                            loadCategoriesForFilter();
                        }
                    } catch (error) {
                        console.error('خطأ في حذف القسم:', error);
                    }
                }
            }
            
            // إظهار مودال الذكر
            function showAdkarModal(id = null) {
                const modal = new bootstrap.Modal(document.getElementById('adkarModal'));
                const form = document.getElementById('adkarForm');
                
                if (id) {
                    document.getElementById('adkarModalTitle').textContent = 'تعديل ذكر';
                    const adkar = adkarList.find(a => a.id == id);
                    if (adkar) {
                        // تعبئة البيانات
                        document.getElementById('adkarId').value = adkar.id;
                        document.getElementById('adkarTitle').value = adkar.title;
                        document.getElementById('adkarContent').value = adkar.content;
                        document.getElementById('adkarCategory').value = adkar.category_id || '';
                        document.getElementById('adkarContentType').value = adkar.content_type || 'text';
                        document.getElementById('adkarScheduleType').value = adkar.schedule_type || 'daily';
                        document.getElementById('adkarTime').value = adkar.schedule_time || '12:00';
                        document.getElementById('adkarRepeating').checked = adkar.is_repeating == 1;
                        document.getElementById('adkarRepeatInterval').value = adkar.repeat_interval || 60;
                        document.getElementById('adkarPriority').value = adkar.priority || 1;
                        document.getElementById('adkarActive').checked = adkar.is_active == 1;
                        
                        // تعبئة أيام الأسبوع
                        const days = JSON.parse(adkar.schedule_days || '[0,1,2,3,4,5,6]');
                        document.querySelectorAll('.day').forEach(day => {
                            const dayNum = parseInt(day.dataset.day);
                            if (days.includes(dayNum)) {
                                day.classList.add('selected');
                            } else {
                                day.classList.remove('selected');
                            }
                        });
                        document.getElementById('selectedDays').value = JSON.stringify(days);
                        
                        toggleFileInput();
                        toggleScheduleFields();
                        toggleRepeatInterval();
                    }
                } else {
                    document.getElementById('adkarModalTitle').textContent = 'إضافة ذكر جديد';
                    form.reset();
                    document.getElementById('adkarId').value = '';
                    document.getElementById('adkarTime').value = '12:00';
                    
                    // ضبط القيم الافتراضية
                    document.querySelectorAll('.day').forEach(day => day.classList.add('selected'));
                    document.getElementById('selectedDays').value = '[0,1,2,3,4,5,6]';
                    
                    toggleFileInput();
                    toggleScheduleFields();
                }
                
                modal.show();
            }
            
            // تبديل عرض حقل الملف
            function toggleFileInput() {
                const contentType = document.getElementById('adkarContentType').value;
                const fileSection = document.getElementById('fileInputSection');
                const fileInput = document.getElementById('adkarFile');
                const label = document.getElementById('fileInputLabel');
                
                if (contentType === 'text') {
                    fileSection.classList.add('d-none');
                    fileInput.required = false;
                } else {
                    fileSection.classList.remove('d-none');
                    fileInput.required = true;
                    
                    if (contentType === 'audio') {
                        label.textContent = 'رفع ملف صوتي (MP3, WAV, OGG)';
                        fileInput.accept = 'audio/*';
                    } else if (contentType === 'image') {
                        label.textContent = 'رفع صورة (JPG, PNG, GIF)';
                        fileInput.accept = 'image/*';
                    } else if (contentType === 'pdf') {
                        label.textContent = 'رفع ملف PDF';
                        fileInput.accept = '.pdf';
                    }
                }
            }
            
            // تبديل عرض حقول الجدولة
            function toggleScheduleFields() {
                const scheduleType = document.getElementById('adkarScheduleType').value;
                const daysSelection = document.getElementById('daysSelection');
                
                if (scheduleType === 'daily') {
                    daysSelection.classList.add('d-none');
                } else {
                    daysSelection.classList.remove('d-none');
                }
            }
            
            // تبديل عرض فترة التكرار
            function toggleRepeatInterval() {
                const isRepeating = document.getElementById('adkarRepeating').checked;
                const repeatSection = document.getElementById('repeatIntervalSection');
                
                if (isRepeating) {
                    repeatSection.classList.remove('d-none');
                } else {
                    repeatSection.classList.add('d-none');
                }
            }
            
            // تبديل اختيار اليوم
            function toggleDay(element) {
                element.classList.toggle('selected');
                
                const days = [];
                document.querySelectorAll('.day.selected').forEach(day => {
                    days.push(parseInt(day.dataset.day));
                });
                
                document.getElementById('selectedDays').value = JSON.stringify(days);
            }
            
            // حفظ الذكر
            async function saveAdkar() {
                const formData = new FormData();
                const id = document.getElementById('adkarId').value;
                
                formData.append('category_id', document.getElementById('adkarCategory').value);
                formData.append('title', document.getElementById('adkarTitle').value);
                formData.append('content', document.getElementById('adkarContent').value);
                formData.append('content_type', document.getElementById('adkarContentType').value);
                formData.append('schedule_type', document.getElementById('adkarScheduleType').value);
                formData.append('schedule_days', document.getElementById('selectedDays').value);
                formData.append('schedule_time', document.getElementById('adkarTime').value);
                formData.append('is_repeating', document.getElementById('adkarRepeating').checked ? 1 : 0);
                formData.append('repeat_interval', document.getElementById('adkarRepeatInterval').value);
                formData.append('priority', document.getElementById('adkarPriority').value);
                formData.append('is_active', document.getElementById('adkarActive').checked ? 1 : 0);
                
                // إضافة الملف إذا تم اختياره
                const fileInput = document.getElementById('adkarFile');
                const contentType = document.getElementById('adkarContentType').value;
                
                if (fileInput.files.length > 0 && contentType !== 'text') {
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
                    
                    if (response.ok) {
                        const modal = bootstrap.Modal.getInstance(document.getElementById('adkarModal'));
                        modal.hide();
                        loadAdkar();
                    }
                } catch (error) {
                    console.error('خطأ في حفظ الذكر:', error);
                    alert('❌ حدث خطأ في الحفظ');
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
                        const response = await fetch(\`/api/adkar/\${id}\`, { method: 'DELETE' });
                        if (response.ok) {
                            loadAdkar();
                        }
                    } catch (error) {
                        console.error('خطأ في حذف الذكر:', error);
                    }
                }
            }
            
            // تحديث وقت السيرفر
            function updateServerTime() {
                const now = new Date();
                document.getElementById('serverTime').textContent = 
                    now.toLocaleTimeString('ar-SA') + ' ' + now.toLocaleDateString('ar-SA');
            }
            
            // تهيئة الصفحة
            document.addEventListener('DOMContentLoaded', function() {
                loadStats();
                updateServerTime();
                setInterval(updateServerTime, 1000);
                setInterval(loadStats, 30000);
                
                // إضافة مستمعين للأزرار
                document.getElementById('adkarRepeating').addEventListener('change', toggleRepeatInterval);
                
                // تحميل الأقسام أول مرة
                loadCategoriesForFilter();
            });
        </script>
    </body>
    </html>
    `;
    
    res.send(adminPage);
});

// ========== بدء الخادم ==========
app.listen(PORT, async () => {
    console.log(`🚀 الخادم يعمل على http://localhost:${PORT}`);
    console.log(`👑 لوحة التحكم: http://localhost:${PORT}/admin`);
    
    try {
        const me = await bot.getMe();
        console.log(`🤖 البوت: @${me.username}`);
        console.log(`✅ النظام جاهز!`);
        
        // عرض عدد الأقسام والأذكار
        db.get("SELECT COUNT(*) as categories FROM categories", (err, cats) => {
            db.get("SELECT COUNT(*) as adkar FROM adkar", (err, adkar) => {
                console.log(`📊 ${cats.categories} قسم، ${adkar.adkar} ذكر`);
            });
        });
    } catch (error) {
        console.error('❌ خطأ في الاتصال بتلجرام:', error.message);
    }
});

// معالجة الأخطاء
process.on('uncaughtException', (error) => {
    console.error('❌ خطأ غير متوقع:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ وعد مرفوض:', error);
});