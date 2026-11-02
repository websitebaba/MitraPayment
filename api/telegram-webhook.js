const {DAY,json,redis,validChatId,cleanText,appendMessage,telegramConfig,telegramWebhookSecret} = require('./_chat');
const {timingSafeEqual} = require('node:crypto');

function authorized(req, token) {
  const received = Buffer.from(req.headers['x-telegram-bot-api-secret-token'] || '');
  const expected = Buffer.from(telegramWebhookSecret(token));
  return received.length === expected.length && timingSafeEqual(received, expected);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, {error:'Metode tidak diizinkan.'});
  }
  const config = telegramConfig();
  if (!config) return json(res, 503, {error:'Konfigurasi bot Telegram belum lengkap.'});
  if (!authorized(req, config.token)) return json(res, 401, {error:'Webhook tidak terverifikasi.'});

  try {
    const update = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const message = update.message;
    if (!Number.isSafeInteger(update.update_id) || !message || String(message.chat?.id) !== config.adminChatId || message.from?.is_bot || typeof message.text !== 'string' || !message.reply_to_message) {
      return json(res, 200, {ok:true});
    }

    const text = cleanText(message.text);
    if (!text || /^\/[a-z0-9_]+(?:@\w+)?(?:\s|$)/i.test(text)) return json(res, 200, {ok:true});

    const originalMessageId = message.reply_to_message.message_id;
    const replyKey = `mp:telegram:reply:${config.adminChatId}:${originalMessageId}`;
    const chatId = await redis(['GET', replyKey]);
    if (!validChatId(chatId)) return json(res, 200, {ok:true});

    const updateKey = `mp:telegram:update:${update.update_id}`;
    const claimed = await redis(['SET', updateKey, '1', 'NX', 'EX', DAY]);
    if (!claimed) return json(res, 200, {ok:true});

    try {
      await appendMessage(chatId, {from:'admin',text,at:Date.now()});
      await redis(['SET', `mp:telegram:reply:${config.adminChatId}:${message.message_id}`, chatId, 'EX', DAY * 30]);
    } catch (error) {
      await redis(['DEL', updateKey]).catch(() => {});
      throw error;
    }
    return json(res, 200, {ok:true});
  } catch (error) {
    console.error('Telegram webhook:', error);
    return json(res, 500, {error:'Pesan Telegram gagal diproses.'});
  }
};
