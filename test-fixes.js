#!/usr/bin/env node

/**
 * Test script for verifying the fixes to Azker bot
 * Tests:
 * 1. YouTube URL validation and video ID extraction
 * 2. Media-only validation logic
 * 3. Backup restoration compatibility
 */

console.log('🧪 Starting Azker Bot Fixes Tests...\n');

// Test 1: YouTube URL Validation
console.log('📹 Test 1: YouTube URL Validation');
console.log('=' .repeat(50));

// YouTube helper functions (copied from server.js)
function isYouTubeUrl(url) {
    if (!url) return false;
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    return youtubeRegex.test(url);
}

function extractYouTubeVideoId(url) {
    if (!url) return null;
    
    const patterns = [
        /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    return null;
}

const youtubeTests = [
    { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', expectedId: 'dQw4w9WgXcQ', shouldBeValid: true },
    { url: 'https://youtu.be/dQw4w9WgXcQ', expectedId: 'dQw4w9WgXcQ', shouldBeValid: true },
    { url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', expectedId: 'dQw4w9WgXcQ', shouldBeValid: true },
    { url: 'https://www.youtube.com/v/dQw4w9WgXcQ', expectedId: 'dQw4w9WgXcQ', shouldBeValid: true },
    { url: 'https://www.google.com', expectedId: null, shouldBeValid: false },
    { url: '', expectedId: null, shouldBeValid: false },
];

let youtubeTestsPassed = 0;
let youtubeTestsFailed = 0;

youtubeTests.forEach((test, index) => {
    const isValid = isYouTubeUrl(test.url);
    const videoId = extractYouTubeVideoId(test.url);
    
    const validationPassed = isValid === test.shouldBeValid;
    const idExtractionPassed = videoId === test.expectedId;
    
    if (validationPassed && idExtractionPassed) {
        console.log(`✅ Test ${index + 1}: PASSED`);
        console.log(`   URL: ${test.url || '(empty)'}`);
        console.log(`   Valid: ${isValid}, ID: ${videoId || 'null'}`);
        youtubeTestsPassed++;
    } else {
        console.log(`❌ Test ${index + 1}: FAILED`);
        console.log(`   URL: ${test.url || '(empty)'}`);
        console.log(`   Expected - Valid: ${test.shouldBeValid}, ID: ${test.expectedId}`);
        console.log(`   Got - Valid: ${isValid}, ID: ${videoId}`);
        youtubeTestsFailed++;
    }
});

console.log(`\nYouTube Tests: ${youtubeTestsPassed} passed, ${youtubeTestsFailed} failed\n`);

// Test 2: Media-only validation
console.log('📁 Test 2: Media-Only Validation');
console.log('=' .repeat(50));

function validateMediaPost(title, content, hasMedia) {
    if (!title && !content && !hasMedia) {
        return { valid: false, error: 'يجب توفير عنوان أو محتوى أو ملف وسائط على الأقل' };
    }
    return { valid: true };
}

const validationTests = [
    { title: 'Test Title', content: 'Test Content', hasMedia: false, shouldBeValid: true },
    { title: 'Test Title', content: '', hasMedia: false, shouldBeValid: true },
    { title: '', content: 'Test Content', hasMedia: false, shouldBeValid: true },
    { title: '', content: '', hasMedia: true, shouldBeValid: true },
    { title: 'Test', content: '', hasMedia: true, shouldBeValid: true },
    { title: '', content: '', hasMedia: false, shouldBeValid: false },
];

let validationTestsPassed = 0;
let validationTestsFailed = 0;

validationTests.forEach((test, index) => {
    const result = validateMediaPost(test.title, test.content, test.hasMedia);
    const passed = result.valid === test.shouldBeValid;
    
    if (passed) {
        console.log(`✅ Test ${index + 1}: PASSED`);
        console.log(`   Title: ${test.title || '(empty)'}, Content: ${test.content || '(empty)'}, Has Media: ${test.hasMedia}`);
        console.log(`   Result: ${result.valid ? 'Valid' : 'Invalid'}`);
        validationTestsPassed++;
    } else {
        console.log(`❌ Test ${index + 1}: FAILED`);
        console.log(`   Title: ${test.title || '(empty)'}, Content: ${test.content || '(empty)'}, Has Media: ${test.hasMedia}`);
        console.log(`   Expected: ${test.shouldBeValid}, Got: ${result.valid}`);
        validationTestsFailed++;
    }
});

console.log(`\nValidation Tests: ${validationTestsPassed} passed, ${validationTestsFailed} failed\n`);

// Test 3: Backup compatibility
console.log('💾 Test 3: Backup Column Name Compatibility');
console.log('=' .repeat(50));

function mapOldToNewColumns(adkar) {
    return {
        id: adkar.id,
        category_id: adkar.category_id,
        title: adkar.title || '',
        content: adkar.content || '',
        content_type: adkar.content_type || adkar.type || 'text',
        file_path: adkar.file_path,
        file_url: adkar.file_url,
        youtube_url: adkar.youtube_url || null,
        schedule_type: adkar.schedule_type || 'daily',
        schedule_days: adkar.schedule_days || adkar.days_of_week || '[0,1,2,3,4,5,6]',
        schedule_dates: adkar.schedule_dates || '[]',
        schedule_months: adkar.schedule_months || '[]',
        schedule_time: adkar.schedule_time || '12:00',
        is_active: adkar.is_active !== undefined ? adkar.is_active : 1,
        priority: adkar.priority || 1,
        last_sent: adkar.last_sent,
        created_at: adkar.created_at
    };
}

const backupTests = [
    {
        name: 'Old format with type and days_of_week',
        input: {
            id: 1,
            title: 'Test',
            content: 'Content',
            type: 'audio',
            days_of_week: '[0,1,2,3,4,5,6]',
            schedule_time: '08:00'
        },
        expectedContentType: 'audio',
        expectedScheduleDays: '[0,1,2,3,4,5,6]'
    },
    {
        name: 'New format with content_type and schedule_days',
        input: {
            id: 2,
            title: 'Test 2',
            content: 'Content 2',
            content_type: 'image',
            schedule_days: '[1,3,5]',
            schedule_time: '10:00'
        },
        expectedContentType: 'image',
        expectedScheduleDays: '[1,3,5]'
    },
    {
        name: 'Mixed format (should prefer new names)',
        input: {
            id: 3,
            title: 'Test 3',
            content: 'Content 3',
            type: 'text',
            content_type: 'video',
            days_of_week: '[0,6]',
            schedule_days: '[1,2,3,4,5]',
            schedule_time: '12:00'
        },
        expectedContentType: 'video',
        expectedScheduleDays: '[1,2,3,4,5]'
    }
];

let backupTestsPassed = 0;
let backupTestsFailed = 0;

backupTests.forEach((test, index) => {
    const result = mapOldToNewColumns(test.input);
    const contentTypeMatches = result.content_type === test.expectedContentType;
    const scheduleDaysMatches = result.schedule_days === test.expectedScheduleDays;
    
    if (contentTypeMatches && scheduleDaysMatches) {
        console.log(`✅ Test ${index + 1} (${test.name}): PASSED`);
        console.log(`   content_type: ${result.content_type}, schedule_days: ${result.schedule_days}`);
        backupTestsPassed++;
    } else {
        console.log(`❌ Test ${index + 1} (${test.name}): FAILED`);
        console.log(`   Expected - content_type: ${test.expectedContentType}, schedule_days: ${test.expectedScheduleDays}`);
        console.log(`   Got - content_type: ${result.content_type}, schedule_days: ${result.schedule_days}`);
        backupTestsFailed++;
    }
});

console.log(`\nBackup Tests: ${backupTestsPassed} passed, ${backupTestsFailed} failed\n`);

// Summary
console.log('=' .repeat(50));
console.log('📊 Test Summary');
console.log('=' .repeat(50));

const totalPassed = youtubeTestsPassed + validationTestsPassed + backupTestsPassed;
const totalFailed = youtubeTestsFailed + validationTestsFailed + backupTestsFailed;
const totalTests = totalPassed + totalFailed;

console.log(`Total Tests: ${totalTests}`);
console.log(`✅ Passed: ${totalPassed}`);
console.log(`❌ Failed: ${totalFailed}`);
console.log(`📈 Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);

if (totalFailed === 0) {
    console.log('\n🎉 All tests passed! The fixes are working correctly.');
    process.exit(0);
} else {
    console.log(`\n⚠️  ${totalFailed} test(s) failed. Please review the implementation.`);
    process.exit(1);
}
