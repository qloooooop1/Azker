# Fix for Telegram 409 Conflict Error

## Problem Statement

The bot was encountering a Telegram 409 Conflict error:
```
ETELEGRAM: 409 Conflict: terminated by other getUpdates request; 
make sure that only one bot instance is running.
```

This occurs when multiple instances of the bot attempt to receive updates from Telegram simultaneously.

## Solution Implemented

This PR implements **webhook mode as the default** to prevent the 409 Conflict error, with polling mode available as a fallback:

### 1. Webhook Mode (Default - Recommended)

The primary solution that inherently prevents conflicts:

**Features:**
- ✅ **Default mode** - eliminates polling conflicts completely
- ✅ No polling - Telegram pushes updates to your server
- ✅ More efficient and lower latency
- ✅ Secret token validation for security
- ✅ Perfect for production deployments (especially Render.com)
- ✅ Graceful webhook cleanup on shutdown

**Configuration:**
```env
USE_WEBHOOK=true  # Default
WEBHOOK_URL=https://your-service-name.onrender.com
WEBHOOK_PATH=/webhook
WEBHOOK_SECRET=your-secret-token  # Optional, auto-generated if not set
```

**Security Features:**
- Secret token validation via `X-Telegram-Bot-Api-Secret-Token` header
- Intelligent error handling (200 for client errors, 500 for server errors)
- No PID exposure in health check endpoint

### 2. Process Locking (PID-based) - Additional Protection

A robust process locking mechanism for additional safety:

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

### 3. Polling Mode Fallback (For Local Development)

Available for local development when webhooks aren't needed:

**Configuration:**
```env
USE_WEBHOOK=false  # Only for local development
```

## Files Changed

### server.js
- Added `acquireProcessLock()` and `releaseProcessLock()` functions
- Added `setupWebhook()` function with secret token support
- Split initialization into `continueInitialization()` and `startPollingMode()`
- Added `/webhook` endpoint with security validation
- Added `/health` endpoint for monitoring
- Enhanced error messages with helpful hints
- **Improved graceful shutdown with `drop_pending_updates: true`** for both polling and webhook modes
- **Added webhook deletion with `drop_pending_updates: true` before starting polling** (critical for Render's zero-downtime deployments)
- **Added webhook cleanup in uncaughtException handler with `drop_pending_updates: true`**

### env.example
- Set `USE_WEBHOOK=true` as default (changed from false)
- Added example `WEBHOOK_URL` value
- Enhanced comments to emphasize webhook as recommended default

### render.yaml
- Added webhook environment variables (`USE_WEBHOOK`, `WEBHOOK_URL`, `WEBHOOK_PATH`, `WEBHOOK_SECRET`)
- Changed health check path from `/` to `/health`
- Configured for optimal webhook mode deployment

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

### Default Mode (Webhook - Recommended for Production)
```bash
# Configure in .env (webhook is now default)
USE_WEBHOOK=true  # This is the default
WEBHOOK_URL=https://your-service-name.onrender.com
WEBHOOK_SECRET=my-secret-token  # Optional

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

### Polling Mode (For Local Development Only)
```bash
# Configure in .env
USE_WEBHOOK=false  # Override default for local testing

# Start the bot
npm start
```

If another instance is already running:
```
❌ خطأ: هناك نسخة أخرى من البوت تعمل بالفعل (PID: 12345)
ℹ️ يرجى إيقاف النسخة الأخرى أولاً أو حذف الملف إذا كانت العملية قد توقفت بشكل غير طبيعي:
   rm /path/to/data/bot.pid
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

1. **Prevents 409 Conflicts**: Webhook mode (now default) eliminates polling conflicts completely
2. **Production Ready**: Optimized for production deployments (especially Render.com)
3. **Zero-Downtime Deployments**: Perfect for Render's rolling deployments
4. **Self-Healing**: Automatic stale lock cleanup and fallback mechanisms
5. **Secure**: Secret token validation and proper error handling
6. **Well-Documented**: Comprehensive guides for setup and troubleshooting
7. **Backward Compatible**: Polling mode still available for local development
8. **Render Zero-Downtime Deployment Support**: `drop_pending_updates: true` ensures clean handoffs during deployments

## Migration Guide

### For Existing Deployments on Render.com

**Important**: Update your environment variables to enable webhook mode:

1. In Render dashboard, add/update these environment variables:
   ```
   USE_WEBHOOK=true
   WEBHOOK_URL=https://your-service-name.onrender.com
   ```
2. Redeploy your service
3. Verify webhook is active by checking logs for: `✅ تم إعداد Webhook بنجاح!`

### For Local Development
Set `USE_WEBHOOK=false` in your `.env` file to use polling mode locally.

### To Enable Webhook Mode (If Not Using Default)
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
