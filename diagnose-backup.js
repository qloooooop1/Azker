#!/usr/bin/env node

/**
 * Backup Diagnostic CLI Tool
 * 
 * Usage: node diagnose-backup.js <backup-file.json> [--repair] [--output repaired.json]
 * 
 * This tool helps diagnose and optionally repair problematic backup files.
 */

const fs = require('fs');
const path = require('path');
const backupDiagnostic = require('./lib/backup-diagnostic');

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
📋 Backup Diagnostic Tool
${'='.repeat(60)}

Usage:
  node diagnose-backup.js <backup-file.json> [options]

Options:
  --repair              Attempt to repair the backup file automatically
  --output <file>       Save repaired backup to specified file
  --verbose             Show detailed diagnostic information
  --help, -h            Show this help message

Examples:
  # Diagnose a backup file
  node diagnose-backup.js my-backup.json

  # Diagnose and repair
  node diagnose-backup.js my-backup.json --repair --output repaired.json

  # Verbose mode
  node diagnose-backup.js my-backup.json --verbose

${'='.repeat(60)}
    `);
    process.exit(0);
}

const backupFile = args[0];
const shouldRepair = args.includes('--repair');
const verbose = args.includes('--verbose');
const outputIndex = args.indexOf('--output');
const outputFile = outputIndex !== -1 ? args[outputIndex + 1] : null;

// Validate input file
if (!backupFile) {
    console.error('❌ Error: No backup file specified');
    console.log('Usage: node diagnose-backup.js <backup-file.json>');
    process.exit(1);
}

const backupPath = path.resolve(backupFile);

if (!fs.existsSync(backupPath)) {
    console.error(`❌ Error: File not found: ${backupPath}`);
    process.exit(1);
}

console.log('🔍 Backup Diagnostic Tool');
console.log('='.repeat(60));
console.log(`📁 File: ${backupPath}`);
console.log('='.repeat(60));

// Load backup file
let backupData;
try {
    const fileContent = fs.readFileSync(backupPath, 'utf8');
    backupData = JSON.parse(fileContent);
    console.log('✅ Backup file loaded successfully');
    
    const sizeKB = Buffer.byteLength(fileContent, 'utf8') / 1024;
    console.log(`📊 File size: ${sizeKB.toFixed(2)} KB`);
} catch (error) {
    console.error('❌ Error loading backup file:', error.message);
    
    if (error instanceof SyntaxError) {
        console.error('\n💡 Suggestion: The file contains invalid JSON.');
        console.error('   Please check that the file is not corrupted or truncated.');
        console.error('   You can use an online JSON validator to identify the specific issue.');
    }
    
    process.exit(1);
}

// Run diagnostics
console.log('\n🔬 Running diagnostic checks...\n');
const diagnostic = backupDiagnostic.diagnoseBackup(backupData, { verbose });
diagnostic.printReport();

const report = diagnostic.getReport();

// Repair if requested
if (shouldRepair) {
    console.log('\n🔧 Attempting to repair backup...\n');
    
    const repairResult = backupDiagnostic.repairBackup(backupData);
    
    if (repairResult.success) {
        console.log('✅ Repair completed successfully');
        console.log('\n📝 Repair log:');
        repairResult.repairLog.forEach((log, index) => {
            console.log(`  ${index + 1}. ${log}`);
        });
        
        // Save repaired backup if output file specified
        if (outputFile) {
            const outputPath = path.resolve(outputFile);
            try {
                fs.writeFileSync(
                    outputPath,
                    JSON.stringify(repairResult.repairedData, null, 2),
                    'utf8'
                );
                console.log(`\n💾 Repaired backup saved to: ${outputPath}`);
                
                // Run diagnostics on repaired backup
                console.log('\n🔬 Running diagnostics on repaired backup...\n');
                const repairedDiagnostic = backupDiagnostic.diagnoseBackup(repairResult.repairedData);
                repairedDiagnostic.printReport();
                
                const repairedReport = repairedDiagnostic.getReport();
                if (repairedReport.isHealthy) {
                    console.log('🎉 Repaired backup is healthy and ready to use!');
                } else {
                    console.log('⚠️  Repaired backup still has some issues. Manual intervention may be required.');
                }
            } catch (error) {
                console.error(`❌ Error saving repaired backup: ${error.message}`);
                process.exit(1);
            }
        } else {
            console.log('\n💡 To save the repaired backup, use --output <filename>');
            console.log('   Example: node diagnose-backup.js my-backup.json --repair --output repaired.json');
        }
    } else {
        console.error('❌ Repair failed');
        console.error('\n📝 Repair log:');
        repairResult.repairLog.forEach((log, index) => {
            console.error(`  ${index + 1}. ${log}`);
        });
        process.exit(1);
    }
}

// Exit with appropriate code
if (report.isHealthy) {
    console.log('\n🎉 Backup file is healthy!');
    process.exit(0);
} else if (report.fixable) {
    console.log('\n💡 Backup has issues but they appear fixable.');
    console.log('   Run with --repair flag to attempt automatic repair:');
    console.log(`   node diagnose-backup.js ${backupFile} --repair --output repaired.json`);
    process.exit(1);
} else {
    console.log('\n🚨 Backup has critical issues that cannot be automatically repaired.');
    console.log('   Manual intervention is required.');
    process.exit(1);
}
