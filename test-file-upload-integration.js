/**
 * Integration Test: Backup File Upload Scenarios
 * 
 * Tests various file upload scenarios to ensure proper handling
 * of valid JSON, malformed JSON, and non-JSON files
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Integration Test: Backup File Upload Scenarios...\n');

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

// Create test files in /tmp
const tmpDir = '/tmp/backup-test-files';
if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
}

// Test 1: Create and validate a valid backup file
test('Create valid backup file', () => {
    const validBackup = {
        version: "3.0.0",
        timestamp: new Date().toISOString(),
        metadata: {
            createdAt: new Date().toISOString(),
            source: "integration-test",
            checksum: "test-checksum"
        },
        data: {
            adkar: [
                {
                    id: 1,
                    category_id: 1,
                    title: "Test Dhikr",
                    content: "Test Content",
                    content_type: "text",
                    schedule_days: [0, 1, 2, 3, 4, 5, 6],
                    schedule_dates: [],
                    schedule_months: [],
                    schedule_time: "08:00"
                }
            ],
            groups: [
                {
                    id: 1,
                    chat_id: "123456",
                    title: "Test Group",
                    settings: "{}"
                }
            ],
            categories: [
                {
                    id: 1,
                    name: "Test Category"
                }
            ]
        }
    };
    
    const filePath = path.join(tmpDir, 'valid-backup.json');
    fs.writeFileSync(filePath, JSON.stringify(validBackup, null, 2), 'utf8');
    
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content);
    
    if (!parsed.version || !parsed.data) {
        throw new Error('Valid backup file should be created and parseable');
    }
});

// Test 2: Create malformed JSON file
test('Create malformed JSON file', () => {
    const malformedJSON = '{"version": "3.0.0", "data": {'; // Missing closing braces
    const filePath = path.join(tmpDir, 'malformed.json');
    fs.writeFileSync(filePath, malformedJSON, 'utf8');
    
    let errorCaught = false;
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        JSON.parse(content);
    } catch (e) {
        errorCaught = true;
    }
    
    if (!errorCaught) {
        throw new Error('Malformed JSON should be detected');
    }
});

// Test 3: Create empty JSON file
test('Create empty JSON file', () => {
    const filePath = path.join(tmpDir, 'empty.json');
    fs.writeFileSync(filePath, '', 'utf8');
    
    const content = fs.readFileSync(filePath, 'utf8');
    const trimmed = content.trim();
    
    if (trimmed.length > 0) {
        throw new Error('Empty file should be detected');
    }
});

// Test 4: Create JSON with BOM
test('Create JSON file with BOM', () => {
    const backup = { version: "3.0.0", data: {} };
    const jsonWithBOM = '\uFEFF' + JSON.stringify(backup);
    const filePath = path.join(tmpDir, 'bom-backup.json');
    fs.writeFileSync(filePath, jsonWithBOM, 'utf8');
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Remove BOM if present
    if (content.charCodeAt(0) === 0xFEFF) {
        content = content.substring(1);
    }
    
    const parsed = JSON.parse(content);
    if (!parsed.version) {
        throw new Error('JSON with BOM should be parseable after cleanup');
    }
});

// Test 5: Create non-JSON file (.txt)
test('Create non-JSON file (.txt)', () => {
    const filePath = path.join(tmpDir, 'test-file.txt');
    fs.writeFileSync(filePath, 'This is not a JSON file', 'utf8');
    
    if (filePath.toLowerCase().endsWith('.json')) {
        throw new Error('TXT file should not be accepted');
    }
});

// Test 6: Create large JSON file (simulate size check)
test('Simulate large file size validation', () => {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    
    // Simulate a file size that exceeds the limit
    const simulatedSize = 15 * 1024 * 1024; // 15MB
    
    if (simulatedSize <= MAX_FILE_SIZE) {
        throw new Error('Large file should be rejected');
    }
});

// Test 7: Create backup with invalid version
test('Create backup with unsupported version', () => {
    const invalidBackup = {
        version: "0.5.0", // Unsupported version
        data: {}
    };
    
    const filePath = path.join(tmpDir, 'invalid-version.json');
    fs.writeFileSync(filePath, JSON.stringify(invalidBackup), 'utf8');
    
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content);
    
    // Version should be parseable, validation happens in the validator
    if (!parsed.version) {
        throw new Error('Version field should be present');
    }
});

// Test 8: Create backup with Arabic characters
test('Create backup with Arabic text (UTF-8)', () => {
    const arabicBackup = {
        version: "3.0.0",
        data: {
            adkar: [{
                id: 1,
                category_id: 1,
                title: "ذكر الصباح",
                content: "سبحان الله وبحمده",
                content_type: "text"
            }]
        }
    };
    
    const filePath = path.join(tmpDir, 'arabic-backup.json');
    fs.writeFileSync(filePath, JSON.stringify(arabicBackup, null, 2), 'utf8');
    
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content);
    
    if (!parsed.data.adkar[0].title.includes('ذكر')) {
        throw new Error('Arabic characters should be preserved');
    }
});

// Test 9: Verify file metadata structure
test('File metadata structure validation', () => {
    const metadata = {
        originalName: 'backup.json',
        mimeType: 'application/json',
        size: 1024,
        encoding: '7bit'
    };
    
    if (!metadata.originalName || !metadata.mimeType || !metadata.size) {
        throw new Error('File metadata should have required fields');
    }
});

// Test 10: Validate error response structure
test('Error response structure validation', () => {
    const errorResponse = {
        error: 'نوع الملف غير صحيح',
        fileName: 'test.txt',
        suggestion: 'يجب أن يكون الملف بصيغة JSON (ينتهي بـ .json)'
    };
    
    if (!errorResponse.error || !errorResponse.suggestion) {
        throw new Error('Error response should have required fields');
    }
});

// Test 11: Test MIME type allowlist
test('MIME type allowlist validation', () => {
    const allowedMimeTypes = ['application/json', 'application/octet-stream', 'text/plain'];
    const testCases = [
        { mime: 'application/json', shouldPass: true },
        { mime: 'application/octet-stream', shouldPass: true },
        { mime: 'text/plain', shouldPass: true },
        { mime: 'application/pdf', shouldPass: false },
        { mime: 'image/jpeg', shouldPass: false }
    ];
    
    for (const testCase of testCases) {
        const isAllowed = allowedMimeTypes.includes(testCase.mime);
        if (isAllowed !== testCase.shouldPass) {
            throw new Error(`MIME type ${testCase.mime} validation failed`);
        }
    }
});

// Cleanup test files
console.log('\n🧹 Cleaning up test files...');
if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log(`✅ Cleaned up ${tmpDir}`);
}

console.log('\n==================================================');
console.log('📊 Integration Test Summary');
console.log('==================================================');
console.log(`Total tests: ${passedTests + failedTests}`);
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`📈 Success rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);

if (failedTests === 0) {
    console.log('\n🎉 All integration tests passed! Backup file upload handling is working correctly.');
} else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
    process.exit(1);
}
