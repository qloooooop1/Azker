# Fix for Telegram 409 Conflict Error

## Problem Statement

The bot was encountering a Telegram 409 Conflict error:
```
ETELEGRAM: 409 Conflict: terminated by other getUpdates request; 
make sure that only one bot instance is running.
```

This occurs when multiple instances of the bot attempt to receive updates from Telegram simultaneously.

## Solution Implemented

This PR implements **two complementary solutions** to prevent the 409 Conflict error:

### 1. Process Locking (PID-based)

A robust process locking mechanism ensures only one bot instance runs at a time:

**Features:**
- ✅ Atomic file creation using `wx` flag to prevent race conditions
- ✅ Process validation using `process.kill(pid, 0)` signal
- ✅ Automatic detection and cleanup of stale locks from crashed processes
- ✅ Graceful cleanup on shutdown (SIGINT, SIGTERM)
- ✅ Error handling in uncaughtException

**How it works:**
1. On startup, bot attempts to create a PID file atomically
2. If file exists, checks if the process is still running
3. If process is dead, removes stale PID file and continues
4. If process is alive, exits with clear error message
5. On shutdown, cleanly removes the PID file

**Location:** PID file is stored at `{DATA_DIR}/bot.pid`

### 2. Webhook Mode (Recommended for Production)

An alternative to polling that inherently prevents conflicts:

**Features:**
- ✅ No polling - Telegram pushes updates to your server
- ✅ More efficient and lower latency
- ✅ Secret token validation for security
- ✅ Automatic fallback to polling if webhook setup fails
- ✅ Graceful webhook cleanup on shutdown

**Configuration:**
```env
USE_WEBHOOK=true
WEBHOOK_URL=https://yourdomain.com
WEBHOOK_PATH=/webhook
WEBHOOK_SECRET=your-secret-token  # Optional, auto-generated if not set
```

**Security Features:**
- Secret token validation via `X-Telegram-Bot-Api-Secret-Token` header
- Intelligent error handling (200 for client errors, 500 for server errors)
- No PID exposure in health check endpoint

## Files Changed

### server.js
- Added `acquireProcessLock()` and `releaseProcessLock()` functions
- Added `setupWebhook()` function with secret token support
- Split initialization into `continueInitialization()` and `startPollingMode()`
- Added `/webhook` endpoint with security validation
- Added `/health` endpoint for monitoring
- Enhanced error messages with helpful hints
- Improved graceful shutdown to handle both polling and webhook modes

### env.example
- Added `USE_WEBHOOK` configuration flag
- Added `WEBHOOK_URL` for webhook endpoint
- Added `WEBHOOK_PATH` for custom webhook path
- Added `WEBHOOK_SECRET` for security validation

### WEBHOOK.md (New)
- Comprehensive webhook setup guide
- Troubleshooting section
- Security best practices
- Deployment examples for various platforms
- FAQ section

### README.md
- Added mention of 409 Conflict prevention features
- Links to webhook documentation

### .gitignore
- Added exclusion for test files

## Testing

All tests passed:
- ✅ Process locking prevents duplicate instances
- ✅ Stale lock detection and cleanup works correctly
- ✅ Configuration parsing works as expected
- ✅ Syntax validation passed
- ✅ Code review feedback addressed
- ✅ Security scan: 0 vulnerabilities found

## Usage

### Default Mode (Polling with Process Lock)
```bash
# Just run the bot normally
npm start
```

If another instance is already running:
```
❌ خطأ: هناك نسخة أخرى من البوت تعمل بالفعل (PID: 12345)
ℹ️ يرجى إيقاف النسخة الأخرى أولاً أو حذف الملف إذا كانت العملية قد توقفت بشكل غير طبيعي:
   rm /path/to/data/bot.pid
```

### Webhook Mode (Recommended)
```bash
# Configure in .env
USE_WEBHOOK=true
WEBHOOK_URL=https://yourdomain.com
WEBHOOK_SECRET=my-secret-token

# Start the bot
npm start
```

Output:
```
🔧 وضع التشغيل: Webhook
🌐 إعداد Webhook...
📍 URL: https://yourdomain.com/webhook
🔒 تم إضافة secret token للأمان
✅ تم إعداد Webhook بنجاح!
```

## Monitoring

Check bot status:
```bash
curl https://yourdomain.com/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-30T08:52:15.445Z",
  "mode": "webhook",
  "active": true,
  "uptime": 123.45
}
```

## Security

✅ No security vulnerabilities found (CodeQL scan)
✅ Webhook secret token validation implemented
✅ No sensitive information exposed in health endpoint
✅ Proper error handling prevents information leakage
✅ Documentation includes security best practices

## Benefits

1. **Prevents 409 Conflicts**: Both solutions eliminate the possibility of multiple instances
2. **Production Ready**: Webhook mode is ideal for production deployments
3. **Self-Healing**: Automatic stale lock cleanup and fallback mechanisms
4. **Secure**: Secret token validation and proper error handling
5. **Well-Documented**: Comprehensive guides for setup and troubleshooting
6. **Backward Compatible**: Polling mode still works with added protection

## Migration Guide

### For Existing Deployments
No changes required! The process locking is automatic. Your bot will:
1. Create a PID file on first run
2. Block duplicate instances automatically
3. Clean up properly on shutdown

### To Enable Webhook Mode
1. Set `USE_WEBHOOK=true` in `.env`
2. Set `WEBHOOK_URL` to your public domain
3. Optionally set `WEBHOOK_SECRET` for extra security
4. Restart the bot

If webhook setup fails, the bot automatically falls back to polling mode.

## Troubleshooting

### "Another instance is running" but nothing is running
```bash
# Remove stale PID file
rm /home/runner/work/Azker/Azker/data/bot.pid
# Or in production
rm /data/bot.pid
```

### Webhook not working
1. Check HTTPS is properly configured
2. Verify WEBHOOK_URL is publicly accessible
3. Check logs for webhook setup errors
4. Use getWebhookInfo to verify webhook is set

See [WEBHOOK.md](WEBHOOK.md) for detailed troubleshooting.

## References

- [Telegram Bot API - Webhooks](https://core.telegram.org/bots/api#setwebhook)
- [Telegram Bot API - Getting Updates](https://core.telegram.org/bots/api#getting-updates)
