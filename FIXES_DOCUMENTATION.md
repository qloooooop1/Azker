# Azker Bot - Fixes Documentation

## Overview
This document describes the fixes implemented to address the following issues:

1. **Backup Restoration Error** - Pattern mismatch when restoring backups
2. **Media Upload & Publishing** - Files upload but don't publish correctly
3. **YouTube Video Support** - Add ability to embed YouTube videos
4. **Media-Only Posts** - Allow publishing media without text

## Changes Made

### 1. Database Schema Updates

#### Modified `adkar` Table
Changed the following fields from `NOT NULL` to allow `NULL`:
- `title TEXT` (previously `title TEXT NOT NULL`)
- `content TEXT` (previously `content TEXT NOT NULL`)

Added new field:
- `youtube_url TEXT` - Stores YouTube video URLs

**Migration Note**: Existing databases will work with new code. The `CREATE TABLE IF NOT EXISTS` statement will not modify existing tables, but new installations will have the updated schema.

### 2. YouTube Video Support

#### New Functions (server.js)
```javascript
// Check if a URL is a YouTube URL
function isYouTubeUrl(url)

// Extract video ID from YouTube URL
function extractYouTubeVideoId(url)
```

Supported YouTube URL formats:
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`
- `https://www.youtube.com/v/VIDEO_ID`

#### Implementation
- POST `/api/adkar` - Detects YouTube URLs and extracts video ID
- PUT `/api/adkar/:id` - Updates with YouTube URL support
- `sendAdkarToGroup()` - Sends YouTube links with formatted message

### 3. Media-Only Posts

#### Validation Changes
**Old validation** (required both title AND content):
```javascript
if (!title || !content) {
    return res.status(400).json({ error: 'العنوان والمحتوى مطلوبان' });
}
```

**New validation** (requires at least one of title, content, or media):
```javascript
const hasMedia = file_url || youtube_url || req.files?.audio_file || 
                 req.files?.image_file || req.files?.video_file || 
                 req.files?.pdf_file || req.files?.file;

if (!title && !content && !hasMedia) {
    return res.status(400).json({ 
        error: 'يجب توفير عنوان أو محتوى أو ملف وسائط على الأقل'
    });
}
```

#### Message Building
The message building logic now handles optional title and content:
```javascript
let message = '';
if (adkar.title || adkar.content) {
    if (adkar.category_name) message += `📌 *${adkar.category_name}*\n`;
    if (adkar.title) message += `📖 ${adkar.title}\n\n`;
    if (adkar.content) message += `${adkar.content}\n\n`;
    message += `🕒 ${adkar.schedule_time} | 📅 ${moment().format('YYYY/MM/DD')}`;
}
```

Media is sent with optional caption:
```javascript
await bot.sendPhoto(chatId, filePath, {
    caption: message || undefined,
    parse_mode: message ? 'Markdown' : undefined
});
```

### 4. Backup Restoration Fix

#### Column Name Compatibility
The restore endpoint now maps old column names to new ones:

**Old → New Mapping**:
- `type` → `content_type`
- `days_of_week` → `schedule_days`
- Added support for `schedule_dates` and `schedule_months`
- Added support for `youtube_url`

```javascript
const content_type = adkar.content_type || adkar.type || 'text';
const schedule_days = adkar.schedule_days || adkar.days_of_week || '[0,1,2,3,4,5,6]';
```

This ensures backward compatibility with old backup files.

### 5. Video File Upload Support

#### New Features
- Added `video_file` field to multer upload configuration
- Created `/uploads/videos/` directory
- Added video MIME type validation
- Support for multiple video formats: mp4, mpeg, quicktime, avi, mkv, webm

#### Multer Configuration
```javascript
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    fileFilter: function (req, file, cb) {
        const allowedTypes = {
            'video_file': ['video/mp4', 'video/mpeg', 'video/quicktime', 
                          'video/x-msvideo', 'video/x-matroska', 'video/webm'],
            // ... other types
        };
        // ... validation logic
    }
});
```

#### Auto-detection for Generic 'file' Field
When using the generic `file` field, the system now auto-detects the file type:
```javascript
if (file.fieldname === 'file') {
    if (file.mimetype.startsWith('audio/')) folder = 'audio';
    else if (file.mimetype.startsWith('image/')) folder = 'images';
    else if (file.mimetype.startsWith('video/')) folder = 'videos';
    else if (file.mimetype === 'application/pdf') folder = 'pdfs';
    else folder = 'temp';
}
```

## API Changes

### POST /api/adkar
**New Parameters**:
- `youtube_url` (optional) - YouTube video URL
- Support for `video_file` upload field

**Changed Validation**:
- No longer requires both `title` and `content`
- Accepts posts with only media (if provided)

### PUT /api/adkar/:id
**New Parameters**:
- `youtube_url` (optional) - YouTube video URL
- Support for `video_file` upload field

**Changed Validation**:
- Same as POST endpoint

### POST /api/restore
**Improved Compatibility**:
- Handles both old and new backup formats
- Maps `type` → `content_type`
- Maps `days_of_week` → `schedule_days`
- Provides default values for missing fields

## Testing

Run the test suite to verify all fixes:
```bash
node test-fixes.js
```

The test suite includes:
1. YouTube URL validation and ID extraction tests (6 tests)
2. Media-only post validation tests (6 tests)
3. Backup column name compatibility tests (3 tests)

**Expected Output**: All 15 tests should pass.

## Usage Examples

### 1. Creating a Media-Only Post (Image)
```javascript
// POST /api/adkar
{
    "category_id": 1,
    "content_type": "image",
    "schedule_time": "08:00",
    // No title or content - just upload an image file
    // Image will be displayed without any caption
}
```

### 2. Creating a YouTube Video Post
```javascript
// POST /api/adkar
{
    "category_id": 1,
    "title": "دعاء مؤثر",
    "youtube_url": "https://www.youtube.com/watch?v=VIDEO_ID",
    "schedule_time": "12:00"
}
```

### 3. Creating a Post with Audio and Optional Text
```javascript
// POST /api/adkar
{
    "category_id": 1,
    "title": "تلاوة خاشعة",
    // No content field
    "content_type": "audio",
    "schedule_time": "14:00"
    // Upload audio file
}
```

### 4. Restoring an Old Backup
Old backup format will be automatically converted:
```json
{
    "data": {
        "adkar": [
            {
                "id": 1,
                "title": "ذكر الصباح",
                "content": "أصبحنا وأصبح الملك لله",
                "type": "audio",  // Will be mapped to content_type
                "days_of_week": "[0,1,2,3,4,5,6]"  // Will be mapped to schedule_days
            }
        ]
    }
}
```

## Breaking Changes
**None** - All changes are backward compatible. Existing functionality continues to work as before.

## Recommendations

1. **For New Installations**: The database will automatically use the new schema with optional title/content fields.

2. **For Existing Installations**: No migration needed. The code handles both NULL and empty strings for title/content.

3. **For Backups**: Old backups can be restored without modification. The restore function automatically maps old column names to new ones.

4. **For Admin Interface**: Consider updating the form to:
   - Make title and content fields optional when media is provided
   - Add a YouTube URL input field
   - Add video file upload option
   - Show clear validation messages

## Future Enhancements

Potential improvements for future versions:

1. **YouTube Embedding**: Instead of sending just a link, consider using Telegram's native video message with YouTube thumbnails
2. **Video Preview**: Generate video thumbnails for uploaded video files
3. **Playlist Support**: Support for YouTube playlists
4. **Media Gallery**: Allow multiple images/videos in a single post
5. **Scheduled Media**: Different media for different times of day

## Support

For issues or questions about these fixes, please refer to:
- Test script: `test-fixes.js`
- Main implementation: `server.js`
- This documentation: `FIXES_DOCUMENTATION.md`
