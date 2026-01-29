module.exports = (bot, db) => {
    return async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        
        try {
            const chatMember = await bot.getChatMember(chatId, userId);
            if (!['creator', 'administrator'].includes(chatMember.status)) {
                await bot.sendMessage(chatId, '⚠️ هذا الأمر متاح للمشرفين فقط.');
                return;
            }

            db.run(`UPDATE groups SET bot_enabled = 0 WHERE chat_id = ?`, [chatId], async (err) => {
                if (err) {
                    await bot.sendMessage(chatId, '❌ حدث خطأ في إيقاف البوت.');
                    return;
                }

                await bot.sendMessage(chatId, 
                    '⏸️ *تم إيقاف البوت مؤقتاً*\nلن يتم نشر أي أذكار حتى إعادة التفعيل.', 
                    { parse_mode: 'Markdown' }
                );
            });

        } catch (error) {
            console.error('❌ خطأ في /disable:', error);
            await bot.sendMessage(chatId, '❌ حدث خطأ، حاول مرة أخرى.');
        }
    };
};