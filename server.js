require('dotenv').config();

console.log(`
╔══════════════════════════════════════════╗
║     🕌 بوت الأذكار الإسلامي             ║
║     الإصدار: 3.0.0                      ║
║     المطور: @dev3bod                    ║
║     الوقت: ${new Date().toLocaleString('ar-SA')} ║
╚══════════════════════════════════════════╝
`);

// ==================== PART 1: EXPRESS SERVER ====================
const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

// إعدادات أساسية
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// تسجيل الطلبات
app.use((req, res, next) => {
  const timestamp = new Date().toLocaleString('ar-SA');
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

// ==================== PART 2: SIMPLE BOT ====================
let bot = null;
let botStarted = false;

async function initializeBot() {
  try {
    console.log('🤖 محاولة تحميل البوت...');
    
    // استخدم telegraf بدلاً من node-telegram-bot-api
    const { Telegraf } = require('telegraf');
    
    if (!process.env.BOT_TOKEN) {
      throw new Error('BOT_TOKEN غير موجود في متغيرات البيئة');
    }
    
    bot = new Telegraf(process.env.BOT_TOKEN);
    
    // أمر البداية
    bot.start((ctx) => {
      ctx.reply(`
🕌 *مرحباً بك في بوت الأذكار الإسلامي*

✨ *المميزات:*
• أذكار الصباح والمساء
• تذكير سورة الكهف يوم الجمعة
• المناسبات الإسلامية
• ملفات صوتية وPDF

👤 المطور: @dev3bod
      `, { parse_mode: 'Markdown' });
    });
    
    // أمر المساعدة
    bot.help((ctx) => {
      ctx.reply(`
📚 *الأوامر المتاحة:*
/start - بدء البوت
/help - المساعدة
/adhkar - أذكار عشوائية
/quran - آيات قرآنية
/pdf - روابط PDF
/audio - روابط صوتية
      `, { parse_mode: 'Markdown' });
    });
    
    // أمر الأذكار
    bot.command('adhkar', (ctx) => {
      const adhkarList = [
        'سبحان الله وبحمده، سبحان الله العظيم',
        'لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير',
        'اللهم صل على محمد وعلى آل محمد',
        'أستغفر الله العظيم الذي لا إله إلا هو الحي القيوم وأتوب إليه'
      ];
      
      const randomAdhkar = adhkarList[Math.floor(Math.random() * adhkarList.length)];
      ctx.reply(`🕌 *ذكر عشوائي:*\n\n${randomAdhkar}`, { parse_mode: 'Markdown' });
    });
    
    // بدء البوت
    await bot.launch();
    
    console.log('✅ تم تشغيل البوت بنجاح!');
    botStarted = true;
    
    // إعلام المطور
    try {
      await bot.telegram.sendMessage(
        process.env.DEVELOPER_ID || '6960704733',
        `🤖 *تم تشغيل البوت على Render*\n\n` +
        `🕒 الوقت: ${new Date().toLocaleString('ar-SA')}\n` +
        `🌐 الرابط: https://islamic-telegram-bot.onrender.com\n` +
        `✅ الحالة: 🟢 نشط`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.log('⚠️ تعذر إعلام المطور:', error.message);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ فشل في تحميل البوت:', error.message);
    botStarted = false;
    return false;
  }
}

// ==================== PART 3: ROUTES ====================

// الصفحة الرئيسية
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>بوت الأذكار الإسلامي</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Arial', sans-serif;
        }
        
        body {
            background: linear-gradient(135deg, #1a2980, #26d0ce);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .container {
            width: 100%;
            max-width: 800px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        h1 {
            color: #ffd700;
            text-align: center;
            margin-bottom: 30px;
            font-size: 2.5em;
        }
        
        .status {
            background: ${botStarted ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)'};
            border: 2px solid ${botStarted ? '#4CAF50' : '#f44336'};
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            margin-bottom: 30px;
            font-size: 1.2em;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .info-box {
            background: rgba(255, 255, 255, 0.1);
            padding: 20px;
            border-radius: 10px;
            border-left: 5px solid #ffd700;
        }
        
        .info-box h3 {
            color: #ffd700;
            margin-bottom: 10px;
        }
        
        .api-links {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 20px;
        }
        
        .api-link {
            display: inline-block;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            padding: 10px 20px;
            border-radius: 25px;
            text-decoration: none;
            transition: all 0.3s;
            border: 1px solid rgba(255, 255, 255, 0.3);
        }
        
        .api-link:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: translateY(-2px);
        }
        
        .footer {
            margin-top: 40px;
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.2);
            color: rgba(255, 255, 255, 0.8);
        }
        
        .stats {
            display: flex;
            justify-content: space-around;
            margin: 20px 0;
            flex-wrap: wrap;
        }
        
        .stat {
            text-align: center;
            padding: 15px;
        }
        
        .stat-number {
            font-size: 2em;
            font-weight: bold;
            color: #ffd700;
        }
        
        .stat-label {
            font-size: 0.9em;
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🕌 بوت الأذكار الإسلامي</h1>
        
        <div class="status">
            ${botStarted ? '✅ البوت يعمل بنجاح' : '⚠️ البوت غير نشط'}
        </div>
        
        <div class="info-grid">
            <div class="info-box">
                <h3>📊 معلومات النظام</h3>
                <p>الإصدار: 3.0.0</p>
                <p>Node.js: <span id="nodeVersion">${process.version}</span></p>
                <p>المنفذ: ${PORT}</p>
                <p>البيئة: ${process.env.NODE_ENV || 'production'}</p>
            </div>
            
            <div class="info-box">
                <h3>✨ المميزات</h3>
                <p>• أذكار الصباح والمساء</p>
                <p>• تذكير سورة الكهف</p>
                <p>• المناسبات الإسلامية</p>
                <p>• ملفات صوتية وPDF</p>
            </div>
            
            <div class="info-box">
                <h3>👤 معلومات الاتصال</h3>
                <p>المطور: @dev3bod</p>
                <p>الدعم: ${process.env.DEVELOPER_ID || '6960704733'}</p>
                <p>المجموعة: @islamic_reminders</p>
            </div>
        </div>
        
        <div class="stats">
            <div class="stat">
                <div class="stat-number" id="uptime">0</div>
                <div class="stat-label">ثانية تشغيل</div>
            </div>
            
            <div class="stat">
                <div class="stat-number" id="memory">0</div>
                <div class="stat-label">ميجابايت</div>
            </div>
            
            <div class="stat">
                <div class="stat-number">${botStarted ? '🟢' : '🔴'}</div>
                <div class="stat-label">حالة البوت</div>
            </div>
        </div>
        
        <div class="api-links">
            <a href="/health" class="api-link" target="_blank">🩺 فحص الصحة</a>
            <a href="/api/status" class="api-link" target="_blank">📊 حالة النظام</a>
            <a href="/api/start-bot" class="api-link" target="_blank">🚀 تشغيل البوت</a>
            <a href="/api/stop-bot" class="api-link" target="_blank">🛑 إيقاف البوت</a>
        </div>
        
        <div class="footer">
            <p>© 2024 بوت الأذكار الإسلامي | يستضاف على Render</p>
            <p>آخر تحديث: <span id="timestamp">${new Date().toLocaleString('ar-SA')}</span></p>
        </div>
    </div>
    
    <script>
        // تحديث وقت التشغيل
        function updateUptime() {
            const startTime = Date.now();
            setInterval(() => {
                const uptime = Math.floor((Date.now() - startTime) / 1000);
                document.getElementById('uptime').textContent = uptime;
            }, 1000);
        }
        
        // تحديث استخدام الذاكرة
        function updateMemory() {
            fetch('/health')
                .then(res => res.json())
                .then(data => {
                    if (data.memory) {
                        const usedMB = Math.round(data.memory.heapUsed / 1024 / 1024);
                        document.getElementById('memory').textContent = usedMB;
                    }
                })
                .catch(err => console.error(err));
        }
        
        // تحديث الوقت
        function updateTime() {
            const now = new Date();
            document.getElementById('timestamp').textContent = 
                now.toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' });
        }
        
        // التحديث الأولي
        updateUptime();
        updateMemory();
        updateTime();
        
        // تحديث الذاكرة كل 10 ثواني
        setInterval(updateMemory, 10000);
        
        // تحديث الوقت كل ثانية
        setInterval(updateTime, 1000);
    </script>
</body>
</html>
  `);
});

// فحص صحة النظام
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    bot_running: botStarted,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    node_version: process.version,
    platform: process.platform,
    port: PORT,
    env: process.env.NODE_ENV || 'production'
  });
});

// حالة النظام
app.get('/api/status', (req, res) => {
  res.json({
    bot: {
      running: botStarted,
      token_configured: !!process.env.BOT_TOKEN,
      developer_id: process.env.DEVELOPER_ID || '6960704733'
    },
    server: {
      port: PORT,
      uptime: process.uptime(),
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB'
    },
    render: {
      service: 'web',
      region: 'frankfurt',
      url: 'https://islamic-telegram-bot.onrender.com'
    }
  });
});

// تشغيل البوت يدوياً
app.get('/api/start-bot', async (req, res) => {
  if (botStarted) {
    return res.json({ success: false, message: 'البوت يعمل بالفعل' });
  }
  
  const result = await initializeBot();
  res.json({ 
    success: result, 
    message: result ? 'تم تشغيل البوت بنجاح' : 'فشل تشغيل البوت'
  });
});

// إيقاف البوت يدوياً
app.get('/api/stop-bot', (req, res) => {
  if (!botStarted || !bot) {
    return res.json({ success: false, message: 'البوت غير مشغل' });
  }
  
  try {
    bot.stop();
    botStarted = false;
    res.json({ success: true, message: 'تم إيقاف البوت' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

// صفحة 404
app.use((req, res) => {
  res.status(404).send(`
    <div style="text-align: center; padding: 50px; color: white;">
      <h1 style="font-size: 4em;">404</h1>
      <p style="font-size: 1.5em;">الصفحة غير موجودة</p>
      <a href="/" style="color: #ffd700; text-decoration: none;">العودة للرئيسية</a>
    </div>
  `);
});

// ==================== PART 4: START SERVER ====================
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🌐 ===================================================== 🌐
     الخادم يعمل على: http://0.0.0.0:${PORT}
     الوقت: ${new Date().toLocaleString('ar-SA')}
     إصدار Node: ${process.version}
  🌐 ===================================================== 🌐
  `);
  
  // محاولة تشغيل البوت بعد بدء الخادم
  setTimeout(async () => {
    await initializeBot();
  }, 3000);
});

// ==================== PART 5: KEEP ALIVE MECHANISM ====================
// هذه الدالة تحافظ على تشغيل الخادم
function keepAlive() {
  console.log(`🟢 الخادم لا يزال يعمل (${Math.floor(process.uptime())}s)`);
  
  // إرسال طلب إلى نفس الخادم للحفاظ على نشاطه
  if (process.env.RENDER_EXTERNAL_URL) {
    fetch(`${process.env.RENDER_EXTERNAL_URL}/health`)
      .then(() => console.log('✅ تم تجديد النشاط'))
      .catch(err => console.log('⚠️ خطأ في تجديد النشاط:', err.message));
  }
}

// تشغيل keep-alive كل 5 دقائق
setInterval(keepAlive, 5 * 60 * 1000);

// ==================== PART 6: GRACEFUL SHUTDOWN ====================
process.on('SIGTERM', () => {
  console.log('🛑 تلقي إشارة SIGTERM');
  if (bot) {
    bot.stop();
  }
  server.close(() => {
    console.log('✅ تم إيقاف الخادم');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 تلقي إشارة SIGINT');
  if (bot) {
    bot.stop();
  }
  server.close(() => {
    console.log('✅ تم إيقاف الخادم');
    process.exit(0);
  });
});

// منع الخادم من الخروج
process.on('uncaughtException', (error) => {
  console.error('🔥 خطأ غير متوقع:', error);
  // لا تخرج من العملية، فقط سجل الخطأ
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ وعد مرفوض:', reason);
});

// ==================== PART 7: EXPORT FOR RENDER ====================
module.exports = server;