require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// إعدادات أساسية
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// تسجيل طلبات الوصول
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// استيراد البوت (مع معالجة الأخطاء)
let botStarted = false;
try {
  console.log('🚀 محاولة تحميل البوت...');
  require('./bot');
  botStarted = true;
  console.log('✅ تم تحميل البوت بنجاح');
} catch (error) {
  console.error('❌ فشل في تحميل البوت:', error.message);
  console.error('🔧 سيستمر الخادم للفحص الصحي');
}

// صفحة رئيسية محسنة
app.get('/', (req, res) => {
  const status = botStarted ? '🟢 نشط' : '🔴 غير نشط';
  
  res.send(`
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>بوت الأذكار الإسلامي - حالة النظام</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Segoe UI', 'Arial', sans-serif;
        }
        
        body {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #333;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        
        .container {
          width: 100%;
          max-width: 1000px;
          background: white;
          border-radius: 20px;
          box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
          overflow: hidden;
        }
        
        .header {
          background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        
        .header h1 {
          font-size: 2.5em;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 15px;
        }
        
        .header p {
          font-size: 1.1em;
          opacity: 0.9;
        }
        
        .status-bar {
          background: ${botStarted ? '#4CAF50' : '#f44336'};
          color: white;
          padding: 15px;
          text-align: center;
          font-size: 1.2em;
          font-weight: bold;
        }
        
        .content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          padding: 40px;
        }
        
        @media (max-width: 768px) {
          .content {
            grid-template-columns: 1fr;
          }
        }
        
        .panel {
          background: #f8f9fa;
          border-radius: 15px;
          padding: 25px;
          border: 1px solid #e9ecef;
        }
        
        .panel h2 {
          color: #2a5298;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 2px solid #e9ecef;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
          margin-top: 20px;
        }
        
        .stat-item {
          background: white;
          padding: 15px;
          border-radius: 10px;
          text-align: center;
          border: 1px solid #dee2e6;
          transition: transform 0.2s;
        }
        
        .stat-item:hover {
          transform: translateY(-3px);
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
        }
        
        .stat-value {
          font-size: 1.8em;
          font-weight: bold;
          color: #1e3c72;
          margin: 10px 0;
        }
        
        .stat-label {
          font-size: 0.9em;
          color: #6c757d;
        }
        
        .info-list {
          list-style: none;
        }
        
        .info-list li {
          padding: 12px 0;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .info-list li:last-child {
          border-bottom: none;
        }
        
        .api-links {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 20px;
        }
        
        .api-link {
          display: block;
          background: white;
          padding: 12px 20px;
          border-radius: 10px;
          text-decoration: none;
          color: #1e3c72;
          border: 1px solid #dee2e6;
          transition: all 0.2s;
        }
        
        .api-link:hover {
          background: #1e3c72;
          color: white;
          transform: translateX(-5px);
        }
        
        .footer {
          background: #f8f9fa;
          padding: 25px;
          text-align: center;
          border-top: 1px solid #e9ecef;
          color: #6c757d;
        }
        
        .footer a {
          color: #1e3c72;
          text-decoration: none;
        }
        
        .footer a:hover {
          text-decoration: underline;
        }
        
        .badge {
          display: inline-block;
          padding: 5px 10px;
          border-radius: 20px;
          font-size: 0.8em;
          font-weight: bold;
          margin-left: 10px;
        }
        
        .badge-success {
          background: #d4edda;
          color: #155724;
        }
        
        .badge-warning {
          background: #fff3cd;
          color: #856404;
        }
        
        .badge-info {
          background: #d1ecf1;
          color: #0c5460;
        }
        
        .refresh-btn {
          background: #1e3c72;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 25px;
          cursor: pointer;
          font-size: 1em;
          margin-top: 20px;
          transition: background 0.3s;
        }
        
        .refresh-btn:hover {
          background: #2a5298;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🕌 بوت الأذكار الإسلامي</h1>
          <p>نظام إدارة الأذكار والتذكيرات الإسلامية عبر تليجرام</p>
        </div>
        
        <div class="status-bar">
          حالة النظام: ${status}
        </div>
        
        <div class="content">
          <div class="panel">
            <h2>📊 حالة النظام</h2>
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-label">حالة البوت</div>
                <div class="stat-value">${botStarted ? '✅ نشط' : '❌ غير نشط'}</div>
              </div>
              
              <div class="stat-item">
                <div class="stat-label">وقت التشغيل</div>
                <div class="stat-value" id="uptime">--:--:--</div>
              </div>
              
              <div class="stat-item">
                <div class="stat-label">ذاكرة الاستخدام</div>
                <div class="stat-value" id="memory">0 MB</div>
              </div>
              
              <div class="stat-item">
                <div class="stat-label">المنفذ</div>
                <div class="stat-value">${PORT}</div>
              </div>
            </div>
            
            <h2 style="margin-top: 30px;">🛠 نقاط الوصول (API)</h2>
            <div class="api-links">
              <a href="/health" class="api-link" target="_blank">✅ /health - فحص صحة النظام</a>
              <a href="/api/status" class="api-link" target="_blank">📊 /api/status - حالة النظام</a>
              <a href="/api/env-check" class="api-link" target="_blank">🔧 /api/env-check - فحص المتغيرات</a>
              <a href="/api/logs" class="api-link" target="_blank">📝 /api/logs - سجلات النظام</a>
            </div>
          </div>
          
          <div class="panel">
            <h2>ℹ️ معلومات النظام</h2>
            <ul class="info-list">
              <li>
                <strong>الإصدار:</strong> 2.1.0
                <span class="badge badge-info">مستقر</span>
              </li>
              <li>
                <strong>Node.js:</strong> <span id="nodeVersion">جاري التحميل...</span>
              </li>
              <li>
                <strong>البيئة:</strong> ${process.env.NODE_ENV || 'غير محدد'}
              </li>
              <li>
                <strong>المنطقة الزمنية:</strong> ${process.env.TIMEZONE || 'Asia/Riyadh'}
              </li>
              <li>
                <strong>المطور:</strong> @dev3bod
              </li>
              <li>
                <strong>الدعم:</strong> ${process.env.DEVELOPER_ID || '6960704733'}
              </li>
            </ul>
            
            <h2 style="margin-top: 30px;">⚡ إجراءات سريعة</h2>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              <button class="refresh-btn" onclick="location.reload()">🔄 تحديث الصفحة</button>
              <button class="refresh-btn" onclick="checkHealth()">🔍 فحص الصحة</button>
              <button class="refresh-btn" onclick="showEnvCheck()">🔧 فحص الإعدادات</button>
            </div>
          </div>
        </div>
        
        <div class="footer">
          <p>© 2024 بوت الأذكار الإسلامي | تم التطوير باستخدام Node.js و Telegram Bot API</p>
          <p>⚡ يستضاف على <a href="https://render.com" target="_blank">Render</a> | 📞 للدعم: ${process.env.DEVELOPER_ID || '6960704733'}</p>
          <p id="lastUpdate">آخر تحديث: <span id="timestamp">--:--:--</span></p>
        </div>
      </div>
      
      <script>
        // تحديث المعلومات الديناميكية
        function updateDynamicInfo() {
          // تحديث الوقت
          const now = new Date();
          const timeStr = now.toLocaleString('ar-SA', { 
            timeZone: 'Asia/Riyadh',
            hour12: true 
          });
          document.getElementById('timestamp').textContent = timeStr;
          
          // جلب معلومات النظام
          fetch('/health')
            .then(response => response.json())
            .then(data => {
              // وقت التشغيل
              if (data.uptime) {
                const uptime = parseFloat(data.uptime);
                const hours = Math.floor(uptime / 3600);
                const minutes = Math.floor((uptime % 3600) / 60);
                const seconds = Math.floor(uptime % 60);
                document.getElementById('uptime').textContent = 
                  `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
              }
              
              // استخدام الذاكرة
              if (data.memory) {
                const usedMB = Math.round(data.memory.heapUsed / 1024 / 1024);
                const totalMB = Math.round(data.memory.heapTotal / 1024 / 1024);
                document.getElementById('memory').textContent = `${usedMB} / ${totalMB} MB`;
              }
              
              // إصدار Node.js
              if (data.node_version) {
                document.getElementById('nodeVersion').textContent = data.node_version;
              }
            })
            .catch(error => {
              console.error('خطأ في جلب معلومات النظام:', error);
            });
        }
        
        // فحص صحة النظام
        function checkHealth() {
          fetch('/health')
            .then(response => response.json())
            .then(data => {
              alert('✅ النظام يعمل بشكل جيد\n' + 
                    'وقت التشغيل: ' + Math.floor(data.uptime) + ' ثانية\n' +
                    'الذاكرة: ' + Math.round(data.memory.heapUsed / 1024 / 1024) + ' MB');
            })
            .catch(error => {
              alert('❌ خطأ في فحص الصحة: ' + error.message);
            });
        }
        
        // فحص الإعدادات
        function showEnvCheck() {
          fetch('/api/env-check')
            .then(response => response.json())
            .then(data => {
              let message = '🔧 فحص المتغيرات البيئية:\n\n';
              Object.entries(data).forEach(([key, value]) => {
                message += `${key}: ${value.status}\n`;
              });
              alert(message);
            })
            .catch(error => {
              alert('❌ خطأ في فحص الإعدادات: ' + error.message);
            });
        }
        
        // التحديث الأولي
        updateDynamicInfo();
        
        // تحديث كل 5 ثواني
        setInterval(updateDynamicInfo, 5000);
        
        // تحديث الوقت كل ثانية
        setInterval(() => {
          const now = new Date();
          const timeStr = now.toLocaleString('ar-SA', { 
            timeZone: 'Asia/Riyadh',
            hour12: true 
          });
          document.getElementById('timestamp').textContent = timeStr;
        }, 1000);
      </script>
    </body>
    </html>
  `);
});

// فحص صحة النظام
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    bot_status: botStarted ? 'running' : 'stopped',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    node_version: process.version,
    platform: process.platform,
    arch: process.arch,
    env: process.env.NODE_ENV || 'development'
  });
});

// فحص حالة النظام
app.get('/api/status', (req, res) => {
  res.json({
    bot: {
      running: botStarted,
      last_check: new Date().toISOString()
    },
    server: {
      port: PORT,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    },
    environment: {
      node_env: process.env.NODE_ENV,
      timezone: process.env.TIMEZONE || 'Asia/Riyadh'
    }
  });
});

// فحص المتغيرات البيئية
app.get('/api/env-check', (req, res) => {
  const envVars = {
    BOT_TOKEN: {
      exists: !!process.env.BOT_TOKEN,
      length: process.env.BOT_TOKEN ? process.env.BOT_TOKEN.length : 0,
      status: process.env.BOT_TOKEN ? '✅ مضبوط' : '❌ مفقود'
    },
    PORT: {
      value: process.env.PORT || '3000',
      status: '✅ مضبوط'
    },
    NODE_ENV: {
      value: process.env.NODE_ENV || 'development',
      status: process.env.NODE_ENV ? '✅ مضبوط' : '⚠️ غير مضبوط'
    },
    ADMIN_GROUP_ID: {
      exists: !!process.env.ADMIN_GROUP_ID,
      status: process.env.ADMIN_GROUP_ID ? '✅ مضبوط' : '⚠️ غير مضبوط'
    }
  };
  
  res.json(envVars);
});

// سجلات النظام
app.get('/api/logs', (req, res) => {
  res.json({
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: 'طلب سجلات النظام'
      },
      {
        timestamp: new Date(Date.now() - 5000).toISOString(),
        level: botStarted ? 'SUCCESS' : 'ERROR',
        message: botStarted ? 'تم تحميل البوت بنجاح' : 'فشل تحميل البوت'
      },
      {
        timestamp: new Date(Date.now() - 10000).toISOString(),
        level: 'INFO',
        message: 'تم تشغيل خادم الويب'
      }
    ],
    count: 3,
    generated_at: new Date().toISOString()
  });
});

// معالجة 404
app.use((req, res) => {
  res.status(404).json({
    error: 'الصفحة غير موجودة',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    available_endpoints: [
      'GET /',
      'GET /health',
      'GET /api/status',
      'GET /api/env-check',
      'GET /api/logs'
    ]
  });
});

// معالجة الأخطاء العامة
app.use((err, req, res, next) => {
  console.error('🔥 خطأ في الخادم:', err);
  res.status(500).json({
    error: 'خطأ داخلي في الخادم',
    message: process.env.NODE_ENV === 'development' ? err.message : 'حدث خطأ غير متوقع',
    timestamp: new Date().toISOString()
  });
});

// بدء الخادم
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🚀 ===================================================== 🚀
     بوت الأذكار الإسلامي - الإصدار 2.1.0
  🌐 ===================================================== 🌐
     
  ✅ الخادم يعمل بنجاح!
  📍 العنوان: http://0.0.0.0:${PORT}
  ⏰ الوقت: ${new Date().toLocaleString('ar-SA')}
  🔧 البيئة: ${process.env.NODE_ENV || 'development'}
  🤖 حالة البوت: ${botStarted ? '✅ نشط' : '❌ غير نشط'}
  
  📊 نقاط الوصول المتاحة:
     🔗 الصفحة الرئيسية: /
     🩺 فحص الصحة: /health
     📈 حالة النظام: /api/status
     🔧 فحص الإعدادات: /api/env-check
     📝 السجلات: /api/logs
  
  👤 المطور: @dev3bod
  📞 الدعم: ${process.env.DEVELOPER_ID || '6960704733'}
  ⚡ يستضاف على: Render
  🚀 ===================================================== 🚀
  `);
});

// معالجة إيقاف الخادم
process.on('SIGTERM', () => {
  console.log('🛑 تلقي إشارة SIGTERM، إيقاف الخادم...');
  server.close(() => {
    console.log('✅ تم إيقاف الخادم');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 تلقي إشارة SIGINT، إيقاف الخادم...');
  server.close(() => {
    console.log('✅ تم إيقاف الخادم');
    process.exit(0);
  });
});

// الحفاظ على الخادم نشطاً
setInterval(() => {
  if (server.listening) {
    console.log(`🟢 الخادم لا يزال يعمل (Uptime: ${Math.floor(process.uptime())}s)`);
  }
}, 30000); // كل 30 ثانية

module.exports = { app, server };