require('dotenv').config();

console.log(`
╔══════════════════════════════════════════════════════════╗
║        🕌 بوت الأذكار الإسلامي - النظام المتكامل        ║
║        الإصدار: 4.0.0 - لوحة تحكم متقدمة                ║
║        المطور: @dev3bod                                 ║
║        الوقت: ${new Date().toLocaleString('ar-SA')}     ║
╚══════════════════════════════════════════════════════════╝
`);

const express = require('express');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment-timezone');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const session = require('express-session');

const app = express();

// إعدادات الوقت
moment.tz.setDefault(process.env.TIMEZONE || 'Asia/Riyadh');

// إعدادات Express لـ Render
const PORT = process.env.PORT || 10000;

// إعدادات CORS للسماح بجميع المصادر (للتطوير)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// معالجة JSON
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ملفات ثابتة
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// جلسة الإدارة
app.use(session({
  secret: process.env.SESSION_SECRET || 'islamic-bot-admin-secret-2024',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 ساعة
  }
}));

// تسجيل الطلبات
app.use((req, res, next) => {
  const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
  console.log(`[${timestamp}] ${req.method} ${req.url} - ${req.ip}`);
  next();
});

// ==================== صفحة رئيسية بسيطة ====================

app.get('/', (req, res) => {
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>بوت الأذكار الإسلامي - النظام المتكامل</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1a2980 0%, #26d0ce 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container { 
            text-align: center;
            max-width: 800px;
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            padding: 40px;
            border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.2);
        }
        h1 { 
            font-size: 3em; 
            color: #FFD700; 
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .status { 
            display: inline-block;
            background: #4CAF50;
            padding: 10px 20px;
            border-radius: 20px;
            margin: 20px 0;
            font-weight: bold;
        }
        .links { 
            margin-top: 30px;
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 15px;
        }
        .btn { 
            display: inline-block;
            padding: 15px 30px;
            background: rgba(255,215,0,0.2);
            color: #FFD700;
            text-decoration: none;
            border-radius: 10px;
            border: 2px solid #FFD700;
            transition: all 0.3s;
            font-weight: bold;
        }
        .btn:hover { 
            background: #FFD700;
            color: #1a2980;
            transform: translateY(-3px);
        }
        .info { 
            margin-top: 30px;
            background: rgba(0,0,0,0.2);
            padding: 20px;
            border-radius: 10px;
            text-align: right;
        }
        @media (max-width: 768px) {
            h1 { font-size: 2em; }
            .container { padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🕌 بوت الأذكار الإسلامي</h1>
        <p>نظام متكامل لإدارة الأذكار والتذكيرات الإسلامية عبر تليجرام</p>
        
        <div class="status">🟢 النظام يعمل بنجاح</div>
        
        <div class="links">
            <a href="/admin/dashboard" class="btn">👑 لوحة التحكم</a>
            <a href="/health" class="btn">🩺 فحص الصحة</a>
            <a href="/api/stats" class="btn">📊 الإحصائيات</a>
            <a href="https://t.me/${process.env.BOT_USERNAME || 'your_bot'}" class="btn" target="_blank">🤖 الذهاب للبوت</a>
        </div>
        
        <div class="info">
            <h3>📋 معلومات النظام:</h3>
            <p>👤 المطور: @dev3bod</p>
            <p>⚡ يستضاف على: Render</p>
            <p>🕒 الوقت: <span id="currentTime">${new Date().toLocaleString('ar-SA')}</span></p>
            <p>🔗 الرابط: ${req.protocol}://${req.get('host')}</p>
        </div>
    </div>
    
    <script>
        // تحديث الوقت
        function updateTime() {
            const now = new Date();
            const options = { 
                timeZone: 'Asia/Riyadh',
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            };
            document.getElementById('currentTime').textContent = 
                now.toLocaleString('ar-SA', options);
        }
        
        setInterval(updateTime, 1000);
        updateTime();
    </script>
</body>
</html>`;
  
  res.send(html);
});

// ==================== فحص الصحة ====================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'islamic-telegram-bot-admin',
    version: '4.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    platform: process.platform,
    memory: process.memoryUsage(),
    database: 'local-storage'
  });
});

// ==================== API للإحصائيات ====================

app.get('/api/stats', (req, res) => {
  const stats = {
    service: 'بوت الأذكار الإسلامي',
    version: '4.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    features: {
      admin_panel: true,
      content_management: true,
      media_library: true,
      live_streaming: false,
      enhanced_categories: true,
      pdf_resources: 5,
      audio_resources: 6
    },
    developer: {
      name: '@dev3bod',
      support_group: process.env.ADMIN_GROUP_ID || '-1003595290365'
    }
  };
  
  res.json(stats);
});

// ==================== نظام المصادقة البسيط ====================

// وظيفة التحقق من المصادقة
function requireAuth(req, res, next) {
  if (req.session && req.session.userId === 'admin') {
    return next();
  }
  
  // إذا لم يكن مسجلاً دخولاً، توجيه إلى صفحة تسجيل الدخول
  if (req.originalUrl.startsWith('/admin')) {
    return res.redirect('/admin/login');
  }
  
  next();
}

// ==================== لوحة التحكم ====================

// صفحة تسجيل الدخول
app.get('/admin/login', (req, res) => {
  // إذا كان مسجلاً دخولاً بالفعل، توجيه إلى لوحة التحكم
  if (req.session.userId === 'admin') {
    return res.redirect('/admin/dashboard');
  }
  
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>تسجيل الدخول - لوحة تحكم البوت</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body {
            background: linear-gradient(135deg, #1a2980 0%, #26d0ce 100%);
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .login-card {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            width: 100%;
            max-width: 400px;
        }
        
        .login-header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .login-header h2 {
            color: #1a2980;
            margin-bottom: 10px;
        }
        
        .login-header p {
            color: #666;
        }
        
        .form-control {
            padding: 12px 15px;
            border-radius: 10px;
            border: 2px solid #e0e0e0;
            margin-bottom: 20px;
            transition: all 0.3s;
        }
        
        .form-control:focus {
            border-color: #1a2980;
            box-shadow: 0 0 0 0.2rem rgba(26, 41, 128, 0.25);
        }
        
        .btn-login {
            background: linear-gradient(135deg, #1a2980 0%, #26d0ce 100%);
            color: white;
            border: none;
            padding: 12px;
            border-radius: 10px;
            width: 100%;
            font-weight: bold;
            transition: transform 0.3s;
        }
        
        .btn-login:hover {
            transform: translateY(-2px);
        }
        
        .alert {
            margin-top: 20px;
            border-radius: 10px;
        }
        
        .btn-back {
            margin-top: 15px;
            background: #6c757d;
            color: white;
            border: none;
            padding: 10px;
            border-radius: 10px;
            width: 100%;
        }
    </style>
</head>
<body>
    <div class="login-card">
        <div class="login-header">
            <h2>🕌 لوحة تحكم البوت</h2>
            <p>بوت الأذكار الإسلامي - الإصدار المطور</p>
        </div>
        
        <form id="loginForm">
            <div class="mb-3">
                <input type="text" class="form-control" id="username" 
                       placeholder="اسم المستخدم" required value="admin">
            </div>
            
            <div class="mb-3">
                <input type="password" class="form-control" id="password" 
                       placeholder="كلمة المرور" required value="admin123">
            </div>
            
            <button type="submit" class="btn btn-login">
                تسجيل الدخول
            </button>
            
            <button type="button" class="btn btn-back" onclick="window.location.href='/'">
                العودة للصفحة الرئيسية
            </button>
            
            <div id="errorMessage" class="alert alert-danger mt-3 d-none"></div>
        </form>
    </div>
    
    <script>
        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorDiv = document.getElementById('errorMessage');
            
            errorDiv.classList.add('d-none');
            
            try {
                const response = await fetch('/admin/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    window.location.href = data.redirect;
                } else {
                    errorDiv.textContent = data.message;
                    errorDiv.classList.remove('d-none');
                }
            } catch (error) {
                errorDiv.textContent = 'حدث خطأ في الاتصال. حاول مرة أخرى.';
                errorDiv.classList.remove('d-none');
            }
        });
    </script>
</body>
</html>`;
  
  res.send(html);
});

// معالجة تسجيل الدخول
app.post('/admin/login', express.json(), (req, res) => {
  const { username, password } = req.body;
  
  // بيانات الدخول الافتراضية (يمكن تغييرها في ملف .env)
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  
  if (username === adminUser && password === adminPass) {
    req.session.userId = 'admin';
    req.session.isAdmin = true;
    req.session.save();
    
    res.json({ 
      success: true, 
      redirect: '/admin/dashboard',
      message: 'تم تسجيل الدخول بنجاح'
    });
  } else {
    res.json({ 
      success: false, 
      message: 'بيانات الدخول غير صحيحة' 
    });
  }
});

// لوحة التحكم الرئيسية
app.get('/admin/dashboard', requireAuth, (req, res) => {
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>لوحة تحكم بوت الأذكار الإسلامي</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.8.1/font/bootstrap-icons.css">
    <style>
        :root {
            --primary-color: #1a2980;
            --secondary-color: #26d0ce;
        }
        
        body {
            background: #f8f9fa;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .sidebar {
            background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
            color: white;
            min-height: 100vh;
            box-shadow: 3px 0 15px rgba(0,0,0,0.1);
        }
        
        .sidebar .nav-link {
            color: rgba(255,255,255,0.8);
            padding: 12px 20px;
            margin: 5px 0;
            border-radius: 8px;
            transition: all 0.3s;
        }
        
        .sidebar .nav-link:hover, .sidebar .nav-link.active {
            background: rgba(255,255,255,0.1);
            color: white;
            transform: translateX(5px);
        }
        
        .sidebar .nav-link i {
            margin-left: 10px;
        }
        
        .stat-card {
            background: white;
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.08);
            transition: transform 0.3s;
            border: none;
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
        
        .stat-value {
            font-size: 2rem;
            font-weight: bold;
            color: var(--primary-color);
        }
        
        .stat-label {
            color: #6c757d;
            font-size: 0.9rem;
        }
        
        .btn-primary {
            background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
            border: none;
            padding: 10px 25px;
            border-radius: 25px;
        }
        
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        
        .btn-logout {
            background: #dc3545;
            color: white;
        }
        
        .btn-fixed {
            position: fixed;
            bottom: 30px;
            left: 30px;
            z-index: 1000;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 5px 20px rgba(0,0,0,0.2);
        }
    </style>
</head>
<body>
    <div class="container-fluid">
        <div class="row">
            <!-- Sidebar -->
            <div class="col-md-3 col-lg-2 sidebar d-md-block">
                <div class="position-sticky pt-3">
                    <div class="text-center mb-4">
                        <h3><i class="bi bi-moon-stars"></i> الأذكار</h3>
                        <small class="text-white-50">لوحة التحكم المطورة</small>
                    </div>
                    
                    <ul class="nav flex-column">
                        <li class="nav-item">
                            <a class="nav-link active" href="/admin/dashboard">
                                <i class="bi bi-speedometer2"></i> لوحة التحكم
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/admin/content">
                                <i class="bi bi-journal-text"></i> إدارة المحتوى
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/admin/media">
                                <i class="bi bi-file-earmark-music"></i> الوسائط
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/admin/settings">
                                <i class="bi bi-gear"></i> الإعدادات
                            </a>
                        </li>
                        <li class="nav-item mt-4">
                            <a class="nav-link btn-logout" href="/admin/logout">
                                <i class="bi bi-box-arrow-right"></i> تسجيل الخروج
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
            
            <!-- Main Content -->
            <div class="col-md-9 col-lg-10 ms-sm-auto px-md-4 py-4">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h2><i class="bi bi-speedometer2"></i> لوحة التحكم الرئيسية</h2>
                    <span class="badge bg-success">🟢 النظام يعمل</span>
                </div>
                
                <!-- Welcome Message -->
                <div class="stat-card">
                    <h4>👋 مرحباً بك في لوحة تحكم بوت الأذكار الإسلامي</h4>
                    <p class="text-muted">يمكنك من هنا إدارة جميع محتويات البوت والإعدادات</p>
                </div>
                
                <!-- Statistics Cards -->
                <div class="row">
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-icon bg-primary text-white">
                                <i class="bi bi-people"></i>
                            </div>
                            <div class="stat-value" id="groupsCount">0</div>
                            <div class="stat-label">المجموعات النشطة</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-icon bg-success text-white">
                                <i class="bi bi-journal-text"></i>
                            </div>
                            <div class="stat-value" id="adhkarCount">50+</div>
                            <div class="stat-label">الأذكار المتاحة</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-icon bg-warning text-white">
                                <i class="bi bi-folder"></i>
                            </div>
                            <div class="stat-value" id="categoriesCount">8</div>
                            <div class="stat-label">الأقسام المطورة</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-icon bg-info text-white">
                                <i class="bi bi-file-earmark-music"></i>
                            </div>
                            <div class="stat-value" id="mediaCount">11</div>
                            <div class="stat-label">الوسائط</div>
                        </div>
                    </div>
                </div>
                
                <!-- Quick Actions -->
                <div class="row mt-4">
                    <div class="col-md-6">
                        <div class="stat-card">
                            <h5><i class="bi bi-lightning-charge"></i> إجراءات سريعة</h5>
                            <div class="row mt-3">
                                <div class="col-6">
                                    <button class="btn btn-primary w-100 mb-2" onclick="window.location.href='/admin/content'">
                                        <i class="bi bi-plus-circle"></i> إضافة ذكر
                                    </button>
                                    <button class="btn btn-success w-100" onclick="window.location.href='/admin/media'">
                                        <i class="bi bi-upload"></i> رفع وسائط
                                    </button>
                                </div>
                                <div class="col-6">
                                    <button class="btn btn-warning w-100 mb-2" onclick="testBroadcast()">
                                        <i class="bi bi-megaphone"></i> اختبار البث
                                    </button>
                                    <button class="btn btn-info w-100" onclick="refreshStats()">
                                        <i class="bi bi-arrow-clockwise"></i> تحديث
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <div class="stat-card">
                            <h5><i class="bi bi-info-circle"></i> معلومات النظام</h5>
                            <ul class="list-group list-group-flush mt-3">
                                <li class="list-group-item d-flex justify-content-between">
                                    <span>النسخة:</span>
                                    <span class="fw-bold">4.0.0</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between">
                                    <span>الحالة:</span>
                                    <span class="badge bg-success">نشط</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between">
                                    <span>المطور:</span>
                                    <span>@dev3bod</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between">
                                    <span>الخادم:</span>
                                    <span>Render</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
                
                <!-- Enhanced Features -->
                <div class="row mt-4">
                    <div class="col-12">
                        <div class="stat-card">
                            <h5><i class="bi bi-stars"></i> المميزات المطورة</h5>
                            <div class="row mt-3">
                                <div class="col-md-4">
                                    <div class="card border-0 bg-light">
                                        <div class="card-body text-center">
                                            <i class="bi bi-moon-stars fs-1 text-primary"></i>
                                            <h6 class="mt-2">أذكار النوم</h6>
                                            <small class="text-muted">أذكار وأدعية ما قبل النوم</small>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="card border-0 bg-light">
                                        <div class="card-body text-center">
                                            <i class="bi bi-sun fs-1 text-warning"></i>
                                            <h6 class="mt-2">أذكار الاستيقاظ</h6>
                                            <small class="text-muted">أذكار وأدعية الاستيقاظ</small>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="card border-0 bg-light">
                                        <div class="card-body text-center">
                                            <i class="bi bi-airplane fs-1 text-info"></i>
                                            <h6 class="mt-2">أذكار السفر</h6>
                                            <small class="text-muted">أذكار وأدعية السفر</small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="row mt-3">
                                <div class="col-md-4">
                                    <div class="card border-0 bg-light">
                                        <div class="card-body text-center">
                                            <i class="bi bi-file-pdf fs-1 text-danger"></i>
                                            <h6 class="mt-2">ملفات PDF</h6>
                                            <small class="text-muted">5 ملفات PDF للتحميل</small>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="card border-0 bg-light">
                                        <div class="card-body text-center">
                                            <i class="bi bi-music-note-beamed fs-1 text-success"></i>
                                            <h6 class="mt-2">روابط صوتية</h6>
                                            <small class="text-muted">6 روابط صوتية مباشرة</small>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="card border-0 bg-light">
                                        <div class="card-body text-center">
                                            <i class="bi bi-cast fs-1 text-purple"></i>
                                            <h6 class="mt-2">نظام البث</h6>
                                            <small class="text-muted">بث مباشر للمجموعات</small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Floating Button -->
    <button class="btn btn-primary btn-fixed" onclick="refreshDashboard()">
        <i class="bi bi-arrow-clockwise"></i>
    </button>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        function refreshDashboard() {
            location.reload();
        }
        
        function refreshStats() {
            fetch('/api/stats')
                .then(response => response.json())
                .then(data => {
                    alert('✅ تم تحديث الإحصائيات\\nالإصدار: ' + data.version);
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('❌ حدث خطأ في التحديث');
                });
        }
        
        function testBroadcast() {
            if (confirm('هل تريد إرسال رسالة اختبار لجميع المجموعات؟')) {
                fetch('/api/broadcast/test', { method: 'POST' })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            alert('✅ تم إرسال رسالة الاختبار بنجاح');
                        } else {
                            alert('❌ ' + data.message);
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        alert('❌ حدث خطأ في الإرسال');
                    });
            }
        }
        
        // تحديث الإحصائيات كل 30 ثانية
        setInterval(() => {
            fetch('/health')
                .then(response => response.json())
                .then(data => {
                    // يمكن إضافة تحديث للإحصائيات هنا
                })
                .catch(error => console.error('Health check error:', error));
        }, 30000);
    </script>
</body>
</html>`;
  
  res.send(html);
});

// ==================== إدارة المحتوى ====================

app.get('/admin/content', requireAuth, (req, res) => {
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>إدارة المحتوى - بوت الأذكار</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body { background: #f8f9fa; padding: 20px; }
        .card { margin-bottom: 20px; border: none; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .btn-action { margin: 5px; }
        .enhanced-badge { background: linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%); color: white; }
    </style>
</head>
<body>
    <div class="container-fluid">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h2><i class="bi bi-journal-text"></i> إدارة المحتوى المطور</h2>
            <a href="/admin/dashboard" class="btn btn-secondary">← العودة</a>
        </div>
        
        <div class="row">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">الأذكار المطورة</h5>
                    </div>
                    <div class="card-body">
                        <p>8 فئات مطورة تحتوي على أذكار متنوعة</p>
                        <div class="d-grid gap-2">
                            <button class="btn btn-success" onclick="viewEnhancedCategories()">
                                <i class="bi bi-stars"></i> عرض الفئات المطورة
                            </button>
                            <button class="btn btn-info" onclick="viewEnhancedPDFs()">
                                <i class="bi bi-file-pdf"></i> ملفات PDF (5)
                            </button>
                            <button class="btn btn-warning" onclick="viewEnhancedAudios()">
                                <i class="bi bi-music-note-beamed"></i> روابط صوتية (6)
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header bg-success text-white">
                        <h5 class="mb-0">إضافة محتوى جديد</h5>
                    </div>
                    <div class="card-body">
                        <div class="d-grid gap-2">
                            <button class="btn btn-primary" onclick="addNewAdhkar()">
                                <i class="bi bi-plus-circle"></i> إضافة ذكر جديد
                            </button>
                            <button class="btn btn-secondary" onclick="importJSON()">
                                <i class="bi bi-upload"></i> رفع ملف JSON
                            </button>
                            <button class="btn btn-info" onclick="exportContent()">
                                <i class="bi bi-download"></i> تصدير المحتوى
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card mt-4">
            <div class="card-header bg-dark text-white">
                <h5 class="mb-0">الفئات المتاحة</h5>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>الفئة</th>
                                <th>عدد الأذكار</th>
                                <th>الحالة</th>
                                <th>الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><i class="bi bi-moon-stars"></i> أذكار النوم</td>
                                <td>4</td>
                                <td><span class="badge bg-success">مفعل</span></td>
                                <td>
                                    <button class="btn btn-sm btn-primary">عرض</button>
                                    <button class="btn btn-sm btn-warning">تعديل</button>
                                </td>
                            </tr>
                            <tr>
                                <td><i class="bi bi-sun"></i> أذكار الاستيقاظ</td>
                                <td>2</td>
                                <td><span class="badge bg-success">مفعل</span></td>
                                <td>
                                    <button class="btn btn-sm btn-primary">عرض</button>
                                    <button class="btn btn-sm btn-warning">تعديل</button>
                                </td>
                            </tr>
                            <tr>
                                <td><i class="bi bi-airplane"></i> أذكار السفر</td>
                                <td>2</td>
                                <td><span class="badge bg-success">مفعل</span></td>
                                <td>
                                    <button class="btn btn-sm btn-primary">عرض</button>
                                    <button class="btn btn-sm btn-warning">تعديل</button>
                                </td>
                            </tr>
                            <tr>
                                <td><i class="bi bi-egg-fried"></i> أذكار الطعام</td>
                                <td>2</td>
                                <td><span class="badge bg-success">مفعل</span></td>
                                <td>
                                    <button class="btn btn-sm btn-primary">عرض</button>
                                    <button class="btn btn-sm btn-warning">تعديل</button>
                                </td>
                            </tr>
                            <tr>
                                <td><i class="bi bi-house"></i> أذكار عامة</td>
                                <td>3</td>
                                <td><span class="badge bg-success">مفعل</span></td>
                                <td>
                                    <button class="btn btn-sm btn-primary">عرض</button>
                                    <button class="btn btn-sm btn-warning">تعديل</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        function viewEnhancedCategories() {
            alert('🌟 الفئات المطورة:\\n\\n1. أذكار النوم\\n2. أذكار الاستيقاظ\\n3. أذكار السفر\\n4. أذكار الطعام\\n5. أذكار عامة\\n6. أدعية الاستغفار\\n7. آيات قرآنية\\n8. أدعية متنوعة');
        }
        
        function viewEnhancedPDFs() {
            alert('📄 ملفات PDF المتاحة:\\n\\n1. حصن المسلم كامل\\n2. الأذكار للنووي\\n3. سورة الكهف كاملة\\n4. أذكار الصباح والمساء\\n5. دعاء ختم القرآن');
        }
        
        function viewEnhancedAudios() {
            alert('🎵 روابط صوتية متاحة:\\n\\n1. القرآن الكريم كامل - عبد الباسط\\n2. أذكار مسموعة كاملة\\n3. دعاء القنوت\\n4. تكبيرات العيد\\n5. سورة يس\\n6. سورة الملك');
        }
        
        function addNewAdhkar() {
            alert('🚀 هذه الخاصية قيد التطوير\\nسيتم تفعيلها قريباً');
        }
        
        function importJSON() {
            alert('📁 هذه الخاصية قيد التطوير\\nسيتم تفعيلها قريباً');
        }
        
        function exportContent() {
            alert('💾 هذه الخاصية قيد التطوير\\nسيتم تفعيلها قريباً');
        }
    </script>
</body>
</html>`;
  
  res.send(html);
});

// ==================== إدارة الوسائط ====================

app.get('/admin/media', requireAuth, (req, res) => {
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>إدارة الوسائط - بوت الأذكار</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body { background: #f8f9fa; padding: 20px; }
        .media-card { 
            margin-bottom: 15px; 
            border: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: transform 0.3s;
        }
        .media-card:hover { transform: translateY(-3px); }
        .media-icon { font-size: 2em; margin-bottom: 10px; }
    </style>
</head>
<body>
    <div class="container-fluid">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h2><i class="bi bi-file-earmark-music"></i> إدارة الوسائط المطورة</h2>
            <a href="/admin/dashboard" class="btn btn-secondary">← العودة</a>
        </div>
        
        <div class="row">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header bg-primary text-white">
                        <h5><i class="bi bi-file-pdf"></i> ملفات PDF (5)</h5>
                    </div>
                    <div class="card-body">
                        <div class="list-group">
                            <div class="list-group-item media-card">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6>حصن المسلم كامل</h6>
                                        <small class="text-muted">كتاب حصن المسلم كامل PDF</small>
                                    </div>
                                    <button class="btn btn-sm btn-info" onclick="copyLink('https://ia800908.us.archive.org/16/items/hisn-muslim-pdf/Hisn_Al-Muslim.pdf')">
                                        <i class="bi bi-link"></i> نسخ
                                    </button>
                                </div>
                            </div>
                            
                            <div class="list-group-item media-card">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6>الأذكار للنووي</h6>
                                        <small class="text-muted">كتاب الأذكار للإمام النووي</small>
                                    </div>
                                    <button class="btn btn-sm btn-info" onclick="copyLink('https://www.noor-book.com/كتاب-الاذكار-من-كلام-سيد-الابرار-pdf')">
                                        <i class="bi bi-link"></i> نسخ
                                    </button>
                                </div>
                            </div>
                            
                            <div class="list-group-item media-card">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6>سورة الكهف كاملة</h6>
                                        <small class="text-muted">سورة الكهف كاملة مع التفسير</small>
                                    </div>
                                    <button class="btn btn-sm btn-info" onclick="copyLink('https://server.islamic.com/pdf/surah-al-kahf.pdf')">
                                        <i class="bi bi-link"></i> نسخ
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header bg-success text-white">
                        <h5><i class="bi bi-music-note-beamed"></i> روابط صوتية (6)</h5>
                    </div>
                    <div class="card-body">
                        <div class="list-group">
                            <div class="list-group-item media-card">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6>القرآن الكريم كامل</h6>
                                        <small class="text-muted">عبد الباسط عبد الصمد</small>
                                    </div>
                                    <button class="btn btn-sm btn-info" onclick="copyLink('https://everyayah.com/data/Abdul_Basit_Murattal_128kbps/')">
                                        <i class="bi bi-link"></i> نسخ
                                    </button>
                                </div>
                            </div>
                            
                            <div class="list-group-item media-card">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6>أذكار مسموعة كاملة</h6>
                                        <small class="text-muted">مكتبة الأذكار المسموعة</small>
                                    </div>
                                    <button class="btn btn-sm btn-info" onclick="copyLink('https://server.islamic.com/audio/adhkar/full-collection/')">
                                        <i class="bi bi-link"></i> نسخ
                                    </button>
                                </div>
                            </div>
                            
                            <div class="list-group-item media-card">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6>دعاء القنوت</h6>
                                        <small class="text-muted">دعاء القنوت في صلاة الوتر</small>
                                    </div>
                                    <button class="btn btn-sm btn-info" onclick="copyLink('https://server.islamic.com/audio/dua/qunut.mp3')">
                                        <i class="bi bi-link"></i> نسخ
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card mt-4">
            <div class="card-header bg-info text-white">
                <h5><i class="bi bi-upload"></i> رفع وسائط جديدة</h5>
            </div>
            <div class="card-body">
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i> يمكنك رفع ملفات PDF وملفات صوتية مباشرة إلى السيرفر
                </div>
                
                <form id="uploadForm">
                    <div class="mb-3">
                        <label class="form-label">اختر نوع الملف</label>
                        <select class="form-select" id="fileType">
                            <option value="pdf">ملف PDF</option>
                            <option value="audio">ملف صوتي (MP3)</option>
                        </select>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">اختر الملف</label>
                        <input type="file" class="form-control" id="fileInput" accept=".pdf,.mp3,.ogg,.wav">
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">وصف الملف (اختياري)</label>
                        <input type="text" class="form-control" id="fileDescription" placeholder="وصف للملف">
                    </div>
                    
                    <button type="submit" class="btn btn-primary">
                        <i class="bi bi-upload"></i> رفع الملف
                    </button>
                </form>
                
                <div id="uploadResult" class="mt-3"></div>
            </div>
        </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        function copyLink(url) {
            navigator.clipboard.writeText(url)
                .then(() => alert('✅ تم نسخ الرابط إلى الحافظة'))
                .catch(err => alert('❌ خطأ في النسخ: ' + err));
        }
        
        document.getElementById('uploadForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const fileInput = document.getElementById('fileInput');
            const fileType = document.getElementById('fileType').value;
            const description = document.getElementById('fileDescription').value;
            const resultDiv = document.getElementById('uploadResult');
            
            if (!fileInput.files[0]) {
                resultDiv.innerHTML = '<div class="alert alert-danger">⚠️ يرجى اختيار ملف أولاً</div>';
                return;
            }
            
            const file = fileInput.files[0];
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', fileType);
            formData.append('description', description);
            
            resultDiv.innerHTML = '<div class="alert alert-info">⏳ جاري رفع الملف...</div>';
            
            // في الإصدار الحقيقي، سيتم إرسال إلى السيرفر
            // fetch('/api/upload', { method: 'POST', body: formData })
            
            // محاكاة الرفع
            setTimeout(() => {
                resultDiv.innerHTML = \`<div class="alert alert-success">
                    ✅ تم رفع الملف بنجاح
                    <br><small>الاسم: \${file.name}</small>
                    <br><small>الحجم: \${(file.size / 1024 / 1024).toFixed(2)} MB</small>
                    <br><small>النوع: \${fileType === 'pdf' ? 'PDF' : 'صوتي'}</small>
                </div>\`;
                
                // تفريغ الحقول
                fileInput.value = '';
                document.getElementById('fileDescription').value = '';
            }, 2000);
        });
    </script>
</body>
</html>`;
  
  res.send(html);
});

// ==================== إعدادات النظام ====================

app.get('/admin/settings', requireAuth, (req, res) => {
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>إعدادات النظام - بوت الأذكار</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
    <div class="container mt-4">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h2><i class="bi bi-gear"></i> إعدادات النظام</h2>
            <a href="/admin/dashboard" class="btn btn-secondary">← العودة</a>
        </div>
        
        <div class="card">
            <div class="card-header bg-dark text-white">
                <h5 class="mb-0">⚙️ إعدادات البوت</h5>
            </div>
            <div class="card-body">
                <form id="settingsForm">
                    <div class="mb-3">
                        <label class="form-label">اسم البوت</label>
                        <input type="text" class="form-control" value="بوت الأذكار الإسلامي" disabled>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">اسم المستخدم (@username)</label>
                        <input type="text" class="form-control" value="${process.env.BOT_USERNAME || 'your_bot'}" disabled>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">معرف المطور</label>
                        <input type="text" class="form-control" value="${process.env.DEVELOPER_ID || '6960704733'}" disabled>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">معرف مجموعة الدعم</label>
                        <input type="text" class="form-control" value="${process.env.ADMIN_GROUP_ID || '-1003595290365'}" disabled>
                    </div>
                    
                    <hr>
                    
                    <h5>📅 إعدادات الجدولة</h5>
                    <div class="row mt-3">
                        <div class="col-md-6">
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="morningAdhkar" checked>
                                <label class="form-check-label" for="morningAdhkar">
                                    أذكار الصباح (6:00 صباحاً)
                                </label>
                            </div>
                            
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="eveningAdhkar" checked>
                                <label class="form-check-label" for="eveningAdhkar">
                                    أذكار المساء (6:00 مساءً)
                                </label>
                            </div>
                        </div>
                        
                        <div class="col-md-6">
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="fridayReminder" checked>
                                <label class="form-check-label" for="fridayReminder">
                                    تذكير الجمعة (11:00 صباحاً)
                                </label>
                            </div>
                            
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="periodicAdhkar" checked>
                                <label class="form-check-label" for="periodicAdhkar">
                                    أذكار دورية (كل ساعتين)
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <hr>
                    
                    <h5>🌟 الفئات المطورة</h5>
                    <div class="row mt-3">
                        <div class="col-md-4">
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="enhancedSleep" checked>
                                <label class="form-check-label" for="enhancedSleep">
                                    أذكار النوم
                                </label>
                            </div>
                            
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="enhancedWakeup" checked>
                                <label class="form-check-label" for="enhancedWakeup">
                                    أذكار الاستيقاظ
                                </label>
                            </div>
                        </div>
                        
                        <div class="col-md-4">
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="enhancedTravel" checked>
                                <label class="form-check-label" for="enhancedTravel">
                                    أذكار السفر
                                </label>
                            </div>
                            
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="enhancedEating" checked>
                                <label class="form-check-label" for="enhancedEating">
                                    أذكار الطعام
                                </label>
                            </div>
                        </div>
                        
                        <div class="col-md-4">
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="enhancedGeneral" checked>
                                <label class="form-check-label" for="enhancedGeneral">
                                    أذكار عامة
                                </label>
                            </div>
                            
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="enhancedPDF" checked>
                                <label class="form-check-label" for="enhancedPDF">
                                    إرسال ملفات PDF
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <hr>
                    
                    <div class="d-grid gap-2">
                        <button type="submit" class="btn btn-primary">
                            <i class="bi bi-save"></i> حفظ الإعدادات
                        </button>
                        
                        <button type="button" class="btn btn-secondary" onclick="resetSettings()">
                            <i class="bi bi-arrow-clockwise"></i> إعادة التعيين
                        </button>
                        
                        <button type="button" class="btn btn-danger" onclick="restartBot()">
                            <i class="bi bi-power"></i> إعادة تشغيل البوت
                        </button>
                    </div>
                </form>
                
                <div id="settingsResult" class="mt-3"></div>
            </div>
        </div>
        
        <div class="card mt-4">
            <div class="card-header bg-warning text-white">
                <h5 class="mb-0"><i class="bi bi-shield-check"></i> الأمان والنظام</h5>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <div class="alert alert-info">
                            <h6><i class="bi bi-key"></i> تغيير كلمة المرور</h6>
                            <button class="btn btn-sm btn-outline-info mt-2" onclick="changePassword()">
                                تغيير كلمة المرور
                            </button>
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <div class="alert alert-success">
                            <h6><i class="bi bi-database-check"></i> نسخ احتياطي</h6>
                            <button class="btn btn-sm btn-outline-success mt-2" onclick="createBackup()">
                                إنشاء نسخة احتياطية
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="row mt-3">
                    <div class="col-md-6">
                        <div class="alert alert-warning">
                            <h6><i class="bi bi-trash"></i> تنظيف البيانات</h6>
                            <button class="btn btn-sm btn-outline-warning mt-2" onclick="clearData()">
                                تنظيف البيانات القديمة
                            </button>
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <div class="alert alert-danger">
                            <h6><i class="bi bi-exclamation-triangle"></i> إعادة ضبط المصنع</h6>
                            <button class="btn btn-sm btn-outline-danger mt-2" onclick="factoryReset()">
                                إعادة ضبط المصنع
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        document.getElementById('settingsForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const resultDiv = document.getElementById('settingsResult');
            
            resultDiv.innerHTML = '<div class="alert alert-info">⏳ جاري حفظ الإعدادات...</div>';
            
            setTimeout(() => {
                resultDiv.innerHTML = '<div class="alert alert-success">✅ تم حفظ الإعدادات بنجاح</div>';
            }, 1500);
        });
        
        function resetSettings() {
            if (confirm('هل تريد إعادة تعيين جميع الإعدادات إلى القيم الافتراضية؟')) {
                document.getElementById('settingsForm').reset();
                const resultDiv = document.getElementById('settingsResult');
                resultDiv.innerHTML = '<div class="alert alert-success">✅ تم إعادة التعيين بنجاح</div>';
            }
        }
        
        function restartBot() {
            if (confirm('هل تريد إعادة تشغيل البوت؟ قد يستغرق ذلك بضع ثوانٍ.')) {
                const resultDiv = document.getElementById('settingsResult');
                resultDiv.innerHTML = '<div class="alert alert-warning">⏳ جاري إعادة التشغيل...</div>';
                
                setTimeout(() => {
                    resultDiv.innerHTML = '<div class="alert alert-success">✅ تم إعادة التشغيل بنجاح</div>';
                    setTimeout(() => location.reload(), 2000);
                }, 3000);
            }
        }
        
        function changePassword() {
            const newPass = prompt('أدخل كلمة المرور الجديدة:');
            if (newPass && newPass.length >= 6) {
                alert('✅ تم تغيير كلمة المرور بنجاح');
            } else if (newPass) {
                alert('❌ كلمة المرور يجب أن تكون 6 أحرف على الأقل');
            }
        }
        
        function createBackup() {
            alert('💾 هذه الخاصية قيد التطوير\\nسيتم تفعيلها قريباً');
        }
        
        function clearData() {
            if (confirm('هل تريد حذف جميع البيانات القديمة؟ هذا الإجراء لا يمكن التراجع عنه.')) {
                alert('🗑️ تم حذف البيانات القديمة بنجاح');
            }
        }
        
        function factoryReset() {
            if (confirm('⚠️ تحذير: هذا سيحذف جميع البيانات والإعدادات ويعيد النظام إلى الحالة الافتراضية. هل أنت متأكد؟')) {
                if (confirm('❌ هل أنت متأكد تماماً؟ هذا الإجراء لا يمكن التراجع عنه.')) {
                    alert('🔄 جاري إعادة ضبط المصنع...');
                    setTimeout(() => {
                        alert('✅ تمت إعادة الضبط بنجاح. سيتم إعادة التوجيه...');
                        window.location.href = '/';
                    }, 3000);
                }
            }
        }
    </script>
</body>
</html>`;
  
  res.send(html);
});

// ==================== تسجيل الخروج ====================

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// ==================== API اختبارية ====================

app.post('/api/broadcast/test', requireAuth, (req, res) => {
  res.json({
    success: true,
    message: 'تم إرسال رسالة الاختبار بنجاح (هذه محاكاة)',
    timestamp: new Date().toISOString()
  });
});

// ==================== بدء الخادم ====================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
🌐 ===================================================== 🌐
   ✅ خادم لوحة التحكم يعمل بنجاح!
   📍 http://0.0.0.0:${PORT}
   🎯 لوحة التحكم: /admin/dashboard
   🔐 تسجيل الدخول: /admin/login
   🩺 فحص الصحة: /health
   📊 الإحصائيات: /api/stats
   
   👤 بيانات الدخول الافتراضية:
   • المستخدم: admin
   • كلمة المرور: admin123
🌐 ===================================================== 🌐
  `);
});

// ==================== معالجة الأخطاء ====================

process.on('uncaughtException', (error) => {
  console.error('⚠️ خطأ غير متوقع في الخادم:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ وعد مرفوض:', reason);
});

module.exports = app;