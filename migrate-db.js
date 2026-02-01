#!/usr/bin/env node

/**
 * Database Migration Script
 * 
 * This script migrates existing Azker databases to support the new features:
 * 1. Adds youtube_url column if it doesn't exist
 * 2. Makes title and content columns nullable (if possible)
 * 
 * Note: SQLite doesn't support modifying column constraints directly.
 * For title/content nullable change, the table would need to be recreated,
 * which is risky. Instead, the application code handles NULL values gracefully.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Determine data directory
const DATA_DIR = process.env.NODE_ENV === 'production' && fs.existsSync('/data') 
    ? '/data' 
    : path.join(__dirname, 'data');

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'adkar.db');

console.log('🔄 Starting database migration...');
console.log(`📁 Database path: ${DB_PATH}`);

if (!fs.existsSync(DB_PATH)) {
    console.log('ℹ️  Database does not exist yet. It will be created with the new schema on first run.');
    console.log('✅ No migration needed.');
    process.exit(0);
}

const db = new sqlite3.Database(DB_PATH);

// Check and add youtube_url column if it doesn't exist
db.all("PRAGMA table_info(adkar)", (err, columns) => {
    if (err) {
        console.error('❌ Error reading table info:', err.message);
        process.exit(1);
    }
    
    const hasYoutubeUrl = columns.some(col => col.name === 'youtube_url');
    
    if (!hasYoutubeUrl) {
        console.log('➕ Adding youtube_url column...');
        db.run("ALTER TABLE adkar ADD COLUMN youtube_url TEXT", (err) => {
            if (err) {
                console.error('❌ Error adding youtube_url column:', err.message);
                process.exit(1);
            }
            console.log('✅ Added youtube_url column successfully');
            checkNullability();
        });
    } else {
        console.log('✓ youtube_url column already exists');
        checkNullability();
    }
});

function checkNullability() {
    db.all("PRAGMA table_info(adkar)", (err, columns) => {
        if (err) {
            console.error('❌ Error reading table info:', err.message);
            process.exit(1);
        }
        
        const titleCol = columns.find(col => col.name === 'title');
        const contentCol = columns.find(col => col.name === 'content');
        
        console.log('\n📊 Current column constraints:');
        console.log(`   title: ${titleCol.notnull ? 'NOT NULL' : 'NULLABLE'}`);
        console.log(`   content: ${contentCol.notnull ? 'NOT NULL' : 'NULLABLE'}`);
        
        if (titleCol.notnull || contentCol.notnull) {
            console.log('\n⚠️  Note: title and/or content columns are NOT NULL');
            console.log('ℹ️  SQLite does not support modifying column constraints directly.');
            console.log('ℹ️  To make them nullable, the table would need to be recreated.');
            console.log('\n✅ The application code handles this gracefully:');
            console.log('   - Empty strings are stored instead of NULL for existing installations');
            console.log('   - New installations will have nullable columns');
            console.log('   - All functionality works correctly in both cases');
        } else {
            console.log('\n✅ Columns are already nullable');
        }
        
        finishMigration();
    });
}

function finishMigration() {
    db.close((err) => {
        if (err) {
            console.error('❌ Error closing database:', err.message);
            process.exit(1);
        }
        console.log('\n✅ Migration completed successfully!');
        console.log('ℹ️  The bot is ready to use with all new features.');
    });
}
