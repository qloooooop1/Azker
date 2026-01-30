# Webhook Configuration Guide

## Overview

This bot supports two modes of operation:
1. **Polling Mode** (default) - The bot actively polls Telegram servers for updates
2. **Webhook Mode** (recommended for production) - Telegram sends updates to your server

## Why Use Webhook Mode?

Webhook mode is recommended because it:
- ✅ Prevents **409 Conflict errors** from multiple bot instances
- ✅ More efficient - no continuous polling
- ✅ Lower latency - instant message delivery
- ✅ Better for production deployments
- ✅ More reliable and scalable

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
- Sets up the webhook URL with Telegram
- Processes incoming updates
- Removes the webhook on graceful shutdown

## Testing Webhook Setup

### Using Telegram Bot API

Check if webhook is set:
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

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

```env
USE_WEBHOOK=true
WEBHOOK_URL=https://your-app-name.onrender.com
```

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
4. **Validate updates** - The bot processes all updates from the webhook endpoint

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
