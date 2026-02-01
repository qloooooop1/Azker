# دليل المطور - نظام النسخ الاحتياطي والاستعادة

## البنية المعمارية

### نظرة عامة على المكونات

```
Azker/
├── lib/
│   ├── backup-metadata.js       # إدارة metadata و checksums
│   ├── backup-validator.js      # التحقق من صحة البيانات
│   ├── backup-version-manager.js # إدارة الإصدارات والترحيل
│   └── backup-diagnostic.js     # تشخيص وإصلاح المشاكل
├── public/
│   ├── admin.html               # واجهة المستخدم الرئيسية
│   └── backup-ui.js             # وظائف UI المحسّنة
├── server.js                    # API endpoints
└── tests/
    ├── test-backup-metadata.js
    ├── test-backup-validation.js
    └── test-backup-versioning.js
```

## الوحدات الأساسية

### 1. backup-metadata.js

**الغرض**: إدارة metadata المتقدم وال checksums

**الوظائف الرئيسية**:

```javascript
// توليد checksum للبيانات
generateChecksum(data: Object): string

// التحقق من صحة checksum
verifyChecksum(backupData: Object): boolean

// حساب الإحصائيات
calculateStatistics(data: Object): Object

// تنسيق حجم الملف
formatBytes(bytes: number): string

// إنشاء metadata
createMetadata(data: Object, description: string): Object

// إنشاء نسخة احتياطية كاملة مع metadata
createBackupWithMetadata(data: Object, description: string): Object

// استخراج metadata من نسخة احتياطية
extractMetadata(backupData: Object): Object

// التحقق من صحة metadata
validateMetadata(metadata: Object): {valid: boolean, errors: Array}
```

**مثال الاستخدام**:

```javascript
const backupMetadata = require('./lib/backup-metadata');

// إنشاء نسخة احتياطية
const data = {
    groups: [...],
    adkar: [...],
    categories: [...]
};

const backup = backupMetadata.createBackupWithMetadata(
    data,
    'نسخة قبل التحديث'
);

// التحقق من checksum
const isValid = backupMetadata.verifyChecksum(backup);
console.log('Checksum valid:', isValid);

// استخراج metadata
const metadata = backupMetadata.extractMetadata(backup);
console.log('Created at:', metadata.formattedDate);
console.log('Groups:', metadata.statistics.groups);
```

### 2. backup-validator.js

**الغرض**: التحقق الشامل من صحة النسخ الاحتياطية

**الوظائف الرئيسية**:

```javascript
// التحقق من JSON
isValidJSON(str: string): {valid: boolean, error?: string}

// التحقق من مصفوفات JSON
isValidJSONArray(str: string, fieldName: string): {valid: boolean, value?: Array}

// التحقق من عنصر ذكر
validateAdkarItem(adkar: Object, index: number): ValidationResult

// التحقق من عنصر مجموعة
validateGroupItem(group: Object, index: number): ValidationResult

// التحقق من عنصر فئة
validateCategoryItem(category: Object, index: number): ValidationResult

// التحقق الشامل
validateBackupDataEnhanced(backupData: Object): ValidationReport
```

### 3. backup-version-manager.js

**الغرض**: إدارة إصدارات النسخ الاحتياطية والترحيل التلقائي

**الإصدارات المدعومة**: 1.0, 1.0.0, 2.0, 2.0.0, 3.0, 3.0.0

**الوظائف الرئيسية**:

```javascript
// اكتشاف إصدار النسخة
detectBackupVersion(backupData: Object): string

// التحقق من دعم الإصدار
isVersionSupported(version: string): boolean

// ترحيل من v1.0 إلى v3.0
migrateV1ToV3(backupData: Object, logger?: Object): Object

// ترحيل من v2.0 إلى v3.0
migrateV2ToV3(backupData: Object, logger?: Object): Object

// ترحيل إلى الإصدار الحالي
migrateToCurrentVersion(backupData: Object, logger?: Object): Object
```

### 4. backup-ui.js

**الغرض**: توفير وظائف UI محسّنة

**الوظائف المُصدّرة**:

```javascript
// إشعارات toast
showToast(message: string, type: string = 'info', duration: number = 5000)

// معاينة النسخة الاحتياطية
previewBackup(): Promise<void>

// إلغاء المعاينة
cancelPreview(): void

// تحديث خطوة التقدم
updateStep(stepNumber: number, status: string = 'active'): void

// تحديث شريط التقدم
updateProgress(percentage: number, message: string): void
```

## واجهة برمجة التطبيقات (API)

### Endpoint: GET /api/backup

**الغرض**: إنشاء وتنزيل نسخة احتياطية

**Parameters**:
- `description` (query, optional): وصف النسخة الاحتياطية

**Headers**:
- `Authorization: Bearer {token}`

**Response**:
```json
{
  "version": "3.0.0",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "data": {
    "groups": [...],
    "adkar": [...],
    "categories": [...]
  },
  "metadata": {
    "createdAt": "2024-01-01T12:00:00.000Z",
    "appVersion": "3.0.0",
    "backupVersion": "3.0.0",
    "description": "...",
    "checksum": "...",
    "statistics": {...},
    "system": {...}
  }
}
```

**مثال الاستخدام**:
```javascript
const response = await fetch('/api/backup?description=نسخة يومية', {
    headers: { 'Authorization': `Bearer ${token}` }
});
const blob = await response.blob();
// تنزيل الملف...
```

### Endpoint: POST /api/backup/preview

**الغرض**: معاينة محتوى النسخة الاحتياطية قبل الاستعادة

**Headers**:
- `Authorization: Bearer {token}`
- `Content-Type: multipart/form-data`

**Body**:
- `backupFile`: ملف JSON

**Response**:
```json
{
  "success": true,
  "metadata": {
    "version": "3.0.0",
    "createdAt": "...",
    "formattedDate": "...",
    "description": "...",
    "statistics": {
      "groups": 5,
      "adkar": 120,
      "categories": 8
    },
    "hasChecksum": true,
    "checksumValid": true
  },
  "detectedVersion": "3.0.0",
  "checksumStatus": "صالح ✅",
  "fileSize": 45678,
  "formattedFileSize": "44.61 KB",
  "fileName": "..."
}
```

**مثال الاستخدام**:
```javascript
const formData = new FormData();
formData.append('backupFile', file);

const response = await fetch('/api/backup/preview', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
});
const data = await response.json();
```

### Endpoint: POST /api/restore

**الغرض**: استعادة النسخة الاحتياطية

**Headers**:
- `Authorization: Bearer {token}`
- `Content-Type: multipart/form-data`

**Body**:
- `backupFile`: ملف JSON

**Response - Success**:
```json
{
  "success": true,
  "message": "تم استعادة النسخة الاحتياطية بنجاح",
  "restored": {
    "groups": 5,
    "adkar": 120,
    "categories": 8
  },
  "warnings": [...]
}
```

**Response - Error**:
```json
{
  "error": "...",
  "details": "...",
  "suggestion": "...",
  "validationErrors": [...]
}
```

## تدفق البيانات

### إنشاء نسخة احتياطية

```
1. User clicks "إنشاء نسخة احتياطية"
2. GET /api/backup
3. Server:
   a. استخراج البيانات من قاعدة البيانات
   b. تطبيع البيانات (integers, JSON strings)
   c. createBackupWithMetadata()
      - حساب statistics
      - توليد checksum
      - إضافة system info
   d. إرسال JSON للتنزيل
4. Browser downloads file
```

### استعادة نسخة احتياطية

```
1. User selects/drops file
2. POST /api/backup/preview
3. Server:
   a. التحقق من JSON validity
   b. extractMetadata()
   c. detectBackupVersion()
   d. إرسال معلومات المعاينة
4. Client displays preview
5. User confirms
6. POST /api/restore
7. Server:
   a. التحقق من JSON
   b. detectBackupVersion()
   c. migrateToCurrentVersion() if needed
   d. verifyChecksum()
   e. validateBackupDataEnhanced()
   f. استعادة البيانات إلى قاعدة البيانات
   g. إرسال نتيجة العملية
8. Client shows success/error
```

## إضافة ميزات جديدة

### إضافة جدول جديد للنسخ الاحتياطي

1. **تحديث server.js - GET /api/backup**:
```javascript
db.all("SELECT * FROM new_table", (err, rows) => {
    data.newTable = rows.map(row => ({
        // تطبيع البيانات
        id: parseInt(row.id),
        ...
    }));
});
```

2. **تحديث server.js - POST /api/restore**:
```javascript
if (backupData.data.newTable && backupData.data.newTable.length > 0) {
    const stmt = db.prepare(`INSERT OR REPLACE INTO new_table ...`);
    backupData.data.newTable.forEach(item => {
        stmt.run([...]);
        restored.newTable++;
    });
    stmt.finalize();
}
```

3. **تحديث backup-validator.js**:
```javascript
function validateNewTableItem(item, index) {
    const logger = new ValidationLogger();
    
    // التحقق من الحقول المطلوبة
    if (!item.requiredField) {
        logger.error('Missing required field', 'requiredField');
    }
    
    return logger.getReport();
}
```

4. **تحديث الإحصائيات**:
```javascript
// في backup-metadata.js - calculateStatistics
if (data.newTable && Array.isArray(data.newTable)) {
    stats.newTable = data.newTable.length;
}
```

### إضافة إصدار جديد (v4.0)

1. **تحديث backup-version-manager.js**:
```javascript
const CURRENT_VERSION = '4.0.0';
const SUPPORTED_VERSIONS = [..., '4.0', '4.0.0'];

function migrateV3ToV4(backupData, logger = console) {
    logger.log('🔄 Migrating from v3.0 to v4.0...');
    
    const migrated = { ...backupData };
    migrated.version = '4.0.0';
    
    // تطبيق التغييرات المطلوبة
    // مثلاً: إضافة حقول جديدة، تعديل هيكلة البيانات
    
    return migrated;
}

function migrateToCurrentVersion(backupData, logger = console) {
    // ... existing code ...
    
    if (version === '3.0.0') {
        backupData = migrateV3ToV4(backupData, logger);
    }
    
    return backupData;
}
```

2. **تحديث الاختبارات**:
```javascript
// في test-backup-versioning.js
test('ترحيل من v3.0 إلى v4.0', () => {
    // ...
});
```

## الاختبارات

### تشغيل جميع الاختبارات

```bash
npm run test:all
```

### اختبارات فردية

```bash
# Metadata tests
node test-backup-metadata.js

# Validation tests  
node test-backup-validation.js

# Versioning tests
node test-backup-versioning.js

# Integration tests
node test-integration-restore.js
```

### كتابة اختبار جديد

```javascript
function test(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`✅ ${name}`);
        passedTests++;
    } catch (error) {
        console.log(`❌ ${name}`);
        console.error(`   خطأ: ${error.message}`);
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

// استخدام
test('وصف الاختبار', () => {
    const result = someFunction();
    assert(result === expected, 'Should return expected value');
});
```

## أفضل الممارسات

### 1. تطبيع البيانات
```javascript
// دائماً استخدم parseInt للأرقام
id: parseInt(row.id)

// دائماً حول المصفوفات إلى JSON strings
schedule_days: JSON.stringify(array)
```

### 2. معالجة الأخطاء
```javascript
try {
    // عملية خطرة
} catch (error) {
    console.error('❌ خطأ:', error);
    restorationErrors.push(`وصف الخطأ: ${error.message}`);
}
```

### 3. التوافق مع الإصدارات القديمة
```javascript
// دعم أسماء الحقول القديمة والجديدة
const content_type = adkar.content_type || adkar.type || 'text';
```

### 4. Logging
```javascript
console.log('✅ عملية نجحت');
console.warn('⚠️  تحذير');
console.error('❌ خطأ');
console.log(`📊 إحصائيات: ${count}`);
```

## استكشاف الأخطاء للمطورين

### مشكلة: Checksum دائماً غير صالح
**السبب**: تعديل البيانات بعد حساب checksum
**الحل**: تأكد من حساب checksum قبل إضافة metadata

### مشكلة: فشل الترحيل
**السبب**: نقص حقول مطلوبة في الإصدار القديم
**الحل**: أضف قيم افتراضية في دالة الترحيل

### مشكلة: اختبارات فاشلة
**الحل**: 
```bash
# تشغيل اختبار واحد للتشخيص
node test-backup-metadata.js

# التحقق من السجلات
console.log('Debug:', variable);
```

## الموارد

- **الاختبارات**: `test-*.js`
- **الوثائق**: `*.md`
- **أمثلة**: `examples/`
- **GitHub Issues**: للإبلاغ عن المشاكل

---

**آخر تحديث**: 2024  
**الإصدار**: 3.0.0
