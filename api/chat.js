const {json,validChatId,cleanText,appendMessage,getMessages,notifyTelegram,connectTelegramWebhook} = require('./_chat');

let webhookSetup;
function ensureTelegramWebhook(req) {
  if (webhookSetup) return webhookSetup;
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || req.headers['x-forwarded-host'] || req.headers.host;
  if (!host) return Promise.reject(new Error('Domain aplikasi belum tersedia.'));
  const protocol = process.env.VERCEL ? 'https' : (req.headers['x-forwarded-proto'] || (String(host).startsWith('localhost') ? 'http' : 'https'));
  webhookSetup = connectTelegramWebhook(`${protocol}://${host}`).catch(error => {
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
      try {
        await ensureTelegramWebhook(req);
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
