#!/usr/bin/env node

/**
 * Comprehensive Tests for Backup Version Management System
 * Tests versioning, migration, and backward compatibility
 */

const backupVersionManager = require('./lib/backup-version-manager');
const backupValidator = require('./lib/backup-validator');

console.log('🧪 Starting Backup Version Management Tests...\n');
console.log('='.repeat(70));

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

// ========== Test 1: Version Detection ==========
console.log('\n📝 Test Suite 1: Version Detection');
console.log('='.repeat(70));

runTest('Detect explicit v3.0.0', () => {
    const backup = { version: '3.0.0', data: {} };
    return backupVersionManager.detectBackupVersion(backup) === '3.0.0';
});

runTest('Detect explicit v2.0', () => {
    const backup = { version: '2.0', data: {} };
    return backupVersionManager.detectBackupVersion(backup) === '2.0';
});

runTest('Detect v2.0 by structure (has data field)', () => {
    const backup = { data: { groups: [], adkar: [] } };
    return backupVersionManager.detectBackupVersion(backup) === '2.0.0';
});

runTest('Detect v1.0 by structure (flat)', () => {
    const backup = { groups: [], adkar: [] };
    return backupVersionManager.detectBackupVersion(backup) === '1.0.0';
});

runTest('Detect unknown version for empty object', () => {
    const backup = {};
    return backupVersionManager.detectBackupVersion(backup) === 'unknown';
});

runTest('Detect unknown version for null', () => {
    return backupVersionManager.detectBackupVersion(null) === 'unknown';
});

// ========== Test 2: Version Support Check ==========
console.log('\n📝 Test Suite 2: Version Support Check');
console.log('='.repeat(70));

runTest('v3.0.0 is supported', () => {
    return backupVersionManager.isVersionSupported('3.0.0');
});

runTest('v3.0 is supported', () => {
    return backupVersionManager.isVersionSupported('3.0');
});

runTest('v2.0 is supported', () => {
    return backupVersionManager.isVersionSupported('2.0');
});

runTest('v1.0 is supported', () => {
    return backupVersionManager.isVersionSupported('1.0');
});

runTest('v4.0 is not supported', () => {
    return !backupVersionManager.isVersionSupported('4.0');
});

runTest('unknown version is not supported', () => {
    return !backupVersionManager.isVersionSupported('unknown');
});

// ========== Test 3: Migration from v1.0 to v3.0 ==========
console.log('\n📝 Test Suite 3: Migration from v1.0 to v3.0');
console.log('='.repeat(70));

runTest('Migrate v1.0 flat structure to v3.0', () => {
    const v1Backup = {
        timestamp: '2024-01-01T00:00:00Z',
        groups: [{ chat_id: 123, title: 'Group1' }],
        adkar: [{ category_id: 1, title: 'Adkar1' }],
        categories: [{ name: 'Cat1' }]
    };
    
    const logger = { log: () => {} }; // Silent logger
    const migrated = backupVersionManager.migrateToCurrentVersion(v1Backup, logger);
    
    return migrated.version === '3.0.0' &&
           migrated.data &&
           migrated.data.groups.length === 1 &&
           migrated.data.adkar.length === 1 &&
           migrated.data.categories.length === 1;
});

runTest('Migrate v1.0 field names (type -> content_type)', () => {
    const v1Backup = {
        adkar: [{
            category_id: 1,
            type: 'audio', // Old field name
            title: 'Test'
        }]
    };
    
    const logger = { log: () => {} };
    const migrated = backupVersionManager.migrateToCurrentVersion(v1Backup, logger);
    
    return migrated.data.adkar[0].content_type === 'audio' &&
           !migrated.data.adkar[0].type;
});

runTest('Migrate v1.0 field names (days_of_week -> schedule_days)', () => {
    const v1Backup = {
        adkar: [{
            category_id: 1,
            days_of_week: '[0,6]', // Old field name
            title: 'Test'
        }]
    };
    
    const logger = { log: () => {} };
    const migrated = backupVersionManager.migrateToCurrentVersion(v1Backup, logger);
    
    return migrated.data.adkar[0].schedule_days === '[0,6]' &&
           !migrated.data.adkar[0].days_of_week;
});

runTest('Migrate v1.0 adds default schedule fields', () => {
    const v1Backup = {
        adkar: [{
            category_id: 1,
            title: 'Test'
        }]
    };
    
    const logger = { log: () => {} };
    const migrated = backupVersionManager.migrateToCurrentVersion(v1Backup, logger);
    
    return migrated.data.adkar[0].schedule_days === '[0,1,2,3,4,5,6]' &&
           migrated.data.adkar[0].schedule_dates === '[]' &&
           migrated.data.adkar[0].schedule_months === '[]' &&
           migrated.data.adkar[0].schedule_time === '12:00' &&
           migrated.data.adkar[0].schedule_type === 'daily';
});

// ========== Test 4: Migration from v2.0 to v3.0 ==========
console.log('\n📝 Test Suite 4: Migration from v2.0 to v3.0');
console.log('='.repeat(70));

runTest('Migrate v2.0 to v3.0 (structure preserved)', () => {
    const v2Backup = {
        version: '2.0',
        timestamp: '2024-01-01T00:00:00Z',
        data: {
            groups: [{ chat_id: 123, title: 'Group1' }],
            adkar: [{ category_id: 1, title: 'Adkar1' }],
            categories: [{ name: 'Cat1' }]
        }
    };
    
    const logger = { log: () => {} };
    const migrated = backupVersionManager.migrateToCurrentVersion(v2Backup, logger);
    
    return migrated.version === '3.0.0' &&
           migrated.data.groups.length === 1 &&
           migrated.data.adkar.length === 1;
});

runTest('Migrate v2.0 with old field names', () => {
    const v2Backup = {
        version: '2.0',
        data: {
            adkar: [{
                category_id: 1,
                type: 'text',
                days_of_week: '[0,1,2,3,4,5,6]'
            }]
        }
    };
    
    const logger = { log: () => {} };
    const migrated = backupVersionManager.migrateToCurrentVersion(v2Backup, logger);
    
    return migrated.data.adkar[0].content_type === 'text' &&
           migrated.data.adkar[0].schedule_days === '[0,1,2,3,4,5,6]';
});

// ========== Test 5: No Migration for v3.0 ==========
console.log('\n📝 Test Suite 5: No Migration for Current Version');
console.log('='.repeat(70));

runTest('v3.0.0 backup not modified', () => {
    const v3Backup = {
        version: '3.0.0',
        timestamp: '2024-01-01T00:00:00Z',
        data: {
            groups: [],
            adkar: [],
            categories: []
        }
    };
    
    const logger = { log: () => {} };
    const migrated = backupVersionManager.migrateToCurrentVersion(v3Backup, logger);
    
    return migrated === v3Backup; // Same reference, not modified
});

// ========== Test 6: Unsupported Version Rejection ==========
console.log('\n📝 Test Suite 6: Unsupported Version Rejection');
console.log('='.repeat(70));

runTest('Reject unsupported version', () => {
    const unsupportedBackup = {
        version: '4.0.0',
        data: {}
    };
    
    const logger = { log: () => {} };
    
    try {
        backupVersionManager.migrateToCurrentVersion(unsupportedBackup, logger);
        return false; // Should have thrown
    } catch (error) {
        return error.message.includes('Unsupported backup version');
    }
});

runTest('Reject unknown version', () => {
    const unknownBackup = {};
    
    const logger = { log: () => {} };
    
    try {
        backupVersionManager.migrateToCurrentVersion(unknownBackup, logger);
        return false; // Should have thrown
    } catch (error) {
        return error.message.includes('Unsupported backup version');
    }
});

// ========== Test 7: Enhanced Validation Logger ==========
console.log('\n📝 Test Suite 7: Enhanced Validation Logger');
console.log('='.repeat(70));

runTest('ValidationLogger records errors', () => {
    const logger = new backupValidator.ValidationLogger();
    logger.error('Test error', 'field1', 'Fix suggestion');
    const report = logger.getReport();
    return report.errors.length === 1 && !report.valid;
});

runTest('ValidationLogger records warnings', () => {
    const logger = new backupValidator.ValidationLogger();
    logger.warn('Test warning', 'field1');
    const report = logger.getReport();
    return report.warnings.length === 1 && report.valid;
});

runTest('ValidationLogger records info', () => {
    const logger = new backupValidator.ValidationLogger();
    logger.log('Test info');
    const report = logger.getReport();
    return report.info.length === 1;
});

runTest('ValidationLogger validity check', () => {
    const logger = new backupValidator.ValidationLogger();
    logger.log('Info message');
    logger.warn('Warning message');
    const report1 = logger.getReport();
    
    logger.error('Error message');
    const report2 = logger.getReport();
    
    return report1.valid === true && report2.valid === false;
});

// ========== Test 8: Enhanced Backup Validation ==========
console.log('\n📝 Test Suite 8: Enhanced Backup Validation');
console.log('='.repeat(70));

runTest('Validate correct v3.0 backup', () => {
    const backup = {
        version: '3.0.0',
        timestamp: '2024-01-01T00:00:00Z',
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
    
    const validation = backupValidator.validateBackupDataEnhanced(backup);
    return validation.valid;
});

runTest('Detect missing category_id in adkar', () => {
    const backup = {
        version: '3.0.0',
        data: {
            adkar: [{
                title: 'Test'
                // Missing category_id
            }]
        }
    };
    
    const validation = backupValidator.validateBackupDataEnhanced(backup);
    return !validation.valid && 
           validation.errors.some(e => e.field === 'category_id');
});

runTest('Detect invalid content_type', () => {
    const backup = {
        version: '3.0.0',
        data: {
            adkar: [{
                category_id: 1,
                content_type: 'invalid_type'
            }]
        }
    };
    
    const validation = backupValidator.validateBackupDataEnhanced(backup);
    return !validation.valid && 
           validation.errors.some(e => e.field === 'content_type');
});

runTest('Detect invalid schedule_time format', () => {
    const backup = {
        version: '3.0.0',
        data: {
            adkar: [{
                category_id: 1,
                schedule_time: '25:99' // Invalid time
            }]
        }
    };
    
    const validation = backupValidator.validateBackupDataEnhanced(backup);
    return !validation.valid && 
           validation.errors.some(e => e.field === 'schedule_time');
});

runTest('Accept native JavaScript arrays in schedule_days', () => {
    const backup = {
        version: '3.0.0',
        data: {
            adkar: [{
                category_id: 1,
                schedule_days: [0, 1, 2, 3, 4, 5, 6], // Native array
                schedule_time: '12:00'
            }]
        }
    };
    
    const validation = backupValidator.validateBackupDataEnhanced(backup);
    return validation.valid;
});

// ========== Test 9: Backward Compatibility Integration Test ==========
console.log('\n📝 Test Suite 9: Backward Compatibility Integration');
console.log('='.repeat(70));

runTest('Full workflow: v1.0 -> migration -> validation', () => {
    const v1Backup = {
        groups: [{ chat_id: 123, title: 'Group1' }],
        adkar: [{
            category_id: 1,
            type: 'text',
            days_of_week: '[0,6]',
            title: 'Weekend Adkar'
        }],
        categories: [{ name: 'Weekend' }]
    };
    
    const logger = { log: () => {} };
    const migrated = backupVersionManager.migrateToCurrentVersion(v1Backup, logger);
    const validation = backupValidator.validateBackupDataEnhanced(migrated);
    
    return validation.valid &&
           migrated.version === '3.0.0' &&
           migrated.data.adkar[0].content_type === 'text' &&
           migrated.data.adkar[0].schedule_days === '[0,6]';
});

runTest('Full workflow: v2.0 -> migration -> validation', () => {
    const v2Backup = {
        version: '2.0',
        data: {
            groups: [{ chat_id: -1001234567890, title: 'Supergroup' }],
            adkar: [{
                category_id: 1,
                content_type: 'audio',
                schedule_days: '[0,1,2,3,4,5,6]',
                schedule_time: '08:00'
            }],
            categories: [{ name: 'Morning' }]
        }
    };
    
    const logger = { log: () => {} };
    const migrated = backupVersionManager.migrateToCurrentVersion(v2Backup, logger);
    const validation = backupValidator.validateBackupDataEnhanced(migrated);
    
    return validation.valid &&
           migrated.version === '3.0.0';
});

// ========== Test 10: Edge Cases ==========
console.log('\n📝 Test Suite 10: Edge Cases and Robustness');
console.log('='.repeat(70));

runTest('Handle empty v1.0 backup', () => {
    const v1Backup = {
        groups: [],
        adkar: [],
        categories: []
    };
    
    const logger = { log: () => {} };
    const migrated = backupVersionManager.migrateToCurrentVersion(v1Backup, logger);
    const validation = backupValidator.validateBackupDataEnhanced(migrated);
    
    return migrated.version === '3.0.0' &&
           validation.warnings.length > 0; // Should warn about empty data
});

runTest('Handle mixed old/new field names', () => {
    const v1Backup = {
        adkar: [{
            category_id: 1,
            type: 'text',
            content_type: 'audio', // Both old and new
            days_of_week: '[0,6]',
            schedule_days: '[1,2,3]' // Both old and new
        }]
    };
    
    const logger = { log: () => {} };
    const migrated = backupVersionManager.migrateToCurrentVersion(v1Backup, logger);
    
    // Should prefer new field names
    return migrated.data.adkar[0].content_type === 'audio' &&
           migrated.data.adkar[0].schedule_days === '[1,2,3]';
});

runTest('Handle large Telegram IDs (safe integer range)', () => {
    const backup = {
        version: '3.0.0',
        data: {
            groups: [{
                chat_id: -1009999999999, // Large supergroup ID
                title: 'Large Group'
            }]
        }
    };
    
    const validation = backupValidator.validateBackupDataEnhanced(backup);
    return validation.valid;
});

// ========== Summary ==========
console.log('\n' + '='.repeat(70));
console.log('📊 Test Summary');
console.log('='.repeat(70));
console.log(`Total Tests: ${totalTests}`);
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (failedTests === 0) {
    console.log('\n🎉 All tests passed! The backup version management system is working correctly.');
    process.exit(0);
} else {
    console.log(`\n⚠️  ${failedTests} test(s) failed. Please review the implementation.`);
    process.exit(1);
}
