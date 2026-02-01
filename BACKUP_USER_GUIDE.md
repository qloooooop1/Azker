# Backup System - User Guide

## 🎯 Overview

The Azker bot features a robust, enterprise-grade backup and restore system that ensures your data is always safe and recoverable. This guide will walk you through everything you need to know about creating, validating, and restoring backups.

## 📋 Table of Contents

1. [Creating a Backup](#creating-a-backup)
2. [Validating a Backup](#validating-a-backup)
3. [Restoring a Backup](#restoring-a-backup)
4. [Troubleshooting](#troubleshooting)
5. [Best Practices](#best-practices)
6. [Technical Details](#technical-details)

---

## Creating a Backup

### Via Web Interface

1. **Navigate to Backup Management**
   - Open the Admin Panel in your browser
   - Click on "النسخ الاحتياطي والاستعادة" (Backup Management) in the sidebar

2. **Download Backup**
   - Click the "تنزيل النسخة الاحتياطية" (Download Backup) button
   - Your browser will download a JSON file with a timestamp in the filename
   - Example: `azkar-backup-2026-02-01T12-00-00-000Z.json`

3. **What's Included**
   - ✅ All registered groups
   - ✅ All adkar (reminders) and their content
   - ✅ All categories
   - ✅ Scheduling configurations
   - ✅ Group settings

### Via Command Line

```bash
# Using curl
curl http://localhost:3000/api/backup > my-backup.json

# Or using the backup script
node backup.js
```

---

## Validating a Backup

Before restoring a backup, it's **highly recommended** to validate it first. This helps catch any issues early and provides detailed diagnostics.

### Via Web Interface

1. **Select the Backup File**
   - In the Backup Management section
   - Click "اختر ملف النسخة الاحتياطية" (Choose backup file)
   - Select your backup JSON file

2. **Run Validation**
   - Click "التحقق من صحة النسخة الاحتياطية" (Validate Backup)
   - Wait for the validation results

3. **Review Results**
   - ✅ **Healthy Backup**: Green message with statistics
   - ⚠️ **Warnings**: Yellow message with fixable issues
   - ❌ **Errors**: Red message with detailed problem list

### Via Command Line

```bash
# Basic validation
node diagnose-backup.js my-backup.json

# Verbose mode (detailed diagnostics)
node diagnose-backup.js my-backup.json --verbose

# Validate and auto-repair
node diagnose-backup.js my-backup.json --repair --output repaired-backup.json
```

### Validation Report

The validation tool checks for:

- ✅ **JSON Format**: Is the file valid JSON?
- ✅ **Version Detection**: Which backup version is this?
- ✅ **Data Structure**: Does it have the required fields?
- ✅ **Field Validation**: Are all required fields present?
- ✅ **Data Types**: Are values in the correct format?
- ✅ **Array Formats**: Are schedule arrays valid?
- ✅ **Time Patterns**: Are times in HH:MM format?
- ✅ **File Size**: Is it within the 10MB limit?

---

## Restoring a Backup

### ⚠️ Important Notes Before Restoring

- **Merge Behavior**: Restoration merges data with existing data
- **Duplicate Handling**: Items with the same ID will be updated
- **No Data Loss**: Existing items not in the backup are kept
- **Always Validate First**: Use the validation tool before restoring

### Via Web Interface

1. **Validate First** (Recommended)
   - Follow the validation steps above
   - Ensure the backup is healthy

2. **Upload and Restore**
   - Select the backup file
   - Click "استعادة النسخة الاحتياطية" (Restore Backup)
   - Confirm the operation
   - Wait for completion

3. **Review Results**
   - Check how many items were restored:
     - Categories
     - Adkar
     - Groups
   - Review any warnings or errors

### Via Command Line

```bash
node restore.js my-backup.json
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. "The string did not match the expected pattern"

**Cause**: Invalid time format in schedule_time field

**Solution**:
```bash
# Use the diagnostic tool to identify the problem
node diagnose-backup.js my-backup.json

# Auto-repair the backup
node diagnose-backup.js my-backup.json --repair --output fixed-backup.json
```

**Manual Fix**: Ensure all `schedule_time` values are in `HH:MM` format (e.g., `"08:30"`, `"14:00"`)

#### 2. "Field must be a JSON array"

**Cause**: Array fields are not in the correct format

**Solution**:
- The system accepts both formats:
  - JSON string: `"[0,1,2,3,4,5,6]"`
  - Native array: `[0,1,2,3,4,5,6]`
- Use the auto-repair feature to fix this automatically

#### 3. "Backup file is too large"

**Cause**: File exceeds 10MB limit

**Solution**:
- Export smaller subsets of data
- Compress images/media separately
- Remove old or unnecessary items before backup

#### 4. "Invalid JSON"

**Cause**: File is corrupted or not valid JSON

**Solution**:
1. Open the file in a text editor
2. Use a JSON validator (e.g., jsonlint.com)
3. Check for:
   - Missing commas
   - Unclosed brackets
   - Invalid characters
   - Truncated file

#### 5. Version Compatibility Issues

**Cause**: Backup from an older or newer version

**Solution**:
- The system automatically migrates backups from v1.0, v2.0, to v3.0
- Supported versions: 1.0, 1.0.0, 2.0, 2.0.0, 3.0, 3.0.0
- No manual intervention needed

---

## Best Practices

### 1. Regular Backups

Create backups regularly:
- ✅ Daily: For active systems
- ✅ Weekly: For moderate use
- ✅ Before major changes: Always

### 2. Backup Storage

Store backups securely:
- ✅ Multiple locations (cloud + local)
- ✅ Version control (keep old backups)
- ✅ Encrypt sensitive data
- ✅ Test restoration periodically

### 3. Validation Workflow

Always follow this workflow:
1. Create backup
2. **Validate backup** immediately
3. Store in safe location
4. Test restoration in dev environment
5. Document any issues

### 4. Naming Convention

Use descriptive names:
```
azkar-backup-production-2026-02-01.json
azkar-backup-before-migration-2026-01-15.json
azkar-backup-weekly-2026-02-01.json
```

### 5. Restoration Testing

Periodically test restoration:
1. Create a test environment
2. Restore a backup
3. Verify all data is correct
4. Document the process

---

## Technical Details

### Backup Format (v3.0)

```json
{
  "version": "3.0.0",
  "timestamp": "2026-02-01T12:00:00.000Z",
  "data": {
    "categories": [
      {
        "id": 1,
        "name": "Category Name",
        "description": "Description",
        "icon": "🌅",
        "color": "#FFD700",
        "created_at": "2026-01-01T08:00:00.000Z"
      }
    ],
    "adkar": [
      {
        "id": 1,
        "category_id": 1,
        "title": "Adkar Title",
        "content": "Adkar Content",
        "content_type": "text",
        "schedule_type": "daily",
        "schedule_days": "[0,1,2,3,4,5,6]",
        "schedule_dates": "[]",
        "schedule_months": "[]",
        "schedule_time": "06:00",
        "is_active": 1,
        "priority": 1,
        "created_at": "2026-01-01T08:00:00.000Z"
      }
    ],
    "groups": [
      {
        "id": 1,
        "chat_id": -1001234567890,
        "title": "Group Name",
        "admin_id": 123456789,
        "bot_enabled": 1,
        "is_active": 1,
        "is_protected": 0,
        "settings": "{}",
        "created_at": "2026-01-01T08:00:00.000Z"
      }
    ]
  }
}
```

### Version Migration

The system automatically migrates between versions:

- **v1.0 → v3.0**:
  - Wraps data in `data` field
  - Migrates `type` → `content_type`
  - Migrates `days_of_week` → `schedule_days`
  - Adds default values for missing fields

- **v2.0 → v3.0**:
  - Normalizes field names
  - Ensures type consistency
  - Adds version metadata

### Field Validation Rules

**Required Fields:**
- Categories: `name`
- Adkar: `category_id`
- Groups: `chat_id`, `title`

**Format Rules:**
- Times: `HH:MM` (00:00 to 23:59)
- Arrays: JSON string or native array
- IDs: Integer or string-convertible integer
- Booleans: 0/1 or string "0"/"1"

**Size Limits:**
- Maximum file size: 10 MB
- Recommended: < 5 MB for best performance

### API Endpoints

**Backup Creation:**
```
GET /api/backup
Response: JSON file download
```

**Backup Validation:**
```
POST /api/validate-backup
Body: FormData with backupFile
Response: Validation report
```

**Backup Restoration:**
```
POST /api/restore
Body: FormData with backupFile
Response: Restoration results
```

---

## Support

If you encounter issues not covered in this guide:

1. **Check Logs**: Review console output for detailed errors
2. **Use Diagnostic Tool**: Run `node diagnose-backup.js your-file.json --verbose`
3. **Documentation**: Read `BACKUP_SYSTEM_DOCUMENTATION.md`
4. **GitHub Issues**: Report bugs with backup file (sanitized) and error logs

---

## Changelog

### Version 3.0.0 (Current)
- ✅ Enhanced validation with field-by-field checking
- ✅ Automatic repair functionality
- ✅ Comprehensive diagnostic tool
- ✅ Web-based validation interface
- ✅ Better error messages with suggestions
- ✅ Support for multiple array formats
- ✅ Graceful degradation for partial failures

### Version 2.0.0
- ✅ Nested data structure
- ✅ Version field
- ✅ Basic validation

### Version 1.0.0
- ✅ Flat structure
- ✅ Basic backup/restore

---

**Last Updated**: February 1, 2026
**Version**: 3.0.0
