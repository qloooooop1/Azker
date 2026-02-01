/**
 * Backup Validator with Enhanced Logging
 * 
 * Provides comprehensive validation for backup files with detailed
 * field-by-field error reporting and actionable suggestions.
 */

/**
 * Enhanced validation logger
 */
class ValidationLogger {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
    }
    
    error(message, field = null, suggestion = null) {
        this.errors.push({
            level: 'error',
            message,
            field,
            suggestion,
            timestamp: new Date().toISOString()
        });
    }
    
    warn(message, field = null) {
        this.warnings.push({
            level: 'warning',
            message,
            field,
            timestamp: new Date().toISOString()
        });
    }
    
    log(message) {
        this.info.push({
            level: 'info',
            message,
            timestamp: new Date().toISOString()
        });
    }
    
    getReport() {
        return {
            valid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings,
            info: this.info,
            summary: {
                totalErrors: this.errors.length,
                totalWarnings: this.warnings.length,
                totalInfo: this.info.length
            }
        };
    }
    
    printReport() {
        console.log('\n📊 Validation Report');
        console.log('='.repeat(60));
        
        if (this.info.length > 0) {
            console.log('\n📌 Information:');
            this.info.forEach(item => console.log(`  ℹ️  ${item.message}`));
        }
        
        if (this.warnings.length > 0) {
            console.log('\n⚠️  Warnings:');
            this.warnings.forEach(item => {
                console.log(`  ⚠️  ${item.message}`);
                if (item.field) console.log(`     Field: ${item.field}`);
            });
        }
        
        if (this.errors.length > 0) {
            console.log('\n❌ Errors:');
            this.errors.forEach(item => {
                console.log(`  ❌ ${item.message}`);
                if (item.field) console.log(`     Field: ${item.field}`);
                if (item.suggestion) console.log(`     💡 ${item.suggestion}`);
            });
        }
        
        console.log('\n' + '='.repeat(60));
        console.log(`✅ Valid: ${this.errors.length === 0}`);
        console.log(`❌ Errors: ${this.errors.length}`);
        console.log(`⚠️  Warnings: ${this.warnings.length}`);
        console.log('='.repeat(60) + '\n');
    }
}

/**
 * Validate JSON string
 */
function isValidJSON(str) {
    if (typeof str === 'object' && str !== null) {
        return { valid: true };
    }
    
    try {
        JSON.parse(str);
        return { valid: true };
    } catch (error) {
        return { 
            valid: false, 
            error: 'Invalid JSON',
            details: error.message 
        };
    }
}

/**
 * Validate JSON array
 */
function isValidJSONArray(str, fieldName) {
    if (!str) return { valid: true, value: [] };
    
    if (Array.isArray(str)) {
        return { valid: true, value: str };
    }
    
    try {
        const parsed = JSON.parse(str);
        if (!Array.isArray(parsed)) {
            return {
                valid: false,
                error: `Field "${fieldName}" must be a JSON array`,
                details: `Current value: ${str}`
            };
        }
        return { valid: true, value: parsed };
    } catch (error) {
        return {
            valid: false,
            error: `Field "${fieldName}" contains invalid JSON`,
            details: error.message
        };
    }
}

/**
 * Validate a single adkar item with detailed logging
 */
function validateAdkarItem(adkar, index, logger) {
    const itemNum = index + 1;
    
    // Validate category_id
    if (!adkar.category_id && adkar.category_id !== 0) {
        logger.error(
            `Adkar #${itemNum} is missing category_id`,
            'category_id',
            'Add a valid category_id field (integer)'
        );
    }
    
    // Validate content_type
    const contentType = adkar.content_type || adkar.type || 'text';
    const validContentTypes = ['text', 'audio', 'image', 'video', 'pdf'];
    if (!validContentTypes.includes(contentType)) {
        logger.error(
            `Adkar #${itemNum} has invalid content_type: "${contentType}"`,
            'content_type',
            `Use one of: ${validContentTypes.join(', ')}`
        );
    }
    
    // Validate schedule_days
    const scheduleDays = adkar.schedule_days || adkar.days_of_week || '[0,1,2,3,4,5,6]';
    const daysValidation = isValidJSONArray(scheduleDays, 'schedule_days');
    if (!daysValidation.valid) {
        logger.error(
            `Adkar #${itemNum}: ${daysValidation.error}`,
            'schedule_days',
            `Use JSON array format like "[0,1,2,3,4,5,6]" or a JavaScript array [0,1,2,3,4,5,6]`
        );
    }
    
    // Validate schedule_dates
    const scheduleDates = adkar.schedule_dates || '[]';
    const datesValidation = isValidJSONArray(scheduleDates, 'schedule_dates');
    if (!datesValidation.valid) {
        logger.error(
            `Adkar #${itemNum}: ${datesValidation.error}`,
            'schedule_dates',
            'Use JSON array format like "[]" or a JavaScript array []'
        );
    }
    
    // Validate schedule_months
    const scheduleMonths = adkar.schedule_months || '[]';
    const monthsValidation = isValidJSONArray(scheduleMonths, 'schedule_months');
    if (!monthsValidation.valid) {
        logger.error(
            `Adkar #${itemNum}: ${monthsValidation.error}`,
            'schedule_months',
            'Use JSON array format like "[]" or a JavaScript array []'
        );
    }
    
    // Validate schedule_time
    const scheduleTime = adkar.schedule_time || '12:00';
    const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timePattern.test(scheduleTime)) {
        logger.error(
            `Adkar #${itemNum} has invalid schedule_time: "${scheduleTime}"`,
            'schedule_time',
            'Use HH:MM format (e.g., "08:30", "14:00")'
        );
    }
}

/**
 * Validate a single group item with detailed logging
 */
function validateGroupItem(group, index, logger) {
    const itemNum = index + 1;
    
    // Validate chat_id
    if (!group.chat_id && group.chat_id !== 0) {
        logger.error(
            `Group #${itemNum} is missing chat_id`,
            'chat_id',
            'Add a valid chat_id field (integer, can be negative for supergroups)'
        );
    }
    
    // Validate title
    if (!group.title) {
        logger.error(
            `Group #${itemNum} is missing title`,
            'title',
            'Add a title field with the group name'
        );
    }
    
    // Validate settings if present
    if (group.settings && typeof group.settings === 'string') {
        const settingsValidation = isValidJSON(group.settings);
        if (!settingsValidation.valid) {
            logger.error(
                `Group #${itemNum} has invalid settings JSON`,
                'settings',
                'Ensure settings is a valid JSON string or object'
            );
        }
    }
}

/**
 * Validate a single category item with detailed logging
 */
function validateCategoryItem(category, index, logger) {
    const itemNum = index + 1;
    
    // Validate name
    if (!category.name) {
        logger.error(
            `Category #${itemNum} is missing name`,
            'name',
            'Add a name field with the category name'
        );
    }
}

/**
 * Comprehensive backup validation with detailed logging
 */
function validateBackupDataEnhanced(backupData) {
    const logger = new ValidationLogger();
    
    logger.log('Starting backup validation...');
    
    // Basic structure validation
    if (!backupData) {
        logger.error('Backup data is null or undefined', null, 'Provide a valid backup object');
        return logger.getReport();
    }
    
    if (!backupData.data) {
        logger.error('Backup is missing "data" field', 'data', 'Ensure backup has a "data" object containing categories, adkar, and groups');
        return logger.getReport();
    }
    
    // Check for data presence
    const hasGroups = backupData.data.groups && backupData.data.groups.length > 0;
    const hasAdkar = backupData.data.adkar && backupData.data.adkar.length > 0;
    const hasCategories = backupData.data.categories && backupData.data.categories.length > 0;
    
    if (!hasGroups && !hasAdkar && !hasCategories) {
        logger.warn('Backup contains no data (empty categories, adkar, and groups)');
    }
    
    logger.log(`Found ${backupData.data.categories?.length || 0} categories`);
    logger.log(`Found ${backupData.data.adkar?.length || 0} adkar`);
    logger.log(`Found ${backupData.data.groups?.length || 0} groups`);
    
    // Validate categories
    if (hasCategories) {
        if (!Array.isArray(backupData.data.categories)) {
            logger.error('Field "categories" must be an array', 'categories', 'Ensure categories is an array of category objects');
        } else {
            backupData.data.categories.forEach((category, index) => {
                validateCategoryItem(category, index, logger);
            });
        }
    }
    
    // Validate adkar
    if (hasAdkar) {
        if (!Array.isArray(backupData.data.adkar)) {
            logger.error('Field "adkar" must be an array', 'adkar', 'Ensure adkar is an array of adkar objects');
        } else {
            backupData.data.adkar.forEach((adkar, index) => {
                validateAdkarItem(adkar, index, logger);
            });
        }
    }
    
    // Validate groups
    if (hasGroups) {
        if (!Array.isArray(backupData.data.groups)) {
            logger.error('Field "groups" must be an array', 'groups', 'Ensure groups is an array of group objects');
        } else {
            backupData.data.groups.forEach((group, index) => {
                validateGroupItem(group, index, logger);
            });
        }
    }
    
    logger.log('Validation complete');
    return logger.getReport();
}

module.exports = {
    ValidationLogger,
    isValidJSON,
    isValidJSONArray,
    validateAdkarItem,
    validateGroupItem,
    validateCategoryItem,
    validateBackupDataEnhanced
};
