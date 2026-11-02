const {json,validChatId,cleanText,appendMessage,getMessages,notifyTelegram,connectTelegramWebhook,publicOrigin} = require('./_chat');

let webhookSetup;
function ensureTelegramWebhook(req) {
  if (webhookSetup) return webhookSetup;
  const origin = publicOrigin(req);
  if (!origin) return Promise.reject(new Error('Domain aplikasi belum tersedia.'));
  webhookSetup = connectTelegramWebhook(origin).catch(error => {
    webhookSetup = null;
    throw error;
  });
  return webhookSetup;
}

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
      let telegramError = '';
      try {
        // Deliver the visitor message first. Webhook registration is only needed for replies
        // and must not prevent an outbound notification when the deployment URL is unavailable.
        telegramNotified = await notifyTelegram(chatId, text);
        try {
          await ensureTelegramWebhook(req);
        } catch (error) {
          telegramError = error instanceof Error ? error.message : 'Webhook Telegram belum tersambung.';
          console.error('Telegram webhook setup failed:', error);
        }
      } catch (error) {
        telegramError = error instanceof Error ? error.message : 'Telegram tidak dapat dihubungi.';
        console.error('Telegram notification failed:', error);
      }
      return json(res, 200, {ok:true,telegramNotified,telegramError});
    }
    res.setHeader('Allow','GET, POST');
    return json(res, 405, {error:'Metode tidak diizinkan.'});
  } catch (error) {
    console.error('Public chat API:', error);
    return json(res, 500, {error:'Layanan chat sedang bermasalah. Periksa konfigurasi server.'});
  }
};
