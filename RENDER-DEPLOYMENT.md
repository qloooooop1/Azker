# Render.com Deployment Guide for Telegram Bots

## Understanding the 409 Conflict Issue on Render

### The Problem

When deploying Telegram bots on Render.com, you may encounter the following error:

```
ETELEGRAM: 409 Conflict: terminated by other getUpdates request; 
make sure that only one bot instance is running
```

This happens because **Render uses zero-downtime deployments**, which means:
1. A new instance of your bot starts up
2. The new instance tries to poll Telegram for updates
3. The old instance is still running and polling
4. **Both instances try to use `getUpdates` simultaneously** → 409 Conflict!

### Why This Bot Solves the Issue

This bot implements **three layers of protection** against 409 Conflicts:

#### 1. Process Locking (PID-based)
- Prevents multiple instances on the same server
- Uses atomic file operations to avoid race conditions
- Automatically cleans up stale locks from crashed processes

#### 2. Webhook Mode (Recommended)
- **Eliminates polling entirely** - Telegram pushes updates to your server
- No `getUpdates` = No 409 Conflicts
- More efficient and lower latency
- **Best solution for Render deployments**

#### 3. Graceful Shutdown with `drop_pending_updates`
- **Critical for zero-downtime deployments**
- When the old instance shuts down:
  - Stops polling immediately
  - Calls `deleteWebHook({ drop_pending_updates: true })`
  - Clears the update queue so the new instance starts fresh
- When the new instance starts:
  - Calls `deleteWebHook({ drop_pending_updates: true })` before polling
  - Ensures no leftover webhooks from previous deployments
  - Prevents conflicts during the deployment overlap window

## Recommended Configuration for Render

### Default Configuration: Webhook Mode (Recommended)

This is the **default and recommended approach** for all Render deployments.

**1. Configure your `.env` or Render environment variables:**

```bash
# Webhook mode (this is the default)
USE_WEBHOOK=true

# Use your Render service URL
WEBHOOK_URL=https://your-app-name.onrender.com

# Optional: Set a secret token for security
WEBHOOK_SECRET=your-random-secret-token-here
```

**2. Deploy to Render:**

Your `render.yaml` is already configured for webhook mode:

```yaml
services:
  - type: web
    name: adkar-bot
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: TELEGRAM_BOT_TOKEN
        sync: false
      - key: USE_WEBHOOK
        value: true
      - key: WEBHOOK_URL
        sync: false
      - key: NODE_ENV
        value: production
```

**Benefits:**
- ✅ No 409 Conflicts - only one webhook can be set at a time
- ✅ Works perfectly with zero-downtime deployments
- ✅ More efficient - no continuous polling
- ✅ Lower latency - instant message delivery
- ✅ **This is now the default mode**

### Alternative: Polling Mode (Not Recommended for Production)

**Important**: Polling mode should only be used for local development. For production deployments on Render, always use webhook mode.

If you need polling mode for local development:

**1. Override webhook mode in `.env`:**

```bash
USE_WEBHOOK=false
```

**2. The bot automatically:**
- Creates a PID lock file to prevent duplicate instances
- Deletes webhooks with `drop_pending_updates: true` on startup
- Clears pending updates during graceful shutdown
- Handles Render's deployment overlap gracefully

**Limitations:**
- Not recommended for production
- Small window during deployment where both instances might exist
- The bot handles this by:
  - Old instance: Shuts down cleanly with `drop_pending_updates`
  - New instance: Clears webhooks before starting polling
  - Update queue is cleared to prevent conflicts

**Note**: For production deployments on Render, always use webhook mode (the default).

## Service Type: Web Service (Required for Webhooks)

✅ **Use: Web Service** (already configured in `render.yaml`)
- **Required for webhook mode** (the default)
- Webhook mode requires HTTP endpoints
- Web Service is perfect for this
- No changes needed to `render.yaml`

**Note**: The default configuration uses webhook mode with Web Service type, which is the optimal setup for Render deployments.

## Troubleshooting

### Still Getting 409 Conflicts?

1. **Check if webhook mode is enabled:**
   ```bash
   curl https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo
   ```
   If `url` is empty, webhook is not set (you're in polling mode).

2. **Verify environment variables:**
   - Make sure `USE_WEBHOOK=true` is set in Render dashboard
   - Check that `WEBHOOK_URL` matches your Render service URL

3. **Check logs during deployment:**
   - Look for: `✅ تم إعداد Webhook بنجاح!`
   - Or: `🔄 حذف أي webhook موجود ومسح التحديثات المعلقة...`

4. **Force clear everything:**
   ```bash
   # Delete webhook manually
   curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/deleteWebhook?drop_pending_updates=true"
   
   # Restart your Render service
   ```

### Webhook Not Working?

1. **Ensure HTTPS is enabled** (Render provides this automatically)
2. **Check that your service is publicly accessible**
3. **Verify WEBHOOK_URL doesn't have a trailing slash**
4. **Check Render logs** for webhook setup errors

## Migration from Polling to Webhook

If you're currently using polling mode and want to switch to webhook (the new default):

1. **Update environment variables in Render dashboard:**
   - Set: `USE_WEBHOOK=true`
   - Set: `WEBHOOK_URL=https://your-app-name.onrender.com`
   - Optional: Set `WEBHOOK_SECRET` for additional security

2. **Redeploy the service** (or it will auto-deploy if configured)

3. **Verify webhook is set:**
   ```bash
   curl https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo
   ```

4. **Test your bot** - send a message and verify it responds

The bot will automatically:
- Stop polling
- Set up the webhook
- Clear any pending updates
- Start receiving updates via webhook

## Security Best Practices

1. **Always use HTTPS** (Render provides this)
2. **Set WEBHOOK_SECRET** for additional security
3. **Never expose your bot token** in logs or public repositories
4. **Use Render's environment variables** for sensitive data

## Monitoring

Check your bot's status:
```bash
curl https://your-app-name.onrender.com/health
```

Response:
```json
{
  "status": "ok",
  "mode": "webhook",
  "active": true,
  "uptime": 123.45
}
```

## Summary

For **Render.com deployments**, the default configuration is:

| Configuration | Value | Reason |
|--------------|-------|---------|
| Service Type | Web Service | Required for webhooks |
| Bot Mode | Webhook (`USE_WEBHOOK=true`) | Default - eliminates 409 Conflicts completely |
| WEBHOOK_URL | Your Render URL | Required for webhook mode |
| Plan | Free or Paid | Free plan works perfectly with webhook mode |

This configuration provides:
- ✅ Zero 409 Conflicts
- ✅ Perfect compatibility with zero-downtime deployments
- ✅ Optimal performance and reliability
- ✅ Works on Render's free plan
- ✅ **This is now the default setup**
