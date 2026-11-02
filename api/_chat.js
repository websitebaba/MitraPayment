const { createHmac } = require('node:crypto');
const DAY = 60 * 60 * 24;
const MAX_TEXT = 1000;
const CHAT_ID_RE = /^[a-zA-Z0-9_-]{8,100}$/;
const TELEGRAM_API = 'https://api.telegram.org';

function publicOrigin(req) {
  // Use the current deployment host first so preview traffic never registers Telegram on an older production deployment.
  const configured = req?.headers?.['x-forwarded-host'] || process.env.VERCEL_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || req?.headers?.host;
  if (!configured) return '';
  const value = String(configured).trim();
  if (/^https?:\/\//i.test(value)) return value.replace(/\/+$/, '');
  const protocol = process.env.VERCEL || !/^localhost(?::\d+)?$/i.test(value) ? 'https' : 'http';
  return `${protocol}://${value}`;
}

function telegramConfig() {
  const rawToken = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const token = rawToken.replace(/^bot/i, '');
  const adminChatId = String(process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!token || !adminChatId) return null;
  return { token, adminChatId };
}
function telegramWebhookSecret(token) {
  return createHmac('sha256', token).update('mitra-payment-telegram-webhook-v1').digest('hex');
}
async function telegramRequest(token, method, payload) {
  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.description || `Telegram ${method} gagal.`);
  return data.result;
}
async function sendAdminTelegram(text) {
  const config = telegramConfig();
  if (!config) throw new Error('TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID harus dikonfigurasi.');
  await telegramRequest(config.token, 'sendMessage', { chat_id: config.adminChatId, text });
  return true;
}
async function notifyTelegram(chatId, text) {
  const config = telegramConfig();
  if (!config) return false;
  const result = await telegramRequest(config.token, 'sendMessage', {
    chat_id: config.adminChatId,
    text: `Pesan baru dari website\nPercakapan: ${chatId}\n\n${text}\n\nBalas pesan ini untuk menjawab pengunjung.`
  });
  await redis(['SET', `mp:telegram:reply:${config.adminChatId}:${result.message_id}`, chatId, 'EX', DAY * 30]);
  return true;
}
async function connectTelegramWebhook(origin) {
  const config = telegramConfig();
  if (!config) throw new Error('TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID harus dikonfigurasi.');
  const url = `${origin.replace(/\/+$/, '')}/api/telegram-webhook`;
  await telegramRequest(config.token, 'setWebhook', {
    url,
    secret_token: telegramWebhookSecret(config.token),
    allowed_updates: ['message'],
    drop_pending_updates: false
  });
  return url;
}

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('Konfigurasi Redis belum lengkap.');
  return { url: url.replace(/\/+$/, ''), token };
}
async function redis(command) {
  const {url, token} = redisConfig();
  const response = await fetch(url, {
    method: 'POST',
    headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'},
    body: JSON.stringify(command)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error || 'Redis request gagal.');
  return data.result;
}
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}
function validChatId(value) {
  return typeof value === 'string' && CHAT_ID_RE.test(value);
}
function cleanText(value) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_TEXT) : '';
}
async function appendMessage(chatId, message) {
  const key = `mp:chat:${chatId}`;
  await redis(['RPUSH', key, JSON.stringify(message)]);
  await redis(['EXPIRE', key, DAY * 30]);
  await redis(['SADD', 'mp:chats', chatId]);
  await redis(['EXPIRE', 'mp:chats', DAY * 30]);
}
async function getMessages(chatId) {
  const rows = await redis(['LRANGE', `mp:chat:${chatId}`, '0', '-1']);
  return (rows || []).map(row => { try { return JSON.parse(row); } catch { return null; } }).filter(Boolean);
}
module.exports = {DAY,MAX_TEXT,CHAT_ID_RE,redis,json,validChatId,cleanText,appendMessage,getMessages,telegramConfig,telegramWebhookSecret,telegramRequest,sendAdminTelegram,notifyTelegram,connectTelegramWebhook,publicOrigin};
