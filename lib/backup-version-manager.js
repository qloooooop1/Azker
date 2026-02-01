/**
 * Backup Version Manager
 * 
 * This module provides versioning support for backup files, enabling:
 * - Backward compatibility with old backup formats
 * - Automatic migration between versions
 * - Forward compatibility for future changes
 * - Detailed validation and logging
 */

const CURRENT_VERSION = '3.0.0';
const SUPPORTED_VERSIONS = ['1.0', '1.0.0', '2.0', '2.0.0', '3.0', '3.0.0'];

/**
 * Detect the version of a backup file
 * @param {Object} backupData - The parsed backup JSON object
 * @returns {string} - The detected version
 */
function detectBackupVersion(backupData) {
    if (!backupData) {
        return 'unknown';
    }
    
    // Check explicit version field
    if (backupData.version) {
        return backupData.version;
    }
    
    // Heuristic detection for unversioned backups
    if (backupData.data) {
        // Version 2.0+ has nested data structure
        return '2.0.0';
    } else if (backupData.groups || backupData.adkar || backupData.categories) {
        // Version 1.0 has flat structure
        return '1.0.0';
    }
    
    return 'unknown';
}

/**
 * Check if a version is supported
 * @param {string} version - Version to check
 * @returns {boolean} - Whether the version is supported
 */
function isVersionSupported(version) {
    return SUPPORTED_VERSIONS.includes(version);
}

/**
 * Migrate backup from v1.0 to v3.0
 * V1.0 format: { groups: [], adkar: [], categories: [] }
 * V3.0 format: { version: "3.0.0", timestamp: "...", data: { groups: [], adkar: [], categories: [] } }
 */
function migrateV1ToV3(backupData, logger = console) {
    logger.log('🔄 Migrating backup from v1.0 to v3.0...');
    
    const migrated = {
        version: '3.0.0',
        timestamp: backupData.timestamp || new Date().toISOString(),
        data: {
            categories: backupData.categories || [],
            adkar: backupData.adkar || [],
            groups: backupData.groups || []
        }
    };
    
    // Migrate field names for adkar
    if (migrated.data.adkar.length > 0) {
        migrated.data.adkar = migrated.data.adkar.map((adkar, index) => {
            const migrated_adkar = { ...adkar };
            
            // Migrate old field names
            if (adkar.type && !adkar.content_type) {
                migrated_adkar.content_type = adkar.type;
                delete migrated_adkar.type;
                logger.log(`  ✓ Migrated adkar #${index + 1}: type → content_type`);
            }
            
            if (adkar.days_of_week && !adkar.schedule_days) {
                migrated_adkar.schedule_days = adkar.days_of_week;
                delete migrated_adkar.days_of_week;
                logger.log(`  ✓ Migrated adkar #${index + 1}: days_of_week → schedule_days`);
            }
            
            // Ensure schedule fields have defaults
            migrated_adkar.schedule_days = migrated_adkar.schedule_days || '[0,1,2,3,4,5,6]';
            migrated_adkar.schedule_dates = migrated_adkar.schedule_dates || '[]';
            migrated_adkar.schedule_months = migrated_adkar.schedule_months || '[]';
            migrated_adkar.schedule_time = migrated_adkar.schedule_time || '12:00';
            migrated_adkar.schedule_type = migrated_adkar.schedule_type || 'daily';
            
            return migrated_adkar;
        });
    }
    
    logger.log(`✅ Migration complete: v1.0 → v3.0`);
    return migrated;
}

/**
 * Migrate backup from v2.0 to v3.0
 * V2.0 and V3.0 have similar structure, but v3.0 has better type normalization
 */
function migrateV2ToV3(backupData, logger = console) {
    logger.log('🔄 Migrating backup from v2.0 to v3.0...');
    
    const migrated = {
        version: '3.0.0',
        timestamp: backupData.timestamp || new Date().toISOString(),
        data: backupData.data || {
            categories: [],
            adkar: [],
            groups: []
        }
    };
    
    // Ensure field name compatibility for adkar
    if (migrated.data.adkar && migrated.data.adkar.length > 0) {
        migrated.data.adkar = migrated.data.adkar.map((adkar, index) => {
            const migrated_adkar = { ...adkar };
            
            // Migrate old field names if they exist
            if (adkar.type && !adkar.content_type) {
                migrated_adkar.content_type = adkar.type;
                delete migrated_adkar.type;
                logger.log(`  ✓ Migrated adkar #${index + 1}: type → content_type`);
            }
            
            if (adkar.days_of_week && !adkar.schedule_days) {
                migrated_adkar.schedule_days = adkar.days_of_week;
                delete migrated_adkar.days_of_week;
                logger.log(`  ✓ Migrated adkar #${index + 1}: days_of_week → schedule_days`);
            }
            
            return migrated_adkar;
        });
    }
    
    logger.log(`✅ Migration complete: v2.0 → v3.0`);
    return migrated;
}

/**
 * Migrate backup to the current version
 * @param {Object} backupData - The backup data to migrate
 * @param {Object} logger - Logger object (optional)
 * @returns {Object} - Migrated backup data
 */
function migrateToCurrentVersion(backupData, logger = console) {
    const version = detectBackupVersion(backupData);
    
    logger.log(`📦 Detected backup version: ${version}`);
    
    if (!isVersionSupported(version)) {
        throw new Error(`Unsupported backup version: ${version}. Supported versions: ${SUPPORTED_VERSIONS.join(', ')}`);
    }
    
    if (version === CURRENT_VERSION) {
        logger.log('✅ Backup is already at current version');
        return backupData;
    }
    
    // Migration chain
    let migrated = backupData;
    
    if (version.startsWith('1.')) {
        migrated = migrateV1ToV3(migrated, logger);
    } else if (version.startsWith('2.')) {
        migrated = migrateV2ToV3(migrated, logger);
    }
    
    return migrated;
}

/**
 * Get version information
 * @returns {Object} - Version metadata
 */
function getVersionInfo() {
    return {
        current: CURRENT_VERSION,
        supported: SUPPORTED_VERSIONS,
        description: 'Backup version management for Azker bot'
    };
}

module.exports = {
    CURRENT_VERSION,
    SUPPORTED_VERSIONS,
    detectBackupVersion,
    isVersionSupported,
    migrateToCurrentVersion,
    getVersionInfo
};
