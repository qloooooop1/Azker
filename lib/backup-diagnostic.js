/**
 * Backup Diagnostic Tool
 * 
 * This module provides tools to diagnose and repair problematic backup files.
 * It can identify common issues and suggest or apply fixes automatically.
 */

const backupValidator = require('./backup-validator');
const backupVersionManager = require('./backup-version-manager');

/**
 * Diagnostic levels
 */
const SEVERITY = {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
};

/**
 * Diagnostic result class
 */
class DiagnosticResult {
    constructor() {
        this.issues = [];
        this.fixable = true;
        this.autoFixApplied = false;
    }
    
    addIssue(severity, message, field = null, suggestion = null, autoFix = null) {
        this.issues.push({
            severity,
            message,
            field,
            suggestion,
            autoFix,
            timestamp: new Date().toISOString()
        });
        
        if (severity === SEVERITY.CRITICAL) {
            this.fixable = false;
        }
    }
    
    getReport() {
        const critical = this.issues.filter(i => i.severity === SEVERITY.CRITICAL);
        const errors = this.issues.filter(i => i.severity === SEVERITY.ERROR);
        const warnings = this.issues.filter(i => i.severity === SEVERITY.WARNING);
        const info = this.issues.filter(i => i.severity === SEVERITY.INFO);
        
        return {
            isHealthy: critical.length === 0 && errors.length === 0,
            fixable: this.fixable,
            autoFixApplied: this.autoFixApplied,
            summary: {
                critical: critical.length,
                errors: errors.length,
                warnings: warnings.length,
                info: info.length,
                total: this.issues.length
            },
            issues: this.issues
        };
    }
    
    printReport() {
        console.log('\n' + '='.repeat(60));
        console.log('🔍 Backup Diagnostic Report');
        console.log('='.repeat(60));
        
        const critical = this.issues.filter(i => i.severity === SEVERITY.CRITICAL);
        const errors = this.issues.filter(i => i.severity === SEVERITY.ERROR);
        const warnings = this.issues.filter(i => i.severity === SEVERITY.WARNING);
        const info = this.issues.filter(i => i.severity === SEVERITY.INFO);
        
        if (critical.length > 0) {
            console.log('\n🚨 Critical Issues:');
            critical.forEach(issue => {
                console.log(`  🚨 ${issue.message}`);
                if (issue.field) console.log(`     Field: ${issue.field}`);
                if (issue.suggestion) console.log(`     💡 ${issue.suggestion}`);
            });
        }
        
        if (errors.length > 0) {
            console.log('\n❌ Errors:');
            errors.forEach(issue => {
                console.log(`  ❌ ${issue.message}`);
                if (issue.field) console.log(`     Field: ${issue.field}`);
                if (issue.suggestion) console.log(`     💡 ${issue.suggestion}`);
            });
        }
        
        if (warnings.length > 0) {
            console.log('\n⚠️  Warnings:');
            warnings.forEach(issue => {
                console.log(`  ⚠️  ${issue.message}`);
                if (issue.field) console.log(`     Field: ${issue.field}`);
                if (issue.suggestion) console.log(`     💡 ${issue.suggestion}`);
            });
        }
        
        if (info.length > 0) {
            console.log('\nℹ️  Information:');
            info.forEach(issue => {
                console.log(`  ℹ️  ${issue.message}`);
            });
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('Summary:');
        console.log(`  🚨 Critical: ${critical.length}`);
        console.log(`  ❌ Errors: ${errors.length}`);
        console.log(`  ⚠️  Warnings: ${warnings.length}`);
        console.log(`  ℹ️  Info: ${info.length}`);
        console.log(`  ✅ Healthy: ${critical.length === 0 && errors.length === 0}`);
        console.log(`  🔧 Fixable: ${this.fixable}`);
        console.log('='.repeat(60) + '\n');
    }
}

/**
 * Diagnose a backup file comprehensively
 * @param {Object} backupData - The backup data to diagnose
 * @param {Object} options - Diagnostic options
 * @returns {DiagnosticResult} - Diagnostic result
 */
function diagnoseBackup(backupData, options = {}) {
    const result = new DiagnosticResult();
    const applyAutoFix = options.autoFix === true;
    
    // Check 1: Null or undefined backup
    if (!backupData) {
        result.addIssue(
            SEVERITY.CRITICAL,
            'Backup data is null or undefined',
            null,
            'Ensure the file was loaded correctly and is not empty'
        );
        return result;
    }
    
    // Check 2: Detect version
    const version = backupVersionManager.detectBackupVersion(backupData);
    result.addIssue(
        SEVERITY.INFO,
        `Detected backup version: ${version}`,
        'version'
    );
    
    if (version === 'unknown') {
        result.addIssue(
            SEVERITY.ERROR,
            'Unable to detect backup version',
            'version',
            'Backup may have an unknown or corrupted structure'
        );
    } else if (!backupVersionManager.isVersionSupported(version)) {
        result.addIssue(
            SEVERITY.CRITICAL,
            `Unsupported backup version: ${version}`,
            'version',
            `Supported versions: ${backupVersionManager.SUPPORTED_VERSIONS.join(', ')}`
        );
    } else if (version !== backupVersionManager.CURRENT_VERSION) {
        result.addIssue(
            SEVERITY.WARNING,
            `Backup is from older version (${version}). Migration will be required.`,
            'version',
            'The system will automatically migrate this backup to the current version'
        );
    }
    
    // Check 3: Data structure
    if (!backupData.data && !backupData.groups && !backupData.adkar && !backupData.categories) {
        result.addIssue(
            SEVERITY.CRITICAL,
            'Backup has no recognizable data structure',
            'data',
            'Backup must contain either a "data" field or top-level groups/adkar/categories fields'
        );
        return result;
    }
    
    // Normalize to v3.0 structure for diagnosis
    let normalizedData = backupData;
    if (backupData.data) {
        normalizedData = backupData;
    } else {
        // V1.0 format - wrap in data object
        normalizedData = {
            version: '1.0.0',
            data: {
                groups: backupData.groups || [],
                adkar: backupData.adkar || [],
                categories: backupData.categories || []
            }
        };
    }
    
    // Check 4: Data presence
    const hasCategories = normalizedData.data.categories && normalizedData.data.categories.length > 0;
    const hasAdkar = normalizedData.data.adkar && normalizedData.data.adkar.length > 0;
    const hasGroups = normalizedData.data.groups && normalizedData.data.groups.length > 0;
    
    if (!hasCategories && !hasAdkar && !hasGroups) {
        result.addIssue(
            SEVERITY.WARNING,
            'Backup contains no data (empty categories, adkar, and groups)',
            'data',
            'This backup will restore an empty database'
        );
    } else {
        result.addIssue(
            SEVERITY.INFO,
            `Backup contains ${normalizedData.data.categories?.length || 0} categories, ${normalizedData.data.adkar?.length || 0} adkar, ${normalizedData.data.groups?.length || 0} groups`
        );
    }
    
    // Check 5: Validate each category
    if (hasCategories) {
        if (!Array.isArray(normalizedData.data.categories)) {
            result.addIssue(
                SEVERITY.ERROR,
                'Categories field is not an array',
                'categories',
                'Ensure categories is an array of category objects'
            );
        } else {
            normalizedData.data.categories.forEach((category, index) => {
                const logger = new backupValidator.ValidationLogger();
                backupValidator.validateCategoryItem(category, index, logger);
                
                logger.errors.forEach(err => {
                    result.addIssue(SEVERITY.ERROR, err.message, err.field, err.suggestion);
                });
            });
        }
    }
    
    // Check 6: Validate each adkar
    if (hasAdkar) {
        if (!Array.isArray(normalizedData.data.adkar)) {
            result.addIssue(
                SEVERITY.ERROR,
                'Adkar field is not an array',
                'adkar',
                'Ensure adkar is an array of adkar objects'
            );
        } else {
            normalizedData.data.adkar.forEach((adkar, index) => {
                const logger = new backupValidator.ValidationLogger();
                backupValidator.validateAdkarItem(adkar, index, logger);
                
                logger.errors.forEach(err => {
                    result.addIssue(SEVERITY.ERROR, err.message, err.field, err.suggestion);
                });
            });
        }
    }
    
    // Check 7: Validate each group
    if (hasGroups) {
        if (!Array.isArray(normalizedData.data.groups)) {
            result.addIssue(
                SEVERITY.ERROR,
                'Groups field is not an array',
                'groups',
                'Ensure groups is an array of group objects'
            );
        } else {
            normalizedData.data.groups.forEach((group, index) => {
                const logger = new backupValidator.ValidationLogger();
                backupValidator.validateGroupItem(group, index, logger);
                
                logger.errors.forEach(err => {
                    result.addIssue(SEVERITY.ERROR, err.message, err.field, err.suggestion);
                });
            });
        }
    }
    
    // Check 8: File size estimation
    const jsonStr = JSON.stringify(normalizedData);
    const sizeBytes = Buffer.byteLength(jsonStr, 'utf8');
    const sizeMB = sizeBytes / (1024 * 1024);
    
    result.addIssue(
        SEVERITY.INFO,
        `Backup file size: ${sizeMB.toFixed(2)} MB`,
        'file_size'
    );
    
    if (sizeMB > 10) {
        result.addIssue(
            SEVERITY.ERROR,
            `Backup file is too large (${sizeMB.toFixed(2)} MB). Maximum allowed is 10 MB.`,
            'file_size',
            'Consider reducing the amount of data or splitting into multiple backups'
        );
    } else if (sizeMB > 5) {
        result.addIssue(
            SEVERITY.WARNING,
            `Backup file is quite large (${sizeMB.toFixed(2)} MB). Upload may be slow.`,
            'file_size'
        );
    }
    
    return result;
}

/**
 * Attempt to repair a backup file automatically
 * @param {Object} backupData - The backup data to repair
 * @returns {Object} - Repaired backup data and repair report
 */
function repairBackup(backupData) {
    const repairLog = [];
    
    if (!backupData) {
        return {
            success: false,
            repairedData: null,
            repairLog: ['Cannot repair null or undefined backup']
        };
    }
    
    let repaired = JSON.parse(JSON.stringify(backupData)); // Deep clone
    
    // Repair 1: Add missing version
    if (!repaired.version) {
        const detectedVersion = backupVersionManager.detectBackupVersion(repaired);
        repaired.version = detectedVersion;
        repairLog.push(`Added missing version field: ${detectedVersion}`);
    }
    
    // Repair 2: Add missing timestamp
    if (!repaired.timestamp) {
        repaired.timestamp = new Date().toISOString();
        repairLog.push('Added missing timestamp');
    }
    
    // Repair 3: Migrate to current version
    try {
        const migrated = backupVersionManager.migrateToCurrentVersion(repaired, {
            log: (msg) => repairLog.push(msg)
        });
        repaired = migrated;
    } catch (error) {
        repairLog.push(`Migration failed: ${error.message}`);
        return {
            success: false,
            repairedData: repaired,
            repairLog
        };
    }
    
    // Repair 4: Fix array formats
    if (repaired.data && repaired.data.adkar) {
        repaired.data.adkar = repaired.data.adkar.map((adkar, index) => {
            const fixed = { ...adkar };
            
            // Fix schedule_days
            if (fixed.schedule_days && Array.isArray(fixed.schedule_days)) {
                fixed.schedule_days = JSON.stringify(fixed.schedule_days);
                repairLog.push(`Adkar #${index + 1}: Converted schedule_days array to JSON string`);
            }
            
            // Fix schedule_dates
            if (fixed.schedule_dates && Array.isArray(fixed.schedule_dates)) {
                fixed.schedule_dates = JSON.stringify(fixed.schedule_dates);
                repairLog.push(`Adkar #${index + 1}: Converted schedule_dates array to JSON string`);
            }
            
            // Fix schedule_months
            if (fixed.schedule_months && Array.isArray(fixed.schedule_months)) {
                fixed.schedule_months = JSON.stringify(fixed.schedule_months);
                repairLog.push(`Adkar #${index + 1}: Converted schedule_months array to JSON string`);
            }
            
            // Add defaults for missing required fields
            if (!fixed.schedule_time) {
                fixed.schedule_time = '12:00';
                repairLog.push(`Adkar #${index + 1}: Added default schedule_time`);
            }
            
            if (!fixed.schedule_days) {
                fixed.schedule_days = '[0,1,2,3,4,5,6]';
                repairLog.push(`Adkar #${index + 1}: Added default schedule_days`);
            }
            
            return fixed;
        });
    }
    
    // Repair 5: Fix group settings
    if (repaired.data && repaired.data.groups) {
        repaired.data.groups = repaired.data.groups.map((group, index) => {
            const fixed = { ...group };
            
            // Convert settings object to JSON string
            if (fixed.settings && typeof fixed.settings === 'object') {
                fixed.settings = JSON.stringify(fixed.settings);
                repairLog.push(`Group #${index + 1}: Converted settings object to JSON string`);
            }
            
            return fixed;
        });
    }
    
    return {
        success: true,
        repairedData: repaired,
        repairLog
    };
}

module.exports = {
    SEVERITY,
    DiagnosticResult,
    diagnoseBackup,
    repairBackup
};
