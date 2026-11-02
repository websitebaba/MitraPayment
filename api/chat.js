const {json,validChatId,cleanText,appendMessage,getMessages,notifyTelegram} = require('./_chat');
module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const chatId = String(req.query.chatId || '');
      if (!validChatId(chatId)) return json(res, 400, {error:'ID percakapan tidak valid.'});
      return json(res, 200, {messages: await getMessages(chatId)});
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const chatId = body.chatId;
      const text = cleanText(body.text);
      if (!validChatId(chatId)) return json(res, 400, {error:'ID percakapan tidak valid.'});
      if (!text) return json(res, 400, {error:'Pesan tidak boleh kosong.'});
      await appendMessage(chatId, {from:'visitor',text,at:Date.now()});
      let telegramNotified = false;
      try {
        const origin = requestOrigin(req);
        if (origin && telegramConfig() && !/localhost|127\.0\.0\.1/.test(origin)) {
          await connectTelegramWebhook(origin);
        }
        telegramNotified = await notifyTelegram(chatId, text);
      } catch (error) {
        console.error('Telegram notification failed:', error);
      }
      return json(res, 200, {ok:true,telegramNotified});
    }
    res.setHeader('Allow','GET, POST');
    return json(res, 405, {error:'Metode tidak diizinkan.'});
  } catch (error) {
    console.error('Public chat API:', error);
    return json(res, 500, {error:'Layanan chat sedang bermasalah. Periksa konfigurasi server.'});
  }
};
