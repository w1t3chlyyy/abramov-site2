const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// простая защита от спама: не больше 1 заявки в 5 секунд с одного IP
const lastRequestByIp = new Map();

app.post('/api/lead', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const last = lastRequestByIp.get(ip) || 0;
    if (now - last < 5000) {
      return res.status(429).json({ ok: false, error: 'too many requests' });
    }
    lastRequestByIp.set(ip, now);

    const { name, contact, message } = req.body || {};

    if (!name || !contact || typeof name !== 'string' || typeof contact !== 'string') {
      return res.status(400).json({ ok: false, error: 'name and contact are required' });
    }
    if (name.length > 200 || contact.length > 200 || (message && message.length > 2000)) {
      return res.status(400).json({ ok: false, error: 'input too long' });
    }

    if (!BOT_TOKEN || !CHAT_ID) {
      console.error('TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID не заданы в переменных окружения');
      return res.status(500).json({ ok: false, error: 'server not configured' });
    }

    const text =
      `📩 НОВАЯ ЗАЯВКА С САЙТА\n\n` +
      `👤 Имя: ${name}\n` +
      `📱 Контакт: ${contact}\n` +
      `📝 Сообщение: ${message && message.trim() ? message : 'Не указано'}`;

    const tgResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text }),
    });

    const data = await tgResponse.json();

    if (!data.ok) {
      console.error('Telegram API error:', data);
      return res.status(502).json({ ok: false, error: 'telegram error' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Lead endpoint error:', err);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
