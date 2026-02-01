#!/usr/bin/env node

/**
 * اختبارات شاملة للتحقق من صحة استعادة النسخ الاحتياطية
 * Comprehensive tests for backup restoration validation
 */

console.log('🧪 بدء اختبارات التحقق من النسخ الاحتياطية...\n');

// ========== دوال التحقق (نسخة من server.js) ==========

function isValidJSON(str) {
    try {
        JSON.parse(str);
        return { valid: true };
    } catch (error) {
        return { 
            valid: false, 
            error: 'الملف لا يحتوي على JSON صحيح',
            details: error.message 
        };
    }
}

function isValidJSONArray(str, fieldName) {
    if (!str) return { valid: true, value: [] };
    
    try {
        const parsed = JSON.parse(str);
        if (!Array.isArray(parsed)) {
            return {
                valid: false,
                error: `الحقل "${fieldName}" يجب أن يكون مصفوفة JSON`,
                details: `القيمة الحالية: ${str}`
            };
        }
        return { valid: true, value: parsed };
    } catch (error) {
        return {
            valid: false,
            error: `الحقل "${fieldName}" يحتوي على JSON غير صحيح`,
            details: error.message
        };
    }
}

function validateAdkarItem(adkar, index) {
    const errors = [];
    
    if (!adkar.category_id && adkar.category_id !== 0) {
        errors.push(`الذكر #${index + 1}: معرف الفئة (category_id) مطلوب`);
    }
    
    const contentType = adkar.content_type || adkar.type || 'text';
    const validContentTypes = ['text', 'audio', 'image', 'video', 'pdf'];
    if (!validContentTypes.includes(contentType)) {
        errors.push(`الذكر #${index + 1}: نوع المحتوى "${contentType}" غير صحيح. القيم المسموحة: ${validContentTypes.join(', ')}`);
    }
    
    const scheduleDays = adkar.schedule_days || adkar.days_of_week || '[0,1,2,3,4,5,6]';
    const daysValidation = isValidJSONArray(scheduleDays, 'schedule_days');
    if (!daysValidation.valid) {
        errors.push(`الذكر #${index + 1}: ${daysValidation.error} - ${daysValidation.details}`);
    }
    
    const scheduleDates = adkar.schedule_dates || '[]';
    const datesValidation = isValidJSONArray(scheduleDates, 'schedule_dates');
    if (!datesValidation.valid) {
        errors.push(`الذكر #${index + 1}: ${datesValidation.error} - ${datesValidation.details}`);
    }
    
    const scheduleMonths = adkar.schedule_months || '[]';
    const monthsValidation = isValidJSONArray(scheduleMonths, 'schedule_months');
    if (!monthsValidation.valid) {
        errors.push(`الذكر #${index + 1}: ${monthsValidation.error} - ${monthsValidation.details}`);
    }
    
    const scheduleTime = adkar.schedule_time || '12:00';
    const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timePattern.test(scheduleTime)) {
        errors.push(`الذكر #${index + 1}: وقت الجدولة "${scheduleTime}" غير صحيح. يجب أن يكون بصيغة HH:MM (مثال: 08:30)`);
    }
    
    return errors;
}

function validateGroupItem(group, index) {
    const errors = [];
    
    if (!group.chat_id && group.chat_id !== 0) {
        errors.push(`المجموعة #${index + 1}: معرف المحادثة (chat_id) مطلوب`);
    }
    
    if (!group.title) {
        errors.push(`المجموعة #${index + 1}: العنوان (title) مطلوب`);
    }
    
    if (group.settings && typeof group.settings === 'string') {
        const settingsValidation = isValidJSON(group.settings);
        if (!settingsValidation.valid) {
            errors.push(`المجموعة #${index + 1}: إعدادات المجموعة (settings) تحتوي على JSON غير صحيح`);
        }
    }
    
    return errors;
}

function validateCategoryItem(category, index) {
    const errors = [];
    
    if (!category.name) {
        errors.push(`الفئة #${index + 1}: الاسم (name) مطلوب`);
    }
    
    return errors;
}

function validateBackupData(backupData) {
    const errors = [];
    const warnings = [];
    
    if (!backupData) {
        return {
            valid: false,
            errors: ['النسخة الاحتياطية فارغة أو غير صحيحة'],
            warnings: []
        };
    }
    
    if (!backupData.data) {
        errors.push('تنسيق النسخة الاحتياطية غير صحيح: حقل "data" مفقود');
        return { valid: false, errors, warnings };
    }
    
    const hasGroups = backupData.data.groups && backupData.data.groups.length > 0;
    const hasAdkar = backupData.data.adkar && backupData.data.adkar.length > 0;
    const hasCategories = backupData.data.categories && backupData.data.categories.length > 0;
    
    if (!hasGroups && !hasAdkar && !hasCategories) {
        warnings.push('النسخة الاحتياطية لا تحتوي على أي بيانات (مجموعات، أذكار، أو فئات)');
    }
    
    if (hasCategories) {
        if (!Array.isArray(backupData.data.categories)) {
            errors.push('حقل "categories" يجب أن يكون مصفوفة');
        } else {
            backupData.data.categories.forEach((category, index) => {
                const categoryErrors = validateCategoryItem(category, index);
                errors.push(...categoryErrors);
            });
        }
    }
    
    if (hasAdkar) {
        if (!Array.isArray(backupData.data.adkar)) {
            errors.push('حقل "adkar" يجب أن يكون مصفوفة');
        } else {
            backupData.data.adkar.forEach((adkar, index) => {
                const adkarErrors = validateAdkarItem(adkar, index);
                errors.push(...adkarErrors);
            });
        }
    }
    
    if (hasGroups) {
        if (!Array.isArray(backupData.data.groups)) {
            errors.push('حقل "groups" يجب أن يكون مصفوفة');
        } else {
            backupData.data.groups.forEach((group, index) => {
                const groupErrors = validateGroupItem(group, index);
                errors.push(...groupErrors);
            });
        }
    }
    
    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

// ========== الاختبارات ==========

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(testName, testFunc) {
    totalTests++;
    try {
        const result = testFunc();
        if (result) {
            console.log(`✅ ${testName}`);
            passedTests++;
        } else {
            console.log(`❌ ${testName}`);
            failedTests++;
        }
    } catch (error) {
        console.log(`❌ ${testName}: ${error.message}`);
        failedTests++;
    }
}

// ========== اختبار 1: التحقق من صحة JSON ==========
console.log('📝 اختبار 1: التحقق من صحة JSON');
console.log('='.repeat(50));

runTest('JSON صحيح', () => {
    const result = isValidJSON('{"test": "value"}');
    return result.valid === true;
});

runTest('JSON غير صحيح - بنية خاطئة', () => {
    const result = isValidJSON('{test: value}');
    return result.valid === false && result.error;
});

runTest('JSON غير صحيح - نص عادي', () => {
    const result = isValidJSON('hello world');
    return result.valid === false;
});

console.log();

// ========== اختبار 2: التحقق من صحة مصفوفات JSON ==========
console.log('📝 اختبار 2: التحقق من صحة مصفوفات JSON');
console.log('='.repeat(50));

runTest('مصفوفة JSON صحيحة', () => {
    const result = isValidJSONArray('[0,1,2,3,4,5,6]', 'test_field');
    return result.valid === true && Array.isArray(result.value);
});

runTest('قيمة فارغة (مقبولة)', () => {
    const result = isValidJSONArray('', 'test_field');
    return result.valid === true && result.value.length === 0;
});

runTest('مصفوفة JSON غير صحيحة - نص', () => {
    const result = isValidJSONArray('"not an array"', 'test_field');
    return result.valid === false && result.error;
});

runTest('مصفوفة JSON غير صحيحة - كائن', () => {
    const result = isValidJSONArray('{"key": "value"}', 'test_field');
    return result.valid === false;
});

runTest('مصفوفة JSON معطوبة', () => {
    const result = isValidJSONArray('[0,1,2,', 'test_field');
    return result.valid === false;
});

console.log();

// ========== اختبار 3: التحقق من صحة الذكر ==========
console.log('📝 اختبار 3: التحقق من صحة عناصر الأذكار');
console.log('='.repeat(50));

runTest('ذكر صحيح', () => {
    const adkar = {
        category_id: 1,
        title: 'Test',
        content: 'Content',
        content_type: 'text',
        schedule_days: '[0,1,2,3,4,5,6]',
        schedule_dates: '[]',
        schedule_months: '[]',
        schedule_time: '12:00'
    };
    const errors = validateAdkarItem(adkar, 0);
    return errors.length === 0;
});

runTest('ذكر مفقود category_id', () => {
    const adkar = {
        title: 'Test',
        content: 'Content'
    };
    const errors = validateAdkarItem(adkar, 0);
    return errors.length > 0 && errors.some(e => e.includes('category_id'));
});

runTest('ذكر بنوع محتوى غير صحيح', () => {
    const adkar = {
        category_id: 1,
        content_type: 'invalid_type',
        schedule_time: '12:00'
    };
    const errors = validateAdkarItem(adkar, 0);
    return errors.length > 0 && errors.some(e => e.includes('نوع المحتوى'));
});

runTest('ذكر بمصفوفة أيام غير صحيحة', () => {
    const adkar = {
        category_id: 1,
        schedule_days: '{not an array}',
        schedule_time: '12:00'
    };
    const errors = validateAdkarItem(adkar, 0);
    return errors.length > 0 && errors.some(e => e.includes('schedule_days'));
});

runTest('ذكر بوقت غير صحيح', () => {
    const adkar = {
        category_id: 1,
        schedule_time: '25:99'
    };
    const errors = validateAdkarItem(adkar, 0);
    return errors.length > 0 && errors.some(e => e.includes('وقت الجدولة'));
});

runTest('ذكر بأسماء حقول قديمة (type, days_of_week)', () => {
    const adkar = {
        category_id: 1,
        type: 'audio',
        days_of_week: '[0,6]',
        schedule_time: '08:00'
    };
    const errors = validateAdkarItem(adkar, 0);
    return errors.length === 0;
});

console.log();

// ========== اختبار 4: التحقق من صحة المجموعة ==========
console.log('📝 اختبار 4: التحقق من صحة عناصر المجموعات');
console.log('='.repeat(50));

runTest('مجموعة صحيحة', () => {
    const group = {
        chat_id: 12345,
        title: 'Test Group',
        admin_id: 67890
    };
    const errors = validateGroupItem(group, 0);
    return errors.length === 0;
});

runTest('مجموعة مفقود chat_id', () => {
    const group = {
        title: 'Test Group'
    };
    const errors = validateGroupItem(group, 0);
    return errors.length > 0 && errors.some(e => e.includes('chat_id'));
});

runTest('مجموعة مفقود title', () => {
    const group = {
        chat_id: 12345
    };
    const errors = validateGroupItem(group, 0);
    return errors.length > 0 && errors.some(e => e.includes('title'));
});

runTest('مجموعة بإعدادات JSON غير صحيحة', () => {
    const group = {
        chat_id: 12345,
        title: 'Test',
        settings: '{invalid json}'
    };
    const errors = validateGroupItem(group, 0);
    return errors.length > 0 && errors.some(e => e.includes('settings'));
});

console.log();

// ========== اختبار 5: التحقق من صحة الفئة ==========
console.log('📝 اختبار 5: التحقق من صحة عناصر الفئات');
console.log('='.repeat(50));

runTest('فئة صحيحة', () => {
    const category = {
        name: 'Test Category',
        description: 'Description'
    };
    const errors = validateCategoryItem(category, 0);
    return errors.length === 0;
});

runTest('فئة مفقود name', () => {
    const category = {
        description: 'Description'
    };
    const errors = validateCategoryItem(category, 0);
    return errors.length > 0 && errors.some(e => e.includes('الاسم'));
});

console.log();

// ========== اختبار 6: التحقق الشامل من النسخة الاحتياطية ==========
console.log('📝 اختبار 6: التحقق الشامل من النسخة الاحتياطية');
console.log('='.repeat(50));

runTest('نسخة احتياطية صحيحة كاملة', () => {
    const backup = {
        timestamp: '2024-01-01T00:00:00Z',
        version: '1.0',
        data: {
            categories: [{ name: 'Cat1' }],
            adkar: [{
                category_id: 1,
                schedule_time: '12:00',
                schedule_days: '[0,1,2,3,4,5,6]'
            }],
            groups: [{
                chat_id: 123,
                title: 'Group1'
            }]
        }
    };
    const result = validateBackupData(backup);
    return result.valid === true;
});

runTest('نسخة احتياطية بدون حقل data', () => {
    const backup = {
        timestamp: '2024-01-01T00:00:00Z'
    };
    const result = validateBackupData(backup);
    return result.valid === false && result.errors.some(e => e.includes('data'));
});

runTest('نسخة احتياطية فارغة', () => {
    const result = validateBackupData(null);
    return result.valid === false;
});

runTest('نسخة احتياطية بدون بيانات (تحذير فقط)', () => {
    const backup = {
        data: {
            categories: [],
            adkar: [],
            groups: []
        }
    };
    const result = validateBackupData(backup);
    return result.warnings.length > 0;
});

runTest('نسخة احتياطية ببيانات غير صحيحة', () => {
    const backup = {
        data: {
            adkar: [{
                // missing category_id
                schedule_time: 'invalid_time'
            }]
        }
    };
    const result = validateBackupData(backup);
    return result.valid === false && result.errors.length > 0;
});

runTest('نسخة احتياطية مع حقول ليست مصفوفات', () => {
    const backup = {
        data: {
            categories: 'not an array'
        }
    };
    const result = validateBackupData(backup);
    return result.valid === false && result.errors.some(e => e.includes('مصفوفة'));
});

console.log();

// ========== الملخص ==========
console.log('='.repeat(50));
console.log('📊 ملخص الاختبارات');
console.log('='.repeat(50));
console.log(`إجمالي الاختبارات: ${totalTests}`);
console.log(`✅ نجح: ${passedTests}`);
console.log(`❌ فشل: ${failedTests}`);
console.log(`📈 نسبة النجاح: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (failedTests === 0) {
    console.log('\n🎉 جميع الاختبارات نجحت! نظام التحقق من صحة النسخ الاحتياطية يعمل بشكل صحيح.');
    process.exit(0);
} else {
    console.log(`\n⚠️  فشل ${failedTests} اختبار(ات). يرجى مراجعة التطبيق.`);
    process.exit(1);
}
