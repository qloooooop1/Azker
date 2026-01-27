require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// استيراد البوت
require('./bot');

// صفحة رئيسية بسيطة
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
        }
        
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        
        .container {
          max-width: 800px;
          width: 100%;
          padding: 30px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          backdrop-filter: blur(10px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        h1 {
          color: #ffd700;
          font-size: 2.5em;
          margin-bottom: 20px;
          text-align: center;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        }
        
        .status {
          font-size: 1.5em;
          margin: 20px 0;
          padding: 15px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 10px;
          text-align: center;
          border-left: 5px solid #4CAF50;
        }
        
        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin: 30px 0;
        }
        
        .stat-card {
          background: rgba(255, 255, 255, 0.15);
          padding: 20px;
          border-radius: 10px;
          text-align: center;
          transition: transform 0.3s ease;
        }
        
        .stat-card:hover {
          transform: translateY(-5px);
        }
        
        .stat-card h3 {
          color: #ffd700;
          margin-bottom: 10px;
          font-size: 1.2em;
        }
        
        .stat-card p {
          font-size: 1.5em;
          font-weight: bold;
        }
        
        .info {
          background: rgba(255, 255, 255, 0.1);
          padding: 20px;
          border-radius: 10px;
          margin-top: 30px;
        }
        
        .info p {
          margin: 10px 0;
          line-height: 1.6;
        }
        
        .footer {
          margin-top: 30px;
          text-align: center;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.2);
          color: rgba(255, 255, 255, 0.8);
        }
        
        .footer a {
          color: #ffd700;
          text-decoration: none;
        }
        
        .footer a:hover {
          text-decoration: underline;
        }
        
        @media (max-width: 768px) {
          .container {
            padding: 20px;
          }
          
          h1 {
            font-size: 2em;
          }
          
          .stats {
            grid-template-columns: 1fr;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🕌 بوت الأذكار الإسلامي</h1>
        
        <div class="status">
          ✅ البوت يعمل بنجاح على Render
        </div>
        
        <div class="stats">
          <div class="stat-card">
            <h3>👥 حالة البوت</h3>
            <p id="botStatus">🟢 نشط</p>
          </div>
          
          <div class="stat-card">
            <h3>⏰ وقت التشغيل</h3>
            <p id="uptime">جاري التحميل...</p>
          </div>
          
          <div class="stat-card">
            <h3>🕒 الوقت الحالي</h3>
            <p id="currentTime"></p>
          </div>
        </div>
        
        <div class="info">
          <p><strong>📝 وصف البوت:</strong> بوت تليجرام متكامل للأذكار الإسلامية، المناسبات، القرآن، والتذكيرات التلقائية.</p>
          <p><strong>✨ المميزات:</strong></p>
          <ul style="margin-right: 20px; line-height: 1.8;">
            <li>أذكار الصباح والمساء التلقائية</li>
            <li>تذكير سورة الكهف يوم الجمعة</li>
            <li>المناسبات الإسلامية والأعياد</li>
            <li>ملفات صوتية وPDF للقرآن</li>
            <li>إدارة متقدمة من لوحة المطور</li>
          </ul>
          
          <p><strong>👤 المطور:</strong> @dev3bod</p>
          <p><strong>📞 الدعم:</strong> ${process.env.DEVELOPER_ID || '6960704733'}</p>
        </div>
        
        <div class="footer">
          <p>تم تطوير البوت باستخدام Node.js و Telegram Bot API</p>
          <p>⚡ يعمل على <a href="https://render.com" target="_blank">Render</a></p>
          <p id="version">الإصدار 2.0.1</p>
        </div>
      </div>
      
      <script>
        // تحديث الوقت الحالي
        function updateCurrentTime() {
          const now = new Date();
          const options = {
            timeZone: 'Asia/Riyadh',
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          };
          document.getElementById('currentTime').textContent = 
            now.toLocaleString('ar-SA', options);
        }
        
        // تحديث وقت التشغيل
        function updateUptime() {
          fetch('/api/health')
            .then(response => response.json())
            .then(data => {
              if (data.uptime) {
                const uptime = parseFloat(data.uptime);
                const hours = Math.floor(uptime / 3600);
                const minutes = Math.floor((uptime % 3600) / 60);
                const seconds = Math.floor(uptime % 60);
                document.getElementById('uptime').textContent = 
                  `${hours} ساعة ${minutes} دقيقة ${seconds} ثانية`;
              }
            })
            .catch(error => {
              console.error('خطأ في جلب وقت التشغيل:', error);
            });
        }
        
        // تحديث حالة البوت
        function updateBotStatus() {
          fetch('/api/bot-status')
            .then(response => response.json())
            .then(data => {
              document.getElementById('botStatus').textContent = 
                data.status === 'running' ? '🟢 نشط' : '🔴 متوقف';
              document.getElementById('botStatus').style.color = 
                data.status === 'running' ? '#4CAF50' : '#f44336';
            })
            .catch(error => {
              console.error('خطأ في جلب حالة البوت:', error);
            });
        }
        
        // التحديث الأولي
        updateCurrentTime();
        updateUptime();
        updateBotStatus();
        
        // تحديث الوقت كل ثانية
        setInterval(updateCurrentTime, 1000);
        
        // تحديث وقت التشغيل كل 30 ثانية
        setInterval(updateUptime, 30000);
        
        // تحديث حالة البوت كل دقيقة
        setInterval(updateBotStatus, 60000);
      </script>
    </body>
    </html>
  `);
});

// نقطة نهاية للصحة
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'islamic-telegram-bot',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    node_version: process.version
  });
});

// نقطة نهاية لحالة البوت
app.get('/api/bot-status', (req, res) => {
  res.json({
    status: 'running',
    lastChecked: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch
  });
});

// نقطة نهاية للإحصائيات (مثال)
app.get('/api/stats', async (req, res) => {
  try {
    res.json({
      status: 'success',
      data: {
        groups: 'جاري التحميل...',
        users: 'جاري التحميل...',
        messages: 'جاري التحميل...',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// نقطة نهاية للتحقق من التوكن
app.get('/api/check-token', (req, res) => {
  const token = process.env.BOT_TOKEN;
  if (token) {
    res.json({
      status: 'configured',
      tokenLength: token.length,
      maskedToken: token.substring(0, 5) + '...' + token.substring(token.length - 5)
    });
  } else {
    res.json({
      status: 'not_configured',
      message: 'لم يتم تكوين BOT_TOKEN'
    });
  }
});

// معالجة 404
app.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>404 - الصفحة غير موجودة</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          text-align: center;
          padding: 50px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        h1 { font-size: 3em; margin-bottom: 20px; }
        a { color: #ffd700; text-decoration: none; }
      </style>
    </head>
    <body>
      <h1>404 ⚠️</h1>
      <p>الصفحة التي تبحث عنها غير موجودة</p>
      <p><a href="/">العودة للصفحة الرئيسية</a></p>
    </body>
    </html>
  `);
});

// بدء الخادم
app.listen(PORT, () => {
  console.log(`🌐 خادم الويب يعمل على المنفذ ${PORT}`);
  console.log(`✅ البوت يعمل بنجاح`);
  console.log(`🔗 الرابط: http://localhost:${PORT}`);
  console.log(`👤 المطور: @dev3bod`);
});

module.exports = app;