# Backup Restoration Troubleshooting Guide

## Overview

This guide helps you troubleshoot and resolve issues with the backup restoration system in the Azker Telegram bot.

## Common Errors and Solutions

### 1. "The string did not match the expected pattern"

**Cause**: This error typically occurs when the server returns a non-JSON response or malformed JSON.

**Solutions**:
- Check server logs for detailed error messages
- Verify the backup file is valid JSON using a JSON validator
- Ensure the backup file follows the correct format
- Check network connection and server status

**Example**:
```javascript
// ❌ Invalid - will cause pattern error
{
  "data": {
    "adkar": [
      {
        "schedule_days": "not-a-json-array"  // Invalid format
      }
    ]
  }
}

// ✅ Valid - proper format
{
  "data": {
    "adkar": [
      {
        "schedule_days": "[0,1,2,3,4,5,6]"  // String JSON array
        // OR
        "schedule_days": [0,1,2,3,4,5,6]    // Native array
      }
    ]
  }
}
```

### 2. Invalid JSON Format

**Symptoms**:
- Error message: "Invalid JSON"
- "تلقينا استجابة غير صحيحة من الخادم (JSON غير صالح)"

**Solutions**:
1. Validate your JSON file using an online validator (e.g., jsonlint.com)
2. Check for:
   - Missing commas between properties
   - Trailing commas at the end of arrays/objects
   - Unescaped quotes in string values
   - Invalid characters or encoding issues

**Example**:
```json
{
  "version": "3.0.0",
  "timestamp": "2026-02-01T00:00:00.000Z",
  "data": {
    "categories": [],
    "adkar": [],
    "groups": []
  }
}
```

### 3. Schedule Field Validation Errors

**Common Issues**:
- `schedule_days`: Must be a JSON array of integers (0-6)
- `schedule_dates`: Must be a JSON array
- `schedule_months`: Must be a JSON array
- `schedule_time`: Must match HH:MM format (e.g., "08:30", "14:00")

**Valid Formats**:
```json
{
  "schedule_days": "[0,1,2,3,4,5,6]",  // String format
  "schedule_days": [0,1,2,3,4,5,6],    // Array format (both work)
  "schedule_time": "08:30",             // HH:MM format
  "schedule_time": "14:00"              // 24-hour format
}
```

**Invalid Examples**:
```json
{
  "schedule_days": "0,1,2,3,4,5,6",    // ❌ Not a JSON array
  "schedule_time": "8:30",              // ❌ Missing leading zero
  "schedule_time": "25:00",             // ❌ Invalid hour
  "schedule_time": "14:60"              // ❌ Invalid minute
}
```

### 4. Type Coercion Issues

**Issue**: String values where numbers are expected, or vice versa

**Solution**: The system now automatically handles type coercion for:
- IDs (can be strings or numbers)
- Boolean flags (`is_active`, `bot_enabled`, etc.)
- Priority values

**Both formats work**:
```json
{
  "id": 1,              // Number format
  "id": "1",            // String format (will be converted)
  "is_active": 1,       // Number format
  "is_active": "1"      // String format (will be converted)
}
```

### 5. Missing Required Fields

**Required Fields**:
- Categories: `name`
- Adkar: `category_id`
- Groups: `chat_id`, `title`

**Error Message**: Will specify which field is missing and in which item (e.g., "Adkar #5 is missing category_id")

**Solution**: Add the missing fields to your backup file

### 6. Content Type Validation

**Valid Content Types**: `text`, `audio`, `image`, `video`, `pdf`

**Invalid Example**:
```json
{
  "content_type": "document"  // ❌ Not a valid type
}
```

**Valid Example**:
```json
{
  "content_type": "pdf"  // ✅ Valid type
}
```

## Server-Side Error Handling

The backup restoration system now includes comprehensive error handling:

1. **Pre-validation**: JSON structure is validated before processing
2. **Field validation**: Each field is checked for correct format
3. **Type coercion**: Automatic conversion of compatible types
4. **Error reporting**: Detailed error messages with suggestions
5. **Partial success**: If some items fail, others are still restored
6. **Transaction safety**: Database errors are caught and reported

## Client-Side Improvements

The admin panel now:
- Checks response content-type before parsing
- Provides detailed error messages
- Shows validation errors with field names
- Suggests fixes for common issues
- Handles network errors gracefully

## Debugging Steps

### Step 1: Check Browser Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for error messages
4. Check Network tab for API response

### Step 2: Check Server Logs
1. SSH to server or check Render.com logs
2. Look for errors starting with "❌"
3. Review validation report
4. Check for database errors

### Step 3: Validate Backup File
1. Open backup file in text editor
2. Use JSON validator (jsonlint.com)
3. Check structure matches expected format
4. Verify all required fields are present

### Step 4: Use Validation Tool
```bash
# Run validation test
node test-backup-validation.js

# Check specific file
node diagnose-backup.js path/to/backup.json
```

## Expected Backup Format

### Version 3.0.0 (Current)
```json
{
  "version": "3.0.0",
  "timestamp": "2026-02-01T00:00:00.000Z",
  "data": {
    "categories": [
      {
        "id": 1,
        "name": "Category Name",
        "description": "Description",
        "icon": "🌅",
        "color": "#FFD700",
        "created_at": "2026-01-01T00:00:00.000Z"
      }
    ],
    "adkar": [
      {
        "id": 1,
        "category_id": 1,
        "title": "Title",
        "content": "Content",
        "content_type": "text",
        "schedule_type": "daily",
        "schedule_days": "[0,1,2,3,4,5,6]",
        "schedule_dates": "[]",
        "schedule_months": "[]",
        "schedule_time": "08:00",
        "is_active": 1,
        "priority": 1,
        "created_at": "2026-01-01T00:00:00.000Z"
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
        "created_at": "2026-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

## Getting Help

If you're still experiencing issues:

1. **Check Documentation**:
   - `BACKUP_SYSTEM_DOCUMENTATION.md` - System overview
   - `BACKUP_USER_GUIDE.md` - User guide
   - `README.md` - General information

2. **Run Diagnostics**:
   ```bash
   npm run diagnose path/to/backup.json
   ```

3. **Check Tests**:
   ```bash
   npm test
   ```

4. **Review Logs**:
   - Server logs for API errors
   - Browser console for client errors
   - Validation report in console

5. **Contact Support**:
   - Include error messages
   - Share (sanitized) backup file
   - Provide server logs
   - Mention browser and version

## Best Practices

1. **Regular Backups**: Create backups before major changes
2. **Test Restores**: Test backup restoration in development first
3. **Validate Files**: Use validation tools before restoring
4. **Keep Logs**: Monitor server logs during restoration
5. **Version Control**: Track backup file versions
6. **Documentation**: Document custom modifications
7. **Size Limits**: Keep backup files under 10MB
8. **Format Consistency**: Use consistent field formats

## Migration from Older Versions

The system automatically migrates backup files from older versions:
- v1.0 → v3.0
- v2.0 → v3.0

Migration includes:
- Field name updates
- Format standardization
- Default value insertion
- Structure normalization

If automatic migration fails, check:
1. Version field is present
2. Data structure is recognized
3. Required fields exist
4. Values are valid for conversion

## Security Considerations

1. **File Size**: Limited to 10MB to prevent memory issues
2. **JSON Validation**: Prevents code injection
3. **Type Checking**: Validates data types
4. **SQL Injection**: Uses prepared statements
5. **Access Control**: Requires authentication token

## Performance Tips

1. **Large Restores**: May take time for thousands of records
2. **Progress Indicator**: Shows restoration progress
3. **Error Recovery**: Partial failures don't block entire restore
4. **Database Optimization**: Uses batch inserts
5. **Memory Management**: Streams large files

## Changelog

### 2026-02-01: Enhanced Error Handling
- Fixed "string did not match pattern" error
- Added content-type checking
- Improved error messages
- Better JSON validation
- Response safety improvements
- Comprehensive error reporting

### Previous Versions
- See `BACKUP_RESTORE_FIX_SUMMARY.md` for history
