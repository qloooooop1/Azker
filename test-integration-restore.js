/**
 * Integration Test: Complete Backup Restoration Flow
 * 
 * This test simulates the complete backup restoration process
 * to ensure all components work together correctly.
 */

const fs = require('fs');
const path = require('path');
const backupValidator = require('./lib/backup-validator');
const backupVersionManager = require('./lib/backup-version-manager');

console.log('🧪 Integration Test: Complete Backup Restoration Flow\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        testsPassed++;
    } catch (error) {
        console.log(`❌ ${name}: ${error.message}`);
        console.error(error.stack);
        testsFailed++;
    }
}

// Test 1: Load and validate a problematic backup file
test('Load test-problematic-backup.json', () => {
    const backupPath = path.join(__dirname, 'test-problematic-backup.json');
    if (!fs.existsSync(backupPath)) {
        throw new Error('Test file not found');
    }
    
    const fileContent = fs.readFileSync(backupPath, 'utf8');
    const backupData = JSON.parse(fileContent);
    
    // This file has string IDs and native arrays - should be valid after our fixes
    const validation = backupValidator.validateBackupDataEnhanced(backupData);
    
    if (!validation.valid) {
        console.log('Validation errors:', validation.errors);
        throw new Error('test-problematic-backup.json should be valid');
    }
});

// Test 2: Version detection and migration
test('Version detection works correctly', () => {
    const v3Backup = {
        version: "3.0.0",
        data: { categories: [], adkar: [], groups: [] }
    };
    
    const detectedVersion = backupVersionManager.detectBackupVersion(v3Backup);
    if (detectedVersion !== '3.0.0') {
        throw new Error(`Expected v3.0.0, got ${detectedVersion}`);
    }
});

// Test 3: Migration from v1.0 to current
test('Migration from v1.0 to current version', () => {
    const v1Backup = {
        version: "1.0.0",
        adkar: [{
            id: 1,
            category_id: 1,
            title: "Test",
            content: "Content",
            type: "text", // v1.0 used "type" instead of "content_type"
            days_of_week: "[0,1,2,3,4,5,6]" // v1.0 used "days_of_week"
        }]
    };
    
    const migrated = backupVersionManager.migrateToCurrentVersion(v1Backup, console);
    
    // Check migration worked - v3.0 wraps data in nested structure
    if (!migrated.data) {
        throw new Error('Migration should wrap data in nested structure');
    }
    
    if (!migrated.data.adkar || migrated.data.adkar.length === 0) {
        throw new Error('Migration should preserve adkar data');
    }
    
    if (!migrated.data.adkar[0].content_type) {
        throw new Error('Migration should add content_type field');
    }
    
    if (!migrated.data.adkar[0].schedule_days) {
        throw new Error('Migration should add schedule_days field');
    }
});

// Test 4: Handle backup with mixed formats (arrays and strings)
test('Handle mixed format backup', () => {
    const mixedBackup = {
        version: "3.0.0",
        data: {
            categories: [
                { id: "1", name: "Cat1" }, // String ID
                { id: 2, name: "Cat2" }    // Number ID
            ],
            adkar: [
                {
                    id: 1,
                    category_id: 1,
                    title: "Test 1",
                    content: "Content",
                    schedule_days: "[0,1,2,3,4,5,6]", // String array
                    schedule_dates: "[]",
                    schedule_months: "[]",
                    schedule_time: "08:00"
                },
                {
                    id: 2,
                    category_id: 2,
                    title: "Test 2",
                    content: "Content",
                    schedule_days: [0,1,2,3,4,5,6], // Native array
                    schedule_dates: [],
                    schedule_months: [],
                    schedule_time: "14:00"
                }
            ],
            groups: [
                {
                    id: 1,
                    chat_id: -123456789,
                    title: "Group",
                    settings: {theme: "dark"} // Object
                },
                {
                    id: 2,
                    chat_id: -987654321,
                    title: "Group 2",
                    settings: "{\"theme\":\"light\"}" // String
                }
            ]
        }
    };
    
    const validation = backupValidator.validateBackupDataEnhanced(mixedBackup);
    if (!validation.valid) {
        console.log('Validation errors:', validation.errors);
        throw new Error('Mixed format backup should be valid');
    }
});

// Test 5: Error reporting for invalid data
test('Proper error reporting for invalid data', () => {
    const invalidBackup = {
        version: "3.0.0",
        data: {
            adkar: [
                {
                    id: 1,
                    // Missing category_id
                    title: "Invalid",
                    content_type: "invalid-type",
                    schedule_time: "25:99", // Invalid time
                    schedule_days: "not-json" // Invalid JSON
                }
            ]
        }
    };
    
    const validation = backupValidator.validateBackupDataEnhanced(invalidBackup);
    
    // Should have multiple errors
    if (validation.valid) {
        throw new Error('Should detect validation errors');
    }
    
    // Check error structure
    const hasFieldInfo = validation.errors.every(err => err.field !== undefined);
    if (!hasFieldInfo) {
        throw new Error('All errors should have field information');
    }
    
    const hasSuggestions = validation.errors.some(err => err.suggestion !== undefined);
    if (!hasSuggestions) {
        throw new Error('Errors should have suggestions');
    }
});

// Test 6: Validate example backup files
test('Validate backup-v3.0-example.json', () => {
    const examplePath = path.join(__dirname, 'examples', 'backup-v3.0-example.json');
    if (!fs.existsSync(examplePath)) {
        throw new Error('Example file not found');
    }
    
    const fileContent = fs.readFileSync(examplePath, 'utf8');
    const backupData = JSON.parse(fileContent);
    const validation = backupValidator.validateBackupDataEnhanced(backupData);
    
    if (!validation.valid) {
        console.log('Validation errors:', validation.errors);
        throw new Error('v3.0 example should be valid');
    }
});

// Test 7: JSON validation
test('JSON validation catches invalid JSON', () => {
    const invalidJSON = '{"invalid": json}';
    const result = backupValidator.isValidJSON(invalidJSON);
    
    if (result.valid) {
        throw new Error('Should detect invalid JSON');
    }
    
    if (!result.details) {
        throw new Error('Should provide error details');
    }
});

// Test 8: Empty backup handling
test('Empty backup is valid but warns', () => {
    const emptyBackup = {
        version: "3.0.0",
        data: {
            categories: [],
            adkar: [],
            groups: []
        }
    };
    
    const validation = backupValidator.validateBackupDataEnhanced(emptyBackup);
    
    if (!validation.valid) {
        throw new Error('Empty backup should be valid');
    }
    
    if (validation.warnings.length === 0) {
        throw new Error('Empty backup should produce warning');
    }
});

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Integration Test Summary');
console.log('='.repeat(60));
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
console.log('='.repeat(60));

if (testsFailed === 0) {
    console.log('\n🎉 All integration tests passed!');
    console.log('✅ Backup restoration system is working correctly\n');
    process.exit(0);
} else {
    console.log('\n⚠️  Some integration tests failed\n');
    process.exit(1);
}
