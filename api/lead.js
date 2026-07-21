// Vercel serverless function: POST /api/lead
// Заменяет express-роут из server.js для деплоя на Vercel.
//
// Важно: у serverless-функций нет общей памяти между вызовами (каждый запрос
// может обслуживаться новым инстансом), поэтому простая антиспам-защита
// "1 запрос / 5 сек с одного IP" из старого server.js здесь не работает
// так же надёжно. Если нужна такая защита — используйте Vercel KV/Upstash
// (Redis) для хранения времени последнего запроса по IP.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  try {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

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

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Lead endpoint error:', err);
    return res.status(500).json({ ok: false, error: 'server error' });
  }
}
