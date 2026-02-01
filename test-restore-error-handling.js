/**
 * Test: Backup Restoration Error Handling
 * 
 * Tests the improved error handling in the backup restoration system
 */

const backupValidator = require('./lib/backup-validator');

console.log('🧪 Testing Backup Restoration Error Handling...\n');

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

// Test 1: Valid JSON with native arrays (should work after fixes)
test('Valid backup with native arrays', () => {
    const backup = {
        version: "3.0.0",
        data: {
            adkar: [{
                id: 1,
                category_id: 1,
                title: "Test",
                content: "Content",
                content_type: "text",
                schedule_days: [0, 1, 2, 3, 4, 5, 6], // Native array
                schedule_dates: [],
                schedule_months: [],
                schedule_time: "08:00"
            }]
        }
    };
    
    const validation = backupValidator.validateBackupDataEnhanced(backup);
    if (!validation.valid) {
        throw new Error('Valid backup should pass validation');
    }
});

// Test 2: Valid JSON with string arrays
test('Valid backup with string arrays', () => {
    const backup = {
        version: "3.0.0",
        data: {
            adkar: [{
                id: 1,
                category_id: 1,
                title: "Test",
                content: "Content",
                content_type: "text",
                schedule_days: "[0,1,2,3,4,5,6]", // String array
                schedule_dates: "[]",
                schedule_months: "[]",
                schedule_time: "08:00"
            }]
        }
    };
    
    const validation = backupValidator.validateBackupDataEnhanced(backup);
    if (!validation.valid) {
        throw new Error('Valid backup should pass validation');
    }
});

// Test 3: Invalid schedule_days should be caught
test('Invalid schedule_days detected', () => {
    const backup = {
        version: "3.0.0",
        data: {
            adkar: [{
                id: 1,
                category_id: 1,
                title: "Test",
                content: "Content",
                content_type: "text",
                schedule_days: "not-a-json-array", // Invalid
                schedule_dates: "[]",
                schedule_months: "[]",
                schedule_time: "08:00"
            }]
        }
    };
    
    const validation = backupValidator.validateBackupDataEnhanced(backup);
    if (validation.valid) {
        throw new Error('Invalid schedule_days should fail validation');
    }
    
    // Check that the error message is helpful
    const hasScheduleDaysError = validation.errors.some(e => 
        e.field === 'schedule_days' && e.suggestion
    );
    if (!hasScheduleDaysError) {
        throw new Error('Should have helpful error message for schedule_days');
    }
});

// Test 4: Invalid time format should be caught
test('Invalid time format detected', () => {
    const backup = {
        version: "3.0.0",
        data: {
            adkar: [{
                id: 1,
                category_id: 1,
                title: "Test",
                content: "Content",
                content_type: "text",
                schedule_days: "[0,1,2,3,4,5,6]",
                schedule_dates: "[]",
                schedule_months: "[]",
                schedule_time: "25:00" // Invalid hour
            }]
        }
    };
    
    const validation = backupValidator.validateBackupDataEnhanced(backup);
    if (validation.valid) {
        throw new Error('Invalid time should fail validation');
    }
    
    // Check that the error message is helpful
    const hasTimeError = validation.errors.some(e => 
        e.field === 'schedule_time' && e.suggestion
    );
    if (!hasTimeError) {
        throw new Error('Should have helpful error message for schedule_time');
    }
});

// Test 5: Mixed format (object for settings) should work
test('Object settings are handled', () => {
    const backup = {
        version: "3.0.0",
        data: {
            groups: [{
                id: 1,
                chat_id: -123456789,
                title: "Test Group",
                settings: {theme: "dark"} // Object instead of string
            }]
        }
    };
    
    const validation = backupValidator.validateBackupDataEnhanced(backup);
    if (!validation.valid) {
        throw new Error('Object settings should be accepted');
    }
});

// Test 6: String IDs should be validated (type coercion test)
test('String IDs are accepted', () => {
    const backup = {
        version: "3.0.0",
        data: {
            categories: [{
                id: "1", // String instead of number
                name: "Test Category"
            }]
        }
    };
    
    const validation = backupValidator.validateBackupDataEnhanced(backup);
    if (!validation.valid) {
        throw new Error('String IDs should be accepted (will be coerced)');
    }
});

// Test 7: Empty backup should produce warning, not error
test('Empty backup produces warning', () => {
    const backup = {
        version: "3.0.0",
        data: {
            categories: [],
            adkar: [],
            groups: []
        }
    };
    
    const validation = backupValidator.validateBackupDataEnhanced(backup);
    if (!validation.valid) {
        throw new Error('Empty backup should be valid (with warning)');
    }
    if (validation.warnings.length === 0) {
        throw new Error('Empty backup should produce warning');
    }
});

// Test 8: Multiple validation errors should all be reported
test('Multiple errors are reported', () => {
    const backup = {
        version: "3.0.0",
        data: {
            adkar: [
                {
                    id: 1,
                    // missing category_id
                    title: "Test 1",
                    content_type: "invalid-type", // Invalid type
                    schedule_time: "invalid" // Invalid time
                },
                {
                    id: 2,
                    // missing category_id
                    title: "Test 2",
                    schedule_days: "not-json" // Invalid JSON
                }
            ]
        }
    };
    
    const validation = backupValidator.validateBackupDataEnhanced(backup);
    if (validation.valid) {
        throw new Error('Should detect validation errors');
    }
    
    // Should have multiple errors (at least 4: 2x missing category_id, 1x invalid type, 1x invalid time, 1x invalid JSON)
    if (validation.errors.length < 4) {
        throw new Error(`Should report multiple errors, got ${validation.errors.length}`);
    }
});

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 Test Summary');
console.log('='.repeat(50));
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`📈 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
console.log('='.repeat(50));

if (failedTests === 0) {
    console.log('\n🎉 All error handling tests passed!\n');
    process.exit(0);
} else {
    console.log('\n⚠️  Some tests failed. Please review.\n');
    process.exit(1);
}
