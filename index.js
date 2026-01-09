const express = require('express');
const axios = require('axios');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Раздача статики
app.use(express.static(path.join(__dirname, 'public')));

// Инициализация Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

app.get('/', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }

    try {
        console.log('1. Код получен, запрашиваем токен...');
        
        const tokenResponse = await axios.post(
            'https://discord.com/api/oauth2/token',
            new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: 'https://discord-site-backend-production.up.railway.app',
                scope: 'identify',
            }).toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const accessToken = tokenResponse.data.access_token;
        console.log('2. Токен получен, запрашиваем данные профиля...');

        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const user = userResponse.data;
        const avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
        console.log(`3. Данные юзера: ${user.username}. Пишем в базу...`);

        // ЗАПИСЬ В БАЗУ
        const { error: dbError } = await supabase
            .from('users_data')
            .upsert({ 
                id: user.id, 
                username: user.username, 
                avatar: avatarUrl,
                last_login: new Date().toISOString() // Используем ISO формат даты
            }, { onConflict: 'id' });

        if (dbError) {
            console.error('ОШИБКА SUPABASE:', dbError);
            throw new Error(`Supabase Error: ${dbError.message}`);
        }

        console.log('4. Успех! Отправляем скрипт закрытия.');

        // СКРИПТ ЗАКРЫТИЯ И РЕДИРЕКТА
        res.send(`
            <html>
            <body style="background: #05050a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
                <p>Авторизация успешна! Перенаправляем...</p>
                <script>
                    if (window.opener) {
                        window.opener.localStorage.setItem('logged_user_id', '${user.id}');
                        window.opener.localStorage.setItem('user_name', '${user.username}');
                        window.opener.localStorage.setItem('user_avatar', '${avatarUrl}');
                        window.opener.location.href = '/dashboard.html';
                        window.close();
                    } else {
                        window.location.href = '/dashboard.html';
                    }
                </script>
            </body>
            </html>
        `);

    } catch (error) {
        console.error('КРИТИЧЕСКАЯ ОШИБКА БЭКЕНДА:', error.response ? error.response.data : error.message);
        res.status(500).send(`
            <div style="background: #1a1a1a; color: #ff4d4d; padding: 20px; font-family: sans-serif; border-radius: 10px;">
                <h2>Ошибка авторизации</h2>
                <p>${error.message}</p>
                <small>Проверьте логи в Railway для деталей.</small>
            </div>
        `);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
