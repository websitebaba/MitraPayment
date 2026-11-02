const {json,redis,sendAdminTelegram} = require('./_chat');
const MAX_IMAGE_CHARS = 1800000;
module.exports = async (req,res) => {
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return json(res,405,{error:'Metode tidak diizinkan.'}); }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (typeof body.accountId !== 'string' || !body.accountId.trim() || !Number.isFinite(Number(body.amount)) || Number(body.amount) < 10000) return json(res,400,{error:'Data akun atau nominal tidak valid.'});
    if (typeof body.proof !== 'string' || !/^data:image\/jpeg;base64,/.test(body.proof) || body.proof.length > MAX_IMAGE_CHARS) return json(res,400,{error:'Bukti gambar tidak valid atau terlalu besar. Pilih gambar lain.'});
    const id = `DEP-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    const item = {id,accountId:body.accountId.trim().slice(0,80),amount:Number(body.amount),method:String(body.methodLabel||body.method||'').slice(0,40),note:String(body.note||'').slice(0,500),proof:body.proof,createdAt:Date.now(),status:'Menunggu verifikasi'};
    await redis(['SET',`mp:deposit:${id}`,JSON.stringify(item),'EX',60*60*24*30]);
    await redis(['LPUSH','mp:deposits',id]);
    await redis(['LTRIM','mp:deposits',0,199]);
    await redis(['EXPIRE','mp:deposits',60*60*24*30]);
    await sendAdminTelegram([
      'Formulir top up baru dari website DAVPAY',
      `ID: ${id}`,
      `Akun: ${item.accountId}`,
      `Nominal: Rp${item.amount.toLocaleString('id-ID')}`,
      `Metode: ${item.method || '-'}`,
      `Catatan: ${item.note || '-'}`,
      'Bukti pembayaran tersimpan di panel admin.'
    ].join('\n'));
    return json(res,200,{ok:true,id,telegramNotified:true});
  } catch(error) { console.error('Deposit submission:',error); return json(res,500,{error:'Formulir tersimpan sebagian, tetapi belum berhasil diteruskan ke Telegram. Periksa konfigurasi Redis dan Telegram.'}); }
};
