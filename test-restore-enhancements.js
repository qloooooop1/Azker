/**
 * Test: Enhanced Backup Restoration
 * 
 * Tests for the enhanced restore endpoint with:
 * - UTF-8 encoding validation
 * - SHA-256 checksum validation
 * - Improved JSON error handling
 * - Proper HTTP response headers
 */

const backupValidator = require('./lib/backup-validator');
const backupMetadata = require('./lib/backup-metadata');
const crypto = require('crypto');

console.log('🧪 Testing Enhanced Backup Restoration Features...\n');

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passedTests++;
    } catch (error) {
        console.log(`❌ ${name}: ${error.message}`);
        failedTests++;
    }
}

// ========== UTF-8 Encoding Tests ==========
console.log('\n📝 UTF-8 Encoding Validation Tests');
console.log('='.repeat(50));

test('Valid UTF-8 JSON with Arabic text', () => {
    const content = '{"version":"3.0.0","data":{"categories":[{"id":1,"name":"صلاة الفجر"}]}}';
    const validation = backupValidator.isValidJSON(content);
    if (!validation.valid) {
        throw new Error('Valid UTF-8 JSON should pass');
    }
});

test('Empty string should be rejected', () => {
    const validation = backupValidator.isValidJSON('');
    if (validation.valid) {
        throw new Error('Empty string should not be valid JSON');
    }
});

test('Whitespace-only string should be rejected', () => {
    const validation = backupValidator.isValidJSON('   \n\t   ');
    if (validation.valid) {
        throw new Error('Whitespace-only string should not be valid JSON');
    }
});

// ========== SHA-256 Checksum Tests ==========
console.log('\n📝 SHA-256 Checksum Validation Tests');
console.log('='.repeat(50));

test('Generate valid SHA-256 checksum', () => {
    const data = {
        groups: [],
        adkar: [],
        categories: []
    };
    
    const checksum = backupMetadata.generateChecksum(data);
    
    // SHA-256 produces 64 hex characters
    if (checksum.length !== 64) {
        throw new Error(`Expected 64 character checksum, got ${checksum.length}`);
    }
    
    // Should be valid hex
    if (!/^[a-f0-9]{64}$/i.test(checksum)) {
        throw new Error('Checksum should be 64 hex characters');
    }
});

test('Verify valid checksum', () => {
    const data = {
        groups: [{id: 1, chat_id: -123, title: "Test"}],
        adkar: [],
        categories: []
    };
    
    const backup = backupMetadata.createBackupWithMetadata(data);
    
    const isValid = backupMetadata.verifyChecksum(backup);
    if (!isValid) {
        throw new Error('Valid checksum should verify successfully');
    }
});

test('Detect tampered backup data', () => {
    const data = {
        groups: [{id: 1, chat_id: -123, title: "Original"}],
        adkar: [],
        categories: []
    };
    
    const backup = backupMetadata.createBackupWithMetadata(data);
    
    // Tamper with the data
    backup.data.groups[0].title = "Tampered";
    
    const isValid = backupMetadata.verifyChecksum(backup);
    if (isValid) {
        throw new Error('Tampered backup should fail checksum verification');
    }
});

test('Missing checksum returns false', () => {
    const backup = {
        version: "3.0.0",
        data: { groups: [], adkar: [], categories: [] }
        // No metadata.checksum
    };
    
    const isValid = backupMetadata.verifyChecksum(backup);
    if (isValid) {
        throw new Error('Missing checksum should return false');
    }
});

// ========== Malformed Backup Tests ==========
console.log('\n📝 Malformed Backup Detection Tests');
console.log('='.repeat(50));

test('Detect missing data field', () => {
    const backup = {
        version: "3.0.0"
        // Missing data field
    };
    
    const validation = backupValidator.validateBackupDataEnhanced(backup);
    if (validation.valid) {
        throw new Error('Backup without data field should fail');
    }
    
    const hasDataError = validation.errors.some(e => e.field === 'data');
    if (!hasDataError) {
        throw new Error('Should report missing data field');
    }
});

test('Detect invalid JSON in schedule fields', () => {
    const backup = {
        version: "3.0.0",
        data: {
            adkar: [{
                id: 1,
                category_id: 1,
                title: "Test",
                schedule_days: "not-valid-json",  // Invalid
                schedule_time: "08:00"
            }]
        }
    };
    
    const validation = backupValidator.validateBackupDataEnhanced(backup);
    if (validation.valid) {
        throw new Error('Invalid schedule_days JSON should fail');
    }
});

test('Detect invalid time format', () => {
    const backup = {
        version: "3.0.0",
        data: {
            adkar: [{
                id: 1,
                category_id: 1,
                title: "Test",
                schedule_days: "[0,1,2,3,4,5,6]",
                schedule_time: "25:99"  // Invalid time
            }]
        }
    };
    
    const validation = backupValidator.validateBackupDataEnhanced(backup);
    if (validation.valid) {
        throw new Error('Invalid time format should fail');
    }
    
    const hasTimeError = validation.errors.some(e => e.field === 'schedule_time');
    if (!hasTimeError) {
        throw new Error('Should report invalid time format');
    }
});

test('Detect invalid content_type', () => {
    const backup = {
        version: "3.0.0",
        data: {
            adkar: [{
                id: 1,
                category_id: 1,
                title: "Test",
                content_type: "invalid-type",  // Not in allowed list
                schedule_days: "[0,1,2,3,4,5,6]",
                schedule_time: "08:00"
            }]
        }
    };
    
    const validation = backupValidator.validateBackupDataEnhanced(backup);
    if (validation.valid) {
        throw new Error('Invalid content_type should fail');
    }
    
    const hasContentTypeError = validation.errors.some(e => e.field === 'content_type');
    if (!hasContentTypeError) {
        throw new Error('Should report invalid content_type');
    }
});

test('Detect missing required fields in group', () => {
    const backup = {
        version: "3.0.0",
        data: {
            groups: [{
                id: 1
                // Missing chat_id and title
            }]
        }
    };
    
    const validation = backupValidator.validateBackupDataEnhanced(backup);
    if (validation.valid) {
        throw new Error('Group with missing required fields should fail');
    }
    
    // Should have errors for both chat_id and title
    const hasChatIdError = validation.errors.some(e => e.field === 'chat_id');
    const hasTitleError = validation.errors.some(e => e.field === 'title');
    
    if (!hasChatIdError || !hasTitleError) {
        throw new Error('Should report missing chat_id and title');
    }
});

test('Detect invalid settings JSON in group', () => {
    const backup = {
        version: "3.0.0",
        data: {
            groups: [{
                id: 1,
                chat_id: -123,
                title: "Test",
                settings: "not-valid-json"  // Invalid JSON
            }]
        }
    };
    
    const validation = backupValidator.validateBackupDataEnhanced(backup);
    if (validation.valid) {
        throw new Error('Invalid settings JSON should fail');
    }
});

// ========== Edge Cases ==========
console.log('\n📝 Edge Case Tests');
console.log('='.repeat(50));

test('Handle very large backup data', () => {
    const data = {
        groups: [],
        adkar: [],
        categories: []
    };
    
    // Create 1000 adkar entries
    for (let i = 0; i < 1000; i++) {
        data.adkar.push({
            id: i,
            category_id: 1,
            title: `Test ${i}`,
            content: `Content ${i}`,
            content_type: 'text',
            schedule_days: '[0,1,2,3,4,5,6]',
            schedule_dates: '[]',
            schedule_months: '[]',
            schedule_time: '08:00'
        });
    }
    
    const backup = backupMetadata.createBackupWithMetadata(data);
    const isValid = backupMetadata.verifyChecksum(backup);
    
    if (!isValid) {
        throw new Error('Large backup should verify correctly');
    }
});

test('Handle backup with Unicode characters', () => {
    const data = {
        groups: [],
        adkar: [{
            id: 1,
            category_id: 1,
            title: "صلاة الفجر 🌅 الصباح",
            content: "اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا",
            content_type: 'text',
            schedule_days: '[0,1,2,3,4,5,6]',
            schedule_dates: '[]',
            schedule_months: '[]',
            schedule_time: '06:00'
        }],
        categories: [{
            id: 1,
            name: "الأذكار اليومية 📿"
        }]
    };
    
    const backup = backupMetadata.createBackupWithMetadata(data);
    const isValid = backupMetadata.verifyChecksum(backup);
    
    if (!isValid) {
        throw new Error('Unicode backup should verify correctly');
    }
});

test('Checksum stability across multiple generations', () => {
    const data = {
        groups: [{id: 1, chat_id: -123, title: "Test"}],
        adkar: [],
        categories: []
    };
    
    const checksum1 = backupMetadata.generateChecksum(data);
    const checksum2 = backupMetadata.generateChecksum(data);
    const checksum3 = backupMetadata.generateChecksum(data);
    
    if (checksum1 !== checksum2 || checksum2 !== checksum3) {
        throw new Error('Same data should always produce same checksum');
    }
});

// ========== Summary ==========
console.log('\n' + '='.repeat(50));
console.log('📊 Test Summary');
console.log('='.repeat(50));
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`📈 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
console.log('='.repeat(50));

if (failedTests === 0) {
    console.log('\n🎉 All enhanced restoration tests passed!\n');
    console.log('✅ UTF-8 encoding validation working');
    console.log('✅ SHA-256 checksum validation working');
    console.log('✅ Malformed backup detection working');
    console.log('✅ Edge cases handled correctly\n');
    process.exit(0);
} else {
    console.log('\n⚠️  Some tests failed. Please review.\n');
    process.exit(1);
}
