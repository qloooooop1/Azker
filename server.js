require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');
const { Readable } = require('stream');
const schedule = require('node-schedule');

// ========== إعدادات التطبيق ==========
const app = express();
const PORT = process.env.PORT || 3000;

// إعدادات الوسائط
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static('uploads'));

// التوافق مع env. file: BOT_TOKEN -> TELEGRAM_BOT_TOKEN
if (!process.env.TELEGRAM_BOT_TOKEN && process.env.BOT_TOKEN) {
    process.env.TELEGRAM_BOT_TOKEN = process.env.BOT_TOKEN;
    console.log('ℹ️ استخدام BOT_TOKEN من ملف env.');
}

// التحقق من التوكن
if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('❌ خطأ: TELEGRAM_BOT_TOKEN غير محدد في ملف .env');
    console.error('ℹ️ يجب تعيين TELEGRAM_BOT_TOKEN أو BOT_TOKEN في ملف .env');
    process.exit(1);
}

// ========== الحل النهائي لمشكلة 409 Conflict ==========
let bot;
let isPolling = false;
let initializationInProgress = false;
let retryCount = 0;
const MAX_RETRY_ATTEMPTS = 5;
let reconnectTimeout = null;
let pollingErrorHandler = null;

// تنظيف event listeners من البوت القديم
function cleanupOldBot() {
    if (bot) {
        console.log('🧹 تنظيف event listeners من البوت القديم...');
        try {
            // إزالة جميع event listeners
            bot.removeAllListeners();
            console.log('✅ تم إزالة جميع event listeners');
        } catch (err) {
            console.log('⚠️ خطأ في إزالة listeners:', err.message);
        }
    }
    // تنظيف المرجع
    pollingErrorHandler = null;
}

function initializeBot() {
    // منع تهيئة متعددة في نفس الوقت (singleton pattern)
    if (initializationInProgress) {
        console.log('⚠️ تهيئة البوت جارية بالفعل، تخطي المحاولة المكررة');
        return;
    }
    
    try {
        initializationInProgress = true;
        console.log('🔧 بدء تهيئة البوت...');
        
        // إلغاء أي timeout موجود
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }
        
        // إيقاف أي polling سابق
        if (bot && isPolling) {
            try {
                console.log('🛑 إيقاف polling السابق...');
                bot.stopPolling();
                isPolling = false;
                // انتظار قصير للتأكد من إيقاف polling
                setTimeout(() => continueInitialization(), 1000);
                return;
            } catch (err) {
                console.log('⚠️ لم يكن هناك polling نشط');
            }
        }
        
        // تنظيف البوت القديم
        cleanupOldBot();
        
        // إزالة مرجع البوت القديم إذا كان موجوداً
        if (bot) {
            console.log('🧹 إزالة مرجع البوت القديم...');
            bot = null;
        }
        
        continueInitialization();
    } catch (error) {
        console.error('❌ خطأ في initializeBot:', error);
        initializationInProgress = false; // التأكد من إعادة تعيين الحالة
    }
}

function continueInitialization() {
    // إنشاء البوت جديد
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
        request: {
            timeout: 60000,
            agentOptions: {
                keepAlive: true,
                family: 4
            }
        }
    });
    
    console.log('✅ تم إنشاء instance جديد من البوت');
    
    // تعيين الحد الأقصى للـ listeners لتجنب التحذيرات
    bot.setMaxListeners(20);
    
    // معالجة أخطاء polling
    pollingErrorHandler = async (error) => {
        console.error('❌ خطأ في polling:', error.message);
        console.error('📋 تفاصيل الخطأ:', error.code || 'لا يوجد كود');
        console.error(`⏰ وقت الخطأ: ${new Date().toLocaleString('ar-SA')}`);
        
        if (error.message.includes('409 Conflict')) {
            console.log('⚠️ تم اكتشاف 409 Conflict - نسخة أخرى من البوت تعمل');
            console.log('🔄 إعادة تهيئة البوت بعد إيقاف النسخة الأخرى...');
            isPolling = false;
            initializationInProgress = false;
            
            // زيادة وقت الانتظار مع كل محاولة فاشلة
            const retryDelay = Math.min(10000 * (retryCount + 1), 60000);
            retryCount++;
            
            if (retryCount <= MAX_RETRY_ATTEMPTS) {
                console.log(`🔄 محاولة إعادة الاتصال ${retryCount}/${MAX_RETRY_ATTEMPTS} بعد ${retryDelay/1000} ثانية...`);
                reconnectTimeout = setTimeout(() => {
                    initializeBot();
                }, retryDelay);
            } else {
                console.error('❌ فشلت جميع المحاولات. يرجى التأكد من عدم وجود نسخ أخرى من البوت تعمل.');
                initializationInProgress = false; // إعادة تعيين الحالة للسماح بإعادة المحاولة يدوياً
            }
        } else if (error.message.includes('ETELEGRAM') || error.message.includes('ECONNRESET') || 
                   error.message.includes('ETIMEDOUT') || error.message.includes('ENOTFOUND')) {
            console.log('🔄 خطأ في الاتصال بـ Telegram، إعادة المحاولة خلال 5 ثواني...');
            console.log(`📊 نوع الخطأ: ${error.code || 'Unknown'}`);
            isPolling = false;
            initializationInProgress = false;
            retryCount = 0; // إعادة تعيين عداد المحاولات لأخطاء الاتصال
            
            reconnectTimeout = setTimeout(() => {
                initializeBot();
            }, 5000);
        } else {
            console.log('⚠️ خطأ غير متوقع في polling، سيتم محاولة الاستمرار...');
        }
    };
    
    bot.on('polling_error', pollingErrorHandler);
    
    // بدء polling
    try {
        bot.startPolling({
            polling: {
                interval: 3000,
                timeout: 10,
                autoStart: true
            }
        });
        isPolling = true;
        initializationInProgress = false;
        retryCount = 0; // إعادة تعيين عداد المحاولات عند النجاح
        console.log('✅ بوت التلجرام يعمل بنجاح!');
        console.log('📊 حالة polling: نشط');
        console.log(`⏰ وقت بدء التشغيل: ${new Date().toLocaleString('ar-SA')}`);
        
        // تسجيل معلومات الـ listeners
        console.log(`📊 عدد event listeners المسجلة: ${bot.listenerCount('polling_error')}`);
    } catch (error) {
        console.error('❌ خطأ في بدء polling:', error.message);
        isPolling = false;
        initializationInProgress = false;
        retryCount = 0; // إعادة تعيين عداد المحاولات لأخطاء عامة
        
        // إعادة المحاولة بعد 5 ثواني
        reconnectTimeout = setTimeout(() => {
            initializeBot();
        }, 5000);
    }
}

// بدء البوت
console.log('='.repeat(50));
console.log('🚀 بدء تطبيق بوت الأذكار');
console.log('📅 التاريخ:', new Date().toLocaleString('ar-SA'));
console.log('🔧 البيئة:', process.env.NODE_ENV || 'development');
console.log('🌐 المنفذ:', PORT);
console.log('='.repeat(50));
initializeBot();

// معالجة إغلاق التطبيق بشكل آمن
async function gracefulShutdown(signal) {
    console.log(`\n🛑 تم استلام إشارة ${signal} - بدء الإيقاف الآمن...`);
    console.log(`⏰ وقت الإيقاف: ${new Date().toLocaleString('ar-SA')}`);
    console.log('📊 حالة polling قبل الإيقاف:', isPolling ? 'نشط' : 'متوقف');
    
    // إلغاء أي reconnect timeout
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        console.log('✅ تم إلغاء محاولات إعادة الاتصال المعلقة');
    }
    
    // إيقاف polling
    if (bot && isPolling) {
        try {
            console.log('🛑 إيقاف polling...');
            await bot.stopPolling();
            isPolling = false;
            console.log('✅ تم إيقاف polling بنجاح');
        } catch (err) {
            console.error('❌ خطأ في إيقاف polling:', err.message);
        }
    }
    
    // تنظيف event listeners
    cleanupOldBot();
    
    // إلغاء جميع الجداول المجدولة
    if (scheduledJobs && scheduledJobs.size > 0) {
        console.log(`📅 إلغاء ${scheduledJobs.size} مهمة مجدولة...`);
        const cancelPromises = [];
        scheduledJobs.forEach((job, key) => {
            try {
                job.cancel();
                console.log(`✅ تم إلغاء المهمة: ${key}`);
            } catch (err) {
                console.error(`❌ خطأ في إلغاء المهمة ${key}:`, err.message);
            }
        });
        scheduledJobs.clear();
        console.log('✅ تم إلغاء جميع المهام المجدولة');
    }
    
    // إغلاق قاعدة البيانات باستخدام Promise
    if (db) {
        console.log('🗄️ إغلاق قاعدة البيانات...');
        await new Promise((resolve) => {
            db.close((err) => {
                if (err) {
                    console.error('❌ خطأ في إغلاق قاعدة البيانات:', err.message);
                } else {
                    console.log('✅ تم إغلاق قاعدة البيانات بنجاح');
                }
                resolve(); // نكمل في كل الحالات
            });
        });
    }
    
    console.log('👋 إنهاء البرنامج...');
    process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// معالجة الأخطاء غير المتوقعة - نستخدم نسخة متزامنة للأمان
process.on('uncaughtException', (err) => {
    console.error('❌ خطأ غير متوقع (uncaughtException):', err);
    console.error('📋 Stack trace:', err.stack);
    
    // محاولة تنظيف سريع ومتزامن
    try {
        if (bot && isPolling) {
            bot.stopPolling();
        }
        if (db) {
            db.close(() => {});
        }
    } catch (e) {
        console.error('خطأ في التنظيف:', e.message);
    }
    
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promise rejection غير معالجة:', reason);
    console.error('📋 Promise:', promise);
    // لا نقوم بإيقاف البرنامج في حالة unhandledRejection
    // لكن نسجل الخطأ للمراقبة
});

// ========== إعداد رفع الملفات ==========
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    ['audio', 'images', 'pdfs', 'temp'].forEach(dir => {
        fs.mkdirSync(path.join(uploadsDir, dir), { recursive: true });
    });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let folder = 'general';
        if (file.fieldname === 'audio_file') folder = 'audio';
        else if (file.fieldname === 'image_file') folder = 'images';
        else if (file.fieldname === 'pdf_file') folder = 'pdfs';
        else if (file.fieldname === 'file') folder = 'temp';
        
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
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    fileFilter: function (req, file, cb) {
        const allowedTypes = {
            'audio_file': ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/x-m4a'],
            'image_file': ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
            'pdf_file': ['application/pdf'],
            'file': ['audio/*', 'image/*', 'application/pdf', 'video/*']
        };
        
        const fileType = file.fieldname;
        if (allowedTypes[fileType] && 
            (allowedTypes[fileType].includes(file.mimetype) || 
             allowedTypes[fileType].some(type => type.endsWith('/*') && file.mimetype.startsWith(type.split('/*')[0])))) {
            cb(null, true);
        } else {
            cb(new Error(`نوع الملف غير مسموح: ${file.mimetype}`), false);
        }
    }
});

// وظيفة لتحميل الملف من رابط
async function downloadFileFromUrl(url, fileType) {
    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            timeout: 30000
        });
        
        const ext = path.extname(url.split('?')[0]) || 
                   (fileType === 'audio' ? '.mp3' : 
                    fileType === 'image' ? '.jpg' : 
                    fileType === 'pdf' ? '.pdf' : '.bin');
        
        const fileName = Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;
        const folder = fileType === 'audio' ? 'audio' : 
                      fileType === 'image' ? 'images' : 
                      fileType === 'pdf' ? 'pdfs' : 'temp';
        
        const filePath = path.join(uploadsDir, folder, fileName);
        const writer = fs.createWriteStream(filePath);
        
        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(`/uploads/${folder}/${fileName}`));
            writer.on('error', reject);
        });
    } catch (error) {
        console.error('❌ خطأ في تحميل الملف:', error.message);
        return null;
    }
}

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

    // جدول الأذكار مع جدولة متقدمة
    db.run(`CREATE TABLE IF NOT EXISTS adkar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        content_type TEXT DEFAULT 'text',
        file_path TEXT,
        file_url TEXT,
        schedule_type TEXT DEFAULT 'daily', -- daily, weekly, monthly, yearly, specific_days
        schedule_days TEXT DEFAULT '[0,1,2,3,4,5,6]', -- 0=الأحد, 1=الإثنين, ..., 6=السبت
        schedule_dates TEXT DEFAULT '[]', -- أيام الشهر [1,15,30]
        schedule_months TEXT DEFAULT '[]', -- أشهر السنة [1,4,7,10]
        schedule_time TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        priority INTEGER DEFAULT 1,
        last_sent DATETIME,
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

    // جدول سجلات النشر
    db.run(`CREATE TABLE IF NOT EXISTS sent_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        adkar_id INTEGER,
        chat_id TEXT,
        status TEXT DEFAULT 'success',
        error TEXT,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (adkar_id) REFERENCES adkar(id)
    )`);

    // إضافة أقسام افتراضية
    const defaultCategories = [
        ['أذكار الصباح', 'أذكار الصباح المأثورة', '#FF6B6B', '☀️', 1],
        ['أذكار المساء', 'أذكار المساء المأثورة', '#4ECDC4', '🌙', 2],
        ['أذكار عامة', 'أذكار متنوعة للوقت العام', '#45B7D1', '📿', 3],
        ['آيات قرآنية', 'آيات مختارة من القرآن الكريم', '#96CEB4', '📖', 4],
        ['أحاديث نبوية', 'أحاديث شريفة متنوعة', '#FF9F43', '💬', 5]
    ];

    defaultCategories.forEach((category) => {
        db.run(`INSERT OR IGNORE INTO categories (name, description, color, icon, sort_order) VALUES (?, ?, ?, ?, ?)`,
            category);
    });

    // إضافة أذكار افتراضية
    db.get("SELECT COUNT(*) as count FROM adkar", (err, row) => {
        if (row && row.count === 0) {
            const defaultAdkar = [
                [1, 'أذكار الصباح', 'أصبحنا وأصبح الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير.', '06:00', 'daily'],
                [2, 'أذكار المساء', 'أمسينا وأمسى الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير.', '18:00', 'daily'],
                [3, 'سبحان الله وبحمده', 'سبحان الله وبحمده، سبحان الله العظيم. من قالها في يوم مائة مرة حطت خطاياه وإن كانت مثل زبد البحر.', '12:00', 'daily'],
                [4, 'لا إله إلا الله', 'لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير.', '15:00', 'daily']
            ];
            
            const stmt = db.prepare("INSERT INTO adkar (category_id, title, content, schedule_time, schedule_type) VALUES (?, ?, ?, ?, ?)");
            defaultAdkar.forEach(adkar => {
                stmt.run(adkar);
            });
            stmt.finalize();
            console.log('✅ تم إضافة الأذكار الافتراضية');
        }
    });
});

// ========== فحص وصيانة قاعدة البيانات ==========
async function verifyDatabaseIntegrity() {
    return new Promise((resolve, reject) => {
        console.log('🔍 بدء فحص سلامة قاعدة البيانات...');
        
        // التحقق من وجود المجموعات
        db.get("SELECT COUNT(*) as count FROM groups", (err, row) => {
            if (err) {
                console.error('❌ خطأ في فحص جدول المجموعات:', err);
                reject(err);
                return;
            }
            
            const groupCount = row ? row.count : 0;
            console.log(`📊 عدد المجموعات في قاعدة البيانات: ${groupCount}`);
            
            // عرض المجموعات النشطة
            db.all("SELECT chat_id, title, bot_enabled, created_at FROM groups WHERE bot_enabled = 1", 
                (err, groups) => {
                    if (err) {
                        console.error('❌ خطأ في جلب المجموعات النشطة:', err);
                    } else if (groups && groups.length > 0) {
                        console.log(`✅ المجموعات النشطة (${groups.length}):`);
                        groups.forEach(group => {
                            console.log(`   - ${group.title || 'بدون اسم'} (${group.chat_id})`);
                            console.log(`     تاريخ الإضافة: ${group.created_at}`);
                        });
                    } else {
                        console.log('ℹ️ لا توجد مجموعات نشطة حالياً');
                    }
                    
                    // عرض المجموعات غير النشطة
                    db.all("SELECT chat_id, title, created_at FROM groups WHERE bot_enabled = 0", 
                        (err, inactiveGroups) => {
                            if (err) {
                                console.error('❌ خطأ في جلب المجموعات غير النشطة:', err);
                            } else if (inactiveGroups && inactiveGroups.length > 0) {
                                console.log(`⏸️ المجموعات غير النشطة (${inactiveGroups.length}):`);
                                inactiveGroups.forEach(group => {
                                    console.log(`   - ${group.title || 'بدون اسم'} (${group.chat_id})`);
                                    console.log(`     تاريخ الإضافة: ${group.created_at}`);
                                    console.log(`     ℹ️ هذه المجموعة غير مفعلة. استخدم /start في المجموعة لتفعيلها`);
                                });
                            }
                            
                            // التحقق من الأذكار
                            db.get("SELECT COUNT(*) as count FROM adkar WHERE is_active = 1", (err, adkarRow) => {
                                if (err) {
                                    console.error('❌ خطأ في فحص جدول الأذكار:', err);
                                } else {
                                    const adkarCount = adkarRow ? adkarRow.count : 0;
                                    console.log(`📖 عدد الأذكار النشطة: ${adkarCount}`);
                                }
                                
                                console.log('✅ اكتمل فحص قاعدة البيانات');
                                console.log('='.repeat(50));
                                resolve();
                            });
                        });
                });
        });
    });
}

// تنفيذ فحص قاعدة البيانات بعد الاتصال
setTimeout(async () => {
    try {
        await verifyDatabaseIntegrity();
    } catch (err) {
        console.error('❌ فشل فحص قاعدة البيانات:', err);
    }
}, 2000);

// ========== وظائف مساعدة ==========
function parseJSONArray(str, defaultValue = []) {
    try {
        if (!str) return defaultValue;
        const parsed = JSON.parse(str);
        return Array.isArray(parsed) ? parsed : defaultValue;
    } catch {
        return defaultValue;
    }
}

function shouldSendToday(adkar) {
    const now = moment();
    const currentDay = now.day(); // 0-6
    const currentDate = now.date(); // 1-31
    const currentMonth = now.month() + 1; // 1-12
    
    switch(adkar.schedule_type) {
        case 'daily':
            return true;
            
        case 'weekly':
            const days = parseJSONArray(adkar.schedule_days);
            return days.includes(currentDay);
            
        case 'monthly':
            const dates = parseJSONArray(adkar.schedule_dates);
            return dates.includes(currentDate);
            
        case 'yearly':
            const months = parseJSONArray(adkar.schedule_months);
            return months.includes(currentMonth);
            
        case 'specific_days':
            const scheduleDays = parseJSONArray(adkar.schedule_days);
            return scheduleDays.includes(currentDay);
            
        default:
            return true;
    }
}

async function sendAdkarToGroup(chatId, adkar) {
    try {
        // التحقق من تفعيل البوت في المجموعة باستخدام Promise
        const group = await new Promise((resolve, reject) => {
            db.get("SELECT bot_enabled FROM groups WHERE chat_id = ?", [chatId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!group || group.bot_enabled !== 1) {
            console.log(`⏸️ البوت معطل في المجموعة: ${chatId}`);
            return;
        }

        let message = `📌 *${adkar.category_name || 'ذكر'}*\n`;
        message += `📖 ${adkar.title}\n\n`;
        message += `${adkar.content}\n\n`;
        message += `🕒 ${adkar.schedule_time} | 📅 ${moment().format('YYYY/MM/DD')}`;

        // إرسال المحتوى حسب النوع
        if (adkar.content_type === 'text') {
            await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            
        } else if (adkar.content_type === 'audio') {
            if (adkar.file_path && fs.existsSync(path.join(__dirname, adkar.file_path))) {
                await bot.sendAudio(chatId, path.join(__dirname, adkar.file_path), {
                    caption: message,
                    parse_mode: 'Markdown'
                });
            } else if (adkar.file_url) {
                await bot.sendAudio(chatId, adkar.file_url, {
                    caption: message,
                    parse_mode: 'Markdown'
                });
            } else {
                await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            }
            
        } else if (adkar.content_type === 'image') {
            if (adkar.file_path && fs.existsSync(path.join(__dirname, adkar.file_path))) {
                await bot.sendPhoto(chatId, path.join(__dirname, adkar.file_path), {
                    caption: message,
                    parse_mode: 'Markdown'
                });
            } else if (adkar.file_url) {
                await bot.sendPhoto(chatId, adkar.file_url, {
                    caption: message,
                    parse_mode: 'Markdown'
                });
            } else {
                await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            }
            
        } else if (adkar.content_type === 'pdf') {
            if (adkar.file_path && fs.existsSync(path.join(__dirname, adkar.file_path))) {
                await bot.sendDocument(chatId, path.join(__dirname, adkar.file_path), {
                    caption: message,
                    parse_mode: 'Markdown'
                });
            } else if (adkar.file_url) {
                await bot.sendDocument(chatId, adkar.file_url, {
                    caption: message,
                    parse_mode: 'Markdown'
                });
            } else {
                await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            }
        }

        // تحديث وقت آخر إرسال وتسجيل النجاح باستخدام Promise
        await new Promise((resolve, reject) => {
            db.run("UPDATE adkar SET last_sent = datetime('now') WHERE id = ?", [adkar.id], (err) => {
                if (err) {
                    console.error('⚠️ خطأ في تحديث وقت الإرسال:', err.message);
                }
                resolve(); // نستمر حتى لو فشل التحديث
            });
        });
        
        await new Promise((resolve, reject) => {
            db.run("INSERT INTO sent_logs (adkar_id, chat_id, status) VALUES (?, ?, ?)", 
                [adkar.id, chatId, 'success'], (err) => {
                    if (err) {
                        console.error('⚠️ خطأ في تسجيل النجاح:', err.message);
                    }
                    resolve(); // نستمر حتى لو فشل التسجيل
                });
        });
        
        console.log(`✅ تم نشر "${adkar.title}" في ${chatId}`);

    } catch (error) {
        console.error(`❌ خطأ في الإرسال لـ ${chatId}:`, error.message);
        
        // تسجيل الفشل باستخدام Promise
        await new Promise((resolve) => {
            db.run("INSERT INTO sent_logs (adkar_id, chat_id, status, error) VALUES (?, ?, ?, ?)", 
                [adkar.id, chatId, 'failed', error.message], (err) => {
                    if (err) {
                        console.error('⚠️ خطأ في تسجيل الفشل:', err.message);
                    }
                    resolve(); // نستمر في كل الحالات
                });
        });
    }
}

// ========== جدولة النشر المتقدمة ==========
// تخزين المهام المجدولة
const scheduledJobs = new Map();

// وظيفة لإرسال الأذكار المجدولة
async function sendScheduledAzkar(adkarId) {
    console.log(`📅 تشغيل مهمة مجدولة للذكر رقم ${adkarId}`);
    console.log(`⏰ الوقت: ${new Date().toLocaleString('ar-SA')}`);
    
    try {
        // جلب الذكر من قاعدة البيانات
        const adkar = await new Promise((resolve, reject) => {
            db.get(`SELECT a.*, c.name as category_name FROM adkar a 
                   LEFT JOIN categories c ON a.category_id = c.id 
                   WHERE a.id = ? AND a.is_active = 1`, 
                [adkarId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
        });
        
        if (!adkar) {
            console.log(`⚠️ الذكر ${adkarId} غير موجود أو غير مفعل`);
            return;
        }
        
        // التحقق من الجدولة
        if (!shouldSendToday(adkar)) {
            console.log(`⏭️ تخطي الذكر ${adkarId} - غير مجدول لهذا اليوم`);
            return;
        }
        
        // التحقق من آخر إرسال (تجنب التكرار)
        const sentToday = await new Promise((resolve, reject) => {
            db.get(`SELECT COUNT(*) as count FROM sent_logs 
                   WHERE adkar_id = ? AND date(sent_at) = date('now')`,
                [adkar.id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row ? row.count : 0);
                });
        });
        
        if (sentToday > 0) {
            console.log(`✓ الذكر ${adkarId} تم إرساله اليوم بالفعل`);
            return;
        }
        
        // جلب المجموعات النشطة
        const groups = await new Promise((resolve, reject) => {
            db.all("SELECT chat_id, title FROM groups WHERE bot_enabled = 1", (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        if (groups.length === 0) {
            console.log('⚠️ لا توجد مجموعات نشطة');
            return;
        }
        
        console.log(`📤 نشر الذكر "${adkar.title}" إلى ${groups.length} مجموعة`);
        
        // إرسال لكل مجموعة
        for (const group of groups) {
            try {
                await sendAdkarToGroup(group.chat_id, adkar);
                console.log(`✓ تم إرسال الذكر إلى المجموعة ${group.title || group.chat_id}`);
                // تأخير لتجنب الحظر
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`❌ خطأ في إرسال الذكر إلى المجموعة ${group.chat_id}:`, error.message);
            }
        }
        
        console.log(`✅ اكتملت عملية نشر الذكر ${adkarId}`);
        
    } catch (error) {
        console.error(`❌ خطأ في sendScheduledAzkar للذكر ${adkarId}:`, error);
    }
}

// وظيفة لجدولة ذكر واحد
function scheduleAdkar(adkar) {
    const jobKey = `adkar_${adkar.id}`;
    
    // إلغاء المهمة السابقة إذا كانت موجودة (مهم عند التحديث)
    if (scheduledJobs.has(jobKey)) {
        scheduledJobs.get(jobKey).cancel();
        scheduledJobs.delete(jobKey);
    }
    
    // عدم جدولة الأذكار غير المفعلة
    if (!adkar.is_active) {
        console.log(`⏸️ تخطي جدولة الذكر ${adkar.id} - غير مفعل`);
        return;
    }
    
    try {
        // تحليل وقت الجدولة (HH:mm)
        const [hour, minute] = adkar.schedule_time.split(':').map(Number);
        
        if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            console.error(`❌ وقت جدولة غير صحيح للذكر ${adkar.id}: ${adkar.schedule_time}`);
            return;
        }
        
        // إنشاء قاعدة الجدولة - كل يوم في الوقت المحدد
        const rule = new schedule.RecurrenceRule();
        rule.hour = hour;
        rule.minute = minute;
        rule.tz = process.env.TIMEZONE || 'Asia/Riyadh'; // المنطقة الزمنية (قابلة للتعديل من .env)
        
        const job = schedule.scheduleJob(rule, () => {
            sendScheduledAzkar(adkar.id);
        });
        
        scheduledJobs.set(jobKey, job);
        console.log(`✅ تم جدولة الذكر ${adkar.id} "${adkar.title}" في الساعة ${adkar.schedule_time}`);
    } catch (error) {
        console.error(`❌ خطأ في جدولة الذكر ${adkar.id}:`, error);
    }
}

// وظيفة لتحميل وجدولة جميع الأذكار
function loadAndScheduleAllAzkar() {
    console.log('🔄 تحميل وجدولة جميع الأذكار...');
    
    db.all(`SELECT a.*, c.name as category_name FROM adkar a 
           LEFT JOIN categories c ON a.category_id = c.id 
           WHERE a.is_active = 1`, 
        (err, adkarList) => {
            if (err) {
                console.error('❌ خطأ في جلب الأذكار:', err);
                return;
            }
            
            if (!adkarList || adkarList.length === 0) {
                console.log('⚠️ لا توجد أذكار نشطة للجدولة');
                return;
            }
            
            console.log(`📋 تم العثور على ${adkarList.length} ذكر نشط`);
            
            // جدولة كل ذكر
            adkarList.forEach(adkar => {
                scheduleAdkar(adkar);
            });
            
            console.log(`✅ تم جدولة ${scheduledJobs.size} ذكر بنجاح`);
        });
}

// بدء الجدولة عند تشغيل الخادم
// الانتظار للتأكد من اتصال قاعدة البيانات والبوت قبل جدولة الأذكار
const SCHEDULER_STARTUP_DELAY = parseInt(process.env.SCHEDULER_STARTUP_DELAY || '5000', 10);
setTimeout(() => {
    if (isPolling) {
        loadAndScheduleAllAzkar();
    }
}, SCHEDULER_STARTUP_DELAY);

// ========== معالجة أوامر البوت ==========
// معالجة إضافة البوت للمجموعة (auto-activation)
bot.on('my_chat_member', async (update) => {
    try {
        const chatId = update.chat.id;
        const chatType = update.chat.type;
        const newStatus = update.new_chat_member.status;
        const oldStatus = update.old_chat_member.status;
        
        console.log(`👥 تحديث my_chat_member - المجموعة: ${update.chat.title || chatId}`);
        console.log(`   الحالة القديمة: ${oldStatus} -> الحالة الجديدة: ${newStatus}`);
        
        // التحقق من أن البوت تمت إضافته للمجموعة
        if ((chatType === 'group' || chatType === 'supergroup') && 
            (oldStatus === 'left' || oldStatus === 'kicked') && 
            (newStatus === 'member' || newStatus === 'administrator')) {
            
            const title = update.chat.title;
            const adminId = update.from.id;
            
            console.log(`🆕 تمت إضافة البوت للمجموعة الجديدة!`);
            console.log(`   📛 اسم المجموعة: ${title}`);
            console.log(`   🆔 معرّف المجموعة: ${chatId}`);
            console.log(`   👤 المستخدم الذي أضاف البوت: ${update.from.first_name} (${adminId})`);
            console.log(`   📅 التاريخ والوقت: ${new Date().toLocaleString('ar-SA')}`);
            
            // حفظ المجموعة في قاعدة البيانات بدون تفعيل أولاً
            db.run(`INSERT OR IGNORE INTO groups (chat_id, title, admin_id, bot_enabled) VALUES (?, ?, ?, ?)`, 
                [chatId, title, adminId, 0], function(err) {
                    if (err) {
                        console.error(`❌ خطأ في حفظ المجموعة في قاعدة البيانات: ${err.message}`);
                        console.error(`   المجموعة: ${title} (${chatId})`);
                        return;
                    }
                    
                    if (this.changes > 0) {
                        console.log(`✅ تم حفظ المجموعة الجديدة في قاعدة البيانات (bot_enabled = 0)`);
                    } else {
                        console.log(`ℹ️ المجموعة موجودة مسبقاً في قاعدة البيانات، تحديث العنوان...`);
                    }
                    
                    // تحديث العنوان فقط في حالة المجموعة موجودة مسبقاً (عندما لا يتم إدخال صف جديد)
                    if (this.changes === 0) {
                        db.run(`UPDATE groups SET title = ? WHERE chat_id = ?`, [title, chatId], (updateErr) => {
                            if (updateErr) {
                                console.error('❌ خطأ في تحديث عنوان المجموعة:', updateErr);
                            } else {
                                console.log(`✅ تم تحديث عنوان المجموعة إلى: ${title}`);
                            }
                        });
                    }
                    
                    // إرسال رسالة ترحيب تطلب من المستخدم النقر على /start
                    (async () => {
                        try {
                            const welcomeMsg = `🎉 Welcome! Use the /start command to activate this group. 🎯`;
                            
                            await bot.sendMessage(chatId, welcomeMsg);
                            console.log(`✅ تم إرسال رسالة الترحيب للمجموعة: ${title} (${chatId})`);
                            console.log(`📝 معلومات المجموعة - العنوان: ${title}, ID: ${chatId}, المشرف: ${adminId}`);
                            
                        } catch (error) {
                            console.error(`❌ خطأ في إرسال رسالة الترحيب للمجموعة: ${title} (${chatId})`);
                            console.error(`📋 تفاصيل الخطأ: ${error.message}`);
                        }
                    })();
                });
        }
        
        // معالجة إزالة البوت من المجموعة (لا نحذف المجموعة، فقط نعطل البوت)
        if ((chatType === 'group' || chatType === 'supergroup') && 
            (newStatus === 'left' || newStatus === 'kicked')) {
            
            const title = update.chat.title;
            
            console.log(`🚫 تمت إزالة البوت من المجموعة`);
            console.log(`   📛 اسم المجموعة: ${title}`);
            console.log(`   🆔 معرّف المجموعة: ${chatId}`);
            console.log(`   📅 التاريخ والوقت: ${new Date().toLocaleString('ar-SA')}`);
            
            // تعطيل البوت في المجموعة (لكن لا نحذف المجموعة للاحتفاظ بالسجل)
            db.run(`UPDATE groups SET bot_enabled = 0 WHERE chat_id = ?`, [chatId], (err) => {
                if (err) {
                    console.error(`❌ خطأ في تعطيل البوت للمجموعة: ${err.message}`);
                } else {
                    console.log(`✅ تم تعطيل البوت في المجموعة: ${title} (${chatId})`);
                    console.log(`ℹ️ المجموعة محفوظة في قاعدة البيانات للسجل التاريخي`);
                }
            });
        }
    } catch (error) {
        console.error('❌ خطأ في معالجة my_chat_member:', error);
    }
});


bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    
    console.log(`📝 تم استدعاء الأمر /start من ${chatType === 'private' ? 'محادثة خاصة' : 'مجموعة'} (${chatId})`);
    
    try {
        if (chatType === 'group' || chatType === 'supergroup') {
            const title = msg.chat.title;
            const adminId = msg.from.id;
            
            console.log(`👤 المستخدم ${msg.from.first_name} (${adminId}) قام بالنقر على /start في المجموعة ${title}`);
            
            // التحقق من صلاحية المشرف
            try {
                const chatMember = await bot.getChatMember(chatId, adminId);
                if (!['creator', 'administrator'].includes(chatMember.status)) {
                    await bot.sendMessage(chatId, '⚠️ هذا الأمر متاح للمشرفين فقط.');
                    return;
                }
            } catch (error) {
                console.error('❌ خطأ في التحقق من صلاحية المشرف:', error);
                await bot.sendMessage(chatId, '❌ حدث خطأ في التحقق من الصلاحيات.');
                return;
            }
            
            // حفظ المجموعة وتفعيل البوت
            db.run(`INSERT OR IGNORE INTO groups (chat_id, title, admin_id, bot_enabled) VALUES (?, ?, ?, ?)`, 
                [chatId, title, adminId, 1], function(err) {
                    if (err) {
                        console.error('❌ خطأ في حفظ المجموعة أثناء تفعيل البوت:', err);
                        bot.sendMessage(chatId, '❌ حدث خطأ في تفعيل البوت.').catch(e => console.error(e));
                        return;
                    }
                    
                    // تحديث البوت إلى مفعل إذا كانت المجموعة موجودة مسبقاً
                    db.run(`UPDATE groups SET bot_enabled = 1, title = ? WHERE chat_id = ?`, 
                        [title, chatId], async (updateErr) => {
                            if (updateErr) {
                                console.error('❌ خطأ في تحديث حالة المجموعة:', updateErr);
                            }
                            
                            const activationMsg = `🕌 تم تفعيل بوت الأذكار بنجاح!\n\n` +
                                `الأوامر المتوفرة:\n` +
                                `/enable - تفعيل البوت\n` +
                                `/disable - إيقاف البوت\n` +
                                `/status - حالة البوت\n` +
                                `/help - المساعدة\n\n` +
                                `📊 الأقسام المتاحة:\n` +
                                `☀️ أذكار الصباح\n` +
                                `🌙 أذكار المساء\n` +
                                `📿 أذكار عامة\n` +
                                `📖 آيات قرآنية\n` +
                                `💬 أحاديث نبوية`;
                            
                            try {
                                await bot.sendMessage(chatId, activationMsg);
                                console.log(`✅ تم تفعيل البوت بنجاح في المجموعة: ${title} (${chatId})`);
                                console.log(`👤 تم التفعيل بواسطة المشرف: ${msg.from.first_name} (${adminId})`);
                                console.log(`📊 حالة البوت الآن: مفعّل ✓`);
                            } catch (sendErr) {
                                console.error('❌ خطأ في إرسال رسالة التفعيل:', sendErr);
                            }
                        });
                });
        } else {
            // محادثة خاصة
            try {
                const helpMsg = `مرحباً بك! 👋\n\n` +
                    `أنا بوت نشر الأذكار التلقائي المتقدم.\n\n` +
                    `*المميزات:*\n` +
                    `• أقسام متعددة (صباح، مساء، قرآن، أحاديث)\n` +
                    `• جدولة متقدمة (يومي، أسبوعي، شهري، سنوي)\n` +
                    `• دعم الملفات (صور، صوتيات، PDF)\n` +
                    `• رفع ملفات مباشرة أو روابط\n` +
                    `• تحكم كامل من لوحة التحكم`;
                
                await bot.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown' });
                console.log(`ℹ️ تم إرسال رسالة المساعدة للمحادثة الخاصة (${chatId})`);
            } catch (error) {
                console.error('❌ خطأ في إرسال رسالة المساعدة للمحادثة الخاصة:', error);
            }
        }
    } catch (error) {
        console.error('❌ خطأ في /start:', error);
        try {
            await bot.sendMessage(chatId, '❌ حدث خطأ، يرجى المحاولة مرة أخرى.');
        } catch (e) {
            console.error('❌ خطأ في إرسال رسالة الخطأ:', e);
        }
    }
});

// دالة مشتركة لتفعيل البوت
async function enableBot(chatId, userId, commandName = 'enable') {
    try {
        const chatMember = await bot.getChatMember(chatId, userId);
        if (!['creator', 'administrator'].includes(chatMember.status)) {
            await bot.sendMessage(chatId, '⚠️ هذا الأمر متاح للمشرفين فقط.');
            return;
        }

        db.run(`UPDATE groups SET bot_enabled = 1 WHERE chat_id = ?`, [chatId], async (err) => {
            if (err) {
                await bot.sendMessage(chatId, '❌ حدث خطأ في تفعيل البوت.');
                console.error(`❌ خطأ في تفعيل البوت: ${err.message}`);
                console.error(`   المجموعة: ${chatId}`);
                return;
            }

            await bot.sendMessage(chatId, 
                '✅ *تم تفعيل البوت بنجاح*\nسأبدأ بنشر الأذكار حسب الجدولة المحددة.', 
                { parse_mode: 'Markdown' }
            );
            console.log(`✅ تم تفعيل البوت يدوياً في المجموعة: ${chatId} (الأمر: /${commandName})`);
            console.log(`   المستخدم: ${userId}`);
            console.log(`   📊 حالة البوت الآن: مفعّل ✓`);
        });

    } catch (error) {
        console.error(`❌ خطأ في /${commandName}:`, error);
        await bot.sendMessage(chatId, '❌ حدث خطأ، حاول مرة أخرى.');
    }
}

bot.onText(/\/enable/, async (msg) => {
    await enableBot(msg.chat.id, msg.from.id, 'enable');
});

// إضافة أمر /activate كبديل لـ /enable
bot.onText(/\/activate/, async (msg) => {
    await enableBot(msg.chat.id, msg.from.id, 'activate');
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
                console.error(`❌ خطأ في إيقاف البوت: ${err.message}`);
                console.error(`   المجموعة: ${chatId}`);
                return;
            }

            await bot.sendMessage(chatId, 
                '⏸️ *تم إيقاف البوت مؤقتاً*\nلن يتم نشر أي أذكار حتى إعادة التفعيل.', 
                { parse_mode: 'Markdown' }
            );
            console.log(`⏸️ تم إيقاف البوت في المجموعة: ${chatId}`);
            console.log(`   المستخدم: ${userId}`);
            console.log(`   📊 حالة البوت الآن: متوقف ✗`);
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
        `/activate - تفعيل البوت في المجموعة\n` +
        `/enable - تفعيل البوت في المجموعة\n` +
        `/disable - إيقاف البوت مؤقتاً\n` +
        `/status - عرض حالة البوت\n` +
        `/help - هذه الرسالة\n\n` +
        `*المميزات:*\n` +
        `• نشر أذكار تلقائي\n` +
        `• أقسام متعددة\n` +
        `• جدولة متقدمة (يومي/أسبوعي/شهري/سنوي)\n` +
        `• دعم الملفات (رفع مباشر أو روابط)\n` +
        `• تحكم سهل للمشرفين`;

    bot.sendMessage(msg.chat.id, helpMsg, { parse_mode: 'Markdown' });
});

// ========== واجهات API للوحة التحكم ==========
app.get('/api/stats', (req, res) => {
    const stats = {};
    
    const queries = [
        { key: 'categories', query: "SELECT COUNT(*) as count FROM categories WHERE is_active = 1" },
        { key: 'adkar', query: "SELECT COUNT(*) as count FROM adkar WHERE is_active = 1" },
        { key: 'groups', query: "SELECT COUNT(*) as count FROM groups WHERE bot_enabled = 1" },
        { key: 'today', query: "SELECT COUNT(*) as count FROM sent_logs WHERE date(sent_at) = date('now') AND status = 'success'" }
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
            res.json(categories || []);
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
            res.json(adkar || []);
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
            // تحويل JSON strings إلى arrays
            adkar.schedule_days = parseJSONArray(adkar.schedule_days);
            adkar.schedule_dates = parseJSONArray(adkar.schedule_dates);
            adkar.schedule_months = parseJSONArray(adkar.schedule_months);
            res.json(adkar);
        }
    });
});

app.post('/api/adkar', upload.fields([
    { name: 'audio_file', maxCount: 1 },
    { name: 'image_file', maxCount: 1 },
    { name: 'pdf_file', maxCount: 1 },
    { name: 'file', maxCount: 1 }
]), async (req, res) => {
    try {
        const {
            category_id,
            title,
            content,
            content_type = 'text',
            schedule_type = 'daily',
            schedule_days = '[]',
            schedule_dates = '[]',
            schedule_months = '[]',
            schedule_time,
            file_url,
            is_active = 1,
            priority = 1
        } = req.body;
        
        let file_path = null;
        let final_content_type = content_type;
        
        // تحميل من رابط إذا وجد
        if (file_url && file_url.startsWith('http')) {
            file_path = await downloadFileFromUrl(file_url, content_type);
        }
        
        // إذا لم يكن هناك رابط، تحقق من الملفات المرفوعة
        if (!file_path) {
            if (req.files?.audio_file) {
                file_path = `/uploads/audio/${req.files.audio_file[0].filename}`;
                final_content_type = 'audio';
            } else if (req.files?.image_file) {
                file_path = `/uploads/images/${req.files.image_file[0].filename}`;
                final_content_type = 'image';
            } else if (req.files?.pdf_file) {
                file_path = `/uploads/pdfs/${req.files.pdf_file[0].filename}`;
                final_content_type = 'pdf';
            } else if (req.files?.file) {
                const file = req.files.file[0];
                const mime = file.mimetype;
                
                if (mime.startsWith('audio/')) {
                    file_path = `/uploads/audio/${file.filename}`;
                    final_content_type = 'audio';
                } else if (mime.startsWith('image/')) {
                    file_path = `/uploads/images/${file.filename}`;
                    final_content_type = 'image';
                } else if (mime === 'application/pdf') {
                    file_path = `/uploads/pdfs/${file.filename}`;
                    final_content_type = 'pdf';
                } else {
                    file_path = `/uploads/temp/${file.filename}`;
                }
            }
        }
        
        db.run(`INSERT INTO adkar (
            category_id, title, content, content_type, file_path, file_url,
            schedule_type, schedule_days, schedule_dates, schedule_months, schedule_time, 
            is_active, priority
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                category_id || null, title, content, final_content_type, file_path, file_url || null,
                schedule_type, schedule_days, schedule_dates, schedule_months, schedule_time || '12:00',
                is_active, priority
            ],
            function(err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                } else {
                    const newAdkarId = this.lastID;
                    
                    // جدولة الذكر الجديد
                    db.get(`SELECT a.*, c.name as category_name FROM adkar a 
                           LEFT JOIN categories c ON a.category_id = c.id 
                           WHERE a.id = ?`, [newAdkarId], (err, adkar) => {
                        if (!err && adkar) {
                            scheduleAdkar(adkar);
                            console.log(`🆕 تمت إضافة وجدولة ذكر جديد: ${adkar.title} (ID: ${newAdkarId})`);
                        }
                    });
                    
                    res.json({ success: true, id: newAdkarId });
                }
            });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/adkar/:id', upload.fields([
    { name: 'audio_file', maxCount: 1 },
    { name: 'image_file', maxCount: 1 },
    { name: 'pdf_file', maxCount: 1 },
    { name: 'file', maxCount: 1 }
]), async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        let file_path = null;
        let content_type = updates.content_type;
        
        // تحميل من رابط إذا وجد
        if (updates.file_url && updates.file_url.startsWith('http')) {
            file_path = await downloadFileFromUrl(updates.file_url, content_type);
            if (file_path) {
                updates.file_path = file_path;
            }
        } else if (req.files) {
            // معالجة الملفات المرفوعة
            if (req.files.audio_file) {
                file_path = `/uploads/audio/${req.files.audio_file[0].filename}`;
                content_type = 'audio';
            } else if (req.files.image_file) {
                file_path = `/uploads/images/${req.files.image_file[0].filename}`;
                content_type = 'image';
            } else if (req.files.pdf_file) {
                file_path = `/uploads/pdfs/${req.files.pdf_file[0].filename}`;
                content_type = 'pdf';
            } else if (req.files.file) {
                const file = req.files.file[0];
                const mime = file.mimetype;
                
                if (mime.startsWith('audio/')) {
                    file_path = `/uploads/audio/${file.filename}`;
                    content_type = 'audio';
                } else if (mime.startsWith('image/')) {
                    file_path = `/uploads/images/${file.filename}`;
                    content_type = 'image';
                } else if (mime === 'application/pdf') {
                    file_path = `/uploads/pdfs/${file.filename}`;
                    content_type = 'pdf';
                } else {
                    file_path = `/uploads/temp/${file.filename}`;
                }
            }
            
            if (file_path) {
                updates.file_path = file_path;
                updates.content_type = content_type;
            }
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
                // إعادة جدولة الذكر المحدث
                // ملاحظة: scheduleAdkar تلغي المهمة القديمة تلقائياً قبل إنشاء مهمة جديدة
                db.get(`SELECT a.*, c.name as category_name FROM adkar a 
                       LEFT JOIN categories c ON a.category_id = c.id 
                       WHERE a.id = ?`, [id], (err, adkar) => {
                    if (!err && adkar) {
                        scheduleAdkar(adkar);
                        console.log(`🔄 تم تحديث وإعادة جدولة الذكر: ${adkar.title} (ID: ${id})`);
                    }
                });
                
                res.json({ success: true, changes: this.changes });
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/adkar/:id', (req, res) => {
    const { id } = req.params;
    
    // إلغاء جدولة الذكر المحذوف
    const jobKey = `adkar_${id}`;
    if (scheduledJobs.has(jobKey)) {
        scheduledJobs.get(jobKey).cancel();
        scheduledJobs.delete(jobKey);
        console.log(`🗑️ تم إلغاء جدولة الذكر المحذوف (ID: ${id})`);
    }
    
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
            res.json(groups || []);
        }
    });
});

// إرسال ذكر فوري لمجموعة محددة (للتجربة)
app.post('/api/test-send/:chatId/:adkarId', async (req, res) => {
    const { chatId, adkarId } = req.params;
    
    db.get(`SELECT a.*, c.name as category_name FROM adkar a 
            LEFT JOIN categories c ON a.category_id = c.id 
            WHERE a.id = ?`, [adkarId], async (err, adkar) => {
        if (err || !adkar) {
            res.status(404).json({ error: 'الذكر غير موجود' });
            return;
        }
        
        try {
            await sendAdkarToGroup(chatId, adkar);
            res.json({ success: true, message: 'تم الإرسال بنجاح' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
});

// ========== لوحة التحكم المتكاملة ==========
app.get('/admin', (req, res) => {
    res.send(`
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
            }
            
            .stat-card {
                background: white;
                border-radius: 15px;
                padding: 20px;
                margin-bottom: 20px;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
                border: none;
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
                font-size: 14px;
            }
            
            .day-btn.selected {
                background: var(--primary-color);
                color: white;
                border-color: var(--primary-color);
            }
            
            .date-selector {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
                margin: 10px 0;
            }
            
            .date-btn {
                width: 35px;
                height: 35px;
                border-radius: 5px;
                border: 1px solid #dee2e6;
                background: white;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 12px;
            }
            
            .date-btn.selected {
                background: var(--primary-color);
                color: white;
                border-color: var(--primary-color);
            }
            
            .month-selector {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
                margin: 10px 0;
            }
            
            .month-btn {
                padding: 8px 12px;
                border-radius: 5px;
                border: 1px solid #dee2e6;
                background: white;
                cursor: pointer;
                font-size: 13px;
                min-width: 80px;
                text-align: center;
            }
            
            .month-btn.selected {
                background: var(--primary-color);
                color: white;
                border-color: var(--primary-color);
            }
            
            .file-preview {
                max-width: 200px;
                max-height: 200px;
                border-radius: 10px;
                margin: 10px 0;
                border: 2px dashed #dee2e6;
                padding: 10px;
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
                    <a class="nav-link" href="#" onclick="showSection('test')">
                        <i class="bi bi-send me-2"></i>اختبار النشر
                    </a>
                </li>
            </ul>
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
                            <h5><i class="bi bi-info-circle"></i> حالة النظام</h5>
                            <div class="mt-3">
                                <p id="botStatus"><i class="bi bi-check-circle text-success"></i> البوت يعمل بشكل طبيعي</p>
                                <p><i class="bi bi-check-circle text-success"></i> قاعدة البيانات متصلة</p>
                                <p><i class="bi bi-clock"></i> الوقت الحالي: <span id="currentTime"></span></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- إدارة الأقسام -->
            <div id="categoriesSection" style="display: none;">
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
            <div id="adkarSection" style="display: none;">
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
                                <th>الجدولة</th>
                                <th>الحالة</th>
                                <th width="120">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody id="adkarTable">
                            <!-- سيتم ملؤها -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- المجموعات -->
            <div id="groupsSection" style="display: none;">
                <h2 class="mb-4"><i class="bi bi-people"></i> المجموعات النشطة</h2>
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead class="table-light">
                            <tr>
                                <th>المجموعة</th>
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

            <!-- اختبار النشر -->
            <div id="testSection" style="display: none;">
                <h2 class="mb-4"><i class="bi bi-send"></i> اختبار النشر الفوري</h2>
                <div class="row">
                    <div class="col-md-6">
                        <div class="stat-card">
                            <h5>اختبار إرسال ذكر</h5>
                            <div class="mb-3">
                                <label class="form-label">اختر المجموعة</label>
                                <select class="form-select" id="testChatId">
                                    <option value="">اختر مجموعة</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">اختر الذكر</label>
                                <select class="form-select" id="testAdkarId">
                                    <option value="">اختر ذكر</option>
                                </select>
                            </div>
                            <button class="btn btn-primary" onclick="testSend()">
                                <i class="bi bi-send"></i> إرسال تجريبي
                            </button>
                            <div id="testResult" class="mt-3"></div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="stat-card">
                            <h5>تعليمات الاختبار</h5>
                            <ul>
                                <li>اختر مجموعة من القائمة</li>
                                <li>اختر ذكر من القائمة</li>
                                <li>اضغط على "إرسال تجريبي"</li>
                                <li>سيتم إرسال الذكر فوراً للمجموعة</li>
                                <li>يمكنك استخدام هذه الميزة لاختبار النشر</li>
                            </ul>
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
                                            <option value="💬">💬 حديث</option>
                                            <option value="🕋">🕋 كعبة</option>
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
            <div class="modal-dialog modal-lg">
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
                                                <select class="form-select" id="adkarContentType" onchange="toggleFileInputs()">
                                                    <option value="text">نص فقط</option>
                                                    <option value="audio">صوت</option>
                                                    <option value="image">صورة</option>
                                                    <option value="pdf">ملف PDF</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="mb-3" id="fileInputSection" style="display: none;">
                                        <label class="form-label">رفع ملف مباشر</label>
                                        <input type="file" class="form-control" id="adkarFile" accept="audio/*,image/*,.pdf">
                                        <small class="text-muted">يمكنك رفع ملف مباشرة (MP3, JPG, PNG, PDF)</small>
                                    </div>
                                    
                                    <div class="mb-3" id="urlInputSection" style="display: none;">
                                        <label class="form-label">أو رابط مباشر للملف</label>
                                        <input type="url" class="form-control" id="adkarFileUrl" placeholder="https://example.com/file.mp3">
                                        <small class="text-muted">أدخل رابط مباشر للملف (MP3, JPG, PNG, PDF)</small>
                                    </div>
                                    
                                    <div id="filePreview" style="display: none;">
                                        <h6>معاينة الملف:</h6>
                                        <div id="previewContainer"></div>
                                    </div>
                                </div>
                                
                                <div class="col-md-4">
                                    <div class="card">
                                        <div class="card-body">
                                            <h6>إعدادات النشر</h6>
                                            
                                            <div class="mb-3">
                                                <label class="form-label">نوع الجدولة</label>
                                                <select class="form-select" id="adkarScheduleType" onchange="toggleScheduleFields()">
                                                    <option value="daily">يومي</option>
                                                    <option value="weekly">أسبوعي</option>
                                                    <option value="monthly">شهري</option>
                                                    <option value="yearly">سنوي</option>
                                                </select>
                                            </div>
                                            
                                            <div class="mb-3" id="weeklySection" style="display: none;">
                                                <label class="form-label">أيام الأسبوع</label>
                                                <div class="day-selector">
                                                    <button type="button" class="day-btn" data-day="0" onclick="toggleDay(this)">أحد</button>
                                                    <button type="button" class="day-btn" data-day="1" onclick="toggleDay(this)">إثنين</button>
                                                    <button type="button" class="day-btn" data-day="2" onclick="toggleDay(this)">ثلاثاء</button>
                                                    <button type="button" class="day-btn" data-day="3" onclick="toggleDay(this)">أربعاء</button>
                                                    <button type="button" class="day-btn" data-day="4" onclick="toggleDay(this)">خميس</button>
                                                    <button type="button" class="day-btn" data-day="5" onclick="toggleDay(this)">جمعة</button>
                                                    <button type="button" class="day-btn" data-day="6" onclick="toggleDay(this)">سبت</button>
                                                </div>
                                                <input type="hidden" id="selectedDays" value="[]">
                                            </div>
                                            
                                            <div class="mb-3" id="monthlySection" style="display: none;">
                                                <label class="form-label">أيام الشهر</label>
                                                <div class="date-selector" id="datesSelector">
                                                    <!-- سيتم ملؤها بـ 1-31 -->
                                                </div>
                                                <input type="hidden" id="selectedDates" value="[]">
                                            </div>
                                            
                                            <div class="mb-3" id="yearlySection" style="display: none;">
                                                <label class="form-label">أشهر السنة</label>
                                                <div class="month-selector" id="monthsSelector">
                                                    <!-- سيتم ملؤها بأشهر السنة -->
                                                </div>
                                                <input type="hidden" id="selectedMonths" value="[]">
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
            let currentCategoryId = null;
            let currentAdkarId = null;
            let categories = [];
            
            // تحديث الوقت
            function updateTime() {
                const now = new Date();
                const timeString = now.toLocaleTimeString('ar-SA');
                const dateString = now.toLocaleDateString('ar-SA');
                document.getElementById('currentTime').textContent = timeString + ' ' + dateString;
            }
            
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
                ['dashboard', 'categories', 'adkar', 'groups', 'test'].forEach(sec => {
                    document.getElementById(sec + 'Section').style.display = 'none';
                });
                
                // إزالة النشط من جميع الروابط
                document.querySelectorAll('.nav-link').forEach(link => {
                    link.classList.remove('active');
                });
                
                // إظهار القسم المطلوب
                document.getElementById(section + 'Section').style.display = 'block';
                
                // تفعيل الرابط
                const links = document.querySelectorAll('.nav-link');
                for (let link of links) {
                    if (link.getAttribute('onclick') && link.getAttribute('onclick').includes(section)) {
                        link.classList.add('active');
                        break;
                    }
                }
                
                // تحميل البيانات حسب القسم
                if (section === 'categories') {
                    loadCategories();
                } else if (section === 'adkar') {
                    loadCategoriesForSelect();
                    loadAdkar();
                } else if (section === 'groups') {
                    loadGroups();
                } else if (section === 'test') {
                    loadTestData();
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
                        row.innerHTML = '<td>' + category.id + '</td>' +
                            '<td>' +
                            '<span class="category-badge" style="background: ' + category.color + '20; color: ' + category.color + ';">' +
                            category.icon + ' ' + category.name +
                            '</span>' +
                            '</td>' +
                            '<td>' + (category.description || '-') + '</td>' +
                            '<td>' + category.sort_order + '</td>' +
                            '<td>' +
                            '<span class="badge ' + (category.is_active ? 'bg-success' : 'bg-secondary') + '">' +
                            (category.is_active ? 'نشط' : 'غير نشط') +
                            '</span>' +
                            '</td>' +
                            '<td>' +
                            '<button class="btn btn-sm btn-outline-primary action-btn" onclick="editCategory(' + category.id + ')" title="تعديل">' +
                            '<i class="bi bi-pencil"></i>' +
                            '</button>' +
                            '<button class="btn btn-sm btn-outline-danger action-btn" onclick="deleteCategory(' + category.id + ')" title="حذف">' +
                            '<i class="bi bi-trash"></i>' +
                            '</button>' +
                            '</td>';
                        tbody.appendChild(row);
                    });
                } catch (error) {
                    console.error('خطأ في تحميل الأقسام:', error);
                    alert('خطأ في تحميل الأقسام');
                }
            }
            
            // تحميل الأقسام للقوائم المنسدلة
            async function loadCategoriesForSelect() {
                try {
                    const response = await fetch('/api/categories');
                    categories = await response.json();
                    
                    const filterSelect = document.getElementById('categoryFilter');
                    const adkarSelect = document.getElementById('adkarCategory');
                    const testAdkarSelect = document.getElementById('testAdkarId');
                    
                    filterSelect.innerHTML = '<option value="">جميع الأقسام</option>';
                    adkarSelect.innerHTML = '<option value="">اختر قسم</option>';
                    
                    categories.forEach(cat => {
                        filterSelect.innerHTML += '<option value="' + cat.id + '">' + cat.name + '</option>';
                        adkarSelect.innerHTML += '<option value="' + cat.id + '">' + cat.name + '</option>';
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
                        url += '?category_id=' + categoryFilter;
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
                        
                        // تحديد نص الجدولة
                        let scheduleText = 'يومي';
                        const daysMap = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
                        const monthsMap = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
                        
                        if (item.schedule_type === 'weekly') {
                            try {
                                const days = JSON.parse(item.schedule_days || '[]');
                                if (days.length === 7) {
                                    scheduleText = 'يومي';
                                } else if (days.length > 0) {
                                    scheduleText = days.map(d => daysMap[d]).join('، ');
                                }
                            } catch {}
                        } else if (item.schedule_type === 'monthly') {
                            try {
                                const dates = JSON.parse(item.schedule_dates || '[]');
                                if (dates.length > 0) {
                                    scheduleText = 'يوم ' + dates.join('، ') + ' من كل شهر';
                                }
                            } catch {}
                        } else if (item.schedule_type === 'yearly') {
                            try {
                                const months = JSON.parse(item.schedule_months || '[]');
                                if (months.length > 0) {
                                    scheduleText = months.map(m => monthsMap[m-1]).join('، ');
                                }
                            } catch {}
                        }
                        
                        const row = document.createElement('tr');
                        row.innerHTML = '<td>' +
                            '<strong>' + item.title + '</strong>' +
                            '<br>' +
                            '<small class="text-muted">' + (item.content.substring(0, 50) || '') + '...</small>' +
                            '</td>' +
                            '<td>' +
                            '<span class="badge bg-light text-dark">' +
                            (item.category_icon || '📖') + ' ' + (item.category_name || 'عام') +
                            '</span>' +
                            '</td>' +
                            '<td>' + typeIcon + '</td>' +
                            '<td>' + item.schedule_time + '</td>' +
                            '<td><small>' + scheduleText + '</small></td>' +
                            '<td>' +
                            '<span class="badge ' + (item.is_active ? 'bg-success' : 'bg-secondary') + '">' +
                            (item.is_active ? 'نشط' : 'غير نشط') +
                            '</span>' +
                            '</td>' +
                            '<td>' +
                            '<button class="btn btn-sm btn-outline-primary action-btn" onclick="editAdkar(' + item.id + ')" title="تعديل">' +
                            '<i class="bi bi-pencil"></i>' +
                            '</button>' +
                            '<button class="btn btn-sm btn-outline-danger action-btn" onclick="deleteAdkar(' + item.id + ')" title="حذف">' +
                            '<i class="bi bi-trash"></i>' +
                            '</button>' +
                            '<button class="btn btn-sm btn-outline-success action-btn" onclick="testSingleAdkar(' + item.id + ')" title="اختبار">' +
                            '<i class="bi bi-send"></i>' +
                            '</button>' +
                            '</td>';
                        tbody.appendChild(row);
                    });
                } catch (error) {
                    console.error('خطأ في تحميل الأذكار:', error);
                    alert('خطأ في تحميل الأذكار');
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
                        row.innerHTML = '<td>' +
                            '<strong>' + (group.title || 'مجموعة') + '</strong>' +
                            '<br>' +
                            '<small class="text-muted">ID: ' + group.chat_id + '</small>' +
                            '</td>' +
                            '<td>' +
                            '<span class="badge ' + (group.bot_enabled ? 'bg-success' : 'bg-secondary') + '">' +
                            (group.bot_enabled ? 'نشط' : 'متوقف') +
                            '</span>' +
                            '</td>' +
                            '<td>' + new Date(group.created_at).toLocaleDateString('ar-SA') + '</td>' +
                            '<td>' +
                            '<button class="btn btn-sm btn-outline-info" onclick="testGroup(' + group.chat_id + ')" title="اختبار النشر">' +
                            '<i class="bi bi-send"></i>' +
                            '</button>' +
                            '</td>';
                        tbody.appendChild(row);
                    });
                } catch (error) {
                    console.error('خطأ في تحميل المجموعات:', error);
                }
            }
            
            // تحميل بيانات الاختبار
            async function loadTestData() {
                try {
                    // تحميل المجموعات
                    const groupsRes = await fetch('/api/groups');
                    const groups = await groupsRes.json();
                    
                    const chatSelect = document.getElementById('testChatId');
                    chatSelect.innerHTML = '<option value="">اختر مجموعة</option>';
                    groups.forEach(group => {
                        chatSelect.innerHTML += '<option value="' + group.chat_id + '">' + (group.title || group.chat_id) + '</option>';
                    });
                    
                    // تحميل الأذكار
                    const adkarRes = await fetch('/api/adkar');
                    const adkarList = await adkarRes.json();
                    
                    const adkarSelect = document.getElementById('testAdkarId');
                    adkarSelect.innerHTML = '<option value="">اختر ذكر</option>';
                    adkarList.forEach(item => {
                        adkarSelect.innerHTML += '<option value="' + item.id + '">' + item.title + '</option>';
                    });
                } catch (error) {
                    console.error('خطأ في تحميل بيانات الاختبار:', error);
                }
            }
            
            // إظهار مودال القسم
            function showCategoryModal(id = null) {
                currentCategoryId = id;
                const modal = new bootstrap.Modal(document.getElementById('categoryModal'));
                
                if (id) {
                    document.getElementById('categoryModalTitle').textContent = 'تعديل القسم';
                    fetch('/api/categories/' + id)
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
                            alert('خطأ في تحميل بيانات القسم');
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
                const url = id ? '/api/categories/' + id : '/api/categories';
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
                        alert(id ? 'تم تعديل القسم بنجاح' : 'تم إضافة القسم بنجاح');
                        loadCategories();
                        loadCategoriesForSelect();
                    } else {
                        alert(data.error || 'حدث خطأ في الحفظ');
                    }
                } catch (error) {
                    console.error('خطأ في حفظ القسم:', error);
                    alert('حدث خطأ في الحفظ');
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
                        const response = await fetch('/api/categories/' + id, {
                            method: 'DELETE'
                        });
                        
                        const data = await response.json();
                        
                        if (response.ok) {
                            alert('تم حذف القسم بنجاح');
                            loadCategories();
                            loadCategoriesForSelect();
                            loadAdkar();
                        } else {
                            alert(data.error || 'حدث خطأ في الحذف');
                        }
                    } catch (error) {
                        console.error('خطأ في حذف القسم:', error);
                        alert('حدث خطأ في الحذف');
                    }
                }
            }
            
            // إعداد اختيار الأيام والتواريخ
            function initDateSelectors() {
                // أيام الشهر 1-31
                const datesContainer = document.getElementById('datesSelector');
                datesContainer.innerHTML = '';
                for (let i = 1; i <= 31; i++) {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'date-btn';
                    btn.textContent = i;
                    btn.dataset.date = i;
                    btn.onclick = function() { toggleDate(this); };
                    datesContainer.appendChild(btn);
                }
                
                // أشهر السنة
                const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
                               'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
                const monthsContainer = document.getElementById('monthsSelector');
                monthsContainer.innerHTML = '';
                months.forEach((month, index) => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'month-btn';
                    btn.textContent = month;
                    btn.dataset.month = index + 1;
                    btn.onclick = function() { toggleMonth(this); };
                    monthsContainer.appendChild(btn);
                });
            }
            
            // إظهار مودال الذكر
            function showAdkarModal(id = null) {
                currentAdkarId = id;
                const modal = new bootstrap.Modal(document.getElementById('adkarModal'));
                
                // تهيئة اختيارات التاريخ
                initDateSelectors();
                
                if (id) {
                    document.getElementById('adkarModalTitle').textContent = 'تعديل ذكر';
                    fetch('/api/adkar/' + id)
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
                            document.getElementById('adkarFileUrl').value = adkar.file_url || '';
                            
                            // تعبئة أيام الأسبوع
                            const days = adkar.schedule_days || [];
                            document.querySelectorAll('.day-btn').forEach(btn => {
                                const dayNum = parseInt(btn.dataset.day);
                                if (days.includes(dayNum)) {
                                    btn.classList.add('selected');
                                } else {
                                    btn.classList.remove('selected');
                                }
                            });
                            document.getElementById('selectedDays').value = JSON.stringify(days);
                            
                            // تعبئة أيام الشهر
                            const dates = adkar.schedule_dates || [];
                            document.querySelectorAll('.date-btn').forEach(btn => {
                                const dateNum = parseInt(btn.dataset.date);
                                if (dates.includes(dateNum)) {
                                    btn.classList.add('selected');
                                } else {
                                    btn.classList.remove('selected');
                                }
                            });
                            document.getElementById('selectedDates').value = JSON.stringify(dates);
                            
                            // تعبئة أشهر السنة
                            const months = adkar.schedule_months || [];
                            document.querySelectorAll('.month-btn').forEach(btn => {
                                const monthNum = parseInt(btn.dataset.month);
                                if (months.includes(monthNum)) {
                                    btn.classList.add('selected');
                                } else {
                                    btn.classList.remove('selected');
                                }
                            });
                            document.getElementById('selectedMonths').value = JSON.stringify(months);
                            
                            toggleFileInputs();
                            toggleScheduleFields();
                        })
                        .catch(error => {
                            console.error('خطأ في تحميل بيانات الذكر:', error);
                            alert('خطأ في تحميل بيانات الذكر');
                        });
                } else {
                    document.getElementById('adkarModalTitle').textContent = 'إضافة ذكر جديد';
                    document.getElementById('adkarForm').reset();
                    document.getElementById('adkarId').value = '';
                    document.getElementById('adkarTime').value = '12:00';
                    document.getElementById('adkarPriority').value = '1';
                    document.getElementById('adkarActive').value = '1';
                    document.getElementById('adkarFileUrl').value = '';
                    
                    // إعادة تعيين جميع الأزرار
                    document.querySelectorAll('.day-btn, .date-btn, .month-btn').forEach(btn => {
                        btn.classList.remove('selected');
                    });
                    document.getElementById('selectedDays').value = '[]';
                    document.getElementById('selectedDates').value = '[]';
                    document.getElementById('selectedMonths').value = '[]';
                    
                    toggleFileInputs();
                    toggleScheduleFields();
                }
                
                modal.show();
            }
            
            // تبديل عرض حقول الملفات
            function toggleFileInputs() {
                const contentType = document.getElementById('adkarContentType').value;
                const fileSection = document.getElementById('fileInputSection');
                const urlSection = document.getElementById('urlInputSection');
                const previewSection = document.getElementById('filePreview');
                
                if (contentType === 'text') {
                    fileSection.style.display = 'none';
                    urlSection.style.display = 'none';
                    previewSection.style.display = 'none';
                } else {
                    fileSection.style.display = 'block';
                    urlSection.style.display = 'block';
                    
                    // تحديث قبول الملفات حسب النوع
                    const fileInput = document.getElementById('adkarFile');
                    if (contentType === 'audio') {
                        fileInput.accept = 'audio/*';
                    } else if (contentType === 'image') {
                        fileInput.accept = 'image/*';
                    } else if (contentType === 'pdf') {
                        fileInput.accept = '.pdf';
                    }
                }
            }
            
            // تبديل عرض حقول الجدولة
            function toggleScheduleFields() {
                const scheduleType = document.getElementById('adkarScheduleType').value;
                const weeklySection = document.getElementById('weeklySection');
                const monthlySection = document.getElementById('monthlySection');
                const yearlySection = document.getElementById('yearlySection');
                
                weeklySection.style.display = scheduleType === 'weekly' ? 'block' : 'none';
                monthlySection.style.display = scheduleType === 'monthly' ? 'block' : 'none';
                yearlySection.style.display = scheduleType === 'yearly' ? 'block' : 'none';
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
            
            // تبديل اختيار التاريخ
            function toggleDate(element) {
                element.classList.toggle('selected');
                
                const dates = [];
                document.querySelectorAll('.date-btn.selected').forEach(btn => {
                    dates.push(parseInt(btn.dataset.date));
                });
                
                document.getElementById('selectedDates').value = JSON.stringify(dates);
            }
            
            // تبديل اختيار الشهر
            function toggleMonth(element) {
                element.classList.toggle('selected');
                
                const months = [];
                document.querySelectorAll('.month-btn.selected').forEach(btn => {
                    months.push(parseInt(btn.dataset.month));
                });
                
                document.getElementById('selectedMonths').value = JSON.stringify(months);
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
                formData.append('schedule_dates', document.getElementById('selectedDates').value);
                formData.append('schedule_months', document.getElementById('selectedMonths').value);
                formData.append('schedule_time', document.getElementById('adkarTime').value);
                formData.append('file_url', document.getElementById('adkarFileUrl').value);
                formData.append('priority', document.getElementById('adkarPriority').value);
                formData.append('is_active', document.getElementById('adkarActive').value);
                
                // إضافة الملف إذا تم اختياره
                const fileInput = document.getElementById('adkarFile');
                if (fileInput.files.length > 0) {
                    formData.append('file', fileInput.files[0]);
                }
                
                const url = id ? '/api/adkar/' + id : '/api/adkar';
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
                        alert(id ? 'تم تعديل الذكر بنجاح' : 'تم إضافة الذكر بنجاح');
                        loadAdkar();
                    } else {
                        alert(data.error || 'حدث خطأ في الحفظ');
                    }
                } catch (error) {
                    console.error('خطأ في حفظ الذكر:', error);
                    alert('حدث خطأ في الحفظ: ' + error.message);
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
                        const response = await fetch('/api/adkar/' + id, {
                            method: 'DELETE'
                        });
                        
                        const data = await response.json();
                        
                        if (response.ok) {
                            alert('تم حذف الذكر بنجاح');
                            loadAdkar();
                        } else {
                            alert(data.error || 'حدث خطأ في الحذف');
                        }
                    } catch (error) {
                        console.error('خطأ في حذف الذكر:', error);
                        alert('حدث خطأ في الحذف');
                    }
                }
            }
            
            // اختبار ذكر واحد
            async function testSingleAdkar(adkarId) {
                if (confirm('اختر المجموعة التي تريد إرسال الذكر لها')) {
                    const chatId = prompt('أدخل معرف المجموعة (Chat ID):');
                    if (chatId) {
                        try {
                            const response = await fetch('/api/test-send/' + chatId + '/' + adkarId, {
                                method: 'POST'
                            });
                            
                            const data = await response.json();
                            if (response.ok) {
                                alert('تم إرسال الذكر بنجاح');
                            } else {
                                alert('خطأ: ' + (data.error || 'فشل الإرسال'));
                            }
                        } catch (error) {
                            alert('حدث خطأ: ' + error.message);
                        }
                    }
                }
            }
            
            // اختبار مجموعة
            function testGroup(chatId) {
                showSection('test');
                document.getElementById('testChatId').value = chatId;
            }
            
            // اختبار الإرسال
            async function testSend() {
                const chatId = document.getElementById('testChatId').value;
                const adkarId = document.getElementById('testAdkarId').value;
                
                if (!chatId || !adkarId) {
                    document.getElementById('testResult').innerHTML = 
                        '<div class="alert alert-warning">يجب اختيار المجموعة والذكر</div>';
                    return;
                }
                
                document.getElementById('testResult').innerHTML = 
                    '<div class="alert alert-info">جارٍ الإرسال...</div>';
                
                try {
                    const response = await fetch('/api/test-send/' + chatId + '/' + adkarId, {
                        method: 'POST'
                    });
                    
                    const data = await response.json();
                    if (response.ok) {
                        document.getElementById('testResult').innerHTML = 
                            '<div class="alert alert-success">تم إرسال الذكر بنجاح!</div>';
                    } else {
                        document.getElementById('testResult').innerHTML = 
                            '<div class="alert alert-danger">خطأ: ' + (data.error || 'فشل الإرسال') + '</div>';
                    }
                } catch (error) {
                    document.getElementById('testResult').innerHTML = 
                        '<div class="alert alert-danger">حدث خطأ: ' + error.message + '</div>';
                }
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
                
                // تحديث حالة البوت
                setInterval(() => {
                    document.getElementById('botStatus').innerHTML = 
                        '<i class="bi bi-check-circle text-success"></i> البوت يعمل بشكل طبيعي';
                }, 60000);
            });
        </script>
    </body>
    </html>
    `);
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