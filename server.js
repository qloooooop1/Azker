require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// صفحة رئيسية بسيطة
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>بوت الأذكار الإسلامي</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          text-align: center; 
          padding: 50px; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .container { 
          max-width: 800px; 
          margin: 0 auto; 
          padding: 20px;
          background: rgba(255,255,255,0.1);
          border-radius: 20px;
          backdrop-filter: blur(10px);
        }
        h1 { 
          color: #ffd700; 
          font-size: 2.5em;
          margin-bottom: 20px;
        }
        .status { 
          font-size: 1.5em; 
          margin: 20px 0;
          padding: 15px;
          background: rgba(0,0,0,0.2);
          border-radius: 10px;
        }
        .stats { 
          display: grid; 
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
          gap: 20px; 
          margin: 30px 0;
        }
        .stat-card { 
          background: rgba(255,255,255,0.15); 
          padding: 20px; 
          border-radius: 10px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🕌 بوت الأذكار الإسلامي</h1>
        <div class="status">✅ البوت يعمل بنجاح</div>
        
        <div class="stats">
          <div class="stat-card">
            <h3>👥 المجموعات</h3>
            <p id="groupsCount">جاري التحميل...</p>
          </div>
          <div class="stat-card">
            <h3>📨 الرسائل</h3>
            <p id="messagesCount">جاري التحميل...</p>
          </div>
          <div class="stat-card">
            <h3>⏰ الوقت</h3>
            <p id="currentTime"></p>
          </div>
        </div>
        
        <p>تم تطوير البوت بواسطة: @dev3bod</p>
        <p>📞 للدعم: ${process.env.DEVELOPER_ID || '6960704733'}</p>
      </div>
      
      <script>
        // تحديث الوقت
        function updateTime() {
          const now = new Date();
          document.getElementById('currentTime').textContent = 
            now.toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' });
        }
        
        // تحديث الإحصائيات (مثال)
        async function updateStats() {
          try {
            const response = await fetch('/api/stats');
            const data = await response.json();
            document.getElementById('groupsCount').textContent = data.groups || '0';
            document.getElementById('messagesCount').textContent = data.messages || '0';
          } catch (error) {
            console.error('خطأ في تحديث الإحصائيات:', error);
          }
        }
        
        // تحديث كل دقيقة
        updateTime();
        setInterval(updateTime, 60000);
        setInterval(updateStats, 30000);
        
        // التحديث الأول
        setTimeout(updateStats, 2000);
      </script>
    </body>
    </html>
  `);
});

// نقطة نهاية للإحصائيات
app.get('/api/stats', (req, res) => {
  res.json({
    status: 'running',
    groups: 'جاري التحميل...',
    messages: 'جاري التحميل...',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// نقطة نهاية للصحة (health check)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'islamic-telegram-bot',
    timestamp: new Date().toISOString()
  });
});

// بدء خادم الويب
app.listen(PORT, () => {
  console.log(`🌐 خادم الويب يعمل على المنفذ ${PORT}`);
});

// تصدير التطبيق لـ Render
module.exports = app;