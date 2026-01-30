#!/usr/bin/env node

/**
 * Validation script for persistent storage setup
 * This script verifies that the persistent storage is configured correctly
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Persistent Storage Configuration...\n');

let hasErrors = false;

// Check 1: Environment
console.log('1️⃣  Checking environment...');
const nodeEnv = process.env.NODE_ENV || 'development';
console.log(`   NODE_ENV: ${nodeEnv}`);

// Check 2: Data directory
console.log('\n2️⃣  Checking data directory configuration...');
const expectedDataDir = nodeEnv === 'production' && fs.existsSync('/data') 
    ? '/data' 
    : path.join(__dirname, 'data');
console.log(`   Expected DATA_DIR: ${expectedDataDir}`);
console.log(`   Directory exists: ${fs.existsSync(expectedDataDir) ? '✅' : '❌'}`);

if (!fs.existsSync(expectedDataDir)) {
    console.log('   ⚠️  Creating data directory...');
    try {
        fs.mkdirSync(expectedDataDir, { recursive: true });
        console.log('   ✅ Data directory created');
    } catch (err) {
        console.log(`   ❌ Failed to create directory: ${err.message}`);
        hasErrors = true;
    }
}

// Check 3: Database path
console.log('\n3️⃣  Checking database configuration...');
const dbPath = process.env.DB_PATH || path.join(expectedDataDir, 'adkar.db');
console.log(`   Database path: ${dbPath}`);
console.log(`   Database exists: ${fs.existsSync(dbPath) ? '✅' : '⚠️  (will be created on first run)'}`);

// Check 4: Uploads directory
console.log('\n4️⃣  Checking uploads directory...');
const uploadsDir = process.env.UPLOAD_PATH || path.join(expectedDataDir, 'uploads');
console.log(`   Uploads path: ${uploadsDir}`);
console.log(`   Directory exists: ${fs.existsSync(uploadsDir) ? '✅' : '⚠️  (will be created on first run)'}`);

if (!fs.existsSync(uploadsDir)) {
    console.log('   ⚠️  Creating uploads directory...');
    try {
        fs.mkdirSync(uploadsDir, { recursive: true });
        ['audio', 'images', 'pdfs', 'temp'].forEach(dir => {
            fs.mkdirSync(path.join(uploadsDir, dir), { recursive: true });
        });
        console.log('   ✅ Uploads directory structure created');
    } catch (err) {
        console.log(`   ❌ Failed to create uploads directory: ${err.message}`);
        hasErrors = true;
    }
}

// Check 5: Write permissions
console.log('\n5️⃣  Checking write permissions...');
const testFile = path.join(expectedDataDir, '.write-test');
try {
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log('   ✅ Write permissions OK');
} catch (err) {
    console.log(`   ❌ No write permissions: ${err.message}`);
    hasErrors = true;
}

// Check 6: Disk space (on Linux/Unix)
console.log('\n6️⃣  Checking disk space...');
if (process.platform !== 'win32') {
    const { execSync } = require('child_process');
    try {
        const df = execSync(`df -h ${expectedDataDir}`).toString();
        console.log('   Disk usage:');
        console.log(df.split('\n').map(line => '   ' + line).join('\n'));
    } catch (err) {
        console.log('   ⚠️  Could not check disk space');
    }
} else {
    console.log('   ⚠️  Disk space check not available on Windows');
}

// Summary
console.log('\n' + '='.repeat(60));
if (hasErrors) {
    console.log('❌ Validation FAILED - Please fix the errors above');
    process.exit(1);
} else {
    console.log('✅ Validation PASSED - Persistent storage is configured correctly!');
    console.log('\n📁 Storage locations:');
    console.log(`   Database: ${dbPath}`);
    console.log(`   Uploads:  ${uploadsDir}`);
    console.log('\n💡 Data will persist across restarts and redeployments');
    process.exit(0);
}
