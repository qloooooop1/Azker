/**
 * Backup Metadata Manager
 * 
 * Handles backup metadata including creation date, version, checksums,
 * and statistics for better identification and extensibility.
 */

const crypto = require('crypto');
const { version: appVersion } = require('../package.json');

/**
 * Generate a checksum for backup data
 * @param {Object} data - The backup data object
 * @returns {string} - SHA256 checksum
 */
function generateChecksum(data) {
    const content = JSON.stringify(data, null, 0); // Compact JSON
    return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Verify backup data checksum
 * @param {Object} backupData - The complete backup object with metadata
 * @returns {boolean} - Whether checksum is valid
 */
function verifyChecksum(backupData) {
    if (!backupData.metadata || !backupData.metadata.checksum) {
        return false; // No checksum to verify
    }
    
    const storedChecksum = backupData.metadata.checksum;
    const { metadata, ...dataOnly } = backupData;
    const calculatedChecksum = generateChecksum(dataOnly);
    
    return storedChecksum === calculatedChecksum;
}

/**
 * Calculate backup statistics
 * @param {Object} data - The backup data object
 * @returns {Object} - Statistics object
 */
function calculateStatistics(data) {
    const stats = {
        groups: 0,
        adkar: 0,
        categories: 0,
        totalSize: 0
    };
    
    if (data.groups && Array.isArray(data.groups)) {
        stats.groups = data.groups.length;
    }
    if (data.adkar && Array.isArray(data.adkar)) {
        stats.adkar = data.adkar.length;
    }
    if (data.categories && Array.isArray(data.categories)) {
        stats.categories = data.categories.length;
    }
    
    // Calculate approximate size in bytes
    stats.totalSize = JSON.stringify(data).length;
    stats.formattedSize = formatBytes(stats.totalSize);
    
    return stats;
}

/**
 * Format bytes to human-readable format
 * @param {number} bytes - Number of bytes
 * @returns {string} - Formatted string (e.g., "1.5 MB")
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Create comprehensive metadata for a backup
 * @param {Object} data - The backup data object
 * @param {string} description - Optional user description
 * @returns {Object} - Metadata object
 */
function createMetadata(data, description = '') {
    const stats = calculateStatistics(data);
    
    const metadata = {
        createdAt: new Date().toISOString(),
        appVersion: appVersion,
        backupVersion: '3.0.0',
        description: description,
        statistics: stats,
        system: {
            nodeVersion: process.version,
            platform: process.platform
        }
    };
    
    return metadata;
}

/**
 * Create a complete backup object with metadata
 * @param {Object} data - The backup data object
 * @param {string} description - Optional user description
 * @returns {Object} - Complete backup with metadata
 */
function createBackupWithMetadata(data, description = '') {
    const backupData = {
        version: '3.0.0',
        timestamp: new Date().toISOString(),
        data: data
    };
    
    const metadata = createMetadata(data, description);
    
    // Generate checksum of data (excluding metadata)
    metadata.checksum = generateChecksum(backupData);
    
    // Add metadata to backup
    backupData.metadata = metadata;
    
    return backupData;
}

/**
 * Extract metadata from backup for display
 * @param {Object} backupData - The complete backup object
 * @returns {Object} - Extracted and formatted metadata
 */
function extractMetadata(backupData) {
    if (!backupData) {
        return null;
    }
    
    const metadata = {
        version: backupData.version || 'unknown',
        timestamp: backupData.timestamp || 'unknown',
        createdAt: null,
        appVersion: null,
        description: '',
        statistics: {
            groups: 0,
            adkar: 0,
            categories: 0,
            totalSize: 0,
            formattedSize: '0 Bytes'
        },
        hasChecksum: false,
        checksumValid: null
    };
    
    // Extract from metadata field if exists
    if (backupData.metadata) {
        metadata.createdAt = backupData.metadata.createdAt || backupData.timestamp;
        metadata.appVersion = backupData.metadata.appVersion;
        metadata.description = backupData.metadata.description || '';
        metadata.hasChecksum = !!backupData.metadata.checksum;
        
        if (metadata.hasChecksum) {
            metadata.checksumValid = verifyChecksum(backupData);
        }
        
        if (backupData.metadata.statistics) {
            metadata.statistics = backupData.metadata.statistics;
        }
    }
    
    // Calculate statistics from data if not in metadata
    if (backupData.data && metadata.statistics.groups === 0 && metadata.statistics.adkar === 0) {
        const stats = calculateStatistics(backupData.data);
        metadata.statistics = stats;
    }
    
    // Format timestamp
    if (metadata.createdAt) {
        const date = new Date(metadata.createdAt);
        metadata.formattedDate = date.toLocaleString('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    return metadata;
}

/**
 * Validate metadata structure
 * @param {Object} metadata - Metadata object to validate
 * @returns {Object} - Validation result { valid: boolean, errors: [] }
 */
function validateMetadata(metadata) {
    const errors = [];
    
    if (!metadata) {
        errors.push('Metadata is missing');
        return { valid: false, errors };
    }
    
    // Check required fields
    if (!metadata.createdAt) {
        errors.push('Missing createdAt in metadata');
    }
    
    if (!metadata.backupVersion && !metadata.version) {
        errors.push('Missing version in metadata');
    }
    
    // Validate statistics if present
    if (metadata.statistics) {
        if (typeof metadata.statistics.groups !== 'number') {
            errors.push('Invalid statistics.groups - must be a number');
        }
        if (typeof metadata.statistics.adkar !== 'number') {
            errors.push('Invalid statistics.adkar - must be a number');
        }
        if (typeof metadata.statistics.categories !== 'number') {
            errors.push('Invalid statistics.categories - must be a number');
        }
    }
    
    return {
        valid: errors.length === 0,
        errors: errors
    };
}

module.exports = {
    generateChecksum,
    verifyChecksum,
    calculateStatistics,
    formatBytes,
    createMetadata,
    createBackupWithMetadata,
    extractMetadata,
    validateMetadata
};
