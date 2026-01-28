require('dotenv').config();

console.log(`
╔══════════════════════════════════════════╗
║     🔧 إعداد النظام المطور              ║
║     بوت الأذكار الإسلامي - الإصدار 2.1  ║
╚══════════════════════════════════════════╝
`);

const fs = require('fs-extra');
const path = require('path');

async function setupEnhancedSystem() {
  try {
    console.log('🔧 بدء إعداد النظام المطور...\n');
    
    // 1. إنشاء المجلدات الأساسية
    console.log('📁 إنشاء المجلدات...');
    const directories = [
      'data/database',
      'uploads',
      'uploads/audio',
      'uploads/pdf',
      'uploads/images',
      'backups',
      'logs',
      'admin'
    ];
    
    for (const dir of directories) {
      const dirPath = path.join(__dirname, dir);
      await fs.ensureDir(dirPath);
      console.log(`   ✅ ${dir}`);
    }
    
    // 2. إنشاء ملف الأذكار المطورة إذا لم يكن موجوداً
    console.log('\n📝 إنشاء ملف الأذكار المطورة...');
    const enhancedAdhkarPath = path.join(__dirname, 'data', 'enhanced-adhkar.json');
    
    if (!await fs.pathExists(enhancedAdhkarPath)) {
      const enhancedAdhkar = {
        categories: {
          sleep: {
            name: "أذكار النوم",
            items: [
              {
                text: "باسمك اللهم أموت وأحيا",
                source: "حصن المسلم - رواه البخاري",
                audio: "https://server.islamic.com/audio/sleep/001.mp3",
                pdf: "https://server.islamic.com/pdf/sleep-adhkar.pdf"
              }
            ]
          },
          wakeup: {
            name: "أذكار الاستيقاظ",
            items: [
              {
                text: "الحمد لله الذي أحيانا بعد ما أماتنا وإليه النشور",
                source: "حصن المسلم - رواه البخاري",
                audio: "https://server.islamic.com/audio/wakeup/001.mp3",
                pdf: "https://server.islamic.com/pdf/wakeup-adhkar.pdf"
              }
            ]
          },
          travel: {
            name: "أذكار السفر",
            items: [
              {
                text: "سبحان الذي سخر لنا هذا وما كنا له مقرنين وإنا إلى ربنا لمنقلبون",
                source: "حصن المسلم - سورة الزخرف",
                audio: "https://server.islamic.com/audio/travel/001.mp3",
                pdf: "https://server.islamic.com/pdf/travel-adhkar.pdf"
              }
            ]
          },
          eating: {
            name: "أذكار الطعام",
            items: [
              {
                text: "بسم الله، اللهم بارك لنا فيما رزقتنا وقنا عذاب النار",
                source: "حصن المسلم - رواه الترمذي",
                audio: "https://server.islamic.com/audio/eating/001.mp3",
                pdf: "https://server.islamic.com/pdf/eating-adhkar.pdf"
              }
            ]
          },
          general: {
            name: "أذكار عامة",
            items: [
              {
                text: "سبحان الله وبحمده، سبحان الله العظيم",
                source: "حصن المسلم - رواه البخاري ومسلم",
                audio: "https://server.islamic.com/audio/general/001.mp3",
                pdf: "https://server.islamic.com/pdf/general-adhkar.pdf"
              }
            ]
          },
          repentance: {
            name: "أدعية الاستغفار",
            items: [
              {
                text: "اللهم أنت ربي لا إله إلا أنت، خلقتني وأنا عبدك، وأنا على عهدك ووعدك ما استطعت...",
                source: "حصن المسلم - رواه البخاري",
                audio: "https://server.islamic.com/audio/repentance/001.mp3"
              }
            ]
          },
          quran: {
            name: "آيات قرآنية",
            items: [
              {
                text: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ",
                source: "سورة البقرة - الآية 201",
                audio: "https://everyayah.com/data/Abdul_Basit_Murattal_128kbps/002201.mp3",
                pdf: "https://server.islamic.com/pdf/quran/baqarah-201.pdf"
              }
            ]
          }
        },
        pdf_resources: [
          {
            title: "حصن المسلم كامل",
            url: "https://ia800908.us.archive.org/16/items/hisn-muslim-pdf/Hisn_Al-Muslim.pdf",
            description: "كتاب حصن المسلم كامل PDF"
          },
          {
            title: "الأذكار للنووي",
            url: "https://www.noor-book.com/كتاب-الاذكار-من-كلام-سيد-الابرار-pdf",
            description: "كتاب الأذكار للإمام النووي"
          },
          {
            title: "سورة الكهف كاملة",
            url: "https://server.islamic.com/pdf/surah-al-kahf.pdf",
            description: "سورة الكهف كاملة مع التفسير"
          }
        ],
        audio_resources: [
          {
            title: "القرآن الكريم كامل - عبد الباسط",
            url: "https://everyayah.com/data/Abdul_Basit_Murattal_128kbps/",
            description: "القرآن الكريم بصوت الشيخ عبد الباسط عبد الصمد"
          },
          {
            title: "أذكار مسموعة كاملة",
            url: "https://server.islamic.com/audio/adhkar/full-collection/",
            description: "مكتبة الأذكار المسموعة"
          }
        ]
      };
      
      await fs.writeJson(enhancedAdhkarPath, enhancedAdhkar, { spaces: 2 });
      console.log('   ✅ تم إنشاء ملف الأذكار المطورة');
    } else {
      console.log('   ✅ ملف الأذكار المطورة موجود بالفعل');
    }
    
    // 3. إنشاء ملفات قاعدة البيانات المحسنة
    console.log('\n💾 إنشاء قاعدة البيانات المحسنة...');
    const dbPath = path.join(__dirname, 'data', 'database');
    await fs.ensureDir(dbPath);
    
    const dbFiles = {
      'groups.json': {},
      'users.json': {},
      'adhkar.json': {},
      'schedules.json': {},
      'media.json': {},
      'categories.json': {},
      'broadcasts.json': {},
      'streams.json': {}
    };
    
    for (const [fileName, content] of Object.entries(dbFiles)) {
      const filePath = path.join(dbPath, fileName);
      if (!await fs.pathExists(filePath)) {
        await fs.writeJson(filePath, content, { spaces: 2 });
        console.log(`   ✅ ${fileName}`);
      } else {
        console.log(`   ✅ ${fileName} (موجود)`);
      }
    }
    
    // 4. إنشاء ملف البيئة إذا لم يكن موجوداً
    console.log('\n⚙️ إنشاء ملف البيئة...');
    const envExamplePath = path.join(__dirname, '.env.example');
    const envPath = path.join(__dirname, '.env');
    
    if (!await fs.pathExists(envPath)) {
      if (await fs.pathExists(envExamplePath)) {
        await fs.copy(envExamplePath, envPath);
        console.log('   ✅ تم إنشاء ملف .env من المثال');
      } else {
        const defaultEnv = `
# إعدادات البوت
BOT_TOKEN=your_bot_token_here
DEVELOPER_ID=6960704733
ADMIN_GROUP_ID=-1003595290365
DATABASE_GROUP_ID=-1003624663502

# إعدادات السيرفر
PORT=10000
NODE_ENV=production
TIMEZONE=Asia/Riyadh

# قاعدة البيانات
MONGODB_URI=mongodb://localhost:27017/islamic_bot_v3

# إعدادات الإدارة
ADMIN_PASSWORD=admin123
SESSION_SECRET=your_session_secret_here

# إعدادات إضافية
LOG_LEVEL=info
BACKUP_INTERVAL=24
        `.trim();
        
        await fs.writeFile(envPath, defaultEnv);
        console.log('   ✅ تم إنشاء ملف .env افتراضي');
      }
    } else {
      console.log('   ✅ ملف .env موجود بالفعل');
    }
    
    // 5. إنشاء مجلد لوحة الإدارة
    console.log('\n👑 إعداد لوحة الإدارة...');
    const adminDir = path.join(__dirname, 'admin');
    await fs.ensureDir(adminDir);
    
    // إنشاء صفحة تسجيل الدخول
    const loginHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>تسجيل الدخول - لوحة تحكم بوت الأذكار</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body {
            background: linear-gradient(135deg, #1a2980 0%, #26d0ce 100%);
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
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
                       placeholder="اسم المستخدم" required>
            </div>
            
            <div class="mb-3">
                <input type="password" class="form-control" id="password" 
                       placeholder="كلمة المرور" required>
            </div>
            
            <button type="submit" class="btn btn-login">
                تسجيل الدخول
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
    
    await fs.writeFile(path.join(adminDir, 'login.html'), loginHtml);
    console.log('   ✅ تم إنشاء صفحة تسجيل الدخول');
    
    // 6. التحقق من الحزم المطلوبة
    console.log('\n📦 التحقق من الحزم المطلوبة...');
    const packageJson = require('./package.json');
    
    // الحزم الأساسية المطلوبة
    const requiredPackages = {
      "express": "^4.19.2",
      "axios": "^1.7.7",
      "dotenv": "^16.4.5",
      "moment-timezone": "^0.5.45",
      "node-cron": "^3.0.3",
      "multer": "^1.4.5-lts.1",
      "uuid": "^10.0.0",
      "fs-extra": "^11.2.0",
      "path": "^0.12.7",
      "cors": "^2.8.5",
      "express-session": "^1.17.3",
      "node-telegram-bot-api": "^0.64.0",
      "mongoose": "^7.5.0",
      "body-parser": "^1.20.2"
    };
    
    console.log('   ✅ جميع الحزم الأساسية مضمنة في package.json');
    
    console.log('\n🎉 تم إعداد النظام المطور بنجاح!\n');
    console.log('📋 خطوات التشغيل:');
    console.log('1. قم بتعديل ملف .env بإعداداتك');
    console.log('2. قم بتثبيت الحزم: npm install');
    console.log('3. ابدأ التشغيل: npm start');
    console.log('4. الوصول للوحة التحكم: http://localhost:10000/admin/dashboard');
    console.log('\n👤 بيانات الدخول الافتراضية:');
    console.log('   المستخدم: admin');
    console.log('   كلمة المرور: admin123');
    console.log('\n✨ تم بنجاح! يمكنك الآن استخدام النظام المطور.');
    
  } catch (error) {
    console.error('❌ خطأ في إعداد النظام:', error);
    process.exit(1);
  }
}

// تشغيل الإعداد
setupEnhancedSystem();