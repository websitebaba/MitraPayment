# Mitra Payment — Live Chat dan Telegram

Website ini memiliki widget chat pengunjung dan panel admin di `/admin.html`. Pesan dan balasan disimpan di Upstash Redis selama 30 hari.

## Variabel lingkungan

Pastikan variabel berikut terpasang pada project Vercel:

- `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN` — penyimpanan chat yang sudah ada.
- `CHAT_ADMIN_TOKEN` — token untuk masuk ke panel admin.
- `TELEGRAM_BOT_TOKEN` — token bot dari BotFather.
- `TELEGRAM_CHAT_ID` — ID chat Telegram admin yang menerima notifikasi.

Jangan pernah menaruh token-token ini di HTML publik atau membagikannya di chat.

## Mengaktifkan chat dua arah Telegram

1. Deploy website ke Vercel dan buka `/admin.html`.
2. Masuk dengan `CHAT_ADMIN_TOKEN`.
3. Pastikan akun admin sudah membuka percakapan dengan bot dan `TELEGRAM_CHAT_ID` menunjuk ke chat tersebut.
4. Tekan **Aktifkan Telegram**. Aplikasi mendaftarkan webhook HTTPS dan mengirim pesan uji ke chat admin.
5. Kirim pesan melalui widget website. Balas notifikasi bot menggunakan fitur **Reply** di Telegram; balasan akan muncul di widget pengunjung.

Webhook hanya menerima balasan dari `TELEGRAM_CHAT_ID` yang dikonfigurasi. Rahasia verifikasi webhook dibuat dari token bot di sisi server dan tidak dikirim ke browser.
