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
const multer = require('multer');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 10000;

// إعدادات الوقت
moment.tz.setDefault(process.env.TIMEZONE || 'Asia/Riyadh');

// إعدادات Express
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static('uploads'));

// جلسة الإدارة
app.use(session({
  secret: process.env.SESSION_SECRET || 'islamic-bot-admin-secret-2024',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// إعداد multer للرفع
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// تسجيل الطلبات
app.use((req, res, next) => {
  const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
  console.log(`[${timestamp}] ${req.method} ${req.url} - ${req.ip}`);
  next();
});

// ==================== قاعدة البيانات المحسنة ====================
const dbPath = path.join(__dirname, 'data', 'database');
const db = {
  groups: {},
  users: {},
  adhkar: {},
  enhancedAdhkar: {},
  schedules: {},
  media: {},
  categories: {},
  broadcasts: {},
  streams: {}
};

// تحميل قاعدة البيانات المحسنة
async function loadEnhancedDatabase() {
  try {
    await fs.ensureDir(dbPath);
    
    // تحميل ملف الأذكار المطورة
    const enhancedPath = path.join(__dirname, 'data', 'enhanced-adhkar.json');
    if (await fs.pathExists(enhancedPath)) {
      db.enhancedAdhkar = JSON.parse(await fs.readFile(enhancedPath, 'utf8'));
      console.log('✅ تم تحميل الأذكار المطورة بنجاح');
    }
    
    // إنشاء قاعدة بيانات محسنة
    const files = ['groups', 'users', 'adhkar', 'schedules', 'media', 'categories', 'broadcasts', 'streams'];
    
    for (const file of files) {
      const filePath = path.join(dbPath, `${file}.json`);
      if (await fs.pathExists(filePath)) {
        db[file] = JSON.parse(await fs.readFile(filePath, 'utf8'));
        console.log(`✅ تم تحميل ${file}: ${Object.keys(db[file]).length} عنصر`);
      } else {
        db[file] = {};
      }
    }
    
    // تهيئة البيانات الافتراضية المحسنة
    await initializeEnhancedDefaultData();
    
    console.log('📊 قاعدة البيانات المطورة جاهزة');
    return true;
  } catch (error) {
    console.error('❌ خطأ في تحميل قاعدة البيانات المطورة:', error);
    return false;
  }
}

// تهيئة البيانات الافتراضية المحسنة
async function initializeEnhancedDefaultData() {
  // فئات مطورة افتراضية
  if (Object.keys(db.categories).length === 0) {
    const enhancedCats = db.enhancedAdhkar.categories || {};
    
    for (const [catId, catData] of Object.entries(enhancedCats)) {
      db.categories[catId] = {
        id: catId,
        name: catData.name,
        description: catData.description || `فئة ${catData.name}`,
        icon: catData.icon || '🌟',
        enabled: true,
        isEnhanced: true,
        items: catData.items || []
      };
    }
  }
  
  // إعدادات المجموعات المحسنة
  if (Object.keys(db.groups).length === 0) {
    db.groups['default'] = {
      id: 'default',
      name: 'إعدادات افتراضية مطورة',
      settings: {
        morningAdhkar: true,
        eveningAdhkar: true,
        periodicAdhkar: true,
        periodicEnhancedAdhkar: true, // تفعيل الأذكار المطورة
        fridayReminder: true,
        randomInterval: 120,
        morningTime: '06:00',
        eveningTime: '18:00',
        includeAudio: true,
        includePDF: true,
        enhancedCategories: {
          sleep: true,
          wakeup: true,
          travel: true,
          eating: true,
          general: true,
          repentance: true,
          quran: true
        },
        active: true
      }
    };
  }
  
  // بيانات الوسائط
  if (Object.keys(db.media).length === 0) {
    db.media = {
      pdfs: db.enhancedAdhkar.pdf_resources || [],
      audios: db.enhancedAdhkar.audio_resources || []
    };
  }
}

// حفظ قاعدة البيانات المحسنة
async function saveEnhancedDatabase() {
  try {
    await fs.ensureDir(dbPath);
    
    const files = ['groups', 'users', 'adhkar', 'schedules', 'media', 'categories', 'broadcasts', 'streams'];
    
    for (const file of files) {
      const filePath = path.join(dbPath, `${file}.json`);
      await fs.writeFile(filePath, JSON.stringify(db[file], null, 2));
    }
    
    console.log('💾 تم حفظ قاعدة البيانات المطورة');
    return true;
  } catch (error) {
    console.error('❌ خطأ في حفظ قاعدة البيانات المطورة:', error);
    return false;
  }
}

// ==================== واجهة الإدارة المحسنة ====================

// وظيفة التحقق من المصادقة
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/admin/login');
  }
  next();
}

// صفحة تسجيل الدخول
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  
  // هنا يمكنك إضافة منطق التحقق من قاعدة البيانات
  if (username === 'admin' && password === (process.env.ADMIN_PASSWORD || 'admin123')) {
    req.session.userId = 'admin';
    req.session.isAdmin = true;
    res.json({ success: true, redirect: '/admin/dashboard' });
  } else {
    res.json({ success: false, message: 'بيانات الدخول غير صحيحة' });
  }
});

// لوحة التحكم الرئيسية
app.get('/admin/dashboard', requireAuth, async (req, res) => {
  try {
    const stats = await getAdminStats();
    
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
            --success-color: #28a745;
            --warning-color: #ffc107;
            --danger-color: #dc3545;
        }
        
        body {
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
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
            box-shadow: 0 10px 25px rgba(0,0,0,0.12);
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
        
        .table th {
            border-top: none;
            font-weight: 600;
            color: var(--primary-color);
        }
        
        .badge-enhanced {
            background: linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%);
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
                            <a class="nav-link" href="/admin/groups">
                                <i class="bi bi-people"></i> إدارة المجموعات
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/admin/media">
                                <i class="bi bi-file-earmark-music"></i> الوسائط
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/admin/categories">
                                <i class="bi bi-folder"></i> الأقسام
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/admin/broadcast">
                                <i class="bi bi-megaphone"></i> البث
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/admin/streams">
                                <i class="bi bi-camera-video"></i> البث المباشر
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/admin/settings">
                                <i class="bi bi-gear"></i> الإعدادات
                            </a>
                        </li>
                        <li class="nav-item mt-4">
                            <a class="nav-link text-danger" href="/admin/logout">
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
                
                <!-- Statistics Cards -->
                <div class="row">
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-icon bg-primary text-white">
                                <i class="bi bi-people"></i>
                            </div>
                            <div class="stat-value">${stats.groups}</div>
                            <div class="stat-label">المجموعات النشطة</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-icon bg-success text-white">
                                <i class="bi bi-journal-text"></i>
                            </div>
                            <div class="stat-value">${stats.adhkar}</div>
                            <div class="stat-label">الأذكار الكلية</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-icon bg-warning text-white">
                                <i class="bi bi-folder"></i>
                            </div>
                            <div class="stat-value">${stats.categories}</div>
                            <div class="stat-label">الأقسام المطورة</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-icon bg-info text-white">
                                <i class="bi bi-file-earmark-music"></i>
                            </div>
                            <div class="stat-value">${stats.media}</div>
                            <div class="stat-label">الوسائط</div>
                        </div>
                    </div>
                </div>
                
                <!-- Enhanced Features -->
                <div class="row mt-4">
                    <div class="col-md-8">
                        <div class="stat-card">
                            <h5><i class="bi bi-stars"></i> المميزات المطورة</h5>
                            <div class="row mt-3">
                                <div class="col-md-6">
                                    <ul class="list-group list-group-flush">
                                        <li class="list-group-item d-flex justify-content-between align-items-center">
                                            أذكار مطورة متنوعة
                                            <span class="badge bg-success rounded-pill">${stats.enhancedCategories}</span>
                                        </li>
                                        <li class="list-group-item d-flex justify-content-between align-items-center">
                                            ملفات PDF
                                            <span class="badge bg-info rounded-pill">${stats.pdfs}</span>
                                        </li>
                                        <li class="list-group-item d-flex justify-content-between align-items-center">
                                            روابط صوتية
                                            <span class="badge bg-warning rounded-pill">${stats.audios}</span>
                                        </li>
                                    </ul>
                                </div>
                                <div class="col-md-6">
                                    <ul class="list-group list-group-flush">
                                        <li class="list-group-item d-flex justify-content-between align-items-center">
                                            نظام بث مباشر
                                            <span class="badge bg-danger rounded-pill">${stats.streams}</span>
                                        </li>
                                        <li class="list-group-item d-flex justify-content-between align-items-center">
                                            جدولة متقدمة
                                            <span class="badge bg-primary rounded-pill">${stats.scheduled}</span>
                                        </li>
                                        <li class="list-group-item d-flex justify-content-between align-items-center">
                                            نسبة النجاح
                                            <span class="badge bg-success rounded-pill">${stats.successRate}%</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-4">
                        <div class="stat-card">
                            <h5><i class="bi bi-lightning-charge"></i> إجراءات سريعة</h5>
                            <div class="d-grid gap-2 mt-3">
                                <button class="btn btn-primary" onclick="quickAction('add_adhkar')">
                                    <i class="bi bi-plus-circle"></i> إضافة ذكر جديد
                                </button>
                                <button class="btn btn-success" onclick="quickAction('broadcast')">
                                    <i class="bi bi-megaphone"></i> بث فوري
                                </button>
                                <button class="btn btn-info" onclick="quickAction('upload_media')">
                                    <i class="bi bi-upload"></i> رفع وسائط
                                </button>
                                <button class="btn btn-warning" onclick="quickAction('manage_categories')">
                                    <i class="bi bi-folder-plus"></i> إدارة الأقسام
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Recent Activity -->
                <div class="row mt-4">
                    <div class="col-12">
                        <div class="stat-card">
                            <h5><i class="bi bi-clock-history"></i> آخر النشاطات</h5>
                            <div class="table-responsive mt-3">
                                <table class="table table-hover">
                                    <thead>
                                        <tr>
                                            <th>الوقت</th>
                                            <th>النوع</th>
                                            <th>التفاصيل</th>
                                            <th>الحالة</th>
                                        </tr>
                                    </thead>
                                    <tbody id="recentActivity">
                                        <!-- سيتم ملؤها بالجافاسكربت -->
                                    </tbody>
                                </table>
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
        async function refreshDashboard() {
            const btn = event.target;
            btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
            btn.classList.add('spinning');
            
            // إعادة تحميل الصفحة
            setTimeout(() => {
                window.location.reload();
            }, 500);
        }
        
        function quickAction(action) {
            switch(action) {
                case 'add_adhkar':
                    window.location.href = '/admin/content?action=add';
                    break;
                case 'broadcast':
                    window.location.href = '/admin/broadcast';
                    break;
                case 'upload_media':
                    window.location.href = '/admin/media?upload=true';
                    break;
                case 'manage_categories':
                    window.location.href = '/admin/categories';
                    break;
            }
        }
        
        // تحميل النشاطات الأخيرة
        async function loadRecentActivity() {
            try {
                const response = await fetch('/api/admin/recent-activity');
                const activities = await response.json();
                
                const tbody = document.getElementById('recentActivity');
                tbody.innerHTML = '';
                
                activities.forEach(activity => {
                    const row = document.createElement('tr');
                    row.innerHTML = \`
                        <td>\${activity.time}</td>
                        <td><span class="badge \${activity.typeClass}">\${activity.type}</span></td>
                        <td>\${activity.details}</td>
                        <td><span class="badge \${activity.statusClass}">\${activity.status}</span></td>
                    \`;
                    tbody.appendChild(row);
                });
            } catch (error) {
                console.error('Error loading activity:', error);
            }
        }
        
        // تحديث كل 30 ثانية
        setInterval(loadRecentActivity, 30000);
        
        // التحميل الأولي
        loadRecentActivity();
    </script>
</body>
</html>`;
    
    res.send(html);
  } catch (error) {
    console.error('Error loading dashboard:', error);
    res.status(500).send('حدث خطأ في تحميل لوحة التحكم');
  }
});

// إحصائيات الإدارة
async function getAdminStats() {
  return {
    groups: Object.keys(db.groups).length,
    adhkar: Object.keys(db.adhkar).length,
    categories: Object.keys(db.categories).length,
    media: Object.keys(db.media).length,
    enhancedCategories: Object.keys(db.enhancedAdhkar.categories || {}).length,
    pdfs: (db.enhancedAdhkar.pdf_resources || []).length,
    audios: (db.enhancedAdhkar.audio_resources || []).length,
    streams: Object.keys(db.streams).length,
    scheduled: Object.keys(db.schedules).length,
    successRate: 95
  };
}

// واجهة إدارة المحتوى
app.get('/admin/content', requireAuth, (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html dir="rtl">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>إدارة المحتوى</title>
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
                          <p>عدد الفئات المطورة: ${Object.keys(db.enhancedAdhkar.categories || {}).length}</p>
                          <div class="d-grid gap-2">
                              <button class="btn btn-success" onclick="manageEnhancedCategories()">
                                  <i class="bi bi-stars"></i> إدارة الفئات المطورة
                              </button>
                              <button class="btn btn-info" onclick="viewEnhancedPDFs()">
                                  <i class="bi bi-file-pdf"></i> ملفات PDF (${(db.enhancedAdhkar.pdf_resources || []).length})
                              </button>
                              <button class="btn btn-warning" onclick="viewEnhancedAudios()">
                                  <i class="bi bi-music-note-beamed"></i> روابط صوتية (${(db.enhancedAdhkar.audio_resources || []).length})
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
                              <a href="/admin/content/add" class="btn btn-primary">
                                  <i class="bi bi-plus-circle"></i> إضافة ذكر جديد
                              </a>
                              <a href="/admin/content/upload" class="btn btn-secondary">
                                  <i class="bi bi-upload"></i> رفع ملف JSON
                              </a>
                              <a href="/admin/content/export" class="btn btn-info">
                                  <i class="bi bi-download"></i> تصدير المحتوى
                              </a>
                              <a href="/admin/content/backup" class="btn btn-dark">
                                  <i class="bi bi-hdd"></i> نسخة احتياطية
                              </a>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
          
          <div class="card mt-4">
              <div class="card-header bg-dark text-white">
                  <h5 class="mb-0">جميع الأذكار</h5>
              </div>
              <div class="card-body">
                  <div class="table-responsive">
                      <table class="table table-hover">
                          <thead>
                              <tr>
                                  <th>ID</th>
                                  <th>النص</th>
                                  <th>الفئة</th>
                                  <th>الحالة</th>
                                  <th>الإجراءات</th>
                              </tr>
                          </thead>
                          <tbody id="adhkarTable">
                              <!-- سيتم ملؤها بالجافاسكربت -->
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      </div>
      
      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
      <script>
          async function loadAdhkar() {
              try {
                  const response = await fetch('/api/admin/adhkar');
                  const adhkarList = await response.json();
                  
                  const tbody = document.getElementById('adhkarTable');
                  tbody.innerHTML = '';
                  
                  adhkarList.forEach(adhkar => {
                      const row = document.createElement('tr');
                      row.innerHTML = \`
                          <td>\${adhkar.id}</td>
                          <td>\${adhkar.text.substring(0, 50)}...</td>
                          <td>\${adhkar.category}</td>
                          <td>
                              <span class="badge \${adhkar.enabled ? 'bg-success' : 'bg-danger'}">
                                  \${adhkar.enabled ? 'مفعل' : 'معطل'}
                              </span>
                              \${adhkar.isEnhanced ? '<span class="badge enhanced-badge">مطور</span>' : ''}
                          </td>
                          <td>
                              <button class="btn btn-sm btn-primary" onclick="editAdhkar('\${adhkar.id}')">
                                  <i class="bi bi-pencil"></i>
                              </button>
                              <button class="btn btn-sm btn-danger" onclick="deleteAdhkar('\${adhkar.id}')">
                                  <i class="bi bi-trash"></i>
                              </button>
                          </td>
                      \`;
                      tbody.appendChild(row);
                  });
              } catch (error) {
                  console.error('Error loading adhkar:', error);
              }
          }
          
          function manageEnhancedCategories() {
              window.location.href = '/admin/categories?enhanced=true';
          }
          
          function viewEnhancedPDFs() {
              window.location.href = '/admin/media?type=pdf';
          }
          
          function viewEnhancedAudios() {
              window.location.href = '/admin/media?type=audio';
          }
          
          function editAdhkar(id) {
              window.location.href = '/admin/content/edit?id=' + id;
          }
          
          function deleteAdhkar(id) {
              if (confirm('هل أنت متأكد من حذف هذا الذكر؟')) {
                  fetch('/api/admin/adhkar/' + id, { method: 'DELETE' })
                      .then(() => loadAdhkar())
                      .catch(error => console.error('Error:', error));
              }
          }
          
          // التحميل الأولي
          loadAdhkar();
      </script>
  </body>
  </html>
  `);
});

// API لإدارة المحتوى
app.get('/api/admin/adhkar', requireAuth, (req, res) => {
  const adhkarList = Object.values(db.adhkar).map(item => ({
    id: item.id,
    text: item.text,
    category: item.category,
    enabled: item.enabled !== false,
    isEnhanced: item.isEnhanced || false
  }));
  
  res.json(adhkarList);
});

// ==================== إدارة الوسائط ====================

app.get('/admin/media', requireAuth, (req, res) => {
  const pdfs = db.enhancedAdhkar.pdf_resources || [];
  const audios = db.enhancedAdhkar.audio_resources || [];
  
  res.send(`
  <!DOCTYPE html>
  <html dir="rtl">
  <head>
      <meta charset="UTF-8">
      <title>إدارة الوسائط المطورة</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
  </head>
  <body>
      <div class="container mt-4">
          <h2><i class="bi bi-file-earmark-music"></i> إدارة الوسائط المطورة</h2>
          
          <div class="row mt-4">
              <div class="col-md-6">
                  <div class="card">
                      <div class="card-header bg-primary text-white">
                          <h5>📄 ملفات PDF (${pdfs.length})</h5>
                      </div>
                      <div class="card-body">
                          <ul class="list-group">
                              ${pdfs.map((pdf, index) => `
                              <li class="list-group-item d-flex justify-content-between align-items-center">
                                  <div>
                                      <strong>${pdf.title}</strong><br>
                                      <small class="text-muted">${pdf.description || ''}</small>
                                  </div>
                                  <div>
                                      <button class="btn btn-sm btn-info" onclick="copyLink('${pdf.url}')">
                                          <i class="bi bi-link"></i>
                                      </button>
                                      <button class="btn btn-sm btn-success" onclick="sharePDF('${pdf.title}', '${pdf.url}')">
                                          <i class="bi bi-share"></i>
                                      </button>
                                  </div>
                              </li>
                              `).join('')}
                          </ul>
                      </div>
                  </div>
              </div>
              
              <div class="col-md-6">
                  <div class="card">
                      <div class="card-header bg-success text-white">
                          <h5>🎵 روابط صوتية (${audios.length})</h5>
                      </div>
                      <div class="card-body">
                          <ul class="list-group">
                              ${audios.map((audio, index) => `
                              <li class="list-group-item d-flex justify-content-between align-items-center">
                                  <div>
                                      <strong>${audio.title}</strong><br>
                                      <small class="text-muted">${audio.description || ''}</small>
                                  </div>
                                  <div>
                                      <button class="btn btn-sm btn-info" onclick="copyLink('${audio.url}')">
                                          <i class="bi bi-link"></i>
                                      </button>
                                      <button class="btn btn-sm btn-warning" onclick="testAudio('${audio.url}')">
                                          <i class="bi bi-play-circle"></i>
                                      </button>
                                  </div>
                              </li>
                              `).join('')}
                          </ul>
                      </div>
                  </div>
              </div>
          </div>
          
          <div class="mt-4">
              <a href="/admin/dashboard" class="btn btn-secondary">← العودة</a>
          </div>
      </div>
      
      <script>
          function copyLink(url) {
              navigator.clipboard.writeText(url)
                  .then(() => alert('تم نسخ الرابط!'))
                  .catch(err => console.error('Error copying:', err));
          }
          
          function sharePDF(title, url) {
              const message = \`📚 ملف PDF: \${title}\\n🔗 \${url}\\n✨ عبر بوت الأذكار الإسلامي\`;
              prompt('انسخ الرسالة للمشاركة:', message);
          }
          
          function testAudio(url) {
              const audio = new Audio(url);
              audio.play().catch(e => alert('تعذر تشغيل الصوت: ' + e.message));
          }
      </script>
  </body>
  </html>
  `);
});

// ==================== نظام البث المباشر ====================

app.get('/admin/streams', requireAuth, (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html dir="rtl">
  <head>
      <meta charset="UTF-8">
      <title>نظام البث المباشر</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
  </head>
  <body>
      <div class="container mt-4">
          <h2><i class="bi bi-camera-video"></i> نظام البث المباشر المطور</h2>
          
          <div class="row mt-4">
              <div class="col-md-8">
                  <div class="card">
                      <div class="card-header bg-danger text-white">
                          <h5>🎥 إدارة البث المباشر</h5>
                      </div>
                      <div class="card-body">
                          <form id="streamForm">
                              <div class="mb-3">
                                  <label class="form-label">عنوان البث</label>
                                  <input type="text" class="form-control" id="streamTitle" required>
                              </div>
                              <div class="mb-3">
                                  <label class="form-label">رابط البث</label>
                                  <input type="url" class="form-control" id="streamUrl" 
                                         placeholder="https://stream.example.com/live.m3u8" required>
                              </div>
                              <div class="mb-3">
                                  <label class="form-label">نوع البث</label>
                                  <select class="form-select" id="streamType">
                                      <option value="hls">HLS Stream</option>
                                      <option value="rtmp">RTMP Stream</option>
                                      <option value="youtube">YouTube Live</option>
                                  </select>
                              </div>
                              <button type="submit" class="btn btn-success">
                                  <i class="bi bi-play-circle"></i> بدء البث المباشر
                              </button>
                          </form>
                      </div>
                  </div>
              </div>
              
              <div class="col-md-4">
                  <div class="card">
                      <div class="card-header bg-info text-white">
                          <h5>📋 البثوث النشطة</h5>
                      </div>
                      <div class="card-body">
                          <div id="activeStreams">
                              <p class="text-muted">لا توجد بثوث نشطة حالياً</p>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
          
          <div class="mt-4">
              <a href="/admin/dashboard" class="btn btn-secondary">← العودة</a>
          </div>
      </div>
      
      <script>
          document.getElementById('streamForm').addEventListener('submit', function(e) {
              e.preventDefault();
              
              const streamData = {
                  title: document.getElementById('streamTitle').value,
                  url: document.getElementById('streamUrl').value,
                  type: document.getElementById('streamType').value
              };
              
              fetch('/api/admin/streams/start', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(streamData)
              })
              .then(response => response.json())
              .then(data => {
                  if (data.success) {
                      alert('✅ تم بدء البث المباشر بنجاح');
                      location.reload();
                  } else {
                      alert('❌ ' + data.error);
                  }
              })
              .catch(error => {
                  console.error('Error:', error);
                  alert('❌ حدث خطأ في بدء البث');
              });
          });
      </script>
  </body>
  </html>
  `);
});

// ==================== API للنظام ====================

// فحص صحة النظام
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'islamic-telegram-bot-enhanced',
    version: '4.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    enhanced_features: {
      categories: Object.keys(db.enhancedAdhkar.categories || {}).length,
      pdfs: (db.enhancedAdhkar.pdf_resources || []).length,
      audios: (db.enhancedAdhkar.audio_resources || []).length
    },
    database: {
      loaded: Object.keys(db.groups).length > 0,
      groups: Object.keys(db.groups).length
    }
  });
});

// إحصائيات النظام
app.get('/api/stats', (req, res) => {
  const stats = {
    groups: Object.keys(db.groups).length,
    users: Object.keys(db.users).length,
    adhkar: Object.keys(db.adhkar).length,
    enhanced_adhkar: Object.keys(db.enhancedAdhkar.categories || {}).length,
    pdfs: (db.enhancedAdhkar.pdf_resources || []).length,
    audios: (db.enhancedAdhkar.audio_resources || []).length,
    timestamp: new Date().toISOString()
  };
  
  res.json(stats);
});

// API لإدارة البث
app.post('/api/admin/streams/start', requireAuth, (req, res) => {
  try {
    const { title, url, type } = req.body;
    const streamId = uuidv4();
    
    db.streams[streamId] = {
      id: streamId,
      title,
      url,
      type,
      isLive: true,
      startTime: new Date().toISOString(),
      viewersCount: 0
    };
    
    saveEnhancedDatabase();
    
    res.json({
      success: true,
      streamId,
      message: 'تم بدء البث المباشر بنجاح'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== تسجيل الخروج ====================

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// ==================== بدء الخادم ====================

async function startEnhancedServer() {
  try {
    // تحميل قاعدة البيانات المطورة
    await loadEnhancedDatabase();
    
    // بدء الخادم
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`
🌐 ===================================================== 🌐
   ✅ الخادم المطور يعمل بنجاح!
   📍 http://0.0.0.0:${PORT}
   ⏰ ${moment().format('YYYY-MM-DD HH:mm:ss')}
   
   🔗 لوحة التحكم: /admin/dashboard
   🔗 فحص الصحة: /health
   🔗 إحصائيات: /api/stats
   
   ✨ *المميزات المطورة:*
   • أذكار متنوعة بدون صباح ومساء
   • ملفات PDF وروابط صوتية
   • نظام بث مباشر
   • لوحة تحكم متقدمة
🌐 ===================================================== 🌐
      `);
    });
    
    // حفظ قاعدة البيانات بشكل دوري
    setInterval(async () => {
      await saveEnhancedDatabase();
    }, 5 * 60 * 1000);
    
    return app;
    
  } catch (error) {
    console.error('❌ فشل في بدء الخادم المطور:', error);
    process.exit(1);
  }
}

// ==================== معالجة الإغلاق ====================

process.on('SIGTERM', async () => {
  console.log('🛑 تلقي إشارة SIGTERM، إيقاف الخادم...');
  await saveEnhancedDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 تلقي إشارة SIGINT، إيقاف الخادم...');
  await saveEnhancedDatabase();
  process.exit(0);
});

// بدء الخادم
startEnhancedServer();

module.exports = app;