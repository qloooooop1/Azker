module.exports = (bot, db) => {
    return async (msg) => {
        const chatId = msg.chat.id;
        
        db.get(`SELECT bot_enabled, is_active, created_at, title FROM groups WHERE chat_id = ?`, 
            [chatId], async (err, group) => {
                if (err || !group) {
                    await bot.sendMessage(chatId, '❌ هذه المجموعة غير مسجلة.');
                    return;
                }

                const status = group.bot_enabled === 1 ? '🟢 نشط' : '🔴 متوقف';
                const statusMsg = `*حالة البوت في ${group.title || 'المجموعة'}*\n\n` +
                    `📊 الحالة: ${status}\n` +
                    `📅 تاريخ الإضافة: ${new Date(group.created_at).toLocaleDateString('ar-SA')}\n` +
                    `🕒 آخر تحديث: ${new Date().toLocaleTimeString('ar-SA')}\n\n` +
                    `*الأوامر:*\n` +
                    `${group.bot_enabled === 1 ? '❌ /disable - إيقاف البوت' : '✅ /enable - تفعيل البوت'}`;

                await bot.sendMessage(chatId, statusMsg, { parse_mode: 'Markdown' });
            });
    };
};