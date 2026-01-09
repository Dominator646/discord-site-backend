const express = require('express');
const axios = require('axios');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// 1. Настройка статики (чтобы открывались index.html и dashboard.html из папки public)
app.use(express.static(path.join(__dirname, 'public')));

// 2. Инициализация Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// 3. Основной маршрут для авторизации через Discord
app.get('/', async (req, res) => {
    const { code } = req.query;

    // Если кода нет (пользователь просто зашел на сайт), отдаем index.html
    if (!code) {
        return res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }

    try {
        console.log('--- Авторизация: обмен кода на токен ---');

        // Обмениваем код на токен доступа
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

        // Получаем данные пользователя из Discord
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const user = userResponse.data;
        const avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;

        // 4. Запись в Supabase (Таблица users_data)
        const { error: supabaseError } = await supabase
            .from('users_data')
            .upsert({ 
                id: user.id, 
                username: user.username, 
                avatar: avatarUrl,
                last_login: new Date()
            });

        if (supabaseError) throw supabaseError;

        // 5. Финальный скрипт для маленького окна
        // Он сохраняет данные в "родительское" окно, перекидывает его на dashboard и закрывается
        res.send(`
            <html>
            <body style="background: #05050a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
                <script>
                    if (window.opener) {
                        // Сохраняем данные в localStorage основного окна
                        window.opener.localStorage.setItem('logged_user_id', '${user.id}');
                        window.opener.localStorage.setItem('user_name', '${user.username}');
                        window.opener.localStorage.setItem('user_avatar', '${avatarUrl}');
                        
                        // Перенаправляем основное окно на Dashboard
                        window.opener.location.href = '/dashboard.html';
                        
                        // Закрываем текущее маленькое окно авторизации
                        window.close();
                    } else {
                        // Если зашли напрямую (не через поп-ап)
                        window.location.href = '/dashboard.html';
                    }
                </script>
            </body>
            </html>
        `);

    } catch (error) {
        console.error('Ошибка:', error.message);
        res.status(500).send("Ошибка авторизации. Попробуйте снова.");
    }
});

// Запуск сервера на порту Railway
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер NeСкам запущен на порту ${PORT}`);
});
