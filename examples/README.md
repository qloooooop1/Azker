# Backup Examples

This directory contains example backup files in different versions to demonstrate the backup system's backward compatibility and migration capabilities.

## Files

### `backup-v1.0-example.json`
- **Version**: 1.0 (Legacy format)
- **Structure**: Flat JSON with top-level arrays
- **Field Names**: Uses old field names (`type`, `days_of_week`)
- **Auto-Migration**: ✅ Yes → v3.0

**Key Features:**
- Flat structure without `data` wrapper
- No explicit `version` field
- Old field name: `type` instead of `content_type`
- Old field name: `days_of_week` instead of `schedule_days`

### `backup-v2.0-example.json`
- **Version**: 2.0
- **Structure**: Nested with `data` field
- **Field Names**: Mixed old and new field names
- **Auto-Migration**: ✅ Yes → v3.0

**Key Features:**
- Nested structure with `data` field
- Explicit `version: "2.0"` field
- Can contain mix of old and new field names
- May have `type` instead of `content_type`

### `backup-v3.0-example.json`
- **Version**: 3.0.0 (Current)
- **Structure**: Nested with enhanced validation
- **Field Names**: Standardized new field names
- **Auto-Migration**: ❌ No (already current version)

**Key Features:**
- Nested structure with `data` field
- Explicit `version: "3.0.0"` field
- All new standardized field names
- Full type normalization
- Complete field set with defaults

## Testing Examples

### Test Migration from v1.0

```bash
node -e "
const bvm = require('./lib/backup-version-manager');
const fs = require('fs');

const backup = JSON.parse(fs.readFileSync('examples/backup-v1.0-example.json'));
console.log('Original:', bvm.detectBackupVersion(backup));

const migrated = bvm.migrateToCurrentVersion(backup, console);
console.log('Migrated:', migrated.version);
console.log(JSON.stringify(migrated, null, 2));
"
```

### Test Migration from v2.0

```bash
node -e "
const bvm = require('./lib/backup-version-manager');
const fs = require('fs');

const backup = JSON.parse(fs.readFileSync('examples/backup-v2.0-example.json'));
const migrated = bvm.migrateToCurrentVersion(backup, console);
console.log(JSON.stringify(migrated, null, 2));
"
```

### Test Validation

```bash
node -e "
const bv = require('./lib/backup-validator');
const fs = require('fs');

const backup = JSON.parse(fs.readFileSync('examples/backup-v3.0-example.json'));
const validation = bv.validateBackupDataEnhanced(backup);
console.log('Valid:', validation.valid);
console.log('Errors:', validation.errors.length);
console.log('Warnings:', validation.warnings.length);
"
```

## Using Examples in Restore

You can restore these example backups through:

1. **Admin Panel**: Upload any of these files through the restore interface
2. **API**: POST to `/api/restore` with the backup file
3. **CLI**: Use `node restore.js examples/backup-v1.0-example.json`

All versions will automatically be migrated to v3.0 during restoration.

## Field Name Migration

The system automatically migrates old field names:

| Old Name (v1.0/v2.0) | New Name (v3.0) |
|---------------------|-----------------|
| `type` | `content_type` |
| `days_of_week` | `schedule_days` |

## Default Values

For v1.0 backups, the following defaults are added during migration:

- `schedule_dates`: `"[]"`
- `schedule_months`: `"[]"`
- `schedule_time`: `"12:00"`
- `schedule_type`: `"daily"`

## Version Detection Logic

The system detects versions using:

1. **Explicit version field**: If `version` field exists, use it
2. **Structure heuristics**: 
   - Has `data` field → v2.0 or higher
   - Flat structure → v1.0
3. **Fallback**: Mark as `unknown` (will fail validation)

## Supported Versions

- ✅ v1.0, v1.0.0
- ✅ v2.0, v2.0.0
- ✅ v3.0, v3.0.0
- ❌ v4.0+ (not yet defined)

## Notes

- These are **example files** for testing and demonstration
- Do not use these in production without modification
- Contains sample Arabic text for adkar content
- Telegram IDs and user IDs are fictional

---

**Last Updated**: February 1, 2026  
**Version**: 3.0.0
