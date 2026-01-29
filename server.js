require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const moment = require('moment');
const fs = require('fs');
const path = require('path');

// ========== إعدادات التطبيق ==========
const app = express();
const PORT = process.env.PORT || 3000;

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
            family: 4 // استخدام IPv4 فقط
        }
    }
});

console.log('🤖 بوت التلجرام جاهز...');

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
    db.run(`CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT UNIQUE NOT NULL,
        title TEXT,
        admin_id TEXT,
        bot_enabled INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS adkar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT,
        time_to_send TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // إضافة أذكار افتراضية
    db.get("SELECT COUNT(*) as count FROM adkar", (err, row) => {
        if (row.count === 0) {
            const defaultAdkar = [
                ['أذكار الصباح', 'سبحان الله وبحمده سبحان الله العظيم', 'morning', '06:00'],
                ['أذكار المساء', 'لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير', 'evening', '18:00'],
                ['ذكر عشوائي', 'سبحان الله، والحمد لله، ولا إله إلا الله، والله أكبر', 'general', '12:00']
            ];
            
            const stmt = db.prepare("INSERT INTO adkar (title, content, category, time_to_send) VALUES (?, ?, ?, ?)");
            defaultAdkar.forEach(adkar => {
                stmt.run(adkar);
            });
            stmt.finalize();
            console.log('✅ تم إضافة الأذكار الافتراضية');
        }
    });
});

// ========== وظائف مساعدة ==========
function saveGroup(chatId, title, adminId) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT OR REPLACE INTO groups (chat_id, title, admin_id) VALUES (?, ?, ?)`,
            [chatId, title, adminId],
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            }
        );
    });
}

function isGroupRegistered(chatId) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM groups WHERE chat_id = ?", [chatId], (err, row) => {
            if (err) reject(err);
            else resolve(!!row);
        });
    });
}

// ========== معالجة أوامر البوت ==========
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    
    try {
        if (chatType === 'group' || chatType === 'supergroup') {
            // إضافة للمجموعة
            const title = msg.chat.title;
            const adminId = msg.from.id;
            
            await saveGroup(chatId, title, adminId);
            
            const welcomeMsg = `🕌 *مرحباً بكم في ${title}* 🕌\n\n` +
                `تم تفعيل بوت الأذكار بنجاح!\n\n` +
                `*الأوامر المتاحة:*\n` +
                `/enable - تفعيل البوت\n` +
                `/disable - إيقاف البوت\n` +
                `/status - حالة البوت\n` +
                `/help - المساعدة\n\n` +
                `سيقوم البوت بنشر الأذكار تلقائياً حسب الجدولة المحددة.`;
            
            await bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'Markdown' });
            
            // إرسال أول ذكر
            setTimeout(async () => {
                const firstAdkar = "🕌 *سبحان الله وبحمده سبحان الله العظيم*\n\n" +
                    "من قالها في يوم مائة مرة حطت خطاياه وإن كانت مثل زبد البحر.\n\n" +
                    "📅 " + moment().format('YYYY/MM/DD');
                
                await bot.sendMessage(chatId, firstAdkar, { parse_mode: 'Markdown' });
            }, 1000);
            
        } else if (chatType === 'private') {
            // محادثة خاصة
            const helpMsg = `مرحباً بك! 👋\n\n` +
                `أنا بوت نشر الأذكار التلقائي.\n\n` +
                `*للاستخدام:*\n` +
                `1. أضفني لمجموعتك\n` +
                `2. سأرسل رسالة ترحيب\n` +
                `3. سأنشر الأذكار تلقائياً\n\n` +
                `*الأوامر في المجموعة:*\n` +
                `/enable - تفعيل البوت\n` +
                `/disable - إيقاف البوت\n` +
                `/status - حالة البوت\n` +
                `/help - المساعدة`;
            
            await bot.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown' });
        }
    } catch (error) {
        console.error('❌ خطأ في معالجة /start:', error);
    }
});

bot.onText(/\/enable/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
        db.run("UPDATE groups SET bot_enabled = 1 WHERE chat_id = ?", [chatId], async (err) => {
            if (err) {
                await bot.sendMessage(chatId, '❌ حدث خطأ في التفعيل.');
                return;
            }
            
            await bot.sendMessage(chatId, '✅ *تم تفعيل البوت*\nسيبدأ نشر الأذكار تلقائياً.', {
                parse_mode: 'Markdown'
            });
        });
    } catch (error) {
        console.error('❌ خطأ في /enable:', error);
    }
});

bot.onText(/\/disable/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
        db.run("UPDATE groups SET bot_enabled = 0 WHERE chat_id = ?", [chatId], async (err) => {
            if (err) {
                await bot.sendMessage(chatId, '❌ حدث خطأ في الإيقاف.');
                return;
            }
            
            await bot.sendMessage(chatId, '⏸️ *تم إيقاف البوت*\nلن يتم نشر أذكار حتى إعادة التفعيل.', {
                parse_mode: 'Markdown'
            });
        });
    } catch (error) {
        console.error('❌ خطأ في /disable:', error);
    }
});

bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
        db.get("SELECT bot_enabled, created_at FROM groups WHERE chat_id = ?", [chatId], async (err, group) => {
            if (err || !group) {
                await bot.sendMessage(chatId, '❌ المجموعة غير مسجلة.');
                return;
            }
            
            const status = group.bot_enabled === 1 ? '🟢 نشط' : '🔴 متوقف';
            const statusMsg = `*حالة البوت:* ${status}\n` +
                `*تاريخ الإضافة:* ${moment(group.created_at).format('YYYY/MM/DD')}\n` +
                `*الأوامر:*\n` +
                (group.bot_enabled === 1 ? '❌ /disable - لإيقاف البوت' : '✅ /enable - لتفعيل البوت');
            
            await bot.sendMessage(chatId, statusMsg, { parse_mode: 'Markdown' });
        });
    } catch (error) {
        console.error('❌ خطأ في /status:', error);
    }
});

bot.onText(/\/help/, (msg) => {
    const helpMsg = `*مركز المساعدة*\n\n` +
        `*الأوامر:*\n` +
        `/enable - تفعيل البوت\n` +
        `/disable - إيقاف البوت\n` +
        `/status - حالة البوت\n` +
        `/help - هذه الرسالة\n\n` +
        `*المميزات:*\n` +
        `• نشر أذكار تلقائي\n` +
        `• أذكار صباح ومساء\n` +
        `• تحكم سهل للمشرفين\n` +
        `• مجاني بالكامل`;
    
    bot.sendMessage(msg.chat.id, helpMsg, { parse_mode: 'Markdown' });
});

// ========== جدولة النشر ==========
setInterval(async () => {
    const now = moment();
    const currentTime = now.format('HH:mm');
    
    // جلب الأذكار المطلوبة لهذا الوقت
    db.all("SELECT * FROM adkar WHERE time_to_send = ? AND is_active = 1", [currentTime], async (err, adkarList) => {
        if (err || !adkarList.length) return;
        
        // جلب المجموعات المفعلة
        db.all("SELECT chat_id FROM groups WHERE bot_enabled = 1", async (err, groups) => {
            if (err || !groups.length) return;
            
            console.log(`🕒 نشر ${adkarList.length} ذكر في ${groups.length} مجموعة`);
            
            for (const adkar of adkarList) {
                for (const group of groups) {
                    try {
                        const message = `🕌 *${adkar.title}*\n\n${adkar.content}\n\n` +
                                       `📅 ${now.format('YYYY/MM/DD')} | 🕒 ${currentTime}`;
                        
                        await bot.sendMessage(group.chat_id, message, { parse_mode: 'Markdown' });
                        
                        // تأخير بسيط بين الإرساليات
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                    } catch (error) {
                        console.error(`❌ خطأ في الإرسال لـ ${group.chat_id}:`, error.message);
                    }
                }
            }
        });
    });
}, 60000); // التحقق كل دقيقة

// ========== واجهة ويب بسيطة ==========
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>بوت الأذكار التلقائي</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    text-align: center; 
                    padding: 50px; 
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    min-height: 100vh;
                    margin: 0;
                }
                .container { 
                    background: rgba(255,255,255,0.1); 
                    padding: 40px; 
                    border-radius: 20px;
                    backdrop-filter: blur(10px);
                    max-width: 600px;
                    margin: auto;
                }
                h1 { margin-bottom: 30px; }
                .btn {
                    display: inline-block;
                    padding: 12px 30px;
                    margin: 10px;
                    background: white;
                    color: #764ba2;
                    text-decoration: none;
                    border-radius: 50px;
                    font-weight: bold;
                    transition: 0.3s;
                }
                .btn:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 5px 20px rgba(0,0,0,0.2);
                }
                .stats {
                    display: flex;
                    justify-content: center;
                    gap: 20px;
                    margin: 30px 0;
                }
                .stat-box {
                    background: rgba(255,255,255,0.2);
                    padding: 20px;
                    border-radius: 10px;
                    min-width: 120px;
                }
                code {
                    background: rgba(0,0,0,0.2);
                    padding: 5px 10px;
                    border-radius: 5px;
                    display: block;
                    margin: 20px 0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🕌 بوت نشر الأذكار التلقائي</h1>
                <p>بوت مجاني لنشر الأذكار تلقائياً في مجموعات تلجرام</p>
                
                <div class="stats">
                    <div class="stat-box">
                        <h3 id="groupsCount">0</h3>
                        <p>مجموعة</p>
                    </div>
                    <div class="stat-box">
                        <h3 id="adkarCount">0</h3>
                        <p>ذكر</p>
                    </div>
                </div>
                
                <div>
                    <a href="#" onclick="alert('البوت: @' + botUsername)" class="btn">🤖 إضافة البوت</a>
                    <a href="/admin" class="btn">👑 لوحة التحكم</a>
                </div>
                
                <div style="text-align: right; margin-top: 40px; background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px;">
                    <h3>كيفية الاستخدام:</h3>
                    <ol style="text-align: right;">
                        <li>أضف البوت لمجموعتك على تلجرام</li>
                        <li>اكتب /start في المجموعة</li>
                        <li>استخدم /enable لتفعيل البوت</li>
                        <li>البوت سينشر الأذكار تلقائياً</li>
                    </ol>
                </div>
            </div>
            
            <script>
                async function loadStats() {
                    try {
                        const response = await fetch('/api/stats');
                        const data = await response.json();
                        
                        document.getElementById('groupsCount').textContent = data.groups;
                        document.getElementById('adkarCount').textContent = data.adkar;
                    } catch (error) {
                        console.error('خطأ:', error);
                    }
                }
                
                loadStats();
                setInterval(loadStats, 10000);
                
                // الحصول على اسم البوت
                let botUsername = 'your_bot_username';
                fetch('/api/bot-info')
                    .then(r => r.json())
                    .then(data => {
                        if (data.username) {
                            botUsername = data.username;
                        }
                    });
            </script>
        </body>
        </html>
    `);
});

// ========== API للوحة التحكم ==========
app.get('/api/stats', (req, res) => {
    db.get("SELECT COUNT(*) as groups FROM groups", (err, groups) => {
        db.get("SELECT COUNT(*) as adkar FROM adkar WHERE is_active = 1", (err, adkar) => {
            res.json({
                groups: groups.groups || 0,
                adkar: adkar.adkar || 0
            });
        });
    });
});

app.get('/api/groups', (req, res) => {
    db.all("SELECT * FROM groups ORDER BY created_at DESC", (err, groups) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(groups);
        }
    });
});

app.get('/api/adkar', (req, res) => {
    db.all("SELECT * FROM adkar ORDER BY time_to_send", (err, adkar) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(adkar);
        }
    });
});

// واجهة لوحة التحكم البسيطة
app.get('/admin', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>لوحة تحكم البوت</title>
            <style>
                body { font-family: Arial; padding: 20px; background: #f5f5f5; }
                .container { max-width: 1200px; margin: auto; }
                .card { background: white; padding: 20px; margin: 20px 0; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                table { width: 100%; border-collapse: collapse; }
                th, td { padding: 10px; border: 1px solid #ddd; text-align: right; }
                th { background: #667eea; color: white; }
                .btn { padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; }
                .btn:hover { background: #5a67d8; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>👑 لوحة تحكم بوت الأذكار</h1>
                
                <div class="card">
                    <h2>المجموعات النشطة</h2>
                    <table id="groupsTable">
                        <thead>
                            <tr>
                                <th>المجموعة</th>
                                <th>الحالة</th>
                                <th>تاريخ الإضافة</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
                
                <div class="card">
                    <h2>الأذكار المجدولة</h2>
                    <table id="adkarTable">
                        <thead>
                            <tr>
                                <th>العنوان</th>
                                <th>التصنيف</th>
                                <th>وقت النشر</th>
                                <th>الحالة</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
                
                <div class="card">
                    <h2>إضافة ذكر جديد</h2>
                    <form id="addAdkarForm">
                        <input type="text" id="title" placeholder="عنوان الذكر" required style="width: 100%; padding: 10px; margin: 5px 0;">
                        <textarea id="content" placeholder="نص الذكر" required style="width: 100%; padding: 10px; margin: 5px 0; height: 100px;"></textarea>
                        <select id="category" style="width: 100%; padding: 10px; margin: 5px 0;">
                            <option value="morning">أذكار الصباح</option>
                            <option value="evening">أذكار المساء</option>
                            <option value="general">أذكار عامة</option>
                        </select>
                        <input type="time" id="time" required style="width: 100%; padding: 10px; margin: 5px 0;">
                        <button type="submit" class="btn">إضافة ذكر</button>
                    </form>
                </div>
            </div>
            
            <script>
                async function loadGroups() {
                    const response = await fetch('/api/groups');
                    const groups = await response.json();
                    
                    const tbody = document.querySelector('#groupsTable tbody');
                    tbody.innerHTML = '';
                    
                    groups.forEach(group => {
                        const row = document.createElement('tr');
                        row.innerHTML = \`
                            <td>\${group.title || 'غير معروف'}</td>
                            <td>\${group.bot_enabled ? '✅ نشط' : '⏸️ متوقف'}</td>
                            <td>\${new Date(group.created_at).toLocaleDateString('ar-SA')}</td>
                        \`;
                        tbody.appendChild(row);
                    });
                }
                
                async function loadAdkar() {
                    const response = await fetch('/api/adkar');
                    const adkar = await response.json();
                    
                    const tbody = document.querySelector('#adkarTable tbody');
                    tbody.innerHTML = '';
                    
                    adkar.forEach(item => {
                        const row = document.createElement('tr');
                        row.innerHTML = \`
                            <td>\${item.title}</td>
                            <td>\${item.category}</td>
                            <td>\${item.time_to_send || 'يومي'}</td>
                            <td>\${item.is_active ? '✅ نشط' : '⏸️ غير نشط'}</td>
                        \`;
                        tbody.appendChild(row);
                    });
                }
                
                document.getElementById('addAdkarForm').onsubmit = async (e) => {
                    e.preventDefault();
                    
                    const title = document.getElementById('title').value;
                    const content = document.getElementById('content').value;
                    const category = document.getElementById('category').value;
                    const time = document.getElementById('time').value;
                    
                    try {
                        const response = await fetch('/api/add-adkar', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ title, content, category, time })
                        });
                        
                        if (response.ok) {
                            alert('✅ تم إضافة الذكر بنجاح');
                            document.getElementById('addAdkarForm').reset();
                            loadAdkar();
                        }
                    } catch (error) {
                        alert('❌ حدث خطأ');
                    }
                };
                
                loadGroups();
                loadAdkar();
                setInterval(loadGroups, 30000);
            </script>
        </body>
        </html>
    `);
});

// API لإضافة ذكر جديد
app.post('/api/add-adkar', express.json(), (req, res) => {
    const { title, content, category, time } = req.body;
    
    db.run(
        "INSERT INTO adkar (title, content, category, time_to_send) VALUES (?, ?, ?, ?)",
        [title, content, category, time],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json({ success: true, id: this.lastID });
            }
        }
    );
});

// ========== بدء الخادم ==========
app.listen(PORT, async () => {
    console.log(`🚀 الخادم يعمل على http://localhost:${PORT}`);
    console.log(`👑 لوحة التحكم: http://localhost:${PORT}/admin`);
    
    try {
        const me = await bot.getMe();
        console.log(`🤖 البوت: @${me.username}`);
        console.log(`✅ البوت جاهز! أضفه لمجموعتك واستخدم /start`);
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