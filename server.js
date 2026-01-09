const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

app.get('/', async (req, res) => {
    const { code } = req.query;

    if (!code) return res.send("Ошибка: Код авторизации не найден.");

    try {
        // 1. Обмен кода на токен
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: 'https://discord-site-backend-production.up.railway.app',
            scope: 'identify',
        }));

        // 2. Получение данных юзера
        const userResp = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` }
        });

        const discordUser = userResp.data;

        // 3. Сохранение в базу (если юзер есть — обновит ник/аватар, если нет — создаст)
        const { error } = await supabase.from('users_data').upsert({
            id: discordUser.id,
            username: discordUser.username,
            avatar: `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        });

        if (error) throw error;

        // 4. Редирект на САМ САЙТ (Второй репозиторий)
        // Передаем ID через параметры, чтобы фронтенд его подхватил
        res.redirect(`https://dominator646.vercel.app/?user_id=${discordUser.id}`);

    } catch (err) {
        console.error(err);
        res.status(500).send("Ошибка авторизации. Проверь логи Railway.");
    }
});

app.listen(process.env.PORT || 3000);
