const {json,validChatId,cleanText,redis,getMessages,appendMessage,connectTelegramWebhook,publicOrigin} = require('./_chat');
function authorized(req) {
  const expected = process.env.CHAT_ADMIN_TOKEN;
  const header = req.headers.authorization || '';
  return !!expected && header === `Bearer ${expected}`;
}
module.exports = async (req, res) => {
  if (!authorized(req)) return json(res, 401, {error:'Token admin tidak valid.'});
  try {
    if (req.method === 'GET') {
      const ids = await redis(['SMEMBERS','mp:chats']) || [];
      const chats = [];
      for (const chatId of ids.slice(0,200)) {
        if (!validChatId(chatId)) continue;
        const messages = await getMessages(chatId);
        if (messages.length) chats.push({chatId,messages});
      }
      chats.sort((a,b)=>(b.messages.at(-1)?.at||0)-(a.messages.at(-1)?.at||0));
      const depositIds = await redis(['LRANGE','mp:deposits',0,19]) || [];
      const deposits = [];
      for (const id of depositIds) { const raw = await redis(['GET',`mp:deposit:${id}`]); if (raw) { try { const item=JSON.parse(raw); deposits.push(item); } catch {} } }
      deposits.sort((x,y)=>y.createdAt-x.createdAt);
      return json(res,200,{chats,deposits});
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      if (body.action === 'connectTelegram') {
        const origin = publicOrigin(req);
        if (!origin) return json(res,400,{error:'Domain aplikasi belum tersedia.'});
        try {
          const webhookUrl = await connectTelegramWebhook(origin);
          return json(res,200,{ok:true,webhookUrl});
        } catch (error) {
          console.error('Telegram setup failed:', error);
          return json(res,502,{error:`Telegram belum aktif: ${error.message}`});
        }
      }
      const chatId = body.chatId;
      const text = cleanText(body.text);
      if (!validChatId(chatId)) return json(res,400,{error:'ID percakapan tidak valid.'});
      if (!text) return json(res,400,{error:'Balasan tidak boleh kosong.'});
      await appendMessage(chatId,{from:'admin',text,at:Date.now()});
      return json(res,200,{ok:true});
    }
    res.setHeader('Allow','GET, POST');
    return json(res,405,{error:'Metode tidak diizinkan.'});
  } catch (error) {
    console.error('Admin chat API:',error);
    return json(res,500,{error:'Layanan admin chat bermasalah. Periksa konfigurasi Redis.'});
  }
};
