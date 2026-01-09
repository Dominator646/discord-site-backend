const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// 1. Проверяем переменные перед стартом
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('ОШИБКА: Не заданы SUPABASE_URL или SUPABASE_ANON_KEY в Variables!');
    process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Главный маршрут для OAuth2
app.get('/', async (req, res) => {
    console.log('Получен запрос на вход:', req.query); // Логируем запрос

    const { code } = req.query;

    if (!code) {
        return res.send("Бэкенд работает! Но кода авторизации нет. Заходи с главной страницы.");
    }

    try {
        console.log('Меняем код на токен...');
        
        // Обмениваем код на токен
        const tokenResponse = await axios.post(
            'https://discord.com/api/oauth2/token',
            new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code',
                // ВНИМАНИЕ: Этот URI должен совпадать с тем, что в Discord Portal буква в букву
                redirect_uri: 'https://discord-site-backend-production.up.railway.app', 
                scope: 'identify',
            }).toString(),
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }
        );

        const accessToken = tokenResponse.data.access_token;
        console.log('Токен получен. Запрашиваем данные юзера...');

        // Получаем данные пользователя
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const user = userResponse.data;
        console.log(`Пользователь найден: ${user.username} (${user.id})`);

        // Сохраняем в Supabase
        const { error } = await supabase
            .from('users_data')
            .upsert({ 
                id: user.id, 
                username: user.username, 
                avatar: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`,
                last_login: new Date()
            });

        if (error) {
            console.error('Ошибка записи в Supabase:', error);
            return res.send("Ошибка базы данных.");
        }

        // УСПЕХ: Перебрасываем на красивую страницу (Frontend)
        // Замени ссылку ниже на свой GitHub Pages или где у тебя лежит index.html
        res.redirect(`https://ТВОЙ_НИК.github.io/discord-site-frontend/?user_id=${user.id}`);

    } catch (error) {
        console.error('Критическая ошибка:', error.response ? error.response.data : error.message);
        res.status(500).send(`Ошибка авторизации: ${error.message}`);
    }
});

// ВАЖНО: Слушаем порт, который дает Railway
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
