# Webhook Configuration Guide

## Overview

This bot supports two modes of operation:
1. **Polling Mode** (default) - The bot actively polls Telegram servers for updates
2. **Webhook Mode** (recommended for production) - Telegram sends updates to your server

## Why Use Webhook Mode?

Webhook mode is recommended because it:
- ✅ Prevents **409 Conflict errors** from multiple bot instances and zero-downtime deployments
- ✅ **Critical for Render.com** - Resolves conflicts during rolling deployments
- ✅ More efficient - no continuous polling
- ✅ Lower latency - instant message delivery
- ✅ Better for production deployments
- ✅ More reliable and scalable

### 409 Conflict Issues on Render.com

Render.com uses **zero-downtime deployments**, which means:
1. A new instance starts while the old one is still running
2. Both instances try to use `getUpdates` (polling mode)
3. Telegram only allows one active `getUpdates` connection
4. Result: `ETELEGRAM 409 Conflict: terminated by other getUpdates request`

**Solution:** Webhook mode eliminates polling, preventing conflicts during deployments.

## Switching to Webhook Mode

### Prerequisites

1. A public domain with HTTPS (required by Telegram)
   - Example: `https://yourdomain.com` or `https://your-app.onrender.com`
2. Valid SSL certificate (usually provided by your hosting platform)

### Configuration Steps

1. **Update your `.env` file:**

```bash
# Enable webhook mode
USE_WEBHOOK=true

# Set your public webhook URL (no trailing slash)
WEBHOOK_URL=https://yourdomain.com

# Optional: Custom webhook path (default is /webhook)
WEBHOOK_PATH=/webhook

# Optional: Webhook secret token for validation
# If not set, a random token will be auto-generated
WEBHOOK_SECRET=your-secret-token-here
```

2. **Restart the bot:**

```bash
npm start
```

3. **Verify webhook is active:**

Check the logs for:
```
✅ تم إعداد Webhook بنجاح!
📊 حالة webhook: نشط
```

Or visit the health endpoint:
```bash
curl https://yourdomain.com/health
```

Expected response:
```json
{
  "status": "ok",
  "mode": "webhook",
  "active": true,
  "pid": 12345,
  "uptime": 123.45
}
```

## Webhook Endpoint

When webhook mode is enabled, Telegram will send updates to:
```
POST https://yourdomain.com/webhook
```

The bot automatically:
- Waits for the Express server to start listening
- Sets up the webhook URL with Telegram (only after server is ready)
- Validates incoming requests using the secret token (if configured)
- Processes incoming updates
- Removes the webhook on graceful shutdown

### Technical Implementation

The bot uses proper initialization sequencing to prevent issues:

1. **Bot Initialization:** Creates the Telegram bot instance with `polling: false`
2. **Server Start:** Express server starts listening on the configured PORT
3. **Webhook Setup:** After server is listening, calls `bot.setWebHook()` 
4. **Ready:** Bot is now ready to receive updates from Telegram

This sequencing ensures that Telegram's webhook verification succeeds, as the server is already listening when the webhook is registered.

## Testing Webhook Setup

### Using Telegram Bot API

Check if webhook is set:
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

⚠️ **Security Note**: Never paste your bot token directly into a browser URL bar. Always use `curl` or other secure command-line tools to avoid exposing your token in browser history.

You should see:
```json
{
  "ok": true,
  "result": {
    "url": "https://yourdomain.com/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

### Manual Webhook Setup (Advanced)

If you need to manually set the webhook:
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -d "url=https://yourdomain.com/webhook" \
  -d "drop_pending_updates=true"
```

To delete the webhook:
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook"
```

## Troubleshooting

### Webhook Not Working

1. **Check HTTPS**: Telegram requires HTTPS with a valid certificate
2. **Check URL accessibility**: Your webhook URL must be publicly accessible
3. **Check logs**: Look for errors in the bot logs
4. **Verify webhook info**: Use `getWebhookInfo` API call

### Common Errors

**Error: "Invalid SSL certificate"**
- Ensure your domain has a valid SSL certificate
- Self-signed certificates are not accepted by Telegram

**Error: "Failed to resolve host"**
- Your WEBHOOK_URL is not accessible from the internet
- Check your domain DNS settings

**Error: "Connection timeout"**
- Your server is not responding on port 443 (HTTPS)
- Check firewall settings

### Fallback to Polling

If webhook setup fails, the bot will automatically fall back to polling mode:
```
⚠️ فشل إعداد webhook، التراجع إلى polling...
✅ بوت التلجرام يعمل بنجاح!
📊 حالة polling: نشط
```

## Deployment Examples

### Render.com

**Important:** Set your Render service type to **Web Service** (not Background Worker), as webhooks require an open port.

```env
USE_WEBHOOK=true
WEBHOOK_URL=https://your-app-name.onrender.com
# PORT is automatically set by Render - don't override it
```

The bot will:
1. Start the Express server on Render's assigned PORT
2. Set up the webhook with Telegram after the server is listening
3. Automatically handle zero-downtime deployments without 409 conflicts

### Heroku

```env
USE_WEBHOOK=true
WEBHOOK_URL=https://your-app-name.herokuapp.com
```

### Custom Domain

```env
USE_WEBHOOK=true
WEBHOOK_URL=https://bot.yourdomain.com
WEBHOOK_PATH=/telegram-webhook
```

## Security Considerations

1. **Keep your bot token secret** - Never commit it to version control
2. **Use environment variables** - Store configuration in `.env` file
3. **HTTPS only** - Telegram requires secure connections
4. **Webhook Secret Token** - The bot supports optional secret token validation
   - Set `WEBHOOK_SECRET` in your `.env` file
   - Telegram will send this token in the `X-Telegram-Bot-Api-Secret-Token` header
   - The bot validates this token to ensure requests are from Telegram
   - If not set, a random token is auto-generated for your security
5. **Never expose your token** - Don't paste it in browser URLs or public logs

## Monitoring

### Health Check Endpoint

```bash
# Check bot status
curl https://yourdomain.com/health
```

Response includes:
- Current mode (webhook/polling)
- Active status
- Process ID
- Uptime

### Logs to Monitor

```bash
# Webhook setup
✅ تم إعداد Webhook بنجاح!

# Incoming updates
# Processing webhook update...

# Errors
❌ خطأ في معالجة webhook update:
```

## Switching Back to Polling

If you need to switch back to polling mode:

1. Update `.env`:
```env
USE_WEBHOOK=false
```

2. Restart the bot - it will automatically delete the webhook and start polling

## FAQ

**Q: Can I use webhook mode on localhost?**  
A: No, Telegram requires a public HTTPS URL. Use polling mode for local development.

**Q: Do I need to open port 443?**  
A: Your web server should be accessible on HTTPS (port 443), which is standard for web hosting platforms.

**Q: Can I use both polling and webhook?**  
A: No, you must choose one mode. Trying to use both will cause conflicts.

**Q: How do I know if my bot is using webhook mode?**  
A: Check the startup logs or use the `/health` endpoint.

**Q: What happens if webhook URL changes?**  
A: Simply update `WEBHOOK_URL` in `.env` and restart. The bot will update the webhook with Telegram.

## Support

For more information:
- [Telegram Bot API - Webhooks](https://core.telegram.org/bots/api#setwebhook)
- [Telegram Bot API - Getting Updates](https://core.telegram.org/bots/api#getting-updates)
