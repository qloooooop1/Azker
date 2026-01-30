# مستندات التخزين الدائم - Persistent Storage Documentation

## نظرة عامة | Overview

تم تكوين هذا البوت لاستخدام التخزين الدائم لضمان عدم فقدان البيانات عند إعادة التشغيل أو إعادة النشر.

This bot is configured to use persistent storage to ensure data is not lost on restarts or redeployments.

## بنية التخزين | Storage Architecture

### بيئة الإنتاج | Production Environment (Render)

في بيئة الإنتاج على Render، يتم تخزين جميع البيانات في القرص الدائم `/data`:

In production on Render, all data is stored on the persistent disk at `/data`:

```
/data/
├── adkar.db          # قاعدة بيانات SQLite الرئيسية
├── uploads/          # الملفات المرفوعة
│   ├── audio/       # الملفات الصوتية
│   ├── images/      # الصور
│   ├── pdfs/        # ملفات PDF
│   └── temp/        # الملفات المؤقتة
```

### بيئة التطوير المحلية | Local Development Environment

في بيئة التطوير المحلية، يتم تخزين البيانات في مجلد `./data`:

In local development, data is stored in `./data` directory:

```
./data/
├── adkar.db          # قاعدة بيانات SQLite المحلية
├── uploads/          # الملفات المرفوعة محلياً
```

## التكوين | Configuration

### متغيرات البيئة | Environment Variables

- `NODE_ENV`: عند ضبطها على `production`، يستخدم البوت `/data` للتخزين
  - When set to `production`, the bot uses `/data` for storage
  
- `DB_PATH`: (اختياري) مسار مخصص لقاعدة البيانات
  - (Optional) Custom path for the database

- `UPLOAD_PATH`: (اختياري) مسار مخصص لمجلد الرفع
  - (Optional) Custom path for uploads directory

### ملف Render.yaml

تم تكوين ملف `render.yaml` بقرص دائم:

The `render.yaml` is configured with persistent disk:

```yaml
disk:
  name: adkar-data
  mountPath: /data
  sizeGB: 1
```

## ما يتم حفظه | What Gets Persisted

### قاعدة البيانات | Database

تحتوي قاعدة البيانات على:
- **الأذكار**: جميع الأذكار المضافة من لوحة التحكم
- **المجموعات**: معلومات المجموعات المسجلة
- **الفئات**: فئات الأذكار المختلفة
- **السجلات**: سجلات النشر والإحصائيات

The database contains:
- **Adkar**: All supplications added through the admin panel
- **Groups**: Registered group information
- **Categories**: Different adkar categories
- **Logs**: Sending logs and statistics

### الملفات | Files

- ملفات الصوت المرفوعة | Uploaded audio files
- ملفات PDF المرفوعة | Uploaded PDF files
- الصور المرفوعة | Uploaded images

## آلية العمل | How It Works

1. **التشغيل الأول | First Run**:
   - يتم إنشاء مجلد البيانات تلقائياً
   - يتم إنشاء قاعدة البيانات بالجداول الأساسية
   - يتم إضافة الأذكار الافتراضية

2. **إعادة التشغيل | Restart**:
   - يتم الاتصال بقاعدة البيانات الموجودة
   - جميع البيانات المحفوظة متاحة فوراً
   - لا يتم فقدان أي أذكار أو إعدادات

3. **إعادة النشر | Redeploy**:
   - القرص الدائم `/data` يبقى كما هو
   - البيانات محفوظة بشكل دائم
   - استمرارية الخدمة بدون فقدان بيانات

## الأمان والنسخ الاحتياطي | Security and Backups

### توصيات | Recommendations

1. **النسخ الاحتياطي الدوري**: قم بعمل نسخ احتياطية دورية لقاعدة البيانات
   - Regular backups: Make periodic backups of the database

2. **مراقبة المساحة**: تأكد من وجود مساحة كافية في القرص الدائم
   - Monitor space: Ensure sufficient space on persistent disk

3. **الأمان**: لا تشارك ملفات قاعدة البيانات أو تضمنها في نظام التحكم بالإصدارات
   - Security: Never share database files or include them in version control

## استكشاف الأخطاء | Troubleshooting

### المشكلة: لا يتم حفظ البيانات
**Problem: Data is not being saved**

1. تحقق من متغير البيئة `NODE_ENV`
2. تأكد من أن القرص الدائم متصل في Render
3. تحقق من صلاحيات الكتابة على المجلد `/data`

1. Check the `NODE_ENV` environment variable
2. Ensure persistent disk is mounted in Render
3. Verify write permissions on `/data` directory

### المشكلة: خطأ في الوصول لقاعدة البيانات
**Problem: Database access error**

1. تحقق من وجود الملف `/data/adkar.db`
2. تحقق من سجلات الأخطاء
3. أعد تشغيل الخدمة

1. Check if `/data/adkar.db` exists
2. Check error logs
3. Restart the service

## الصيانة | Maintenance

### عرض حجم قاعدة البيانات
**View database size**

```bash
ls -lh /data/adkar.db
```

### نسخ احتياطي يدوي
**Manual backup**

```bash
cp /data/adkar.db /data/backup-$(date +%Y%m%d).db
```

### تنظيف الملفات المؤقتة
**Clean temporary files**

```bash
rm -rf /data/uploads/temp/*
```

## الدعم | Support

للمساعدة والدعم الفني، يرجى فتح issue في GitHub أو التواصل مع المطور.

For help and technical support, please open an issue on GitHub or contact the developer.
