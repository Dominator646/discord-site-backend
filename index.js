// index.js (или app.js) — пример на Express
import express from 'express';
import fetch from 'node-fetch';  // или axios
import { createClient } from '@supabase/supabase-js';

const app = express();

const SUPABASE_URL = 'https://vbaivcaovxhsrzbqmmob.supabase.co';
const SUPABASE_KEY = 'sb_secret_Hns-9uNcMw5SqyA0_fTa6A_VmddrXQ1';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CLIENT_ID = '1431712036626104401';
const CLIENT_SECRET = 'vD7NDWzlxsqBQLrI9ssJgMymGZjE9fLl';  // ← храни в .env на Railway!
const REDIRECT_URI = 'https://discord-site-backend-production.up.railway.app/auth/discord/callback';

app.get('/discord-callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.send(`<h1>Ошибка авторизации: ${error}</h1><script>window.close();</script>`);
  }

  if (!code) {
    return res.send('<h1>Нет кода авторизации</h1><script>window.close();</script>');
  }

  try {
    // 1. Обмен code на токены
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        scope: 'identify email',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_description || 'Ошибка получения токена');
    }

    // 2. Получаем данные пользователя
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const user = await userResponse.json();

    // 3. Сохраняем/обновляем в Supabase (пример)
    const { error: supErr } = await supabase
      .from('users')
      .upsert({
        discord_id: user.id,
        username: user.username,
        global_name: user.global_name,
        avatar: user.avatar,
        email: user.email,           // если scope email есть
        last_login: new Date().toISOString(),
        // coins: ... (если нужно дефолтное значение)
      }, { onConflict: 'discord_id' });

    if (supErr) console.error('Supabase error:', supErr);

    // 4. Возвращаем страничку-закрыватель
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Авторизация...</title></head>
      <body>
        <p>Успешно! Сейчас закроется...</p>
        <script>
          // Сообщаем родительскому окну
          if (window.opener) {
            window.opener.postMessage('auth_success', '${window.location.origin}');
          }
          // Закрываем попап
          window.close();
        </script>
      </body>
      </html>
    `);

  } catch (err) {
    console.error(err);
    res.send(`<h1>Что-то пошло не так...</h1><p>${err.message}</p><script>window.close();</script>`);
  }
});
