const { json, sendAdminTelegram } = require('./_chat');

function text(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Metode tidak diizinkan.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const required = ['sellerName', 'sellerEmail', 'sellerPhone', 'senderAddress', 'buyerName', 'buyerEmail', 'buyerPhone', 'deliveryAddress', 'productName', 'productPrice', 'orderPayment', 'courier'];
    if (required.some((key) => !text(body[key]))) {
      return json(res, 400, { error: 'Lengkapi semua data pesanan terlebih dahulu.' });
    }

    const price = Number(body.productPrice);
    if (!Number.isFinite(price) || price <= 0) {
      return json(res, 400, { error: 'Harga produk tidak valid.' });
    }

    const orderRef = `MP-${Date.now().toString().slice(-9)}`;
    const message = [
      'Pesanan baru dari website DAVPAY INDONESIA',
      `Referensi: ${orderRef}`,
      '',
      'PENGIRIM',
      `Nama: ${text(body.sellerName, 120)}`,
      `Email: ${text(body.sellerEmail, 160)}`,
      `HP: ${text(body.sellerPhone, 40)}`,
      `Alamat: ${text(body.senderAddress)}`,
      '',
      'PENERIMA',
      `Nama: ${text(body.buyerName, 120)}`,
      `Email: ${text(body.buyerEmail, 160)}`,
      `HP: ${text(body.buyerPhone, 40)}`,
      `Alamat: ${text(body.deliveryAddress)}`,
      '',
      `Produk: ${text(body.productName, 160)}`,
      `Harga COD: Rp${price.toLocaleString('id-ID')}`,
      `Pembayaran: ${text(body.orderPayment, 80)}`,
      `Kurir: ${text(body.courier, 80)}`,
    ].join('\n');

    await sendAdminTelegram(message);
    return json(res, 200, { ok: true, orderRef, telegramNotified: true });
  } catch (error) {
    console.error('Order submission:', error);
    return json(res, 502, { error: 'Pesanan belum berhasil diteruskan ke Telegram. Periksa konfigurasi bot dan coba lagi.' });
  }
};
