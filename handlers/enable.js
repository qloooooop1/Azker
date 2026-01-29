module.exports = (bot, db) => {
    return async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        
        try {
            // التحقق من صلاحية المشرف
            const chatMember = await bot.getChatMember(chatId, userId);
            if (!['creator', 'administrator'].includes(chatMember.status)) {
                await bot.sendMessage(chatId, '⚠️ هذا الأمر متاح للمشرفين فقط.');
                return;
            }

            db.run(`UPDATE groups SET bot_enabled = 1 WHERE chat_id = ?`, [chatId], async (err) => {
                if (err) {
                    await bot.sendMessage(chatId, '❌ حدث خطأ في تفعيل البوت.');
                    return;
                }

                await bot.sendMessage(chatId, 
                    '✅ *تم تفعيل البوت بنجاح*\nسأبدأ بنشر الأذكار حسب الجدولة المحددة.', 
                    { parse_mode: 'Markdown' }
                );
            });

        } catch (error) {
            console.error('❌ خطأ في /enable:', error);
            await bot.sendMessage(chatId, '❌ حدث خطأ، حاول مرة أخرى.');
        }
    };
};