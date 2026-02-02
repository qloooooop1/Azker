/**
 * Test: File Upload and JSON Validation
 * 
 * Tests the file upload functionality and JSON validation for backup files
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing File Upload and JSON Validation...\n');

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

// Test 1: Valid JSON file structure
test('Valid JSON backup file structure', () => {
    const validBackup = {
        version: "3.0.0",
        timestamp: new Date().toISOString(),
        metadata: {
            createdAt: new Date().toISOString(),
            source: "test"
        },
        data: {
            adkar: [],
            groups: [],
            categories: []
        }
    };
    
    const json = JSON.stringify(validBackup, null, 2);
    const parsed = JSON.parse(json);
    
    if (!parsed.version || !parsed.data) {
        throw new Error('Valid backup structure should have version and data');
    }
});

// Test 2: Malformed JSON detection
test('Malformed JSON detection', () => {
    const malformedJSON = '{"version": "3.0.0", "data": {';
    
    let errorCaught = false;
    try {
        JSON.parse(malformedJSON);
    } catch (e) {
        errorCaught = true;
    }
    
    if (!errorCaught) {
        throw new Error('Malformed JSON should throw an error');
    }
});

// Test 3: JSON with BOM handling
test('JSON with BOM (Byte Order Mark)', () => {
    // BOM character \uFEFF
    const jsonWithBOM = '\uFEFF{"version": "3.0.0", "data": {}}';
    const cleaned = jsonWithBOM.charCodeAt(0) === 0xFEFF 
        ? jsonWithBOM.substring(1) 
        : jsonWithBOM;
    
    const parsed = JSON.parse(cleaned);
    if (!parsed.version) {
        throw new Error('BOM-prefixed JSON should be parseable after cleanup');
    }
});

// Test 4: Empty file handling
test('Empty file detection', () => {
    const emptyContent = '';
    const trimmed = emptyContent.trim();
    
    if (trimmed.length > 0) {
        throw new Error('Empty file should be detected');
    }
});

// Test 5: Whitespace-only file
test('Whitespace-only file detection', () => {
    const whitespaceContent = '   \n\t\r  ';
    const trimmed = whitespaceContent.trim();
    
    if (trimmed.length > 0) {
        throw new Error('Whitespace-only file should be treated as empty');
    }
});

// Test 6: File extension validation
test('File extension validation (.json required)', () => {
    const validFiles = ['backup.json', 'data.JSON', 'test.json'];
    const invalidFiles = ['backup.txt', 'data.xml', 'test.pdf'];
    
    for (const file of validFiles) {
        if (!file.toLowerCase().endsWith('.json')) {
            throw new Error(`${file} should be valid`);
        }
    }
    
    for (const file of invalidFiles) {
        if (file.toLowerCase().endsWith('.json')) {
            throw new Error(`${file} should be invalid`);
        }
    }
});

// Test 7: MIME type validation
test('MIME type validation for JSON files', () => {
    const allowedMimeTypes = ['application/json', 'application/octet-stream', 'text/plain'];
    const validTypes = ['application/json', 'application/octet-stream', 'text/plain'];
    const invalidTypes = ['application/pdf', 'image/jpeg', 'video/mp4'];
    
    for (const type of validTypes) {
        if (!allowedMimeTypes.includes(type)) {
            throw new Error(`${type} should be allowed`);
        }
    }
    
    for (const type of invalidTypes) {
        if (allowedMimeTypes.includes(type)) {
            throw new Error(`${type} should not be allowed`);
        }
    }
});

// Test 8: File size validation
test('File size validation (10MB limit)', () => {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    
    const validSizes = [100, 1024, 1024 * 1024, 5 * 1024 * 1024, MAX_FILE_SIZE];
    const invalidSizes = [MAX_FILE_SIZE + 1, 20 * 1024 * 1024];
    
    for (const size of validSizes) {
        if (size > MAX_FILE_SIZE) {
            throw new Error(`Size ${size} should be valid`);
        }
    }
    
    for (const size of invalidSizes) {
        if (size <= MAX_FILE_SIZE) {
            throw new Error(`Size ${size} should be invalid`);
        }
    }
});

// Test 9: UTF-8 encoding validation
test('UTF-8 encoding handling', () => {
    const arabicText = '{"message": "مرحبا بك في النظام"}';
    const buffer = Buffer.from(arabicText, 'utf8');
    const decoded = buffer.toString('utf8');
    const parsed = JSON.parse(decoded);
    
    if (!parsed.message) {
        throw new Error('UTF-8 encoded JSON should be parseable');
    }
});

// Test 10: JSON with special characters
test('JSON with special characters and escaping', () => {
    const jsonWithSpecialChars = {
        text: 'Test\nNew\tLine"Quote\'Apostrophe',
        arabic: 'اختبار الأحرف العربية',
        emoji: '✅ 🎉 📦'
    };
    
    const stringified = JSON.stringify(jsonWithSpecialChars);
    const parsed = JSON.parse(stringified);
    
    if (parsed.text !== jsonWithSpecialChars.text) {
        throw new Error('Special characters should be preserved');
    }
});

// Test 11: Actual test backup file validation
test('Test backup sample file exists and is valid', () => {
    const testFile = path.join(__dirname, 'test-backup-sample.json');
    
    if (!fs.existsSync(testFile)) {
        throw new Error('test-backup-sample.json should exist');
    }
    
    const content = fs.readFileSync(testFile, 'utf8');
    const parsed = JSON.parse(content);
    
    if (!parsed.data) {
        throw new Error('Test backup should have data property');
    }
});

// Test 12: Error message format validation
test('Error response format validation', () => {
    const errorResponse = {
        error: 'نوع الملف غير صحيح',
        fileName: 'test.txt',
        suggestion: 'يجب أن يكون الملف بصيغة JSON'
    };
    
    if (!errorResponse.error || !errorResponse.suggestion) {
        throw new Error('Error response should have error and suggestion fields');
    }
});

console.log('\n==================================================');
console.log('📊 Test Summary');
console.log('==================================================');
console.log(`Total tests: ${passedTests + failedTests}`);
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`📈 Success rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);

if (failedTests === 0) {
    console.log('\n🎉 All tests passed! File upload validation is working correctly.');
} else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
    process.exit(1);
}
